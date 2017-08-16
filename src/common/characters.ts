import EventEmitter = require('events');
import { parseTemplate } from './library';
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

export class Characters extends EventEmitter {
    private _db;

    constructor() {
        super();
        this._db = new sqlite3.Database(path.join(parseTemplate('{data}'), 'characters.sqlite'));
        this.createDatabase();
    }

    public createDatabase(prefix?) {
        if (prefix)
            prefix += '.';
        else
            prefix = '';
        this._db.serialize(() => {
            //this._db.run("PRAGMA synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA journal_mode = TRUNCATE;PRAGMA optimize;PRAGMA read_uncommitted = 1;PRAGMA threads = 4;");
            this._db.run('PRAGMA ' + prefix + 'synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA threads = 4;');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'Characters (ID INTEGER PRIMARY KEY AUTOINCREMENT, Title TEXT, Host TEXT, Address TEXT, Port INTEGER, Type TEXT, AutoLoad BOOLEAN, UseAddress BOOLEAN, Days INTEGER, Name TEXT, Password TEXT, Preferences TEXT, Map TEXT, SessionID TEXT, Icon BLOB, IconPath TEXT, Notes TEXT, TotalMilliseconds UNSIGNED BIG INT, TotalDays UNSIGNED BIG INT, LastConnected DATE');
            this._db.run('CREATE UNIQUE INDEX IF NOT EXISTS ' + prefix + 'index_id on Characters (ID);');
        });
    }

    public getAutoloading(callback) {
        this._db.all('Select * FROM Characters WHERE Characters.AutoLoad = 1', (err, rows) => {
            if (err)
                throw new Error(err);
            if (callback)
                callback(rows);
        });
    }

    public add(char) {
        if (!char) return;
        this._db.run('INSERT INTO Characters (Title,  Host, Address, Port, Type, AutoLoad, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ',
            this.characterArray(char), (err) => {
                if (err)
                    this.emit('error', err);
            });
    }

    public clear() {
        this._db.run('DELETE FROM Characters', (err) => {
            if (err) this.emit('error', err);
        });
    }

    public removeByName(name) {
        if (!name) return;
        this._db.run('DELETE FROM Characters WHERE Name = ?', [name], (err) => {
            if (err) this.emit('error', err);
        });
    }

    public removeByID(id) {
        if (!id || id < 0) return;
        this._db.run('DELETE FROM Characters WHERE ID = ?', [id], (err) => {
            if (err) this.emit('error', err);
        });
    }

    public getAll(callback) {
        this._db.all('Select * FROM Characters', (err, rows) => {
            if (err)
                this.emit('error', err);
            else if (callback)
                callback(rows);
        });
    }

    public get(char, callback) {
        if (!char) return;
        if (typeof char === 'number')
            this._db.all('Select * FROM Characters WHERE ID = $char', { $char: char }, (err, rows) => {
                if (err)
                    this.emit('error', err);
                else if (callback)
                    callback(rows);
            });
        else if (Array.isArray(char)) {
            let p = '';
            if (char.length > 1)
                p = '?, '.repeat(char.length - 1);
            p += '?';
            this._db.all(`Select * FROM Characters WHERE Name in (${p})`, char, (err, rows) => {
                if (err)
                    this.emit('error', err);
                else if (callback)
                    callback(rows);
            });
        }
        else
            this._db.all('Select * FROM Characters WHERE Name = $char', { $char: char }, (err, rows) => {
                if (err)
                    this.emit('error', err);
                else if (callback)
                    callback(rows);
            });
    }

    public getByHost(host, callback) {
        this._db.all('Select * FROM Characters WHERE Host = $host', { $host: host }, (err, rows) => {
            if (err)
                this.emit('error', err);
            else if (callback)
                callback(rows);
        });
    }

    public update(char) {
        if (!char) return;
        if (!char.ID) {
            this.emit('error', 'Invalid character ID');
            return;
        }
        this._db.run('Update Characters SET Title = ?,  Host = ?, Address = ?, Port = ?, Type = ?, AutoLoad = ?, UseAddress = ?, Days = ?, Name = ?, Password = ?, Preferences = ?, Map = ?, SessionID = ?, Icon = ?, IconPath = ?, Notes = ?, TotalMilliseconds = ?, TotalDays = ?, LastConnected = ? WHERE ID = ?',
            this.characterArray(char, 1), (err) => {
                if (err)
                    this.emit('error', err);
            });
    }

    private characterArray(char, id?) {
        const data = [
            char.Title || char.title || '',
            char.Host || char.host || '',
            char.Address || char.address,
            char.Port || char.port || 23,
            char.Type || char.type || '',
            char.AutoLoad || char.auto || char.autoload || char.load || 0,
            char.UseAddress || char.useaddress || char.address || 0,
            char.Days || char.days || 0,
            char.Name || char.name || '',
            char.Password || char.password || char.pass || '',
            char.Preferences || char.preferences || char.settings || path.join(parseTemplate('{data}'), 'settings.sqlite'),
            char.Map || char.map || path.join(parseTemplate('{data}'), 'map.sqlite'),
            char.SessionID || char.sessionid || char.session || '',
            char.Icon || char.icon,
            char.IconPath || char.iconpath || '',
            char.Notes || char.notes || '',
            char.TotalMilliseconds || char.ms || char.milliseconds || 0,
            char.TotalDays || char.totaldays || 0,
            char.LastConnected || char.connected || char.last || Date.now()
        ];
        if (id === 1)
            data.push(char.ID || char.id);
        else if (id === 2)
            data.unshift(char.ID || char.id);
        return data;
    }

    public close() {
        this._db.close();
    }
}