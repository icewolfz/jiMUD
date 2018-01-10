/**
 * Mail
 *
 * Hand GMCP ShadowMUD Post protocol
 *
 * @arthur William
 * @created 2018-01-05
 * @change 2018-01-09 William Set file in constructor
 */
//cSpell:words fswin, chunksize
import EventEmitter = require('events');
import { Client } from './client';
import { parseTemplate, isFileSync } from './library';
import { MailStatus, MailAction, MailReadFormat, MailFolders } from './types';
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const { ipcRenderer } = require('electron');

export class Mail extends EventEmitter {

    private _list;
    private _db;
    private _changed: boolean = false;
    private _file = path.join(parseTemplate('{data}'), 'mail.sqlite');
    private _gettingMail: number;
    private _read = {};
    private _mark = {};

    constructor(file?: string) {
        super();
        this.file = file;
        this.initializeDatabase();
    }

    get isDirty(): boolean { return this._changed; }
    set isDirty(value: boolean) { this._changed = value; }

    set file(value: string) {
        if (value !== this._file) {
            this._file = value;
            if (this._db)
                this._db.close(() => {
                    this.initializeDatabase();
                });
            else
                this.initializeDatabase();
        }
    }
    get file(): string { return this._file; }

    public initializeDatabase() {
        this._db = new sqlite3.Database(this._file);
        this.createDatabase();
        this._db.serialize();
    }

    public createDatabase(prefix?) {
        if (prefix)
            prefix += '.';
        else
            prefix = '';
        this._db.serialize(() => {
            //this._db.run("PRAGMA synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA journal_mode = TRUNCATE;PRAGMA optimize;PRAGMA read_uncommitted = 1;PRAGMA threads = 4;");
            this._db.run('PRAGMA ' + prefix + 'synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA threads = 4;');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'Mail (MailID TEXT PRIMARY KEY ASC, [From] INTEGER, [Date] INTEGER, Subject TEXT, Raw TEXT, Ansi TEXT, Folder INTEGER, Read INTEGER)');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'CC (MailID TEXT, NameID INTEGER, FOREIGN KEY(MailID) REFERENCES Mail(MailID), FOREIGN KEY(NameID) REFERENCES Names(NameID))');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + '[To] (MailID TEXT, NameID INTEGER, FOREIGN KEY(MailID) REFERENCES Mail(MailID), FOREIGN KEY(NameID) REFERENCES Names(NameID))');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'Names (NameID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT)');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'Groups (GroupID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT)');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'GroupMembers (GroupID INTEGER, NameID INTEGER, FOREIGN KEY(GroupID) REFERENCES Groups(GroupID), FOREIGN KEY(NameID) REFERENCES Names(NameID))');
            this._db.run('CREATE UNIQUE INDEX IF NOT EXISTS ' + prefix + 'index_mailid on Mail (MailID);');
            this._db.run('CREATE UNIQUE INDEX IF NOT EXISTS ' + prefix + 'index_nameid on Names (NameID);');
            this._db.run('CREATE UNIQUE INDEX IF NOT EXISTS ' + prefix + 'index_groupid on Groups (GroupID);');
        });
    }

    public processGMCP(mod: string, obj) {
        const mods = mod.split('.');
        let i;
        let il;
        if (mods.length < 2 || mods[0] !== 'Post') return;
        switch (mods[1]) {
            case 'init':
                this.emit('initialize');
                break;
            case 'new':
                this.emit('new');
                break;
            case 'letter':
                if (this._read[obj.id + '-' + obj.format]) {
                    this._read[obj.id + '-' + obj.format](obj);
                    delete this._read[obj.id + '-' + obj.format];
                }
                this.updateBody(obj);
                break;
            case 'status':
                if (obj.id === MailAction.mark) {
                    if (obj.code === MailStatus.SUCCESS) {
                        this._db.run('Update Mail SET Read = ? WHERE MailID = ?', [obj.read, obj.id], (err) => {
                            if (err)
                                this.emit('error', err);
                            else
                                this.emit('mark-changed', obj.id);
                        });
                    }
                    else {
                        switch (obj.code) {
                            case MailStatus.INVALID_ID:
                                this.emit('error', 'Invalid letter when marking');
                                break;
                            default:
                                this.emit('error', `Error marking ${obj.id} as ${obj.read ? 'read' : 'unread'}`);
                                break;
                        }
                    }
                }
                break;
            case 'mail':
                if (!this._list)
                    this._list = [];
                this._list.push.apply(this._list, obj.letters);
                if (obj.last) {
                    il = this._list.length;
                    for (i = 0; i < il; i++)
                        this.addOrUpdateLetter(this._list[i]);
                    if (this._gettingMail) {
                        this.emit('got-mail', this._gettingMail, this._list);
                        this._gettingMail = 0;
                    }
                    else
                        this.emit('got-mail', Math.floor(Date.now() / 1000), this._list);
                    this._list = null;
                }
                break;
        }
    }

    public addOrUpdateLetter(letter, callback?) {
        if (!letter) return;
        this._db.run('INSERT OR REPLACE INTO Mail (MailID, Date, Subject, Read, Folder, Raw, Ansi) VALUES (?, ?, ?, ?, ?, (SELECT Raw FROM Mail WHERE MailID = ?), (SELECT Ansi FROM Mail WHERE MailID = ?)) ',
            [
                letter.id,
                letter.date,
                letter.subject,
                letter.read,
                MailFolders.inbox,
                letter.id,
                letter.id
            ], (err) => {
                if (err)
                    this.emit('error', err);
                else {
                    this._db.run('DELETE FROM CC WHERE MailID = ?', [letter.id], () => {
                        this._db.run('DELETE FROM [To] WHERE MailID = ?', [letter.id], () => {
                            let n;
                            let nl;
                            const stmt = this._db.prepare(`INSERT INTO Names(Name) SELECT $from WHERE NOT EXISTS(SELECT 1 FROM Names WHERE Name = $from);`);
                            stmt.run({ $from: letter.from }, (err2) => {
                                if (err2)
                                    this.emit('error', err2);
                                this._db.get('SELECT NameID from Names WHERE Name = ?', [letter.from], (err3, row) => {
                                    if (err3)
                                        this.emit('error', err3);
                                    this._db.run('Update Mail SET [From] = ? WHERE MailID = ?', [row.NameID, letter.id]);
                                });
                            });
                            nl = letter.cc.length;
                            for (n = 0; n < nl; n++) {
                                stmt.run({ $from: letter.cc[n] }, (err2) => {
                                    if (err2)
                                        this.emit('error', err2);
                                    this._db.get('SELECT NameID from Names WHERE Name = ?', [letter.from], (err3, row) => {
                                        this._db.run('INSERT INTO CC (MailID, NameID) VALUES (?, ?)', [letter.id, row.NameID]);
                                    });
                                });
                            }
                            nl = letter.to.length;
                            for (n = 0; n < nl; n++) {
                                stmt.run({ $from: letter.to[n] }, (err2) => {
                                    if (err2)
                                        this.emit('error', err2);
                                    this._db.get('SELECT NameID from Names WHERE Name = ?', [letter.from], (err3, row) => {
                                        this._db.run('INSERT INTO [To] (MailID, NameID) VALUES (?, ?)', [letter.id, row.NameID]);
                                    });
                                });
                            }
                            stmt.finalize();
                            if (callback) callback();
                        });
                    });
                }
                this._changed = true;
                this.emit('letter-add', letter);
            });
    }

    public updateBody(letter) {
        if (!letter) return;
        this.addOrUpdateLetter(letter, () => {
            let sql;
            if (letter.format === MailReadFormat.ansi)
                sql = 'Update Mail SET Ansi = ? WHERE MailID = ?';
            else
                sql = 'Update Mail SET Raw = ? WHERE MailID = ?';
            this._db.run(sql, [letter.body, letter.id], (err) => {
                if (err)
                    this.emit('error', err);
            });
        });
    }

    public getLetters(folder, callback) {
        this._db.all('SELECT MailID as id, Names.Name as [from], [Date] as [date], Subject as subject, Read as read FROM Mail INNER JOIN Names on Names.NameID = Mail.[From] WHERE Folder = ?', [folder], (err, rows) => {
            if (err)
                this.emit('error', err);
            else {
                this._db.all('SELECT Names.Name FROM [To] INNER JOIN Names on Names.NameID = [To].NameID WHERE [To].MailID = ?', [rows.id], (err2, rows2) => {
                    if (err2)
                        this.emit('error', err2);
                    else if (callback) {
                        rows.to = rows2.map((obj) => {
                            return obj.Name;
                        });
                        callback(rows || []);
                    }
                });
            }
        });
    }

    public getLetterList(folder, callback) {
        this._db.all('SELECT MailID as id, Names.Name as [from], [Date] as [date], Subject as subject, Read as read FROM Mail INNER JOIN Names on Names.NameID = Mail.[From] WHERE Folder = ?', [folder], (err, rows) => {
            if (err)
                this.emit('error', err);
            else if (callback)
                callback(rows || []);
        });
    }

    public getLetter(id, callback) {
        this._db.get('SELECT MailID as id, Names.Name as [from], [Date] as [date], Subject as subject, Read as read FROM Mail INNER JOIN Names on Names.NameID = Mail.[From] WHERE Mail.MailID = ?', [id], (err, row) => {
            if (err)
                this.emit('error', err);
            else {
                this._db.all('SELECT Names.Name FROM [To] INNER JOIN Names on Names.NameID = [To].NameID WHERE [To].MailID = ?', [id], (err2, rows) => {
                    if (err2)
                        this.emit('error', err2);
                    else if (callback) {
                        if (row)
                            row.to = rows.map((obj) => {
                                return obj.Name;
                            });
                        callback(row);
                    }
                });
            }
        });
    }

    public getMail(date?: (number | Date)) {
        if (date instanceof Date)
            date = date.getTime();
        if (date)
            ipcRenderer.send('send-gmcp', 'Post.list ' + date);
        else
            ipcRenderer.send('send-gmcp', 'Post.list');
        this._gettingMail = Math.floor(Date.now() / 1000);
    }

    public read(id, format: MailReadFormat, callback) {
        let sql;
        if (format === MailReadFormat.ansi)
            sql = 'SELECT MailID as id, Names.Name as [from], [Date] as [date], Subject as subject, Read as read, Ansi as body FROM Mail INNER JOIN Names on Names.NameID = Mail.[From] WHERE MailID = ?';
        else
            sql = 'SELECT MailID as id, Names.Name as [from], [Date] as [date], Subject as subject, Read as read, Raw as body FROM Mail INNER JOIN Names on Names.NameID = Mail.[From] WHERE MailID = ?';
        this._db.get(sql, [id], (err, row) => {
            if (err) {
                this.emit('error', err);
                if (callback)
                    callback(0);
            }
            else if (!row) {
                if (callback)
                    callback(0);
            }
            else {
                if (!row.body) {
                    if (callback)
                        this._read[id + '-' + format] = callback;
                    ipcRenderer.send('send-gmcp', `Post.read {id:"${id}", format:${format}}`);
                }
                else
                    this._db.all('SELECT Names.Name FROM CC INNER JOIN Names on Names.NameID = CC.NameID WHERE CC.MailID = ?', [id], (err2, rows) => {
                        if (err2)
                            this.emit('error', err2);
                        else if (callback) {
                            row.cc = rows.map((obj) => {
                                return obj.Name;
                            });
                            callback(row);
                        }
                    });
            }
        });
    }

    public mark(id, mark: number) {
        ipcRenderer.send('send-gmcp', `Post.mark {id:"${id}", read:${mark}}`);
        this._db.run('Update Mail SET Read = ? WHERE MailID = ?', [mark, id], (err) => {
            if (err)
                this.emit('error', err);
            else
                this.emit('mark-changed', id);
        });
    }

    public newCount(folder, callback) {
        this._db.get('SELECT Count(Read) as count FROM Mail WHERE Read = 0 AND Folder = ?', [folder], (err, row) => {
            if (err)
                this.emit('error', err);
            if (callback)
                callback(row ? row.count : 0);
        });
    }
}