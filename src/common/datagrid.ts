//https://developers.google.com/web/updates/2016/10/resizeobserver
import EventEmitter = require('events');
import { capitalize, clone } from './library';
import { EditorType, TextValueEditor, BooleanValueEditor, NumberValueEditor, FlagValueEditor, DropDownEditValueEditor } from './value.editors';
export { EditorType, TextValueEditor, BooleanValueEditor, NumberValueEditor, FlagValueEditor, DropDownEditValueEditor } from './value.editors';
const ResizeObserver = require('resize-observer-polyfill');
const { clipboard, remote } = require('electron');
const { Menu } = remote;

export interface DataGridOptions {
    container?: any;
    parent?: any;
    object?: any;
    columns?: Column[];
    rows?: any[];
}

export enum UpdateType { none = 0, columns = 1, rows = 2, resize = 4, sort = 8, resizeHeight = 16, resizeWidth = 32, buildRows = 64, buildColumns = 128, headerWidth = 256 }

export class Column {
    public label = '';
    public type = 0;
    public field = null;
    public sortable = true;
    public visible = true;
    public formatter = (data) => {
        if (!data) return '&nbsp;';
        switch (typeof (data)) {
            case 'object':
                switch (typeof (data.cell)) {
                    case 'string':
                        if (data.cell.length === 0)
                            return '&nbsp;';
                        return data.cell;
                    case 'number':
                        return data.cell;
                    case 'boolean':
                        return capitalize('' + data.cell);
                }
                if (!data.cell)
                    return '&nbsp;';
                return data.cell.value || '&nbsp;';
            case 'string':
                if (data.length === 0)
                    return '&nbsp;';
                return data;
            case 'number':
                return data;
            case 'boolean':
                return capitalize('' + data);
        }
        return data.cell.value || '&nbsp;';
    };
    public align = '';
    public width = 100;
    public wrap = false;
    public spring = false;
    public editor = null;

    constructor(data) {
        if (data) {
            let prop;
            for (prop in data) {
                if (!data.hasOwnProperty(prop)) continue;
                this[prop] = data[prop];
            }
        }
    }
}

enum SortOrder { ascending, descending }

export class DataGrid extends EventEmitter {
    private $parent: HTMLElement;
    private $rows = [];
    private $sortedRows = [];
    private $sortedChildren = [];
    private $cols = [];
    private $springCols = [];
    private $colWidth = 470;
    private $hiddenColumnCount = 0;
    private $header: HTMLElement;
    private $body: HTMLElement;
    private $dataBody: HTMLElement;
    private _updating;
    private $dataWidth = 0;
    private $dataHeight = 0;
    private $headerWidth = 0;
    private $resizer;
    private $resizerCache;
    private $observer: MutationObserver;
    private $sort = { order: SortOrder.ascending, column: -1 };
    private $focused = -1;
    private $shiftStart = -1;

    private $editor;
    private $prevEditor;
    private $editorClick;

    private $asc: HTMLElement;
    private $desc: HTMLElement;
    private $nosort: HTMLElement;
    private $viewState = [];
    private $firstColumn = 0;

    private $selected = [];
    private $allowMultiSelection = true;
    private $children = false;

    private $key = '';
    private $keyClearID;

    public selectionSearchField;
    public clipboardPrefix = '';

    get showChildren() {
        return this.$children;
    }
    set showChildren(value) {
        if (value === this.$children) return;
        this.$children = value;
        this.doUpdate(UpdateType.columns | UpdateType.buildRows);
    }

    constructor(options?: any) {
        super();
        if (typeof options === 'string')
            this.parent = <any>options;
        else if (options instanceof $)
            this.parent = options;
        else if (options instanceof HTMLElement)
            this.parent = options;
        else if (options) {
            if (options.container)
                this.parent = options.container.container ? options.container.container : options.container;
            else if (options.parent)
                this.parent = options.parent;
            else
                this.parent = document.body;
            this.columns = options.columns;
            this.rows = options.rows;
        }
        else
            this.parent = document.body;
    }

    get id() { return this.parent.id; }
    set id(value) {
        if (value === this.$parent.id) return;
        this.$parent.id = this.id;
    }

    set allowMultipleSelection(value) {
        if (this.$allowMultiSelection === value) return;
        this.$allowMultiSelection = value;
        if (!this.$allowMultiSelection && this.$selected.length > 1) {
            Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
            this.$selected = this.$selected.slice(0, 1);
            (<HTMLElement>this.$body.firstChild).children[this.$selected[0]].classList.add('selected');
        }
    }
    get allowMultipleSelection() { return this.$allowMultiSelection; }

    set parent(parent) {
        if (typeof parent === 'string') {
            if ((<string>parent).startsWith('#'))
                this.$parent = document.getElementById((<string>parent).substr(1));
            else
                this.$parent = document.getElementById(parent);
        }
        else if (parent instanceof $)
            this.$parent = parent[0];
        else if (parent instanceof HTMLElement)
            this.$parent = parent;
        if (!this.$parent)
            this.$parent = document.body;
        this.createControl();
    }

    get parent(): HTMLElement { return this.$parent; }

    private createControl() {
        this.$asc = document.createElement('span');
        this.$asc.classList.add('datagrid-column-sorted-asc', 'fa', 'fa-caret-up');
        this.$desc = document.createElement('span');
        this.$desc.classList.add('datagrid-column-sorted-desc', 'fa', 'fa-caret-down');
        this.$nosort = document.createElement('span');
        this.$nosort.classList.add('datagrid-column-sorted-nosort');
        this.$nosort.innerHTML = '<span class="fa fa-caret-up"></span><span class="fa fa-caret-down"></span>';

        this.$parent.dataset.datagrid = 'true';
        this.$parent.classList.add('datagrid');
        this.$parent.tabIndex = 1;
        this.$parent.addEventListener('blur', (e) => {
            if (this.$parent.contains(<Node>e.relatedTarget))
                return;
            this.$parent.classList.remove('focused');
        });
        this.$parent.addEventListener('focus', (e) => {
            this.$parent.classList.add('focused');
            this.emit('focus', e);
        });

        this.$parent.addEventListener('keydown', (e) => {
            if (this.$editor) return;
            // tslint:disable-next-line:no-shadowed-variable
            let el;
            let idx;
            let start;
            let end;
            let cnt;
            switch (e.which) {
                case 32: //space
                    if (e.ctrlKey) {
                        if (this.$focused === -1) {
                            this.$focused = 0;
                        }
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
                        this.scrollToRow(el);
                        if (el.classList.contains('selected')) {
                            el.classList.remove('selected');
                            idx = this.$selected.indexOf(idx);
                            this.$selected.splice(idx, 1);
                        }
                        else {
                            if (this.$allowMultiSelection)
                                this.$selected.push(this.$focused);
                            else {
                                Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                                this.$selected = [this.$focused];
                            }
                            el.classList.add('selected');

                        }
                        this.$shiftStart = this.$focused;
                        this.emit('selection-changed');
                    }
                    break;
                case 38: //up
                    Array.from(this.$body.querySelectorAll('.focused'), a => a.classList.remove('focused'));
                    if (this.$focused < 1)
                        this.$focused = 0;
                    else if (this.$focused > 0)
                        this.$focused--;
                    if (e.ctrlKey) {
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
                        this.scrollToRow(el);
                    }
                    else if (e.shiftKey) {
                        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                        if (this.$selected.length === 0)
                            start = this.$focused !== -1 ? this.$focused : 0;
                        else if (this.$shiftStart !== -1)
                            start = this.$shiftStart;
                        else
                            start = this.$selected[0];
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
                        this.$selected = [];
                        if (!this.$allowMultiSelection) {
                            this.$selected = [this.$focused];
                            el.classList.add('selected');
                        }
                        else if (start > this.$focused) {
                            end = start;
                            start = this.$focused;
                            this.$shiftStart = end;
                            cnt = end - start + 1;
                            for (; end >= start; end--)
                                this.$selected.push(end);
                            while (el && cnt--) {
                                el.classList.add('selected');
                                el = <HTMLElement>el.nextSibling;
                            }
                        }
                        else {
                            end = this.$focused;
                            cnt = end - start + 1;
                            this.$shiftStart = start;
                            for (; start <= end; start++)
                                this.$selected.push(start);
                            while (el && cnt--) {
                                el.classList.add('selected');
                                el = <HTMLElement>el.previousSibling;
                            }
                        }
                    }
                    else {
                        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                        this.$selected = [this.$focused];
                        (<HTMLElement>this.$body.firstChild).children[this.$focused].classList.add('selected', 'focused');
                        this.scrollToRow((<HTMLElement>this.$body.firstChild).children[this.$focused]);
                        this.$shiftStart = this.$focused;
                    }
                    this.emit('selection-changed');
                    break;
                case 40: //down
                    Array.from(this.$body.querySelectorAll('.focused'), a => a.classList.remove('focused'));
                    if (this.$focused < (<HTMLElement>this.$body.firstChild).children.length - 1)
                        this.$focused++;
                    if (e.ctrlKey) {
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
                        this.scrollToRow(el);
                    }
                    else if (e.shiftKey) {
                        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                        if (this.$selected.length === 0)
                            start = this.$focused !== -1 ? this.$focused : 0;
                        else
                            start = this.$selected[0];
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
                        if (!this.$allowMultiSelection) {
                            this.$selected = [this.$focused];
                            el.classList.add('selected');
                        }
                        else if (start > this.$focused) {
                            end = start;
                            start = this.$focused;
                            cnt = end - start + 1;
                            for (; end >= start; end--)
                                this.$selected.push(end);
                            while (el && cnt--) {
                                el.classList.add('selected');
                                el = <HTMLElement>el.nextSibling;
                            }
                        }
                        else {
                            end = this.$focused;
                            cnt = end - start + 1;
                            for (; start <= end; start++)
                                this.$selected.push(start);
                            while (el && cnt--) {
                                el.classList.add('selected');
                                el = <HTMLElement>el.previousSibling;
                            }
                        }
                    }
                    else {
                        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                        this.$selected = [this.$focused];
                        (<HTMLElement>this.$body.firstChild).children[this.$focused].classList.add('selected', 'focused');
                        this.scrollToRow((<HTMLElement>this.$body.firstChild).children[this.$focused]);
                    }
                    this.emit('selection-changed');
                    break;
                case 110:
                case 46: //delete
                    this.delete();
                    break;
                case 65:
                    if (e.ctrlKey)
                        this.selectAll();
                    break;
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
            }
        });

        this.$parent.addEventListener('keypress', (e) => {
            if (!this.selectionSearchField || this.selectionSearchField.length === 0) return;

            this.$key += e.key.toLowerCase();
            const selected = this.$selected.slice();
            const field = this.selectionSearchField;
            let f = -1;
            let lSelected = -1;
            const rows = this.sortedRows;
            if (selected.length > 0)
                lSelected = selected[selected.length - 1];
            let row = rows.filter((r, i) => {
                if (lSelected !== -1) {
                    if (lSelected === i)
                        f = lSelected;
                    else if (f >= 0)
                        return r[field].toLowerCase().startsWith(this.$key);
                }
                else
                    return r[field].toLowerCase().startsWith(this.$key);
            });
            if (selected.length && row.length === 0) {
                this.clearSelection();
                row = rows.filter((r, i) => {
                    if (lSelected !== -1) {
                        if (lSelected === i)
                            f = lSelected;
                        else if (f >= 0)
                            return r[field].toLowerCase().startsWith(this.$key);
                    }
                    else
                        return r[field].toLowerCase().startsWith(this.$key);
                });
            }
            if (!row || row.length === 0) {
                this.$keyClearID = setTimeout(() => {
                    this.$key = '';
                }, 300);
                return;
            }
            row = row[0];
            this.clearSelection();
            const idx = this.$rows.indexOf(row);
            const sIdx = this.$sortedRows.indexOf(idx);
            this.select(sIdx);
            this.scrollToRow(sIdx);
            clearTimeout(this.$keyClearID);
            this.$keyClearID = setTimeout(() => {
                this.$key = '';
            }, 300);

        });
        this.$header = document.createElement('table');
        this.$header.classList.add('datagrid-header');
        this.$parent.appendChild(this.$header);

        const el = document.createElement('div');
        el.classList.add('datagrid-body');
        el.addEventListener('scroll', (e) => {
            this.$header.style.transform = 'translate(-' + (<HTMLElement>e.currentTarget).scrollLeft + 'px,0)';
            if (this.$editor && this.$editor.editors.length > 0)
                this.$editor.editors.map(ed => ed.editor.scroll());
        });
        el.addEventListener('contextmenu', (e) => {
            (<any>e).editor = this.$editor;
            this.emit('contextmenu', e);
            if (e.defaultPrevented) return;
            if (e.srcElement && this.$editor) {
                const row = e.srcElement.closest('tr.datagrid-row');
                if (row === this.$editor.el && !e.srcElement.classList.contains('datagrid-cell'))
                    return;
            }
            const temp = [];
            temp.push({
                label: 'Add',
                click: () => {
                    this.addNewRow();
                }
            });
            if (this.$selected.length > 0) {
                temp.push({
                    label: 'Edit',
                    click: () => {
                        const cEl = (<HTMLElement>(<HTMLElement>this.$body.firstChild).children[this.$selected[0]]);
                        const dataIndex = +cEl.dataset.dataIndex;
                        const parent = +cEl.dataset.parent;
                        if (parent === -1)
                            this.beginEdit(this.$sortedRows.indexOf(dataIndex));
                        else {
                            const child = +cEl.dataset.child;
                            this.beginEditChild(dataIndex, child);
                        }
                    }
                });
                temp.push({ type: 'separator' });
                temp.push({
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    click: () => {
                        this.cut();
                    }
                });
                temp.push({
                    label: 'Copy',
                    click: () => {
                        this.copy();
                    },
                    accelerator: 'CmdOrCtrl+C'
                });
            }
            if (this.canPaste) {
                if (temp.length === 1)
                    temp.push({ type: 'separator' });
                temp.push({
                    label: 'Paste',
                    click: () => {
                        this.paste();
                    },
                    accelerator: 'CmdOrCtrl+V'
                });
            }
            if (this.$selected.length > 0) {
                if (temp.length > 0)
                    temp.push({ type: 'separator' });
                temp.push({
                    label: 'Delete',
                    click: () => {
                        this.delete();
                    },
                    accelerator: 'Delete'
                });
            }
            if (this.$rows.length > 0) {
                if (temp.length > 0)
                    temp.push({ type: 'separator' });
                temp.push({
                    label: 'Select all',
                    click: () => {
                        this.selectAll();
                    },
                    accelerator: 'CmdOrCtrl+A'
                });
            }
            if (temp.length === 0) return;
            const inputMenu = Menu.buildFromTemplate(temp);
            inputMenu.popup({ window: remote.getCurrentWindow() });
        });
        this.$body = document.createElement('table');
        this.$body.classList.add('datagrid-body-data');
        this.$dataBody = document.createElement('tbody');
        this.$body.appendChild(this.$dataBody);
        this.$body.appendChild(document.createElement('tfoot'));
        this.$body.children[1].addEventListener('click', (e) => {
            this.clearSelection();
            this.clearEditor(e);
        });
        el.appendChild(this.$body);
        this.$parent.appendChild(el);
        window.addEventListener('resize', () => {
            this.doUpdate(UpdateType.resize);
        });
        this.$resizer = new ResizeObserver((entries, observer) => {
            if (entries.length === 0) return;
            if (entries[0].width === 0 || entries[0].height === 0)
                return;
            if (!this.$resizerCache || this.$resizerCache.width !== entries[0].width || this.$resizerCache.height !== entries[0].height) {
                this.$resizerCache = { width: entries[0].width, height: entries[0].height };
                this.doUpdate(UpdateType.columns | UpdateType.buildRows | UpdateType.resize);
            }
        });
        this.$resizer.observe(this.$parent);
        this.$observer = new MutationObserver((mutationsList) => {
            let mutation;
            for (mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (mutation.oldValue === 'display: none;' && (this.$dataHeight === 0 || this.$dataWidth === 0 || this.$headerWidth === 0))
                        this.doUpdate(UpdateType.columns | UpdateType.buildRows | UpdateType.resize);
                }
            }
        });
        this.$observer.observe(this.$parent, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
    }

    public cut() {
        if (this.$selected.length === 0) return;
        const e = {
            preventDefault: false,
            format: this.columns.map(c => c.label).join(':'),
            data: []
        };

        let prop;
        let oData;
        if (this.$sort.column < 0 || this.$sort.column >= this.$cols.length)
            oData = this.selected.sort((a, b) => {
                if ((a.parent === -1 && b.parent !== -1) || a.parent !== -1 && b.parent === -1) {
                    if (a.dataIndex > b.dataIndex)
                        return 1;
                    if (a.dataIndex < b.dataIndex)
                        return -1;
                    if (a.parent > b.parent)
                        return 1;
                    if (a.parent < b.parent)
                        return -1;
                    if (a.child < b.child)
                        return -1;
                    if (a.child < b.child)
                        return -1;
                    return 0;
                }
            });
        else {
            const data = this.selected;
            const sortFn = this.$cols[this.$sort.column].sort;
            const rows = this.$rows;
            if (this.$cols[this.$sort.column].hasOwnProperty('index'))
                prop = this.$cols[this.$sort.column].index;
            else if (this.$cols[this.$sort.column].hasOwnProperty('field'))
                prop = this.$cols[this.$sort.column].field;
            else
                prop = this.$sort.column;
            const dir = (this.$sort.order === SortOrder.descending) ? -1 : 1;
            oData = data.sort((a, b) => {
                if ((a.parent === -1 && b.parent !== -1) || a.parent !== -1 && b.parent === -1) {
                    if (a.dataIndex > b.dataIndex)
                        return 1 * dir;
                    if (a.dataIndex < b.dataIndex)
                        return -1 * dir;
                    if (a.parent > b.parent)
                        return 1 * dir;
                    if (a.parent < b.parent)
                        return -1 * dir;
                }
                if (sortFn)
                    return sortFn(a.dataIndex, b.dataIndex, dir, prop, rows[a], rows[b], rows);
                if (rows[a.dataIndex][prop] > rows[b.dataIndex][prop])
                    return 1 * dir;
                if (rows[a.dataIndex][prop] < rows[b.dataIndex][prop])
                    return -1 * dir;
                if (this.$children) {
                    if (!rows[a.dataIndex].children && !rows[b].children)
                        return 0;
                    if (!rows[a.dataIndex].children && rows[b.dataIndex].children)
                        return -1 * dir;
                    if (rows[a.dataIndex].children && !rows[b.dataIndex].children)
                        return 1 * dir;
                    const ap = this.$sortedChildren[a.dataIndex].map(c => rows[a.dataIndex].children[c][prop]).join(':');
                    const bp = this.$sortedChildren[b.dataIndex].map(c => rows[b.dataIndex].children[c][prop]).join(':');
                    if (ap > bp)
                        return 1 * dir;
                    if (ap < bp)
                        return -1 * dir;
                }
                return 0;
            });
        }

        const nData = [];
        const ol = oData.length;
        let p = -1;
        const oParents = [];
        for (let o = 0; o < ol; o++) {
            if (oData[o].parent === -1) {
                nData.push({
                    parent: oData[o].parent,
                    child: oData[o].child,
                    data: oData[o].data
                });
                oParents.push(oData[o].dataIndex);
            }
            else if (oParents.indexOf(oData[o].parent) !== -1)
                continue;
            else if (p === oData[o].parent)
                nData[nData.length - 1].data.children.push(oData[o].data);
            else {
                const parent = this.$rows.slice(oData[o].parent, oData[o].parent + 1)[0];
                parent.children = [oData[o].data];
                p = oData[o].parent;
                nData.push({
                    parent: -1,
                    child: -1,
                    data: parent
                });
            }
        }
        e.data = nData;

        this.emit('cut', e);
        if (e.preventDefault) return;
        clipboard.writeBuffer(this.clipboardPrefix + 'DataGrid', Buffer.from(JSON.stringify({
            format: e.format,
            data: e.data
        })));
        this.clearSelection();

        //get root and save only the data indexes
        const pRows = oData.filter(r => r.parent === -1).map(r => this.$rows.indexOf(r.data));
        //get children and only if parent not being removed, sort from low to high child to make sure higher indexes are removed first to prevent out of order issues
        const children = oData.filter(r => r.parent !== -1 && pRows.indexOf(r.parent) === -1).sort((a, b) => {
            if (a.child > b.child) return 1;
            if (a.child < b.child) return -1;
            return 0;
        });
        //do children first
        if (children.length > 0) {
            let cl = children.length;
            while (cl--) {
                this.$rows[children[cl].parent].children.splice(children[cl].child, 1);
            }
            this.doUpdate(UpdateType.buildRows | UpdateType.sort);
        }
        this.removeRows(pRows);
        this.emit('cut-done', e);
    }

    public copy() {
        if (this.$selected.length === 0) return;
        const e = {
            dataIndexes: this.selected.map(r => r.dataIndex),
            data: [],
            preventDefault: false
        };

        let prop;
        let oData;
        if (this.$sort.column < 0 || this.$sort.column >= this.$cols.length)
            oData = this.selected.sort((a, b) => {
                if ((a.parent === -1 && b.parent !== -1) || a.parent !== -1 && b.parent === -1) {
                    if (a.dataIndex > b.dataIndex)
                        return 1;
                    if (a.dataIndex < b.dataIndex)
                        return -1;
                    if (a.parent > b.parent)
                        return 1;
                    if (a.parent < b.parent)
                        return -1;
                    if (a.child < b.child)
                        return -1;
                    if (a.child < b.child)
                        return -1;
                    return 0;
                }
            });
        else {
            const data = this.selected;
            const sortFn = this.$cols[this.$sort.column].sort;
            const rows = this.$rows;
            if (this.$cols[this.$sort.column].hasOwnProperty('index'))
                prop = this.$cols[this.$sort.column].index;
            else if (this.$cols[this.$sort.column].hasOwnProperty('field'))
                prop = this.$cols[this.$sort.column].field;
            else
                prop = this.$sort.column;
            const dir = (this.$sort.order === SortOrder.descending) ? -1 : 1;
            oData = data.sort((a, b) => {
                if ((a.parent === -1 && b.parent !== -1) || a.parent !== -1 && b.parent === -1) {
                    if (a.dataIndex > b.dataIndex)
                        return 1 * dir;
                    if (a.dataIndex < b.dataIndex)
                        return -1 * dir;
                    if (a.parent > b.parent)
                        return 1 * dir;
                    if (a.parent < b.parent)
                        return -1 * dir;
                }
                if (sortFn)
                    return sortFn(a.dataIndex, b.dataIndex, dir, prop, rows[a], rows[b], rows);
                if (rows[a.dataIndex][prop] > rows[b.dataIndex][prop])
                    return 1 * dir;
                if (rows[a.dataIndex][prop] < rows[b.dataIndex][prop])
                    return -1 * dir;
                if (this.$children) {
                    if (!rows[a.dataIndex].children && !rows[b].children)
                        return 0;
                    if (!rows[a.dataIndex].children && rows[b.dataIndex].children)
                        return -1 * dir;
                    if (rows[a.dataIndex].children && !rows[b.dataIndex].children)
                        return 1 * dir;
                    const ap = this.$sortedChildren[a.dataIndex].map(c => rows[a.dataIndex].children[c][prop]).join(':');
                    const bp = this.$sortedChildren[b.dataIndex].map(c => rows[b.dataIndex].children[c][prop]).join(':');
                    if (ap > bp)
                        return 1 * dir;
                    if (ap < bp)
                        return -1 * dir;
                }
                return 0;
            });
        }
        const nData = [];
        const ol = oData.length;
        let p = -1;
        const oParents = [];
        for (let o = 0; o < ol; o++) {
            if (oData[o].parent === -1) {
                nData.push({
                    parent: oData[o].parent,
                    child: oData[o].child,
                    data: oData[o].data
                });
                oParents.push(oData[o].dataIndex);
            }
            else if (oParents.indexOf(oData[o].parent) !== -1)
                continue;
            else if (p === oData[o].parent)
                nData[nData.length - 1].data.children.push(oData[o].data);
            else {
                const parent = this.$rows.slice(oData[o].parent, oData[o].parent + 1)[0];
                parent.children = [oData[o].data];
                p = oData[o].parent;
                nData.push({
                    parent: -1,
                    child: -1,
                    data: parent
                });
            }
        }
        e.data = nData;

        this.emit('copy', e);
        if (e.preventDefault) return;
        clipboard.writeBuffer(this.clipboardPrefix + 'DataGrid', Buffer.from(JSON.stringify({
            format: this.columns.map(c => c.label).join(':'),
            data: e.data
        })));
    }

    get canPaste() {
        if (!clipboard.has(this.clipboardPrefix + 'DataGrid')) return false;
        const data = JSON.parse(clipboard.readBuffer(this.clipboardPrefix + 'DataGrid').toString());
        const format = this.columns.map(c => c.label).join(':');
        return format === data.format;
    }

    public paste() {
        if (!clipboard.has(this.clipboardPrefix + 'DataGrid')) return;
        const data = JSON.parse(clipboard.readBuffer(this.clipboardPrefix + 'DataGrid').toString());
        const format = this.columns.map(c => c.label).join(':');
        if (format === data.format) {
            const e = { data: data.data, preventDefault: false };
            this.emit('paste', e);
            if (e.preventDefault) return;
            this.addRows(e.data.filter(r => r.parent === -1).map(r => r.data));
            this.emit('paste-done', e);
        }
    }

    public addNewRow() {
        const data = {};
        const e = { data: data, preventDefault: false };

        const cols = this.$cols;
        let cl = cols.length;
        while (cl--) {
            if (cols[cl].hasOwnProperty('index'))
                data[cols[cl].index] = null;
            else if (cols[cl].hasOwnProperty('field'))
                data[cols[cl].field] = null;
        }
        this.emit('add', e);
        if (e.preventDefault) return;
        this.addRow(e.data);
        this.focus();
        this.beginEdit(this.$rows.length - 1);
        this.emit('add-done');
    }

    public delete() {
        if (this.$selected.length === 0) return;
        const e = {
            data: this.selected.map(c => {
                return {
                    parent: c.parent,
                    child: c.child,
                    data: c.data,
                    dataIndex: c.dataIndex
                };
            }),
            preventDefault: false
        };
        this.emit('delete', e);
        if (e.preventDefault) return;
        this.clearSelection();

        //get root and save only the data indexes
        const rows = e.data.filter(r => r.parent === -1).map(r => r.dataIndex);
        //get children and only if parent not being removed, sort from low to high child to make sure higher indexes are removed first to prevent out of order issues
        const children = e.data.filter(r => r.parent !== -1 && rows.indexOf(r.parent) === -1).sort((a, b) => {
            if (a.child > b.child) return 1;
            if (a.child < b.child) return -1;
            return 0;
        });
        //do children first
        if (children.length > 0) {
            let cl = children.length;
            while (cl--) {
                this.$rows[children[cl].parent].children.splice(children[cl].child, 1);
            }
            this.doUpdate(UpdateType.buildRows | UpdateType.sort);
        }
        this.removeRows(rows);
        this.emit('delete-done', e);
    }

    public selectAll() {
        if (!this.$allowMultiSelection) return;
        Array.from(this.$body.querySelectorAll('.datagrid-row'), a => a.classList.add('selected'));
        this.$selected = [...this.$sortedRows.keys()];
        this.emit('selection-changed');
    }

    public select(rows, scroll?) {
        if ((this._updating & UpdateType.sort) === UpdateType.sort) {
            setTimeout(() => {
                this.select(rows, scroll);
            }, 10);
            return;
        }
        if (!Array.isArray(rows))
            rows = [rows];
        else if (!this.$allowMultiSelection)
            rows = [rows[0]];
        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
        this.$selected = rows;
        this.$selected.map(r => {
            const el = <HTMLElement>(<HTMLElement>this.$body.firstChild).children[r];
            el.classList.add('selected');
        });
        if (scroll)
            this.scrollToRow(this.$selected[0]);
        this.emit('selection-changed');
    }

    public selectByDataIndex(indexes, scroll?) {
        if ((this._updating & UpdateType.sort) === UpdateType.sort) {
            setTimeout(() => {
                this.selectByDataIndex(indexes, scroll);
            }, 10);
            return;
        }
        if (!Array.isArray(indexes))
            indexes = [indexes];
        else if (!this.$allowMultiSelection)
            indexes = [indexes[0]];
        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
        this.$selected = indexes.map(i => this.$sortedRows.indexOf(i));
        const rows = <HTMLElement>(<HTMLElement>this.$body.firstChild);
        this.$selected.map(r => {
            if (r < 0 || r >= rows.children.length) return;
            const el = rows.children[r];
            if (el)
                el.classList.add('selected');
        });
        if (scroll)
            this.scrollToRow(this.$selected[0]);
        this.emit('selection-changed');
    }

    public clearSelection() {
        this.$selected = [];
        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
        this.emit('selection-changed');
    }

    public focus() {
        this.$parent.focus();
    }

    public addColumn(col) {
        if (!col) return;
        this.$cols.push(new Column(col));
        this.doUpdate(UpdateType.columns | UpdateType.buildRows);
    }

    public addColumns(cols) {
        if (!cols) return;
        let c;
        const cl = cols.length;
        for (c = 0; c < cl; c++)
            this.$cols.push(new Column(cols[c]));
        this.doUpdate(UpdateType.columns | UpdateType.buildRows);
    }

    public addRow(row) {
        if (!row) return;
        this.$rows.push(row);
        this.emit('rows-added');
        this.doUpdate(UpdateType.buildRows | UpdateType.sort);
    }

    public addRows(rows) {
        if (!rows) return;
        this.$editorClick = null;
        //this.$rows = this.$rows.concat(rows);
        this.$rows.push(...rows);
        this.emit('rows-added');
        this.doUpdate(UpdateType.buildRows | UpdateType.sort);
    }

    public removeRow(row) {
        if (typeof row !== 'number')
            row = this.$rows.indexOf(row);
        if (row === -1 || row >= this.$rows.length)
            return;
        this.$rows.splice(row, 1);
        this.emit('rows-removed');
        this.doUpdate(UpdateType.buildRows | UpdateType.sort);
    }

    public removeRows(rows) {
        rows = rows || [];
        if (rows.length === 0) return;
        //get index and filter out invalid index, sort smallest to largest index as you always want to remove largest ot smallest
        rows = rows.map((row) => {
            if (typeof row !== 'number')
                return this.$rows.indexOf(row);
            else
                return row;
        }).filter((row) => row >= 0 && row < this.$rows.length).sort();
        let idx = rows.length;
        while (idx--) {
            this.$rows.splice(rows[idx], 1);
        }
        this.emit('rows-removed');
        this.doUpdate(UpdateType.buildRows | UpdateType.sort);
    }

    get rows() { return this.$rows.slice(0); }
    set rows(value) {
        value = value || [];
        this.$rows = value;
        this.emit('rows-changed');
        this.doUpdate(UpdateType.rows | UpdateType.sort);
    }
    get columns() { return this.$cols.slice(0); }
    set columns(cols) {
        cols = cols || [];
        let cw = 0;
        const cl = cols.length;
        for (let c = 0; c < cl; c++) {
            cols[c] = new Column(cols[c]);
            cw = cols[c].width;
        }
        this.$colWidth = cw;
        this.$cols = cols;
        this.doUpdate(UpdateType.columns | UpdateType.buildRows);
    }

    public refresh() {
        this.doUpdate(UpdateType.rows | UpdateType.sort);
    }

    get selected() {
        if (this.$selected.length === 0)
            return [];
        const rows = [];
        let sl = this.$selected.length;
        let el;
        let dataIndex;
        let parent;
        let child;
        while (sl--) {
            el = (<HTMLElement>(<HTMLElement>this.$body.firstChild).children[this.$selected[sl]]);
            if (!el) continue;
            dataIndex = +el.dataset.dataIndex;
            parent = +el.dataset.parent;
            child = +el.dataset.child;
            if (parent === -1)
                rows.unshift({
                    data: this.$rows[dataIndex],
                    el: el,
                    parent: parent,
                    child: child,
                    row: this.$sortedRows[this.$selected[sl]],
                    index: this.$selected[sl],
                    dataIndex: dataIndex
                });
            else
                rows.unshift({
                    data: this.$rows[parent].children[child],
                    el: el,
                    row: this.$sortedRows[this.$selected[sl]],
                    parent: parent,
                    child: child,
                    index: this.$selected[sl],
                    dataIndex: dataIndex
                });
        }
        return rows;
    }

    get selectedCount() {
        return this.$selected.length;
    }

    public beginEdit(row, col?) {
        //sort pending delay
        if ((this._updating & UpdateType.sort) === UpdateType.sort) {
            setTimeout(() => {
                this.beginEdit(row, col);
            }, 10);
            return;
        }
        if (typeof row !== 'number')
            row = this.$rows.indexOf(row);
        row = this.$sortedRows.indexOf(row);
        if (row === -1)
            return;
        if (this.$selected.indexOf(row) === -1) {
            Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
            this.$selected = [row];
            this.emit('selection-changed');
        }
        this.$focused = row;
        const el = <HTMLElement>(<HTMLElement>this.$body.firstChild).children[row];
        el.classList.add('selected', 'focused');
        this.scrollToRow(row);
        this.createEditor(el, col);
    }

    public beginEditChild(parent, child, col?) {
        //sort pending delay
        if ((this._updating & UpdateType.sort) === UpdateType.sort) {
            setTimeout(() => {
                this.beginEditChild(parent, child, col);
            }, 10);
            return;
        }
        if (typeof parent !== 'number')
            parent = this.$rows.indexOf(parent);
        if (parent < 0 || parent >= this.$rows.length)
            return;
        if (typeof child !== 'number')
            child = this.$rows[parent].children.indexOf(child);
        if (child < 0 || parent >= this.$rows[parent].length)
            return;
        let e = this.$body.firstElementChild.querySelector('[data-parent="' + parent + '"][data-child="' + child + '"]');
        if (!e) {
            this.expandRows(this.$sortedRows.indexOf(parent));
            e = this.$body.firstElementChild.querySelector('[data-parent="' + parent + '"][data-child="' + child + '"]');
            if (!e) return;
        }
        const sIdx = [...e.parentElement.children].indexOf(e);
        if (this.$selected.indexOf(sIdx) === -1) {
            Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
            this.$selected = [sIdx];
            this.emit('selection-changed');
        }
        this.$focused = sIdx;
        const el = <HTMLElement>(<HTMLElement>this.$body.firstChild).children[sIdx];
        el.classList.add('selected', 'focused');
        this.scrollToRow(sIdx);
        this.createEditor(el, col);
    }

    public sort(column?, order?: SortOrder) {
        if (typeof column === 'object') {
            order = column.order || 0;
            column = column.column;
        }
        const oldColumn = this.$sort.column;
        const oldOrder = this.$sort.order;
        if (column !== undefined)
            this.$sort.column = column;
        if (order !== undefined)
            this.$sort.order = order;
        if (column !== undefined || order !== undefined) {
            if (column !== oldColumn && this.$header.children.length) {
                Array.from(this.$header.querySelectorAll('.datagrid-column-sorted'), a => a.classList.remove('datagrid-column-sorted'));
                Array.from(this.$body.querySelectorAll('.datagrid-cell-sorted'), a => a.classList.remove('datagrid-cell-sorted'));
                this.$header.children[0].children[this.$sort.column].classList.add('datagrid-column-sorted');
                Array.from(this.$body.querySelectorAll('.datagrid-row:nth-child(' + (column - this.$hiddenColumnCount) + ')'), a => a.classList.add('datagrid-cell-sorted'));
            }
            if (order !== oldOrder && this.$header.children.length) {
                Array.from(this.$header.querySelectorAll('.datagrid-column-sorted-desc'), a => a.parentElement.removeChild(a));
                Array.from(this.$header.querySelectorAll('.datagrid-column-sorted-asc'), a => a.parentElement.removeChild(a));
                Array.from(this.$header.querySelectorAll('.datagrid-column-sorted-nosort'), a => a.parentElement.removeChild(a));
                if (this.$sort.order)
                    this.$header.children[0].children[this.$sort.column].appendChild(this.$desc.cloneNode());
                else
                    this.$header.children[0].children[this.$sort.column].appendChild(this.$asc.cloneNode());
            }
            this.doUpdate(UpdateType.columns | UpdateType.buildRows);
        }
        const rows = this.$rows;
        //only copy if different lengths
        if (this.$sortedRows.length !== rows.length) {
            this.$sortedRows = [...rows.keys()];
            this.$sortedChildren = [...rows.keys()];
        }

        if (this.$sort.column < 0 || this.$sort.column >= this.$cols.length)
            return;
        this.clearSelection();
        let prop;
        const sortFn = this.$cols[this.$sort.column].sort;

        if (this.$cols[this.$sort.column].hasOwnProperty('index'))
            prop = this.$cols[this.$sort.column].index;
        else if (this.$cols[this.$sort.column].hasOwnProperty('field'))
            prop = this.$cols[this.$sort.column].field;
        else
            prop = this.$sort.column;

        const dir = (this.$sort.order === SortOrder.descending) ? -1 : 1;
        //sort children
        const rl = rows.length;
        for (let r = 0; r < rl; r++) {
            if (!rows[r].children)
                this.$sortedChildren[r] = [];
            else
                this.$sortedChildren[r] = [...rows[r].children.keys()].sort((a, b) => {
                    if (sortFn)
                        return sortFn(a, b, dir, prop, rows[r].children[a], rows[r].children[b], rows[r].children);
                    if (rows[r].children[a][prop] > rows[r].children[b][prop])
                        return 1 * dir;
                    if (rows[r].children[a][prop] < rows[r].children[b][prop])
                        return -1 * dir;
                    return 0;
                });
        }
        this.$sortedRows.sort((a, b) => {
            if (sortFn)
                return sortFn(a, b, dir, prop, rows[a], rows[b], rows);
            if (rows[a][prop] > rows[b][prop])
                return 1 * dir;
            if (rows[a][prop] < rows[b][prop])
                return -1 * dir;
            if (this.$children) {
                if (!rows[a].children && !rows[b].children)
                    return 0;
                if (!rows[a].children && rows[b].children)
                    return -1 * dir;
                if (rows[a].children && !rows[b].children)
                    return 1 * dir;
                const ap = this.$sortedChildren[a].map(c => rows[a].children[c][prop]).join(':');
                const bp = this.$sortedChildren[b].map(c => rows[b].children[c][prop]).join(':');
                if (ap > bp)
                    return 1 * dir;
                if (ap < bp)
                    return -1 * dir;
            }
            return 0;
        });
    }

    public get sortedRows() {
        const rows = this.rows;
        if (!this.$children)
            return this.$sortedRows.map(i => {
                return rows[i];
            });
        return this.$sortedRows.map(i => {
            if (rows[i].children)
                rows[i].children = this.$sortedChildren[i].map(c => rows[i].children[c]);
            return rows[i];
        });
    }

    public sortedChildren(i) {
        if (i < 0 || i >= this.$rows.length)
            return [];
        const rows = this.rows;
        if (!this.$sortedChildren || !Array.isArray(this.$sortedChildren[i]))
            return rows[i].children || [];
        return this.$sortedChildren[i].map(c => rows[i].children[c]);
    }

    private updateRows() {
        while (this.$body.children[0].firstChild)
            this.$body.children[0].removeChild(this.$body.children[0].firstChild);
        const rows = this.$rows;
        const sorted = this.$sortedRows;
        const frag = document.createDocumentFragment();
        let data;
        let child;
        let childLen;
        let cnt = 0;
        const l = sorted.length;
        for (let r = 0; r < l; r++) {
            data = rows[sorted[r]];
            frag.appendChild(this.generateRow(cnt, data, r, sorted[r]));
            cnt++;
            if (this.$children && data.children && this.$viewState[sorted[r]]) {
                for (child = 0, childLen = data.children.length; child < childLen; child++) {
                    frag.appendChild(this.generateRow(cnt, data.children[child], r, sorted[r], r, child));
                    cnt++;
                }
            }
        }
        this.$body.children[0].appendChild(frag);
        this.$dataWidth = this.$body.children[0].clientWidth;
        this.$dataHeight = this.$body.children[0].clientHeight;
        this.doUpdate(UpdateType.resize);
    }

    private buildRows() {
        while (this.$body.children[0].firstChild)
            this.$body.children[0].removeChild(this.$body.children[0].firstChild);
        while (this.$body.children[1].firstChild)
            this.$body.children[1].removeChild(this.$body.children[1].firstChild);
        const cols = this.$cols;
        let c;
        const cl = cols.length;
        const rows = this.$rows;
        const sorted = this.$sortedRows;
        const frag = document.createDocumentFragment();
        let row;
        let cell;
        let data;
        let child;
        let childLen;
        let cnt = 0;
        const l = sorted.length;
        for (let r = 0; r < l; r++) {
            data = rows[sorted[r]];
            frag.appendChild(this.generateRow(cnt, data, r, sorted[r]));
            cnt++;
            if (this.$children && data.children && this.$viewState[sorted[r]]) {
                for (child = 0, childLen = data.children.length; child < childLen; child++) {
                    frag.appendChild(this.generateRow(cnt, data.children[child], r, sorted[r], r, child));
                    cnt++;
                }
            }
        }
        this.$body.children[0].appendChild(frag);
        (row = document.createElement('tr')).classList.add('datagrid-row-spring');
        const sCol = this.$sort.column;
        let w;
        for (c = 0; c < cl; c++) {
            if (!cols[c].visible) continue;
            cell = document.createElement('td');
            cell.dataset.row = '' + rows.length;
            cell.dataset.column = '' + c;
            cell.dataset.field = cols[c].field || '';
            cell.dataset.index = '' + c;
            cell.classList.add('datagrid-cell');

            if (cols[c].sortable && c === sCol)
                cell.classList.add('datagrid-cell-sorted');
            if (cols[c].spring)
                cell.classList.add('datagrid-cell-spring');
            if (cols[c].class && cols[c].class.length > 0)
                cell.classList.add(...cols[c].class.split(' '));
            w = cols[c].width;
            cell.style.width = w + 'px';
            cell.style.minWidth = w + 'px';
            cell.style.maxWidth = w + 'px';
            row.appendChild(cell);
        }
        if (this.$springCols.length === 0) {
            (cell = document.createElement('td')).classList.add('datagrid-cell-spring');
            row.appendChild(cell);
        }
        this.$body.children[1].appendChild(row);
        this.$dataWidth = this.$body.children[0].clientWidth;
        this.$dataHeight = this.$body.children[0].clientHeight;
        this.doUpdate(UpdateType.resize);
    }

    private generateRow(cnt, data, r, dataIdx, parent = -1, child = -1) {
        const cols = this.$cols;
        let c;
        const cl = cols.length;
        let w;
        let cell;
        const sCol = this.$sort.column;
        const row = document.createElement('tr');
        row.classList.add('datagrid-row');
        if (r % 2 === 0)
            row.classList.add('datagrid-row-even');
        else
            row.classList.add('datagrid-row-odd');
        if (this.$selected.indexOf(cnt) !== -1)
            row.classList.add('selected');
        row.dataset.row = '' + r;
        row.dataset.parent = '' + parent;
        row.dataset.child = '' + child;
        row.dataset.dataIndex = '' + dataIdx;

        row.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.cancelBubble)
                return;
            let eRow = <HTMLElement>e.currentTarget;
            //var sIdx = +eRow.dataset.row;
            let sIdx = [...eRow.parentElement.children].indexOf(eRow);
            //var rowIdx = +(<HTMLElement>e.currentTarget);
            const eR = this.$sortedRows[sIdx];
            let el;
            this.emit('row-click', e, { row: this.$rows[eR], rowIndex: eR });
            Array.from(this.$body.querySelectorAll('.focused'), a => a.classList.remove('focused'));
            if (e.ctrlKey) {
                this.$focused = sIdx;
                if (eRow.classList.contains('selected')) {
                    eRow.classList.remove('selected');
                    if (this.$allowMultiSelection) {
                        sIdx = this.$selected.indexOf(sIdx);
                        this.$selected.splice(sIdx, 1);
                    }
                    else {
                        this.$selected = [];
                        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                    }
                }
                else if (!this.$allowMultiSelection) {
                    Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                    eRow.classList.add('selected');
                    this.$selected = [sIdx];
                }
                else {
                    eRow.classList.add('selected');
                    this.$selected.push(sIdx);
                }
                eRow.classList.add('focused');
                this.$shiftStart = this.$focused;
            }
            else if (e.shiftKey) {
                let start;
                let end;
                if (this.$selected.length === 0)
                    start = this.$focused !== -1 ? this.$focused : 0;
                else if (this.$shiftStart !== -1)
                    start = this.$shiftStart;
                else
                    start = this.$selected[0];
                Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                this.$selected = [];
                let eCnt;
                if (!this.$allowMultiSelection) {
                    this.$selected = [sIdx];
                    eRow.classList.add('selected');
                }
                else if (start > sIdx) {
                    end = start;
                    start = sIdx;
                    this.$shiftStart = end;
                    eCnt = end - start + 1;
                    for (; end >= start; end--)
                        this.$selected.push(end);

                    while (eRow && eCnt--) {
                        eRow.classList.add('selected');
                        eRow = <HTMLElement>eRow.nextSibling;
                    }
                }
                else {
                    end = sIdx;
                    eCnt = end - start + 1;
                    this.$shiftStart = start;
                    for (; start <= end; start++)
                        this.$selected.push(start);
                    while (eRow && eCnt--) {
                        eRow.classList.add('selected');
                        eRow = <HTMLElement>eRow.previousSibling;
                    }
                }
                this.$focused = sIdx;
                el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                el.classList.add('focused');
            }
            else {
                Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                this.$selected = [sIdx];
                eRow.classList.add('selected', 'focused');
                this.$focused = sIdx;
                this.$shiftStart = this.$focused;
            }
            this.emit('selection-changed');
            if (this.$editor && this.$editor.el !== eRow)
                this.clearEditor();
        });
        row.addEventListener('dblclick', (e) => {
            if (e.defaultPrevented || e.cancelBubble)
                return;
            const sIdx = +(<HTMLElement>e.currentTarget).dataset.row;
            const eR = +(<HTMLElement>e.currentTarget).dataset.dataIndex;
            const el = <HTMLElement>e.currentTarget;
            this.emit('row-dblclick', e, { row: this.$rows[eR], rowIndex: sIdx, parent: +el.dataset.parent, child: +el.dataset.child, dataIndex: eR });
            if (e.defaultPrevented || e.cancelBubble)
                return;
            Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
            this.$selected = [sIdx];
            this.$focused = sIdx;
            el.classList.add('selected', 'focused');
            this.createEditor(<HTMLElement>e.currentTarget, e.srcElement);
        });
        row.addEventListener('mousedown', (e) => {
            this.$editorClick = e.currentTarget;
            if (this.$editor && this.$editor.editors)
                this.$editor.editors.map(ed => ed.editorClick = this.$editorClick);
        });
        row.addEventListener('mouseup', (e) => {
            this.$editorClick = null;
            if (this.$editor && this.$editor.editors)
                this.$editor.editors.map(ed => ed.editorClick = null);
        });
        row.addEventListener('contextmenu', (e) => {
            this.emit('row-contextmenu', e);
        });
        for (c = 0; c < cl; c++) {
            if (!cols[c].visible) continue;
            w = cols[c].width;
            if (this.$children && c === this.$firstColumn)
                w += 40;
            let field = null;
            let idx = c;
            if (cols[c].hasOwnProperty('index'))
                idx = cols[c].index;
            else if (cols[c].hasOwnProperty('field'))
                field = cols[c].field;
            cell = document.createElement('td');
            cell.classList.add('datagrid-cell');
            if (cols[c].sortable && c === sCol)
                cell.classList.add('datagrid-cell-sorted');
            if (cols[c].wrap)
                cell.classList.add('datagrid-cell-wrap');
            if (cols[c].spring)
                cell.classList.add('datagrid-cell-spring');
            if (cols[c].class && cols[c].class.length > 0)
                cell.classList.add(...cols[c].class.split(' '));
            cell.style.width = w + 'px';
            cell.style.minWidth = w + 'px';
            cell.style.maxWidth = w + 'px';
            cell.style.textAlign = cols[c].align || '';
            if (cols[c].styleFormatter)
                cols[c].styleFormatter({ row: data, cell: data[field], rowIndex: r, column: c, index: idx, field: cols[c].field, rows: this.$rows, parent: parent, child: child, dataIndex: dataIdx });
            cell.dataset.row = '' + cnt;
            cell.dataset.column = '' + c;
            cell.dataset.field = cols[c].field || '';
            cell.dataset.index = '' + idx;
            cell.dataset.parent = '' + parent;
            cell.dataset.child = '' + child;
            cell.dataset.dataIndex = '' + dataIdx;
            let value = null;
            if (field)
                value = data[field];
            else if (idx < data.length)
                value = data[idx];

            if (cols[c].tooltipFormatter)
                cell.title = cols[c].tooltipFormatter({ row: data, cell: value, rowIndex: r, column: c, index: idx, field: cols[c].field, rows: this.$rows, parent: parent, child: child, dataIndex: dataIdx }) || '';
            else
                cell.title = value || '';
            if (cols[c].formatter)
                cell.innerHTML = cols[c].formatter({ row: data, cell: value, rowIndex: r, column: c, index: idx, field: cols[c].field, rows: this.$rows, parent: parent, child: child, dataIndex: dataIdx });
            else if (value && ('' + value).length > 0)
                cell.textContent = value;
            else
                cell.innerHTML = '&nbsp;';
            if (c === 0 && parent !== -1)
                cell.classList.add('datagrid-cell-child');
            else if (this.$children && c === this.$firstColumn && data.children && data.children.length > 0) {
                cell.classList.add('datagrid-cell-parent');
                const lbl = document.createElement('i');
                lbl.dataset.parent = r;
                if (this.$viewState[this.$sortedRows[r]])
                    lbl.classList.add('datagrid-collapse', 'fa', 'fa-chevron-down');
                else
                    lbl.classList.add('datagrid-collapse', 'fa', 'fa-chevron-right');
                cell.insertBefore(lbl, cell.firstChild);
                lbl.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.cancelBubble = true;
                    e.stopPropagation();
                    const eCurr = (<HTMLElement>e.currentTarget);
                    const rowEl = eCurr.parentElement.parentElement;
                    let eR: any = +eCurr.dataset.parent;
                    let sib = <HTMLElement>rowEl.nextElementSibling;
                    if (this.$viewState[this.$sortedRows[eR]]) {
                        eCurr.classList.remove('fa-chevron-down');
                        eCurr.classList.add('fa-chevron-right');
                        this.$viewState[this.$sortedRows[eR]] = false;
                        eR = '' + eR;
                        while (sib && sib.dataset.parent === eR) {
                            sib.style.display = 'none';
                            sib = <HTMLElement>sib.nextElementSibling;
                        }
                    }
                    else {
                        eCurr.classList.add('fa-chevron-down');
                        eCurr.classList.remove('fa-chevron-right');
                        this.$viewState[this.$sortedRows[eR]] = true;

                        if (rowEl.dataset.children !== 'true') {
                            if (this.$children && data.children) {
                                const sIdx = [...rowEl.parentElement.children].indexOf(rowEl);
                                const frag = document.createDocumentFragment();
                                const childLen = data.children.length;
                                this.$selected = this.$selected.map(s => {
                                    if (s > sIdx)
                                        return s + childLen;
                                    return s;
                                });
                                for (let eChild = 0; eChild < childLen; eChild++)
                                    frag.appendChild(this.generateRow(eR + eChild + 1, data.children[eChild], eR, eR, eR, eChild));
                                rowEl.parentNode.insertBefore(frag, rowEl.nextSibling);
                            }
                            rowEl.dataset.children = 'true';
                        }
                        else {
                            eR = '' + eR;
                            while (sib && sib.dataset.parent === eR) {
                                sib.style.display = '';
                                sib = <HTMLElement>sib.nextElementSibling;
                            }
                        }

                    }
                    //this.updateRows();
                    if (this.$springCols.length > 0) {
                        const sl = this.$springCols.length;
                        for (let s = 0; s < sl; s++) {
                            const children: HTMLElement[] = Array.from(this.$body.querySelectorAll('.datagrid-cell-spring:nth-child(' + (this.$springCols[s].index + 1 - this.$hiddenColumnCount) + ')'));
                            children.map(c2 => {
                                c2.style.width = this.$springCols[s].width + 'px';
                                c2.style.minWidth = this.$springCols[s].width + 'px';
                                c2.style.maxWidth = this.$springCols[s].width + 'px';
                            });
                        }
                    }
                    this.$dataWidth = this.$body.children[0].clientWidth;
                    this.$dataHeight = this.$body.children[0].clientHeight;
                    this.doUpdate(UpdateType.resize);
                });
            }
            else if (this.$children && c === this.$firstColumn)
                cell.classList.add('datagrid-cell-collapse-empty');
            cell.addEventListener('click', (e) => {
                if (e.defaultPrevented || e.cancelBubble)
                    return;
                const el = <HTMLElement>e.currentTarget;
                const eDataIdx = +el.dataset.dataIndex;
                const eField = el.dataset.field;
                const eParent = +el.dataset.parent;
                const eChild = +el.dataset.child;
                const eIdx = +el.dataset.idx;
                const col = +el.dataset.column;
                const eData = { row: null, cell: null, index: eIdx, column: col, rowIndex: +el.dataset.row, field: eField, parent: eParent, child: eChild, dataIndex: eDataIdx };
                if (eDataIdx >= 0 && eDataIdx < this.$rows.length) {
                    if (eParent === -1) {
                        eData.row = this.$rows[eDataIdx];
                        if (eField)
                            eData.cell = eData.row[eField];
                        else if (eIdx >= 0 && eIdx <= eData.row.length)
                            eData.cell = eData.row[eIdx];
                    }
                    else if (eParent >= 0 && eParent < this.$rows.length && eChild >= 0 && eChild < this.$rows[eParent].children.length) {
                        eData.row = this.$rows[eParent].children[eChild];
                        if (eField)
                            eData.cell = eData.row[eField];
                        else if (eIdx >= 0 && eIdx <= eData.row.length)
                            eData.cell = eData.row[eIdx];
                    }
                }
                this.emit('cell-click', e, eData);
                if (e.defaultPrevented || e.cancelBubble || this.$cols[col].readonly)
                    return;
                if (e.ctrlKey || e.shiftKey) {
                    if (this.$editor) {
                        e.preventDefault();
                        e.cancelBubble = true;
                        e.stopPropagation();
                    }
                    return;
                }
                //this.createEditor(el);
            });
            cell.addEventListener('dblclick', (e) => {
                if (e.defaultPrevented || e.cancelBubble)
                    return;
                const el = <HTMLElement>e.currentTarget;
                const eDataIdx = +el.dataset.dataIndex;
                const eField = el.dataset.field;
                const eParent = +el.dataset.parent;
                const eChild = +el.dataset.child;
                const eIdx = +el.dataset.idx;
                const col = +el.dataset.column;
                const eData = { row: null, cell: null, index: idx, column: col, rowIndex: +el.dataset.row, field: field, parent: parent, child: child, dataIndex: dataIdx };
                if (eDataIdx >= 0 && eDataIdx < this.$rows.length) {
                    if (eParent === -1) {
                        eData.row = this.$rows[eDataIdx];
                        if (eField)
                            eData.cell = eData.row[eField];
                        else if (eIdx >= 0 && eIdx <= eData.row.length)
                            eData.cell = eData.row[eIdx];
                    }
                    else if (eParent >= 0 && eParent < this.$rows.length && eChild >= 0 && eChild < this.$rows[eParent].children.length) {
                        eData.row = this.$rows[eParent].children[eChild];
                        if (eField)
                            eData.cell = eData.row[eField];
                        else if (eIdx >= 0 && eIdx <= eData.row.length)
                            eData.cell = eData.row[eIdx];
                    }
                }
                this.emit('cell-dblclick', e, data);
                if (e.defaultPrevented || e.cancelBubble || this.$cols[col].readonly)
                    return;
                if (e.ctrlKey || e.shiftKey) {
                    if (this.$editor) {
                        e.preventDefault();
                        e.cancelBubble = true;
                        e.stopPropagation();
                    }
                    return;
                }
            });
            row.appendChild(cell);
        }
        if (this.$springCols.length === 0) {
            (cell = document.createElement('td')).classList.add('datagrid-cell-spring');
            row.appendChild(cell);
        }
        return row;
    }

    private updateColumns() {
        while (this.$header.firstChild)
            this.$header.removeChild(this.$header.firstChild);
        this.$springCols = [];
        const cols = this.$cols;
        const row = document.createElement('tr');
        row.classList.add('datagrid-column-row');
        let cell: HTMLElement;
        const sCol = this.$sort.column;
        const sOrder = this.$sort.order;
        const cl = cols.length;
        for (let c = 0; c < cl; c++) {
            if (!cols[c].visible) continue;
            this.$firstColumn = c;
            break;
        }
        this.$hiddenColumnCount = cols.filter(c => !c.visible).length;
        for (let c = 0; c < cl; c++) {
            if (!cols[c].visible) continue;
            cell = document.createElement('td');
            cell.classList.add('datagrid-column');
            let w = cols[c].width;
            if (this.$children && c === this.$firstColumn) {
                cell.classList.add('datagrid-column-tree');
                w += 40;
            }
            if (cols[c].sortable) {
                cell.classList.add('datagrid-column-sortable');
                if (c === sCol)
                    cell.classList.add('datagrid-column-sorted');
                cell.addEventListener('click', (e) => {
                    Array.from(this.$header.querySelectorAll('.datagrid-column-sorted-desc'), a => a.parentElement.removeChild(a));
                    Array.from(this.$header.querySelectorAll('.datagrid-column-sorted-asc'), a => a.parentElement.removeChild(a));
                    Array.from(this.$header.querySelectorAll('.datagrid-column-sorted-nosort'), a => a.parentElement.removeChild(a));
                    const idx = +(<HTMLElement>e.currentTarget).dataset.index;
                    if (this.$sort.column === idx) {
                        if (this.$sort.order)
                            this.$sort.order = 0;
                        else
                            this.$sort.order = 1;
                    }
                    else {
                        Array.from(this.$header.querySelectorAll('.datagrid-column-sorted'), a => a.classList.remove('datagrid-column-sorted'));
                        Array.from(this.$body.querySelectorAll('.datagrid-cell-sorted'), a => a.classList.remove('datagrid-cell-sorted'));
                        (<HTMLElement>e.currentTarget).classList.add('datagrid-column-sorted');
                        Array.from(this.$body.querySelectorAll('.datagrid-row:nth-child(' + (idx - this.$hiddenColumnCount) + ')'), a => a.classList.add('datagrid-cell-sorted'));
                        this.$sort.column = idx;
                    }
                    if (this.$sort.order)
                        (<HTMLElement>e.currentTarget).appendChild(this.$desc.cloneNode());
                    else
                        (<HTMLElement>e.currentTarget).appendChild(this.$asc.cloneNode());
                    this.doUpdate(UpdateType.sort | UpdateType.buildRows);
                });
            }
            if (cols[c].spring) {
                this.$springCols.push({ width: cols[c].width, index: c });
                cell.classList.add('datagrid-column-spring');
            }
            if (cols[c].class && cols[c].class.length > 0)
                cell.classList.add(...cols[c].colClass.split(' '));
            cell.dataset.index = '' + c;
            cell.style.minWidth = w + 'px';
            cell.style.width = w + 'px';
            cell.style.textAlign = cols[c].align || '';
            if (cols[c].colStyleFormatter)
                cols[c].colStyleFormatter({ cell: cell, column: cols[c], columnIndex: c, text: cols[c].label });
            if (cols[c].colFormatter)
                cell.innerHTML = cols[c].colFormatter({ column: cols[c], columnIndex: c, text: cols[c].label });
            else
                cell.textContent = cols[c].label;
            if (cols[c].sortable) {
                if (c === sCol && sOrder)
                    cell.appendChild(this.$desc.cloneNode());
                else if (c === sCol)
                    cell.appendChild(this.$asc.cloneNode());
                else if (sCol === -1)
                    cell.appendChild(this.$nosort.cloneNode(true));

            }
            row.appendChild(cell);
        }
        cell = document.createElement('td');
        cell.classList.add('datagrid-column-spacer');
        row.appendChild(cell);
        this.$header.appendChild(row);
        this.doUpdate(UpdateType.resize | UpdateType.headerWidth);
    }

    private resize() {
        const style = window.getComputedStyle(this.$parent, null);
        //let h = parseInt(style.getPropertyValue('height'), 10);
        //let w = parseInt(style.getPropertyValue('width'), 10);
        let h = this.$parent.clientHeight;
        let w = this.$parent.clientWidth;
        h -= this.$header.offsetHeight;
        if (w < this.$colWidth)
            w = this.$colWidth;
        this.$body.parentElement.style.height = h + 'px';
        if (this.$header.clientWidth !== 0) {
            const spacer = <HTMLElement>this.$header.querySelector('.datagrid-column-spacer');
            if (this.$springCols.length > 1 || w < this.$header.clientWidth) {
                spacer.style.width = '24px';
                spacer.style.minWidth = '24px';
            }
            else {
                spacer.style.width = (w - this.$header.clientWidth) + 24 + 'px';
                spacer.style.minWidth = (w - this.$header.clientWidth) + 24 + 'px';
            }

        }
        this.resizeWidth();
        this.resizeHeight();
    }

    private resizeWidth() {
        if (this.$dataWidth === 0) return;
        let helper;
        let style;

        const spring: HTMLElement[] = Array.from(this.$header.querySelectorAll('.datagrid-cell-spring'));
        spring.map(s => {
            s.style.width = '0px';
            s.style.minWidth = '0px';
        });
        helper = document.createElement('div');
        this.$body.parentElement.appendChild(helper);
        style = window.getComputedStyle(helper, null);
        const hWidth = parseInt(style.getPropertyValue('width'), 10);
        if (this.$springCols.length > 0) {
            const cols = this.$header.querySelectorAll('.datagrid-column-spring');
            const sl = this.$springCols.length;
            let sw = (helper.clientWidth - this.$dataWidth) / sl;
            const r = sw % 1;
            sw = ~~sw;
            for (let s = 0; s < sl; s++) {
                const children: HTMLElement[] = Array.from(this.$body.querySelectorAll('.datagrid-cell-spring:nth-child(' + (this.$springCols[s].index + 1 - this.$hiddenColumnCount) + ')'));
                if (hWidth < this.$dataWidth) {
                    (<HTMLElement>cols[s]).style.width = this.$springCols[s].width + 'px';
                    (<HTMLElement>cols[s]).style.minWidth = this.$springCols[s].width + 'px';
                    children.map(c => {
                        c.style.width = this.$springCols[s].width + 'px';
                        c.style.minWidth = this.$springCols[s].width + 'px';
                        c.style.maxWidth = this.$springCols[s].width + 'px';
                    });
                }
                else {
                    if (r && s === sl - 1)
                        sw++;
                    (<HTMLElement>cols[s]).style.width = sw + this.$springCols[s].width + 'px';
                    (<HTMLElement>cols[s]).style.minWidth = sw + this.$springCols[s].width + 'px';
                    children.map(c => {
                        c.style.width = sw + this.$springCols[s].width + 'px';
                        c.style.minWidth = sw + this.$springCols[s].width + 'px';
                        c.style.maxWidth = sw + this.$springCols[s].width + 'px';
                    });

                }
            }
        }
        else if (hWidth < this.$dataWidth) {
            spring.map(s => {
                s.style.width = '0px';
                s.style.minWidth = '0px';
                s.style.display = 'none';
            });
        }
        else {
            spring.map(s => {
                s.style.width = '';
                s.style.minWidth = (helper.offsetWidth - this.$dataWidth) + 'px';
                s.style.display = (helper.offsetWidth - this.$dataWidth) + 'px';
            });
        }
        this.$body.parentElement.removeChild(helper);
    }

    private resizeHeight() {
        let helper;
        let h;
        const springRow = <HTMLElement>this.$body.querySelector('.datagrid-row-spring');
        if (this.$dataHeight === 0) {
            springRow.style.display = 'none';
            springRow.style.height = '0px';
            helper = document.createElement('div');
            helper.style.height = '100%';
            helper.style.position = 'absolute';
            helper.style.top = '0';
            helper.style.left = '0';
            helper.style.bottom = '0';
            this.$body.parentElement.appendChild(helper);
            h = helper.clientHeight;
            this.$body.parentElement.removeChild(helper);
            springRow.style.display = '';
            springRow.style.height = h + 'px';
            this.$header.style.transform = 'translate(-' + this.$body.parentElement.scrollLeft + 'px,0)';
            return;
        }
        let style;
        springRow.style.display = 'none';
        springRow.style.height = '0px';
        helper = document.createElement('div');
        helper.style.height = '100%';
        helper.style.position = 'absolute';
        helper.style.top = '0';
        helper.style.left = '0';
        helper.style.bottom = '0';
        this.$body.parentElement.appendChild(helper);
        h = helper.clientHeight;
        this.$body.parentElement.removeChild(helper);
        let dh;
        if (this.$rows.length > 0 && springRow.offsetTop === 0) {
            style = window.getComputedStyle(this.$body, null);
            dh = parseInt(style.getPropertyValue('height'), 10);
        }
        else
            dh = springRow.offsetTop;

        if (h >= this.$dataHeight) {
            springRow.style.display = '';
            springRow.style.height = (h - dh) + 'px';
        }
        this.$header.style.transform = 'translate(-' + this.$body.parentElement.scrollLeft + 'px,0)';
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
            if ((this._updating & UpdateType.headerWidth) === UpdateType.headerWidth) {
                this.$headerWidth = this.$header.clientWidth;
                this._updating &= ~UpdateType.headerWidth;
            }
            if ((this._updating & UpdateType.sort) === UpdateType.sort) {
                this.sort();
                this._updating &= ~UpdateType.sort;
            }
            if ((this._updating & UpdateType.columns) === UpdateType.columns) {
                this.updateColumns();
                this._updating &= ~UpdateType.columns;
            }
            if ((this._updating & UpdateType.rows) === UpdateType.rows) {
                this.updateRows();
                this._updating &= ~UpdateType.rows;
            }
            if ((this._updating & UpdateType.buildRows) === UpdateType.buildRows) {
                this.buildRows();
                this._updating &= ~UpdateType.buildRows;
            }
            if ((this._updating & UpdateType.resize) === UpdateType.resize) {
                this.resize();
                this._updating &= ~UpdateType.resize;
            }
            else {
                if ((this._updating & UpdateType.resizeHeight) === UpdateType.resizeHeight) {
                    this.resizeHeight();
                    this._updating &= ~UpdateType.resizeHeight;
                }
                if ((this._updating & UpdateType.resizeWidth) === UpdateType.resizeWidth) {
                    this.resizeWidth();
                    this._updating &= ~UpdateType.resizeWidth;
                }
            }
            this.doUpdate(this._updating);
        });
    }

    public toggleRows(rows) {
        if ((this._updating & UpdateType.rows) === UpdateType.rows || (this._updating & UpdateType.buildRows) === UpdateType.buildRows) {
            setTimeout(() => {
                this.toggleRows(rows);
            }, 10);
            return;
        }
        if (!Array.isArray(rows))
            rows = [rows];
        rows.map(r => {
            if (typeof r !== 'number')
                return this.$sortedRows.indexOf(this.$rows.indexOf(rows));
            return r;
        });
        rows.map(r => {
            const e = this.$body.firstElementChild.querySelector('[data-row="' + r + '"][data-parent="-1"]');
            if (!e) return;
            const nl = e.children[0].getElementsByClassName('datagrid-collapse');
            if (nl.length > 0)
                (<HTMLElement>nl[0]).click();
        });
    }

    public expandRows(rows) {
        return new Promise((resolve, reject) => {
            if ((this._updating & UpdateType.rows) === UpdateType.rows || (this._updating & UpdateType.buildRows) === UpdateType.buildRows) {
                setTimeout(() => {
                    this.expandRows(rows).then(resolve);
                }, 10);
                return;
            }
            if (!Array.isArray(rows))
                rows = [rows];
            rows.map(r => {
                if (typeof r !== 'number')
                    return this.$sortedRows.indexOf(this.$rows.indexOf(rows));
                return r;
            });
            rows.map(r => {
                if (this.$viewState[this.$sortedRows[r]])
                    return;
                const e = this.$body.firstElementChild.children[r];
                if (!e || e.children.length === 0) return;
                const nl = e.children[0].getElementsByClassName('datagrid-collapse');
                if (nl.length > 0)
                    (<HTMLElement>nl[0]).click();
            });
            resolve();
        });
    }

    public collapseRows(rows) {
        if ((this._updating & UpdateType.rows) === UpdateType.rows || (this._updating & UpdateType.buildRows) === UpdateType.buildRows) {
            setTimeout(() => {
                this.collapseRows(rows);
            }, 10);
            return;
        }
        if (!Array.isArray(rows))
            rows = [rows];
        rows.map(r => {
            if (typeof r !== 'number')
                return this.$sortedRows.indexOf(this.$rows.indexOf(rows));
            return r;
        });
        rows.map(r => {
            if (!this.$viewState[this.$sortedRows[r]])
                return;
            const e = this.$body.firstElementChild.querySelector('[data-row="' + r + '"][data-parent="-1"]');
            if (!e || e.children.length === 0) return;
            const nl = e.children[0].getElementsByClassName('datagrid-collapse');
            if (nl.length > 0)
                (<HTMLElement>nl[0]).click();
        });
    }

    public sortedIndex(row) {
        if (!row) return;
        return this.$sortedRows.indexOf(row);
    }

    public scrollToRow(row) {
        if ((this._updating & UpdateType.rows) === UpdateType.rows) {
            setTimeout(() => {
                this.scrollToRow(row);
            }, 10);
            return;
        }
        if (typeof row === 'number')
            row = this.$body.firstElementChild.children[row];
        if (!row) return;
        const top = row.offsetTop;
        const height = row.offsetHeight;
        const sTop = this.$body.parentElement.scrollTop;
        const sHeight = this.$body.parentElement.clientHeight;
        if (top + height >= sTop + sHeight)
            this.$body.parentElement.scrollTop = top - sHeight + height;
        else if (top < sTop)
            this.$body.parentElement.scrollTop = top;
    }

    public scrollToTop() {
        this.$body.parentElement.scrollTop = 0;
    }

    public getPropertyOptions(prop, ops?) {
        if (!prop || !this.$cols)
            return null;
        let col = this.$cols.filter(s => s.field === prop);
        if (col.length === 0) return;
        col = col[0];
        if (ops) {
            return col[ops];
        }
        return col;
    }

    public clearEditor(evt?) {
        if (!this.$editor) return;
        if (evt && evt.relatedTarget && (this.$editor.el.contains(evt.relatedTarget) || this.$editor.el.contains(evt.relatedTarget.editor)))
            return;

        let e = 0;
        const el = this.$editor.editors.length;
        this.$prevEditor = {
            el: el,
            editors: []
        };
        const oldObj = clone(this.$rows[this.$sortedRows[this.$editor.row]]);
        let changed = false;
        let dataIdx;
        let field;
        let parent;
        let child;
        let idx;
        let data;
        let col;
        let editor;
        for (; e < el; e++) {
            editor = this.$editor.editors[e];
            let value;
            let oldValue;
            const prop = editor.property;
            let eData;
            if (editor.editor) {
                value = editor.editor.value;
                eData = editor.editor.data;
            }
            oldValue = editor.data[editor.property];
            if (value !== oldValue) {
                editor.data[prop] = value;
                oldObj[prop] = oldValue;
                changed = true;
                col = this.$cols[editor.column];
                dataIdx = +editor.el.dataset.dataIndex;
                field = editor.el.dataset.field;
                parent = +editor.el.dataset.parent;
                child = +editor.el.dataset.child;
                idx = +editor.el.dataset.idx;
                data = { row: null, cell: null, index: idx, column: +editor.el.dataset.column, rowIndex: +editor.el.dataset.row, field: field, parent: parent, child: child, dataIndex: dataIdx };
                if (dataIdx >= 0 && dataIdx < this.$rows.length) {
                    if (parent === -1) {
                        data.row = this.$rows[dataIdx];
                        if (field)
                            data.cell = data.row[field];
                        else if (idx >= 0 && idx <= data.row.length)
                            data.cell = data.row[idx];
                    }
                    else if (parent >= 0 && parent < this.$rows.length && child >= 0 && child < this.$rows[parent].children.length) {
                        data.row = this.$rows[parent].children[child];
                        if (field)
                            data.cell = data.row[field];
                        else if (idx >= 0 && idx <= data.row.length)
                            data.cell = data.row[idx];
                    }
                }
                if (col.formatter) {
                    editor.el.textContent = col.formatter(data);
                    if (parent !== -1) {
                        const ep = this.$body.firstElementChild.querySelector('[data-data-index="' + parent + '"][data-parent="-1"]');
                        if (ep) {
                            const pIdx = [...ep.parentElement.children].indexOf(ep);
                            ep.children[editor.column].textContent = col.formatter({ row: this.$rows[parent], cell: field ? (this.$rows[parent][field]) : (idx >= 0 && idx < this.$rows[parent].length) ? this.$rows[parent][idx] : null, index: idx, column: +editor.el.dataset.column, rowIndex: pIdx, field: field, parent: -1, child: -1, dataIndex: parent });
                        }
                    }
                }
                else {
                    editor.el.textContent = value || '';
                }
            }
            if (editor.editor)
                editor.editor.destroy();
            this.$prevEditor.editors.push({
                el: editor.el,
                property: editor.property,
                type: editor.type
            });
            //do last in case the event changes the property editor
            if (value !== oldValue) {
                this.emit('cell-value-changed', {
                    new: value,
                    old: oldValue,
                    column: col,
                    dataIndex: dataIdx,
                    field: field,
                    parent: parent,
                    child: child,
                    index: idx,
                    eData: eData
                });
            }
        }
        if (changed) {
            if (parent !== -1)
                this.emit('value-changed', editor.data, oldObj.children[child], this.$sortedRows[this.$editor.row]);
            else
                this.emit('value-changed', editor.data, oldObj, this.$sortedRows[this.$editor.row]);
        }
        this.$editor = null;
        this.focus();
    }

    public createEditor(el: HTMLElement, fCol: any = 0) {
        if (!el) return;
        const row = [...el.parentElement.children].indexOf(el);
        if (fCol)
            fCol = [...fCol.parentElement.children].indexOf(fCol);
        const cols = this.$cols;
        if (this.$editor) {
            if (this.$editor && this.$editor.row === row)
                return;
            this.clearEditor();
        }
        let c;
        const cl = el.children.length;
        this.$editor = {
            el: el,
            editors: [],
            row: row
        };
        let cell;
        let prop;
        let col;
        let type;
        for (c = 0; c < cl; c++) {
            cell = <HTMLElement>el.children[c];
            prop = cell.dataset.field;
            col = +cell.dataset.column;
            if (cols[c].readonly) {
                fCol--;
                continue;
            }
            if (!prop) return;
            let editor = {
                el: cell,
                editor: null,
                property: prop,
                type: EditorType.default,
                column: col,
                row: row,
                data: null
            };
            type = this.editorType(col);
            let editorOptions;
            if (this.$cols[col] && this.$cols[col].editor) {
                editorOptions = this.$cols[col].editor.options;
                if (this.$cols[col].editor.hasOwnProperty('show')) {
                    if (typeof this.$cols[col].editor.show === 'function') {
                        if (!this.$cols[col].editor.show(col, { index: +el.dataset.idx, column: col, rowIndex: +el.dataset.row, field: el.dataset.field, parent: +el.dataset.parent, child: +el.dataset.child, dataIndex: +el.dataset.dataIndex })) {
                            editor = null;
                            return;
                        }
                    }
                    else if (!this.$cols[col].editor.show) {
                        editor = null;
                        return;
                    }

                }
            }
            if (!editorOptions)
                editorOptions = { container: this.$body };
            else if (!editorOptions.container)
                editorOptions.container = this.$body;
            editor.type = type;
            const dataIdx = +editor.el.dataset.dataIndex;
            const parent = +editor.el.dataset.parent;
            const child = +editor.el.dataset.child;
            let data;
            if (dataIdx >= 0 && dataIdx < this.$rows.length) {
                if (parent === -1)
                    data = this.$rows[dataIdx];
                else if (parent >= 0 && parent < this.$rows.length && child >= 0 && child < this.$rows[parent].children.length) {
                    data = this.$rows[parent].children[child];
                }
            }
            editor.data = data;
            switch (type) {
                case EditorType.flag:
                    editor.editor = new FlagValueEditor(this, cell, prop, editorOptions);
                    break;
                case EditorType.number:
                    editor.editor = new NumberValueEditor(this, cell, prop, editorOptions);
                    break;
                case EditorType.dropdown:
                    editor.editor = new DropDownEditValueEditor(this, cell, prop, editorOptions);
                    break;
                case EditorType.select:
                    break;
                case EditorType.custom:
                    if (this.$cols[col] && this.$cols[col].editor && this.$cols[col].editor.editor)
                        editor.editor = new this.$cols[col].editor.editor(this, cell, prop, editorOptions);
                    break;
                default:
                    switch (typeof (data[prop])) {
                        case 'boolean':
                            editor.editor = new BooleanValueEditor(this, cell, prop, editorOptions);
                            break;
                        case 'number':
                            editor.editor = new NumberValueEditor(this, cell, prop, editorOptions);
                            break;
                        default:
                            editor.editor = new TextValueEditor(this, cell, prop, editorOptions);
                            break;
                    }
                    break;
            }
            if (editor) {
                editor.editor.data = data;
                editor.editor.value = data[prop];
                this.$editor.editors.push(editor);
            }
        }
        if (this.$editor && this.$editor.editors.length) {
            if (fCol >= this.$editor.editors.length)
                fCol = this.$editor.editors.length - 1;
            else if (fCol < 0)
                fCol = 0;
            this.$editor.editors[fCol].editor.focus();
        }
    }

    private editorType(col) {
        if (col < 0 || col >= this.$cols.length)
            return EditorType.default;
        if (!this.$cols[col].editor)
            return EditorType.default;
        if (this.$cols[col].editor)
            return this.$cols[col].editor.type || EditorType.default;
        return EditorType.default;
    }

}