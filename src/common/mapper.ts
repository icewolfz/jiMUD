//spell-checker:ignore pathfinding, vscroll, hscroll, AUTOINCREMENT, Arial, isdoor, isclosed, prevroom, islocked, cmds
//spell-checker:ignore watersource, dirtroad, sanddesert, icesheet, highmountain, pavedroad, rockdesert
import EventEmitter = require('events');
import { parseTemplate, copy } from './library';
const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');
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

const RoomExits = {
    out: 4096,
    enter: 2048,
    unknown: 1024,
    up: 512,
    down: 256,
    north: 128,
    northeast: 64,
    east: 32,
    southeast: 16,
    south: 8,
    southwest: 4,
    west: 2,
    northwest: 1,
    none: 0
};

export enum ImportType {
    Merge = 0,
    Replace = 1
}

export enum UpdateType { none = 0, draw = 1 }

class Room {
    public ID: string = null;
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;
    public area: string = null;
    public zone: number = 0;
    public notes?: string;
    public background?: string;
    public env?: string;
    public details?: RoomDetails;
    public indoors?: number;
    public exits?: any;
    public name?: string;
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
    private _updating: UpdateType = UpdateType.none;
    private $drawCache;
    private $focused = false;

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
    public ready: boolean = false;
    private _scale: number = 1.0;

    set scale(value: number) {
        if (value < 25)
            value = 25;
        if (value > 200)
            value = 200;
        if (this._scale !== value) {
            this._scale = value / 100;
            this.emit('setting-changed', 'scale', value);
            this.$drawCache = {};
            this.doUpdate(UpdateType.draw);
        }
    }
    get scale(): number { return Math.round(this._scale * 100); }

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
                this._db.close();
                this._mapFile = value;
                this.initializeDatabase();
            });
        }
    }
    get mapFile(): string { return this._mapFile; }

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
            this.$drawCache = 0;
            this.doUpdate(UpdateType.draw);
            this.emit('setting-changed', 'legend', value);
        }
    }
    get showLegend(): boolean { return this._showLegend; }

    set splitArea(value: boolean) {
        if (this._splitArea !== value) {
            this._splitArea = value;
            this.$drawCache = 0;
            this.doUpdate(UpdateType.draw);
            this.emit('setting-changed', 'split', value);
        }
    }

    get splitArea(): boolean { return this._splitArea; }

    set fillWalls(value: boolean) {
        if (this._fillWalls !== value) {
            this._fillWalls = value;
            this.$drawCache = 0;
            this.doUpdate(UpdateType.draw);
            this.emit('setting-changed', 'fill', value);
        }
    }

    get fillWalls(): boolean { return this._fillWalls; }

    public createDatabase(prefix?) {
        if (prefix)
            prefix += '.';
        else
            prefix = '';
        try {
            this._db.pragma(prefix + 'synchronous=OFF');
            this._db.pragma(prefix + 'temp_store=MEMORY');
            this._db.pragma(prefix + 'threads=4');
            this._db.exec('CREATE TABLE IF NOT EXISTS ' + prefix + 'Rooms (ID TEXT PRIMARY KEY ASC, Area TEXT, Details INTEGER, Name TEXT, Env TEXT, X INTEGER, Y INTEGER, Z INTEGER, Zone INTEGER, Indoors INTEGER, Background TEXT, Notes TEXT)');
            this._db.exec('CREATE TABLE IF NOT EXISTS ' + prefix + 'Exits (ID TEXT, Exit TEXT, DestID TEXT, IsDoor INTEGER, IsClosed INTEGER)');
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
            this._db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ' + prefix + 'index_id on Rooms (ID);')
                .exec(' CREATE INDEX IF NOT EXISTS ' + prefix + 'coords on Rooms (X,Y,Z);')
                .exec(' CREATE INDEX IF NOT EXISTS ' + prefix + 'coords_zone on Rooms (X,Y,Z,Zone);')
                .exec('CREATE INDEX IF NOT EXISTS ' + prefix + 'coords_area on Rooms (X,Y,Z,Zone,Area);')
                .exec('CREATE INDEX IF NOT EXISTS ' + prefix + 'exits_id on Exits (ID);');
        }
        catch (err) {
            this.emit('error', err);
        }
    }

    public initializeDatabase() {
        this.ready = false;
        try {
            if (this._memory) {
                this._db = new sqlite3(':memory:', { memory: true });
                this._memoryPeriod = setInterval(this.save, this.memorySavePeriod);
            }
            else
                this._db = new sqlite3(this._mapFile);
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
            this._db.exec('ATTACH DATABASE \'' + this._mapFile + '\' as Disk');
            this.createDatabase('Disk');
            this._db.exec('BEGIN TRANSACTION')
                .exec('INSERT OR REPLACE INTO Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes) SELECT ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes FROM Disk.Rooms')
                .exec('INSERT OR REPLACE INTO Exits (ID, Exit, DestID, IsDoor, IsClosed) SELECT ID, Exit, DestID, IsDoor, IsClosed FROM Disk.Exits')
                .exec('COMMIT TRANSACTION')
                .exec('DETACH DATABASE Disk');
        }
        catch (err) {
            this.emit('error', err);
        }
        this.createIndexes();
        this.ready = true;
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
        this._context.mozImageSmoothingEnabled = false;
        this._context.webkitImageSmoothingEnabled = false;
        this._context.imageSmoothingEnabled = false;
        this._memory = memory;
        this.initializeDatabase();
        //rooms - ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors
        //exits - ID, Exit, DestID
        $(this._canvas).mousemove((event) => {
            this.MousePrev = this.Mouse;
            this.Mouse = this.getMapMousePos(event);
            if (this.drag) {
                this.MouseDrag.x += this.MousePrev.x - this.Mouse.x;
                this.MouseDrag.y += this.MousePrev.y - this.Mouse.y;
                const x = Math.floor(this.MouseDrag.x / 32 / this._scale);
                const y = Math.floor(this.MouseDrag.y / 32 / this._scale);
                if (x > 0 || x < 0 || y < 0 || y > 0) {
                    this.MouseDrag.x -= x * 32 * this._scale;
                    this.MouseDrag.y -= y * 32 * this._scale;
                    this.scrollBy(x, y);
                }
                $(this._canvas).css('cursor', 'move');
            }
            event.preventDefault();
        });
        $(this._canvas).mousedown((event) => {
            this.Mouse = this.getMapMousePos(event);
            this.MouseDown = this.getMapMousePos(event);
            this.MouseDrag.state = true;
            this.drag = this.MouseDown.button === 0;
        });

        $(this._canvas).mouseup((event) => {
            this.Mouse = this.getMapMousePos(event);
            if (!this.MouseDown)
                this.MouseDown = this.getMapMousePos(event);
            if (this.Mouse.button === 0 && Math.floor(this.Mouse.x / 32 / this._scale) === Math.floor(this.MouseDown.x / 32 / this._scale) && Math.floor(this.Mouse.y / 32 / this._scale) === Math.floor(this.MouseDown.y / 32 / this._scale)) {
                const x = this.Mouse.x;
                const y = this.Mouse.y;
                const room = this.findActiveRoomByCoords(x, y);
                if (this.selected && room && room.ID === this.selected.ID)
                    return;
                this.emit('room-before-selected', copy(this.selected));
                this.selected = room;
                this.emit('room-selected', copy(room));
                this.doUpdate(UpdateType.draw);
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
                this.doUpdate(UpdateType.draw);
                this.drag = false;
                $(this._canvas).css('cursor', 'default');
            }
        });
        $(this._canvas).bind('contextmenu', (event) => {
            event.preventDefault();
            const m = this.getMapMousePos(event);
            this.emit('context-menu', copy(this.findActiveRoomByCoords(m.x, m.y)));
            return false;
        });
        $(this._canvas).click((event) => {
            event.preventDefault();
            this.MouseDrag.state = false;
            this.drag = false;
            $(this._canvas).css('cursor', 'default');
        });
        $(this._canvas).dblclick((event) => {
            event.preventDefault();
            this.Mouse = this.getMapMousePos(event);
            this.MouseDown = this.getMapMousePos(event);
            this.MouseDrag.state = true;
            this.drag = true;
            $(this._canvas).css('cursor', 'move');
        });
        this._canvas.onselectstart = () => { return false; };
        this._canvas.addEventListener('focus', (e) => {
            this.setFocus(true);
        });
        this._canvas.addEventListener('blur', (e) => {
            this.setFocus(false);
        });
        this._canvas.addEventListener('keydown', (e) => {
            if (!this.$focused) return;
            switch (e.which) {
                case 27:
                    e.preventDefault();
                    this.MouseDrag.state = false;
                    this.drag = false;
                    $(this._canvas).css('cursor', 'default');
                    break;
                case 38: //up
                    e.preventDefault();
                    this.scrollBy(0, -1);
                    break;
                case 40: //down
                    e.preventDefault();
                    this.scrollBy(0, 1);
                    break;
                case 37: //left
                    e.preventDefault();
                    this.scrollBy(-1, 0);
                    break;
                case 39: //right
                    e.preventDefault();
                    this.scrollBy(1, 0);
                    break;
                case 110:
                case 46: //delete
                    e.preventDefault();
                    this.clearSelectedRoom();
                    break;
                case 97: //num1
                    e.preventDefault();
                    this.scrollBy(-1, 1);
                    break;
                case 98: //num2
                    e.preventDefault();
                    this.scrollBy(0, 1);
                    break;
                case 99: //num3
                    e.preventDefault();
                    this.scrollBy(1, 1);
                    break;
                case 100: //num4
                    e.preventDefault();
                    this.scrollBy(-1, 0);
                    break;
                case 101: //num5
                    e.preventDefault();
                    this.focusCurrentRoom();
                    break;
                case 102: //num6
                    e.preventDefault();
                    this.scrollBy(1, 0);
                    break;
                case 103: //num7
                    e.preventDefault();
                    this.scrollBy(-1, -1);
                    break;
                case 104: //num8
                    e.preventDefault();
                    this.scrollBy(0, -1);
                    break;
                case 105: //num9
                    e.preventDefault();
                    this.scrollBy(1, -1);
                    break;
                case 107: //+
                    e.preventDefault();
                    this.setLevel(this.active.z + 1);
                    break;
                case 109: //-
                    e.preventDefault();
                    this.setLevel(this.active.z - 1);
                    break;
                case 111: // /
                    e.preventDefault();
                    this.setZone(this.active.zone - 1);
                    break;
                case 106: // *
                    e.preventDefault();
                    this.setZone(this.active.zone + 1);
                    break;
            }
        });
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
        this.doUpdate(UpdateType.draw);
        this.emit('setting-changed', 'vscroll', this.vscroll);
        this.emit('setting-changed', 'hscroll', this.hscroll);
    }

    public scrollTo(x: number, y: number) {
        this.vscroll = x;
        this.hscroll = y;
        this.doUpdate(UpdateType.draw);
        this.emit('setting-changed', 'vscroll', this.vscroll);
        this.emit('setting-changed', 'hscroll', this.hscroll);
    }

    public findActiveRoomByCoords(rx: number, ry: number) {
        let x = this.vscroll - (this._canvas.width / 32 / 2 / this._scale);
        let y = this.hscroll - (this._canvas.height / 32 / 2 / this._scale);
        const z = this.active.z;
        const area = this.active.area;
        const zone = this.active.zone;
        let ox = 15.5 * this._scale;
        let oy = 15.5 * this._scale;
        if (this._canvas.width % 2 !== 0)
            ox = 15 * this._scale;
        if (this._canvas.height % 2 !== 0)
            oy = 15 * this._scale;
        x += (rx - ox) / 32 / this._scale;
        y += (ry - oy) / 32 / this._scale;
        x = Math.floor(x);
        y = Math.floor(y);
        let rows;
        try {
            if (this._splitArea)
                rows = this._db.prepare('Select * FROM Rooms left join exits on Exits.ID = Rooms.ID WHERE Area = $area AND Zone = $zone AND X = $x AND Y = $y AND Z = $z').all({
                    area: area,
                    zone: zone,
                    x: x,
                    y: y,
                    z: z
                });
            else
                rows = this._db.prepare('Select * FROM Rooms left join exits on Exits.ID = Rooms.ID WHERE Zone = $zone AND X = $x AND Y = $y AND Z = $z').all({
                    zone: zone,
                    x: x,
                    y: y,
                    z: z
                });
        }
        catch (err) {
            this.emit('error', err);
        }

        if (rows && rows.length > 0)
            return this.normalizeRoom(rows[0]);
        return new Room();
    }

    public draw(canvas?: HTMLCanvasElement, context?: CanvasRenderingContext2D, ex?: boolean, callback?) {
        if (!this.ready) {
            setTimeout(() => { this.doUpdate(UpdateType.draw); }, 10);
            return;
        }
        if (!canvas)
            canvas = this._canvas;
        if (!context)
            context = this._context;
        if (!ex) ex = false;
        //cant get map canvas bail
        if (!canvas || !context) return;

        const x = this.vscroll - (canvas.width / 32 / 2 / this._scale);
        const y = this.hscroll - (canvas.height / 32 / 2 / this._scale);
        const z = this.active.z || 0;
        const area = this.active.area || '';
        const zone = this.active.zone || 0;
        let ox = 15.5 * this._scale;
        let oy = 15.5 * this._scale;
        let rows;

        if (canvas.width % 2 !== 0)
            ox = 15 * this._scale;
        if (canvas.height % 2 !== 0)
            oy = 15 * this._scale;

        context.font = '8pt Arial';
        const s = new Date().getTime();
        try {
            if (this._splitArea)
                rows = this._db.prepare('Select X, Y, Rooms.ID as ID, Details, IsDoor, Indoors, IsClosed, Exit, Env, Background FROM Rooms left join exits on Exits.ID = Rooms.ID WHERE Z = $z AND Area = $area AND Zone = $zone AND  ((0 <= (X - $x) AND (X - $x) <= $w) AND (0 <= (Y - $y) AND (Y - $y) <= $h) OR (0 <= (X - $x) AND (X - $x) <= $w) AND (0 <= (Y - $y + 1) AND (Y - $y + 1) <= $h) OR (0 <= (X - $x + 1) AND (X - $x + 1) <= $w) AND (0 <= (Y - $y + 1) AND (Y - $y + 1) <= $h) OR (0 <= (X - $x + 1) AND (X - $x + 1) <= $w) AND (0 <= (Y - $y) AND (Y - $y) <= $h))').all({
                    area: area,
                    zone: zone,
                    x: x - 1,
                    y: y - 1,
                    z: z,
                    w: canvas.width / 32 / this._scale + 1,
                    h: canvas.height / 32 / this._scale + 1
                });
            else
                rows = this._db.prepare('Select X, Y, Rooms.ID as ID, Details, IsDoor, Indoors, IsClosed, Exit, Env, Background FROM Rooms left join exits on Exits.ID = Rooms.ID WHERE Z = $z AND Zone = $zone AND ((0 <= (X - $x) AND (X - $x) <= $w) AND (0 <= (Y - $y) AND (Y - $y) <= $h) OR (0 <= (X - $x) AND (X - $x) <= $w) AND (0 <= (Y - $y + 1) AND (Y - $y + 1) <= $h) OR (0 <= (X - $x + 1) AND (X - $x + 1) <= $w) AND (0 <= (Y - $y + 1) AND (Y - $y + 1) <= $h) OR (0 <= (X - $x + 1) AND (X - $x + 1) <= $w) AND (0 <= (Y - $y) AND (Y - $y) <= $h))').all({
                    zone: zone,
                    x: x - 1,
                    y: y - 1,
                    z: z,
                    w: canvas.width / 32 / this._scale + 1,
                    h: canvas.height / 32 / this._scale + 1
                });
        }
        catch (err) {
            this.emit('error', err);
        }
        this.emit('debug', 'Draw - room query time: ' + (new Date().getTime() - s));
        const d = new Date().getTime();
        if (ex) {
            context.fillStyle = '#eae4d6';
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        else
            context.clearRect(0, 0, canvas.width, canvas.height);
        const rooms = {};
        if (rows) {
            //context.scale(this._scale, this._scale);
            const rl = rows.length;
            for (let r = 0; r < rl; r++) {
                const ID = rows[r].ID;
                if (rooms[ID]) {
                    if (!rows[r].Exit) continue;
                    rooms[ID].exitsID |= RoomExits[rows[r].Exit];
                    rooms[ID].exits[rows[r].Exit] = {
                        isdoor: rows[r].IsDoor,
                        isclosed: rows[r].IsClosed
                    };
                }
                else {
                    rooms[ID] = rows[r];
                    rooms[ID].exits = {};
                    rooms[ID].exitsID = 0;
                    if (!rows[r].Exit) continue;
                    rooms[ID].exitsID |= RoomExits[rows[r].Exit];
                    rooms[ID].exits[rows[r].Exit] = {
                        isdoor: rows[r].IsDoor,
                        isclosed: rows[r].IsClosed
                    };
                }
            }
            this.emit('debug', 'Draw room calculations time: ' + (new Date().getTime() - s));
            let rm;
            for (rm in rooms) {
                if (!rooms.hasOwnProperty(rm)) continue;
                const room = rooms[rm];
                this.DrawRoom(context, (room.X - x) * 32 * this._scale + ox, (room.Y - y) * 32 * this._scale + oy, room, ex, this._scale);
            }
            //context.setTransform(1, 0, 0, 1, 0, 0);
        }
        this.emit('debug', 'Draw - display time: ' + (new Date().getTime() - d));
        this.emit('debug', 'Draw - final time: ' + (new Date().getTime() - s));
        //context.restore();
        this.DrawLegend(context, 1, -4, 0);
        if (callback) callback();
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
        this.doUpdate(UpdateType.draw);
        this.emit('refresh');
    }

    public focusCurrentRoom() {
        if (this.current.ID) {
            this.setActive(copy(this.current));
            this.emit('active-room-changed', copy(this.active));
        }
        this.focusActiveRoom();
    }

    public focusActiveRoom() {
        this.scrollTo(this.active.x + 2, this.active.y + 2);
    }

    public setActive(room) {
        this.active = room;
        this.emit('active-room-changed', copy(this.active));
    }

    public setCurrent(room?: Room) {
        this.emit('path-cleared');
        if (!room || !room.ID) room = this.selected;
        this.current = this.sanitizeRoom(copy(room));
        this.markers = {};
        this.doUpdate(UpdateType.draw);
        this.emit('current-room-changed', this.current);
    }

    public setArea(area: string) {
        this.active.area = area;
        if (this.current.ID !== null && this.current.area === this.active.area) {
            this.setActive(this.sanitizeRoom(copy(this.current)));
            this.focusActiveRoom();
            this.emit('setting-changed', 'active', this.active);
        }
        else {
            try {
                const row = this._db.prepare('SELECT * from Rooms WHERE Area = ? ORDER BY X, Y, Z').get([area]);
                if (row) {
                    this.active = this.normalizeRoom(row);
                    this.setActive(this.active);
                    this.focusActiveRoom();
                    this.emit('setting-changed', 'active', this.active);
                }
            }
            catch (err) {
                this.emit('error', err);
            }
        }
    }

    public setLevel(level: number) {
        if (level !== this.active.z) {
            this.active.z = level;
            this.doUpdate(UpdateType.draw);
            this.emit('setting-changed', 'active', this.active);
        }
    }

    public setZone(zone: number) {
        if (zone !== this.active.zone) {
            this.active.zone = zone;
            this.doUpdate(UpdateType.draw);
            this.emit('setting-changed', 'active', this.active);
        }
    }

    public removeRoom(room) {
        this._db.prepare('DELETE FROM Rooms WHERE ID = ?').run([room.ID]);
        this._db.prepare('DELETE FROM Exits WHERE ID = ?').run([room.ID]);
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
    }

    public clearSelectedRoom() {
        this.removeRoom(this.selected);
    }

    public clearRoom() {
        this.removeRoom(this.current);
    }

    public clearArea() {
        try {
            this._db.prepare('DELETE FROM Exits WHERE ID in (Select ID from Rooms WHERE Area = ?)').run([this.active.area]);
            this._db.prepare('DELETE FROM Rooms WHERE Area = ?').run([this.active.area]);
        }
        catch (err) {
            this.emit('error', err);
        }
        this.emit('clear-area-done', this.active.area);
        this.reset();
        this.refresh();
        this._changed = true;
    }

    public clearAll() {
        try {
            this._db.prepare('DELETE FROM Exits').run();
            this._db.prepare('DELETE FROM Rooms').run();
        }
        catch (err) {
            this.emit('error', err);
        }
        this.emit('clear-done');
        this.reset();
        this.refresh();
        this.focusActiveRoom();
        this._changed = true;
    }

    public processData(data) {
        if (!this.ready) {
            setTimeout(() => {
                this.processData(data);
            }, 10);
            return;
        }
        try {
            const rows = this._db.prepare('Select * FROM Rooms where ID = ?').all('' + data.num);
            let room: Room;
            if (!rows || rows.length === 0) {
                room = {
                    area: '',
                    details: 0,
                    exits: {},
                    name: '',
                    ID: '',
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
                    if (this.roomAreaExists(room.x, room.y, room.z, this.current.zone, this.current.area) || data.prevroom.zone) {
                        room.zone = this.getFreeZone(room.x, room.y, room.z, this.current.zone);
                        this.updateCurrent(room, data);
                        this._changed = true;
                    }
                    else {
                        this.updateCurrent(room, data);
                        this._changed = true;
                    }
                }
                else if (this.roomExists(room.x, room.y, room.z, this.current.zone) || data.prevroom.zone) {
                    room.zone = this.getFreeZone(room.x, room.y, room.z, this.current.zone);
                    this.updateCurrent(room, data);
                    this._changed = true;
                }
                else {
                    this.updateCurrent(room, data);
                    this._changed = true;
                }
            }
            else {
                this.updateCurrent(rows[0], data);
            }
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
        room = this.normalizeRoom(room);
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
        this.addOrUpdateRoom(room);
        this.current.ID = room.ID;
        this.current.area = room.area;
        this.current.x = room.x;
        this.current.y = room.y;
        this.current.z = room.z;
        this.current.zone = room.zone;
        this.emit('current-room-changed', this.current);
        if (this.selected && this.selected.ID === room.ID)
            this.emit('room-selected', copy(room));
        if (this.follow)
            this.focusCurrentRoom();
        else
            this.setActive(copy(this.current));
        this.refresh();
    }

    public getFreeZone(x, y, z, zone) {
        if (!zone) zone = 0;
        const row = this._db.prepare('SELECT DISTINCT Zone FROM Rooms ORDER BY Zone DESC LIMIT 1').get();
        if (!row)
            return zone;
        return row.zone + 1;
    }

    public roomExists(x, y, z, zone) {
        if (!zone) zone = 0;
        const row = this._db.prepare('SELECT DISTINCT Zone FROM Rooms WHERE X = ? AND Y = ? AND Z = ? AND Zone = ? ORDER BY Zone DESC LIMIT 1').get([x, y, z, zone]);
        if (!row)
            return false;
        return true;
    }

    public roomAreaExists(x, y, z, zone, area) {
        if (!zone) zone = 0;
        const row = this._db.prepare('SELECT DISTINCT Zone FROM Rooms WHERE X = ? AND Y = ? AND Z = ? AND Zone = ? AND Area = ? ORDER BY Zone DESC LIMIT 1').get([x, y, z, zone, area]);
        if (!row)
            return false;
        return true;
    }

    public updateRoom(room) {
        if (!this.ready) {
            setTimeout(() => {
                this.updateRoom(room);
            }, 10);
            return;
        }
        room = this.normalizeRoom(room);
        this._db.prepare('BEGIN').run();
        try {
            this._db.prepare('Update Rooms SET Area = ?, Details = ?, Name = ?, Env = ?, X = ?, Y = ?, Z = ?, Zone = ?, Indoors = ? WHERE ID = ?').run(
                [
                    room.area,
                    room.details,
                    room.name,
                    room.env,
                    room.x,
                    room.y,
                    room.z,
                    room.zone,
                    room.indoors,
                    room.ID
                ]);
            this._changed = true;
            this._db.prepare('Delete From Exits WHERE ID = ?').run([room.ID]);
            const stmt = this._db.prepare('INSERT INTO Exits VALUES (?, ?, ?, ?, ?)');
            let exit;
            for (exit in room.exits) {
                if (!room.exits.hasOwnProperty(exit)) continue;
                stmt.run(room.ID, exit, room.exits[exit].num, room.exits[exit].isdoor, room.exits[exit].isclosed);
            }
        }
        catch (err) {
            this.emit('error', err);
            this._db.prepare('ROLLBACK').run();
            return;
        }
        this._db.prepare('COMMIT').run();
        this._changed = true;
    }

    public addOrUpdateRoom(room) {
        if (!this.ready) {
            setTimeout(() => {
                this.addOrUpdateRoom(room);
            }, 10);
            return;
        }
        room = this.normalizeRoom(room);
        this._db.prepare('BEGIN').run();
        try {
            this._db.prepare('INSERT OR REPLACE INTO Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ').run(
                [
                    room.ID,
                    room.area,
                    room.details,
                    room.name,
                    room.env,
                    room.x,
                    room.y,
                    room.z,
                    room.zone,
                    room.indoors,
                    room.background,
                    room.notes
                ]);

            this.refresh();
            this._changed = true;
            const stmt = this._db.prepare('INSERT OR REPLACE INTO Exits VALUES (?, ?, ?, ?, ?)');
            let exit;
            for (exit in room.exits) {
                if (!room.exits.hasOwnProperty(exit)) continue;
                stmt.run(room.ID, exit, room.exits[exit].num, room.exits[exit].isdoor, room.exits[exit].isclosed);
            }
        }
        catch (err) {
            this.emit('error', err);
            this._db.prepare('ROLLBACK').run();
            this.refresh();
            return;
        }
        this._db.prepare('COMMIT').run();
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

    private translate(ctx, amt, scale) {
        if (scale === 2) return;
        //if (scale < 1) {
        const o = amt - amt * scale;
        ctx.translate(amt * scale + o, amt * scale + o);
        /*
    }
    else if (scale % 0.25 === 0)
        ctx.translate(amt, amt);
    else
        ctx.translate(amt * scale, amt * scale);
        */
    }

    public DrawRoom(ctx, x, y, room, ex, scale?) {
        if (!this.$drawCache)
            this.$drawCache = {};
        if (!scale) scale = this._scale;
        const key = (room.Background ? '1' : room.Env) + ',' + room.Indoors + ',' + room.exitsID + ',' + room.Details;

        if (!this.$drawCache[key]) {
            this.$drawCache[key] = document.createElement('canvas');
            this.$drawCache[key].classList.add('map-canvas');
            this.$drawCache[key].height = 32 * scale;
            this.$drawCache[key].width = 32 * scale;
            const tx = this.$drawCache[key].getContext('2d');
            this.translate(tx, 0.5, scale);
            tx.beginPath();
            let f = false;
            if (room.Background) {
                tx.fillStyle = room.Background;
                f = true;
            }
            else if (room.Env) {
                switch (room.Env) {
                    case 'wood':
                        tx.fillStyle = '#966F33';
                        f = true;
                        break;
                    case 'jungle':
                        tx.fillStyle = '#347C2C';
                        f = true;
                        break;
                    case 'forest':
                        tx.fillStyle = '#4E9258';
                        f = true;
                        break;
                    case 'grass':
                    case 'grassland':
                    case 'plains':
                    case 'prairie':
                    case 'savannah':
                        tx.fillStyle = '#4AA02C';
                        f = true;
                        break;
                    case 'desert':
                    case 'dirt':
                    case 'dirtroad':
                    case 'beach':
                    case 'sand':
                    case 'sanddesert':
                        tx.fillStyle = '#C2B280';
                        f = true;
                        break;
                    case 'snow':
                        tx.fillStyle = '#F0F8FF';
                        f = true;
                        break;
                    case 'tundra':
                    case 'icesheet':
                        tx.fillStyle = '#368BC1';
                        f = true;
                        break;
                    case 'underwater':
                    case 'water':
                    case 'lake':
                    case 'river':
                        tx.fillStyle = '#EBF4FA';
                        f = true;
                        break;
                    case 'ocean':
                        tx.fillStyle = '#C2DFFF';
                        f = true;
                        break;
                    case 'bog':
                    case 'city':
                    case 'cliff':
                    case 'highmountain':
                    case 'hills':
                    case 'mountain':
                    case 'swamp':
                        f = false;
                        break;
                    case 'farmland':
                        f = true;
                        tx.fillStyle = '#A9DFBF';
                        break;
                    case 'rockdesert':
                        tx.fillStyle = '#6E2C00';
                        f = true;
                        break;
                    case 'pavedroad':
                        tx.fillStyle = '#D0D3D4';
                        f = true;
                        break;
                    case 'cobble':
                    case 'rocky':
                    case 'stone':
                        tx.fillStyle = '#D5DBDB';
                        f = true;
                        break;
                    default:
                        f = false;
                        break;
                }
            }
            else
                f = false;
            tx.strokeStyle = 'black';
            tx.lineWidth = 0.6 * scale;
            if (!room.Indoors) {
                tx.arc(16 * scale, 16 * scale, 8 * scale, 0, Math.PI * 2, false);
                if (f) tx.fill();
                tx.stroke();
            }
            else {
                if (f) tx.fillRect(8 * scale, 8 * scale, 16 * scale, 16 * scale);
                tx.strokeRect(8 * scale, 8 * scale, 16 * scale, 16 * scale);
            }
            tx.closePath();

            tx.beginPath();
            tx.fillStyle = '#cccccc';
            if (room.exits.north) {
                tx.moveTo(16 * scale, 0 * scale);
                tx.lineTo(16 * scale, 8 * scale);
            }
            else if (this._fillWalls)
                tx.fillRect(9 * scale, 0 * scale, 14 * scale, 4 * scale);
            if (room.exits.northwest) {
                if (!room.Indoors) {
                    tx.moveTo(0 * scale, 0 * scale);
                    tx.lineTo(10 * scale, 10 * scale);
                }
                else {
                    tx.moveTo(0 * scale, 0 * scale);
                    tx.lineTo(8 * scale, 8 * scale);
                }
            }
            else if (this._fillWalls) {
                tx.fillRect(2 * scale, 0 * scale, 2 * scale, 2 * scale);
                tx.fillRect(0 * scale, 2 * scale, 4 * scale, 2 * scale);
                if (!room.exits.north)
                    tx.fillRect(4 * scale, 0 * scale, 5 * scale, 4 * scale);
                if (!room.exits.west)
                    tx.fillRect(0 * scale, 4 * scale, 4 * scale, 5 * scale);
            }
            if (room.exits.northeast) {
                if (!room.Indoors) {
                    tx.moveTo(32 * scale, 0 * scale);
                    tx.lineTo(22 * scale, 10 * scale);
                }
                else {
                    tx.moveTo(32 * scale, 0 * scale);
                    tx.lineTo(24 * scale, 8 * scale);
                }
            }
            else if (this._fillWalls) {
                tx.fillRect(28 * scale, 0 * scale, 2 * scale, 2 * scale);
                tx.fillRect(28 * scale, 2 * scale, 4 * scale, 2 * scale);
                tx.clearRect(30 * scale, 0 * scale, 2 * scale, 2 * scale);
                if (!room.exits.north)
                    tx.fillRect(23 * scale, 0 * scale, 5 * scale, 4 * scale);
                if (!room.exits.east)
                    tx.fillRect(28 * scale, 4 * scale, 4 * scale, 5 * scale);
            }
            if (room.exits.east) {
                tx.moveTo(24 * scale, 16 * scale);
                tx.lineTo(32 * scale, 16 * scale);
            }
            else if (this._fillWalls)
                tx.fillRect(28 * scale, 9 * scale, 4 * scale, 14 * scale);
            if (room.exits.west) {
                tx.moveTo(0 * scale, 16 * scale);
                tx.lineTo(8 * scale, 16 * scale);
            }
            else if (this._fillWalls)
                tx.fillRect(0 * scale, 9 * scale, 4 * scale, 14 * scale);
            if (room.exits.south) {
                tx.moveTo(16 * scale, 24 * scale);
                tx.lineTo(16 * scale, 32 * scale);
            }
            else if (this._fillWalls)
                tx.fillRect(9 * scale, 28 * scale, 14 * scale, 4 * scale);
            if (room.exits.southeast) {
                if (!room.Indoors) {
                    tx.moveTo(32 * scale, 32 * scale);
                    tx.lineTo(22 * scale, 22 * scale);
                }
                else {
                    tx.moveTo(32 * scale, 32 * scale);
                    tx.lineTo(24 * scale, 24 * scale);
                }
            }
            else if (this._fillWalls) {
                tx.fillRect(28 * scale, 28 * scale, 4 * scale, 2 * scale);
                tx.fillRect(28 * scale, 30 * scale, 2 * scale, 2 * scale);
                if (!room.exits.south)
                    tx.fillRect(23 * scale, 28 * scale, 5 * scale, 4 * scale);
                if (!room.exits.east)
                    tx.fillRect(28 * scale, 23 * scale, 4 * scale, 5 * scale);
            }
            if (room.exits.southwest) {
                if (!room.Indoors) {
                    tx.moveTo(0 * scale, 32 * scale);
                    tx.lineTo(10 * scale, 22 * scale);
                }
                else {
                    tx.moveTo(0 * scale, 32 * scale);
                    tx.lineTo(8 * scale, 24 * scale);
                }
            }
            else if (this._fillWalls) {
                tx.fillRect(0 * scale, 28 * scale, 4 * scale, 2 * scale);
                tx.fillRect(2 * scale, 30 * scale, 2 * scale, 2 * scale);
                if (!room.exits.south)
                    tx.fillRect(4 * scale, 28 * scale, 5 * scale, 4 * scale);
                if (!room.exits.west)
                    tx.fillRect(0 * scale, 23 * scale, 4 * scale, 5 * scale);
            }
            tx.closePath();
            tx.stroke();
            tx.fillStyle = 'black';
            tx.strokeStyle = 'black';
            if (room.exits.up) {
                tx.beginPath();
                tx.moveTo(1 * scale, 11 * scale);
                tx.lineTo(7 * scale, 11 * scale);
                tx.lineTo(4 * scale, 8 * scale);
                tx.closePath();
                tx.fill();
            }
            if (room.exits.down) {
                tx.beginPath();
                tx.moveTo(1 * scale, 21 * scale);
                tx.lineTo(7 * scale, 21 * scale);
                tx.lineTo(4 * scale, 24 * scale);
                tx.closePath();
                tx.fill();
            }
            if (room.exits.out) {
                tx.beginPath();
                tx.moveTo(26 * scale, 8 * scale);
                tx.lineTo(29 * scale, 11 * scale);
                tx.lineTo(26 * scale, 14 * scale);
                tx.closePath();
                tx.fill();

            }
            if (room.exits.enter) {
                tx.beginPath();
                tx.moveTo(29 * scale, 19 * scale);
                tx.lineTo(26 * scale, 22 * scale);
                tx.lineTo(29 * scale, 25 * scale);
                tx.closePath();
                tx.fill();
            }
            if ((room.Details & RoomDetails.Dock) === RoomDetails.Dock) {
                tx.fillStyle = 'chocolate';
                tx.beginPath();
                tx.arc(20 * scale, 5 * scale, 2 * scale, 0, Math.PI * 2);
                tx.fill();
                tx.closePath();
            }
            else if ((room.Details & RoomDetails.Pier) === RoomDetails.Pier) {
                tx.fillStyle = 'gray';
                tx.beginPath();
                tx.arc(12 * scale, 5 * scale, 2 * scale, 0, Math.PI * 2);
                tx.fill();
                tx.closePath();
            }
            if ((room.Details & RoomDetails.WaterSource) === RoomDetails.WaterSource) {
                tx.fillStyle = 'aqua';
                tx.beginPath();
                tx.arc(12 * scale, 5 * scale, 2 * scale, 0, Math.PI * 2);
                tx.fill();
                tx.closePath();
            }
            tx.scale(scale, scale);
            if ((room.Details & RoomDetails.Bank) === RoomDetails.Bank) {
                tx.fillStyle = 'goldenrod';
                tx.beginPath();
                tx.fillText('$', 9, 17);
                tx.closePath();
            }
            if ((room.Details & RoomDetails.Shop) === RoomDetails.Shop) {
                tx.fillStyle = 'purple';
                tx.beginPath();
                tx.fillText('\u23CF', 15, 17);
                tx.closePath();
            }
            if ((room.Details & RoomDetails.Hospital) === RoomDetails.Hospital) {
                tx.fillStyle = 'blue';
                tx.beginPath();
                tx.fillText('\u2665', 15, 17);
                tx.closePath();
            }
            if ((room.Details & RoomDetails.Trainer) === RoomDetails.Trainer) {
                tx.fillStyle = 'red';
                tx.beginPath();
                tx.fillText('\u260D', 15, 17);
                tx.closePath();
            }
            if ((room.Details & RoomDetails.Stable) === RoomDetails.Stable) {
                tx.fillStyle = 'rgb(153, 102, 0)';
                tx.beginPath();
                tx.fillText('\u2658', 7, 17);
                tx.closePath();
            }
            if ((room.Details & RoomDetails.Restaurant) === RoomDetails.Restaurant && (room.Details & RoomDetails.Bar) === RoomDetails.Bar) {
                tx.fillStyle = 'green';
                tx.beginPath();
                tx.fillText('\u2617', 15, 17);
                tx.closePath();
            }
            else if ((room.Details & RoomDetails.Bar) === RoomDetails.Bar) {
                tx.fillStyle = 'green';
                tx.beginPath();
                tx.fillText('\u266A', 15, 17);
                tx.closePath();
            }
            else if ((room.Details & RoomDetails.Restaurant) === RoomDetails.Restaurant) {
                tx.fillStyle = 'green';
                tx.beginPath();
                tx.fillText('\u2616', 15, 17);
                tx.closePath();
            }
            tx.setTransform(1, 0, 0, 1, 0, 0);
            this.translate(tx, -0.5, scale);
        }
        //this.translate(ctx, -0.5, scale);
        ctx.drawImage(this.$drawCache[key], x | 0, y | 0);
        //this.translate(ctx, 0.5, scale);
        this.DrawDoor(ctx, x + 12 * scale, y - 2 * scale, 8 * scale, 3 * scale, room.exits.north);
        this.DrawDoor(ctx, x + 31 * scale, y + 12 * scale, 3 * scale, 8 * scale, room.exits.east);
        this.DrawDoor(ctx, x - 1 * scale, y + 12 * scale, 3 * scale, 8 * scale, room.exits.west);
        this.DrawDoor(ctx, x + 12 * scale, y + 30 * scale, 8 * scale, 3 * scale, room.exits.south);
        this.DrawDDoor(ctx, x, y, 5 * scale, 5 * scale, room.exits.northwest);
        this.DrawDDoor(ctx, x + 32 * scale, y, -5 * scale, 5 * scale, room.exits.northeast);
        this.DrawDDoor(ctx, x + 32 * scale, y + 32 * scale, -5 * scale, -5 * scale, room.exits.southeast);
        this.DrawDDoor(ctx, x, y + 32 * scale, 5 * scale, -5 * scale, room.exits.southwest);

        if (!ex && this.selected.ID === room.ID) {
            if (this.$focused) {
                ctx.fillStyle = 'rgba(135, 206, 250, 0.5)';
                ctx.strokeStyle = 'LightSkyBlue';
            }
            else {
                ctx.fillStyle = 'rgba(142, 142, 142, 0.5)';
                ctx.strokeStyle = 'rgba(142, 142, 142, 0.5)';
            }
            ctx.fillRoundedRect(x, y, 32 * scale, 32 * scale, 8 * scale);
            ctx.strokeRoundedRect(x, y, 32 * scale, 32 * scale, 8 * scale);
        }
        if (this.markers[room.ID] === 2)
            this.drawMarker(ctx, x, y, 'green', scale);
        else if (this.markers[room.ID] === 3)
            this.drawMarker(ctx, x, y, 'blue', scale);
        else if (this.markers[room.ID])
            this.drawMarker(ctx, x, y, 'yellow', scale);
        if (!ex && room.ID === this.current.ID)
            this.drawMarker(ctx, x, y, 'red', scale);
    }

    public DrawNormalizedRoom(ctx, x, y, room, ex, scale?) {
        ctx.beginPath();
        let f = false;
        if (!scale) scale = this._scale;
        this.translate(ctx, 0.5, scale);
        const ox = x;
        const oy = y;
        x = x | 0;
        y = y | 0;
        if (room.background) {
            ctx.fillStyle = room.background;
            f = true;
        }
        else if (room.env) {
            switch (room.env) {
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
        ctx.lineWidth = 0.6 * scale;
        if (!room.indoors) {
            ctx.arc(x + 16 * scale, y + 16 * scale, 8.5 * scale, 0, Math.PI * 2, false);
            if (f) ctx.fill();
            ctx.stroke();
        }
        else {
            if (f) ctx.fillRect(x + 8 * scale, y + 8 * scale, 16 * scale, 16 * scale);
            ctx.strokeRect(x + 8 * scale, y + 8 * scale, 16 * scale, 16 * scale);
        }
        ctx.closePath();
        ctx.beginPath();
        ctx.fillStyle = '#cccccc';
        if (room.exits.north) {
            ctx.moveTo(x + 16 * scale, y);
            ctx.lineTo(x + 16 * scale, y + 8 * scale);
        }
        else if (this._fillWalls)
            ctx.fillRect(x + 9 * scale, y, 14.5 * scale, 4.5 * scale);
        if (room.exits.northwest) {
            if (!room.indoors) {
                ctx.moveTo(x, y);
                ctx.lineTo(x + 10 * scale, y + 10 * scale);
            }
            else {
                ctx.moveTo(x, y);
                ctx.lineTo(x + 8 * scale, y + 8 * scale);
            }
        }
        else if (this._fillWalls) {
            ctx.fillRect(x + 2 * scale, y, 2.5 * scale, 2.5 * scale);
            ctx.fillRect(x, y + 2 * scale, 4.5 * scale, 2.6 * scale);
            if (!room.exits.north)
                ctx.fillRect(x + 4 * scale, y, 5.5 * scale, 4.5 * scale);
            if (!room.exits.west)
                ctx.fillRect(x, y + 4 * scale, 4.5 * scale, 5.5 * scale);
        }
        if (room.exits.northeast) {
            if (!room.indoors) {
                ctx.moveTo(x + 32 * scale, y);
                ctx.lineTo(x + 22 * scale, y + 10 * scale);
            }
            else {
                ctx.moveTo(x + 32 * scale, y);
                ctx.lineTo(x + 24 * scale, y + 8 * scale);
            }
        }
        else if (this._fillWalls) {
            ctx.fillRect(x + 28 * scale, y, 2.5 * scale, 2.5 * scale);
            ctx.fillRect(x + 28 * scale, y + 2 * scale, 4.5 * scale, 2.5 * scale);
            ctx.clearRect(x + 30 * scale, y, 2 * scale, 2 * scale);
            if (!room.exits.north)
                ctx.fillRect(x + 23 * scale, y, 5.5 * scale, 4.5 * scale);
            if (!room.exits.east)
                ctx.fillRect(x + 28 * scale, y + 4 * scale, 4.5 * scale, 5.5 * scale);
        }
        if (room.exits.east) {
            ctx.moveTo(x + 24 * scale, y + 16 * scale);
            ctx.lineTo(x + 32 * scale, y + 16 * scale);
        }
        else if (this._fillWalls)
            ctx.fillRect(x + 28 * scale, y + 9 * scale, 4.5 * scale, 14.5 * scale);
        if (room.exits.west) {
            ctx.moveTo(x, y + 16 * scale);
            ctx.lineTo(x + 8 * scale, y + 16 * scale);
        }
        else if (this._fillWalls)
            ctx.fillRect(x, y + 9 * scale, 4.5 * scale, 14.5 * scale);
        if (room.exits.south) {
            ctx.moveTo(x + 16 * scale, y + 24 * scale);
            ctx.lineTo(x + 16 * scale, y + 32 * scale);
        }
        else if (this._fillWalls)
            ctx.fillRect(x + 9 * scale, y + 28 * scale, 14.5 * scale, 4.5 * scale);
        if (room.exits.southeast) {
            if (!room.Indoors) {
                ctx.moveTo(x + 32 * scale, y + 32 * scale);
                ctx.lineTo(x + 22 * scale, y + 22 * scale);
            }
            else {
                ctx.moveTo(x + 32 * scale, y + 32 * scale);
                ctx.lineTo(x + 24 * scale, y + 24 * scale);
            }
        }
        else if (this._fillWalls) {
            ctx.fillRect(x + 28 * scale, y + 28 * scale, 4.5 * scale, 2.5 * scale);
            ctx.fillRect(x + 28 * scale, y + 30 * scale, 2.5 * scale, 2.5 * scale);
            if (!room.exits.south)
                ctx.fillRect(x + 23 * scale, y + 28 * scale, 5.5 * scale, 4.5 * scale);
            if (!room.exits.east)
                ctx.fillRect(x + 28 * scale, y + 23 * scale, 4.5 * scale, 5.5 * scale);
        }
        if (room.exits.southwest) {
            if (!room.indoors) {
                ctx.moveTo(x, y + 32 * scale);
                ctx.lineTo(x + 10 * scale, y + 22 * scale);
            }
            else {
                ctx.moveTo(x, y + 32 * scale);
                ctx.lineTo(x + 8 * scale, y + 24 * scale);
            }
        }
        else if (this._fillWalls) {
            ctx.fillRect(x, y + 28 * scale, 4.5 * scale, 2.5 * scale);
            ctx.fillRect(x + 2 * scale, y + 30 * scale, 2.5 * scale, 2.5 * scale);
            if (!room.exits.south)
                ctx.fillRect(x + 4 * scale, y + 28 * scale, 5.5, 4.5 * scale);
            if (!room.exits.west)
                ctx.fillRect(x, y + 23 * scale, 4.5 * scale, 5.5 * scale);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'black';
        if (room.exits.up) {
            ctx.beginPath();
            ctx.moveTo(x + 1 * scale, y + 11 * scale);
            ctx.lineTo(x + 7 * scale, y + 11 * scale);
            ctx.lineTo(x + 4 * scale, y + 8 * scale);
            ctx.closePath();
            ctx.fill();
        }
        if (room.exits.down) {
            ctx.beginPath();
            ctx.moveTo(x + 1 * scale, y + 21 * scale);
            ctx.lineTo(x + 7 * scale, y + 21 * scale);
            ctx.lineTo(x + 4 * scale, y + 24 * scale);
            ctx.closePath();
            ctx.fill();
        }
        if (room.exits.out) {
            ctx.beginPath();
            ctx.moveTo(x + 26 * scale, y + 8 * scale);
            ctx.lineTo(x + 29 * scale, y + 11 * scale);
            ctx.lineTo(x + 26 * scale, y + 14 * scale);
            ctx.closePath();
            ctx.fill();

        }
        if (room.exits.enter) {
            ctx.beginPath();
            ctx.moveTo(x + 29 * scale, y + 19 * scale);
            ctx.lineTo(x + 26 * scale, y + 22 * scale);
            ctx.lineTo(x + 29 * scale, y + 25 * scale);
            ctx.closePath();
            ctx.fill();
        }
        this.translate(ctx, -0.5, scale);
        x = ox;
        y = oy;
        this.DrawDoor(ctx, x + 12 * scale, y - 2 * scale, 8 * scale, 3 * scale, room.exits.north);
        this.DrawDoor(ctx, x + 31 * scale, y + 12 * scale, 3 * scale, 8 * scale, room.exits.east);
        this.DrawDoor(ctx, x - 1 * scale, y + 12 * scale, 3 * scale, 8 * scale, room.exits.west);
        this.DrawDoor(ctx, x + 12 * scale, y + 30 * scale, 8 * scale, 3 * scale, room.exits.south);
        this.DrawDDoor(ctx, x, y, 5 * scale, 5 * scale, room.exits.northwest);
        this.DrawDDoor(ctx, x + 32 * scale, y, -5 * scale, 5 * scale, room.exits.northeast);
        this.DrawDDoor(ctx, x + 32 * scale, y + 32 * scale, -5 * scale, -5 * scale, room.exits.southeast);
        this.DrawDDoor(ctx, x, y + 32 * scale, 5 * scale, -5 * scale, room.exits.southwest);
        if ((room.details & RoomDetails.Dock) === RoomDetails.Dock) {
            ctx.fillStyle = 'chocolate';
            ctx.beginPath();
            ctx.arc(x + 20 * scale, y + 5 * scale, 2 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        }
        else if ((room.details & RoomDetails.Pier) === RoomDetails.Pier) {
            ctx.fillStyle = 'gray';
            ctx.beginPath();
            ctx.arc(x + 12 * scale, y + 5 * scale, 2 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        }
        if ((room.details & RoomDetails.WaterSource) === RoomDetails.WaterSource) {
            ctx.fillStyle = 'aqua';
            ctx.beginPath();
            ctx.arc(x + 12 * scale, y + 5 * scale, 2 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        }
        ctx.scale(scale, scale);
        x /= scale;
        y /= scale;
        if ((room.details & RoomDetails.Bank) === RoomDetails.Bank) {
            ctx.fillStyle = 'goldenrod';
            ctx.beginPath();
            ctx.fillText('$', x + 9, y + 17);
            ctx.closePath();
        }
        if ((room.details & RoomDetails.Shop) === RoomDetails.Shop) {
            ctx.fillStyle = 'purple';
            ctx.beginPath();
            ctx.fillText('\u23CF', x + 15, y + 17);
            ctx.closePath();
        }
        if ((room.details & RoomDetails.Hospital) === RoomDetails.Hospital) {
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.fillText('\u2665', x + 15, y + 17);
            ctx.closePath();
        }
        if ((room.details & RoomDetails.Trainer) === RoomDetails.Trainer) {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.fillText('\u260D', x + 15, y + 17);
            ctx.closePath();
        }
        if ((room.details & RoomDetails.Stable) === RoomDetails.Stable) {
            ctx.fillStyle = 'rgb(153, 102, 0)';
            ctx.beginPath();
            ctx.fillText('\u2658', x + 7, y + 17);
            ctx.closePath();
        }
        if ((room.details & RoomDetails.Restaurant) === RoomDetails.Restaurant && (room.details & RoomDetails.Bar) === RoomDetails.Bar) {
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.fillText('\u2617', x + 15, y + 17);
            ctx.closePath();
        }
        else if ((room.details & RoomDetails.Bar) === RoomDetails.Bar) {
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.fillText('\u266A', x + 15, y + 17);
            ctx.closePath();
        }
        else if ((room.details & RoomDetails.Restaurant) === RoomDetails.Restaurant) {
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.fillText('\u2616', x + 15, y + 17);
            ctx.closePath();
        }
        x = ox;
        y = oy;
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (!ex && this.selected.ID === room.ID) {
            ctx.fillStyle = 'rgba(135, 206, 250, 0.5)';
            ctx.strokeStyle = 'LightSkyBlue';
            ctx.fillRoundedRect(x, y, 32 * scale, 32 * scale, 8 * scale);
            ctx.strokeRoundedRect(x, y, 32 * scale, 32 * scale, 8 * scale);
        }
        if (this.markers[room.ID] === 2)
            this.drawMarker(ctx, x, y, 'green', scale);
        else if (this.markers[room.ID] === 3)
            this.drawMarker(ctx, x, y, 'blue', scale);
        else if (this.markers[room.ID])
            this.drawMarker(ctx, x, y, 'yellow', scale);
        if (!ex && room.ID === this.current.ID)
            this.drawMarker(ctx, x, y, 'red', scale);
    }

    public drawMarker(ctx, x, y, color, scale) {
        if (!color) color = 'yellow';
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.strokeStyle = 'black';
        ctx.arc(x + 16 * scale, y + 16 * scale, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }

    public DrawDoor(ctx, x, y, w, h, exit) {
        if (!exit || !exit.isdoor) return;
        ctx.beginPath();
        ctx.clearRect(x, y, w, h);
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'black';
        /*
        if (exit.islocked) {
            ctx.fillStyle = 'red';
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }
        else
        */
        if (exit.isclosed)
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
        /*
        if (exit.islocked) {
            ctx.fillStyle = 'red';
            ctx.fill();
            ctx.stroke();
        }
        else
        */
        if (exit.isclosed)
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
        if (!this.ready) {
            setTimeout(() => {
                this.getRoom(id, callback);
            }, 10);
            return;
        }
        try {
            const rows = this._db.prepare('Select * FROM Rooms left join exits on Exits.ID = Rooms.ID WHERE Rooms.ID = $id').all({
                id: id
            });
            const rooms = {};
            if (rows) {
                const rl = rows.length;
                for (let r = 0; r < rl; r++) {
                    if (rooms[rows[r].ID]) {
                        if (!rows[r].Exit) continue;
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        };
                    }
                    else {
                        rooms[rows[r].ID] = copy(rows[r]);
                        rooms[rows[r].ID].exits = {};
                        if (!rows[r].Exit) continue;
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        };
                    }
                }
                if (callback) callback(this.normalizeRoom(rooms[rows[0].ID]));
            }
        }
        catch (err) {
            this.emit('error', err);
        }
    }

    public getRooms(area, level, zone, callback) {
        if (!this.ready) {
            setTimeout(() => {
                this.getRooms(area, level, zone, callback);
            }, 10);
            return;
        }
        let rows;
        try {
            if (this._splitArea)
                rows = this._db.prepare('Select * FROM Rooms left join exits on Exits.ID = Rooms.ID WHERE Z = $z AND Area = $area AND Zone = $zone').all({
                    area: area,
                    zone: zone,
                    z: level
                });
            else
                rows = this._db.prepare('Select * FROM Rooms left join exits on Exits.ID = Rooms.ID WHERE Z = $z AND Zone = $zone').all({
                    zone: zone,
                    z: level
                });
        }
        catch (err) {
            this.emit('error', err);
        }
        const rooms = {};
        if (rows) {
            const rl = rows.length;
            for (let r = 0; r < rl; r++) {
                if (rooms[rows[r].ID]) {
                    if (!rows[r].Exit) continue;
                    rooms[rows[r].ID].exits[rows[r].Exit] = {
                        num: rows[r].DestID,
                        isdoor: rows[r].IsDoor,
                        isclosed: rows[r].IsClosed
                    };
                }
                else {
                    rooms[rows[r].ID] = this.normalizeRoom(rows[r]);
                    rooms[rows[r].ID].exits = {};
                    if (!rows[r].Exit) continue;
                    rooms[rows[r].ID].exits[rows[r].Exit] = {
                        num: rows[r].DestID,
                        isdoor: rows[r].IsDoor,
                        isclosed: rows[r].IsClosed
                    };
                }
            }
        }
        if (callback) callback(rooms);
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
            const roomsC: Room[][] = [];
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
                    ox = room.x;
                    w = room.x + 1;
                    oy = room.y;
                    h = room.y + 1;
                    continue;
                }
                if (room.x < ox) ox = room.x; else if (room.x > w) w = room.x;
                if (room.y < oy) oy = room.y; else if (room.y > h) h = room.y;
            }

            for (id in rooms) {
                if (!rooms.hasOwnProperty(id)) continue;
                room = rooms[id];
                if (room == null) continue;
                if (!roomsC[room.y - oy]) roomsC[room.y - oy] = [];
                roomsC[room.y - oy][room.x - ox] = room;
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
                x = (room.x - ox);
                y = (room.y - oy);
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
            this.doUpdate(UpdateType.draw);
        });
    }

    public clearPath() {
        this.emit('path-cleared');
        this.markers = {};
        this.doUpdate(UpdateType.draw);
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
            const roomsC: Room[][] = [];
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
                    ox = room.x;
                    w = room.x + 1;
                    oy = room.y;
                    h = room.y + 1;
                    continue;
                }
                if (room.x < ox) ox = room.x; else if (room.x > w) w = room.x;
                if (room.y < oy) oy = room.y; else if (room.y > h) h = room.y;
            }

            for (id in rooms) {
                if (!rooms.hasOwnProperty(id)) continue;
                room = rooms[id];
                if (room == null) continue;
                if (!roomsC[room.y - oy]) roomsC[room.y - oy] = [];
                roomsC[room.y - oy][room.y - ox] = room;
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
                x = (room.x - ox);
                y = (room.y - oy);
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
            try {
                this._db.prepare('DELETE FROM Exits').run();
                this._db.prepare('DELETE FROM Rooms').run();
            }
            catch (err) {
                this.emit('error', err);
            }
            this.emit('clear-done');
            this.reset();
        }
        this._cancelImport = false;
        let idx;
        let r;
        let rl;
        let tl;
        this._db.prepare('BEGIN').run();
        this.emit('import-progress', 0);
        try {
            const stmt2 = this._db.prepare('INSERT OR REPLACE INTO Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            const stmt = this._db.prepare('INSERT OR REPLACE INTO Exits VALUES (?, ?, ?, ?, ?)');
            if (!Array.isArray(data))
                data = Object.values(data);
            rl = data.length;
            tl = data.length;
            idx = 1;
            let room;
            for (r = 0; r < rl; r++) {
                if (this._cancelImport) {
                    this._db.prepare('ROLLBACK').run();
                    this.finishImport();
                    this.emit('import-complete');
                    return;
                }
                room = data[r];
                if (!room) continue;
                tl += Object.keys(room.exits).length;
                room = this.normalizeRoom(room);
                stmt2.run([
                    room.ID,
                    room.area,
                    room.details,
                    room.name,
                    room.env,
                    room.x,
                    room.y,
                    room.z,
                    room.zone,
                    room.indoors,
                    room.background
                ]);
                if (this._cancelImport) {
                    this._db.prepare('ROLLBACK').run();
                    this.finishImport();
                    this.emit('import-complete');
                    return;
                }
                this.emit('import-progress', Math.floor(idx / tl * 100));
                idx++;
                let exit;
                const exits = room.exits;
                for (exit in exits) {
                    if (!exits.hasOwnProperty(exit)) continue;
                    stmt.run([room.ID, exit, exits[exit].num, exits[exit].isdoor, exits[exit].isclosed]);
                    if (this._cancelImport) {
                        this._db.prepare('ROLLBACK').run();
                        this.finishImport();
                        this.emit('import-complete');
                        return;
                    }
                    this.emit('import-progress', Math.floor(idx / tl * 100));
                    idx++;
                }
            }
            this._cancelImport = true;
        }
        catch (err) {
            this.emit('error', err);
            this._db.prepare('ROLLBACK').run();
            this.finishImport();
            this.emit('import-complete');
            return;
        }
        this._db.prepare('COMMIT').run();
        this.finishImport();
        this.emit('import-complete');
    }

    private finishImport() {
        this.refresh();
        this.focusActiveRoom();
        this._changed = true;
    }

    public exportArea(file: string) {
        let rows;
        try {
            rows = this._db.prepare('Select * FROM Rooms left join exits on Exits.ID = Rooms.ID WHERE Area = $area').all({
                area: this.active.area || ''
            });
        }
        catch (err) {
            this.emit('error', err);
        }
        const rooms = {};
        if (rows) {
            this._cancelImport = false;
            const rl = rows.length;
            this.emit('import-progress', 0);
            for (let r = 0; r < rl; r++) {
                if (this._cancelImport) {
                    this.emit('import-complete');
                    return;
                }
                rows[r].ID = parseInt(rows[r].ID, 10);
                if (rooms[rows[r].ID]) {
                    if (!rows[r].Exit) continue;
                    rooms[rows[r].ID].exits[rows[r].Exit] = {
                        num: parseInt(rows[r].DestID, 10),
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
                    if (!rows[r].Exit) continue;
                    rooms[rows[r].ID].exits[rows[r].Exit] = {
                        num: parseInt(rows[r].DestID, 10),
                        isdoor: rows[r].IsDoor,
                        isclosed: rows[r].IsClosed
                    };
                }
                this.emit('import-progress', Math.floor(r / rl * 100));
            }
            this.exportRooms(file, rooms);
        }
        this._cancelImport = false;
        this.emit('import-complete');
    }

    public exportAll(file: string) {
        let rows;
        try {
            rows = this._db.prepare('Select * FROM Rooms left join exits on Exits.ID = Rooms.ID').all();
        }
        catch (err) {
            this.emit('error', err);
        }
        const rooms = {};
        this._cancelImport = false;
        if (rows) {
            const rl = rows.length;
            this.emit('import-progress', 0);
            for (let r = 0; r < rl; r++) {
                if (this._cancelImport) {
                    this.emit('import-complete');
                    return;
                }
                rows[r].ID = parseInt(rows[r].ID, 10);
                if (rooms[rows[r].ID]) {
                    if (!rows[r].Exit) continue;
                    rooms[rows[r].ID].exits[rows[r].Exit] = {
                        num: parseInt(rows[r].DestID, 10),
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
                    if (!rows[r].Exit) continue;
                    rooms[rows[r].ID].exits[rows[r].Exit] = {
                        num: parseInt(rows[r].DestID, 10),
                        isdoor: rows[r].IsDoor,
                        isclosed: rows[r].IsClosed
                    };
                }
                this.emit('import-progress', Math.floor(r / rl * 100));
            }
            this.exportRooms(file, rooms);
        }
        this._cancelImport = false;
        this.emit('import-complete');
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
        if (this._cancelImport)
            return;
        this._cancelImport = true;
        this.emit('import-progress', 101);
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
                    ATTACH DATABASE '${this._mapFile}' as Disk;
                    PRAGMA Disk.synchronous=OFF;PRAGMA temp_store=MEMORY;PRAGMA threads = 4;
                    PRAGMA Disk.journal_mode=OFF;
                    PRAGMA Main.journal_mode=OFF;
                    CREATE TABLE IF NOT EXISTS Disk.Rooms (ID TEXT PRIMARY KEY ASC, Area TEXT, Details INTEGER, Name TEXT, Env TEXT, X INTEGER, Y INTEGER, Z INTEGER, Zone INTEGER, Indoors INTEGER, Background TEXT, Notes TEXT);
                    CREATE TABLE IF NOT EXISTS Disk.Exits (ID TEXT, Exit TEXT, DestID TEXT, IsDoor INTEGER, IsClosed INTEGER);
                    BEGIN TRANSACTION;
                    DELETE FROM Disk.Rooms;
                    INSERT INTO Disk.Rooms (ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes) SELECT ID, Area, Details, Name, Env, X, Y, Z, Zone, Indoors, Background, Notes FROM Rooms;
                    DELETE FROM Disk.Exits;
                    INSERT INTO Disk.Exits (ID, Exit, DestID, IsDoor, IsClosed) SELECT ID, Exit, DestID, IsDoor, IsClosed FROM Exits;
                    COMMIT TRANSACTION;
                    CREATE UNIQUE INDEX IF NOT EXISTS Disk.index_id on Rooms (ID);
                    CREATE INDEX IF NOT EXISTS Disk.coords_zone on Rooms (X,Y,Z,Zone);
                    CREATE INDEX IF NOT EXISTS Disk.coords_area on Rooms (X,Y,Z,Zone,Area);
                    CREATE INDEX IF NOT EXISTS Disk.exits_id on Exits (ID);
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

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
            if ((this._updating & UpdateType.draw) === UpdateType.draw) {
                this.draw();
                this._updating &= ~UpdateType.draw;
            }
            this.doUpdate(this._updating);
        });
    }

    private normalizeRoom(r) {
        const id = r.ID || r.num;
        const room = {
            area: r.Area || r.area || '',
            details: r.Details || r.details || RoomDetails.None,
            name: r.Name || r.name || '',
            env: r.Env || r.env || r.environment || '',
            x: +r.X || +r.x || 0,
            y: +r.Y || +r.y || 0,
            z: +r.Z || +r.z || 0,
            zone: +r.Zone || +r.zone || 0,
            indoors: +r.Indoors || +r.indoors || 0,
            background: r.Background || r.background || '',
            notes: r.Notes || r.notes || '',
            ID: id ? '' + id : null,
            exits: r.exits || {}
        };
        if (room.exits) {
            let exit;
            let dest;
            for (exit in room.exits) {
                if (!room.exits.hasOwnProperty(exit)) continue;
                dest = room.exits[exit].DestID || room.exits[exit].num || null;
                room.exits[exit] = {
                    num: dest ? '' + dest : null,
                    isdoor: +room.exits[exit].IsDoor || +room.exits[exit].isdoor || null,
                    isclosed: +room.exits[exit].IsClosed || +room.exits[exit].isclosed || null
                };
            }
        }
        return room;
    }

    private setFocus(value) {
        if (this.$focused === value) return;
        this.$focused = value;
        this.doUpdate(UpdateType.draw);
    }
}