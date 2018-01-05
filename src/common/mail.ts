/**
 * IED
 *
 * send and receive IED gmcp protocol
 * @arthur William
 */
//cSpell:words fswin, chunksize
import EventEmitter = require('events');
import { Client } from './client';
import { parseTemplate, isDirSync } from './library';
import { MailStatus, MailAction, MailReadFormat } from './types';
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const { ipcRenderer } = require('electron');

export class Mail extends EventEmitter {

    private _list;
    private _db;
    private _changed: boolean = false;
    private _file = path.join(parseTemplate('{data}'), 'mail.sqlite');

    constructor(file?: string) {
        super();
        this.initializeDatabase();
    }

    get isDirty(): boolean { return this._changed; }
    set isDirty(value: boolean) { this._changed = value; }

    set file(value: string) {
        if (value !== this._file) {
            this._db.close(() => {
                this._file = value;
                this.initializeDatabase();
            });
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
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'Mail (MailID TEXT PRIMARY KEY ASC, To TEXT, From INTEGER, Date INTEGER, Subject TEXT, Raw TEXT, Ansi TEXT)');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'CC (MailID TEXT, NameID INTEGER, FOREIGN KEY(MailID) REFERENCES Mail(MailID), FOREIGN KEY(NameID) REFERENCES Names(NameID))');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'Names (NameID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT)');
            this._db.run('CREATE UNIQUE INDEX IF NOT EXISTS ' + prefix + 'index_mailid on Mail (MailID);');
            this._db.run('CREATE UNIQUE INDEX IF NOT EXISTS ' + prefix + 'index_nameid on Names (NameID);');
        });
    }

    public processGMCP(mod: string, obj) {
        const mods = mod.split('.');
        if (mods.length < 2 || mods[0] !== 'Post') return;
        switch (mods[1]) {
            case 'mail':
                if (!this._list)
                    this._list = [];
                this._list.push.apply(this._list, obj.letters);
                if (obj.last) {
                    //id, cc, to, subject, from, date, read
                    for (const letter in this._list)
                        this.addOrUpdateLetter(letter);
                    this._list = null;
                }
                break;
        }
    }

    /*
    INSERT INTO memos(id,text)
    SELECT 5, 'text to insert'
    WHERE NOT EXISTS(SELECT 1 FROM memos WHERE id = 5 AND text = 'text to insert');
    */

    public addOrUpdateLetter(letter) {
        if (!letter) return;
        /*
INSERT OR REPLACE INTO Employee (id, role, name)
  VALUES (  1,
            'code monkey',
            (SELECT name FROM Employee WHERE id = 1)
          );
        */
        /*
        this._db.run('INSERT OR REPLACE INTO Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ',
            [
                room.ID || room.num,
                room.Area || room.area,
                room.Details || room.details || RoomDetails.None,
                room.Name || room.name,
                room.Env || room.env,
                room.X || room.x || 0,
                room.Y || room.y || 0,
                room.Z || room.z || 0,
                room.Zone || room.zone || 0,
                room.Indoors || room.indoors,
                room.Background || room.background,
                room.Notes || room.notes
            ], (err) => {
                if (err)
                    this.emit('error', err);
                this._changed = true;
            });
        //this._db.run("Delete From Exits WHERE ID = ?", [room.ID || room.num]);
        const stmt = this._db.prepare('INSERT OR REPLACE INTO Exits VALUES (?, ?, ?, ?, ?)');
        let exit;
        for (exit in room.exits) {
            if (!room.exits.hasOwnProperty(exit)) continue;
            stmt.run(room.ID || room.num, exit, room.exits[exit].num, room.exits[exit].isdoor, room.exits[exit].isclosed);
        }
        stmt.finalize();
    */
        this._changed = true;
    }
}