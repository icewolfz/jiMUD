import { DebugTimer, EditorBase, EditorOptions, FileState } from './editor.base';
import { Splitter, Orientation } from './../splitter';
import { PropertyGrid, EditorType, ValueEditor } from './../propertygrid';
import { existsSync, capitalize, wordwrap, splitQuoted, leadingZeros, Cardinal, resetCursor, enumToString } from './../library';
const { clipboard, ipcRenderer, remote } = require('electron');
const { Menu, MenuItem, dialog } = remote;
const fs = require('fs-extra');
const path = require('path');

interface VirtualEditorOptions extends EditorOptions {
    value?: string;
    terrainValue?: string;
    stateValue?: string;
    descriptionValue: string;
    itemValue: string;
    exitsValue: string;
}

import RGBColor = require('rgbcolor');

declare global {
    interface Window {
        $roomImg: HTMLImageElement;
        $roomImgLoaded: boolean;
    }
}

export enum UpdateType { none = 0, drawMap = 1, buildRooms = 2, buildMap = 4 }

enum RoomExit {
    Out = 4096,
    Enter = 2048,
    Unknown = 1024,
    Up = 512,
    Down = 256,
    North = 128,
    NorthEast = 64,
    East = 32,
    SouthEast = 16,
    South = 8,
    SouthWest = 4,
    West = 2,
    NorthWest = 1,
    None = 0
}

enum RoomStates {
    NoAttack = 512,
    NoMagic = 256,
    Council = 128,
    Otdoors = 64,
    Indoors = 32,
    Water = 16,
    Hot = 8,
    Cold = 4,
    SinkingUp = 2,
    SinkingDown = 1,
    None = 0
}

var RoomExits = {
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
}

export class Room {
    public exits = 0;
    public x = 0;
    public y = 0;
    public z = 0;
    public terrain = 0
    public item = 0;
    public ee = 0;
    public state = 0;
    public ef = false;
    public climbs = 0;

    constructor(x, y, z, e, t, i, s?) {
        e = +e;
        t = +t;
        i = +i;
        s = +s;
        this.exits = e !== e ? 0 : e;
        this.x = x;
        this.y = y;
        this.z = z;
        this.terrain = t !== t ? 0 : t;
        this.item = i !== i ? 0 : i;
        this.ee = 0;
        this.state = s !== s ? 0 : s;
        this.ef = false;
        this.climbs = 0;
    }

    public clone() {
        var r = new Room(this.x, this.y, this.x, this.exits, this.terrain, this.item, this.state);
        r.climbs = this.climbs;
        r.ef = this.ef;
        r.ee = this.ee;
        return r;
    }

    public equals(room) {
        if (!room) return false;
        if (this.exits !== room.exits)
            return false;
        if (this.x !== room.x)
            return false;
        if (this.y !== room.y)
            return false;
        if (this.z !== room.z)
            return false;
        if (this.terrain !== room.terrain)
            return false;
        if (this.item !== room.item)
            return false;
        if (this.ee !== room.ee)
            return false;
        if (this.state !== room.state)
            return false;
        if (this.ef !== room.ef)
            return false;
        if (this.climbs !== room.climbs)
            return false;
        return true;
    }

    public at(x, y, z?) {
        if (this.x != x) return false;
        if (this.y != y) return false;
        if (z === undefined)
            return true;
        if (this.z != z) return false;
        return true;
    }
}

enum View {
    map,
    terrains,
    items,
    exits,
    mapRaw,
    terrainsRaw,
    descriptionsRaw,
    itemsRaw,
    stateRaw,
    exitsRaw
}

interface MousePosition {
    x: number;
    y: number;
    rx: number;
    ry: number;
    button: number;
}

var Timer = new DebugTimer();

export class VirtualEditor extends EditorBase {
    private $files = {};
    private $saving = {};
    private $view: View = View.map;

    private $label: HTMLElement;
    private $mapRaw: HTMLTextAreaElement;
    private $terrainRaw: HTMLTextAreaElement;
    private $stateRaw: HTMLTextAreaElement;
    private $descriptionRaw: HTMLTextAreaElement;
    private $itemRaw: HTMLTextAreaElement;
    private $externalRaw: HTMLTextAreaElement;
    private $splitterPreview: Splitter;
    private $splitterEditor: Splitter;

    private $startValues: any = {};

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

    private $mapSize;

    private $rooms: Room[][][];
    private $maxTerrain;
    private $mouseCaptured = false;
    private $mousePrevious: MousePosition = {
        x: 0,
        y: 0,
        rx: 0,
        ry: 0,
        button: 0
    }
    private $mouse: MousePosition = {
        x: 0,
        y: 0,
        rx: 0,
        ry: 0,
        button: 0
    }
    private $mouseDown: MousePosition = {
        x: 0,
        y: 0,
        rx: 0,
        ry: 0,
        button: 0
    }
    private $mapDown = false;
    private $colorCache;
    private $measure;

    private $depth;
    private $rcount;
    private $depthToolbar: HTMLInputElement;

    private $selectedRoom: Room;
    private $showTerrain: boolean = false;
    private $showColors: boolean = false;

    private $items;
    private $descriptions;
    private $exits;
    private $roomPreview;
    private $roomEditor;

    public get ShowTerrain(): boolean {
        return this.$showTerrain;
    }

    public set ShowTerrain(value) {
        if (value == this.$showTerrain) return;
        this.$showTerrain = value;
        this.emit('menu-update', 'view|show terrain', { checked: value });
        if (document.getElementById('btn-terrain')) {
            if (value)
                document.getElementById('btn-terrain').classList.add('active');
            else
                document.getElementById('btn-terrain').classList.remove('active');
        }
        this.doUpdate(UpdateType.drawMap);
        this.emit('option-changed', 'showTerrain', value);
    }

    public get ShowColors(): boolean {
        return this.$showColors;
    }

    public set ShowColors(value) {
        if (value == this.$showColors) return;
        this.$showColors = value;
        this.emit('menu-update', 'view|show colors', { checked: value });
        if (document.getElementById('btn-colors')) {
            if (value)
                document.getElementById('btn-colors').classList.add('active');
            else
                document.getElementById('btn-colors').classList.remove('active');
        }
        this.doUpdate(UpdateType.drawMap);
        this.emit('option-changed', 'showColors', value);
    }

    public get SelectedRoom(): Room {
        return this.$selectedRoom;
    }

    public get maxLevel() {
        if (!this.$mapSize) return 0;
        return this.$mapSize.depth;
    }

    constructor(options?: VirtualEditorOptions) {
        super(options);
        if (options && options.options)
            this.options = options.options;
        else
            this.options = {
                showColors: false,
                showTerrain: false,
                rawFontSize: 16,
                rawFontFamily: "Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace",
                rawFontWeight: 'normal',
                previewFontSize: 16,
                previewFontFamily: "Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace",
                editorWidth: 200,
                previewHeight: 200,
                live: true,
                showRoomEditor: true,
                showRoomPreview: true,
            };
        if (options && options.new) {
            this.$startValues.map = options.value || '';
            this.$mapRaw.value = this.$startValues.map;
            this.$files = {};
            if (this.options.hasOwnProperty('terrainValue')) {
                this.$startValues['virtual.terrain'] = options.terrainValue || '';
                this.$terrainRaw.value = this.$startValues['virtual.terrain'];
                this.$files['virtual.terrain'] = true;
            }
            if (this.options.hasOwnProperty('startValues')) {
                this.$startValues['virtual.state'] = options.stateValue || '';
                this.$stateRaw.value = this.$startValues['virtual.state'];
                this.$files['virtual.state'] = true;
            }
            if (this.options.hasOwnProperty('descriptionValue')) {
                this.$startValues['terrain.desc'] = options.descriptionValue || '';
                this.$descriptionRaw.value = this.$startValues['terrain.desc'];
                this.$files['terrain.desc'] = true;
            }
            if (this.options.hasOwnProperty('startValues')) {
                this.$startValues['terrain.item'] = options.itemValue || '';
                this.$itemRaw.value = this.$startValues['terrain.item'];
                this.$files['terrain.item'] = true;
            }
            if (this.options.hasOwnProperty('exitsValue')) {
                this.$startValues['virtual.exits'] = options.exitsValue || '';
                this.$externalRaw.value = this.$startValues['virtual.exits'];
                this.$files['virtual.exits'] = true;
            }
            this.resetRawCursors();
            this.doUpdate(UpdateType.buildRooms | UpdateType.buildMap);
            this.loadDescriptions();
            this.loadItems();
            this.loadExits();
            this.clearRawChanged();
            this.changed = false;
        }
    }

    set changed(value: boolean) {
        if (value != super.changed) {
            super.changed = value;
            this.emit('changed', value);
        }
    }

    get changed(): boolean {
        return super.changed;
    }

    private clearRawChanged() {
        this.$terrainRaw.dataset.changed = null;
        this.$stateRaw.dataset.changed = null;
        this.$descriptionRaw.dataset.changed = null;
        this.$itemRaw.dataset.changed = null;
        this.$externalRaw.dataset.changed = null;
        this.$mapRaw.dataset.changed = null;
    }

    public createControl() {
        this.$mapSize = {
            width: 0,
            height: 0,
            depth: 0,
            right: 0,
            bottom: 0
        };
        this.$depth = 0;
        this.$maxTerrain = 0;

        this.$depthToolbar = document.createElement('input');
        this.$depthToolbar.id = this.parent.id + '-level';
        this.$depthToolbar.classList.add('form-control', 'input-xs');
        this.$depthToolbar.type = 'number';
        this.$depthToolbar.style.width = '50px';

        this.$depthToolbar.addEventListener('change', (e) => {
            if (this.$depthToolbar.value === '' + this.$depth)
                return;
            this.$depth = +this.$depthToolbar.value;
            if (this.$selectedRoom)
                this.ChangeSelection(this.getRoom(this.$selectedRoom.x, this.$selectedRoom.y, this.$depth));
            this.doUpdate(UpdateType.drawMap);
        });
        this.$depthToolbar.addEventListener('input', (e) => {
            if (this.$depthToolbar.value === '' + this.$depth)
                return;
            this.$depth = +this.$depthToolbar.value;
            if (this.$selectedRoom)
                this.ChangeSelection(this.getRoom(this.$selectedRoom.x, this.$selectedRoom.y, this.$depth));
            this.doUpdate(UpdateType.drawMap);
        });
        if (!window.$roomImg) {
            window.$roomImg = new Image();
            window.$roomImg.src = './../assets/editor/rooms.png';
            window.$roomImg.addEventListener('load', () => {
                window.$roomImgLoaded = true;
            });
        }
        let frag = document.createDocumentFragment();
        let el: HTMLElement;
        //#region Create raw editors
        this.$label = document.createElement('div');
        this.$label.classList.add('virtual-editor-label');
        frag.appendChild(this.$label);
        this.$mapRaw = this.createRawControl();
        frag.appendChild(this.$mapRaw);
        this.$terrainRaw = this.createRawControl();
        frag.appendChild(this.$terrainRaw);
        this.$stateRaw = this.createRawControl();
        frag.appendChild(this.$stateRaw);
        this.$descriptionRaw = this.createRawControl();
        frag.appendChild(this.$descriptionRaw);
        this.$itemRaw = this.createRawControl();
        frag.appendChild(this.$itemRaw);
        this.$externalRaw = this.createRawControl();
        frag.appendChild(this.$externalRaw);
        this.parent.appendChild(frag);
        //#endregion
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
        })
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
        })
        this.$mapContainer.addEventListener('click', (e) => {
            this.$map.focus();
            e.preventDefault();
            e.cancelBubble = true;
            e.stopPropagation();
        })
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
        this.$map.addEventListener('mousemove', (e: MouseEvent) => {
            this.$mousePrevious = this.$mouse;
            this.$mouse = this.getMousePos(e);
            var r = this.getRoom(this.$mouse.rx, this.$mouse.ry);
            var p = this.getRoom(this.$mousePrevious.rx, this.$mousePrevious.ry);
            if (r != p) {
                if (p) this.DrawRoom(this.$mapContext, p, true, false);
                if (r) this.DrawRoom(this.$mapContext, r, true, true);
            }
            this.emit('location-changed', this.$mouse.rx, this.$mouse.ry);
            e.preventDefault();
            return false;
        });
        this.$map.addEventListener('mousedown', (e) => {
            this.$mouse = this.getMousePos(e);
            this.$mouseDown = this.getMousePos(e);
            this.$mapDown = true;
        });
        this.$map.addEventListener('mouseup', (e) => {
            this.$mouse = this.getMousePos(e);
            if (this.$mouse.button === 0 && this.$mouse.rx === this.$mouseDown.rx && this.$mouse.ry === this.$mouseDown.ry) {
                var r = this.getRoom(this.$mouse.rx, this.$mouse.ry);
                var p = this.$selectedRoom;
                if (r !== this.$selectedRoom)
                    this.ChangeSelection(r);
                if (p && r != p) this.DrawRoom(this.$mapContext, p, true, false);
                if (r) this.DrawRoom(this.$mapContext, r, true, true);
            }

            this.$mapDown = false;
        });
        this.$map.addEventListener('mouseenter', (e) => {
            this.$mouse = this.getMousePos(e);
            this.ClearPrevMouse();
            var p = this.getRoom(this.$mouse.rx, this.$mouse.ry);
            if (p) this.DrawRoom(this.$mapContext, p, true, true);
            this.emit('location-changed', this.$mouse.rx, this.$mouse.ry);
        });
        this.$map.addEventListener('mouseleave', (e) => {
            this.ClearPrevMouse();
            this.$mousePrevious = this.$mouse;
            this.ClearPrevMouse();
            this.$mouse = this.getMousePos(event);
            var p = this.getRoom(this.$mouse.rx, this.$mouse.ry);
            if (p) this.DrawRoom(this.$mapContext, p, true, false);
            this.$mouse.x = -1;
            this.$mouse.y = -1;
            this.$mouse.rx = -1;
            this.$mouse.ry = -1;
            this.emit('location-changed', -1, -1);
        });
        this.$map.addEventListener('contextmenu', (e) => {
            var m = this.getMousePos(e);
            this.emit('map-context-menu', this.getRoom(m.rx, m.ry).clone());
        });
        this.$map.addEventListener('dblclick', (e) => {
            let m = this.getMousePos(e);
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
            var x = 0;
            var y = 0;
            var px = 0;
            var py = 0;
            var l, r, b, t, po;
            var p = this.$selectedRoom;
            var o = 0;
            var or;
            if (this.$selectedRoom)
                or = this.$selectedRoom.clone();
            if (!this.$selectedRoom) {
                x = (32 - this.$mapContainer.scrollLeft) / 32;
                y = (32 - this.$mapContainer.scrollTop) / 32;
            }
            else {
                x = this.$selectedRoom.x;
                y = this.$selectedRoom.y;
                o = this.$selectedRoom.exits;
            }
            switch (e.which) {
                case 38: //up
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (y > 0) {
                        y--;
                        this.ChangeSelection(this.getRoom(x, y));
                        if (this.$selectedRoom)
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        this.DrawRoom(this.$mapContext, p, true, false);
                        var s = 32 + (y - 2) * 32;
                        if (s < this.$mapContainer.scrollTop)
                            this.$mapContainer.scrollTop = 32 + (y - 2) * 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 40: //down
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (y < this.$mapSize.height - 1) {
                        y++;
                        this.ChangeSelection(this.getRoom(x, y));
                        if (this.$selectedRoom)
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        this.DrawRoom(this.$mapContext, p, true, false);
                        t = ((this.$mapContainer.scrollTop) / 32) >> 0;
                        b = t + ((this.$mapContainer.clientHeight / 32) >> 0);
                        if (this.$selectedRoom.y >= b)
                            this.$mapContainer.scrollTop = this.$mapContainer.scrollTop + 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 37: //left
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (x > 0) {
                        x--;
                        this.ChangeSelection(this.getRoom(x, y));
                        if (this.$selectedRoom) this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        this.DrawRoom(this.$mapContext, p, true, false);
                        var s = 32 + (x - 1) * 32;
                        if (s < this.$mapContainer.scrollLeft)
                            this.$mapContainer.scrollLeft = 32 + (x - 1) * 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 39: //right
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (x < this.$mapSize.width - 1) {
                        x++;
                        this.ChangeSelection(this.getRoom(x, y));
                        if (this.$selectedRoom)
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        this.DrawRoom(this.$mapContext, p, true, false);
                        l = (this.$mapContainer.scrollLeft / 32) >> 0;
                        r = l + ((this.$mapContainer.clientWidth / 32) >> 0);
                        if (this.$selectedRoom.x >= r)
                            this.$mapContainer.scrollLeft = this.$mapContainer.scrollLeft + 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 110:
                case 46: //delete
                    if (!this.$selectedRoom)
                        return;
                    var nx = x;
                    var ny = y;
                    if (e.ctrlKey) {
                        if (y > 0) {
                            this.$selectedRoom.exits |= RoomExit.North;
                            if (x > 0)
                                this.$selectedRoom.exits |= RoomExit.NorthWest;
                            if (x < this.$mapSize.width - 1)
                                this.$selectedRoom.exits |= RoomExit.NorthEast;
                        }
                        if (y < this.$mapSize.height - 1) {
                            this.$selectedRoom.exits |= RoomExit.South;
                            if (x > 0)
                                this.$selectedRoom.exits |= RoomExit.SouthWest;
                            if (x < this.$mapSize.width - 1)
                                this.$selectedRoom.exits |= RoomExit.SouthEast;
                        }
                        if (x > 0)
                            this.$selectedRoom.exits |= RoomExit.West;
                        if (x < this.$mapSize.width - 1)
                            this.$selectedRoom.exits |= RoomExit.East;
                    }
                    else
                        this.$selectedRoom.exits = 0;
                    this.RoomChanged(this.$selectedRoom, or);
                    this.DrawRoom(this.$mapContext, this.$selectedRoom, true, this.$selectedRoom.at(this.$mouse.rx, this.$mouse.ry));
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
                    if (y > 0 && x < this.$mapSize.width - 1 && (e.ctrlKey || (o & RoomExit.NorthEast) === RoomExit.NorthEast)) {
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
                    if (x < this.$mapSize.width - 1 && (e.ctrlKey || (o & RoomExit.East) === RoomExit.East)) {
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
                    if (y < this.$mapSize.height - 1 && (e.ctrlKey || (o & RoomExit.South) === RoomExit.South)) {
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
                    if (y < this.$mapSize.height - 1 && x < this.$mapSize.height - 1 && (e.ctrlKey || (o & RoomExit.SouthEast) === RoomExit.SouthEast)) {
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
                    if (x > 0 && y < this.$mapSize.height - 1 && (e.ctrlKey || (o & RoomExit.SouthWest) === RoomExit.SouthWest)) {
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
                    if (this.$depth + 1 < this.$mapSize.depth && (e.ctrlKey || (o & RoomExit.Up) === RoomExit.Up)) {
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
                    event.preventDefault();
                    break;
                case 97: //num1
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (y < this.$mapSize.height - 1 && x > 0) {
                        y++;
                        x--;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.SouthWest;
                        else
                            this.$selectedRoom.exits |= RoomExit.SouthWest;

                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.NorthEast;
                            else
                                this.$selectedRoom.exits |= RoomExit.NorthEast;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);

                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        t = ((this.$mapContainer.scrollTop) / 32) >> 0;
                        b = t + ((this.$mapContainer.clientHeight / 32) >> 0);
                        if (this.$selectedRoom.y >= b)
                            this.$mapContainer.scrollTop = this.$mapContainer.scrollTop + 32;

                        var s = 32 + (x - 1) * 32;
                        if (s < this.$mapContainer.scrollLeft)
                            this.$mapContainer.scrollLeft = 32 + (x - 1) * 32;

                    }
                    this.$map.focus();
                    event.preventDefault();
                    break;
                case 98: //num2
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (y < this.$mapSize.height - 1) {
                        y++;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.South;
                        else
                            this.$selectedRoom.exits |= RoomExit.South;
                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.North;
                            else
                                this.$selectedRoom.exits |= RoomExit.North;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        t = ((this.$mapContainer.scrollTop) / 32) >> 0;
                        b = t + ((this.$mapContainer.clientHeight / 32) >> 0);
                        if (this.$selectedRoom.y >= b)
                            this.$mapContainer.scrollTop = this.$mapContainer.scrollTop + 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 99: //num3
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (y < this.$mapSize.height - 1 && x < this.$mapSize.width - 1) {
                        y++;
                        x++;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.SouthEast;
                        else
                            this.$selectedRoom.exits |= RoomExit.SouthEast;
                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.NorthWest;
                            else
                                this.$selectedRoom.exits |= RoomExit.NorthWest;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        t = ((this.$mapContainer.scrollTop) / 32) >> 0;
                        b = t + ((this.$mapContainer.clientHeight / 32) >> 0);
                        if (this.$selectedRoom.y >= b)
                            this.$mapContainer.scrollTop = this.$mapContainer.scrollTop + 32;
                        l = (this.$mapContainer.scrollLeft / 32) >> 0;
                        r = l + ((this.$mapContainer.clientWidth / 32) >> 0);
                        if (this.$selectedRoom.x >= r)
                            this.$mapContainer.scrollLeft = this.$mapContainer.scrollLeft + 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 100: //num4
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (x > 0) {
                        x--;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.West;
                        else
                            this.$selectedRoom.exits |= RoomExit.West;
                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.East;
                            else
                                this.$selectedRoom.exits |= RoomExit.East;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        var s = 32 + (x - 1) * 32;
                        if (s < this.$mapContainer.scrollLeft)
                            this.$mapContainer.scrollLeft = 32 + (x - 1) * 32;
                        this.$map.focus();
                    }
                    break
                case 101: //num5
                    break;
                case 102: //num6
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (x < this.$mapSize.width - 1) {
                        x++;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.East;
                        else
                            this.$selectedRoom.exits |= RoomExit.East;
                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.West;
                            else
                                this.$selectedRoom.exits |= RoomExit.West;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        l = (this.$mapContainer.scrollLeft / 32) >> 0;
                        r = l + ((this.$mapContainer.clientWidth / 32) >> 0);
                        if (this.$selectedRoom.x >= r)
                            this.$mapContainer.scrollLeft = this.$mapContainer.scrollLeft + 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 103: //num7
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (x > 0 && y > 0) {
                        x--;
                        y--;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.NorthWest;
                        else
                            this.$selectedRoom.exits |= RoomExit.NorthWest;
                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.SouthEast;
                            else
                                this.$selectedRoom.exits |= RoomExit.SouthEast;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        l = (this.$mapContainer.scrollLeft / 32) >> 0;
                        r = l + ((this.$mapContainer.clientWidth / 32) >> 0);
                        if (this.$selectedRoom.x >= r)
                            this.$mapContainer.scrollLeft = this.$mapContainer.scrollLeft + 32;
                        var s = 32 + (x - 1) * 32;
                        if (s < this.$mapContainer.scrollLeft)
                            this.$mapContainer.scrollLeft = 32 + (x - 1) * 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 104: //num8
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (y > 0) {
                        y--;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.North;
                        else
                            this.$selectedRoom.exits |= RoomExit.North;
                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.South;
                            else
                                this.$selectedRoom.exits |= RoomExit.South;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        var s = 32 + (y - 2) * 32;
                        if (s < this.$mapContainer.scrollTop)
                            this.$mapContainer.scrollTop = 32 + (y - 2) * 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 105: //num9
                    if (!this.$selectedRoom)
                        this.ChangeSelection(this.getRoom(0, 0));
                    else if (x < this.$mapSize.width - 1 && y > 0) {
                        x++;
                        y--;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.NorthEast;
                        else
                            this.$selectedRoom.exits |= RoomExit.NorthEast;
                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.SouthWest;
                            else
                                this.$selectedRoom.exits |= RoomExit.SouthWest;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                        }
                        this.DrawRoom(this.$mapContext, p, true, false);
                        l = (this.$mapContainer.scrollLeft / 32) >> 0;
                        r = l + ((this.$mapContainer.clientWidth / 32) >> 0);
                        if (this.$selectedRoom.x >= r)
                            this.$mapContainer.scrollLeft = this.$mapContainer.scrollLeft + 32;
                        l = (this.$mapContainer.scrollLeft / 32) >> 0;
                        r = l + ((this.$mapContainer.clientWidth / 32) >> 0);
                        if (this.$selectedRoom.x >= r)
                            this.$mapContainer.scrollLeft = this.$mapContainer.scrollLeft + 32;
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 107: //+				
                    if (!this.$selectedRoom)
                        return;
                    or = this.$selectedRoom.clone();
                    if (this.$selectedRoom.item === this.$selectedRoom.terrain)
                        this.$selectedRoom.item++;
                    this.$selectedRoom.terrain++;
                    this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                    this.RoomChanged(this.$selectedRoom, or);
                    break;
                case 109: //-					
                    if (!this.$selectedRoom)
                        return;
                    or = this.$selectedRoom.clone();
                    if (this.$selectedRoom.item === this.$selectedRoom.terrain) {
                        this.$selectedRoom.item--;
                        if (this.$selectedRoom.item < 0)
                            this.$selectedRoom.item = 0;
                    }
                    this.$selectedRoom.terrain--;
                    if (this.$selectedRoom.terrain < 0)
                        this.$selectedRoom.terrain = 0;
                    this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
                    this.RoomChanged(this.$selectedRoom, or);
                    break;
                case 111: // / up
                    if (!this.$selectedRoom)
                        return;
                    if (this.$depth + 1 < this.$mapSize.depth) {
                        this.$depth++;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.Up;
                        else
                            this.$selectedRoom.exits |= RoomExit.Up;
                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y, this.$depth));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.Down;
                            else
                                this.$selectedRoom.exits |= RoomExit.Down;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        }
                        this.doUpdate(UpdateType.drawMap);
                        this.$map.focus();
                    }
                    event.preventDefault();
                    break;
                case 106: // * down
                    if (!this.$selectedRoom)
                        return;
                    if (this.$depth - 1 >= 0) {
                        this.$depth--;
                        if (e.ctrlKey)
                            this.$selectedRoom.exits &= ~RoomExit.Down;
                        else
                            this.$selectedRoom.exits |= RoomExit.Down;
                        if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        this.ChangeSelection(this.getRoom(x, y, this.$depth));
                        or = this.$selectedRoom.clone();
                        if (this.$selectedRoom) {
                            o = this.$selectedRoom.exits;
                            if (e.ctrlKey)
                                this.$selectedRoom.exits &= ~RoomExit.Up;
                            else
                                this.$selectedRoom.exits |= RoomExit.Up;
                            if (o !== this.$selectedRoom.exits) this.RoomChanged(this.$selectedRoom, or);
                        }
                        this.doUpdate(UpdateType.drawMap);
                        this.$map.focus();
                    }
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
            if (object && object.ef)
                return prop !== 'ef';
            return false;
        }
        this.$roomEditor.on('value-changed', (prop, newValue, oldValue) => {
            var old = this.$selectedRoom.clone();
            var data;
            switch (prop) {
                case 'items':
                    break;
                case 'terrainType':
                    prop = 'terrain';
                case 'short':
                case 'long':
                case 'light':
                case 'sound':
                case 'smell':
                    //invalide index
                    if (this.$selectedRoom.terrain < 0) return;
                    //get current data and if none set defaults and assign to the index
                    if (!(data = this.$descriptions[this.$selectedRoom.terrain])) {
                        data = {
                            idx: this.$selectedRoom.terrain,
                            short: '',
                            light: 0,
                            terrain: '',
                            long: '',
                            sound: '',
                            smell: ''
                        }
                    }
                    data[prop] = newValue
                    //update the object data
                    this.$descriptions[this.$selectedRoom.terrain] = data;
                    //update the file data
                    this.updateRaw(this.$descriptionRaw, data.idx * 3, [
                        data.short + ":" + data.light + ":" + data.terrain,
                        data.long,
                        (data.smell.length > 0 ? data.smell : "0") + ":" + (data.sound.length > 0 ? data.sound : "0")
                    ]);
                    break;
                case 'terrain':
                    this.$selectedRoom[prop] = newValue;
                    if (this.$roomEditor.object.item === oldValue)
                        this.$selectedRoom.item = newValue;
                    //new high terrain, clear cache and redraw whole map as colors should have shifted
                    if (newValue > this.$maxTerrain) {
                        this.$maxTerrain = newValue;
                        this.$colorCache = null;
                        this.doUpdate(UpdateType.drawMap);
                    }
                    else //else just redraw the current room
                        this.DrawRoom(this.$mapContext, this.$selectedRoom, true, this.$selectedRoom.at(this.$mouse.rx, this.$mouse.ry));
                    this.RoomChanged(this.$selectedRoom, old);
                    break;
                default:
                    this.$selectedRoom[prop] = newValue;
                    this.DrawRoom(this.$mapContext, this.$selectedRoom, true, this.$selectedRoom.at(this.$mouse.rx, this.$mouse.ry));
                    this.RoomChanged(this.$selectedRoom, old);
                    break;
            }
            this.UpdatePreview(this.$selectedRoom);
        });
        this.$roomEditor.propertyOptions([
            {
                property: 'x',
                group: 'Location',
                readonly: true,
            },
            {
                property: 'y',
                group: 'Location',
                readonly: true,
            },
            {
                property: 'z',
                group: 'Location',
                readonly: true,
            },
            {
                property: 'ee',
                label: 'External exits',
                readonly: true,
                formatter: this.formatExits,
                sort: 5
            },
            {
                property: 'ef',
                label: 'External file',
                readonly: true,
                sort: 6
            },
            {
                property: 'terrain',
                label: 'Terrain index',
                editor: {
                    options: {
                        min: 0,
                    }
                },
                sort: 0
            },
            {
                property: 'item',
                label: 'Item index',
                editor: {
                    options: {
                        min: 0,
                    }
                },
                sort: 1
            },
            {
                property: 'exits',
                editor: {
                    type: EditorType.flag,
                    options: {
                        enum: RoomExit,
                        exclude: ['Unknown']
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
                        enum: RoomStates
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
                },
                sort: 2
            },
            {
                property: 'short',
                group: 'Description',
                sort: 0
            },
            {
                property: 'long',
                group: 'Description',
                sort: 1
            },
            {
                property: 'light',
                group: 'Description',
                sort: 4
            },
            {
                property: 'terrainType',
                group: 'Description',
                label: 'Terrain',
                editor: {
                    type: EditorType.custom,
                    editor: TerrainValueEditor
                },
                sort: 3
            },
            {
                property: 'sound',
                group: 'Description',
                sort: 5
            },
            {
                property: 'smell',
                group: 'Description',
                sort: 5
            },
        ]);

        //#endregion
    }

    private formatItems(prop, value) {
        if (!value) return '';
        return value.map(i => i.item).join(':');
    }

    private formatState(prop, value) {
        if (value === 0)
            return 'None';
        var state;
        var states = Object.keys(RoomStates).filter(key => !isNaN(Number(RoomStates[key])));
        var f = [];
        state = states.length;
        while (state--) {
            if (states[state] === 'None') continue;
            if ((value & RoomStates[states[state]]) === RoomStates[states[state]])
                f.push(capitalize(states[state]));
        }
        return f.join(', ');
    }

    private formatExits(prop, value) {
        if (value === 0)
            return 'None';
        var state;
        var states = Object.keys(RoomExit).filter(key => !isNaN(Number(RoomExit[key])));
        var f = [];
        state = states.length;
        while (state--) {
            if (states[state] === 'None') continue;
            if ((value & RoomExit[states[state]]) === RoomExit[states[state]])
                f.push(capitalize(states[state]));
        }
        return f.join(', ');
    }

    private createRawControl() {
        var el = document.createElement('textarea');
        el = document.createElement('textarea');
        el.classList.add('raw');
        el.addEventListener('change', (e) => {
            this.changed = true;
            (<HTMLElement>e.currentTarget).dataset.dirty = 'true';
            (<HTMLElement>e.currentTarget).dataset.changed = 'true';
        });
        el.addEventListener('input', (e) => {
            this.changed = true;
            (<HTMLElement>e.currentTarget).dataset.dirty = 'true';
            (<HTMLElement>e.currentTarget).dataset.changed = 'true';
        });
        el.addEventListener('paste', (e) => {
            this.changed = true;
            (<HTMLElement>e.currentTarget).dataset.dirty = 'true';
            (<HTMLElement>e.currentTarget).dataset.changed = 'true';
        });
        el.addEventListener('cut', (e) => {
            this.changed = true;
            (<HTMLElement>e.currentTarget).dataset.dirty = 'true';
            (<HTMLElement>e.currentTarget).dataset.changed = 'true';
        });
        return el;
    }

    public refresh() {
        switch (this.$view) {
            case View.map:
                this.doUpdate(UpdateType.drawMap);
                break;
            case View.terrains:
                break;
            case View.items:
                break;
            case View.exits:
                break;
        }
    }

    private openRaw(file, raw, noRebuild?) {
        var base = path.basename(file);
        this.$files[base] = existsSync(file);
        if (this.$files[base])
            raw.value = this.read(file);
        else
            raw.value = this.$startValues[base] || '';
        raw.dataset.changed = null;
        this.changed = this.$mapRaw.dataset.changed == 'true' ||
            this.$terrainRaw.dataset.changed === 'true' ||
            this.$terrainRaw.dataset.changed === 'true' ||
            this.$stateRaw.dataset.changed === 'true' ||
            this.$descriptionRaw.dataset.changed === 'true' ||
            this.$itemRaw.dataset.changed === 'true' ||
            this.$externalRaw.dataset.changed === 'true';
        if (!noRebuild)
            this.doUpdate(UpdateType.buildRooms | UpdateType.buildMap);
    }

    public open(file?) {
        if (!this.file || this.file.length === 0 || !existsSync(this.file) || this.new)
            return;
        let root = path.dirname(this.file);
        if (file) {
            switch (path.basename(file)) {
                case 'virtual.terrain':
                    this.openRaw(file, this.$terrainRaw);
                    break;
                case 'terrain.desc':
                    this.openRaw(file, this.$descriptionRaw, false);
                    this.loadDescriptions();
                    break;
                case 'terrain.item':
                    this.openRaw(file, this.$itemRaw, true);
                    this.loadItems();
                    break;
                case 'virtual.exits':
                    this.openRaw(file, this.$externalRaw, true);
                    this.reloadExits();
                    break;
                case 'virtual.state':
                    this.openRaw(file, this.$stateRaw);
                    break;
                default:
                    if (file === this.filename) {
                        this.$mapRaw.value = this.read();
                        this.doUpdate(UpdateType.buildRooms | UpdateType.buildMap);
                        this.$mapRaw.dataset.changed = null;
                        this.changed = this.$terrainRaw.dataset.changed === 'true' ||
                            this.$stateRaw.dataset.changed === 'true' ||
                            this.$descriptionRaw.dataset.changed === 'true' ||
                            this.$itemRaw.dataset.changed === 'true' ||
                            this.$externalRaw.dataset.changed === 'true';
                    }
            }
            return;
        }
        this.emit('watch-stop', [root]);
        this.$files = {};
        this.$files['virtual.terrain'] = existsSync(path.join(root, 'virtual.terrain'));
        this.$files['terrain.desc'] = existsSync(path.join(root, 'terrain.desc'));
        this.$files['terrain.item'] = existsSync(path.join(root, 'terrain.item'));
        this.$files['virtual.exits'] = existsSync(path.join(root, 'virtual.exits'));
        this.$files['virtual.state'] = existsSync(path.join(root, 'virtual.state'));

        this.$mapRaw.value = this.read();
        if (this.$files['virtual.terrain'])
            this.$terrainRaw.value = this.read(path.join(root, 'virtual.terrain'));
        if (this.$files['virtual.state'])
            this.$stateRaw.value = this.read(path.join(root, 'virtual.state'));
        if (this.$files['terrain.desc'])
            this.$descriptionRaw.value = this.read(path.join(root, 'terrain.desc'));
        if (this.$files['terrain.item'])
            this.$itemRaw.value = this.read(path.join(root, 'terrain.item'));
        if (this.$files['virtual.exits'])
            this.$externalRaw.value = this.read(path.join(root, 'virtual.exits'));
        this.emit('watch', root);
        this.doUpdate(UpdateType.buildRooms | UpdateType.buildMap);
        this.loadDescriptions();
        this.loadItems();
        this.loadExits();
        this.resetRawCursors();
        this.emit('opened');
        this.state |= FileState.opened;
        this.changed = false;
        this.clearRawChanged();
    }

    public save() {
        this.$saving[this.filename] = true;
        this.write(this.$mapRaw.value);
        let root = path.dirname(this.file);

        if (this.$files['virtual.terrain'] && this.$terrainRaw.dataset.changed === 'true') {
            this.$saving['virtual.terrain'] = true;
            this.write(this.$terrainRaw.value, path.join(root, 'virtual.terrain'));
        }
        if (this.$files['virtual.state'] && this.$stateRaw.dataset.changed === 'true') {
            this.$saving['virtual.state'] = true;
            this.write(this.$stateRaw.value, path.join(root, 'virtual.state'));
        }
        if (this.$files['terrain.desc'] && this.$descriptionRaw.dataset.changed === 'true') {
            this.$saving['terrain.desc'] = true;
            this.write(this.$descriptionRaw.value, path.join(root, 'terrain.desc'));
        }
        if (this.$files['terrain.item'] && this.$itemRaw.dataset.changed === 'true') {
            this.$saving['terrain.item'] = true;
            this.write(this.$itemRaw.value, path.join(root, 'terrain.item'));
        }
        if (this.$files['virtual.exits'] && this.$externalRaw.dataset.changed === 'true') {
            this.$saving['virtual.exits'] = true;
            this.write(this.$externalRaw.value, path.join(root, 'virtual.exits'));
        }
        this.clearRawChanged();
        this.changed = false;
        this.new = false;
        this.emit('saved');
    }

    public canSaveAs() {
        var choice;
        var files = Object.keys(this.$files).sort().reverse();
        var fl = files.length;
        while (fl--) {
            if (this.confirmRaw(files[fl]) === 1)
                return false;
        }
        return true;
    }

    private confirmRaw(file) {
        // no file so skip
        if (!this.$files[file] || !existsSync(path.join(path.dirname(this.file), file)))
            return 0;
        //ask and return answer
        return dialog.showMessageBox(
            remote.getCurrentWindow(),
            {
                type: 'warning',
                title: 'Confirm Save As',
                message: file + 'already exists.\nDo you want to replace it?',
                buttons: ['Yes', 'No'],
                defaultId: 1
            });
    }

    public revert(file?) {
        if (!this.new)
            this.open(file);
        else {
            this.$files = {};
            this.$mapRaw.value = this.$startValues.map;
            if (this.$startValues.hasOwnProperty('virtual.terrain')) {
                this.$terrainRaw.value = this.$startValues['virtual.terrain'];
                this.$files['virtual.terrain'] = true;
            }
            if (this.$startValues.hasOwnProperty('virtual.state')) {
                this.$stateRaw.value = this.$startValues['virtual.state'];
                this.$files['virtual.state'] = true;
            }
            if (this.$startValues.hasOwnProperty('terrain.desc')) {
                this.$descriptionRaw.value = this.$startValues['terrain.desc'];
                this.$files['terrain.desc'] = true;
            }
            if (this.$startValues.hasOwnProperty('terrain.item')) {
                this.$itemRaw.value = this.$startValues['terrain.item'];
                this.$files['terrain.item'] = true;
            }
            if (this.$startValues.hasOwnProperty('virtual.exits')) {
                this.$externalRaw.value = this.$startValues['virtual.exits'];
                this.$files['virtual.exits'] = true;
            }
            this.resetRawCursors();
            this.doUpdate(UpdateType.buildRooms | UpdateType.buildMap);
            this.loadDescriptions();
            this.loadItems();
            this.loadExits();
            this.clearRawChanged();
        }
        this.changed = false;
        this.switchView(this.$view, true);
        this.emit('reverted');
    }

    public get selected() { return ''; }
    public selectAll() { };
    public cut() { }
    public copy() { }
    public paste() { }
    public delete() { }
    public undo() { }
    public redo() { }
    public close() {
        let root = path.dirname(this.file);
        this.emit('watch-stop', root);
    }
    public deleted(keep, file?) {
        var base = path.basename(file);
        if (file === this.file) {
            if (!keep) return;
            this.$mapRaw.dataset.changed = 'true';
            this.changed = true;
        }
        else if (this.$files[base]) {
            switch (base) {
                case 'virtual.terrain':
                    this.$terrainRaw.dataset.changed = 'true';
                    break;
                case 'virtual.state':
                    this.$stateRaw.dataset.changed = 'true';
                    break;
                case 'virtual.exits':
                    this.$externalRaw.dataset.changed = 'true';
                    break;
                case 'terrain.desc':
                    this.$descriptionRaw.dataset.changed = 'true';
                    break;
                case 'terrain.item':
                    this.$itemRaw.dataset.changed = 'true';
                    break;
            }
            this.changed = true;
        }
    }

    public watch(action: string, file: string, details?) {
        if (this.new)
            return;
        var base = path.basename(file);
        if (file === this.file || this.$files[base]) {
            switch (action) {
                case 'add':
                case 'change':
                case 'unlink':
                    if (!this.$saving[path.basename(file)])
                        this.emit('reload', action, file);
                    else
                        this.$saving[path.basename(file)] = false;
                    break;
            }
        }
        if ((/^\d+,\d+(,\d+)?\.c$/).test(base)) {
            var c = base.substring(0, base.length - 2).split(',');
            var r;
            if (c.length === 3)
                r = this.getRoom(c[0], c[1], c[2]);
            else
                r = this.getRoom(c[0], c[1]);
            switch (action) {
                case 'add':
                case 'change':
                case 'unlink':
                    r.ef = existsSync(file);
                    this.loadRoom(r);
                    break;
            }
        }
    }

    public set spellcheck(value: boolean) { };
    public find() { }
    public replace() { }
    public supports(what) {
        switch (what) {
            case 'refresh':
                return this.$view == View.map || this.$view == View.terrains || this.$view == View.items || this.$view == View.exits;
            case 'buttons':
            case 'menu|view':
                return true;
        }
        return false;
    }
    public get buttons() {
        var frag = document.createDocumentFragment();
        var group;
        let el;
        let icon;
        group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');
        group.appendChild(this.createButton('room editor', 'columns', () => {
            this.$splitterEditor.panel2Collapsed = !this.$splitterEditor.panel2Collapsed;
        }, !this.$splitterEditor.panel2Collapsed));
        group.appendChild(this.createButton('room preview', 'columns fa-rotate-90', () => {
            this.$splitterPreview.panel2Collapsed = !this.$splitterPreview.panel2Collapsed;
        }, !this.$splitterPreview.panel2Collapsed));
        frag.appendChild(group);
        group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');
        group.appendChild(this.createButton('map', 'map-o', () => {
            this.switchView(View.map);
        }, this.$view === View.map));
        group.appendChild(this.createButton('terrains', 'picture-o', () => {
            this.switchView(View.terrains);
        }, this.$view === View.terrains));
        group.appendChild(this.createButton('items', 'list', () => {
            this.switchView(View.items);
        }, this.$view === View.items));
        group.appendChild(this.createButton('external exits', 'sign-out', () => {
            this.switchView(View.exits);
        }, this.$view === View.exits));
        el = document.createElement('button');
        el.id = 'btn-raw';
        el.type = 'button';
        el.classList.add('btn', 'btn-default', 'btn-xs', 'btn-caret');
        el.title = 'Show raw'
        el.innerHTML = '<span class="caret"></span>';
        el.onclick = (e) => {
            var button = $(e.currentTarget);
            button.addClass('open');
            const pos = button.offset();
            const x = Math.floor(pos.left);
            const y = Math.floor(pos.top + button.outerHeight() + 2);
            const addMenu = new Menu();
            addMenu.append(new MenuItem({
                label: 'Map raw',
                click: () => {
                    button.removeClass('open');
                    button.blur();
                    this.switchView(View.mapRaw);
                },
                type: 'checkbox',
                checked: this.$view === View.mapRaw
            }));
            if (this.$files['virtual.terrain'])
                addMenu.append(new MenuItem({
                    label: 'Terrain raw',
                    click: () => {
                        button.removeClass('open');
                        button.blur();
                        this.switchView(View.terrainsRaw);
                    },
                    type: 'checkbox',
                    checked: this.$view === View.terrainsRaw
                }));
            addMenu.append(new MenuItem({
                label: 'Description raw',
                click: () => {
                    button.removeClass('open');
                    button.blur();
                    this.switchView(View.descriptionsRaw);
                },
                type: 'checkbox',
                checked: this.$view === View.descriptionsRaw
            }));
            addMenu.append(new MenuItem({
                label: 'Items raw',
                click: () => {
                    button.removeClass('open');
                    button.blur();
                    this.switchView(View.itemsRaw);
                },
                type: 'checkbox',
                checked: this.$view === View.itemsRaw
            }));
            if (this.$files['virtual.state'])
                addMenu.append(new MenuItem({
                    label: 'State raw',
                    click: () => {
                        button.removeClass('open');
                        button.blur();
                        this.switchView(View.stateRaw);
                    },
                    type: 'checkbox',
                    checked: this.$view === View.stateRaw
                }));

            addMenu.append(new MenuItem({
                label: 'External exits raw',
                click: () => {
                    button.removeClass('open');
                    button.blur();
                    this.switchView(View.exitsRaw);
                },
                type: 'checkbox',
                checked: this.$view === View.exitsRaw
            }));
            addMenu.popup(remote.getCurrentWindow(), { x: x, y: y });
        }
        group.appendChild(el);
        frag.appendChild(group);
        group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');
        group.appendChild(this.createButton('colors', 'paint-brush', () => {
            this.ShowColors = !this.$showColors;
        }, this.$showColors));
        group.appendChild(this.createButton('terrain', 'globe', () => {
            this.ShowTerrain = !this.$showTerrain;
        }, this.$showTerrain));
        frag.appendChild(group);
        if (this.$mapSize.depth > 1) {
            el = document.createElement('label');
            el.setAttribute('for', this.parent.id + '-level');
            el.classList.add('label');
            el.textContent = 'Level';
            frag.appendChild(el);
            frag.appendChild(this.$depthToolbar);
        }
        return [frag];
    }

    private createButton(id, icon, fun, active) {
        let el = document.createElement('button');
        el.id = 'btn-' + id.replace(/\s+/g, '-');
        el.type = 'button';
        el.classList.add('btn', 'btn-default', 'btn-xs');
        if (active)
            el.classList.add('active');
        el.title = 'Show ' + id;
        el.onclick = fun;
        el.innerHTML = '<i class="fa fa-' + icon + '"></i>';
        return el;
    }

    private setButtonState(id, state) {
        var button = document.getElementById('btn-' + id.replace(/\s+/g, '-'));
        if (!button) return;
        if (state)
            button.classList.add('active');
        else
            button.classList.remove('active');
    }

    private setButtonDisabled(id, state) {
        var button = document.getElementById('btn-' + id.replace(/\s+/g, '-'));
        if (!button) return;
        if (state)
            button.setAttribute('disabled', 'true');
        else
            button.removeAttribute('disabled');
    }

    public menu(menu) {
        var m;
        if (menu == 'view') {
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
                    label: 'Terrains',
                    type: 'checkbox',
                    checked: this.$view === View.terrains,
                    click: () => {
                        this.switchView(View.terrains);
                    }
                },
                {
                    label: 'Items',
                    type: 'checkbox',
                    checked: this.$view === View.items,
                    click: () => {
                        this.switchView(View.items);
                    }
                },
                {
                    label: 'External exits',
                    type: 'checkbox',
                    checked: this.$view === View.exits,
                    click: () => {
                        this.switchView(View.exits);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Map raw',
                    type: 'checkbox',
                    checked: this.$view === View.mapRaw,
                    click: () => {
                        this.switchView(View.mapRaw);
                    }
                },
            ];
            if (this.$files['virtual.terrain'])
                m.push({
                    label: 'Terrain raw',
                    type: 'checkbox',
                    checked: this.$view === View.terrainsRaw,
                    click: () => {
                        this.switchView(View.terrainsRaw);
                    }
                });

            m.push({
                label: 'Description raw',
                type: 'checkbox',
                checked: this.$view === View.descriptionsRaw,
                click: () => {
                    this.switchView(View.descriptionsRaw);
                }
            });
            m.push({
                label: 'Items raw',
                type: 'checkbox',
                checked: this.$view === View.itemsRaw,
                click: () => {
                    this.switchView(View.itemsRaw);
                }
            });
            if (this.$files['virtual.state'])
                m.push({
                    label: 'State raw',
                    type: 'checkbox',
                    checked: this.$view === View.stateRaw,
                    click: () => {
                        this.switchView(View.stateRaw);
                    }
                });
            m.push({
                label: 'External exits raw',
                type: 'checkbox',
                checked: this.$view === View.exitsRaw,
                click: () => {
                    this.switchView(View.exitsRaw);
                }
            });
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
            m.push({ type: 'separator' });
            m.push({
                label: 'Show colors',
                type: 'checkbox',
                checked: this.$showColors,
                click: () => {
                    this.ShowColors = !this.$showColors;
                }
            });
            m.push({
                label: 'Show terrain',
                type: 'checkbox',
                checked: this.$showTerrain,
                click: () => {
                    this.ShowTerrain = !this.$showTerrain;
                }
            });
        }
        return m;
    }

    public focus(): void {

        switch (this.$view) {
            case View.map:
                setTimeout(() => {
                    this.$mapContainer.focus();
                    this.$map.focus();
                }, 10);
                break;
            case View.terrains:
                break;
            case View.items:
                break;
            case View.exits:
                break;
            case View.mapRaw:
                this.$mapRaw.focus();
                break;
            case View.terrainsRaw:
                this.$terrainRaw.focus();
                break;
            case View.descriptionsRaw:
                this.$descriptionRaw.focus();
                break;
            case View.itemsRaw:
                this.$itemRaw.focus();
                break;
            case View.stateRaw:
                this.$stateRaw.focus();
                break;
            case View.exitsRaw:
                this.$externalRaw.focus();
                break;
        }
    }
    public resize() { }
    public set options(value: any) {
        if (!value) return;
        this.ShowColors = value.showColors;
        this.ShowTerrain = value.showTerrain;
        this.$mapRaw.style.fontFamily = value.rawFontFamily;
        this.$mapRaw.style.fontSize = value.rawFontSize + 'px';
        this.$mapRaw.style.fontWeight = value.rawFontWeight;

        this.$terrainRaw.style.fontFamily = value.rawFontFamily;
        this.$terrainRaw.style.fontSize = value.rawFontSize + 'px';
        this.$terrainRaw.style.fontWeight = value.rawFontWeight;

        this.$stateRaw.style.fontFamily = value.rawFontFamily;
        this.$stateRaw.style.fontSize = value.rawFontSize + 'px';
        this.$stateRaw.style.fontWeight = value.rawFontWeight;

        this.$descriptionRaw.style.fontFamily = value.rawFontFamily;
        this.$descriptionRaw.style.fontSize = value.rawFontSize + 'px';
        this.$descriptionRaw.style.fontWeight = value.rawFontWeight;

        this.$itemRaw.style.fontFamily = value.rawFontFamily;
        this.$itemRaw.style.fontSize = value.rawFontSize + 'px';
        this.$itemRaw.style.fontWeight = value.rawFontWeight;

        this.$externalRaw.style.fontFamily = value.rawFontFamily;
        this.$externalRaw.style.fontSize = value.rawFontSize + 'px';
        this.$externalRaw.style.fontWeight = value.rawFontWeight;

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
            showColors: this.$showColors,
            showTerrain: this.$showTerrain,
            live: this.$splitterEditor.live,
            showRoomEditor: !this.$splitterEditor.panel2Collapsed,
            showRoomPreview: !this.$splitterPreview.panel2Collapsed,
        }
    }
    public get type() {
        return 2;
    }
    public insert(text) { }
    public get location() { return [-1, -1]; }
    public get length() { return 0; }

    public activate() {

    }
    public deactivate() {

    }

    public switchView(view: View, force?) {
        if (!force && this.$view === view) return;
        this.$label.style.display = '';
        switch (this.$view) {
            case View.map:
                this.$splitterEditor.hide();
                break;
            case View.terrains:
                break;
            case View.items:
                break;
            case View.exits:
                break;
            case View.mapRaw:
                this.$mapRaw.style.display = '';
                break;
            case View.terrainsRaw:
                this.$terrainRaw.style.display = '';
                break;
            case View.descriptionsRaw:
                this.$descriptionRaw.style.display = '';
                break;
            case View.itemsRaw:
                this.$itemRaw.style.display = '';
                break;
            case View.stateRaw:
                this.$stateRaw.style.display = '';
                break;
            case View.exitsRaw:
                this.$externalRaw.style.display = '';
                break;
        }
        this.$view = view;
        switch (this.$view) {
            case View.map:
                if (this.$terrainRaw.dataset.dirty === 'true') {
                    this.loadDescriptions();
                    this.$terrainRaw.dataset.dirty = null;
                    this.doUpdate(UpdateType.drawMap);
                }
                if (this.$itemRaw.dataset.dirty === 'true') {
                    this.loadItems();
                    this.$itemRaw.dataset.dirty = null;
                }
                if (this.$externalRaw.dataset.dirty === 'true') {
                    this.reloadExits();
                    this.$externalRaw.dataset.dirty = null;
                    this.doUpdate(UpdateType.drawMap);
                }
                if (this.$mapRaw.dataset.dirty === 'true') {
                    this.BuildRooms();
                    this.BuildMap();
                    this.$mapRaw.dataset.dirty = null;
                    this.doUpdate(UpdateType.drawMap);
                }
                this.UpdatePreview(this.$selectedRoom);
                this.$label.style.display = 'none';
                this.$splitterEditor.show();
                break;
            case View.terrains:
                if (this.$terrainRaw.dataset.dirty === 'true') {
                    this.loadDescriptions();
                    this.doUpdate(UpdateType.drawMap);
                    this.$terrainRaw.dataset.dirty = null;
                }
                this.$label.textContent = 'Terrains';
                break;
            case View.items:
                if (this.$itemRaw.dataset.dirty === 'true') {
                    this.loadDescriptions();
                    this.doUpdate(UpdateType.drawMap);
                    this.$itemRaw.dataset.dirty = null;
                }
                this.$label.textContent = 'Items';
                break;
            case View.exits:
                if (this.$externalRaw.dataset.dirty === 'true') {
                    this.reloadExits();
                    this.doUpdate(UpdateType.drawMap);
                    this.$externalRaw.dataset.dirty = null;
                }
                this.$label.textContent = 'External exits';
                break;
            case View.mapRaw:
                this.$label.textContent = 'Map raw';
                this.$mapRaw.style.display = 'block';
                break;
            case View.terrainsRaw:
                this.$label.textContent = 'Terrain raw';
                this.$terrainRaw.style.display = 'block';
                break;
            case View.descriptionsRaw:
                this.$label.textContent = 'Descriptions raw';
                this.$descriptionRaw.style.display = 'block';
                break;
            case View.itemsRaw:
                this.$label.textContent = 'Items raw';
                this.$itemRaw.style.display = 'block';
                break;
            case View.stateRaw:
                this.$label.textContent = 'State raw';
                this.$stateRaw.style.display = 'block';
                break;
            case View.exitsRaw:
                this.$label.textContent = 'External exits raw';
                this.$externalRaw.style.display = 'block';
                break;
        }
        this.emit('menu-update', 'view|map', { checked: view == View.map });
        this.emit('menu-update', 'view|Terrains', { checked: view == View.terrains });
        this.emit('menu-update', 'view|Items', { checked: view == View.items });
        this.emit('menu-update', 'view|External exits', { checked: view == View.exits });
        this.emit('menu-update', 'view|Map raw', { checked: view == View.mapRaw });
        this.emit('menu-update', 'view|Terrain raw', { checked: view == View.terrainsRaw });
        this.emit('menu-update', 'view|Description raw', { checked: view == View.descriptionsRaw });
        this.emit('menu-update', 'view|Items raw', { checked: view == View.itemsRaw });
        this.emit('menu-update', 'view|State raw', { checked: view == View.stateRaw });
        this.emit('menu-update', 'view|External exits raw', { checked: view == View.exitsRaw });
        this.emit('menu-update', 'view|room editor', { enabled: view == View.map });
        this.emit('menu-update', 'view|room preview', { enabled: view == View.map });
        this.setButtonDisabled('room editor', view != View.map);
        this.setButtonDisabled('room preview', view != View.map);
        this.setButtonState('map', view == View.map);
        this.setButtonState('terrains', view == View.terrains);
        this.setButtonState('items', view == View.items);
        this.setButtonState('external exits', view == View.exits);
        this.emit('supports-changed');
        this.focus();
    }

    public updateUI() {
        this.emit('location-changed', (this.$mouse.x / 32), this.$mouse.y / 32);
        this.updateStatus();
    }

    private updateStatus() {
        this.emit('status-message', `Rooms ${this.$rcount}, Empty rooms ${(this.$mapSize.width * this.$mapSize.height * this.$mapSize.depth) - this.$rcount}, Total rooms ${this.$mapSize.width * this.$mapSize.height * this.$mapSize.depth}`);
    }

    private setFocus(value) {
        if (this.$focused === value) return;
        this.$focused = value;
        if (this.$selectedRoom)
            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, this.$selectedRoom.at(this.$mouse.rx, this.$mouse.ry));
        if (this.$mouse.rx >= 0 && this.$mouse.ry > 0) {
            var r = this.getRoom(this.$mouse.rx, this.$mouse.ry);
            if (r) this.DrawRoom(this.$mapContext, r, true, true);
        }
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
        evt = evt || window.event
        var x = evt.offsetX;
        var y = evt.offsetY;//this.$mapContainer.scrollTop;
        return {
            x: x,
            y: y,
            rx: (x / 32) >> 0,
            ry: (y / 32) >> 0,
            button: evt.button
        };
    }

    private getRoom(x, y, z?): Room {
        if (typeof (z) === "undefined")
            z = this.$depth || 0;
        if (x < 0 || y < 0 || !this.$rooms)
            return null;
        if (z >= this.$rooms.length)
            return null;
        if (y >= this.$rooms[z].length)
            return null;
        if (x >= this.$rooms[z][y].length)
            return null;
        return this.$rooms[z][y][x];
    }

    private setRoom(r) {
        if (!r)
            return;
        if (r.x < 0 || r.y < 0)
            return;
        if (r.z >= this.$rooms.length)
            return;
        if (r.y >= this.$rooms[r.z].length)
            return;
        if (r.x >= this.$rooms[r.z][r.y].length)
            return;
        this.$rooms[r.z][r.y][r.x] = r;
        if (this.$selectedRoom && this.$selectedRoom.at(r.x, r.y, r.z)) {
            this.UpdateEditor(r);
            this.UpdatePreview(r);
        }
        if (r.z === this.$depth)
            this.DrawRoom(this.$mapContext, r, true, r.at(this.$mouse.rx, this.$mouse.ry));
    }

    private DrawRoom(ctx, room, c, h?) {
        //var clr = "black";
        var x = room.x * 32;
        var y = room.y * 32;
        var ex = room.exits | room.ee | room.climbs;
        var exs = ex;
        //if(ex === RoomExit.None) clr = "#E6E6E6";
        ctx.save();
        if (c) {
            ctx.fillStyle = "white";
            ctx.fillRect(x, y, 32, 32);
        }


        ///ctx.translate(0.5,0.5);
        if (this.$selectedRoom === room) {
            if (this.$focused) {
                ctx.fillStyle = "rgba(135, 206, 250, 0.50)";
                ctx.strokeStyle = "rgba(135, 206, 250, 0.50)";
            }
            else {
                ctx.fillStyle = "rgba(142, 142, 142, 0.50)";
                ctx.strokeStyle = "rgba(142, 142, 142, 0.50)";
            }
            ctx.fillRoundedRect(1 + x, 1 + y, 30, 30, 8);
            ctx.strokeRoundedRect(1 + x, 1 + y, 30, 30, 8);
        }

        if ((exs & RoomExit.Up) === RoomExit.Up) exs &= ~RoomExit.Up;
        if ((exs & RoomExit.Down) === RoomExit.Down) exs &= ~RoomExit.Down;
        if ((exs & RoomExit.Out) === RoomExit.Out) exs &= ~RoomExit.Out;
        if ((exs & RoomExit.Enter) === RoomExit.Enter) exs &= ~RoomExit.Enter;
        if (exs === RoomExit.None && ex !== RoomExit.None) {
            ctx.strokeStyle = "black";
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

        if (room.ee) {
            ctx.strokeStyle = "red";
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
            ctx.strokeStyle = "black";
        }

        if (room.ef) {
            ctx.fillStyle = "#FFE4E1";
            ctx.fillRect(x + 8, y + 8, 16, 16);
            ctx.fillStyle = "black";
            if (ex != RoomExit.None) {
                ctx.strokeStyle = "black";
                ctx.strokeRect(0.5 + x + 7, 0.5 + y + 7, 17, 17);
            }
        }
        else if (this.$showColors) {
            ctx.fillStyle = this.getColor(room.terrain);
            ctx.fillRect(x + 8, y + 8, 16, 16);
        }

        if (this.$showTerrain) {
            if (exs === RoomExit.None && ex === RoomExit.None)
                ctx.fillStyle = "rgb(234, 233, 233)";
            else if (this.$showColors)
                ctx.fillStyle = this.ContrastColor(ctx.fillStyle);
            else
                ctx.fillStyle = "black";
            var m;
            if (this.$measure && this.$measure[room.terrain])
                m = this.$measure[room.terrain];
            else {
                if (!this.$measure) this.$measure = {};
                m = (this.$measure[room.terrain] = ctx.measureText(room.terrain).width / 2);
            }
            ctx.fillText(room.terrain, x + 16 - m, y + 19);
        }
        ctx.fillStyle = "black";
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
                ctx.fillStyle = "rgba(135, 206, 250, 0.5)";
                ctx.strokeStyle = "rgba(135, 206, 250, 0.5)";
            }
            else {
                ctx.fillStyle = "rgba(221, 221, 221, 0.75)";
                ctx.strokeStyle = "rgba(142, 142, 142, 0.75)";
            }
            ctx.fillRoundedRect(1 + x, 1 + y, 30, 30, 8);
            ctx.strokeRoundedRect(1 + x, 1 + y, 30, 30, 8);
        }
        ctx.restore();
    }

    private DrawMap() {
        var x = 0,
            y = 0,
            z = 0,
            r, xl, yl;
        if (!this.$mapContext) return;
        this.$mapContext.save();
        this.$mapContext.fillStyle = "white";
        this.$mapContext.fillRect(0, 0, this.$mapSize.right, this.$mapSize.bottom)
        this.$mapContext.lineWidth = 0.6;
        if (!this.$rooms) {
            this.$mapContext.restore();
            return;
        }
        if (!window.$roomImgLoaded) {
            this.doUpdate(UpdateType.drawMap);
            return;
        }
        yl = this.$mapSize.height;
        xl = this.$mapSize.width;
        Timer.start();
        this.$mapContext.strokeStyle = "black";
        for (y = 0; y < yl; y++) {
            r = this.$rooms[this.$depth][y];
            for (x = 0; x < xl; x++)
                this.DrawRoom(this.$mapContext, r[x], false);
        }
        this.$mapContext.strokeStyle = "black";
        Timer.end('Draw time');
        this.$mapContext.restore();
    }

    private GetColorFromColorScale(val, min, max, colors) {
        if (!colors || colors.length < 2) return "white";
        if (max === min) return colors[0];
        if (val > max) val = max;
        if (val < min) val = min;

        var cl = colors.length;
        var nspan = (max - min) / cl;
        var curr = min;
        var start, end;

        for (var c = 0; c < cl; c++) {
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

        var r, g, b, vp;
        vp = (val - curr) / nspan;
        r = start.r + ((end.r - start.r) * vp);
        g = start.g + ((end.g - start.g) * vp);
        b = start.b + ((end.b - start.b) * vp);
        if (r < 0) r = 0;
        if (r > 255) r = 255;
        if (g < 0) g = 0;
        if (g > 255) g = 255;
        if (b < 0) b = 0;
        if (b > 255) b = 255;
        return "rgb(" + (r >> 0) + ", " + (g >> 0) + ", " + (b >> 0) + ")";
    }

    private ContrastColor(color) {
        if (this.$colorCache && this.$colorCache[color])
            return this.$colorCache[color];
        if (!this.$colorCache)
            this.$colorCache = {};
        color = new RGBColor(color);
        var d = 0;
        // Counting the perceptive luminance - human eye favors green color...
        var a = 1 - (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
        if (a < 0.5)
            d = 0; // bright colors - black font
        else
            d = 255; // dark colors - white font

        return this.$colorCache[color] = "rgb(" + d + ", " + d + ", " + d + ")";
    }

    private getColor(t) {
        if (!t || this.$maxTerrain === 0 || t < 1 || t > this.$maxTerrain) return "white";
        //return "white";
        if (this.$colorCache && this.$colorCache[t])
            return this.$colorCache[t];
        if (!this.$colorCache)
            this.$colorCache = {};
        return this.$colorCache[t] = this.GetColorFromColorScale(t, 1, this.$maxTerrain, ["#008000", "#FFFF00", "#FF0000", "#0000FF"]);
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
            if ((this._updating & UpdateType.buildRooms) === UpdateType.buildRooms) {
                this.BuildRooms();
                this._updating &= ~UpdateType.buildRooms;
            }
            if ((this._updating & UpdateType.buildMap) === UpdateType.buildMap) {
                this.BuildMap();
                this._updating &= ~UpdateType.buildMap;
            }
            this.doUpdate(this._updating);
        });
    }

    private ChangeSelection(room) {
        this.$selectedRoom = room;
        this.UpdateEditor(room);
        this.UpdatePreview(room);
    }

    private ClearPrevMouse() {
        var p = this.getRoom(this.$mousePrevious.rx, this.$mousePrevious.ry);
        if (p) this.DrawRoom(this.$mapContext, p, true, false);
    }

    private loadRoom(r) {
        if (!r.ef) return;
        let f;
        if (this.$mapSize.depth > 1)
            f = r.x + "," + r.y + "," + r.z + ".c";
        else
            f = r.x + "," + r.y + ".c";
        this.setRoom(this.parseRoomCode(r, this.read(path.join(path.dirname(this.file), f))));
    }

    private parseRoomCode(r, code) {
        if (typeof (r) === "undefined")
            r = new Room(-1, -1, -1, 0, 0, 0);
        if (!code || code.length === 0)
            return r;
        var idx = 0,
            idx2;
        var len = code.length;
        var state = 0;
        var start = 1;
        var ident = "";
        var c, i;
        var b = 0;
        var val = "";
        var quote = false;
        var block;
        r.smell = "";
        r.sound = "";
        r.long = "";
        r.exits = 0;
        r.terrain = "";
        r.item = -1;
        r.ee = 0;
        r.state = 0;
        var exit;
        for (; idx < len; idx++) {
            var c = code.charAt(idx);
            var i = code.charCodeAt(idx);
            switch (state) {
                case 1:
                    if (b === 1 && c === '}') {
                        state = 0;
                        b = 0;
                        ident = "";
                    }
                    else if (c === '}') {
                        b--;
                        ident = "";
                    }
                    else if (c === '{') {
                        b++;
                        ident = "";
                    }
                    else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_') {
                        ident += c;
                    }
                    else if (ident.length > 0) {
                        switch (ident) {
                            case "set_short":
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
                            case "set_long":
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
                            case "add_exit":
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
                                exit = code.substring(idx, idx2 - 1).trim().splitQuote(",", 3, 3);
                                if (exit.length > 0) {
                                    switch (this.parseString(exit[0])) {
                                        case "north":
                                            r.exits |= RoomExit.North;
                                            break;
                                        case "northeast":
                                            r.exits |= RoomExit.NorthEast;
                                            break;
                                        case "east":
                                            r.exits |= RoomExit.East;
                                            break;
                                        case "southeast":
                                            r.exits |= RoomExit.SouthEast;
                                            break;
                                        case "south":
                                            r.exits |= RoomExit.South;
                                            break;
                                        case "southwest":
                                            r.exits |= RoomExit.SouthWest;
                                            break;
                                        case "west":
                                            r.exits |= RoomExit.West;
                                            break;
                                        case "northwest":
                                            r.exits |= RoomExit.NorthWest;
                                            break;
                                        case "up":
                                            r.exits |= RoomExit.Up;
                                            break;
                                        case "down":
                                            r.exits |= RoomExit.Down;
                                            break;
                                        case "out":
                                            r.exits |= RoomExit.Out;
                                            break;
                                        case "enter":
                                            r.exits |= RoomExit.Enter;
                                            break;
                                        default:
                                            r.exits |= RoomExit.Unknown;
                                            break;
                                    }
                                }
                                idx = idx2;
                                break;
                            case "set_exits":
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
                                var exits = this.parseMapping(code.substring(idx, idx2 - 1).trim());
                                for (exit in exits) {
                                    if (!exits.hasOwnProperty(exit)) continue;
                                    switch (exit) {
                                        case "north":
                                            r.exits |= RoomExit.North;
                                            break;
                                        case "northeast":
                                            r.exits |= RoomExit.NorthEast;
                                            break;
                                        case "east":
                                            r.exits |= RoomExit.East;
                                            break;
                                        case "southeast":
                                            r.exits |= RoomExit.SouthEast;
                                            break;
                                        case "south":
                                            r.exits |= RoomExit.South;
                                            break;
                                        case "southwest":
                                            r.exits |= RoomExit.SouthWest;
                                            break;
                                        case "west":
                                            r.exits |= RoomExit.West;
                                            break;
                                        case "northwest":
                                            r.exits |= RoomExit.NorthWest;
                                            break;
                                        case "up":
                                            r.exits |= RoomExit.Up;
                                            break;
                                        case "down":
                                            r.exits |= RoomExit.Down;
                                            break;
                                        case "out":
                                            r.exits |= RoomExit.Out;
                                            break;
                                        case "enter":
                                            r.exits |= RoomExit.Enter;
                                            break;
                                        default:
                                            r.exits |= RoomExit.Unknown;
                                            break;
                                    }
                                }
                                idx = idx2;
                                break;
                            case "add_climb":
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
                                        case "up":
                                            r.climbs |= RoomExit.Up;
                                            break;
                                        case "down":
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
                            case "set_terrain":
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
                            case "set_listen":
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                var b2 = 0;
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
                                            if (idx2 > 0 && code.charAt(idx2 - 1) == '\\')
                                                continue;
                                            quote = !quote;
                                        }
                                        if (!quote && c === ';')
                                            break;
                                    }
                                    if (block == "default")
                                        r.sound = this.parseString(code.substring(idx, idx2 - 1).trim());
                                }
                                else {
                                    if (block.startsWith('"'))
                                        r.sound = this.parseString(block);
                                    else if (block.startsWith('(:'))
                                        r.sound = "Function: " + block.slice(0, -1);
                                    else if (block.startsWith('([')) {
                                        var sounds = this.parseMapping(block);
                                        for (var sound in sounds) {
                                            if (!sounds.hasOwnProperty(sound)) continue;
                                            if (sound === "default") {
                                                r.sound = sound;
                                                break;
                                            }
                                        }
                                    }
                                }
                                idx = idx2;
                                break;
                            case "set_smell":
                                idx++;
                                while (idx < len && (code.charAt(idx) === ' ' || code.charAt(idx) === '\t'))
                                    idx++;
                                var b2 = 0;
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
                                            if (idx2 > 0 && code.charAt(idx2 - 1) == '\\')
                                                continue;
                                            quote = !quote;
                                        }
                                        if (!quote && c === ';')
                                            break;
                                    }
                                    if (block == "default")
                                        r.smell = this.parseString(code.substring(idx, idx2 - 1).trim());
                                    idx = idx2;
                                }
                                else {
                                    if (block.startsWith('"'))
                                        r.smell = this.parseString(block);
                                    else if (block.startsWith('(:'))
                                        r.smell = "Function: " + block.slice(0, -1);
                                    else if (block.startsWith('([')) {
                                        var smells = this.parseMapping(block);
                                        for (var smell in smells) {
                                            if (!smells.hasOwnProperty(smell)) continue;
                                            if (smell === "default") {
                                                r.smell = smell;
                                                break;
                                            }
                                        }
                                    }
                                    idx = idx2;
                                }
                                break;
                            case "add_items":
                            case "set_items":
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
                                var items = this.parseMapping(block);
                                if (!r.items) r.items = [];
                                for (var item in items) {
                                    if (!items.hasOwnProperty(item)) continue;
                                    if (item.startsWith("({") && item.endsWith("})")) {
                                        var k = item.slice(2, -2).splitQuote(",", 3, 3);
                                        for (var s = 0, sl = k.length; s < sl; s++)
                                            r.item.push({
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
                            case "set_property":
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
                                exit = code.substring(idx, idx2 - 1).trim().splitQuote(",", 3, 3);
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
                                var exits = this.parseMapping(code.substring(idx, idx2 - 1).trim());
                                for (exit in exits) {
                                    if (!exits.hasOwnProperty(exit)) continue;
                                    if (exit === 'light') {
                                        r.light = +exits[exit];
                                        break;
                                    }
                                }
                                idx = idx2;
                                break;
                        }
                        ident = "";
                    }
                    else
                        ident = "";
                    break;
                default:
                    switch (c) {
                        case '\n':
                            start = 1;
                            ident = "";
                            break;
                        default:
                            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === ' ')
                                ident += c;
                            else if (start && (ident === "void create" || ident === "varargs void create")) {
                                state = 1;
                                ident = "";
                            }
                            else {
                                start = 0;
                                ident = "";
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
        var end = str.length;
        if (str.startsWith("(:"))
            return "Function: " + str;
        if (str.startsWith("(["))
            return "Mapping: " + str;
        if (str.startsWith("({"))
            return "Array: " + str;
        var sb = [];
        var save = true;
        var c;
        for (var idx = 0; idx < end; idx++) {
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

        return sb.join("");
    }

    private parseMapping(str) {
        if (!str || str.length === 0)
            return {};
        if (!str.startsWith("(["))
            return {};
        if (!str.endsWith("])"))
            return {};

        str = str.slice(2, -2).trim();
        var idx = 0, pIdx = 0, end = str.length;
        var m = {};
        var array = 0;
        var pair, c;
        for (; idx < end; idx++) {
            c = str.charAt(idx);
            switch (c) {
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
        return m;

    }

    private parseKeyPair(str) {
        if (!str || str.length === 0)
            return ["", ""];
        var pair = ["", ""], c;
        var idx = 0, end = str.length - 2;
        var array;
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

    private RoomChanged(room, old) {
        var c = 0,
            s = 0;
        var nl = "";
        if (room.state === old.state && room.exits === old.exits && room.terrain === old.terrain && room.item === old.item)
            return;
        if (old.exits) this.$rcount--;
        if (room.exits) this.$rcount++;
        this.updateStatus();
        var y = room.y + 1 + room.z * (this.$mapSize.height + 1);
        var x = room.x;
        var line;
        var lines;
        //dimensions + ((height + space) * depth)
        var maxLines = 1 + (this.$mapSize.height + 1) * this.$mapSize.depth;
        if (this.$files['virtual.state']) {
            if (room.state != old.state) {
                lines = this.$stateRaw.value.split("\n");
                while (lines.length < maxLines)
                    lines.push('');
                if (y < 1 || y >= lines.length) return;
                line = lines[y].split(" ");
                while (line.length < this.$mapSize.width)
                    lines.push('');
                if (x < 0 || x >= line.length) return;
                line[x] = leadingZeros(room.terrain, 3, "0");
                lines[y] = line.join(" ");
                this.$stateRaw.value = lines.join("\n");
                c++;
            }
        }
        else {
            if (room.state > 0)
                nl = ":" + leadingZeros(room.state, 3, "0");
            if (room.state != old.state)
                s = 1;
        }

        if (this.$files['virtual.terrain']) {
            if (room.terrain != old.terrain || room.item != old.item || s || nl.length > 0) {
                lines = this.$terrainRaw.value.split("\n");
                while (lines.length < maxLines)
                    lines.push('');
                if (y < 1 || y >= lines.length) return;
                line = lines[y].split(" ");
                while (line.length < this.$mapSize.width)
                    lines.push('');
                if (x < 0 || x >= line.length) return;
                line[x] = leadingZeros(room.terrain, 2, "0");
                if (s || nl.length > 0) {
                    line[x] += ":" + leadingZeros(room.item, 2, "0");
                    line[x] += nl;
                    nl = "";
                    s = 0;
                }
                else if (room.terrain != room.item)
                    line[x] += ":" + leadingZeros(room.item, 2, "0");
                lines[y] = line.join(" ");
                this.$terrainRaw.value = lines.join("\n");
                c++;
            }
        }
        else {
            if (room.terrain != old.terrain || room.item != old.item)
                c++;
            nl = ":" + leadingZeros(room.item, 3, "0") + nl;
            nl = ":" + leadingZeros(room.terrain, 3, "0") + nl;
        }

        if (room.exits != old.exits || s || nl.length > 0) {
            lines = this.$mapRaw.value.split("\n");
            while (lines.length < maxLines)
                lines.push('');
            if (y < 1 || y >= lines.length) return;
            line = lines[y].split(" ");
            while (line.length < this.$mapSize.width)
                lines.push('');
            if (x < 0 || x >= line.length) return;
            line[x] = leadingZeros(room.exits, 3, "0");
            if (s || nl.length > 0)
                line[x] += nl;
            if (line[x] === "000:000" || line[x] === "000:000:000" || line[x] === "000:000:000:000")
                line[x] = "000";
            lines[y] = line.join(" ");
            this.$mapRaw.value = lines.join("\n");
            c++;
        }

        if (c) {
            if (room === this.$selectedRoom)
                this.UpdateEditor(room);
            this.$mapRaw.dataset.changed = 'true';
            this.changed = true;
        }
        this.UpdatePreview(room);
    }

    private UpdateEditor(room) {
        if (this.$selectedRoom) {
            this.DrawRoom(this.$mapContext, this.$selectedRoom, true, false);
            this.emit('room-selected', this.$selectedRoom);
            this.$depthToolbar.value = '' + this.$selectedRoom.z;
        }
        var o = room.clone();
        if (o.ef) {
            if (room.items)
                o.items = room.items.slice(0);
            else
                o.items = [];
            o.short = room.short;
            o.long = room.long;
            o.light = room.light || 0;
            o.terrainType = room.terrain;
            o.sound = room.sound;
            o.smell = room.smell;
        }
        else {
            if (o.item < this.$items.length && o.item >= 0 && this.$items[o.item])
                o.items = this.$items[o.item].children.slice(0);
            else
                o.items = [];
            if (o.terrain < this.$descriptions.length && o.terrain >= 0 && this.$descriptions[o.terrain]) {
                o.short = this.$descriptions[o.terrain].short;
                o.long = this.$descriptions[o.terrain].long;
                o.light = this.$descriptions[o.terrain].light;
                o.terrainType = this.$descriptions[o.terrain].terrain;
                o.sound = this.$descriptions[o.terrain].sound;
                o.smell = this.$descriptions[o.terrain].smell;
                o.terrain = -1;
            }
            else {
                o.short = '';
                o.long = '';
                o.light = 0;
                o.terrainType = '';
                o.sound = '';
                o.smell = '';
            }
        }
        this.$roomEditor.object = o;
    }

    private UpdatePreview(room) {
        var ex, e, item;
        if (!room) {
            this.$roomPreview.short.textContent = '';
            this.$roomPreview.long.textContent = '';
            this.$roomPreview.smell.textContent = '';
            this.$roomPreview.sound.textContent = '';
            this.$roomPreview.exits.textContent = '';
        }
        else if (room.ef) {
            if (room.short) {
                this.$roomPreview.short.textContent = room.short;
                this.$roomPreview.long.textContent = room.long;
                str = this.$roomPreview.long.innerHTML;
                if (room.items && room.items.length > 0) {
                    items = room.items.sort(function (a, b) { return b.item.length - a.item.length; });
                    for (var c = 0, cl = items.length; c < cl; c++)
                        str = str.replace(new RegExp("\\b(" + items[c].item + ")\\b", "g"), '<span class="room-item" id="' + this.parent.id + '-room-preview' + c + '" title="">' + items[c].item + '</span>');
                }
                e = room.climbs;
                if (e !== RoomExit.None) {
                    ex = [];
                    str += "<br>You can climb ";
                    for (var exit in RoomExits) {
                        if (!RoomExits.hasOwnProperty(exit)) continue;
                        if (!RoomExits[exit]) continue;
                        if ((e & RoomExits[exit]) === RoomExits[exit])
                            ex.push(exit);
                    }
                    if (ex.length === 1)
                        str += ex[0];
                    else {
                        str += ex.slice(0, -1).join(", ");
                        str += " or " + ex.pop();
                    }
                    str += " from here.";
                }
                str += '<br><br>';
                this.$roomPreview.long.innerHTML = str;
                if (items.length > 0) {
                    for (var c = 0, cl = items.length; c < cl; c++) {
                        item = document.getElementById(this.parent.id + '-room-preview' + c);
                        if (item)
                            item.title = items[c].description;
                    }
                }
                if (room.smell.length > 0 && room.smell != "0" && room.sound.length > 0 && room.sound != "0") {
                    this.$roomPreview.sound.style.display = 'block';
                    this.$roomPreview.smell.style.display = 'block';
                    this.$roomPreview.smell.textContent = room.smell;
                    this.$roomPreview.sound.textContent = room.sound;
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                }
                else if (room.smell.length > 0 && room.smell != "0") {
                    this.$roomPreview.sound.style.display = 'none';
                    this.$roomPreview.smell.style.display = 'block';
                    this.$roomPreview.smell.textContent = room.smell;
                    this.$roomPreview.sound.textContent = '';
                    this.$roomPreview.smell.appendChild(document.createElement('br'));
                    this.$roomPreview.smell.appendChild(document.createElement('br'));
                }
                else if (room.sound.length > 0 && room.sound != "0") {
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
                    this.$roomPreview.exits.textContent = "There are no obvious exits.";
                else {
                    ex = []
                    for (var exit in RoomExits) {
                        if (!RoomExits.hasOwnProperty(exit)) continue;
                        if (!RoomExits[exit]) continue;
                        if ((e & RoomExits[exit]) === RoomExits[exit])
                            ex.push(exit);
                    }
                    if (ex.length === 1)
                        this.$roomPreview.exits.textContent = "There is one obvious exit: " + ex[0];
                    else {
                        var str = "There are " + Cardinal(ex.length) + " obvious exits: ";
                        str += ex.slice(0, -1).join(", ");
                        str += " and " + ex.pop();
                        this.$roomPreview.exits.textContent = str;
                    }
                }
            }
            else {
                this.$roomPreview.short.textContent = '';
                this.$roomPreview.long.textContent = 'External File currently not supported in preview.';
                this.$roomPreview.smell.textContent = '';
                this.$roomPreview.sound.textContent = '';
                this.$roomPreview.exits.textContent = '';
            }
        }
        else {
            var data = this.$descriptions;
            if (data.length === 0 || room.terrain < 0 || room.terrain >= data.length || !data[room.terrain]) {
                this.$roomPreview.short.textContent = '';
                this.$roomPreview.long.textContent = 'Nothing to preview';
                this.$roomPreview.smell.textContent = '';
                this.$roomPreview.sound.textContent = '';
                this.$roomPreview.exits.textContent = '';
            }
            else {
                data = data[room.terrain];
                var items = this.$items;
                this.$roomPreview.short.textContent = data.short;
                this.$roomPreview.long.textContent = data.long;
                str = this.$roomPreview.long.innerHTML;

                if (items.length > 0 && room.item >= 0 && room.item < items.length && items[room.item] && items[room.item].children.length > 0) {
                    items = items[room.item].children.sort(function (a, b) { return b.item.length - a.item.length; });
                    for (var c = 0, cl = items.length; c < cl; c++)
                        str = str.replace(new RegExp("\\b(" + items[c].item + ")\\b"), '<span class="room-item" id="' + this.parent.id + '-room-preview' + c + '" title="">' + items[c].item + '</span>');
                }
                str += '<br><br>';
                this.$roomPreview.long.innerHTML = str;
                if (items.length > 0) {
                    for (var c = 0, cl = items.length; c < cl; c++) {
                        item = document.getElementById(this.parent.id + '-room-preview' + c);
                        if (item)
                            item.title = items[c].description;
                    }
                }
                if (data.smell.length > 0 && data.smell != "0" && data.sound.length > 0 && data.sound != "0") {
                    this.$roomPreview.sound.style.display = 'block';
                    this.$roomPreview.smell.style.display = 'block';
                    this.$roomPreview.smell.textContent = data.smell;
                    this.$roomPreview.sound.textContent = data.sound;
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                }
                else if (data.smell.length > 0 && data.smell != "0") {
                    this.$roomPreview.sound.style.display = 'none';
                    this.$roomPreview.smell.style.display = 'block';
                    this.$roomPreview.smell.textContent = data.smell;
                    this.$roomPreview.sound.textContent = '';
                    this.$roomPreview.smell.appendChild(document.createElement('br'));
                    this.$roomPreview.smell.appendChild(document.createElement('br'));
                }
                else if (data.sound.length > 0 && data.sound != "0") {
                    this.$roomPreview.smell.style.display = 'none';
                    this.$roomPreview.sound.style.display = 'block';
                    this.$roomPreview.sound.textContent = data.sound;
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                }
                else {
                    this.$roomPreview.smell.style.display = 'none';
                    this.$roomPreview.sound.style.display = 'none';
                }
                e = room.exits | room.ee;
                if (e === RoomExit.None)
                    this.$roomPreview.exits.textContent = "There are no obvious exits.";
                else {
                    ex = []
                    for (var exit in RoomExits) {
                        if (!RoomExits.hasOwnProperty(exit)) continue;
                        if (!RoomExits[exit]) continue;
                        if ((e & RoomExits[exit]) === RoomExits[exit])
                            ex.push(exit);
                    }
                    if (ex.length === 1)
                        this.$roomPreview.exits.textContent = "There is one obvious exit: " + ex[0];
                    else {
                        var str = "There are " + Cardinal(ex.length) + " obvious exits: ";
                        str += ex.slice(0, -1).join(", ");
                        str += " and " + ex.pop();
                        this.$roomPreview.exits.textContent = str;
                    }
                }
            }
        }
    }

    private removeRaw(raw, line, count, nochanged?) {
        if (typeof (count) === "undefined") count = 1;
        var lines = raw.value.split("\n");
        if (line < 0 || line >= lines.length) return;
        lines.splice(line, count);
        raw.value = lines.join("\n");
        if (!nochanged) {
            this.changed = true;
            raw.dataset.dirty = 'true';
            raw.dataset.changed = 'true';
        }
    }

    private updateRaw(raw, line, str, nochanged?) {
        var lines = raw.value.split("\n");
        if (line < 0) return;
        for (var s = 0, sl = str.length; s < sl; s++)
            lines[line + s] = str[s];
        raw.value = lines.join("\n");
        if (!nochanged) {
            this.changed = true;
            raw.dataset.dirty = 'true';
            raw.dataset.changed = 'true';
        }
    }

    private BuildRooms() {
        Timer.start();
        var yl, xl, x = 0,
            y = 0,
            z = 0,
            zl, line, tline, sline;
        var dl, r, ry, s, sl, tl, rd, rt;
        var data = this.$mapRaw.value.split("\n");
        var tdata = this.$terrainRaw.value.split("\n");
        var sdata = this.$stateRaw.value.split("\n");
        var edata = this.$externalRaw.value.split("\n");
        var root = path.dirname(this.file);
        var ee = {};
        this.$rcount = 0;
        this.$maxTerrain = 0;
        this.$colorCache = 0;
        if (edata.length > 0) {
            for (x = 0, xl = edata.length; x < xl; x++) {
                line = edata[x].split(":");
                if (line.length > 2)
                    ee[line[0]] = line[1];
            }
        }

        this.$rooms = [];
        if (data.length > 0) {
            line = data.shift().split(" ");
            tline = tdata.shift().split(" ");
            sline = sdata.shift().split(" ");
            dl = data.length;
            sl = sdata.length;
            tl = tdata.length;
            if (line.length === 1) {
                xl = +line[0];
                yl = xl;
            }
            else if (line.length > 1) {
                xl = +line[0];
                yl = +line[1];
            }
            else
                xl = 0;
            if (line.length > 2)
                zl = +line[2];
            else
                zl = 1;
            this.$mapSize.width = xl;
            this.$mapSize.height = yl;
            this.$mapSize.depth = zl;
            this.$mapSize.right = this.$mapSize.width * 32;
            this.$mapSize.bottom = this.$mapSize.height * 32;
            var e, t, i;
            if (xl > 0 && yl > 0 && zl > 0) {
                var rooms = this.$rooms;
                var rcount = 0;
                var maxTerrain = 0;
                var cname;
                for (; z < zl; z++) {
                    if (!rooms[z]) rooms[z] = [];
                    for (y = 0; y < yl; y++) {
                        if (!rooms[z][y])
                            rooms[z][y] = [];
                        ry = rooms[z][y];
                        if (y + z * (yl + 1) < dl && data[y + z * (yl + 1)].length > 0)
                            line = data[y + z * (yl + 1)].split(" ");
                        else
                            line = [];

                        if (y + z * (yl + 1) < tl && tdata[y + z * (yl + 1)].length > 0)
                            tline = tdata[y + z * (yl + 1)].split(" ");
                        else
                            tline = [];

                        if (y + z * (yl + 1) < sl && sdata[y + z * (yl + 1)].length > 0)
                            sline = sdata[y + z * (yl + 1)].split(" ");
                        else
                            sline = [];

                        for (x = 0; x < xl; x++) {
                            if (x >= line.length)
                                r = new Room(x, y, z, e, 0, 0, 0);
                            else {
                                rd = line[x].split(":");
                                e = rd.length > 0 ? +rd[0] : 0;
                                t = rd.length > 1 ? +rd[1] : 0;
                                i = rd.length > 2 ? +rd[2] : t;
                                s = rd.length > 3 ? +rd[3] : 0;
                                if (x < tline.length) {
                                    rt = tline[x].split(":");
                                    t = rt.length > 0 ? +rt[0] : 0;
                                    i = rt.length > 1 ? +rt[1] : t;
                                    s = rt.length > 2 ? +rt[2] : 0;
                                }
                                if (x < sline.length)
                                    s = sline[x];
                                //x,y,z,e,t,i,s
                                r = new Room(x, y, z, e, t, i, s);
                                if (t > maxTerrain) maxTerrain = t;
                            }
                            if (this.$selectedRoom && this.$selectedRoom.at(r.x, r.y, r.z))
                                this.ChangeSelection(r);
                            cname = x + "," + y;
                            if (zl > 1)
                                cname += "," + z;
                            if (ee[cname])
                                r.ee |= RoomExits[ee[cname]];
                            r.ef = existsSync(path.join(root, cname + ".c"));
                            this.loadRoom(r);
                            ry.push(r);
                            if (r.exits) rcount++;
                        }
                    }
                }
                this.$rcount = rcount;
                this.$maxTerrain = maxTerrain;
            }
        }
        else {
            this.$mapSize = {
                width: 0,
                height: 0,
                depth: 0,
                right: 0,
                bottom: 0
            };
        }
        Timer.end('BuildRooms time');
        this.updateStatus();
    }

    private BuildMap() {
        Timer.start();
        if (this.$depth >= this.$mapSize.depth)
            this.$depth = this.$mapSize.depth - 1;
        if (this.$mapSize.right != this.$map.width || this.$map.height != this.$mapSize.bottom) {
            this.$map.width = this.$mapSize.right;
            this.$map.height = this.$mapSize.bottom;
            this.BuildAxises();
            this.DrawMap();
            setTimeout(() => {
                this.DrawMap();
            }, 500);
        }
        if (this.$mapSize.depth < 2) {
            this.$depth = 0;
        }
        else {
            this.$depthToolbar.value = '' + this.$depth;
            this.$depthToolbar.max = '' + (this.$mapSize.depth - 1);
            this.$depthToolbar.min = '' + 0;
        }
        this.emit('rebuild-buttons');
        Timer.end('BuildMap time');
    }

    private BuildAxises() {
        while (this.$xAxis.firstChild)
            this.$xAxis.removeChild(this.$xAxis.firstChild);
        while (this.$yAxis.firstChild)
            this.$yAxis.removeChild(this.$xAxis.firstChild);
        var frag = document.createDocumentFragment();
        var el: HTMLElement;
        this.$xAxisHighlight.style.height = '100%';
        this.$yAxisHighlight.style.width = '100%';
        for (var x = 0, xl = this.$mapSize.width; x < xl; x++) {
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
            })
            el.addEventListener('mouseout', (e) => {
                this.$xAxisHighlight.style.display = '';
            });
            frag.appendChild(el);
        }
        this.$xAxis.appendChild(frag);
        frag = document.createDocumentFragment();

        for (var y = 0, yl = this.$mapSize.height; y < yl; y++) {
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
            })
            el.addEventListener('mouseout', (e) => {
                this.$yAxisHighlight.style.display = '';
            });
            frag.appendChild(el);
        }
        this.$yAxis.appendChild(frag);
    }

    private loadDescriptions() {
        var tmp, idx, row, c, len, i, dl, rows;
        var data = this.$descriptionRaw.value.split("\n");
        dl = data.length;
        if (dl === 0) return;
        len = (dl / 3) >> 0;
        rows = [];

        for (c = 0; c < len; c++) {
            row = {
                idx: c,
                short: '',
                light: 0,
                terrain: '',
                long: '',
                sound: '',
                smell: ''
            };
            idx = c * 3;
            tmp = data[idx].split(":");
            row.short = tmp[0];
            if (tmp.length > 1) {
                i = +tmp[1];
                row.light = i !== i ? 0 : i;
            }
            if (tmp.length > 2)
                row.terrain = tmp[2];
            if (idx + 1 < dl)
                row.long = data[idx + 1];

            if (idx + 2 < dl) {
                tmp = data[idx + 2].split(':');
                if (tmp[0] !== '0')
                    row.smell = tmp[0];
                if (tmp.length > 1 && tmp[1] !== '0')
                    row.sound = tmp[1];
            }
            rows.push(row);
        }
        this.$descriptions = rows;
    }

    private loadItems() {
        var tmp, idx, row, c, len, tmp2, dl, i, il, rows;
        var data = this.$itemRaw.value.split("\n");
        dl = data.length;

        if (dl === 0) return;
        len = (dl / 2) >> 0;

        rows = [];
        for (c = 0; c < len; c++) {
            row = {
                idx: c,
                items: '',
                description: '',
                tag: c + 1
            };
            idx = c * 2;
            row.items = data[idx];
            if (idx + 1 < dl)
                row.description = data[idx + 1];
            tmp = row.items.split(":");
            tmp2 = row.description.split(":");
            if (tmp.length > 0) {
                row.children = [];
                for (i = 0, il = tmp.length; i < il; i++) {
                    if (i < tmp2.length)
                        row.children.push(
                            {
                                idx: '',
                                item: tmp[i],
                                description: tmp2[i],
                                tag: (c + 1) + "-" + i,
                                parentId: c + 1
                            });
                    else
                        row.children.push(
                            {
                                idx: '',
                                item: tmp[i],
                                description: '',
                                tag: (c + 1) + "-" + i,
                                parentId: c + 1
                            });
                }
            }
            rows.push(row);
        }
        this.$items = rows;
    }

    private loadExits() {
        var tmp, row, c, dl, rows, tmp2;
        var data = this.$externalRaw.value.split("\n");
        dl = data.length;
        if (dl === 0) return;
        rows = [];
        for (c = 0; c < dl; c++) {
            if (data[c].length === 0 || data[c].startsWith('#')) continue;
            row = {
                x: 0,
                y: 0,
                z: 0,
                exit: '',
                dest: ''
            };
            tmp = data[c].split(":");
            tmp2 = tmp[0].split(",");
            row.x = tmp2[0];
            if (tmp2.length > 1) row.y = tmp2[1];
            if (tmp2.length > 2) row.z = tmp2[2];
            if (tmp.length > 1) row.exit = tmp[1];
            if (tmp.length > 2) row.dest = tmp[2];
            rows.push(row);
        }
        this.$exits = rows;
    }

    private reloadExits() {
        var r
        var od = this.$exits || [];
        this.loadExits();
        //store mouse coords for performance
        var mx = this.$mouse.rx;
        var my = this.$mouse.ry;
        //Remove old exits
        for (var d = 0, dl = od.length; d < dl; d++) {
            r = this.getRoom(od[d].x, od[d].y, od[d].z);
            r.ee &= ~RoomExits[od[d].exit];
            this.DrawRoom(this.$mapContext, r, true, r.at(mx, my));
        }
        //Add new exits
        for (var d = 0, dl = this.$exits.length; d < dl; d++) {
            r = this.getRoom(this.$exits[d].x, this.$exits[d].y, this.$exits[d].z);
            r.ee |= RoomExits[this.$exits[d].exit];
            this.DrawRoom(this.$mapContext, r, true, r.at(mx, my));
        }
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
            r = this.$selectedRoom;
        //no room return empty string
        if (!r)
            return '';
        var t, c, cl, t2;
        var d;
        if (this.$mapSize.depth > 1)
            d = "/**\n * External virtual room " + r.x + ", " + r.y + ", " + r.z + "\n * \n * An external room for virtual area\n * \n * @author {your name}\n * @created {date}\n * @typeof include\n * @doc /doc/build/virtual/generic_virtual\n * @doc /doc/build/room/Basic\n */";
        else
            d = "/**\n * External virtual room " + r.x + ", " + r.y + "\n * \n * An external room for virtual area\n * \n * @author {your name}\n * @created {date}\n * @typeof include\n * @doc /doc/build/virtual/generic_virtual\n * @doc /doc/build/room/Basic\n */";
        d += "#include <std.h>\n#include \"../area.h\"\n\ninherit BASEROOM;\n\n/**\n * Create\n *\n * Create the base virtual room, passing correct parameters to baseroom\n */\nvoid create() {\n   ::create(" + r.x + ", " + r.y + ", " + r.z + ", " + r.terrain + ", " + r.item + ", " + r.exits + ");\n";
        var data;
        if (this.$descriptions.length > 0 && r.terrain >= 0 && r.terrain < this.$descriptions.length && this.$descriptions[r.terrain]) {
            data = this.$descriptions[r.terrain];
            if (data.light !== 0) {
                d += "   set_properties( ([\n      \"light\":" + data.light + "\n   ]) );\n";
            }
            d += "   set_short(\"" + data.short + "\");\n";
            d += "   set_long(\"";
            if (data.long.length > 68) {
                t = wordwrap(data.long, 68).trim().split("\n");
                for (c = 0, cl = t.length; c < cl; c++) {
                    if (c === 0)
                        d += t[c] + "\"\n";
                    else if (c === cl - 1)
                        d += "            \"" + t[c] + "\");\n";
                    else
                        d += "            \"" + t[c] + "\"\n";
                }
            }
            else
                d += data.long + "\");\n";
            if (data.terrain.length > 0 && data.terrain != "0")
                d += "   set_terrain(\"" + data.terrain + "\");\n";

            if (this.$items.length > 0 && r.item >= 0 && r.item < this.$items.length && this.$items[r.item] && this.$items[r.item].children.length > 0) {
                d += "   set_items( ([\n";
                var items = this.$items[r.item].children;
                for (c = 0, cl = items.length; c < cl; c++) {
                    t2 = "      \"" + items[c].items + "\":\"";
                    if (t2.length + items[c].description.length + 1 > 85) {
                        t = wordwrap(items[c].description, 80 - t2.length).trim().split("\n");
                        for (c = 0, cl = t.length; c < cl; c++) {
                            if (c === 0)
                                d += t[c] + "\"\n";
                            else if (c === cl - 1)
                                d += ("\"" + t[c] + "\",\n").padStart(t2.length - 1);
                            else
                                d += ("\"" + t[c] + "\"\n").padStart(t2.length - 1);
                        }
                    }
                    else {
                        d += t2 + items[c].description + "\",\n";
                    }
                }
                d += "   ]) );\n";
            }
            if (data.smell.length > 0 && data.smell != "0")
                d += "   set_smell(\"" + data.smell + "\");\n";
            if (data.sound.length > 0 && data.sound != "0")
                d += "   set_listen(\"" + data.sound + "\");\n";
        }
        if (RoomExit.None !== r.exits) {
            d += "   set_exits( ([\n";
            if (this.$mapSize.depth > 1) {
                if ((r.exits & RoomExit.Up) === RoomExit.Up)
                    d += "      \"up\":VIR+\"" + (r.x) + "," + (r.y) + "," + (r.z + 1) + ".c\",\n";
                if ((r.exits & RoomExit.Down) === RoomExit.Down)
                    d += "      \"down\":VIR+\"" + (r.x) + "," + (r.y) + "," + (r.z - 1) + ".c\",\n";
                t = "," + r.z;
            }
            else
                t = ""
            if ((r.exits & RoomExit.North) === RoomExit.North)
                d += "      \"north\":VIR+\"" + (r.x) + "," + (r.y - 1) + t + ".c\",\n";
            if ((r.exits & RoomExit.NorthWest) === RoomExit.NorthWest)
                d += "      \"northwest\":VIR+\"" + (r.x - 1) + "," + (r.y - 1) + t + ".c\",\n";
            if ((r.exits & RoomExit.NorthEast) === RoomExit.NorthEast)
                d += "      \"northeast\":VIR+\"" + (r.x + 1) + "," + (r.y - 1) + t + ".c\",\n";
            if ((r.exits & RoomExit.East) === RoomExit.East)
                d += "      \"east\":VIR+\"" + (r.x + 1) + "," + (r.y) + t + ".c\",\n";
            if ((r.exits & RoomExit.West) === RoomExit.West)
                d += "      \"west\":VIR+\"" + (r.x - 1) + "," + (r.y) + t + ".c\",\n";
            if ((r.exits & RoomExit.South) === RoomExit.South)
                d += "      \"south\":VIR+\"" + (r.x) + "," + (r.y + 1) + t + ".c\",\n";
            if ((r.exits & RoomExit.SouthEast) === RoomExit.SouthEast)
                d += "      \"southeast\":VIR+\"" + (r.x + 1) + "," + (r.y + 1) + t + ".c\",\n";
            if ((r.exits & RoomExit.SouthWest) === RoomExit.SouthWest)
                d += "      \"southwest\":VIR+\"" + (r.x - 1) + "," + (r.y + 1) + t + ".c\",\n";

            for (var ri = 0, rl = this.$exits.length; ri < rl; ri++) {
                if (+this.$exits[ri].x !== r.x || +this.$exits[ri].y !== r.y || +this.$exits[ri].z !== r.z)
                    continue;
                d += "      \"" + this.$exits[ri].exit + "\":\"" + this.$exits[ri].dest + "\",\n";
            }
            d += "   ]) );\n"
        }
        d += "}";
        return d;
    }

    private resetRawCursors() {
        resetCursor(this.$terrainRaw);
        resetCursor(this.$stateRaw);
        resetCursor(this.$descriptionRaw);
        resetCursor(this.$itemRaw);
        resetCursor(this.$externalRaw);
        resetCursor(this.$mapRaw);
    }
}

class TerrainValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $dropdown: HTMLElement;
    private $editor: HTMLInputElement;
    private $value;

    create() {
        this.$el = document.createElement('div');
        this.$el.classList.add('property-grid-editor-flag');
        this.$editor = document.createElement('input');
        this.$editor.type = 'text';
        this.$editor.classList.add('property-grid-editor');
        this.$editor.addEventListener('blur', (e) => {
            if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'dropdown') {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return;
            }
            this.grid.clearEditor();
        });
        this.$editor.addEventListener('focus', () => {
            this.$editor.select();
        })
        this.$editor.addEventListener('click', (e) => {
            this.$editor.dataset.aOpen = null;
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (e.keyCode === 27 || e.keyCode === 13) {
                this.$editor.blur();
                e.preventDefault();
            }
        });
        this.$el.appendChild(this.$editor);

        var vl = document.createElement('button');
        vl.title = 'Open editor...'
        vl.innerHTML = '<span class="caret"></span>';
        vl.dataset.editor = 'dropdown';
        vl.addEventListener('click', (e) => {
            if (this.$editor.dataset.aOpen == 'true') {
                this.$editor.dataset.aOpen = null;
                this.$editor.focus();
                resetCursor(this.$editor);
                return;
            }
            this.$dropdown = document.createElement('div');
            this.$dropdown.tabIndex = -1;
            this.$dropdown.classList.add('property-grid-editor-flag-dropdown');
            this.$dropdown.addEventListener('keyup', (e) => {
                if (e.keyCode === 27) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                }
                return;
            });
            var b = this.parent.getBoundingClientRect();
            if (b.width < 150) {
                this.$dropdown.style.left = (b.left - 150 + b.width) + 'px';
                this.$dropdown.style.width = '300px';
            }
            else {
                this.$dropdown.style.left = b.left + 'px';
                this.$dropdown.style.width = (b.width) + 'px';
            }
            this.$dropdown.style.top = (b.bottom) + 'px';
            this.$dropdown.style.zIndex = '100';
            this.$dropdown.style.position = 'absolute';
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            var terrains = [
                "beach",
                "dirtroad",
                "icesheet",
                "prairie",
                "stone",
                "bog",
                "farmland",
                "jungle",
                "river",
                "swamp",
                "city",
                "forest",
                "lake",
                "rockdesert",
                "tundra",
                "cliff",
                "grass",
                "mountain",
                "rocky",
                "underwater",
                "cobble",
                "grassland",
                "ocean",
                "sand",
                "water",
                "desert",
                "highmountain",
                "pavedroad",
                "sanddesert",
                "dirt",
                "hills",
                "plains",
                "savannah"
            ];
            var tl = terrains.length;
            var height = tl * 20;
            while (tl--) {
                var el = document.createElement('div');
                el.textContent = capitalize(terrains[tl]);
                el.addEventListener('click', (e) => {
                    this.value = (<HTMLElement>e.currentTarget).textContent.toLowerCase();
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                });
                this.$dropdown.appendChild(el);
            }
            if (height < 160) {
                this.$dropdown.style.height = height + 'px';
                this.$dropdown.style.overflow = 'hidden';
            }
            else
                this.$dropdown.style.height = '160px';
            document.body.appendChild(this.$dropdown);
            this.$dropdown.focus();
        });
        this.$el.appendChild(vl);
        this.parent.appendChild(this.$el);
    }
    focus() {
        this.$editor.focus();
        resetCursor(this.$editor);
    }
    destroy() {
        if (this.$dropdown && this.$dropdown.parentElement)
            this.$dropdown.parentElement.removeChild(this.$dropdown);
        if (this.$el.parentElement)
            this.$el.parentElement.removeChild(this.$el);
    }

    private $dropdownEvent = (e) => {
        if (e.relatedTarget && (<HTMLElement>e.relatedTarget).parentElement == this.$dropdown) {
            e.preventDefault();
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            return;
        }
        var ec = this.editorClick;
        this.$editor.dataset.aOpen = 'true';
        this.$dropdown.parentElement.removeChild(this.$dropdown);
        this.$dropdown = null;
        if (ec)
            this.grid.createEditor(ec);
        else {
            this.focus();
        }
    }

    get value() {
        return this.$editor.value;
    }
    set value(value: any) {
        this.$editor.value = value;
    }
}
/*
                    this.$editor.editor = document.createElement('div');
                    this.$editor.editor.classList.add('property-grid-editor-dropdown');
                    values = document.createElement('div')
                    values.classList.add('property-grid-editor-dropdown-container');
                    this.$editor.editor.appendChild(values);
                    this.$editor.editor.value = this.$object[prop];
                    var pEditor = document.createElement('textarea');
                    pEditor.classList.add('property-grid-editor');
                    pEditor.value = this.$object[prop];
                    pEditor.addEventListener('blur', (e) => {
                        if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'dropdown') {
                            e.preventDefault();
                            e.stopPropagation();
                            e.cancelBubble = true;
                            return;
                        }
                        this.$editor.editor.value = (<HTMLTextAreaElement>e.currentTarget).value;
                        this.clearEditor();
                    });
                    pEditor.addEventListener('click', (e) => {
                        pEditor.dataset.aOpen = null;
                    });
                    values.appendChild(pEditor);
                    vl = document.createElement('button');
                    vl.title = 'Open editor...'
                    //vl.innerHTML = '&hellip;';
                    vl.innerHTML = '<span class="caret"></span>';
                    vl.dataset.editor = 'dropdown';
                    var tEditor;
                    var editorData = this.$editor;
                    vl.addEventListener('click', (e) => {
                        var mDialog = <HTMLDialogElement>document.createElement('dialog');
                        mDialog.style.width = '500px';
                        mDialog.style.height = '300px';
                        mDialog.style.padding = '5px';
                        mDialog.addEventListener('close', () => {
                            if (mDialog.parentElement)
                                mDialog.parentElement.removeChild(mDialog);
                            pEditor.focus();
                        });
                        var header = document.createElement('div');
                        header.classList.add('dialog-header');
                        header.style.fontWeight = 'bold';
                        var button = document.createElement('button');
                        button.classList.add('close');
                        button.type = 'button';
                        button.dataset.dismiss = 'modal';
                        button.addEventListener('click', () => {
                            mDialog.close();
                            if (mDialog.parentElement)
                                mDialog.parentElement.removeChild(mDialog);
                            pEditor.focus();
                        })
                        button.innerHTML = '&times;';
                        header.appendChild(button);
                        var el = document.createElement('div');
                        el.style.paddingTop = '2px';
                        el.innerHTML = capitalize(this.$options[editorData.property].label || editorData.property) + '&hellip;';
                        header.appendChild(el);
                        mDialog.appendChild(header);
                        header = document.createElement('div');
                        header.classList.add('dialog-body');
                        header.style.paddingTop = '40px';
                        mDialog.appendChild(header);
                        el = document.createElement('div');
                        el.classList.add('form-group');
                        el.style.margin = '0';
                        el.style.position = 'absolute';
                        el.style.left = '5px';
                        el.style.right = '5px';
                        el.style.bottom = '60px';
                        el.style.top = '38px';
                        header.appendChild(el);
                        el.appendChild(tEditor);
                        header = document.createElement('div');
                        header.classList.add('dialog-footer');
                        mDialog.appendChild(header);
                        button = document.createElement('button');
                        button.style.cssFloat = 'right';
                        button.type = 'button';
                        button.classList.add('btn', 'btn-default');
                        button.addEventListener('click', () => {
                            mDialog.close();
                            if (mDialog.parentElement)
                                mDialog.parentElement.removeChild(mDialog);
                            pEditor.focus();
                        });
                        button.textContent = 'Cancel';
                        header.appendChild(button);
                        button = document.createElement('button');
                        button.style.cssFloat = 'right';
                        button.type = 'button';
                        button.classList.add('btn', 'btn-primary');
                        button.addEventListener('click', () => {
                            this.$editor = editorData;
                            this.$editor.editor.value = tEditor.value;
                            this.clearEditor();
                            mDialog.close();
                            if (mDialog.parentElement)
                                mDialog.parentElement.removeChild(mDialog);
                            pEditor.focus();
                        });
                        button.textContent = 'Ok';
                        header.appendChild(button);
                        document.body.appendChild(mDialog);
                        mDialog.showModal();
                    });
                    this.$editor.editor.focus = () => {
                        this.$editor.editor.children[0].children[0].focus();
                        resetCursor(this.$editor.editor.children[0].children[0]);
                    };
                    this.$editor.editor.appendChild(vl);
                    this.$editor.clear = () => {
                        if (tEditor && tEditor.parentElement)
                            tEditor.parentElement.removeChild(tEditor);
                    };
                    */