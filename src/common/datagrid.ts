//https://developers.google.com/web/updates/2016/10/resizeobserver
import EventEmitter = require('events');
import { capitalize, resetCursor, stringToEnum, enumToString } from './library';
const ResizeObserver = require('resize-observer-polyfill');

export interface DatagridOptions {
    container?: any;
    parent?: any;
    id?: string;
    object?: any;
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

export enum UpdateType { none = 0, columns = 1, rows = 2, resize = 4, sort = 8 }

export class Column {
    public text = '';
    public type = 0;
    public field = null;
    public sortable = true;
    public visible = true;
    public formatter = (data) => {
        if (!data || !data.cell)
            return '';
        switch (typeof (data.cell)) {
            case "string":
            case "number":
            case "boolean":
                return data.cell;
        }
        return data.cell.value;
    };
    public align = '';
    public width = 100;
    public wrap = false;
    public spring = false;

    constructor(data) {
        if (data) {
            for (var prop in data) {
                if (!data.hasOwnProperty(prop)) continue;
                this[prop] = data[prop];
            }
        }
    }
}

export class Datagrid extends EventEmitter {
    private $parent: HTMLElement;
    private $id;
    private $el: HTMLElement;
    private $rows = [];
    private $sortedRows = [];
    private $cols = [];
    private $springCols = [];
    private $colWidth = 470;
    private $header: HTMLElement;
    private $body: HTMLElement;
    private _updating;
    private $dataWidth = 0;
    private $dataHeight = 0;
    private $headerWidth = 0;
    private $resizer;
    private $sort = { order: 0, column: -1 };

    private $asc: HTMLElement;
    private $desc: HTMLElement;
    private $nosort: HTMLElement;

    constructor(options?: DatagridOptions) {
        super();
        if (options) {
            if (options.id)
                this.$id = options.id;
            if (options.container)
                this.parent = options.container.container ? options.container.container : options.container;
            else if (options.parent)
                this.parent = options.parent;
            else
                this.parent = document.body;
        }
        else
            this.parent = document.body;
    }

    get id() { return this.$id || (this.parent.id + '-property-grid'); }
    set id(value) {
        if (value === this.$id) return;
        this.$id = value;
        this.$el.id = this.id;
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
        
        this.$el = document.createElement('div');
        this.$el.dataset.datagrid = 'true';
        this.$el.classList.add('datagrid');

        this.$header = document.createElement('table');
        this.$header.classList.add('datagrid-header');
        this.$el.appendChild(this.$header);

        var el = document.createElement('div');
        el.classList.add('datagrid-body');
        el.addEventListener('scroll', (e) => {
            this.$header.style.transform = 'translate(-' + (<HTMLElement>e.currentTarget).scrollLeft + ',0)';
        })
        this.$body = document.createElement('table');
        this.$body.classList.add('datagrid-body-data');
        el.appendChild(this.$body);
        this.$el.appendChild(el);
        this.$parent.appendChild(this.$el);
        window.addEventListener('resize', () => {
            this.doUpdate(UpdateType.resize);
        })
        this.$resizer = new ResizeObserver((entries, observer) => {
            this.doUpdate(UpdateType.resize);
        })
        this.$resizer.observe(this.$el);
    }

    public addColumn(col) {
        if (!col) return;
        this.$cols.push(new Column(col));
        this.doUpdate(UpdateType.columns | UpdateType.rows);
    }

    public addColumns(cols) {
        if (!cols) return;
        for (var c = 0, cl = cols.length; c < cl; c++)
            this.$cols.push(new Column(cols[c]));
        this.doUpdate(UpdateType.columns | UpdateType.rows);
    }

    public setColumns(cols) {
        cols = cols || [];
        var cw = 0;
        for (var c = 0, cl = cols.length; c < cl; c++) {
            cols[c] = new Column(cols[c]);
            cw = cols[c].width;
        }
        this.$colWidth = cw;
        this.$cols = cols;
        this.doUpdate(UpdateType.columns | UpdateType.rows);
    }

    public addRow(row) {
        if (!row) return;
        this.$rows.push(row);
        this.doUpdate(UpdateType.rows | UpdateType.sort);
    }

    public addRows(rows) {
        if (!rows) return;
        this.$rows = this.$rows.concat(rows);
        this.doUpdate(UpdateType.rows | UpdateType.sort);
    }

    public setRows(rows) {
        rows = rows || [];
        this.$rows = rows;
    }

    get rows() { return this.$rows.slice(0); }
    get columns() { return this.$cols.slice(0); }

    public sort() {
        if (this.$sort.column < 0 || this.$sort.column >= this.$cols.length)            
        {
            this.$sortedRows = this.$rows;
            return;
        }
        var prop;
        if (this.$cols[this.$sort.column].hasOwnProperty('index'))
            prop = this.$cols[this.$sort.column].index;
        else if (this.$cols[this.$sort.column].hasOwnProperty('field'))
            prop = this.$cols[this.$sort.column].field;
        else
            prop = this.$sort.column;
        var dir = this.$sort.order ? -1 : 1;

        this.$sortedRows = this.$rows.sort((a, b) => {
            if(a[prop] > b[prop])
                return 1 * dir;
            if(a[prop] < b[prop])
                return -1 * dir;
            //TODO add a subsort field
            return 0;
        });
    }

    private updateRows() {
        while (this.$body.firstChild)
            this.$body.removeChild(this.$body.firstChild);
        var cols = this.$cols;
        var rows = this.$sortedRows;
        var c, cl = cols.length;
        var frag = document.createDocumentFragment();
        var w;
        var row, cell;
        var sCol = this.$sort.column;
        for (var r = 0, l = rows.length; r < l; r++) {
            row = document.createElement('tr');
            row.classList.add('datagrid-row');
            if (r % 2 === 0)
                row.classList.add('datagrid-row-even');
            else
                row.classList.add('datagrid-row-odd');
            row.dataset.row = '' + r;
            row.addEventListener('click', (e) => {
                if (e.defaultPrevented || e.cancelBubble)
                    return;
                this.emit('row-click', e, { row: this.$rows[row], rowIndex: +(<HTMLElement>e.currentTarget).dataset.row });
            });
            row.addEventListener('dblclick', (e) => {
                if (e.defaultPrevented || e.cancelBubble)
                    return;
                this.emit('row-dblclick', e, { row: this.$rows[row], rowIndex: +(<HTMLElement>e.currentTarget).dataset.row });
                if (e.defaultPrevented || e.cancelBubble)
                    return;
                //TODO add editor support
            });
            for (c = 0; c < cl; c++) {
                if (!cols[c].visible) continue;
                w = cols[c].width;
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
                    cols[c].styleFormatter({ row: rows[r], cell: rows[r][field], rowIndex: r, column: c, index: idx, field: cols[c].field, rows: rows });
                cell.dataset.row = '' + r;
                cell.dataset.column = '' + c;
                cell.dataset.field = cols[c].field || '';
                cell.dataset.index = '' + idx;
                if (cols[c].tooltipFormatter) {
                    if (field)
                        cell.title = cols[c].tooltipFormatter({ row: rows[r], cell: rows[r][field], rowIndex: r, column: c, index: idx, field: cols[c].field, rows: rows }) || '';
                    else if (idx < rows[r].length)
                        cell.title = cols[c].tooltipFormatter({ row: rows[r], cell: rows[r][idx], rowIndex: r, column: c, index: idx, field: cols[c].field, rows: rows }) || '';
                    else
                        cell.title = cols[c].tooltipFormatter({ row: rows[r], cell: null, rowIndex: r, column: c, index: idx, field: cols[c].field, rows: rows }) || '';
                }
                else if (field)
                    cell.title = '' + (rows[r][field] || '');
                else if (idx < rows[r].length)
                    cell.title = '' + (rows[r][idx] || '');
                if (cols[c].formatter) {
                    if (field)
                        cell.textContent = cols[c].formatter({ row: rows[r], cell: rows[r][field], rowIndex: r, column: c, index: idx, field: cols[c].field, rows: rows });
                    else if (idx < rows[r].length)
                        cell.textContent = cols[c].formatter({ row: rows[r], cell: rows[r][idx], rowIndex: r, column: c, index: idx, field: cols[c].field, rows: rows });
                    else
                        cell.textContent = cols[c].formatter({ row: rows[r], cell: null, rowIndex: r, colunn: c, index: idx, field: cols[c].field, rows: rows });
                }
                else if (field)
                    cell.textContent = rows[r][field] || '';
                else if (idx < rows[r].length)
                    cell.textContent = rows[r][idx] || '';
                cell.addEventListener('click', (e) => {
                    if (e.defaultPrevented || e.cancelBubble)
                        return;
                    var el = <HTMLElement>e.currentTarget;
                    var idx = +el.dataset.idx;
                    var row = +el.dataset.row;
                    var field = el.dataset.field;
                    var col = +el.dataset.column;
                    var data = { row: null, cell: null, index: idx, column: col, rowIndex: row, field: field };
                    if (row >= 0 && row < this.$rows.length) {
                        data.row = this.$rows[row];
                        if (idx >= 0 && idx <= this.$rows[row].length)
                            data.cell = this.$rows[row][idx];
                    }
                    this.emit('cell-click', e, data);
                })
                row.appendChild(cell);
            }
            if (this.$springCols.length === 0) {
                (cell = document.createElement('td')).classList.add('datagrid-cell-spring');
                row.appendChild(cell);
            }
            frag.appendChild(row);
        }
        (row = document.createElement('tr')).classList.add('datagrid-row-spring');
        for (c = 0; c < cl; c++) {
            if (!cols[c].visible) continue;
            cell = document.createElement('td');
            cell.dataset.row = '' + rows.length;
            cell.dataset.column = '' + c;
            cell.dataset.field = cols[c].field || '';
            cell.dataset.index = '' + idx;
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
        frag.appendChild(row);
        this.$body.appendChild(frag);
        this.$dataWidth = this.$body.clientWidth;
        this.$dataHeight = this.$body.clientHeight;
        this.doUpdate(UpdateType.resize);
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
            cell = document.createElement('td');
            cell.classList.add('datagrid-column');
            var w = cols[c].width;
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
                        Array.from(this.$body.querySelectorAll('.datagrid-row:nth-child(' + idx + ')'), a => a.classList.add('datagrid-cell-sorted'));
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
                else
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
        var style = window.getComputedStyle(this.$el, null);
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
            var helper;
            var spring: HTMLElement[] = Array.from(this.$header.querySelectorAll('.datagrid-cell-spring'));
            if (this.$dataWidth !== 0) {
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
                    for (var s = 0; s < sl; s++) {
                        var children: HTMLElement[] = Array.from(this.$body.querySelectorAll('.datagrid-cell-spring:nth-child(' + (this.$springCols[s].index + 1) + ')'));
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
            if (this.$dataHeight !== 0) {
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
        }
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
            if ((this._updating & UpdateType.resize) === UpdateType.resize) {
                this.resize();
                this._updating &= ~UpdateType.resize;
            }
            this.doUpdate(this._updating);
        });
    }
}