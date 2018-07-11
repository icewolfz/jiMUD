import { DebugTimer, EditorBase, EditorOptions, FileState } from './editor.base';
import { Splitter, Orientation } from './../splitter';
import { PropertyGrid } from './../propertygrid';
import { EditorType, ValueEditor } from './../value.editors';
import { DataGrid } from './../datagrid';
import { formatString, existsSync, capitalize, wordwrap, leadingZeros, Cardinal, resetCursor, enumToString } from './../library';
const ResizeObserver = require('resize-observer-polyfill');
const { clipboard, remote } = require('electron');
const { Menu, MenuItem, dialog } = remote;
const path = require('path');
const fs = require('fs-extra');
import { MousePosition, RoomExits, FileOpenValueEditor, FileBrowseValueEditor, ExternalExitValueEditor, ItemsValueEditor, RoomExit, RoomStates } from './virtual.editor';

import RGBColor = require('rgbcolor');

interface AreaEditorOptions extends EditorOptions {
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

export enum UpdateType { none = 0, drawMap = 1, buildMap = 2, resize = 5 }

export class Room {
    public exits = 0;
    public x = 0;
    public y = 0;
    public z = 0;
    public terrain;
    public external = {};
    public state = 0;
    public climbs = 0;
    public short = '';
    public long = '';
    public light = 0;
    public sound = '';
    public smell = '';
    public items = [];
    public objects = [];
    public monsters = [];

    constructor(x, y, z, e?, s?) {
        e = +e;
        s = +s;
        this.exits = e !== e ? 0 : e;
        this.x = x;
        this.y = y;
        this.z = z;
        this.external = {};
        this.state = s !== s ? 0 : s;
        this.climbs = 0;
    }

    public clone() {
        const r = new Room(this.x, this.y, this.z, this.exits, this.state);
        let prop;
        for (prop in this) {
            if (!this.hasOwnProperty(prop)) continue;
            if (prop === 'external')
                r.external = cloneObject(this.external);
            else if (prop === 'objects' || prop === 'monsters' || prop === 'items')
                r[prop] = cloneArray(this[prop]);
            else
                r[prop] = this[prop];
        }
        return r;
    }

    public equals(room) {
        if (!room) return false;
        let prop;
        for (prop in this) {
            if (!this.hasOwnProperty(prop)) continue;
            if (this[prop] !== room[prop])
                return false;
        }
        return true;
    }

    public clear() {
        this.exits = 0;
        this.terrain = '';
        this.external = {};
        this.state = 0;
        this.climbs = 0;
        this.short = '';
        this.long = '';
        this.light = 0;
        this.sound = null;
        this.smell = null;
    }

    public at(x, y, z?) {
        if (this.x !== x) return false;
        if (this.y !== y) return false;
        if (z === undefined)
            return true;
        if (this.z !== z) return false;
        return true;
    }
}

function cloneObject(obj) {
    const nObj = {};
    let prop;
    for (prop in this) {
        if (!this.hasOwnProperty(prop)) continue;
        if (typeof obj[prop] === 'object')
            nObj[prop] = cloneObject(obj[prop]);
        else if (Array.isArray(obj[prop]))
            nObj[prop] = cloneArray(obj[prop]);
        else
            nObj[prop] = obj[prop];
    }
    return nObj;
}

function cloneArray(arr) {
    if (!arr || arr.length === 0) return new Array();
    const nArr = new Array(arr.length);
    let l = arr.length;
    while (l--) {
        if (typeof arr[l] === 'object')
            nArr[l] = cloneObject(arr[l]);
        else if (Array.isArray(arr[l]))
            nArr[l] = cloneArray(arr[l]);
        else
            nArr[l] = cloneObject(arr[l]);
    }
    return nArr;
}

enum View {
    map,
    monsters,
    objects
}

const Timer = new DebugTimer();

class Monster {
    public name;
    public long;
    public short;
    public class;
    public level;
    public race;
    public objects = [];

    public clone() {
        const r = new Monster();
        let prop;
        for (prop in this) {
            if (!this.hasOwnProperty(prop)) continue;
            if (prop === 'objects')
                r.objects = cloneArray(this.objects);
            else
                r[prop] = this[prop];
        }
        return r;
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

class StdObject {
    public name;
    public long;
    public short;

    public clone() {
        const r = new StdObject();
        let prop;
        for (prop in this) {
            if (!this.hasOwnProperty(prop)) continue;
            r[prop] = this[prop];
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

class Settings {
    public light: number;
    public terrain: string;
}

class Size {
    public width: number;
    public height: number;
    public depth: number;

    constructor(width, height, depth) {
        this.width = width;
        this.height = height;
        this.depth = depth;
    }

    get right() {
        return this.width * 32;
    }

    get bottom() {
        return this.height * 32;
    }
}

class Area {
    public rooms: Room[][][];
    public monsters: Monster[];
    public objects: StdObject[];
    public settings: Settings;
    public size: Size;

    constructor(width, height, depth) {
        this.size = new Size(width, height, depth);
        this.rooms = Array.from(Array(depth),
            (v, z) => Array.from(Array(height),
                (v2, y) => Array.from(Array(width),
                    (v3, x) => new Room(x, y, z, 0))
            ));
        this.monsters = new Array();
        this.objects = new Array();
        this.settings = new Settings();
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
        let l;
        let prop;
        if (data.settings)
            area.settings = data.settings;
        if (data.monsters) {
            l = data.monsters.length;
            while (l--) {
                area.monsters[l] = new Monster();
                for (prop in data.monsters[l]) {
                    if (!data.monsters[l].hasOwnProperty(prop)) continue;
                    area.monsters[l][prop] = data.monsters[l][prop];
                }
            }
        }
        if (data.items) {
            l = data.items.length;
            while (l--) {
                area.objects[l] = new StdObject();
                for (prop in data.objects[l]) {
                    if (!data.objects[l].hasOwnProperty(prop)) continue;
                    area.objects[l][prop] = data.objects[l][prop];
                }
            }
        }
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
        return area;
    }
    public save(file) {
        fs.writeFileSync(file, JSON.stringify(this));
    }

    public get raw() {
        return JSON.stringify(this);
    }
}

export class AreaEditor extends EditorBase {
    private $saving = false;
    private $view: View = View.map;

    private $label: HTMLElement;
    private $splitterPreview: Splitter;
    private $splitterEditor: Splitter;

    //private $monsterGrid;
    //private $objectGrid;

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
    private $rcount;
    private $depthToolbar: HTMLInputElement;

    private $selectedRooms: Room[] = [];
    private $focusedRoom: Room;
    private $shiftRoom: Room;

    private $roomPreview;
    private $roomEditor;

    private $area: Area;
    private $startOptions;

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

    public get maxLevel() {
        if (!this.$area) return 0;
        return this.$area.size.depth;
    }

    public ensureVisible(x, y) {
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

    constructor(options?: AreaEditorOptions) {
        super(options);
        if (options && options.options)
            this.options = options.options;
        else
            this.options = {
                previewFontSize: 16,
                previewFontFamily: 'Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace',
                editorWidth: 200,
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
        this.$splitterEditor.on('splitter-moved', (e) => {
            this.emit('room-splitter-moved', e);
            this.emit('option-changed', 'editorWidth', e);
        });
        this.$splitterEditor.on('collapsed', (panel) => {
            this.emit('room-splitter-collapsed', panel);
            this.emit('option-changed', 'showRoomEditor', panel !== 2);
            this.emit('menu-update', 'view|room editor', { checked: panel !== 2 });
            this.setButtonState('room editor', panel !== 2);
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
            this.setButtonState('room preview', panel !== 2);
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
                    break;
                case 40: //down
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
                    break;
                case 37: //left
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
                    break;
                case 39: //right
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
                    break;
                case 110:
                case 46: //delete
                    if (this.$selectedRooms.length === 0)
                        return;
                    sl = this.$selectedRooms.length;
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
                                sR.exits |= RoomExit.North;
                                if (x > 0)
                                    sR.exits |= RoomExit.NorthWest;
                                if (x < this.$area.size.width - 1)
                                    sR.exits |= RoomExit.NorthEast;
                            }
                            if (y < this.$area.size.height - 1) {
                                sR.exits |= RoomExit.South;
                                if (x > 0)
                                    sR.exits |= RoomExit.SouthWest;
                                if (x < this.$area.size.width - 1)
                                    sR.exits |= RoomExit.SouthEast;
                            }
                            if (x > 0)
                                sR.exits |= RoomExit.West;
                            if (x < this.$area.size.width - 1)
                                sR.exits |= RoomExit.East;
                        }
                        else {
                            sR.clear();
                            sR.light = this.$area.settings.light;
                        }
                        this.RoomChanged(sR, or);
                        this.DrawRoom(this.$mapContext, sR, true, sR.at(this.$mouse.rx, this.$mouse.ry));
                        if (y > 0 && (e.ctrlKey || (o & RoomExit.North) === RoomExit.North)) {
                            nx = x;
                            ny = y - 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.South;
                                else
                                    p.exits &= ~RoomExit.South;
                                this.DrawRoom(this.$mapContext, p, true, false);
                                this.RoomChanged(p, po);
                            }
                        }
                        if (y > 0 && x > 0 && (e.ctrlKey || (o & RoomExit.NorthWest) === RoomExit.NorthWest)) {
                            nx = x - 1;
                            ny = y - 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.SouthEast;
                                else
                                    p.exits &= ~RoomExit.SouthEast;
                                this.DrawRoom(this.$mapContext, p, true, false);
                                this.RoomChanged(p, po);
                            }
                        }
                        if (y > 0 && x < this.$area.size.width - 1 && (e.ctrlKey || (o & RoomExit.NorthEast) === RoomExit.NorthEast)) {
                            nx = x + 1;
                            ny = y - 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.SouthWest;
                                else
                                    p.exits &= ~RoomExit.SouthWest;
                                this.DrawRoom(this.$mapContext, p, true, false);
                                this.RoomChanged(p, po);
                            }
                        }
                        if (x < this.$area.size.width - 1 && (e.ctrlKey || (o & RoomExit.East) === RoomExit.East)) {
                            nx = x + 1;
                            ny = y;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.West;
                                else
                                    p.exits &= ~RoomExit.West;
                                this.DrawRoom(this.$mapContext, p, true, false);
                                this.RoomChanged(p, po);
                            }
                        }
                        if (x > 0 && (e.ctrlKey || (o & RoomExit.West) === RoomExit.West)) {
                            nx = x - 1;
                            ny = y;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.East;
                                else
                                    p.exits &= ~RoomExit.East;
                                this.DrawRoom(this.$mapContext, p, true, false);
                                this.RoomChanged(p, po);
                            }
                        }
                        if (y < this.$area.size.height - 1 && (e.ctrlKey || (o & RoomExit.South) === RoomExit.South)) {
                            nx = x;
                            ny = y + 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.North;
                                else
                                    p.exits &= ~RoomExit.North;
                                this.DrawRoom(this.$mapContext, p, true, false);
                                this.RoomChanged(p, po);
                            }
                        }
                        if (y < this.$area.size.height - 1 && x < this.$area.size.width - 1 && (e.ctrlKey || (o & RoomExit.SouthEast) === RoomExit.SouthEast)) {
                            nx = x + 1;
                            ny = y + 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.NorthWest;
                                else
                                    p.exits &= ~RoomExit.NorthWest;
                                this.DrawRoom(this.$mapContext, p, true, false);
                                this.RoomChanged(p, po);
                            }
                        }
                        if (x > 0 && y < this.$area.size.height - 1 && (e.ctrlKey || (o & RoomExit.SouthWest) === RoomExit.SouthWest)) {
                            nx = x - 1;
                            ny = y + 1;
                            p = this.getRoom(nx, ny);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.NorthEast;
                                else
                                    p.exits &= ~RoomExit.NorthEast;
                                this.DrawRoom(this.$mapContext, p, true, false);
                                this.RoomChanged(p, po);
                            }
                        }
                        if (this.$depth + 1 < this.$area.size.depth && (e.ctrlKey || (o & RoomExit.Up) === RoomExit.Up)) {
                            p = this.getRoom(x, y, this.$depth + 1);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.Down;
                                else
                                    p.exits &= ~RoomExit.Down;
                                this.RoomChanged(p, po);
                            }
                        }
                        if (this.$depth - 1 >= 0 && (e.ctrlKey || (o & RoomExit.Down) === RoomExit.Down)) {
                            p = this.getRoom(x, y, this.$depth - 1);
                            if (p) {
                                po = p.clone();
                                if (e.ctrlKey)
                                    p.exits |= RoomExit.Up;
                                else
                                    p.exits &= ~RoomExit.Up;
                                this.RoomChanged(p, po);
                            }
                        }
                    }
                    event.preventDefault();
                    break;
                case 97: //num1
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (y < this.$area.size.height - 1 && x > 0) {
                        y++;
                        x--;
                        if (e.ctrlKey)
                            p.exits &= ~RoomExit.SouthWest;
                        else
                            p.exits |= RoomExit.SouthWest;

                        if (o !== p.exits) this.RoomChanged(p, or);
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.NorthEast;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.NorthEast;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);

                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    break;
                case 98: //num2
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (y < this.$area.size.height - 1) {
                        y++;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.exits &= ~RoomExit.South;
                        else
                            this.selectedFocusedRoom.exits |= RoomExit.South;
                        if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.North;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.North;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    break;
                case 99: //num3
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (y < this.$area.size.height - 1 && x < this.$area.size.width - 1) {
                        y++;
                        x++;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.exits &= ~RoomExit.SouthEast;
                        else
                            this.selectedFocusedRoom.exits |= RoomExit.SouthEast;
                        if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.NorthWest;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.NorthWest;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    break;
                case 100: //num4
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (x > 0) {
                        x--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.exits &= ~RoomExit.West;
                        else
                            this.selectedFocusedRoom.exits |= RoomExit.West;
                        if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.East;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.East;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    break;
                case 101: //num5
                    break;
                case 102: //num6
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (x < this.$area.size.width - 1) {
                        x++;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.exits &= ~RoomExit.East;
                        else
                            this.selectedFocusedRoom.exits |= RoomExit.East;
                        if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.West;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.West;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    break;
                case 103: //num7
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (x > 0 && y > 0) {
                        x--;
                        y--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.exits &= ~RoomExit.NorthWest;
                        else
                            this.selectedFocusedRoom.exits |= RoomExit.NorthWest;
                        if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.SouthEast;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.SouthEast;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    break;
                case 104: //num8
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (y > 0) {
                        y--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.exits &= ~RoomExit.North;
                        else
                            this.selectedFocusedRoom.exits |= RoomExit.North;
                        if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.South;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.South;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 105: //num9
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (x < this.$area.size.width - 1 && y > 0) {
                        x++;
                        y--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.exits &= ~RoomExit.NorthEast;
                        else
                            this.selectedFocusedRoom.exits |= RoomExit.NorthEast;
                        if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        this.setSelectedRooms(this.getRoom(x, y));
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.SouthWest;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.SouthWest;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                            this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        this.ensureVisible(x, y);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    break;
                case 107: //+
                    break;
                case 109: //-
                    break;
                case 111: // / up
                    if (this.$selectedRooms.length === 0)
                        return;
                    if (this.$depth + 1 < this.$area.size.depth) {
                        this.$depth++;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.exits &= ~RoomExit.Up;
                        else
                            this.selectedFocusedRoom.exits |= RoomExit.Up;
                        if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        this.setSelectedRooms(this.getRoom(x, y, this.$depth), true);
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.Down;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.Down;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setFocusedRoom(null);
                        this.doUpdate(UpdateType.drawMap);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
                    break;
                case 106: // * down
                    if (this.$selectedRooms.length === 0)
                        return;
                    if (this.$depth - 1 >= 0) {
                        this.$depth--;
                        if (e.ctrlKey)
                            this.selectedFocusedRoom.exits &= ~RoomExit.Down;
                        else
                            this.selectedFocusedRoom.exits |= RoomExit.Down;
                        if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        this.setSelectedRooms(this.getRoom(x, y, this.$depth), true);
                        if (this.selectedFocusedRoom) {
                            or = this.selectedFocusedRoom.clone();
                            o = this.selectedFocusedRoom.exits;
                            if (e.ctrlKey)
                                this.selectedFocusedRoom.exits &= ~RoomExit.Up;
                            else
                                this.selectedFocusedRoom.exits |= RoomExit.Up;
                            if (o !== this.selectedFocusedRoom.exits) this.RoomChanged(this.selectedFocusedRoom, or);
                        }
                        this.setFocusedRoom(null);
                        this.doUpdate(UpdateType.drawMap);
                        this.$map.focus();
                    }
                    this.setFocusedRoom(this.selectedRoom);
                    event.preventDefault();
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
            const first = selected[0];
            items:
            while (sl--) {
                const curr = selected[sl];
                const old = this.getRoom(curr.x, curr.y, curr.z);
                switch (prop) {
                    case 'monsters':
                        break items;
                    case 'objects':
                        break items;
                    case 'external':
                        break items;
                    case 'items':
                        break items;
                    default:
                        curr[prop] = newValue;
                        this.DrawRoom(this.$mapContext, curr, true, curr.at(this.$mouse.rx, this.$mouse.ry));
                        this.RoomChanged(curr, old, true);
                        old[prop] = newValue;
                        break;
                }
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
                property: 'external',
                label: 'External exits',
                formatter: this.formatExternal,
                sort: 5,
                editor: {
                    type: EditorType.custom,
                    editor: ExternalExitValueEditor,
                    options: {
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                }
            },
            {
                property: 'exits',
                editor: {
                    type: EditorType.flag,
                    options: {
                        enum: RoomExit,
                        exclude: ['Unknown'],
                        container: document.body
                    }
                },
                sort: 3
            },
            {
                property: 'climbs',
                formatter: this.formatExits,
                readonly: true,
                sort: 4
            },
            {
                property: 'state',
                editor: {
                    type: EditorType.flag,
                    options: {
                        enum: RoomStates,
                        container: document.body
                    }
                },
                sort: 2
            },
            {
                property: 'items',
                group: 'Description',
                formatter: this.formatItems,
                editor: {
                    type: EditorType.custom,
                    editor: ItemsValueEditor,
                    options: {
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
                property: 'light',
                group: 'Description',
                sort: 4,
                editor: {
                    options: {
                        min: -15,
                        max: 15
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
                formatter: this.formatObjects,
                editor: {
                    type: EditorType.custom,
                    editor: ItemsValueEditor,
                    options: {
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
                formatter: this.formatMonsters,
                editor: {
                    type: EditorType.custom,
                    editor: ItemsValueEditor,
                    options: {
                        enterMoveFirst: this.$enterMoveFirst,
                        enterMoveNext: this.$enterMoveNext,
                        enterMoveNew: this.$enterMoveNew
                    }
                },
                sort: 2
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
    }

    private formatItems(prop, value) {
        if (!value || value.length === 0) return '';
        return value.map(i => i.item).join(':');
    }

    private formatMonsters(prop, value) {
        if (!value || value.length === 0) return '';
        return value.filter(v => v >= 0 && v < this.$area.monsters.length).map(v => capitalize(this.$area.monsters[v].name)).join(' ,');
    }

    private formatObjects(prop, value) {
        if (!value || value.length === 0) return '';
        return value.filter(v => v >= 0 && v < this.$area.objects.length).map(v => capitalize(this.$area.objects[v].name)).join(' ,');
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

    private formatExternal(prop, value, data) {
        if (!data) return 'None';
        let ee;
        if (Array.isArray(data))
            ee = data[0].ee;
        else
            ee = data.ee;
        if (ee === 0)
            return 'None';
        const states = Object.keys(RoomExit).filter(key => !isNaN(Number(RoomExit[key])));
        const f = [];
        let state = states.length;
        while (state--) {
            if (states[state] === 'None') continue;
            if ((ee & RoomExit[states[state]]) === RoomExit[states[state]])
                f.push(capitalize(states[state]));
        }
        return f.join(', ');
    }
    public refresh() {
        switch (this.$view) {
            case View.map:
                this.doUpdate(UpdateType.drawMap);
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

    public revert(file?) {
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

    private getRawSelected(raw) {
        if (!raw) return '';
        return raw.value.substring(raw.selectionStart, raw.selectionEnd);
    }

    private deleteRawSelected(raw, noChanged?, noDirty?) {
        if (!raw) return;
        const start = raw.selectionStart;
        const end = raw.selectionEnd;
        //nothing selected
        if (start === end) return;
        raw.value = raw.value.substring(0, start) + raw.value.substring(end);
        raw.selectionStart = start;
        raw.selectionEnd = start;
        if (!noChanged) {
            this.changed = true;
            raw.dataset.dirty = !noDirty ? 'true' : null;
            raw.dataset.changed = 'true';
        }
    }

    private deleteRoom(room) {
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
                p.exits &= ~RoomExit.South;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
        }
        if (room.y > 0 && room.x > 0 && (o & RoomExit.NorthWest) === RoomExit.NorthWest) {
            nx = room.x - 1;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits &= ~RoomExit.SouthEast;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
        }
        if (room.y > 0 && room.x < this.$area.size.width - 1 && (o & RoomExit.NorthEast) === RoomExit.NorthEast) {
            nx = room.x + 1;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits &= ~RoomExit.SouthWest;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
        }
        if (room.x < this.$area.size.width - 1 && (o & RoomExit.East) === RoomExit.East) {
            nx = room.x + 1;
            ny = room.y;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits &= ~RoomExit.West;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
        }
        if (room.x > 0 && (o & RoomExit.West) === RoomExit.West) {
            nx = room.x - 1;
            ny = room.y;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits &= ~RoomExit.East;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
        }
        if (room.y < this.$area.size.height - 1 && (o & RoomExit.South) === RoomExit.South) {
            nx = room.x;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits &= ~RoomExit.North;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
        }
        if (room.y < this.$area.size.height - 1 && room.x < this.$area.size.width - 1 && (o & RoomExit.SouthEast) === RoomExit.SouthEast) {
            nx = room.x + 1;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits &= ~RoomExit.NorthWest;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
        }
        if (room.x > 0 && room.y < this.$area.size.height - 1 && (o & RoomExit.SouthWest) === RoomExit.SouthWest) {
            nx = room.x - 1;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits &= ~RoomExit.NorthEast;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
        }
        if (this.$depth + 1 < this.$area.size.depth && (o & RoomExit.Up) === RoomExit.Up) {
            p = this.getRoom(room.x, room.y, this.$depth + 1);
            if (p) {
                po = p.clone();
                p.exits &= ~RoomExit.Down;
                this.RoomChanged(p, po);
            }
        }
        if (this.$depth - 1 >= 0 && (o & RoomExit.Down) === RoomExit.Down) {
            p = this.getRoom(room.x, room.y, this.$depth - 1);
            if (p) {
                po = p.clone();
                p.exits &= ~RoomExit.Up;
                this.RoomChanged(p, po);
            }
        }
    }

    private addRoom(room) {
        this.setRoom(room);
        const o = room.exits;
        let nx;
        let ny;
        let p;
        let po;
        if (room.y === 0) {
            room.exits &= ~RoomExit.North;
            room.exits &= ~RoomExit.NorthEast;
            room.exits &= ~RoomExit.NorthWest;
        }
        if (room.y === this.$area.size.height - 1) {
            room.exits &= ~RoomExit.South;
            room.exits &= ~RoomExit.SouthEast;
            room.exits &= ~RoomExit.SouthWest;
        }

        if (room.x === 0) {
            room.exits &= ~RoomExit.West;
            room.exits &= ~RoomExit.NorthWest;
            room.exits &= ~RoomExit.SouthWest;
        }
        if (room.x === this.$area.size.width - 1) {
            room.exits &= ~RoomExit.East;
            room.exits &= ~RoomExit.NorthEast;
            room.exits &= ~RoomExit.SouthEast;
        }

        if (room.y > 0 && (o & RoomExit.North) === RoomExit.North) {
            nx = room.x;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.South;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
            else
                room.exits &= ~RoomExit.North;
        }
        if (room.y > 0 && room.x > 0 && (o & RoomExit.NorthWest) === RoomExit.NorthWest) {
            nx = room.x - 1;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.SouthEast;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            } else
                room.exits &= ~RoomExit.NorthWest;
        }
        if (room.y > 0 && room.x < this.$area.size.width - 1 && (o & RoomExit.NorthEast) === RoomExit.NorthEast) {
            nx = room.x + 1;
            ny = room.y - 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.SouthWest;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            } else
                room.exits &= ~RoomExit.NorthEast;
        }
        if (room.x < this.$area.size.width - 1 && (o & RoomExit.East) === RoomExit.East) {
            nx = room.x + 1;
            ny = room.y;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.West;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            } else
                room.exits &= ~RoomExit.East;
        }
        if (room.x > 0 && (o & RoomExit.West) === RoomExit.West) {
            nx = room.x - 1;
            ny = room.y;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.East;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            } else
                room.exits &= ~RoomExit.West;
        }
        if (room.y < this.$area.size.height - 1 && (o & RoomExit.South) === RoomExit.South) {
            nx = room.x;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.North;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            } else
                room.exits &= ~RoomExit.South;
        }
        if (room.y < this.$area.size.height - 1 && room.x < this.$area.size.width - 1 && (o & RoomExit.SouthEast) === RoomExit.SouthEast) {
            nx = room.x + 1;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.NorthWest;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
            else
                room.exits &= ~RoomExit.SouthEast;
        }
        if (room.x > 0 && room.y < this.$area.size.height - 1 && (o & RoomExit.SouthWest) === RoomExit.SouthWest) {
            nx = room.x - 1;
            ny = room.y + 1;
            p = this.getRoom(nx, ny);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.NorthEast;
                this.DrawRoom(this.$mapContext, p, true, false);
                this.RoomChanged(p, po);
            }
            else
                room.exits &= ~RoomExit.SouthWest;
        }
        if (this.$depth + 1 < this.$area.size.depth && (o & RoomExit.Up) === RoomExit.Up) {
            p = this.getRoom(room.x, room.y, this.$depth + 1);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.Down;
                this.RoomChanged(p, po);
            }
            else
                room.exits &= ~RoomExit.Up;
        }
        if (this.$depth - 1 >= 0 && (o & RoomExit.Down) === RoomExit.Down) {
            p = this.getRoom(room.x, room.y, this.$depth - 1);
            if (p) {
                po = p.clone();
                p.exits |= RoomExit.Up;
                this.RoomChanged(p, po);
            }
            else
                room.exits &= ~RoomExit.Down;
        }
    }

    public get selected(): any {
        switch (this.$view) {
            case View.map:
                return '';
            case View.monsters:
                return null;
            case View.objects:
                return null;
        }
        return '';
    }

    public selectAll() {
        switch (this.$view) {
            case View.map:
                this.setSelection(0, 0, this.$area.size.width, this.$area.size.height);
                break;
            case View.monsters:
                break;
            case View.objects:
                break;
        }
    }

    public cut() {
        switch (this.$view) {
            case View.map:
                if (this.$selectedRooms.length === 0) return;
                const rooms = this.$selectedRooms.map(r => {
                    const n = r.clone();
                    return n;
                });
                if (rooms.length === 0) return;
                clipboard.writeBuffer('jiMUD/Area', Buffer.from(JSON.stringify({
                    rooms: rooms
                })));
                let sl = this.$selectedRooms.length;
                while (sl--) {
                    const or = this.$selectedRooms[sl];
                    //has external rooms so remove them as they are now tied to the room
                    this.$selectedRooms[sl] = new Room(or.x, or.y, or.z);
                    if (this.$focusedRoom.at(or.x, or.y, or.z))
                        this.$focusedRoom = this.$selectedRooms[sl];
                    this.setRoom(this.$selectedRooms[sl]);
                    this.RoomChanged(this.$selectedRooms[sl], or);
                    this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, this.$selectedRooms[sl].at(this.$mouse.rx, this.$mouse.ry));
                    this.deleteRoom(or);
                }
                this.emit('supports-changed');
                break;
            case View.monsters:
                break;
            case View.objects:
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
                if (rooms.length === 0) return;
                clipboard.writeBuffer('jiMUD/Area', Buffer.from(JSON.stringify({
                    rooms: rooms
                })));
                this.emit('supports-changed');
                break;
            case View.monsters:
                break;
            case View.objects:
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
                while (dl--) {
                    const dRoom = data.rooms[dl];
                    const room = new Room(dRoom.x - osX, dRoom.y - osY, dRoom.z);
                    let prop;
                    for (prop in dRoom) {
                        if (prop === 'x' || prop === 'y' || prop === 'z' || !dRoom.hasOwnProperty(prop)) continue;
                        room[prop] = dRoom[prop];
                    }
                    this.deleteRoom(or);
                    this.addRoom(room);
                    this.RoomChanged(room, or);
                    rooms.unshift(room);
                }
                if (this.$focusedRoom)
                    this.setFocusedRoom(this.$focusedRoom.x, this.$focusedRoom.y, this.$focusedRoom.z);
                this.setSelectedRooms(rooms);
                break;
            case View.monsters:
                break;
            case View.objects:
                break;
        }
    }
    public delete() {
        switch (this.$view) {
            case View.map:
                if (this.$selectedRooms.length === 0) return;
                const rooms = this.$selectedRooms.map(r => {
                    const n = r.clone();
                    return n;
                });
                if (rooms.length === 0) return;
                let sl = this.$selectedRooms.length;
                while (sl--) {
                    const or = this.$selectedRooms[sl];
                    this.$selectedRooms[sl] = new Room(or.x, or.y, or.z);
                    if (this.$focusedRoom.at(or.x, or.y, or.z))
                        this.$focusedRoom = this.$selectedRooms[sl];
                    this.setRoom(this.$selectedRooms[sl]);
                    this.RoomChanged(this.$selectedRooms[sl], or);
                    this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, this.$selectedRooms[sl].at(this.$mouse.rx, this.$mouse.ry));
                    this.deleteRoom(or);
                }
                this.emit('supports-changed');
                break;
            case View.monsters:
                break;
            case View.objects:
                break;
        }
    }
    public undo() {
        switch (this.$view) {
            case View.map:
            case View.monsters:
            case View.objects:
                break;
        }
    }
    public redo() {
        switch (this.$view) {
            case View.map:
            case View.monsters:
            case View.objects:
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
                return this.$view === View.map || this.$view === View.monsters || this.$view === View.objects;
            case 'buttons':
            case 'menu|view':
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
            case 'redo':
                return false;
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
        group.appendChild(this.createButton('room editor', 'columns', () => {
            this.$splitterEditor.panel2Collapsed = !this.$splitterEditor.panel2Collapsed;
        }, !this.$splitterEditor.panel2Collapsed, this.$view !== View.map));
        group.appendChild(this.createButton('room preview', 'columns fa-rotate-90', () => {
            this.$splitterPreview.panel2Collapsed = !this.$splitterPreview.panel2Collapsed;
        }, !this.$splitterPreview.panel2Collapsed, this.$view !== View.map));
        frag.appendChild(group);
        group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');
        group.appendChild(this.createButton('map', 'map-o', () => {
            this.switchView(View.map);
        }, this.$view === View.map));
        group.appendChild(this.createButton('monsters', 'user', () => {
            this.switchView(View.monsters);
        }, this.$view === View.monsters));
        group.appendChild(this.createButton('items', 'list', () => {
            this.switchView(View.objects);
        }, this.$view === View.objects));
        frag.appendChild(group);

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

    private createButton(id, icon, fun, active, disabled?) {
        const el = document.createElement('button');
        el.id = 'btn-' + id.replace(/\s+/g, '-');
        el.type = 'button';
        el.classList.add('btn', 'btn-default', 'btn-xs');
        if (active)
            el.classList.add('active');
        if (disabled)
            el.setAttribute('disabled', 'true');
        el.title = 'Show ' + id;
        el.onclick = fun;
        el.innerHTML = '<i class="fa fa-' + icon + '"></i>';
        return el;
    }

    private setButtonState(id, state) {
        const button = document.getElementById('btn-' + id.replace(/\s+/g, '-'));
        if (!button) return;
        if (state)
            button.classList.add('active');
        else
            button.classList.remove('active');
    }

    private setButtonDisabled(id, state) {
        const button = document.getElementById('btn-' + id.replace(/\s+/g, '-'));
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
                    label: 'Monsters',
                    type: 'checkbox',
                    checked: this.$view === View.monsters,
                    click: () => {
                        this.switchView(View.monsters);
                    }
                },
                {
                    label: 'Items',
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
            this.$roomEditor.setPropertyOptions([
                {
                    property: 'external',
                    label: 'External exits',
                    formatter: this.formatExternal,
                    sort: 5,
                    editor: {
                        type: EditorType.custom,
                        editor: ExternalExitValueEditor,
                        options: {
                            enterMoveFirst: this.$enterMoveFirst,
                            enterMoveNext: this.$enterMoveNext,
                            enterMoveNew: this.$enterMoveNew
                        }
                    }
                },
                {
                    property: 'items',
                    group: 'Description',
                    formatter: this.formatItems,
                    editor: {
                        type: EditorType.custom,
                        editor: ItemsValueEditor,
                        options: {
                            enterMoveFirst: this.$enterMoveFirst,
                            enterMoveNext: this.$enterMoveNext,
                            enterMoveNew: this.$enterMoveNew
                        }
                    },
                    sort: 2
                },
                {
                    property: 'objects',
                    group: 'Description',
                    formatter: this.formatObjects,
                    editor: {
                        type: EditorType.custom,
                        editor: ItemsValueEditor,
                        options: {
                            enterMoveFirst: this.$enterMoveFirst,
                            enterMoveNext: this.$enterMoveNext,
                            enterMoveNew: this.$enterMoveNew
                        }
                    },
                    sort: 2
                }
                ,
                {
                    property: 'monsters',
                    group: 'Description',
                    formatter: this.formatMonsters,
                    editor: {
                        type: EditorType.custom,
                        editor: ItemsValueEditor,
                        options: {
                            enterMoveFirst: this.$enterMoveFirst,
                            enterMoveNext: this.$enterMoveNext,
                            enterMoveNew: this.$enterMoveNew
                        }
                    },
                    sort: 2
                }
            ]);
        }

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
            live: this.$splitterEditor.live,
            showRoomEditor: !this.$splitterEditor.panel2Collapsed,
            showRoomPreview: !this.$splitterPreview.panel2Collapsed
        };
    }
    public get type() {
        return 2;
    }
    public insert(text) { /**/ }
    public get location() { return [-1, -1]; }
    public get length() { return 0; }

    public activate() { /**/ }
    public deactivate() { /**/ }

    public switchView(view: View, force?) {
        if (!force && this.$view === view) return;
        //let bGroup;
        //let button;
        this.$label.style.display = '';
        switch (this.$view) {
            case View.map:
                this.$splitterEditor.hide();
                break;
            case View.monsters:
                break;
            case View.objects:
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
            case View.monsters:
                /*
                this.$label.textContent = 'Monsters';
                bGroup = document.createElement('div');
                bGroup.classList.add('btn-group');

                button = document.createElement('button');
                button.type = 'button';
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    //this.$descriptionGrid.addNewRow();
                });
                button.title = 'Add terrain';
                button.innerHTML = '<i class="fa fa-plus"></i> Add';
                bGroup.appendChild(button);

                button = document.createElement('button');
                //TODO remove when insert works
                button.style.display = 'none';
                button.type = 'button';
                button.disabled = this.$monsterGrid.selectedCount === 0;
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {

                });
                button.title = 'Insert terrain';
                button.innerHTML = '<i class="fa fa-arrows-v"></i> Insert';
                bGroup.appendChild(button);

                button = document.createElement('button');
                button.type = 'button';
                button.disabled = this.$monsterGrid.selectedCount === 0;
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$monsterGrid.focus();
                    this.$monsterGrid.beginEdit(this.$monsterGrid.selected[0].row);
                });
                button.title = 'Edit terrain';
                button.innerHTML = '<i class="fa fa-edit"></i> Edit';
                bGroup.appendChild(button);

                button = document.createElement('button');
                button.disabled = this.$monsterGrid.selectedCount === 0;
                button.type = 'button';
                button.title = 'Delete terrain(s)';
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

                button = document.createElement('button');
                button.disabled = this.$monsterGrid.selectedCount === 0;
                button.type = 'button';
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {

                });
                button.title = 'Move up';
                button.innerHTML = '<i class="fa fa-long-arrow-up"></i> Move up';
                bGroup.appendChild(button);

                button = document.createElement('button');
                button.disabled = this.$monsterGrid.selectedCount === 0;
                button.type = 'button';
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {

                });
                button.title = 'Move down';
                button.innerHTML = '<i class="fa fa-long-arrow-down"></i> Move down';
                bGroup.appendChild(button);

                this.$label.appendChild(bGroup);

                this.$monsterGrid.parent.style.display = '';
                this.$monsterGrid.focus();
                */
                break;
            case View.objects:
                /*
                    this.$label.textContent = 'Items';
                    bGroup = document.createElement('div');
                    bGroup.classList.add('btn-group');

                    button = document.createElement('button');
                    button.type = 'button';
                    button.classList.add('btn', 'btn-default', 'btn-xs');
                    button.addEventListener('click', () => {
                        const idx = this.$items.length;
                        this.$itemGrid.addRow({
                            idx: idx,
                            items: '',
                            description: '',
                            tag: idx + 1
                        });
                        this.updateRaw(this.$itemRaw, idx * 2, ['', ''], false, true);
                        resetCursor(this.$itemRaw);
                        this.$itemGrid.focus();
                        this.$itemGrid.selectByDataIndex(idx, true);
                    });
                    button.title = 'Add item group';
                    button.innerHTML = '<i class="fa fa-plus-square-o"></i> Add group';
                    bGroup.appendChild(button);
                    const sc = this.$itemGrid.selected;

                    button = document.createElement('button');
                    //TODO remove when insert works
                    button.style.display = 'none';
                    button.type = 'button';
                    button.disabled = this.$itemGrid.selectedCount === 0;
                    button.classList.add('btn', 'btn-default', 'btn-xs');
                    button.addEventListener('click', () => {

                    });
                    button.title = 'Insert group';
                    button.innerHTML = '<i class="fa fa-arrows-v"></i> Insert group';
                    bGroup.appendChild(button);

                    button = document.createElement('button');
                    button.type = 'button';
                    button.disabled = this.$itemGrid.selectedCount === 0;
                    button.classList.add('btn', 'btn-default', 'btn-xs');
                    button.addEventListener('click', () => {
                        const selected = this.$itemGrid.selected.sort((a, b) => { if (a.row > b.row) return 1; if (a.row < b.row) return -1; return 0; });
                        if (selected.length === 0) return;
                        let parent;
                        if (selected[0].parent === -1)
                            parent = selected[0].data;
                        else
                            parent = this.$items[selected[0].dataIndex];
                        if (!parent.children)
                            parent.children = [];
                        parent.children.push({
                            idx: '',
                            item: '',
                            description: '',
                            tag: (parent.idx + 1) + '-' + parent.children.length,
                            parentId: parent.idx
                        });
                        this.$itemGrid.refresh();
                        this.$itemGrid.expandRows(selected[0].index).then(() => {
                            this.$itemGrid.focus();
                            this.$itemGrid.beginEditChild(selected[0].dataIndex, parent.children.length - 1);
                            this.updateRaw(this.$itemRaw, parent.idx * 2, [
                                parent.children.map(i => i.item).join(':'),
                                parent.children.map(i => i.description).join(':')
                            ], false, true);
                        });
                    });
                    button.title = 'Add item';
                    button.innerHTML = '<i class="fa fa-plus"></i> Add';
                    bGroup.appendChild(button);

                    button = document.createElement('button');
                    button.type = 'button';
                    button.disabled = sc.filter(r => r.parent !== -1).length === 0;
                    button.classList.add('btn', 'btn-default', 'btn-xs');
                    button.addEventListener('click', () => {
                        const sl = this.$itemGrid.selectedCount;
                        const selected = this.$itemGrid.selected;
                        for (let s = 0; s < sl; s++) {
                            if (selected[s].parent !== -1) {
                                this.$itemGrid.focus();
                                this.$itemGrid.beginEditChild(selected[s].parent, selected[s].child);
                                break;
                            }
                        }
                    });
                    button.title = 'Edit item';
                    button.innerHTML = '<i class="fa fa-edit"></i> Edit';
                    bGroup.appendChild(button);

                    button = document.createElement('button');
                    button.disabled = this.$itemGrid.selectedCount === 0;
                    button.type = 'button';
                    button.title = 'Delete item(s)';
                    button.classList.add('btn', 'btn-danger', 'btn-xs');
                    button.addEventListener('click', () => {
                        this.$itemGrid.delete();
                    });
                    button.innerHTML = '<i class="fa fa-trash"></i> Delete';
                    bGroup.appendChild(button);
                    this.$label.appendChild(bGroup);

                    bGroup = document.createElement('div');
                    bGroup.classList.add('btn-group');
                    bGroup.style.display = 'none';

                    button = document.createElement('button');
                    button.disabled = this.$descriptionGrid.selectedCount === 0;
                    button.type = 'button';
                    button.classList.add('btn', 'btn-default', 'btn-xs');
                    button.addEventListener('click', () => {

                    });
                    button.title = 'Move up';
                    button.innerHTML = '<i class="fa fa-long-arrow-up"></i> Move up';
                    bGroup.appendChild(button);

                    button = document.createElement('button');
                    button.disabled = this.$descriptionGrid.selectedCount === 0;
                    button.type = 'button';
                    button.classList.add('btn', 'btn-default', 'btn-xs');
                    button.addEventListener('click', () => {

                    });
                    button.title = 'Move down';
                    button.innerHTML = '<i class="fa fa-long-arrow-down"></i> Move down';
                    bGroup.appendChild(button);

                    this.$label.appendChild(bGroup);

                    this.$itemGrid.parent.style.display = '';
                    this.$itemGrid.focus();
                    */
                break;
        }
        this.emit('menu-update', 'view|map', { checked: view === View.map });
        this.emit('menu-update', 'view|monsters', { checked: view === View.monsters });
        this.emit('menu-update', 'view|Items', { checked: view === View.objects });
        this.emit('menu-update', 'view|room editor', { enabled: view === View.map });
        this.emit('menu-update', 'view|room preview', { enabled: view === View.map });
        this.setButtonDisabled('room editor', view !== View.map);
        this.setButtonDisabled('room preview', view !== View.map);
        this.setButtonState('map', view === View.map);
        this.setButtonState('monsters', view === View.monsters);
        this.setButtonState('items', view === View.objects);
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
            this.emit('status-message', `Rooms ${this.$rcount}, Empty rooms ${(this.$area.size.width * this.$area.size.height * this.$area.size.depth) - this.$rcount}, Total rooms ${this.$area.size.width * this.$area.size.height * this.$area.size.depth}`);
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
        //if selected update the selected systm to point to new room object
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

        if (room.ee) {
            ctx.strokeStyle = 'red';
            ctx.beginPath();
            if ((room.ee & RoomExit.East) === RoomExit.East) {
                ctx.moveTo(x + 23.5, y + 15.5);
                ctx.lineTo(x + 31.5, y + 15.5);
            }
            if ((room.ee & RoomExit.North) === RoomExit.North) {
                ctx.moveTo(x + 15.5, y);
                ctx.lineTo(x + 15.5, y + 7.5);
            }
            if ((room.ee & RoomExit.NorthWest) === RoomExit.NorthWest) {
                ctx.moveTo(x, y);
                ctx.lineTo(x + 7.5, y + 7.5);
            }
            if ((room.ee & RoomExit.NorthEast) === RoomExit.NorthEast) {
                ctx.moveTo(x + 31.5, y);
                ctx.lineTo(x + 23.5, y + 7.5);
            }
            if ((room.ee & RoomExit.West) === RoomExit.West) {
                ctx.moveTo(x, y + 15.5);
                ctx.lineTo(x + 7.5, y + 15.5);
            }
            if ((room.ee & RoomExit.South) === RoomExit.South) {
                ctx.moveTo(x + 15.5, y + 23.5);
                ctx.lineTo(x + 15.5, y + 31.5);
            }
            if ((room.ee & RoomExit.SouthEast) === RoomExit.SouthEast) {
                ctx.moveTo(x + 31.5, y + 31.5);
                ctx.lineTo(x + 23.5, y + 23.5);
            }
            if ((room.ee & RoomExit.NorthWest) === RoomExit.NorthWest) {
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
        if (exs === RoomExit.None && ex !== RoomExit.None && room.ee !== RoomExit.None) {
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
                if ((room.ee & RoomExit.Up) === RoomExit.Up)
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
                if ((room.ee & RoomExit.Down) === RoomExit.Down)
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
                if ((room.ee & RoomExit.Out) === RoomExit.Out)
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
                if ((room.ee & RoomExit.Enter) === RoomExit.Enter)
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
        const nspan = (max - min) / cl;
        let curr = min;
        let start;
        let end;
        let c;

        for (c = 0; c < cl; c++) {
            if (val >= curr && val < curr + nspan)
                break;
            curr += nspan;
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
        const vp = (val - curr) / nspan;
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

    private loadRoom(r) {
        if (!r.ef) return;
        let f;
        if (this.$area.size.depth > 1)
            f = r.x + ',' + r.y + ',' + r.z + '.c';
        else
            f = r.x + ',' + r.y + '.c';
        this.setRoom(this.parseRoomCode(r, this.read(path.join(path.dirname(this.file), f))));
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
        r.ee = 0;
        r.state = 0;
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
            if (room.state === old.state && room.exits === old.exits && room.terrain === old.terrain && room.item === old.item)
                return;
            if (old.exits) this.$rcount--;
            if (room.exits) this.$rcount++;
            this.updateStatus();
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
        this.$rcount = 0;

        for (let z = 0; z < zl; z++) {
            for (let y = 0; y < yl; y++) {
                for (let x = 0; x < xl; x++) {
                    const room = this.$area.rooms[z][y][x];
                    if (room.exits) this.$rcount++;
                }
            }
        }
        this.changed = true;
        this.updateStatus();
    }

    private UpdateEditor(rooms) {
        if (this.selectedFocusedRoom)
            this.$depthToolbar.value = '' + this.selectedFocusedRoom.z;
        const objs = [];
        if (rooms) {
            let rl = rooms.length;
            const ri = [];
            const re = [];
            while (rl--) {
                const o = rooms[rl].clone();
                if (!o.items || o.items.length === 0)
                    o.items = ri;
                if (o.external.length === 0)
                    o.external = re;
                objs.unshift(o);
            }
        }
        this.$roomEditor.objects = objs;
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
        }
        else {
            this.$roomPreview.short.textContent = room.short;
            this.$roomPreview.long.textContent = room.long;
            str = this.$roomPreview.long.innerHTML;

            items = room.items;
            if (items.length > 0) {
                items = items[room.item].children.slice().sort((a, b) => { return b.item.length - a.item.length; });
                for (c = 0, cl = items.length; c < cl; c++)
                    str = str.replace(new RegExp('\\b(' + items[c].item + ')\\b'), '<span class="room-item" id="' + this.parent.id + '-room-preview' + c + '" title="">' + items[c].item + '</span>');
            }
            else
                items = null;
            str += '<br><br>';
            this.$roomPreview.long.innerHTML = str;
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
            e = room.exits | room.ee;
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
        }
    }

    private BuildMap() {
        Timer.start();
        const zl = this.$area.size.depth;
        const xl = this.$area.size.width;
        const yl = this.$area.size.height;
        this.$rcount = 0;
        for (let z = 0; z < zl; z++) {
            for (let y = 0; y < yl; y++) {
                for (let x = 0; x < xl; x++) {
                    const room = this.$area.rooms[z][y][x];
                    if (room.exits) this.$rcount++;
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
        this.emit('rebuild-buttons');
        Timer.end('BuildMap time');
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

    public openExternalExits() {
        this.$roomEditor.beginEdit('external', true);
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
        if ((r.state & RoomStates.NoAttack) === RoomStates.NoAttack)
            t.push('"no attack" : 1');
        if ((r.state & RoomStates.NoMagic) === RoomStates.NoMagic)
            t.push('"no magic" : 1');
        if ((r.state & RoomStates.Council) === RoomStates.Council)
            t.push('"council" : 1');
        if ((r.state & RoomStates.Indoors) === RoomStates.Indoors)
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
        else if ((r.state & RoomStates.Water) === RoomStates.Water)
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
        if ((r.state & RoomStates.Cold) === RoomStates.Cold)
            d += '   set_temperature(-200);\n';
        else if ((r.state & RoomStates.Hot) === RoomStates.Hot)
            d += '   set_temperature(200);\n';
        if ((r.state & RoomStates.SinkingUp) === RoomStates.SinkingUp || (r.state & RoomStates.SinkingDown) === RoomStates.SinkingDown)
            d += '   set_living_sink(1);\n';
        if ((r.state & RoomStates.SinkingUp) === RoomStates.SinkingUp && r.z + 1 < this.$area.size.depth)
            d += `   set_up(VIR+"${r.x},${r.y},${r.z + 1}");\n`;
        if ((r.state & RoomStates.SinkingDown) === RoomStates.SinkingDown && r.z > 0 && this.$area.size.depth > 1)
            d += `   set_down(VIR+"${r.x},${r.y},${r.z - 1}");\n`;
        d += '}';
        return d;
    }
}
