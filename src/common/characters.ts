//spell-checker:ignore pathfinding, vscroll, hscroll, AUTOINCREMENT, Arial, isdoor, isclosed, prevroom, islocked, cmds
//spell-checker:ignore watersource, dirtroad, sanddesert, icesheet, highmountain, pavedroad, rockdesert
import { EventEmitter } from 'events';
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
    public AutoLoad?: boolean | number;
    public Disconnect?: boolean | number;
    public UseAddress?: boolean | number;
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
    public LastDisconnected?: number;

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
            this._db.exec('CREATE TABLE IF NOT EXISTS ' + prefix + 'Characters (ID INTEGER PRIMARY KEY AUTOINCREMENT, Title TEXT, Host TEXT, Address TEXT, Port INTEGER, Type TEXT, AutoLoad BOOLEAN, Disconnect BOOLEAN, UseAddress BOOLEAN, Days INTEGER, Name TEXT, Password TEXT, Preferences TEXT, Map TEXT, SessionID TEXT, Icon BLOB, IconPath TEXT, Notes TEXT, TotalMilliseconds UNSIGNED BIG INT, TotalDays UNSIGNED BIG INT, LastConnected UNSIGNED BIG INT, LastDisconnected UNSIGNED BIG INT)');
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
                .exec('INSERT OR REPLACE INTO Characters (ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected, LastDisconnected) SELECT ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected, LastDisconnected FROM Disk.Characters')
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
        if (!character || Object.keys(character).length === 0)
            return;
        this._db.prepare('BEGIN').run();
        let info;
        character = this.sanitizeCharacterIn(character);
        try {
            info = this._db.prepare(`INSERT OR REPLACE INTO Characters (${Object.keys(character).join(', ')}) VALUES (${Object.keys(character).map(key => `$${key}`).join(', ')}) `).run(character);

            this._changed = true;
        }
        catch (err) {
            this.emit('error', err);
            this._db.prepare('ROLLBACK').run();
            return 0;
        }
        this._db.prepare('COMMIT').run();
        this._changed = true;
        return info ? info.lastInsertRowid : 0;
    }

    public updateCharacter(character: Character) {
        if (!character) return;
        character = this.sanitizeCharacterIn(character);
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
        this._db.prepare('DELETE FROM Characters WHERE ID = ?').run([typeof character === 'number' ? character : character.ID]);
        this.emit('removed', character);
        this._changed = true;
    }

    public getNextId() {
        try {
            const rows = this._db.prepare('Select seq FROM sqlite_sequence WHERE name = \'Characters\'').all();
            if (rows && rows.length)
                return (rows[0].seq + 1) || 1;
        }
        catch (err) {
            this.emit('error', err);
        }
        return 1;
    }

    public getCharacter(id: number): Character {
        if (!id) return null;
        try {
            const rows = this._db.prepare('Select * FROM Characters WHERE ID = $id').all({ id: id });
            if (rows && rows.length)
                return this.sanitizeCharacterOut(rows[0]);
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
        if (rows)
            return rows.map(row => this.sanitizeCharacterOut(row));
        return [];
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
                    CREATE TABLE IF NOT EXISTS Disk.Characters (ID INTEGER PRIMARY KEY AUTOINCREMENT, Title TEXT, Host TEXT, Address TEXT, Port INTEGER, Type TEXT, AutoLoad BOOLEAN, Disconnect BOOLEAN, UseAddress BOOLEAN, Days INTEGER, Name TEXT, Password TEXT, Preferences TEXT, Map TEXT, SessionID TEXT, Icon BLOB, IconPath TEXT, Notes TEXT, TotalMilliseconds UNSIGNED BIG INT, TotalDays UNSIGNED BIG INT, LastConnected UNSIGNED BIG INT, LastDisconnected UNSIGNED BIG INT);
                    BEGIN TRANSACTION;
                    DELETE FROM Disk.Characters;
                    INSERT INTO Disk.Characters (ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected, LastDisconnected) SELECT ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected, LastDisconnected FROM Characters;
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

    private sanitizeCharacterIn(character) {
        if (!character) return character;
        //datatype checks as sqlite does not allow boolean type
        if ('AutoLoad' in character)
            character.AutoLoad = character.AutoLoad ? 1 : 0;
        if ('Disconnect' in character)
            character.Disconnect = character.Disconnect ? 1 : 0;
        if ('UseAddress' in character)
            character.UseAddress = character.UseAddress ? 1 : 0;
        return character;
    }

    private sanitizeCharacterOut(character) {
        if (!character) return character;
        //datatype checks as sqlite does not allow boolean type
        if ('AutoLoad' in character)
            character.AutoLoad = character.AutoLoad ? true : false;
        if ('Disconnect' in character)
            character.Disconnect = character.Disconnect ? true : false;
        if ('UseAddress' in character)
            character.UseAddress = character.UseAddress ? true : false;
        return character;
    }

    public import(file, backup, replaceOld) {
        if (path.extname(file) === '.json') {
            let oldCharacters = fs.readFileSync(file, 'utf-8');
            try {
                //data try and convert and then import any found data
                if (oldCharacters && oldCharacters.length > 0) {
                    oldCharacters = JSON.parse(oldCharacters);
                    for (const title in oldCharacters.characters) {
                        if (!Object.prototype.hasOwnProperty.call(oldCharacters.characters, title))
                            continue;
                        const character = oldCharacters.characters[title];
                        this.addCharacter({
                            Title: title,
                            Host: 'www.shadowmud.com',
                            Port: character.dev ? 1035 : 1030,
                            AutoLoad: oldCharacters.load === title,
                            Disconnect: character.disconnect,
                            UseAddress: false,
                            Days: 0,
                            Name: character.name || (title || '').replace(/[^a-zA-Z0-9]+/g, ''),
                            Password: character.password,
                            Preferences: character.settings,
                            Map: character.map,
                            Notes: path.join('{characters}', `${title}.notes`),
                            TotalMilliseconds: 0,
                            TotalDays: 0,
                            LastConnected: 0,
                            LastDisconnected: 0
                        });
                    }
                    oldCharacters = null;
                    this.save();
                }
                // Rename the file old file as no longer needed just in case
                if (backup)
                    fs.rename(file, backup + '.bak', (err) => {
                        this.emit('error', err);
                    });
            }
            catch (e) {
                this.emit('error', e);
            }
        }
        else {
            try {
                this.ready = false;
                if (replaceOld)
                    this._db.exec(`
                        ATTACH DATABASE '${file}' as Disk;
                        PRAGMA Disk.synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA threads = 4;
                        PRAGMA Disk.journal_mode=OFF;
                        BEGIN TRANSACTION;
                        INSERT INTO Characters (ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected, LastDisconnected) SELECT ID, Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected, LastDisconnected FROM Disk.Characters;
                        COMMIT TRANSACTION;
                        DETACH DATABASE Disk
                    `);
                else
                    this._db.exec(`
                        ATTACH DATABASE '${file}' as Disk;
                        PRAGMA Disk.synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA threads = 4;
                        PRAGMA Disk.journal_mode=OFF;
                        BEGIN TRANSACTION;
                        INSERT INTO Characters (Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected, LastDisconnected) SELECT Title, Host, Address, Port, Type, AutoLoad, Disconnect, UseAddress, Days, Name, Password, Preferences, Map, SessionID, Icon, IconPath, Notes, TotalMilliseconds, TotalDays, LastConnected, LastDisconnected FROM Disk.Characters;
                        COMMIT TRANSACTION;
                        DETACH DATABASE Disk
                    `);
                this.ready = true;
                this.save();
            }
            catch (err) {
                this.emit('error', err);
            }
        }
    }
}