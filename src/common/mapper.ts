//cSpell:ignore pathfinding, vscroll, hscroll, AUTOINCREMENT, Arial, isdoor, isclosed, prevroom, islocked, cmds
//cSpell:ignore watersource, dirtroad, sanddesert, icesheet, highmountain, pavedroad, rockdesert
import EventEmitter = require('events');
import { Size } from './types';
import { parseTemplate, clone } from './library';
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const PF = require('./../../lib/pathfinding.js');

export enum RoomDetails {
    None = 0,
    Dock = 1,
    Pier = 2,
    Bank = 4,
    Shop = 8,
    Hospital = 16,
    Bar = 32,
    Restaurant = 64,
    WaterSource = 128,
    Trainer = 256,
    Stable = 512
}

export enum RoomExits {
    northwest = 1,
    north = 128,
    northeast = 64,
    west = 2,
    east = 32,
    southwest = 4,
    south = 8,
    southeast = 16,
    up = 512,
    down = 256
}

export enum ImportType {
    Merge = 0,
    Replace = 1
}

class Rectangle {

    public location: Point;
    public size: Size;

    get top() {
        if (!this.location) return 0;
        return this.location.y;
    }

    get left() {
        if (!this.location) return 0;
        return this.location.x;
    }

    get right() {
        if (!this.location || !this.size) return 0;
        return this.location.x + this.size.width;
    }

    get bottom() {
        if (!this.location || !this.size) return 0;
        return this.location.y + this.size.height;

    }

    constructor(x: number, y: number, width: number, height: number) {
        this.location = new Point(x, y);
        this.size = new Size(width, height);
    }

}

class Point {
    public x: number = 0;
    public y: number = 0;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

class Room {
    public ID = null;
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;
    public area = null;
    public zone: number = 0;
}

interface MouseData {
    x: number;
    y: number;
    button: number;
    state: boolean;
}

export class Mapper extends EventEmitter {
    private _canvas;
    private _context;
    private _redraw: boolean = false;
    private _db;
    private _changed: boolean = false;
    private MousePrev: MouseData;
    private Mouse: MouseData;
    private MouseDown: MouseData;
    private MouseDrag: MouseData = { x: 0, y: 0, button: 0, state: false };
    private drag: boolean = false;
    private vscroll: number = 0;
    private hscroll: number = 0;
    private markers = {};
    private _cancelImport: boolean = false;
    private _mapFile = path.join(parseTemplate('{data}'), 'map.sqlite');

    public current: Room;
    public active: Room;
    public selected: Room;
    public _showLegend: boolean = false;
    public _splitArea: boolean = false;
    public _fillWalls: boolean = false;
    public _enabled: boolean = true;
    public _follow: boolean = true;
    public _memory: boolean = false;
    public commandDelay: number = 500;
    public commandDelayCount: number = 5;
    public _memorySavePeriod = 900000;
    public _memoryPeriod;

    set enabled(value: boolean) {
        if (this._enabled !== value) {
            this._enabled = value;
            this.emit('setting-changed', 'enabled', value);
        }
    }
    get enabled(): boolean { return this._enabled; }

    get isDirty(): boolean { return this._changed; }
    set isDirty(value: boolean) { this._changed = value; }

    set mapFile(value: string) {
        if (value !== this._mapFile) {
            this.save(() => {
                this._db.close(() => {
                    this._mapFile = value;
                    if (this._memory) {
                        this._db = new sqlite3.Database(':memory:');
                        this._memoryPeriod = setInterval(this.save, this.memorySavePeriod);
                    }
                    else
                        this._db = new sqlite3.Database(this._mapFile);
                    this.createDatabase();
                    this._db.serialize();
                    if (this._memory) {
                        this._db.run('ATTACH DATABASE \'' + this._mapFile + '\' as Disk');
                        this.createDatabase('Disk');
                        this._db.run('INSERT INTO main.Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes) SELECT ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes FROM Disk.Rooms');
                        this._db.run('INSERT INTO main.Exits (ID, Exit, DestID, IsDoor, IsClosed) SELECT ID, Exit, DestID, IsDoor, IsClosed FROM Disk.Exits');
                        this._db.run('DETACH DATABASE Disk');
                    }
                });
            });
        }
    }
    get mapFile(): string { return this._mapFile; }

    get memory(): boolean { return this._memory; }
    set memory(value: boolean) {
        if (this._memory !== value) {
            this.save(() => {
                this._db.close(() => {
                    this._memory = value;
                    if (this._memory) {
                        this._db = new sqlite3.Database(':memory:');
                        this._memoryPeriod = setInterval(this.save, this.memorySavePeriod);
                    }
                    else
                        this._db = new sqlite3.Database(this._mapFile);
                    this.createDatabase();
                    this._db.serialize();
                    if (this._memory) {
                        this._db.run('ATTACH DATABASE \'' + this._mapFile + '\' as Disk');
                        this.createDatabase('Disk');
                        this._db.run('INSERT INTO main.Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes) SELECT ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes FROM Disk.Rooms');
                        this._db.run('INSERT INTO main.Exits (ID, Exit, DestID, IsDoor, IsClosed) SELECT ID, Exit, DestID, IsDoor, IsClosed FROM Disk.Exits');
                        this._db.run('DETACH DATABASE Disk');
                    }
                });
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

    set follow(value: boolean) {
        if (this._follow !== value) {
            this._follow = value;
            this.emit('setting-changed', 'follow', value);
        }
    }
    get follow(): boolean { return this._follow; }

    set showLegend(value: boolean) {
        if (this._showLegend !== value) {
            this._showLegend = value;
            this.draw();
            this.emit('setting-changed', 'legend', value);
        }
    }
    get showLegend(): boolean { return this._showLegend; }

    set splitArea(value: boolean) {
        if (this._splitArea !== value) {
            this._splitArea = value;
            this.draw();
            this.emit('setting-changed', 'split', value);
        }
    }

    get splitArea(): boolean { return this._splitArea; }

    set fillWalls(value: boolean) {
        if (this._fillWalls !== value) {
            this._fillWalls = value;
            this.draw();
            this.emit('setting-changed', 'fill', value);
        }
    }

    get fillWalls(): boolean { return this._fillWalls; }

    public createDatabase(prefix?) {
        if (prefix)
            prefix += '.';
        else
            prefix = '';
        this._db.serialize(() => {
            //this._db.run("PRAGMA synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA journal_mode = TRUNCATE;PRAGMA optimize;PRAGMA read_uncommitted = 1;PRAGMA threads = 4;");
            this._db.run('PRAGMA ' + prefix + 'synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA threads = 4;');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'Rooms (ID TEXT PRIMARY KEY ASC, Area TEXT, Details INTEGER, Name TEXT, Env TEXT, X INTEGER, Y INTEGER, Z INTEGER, Zone INTEGER, Indoors INTEGER, Background TEXT, Notes TEXT)');
            this._db.run('CREATE TABLE IF NOT EXISTS ' + prefix + 'Exits (ID TEXT, Exit TEXT, DestID TEXT, IsDoor INTEGER, IsClosed INTEGER)');
            this._db.run('CREATE UNIQUE INDEX IF NOT EXISTS ' + prefix + 'index_id on Rooms (ID);');
            this._db.run('CREATE INDEX IF NOT EXISTS ' + prefix + 'exits_id on Exits (ID);');
            //this._db.run("CREATE TABLE IF NOT EXISTS Areas (ID INTEGER PRIMARY KEY AUTOINCREMENT, Area TEXT)");
        });
    }

    constructor(canvas, memory?: boolean, memoryPeriod?: (number | string), map?: string) {
        super();
        if (typeof memoryPeriod === 'string') {
            if (memoryPeriod.length > 0)
                this._mapFile = memoryPeriod;
        }
        else {
            this._memorySavePeriod = memoryPeriod;
            if (map && map.length > 0)
                this._mapFile = map;
        }
        this._canvas = canvas;
        this._context = canvas.getContext('2d');
        //rooms - ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors
        //exits - ID, Exit, DestID
        if (memory) {
            this._memory = memory;
            this._db = new sqlite3.Database(':memory:');
            this._memoryPeriod = setInterval(this.save, this.memorySavePeriod);
        }
        else
            this._db = new sqlite3.Database(this._mapFile);
        this.createDatabase();
        this._db.serialize();
        if (this._memory) {
            this._db.run('ATTACH DATABASE \'' + this._mapFile + '\' as Disk');
            this.createDatabase('Disk');
            this._db.run('INSERT INTO main.Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes) SELECT ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes FROM Disk.Rooms');
            this._db.run('INSERT INTO main.Exits (ID, Exit, DestID, IsDoor, IsClosed) SELECT ID, Exit, DestID, IsDoor, IsClosed FROM Disk.Exits');
            this._db.run('DETACH DATABASE Disk');
        }

        $(this._canvas).mousemove((event) => {
            this.MousePrev = this.Mouse;
            this.Mouse = this.getMapMousePos(event);
            if (this.drag) {
                this.MouseDrag.x += this.MousePrev.x - this.Mouse.x;
                this.MouseDrag.y += this.MousePrev.y - this.Mouse.y;
                const x = Math.floor(this.MouseDrag.x / 32);
                const y = Math.floor(this.MouseDrag.y / 32);
                if (x > 0 || x < 0 || y < 0 || y > 0) {
                    this.MouseDrag.x -= x * 32;
                    this.MouseDrag.y -= y * 32;
                    this.scrollBy(x, y);
                }
            }
            event.preventDefault();
        });
        $(this._canvas).mousedown((event) => {
            this.Mouse = this.getMapMousePos(event);
            this.MouseDown = this.getMapMousePos(event);
            this.MouseDrag.state = true;
            this.drag = this.MouseDown.button === 0;
            if (this.drag)
                $(this._canvas).css('cursor', 'move');
        });

        $(this._canvas).mouseup((event) => {
            this.Mouse = this.getMapMousePos(event);
            if (!this.MouseDown)
                this.MouseDown = this.getMapMousePos(event);
            if (this.Mouse.button === 0 && Math.floor(this.Mouse.x / 32) === Math.floor(this.MouseDown.x / 32) && Math.floor(this.Mouse.y / 32) === Math.floor(this.MouseDown.y / 32)) {
                const x = this.Mouse.x;
                const y = this.Mouse.y;
                this.findActiveRoomByCoords(x, y, (room) => {
                    if (this.selected && room && room.ID === this.selected.ID)
                        return;
                    this.emit('room-before-selected', clone(this.selected));
                    this.selected = room;
                    this.emit('room-selected', clone(room));
                    if (!this._redraw)
                        this.draw();
                });
            }
            this.MouseDrag.state = false;
            this.drag = false;
            $(this._canvas).css('cursor', 'default');
        });
        $(this._canvas).mouseenter((event) => {
            this.Mouse = this.getMapMousePos(event);
        });
        $(this._canvas).mouseleave((event) => {
            this.Mouse = this.getMapMousePos(event);
            if (this.drag) {
                if (!this._redraw)
                    this.draw();
                this.drag = false;
                $(this._canvas).css('cursor', 'default');
            }
        });
        $(this._canvas).bind('contextmenu', (event) => {
            event.preventDefault();
            const m = this.getMapMousePos(event);
            this.findActiveRoomByCoords(m.x, m.y, (room) => {
                this.emit('context-menu', clone(room));
            });
            return false;
        });
        $(this._canvas).click((event) => {
            event.preventDefault();
        });
        $(this._canvas).dblclick((event) => {
            event.preventDefault();
        });
        this._canvas.onselectstart = () => { return false; };
        this.reset();
        this.refresh();
    }

    public getMapMousePos(evt): MouseData {
        const rect = this._canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top,
            button: evt.button,
            state: false
        };
    }

    public scrollBy(x: number, y: number) {
        this.vscroll += x;
        this.hscroll += y;
        this.draw();
        this.emit('setting-changed', 'vscroll', this.vscroll);
        this.emit('setting-changed', 'hscroll', this.hscroll);
    }

    public scrollTo(x: number, y: number) {
        this.vscroll = x;
        this.hscroll = y;
        this.draw();
        this.emit('setting-changed', 'vscroll', this.vscroll);
        this.emit('setting-changed', 'hscroll', this.hscroll);
    }

    public findActiveRoomByCoords(rx: number, ry: number, callback) {
        let x = this.vscroll - (this._canvas.width / 32 / 2);
        let y = this.hscroll - (this._canvas.height / 32 / 2);
        const z = this.active.z;
        const area = this.active.area;
        const zone = this.active.zone;
        let ox = 15.5;
        let oy = 15.5;
        if (this._canvas.width % 2 !== 0)
            ox = 15;
        if (this._canvas.height % 2 !== 0)
            oy = 15;

        x += (rx - ox) / 32;
        y += (ry - oy) / 32;
        x = Math.floor(x);
        y = Math.floor(y);
        if (this._splitArea)
            this._db.all('Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID WHERE Area = $area AND Zone = $zone AND X = $x AND Y = $y AND Z = $z', {
                $area: area,
                $zone: zone,
                $x: x,
                $y: y,
                $z: z
            }, (err, rows) => {
                if (callback) {
                    if (rows && rows.length > 0)
                        callback({ ID: rows[0].ID, x: rows[0].X, y: rows[0].Y, z: rows[0].Z, area: rows[0].Area, zone: rows[0].Zone, background: rows[0].Background, env: rows[0].Env, indoors: rows[0].Indoor, name: rows[0].Name, details: rows[0].Details, notes: rows[0].Notes });
                    else
                        callback(new Room());
                }
            });
        else
            this._db.all('Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID WHERE Zone = $zone AND X = $x AND Y = $y AND Z = $z', {
                $zone: zone,
                $x: x,
                $y: y,
                $z: z
            }, (err, rows) => {
                if (callback) {
                    if (rows && rows.length > 0)
                        callback({ ID: rows[0].ID, x: rows[0].X, y: rows[0].Y, z: rows[0].Z, area: rows[0].Area, zone: rows[0].Zone, background: rows[0].Background, env: rows[0].Env, indoors: rows[0].Indoors, name: rows[0].Name, details: rows[0].Details, notes: rows[0].Notes });
                    else
                        callback(new Room());
                }
            });

    }

    public draw(canvas?, context?, ex?: boolean, callback?) {
        if (!canvas)
            canvas = this._canvas;
        if (!context)
            context = this._context;
        if (!ex) ex = false;
        //cant get map canvas bail
        if (!canvas || !context) return;

        this._redraw = true;
        const x = this.vscroll - (canvas.width / 32 / 2);
        const y = this.hscroll - (canvas.height / 32 / 2);
        const z = this.active.z || 0;
        const area = this.active.area || '';
        const zone = this.active.zone || 0;
        let ox = 15.5;
        let oy = 15.5;

        const bx = 0;
        const by = 0;
        const br = canvas.width; // + bounds.w * (100 / 1.5);
        const bb = canvas.height; // + bounds.h * (100 / 1.5);

        if (canvas.width % 2 !== 0)
            ox = 15;
        if (canvas.height % 2 !== 0)
            oy = 15;
        context.font = '8pt Arial';
        //this._db.serialize(() => {
        if (this._splitArea) {
            this._db.all('Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID WHERE Z = $z AND Area = $area AND Zone = $zone AND ((0 <= ((X - $x) * 32 + $ox) AND ((X - $x) * 32 + $ox) <= $w) AND (0 <= ((Y - $y) * 32 + $oy) AND ((Y - $y) * 32 + $oy) <= $h) OR (0 <= ((X - $x) * 32 + $ox) AND ((X - $x) * 32 + $ox) <= $w) AND (0 <= ((Y - $y) * 32 + $oy + 32) AND ((Y - $y) * 32 + $oy + 32) <= $h) OR (0 <= ((X - $x) * 32 + $ox + 32) AND ((X - $x) * 32 + $ox + 32) <= $w) AND (0 <= ((Y - $y) * 32 + $oy + 32) AND ((Y - $y) * 32 + $oy + 32) <= $h) OR (0 <= ((X - $x) * 32 + $ox + 32) AND ((X - $x) * 32 + $ox + 32) <= $w) AND (0 <= ((Y - $y) * 32 + $oy) AND ((Y - $y) * 32 + $oy) <= $h))', {
                $area: area,
                $zone: zone,
                $x: x,
                $y: y,
                $z: z,
                $ox: ox,
                $oy: oy,
                $w: canvas.width,
                $h: canvas.height
            }, (err, rows) => {
                context.save();
                if (ex) {
                    context.fillStyle = '#eae4d6';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                }
                else
                    context.clearRect(0, 0, canvas.width, canvas.height);
                const rooms = {};
                if (rows) {
                    const rl = rows.length;
                    for (let r = 0; r < rl; r++) {
                        if (rooms[rows[r].ID]) {
                            rooms[rows[r].ID].exits[rows[r].Exit] = {
                                num: rows[r].DestID,
                                isdoor: rows[r].IsDoor,
                                isclosed: rows[r].IsClosed
                            };
                        }
                        else {
                            rooms[rows[r].ID] = clone(rows[r]);
                            rooms[rows[r].ID].exits = {};
                            rooms[rows[r].ID].exits[rows[r].Exit] = {
                                num: rows[r].DestID,
                                isdoor: rows[r].IsDoor,
                                isclosed: rows[r].IsClosed
                            };
                        }
                    }
                    let rm;
                    for (rm in rooms) {
                        if (!rooms.hasOwnProperty(rm)) continue;
                        const room = rooms[rm];
                        this.DrawRoom(context, (room.X - x) * 32 + ox, (room.Y - y) * 32 + oy, room, false);
                    }
                }
                context.restore();
                this.DrawLegend(context, 1, -4, 0);
                this._redraw = false;
                if (callback) callback();
            });
        }
        else {
            this._db.all('Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID WHERE Z = $z AND Zone = $zone AND ((0 <= ((X - $x) * 32 + $ox) AND ((X - $x) * 32 + $ox) <= $w) AND (0 <= ((Y - $y) * 32 + $oy) AND ((Y - $y) * 32 + $oy) <= $h) OR (0 <= ((X - $x) * 32 + $ox) AND ((X - $x) * 32 + $ox) <= $w) AND (0 <= ((Y - $y) * 32 + $oy + 32) AND ((Y - $y) * 32 + $oy + 32) <= $h) OR (0 <= ((X - $x) * 32 + $ox + 32) AND ((X - $x) * 32 + $ox + 32) <= $w) AND (0 <= ((Y - $y) * 32 + $oy + 32) AND ((Y - $y) * 32 + $oy + 32) <= $h) OR (0 <= ((X - $x) * 32 + $ox + 32) AND ((X - $x) * 32 + $ox + 32) <= $w) AND (0 <= ((Y - $y) * 32 + $oy) AND ((Y - $y) * 32 + $oy) <= $h))', {
                $zone: zone,
                $x: x,
                $y: y,
                $z: z,
                $ox: ox,
                $oy: oy,
                $w: canvas.width,
                $h: canvas.height
            }, (err, rows) => {
                context.save();
                if (ex) {
                    context.fillStyle = '#eae4d6';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                }
                else
                    context.clearRect(0, 0, canvas.width, canvas.height);
                const rooms = {};
                if (rows) {
                    const rl = rows.length;
                    for (let r = 0; r < rl; r++) {
                        if (rooms[rows[r].ID]) {
                            rooms[rows[r].ID].exits[rows[r].Exit] = {
                                num: rows[r].DestID,
                                isdoor: rows[r].IsDoor,
                                isclosed: rows[r].IsClosed
                            };
                        }
                        else {
                            rooms[rows[r].ID] = clone(rows[r]);
                            rooms[rows[r].ID].exits = {};
                            rooms[rows[r].ID].exits[rows[r].Exit] = {
                                num: rows[r].DestID,
                                isdoor: rows[r].IsDoor,
                                isclosed: rows[r].IsClosed
                            };
                        }
                    }
                    let rm;
                    for (rm in rooms) {
                        if (!rooms.hasOwnProperty(rm)) continue;
                        const room = rooms[rm];
                        this.DrawRoom(context, (room.X - x) * 32 + ox, (room.Y - y) * 32 + oy, room, ex);
                    }
                }
                context.restore();
                this.DrawLegend(context, 1, -4, 0);
                this._redraw = false;
                if (callback) callback();
            });
        }
    }

    public reset(type?) {
        if (!type || type === 1) {
            this.current = new Room();
            this.emit('current-room-changed', this.current);
        }
        if (!type) {
            this.setActive(new Room());
            this.selected = new Room();
        }
    }

    public refresh() {
        if (!this._redraw)
            this.draw();
        this.emit('refresh');
    }

    public focusCurrentRoom() {
        if (this.current.ID) {
            this.setActive(clone(this.current));
            this.emit('active-room-changed', clone(this.active));
        }
        this.focusActiveRoom();
    }

    public focusActiveRoom() {
        this.scrollTo(this.active.x + 2, this.active.y + 2);
    }

    public setActive(room) {
        this.active = room;
        this.emit('active-room-changed', clone(this.active));
    }

    public setCurrent(room?: Room) {
        this.emit('path-cleared');
        if (!room || !room.ID) room = this.selected;
        this.current = this.sanitizeRoom(clone(room));
        this.markers = {};
        this.draw();
        this.emit('current-room-changed', this.current);
    }

    public setArea(area: string) {
        this.active.area = area;
        if (this.current.ID !== null && this.current.area === this.active.area) {
            this.setActive(this.sanitizeRoom(clone(this.current)));
            this.focusActiveRoom();
            this.emit('setting-changed', 'active', this.active);
        }
        else {
            this._db.get('SELECT * from Rooms WHERE Area = ? ORDER BY X, Y, Z', [area], (err, row) => {
                if (row) {
                    this.active.ID = row.ID;
                    this.active.x = row.X;
                    this.active.y = row.Y;
                    this.active.z = row.Z;
                    this.active.zone = row.Zone;
                    this.setActive(this.sanitizeRoom(this.active));
                    this.focusActiveRoom();
                    this.emit('setting-changed', 'active', this.active);
                }
            });
        }
    }

    public setLevel(level: number) {
        if (level !== this.active.z) {
            this.active.z = level;
            this.draw();
            this.emit('setting-changed', 'active', this.active);
        }
    }

    public setZone(zone: number) {
        if (zone !== this.active.zone) {
            this.active.zone = zone;
            this.draw();
            this.emit('setting-changed', 'active', this.active);
        }
    }

    public removeRoom(room) {
        this._db.run('DELETE FROM Rooms WHERE ID = ?', [room.ID], () => {
            this._db.run('Delete From Exits WHERE ID = ?', [room.ID], () => {
                this.emit('remove-done', room);
                if (room.ID === this.current.ID) {
                    this.current = new Room();
                    this.emit('current-room-changed', this.current);
                    this.clearPath();
                }
                else if (this.markers[room.ID])
                    this.clearPath();
                if (room.ID === this.active.ID)
                    this.setActive(new Room());
                if (room.ID === this.selected.ID)
                    this.selected = new Room();
                this.refresh();
                this._changed = true;
            });
        });

    }

    public clearSelectedRoom() {
        this.removeRoom(this.selected);
    }

    public clearRoom() {
        this.removeRoom(this.current);
    }

    public clearArea() {
        this._db.run('DELETE FROM Exits WHERE ID in (Select ID from Rooms WHERE Area = ?)', [this.active.area], () => {
            this._db.run('DELETE FROM Rooms WHERE Area = ?', [this.active.area], () => {
                this.emit('clear-area-done', this.active.area);
                this.reset();
                this.refresh();
                this._changed = true;
            });
        });
    }

    public clearAll() {
        this._db.run('DELETE FROM Exits', () => {
            this._db.run('DELETE FROM Rooms', () => {
                this.emit('clear-done');
                this.reset();
                this.refresh();
                this.focusActiveRoom();
                this._changed = true;
            });
        });
    }

    public processData(data) {
        try {
            this._db.all('Select * FROM Rooms where ID = \'' + data.num + '\'', (err, rows) => {
                let room;
                if (!rows || rows.length === 0) {
                    room = {
                        area: '',
                        details: 0,
                        exits: {},
                        name: '',
                        num: 0,
                        env: '',
                        x: 0,
                        y: 0,
                        z: 0,
                        zone: 0
                    };
                    room.zone = this.current.zone;
                    if (this.current.ID !== null) {
                        switch (data.prevroom.dir) {
                            case 'west':
                                room.x--;
                                break;
                            case 'east':
                                room.x++;
                                break;
                            case 'north':
                                room.y--;
                                break;
                            case 'south':
                                room.y++;
                                break;
                            case 'northeast':
                                room.y--;
                                room.x++;
                                break;
                            case 'northwest':
                                room.y--;
                                room.x--;
                                break;
                            case 'southeast':
                                room.y++;
                                room.x++;
                                break;
                            case 'southwest':
                                room.y++;
                                room.x--;
                                break;
                            case 'up':
                                room.z++;
                                break;
                            case 'down':
                                room.z--;
                                break;
                            //out means you leave a zone
                            case 'out':
                                room.zone = this.current.zone - 1;
                                break;
                            //enter or unknown exits new zone
                            default:
                                //if (val.area == currentRoom.area)
                                room.zone = this.current.zone + 1;
                                break;
                        }
                        room.x += this.current.x;
                        room.y += this.current.y;
                        room.z += this.current.z;
                    }
                    if (data.area === this.current.area) {
                        this.updateCurrent(room, data);
                        this._changed = true;
                    }
                    else
                        this.roomExists(room.x, room.y, room.z, this.current.zone, (exist) => {
                            if (exist || data.prevroom.zone) {
                                this.getFreeZone(room.x, room.y, room.z, this.current.zone, (zone) => {
                                    room.zone = zone;
                                    this.updateCurrent(room, data);
                                    this._changed = true;
                                });
                            }
                            else {
                                this.updateCurrent(room, data);
                                this._changed = true;
                            }
                        });
                }
                else {
                    this.updateCurrent({
                        area: rows[0].Area,
                        details: rows[0].Details,
                        exits: {},
                        name: rows[0].Name,
                        num: rows[0].ID,
                        env: rows[0].Env,
                        x: rows[0].X,
                        y: rows[0].Y,
                        z: rows[0].Z,
                        zone: rows[0].Zone
                    }, data);
                }
            });
        }
        catch (e) {
            this.emit('error', e);
        }
    }

    private updateCurrent(room, data) {
        room.ID = data.num;
        room.area = data.area;
        room.name = data.name;
        room.env = data.environment;
        room.indoors = data.indoors;
        let exit;
        for (exit in data.exits)
            room.exits[exit] = data.exits[exit];
        //start with none
        room.details = RoomDetails.None;
        for (let x = 0; x < data.details.length; x++) {
            switch (data.details[x]) {
                case 'dock':
                    room.details |= RoomDetails.Dock;
                    break;
                case 'pier':
                    room.details |= RoomDetails.Pier;
                    break;
                case 'bank':
                    room.details |= RoomDetails.Bank;
                    break;
                case 'shop':
                    room.details |= RoomDetails.Shop;
                    break;
                case 'hospital':
                    room.details |= RoomDetails.Hospital;
                    break;
                case 'bar':
                    room.details |= RoomDetails.Bar;
                    break;
                case 'restaurant':
                    room.details |= RoomDetails.Restaurant;
                    break;
                case 'watersource':
                    room.details |= RoomDetails.WaterSource;
                    break;
                case 'trainer':
                case 'training':
                case 'advance':
                    room.details |= RoomDetails.Trainer;
                    break;
                case 'stable':
                    room.details |= RoomDetails.Stable;
                    break;
            }
        }
        room = this.sanitizeRoom(room);
        this.addOrUpdateRoom(room);
        this.current.ID = room.ID;
        this.current.area = room.area;
        this.current.x = room.x;
        this.current.y = room.y;
        this.current.z = room.z;
        this.current.zone = room.zone;
        this.emit('current-room-changed', this.current);
        if (this.selected && this.selected.ID === room.ID)
            this.emit('room-selected', clone(room));
        if (this.follow)
            this.focusCurrentRoom();
        else
            this.setActive(clone(this.current));
        this.refresh();
    }

    public getFreeZone(x, y, z, zone, callback) {
        if (!zone) zone = 0;
        this._db.serialize(() => {
            //this._db.get('SELECT Zone FROM Rooms WHERE X = ' + x + ' AND Y = ' + y + ' AND Z =' + z + ' ORDER BY Zone DESC LIMIT 1', (err, row) => {
            //this._db.get('SELECT DISTINCT Zone FROM Rooms WHERE X = ' + x + ' AND Y = ' + y + ' AND Z =' + z + ' ORDER BY Zone DESC LIMIT 1', (err, row) => {
            this._db.get('SELECT DISTINCT Zone FROM Rooms ORDER BY Zone DESC LIMIT 1', (err, row) => {
                if (!row) {
                    if (callback)
                        callback(zone);
                }
                else if (callback)
                    callback(row.Zone + 1);
            });
        });
    }

    public roomExists(x, y, z, zone, callback) {
        if (!zone) zone = 0;
        this._db.serialize(() => {
            //this._db.get('SELECT Zone FROM Rooms WHERE X = ' + x + ' AND Y = ' + y + ' AND Z =' + z + ' ORDER BY Zone DESC LIMIT 1', (err, row) => {
            this._db.get('SELECT DISTINCT Zone FROM Rooms WHERE X = ' + x + ' AND Y = ' + y + ' AND Z =' + z + ' ORDER BY Zone DESC LIMIT 1', (err, row) => {
                if (!row) {
                    if (callback)
                        callback(false);
                }
                else if (callback)
                    callback(true);
            });
        });
    }

    public updateRoom(room) {
        //this._db.serialize(() => {
        this._db.run('Update Rooms SET Area = ?, Details = ?, Name = ?, Env = ?, X = ?, Y = ?, Z = ?, Zone = ?, Indoors = ? WHERE ID = ?',
            [
                room.Area || room.area,
                room.Details || room.details || RoomDetails.None,
                room.Name || room.name,
                room.Env || room.env,
                room.X || room.x || 0,
                room.Y || room.y || 0,
                room.Z || room.z || 0,
                room.Zone || room.zone || 0,
                room.Indoors || room.indoors,
                room.ID || room.num
            ], (err) => {
                if (err)
                    this.emit('error', err);
                this._changed = true;
            });
        this._db.run('Delete From Exits WHERE ID = ?', [room.ID || room.num]);
        const stmt = this._db.prepare('INSERT INTO Exits VALUES (?, ?, ?, ?, ?)');
        let exit;
        for (exit in room.exits) {
            if (!room.exits.hasOwnProperty(exit)) continue;
            stmt.run(room.ID, exit, room.exits[exit].num, room.exits[exit].isdoor, room.exits[exit].isclosed);
        }
        stmt.finalize();
        this._changed = true;
        //});
    }

    public addOrUpdateRoom(room) {
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
                this.refresh();
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
        this.refresh();
        this._changed = true;
    }

    public processGMCP(mod: string, obj) {
        if (!this.enabled) return;
        const mods = mod.split('.');
        if (mods.length < 2 || mods[0] !== 'Room') return;
        switch (mods[1]) {
            case 'Info':
                this.processData(obj);
                break;
            case 'WrongDir':
                break;
        }
    }

    private sanitizeRoom(r): Room {
        r.ID = '' + r.ID;
        r.x = parseInt(r.x, 10);
        r.y = parseInt(r.y, 10);
        r.z = parseInt(r.z, 10);
        r.zone = parseInt(r.zone, 10);
        return r;
    }

    public DrawLegend(ctx, x, y, nc) {
        if (!this._showLegend) return;
        ctx.strokeStyle = 'black';
        if (!nc) {
            ctx.fillStyle = '#eae4d6';
            //ctx.clearRect(x + 30, y + 35, 130, 145);
            ctx.fillRect(x + 30, y + 35, 130, 175);
        }
        ctx.fillStyle = 'black';
        ctx.strokeRect(x + 30, y + 35, 130, 175);
        ctx.font = 'italic bold 8pt Georgia';
        ctx.fillText('Dock', x + 50, y + 50);
        ctx.fillStyle = 'chocolate';
        ctx.beginPath();
        ctx.arc(x + 40, y + 45, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        ctx.fillStyle = 'black';
        ctx.fillText('Pier', x + 50, y + 65);
        ctx.fillStyle = 'gray';
        ctx.beginPath();
        ctx.arc(x + 40, y + 60, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        ctx.fillStyle = 'black';
        ctx.fillText('Water Source', x + 50, y + 80);
        ctx.fillStyle = 'aqua';
        ctx.beginPath();
        ctx.arc(x + 40, y + 75, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        ctx.fillStyle = 'black';
        ctx.fillText('Bank', x + 50, y + 95);
        ctx.font = '8pt Arial';
        ctx.fillStyle = 'goldenrod';
        ctx.beginPath();
        ctx.fillText('$', x + 38, y + 95);
        ctx.closePath();
        ctx.font = 'italic bold 8pt Georgia';
        ctx.fillStyle = 'black';
        ctx.fillText('Shop', x + 50, y + 110);
        ctx.font = '8pt Arial';
        ctx.fillStyle = 'purple';
        ctx.beginPath();
        ctx.fillText('\u23CF', x + 38, y + 110);
        ctx.closePath();
        ctx.font = 'italic bold 8pt Georgia';
        ctx.fillStyle = 'black';
        ctx.fillText('Hospital', x + 50, y + 125);
        ctx.font = '8pt Arial';
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.fillText('\u2665', x + 38, y + 125);
        ctx.closePath();
        ctx.font = 'italic bold 8pt Georgia';
        ctx.fillStyle = 'black';
        ctx.fillText('Bar & Restaurant', x + 50, y + 140);
        ctx.font = '8pt Arial';
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.fillText('\u2617', x + 38, y + 140);
        ctx.closePath();
        ctx.font = 'italic bold 8pt Georgia';
        ctx.fillStyle = 'black';
        ctx.fillText('Bar', x + 50, y + 155);
        ctx.font = '8pt Arial';
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.fillText('\u266A', x + 38, y + 155);
        ctx.closePath();
        ctx.font = 'italic bold 8pt Georgia';
        ctx.fillStyle = 'black';
        ctx.fillText('Restaurant', x + 50, y + 170);
        ctx.font = '8pt Arial';
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.fillText('\u2616', x + 38, y + 170);
        ctx.closePath();

        ctx.font = 'italic bold 8pt Georgia';
        ctx.fillStyle = 'black';
        ctx.fillText('Train', x + 50, y + 185);
        ctx.font = '8pt Arial';
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.fillText('\u260D', x + 38, y + 185);
        ctx.closePath();

        ctx.font = 'italic bold 8pt Georgia';
        ctx.fillStyle = 'black';
        ctx.fillText('Stable', x + 50, y + 200);
        ctx.font = '8pt Arial';
        ctx.fillStyle = 'rgb(153, 102, 0)';
        ctx.beginPath();
        ctx.fillText('\u2658', x + 38, y + 200);
        ctx.closePath();

    }

    public DrawRoom(ctx, x, y, room, ex) {
        ctx.beginPath();
        let f = false;
        if (room.Background) {
            ctx.fillStyle = room.Background;
            f = true;
        }
        else if (room.Env) {
            switch (room.Env) {
                case 'wood':
                    ctx.fillStyle = '#966F33';
                    f = true;
                    break;
                case 'jungle':
                    ctx.fillStyle = '#347C2C';
                    f = true;
                    break;
                case 'forest':
                    ctx.fillStyle = '#4E9258';
                    f = true;
                    break;
                case 'grass':
                case 'grassland':
                case 'plains':
                case 'prairie':
                case 'savannah':
                    ctx.fillStyle = '#4AA02C';
                    f = true;
                    break;
                case 'desert':
                case 'dirt':
                case 'dirtroad':
                case 'beach':
                case 'sand':
                case 'sanddesert':
                    ctx.fillStyle = '#C2B280';
                    f = true;
                    break;
                case 'snow':
                    ctx.fillStyle = '#F0F8FF';
                    f = true;
                    break;
                case 'tundra':
                case 'icesheet':
                    ctx.fillStyle = '#368BC1';
                    f = true;
                    break;
                case 'underwater':
                case 'water':
                case 'lake':
                case 'river':
                    ctx.fillStyle = '#EBF4FA';
                    f = true;
                    break;
                case 'ocean':
                    ctx.fillStyle = '#C2DFFF';
                    f = true;
                    break;
                case 'bog':
                case 'city':
                case 'cliff':
                case 'cobble':
                case 'farmland':
                case 'highmountain':
                case 'hills':
                case 'mountain':
                case 'pavedroad':
                case 'rockdesert':
                case 'rocky':
                case 'stone':
                case 'swamp':
                    f = false;
                    break;
                default:
                    f = false;
                    break;
            }
        }
        else
            f = false;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 0.6;
        if (!room.Indoors) {
            ctx.arc(x + 16, y + 16, 8.5, 0, Math.PI * 2, false);
            if (f) ctx.fill();
            ctx.stroke();
        }
        else {
            if (f) ctx.fillRect(x + 8, y + 8, 16, 16);
            ctx.strokeRect(x + 8, y + 8, 16, 16);
        }
        ctx.closePath();
        ctx.beginPath();
        ctx.fillStyle = '#cccccc';
        if (room.exits.north) {
            ctx.moveTo(x + 16, y);
            ctx.lineTo(x + 16, y + 8);
        }
        else if (this._fillWalls)
            ctx.fillRect(x + 9, y, 14.5, 4.5);
        if (room.exits.northwest) {
            if (!room.Indoors) {
                ctx.moveTo(x, y);
                ctx.lineTo(x + 10, y + 10);
            }
            else {
                ctx.moveTo(x, y);
                ctx.lineTo(x + 8, y + 8);
            }
        }
        else if (this._fillWalls) {
            ctx.fillRect(x + 2, y, 2.5, 2.5);
            ctx.fillRect(x, y + 2, 4.5, 2.5);
            if (!room.exits.north)
                ctx.fillRect(x + 4, y, 5.5, 4.5);
            if (!room.exits.west)
                ctx.fillRect(x, y + 4, 4.5, 5.5);
        }
        if (room.exits.northeast) {
            if (!room.Indoors) {
                ctx.moveTo(x + 32, y);
                ctx.lineTo(x + 22, y + 10);
            }
            else {
                ctx.moveTo(x + 32, y);
                ctx.lineTo(x + 24, y + 8);
            }
        }
        else if (this._fillWalls) {
            ctx.fillRect(x + 28, y, 2.5, 2.5);
            ctx.fillRect(x + 28, y + 2, 4.5, 2.5);
            ctx.clearRect(x + 30, y, 2, 2);
            if (!room.exits.north)
                ctx.fillRect(x + 23, y, 5.5, 4.5);
            if (!room.exits.east)
                ctx.fillRect(x + 28, y + 4, 4.5, 5.5);
        }
        if (room.exits.east) {
            ctx.moveTo(x + 24, y + 16);
            ctx.lineTo(x + 32, y + 16);
        }
        else if (this._fillWalls)
            ctx.fillRect(x + 28, y + 9, 4.5, 14.5);
        if (room.exits.west) {
            ctx.moveTo(x, y + 16);
            ctx.lineTo(x + 8, y + 16);
        }
        else if (this._fillWalls)
            ctx.fillRect(x, y + 9, 4.5, 14.5);
        if (room.exits.south) {
            ctx.moveTo(x + 16, y + 24);
            ctx.lineTo(x + 16, y + 32);
        }
        else if (this._fillWalls)
            ctx.fillRect(x + 9, y + 28, 14.5, 4.5);
        if (room.exits.southeast) {
            if (!room.Indoors) {
                ctx.moveTo(x + 32, y + 32);
                ctx.lineTo(x + 22, y + 22);
            }
            else {
                ctx.moveTo(x + 32, y + 32);
                ctx.lineTo(x + 24, y + 24);
            }
        }
        else if (this._fillWalls) {
            ctx.fillRect(x + 28, y + 28, 4.5, 2.5);
            ctx.fillRect(x + 28, y + 30, 2.5, 2.5);
            if (!room.exits.south)
                ctx.fillRect(x + 23, y + 28, 5.5, 4.5);
            if (!room.exits.east)
                ctx.fillRect(x + 28, y + 23, 4.5, 5.5);
        }
        if (room.exits.southwest) {
            if (!room.Indoors) {
                ctx.moveTo(x, y + 32);
                ctx.lineTo(x + 10, y + 22);
            }
            else {
                ctx.moveTo(x, y + 32);
                ctx.lineTo(x + 8, y + 24);
            }
        }
        else if (this._fillWalls) {
            ctx.fillRect(x, y + 28, 4.5, 2.5);
            ctx.fillRect(x + 2, y + 30, 2.5, 2.5);
            if (!room.exits.south)
                ctx.fillRect(x + 4, y + 28, 5.5, 4.5);
            if (!room.exits.west)
                ctx.fillRect(x, y + 23, 4.5, 5.5);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'black';
        if (room.exits.up) {
            ctx.beginPath();
            ctx.moveTo(x + 1, y + 11);
            ctx.lineTo(x + 7, y + 11);
            ctx.lineTo(x + 4, y + 8);
            ctx.closePath();
            ctx.fill();
        }
        if (room.exits.down) {
            ctx.beginPath();
            ctx.moveTo(x + 1, y + 21);
            ctx.lineTo(x + 7, y + 21);
            ctx.lineTo(x + 4, y + 24);
            ctx.closePath();
            ctx.fill();
        }
        if (room.exits.out) {
            ctx.beginPath();
            ctx.moveTo(x + 26, y + 8);
            ctx.lineTo(x + 29, y + 11);
            ctx.lineTo(x + 26, y + 14);
            ctx.closePath();
            ctx.fill();

        }
        if (room.exits.enter) {
            ctx.beginPath();
            ctx.moveTo(x + 29, y + 19);
            ctx.lineTo(x + 26, y + 22);
            ctx.lineTo(x + 29, y + 25);
            ctx.closePath();
            ctx.fill();
        }
        this.DrawDoor(ctx, x + 12, y - 2, 8, 3, room.exits.north);
        this.DrawDoor(ctx, x + 31, y + 12, 3, 8, room.exits.east);
        this.DrawDoor(ctx, x - 1, y + 12, 3, 8, room.exits.west);
        this.DrawDoor(ctx, x + 12, y + 30, 8, 3, room.exits.south);
        this.DrawDDoor(ctx, x, y, 5, 5, room.exits.northwest);
        this.DrawDDoor(ctx, x + 32, y, -5, 5, room.exits.northeast);
        this.DrawDDoor(ctx, x + 32, y + 32, -5, -5, room.exits.southeast);
        this.DrawDDoor(ctx, x, y + 32, 5, -5, room.exits.southwest);
        if ((room.Details & RoomDetails.Dock) === RoomDetails.Dock) {
            ctx.fillStyle = 'chocolate';
            ctx.beginPath();
            ctx.arc(x + 20, y + 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        }
        else if ((room.Details & RoomDetails.Pier) === RoomDetails.Pier) {
            ctx.fillStyle = 'gray';
            ctx.beginPath();
            ctx.arc(x + 12, y + 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        }
        if ((room.Details & RoomDetails.WaterSource) === RoomDetails.WaterSource) {
            ctx.fillStyle = 'aqua';
            ctx.beginPath();
            ctx.arc(x + 12, y + 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        }
        if ((room.Details & RoomDetails.Bank) === RoomDetails.Bank) {
            ctx.fillStyle = 'goldenrod';
            ctx.beginPath();
            ctx.fillText('$', x + 9, y + 17);
            ctx.closePath();
        }
        if ((room.Details & RoomDetails.Shop) === RoomDetails.Shop) {
            ctx.fillStyle = 'purple';
            ctx.beginPath();
            ctx.fillText('\u23CF', x + 15, y + 17);
            ctx.closePath();
        }
        if ((room.Details & RoomDetails.Hospital) === RoomDetails.Hospital) {
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.fillText('\u2665', x + 15, y + 17);
            ctx.closePath();
        }
        if ((room.Details & RoomDetails.Trainer) === RoomDetails.Trainer) {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.fillText('\u260D', x + 15, y + 17);
            ctx.closePath();
        }
        if ((room.Details & RoomDetails.Stable) === RoomDetails.Stable) {
            ctx.fillStyle = 'rgb(153, 102, 0)';
            ctx.beginPath();
            ctx.fillText('\u2658', x + 7, y + 17);
            ctx.closePath();
        }
        if ((room.Details & RoomDetails.Restaurant) === RoomDetails.Restaurant && (room.Details & RoomDetails.Bar) === RoomDetails.Bar) {
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.fillText('\u2617', x + 15, y + 17);
            ctx.closePath();
        }
        else if ((room.Details & RoomDetails.Bar) === RoomDetails.Bar) {
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.fillText('\u266A', x + 15, y + 17);
            ctx.closePath();
        }
        else if ((room.Details & RoomDetails.Restaurant) === RoomDetails.Restaurant) {
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.fillText('\u2616', x + 15, y + 17);
            ctx.closePath();
        }

        if (!ex && this.selected.ID === room.ID) {
            ctx.fillStyle = 'rgba(135, 206, 250, 0.5)';
            ctx.strokeStyle = 'LightSkyBlue';
            ctx.fillRoundedRect(x, y, 32, 32, 8);
            ctx.strokeRoundedRect(x, y, 32, 32, 8);
        }
        if (this.markers[room.ID] === 2)
            this.drawMarker(ctx, x, y, 'green');
        else if (this.markers[room.ID] === 3)
            this.drawMarker(ctx, x, y, 'blue');
        else if (this.markers[room.ID])
            this.drawMarker(ctx, x, y, 'yellow');
        if (!ex && room.ID === this.current.ID)
            this.drawMarker(ctx, x, y, 'red');
    }

    public drawMarker(ctx, x, y, color) {
        if (!color) color = 'yellow';
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.strokeStyle = 'black';
        ctx.arc(x + 16, y + 16, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }

    public DrawDoor(ctx, x, y, w, h, exit) {
        if (!exit || !exit.isdoor) return;
        ctx.beginPath();
        ctx.clearRect(x, y, w, h);
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'black';
        if (exit.islocked) {
            ctx.fillStyle = 'red';
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }
        else if (exit.isclosed)
            ctx.fillRect(x, y, w, h);
        else
            ctx.strokeRect(x, y, w, h);
        ctx.closePath();
    }

    public DrawDDoor(ctx, x, y, w, h, exit) {
        if (!exit || !exit.isdoor) return;
        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'black';
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y);
        if (exit.islocked) {
            ctx.fillStyle = 'red';
            ctx.fill();
            ctx.stroke();
        }
        else if (exit.isclosed)
            ctx.fill();
        else
            ctx.stroke();
        ctx.closePath();
    }

    public PointInRect(x, y, x1, x2, y1, y2) {
        if ((x1 <= x && x <= x2) && (y1 <= y && y <= y2))
            return true;
        return false;
    }

    public getRoom(id, callback) {
        this._db.all('Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID WHERE Rooms.ID = $id', {
            $id: id
        }, (err, rows) => {
            const rooms = {};
            if (rows) {
                const rl = rows.length;
                for (let r = 0; r < rl; r++) {
                    if (rooms[rows[r].ID]) {
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        };
                    }
                    else {
                        rooms[rows[r].ID] = clone(rows[r]);
                        rooms[rows[r].ID].exits = {};
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        };
                    }
                }
                if (callback) callback(rooms[rows[0].ID]);
            }
        });
    }

    public getRooms(area, level, zone, callback) {
        if (this._splitArea) {
            this._db.all('Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID WHERE Z = $z AND Area = $area AND Zone = $zone', {
                $area: area,
                $zone: zone,
                $z: level
            }, (err, rows) => {
                const rooms = {};
                if (rows) {
                    const rl = rows.length;
                    for (let r = 0; r < rl; r++) {
                        if (rooms[rows[r].ID]) {
                            rooms[rows[r].ID].exits[rows[r].Exit] = {
                                num: rows[r].DestID,
                                isdoor: rows[r].IsDoor,
                                isclosed: rows[r].IsClosed
                            };
                        }
                        else {
                            rooms[rows[r].ID] = clone(rows[r]);
                            rooms[rows[r].ID].exits = {};
                            rooms[rows[r].ID].exits[rows[r].Exit] = {
                                num: rows[r].DestID,
                                isdoor: rows[r].IsDoor,
                                isclosed: rows[r].IsClosed
                            };
                        }
                    }
                    if (callback) callback(rooms);
                }
            });
        }
        else {
            this._db.all('Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID WHERE Z = $z AND Zone = $zone', {
                $zone: zone,
                $z: level
            }, (err, rows) => {
                const rooms = {};
                if (rows) {
                    const rl = rows.length;
                    for (let r = 0; r < rl; r++) {
                        if (rooms[rows[r].ID]) {
                            rooms[rows[r].ID].exits[rows[r].Exit] = {
                                num: rows[r].DestID,
                                isdoor: rows[r].IsDoor,
                                isclosed: rows[r].IsClosed
                            };
                        }
                        else {
                            rooms[rows[r].ID] = clone(rows[r]);
                            rooms[rows[r].ID].exits = {};
                            rooms[rows[r].ID].exits[rows[r].Exit] = {
                                num: rows[r].DestID,
                                isdoor: rows[r].IsDoor,
                                isclosed: rows[r].IsClosed
                            };
                        }
                    }
                    if (callback) callback(rooms);
                }
            });
        }
    }

    public showPath(destRoom?: Room) {
        if (!destRoom || !destRoom.ID)
            destRoom = this.selected;
        if (this.current.ID == null || destRoom.ID == null)
            return;
        if (this._splitArea && this.current.area !== destRoom.area)
            return;
        if (this.current.zone !== destRoom.zone)
            return;
        //add 3d later
        if (this.current.z !== destRoom.z)
            return;
        this.getRooms(this.current.area, this.current.z, this.current.zone, (rooms) => {
            let room;
            let id;
            const roomsC = [];
            let ox = null;
            let oy = 0;
            let w = 0;
            let h = 0;
            let r;
            let rl = rooms.length;
            let x;
            let y;
            let cx;
            let cy;
            for (id in rooms) {
                if (!rooms.hasOwnProperty(id)) continue;
                room = rooms[id];
                if (ox == null) {
                    ox = room.X;
                    w = room.X + 1;
                    oy = room.Y;
                    h = room.Y + 1;
                    continue;
                }
                if (room.X < ox) ox = room.X; else if (room.X > w) w = room.X;
                if (room.Y < oy) oy = room.Y; else if (room.Y > h) h = room.Y;
            }

            for (id in rooms) {
                if (!rooms.hasOwnProperty(id)) continue;
                room = rooms[id];
                if (room == null) continue;
                if (!roomsC[room.Y - oy]) roomsC[room.Y - oy] = [];
                roomsC[room.Y - oy][room.X - ox] = room;
            }

            w = Math.sqrt(Math.pow(w - ox, 2)) + 1;
            h = Math.sqrt(Math.pow(oy - h, 2)) + 1;
            const matrix = [];

            for (y = 0; y < h; y++) {
                matrix[y] = [];
                for (x = 0; x < w; x++)
                    matrix[y][x] = 0;
            }

            for (id in rooms) {
                if (!rooms.hasOwnProperty(id)) continue;
                room = rooms[id];
                room = rooms[id];
                x = (room.X - ox);
                y = (room.Y - oy);
                if (room.exits.northwest)
                    matrix[y][x] |= 1;
                if (room.exits.north)
                    matrix[y][x] |= 128;
                if (room.exits.northeast)
                    matrix[y][x] |= 64;
                if (room.exits.west)
                    matrix[y][x] |= 2;
                if (room.exits.east)
                    matrix[y][x] |= 32;
                if (room.exits.southwest)
                    matrix[y][x] |= 4;
                if (room.exits.south)
                    matrix[y][x] |= 8;
                if (room.exits.southeast)
                    matrix[y][x] |= 16;
                //if (room.exits.up)
                //matrix[y][x] |= 512;
                //if (room.exits.down)
                //matrix[y][x] |= 256;
            }
            const grid = new PF.Grid(w, h, matrix);

            const finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: false });
            x = (this.current.x - ox);
            y = (this.current.y - oy);
            cx = (destRoom.x - ox);
            cy = (destRoom.y - oy);
            const fPath = finder.findPath(x, y, cx, cy, grid);
            rl = fPath.length;
            this.markers = {};
            for (r = 0; r < rl; r++) {
                x = Math.floor(fPath[r][0]);
                y = Math.floor(fPath[r][1]);
                if (roomsC[y] && roomsC[y][x]) {
                    if (roomsC[y][x].ID === this.current.ID)
                        this.markers[roomsC[y][x].ID] = 2;
                    else if (roomsC[y][x].ID === destRoom.ID)
                        this.markers[roomsC[y][x].ID] = 3;
                    else
                        this.markers[roomsC[y][x].ID] = 1;
                }
            }
            this.emit('path-shown');
            this.draw();
        });
    }

    public clearPath() {
        this.emit('path-cleared');
        this.markers = {};
        this.draw();
    }

    public walkPath(destRoom?: Room) {
        if (!destRoom || !destRoom.ID)
            destRoom = this.selected;
        if (this.current.ID == null || destRoom.ID == null)
            return;
        if (this._splitArea && this.current.area !== destRoom.area)
            return;
        if (this.current.zone !== destRoom.zone)
            return;
        //add 3d later
        if (this.current.z !== destRoom.z)
            return;
        this.getRooms(this.current.area, this.current.z, this.current.zone, (rooms) => {
            let room;
            let id;
            const roomsC = [];
            let ox = null;
            let oy = 0;
            let w = 0;
            let h = 0;
            let r;
            let rl = rooms.length;
            let x;
            let y;
            let cx;
            let cy;
            let x2;
            let y2;
            for (id in rooms) {
                if (!rooms.hasOwnProperty(id)) continue;
                room = rooms[id];
                if (ox == null) {
                    ox = room.X;
                    w = room.X + 1;
                    oy = room.Y;
                    h = room.Y + 1;
                    continue;
                }
                if (room.X < ox) ox = room.X; else if (room.X > w) w = room.X;
                if (room.Y < oy) oy = room.Y; else if (room.Y > h) h = room.Y;
            }

            for (id in rooms) {
                if (!rooms.hasOwnProperty(id)) continue;
                room = rooms[id];
                if (room == null) continue;
                if (!roomsC[room.Y - oy]) roomsC[room.Y - oy] = [];
                roomsC[room.Y - oy][room.X - ox] = room;
            }

            w = Math.sqrt(Math.pow(w - ox, 2)) + 1;
            h = Math.sqrt(Math.pow(oy - h, 2)) + 1;
            const matrix = [];

            for (y = 0; y < h; y++) {
                matrix[y] = [];
                for (x = 0; x < w; x++)
                    matrix[y][x] = 0;
            }

            for (id in rooms) {
                if (!rooms.hasOwnProperty(id)) continue;
                room = rooms[id];
                x = (room.X - ox);
                y = (room.Y - oy);
                if (room.exits.northwest)
                    matrix[y][x] |= 1;
                if (room.exits.north)
                    matrix[y][x] |= 128;
                if (room.exits.northeast)
                    matrix[y][x] |= 64;
                if (room.exits.west)
                    matrix[y][x] |= 2;
                if (room.exits.east)
                    matrix[y][x] |= 32;
                if (room.exits.southwest)
                    matrix[y][x] |= 4;
                if (room.exits.south)
                    matrix[y][x] |= 8;
                if (room.exits.southeast)
                    matrix[y][x] |= 16;
                //if (room.exits.up)
                //matrix[y][x] |= 512;
                //if (room.exits.down)
                //matrix[y][x] |= 256;
            }
            const grid = new PF.Grid(w, h, matrix);

            const finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: false });
            x = (this.current.x - ox);
            y = (this.current.y - oy);
            cx = (destRoom.x - ox);
            cy = (destRoom.y - oy);
            const fPath = finder.findPath(x, y, cx, cy, grid);
            rl = fPath.length;
            const walk = [];
            for (r = 0; r < rl - 1; r++) {
                x = Math.floor(fPath[r][0]);
                y = Math.floor(fPath[r][1]);
                x2 = Math.floor(fPath[r + 1][0]);
                y2 = Math.floor(fPath[r + 1][1]);

                if (x - 1 === x2 && y - 1 === y2)
                    walk.push('northwest');
                else if (x === x2 && y - 1 === y2)
                    walk.push('north');
                else if (x + 1 === x2 && y - 1 === y2)
                    walk.push('northeast');

                else if (x - 1 === x2 && y + 1 === y2)
                    walk.push('southwest');
                else if (x === x2 && y + 1 === y2)
                    walk.push('south');
                else if (x + 1 === x2 && y + 1 === y2)
                    walk.push('southeast');
                else if (x - 1 === x2 && y === y2)
                    walk.push('west');
                else
                    walk.push('east');
            }
            this.SendCommands(walk);
        });
    }

    public SendCommands(cmds) {
        let tmp;
        const cnt = this.commandDelayCount;
        if (cmds.length > cnt) {
            tmp = cmds.slice(cnt);
            cmds = cmds.slice(0, cnt);
            setTimeout(() => { this.SendCommands(tmp); }, this.commandDelay);
        }
        this.emit('send-commands', cmds.join('\n') + '\n');
    }

    public import(data, type?: ImportType) {
        if (!data) return;
        if (type === ImportType.Replace) {
            this._db.run('DELETE FROM Exits', () => {
                this._db.run('DELETE FROM Rooms', () => {
                    this.emit('clear-done');
                    this.reset();
                    //this.refresh();
                    //this.focusActiveRoom();
                    this.import(data, ImportType.Merge);
                    this._changed = true;
                });
            });
        }
        else {
            this._cancelImport = false;
            let idx;
            let r;
            let rl;
            this._db.serialize(() => {
                if (Array.isArray(data)) {
                    rl = data.length;
                    this.emit('import-progress', 0);
                    const stmt2 = this._db.prepare('INSERT OR REPLACE INTO Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ');
                    idx = 1;
                    for (r = 0; r < rl; r++) {
                        if (this._cancelImport) {
                            stmt2.finalize();
                            this._changed = true;
                            return;
                        }
                        if (!data[r]) continue;
                        rl += Object.keys(data[r].exits).length;
                        stmt2.run([
                            data[r].ID || data[r].num,
                            data[r].Area || data[r].area,
                            data[r].Details || data[r].details,
                            data[r].Name || data[r].name,
                            data[r].Env || data[r].env,
                            data[r].X || data[r].x,
                            data[r].Y || data[r].y,
                            data[r].Z || data[r].z,
                            data[r].Zone || data[r].zone,
                            data[r].Indoors || data[r].indoors,
                            data[r].Background || data[r].background
                        ],
                            (err) => {
                                if (this._cancelImport) {
                                    this.refresh();
                                    this.focusActiveRoom();
                                    this._changed = true;
                                    return;
                                }
                                this.emit('import-progress', Math.floor(r / rl * 100));
                                if (r >= rl) {
                                    //this.reset();
                                    this.refresh();
                                    this.focusActiveRoom();
                                }
                            });
                        //this._db.run("Delete From Exits WHERE ID = ?", [data[r].ID]);
                        const stmt = this._db.prepare('INSERT OR REPLACE INTO Exits VALUES (?, ?, ?, ?, ?)');
                        let exit;
                        for (exit in data[r].exits) {
                            if (!data[r].exits.hasOwnProperty(exit)) continue;
                            stmt.run(data[r].ID || data[r].num, exit, data[r].exits[exit].num, data[r].exits[exit].isdoor, data[r].exits[exit].isclosed,
                                () => {
                                    if (this._cancelImport) {
                                        this.refresh();
                                        this.focusActiveRoom();
                                        this._changed = true;
                                        return;
                                    }
                                    this.emit('import-progress', Math.floor(idx / rl * 100));
                                    idx++;
                                    if (idx >= rl) {
                                        //this.reset();
                                        this.refresh();
                                        this.focusActiveRoom();
                                    }
                                });
                        }
                        stmt.finalize();
                    }
                    stmt2.finalize();
                    if (rl === 0)
                        this.emit('import-progress', 100);
                    this._changed = true;
                    //this.emit('import-progress', 100);
                }
                else {
                    this.emit('import-progress', 0);
                    const stmt2 = this._db.prepare('INSERT OR REPLACE INTO Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ');
                    rl = Object.keys(data).length;
                    idx = 1;
                    for (r in data) {
                        if (!data.hasOwnProperty(r) || !data[r]) continue;
                        if (this._cancelImport) {
                            stmt2.finalize();
                            this._changed = true;
                            return;
                        }
                        rl += Object.keys(data[r].exits).length;
                        if (this._cancelImport) {
                            stmt2.finalize();
                            return;
                        }
                        if (!data[r]) continue;
                        stmt2.run([
                            data[r].ID || data[r].num,
                            data[r].Area || data[r].area,
                            data[r].Details || data[r].details,
                            data[r].Name || data[r].name,
                            data[r].Env || data[r].env,
                            data[r].X || data[r].x,
                            data[r].Y || data[r].y,
                            data[r].Z || data[r].z,
                            data[r].Zone || data[r].zone,
                            data[r].Indoors || data[r].indoors,
                            data[r].Background || data[r].background
                        ],
                            (err) => {
                                if (this._cancelImport) {
                                    this.refresh();
                                    this.focusActiveRoom();
                                    this._changed = true;
                                    return;
                                }
                                this.emit('import-progress', Math.floor(idx / rl * 100));
                                idx++;
                                if (idx >= rl) {
                                    //this.reset();
                                    this.refresh();
                                    this.focusActiveRoom();
                                }
                            });
                        //this._db.run("Delete From Exits WHERE ID = ?", [data[r].ID]);
                        const stmt = this._db.prepare('INSERT OR REPLACE INTO Exits VALUES (?, ?, ?, ?, ?)');
                        let exit;
                        for (exit in data[r].exits) {
                            if (!data[r].exits.hasOwnProperty(exit)) continue;
                            stmt.run([data[r].ID || data[r].num, exit, data[r].exits[exit].num, data[r].exits[exit].isdoor, data[r].exits[exit].isclosed],
                                () => {
                                    if (this._cancelImport) {
                                        this.refresh();
                                        this.focusActiveRoom();
                                        this._changed = true;
                                        return;
                                    }
                                    this.emit('import-progress', Math.floor(idx / rl * 100));
                                    idx++;
                                    if (idx >= rl) {
                                        //this.reset();
                                        this.refresh();
                                        this.focusActiveRoom();
                                    }
                                });
                        }
                        stmt.finalize();
                    }
                    stmt2.finalize();
                    if (rl === 0)
                        this.emit('import-progress', 100);
                    this._changed = true;
                }
            });
        }
    }

    public exportArea(file: string) {
        this._db.all('Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID WHERE Area = $area', {
            $area: this.active.area || ''
        }, (err, rows) => {
            const rooms = {};
            if (rows) {
                const rl = rows.length;
                this.emit('import-progress', 0);
                for (let r = 0; r < rl; r++) {
                    if (rooms[rows[r].ID]) {
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        };
                    }
                    else {
                        rooms[rows[r].ID] = { num: rows[r].ID };
                        let prop;
                        for (prop in rows[r]) {
                            if (prop === 'ID')
                                continue;
                            if (!rows[r].hasOwnProperty(prop)) {
                                continue;
                            }
                            rooms[rows[r].ID][prop.toLowerCase()] = rows[r][prop];
                        }
                        rooms[rows[r].ID].exits = {};
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        };
                    }
                    this.emit('import-progress', Math.floor(r / rl * 100));
                }
                this.exportRooms(file, rooms);
            }
        });
    }

    public exportAll(file: string) {
        this._db.all('Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID', (err, rows) => {
            const rooms = {};
            if (rows) {
                const rl = rows.length;
                this.emit('import-progress', 0);
                for (let r = 0; r < rl; r++) {
                    if (rooms[rows[r].ID]) {
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        };
                    }
                    else {
                        rooms[rows[r].ID] = { num: rows[r].ID };
                        let prop;
                        for (prop in rows[r]) {
                            if (prop === 'ID')
                                continue;
                            if (!rows[r].hasOwnProperty(prop)) {
                                continue;
                            }
                            rooms[rows[r].ID][prop.toLowerCase()] = rows[r][prop];
                        }
                        rooms[rows[r].ID].exits = {};
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        };
                    }
                    this.emit('import-progress', Math.floor(r / rl * 100));
                }
                this.exportRooms(file, rooms);
            }
        });
    }

    public exportRooms(file: string, rooms) {
        if (!rooms) {
            this.emit('import-progress', 100);
            return;
        }
        fs.writeFileSync(file, JSON.stringify(rooms));
        this.emit('import-progress', 100);
    }

    public cancelImport() {
        this._cancelImport = true;
        this.emit('import-progress', 101);
    }

    public compact() {
        this.emit('import-progress', 0);
        this._db.run('VACUUM;', () => {
            this.emit('import-progress', 100);
        });
    }

    public executeCommand(cmd: string, callback?) {
        if (!cmd || cmd.length === 0) return;
        this._db.run(cmd, callback);
    }

    public save(callback?) {
        if (this._memory) {
            if (!this._changed) {
                if (callback)
                    callback();
                return;
            }
            this._db.run('ATTACH DATABASE \'' + this._mapFile + '\' as Disk', (err) => {
                if (err) this.emit('error', err);
            });
            this.createDatabase('Disk');
            this._db.run('DELETE FROM Disk.Rooms', (err) => {
                if (err) this.emit('error', err);
            });
            this._db.run('DELETE FROM Disk.Exits', (err) => {
                if (err) this.emit('error', err);
            });
            this._db.run('INSERT OR REPLACE INTO Disk.Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes) SELECT ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes FROM main.Rooms', (err) => {
                if (err) this.emit('error', err);
            });
            this._db.run('INSERT OR REPLACE INTO Disk.Exits (ID, Exit, DestID, IsDoor, IsClosed) SELECT ID, Exit, DestID, IsDoor, IsClosed FROM main.Exits', (err) => {
                if (err) this.emit('error', err);
            });
            this._db.run('VACUUM Disk', (err) => {
                if (err) this.emit('error', err);
            });
            this._db.run('DETACH DATABASE Disk', (err) => {
                if (err) this.emit('error', err);
                if (callback) callback();
            });
            this._changed = false;
        }
        else if (callback)
            callback();
    }
}