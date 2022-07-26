//spell-checker:ignore MONTYPE ROOMTYPE datagrid propertygrid dropdown polyfill MODROOM, SUBCLASSER LOCKPICK selectall waterbreathing
//spell-checker:ignore consolas lucida bitstream tabbable varargs crafter mgive blacksmithing glasssmithing stonemasonry doublewielding warhammer flamberge nodachi
//spell-checker:ignore nonetrackable bandedmail splintmail chainmail ringmail scalemail overclothing polearm tekagi shuko tekko bardiche katana wakizashi pilum warstaff
import { DebugTimer, EditorBase, EditorOptions, FileState } from './editor.base';
import { createFunction, formatFunctionPointer, formatArgumentList, formatMapping } from './lpc';
import { Splitter, Orientation } from '../splitter';
import { PropertyGrid } from '../propertygrid';
import { EditorType } from '../value.editors';
import { DataGrid } from '../datagrid';
import { copy, formatString, isFileSync, capitalize, Cardinal, pinkfishToHTML, stripPinkfish, consolidate, parseTemplate, initEditDropdown, capitalizePinkfish, stripQuotes } from '../library';
const { clipboard, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs-extra');
import { Wizard, WizardPage, WizardDataGridPage } from '../wizard';
import { MousePosition, RoomExits, shiftType, FileBrowseValueEditor, RoomExit, flipType } from './virtual.editor';

declare global {
    interface Window {
        $roomImg: HTMLImageElement;
        $roomImgLoaded: boolean;
    }
}

interface AreaDesignerOptions extends EditorOptions {
    width?: number;
    height?: number;
    depth?: number;
}

export enum RoomFlags {
    Underwater = 1 << 16,
    No_MGive = 1 << 15,
    Melee_As_Ability = 1 << 14,
    No_Dirt = 1 << 13,
    Enable_Pk = 1 << 12,
    No_Forage = 1 << 11,
    Hide_Exits = 1 << 10,
    No_Map_Send = 1 << 9,
    Explored = 1 << 8,
    No_Teleport = 1 << 7,
    No_Attack = 1 << 6,
    No_Magic = 1 << 5,
    Council = 1 << 4,
    No_Scry = 1 << 3,
    Indoors = 1 << 2,
    Sinking_Up = 1 << 1,
    Sinking_Down = 1 << 0,
    None = 0
}

enum RoomBaseFlags {
    Default = 0,
    No_Items = 1 << 0,
    No_Monsters = 1 << 1,
    No_Objects = 1 << 2,
    No_Forage_Objects = 1 << 3,
    No_Rummage_Objects = 1 << 4,
    No_Reads = 1 << 5
}

enum MonsterBaseFlags {
    Default = 0,
    No_Topics = 1 << 0,
    No_Objects = 1 << 1
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
    Auto_Stand = 1 << 7
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
    { value: 'MONTYPE_CRAFTER', display: 'Crafter', group: 'Standard' },
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
    { value: 'MONTYPE_SHIPWRIGHT', display: 'Shipwright', group: 'Standard' },
    { value: 'MONTYPE_TATTOOIST', display: 'Tattooist', group: 'Standard' },
    { value: 'MONTYPE_CMD_TRAIN_NPC', display: 'Trainer', group: 'Standard' },
    { value: 'MONTYPE_VENDOR', display: 'Vendor', group: 'Standard' },
    { value: 'MONTYPE_WEAPON_REPAIR', display: 'Weapon Repair', group: 'Standard' }
];

export enum UpdateType { none = 0, drawMap = 1, buildMap = 2, resize = 4, status = 8, flip = 16 }

interface ObjectInfo {
    id: number;
    minAmount?: number;
    maxAmount?: number;
    random?: number;
    unique?: boolean;
    action?: string;
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
    public closed: boolean = true;
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

interface MonsterReaction {
    type: string;
    reaction: string;
    action: string;
}

interface MonsterTopic {
    topic: string;
    message: string;
}

enum MonsterResponseType {
    say = 0, tell = 1, speak = 2, whisper = 3, custom = 4
}

interface MonsterReputation {
    type: number;
    group: string;
    amount: string;
}

interface Read {
    read: string;
    description: string;
    language: string;
}

export class Room {
    //readonly
    public x = 0;
    public y = 0;
    public z = 0;
    public external: RoomExit = 0;
    public climbs: RoomExit = 0;
    public exits: RoomExit = 0;
    public hidden: RoomExit = 0;

    //area designer
    public objects: ObjectInfo[] = [];
    public monsters: ObjectInfo[] = [];
    public subArea: string = '';
    public background: string = '';

    public type: string = 'base';
    public baseFlags: RoomBaseFlags = RoomBaseFlags.Default;

    //room wizard supports
    public forageObjects: ObjectInfo[] = [];
    public rummageObjects: ObjectInfo[] = [];
    public properties: Property[] = [];

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
    public reads: Read[] = [];

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

    public equals(room, base?) {
        if (!room) return false;
        let prop;
        for (prop in this) {
            if (!this.hasOwnProperty(prop)) continue;
            switch (prop) {
                case 'x':
                case 'y':
                case 'z':
                case 'type':
                    if (base) continue;
                    if (this[prop] !== room[prop])
                        return false;
                    break;
                case 'items':
                    if (this.items.length !== room.items.length)
                        return false;
                    if (this.items.filter((v, i) => room.items[i].item !== v.item && room.items[i].description !== v.description).length !== 0)
                        return false;
                    break;
                case 'reads':
                case 'rummageObjects':
                case 'forageObjects':
                case 'objects':
                case 'monsters':
                case 'sounds':
                case 'smells':
                case 'searches':
                case 'properties':
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

    public clear(data?, type?) {
        if (data)
            for (const prop in this) {
                if (prop === 'x' || prop === 'y' || prop === 'z' || !this.hasOwnProperty(prop)) continue;
                this[prop] = copy(data[prop]);
            }
        else {
            this.exits = data.exits || 0;
            this.exitsDetails = {};
            this.terrain = '';
            this.flags = RoomFlags.None;
            this.climbs = 0;
            this.hidden = 0;
            this.short = '';
            this.long = '';
            this.light = 0;
            this.nightAdjust = 0;
            this.sound = '';
            this.smell = '';
            this.subArea = '';
            this.forage = -1;
            this.maxForage = 0;
            this.secretExit = '';
            this.dirtType = '';
            this.preventPeer = '';
            this.external = 0;
            this.temperature = 0;
            this.notes = '';
            this.background = '';
        }
        this.type = type || 'base';
        this.sounds = [];
        this.smells = [];
        this.searches = [];
        this.items = [];
        this.objects = [];
        this.forageObjects = [];
        this.rummageObjects = [];
        this.monsters = [];
        this.reads = [];
        this.properties = [];
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
        //if (this.type !== 'base') return false;
        if (this.forage !== -1) return false;
        if (this.flags !== RoomFlags.None) return false;
        if (this.baseFlags !== RoomBaseFlags.Default) return false;
        for (const prop in this) {
            if (prop === 'baseFlags' || prop === 'x' || prop === 'y' || prop === 'z' || prop === 'type' || prop === 'forage' || prop === 'flags' || !this.hasOwnProperty(prop)) continue;
            const tp = typeof this[prop];
            const value = <any>this[prop];
            if (Array.isArray(this[prop]) && (<any>this[prop]).length !== 0)
                return false;
            if (tp === 'string' && value !== '')
                return false;
            if (tp === 'number' && value !== 0)
                return false;
        }
        return true;
    }

    public removeExit(exit) {
        this.exits &= ~exit;
        if (this.exitsDetails[RoomExit[exit].toLowerCase()]) {
            if (this.exitsDetails[RoomExit[exit].toLowerCase()].climb)
                this.climbs &= ~exit;
            if (this.exitsDetails[RoomExit[exit].toLowerCase()].dest.length > 0)
                this.external &= ~exit;
            if (this.exitsDetails[RoomExit[exit].toLowerCase()].hidden)
                this.hidden &= ~exit;
            delete this.exitsDetails[RoomExit[exit].toLowerCase()];
        }
    }

    public addExit(exit, details?) {
        this.exits |= exit;
        if (!this.exitsDetails[RoomExit[exit].toLowerCase()])
            this.exitsDetails[RoomExit[exit].toLowerCase()] = details || new Exit(RoomExit[exit].toLowerCase());
        if (this.exitsDetails[RoomExit[exit].toLowerCase()].climb)
            this.climbs |= exit;
        if (this.exitsDetails[RoomExit[exit].toLowerCase()].dest.length > 0)
            this.external |= exit;
        if (this.exitsDetails[RoomExit[exit].toLowerCase()].hidden)
            this.hidden |= exit;
    }

    public switchExits(exit1, exit2) {
        let e1 = this.exitsDetails[RoomExit[exit1].toLowerCase()];
        let e2 = this.exitsDetails[RoomExit[exit2].toLowerCase()];
        this.removeExit(exit1);
        this.removeExit(exit2);
        if (e1) {
            e1.exit = RoomExit[exit2].toLowerCase();
            this.addExit(exit2, e1);
        }
        if (e2) {
            e2.exit = RoomExit[exit1].toLowerCase();
            this.addExit(exit1, e2);
        }
    }
}

enum View {
    map,
    monsters,
    objects,
    properties
}

enum undoType { room, monster, object, roomsAll, settings, resize, area, properties, flip }
enum undoAction { add, delete, edit }

const Timer = new DebugTimer();

class Monster {
    public id: number;
    public maxAmount: number = -1;
    public unique: boolean = false;
    public objects: ObjectInfo[] = [];
    public baseFlags: MonsterBaseFlags = MonsterBaseFlags.Default;

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
    public reactions: MonsterReaction[] = [];
    public actions: string = '';

    public party: string = '';
    public tracking: boolean = false;
    public trackingMessage: string = '';
    public trackingType: string = '';
    public trackingAggressively: boolean = false;
    public askEnabled: boolean = false;
    public askNoTopic: string = '';
    public askResponseType: MonsterResponseType = MonsterResponseType.say;
    public askTopics: MonsterTopic[] = [];
    public properties: Property[] = [];

    public reputationGroup: string = '';
    public reputations: MonsterReputation[] = [];
    public emotes = [];
    public emotesChance = 0;
    public speechChance = 0;
    public emotesChanceCombat = 0;
    public speechChanceCombat = 0;

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

    public clear(data?, type?) {
        if (data)
            for (const prop in this) {
                if (prop === 'id' || !this.hasOwnProperty(prop)) continue;
                this[prop] = copy(data[prop]);
            }
        else {
            this.maxAmount = -1;
            this.unique = false;
            this.type = 'base';
            this.name = '';
            this.long = '';
            this.short = '';
            this.class = '';
            this.level = 1;
            this.race = '';
            this.alignment = '';
            this.language = '';
            this.flags = MonsterFlags.None;
            this.nouns = '';
            this.adjectives = '';
            this.mass = 0;
            this.height = 1;
            this.eyeColor = '';
            this.hairColor = '';
            this.gender = 'male';
            this.bodyType = '';
            this.noCorpse = '';
            this.noLimbs = '';
            this.speed = 0;
            this.patrolRoute = '';
            this.noWalkRooms = '';
            this.attackCommands = '';
            this.attackCommandChance = 33;
            this.attackInitiators = '';
            this.aggressive = '';
            this.autoDrop = { time: 1, enabled: false };
            this.openStorage = { time: 3, enabled: true };
            this.autoWield = { time: 3, enabled: true };
            this.autoLoot = { time: 1, enabled: false };
            this.autoWear = { time: 3, enabled: false };
            this.wimpy = 0;
            this.notes = '';
            this.actions = '';
            this.party = '';
            this.tracking = false;
            this.trackingMessage = '';
            this.trackingType = '';
            this.trackingAggressively = false;
            this.askEnabled = false;
            this.askNoTopic = '';
            this.askResponseType = MonsterResponseType.say;
            this.baseFlags = MonsterBaseFlags.Default;
            this.reputationGroup = '';
            this.emotesChance = 0;
            this.speechChance = 0;
            this.emotesChanceCombat = 0;
            this.speechChanceCombat = 0;
        }
        this.type = type || 'base';
        this.reactions = [];
        this.objects = [];
        this.askTopics = [];
        this.reputations = [];
        this.emotes = [];
        this.properties = [];
    }
}

export enum StdObjectType {
    object, chest, material, ore, weapon, armor, sheath, material_weapon, rope, instrument, food, drink, fishing_pole, backpack, bag_of_holding, armor_of_holding
}

interface Property {
    type: number;
    name: string;
    value: string;
}

class StdObject {
    public id: number;
    public type: StdObjectType = StdObjectType.object;
    public name: string = '';
    public long: string = '';
    public short: string = '';
    public keyID: string = '';
    public mass: number = 0;
    public nouns: string = '';
    public adjectives: string = '';
    public material: string = '';
    public notes: string = '';
    public reads: Read[] = [];
    public properties: Property[] = [];
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

    public getShort() {
        if (this.type === StdObjectType.food && this['preserved'] && this['preserved'].trim().length !== 0) {
            switch (this['preserved'].trim().toLowerCase()) {
                case 'smoked':
                case 'cooked':
                    return `${this.short} (%^RESET%^mono11%^${this['preserved'].trim().toLowerCase()}%^DEFAULT%^)`;
                case 'salted':
                    return `${this.short} (%^RESET%^BOLD%^${this['preserved'].trim().toLowerCase()}%^DEFAULT%^)`;
                case 'dehydrated':
                    return `${this.short} (%^RESET%^RGB320%^${this['preserved'].trim().toLowerCase()}%^DEFAULT%^)`;
                default:
                    if (this['preserved'].match(/%\^/g) && !this['preserved'].trim().endsWith('%^DEFAULT%^)'))
                        return `${this.short} (${this['preserved'].trim()}%^DEFAULT%^)`;
                    else
                        return `${this.short} (${this['preserved'].trim()})`;
            }
        }
        else if (this.type === StdObjectType.drink) {
            const full = ['"%^BOLD%^%^RED%^almost empty%^DEFAULT%^"', '"%^RESET%^%^ORANGE%^fairly empty%^DEFAULT%^"', '"%^YELLOW%^half full%^DEFAULT%^"', '"%^RESET%^%^GREEN%^almost full%^DEFAULT%^"', '"%^BOLD%^%^GREEN%^full%^DEFAULT%^"'];
            const level = (this['drinks'] / this['maxDrinks'] / full.length) - 1;
            if (level >= full.length)
                return `${this.short} (${full[full.length - 1]})`;
            if (level < 0)
                return `${this.short} (${full[0]})`;
            return `${this.short} (${full[level]})`;
        }
        return this.short;
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
    public version = 2;
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
                        if (data.version === 1) {
                            let hidden = 0;
                            Object.keys(area.rooms[z][y][x].exitsDetails).forEach(e => {
                                if (area.rooms[z][y][x].exitsDetails[e].hidden)
                                    hidden |= RoomExits[e];
                            });
                            area.rooms[z][y][x].hidden = hidden;
                        }
                    }
                }
            }
        }
        if (data.baseRooms) {
            area.baseRooms = {};
            Object.keys(data.baseRooms).forEach(k => {
                area.baseRooms[k] = new Room(0, 0, 0, data.baseRooms[k]);
            });
        }
        if (data.baseMonsters) {
            area.baseMonsters = {};
            Object.keys(data.baseMonsters).forEach(k => {
                area.baseMonsters[k] = new Monster(data.baseMonsters[k]);
            });
        }
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
    private $cancel = false;
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
    private $reSizer;
    private $reSizerCache;
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

    private $drawCache;

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
            this.emit('changed', -1, -1);
        }
    }

    get changed(): boolean {
        return super.changed;
    }

    public createControl() {
        if (!window.$roomImg) {
            window.$roomImg = new Image();
            window.$roomImg.src = './../assets/editor/rooms2.png';
            window.$roomImg.addEventListener('load', () => {
                window.$roomImgLoaded = true;
            });
        }
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
                while (ol--) {
                    if (!old[ol]) continue;
                    this.$selectedRooms.push(this.getRoom(old[ol].x, old[ol].y, this.$depth));
                }
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
            if (this.$focused && (this.$focusedRoom || this.$selectedRooms.length > 0) && e.shiftKey) {
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
                this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mousePrevious.x - this.$mouseDown.x, this.$mousePrevious.y - this.$mouseDown.y);
                this.drawRegion(this.$mouseDown.x, this.$mouseDown.y, this.$mouse.x - this.$mouseDown.x, this.$mouse.y - this.$mouseDown.y);
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
        this.$mapContext = this.$map.getContext('2d', { alpha: false });
        this.$mapContext.mozImageSmoothingEnabled = false;
        this.$mapContext.webkitImageSmoothingEnabled = false;
        this.$mapContext.imageSmoothingEnabled = false;
        this.$mapContext.lineWidth = 0.6;

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
                inputMenu = [
                    { role: 'copy' },
                    { type: 'separator' },
                    { role: 'selectAll' }
                ];
            }
            else
                inputMenu = [
                    { role: 'selectAll' }
                ];
            ipcRenderer.invoke('show-context', inputMenu);
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
                            sR.clear(this.$area.baseRooms[this.$area.defaultRoom], this.$area.defaultRoom);
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(p, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.NorthEast);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.North);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.NorthWest);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.East);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.West);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.SouthEast);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.South);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.SouthWest);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y, this.$depth), true);
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.Down);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
                            this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
                            this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setSelectedRooms(this.getRoom(x, y, this.$depth), true);
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            this.selectedFocusedRoom.addExit(RoomExit.Up);
                            if (o !== this.selectedFocusedRoom.exits) {
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [o], rooms: [[or.x, or.y, or.z]] });
                                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [or.exitsDetails], rooms: [[or.x, or.y, or.z]] });
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
        this.$roomEditor.hideUnSetProperties = true;
        this.$roomEditor.readonly = (prop, value, object) => {
            if (object && object.filter(o => o.ef).length !== 0)
                return prop !== 'ef';
            return prop === 'ef';
        };
        this.$roomEditor.on('dialog-open', () => this.emit('dialog-open'));
        this.$roomEditor.on('dialog-close', () => this.emit('dialog-close'));
        this.$roomEditor.on('dialog-cancel', () => this.emit('dialog-cancel'));
        this.$roomEditor.on('open-file', () => {
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
                const oldHidden = [];
                const oldExits = [];
                const ed = {};
                let exits = 0;
                let ee = 0;
                let climbs = 0;
                let hidden = 0;

                sl = newValue.length;
                while (sl--) {
                    ed[newValue[sl].exit] = newValue[sl];
                    if (newValue[sl].climb)
                        climbs |= RoomExits[newValue[sl].exit];
                    if (newValue[sl].hidden)
                        hidden |= RoomExits[newValue[sl].exit];
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
                    oldHidden[sl] = old['hidden'];
                    oldExits[sl] = old['exits'];

                    curr['exitsDetails'] = ed;
                    curr['external'] = ee;
                    curr['climbs'] = climbs;
                    curr['hidden'] = hidden;
                    curr['exits'] = exits;

                    this.RoomChanged(curr, old, true);

                    old['exitsDetails'] = ed;
                    old['external'] = ee;
                    old['climbs'] = climbs;
                    old['hidden'] = hidden;
                    old['exits'] = exits;
                    this.DrawRoom(this.$mapContext, old, true, old.at(mx, my));
                }
                const rooms = selected.map(m => [m.x, m.y, m.z]);
                this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: oldValues, rooms: rooms });
                this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: oldExits, rooms: rooms });
                this.pushUndo(undoAction.edit, undoType.room, { property: 'external', values: oldEE, rooms: rooms });
                this.pushUndo(undoAction.edit, undoType.room, { property: 'climbs', values: oldClimb, rooms: rooms });
                this.pushUndo(undoAction.edit, undoType.room, { property: 'hidden', values: oldHidden, rooms: rooms });
                this.stopUndoGroup();

            }
            else if (prop === 'type') {
                const nDefault = this.$area.baseRooms[newValue] || this.$area.baseRooms[this.$area.defaultRoom] || new Room(0, 0, 0);
                while (sl--) {
                    const curr = selected[sl];
                    const old = this.getRoom(curr.x, curr.y, curr.z);
                    const oDefault = this.$area.baseRooms[old.type];
                    oldValues[sl] = old.clone();
                    if (oDefault && nDefault)
                        for (prop in oDefault) {
                            if (prop === 'type' || prop === 'x' || prop === 'y' || prop === 'z' || !oDefault.hasOwnProperty(prop)) continue;
                            if (curr[prop] === oDefault[prop])
                                curr[prop] = copy(nDefault[prop]);
                        }
                    curr.type = newValue;
                    this.RoomChanged(curr, old, true);
                    if (oDefault && nDefault)
                        for (prop in oDefault) {
                            if (prop === 'type' || prop === 'x' || prop === 'y' || prop === 'z' || !oDefault.hasOwnProperty(prop)) continue;
                            if (old[prop] === oDefault[prop])
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
                        case 'forageObjects':
                        case 'rummageObjects':
                        case 'objects':
                        case 'sounds':
                        case 'smells':
                        case 'searches':
                        case 'items':
                        case 'properties':
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
            //this.UpdateEditor(selected);
            this.refreshEditor();
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
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
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
                                        placeholder: 'Input file path to create external exit',
                                        browse: e => {
                                            this.emit('browse-file', e);
                                        }
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
                                label: 'Closed',
                                field: 'closed',
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
                property: 'hidden',
                group: 'Exits',
                formatter: this.formatExits,
                readonly: true,
                sort: 4
            },
            {
                property: 'exits',
                group: 'Exits',
                formatter: this.formatExits,
                visible: false,
                sort: 5
            },
            {
                property: 'items',
                group: 'Description',
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
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
                        dialog: true,
                        title: 'Edit long&hellip;',
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
                        //spellchecker:disable
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
                        //spellchecker:enable
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
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Name',
                                width: 300,
                                field: 'id',
                                formatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                tooltipFormatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                editor: {
                                    type: EditorType.select,
                                    options: {
                                        data: this.$area ? Object.values<StdObject>(this.$area.objects).map(o => {
                                            return {
                                                display: o.name || o.short,
                                                value: o.id
                                            };
                                        }) : []
                                    }
                                }
                            },
                            {
                                label: 'Min amount',
                                field: 'minAmount',
                                width: 150
                            },
                            {
                                label: 'Max amount',
                                field: 'maxAmount',
                                width: 150
                            },
                            {
                                label: 'Random',
                                field: 'random',
                                width: 150
                            },
                            {
                                label: 'Unique',
                                field: 'unique',
                                width: 150
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                id: 0,
                                minAmount: 0,
                                maxAmount: 0,
                                random: 0,
                                unique: false
                            };
                        },
                        type: 'object',
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
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Name',
                                field: 'id',
                                formatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.monsters[data.cell])
                                        return this.$area.monsters[data.cell].name || this.$area.monsters[data.cell].short;
                                    return '';
                                },
                                tooltipFormatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.monsters[data.cell])
                                        return this.$area.monsters[data.cell].name || this.$area.monsters[data.cell].short;
                                    return '';
                                },
                                editor: {
                                    type: EditorType.select,
                                    options: {
                                        data: this.$area ? Object.values<Monster>(this.$area.monsters).map(o => {
                                            return {
                                                display: o.name || o.short,
                                                value: o.id
                                            };
                                        }) : []
                                    }
                                }
                            },
                            {
                                label: 'Min amount',
                                field: 'minAmount',
                                width: 150
                            },
                            {
                                label: 'Max amount',
                                field: 'maxAmount',
                                width: 150
                            },
                            {
                                label: 'Random',
                                field: 'random',
                                width: 150
                            },
                            {
                                label: 'Unique',
                                field: 'unique',
                                width: 150
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                id: 0,
                                minAmount: 0,
                                maxAmount: 0,
                                random: 0,
                                unique: false,
                                action: ''
                            };
                        },
                        type: 'object',
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
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
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
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
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
                property: 'reads',
                group: 'Advanced',
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                sort: 4,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Read',
                                field: 'read',
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
                            },
                            {
                                label: 'Language',
                                field: 'language',
                                width: 150,
                                editor: {
                                    type: EditorType.dropdown,
                                    options: {
                                        data: [
                                            //spellchecker:disable
                                            'eltherian', 'ersi', 'jhlorim', 'malkierien', 'common',
                                            'draconic', 'elcharean', 'tangetto', 'terrakarn', 'gobbledegook',
                                            'malkierien', 'loyavenku', 'caninen', 'draconic', 'nibelungen',
                                            'wulinaxin', 'shangtai', 'farsi', 'nymal'
                                            //spellchecker:enable
                                        ]
                                    }
                                }
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                read: '',
                                description: '',
                                language: ''
                            };
                        },
                        type: 'read',
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
                property: 'background',
                label: 'Background',
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
                label: 'Base properties',
                sort: 2,
                property: 'baseFlags',
                group: 'Advanced',
                editor: {
                    type: EditorType.flag,
                    options: {
                        enum: RoomBaseFlags,
                        container: document.body
                    }
                }
            },
            {
                property: 'forageObjects',
                label: 'Forage objects',
                group: 'Advanced',
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Name',
                                field: 'id',
                                spring: true,
                                formatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                tooltipFormatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                editor: {
                                    type: EditorType.select,
                                    options: {
                                        data: this.$area ? Object.values<StdObject>(this.$area.objects).map(o => {
                                            return {
                                                display: o.name || o.short,
                                                value: o.id
                                            };
                                        }) : []
                                    }
                                }
                            },
                            {
                                label: 'Random',
                                field: 'random',
                                width: 150
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                id: 0,
                                random: 0
                            };
                        },
                        type: 'object',
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 6
            },
            {
                property: 'rummageObjects',
                label: 'Rummage objects',
                group: 'Advanced',
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Name',
                                field: 'id',
                                spring: true,
                                formatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                tooltipFormatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                editor: {
                                    type: EditorType.select,
                                    options: {
                                        data: this.$area ? Object.values<StdObject>(this.$area.objects).map(o => {
                                            return {
                                                display: o.name || o.short,
                                                value: o.id
                                            };
                                        }) : []
                                    }
                                }
                            },
                            {
                                label: 'Random',
                                field: 'random',
                                width: 150
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                id: 0,
                                random: 0
                            };
                        },
                        type: 'object',
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 6
            },
            {
                property: 'notes',
                label: 'Notes',
                group: 'Advanced',
                formatter: () => '',
                visible: true,
                align: 'center',
                sort: 7,
                editor: {
                    type: EditorType.button,
                    options: {
                        open: true,
                        click: ed => {
                            const notes: HTMLDialogElement = <HTMLDialogElement>document.createElement('dialog');
                            notes.id = 'notes-' + new Date().getTime();
                            notes.addEventListener('open', () => this.emit('dialog-open'));
                            notes.addEventListener('close', () => {
                                if (notes.open)
                                    notes.close();
                                notes.remove();
                                this.emit('dialog-close');
                            });
                            notes.addEventListener('cancel', () => {
                                if (notes.open)
                                    notes.close();
                                notes.remove();
                                this.emit('dialog-cancel');
                            });

                            notes.style.width = '400px';
                            notes.style.height = '450px';
                            notes.style.padding = '0px';
                            notes.innerHTML = `
                            <div class="dialog-header" style="font-weight: bold">
                                <button type="button" class="close" data-dismiss="modal" onclick="document.getElementById('${notes.id}').close();">&times;</button>
                                <div style="padding-top: 2px;">Room notes...</div>
                            </div>
                            <div class="dialog-body" style="padding-top:33px">
                                <div class="form-group"><label class="control-label" style="padding: 10px;width: 100%"><textarea class="input-sm form-control" id="${notes.id}-value" style="width: 100%;height: 338px;">${ed.value || ''}</textarea></label></div>
                            </div>
                            <div class="dialog-footer">
                                <button style="float: right" type="button" class="btn btn-default" onclick="document.getElementById('${notes.id}').close();">Cancel</button>
                                <button style="float: right" type="button" class="btn btn-primary">Ok</button>
                            </div>`;
                            document.body.appendChild(notes);
                            notes.lastElementChild.lastElementChild.addEventListener('click', () => {
                                ed.value = notes.children[1].querySelector('textarea').value;
                                if (notes.open)
                                    notes.close();
                                notes.remove();
                            });
                            notes.showModal();
                        }
                    }
                }
            },
            {
                property: 'properties',
                label: 'Custom',
                group: 'Properties',
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                sort: 9,
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Type',
                                field: 'type',
                                width: 150,
                                editor: {
                                    type: EditorType.select,
                                    options: {
                                        data: [
                                            { value: 0, display: 'normal' },
                                            { value: 1, display: 'temporary' }
                                        ]
                                    }
                                },
                                formatter: (data) => {
                                    if (!data) return '';
                                    switch (data.cell) {
                                        case 0:
                                            return 'normal';
                                        case 1:
                                            return 'temporary';
                                    }
                                    return '';
                                },
                                tooltipFormatter: (data) => {
                                    if (!data) return '';
                                    switch (data.cell) {
                                        case 0:
                                            return 'normal';
                                        case 1:
                                            return 'temporary';
                                    }
                                    return '';
                                }
                            },
                            {
                                label: 'Name',
                                field: 'name',
                                width: 150,
                                editor: {
                                    type: EditorType.dropdown,
                                    options: {
                                        data: [
                                            '[effect] bonus',
                                            'cold element bonus',
                                            'frost element bonus',
                                            'ice element bonus',
                                            'cold element penalty',
                                            'frost element penalty',
                                            'ice element penalty',
                                            'lightning element bonus',
                                            'lightning element penalty',
                                            'fire element bonus',
                                            'fire element penalty',
                                            'heat element bonus',
                                            'heat element penalty',
                                            'water element bonus',
                                            'water element penalty',
                                            'hide exits',
                                            'no convert',
                                            'no scry',
                                            'no dirt',
                                            'no cauterize',
                                            'no food decay',
                                            'no shock',
                                            'nonetrackable',
                                            'melee as ability',
                                            'crafting tool',
                                            'crafting quality',
                                            'crafting enchantment',
                                            'no range throw',
                                            'no range shoot'
                                        ]
                                    }
                                }
                            },
                            {
                                label: 'Value',
                                field: 'value',
                                spring: true,
                                width: 200
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                type: 1,
                                name: '',
                                value: ''
                            };
                        },
                        type: 'property',
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
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
                        min: 0,
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
        this.$reSizer = new ResizeObserver((entries, observer) => {
            if (entries.length === 0) return;
            if (!entries[0].contentRect || entries[0].contentRect.width === 0 || entries[0].contentRect.height === 0)
                return;
            if (!this.$reSizerCache || this.$reSizerCache.width !== entries[0].contentRect.width || this.$reSizerCache.height !== entries[0].contentRect.height) {
                this.$reSizerCache = { width: entries[0].contentRect.width, height: entries[0].contentRect.height };
                this.doUpdate(UpdateType.resize);
            }
        });
        this.$reSizer.observe(this.$mapContainer);
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
        $('a[data-toggle="tab"]', this.$propertiesEditor.tabs).on('shown.bs.tab', (e) => {
            if (e.target.textContent === 'Base rooms')
                this.$propertiesEditor.roomGrid.refresh();
            else if (e.target.textContent === 'Base monsters')
                this.$propertiesEditor.monsterGrid.refresh();
        });

        //this.$propertiesEditor.tabs
        el = this.$propertiesEditor.generalTab.querySelectorAll('select');
        el[0].innerHTML = '<optgroup label="Area"><option value="base">Base</option></optgroup><optgroup label="Standard">' +
            RoomTypes.map(r => `<option value="${r.value}">${r.display}</option>`).join('') + '</optgroup>';
        el[1].innerHTML = '<optgroup label="Area"><option value="base">Base</option></optgroup><optgroup label="Standard">' +
            MonsterTypes.map(r => `<option value="${r.value}">${r.display}</option>`).join('') + '</optgroup>';
        this.$propertiesEditor.defaultRoom = $(el[0]).selectpicker();
        this.$propertiesEditor.defaultRoom.on('change', () => {
            this.startUndoGroup();
            this.pushUndo(undoAction.edit, undoType.properties, { property: 'defaultRoom', old: this.$area.defaultRoom, new: this.$propertiesEditor.defaultRoom.val() });
            const r = this.$area.baseRooms[this.$area.defaultRoom];
            const n = this.$propertiesEditor.defaultRoom.val();
            const rooms = [];

            const zl = this.$area.size.depth;
            const xl = this.$area.size.width;
            const yl = this.$area.size.height;
            for (let z = 0; z < zl; z++) {
                for (let y = 0; y < yl; y++) {
                    for (let x = 0; x < xl; x++) {
                        const room = this.$area.rooms[z][y][x];
                        let nRoom;
                        //not current default so ignore
                        if (r) {
                            const base = this.$area.baseRooms[room.type] || this.$area.baseRooms[this.$area.defaultRoom];
                            //room has been changed so ignore
                            if (!room.empty && !room.equals(base, true)) continue;
                            rooms.push(room);
                            nRoom = new Room(room.x, room.y, room.z, this.$area.baseRooms[n], n);
                        }
                        else {
                            if (!room.empty || room.type !== this.$area.defaultRoom)
                                continue;
                            room.type = n;
                        }
                        this.setRoom(nRoom);
                        this.RoomChanged(nRoom, room);
                        this.DrawRoom(this.$mapContext, nRoom, true, nRoom.at(this.$mouse.rx, this.$mouse.ry));
                    }
                }
            }

            this.pushUndo(undoAction.delete, undoType.room, rooms);
            this.stopUndoGroup();
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
                label: 'Base properties',
                field: 'baseFlags',
                width: 150,
                formatter: this.formatMonsterBaseFlags,
                tooltipFormatter: this.formatMonsterBaseFlags,
                editor: {
                    type: EditorType.flag,
                    options: {
                        enum: MonsterBaseFlags,
                        container: document.body
                    }
                }
            },
            {
                field: 'objects',
                label: 'Objects',
                sortable: false,
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Name',
                                width: 300,
                                field: 'id',
                                formatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                tooltipFormatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                editor: {
                                    type: EditorType.select,
                                    options: {
                                        data: this.$area ? Object.values<StdObject>(this.$area.objects).map(o => {
                                            return {
                                                display: o.name || o.short,
                                                value: o.id
                                            };
                                        }) : []
                                    }
                                }
                            },
                            {
                                label: 'Min amount',
                                field: 'minAmount',
                                width: 150
                            },
                            {
                                label: 'Max amount',
                                field: 'maxAmount',
                                width: 150
                            },
                            {
                                label: 'Random',
                                field: 'random',
                                width: 150
                            },
                            {
                                label: 'Unique',
                                field: 'unique',
                                width: 150
                            },
                            {
                                label: 'Action',
                                field: 'action',
                                width: 150,
                                spring: true,
                                editor: {
                                    type: EditorType.dropdown,
                                    options: {
                                        data: [
                                            'wield',
                                            'wear',
                                            'sheath'
                                        ]
                                    }
                                }
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                id: 0,
                                minAmount: 0,
                                maxAmount: 0,
                                random: 0,
                                unique: false,
                                action: ''
                            };
                        },
                        type: 'object',
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
                                pages: [
                                    new WizardPage({
                                        id: 'mon-wiz-notes',
                                        title: 'Notes',
                                        body: `<div class="col-sm-12 form-group"><label class="control-label" style="width: 100%">Notes<textarea class="input-sm form-control" id="mon-wiz-notes" style="width: 100%;height: 273px;"></textarea></label></div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#mon-wiz-notes').value = e.wizard.defaults['mon-wiz-notes'] || '';
                                        }
                                    })
                                ],
                                data: {
                                    'mon-wiz-notes': ed.value.notes || '',
                                    'mon-wiz-emotes': ed.value.emotes || [],
                                    'mon-wiz-emotes-chance': '' + ed.value.emotesChance,
                                    'mon-wiz-speech-chance': '' + ed.value.speechChance,
                                    'mon-wiz-emotes-chance-combat': '' + ed.value.emotesChanceCombat,
                                    'mon-wiz-speech-chance-combat': '' + ed.value.speechChanceCombat,
                                    'mon-wiz-welcome-message': 'Welcome to the base monster editor, this will take you through the steps to edit a monster quickly and easily. You may finish at any time to save your current selections.',
                                    'mon-wiz-area-types': Object.keys(this.$area.baseMonsters || { base: null }).filter(r => r !== ed.data.name).map(r => {
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
                                    'mon-wiz-auto-stand': (ed.value.flags & MonsterFlags.Auto_Stand) === MonsterFlags.Auto_Stand,
                                    'mon-wiz-actions': ed.value.actions,
                                    'mon-wiz-reactions': ed.value.reactions || [],
                                    'mon-wiz-party': ed.value.party,
                                    'mon-wiz-tracking': ed.value.tracking,
                                    'mon-wiz-tracking-message': ed.value.trackingMessage,
                                    'mon-wiz-tracking-type': ed.value.trackingType,
                                    'mon-wiz-tracking-aggressively': ed.value.trackingAggressively,
                                    'mon-wiz-ask': ed.value.askEnabled,
                                    'mon-wiz-ask-no-topic': ed.value.askNoTopic,
                                    'mon-wiz-ask-response': '' + (ed.value.askResponseType || 0),
                                    'mon-wiz-ask-topics': ed.value.askTopics,
                                    'mon-wiz-reputation-group': ed.value.reputationGroup,
                                    'mon-wiz-reputations': ed.value.reputations,
                                    'mon-wiz-properties': ed.value.properties || []
                                },
                                finish: e => {
                                    const nMonster = ed.value.clone();
                                    nMonster.notes = e.data['mon-wiz-notes'];
                                    nMonster.flags = MonsterFlags.None;
                                    nMonster.type = e.data['mon-wiz-type'].value;
                                    nMonster.level = +e.data['mon-wiz-level'];
                                    nMonster.alignment = e.data['mon-wiz-alignment'];
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
                                    nMonster.gender = e.data['mon-wiz-gender'].value;
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
                                    nMonster.actions = e.data['mon-wiz-actions'];
                                    nMonster.reactions = e.data['mon-wiz-reactions'] || [];
                                    nMonster.reputationGroup = e.data['mon-wiz-reputation-group'];
                                    nMonster.reputations = e.data['mon-wiz-reputations'] || [];
                                    if (e.data['mon-wiz-auto-stand'])
                                        nMonster.flags |= MonsterFlags.Auto_Stand;

                                    nMonster.party = e.data['mon-wiz-party'];
                                    nMonster.tracking = e.data['mon-wiz-tracking'];
                                    nMonster.trackingMessage = e.data['mon-wiz-tracking-message'];
                                    nMonster.trackingType = e.data['mon-wiz-tracking-type'];
                                    nMonster.trackingAggressively = e.data['mon-wiz-tracking-aggressively'];

                                    nMonster.askEnabled = e.data['mon-wiz-ask'];
                                    nMonster.askNoTopic = e.data['mon-wiz-ask-no-topic'];
                                    nMonster.askResponseType = +e.data['mon-wiz-ask-response'];
                                    nMonster.askTopics = e.data['mon-wiz-ask-topics'];
                                    nMonster.emotes = e.data['mon-wiz-emotes'];
                                    nMonster.emotesChance = +e.data['mon-wiz-emotes-chance'];
                                    nMonster.speechChance = +e.data['mon-wiz-speech-chance'];
                                    nMonster.emotesChanceCombat = +e.data['mon-wiz-emotes-chance-combat'];
                                    nMonster.speechChanceCombat = +e.data['mon-wiz-speech-chance-combat'];
                                    nMonster.properties = e.data['mon-wiz-properties'] || [];

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
            newValue.monster.baseFlags = newValue.baseFlags;
            this.$area.baseMonsters[newValue.name] = newValue.monster;
            this.changed = true;
        });
        this.$propertiesEditor.monsterGrid.on('add', e => {
            this.$new.baseMonsters++;
            this.$area.baseMonsters['base' + this.$new.baseMonsters] = new Monster('STD_MONSTER');
            e.data = {
                name: 'base' + this.$new.baseMonsters,
                maxAmount: this.$area.baseMonsters['base' + this.$new.baseMonsters].maxAmount,
                baseFlags: this.$area.baseMonsters['base' + this.$new.baseMonsters].baseFlags,
                objects: this.$area.baseMonsters['base' + this.$new.baseMonsters].objects,
                monster: this.$area.baseMonsters['base' + this.$new.baseMonsters]
            };
            this.pushUndo(undoAction.add, undoType.properties, { property: 'baseMonsters', name: 'base' + this.$new.baseMonsters, value: e.data.monster });
            this.changed = true;
        });
        this.$propertiesEditor.monsterGrid.on('cut', (e) => {
            this.pushUndo(undoAction.delete, undoType.properties, {
                property: 'baseMonsters', values: e.data.map(r => {
                    delete this.$area.baseMonsters[r.data.name];
                    return { name: r.data.name, value: r.data.monster };
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
            if (ipcRenderer.sendSync('show-dialog-sync', 'showMessageBox',
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
                        delete this.$area.baseMonsters[r.data.name];
                        return { name: r.data.name, value: r.data.monster };
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
                label: 'Base properties',
                field: 'baseFlags',
                width: 150,
                formatter: this.formatRoomBaseFlags,
                tooltipFormatter: this.formatRoomBaseFlags,
                editor: {
                    type: EditorType.flag,
                    options: {
                        enum: RoomBaseFlags,
                        container: document.body
                    }
                }
            },
            {
                field: 'objects',
                label: 'Objects',
                sortable: false,
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Name',
                                width: 300,
                                field: 'id',
                                formatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                tooltipFormatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                editor: {
                                    type: EditorType.select,
                                    options: {
                                        data: this.$area ? Object.values<StdObject>(this.$area.objects).map(o => {
                                            return {
                                                display: o.name || o.short,
                                                value: o.id
                                            };
                                        }) : []
                                    }
                                }
                            },
                            {
                                label: 'Min amount',
                                field: 'minAmount',
                                width: 150
                            },
                            {
                                label: 'Max amount',
                                field: 'maxAmount',
                                width: 150
                            },
                            {
                                label: 'Random',
                                field: 'random',
                                width: 150
                            },
                            {
                                label: 'Unique',
                                field: 'unique',
                                width: 150
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                id: 0,
                                minAmount: 0,
                                maxAmount: 0,
                                random: 0,
                                unique: false
                            };
                        },
                        type: 'object',
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
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Name',
                                field: 'id',
                                formatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.monsters[data.cell])
                                        return this.$area.monsters[data.cell].name || this.$area.monsters[data.cell].short;
                                    return '';
                                },
                                tooltipFormatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.monsters[data.cell])
                                        return this.$area.monsters[data.cell].name || this.$area.monsters[data.cell].short;
                                    return '';
                                },
                                editor: {
                                    type: EditorType.select,
                                    options: {
                                        data: this.$area ? Object.values<Monster>(this.$area.monsters).map(o => {
                                            return {
                                                display: o.name || o.short,
                                                value: o.id
                                            };
                                        }) : []
                                    }
                                }
                            },
                            {
                                label: 'Min amount',
                                field: 'minAmount',
                                width: 150
                            },
                            {
                                label: 'Max amount',
                                field: 'maxAmount',
                                width: 150
                            },
                            {
                                label: 'Random',
                                field: 'random',
                                width: 150
                            },
                            {
                                label: 'Unique',
                                field: 'unique',
                                width: 150
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                id: 0,
                                minAmount: 0,
                                maxAmount: 0,
                                random: 0,
                                unique: false,
                                action: ''
                            };
                        },
                        type: 'object',
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    },
                    sort: 2
                }
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
                                    'room-wiz-notes': ed.value.notes || '',
                                    'room-wiz-welcome-message': 'Welcome to the base room editor, this will take you through the steps to edit a base room quickly and easily. You may finish at any time to save your current selections.',
                                    'room-wiz-area-types': Object.keys(this.$area.baseRooms || { base: null }).filter(r => r !== ed.data.name).map(r => {
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
                                    'room-wiz-underwater': (ed.value.flags & RoomFlags.Underwater) === RoomFlags.Underwater,
                                    'room-wiz-forage': '' + ed.value.forage,
                                    'room-wiz-max-forage': '' + ed.value.maxForage,
                                    'room-wiz-secret-exit': ed.value.secretExit,
                                    'room-wiz-no-attack': (ed.value.flags & RoomFlags.No_Attack) === RoomFlags.No_Attack,
                                    'room-wiz-council': (ed.value.flags & RoomFlags.Council) === RoomFlags.Council,
                                    'room-wiz-melee': (ed.value.flags & RoomFlags.Melee_As_Ability) === RoomFlags.Melee_As_Ability,
                                    'room-wiz-no_mgive': (ed.value.flags & RoomFlags.No_MGive) === RoomFlags.No_MGive,
                                    'room-wiz-pk': (ed.value.flags & RoomFlags.Enable_Pk) === RoomFlags.Enable_Pk,
                                    'room-wiz-no-dirt': (ed.value.flags & RoomFlags.No_Dirt) === RoomFlags.No_Dirt,
                                    'room-wiz-dirt': ed.value.dirtType,
                                    'room-wiz-temperature': '' + ed.value.temperature,
                                    'room-wiz-exits': Object.values(ed.value.exitsDetails),
                                    'room-wiz-items': ed.value.items,
                                    'room-wiz-smells': ed.value.smell && ed.value.smell.length > 0 ? [{ smell: 'default', description: ed.value.smell }].concat(...ed.value.smells) : ed.value.smells,
                                    'room-wiz-sounds': ed.value.sound && ed.value.sound.length > 0 ? [{ sound: 'default', description: ed.value.sound }].concat(...ed.value.sounds) : ed.value.sounds,
                                    'room-wiz-searches': ed.value.searches,
                                    'room-wiz-forage-objects': ed.value.forageObjects,
                                    'room-wiz-rummage-objects': ed.value.rummage,
                                    'room-wiz-reads': ed.value.reads,
                                    'room-wiz-properties': ed.value.properties
                                },
                                finish: e => {
                                    const nRoom = ed.value.clone();
                                    nRoom.notes = e.data['room-wiz-notes'];
                                    nRoom.reads = e.data['room-wiz-reads'];
                                    nRoom.properties = e.data['room-wiz-properties'];
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
                                    if (e.data['room-wiz-no_mgive'])
                                        nRoom.flags |= RoomFlags.No_MGive;
                                    if (e.data['room-wiz-pk'])
                                        nRoom.flags |= RoomFlags.Enable_Pk;
                                    if (e.data['room-wiz-no-dirt'])
                                        nRoom.flags |= RoomFlags.No_Dirt;
                                    if (e.data['room-wiz-underwater'])
                                        nRoom.flags |= RoomFlags.Underwater;
                                    nRoom.forage = +e.data['room-wiz-forage'];
                                    nRoom.maxForage = +e.data['room-wiz-max-forage'];
                                    nRoom.secretExit = e.data['room-wiz-secret-exit'];
                                    nRoom.dirtType = e.data['room-wiz-dirt'];
                                    nRoom.temperature = +e.data['room-wiz-temperature'];
                                    nRoom.forageObjects = e.data['room-wiz-forage-objects'];
                                    nRoom.rummageObjects = e.data['room-wiz-rummage-objects'];
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
                                },
                                pages: [
                                    new WizardDataGridPage({
                                        title: 'Forage objects',
                                        id: 'room-wiz-forage-objects',
                                        clipboard: 'jiMUD/',
                                        columns: [
                                            {
                                                label: 'Name',
                                                field: 'id',
                                                spring: true,
                                                formatter: (data) => {
                                                    if (!data) return '';
                                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                                    return '';
                                                },
                                                tooltipFormatter: (data) => {
                                                    if (!data) return '';
                                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                                    return '';
                                                },
                                                editor: {
                                                    type: EditorType.select,
                                                    options: {
                                                        data: this.$area ? Object.values<StdObject>(this.$area.objects).map(o => {
                                                            return {
                                                                display: o.name || o.short,
                                                                value: o.id
                                                            };
                                                        }) : []
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Random',
                                                field: 'random',
                                                width: 150
                                            }
                                        ],
                                        add: (e) => {
                                            e.data = {
                                                item: 0,
                                                random: 0
                                            };
                                        },
                                        enterMoveFirst: this.$enterMoveFirst,
                                        enterMoveNext: this.$enterMoveNext,
                                        enterMoveNew: this.$enterMoveNew
                                    }),
                                    new WizardDataGridPage({
                                        title: 'Rummage objects',
                                        id: 'room-wiz-rummage-objects',
                                        clipboard: 'jiMUD/',
                                        columns: [
                                            {
                                                label: 'Name',
                                                field: 'id',
                                                spring: true,
                                                formatter: (data) => {
                                                    if (!data) return '';
                                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                                    return '';
                                                },
                                                tooltipFormatter: (data) => {
                                                    if (!data) return '';
                                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                                    return '';
                                                },
                                                editor: {
                                                    type: EditorType.select,
                                                    options: {
                                                        data: this.$area ? Object.values<StdObject>(this.$area.objects).map(o => {
                                                            return {
                                                                display: o.name || o.short,
                                                                value: o.id
                                                            };
                                                        }) : []
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Random',
                                                field: 'random',
                                                width: 150
                                            }
                                        ],
                                        add: (e) => {
                                            e.data = {
                                                item: 0,
                                                random: 0
                                            };
                                        },
                                        enterMoveFirst: this.$enterMoveFirst,
                                        enterMoveNext: this.$enterMoveNext,
                                        enterMoveNew: this.$enterMoveNew
                                    }),
                                    new WizardPage({
                                        id: 'room-wiz-notes',
                                        title: 'Notes',
                                        body: `<div class="col-sm-12 form-group"><label class="control-label" style="width: 100%">Notes<textarea class="input-sm form-control" id="room-wiz-notes" style="width: 100%;height: 216px;"></textarea></label></div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#room-wiz-notes').value = e.wizard.defaults['room-wiz-notes'] || '';
                                        }
                                    })
                                ]
                            });
                        }
                    }
                },
                sort: 2
            }
        ];
        this.$propertiesEditor.roomGrid.on('value-changed', (newValue, oldValue, dataIndex) => {
            this.pushUndo(undoAction.edit, undoType.properties, { property: 'baseRooms', old: oldValue, new: newValue });
            if (oldValue.name !== newValue.name)
                delete this.$area.baseRooms[oldValue.name];
            newValue.room.monsters = newValue.monsters;
            newValue.room.objects = newValue.objects;
            newValue.room.baseFlags = newValue.baseFlags;
            this.$area.baseRooms[newValue.name] = newValue.room;
            this.changed = true;
            this.loadTypes();
        });
        this.$propertiesEditor.roomGrid.on('add', e => {
            this.$new.baseRooms++;
            this.$area.baseRooms['base' + this.$new.baseRooms] = new Room(0, 0, 0, null, 'STD_ROOM');
            e.data = {
                name: 'base' + this.$new.baseRooms,
                baseFlags: this.$area.baseRooms['base' + this.$new.baseRooms].baseFlags,
                objects: this.$area.baseRooms['base' + this.$new.baseRooms].objects,
                monsters: this.$area.baseRooms['base' + this.$new.baseRooms].monsters,
                room: this.$area.baseRooms['base' + this.$new.baseRooms]
            };
            this.pushUndo(undoAction.add, undoType.properties, { property: 'baseRooms', name: 'base' + this.$new.baseRooms, value: e.data.room });
            this.changed = true;
            this.loadTypes();
        });
        this.$propertiesEditor.roomGrid.on('cut', (e) => {
            this.pushUndo(undoAction.delete, undoType.properties, {
                property: 'baseRooms', values: e.data.map(r => {
                    delete this.$area.baseRooms[r.data.name];
                    return { name: r.data.name, value: r.data.room };
                })
            });
            this.emit('supports-changed');
            this.changed = true;
            this.loadTypes();
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
            if (ipcRenderer.sendSync('show-dialog-sync', 'showMessageBox',
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
                    property: 'baseRooms', values: e.data.map(r => {
                        delete this.$area.baseRooms[r.data.name];
                        return { name: r.data.name, value: r.data.room };
                    })
                });
                this.changed = true;
                this.loadTypes();
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
                label: 'Base properties',
                field: 'baseFlags',
                width: 150,
                formatter: this.formatMonsterBaseFlags,
                tooltipFormatter: this.formatMonsterBaseFlags,
                editor: {
                    type: EditorType.flag,
                    options: {
                        enum: MonsterBaseFlags,
                        container: document.body
                    }
                }
            },
            {
                field: 'objects',
                label: 'Objects',
                sortable: false,
                formatter: this.formatCollection.bind(this),
                tooltipFormatter: this.formatCollection.bind(this),
                editor: {
                    type: EditorType.collection,
                    options: {
                        open: true,
                        columns: [
                            {
                                label: 'Name',
                                width: 300,
                                field: 'id',
                                formatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                tooltipFormatter: (data) => {
                                    if (!data) return '';
                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                        return stripPinkfish(this.$area.objects[data.cell].name || this.$area.objects[data.cell].short);
                                    return '';
                                },
                                editor: {
                                    type: EditorType.select,
                                    options: {
                                        data: this.$area ? Object.values<StdObject>(this.$area.objects).map(o => {
                                            return {
                                                display: o.name || o.short,
                                                value: o.id
                                            };
                                        }) : []
                                    }
                                }
                            },
                            {
                                label: 'Min amount',
                                field: 'minAmount',
                                width: 150
                            },
                            {
                                label: 'Max amount',
                                field: 'maxAmount',
                                width: 150
                            },
                            {
                                label: 'Random',
                                field: 'random',
                                width: 150
                            }
                            ,
                            {
                                label: 'Unique',
                                field: 'unique',
                                width: 150
                            }
                            ,
                            {
                                label: 'Action',
                                field: 'action',
                                width: 150,
                                spring: true,
                                editor: {
                                    type: EditorType.dropdown,
                                    options: {
                                        data: [
                                            'wield',
                                            'wear',
                                            'sheath'
                                        ]
                                    }
                                }
                            }
                        ],
                        onAdd: (e) => {
                            e.data = {
                                id: 0,
                                minAmount: 0,
                                maxAmount: 0,
                                random: 0,
                                unique: false,
                                action: ''
                            };
                        },
                        type: 'object',
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
                                title: 'Edit monster',
                                pages: [
                                    new WizardPage({
                                        id: 'mon-wiz-notes',
                                        title: 'Notes',
                                        body: `<div class="col-sm-12 form-group"><label class="control-label" style="width: 100%">Notes<textarea class="input-sm form-control" id="mon-wiz-notes" style="width: 100%;height: 273px;"></textarea></label></div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#mon-wiz-notes').value = e.wizard.defaults['mon-wiz-notes'] || '';
                                        }
                                    })
                                ],
                                groups: {
                                    'Area monsters': Object.keys(this.$area.monsters || {}).filter(r => +r !== +ed.value.id).map(r => {
                                        return {
                                            value: r,
                                            display: capitalize(this.$area.monsters[r].name || this.$area.monsters[r].short),
                                            group: 'Area monsters'
                                        };
                                    })
                                },
                                data: {
                                    'mon-wiz-notes': ed.value.notes || '',
                                    'mon-wiz-emotes': ed.value.emotes || [],
                                    'mon-wiz-emotes-chance': '' + ed.value.emotesChance,
                                    'mon-wiz-speech-chance': '' + ed.value.speechChance,
                                    'mon-wiz-emotes-chance-combat': '' + ed.value.emotesChanceCombat,
                                    'mon-wiz-speech-chance-combat': '' + ed.value.speechChanceCombat,
                                    'mon-wiz-welcome-message': 'Welcome to the monster editor, this will take you through the steps to edit a monster quickly and easily. You may finish at any time to save your current selections.',
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
                                    'mon-wiz-auto-stand': (ed.value.flags & MonsterFlags.Auto_Stand) === MonsterFlags.Auto_Stand,
                                    'mon-wiz-actions': ed.value.actions,
                                    'mon-wiz-reactions': ed.value.reactions,
                                    'mon-wiz-party': ed.value.party,
                                    'mon-wiz-tracking': ed.value.tracking,
                                    'mon-wiz-tracking-message': ed.value.trackingMessage,
                                    'mon-wiz-tracking-type': ed.value.trackingType,
                                    'mon-wiz-tracking-aggressively': ed.value.trackingAggressively,
                                    'mon-wiz-ask': ed.value.askEnabled,
                                    'mon-wiz-ask-no-topic': ed.value.askNoTopic,
                                    'mon-wiz-ask-response': '' + (ed.value.askResponseType || 0),
                                    'mon-wiz-ask-topics': ed.value.askTopics,
                                    'mon-wiz-reputation-group': ed.value.reputationGroup,
                                    'mon-wiz-reputations': ed.value.reputations,
                                    'mon-wiz-properties': ed.value.properties || []
                                },
                                finish: e => {
                                    if (ed.editors) {
                                        ed.editors[0].editor.value = e.data['mon-wiz-name'];
                                        ed.editors[1].editor.value = e.data['mon-wiz-short'];
                                    }
                                    const nMonster = ed.value.clone();
                                    nMonster.notes = e.data['mon-wiz-notes'];
                                    nMonster.flags = MonsterFlags.None;
                                    nMonster.type = e.data['mon-wiz-type'].value;
                                    nMonster.level = +e.data['mon-wiz-level'];
                                    nMonster.alignment = e.data['mon-wiz-alignment'];
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
                                    nMonster.gender = e.data['mon-wiz-gender'].value;
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
                                    nMonster.actions = e.data['mon-wiz-actions'];
                                    nMonster.reactions = e.data['mon-wiz-reactions'] || [];
                                    if (e.data['mon-wiz-auto-stand'])
                                        nMonster.flags |= MonsterFlags.Auto_Stand;

                                    nMonster.party = e.data['mon-wiz-party'];
                                    nMonster.tracking = e.data['mon-wiz-tracking'];
                                    nMonster.trackingMessage = e.data['mon-wiz-tracking-message'];
                                    nMonster.trackingType = e.data['mon-wiz-tracking-type'];
                                    nMonster.trackingAggressively = e.data['mon-wiz-tracking-aggressively'];

                                    nMonster.askEnabled = e.data['mon-wiz-ask'];
                                    nMonster.askNoTopic = e.data['mon-wiz-ask-no-topic'];
                                    nMonster.askResponseType = +(e.data['mon-wiz-ask-response'].value);
                                    nMonster.askTopics = e.data['mon-wiz-ask-topics'];
                                    nMonster.emotes = e.data['mon-wiz-emotes'];
                                    nMonster.emotesChance = e.data['mon-wiz-emotes-chance'];
                                    nMonster.speechChance = e.data['mon-wiz-speech-chance'];
                                    nMonster.emotesChanceCombat = e.data['mon-wiz-emotes-chance-combat'];
                                    nMonster.speechChanceCombat = e.data['mon-wiz-speech-chance-combat'];
                                    nMonster.properties = e.data['mon-wiz-properties'] || [];

                                    if (!nMonster.equals(ed.data.monster))
                                        ed.value = nMonster;
                                    ed.focus();
                                },
                                closed: () => {
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
            if (ipcRenderer.sendSync('show-dialog-sync', 'showMessageBox',
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
                        delete this.$area.monsters[r.data.id];
                        return { id: r.data.id, value: r.data.monster };
                    })
                });
                this.changed = true;
            }
        });
        this.$monsterGrid.on('cut', (e) => {
            this.pushUndo(undoAction.delete, undoType.monster, {
                values: e.data.map(r => {
                    delete this.$area.monsters[r.data.id];
                    return { id: r.data.id, value: r.data.monster };
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
            m.clear(this.$area.baseMonsters[this.$area.defaultMonster], this.$area.defaultMonster);
            this.$area.monsters[m.id] = m;
            if (!m.name || m.name.length !== 0) {
                this.$new.monsters++;
                if (this.$new.monsters > 1)
                    m.name = 'new monster ' + this.$new.monsters;
                else
                    m.name = 'new monster';
            }
            m.short = m.short || ('a ' + m.name);
            e.data = {
                id: m.id,
                name: m.name,
                short: m.short,
                maxAmount: m.maxAmount,
                unique: m.unique,
                baseFlags: m.baseFlags,
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
            newValue.monster.baseFlags = newValue.baseFlags;
            this.$area.monsters[newValue.id] = newValue.monster;
            this.updateMonsters(true);
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
                            let ty = ed.value.type;
                            let sh = ed.value.short;
                            let name = ed.value.name;
                            if (ed.editors) {
                                name = ed.editors[0].editor.value;
                                sh = ed.editors[1].editor.value;
                                ty = ed.editors[2].editor.value;
                            }
                            const wizBonuses = new WizardDataGridPage({
                                title: 'Bonuses',
                                id: 'obj-bonuses',
                                clipboard: 'jiMUD/',
                                columns: [
                                    {
                                        label: 'Type',
                                        field: 'type',
                                        width: 150,
                                        formatter: (data) => {
                                            if (!data) return '';
                                            switch (+data.cell) {
                                                case 0:
                                                    return 'Property';
                                                case 1:
                                                    return 'Stat';
                                                case 2:
                                                    return 'Skill';
                                                case 3:
                                                    return 'Resistance';
                                            }
                                            return '';
                                        },
                                        tooltipFormatter: (data) => {
                                            if (!data) return '';
                                            switch (+data.cell) {
                                                case 0:
                                                    return 'Property';
                                                case 1:
                                                    return 'Stat';
                                                case 2:
                                                    return 'Skill';
                                                case 3:
                                                    return 'Resistance';
                                            }
                                            return '';
                                        },
                                        editor: {
                                            type: EditorType.select,
                                            options: {
                                                change: e => {
                                                    switch (e.value) {
                                                        case 0:
                                                            e.editors[1].editor.options.data = ['sight', 'scry bonus', 'double vision', 'sickness', 'force vision', 'night vision', 'faith protection', 'magic protection', 'waterbreathing', 'melee attack bonus'];
                                                            e.editors[2].editor.options.data = ['true', 'false'];
                                                            break;
                                                        case 1:
                                                            e.editors[1].editor.options.data = ['charisma', 'constitution', 'dexterity', 'intelligence', 'strength', 'wisdom'];
                                                            e.editors[2].editor.options.data = ['small', 'respectable', 'large'];
                                                            break;
                                                        case 2:
                                                            e.editors[1].editor.options.data = [{
                                                                display: 'Weapon skills', type: 'group', items: [
                                                                    { value: 'axe' },
                                                                    { value: 'blunt' },
                                                                    { value: 'flail' },
                                                                    { value: 'knife' },
                                                                    { value: 'large sword' },
                                                                    { value: 'melee' },
                                                                    { value: 'miscellaneous' },
                                                                    { value: 'missile' },
                                                                    { value: 'polearm' },
                                                                    { value: 'small sword' },
                                                                    { value: 'spear' },
                                                                    { value: 'staff' }
                                                                ]
                                                            },
                                                            {
                                                                display: 'General skills', type: 'group', items: [
                                                                    { value: 'climbing' },
                                                                    { value: 'fishing' },
                                                                    { value: 'mining' },
                                                                    { value: 'riding' },
                                                                    { value: 'survival' }
                                                                ]
                                                            },
                                                            {
                                                                display: 'Magic skills', type: 'group', items: [
                                                                    { value: 'conjuring' },
                                                                    { value: 'elementals' },
                                                                    { value: 'magic' },
                                                                    { value: 'necromancy' },
                                                                    { value: 'planes' },
                                                                    { value: 'sorcery' }
                                                                ]
                                                            },
                                                            {
                                                                display: 'Deception skills', type: 'group', items: [
                                                                    { value: 'acrobatics' },
                                                                    { value: 'devices' },
                                                                    { value: 'murder' },
                                                                    { value: 'performance' },
                                                                    { value: 'stealth' },
                                                                    { value: 'streetwise' },
                                                                    { value: 'subterfuge' }
                                                                ]
                                                            },
                                                            {
                                                                display: 'Crafting skills', type: 'group', items: [
                                                                    { value: 'artistry' },
                                                                    { value: 'blacksmithing' },
                                                                    { value: 'brewing' },
                                                                    { value: 'cooking' },
                                                                    { value: 'crafting' },
                                                                    { value: 'glasssmithing' },
                                                                    { value: 'leathering' },
                                                                    { value: 'sewing' },
                                                                    { value: 'stonemasonry' },
                                                                    { value: 'woodworking' }
                                                                ]
                                                            },
                                                            {
                                                                display: 'Discipline skills', type: 'group', items: [
                                                                    { value: 'discipline' },
                                                                    { value: 'kicks' },
                                                                    { value: 'mind' },
                                                                    { value: 'punches' },
                                                                    { value: 'sweeps' },
                                                                    { value: 'throws' }
                                                                ]
                                                            },
                                                            {
                                                                display: 'Combat skills', type: 'group', items: [
                                                                    { value: 'archery' },
                                                                    { value: 'armour' },
                                                                    { value: 'attack' },
                                                                    { value: 'defense' },
                                                                    { value: 'double wielding' },
                                                                    { value: 'shield' },
                                                                    { value: 'tactics' },
                                                                    { value: 'thrown' },
                                                                    { value: 'two-handed' },
                                                                    { value: 'weapons' }
                                                                ]
                                                            },
                                                            {
                                                                display: 'Faith skills', type: 'group', items: [
                                                                    { value: 'combat' },
                                                                    { value: 'death' },
                                                                    { value: 'elements' },
                                                                    { value: 'faith' },
                                                                    { value: 'knowledge' },
                                                                    { value: 'life' },
                                                                    { value: 'nature' },
                                                                    { value: 'protection' }
                                                                ]
                                                            }];
                                                            e.editors[2].editor.options.data = ['small', 'respectable', 'large'];
                                                            break;
                                                        case 3:
                                                            e.editors[1].editor.options.data = ['air',
                                                                'acid',
                                                                'fire',
                                                                'ice',
                                                                'cold',
                                                                'lightning',
                                                                'rock',
                                                                'water',
                                                                'poison'];
                                                            e.editors[2].editor.options.data = ['small', 'respectable', 'large'];
                                                            break;
                                                    }
                                                },
                                                data: [
                                                    { display: 'Property', value: 0 },
                                                    { display: 'Stat', value: 1 },
                                                    { display: 'Skill', value: 2 },
                                                    { display: 'Resistance', value: 3 }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        label: 'Adjust',
                                        field: 'adjust',
                                        width: 150,
                                        editor: {
                                            type: EditorType.dropdown,
                                            options: {
                                                data: ['sight']
                                                /*
                                                data: [
                                                    {
                                                        display: 'Properties',
                                                        type: 'group',
                                                        items: [
                                                            {
                                                                value: 'sight'
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        display: 'Stats',
                                                        type: 'group',
                                                        items: [
                                                            { value: 'charisma' },
                                                            { value: 'constitution' },
                                                            { value: 'dexterity' },
                                                            { value: 'intelligence' },
                                                            { value: 'strength' },
                                                            { value: 'wisdom' }
                                                        ]
                                                    },
                                                    {
                                                        display: 'Weapon skills', type: 'group', items: [
                                                            { value: 'axe' },
                                                            { value: 'blunt' },
                                                            { value: 'flail' },
                                                            { value: 'knife' },
                                                            { value: 'large sword' },
                                                            { value: 'melee' },
                                                            { value: 'miscellaneous' },
                                                            { value: 'missile' },
                                                            { value: 'polearm' },
                                                            { value: 'small sword' },
                                                            { value: 'spear' },
                                                            { value: 'staff' }
                                                        ]
                                                    },
                                                    {
                                                        display: 'General skills', type: 'group', items: [
                                                            { value: 'climbing' },
                                                            { value: 'fishing' },
                                                            { value: 'mining' },
                                                            { value: 'riding' },
                                                            { value: 'survival' }
                                                        ]
                                                    },
                                                    {
                                                        display: 'Magic skills', type: 'group', items: [
                                                            { value: 'conjuring' },
                                                            { value: 'elementals' },
                                                            { value: 'magic' },
                                                            { value: 'necromancy' },
                                                            { value: 'planes' },
                                                            { value: 'sorcery' }
                                                        ]
                                                    },
                                                    {
                                                        display: 'Deception skills', type: 'group', items: [
                                                            { value: 'acrobatics' },
                                                            { value: 'devices' },
                                                            { value: 'murder' },
                                                            { value: 'performance' },
                                                            { value: 'stealth' },
                                                            { value: 'streetwise' },
                                                            { value: 'subterfuge' }
                                                        ]
                                                    },
                                                    {
                                                        display: 'Crafting skills', type: 'group', items: [
                                                            { value: 'artistry' },
                                                            { value: 'blacksmithing' },
                                                            { value: 'brewing' },
                                                            { value: 'cooking' },
                                                            { value: 'crafting' },
                                                            { value: 'glasssmithing' },
                                                            { value: 'leathering' },
                                                            { value: 'sewing' },
                                                            { value: 'stonemasonry' },
                                                            { value: 'woodworking' }
                                                        ]
                                                    },
                                                    {
                                                        display: 'Discipline skills', type: 'group', items: [
                                                            { value: 'discipline' },
                                                            { value: 'kicks' },
                                                            { value: 'mind' },
                                                            { value: 'punches' },
                                                            { value: 'sweeps' },
                                                            { value: 'throws' }
                                                        ]
                                                    },
                                                    {
                                                        display: 'Combat skills', type: 'group', items: [
                                                            { value: 'archery' },
                                                            { value: 'armour' },
                                                            { value: 'attack' },
                                                            { value: 'defense' },
                                                            { value: 'double wielding' },
                                                            { value: 'shield' },
                                                            { value: 'tactics' },
                                                            { value: 'thrown' },
                                                            { value: 'two-handed' },
                                                            { value: 'weapons' }
                                                        ]
                                                    },
                                                    {
                                                        display: 'Faith skills', type: 'group', items: [
                                                            { value: 'combat' },
                                                            { value: 'death' },
                                                            { value: 'elements' },
                                                            { value: 'faith' },
                                                            { value: 'knowledge' },
                                                            { value: 'life' },
                                                            { value: 'nature' },
                                                            { value: 'protection' }
                                                        ]
                                                    },
                                                    {
                                                        display: 'Resistances',
                                                        type: 'group',
                                                        items: [
                                                            { value: 'air' },
                                                            { value: 'acid' },
                                                            { value: 'fire' },
                                                            { value: 'ice' },
                                                            { value: 'cold' },
                                                            { value: 'lightning' },
                                                            { value: 'rock' },
                                                            { value: 'water' },
                                                            { value: 'poison' }
                                                        ]
                                                    }
                                                ]
                                                */
                                            }
                                        }
                                    },
                                    {
                                        label: 'Amount',
                                        field: 'amount',
                                        width: 150,
                                        spring: true,
                                        editor: {
                                            type: EditorType.dropdown,
                                            options: {
                                                /*
                                                data: [
                                                    'small',
                                                    'respectable',
                                                    'large'
                                                ]
                                                */
                                            }
                                        }
                                    }
                                ],
                                add: (e) => {
                                    e.data = {
                                        type: 0,
                                        adjust: '',
                                        amount: ''
                                    };
                                },
                                hidden: e => {
                                    /*
                                    const stats = ['charisma', 'constitution', 'dexterity', 'intelligence', 'strength', 'wisdom'];
                                    const skills = ['axe', 'blunt', 'flail', 'knife', 'large sword', 'melee', 'miscellaneous', 'missile', 'polearm', 'small sword', 'spear', 'staff', 'climbing', 'fishing', 'mining', 'riding', 'survival', 'conjuring', 'elementals', 'magic', 'necromancy', 'planes', 'sorcery', 'acrobatics', 'devices', 'murder', 'performance', 'stealth', 'streetwise', 'subterfuge', 'artistry', 'blacksmithing', 'brewing', 'cooking', 'crafting', 'glasssmithing', 'leathering', 'sewing', 'stonemasonry', 'woodworking', 'discipline', 'kicks', 'mind', 'punches', 'sweeps', 'throws', 'archery', 'armour', 'attack', 'defense', 'double wielding', 'shield', 'tactics', 'thrown', 'two-handed', 'weapons', 'combat', 'death', 'elements', 'faith', 'knowledge', 'life', 'nature', 'protection'];
                                    e.page.dataGrid.rows.forEach((r, i) => {
                                        if (r.type === 1) {
                                            if (r.adjust && r.adjust.length !== 0 && stats.indexOf(r.adjust) === -1) {
                                                (<HTMLElement>$(`[data-data-index=${i}]`, e.page.dataGrid.parent)[0].children[1]).title = 'Invalid stat';
                                                $($(`[data-data-index=${i}]`, e.page.dataGrid.parent)[0].children[1]).tooltip({ container: '#object-wizard .dialog-body', delay: { show: 100, hide: 250 } }).tooltip('show');
                                                e.preventDefault = true;
                                            }
                                            else
                                                (<HTMLElement>$(`[data-data-index=${i}]`, e.page.dataGrid.parent)[0].children[1]).title = r.adjust;
                                        }
                                        else if (r.type === 2) {
                                            if (r.adjust && r.adjust.length !== 0 && skills.indexOf(r.adjust) === -1) {
                                                (<HTMLElement>$(`[data-data-index=${i}]`, e.page.dataGrid.parent)[0].children[1]).title = 'Invalid skill';
                                                $($(`[data-data-index=${i}]`, e.page.dataGrid.parent)[0].children[1]).tooltip({ container: '#object-wizard .dialog-body', delay: { show: 100, hide: 250 } }).tooltip('show');
                                                e.preventDefault = true;
                                            }
                                            else
                                                (<HTMLElement>$(`[data-data-index=${i}]`, e.page.dataGrid.parent)[0].children[1]).title = r.adjust;
                                        }
                                    });
                                    */
                                },
                                enterMoveFirst: this.$enterMoveFirst,
                                enterMoveNext: this.$enterMoveNext,
                                enterMoveNew: this.$enterMoveNew
                            });
                            const wizSkills = new WizardDataGridPage({
                                title: 'Skill requirements',
                                id: 'obj-skills',
                                clipboard: 'jiMUD/',
                                columns: [
                                    {
                                        label: 'Type',
                                        field: 'type',
                                        width: 150,
                                        formatter: (data) => {
                                            if (!data) return '';
                                            switch (+data.cell) {
                                                case 0:
                                                    return 'Skill';
                                                case 1:
                                                    return 'Level';
                                            }
                                            return '';
                                        },
                                        tooltipFormatter: (data) => {
                                            if (!data) return '';
                                            switch (+data.cell) {
                                                case 0:
                                                    return 'Skill';
                                                case 1:
                                                    return 'Level';
                                            }
                                            return '';
                                        },
                                        editor: {
                                            type: EditorType.select,
                                            options: {
                                                data: [
                                                    { display: 'Skill', value: 0 },
                                                    { display: 'Level', value: 1 }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        label: 'Class',
                                        field: 'class',
                                        width: 150,
                                        formatter: (data) => {
                                            if (!data) return '';
                                            switch (+data.cell) {
                                                case 0:
                                                    return 'All';
                                                case 1:
                                                    return 'Fighter';
                                                case 2:
                                                    return 'Monk';
                                                case 3:
                                                    return 'Mage';
                                                case 4:
                                                    return 'Rogue';
                                                case 5:
                                                    return 'Cleric';
                                            }
                                            return '';
                                        },
                                        tooltipFormatter: (data) => {
                                            if (!data) return '';
                                            switch (+data.cell) {
                                                case 0:
                                                    return 'All';
                                                case 1:
                                                    return 'Fighter';
                                                case 2:
                                                    return 'Monk';
                                                case 3:
                                                    return 'Mage';
                                                case 4:
                                                    return 'Rogue';
                                                case 5:
                                                    return 'Cleric';
                                            }
                                            return '';
                                        },
                                        editor: {
                                            type: EditorType.select,
                                            options: {
                                                data: [
                                                    { display: 'All', value: 0 },
                                                    { display: 'Fighter', value: 1 },
                                                    { display: 'Monk', value: 2 },
                                                    { display: 'Mage', value: 3 },
                                                    { display: 'Rogue', value: 4 },
                                                    { display: 'Cleric', value: 5 }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        label: 'Amount',
                                        field: 'amount',
                                        width: 150
                                    },
                                    {
                                        label: 'Message',
                                        field: 'message',
                                        width: 150,
                                        spring: true,
                                        editor: {
                                            options: {
                                                singleLine: true
                                            }
                                        }
                                    }
                                ],
                                add: (e) => {
                                    e.data = {
                                        type: 0,
                                        class: 0,
                                        amount: 0,
                                        message: ''
                                    };
                                },
                                enterMoveFirst: this.$enterMoveFirst,
                                enterMoveNext: this.$enterMoveNext,
                                enterMoveNew: this.$enterMoveNew
                            });
                            const wiz = new Wizard({
                                id: 'object-wizard',
                                title: 'Edit object...',
                                pages: [
                                    new WizardPage({
                                        id: 'obj-welcome',
                                        title: 'Welcome',
                                        body: `
                                        <img src="../assets/icons/png/wiz.obj.logo.png" alt="Welcome to the object wizard" style="float: left;padding-top: 81px;">
                                        <div style="padding-top:96px">Welcome to the object editor wizard, this will take you through the steps to edit an object quickly and easily. You may finish at any time to save your current selections.</div>
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
                                            <textarea class="input-sm form-control" id="obj-long" style="width: 100%;height: 266px;"></textarea>
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-long').value = ed.value.long || '';
                                        }
                                    }),
                                    new WizardPage({
                                        id: 'obj-general',
                                        title: 'General properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%">Key ID
                                            <input type="text" class="input-sm form-control" id="obj-keyID" />
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Mass
                                            <input type="number" id="obj-mass" class="input-sm form-control" min="0" value="1000" />
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
                                                    <ul id="obj-material-list" style="max-height: 200px;" class="dropdown-menu pull-right" aria-labelledby="btn-obj-material" data-container="body">
                                                    </ul>
                                                </span>
                                            </div>
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0">Required for all but basic object</span>
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Value
                                            <input type="number" id="obj-value" class="input-sm form-control" min="0" value="1000000000" />
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0">A value of 0 will use default value</span>
                                        </label>
                                    </div>
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label">
                                            <input type="checkbox" id="obj-bait" /> Is fishing bait <hr style="width: 72%;float: right;margin-top: 12px;margin-bottom: 0px;">
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Bait strength
                                            <input type="number" id="obj-baitStrength" class="input-sm form-control" min="0" value="200" disabled="disabled"/>
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Bait uses
                                            <input type="number" id="obj-baitUses" class="input-sm form-control" min="0" value="100"  disabled="disabled"/>
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-keyID').value = ed.value.keyID || '';
                                            e.page.querySelector('#obj-mass').value = ed.value.mass || '0';
                                            e.page.querySelector('#obj-value').value = ed.value.value || '0';
                                            e.page.querySelector('#obj-material').value = ed.value.material || '';
                                            if (ty === StdObjectType.food || ty === StdObjectType.object) {
                                                e.page.querySelector('#obj-bait').parentElement.parentElement.style.display = '';
                                                e.page.querySelector('#obj-baitStrength').parentElement.parentElement.style.display = '';
                                                e.page.querySelector('#obj-baitUses').parentElement.parentElement.style.display = '';
                                            }
                                            else {
                                                e.page.querySelector('#obj-bait').parentElement.parentElement.style.display = 'none';
                                                e.page.querySelector('#obj-baitStrength').parentElement.parentElement.style.display = 'none';
                                                e.page.querySelector('#obj-baitUses').parentElement.parentElement.style.display = 'none';
                                            }
                                            e.page.querySelector('#obj-bait').checked = ed.value.bait || false;
                                            e.page.querySelector('#obj-baitStrength').value = ed.value.baitStrength || '1';
                                            e.page.querySelector('#obj-baitUses').value = ed.value.baitUses || '5';
                                            e.page.querySelector('#obj-baitStrength').disabled = !ed.value.bait;
                                            e.page.querySelector('#obj-baitUses').disabled = !ed.value.bait;
                                            e.page.querySelector('#obj-bait').addEventListener('change', e2 => {
                                                e.page.querySelector('#obj-baitStrength').disabled = !e.page.querySelector('#obj-bait').checked;
                                                e.page.querySelector('#obj-baitUses').disabled = !e.page.querySelector('#obj-bait').checked;
                                            });
                                        }
                                    }),
                                    new WizardDataGridPage({
                                        title: 'Custom properties',
                                        id: 'obj-properties',
                                        clipboard: 'jiMUD/',
                                        columns: [
                                            {
                                                label: 'Type',
                                                field: 'type',
                                                width: 150,
                                                editor: {
                                                    type: EditorType.select,
                                                    options: {
                                                        data: [
                                                            { value: 0, display: 'normal' },
                                                            { value: 1, display: 'temporary' }
                                                        ]
                                                    }
                                                },
                                                formatter: (data) => {
                                                    if (!data) return '';
                                                    switch (data.cell) {
                                                        case 0:
                                                            return 'normal';
                                                        case 1:
                                                            return 'temporary';
                                                    }
                                                    return '';
                                                },
                                                tooltipFormatter: (data) => {
                                                    if (!data) return '';
                                                    switch (data.cell) {
                                                        case 0:
                                                            return 'normal';
                                                        case 1:
                                                            return 'temporary';
                                                    }
                                                    return '';
                                                }
                                            },
                                            {
                                                label: 'Name',
                                                field: 'name',
                                                width: 150,
                                                editor: {
                                                    type: EditorType.dropdown,
                                                    options: {
                                                        container: '#object-wizard',
                                                        data: [
                                                            'magic effect', 'lore', 'magic item', 'crafting quality',
                                                            'dig', 'break remove', 'mining', 'check skill', 'check level'
                                                        ]
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Value',
                                                field: 'value',
                                                spring: true,
                                                width: 200,
                                                editor: {
                                                    options: {
                                                        container: '#object-wizard'
                                                    }
                                                }
                                            }
                                        ],
                                        add: (e) => {
                                            e.data = {
                                                type: 1,
                                                name: '',
                                                value: ''
                                            };
                                        }
                                    }),
                                    new WizardPage({
                                        id: 'obj-prevent-actions',
                                        title: 'Prevent actions',
                                        body: `<div class="col-sm-12 form-group">
                                            <label class="control-label" style="width: 100%">Prevent offer
                                                <input type="text" class="input-sm form-control" id="obj-preventOffer" placeholder="1, true, a string to display, or a function pointer"/>
                                            </label>
                                        </div>
                                        <div class="col-sm-12 form-group">
                                            <label class="control-label" style="width: 100%">Prevent get
                                                <input type="text" class="input-sm form-control" id="obj-preventGet" placeholder="1, true, a string to display, or a function pointer"/>
                                            </label>
                                        </div>
                                        <div class="col-sm-12 form-group">
                                            <label class="control-label" style="width: 100%">Prevent drop
                                                <input type="text" class="input-sm form-control" id="obj-preventDrop" placeholder="1, true, a string to display, or a function pointer"/>
                                            </label>
                                        </div>
                                        <div class="col-sm-12 form-group">
                                            <label class="control-label" style="width: 100%">Prevent put
                                                <input type="text" class="input-sm form-control" id="obj-preventPut" placeholder="1, true, a string to display, or a function pointer"/>
                                            </label>
                                        </div>
                                        <div class="col-sm-12 form-group">
                                            <label class="control-label" style="width: 100%">Prevent steal
                                                <input type="text" class="input-sm form-control" id="obj-preventSteal" placeholder="1, true, a string to display, or a function pointer"/>
                                            </label>
                                        </div>
                                    `,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-preventOffer').value = ed.value.preventOffer || '';
                                            e.page.querySelector('#obj-preventGet').value = ed.value.preventGet || '';
                                            e.page.querySelector('#obj-preventDrop').value = ed.value.preventDrop || '';
                                            e.page.querySelector('#obj-preventPut').value = ed.value.preventPut || '';
                                            e.page.querySelector('#obj-preventSteal').value = ed.value.preventSteal || '';
                                        }
                                    }),
                                    new WizardDataGridPage({
                                        title: 'Reads',
                                        id: 'obj-reads',
                                        clipboard: 'jiMUD/',
                                        columns: [
                                            {
                                                label: 'Read',
                                                field: 'read',
                                                width: 150,
                                                editor: {
                                                    options: {
                                                        container: '#object-wizard',
                                                        singleLine: true
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Description',
                                                field: 'description',
                                                spring: true,
                                                width: 200,
                                                editor: {
                                                    options: {
                                                        container: '#object-wizard'
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Language',
                                                field: 'language',
                                                width: 200,
                                                editor: {
                                                    type: EditorType.dropdown,
                                                    options: {
                                                        container: '#object-wizard',
                                                        data: [
                                                            //spellchecker:disable
                                                            'eltherian', 'ersi', 'jhlorim', 'malkierien', 'common',
                                                            'draconic', 'elcharean', 'tangetto', 'terrakarn', 'gobbledegook',
                                                            'malkierien', 'loyavenku', 'caninen', 'draconic', 'nibelungen',
                                                            'wulinaxin', 'shangtai', 'farsi', 'nymal'
                                                            //spellchecker:enable
                                                        ]
                                                    }
                                                }
                                            }
                                        ],
                                        add: (e) => {
                                            e.data = {
                                                read: '',
                                                description: '',
                                                language: ''
                                            };
                                        }
                                    })
                                ]
                            });
                            wiz.defaults = {
                                'obj-reads': ed.value.reads,
                                'obj-properties': ed.value.properties
                            };
                            wiz.pages[3].page.querySelector('#obj-material-list').innerHTML = '<li><a href="#">' + fs.readFileSync(parseTemplate(path.join('{assets}', 'editor', 'material.lst')), 'utf8').replace(/\r\n|\n|\r/g, '</a></li><li><a href="#">') + '</a></li>';
                            initEditDropdown(wiz.pages[3].page.querySelector('#obj-material-list').closest('.edit-dropdown'));
                            wiz.height = '390px';
                            wiz.on('open', () => {
                                this.emit('dialog-open');
                                ed.focus();
                            });
                            wiz.on('close', () => {
                                this.emit('dialog-close');
                                wiz.destroy();
                                ed.focus();
                            });
                            wiz.on('cancel', () => {
                                this.emit('dialog-cancel');
                                wiz.destroy();
                                ed.focus();
                            });
                            wiz.on('finished', (e) => {
                                if (ed.editors) {
                                    ed.editors[0].editor.value = e.data['obj-name'];
                                    ed.editors[1].editor.value = e.data['obj-short'];
                                }
                                const nObject = ed.value.clone();
                                for (const prop in e.data) {
                                    if (!e.data.hasOwnProperty(prop)) continue;
                                    if (Array.isArray(e.data[prop]))
                                        nObject[prop.substr(4)] = e.data[prop];
                                    else if (typeof e.data[prop] === 'object')
                                        nObject[prop.substr(4)] = e.data[prop].value;
                                    else
                                        nObject[prop.substr(4)] = e.data[prop];
                                }
                                if (!nObject.equals(ed.data.object))
                                    ed.value = nObject;
                                ed.focus();
                            });
                            const qualities = `<div class="col-sm-12 form-group">
                            <label class="control-label" style="width: 100%;">Quality
                                <select id="obj-quality" class="form-control selectpicker" data-size="8" data-style="btn-default btn-sm" data-width="100%">
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
                                    wiz.defaults['obj-bonuses'] = ed.value.bonuses || [];
                                    wiz.defaults['obj-damaged'] = ed.value.damaged || [];
                                    wiz.defaults['obj-skills'] = ed.value.skills || [];
                                    wiz.title = 'Edit sheath...';
                                    //type, quality, limbs, enchantment
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-armor',
                                        title: 'Sheath properties',
                                        body: `<div class="col-sm-12 form-group">
                                            <label class="control-label" style="width: 100%;">Type
                                                <select id="obj-subType" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                                    <optgroup label="accessory"><option value="accessory">Accessory</option><option value="jewelry">Jewelry</option><option value="sheath">Sheath</option></optgroup><optgroup label="clothing"><option value="clothing">Clothing</option><option value="thin clothing">Thin clothing</option></optgroup><optgroup label="heavy"><option value="bandedmail">Banded mail</option><option value="full platemail">Full platemail</option><option value="platemail">Platemail</option><option value="splintmail">Splintmail</option></optgroup><optgroup label="light"><option value="hard leather">Hard leather</option><option value="heavy clothing">Heavy clothing</option><option value="padded leather">Padded leather</option><option value="soft leather">Soft leather</option><option value="studded leather">Studded leather</option></optgroup><optgroup label="medium"><option value="brigandine">Brigandine</option><option value="chainmail">Chainmail</option><option value="ringmail">Ring mail</option><option value="scalemail">Scalemail</option></optgroup><optgroup label="overclothing"><option value="heavy overclothing">Heavy over clothing</option><option value="overclothing">Over clothing</option><option value="thin overclothing">Thin over clothing</option></optgroup><optgroup label="underclothing"><option value="underclothing">Under clothing</option></optgroup>
                                                </select>
                                            </label>
                                        </div>
                                        <div class="col-sm-12 form-group">
                                            <label class="control-label">Limbs
                                                <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A comma delimited list of limbs, ctrl+click to append</span>
                                                <div class="input-group edit-dropdown" data-multiple="true">
                                                    <input type="text" id="obj-limbs" class="input-sm form-control">
                                                    <span class="input-group-btn">
                                                        <button id="btn-obj-limbs" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                            <span class="caret" style="margin-left: -1px;"></span>
                                                        </button>
                                                        <ul id="obj-limbs-list" style="max-height: 200px;" class="dropdown-menu pull-right" aria-labelledby="btn-obj-limbs" data-container="body">
                                                            <li><a href="#">All limbs</a></li><li><a href="#">Overall</a></li><li><a href="#">Limb only</a></li><li><a href="#">Torso</a></li><li><a href="#">Head</a></li><li><a href="#">Left arm</a></li><li><a href="#">Right arm</a></li><li><a href="#">Left hand</a></li><li><a href="#">Right hand</a></li><li><a href="#">Left leg</a></li><li><a href="#">Right leg</a></li><li><a href="#">Left foot</a></li><li><a href="#">Right foot</a></li><li><a href="#">Right wing</a></li><li><a href="#">Left wing</a></li><li><a href="#">Left hoof</a></li><li><a href="#">Right hoof</a></li><li><a href="#">Tail</a></li><li><a href="#">Arms</a></li><li><a href="#">Legs</a></li><li><a href="#">Hands</a></li><li><a href="#">Feet</a></li><li><a href="#">Wings</a></li><li><a href="#">Hooves</a></li><li><a href="#">Lower body</a></li><li><a href="#">Core body</a></li><li><a href="#">Upper core</a></li><li><a href="#">Upper body</a></li><li><a href="#">Winged core</a></li><li><a href="#">Winged upper</a></li><li><a href="#">Upper trunk</a></li><li><a href="#">Lower trunk</a></li><li><a href="#">Trunk</a></li><li><a href="#">Winged trunk</a></li><li><a href="#">Full body</a></li><li><a href="#">Total body</a></li><li><a href="#">Winged body</a></li>
                                                        </ul>
                                                    </span>
                                                </div>
                                            </label>
                                        </div>${qualities.replace('col-sm-12', 'col-sm-6').replace('data-size="8"', 'data-size="6"')}
                                        <div class="col-sm-6 form-group">
                                                <label class="control-label" style="width: 100%;">Weapon type
                                                    <select id="obj-wType" class="form-control selectpicker" data-size="6" data-style="btn-default btn-sm" data-width="100%">
                                                    <optgroup label="Axe"><option value="axe">Axe</option><option value="battle axe">Battle axe</option><option value="great axe">Great axe</option><option value="hand axe">Hand axe</option><option value="mattock">Mattock</option><option value="wood axe">Wood axe</option></optgroup><optgroup label="Blunt"><option value="club">Club</option><option value="hammer">Hammer</option><option value="mace">Mace</option><option value="maul">Maul</option><option value="morningstar">Morningstar</option><option value="spiked club">Spiked club</option><option value="warhammer">Warhammer</option></optgroup><optgroup label="Flail"><option value="ball and chain">Ball and chain</option><option value="chain">Chain</option><option value="flail">Flail</option><option value="whip">Whip</option></optgroup><optgroup label="Knife"><option value="dagger">Dagger</option><option value="dirk">Dirk</option><option value="knife">Knife</option><option value="kris">Kris</option><option value="stiletto">Stiletto</option><option value="tanto">Tanto</option></optgroup><optgroup label="Large sword"><option value="bastard sword">Bastard sword</option><option value="claymore">Claymore</option><option value="flamberge">Flamberge</option><option value="large sword">Large sword</option><option value="nodachi">Nodachi</option></optgroup><optgroup label="Melee"><option value="brass knuckles">Brass knuckles</option><option value="melee">Melee</option><option value="tekagi-shuko">Tekagi-shuko</option><option value="tekko">Tekko</option></optgroup><optgroup label="Miscellaneous"><option value="cord">Cord</option><option value="fan">Fan</option><option value="giant fan">Giant fan</option><option value="miscellaneous">Miscellaneous</option><option value="war fan">War fan</option></optgroup><optgroup label="Polearm"><option value="bardiche">Bardiche</option><option value="glaive">Glaive</option><option value="halberd">Halberd</option><option value="poleaxe">Poleaxe</option><option value="scythe">Scythe</option></optgroup><optgroup label="Small sword"><option value="broadsword">Broadsword</option><option value="katana">Katana</option><option value="long sword">Long sword</option><option value="rapier">Rapier</option><option value="scimitar">Scimitar</option><option value="short sword">Short sword</option><option value="small sword">Small sword</option><option value="wakizashi">Wakizashi</option></optgroup><optgroup label="Spear"><option value="arrow">Arrow</option><option value="javelin">Javelin</option><option value="lance">Lance</option><option value="long spear">Long spear</option><option value="pike">Pike</option><option value="pilum">Pilum</option><option value="short spear">Short spear</option><option value="spear">Spear</option><option value="trident">Trident</option></optgroup><optgroup label="Staff"><option value="battle staff">Battle staff</option><option value="bo">Bo</option><option value="quarterstaff">Quarterstaff</option><option value="staff">Staff</option><option value="wand">Wand</option><option value="warstaff">Warstaff</option></optgroup>
                                                    </select>
                                                </label>
                                            </div>
                                        <div class="form-group col-sm-6">
                                            <label class="control-label">
                                                Enchantment
                                                <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                            </label>
                                        </div>
                                        <div class="col-sm-6 form-group">
                                            <label class="control-label">
                                                Max wearable
                                                <input type="number" id="obj-maxWearable" class="input-sm form-control" min="0" value="10" />
                                                <span class="help-block" style="font-size: 0.8em;margin:0;padding:0">0 is unlimited</span>
                                            </label>
                                        </div>
                                        <div class="col-sm-6 form-group">
                                            <label class="control-label">
                                                <input type="checkbox" id="obj-limbsOptional" /> Limbs optional
                                            </label>
                                        </div>`,
                                        reset: (e) => {
                                            $(e.page.querySelector('#obj-subType')).val(ed.value.subType || 'sheath').selectpicker('render');
                                            $(e.page.querySelector('#obj-wType')).val(ed.value.wType || 'knife').selectpicker('render');
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-limbs').value = ed.value.limbs || '';
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                            e.page.querySelector('#obj-maxWearable').value = ed.value.maxWearable || '0';
                                            e.page.querySelector('#obj-limbsOptional').checked = ed.value.limbsOptional || false;
                                            initEditDropdown(e.page.querySelector('#obj-limbs-list').closest('.edit-dropdown'));
                                        }
                                    }), new WizardDataGridPage({
                                        title: 'Damaged armor descriptions',
                                        id: 'obj-damaged',
                                        clipboard: 'jiMUD/',
                                        columns: [
                                            {
                                                label: 'Type',
                                                field: 'type',
                                                width: 75,
                                                formatter: (data) => {
                                                    if (!data) return '';
                                                    switch (+data.cell) {
                                                        case 0:
                                                            return 'Name';
                                                        case 1:
                                                            return 'Short';
                                                        case 2:
                                                            return 'Long';
                                                        case 3:
                                                            return 'Nouns';
                                                        case 4:
                                                            return 'Adjectives';
                                                        case 5:
                                                            return 'ID';
                                                    }
                                                    return '';
                                                },
                                                tooltipFormatter: (data) => {
                                                    if (!data) return '';
                                                    switch (+data.cell) {
                                                        case 0:
                                                            return 'Name';
                                                        case 1:
                                                            return 'Short';
                                                        case 2:
                                                            return 'Long';
                                                        case 3:
                                                            return 'Nouns';
                                                        case 4:
                                                            return 'Adjectives';
                                                        case 5:
                                                            return 'ID';
                                                    }
                                                    return '';
                                                },
                                                editor: {
                                                    type: EditorType.select,
                                                    options: {
                                                        data: [
                                                            { display: 'name', value: 0 },
                                                            { display: 'short', value: 1 },
                                                            { display: 'long', value: 2 },
                                                            { display: 'nouns', value: 3 },
                                                            { display: 'adjectives', value: 4 },
                                                            { display: 'id', value: 5 }
                                                        ]
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Limbs',
                                                field: 'limbs',
                                                width: 150,
                                                spring: true,
                                                editor: {
                                                    type: EditorType.dropdown,
                                                    options: {
                                                        data: [
                                                            'both arms and legs',
                                                            'both arms',
                                                            'both legs',
                                                            'right arm',
                                                            'left arm',
                                                            'right leg',
                                                            'left leg',
                                                            'both hands and feet',
                                                            'left hand',
                                                            'right hand',
                                                            'both feet',
                                                            'left foot',
                                                            'right foot',
                                                            'head',
                                                            'both hooves',
                                                            'left hoof',
                                                            'right hoof',
                                                            'both wings',
                                                            'right wing',
                                                            'left wing',
                                                            'tail'
                                                        ]
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Description',
                                                field: 'description',
                                                width: 150,
                                                editor: {
                                                    options: {
                                                        dialog: true,
                                                        fancy: true,
                                                        title: 'Edit description&hellip;',
                                                        singleLine: true,
                                                        container: '#object-wizard'
                                                    }
                                                }
                                            }
                                        ],
                                        add: (e) => {
                                            e.data = {
                                                type: 0,
                                                limbs: '',
                                                description: ''
                                            };
                                        },
                                        enterMoveFirst: this.$enterMoveFirst,
                                        enterMoveNext: this.$enterMoveNext,
                                        enterMoveNew: this.$enterMoveNew
                                    }), wizSkills, wizBonuses]);
                                    break;
                                case StdObjectType.armor:
                                case StdObjectType.armor_of_holding:
                                    wiz.defaults['obj-bonuses'] = ed.value.bonuses || [];
                                    wiz.defaults['obj-damaged'] = ed.value.damaged || [];
                                    wiz.defaults['obj-skills'] = ed.value.skills || [];
                                    wiz.title = 'Edit armor...';
                                    //type, quality, limbs, enchantment
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-armor',
                                        title: 'Armor properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%;">Type
                                            <select id="obj-subType" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                                <optgroup label="accessory"><option value="accessory">Accessory</option><option value="jewelry">Jewelry</option><option value="sheath">Sheath</option></optgroup><optgroup label="clothing"><option value="clothing">Clothing</option><option value="thin clothing">Thin clothing</option></optgroup><optgroup label="heavy"><option value="bandedmail">Banded mail</option><option value="full platemail">Full platemail</option><option value="platemail">Platemail</option><option value="splintmail">Splint mail</option></optgroup><optgroup label="light"><option value="hard leather">Hard leather</option><option value="heavy clothing">Heavy clothing</option><option value="padded leather">Padded leather</option><option value="soft leather">Soft leather</option><option value="studded leather">Studded leather</option></optgroup><optgroup label="medium"><option value="brigandine">Brigandine</option><option value="chainmail">Chain mail</option><option value="ringmail">Ring mail</option><option value="scalemail">Scale mail</option></optgroup><optgroup label="overclothing"><option value="heavy overclothing">Heavy overclothing</option><option value="overclothing">Overclothing</option><option value="thin overclothing">Thin overclothing</option></optgroup><optgroup label="underclothing"><option value="underclothing">Underclothing</option></optgroup>
                                            </select>
                                        </label>
                                    </div>
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label">Limbs
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A comma delimited list of limbs, ctrl+click to append</span>
                                            <div class="input-group edit-dropdown" data-multiple="true">
                                                <input type="text" id="obj-limbs" class="input-sm form-control">
                                                <span class="input-group-btn">
                                                    <button id="btn-obj-limbs" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <span class="caret" style="margin-left: -1px;"></span>
                                                    </button>
                                                    <ul id="obj-limbs-list" style="max-height: 200px;" class="dropdown-menu pull-right" aria-labelledby="btn-obj-limbs" data-container="body">
                                                        <li><a href="#">All limbs</a></li><li><a href="#">Overall</a></li><li><a href="#">Limb only</a></li><li><a href="#">Torso</a></li><li><a href="#">Head</a></li><li><a href="#">Left arm</a></li><li><a href="#">Right arm</a></li><li><a href="#">Left hand</a></li><li><a href="#">Right hand</a></li><li><a href="#">Left leg</a></li><li><a href="#">Right leg</a></li><li><a href="#">Left foot</a></li><li><a href="#">Right foot</a></li><li><a href="#">Right wing</a></li><li><a href="#">Left wing</a></li><li><a href="#">Left hoof</a></li><li><a href="#">Right hoof</a></li><li><a href="#">Tail</a></li><li><a href="#">Arms</a></li><li><a href="#">Legs</a></li><li><a href="#">Hands</a></li><li><a href="#">Feet</a></li><li><a href="#">Wings</a></li><li><a href="#">Hooves</a></li><li><a href="#">Lower body</a></li><li><a href="#">Core body</a></li><li><a href="#">Upper core</a></li><li><a href="#">Upper body</a></li><li><a href="#">Winged core</a></li><li><a href="#">Winged upper</a></li><li><a href="#">Upper trunk</a></li><li><a href="#">Lower trunk</a></li><li><a href="#">Trunk</a></li><li><a href="#">Winged trunk</a></li><li><a href="#">Full body</a></li><li><a href="#">Total body</a></li><li><a href="#">Winged body</a></li>
                                                    </ul>
                                                </span>
                                            </div>
                                        </label>
                                    </div>${qualities.replace('data-size="8"', 'data-size="6"')}
                                    <div class="form-group col-sm-6">
                                        <label class="control-label">
                                            Enchantment
                                            <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Max wearable
                                            <input type="number" id="obj-maxWearable" class="input-sm form-control" min="0" value="10" />
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0">0 is unlimited</span>
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            <input type="checkbox" id="obj-limbsOptional" /> Limbs optional
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            $(e.page.querySelector('#obj-subType')).val(ed.value.subType || 'accessory').selectpicker('render');
                                            e.page.querySelector('#obj-limbs').value = ed.value.limbs || '';
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                            e.page.querySelector('#obj-maxWearable').value = ed.value.maxWearable || '0';
                                            e.page.querySelector('#obj-limbsOptional').checked = ed.value.limbsOptional || false;
                                            initEditDropdown(e.page.querySelector('#obj-limbs-list').closest('.edit-dropdown'));
                                        }
                                    }), new WizardDataGridPage({
                                        title: 'Damaged armor descriptions',
                                        id: 'obj-damaged',
                                        clipboard: 'jiMUD/',
                                        columns: [
                                            {
                                                label: 'Type',
                                                field: 'type',
                                                width: 75,
                                                formatter: (data) => {
                                                    if (!data) return '';
                                                    switch (+data.cell) {
                                                        case 0:
                                                            return 'name';
                                                        case 1:
                                                            return 'short';
                                                        case 2:
                                                            return 'long';
                                                        case 3:
                                                            return 'nouns';
                                                        case 4:
                                                            return 'adjectives';
                                                    }
                                                    return '';
                                                },
                                                tooltipFormatter: (data) => {
                                                    if (!data) return '';
                                                    switch (+data.cell) {
                                                        case 0:
                                                            return 'name';
                                                        case 1:
                                                            return 'short';
                                                        case 2:
                                                            return 'long';
                                                        case 3:
                                                            return 'nouns';
                                                        case 4:
                                                            return 'adjectives';
                                                    }
                                                    return '';
                                                },
                                                editor: {
                                                    type: EditorType.select,
                                                    options: {
                                                        data: [
                                                            { display: 'name', value: 0 },
                                                            { display: 'short', value: 1 },
                                                            { display: 'long', value: 2 },
                                                            { display: 'nouns', value: 3 },
                                                            { display: 'adjectives', value: 4 }
                                                        ]
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Limbs',
                                                field: 'limbs',
                                                width: 150,
                                                spring: true,
                                                editor: {
                                                    type: EditorType.dropdown,
                                                    options: {
                                                        data: [
                                                            'both arms and legs',
                                                            'both arms',
                                                            'both legs',
                                                            'right arm',
                                                            'left arm',
                                                            'right leg',
                                                            'left leg',
                                                            'both hands and feet',
                                                            'left hand',
                                                            'right hand',
                                                            'both feet',
                                                            'left foot',
                                                            'right foot',
                                                            'head',
                                                            'both hooves',
                                                            'left hoof',
                                                            'right hoof',
                                                            'both wings',
                                                            'right wing',
                                                            'left wing',
                                                            'tail'
                                                        ]
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Description',
                                                field: 'description',
                                                width: 150,
                                                editor: {
                                                    options: {
                                                        dialog: true,
                                                        fancy: true,
                                                        title: 'Edit description&hellip;',
                                                        singleLine: true,
                                                        container: '#object-wizard'
                                                    }
                                                }
                                            }
                                        ],
                                        add: (e) => {
                                            e.data = {
                                                type: 0,
                                                limbs: '',
                                                description: ''
                                            };
                                        },
                                        enterMoveFirst: this.$enterMoveFirst,
                                        enterMoveNext: this.$enterMoveNext,
                                        enterMoveNew: this.$enterMoveNew
                                    }), wizSkills, wizBonuses]);
                                    if (StdObjectType.armor_of_holding == ty) {
                                        wiz.insertPages(8, new WizardPage({
                                            id: 'obj-bag',
                                            title: 'Armor of holding properties',
                                            body: ` <div class="col-sm-6 form-group">
                                            <label class="control-label">
                                                Max encumbrance
                                                <input type="number" id="obj-encumbrance" class="input-sm form-control" min="0" value="100000000" />
                                            </label>
                                        </div>
                                        <div class="col-sm-6 form-group">
                                            <label class="control-label">
                                                Min encumbrance
                                                <input type="number" id="obj-minencumbrance" class="input-sm form-control" min="0" value="100" />
                                            </label>
                                        </div>
                                        <div class="col-sm-6 form-group">
                                            <label class="control-label">
                                                Max items
                                                <input type="number" id="obj-maxitems" class="input-sm form-control" min="0" value="100" />
                                            </label>
                                        </div>`,
                                            reset: (e) => {
                                                e.page.querySelector('#obj-encumbrance').value = ed.value.encumbrance || '40000';
                                                e.page.querySelector('#obj-minencumbrance').value = ed.value.minencumbranc || '500';
                                                e.page.querySelector('#obj-maxitems').value = ed.value.maxitems || '0';
                                            }
                                        }));
                                    }
                                    break;
                                case StdObjectType.chest:
                                    wiz.defaults['obj-contents'] = ed.value.contents || [];
                                    wiz.title = 'Edit chest...';
                                    //objects, money
                                    wiz.addPages([new WizardPage({
                                        title: 'Chest properties',
                                        id: 'obj-chest',
                                        body: `<div class="form-group col-sm-12">
                                        <label class="control-label">
                                            Blockers
                                            <input type="text" id="obj-blockers" class="input-sm form-control"/>
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Max encumbrance
                                            <input type="number" id="obj-encumbrance" class="input-sm form-control" min="0" value="100000000" />
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Lock strength
                                            <input type="number" id="obj-lock" class="input-sm form-control" min="0" value="100" />
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Reduce mass
                                            <input type="number" step="0.01" id="obj-reduce" class="input-sm form-control" min="0.0" value="2.0" />
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">Reduction formula: item mass * reduce</span>
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-blockers').value = ed.value.blockers || '';
                                            e.page.querySelector('#obj-encumbrance').value = ed.value.encumbrance || '10000';
                                            e.page.querySelector('#obj-lock').value = ed.value.lock || '0';
                                            e.page.querySelector('#obj-reduce').value = ed.value.reduce || '1.0';
                                        }
                                    }),
                                    new WizardDataGridPage({
                                        title: 'Chest contents',
                                        id: 'obj-contents',
                                        clipboard: 'jiMUD/',
                                        columns: [
                                            {
                                                label: 'Item',
                                                field: 'item',
                                                width: 150,
                                                formatter: (data) => {
                                                    if (!data) return '';
                                                    data.cell = +data.cell;
                                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                                        return stripPinkfish(this.$area.objects[data.cell].short);
                                                    switch (data.cell) {
                                                        case -1:
                                                            return 'common gem';
                                                        case -2:
                                                            return 'uncommon gem';
                                                        case -3:
                                                            return 'rare gem';
                                                        case -4:
                                                            return 'exceptional gem';
                                                        case -5:
                                                            return 'platinum';
                                                        case -6:
                                                            return 'gold';
                                                        case -7:
                                                            return 'electrum';
                                                        case -8:
                                                            return 'silver';
                                                        case -9:
                                                            return 'copper';
                                                    }
                                                    return '';
                                                },
                                                tooltipFormatter: (data) => {
                                                    if (!data) return '';
                                                    data.cell = +data.cell;
                                                    if (data.cell >= 0 && this.$area.objects[data.cell])
                                                        return this.$area.objects[data.cell].short;
                                                    switch (data.cell) {
                                                        case -1:
                                                            return 'common gem';
                                                        case -2:
                                                            return 'uncommon gem';
                                                        case -3:
                                                            return 'rare gem';
                                                        case -4:
                                                            return 'exceptional gem';
                                                        case -5:
                                                            return 'platinum';
                                                        case -6:
                                                            return 'gold';
                                                        case -7:
                                                            return 'electrum';
                                                        case -8:
                                                            return 'silver';
                                                        case -9:
                                                            return 'copper';
                                                    }
                                                    return '';
                                                },
                                                editor: {
                                                    type: EditorType.select,
                                                    options: {
                                                        data: [
                                                            { display: 'common gem', value: -1 },
                                                            { display: 'uncommon gem', value: -2 },
                                                            { display: 'rare gem', value: -3 },
                                                            { display: 'exceptional gem', value: -4 },
                                                            { display: 'platinum', value: -5 },
                                                            { display: 'gold', value: -6 },
                                                            { display: 'electrum', value: -7 },
                                                            { display: 'silver', value: -8 },
                                                            { display: 'copper', value: -9 }
                                                        ].concat(...Object.values<StdObject>(this.$area.objects).filter(o => o.id !== ed.value.id).map(o => {
                                                            return {
                                                                display: stripPinkfish(o.short || o.name),
                                                                value: o.id
                                                            };
                                                        }))
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Min amount',
                                                field: 'minAmount',
                                                width: 150
                                            },
                                            {
                                                label: 'Max amount',
                                                field: 'maxAmount',
                                                width: 150
                                            },
                                            {
                                                label: 'Random',
                                                field: 'random',
                                                width: 150,
                                                editor: {
                                                    options: {
                                                        min: 0,
                                                        max: 100
                                                    }
                                                }
                                            }
                                        ],
                                        add: (e) => {
                                            e.data = {
                                                item: 0,
                                                minAmount: 0,
                                                maxAmount: 0,
                                                random: 0
                                            };
                                        },
                                        enterMoveFirst: this.$enterMoveFirst,
                                        enterMoveNext: this.$enterMoveNext,
                                        enterMoveNew: this.$enterMoveNew
                                    })]);
                                    break;
                                case StdObjectType.material:
                                    wiz.defaults['obj-bonuses'] = ed.value.bonuses || [];
                                    wiz.title = 'Edit material...';
                                    //size, quality, describers
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-ore',
                                        title: 'Ore properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label">Size
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A number or predefined string</span>
                                            <div class="input-group edit-dropdown">
                                                <input type="text" id="obj-size" class="input-sm form-control">
                                                <span class="input-group-btn">
                                                    <button id="btn-obj-size" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <span class="caret" style="margin-left: -1px;"></span>
                                                    </button>
                                                    <ul id="obj-size-list" style="max-height: 200px;" class="dropdown-menu pull-right" aria-labelledby="btn-obj-size" data-container="body">
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
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-size').value = ed.value.size || '0';
                                            e.page.querySelector('#obj-describers').value = ed.value.describers || '';
                                            initEditDropdown(e.page.querySelector('#obj-size-list').closest('.edit-dropdown'));
                                        }
                                    }), wizBonuses]);
                                    break;
                                case StdObjectType.ore:
                                    wiz.defaults['obj-bonuses'] = ed.value.bonuses || [];
                                    wiz.title = 'Edit ore...';
                                    //size, quality, bonuses?
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-ore',
                                        title: 'Ore properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label">Size
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A number or predefined string</span>
                                            <div class="input-group edit-dropdown">
                                                <input type="text" id="obj-size" class="input-sm form-control">
                                                <span class="input-group-btn">
                                                    <button id="btn-obj-size" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <span class="caret" style="margin-left: -1px;"></span>
                                                    </button>
                                                    <ul id="obj-size-list" style="max-height: 200px;" class="dropdown-menu pull-right" aria-labelledby="btn-obj-size" data-container="body">
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
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-size').value = ed.value.size || '1';
                                            e.page.querySelector('#obj-describers').value = ed.value.describers || '';
                                            initEditDropdown(e.page.querySelector('#obj-size-list').closest('.edit-dropdown'));
                                        }
                                    }), wizBonuses]);
                                    break;
                                case StdObjectType.instrument:
                                    wiz.defaults['obj-bonuses'] = ed.value.bonuses || [];
                                    wiz.defaults['obj-skills'] = ed.value.skills || [];
                                    wiz.title = 'Edit instrument...';
                                    //type, quality, enchantment
                                    //spell-checker:disable
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-instrument',
                                        title: 'Instrument properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%;">Type
                                            <select id="obj-subType" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                            <option value="bagpipes">Bagpipes</option><option value="bell">Bell</option><option value="bladder pipe">Bladder pipe</option><option value="cornamuse">Cornamuse</option><option value="crumhorn">Crumhorn</option><option value="cymbal">Cymbal</option><option value="drum">Drum</option><option value="dulcian">Dulcian</option><option value="dulcimer">Dulcimer</option><option value="flute">Flute</option><option value="gamba">Gamba</option><option value="gemshorn">Gemshorn</option><option value="harp">Harp</option><option value="hirtenschalmei">Hirtenschalmei</option><option value="horn">Horn</option><option value="hurdy-gurdy">Hurdy-gurdy</option><option value="kortholt">Kortholt</option><option value="lizard">Lizard</option><option value="lute">Lute</option><option value="mute cornett">Mute cornett</option><option value="organetto">Organetto</option><option value="percussion">Percussion</option><option value="pipe and tabor">Pipe and tabor</option><option value="psaltery">Psaltery</option><option value="rackett">Rackett</option><option value="rauschpfeife">Rauschpfeife</option><option value="rebec">Rebec</option><option value="recorder">Recorder</option><option value="sacbut">Sacbut</option><option value="schalmei">Schalmei</option><option value="serpent">Serpent</option><option value="shawm">Shawm</option><option value="shofar">Shofar</option><option value="tambourine">Tambourine</option><option value="transverse flute">Transverse flute</option><option value="viol">Viol</option><option value="zink">Zink</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%;">Weapon type
                                            <select id="obj-wType" class="form-control selectpicker" data-size="8" data-style="btn-default btn-sm" data-width="100%">
                                            <option value="">Default</option><optgroup label="Axe"><option value="axe">Axe</option><option value="battle axe">Battle axe</option><option value="great axe">Great axe</option><option value="hand axe">Hand axe</option><option value="mattock">Mattock</option><option value="wood axe">Wood axe</option></optgroup><optgroup label="Blunt"><option value="club">Club</option><option value="hammer">Hammer</option><option value="mace">Mace</option><option value="maul">Maul</option><option value="morningstar">Morningstar</option><option value="spiked club">Spiked club</option><option value="warhammer">Warhammer</option></optgroup><optgroup label="Flail"><option value="ball and chain">Ball and chain</option><option value="chain">Chain</option><option value="flail">Flail</option><option value="whip">Whip</option></optgroup><optgroup label="Knife"><option value="dagger">Dagger</option><option value="dirk">Dirk</option><option value="knife">Knife</option><option value="kris">Kris</option><option value="stiletto">Stiletto</option><option value="tanto">Tanto</option></optgroup><optgroup label="Large sword"><option value="bastard sword">Bastard sword</option><option value="claymore">Claymore</option><option value="flamberge">Flamberge</option><option value="large sword">Large sword</option><option value="nodachi">Nodachi</option></optgroup><optgroup label="Melee"><option value="brass knuckles">Brass knuckles</option><option value="melee">Melee</option><option value="tekagi-shuko">Tekagi-shuko</option><option value="tekko">Tekko</option></optgroup><optgroup label="Miscellaneous"><option value="cord">Cord</option><option value="fan">Fan</option><option value="giant fan">Giant fan</option><option value="miscellaneous">Miscellaneous</option><option value="war fan">War fan</option></optgroup><optgroup label="Polearm"><option value="bardiche">Bardiche</option><option value="glaive">Glaive</option><option value="halberd">Halberd</option><option value="poleaxe">Poleaxe</option><option value="scythe">Scythe</option></optgroup><optgroup label="Small sword"><option value="broadsword">Broadsword</option><option value="katana">Katana</option><option value="long sword">Long sword</option><option value="rapier">Rapier</option><option value="scimitar">Scimitar</option><option value="short sword">Short sword</option><option value="small sword">Small sword</option><option value="wakizashi">Wakizashi</option></optgroup><optgroup label="Spear"><option value="javelin">Javelin</option><option value="lance">Lance</option><option value="long spear">Long spear</option><option value="pike">Pike</option><option value="pilum">Pilum</option><option value="short spear">Short spear</option><option value="spear">Spear</option><option value="trident">Trident</option></optgroup><optgroup label="Staff"><option value="battle staff">Battle staff</option><option value="bo">Bo</option><option value="quarterstaff">Quarterstaff</option><option value="staff">Staff</option><option value="wand">Wand</option><option value="warstaff">Warstaff</option></optgroup>
                                            </select>
                                        </label>
                                    </div>${qualities.replace('data-size="8"', 'data-size="6"')}
                                    <div class="form-group col-sm-12">
                                        <label class="control-label">
                                            Enchantment
                                            <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            $(e.page.querySelector('#obj-subType')).val(ed.value.subType || 'bell').selectpicker('render');
                                            $(e.page.querySelector('#obj-wType')).val(ed.value.subType || '').selectpicker('render');
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                        }
                                    }), wizSkills, wizBonuses]);
                                    //spell-checker:enable
                                    break;
                                case StdObjectType.rope:
                                    wiz.defaults['obj-bonuses'] = ed.value.bonuses || [];
                                    wiz.defaults['obj-skills'] = ed.value.skills || [];
                                    wiz.title = 'Edit rope...';
                                    //quality, enchantment
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-weapon',
                                        title: 'Rope properties',
                                        body: `${qualities}
                                <div class="form-group col-sm-12">
                                    <label class="control-label">
                                        Enchantment
                                        <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                    </label>
                                </div>`,
                                        reset: (e) => {
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                        }
                                    }), wizSkills, wizBonuses]);
                                    break;
                                case StdObjectType.weapon:
                                    wiz.defaults = {
                                        'obj-bonuses': ed.value.bonuses || [],
                                        'obj-skills': ed.value.skills || []
                                    };
                                    wiz.title = 'Edit weapon...';
                                    //type, quality, enchantment
                                    //spell-checker:disable
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-weapon',
                                        title: 'Weapon properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%;">Type
                                            <select id="obj-subType" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                            <optgroup label="Axe"><option value="axe">Axe</option><option value="battle axe">Battle axe</option><option value="great axe">Great axe</option><option value="hand axe">Hand axe</option><option value="mattock">Mattock</option><option value="wood axe">Wood axe</option></optgroup><optgroup label="Blunt"><option value="club">Club</option><option value="hammer">Hammer</option><option value="mace">Mace</option><option value="maul">Maul</option><option value="morningstar">Morningstar</option><option value="spiked club">Spiked club</option><option value="warhammer">Warhammer</option></optgroup><optgroup label="Bow"><option value="bow">Bow</option><option value="crossbow">Crossbow</option><option value="long bow">Long bow</option><option value="longbow">Longbow</option><option value="recurve bow">Recurve bow</option><option value="self bow">Self bow</option></optgroup><optgroup label="Flail"><option value="ball and chain">Ball and chain</option><option value="chain">Chain</option><option value="flail">Flail</option><option value="whip">Whip</option></optgroup><optgroup label="Knife"><option value="dagger">Dagger</option><option value="dirk">Dirk</option><option value="knife">Knife</option><option value="kris">Kris</option><option value="stiletto">Stiletto</option><option value="tanto">Tanto</option></optgroup><optgroup label="Large sword"><option value="bastard sword">Bastard sword</option><option value="claymore">Claymore</option><option value="flamberge">Flamberge</option><option value="large sword">Large sword</option><option value="nodachi">Nodachi</option></optgroup><optgroup label="Melee"><option value="brass knuckles">Brass knuckles</option><option value="melee">Melee</option><option value="tekagi-shuko">Tekagi-shuko</option><option value="tekko">Tekko</option></optgroup><optgroup label="Miscellaneous"><option value="bolas">Bolas</option><option value="cord">Cord</option><option value="fan">Fan</option><option value="giant fan">Giant fan</option><option value="miscellaneous">Miscellaneous</option><option value="war fan">War fan</option></optgroup><optgroup label="Polearm"><option value="bardiche">Bardiche</option><option value="glaive">Glaive</option><option value="halberd">Halberd</option><option value="poleaxe">Poleaxe</option><option value="scythe">Scythe</option></optgroup><optgroup label="Shield"><option value="buckler">Buckler</option><option value="large shield">Large shield</option><option value="shield">Shield</option><option value="small shield">Small shield</option></optgroup><optgroup label="Small sword"><option value="broadsword">Broadsword</option><option value="katana">Katana</option><option value="long sword">Long sword</option><option value="rapier">Rapier</option><option value="scimitar">Scimitar</option><option value="short sword">Short sword</option><option value="small sword">Small sword</option><option value="wakizashi">Wakizashi</option></optgroup><optgroup label="Spear"><option value="arrow">Arrow</option><option value="javelin">Javelin</option><option value="lance">Lance</option><option value="long spear">Long spear</option><option value="pike">Pike</option><option value="pilum">Pilum</option><option value="short spear">Short spear</option><option value="spear">Spear</option><option value="trident">Trident</option></optgroup><optgroup label="Staff"><option value="battle staff">Battle staff</option><option value="bo">Bo</option><option value="quarterstaff">Quarterstaff</option><option value="staff">Staff</option><option value="wand">Wand</option><option value="warstaff">Warstaff</option></optgroup>
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
                                            $(e.page.querySelector('#obj-subType')).val(ed.value.subType || 'blunt').selectpicker('render');
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                        }
                                    }), wizSkills, wizBonuses]);
                                    //spell-checker:enable
                                    break;
                                case StdObjectType.material_weapon:
                                    wiz.defaults['obj-bonuses'] = ed.value.bonuses || [];
                                    wiz.defaults['obj-skills'] = ed.value.skills || [];
                                    wiz.title = 'Edit material weapon...';
                                    //type, quality, enchantment
                                    //spell-checker:disable
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-weapon',
                                        title: 'Material weapon properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%;">Type
                                            <select id="obj-subType" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                            <option value="">Default</option><optgroup label="Axe"><option value="axe">Axe</option><option value="battle axe">Battle axe</option><option value="great axe">Great axe</option><option value="hand axe">Hand axe</option><option value="mattock">Mattock</option><option value="wood axe">Wood axe</option></optgroup><optgroup label="Blunt"><option value="club">Club</option><option value="hammer">Hammer</option><option value="mace">Mace</option><option value="maul">Maul</option><option value="morningstar">Morningstar</option><option value="spiked club">Spiked club</option><option value="warhammer">Warhammer</option></optgroup><optgroup label="Flail"><option value="ball and chain">Ball and chain</option><option value="chain">Chain</option><option value="flail">Flail</option><option value="whip">Whip</option></optgroup><optgroup label="Knife"><option value="dagger">Dagger</option><option value="dirk">Dirk</option><option value="knife">Knife</option><option value="kris">Kris</option><option value="stiletto">Stiletto</option><option value="tanto">Tanto</option></optgroup><optgroup label="Large sword"><option value="bastard sword">Bastard sword</option><option value="claymore">Claymore</option><option value="flamberge">Flamberge</option><option value="large sword">Large sword</option><option value="nodachi">Nodachi</option></optgroup><optgroup label="Melee"><option value="brass knuckles">Brass knuckles</option><option value="melee">Melee</option><option value="tekagi-shuko">Tekagi-shuko</option><option value="tekko">Tekko</option></optgroup><optgroup label="Miscellaneous"><option value="cord">Cord</option><option value="fan">Fan</option><option value="giant fan">Giant fan</option><option value="miscellaneous">Miscellaneous</option><option value="war fan">War fan</option></optgroup><optgroup label="Polearm"><option value="bardiche">Bardiche</option><option value="glaive">Glaive</option><option value="halberd">Halberd</option><option value="poleaxe">Poleaxe</option><option value="scythe">Scythe</option></optgroup><optgroup label="Small sword"><option value="broadsword">Broadsword</option><option value="katana">Katana</option><option value="long sword">Long sword</option><option value="rapier">Rapier</option><option value="scimitar">Scimitar</option><option value="short sword">Short sword</option><option value="small sword">Small sword</option><option value="wakizashi">Wakizashi</option></optgroup><optgroup label="Spear"><option value="arrow">Arrow</option><option value="javelin">Javelin</option><option value="lance">Lance</option><option value="long spear">Long spear</option><option value="pike">Pike</option><option value="pilum">Pilum</option><option value="short spear">Short spear</option><option value="spear">Spear</option><option value="trident">Trident</option></optgroup><optgroup label="Staff"><option value="battle staff">Battle staff</option><option value="bo">Bo</option><option value="quarterstaff">Quarterstaff</option><option value="staff">Staff</option><option value="wand">Wand</option><option value="warstaff">Warstaff</option></optgroup>
                                            </select>
                                        </label>
                                    </div>${qualities}
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label">Size
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A number or predefined string</span>
                                            <div class="input-group edit-dropdown">
                                                <input type="text" id="obj-size" class="input-sm form-control">
                                                <span class="input-group-btn">
                                                    <button id="btn-obj-size" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <span class="caret" style="margin-left: -1px;"></span>
                                                    </button>
                                                    <ul id="obj-size-list" style="max-height: 200px;" class="dropdown-menu pull-right" aria-labelledby="btn-obj-size" data-container="body">
                                                        <li><a href="#">Small</a></li>
                                                        <li><a href="#">Medium</a></li>
                                                        <li><a href="#">Large</a></li>
                                                        <li><a href="#">Huge</a></li>
                                                        <li><a href="#">Giant</a></li>
                                                    </ul>
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                    <div class="form-group col-sm-12">
                                        <label class="control-label">
                                            Enchantment
                                            <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                        </label>
                                    </div>
                                    <div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%">Describers
                                            <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">A comma delimited list of words</span>
                                            <input type="text" class="input-sm form-control" id="obj-describers" />
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            $(e.page.querySelector('#obj-subType')).val(ed.value.subType || 'blunt').selectpicker('render');
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                            e.page.querySelector('#obj-size').value = ed.value.size || '0';
                                            e.page.querySelector('#obj-describers').value = ed.value.describers || '';
                                            initEditDropdown(e.page.querySelector('#obj-size-list').closest('.edit-dropdown'));
                                        }
                                    }), wizSkills, wizBonuses]);
                                    //spell-checker:enable
                                    break;
                                case StdObjectType.food:
                                    wiz.title = 'Edit food...';
                                    wiz.addPages(new WizardPage({
                                        id: 'obj-food',
                                        title: 'Food properties',
                                        body: `
                                <div class="form-group col-sm-6">
                                    <label class="control-label">
                                        Strength
                                        <input type="number" id="obj-strength" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="col-sm-6 form-group">
                                    <label class="control-label">Preserved
                                        <div class="input-group edit-dropdown">
                                            <input type="text" id="obj-preserved" class="input-sm form-control">
                                            <span class="input-group-btn">
                                                <button id="btn-obj-size" class="btn-sm btn btn-default" style="width: 17px;min-width:17px;padding-left:4px;padding-right:4px;border-top-right-radius: 4px;border-bottom-right-radius: 4px;" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                    <span class="caret" style="margin-left: -1px;"></span>
                                                </button>
                                                <ul id="obj-preserved-list" style="max-height: 200px;" class="dropdown-menu pull-right" aria-labelledby="btn-obj-size" data-container="body">
                                                    <li><a href="#">Cooked</a></li>
                                                    <li><a href="#">Smoked</a></li>
                                                    <li><a href="#">Salted</a></li>
                                                    <li><a href="#">Dehydrated</a></li>
                                                </ul>
                                            </span>
                                        </div>
                                    </label>
                                </div>
                                <div class="form-group col-sm-6">
                                    <label class="control-label">
                                        Decay
                                        <input type="number" id="obj-decay" class="input-sm form-control" value="0" min="30" max="1000" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="form-group col-sm-12">
                                    <label class="control-label">
                                        Player message
                                        <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">$N - name, $O - object</span>
                                        <input type="text" id="obj-my-message" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="form-group col-sm-12">
                                    <label class="control-label">
                                        Room message
                                        <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">$N - name, $O - object</span>
                                        <input type="text" id="obj-your-message" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="form-group col-sm-12">
                                    <label class="control-label">
                                        Decay message
                                        <input type="text" id="obj-decay-message" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                `,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-strength').value = ed.value.strength || '1';
                                            e.page.querySelector('#obj-preserved').value = ed.value.preserved || '';
                                            e.page.querySelector('#obj-my-message').value = ed.value.myMessage || '';
                                            e.page.querySelector('#obj-your-message').value = ed.value.yourMessage || '';
                                            e.page.querySelector('#obj-decay').value = ed.value.decay || '300';
                                            e.page.querySelector('#obj-decay-message').value = ed.value.decayMessage || '';
                                            initEditDropdown(e.page.querySelector('#obj-preserved-list').closest('.edit-dropdown'));
                                        }
                                    }));
                                    break;
                                case StdObjectType.drink:
                                    wiz.title = 'Edit drink...';
                                    wiz.addPages(new WizardPage({
                                        id: 'obj-drink',
                                        title: 'Drink properties',
                                        body: `
                                <div class="form-group col-sm-6">
                                    <label class="control-label">
                                        Strength
                                        <input type="number" id="obj-strength" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="form-group col-sm-6">
                                    <label class="control-label">
                                        Quenched strength
                                        <input type="number" id="obj-quenched" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="form-group col-sm-4">
                                    <label class="control-label">
                                        Drinks
                                        <input type="number" id="obj-drinks" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="form-group col-sm-4">
                                    <label class="control-label">
                                        Max drinks
                                        <input type="number" id="obj-max-drinks" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="col-sm-4 form-group">
                                    <label class="control-label" style="width: 100%;">Type
                                        <select id="obj-subType" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                        <option value="">Normal</option><option value="caffeine">Caffeine</option><option value="alcoholic">Alcoholic</option>
                                        </select>
                                    </label>
                                </div>
                                <div class="col-sm-6 form-group">
                                    <label class="control-label">
                                        <input type="checkbox" id="obj-empty" /> Create empty container
                                    </label>
                                </div>
                                <div class="form-group col-sm-6">
                                    <label class="control-label">
                                        Empty container name
                                        <input type="text" id="obj-empty-name" class="input-sm form-control" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="form-group col-sm-12">
                                    <label class="control-label">
                                        Player message
                                        <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">$N - name, $O - object</span>
                                        <input type="text" id="obj-my-message" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                <div class="form-group col-sm-12">
                                    <label class="control-label">
                                        Room message
                                        <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">$N - name, $O - object</span>
                                        <input type="text" id="obj-your-message" class="input-sm form-control" value="0" min="-500" max="500" style="width: 100%" />
                                    </label>
                                </div>
                                `,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-strength').value = ed.value.strength || '1';
                                            $(e.page.querySelector('#obj-subType')).val(ed.value.subType || '').selectpicker('render');
                                            e.page.querySelector('#obj-quenched').value = ed.value.quenched || '1';
                                            e.page.querySelector('#obj-drinks').value = ed.value.drinks || '5';
                                            e.page.querySelector('#obj-max-drinks').value = ed.value.maxDrinks || '5';
                                            e.page.querySelector('#obj-my-message').value = ed.value.myMessage || '';
                                            e.page.querySelector('#obj-your-message').value = ed.value.yourMessage || '';
                                            e.page.querySelector('#obj-empty-name').value = ed.value.emptyName || 'bottle';
                                            e.page.querySelector('#obj-empty').checked = !ed.value.hasOwnProperty('empty') || ed.value.empty;
                                        }
                                    }));
                                    break;
                                case StdObjectType.fishing_pole:
                                    wiz.defaults = {
                                        'obj-bonuses': ed.value.bonuses || [],
                                        'obj-skills': ed.value.skills || []
                                    };
                                    wiz.title = 'Edit fishing pole...';
                                    //type, quality, enchantment
                                    //spell-checker:disable
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-fishing-pole',
                                        title: 'Fishing pole properties',
                                        body: `<div class="col-sm-12 form-group">
                                        <label class="control-label" style="width: 100%;">Type
                                            <select id="obj-subType" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                                <optgroup label="Axe"><option value="axe">Axe</option><option value="battle axe">Battle axe</option><option value="great axe">Great axe</option><option value="hand axe">Hand axe</option><option value="mattock">Mattock</option><option value="wood axe">Wood axe</option></optgroup><optgroup label="Blunt"><option value="club">Club</option><option value="hammer">Hammer</option><option value="mace">Mace</option><option value="maul">Maul</option><option value="morningstar">Morningstar</option><option value="spiked club">Spiked club</option><option value="warhammer">Warhammer</option></optgroup><optgroup label="Flail"><option value="ball and chain">Ball and chain</option><option value="chain">Chain</option><option value="flail">Flail</option><option value="whip">Whip</option></optgroup><optgroup label="Knife"><option value="dagger">Dagger</option><option value="dirk">Dirk</option><option value="knife">Knife</option><option value="kris">Kris</option><option value="stiletto">Stiletto</option><option value="tanto">Tanto</option></optgroup><optgroup label="Large sword"><option value="bastard sword">Bastard sword</option><option value="claymore">Claymore</option><option value="flamberge">Flamberge</option><option value="large sword">Large sword</option><option value="nodachi">Nodachi</option></optgroup><optgroup label="Melee"><option value="brass knuckles">Brass knuckles</option><option value="melee">Melee</option><option value="tekagi-shuko">Tekagi-shuko</option><option value="tekko">Tekko</option></optgroup><optgroup label="Miscellaneous"><option value="cord">Cord</option><option value="fan">Fan</option><option value="giant fan">Giant fan</option><option value="miscellaneous">Miscellaneous</option><option value="war fan">War fan</option></optgroup><optgroup label="Polearm"><option value="bardiche">Bardiche</option><option value="glaive">Glaive</option><option value="halberd">Halberd</option><option value="poleaxe">Poleaxe</option><option value="scythe">Scythe</option></optgroup><optgroup label="Small sword"><option value="broadsword">Broadsword</option><option value="katana">Katana</option><option value="long sword">Long sword</option><option value="rapier">Rapier</option><option value="scimitar">Scimitar</option><option value="short sword">Short sword</option><option value="small sword">Small sword</option><option value="wakizashi">Wakizashi</option></optgroup><optgroup label="Spear"><option value="javelin">Javelin</option><option value="lance">Lance</option><option value="long spear">Long spear</option><option value="pike">Pike</option><option value="pilum">Pilum</option><option value="short spear">Short spear</option><option value="spear">Spear</option><option value="trident">Trident</option></optgroup><optgroup label="Staff"><option value="battle staff">Battle staff</option><option value="bo">Bo</option><option value="quarterstaff">Quarterstaff</option><option value="staff">Staff</option><option value="wand">Wand</option><option value="warstaff">Warstaff</option></optgroup>
                                            </select>
                                        </label>
                                    </div>${qualities}
                                    <div class="form-group col-sm-12">
                                        <label class="control-label">
                                            Enchantment
                                            <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            <input type="checkbox" id="obj-canBait" /> Can bait
                                        </label>
                                    </div>
                                    <div class="form-group col-sm-12">
                                        <label class="control-label">
                                            Pole class
                                            <input type="number" id="obj-class" class="input-sm form-control" value="1" min="1" max="1000" style="width: 100%" />
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            $(e.page.querySelector('#obj-subType')).val(ed.value.subType || 'staff').selectpicker('render');
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                            e.page.querySelector('#obj-class').value = ed.value.class || '1';
                                            e.page.querySelector('#obj-canBait').checked = !ed.value.hasOwnProperty('canBait') || ed.value.canBait;
                                        }
                                    }), wizSkills, wizBonuses]);
                                    //spell-checker:enable
                                    break;
                                case StdObjectType.backpack:
                                    wiz.defaults['obj-bonuses'] = ed.value.bonuses || [];
                                    wiz.defaults['obj-skills'] = ed.value.skills || [];
                                    wiz.title = 'Edit Backpack...';
                                    //type, quality, enchantment
                                    wiz.addPages([new WizardPage({
                                        id: 'obj-armor',
                                        title: 'Backpack properties',
                                        body: `<div class="col-sm-12 form-group">
                                            <label class="control-label" style="width: 100%;">Type
                                                <select id="obj-subType" class="form-control selectpicker" data-style="btn-default btn-sm" data-width="100%">
                                                    <option value="backpack">backpack</option><option value="bag">bag</option><option value="pouch">pouch</option><option value="sack">sack</option><option value="haversack">haversack</option><option value="pack">pack</option><option value="purse">purse</option><option value="rucksack">rucksack</option><option value="duffel bag">duffel bag</option><option value="bindle">bindle</option><option value="satchel">satchel</option><option value="shoulder strap">shoulder strap</option><option value="shoulder sling">shoulder sling</option><option value="dilly bag">dilly bag</option><option value="carpet bag">carpet bag</option>
                                                </select>
                                            </label>
                                        </div>
                                        ${qualities.replace('col-sm-12', 'col-sm-6')}
                                        <div class="form-group col-sm-6">
                                            <label class="control-label">
                                                Enchantment
                                                <input type="number" id="obj-enchantment" class="input-sm form-control" value="0" min="0" max="1000" style="width: 100%" />
                                            </label>
                                        </div>
                                        <div class="col-sm-6 form-group">
                                            <label class="control-label">
                                                Max encumbrance
                                                <input type="number" id="obj-encumbrance" class="input-sm form-control" min="0" value="100000000" />
                                            </label>
                                        </div>
                                        <div class="col-sm-6 form-group">
                                            <label class="control-label">
                                                Reduce mass
                                                <input type="number" step="0.01" id="obj-reduce" class="input-sm form-control" min="0.0" value="2.0" />
                                                <span class="help-block" style="font-size: 0.8em;margin:0;padding:0;display:inline">Reduction formula: item mass * reduce</span>
                                            </label>
                                        </div>`,
                                        reset: (e) => {
                                            $(e.page.querySelector('#obj-subType')).val(ed.value.subType || 'pack').selectpicker('render');
                                            $(e.page.querySelector('#obj-quality')).val(ed.value.quality || 'average').selectpicker('render');
                                            e.page.querySelector('#obj-enchantment').value = ed.value.enchantment || '0';
                                            e.page.querySelector('#obj-encumbrance').value = ed.value.encumbrance || '4000';
                                            e.page.querySelector('#obj-reduce').value = ed.value.reduce || '1.0';
                                        }
                                    }), wizSkills, wizBonuses]);
                                    break;
                                case StdObjectType.bag_of_holding:
                                    wiz.title = 'Edit bag of holding...';
                                    //quality, enchantment
                                    wiz.addPages(new WizardPage({
                                        id: 'obj-bag',
                                        title: 'Bag of holding properties',
                                        body: ` <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Max encumbrance
                                            <input type="number" id="obj-encumbrance" class="input-sm form-control" min="0" value="100000000" />
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Min encumbrance
                                            <input type="number" id="obj-minencumbrance" class="input-sm form-control" min="0" value="100" />
                                        </label>
                                    </div>
                                    <div class="col-sm-6 form-group">
                                        <label class="control-label">
                                            Max items
                                            <input type="number" id="obj-maxitems" class="input-sm form-control" min="0" value="100" />
                                        </label>
                                    </div>`,
                                        reset: (e) => {
                                            e.page.querySelector('#obj-encumbrance').value = ed.value.encumbrance || '40000';
                                            e.page.querySelector('#obj-minencumbrance').value = ed.value.minencumbranc || '500';
                                            e.page.querySelector('#obj-maxitems').value = ed.value.maxitems || '0';
                                        }
                                    }));
                                    break;
                            }
                            if (wiz.pages.length === 5) {
                                $(wiz.pages[4].page.querySelectorAll('.selectpicker')).selectpicker();
                                Array.from(wiz.pages[4].page.querySelectorAll('.edit-dropdown')).forEach(initEditDropdown);
                            }
                            wiz.addPages(new WizardPage({
                                id: 'obj-wiz-notes',
                                title: 'Notes',
                                body: `<div class="col-sm-12 form-group"><label class="control-label" style="width: 100%">Notes<textarea class="input-sm form-control" id="obj-notes" style="width: 100%;height: 266px;"></textarea></label></div>`,
                                reset: (e) => {
                                    e.page.querySelector('#obj-notes').value = ed.value.notes || '';
                                }
                            }));
                            wiz.addPages(new WizardPage({
                                id: 'obj-finish',
                                title: 'Finish',
                                body: `<img src="../assets/icons/png/wiz.obj.logo.png" alt="Object editor summary" style="float: left;margin-top: 76px;height: 128px;width:128px;"> To finish your room simply click finished
                                    <div id="obj-summary" readonly="readonly" class="form-control" style="overflow:auto;height:259px;width:355px;white-space:pre;float: right;"></div>`,
                                shown: (e) => {
                                    const summary = e.page.querySelector('#obj-summary');
                                    const data = e.wizard.data;
                                    let sum = '';
                                    for (const prop in data) {
                                        if (!data.hasOwnProperty(prop)) continue;
                                        if (Array.isArray(data[prop]))
                                            sum += '<div><span style="font-weight:bold">' + (prop === 'obj-subType' ? 'Type' : capitalize(prop.substr(4))) + ':</span> ' + data[prop].length + '</div>';
                                        else if (typeof data[prop] === 'object')
                                            sum += '<div><span style="font-weight:bold">' + (prop === 'obj-subType' ? 'Type' : capitalize(prop.substr(4))) + ':</span> ' + data[prop].display + '</div>';
                                        else if (typeof data[prop] === 'string')
                                            sum += '<div><span style="font-weight:bold">' + (prop === 'obj-subType' ? 'Type' : capitalize(prop.substr(4))) + ':</span> ' + ellipse(data[prop]) + '</div>';
                                        else
                                            sum += '<div><span style="font-weight:bold">' + (prop === 'obj-subType' ? 'Type' : capitalize(prop.substr(4))) + ':</span> ' + data[prop] + '</div>';
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
            if (ipcRenderer.sendSync('show-dialog-sync', 'showMessageBox',
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
                        delete this.$area.objects[r.data.id];
                        return { id: r.data.id, value: r.data.object };
                    })
                });
                this.changed = true;
            }
        });
        this.$objectGrid.on('cut', (e) => {
            this.pushUndo(undoAction.delete, undoType.object, {
                values: e.data.map(r => {
                    delete this.$area.objects[r.data.id];
                    return { id: r.data.id, value: r.data.object };
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
            this.$new.objects++;
            if (this.$new.objects > 1)
                m.name = 'new object ' + this.$new.objects;
            else
                m.name = 'new object';
            m.short = 'a ' + m.name;
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
            this.updateObjects(true);
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

    private formatRoomBaseFlags(data) {
        if (!data || !data.cell) return 'Default';
        const states = Object.keys(RoomExit).filter(key => !isNaN(Number(RoomBaseFlags[key])));
        const f = [];
        let state = states.length;
        while (state--) {
            if (states[state] === 'None') continue;
            if ((data.cell & RoomBaseFlags[states[state]]) === RoomBaseFlags[states[state]])
                f.push(capitalize(states[state]));
        }
        return f.join(', ');
    }

    private formatMonsterBaseFlags(data) {
        if (!data || !data.cell) return 'Default';
        const states = Object.keys(RoomExit).filter(key => !isNaN(Number(MonsterBaseFlags[key])));
        const f = [];
        let state = states.length;
        while (state--) {
            if (states[state] === 'None') continue;
            if ((data.cell & MonsterBaseFlags[states[state]]) === MonsterBaseFlags[states[state]])
                f.push(capitalize(states[state]));
        }
        return f.join(', ');
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
        if (typeof prop === 'object') {
            value = prop.cell;
            prop = prop.field;
        }
        if (!value || value.length === 0) return '';
        switch (prop) {
            case 'forageObjects':
            case 'objects':
                return value.map(v => stripPinkfish(this.$area.objects[v.id].name)).join(', ');
            case 'monsters':
                return value.map(v => capitalize(this.$area.monsters[v.id].name)).join(', ');
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
            case 'reads':
                return value.map(v => v.read).join(', ');
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
        if (!this.file || this.file.length === 0 || !isFileSync(this.file) || this.new)
            return;
        this.opened = new Date().getTime();
        this.$area = Area.load(this.file);
        this.BuildMap();
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    if (!noUndo) {
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exits', values: [po.exits], rooms: [[po.x, po.y, po.z]] });
                        this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
                    }
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    this.pushUndo(undoAction.edit, undoType.room, { property: 'exitsDetails', values: [po.exitsDetails], rooms: [[po.x, po.y, po.z]] });
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
                    case 'Base monsters':
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
                    case 'Base monsters':
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
                    case 'Base monsters':
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
                    case 'Base monsters':
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
                const osZ = data.rooms[0].z - or.z;
                let dl = data.rooms.length;
                const rooms = [];
                this.startUndoGroup();
                while (dl--) {
                    const dRoom = data.rooms[dl];
                    const room = new Room(dRoom.x - osX, dRoom.y - osY, dRoom.z - osZ, this.$area.baseRooms[this.$area.defaultRoom], this.$area.defaultRoom);
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
                    case 'Base monsters':
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
                    this.$selectedRooms[sl] = new Room(or.x, or.y, or.z, this.$area.baseRooms[this.$area.defaultRoom], this.$area.defaultRoom); //, this.$area.baseRooms[this.$area.defaultRoom], this.$area.defaultRoom);
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
                    case 'Base monsters':
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
                            case 'baseRooms':
                                //this.pushUndo(undoAction.add, undoType.properties, { property: 'baseRooms', name: 'base' + this.$new.baseRooms, value: e.data });
                                delete this.$area.baseRooms[undo.data.name];
                                this.pushRedo(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                break;
                            case 'baseMonsters':
                                //this.pushUndo(undoAction.add, undoType.properties, { property: 'baseRooms', name: 'base' + this.$new.baseRooms, value: e.data });
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
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[2])));
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
                            case 'baseRooms':
                                undo.data.values.forEach(r => {
                                    this.$area.baseRooms[r.name] = r.value;
                                });
                                this.pushRedo(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                /*
                                this.pushUndo(undoAction.delete, undoType.properties, {
                                    property: 'baseRooms', values: e.data.map(r => {
                                        delete this.$area.baseRooms[r.data.name];
                                        return { name: r.name, value: r.room };
                                    })
                                });
                                */
                                break;
                            case 'baseMonsters':
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
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[2])));
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
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[2])));
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
                        //this.pushUndo(undoAction.edit, undoType.properties, { property: 'baseRooms', old: oldValue, new: newValue });
                        switch (undo.data.property) {
                            case 'baseRooms':
                                if (undo.data.old.name !== undo.data.new.name)
                                    delete this.$area.baseRooms[undo.data.new.name];
                                this.$area.baseRooms[undo.data.old.name] = undo.data.old.room;
                                this.pushRedo(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                break;
                            case 'baseMonsters':
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
                    case undoType.flip:
                        this.flipMap(undo.data.type, true);
                        this.pushRedo(undo);
                        break;
                    case undoType.room:
                        l = undo.data.values.length;
                        const values = [];
                        const mx = this.$mouse.rx;
                        const my = this.$mouse.ry;
                        while (l--) {
                            room = this.getRoom(undo.data.rooms[l][0], undo.data.rooms[l][1], undo.data.rooms[l][2]);
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
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[2])));
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
                            case 'baseRooms':
                                //this.pushUndo(undoAction.add, undoType.properties, { property: 'baseRooms', name: 'base' + this.$new.baseRooms, value: e.data });
                                this.$area.baseRooms[undo.data.name] = undo.data.value;
                                this.pushUndoObject(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                break;
                            case 'baseMonsters':
                                //this.pushUndo(undoAction.add, undoType.properties, { property: 'baseRooms', name: 'base' + this.$new.baseRooms, value: e.data });
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
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[2])));
                        this.setFocusedRoom(undo.focused);
                        break;
                }
                break;
            case undoAction.delete:
                switch (undo.type) {
                    case undoType.properties:
                        switch (undo.data.property) {
                            case 'baseRooms':
                                undo.data.values.forEach(r => {
                                    delete this.$area.baseRooms[r.name];
                                });
                                this.pushUndoObject(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                /*
                                this.pushUndo(undoAction.delete, undoType.properties, {
                                    property: 'baseRooms', values: e.data.map(r => {
                                        delete this.$area.baseRooms[r.data.name];
                                        return { name: r.name, value: r.room };
                                    })
                                });
                                */
                                break;
                            case 'baseMonsters':
                                undo.data.values.forEach(r => {
                                    delete this.$area.baseMonsters[r.name];
                                });
                                this.pushUndoObject(undo);
                                this.updateBaseMonsters();
                                this.changed = true;
                                /*
                                this.pushUndo(undoAction.delete, undoType.properties, {
                                    property: 'baseRooms', values: e.data.map(r => {
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
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[2])));
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
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[2])));
                        this.setFocusedRoom(undo.focused);
                        break;
                }
                break;
            case undoAction.edit:
                switch (undo.type) {
                    case undoType.properties:
                        //this.pushUndo(undoAction.edit, undoType.properties, { property: 'baseRooms', old: oldValue, new: newValue });
                        switch (undo.data.property) {
                            case 'baseRooms':
                                if (undo.data.old.name !== undo.data.new.name)
                                    delete this.$area.baseRooms[undo.data.old.name];
                                this.$area.baseRooms[undo.data.new.name] = undo.data.new;
                                this.pushUndoObject(undo);
                                this.updateBaseRooms();
                                this.changed = true;
                                break;
                            case 'baseMonsters':
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
                    case undoType.flip:
                        this.flipMap(undo.data.type, true);
                        this.pushUndoObject(undo);
                        break;
                    case undoType.room:
                        l = undo.data.values.length;
                        const values = [];
                        const mx = this.$mouse.rx;
                        const my = this.$mouse.ry;
                        while (l--) {
                            room = this.getRoom(undo.data.rooms[l][0], undo.data.rooms[l][1], undo.data.rooms[l][2]);
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
                        this.setSelectedRooms(undo.selection.map(v => this.getRoom(v[0], v[1], v[2])));
                        this.setFocusedRoom(undo.focused);
                        undo.data.values = values;
                        this.pushUndoObject(undo);
                        break;
                }
                break;
        }
    }

    public cancel() {
        this.$cancel = true;
    }

    public close() {
        this.$cancel = true;
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
                if (!this.$saving) {
                    if (details && details.mtimeMs < this.opened)
                        return;
                    this.emit('reload', action, file);
                }
                else {
                    this.opened = new Date().getTime();
                    this.$saving = false;
                }
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
        group.appendChild(this.createButton('Show monsters', 'child', () => {
            this.switchView(View.monsters);
        }, this.$view === View.monsters));
        group.appendChild(this.createButton('Show objects', 'cube', () => {
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

        group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');
        group.appendChild(this.createButton('Flip horizontally', 'shield fa-rotate-180', () => {
            this.flipMap(flipType.horizontal);
        }, false, this.$view !== View.map));
        group.appendChild(this.createButton('Flip vertically', 'shield fa-rotate-90', () => {
            this.flipMap(flipType.vertical);
        }, false, this.$view !== View.map));
        if (this.$area.size.depth > 1)
            group.appendChild(this.createButton('Flip depth', 'exchange fa-rotate-90', () => {
                this.flipMap(flipType.depth);
            }, false, this.$view !== View.map));
        frag.appendChild(group);

        frag.appendChild(this.createButton('Generate area', 'bolt', () => {
            this.emit('show-area', {
                title: 'Generate area...', name: path.basename(this.file, '.design'), ok: (local, data) => {
                    this.generateCode(local, data);
                }
            });
        }, false));
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
                },
                { type: 'separator' },
                {
                    label: 'Flip horizontally',
                    click: () => {
                        this.flipMap(flipType.horizontal);
                    }
                },
                {
                    label: 'Flip vertically',
                    click: () => {
                        this.flipMap(flipType.vertical);
                    }
                }

            ];
            if (this.$area.size.depth > 1)
                m.push(
                    {
                        label: 'Flip depth',
                        click: () => {
                            this.flipMap(flipType.depth);
                        }
                    }
                )
            m.push({ type: 'separator' },
                {
                    label: 'Generate area',
                    click: () => {
                        this.emit('show-area', {
                            title: 'Generate area...', name: path.basename(this.file, '.design'), ok: (local, data) => {
                                this.generateCode(local, data);
                            }
                        });
                    }
                });
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
            const props = ['items', 'exitsDetails', 'sounds', 'smells', 'objects', 'monsters', 'searches', 'forageObjects'];
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
        cols[2].editor.options.enterMoveFirst = this.$enterMoveFirst;
        cols[2].editor.options.enterMoveNext = this.$enterMoveNext;
        cols[2].editor.options.enterMoveNew = this.$enterMoveNew;
        cols[3].editor.options.enterMoveFirst = this.$enterMoveFirst;
        cols[3].editor.options.enterMoveNext = this.$enterMoveNext;
        cols[3].editor.options.enterMoveNew = this.$enterMoveNew;
        this.$propertiesEditor.roomGrid.columns = cols;

        cols = this.$propertiesEditor.monsterGrid.columns;
        cols[3].editor.options.enterMoveFirst = this.$enterMoveFirst;
        cols[3].editor.options.enterMoveNext = this.$enterMoveNext;
        cols[3].editor.options.enterMoveNew = this.$enterMoveNew;
        this.$propertiesEditor.monsterGrid.columns = cols;

        cols = this.$monsterGrid.columns;
        cols[5].editor.options.enterMoveFirst = this.$enterMoveFirst;
        cols[5].editor.options.enterMoveNext = this.$enterMoveNext;
        cols[5].editor.options.enterMoveNew = this.$enterMoveNew;
        this.$monsterGrid.columns = cols;

        cols = this.$objectGrid.columns;
        cols[3].editor.options.enterMoveFirst = this.$enterMoveFirst;
        cols[3].editor.options.enterMoveNext = this.$enterMoveNext;
        cols[3].editor.options.enterMoveNew = this.$enterMoveNew;
        this.$objectGrid.columns = cols;

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

    public get lineCount() { return 0; }

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
                const tab = this.$propertiesEditor.tabs.querySelector('.active').textContent;
                if (tab === 'Base rooms')
                    this.$propertiesEditor.roomGrid.refresh();
                else if (tab === 'Base monsters')
                    this.$propertiesEditor.monsterGrid.refresh();
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
                this.emit('changed', -1, -1);
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
        while (sl--) {
            if (!this.$selectedRooms[sl]) continue;
            this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, this.$selectedRooms[sl].at(this.$mouse.rx, this.$mouse.ry));
        }
        if (this.$mouse.x >= 0 && this.$mouse.y >= 0 && this.$mouse.rx >= 0 && this.$mouse.ry > 0) {
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
        const indoors = (room.flags & RoomFlags.Indoors) === RoomFlags.Indoors;
        const key = indoors + ',' + room.exits + ',' + room.climbs + ',' + room.external + ',' + room.hidden;
        let f = false;

        if (!this.$drawCache)
            this.$drawCache = {};

        //if(ex === RoomExit.None) clr = "#E6E6E6";
        //ctx.save();
        if (c) {
            ctx.fillStyle = 'white';
            ctx.fillRect(x + 0, y + 0, 32, 32);
        }

        ///ctx.translate(0.5,0.5);
        if (this.$focusedRoom === room) {
            if (this.$selectedRooms.indexOf(room) !== -1) {
                if (this.$focused)
                    ctx.fillStyle = 'rgba(135, 206, 250, 0.50)';
                else
                    ctx.fillStyle = 'rgba(142, 142, 142, 0.50)';
                ctx.fillRoundedRect(1.5 + x, 1.5 + y, 30, 30, 8);
            }
            if (this.$focused)
                ctx.strokeStyle = '#f7b32e';
            else
                ctx.strokeStyle = 'rgba(142, 142, 142, 0.50)';
            ctx.strokeRoundedRect(1.5 + x, 1.5 + y, 30, 30, 8);
        }
        else if (this.$selectedRooms && this.$selectedRooms.indexOf(room) !== -1) {
            if (this.$focused) {
                ctx.fillStyle = 'rgba(135, 206, 250, 0.50)';
                ctx.strokeStyle = 'rgba(135, 206, 250, 0.50)';
            }
            else {
                ctx.fillStyle = 'rgba(142, 142, 142, 0.50)';
                ctx.strokeStyle = 'rgba(142, 142, 142, 0.50)';
            }
            ctx.fillRoundedRect(1.5 + x, 1.5 + y, 30, 30, 8);
            ctx.strokeRoundedRect(1.5 + x, 1.5 + y, 30, 30, 8);
        }
        ctx.beginPath();
        const base = this.$area.baseRooms[room.type] || this.$area.baseRooms[this.$area.defaultRoom] || new Room(0, 0, 0);
        if (room.background && room.background.length) {
            ctx.fillStyle = room.background;
            f = true;
        }
        else {
            const terrain = room.terrain || (base ? base.terrain : 0);
            if (terrain && terrain.length) {
                //spellchecker:disable
                switch (terrain) {
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
                    case 'highmountain':
                    case 'hills':
                    case 'mountain':
                    case 'swamp':
                        f = false;
                        break;
                    case 'farmland':
                        f = true;
                        ctx.fillStyle = '#A9DFBF';
                        break;
                    case 'rockdesert':
                        ctx.fillStyle = '#6E2C00';
                        f = true;
                        break;
                    case 'pavedroad':
                        ctx.fillStyle = '#D0D3D4';
                        f = true;
                        break;
                    case 'cobble':
                    case 'rocky':
                    case 'stone':
                        ctx.fillStyle = '#D5DBDB';
                        f = true;
                        break;
                    default:
                        f = false;
                        break;
                }
                //spellchecker:enable
            }
            else
                f = false;
        }
        if (room.empty || room.equals(base, true))
            ctx.strokeStyle = '#eae9e9';
        else
            ctx.strokeStyle = 'black';

        ctx.lineWidth = 0.6;
        if (!indoors) {
            ctx.arc(x + 16.5, y + 16.5, 8.5, 0, Math.PI * 2, false);
            if (f) ctx.fill();
            ctx.stroke();
        }
        else {
            if (f) ctx.fillRect(x + 8.5, y + 8.5, 16, 16);
            ctx.strokeRect(x + 8.5, y + 8.5, 16, 16);
        }
        ctx.closePath();

        if (!this.$drawCache[key]) {
            this.$drawCache[key] = document.createElement('canvas');
            this.$drawCache[key].classList.add('map-canvas');
            this.$drawCache[key].height = 32;
            this.$drawCache[key].width = 32;
            const tx = this.$drawCache[key].getContext('2d');
            tx.beginPath();
            let ox = 0;
            let ow = 8;
            let oh = 0;
            if (!indoors) {
                ow = 10;
                oh = -2;
            }
            if (room.exitsDetails.north) {
                if (room.exitsDetails.north.dest.length && room.exitsDetails.north.hidden)
                    ox = 48;
                else if (room.exitsDetails.north.dest.length)
                    ox = 16;
                else if (room.exitsDetails.north.hidden)
                    ox = 32;
                else
                    ox = 0;
                tx.drawImage(window.$roomImg, 111 + ox, 0,
                    1,
                    8,
                    16,
                    0,
                    1,
                    8
                );
            }
            if (room.exitsDetails.northwest) {
                if (room.exitsDetails.northwest.dest.length && room.exitsDetails.northwest.hidden)
                    ox = 48;
                else if (room.exitsDetails.northwest.dest.length)
                    ox = 16;
                else if (room.exitsDetails.northwest.hidden)
                    ox = 32;
                else
                    ox = 0;
                tx.drawImage(window.$roomImg, 96 + ox, 0,
                    ow,
                    ow,
                    0,
                    0,
                    ow,
                    ow
                );
            }
            if (room.exitsDetails.northeast) {
                if (room.exitsDetails.northeast.dest.length && room.exitsDetails.northeast.hidden)
                    ox = 48;
                else if (room.exitsDetails.northeast.dest.length)
                    ox = 16;
                else if (room.exitsDetails.northeast.hidden)
                    ox = 32;
                else
                    ox = 0;
                tx.drawImage(window.$roomImg, 96 + ox, 24 + oh,
                    ow,
                    ow,
                    24 + oh,
                    0,
                    ow,
                    ow
                );
            }
            if (room.exitsDetails.east) {
                if (room.exitsDetails.east.dest.length && room.exitsDetails.east.hidden)
                    ox = 48;
                else if (room.exitsDetails.east.dest.length)
                    ox = 16;
                else if (room.exitsDetails.east.hidden)
                    ox = 32;
                else
                    ox = 0;
                tx.drawImage(window.$roomImg, 96 + ox, 15,
                    8,
                    1,
                    25,
                    16,
                    8,
                    1
                );
            }
            if (room.exitsDetails.west) {
                if (room.exitsDetails.west.dest.length && room.exitsDetails.west.hidden)
                    ox = 48;
                else if (room.exitsDetails.west.dest.length)
                    ox = 16;
                else if (room.exitsDetails.west.hidden)
                    ox = 32;
                else
                    ox = 0;
                tx.drawImage(window.$roomImg, 96 + ox, 15,
                    8,
                    1,
                    0,
                    16,
                    8,
                    1
                );
            }
            if (room.exitsDetails.south) {
                if (room.exitsDetails.south.dest.length && room.exitsDetails.south.hidden)
                    ox = 48;
                else if (room.exitsDetails.south.dest.length)
                    ox = 16;
                else if (room.exitsDetails.south.hidden)
                    ox = 32;
                else
                    ox = 0;
                tx.drawImage(window.$roomImg, 111 + ox, 0,
                    1,
                    8,
                    16,
                    25,
                    1,
                    8
                );
            }
            if (room.exitsDetails.southeast) {
                if (room.exitsDetails.southeast.dest.length && room.exitsDetails.southeast.hidden)
                    ox = 48;
                else if (room.exitsDetails.southeast.dest.length)
                    ox = 16;
                else if (room.exitsDetails.southeast.hidden)
                    ox = 32;
                else
                    ox = 0;
                tx.drawImage(window.$roomImg, 96 + ox, 0,
                    ow,
                    ow,
                    25 + oh,
                    25 + oh,
                    ow,
                    ow
                );
            }
            if (room.exitsDetails.southwest) {
                if (room.exitsDetails.southwest.dest.length && room.exitsDetails.southwest.hidden)
                    ox = 48;
                else if (room.exitsDetails.southwest.dest.length)
                    ox = 16;
                else if (room.exitsDetails.southwest.hidden)
                    ox = 32;
                else
                    ox = 0;
                tx.drawImage(window.$roomImg, 96 + ox, 24 + oh,
                    ow,
                    ow,
                    0,
                    24 + oh,
                    ow,
                    ow
                );
            }
            tx.closePath();
            tx.strokeStyle = 'black';
            if (room.exitsDetails.up) {
                if (room.exitsDetails.up.dest.length && room.exitsDetails.up.hidden)
                    tx.fillStyle = '#FFD800';
                else if (room.exitsDetails.up.dest.length)
                    tx.fillStyle = 'red';
                else if (room.exitsDetails.up.hidden)
                    tx.fillStyle = '#00FF00';
                else
                    tx.fillStyle = 'black';
                tx.beginPath();
                tx.moveTo(1, 11);
                tx.lineTo(7, 11);
                tx.lineTo(4, 8);
                tx.closePath();
                tx.fill();
            }
            if (room.exitsDetails.down) {
                if (room.exitsDetails.down.dest.length && room.exitsDetails.down.hidden)
                    tx.fillStyle = '#FFD800';
                else if (room.exitsDetails.down.dest.length)
                    tx.fillStyle = 'red';
                else if (room.exitsDetails.down.hidden)
                    tx.fillStyle = '#00FF00';
                else
                    tx.fillStyle = 'black';
                tx.beginPath();
                tx.moveTo(1, 21);
                tx.lineTo(7, 21);
                tx.lineTo(4, 24);
                tx.closePath();
                tx.fill();
            }
            if (room.exitsDetails.out) {
                if (room.exitsDetails.out.dest.length && room.exitsDetails.out.hidden)
                    tx.fillStyle = '#FFD800';
                else if (room.exitsDetails.out.dest.length)
                    tx.fillStyle = 'red';
                else if (room.exitsDetails.out.hidden)
                    tx.fillStyle = '#00FF00';
                else
                    tx.fillStyle = 'black';
                tx.beginPath();
                tx.moveTo(26, 8);
                tx.lineTo(29, 11);
                tx.lineTo(26, 14);
                tx.closePath();
                tx.fill();
            }
            if (room.exitsDetails.enter) {
                if (room.exitsDetails.enter.dest.length && room.exitsDetails.enter.hidden)
                    tx.fillStyle = '#FFD800';
                else if (room.exitsDetails.enter.dest.length)
                    tx.fillStyle = 'red';
                else if (room.exitsDetails.enter.hidden)
                    tx.fillStyle = '#00FF00';
                else
                    tx.fillStyle = 'black';
                tx.beginPath();
                tx.moveTo(29, 19);
                tx.lineTo(26, 22);
                tx.lineTo(29, 25);
                tx.closePath();
                tx.fill();
            }
        }
        ctx.drawImage(this.$drawCache[key], x, y);
        this.DrawDoor(ctx, x + 1, y + 5, 6, 2, room.exitsDetails.up);
        this.DrawDoor(ctx, x + 1, y + 25, 6, 2, room.exitsDetails.down);
        this.DrawDoor(ctx, x + 12, y, 9, 2, room.exitsDetails.north);
        this.DrawDoor(ctx, x + 30, y + 12, 2, 9, room.exitsDetails.east);
        this.DrawDoor(ctx, x, y + 12, 2, 9, room.exitsDetails.west);
        this.DrawDoor(ctx, x + 12, y + 30, 9, 2, room.exitsDetails.south);
        this.DrawDDoor(ctx, x, y, 5, 5, room.exitsDetails.northwest);
        this.DrawDDoor(ctx, x + 32, y, -5, 5, room.exitsDetails.northeast);
        this.DrawDDoor(ctx, x + 32, y + 32, -5, -5, room.exitsDetails.southeast);
        this.DrawDDoor(ctx, x, y + 32, 5, -5, room.exitsDetails.southwest);

        if (h) {
            if (this.$focused) {
                ctx.fillStyle = 'rgba(135, 206, 250, 0.5)';
                ctx.strokeStyle = 'rgba(135, 206, 250, 0.5)';
            }
            else {
                ctx.fillStyle = 'rgba(221, 221, 221, 0.75)';
                ctx.strokeStyle = 'rgba(142, 142, 142, 0.75)';
            }
            ctx.fillRoundedRect(1.5 + x, 1.5 + y, 30, 30, 8);
            ctx.strokeRoundedRect(1.5 + x, 1.5 + y, 30, 30, 8);
        }
        //ctx.restore();
    }

    public DrawDoor(ctx, x, y, w, h, exit) {
        if (!exit || !exit.door || exit.door.length === 0) return;
        ctx.beginPath();
        ctx.clearRect(x, y, w, h);
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'black';
        if (exit.locked) {
            ctx.fillStyle = 'red';
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }
        else if (exit.closed)
            ctx.fillRect(x, y, w, h);
        else
            ctx.strokeRect(x, y, w, h);
        ctx.closePath();
    }

    public DrawDDoor(ctx, x, y, w, h, exit) {
        if (!exit || !exit.door || exit.door.length === 0) return;
        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'black';
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y);
        if (exit.locked) {
            ctx.fillStyle = 'red';
            ctx.fill();
            ctx.stroke();
        }
        else if (exit.closed)
            ctx.fill();
        else
            ctx.stroke();
        ctx.closePath();
    }

    private DrawMap() {
        let x = 0;
        let y = 0;
        let r;
        let xl;
        let yl;
        if (!this.$mapContext) {
            this.doUpdate(UpdateType.drawMap);
            return;
        }
        this.$mapContext.save();
        this.$mapContext.fillStyle = 'white';
        this.$mapContext.fillRect(0, 0, this.$area.size.right, this.$area.size.bottom);
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

    // Attribution: https://www.cs.helsinki.fi/group/goa/mallinnus/lines/bresenh.html
    private drawLine(ctx, x0, y0, x1, y1, r?, g?, b?, a?) {
        let x;
        let y;
        let width;
        let height;
        r = r || 0;
        g = g || 0;
        b = b || 0;
        if (a === undefined)
            a = 255;
        // Normalize the rectangle.
        if (x0 < x1) {
            x = x0;
            width = x1 - x0;
        }
        else {
            x = x1;
            width = x0 - x1;
        }
        if (y0 < y1) {
            y = y0;
            height = y1 - y0;
        }
        else {
            y = y1;
            height = y0 - y1;
        }
        width++;
        height++;
        const imgData = ctx.getImageData(x, y, width, height);
        const data = imgData.data;

        x0 -= x;
        x1 -= x;
        y0 -= y;
        y1 -= y;

        const dx = Math.abs(x1 - x0);
        const sx = x0 < x1 ? 1 : -1;
        const dy = Math.abs(y1 - y0);
        const sy = y0 < y1 ? 1 : -1;
        let err = (dx > dy ? dx : -dy) / 2;

        while (true) {
            const n = (y0 * width + x0) * 4;
            data[n] = r;
            data[n + 1] = g;
            data[n + 2] = b;
            data[n + 3] = a;
            if (x0 === x1 && y0 === y1) break;
            const e2 = err;
            if (e2 > -dx) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dy) {
                err += dx;
                y0 += sy;
            }
        }
        ctx.putImageData(imgData, x, y);
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

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
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
            if ((this._updating & UpdateType.drawMap) === UpdateType.drawMap) {
                this._updating &= ~UpdateType.drawMap;
                this.DrawMap();
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

    private RoomChanged(room, old?, silentUpdate?) {
        if (old) {
            if (room.equals(old))
                return;
            const base = this.$area.baseRooms[room.type] || this.$area.baseRooms[this.$area.defaultRoom];
            const baseOld = this.$area.baseRooms[old.type] || this.$area.baseRooms[this.$area.defaultRoom];
            if (!old.empty && !old.equals(baseOld, true)) this.$roomCount--;
            if (!room.empty && !old.equals(base, true)) this.$roomCount++;
            this.doUpdate(UpdateType.status);
        }
        this.changed = true;
        if (!silentUpdate) {
            if (this.$selectedRooms.indexOf(room) !== -1)
                this.UpdateEditor(this.$selectedRooms);
            this.UpdatePreview(room);
        }
    }

    private UpdateEditor(rooms) {
        if (this.selectedFocusedRoom)
            this.$depthToolbar.value = '' + this.selectedFocusedRoom.z;
        const objects = [];
        let type;
        if (rooms && rooms.length !== 0 && rooms[0]) {
            type = rooms[0].type || 'base';
            let rl = rooms.length;
            const ri = [];
            while (rl--) {
                const o = rooms[rl].clone();
                o.exitsDetails = Object.values(o.exitsDetails);
                ['items', 'exitsDetails', 'sounds', 'smells', 'objects', 'monsters', 'searches', 'forageObjects'].forEach(v => {
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

    private refreshEditor() {
        if (this.selectedFocusedRoom)
            this.$depthToolbar.value = '' + this.selectedFocusedRoom.z;
        const objects = [];
        let type;
        const rooms = this.$roomEditor.objects;
        if (rooms && rooms.length !== 0 && rooms[0])
            type = rooms[0].type || 'base';
        else
            type = this.$area.defaultRoom || 'base';
        this.$roomEditor.defaults = this.$area.baseRooms[type] ? this.$area.baseRooms[type].clone() : new Room(0, 0, 0);
        this.$roomEditor.defaults.type = 'base';
        this.$roomEditor.defaults.exitsDetails = Object.values(this.$roomEditor.defaults.exitsDetails);
        this.$roomEditor.refresh();
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
            const base: Room = this.$area.baseRooms[room.type] || this.$area.baseRooms[this.$area.defaultRoom] || new Room(0, 0, 0);
            if (!room.short || room.short.trim().length === 0)
                str = base.short;
            else
                str = room.short;
            if (str.startsWith('"') && str.endsWith('"'))
                str = str.substr(1, str.length - 2);
            this.$roomPreview.short.textContent = str;
            if (!room.long || room.long.trim().length === 0)
                str = base.long;
            else
                str = room.long;
            if (str.startsWith('"') && str.endsWith('"'))
                str = str.substr(1, str.length - 2);
            this.$roomPreview.long.textContent = str;

            str = this.$roomPreview.long.innerHTML;
            items = [];
            if ((room.baseFlags & RoomBaseFlags.No_Items) === RoomBaseFlags.No_Items && room.items && room.items.length !== 0)
                room.items.forEach(i => {
                    i = i.item.split(',').map(i2 => items.push({ item: i2.trim(), description: i.description }));
                });
            else if ((room.baseFlags & RoomBaseFlags.No_Items) !== RoomBaseFlags.No_Items) {
                if (room.items && room.items.length !== 0)
                    room.items.forEach(i => {
                        i.item.split(',').forEach(i2 => items.push({ item: i2.trim(), description: i.description }));
                    });
                if (base.items && base.items.length !== 0)
                    base.items.forEach(i => {
                        i.item.split(',').forEach(i2 => items.push({ item: i2.trim(), description: i.description }));
                    });
            }

            if (items.length > 0) {
                items = items.sort((a, b) => { return b.item.length - a.item.length; });
                for (c = 0, cl = items.length; c < cl; c++) {
                    if (items[c].item.length === 0) continue;
                    str = str.replace(new RegExp('\\b(?!room-preview)(' + items[c].item + ')\\b', 'gi'), m => '<span data-id="' + this.parent.id + '-room-preview' + c + '">' + m + '</span>');
                }
            }
            else
                items = null;
            e = room.climbs || base.climbs;
            if (e !== RoomExit.None) {
                ex = [];
                for (exit in RoomExits) {
                    if (!RoomExits.hasOwnProperty(exit)) continue;
                    if (!RoomExits[exit]) continue;
                    if ((e & RoomExits[exit]) === RoomExits[exit]) {
                        if (room.exitsDetails[exit]) {
                            if (room.exitsDetails[exit].hidden)
                                continue;
                        }
                        else if (base.exitsDetails[exit]) {
                            if (base.exitsDetails[exit].hidden)
                                continue;
                        }
                        ex.push(exit);
                    }
                }
                if (ex.length === 1)
                    str += `<br>You can climb ${ex[0]} from here.`;
                else if (ex.length > 1) {
                    str = '<br>You can climb ';
                    str += ex.slice(0, -1).join(', ');
                    str += ' or ' + ex.pop();
                    this.$roomPreview.exits.textContent = str + ' from here.';
                }
            }
            str += '<br><br>';
            this.$roomPreview.long.innerHTML = pinkfishToHTML(str);
            if (items && items.length > 0) {
                for (c = 0, cl = items.length; c < cl; c++) {
                    item = document.querySelectorAll(`[data-id=${this.parent.id}-room-preview${c}]`);
                    item.forEach(el => {
                        el.title = items[c].description;
                        el.classList.add('room-item');
                    });
                }
            }

            const smell = room.smell || base.smell;
            const sound = room.sound || base.sound;
            if (smell.length > 0 && sound.length > 0) {
                this.$roomPreview.sound.style.display = 'block';
                this.$roomPreview.smell.style.display = 'block';
                this.$roomPreview.smell.textContent = smell;
                this.$roomPreview.sound.textContent = sound;
                this.$roomPreview.sound.appendChild(document.createElement('br'));
                this.$roomPreview.sound.appendChild(document.createElement('br'));
            }
            else if (smell.length > 0) {
                this.$roomPreview.sound.style.display = 'none';
                this.$roomPreview.smell.style.display = 'block';
                this.$roomPreview.smell.textContent = smell;
                this.$roomPreview.sound.textContent = '';
                this.$roomPreview.smell.appendChild(document.createElement('br'));
                this.$roomPreview.smell.appendChild(document.createElement('br'));
            }
            else if (sound.length > 0) {
                this.$roomPreview.smell.style.display = 'none';
                this.$roomPreview.sound.style.display = 'block';
                this.$roomPreview.sound.textContent = sound;
                this.$roomPreview.sound.appendChild(document.createElement('br'));
                this.$roomPreview.sound.appendChild(document.createElement('br'));
            }
            else {
                this.$roomPreview.smell.style.display = 'none';
                this.$roomPreview.sound.style.display = 'none';
            }
            e = room.exits | room.external || base.exits || base.external;
            e &= ~(room.climbs || base.climbs);
            if (e === RoomExit.None)
                this.$roomPreview.exits.textContent = 'There are no obvious exits.';
            else {
                ex = [];
                for (exit in RoomExits) {
                    if (!RoomExits.hasOwnProperty(exit)) continue;
                    if (!RoomExits[exit]) continue;
                    if ((e & RoomExits[exit]) === RoomExits[exit]) {
                        if (room.exitsDetails[exit]) {
                            if (room.exitsDetails[exit].hidden || (room.exitsDetails[exit].door.length && room.exitsDetails[exit].closed))
                                continue;
                        }
                        else if (base.exitsDetails[exit]) {
                            if (base.exitsDetails[exit].hidden || (room.exitsDetails[exit].door.length && room.exitsDetails[exit].closed))
                                continue;
                        }
                        ex.push(exit);
                    }
                }
                if (ex.length === 0)
                    this.$roomPreview.exits.textContent = 'There are no obvious exits.';
                else if (ex.length === 1)
                    this.$roomPreview.exits.textContent = 'There is one obvious exit: ' + ex[0];
                else {
                    str = 'There are ' + Cardinal(ex.length) + ' obvious exits: ';
                    str += ex.slice(0, -1).join(', ');
                    str += ' and ' + ex.pop();
                    this.$roomPreview.exits.textContent = str;
                }
            }
            let counts = {};
            room.monsters.forEach(i => {
                let short;
                if (this.$area.monsters[i.id].flags & MonsterFlags.Flying)
                    short = this.$area.monsters[i.id].short + ' (flying)';
                else
                    short = this.$area.monsters[i.id].short;

                if (!counts[short])
                    counts[short] = 0;
                if (i.minAmount > 0)
                    counts[short] += i.minAmount;
                else if (i.unique)
                    counts[short]++;
            });
            if ((room.baseFlags & RoomBaseFlags.No_Monsters) !== RoomBaseFlags.No_Monsters)
                base.monsters.forEach(i => {
                    let short;
                    if (this.$area.monsters[i.id].flags & MonsterFlags.Flying)
                        short = this.$area.monsters[i.id].short + ' (flying)';
                    else
                        short = this.$area.monsters[i.id].short;
                    if (!counts[short])
                        counts[short] = 0;
                    if (i.minAmount > 0)
                        counts[short] += i.minAmount;
                    else if (i.unique)
                        counts[short]++;
                });
            items = Object.keys(counts);
            if (items.length > 0) {
                this.$roomPreview.living.style.display = '';
                this.$roomPreview.living.innerHTML = '<br>' + stripPinkfish(items.map(v => capitalize(consolidate(counts[v], v), true)).join('<br>'));
            }
            else
                this.$roomPreview.living.style.display = 'none';

            counts = {};
            room.objects.forEach(i => {
                const short = this.$area.objects[i.id].getShort();
                if (!counts[short])
                    counts[short] = 0;
                if (i.minAmount > 0)
                    counts[short] += i.minAmount;
                else if (i.unique)
                    counts[short]++;
            });
            if ((room.baseFlags & RoomBaseFlags.No_Objects) !== RoomBaseFlags.No_Objects)
                base.objects.forEach(i => {
                    const short = this.$area.objects[i.id].getShort();
                    if (!counts[short])
                        counts[short] = 0;
                    if (i.minAmount > 0)
                        counts[short] += i.minAmount;
                    else if (i.unique)
                        counts[short]++;
                });
            items = Object.keys(counts);
            if (items.length === 1) {
                this.$roomPreview.objects.style.display = '';
                if (counts[items[0]] === 1)
                    this.$roomPreview.objects.innerHTML = '<br>' + pinkfishToHTML(capitalizePinkfish(items[0])) + ' is here.';
                else if (counts[items[0]] > 1)
                    this.$roomPreview.objects.innerHTML = '<br>' + pinkfishToHTML(capitalizePinkfish(consolidate(counts[items[0]], items[0]))) + ' are here.';
            }
            else if (items.length > 0) {
                this.$roomPreview.objects.style.display = '';
                items = items.map(v => consolidate(counts[v], v));
                str = items.slice(0, -1).join(', ');
                str += ' and ' + items.pop();
                this.$roomPreview.objects.innerHTML = '<br>' + pinkfishToHTML(capitalizePinkfish(str)) + ' are here.';
            }
            else
                this.$roomPreview.objects.style.display = 'none';
        }
    }

    private BuildMap() {
        Timer.start();
        this.$drawCache = null;
        const zl = this.$area.size.depth;
        const xl = this.$area.size.width;
        const yl = this.$area.size.height;
        this.$roomCount = 0;
        for (let z = 0; z < zl; z++) {
            for (let y = 0; y < yl; y++) {
                for (let x = 0; x < xl; x++) {
                    const room = this.$area.rooms[z][y][x];
                    const base = this.$area.baseRooms[room.type] || this.$area.baseRooms[this.$area.defaultRoom];
                    if (!room.empty && !room.equals(base, true)) this.$roomCount++;
                }
            }
        }
        if (this.$selectedRooms)
            this.$selectedRooms.map(r => this.getRoom(r.x, r.y, r.z));
        if (this.$focusedRoom)
            this.$focusedRoom = this.getRoom(this.$focusedRoom.x, this.$focusedRoom.y, this.$focusedRoom.z);
        if (this.$depth >= this.$area.size.depth)
            this.$depth = this.$area.size.depth - 1;
        if (this.$area.size.right !== this.$map.width || this.$map.height !== this.$area.size.bottom) {
            this.$map.width = this.$area.size.right;
            this.$map.height = this.$area.size.bottom;
            this.BuildAxises();
            setTimeout(() => {
                this.DrawMap();
            }, 500);
        }
        this.doUpdate(UpdateType.drawMap);
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
        this.loadTypes();
        this.updateBaseRooms();
        this.updateBaseMonsters();
        this.updateMonsters();
        this.updateObjects();
        this.emit('rebuild-buttons');
        Timer.end('BuildMap time');
    }

    private updateBaseRooms() {
        this.$propertiesEditor.roomGrid.rows = Object.keys(this.$area.baseRooms).map(r => {
            return {
                name: r,
                baseFlags: this.$area.baseRooms[r].baseFlags,
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
                baseFlags: this.$area.baseMonsters[r].baseFlags,
                objects: this.$area.baseMonsters[r].objects,
                monster: this.$area.baseMonsters[r]
            };
        });
    }

    private updateMonsters(noRows?) {
        if (!noRows)
            this.$monsterGrid.rows = Object.keys(this.$area.monsters).map(m => {
                return {
                    id: m,
                    name: this.$area.monsters[m].name,
                    short: this.$area.monsters[m].short,
                    maxAmount: this.$area.monsters[m].maxAmount,
                    unique: this.$area.monsters[m].unique,
                    baseFlags: this.$area.monsters[m].baseFlags,
                    objects: this.$area.monsters[m].objects,
                    monster: this.$area.monsters[m]
                };
            });
        const data = Object.values<Monster>(this.$area.monsters).map(o => {
            return {
                display: o.name || o.short,
                value: o.id
            };
        });
        let cols = this.$propertiesEditor.roomGrid.columns;
        cols[3].editor.options.columns[0].editor.options.data = data;
        this.$propertiesEditor.roomGrid.columns = cols;

        cols = this.$roomEditor.getPropertyOptions('monsters');
        cols.editor.options.columns[0].editor.options.data = data;
        this.$roomEditor.setPropertyOptions('monsters', cols);
    }

    private updateObjects(noRows?) {
        if (!noRows)
            this.$objectGrid.rows = Object.keys(this.$area.objects).map(m => {
                return {
                    id: m,
                    name: this.$area.objects[m].name,
                    short: this.$area.objects[m].short,
                    type: this.$area.objects[m].type,
                    object: this.$area.objects[m]
                };
            });
        const data = Object.values<StdObject>(this.$area.objects).map(o => {
            return {
                display: stripPinkfish(o.name || o.short),
                value: o.id
            };
        });
        let cols = this.$monsterGrid.columns;
        cols[5].editor.options.columns[0].editor.options.data = data;
        this.$monsterGrid.columns = cols;

        cols = this.$propertiesEditor.monsterGrid.columns;
        cols[3].editor.options.columns[0].editor.options.data = data;
        this.$propertiesEditor.monsterGrid.columns = cols;

        cols = this.$propertiesEditor.roomGrid.columns;
        cols[2].editor.options.columns[0].editor.options.data = data;
        this.$propertiesEditor.roomGrid.columns = cols;

        cols = this.$roomEditor.getPropertyOptions('objects');
        cols.editor.options.columns[0].editor.options.data = data;
        this.$roomEditor.setPropertyOptions('objects', cols);
        cols = this.$roomEditor.getPropertyOptions('forageObjects');
        cols.editor.options.columns[0].editor.options.data = data;
        this.$roomEditor.setPropertyOptions('forageObjects', cols);
        cols = this.$roomEditor.getPropertyOptions('rummageObjects');
        cols.editor.options.columns[0].editor.options.data = data;
        this.$roomEditor.setPropertyOptions('rummageObjects', cols);
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

    public openNotes() {
        this.$roomEditor.beginEdit('notes', true);
    }

    public generateCode(p, data) {
        if (!p) return;
        this.emit('progress-start', 'designer');
        this.$cancel = false;
        try {
            const files = {};
            data = data || {};
            if (this.$cancel)
                throw new Error('Canceled');
            this.emit('progress', { type: 'designer', percent: 0, title: 'Generating file names&hellip;' });
            //#region Generate file names
            let counts = {};
            //generate monster names, count in case they have the same name and store based on unique id for lookup in code generate
            Object.keys(this.$area.monsters).forEach(m => {
                if (this.$cancel)
                    throw new Error('Canceled');
                let name = this.$area.monsters[m].name.trim().replace(/ /g, '_').toLowerCase();
                //empty name try base name
                if (name.length === 0) {
                    const base: Monster = this.$area.monsters[this.$area.monsters[m].type] || this.$area.baseMonsters[this.$area.monsters[m].type] || new Monster();
                    name = base.name.trim().replace(/ /g, '_').toLowerCase();
                    //if still empty default to generic monster
                    if (name.length === 0)
                        name = 'monster';
                }
                if (!counts[name])
                    counts[name] = 1;
                else
                    counts[name]++;
                if (counts[name] === 1)
                    files[m] = name;
                else
                    files[m] = name + counts[name];
            });
            if (this.$cancel)
                throw new Error('Canceled');
            //generate object names, count in case they have the same name and store based on unique id for lookup in code generate
            counts = {};
            Object.keys(this.$area.objects).forEach(m => {
                if (this.$cancel)
                    throw new Error('Canceled');
                const name = stripPinkfish(this.$area.objects[m].name).replace(/ /g, '_').toLowerCase() || 'object';
                if (!counts[name])
                    counts[name] = 1;
                else
                    counts[name]++;
                if (counts[name] === 1)
                    files[m] = name;
                else
                    files[m] = name + counts[name];
            });
            if (this.$cancel)
                throw new Error('Canceled');
            //generate room names and assign to x/y/z as if rooms are empty they will be skipped
            counts = {};
            const zl = this.$area.size.depth;
            const xl = this.$area.size.width;
            const yl = this.$area.size.height;
            const externs = {};
            let ec = 0;
            for (let z = 0; z < zl; z++) {
                for (let y = 0; y < yl; y++) {
                    for (let x = 0; x < xl; x++) {
                        if (this.$cancel)
                            throw new Error('Canceled');
                        const r = this.$area.rooms[z][y][x];
                        const base = this.$area.baseRooms[r.type] || this.$area.baseRooms[this.$area.defaultRoom] || new Room(0, 0, 0);
                        if (r.empty || r.equals(base, true)) continue;
                        const name = (r.subArea && r.subArea.length > 0 ? r.subArea : data.area).toLowerCase();
                        if (!counts[name])
                            counts[name] = 1;
                        else
                            counts[name]++;
                        files[`${x},${y},${z}`] = name + counts[name];
                        Object.values<Exit>(r.exitsDetails).forEach(e => {
                            if (!e.dest || e.dest.length === 0 || files[e.dest]) return;
                            if (e.dest.match(/^\d+\s*,\s*\d+\s*,\s*\d+$/) || e.dest.match(/^\d+\s*,\s*\d+$/) || e.dest.match(/^\$\{(rms|mon|std|cmds|obj)\}/i))
                                return;
                            ec++;
                            //if path exist see if any match to avoid more redefines
                            if (data.path) {
                                if (e.dest.startsWith(data.path + '/mon/')) {
                                    files[e.dest] = `MON + "${e.dest.substring(data.path.length + 5)}"`;
                                    return;
                                }
                                if (e.dest.startsWith(data.path + '/std/')) {
                                    files[e.dest] = `STD + "${e.dest.substring(data.path.length + 5)}"`;
                                    return;
                                }
                                if (e.dest.startsWith(data.path + '/obj/')) {
                                    files[e.dest] = `OBJ + "${e.dest.substring(data.path.length + 5)}"`;
                                    return;
                                }
                                if (e.dest.startsWith(data.path + '/cmds/')) {
                                    files[e.dest] = `CMDS + "${e.dest.substring(data.path.length + 6)}"`;
                                    return;
                                }
                                if (e.dest.startsWith(data.path + '/')) {
                                    files[e.dest] = `RMS + "${e.dest.substring(data.path.length + 1)}"`;
                                    return;
                                }
                            }
                            const parts = path.dirname(e.dest).split('/');
                            let dest;
                            if (parts.length === 1)
                                dest = `DIR_${e.dest.toUpperCase()}`;
                            else if (parts.length > 1)
                                dest = `DIR_${parts[parts.length - 2].toUpperCase()}_${parts[parts.length - 1].toUpperCase()}`;
                            if (externs[dest] && path.dirname(e.dest) !== externs[dest])
                                dest += ec;
                            externs[dest] = path.dirname(e.dest);
                            files[e.dest] = `${dest} + "${path.basename(e.dest)}"`;
                        });
                    }
                }
            }
            if (this.$cancel)
                throw new Error('Canceled');
            Object.keys(counts).filter(c => counts[c] === 1).forEach(c => {
                Object.keys(files).filter(f => files[f] === c + '1').forEach(f => files[f] = c);
            });
            Object.keys(this.$area.baseRooms).forEach(r => files[r + 'room'] = r.replace(/ /g, '_').toUpperCase() + 'ROOM');
            Object.keys(this.$area.baseMonsters).forEach(r => files[r + 'monster'] = r.replace(/ /g, '_').toUpperCase() + 'MONSTER');
            if (this.$cancel)
                throw new Error('Canceled');
            //#endregion
            this.emit('progress', { type: 'designer', percent: 10, title: 'Creating paths&hellip;' });
            //create paths
            fs.mkdirSync(p);
            fs.mkdirSync(path.join(p, 'obj'));
            fs.mkdirSync(path.join(p, 'mon'));
            fs.mkdirSync(path.join(p, 'std'));
            if (this.$cancel)
                throw new Error('Canceled');
            this.emit('progress', { type: 'designer', percent: 20, title: 'Creating base files' });
            //Generate area.h
            const template = copy(data);
            const templePath = parseTemplate(path.join('{assets}', 'templates', 'wizards', 'designer'));
            template['area post'] = '\n';
            template['doc'] = '';

            template['area post'] += '//Define base room inherits\n';
            Object.keys(this.$area.baseRooms).forEach(r => template['area post'] += `#define ${files[r + 'room']} (STD + "${files[r + 'room'].toLowerCase()}")\n`);
            template['area post'] += '//Define base monster inherits\n';
            Object.keys(this.$area.baseMonsters).forEach(r => template['area post'] += `#define ${files[r + 'monster']} (STD + "${files[r + 'monster'].toLowerCase()}")\n`);

            const temp = Object.keys(this.$area.baseMonsters).filter(r => this.$area.baseMonsters[r].maxAmount > 0);
            if (this.$cancel)
                throw new Error('Canceled');
            if (temp.length > 0) {
                template['area post'] += '//Define monster maxes\n';
                temp.forEach(r => template['area post'] += `#define MAX${r.replace(/ /g, '_').toUpperCase()} ${this.$area.baseMonsters[r].maxAmount}\n`);
            }

            if (ec > 0) {
                template['area post'] += '//Define external paths\n';
                Object.keys(externs).forEach(r => template['area post'] += `#define ${r} ("${externs[r]}")\n`);
            }

            this.write(this.parseFileTemplate(fs.readFileSync(path.join(templePath, 'area.h'), 'utf8'), template), path.join(p, 'area.h'));
            //Generate base rooms
            if (this.$cancel)
                throw new Error('Canceled');
            this.emit('progress', { type: 'designer', percent: 24, title: 'Creating base generateRoomCodefiles&hellip;' });
            Object.keys(this.$area.baseRooms).forEach(r => this.write(this.generateRoomCode(this.$area.baseRooms[r].clone(), files, copy(data), true), path.join(p, 'std', files[r + 'room'].toLowerCase() + '.c')));
            //generate base monsters
            if (this.$cancel)
                throw new Error('Canceled');
            this.emit('progress', { type: 'designer', percent: 28, title: 'Creating base files&hellip;' });
            Object.keys(this.$area.baseMonsters).forEach(r => this.write(this.generateMonsterCode(this.$area.baseMonsters[r].clone(), files, copy(data), true), path.join(p, 'std', files[r + 'monster'].toLowerCase() + '.c')));
            //generate monsters
            if (this.$cancel)
                throw new Error('Canceled');
            this.emit('progress', { type: 'designer', percent: 30, title: 'Creating monster files&hellip;' });
            Object.keys(this.$area.monsters).forEach(r => this.write(this.generateMonsterCode(this.$area.monsters[r].clone(), files, copy(data)), path.join(p, 'mon', files[r] + '.c')));
            //generate objects
            if (this.$cancel)
                throw new Error('Canceled');
            this.emit('progress', { type: 'designer', percent: 40, title: 'Creating object files&hellip;' });
            Object.keys(this.$area.objects).forEach(r => this.write(this.generateObjectCode(this.$area.objects[r].clone(), files, copy(data)), path.join(p, 'obj', files[r] + '.c')));
            this.emit('progress', { type: 'designer', percent: 50, title: 'Creating room files&hellip;' });
            //generate rooms
            let count = 0;
            for (let z = 0; z < zl; z++) {
                for (let y = 0; y < yl; y++) {
                    for (let x = 0; x < xl; x++) {
                        if (this.$cancel)
                            throw new Error('Canceled');
                        const r = this.$area.rooms[z][y][x];
                        const base: Room = this.$area.baseRooms[r.type] || this.$area.baseRooms[this.$area.defaultRoom];
                        if (r.empty || r.equals(base, true)) continue;
                        this.write(this.generateRoomCode(r.clone(), files, copy(data)), path.join(p, files[`${r.x},${r.y},${r.z}`] + '.c'));
                        count++;
                        this.emit('progress', { type: 'designer', percent: 50 + Math.round(50 * count / this.$roomCount) });
                    }
                }
            }
            this.emit('progress-complete', 'designer');
        }
        catch (err) {
            if (typeof err === 'string' && err === 'Canceled')
                this.emit('progress-canceled', 'designer');
            else if (err && err.message === 'Canceled')
                this.emit('progress-canceled', 'designer');
            else
                this.emit('progress-error', 'designer', err);
        }
    }

    public generateRoomCode(room: Room, files, data, baseRoom?) {
        if (!room) return '';
        if (this.$cancel)
            throw new Error('Canceled');
        files = files || {};
        let tmp;
        let tmp2;
        let tmp3;
        let tmp4;
        const eArray: Exit[] = Object.values(room.exitsDetails);
        const doors = eArray.filter(r => r.exit.length > 0 && r.door && r.door.length > 0 && !r.climb);
        const exits = eArray.filter(r => r.exit.length > 0 && (!r.door || r.door.length === 0) && !r.climb);
        const climbs = eArray.filter(r => r.exit.length > 0 && (!r.door || r.door.length === 0) && r.climb);
        let props: any = {};
        let tempProps: any = {};
        data.doc = [];
        data.includes = '';
        data.description = '';
        data['create pre'] = '';
        data['create body'] = '';
        data['create post'] = '';
        data['create arguments'] = '';
        data['reset body'] = '';
        data['reset post'] = '';
        const base: Room = this.$area.baseRooms[room.type] || this.$area.baseRooms[this.$area.defaultRoom] || new Room(0, 0, 0);
        tmp2 = room.objects.filter(o => this.$area.objects[o.id] && (o.minAmount > 0 || o.unique));
        tmp3 = room.monsters.filter(o => this.$area.monsters[o.id] && (o.minAmount > 0 || o.unique));
        if (baseRoom && (room.forage !== base.forage || doors.length > 0 || tmp2.length !== 0 || tmp3.length !== 0)) {
            data['reset body'] += '\n';
            if (room.forage !== base.forage)
                props['forage'] = room.forage;
            doors.forEach(r => {
                if (r.key.length !== 0)
                    data['reset body'] += `   set_locked("${r.door}", ${r.locked ? 1 : 0});\n`;
                data['reset body'] += `   set_open("${r.door}", ${r.closed ? 0 : 1});\n`;
            });
            if (tmp2.length !== 0) {
                data['reset body'] += '   if(!query_property("no clone objects"))\n   {\n';
                tmp2.forEach(o => {
                    tmp = '';
                    if (o.unique)
                        tmp = `      clone_unique(OBJ + "${files[o.id]}.c");\n`;
                    else if (o.minAmount > 0 && (o.minAmount === o.maxAmount || o.maxAmount < 1))
                        tmp = `      clone_max(OBJ + "${files[o.id]}.c", ${o.minAmount});\n`;
                    else if (o.minAmount > 0 && o.maxAmount > 0)
                        tmp = `      clone_max(OBJ + "${files[o.id]}.c", ${o.minAmount} + random(${o.maxAmount - o.minAmount}));\n`;
                    if (o.random > 0 && tmp.length !== 0 && o.random < 100)
                        data['reset body'] += `      if(random(${o.random}) <= random(101))\n   `;
                    data['reset body'] += tmp;
                });
                if (tmp2.filter(o => this.$area.objects[o.id].type === StdObjectType.chest && (o.minAmount > 0 || o.unique)).length !== 0)
                    data['reset body'] += '      filter(query_item_contents(), (: $1->is_chest() :))->reset_chest();\n';
                data['reset body'] += '   }\n';
            }

            if (tmp3.length !== 0) {
                data['reset body'] += `   //Perform a property check to allow disabling of default monsters\n   if(query_property("no clone monsters"))\n      return;\n   // If monsters already in room do not create more\n   if(sizeof(filter(query_living_contents(), (: $1->is_${data.area}_monster() :) )))\n      return;\n`;
                tmp3.forEach(o => {
                    const mon = this.$area.monsters[o.id];
                    if (!mon) return;
                    let max = '';
                    tmp = '';
                    if (this.$area.baseMonsters[mon.type]) {
                        if (this.$area.baseMonsters[mon.type].maxAmount > 0)
                            max = `MAX${mon.type.replace(/ /g, '_').toUpperCase()}`;
                    }
                    if (o.unique)
                        tmp = `   clone_unique(MON + "${files[o.id]}.c");\n`;
                    else if (o.minAmount > 0 && (o.minAmount === o.maxAmount || o.maxAmount < 1)) {
                        if (max.length !== 0)
                            tmp = `   clone_max_children(MON + "${files[o.id]}.c", ${o.minAmount}, ${max});\n`;
                        else
                            tmp = `   clone_max(MON + "${files[o.id]}.c", ${o.minAmount});\n`;
                    }
                    else if (max.length !== 0 && o.minAmount > 0 && o.maxAmount > 0)
                        tmp = `   clone_max_children(MON + "${files[o.id]}.c", ${o.minAmount} + random(${o.maxAmount - o.minAmount}), ${max});\n`;
                    else if (o.minAmount > 0 && o.maxAmount > 0)
                        tmp = `   clone_max(MON + "${files[o.id]}.c", ${o.minAmount} + random(${o.maxAmount - o.minAmount}));\n`;

                    if (o.random > 0 && tmp.length !== 0 && o.random < 100)
                        data['reset body'] += `  if(random(${o.random}) <= random(101))\n   `;
                    data['reset body'] += tmp;
                });
            }
        }
        else if (!baseRoom && (room.forage !== base.forage || doors.length > 0 || tmp2.length !== 0 || tmp3.length !== 0)) {
            data['create post'] += '\n\nvoid reset()\n{\n   ::reset();\n';
            if (room.forage !== base.forage)
                props['forage'] = room.forage;
            doors.forEach(r => {
                data['create post'] += `   set_locked("${r.door}", ${r.locked ? 1 : 0});\n`;
                data['create post'] += `   set_open("${r.door}", ${r.closed ? 0 : 1});\n`;
            });
            if (tmp2.length !== 0) {
                tmp2.forEach(o => {
                    tmp = '';
                    if (o.unique)
                        tmp = `   clone_unique(OBJ + "${files[o.id]}.c");\n`;
                    else if (o.minAmount > 0 && (o.minAmount === o.maxAmount || o.maxAmount === 0))
                        tmp = `   clone_max(OBJ + "${files[o.id]}.c", ${o.minAmount});\n`;
                    else if (o.minAmount > 0 && o.maxAmount > 0)
                        tmp = `   clone_max(OBJ + "${files[o.id]}.c", ${o.minAmount} + random(${o.maxAmount - o.minAmount}));\n`;
                    if (o.random > 0 && tmp.length !== 0 && o.random < 100)
                        data['create post'] += `   if(random(${o.random}) <= random(101))\n   `;
                    data['create post'] += tmp;
                });
                if (tmp2.filter(o => this.$area.objects[o.id].type === StdObjectType.chest && (o.minAmount > 0 || o.unique)).length !== 0)
                    data['create post'] += '   filter(query_item_contents(), (: $1->is_chest() :))->reset_chest();\n';
            }
            if (tmp3.length !== 0) {
                tmp3.forEach(o => {
                    const mon = this.$area.monsters[o.id];
                    if (!mon) return;
                    let max = '';
                    tmp = '';
                    if (this.$area.baseMonsters[mon.type]) {
                        if (this.$area.baseMonsters[mon.type].maxAmount > 0)
                            max = `MAX${mon.type.replace(/ /g, '_').toUpperCase()}`;
                    }
                    if (o.unique)
                        tmp = `   clone_unique(MON + "${files[o.id]}.c");\n`;
                    else if (o.minAmount > 0 && (o.minAmount === o.maxAmount || o.maxAmount < 1)) {
                        if (max.length !== 0)
                            tmp = `   clone_max_children(MON + "${files[o.id]}.c", ${o.minAmount}, ${max});\n`;
                        else
                            tmp = `   clone_max(MON + "${files[o.id]}.c", ${o.minAmount});\n`;
                    }
                    else if (max.length !== 0 && o.minAmount > 0 && o.maxAmount > 0)
                        tmp = `   clone_max_children(MON + "${files[o.id]}.c", ${o.minAmount} + random(${o.maxAmount - o.minAmount}), ${max});\n`;
                    else if (o.minAmount > 0 && o.maxAmount > 0)
                        tmp = `   clone_max(MON + "${files[o.id]}.c", ${o.minAmount} + random(${o.maxAmount - o.minAmount}));\n`;
                    if (o.random > 0 && tmp.length !== 0 && o.random < 100)
                        data['create post'] += `   if(random(${o.random}) <= random(101))\n   `;
                    data['create post'] += tmp;
                });
            }
            data['create post'] += '}\n';
        }

        tmp2 = room.forageObjects.filter(o => this.$area.objects[o.id]).sort((a, b) => {
            if ((a.random === 0 || a.random >= 100) && b.random > 0 && b.random < 100)
                return 1;
            if ((b.random === 0 || b.random >= 100) && a.random > 0 && a.random < 100)
                return -1;
            if (a.id > b.id)
                return 1;
            if (a.id < b.id)
                return -1;
            return 0;
        });
        if (tmp2.length !== 0) {
            if (data['create post'].length === 0)
                data['create post'] += '\n';
            data['create post'] += '\nobject query_forage(object player)\n{\n';
            tmp = false;
            tmp2.forEach((o, i) => {
                if (o.random > 0 && o.random < 100)
                    data['create post'] += `   if(random(${o.random}) <= random(101))\n   `;
                else
                    tmp = true;
                data['create post'] += `   return new(OBJ + "${files[o.id]}.c");\n`;
            });

            if ((room.baseFlags & RoomBaseFlags.No_Forage_Objects) !== RoomBaseFlags.No_Forage_Objects && base.forageObjects.filter(o => this.$area.objects[o.id]).length !== 0)
                data['create post'] += '   return ::query_forage();\n';
            else if (!tmp)
                data['create post'] += '   return 0;\n';
            data['create post'] += '}\n';
        }

        tmp2 = room.rummageObjects.filter(o => this.$area.objects[o.id]).sort((a, b) => {
            if ((a.random === 0 || a.random >= 100) && b.random > 0 && b.random < 100)
                return 1;
            if ((b.random === 0 || b.random >= 100) && a.random > 0 && a.random < 100)
                return -1;
            if (a.id > b.id)
                return 1;
            if (a.id < b.id)
                return -1;
            return 0;
        });
        if (tmp2.length !== 0) {
            if (data['create post'].length === 0)
                data['create post'] += '\n';
            data['create post'] += '\nobject query_rummage(object player)\n{\n';
            tmp = false;
            tmp2.forEach((o, i) => {
                if (o.random > 0 && o.random < 100)
                    data['create post'] += `   if(random(${o.random}) <= random(101))\n   `;
                else
                    tmp = true;
                data['create post'] += `   return new(OBJ + "${files[o.id]}.c");\n`;
            });
            if ((room.baseFlags & RoomBaseFlags.No_Rummage_Objects) !== RoomBaseFlags.No_Rummage_Objects && base.forageObjects.filter(o => this.$area.objects[o.id]).length !== 0)
                data['create post'] += '   return ::query_rummage();\n';
            else if (!tmp)
                data['create post'] += '   return 0;\n';
            data['create post'] += '}\n';
        }

        if (!room.type)
            room.type = 'STD_ROOM';
        if (room.type === 'STD_ROOM' && climbs.length !== 0)
            room.type = 'ROOMTYPE_CLIMB';
        else if (room.type === 'STD_ROOM' && doors.length !== 0)
            room.type = 'ROOMTYPE_VAULT';

        data.inherit = files[room.type + 'room'] || room.type.toUpperCase();
        data.inherits = '';
        if (climbs.length !== 0 && room.type !== 'ROOMTYPE_CLIMB' && base.type !== 'ROOMTYPE_CLIMB') {
            data.inherits += '\ninherit CLIMBING;';
            data.doc.push('/doc/build/etc/climbing');
        }
        data.doc.push('/doc/build/areas/tutorial');
        switch (room.type.toUpperCase()) {
            case 'ROOMTYPE_ADVANCE_ROOM':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/bank');
                break;
            case 'ROOMTYPE_BANK':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/bank');
                break;
            case 'ROOMTYPE_CLASS_JOIN':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/classjoin');
                break;
            case 'ROOMTYPE_CLIMB':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/climb');
                data.doc.push('/doc/build/etc/climbing');
                break;
            case 'ROOMTYPE_DOCK':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/pier');
                data.doc.push('/doc/build/room/types/dock');
                break;
            case 'ROOMTYPE_GUILD_HALL':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/guild_hall');
                data.doc.push('/doc/build/etc/voter');
                break;
            case 'ROOMTYPE_INN':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/inn');
                break;
            case 'ROOMTYPE_LIBRARY':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/library');
                break;
            case 'ROOMTYPE_LOCKER':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/locker');
                break;
            case 'ROOMTYPE_MODROOM':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/modroom');
                break;
            case 'ROOMTYPE_PIER':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/pier');
                data.doc.push('/doc/build/room/fishing');
                break;
            case 'ROOMTYPE_SAGE':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/library');
                data.doc.push('/doc/build/room/types/sage');
                data.doc.push('/doc/build/etc/sagebase');
                break;
            case 'ROOMTYPE_SINK_ROOM':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/sink_room');
                break;
            case 'ROOMTYPE_SKY_ROOM':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/sky_room');
                break;
            case 'ROOMTYPE_STABLE':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/stable');
                break;
            case 'ROOMTYPE_TRAIN_ROOM':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('/doc/build/room/types/train_room');
                break;
            case 'ROOMTYPE_VAULT':
                data.doc.push('/doc/build/room/doors');
                data.doc.push('/doc/build/room/types/vault');
                break;
            case 'ROOMTYPE_VENDOR_STORAGE':
                data.doc.push('/doc/build/room/types/vault');
                data.doc.push('doc/build/room/types/vendor_storage');
                break;
        }
        if (room.short !== base.short) {
            room.short = room.short.trim();
            if (room.short.startsWith('(:')) {
                data['create body'] += `   set_short(${formatFunctionPointer(room.short)});\n`;
                data['create pre'] += createFunction(room.short, 'string');
                data.name = room.short.substr(2);
                if (data.name.endsWith(':)'))
                    data.name = data.name.substr(0, data.name.length - 1);
                data.name = data.name.trim();
            }
            else if (room.short.startsWith('"') && room.short.endsWith('"')) {
                data['create body'] += `   set_short(${room.short});\n`;
                data.name = data.short.substr(1, data.short.length - 2);
            }
            else if (room.short.length !== 0 || base.short.length === 0) {
                data['create body'] += `   set_short("${room.short.replace(/"/g, '\\"')}");\n`;
                data.name = room.short;
            }
        }
        else {
            data.name = room.short.trim();
            if (data.name.startsWith('(:')) {
                data.name = formatFunctionPointer(data.name).substr(2);
                if (data.name.endsWith(':)'))
                    data.name = data.name.substr(0, data.name.length - 1);
                data.name = data.name.trim();
            }
            else if (data.name.startsWith('"') && data.name.endsWith('"'))
                data.name = data.name.substr(1, data.name.length - 2);
            else
                data.name = `"${data.name.replace(/"/g, '\\"')}"`;
        }
        if (room.long !== base.long) {
            room.long = room.long.trim();
            if (room.long.startsWith('(:')) {
                data['create body'] += `   set_long(${formatFunctionPointer(room.long)});\n`;
                data['create pre'] += createFunction(room.long, 'string');
                data.description = room.long.substr(2);
                if (data.description.endsWith(':)'))
                    data.description = data.description.substr(0, data.description.length - 2);
                data.description = data.description.trim();
            }
            else if (room.long.length !== 0 || base.long.length === 0) {
                if (room.long.startsWith('"') && room.long.endsWith('"'))
                    room.long = room.long.substr(1, room.long.length - 2);
                else
                    room.long = room.long.replace(/"/g, '\\"');
                if (room.long.length > 70) {
                    data.description = formatString(room.long, 0, 77, ' * ', '');
                    tmp = room.long.substr(0, 66);
                    let tl = tmp.length;
                    while (tl--) {
                        if (tmp.charAt(tl) === ' ') {
                            tmp = tmp.substr(0, tl + 1);
                            break;
                        }
                    }
                    data['create body'] += `   set_long("${tmp}"\n     `;
                    room.long = room.long.substr(tmp.length);
                    data['create body'] += `${formatString(room.long, 5, 73)});\n`;
                }
                else if (room.long.length) {
                    data['create body'] += `   set_long("${room.long}");\n`;
                    data.description = ' * ' + room.long;
                }
            }
        }
        else {
            data.description = room.long.trim();
            if (data.description.startsWith('(:')) {
                data.description = formatFunctionPointer(data.description).substr(2);
                if (data.description.endsWith(':)'))
                    data.description = data.description.substr(0, data.description.length - 2);
                data.description = data.description.trim();
            }
            else {
                if (data.description.startsWith('"') && data.description.endsWith('"'))
                    data.description = data.description.substr(1, data.description.length - 2);
                if (data.description.length > 70)
                    data.description = formatString(data.description, 0, 77, ' * ', '');
                else
                    data.description = ' * ' + data.description;
            }
        }
        data.description = stripPinkfish(data.description);

        if (room.terrain !== base.terrain)
            data['create body'] += `   set_terrain("${room.terrain}");\n`;

        if (room.light !== base.light)
            props['light'] = room.light;
        if ((room.flags & RoomFlags.Indoors) === RoomFlags.Indoors && (base.flags & RoomFlags.Indoors) !== RoomFlags.Indoors)
            props['indoors'] = 1;
        if ((room.flags & RoomFlags.No_Magic) === RoomFlags.No_Magic && (base.flags & RoomFlags.No_Magic) !== RoomFlags.No_Magic)
            props['no magic'] = 1;
        if ((room.flags & RoomFlags.No_Attack) === RoomFlags.No_Attack && (base.flags & RoomFlags.No_Attack) !== RoomFlags.No_Attack)
            props['no attack'] = 1;
        if ((room.flags & RoomFlags.No_Scry) === RoomFlags.No_Scry && (base.flags & RoomFlags.No_Scry) !== RoomFlags.No_Scry)
            props['no scry'] = 1;
        if ((room.flags & RoomFlags.No_Teleport) === RoomFlags.No_Teleport && (base.flags & RoomFlags.No_Teleport) !== RoomFlags.No_Teleport)
            props['no teleport'] = 1;
        if ((room.flags & RoomFlags.No_MGive) === RoomFlags.No_MGive && (base.flags & RoomFlags.No_MGive) !== RoomFlags.No_MGive)
            props['no mgive'] = 1;
        if ((room.flags & RoomFlags.Council) === RoomFlags.Council && (base.flags & RoomFlags.Council) !== RoomFlags.Council)
            props['council'] = 1;
        if ((room.flags & RoomFlags.No_Map_Send) === RoomFlags.No_Map_Send && (base.flags & RoomFlags.No_Map_Send) !== RoomFlags.No_Map_Send)
            props['no send info'] = 1;
        if ((room.flags & RoomFlags.Melee_As_Ability) === RoomFlags.Melee_As_Ability && (base.flags & RoomFlags.Melee_As_Ability) !== RoomFlags.Melee_As_Ability)
            props['melee as ability'] = 1;
        if ((room.flags & RoomFlags.Enable_Pk) === RoomFlags.Enable_Pk && (base.flags & RoomFlags.Enable_Pk) !== RoomFlags.Enable_Pk)
            props['enable pk'] = 1;
        if ((room.flags & RoomFlags.Hide_Exits) === RoomFlags.Hide_Exits && (base.flags & RoomFlags.Hide_Exits) !== RoomFlags.Hide_Exits)
            props['hide exits'] = 1;
        if ((room.flags & RoomFlags.No_Forage) === RoomFlags.No_Forage && (base.flags & RoomFlags.No_Forage) !== RoomFlags.No_Forage)
            props['no forage'] = 1;
        if ((room.flags & RoomFlags.No_Dirt) === RoomFlags.No_Dirt && (base.flags & RoomFlags.No_Dirt) !== RoomFlags.No_Dirt)
            props['no dirt'] = 1;
        if (room.dirtType !== base.dirtType)
            props['dirt type'] = `"${room.dirtType}"`;
        if ((room.flags & RoomFlags.Underwater) === RoomFlags.Underwater && (base.flags & RoomFlags.Underwater) !== RoomFlags.Underwater)
            props['underwater'] = 1;
        if ((room.baseFlags & RoomBaseFlags.No_Monsters) === RoomBaseFlags.No_Monsters && (base.baseFlags & RoomBaseFlags.No_Monsters) !== RoomBaseFlags.No_Monsters)
            props['no clone monsters'] = 1;
        if ((room.baseFlags & RoomBaseFlags.No_Objects) === RoomBaseFlags.No_Objects && (base.baseFlags & RoomBaseFlags.No_Objects) !== RoomBaseFlags.No_Objects)
            props['no clone objects'] = 1;

        if (room.properties.length > 0) {
            room.properties.forEach(b => {
                b.value = b.value.trim();
                if (b.value.startsWith('(:')) {
                    if (b.type === 1)
                        tempProps[b.name] = formatFunctionPointer(b.value);
                    else
                        props[b.name] = formatFunctionPointer(b.value);
                    data['create pre'] += createFunction(b.value);
                }
                else if (b.value.startsWith('({')) {
                    tmp2 = b.value.substring(2);
                    if (tmp2.endsWith('})'))
                        tmp2 = tmp2.substr(0, tmp2.length - 2);
                    tmp2 = tmp2.split(',');
                    tmp2 = tmp2.map(t => {
                        t = t.trim();
                        if ((t.startsWith('"') && t.endsWith('"')) || t.match(/^\d+$/))
                            return t;
                        else if (t.startsWith('(:')) {
                            t = formatFunctionPointer(t);
                            data['create pre'] += createFunction(t);
                            return t;
                        }
                        return `"${t}"`;
                    });
                    if (b.type === 1)
                        tempProps[b.name] = `({ ${tmp2.join(', ')} })`;
                    else
                        props[b.name] = `({ ${tmp2.join(', ')} })`;
                }
                else if ((b.value.startsWith('"') && b.value.endsWith('"')) || b.value.match(/^\d+$/)) {
                    if (b.type === 1)
                        tempProps[b.name] = b.value;
                    else
                        props[b.name] = b.value;
                }
                else {
                    if (b.type === 1)
                        tempProps[b.name] = `"${b.value}"`;
                    else
                        props[b.name] = `"${b.value}"`;
                }
            });
        }

        room.secretExit = room.secretExit.trim();
        if (room.secretExit !== base.secretExit.trim()) {
            if (room.secretExit === 'false') { /**/ }
            else if (room.secretExit.startsWith('(:')) {
                props['secret exit'] = formatFunctionPointer(room.secretExit, true);
                data['create pre'] += createFunction(room.secretExit, 'string', 'object room, object player');
            }
            else if (room.secretExit === 'true')
                props['secret exit'] = 1;
            else if (typeof room.secretExit === 'string' && parseFloat(room.secretExit).toString() === room.secretExit)
                props['secret exit'] = room.secretExit;
            else if (room.secretExit.length > 0) {
                props['secret exit'] = `"${room.secretExit.replace(/"/g, '\\"')}"`;
            }
        }
        if (room.maxForage !== base.maxForage)
            props['maxforage'] = room.maxForage;

        tempProps = Object.keys(tempProps).map(k => `"${k}" : ${tempProps[k]}`);
        props = Object.keys(props).map(k => `"${k}" : ${tempProps[k]}`);

        if (tempProps.length === 1)
            data['create body'] += `   set_temp_property(${tempProps[0].replace(' :', ',')});\n`;
        else if (tempProps.length > 0) {
            data['create body'] += '   set_temp_properties( ([\n       ';
            data['create body'] += tempProps.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }

        if (props.length === 1)
            data['create body'] += `   set_property(${props[0].replace(' :', ',')});\n`;
        else if (props.length > 0) {
            data['create body'] += '   set_properties( ([\n       ';
            data['create body'] += props.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }

        if ((room.flags & RoomFlags.Explored) === RoomFlags.Explored && (base.flags & RoomFlags.Explored) !== RoomFlags.Explored)
            data['create body'] += '   set_explored_marker(1);\n';
        if (room.nightAdjust !== base.nightAdjust)
            data['create body'] += `   set_night_adjust(${room.nightAdjust});\n`;

        room.preventPeer = room.preventPeer.trim();
        if (room.preventPeer !== base.preventPeer.trim()) {
            if (room.preventPeer === 'false') { /**/ }
            else if (room.preventPeer.startsWith('(:')) {
                data['create body'] += `   set_prevent_peer(${formatFunctionPointer(room.preventPeer)});\n`;
                data['create pre'] += createFunction(room.preventPeer, 'string', 'string dir, object player');
            }
            else if (room.preventPeer === 'true')
                data['create body'] += `   set_prevent_peer(1);\n`;
            else if (room.preventPeer.startsWith('"') && room.preventPeer.endsWith('"'))
                data['create body'] += `   set_prevent_peer(${room.preventPeer});\n`;
            else if (room.preventPeer.length > 0)
                data['create body'] += `   set_prevent_peer("${room.preventPeer.replace(/"/g, '\\"')}");\n`;
        }
        eArray.filter(p => p.peer && p.peer.trim().length > 0).forEach(p => {
            p.peer = p.peer.trim();
            if (p.peer === 'false') { /**/ }
            if (p.peer.startsWith('(:')) {
                data['create body'] += `   set_prevent_peer("${p.exit}", ${formatFunctionPointer(p.peer)});\n`;
                data['create pre'] += createFunction(p, 'string', 'string dir, object player');
            }
            else if (p.peer === 'true')
                data['create body'] += `   set_prevent_peer("${p.exit}", 1);\n`;
            else if (p.peer.startsWith('"') && p.peer.endsWith('"'))
                data['create body'] += `   set_prevent_peer("${p.exit}", ${p.peer});\n`;
            else
                data['create body'] += `   set_prevent_peer("${p.exit}", "${p.peer.replace(/"/g, '\\"')}");\n`;
        });
        //add items
        tmp = room.items.map(i => {
            tmp2 = i.item.split(',').map(t => {
                t.trim();
                if (!t.startsWith('"') && !t.endsWith('"'))
                    t = '"' + t + '"';
                return t;
            });
            if (tmp2.length === 1)
                tmp2 = tmp2[0];
            else
                tmp2 = `({ ${tmp2.join(', ')} })`;
            tmp3 = i.description.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'string');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            return `${tmp2} : ${tmp3}`;
        });
        if (tmp.length > 0) {
            if (base.items.length !== 0 && (room.baseFlags & RoomBaseFlags.No_Items) !== RoomBaseFlags.No_Items)
                data['create body'] += '   add_items( ([\n       ';
            else
                data['create body'] += '   set_items( ([\n       ';
            data['create body'] += tmp.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        //add exits
        tmp = exits.map(i => {
            if (i.exit.length === 0) return '';
            tmp2 = '';
            if (i.dest.length !== 0) {
                if (i.dest.match(/^\d+\s*,\s*\d+\s*,\s*\d+$/) && files[i.dest.replace(/ /g, '')])
                    tmp2 = `RMS + "${files[i.dest.replace(/ /g, '')]}.c"`;
                else if (i.dest.match(/^\d+\s*,\s*\d+$/) && files[i.dest.replace(/ /g, '') + ',0'])
                    tmp2 = `RMS + "${files[i.dest.replace(/ /g, '') + ',0']}.c"`;
                else if (files[i.dest])
                    tmp2 = `${files[i.dest]}`;
                else
                    tmp2 = this.parseFilePath(i.dest);
            }
            else {
                tmp3 = this.getExitId(i.exit, room.x, room.y, room.z);
                if (files[tmp3])
                    tmp2 = `RMS + "${files[tmp3]}.c"`;
            }
            if (!i.exit.startsWith('"') && !i.exit.endsWith('"'))
                i.exit = `"${i.exit}"`;
            if (i.blocker.length !== 0) {
                tmp3 = `"blockers" : ({ "${i.blocker.split(',').map(b => b.trim()).join('", "')}" })`;
                if (tmp2.length !== 0)
                    return `${i.exit} : ([\n         "room" : ${tmp2},\n         ${tmp3}\n       ])`;
                return `${i.exit} : ([\n       ${tmp3}\n     ])`;
            }
            else if (tmp2.length !== 0)
                return `${i.exit} : ${tmp2}`;
            return `${i.exit} : ""`;
        });
        if (tmp.length > 0) {
            data['create body'] += '   set_exits( ([\n       ';
            data['create body'] += tmp.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        tmp = exits.filter(i => i.hidden).map(i => `"${i.exit}"`);
        if (tmp.length > 0)
            data['create body'] += `   add_invis_exits(${formatArgumentList(tmp.join(', '), 61)});\n`;
        //add climbs
        tmp = climbs.map(i => {
            if (i.exit.length === 0) return '';
            tmp2 = [];
            if (i.dest.length !== 0) {
                if (i.dest.match(/^\d+\s*,\s*\d+\s*,\s*\d+$/) && files[i.dest.replace(/ /g, '')])
                    tmp2.push(`"dest" : RMS + "${files[i.dest.replace(/ /g, '')]}.c"`);
                else if (i.dest.match(/^\d+\s*,\s*\d+$/) && files[i.dest.replace(/ /g, '') + ',0'])
                    tmp2.push(`"dest" : RMS + "${files[i.dest.replace(/ /g, '') + ',0']}.c"`);
                else if (files[i.dest])
                    tmp2.push(`"dest" : ${files[i.dest]}`);
                else
                    tmp2.push(`"dest" : "${this.parseFilePath(i.dest)}"`);
            }
            else {
                tmp3 = this.getExitId(i.exit, room.x, room.y, room.z);
                if (files[tmp3])
                    tmp2.push(`"dest" : RMS + "${files[tmp3]}.c"`);
            }
            if (i.diff !== 0)
                tmp2.push(`"difficulty" : "${i.diff}"`);
            if (!i.exit.startsWith('"') && !i.exit.endsWith('"'))
                i.exit = `"${i.exit}"`;
            if (tmp2.length !== 0)
                return `${i.exit} : ([\n         ${tmp2.join(',\n         ')}\n       ])`;
            return `${i.exit} : ([])`;
        });
        if (tmp.length !== 0) {
            data['create body'] += '   set_climbs( ([\n       ';
            data['create body'] += tmp.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        //add doors
        doors.forEach(d => {
            //get destination path
            tmp = d.dest;
            if (tmp.length !== 0) {
                if (tmp.match(/^\d+\s*,\s*\d+\s*,\s*\d+$/) && files[tmp.replace(/ /g, '')])
                    tmp = `RMS + "${files[tmp.replace(/ /g, '')]}.c"`;
                else if (tmp.match(/^\d+\s*,\s*\d+$/) && files[tmp.replace(/ /g, '') + ',0'])
                    tmp = `RMS + "${files[tmp.replace(/ /g, '') + ',0']}.c"`;
                else if (files[tmp])
                    tmp = `${files[tmp]}`;
                else
                    tmp = this.parseFilePath(tmp);
            }
            else {
                tmp3 = this.getExitId(d.exit, room.x, room.y, room.z);
                if (files[tmp3])
                    tmp = `RMS + "${files[tmp3]}.c"`;
            }

            if (!d.door.startsWith('"') && !d.door.endsWith('"'))
                d.door = '"' + d.door + '"';
            if (!d.exit.startsWith('"') && !d.exit.endsWith('"'))
                d.exit = '"' + d.exit + '"';
            if (d.key.length === 0)
                d.key = '0';
            else if (!d.key.startsWith('"') && !d.key.endsWith('"'))
                d.key = '"' + d.key + '"';
            if (d.destDoor.length > 0) {
                if (!d.destDoor.startsWith('"') && !d.destDoor.endsWith('"'))
                    d.destDoor = '"' + d.destDoor + '"';
                data['create body'] += `   set_door(${d.door}, ${tmp}, ${d.exit}, ${d.key}, ${d.hidden ? 1 : 0}, ${d.destDoor});\n`;
            }
            else if (d.hidden)
                data['create body'] += `   set_door(${d.door}, ${tmp}, ${d.exit}, ${d.key}, 1);\n`;
            else if (d.key !== '0')
                data['create body'] += `   set_door(${d.door}, ${tmp}, ${d.exit}, ${d.key});\n`;
            else
                data['create body'] += `   set_door(${d.door}, ${tmp}, ${d.exit});\n`;
        });
        //smells
        tmp = copy(room.smells);
        tmp4 = base.smells.map(s => s.smell);
        if (room.smell && room.smell.length !== 0 && room.smell !== base.smell)
            tmp.unshift({ smell: 'default', description: room.smell });
        tmp.map(i => {
            const idx = tmp4.indexOf(i.smell);
            if (idx !== -1 && base.smells[idx].description === i.description)
                return '';
            tmp2 = i.smell.split(',').map(t => {
                t.trim();
                if (!t.startsWith('"') && !t.endsWith('"'))
                    t = '"' + t + '"';
                return t;
            });
            if (tmp2.length === 1)
                tmp2 = tmp2[0];
            else
                tmp2 = `({ ${tmp2.join(', ')} })`;
            tmp3 = i.description.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'string', 'string smell, object room, object player');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            return `${tmp2} : ${tmp3}`;
        });
        tmp = tmp.filter(s => s.length !== 0);

        if (tmp.length === 1 && room.smell.length !== 0 && room.smell !== base.smell) {
            room.smell = room.smell.trim();
            if (room.smell.startsWith('(:'))
                data['create body'] += `   set_smell(${formatFunctionPointer(room.smell)});\n`;
            else if (!room.smell.startsWith('"') && !room.smell.endsWith('"'))
                data['create body'] += `   set_smell("${room.smell}");\n`;
            else
                data['create body'] += `   set_smell(${room.smell});\n`;
        }
        else if (tmp.length > 0) {
            data['create body'] += '   set_smells( ([\n       ';
            data['create body'] += tmp.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        //sounds
        tmp = copy(room.sounds);
        tmp4 = base.sounds.map(s => s.sound);
        if (room.sound && room.sound.length !== 0 && room.sound !== base.sound)
            tmp.unshift({ sound: 'default', description: room.sound });
        tmp.map(i => {
            const idx = tmp4.indexOf(i.sound);
            if (idx !== -1 && base.sounds[idx].description === i.description)
                return '';
            tmp2 = i.sound.split(',').map(t => {
                t.trim();
                if (!t.startsWith('"') && !t.endsWith('"'))
                    t = '"' + t + '"';
                return t;
            });
            if (tmp2.length === 1)
                tmp2 = tmp2[0];
            else
                tmp2 = `({ ${tmp2.join(', ')} })`;
            tmp3 = i.description.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'string', 'string sound, object room, object player');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            return `${tmp2} : ${tmp3}`;
        });
        tmp = tmp.filter(s => s.length !== 0);

        if (tmp.length === 1 && room.sound.length !== 0 && room.sound !== base.sound) {
            room.sound = room.sound.trim();
            if (room.sound.startsWith('(:'))
                data['create body'] += `   set_listen(${formatFunctionPointer(room.sound)});\n`;
            else if (!room.sound.startsWith('"') && !room.sound.endsWith('"'))
                data['create body'] += `   set_listen("${room.sound}");\n`;
            else
                data['create body'] += `   set_listen(${room.sound});\n`;
        }
        else if (tmp.length > 0) {
            data['create body'] += '   set_listens( ([\n       ';
            data['create body'] += tmp.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        //searches
        tmp4 = base.searches.map(s => s.search);
        tmp = room.searches.map(i => {
            const idx = tmp4.indexOf(i.search);
            if (idx !== -1 && base.searches[idx].message === i.message)
                return '';
            tmp2 = i.search.split(',').map(t => {
                t.trim();
                if (!t.startsWith('"') && !t.endsWith('"'))
                    t = '"' + t + '"';
                return t;
            });
            if (tmp2.length === 1)
                tmp2 = tmp2[0];
            else
                tmp2 = `({ ${tmp2.join(', ')} })`;
            tmp3 = i.message.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'int');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            return `${tmp2} : ${tmp3}`;
        });
        tmp = tmp.filter(s => s.length !== 0);

        if (tmp.length === 1) {
            if (!room.searches[0].search.trim().startsWith('"') && !room.searches[0].search.trim().endsWith('"'))
                room.searches[0].search = `"${room.searches[0].search.trim()}"`;
            room.searches[0].message = room.searches[0].message.trim();
            if (room.searches[0].message.startsWith('(:'))
                data['create body'] += `   set_search(${room.searches[0].search}, ${formatFunctionPointer(room.searches[0].message)});\n`;
            else if (!room.searches[0].message.startsWith('"') && !room.searches[0].message.endsWith('"'))
                data['create body'] += `   set_search(${room.searches[0].search}, "${room.searches[0].message}");\n`;
            else
                data['create body'] += `   set_search(${room.searches[0].search}, ${room.searches[0].message});\n`;
        }
        else if (tmp.length > 0) {
            data['create body'] += '   set_search( ([\n       ';
            data['create body'] += tmp.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        if (room.temperature !== base.temperature)
            data['create body'] += `   set_temperature(${room.temperature});\n`;

        //#region reads
        tmp = room.reads.map(i => {
            tmp2 = i.read.split(',').map(t => {
                t.trim();
                if (!t.startsWith('"') && !t.endsWith('"'))
                    t = '"' + t + '"';
                return t;
            });
            if (tmp2.length === 1)
                tmp2 = tmp2[0];
            else
                tmp2 = `({ ${tmp2.join(', ')} })`;
            tmp3 = i.description.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'string', 'string id');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            if (tmp2.length === 0)
                tmp2 = 'default';
            if (i.language.length !== 0)
                return `${tmp2} : ([ "value" : ${tmp3}, "lang" : "${i.language}" ]) `;
            return `${tmp2} : ${tmp3}`;
        });

        if ((room.baseFlags & RoomBaseFlags.No_Reads) === RoomBaseFlags.No_Reads)
            tmp4 = 'set_read';
        else
            tmp4 = 'add_read';
        if (tmp.length === 1) {
            tmp = room.reads[0];
            tmp2 = tmp.read.split(',').map(t => {
                t.trim();
                if (!t.startsWith('"') && !t.endsWith('"'))
                    t = '"' + t + '"';
                return t;
            });
            if (tmp2.length === 1)
                tmp2 = tmp2[0];
            else
                tmp2 = `({ ${tmp2.join(', ')} })`;
            if ((tmp2 === 'default' || tmp2.length === 0) && tmp.language.length === 0)
                tmp2 = '';
            else if (tmp2.length === 0)
                tmp2 = '"default", ';
            else
                tmp2 += ', ';
            tmp.description = tmp.description.trim();
            tmp3 = '';
            if (tmp.language.length !== 0)
                tmp3 = `, "${tmp.language}"`;
            if (tmp.description.startsWith('(:'))
                data['create body'] += `   ${tmp4}(${tmp2}${formatFunctionPointer(tmp.description)}${tmp3});\n`;
            else if (!tmp.description.startsWith('"') && !tmp.description.endsWith('"'))
                data['create body'] += `   ${tmp4}(${tmp2}"${tmp.description}"${tmp3});\n`;
            else
                data['create body'] += `   ${tmp4}(${tmp2}${tmp.description}${tmp3});\n`;
        }
        else if (tmp.length > 0) {
            data['create body'] += `   ${tmp4}( ([\n       `;
            data['create body'] += tmp.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        //#endregion

        tmp = this.getExitId('up', room.x, room.y, room.z);
        tmp2 = this.getExitId('down', room.x, room.y, room.z);

        if ((files[tmp] && (room.flags & RoomFlags.Sinking_Up) === RoomFlags.Sinking_Up && (base.flags & RoomFlags.Sinking_Up) !== RoomFlags.Sinking_Up) || (files[tmp2] && (room.flags & RoomFlags.Sinking_Down) === RoomFlags.Sinking_Down && (base.flags & RoomFlags.Sinking_Down) !== RoomFlags.Sinking_Down))
            data['create body'] += '   set_living_sink(1);\n';
        if (files[tmp] && (room.flags & RoomFlags.Sinking_Up) === RoomFlags.Sinking_Up && (base.flags & RoomFlags.Sinking_Up) !== RoomFlags.Sinking_Up)
            data['create body'] += `   set_up(RMS + "${files[tmp]}.c");\n`;
        if (files[tmp2] && (room.flags & RoomFlags.Sinking_Down) === RoomFlags.Sinking_Down && (base.flags & RoomFlags.Sinking_Down) !== RoomFlags.Sinking_Down)
            data['create body'] += `   set_down(RMS + "${files[tmp2]}.c");\n`;

        //add docs
        if (data['doc'].length > 0)
            data['doc'] = ' * @doc ' + data['doc'].join('\n * @doc ') + '\n';
        else
            data['doc'] = '';
        if (room.notes.length !== 0) {
            if (data.description.length !== 0)
                data.description += '\n';
            data.description += ' * Notes:\n * ' + room.notes.split('\n').join('\n * ') + '\n *';
        }
        if (baseRoom)
            return this.parseFileTemplate(this.read(parseTemplate(path.join('{assets}', 'templates', 'wizards', 'designer', 'baseroom.c'))), data);
        return this.parseFileTemplate(this.read(parseTemplate(path.join('{assets}', 'templates', 'wizards', 'designer', 'room.c'))), data);
    }

    public generateMonsterCode(monster, files, data, baseMonster?) {
        if (!monster) return '';
        if (this.$cancel)
            throw new Error('Canceled');
        files = files || {};
        data.doc = [];
        data.includes = '';
        data.description = '';
        data['create pre'] = '';
        data['create body'] = '';
        data['create post'] = '';
        data['create pre inherit'] = '';
        data['create arguments'] = '';
        data['create arguments comment'] = '';

        let tmp;
        const base: Monster = this.$area.monsters[monster.type] || this.$area.baseMonsters[monster.type] || new Monster();
        let props: any = {};
        let tempProps: any = {};
        if (files[monster.type])
            data.inherit = `(MON + "${files[monster.type]}")`;
        else
            data.inherit = files[monster.type + 'monster'] || monster.type.toUpperCase();
        data.inherits = '';

        data.doc.push('/doc/build/areas/tutorial');

        switch (monster.type) {
            case 'MONTYPE_ARMOR_REPAIR':
                data.doc.push('/doc/build/monster/types/smith');
                data.doc.push('/doc/build/monster/types/vendor');
                break;
            case 'MONTYPE_BARKEEP':
                data.doc.push('/doc/build/monster/types/barkeep');
                break;
            case 'MONTYPE_CLERIC_TRAINER':
                data.doc.push('/doc/build/monster/types/cleric_trainer');
                break;
            case 'MONTYPE_SUBCLASSER':
                data.doc.push('/doc/build/monster/types/subclasser');
                break;
            case 'MONTYPE_HEALER':
                data.doc.push('/doc/build/monster/types/healer');
                break;
            case 'MONTYPE_JEWELER':
                data.doc.push('/doc/build/monster/types/jeweler');
                data.doc.push('/doc/build/monster/types/vendor');
                break;
            case 'MONTYPE_LOCKPICK_REPAIR':
                data.doc.push('/doc/build/monster/types/lockpick_repair');
                data.doc.push('/doc/build/monster/types/vendor');
                break;
            case 'MONTYPE_MAGE_TRAINER':
                data.doc.push('/doc/build/monster/types/mage_trainer');
                break;
            case 'MONTYPE_MON_EDIBLE':
                data.doc.push('/doc/build/monster/types/mon_edible');
                break;
            case 'MONTYPE_SAGE_NPC':
                data.doc.push('/doc/build/monster/types/sage');
                data.doc.push('/doc/build/etc/sagebase');
                break;
            case 'MONTYPE_SKILL_TRAINER':
                data.doc.push('/doc/build/monster/types/skill_trainer');
                break;
            case 'MONTYPE_SMITH':
                data.doc.push('/doc/build/monster/types/smith');
                data.doc.push('/doc/build/monster/types/vendor');
                break;
            case 'MONTYPE_SUMMON_MOB':
                data.doc.push('/doc/build/monster/types/summon');
                break;
            case 'MONTYPE_TATTOOIST':
                data.doc.push('/doc/build/monster/types/tattooist');
                break;
            case 'MONTYPE_CMD_TRAIN_NPC':
                data.doc.push('/doc/build/monster/types/subclasser');
                break;
            case 'MONTYPE_VENDOR':
                data.doc.push('/doc/build/monster/types/vendor');
                break;
            case 'MONTYPE_WEAPON_REPAIR':
                data.doc.push('/doc/build/monster/types/smith');
                data.doc.push('/doc/build/monster/types/vendor');
                break;
            case 'MONTYPE_SHIPWRIGHT':
                data.doc.push('/doc/build/monster/haggle');
                data.doc.push('/doc/build/monster/types/shipwright');
                break;
            case 'MONTYPE_CRAFTER':
                data.doc.push('/doc/build/monster/types/crafter');
                data.doc.push('/doc/build/monster/types/skill_trainer');
                data.doc.push('/doc/build/monster/types/smith');
                data.doc.push('/doc/build/monster/types/vendor');
                break;
        }

        if (baseMonster) {
            if (monster.level !== base.level)
                data['create arguments'] += `lvl || ${monster.level}, `;
            else
                data['create arguments'] += `lvl, `;
            if (monster.race !== base.race)
                data['create arguments'] += `race || "${monster.race}", `;
            else
                data['create arguments'] += `race, `;
            if (monster.race !== base.race)
                data['create arguments'] += `cls || "${monster.class}", `;
            else
                data['create arguments'] += `cls, `;
            if (monster.race !== base.bodyType)
                data['create arguments'] += `btype || "${monster.bodyType}", autospells, args`;
            else
                data['create arguments'] += `btype, autospells, args`;
        }
        else {
            data['create arguments'] = `${monster.level || base.level}, "${monster.race || base.race || 'human'}"`;
            if (monster.class !== base.class && monster.class.length > 0) {
                data['create arguments'] += `, "${monster.class}"`;
                data['create arguments comment'] += ', Class';
            }
            else if (monster.bodyType !== base.bodyType && monster.bodyType.length > 0) {
                data['create arguments'] += `, 0`;
                data['create arguments comment'] += ', No class';
            }

            if (monster.bodyType !== base.bodyType && monster.bodyType.length > 0) {
                data['create arguments'] += `, "${monster.bodyType}"`;
                data['create arguments comment'] += ', Body type';
            }
        }

        if (monster.name.startsWith('"') && monster.name.endsWith('"'))
            data['name'] = monster.name.substr(1, monster.name.length - 2).replace(/"/g, '\\"');
        else
            data['name'] = monster.name;
        if (monster.name !== base.name)
            data['create body'] += `   set_name("${data['name']}");\n`;

        if (monster.short !== base.short) {
            monster.short = monster.short.trim();
            if (monster.short.startsWith('(:')) {
                data['create body'] += `   set_short(${formatFunctionPointer(monster.short)});\n`;
                data['create pre'] += createFunction(monster.short, 'string');
            }
            else if (monster.short.startsWith('"') && monster.short.endsWith('"'))
                data['create body'] += `   set_short(${monster.short});\n`;
            else if (monster.short.length !== 0 || base.short.length === 0)
                data['create body'] += `   set_short("${monster.short.replace(/"/g, '\\"')}");\n`;
        }
        if (monster.long !== base.long) {
            monster.long = monster.long.trim();
            if (monster.long.startsWith('(:')) {
                data['create body'] += `   set_long(${formatFunctionPointer(monster.long)});\n`;
                data['create pre'] += createFunction(monster.long, 'string');
                data.description = monster.long.substr(2);
                if (data.description.endsWith(':)'))
                    data.description = data.description.substr(0, data.description.length - 2);
                data.description = data.description.trim();
            }
            else if (monster.long.length !== 0 || base.long.length === 0) {
                if (monster.long.startsWith('"') && monster.long.endsWith('"'))
                    monster.long = monster.long.substr(1, monster.long.length - 2);
                else
                    monster.long = monster.long.replace(/"/g, '\\"');

                if (monster.long.length > 70) {
                    data.description = formatString(monster.long, 0, 77, ' * ', '');
                    tmp = monster.long.substr(0, 66);
                    let tl = tmp.length;
                    while (tl--) {
                        if (tmp.charAt(tl) === ' ') {
                            tmp = tmp.substr(0, tl + 1);
                            break;
                        }
                    }
                    data['create body'] += `   set_long("${tmp}"\n     `;
                    monster.long = monster.long.substr(tmp.length);
                    data['create body'] += `${formatString(monster.long, 5, 73)});\n`;
                }
                else if (monster.long.length) {
                    data['create body'] += `   set_long("${monster.long}");\n`;
                    data.description = ' * ' + monster.long;
                }
            }
        }
        else {
            data.description = monster.long.trim();
            if (data.description.startsWith('(:')) {
                data.description = formatFunctionPointer(data.description).substr(2);
                if (data.description.endsWith(':)'))
                    data.description = data.description.substr(0, data.description.length - 2);
                data.description = data.description.trim();
            }
            else {
                if (data.description.startsWith('"') && data.description.endsWith('"'))
                    data.description = data.description.substr(1, data.description.length - 2);
                if (data.description.length > 70)
                    data.description = formatString(data.description, 0, 77, ' * ', '');
                else
                    data.description = ' * ' + data.description;
            }
        }
        data.description = stripPinkfish(data.description);
        if (monster.nouns !== base.nouns) {
            monster.nouns = (monster.nouns || '').split(',');
            monster.nouns = monster.nouns.map(w => {
                w = w.trim();
                if (!w.startsWith('"'))
                    w = '"' + w;
                if (!w.endsWith('"'))
                    w += '"';
                return w;
            });
            data['create body'] += '   set_nouns(' + monster.nouns.join(', ') + ');\n';
        }
        if (monster.adjectives !== base.adjectives) {
            monster.adjectives = (monster.adjectives || '').split(',');
            monster.adjectives = monster.adjectives.map(w => {
                w = w.trim();
                if (!w.startsWith('"'))
                    w = '"' + w;
                if (!w.endsWith('"'))
                    w += '"';
                return w;
            });
            data['create body'] += '   set_adjectives(' + monster.adjectives.join(', ') + ');\n';
        }

        if ((monster.flags & MonsterFlags.Undead) === MonsterFlags.Undead && (base.flags & MonsterFlags.Undead) !== MonsterFlags.Undead)
            props['undead'] = 1;
        if ((monster.flags & MonsterFlags.Water_Breathing) === MonsterFlags.Water_Breathing && (base.flags & MonsterFlags.Water_Breathing) !== MonsterFlags.Water_Breathing)
            props['waterbreathing'] = 1;
        if ((monster.flags & MonsterFlags.Requires_Water) === MonsterFlags.Requires_Water && (base.flags & MonsterFlags.Requires_Water) !== MonsterFlags.Requires_Water)
            props['requires water'] = 1;
        if ((monster.flags & MonsterFlags.No_Bleeding) === MonsterFlags.No_Bleeding && (base.flags & MonsterFlags.No_Bleeding) !== MonsterFlags.No_Bleeding)
            props['no bleed'] = 1;

        if (monster.noCorpse !== base.noCorpse) {
            monster.noCorpse = monster.noCorpse.trim();
            if (monster.noCorpse.startsWith('(:')) {
                props['no corpse'] = formatFunctionPointer(monster.noCorpse, true);
                data['create pre'] += createFunction(monster.noCorpse, 'string');
            }
            else if (monster.noCorpse.startsWith('"') && monster.noCorpse.endsWith('"'))
                props['no corpse'] = monster.noCorpse;
            else if (monster.noCorpse.length > 0)
                props['no corpse'] = `"${monster.noCorpse.replace(/"/g, '\\"')}"`;
        }
        if (monster.noLimbs !== base.noLimbs) {
            monster.noLimbs = monster.noLimbs.trim();
            if (monster.noLimbs.startsWith('(:')) {
                props['no limbs'] = formatFunctionPointer(monster.noLimbs, true);
                data['create pre'] += createFunction(monster.noLimbs, 'string');
            }
            else if (monster.noLimbs.startsWith('"') && monster.noLimbs.endsWith('"'))
                props['no limbs'] = monster.noLimbs;
            else if (monster.noLimbs.length > 0)
                props['no limbs'] = `"${monster.noLimbs.replace(/"/g, '\\"')}"`;
        }

        if (monster.properties.length > 0) {
            monster.properties.forEach(b => {
                b.value = b.value.trim();
                if (b.value.startsWith('(:')) {
                    if (b.type === 1)
                        tempProps[b.name] = formatFunctionPointer(b.value);
                    else
                        props[b.name] = formatFunctionPointer(b.value);
                    data['create pre'] += createFunction(b.value);
                }
                else if (b.value.startsWith('({')) {
                    tmp2 = b.value.substring(2);
                    if (tmp2.endsWith('})'))
                        tmp2 = tmp2.substr(0, tmp2.length - 2);
                    tmp2 = tmp2.split(',');
                    tmp2 = tmp2.map(t => {
                        t = t.trim();
                        if ((t.startsWith('"') && t.endsWith('"')) || t.match(/^\d+$/))
                            return t;
                        else if (t.startsWith('(:')) {
                            t = formatFunctionPointer(t);
                            data['create pre'] += createFunction(t);
                            return t;
                        }
                        return `"${t}"`;
                    });
                    if (b.type === 1)
                        tempProps[b.name] = `({ ${tmp2.join(', ')} })`;
                    else
                        props[b.name] = `({ ${tmp2.join(', ')} })`;
                }
                else if ((b.value.startsWith('"') && b.value.endsWith('"')) || b.value.match(/^\d+$/)) {
                    if (b.type === 1)
                        tempProps[b.name] = b.value;
                    else
                        props[b.name] = b.value;
                }
                else {
                    if (b.type === 1)
                        tempProps[b.name] = `"${b.value}"`;
                    else
                        props[b.name] = `"${b.value}"`;
                }
            });
        }

        if ((monster.baseFlags & MonsterBaseFlags.No_Objects) === RoomBaseFlags.No_Objects && (base.baseFlags & MonsterBaseFlags.No_Topics) !== MonsterBaseFlags.No_Topics)
            props['no objects'] = 1;

        tempProps = Object.keys(tempProps).map(k => `"${k}" : ${tempProps[k]}`);
        props = Object.keys(props).map(k => `"${k}" : ${tempProps[k]}`);

        if (tempProps.length === 1)
            data['create body'] += `   set_temp_property(${tempProps[0].replace(' :', ',')});\n`;
        else if (tempProps.length > 0) {
            data['create body'] += '   set_temp_properties( ([\n       ';
            data['create body'] += tempProps.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }

        if (props.length === 1)
            data['create body'] += `   set_property(${props[0].replace(' :', ',')});\n`;
        else if (props.length > 0) {
            data['create body'] += '   set_properties( ([\n       ';
            data['create body'] += props.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        if (monster.mass !== base.mass)
            data['create body'] += `   set_mass(${monster.mass});\n`;
        if (monster.height !== base.height)
            data['create body'] += `   set_height(${monster.height});\n`;

        if (monster.alignment !== base.alignment && monster.alignment !== '0' && monster.alignment !== 'neutral' && monster.alignment.length !== 0) {
            if (typeof monster.alignment === 'string' && parseFloat(monster.alignment).toString() === monster.alignment) {
                data['create body'] += `   set_alignment(${monster.alignment});\n`;
            }
            else
                data['create body'] += `   set_alignment("${monster.alignment}");\n`;
        }
        if (monster.language !== base.language)
            data['create body'] += `   set_primary_lang("${monster.language}");\n`;
        if (monster.gender !== base.gender) {
            if (monster.gender === 'random')
                data['create body'] += `   set_gender(random(2) ? "male" : "female");\n`;
            else
                data['create body'] += `   set_gender("${monster.gender}");\n`;
        }
        if (monster.eyeColor !== base.eyeColor)
            data['create body'] += `   set_eyecolor("${monster.eyeColor}");\n`;
        if (monster.hairColor !== base.hairColor)
            data['create body'] += `   set_haircolor("${monster.hairColor}");\n`;
        if ((monster.flags & MonsterFlags.Ridable) === MonsterFlags.Ridable && (base.flags & MonsterFlags.Ridable) !== MonsterFlags.Ridable)
            data['create body'] += '   set_rideable(1); //Enable riding\n   set_follow_type("steed");/ /set the follow type to steed for proper limiting\n';
        if ((monster.flags & MonsterFlags.Flying) === MonsterFlags.Flying && (base.flags & MonsterFlags.Flying) !== MonsterFlags.Flying)
            data['create body'] += '   set_can_fly(1); //Enable fly/land abilities\n';
        if ((monster.flags & MonsterFlags.Getable) === MonsterFlags.Getable && (base.flags & MonsterFlags.Getable) !== MonsterFlags.Getable)
            data['create body'] += '   set_getable(1); //turn on getable\n';
        if (monster.patrolRoute !== base.patrolRoute)
            data['create body'] += `   set_patrol(${monster.speed}, ${formatArgumentList(monster.patrolRoute, 64 - ('' + monster.speed).length)}); //Set speed and patrol route\n`;
        else if (monster.speed !== base.speed && monster.speed.length !== 0)
            data['create body'] += `   set_speed(${monster.speed}); //Set speed\n`;

        if (monster.noWalkRooms !== base.noWalkRooms)
            data['create body'] += `   set_no_walk(${formatArgumentList(monster.noWalkRooms, 63, 0, 0, true)}); //Set no walk rooms\n`;
        if (monster.attackCommandChance !== base.attackCommandChance)
            data['create body'] += `   set_spell_chance(${monster.attackCommandChance}); //Set the chance an attack command will be used\n`;
        if (monster.attackCommands !== base.attackCommands)
            data['create body'] += `   set_spells(${formatArgumentList(monster.attackCommands, 64)}); //Set attack commands\n`;
        if (monster.attackInitiators !== base.attackInitiators)
            data['create body'] += `   set_combat_initiator(${formatArgumentList(monster.attackInitiators, 56)}); //Set attack initiators\n`;
        if (monster.aggressive !== base.aggressive) {
            if (monster.aggressive.trim().startsWith('(['))
                data['create body'] += `   set_aggressive( ${formatMapping(monster.aggressive, 5).trim()} ); //Set monster aggressiveness\n`;
            else
                data['create body'] += `   set_aggressive(${monster.aggressive.trim()}); //Set monster aggressiveness\n`;
            data['doc'].push('/doc/build/monster/haggle');
            data['doc'].push('/doc/build/monfster/aggressive');
        }
        if (monster.party !== base.party)
            data['create body'] += `   set_mon_party("${monster.party}");\n`;
        if (monster.autoDrop.enabled && !base.autoDrop.enabled)
            data['create body'] += `   set_auto_drop(1);\n`;
        if (monster.autoDrop.time !== base.autoDrop.time)
            data['create body'] += `   set_auto_drop_delay(${monster.autoDrop.time});\n`;
        if (!monster.autoDrop.enabled && base.autoDrop.enabled)
            data['create body'] += `   set_open_storage(0);\n`;
        if (monster.openStorage.time !== base.openStorage.time)
            data['create body'] += `   set_open_storage_delay(${monster.openStorage.time});\n`;
        if (!monster.autoDrop.enabled && base.autoDrop.enabled)
            data['create body'] += `   set_auto_wield(0);\n`;
        if (monster.autoWield.time !== base.autoWield.time)
            data['create body'] += `   set_auto_wield_delay(${monster.autoWield.time});\n`;
        if (monster.autoDrop.enabled && !base.autoDrop.enabled)
            data['create body'] += `   set_auto_loot(1);\n`;
        if (monster.autoLoot.time !== base.autoLoot.time)
            data['create body'] += `   set_auto_loot_delay(${monster.autoLoot.time});\n`;
        if (monster.autoDrop.enabled && !base.autoDrop.enabled)
            data['create body'] += `   set_auto_wear(1);\n`;
        if (monster.autoWear.time !== base.autoWear.time)
            data['create body'] += `   set_auto_wear_delay(${monster.autoWear.time});\n`;
        if (monster.wimpy !== base.wimpy)
            data['create body'] += `   set_wimpy(${monster.wimpy});\n`;

        if ((monster.flags & MonsterFlags.Auto_Stand) !== MonsterFlags.Auto_Stand && (base.flags & MonsterFlags.Auto_Stand) === MonsterFlags.Auto_Stand)
            data['create body'] += `   set_auto_stand(0);\n`;

        if (monster.reactions && monster.reactions.length !== 0) {
            tmp = monster.reactions.filter(r => r.reaction.length > 0);
            if (tmp.length === 1)
                data['create body'] += `   set_reaction("${tmp[0].type.length > 0 ? tmp[0].type + ' ' : ''}${tmp[0].reaction}", "${tmp[0].action}");\n`;
            else if (tmp.length > 1) {
                data['create body'] += '   set_reactions( ([\n';
                data['create body'] += tmp.map(r => `       "${r.type.length > 0 ? r.type + ' ' : ''}${r.reaction}" : "${r.action}"`).join(',\n');
                data['create body'] += '\n     ]) );\n';
            }
        }
        if (monster.tracking && !base.tracking)
            data['create body'] += `   set_track_attackers(1);\n`;
        if (monster.trackingMessage !== base.trackingMessage)
            data['create body'] += `   set_track_enter_message("${monster.trackingMessage}");\n`;
        if (monster.trackingType !== base.trackingType)
            data['create body'] += `   set_track_enter_message_type("${monster.trackingType.trim()}");\n`;
        if (monster.trackingAggressively !== base.trackingAggressively)
            data['create body'] += `   set_track_aggressively_only(1);\n`;
        if ((monster.baseFlags & MonsterBaseFlags.No_Topics) === MonsterBaseFlags.No_Topics) {
            if (monster.askEnabled && monster.askTopics.length === 0)
                data['create body'] += `   set_enable_ask(1);\n`;
        }
        else if (monster.askEnabled && !base.askEnabled && monster.askTopics.length === 0 && base.askTopics.length === 0)
            data['create body'] += `   set_enable_ask(1);\n`;

        if (monster.askNoTopic !== base.askNoTopic)
            data['create body'] += `   set_no_topic("${monster.askNoTopic.trim()}");\n`;
        if (monster.askResponseType !== base.askResponseType)
            switch (monster.askResponseType) {
                case 1:
                    data['create body'] += `   set_response_type("tell");\n`;
                    break;
                case 2:
                    data['create body'] += `   set_response_type("speak");\n`;
                    break;
                case 3:
                    data['create body'] += `   set_response_type("whisper");\n`;
                    break;
                case 4:
                    data['create body'] += `   set_response_type("custom");\n`;
                    break;
            }

        let tmp2;
        let tmp3;
        let tmp4 = base.askTopics.map(s => s.topic);
        tmp = monster.askTopics.map(i => {
            const idx = tmp4.indexOf(i.topic);
            if (idx !== -1 && base.askTopics[idx].message === i.message)
                return '';

            tmp2 = i.topic.split(',').map(t => {
                t.trim();
                if (!t.startsWith('"') && !t.endsWith('"'))
                    t = '"' + t + '"';
                return t;
            });
            if (tmp2.length === 1)
                tmp2 = tmp2[0];
            else
                tmp2 = `({ ${tmp2.join(', ')} })`;
            tmp3 = i.message.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'string', 'object player, string topic');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            return `${tmp2} : ${tmp3}`;
        });
        tmp = tmp.filter(s => s.length !== 0);

        if (tmp.length === 1) {
            tmp = monster.askTopics[0].topic.trim();
            if (!tmp.trim().startsWith('"') && !tmp.trim().endsWith('"'))
                tmp = `"${tmp.trim()}"`;
            monster.askTopics[0].message = monster.askTopics[0].message.trim();
            if (monster.askTopics[0].message.trim().startsWith('(:')) {
                tmp3 = formatFunctionPointer(monster.askTopics[0].message);
                data['create body'] += `   set_topic(${tmp}, ${tmp3});\n`;
                data['create pre'] += createFunction(tmp3, 'string', 'object player, string topic');
            }
            else if (!monster.askTopics[0].message.startsWith('"') && !monster.askTopics[0].message.endsWith('"'))
                data['create body'] += `   set_topic(${tmp}, "${monster.askTopics[0].message}");\n`;
            else
                data['create body'] += `   set_topic(${tmp}, ${monster.askTopics[0].message});\n`;
        }
        else if (tmp.length > 0) {
            if ((monster.baseFlags & MonsterBaseFlags.No_Topics) === MonsterBaseFlags.No_Topics)
                data['create body'] += '   set_topics( ([\n       ';
            else
                data['create body'] += '   add_topics( ([\n       ';
            data['create body'] += tmp.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }

        if (monster.reputationGroup !== base.reputationGroup)
            data['create body'] += `   set_reputation_area("${monster.reputationGroup.trim()}");\n`;

        if (monster.reputations && monster.reputations.length > 0) {
            tmp4 = (base.reputations || []).map(r => `${r.type}${r.group}${r.amount}`);
            monster.reputations.forEach(r => {
                const idx = tmp.indexOf(`${r.type}${r.group}${r.amount}`);
                if (idx !== -1 || !r.amount) return;
                r.amount.trim();
                if (r.amount.length === 0 || r.amount === '0') return;
                const fun = r.type === 1 ? 'ondie' : 'onattack';
                r.group = r.group.trim();
                if (r.group.length !== 0 && !r.group.startsWith('"') && !r.group.endsWith('"'))
                    r.group = `"${r.group.replace(/"/g, '\\"')}", `;
                else if (r.group.length !== 0)
                    r.group = `${r.group}, `;

                if (typeof r.amount === 'string' && parseFloat(r.amount).toString() === r.amount)
                    data['create body'] += `   set_reputation_${fun}(${r.group}${r.amount});\n`;
                else if (r.amount.startsWith('(:')) {
                    tmp3 = formatFunctionPointer(r.amount);
                    data['create body'] += `   set_reputation_${fun}(${r.group}${tmp3});\n`;
                    data['create pre'] += createFunction(tmp3, 'string', 'object monster, object killer');
                }
                else if (!r.amount.startsWith('"') && !r.amount.endsWith('"'))
                    data['create body'] += `   set_reputation_${fun}(${r.group}"${r.amount}");\n`;
                else
                    data['create body'] += `   set_reputation_${fun}(${r.group}${r.amount});\n`;
            });
        }

        //#region emotes
        tmp = monster.emotes.filter(s => s.type === 0).map(i => {
            tmp3 = i.message.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'mixed', 'object monster');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            return tmp3;
        });
        if (tmp.length !== 0)
            data['create body'] += `   set_emotes(${monster.emotesChance}, ({\n       ${tmp.join(',\n       ')}\n     }) );\n`;
        tmp = monster.emotes.filter(s => s.type === 1).map(i => {
            tmp3 = i.message.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'mixed', 'object monster');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            return tmp3;
        });
        if (tmp.length !== 0)
            data['create body'] += `   set_emotes(${monster.emotesChanceCombat}, ({\n       ${tmp.join(',\n       ')}\n     }), 1);\n`;
        //#endregion
        //#region speeches
        tmp = {};
        monster.emotes.filter(s => s.type === 2 && s.language.length !== 0).forEach(i => {
            tmp3 = i.message.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'mixed', 'object monster, string language');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            if (!tmp[i.language])
                tmp[i.language] = [tmp3];
            else
                tmp[i.language].push(tmp3);
        });
        Object.keys(tmp).forEach(k => {
            data['create body'] += `   set_speech(${monster.speechChance}, "${k}", ({\n       ${tmp[k].join(',\n       ')}\n     }) );\n`;
        });
        tmp = {};
        monster.emotes.filter(s => s.type === 3 && s.language.length !== 0).forEach(i => {
            tmp3 = i.message.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'mixed', 'object monster, string language');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            if (!tmp[i.language])
                tmp[i.language] = [tmp3];
            else
                tmp[i.language].push(tmp3);
        });
        Object.keys(tmp).forEach(k => {
            data['create body'] += `   set_speech(${monster.speechChanceCombat}, "${k}", ({\n       ${tmp[k].join(',\n       ')}\n     }), 1);\n`;
        });
        //#endregion

        if (monster.objects.length !== 0) {
            tmp2 = '';
            tmp3 = [];
            if (baseMonster) {
                tmp2 = '   ';
                data['create body'] += '   if(!query_property("no objects"))\n{\n';
            }
            monster.objects.forEach(o => {
                if (!this.$area.objects[o.id]) return;
                tmp = '';
                if (o.unique) {
                    tmp = `   clone_unique(OBJ + "${files[o.id]}.c");\n`;
                    if (o.action.trim().length > 0)
                        tmp3.push(`${o.action.trim()} ${this.$area.objects[o.id].name}`);
                }
                else if (o.minAmount > 0 && (o.minAmount === o.maxAmount || o.maxAmount === 0)) {
                    tmp = `   clone_max(OBJ + "${files[o.id]}.c", ${o.minAmount});\n`;
                    if (o.action.trim().length > 0)
                        tmp3.push(`${o.action.trim()} ${this.$area.objects[o.id].name}`);
                }
                else if (o.minAmount > 0 && o.maxAmount > 0) {
                    tmp = `   clone_max(OBJ + "${files[o.id]}.c", ${o.minAmount} + random(${o.maxAmount - o.minAmount}));\n`;
                    if (o.action.trim().length > 0)
                        tmp3.push(`${o.action.trim()} ${this.$area.objects[o.id].name}`);
                }
                if (o.random > 0 && tmp.length !== 0 && o.random < 100)
                    data['create body'] += `${tmp2}   if(random(${o.random}) <= random(101))\n   `;
                data['create body'] += tmp2 + tmp;
            });
            tmp3 = tmp3.filter((v, i, s) => s.indexOf(v) === i);
            if (tmp3.length !== 0) {
                tmp3.forEach(w => {
                    w = stripPinkfish(w.trim());
                    if (w.length === 0) return;
                    if (!w.startsWith('"'))
                        w = '"' + w;
                    if (!w.endsWith('"'))
                        w += '"';
                    data['create body'] += `${tmp2}   command(${w});\n`;
                });
            }
            if (baseMonster)
                data['create body'] += '   }\n';
        }

        if (monster.actions !== base.actions) {
            monster.actions = monster.actions.split(',');
            monster.actions.forEach(w => {
                w = w.trim();
                if (w.length === 0) return;
                if (!w.startsWith('"'))
                    w = '"' + w;
                if (!w.endsWith('"'))
                    w += '"';
                data['create body'] += `   command(${w});\n`;
            });
        }
        if (data['doc'].length > 0)
            data['doc'] = ' * @doc ' + data['doc'].join('\n * @doc ') + '\n';
        else
            data['doc'] = '';
        if (monster.notes.length !== 0) {
            if (data.description.length !== 0)
                data.description += '\n';
            data.description += ' * Notes:\n * ' + monster.notes.split('\n').join('\n * ') + '\n *';
        }
        if (baseMonster)
            return this.parseFileTemplate(this.read(parseTemplate(path.join('{assets}', 'templates', 'wizards', 'designer', 'basemonster.c'))), data);
        return this.parseFileTemplate(this.read(parseTemplate(path.join('{assets}', 'templates', 'wizards', 'designer', 'monster.c'))), data);
    }

    public generateObjectCode(obj, files, data) {
        if (!obj) return '';
        if (this.$cancel)
            throw new Error('Canceled');
        let tmp;
        let tmp2;
        let tmp3;
        let bonuses = false;
        let skills = false;
        let props: any = {};
        let tempProps: any = {};
        const limbsDamaged = {};
        limbsDamaged['both arms and legs'] = 'ARMSLEGS_DAM';
        limbsDamaged['both arms'] = 'ARMS_DAM';
        limbsDamaged['both legs'] = 'LEGS_DAM';
        limbsDamaged['right arm'] = 'RIGHTARM_DAM';
        limbsDamaged['left arm'] = 'LEFTARM_DAM';
        limbsDamaged['right leg'] = 'RIGHTLEG_DAM';
        limbsDamaged['left leg'] = 'LEFTLEG_DAM';
        limbsDamaged['both hands and feet'] = 'HANDSFEET_DAM';
        limbsDamaged['left hand'] = 'LEFTHAND_DAM';
        limbsDamaged['right hand'] = 'RIGHTHAND_DAM';
        limbsDamaged['both feet'] = 'FEET_DAM';
        limbsDamaged['left foot'] = 'LEFTFOOT_DAM';
        limbsDamaged['right foot'] = 'RIGHTFOOT_DAM';
        limbsDamaged['head'] = 'HEAD_DAM';
        limbsDamaged['both hooves'] = 'HOOVES_DAM';
        limbsDamaged['left hoof'] = 'LEFTHOOF_DAM';
        limbsDamaged['right hoof'] = 'RIGHTHOOF_DAM';
        limbsDamaged['both wings'] = 'WINGS_DAM';
        limbsDamaged['right wing'] = 'RIGHTWING_DAM';
        limbsDamaged['left wing'] = 'LEFTWING_DAM';
        limbsDamaged['tail'] = 'TAIL_DAM';
        files = files || {};
        data.doc = [];
        data.help = [];
        data.includes = '';
        data.inherits = '';
        data.description = '';
        data['create pre'] = '';
        data['create body'] = '';
        data['create post'] = '';
        data['create pre inherit'] = '';
        data['create arguments'] = '';
        data['create arguments comment'] = '';

        data['doc'].push('/doc/build/etc/object');
        data.help.push('mattypes');
        const limbs = ['ALLLIMBS', 'OVERALL', 'LIMBONLY', 'TORSO', 'HEAD', 'LEFTARM', 'RIGHTARM', 'LEFTHAND', 'RIGHTHAND', 'LEFTLEG', 'RIGHTLEG', 'LEFTFOOT', 'RIGHTFOOT', 'RIGHTWING', 'LEFTWING', 'LEFTHOOF', 'RIGHTHOOF', 'TAIL', 'ARMS', 'LEGS', 'HANDS', 'FEET', 'WINGS', 'HOOVES', 'LOWERBODY', 'COREBODY', 'UPPERCORE', 'UPPERBODY', 'WINGEDCORE', 'WINGEDUPPER', 'UPPERTRUNK', 'LOWERTRUNK', 'TRUNK', 'WINGEDTRUNK', 'FULLBODY', 'TOTALBODY', 'WINGEDBODY'];
        switch (obj.type) {
            case StdObjectType.armor_of_holding:
            case StdObjectType.armor:
                //#region Armor
                bonuses = true;
                skills = true;
                if (obj.type === StdObjectType.armor_of_holding)
                    data.inherit = 'OBJ_ARMOR_OF_HOLDING';
                else
                    data.inherit = 'OBJ_ARMOUR';
                data['doc'].push('/doc/build/armours/tutorial');
                data.help.push('atypes');
                data.includes += '\n#include <limbs.h>';
                data['create arguments'] = `"${obj.subType || 'accessory'}", "${obj.material || 'iron'}", "${obj.quality || 'average'}", `;
                data['create arguments comment'] = '//Type, Material, Quality, Limbs';
                tmp = (obj.limbs || 'torso').split(',').map(l => l.trim());
                //get non standard limbs
                tmp2 = tmp.filter(l => limbs.indexOf(l.replace(/ /g, '').toUpperCase()) === -1);
                //remove non standrad limbs
                tmp = tmp.filter(l => limbs.indexOf(l.replace(/ /g, '').toUpperCase()) !== -1);
                tmp = tmp.map(l => l.replace(/ /g, '').toUpperCase());
                tmp2 = tmp2.map(l => `"${l}"`);
                tmp = tmp.filter((value, index, self) => self.indexOf(value) === index);
                tmp2 = tmp2.filter((value, index, self) => self.indexOf(value) === index);
                if (tmp.length === 0 && tmp2.length === 0)
                    data['create arguments'] += 'TORSO';
                if (tmp.length !== 0 && tmp2.length !== 0)
                    data['create arguments'] += `${tmp.join(' | ')} | ({ "${tmp2.join(', ')}" })`;
                else if (tmp.length !== 0)
                    data['create arguments'] += tmp.join(' | ');
                else
                    data['create arguments'] += `${tmp2.join(', ')}`;
                if (obj.enchantment !== 0) {
                    data['create arguments'] += `, ${obj.enchantment}`;
                    data['create arguments comment'] += ', Natural enchantment';
                }
                if (obj.type === StdObjectType.armor_of_holding) {
                    if (obj.enchantment === 0) {
                        data['create arguments'] += `, 0`;
                        data['create arguments comment'] += ', Natural enchantment';
                    }
                    if (obj.encumbrance !== 40000) {
                        data['create arguments'] += `, ${obj.encumbrance}`;
                        data['create arguments comment'] += ', Max encumbrance'
                    }
                    else if (obj.maxitems !== 0 || obj.minencumbrance !== 500) {
                        data['create arguments'] += ', 40000';
                        data['create arguments comment'] += ', Max encumbrance'
                    }
                    if (obj.maxitems !== 0) {
                        data['create arguments'] += `, ${obj.maxitems}`;
                        data['create arguments comment'] += ', Max items'
                    }
                    else if (obj.minencumbrance !== 500) {
                        data['create arguments'] += `, 0`;
                        data['create arguments comment'] += ', Max items'
                    }
                    if (obj.minencumbrance !== 500) {
                        data['create arguments'] += `, ${obj.minencumbrance}`;
                        data['create arguments comment'] += ', Min encumbrance'
                    }
                }

                if (obj.maxWearable !== 0)
                    tempProps['max_wearable'] = `"${obj.maxWearable}"`;
                if (obj.limbsOptional)
                    data['create body'] += '   set_limbs_optional(1);\n';
                if (obj.damaged && obj.damaged.length !== 0) {
                    data.includes += '\n#include <limbsdamaged.h>';
                    //name
                    tmp = obj.damaged.filter(d => d.type === 0).sort((a, b) => a.limbs.localeCompare(b));
                    tmp = tmp.map(d => {
                        if (limbsDamaged[d.limbs.trim()])
                            return `${limbsDamaged[d.limbs.trim()]} : "${d.description}"`;
                        return `LIMBS_DAM( ({ ${d.limbs.split(',').map(l => `"${l.trim()}"`).join(', ')} }) ) : "${d.description}"`;
                    });
                    if (tmp.length === 1)
                        data['create body'] += `   set_damaged_name(${tmp[0].replace(/ :/, ',')})`;
                    else if (tmp.length > 0) {
                        data['create body'] += '   set_damaged_name( ([\n       ';
                        data['create body'] += tmp.join(',\n       ');
                        data['create body'] += '\n     ]) );\n';
                    }
                    //short
                    tmp = obj.damaged.filter(d => d.type === 1).sort((a, b) => a.limbs.localeCompare(b));
                    tmp = tmp.map(d => {
                        if (limbsDamaged[d.limbs.trim()])
                            return `${limbsDamaged[d.limbs.trim()]} : "${d.description}"`;
                        return `LIMBS_DAM( ({ ${d.limbs.split(',').map(l => `"${l.trim()}"`).join(', ')} }) ) : "${d.description}"`;
                    });
                    if (tmp.length === 1)
                        data['create body'] += `   set_damaged_short(${tmp[0].replace(/ :/, ',')})`;
                    else if (tmp.length > 0) {
                        data['create body'] += '   set_damaged_short( ([\n       ';
                        data['create body'] += tmp.join(',\n       ');
                        data['create body'] += '\n     ]) );\n';
                    }
                    //long
                    tmp = obj.damaged.filter(d => d.type === 2).sort((a, b) => a.limbs.localeCompare(b));
                    tmp = tmp.map(d => {
                        if (limbsDamaged[d.limbs.trim()])
                            return `${limbsDamaged[d.limbs.trim()]} : "${d.description}"`;
                        return `LIMBS_DAM( ({ ${d.limbs.split(',').map(l => `"${l.trim()}"`).join(', ')} }) ) : "${d.description}"`;
                    });
                    if (tmp.length === 1)
                        data['create body'] += `   set_damaged_long(${tmp[0].replace(/ :/, ',')})`;
                    else if (tmp.length > 0) {
                        data['create body'] += '   set_damaged_long( ([\n       ';
                        data['create body'] += tmp.join(',\n       ');
                        data['create body'] += '\n     ]) );\n';
                    }
                    //nouns
                    tmp = obj.damaged.filter(d => d.type === 3).sort((a, b) => a.limbs.localeCompare(b));
                    tmp = tmp.map(d => {
                        if (limbsDamaged[d.limbs.trim()])
                            return `${limbsDamaged[d.limbs.trim()]} : ${d.description.split(',').map(l => `({ ${l.trim()}"`).join(', ')} }) `;
                        return `LIMBS_DAM( ({ ${d.limbs.split(',').map(l => `"${l.trim()}"`).join(', ')} }) ) : ({ ${d.description.split(',').map(l => `"${l.trim()}"`).join(', ')} }) `;
                    });
                    if (tmp.length === 1)
                        data['create body'] += `   set_damaged_nouns(${tmp[0].replace(/ :/, ',')})`;
                    else if (tmp.length > 0) {
                        data['create body'] += '   set_damaged_nouns( ([\n       ';
                        data['create body'] += tmp.join(',\n       ');
                        data['create body'] += '\n     ]) );\n';
                    }
                    //adjectives
                    tmp = obj.damaged.filter(d => d.type === 4).sort((a, b) => a.limbs.localeCompare(b));
                    tmp = tmp.map(d => {
                        if (limbsDamaged[d.limbs.trim()])
                            return `${limbsDamaged[d.limbs.trim()]} : ${d.description.split(',').map(l => `({ ${l.trim()}"`).join(', ')} }) `;
                        return `LIMBS_DAM( ({ ${d.limbs.split(',').map(l => `"${l.trim()}"`).join(', ')} }) ) : ({ ${d.description.split(',').map(l => `"${l.trim()}"`).join(', ')} }) `;
                    });
                    if (tmp.length === 1)
                        data['create body'] += `   set_damaged_adjectives(${tmp[0].replace(/ :/, ',')})`;
                    else if (tmp.length > 0) {
                        data['create body'] += '   set_damaged_adjectives( ([\n       ';
                        data['create body'] += tmp.join(',\n       ');
                        data['create body'] += '\n     ]) );\n';
                    }
                    //id
                    tmp = obj.damaged.filter(d => d.type === 5).sort((a, b) => a.limbs.localeCompare(b));
                    tmp = tmp.map(d => {
                        if (limbsDamaged[d.limbs.trim()])
                            return `${limbsDamaged[d.limbs.trim()]} : ${d.description.split(',').map(l => `({ ${l.trim()}"`).join(', ')} }) `;
                        return `LIMBS_DAM( ({ ${d.limbs.split(',').map(l => `"${l.trim()}"`).join(', ')} }) ) : ({ ${d.description.split(',').map(l => `"${l.trim()}"`).join(', ')} }) `;
                    });
                    if (tmp.length === 1)
                        data['create body'] += `   set_damaged_id(${tmp[0].replace(/ :/, ',')})`;
                    else if (tmp.length > 0) {
                        data['create body'] += '   set_damaged_id( ([\n       ';
                        data['create body'] += tmp.join(',\n       ');
                        data['create body'] += '\n     ]) );\n';
                    }
                }
                break;
            //#endregion
            case StdObjectType.chest:
                //#region Chest
                data.inherit = 'OBJ_CHEST';
                if (obj.material.length > 0 && obj.material !== 'wood')
                    data['create body'] += `   set_material("${obj.material}");\n`;
                if (obj.blockers && obj.blockers.length !== 0) {
                    tmp = obj.blockers.split(',').map(b => `present("${b.trim()}", environment(this_object())`);
                    data['create pre'] += 'int auto_fun(string str, object who)\n{\n';
                    data['create pre'] += '   //Search for blockers and kepe the first one found\n';
                    data['create pre'] += `   object mon = ${tmp.join(' || ')};\n`;
                    data['create pre'] += '   if(mon) //if found attack\n   {\n';
                    data['create pre'] += '      if(who->query_cloak() && !who->is_found(mon))\n';
                    data['create pre'] += '         return 0;\n';
                    data['create pre'] += '       if(!sizeof(mon->query_combat_initiator()) || !mon->force_me(mon->query_combat_initiator()[random(sizeof(mon->query_combat_initiator()))] + " " + who->query_name()))\n';
                    data['create pre'] += '         mon->force_me("kill " + who->query_name());\n';
                    data['create pre'] += '      return 1;\n';
                    data['create pre'] += '   }\n   return 0;\n';
                    data['create pre'] += '}\n\nint get_fun(object who)\n{\n   return !auto_fun(0, who);\n}\n\n';
                    data['create body'] += '      set_trap("preunlock", new(TRAP, -1, (: auto_fun :), 0, 0, 1));\n';
                    data['create body'] += '      set_trap("prepick_lock", new(TRAP, -1, (: auto_fun :), 0, 0, 1));\n';
                    data['create body'] += '      set_trap("preopen", new(TRAP, -1, (: auto_fun :), 0, 0, 1));\n';
                    data['create body'] += '      set_prevent_get( (: get_fun :) );\n';
                }
                if (obj.encumbrance !== 10000)
                    data['create body'] += `   set_max_encumbrance(${obj.encumbrance});\n`;
                if (obj.lock !== 0)
                    data['create body'] += `   set_lock_strength(${obj.lock});\n`;

                if (obj.reduce > 0 && obj.reduce !== 1 || obj.reduce !== 1.0)
                    data['create body'] += `    set_reduce_item_mass(${obj.reduce});\n`;

                if (obj.keyID.length > 0) {
                    data['create body'] += `   set_key("${obj.keyID}");\n`;
                    data['create body'] += `   set_can_lock(1);\n`;
                }
                else if (obj.lock !== 0)
                    data['create body'] += `   set_can_lock(1);\n`;

                if (obj.contents && obj.contents.length > 0) {
                    tmp = obj.contents.filter(c => c.item < -4);
                    tmp2 = obj.contents.filter(c => c.item >= 0);
                    tmp3 = obj.contents.filter(c => c.item >= -4 && c.item < 0);
                    data['create post'] += '\n\nvoid reset_chest()\n{\n';
                    if (tmp.length !== 0)
                        data['create post'] += '   object money;\n';
                    if (tmp2.length !== 0)
                        data['create post'] += '   int gems;\n';
                    data['create post'] += '   //check if contains contents\n   if(sizeof(query_item_contents()))\n      return;\n';
                    data['create post'] += '   set_locked(0);\n';
                    data['create post'] += '   set_closed(0);\n';
                    //item, minAmount, maxAmount, random
                    if (tmp.length !== 0) {
                        data['create post'] += '   money = new(OBJ_COINS);\n';
                        let type;
                        tmp.forEach(o => {
                            switch (+o.item) {
                                case -5:
                                    type = '"platinum"';
                                    break;
                                case -6:
                                    type = '"gold"';
                                    break;
                                case -7:
                                    type = '"electrum"';
                                    break;
                                case -8:
                                    type = '"silver"';
                                    break;
                                default:
                                    type = '"copper"';
                                    break;
                            }
                            let c = '';
                            if (o.minAmount > 0 && (o.minAmount === o.maxAmount || o.maxAmount === 0))
                                c = `   money->add_money(${type}, ${o.minAmount});\n`;
                            else if (o.minAmount > 0 && o.maxAmount > 0)
                                c = `   money->add_money(${type}, ${o.minAmount} + random(${o.maxAmount - o.minAmount}));\n`;
                            if (o.random > 0 && c.length !== 0 && o.random < 100)
                                data['create post'] += `   if(random(${o.random}) <= random(101))\n   `;
                            data['create post'] += c;
                        });
                        data['create post'] += '   money->move(this_object());\n';
                    }

                    if (tmp3.length !== 0) {
                        tmp3.forEach(o => {
                            let type;
                            switch (o.item) {
                                case -2:
                                    type = '"uncommon gem"';
                                    break;
                                case -3:
                                    type = '"rare gem"';
                                    break;
                                case -4:
                                    type = '"exceptional gem"';
                                    break;
                                default:
                                    type = '"common gem"';
                                    break;
                            }
                            let c = '';
                            if (o.minAmount > 0 && (o.minAmount === o.maxAmount || o.maxAmount === 0))
                                c = `   gems = ${o.minAmount < 1 ? 1 : o.minAmount};\n`;
                            else if (o.minAmount > 0 && o.maxAmount > 0)
                                c = `   gems = ${o.minAmount} + random(${o.maxAmount - o.minAmount});\n`;
                            if (o.random > 0 && c.length !== 0 && o.random < 100) {
                                data['create body'] += `   if(random(${o.random}) <= random(101))\n{\n   `;
                                data['create body'] += c;
                                data['create body'] += '      while(gems--)\n';
                                data['create body'] += `         GEM_D->clone_gem(${type})->move(this_object())\n`;
                                data['create body'] += '   }\n';
                            }
                            else if (c.length === 0)
                                data['create body'] += `   GEM_D->clone_gem(${type})->move(this_object())`;
                            else {
                                data['create body'] += '   while(gems--)\n';
                                data['create body'] += `      GEM_D->clone_gem(${type})->move(this_object())`;
                            }
                        });
                    }

                    tmp2.forEach(o => {
                        if (!this.$area.objects[o.item]) return;
                        tmp = '';
                        if (o.minAmount > 0 && (o.minAmount === o.maxAmount || o.maxAmount === 0))
                            tmp = `   clone_max(OBJ + "${files[o.item]}.c", ${o.minAmount});\n`;
                        else if (o.minAmount > 0 && o.maxAmount > 0)
                            tmp = `   clone_max(OBJ + "${files[o.item]}.c", ${o.minAmount} + random(${o.maxAmount - o.minAmount}));\n`;
                        if (o.random > 0 && tmp.length !== 0 && o.random < 100)
                            data['create body'] += `   if(random(${o.random}) <= random(101))\n   `;
                        data['create body'] += tmp;
                    });

                    data['create post'] += '   set_closed(1);\n';
                    data['create post'] += '   set_locked(1);\n';
                    data['create post'] += '}';
                }
                //#endregion
                break;
            case StdObjectType.instrument:
                //#region Instrument
                bonuses = true;
                skills = true;
                data.inherit = 'OBJ_INSTRUMENT';
                data['doc'].push('/skdoc/build/weapon/tutorial');
                data['doc'].push('/doc/build/weapon/types/instrument');
                data.help.push('instrumenttypes');
                data.help.push('wtypes');
                data['create arguments'] = `"${obj.subType || 'bell'}", "${obj.material || 'iron'}", "${obj.quality || 'average'}"`;
                data['create arguments comment'] = '//Type, Material, Quality';
                if (obj.wType && obj.wType.length !== 0) {
                    data['create arguments comment'] += ', Weapon type';
                    data['create arguments'] += `, ${obj.wType}`;
                }
                else if (obj.enchantment !== 0) {
                    data['create arguments comment'] += ', Weapon type';
                    data['create arguments'] += `, 0`;
                }
                if (obj.enchantment !== 0) {
                    data['create arguments'] += `, ${obj.enchantment}`;
                    data['create arguments comment'] += ', Natural enchantment';
                }
                //#endregion
                break;
            case StdObjectType.material:
                //#region Material
                bonuses = true;
                data.inherit = 'OBJ_MATERIAL';
                data['doc'].push('/doc/build/etc/material');
                data['create arguments'] = `"${obj.material || 'iron'}", "${obj.size > 1 ? obj.size : 1}", "${obj.quality || 'average'}"`;
                data['create arguments comment'] = '//Material, size, Quality';
                if (obj.describers && obj.describers.length > 0)
                    data['create body'] += `   set_decribers(${formatArgumentList(tmp.join(', '), 63)});\n`;
                //#endregion
                break;
            case StdObjectType.material_weapon:
                //#region Material weapon
                bonuses = true;
                skills = true;
                data.inherit = 'OBJ_MATERIAL_WEAPON';
                data['doc'].push('/doc/build/weapon/tutorial');
                data['doc'].push('/doc/build/weapon/types/material_weapon');
                data['doc'].push('/doc/build/etc/material');
                data.help.push('wtypes');

                data['create arguments'] = `"${obj.subType || 'blunt'}", "${obj.material || 'wood'}", "${obj.quality || 'average'}", ${obj.enchantment || 0}, "${obj.size > 1 ? obj.size : 1}"`;
                data['create arguments comment'] = '//Weapon type, Material, Quality, Natural enchantment, Material size';
                if (obj.describers && obj.describers.length > 0)
                    data['create body'] += `   set_decribers(${formatArgumentList(tmp.join(', '), 63)});\n`;
                //#endregion
                break;
            case StdObjectType.ore:
                //#region Ore
                bonuses = true;
                data.inherit = 'OBJ_ORE_RAND';
                data['doc'].push('/doc/build/random_generators#OBJ_ORE_RAND');
                data['create arguments'] = `"${obj.material || 'iron'}", "${obj.size > 1 ? obj.size : 1}", "${obj.quality || 'average'}"`;
                data['create arguments comment'] = '//Material. Size, Quality';
                if (obj.describers && obj.describers.length > 0)
                    data['create body'] += `   set_decribers(${formatArgumentList(tmp.join(', '), 63)});\n`;
                //#endregion
                break;
            case StdObjectType.rope:
                //#region Rope
                bonuses = true;
                skills = true;
                data.inherit = 'OBJ_ROPE';
                data['doc'].push('/doc/build/weapon/tutorial');
                data['doc'].push('/doc/build/weapon/types/rope');
                //Name, Material, Quality, Natural enchantment
                data['create arguments'] = `"${obj.name || 'rope'}", "${obj.material || 'cotton'}", "${obj.quality || 'average'}"`;
                data['create arguments comment'] = '//Name, Material, Quality';
                if (obj.enchantment !== 0) {
                    data['create arguments'] += `, ${obj.enchantment}`;
                    data['create arguments comment'] += ', Natural enchantment';
                }
                //#endregion
                break;
            case StdObjectType.sheath:
                //#region Sheath
                bonuses = true;
                skills = true;
                //string matarm, string qualarm, mixed armlimbs, int charm
                data.inherit = 'OBJ_SHEATH';
                data['doc'].push('/doc/build/armours/tutorial');
                data['doc'].push('/doc/build/armours/types/sheath');
                data.help.push('atypes');
                data.includes += '\n#include <limbs.h>';
                tmp = (obj.limbs || 'LEFTLEG').split(',').map(l => l.trim());
                tmp2 = tmp.filter(l => limbs.indexOf(l.replace(/ /g, '').toUpperCase()) === -1);
                tmp = tmp.filter(l => limbs.indexOf(l.replace(/ /g, '').toUpperCase()) !== -1);
                tmp = tmp.map(l => l.replace(/ /g, '').toUpperCase());
                tmp2 = tmp2.map(l => `"${l}"`);
                tmp = tmp.filter((value, index, self) => self.indexOf(value) === index);
                tmp2 = tmp2.filter((value, index, self) => self.indexOf(value) === index);
                if (!obj.subType || obj.subType.length === 0 || obj.subType === 'sheath') {
                    data['create arguments'] = `"${obj.material || 'leather'}", "${obj.quality || 'average'}", `;
                    data['create arguments comment'] = '//Material, Quality, Limbs';
                    if (tmp.length === 0 && tmp2.length === 0)
                        data['create arguments'] += 'LEFTLEG';
                    if (tmp.length !== 0 && tmp2.length !== 0)
                        data['create arguments'] += `${tmp.join(' | ')} | ({ ${tmp2.join(', ')} })`;
                    else if (tmp.length !== 0)
                        data['create arguments'] += tmp.join(' | ');
                    else
                        data['create arguments'] += tmp2.join(', ');
                    if (obj.enchantment !== 0) {
                        data['create arguments'] += `, ${obj.enchantment}`;
                        data['create arguments comment'] += ', Natural enchantment';
                    }
                }
                else {
                    let cac = '//Type, Material, Quality, Limbs';
                    data['create arguments comment'] = `\n   create_armour("${obj.subType}", ${obj.material || 'leather'}", "${obj.quality || 'average'}"`;
                    if (tmp.length === 0 && tmp2.length === 0)
                        data['create arguments comment'] += 'LEFTLEG';
                    if (tmp.length !== 0 && tmp2.length !== 0)
                        data['create arguments comment'] += `${tmp.join(' | ')} | ({ ${tmp2.join(', ')} })`;
                    else if (tmp.length !== 0)
                        data['create arguments comment'] += tmp.join(' | ');
                    else
                        data['create arguments comment'] += tmp2.join(', ');
                    if (obj.enchantment !== 0) {
                        data['create arguments comment'] += `, ${obj.enchantment}`;
                        cac += ', Natural enchantment';
                    }
                    data['create arguments comment'] += ');\n' + cac;
                    if (obj.wType.length > 0)
                        data['create body'] += `   set_weapon_type("${obj.material}");\n`;
                }
                if (obj.maxWearable !== 0)
                    tempProps['max_wearable'] = `"${obj.maxWearable}"`;
                if (obj.limbsOptional)
                    data['create body'] += '   set_limbs_optional(1);\n';
                //#endregion
                break;
            case StdObjectType.weapon:
                //#region Weapon
                bonuses = true;
                skills = true;
                data['doc'].push('/doc/build/weapon/tutorial');
                switch (obj.subType || '') {
                    case 'arrow':
                        data.inherit = 'OBJ_ARROW';
                        data['doc'].push('/doc/build/weapon/types/arrow');
                        data['create arguments'] = `"${obj.material || 'leather'}", "${obj.quality || 'average'}"`;
                        data['create arguments comment'] = '//Material, Quality';
                        if (obj.enchantment !== 0) {
                            data['create arguments'] += ', 0';
                            data['create arguments comment'] += ', Type';
                        }
                        break;
                    case 'bolas':
                        data.inherit = 'OBJ_BOLAS';
                        data['doc'].push('/doc/build/weapon/types/bolas');
                        data['create arguments'] = `"${obj.material || 'leather'}", "${obj.quality || 'average'}"`;
                        data['create arguments comment'] = '//Material, Quality';
                        break;
                    case 'bow':
                    case 'long bow':
                    case 'longbow':
                    case 'recurve bow':
                    case 'self bow':
                    case 'crossbow':
                        data.inherit = 'OBJ_BOW';
                        data['doc'].push('/doc/build/weapon/types/bow');
                        data.help.push('wtypes bow');
                        data['create arguments'] = `"${obj.subType}", "${obj.material || 'wood'}", "${obj.quality || 'inferior'}"`;
                        data['create arguments comment'] = '//Type, Material, Quality';
                        break;
                    case 'shield':
                    case 'buckler':
                    case 'large shield':
                    case 'small shield':
                        data.inherit = 'OBJ_SHIELD';
                        data.help.push('wtypes shield');
                        data['doc'].push('/doc/build/weapon/types/shield');
                        data['create arguments'] = `"${obj.subType}", "${obj.material || 'wood'}", "${obj.quality || 'inferior'}"`;
                        data['create arguments comment'] = '//Type, Material, Quality';
                        break;
                    default:
                        data.help.push('wtypes');
                        data.inherit = 'OBJ_WEAPON';
                        data['create arguments'] = `"${obj.subType || 'blunt'}", "${obj.material || 'wood'}", "${obj.quality || 'inferior'}"`;
                        data['create arguments comment'] = '//Type, Material, Quality';
                        break;
                }
                if (obj.enchantment !== 0) {
                    data['create arguments'] += `, ${obj.enchantment}`;
                    data['create arguments comment'] += ', Natural enchantment';
                }
                //#endregion
                break;
            case StdObjectType.food:
                //#region Food
                data.inherit = 'OBJ_FOOD';
                if (obj.bait)
                    data.inherits = '\ninherit OBJ_FISHING_BAIT;';
                data['doc'].push('/doc/build/etc/food');
                if (obj.myMessage && obj.myMessage.trim().length !== 0 && obj.yourMessage && obj.yourMessage.trim().length !== 0)
                    data['create body'] += `   set_eat("${obj.myMessage.trim()}", "${obj.yourMessage.trim()}");\n`;
                else if (obj.myMessage && obj.myMessage.trim().length !== 0)
                    data['create body'] += `   set_eat("${obj.myMessage.trim()}", "$N eats $O.");\n`;
                else if (obj.yourMessage && obj.yourMessage.trim().length !== 0)
                    data['create body'] += `   set_eat("You eat $O.", "${obj.yourMessage.trim()}");\n`;
                data['create body'] += `   set_strength(${obj.strength || 0});\n`;
                if (obj.decay !== 300)
                    data['create body'] += `   set_decay(${obj.decay});\n`;
                if (obj.decayMessage && obj.decayMessage.trim().length !== 0)
                    data['create body'] += `   set_decay_message("${obj.decayMessage}");\n`;
                if (obj.preserved && obj.preserved.trim().length !== 0) {
                    switch (obj.preserved.trim().toLowerCase()) {
                        case 'smoked':
                        case 'cooked':
                            data['create body'] += `   set_preserved(%^RESET%^mono11%^${obj.preserved.trim().toLowerCase()}%^DEFAULT%^");\n`;
                            break;
                        case 'salted':
                            data['create body'] += `   set_preserved(%^RESET%^BOLD%^${obj.preserved.trim().toLowerCase()}%^DEFAULT%^");\n`;
                            break;
                        case 'dehydrated':
                            data['create body'] += `   set_preserved(%^RESET%^RGB320%^${obj.preserved.trim().toLowerCase()}%^DEFAULT%^");\n`;
                            break;
                        default:
                            if (obj.preserved.match(/%\^/g) && !obj.preserved.trim().endsWith('%^DEFAULT%^'))
                                data['create body'] += `   set_preserved("${obj.preserved.trim()}%^DEFAULT%^");\n`;
                            else
                                data['create body'] += `   set_preserved("${obj.preserved.trim()}");\n`;
                            break;
                    }
                }
                //#endregion
                break;
            case StdObjectType.drink:
                //#region Drink
                data.inherit = 'OBJ_FOOD';
                data['doc'].push('/doc/build/etc/drinks');
                if (obj.myMessage && obj.myMessage.trim().length !== 0 && obj.yourMessage && obj.yourMessage.trim().length !== 0)
                    data['create body'] += `   set_drink("${obj.myMessage.trim()}", "${obj.yourMessage.trim()}");\n`;
                else if (obj.myMessage && obj.myMessage.trim().length !== 0)
                    data['create body'] += `   set_drink("${obj.myMessage.trim()}", "$N drinks $O.");\n`;
                else if (obj.yourMessage && obj.yourMessage.trim().length !== 0)
                    data['create body'] += `   set_drink("You drink $O.", "${obj.yourMessage.trim()}");\n`;
                data['create body'] += `   set_strength(${obj.strength || 0});\n`;
                if (obj.quenched && obj.quenched !== 0 && obj.quenched !== obj.strength)
                    data['create body'] += `   set_quenched_strength(${obj.quenched});\n`;
                if (obj.drinks && obj.drinks !== 5)
                    data['create body'] += `   set_drinks(${obj.drinks});\n`;
                if (obj.maxDrinks && obj.maxDrinks !== 5)
                    data['create body'] += `   set_max_drinks(${obj.maxDrinks});\n`;
                if (!obj.empty)
                    data['create body'] += `   set_create_bottle(0);\n`;
                if (obj.emptyName && obj.emptyName.trim() !== 'bottle')
                    data['create body'] += `   set_empty_name("${obj.emptyName.trim()}");\n`;
                if (obj.subType && obj.subType.trim() !== 'alcoholic')
                    data['create body'] += `   set_drink_type("${obj.subType.trim()}");\n`;
                //#endregion
                break;
            case StdObjectType.fishing_pole:
                //#region fishing pole
                bonuses = true;
                skills = true;
                data['doc'].push('/doc/build/weapon/tutorial');
                data.help.push('wtypes');
                data.inherit = 'OBJ_FISHING_POLE';
                data['create arguments'] = `"${obj.subType || 'staff'}", "${obj.material || 'wood'}", "${obj.quality || 'average'}"`;
                data['create arguments comment'] = '//Type, Material, Quality';
                if (obj.enchantment !== 0) {
                    data['create arguments'] += `, ${obj.enchantment}`;
                    data['create arguments comment'] += ', Natural enchantment';
                }
                if (!obj.canBait)
                    data['create body'] += `   set_can_bait(0);\n`;
                if (obj.class !== 0)
                    data['create body'] += `   set_pole_class("${obj.class}");\n`;
                //#endregion
                break;
            case StdObjectType.backpack:
                //#region backpack
                bonuses = true;
                skills = true;
                //string matarm, string qualarm, mixed armlimbs, int charm
                data.inherit = 'OBJ_BACKPACK';
                data['doc'].push('/doc/build/armours/tutorial');
                data['doc'].push('/doc/build/armours/types/backpacks');
                data.help.push('atypes');

                data['create arguments'] = `"${obj.material || 'heavy cloth'}", "${obj.quality || 'average'}"`;
                data['create arguments comment'] = '//Material, Quality';
                if (obj.enchantment !== 0) {
                    data['create arguments'] += `, ${obj.enchantment}`;
                    data['create arguments comment'] += ', Natural enchantment';
                }
                if (obj.subType !== 'pack')
                    data['create body'] += `   set_backpack_type("${obj.subType}");\n`;
                if (obj.encumbrance !== 4000)
                    data['create body'] += `   set_max_encumbrance(${obj.encumbrance});\n`;
                if (obj.reduce > 0 && obj.reduce !== 1 || obj.reduce !== 1.0)
                    data['create body'] += `   set_reduce_item_mass(${obj.reduce});\n`;
                //#endregion
                break;
            case StdObjectType.bag_of_holding:
                //#region bag_of_holding
                data.inherit = 'OBJ_BAGOFHOLDING';
                data['create arguments comment'] = '';
                if (obj.encumbrance !== 40000) {
                    data['create arguments'] = `${obj.encumbrance}`;
                    data['create arguments comment'] = '// Max encumbrance'
                }
                else if (obj.maxitems !== 0 || obj.minencumbrance !== 500) {
                    data['create arguments'] = '40000';
                    data['create arguments comment'] = '// Max encumbrance'
                }
                if (obj.maxitems !== 0) {
                    data['create arguments'] += `, ${obj.maxitems}`;
                    data['create arguments comment'] += ', Max items'
                }
                else if (obj.minencumbrance !== 500) {
                    data['create arguments'] += `, 0`;
                    data['create arguments comment'] += ', Max items'
                }
                if (obj.minencumbrance !== 500) {
                    data['create arguments'] += `, ${obj.minencumbrance}`;
                    data['create arguments comment'] += ', Min encumbrance'
                }
                //#endregion
                break;
            default:
                //#region Object
                data.inherit = 'STD_OBJECT';
                if (obj.bait)
                    data.inherits = '\ninherit OBJ_FISHING_BAIT;';
                if (obj.material.length > 0)
                    data['create body'] += `   set_material("${obj.material}");\n`;
                //#endregion
                break;
        }

        if (obj.name.startsWith('"') && obj.name.endsWith('"'))
            data.name = stripPinkfish(obj.name.substr(1, obj.name.length - 2).replace(/"/g, '\\"'));
        else
            data.name = stripPinkfish(obj.name.replace(/"/g, '\\"'));
        obj.short = obj.short.trim();
        if (obj.short.startsWith('(:')) {
            data.short = formatFunctionPointer(obj.short);
            data['create pre'] += createFunction(obj.short, 'string');
        }
        else if (obj.short.startsWith('"') && obj.short.endsWith('"'))
            data.short = `${obj.short}`;
        else
            data.short = `"${obj.short.replace(/"/g, '\\"')}"`;
        obj.long = obj.long.trim();
        if (obj.long.startsWith('(:')) {
            data.long = formatFunctionPointer(obj.long);
            data['create pre'] += createFunction(obj.long, 'string');
            data.description = obj.long.substr(2);
            if (data.description.endsWith(':)'))
                data.description = data.description.substr(0, data.description.length - 2);
            data.description = data.description.trim();
        }
        else {
            if (!obj.long.startsWith('"') && !obj.long.endsWith('"'))
                obj.long = obj.long.replace(/"/g, '\\"');
            if (obj.long.startsWith('"'))
                obj.long = obj.long.substr(1);
            if (obj.long.endsWith('"'))
                obj.long = obj.long.substr(0, obj.long.length - 1);
            if (obj.long.length > 70) {
                data.description = formatString(obj.long, 0, 77, ' * ', '');
                tmp = obj.long.substr(0, 66);
                let tl = tmp.length;
                while (tl--) {
                    if (tmp.charAt(tl) === ' ') {
                        tmp = tmp.substr(0, tl + 1);
                        break;
                    }
                }
                data.long = `"${tmp}"\n     `;
                obj.long = obj.long.substr(tmp.length);
                data.long += `${formatString(obj.long, 5, 73)}`;
            }
            else {
                data.long = `"${obj.long}"`;
                data.description = ' * ' + obj.long;
            }
        }
        data.description = stripPinkfish(data.description);

        if (obj.nouns.length > 0) {
            obj.nouns = obj.nouns.split(',');
            obj.nouns = obj.nouns.map(w => {
                w = w.trim();
                if (!w.startsWith('"') && !w.endsWith('"'))
                    w = '"' + w.replace(/"/g, '\\"') + '"';
                return w;
            });
            data['create body'] += '   set_nouns(' + obj.nouns.join(', ') + ');\n';
        }
        if (obj.adjectives.length > 0) {
            obj.adjectives = obj.adjectives.split(',');
            obj.adjectives = obj.adjectives.map(w => {
                w = w.trim();
                if (!w.startsWith('"') && !w.endsWith('"'))
                    w = '"' + w.replace(/"/g, '\\"') + '"';
                return w;
            });
            data['create body'] += '   set_adjectives(' + obj.adjectives.join(', ') + ');\n';
        }

        if (obj.properties.length > 0) {
            obj.properties.forEach(b => {
                b.value = b.value.trim();
                if (b.value.startsWith('(:')) {
                    if (b.type === 1)
                        tempProps[b.name] = formatFunctionPointer(b.value);
                    else
                        props[b.name] = formatFunctionPointer(b.value);
                    data['create pre'] += createFunction(b.value);
                }
                else if (b.value.startsWith('({')) {
                    tmp2 = b.value.substring(2);
                    if (tmp2.endsWith('})'))
                        tmp2 = tmp2.substr(0, tmp2.length - 2);
                    tmp2 = tmp2.split(',');
                    tmp2 = tmp2.map(t => {
                        t = t.trim();
                        if ((t.startsWith('"') && t.endsWith('"')) || t.match(/^\d+$/))
                            return t;
                        else if (t.startsWith('(:')) {
                            t = formatFunctionPointer(t);
                            data['create pre'] += createFunction(t);
                            return t;
                        }
                        return `"${t}"`;
                    });
                    if (b.type === 1)
                        tempProps[b.name] = `({ ${tmp2.join(', ')} })`;
                    else
                        props[b.name] = `({ ${tmp2.join(', ')} })`;
                }
                else if ((b.value.startsWith('"') && b.value.endsWith('"')) || b.value.match(/^\d+$/)) {
                    if (b.type === 1)
                        tempProps[b.name] = b.value;
                    else
                        props[b.name] = b.value;
                }
                else {
                    if (b.type === 1)
                        tempProps[b.name] = `"${b.value}"`;
                    else
                        props[b.name] = `"${b.value}"`;
                }
            });
        }

        //data['create body'] += `   set_temp_property("max_wearable", ${obj.maxWearable});\n`;

        if (obj.keyID.length > 0 && obj.type !== StdObjectType.chest)
            props['key'] = `"${obj.keyID}"`;

        if (obj.mass > 0)
            data['create body'] += `   set_mass(${obj.mass});\n`;
        if (obj.value > 0)
            data['create body'] += `   set_value("${obj.value}");\n`;

        tempProps = Object.keys(tempProps).map(k => `"${k}" : ${tempProps[k]}`);
        props = Object.keys(props).map(k => `"${k}" : ${tempProps[k]}`);

        if (tempProps.length === 1)
            data['create body'] += `   set_temp_property(${tempProps[0].replace(' :', ',')});\n`;
        else if (tempProps.length > 0) {
            data['create body'] += '   set_temp_properties( ([\n       ';
            data['create body'] += tempProps.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }

        if (props.length === 1)
            data['create body'] += `   set_property(${props[0].replace(' :', ',')});\n`;
        else if (props.length > 0) {
            data['create body'] += '   set_properties( ([\n       ';
            data['create body'] += props.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        if (obj.bait && (obj.type === StdObjectType.object || obj.type === StdObjectType.food)) {
            if (obj.baitStrength !== 0)
                data['create body'] += `   set_bait_strength(${obj.baitStrength});\n`;
            if (obj.baitUses !== 0)
                data['create body'] += `   set_uses(${obj.baitUses});\n`;
        }
        //#region prevent actions
        obj.preventOffer = obj.preventOffer.trim();
        if (obj.preventOffer.startsWith('(:')) {
            data['create body'] += `   set_prevent_offer(${formatFunctionPointer(obj.preventOffer)});\n`;
            data['create pre'] += createFunction(obj.preventOffer, 'string');
        }
        else if (obj.preventOffer.startsWith('"') && obj.preventOffer.endsWith('"'))
            data['create body'] += `   set_prevent_offer(${obj.preventOffer});\n`;
        else if (obj.preventOffer === 'true' || obj.preventOffer === 1 || obj.preventOffer === '1')
            data['create body'] += `   set_prevent_offer(1);\n`;
        else if (obj.preventOffer.length > 0)
            data['create body'] += `   set_prevent_offer("${obj.preventOffer.replace(/"/g, '\\"')}");\n`;

        obj.preventGet = obj.preventGet.trim();
        if (obj.preventGet.startsWith('(:')) {
            data['create body'] += `   set_prevent_get(${formatFunctionPointer(obj.preventGet)});\n`;
            data['create pre'] += createFunction(obj.preventGet, 'string');
        }
        else if (obj.preventGet.startsWith('"') && obj.preventGet.endsWith('"'))
            data['create body'] += `   set_prevent_get(${obj.preventGet});\n`;
        else if (obj.preventGet === 'true' || obj.preventGet === 1 || obj.preventGet === '1')
            data['create body'] += `   set_prevent_get(1);\n`;
        else if (obj.preventGet.length > 0)
            data['create body'] += `   set_prevent_get("${obj.preventGet.replace(/"/g, '\\"')}");\n`;

        obj.preventDrop = obj.preventDrop.trim();
        if (obj.preventDrop.startsWith('(:')) {
            data['create body'] += `   set_prevent_drop(${formatFunctionPointer(obj.preventDrop)});\n`;
            data['create pre'] += createFunction(obj.preventDrop, 'string');
        }
        else if (obj.preventDrop.startsWith('"') && obj.preventDrop.endsWith('"'))
            data['create body'] += `   set_prevent_drop(${obj.preventDrop});\n`;
        else if (obj.preventDrop === 'true' || obj.preventDrop === 1 || obj.preventDrop === '1')
            data['create body'] += `   set_prevent_drop(1);\n`;
        else if (obj.preventDrop.length > 0)
            data['create body'] += `   set_prevent_drop("${obj.preventDrop.replace(/"/g, '\\"')}");\n`;

        obj.preventPut = obj.preventPut.trim();
        if (obj.preventPut.startsWith('(:')) {
            data['create body'] += `   set_prevent_put(${formatFunctionPointer(obj.preventPut)});\n`;
            data['create pre'] += createFunction(obj.preventPut, 'string');
        }
        else if (obj.preventPut.startsWith('"') && obj.preventPut.endsWith('"'))
            data['create body'] += `   set_prevent_put(${obj.preventPut});\n`;
        else if (obj.preventPut === 'true' || obj.preventPut === 1 || obj.preventPut === '1')
            data['create body'] += `   set_prevent_put(1);\n`;
        else if (obj.preventPut.length > 0)
            data['create body'] += `   set_prevent_put("${obj.preventPut.replace(/"/g, '\\"')}");\n`;

        obj.preventSteal = obj.preventSteal.trim();
        if (obj.preventSteal.startsWith('(:')) {
            data['create body'] += `   set_prevent_steal(${formatFunctionPointer(obj.preventSteal)});\n`;
            data['create pre'] += createFunction(obj.preventSteal, 'string');
        }
        else if (obj.preventSteal.startsWith('"') && obj.preventSteal.endsWith('"'))
            data['create body'] += `   set_prevent_steal(${obj.preventSteal});\n`;
        else if (obj.preventSteal === 'true' || obj.preventSteal === 1 || obj.preventSteal === '1')
            data['create body'] += `   set_prevent_steal(1);\n`;
        else if (obj.preventSteal.length > 0)
            data['create body'] += `   set_prevent_steal("${obj.preventSteal.replace(/"/g, '\\"')}");\n`;
        //#endregion
        if (bonuses && obj.bonuses && obj.bonuses.length !== 0) {
            tmp = obj.bonuses.filter(b => b.type === 0 && b.amount && b.adjust.length !== 0 && b.adjust !== 'false');
            tmp = tmp.map(b => {
                if (b.amount.startsWith('(') || (typeof b.amount === 'string' && parseFloat(b.amount).toString() === b.amount))
                    return `"${b.adjust}" : ${b.amount}`;
                else if (b.amount === true || b.amount === 'true')
                    return `"${b.adjust}" : 1`;
                return `"${b.adjust}" : "${b.amount}"`;
            });
            if (tmp.length === 1)
                data['create body'] += `   add_temp_bonus(${tmp[0].replace(/ :/, ',')});\n`;
            else if (tmp.length > 0) {
                data['create body'] += '   add_temp_bonuses( ([\n       ';
                data['create body'] += tmp.join(',\n       ');
                data['create body'] += '\n     ]) );\n';
            }
            tmp = obj.bonuses.filter(b => b.type === 1 && b.amount && b.adjust.length !== 0 && b.adjust !== 'false');
            tmp = tmp.map(b => {
                if (b.amount.startsWith('(') || (typeof b.amount === 'string' && parseFloat(b.amount).toString() === b.amount))
                    return `"${b.adjust}" : ${b.amount}`;
                else if (b.amount === true || b.amount === 'true')
                    return `"${b.adjust}" : 1`;
                return `"${b.adjust}" : "${b.amount}"`;
            });
            if (tmp.length === 1)
                data['create body'] += `   add_temp_stat_bonus(${tmp[0].replace(/ :/, ',')});\n`;
            else if (tmp.length > 0) {
                data['create body'] += '   add_temp_stat_bonuses( ([\n       ';
                data['create body'] += tmp.join(',\n       ');
                data['create body'] += '\n     ]) );\n';
            }
            tmp = obj.bonuses.filter(b => b.type === 2 && b.amount && b.adjust.length !== 0 && b.adjust !== 'false');
            tmp = tmp.map(b => {
                if (b.amount.startsWith('(') || (typeof b.amount === 'string' && parseFloat(b.amount).toString() === b.amount))
                    return `"${b.adjust}" : ${b.amount}`;
                else if (b.amount === true || b.amount === 'true')
                    return `"${b.adjust}" : 1`;
                return `"${b.adjust}" : "${b.amount}"`;
            });
            if (tmp.length === 1)
                data['create body'] += `   add_temp_skill_bonus(${tmp[0].replace(/ :/, ',')});\n`;
            else if (tmp.length > 0) {
                data['create body'] += '   add_temp_skill_bonuses( ([\n       ';
                data['create body'] += tmp.join(',\n       ');
                data['create body'] += '\n     ]) );\n';
            }
            tmp = obj.bonuses.filter(b => b.type === 3 && b.amount && b.adjust.length !== 0 && b.adjust !== 'false');
            tmp = tmp.map(b => {
                if (b.amount.startsWith('(') || (typeof b.amount === 'string' && parseFloat(b.amount).toString() === b.amount))
                    return `"${b.adjust}" : ${b.amount}`;
                else if (b.amount === true || b.amount === 'true')
                    return `"${b.adjust}" : 1`;
                return `"${b.adjust}" : "${b.amount}"`;
            });
            if (tmp.length === 1)
                data['create body'] += `   add_temp_resistance_bonus(${tmp[0].replace(/ :/, ',')});\n`;
            else if (tmp.length > 0) {
                data['create body'] += '   add_temp_resistance_bonuses( ([\n       ';
                data['create body'] += tmp.join(',\n       ');
                data['create body'] += '\n     ]) );\n';
            }
        }
        if (skills && obj.skills && obj.skills.length !== 0) {
            tmp = obj.skills.filter(s => s.amount !== 0);
            if (tmp.length !== 0) {
                let amt = 0;
                data['create post'] += '\n\nmixed check_skill(object player)\n{\n   if(!player)\n      return 0;\n';
                let skill;
                tmp.forEach(s => {
                    let message;
                    if (s.message && s.message.length === 0)
                        s.message = 0;
                    if (s.type === 1) {
                        if (s.amount * 5 > amt)
                            amt = s.amount * 5;
                        if (obj.type === StdObjectType.armor)
                            message = s.message || 'You do not have the experiance to wear this armor.';
                        else if (obj.type === StdObjectType.sheath)
                            message = s.message || 'You do not have the experiance to wear this sheath.';
                        else
                            message = s.message || 'You do not have the experiance to wield this weapon.';
                        switch (s.class) {
                            case 1:
                                data['create post'] += `   if(player->query_level() < ${s.amount} && player->query_class() == "fighter")\n      return "${message}";\n`;
                                break;
                            case 2:
                                data['create post'] += `   if(player->query_level() < ${s.amount} && player->query_class() == "monk")\n      return "${message}";\n`;
                                break;
                            case 3:
                                data['create post'] += `   if(player->query_level() < ${s.amount} && player->query_class() == "mage")\n      return "${message}";\n`;
                                break;
                            case 4:
                                data['create post'] += `   if(player->query_level() < ${s.amount} && player->query_class() == "rogue")\n      return "${message}";\n`;
                                break;
                            case 5:
                                data['create post'] += `   if(player->query_level() < ${s.amount} && player->query_class() == "cleric")\n      return "${message}";\n`;
                                break;
                            default:
                                data['create post'] += `   if(player->query_level() < ${s.amount})\n      return "${message}";\n`;
                                break;
                        }
                        return;
                    }
                    if (obj.type === StdObjectType.armor) {
                        skill = s.skill || '"armour"';
                        message = s.message || 'You do not have the skill to wear this armor.';
                    }
                    else if (obj.type === StdObjectType.sheath) {
                        skill = s.skill || '"armour"';
                        message = s.message || 'You do not have the skill to wear this sheath.';
                    }
                    else {
                        skill = 'WEAPON_D->query_skill(this_object())';
                        message = s.message || 'You do not have the skill to wield this weapon.';
                    }
                    if (s.amount > amt)
                        amt = s.amount;
                    switch (s.class) {
                        case 1:
                            data['create post'] += `   if(player->query_skill(${skill}) < ${s.amount} && player->query_class() == "fighter")\n      return "${message}";\n`;
                            break;
                        case 2:
                            data['create post'] += `   if(player->query_skill(${skill}) < ${s.amount} && player->query_class() == "monk")\n      return "${message}";\n`;
                            break;
                        case 3:
                            data['create post'] += `   if(player->query_skill(${skill}) < ${s.amount} && player->query_class() == "mage")\n      return "${message}";\n`;
                            break;
                        case 4:
                            data['create post'] += `   if(player->query_skill(${skill}) < ${s.amount} && player->query_class() == "rogue")\n      return "${message}";\n`;
                            break;
                        case 5:
                            data['create post'] += `   if(player->query_skill(${skill}) < ${s.amount} && player->query_class() == "cleric")\n      return "${message}";\n`;
                            break;
                        default:
                            data['create post'] += `   if(player->query_skill(${skill}) < ${s.amount})\n      return "${message}";\n`;
                            break;
                    }
                });
                data['create post'] += '   return 1;\n}\n';
                if (amt !== 0)
                    data['create body'] += `   set_skill_level(${amt});\n`;
            }
        }
        //#region reads
        tmp = obj.reads.map(i => {
            tmp2 = i.read.split(',').map(t => {
                t.trim();
                if (!t.startsWith('"') && !t.endsWith('"'))
                    t = '"' + t + '"';
                return t;
            });
            if (tmp2.length === 1)
                tmp2 = tmp2[0];
            else
                tmp2 = `({ ${tmp2.join(', ')} })`;
            tmp3 = i.description.trim();
            if (tmp3.startsWith('(:')) {
                tmp3 = formatFunctionPointer(tmp3, true);
                data['create pre'] += createFunction(tmp3, 'string', 'string id');
            }
            else if (!tmp3.startsWith('"') && !tmp3.endsWith('"'))
                tmp3 = '"' + tmp3 + '"';
            if (tmp2.length === 0)
                tmp2 = 'default';
            if (i.language.length !== 0)
                return `${tmp2} : ([ "value" : ${tmp3}, "lang" : "${i.language}" ]) `;
            return `${tmp2} : ${tmp3}`;
        });

        if (tmp.length === 1) {
            tmp = obj.reads[0];
            tmp2 = tmp.read.split(',').map(t => {
                t.trim();
                if (!t.startsWith('"') && !t.endsWith('"'))
                    t = '"' + t + '"';
                return t;
            });
            if (tmp2.length === 1)
                tmp2 = tmp2[0];
            else
                tmp2 = `({ ${tmp2.join(', ')} })`;
            if ((tmp2 === 'default' || tmp2.length === 0) && tmp.language.length === 0)
                tmp2 = '';
            else if (tmp2.length === 0)
                tmp2 = '"default", ';
            else
                tmp2 += ', ';
            tmp.description = tmp.description.trim();
            tmp3 = '';
            if (tmp.language.length !== 0)
                tmp3 = `, "${tmp.language}"`;
            if (tmp.description.startsWith('(:'))
                data['create body'] += `   set_read(${tmp2}${formatFunctionPointer(tmp.description)}${tmp3});\n`;
            else if (!tmp.description.startsWith('"') && !tmp.description.endsWith('"'))
                data['create body'] += `   set_read(${tmp2}"${tmp.description}"${tmp3});\n`;
            else
                data['create body'] += `   set_read(${tmp2}${tmp.description}${tmp3});\n`;
        }
        else if (tmp.length > 0) {
            data['create body'] += '   set_read( ([\n       ';
            data['create body'] += tmp.join(',\n       ');
            data['create body'] += '\n     ]) );\n';
        }
        //#endregion
        //add docs
        if (data['doc'].length > 0)
            data['doc'] = ' * @doc ' + data['doc'].join('\n * @doc ') + '\n';
        else
            data['doc'] = '';
        if (data['help'].length > 0)
            data['doc'] += ' * @help ' + data['help'].join('\n * @help ') + '\n';
        if (obj.notes.length !== 0) {
            if (data.description.length !== 0)
                data.description += '\n';
            data.description += ' * Notes:\n * ' + obj.notes.split('\n').join('\n * ') + '\n *';
        }
        return this.parseFileTemplate(this.read(parseTemplate(path.join('{assets}', 'templates', 'wizards', 'designer', 'object.c'))), data);
    }

    private getExitId(exit, x, y, z) {
        switch (exit) {
            case 'north':
                return `${x},${y - 1},${z}`;
            case 'northeast':
                return `${x + 1},${y - 1},${z}`;
            case 'east':
                return `${x + 1},${y},${z}`;
            case 'southeast':
                return `${x + 1},${y + 1},${z}`;
            case 'south':
                return `${x},${y + 1},${z}`;
            case 'southwest':
                return `${x - 1},${y + 1},${z}`;
            case 'west':
                return `${x - 1},${y},${z}`;
            case 'northwest':
                return `${x - 1},${y - 1},${z}`;
            case 'up':
                return `${x},${y},${z + 1}`;
            case 'down':
                return `${x},${y},${z - 1}`;
        }
        return '';
    }

    private parseFileTemplate(template, data) {
        if (!data || !template || template.length === 0) return template;
        let d;
        for (d in data) {
            if (!data.hasOwnProperty(d))
                continue;
            if (data[d].regex)
                template = template.replace(data[d].regex, data[d].value);
            else
                template = template.replace(new RegExp('{' + d + '}', 'g'), data[d]);
        }
        return template;
    }

    private parseFilePath(path: string) {
        if (path.toLowerCase().startsWith('${rms}'))
            return `RMS + "${path.substring(6)}"`;
        if (path.toLowerCase().startsWith('${mon}'))
            return `MON + "${path.substring(6)}"`;
        if (path.toLowerCase().startsWith('${std}'))
            return `STD + "${path.substring(6)}"`;
        if (path.toLowerCase().startsWith('${obj}'))
            return `OBJ + "${path.substring(6)}"`;
        if (path.toLowerCase().startsWith('${cmds}'))
            return `CMDS + "${path.substring(7)}"`;
        return `"${path}"`;
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
                        const base = this.$area.baseRooms[room.type] || this.$area.baseRooms[this.$area.defaultRoom];
                        if (!room.empty && !room.equals(base, true)) this.$roomCount++;
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
        this.emit('rebuild-menu', 'edit');
        this.emit('resize-map');
        Timer.end('Resize time');
        this.doUpdate(UpdateType.drawMap);
        this.changed = true;
        if (!noUndo)
            this.pushUndo(undoAction.edit, undoType.resize, { width: width, height: height, depth: depth, shift: shift });
    }

    public flipMap(type: flipType, noUndo?) {
        Timer.start();
        const zl = this.$area.size.depth;
        const xl = this.$area.size.width;
        const yl = this.$area.size.height;
        const rooms = Array.from(Array(zl),
            (v, z) => Array.from(Array(xl),
                (v2, y) => Array.from(Array(yl),
                    (v3, x) => new Room(x, y, z, this.$area.baseRooms[this.$area.defaultRoom], this.$area.defaultRoom))
            ));

        this.$roomCount = 0;
        for (let z = 0; z < zl; z++) {
            for (let y = 0; y < yl; y++) {
                for (let x = 0; x < xl; x++) {
                    const room = this.$area.rooms[z][y][x];
                    let idx;
                    if (!room) continue;
                    if ((type & flipType.horizontal) === flipType.horizontal) {
                        room.x = xl - room.x - 1;
                        room.switchExits(RoomExit.West, RoomExit.East);
                        room.switchExits(RoomExit.NorthWest, RoomExit.NorthEast);
                        room.switchExits(RoomExit.SouthWest, RoomExit.SouthEast);
                    }
                    if ((type & flipType.vertical) === flipType.vertical) {
                        room.y = yl - room.y - 1;
                        room.switchExits(RoomExit.North, RoomExit.South);
                        room.switchExits(RoomExit.NorthWest, RoomExit.SouthWest);
                        room.switchExits(RoomExit.NorthEast, RoomExit.SouthEast);
                    }
                    if ((type & flipType.depth) === flipType.depth) {
                        room.z = zl - room.z - 1;
                        room.switchExits(RoomExit.Down, RoomExit.Up);
                    }
                    rooms[room.z][room.y][room.x] = room;
                    idx = this.$selectedRooms.indexOf(this.$area.rooms[z][y][x]);
                    if (idx !== -1)
                        this.$selectedRooms[idx] = rooms[room.z][room.y][room.x];
                    if (this.$focusedRoom && this.$focusedRoom.at(x, y, z))
                        this.$focusedRoom = rooms[room.z][room.y][room.x];
                    const base = this.$area.baseRooms[room.type] || this.$area.baseRooms[this.$area.defaultRoom];
                    if (!room.empty && !room.equals(base, true)) this.$roomCount++;
                }
            }
        }
        this.$area.rooms = rooms;
        this.UpdateEditor(this.$selectedRooms);
        this.UpdatePreview(this.selectedFocusedRoom);
        this.BuildAxises();
        this.emit('flip-map');
        Timer.end('Flip time');
        this.doUpdate(UpdateType.drawMap);
        this.changed = true;
        if (!noUndo)
            this.pushUndo(undoAction.edit, undoType.flip, { type: type });
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
            this.$propertiesEditor.defaultRoom.selectpicker('refresh').val(this.$area.defaultRoom).selectpicker('render');
        }
        if (this.$propertiesEditor.defaultMonster) {
            this.$propertiesEditor.defaultMonster.html('<optgroup label="Area">' + Object.keys(this.$area.baseMonsters || { base: null })
                .map(r => `<option value="${r}">${capitalize(r)}</option>`).join('') + '</optgroup><optgroup label="Standard">' +
                MonsterTypes.map(r => `<option value="${r.value}">${r.display}</option>`).join('') + '</optgroup>');
            this.$propertiesEditor.defaultMonster.selectpicker('refresh').val(this.$area.defaultMonster).selectpicker('render');
        }
    }

}

function ellipse(text, len?) {
    if (!len || len < 1) len = 15;
    if (!text || text.lengt <= len) return text || '';
    return text.substr(0, len) + '&hellip;';
}