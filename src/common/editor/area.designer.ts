import { DebugTimer, EditorBase, EditorOptions, FileState } from './editor.base';
import { Splitter, Orientation } from '../splitter';
import { PropertyGrid } from '../propertygrid';
import { EditorType, ValueEditor } from '../value.editors';
import { DataGrid } from '../datagrid';
import { copy, formatString, existsSync, capitalize, wordwrap, Cardinal, enumToString, pinkfishToHTML, stripPinkfish, consolidate, parseTemplate, initEditDropdown } from '../library';
const ResizeObserver = require('resize-observer-polyfill');
const { clipboard, remote } = require('electron');
const { Menu, MenuItem, dialog } = remote;
const path = require('path');
const fs = require('fs-extra');
import { Wizard, WizardPage } from '../Wizard';
import { MousePosition, RoomExits, shiftType, FileBrowseValueEditor, RoomExit } from './virtual.editor';

import RGBColor = require('rgbcolor');

interface AreaDesignerOptions extends EditorOptions {
    width?: number;
    height?: number;
    depth?: number;
}

declare global {
    interface Window {
        $roomImg: HTMLImageElement;
        $roomImgLoaded: boolean;
    }
}

export enum RoomFlags {
    Melee_As_Ability = 1 << 17,
    No_Dirt = 1 << 16,
    Enable_Pk = 1 << 15,
    No_Forage = 1 << 14,
    Hide_Exits = 1 << 13,
    No_Map_Send = 1 << 12,
    Explored = 1 << 11,
    No_Teleport = 1 << 10,
    No_Attack = 1 << 9,
    No_Magic = 1 << 8,
    Council = 1 << 7,
    No_Scry = 1 << 6,
    Indoors = 1 << 5,
    Water = 1 << 4,
    Hot = 1 << 3,
    Cold = 1 << 2,
    Sinking_Up = 1 << 1,
    Sinking_Down = 1 << 0,
    None = 0
}

export enum MonsterFlags {
    None = 0,
    Ridable = 1 << 0,
    Flying = 1 << 1,
    Getable = 1 << 2,
    Undead = 1 << 3,
    Water_Breathing = 1 << 4,
    Requires_Water = 1 << 5,
    No_Bleeding = 1 << 6,
    Auto_Stand = 1 << 7,
    Drop_encumbered = 1 << 8,
    Drop_encumbered_combat = 1 << 9
}

export const RoomTypes = [
    { value: 'STD_ROOM', display: 'Standard', group: 'Standard' },
    { value: 'ROOMTYPE_ADVANCE_ROOM', display: 'Advance room', group: 'Standard' },
    { value: 'ROOMTYPE_BANK', display: 'Bank', group: 'Standard' },
    { value: 'ROOMTYPE_CLASS_JOIN', display: 'Class join', group: 'Standard' },
    { value: 'ROOMTYPE_CLIMB', display: 'Climb', group: 'Standard' },
    { value: 'ROOMTYPE_DOCK', display: 'Dock', group: 'Standard' },
    { value: 'ROOMTYPE_GUILD_HALL', display: 'Guild hall', group: 'Standard' },
    { value: 'ROOMTYPE_INN', display: 'Inn', group: 'Standard' },
    { value: 'ROOMTYPE_LIBRARY', display: 'Library', group: 'Standard' },
    { value: 'ROOMTYPE_LOCKER', display: 'Locker', group: 'Standard' },
    { value: 'ROOMTYPE_MODROOM', display: 'Mod room', group: 'Standard' },
    { value: 'ROOMTYPE_PIER', display: 'Pier', group: 'Standard' },
    { value: 'ROOMTYPE_SAGE', display: 'Sage', group: 'Standard' },
    { value: 'ROOMTYPE_SINK_ROOM', display: 'Sink', group: 'Standard' },
    { value: 'ROOMTYPE_SKY_ROOM', display: 'Sky', group: 'Standard' },
    { value: 'ROOMTYPE_STABLE', display: 'Stable', group: 'Standard' },
    { value: 'ROOMTYPE_TRAIN_ROOM', display: 'Train', group: 'Standard' },
    { value: 'ROOMTYPE_VAULT', display: 'Vault', group: 'Standard' },
    { value: 'ROOMTYPE_VENDOR_STORAGE', display: 'Vendor storage', group: 'Standard' }
];

export const MonsterTypes = [
    { value: 'STD_MONSTER', display: 'Standard', group: 'Standard' },
    { value: 'MONTYPE_ARMOR_REPAIR', display: 'Armor Repair', group: 'Standard' },
    { value: 'MONTYPE_BARKEEP', display: 'Barkeep', group: 'Standard' },
    { value: 'MONTYPE_CLERIC_TRAINER', display: 'Cleric Trainer', group: 'Standard' },
    { value: 'MONTYPE_SUBCLASSER', display: 'Command Trainer', group: 'Standard' },
    { value: 'MONTYPE_HEALER', display: 'Healer', group: 'Standard' },
    { value: 'MONTYPE_JEWELER', display: 'Jeweler', group: 'Standard' },
    { value: 'MONTYPE_LOCKPICK_REPAIR', display: 'Lock pick Repair', group: 'Standard' },
    { value: 'MONTYPE_MAGE_TRAINER', display: 'Mage Trainer', group: 'Standard' },
    { value: 'MONTYPE_MON_EDIBLE', display: 'Edible Monster', group: 'Standard' },
    { value: 'MONTYPE_SAGE_NPC', display: 'Sage', group: 'Standard' },
    { value: 'MONTYPE_SKILL_TRAINER', display: 'Skill Trainer', group: 'Standard' },
    { value: 'MONTYPE_SMITH', display: 'Smith', group: 'Standard' },
    { value: 'MONTYPE_SUMMON_MOB', display: 'Summon Monster', group: 'Standard' },
    { value: 'MONTYPE_TATTOOIST', display: 'Tattooist', group: 'Standard' },
    { value: 'MONTYPE_CMD_TRAIN_NPC', display: 'Trainer', group: 'Standard' },
    { value: 'MONTYPE_VENDOR', display: 'Vendor', group: 'Standard' },
    { value: 'MONTYPE_WEAPON_REPAIR', display: 'Weapon Repair', group: 'Standard' }
];

export enum UpdateType { none = 0, drawMap = 1, buildMap = 2, resize = 4, status = 8 }

interface ObjectInfo {
    id: number;
    amount?: number;
    maxAmount?: number;
    random?: boolean;
    unique?: boolean;
}

interface RoomItem {
    item: string;
    description: string;
}

class Exit {
    public exit: string = '';
    public dest: string = '';
    public door: string = '';
    public key: string = '';
    public hidden: boolean = false;
    public blocker: string = '';
    public peer: string = '';
    public destDoor: string = '';
    public locked: boolean = false;
    public climb: boolean = false;
    public diff: number = 0;

    constructor(exit?: string) {
        this.exit = exit || '';
    }
}

interface RoomSmell {
    smell: string;
    description: string;
}

interface RoomSound {
    sound: string;
    description: string;
}

interface RoomSearch {
    search: string;
    message: string;
}

interface MonsterAction {
    time: number;
    enabled: boolean;
}

export class Room {
    //readonly
    public x = 0;
    public y = 0;
    public z = 0;
    public external: RoomExit = 0;
    public climbs: RoomExit = 0;
    public exits: RoomExit = 0;

    //area designer
    public objects: ObjectInfo[] = [];
    public monsters: ObjectInfo[] = [];
    public subArea: string = '';

    public type: string = 'base';

    //roomwizard supports
    public exitsDetails = {};
    public terrain = '';
    public flags: RoomFlags = RoomFlags.None;
    public short = '';
    public long = '';
    public light = 0;
    public nightAdjust = 0;
    public sound = '';
    public smell = '';
    public sounds: RoomSound[] = [];
    public smells: RoomSmell[] = [];
    public searches: RoomSearch[] = [];
    public items: RoomItem[] = [];
    public forage: number = -1;
    public maxForage: number = 0;
    public secretExit: string = '';
    public dirtType: string = '';
    public preventPeer: string = '';
    public temperature: number = 0;
    public notes: string = '';
    public custom: string = '';

    constructor(x, y, z, data?, type?) {
        if (data)
            for (const prop in data) {
                if (!data.hasOwnProperty(prop)) continue;
                this[prop] = copy(data[prop]);
            }
        this.type = type;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public clone() {
        return new Room(this.x, this.y, this.z, this, this.type);
    }

    public equals(room) {
        if (!room) return false;
        let prop;
        for (prop in this) {
            if (!this.hasOwnProperty(prop)) continue;
            switch (prop) {
                case 'items':
                    if (this.items.length !== room.items.length)
                        return false;
                    if (this.items.filter((v, i) => room.items[i].item !== v.item && room.items[i].description !== v.description).length !== 0)
                        return false;
                    break;
                case 'objects':
                case 'monsters':
                case 'sounds':
                case 'smells':
                case 'searches':
                    if (this[prop].length !== room[prop].length)
                        return false;
                    if (this[prop].filter((v, i) => room[prop][i] !== v).length !== 0)
                        return false;
                    break;
                case 'exitsDetails':
                    const k = Object.keys(this.exitsDetails).sort();
                    const k2 = Object.keys(room.exitsDetails).sort();
                    if (k.length !== k2.length)
                        return false;
                    let l = k.length;
                    while (l--) {
                        if (k[l] !== k2[l])
                            return false;
                        if (this.exitsDetails[k[l]] !== room.exitsDetails[k[l]])
                            return false;
                    }
                    break;
                default:
                    if (this[prop] !== room[prop])
                        return false;
                    break;
            }
        }
        return true;
    }

    public clear(data?) {
        if (data)
            for (const prop in this) {
                if (!this.hasOwnProperty(prop)) continue;
                this[prop] = copy(data[prop]);
            }
        else {
            this.type = 'base';
            this.exits = data.exits || 0;
            this.exitsDetails = {};
            this.x = 0;
            this.y = 0;
            this.z = 0;
            this.terrain = '';
            this.flags = RoomFlags.None;
            this.climbs = 0;
            this.short = '';
            this.long = '';
            this.light = 0;
            this.nightAdjust = 0;
            this.sound = '';
            this.smell = '';
            this.sounds = [];
            this.smells = [];
            this.searches = [];
            this.items = [];
            this.objects = [];
            this.monsters = [];
            this.subArea = '';
            this.forage = -1;
            this.maxForage = 0;
            this.secretExit = '';
            this.dirtType = '';
            this.preventPeer = '';
            this.external = 0;
            this.temperature = 0;
            this.notes = '';
            this.custom = '';
        }
    }

    public at(x, y, z?) {
        if (this.x !== x) return false;
        if (this.y !== y) return false;
        if (z === undefined)
            return true;
        if (this.z !== z) return false;
        return true;
    }

    get empty() {
        if (this.type !== 'base') return false;
        if (this.forage !== -1) return false;
        if (this.flags !== RoomFlags.None) return false;
        for (const prop in this) {
            if (prop === 'type' || prop === 'forage' || prop === 'flags' || !this.hasOwnProperty(prop)) continue;
            const tp = typeof this[prop];
            const value = <any>this[prop];
            if (tp === 'string' && value !== '')
                return false;
            if (tp === 'number' && value !== 0)
                return false;
        }
        return true;
    }

    public removeExit(exit) {
        this.exits &= ~exit;
        if (this.exitsDetails[RoomExit[exit]])
            delete this.exitsDetails[RoomExit[exit]];
    }

    public addExit(exit, details?) {
        this.exits |= exit;
        if (!this.exitsDetails[RoomExit[exit]])
            this.exitsDetails[RoomExit[exit]] = details || new Exit(RoomExit[exit].toLowerCase());
    }
}

enum View {
    map,
    monsters,
    objects,
    properties
}

enum undoType { room, monster, object, roomsAll, settings, resize, area, properties }
enum undoAction { add, delete, edit }

const Timer = new DebugTimer();

class Monster {
    public id: number;
    public maxAmount: number = -1;
    public unique: boolean = false;
    public objects: ObjectInfo[] = [];

    public type: string = 'base';

    public name: string = '';
    public long: string = '';
    public short: string = '';
    public class: string = '';
    public level: number = 1;
    public race: string = '';
    public alignment: string = '';
    public language: string = '';
    public flags: MonsterFlags = MonsterFlags.None;
    public nouns: string = '';
    public adjectives: string = '';
    public mass: number = 0;
    public height: number = 1;
    public eyeColor: string = '';
    public hairColor: string = '';
    public gender: string = 'male';
    public bodyType: string = '';
    public noCorpse: string = '';
    public noLimbs: string = '';
    public speed: number = 0;
    public patrolRoute: string = '';
    public noWalkRooms: string = '';
    public attackCommands: string = '';
    public attackCommandChance: number = 33;
    public attackInitiators: string = '';
    public aggressive: string = '';
    public autoDrop: MonsterAction = { time: 1, enabled: false };
    public openStorage: MonsterAction = { time: 3, enabled: true };
    public autoWield: MonsterAction = { time: 3, enabled: true };
    public autoLoot: MonsterAction = { time: 1, enabled: false };
    public autoWear: MonsterAction = { time: 3, enabled: false };
    public wimpy: number = 0;
    public notes: string = '';
    public custom: string = '';

    constructor(id?, data?, type?) {
        if (typeof id === 'string') {
            type = id;
            id = 0;
        }
        else if (typeof id === 'object') {
            type = data;
            data = id;
            id = 0;
        }
        if (data) {
            for (const prop in data) {
                if (!data.hasOwnProperty(prop)) continue;
                this[prop] = copy(data[prop]);
            }
            this.type = type || data.type;
            this.id = id || data.id || new Date().getTime();
        }
        else {
            this.type = type;
            this.id = id || new Date().getTime();
        }
    }

    public clone() {
        return new Monster(this);
    }

    public equals(monster) {
        if (!monster) return false;
        let prop;
        for (prop in this) {
            if (!this.hasOwnProperty(prop)) continue;
            if (this[prop] !== monster[prop])
                return false;
        }
        return true;
    }
}

enum StdObjectType {
    object, chest, material, ore, weapon, armor, sheath
}

class StdObject {
    public id: number;
    public name: string = '';
    public long: string = '';
    public short: string = '';
    public type: StdObjectType = StdObjectType.object;
    public keyid: string = '';
    public mass: number = 0;
    public nouns: string = '';
    public adjectives: string = '';
    public material: string = '';
    public notes: string = '';
    public custom: string = '';
    /*
    weapon - type, quality, enchantment
    armor - type, quality, limbs, enchantment
    sheath - type, quality, limbs, enchantment
    material - size, quality, describers
    ore - size, quality, bonuses?
    chest - objects, money
    */

    constructor(id?, data?) {
        if (typeof id === 'object') {
            data = id;
            id = 0;
        }
        if (data) {
            for (const prop in data) {
                if (!data.hasOwnProperty(prop)) continue;
                this[prop] = copy(data[prop]);
            }
            this.id = id || data.id || new Date().getTime();
        }
        else
            this.id = id || new Date().getTime();
    }

    public clone() {
        const r = new StdObject();
        let prop;
        for (prop in this) {
            if (!this.hasOwnProperty(prop)) continue;
            r[prop] = copy(this[prop]);
        }
        return r;
    }

    public equals(item) {
        if (!item) return false;
        let prop;
        for (prop in this) {
            if (!this.hasOwnProperty(prop)) continue;
            if (this[prop] !== item[prop])
                return false;
        }
        return true;
    }
}

class Size {
    public width: number;
    public height: number;
    public depth: number;

    constructor(width, height, depth) {
        this.width = width || 0;
        this.height = height || 0;
        this.depth = depth || 0;
    }

    get right() {
        return this.width * 32;
    }

    get bottom() {
        return this.height * 32;
    }
}

class Area {
    public name: string;
    public rooms: Room[][][];
    public monsters;
    public objects;
    public size: Size;
    public baseRooms;
    public baseMonsters;
    public defaultRoom = 'base';
    public defaultMonster = 'base';

    constructor(width, height?, depth?, rooms?) {
        if (Array.isArray(width)) {
            if (width.length === 3)
                this.size = new Size(width[0], width[1], width[3]);
            else
                this.size = new Size(0, 0, 0);
            if (Array.isArray(height))
                rooms = height;
        }
        else if (width instanceof Size) {
            this.size = new Size(width.width, width.height, width.depth);
            if (Array.isArray(height))
                rooms = height;
        }
        else if (typeof width === 'object') {
            this.size = new Size(width.width, width.height, width.depth);
            rooms = width.rooms || height;
        }
        else
            this.size = new Size(width, height, depth);
        if (rooms)
            this.rooms = rooms;
        else
            this.rooms = Array.from(Array(depth),
                (v, z) => Array.from(Array(height),
                    (v2, y) => Array.from(Array(width),
                        (v3, x) => new Room(x, y, z, null, this.defaultRoom))
                ));
        this.monsters = {};
        this.objects = {};
        this.baseRooms = {
            base: new Room(0, 0, 0, null, 'STD_ROOM')
        };
        this.baseMonsters = {
            base: new Monster('STD_MONSTER')
        };
    }

    public static load(file) {
        try {
            if (!fs.statSync(file).isFile())
                return new Area(25, 25, 1);
        }
        catch (err) {
            return new Area(25, 25, 1);
        }
        let data = fs.readFileSync(file, 'utf-8');
        if (data.length === 0)
            return new Area(25, 25, 1);
        try {
            data = JSON.parse(data);
        }
        catch (e) {
            return new Area(25, 25, 1);
        }
        const area = new Area(data.size.depth < 1 ? 25 : data.size.width, data.size.depth < 1 ? 25 : data.size.height, data.size.depth < 1 ? 1 : data.size.depth);

        let prop;

        if (data.monsters)
            Object.keys(data.monsters).forEach(k => area.monsters[k] = new Monster(data.monsters[k]));
        if (data.objects)
            Object.keys(data.objects).forEach(k => {
                area.objects[k] = new StdObject(k);
                for (prop in data.objects[k]) {
                    if (!data.objects[k].hasOwnProperty(prop)) continue;
                    area.objects[k][prop] = data.objects[k][prop];
                }
            });
        if (data.rooms) {
            const zl = area.size.depth;
            const xl = area.size.width;
            const yl = area.size.height;
            for (let z = 0; z < zl; z++) {
                for (let y = 0; y < yl; y++) {
                    for (let x = 0; x < xl; x++) {
                        for (prop in data.rooms[z][y][x]) {
                            if (!data.rooms[z][y][x].hasOwnProperty(prop)) continue;
                            area.rooms[z][y][x][prop] = data.rooms[z][y][x][prop];
                        }
                    }
                }
            }
        }
        if (data.baseRooms)
            Object.keys(data.baseRooms).forEach(k => {
                area.baseRooms[k] = new Room(0, 0, 0, data.baseRooms[k]);
            });
        if (data.baseMonsters)
            Object.keys(data.baseMonsters).forEach(k => {
                area.baseMonsters[k] = new Monster(data.baseMonsters[k]);
            });
        area.defaultRoom = data.defaultRoom || 'base';
        area.defaultMonster = data.defaultMonster || 'base';
        return area;
    }

    public save(file) {
        fs.writeFileSync(file, this.raw);
    }

    public get raw() {
        return JSON.stringify(this);
    }

    public clone() {
        const a = new Area(this.size.width, this.size.height, this.size.depth,
            Array.from(Array(this.size.depth),
                (v, z) => Array.from(Array(this.size.height),
                    (v2, y) => Array.from(Array(this.size.width),
                        (v3, x) => this.rooms[z][y][x].clone())
                )));
        a.monsters = Object.keys(this.monsters).map(k => this.monsters[k].clone());
        a.objects = Object.keys(this.objects).map(k => this.objects[k].clone());
        a.baseRooms = Object.keys(this.baseRooms).map(k => this.baseRooms[k].clone());
        a.baseMonsters = Object.keys(this.baseMonsters).map(k => this.baseMonsters[k].clone());
        let prop;
        for (prop in this) {
            if (prop === 'rooms' || prop === 'baseMonsters' || prop === 'baseRooms' || prop === 'objects' || prop === 'monsters' || !this.hasOwnProperty(prop)) continue;
            a[prop] = this[prop];
        }
        return a;
    }
}

export class AreaDesigner extends EditorBase {
    private $saving = false;
    private $view: View = View.map;
    private $undo = [];
    private $redo = [];
    private $undoGroup;
    private $redoGroup;
    private $new = { baseRooms: 0, baseMonsters: 0, objects: 0, monsters: 0 };

    private $label: HTMLElement;
    private $splitterPreview: Splitter;
    private $splitterEditor: Splitter;

    private $monsterGrid;
    private $objectGrid;

    private _lastMouse: MouseEvent;
    private $enterMoveNext;
    private $enterMoveFirst;
    private $enterMoveNew;

    private $xAxis: HTMLElement;
    private $xAxisHighlight: HTMLElement;
    private $yAxis: HTMLElement;
    private $yAxisHighlight: HTMLElement;
    private $cAxis: HTMLElement;
    private $map: HTMLCanvasElement;
    private $mapParent: HTMLElement;
    private $mapContainer: HTMLElement;

    private $mapContext: CanvasRenderingContext2D;

    private $focused: boolean;
    private _updating;
    private _os;
    private _wMove;
    private _wUp;
    private _scrollTimer: NodeJS.Timer;
    private $resizer;
    private $resizerCache;
    private $observer: MutationObserver;
    private $allowResize: boolean = true;
    private $allowExitWalk: boolean = true;

    private $mousePrevious: MousePosition = {
        x: 0,
        y: 0,
        rx: 0,
        ry: 0,
        button: 0
    };
    private $mouse: MousePosition = {
        x: 0,
        y: 0,
        rx: 0,
        ry: 0,
        button: 0
    };
    private $mouseDown: MousePosition = {
        x: 0,
        y: 0,
        rx: 0,
        ry: 0,
        button: 0
    };
    private $mouseSelect;

    private $measure;

    private $depth;
    private $roomCount;
    private $depthToolbar: HTMLInputElement;

    private $selectedRooms: Room[] = [];
    private $focusedRoom: Room;
    private $shiftRoom: Room;

    private $roomPreview;
    private $roomEditor;
    private $propertiesEditor;

    private $area: Area;
    private $startOptions;

    private pushUndo(action: undoAction, type: undoType, data) {
        const u = { type: type, action: action, view: this.$view, data: data, selection: this.$selectedRooms.map(m => [m.x, m.y, m.z]), focused: this.$focusedRoom ? [this.$focusedRoom.x, this.$focusedRoom.y, this.$focusedRoom.z] : [] };
        if (this.$undoGroup)
            this.$undoGroup.push(u);
        else
            this.$undo.push(u);
        this.$redo = [];
        this.emit('supports-changed');
    }

    private pushUndoObject(data) {
        if (this.$undoGroup)
            this.$undoGroup.push(data);
        else
            this.$undo.push(data);
        this.emit('supports-changed');
    }

    private startUndoGroup(skipRedo?) {
        if (this.$undoGroup && this.$undoGroup.length > 0) {
            this.$undo.push(this.$undoGroup);
            if (!skipRedo)
                this.$redo = [];
            this.emit('supports-changed');
        }
        this.$undoGroup = [];
    }

    private stopUndoGroup(skipRedo?) {
        if (this.$undoGroup && this.$undoGroup.length > 0) {
            this.$undo.push(this.$undoGroup);
            if (!skipRedo)
                this.$redo = [];
            this.emit('supports-changed');
        }
        this.$undoGroup = null;
    }

    private pushRedo(data) {
        if (this.$redoGroup)
            this.$redoGroup.push(data);
        else
            this.$redo.push(data);
        this.emit('supports-changed');
    }

    private startRedoGroup() {
        if (this.$redoGroup && this.$redoGroup.length > 0) {
            this.$redo.push(this.$undoGroup);
            this.emit('supports-changed');
        }
        this.$redoGroup = [];
    }

    private stopRedoGroup() {
        if (this.$redoGroup && this.$redoGroup.length > 0) {
            this.$redo.push(this.$redoGroup);
            this.emit('supports-changed');
        }
        this.$redoGroup = null;
    }

    public get selectedRoom(): Room {
        if (this.$selectedRooms.length === 0)
            return null;
        return this.$selectedRooms[0];
    }

    public get selectedFocusedRoom(): Room {
        if (this.$selectedRooms.length === 0 || this.$selectedRooms.indexOf(this.$focusedRoom) === -1)
            return this.selectedRoom;
        return this.$focusedRoom;
    }

    public get selectedRooms() {
        return this.$selectedRooms;
    }

    public get AllowResize(): boolean {
        return this.$allowResize;
    }

    public set AllowResize(value) {
        if (value === this.$allowResize) return;
        this.$allowResize = value;
        this.emit('menu-update', 'edit|allow resize walk', { checked: value });
        if (document.getElementById('btn-allow-resize-walk')) {
            if (value)
                document.getElementById('btn-allow-resize-walk').classList.add('active');
            else
                document.getElementById('btn-allow-resize-walk').classList.remove('active');
        }
        this.emit('option-changed', 'allowResize', value);
    }

    public get AllowExitWalk(): boolean {
        return this.$allowExitWalk;
    }

    public set AllowExitWalk(value) {
        if (value === this.$allowExitWalk) return;
        this.$allowExitWalk = value;
        this.emit('menu-update', 'edit|allow exit walk', { checked: value });
        if (document.getElementById('btn-allow-exit-walk')) {
            if (value)
                document.getElementById('btn-allow-exit-walk').classList.add('active');
            else
                document.getElementById('btn-allow-exit-walk').classList.remove('active');
        }
        this.emit('option-changed', 'allowExitWalk', value);
    }

    public get maxLevel() {
        if (!this.$area || !this.$area.size) return 0;
        return this.$area.size.depth;
    }

    public get size() {
        if (!this.$area || !this.$area.size) return { height: 0, width: 0, depth: 0 };
        return this.$area.size;
    }

    public ensureVisible(x, y?) {
        if (x instanceof Room || typeof x === 'object') {
            y = x.y || 0;
            x = x.x || 0;
        }
        let s = 32 + (y - 1) * 32;
        if (s < this.$mapContainer.scrollTop)
            this.$mapContainer.scrollTop = 32 + (y - 1) * 32;
        s = 32 + (x - 1) * 32;
        if (s < this.$mapContainer.scrollLeft)
            this.$mapContainer.scrollLeft = 32 + (x - 1) * 32;
        let t = ((this.$mapContainer.scrollTop) / 32) >> 0;
        let b = t + ((this.$mapContainer.clientHeight / 32) >> 0);
        if (y >= b)
            this.$mapContainer.scrollTop = y * 32 - this.$mapContainer.clientHeight + 32;
        t = (this.$mapContainer.scrollLeft / 32) >> 0;
        b = t + ((this.$mapContainer.clientWidth / 32) >> 0);
        if (x >= b)
            this.$mapContainer.scrollLeft = x * 32 - this.$mapContainer.clientWidth + 32;
    }

    constructor(options?: AreaDesignerOptions) {
        super(options);
        if (options && options.options)
            this.options = options.options;
        else
            this.options = {
                allowResize: true,
                allowExitWalk: true,
                previewFontSize: 16,
                previewFontFamily: 'Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace',
                editorWidth: 300,
                previewHeight: 200,
                live: true,
                showRoomEditor: true,
                showRoomPreview: true,
                enterMoveNext: true,
                enterMoveFirst: true,
                enterMoveNew: true
            };
        if (options && options.new) {
            this.$area = new Area(options.width || 25, options.height || 25, options.depth || 1);
            this.doUpdate(UpdateType.buildMap);
            this.changed = false;
        }
        this.$startOptions = options;
    }

    set changed(value: boolean) {
        if (value !== super.changed) {
            super.changed = value;
            this.emit('changed', value);
        }
    }

    get changed(): boolean {
        return super.changed;
    }

    public createControl() {
        //#region depth
        this.$depth = 0;
        this.$depthToolbar = document.createElement('input');
        this.$depthToolbar.id = this.parent.id + '-level';
        this.$depthToolbar.classList.add('form-control', 'input-xs');
        this.$depthToolbar.type = 'number';
        this.$depthToolbar.style.width = '50px';

        this.$depthToolbar.addEventListener('change', (e) => {
            if (this.$depthToolbar.value === '' + this.$depth)
                return;
            this.$depth = +this.$depthToolbar.value;
            if (this.$selectedRooms.length > 0) {
                const old = this.$selectedRooms.slice();
                let ol = old.length;
                this.$selectedRooms.length = 0;
                while (ol--)
                    this.$selectedRooms.push(this.getRoom(old[ol].x, old[ol].y, this.$depth));
                this.ChangeSelection();
                this.setFocusedRoom(null);
            }
            this.doUpdate(UpdateType.drawMap);
        });
        this.$depthToolbar.addEventListener('input', (e) => {
            if (this.$depthToolbar.value === '' + this.$depth)
                return;
            this.$depth = +this.$depthToolbar.value;
            if (this.$selectedRooms.length > 0) {
                const old = this.$selectedRooms.slice();
                let ol = old.length;
                this.$selectedRooms.length = 0;
                while (ol--)
                    this.$selectedRooms.push(this.getRoom(old[ol].x, old[ol].y, this.$depth));
                this.ChangeSelection();
                this.setFocusedRoom(null);
            }
            this.doUpdate(UpdateType.drawMap);
        });
        //#endregion
        if (!window.$roomImg) {
            window.$roomImg = new Image();
            window.$roomImg.src = './../assets/editor/rooms.png';
            window.$roomImg.addEventListener('load', () => {
                window.$roomImgLoaded = true;
            });
        }
        const frag = document.createDocumentFragment();
        this.$label = document.createElement('div');
        this.$label.classList.add('virtual-editor-label');
        //let el: HTMLElement;
        frag.appendChild(this.$label);
        this.parent.appendChild(frag);
        //#region create map editor
        this.$splitterEditor = new Splitter({ parent: this.parent, orientation: Orientation.vertical });
        this.$splitterEditor.Panel2MinSize = 300;
        this.$splitterEditor.on('splitter-moved', (e) => {
            this.emit('room-splitter-moved', e);
            this.emit('option-changed', 'editorWidth', e);
        });
        this.$splitterEditor.on('collapsed', (panel) => {
            this.emit('room-splitter-collapsed', panel);
            this.emit('option-changed', 'showRoomEditor', panel !== 2);
            this.emit('menu-update', 'view|room editor', { checked: panel !== 2 });
            this.setButtonState('show room editor', panel !== 2);
        });
        this.$splitterPreview = new Splitter({ parent: this.$splitterEditor.panel1 });
        this.$splitterPreview.on('splitter-moved', (e) => {
            this.emit('preview-splitter-moved', e);
            this.emit('option-changed', 'previewHeight', e);
        });
        this.$splitterPreview.on('collapsed', (panel) => {
            this.emit('room-splitter-collapsed', panel);
            this.emit('option-changed', 'showRoomPreview', panel !== 2);
            this.emit('menu-update', 'view|room preview', { checked: panel !== 2 });
            this.setButtonState('show room preview', panel !== 2);
        });
        this.$mapParent = document.createElement('div');
        this.$mapParent.id = this.parent.id + '-map';
        this.$mapParent.classList.add('map');

        this.$xAxis = document.createElement('div');
        this.$xAxis.id = this.parent.id + '-xAxis';
        this.$xAxis.classList.add('x-axis');
        this.$xAxis.addEventListener('click', () => {
            this.$map.focus();
        });
        this.$mapParent.appendChild(this.$xAxis);
        this.$yAxis = document.createElement('div');
        this.$yAxis.id = this.parent.id + '-yAxis';
        this.$yAxis.classList.add('y-axis');
        this.$yAxis.addEventListener('click', () => {
            this.$map.focus();
        });
        this.$mapParent.appendChild(this.$yAxis);
        this.$cAxis = document.createElement('div');
        this.$cAxis.id = this.parent.id + '-cAxis';
        this.$cAxis.classList.add('c-axis');
        this.$cAxis.addEventListener('click', () => {
            this.$map.focus();
        });
        this.$mapParent.appendChild(this.$cAxis);
        this.$mapContainer = document.createElement('div');
        this.$mapContainer.id = this.parent.id + '-map-container';
        this.$mapContainer.classList.add('map-container');
        this.$mapContainer.addEventListener('scroll', () => {
            this.$xAxis.style.left = (32 - this.$mapContainer.scrollLeft) + 'px';
            this.$yAxis.style.top = (32 - this.$mapContainer.scrollTop) + 'px';
            let r = this.getRoom(this.$mouse.rx, this.$mouse.ry);
            if (r) this.DrawRoom(this.$mapContext, r, true);
            const x = this._os.left;
            const y = this._os.top;
            if (this._lastMouse.clientX >= x && this._lastMouse.clientX <= this.$mapContainer.clientWidth + x && this._lastMouse.clientY >= y && this._lastMouse.clientY <= this.$mapContainer.clientHeight + y) {
                this.$mouse = this.getMousePosFromWindow(this._lastMouse);
                r = this.getRoom(this.$mouse.rx, this.$mouse.ry);
                if (r) this.DrawRoom(this.$mapContext, r, true, true);
            }
        });
        this.$mapContainer.addEventListener('click', (e) => {
            this.$map.focus();
            e.preventDefault();
            e.cancelBubble = true;
            e.stopPropagation();
        });
        this.$xAxisHighlight = document.createElement('div');
        this.$xAxisHighlight.id = this.parent.id + '-x-axis-highlight';
        this.$xAxisHighlight.classList.add('x-axis-highlight');
        this.$mapContainer.appendChild(this.$xAxisHighlight);
        this.$yAxisHighlight = document.createElement('div');
        this.$yAxisHighlight.id = this.parent.id + '-y-axis-highlight';
        this.$yAxisHighlight.classList.add('y-axis-highlight');
        this.$mapContainer.appendChild(this.$yAxisHighlight);
        this.$map = document.createElement('canvas');
        this.$map.id = this.parent.id + '-map-canvas';
        this.$map.classList.add('map-canvas');
        this.$map.height = 290;
        this.$map.width = 290;
        this.$map.tabIndex = 1;

        this._wMove = (e) => {
            if (this.$view !== View.map) return;
            this.$mousePrevious = this.$mouse;
            this._lastMouse = e;
            this.$mouse = this.getMousePosFromWindow(e);
            if (this.$mouseSelect) {
                this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mousePrevious.x - this.$mouseDown.x, this.$mousePrevious.y - this.$mouseDown.y);
                this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mouse.x - this.$mouseDown.x, this.$mouse.y - this.$mouseDown.y, true);
            }
            else {
                const x = this._os.left;
                const y = this._os.top;
                if (e.clientX >= x && e.clientX <= this.$mapContainer.clientWidth + x && e.clientY >= y && e.clientY <= this.$mapContainer.clientHeight + y) {
                    const r = this.getRoom(this.$mouse.rx, this.$mouse.ry);
                    const p = this.getRoom(this.$mousePrevious.rx, this.$mousePrevious.ry);
                    if (r !== p) {
                        if (p) this.DrawRoom(this.$mapContext, p, true, false);
                        if (r) this.DrawRoom(this.$mapContext, r, true, true);
                    }
                    this.emit('location-changed', this.$mouse.rx, this.$mouse.ry);
                }
                else {
                    const r = this.getRoom(this.$mouse.rx, this.$mouse.ry);
                    const p = this.getRoom(this.$mousePrevious.rx, this.$mousePrevious.ry);
                    if (r !== p) {
                        if (p) this.DrawRoom(this.$mapContext, p, true);
                        if (r) this.DrawRoom(this.$mapContext, r, true);
                    }
                }
            }
        };

        this._wUp = (e) => {
            this._lastMouse = e;
            this.$mouse = this.getMousePosFromWindow(e);
            if ((this.$focusedRoom || this.$selectedRooms.length > 0) && e.shiftKey) {
                let x;
                let y;
                let height;
                let width;
                if (this.$focusedRoom) {
                    x = (Math.min(this.$mouseDown.x, this.$focusedRoom.x * 32) / 32) >> 0;
                    y = (Math.min(this.$mouseDown.y, this.$focusedRoom.y * 32) / 32) >> 0;
                    width = Math.ceil(Math.max(this.$mouseDown.x, (this.$focusedRoom.x * 32) + 17) / 32);
                    height = Math.ceil(Math.max(this.$mouseDown.y, (this.$focusedRoom.y * 32) + 17) / 32);
                }
                else {
                    x = (Math.min(this.$mouseDown.x, this.selectedRoom.x * 32) / 32) >> 0;
                    y = (Math.min(this.$mouseDown.y, this.selectedRoom.y * 32) / 32) >> 0;
                    width = Math.ceil(Math.max(this.$mouseDown.x, (this.selectedRoom.x * 32) + 17) / 32);
                    height = Math.ceil(Math.max(this.$mouseDown.y, (this.selectedRoom.y * 32) + 17) / 32);
                    this.setFocusedRoom(this.selectedRoom);
                }
                this.setSelection(x, y, width, height);
                this.$mouseSelect = false;
            }
            else if (this.$mouseSelect) {
                this.$mouseSelect = false;
                this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mousePrevious.x - this.$mouseDown.x, this.$mousePrevious.y - this.$mouseDown.y);
                this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mouse.x - this.$mouseDown.x, this.$mouse.y - this.$mouseDown.y);
                const x = Math.min(this.$mouseDown.rx, this.$mouse.rx);
                const y = Math.min(this.$mouseDown.ry, this.$mouse.ry);
                const width = Math.ceil(Math.max(this.$mouseDown.x, this.$mouse.x) / 32);
                const height = Math.ceil(Math.max(this.$mouseDown.y, this.$mouse.y) / 32);
                this.setSelection(x, y, width, height);
                if (this.$selectedRooms.length !== 0)
                    this.setFocusedRoom(this.$selectedRooms[this.$selectedRooms.length - 1]);
                else
                    this.setFocusedRoom(this.$mouse.rx, this.$mouse.ry);
            }
            else {
                const x = this._os.left;
                const y = this._os.top;
                if (e.clientX >= x && e.clientX <= this.$mapContainer.clientWidth + x && e.clientY >= y && e.clientY <= this.$mapContainer.clientHeight + y) {
                    if (this.$mouse.rx === this.$mouseDown.rx && this.$mouse.ry === this.$mouseDown.ry) {
                        const r = this.getRoom(this.$mouse.rx, this.$mouse.ry);
                        if (this.$selectedRooms.indexOf(r) !== -1) return;
                        const old = this.$selectedRooms.slice();
                        this.$selectedRooms.length = 0;
                        let ol = old.length;
                        while (ol--)
                            this.DrawRoom(this.$mapContext, old[ol], true);
                        if (r) {
                            this.$selectedRooms.push(r);
                            this.ChangeSelection();
                            this.DrawRoom(this.$mapContext, r, true, true);
                        }
                    }
                    this.setFocusedRoom(this.$mouse.rx, this.$mouse.ry);
                }
                if (this._scrollTimer) {
                    clearInterval(this._scrollTimer);
                    this._scrollTimer = null;
                }
            }
        };
        window.addEventListener('mousemove', this._wMove.bind(this));
        window.addEventListener('mouseup', this._wUp.bind(this));
        this.$map.addEventListener('mousedown', (e) => {
            this.$mouse = this.getMousePos(e);
            this.$mouseDown = this.getMousePos(e);
            this.$mouseSelect = this.$mouseDown.button === 0;
        });
        this.$map.addEventListener('mouseenter', (e) => {
            this.$mouse = this.getMousePos(e);
            this.ClearPrevMouse();
            const p = this.getRoom(this.$mouse.rx, this.$mouse.ry);
            if (p) this.DrawRoom(this.$mapContext, p, true, true);
            if (this.$mouseSelect)
                this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mouse.x - this.$mouseDown.x, this.$mouse.y - this.$mouseDown.y, true);
            this.emit('location-changed', this.$mouse.rx, this.$mouse.ry);
            clearInterval(this._scrollTimer);
            this._scrollTimer = null;
        });
        this.$map.addEventListener('mouseleave', (e) => {
            this.ClearPrevMouse();
            this.$mousePrevious = this.$mouse;
            this.ClearPrevMouse();
            this.$mouse = this.getMousePos(event);
            const p = this.getRoom(this.$mouse.rx, this.$mouse.ry);
            if (p) this.DrawRoom(this.$mapContext, p, true, false);
            if (this.$mouseSelect)
                this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mouse.x - this.$mouseDown.x, this.$mouse.y - this.$mouseDown.y, true);
            this.$mouse.x = -1;
            this.$mouse.y = -1;
            this.$mouse.rx = -1;
            this.$mouse.ry = -1;
            this.emit('location-changed', -1, -1);
            if (this.$mouseSelect) {
                this._lastMouse = e;
                this._scrollTimer = setInterval(() => {
                    /// pull as long as you can scroll either direction

                    if (!this._lastMouse || !this.$mouseSelect) {
                        clearInterval(this._scrollTimer);
                        this._scrollTimer = null;
                        return;
                    }
                    const os = this._os;
                    let x = this._lastMouse.pageX - os.left;
                    let y = this._lastMouse.pageY - os.top;

                    if (y <= 0 && this.$mapContainer.scrollTop > 0) {
                        y = -1 * 32;
                    }
                    else if (y >= this.$mapContainer.clientHeight && this.$mapContainer.scrollTop < this.$mapContainer.scrollHeight - this.$mapContainer.clientHeight) {
                        y = 32;
                    }
                    else
                        y = 0;

                    if (x < 0 && this.$mapContainer.scrollLeft > 0) {
                        x = -1 * 32;
                    }
                    else if (x >= this.$mapContainer.clientWidth && this.$mapContainer.scrollLeft < this.$mapContainer.scrollWidth - - this.$mapContainer.clientWidth) {
                        x = 32;
                    }
                    else
                        x = 0;

                    if (x === 0 && y === 0)
                        return;
                    this.$mouse = this.getMousePosFromWindow(this._lastMouse);
                    if (this.$mouseSelect) {
                        this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mousePrevious.x - this.$mouseDown.x, this.$mousePrevious.y - this.$mouseDown.y);
                        this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mouse.x - this.$mouseDown.x, this.$mouse.y - this.$mouseDown.y, true);
                    }
                    this.emit('selection-changed');
                    this.$mapContainer.scrollTop += y;
                    this.$mapContainer.scrollLeft += x;
                }, 50);
            }
        });
        this.$map.addEventListener('contextmenu', (e) => {
            if (e.defaultPrevented) return;
            const m = this.getMousePos(e);
            const room: any = this.getRoom(m.rx, m.ry);
            const ec = { room: room ? room.clone() : null, preventDefault: false, size: this.$area.size };
            this.emit('map-context-menu', ec);
            this.setFocusedRoom(this.$mouse.rx, this.$mouse.ry);
        });
        this.$map.addEventListener('dblclick', (e) => {
            const m = this.getMousePos(e);
            this.emit('room-dblclick', this.getRoom(m.rx, m.ry).clone());
            e.preventDefault();
        });
        this.$map.addEventListener('selectstart', (e) => {
            e.preventDefault();
            return false;
        });
        this.$mapContainer.appendChild(this.$map);
        this.$mapContext = this.$map.getContext('2d');
        this.$mapContext.mozImageSmoothingEnabled = false;
        this.$mapContext.imageSmoothingEnabled = false;
        this.$mapParent.appendChild(this.$mapContainer);

        this.$roomPreview = {};
        this.$roomPreview.container = document.createElement('div');
        this.$roomPreview.container.id = this.parent.id + '-room-preview';
        this.$roomPreview.container.classList.add('room-preview');
        this.$roomPreview.container.addEventListener('contextmenu', e => {
            e.preventDefault();
            const sel = getSelection();
            let inputMenu;
            if (!sel.isCollapsed && sel.type === 'Range' && this.$roomPreview.container.contains(sel.anchorNode)) {
                inputMenu = Menu.buildFromTemplate([
                    { role: 'copy' },
                    { type: 'separator' },
                    { role: 'selectall' }
                ]);
            }
            else
                inputMenu = Menu.buildFromTemplate([
                    { role: 'selectall' }
                ]);
            inputMenu.popup({ window: remote.getCurrentWindow() });
        });
        this.$roomPreview.short = document.createElement('div');
        this.$roomPreview.short.classList.add('room-short');
        this.$roomPreview.container.appendChild(this.$roomPreview.short);
        this.$roomPreview.long = document.createElement('div');
        this.$roomPreview.long.classList.add('room-long');
        this.$roomPreview.container.appendChild(this.$roomPreview.long);
        this.$roomPreview.smell = document.createElement('div');
        this.$roomPreview.smell.classList.add('room-smell');
        this.$roomPreview.container.appendChild(this.$roomPreview.smell);
        this.$roomPreview.sound = document.createElement('div');
        this.$roomPreview.sound.classList.add('room-sound');
        this.$roomPreview.container.appendChild(this.$roomPreview.sound);
        this.$roomPreview.exits = document.createElement('div');
        this.$roomPreview.exits.classList.add('room-exits');
        this.$roomPreview.container.appendChild(this.$roomPreview.exits);
        this.$roomPreview.living = document.createElement('div');
        this.$roomPreview.living.classList.add('room-living');
        this.$roomPreview.container.appendChild(this.$roomPreview.living);
        this.$roomPreview.objects = document.createElement('div');
        this.$roomPreview.objects.classList.add('room-objects');
        this.$roomPreview.container.appendChild(this.$roomPreview.objects);

        this.$splitterPreview.panel1.appendChild(this.$mapParent);
        this.$splitterPreview.panel2.appendChild(this.$roomPreview.container);

        this.$map.addEventListener('keydown', (e) => {
            if (!this.$focused) return;
            let x = 0;
            let y = 0;
            let po;
            let p = this.selectedFocusedRoom;
            let o = 0;
            let or;
            let sl;
            let width;
            let height;
            if (!p) {
                x = (32 - this.$mapContainer.scrollLeft) / 32;
                y = (32 - this.$mapContainer.scrollTop) / 32;
            }
            else {
                or = this.selectedFocusedRoom.clone();
                x = this.selectedFocusedRoom.x;
                y = this.selectedFocusedRoom.y;
                o = this.selectedFocusedRoom.exits;
            }
            switch (e.which) {
                case 67: //c copy
                    if (e.ctrlKey)
                        this.copy();
                    break;
                case 88: //x cut
                    if (e.ctrlKey)
                        this.cut();
                    break;
                case 86: //v paste
                    if (e.ctrlKey)
                        this.paste();
                    break;
                case 38: //up
                    //#region
                    if (e.shiftKey) {
                        let sf = this.$shiftRoom;
                        let ef = this.$focusedRoom;
                        if (!ef) {
                            ef = this.getRoom(0, 0);
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        if (!sf) sf = ef;
                        x = sf.x;
                        y = sf.y;
                        if (y > 0) {
                            y--;
                            this.ensureVisible(x, y);
                            sf = this.getRoom(x, y);
                            x = Math.min(ef.x, sf.x);
                            y = Math.min(ef.y, sf.y);
                            width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                            height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                            this.setSelection(x, y, width, height);
                            this.$map.focus();
                            for (let u = x; u < width; u++)
                                this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y + 1][u], true);
                            for (let u = x; u < width; u++)
                                this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y][u], true);
                        }
                        this.$shiftRoom = sf;
                    }
                    else if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    else if (y > 0) {
                        y--;
                        this.setSelectedRooms(this.getRoom(x, y));
                        this.ensureVisible(x, y);
                        this.$map.focus();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    event.preventDefault();
                    //#endregion
                    break;
                case 40: //down
                    //#region
                    if (e.shiftKey) {
                        let sf = this.$shiftRoom;
                        let ef = this.$focusedRoom;
                        if (!ef) {
                            ef = this.getRoom(0, 0);
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        if (!sf) sf = ef;
                        x = sf.x;
                        y = sf.y;
                        if (y < this.$area.size.height - 1) {
                            y++;
                            this.ensureVisible(x, y);
                            sf = this.getRoom(x, y);
                            x = Math.min(ef.x, sf.x);
                            y = Math.min(ef.y, sf.y);
                            width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                            height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                            this.setSelection(x, y, width, height);
                            this.$map.focus();
                            for (let u = x; u < width; u++)
                                this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y - 1][u], true);
                            for (let u = x; u < width; u++)
                                this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y][u], true);
                        }
                        this.$shiftRoom = sf;
                    }
                    else if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    else if (y < this.$area.size.height - 1) {
                        y++;
                        this.setSelectedRooms(this.getRoom(x, y));
                        this.ensureVisible(x, y);
                        this.$map.focus();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    event.preventDefault();
                    //#endregion
                    break;
                case 37: //left
                    //#region
                    if (e.shiftKey) {
                        let sf = this.$shiftRoom;
                        let ef = this.$focusedRoom;
                        if (!ef) {
                            ef = this.getRoom(0, 0);
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        if (!sf) sf = ef;
                        x = sf.x;
                        y = sf.y;
                        if (x > 0) {
                            x--;
                            this.ensureVisible(x, y);
                            sf = this.getRoom(x, y);
                            x = Math.min(ef.x, sf.x);
                            y = Math.min(ef.y, sf.y);
                            width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                            height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                            this.setSelection(x, y, width, height);
                            this.$map.focus();
                            for (let u = y; u < height; u++)
                                this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][u][sf.x + 1], true);
                            for (let u = y; u < height; u++)
                                this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][u][sf.x], true);
                        }
                        this.$shiftRoom = sf;
                    }
                    else if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    else if (x > 0) {
                        x--;
                        this.setSelectedRooms(this.getRoom(x, y));
                        this.ensureVisible(x, y);
                        this.$map.focus();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    event.preventDefault();
                    //#endregion
                    break;
                case 39: //right
                    //#region
                    if (e.shiftKey) {
                        let sf = this.$shiftRoom;
                        let ef = this.$focusedRoom;
                        if (!ef) {
                            ef = this.getRoom(0, 0);
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        if (!sf) sf = ef;
                        x = sf.x;
                        y = sf.y;
                        if (x < this.$area.size.width - 1) {
                            x++;
                            this.ensureVisible(x, y);
                            sf = this.getRoom(x, y);
                            x = Math.min(ef.x, sf.x);
                            y = Math.min(ef.y, sf.y);
                            width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                            height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                            this.setSelection(x, y, width, height);
                            this.$map.focus();
                            for (let u = y; u < height; u++)
                                this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][u][sf.x - 1], true);
                            for (let u = y; u < height; u++)
                                this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][u][sf.x], true);
                        }
                        this.$shiftRoom = sf;
                    }
                    else if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    else if (x < this.$area.size.width - 1) {
                        x++;
                        this.setSelectedRooms(this.getRoom(x, y));
                        this.ensureVisible(x, y);
                        this.$map.focus();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    event.preventDefault();
                    //#endregion
                    break;
                case 110:
                case 46: //delete
                    //#region
                    if (this.$selectedRooms.length === 0)
                        return;
                    sl = this.$selectedRooms.length;
                    this.startUndoGroup();
                    this.pushUndo(undoAction.delete, undoType.room, this.$selectedRooms.map(r => r.clone()));
                    while (sl--) {
                        const sR = this.$selectedRooms[sl];
                        or = sR.clone();
                        x = sR.x;
                        y = sR.y;
                        o = sR.exits;
                        let nx = sR.x;
                        let ny = sR.y;
                        if (e.ctrlKey) {
                            if (y > 0) {
                                sR.addExit(RoomExit.North);
                                if (x > 0)
                                    sR.addExit(RoomExit.NorthWest);
                                if (x < this.$area.size.width - 1)
                                    sR.addExit(RoomExit.NorthEast);
                            }
                            if (y < this.$area.size.height - 1) {
                                sR.addExit(RoomExit.South);
                                if (x > 0)
                                    sR.addExit(RoomExit.SouthWest);
                                if (x < this.$area.size.width - 1)
                                    sR.addExit(RoomExit.SouthEast);
                            }
                            if (x > 0)
                                sR.addExit(RoomExit.West);
                            if (x < this.$area.size.width - 1)
                                sR.addExit(RoomExit.East);
                        }
                        else
                            sR.clear(this.$area.baseRooms[this.$area.defaultRoom]);
                        this.RoomChanged(sR, or);
                        this.DrawRoom(this.$mapContext, sR, true, sR.at(this.$mouse.rx, this.$mouse.ry));
                        if (y > 0 && (e.ctrlKey || (o & RoomExit.North) === RoomExit.North)) {
                            nx = x;
                            ny = y - 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.South);
                                else
                                    p.removeExit(RoomExit.South);
                                this.DrawRoom(this.$mapContext, p, true, false);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                        if (y > 0 && x > 0 && (e.ctrlKey || (o & RoomExit.NorthWest) === RoomExit.NorthWest)) {
                            nx = x - 1;
                            ny = y - 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.SouthEast);
                                else
                                    p.removeExit(RoomExit.SouthEast);
                                this.DrawRoom(this.$mapContext, p, true, false);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                        if (y > 0 && x < this.$area.size.width - 1 && (e.ctrlKey || (o & RoomExit.NorthEast) === RoomExit.NorthEast)) {
                            nx = x + 1;
                            ny = y - 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.SouthWest);
                                else
                                    p.removeExit(RoomExit.SouthWest);
                                this.DrawRoom(this.$mapContext, p, true, false);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                        if (x < this.$area.size.width - 1 && (e.ctrlKey || (o & RoomExit.East) === RoomExit.East)) {
                            nx = x + 1;
                            ny = y;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.West);
                                else
                                    p.removeExit(RoomExit.West);
                                this.DrawRoom(this.$mapContext, p, true, false);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                        if (x > 0 && (e.ctrlKey || (o & RoomExit.West) === RoomExit.West)) {
                            nx = x - 1;
                            ny = y;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.East);
                                else
                                    p.removeExit(RoomExit.East);
                                this.DrawRoom(this.$mapContext, p, true, false);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                        if (y < this.$area.size.height - 1 && (e.ctrlKey || (o & RoomExit.South) === RoomExit.South)) {
                            nx = x;
                            ny = y + 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.North);
                                else
                                    p.removeExit(RoomExit.North);
                                this.DrawRoom(this.$mapContext, p, true, false);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                        if (y < this.$area.size.height - 1 && x < this.$area.size.width - 1 && (e.ctrlKey || (o & RoomExit.SouthEast) === RoomExit.SouthEast)) {
                            nx = x + 1;
                            ny = y + 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.NorthWest);
                                else
                                    p.removeExit(RoomExit.NorthWest);
                                this.DrawRoom(this.$mapContext, p, true, false);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                        if (x > 0 && y < this.$area.size.height - 1 && (e.ctrlKey || (o & RoomExit.SouthWest) === RoomExit.SouthWest)) {
                            nx = x - 1;
                            ny = y + 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.NorthEast);
                                else
                                    p.removeExit(RoomExit.NorthEast);
                                this.DrawRoom(this.$mapContext, p, true, false);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                        if (this.$depth + 1 < this.$area.size.depth && (e.ctrlKey || (o & RoomExit.Up) === RoomExit.Up)) {
                            p = this.getRoom(x, y, this.$depth + 1);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.Down);
                                else
                                    p.removeExit(RoomExit.Down);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                        if (this.$depth - 1 >= 0 && (e.ctrlKey || (o & RoomExit.Down) === RoomExit.Down)) {
                            p = this.getRoom(x, y, this.$depth - 1);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.addExit(RoomExit.Up);
                                else
                                    p.removeExit(RoomExit.Up);
                                if (p.exits !== po.exits) {
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                                    this.RoomChanged(p, po);
                                }
                            }
                        }
                    }
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 97: //num1
                    //#region southwest
                    if (!this.$allowExitWalk) {
                        //#region
                        if (e.shiftKey) {
                            let sf = this.$shiftRoom;
                            let ef = this.$focusedRoom;
                            if (!ef) {
                                ef = this.getRoom(0, 0);
                                this.setFocusedRoom(this.selectedRoom);
                            }
                            if (!sf) sf = ef;
                            x = sf.x;
                            y = sf.y;
                            if (y < this.$area.size.height - 1 && x > 0) {
                                y++;
                                x--;
                                this.ensureVisible(x, y);
                                sf = this.getRoom(x, y);
                                x = Math.min(ef.x, sf.x);
                                y = Math.min(ef.y, sf.y);
                                width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                                height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                                this.setSelection(x, y, width, height);
                                this.$map.focus();
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y - 1][u], true);
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y][u], true);
                            }
                            this.$shiftRoom = sf;
                        }
                        else if (this.$selectedRooms.length === 0) {
                            this.$selectedRooms.push(this.getRoom(0, 0));
                            this.ChangeSelection();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        else if (y < this.$area.size.height - 1 && x > 0) {
                            y++;
                            x--;
                            this.setSelectedRooms(this.getRoom(x, y));
                            this.ensureVisible(x, y);
                            this.$map.focus();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        event.preventDefault();
                        //#endregion
                        return;
                    }
                    this.startUndoGroup();
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (y < this.$area.size.height - 1 && x > 0) {
                        y++;
                        x--;
                        if (e.ctrlKey)
                            p.removeExit(RoomExit.SouthWest);
                        else
                            p.addExit(RoomExit.SouthWest);

                        if (o !== p.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(p, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.NorthEast);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.NorthEast);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);

                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        if (x === 0 && y === this.$area.size.height - 1)
                            this.resizeMap(1, 1, 0, shiftType.top | shiftType.right);
                        else if (x === 0)
                            this.resizeMap(1, 0, 0, shiftType.top | shiftType.right);
                        else
                            this.resizeMap(0, 1, 0, shiftType.top | shiftType.right);
                        p = this.selectedFocusedRoom;
                        y = p.y + 1;
                        x = p.x - 1;
                        p.addExit(RoomExit.SouthWest);
                        if (o !== p.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(p, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.NorthEast);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 98: //num2
                    //#region south
                    if (!this.$allowExitWalk) {
                        //#region
                        if (e.shiftKey) {
                            let sf = this.$shiftRoom;
                            let ef = this.$focusedRoom;
                            if (!ef) {
                                ef = this.getRoom(0, 0);
                                this.setFocusedRoom(this.selectedRoom);
                            }
                            if (!sf) sf = ef;
                            x = sf.x;
                            y = sf.y;
                            if (y < this.$area.size.height - 1) {
                                y++;
                                this.ensureVisible(x, y);
                                sf = this.getRoom(x, y);
                                x = Math.min(ef.x, sf.x);
                                y = Math.min(ef.y, sf.y);
                                width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                                height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                                this.setSelection(x, y, width, height);
                                this.$map.focus();
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y - 1][u], true);
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y][u], true);
                            }
                            this.$shiftRoom = sf;
                        }
                        else if (this.$selectedRooms.length === 0) {
                            this.$selectedRooms.push(this.getRoom(0, 0));
                            this.ChangeSelection();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        else if (y < this.$area.size.height - 1) {
                            y++;
                            this.setSelectedRooms(this.getRoom(x, y));
                            this.ensureVisible(x, y);
                            this.$map.focus();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        event.preventDefault();
                        //#endregion
                        return;
                    }
                    this.startUndoGroup();
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (y < this.$area.size.height - 1) {
                        y++;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.removeExit(RoomExit.South);
                        else
                            this.selectedFocusedRoom.addExit(RoomExit.South);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.North);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.North);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        this.resizeMap(0, 1, 0, shiftType.top | shiftType.left);
                        p = this.selectedFocusedRoom;
                        y = p.y + 1;
                        this.selectedFocusedRoom.addExit(RoomExit.South);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.North);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 99: //num3
                    //#region southeast
                    if (!this.$allowExitWalk) {
                        //#region
                        if (e.shiftKey) {
                            let sf = this.$shiftRoom;
                            let ef = this.$focusedRoom;
                            if (!ef) {
                                ef = this.getRoom(0, 0);
                                this.setFocusedRoom(this.selectedRoom);
                            }
                            if (!sf) sf = ef;
                            x = sf.x;
                            y = sf.y;
                            if (y < this.$area.size.height - 1 && x < this.$area.size.width - 1) {
                                y++;
                                x++;
                                this.ensureVisible(x, y);
                                sf = this.getRoom(x, y);
                                x = Math.min(ef.x, sf.x);
                                y = Math.min(ef.y, sf.y);
                                width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                                height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                                this.setSelection(x, y, width, height);
                                this.$map.focus();
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y - 1][u], true);
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y][u], true);
                            }
                            this.$shiftRoom = sf;
                        }
                        else if (this.$selectedRooms.length === 0) {
                            this.$selectedRooms.push(this.getRoom(0, 0));
                            this.ChangeSelection();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        else if (y < this.$area.size.height - 1 && x < this.$area.size.width - 1) {
                            y++;
                            x++;
                            this.setSelectedRooms(this.getRoom(x, y));
                            this.ensureVisible(x, y);
                            this.$map.focus();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        event.preventDefault();
                        //#endregion
                        return;
                    }
                    this.startUndoGroup();
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (y < this.$area.size.height - 1 && x < this.$area.size.width - 1) {
                        y++;
                        x++;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.removeExit(RoomExit.SouthEast);
                        else
                            this.selectedFocusedRoom.addExit(RoomExit.SouthEast);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.NorthWest);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.NorthWest);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        if (y === this.$area.size.height - 1 && x === this.$area.size.width - 1)
                            this.resizeMap(1, 1, 0, shiftType.top | shiftType.left);
                        else if (y === this.$area.size.height - 1)
                            this.resizeMap(0, 1, 0, shiftType.top | shiftType.left);
                        else
                            this.resizeMap(1, 0, 0, shiftType.top | shiftType.left);
                        p = this.selectedFocusedRoom;
                        y = p.y + 1;
                        x = p.x + 1;
                        this.selectedFocusedRoom.addExit(RoomExit.SouthEast);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.NorthWest);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 100: //num4
                    //#region west
                    if (!this.$allowExitWalk) {
                        //#region
                        if (e.shiftKey) {
                            let sf = this.$shiftRoom;
                            let ef = this.$focusedRoom;
                            if (!ef) {
                                ef = this.getRoom(0, 0);
                                this.setFocusedRoom(this.selectedRoom);
                            }
                            if (!sf) sf = ef;
                            x = sf.x;
                            y = sf.y;
                            if (x > 0) {
                                x--;
                                this.ensureVisible(x, y);
                                sf = this.getRoom(x, y);
                                x = Math.min(ef.x, sf.x);
                                y = Math.min(ef.y, sf.y);
                                width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                                height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                                this.setSelection(x, y, width, height);
                                this.$map.focus();
                                for (let u = y; u < height; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][u][sf.x + 1], true);
                                for (let u = y; u < height; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][u][sf.x], true);
                            }
                            this.$shiftRoom = sf;
                        }
                        else if (this.$selectedRooms.length === 0) {
                            this.$selectedRooms.push(this.getRoom(0, 0));
                            this.ChangeSelection();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        else if (x > 0) {
                            x--;
                            this.setSelectedRooms(this.getRoom(x, y));
                            this.ensureVisible(x, y);
                            this.$map.focus();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        event.preventDefault();
                        //#endregion
                        return;
                    }
                    this.startUndoGroup();
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (x > 0) {
                        x--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.removeExit(RoomExit.West);
                        else
                            this.selectedFocusedRoom.addExit(RoomExit.West);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.East);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.East);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        this.resizeMap(1, 0, 0, shiftType.top | shiftType.right);
                        p = this.selectedFocusedRoom;
                        x = p.x - 1;
                        this.selectedFocusedRoom.addExit(RoomExit.West);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.East);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 101: //num5
                    break;
                case 102: //num6
                    //#region east
                    if (!this.$allowExitWalk) {
                        //#region
                        if (e.shiftKey) {
                            let sf = this.$shiftRoom;
                            let ef = this.$focusedRoom;
                            if (!ef) {
                                ef = this.getRoom(0, 0);
                                this.setFocusedRoom(this.selectedRoom);
                            }
                            if (!sf) sf = ef;
                            x = sf.x;
                            y = sf.y;
                            if (x < this.$area.size.width - 1) {
                                x++;
                                this.ensureVisible(x, y);
                                sf = this.getRoom(x, y);
                                x = Math.min(ef.x, sf.x);
                                y = Math.min(ef.y, sf.y);
                                width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                                height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                                this.setSelection(x, y, width, height);
                                this.$map.focus();
                                for (let u = y; u < height; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][u][sf.x - 1], true);
                                for (let u = y; u < height; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][u][sf.x], true);
                            }
                            this.$shiftRoom = sf;
                        }
                        else if (this.$selectedRooms.length === 0) {
                            this.$selectedRooms.push(this.getRoom(0, 0));
                            this.ChangeSelection();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        else if (x < this.$area.size.width - 1) {
                            x++;
                            this.setSelectedRooms(this.getRoom(x, y));
                            this.ensureVisible(x, y);
                            this.$map.focus();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        event.preventDefault();
                        //#endregion
                        return;
                    }
                    this.startUndoGroup();
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (x < this.$area.size.width - 1) {
                        x++;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.removeExit(RoomExit.East);
                        else
                            this.selectedFocusedRoom.addExit(RoomExit.East);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.West);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.West);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        this.resizeMap(1, 0, 0, shiftType.top | shiftType.left);
                        p = this.selectedFocusedRoom;
                        x = p.x + 1;
                        this.selectedFocusedRoom.addExit(RoomExit.East);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.West);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 103: //num7
                    //#region northwest
                    if (!this.$allowExitWalk) {
                        //#region
                        if (e.shiftKey) {
                            let sf = this.$shiftRoom;
                            let ef = this.$focusedRoom;
                            if (!ef) {
                                ef = this.getRoom(0, 0);
                                this.setFocusedRoom(this.selectedRoom);
                            }
                            if (!sf) sf = ef;
                            x = sf.x;
                            y = sf.y;
                            if (y > 0 && x > 0) {
                                y--;
                                x--;
                                this.ensureVisible(x, y);
                                sf = this.getRoom(x, y);
                                x = Math.min(ef.x, sf.x);
                                y = Math.min(ef.y, sf.y);
                                width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                                height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                                this.setSelection(x, y, width, height);
                                this.$map.focus();
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y + 1][u], true);
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y][u], true);
                            }
                            this.$shiftRoom = sf;
                        }
                        else if (this.$selectedRooms.length === 0) {
                            this.$selectedRooms.push(this.getRoom(0, 0));
                            this.ChangeSelection();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        else if (y > 0 && x > 0) {
                            y--;
                            x--;
                            this.setSelectedRooms(this.getRoom(x, y));
                            this.ensureVisible(x, y);
                            this.$map.focus();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        event.preventDefault();
                        //#endregion
                        return;
                    }
                    this.startUndoGroup();
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (x > 0 && y > 0) {
                        x--;
                        y--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.removeExit(RoomExit.NorthWest);
                        else
                            this.selectedFocusedRoom.addExit(RoomExit.NorthWest);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.SouthEast);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.SouthEast);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        if (x === 0 && y === 0)
                            this.resizeMap(1, 1, 0, shiftType.bottom | shiftType.right);
                        else if (y === 0)
                            this.resizeMap(0, 1, 0, shiftType.bottom | shiftType.right);
                        else
                            this.resizeMap(1, 0, 0, shiftType.bottom | shiftType.right);
                        p = this.selectedFocusedRoom;
                        x = p.x - 1;
                        y = p.y - 1;
                        this.selectedFocusedRoom.addExit(RoomExit.NorthWest);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.SouthEast);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 104: //num8
                    //#region north
                    if (!this.$allowExitWalk) {
                        //#region
                        if (e.shiftKey) {
                            let sf = this.$shiftRoom;
                            let ef = this.$focusedRoom;
                            if (!ef) {
                                ef = this.getRoom(0, 0);
                                this.setFocusedRoom(this.selectedRoom);
                            }
                            if (!sf) sf = ef;
                            x = sf.x;
                            y = sf.y;
                            if (y > 0) {
                                y--;
                                this.ensureVisible(x, y);
                                sf = this.getRoom(x, y);
                                x = Math.min(ef.x, sf.x);
                                y = Math.min(ef.y, sf.y);
                                width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                                height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                                this.setSelection(x, y, width, height);
                                this.$map.focus();
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y + 1][u], true);
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y][u], true);
                            }
                            this.$shiftRoom = sf;
                        }
                        else if (this.$selectedRooms.length === 0) {
                            this.$selectedRooms.push(this.getRoom(0, 0));
                            this.ChangeSelection();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        else if (y > 0) {
                            y--;
                            this.setSelectedRooms(this.getRoom(x, y));
                            this.ensureVisible(x, y);
                            this.$map.focus();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        event.preventDefault();
                        //#endregion                        return;
                    }
                    this.startUndoGroup();
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (y > 0) {
                        y--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.removeExit(RoomExit.North);
                        else
                            this.selectedFocusedRoom.addExit(RoomExit.North);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.South);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.South);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        this.resizeMap(0, 1, 0, shiftType.bottom | shiftType.left);
                        p = this.selectedFocusedRoom;
                        y = p.y - 1;
                        this.selectedFocusedRoom.addExit(RoomExit.North);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.South);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 105: //num9
                    //#region northeast
                    if (!this.$allowExitWalk) {
                        //#region
                        if (e.shiftKey) {
                            let sf = this.$shiftRoom;
                            let ef = this.$focusedRoom;
                            if (!ef) {
                                ef = this.getRoom(0, 0);
                                this.setFocusedRoom(this.selectedRoom);
                            }
                            if (!sf) sf = ef;
                            x = sf.x;
                            y = sf.y;
                            if (x < this.$area.size.width - 1 && y > 0) {
                                y--;
                                x++;
                                this.ensureVisible(x, y);
                                sf = this.getRoom(x, y);
                                x = Math.min(ef.x, sf.x);
                                y = Math.min(ef.y, sf.y);
                                width = Math.ceil(Math.max(((ef.x * 32) + 17) / 32, ((sf.x * 32) + 17) / 32));
                                height = Math.ceil(Math.max(((ef.y * 32) + 17) / 32, ((sf.y * 32) + 17) / 32));
                                this.setSelection(x, y, width, height);
                                this.$map.focus();
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y + 1][u], true);
                                for (let u = x; u < width; u++)
                                    this.DrawRoom(this.$mapContext, this.$area.rooms[this.$depth][sf.y][u], true);
                            }
                            this.$shiftRoom = sf;
                        }
                        else if (this.$selectedRooms.length === 0) {
                            this.$selectedRooms.push(this.getRoom(0, 0));
                            this.ChangeSelection();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        else if (x < this.$area.size.width - 1 && y > 0) {
                            y--;
                            x++;
                            this.setSelectedRooms(this.getRoom(x, y));
                            this.ensureVisible(x, y);
                            this.$map.focus();
                            this.setFocusedRoom(this.selectedRoom);
                        }
                        event.preventDefault();
                        //#endregion
                        return;
                    }
                    this.startUndoGroup();
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (x < this.$area.size.width - 1 && y > 0) {
                        x++;
                        y--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.removeExit(RoomExit.NorthEast);
                        else
                            this.selectedFocusedRoom.addExit(RoomExit.NorthEast);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.SouthWest);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.SouthWest);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        if (x === this.$area.size.width - 1 && y === 0)
                            this.resizeMap(1, 1, 0, shiftType.bottom | shiftType.left);
                        else if (y === 0)
                            this.resizeMap(0, 1, 0, shiftType.bottom | shiftType.left);
                        else
                            this.resizeMap(1, 0, 0, shiftType.bottom | shiftType.left);
                        p = this.selectedFocusedRoom;
                        x = p.x + 1;
                        y = p.y - 1;
                        this.selectedFocusedRoom.addExit(RoomExit.NorthEast);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.SouthWest);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 107: //+
                    break;
                case 109: //-
                    break;
                case 111: // / up
                    //#region
                    if (this.$selectedRooms.length === 0)
                        return;
                    this.startUndoGroup();
                    if (this.$depth + 1 < this.$area.size.depth) {
                        this.$depth++;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.removeExit(RoomExit.Up);
                        else
                            this.selectedFocusedRoom.addExit(RoomExit.Up);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y, this.$depth), true);
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.Down);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.Down);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                        }
                        this.setFocusedRoom(null);
                        this.doUpdate(UpdateType.drawMap);
                        this.$map.focus();
                        this.emit('rebuild-buttons');
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        this.resizeMap(0, 0, 1, shiftType.down);
                        this.$depth = this.selectedFocusedRoom.z + 1;
                        this.selectedFocusedRoom.addExit(RoomExit.Up);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y, this.$depth), true);
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.Down);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                        }
                        this.setFocusedRoom(null);
                        this.doUpdate(UpdateType.drawMap);
                        this.$map.focus();
                        this.emit('rebuild-buttons');
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
                case 106: // * down
                    //#region
                    if (this.$selectedRooms.length === 0)
                        return;
                    this.startUndoGroup();
                    if (this.$depth - 1 >= 0) {
                        this.$depth--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.removeExit(RoomExit.Down);
                        else
                            this.selectedFocusedRoom.addExit(RoomExit.Down);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y, this.$depth), true);
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.removeExit(RoomExit.Up);
                            else
                                this.selectedFocusedRoom.addExit(RoomExit.Up);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                        }
                        this.setFocusedRoom(null);
                        this.doUpdate(UpdateType.drawMap);
                        this.$map.focus();
                        this.emit('rebuild-buttons');
                    }
                    else if (!e.ctrlKey && this.$allowResize) {
                        this.resizeMap(0, 0, 1, shiftType.up);
                        this.$depth = this.selectedFocusedRoom.z - 1;
                        this.selectedFocusedRoom.addExit(RoomExit.Down);
                        if (o !== this.selectedFocusedRoom.exits) {
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y, this.$depth), true);
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.Up);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.RoomChanged(this.selectedFocusedRoom, or);
                            }
                        }
                        this.setFocusedRoom(null);
                        this.doUpdate(UpdateType.drawMap);
                        this.$map.focus();
                        this.emit('rebuild-buttons');
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    this.stopUndoGroup();
                    //#endregion
                    break;
            }
        });
        this.$map.addEventListener('focus', (e) => {
            this.setFocus(true);
        });
        this.$map.addEventListener('blur', (e) => {
            this.setFocus(false);
        });
        this.$roomEditor = new PropertyGrid({ parent: this.$splitterEditor.panel2 });
        this.$roomEditor.readonly = (prop, value, object) => {
            if (object && object.filter(o => o.ef).length !== 0)
                return prop !== 'ef';
            return prop === 'ef';
        };
        this.$roomEditor.on('dialog-open', () => this.emit('dialog-open'));
        this.$roomEditor.on('dialog-close', () => this.emit('dialog-close'));
        this.$roomEditor.on('dialog-cancel', () => this.emit('dialog-cancel'));
        this.$roomEditor.on('open-file', (property) => {
            let f;
            if (this.$area.size.depth > 1)
                f = this.selectedFocusedRoom.x + ',' + this.selectedFocusedRoom.y + ',' + this.selectedFocusedRoom.z + '.c';
            else
                f = this.selectedFocusedRoom.x + ',' + this.selectedFocusedRoom.y + '.c';
            this.emit('open-file', path.join(path.dirname(this.file), f));
        });
        this.$roomEditor.on('browse-file', e => {
            this.emit('browse-file', e);
        });
        this.$roomEditor.on('value-changed', (prop, newValue, oldValue) => {
            const selected = this.$roomEditor.objects;
            let sl = selected.length;
            const oldValues = [];
            const mx = this.$mouse.rx;
            const my = this.$mouse.ry;
            if (prop === 'exitsDetails') {
                this.startUndoGroup();
                const oldEE = [];
                const oldClimb = [];
                const oldExits = [];
                const ed = {};
                let exits = 0;
                let ee = 0;
                let climbs = 0;

                sl = newValue.length;
                while (sl--) {
                    ed[newValue[sl].exit] = newValue[sl];
                    if (newValue[sl].climb)
                        climbs |= RoomExits[newValue[sl].exit];
                    if (newValue[sl].dest.length > 0)
                        ee |= RoomExits[newValue[sl].exit];
                    else
                        exits |= RoomExits[newValue[sl].exit];
                }
                sl = selected.length;
                while (sl--) {
                    const curr = selected[sl];
                    const old = this.getRoom(curr.x, curr.y, curr.z);

                    oldValues[sl] = old['exitsDetails'];
                    oldEE[sl] = old['external'];
                    oldClimb[sl] = old['climbs'];
                    oldExits[sl] = old['exits'];

                    curr['exitsDetails'] = ed;
                    curr['external'] = ee;
                    curr['climbs'] = climbs;
                    curr['exits'] = exits;

                    this.RoomChanged(curr, old, true);

                    old['exitsDetails'] = ed;
                    old['external'] = ee;
                    old['climbs'] = climbs;
                    old['exits'] = exits;
                    this.DrawRoom(this.$mapContext, old, true, old.at(mx, my));
                }
                const rooms = selected.map(m => [m.x, m.y, m.z]);
                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: oldValues, rooms: rooms });
                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: oldExits, rooms: rooms });
                this.pushUndo(undoAction.edit, undoType.room, { property: 'external', values: oldEE, rooms: rooms });
                this.pushUndo(undoAction.edit, undoType.room, { property: 'climbs', values: oldClimb, rooms: rooms });
                this.stopUndoGroup();

            }
            else if (prop === 'type') {
                const nDefault = this.$area.baseRooms[newValue] || new Room(0, 0, 0);
                while (sl--) {
                    const curr = selected[sl];
                    const old = this.getRoom(curr.x, curr.y, curr.z);
                    const oDefault = this.$area.baseRooms[old.type];
                    oldValues[sl] = old.clone();
                    for (prop in oDefault) {
                        if (prop === 'type' || prop === 'x' || prop === 'y' || prop === 'z' || !oDefault.hasOwnProperty(prop)) continue;
                        if (oDefault && curr[prop] === oDefault[prop])
                            curr[prop] = copy(nDefault[prop]);
                    }
                    curr.type = newValue;
                    this.RoomChanged(curr, old, true);
                    for (prop in oDefault) {
                        if (prop === 'type' || prop === 'x' || prop === 'y' || prop === 'z' || !oDefault.hasOwnProperty(prop)) continue;
                        if (oDefault && old[prop] === oDefault[prop])
                            old[prop] = copy(nDefault[prop]);
                    }
                    old.type = newValue;
                    this.DrawRoom(this.$mapContext, old, true, old.at(mx, my));
                }
                this.pushUndo(undoAction.delete, undoType.room, oldValues);
            }
            else {
                while (sl--) {
                    const curr = selected[sl];
                    const old = this.getRoom(curr.x, curr.y, curr.z);
                    switch (prop) {
                        case 'monsters':
                        case 'objects':
                        case 'sounds':
                        case 'smells':
                        case 'searches':
                        case 'items':
                            oldValues[sl] = copy(old[prop]);
                            curr[prop] = copy(newValue);
                            this.RoomChanged(curr, old, true);
                            old[prop] = copy(newValue);
                            break;
                        default:
                            oldValues[sl] = old[prop];
                            curr[prop] = newValue;
                            this.RoomChanged(curr, old, true);
                            old[prop] = newValue;
                            this.DrawRoom(this.$mapContext, old, true, old.at(mx, my));
                            break;
                    }
                }
                this.pushUndo(undoAction.edit, undoType.room, { property: prop, values: oldValues, rooms: selected.map(m => [m.x, m.y, m.z]) });
            }
            setTimeout(() => this.UpdateEditor(this.$selectedRooms));
            this.UpdatePreview(this.selectedFocusedRoom);
        });
        this.$roomEditor.setPropertyOptions([
            {
                property: 'x',
                group: 'Location',
                readonly: true
            },
            {
                property: 'y',
                group: 'Location',
                readonly: true
            },
            {
                property: 'z',
                group: 'Location',
                readonly: true,
                visible: false
            },
            {
                property: 'exitsDetails',
                label: 'Exits',
                group: 'Exits',
                formatter: this.formatCollection,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Exit',
                                field: 'exit',
                                width: 150,
                                editor: {
                                    type: EditorType.dropdown,
                                    options: {
                                        data: [
                                            'north',
                                            'northeast',
                                            'east',
                                            'southeast',
                                            'south',
                                            'southwest',
                                            'west',
                                            'northwest',
                                            'out',
                                            'enter',
                                            'up',
                                            'down',
                                            'portal',
                                            'swim',
                                            'dive',
                                            'surface'
                                        ]
                                    }
                                }
                            },
                            {
                                label: 'Destination',
                                field: 'dest',
                                width: 300,
                                spring: true,
                                editor: {
                                    type: EditorType.custom,
                                    editor: FileBrowseValueEditor,
                                    options: {
                                        placeholder: 'Input file path to create external exit'
                                    },
                                    show: (prop, value) => {
                                        return value;
                                    }
                                }
                            },
                            {
                                label: 'Door',
                                field: 'door',
                                width: 150,
                                editor: {
                                    type: EditorType.dropdown,
                                    options: {
                                        data: [
                                            'door',
                                            'doors',
                                            'gate',
                                            'gates'
                                        ]
                                    }
                                }
                            },
                            {
                                label: 'Key ID',
                                field: 'key',
                                width: 200,
                                editor: {
                                    options: {
                                        singleLine: true
                                    }
                                }
                            },
                            {
                                label: 'Hidden',
                                field: 'hidden',
                                width: 60
                            },
                            {
                                label: 'Blocker',
                                field: 'blocker',
                                width: 200,
                                spring: true,
                                editor: {
                                    options: {
                                        singleLine: true
                                    }
                                }
                            },
                            {
                                label: 'Prevent peer',
                                field: 'peer',
                                width: 200,
                                spring: true,
                                editor: {
                                    options: {
                                        singleLine: true
                                    }
                                }
                            },
                            {
                                label: 'Destination Door',
                                field: 'destDoor',
                                width: 200,
                                editor: {
                                    type: EditorType.dropdown,
                                    options: {
                                        data: [
                                            'door',
                                            'doors',
                                            'gate',
                                            'gates'
                                        ]
                                    }
                                }
                            },
                            {
                                label: 'Locked',
                                field: 'locked',
                                width: 60
                            },
                            {
                                label: 'Climb',
                                field: 'climb',
                                width: 60
                            },
                            {
                                label: 'Climbing Difficulty',
                                field: 'diff',
                                width: 130
                            }
                        ],
                        add: (e) => {
                            e.data = new Exit();
                        },
                        type: 'exit',
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 1
            },
            {
                property: 'external',
                group: 'Exits',
                formatter: this.formatExits,
                readonly: true,
                sort: 2
            },
            {
                property: 'climbs',
                group: 'Exits',
                formatter: this.formatExits,
                readonly: true,
                sort: 3
            },
            {
                property: 'exits',
                group: 'Exits',
                formatter: this.formatExits,
                visible: false,
                sort: 4
            },
            {
                property: 'items',
                group: 'Description',
                formatter: this.formatCollection,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Item',
                                field: 'item',
                                width: 150,
                                editor: {
                                    options: {
                                        singleLine: true
                                    }
                                }
                            },
                            {
                                label: 'Description',
                                field: 'description',
                                spring: true,
                                width: 200
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                item: '',
                                description: ''
                            };
                        },
                        type: 'item',
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 2
            },
            {
                property: 'short',
                group: 'Description',
                sort: 0,
                editor: {
                    options: {
                        singleLine: true,
                        container: document.body
                    }
                }
            },
            {
                property: 'long',
                group: 'Description',
                sort: 1,
                editor: {
                    options: {
                        singleLine: true,
                        container: document.body
                    }
                }
            },
            {
                property: 'terrain',
                group: 'Description',
                label: 'Terrain',
                editor: {
                    type: EditorType.dropdown,
                    options: {
                        data: [
                            'beach',
                            'bog',
                            'city',
                            'cliff',
                            'cobble',
                            'desert',
                            'dirt',
                            'dirtroad',
                            'farmland',
                            'forest',
                            'grass',
                            'grassland',
                            'highmountain',
                            'hills',
                            'icesheet',
                            'jungle',
                            'lake',
                            'mountain',
                            'ocean',
                            'pavedroad',
                            'plains',
                            'prairie',
                            'river',
                            'rockdesert',
                            'rocky',
                            'sand',
                            'sanddesert',
                            'savannah',
                            'stone',
                            'swamp',
                            'tundra',
                            'underwater',
                            'water'
                        ],
                        container: document.body
                    }
                },
                sort: 3
            },
            {
                property: 'sound',
                label: 'Default sound',
                group: 'Description',
                sort: 5,
                editor: {
                    options: {
                        singleLine: true,
                        container: document.body
                    }
                }
            },
            {
                property: 'smell',
                label: 'Default smell',
                group: 'Description',
                sort: 5,
                editor: {
                    options: {
                        singleLine: true,
                        container: document.body
                    }
                }
            },
            {
                property: 'objects',
                group: 'Description',
                formatter: this.formatCollection,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 2
            },
            {
                property: 'monsters',
                group: 'Description',
                formatter: this.formatCollection,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 2
            },
            {
                property: 'type',
                formatter: this.formatType,
                group: 'Advanced',
                editor: {
                    type: EditorType.select,
                    options: {
                        data: [{ value: 'base', display: 'Base', group: 'Area' }].concat(...RoomTypes)
                    }
                },
                sort: 0
            },
            {
                property: 'sounds',
                group: 'Advanced',
                sort: 2,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Sound',
                                field: 'sound',
                                width: 150,
                                editor: {
                                    options: {
                                        singleLine: true
                                    }
                                }
                            },
                            {
                                label: 'Description',
                                field: 'description',
                                spring: true,
                                width: 200
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                sound: '',
                                description: ''
                            };
                        },
                        type: 'sound',
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                }
            },
            {
                property: 'smells',
                group: 'Advanced',
                formatter: this.formatCollection,
                sort: 3,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Smell',
                                field: 'smell',
                                width: 150,
                                editor: {
                                    options: {
                                        singleLine: true
                                    }
                                }
                            },
                            {
                                label: 'Description',
                                field: 'description',
                                spring: true,
                                width: 200
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                smell: '',
                                description: ''
                            };
                        },
                        type: 'smell',
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                }
            },
            {
                property: 'searches',
                group: 'Advanced',
                formatter: this.formatCollection,
                sort: 4,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Search',
                                field: 'search',
                                width: 150,
                                editor: {
                                    options: {
                                        singleLine: true
                                    }
                                }
                            },
                            {
                                label: 'Message',
                                field: 'message',
                                spring: true,
                                width: 200
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                search: '',
                                message: ''
                            };
                        },
                        type: 'search',
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                }
            },
            {
                property: 'subArea',
                label: 'Sub area',
                group: 'Advanced',
                sort: 1,
                editor: {
                    options: {
                        singleLine: true,
                        container: document.body
                    }
                }
            },
            {
                property: 'light',
                group: 'Properties',
                sort: 0,
                editor: {
                    options: {
                        min: -15,
                        max: 15
                    }
                }
            },
            {
                property: 'nightAdjust',
                label: 'Night adjustment',
                group: 'Properties',
                sort: 1,
                editor: {
                    options: {
                        min: -15,
                        max: 15
                    }
                }
            },
            {
                label: 'Properties',
                sort: 2,
                property: 'flags',
                group: 'Properties',
                editor: {
                    type: EditorType.flag,
                    options: {
                        enum: RoomFlags,
                        container: document.body
                    }
                }
            },
            {
                property: 'forage',
                group: 'Properties',
                sort: 3,
                editor: {
                    options: {
                        min: -1,
                        max: 40
                    }
                }
            },
            {
                property: 'maxForage',
                label: 'Max forage',
                group: 'Properties',
                sort: 4,
                editor: {
                    options: {
                        min: -1,
                        max: 40
                    }
                }
            },
            {
                property: 'secretExit',
                label: 'Secret exit',
                group: 'Properties',
                sort: 5,
                editor: {
                    options: {
                        singleLine: true,
                        container: document.body
                    }
                }
            },
            {
                property: 'dirtType',
                label: 'Dirt type',
                group: 'Properties',
                sort: 6,
                editor: {
                    options: {
                        singleLine: true,
                        container: document.body
                    }
                }
            },
            {
                property: 'preventPeer',
                label: 'Prevent peer',
                group: 'Properties',
                sort: 7,
                editor: {
                    options: {
                        singleLine: true,
                        container: document.body
                    }
                }
            },
            {
                property: 'temperature',
                label: 'Temperature',
                group: 'Properties',
                sort: 8,
                editor: {
                    options: {
                        min: -1000,
                        max: 1000
                    }
                }
            }
        ]);
        this.doUpdate(UpdateType.resize);
        this.$resizer = new ResizeObserver((entries, observer) => {
            if (entries.length === 0) return;
            if (!entries[0].contentRect || entries[0].contentRect.width === 0 || entries[0].contentRect.height === 0)
                return;
            if (!this.$resizerCache || this.$resizerCache.width !== entries[0].contentRect.width || this.$resizerCache.height !== entries[0].contentRect.height) {
                this.$resizerCache = { width: entries[0].contentRect.width, height: entries[0].contentRect.height };
                this.doUpdate(UpdateType.resize);
            }
        });
        this.$resizer.observe(this.$mapContainer);
        this.$observer = new MutationObserver((mutationsList) => {
            let mutation;
            for (mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (mutation.oldValue === 'display: none;')
                        this.doUpdate(UpdateType.resize);
                }
            }
        });
        this.$observer.observe(this.$mapContainer, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
        //#endregion
        //#region create properties editor
        let el;
        this.$propertiesEditor = {
            container: document.createElement('div'),
            generalTab: document.createElement('div'),
            monstersTab: document.createElement('div'),
            roomsTab: document.createElement('div'),
            tabs: document.createElement('ul'),
            tabsContents: document.createElement('div')
        };
        this.$propertiesEditor.container.classList.add('tabbable', 'tabs-left', 'area-editor-properties');
        this.$propertiesEditor.tabs.classList.add('nav', 'nav-tabs');
        this.$propertiesEditor.tabs.style.height = '100%';
        this.$propertiesEditor.tabs.innerHTML = '<li class="active"><a href="#' + this.parent.id + 'general" data-toggle="tab">General</a></li><li><a href="#' + this.parent.id + 'rooms" data-toggle="tab">Base rooms</a></li><li><a href="#' + this.parent.id + 'monsters" data-toggle="tab">Base monsters</a></li>';
        this.$propertiesEditor.container.appendChild(this.$propertiesEditor.tabs);
        this.$propertiesEditor.tabsContents.classList.add('tab-content');
        this.$propertiesEditor.container.appendChild(this.$propertiesEditor.tabsContents);
        this.$propertiesEditor.tabsContents.appendChild(this.$propertiesEditor.generalTab);
        this.$propertiesEditor.tabsContents.appendChild(this.$propertiesEditor.monstersTab);
        this.$propertiesEditor.tabsContents.appendChild(this.$propertiesEditor.roomsTab);
        this.$propertiesEditor.generalTab.id = this.parent.id + 'general';
        this.$propertiesEditor.generalTab.classList.add('tab-pane', 'active');
        this.$propertiesEditor.generalTab.innerHTML = `
        <div class="form-group">
            <label class="control-label">Default room
                <br>
                <select class="form-control selectpicker" data-container="body" data-width="250px">
                </select>
            </label>
        </div>
        <div class="form-group">
            <label class="control-label">Default monster
                <br>
                <select class="form-control selectpicker" data-container="body" data-width="250px">
                </select>
            </label>
        </div>`;
        el = this.$propertiesEditor.generalTab.querySelectorAll('select');
        el[0].innerHTML = '<optgroup label="Area"><option value="base">Base</option></optgroup><optgroup label="Standard">' +
            RoomTypes.map(r => `<option value="${r.value}">${r.display}</option>`).join('') + '</optgroup>';
        el[1].innerHTML = '<optgroup label="Area"><option value="base">Base</option></optgroup><optgroup label="Standard">' +
            MonsterTypes.map(r => `<option value="${r.value}">${r.display}</option>`).join('') + '</optgroup>';
        this.$propertiesEditor.defaultRoom = $(el[0]).selectpicker();
        this.$propertiesEditor.defaultRoom.on('change', () => {
            this.pushUndo(undoAction.edit, undoType.properties, { property: 'defaultRoom', old: this.$area.defaultRoom, new: this.$propertiesEditor.defaultRoom.val() });
            this.$area.defaultRoom = this.$propertiesEditor.defaultRoom.val();
            this.changed = true;
        });
        this.$propertiesEditor.defaultMonster = $(el[1]).selectpicker();
        this.$propertiesEditor.defaultMonster.on('change', () => {
            this.pushUndo(undoAction.edit, undoType.properties, { property: 'defaultMonster', old: this.$area.defaultMonster, new: this.$propertiesEditor.defaultMonster.val() });
            this.$area.defaultMonster = this.$propertiesEditor.defaultMonster.val();
            this.changed = true;
        });
        this.$propertiesEditor.roomsTab.id = this.parent.id + 'rooms';
        this.$propertiesEditor.roomsTab.classList.add('tab-pane');
        this.$propertiesEditor.monstersTab.id = this.parent.id + 'monsters';
        this.$propertiesEditor.monstersTab.classList.add('tab-pane');
        this.$propertiesEditor.container.style.display = 'none';
        el = document.createElement('div');
        el.classList.add('datagrid-standard');
        this.$propertiesEditor.monsterGrid = new DataGrid(el);
        this.$propertiesEditor.monsterGrid.clipboardPrefix = 'jiMUD/';
        this.$propertiesEditor.monsterGrid.enterMoveFirst = this.$enterMoveFirst;
        this.$propertiesEditor.monsterGrid.enterMoveNext = this.$enterMoveNext;
        this.$propertiesEditor.monsterGrid.enterMoveNew = this.$enterMoveNew;
        this.$propertiesEditor.monsterGrid.columns = [
            {
                label: 'Name',
                field: 'name',
                width: 150,
                spring: true,
                editor: {
                    options: {
                        singleLine: true,
                        validate: (oldValue, newValue) => {
                            if (oldValue !== newValue && this.$area.baseMonsters[newValue])
                                return `Base monster named ${newValue} already exist!`;
                            return true;
                        }
                    }
                }
            },
            {
                label: 'Max amount',
                field: 'maxAmount',
                width: 150
            },
            {
                field: 'objects',
                label: 'Objects',
                sortable: false,
                formatter: this.formatCollection,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 2
            },
            {
                field: 'monster',
                sortable: false,
                label: '',
                width: 32,
                formatter: () => '',
                editor: {
                    type: EditorType.button,
                    options: {
                        click: ed => {
                            this.emit('show-monster-wizard', {
                                title: 'Edit base monster',
                                data: {
                                    'mon-wiz-welcome-message': 'Welcome to the base monster editor, this will take you through the steps to edit a monster quickly and easily. You may finish at any time to save your current selections.',
                                    'mon-wiz-area-types': Object.keys(this.$area.baseMonsters || { base: null }).filter(r => r !== ed.value.type).map(r => {
                                        return {
                                            value: r,
                                            display: capitalize(r),
                                            group: 'Area'
                                        };
                                    }),
                                    'mon-wiz-type': ed.value.type || 'base',
                                    'mon-wiz-level': '' + ed.value.level,
                                    'mon-wiz-alignment': '' + ed.value.alignment,
                                    'mon-wiz-race': ed.value.race,
                                    'mon-wiz-class': ed.value.class,
                                    'mon-wiz-language': ed.value.language,
                                    'mon-wiz-ridable': (ed.value.flags & MonsterFlags.Ridable) === MonsterFlags.Ridable,
                                    'mon-wiz-flying': (ed.value.flags & MonsterFlags.Flying) === MonsterFlags.Flying,
                                    'mon-wiz-getable': (ed.value.flags & MonsterFlags.Getable) === MonsterFlags.Getable,
                                    'mon-wiz-undead': (ed.value.flags & MonsterFlags.Undead) === MonsterFlags.Undead,
                                    'mon-wiz-waterbreathing': (ed.value.flags & MonsterFlags.Water_Breathing) === MonsterFlags.Water_Breathing,
                                    'mon-wiz-requires-water': (ed.value.flags & MonsterFlags.Requires_Water) === MonsterFlags.Requires_Water,
                                    'mon-wiz-no-bleed': (ed.value.flags & MonsterFlags.No_Bleeding) === MonsterFlags.No_Bleeding,
                                    'mon-wiz-name': ed.value.name,
                                    'mon-wiz-short': ed.value.short,
                                    'mon-wiz-nouns': ed.value.nouns,
                                    'mon-wiz-adjectives': ed.value.adjectives,
                                    'mon-wiz-long': ed.value.long,
                                    'mon-wiz-mass': '' + ed.value.mass,
                                    'mon-wiz-height': '' + ed.value.height,
                                    'mon-wiz-eye': ed.value.eyeColor,
                                    'mon-wiz-hair': ed.value.hairColor,
                                    'mon-wiz-gender': ed.value.gender,
                                    'mon-wiz-body': ed.value.bodyType,
                                    'mon-wiz-no-corpse': ed.value.noCorpse,
                                    'mon-wiz-no-limbs': ed.value.noLimbs,
                                    'mon-wiz-commands': ed.value.attackCommands,
                                    'mon-wiz-chance': '' + ed.value.attackCommandChance,
                                    'mon-wiz-initiators': ed.value.attackInitiators,
                                    'mon-wiz-aggressive': ed.value.aggressive,
                                    'mon-wiz-speed': '' + ed.value.speed,
                                    'mon-wiz-patrol': ed.value.patrolRoute,
                                    'mon-wiz-no-walk': ed.value.noWalkRooms,
                                    'mon-wiz-auto-drop': '' + ed.value.autoDrop.time,
                                    'mon-wiz-auto-drop-enabled': ed.value.autoDrop.enabled,
                                    'mon-wiz-storage': '' + ed.value.openStorage.time,
                                    'mon-wiz-storage-enabled': ed.value.openStorage.enabled,
                                    'mon-wiz-auto-wield': '' + ed.value.autoWield.time,
                                    'mon-wiz-auto-wield-enabled': ed.value.autoWield.enabled,
                                    'mon-wiz-auto-loot': '' + ed.value.autoLoot.time,
                                    'mon-wiz-auto-loot-enabled': ed.value.autoLoot.enabled,
                                    'mon-wiz-auto-wear': '' + ed.value.autoWear.time,
                                    'mon-wiz-auto-wear-enabled': ed.value.autoWear.enabled,
                                    'mon-wiz-wimpy': '' + ed.value.wimpy,
                                    'mon-wiz-drop-encumbered': (ed.value.flags & MonsterFlags.Drop_encumbered) === MonsterFlags.Drop_encumbered,
                                    'mon-wiz-drop-encumbered-combat': (ed.value.flags & MonsterFlags.Drop_encumbered_combat) === MonsterFlags.Drop_encumbered_combat,
                                    'mon-wiz-auto-stand': (ed.value.flags & MonsterFlags.Auto_Stand) === MonsterFlags.Auto_Stand
                                },
                                finish: e => {
                                    const nMonster = ed.value.clone();
                                    nMonster.flags = RoomFlags.None;
                                    nMonster.type = e.data['mon-wiz-type'].value;
                                    nMonster.level = +e.data['mon-wiz-level'];
                                    nMonster.alignment = +e.data['mon-wiz-alignment'];
                                    nMonster.race = e.data['mon-wiz-race'];
                                    nMonster.class = e.data['mon-wiz-class'];
                                    nMonster.language = e.data['mon-wiz-language'];
                                    if (e.data['mon-wiz-ridable'])
                                        nMonster.flags |= MonsterFlags.Ridable;
                                    if (e.data['mon-wiz-flying'])
                                        nMonster.flags |= MonsterFlags.Flying;
                                    if (e.data['mon-wiz-getable'])
                                        nMonster.flags |= MonsterFlags.Getable;
                                    if (e.data['mon-wiz-undead'])
                                        nMonster.flags |= MonsterFlags.Undead;
                                    if (e.data['mon-wiz-waterbreathing'])
                                        nMonster.flags |= MonsterFlags.Water_Breathing;
                                    if (e.data['mon-wiz-requires-water'])
                                        nMonster.flags |= MonsterFlags.Requires_Water;
                                    if (e.data['mon-wiz-no-bleed'])
                                        nMonster.flags |= MonsterFlags.No_Bleeding;
                                    nMonster.name = e.data['mon-wiz-name'];
                                    nMonster.short = e.data['mon-wiz-short'];
                                    nMonster.nouns = e.data['mon-wiz-nouns'];
                                    nMonster.adjectives = e.data['mon-wiz-adjectives'];
                                    nMonster.long = e.data['mon-wiz-long'];
                                    nMonster.mass = +e.data['mon-wiz-mass'];
                                    nMonster.height = +e.data['mon-wiz-height'];
                                    nMonster.eyeColor = e.data['mon-wiz-eye'];
                                    nMonster.hairColor = e.data['mon-wiz-hair'];
                                    nMonster.gender = e.data['mon-wiz-gender'];
                                    nMonster.bodyType = e.data['mon-wiz-body'];
                                    nMonster.noCorpse = e.data['mon-wiz-no-corpse'];
                                    nMonster.noLimbs = e.data['mon-wiz-no-limbs'];
                                    nMonster.attackCommands = e.data['mon-wiz-commands'];
                                    nMonster.attackCommandChance = +e.data['mon-wiz-chance'];
                                    nMonster.attackInitiators = e.data['mon-wiz-initiators'];
                                    nMonster.aggressive = e.data['mon-wiz-aggressive'];
                                    nMonster.speed = +e.data['mon-wiz-speed'];
                                    nMonster.patrolRoute = e.data['mon-wiz-patrol'];
                                    nMonster.noWalkRooms = e.data['mon-wiz-no-walk'];
                                    nMonster.autoDrop.time = +e.data['mon-wiz-auto-drop'];
                                    nMonster.autoDrop.enabled = e.data['mon-wiz-auto-drop-enabled'];
                                    nMonster.openStorage.time = +e.data['mon-wiz-storage'];
                                    nMonster.openStorage.enabled = e.data['mon-wiz-storage-enabled'];
                                    nMonster.autoWield.time = +e.data['mon-wiz-auto-wield'];
                                    nMonster.autoWield.enabled = e.data['mon-wiz-auto-wield-enabled'];
                                    nMonster.autoLoot.time = +e.data['mon-wiz-auto-loot'];
                                    nMonster.autoLoot.enabled = e.data['mon-wiz-auto-loot-enabled'];
                                    nMonster.autoWear.time = +e.data['mon-wiz-auto-wear'];
                                    nMonster.autoWear.enabled = e.data['mon-wiz-auto-wear-enabled'];
                                    nMonster.wimpy = +e.data['mon-wiz-wimpy'];
                                    if (e.data['mon-wiz-drop-encumbered'])
                                        nMonster.flags |= MonsterFlags.Drop_encumbered;
                                    if (e.data['mon-wiz-drop-encumbered-combat'])
                                        nMonster.flags |= MonsterFlags.Drop_encumbered_combat;
                                    if (e.data['mon-wiz-auto-stand'])
                                        nMonster.flags |= MonsterFlags.Auto_Stand;

                                    if (!nMonster.equals(ed.data.monster))
                                        ed.value = nMonster;
                                    ed.focus();
                                },
                                closed: e => {
                                    ed.focus();
                                }
                            });
                        }
                    }
                },
                sort: 2
            }
        ];
        this.$propertiesEditor.monsterGrid.on('value-changed', (newValue, oldValue, dataIndex) => {
            this.pushUndo(undoAction.edit, undoType.properties, { property: 'baseMonsters', old: oldValue, new: newValue });
            if (oldValue.name !== newValue.name)
                delete this.$area.baseMonsters[oldValue.name];
            newValue.monster.maxAmount = newValue.maxAmount;
            newValue.monster.objects = newValue.objects;
            this.$area.baseMonsters[newValue.name] = newValue.monster;
            this.changed = true;
        });
        this.$propertiesEditor.monsterGrid.on('add', e => {
            this.$new.baseMonsters++;
            this.$area.baseMonsters['base' + this.$new.baseMonsters] = new Monster('STD_MONSTER');
            e.data = {
                name: 'base' + this.$new.baseMonsters,
                maxAmount: this.$area.baseMonsters['base' + this.$new.baseMonsters].maxAmount,
                objects: this.$area.baseMonsters['base' + this.$new.baseMonsters].objects,
                monster: this.$area.baseMonsters['base' + this.$new.baseMonsters]
            };
            this.pushUndo(undoAction.add, undoType.properties, { property: 'baseMonsters', name: 'base' + this.$new.baseMonsters, value: e.data.monster });
            this.changed = true;
        });
        this.$propertiesEditor.monsterGrid.on('cut', (e) => {
            this.pushUndo(undoAction.delete, undoType.properties, {
                property: 'baseMonsters', values: e.data.map(r => {
                    delete this.$area.baseMonsters[r.name];
                    return { name: r.name, value: r.monster };
                })
            });
            this.emit('supports-changed');
            this.changed = true;
        });
        this.$propertiesEditor.monsterGrid.on('copy', () => {
            this.emit('supports-changed');
        });
        this.$propertiesEditor.monsterGrid.on('paste', (e) => {
            this.startUndoGroup();
            e.data.forEach(d => {
                if (this.$area.baseMonsters[d.data.name]) {
                    this.$new.baseMonsters++;
                    d.data.name += this.$new.baseMonsters;
                }
                this.$area.baseMonsters[d.data.name] = new Monster(d.data);
                this.pushUndo(undoAction.add, undoType.properties, { property: 'baseMonsters', name: d.data.name, value: this.$area.baseMonsters[d.data.name] });
            });
            this.stopUndoGroup();
            this.changed = true;
        });
        this.$propertiesEditor.monsterGrid.on('delete', (e) => {
            if (dialog.showMessageBox(
                remote.getCurrentWindow(),
                {
                    type: 'warning',
                    title: 'Delete',
                    message: 'Delete selected base monster' + (this.$propertiesEditor.monsterGrid.selectedCount > 1 ? 's' : '') + '?',
                    buttons: ['Yes', 'No'],
                    defaultId: 1
                })
                === 1)
                e.preventDefault = true;
            else {
                this.pushUndo(undoAction.delete, undoType.properties, {
                    property: 'baseMonsters', values: e.data.map(r => {
                        delete this.$area.baseMonsters[r.name];
                        return { name: r.name, value: r.monster };
                    })
                });
                this.changed = true;
            }
        });
        this.$propertiesEditor.monsterGrid.on('selection-changed', () => {
            if (this.$view !== View.properties) return;
            const group = this.$propertiesEditor.monstersTab.firstChild;
            if (this.$propertiesEditor.monsterGrid.selectedCount) {
                group.children[1].removeAttribute('disabled');
                group.children[2].removeAttribute('disabled');
                if (this.$propertiesEditor.monsterGrid.selectedCount > 1)
                    (<HTMLElement>group.children[2]).title = 'Delete base monsters';
                else
                    (<HTMLElement>group.children[2]).title = 'Delete base monster';
            }
            else {
                group.children[1].setAttribute('disabled', 'true');
                group.children[2].setAttribute('disabled', 'true');
                (<HTMLElement>group.children[2]).title = 'Delete base monster(s)';
            }
            this.emit('selection-changed');
        });
        this.$propertiesEditor.monstersTab.appendChild(this.createButtonGroup(this.$propertiesEditor.monsterGrid, 'base monster'));
        this.$propertiesEditor.monstersTab.appendChild(el);
        el = document.createElement('div');
        el.classList.add('datagrid-standard');
        this.$propertiesEditor.roomGrid = new DataGrid(el);
        this.$propertiesEditor.roomGrid.clipboardPrefix = 'jiMUD/';
        this.$propertiesEditor.roomGrid.enterMoveFirst = this.$enterMoveFirst;
        this.$propertiesEditor.roomGrid.enterMoveNext = this.$enterMoveNext;
        this.$propertiesEditor.roomGrid.enterMoveNew = this.$enterMoveNew;
        this.$propertiesEditor.roomGrid.columns = [
            {
                label: 'Name',
                field: 'name',
                width: 150,
                spring: true,
                editor: {
                    options: {
                        singleLine: true,
                        validate: (oldValue, newValue) => {
                            if (oldValue !== newValue && this.$area.baseRooms[newValue])
                                return `Base room named ${newValue} already exist!`;
                            return true;
                        }
                    }
                }
            },
            {
                field: 'objects',
                label: 'Objects',
                sortable: false,
                formatter: this.formatCollection,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 2
            },
            {
                field: 'monsters',
                label: 'Monsters',
                sortable: false,
                formatter: this.formatCollection,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 2
            },
            {
                field: 'room',
                sortable: false,
                label: '',
                width: 32,
                formatter: () => '',
                editor: {
                    type: EditorType.button,
                    options: {
                        click: ed => {
                            this.emit('show-room-wizard', {
                                title: 'Edit base room',
                                data: {
                                    'room-wiz-welcome-message': 'Welcome to the base room editor, this will take you through the steps to edit a base room quickly and easily. You may finish at any time to save your current selections.',
                                    'room-wiz-area-types': Object.keys(this.$area.baseRooms || { base: null }).filter(r => r !== ed.value.type).map(r => {
                                        return {
                                            value: r,
                                            display: capitalize(r),
                                            group: 'Area'
                                        };
                                    }),
                                    'room-wiz-type': ed.value.type || 'base',
                                    'room-wiz-terrain': ed.value.terrain,
                                    'room-wiz-short': ed.value.short,
                                    'room-wiz-light': '' + ed.value.light,
                                    'room-wiz-night-adjust': '' + ed.value.nightAdjust,
                                    'room-wiz-prevent-peer': ed.value.preventPeer,
                                    'room-wiz-long': ed.value.long,
                                    'room-wiz-indoors': (ed.value.flags & RoomFlags.Indoors) === RoomFlags.Indoors,
                                    'room-wiz-no-magic': (ed.value.flags & RoomFlags.No_Magic) === RoomFlags.No_Magic,
                                    'room-wiz-no-scry': (ed.value.flags & RoomFlags.No_Scry) === RoomFlags.No_Scry,
                                    'room-wiz-no-teleport': (ed.value.flags & RoomFlags.No_Teleport) === RoomFlags.No_Teleport,
                                    'room-wiz-explored': (ed.value.flags & RoomFlags.Explored) === RoomFlags.Explored,
                                    'room-wiz-no-map': (ed.value.flags & RoomFlags.No_Map_Send) === RoomFlags.No_Map_Send,
                                    'room-wiz-hide-exits': (ed.value.flags & RoomFlags.Hide_Exits) === RoomFlags.Hide_Exits,
                                    'room-wiz-no-forage': (ed.value.flags & RoomFlags.No_Forage) === RoomFlags.No_Forage,
                                    'room-wiz-forage': '' + ed.value.forage,
                                    'room-wiz-max-forage': '' + ed.value.maxForage,
                                    'room-wiz-secret-exit': ed.value.secretExit,
                                    'room-wiz-no-attack': (ed.value.flags & RoomFlags.No_Attack) === RoomFlags.No_Attack,
                                    'room-wiz-council': (ed.value.flags & RoomFlags.Council) === RoomFlags.Council,
                                    'room-wiz-melee': (ed.value.flags & RoomFlags.Melee_As_Ability) === RoomFlags.Melee_As_Ability,
                                    'room-wiz-pk': (ed.value.flags & RoomFlags.Enable_Pk) === RoomFlags.Enable_Pk,
                                    'room-wiz-no-dirt': (ed.value.flags & RoomFlags.No_Dirt) === RoomFlags.No_Dirt,
                                    'room-wiz-dirt': ed.value.dirtType,
                                    'room-wiz-temperature': '' + ed.value.temperature,
                                    'room-wiz-exits': Object.values(ed.value.exitsDetails),
                                    'room-wiz-items': ed.value.items,
                                    'room-wiz-smells': ed.value.smell && ed.value.smell.length > 0 ? [{ smell: 'default', description: ed.value.smell }].concat(...ed.value.smells) : ed.value.smells,
                                    'room-wiz-sounds': ed.value.sound && ed.value.sound.length > 0 ? [{ sound: 'default', description: ed.value.sound }].concat(...ed.value.sounds) : ed.value.sounds,
                                    'room-wiz-searches': ed.value.searches
                                },
                                finish: e => {
                                    const nRoom = ed.value.clone();
                                    nRoom.flags = RoomFlags.None;
                                    nRoom.type = e.data['room-wiz-type'].value;
                                    nRoom.terrain = e.data['room-wiz-terrain'];
                                    nRoom.short = e.data['room-wiz-short'];
                                    nRoom.light = +e.data['room-wiz-light'];
                                    nRoom.nightAdjust = +e.data['room-wiz-night-adjust'];
                                    nRoom.preventPeer = e.data['room-wiz-prevent-peer'];
                                    nRoom.long = e.data['room-wiz-long'];
                                    if (e.data['room-wiz-indoors'])
                                        nRoom.flags |= RoomFlags.Indoors;
                                    if (e.data['room-wiz-no-magic'])
                                        nRoom.flags |= RoomFlags.No_Magic;
                                    if (e.data['room-wiz-no-scry'])
                                        nRoom.flags |= RoomFlags.No_Scry;
                                    if (e.data['room-wiz-no-teleport'])
                                        nRoom.flags |= RoomFlags.No_Teleport;
                                    if (e.data['room-wiz-explored'])
                                        nRoom.flags |= RoomFlags.Explored;
                                    if (e.data['room-wiz-no-map'])
                                        nRoom.flags |= RoomFlags.No_Map_Send;
                                    if (e.data['room-wiz-hide-exits'])
                                        nRoom.flags |= RoomFlags.Hide_Exits;
                                    if (e.data['room-wiz-no-forage'])
                                        nRoom.flags |= RoomFlags.No_Forage;
                                    if (e.data['room-wiz-no-attack'])
                                        nRoom.flags |= RoomFlags.No_Attack;
                                    if (e.data['room-wiz-council'])
                                        nRoom.flags |= RoomFlags.Council;
                                    if (e.data['room-wiz-melee'])
                                        nRoom.flags |= RoomFlags.Melee_As_Ability;
                                    if (e.data['room-wiz-pk'])
                                        nRoom.flags |= RoomFlags.Enable_Pk;
                                    if (e.data['room-wiz-no-dirt'])
                                        nRoom.flags |= RoomFlags.No_Dirt;
                                    nRoom.forage = +e.data['room-wiz-forage'];
                                    nRoom.maxForage = +e.data['room-wiz-max-forage'];
                                    nRoom.secretExit = e.data['room-wiz-secret-exit'];
                                    nRoom.dirtType = e.data['room-wiz-dirt'];
                                    nRoom.temperature = +e.data['room-wiz-temperature'];
                                    nRoom.exitsDetails = {};
                                    e.data['room-wiz-exits'].forEach(x => {
                                        nRoom.exitsDetails[x.exit] = x;
                                    });
                                    nRoom.items = e.data['room-wiz-items'];
                                    let idx = e.data['room-wiz-smells'].map(s => s.smell).indexOf('default');
                                    if (idx !== -1) {
                                        nRoom.smell = e.data['room-wiz-smells'][idx].description;
                                        e.data['room-wiz-smells'].splice(idx);
                                    }
                                    nRoom.smells = e.data['room-wiz-smells'];
                                    idx = e.data['room-wiz-sounds'].map(s => s.sound).indexOf('default');
                                    if (idx !== -1) {
                                        nRoom.sound = e.data['room-wiz-sounds'][idx].description;
                                        e.data['room-wiz-smells'].splice(idx);
                                    }
                                    nRoom.sounds = e.data['room-wiz-sounds'];
                                    nRoom.searches = e.data['room-wiz-searches'];
                                    if (!nRoom.equals(ed.data.room))
                                        ed.value = nRoom;
                                    ed.focus();
                                },
                                closed: e => {
                                    ed.focus();
                                }
                            });
                        }
                    }
                },
                sort: 2
            }
        ];
        this.$propertiesEditor.roomGrid.on('value-changed', (newValue, oldValue, dataIndex) => {
            this.pushUndo(undoAction.edit, undoType.properties, { property: 'baserooms', old: oldValue, new: newValue });
            if (oldValue.name !== newValue.name)
                delete this.$area.baseRooms[oldValue.name];
            newValue.monster.monsters = newValue.monsters;
            newValue.monster.objects = newValue.objects;
            this.$area.baseRooms[newValue.name] = newValue.room;
            this.changed = true;
        });
        this.$propertiesEditor.roomGrid.on('add', e => {
            this.$new.baseRooms++;
            this.$area.baseRooms['base' + this.$new.baseRooms] = new Room(0, 0, 0, null, 'STD_ROOM');
            e.data = {
                name: 'base' + this.$new.baseRooms,
                objects: this.$area.baseRooms['base' + this.$new.baseRooms].objects,
                monsters: this.$area.baseRooms['base' + this.$new.baseRooms].monsters,
                room: this.$area.baseRooms['base' + this.$new.baseRooms]
            };
            this.pushUndo(undoAction.add, undoType.properties, { property: 'baserooms', name: 'base' + this.$new.baseRooms, value: e.data.room });
            this.changed = true;
        });
        this.$propertiesEditor.roomGrid.on('cut', (e) => {
            this.pushUndo(undoAction.delete, undoType.properties, {
                property: 'baserooms', values: e.data.map(r => {
                    delete this.$area.baseRooms[r.name];
                    return { name: r.name, value: r.room };
                })
            });
            this.emit('supports-changed');
            this.changed = true;
        });
        this.$propertiesEditor.roomGrid.on('copy', () => {
            this.emit('supports-changed');
        });
        this.$propertiesEditor.roomGrid.on('paste', (e) => {
            this.startUndoGroup();
            e.data.forEach(d => {
                if (this.$area.baseRooms[d.data.name]) {
                    this.$new.baseRooms++;
                    d.data.name += this.$new.baseRooms;
                }
                this.$area.baseRooms[d.data.name] = new Room(0, 0, 0, d.data);
                this.pushUndo(undoAction.add, undoType.properties, { property: 'baseRooms', name: d.data.name, value: this.$area.baseRooms[d.data.name] });
            });
            this.stopUndoGroup();
            this.changed = true;
        });
        this.$propertiesEditor.roomGrid.on('delete', (e) => {
            if (dialog.showMessageBox(
                remote.getCurrentWindow(),
                {
                    type: 'warning',
                    title: 'Delete',
                    message: 'Delete selected base room' + (this.$propertiesEditor.roomGrid.selectedCount > 1 ? 's' : '') + '?',
                    buttons: ['Yes', 'No'],
                    defaultId: 1
                })
                === 1)
                e.preventDefault = true;
            else {
                this.pushUndo(undoAction.delete, undoType.properties, {
                    property: 'baserooms', values: e.data.map(r => {
                        delete this.$area.baseRooms[r.name];
                        return { name: r.name, value: r.room };
                    })
                });
                this.changed = true;
            }
        });
        this.$propertiesEditor.roomGrid.on('selection-changed', () => {
            if (this.$view !== View.properties) return;
            const group = this.$propertiesEditor.roomsTab.firstChild;
            if (this.$propertiesEditor.roomGrid.selectedCount) {
                group.children[1].removeAttribute('disabled');
                group.children[2].removeAttribute('disabled');
                if (this.$propertiesEditor.roomGrid.selectedCount > 1)
                    (<HTMLElement>group.children[2]).title = 'Delete base rooms';
                else
                    (<HTMLElement>group.children[2]).title = 'Delete base room';
            }
            else {
                group.children[1].setAttribute('disabled', 'true');
                group.children[2].setAttribute('disabled', 'true');
                (<HTMLElement>group.children[2]).title = 'Delete base room(s)';
            }
            this.emit('selection-changed');
        });
        this.$propertiesEditor.roomsTab.appendChild(this.createButtonGroup(this.$propertiesEditor.roomGrid, 'base room'));
        this.$propertiesEditor.roomsTab.appendChild(el);
        this.parent.appendChild(this.$propertiesEditor.container);
        //#endregion
        //#region create monster grid
        el = document.createElement('div');
        el.classList.add('datagrid-standard');
        el.style.display = 'none';
        this.parent.appendChild(el);
        this.$monsterGrid = new DataGrid(el);
        this.$monsterGrid.enterMoveFirst = this.$enterMoveFirst;
        this.$monsterGrid.enterMoveNext = this.$enterMoveNext;
        this.$monsterGrid.enterMoveNew = this.$enterMoveNew;
        this.$monsterGrid.clipboardPrefix = 'jiMUD/';
        this.$monsterGrid.columns = [
            {
                label: 'Name',
                field: 'name',
                width: 250,
                spring: true,
                editor: {
                    options: {
                        singleLine: true
                    }
                }
            },
            {
                label: 'Short',
                field: 'short',
                width: 250,
                spring: true,
                editor: {
                    options: {
                        singleLine: true
                    }
                }
            },
            {
                label: 'Max amount',
                field: 'maxAmount',
                width: 125,
                editor: {
                    options: {
                        min: -1,
                        max: 50
                    }
                }
            },
            {
                label: 'Unique',
                field: 'unique',
                width: 125
            },
            {
                field: 'objects',
                label: 'Objects',
                sortable: false,
                formatter: this.formatCollection,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 2
            },
            {
                field: 'monster',
                sortable: false,
                label: '',
                width: 32,
                formatter: () => '',
                editor: {
                    type: EditorType.button,
                    options: {
                        click: ed => {
                            this.emit('show-monster-wizard', {
                                title: 'Edit base monster',
                                data: {
                                    'mon-wiz-welcome-message': 'Welcome to the base monster editor, this will take you through the steps to edit a monster quickly and easily. You may finish at any time to save your current selections.',
                                    'mon-wiz-area-types': Object.keys(this.$area.baseMonsters || { base: null }).map(r => {
                                        return {
                                            value: r,
                                            display: capitalize(r),
                                            group: 'Area'
                                        };
                                    }),
                                    'mon-wiz-type': ed.value.type || 'base',
                                    'mon-wiz-level': '' + ed.value.level,
                                    'mon-wiz-alignment': '' + ed.value.alignment,
                                    'mon-wiz-race': ed.value.race,
                                    'mon-wiz-class': ed.value.class,
                                    'mon-wiz-language': ed.value.language,
                                    'mon-wiz-ridable': (ed.value.flags & MonsterFlags.Ridable) === MonsterFlags.Ridable,
                                    'mon-wiz-flying': (ed.value.flags & MonsterFlags.Flying) === MonsterFlags.Flying,
                                    'mon-wiz-getable': (ed.value.flags & MonsterFlags.Getable) === MonsterFlags.Getable,
                                    'mon-wiz-undead': (ed.value.flags & MonsterFlags.Undead) === MonsterFlags.Undead,
                                    'mon-wiz-waterbreathing': (ed.value.flags & MonsterFlags.Water_Breathing) === MonsterFlags.Water_Breathing,
                                    'mon-wiz-requires-water': (ed.value.flags & MonsterFlags.Requires_Water) === MonsterFlags.Requires_Water,
                                    'mon-wiz-no-bleed': (ed.value.flags & MonsterFlags.No_Bleeding) === MonsterFlags.No_Bleeding,
                                    'mon-wiz-name': ed.editors ? ed.editors[0].editor.value : ed.value.name,
                                    'mon-wiz-short': ed.editors ? ed.editors[1].editor.value : ed.value.short,
                                    'mon-wiz-nouns': ed.value.nouns,
                                    'mon-wiz-adjectives': ed.value.adjectives,
                                    'mon-wiz-long': ed.value.long,
                                    'mon-wiz-mass': '' + ed.value.mass,
                                    'mon-wiz-height': '' + ed.value.height,
                                    'mon-wiz-eye': ed.value.eyeColor,
                                    'mon-wiz-hair': ed.value.hairColor,
                                    'mon-wiz-gender': ed.value.gender,
                                    'mon-wiz-body': ed.value.bodyType,
                                    'mon-wiz-no-corpse': ed.value.noCorpse,
                                    'mon-wiz-no-limbs': ed.value.noLimbs,
                                    'mon-wiz-commands': ed.value.attackCommands,
                                    'mon-wiz-chance': '' + ed.value.attackCommandChance,
                                    'mon-wiz-initiators': ed.value.attackInitiators,
                                    'mon-wiz-aggressive': ed.value.aggressive,
                                    'mon-wiz-speed': '' + ed.value.speed,
                                    'mon-wiz-patrol': ed.value.patrolRoute,
                                    'mon-wiz-no-walk': ed.value.noWalkRooms,
                                    'mon-wiz-auto-drop': '' + ed.value.autoDrop.time,
                                    'mon-wiz-auto-drop-enabled': ed.value.autoDrop.enabled,
                                    'mon-wiz-storage': '' + ed.value.openStorage.time,
                                    'mon-wiz-storage-enabled': ed.value.openStorage.enabled,
                                    'mon-wiz-auto-wield': '' + ed.value.autoWield.time,
                                    'mon-wiz-auto-wield-enabled': ed.value.autoWield.enabled,
                                    'mon-wiz-auto-loot': '' + ed.value.autoLoot.time,
                                    'mon-wiz-auto-loot-enabled': ed.value.autoLoot.enabled,
                                    'mon-wiz-auto-wear': '' + ed.value.autoWear.time,
                                    'mon-wiz-auto-wear-enabled': ed.value.autoWear.enabled,
                                    'mon-wiz-wimpy': '' + ed.value.wimpy,
                                    'mon-wiz-drop-encumbered': (ed.value.flags & MonsterFlags.Drop_encumbered) === MonsterFlags.Drop_encumbered,
                                    'mon-wiz-drop-encumbered-combat': (ed.value.flags & MonsterFlags.Drop_encumbered_combat) === MonsterFlags.Drop_encumbered_combat,
                                    'mon-wiz-auto-stand': (ed.value.flags & MonsterFlags.Auto_Stand) === MonsterFlags.Auto_Stand
                                },
                                finish: e => {
                                    if (ed.editors) {
                                        ed.editors[0].editor.value = e.data['mon-wiz-name'];
                                        ed.editors[1].editor.value = e.data['mon-wiz-short'];
                                    }
                                    const nMonster = ed.value.clone();
                                    nMonster.flags = RoomFlags.None;
                                    nMonster.type = e.data['mon-wiz-type'].value;
                                    nMonster.level = +e.data['mon-wiz-level'];
                                    nMonster.alignment = +e.data['mon-wiz-alignment'];
                                    nMonster.race = e.data['mon-wiz-race'];
                                    nMonster.class = e.data['mon-wiz-class'];
                                    nMonster.language = e.data['mon-wiz-language'];
                                    if (e.data['mon-wiz-ridable'])
                                        nMonster.flags |= MonsterFlags.Ridable;
                                    if (e.data['mon-wiz-flying'])
                                        nMonster.flags |= MonsterFlags.Flying;
                                    if (e.data['mon-wiz-getable'])
                                        nMonster.flags |= MonsterFlags.Getable;
                                    if (e.data['mon-wiz-undead'])
                                        nMonster.flags |= MonsterFlags.Undead;
                                    if (e.data['mon-wiz-waterbreathing'])
                                        nMonster.flags |= MonsterFlags.Water_Breathing;
                                    if (e.data['mon-wiz-requires-water'])
                                        nMonster.flags |= MonsterFlags.Requires_Water;
                                    if (e.data['mon-wiz-no-bleed'])
                                        nMonster.flags |= MonsterFlags.No_Bleeding;
                                    nMonster.name = e.data['mon-wiz-name'];
                                    nMonster.short = e.data['mon-wiz-short'];
                                    nMonster.nouns = e.data['mon-wiz-nouns'];
                                    nMonster.adjectives = e.data['mon-wiz-adjectives'];
                                    nMonster.long = e.data['mon-wiz-long'];
                                    nMonster.mass = +e.data['mon-wiz-mass'];
                                    nMonster.height = +e.data['mon-wiz-height'];
                                    nMonster.eyeColor = e.data['mon-wiz-eye'];
                                    nMonster.hairColor = e.data['mon-wiz-hair'];
                                    nMonster.gender = e.data['mon-wiz-gender'];
                                    nMonster.bodyType = e.data['mon-wiz-body'];
                                    nMonster.noCorpse = e.data['mon-wiz-no-corpse'];
                                    nMonster.noLimbs = e.data['mon-wiz-no-limbs'];
                                    nMonster.attackCommands = e.data['mon-wiz-commands'];
                                    nMonster.attackCommandChance = +e.data['mon-wiz-chance'];
                                    nMonster.attackInitiators = e.data['mon-wiz-initiators'];
                                    nMonster.aggressive = e.data['mon-wiz-aggressive'];
                                    nMonster.speed = +e.data['mon-wiz-speed'];
                                    nMonster.patrolRoute = e.data['mon-wiz-patrol'];
                                    nMonster.noWalkRooms = e.data['mon-wiz-no-walk'];
                                    nMonster.autoDrop.time = +e.data['mon-wiz-auto-drop'];
                                    nMonster.autoDrop.enabled = e.data['mon-wiz-auto-drop-enabled'];
                                    nMonster.openStorage.time = +e.data['mon-wiz-storage'];
                                    nMonster.openStorage.enabled = e.data['mon-wiz-storage-enabled'];
                                    nMonster.autoWield.time = +e.data['mon-wiz-auto-wield'];
                                    nMonster.autoWield.enabled = e.data['mon-wiz-auto-wield-enabled'];
                                    nMonster.autoLoot.time = +e.data['mon-wiz-auto-loot'];
                                    nMonster.autoLoot.enabled = e.data['mon-wiz-auto-loot-enabled'];
                                    nMonster.autoWear.time = +e.data['mon-wiz-auto-wear'];
                                    nMonster.autoWear.enabled = e.data['mon-wiz-auto-wear-enabled'];
                                    nMonster.wimpy = +e.data['mon-wiz-wimpy'];
                                    if (e.data['mon-wiz-drop-encumbered'])
                                        nMonster.flags |= MonsterFlags.Drop_encumbered;
                                    if (e.data['mon-wiz-drop-encumbered-combat'])
                                        nMonster.flags |= MonsterFlags.Drop_encumbered_combat;
                                    if (e.data['mon-wiz-auto-stand'])
                                        nMonster.flags |= MonsterFlags.Auto_Stand;

                                    if (!nMonster.equals(ed.data.monster))
                                        ed.value = nMonster;
                                    ed.focus();
                                },
                                closed: e => {
                                    ed.focus();
                                }
                            });
                        }
                    }
                },
                sort: 2
            }
        ];
        this.$monsterGrid.on('delete', (e) => {
            if (dialog.showMessageBox(
                remote.getCurrentWindow(),
                {
                    type: 'warning',
                    title: 'Delete',
                    message: 'Delete monster' + (this.$monsterGrid.selectedCount > 1 ? 's' : '') + '?',
                    buttons: ['Yes', 'No'],
                    defaultId: 1
                })
                === 1)
                e.preventDefault = true;
            else {
                this.pushUndo(undoAction.delete, undoType.monster, {
                    values: e.data.map(r => {
                        delete this.$area.monsters[r.id];
                        return { id: r.id, value: r.monster };
                    })
                });
                this.changed = true;
            }
        });
        this.$monsterGrid.on('cut', (e) => {
            this.pushUndo(undoAction.delete, undoType.monster, {
                values: e.data.map(r => {
                    delete this.$area.monsters[r.id];
                    return { id: r.id, value: r.monster };
                })
            });
            this.changed = true;
            this.emit('supports-changed');
        });
        this.$monsterGrid.on('copy', (e) => {
            this.emit('supports-changed');
        });
        this.$monsterGrid.on('paste', (e) => {
            this.startUndoGroup();
            e.data.forEach(d => {
                const m = new Monster(d.data);
                m.id = new Date().getTime();
                this.$area.monsters[m.id] = m;
                this.pushUndo(undoAction.add, undoType.monster, { id: m.id, value: m });
            });
            this.stopUndoGroup();
            this.changed = true;
        });
        this.$monsterGrid.on('add', e => {
            const m = new Monster();
            this.$area.monsters[m.id] = m;
            e.data = {
                id: m.id,
                name: m.name,
                short: m.short,
                maxAmount: m.maxAmount,
                unique: m.unique,
                objects: m.objects,
                monster: m
            };
            this.pushUndo(undoAction.add, undoType.monster, { id: m.id, value: e.data.monster });
            this.changed = true;
        });
        this.$monsterGrid.sort(0);
        this.$monsterGrid.on('selection-changed', () => {
            if (this.$view !== View.monsters) return;
            if (this.$monsterGrid.selectedCount) {
                this.$label.children[0].children[1].removeAttribute('disabled');
                this.$label.children[0].children[2].removeAttribute('disabled');
                if (this.$monsterGrid.selectedCount > 1)
                    (<HTMLElement>this.$label.children[0].children[2]).title = 'Delete monsters';
                else
                    (<HTMLElement>this.$label.children[0].children[2]).title = 'Delete monster';
            }
            else {
                this.$label.children[0].children[1].setAttribute('disabled', 'true');
                this.$label.children[0].children[2].setAttribute('disabled', 'true');
                (<HTMLElement>this.$label.children[0].children[2]).title = 'Delete monster(s)';
            }
            this.emit('selection-changed');
        });
        this.$monsterGrid.on('value-changed', (newValue, oldValue, dataIndex) => {
            this.pushUndo(undoAction.edit, undoType.monster, { old: oldValue, new: newValue });
            if (newValue.monster.name === oldValue.monster.name)
                newValue.monster.name = newValue.name;
            if (newValue.monster.short === oldValue.monster.short)
                newValue.monster.short = newValue.short;
            newValue.monster.maxAmount = newValue.maxAmount;
            newValue.monster.unique = newValue.unique;
            newValue.monster.objects = newValue.objects;
            this.$area.monsters[newValue.id] = newValue.monster;
            this.changed = true;
        });
        //#endregion
        //#region create object grid
        el = document.createElement('div');
        el.classList.add('datagrid-standard');
        el.style.display = 'none';
        this.parent.appendChild(el);
        this.$objectGrid = new DataGrid(el);
        this.$objectGrid.enterMoveFirst = this.$enterMoveFirst;
        this.$objectGrid.enterMoveNext = this.$enterMoveNext;
        this.$objectGrid.enterMoveNew = this.$enterMoveNew;
        this.$objectGrid.clipboardPrefix = 'jiMUD/';
        this.$objectGrid.columns = [
            {
                label: 'Name',
                field: 'name',
                width: 250,
                spring: true,
                editor: {
                    options: {
                        singleLine: true
                    }
                }
            },
            {
                label: 'Short',
                field: 'short',
                width: 250,
                spring: true,
                editor: {
                    options: {
                        singleLine: true
                    }
                }
            },
            {
                label: 'Type',
                field: 'type',
                width: 125,
                formatter: data => !data || !data.row ? '' : capitalize(Object.keys(StdObjectType).filter(key => !isNaN(Number(StdObjectType[key])))[data.row.type]),
                editor: {
                    type: EditorType.select,
                    options: {
                        data: StdObjectType
                    }
                }
            },
            {
                field: 'object',
                sortable: false,
                label: '',
                width: 32,
                formatter: () => '',
                editor: {
                    type: EditorType.button,
                    options: {
                        click: ed => {
                            let ty = ed.data.type;
                            let sh = ed.value.short;
                            let name = ed.value.name;
                            if (ed.editors) {
                                name = ed.editors[0].editor.value;
                                sh = ed.editors[1].editor.value;
                                ty = ed.editors[2].editor.value;
                            }
                            const wiz = new Wizard({
                                id: 'object-wizard',
                                title: 'Edit object...',
                                pages: [
                                    new WizardPage({
                                        id: 'obj-welcome',
                                        title: 'Welcome',
                                        body: `
                                        <img src="../assets/icons/png/wizobjlogo.png" alt="Welcome to the monster wizard" style="float: left;padding-top: 56px;">
                                        <div style="padding-top:76px">Welcome to the object editor wizard, this will take you through the steps to edit an objectquickly and easily. You may finish at any time to save your current selections.</div>
                                        `
                                    }),
                                    new WizardPage({
                                        id: 'obj-description',
                                        title: 'Description',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label">Name
                                            <input type="text" class="input-sm form-control" id="obj-name" />
                                        </label>
                                    </div>
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label">Short
                                            <input type="text" class="input-sm form-control" id="obj-short" />
                                        </label>
                                    </div>
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%">Nouns
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A comma delimited list of words</span>
                                            <input type="text" class="input-sm form-control" id="obj-nouns" />
                                        </label>
                                    </div>
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%">Adjectives
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A comma delimited list of words</span>
                                            <input type="text" class="input-sm form-control" id="obj-adjectives" />
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-name').value = name || '';
                                            e.page.querySelector('#obj-short').value = sh || '';
                                            e.page.querySelector('#obj-nouns').value = ed.value.nouns || '';
                                            e.page.querySelector('#obj-adjectives').value = ed.value.adjectives || '';
                                        }
                                    }),
                                    new WizardPage({
                                        id: 'obj-description-long',
                                        title: 'Long description',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%">Long
                                            <a href="#" onclick="ipcRenderer.send('send-editor', document.getElementById('obj-long').value, 'editor', true);document.getElementById('obj-long').focus();">
                                                <i class="fa fa-edit"></i>
                                            </a>
                                            <textarea class="input-sm form-control" id="obj-long" style="width: 100%;height: 216px;"></textarea>
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-long').value = ed.value.long || '';
                                        }
                                    }),
                                    new WizardPage({
                                        id: 'obj-properties',
                                        title: 'General properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%">Key ID
                                            <input type="text" class="input-sm form-control" id="obj-keyid" />
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Mass
                                            <input type="number" id="obj-mass" class="input-sm form-control" min="0" value="0" />
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0">A mass of 0 will use default mass</span>
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">Material
                                            <div class="input-group edit-dropdown">
                                                <input type="text" id="obj-material" class="input-sm form-control">
                                                <span class="input-group-btn">
                                                    <button id="btn-obj-material" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <span class="caret" style="margin-left: -1px;"></span>
                                                    </button>
                                                    <ul id="obj-material-list" style="max-height: 265px;" class="dropdown-menu pull-right" aria-labelledby="btn-obj-material" data-container="body">
                                                    </ul>
                                                </span>
                                            </div>
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0">Required for all but basic object</span>
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-keyid').value = ed.value.keyid || '';
                                            e.page.querySelector('#obj-mass').value = ed.value.mass || '0';
                                            e.page.querySelector('#obj-material').value = ed.value.material || '';
                                        }
                                    })
                                ]
                            });
                            wiz.pages[3].page.querySelector('#obj-material-list').innerHTML = '<li><a href="#">' + fs.readFileSync(parseTemplate(path.join('{assets}', 'editor', 'material.lst')), 'utf8').replace(/\r\n|\n|\r/g, '</a></li><li><a href="#">') + '</a></li>';
                            initEditDropdown(wiz.pages[3].page.querySelector('#obj-material-list').closest('.edit-dropdown'));
                            wiz.height = '340px';
                            wiz.on('open', () => {
                                this.emit('dialog-open');
                            });
                            wiz.on('close', () => {
                                this.emit('dialog-close');
                                wiz.destroy();
                            });
                            wiz.on('cancel', () => {
                                this.emit('dialog-cancel');
                                wiz.destroy();
                            });
                            wiz.on('finished', (e) => {
                                //TODO
                            });
                            const qualities = `<div class="col-sm-12 form-group">
                            <label class="control-label" style="width: 100%;">Quality
                                <select id="obj-quality" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                    <option value='inferior'>Inferior</option>
                                    <option value='poor'>Poor</option>
                                    <option value='rough'>Rough</option>
                                    <option value='ordinary'>Ordinary</option>
                                    <option value='average'>Average</option>
                                    <option value='fair'>Fair</option>
                                    <option value='good'>Good</option>
                                    <option value='fine'>Fine</option>
                                    <option value='exceptional'>Exceptional</option>
                                    <option value='flawless'>Flawless</option>
                                </select>
                            </label>
                        </div>`;
                            switch (ty) {
                                case StdObjectType.sheath:
                                    wiz.title = 'Edit sheath...';
                                    //type, quality, limbs, enchantment
                                    wiz.addPages(new WizardPage({
                                        id: 'obj-armor',
                                        title: 'Sheath properties',
                                        body: `<div class="col-sm-12 form-group">
                                    <label class="control-label" style="width: 100%;">Type
                                        <select id="obj-type" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                            <optgroup label="accessory"><option value="accessory">Accessory</option><option value="buckler">Buckler</option><option value="jewelry">Jewelry</option><option value="sheath">Sheath</option></optgroup><optgroup label="clothing"><option value="clothing">Clothing</option><option value="thin clothing">Thin clothing</option></optgroup><optgroup label="heavy"><option value="bandedmail">Bandedmail</option><option value="full platemail">Full platemail</option><option value="platemail">Platemail</option><option value="splintmail">Splintmail</option></optgroup><optgroup label="light"><option value="hard leather">Hard leather</option><option value="heavy clothing">Heavy clothing</option><option value="padded leather">Padded leather</option><option value="soft leather">Soft leather</option><option value="studded leather">Studded leather</option></optgroup><optgroup label="medium"><option value="brigandine">Brigandine</option><option value="chainmail">Chainmail</option><option value="ringmail">Ringmail</option><option value="scalemail">Scalemail</option></optgroup><optgroup label="overclothing"><option value="heavy overclothing">Heavy overclothing</option><option value="overclothing">Overclothing</option><option value="thin overclothing">Thin overclothing</option></optgroup><optgroup label="underclothing"><option value="underclothing">Underclothing</option></optgroup>
                                        </select>
                                    </label>
                                </div>
                                <div class="col-sm-12 form-group">
                                    <label class="control-label">Limbs
                                        <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A comma delimited list of limbs</span>
                                        <div class="input-group edit-dropdown">
                                            <input type="text" id="obj-limbs" class="input-sm form-control">
                                            <span class="input-group-btn">
                                                <button id="btn-room-wiz-terrain" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                    <span class="caret" style="margin-left: -1px;"></span>
                                                </button>
                                                <ul id="obj-limbs-list" style="max-height: 265px;" class="dropdown-menu pull-right" aria-labelledby="btn-room-wiz-terrain" data-container="body">
                                                    <li><a href="#">All limbs</a></li><li><a href="#">Overall</a></li><li><a href="#">Limb only</a></li><li><a href="#">Torso</a></li><li><a href="#">Head</a></li><li><a href="#">Left arm</a></li><li><a href="#">Right arm</a></li><li><a href="#">Left hand</a></li><li><a href="#">Right hand</a></li><li><a href="#">Left leg</a></li><li><a href="#">Right leg</a></li><li><a href="#">Left foot</a></li><li><a href="#">Right foot</a></li><li><a href="#">Right wing</a></li><li><a href="#">Left wing</a></li><li><a href="#">Left hoof</a></li><li><a href="#">Right hoof</a></li><li><a href="#">Tail</a></li><li><a href="#">Arms</a></li><li><a href="#">Legs</a></li><li><a href="#">Hands</a></li><li><a href="#">Feet</a></li><li><a href="#">Wings</a></li><li><a href="#">Hooves</a></li><li><a href="#">Lower body</a></li><li><a href="#">Core body</a></li><li><a href="#">Upper core</a></li><li><a href="#">Upper body</a></li><li><a href="#">Winged core</a></li><li><a href="#">Winged upper</a></li><li><a href="#">Upper trunk</a></li><li><a href="#">Lower trunk</a></li><li><a href="#">Trunk</a></li><li><a href="#">Winged trunk</a></li><li><a href="#">Full body</a></li><li><a href="#">Total body</a></li><li><a href="#">Winged body</a></li>
                                                </ul>
                                            </span>
                                        </div>
                                    </label>
                                </div>${qualities}
                                <div class="form-group col-sm-12">
                                    <label class="control-label">
                                        Enchantment
                                        <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                    </label>
                                </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-type').value = ed.value.subType || 'sheath';
                                            e.page.querySelector('#obj-limbs').value = ed.value.limbs || '0';
                                            e.page.querySelector('#obj-quality').value = ed.value.quality || 'average';
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                        }
                                    }));
                                    break;
                                case StdObjectType.armor:
                                    wiz.title = 'Edit armor...';
                                    //type, quality, limbs, enchantment
                                    wiz.addPages(new WizardPage({
                                        id: 'obj-armor',
                                        title: 'Armor properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%;">Type
                                            <select id="obj-type" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                                <optgroup label="accessory"><option value="accessory">Accessory</option><option value="buckler">Buckler</option><option value="jewelry">Jewelry</option><option value="sheath">Sheath</option></optgroup><optgroup label="clothing"><option value="clothing">Clothing</option><option value="thin clothing">Thin clothing</option></optgroup><optgroup label="heavy"><option value="bandedmail">Bandedmail</option><option value="full platemail">Full platemail</option><option value="platemail">Platemail</option><option value="splintmail">Splintmail</option></optgroup><optgroup label="light"><option value="hard leather">Hard leather</option><option value="heavy clothing">Heavy clothing</option><option value="padded leather">Padded leather</option><option value="soft leather">Soft leather</option><option value="studded leather">Studded leather</option></optgroup><optgroup label="medium"><option value="brigandine">Brigandine</option><option value="chainmail">Chainmail</option><option value="ringmail">Ringmail</option><option value="scalemail">Scalemail</option></optgroup><optgroup label="overclothing"><option value="heavy overclothing">Heavy overclothing</option><option value="overclothing">Overclothing</option><option value="thin overclothing">Thin overclothing</option></optgroup><optgroup label="underclothing"><option value="underclothing">Underclothing</option></optgroup>
                                            </select>
                                        </label>
                                    </div>
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label">Limbs
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A comma delimited list of limbs</span>
                                            <div class="input-group edit-dropdown">
                                                <input type="text" id="obj-limbs" class="input-sm form-control">
                                                <span class="input-group-btn">
                                                    <button id="btn-room-wiz-terrain" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <span class="caret" style="margin-left: -1px;"></span>
                                                    </button>
                                                    <ul id="obj-limbs-list" style="max-height: 265px;" class="dropdown-menu pull-right" aria-labelledby="btn-room-wiz-terrain" data-container="body">
                                                        <li><a href="#">All limbs</a></li><li><a href="#">Overall</a></li><li><a href="#">Limb only</a></li><li><a href="#">Torso</a></li><li><a href="#">Head</a></li><li><a href="#">Left arm</a></li><li><a href="#">Right arm</a></li><li><a href="#">Left hand</a></li><li><a href="#">Right hand</a></li><li><a href="#">Left leg</a></li><li><a href="#">Right leg</a></li><li><a href="#">Left foot</a></li><li><a href="#">Right foot</a></li><li><a href="#">Right wing</a></li><li><a href="#">Left wing</a></li><li><a href="#">Left hoof</a></li><li><a href="#">Right hoof</a></li><li><a href="#">Tail</a></li><li><a href="#">Arms</a></li><li><a href="#">Legs</a></li><li><a href="#">Hands</a></li><li><a href="#">Feet</a></li><li><a href="#">Wings</a></li><li><a href="#">Hooves</a></li><li><a href="#">Lower body</a></li><li><a href="#">Core body</a></li><li><a href="#">Upper core</a></li><li><a href="#">Upper body</a></li><li><a href="#">Winged core</a></li><li><a href="#">Winged upper</a></li><li><a href="#">Upper trunk</a></li><li><a href="#">Lower trunk</a></li><li><a href="#">Trunk</a></li><li><a href="#">Winged trunk</a></li><li><a href="#">Full body</a></li><li><a href="#">Total body</a></li><li><a href="#">Winged body</a></li>
                                                    </ul>
                                                </span>
                                            </div>
                                        </label>
                                    </div>${qualities}
                                    <div class="form-group col-sm-12">
                                        <label class="control-label">
                                            Enchantment
                                            <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-type').value = ed.value.subType || '';
                                            e.page.querySelector('#obj-limbs').value = ed.value.limbs || '0';
                                            e.page.querySelector('#obj-quality').value = ed.value.quality || 'average';
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                        }
                                    }));
                                    break;
                                case StdObjectType.chest:
                                    wiz.title = 'Edit chest...';
                                    //objects, money
                                    break;
                                case StdObjectType.material:
                                    wiz.title = 'Edit material...';
                                    //size, quality, describers
                                    wiz.addPages(new WizardPage({
                                        id: 'obj-ore',
                                        title: 'Ore properties',
                                        body: ` <div class="col-sm-12 form-group">
                                        <label class="control-label">Size
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A number or predefined string</span>
                                            <div class="input-group edit-dropdown">
                                                <input type="text" id="obj-size" class="input-sm form-control">
                                                <span class="input-group-btn">
                                                    <button id="btn-room-wiz-terrain" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <span class="caret" style="margin-left: -1px;"></span>
                                                    </button>
                                                    <ul id="obj-limbs-list" style="max-height: 265px;" class="dropdown-menu pull-right" aria-labelledby="btn-room-wiz-terrain" data-container="body">
                                                        <li><a href="#">Small</a></li>
                                                        <li><a href="#">Medium</a></li>
                                                        <li><a href="#">Large</a></li>
                                                        <li><a href="#">Huge</a></li>
                                                        <li><a href="#">Giant</a></li>
                                                    </ul>
                                                </span>
                                            </div>
                                        </label>
                                    </div>${qualities}
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%">Describers
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A comma delimited list of words</span>
                                            <input type="text" class="input-sm form-control" id="obj-describers" />
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-quality').value = ed.value.quality || 'average';
                                            e.page.querySelector('#obj-size').value = ed.value.size || '0';
                                            e.page.querySelector('#obj-describers').value = ed.value.describers || '';
                                        }
                                    }));
                                    break;
                                case StdObjectType.ore:
                                    wiz.title = 'Edit ore...';
                                    //size, quality, bonuses?
                                    wiz.addPages(new WizardPage({
                                        id: 'obj-ore',
                                        title: 'Ore properties',
                                        body: ` <div class="col-sm-12 form-group">
                                        <label class="control-label">Size
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A number or predefined string</span>
                                            <div class="input-group edit-dropdown">
                                                <input type="text" id="obj-size" class="input-sm form-control">
                                                <span class="input-group-btn">
                                                    <button id="btn-room-wiz-terrain" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <span class="caret" style="margin-left: -1px;"></span>
                                                    </button>
                                                    <ul id="obj-limbs-list" style="max-height: 265px;" class="dropdown-menu pull-right" aria-labelledby="btn-room-wiz-terrain" data-container="body">
                                                        <li><a href="#">Small</a></li>
                                                        <li><a href="#">Medium</a></li>
                                                        <li><a href="#">Large</a></li>
                                                        <li><a href="#">Huge</a></li>
                                                        <li><a href="#">Giant</a></li>
                                                    </ul>
                                                </span>
                                            </div>
                                        </label>
                                    </div>${qualities}`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-quality').value = ed.value.quality || 'average';
                                            e.page.querySelector('#obj-size').value = ed.value.size || '0';
                                        }
                                    }));
                                    break;
                                case StdObjectType.weapon:
                                    wiz.title = 'Edit weapon...';
                                    //type, quality, enchantment
                                    wiz.addPages(new WizardPage({
                                        id: 'obj-weapon',
                                        title: 'Weapon properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%;">Type
                                            <select id="obj-type" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                            <optgroup label="Axe"><option value="axe">Axe</option><option value="battle axe">Battle axe</option><option value="great axe">Great axe</option><option value="hand axe">Hand axe</option><option value="mattock">Mattock</option><option value="wood axe">Wood axe</option></optgroup><optgroup label="Blunt"><option value="club">Club</option><option value="hammer">Hammer</option><option value="mace">Mace</option><option value="maul">Maul</option><option value="morningstar">Morningstar</option><option value="spiked club">Spiked club</option><option value="warhammer">Warhammer</option></optgroup><optgroup label="Bow"><option value="bow">Bow</option><option value="crossbow">Crossbow</option><option value="long bow">Long bow</option><option value="longbow">Longbow</option><option value="recurve bow">Recurve bow</option><option value="self bow">Self bow</option></optgroup><optgroup label="Flail"><option value="ball and chain">Ball and chain</option><option value="chain">Chain</option><option value="flail">Flail</option><option value="whip">Whip</option></optgroup><optgroup label="Knife"><option value="dagger">Dagger</option><option value="dirk">Dirk</option><option value="knife">Knife</option><option value="kris">Kris</option><option value="stiletto">Stiletto</option><option value="tanto">Tanto</option></optgroup><optgroup label="Large sword"><option value="bastard sword">Bastard sword</option><option value="claymore">Claymore</option><option value="flamberge">Flamberge</option><option value="large sword">Large sword</option><option value="nodachi">Nodachi</option></optgroup><optgroup label="Melee"><option value="brass knuckles">Brass knuckles</option><option value="melee">Melee</option><option value="tekagi-shuko">Tekagi-shuko</option><option value="tekko">Tekko</option></optgroup><optgroup label="Miscellaneous"><option value="cord">Cord</option><option value="fan">Fan</option><option value="giant fan">Giant fan</option><option value="miscellaneous">Miscellaneous</option><option value="war fan">War fan</option></optgroup><optgroup label="Polearm"><option value="bardiche">Bardiche</option><option value="glaive">Glaive</option><option value="halberd">Halberd</option><option value="poleaxe">Poleaxe</option><option value="scythe">Scythe</option></optgroup><optgroup label="Shield"><option value="buckler">Buckler</option><option value="large shield">Large shield</option><option value="shield">Shield</option><option value="small shield">Small shield</option></optgroup><optgroup label="Small sword"><option value="broadsword">Broadsword</option><option value="katana">Katana</option><option value="long sword">Long sword</option><option value="rapier">Rapier</option><option value="scimitar">Scimitar</option><option value="short sword">Short sword</option><option value="small sword">Small sword</option><option value="wakizashi">Wakizashi</option></optgroup><optgroup label="Spear"><option value="arrow">Arrow</option><option value="javelin">Javelin</option><option value="lance">Lance</option><option value="long spear">Long spear</option><option value="pike">Pike</option><option value="pilum">Pilum</option><option value="short spear">Short spear</option><option value="spear">Spear</option><option value="trident">Trident</option></optgroup><optgroup label="Staff"><option value="battle staff">Battle staff</option><option value="bo">Bo</option><option value="quarterstaff">Quarterstaff</option><option value="staff">Staff</option><option value="wand">Wand</option><option value="warstaff">Warstaff</option></optgroup>
                                            </select>
                                        </label>
                                    </div>${qualities}
                                    <div class="form-group col-sm-12">
                                        <label class="control-label">
                                            Enchantment
                                            <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-type').value = ed.value.subType || '';
                                            e.page.querySelector('#obj-quality').value = ed.value.quality || 'average';
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                        }
                                    }));
                                    break;
                            }
                            if (wiz.pages.length === 5) {
                                $(wiz.pages[4].page.querySelectorAll('.selectpicker')).selectpicker();
                                Array.from(wiz.pages[4].page.querySelectorAll('.edit-dropdown')).forEach(initEditDropdown);
                            }
                            wiz.addPages(new WizardPage({
                                id: 'obj-finish',
                                title: 'Finish',
                                body: `<img src="../assets/icons/png/wizobjlogo.png" alt="Object editor summary" style="float: left;margin-top: 56px;height: 128px;width:128px;"> To finish your room simply click finished
                                    <div id="obj-summary" readonly="readonly" class="form-control" style="overflow:auto;height:219px;width:355px;white-space:pre;float: right;"></div>`,
                                shown: (e) => {
                                    const summary = e.page.querySelector('#obj-summary');
                                    const data = e.wizard.data;
                                    let sum = '';
                                    for (const prop in data) {
                                        if (!data.hasOwnProperty) continue;
                                        if (typeof data[prop] === 'object')
                                            sum += '<div><span style="font-weight:bold">' + capitalize(prop.substr(4)) + ':</span> ' + data[prop].display + '</div>';
                                        else
                                            sum += '<div><span style="font-weight:bold">' + capitalize(prop.substr(4)) + ':</span> ' + data[prop] + '</div>';
                                    }
                                    summary.innerHTML = sum;
                                }
                            }));
                            wiz.show();
                        }
                    }
                },
                sort: 2
            }
        ];
        this.$objectGrid.on('delete', (e) => {
            if (dialog.showMessageBox(
                remote.getCurrentWindow(),
                {
                    type: 'warning',
                    title: 'Delete',
                    message: 'Delete object' + (this.$objectGrid.selectedCount > 1 ? 's' : '') + '?',
                    buttons: ['Yes', 'No'],
                    defaultId: 1
                })
                === 1)
                e.preventDefault = true;
            else {
                this.pushUndo(undoAction.delete, undoType.object, {
                    values: e.data.map(r => {
                        delete this.$area.objects[r.id];
                        return { id: r.id, value: r.object };
                    })
                });
                this.changed = true;
            }
        });
        this.$objectGrid.on('cut', (e) => {
            this.pushUndo(undoAction.delete, undoType.object, {
                values: e.data.map(r => {
                    delete this.$area.objects[r.id];
                    return { id: r.id, value: r.object };
                })
            });
            this.changed = true;
            this.emit('supports-changed');
        });
        this.$objectGrid.on('copy', (e) => {
            this.emit('supports-changed');
        });
        this.$objectGrid.on('paste', (e) => {
            this.startUndoGroup();
            e.data.forEach(d => {
                const m = new StdObject(d.data);
                m.id = new Date().getTime();
                this.$area.monsters[m.id] = m;
                this.pushUndo(undoAction.add, undoType.object, { id: m.id, value: m });
            });
            this.stopUndoGroup();
            this.changed = true;
        });
        this.$objectGrid.on('add', e => {
            const m = new StdObject();
            this.$area.objects[m.id] = m;
            e.data = {
                id: m.id,
                name: m.name,
                short: m.short,
                type: m.type,
                object: m
            };
            this.pushUndo(undoAction.add, undoType.object, { id: m.id, value: e.data.object });
            this.changed = true;
        });
        this.$objectGrid.sort(0);
        this.$objectGrid.on('selection-changed', () => {
            if (this.$view !== View.objects) return;
            if (this.$objectGrid.selectedCount) {
                this.$label.children[0].children[1].removeAttribute('disabled');
                this.$label.children[0].children[2].removeAttribute('disabled');
                if (this.$objectGrid.selectedCount > 1)
                    (<HTMLElement>this.$label.children[0].children[2]).title = 'Delete objects';
                else
                    (<HTMLElement>this.$label.children[0].children[2]).title = 'Delete object';
            }
            else {
                this.$label.children[0].children[1].setAttribute('disabled', 'true');
                this.$label.children[0].children[2].setAttribute('disabled', 'true');
                (<HTMLElement>this.$label.children[0].children[2]).title = 'Delete object(s)';
            }
            this.emit('selection-changed');
        });
        this.$objectGrid.on('value-changed', (newValue, oldValue, dataIndex) => {
            this.pushUndo(undoAction.edit, undoType.object, { old: oldValue, new: newValue });
            if (newValue.object.name === oldValue.object.name)
                newValue.object.name = newValue.name;
            if (newValue.object.short === oldValue.object.short)
                newValue.object.short = newValue.short;
            newValue.object.type = newValue.type;
            this.$area.objects[newValue.id] = newValue.object;
            this.changed = true;
        });
        //#endregion
    }

    private createButtonGroup(grid, type) {
        let bGroup;
        let button;
        bGroup = document.createElement('div');
        bGroup.classList.add('btn-group');
        button = document.createElement('button');
        button.type = 'button';
        button.classList.add('btn', 'btn-default', 'btn-xs');
        button.addEventListener('click', () => {
            grid.addNewRow();
        });
        button.title = 'Add ' + type;
        button.innerHTML = '<i class="fa fa-plus"></i> Add';
        bGroup.appendChild(button);
        button = document.createElement('button');
        button.type = 'button';
        button.disabled = grid.selectedCount === 0;
        button.classList.add('btn', 'btn-default', 'btn-xs');
        button.addEventListener('click', () => {
            grid.beginEdit(grid.selected[0].row);
        });
        button.title = 'Edit ' + type;
        button.innerHTML = '<i class="fa fa-edit"></i> Edit';
        bGroup.appendChild(button);
        button = document.createElement('button');
        button.disabled = grid.selectedCount === 0;
        button.type = 'button';
        button.title = 'Delete ' + type + '(s)';
        button.classList.add('btn', 'btn-danger', 'btn-xs');
        button.addEventListener('click', () => {
            grid.delete();
        });
        button.innerHTML = '<i class="fa fa-trash"></i> Delete';
        bGroup.appendChild(button);
        return bGroup;
    }

    private formatExits(prop, value) {
        if (value === 0)
            return 'None';
        const states = Object.keys(RoomExit).filter(key => !isNaN(Number(RoomExit[key])));
        const f = [];
        let state = states.length;
        while (state--) {
            if (states[state] === 'None') continue;
            if ((value & RoomExit[states[state]]) === RoomExit[states[state]])
                f.push(capitalize(states[state]));
        }
        return f.join(', ');
    }

    private formatType(prop, value) {
        if (value === 0)
            return 'None';
        const t = RoomTypes.filter(r => r.value === value);
        if (t.length)
            return t[0].display;
        return capitalize(value);
    }

    private formatCollection(prop, value) {
        if (!value || value.length === 0) return '';
        switch (prop) {
            case 'objects':
                return value.map(v => capitalize(this.$area.objects[v.id].name)).join(' ,');
            case 'monsters':
                return value.map(v => capitalize(this.$area.monsters[v.id].name)).join(' ,');
            case 'items':
                return value.map(i => i.item).join(':');
            case 'smells':
                return value.map(i => i.smell).join(':');
            case 'sounds':
                return value.map(i => i.smell).join(':');
            case 'searches':
                return value.map(i => i.search).join(':');
            case 'exitsDetails':
                return value.map(v => v.exit).join(', ');
        }
        return value;
    }

    public refresh() {
        switch (this.$view) {
            case View.map:
                this.doUpdate(UpdateType.drawMap);
                break;
            case View.properties:
                break;
            case View.monsters:
                break;
            case View.objects:
                break;
        }
    }

    public open() {
        if (!this.file || this.file.length === 0 || !existsSync(this.file) || this.new)
            return;
        this.opened = new Date().getTime();
        this.$area = Area.load(this.file);
        this.doUpdate(UpdateType.buildMap);
        this.emit('opened', this.file);
        this.state |= FileState.opened;
        this.changed = false;
    }

    public save() {
        this.$saving = true;
        this.$area.save(this.file);
        this.changed = false;
        this.new = false;
        this.emit('saved');
    }

    public upload(remoteFile?) {
        remoteFile = remoteFile || this.remote;
        if (!remoteFile || remoteFile.length === 0) return;
        const files = [];
        const remoteRoot = path.dirname(remoteFile);
        const root = path.dirname(this.file);
        if (this.changed || this.new)
            files.push({ value: this.$area.raw, remote: remoteFile });
        else
            files.push({ local: this.file, remote: remoteFile });
        this.emit('upload', files);
    }

    public canSaveAs() {
        return true;
    }

    public revert() {
        this.pushUndo(undoAction.delete, undoType.area, this.$area);
        if (!this.new)
            this.open();
        else if (this.$startOptions) {
            this.$area = new Area(this.$startOptions.width || 25, this.$startOptions.height || 25, this.$startOptions.depth || 1);
            this.doUpdate(UpdateType.buildMap);
        }
        else {
            this.$area = new Area(25, 25, 1);
            this.doUpdate(UpdateType.buildMap);
        }
        this.changed = false;
        this.switchView(this.$view, true);
        this.emit('reverted');
    }

    private deleteRoom(room, noUndo?) {
        const o = room.exits;
        let nx;
        let ny;
        let p;
        let po;
        if (room.y > 0 && (o & RoomExit.North) === RoomExit.North) {
            nx = room.x;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.South);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
        if (room.y > 0 && room.x > 0 && (o & RoomExit.NorthWest) === RoomExit.NorthWest) {
            nx = room.x - 1;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.SouthEast);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
        if (room.y > 0 && room.x < this.$area.size.width - 1 && (o & RoomExit.NorthEast) === RoomExit.NorthEast) {
            nx = room.x + 1;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.SouthWest);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
        if (room.x < this.$area.size.width - 1 && (o & RoomExit.East) === RoomExit.East) {
            nx = room.x + 1;
            ny = room.y;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.West);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
        if (room.x > 0 && (o & RoomExit.West) === RoomExit.West) {
            nx = room.x - 1;
            ny = room.y;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.East);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
        if (room.y < this.$area.size.height - 1 && (o & RoomExit.South) === RoomExit.South) {
            nx = room.x;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.North);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
        if (room.y < this.$area.size.height - 1 && room.x < this.$area.size.width - 1 && (o & RoomExit.SouthEast) === RoomExit.SouthEast) {
            nx = room.x + 1;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.NorthWest);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
        if (room.x > 0 && room.y < this.$area.size.height - 1 && (o & RoomExit.SouthWest) === RoomExit.SouthWest) {
            nx = room.x - 1;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.NorthEast);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
        if (this.$depth + 1 < this.$area.size.depth && (o & RoomExit.Up) === RoomExit.Up) {
            p = this.getRoom(room.x, room.y, this.$depth + 1);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.Down);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
        if (this.$depth - 1 >= 0 && (o & RoomExit.Down) === RoomExit.Down) {
            p = this.getRoom(room.x, room.y, this.$depth - 1);
            if (p) {
                po = p.clone();
                p.removeExit(RoomExit.Up);
                if (p.exits !== po.exits) {
                    if (!noUndo)
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
        }
    }

    private addRoom(room) {
        this.pushUndo(undoAction.add, undoType.room, this.getRoom(room.x, room.y, room.z));
        this.setRoom(room);
        const o = room.exits;
        let nx;
        let ny;
        let p;
        let po;
        if (room.y === 0) {
            room.removeExit(RoomExit.North);
            room.removeExit(RoomExit.NorthEast);
            room.removeExit(RoomExit.NorthWest);
        }
        if (room.y === this.$area.size.height - 1) {
            room.removeExit(RoomExit.South);
            room.removeExit(RoomExit.SouthEast);
            room.removeExit(RoomExit.SouthWest);
        }

        if (room.x === 0) {
            room.removeExit(RoomExit.West);
            room.removeExit(RoomExit.NorthWest);
            room.removeExit(RoomExit.SouthWest);
        }
        if (room.x === this.$area.size.width - 1) {
            room.removeExit(RoomExit.East);
            room.removeExit(RoomExit.NorthEast);
            room.removeExit(RoomExit.SouthEast);
        }

        if (room.y > 0 && (o & RoomExit.North) === RoomExit.North) {
            nx = room.x;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.South);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
            else
                room.removeExit(RoomExit.North);
        }
        if (room.y > 0 && room.x > 0 && (o & RoomExit.NorthWest) === RoomExit.NorthWest) {
            nx = room.x - 1;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.SouthEast);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            } else
                room.removeExit(RoomExit.NorthWest);
        }
        if (room.y > 0 && room.x < this.$area.size.width - 1 && (o & RoomExit.NorthEast) === RoomExit.NorthEast) {
            nx = room.x + 1;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.SouthWest);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            } else
                room.removeExit(RoomExit.NorthEast);
        }
        if (room.x < this.$area.size.width - 1 && (o & RoomExit.East) === RoomExit.East) {
            nx = room.x + 1;
            ny = room.y;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.West);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            } else
                room.removeExit(RoomExit.East);
        }
        if (room.x > 0 && (o & RoomExit.West) === RoomExit.West) {
            nx = room.x - 1;
            ny = room.y;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.East);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            } else
                room.removeExit(RoomExit.West);
        }
        if (room.y < this.$area.size.height - 1 && (o & RoomExit.South) === RoomExit.South) {
            nx = room.x;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.North);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            } else
                room.removeExit(RoomExit.South);
        }
        if (room.y < this.$area.size.height - 1 && room.x < this.$area.size.width - 1 && (o & RoomExit.SouthEast) === RoomExit.SouthEast) {
            nx = room.x + 1;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.NorthWest);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
            else
                room.removeExit(RoomExit.SouthEast);
        }
        if (room.x > 0 && room.y < this.$area.size.height - 1 && (o & RoomExit.SouthWest) === RoomExit.SouthWest) {
            nx = room.x - 1;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.NorthEast);
                this.DrawRoom(this.$mapContext, p, true, false);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
            else
                room.removeExit(RoomExit.SouthWest);
        }
        if (this.$depth + 1 < this.$area.size.depth && (o & RoomExit.Up) === RoomExit.Up) {
            p = this.getRoom(room.x, room.y, this.$depth + 1);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.Down);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
            else
                room.removeExit(RoomExit.Up);
        }
        if (this.$depth - 1 >= 0 && (o & RoomExit.Down) === RoomExit.Down) {
            p = this.getRoom(room.x, room.y, this.$depth - 1);
            if (p) {
                po = p.clone();
                p.addExit(RoomExit.Up);
                if (p.exits !== po.exits) {
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                    this.RoomChanged(p, po);
                }
            }
            else
                room.removeExit(RoomExit.Down);
        }
    }

    public get selected(): any {
        switch (this.$view) {
            case View.map:
                return '';
            case View.properties:
                switch (this.$propertiesEditor.tabs.querySelector('.active').firstChild.textContent) {
                    case 'Base rooms':
                        return this.$propertiesEditor.roomGrid.selected();
                    case 'Base rooms':
                        return this.$propertiesEditor.monsterGrid.selected();
                }
                return null;
            case View.monsters:
                return this.$monsterGrid.selected();
            case View.objects:
                return this.$objectGrid.selected();
        }
        return '';
    }

    public selectAll() {
        switch (this.$view) {
            case View.map:
                this.setSelection(0, 0, this.$area.size.width, this.$area.size.height);
                break;
            case View.properties:
                switch (this.$propertiesEditor.tabs.querySelector('.active').firstChild.textContent) {
                    case 'Base rooms':
                        this.$propertiesEditor.roomGrid.selectAll();
                        break;
                    case 'Base rooms':
                        this.$propertiesEditor.monsterGrid.selectAll();
                        break;
                }
                break;
            case View.monsters:
                this.$monsterGrid.selectAll();
                break;
            case View.objects:
                this.$objectGrid.selectAll();
                break;
        }
    }

    public cut() {
        switch (this.$view) {
            case View.map:
                if (this.$selectedRooms.length === 0) return;
                const rooms = this.$selectedRooms.map(r => r.clone());
                clipboard.writeBuffer('jiMUD/Area', Buffer.from(JSON.stringify({
                    rooms: rooms
                })));
                this.startUndoGroup();
                this.pushUndo(undoAction.delete, undoType.room, rooms);
                let sl = this.$selectedRooms.length;
                while (sl--) {
                    const or = this.$selectedRooms[sl];
                    //has external rooms so remove them as they are now tied to the room
                    this.$selectedRooms[sl] = new Room(or.x, or.y, or.z, this.$area.baseRooms[this.$area.defaultRoom], this.$area.defaultRoom);
                    if (this.$focusedRoom.at(or.x, or.y, or.z))
                        this.$focusedRoom = this.$selectedRooms[sl];
                    this.setRoom(this.$selectedRooms[sl]);
                    this.RoomChanged(this.$selectedRooms[sl], or);
                    this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, this.$selectedRooms[sl].at(this.$mouse.rx, this.$mouse.ry));
                    this.deleteRoom(or);
                }
                this.stopUndoGroup();
                this.emit('supports-changed');
                break;
            case View.properties:
                switch (this.$propertiesEditor.tabs.querySelector('.active').firstChild.textContent) {
                    case 'Base rooms':
                        this.$propertiesEditor.roomGrid.cut();
                        break;
                    case 'Base rooms':
                        this.$propertiesEditor.monsterGrid.cut();
                        break;
                }
                break;
            case View.monsters:
                this.$monsterGrid.cut();
                break;
            case View.objects:
                this.$objectGrid.cut();
                break;
        }
    }

    public copy() {
        switch (this.$view) {
            case View.map:
                if (this.$selectedRooms.length === 0) return;
                const rooms = this.$selectedRooms.map(r => {
                    const n = r.clone();
                    return n;
                });
                clipboard.writeBuffer('jiMUD/Area', Buffer.from(JSON.stringify({
                    rooms: rooms
                })));
                this.emit('supports-changed');
                break;
            case View.properties:
                switch (this.$propertiesEditor.tabs.querySelector('.active').firstChild.textContent) {
                    case 'Base rooms':
                        this.$propertiesEditor.roomGrid.copy();
                        break;
                    case 'Base rooms':
                        this.$propertiesEditor.monsterGrid.copy();
                        break;
                }
                break;
            case View.monsters:
                this.$monsterGrid.copy();
                break;
            case View.objects:
                this.$objectGrid.copy();
                break;
        }
    }

    public paste() {
        switch (this.$view) {
            case View.map:
                if (!clipboard.has('jiMUD/Area')) return;
                let or;
                if (this.$focusedRoom && this.$selectedRooms.indexOf(this.$focusedRoom) === -1)
                    or = this.$focusedRoom.clone();
                else
                    or = this.selectedFocusedRoom.clone();
                const data = JSON.parse(clipboard.readBuffer('jiMUD/Area').toString());
                const osX = data.rooms[0].x - or.x;
                const osY = data.rooms[0].y - or.y;
                let dl = data.rooms.length;
                const rooms = [];
                this.startUndoGroup();
                while (dl--) {
                    const dRoom = data.rooms[dl];
                    const room = new Room(dRoom.x - osX, dRoom.y - osY, dRoom.z, this.$area.baseRooms[this.$area.defaultRoom], this.$area.defaultRoom);
                    let prop;
                    for (prop in dRoom) {
                        if (prop === 'x' || prop === 'y' || prop === 'z' || !dRoom.hasOwnProperty(prop)) continue;
                        room[prop] = dRoom[prop];
                    }
                    this.addRoom(room);
                    this.RoomChanged(room, or);
                    rooms.unshift(room);
                }
                this.stopUndoGroup();
                if (this.$focusedRoom)
                    this.setFocusedRoom(this.$focusedRoom.x, this.$focusedRoom.y, this.$focusedRoom.z);
                this.setSelectedRooms(rooms);
                break;
            case View.properties:
                switch (this.$propertiesEditor.tabs.querySelector('.active').firstChild.textContent) {
                    case 'Base rooms':
                        this.$propertiesEditor.roomGrid.paste();
                        break;
                    case 'Base rooms':
                        this.$propertiesEditor.monsterGrid.paste();
                        break;
                }
                break;
            case View.monsters:
                this.$monsterGrid.paste();
                break;
            case View.objects:
                this.$objectGrid.paste();
                break;
        }
    }

    public delete() {
        switch (this.$view) {
            case View.map:
                if (this.$selectedRooms.length === 0) return;
                this.startUndoGroup();
                this.pushUndo(undoAction.delete, undoType.room, this.$selectedRooms.map(r => r.clone()));
                let sl = this.$selectedRooms.length;
                while (sl--) {
                    const or = this.$selectedRooms[sl];
                    this.$selectedRooms[sl] = new Room(or.x, or.y, or.z, this.$area.baseRooms[this.$area.defaultRoom], this.$area.defaultRoom);
                    if (this.$focusedRoom.at(or.x, or.y, or.z))
                        this.$focusedRoom = this.$selectedRooms[sl];
                    this.setRoom(this.$selectedRooms[sl]);
                    this.RoomChanged(this.$selectedRooms[sl], or);
                    this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, this.$selectedRooms[sl].at(this.$mouse.rx, this.$mouse.ry));
                    this.deleteRoom(or);
                }
                this.stopUndoGroup();
                this.emit('supports-changed');
                break;
            case View.properties:
                switch (this.$propertiesEditor.tabs.querySelector('.active').firstChild.textContent) {
                    case 'Base rooms':
                        this.$propertiesEditor.roomGrid.delete();
                        break;
                    case 'Base rooms':
                        this.$propertiesEditor.monsterGrid.delete();
                        break;
                }
                break;
            case View.monsters:
                this.$monsterGrid.delete();
                break;
            case View.objects:
                this.$objectGrid.delete();
                break;
        }
    }

    public undo() {
        if (this.$undo.length) {
            const u = this.$undo.pop();
            if (Array.isArray(u)) {
                this.startRedoGroup();
                let ul = u.length;
                while (ul--)
                    this.undoAction(u[ul]);
                this.stopRedoGroup();
            }
            else
                this.undoAction(u);
            this.emit('supports-changed');
        }
    }

    private undoAction(undo) {
        if (!undo) return;
        let l;
        let room;
        if (undo.view !== this.$view)
            this.switchView(undo.view);
        switch (undo.action) {
            case undoAction.add:
                switch (undo.type) {
                    case undoType.object:
                        delete this.$area.objects[undo.data.id];
                        this.pushRedo(undo);
                        this.changed = true;
                        this.updateObjects();
                        break;
                    case undoType.monster:
                        delete this.$area.monsters[undo.data.id];
                        this.pushRedo(undo);
                        this.changed = true;
                        this.updateMonsters();
                        break;
                    case undoType.properties:
                        switch (undo.data.property) {
                            case 'baserooms':
                                //this.pushUndo(undoAction.add, undoType.properties, { property: 'baserooms', name: 'base' + this.$new.baseRooms, value: e.data });
                                delete this.$area.baseRooms[undo.data.name];
                                this.pushRedo(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                break;
                            case 'basemonsters':
                                //this.pushUndo(undoAction.add, undoType.properties, { property: 'baserooms', name: 'base' + this.$new.baseRooms, value: e.data });
                                delete this.$area.baseMonsters[undo.data.name];
                                this.pushRedo(undo);
                                this.updateBaseMonsters();
                                this.changed = true;
                                break;
                        }
                        break;
                    case undoType.room:
                        room = this.getRoom(undo.data.x, undo.data.y, undo.data.z);
                        this.setRoom(undo.data);
                        this.DrawRoom(this.$mapContext, room, true, undo.data[l].at(this.$mouse.rx, this.$mouse.ry));
                        undo.data = room;
                        this.pushRedo(undo);
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[3])));
                        this.setFocusedRoom(undo.focused);
                        break;
                }
                break;
            case undoAction.delete:
                switch (undo.type) {
                    case undoType.object:
                        undo.data.values.forEach(r => {
                            this.$area.objects[r.id] = r.value;
                        });
                        this.pushRedo(undo);
                        this.updateObjects();
                        this.changed = true;
                        break;
                    case undoType.monster:
                        undo.data.values.forEach(r => {
                            this.$area.monsters[r.id] = r.value;
                        });
                        this.pushRedo(undo);
                        this.updateMonsters();
                        this.changed = true;
                        break;
                    case undoType.properties:
                        switch (undo.data.property) {
                            case 'baserooms':
                                undo.data.values.forEach(r => {
                                    this.$area.baseRooms[r.name] = r.value;
                                });
                                this.pushRedo(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                /*
                                this.pushUndo(undoAction.delete, undoType.properties, {
                                    property: 'baserooms', values: e.data.map(r => {
                                        delete this.$area.baseRooms[r.data.name];
                                        return { name: r.name, value: r.room };
                                    })
                                });
                                */
                                break;
                            case 'basemonsters':
                                undo.data.values.forEach(r => {
                                    this.$area.baseMonsters[r.name] = r.value;
                                });
                                this.pushRedo(undo);
                                this.updateBaseMonsters();
                                this.changed = true;
                                break;
                        }
                        break;
                    case undoType.room:
                        l = undo.data.length;
                        const values = [];
                        const mx = this.$mouse.rx;
                        const my = this.$mouse.ry;
                        while (l--) {
                            values[l] = this.getRoom(undo.data[l].x, undo.data[l].y, undo.data[l].z).clone();
                            this.setRoom(undo.data[l]);
                            this.RoomChanged(undo.data[l]);
                            if (values[l].exits) this.$roomCount--;
                            if (undo.data[l].exits) this.$roomCount++;
                            this.DrawRoom(this.$mapContext, undo.data[l], true, undo.data[l].at(mx, my));
                        }
                        this.doUpdate(UpdateType.status);
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[3])));
                        this.setFocusedRoom(undo.focused);
                        undo.data = values;
                        this.pushRedo(undo);
                        break;
                    case undoType.area:
                        room = this.$area;
                        this.$area = undo.data;
                        undo.data = room;
                        this.pushRedo(undo);
                        this.doUpdate(UpdateType.buildMap);
                        this.switchView(undo.view, true);
                        this.changed = true;
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[3])));
                        this.setFocusedRoom(undo.focused);
                        break;
                }
                break;
            case undoAction.edit:
                switch (undo.type) {
                    case undoType.object:
                        this.$area.objects[undo.data.old.id] = undo.data.old.object;
                        this.pushRedo(undo);
                        this.updateObjects();
                        this.changed = true;
                        break;
                    case undoType.monster:
                        this.$area.monsters[undo.data.old.id] = undo.data.old.monster;
                        this.pushRedo(undo);
                        this.updateMonsters();
                        this.changed = true;
                        break;
                    case undoType.properties:
                        //this.pushUndo(undoAction.edit, undoType.properties, { property: 'baserooms', old: oldValue, new: newValue });
                        switch (undo.data.property) {
                            case 'baserooms':
                                if (undo.data.old.name !== undo.data.new.name)
                                    delete this.$area.baseRooms[undo.data.new.name];
                                this.$area.baseRooms[undo.data.old.name] = undo.data.old.room;
                                this.pushRedo(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                break;
                            case 'basemonsters':
                                if (undo.data.old.name !== undo.data.new.name)
                                    delete this.$area.baseMonsters[undo.data.new.name];
                                this.$area.baseMonsters[undo.data.old.name] = undo.data.old.monster;
                                this.pushRedo(undo);
                                this.updateBaseMonsters();
                                this.changed = true;
                                break;
                            case 'defaultRoom':
                            case 'defaultMonster':
                                this.$area[undo.data.property] = undo.data.old;
                                this.$propertiesEditor[undo.data.property].val(undo.data.old).selectpicker('render');
                                this.pushRedo(undo);
                                this.changed = true;
                                break;
                        }
                        break;
                    case undoType.resize:
                        this.resizeMap(-undo.data.width, -undo.data.height, -undo.data.depth, undo.data.shift, true);
                        this.pushRedo(undo);
                        break;
                    case undoType.room:
                        l = undo.data.values.length;
                        const values = [];
                        const mx = this.$mouse.rx;
                        const my = this.$mouse.ry;
                        while (l--) {
                            room = this.getRoom(undo.data.rooms[l][0], undo.data.rooms[l][1], undo.data.rooms[2]);
                            values[l] = room[undo.data.property];
                            room[undo.data.property] = undo.data.values[l];
                            this.RoomChanged(room);
                            if (undo.data.property === 'exits') {
                                if (values[l].exits) this.$roomCount--;
                                if (room.exits) this.$roomCount++;
                            }
                            this.DrawRoom(this.$mapContext, room, true, room.at(mx, my));
                        }
                        this.doUpdate(UpdateType.status);
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[3])));
                        this.setFocusedRoom(undo.focused);
                        undo.data.values = values;
                        this.pushRedo(undo);
                        break;
                }
                break;
        }
    }

    public redo() {
        if (this.$redo.length) {
            const u = this.$redo.pop();
            if (Array.isArray(u)) {
                this.startUndoGroup(true);
                let ul = u.length;
                while (ul--)
                    this.redoAction(u[ul]);
                this.stopUndoGroup(true);
            }
            else
                this.redoAction(u);
            this.emit('supports-changed');
        }
    }

    private redoAction(undo) {
        if (!undo) return;
        let l;
        let room;
        if (undo.view !== this.$view)
            this.switchView(undo.view);
        switch (undo.action) {
            case undoAction.add:
                switch (undo.type) {
                    case undoType.object:
                        this.$area.objects[undo.data.id] = undo.data.value;
                        this.pushUndoObject(undo);
                        this.changed = true;
                        this.updateObjects();
                        break;
                    case undoType.monster:
                        this.$area.monsters[undo.data.id] = undo.data.value;
                        this.pushUndoObject(undo);
                        this.changed = true;
                        this.updateMonsters();
                        break;
                    case undoType.properties:
                        switch (undo.data.property) {
                            case 'baserooms':
                                //this.pushUndo(undoAction.add, undoType.properties, { property: 'baserooms', name: 'base' + this.$new.baseRooms, value: e.data });
                                this.$area.baseRooms[undo.data.name] = undo.data.value;
                                this.pushUndoObject(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                break;
                            case 'basemonsters':
                                //this.pushUndo(undoAction.add, undoType.properties, { property: 'baserooms', name: 'base' + this.$new.baseRooms, value: e.data });
                                this.$area.baseMonsters[undo.data.name] = undo.data.value;
                                this.pushUndoObject(undo);
                                this.updateBaseMonsters();
                                this.changed = true;
                                break;
                        }
                        break;
                    case undoType.room:
                        room = this.getRoom(undo.data.x, undo.data.y, undo.data.z);
                        this.setRoom(undo.data);
                        this.DrawRoom(this.$mapContext, room, true, undo.data[l].at(this.$mouse.rx, this.$mouse.ry));
                        undo.data = room;
                        this.pushUndoObject(undo);
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[3])));
                        this.setFocusedRoom(undo.focused);
                        break;
                }
                break;
            case undoAction.delete:
                switch (undo.type) {
                    case undoType.properties:
                        switch (undo.data.property) {
                            case 'baserooms':
                                undo.data.values.forEach(r => {
                                    delete this.$area.baseRooms[r.name];
                                });
                                this.pushUndoObject(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                /*
                                this.pushUndo(undoAction.delete, undoType.properties, {
                                    property: 'baserooms', values: e.data.map(r => {
                                        delete this.$area.baseRooms[r.data.name];
                                        return { name: r.name, value: r.room };
                                    })
                                });
                                */
                                break;
                            case 'basemonsters':
                                undo.data.values.forEach(r => {
                                    delete this.$area.baseMonsters[r.name];
                                });
                                this.pushUndoObject(undo);
                                this.updateBaseMonsters();
                                this.changed = true;
                                /*
                                this.pushUndo(undoAction.delete, undoType.properties, {
                                    property: 'baserooms', values: e.data.map(r => {
                                        delete this.$area.baseRooms[r.data.name];
                                        return { name: r.name, value: r.room };
                                    })
                                });
                                */
                                break;
                        }
                        break;
                    case undoType.room:
                        l = undo.data.length;
                        const values = [];
                        const mx = this.$mouse.rx;
                        const my = this.$mouse.ry;
                        while (l--) {
                            values[l] = this.getRoom(undo.data[l].x, undo.data[l].y, undo.data[l].z).clone();
                            this.setRoom(undo.data[l]);
                            this.RoomChanged(undo.data[l]);
                            if (values[l].exits) this.$roomCount--;
                            if (undo.data[l].exits) this.$roomCount++;
                            this.DrawRoom(this.$mapContext, undo.data[l], true, undo.data[l].at(mx, my));
                        }
                        this.doUpdate(UpdateType.status);
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[3])));
                        this.setFocusedRoom(undo.focused);
                        undo.data = values;
                        this.pushUndoObject(undo);
                        break;
                    case undoType.area:
                        room = this.$area;
                        this.$area = undo.data;
                        undo.data = room;
                        this.pushUndoObject(undo);
                        this.doUpdate(UpdateType.buildMap);
                        this.switchView(undo.view, true);
                        this.changed = true;
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[3])));
                        this.setFocusedRoom(undo.focused);
                        break;
                }
                break;
            case undoAction.edit:
                switch (undo.type) {
                    case undoType.properties:
                        //this.pushUndo(undoAction.edit, undoType.properties, { property: 'baserooms', old: oldValue, new: newValue });
                        switch (undo.data.property) {
                            case 'baserooms':
                                if (undo.data.old.name !== undo.data.new.name)
                                    delete this.$area.baseRooms[undo.data.old.name];
                                this.$area.baseRooms[undo.data.new.name] = undo.data.new;
                                this.pushUndoObject(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                break;
                            case 'basemonsters':
                                if (undo.data.old.name !== undo.data.new.name)
                                    delete this.$area.baseMonsters[undo.data.old.name];
                                this.$area.baseMonsters[undo.data.new.name] = undo.data.new;
                                this.pushUndoObject(undo);
                                this.updateBaseMonsters();
                                this.changed = true;
                                break;
                            case 'defaultRoom':
                            case 'defaultMonster':
                                this.$area[undo.data.property] = undo.data.new;
                                this.$propertiesEditor[undo.data.property].val(undo.data.new).selectpicker('render');
                                this.pushUndoObject(undo);
                                this.changed = true;
                                break;
                        }
                        break;
                    case undoType.resize:
                        this.resizeMap(undo.data.width, undo.data.height, undo.data.depth, undo.data.shift, true);
                        this.pushUndoObject(undo);
                        break;
                    case undoType.room:
                        l = undo.data.values.length;
                        const values = [];
                        const mx = this.$mouse.rx;
                        const my = this.$mouse.ry;
                        while (l--) {
                            room = this.getRoom(undo.data.rooms[l][0], undo.data.rooms[l][1], undo.data.rooms[2]);
                            values[l] = room[undo.data.property];
                            room[undo.data.property] = undo.data.values[l];
                            this.RoomChanged(room);
                            if (undo.data.property === 'exits') {
                                if (values[l].exits) this.$roomCount--;
                                if (room.exits) this.$roomCount++;
                            }
                            this.DrawRoom(this.$mapContext, room, true, room.at(mx, my));
                        }
                        this.doUpdate(UpdateType.status);
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[3])));
                        this.setFocusedRoom(undo.focused);
                        undo.data.values = values;
                        this.pushUndoObject(undo);
                        break;
                }
                break;
        }
    }

    public close() {
        const root = path.dirname(this.file);
        this.emit('watch-stop', [root, this.file]);
        window.removeEventListener('mousemove', this._wMove);
        window.removeEventListener('mouseup', this._wUp);
    }

    public deleted(keep, file?) {
        if (file !== this.file) return;
        if (!keep) return;
        this.changed = true;
    }

    public watch(action: string, file: string, details?) {
        if (this.new || file !== this.file)
            return;
        switch (action) {
            case 'add':
            case 'change':
            case 'unlink':
                if (!this.$saving[path.basename(file)]) {
                    if (details && details.mtimeMs < this.opened)
                        return;
                    this.emit('reload', action, file);
                }
                else
                    this.$saving[path.basename(file)] = false;
                break;
        }
    }

    public set spellcheck(value: boolean) { /**/ }
    public find() { /**/ }
    public replace() { /**/ }
    public supports(what) {
        switch (what) {
            case 'refresh':
                return this.$view === View.map || this.$view === View.monsters || this.$view === View.objects || this.$view === View.properties;
            case 'buttons':
            case 'menu|view':
            case 'menu|edit':
            case 'upload':
            case 'upload-as':
            case 'selectall':
            case 'select-all':
                return true;
            case 'cut':
            case 'copy':
            case 'delete':
                switch (this.$view) {
                    case View.map:
                        return true;
                    case View.monsters:
                        return false;
                    case View.objects:
                        return false;
                }
                return false;
            case 'paste':
                switch (this.$view) {
                    case View.map:
                        return clipboard.has('jiMUD/Area');
                    case View.monsters:
                        return false;
                    case View.objects:
                        return false;
                }
                return false;
            case 'undo':
                return this.$undo.length > 0;
            case 'redo':
                return this.$redo.length > 0;
        }
        return false;
    }

    public get buttons() {
        const frag = document.createDocumentFragment();
        let group;
        let el;
        group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');
        group.appendChild(this.createButton('Show room editor', 'columns', () => {
            this.$splitterEditor.panel2Collapsed = !this.$splitterEditor.panel2Collapsed;
        }, !this.$splitterEditor.panel2Collapsed, this.$view !== View.map));
        group.appendChild(this.createButton('Show room preview', 'columns fa-rotate-90', () => {
            this.$splitterPreview.panel2Collapsed = !this.$splitterPreview.panel2Collapsed;
        }, !this.$splitterPreview.panel2Collapsed, this.$view !== View.map));
        frag.appendChild(group);
        group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');
        group.appendChild(this.createButton('Show map', 'map-o', () => {
            this.switchView(View.map);
        }, this.$view === View.map));
        group.appendChild(this.createButton('Show properties', 'list-alt', () => {
            this.switchView(View.properties);
        }, this.$view === View.properties));
        group.appendChild(this.createButton('Show monsters', 'user', () => {
            this.switchView(View.monsters);
        }, this.$view === View.monsters));
        group.appendChild(this.createButton('Show objects', 'list', () => {
            this.switchView(View.objects);
        }, this.$view === View.objects));
        frag.appendChild(group);

        group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');
        group.appendChild(this.createButton('Allow exit walk', 'blind', () => {
            this.AllowExitWalk = !this.$allowExitWalk;
        }, this.$allowExitWalk, this.$view !== View.map));
        group.appendChild(this.createButton('Allow resize walk', 'expand', () => {
            this.AllowResize = !this.$allowResize;
        }, this.$allowResize, this.$view !== View.map));
        frag.appendChild(group);

        frag.appendChild(this.createButton('Resize map', 'arrows', () => {
            this.emit('show-resize', this.$area.size);
        }, false, this.$view !== View.map));
        if (this.$area.size.depth > 1) {
            el = document.createElement('label');
            el.setAttribute('for', this.parent.id + '-level');
            el.classList.add('label');
            el.textContent = 'Level';
            frag.appendChild(el);
            frag.appendChild(this.$depthToolbar);
        }
        return [frag];
    }

    private createButton(id, icon, fun, active, disabled?, title?) {
        const el = document.createElement('button');
        el.id = 'btn-' + id.replace(/\s+/g, '-').toLowerCase();
        el.type = 'button';
        el.classList.add('btn', 'btn-default', 'btn-xs');
        if (active)
            el.classList.add('active');
        if (disabled)
            el.setAttribute('disabled', 'true');
        el.title = title || id;
        el.onclick = fun;
        el.innerHTML = '<i class="fa fa-' + icon + '"></i>';
        return el;
    }

    private setButtonState(id, state) {
        const button = document.getElementById('btn-' + id.replace(/\s+/g, '-').toLowerCase());
        if (!button) return;
        if (state)
            button.classList.add('active');
        else
            button.classList.remove('active');
    }

    private setButtonDisabled(id, state) {
        const button = document.getElementById('btn-' + id.replace(/\s+/g, '-').toLowerCase());
        if (!button) return;
        if (state)
            button.setAttribute('disabled', 'true');
        else
            button.removeAttribute('disabled');
    }

    public menu(menu) {
        let m;
        if (menu === 'view') {
            m = [
                {
                    label: 'Map',
                    type: 'checkbox',
                    checked: this.$view === View.map,
                    click: () => {
                        this.switchView(View.map);
                    }
                },
                {
                    label: 'Properties',
                    type: 'checkbox',
                    checked: this.$view === View.properties,
                    click: () => {
                        this.switchView(View.properties);
                    }
                },
                {
                    label: 'Monsters',
                    type: 'checkbox',
                    checked: this.$view === View.monsters,
                    click: () => {
                        this.switchView(View.monsters);
                    }
                },
                {
                    label: 'Objects',
                    type: 'checkbox',
                    checked: this.$view === View.objects,
                    click: () => {
                        this.switchView(View.objects);
                    }
                }

            ];
            m.push({ type: 'separator' });
            m.push({
                label: 'Room editor',
                type: 'checkbox',
                checked: !this.$splitterEditor.panel2Collapsed,
                click: () => {
                    this.$splitterEditor.panel2Collapsed = !this.$splitterEditor.panel2Collapsed;
                }
            });
            m.push({
                label: 'Room preview',
                type: 'checkbox',
                checked: !this.$splitterPreview.panel2Collapsed,
                click: () => {
                    this.$splitterPreview.panel2Collapsed = !this.$splitterPreview.panel2Collapsed;
                }
            });
        }
        else if (menu === 'edit') {
            m = [
                { type: 'separator' },
                {
                    label: 'Allow exit walk',
                    type: 'checkbox',
                    checked: this.$allowExitWalk,
                    click: () => {
                        this.AllowExitWalk = !this.$allowExitWalk;
                    }
                },
                {
                    label: 'Allow resize walk',
                    type: 'checkbox',
                    checked: this.$allowResize,
                    click: () => {
                        this.AllowResize = !this.$allowResize;
                    }
                },
                {
                    label: 'Resize map',
                    click: () => {
                        this.emit('show-resize', this.$area.size);
                    }
                }
            ];
        }
        return m;
    }

    public focus(): void {
        if (this.parent.contains(document.activeElement))
            return;
        switch (this.$view) {
            case View.map:
                setTimeout(() => {
                    this.$mapContainer.focus();
                    this.$map.focus();
                }, 10);
                break;
            case View.properties:
                break;
            case View.monsters:
                break;
            case View.objects:
                break;
        }
    }

    private offset(elt) {
        const rect = elt.getBoundingClientRect();
        const bodyElt = document.body;
        return {
            top: rect.top + bodyElt.scrollTop,
            left: rect.left + bodyElt.scrollLeft
        };
    }

    public resize() {
        this._os = this.offset(this.$mapContainer);
        this.$xAxis.style.left = (32 - this.$mapContainer.scrollLeft) + 'px';
        this.$yAxis.style.top = (32 - this.$mapContainer.scrollTop) + 'px';
    }

    public set options(value: any) {
        if (!value) return;
        this.$enterMoveFirst = value.enterMoveFirst;
        this.$enterMoveNext = value.enterMoveNext;
        this.$enterMoveNew = value.enterMoveNew;

        if (this.$roomEditor) {
            const props = ['items', 'exitsDetails', 'sounds', 'smells', 'objects', 'monsters', 'searches'];
            let pl = props.length;
            while (pl--) {
                const ops = this.$roomEditor.getPropertyOptions(props[pl]);
                if (!ops) continue;
                ops.editor.options.enterMoveFirst = this.$enterMoveFirst;
                ops.editor.options.enterMoveNext = this.$enterMoveNext;
                ops.editor.options.enterMoveNew = this.$enterMoveNew;
                this.$roomEditor.setPropertyOptions(props[pl], ops);
            }
        }

        let cols = this.$propertiesEditor.roomGrid.columns;
        cols[1].editor.options.enterMoveFirst = this.$enterMoveFirst;
        cols[1].editor.options.enterMoveNext = this.$enterMoveNext;
        cols[1].editor.options.enterMoveNew = this.$enterMoveNew;
        cols[2].editor.options.enterMoveFirst = this.$enterMoveFirst;
        cols[2].editor.options.enterMoveNext = this.$enterMoveNext;
        cols[2].editor.options.enterMoveNew = this.$enterMoveNew;
        this.$propertiesEditor.roomGrid.columns = cols;

        //TODO update once monster columns set
        cols = this.$propertiesEditor.monsterGrid.columns;
        this.$propertiesEditor.monsterGrid.columns = cols;

        this.AllowResize = value.allowResize;
        this.AllowExitWalk = value.allowExitWalk;
        this.$roomPreview.container.style.fontSize = value.previewFontSize + 'px';
        this.$roomPreview.container.style.fontFamily = value.previewFontFamily;
        this.$splitterEditor.SplitterDistance = value.editorWidth;
        this.$splitterPreview.SplitterDistance = value.previewHeight;
        this.$splitterEditor.live = value.live;
        this.$splitterPreview.live = value.live;
        this.$splitterEditor.panel2Collapsed = !value.showRoomEditor;
        this.$splitterPreview.panel2Collapsed = !value.showRoomPreview;
    }

    public get options() {
        return {
            allowResize: this.$allowResize,
            allowExitWalk: this.$allowExitWalk,
            live: this.$splitterEditor.live,
            showRoomEditor: !this.$splitterEditor.panel2Collapsed,
            showRoomPreview: !this.$splitterPreview.panel2Collapsed
        };
    }

    public get type() {
        return 3;
    }

    public insert(text) { /**/ }

    public get location() { return [-1, -1]; }

    public get length() { return 0; }

    public activate() { /**/ }

    public deactivate() { /**/ }

    public switchView(view: View, force?) {
        if (!force && this.$view === view) return;
        let bGroup;
        let button;
        this.$label.style.display = '';
        switch (this.$view) {
            case View.map:
                this.$splitterEditor.hide();
                break;
            case View.properties:
                this.$propertiesEditor.container.style.display = 'none';
                break;
            case View.monsters:
                this.$monsterGrid.parent.style.display = 'none';
                break;
            case View.objects:
                this.$objectGrid.parent.style.display = 'none';
                break;
        }
        this.$view = view;
        switch (this.$view) {
            case View.map:
                this.UpdateEditor(this.$selectedRooms);
                this.UpdatePreview(this.selectedFocusedRoom);
                this.$label.style.display = 'none';
                this.$splitterEditor.show();
                this.emit('location-changed', -1, -1);
                break;
            case View.properties:
                this.$label.textContent = 'Properties';
                this.$propertiesEditor.container.style.display = '';
                break;
            case View.monsters:
                this.$label.textContent = 'Monsters';

                bGroup = document.createElement('div');
                bGroup.classList.add('btn-group');

                button = document.createElement('button');
                button.type = 'button';
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$monsterGrid.addNewRow();
                });
                button.title = 'Add monster';
                button.innerHTML = '<i class="fa fa-plus"></i> Add';
                bGroup.appendChild(button);

                button = document.createElement('button');
                button.type = 'button';
                button.disabled = this.$monsterGrid.selectedCount === 0;
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$monsterGrid.focus();
                    this.$monsterGrid.beginEdit(this.$monsterGrid.selected[0].row);
                });
                button.title = 'Edit monster';
                button.innerHTML = '<i class="fa fa-edit"></i> Edit';
                bGroup.appendChild(button);

                button = document.createElement('button');
                button.disabled = this.$monsterGrid.selectedCount === 0;
                button.type = 'button';
                button.title = 'Delete monster(s)';
                button.classList.add('btn', 'btn-danger', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$monsterGrid.delete();
                });
                button.innerHTML = '<i class="fa fa-trash"></i> Delete';
                bGroup.appendChild(button);
                this.$label.appendChild(bGroup);

                bGroup = document.createElement('div');
                bGroup.classList.add('btn-group');
                bGroup.style.display = 'none';

                this.$label.appendChild(bGroup);

                this.$monsterGrid.parent.style.display = '';
                this.$monsterGrid.focus();
                break;
            case View.objects:
                this.$label.textContent = 'Objects';
                bGroup = document.createElement('div');
                bGroup.classList.add('btn-group');

                button = document.createElement('button');
                button.type = 'button';
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$objectGrid.addNewRow();
                });
                button.title = 'Add object';
                button.innerHTML = '<i class="fa fa-plus"></i> Add';
                bGroup.appendChild(button);

                button = document.createElement('button');
                button.type = 'button';
                button.disabled = this.$objectGrid.selectedCount === 0;
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$objectGrid.focus();
                    this.$objectGrid.beginEdit(this.$objectGrid.selected[0].row);
                });
                button.title = 'Edit object';
                button.innerHTML = '<i class="fa fa-edit"></i> Edit';
                bGroup.appendChild(button);

                button = document.createElement('button');
                button.disabled = this.$objectGrid.selectedCount === 0;
                button.type = 'button';
                button.title = 'Delete object(s)';
                button.classList.add('btn', 'btn-danger', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$objectGrid.delete();
                });
                button.innerHTML = '<i class="fa fa-trash"></i> Delete';
                bGroup.appendChild(button);
                this.$label.appendChild(bGroup);

                bGroup = document.createElement('div');
                bGroup.classList.add('btn-group');
                bGroup.style.display = 'none';

                this.$label.appendChild(bGroup);

                this.$objectGrid.parent.style.display = '';
                this.$objectGrid.focus();
                break;
        }
        this.emit('menu-update', 'view|map', { checked: view === View.map });
        this.emit('menu-update', 'view|monsters', { checked: view === View.monsters });
        this.emit('menu-update', 'view|properties', { checked: view === View.properties });
        this.emit('menu-update', 'view|Items', { checked: view === View.objects });
        this.emit('menu-update', 'view|room editor', { enabled: view === View.map });
        this.emit('menu-update', 'view|room preview', { enabled: view === View.map });
        this.emit('menu-update', 'edit|allow exit walk', { enabled: view === View.map });
        this.emit('menu-update', 'edit|allow resize walk', { enabled: view === View.map });
        this.emit('menu-update', 'edit|resize map', { enabled: view === View.map });
        this.setButtonDisabled('show room editor', view !== View.map);
        this.setButtonDisabled('show room preview', view !== View.map);
        this.setButtonDisabled('allow exit walk', view !== View.map);
        this.setButtonDisabled('allow resize walk', view !== View.map);
        this.setButtonDisabled('resize map', view !== View.map);
        this.setButtonState('show-map', view === View.map);
        this.setButtonState('show-monsters', view === View.monsters);
        this.setButtonState('show-objects', view === View.objects);
        this.setButtonState('show-properties', view === View.properties);
        this.updateUI();
        this.emit('supports-changed');
        this.focus();
    }

    public updateUI() {

        switch (this.$view) {
            case View.map:
                this.emit('location-changed', (this.$mouse.rx), this.$mouse.ry);
                this.emit('changed', -1);
                break;
            case View.properties:
                this.emit('location-changed', -1, -1);
                break;
            case View.monsters:
                this.emit('location-changed', -1, -1);
                //this.emit('changed', this.$descriptions.length);
                break;
            case View.objects:
                this.emit('location-changed', -1, -1);
                //this.emit('changed', this.$items.length);
                break;
        }
        this.updateStatus();
    }

    private updateStatus() {
        if (this.$view === View.map)
            this.emit('status-message', `Rooms ${this.$roomCount}, Empty rooms ${(this.$area.size.width * this.$area.size.height * this.$area.size.depth) - this.$roomCount}, Total rooms ${this.$area.size.width * this.$area.size.height * this.$area.size.depth}`);
        else
            this.emit('status-message', '');
    }

    private setFocus(value) {
        if (this.$focused === value) return;
        this.$focused = value;
        let sl = this.$selectedRooms.length;
        while (sl--)
            this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, this.$selectedRooms[sl].at(this.$mouse.rx, this.$mouse.ry));
        if (this.$mouse.rx >= 0 && this.$mouse.ry > 0) {
            const r = this.getRoom(this.$mouse.rx, this.$mouse.ry);
            if (r) this.DrawRoom(this.$mapContext, r, true, true);
        }
        if (this.$focusedRoom)
            this.DrawRoom(this.$mapContext, this.$focusedRoom, true, this.$focusedRoom.at(this.$mouse.rx, this.$mouse.ry));
        if (this.$focused)
            this.$xAxisHighlight.style.backgroundColor = 'rgba(135, 206, 250, 0.25)';
        else
            this.$xAxisHighlight.style.backgroundColor = 'rgba(221, 221, 221, 0.5)';
        if (this.$focused)
            this.$yAxisHighlight.style.backgroundColor = 'rgba(135, 206, 250, 0.25)';
        else
            this.$yAxisHighlight.style.backgroundColor = 'rgba(221, 221, 221, 0.5)';
    }

    private getMousePos(evt): MousePosition {
        evt = evt || window.event;
        return {
            x: evt.offsetX,
            y: evt.offsetY,
            rx: (evt.offsetX / 32) >> 0,
            ry: (evt.offsetY / 32) >> 0,
            button: evt.button
        };
    }

    private getMousePosFromWindow(evt): MousePosition {
        evt = evt || window.event;
        const os = this._os;
        const x = (evt.pageX - os.left) + this.$mapContainer.scrollLeft;
        const y = (evt.pageY - os.top) + this.$mapContainer.scrollTop;
        return {
            x: x,
            y: y,
            rx: (x / 32) >> 0,
            ry: (y / 32) >> 0,
            button: evt.button
        };
    }

    private getRoom(x, y, z?): Room {
        if (typeof (z) === 'undefined')
            z = this.$depth || 0;
        if (x < 0 || y < 0 || !this.$area.rooms)
            return null;
        if (z >= this.$area.rooms.length)
            return null;
        if (y >= this.$area.rooms[z].length)
            return null;
        if (x >= this.$area.rooms[z][y].length)
            return null;
        return this.$area.rooms[z][y][x];
    }

    private setRoom(r) {
        if (!r)
            return;
        if (r.x < 0 || r.y < 0)
            return;
        if (r.z >= this.$area.rooms.length)
            return;
        if (r.y >= this.$area.rooms[r.z].length)
            return;
        if (r.x >= this.$area.rooms[r.z][r.y].length)
            return;
        //see if selected
        const idx = this.$selectedRooms.indexOf(this.$area.rooms[r.z][r.y][r.x]);
        this.$area.rooms[r.z][r.y][r.x] = r;
        //if selected update the selected system to point to new room object
        if (idx !== -1) {
            this.$selectedRooms[idx] = this.$area.rooms[r.z][r.y][r.x];
            this.UpdateEditor(this.$selectedRooms);
            this.UpdatePreview(r);
        }
        //was the old room focused? if so point ot new room object
        if (this.$focusedRoom && this.$focusedRoom.at(r.x, r.y, r.z))
            this.$focusedRoom = r;
        if (r.z === this.$depth)
            this.DrawRoom(this.$mapContext, r, true, r.at(this.$mouse.rx, this.$mouse.ry));
    }

    private DrawRoom(ctx, room, c, h?) {
        //var clr = "black";
        const x = room.x * 32;
        const y = room.y * 32;
        const ex = room.exits | room.climbs;
        let exs = ex;
        //if(ex === RoomExit.None) clr = "#E6E6E6";
        ctx.save();
        if (c) {
            ctx.fillStyle = 'white';
            ctx.fillRect(x, y, 32, 32);
        }

        ///ctx.translate(0.5,0.5);
        if (this.$focusedRoom === room) {
            if (this.$selectedRooms.indexOf(room) !== -1) {
                if (this.$focused)
                    ctx.fillStyle = 'rgba(135, 206, 250, 0.50)';
                else
                    ctx.fillStyle = 'rgba(142, 142, 142, 0.50)';
                ctx.fillRoundedRect(1 + x, 1 + y, 30, 30, 8);
            }
            if (this.$focused)
                ctx.strokeStyle = '#f7b32e';
            else
                ctx.strokeStyle = 'rgba(142, 142, 142, 0.50)';
            ctx.strokeRoundedRect(1 + x, 1 + y, 30, 30, 8);
        }
        else if (this.$selectedRooms.indexOf(room) !== -1) {
            if (this.$focused) {
                ctx.fillStyle = 'rgba(135, 206, 250, 0.50)';
                ctx.strokeStyle = 'rgba(135, 206, 250, 0.50)';
            }
            else {
                ctx.fillStyle = 'rgba(142, 142, 142, 0.50)';
                ctx.strokeStyle = 'rgba(142, 142, 142, 0.50)';
            }
            ctx.fillRoundedRect(1 + x, 1 + y, 30, 30, 8);
            ctx.strokeRoundedRect(1 + x, 1 + y, 30, 30, 8);
        }

        if (room.external) {
            ctx.strokeStyle = 'red';
            ctx.beginPath();
            if ((room.external & RoomExit.East) === RoomExit.East) {
                ctx.moveTo(x + 23.5, y + 15.5);
                ctx.lineTo(x + 31.5, y + 15.5);
            }
            if ((room.external & RoomExit.North) === RoomExit.North) {
                ctx.moveTo(x + 15.5, y);
                ctx.lineTo(x + 15.5, y + 7.5);
            }
            if ((room.external & RoomExit.NorthWest) === RoomExit.NorthWest) {
                ctx.moveTo(x, y);
                ctx.lineTo(x + 7.5, y + 7.5);
            }
            if ((room.external & RoomExit.NorthEast) === RoomExit.NorthEast) {
                ctx.moveTo(x + 31.5, y);
                ctx.lineTo(x + 23.5, y + 7.5);
            }
            if ((room.external & RoomExit.West) === RoomExit.West) {
                ctx.moveTo(x, y + 15.5);
                ctx.lineTo(x + 7.5, y + 15.5);
            }
            if ((room.external & RoomExit.South) === RoomExit.South) {
                ctx.moveTo(x + 15.5, y + 23.5);
                ctx.lineTo(x + 15.5, y + 31.5);
            }
            if ((room.external & RoomExit.SouthEast) === RoomExit.SouthEast) {
                ctx.moveTo(x + 31.5, y + 31.5);
                ctx.lineTo(x + 23.5, y + 23.5);
            }
            if ((room.external & RoomExit.NorthWest) === RoomExit.NorthWest) {
                ctx.moveTo(x, y + 31.5);
                ctx.lineTo(x + 7.5, y + 23.5);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.strokeStyle = 'black';
        }

        if ((exs & RoomExit.Up) === RoomExit.Up) exs &= ~RoomExit.Up;
        if ((exs & RoomExit.Down) === RoomExit.Down) exs &= ~RoomExit.Down;
        if ((exs & RoomExit.Out) === RoomExit.Out) exs &= ~RoomExit.Out;
        if ((exs & RoomExit.Enter) === RoomExit.Enter) exs &= ~RoomExit.Enter;
        if (exs === RoomExit.None && ex !== RoomExit.None && room.external !== RoomExit.None) {
            ctx.strokeStyle = 'black';
            ctx.strokeRect(0.5 + x + 7, 0.5 + y + 7, 17, 17);
        }
        else
            ctx.drawImage(window.$roomImg, ((exs % 16) >> 0) * 32, ((exs / 16) >> 0) * 32,
                32,
                32,
                x,
                y,
                32,
                32
            );

        if (room.ef) {
            ctx.fillStyle = '#FFE4E1';
            ctx.fillRect(x + 8, y + 8, 16, 16);
            if (ex !== RoomExit.None) {
                ctx.strokeStyle = 'black';
                ctx.strokeRect(0.5 + x + 7, 0.5 + y + 7, 17, 17);
            }
        }
        ctx.fillStyle = 'black';
        if (ex !== RoomExit.None) {
            if ((ex & RoomExit.Up) === RoomExit.Up) {
                if ((room.external & RoomExit.Up) === RoomExit.Up)
                    ctx.fillStyle = 'red';
                else
                    ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.moveTo(x + 1, y + 11);
                ctx.lineTo(x + 7, y + 11);
                ctx.lineTo(x + 4, y + 8);
                ctx.closePath();
                ctx.fill();

            }
            if ((ex & RoomExit.Down) === RoomExit.Down) {
                if ((room.external & RoomExit.Down) === RoomExit.Down)
                    ctx.fillStyle = 'red';
                else
                    ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.moveTo(x + 1, y + 21);
                ctx.lineTo(x + 7, y + 21);
                ctx.lineTo(x + 4, y + 24);
                ctx.closePath();
                ctx.fill();
            }
            if ((ex & RoomExit.Out) === RoomExit.Out) {
                if ((room.external & RoomExit.Out) === RoomExit.Out)
                    ctx.fillStyle = 'red';
                else
                    ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.moveTo(x + 26, y + 8);
                ctx.lineTo(x + 29, y + 11);
                ctx.lineTo(x + 26, y + 14);
                ctx.closePath();
                ctx.fill();
            }
            if ((ex & RoomExit.Enter) === RoomExit.Enter) {
                if ((room.external & RoomExit.Enter) === RoomExit.Enter)
                    ctx.fillStyle = 'red';
                else
                    ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.moveTo(x + 29, y + 19);
                ctx.lineTo(x + 26, y + 22);
                ctx.lineTo(x + 29, y + 25);
                ctx.closePath();
                ctx.fill();
            }
        }
        if (h) {
            if (this.$focused) {
                ctx.fillStyle = 'rgba(135, 206, 250, 0.5)';
                ctx.strokeStyle = 'rgba(135, 206, 250, 0.5)';
            }
            else {
                ctx.fillStyle = 'rgba(221, 221, 221, 0.75)';
                ctx.strokeStyle = 'rgba(142, 142, 142, 0.75)';
            }
            ctx.fillRoundedRect(1 + x, 1 + y, 30, 30, 8);
            ctx.strokeRoundedRect(1 + x, 1 + y, 30, 30, 8);
        }
        ctx.restore();
    }

    private DrawMap() {
        let x = 0;
        let y = 0;
        let r;
        let xl;
        let yl;
        if (!this.$mapContext) return;
        this.$mapContext.save();
        this.$mapContext.fillStyle = 'white';
        this.$mapContext.fillRect(0, 0, this.$area.size.right, this.$area.size.bottom);
        this.$mapContext.lineWidth = 0.6;
        if (!this.$area.rooms) {
            this.$mapContext.restore();
            return;
        }
        if (!window.$roomImgLoaded) {
            this.doUpdate(UpdateType.drawMap);
            return;
        }
        yl = this.$area.size.height;
        xl = this.$area.size.width;
        Timer.start();
        this.$mapContext.strokeStyle = 'black';
        for (y = 0; y < yl; y++) {
            r = this.$area.rooms[this.$depth][y];
            for (x = 0; x < xl; x++)
                this.DrawRoom(this.$mapContext, r[x], false);
        }
        this.$mapContext.strokeStyle = 'black';
        Timer.end('Draw time');
        this.$mapContext.restore();
    }

    private drawRegion(sX, sY, sWidth, sHeight, selection?) {
        let r;
        let x = (Math.min(sX, sX + sWidth) / 32) >> 0;
        x--;
        let y = (Math.min(sY, sY + sHeight) / 32) >> 0;
        y--;
        let width = Math.ceil(Math.max(sX, sX + sWidth) / 32) + 1;
        let height = Math.ceil(Math.max(sY, sY + sHeight) / 32) + 1;
        if (!this.$mapContext) return;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (width > this.$area.size.width)
            width = this.$area.size.width;
        if (height > this.$area.size.height)
            height = this.$area.size.height;
        this.$mapContext.save();
        this.$mapContext.fillStyle = 'white';
        this.$mapContext.fillRect(x * 32, y * 32, (width - x) * 32, (height - y) * 32);
        this.$mapContext.lineWidth = 0.6;
        if (!this.$area.rooms) {
            this.$mapContext.restore();
            return;
        }
        if (!window.$roomImgLoaded) {
            setTimeout(() => { this.drawRegion(sX, sY, sWidth, sHeight); }, 10);
            return;
        }
        this.$mapContext.strokeStyle = 'black';
        for (let rY = y; rY < height; rY++) {
            r = this.$area.rooms[this.$depth][rY];
            for (let rX = x; rX < width; rX++)
                this.DrawRoom(this.$mapContext, r[rX], false);
        }
        if (selection) {
            this.$mapContext.save();
            this.$mapContext.beginPath();
            this.$mapContext.fillStyle = 'rgba(135, 206, 250, 0.50)';
            this.$mapContext.strokeStyle = 'rgba(135, 206, 250, 0.50)';
            this.$mapContext.rect(sX, sY, sWidth, sHeight);
            this.$mapContext.stroke();
            this.$mapContext.fill();
            this.$mapContext.closePath();
            this.$mapContext.restore();
        }
        this.$mapContext.strokeStyle = 'black';
        this.$mapContext.restore();
    }

    private GetColorFromColorScale(val, min, max, colors) {
        if (!colors || colors.length < 2) return 'white';
        if (max === min) return colors[0];
        if (val > max) val = max;
        if (val < min) val = min;

        const cl = colors.length;
        const nSpan = (max - min) / cl;
        let curr = min;
        let start;
        let end;
        let c;

        for (c = 0; c < cl; c++) {
            if (val >= curr && val < curr + nSpan)
                break;
            curr += nSpan;
        }
        if (c >= cl - 1) {
            start = new RGBColor(colors[cl - 1]);
            end = new RGBColor(colors[cl - 2]);
        }
        else {
            start = new RGBColor(colors[c]);
            end = new RGBColor(colors[c + 1]);
        }

        let r;
        let g;
        let b;
        const vp = (val - curr) / nSpan;
        r = start.r + ((end.r - start.r) * vp);
        g = start.g + ((end.g - start.g) * vp);
        b = start.b + ((end.b - start.b) * vp);
        if (r < 0) r = 0;
        if (r > 255) r = 255;
        if (g < 0) g = 0;
        if (g > 255) g = 255;
        if (b < 0) b = 0;
        if (b > 255) b = 255;
        return 'rgb(' + (r >> 0) + ', ' + (g >> 0) + ', ' + (b >> 0) + ')';
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
            if ((this._updating & UpdateType.drawMap) === UpdateType.drawMap) {
                this.DrawMap();
                this._updating &= ~UpdateType.drawMap;
            }
            if ((this._updating & UpdateType.buildMap) === UpdateType.buildMap) {
                this.BuildMap();
                this._updating &= ~UpdateType.buildMap;
            }
            if ((this._updating & UpdateType.resize) === UpdateType.resize) {
                this.resize();
                this._updating &= ~UpdateType.resize;
            }
            if ((this._updating & UpdateType.status) === UpdateType.status) {
                this.updateStatus();
                this._updating &= ~UpdateType.status;
            }
            this.doUpdate(this._updating);
        });
    }

    private ChangeSelection() {
        this.UpdateEditor(this.$selectedRooms);
        this.UpdatePreview(this.selectedFocusedRoom);
        this.$shiftRoom = null;
        this.emit('rooms-selected', this.$selectedRooms);
    }

    private setSelectedRooms(rooms, noDraw?) {
        if (!Array.isArray(rooms))
            rooms = [rooms];
        let ol;
        if (!noDraw) {
            const old = this.$selectedRooms.slice();
            this.$selectedRooms.length = 0;
            ol = old.length;
            while (ol--)
                this.DrawRoom(this.$mapContext, old[ol], true);
        }
        else
            this.$selectedRooms.length = 0;
        ol = rooms.length;
        for (let o = 0; o < ol; o++) {
            if (!rooms[o]) continue;
            this.$selectedRooms.push(rooms[o]);
            if (!noDraw)
                this.DrawRoom(this.$mapContext, rooms[o], true, rooms[o].at(this.$mouse.rx, this.$mouse.ry));
        }
        this.ChangeSelection();
    }

    private setSelection(x, y, width, height) {
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (width > this.$area.size.width) width = this.$area.size.width;
        if (height > this.$area.size.height) height = this.$area.size.height;
        const old = this.$selectedRooms.slice();
        this.$selectedRooms.length = 0;
        let ol = old.length;
        while (ol--)
            this.DrawRoom(this.$mapContext, old[ol], true);
        if (y === height) {
            const r = this.$area.rooms[this.$depth][y];
            if (x === width)
                this.$selectedRooms.push(r[x]);
            else
                for (let rX = x; rX < width; rX++) {
                    this.$selectedRooms.push(r[rX]);
                    this.DrawRoom(this.$mapContext, r[rX], true, r[rX].at(this.$mouse.rx, this.$mouse.ry));
                }
        }
        else
            for (let rY = y; rY < height; rY++) {
                const r = this.$area.rooms[this.$depth][rY];
                if (x === width)
                    this.$selectedRooms.push(r[x]);
                else
                    for (let rX = x; rX < width; rX++) {
                        this.$selectedRooms.push(r[rX]);
                        this.DrawRoom(this.$mapContext, r[rX], true, r[rX].at(this.$mouse.rx, this.$mouse.ry));
                    }
            }
        this.ChangeSelection();
    }

    private setFocusedRoom(r, y?, z?) {
        if (typeof r === 'number')
            r = this.getRoom(r, y, z);
        else if (Array.isArray(r)) {
            if (r.length >= 3)
                r = this.getRoom(r[0], r[1], r[2]);
            else if (r.length === 2)
                r = this.getRoom(r[0], r[1]);
            else //not enough data
                return;
        }
        const oldFocus = this.$focusedRoom;
        this.$focusedRoom = r;
        if (oldFocus)
            this.DrawRoom(this.$mapContext, oldFocus, true);
        if (r)
            this.DrawRoom(this.$mapContext, r, true, r.at(this.$mouse.rx, this.$mouse.ry));
    }

    private ClearPrevMouse() {
        const p = this.getRoom(this.$mousePrevious.rx, this.$mousePrevious.ry);
        if (p) this.DrawRoom(this.$mapContext, p, true);
        if (this.$mouseSelect)
            this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mousePrevious.x - this.$mouseDown.x, this.$mousePrevious.y - this.$mouseDown.y);
    }

    private parseRoomCode(r, code) {
        if (typeof (r) === 'undefined')
            r = new Room(-1, -1, -1);
        if (!code || code.length === 0)
            return r;
        let idx = 0;
        let idx2;
        const len = code.length;
        let state = 0;
        let start = 1;
        let ident = '';
        let c;
        let i;
        let b = 0;
        let b2;
        let quote = false;
        let block;
        r.smell = '';
        r.sound = '';
        r.long = '';
        r.exits = 0;
        r.terrain = '';
        r.item = -1;
        r.flags = 0;
        let exit;
        let exits;
        for (; idx < len; idx++) {
            c = code.charAt(idx);
            i = code.charCodeAt(idx);
            switch (state) {
                case 1:
                    if (b === 1 && c === '}') {
                        state = 0;
                        b = 0;
                        ident = '';
                    }
                    else if (c === '}') {
                        b--;
                        ident = '';
                    }
                    else if (c === '{') {
                        b++;
                        ident = '';
                    }
                    else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_') {
                        ident += c;
                    }
                    else if (ident.length > 0) {
                        switch (ident) {
                            case 'set_short':
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                if (code.charAt(idx) === '(')
                                    idx++;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                if (code.charAt(idx2 - 1) === ')')
                                    r.short = this.parseString(code.substring(idx, idx2 - 1).trim());
                                else
                                    r.short = this.parseString(code.substring(idx, idx2).trim());
                                idx = idx2;
                                break;
                            case 'set_long':
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                if (code.charAt(idx) === '(')
                                    idx++;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                if (code.charAt(idx2 - 1) === ')')
                                    r.long = this.parseString(code.substring(idx, idx2 - 1).trim());
                                else
                                    r.long = this.parseString(code.substring(idx, idx2).trim());
                                idx = idx2;
                                break;
                            case 'add_exit':
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                exit = code.substring(idx, idx2 - 1).trim().splitQuote(',', 3, 3);
                                if (exit.length > 0) {
                                    switch (this.parseString(exit[0])) {
                                        case 'north':
                                            r.exits |= RoomExit.North;
                                            break;
                                        case 'northeast':
                                            r.exits |= RoomExit.NorthEast;
                                            break;
                                        case 'east':
                                            r.exits |= RoomExit.East;
                                            break;
                                        case 'southeast':
                                            r.exits |= RoomExit.SouthEast;
                                            break;
                                        case 'south':
                                            r.exits |= RoomExit.South;
                                            break;
                                        case 'southwest':
                                            r.exits |= RoomExit.SouthWest;
                                            break;
                                        case 'west':
                                            r.exits |= RoomExit.West;
                                            break;
                                        case 'northwest':
                                            r.exits |= RoomExit.NorthWest;
                                            break;
                                        case 'up':
                                            r.exits |= RoomExit.Up;
                                            break;
                                        case 'down':
                                            r.exits |= RoomExit.Down;
                                            break;
                                        case 'out':
                                            r.exits |= RoomExit.Out;
                                            break;
                                        case 'enter':
                                            r.exits |= RoomExit.Enter;
                                            break;
                                        default:
                                            r.exits |= RoomExit.Unknown;
                                            break;
                                    }
                                }
                                idx = idx2;
                                break;
                            case 'set_exits':
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                exits = this.parseMapping(code.substring(idx, idx2 - 1).trim());
                                for (exit in exits) {
                                    if (exit.length === 0 || !exits.hasOwnProperty(exit)) continue;
                                    switch (exit) {
                                        case 'north':
                                            r.exits |= RoomExit.North;
                                            break;
                                        case 'northeast':
                                            r.exits |= RoomExit.NorthEast;
                                            break;
                                        case 'east':
                                            r.exits |= RoomExit.East;
                                            break;
                                        case 'southeast':
                                            r.exits |= RoomExit.SouthEast;
                                            break;
                                        case 'south':
                                            r.exits |= RoomExit.South;
                                            break;
                                        case 'southwest':
                                            r.exits |= RoomExit.SouthWest;
                                            break;
                                        case 'west':
                                            r.exits |= RoomExit.West;
                                            break;
                                        case 'northwest':
                                            r.exits |= RoomExit.NorthWest;
                                            break;
                                        case 'up':
                                            r.exits |= RoomExit.Up;
                                            break;
                                        case 'down':
                                            r.exits |= RoomExit.Down;
                                            break;
                                        case 'out':
                                            r.exits |= RoomExit.Out;
                                            break;
                                        case 'enter':
                                            r.exits |= RoomExit.Enter;
                                            break;
                                        default:
                                            r.exits |= RoomExit.Unknown;
                                            break;
                                    }
                                }
                                idx = idx2;
                                break;
                            case 'add_climb':
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                c = code.charAt(idx);
                                if (c === '"') {
                                    //idx++;
                                    for (idx2 = idx; idx2 < len; idx2++) {
                                        c = code.charAt(idx2);
                                        if (c === '"') {
                                            if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                                continue;
                                            quote = !quote;
                                        }
                                        if (!quote && c === ',')
                                            break;
                                    }
                                    block = this.parseString(code.substring(idx, idx2));
                                    idx = idx2 + 1;
                                    switch (block) {
                                        case 'up':
                                            r.climbs |= RoomExit.Up;
                                            break;
                                        case 'down':
                                            r.climbs |= RoomExit.Down;
                                            break;
                                    }
                                    for (idx2 = idx; idx2 < len; idx2++) {
                                        c = code.charAt(idx2);
                                        if (c === '"') {
                                            if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                                continue;
                                            quote = !quote;
                                        }
                                        if (!quote && c === ';')
                                            break;
                                    }
                                    idx = idx2;
                                }
                                break;
                            case 'set_terrain':
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                if (code.charAt(idx) === '(')
                                    idx++;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                r.terrain = this.parseString(code.substring(idx, idx2 - 1).trim());
                                idx = idx2;
                                break;
                            case 'set_listen':
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                b2 = 0;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ',') {
                                        b2 = 1;
                                        break;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                block = code.substring(idx, idx2).trim();
                                idx = idx2 + 1;
                                if (b2) {
                                    block = this.parseString(block);
                                    for (idx2 = idx; idx2 < len; idx2++) {
                                        c = code.charAt(idx2);
                                        if (c === '"') {
                                            if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                                continue;
                                            quote = !quote;
                                        }
                                        if (!quote && c === ';')
                                            break;
                                    }
                                    if (block === 'default')
                                        r.sound = this.parseString(code.substring(idx, idx2 - 1).trim());
                                }
                                else {
                                    if (block.startsWith('"'))
                                        r.sound = this.parseString(block);
                                    else if (block.startsWith('(:'))
                                        r.sound = 'Function: ' + block.slice(0, -1);
                                    else if (block.startsWith('([')) {
                                        const sounds = this.parseMapping(block);
                                        let sound;
                                        for (sound in sounds) {
                                            if (sound.length === 0 || !sounds.hasOwnProperty(sound)) continue;
                                            if (sound === 'default') {
                                                r.sound = sound;
                                                break;
                                            }
                                        }
                                    }
                                }
                                idx = idx2;
                                break;
                            case 'set_smell':
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                b2 = 0;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ',') {
                                        b2 = 1;
                                        break;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                block = code.substring(idx, idx2).trim();
                                idx = idx2 + 1;
                                if (b2) {
                                    block = this.parseString(block);
                                    for (idx2 = idx; idx2 < len; idx2++) {
                                        c = code.charAt(idx2);
                                        if (c === '"') {
                                            if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                                continue;
                                            quote = !quote;
                                        }
                                        if (!quote && c === ';')
                                            break;
                                    }
                                    if (block === 'default')
                                        r.smell = this.parseString(code.substring(idx, idx2 - 1).trim());
                                    idx = idx2;
                                }
                                else {
                                    if (block.startsWith('"'))
                                        r.smell = this.parseString(block);
                                    else if (block.startsWith('(:'))
                                        r.smell = 'Function: ' + block.slice(0, -1);
                                    else if (block.startsWith('([')) {
                                        const smells = this.parseMapping(block);
                                        let smell;
                                        for (smell in smells) {
                                            if (smell.length === 0 || !smells.hasOwnProperty(smell)) continue;
                                            if (smell === 'default') {
                                                r.smell = smell;
                                                break;
                                            }
                                        }
                                    }
                                    idx = idx2;
                                }
                                break;
                            case 'add_items':
                            case 'set_items':
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                block = code.substring(idx, idx2 - 1).trim();
                                const items = this.parseMapping(block);
                                if (!r.items) r.items = [];
                                let item;
                                for (item in items) {
                                    if (item.length === 0 || !items.hasOwnProperty(item)) continue;
                                    if (item.startsWith('({') && item.endsWith('})')) {
                                        const k = item.slice(2, -2).splitQuote(',', 3, 3);
                                        let s;
                                        const sl = k.length;
                                        for (s = 0; s < sl; s++)
                                            r.items.push({
                                                item: this.parseString(k[s].trim()),
                                                description: this.parseString(items[item].trim())
                                            });
                                    }
                                    else
                                        r.items.push({
                                            item: this.parseString(item),
                                            description: this.parseString(items[item].trim())
                                        });
                                }
                                break;
                            case 'set_property':
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                exit = code.substring(idx, idx2 - 1).trim().splitQuote(',', 3, 3);
                                if (this.parseString(exit[0]) === 'light')
                                    r.light = + +this.parseString(exit[1]);
                                idx = idx2;
                                break;
                            case 'set_properties':
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                for (idx2 = idx; idx2 < len; idx2++) {
                                    c = code.charAt(idx2);
                                    if (c === '"') {
                                        if (idx2 > 0 && code.charAt(idx2 - 1) === '\\')
                                            continue;
                                        quote = !quote;
                                    }
                                    if (!quote && c === ';')
                                        break;
                                }
                                exits = this.parseMapping(code.substring(idx, idx2 - 1).trim());
                                for (exit in exits) {
                                    if (exit.length === 0 || !exits.hasOwnProperty(exit)) continue;
                                    if (exit === 'light') {
                                        r.light = +exits[exit];
                                        break;
                                    }
                                }
                                idx = idx2;
                                break;
                        }
                        ident = '';
                    }
                    else
                        ident = '';
                    break;
                default:
                    switch (c) {
                        case '\n':
                            start = 1;
                            ident = '';
                            break;
                        default:
                            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === ' ')
                                ident += c;
                            else if (start && (ident === 'void create' || ident === 'varargs void create')) {
                                state = 1;
                                ident = '';
                            }
                            else {
                                start = 0;
                                ident = '';
                            }
                            break;
                    }
                    break;
            }
        }
        return r;
    }

    private parseString(str) {
        if (!str || str.length === 0)
            return str;
        const end = str.length;
        if (str.startsWith('(:'))
            return 'Function: ' + str;
        if (str.startsWith('(['))
            return 'Mapping: ' + str;
        if (str.startsWith('({'))
            return 'Array: ' + str;
        const sb = [];
        let save = true;
        let c;
        for (let idx = 0; idx < end; idx++) {
            c = str.charAt(idx);
            switch (c) {
                case '\\': //escaped;
                    idx++;
                    if (idx >= end) break;
                    sb.push(c);
                    break;
                case '"':
                    if (!save) {
                        idx++;
                        while (idx < end && str.charAt(idx) !== '"')
                            idx++;
                        save = true;
                    }
                    save = false;
                    break;
                default:
                    sb.push(c);
                    break;
            }
        }

        return sb.join('');
    }

    private parseMapping(str) {
        if (!str || str.length === 0)
            return {};
        if (!str.startsWith('(['))
            return {};
        if (!str.endsWith('])'))
            return {};

        str = str.slice(2, -2).trim();
        let idx = 0;
        let pIdx = 0;
        const end = str.length;
        const m = {};
        let array = 0;
        let pair;
        let c;
        for (; idx < end; idx++) {
            c = str.charAt(idx);
            switch (c) {
                case '/':
                    if (idx + 1 < end && str.charAt(idx + 1) === '/') {
                        if (pIdx < idx) {
                            pair = this.parseKeyPair(str.substring(pIdx, idx).trim());
                            m[pair[0]] = pair[1];
                        }
                        while (idx < end) {
                            c = str.charAt(idx);
                            if (c === '\n')
                                break;
                            idx++;
                            pIdx = idx;
                        }
                    }
                    else if (idx + 1 < end && str.charAt(idx + 1) === '*') {
                        if (pIdx < idx) {
                            pair = this.parseKeyPair(str.substring(pIdx, idx).trim());
                            m[pair[0]] = pair[1];
                        }
                        while (idx < end) {
                            c = str.charAt(idx);
                            if (idx + 1 < end && c === '*' && str.charAt(idx + 1) === '/') {
                                break;
                            }
                            idx++;
                            pIdx = idx;
                        }
                    }
                    break;
                case '(':
                    array++;
                    break;
                case '"':
                    idx++;
                    while (idx < end) {
                        c = str.charAt(idx);
                        if (str === '\\')
                            idx++;
                        else if (c === '"')
                            break;
                        idx++;
                    }
                    break;
                case ')':
                    array--;
                    break;
                case ',':
                    if (array > 0) {
                        idx++;
                        continue;
                    }
                    pair = this.parseKeyPair(str.substring(pIdx, idx).trim());
                    m[pair[0]] = pair[1];
                    pIdx = idx + 1;
                    break;
            }
        }
        if (pIdx < idx) {
            pair = this.parseKeyPair(str.substring(pIdx, idx).trim());
            m[pair[0]] = pair[1];
        }
        return m || {};

    }

    private parseKeyPair(str) {
        if (!str || str.length === 0)
            return ['', ''];
        const pair = ['', ''];
        let c;
        let idx = 0;
        const end = str.length;
        let array;
        for (; idx < end; idx++) {
            c = str.charAt(idx);
            switch (c) {
                case '(':
                    array++;
                    break;
                case ')':
                    idx++;
                    pair[0] = str.substring(0, idx).trim();
                    idx++;
                    pair[1] = str.substring(idx).trim();
                    return pair;
                case '"':
                    idx++;
                    while (idx < end) {
                        c = str.charAt(idx);
                        if (str === '\\')
                            idx++;
                        else if (c === '"')
                            break;
                        idx++;
                    }
                    break;
                case ':':
                    if (array > 0) continue;
                    pair[0] = this.parseString(str.substring(0, idx).trim());
                    idx++;
                    pair[1] = str.substring(idx).trim();
                    return pair;
            }
        }
        pair[0] = str;
        return pair;
    }

    private RoomChanged(room, old?, silentUpdate?) {
        if (old) {
            if (room.equals(old))
                return;
            if (old.exits) this.$roomCount--;
            if (room.exits) this.$roomCount++;
            this.doUpdate(UpdateType.status);
        }
        this.changed = true;
        if (!silentUpdate) {
            if (this.$selectedRooms.indexOf(room) !== -1)
                this.UpdateEditor(this.$selectedRooms);
            this.UpdatePreview(room);
        }
    }

    private roomsChanged() {
        //store room lengths
        const zl = this.$area.size.depth;
        const xl = this.$area.size.width;
        const yl = this.$area.size.height;
        this.$roomCount = 0;

        for (let z = 0; z < zl; z++) {
            for (let y = 0; y < yl; y++) {
                for (let x = 0; x < xl; x++) {
                    const room = this.$area.rooms[z][y][x];
                    if (room.exits) this.$roomCount++;
                }
            }
        }
        this.changed = true;
        this.doUpdate(UpdateType.status);
    }

    private UpdateEditor(rooms) {
        if (this.selectedFocusedRoom)
            this.$depthToolbar.value = '' + this.selectedFocusedRoom.z;
        const objects = [];
        let type;
        if (rooms && rooms.length) {
            type = rooms[0].type || 'base';
            let rl = rooms.length;
            const ri = [];
            const re = {};
            while (rl--) {
                const o = rooms[rl].clone();
                o.exitsDetails = Object.values(o.exitsDetails);
                ['items', 'exitsDetails', 'sounds', 'smells', 'objects', 'monsters', 'searches'].forEach(v => {
                    if (o[v].length === 0)
                        o[v] = ri;
                });
                objects.unshift(o);
            }
        }
        else
            type = this.$area.defaultRoom || 'base';
        this.$roomEditor.defaults = this.$area.baseRooms[type] ? this.$area.baseRooms[type].clone() : new Room(0, 0, 0);
        this.$roomEditor.defaults.type = 'base';
        this.$roomEditor.defaults.exitsDetails = Object.values(this.$roomEditor.defaults.exitsDetails);
        this.$roomEditor.objects = objects;
    }

    private UpdatePreview(room) {
        let ex;
        let e;
        let item;
        let items;
        let str;
        let c;
        let cl;
        let exit;
        if (!room) {
            this.$roomPreview.short.textContent = '';
            this.$roomPreview.long.textContent = '';
            this.$roomPreview.smell.textContent = '';
            this.$roomPreview.sound.textContent = '';
            this.$roomPreview.exits.textContent = '';
            this.$roomPreview.living.textContent = '';
            this.$roomPreview.objects.textContent = '';
        }
        else {
            this.$roomPreview.short.textContent = room.short;
            this.$roomPreview.long.textContent = room.long;
            str = this.$roomPreview.long.innerHTML;

            items = room.items;
            if (items.length > 0) {
                items = items[room.item].children.slice().sort((a, b) => { return b.item.length - a.item.length; });
                for (c = 0, cl = items.length; c < cl; c++)
                    str = str.replace(new RegExp('\\b(' + items[c].item + ')\\b', 'gi'), '<span class="room-item" id="' + this.parent.id + '-room-preview' + c + '" title="">' + items[c].item + '</span>');
            }
            else
                items = null;
            str += '<br><br>';
            this.$roomPreview.long.innerHTML = pinkfishToHTML(str);
            if (items && items.length > 0) {
                for (c = 0, cl = items.length; c < cl; c++) {
                    item = document.getElementById(this.parent.id + '-room-preview' + c);
                    if (item)
                        item.title = items[c].description;
                }
            }
            if (room.smell.length > 0 && room.sound.length > 0) {
                this.$roomPreview.sound.style.display = 'block';
                this.$roomPreview.smell.style.display = 'block';
                this.$roomPreview.smell.textContent = room.smell;
                this.$roomPreview.sound.textContent = room.sound;
                this.$roomPreview.sound.appendChild(document.createElement('br'));
                this.$roomPreview.sound.appendChild(document.createElement('br'));
            }
            else if (room.smell.length > 0) {
                this.$roomPreview.sound.style.display = 'none';
                this.$roomPreview.smell.style.display = 'block';
                this.$roomPreview.smell.textContent = room.smell;
                this.$roomPreview.sound.textContent = '';
                this.$roomPreview.smell.appendChild(document.createElement('br'));
                this.$roomPreview.smell.appendChild(document.createElement('br'));
            }
            else if (room.sound.length > 0) {
                this.$roomPreview.smell.style.display = 'none';
                this.$roomPreview.sound.style.display = 'block';
                this.$roomPreview.sound.textContent = room.sound;
                this.$roomPreview.sound.appendChild(document.createElement('br'));
                this.$roomPreview.sound.appendChild(document.createElement('br'));
            }
            else {
                this.$roomPreview.smell.style.display = 'none';
                this.$roomPreview.sound.style.display = 'none';
            }
            e = room.exits | room.external;
            if (e === RoomExit.None)
                this.$roomPreview.exits.textContent = 'There are no obvious exits.';
            else {
                ex = [];
                for (exit in RoomExits) {
                    if (!RoomExits.hasOwnProperty(exit)) continue;
                    if (!RoomExits[exit]) continue;
                    if ((e & RoomExits[exit]) === RoomExits[exit])
                        ex.push(exit);
                }
                if (ex.length === 1)
                    this.$roomPreview.exits.textContent = 'There is one obvious exit: ' + ex[0];
                else {
                    str = 'There are ' + Cardinal(ex.length) + ' obvious exits: ';
                    str += ex.slice(0, -1).join(', ');
                    str += ' and ' + ex.pop();
                    this.$roomPreview.exits.textContent = str;
                }
            }
            if (this.$area.monsters.length > 0) {
                this.$roomPreview.living.style.display = '';
                this.$roomPreview.living.innerHTML = '<br>' + room.monsters.map(v => stripPinkfish(capitalize(consolidate(v.amount, this.$area.monsters[v.id].short)))).join('<br>');
            }
            else
                this.$roomPreview.living.style.display = 'none';
            if (this.$area.objects.length > 0) {
                this.$roomPreview.objects.style.display = '';
                this.$roomPreview.living.innerHTML = '<br>' + room.objects.map(v => pinkfishToHTML(capitalize(consolidate(v.amount, this.$area.objects[v.id].short)))).join(', ');
            }
            else
                this.$roomPreview.objects.style.display = 'none';
        }
    }

    private BuildMap() {
        Timer.start();
        const zl = this.$area.size.depth;
        const xl = this.$area.size.width;
        const yl = this.$area.size.height;
        this.$roomCount = 0;
        for (let z = 0; z < zl; z++) {
            for (let y = 0; y < yl; y++) {
                for (let x = 0; x < xl; x++) {
                    const room = this.$area.rooms[z][y][x];
                    if (room.exits) this.$roomCount++;
                }
            }
        }
        if (this.$depth >= this.$area.size.depth)
            this.$depth = this.$area.size.depth - 1;
        if (this.$area.size.right !== this.$map.width || this.$map.height !== this.$area.size.bottom) {
            this.$map.width = this.$area.size.right;
            this.$map.height = this.$area.size.bottom;
            this.BuildAxises();
            this.DrawMap();
            setTimeout(() => {
                this.DrawMap();
            }, 500);
        }
        else
            this.doUpdate(UpdateType.drawMap);
        this.loadTypes();
        this.updateBaseRooms();
        this.updateBaseMonsters();
        this.updateMonsters();
        this.emit('rebuild-buttons');
        Timer.end('BuildMap time');
    }

    private updateBaseRooms() {
        this.$propertiesEditor.roomGrid.rows = Object.keys(this.$area.baseRooms).map(r => {
            return {
                name: r,
                monsters: this.$area.baseRooms[r].monsters,
                objects: this.$area.baseRooms[r].objects,
                room: this.$area.baseRooms[r]
            };
        });
    }

    private updateBaseMonsters() {
        this.$propertiesEditor.monsterGrid.rows = Object.keys(this.$area.baseMonsters).map(r => {
            return {
                name: r,
                maxAmount: this.$area.baseMonsters[r].maxAmount,
                objects: this.$area.baseMonsters[r].objects,
                monster: this.$area.baseMonsters[r]
            };
        });
    }

    private updateMonsters() {
        this.$monsterGrid.rows = Object.keys(this.$area.monsters).map(m => {
            return {
                id: m,
                name: this.$area.monsters[m].name,
                short: this.$area.monsters[m].short,
                maxAmount: this.$area.monsters[m].maxAmount,
                unique: this.$area.monsters[m].unique,
                objects: this.$area.monsters[m].objects,
                monster: this.$area.monsters[m]
            };
        });
    }

    private updateObjects() {
        this.$objectGrid.rows = Object.keys(this.$area.objects).map(m => {
            return {
                id: m,
                name: this.$area.objects[m].name,
                short: this.$area.objects[m].short,
                type: this.$area.objects[m].type,
                object: this.$area.objects[m]
            };
        });
    }

    private BuildAxises() {
        while (this.$xAxis.firstChild)
            this.$xAxis.removeChild(this.$xAxis.firstChild);
        while (this.$yAxis.firstChild)
            this.$yAxis.removeChild(this.$yAxis.firstChild);
        this.$xAxis.style.width = this.$area.size.right + 'px';
        this.$yAxis.style.height = this.$area.size.bottom + 'px';
        let frag = document.createDocumentFragment();
        let el: HTMLElement;
        this.$xAxisHighlight.style.height = '100%';
        this.$yAxisHighlight.style.width = '100%';
        let x;
        const xl = this.$area.size.width;
        for (x = 0; x < xl; x++) {
            el = document.createElement('div');
            el.dataset.x = '' + x;
            el.textContent = '' + x;
            el.addEventListener('mouseover', (e) => {
                if (this.$focused)
                    this.$xAxisHighlight.style.backgroundColor = 'rgba(135, 206, 250, 0.25)';
                else
                    this.$xAxisHighlight.style.backgroundColor = 'rgba(221, 221, 221, 0.25)';
                this.$xAxisHighlight.style.display = 'block';
                this.$xAxisHighlight.style.left = ((+(<HTMLElement>e.currentTarget).dataset.x) * 32) + 'px';
                this.$xAxisHighlight.style.top = this.$mapContainer.scrollTop + 'px';
            });
            el.addEventListener('mouseout', (e) => {
                this.$xAxisHighlight.style.display = '';
                this.$xAxisHighlight.style.top = '0';
            });
            frag.appendChild(el);
        }
        this.$xAxis.appendChild(frag);
        frag = document.createDocumentFragment();
        let y;
        const yl = this.$area.size.height;
        for (y = 0; y < yl; y++) {
            el = document.createElement('div');
            el.dataset.y = '' + y;
            el.textContent = '' + y;
            el.addEventListener('mouseover', (e) => {
                if (this.$focused)
                    this.$yAxisHighlight.style.backgroundColor = 'rgba(135, 206, 250, 0.25)';
                else
                    this.$yAxisHighlight.style.backgroundColor = 'rgba(221, 221, 221, 0.25)';
                this.$yAxisHighlight.style.display = 'block';
                this.$yAxisHighlight.style.top = ((+(<HTMLElement>e.currentTarget).dataset.y) * 32) + 'px';
                this.$yAxisHighlight.style.left = this.$mapContainer.scrollLeft + 'px';
            });
            el.addEventListener('mouseout', (e) => {
                this.$yAxisHighlight.style.display = '';
                this.$yAxisHighlight.style.left = '0';
            });
            frag.appendChild(el);
        }
        this.$yAxis.appendChild(frag);
    }

    public openItems() {
        this.$roomEditor.beginEdit('items', true);
    }

    public openExits() {
        this.$roomEditor.beginEdit('exitsDetails', true);
    }

    public openMonsters() {
        this.$roomEditor.beginEdit('monsters', true);
    }

    public openObjects() {
        this.$roomEditor.beginEdit('objects', true);
    }

    public externalCode(r?, y?, z?) {
        if (typeof r === 'number')
            r = this.getRoom(r, y, z);
        else if (Array.isArray(r)) {
            if (r.length >= 3)
                r = this.getRoom(r[0], r[1], r[2]);
            else if (r.length === 2)
                r = this.getRoom(r[0], r[1]);
            else //not enough data
                return '';
        }
        else if (!r)
            r = this.selectedFocusedRoom;
        //no room return empty string
        if (!r)
            return '';
        let t;
        let d;
        if (this.$area.size.depth > 1)
            d = '/**\n * External virtual room ' + r.x + ', ' + r.y + ', ' + r.z + '\n * \n * An external room for virtual area\n * \n * @author {your name}\n * @created {date}\n * @typeof include\n * @doc /doc/build/virtual/generic_virtual\n * @doc /doc/build/room/Basic\n */\n';
        else
            d = '/**\n * External virtual room ' + r.x + ', ' + r.y + '\n * \n * An external room for virtual area\n * \n * @author {your name}\n * @created {date}\n * @typeof include\n * @doc /doc/build/virtual/generic_virtual\n * @doc /doc/build/room/Basic\n */\n';
        d += '#include <std.h>\n#include "../area.h"\n\ninherit (VIR + "baseroom.c");\n\n/**\n * Create\n *\n * Create the base virtual room, passing correct parameters to baseroom\n */\nvoid create()\n{\n   ::create(' + r.x + ', ' + r.y + ', ' + r.z + ', ' + r.terrain + ', ' + r.item + ', ' + r.exits + ');\n';

        t = [];
        if (r.light !== 0)
            t.push(`"light" : ${r.light}`);
        if ((r.state & RoomFlags.No_Attack) === RoomFlags.No_Attack)
            t.push('"no attack" : 1');
        if ((r.state & RoomFlags.No_Magic) === RoomFlags.No_Magic)
            t.push('"no magic" : 1');
        if ((r.state & RoomFlags.Council) === RoomFlags.Council)
            t.push('"council" : 1');
        if ((r.state & RoomFlags.Indoors) === RoomFlags.Indoors)
            t.push('"indoors" : 1');
        if (t.length > 0) {
            d += '   set_properties( ([\n       ';
            d += t.join(',\n       ');
            d += '\n     ]) );\n';
        }
        d += '   set_short("' + r.short + '");\n';
        d += '   set_long("';
        if (r.long.length > 70) {
            t = r.long.substr(0, 66);
            let tl = t.length;
            while (tl--) {
                if (t.charAt(tl) === ' ') {
                    t.substr(0, tl);
                    break;
                }
            }
            d += `"${t}"\n     `;
            d += formatString(r.long.substr(t.length), 5, 73);
        }
        else
            d += r.long + '");\n';
        if (r.terrain.length > 0)
            d += '   set_terrain("' + r.terrain + '");\n';
        else if ((r.state & RoomFlags.Water) === RoomFlags.Water)
            d += '   set_terrain("water");\n';

        if (r.items.length > 0) {
            d += '   set_items( ([\n       ';
            d += r.items.map(i => {
                return `"${i.item}" : "${i.description}"`;
            });
            d += '\n     ]) );\n';
        }
        if (r.smell.length > 0)
            d += '   set_smell("' + r.smell + '");\n';
        if (r.sound.length > 0)
            d += '   set_listen("' + r.sound + '");\n';

        if (RoomExit.None !== r.exits) {
            d += '   set_exits( ([\n';
            if (this.$area.size.depth > 1) {
                if ((r.exits & RoomExit.Up) === RoomExit.Up)
                    d += '       "up" : VIR + "' + (r.x) + ',' + (r.y) + ',' + (r.z + 1) + '.c",\n';
                if ((r.exits & RoomExit.Down) === RoomExit.Down)
                    d += '       "down" : VIR + "' + (r.x) + ',' + (r.y) + ',' + (r.z - 1) + '.c",\n';
                t = ',' + r.z;
            }
            else
                t = '';
            if ((r.exits & RoomExit.North) === RoomExit.North)
                d += '       "north" : VIR + "' + (r.x) + ',' + (r.y - 1) + t + '.c",\n';
            if ((r.exits & RoomExit.NorthWest) === RoomExit.NorthWest)
                d += '       "northwest" : VIR + "' + (r.x - 1) + ',' + (r.y - 1) + t + '.c",\n';
            if ((r.exits & RoomExit.NorthEast) === RoomExit.NorthEast)
                d += '       "northeast" : VIR + "' + (r.x + 1) + ',' + (r.y - 1) + t + '.c",\n';
            if ((r.exits & RoomExit.East) === RoomExit.East)
                d += '       "east" : VIR + "' + (r.x + 1) + ',' + (r.y) + t + '.c",\n';
            if ((r.exits & RoomExit.West) === RoomExit.West)
                d += '       "west" : VIR + "' + (r.x - 1) + ',' + (r.y) + t + '.c",\n';
            if ((r.exits & RoomExit.South) === RoomExit.South)
                d += '       "south" : VIR + "' + (r.x) + ',' + (r.y + 1) + t + '.c",\n';
            if ((r.exits & RoomExit.SouthEast) === RoomExit.SouthEast)
                d += '       "southeast" : VIR + "' + (r.x + 1) + ',' + (r.y + 1) + t + '.c",\n';
            if ((r.exits & RoomExit.SouthWest) === RoomExit.SouthWest)
                d += '       "southwest" : VIR + "' + (r.x - 1) + ',' + (r.y + 1) + t + '.c",\n';
            let ri;
            const re = Object.keys(r.external);
            const rl = re.length;
            for (ri = 0; ri < rl; ri++) {
                if (!r.external[re[ri]].enabled)
                    continue;
                d += '       "' + r.external[re[ri]].exit + '":"' + r.external[re[ri]].dest + '",\n';
            }
            d += '     ]) );\n';
        }
        if ((r.state & RoomFlags.Cold) === RoomFlags.Cold)
            d += '   set_temperature(-200);\n';
        else if ((r.state & RoomFlags.Hot) === RoomFlags.Hot)
            d += '   set_temperature(200);\n';
        if ((r.state & RoomFlags.Sinking_Up) === RoomFlags.Sinking_Up || (r.state & RoomFlags.Sinking_Down) === RoomFlags.Sinking_Down)
            d += '   set_living_sink(1);\n';
        if ((r.state & RoomFlags.Sinking_Up) === RoomFlags.Sinking_Up && r.z + 1 < this.$area.size.depth)
            d += `   set_up(VIR+"${r.x},${r.y},${r.z + 1}");\n`;
        if ((r.state & RoomFlags.Sinking_Down) === RoomFlags.Sinking_Down && r.z > 0 && this.$area.size.depth > 1)
            d += `   set_down(VIR+"${r.x},${r.y},${r.z - 1}");\n`;
        d += '}';
        return d;
    }

    public generateCode(p) {
        if (!p) return;
    }

    public generateRoomCode(room) {
        if (!room) return '';
        return '';
    }

    public generateMonsterCode(monster) {
        if (!monster) return '';
        return '';
    }

    public generateObjectCode(obj) {
        if (!obj) return '';
        return '';
    }

    public resizeMap(width, height, depth, shift: shiftType, noUndo?) {
        Timer.start();
        width = width || 0;
        height = height || 0;
        depth = depth || 0;
        const zl = this.$area.size.depth;
        const xl = this.$area.size.width;
        const yl = this.$area.size.height;
        this.$area.size.width += width;
        this.$area.size.height += height;
        this.$area.size.depth += depth;
        const zl2 = this.$area.size.depth;
        const xl2 = this.$area.size.width;
        const yl2 = this.$area.size.height;
        const rooms = Array.from(Array(this.$area.size.depth),
            (v, z) => Array.from(Array(this.$area.size.height),
                (v2, y) => Array.from(Array(this.$area.size.width),
                    (v3, x) => new Room(x, y, z, this.$area.baseRooms[this.$area.defaultRoom], this.$area.defaultRoom))
            ));

        this.$roomCount = 0;
        for (let z = 0; z < zl; z++) {
            for (let y = 0; y < yl; y++) {
                for (let x = 0; x < xl; x++) {
                    const room = this.$area.rooms[z][y][x];
                    let idx;
                    if (!room) continue;
                    if ((shift & shiftType.right) === shiftType.right)
                        room.x += width;
                    else if ((shift & shiftType.left) !== shiftType.left)
                        room.x += Math.floor(width / 2);
                    if ((shift & shiftType.bottom) === shiftType.bottom)
                        room.y += height;
                    else if ((shift & shiftType.top) !== shiftType.top)
                        room.y += Math.floor(height / 2);
                    if ((shift & shiftType.up) === shiftType.up)
                        room.z += depth;
                    else if ((shift & shiftType.down) !== shiftType.down)
                        room.z += Math.floor(depth / 2);
                    if (room.z >= 0 && room.z < zl2 && room.x >= 0 && room.x < xl2 && room.y >= 0 && room.y < yl2) {
                        rooms[room.z][room.y][room.x] = room;
                        idx = this.$selectedRooms.indexOf(this.$area.rooms[z][y][x]);
                        if (idx !== -1)
                            this.$selectedRooms[idx] = rooms[room.z][room.y][room.x];
                        if (this.$focusedRoom && this.$focusedRoom.at(x, y, z))
                            this.$focusedRoom = rooms[room.z][room.y][room.x];
                        if (room.exits) this.$roomCount++;
                    }
                    else {
                        if (room.exits) {
                            room.x = x;
                            room.y = y;
                            room.z = z;
                            this.deleteRoom(room, true);
                        }
                        idx = this.$selectedRooms.indexOf(this.$area.rooms[z][y][x]);
                        if (idx !== -1)
                            this.$selectedRooms.splice(idx, 1);
                        if (this.$focusedRoom && this.$focusedRoom.at(x, y, z))
                            this.$focusedRoom = null;
                    }
                }
            }
        }
        this.$area.rooms = rooms;
        this.UpdateEditor(this.$selectedRooms);
        this.UpdatePreview(this.selectedFocusedRoom);
        if (this.$depth >= this.$area.size.depth)
            this.$depth = this.$area.size.depth - 1;
        this.$map.width = this.$area.size.right;
        this.$map.height = this.$area.size.bottom;
        this.BuildAxises();
        if (this.$area.size.depth < 2) {
            this.$depth = 0;
            this.$roomEditor.setPropertyOptions({
                property: 'z',
                group: 'Location',
                readonly: true,
                visible: false
            });
        }
        else {
            this.$depthToolbar.value = '' + this.$depth;
            this.$depthToolbar.max = '' + (this.$area.size.depth - 1);
            this.$depthToolbar.min = '' + 0;
            this.$roomEditor.setPropertyOptions({
                property: 'z',
                group: 'Location',
                readonly: true,
                visible: true
            });
        }
        this.emit('rebuild-buttons');
        this.emit('resize-map');
        Timer.end('Resize time');
        this.doUpdate(UpdateType.drawMap);
        if (!noUndo)
            this.pushUndo(undoAction.edit, undoType.resize, { width: width, height: height, depth: depth, shift: shift });
    }

    private reverseShiftType(shift: shiftType) {
        let nShift = shiftType.none;
        if ((shift & shiftType.top) === shiftType.top)
            nShift |= shiftType.bottom;
        if ((shift & shiftType.bottom) === shiftType.bottom)
            nShift |= shiftType.top;
        if ((shift & shiftType.left) === shiftType.left)
            nShift |= shiftType.right;
        if ((shift & shiftType.right) === shiftType.right)
            nShift |= shiftType.left;
        if ((shift & shiftType.up) === shiftType.up)
            nShift |= shiftType.down;
        if ((shift & shiftType.down) === shiftType.down)
            nShift |= shiftType.up;
        return nShift;
    }

    private loadTypes() {
        this.$roomEditor.setPropertyOptions({
            property: 'type',
            formatter: this.formatType,
            group: 'Advanced',
            editor: {
                type: EditorType.select,
                options: {
                    data: Object.keys(this.$area.baseRooms || { base: null }).map(r => {
                        return {
                            value: r,
                            display: capitalize(r),
                            group: 'Area'
                        };
                    }).concat(...RoomTypes)
                }
            },
            sort: 0
        });
        if (this.$propertiesEditor.defaultRoom) {
            this.$propertiesEditor.defaultRoom.html('<optgroup label="Area">' + Object.keys(this.$area.baseRooms || { base: null })
                .map(r => `<option value="${r}">${capitalize(r)}</option>`).join('') + '</optgroup><optgroup label="Standard">' +
                RoomTypes.map(r => `<option value="${r.value}">${r.display}</option>`).join('') + '</optgroup>');
            this.$propertiesEditor.defaultRoom.val(this.$area.defaultRoom).selectpicker('render');
        }
        if (this.$propertiesEditor.defaultMonster) {
            this.$propertiesEditor.defaultMonster.html('<optgroup label="Area">' + Object.keys(this.$area.baseMonsters || { base: null })
                .map(r => `<option value="${r}">${capitalize(r)}</option>`).join('') + '</optgroup><optgroup label="Standard">' +
                MonsterTypes.map(r => `<option value="${r.value}">${r.display}</option>`).join('') + '</optgroup>');
            this.$propertiesEditor.defaultMonster.val(this.$area.defaultMonster).selectpicker('render');
        }
    }

}
