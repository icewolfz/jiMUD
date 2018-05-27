//https://developers.google.com/web/updates/2016/10/resizeobserver
import EventEmitter = require('events');
import { capitalize, resetCursor, stringToEnum, enumToString } from './library';
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from 'constants';
import { runInThisContext } from 'vm';
import { EditorType, TextValueEditor, BooleanValueEditor, NumberValueEditor, FlagValueEditor, DropdownEditValueEditor } from './value.editors';
const ResizeObserver = require('resize-observer-polyfill');

export interface DatagridOptions {
    container?: any;
    parent?: any;
    object?: any;
    columns?: Column[];
    rows?: any[];
}

export enum UpdateType { none = 0, columns = 1, rows = 2, resize = 4, sort = 8, resizeHeight = 16, resizeWidth = 32, buildRows = 64, buildColumns }

export class Column {
    public label = '';
    public type = 0;
    public field = null;
    public sortable = true;
    public visible = true;
    public formatter = (data) => {
        if (!data) return '&nbsp;';
        switch (typeof (data.cell)) {
            case "string":
                if(data.cell.length === 0)
                    return '&nbsp;';
                return data.cell;
            case "number":
            case "boolean":
                return data.cell;
        }
        if (!data.cell)
            return '&nbsp;';
        return data.cell.value || '&nbsp;';
    };
    public align = '';
    public width = 100;
    public wrap = false;
    public spring = false;
    public editor = null;

    constructor(data) {
        if (data) {
            for (var prop in data) {
                if (!data.hasOwnProperty(prop)) continue;
                this[prop] = data[prop];
            }
        }
    }
}

enum SortOrder { ascending, descending }

export class Datagrid extends EventEmitter {
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

    private $children = false;

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
        })

        this.$parent.addEventListener('keydown', (e) => {
            if (this.$editor) return;
            var el, idx;
            var start, end, cnt;
            switch (e.which) {
                case 32://space
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
                            el.classList.add('selected');
                            this.$selected.push(this.$focused);
                        }
                        this.$shiftStart = this.$focused;
                        this.emit('selection-changed');
                    }
                    break;
                case 38://up
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
                        var start, end;
                        if (this.$selected.length === 0)
                            start = this.$focused != -1 ? this.$focused : 0;
                        else if (this.$shiftStart !== -1)
                            start = this.$shiftStart;
                        else
                            start = this.$selected[0];
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        this.$selected = [];
                        if (start > this.$focused) {
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
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
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
                case 40://down
                    Array.from(this.$body.querySelectorAll('.focused'), a => a.classList.remove('focused'));
                    if (this.$focused < (<HTMLElement>this.$body.firstChild).children.length)
                        this.$focused++;
                    if (e.ctrlKey) {
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
                        this.scrollToRow(el);
                    }
                    else if (e.shiftKey) {
                        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                        var start, end;
                        if (this.$selected.length === 0)
                            start = this.$focused != -1 ? this.$focused : 0;
                        else
                            start = this.$selected[0];
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        if (start > this.$focused) {
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
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
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
                    //TODO get row data index, row and other data and send to event
                    this.emit('delete-row');
                    break;
            }
        })

        this.$header = document.createElement('table');
        this.$header.classList.add('datagrid-header');
        this.$parent.appendChild(this.$header);

        var el = document.createElement('div');
        el.classList.add('datagrid-body');
        el.addEventListener('scroll', (e) => {
            this.$header.style.transform = 'translate(-' + (<HTMLElement>e.currentTarget).scrollLeft + ',0)';
        })
        this.$body = document.createElement('table');
        this.$body.classList.add('datagrid-body-data');
        this.$dataBody = document.createElement('tbody');
        this.$body.appendChild(this.$dataBody);
        this.$body.appendChild(document.createElement('tfoot'));
        this.$body.children[1].addEventListener('click', (e) => {
            this.$selected = [];
            Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
            this.emit('selection-changed');
        })
        el.appendChild(this.$body);
        this.$parent.appendChild(el);
        window.addEventListener('resize', () => {
            this.doUpdate(UpdateType.resize);
        })
        this.$resizer = new ResizeObserver((entries, observer) => {
            this.doUpdate(UpdateType.resize);
        })
        this.$resizer.observe(this.$parent);
        this.$observer = new MutationObserver((mutationsList) => {
            for (var mutation of mutationsList) {
                if (mutation.type == 'attributes' && mutation.attributeName === 'style') {
                    if (mutation.oldValue === 'display: none;' && (this.$dataHeight === 0 || this.$dataWidth === 0 || this.$headerWidth === 0))
                        this.doUpdate(UpdateType.columns | UpdateType.rows | UpdateType.resize);
                }
            }
        });
        this.$observer.observe(this.$parent, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
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
        for (var c = 0, cl = cols.length; c < cl; c++)
            this.$cols.push(new Column(cols[c]));
        this.doUpdate(UpdateType.columns | UpdateType.buildRows);
    }

    public addRow(row) {
        if (!row) return;
        this.$rows.push(row);
        this.doUpdate(UpdateType.buildRows | UpdateType.sort);
    }

    public addRows(rows) {
        if (!rows) return;
        this.$editorClick = null;
        this.$rows = this.$rows.concat(rows);
        this.doUpdate(UpdateType.buildRows | UpdateType.sort);
    }

    public removeRow(row) {
        if (typeof row !== 'number')
            row = this.$rows.indexOf(row);
        if (row === -1 || row >= this.$rows.length)
            return;
        this.$rows.splice(row, 1);
        this.doUpdate(UpdateType.buildRows | UpdateType.sort);
    }

    public removeRows(rows) {
        rows = rows || [];
        //get index and filter out invalid index
        rows.map((row) => {
            if (typeof row !== 'number')
                this.$rows.indexOf(row);
            else
                row
        }).filter((row) => row < 0 || row >= this.$rows.length);
        var row = rows.length;
        while (row--) {
            this.$rows.splice(rows[row], 1);
        }
        this.doUpdate(UpdateType.buildRows | UpdateType.sort);
    }

    get rows() { return this.$rows.slice(0); }
    set rows(value) {
        value = value || [];
        this.$rows = value;
        this.doUpdate(UpdateType.rows | UpdateType.sort);
    }
    get columns() { return this.$cols.slice(0); }
    set columns(cols) {
        cols = cols || [];
        var cw = 0;
        for (var c = 0, cl = cols.length; c < cl; c++) {
            cols[c] = new Column(cols[c]);
            cw = cols[c].width;
        }
        this.$colWidth = cw;
        this.$cols = cols;
        this.doUpdate(UpdateType.columns | UpdateType.buildRows);
    }

    get selected() {
        if (this.$selected.length === 0)
            return [];
        var rows = [];
        var sl = this.$selected.length;
        while (sl--) {
            var el = (<HTMLElement>(<HTMLElement>this.$body.firstChild).children[this.$selected[sl]]);
            var dataIndex = +el.dataset.dataIndex;
            var parent = +el.dataset.parent;
            var child = +el.dataset.child;
            if (parent === -1)
                rows.unshift({
                    data: this.$rows[dataIndex],
                    el: el,
                    parent: parent,
                    child: child,
                    index: this.$selected[sl],
                    dataIndex: dataIndex,
                    beginEdit: () => {
                        this.createEditor(el);
                    },

                });
            else
                rows.unshift({
                    data: this.$rows[parent].children[child],
                    el: el,
                    parent: parent,
                    child: child,
                    index: this.$selected[sl],
                    dataIndex: dataIndex,
                    beginEdit: () => {
                        this.createEditor(el);
                    }
                });
        }
        return rows;
    }

    get selectedCount() {
        return this.$selected.length;
    }

    public sort(column?, order?: SortOrder) {
        if (typeof column === 'object') {
            order = column.order || 0;
            column = column.column
        }
        var oldColumn = this.$sort.column, oldOrder = this.$sort.order;
        if (column !== undefined)
            this.$sort.column = column;
        if (order !== undefined)
            this.$sort.order = order;
        if (column !== undefined || order !== undefined) {
            if (column != oldColumn && this.$header.children.length) {
                Array.from(this.$header.querySelectorAll('.datagrid-column-sorted'), a => a.classList.remove('datagrid-column-sorted'));
                Array.from(this.$body.querySelectorAll('.datagrid-cell-sorted'), a => a.classList.remove('datagrid-cell-sorted'));
                this.$header.children[0].children[this.$sort.column].classList.add('datagrid-column-sorted');
                Array.from(this.$body.querySelectorAll('.datagrid-row:nth-child(' + (column - this.$hiddenColumnCount) + ')'), a => a.classList.add('datagrid-cell-sorted'));
            }
            if (order != oldOrder && this.$header.children.length) {
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
        var rows = this.$rows;
        //only copy if different lengths
        if (this.$sortedRows.length != rows.length) {
            this.$sortedRows = [...rows.keys()];
            this.$sortedChildren = [...rows.keys()];
        }

        if (this.$sort.column < 0 || this.$sort.column >= this.$cols.length)
            return;
        this.$selected = [];
        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
        this.emit('selection-changed');
        var prop;
        if (this.$cols[this.$sort.column].hasOwnProperty('index'))
            prop = this.$cols[this.$sort.column].index;
        else if (this.$cols[this.$sort.column].hasOwnProperty('field'))
            prop = this.$cols[this.$sort.column].field;
        else
            prop = this.$sort.column;

        var dir = (this.$sort.order === SortOrder.descending) ? -1 : 1;
        //sort children
        for (var r = 0, rl = rows.length; r < rl; r++) {
            if (!rows[r].children)
                this.$sortedChildren[r] = [];
            else
                this.$sortedChildren[r] = [...rows[r].children.keys()].sort((a, b) => {
                    if (rows[r].children[a][prop] > rows[r].children[b][prop])
                        return 1 * dir;
                    if (rows[r].children[a][prop] < rows[r].children[b][prop])
                        return -1 * dir;
                    return 0;
                });
        };
        this.$sortedRows.sort((a, b) => {
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
                var ap = this.$sortedChildren[a].map(c => rows[a].children[c][prop]).join(':');
                var bp = this.$sortedChildren[b].map(c => rows[b].children[c][prop]).join(':');
                if (ap > bp)
                    return 1 * dir;
                if (ap < bp)
                    return -1 * dir;
            }
            return 0;
        });
    }

    public get sortedRows() {
        var rows = this.rows;
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
        var rows = this.rows;
        if (!this.$sortedChildren || !Array.isArray(this.$sortedChildren[i]))
            return rows[i].children || [];
        return this.$sortedChildren[i].map(c => rows[i].children[c]);
    }

    private updateRows() {
        /*
        if (this.$springCols.length > 0) {
            for (var s = 0, sl = this.$springCols.length; s < sl; s++) {
                var children: HTMLElement[] = Array.from(this.$body.querySelectorAll('.datagrid-cell-spring:nth-child(' + (this.$springCols[s].index + 1 - this.$hiddenColumnCount) + ')'));
                children.map(c => {
                    c.style.width = this.$springCols[s].width + 'px';
                    c.style.minWidth = this.$springCols[s].width + 'px';
                    c.style.maxWidth = this.$springCols[s].width + 'px';
                });
            }
        }
        */
        while (this.$body.children[0].firstChild)
            this.$body.children[0].removeChild(this.$body.children[0].firstChild);
        var cols = this.$cols;
        var c, cl = cols.length;
        var rows = this.$rows;
        var sorted = this.$sortedRows;
        var frag = document.createDocumentFragment();
        var row, cell, data;
        var child, childLen;
        var cnt = 0;
        for (var r = 0, l = sorted.length; r < l; r++) {
            data = rows[sorted[r]]
            frag.appendChild(this.generateRow(cnt, data, r, sorted[r]));
            cnt++;
            if (this.$children && data.children && this.$viewState[this.$sortedRows[r]]) {
                for (child = 0, childLen = data.children.length; child < childLen; child++) {
                    frag.appendChild(this.generateRow(cnt, data.children[child], r, sorted[r], r, child));
                    cnt++
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
        var cols = this.$cols;
        var c, cl = cols.length;
        var rows = this.$rows;
        var sorted = this.$sortedRows;
        var frag = document.createDocumentFragment();
        var row, cell, data;
        var child, childLen;
        var cnt = 0;
        for (var r = 0, l = sorted.length; r < l; r++) {
            data = rows[sorted[r]]
            frag.appendChild(this.generateRow(cnt, data, r, sorted[r]));
            cnt++;
            if (this.$children && data.children && this.$viewState[this.$sortedRows[r]]) {
                for (child = 0, childLen = data.children.length; child < childLen; child++) {
                    frag.appendChild(this.generateRow(cnt, data.children[child], r, sorted[r], r, child));
                    cnt++;
                }
            }
        }
        this.$body.children[0].appendChild(frag);
        (row = document.createElement('tr')).classList.add('datagrid-row-spring');
        var sCol = this.$sort.column;
        var w;
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
        var cols = this.$cols;
        var c, cl = cols.length;
        var w;
        var cell;
        var sCol = this.$sort.column;
        var row = document.createElement('tr');
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
            var row = <HTMLElement>e.currentTarget;
            //var sIdx = +row.dataset.row;
            var sIdx = [...row.parentElement.children].indexOf(row);
            //var rowIdx = +(<HTMLElement>e.currentTarget);
            var r = this.$sortedRows[sIdx];
            var el;
            this.emit('row-click', e, { row: this.$rows[r], rowIndex: r });
            Array.from(this.$body.querySelectorAll('.focused'), a => a.classList.remove('focused'));
            if (e.ctrlKey) {
                this.$focused = sIdx;
                if (row.classList.contains('selected')) {
                    row.classList.remove('selected');
                    sIdx = this.$selected.indexOf(sIdx);
                    this.$selected.splice(sIdx, 1);
                }
                else {
                    row.classList.add('selected');
                    this.$selected.push(sIdx);
                }
                row.classList.add('focused');
                this.$shiftStart = this.$focused;
            }
            else if (e.shiftKey) {
                var start, end;
                if (this.$selected.length === 0)
                    start = this.$focused != -1 ? this.$focused : 0;
                else if (this.$shiftStart != -1)
                    start = this.$shiftStart;
                else
                    start = this.$selected[0];
                Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                this.$selected = [];
                var cnt;
                if (start > sIdx) {
                    end = start;
                    start = sIdx;
                    this.$shiftStart = end;
                    cnt = end - start + 1;
                    for (; end >= start; end--)
                        this.$selected.push(end);

                    while (row && cnt--) {
                        row.classList.add('selected');
                        row = <HTMLElement>row.nextSibling;
                    }
                }
                else {
                    end = sIdx;
                    cnt = end - start + 1;
                    this.$shiftStart = start;
                    for (; start <= end; start++)
                        this.$selected.push(start);
                    while (row && cnt--) {
                        row.classList.add('selected');
                        row = <HTMLElement>row.previousSibling;
                    }
                }
                this.$focused = sIdx;
                el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                el.classList.add('focused');
            }
            else {
                Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                this.$selected = [sIdx];
                row.classList.add('selected', 'focused');
                this.$focused = sIdx;
                this.$shiftStart = this.$focused;
            }
            this.emit('selection-changed');
            if (this.$editor && this.$editor.el != row)
                this.clearEditor();
        });
        row.addEventListener('dblclick', (e) => {
            if (e.defaultPrevented || e.cancelBubble)
                return;
            var sIdx = +(<HTMLElement>e.currentTarget).dataset.dataInde;
            var r = this.$sortedRows[sIdx];

            var el = <HTMLElement>e.currentTarget;
            var dataIdx = +el.dataset.dataIndex;
            var parent = +el.dataset.parent;
            var child = +el.dataset.child;
            this.emit('row-dblclick', e, { row: this.$rows[r], rowIndex: r, parent: parent, child: child, dataIndex: dataIdx });
            if (e.defaultPrevented || e.cancelBubble)
                return;
            Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
            this.$selected = [sIdx];
            el.classList.add('selected', 'focused');
            this.createEditor(<HTMLElement>e.currentTarget, e.srcElement);
        });
        row.addEventListener('mousedown', (e) => {
            this.$editorClick = e.currentTarget;
            if (this.$editor && this.$editor.editors)
                this.$editor.editors.map(e => e.editorClick = this.$editorClick);
        });
        row.addEventListener('mouseup', (e) => {
            this.$editorClick = null;
            if (this.$editor && this.$editor.editors)
                this.$editor.editors.map(e => e.editorClick = null);
        });
        for (c = 0; c < cl; c++) {
            if (!cols[c].visible) continue;
            w = cols[c].width;
            if (this.$children && c === this.$firstColumn)
                w += 40;
            var field = null;
            var idx = c;
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
            cell.dataset.dataIndex = '' + dataIdx
            var value = null;
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
            else if(value && (''+value).length > 0)
                cell.textContent = value;
            else
                cell.innerHTML = '&nbsp;';
            if (c === 0 && parent != -1)
                cell.classList.add('datagrid-cell-child');
            else if (this.$children && c === this.$firstColumn && data.children && data.children.length > 0) {
                cell.classList.add('datagrid-cell-parent');
                var lbl = document.createElement('i')
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
                    var c = (<HTMLElement>e.currentTarget);
                    var rowEl = c.parentElement.parentElement;
                    var r: any = +c.dataset.parent;
                    var sib = <HTMLElement>rowEl.nextElementSibling;
                    if (this.$viewState[this.$sortedRows[r]]) {
                        c.classList.remove('fa-chevron-down');
                        c.classList.add('fa-chevron-right');
                        this.$viewState[this.$sortedRows[r]] = false;
                        r = '' + r;
                        while (sib && sib.dataset.parent === r) {
                            sib.style.display = 'none';
                            sib = <HTMLElement>sib.nextElementSibling;
                        }
                    }
                    else {
                        c.classList.add('fa-chevron-down');
                        c.classList.remove('fa-chevron-right');
                        this.$viewState[this.$sortedRows[r]] = true;

                        if (rowEl.dataset.children !== 'true') {
                            if (this.$children && data.children) {
                                var frag = document.createDocumentFragment();
                                for (var child = 0, childLen = data.children.length; child < childLen; child++)
                                    frag.appendChild(this.generateRow(r + child, data.children[child], r, r, r, child));
                                rowEl.parentNode.insertBefore(frag, rowEl.nextSibling);
                            }
                            rowEl.dataset.children = 'true';
                        }
                        else {
                            r = '' + r;
                            while (sib && sib.dataset.parent === r) {
                                sib.style.display = '';
                                sib = <HTMLElement>sib.nextElementSibling;
                            }
                        }

                    }
                    //this.updateRows();
                    if (this.$springCols.length > 0) {
                        for (var s = 0, sl = this.$springCols.length; s < sl; s++) {
                            var children: HTMLElement[] = Array.from(this.$body.querySelectorAll('.datagrid-cell-spring:nth-child(' + (this.$springCols[s].index + 1 - this.$hiddenColumnCount) + ')'));
                            children.map(c => {
                                c.style.width = this.$springCols[s].width + 'px';
                                c.style.minWidth = this.$springCols[s].width + 'px';
                                c.style.maxWidth = this.$springCols[s].width + 'px';
                            });
                        }
                    }
                    this.$dataWidth = this.$body.clientWidth;
                    this.$dataHeight = this.$body.clientHeight;
                    this.doUpdate(UpdateType.resize);
                });
            }
            cell.addEventListener('click', (e) => {
                if (e.defaultPrevented || e.cancelBubble)
                    return;
                var el = <HTMLElement>e.currentTarget;
                var dataIdx = +el.dataset.dataIndex;
                var field = el.dataset.field;
                var parent = +el.dataset.parent;
                var child = +el.dataset.child;
                var idx = +el.dataset.idx;
                var col = +el.dataset.column;
                var data = { row: null, cell: null, index: idx, column: col, rowIndex: +el.dataset.row, field: field, parent: parent, child: child, dataIndex: dataIdx };
                if (dataIdx >= 0 && dataIdx < this.$rows.length) {
                    if (parent === -1) {
                        data.row = this.$rows[dataIdx];
                        if (field)
                            data.cell = data.row[field]
                        else if (idx >= 0 && idx <= data.row.length)
                            data.cell = data.row[idx];
                    }
                    else if (parent >= 0 && parent < this.$rows.length && child >= 0 && child < this.$rows[parent].children.length) {
                        data.row = this.$rows[parent].children[child];
                        if (field)
                            data.cell = data.row[field]
                        else if (idx >= 0 && idx <= data.row.length)
                            data.cell = data.row[idx];
                    }
                }
                this.emit('cell-click', e, data);
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
                var el = <HTMLElement>e.currentTarget;
                var dataIdx = +el.dataset.dataIndex;
                var field = el.dataset.field;
                var parent = +el.dataset.parent;
                var child = +el.dataset.child;
                var idx = +el.dataset.idx;
                var col = +el.dataset.column;
                var data = { row: null, cell: null, index: idx, column: col, rowIndex: +el.dataset.row, field: field, parent: parent, child: child, dataIndex: dataIdx };
                if (dataIdx >= 0 && dataIdx < this.$rows.length) {
                    if (parent === -1) {
                        data.row = this.$rows[dataIdx];
                        if (field)
                            data.cell = data.row[field]
                        else if (idx >= 0 && idx <= data.row.length)
                            data.cell = data.row[idx];
                    }
                    else if (parent >= 0 && parent < this.$rows.length && child >= 0 && child < this.$rows[parent].children.length) {
                        data.row = this.$rows[parent].children[child];
                        if (field)
                            data.cell = data.row[field]
                        else if (idx >= 0 && idx <= data.row.length)
                            data.cell = data.row[idx];
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
        var cols = this.$cols;
        var row = document.createElement('tr');
        row.classList.add('datagrid-column-row');
        var cell: HTMLElement;
        var sCol = this.$sort.column;
        var sOrder = this.$sort.order;
        for (var c = 0, cl = cols.length; c < cl; c++) {
            if (!cols[c].visible) continue;
            this.$firstColumn = c;
            break;
        }
        this.$hiddenColumnCount = cols.filter(c => !c.visible).length;
        for (var c = 0, cl = cols.length; c < cl; c++) {
            if (!cols[c].visible) continue;
            cell = document.createElement('td');
            cell.classList.add('datagrid-column');
            var w = cols[c].width;
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
                    var idx = +(<HTMLElement>e.currentTarget).dataset.index;
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
        this.$headerWidth = this.$header.clientWidth;
        this.doUpdate(UpdateType.resize);
    }

    private resize() {
        var style = window.getComputedStyle(this.$parent, null);
        var h = parseInt(style.getPropertyValue("height"), 10);
        var w = parseInt(style.getPropertyValue("width"), 10);
        h -= this.$header.offsetHeight;
        if (w < this.$colWidth)
            w = this.$colWidth;
        this.$body.parentElement.style.height = h + 'px';
        if (this.$headerWidth !== 0) {
            var spacer = <HTMLElement>this.$header.querySelector('.datagrid-column-spacer');
            if (this.$springCols.length > 1 || w < this.$headerWidth) {
                spacer.style.width = '24px';
                spacer.style.minWidth = '24px';
            }
            else {
                spacer.style.width = (w - this.$headerWidth) + 24 + 'px';
                spacer.style.minWidth = (w - this.$headerWidth) + 24 + 'px';
            }

        }
        this.resizeWidth();
        this.resizeHeight();
    }

    private resizeWidth() {
        if (this.$dataWidth === 0) return;
        var helper, style;

        var spring: HTMLElement[] = Array.from(this.$header.querySelectorAll('.datagrid-cell-spring'));
        spring.map(s => {
            s.style.width = '0px';
            s.style.minWidth = '0px';
        });
        helper = document.createElement('div');
        this.$body.parentElement.appendChild(helper);
        style = window.getComputedStyle(helper, null);
        var hWidth = parseInt(style.getPropertyValue("width"), 10);
        if (this.$springCols.length > 0) {
            var cols = this.$header.querySelectorAll('.datagrid-column-spring');
            var sl = this.$springCols.length;
            var sw = (helper.clientWidth - this.$dataWidth) / sl;
            var r = sw % 1;
            sw = ~~sw;
            for (var s = 0; s < sl; s++) {
                var children: HTMLElement[] = Array.from(this.$body.querySelectorAll('.datagrid-cell-spring:nth-child(' + (this.$springCols[s].index + 1 - this.$hiddenColumnCount) + ')'));
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
        if (this.$dataHeight === 0) return;
        var helper, style, h;
        var springrow = <HTMLElement>this.$body.querySelector('.datagrid-row-spring');
        springrow.style.display = 'none';
        springrow.style.height = '0px';
        helper = document.createElement('div');
        helper.style.height = '100%';
        helper.style.position = 'absolute';
        helper.style.top = '0';
        helper.style.left = '0';
        helper.style.bottom = '0';
        this.$body.parentElement.appendChild(helper);
        h = helper.clientHeight;
        this.$body.parentElement.removeChild(helper);
        var dh;
        if (this.$rows.length > 0 && springrow.offsetTop === 0) {
            style = window.getComputedStyle(this.$body, null);
            dh = parseInt(style.getPropertyValue("height"), 10);
        }
        else
            dh = springrow.offsetTop;

        if (h >= this.$dataHeight) {
            springrow.style.display = '';
            springrow.style.height = (h - dh) + 'px';
        }
        this.$header.style.transform = 'translate(-' + this.$body.parentElement.scrollLeft + ',0)';
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
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

    public scrollToRow(row) {
        if (typeof row === 'number')
            row = this.$body.firstElementChild.children[row];
        var top = row.offsetTop;
        var height = row.offsetHeight;
        var sTop = this.$body.parentElement.scrollTop;
        var sHeight = this.$body.parentElement.clientHeight;
        if (top + height >= sTop + sHeight)
            this.$body.parentElement.scrollTop = top - sHeight + height;
        else if (top < sTop)
            this.$body.parentElement.scrollTop = top;
    }

    public getPropertyOptions(prop, ops?) {
        if (!prop || !this.$cols)
            return null;
        var col = this.$cols.filter(s => s.field === prop);
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

        var e = 0, el = this.$editor.editors.length;
        this.$prevEditor = {
            el: el,
            editors: []
        }
        for (; e < el; e++) {
            var editor = this.$editor.editors[e];
            var value;
            var oldValue;
            var prop = editor.property;
            var eData;
            if (editor.editor) {
                value = editor.editor.value;
                eData = editor.editor.data;
            }
            oldValue = editor.data[editor.property];
            var dataIdx, field, parent, child, idx, data;
            if (value !== oldValue) {
                editor.data[prop] = value;
                var col = this.$cols[editor.column];
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
                            data.cell = data.row[field]
                        else if (idx >= 0 && idx <= data.row.length)
                            data.cell = data.row[idx];
                    }
                    else if (parent >= 0 && parent < this.$rows.length && child >= 0 && child < this.$rows[parent].children.length) {
                        data.row = this.$rows[parent].children[child];
                        if (field)
                            data.cell = data.row[field]
                        else if (idx >= 0 && idx <= data.row.length)
                            data.cell = data.row[idx];
                    }
                }
                if (col.formatter)
                    editor.el.textContent = col.formatter(data);
                else
                    editor.el.textContent = value || '';
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
                this.emit('value-changed', value, oldValue, dataIdx, child, eData);
            }
        }
        this.$editor = null;
    }

    public createEditor(el: HTMLElement, fCol: any = 0) {
        if (!el) return;
        var row = [...el.parentElement.children].indexOf(el);
        if (fCol)
            fCol = [...fCol.parentElement.children].indexOf(fCol);
        var cols = this.$cols;
        if (this.$editor) {
            if (this.$editor && this.$editor.row === row)
                return;
            this.clearEditor();
        }
        var c;
        var cl = el.children.length;
        this.$editor = {
            el: el,
            editors: [],
            row: row
        }
        for (c = 0; c < cl; c++) {
            var cell = <HTMLElement>el.children[c];
            var prop = cell.dataset.field;
            var col = +cell.dataset.column;
            if (cols[c].readonly) {
                fCol--;
                continue;
            }
            if (!prop) return;
            var editor = {
                el: cell,
                editor: null,
                property: prop,
                type: EditorType.default,
                column: col,
                row: row,
                data
            };
            var type = this.editorType(col);
            var editorOptions;
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
            editor.type = type;
            var values;
            var vl;
            var dataIdx = +editor.el.dataset.dataIndex;
            var parent = +editor.el.dataset.parent;
            var child = +editor.el.dataset.child;
            var data;
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
                    editor.editor = new DropdownEditValueEditor(this, cell, prop, editorOptions);
                    break
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
            if (editor)
            {
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