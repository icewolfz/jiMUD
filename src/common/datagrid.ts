//https://developers.google.com/web/updates/2016/10/resizeobserver
import EventEmitter = require('events');
import { capitalize, resetCursor, stringToEnum, enumToString } from './library';
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from 'constants';
import { runInThisContext } from 'vm';
const ResizeObserver = require('resize-observer-polyfill');

export interface DatagridOptions {
    container?: any;
    parent?: any;
    object?: any;
    columns?: Column[];
    rows?: any[];
}

export enum EditorType {
    default,
    flag,
    number,
    select,
    check,
    custom,
    readonly
}

export enum UpdateType { none = 0, columns = 1, rows = 2, resize = 4, sort = 8, resizeHeight = 16, resizeWidth = 32, buildRows = 64, buildColumns }

export class Column {
    public text = '';
    public type = 0;
    public field = null;
    public sortable = true;
    public visible = true;
    public formatter = (data) => {
        if (!data) return '';
        switch (typeof (data.cell)) {
            case "string":
            case "number":
            case "boolean":
                return data.cell;
        }
        if (!data.cell)
            return '';
        return data.cell.value;
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
    private $rowsHtml = [];
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
            this.$parent.classList.remove('focused');
        });
        this.$parent.addEventListener('focus', (e) => {
            this.$parent.classList.add('focused');
        })

        this.$parent.addEventListener('keydown', (e) => {
            var el, idx;
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
                    }
                    break;
                case 38://up
                    if (e.ctrlKey) {
                        Array.from(this.$body.querySelectorAll('.focused'), a => a.classList.remove('focused'));
                        if (this.$focused < 1)
                            this.$focused = 0;
                        else if (this.$focused > 0)
                            this.$focused--;
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
                        this.scrollToRow(el);
                    }
                    else if (e.shiftKey) {

                    }
                    else {
                        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                        Array.from(this.$body.querySelectorAll('.focused'), a => a.classList.remove('focused'));
                        if (this.$focused < 1)
                            this.$focused = 0;
                        else if (this.$focused > 0)
                            this.$focused--;
                        this.$selected = [this.$focused];
                        (<HTMLElement>this.$body.firstChild).children[this.$focused].classList.add('selected', 'focused');
                        this.scrollToRow((<HTMLElement>this.$body.firstChild).children[this.$focused]);
                    }
                    break;
                case 40://down
                    if (e.ctrlKey) {
                        Array.from(this.$body.querySelectorAll('.focused'), a => a.classList.remove('focused'));
                        if (this.$focused < (<HTMLElement>this.$body.firstChild).children.length)
                            this.$focused++;
                        el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                        el.classList.add('focused');
                        this.scrollToRow(el);
                    }
                    else if (e.shiftKey) {

                    }
                    else {
                        Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                        Array.from(this.$body.querySelectorAll('.focused'), a => a.classList.remove('focused'));
                        if (this.$focused < (<HTMLElement>this.$body.firstChild).children.length - 1)
                            this.$focused++;
                        this.$selected = [this.$focused];
                        (<HTMLElement>this.$body.firstChild).children[this.$focused].classList.add('selected', 'focused');
                        this.scrollToRow((<HTMLElement>this.$body.firstChild).children[this.$focused]);
                    }

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
        this.$rowsHtml.push(null);
        this.doUpdate(UpdateType.rows | UpdateType.sort);
    }

    public addRows(rows) {
        if (!rows) return;
        this.$rows = this.$rows.concat(rows);
        this.$rowsHtml = this.$rowsHtml.concat(new Array(this.$rows.length));
        this.doUpdate(UpdateType.rows | UpdateType.sort);
    }

    public removeRow(row) {
        if (typeof row !== 'number')
            row = this.$rows.indexOf(row);
        if (row === -1 || row >= this.$rows.length)
            return;
        this.$rows.splice(row, 1);
        this.$rowsHtml.splice(row, 1);
        this.doUpdate(UpdateType.rows | UpdateType.sort);
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
            this.$rowsHtml.splice(rows[row], 1);
        }
        this.doUpdate(UpdateType.rows | UpdateType.sort);
    }

    get rows() { return this.$rows.slice(0); }
    set rows(value) {
        value = value || [];
        this.$rows = value;
        this.$rowsHtml = new Array(this.$rows.length)
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
            this.doUpdate(UpdateType.columns | UpdateType.rows);
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
            //if (!this.$rowsHtml[sorted[r]])
            //this.$rowsHtml[sorted[r]] = this.generateRow(data, r, sorted[r]);
            //frag.appendChild(this.$rowsHtml[sorted[r]]);
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
            //if (!this.$rowsHtml[sorted[r]])
            //this.$rowsHtml[sorted[r]] = this.generateRow(data, r, sorted[r]);
            //frag.appendChild(this.$rowsHtml[sorted[r]]);
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
                if (row.classList.contains('selected')) {
                    row.classList.remove('selected');
                    sIdx = this.$selected.indexOf(sIdx);
                    this.$selected.splice(sIdx, 1);
                }
                else {
                    row.classList.add('selected');
                    this.$selected.push(sIdx);
                }
                this.$focused = sIdx;
                row.classList.add('focused');
            }
            else if (e.shiftKey) {
                var start, end;
                if (this.$selected.length === 0)
                    start = this.$focused != -1 ? this.$focused : 0;
                else
                    start = this.$focused != -1 ? this.$focused : this.$selected[0];
                Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                this.$selected = [];
                var cnt;
                if (start > sIdx) {
                    end = start;
                    start = sIdx;
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
                    for (; start <= end; start++)
                        this.$selected.push(start);
                    while (row && cnt--) {
                        row.classList.add('selected');
                        row = <HTMLElement>row.previousSibling;
                    }
                }
                this.$focused = this.$selected[0];
                el = (<HTMLElement>this.$body.firstChild).children[this.$focused];
                el.classList.add('focused');
            }
            else {
                Array.from(this.$body.querySelectorAll('.selected'), a => a.classList.remove('selected'));
                this.$selected = [sIdx];
                row.classList.add('selected', 'focused');
                this.$focused = sIdx;
            }
        });
        row.addEventListener('dblclick', (e) => {
            if (e.defaultPrevented || e.cancelBubble)
                return;
            var sIdx = +(<HTMLElement>e.currentTarget).dataset.row;
            var r = this.$sortedRows[sIdx];
            this.emit('row-dblclick', e, { row: this.$rows[r], rowIndex: r });
            if (e.defaultPrevented || e.cancelBubble)
                return;
            //TODO add editor support
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
            cell.dataset.row = '' + r;
            cell.dataset.column = '' + c;
            cell.dataset.field = cols[c].field || '';
            cell.dataset.index = '' + idx;
            cell.dataset.parent = '' + parent;
            cell.dataset.child = '' + child;
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
                cell.textContent = cols[c].formatter({ row: data, cell: value, rowIndex: r, column: c, index: idx, field: cols[c].field, rows: this.$rows, parent: parent, child: child, dataIndex: dataIdx });
            else
                cell.textContent = value || '';
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
                    var r: any = c.dataset.parent;
                    var sib = <HTMLElement>rowEl.nextElementSibling;
                    if (this.$viewState[this.$sortedRows[r]]) {
                        c.classList.remove('fa-chevron-down');
                        c.classList.add('fa-chevron-right');
                        this.$viewState[this.$sortedRows[r]] = false;
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
                                r = +r;
                                var frag = document.createDocumentFragment();
                                for (var child = 0, childLen = data.children.length; child < childLen; child++)
                                    frag.appendChild(this.generateRow(data.children[child], r, r, r));
                                rowEl.parentNode.insertBefore(frag, rowEl.nextSibling);
                            }
                            rowEl.dataset.children = 'true';
                        }
                        else
                            while (sib && sib.dataset.parent === r) {
                                sib.style.display = '';
                                sib = <HTMLElement>sib.nextElementSibling;
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
                var idx = +el.dataset.idx;
                var row = +el.dataset.row;
                var field = el.dataset.field;
                var col = +el.dataset.column;
                var data = { row: null, cell: null, index: idx, column: col, rowIndex: row, field: field, parent: parent };
                if (row >= 0 && row < this.$rows.length) {
                    data.row = this.$rows[row];
                    if (idx >= 0 && idx <= this.$rows[row].length)
                        data.cell = this.$rows[row][idx];
                }
                this.emit('cell-click', e, data);
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
                    this.doUpdate(UpdateType.sort | UpdateType.rows);
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
                cols[c].colStyleFormatter({ cell: cell, column: cols[c], columnIndex: c, text: cols[c].text });
            if (cols[c].colFormatter)
                cell.innerHTML = cols[c].colFormatter({ column: cols[c], columnIndex: c, text: cols[c].text });
            else
                cell.textContent = cols[c].text;
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
}