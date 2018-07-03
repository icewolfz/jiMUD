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

export enum UpdateType { none = 0, drawMap = 1, buildRooms = 2, buildMap = 4, resize = 8 }

export enum DescriptionOnDelete { leave = 0, end = 1, endPlusOne = 2, start = 3 }
export enum ItemOnDelete { leave = 0, end = 1 }

export enum RoomExit {
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

export enum RoomStates {
    NoAttack = 512,
    NoMagic = 256,
    Council = 128,
    Outdoors = 64,
    Indoors = 32,
    Water = 16,
    Hot = 8,
    Cold = 4,
    SinkingUp = 2,
    SinkingDown = 1,
    None = 0
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

export class Room {
    public exits = 0;
    public x = 0;
    public y = 0;
    public z = 0;
    public terrain = 0;
    public item = 0;
    public ee = 0;
    public state = 0;
    public ef = false;
    public climbs = 0;
    public external = null;

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
        const r = new Room(this.x, this.y, this.z, this.exits, this.terrain, this.item, this.state);
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
        if (this.x !== x) return false;
        if (this.y !== y) return false;
        if (z === undefined)
            return true;
        if (this.z !== z) return false;
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

const Timer = new DebugTimer();

export class VirtualEditor extends EditorBase {
    private $files;
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
    private $descriptionGrid: DataGrid;
    private $itemGrid: DataGrid;
    private $exitGrid: DataGrid;
    private _lastMouse: MouseEvent;
    private $enterMoveNext;
    private $enterMoveFirst;

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
    private _os;
    private _wMove;
    private _wUp;
    private _scrollTimer: NodeJS.Timer;
    private $resizer;
    private $resizerCache;
    private $observer: MutationObserver;

    private $mapSize;

    private $rooms: Room[][][];
    private $maxTerrain;
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

    private $colorCache;
    private $measure;

    private $depth;
    private $rcount;
    private $depthToolbar: HTMLInputElement;

    private $selectedRooms: Room[] = [];
    private $focusedRoom: Room;
    private $shiftRoom: Room;
    private $showTerrain: boolean = false;
    private $showColors: boolean = false;

    private $items;
    private $descriptions;
    private $exits;
    private $roomPreview;
    private $roomEditor;

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

    public descriptionOnDelete: DescriptionOnDelete = DescriptionOnDelete.endPlusOne;
    public itemOnDelete: ItemOnDelete = ItemOnDelete.end;

    public get ShowTerrain(): boolean {
        return this.$showTerrain;
    }

    public set ShowTerrain(value) {
        if (value === this.$showTerrain) return;
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
        if (value === this.$showColors) return;
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

    public get maxLevel() {
        if (!this.$mapSize) return 0;
        return this.$mapSize.depth;
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

    constructor(options?: VirtualEditorOptions) {
        super(options);
        if (options && options.options)
            this.options = options.options;
        else
            this.options = {
                showColors: false,
                showTerrain: false,
                rawFontSize: 16,
                rawFontFamily: 'Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace',
                rawFontWeight: 'normal',
                previewFontSize: 16,
                previewFontFamily: 'Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace',
                editorWidth: 200,
                previewHeight: 200,
                live: true,
                showRoomEditor: true,
                showRoomPreview: true,
                rawSpellcheck: false,
                descriptionOnDelete: DescriptionOnDelete.endPlusOne,
                itemOnDelete: ItemOnDelete.end,
                enterMoveNext: true,
                enterMoveFirst: true
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
        if (value !== super.changed) {
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
        let el: HTMLElement;
        //#region Create raw editors
        this.$label = document.createElement('div');
        this.$label.classList.add('virtual-editor-label');
        frag.appendChild(this.$label);
        this.$mapRaw = this.createRawControl(View.mapRaw);
        frag.appendChild(this.$mapRaw);
        this.$terrainRaw = this.createRawControl(View.terrainsRaw);
        frag.appendChild(this.$terrainRaw);
        this.$stateRaw = this.createRawControl(View.stateRaw);
        frag.appendChild(this.$stateRaw);
        this.$descriptionRaw = this.createRawControl(View.descriptionsRaw);
        frag.appendChild(this.$descriptionRaw);
        this.$itemRaw = this.createRawControl(View.itemsRaw);
        frag.appendChild(this.$itemRaw);
        this.$externalRaw = this.createRawControl(View.exitsRaw);
        frag.appendChild(this.$externalRaw);
        //#endregion
        //#region create datagrids
        el = document.createElement('div');
        el.classList.add('datagrid-standard');
        el.style.display = 'none';
        frag.appendChild(el);
        this.$descriptionGrid = new DataGrid(el);
        this.$descriptionGrid.enterMoveFirst = this.$enterMoveFirst;
        this.$descriptionGrid.enterMoveNext = this.$enterMoveNext;
        this.$descriptionGrid.clipboardPrefix = 'jiMUD/';
        this.$descriptionGrid.columns = [
            {
                label: 'Index',
                field: 'idx',
                width: 50,
                readonly: true,
                styleFormatter: (e) => {
                    let c = false;
                    const zl = this.$mapSize.depth;
                    const yl = this.$mapSize.height;
                    const xl = this.$mapSize.width;
                    rooms:
                    for (let z = 0; z < zl; z++)
                        for (let y = 0; y < yl; y++)
                            for (let x = 0; x < xl; x++) {
                                if (this.$rooms[z][y][x].terrain === e.dataIndex) {
                                    c = true;
                                    break rooms;
                                }
                            }
                    if (!c)
                        e.cell.classList.add('cell-unused-terrain');
                }
            },
            {
                label: 'Short',
                field: 'short',
                width: 250,
                editor: {
                    options: {
                        singleLine: true
                    }
                }
            },
            {
                label: 'Light',
                field: 'light',
                width: 50,
                editor: {
                    options: {
                        min: -15,
                        max: 15
                    }
                }
            },
            {
                label: 'Terrain',
                field: 'terrain',
                width: 125,
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
                        ]
                    }
                }
            },
            {
                label: 'Long',
                field: 'long',
                spring: true,
                width: 250,
                wrap: true,
                editor: {
                    options: {
                        wrap: true,
                        singleLine: true
                    }
                }
            },
            {
                label: 'Sound',
                field: 'sound',
                spring: true,
                width: 250,
                wrap: true,
                editor: {
                    options: {
                        wrap: true,
                        singleLine: true
                    }
                }
            },
            {
                label: 'Smell',
                field: 'smell',
                spring: true,
                width: 250,
                wrap: true,
                editor: {
                    options: {
                        wrap: true,
                        singleLine: true
                    }
                }
            }
        ];
        this.$descriptionGrid.on('delete', (e) => {
            if (dialog.showMessageBox(
                remote.getCurrentWindow(),
                {
                    type: 'warning',
                    title: 'Delete',
                    message: 'Delete terrain' + (this.$descriptionGrid.selectedCount > 1 ? 's' : '') + '?',
                    buttons: ['Yes', 'No'],
                    defaultId: 1
                })
                === 1)
                e.preventDefault = true;
            else {
                let l = e.data.length;
                e.data.sort((a, b) => {
                    if (a.data.idx > b.data.idx) return 1;
                    if (a.data.idx < b.data.idx) return -1;
                    return 0;
                });
                while (l--) {
                    const idx = e.data[l].data.idx;
                    const eIdx = this.$descriptions.length - 1;
                    //update the raw data
                    this.removeRaw(this.$descriptionRaw, idx * 3, 3, false, true);
                    this.removeRaw(this.$itemRaw, idx * 2, 2, false, true);
                    this.$items.splice(idx, 1);
                    this.reduceIdx(this.$descriptions, idx);
                    this.reduceIdx(this.$items, idx);
                    //store room lengths
                    const zl = this.$mapSize.depth;
                    const xl = this.$mapSize.width;
                    const yl = this.$mapSize.height;
                    //update rooms terrain/item indexes
                    this.$maxTerrain = 0;
                    for (let z = 0; z < zl; z++) {
                        for (let y = 0; y < yl; y++) {
                            for (let x = 0; x < xl; x++) {
                                const r = this.$rooms[z][y][x];
                                if (r.terrain === idx) {
                                    switch (this.descriptionOnDelete) {
                                        case DescriptionOnDelete.end:
                                            if (r.terrain === r.item)
                                                r.item = eIdx;
                                            r.terrain = eIdx;
                                            break;
                                        case DescriptionOnDelete.endPlusOne:
                                            if (r.terrain === r.item)
                                                r.item = eIdx + 1;
                                            r.terrain = eIdx + 1;
                                            break;
                                        case DescriptionOnDelete.start:
                                            if (r.terrain === r.item)
                                                r.item = 0;
                                            r.terrain = 0;
                                            break;
                                    }
                                }
                                else if (r.terrain && r.terrain > idx) {
                                    if (r.terrain === r.item)
                                        r.item--;
                                    r.terrain--;
                                }
                                if (r.terrain > this.$maxTerrain)
                                    this.$maxTerrain = r.terrain;
                            }
                        }
                    }
                }
                this.roomsChanged();
                //redraw map to update terrain changes
                this.doUpdate(UpdateType.drawMap);
                this.$itemGrid.refresh();
            }
        });

        this.$descriptionGrid.on('cut', (e) => {
            let l = e.data.length;
            e.data.sort((a, b) => {
                if (a.data.idx > b.data.idx) return 1;
                if (a.data.idx < b.data.idx) return -1;
                return 0;
            });
            while (l--) {
                const idx = e.data[l].data.idx;
                //update the raw data
                this.removeRaw(this.$descriptionRaw, idx * 3, 3, false, true);
                this.removeRaw(this.$itemRaw, idx * 2, 2, false, true);
                //add items to cut data so items travel
                e.data[l].items = this.$items[idx];
                this.$items.splice(idx, 1);
                this.reduceIdx(this.$descriptions, idx);
                this.reduceIdx(this.$items, idx);
                //store room lengths
                const zl = this.$mapSize.depth;
                const xl = this.$mapSize.width;
                const yl = this.$mapSize.height;
                //update rooms terrain/item indexes
                this.$maxTerrain = 0;
                for (let z = 0; z < zl; z++) {
                    for (let y = 0; y < yl; y++) {
                        for (let x = 0; x < xl; x++) {
                            const r = this.$rooms[z][y][x];
                            if (r.terrain && r.terrain >= idx) {
                                if (r.terrain === r.item)
                                    r.item--;
                                r.terrain--;
                            }
                            if (r.terrain > this.$maxTerrain)
                                this.$maxTerrain = r.terrain;
                        }
                    }
                }
            }
            this.roomsChanged();
            //redraw map to update terrain changes
            this.doUpdate(UpdateType.drawMap);
            this.$itemGrid.refresh();
            this.emit('supports-changed');
        });
        this.$descriptionGrid.on('copy', (e) => {
            const l = e.data.length;
            for (let d = 0; d < l; d++) {
                const idx = e.data[d].data.idx;
                //add item data as items go with terrain
                e.data[d].items = this.$items[idx];
            }
            this.emit('supports-changed');
        });
        this.$descriptionGrid.on('paste', (e) => {
            let idx = this.$descriptions.length;
            let all = false;
            let choice;
            const l = e.data.length;
            for (let d = 0; d < l; d++) {
                e.data[d].data.idx = idx;
                e.data[d].items.idx = idx;
                if (!all && idx < this.$items.length) {
                    choice = dialog.showMessageBox(
                        remote.getCurrentWindow(),
                        {
                            type: 'warning',
                            title: 'Replace items',
                            message: 'Replace old items with new?',
                            buttons: ['Yes', 'No', 'All'],
                            defaultId: 1
                        });
                    if (choice === 2)
                        all = true;
                    if (choice !== 1) {
                        this.$items[idx] = e.data[d].items;
                        this.updateRaw(this.$itemRaw, idx * 2, [
                            this.$items[idx].children.map(i => i.item).join(':'),
                            this.$items[idx].children.map(i => i.description).join(':')
                        ], false, true);
                    }
                }
                else {
                    this.$items[idx] = e.data[d].items;
                    this.updateRaw(this.$itemRaw, idx * 2, [
                        this.$items[idx].children.map(i => i.item).join(':'),
                        this.$items[idx].children.map(i => i.description).join(':')
                    ], false, true);
                }
                idx++;
            }
            this.$itemGrid.refresh();
            this.doUpdate(UpdateType.drawMap);
        });
        this.$descriptionGrid.on('add', e => {
            const idx = this.$descriptions.length;
            e.data = {
                idx: idx,
                short: '',
                light: 0,
                terrain: '',
                long: '',
                sound: '',
                smell: ''
            };
            this.updateRaw(this.$descriptionRaw, idx * 3, [':0:', '', '0:0'], false, true);
            if (idx >= this.$items.length) {
                let c = 0;
                while (idx >= this.$items.length) {
                    this.$items.push(
                        {
                            idx: idx + c,
                            items: '',
                            description: '',
                            tag: idx + c + 1
                        }
                    );
                    this.updateRaw(this.$itemRaw, (idx + c) * 2, ['', ''], false, true);
                    c++;
                }
            }
            this.$itemGrid.refresh();
            resetCursor(this.$terrainRaw);
        });
        this.$descriptionGrid.sort(0);
        this.$descriptionGrid.on('selection-changed', () => {
            if (this.$view !== View.terrains) return;
            if (this.$descriptionGrid.selectedCount) {
                this.$label.children[0].children[1].removeAttribute('disabled');
                this.$label.children[0].children[2].removeAttribute('disabled');
                this.$label.children[0].children[3].removeAttribute('disabled');
                if (this.$descriptionGrid.selectedCount > 1)
                    (<HTMLElement>this.$label.children[0].children[3]).title = 'Delete terrains';
                else
                    (<HTMLElement>this.$label.children[0].children[3]).title = 'Delete terrain';

                this.$label.children[1].children[0].removeAttribute('disabled');
                this.$label.children[1].children[1].removeAttribute('disabled');
            }
            else {
                this.$label.children[0].children[1].setAttribute('disabled', 'true');
                this.$label.children[0].children[2].setAttribute('disabled', 'true');
                this.$label.children[0].children[3].setAttribute('disabled', 'true');
                this.$label.children[1].children[0].setAttribute('disabled', 'true');
                this.$label.children[1].children[1].setAttribute('disabled', 'true');
                (<HTMLElement>this.$label.children[0].children[3]).title = 'Delete terrain(s)';
            }
            this.emit('selection-changed');
        });
        this.$descriptionGrid.on('value-changed', (newValue, oldValue, dataIndex) => {
            this.updateRaw(this.$descriptionRaw, newValue.idx * 3, [
                newValue.short + ':' + newValue.light + ':' + newValue.terrain,
                newValue.long,
                (newValue.smell.length > 0 ? newValue.smell : '0') + ':' + (newValue.sound.length > 0 ? newValue.sound : '0')
            ]);
        });
        el = document.createElement('div');
        el.classList.add('datagrid-standard');
        el.style.display = 'none';
        frag.appendChild(el);
        this.$itemGrid = new DataGrid(el);
        this.$itemGrid.enterMoveFirst = this.$enterMoveFirst;
        this.$itemGrid.enterMoveNext = this.$enterMoveNext;
        this.$itemGrid.clipboardPrefix = 'jiMUD/';
        this.$itemGrid.showChildren = true;
        this.$itemGrid.on('row-dblclick', (e, data) => {
            if (!data || data.parent === -1) {
                e.preventDefault();
                this.$itemGrid.toggleRows(data.rowIndex);
            }
        });
        this.$itemGrid.columns = [
            {
                label: 'Index',
                field: 'idx',
                width: 50,
                readonly: true,
                formatter: (data) => {
                    if (!data || data.parent !== -1) return '';
                    return data.cell;
                },
                tooltipFormatter: (data) => {
                    if (!data || data.parent !== -1) return '';
                    return data.cell;
                }
            }, {
                label: 'Item',
                field: 'item',
                sortable: false,
                width: 250,
                formatter: (data) => {
                    if (!data) return '';
                    if (data.parent === -1 && data.row.children)
                        return data.row.children.map((c) => c.item).join(':');
                    return data.cell || '';
                },
                tooltipFormatter: (data) => {
                    if (!data) return '';
                    if (data.parent === -1 && data.row.children)
                        return data.row.children.map((c) => c.item).join(':');
                    return data.cell || '';
                },
                editor: {
                    options: {
                        singleLine: true
                    }
                }
            }, {
                label: 'Description',
                field: 'description',
                width: 300,
                spring: true,
                sortable: false,
                formatter: (data) => {
                    if (!data) return '';
                    if (data.parent === -1 && data.row.children)
                        return data.row.children.map((c) => c.description).join(':');
                    return data.cell;
                },
                tooltipFormatter: (data) => {
                    if (!data) return '';
                    if (data.parent === -1 && data.row.children)
                        return data.row.children.map((c) => c.description).join(':');
                    return data.cell;
                }
            }
        ];
        this.$itemGrid.on('delete', (e) => {
            if (dialog.showMessageBox(
                remote.getCurrentWindow(),
                {
                    type: 'warning',
                    title: 'Delete',
                    message: 'Delete item' + (this.$itemGrid.selectedCount > 1 ? 's' : '') + '?',
                    buttons: ['Yes', 'No'],
                    defaultId: 1
                })
                === 1)
                e.preventDefault = true;
            else {
                const rows = e.data.filter(r => r.parent === -1).map(r => this.$items.indexOf(r.data));
                rows.sort();
                const children = e.data.filter(r => r.parent !== -1 && rows.indexOf(r.parent) === -1)
                    .map(r => r.parent)
                    .filter((value, index, self) => self.indexOf(value) === index);
                //do children first
                if (children.length > 0) {
                    let cl = children.length;
                    while (cl--) {
                        this.updateRaw(this.$itemRaw, children[cl] * 2, [
                            this.$items[children[cl]].children.map(i => i.item).join(':'),
                            this.$items[children[cl]].children.map(i => i.description).join(':')
                        ], false, true);
                    }
                }
                let rl = rows.length;
                while (rl--) {
                    if (this.itemOnDelete === ItemOnDelete.end) {
                        /*
                        - `Room terrain description on item delete` When an item group is deleted what should happen to the related terrain description
                          - `Leave` Leave it as it is
                          - `End` Shift the terrain description to the end of the descriptions
                        */
                    }
                    this.reduceIdx(this.$items, rows[rl]);
                    this.removeRaw(this.$itemRaw, rows[rl] * 2, 2, false, true);
                }
            }
        });
        this.$itemGrid.on('cut', (e) => {
            const rows = e.data.filter(r => r.parent === -1).map(r => this.$items.indexOf(r.data));
            rows.sort();
            let rl = rows.length;
            while (rl--) {
                this.reduceIdx(this.$items, rows[rl]);
                this.removeRaw(this.$itemRaw, rows[rl] * 2, 2, false, true);
            }
            this.emit('supports-changed');
        });
        this.$itemGrid.on('copy', () => {
            this.emit('supports-changed');
        });
        this.$itemGrid.on('paste', (e) => {
            let idx = this.$items.length;
            const l = e.data.length;
            for (let d = 0; d < l; d++) {
                if (e.data[d].parent !== -1) continue;
                e.data[d].data.idx = idx;
                this.updateRaw(this.$itemRaw, idx * 2, [
                    e.data[d].data.children.map(i => i.item).join(':'),
                    e.data[d].data.children.map(i => i.description).join(':')
                ], false, true);
                idx++;
            }
        });
        this.$itemGrid.on('contextmenu', e => {
            if (e.srcElement && e.editor) {
                const row = e.srcElement.closest('tr.datagrid-row');
                if (row === e.editor.el && !e.srcElement.classList.contains('datagrid-cell'))
                    return;
            }
            e.preventDefault();
            const temp = [];
            temp.push({
                label: 'Add group',
                click: () => {
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
                }
            });
            if (this.$itemGrid.selectedCount > 0) {
                temp.push({ type: 'separator' });
                const sc = this.$itemGrid.selected;
                temp.push({
                    label: 'Add',
                    click: () => {
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
                    }
                });
                if (sc.filter(r => r.parent !== -1).length > 0)
                    temp.push({
                        label: 'Edit',
                        click: () => {
                            const sl = this.$itemGrid.selectedCount;
                            const selected = this.$itemGrid.selected;
                            for (let s = 0; s < sl; s++) {
                                if (selected[s].parent !== -1) {
                                    this.$itemGrid.focus();
                                    this.$itemGrid.beginEditChild(selected[s].parent, selected[s].child);
                                    break;
                                }
                            }
                        }
                    });

                temp.push({ type: 'separator' });
                temp.push({
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    click: () => {
                        this.$itemGrid.cut();
                    }
                });
                temp.push({
                    label: 'Copy',
                    click: () => {
                        this.$itemGrid.copy();
                    },
                    accelerator: 'CmdOrCtrl+C'
                });
            }
            if (this.$itemGrid.canPaste) {
                if (temp.length === 1)
                    temp.push({ type: 'separator' });
                temp.push({
                    label: 'Paste',
                    click: () => {
                        this.$itemGrid.paste();
                    },
                    accelerator: 'CmdOrCtrl+V'
                });
            }
            if (this.$itemGrid.selectedCount > 0) {
                if (temp.length > 0)
                    temp.push({ type: 'separator' });
                temp.push({
                    label: 'Delete',
                    click: () => {
                        this.$itemGrid.delete();
                    },
                    accelerator: 'Delete'
                });
            }
            if (this.$items.length > 0) {
                if (temp.length > 0)
                    temp.push({ type: 'separator' });
                temp.push({
                    label: 'Select all',
                    click: () => {
                        this.$itemGrid.selectAll();
                    },
                    accelerator: 'CmdOrCtrl+A'
                });
            }
            if (temp.length === 0) return;
            const inputMenu = Menu.buildFromTemplate(temp);
            inputMenu.popup({ window: remote.getCurrentWindow() });
        });
        this.$itemGrid.on('add', e => e.preventDefault = true);
        this.$itemGrid.on('selection-changed', () => {
            if (this.$view !== View.items) return;
            if (this.$itemGrid.selectedCount) {
                const selected = this.$itemGrid.selected;
                this.$label.children[0].children[1].removeAttribute('disabled');
                this.$label.children[0].children[2].removeAttribute('disabled');
                if (selected.filter(r => r.parent !== -1).length > 0)
                    this.$label.children[0].children[3].removeAttribute('disabled');
                else
                    this.$label.children[0].children[3].setAttribute('disabled', 'true');

                this.$label.children[0].children[4].removeAttribute('disabled');
                if (this.$itemGrid.selectedCount > 1)
                    (<HTMLElement>this.$label.children[0].children[4]).title = 'Delete items';
                else
                    (<HTMLElement>this.$label.children[0].children[4]).title = 'Delete item';

                this.$label.children[1].children[0].removeAttribute('disabled');
                this.$label.children[1].children[1].removeAttribute('disabled');
            }
            else {
                this.$label.children[0].children[1].setAttribute('disabled', 'true');
                this.$label.children[0].children[2].setAttribute('disabled', 'true');
                this.$label.children[0].children[3].setAttribute('disabled', 'true');
                this.$label.children[0].children[4].setAttribute('disabled', 'true');
                this.$label.children[1].children[0].setAttribute('disabled', 'true');
                this.$label.children[1].children[1].setAttribute('disabled', 'true');
                (<HTMLElement>this.$label.children[0].children[4]).title = 'Delete item(s)';
            }
            this.emit('selection-changed');
        });
        this.$itemGrid.on('value-changed', (newValue, oldValue, dataIndex) => {
            const item = this.$items[newValue.parentId];
            this.updateRaw(this.$itemRaw, item.idx * 2, [
                item.children.map(i => i.item).join(':'),
                item.children.map(i => i.description).join(':')
            ], false, true);
        });
        this.$itemGrid.sort(0);
        el = document.createElement('div');
        el.classList.add('datagrid-standard');
        el.style.display = 'none';
        frag.appendChild(el);
        this.$exitGrid = new DataGrid(el);
        this.$exitGrid.enterMoveFirst = this.$enterMoveFirst;
        this.$exitGrid.enterMoveNext = this.$enterMoveNext;
        this.$exitGrid.on('browse-file', e => {
            this.emit('browse-file', e);
        });
        this.$exitGrid.clipboardPrefix = 'jiMUD/';
        this.$exitGrid.columns = [
            {
                label: 'Enabled',
                field: 'enabled'
            },
            {
                label: 'X',
                field: 'x'
            },
            {
                label: 'Y',
                field: 'y'
            },
            {
                label: 'Z',
                field: 'z',
                visible: false
            },
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
                    show: (prop, value, object) => {
                        return value;
                    }
                }
            }
        ];
        this.$exitGrid.on('cut', (e) => {
            const d = e.dataIndexes.sort((a, b) => {
                if (a > b) return 1;
                if (a < b) return -1;
                return 0;
            });
            let dl = d.length;
            let r;
            //store mouse coords for performance
            const mx = this.$mouse.rx;
            const my = this.$mouse.ry;
            let sr = false;
            while (dl--) {
                this.removeRaw(this.$externalRaw, d[dl], 1);
                if (!this.$exits[d[dl]].enabled) continue;
                r = this.getRoom(this.$exits[d[dl]].x, this.$exits[d[dl]].y, this.$exits[d[dl]].z);
                r.ee &= ~RoomExits[this.$exits[d[dl]].exit];
                this.DrawRoom(this.$mapContext, r, true, r.at(mx, my));
                if (this.selectedFocusedRoom && this.selectedFocusedRoom.at(this.$exits[d[dl]].x, this.$exits[d[dl]].y, this.$exits[d[dl]].z))
                    sr = true;
            }
            if (sr) {
                this.UpdateEditor(this.$selectedRooms);
                this.UpdatePreview(this.selectedFocusedRoom);
            }
            resetCursor(this.$externalRaw);
            this.emit('supports-changed');
        });
        this.$exitGrid.on('copy', () => {
            this.emit('supports-changed');
        });
        this.$exitGrid.on('paste', (e) => {
            let nExternal;
            if (this.$mapSize.depth > 1)
                nExternal = e.data.map(d => (d.data.enabled ? '' : '#') + d.data.x + ',' + d.data.y + ',' + d.data.z + ':' + d.data.exit + ':' + d.data.dest);
            else
                nExternal = e.data.map(d => (d.data.enabled ? '' : '#') + d.data.x + ',' + d.data.y + ':' + d.data.exit + ':' + d.data.dest);
            this.updateRaw(this.$externalRaw, this.$exits.length, nExternal);
            resetCursor(this.$externalRaw);
            //store mouse coords for performance
            const mx = this.$mouse.rx;
            const my = this.$mouse.ry;
            //Remove old exits
            let r;
            let ex = 0;
            const elen = e.data.length;
            let sr = false;
            for (; ex < elen; ex++) {
                //Add new exits
                const exit = e.data[ex].data;
                if (!exit.enabled) continue;
                r = this.getRoom(exit.x, exit.y, exit.z);
                r.ee |= RoomExits[exit.exit];
                this.DrawRoom(this.$mapContext, r, true, r.at(mx, my));
                if (this.selectedFocusedRoom && this.selectedFocusedRoom.at(exit.x, exit.y, exit.z))
                    sr = true;
            }
            if (sr) {
                this.UpdateEditor(this.$selectedRooms);
                this.UpdatePreview(this.selectedFocusedRoom);
            }
        });
        this.$exitGrid.on('delete', (e) => {
            if (dialog.showMessageBox(
                remote.getCurrentWindow(),
                {
                    type: 'warning',
                    title: 'Delete',
                    message: 'Delete selected exit' + (this.$exitGrid.selectedCount > 1 ? 's' : '') + '?',
                    buttons: ['Yes', 'No'],
                    defaultId: 1
                })
                === 1)
                e.preventDefault = true;
            else {
                const d = e.data.map(di => di.dataIndex).sort((a, b) => {
                    if (a > b) return 1;
                    if (a < b) return -1;
                    return 0;
                });
                let dl = d.length;
                let r;
                let sr = false;
                //store mouse coords for performance
                const mx = this.$mouse.rx;
                const my = this.$mouse.ry;
                while (dl--) {
                    this.removeRaw(this.$externalRaw, d[dl], 1);
                    if (!this.$exits[d[dl]].enabled) continue;
                    r = this.getRoom(this.$exits[d[dl]].x, this.$exits[d[dl]].y, this.$exits[d[dl]].z);
                    r.ee &= ~RoomExits[this.$exits[d[dl]].exit];
                    this.DrawRoom(this.$mapContext, r, true, r.at(mx, my));
                    if (this.selectedFocusedRoom && this.selectedFocusedRoom.at(this.$exits[d[dl]].x, this.$exits[d[dl]].y, this.$exits[d[dl]].z))
                        sr = true;
                }
                if (sr) {
                    this.UpdateEditor(this.$selectedRooms);
                    this.UpdatePreview(this.selectedFocusedRoom);
                }
                resetCursor(this.$externalRaw);
            }
        });
        this.$exitGrid.on('add', e => {
            e.data = {
                enabled: true,
                x: 0,
                y: 0,
                z: 0,
                exit: '',
                dest: ''
            };
            if (this.$mapSize.depth > 1)
                this.updateRaw(this.$externalRaw, this.$exits.length - 1, ['0,0,0::']);
            else
                this.updateRaw(this.$externalRaw, this.$exits.length - 1, ['0,0::']);
            resetCursor(this.$externalRaw);
        });
        this.$exitGrid.on('selection-changed', () => {
            if (this.$view !== View.exits) return;
            if (this.$exitGrid.selectedCount) {
                this.$label.children[0].children[1].removeAttribute('disabled');
                this.$label.children[0].children[2].removeAttribute('disabled');
                if (this.$exitGrid.selectedCount > 1)
                    (<HTMLElement>this.$label.children[0].children[2]).title = 'Delete exits';
                else
                    (<HTMLElement>this.$label.children[0].children[2]).title = 'Delete exit';
            }
            else {
                this.$label.children[0].children[1].setAttribute('disabled', 'true');
                this.$label.children[0].children[2].setAttribute('disabled', 'true');
                (<HTMLElement>this.$label.children[0].children[2]).title = 'Delete exit(s)';
            }
            this.emit('selection-changed');
        });
        this.$exitGrid.on('value-changed', (newValue, oldValue, dataIndex) => {
            if (this.$mapSize.depth > 1)
                this.updateRaw(this.$externalRaw, dataIndex, [(newValue.enabled ? '' : '#') + newValue.x + ',' + newValue.y + ',' + newValue.z + ':' + newValue.exit + ':' + newValue.dest]);
            else
                this.updateRaw(this.$externalRaw, dataIndex, [(newValue.enabled ? '' : '#') + newValue.x + ',' + newValue.y + ':' + newValue.exit + ':' + newValue.dest]);
            resetCursor(this.$externalRaw);
            //store mouse coords for performance
            const mx = this.$mouse.rx;
            const my = this.$mouse.ry;
            //Remove old exits
            let r;
            if (oldValue.enabled) {
                r = this.getRoom(oldValue.x, oldValue.y, oldValue.z);
                if (!r.ef) {
                    r.ee &= ~RoomExits[oldValue.exit];
                    this.DrawRoom(this.$mapContext, r, true, r.at(mx, my));
                    if (this.selectedFocusedRoom && this.selectedFocusedRoom.at(oldValue.x, oldValue.y, oldValue.z)) {
                        this.UpdateEditor(this.$selectedRooms);
                        this.UpdatePreview(this.selectedFocusedRoom);
                    }
                }
            }
            //Add new exits
            if (newValue.enabled) {
                r = this.getRoom(oldValue.x, oldValue.y, oldValue.z);
                if (!r.ef) {
                    r.ee |= RoomExits[newValue.exit];
                    this.DrawRoom(this.$mapContext, r, true, r.at(mx, my));
                    if (this.selectedFocusedRoom && this.selectedFocusedRoom.at(newValue.x, newValue.y, newValue.z)) {
                        this.UpdateEditor(this.$selectedRooms);
                        this.UpdatePreview(this.selectedFocusedRoom);
                    }
                }
            }
        });
        this.$exitGrid.sort(1);
        //#endregion
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
            let o;
            if (room) {
                o = room.clone();
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
                    o.terrain = -1;
                    o.external = [];
                }
                else {
                    if (o.item < this.$items.length && o.item >= 0 && this.$items[o.item])
                        o.items = this.$items[o.item].children.slice();
                    else
                        o.items = [];
                    if (o.terrain < this.$descriptions.length && o.terrain >= 0 && this.$descriptions[o.terrain]) {
                        o.short = this.$descriptions[o.terrain].short;
                        o.long = this.$descriptions[o.terrain].long;
                        o.light = this.$descriptions[o.terrain].light;
                        o.terrainType = this.$descriptions[o.terrain].terrain;
                        o.sound = this.$descriptions[o.terrain].sound;
                        o.smell = this.$descriptions[o.terrain].smell;
                    }
                    else {
                        o.short = '';
                        o.long = '';
                        o.light = 0;
                        o.terrainType = '';
                        o.sound = '';
                        o.smell = '';
                    }
                    o.external = this.$exits.filter(ex => ex.x === o.x && ex.y === o.y && ex.z === o.z).map(a => ({ ...a }));
                }
            }
            const ec = { room: o, preventDefault: false, size: this.$mapSize };
            this.emit('map-context-menu', ec);
            this.setFocusedRoom(this.$mouse.rx, this.$mouse.ry);
            //if (e.preventDefault) return;
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
                                this.DrawRoom(this.$mapContext, this.$rooms[this.$depth][sf.y + 1][u], true);
                            for (let u = x; u < width; u++)
                                this.DrawRoom(this.$mapContext, this.$rooms[this.$depth][sf.y][u], true);
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
                        if (y < this.$mapSize.height - 1) {
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
                                this.DrawRoom(this.$mapContext, this.$rooms[this.$depth][sf.y - 1][u], true);
                            for (let u = x; u < width; u++)
                                this.DrawRoom(this.$mapContext, this.$rooms[this.$depth][sf.y][u], true);
                        }
                        this.$shiftRoom = sf;
                    }
                    else if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    else if (y < this.$mapSize.height - 1) {
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
                                this.DrawRoom(this.$mapContext, this.$rooms[this.$depth][u][sf.x + 1], true);
                            for (let u = y; u < height; u++)
                                this.DrawRoom(this.$mapContext, this.$rooms[this.$depth][u][sf.x], true);
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
                        if (x < this.$mapSize.width - 1) {
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
                                this.DrawRoom(this.$mapContext, this.$rooms[this.$depth][u][sf.x - 1], true);
                            for (let u = y; u < height; u++)
                                this.DrawRoom(this.$mapContext, this.$rooms[this.$depth][u][sf.x], true);
                        }
                        this.$shiftRoom = sf;
                    }
                    else if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                        this.setFocusedRoom(this.selectedRoom);
                    }
                    else if (x < this.$mapSize.width - 1) {
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
                        if (sR.ef) continue;
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
                                if (x < this.$mapSize.width - 1)
                                    sR.exits |= RoomExit.NorthEast;
                            }
                            if (y < this.$mapSize.height - 1) {
                                sR.exits |= RoomExit.South;
                                if (x > 0)
                                    sR.exits |= RoomExit.SouthWest;
                                if (x < this.$mapSize.width - 1)
                                    sR.exits |= RoomExit.SouthEast;
                            }
                            if (x > 0)
                                sR.exits |= RoomExit.West;
                            if (x < this.$mapSize.width - 1)
                                sR.exits |= RoomExit.East;
                        }
                        else {
                            sR.exits = 0;
                            sR.terrain = 0;
                            sR.item = 0;
                            this.$descriptionGrid.refresh();
                        }
                        if (!e.ctrlKey && sR.ee !== RoomExit.None) {
                            let nExternal = this.$exits.filter(ex => ex.x !== or.x || ex.y !== or.y || ex.z !== or.z);
                            this.$exits = nExternal;
                            this.$exitGrid.rows = this.$exits;
                            if (this.$mapSize.depth > 1)
                                nExternal = nExternal.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ',' + d.z + ':' + d.exit + ':' + d.dest);
                            else
                                nExternal = nExternal.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ':' + d.exit + ':' + d.dest);
                            this.$externalRaw.value = '';
                            this.updateRaw(this.$externalRaw, 0, nExternal);
                            resetCursor(this.$externalRaw);
                            sR.ee = RoomExit.None;
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
                        if (y < this.$mapSize.height - 1 && x < this.$mapSize.width - 1 && (e.ctrlKey || (o & RoomExit.SouthEast) === RoomExit.SouthEast)) {
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
                    }
                    event.preventDefault();
                    break;
                case 97: //num1
                    if (this.$selectedRooms.length === 0) {
                        this.$selectedRooms.push(this.getRoom(0, 0));
                        this.ChangeSelection();
                    }
                    else if (y < this.$mapSize.height - 1 && x > 0 && !this.selectedFocusedRoom.ef) {
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
                    else if (y < this.$mapSize.height - 1 && !this.selectedFocusedRoom.ef) {
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
                    else if (y < this.$mapSize.height - 1 && x < this.$mapSize.width - 1 && !this.selectedFocusedRoom.ef) {
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
                    else if (x > 0 && !this.selectedFocusedRoom.ef) {
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
                    else if (x < this.$mapSize.width - 1 && !this.selectedFocusedRoom.ef) {
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
                    else if (x > 0 && y > 0 && !this.selectedFocusedRoom.ef) {
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
                    else if (y > 0 && !this.selectedFocusedRoom.ef) {
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
                    else if (x < this.$mapSize.width - 1 && y > 0 && !this.selectedFocusedRoom.ef) {
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
                    if (this.$selectedRooms.length === 0)
                        return;
                    sl = this.$selectedRooms.length;
                    while (sl--) {
                        or = this.$selectedRooms[sl].clone();
                        if (this.$selectedRooms[sl].item === this.$selectedRooms[sl].terrain)
                            this.$selectedRooms[sl].item++;
                        this.$selectedRooms[sl].terrain++;
                        this.$descriptionGrid.refresh();
                        if (this.$selectedRooms[sl].terrain > this.$maxTerrain)
                            this.updateMaxTerrain(this.$selectedRooms[sl].terrain);
                        else
                            this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, false);
                        this.RoomChanged(this.$selectedRooms[sl], or);
                    }
                    break;
                case 109: //-
                    if (this.$selectedRooms.length === 0)
                        return;
                    sl = this.$selectedRooms.length;
                    while (sl--) {
                        or = this.$selectedRooms[sl].clone();
                        if (this.$selectedRooms[sl].item === this.$selectedRooms[sl].terrain) {
                            this.$selectedRooms[sl].item--;
                            if (this.$selectedRooms[sl].item < 0)
                                this.$selectedRooms[sl].item = 0;
                        }
                        this.$selectedRooms[sl].terrain--;
                        if (this.$selectedRooms[sl].terrain < 0)
                            this.$selectedRooms[sl].terrain = 0;
                        this.$descriptionGrid.refresh();
                        this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, false);
                        this.RoomChanged(this.$selectedRooms[sl], or);
                    }
                    break;
                case 111: // / up
                    if (this.$selectedRooms.length === 0 || this.selectedFocusedRoom.ef)
                        return;
                    if (this.$depth + 1 < this.$mapSize.depth) {
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
                    if (this.$selectedRooms.length === 0 || this.selectedFocusedRoom.ef)
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
        this.$roomEditor.on('open-file', (property) => {
            let f;
            if (this.$mapSize.depth > 1)
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
                let data;
                switch (prop) {
                    case 'external':
                        let nExternal = this.$exits.filter(e => e.x !== old.x || e.y !== old.y || e.z !== old.z);
                        curr.ee = newValue.map(e => e.enabled ? RoomExits[e.exit.toLowerCase()] : 0).reduce((a, c) => a | c);
                        nExternal = nExternal.concat(newValue);
                        this.$exits = nExternal;
                        this.$exitGrid.rows = this.$exits;
                        if (this.$mapSize.depth > 1)
                            nExternal = nExternal.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ',' + d.z + ':' + d.exit + ':' + d.dest);
                        else
                            nExternal = nExternal.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ':' + d.exit + ':' + d.dest);
                        this.$externalRaw.value = '';
                        this.updateRaw(this.$externalRaw, 0, nExternal);
                        this.DrawRoom(this.$mapContext, this.selectedFocusedRoom, true, this.selectedFocusedRoom.at(this.$mouse.rx, this.$mouse.ry));
                        resetCursor(this.$externalRaw);
                        break;
                    case 'ee':
                    case 'ef':
                        break;
                    case 'items':
                        this.$items[first.item].children = newValue;
                        this.$itemGrid.rows = this.$items;
                        this.updateRaw(this.$itemRaw, this.selectedFocusedRoom.item * 2, [
                            newValue.map(i => i.item).join(':'),
                            newValue.map(i => i.description).join(':')
                        ]);
                        resetCursor(this.$itemRaw);
                        this.$selectedRooms.forEach(r => {
                            if (first.terrain === first.item)
                                r.terrain = first.terrain;
                            r.item = first.item;
                        });
                        break items;
                    case 'terrainType':
                    case 'short':
                    case 'long':
                    case 'light':
                    case 'sound':
                    case 'smell':
                        if (prop === 'terrainType')
                            prop = 'terrain';
                        selected.forEach(r => {
                            if (first.terrain === first.item)
                                r.item = first.item;
                            r.terrain = first.terrain;
                        });
                        //invalid index
                        if (first.terrain < 0) break items;
                        //get current data and if none set defaults and assign to the index
                        data = this.$descriptions[this.selectedFocusedRoom.terrain];
                        if (!data) {
                            data = {
                                idx: this.selectedFocusedRoom.terrain,
                                short: '',
                                light: 0,
                                terrain: '',
                                long: '',
                                sound: '',
                                smell: ''
                            };
                        }
                        data[prop] = newValue;
                        //update the object data
                        this.$descriptions[this.selectedFocusedRoom.terrain] = data;
                        //update the file data
                        this.updateRaw(this.$descriptionRaw, data.idx * 3, [
                            data.short + ':' + data.light + ':' + data.terrain,
                            data.long,
                            (data.smell.length > 0 ? data.smell : '0') + ':' + (data.sound.length > 0 ? data.sound : '0')
                        ]);
                        resetCursor(this.$descriptionRaw);
                        break items;
                    case 'terrain':
                        if (first.item === oldValue)
                            curr.item = newValue;
                        curr[prop] = newValue;
                        //new high terrain, clear cache and redraw whole map as colors should have shifted
                        if (newValue > this.$maxTerrain)
                            this.updateMaxTerrain(newValue);
                        else //else just redraw the current room
                            this.DrawRoom(this.$mapContext, curr, true, curr.at(this.$mouse.rx, this.$mouse.ry));
                        this.RoomChanged(curr, old, true);
                        if (curr.item === newValue)
                            old.item = newValue;
                        old[prop] = newValue;
                        break;
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
                property: 'ee',
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
                        enterMoveNext: this.$enterMoveNext
                    }
                }
            },
            {
                property: 'ef',
                label: 'External file',
                sort: 6,
                formatter: this.formatEF,
                editor: {
                    type: EditorType.custom,
                    editor: FileOpenValueEditor,
                    show: (prop, value, object) => {
                        return value;
                    }
                }
            },
            {
                property: 'terrain',
                label: 'Terrain index',
                editor: {
                    options: {
                        min: 0
                    }
                },
                sort: 0
            },
            {
                property: 'item',
                label: 'Item index',
                editor: {
                    options: {
                        min: 0
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
                        enterMoveNext: this.$enterMoveNext
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
                property: 'terrainType',
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
            }
        ]);
        this.resize();
        this.$resizer = new ResizeObserver((entries, observer) => {
            if (entries.length === 0) return;
            if (entries[0].width === 0 || entries[0].height === 0)
                return;
            if (!this.$resizerCache || this.$resizerCache.width !== entries[0].width || this.$resizerCache.height !== entries[0].height) {
                this.$resizerCache = { width: entries[0].width, height: entries[0].height };
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
        if (!data || data.length === 0) return 'None';
        const ee = data[0].ee;
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

    private formatEF(prop, value, object) {
        if (!object || object.length === 0 || !value) return 'None';
        if (this.$mapSize > 1)
            return object[0].x + ',' + object[0].y + ',' + object[0].z + '.c';
        return object[0].x + ',' + object[0].y + '.c';
    }

    private createRawControl(view) {
        const el = document.createElement('textarea');
        el.classList.add('raw');
        el.addEventListener('select', (e) => {
            if (this.$view === view)
                this.emit('selection-changed');
        });
        el.addEventListener('change', (e) => {
            this.changed = true;
            (<HTMLElement>e.currentTarget).dataset.dirty = 'true';
            (<HTMLElement>e.currentTarget).dataset.changed = 'true';
            if (this.$view === view)
                this.emit('changed', el.value.length);
        });
        el.addEventListener('input', (e) => {
            this.changed = true;
            (<HTMLElement>e.currentTarget).dataset.dirty = 'true';
            (<HTMLElement>e.currentTarget).dataset.changed = 'true';
            if (this.$view === view)
                this.emit('changed', el.value.length);
        });
        el.addEventListener('paste', (e) => {
            this.changed = true;
            (<HTMLElement>e.currentTarget).dataset.dirty = 'true';
            (<HTMLElement>e.currentTarget).dataset.changed = 'true';
            if (this.$view === view)
                this.emit('changed', el.value.length);
        });
        el.addEventListener('cut', (e) => {
            this.changed = true;
            (<HTMLElement>e.currentTarget).dataset.dirty = 'true';
            (<HTMLElement>e.currentTarget).dataset.changed = 'true';
            if (this.$view === view)
                this.emit('changed', el.value.length);
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
        const base = path.basename(file);
        this.$files[base] = existsSync(file);
        if (this.$files[base])
            raw.value = this.read(file);
        else
            raw.value = this.$startValues[base] || '';
        raw.dataset.changed = null;
        this.changed = this.$mapRaw.dataset.changed === 'true' ||
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
        const root = path.dirname(this.file);
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
            this.emit('opened', file);
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
        this.emit('watch', [root]);
        this.doUpdate(UpdateType.buildRooms | UpdateType.buildMap);
        this.loadDescriptions();
        this.loadItems();
        this.loadExits();
        this.resetRawCursors();
        this.emit('opened', file);
        this.state |= FileState.opened;
        this.changed = false;
        this.clearRawChanged();
    }

    public save() {
        this.$saving[this.filename] = true;
        this.write(this.$mapRaw.value);
        const root = path.dirname(this.file);

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

    public upload(remoteFile?) {
        remoteFile = remoteFile || this.remote;
        if (!remoteFile || remoteFile.length === 0) return;
        const files = [];
        const remoteRoot = path.dirname(remoteFile);
        const root = path.dirname(this.file);
        if (this.changed || this.new) {
            files.push({ value: this.$mapRaw, remote: remoteFile });
            if (this.$files['virtual.terrain']) {
                if (this.new || this.$terrainRaw.dataset.changed === 'true')
                    files.push({ value: this.$terrainRaw.value, remote: remoteRoot + '/virtual.terrain' });
                else
                    files.push({ local: path.join(root, 'virtual.terrain'), remote: remoteRoot + '/virtual.terrain' });
            }
            if (this.$files['virtual.state']) {
                if (this.new || this.$stateRaw.dataset.changed === 'true')
                    files.push({ value: this.$stateRaw.value, remote: remoteRoot + '/virtual.state' });
                else
                    files.push({ local: path.join(root, 'virtual.state'), remote: remoteRoot + '/virtual.state' });
            }
            if (this.$files['terrain.desc']) {
                if (this.new || this.$descriptionRaw.dataset.changed === 'true')
                    files.push({ value: this.$descriptionRaw.value, remote: remoteRoot + '/terrain.desc' });
                else
                    files.push({ local: path.join(root, 'terrain.desc'), remote: remoteRoot + '/terrain.desc' });
            }
            if (this.$files['terrain.item']) {
                if (this.new || this.$itemRaw.dataset.changed === 'true')
                    files.push({ value: this.$itemRaw.value, remote: remoteRoot + '/terrain.item' });
                else
                    files.push({ local: path.join(root, 'terrain.item'), remote: remoteRoot + '/terrain.item' });
            }
            if (this.$files['virtual.exits']) {
                if (this.new || this.$externalRaw.dataset.changed === 'true')
                    files.push({ value: this.$externalRaw.value, remote: remoteRoot + '/virtual.exits' });
                else
                    files.push({ local: path.join(root, 'virtual.exits'), remote: remoteRoot + '/virtual.exits' });
            }
        }
        else {
            files.push({ local: this.file, remote: remoteFile });
            if (this.$files['virtual.terrain'])
                files.push({ local: path.join(root, 'virtual.terrain'), remote: remoteRoot + '/virtual.terrain' });
            if (this.$files['virtual.state'])
                files.push({ local: path.join(root, 'virtual.state'), remote: remoteRoot + '/virtual.state' });
            if (this.$files['terrain.desc'])
                files.push({ local: path.join(root, 'terrain.desc'), remote: remoteRoot + '/terrain.desc' });
            if (this.$files['terrain.item'])
                files.push({ local: path.join(root, 'terrain.item'), remote: remoteRoot + '/terrain.item' });
            if (this.$files['virtual.exits'])
                files.push({ local: path.join(root, 'virtual.exits'), remote: remoteRoot + '/virtual.exits' });
        }
        this.emit('upload', files);
    }

    public canSaveAs() {
        const files = Object.keys(this.$files).sort().reverse();
        let fl = files.length;
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
        if (room.y > 0 && room.x < this.$mapSize.width - 1 && (o & RoomExit.NorthEast) === RoomExit.NorthEast) {
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
        if (room.x < this.$mapSize.width - 1 && (o & RoomExit.East) === RoomExit.East) {
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
        if (room.y < this.$mapSize.height - 1 && (o & RoomExit.South) === RoomExit.South) {
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
        if (room.y < this.$mapSize.height - 1 && room.x < this.$mapSize.width - 1 && (o & RoomExit.SouthEast) === RoomExit.SouthEast) {
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
        if (room.x > 0 && room.y < this.$mapSize.height - 1 && (o & RoomExit.SouthWest) === RoomExit.SouthWest) {
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
        if (this.$depth + 1 < this.$mapSize.depth && (o & RoomExit.Up) === RoomExit.Up) {
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
        if (room.y === this.$mapSize.height - 1) {
            room.exits &= ~RoomExit.South;
            room.exits &= ~RoomExit.SouthEast;
            room.exits &= ~RoomExit.SouthWest;
        }

        if (room.x === 0) {
            room.exits &= ~RoomExit.West;
            room.exits &= ~RoomExit.NorthWest;
            room.exits &= ~RoomExit.SouthWest;
        }
        if (room.x === this.$mapSize.width - 1) {
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
        if (room.y > 0 && room.x < this.$mapSize.width - 1 && (o & RoomExit.NorthEast) === RoomExit.NorthEast) {
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
        if (room.x < this.$mapSize.width - 1 && (o & RoomExit.East) === RoomExit.East) {
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
        if (room.y < this.$mapSize.height - 1 && (o & RoomExit.South) === RoomExit.South) {
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
        if (room.y < this.$mapSize.height - 1 && room.x < this.$mapSize.width - 1 && (o & RoomExit.SouthEast) === RoomExit.SouthEast) {
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
        if (room.x > 0 && room.y < this.$mapSize.height - 1 && (o & RoomExit.SouthWest) === RoomExit.SouthWest) {
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
        if (this.$depth + 1 < this.$mapSize.depth && (o & RoomExit.Up) === RoomExit.Up) {
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
            case View.terrains:
                return this.$descriptionGrid.selected;
            case View.items:
                return this.$itemGrid.selected;
            case View.exits:
                return this.$exitGrid.selected;
            case View.mapRaw:
                return this.getRawSelected(this.$mapRaw);
            case View.terrainsRaw:
                return this.getRawSelected(this.$terrainRaw);
            case View.descriptionsRaw:
                return this.getRawSelected(this.$descriptionRaw);
            case View.itemsRaw:
                return this.getRawSelected(this.$itemRaw);
            case View.stateRaw:
                return this.getRawSelected(this.$stateRaw);
            case View.exitsRaw:
                return this.getRawSelected(this.$externalRaw);
        }
        return '';
    }

    public selectAll() {
        switch (this.$view) {
            case View.map:
                this.setSelection(0, 0, this.$mapSize.width, this.$mapSize.height);
                break;
            case View.terrains:
                this.$descriptionGrid.selectAll();
                break;
            case View.items:
                this.$itemGrid.selectAll();
                break;
            case View.exits:
                this.$exitGrid.selectAll();
                break;
            case View.mapRaw:
                this.$mapRaw.select();
                break;
            case View.terrainsRaw:
                this.$terrainRaw.select();
                break;
            case View.descriptionsRaw:
                this.$descriptionRaw.select();
                break;
            case View.itemsRaw:
                this.$itemRaw.select();
                break;
            case View.stateRaw:
                this.$stateRaw.select();
                break;
            case View.exitsRaw:
                this.$externalRaw.select();
                break;
        }
    }

    public cut() {
        switch (this.$view) {
            case View.map:
                if (this.$selectedRooms.length === 0) return;
                const rooms = this.$selectedRooms.filter(r => !r.ef).map(r => {
                    const n = r.clone();
                    n.external = this.$exits.filter(e => e.x === n.x && e.y === n.y && e.z === n.z);
                    return n;
                });
                if (rooms.length === 0) return;
                const details = {};
                rooms.forEach(r =>
                    details[r.item] = {
                        items: this.$items[r.item],
                        description: r.terrain >= 0 && r.terrain < this.$descriptions.length ? this.$descriptions[r.terrain] : null
                    }
                );
                clipboard.writeBuffer('jiMUD/VirtualArea', Buffer.from(JSON.stringify({
                    rooms: rooms,
                    details: details,
                    file: this.file
                })));
                let sl = this.$selectedRooms.length;
                while (sl--) {
                    const or = this.$selectedRooms[sl];
                    //has external rooms so remove them as they are now tied to the room
                    if (or.ee !== RoomExit.None) {
                        let nExternal = this.$exits.filter(e => e.x !== or.x || e.y !== or.y || e.z !== or.z);
                        this.$exits = nExternal;
                        this.$exitGrid.rows = this.$exits;
                        if (this.$mapSize.depth > 1)
                            nExternal = nExternal.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ',' + d.z + ':' + d.exit + ':' + d.dest);
                        else
                            nExternal = nExternal.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ':' + d.exit + ':' + d.dest);
                        this.$externalRaw.value = '';
                        this.updateRaw(this.$externalRaw, 0, nExternal);
                        resetCursor(this.$externalRaw);
                    }
                    this.$selectedRooms[sl] = new Room(or.x, or.y, or.z, 0, 0, 0);
                    if (this.$focusedRoom.at(or.x, or.y, or.z))
                        this.$focusedRoom = this.$selectedRooms[sl];
                    this.setRoom(this.$selectedRooms[sl]);
                    this.RoomChanged(this.$selectedRooms[sl], or);
                    this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, this.$selectedRooms[sl].at(this.$mouse.rx, this.$mouse.ry));
                    this.deleteRoom(or);
                }
                this.emit('supports-changed');
                break;
            case View.terrains:
                this.$descriptionGrid.cut();
                break;
            case View.items:
                this.$itemGrid.cut();
                break;
            case View.exits:
                this.$exitGrid.cut();
                break;
            case View.mapRaw:
            case View.terrainsRaw:
            case View.descriptionsRaw:
            case View.itemsRaw:
            case View.stateRaw:
            case View.exitsRaw:
                document.execCommand('cut');
                break;
        }
    }
    public copy() {
        switch (this.$view) {
            case View.map:
                if (this.$selectedRooms.length === 0) return;
                const rooms = this.$selectedRooms.filter(r => !r.ef).map(r => {
                    const n = r.clone();
                    n.external = this.$exits.filter(e => e.x === n.x && e.y === n.y && e.z === n.z);
                    return n;
                });
                if (rooms.length === 0) return;
                const details = {};
                rooms.forEach(r =>
                    details[r.item] = {
                        items: this.$items[r.item],
                        description: r.terrain >= 0 && r.terrain < this.$descriptions.length ? this.$descriptions[r.terrain] : null
                    }
                );
                clipboard.writeBuffer('jiMUD/VirtualArea', Buffer.from(JSON.stringify({
                    rooms: rooms,
                    details: details,
                    file: this.file
                })));
                this.emit('supports-changed');
                break;
            case View.terrains:
                this.$descriptionGrid.copy();
                break;
            case View.items:
                this.$itemGrid.copy();
                break;
            case View.exits:
                this.$exitGrid.copy();
                break;
            case View.mapRaw:
            case View.terrainsRaw:
            case View.descriptionsRaw:
            case View.itemsRaw:
            case View.stateRaw:
            case View.exitsRaw:
                document.execCommand('copy');
                break;
        }
    }
    public paste() {
        switch (this.$view) {
            case View.map:
                if (!clipboard.has('jiMUD/VirtualArea')) return;
                let or;
                if (this.$focusedRoom && this.$selectedRooms.indexOf(this.$focusedRoom) === -1)
                    or = this.$focusedRoom.clone();
                else
                    or = this.selectedFocusedRoom.clone();
                const data = JSON.parse(clipboard.readBuffer('jiMUD/VirtualArea').toString());
                const osX = data.rooms[0].x - or.x;
                const osY = data.rooms[0].y - or.y;
                let dl = data.rooms.length;
                const rooms = [];
                while (dl--) {
                    const dRoom = data.rooms[dl];
                    const room = new Room(dRoom.x - osX, dRoom.y - osY, dRoom.z, dRoom.exits, dRoom.terrain, dRoom.item, dRoom.state);
                    room.climbs = dRoom.climbs;
                    room.ef = dRoom.ef;
                    room.ee = dRoom.ee;
                    //has external rooms paste them in
                    if (dRoom.external && dRoom.external.length > 0) {
                        //change the coords to match the new room
                        dRoom.external.map(r => {
                            r.x = or.x;
                            r.y = or.y;
                            r.z = or.z;
                            return r;
                        });
                        //append to raw editors
                        if (this.$mapSize.depth > 1)
                            this.updateRaw(this.$externalRaw, this.$exits.length, dRoom.external.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ',' + d.z + ':' + d.exit + ':' + d.dest));
                        else
                            this.updateRaw(this.$externalRaw, this.$exits.length, dRoom.external.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ':' + d.exit + ':' + d.dest));
                        //append changed exits
                        this.$exits.push(...dRoom.external);
                        //refresh the grid to make sure it has all the new data
                        this.$exitGrid.refresh();
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
            case View.terrains:
                this.$descriptionGrid.paste();
                break;
            case View.items:
                this.$itemGrid.paste();
                break;
            case View.exits:
                this.$exitGrid.paste();
                break;
            case View.mapRaw:
            case View.terrainsRaw:
            case View.descriptionsRaw:
            case View.itemsRaw:
            case View.stateRaw:
            case View.exitsRaw:
                document.execCommand('paste');
                break;
        }
    }
    public delete() {
        switch (this.$view) {
            case View.map:
                if (this.$selectedRooms.length === 0) return;
                const rooms = this.$selectedRooms.filter(r => !r.ef).map(r => {
                    const n = r.clone();
                    n.external = this.$exits.filter(e => e.x === n.x && e.y === n.y && e.z === n.z);
                    return n;
                });
                if (rooms.length === 0) return;
                let sl = this.$selectedRooms.length;
                while (sl--) {
                    const or = this.$selectedRooms[sl];
                    //has external rooms so remove them as they are now tied to the room
                    if (or.ee !== RoomExit.None) {
                        let nExternal = this.$exits.filter(e => e.x !== or.x || e.y !== or.y || e.z !== or.z);
                        this.$exits = nExternal;
                        this.$exitGrid.rows = this.$exits;
                        if (this.$mapSize.depth > 1)
                            nExternal = nExternal.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ',' + d.z + ':' + d.exit + ':' + d.dest);
                        else
                            nExternal = nExternal.map(d => (d.enabled ? '' : '#') + d.x + ',' + d.y + ':' + d.exit + ':' + d.dest);
                        this.$externalRaw.value = '';
                        this.updateRaw(this.$externalRaw, 0, nExternal);
                        resetCursor(this.$externalRaw);
                    }
                    this.$selectedRooms[sl] = new Room(or.x, or.y, or.z, 0, 0, 0);
                    if (this.$focusedRoom.at(or.x, or.y, or.z))
                        this.$focusedRoom = this.$selectedRooms[sl];
                    this.setRoom(this.$selectedRooms[sl]);
                    this.RoomChanged(this.$selectedRooms[sl], or);
                    this.DrawRoom(this.$mapContext, this.$selectedRooms[sl], true, this.$selectedRooms[sl].at(this.$mouse.rx, this.$mouse.ry));
                    this.deleteRoom(or);
                }
                this.emit('supports-changed');
                break;
            case View.terrains:
                this.$descriptionGrid.delete();
                break;
            case View.items:
                this.$itemGrid.delete();
                break;
            case View.exits:
                this.$exitGrid.delete();
                break;
            case View.mapRaw:
                this.deleteRawSelected(this.$mapRaw);
                break;
            case View.terrainsRaw:
                this.deleteRawSelected(this.$terrainRaw);
                break;
            case View.descriptionsRaw:
                this.deleteRawSelected(this.$descriptionRaw);
                break;
            case View.itemsRaw:
                this.deleteRawSelected(this.$itemRaw);
                break;
            case View.stateRaw:
                this.deleteRawSelected(this.$stateRaw);
                break;
            case View.exitsRaw:
                this.deleteRawSelected(this.$externalRaw);
                break;
        }
    }
    public undo() {
        switch (this.$view) {
            case View.map:
            case View.terrains:
            case View.items:
            case View.exits:
                break;
            case View.mapRaw:
            case View.terrainsRaw:
            case View.descriptionsRaw:
            case View.itemsRaw:
            case View.stateRaw:
            case View.exitsRaw:
                document.execCommand('undo');
                break;
        }
    }
    public redo() {
        switch (this.$view) {
            case View.map:
            case View.terrains:
            case View.items:
            case View.exits:
                break;
            case View.mapRaw:
            case View.terrainsRaw:
            case View.descriptionsRaw:
            case View.itemsRaw:
            case View.stateRaw:
            case View.exitsRaw:
                document.execCommand('redo');
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
        const base = path.basename(file);
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
        const base = path.basename(file);
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
            const c = base.substring(0, base.length - 2).split(',');
            let r;
            if (c.length === 3)
                r = this.getRoom(c[0], c[1], c[2]);
            else
                r = this.getRoom(c[0], c[1]);
            if (!r) return;
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

    public set spellcheck(value: boolean) { /**/ }
    public find() { /**/ }
    public replace() { /**/ }
    public supports(what) {
        switch (what) {
            case 'refresh':
                return this.$view === View.map || this.$view === View.terrains || this.$view === View.items || this.$view === View.exits;
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
                    case View.terrains:
                        return this.$descriptionGrid.selectedCount > 0;
                    case View.items:
                        return this.$itemGrid.selectedCount > 0;
                    case View.exits:
                        return this.$exitGrid.selectedCount > 0;
                    case View.mapRaw:
                        return this.$mapRaw.selectionStart !== this.$externalRaw.selectionEnd;
                    case View.terrainsRaw:
                        return this.$terrainRaw.selectionStart !== this.$externalRaw.selectionEnd;
                    case View.descriptionsRaw:
                        return this.$descriptionRaw.selectionStart !== this.$externalRaw.selectionEnd;
                    case View.itemsRaw:
                        return this.$itemRaw.selectionStart !== this.$externalRaw.selectionEnd;
                    case View.stateRaw:
                        return this.$stateRaw.selectionStart !== this.$externalRaw.selectionEnd;
                    case View.exitsRaw:
                        return this.$externalRaw.selectionStart !== this.$externalRaw.selectionEnd;
                }
                return false;
            case 'paste':
                switch (this.$view) {
                    case View.map:
                        return clipboard.has('jiMUD/VirtualArea');
                    case View.terrains:
                        return this.$descriptionGrid.canPaste;
                    case View.items:
                        return this.$itemGrid.canPaste;
                    case View.exits:
                        return this.$exitGrid.canPaste;
                    case View.mapRaw:
                    case View.terrainsRaw:
                    case View.descriptionsRaw:
                    case View.itemsRaw:
                    case View.stateRaw:
                    case View.exitsRaw:
                        return true;
                }
                return false;
            case 'undo':
            case 'redo':
                return this.$view === View.mapRaw || this.$view === View.terrainsRaw || this.$view === View.descriptionsRaw || this.$view === View.itemsRaw || this.$view === View.stateRaw || this.$view === View.exitsRaw;

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
        el.title = 'Show raw';
        el.innerHTML = '<span class="caret"></span>';
        el.onclick = (e) => {
            const button = $(e.currentTarget);
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
            addMenu.popup({ window: remote.getCurrentWindow(), x: x, y: y });
        };
        group.appendChild(el);
        frag.appendChild(group);
        group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');
        group.appendChild(this.createButton('colors', 'paint-brush', () => {
            this.ShowColors = !this.$showColors;
        }, this.$showColors, this.$view !== View.map));
        group.appendChild(this.createButton('terrain', 'globe', () => {
            this.ShowTerrain = !this.$showTerrain;
        }, this.$showTerrain, this.$view !== View.map));
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
                }
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
        if (this.parent.contains(document.activeElement))
            return;
        switch (this.$view) {
            case View.map:
                setTimeout(() => {
                    this.$mapContainer.focus();
                    this.$map.focus();
                }, 10);
                break;
            case View.terrains:
                this.$descriptionGrid.focus();
                break;
            case View.items:
                this.$itemGrid.focus();
                break;
            case View.exits:
                this.$exitGrid.focus();
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

        if (this.$descriptionGrid) {
            this.$descriptionGrid.enterMoveFirst = value.enterMoveFirst;
            this.$descriptionGrid.enterMoveNext = value.enterMoveNext;
        }
        if (this.$itemGrid) {
            this.$itemGrid.enterMoveFirst = value.enterMoveFirst;
            this.$itemGrid.enterMoveNext = value.enterMoveNext;
        }
        if (this.$exitGrid) {
            this.$exitGrid.enterMoveFirst = value.enterMoveFirst;
            this.$exitGrid.enterMoveNext = value.enterMoveNext;
        }

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
                            enterMoveNext: this.$enterMoveNext
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
                            enterMoveNext: this.$enterMoveNext
                        }
                    },
                    sort: 2
                }
            ]);
        }

        this.ShowColors = value.showColors;
        this.ShowTerrain = value.showTerrain;
        this.$mapRaw.style.fontFamily = value.rawFontFamily;
        this.$mapRaw.style.fontSize = value.rawFontSize + 'px';
        this.$mapRaw.style.fontWeight = value.rawFontWeight;
        this.$mapRaw.spellcheck = value.rawSpellcheck;

        this.$terrainRaw.style.fontFamily = value.rawFontFamily;
        this.$terrainRaw.style.fontSize = value.rawFontSize + 'px';
        this.$terrainRaw.style.fontWeight = value.rawFontWeight;
        this.$terrainRaw.spellcheck = value.rawSpellcheck;

        this.$stateRaw.style.fontFamily = value.rawFontFamily;
        this.$stateRaw.style.fontSize = value.rawFontSize + 'px';
        this.$stateRaw.style.fontWeight = value.rawFontWeight;
        this.$stateRaw.spellcheck = value.rawSpellcheck;

        this.$descriptionRaw.style.fontFamily = value.rawFontFamily;
        this.$descriptionRaw.style.fontSize = value.rawFontSize + 'px';
        this.$descriptionRaw.style.fontWeight = value.rawFontWeight;
        this.$descriptionRaw.spellcheck = value.rawSpellcheck;

        this.$itemRaw.style.fontFamily = value.rawFontFamily;
        this.$itemRaw.style.fontSize = value.rawFontSize + 'px';
        this.$itemRaw.style.fontWeight = value.rawFontWeight;
        this.$itemRaw.spellcheck = value.rawSpellcheck;

        this.$externalRaw.style.fontFamily = value.rawFontFamily;
        this.$externalRaw.style.fontSize = value.rawFontSize + 'px';
        this.$externalRaw.style.fontWeight = value.rawFontWeight;
        this.$externalRaw.spellcheck = value.rawSpellcheck;

        this.$roomPreview.container.style.fontSize = value.previewFontSize + 'px';
        this.$roomPreview.container.style.fontFamily = value.previewFontFamily;
        this.$splitterEditor.SplitterDistance = value.editorWidth;
        this.$splitterPreview.SplitterDistance = value.previewHeight;
        this.$splitterEditor.live = value.live;
        this.$splitterPreview.live = value.live;
        this.$splitterEditor.panel2Collapsed = !value.showRoomEditor;
        this.$splitterPreview.panel2Collapsed = !value.showRoomPreview;
        this.descriptionOnDelete = value.descriptionOnDelete;
        this.itemOnDelete = value.itemOnDelete;
    }
    public get options() {
        return {
            showColors: this.$showColors,
            showTerrain: this.$showTerrain,
            live: this.$splitterEditor.live,
            showRoomEditor: !this.$splitterEditor.panel2Collapsed,
            showRoomPreview: !this.$splitterPreview.panel2Collapsed,
            descriptionOnDelete: this.descriptionOnDelete,
            itemOnDelete: this.itemOnDelete
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
        let bGroup;
        let button;
        this.$label.style.display = '';
        switch (this.$view) {
            case View.map:
                this.$splitterEditor.hide();
                break;
            case View.terrains:
                this.$descriptionGrid.parent.style.display = 'none';
                break;
            case View.items:
                this.$itemGrid.parent.style.display = 'none';
                break;
            case View.exits:
                this.$exitGrid.parent.style.display = 'none';
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
                if (this.$descriptionRaw.dataset.dirty === 'true') {
                    this.loadDescriptions();
                    this.$descriptionRaw.dataset.dirty = null;
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
                if (this.$terrainRaw.dataset.dirty === 'true' || this.$mapRaw.dataset.dirty === 'true') {
                    this.BuildRooms();
                    this.BuildMap();
                    this.$mapRaw.dataset.dirty = null;
                    this.$terrainRaw.dataset.dirty = null;
                }
                this.UpdateEditor(this.$selectedRooms);
                this.UpdatePreview(this.selectedFocusedRoom);
                this.$label.style.display = 'none';
                this.$splitterEditor.show();
                this.emit('location-changed', -1, -1);
                break;
            case View.terrains:
                if (this.$terrainRaw.dataset.dirty === 'true') {
                    this.loadDescriptions();
                    this.doUpdate(UpdateType.drawMap);
                    this.$terrainRaw.dataset.dirty = null;
                }
                this.$label.textContent = 'Terrains';
                bGroup = document.createElement('div');
                bGroup.classList.add('btn-group');

                button = document.createElement('button');
                button.type = 'button';
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$descriptionGrid.addNewRow();
                });
                button.title = 'Add terrain';
                button.innerHTML = '<i class="fa fa-plus"></i> Add';
                bGroup.appendChild(button);

                button = document.createElement('button');
                //TODO remove when insert works
                button.style.display = 'none';
                button.type = 'button';
                button.disabled = this.$descriptionGrid.selectedCount === 0;
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {

                });
                button.title = 'Insert terrain';
                button.innerHTML = '<i class="fa fa-arrows-v"></i> Insert';
                bGroup.appendChild(button);

                button = document.createElement('button');
                button.type = 'button';
                button.disabled = this.$descriptionGrid.selectedCount === 0;
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$descriptionGrid.focus();
                    this.$descriptionGrid.beginEdit(this.$descriptionGrid.selected[0].row);
                });
                button.title = 'Edit terrain';
                button.innerHTML = '<i class="fa fa-edit"></i> Edit';
                bGroup.appendChild(button);

                button = document.createElement('button');
                button.disabled = this.$descriptionGrid.selectedCount === 0;
                button.type = 'button';
                button.title = 'Delete terrain(s)';
                button.classList.add('btn', 'btn-danger', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$descriptionGrid.delete();
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

                this.$descriptionGrid.parent.style.display = '';
                this.$descriptionGrid.focus();
                break;
            case View.items:
                if (this.$itemRaw.dataset.dirty === 'true') {
                    this.loadDescriptions();
                    this.doUpdate(UpdateType.drawMap);
                    this.$itemRaw.dataset.dirty = null;
                }
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
                break;
            case View.exits:
                if (this.$externalRaw.dataset.dirty === 'true') {
                    this.reloadExits();
                    this.doUpdate(UpdateType.drawMap);
                    this.$externalRaw.dataset.dirty = null;
                }
                this.$label.textContent = 'External exits';
                bGroup = document.createElement('div');
                bGroup.classList.add('btn-group');

                button = document.createElement('button');
                button.type = 'button';
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$exitGrid.addNewRow();
                });
                button.title = 'Add exit';
                button.innerHTML = '<i class="fa fa-plus"></i> Add';
                bGroup.appendChild(button);
                button = document.createElement('button');
                button.type = 'button';
                button.disabled = this.$exitGrid.selectedCount === 0;
                button.classList.add('btn', 'btn-default', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$exitGrid.beginEdit(this.$exitGrid.selected[0].row);
                });
                button.title = 'Edit exit';
                button.innerHTML = '<i class="fa fa-edit"></i> Edit';
                bGroup.appendChild(button);
                button = document.createElement('button');
                button.disabled = this.$exitGrid.selectedCount === 0;
                button.type = 'button';
                button.title = 'Delete exit(s)';
                button.classList.add('btn', 'btn-danger', 'btn-xs');
                button.addEventListener('click', () => {
                    this.$exitGrid.delete();
                });
                button.innerHTML = '<i class="fa fa-trash"></i> Delete';
                bGroup.appendChild(button);
                this.$label.appendChild(bGroup);
                this.$exitGrid.parent.style.display = '';
                this.$exitGrid.focus();
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
        this.emit('menu-update', 'view|map', { checked: view === View.map });
        this.emit('menu-update', 'view|Terrains', { checked: view === View.terrains });
        this.emit('menu-update', 'view|Items', { checked: view === View.items });
        this.emit('menu-update', 'view|External exits', { checked: view === View.exits });
        this.emit('menu-update', 'view|Map raw', { checked: view === View.mapRaw });
        this.emit('menu-update', 'view|Terrain raw', { checked: view === View.terrainsRaw });
        this.emit('menu-update', 'view|Description raw', { checked: view === View.descriptionsRaw });
        this.emit('menu-update', 'view|Items raw', { checked: view === View.itemsRaw });
        this.emit('menu-update', 'view|State raw', { checked: view === View.stateRaw });
        this.emit('menu-update', 'view|External exits raw', { checked: view === View.exitsRaw });
        this.emit('menu-update', 'view|room editor', { enabled: view === View.map });
        this.emit('menu-update', 'view|room preview', { enabled: view === View.map });
        this.emit('menu-update', 'view|show terrain', { enabled: view === View.map });
        this.emit('menu-update', 'view|show colors', { enabled: view === View.map });
        this.setButtonDisabled('room editor', view !== View.map);
        this.setButtonDisabled('room preview', view !== View.map);
        this.setButtonDisabled('terrain', view !== View.map);
        this.setButtonDisabled('colors', view !== View.map);
        this.setButtonState('map', view === View.map);
        this.setButtonState('terrains', view === View.terrains);
        this.setButtonState('items', view === View.items);
        this.setButtonState('external exits', view === View.exits);
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
            case View.terrains:
                this.emit('location-changed', -1, -1);
                this.emit('changed', this.$descriptions.length);
                break;
            case View.items:
                this.emit('location-changed', -1, -1);
                this.emit('changed', this.$items.length);
                break;
            case View.exits:
                this.emit('location-changed', -1, -1);
                this.emit('changed', this.$exits.length);
                break;
            case View.mapRaw:
                this.emit('location-changed', -1, -1);
                this.emit('changed', this.$mapRaw.value.length);
                break;
            case View.terrainsRaw:
                this.emit('location-changed', -1, -1);
                this.emit('changed', this.$terrainRaw.value.length);
                break;
            case View.descriptionsRaw:
                this.emit('location-changed', -1, -1);
                this.emit('changed', this.$descriptionRaw.value.length);
                break;
            case View.itemsRaw:
                this.emit('location-changed', -1, -1);
                this.emit('changed', this.$itemRaw.value.length);
                break;
            case View.stateRaw:
                this.emit('location-changed', -1, -1);
                this.emit('changed', this.$stateRaw.value.length);
                break;
            case View.exitsRaw:
                this.emit('location-changed', -1, -1);
                this.emit('changed', this.$externalRaw.value.length);
                break;
        }
        this.updateStatus();
    }

    private updateStatus() {
        if (this.$view === View.map)
            this.emit('status-message', `Rooms ${this.$rcount}, Empty rooms ${(this.$mapSize.width * this.$mapSize.height * this.$mapSize.depth) - this.$rcount}, Total rooms ${this.$mapSize.width * this.$mapSize.height * this.$mapSize.depth}`);
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
        //see if selected
        const idx = this.$selectedRooms.indexOf(this.$rooms[r.z][r.y][r.x]);
        this.$rooms[r.z][r.y][r.x] = r;
        //if selected update the selected systm to point to new room object
        if (idx !== -1) {
            this.$selectedRooms[idx] = this.$rooms[r.z][r.y][r.x];
            this.UpdateEditor(this.$selectedRooms);
            this.UpdatePreview(r);
        }
        //was the old room focused? if so point ot new room object
        if (this.$focusedRoom.at(r.x, r.y, r.z))
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
        else if (this.$showColors) {
            ctx.fillStyle = this.getColor(room.terrain);
            ctx.fillRect(x + 8, y + 8, 16, 16);
        }

        if (this.$showTerrain && !room.ef) {
            if (exs === RoomExit.None && ex === RoomExit.None)
                ctx.fillStyle = 'rgb(234, 233, 233)';
            else if (this.$showColors)
                ctx.fillStyle = this.ContrastColor(ctx.fillStyle);
            else
                ctx.fillStyle = 'black';
            let m;
            if (this.$measure && this.$measure[room.terrain])
                m = this.$measure[room.terrain];
            else {
                if (!this.$measure) this.$measure = {};
                m = (this.$measure[room.terrain] = ctx.measureText(room.terrain).width / 2);
            }
            ctx.fillText(room.terrain, x + 16 - m, y + 19);
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
        this.$mapContext.fillRect(0, 0, this.$mapSize.right, this.$mapSize.bottom);
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
        this.$mapContext.strokeStyle = 'black';
        for (y = 0; y < yl; y++) {
            r = this.$rooms[this.$depth][y];
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
        if (width > this.$mapSize.width)
            width = this.$mapSize.width;
        if (height > this.$mapSize.height)
            height = this.$mapSize.height;
        this.$mapContext.save();
        this.$mapContext.fillStyle = 'white';
        this.$mapContext.fillRect(x * 32, y * 32, (width - x) * 32, (height - y) * 32);
        this.$mapContext.lineWidth = 0.6;
        if (!this.$rooms) {
            this.$mapContext.restore();
            return;
        }
        if (!window.$roomImgLoaded) {
            setTimeout(() => { this.drawRegion(sX, sY, sWidth, sHeight); }, 10);
            return;
        }
        this.$mapContext.strokeStyle = 'black';
        for (let rY = y; rY < height; rY++) {
            r = this.$rooms[this.$depth][rY];
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

    private ContrastColor(color) {
        if (this.$colorCache && this.$colorCache[color])
            return this.$colorCache[color];
        if (!this.$colorCache)
            this.$colorCache = {};
        color = new RGBColor(color);
        let d = 0;
        // Counting the perceptive luminance - human eye favors green color...
        const a = 1 - (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
        if (a < 0.5)
            d = 0; // bright colors - black font
        else
            d = 255; // dark colors - white font

        return this.$colorCache[color] = 'rgb(' + d + ', ' + d + ', ' + d + ')';
    }

    private getColor(t) {
        if (!t || this.$maxTerrain === 0 || t < 1 || t > this.$maxTerrain) return 'white';
        //return "white";
        if (this.$colorCache && this.$colorCache[t])
            return this.$colorCache[t];
        if (!this.$colorCache)
            this.$colorCache = {};
        return this.$colorCache[t] = this.GetColorFromColorScale(t, 1, this.$maxTerrain, ['#008000', '#FFFF00', '#FF0000', '#0000FF']);
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
        if (width > this.$mapSize.width) width = this.$mapSize.width;
        if (height > this.$mapSize.height) height = this.$mapSize.height;
        const old = this.$selectedRooms.slice();
        this.$selectedRooms.length = 0;
        let ol = old.length;
        while (ol--)
            this.DrawRoom(this.$mapContext, old[ol], true);
        if (y === height) {
            const r = this.$rooms[this.$depth][y];
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
                const r = this.$rooms[this.$depth][rY];
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
        if (this.$mapSize.depth > 1)
            f = r.x + ',' + r.y + ',' + r.z + '.c';
        else
            f = r.x + ',' + r.y + '.c';
        this.setRoom(this.parseRoomCode(r, this.read(path.join(path.dirname(this.file), f))));
    }

    private parseRoomCode(r, code) {
        if (typeof (r) === 'undefined')
            r = new Room(-1, -1, -1, 0, 0, 0);
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
        let c = 0;
        let s = 0;
        let nl = '';
        if (old) {
            if (room.state === old.state && room.exits === old.exits && room.terrain === old.terrain && room.item === old.item)
                return;
            if (old.exits) this.$rcount--;
            if (room.exits) this.$rcount++;
            this.updateStatus();
        }
        const y = room.y + 1 + room.z * (this.$mapSize.height + 1);
        const x = room.x;
        let line;
        let lines;
        //dimensions + ((height + space) * depth)
        const maxLines = 1 + (this.$mapSize.height + 1) * this.$mapSize.depth;
        if (this.$files['virtual.state']) {
            if (!old || room.state !== old.state) {
                lines = this.$stateRaw.value.split('\n');
                while (lines.length < maxLines)
                    lines.push('');
                if (y < 1 || y >= lines.length) return;
                line = lines[y].split(' ');
                while (line.length < this.$mapSize.width)
                    lines.push('');
                if (x < 0 || x >= line.length) return;
                line[x] = leadingZeros(room.state, 3, '0');
                lines[y] = line.join(' ');
                this.$stateRaw.value = lines.join('\n');
                c++;
                this.$stateRaw.dataset.changed = 'true';
            }
        }
        else if (room.state > 0) {
            nl = ':' + leadingZeros(room.state, 3, '0');
            if (!old || room.state !== old.state)
                s = 1;
        }

        if (this.$files['virtual.terrain']) {
            if (!old || room.terrain !== old.terrain || room.item !== old.item || s || nl.length > 0) {
                lines = this.$terrainRaw.value.split('\n');
                while (lines.length < maxLines)
                    lines.push('');
                if (y < 1 || y >= lines.length) return;
                line = lines[y].split(' ');
                while (line.length < this.$mapSize.width)
                    lines.push('');
                if (x < 0 || x >= line.length) return;
                line[x] = leadingZeros(room.terrain, 2, '0');
                if (s || nl.length > 0) {
                    line[x] += ':' + leadingZeros(room.item, 2, '0');
                    line[x] += nl;
                    nl = '';
                    s = 0;
                }
                else if (room.terrain !== room.item)
                    line[x] += ':' + leadingZeros(room.item, 2, '0');
                lines[y] = line.join(' ');
                this.$terrainRaw.value = lines.join('\n');
                c++;
                this.$terrainRaw.dataset.changed = 'true';
            }
        }
        else {
            if (!old || room.terrain !== old.terrain || room.item !== old.item)
                c++;
            nl = ':' + leadingZeros(room.item, 3, '0') + nl;
            nl = ':' + leadingZeros(room.terrain, 3, '0') + nl;
        }

        if (!old || room.exits !== old.exits || s || nl.length > 0) {
            lines = this.$mapRaw.value.split('\n');
            while (lines.length < maxLines)
                lines.push('');
            if (y < 1 || y >= lines.length) return;
            line = lines[y].split(' ');
            while (line.length < this.$mapSize.width)
                lines.push('');
            if (x < 0 || x >= line.length) return;
            line[x] = leadingZeros(room.exits, 3, '0');
            if (s || nl.length > 0)
                line[x] += nl;
            if (line[x] === '000:000' || line[x] === '000:000:000' || line[x] === '000:000:000:000')
                line[x] = '000';
            lines[y] = line.join(' ');
            this.$mapRaw.value = lines.join('\n');
            c++;
        }

        if (c) {
            if (!silentUpdate && this.$selectedRooms.indexOf(room) !== -1)
                this.UpdateEditor(this.$selectedRooms);
            this.$mapRaw.dataset.changed = 'true';
            this.changed = true;
        }
        if (!silentUpdate)
            this.UpdatePreview(room);
    }

    private roomsChanged() {
        //store room lengths
        const zl = this.$mapSize.depth;
        const xl = this.$mapSize.width;
        const yl = this.$mapSize.height;
        const maxLines = 1 + (yl + 1) * zl;
        this.$rcount = 0;
        let sLines = null;
        let tLines = null;
        let mLines = null;
        let yLine;
        let line;
        let sLine;
        let tLine;
        let mLine;
        let s = false;
        if (this.$files['virtual.state']) {
            sLines = this.$stateRaw.value.split('\n');
            while (sLines.length < maxLines)
                sLines.push('');
        }
        if (this.$files['virtual.terrain']) {
            tLines = this.$stateRaw.value.split('\n');
            while (tLines.length < maxLines)
                tLines.push('');
        }
        mLines = this.$mapRaw.value.split('\n');
        while (mLines.length < maxLines)
            mLines.push('');

        for (let z = 0; z < zl; z++) {
            for (let y = 0; y < yl; y++) {
                yLine = y + 1 + z * (yl + 1);
                if (sLines) {
                    sLine = sLines[yLine].split(' ');
                    while (sLine.length < xl)
                        sLine.push('');
                }
                if (tLines) {
                    tLine = tLines[yLine].split(' ');
                    while (tLine.length < xl)
                        tLine.push('');
                }
                mLine = mLines[yLine].split(' ');
                while (mLine.length < xl)
                    mLine.push('');
                line = '';
                for (let x = 0; x < xl; x++) {
                    const room = this.$rooms[z][y][x];
                    s = false;
                    if (sLine)
                        sLine[x] = leadingZeros(room.state, 3, '0');
                    else if (room.state > 0) {
                        line = ':' + leadingZeros(room.state, 3, '0');
                        s = true;
                    }
                    if (tLine) {
                        tLine[x] = leadingZeros(room.terrain, 2, '0');
                        if (s || line.length > 0) {
                            tLine[x] += ':' + leadingZeros(room.item, 2, '0') + line;
                            line = '';
                            s = false;
                        }
                        else if (room.terrain !== room.item)
                            tLine[x] += ':' + leadingZeros(room.item, 2, '0');
                    }
                    else {
                        line = ':' + leadingZeros(room.item, 3, '0') + line;
                        line = ':' + leadingZeros(room.terrain, 3, '0') + line;
                    }
                    mLine[x] = leadingZeros(room.exits, 3, '0');
                    if (s || line.length > 0)
                        mLine[x] += line;
                    if (mLine[x] === '000:000' || mLine[x] === '000:000:000' || mLine[x] === '000:000:000:000')
                        mLine[x] = '000';
                    //this.RoomChanged(room, null, true);
                    if (room.exits) this.$rcount++;
                }
                if (sLine)
                    sLines[yLine] = sLine.join(' ');
                if (tLine)
                    tLines[yLine] = tLine.join(' ');
                mLines[yLine] = mLine.join(' ');
            }
        }

        if (sLines) {
            this.$stateRaw.value = sLines.join('\n');
            this.$stateRaw.dataset.changed = 'true';
        }
        if (tLines) {
            this.$terrainRaw.value = tLines.join('\n');
            this.$terrainRaw.dataset.changed = 'true';
        }
        this.$mapRaw.value = mLines.join('\n');
        this.$mapRaw.dataset.changed = 'true';
        this.changed = true;
        this.updateStatus();
    }

    private UpdateEditor(rooms) {
        if (this.selectedFocusedRoom)
            this.$depthToolbar.value = '' + this.selectedFocusedRoom.z;
        const objs = [];
        if (rooms) {
            let rl = rooms.length;
            const ri = {};
            const re = [];
            while (rl--) {
                const o = rooms[rl].clone();
                if (o.ef) {
                    if (rooms[rl].items)
                        o.items = rooms[rl].items.slice(0);
                    else
                        o.items = [];
                    o.short = rooms[rl].short;
                    o.long = rooms[rl].long;
                    o.light = rooms[rl].light || 0;
                    o.terrainType = rooms[rl].terrain;
                    o.sound = rooms[rl].sound;
                    o.smell = rooms[rl].smell;
                    o.terrain = -1;
                }
                else {
                    if (!ri[o.item]) {
                        if (o.item < this.$items.length && o.item >= 0 && this.$items[o.item] && this.$items[o.item].children && this.$items[o.item].children.length > 0)
                            ri[o.item] = this.$items[o.item].children.slice();
                        else
                            ri[o.item] = [];
                    }
                    o.items = ri[o.item];
                    if (o.terrain < this.$descriptions.length && o.terrain >= 0 && this.$descriptions[o.terrain]) {
                        o.short = this.$descriptions[o.terrain].short;
                        o.long = this.$descriptions[o.terrain].long;
                        o.light = this.$descriptions[o.terrain].light;
                        o.terrainType = this.$descriptions[o.terrain].terrain;
                        o.sound = this.$descriptions[o.terrain].sound;
                        o.smell = this.$descriptions[o.terrain].smell;
                    }
                    else {
                        o.short = '';
                        o.long = '';
                        o.light = 0;
                        o.terrainType = '';
                        o.sound = '';
                        o.smell = '';
                    }
                    o.external = this.$exits.filter(e => e.x === o.x && e.y === o.y && e.z === o.z).map(a => ({ ...a }));
                    if (o.external.length === 0)
                        o.external = re;
                }
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
        else if (room.ef) {
            if (room.short) {
                this.$roomPreview.short.textContent = room.short;
                this.$roomPreview.long.textContent = room.long;
                str = this.$roomPreview.long.innerHTML;
                if (room.items && room.items.length > 0) {
                    items = room.items.slice().sort((a, b) => { return b.item.length - a.item.length; });
                    cl = items.length;
                    for (c = 0; c < cl; c++)
                        str = str.replace(new RegExp('\\b(' + items[c].item + ')\\b', 'g'), '<span class="room-item" id="' + this.parent.id + '-room-preview' + c + '" title="">' + items[c].item + '</span>');
                }
                e = room.climbs;
                if (e !== RoomExit.None) {
                    ex = [];
                    str += '<br>You can climb ';
                    for (exit in RoomExits) {
                        if (!RoomExits.hasOwnProperty(exit)) continue;
                        if (!RoomExits[exit]) continue;
                        if ((e & RoomExits[exit]) === RoomExits[exit])
                            ex.push(exit);
                    }
                    if (ex.length === 1)
                        str += ex[0];
                    else {
                        str += ex.slice(0, -1).join(', ');
                        str += ' or ' + ex.pop();
                    }
                    str += ' from here.';
                }
                str += '<br><br>';
                this.$roomPreview.long.innerHTML = str;
                if (items && items.length > 0) {
                    for (c = 0, cl = items.length; c < cl; c++) {
                        item = document.getElementById(this.parent.id + '-room-preview' + c);
                        if (item)
                            item.title = items[c].description;
                    }
                }
                if (room.smell.length > 0 && room.smell !== '0' && room.sound.length > 0 && room.sound !== '0') {
                    this.$roomPreview.sound.style.display = 'block';
                    this.$roomPreview.smell.style.display = 'block';
                    this.$roomPreview.smell.textContent = room.smell;
                    this.$roomPreview.sound.textContent = room.sound;
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                }
                else if (room.smell.length > 0 && room.smell !== '0') {
                    this.$roomPreview.sound.style.display = 'none';
                    this.$roomPreview.smell.style.display = 'block';
                    this.$roomPreview.smell.textContent = room.smell;
                    this.$roomPreview.sound.textContent = '';
                    this.$roomPreview.smell.appendChild(document.createElement('br'));
                    this.$roomPreview.smell.appendChild(document.createElement('br'));
                }
                else if (room.sound.length > 0 && room.sound !== '0') {
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
            else {
                this.$roomPreview.short.textContent = '';
                this.$roomPreview.long.textContent = 'External File currently not supported in preview.';
                this.$roomPreview.smell.textContent = '';
                this.$roomPreview.sound.textContent = '';
                this.$roomPreview.exits.textContent = '';
            }
        }
        else {
            let data = this.$descriptions;
            if (data.length === 0 || room.terrain < 0 || room.terrain >= data.length || !data[room.terrain]) {
                this.$roomPreview.short.textContent = '';
                this.$roomPreview.long.textContent = 'Nothing to preview';
                this.$roomPreview.smell.textContent = '';
                this.$roomPreview.sound.textContent = '';
                this.$roomPreview.exits.textContent = '';
            }
            else {
                data = data[room.terrain];
                items = this.$items;
                this.$roomPreview.short.textContent = data.short;
                this.$roomPreview.long.textContent = data.long;
                str = this.$roomPreview.long.innerHTML;

                if (items.length > 0 && room.item >= 0 && room.item < items.length && items[room.item] && items[room.item].children && items[room.item].children.length > 0) {
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
                if (data.smell.length > 0 && data.smell !== '0' && data.sound.length > 0 && data.sound !== '0') {
                    this.$roomPreview.sound.style.display = 'block';
                    this.$roomPreview.smell.style.display = 'block';
                    this.$roomPreview.smell.textContent = data.smell;
                    this.$roomPreview.sound.textContent = data.sound;
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                    this.$roomPreview.sound.appendChild(document.createElement('br'));
                }
                else if (data.smell.length > 0 && data.smell !== '0') {
                    this.$roomPreview.sound.style.display = 'none';
                    this.$roomPreview.smell.style.display = 'block';
                    this.$roomPreview.smell.textContent = data.smell;
                    this.$roomPreview.sound.textContent = '';
                    this.$roomPreview.smell.appendChild(document.createElement('br'));
                    this.$roomPreview.smell.appendChild(document.createElement('br'));
                }
                else if (data.sound.length > 0 && data.sound !== '0') {
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
    }

    private removeRaw(raw, line, count, noChanged?, noDirty?) {
        if (typeof (count) === 'undefined') count = 1;
        const lines = raw.value.split('\n');
        if (line < 0 || line >= lines.length) return;
        lines.splice(line, count);
        raw.value = lines.join('\n');
        if (!noChanged) {
            this.changed = true;
            raw.dataset.dirty = !noDirty ? 'true' : null;
            raw.dataset.changed = 'true';
        }
    }

    private updateRaw(raw, line, str, noChanged?, noDirty?) {
        const lines = raw.value.split('\n');
        if (line < 0) return;
        let s;
        const sl = str.length;
        for (s = 0; s < sl; s++)
            lines[line + s] = str[s];
        raw.value = lines.join('\n');
        if (!noChanged) {
            this.changed = true;
            raw.dataset.dirty = !noDirty ? 'true' : null;
            raw.dataset.changed = 'true';
        }
    }

    private reduceIdx(arr, idx) {
        const dl = arr.length;
        for (let d2 = 0; d2 < dl; d2++) {
            if (arr[d2].idx >= idx) {
                arr[d2].idx--;
                if (arr[d2].hasOwnProperty('tag'))
                    arr[d2].tag--;
            }
        }
    }

    private BuildRooms() {
        Timer.start();
        let yl;
        let xl;
        let x = 0;
        let y = 0;
        let z = 0;
        let zl;
        let line;
        let tline;
        let sline;
        let dl;
        let r;
        let ry;
        let s;
        let sl;
        let tl;
        let rd;
        let rt;
        const data = this.$mapRaw.value.split('\n');
        const tdata = this.$terrainRaw.value.split('\n');
        const sdata = this.$stateRaw.value.split('\n');
        const edata = this.$externalRaw.value.split('\n');
        const root = path.dirname(this.file);
        const ee = {};
        this.$rcount = 0;
        this.$maxTerrain = 0;
        this.$colorCache = 0;
        if (edata.length > 0) {
            for (x = 0, xl = edata.length; x < xl; x++) {
                line = edata[x].split(':');
                if (line.length > 2)
                    ee[line[0]] = line[1];
            }
        }

        this.$rooms = [];
        if (data.length > 0) {
            line = data.shift().split(' ');
            tline = tdata.shift().split(' ');
            sline = sdata.shift().split(' ');
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
            let e;
            let t;
            let i;
            const selected = this.$selectedRooms.slice();
            this.$selectedRooms.length = 0;
            if (xl > 0 && yl > 0 && zl > 0) {
                const rooms = this.$rooms;
                let rcount = 0;
                let maxTerrain = 0;
                let cname;
                for (; z < zl; z++) {
                    if (!rooms[z]) rooms[z] = [];
                    for (y = 0; y < yl; y++) {
                        if (!rooms[z][y])
                            rooms[z][y] = [];
                        ry = rooms[z][y];
                        if (y + z * (yl + 1) < dl && data[y + z * (yl + 1)].length > 0)
                            line = data[y + z * (yl + 1)].split(' ');
                        else
                            line = [];

                        if (y + z * (yl + 1) < tl && tdata[y + z * (yl + 1)].length > 0)
                            tline = tdata[y + z * (yl + 1)].split(' ');
                        else
                            tline = [];

                        if (y + z * (yl + 1) < sl && sdata[y + z * (yl + 1)].length > 0)
                            sline = sdata[y + z * (yl + 1)].split(' ');
                        else
                            sline = [];

                        for (x = 0; x < xl; x++) {
                            if (x >= line.length)
                                r = new Room(x, y, z, e, 0, 0, 0);
                            else {
                                rd = line[x].split(':');
                                e = rd.length > 0 ? +rd[0] : 0;
                                t = rd.length > 1 ? +rd[1] : 0;
                                i = rd.length > 2 ? +rd[2] : t;
                                s = rd.length > 3 ? +rd[3] : 0;
                                if (x < tline.length) {
                                    rt = tline[x].split(':');
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
                            if (selected.length > 0 && selected.filter(sR => sR.at(r.x, r.y, r.z)).length > 0)
                                this.$selectedRooms.push(r);
                            cname = x + ',' + y;
                            if (zl > 1)
                                cname += ',' + z;
                            if (ee[cname])
                                r.ee |= RoomExits[ee[cname]];
                            r.ef = existsSync(path.join(root, cname + '.c'));
                            this.loadRoom(r);
                            ry.push(r);
                            if (r.exits) rcount++;
                        }
                    }
                }
                this.$rcount = rcount;
                this.$maxTerrain = maxTerrain;
            }
            if (selected.length !== 0 || this.$selectedRooms.length !== 0)
                this.ChangeSelection();
            if (this.$focusedRoom) {
                const oldFocus = this.$focusedRoom;
                this.$focusedRoom = this.getRoom(this.$focusedRoom.x, this.$focusedRoom.y);
                this.DrawRoom(this.$mapContext, oldFocus, true);
                this.DrawRoom(this.$mapContext, this.$focusedRoom, true, true);
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
        this.$descriptionGrid.refresh();
    }

    private BuildMap() {
        Timer.start();
        if (this.$depth >= this.$mapSize.depth)
            this.$depth = this.$mapSize.depth - 1;
        if (this.$mapSize.right !== this.$map.width || this.$map.height !== this.$mapSize.bottom) {
            this.$map.width = this.$mapSize.right;
            this.$map.height = this.$mapSize.bottom;
            this.BuildAxises();
            this.DrawMap();
            setTimeout(() => {
                this.DrawMap();
            }, 500);
        }
        else
            this.doUpdate(UpdateType.drawMap);
        const cols = this.$exitGrid.columns;
        if (this.$mapSize.depth < 2) {
            this.$depth = 0;
            cols[3].visible = false;
            this.$roomEditor.setPropertyOptions({
                property: 'z',
                group: 'Location',
                readonly: true,
                visible: false
            });
        }
        else {
            this.$depthToolbar.value = '' + this.$depth;
            this.$depthToolbar.max = '' + (this.$mapSize.depth - 1);
            this.$depthToolbar.min = '' + 0;
            cols[3].visible = true;
            this.$roomEditor.setPropertyOptions({
                property: 'z',
                group: 'Location',
                readonly: true,
                visible: true
            });
        }
        this.$exitGrid.columns = cols;
        this.emit('rebuild-buttons');
        Timer.end('BuildMap time');
    }

    private BuildAxises() {
        while (this.$xAxis.firstChild)
            this.$xAxis.removeChild(this.$xAxis.firstChild);
        while (this.$yAxis.firstChild)
            this.$yAxis.removeChild(this.$yAxis.firstChild);
        this.$xAxis.style.width = this.$mapSize.right + 'px';
        this.$yAxis.style.height = this.$mapSize.bottom + 'px';
        let frag = document.createDocumentFragment();
        let el: HTMLElement;
        this.$xAxisHighlight.style.height = '100%';
        this.$yAxisHighlight.style.width = '100%';
        let x;
        const xl = this.$mapSize.width;
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
        const yl = this.$mapSize.height;
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

    private loadDescriptions() {
        let tmp;
        let idx;
        let row;
        let c;
        let len;
        let i;
        let dl;
        let rows;
        const data = this.$descriptionRaw.value.split('\n');
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
            tmp = data[idx].split(':');
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
        this.$descriptionGrid.rows = this.$descriptions;
        this.updateMaxTerrain(this.$descriptions.length);
    }

    private loadItems() {
        let tmp;
        let idx;
        let row;
        let c;
        let len;
        let tmp2;
        let dl;
        let i;
        let il;
        let rows;
        const data = this.$itemRaw.value.split('\n');
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
            tmp = row.items.split(':');
            tmp2 = row.description.split(':');
            if (tmp.length > 0) {
                row.children = [];
                for (i = 0, il = tmp.length; i < il; i++) {
                    if (i < tmp2.length)
                        row.children.push(
                            {
                                idx: '',
                                item: tmp[i],
                                description: tmp2[i],
                                tag: (c + 1) + '-' + i,
                                parentId: c
                            });
                    else
                        row.children.push(
                            {
                                idx: '',
                                item: tmp[i],
                                description: '',
                                tag: (c + 1) + '-' + i,
                                parentId: c
                            });
                }
            }
            rows.push(row);
        }
        this.$items = rows;
        this.$itemGrid.rows = this.$items;
    }

    private loadExits(noGrid?) {
        let tmp;
        let row;
        let c;
        let dl;
        let rows;
        let tmp2;
        const data = this.$externalRaw.value.split('\n');
        dl = data.length;
        if (dl === 0) return;
        rows = [];
        for (c = 0; c < dl; c++) {
            if (data[c].length === 0) continue;
            row = {
                enabled: true,
                x: 0,
                y: 0,
                z: 0,
                exit: '',
                dest: ''
            };
            if (data[c].startsWith('#')) {
                row.enabled = false;
                data[c] = data[c].substr(1);
            }
            tmp = data[c].split(':');
            tmp2 = tmp[0].split(',');
            row.x = +tmp2[0];
            if (tmp2.length > 1) row.y = +tmp2[1];
            if (tmp2.length > 2) row.z = +tmp2[2];
            if (tmp.length > 1) row.exit = tmp[1];
            if (tmp.length > 2) row.dest = tmp[2];
            rows.push(row);
        }
        this.$exits = rows;
        if (noGrid) return;
        this.$exitGrid.rows = this.$exits;
    }

    private reloadExits(noGrid?) {
        let r;
        const od = this.$exits || [];
        this.loadExits(noGrid);
        //store mouse coords for performance
        const mx = this.$mouse.rx;
        const my = this.$mouse.ry;
        let d;
        let dl;
        //Remove old exits
        for (d = 0, dl = od.length; d < dl; d++) {
            if (!od[d].enabled) continue;
            r = this.getRoom(od[d].x, od[d].y, od[d].z);
            r.ee &= ~RoomExits[od[d].exit];
            this.DrawRoom(this.$mapContext, r, true, r.at(mx, my));
        }
        //Add new exits
        for (d = 0, dl = this.$exits.length; d < dl; d++) {
            if (!this.$exits[d].enabled) continue;
            r = this.getRoom(this.$exits[d].x, this.$exits[d].y, this.$exits[d].z);
            r.ee |= RoomExits[this.$exits[d].exit];
            this.DrawRoom(this.$mapContext, r, true, r.at(mx, my));
        }
    }

    public openItems() {
        this.$roomEditor.beginEdit('items', true);
    }

    public openExternalExits() {
        this.$roomEditor.beginEdit('external', true);
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
        if (this.$mapSize.depth > 1)
            d = '/**\n * External virtual room ' + r.x + ', ' + r.y + ', ' + r.z + '\n * \n * An external room for virtual area\n * \n * @author {your name}\n * @created {date}\n * @typeof include\n * @doc /doc/build/virtual/generic_virtual\n * @doc /doc/build/room/Basic\n */\n';
        else
            d = '/**\n * External virtual room ' + r.x + ', ' + r.y + '\n * \n * An external room for virtual area\n * \n * @author {your name}\n * @created {date}\n * @typeof include\n * @doc /doc/build/virtual/generic_virtual\n * @doc /doc/build/room/Basic\n */\n';
        d += '#include <std.h>\n#include "../area.h"\n\ninherit (VIR + "baseroom.c");\n\n/**\n * Create\n *\n * Create the base virtual room, passing correct parameters to baseroom\n */\nvoid create()\n{\n   ::create(' + r.x + ', ' + r.y + ', ' + r.z + ', ' + r.terrain + ', ' + r.item + ', ' + r.exits + ');\n';
        let data;
        if (this.$descriptions.length > 0 && r.terrain >= 0 && r.terrain < this.$descriptions.length && this.$descriptions[r.terrain]) {
            data = this.$descriptions[r.terrain];
            t = [];
            if (data.light !== 0)
                t.push(`"light" : ${data.light}`);
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
            d += '   set_short("' + data.short + '");\n';
            d += '   set_long("';
            if (data.long.length > 70) {
                t = data.long.substr(0, 66);
                let tl = t.length;
                while (tl--) {
                    if (t.charAt(tl) === ' ') {
                        t.substr(0, tl);
                        break;
                    }
                }
                d += `"${t}"\n     `;
                d += formatString(data.long.substr(t.length), 5, 73);
            }
            else
                d += data.long + '");\n';
            if (data.terrain.length > 0 && data.terrain !== '0')
                d += '   set_terrain("' + data.terrain + '");\n';
            else if ((r.state & RoomStates.Water) === RoomStates.Water)
                d += '   set_terrain("water");\n';

            if (this.$items.length > 0 && r.item >= 0 && r.item < this.$items.length && this.$items[r.item] && this.$items[r.item].children.length > 0) {
                d += '   set_items( ([\n       ';
                const items = this.$items[r.item].children;
                d += items.map(i => {
                    return `"${i.item}" : "${i.description}"`;
                });
                d += '\n     ]) );\n';
            }
            if (data.smell.length > 0 && data.smell !== '0')
                d += '   set_smell("' + data.smell + '");\n';
            if (data.sound.length > 0 && data.sound !== '0')
                d += '   set_listen("' + data.sound + '");\n';
        }
        if (RoomExit.None !== r.exits) {
            d += '   set_exits( ([\n';
            if (this.$mapSize.depth > 1) {
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
            const rl = this.$exits.length;
            for (ri = 0; ri < rl; ri++) {
                if (!this.$exits[ri].enabled || +this.$exits[ri].x !== r.x || +this.$exits[ri].y !== r.y || +this.$exits[ri].z !== r.z)
                    continue;
                d += '       "' + this.$exits[ri].exit + '":"' + this.$exits[ri].dest + '",\n';
            }
            d += '     ]) );\n';
        }
        if ((r.state & RoomStates.Cold) === RoomStates.Cold)
            d += '   set_temperature(-200);\n';
        else if ((r.state & RoomStates.Hot) === RoomStates.Hot)
            d += '   set_temperature(200);\n';
        if ((r.state & RoomStates.SinkingUp) === RoomStates.SinkingUp || (r.state & RoomStates.SinkingDown) === RoomStates.SinkingDown)
            d += '   set_living_sink(1);\n';
        if ((r.state & RoomStates.SinkingUp) === RoomStates.SinkingUp && r.z + 1 < this.$mapSize.depth)
            d += `   set_up(VIR+"${r.x},${r.y},${r.z + 1}");\n`;
        if ((r.state & RoomStates.SinkingDown) === RoomStates.SinkingDown && r.z > 0 && this.$mapSize.depth > 1)
            d += `   set_down(VIR+"${r.x},${r.y},${r.z - 1}");\n`;
        d += '}';
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

    private updateMaxTerrain(t) {
        if (t > this.$maxTerrain) {
            this.$maxTerrain = t;
            this.$colorCache = null;
            this.doUpdate(UpdateType.drawMap);
        }
    }
}

export class FileOpenValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $editor: HTMLInputElement;
    private $value;

    public create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor-dropdown');
        this.$editor = document.createElement('input');
        this.$editor.type = 'text';
        this.$editor.readOnly = true;
        this.$editor.classList.add('property-grid-editor');
        this.$editor.addEventListener('blur', (e) => {
            if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'dropdown') {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return;
            }
            if (this.control.parent === e.relatedTarget)
                return;
            setTimeout(() => this.control.clearEditor(e));
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                setTimeout(() => this.control.clearEditor(e, this));
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            else if (e.keyCode === 27) {
                setTimeout(() => this.control.clearEditor(e, null, true));
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
        this.$editor.addEventListener('keydown', (e2) => {
            if (e2.keyCode === 27) {
                e2.preventDefault();
                e2.stopPropagation();
                return false;
            }
        });
        this.$el.appendChild(this.$editor);

        const vl = document.createElement('button');
        vl.title = 'Open file...';
        vl.innerHTML = '&hellip;';
        vl.dataset.editor = 'dropdown';
        vl.addEventListener('click', (e) => {
            this.control.emit('open-file', this.property);
            this.focus();
        });
        this.$el.appendChild(vl);
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$editor.focus();
    }
    public destroy() {
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() { /**/ }

    public openAdvanced() { /**/ }

    private formatValue(value?) {
        if (!value) value = this.$value;
        if (!value)
            return 'None';
        const ops = this.control.getPropertyOptions(this.property);
        if (ops && ops.formatter)
            return ops.formatter(this.property, value, this.data);
        if (this.options && this.options.enum)
            return enumToString(value, this.options.enum);
        if (typeof value === 'boolean')
            return capitalize('' + value);
        return value;
    }

    get value() {
        return this.$value;
    }
    set value(value: any) {
        this.$value = value;
        this.$editor.value = this.formatValue(value);
        resetCursor(this.$editor);
    }
}

export class FileBrowseValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $editor: HTMLInputElement;

    public create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor-dropdown');
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
            if (this.control.parent === e.relatedTarget)
                return;
            setTimeout(() => this.control.clearEditor(e));
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                setTimeout(() => this.control.clearEditor(e, this));
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            else if (e.keyCode === 27) {
                setTimeout(() => this.control.clearEditor(e, null, true));
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
        this.$editor.addEventListener('keydown', (e2) => {
            if (e2.keyCode === 27) {
                e2.preventDefault();
                e2.stopPropagation();
                return false;
            }
        });
        this.$el.appendChild(this.$editor);

        const vl = document.createElement('button');
        vl.title = 'Browse for file...';
        vl.innerHTML = '&hellip;';
        vl.dataset.editor = 'dropdown';
        vl.addEventListener('click', (e) => {
            const arg = { file: this.$editor.value, property: this.property, editor: this };
            this.control.emit('browse-file', arg);
            if (arg.file !== this.$editor.value)
                this.value = arg.file;
        });
        this.$el.appendChild(vl);
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$editor.focus();
    }
    public destroy() {
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() { /**/ }

    public openAdvanced() { /**/ }

    get value() {
        return this.$editor.value;
    }
    set value(value: any) {
        this.$editor.value = value;
        resetCursor(this.$editor);
    }
}

export class ExternalExitValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $editor: HTMLInputElement;
    private $value;
    private $edit;
    private $del;
    private $copy;
    private $cut;
    private $paste;
    private $dButton;

    public create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor-dropdown');
        this.$editor = document.createElement('input');
        this.$editor.type = 'text';
        this.$editor.readOnly = true;
        this.$editor.classList.add('property-grid-editor');
        this.$editor.addEventListener('blur', (e) => {
            if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'dropdown') {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return;
            }
            if (this.control.parent === e.relatedTarget)
                return;
            setTimeout(() => this.control.clearEditor(e));
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                setTimeout(() => this.control.clearEditor(e, this));
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return false;
            }
            else if (e.keyCode === 27) {
                setTimeout(() => this.control.clearEditor(e, null, true));
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return false;
            }
        });
        this.$editor.addEventListener('keydown', (e2) => {
            if (e2.keyCode === 27) {
                e2.preventDefault();
                e2.stopPropagation();
                e2.cancelBubble = true;
                return false;
            }
        });
        this.$el.appendChild(this.$editor);

        this.$dButton = document.createElement('button');
        this.$dButton.title = 'Edit external exits...';
        this.$dButton.innerHTML = '&hellip;';
        this.$dButton.dataset.editor = 'dropdown';
        this.$dButton.addEventListener('click', (e) => {
            const mDialog = <HTMLDialogElement>document.createElement('dialog');
            mDialog.style.width = '500px';
            mDialog.style.height = '300px';
            mDialog.style.padding = '5px';
            mDialog.addEventListener('close', () => {
                mDialog.remove();
                this.focus();
            });
            let header = document.createElement('div');
            header.classList.add('dialog-header');
            header.style.fontWeight = 'bold';
            let button = document.createElement('button');
            button.classList.add('close');
            button.type = 'button';
            button.dataset.dismiss = 'modal';
            button.addEventListener('click', () => {
                mDialog.close();
                mDialog.remove();
                this.focus();
            });
            button.innerHTML = '&times;';
            header.appendChild(button);
            let el = document.createElement('div');
            el.style.paddingTop = '2px';
            el.innerHTML = capitalize(this.control.getPropertyOptions(this.property, 'label') || this.property) + '&hellip;';
            header.appendChild(el);
            mDialog.appendChild(header);
            header = document.createElement('div');
            header.classList.add('dialog-body');
            header.style.paddingTop = '40px';
            mDialog.appendChild(header);
            el = document.createElement('div');
            el.classList.add('form-group', 'datagrid-standard');
            el.style.margin = '0';
            el.style.position = 'absolute';
            el.style.left = '5px';
            el.style.right = '5px';
            el.style.bottom = '60px';
            el.style.top = '38px';
            header.appendChild(el);
            const dg = new DataGrid(el);
            dg.enterMoveFirst = this.options ? this.options.enterMoveFirst : true;
            dg.enterMoveNext = this.options ? this.options.enterMoveNext : true;
            dg.on('browse-file', ed => {
                this.control.emit('browse-file', ed);
            });
            dg.clipboardPrefix = 'jiMUD/';
            dg.addColumns([
                {
                    label: 'Enabled',
                    field: 'enabled'
                },
                {
                    label: 'Exit',
                    field: 'exit',
                    editor: {
                        type: EditorType.dropdown,
                        options: {
                            container: mDialog,
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
                    spring: true,
                    width: 200,
                    editor: {
                        type: EditorType.custom,
                        editor: FileBrowseValueEditor,
                        show: (prop, value, object) => {
                            return value;
                        }
                    }
                }]);
            dg.addRows(this.$value.map(a => ({ ...a })));
            dg.on('selection-changed', () => {
                if (dg.selectedCount) {
                    this.$edit.removeAttribute('disabled');
                    this.$del.removeAttribute('disabled');
                    if (dg.selectedCount > 1)
                        this.$del.title = 'Delete exits';
                    else
                        this.$del.title = 'Delete exit';
                    this.$cut.removeAttribute('disabled');
                    this.$copy.removeAttribute('disabled');
                }
                else {
                    this.$edit.setAttribute('disabled', 'true');
                    this.$del.setAttribute('disabled', 'true');
                    this.$del.title = 'Delete exit(s)';
                    this.$cut.setAttribute('disabled', 'true');
                    this.$copy.setAttribute('disabled', 'true');
                }
            });
            dg.on('delete', (e2) => {
                if (dialog.showMessageBox(
                    remote.getCurrentWindow(),
                    {
                        type: 'warning',
                        title: 'Delete',
                        message: 'Delete selected exit' + (dg.selectedCount > 1 ? 's' : '') + '?',
                        buttons: ['Yes', 'No'],
                        defaultId: 1
                    })
                    === 1)
                    e2.preventDefault = true;
            });
            dg.on('cut', () => {
                if (dg.canPaste)
                    this.$paste.removeAttribute('disabled');
                else
                    this.$paste.setAttribute('disabled', 'true');
            });
            dg.on('copy', () => {
                if (dg.canPaste)
                    this.$paste.removeAttribute('disabled');
                else
                    this.$paste.setAttribute('disabled', 'true');
            });
            dg.on('add', e2 => {
                e2.data = {
                    enabled: true,
                    x: this.data.x,
                    y: this.data.y,
                    z: this.data.z,
                    exit: '',
                    dest: ''
                };
            });
            header = document.createElement('div');
            header.classList.add('dialog-footer');
            mDialog.appendChild(header);
            button = document.createElement('button');
            button.style.cssFloat = 'right';
            button.type = 'button';
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                mDialog.close();
                mDialog.remove();
                this.focus();
            });
            button.textContent = 'Cancel';
            header.appendChild(button);
            button = document.createElement('button');
            button.style.cssFloat = 'right';
            button.type = 'button';
            button.classList.add('btn', 'btn-primary');
            button.addEventListener('click', () => {
                if (dg.rows.length > 0)
                    this.data.ee = dg.rows.map(e2 => e2.enabled ? RoomExits[e2.exit.toLowerCase()] : 0).reduce((a, c) => a | c);
                else
                    this.data.ee = 0;
                this.value = dg.rows;
                mDialog.close();
                mDialog.remove();
                this.focus();
            });
            button.textContent = 'Ok';
            header.appendChild(button);
            el = document.createElement('div');
            el.classList.add('btn-group');
            el.style.cssFloat = 'left';
            button = document.createElement('button');
            button.type = 'button';
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.addNewRow();
            });
            button.title = 'Add exit';
            button.innerHTML = '<i class="fa fa-plus"></i>';
            el.appendChild(button);
            button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.beginEdit(dg.selected[0].row);
            });
            button.title = 'Edit exit';
            button.innerHTML = '<i class="fa fa-edit"></i>';
            this.$edit = button;
            el.appendChild(button);
            button = document.createElement('button');
            button.disabled = true;
            button.type = 'button';
            button.title = 'Delete exit(s)';
            button.classList.add('btn', 'btn-danger');
            button.addEventListener('click', () => {
                dg.delete();
            });
            button.innerHTML = '<i class="fa fa-trash"></i>';
            this.$del = button;
            el.appendChild(button);
            header.appendChild(el);

            //CUT COPY PASTE
            el = document.createElement('div');
            el.classList.add('btn-group');
            el.style.cssFloat = 'left';
            button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.cut();
            });
            button.title = 'Cut';
            button.innerHTML = '<i class="fa fa-cut"></i>';
            this.$cut = button;
            el.appendChild(button);
            button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.copy();
            });
            button.title = 'Copy';
            button.innerHTML = '<i class="fa fa-copy"></i>';
            this.$copy = button;
            el.appendChild(button);
            button = document.createElement('button');
            button.type = 'button';
            button.title = 'Paste';
            button.disabled = !dg.canPaste;
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.paste();
            });
            button.innerHTML = '<i class="fa fa-paste"></i>';
            this.$paste = button;
            el.appendChild(button);
            header.appendChild(el);

            document.body.appendChild(mDialog);
            mDialog.showModal();
        });
        this.$el.appendChild(this.$dButton);
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$editor.focus();
    }
    public destroy() {
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() { /**/ }

    public openAdvanced() {
        this.$dButton.click();
    }

    private formatValue(value?) {
        if (!value) value = this.$value;
        if (!value)
            return 'None';
        const ops = this.control.getPropertyOptions(this.property, 'formatter');
        if (ops)
            return ops(this.property, value, this.data);
        if (this.options && this.options.enum)
            return enumToString(value, this.options.enum);
        if (typeof value === 'boolean')
            return capitalize('' + value);
        return value;
    }

    get value() {
        return this.$value;
    }
    set value(value: any) {
        this.$value = value;
        this.$editor.value = this.formatValue(value);
        resetCursor(this.$editor);
    }
}

export class ItemsValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $editor: HTMLInputElement;
    private $value;
    private $edit;
    private $del;
    private $copy;
    private $cut;
    private $paste;
    private $dButton;

    public create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor-dropdown');
        this.$editor = document.createElement('input');
        this.$editor.type = 'text';
        this.$editor.readOnly = true;
        this.$editor.classList.add('property-grid-editor');
        this.$editor.addEventListener('blur', (e) => {
            if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'dropdown') {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return;
            }
            if (this.control.parent === e.relatedTarget)
                return;
            setTimeout(() => this.control.clearEditor(e));
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                setTimeout(() => this.control.clearEditor(e, this));
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return false;
            }
            else if (e.keyCode === 27) {
                setTimeout(() => this.control.clearEditor(e, null, true));
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return false;
            }
        });
        this.$editor.addEventListener('keydown', (e2) => {
            if (e2.keyCode === 27) {
                e2.preventDefault();
                e2.stopPropagation();
                return false;
            }
        });
        this.$el.appendChild(this.$editor);

        this.$dButton = document.createElement('button');
        this.$dButton.title = 'Edit items...';
        this.$dButton.innerHTML = '&hellip;';
        this.$dButton.dataset.editor = 'dropdown';
        this.$dButton.addEventListener('click', (e) => {
            const mDialog = <HTMLDialogElement>document.createElement('dialog');
            mDialog.style.width = '500px';
            mDialog.style.height = '300px';
            mDialog.style.padding = '5px';
            mDialog.addEventListener('close', () => {
                mDialog.remove();
                this.focus();
            });
            let header = document.createElement('div');
            header.classList.add('dialog-header');
            header.style.fontWeight = 'bold';
            let button = document.createElement('button');
            button.classList.add('close');
            button.type = 'button';
            button.dataset.dismiss = 'modal';
            button.addEventListener('click', () => {
                mDialog.close();
                mDialog.remove();
                this.focus();
            });
            button.innerHTML = '&times;';
            header.appendChild(button);
            let el = document.createElement('div');
            el.style.paddingTop = '2px';
            el.innerHTML = capitalize(this.control.getPropertyOptions(this.property, 'label') || this.property) + '&hellip;';
            header.appendChild(el);
            mDialog.appendChild(header);
            header = document.createElement('div');
            header.classList.add('dialog-body');
            header.style.paddingTop = '40px';
            mDialog.appendChild(header);
            el = document.createElement('div');
            el.classList.add('form-group', 'datagrid-standard');
            el.style.margin = '0';
            el.style.position = 'absolute';
            el.style.left = '5px';
            el.style.right = '5px';
            el.style.bottom = '60px';
            el.style.top = '38px';
            header.appendChild(el);
            const dg = new DataGrid(el);
            dg.enterMoveFirst = this.options ? this.options.enterMoveFirst : true;
            dg.enterMoveNext = this.options ? this.options.enterMoveNext : true;
            dg.clipboardPrefix = 'jiMUD/';
            dg.addColumns([{
                label: 'Item',
                field: 'item',
                width: 150,
                editor: {
                    options: {
                        container: mDialog,
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
                        container: mDialog
                    }
                }
            }]);
            dg.addRows(this.$value.map(a => ({ ...a })));
            dg.on('selection-changed', () => {
                if (dg.selectedCount) {
                    this.$edit.removeAttribute('disabled');
                    this.$del.removeAttribute('disabled');
                    if (dg.selectedCount > 1)
                        this.$del.title = 'Delete items';
                    else
                        this.$del.title = 'Delete item';
                    this.$cut.removeAttribute('disabled');
                    this.$copy.removeAttribute('disabled');
                }
                else {
                    this.$edit.setAttribute('disabled', 'true');
                    this.$del.setAttribute('disabled', 'true');
                    this.$del.title = 'Delete items(s)';
                    this.$cut.setAttribute('disabled', 'true');
                    this.$copy.setAttribute('disabled', 'true');
                }
            });
            dg.on('delete', (e2) => {
                if (dialog.showMessageBox(
                    remote.getCurrentWindow(),
                    {
                        type: 'warning',
                        title: 'Delete',
                        message: 'Delete selected item' + (dg.selectedCount > 1 ? 's' : '') + '?',
                        buttons: ['Yes', 'No'],
                        defaultId: 1
                    })
                    === 1)
                    e2.preventDefault = true;
            });
            dg.on('cut', () => {
                if (dg.canPaste)
                    this.$paste.removeAttribute('disabled');
                else
                    this.$paste.setAttribute('disabled', 'true');
            });
            dg.on('copy', () => {
                if (dg.canPaste)
                    this.$paste.removeAttribute('disabled');
                else
                    this.$paste.setAttribute('disabled', 'true');
            });
            dg.on('add', e2 => {
                e2.data = {
                    item: '',
                    description: ''
                };
            });
            header = document.createElement('div');
            header.classList.add('dialog-footer');
            mDialog.appendChild(header);
            button = document.createElement('button');
            button.style.cssFloat = 'right';
            button.type = 'button';
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                mDialog.close();
                mDialog.remove();
                this.focus();
            });
            button.textContent = 'Cancel';
            header.appendChild(button);
            button = document.createElement('button');
            button.style.cssFloat = 'right';
            button.type = 'button';
            button.classList.add('btn', 'btn-primary');
            button.addEventListener('click', () => {
                this.value = dg.rows;
                mDialog.close();
                mDialog.remove();
                this.focus();
            });
            button.textContent = 'Ok';
            header.appendChild(button);

            el = document.createElement('div');
            el.classList.add('btn-group');
            el.style.cssFloat = 'left';
            button = document.createElement('button');
            button.type = 'button';
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.addNewRow();
            });
            button.title = 'Add item';
            button.innerHTML = '<i class="fa fa-plus"></i>';
            el.appendChild(button);
            button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.beginEdit(dg.selected[0].row);
            });
            button.title = 'Edit item';
            button.innerHTML = '<i class="fa fa-edit"></i>';
            this.$edit = button;
            el.appendChild(button);
            button = document.createElement('button');
            button.disabled = true;
            button.type = 'button';
            button.title = 'Delete item(s)';
            button.classList.add('btn', 'btn-danger');
            button.addEventListener('click', () => {
                dg.delete();
            });
            button.innerHTML = '<i class="fa fa-trash"></i>';
            this.$del = button;
            el.appendChild(button);
            header.appendChild(el);

            //CUT COPY PASTE
            el = document.createElement('div');
            el.classList.add('btn-group');
            el.style.cssFloat = 'left';
            button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.cut();
            });
            button.title = 'Cut';
            button.innerHTML = '<i class="fa fa-cut"></i>';
            this.$cut = button;
            el.appendChild(button);
            button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.copy();
            });
            button.title = 'Copy';
            button.innerHTML = '<i class="fa fa-copy"></i>';
            this.$copy = button;
            el.appendChild(button);
            button = document.createElement('button');
            button.type = 'button';
            button.title = 'Paste';
            button.disabled = !dg.canPaste;
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.paste();
            });
            button.innerHTML = '<i class="fa fa-paste"></i>';
            this.$paste = button;
            el.appendChild(button);
            header.appendChild(el);
            document.body.appendChild(mDialog);
            mDialog.showModal();
        });
        this.$el.appendChild(this.$dButton);
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$editor.focus();
    }
    public destroy() {
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() { /**/ }

    public openAdvanced() {
        this.$dButton.click();
    }

    private formatValue(value?) {
        if (!value) value = this.$value;
        if (!value)
            return 'None';
        const ops = this.control.getPropertyOptions(this.property, 'formatter');
        if (ops)
            return ops(this.property, value, this.data);
        if (this.options && this.options.enum)
            return enumToString(value, this.options.enum);
        if (typeof value === 'boolean')
            return capitalize('' + value);
        return value;
    }

    get value() {
        return this.$value;
    }
    set value(value: any) {
        this.$value = value;
        this.$editor.value = this.formatValue(value);
        resetCursor(this.$editor);
    }
}