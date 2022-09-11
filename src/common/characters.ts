//spell-checker:ignore pathfinding, vscroll, hscroll, AUTOINCREMENT, Arial, isdoor, isclosed, prevroom, islocked, cmds
//spell-checker:ignore watersource, dirtroad, sanddesert, icesheet, highmountain, pavedroad, rockdesert
import EventEmitter = require('events');
import { parseTemplate } from './library';
const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');

class Character {
    public ID?: number;
    public Title?: string;
    public Host?: string;
    public Address?: string;
    public Port?: number;
    public Type?: string;
    public AutoLoad?: boolean;
    public Disconnect?: boolean;
    public UseAddress?: boolean;
    public Days?: number;
    public Name?: string;
    public Password?: string;
    public Preferences?: string;
    public Map?: string;
    public SessionID?: string;
    public Icon?;
    public IconPath?: string;
    public Notes?: string;
    public TotalMilliseconds?: number;
    public TotalDays?: number;
    public LastConnected?: number;

}

export interface CharactersOptions {
    memory?: boolean;
    memoryPeriod?: number;
    file?: string;
}

export interface getCharacterOptions {
    filter?;
    filterOr?: boolean;
    sort?: string;
    sortDesc?: boolean;
    fields?: string[];
}
export class Characters extends EventEmitter {
    private _db;
    private _changed: boolean = false;
    private _file = '';
    private _memory: boolean;
    private _memorySavePeriod = 900000;
    private _memoryPeriod;
    public ready: boolean = false;

    get isDirty(): boolean { return this._changed; }
    set isDirty(value: boolean) { this._changed = value; }

    set file(value: string) {
        if (value !== this._file) {
            this.save(() => {
                this._db.close();
                this._file = value;
                this.initializeDatabase();
            });
        }
    }
    get file(): string { return this._file; }

    get memory(): boolean { return this._memory; }
    set memory(value: boolean) {
        if (this._memory !== value) {
            this.save(() => {
                this._db.close();
                this._memory = value;
                this.initializeDatabase();
            });
        }
    }

    get memorySavePeriod(): number { return this._memorySavePeriod; }
    set memorySavePeriod(value: number) {
        if (value !== this._memorySavePeriod) {
            clearInterval(this._memoryPeriod);
            if (this._memory)
                this._memoryPeriod = setInterval(this.save, this.memorySavePeriod);
            this._memorySavePeriod = value;
        }
    }

    public createDatabase(prefix?) {
        if (prefix)
            prefix += '.';
        else
            prefix = '';
        try {
            this._db.pragma(prefix + 'synchronous=OFF');
            this._db.pragma(prefix + 'temp_store=MEMORY');
            this._db.pragma(prefix + 'threads=4');
            this._db.exec('CREATE TABLE IF NOT EXISTS ' + prefix + 'Characters (ID INTEGER PRIMARY KEY AUTOINCREMENT, Title TEXT, Host TEXT, Address TEXT, Port INTEGER, Type TEXT, AutoLoad BOOLEAN, Disconnect BOOLEAN, UseAddress BOOLEAN, Days INTEGER, Name TEXT, Password TEXT, Preferences TEXT, Map TEXT, SessionID TEXT, Icon BLOB, IconPath TEXT, Notes TEXT, TotalMilliseconds UNSIGNED BIG INT, TotalDays UNSIGNED BIG INT, LastConnected UNSIGNED BIG INT)');
        }
        catch (err) {
            this.emit('error', err);
        }
    }

    private createIndexes(prefix?) {
        if (prefix)
            prefix += '.';
        else
            prefix = '';
        try {
            this._db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ' + prefix + 'index_id ON Characters (ID);')
                .exec('CREATE INDEX IF NOT EXISTS ' + prefix + 'Title_id ON Characters (Title);')
                .exec('CREATE INDEX IF NOT EXISTS ' + prefix + 'Name_id ON Characters (Name);')
                .exec('CREATE INDEX IF NOT EXISTS ' + prefix + 'Login_id ON Characters (Name, Password);')
                .exec('CREATE INDEX IF NOT EXISTS ' + prefix + 'AutoLoad_id ON Characters (AutoLoad);')

        }
        catch (err) {
            this.emit('error', err);
        }
    }

    public initializeDatabase() {
        this.ready = false;
        try {
            if (!this._file || this._file.length === 0)
                throw new Error('Database file not set.');
            if (this._memory) {
                this._db = new sqlite3(':memory:');
                this._memoryPeriod = setInterval(this.save, this.memorySavePeriod);
            }
            else
                this._db = new sqlite3(this._file);
        }
        catch (err) {
            this.emit('error', err);
        }
        this.createDatabase();
        this.loadIntoMemory();
    }

    private loadIntoMemory() {
        if (!this._memory) {
            this.ready = true;
            return;
        }
        try {
            this._db.exec('ATTACH DATABASE \'' + this._file + '\' as Disk');
            this.createDatabase('Disk');
            this._db.exec('BEGIN TRANSACTION')
                .exec('INSERT OR REPLACE INTO Characters (ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected) SELECT ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected FROM Disk.Characters')
                .exec('COMMIT TRANSACTION')
                .exec('DETACH DATABASE Disk');
        }
        catch (err) {
            this.emit('error', err);
        }
        this.createIndexes();
        this.ready = true;
    }

    constructor(options?: CharactersOptions) {
        super();
        if (options) {
            if ('memoryPeriod' in options)
                this._memorySavePeriod = options.memoryPeriod;
            if ('memory' in options)
                this._memory = options.memory;
            if ('file' in options)
                this._file = options.file;
        }
        this.initializeDatabase();
    }

    public addCharacter(character: Character) {
        this._db.prepare('BEGIN').run();
        try {
            this._db.prepare('INSERT OR REPLACE INTO Characters (Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ').run(
                [
                    character.Title,
                    character.Host,
                    character.Address,
                    character.Port,
                    character.Type,
                    character.AutoLoad ? 1 : 0,
                    character.Disconnect ? 1 : 0,
                    character.UseAddress ? 1 : 0,
                    character.Days,
                    character.Name,
                    character.Password,
                    character.Preferences,
                    character.Map,
                    character.SessionID,
                    character.Icon,
                    character.IconPath,
                    character.Notes,
                    character.TotalMilliseconds,
                    character.TotalDays,
                    character.LastConnected
                ]);

            this._changed = true;
        }
        catch (err) {
            this.emit('error', err);
            this._db.prepare('ROLLBACK').run();
            return;
        }
        this._db.prepare('COMMIT').run();
        this._changed = true;
    }

    public updateCharacter(character: Character) {
        if (!character) return;
        this._db.prepare('BEGIN').run();
        try {
            this._db.prepare(`UPDATE Characters SET ${Object.keys(character).filter(key => key !== 'ID').map(key => `${key} = $${key}`).join(', ')} WHERE ID = $ID`).run(character);
            this._changed = true;
        }
        catch (err) {
            this.emit('error', err);
            this._db.prepare('ROLLBACK').run();
            return;
        }
        this._db.prepare('COMMIT').run();
        this._changed = true;
    }

    public removeCharacter(character: number | Character) {
        if (!character) return;
        if (typeof character === 'number')
            character = this.getCharacter(character);
        this._db.prepare('DELETE FROM Characters WHERE ID = ?').run([character.ID]);
        this.emit('removed', character);
        this._changed = true;
    }

    public getCharacter(id: number): Character {
        if (!id) return null;
        try {
            const rows = this._db.prepare('Select * FROM Characters WHERE ID = $id').all({
                id: id
            });
            if (rows && rows.length)
                return rows[0];
        }
        catch (err) {
            this.emit('error', err);
        }
        return null;
    }

    public getCharactersByName(name: string): Character[] {
        if (!name) return [];
        return this.getCharacters({ filter: { Name: name }, sort: 'Name' });
    }

    public getCharactersByTitle(title: string): Character[] {
        if (!title) return [];
        return this.getCharacters({ filter: { Title: title }, sort: 'Title' });
    }

    public getCharacters(options: getCharacterOptions): Character[] {
        let rows;
        try {
            let sort = '';
            let fields = '*';
            if (options.fields)
                fields = options.fields.join(',');
            if (options.sort)
                sort = ` ORDER BY ${options.sort}${options.sortDesc ? ' DESC' : ' ASC'}`;
            if (options.filter)
                rows = this._db.prepare(`Select ${fields} FROM Characters WHERE ${Object.keys(options.filter).map(key => `${key} = $${key}`).join(options.filterOr ? ' or ' : ' and ')}${sort}`).all(options.filter);
            else
                rows = this._db.prepare(`Select ${fields} FROM Characters${sort}`).all();
        }
        catch (err) {
            this.emit('error', err);
        }
        return rows || [];
    }

    public getAutoLoadingCharacters(): Character[] {
        return this.getCharacters({ filter: { AutoLoad: 1 }, sort: 'Name' });
    }

    public clearAll() {
        try {
            this._db.prepare('DELETE FROM Characters').run();
        }
        catch (err) {
            this.emit('error', err);
        }
        this.emit('clear-done');
        this._changed = true;
    }

    public compact() {
        this.emit('export-progress', 0);
        try {
            this._db.exec('VACUUM;');
        }
        catch (err) {
            this.emit('error', err);
        }
        this.emit('export-progress', 100);
    }

    public executeCommand(cmd: string, callback?) {
        if (!cmd || cmd.length === 0) return;
        try {
            this._db.exec(cmd);
        }
        catch (err) {
            this.emit('error', err);
        }
        if (callback)
            callback();
    }

    public save(callback?) {
        if (!this.ready) {
            setTimeout(() => {
                this.save(callback);
            }, 10);
            return;
        }
        if (this._memory) {
            if (!this._changed) {
                if (callback)
                    callback();
                return;
            }
            try {
                this.ready = false;
                this._db.exec(`
                    ATTACH DATABASE '${this._file}' as Disk;
                    PRAGMA Disk.synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA threads = 4;
                    PRAGMA Disk.journal_mode=OFF;
                    PRAGMA Main.journal_mode=OFF;
                    CREATE TABLE IF NOT EXISTS Disk.Characters (ID INTEGER PRIMARY KEY AUTOINCREMENT, Title TEXT, Host TEXT, Address TEXT, Port INTEGER, Type TEXT, AutoLoad BOOLEAN, Disconnect BOOLEAN, UseAddress BOOLEAN, Days INTEGER, Name TEXT, Password TEXT, Preferences TEXT, Map TEXT, SessionID TEXT, Icon BLOB, IconPath TEXT, Notes TEXT, TotalMilliseconds UNSIGNED BIG INT, TotalDays UNSIGNED BIG INT, LastConnected UNSIGNED BIG INT);
                    BEGIN TRANSACTION;
                    DELETE FROM Disk.Characters;
                    INSERT INTO Disk.Characters (ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected) SELECT ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected FROM Characters;
                    COMMIT TRANSACTION;
                    CREATE UNIQUE INDEX IF NOT EXISTS Disk.index_id ON Characters (ID);
                    CREATE INDEX IF NOT EXISTS Disk.Title_id ON Characters (Title);
                    CREATE INDEX IF NOT EXISTS Disk.Name_id ON Characters (Name);
                    CREATE INDEX IF NOT EXISTS Disk.Login_id ON Characters (Name, Password);
                    VACUUM Disk;
                    DETACH DATABASE Disk
                `);
                this.ready = true;
                if (callback) callback();
                this._changed = false;
            }
            catch (err) {
                this.emit('error', err);
            }
        }
        else if (callback)
            callback();
    }

}