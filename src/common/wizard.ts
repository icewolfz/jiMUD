//spellchecker:ignore datagrid
import { EventEmitter } from 'events';
import { DataGrid } from './datagrid';
import { copy } from './library';

export enum WizardMode {
    normal = 0,
    advanced = 1 << 0,
    expert = 1 << 1,
    all = normal | advanced | expert
}

export interface WizardOptions {
    id: string;
    pages?: WizardPage[];
    title?: string;
    mode?: WizardMode;
}

export interface PageOptions {
    id: string;
    title: string;
    body?: any;
    visible?: boolean;
    mode?: WizardMode;
    reset?(...args: any[]): void;
    shown?(...args: any[]): void;
    hidden?(...args: any[]): void;
}

export interface DataGridPageOptions extends PageOptions {
    rows?: any[];
    columns?: any[];
    add?(...args: any[]): void;
    edit?(...args: any[]): void;
    delete?(...args: any[]): void;
    enterMoveFirst?: boolean | Function;
    enterMoveNext?: boolean | Function;
    enterMoveNew?: boolean | Function;
    clipboard?: string;
}

export class WizardPage extends EventEmitter {
    private $body;
    private $el: HTMLElement;
    private _title;
    private $visible = true;
    public wizard: Wizard;
    private $mode: WizardMode = WizardMode.normal;

    public get mode() { return this.$mode; }
    public set mode(value: WizardMode) {
        if (this.$mode === value) return;
        this.$mode = value;
        if (this.wizard)
            this.wizard.refreshAll();
    }

    public get visible() {
        return this.$visible;
    }
    public set visible(value) {
        if (this.$visible === value) return;
        this.$visible = value;
        if (this.wizard)
            this.wizard.refreshAll();
    }

    constructor(options?: PageOptions) {
        super();
        this.$el = document.createElement('div');
        this.$el.classList.add('wizard-page');
        if (options) {
            this.title = options.title || '';
            this.body = options.body;
            if (options.reset)
                this.on('reset', options.reset);
            if (options.shown)
                this.on('shown', options.shown);
            if (options.hidden)
                this.on('hidden', options.hidden);
            if (Object.hasOwn(options, 'visible'))
                this.visible = options.visible;
            if (Object.hasOwn(options, 'mode'))
                this.mode = options.mode;
        }
    }

    public set body(value: any) {
        if (value === this.$body) return;
        if (this.$body) {
            while (this.$el.firstChild) {
                this.$el.removeChild(this.$el.firstChild);
            }
        }
        this.$body = value;
        if (!value) return;
        if (typeof value === 'string') {
            this.$el.innerHTML = value;
            if (this.$el.firstElementChild.hasAttribute('data-visible'))
                this.visible = (<HTMLElement>this.$el.firstElementChild).dataset.visible !== 'false';
            if (this.$el.firstElementChild.hasAttribute('data-mode'))
                switch ((<HTMLElement>this.$el.firstElementChild).dataset.mode) {
                    case '1':
                    case 'advanced':
                        this.mode = WizardMode.advanced;
                        break;
                    case '2':
                    case 'expert':
                        this.mode = WizardMode.advanced;
                        break;
                    default:
                        this.mode = WizardMode.normal;
                        break;
                }
        }
        else if (value instanceof $) {
            const bl = (<JQuery>value).length;
            for (let b = 0; b < bl; b++)
                this.$el.appendChild(value[b]);
            if (typeof (<JQuery>value).data('visible') !== 'undefined')
                this.visible = (<JQuery>value).data('visible') !== 'false';
            if (typeof (<JQuery>value).data('mode') !== 'undefined')
                switch ((<JQuery>value).data('mode')) {
                    case 1:
                    case '1':
                    case 'advanced':
                        this.mode = WizardMode.advanced;
                        break;
                    case 2:
                    case '2':
                    case 'expert':
                        this.mode = WizardMode.advanced;
                        break;
                    default:
                        this.mode = WizardMode.normal;
                        break;
                }
        }
        else if (value instanceof HTMLElement) {
            this.$el.appendChild(value);
            if (value.hasAttribute('data-visible'))
                this.visible = value.dataset.visible !== 'false';
            if (value.hasAttribute('data-mode'))
                switch (value.dataset.mode) {
                    case '1':
                    case 'advanced':
                        this.mode = WizardMode.advanced;
                        break;
                    case '2':
                    case 'expert':
                        this.mode = WizardMode.advanced;
                        break;
                    default:
                        this.mode = WizardMode.normal;
                        break;
                }
        }
    }
    public get body() { return this.$body; }

    public get page() { return this.$el; }

    public get title() { return this._title; }
    public set title(value: any) { this._title = value; }
}

export class WizardDataGridPage extends WizardPage {
    public dataGrid: DataGrid;
    private $id;
    private $edit;
    private $del;
    private $copy;
    private $cut;
    private $paste;
    private $title;

    get id() { return this.$id || 'wizard-datagrid'; }
    set id(value) {
        if (this.$id === value) return;
        const old = this.id;
        this.$id = value;
        if (this.dataGrid)
            this.dataGrid.id = this.$id;
        if (this.wizard.data) {
            this.wizard.data[this.id] = this.wizard.data[old];
            delete this.wizard.data[old];
        }
    }

    constructor(options?: DataGridPageOptions) {
        super(options);
        if (options)
            this.$id = options.id;
        this.$title = document.createElement('div');
        this.$title.textContent = this.title;
        this.$title.style.display = 'inline-block';
        this.$title.style.fontWeight = 'bold';
        this.$title.style.marginRight = '5px';
        this.page.appendChild(this.$title);

        let group = document.createElement('div');
        group.classList.add('btn-group');
        group.style.marginRight = '5px';

        let button = document.createElement('button');
        button.type = 'button';
        button.classList.add('btn', 'btn-default', 'btn-xs');
        button.addEventListener('click', () => {
            this.dataGrid.addNewRow();
        });
        button.title = 'Add';
        button.innerHTML = '<i class="fa fa-plus"></i>';
        group.appendChild(button);
        button = document.createElement('button');
        button.type = 'button';
        button.disabled = true;
        button.classList.add('btn', 'btn-default', 'btn-xs');
        button.addEventListener('click', () => {
            const e = { preventDefault: false };
            this.emit('edit', e);
            if (!e.preventDefault)
                this.dataGrid.beginEdit(this.dataGrid.selected[0].row);
        });
        button.title = 'Edit';
        button.innerHTML = '<i class="fa fa-edit"></i>';
        this.$edit = button;
        group.appendChild(button);
        button = document.createElement('button');
        button.disabled = true;
        button.type = 'button';
        button.title = 'Delete';
        button.classList.add('btn', 'btn-danger', 'btn-xs');
        button.addEventListener('click', () => {
            this.dataGrid.delete();
        });
        button.innerHTML = '<i class="fa fa-trash"></i>';
        this.$del = button;
        group.appendChild(button);
        this.page.appendChild(group);

        //CUT COPY PASTE
        group = document.createElement('div');
        group.classList.add('btn-group');
        button = document.createElement('button');
        button.type = 'button';
        button.disabled = true;
        button.classList.add('btn', 'btn-default', 'btn-xs');
        button.addEventListener('click', () => {
            this.dataGrid.cut();
        });
        button.title = 'Cut';
        button.innerHTML = '<i class="fa fa-cut"></i>';
        this.$cut = button;
        group.appendChild(button);
        button = document.createElement('button');
        button.type = 'button';
        button.disabled = true;
        button.classList.add('btn', 'btn-default', 'btn-xs');
        button.addEventListener('click', () => {
            this.dataGrid.copy();
        });
        button.title = 'Copy';
        button.innerHTML = '<i class="fa fa-copy"></i>';
        this.$copy = button;
        group.appendChild(button);
        button = document.createElement('button');
        button.type = 'button';
        button.title = 'Paste';
        button.classList.add('btn', 'btn-default', 'btn-xs');
        button.addEventListener('click', () => {
            this.dataGrid.paste();
        });
        button.innerHTML = '<i class="fa fa-paste"></i>';
        this.$paste = button;
        group.appendChild(button);
        this.page.appendChild(group);

        const el = document.createElement('div');
        el.classList.add('form-group', 'datagrid-standard');
        el.style.margin = '0';
        el.style.position = 'absolute';
        el.style.left = '5px';
        el.style.right = '5px';
        el.style.bottom = '5px';
        el.style.top = '33px';
        this.page.appendChild(el);
        this.dataGrid = new DataGrid(el);
        if (options && options.hasOwnProperty('enterMoveFirst'))
            this.dataGrid.enterMoveFirst = options.enterMoveFirst;
        if (options && options.hasOwnProperty('enterMoveNext'))
            this.dataGrid.enterMoveNext = options.enterMoveNext;
        if (options && options.hasOwnProperty('enterMoveNew'))
            this.dataGrid.enterMoveNew = options.enterMoveNew;
        if (options && options.clipboard && options.clipboard.length !== 0)
            this.dataGrid.clipboardPrefix = options.clipboard;
        else
            this.dataGrid.clipboardPrefix = 'wizard/';
        this.dataGrid.on('selection-changed', () => {
            if (this.dataGrid.selectedCount) {
                this.$edit.removeAttribute('disabled');
                this.$del.removeAttribute('disabled');
                if (this.dataGrid.selectedCount > 1)
                    this.$del.title = 'Delete';
                else
                    this.$del.title = 'Delete';
                this.$cut.removeAttribute('disabled');
                this.$copy.removeAttribute('disabled');
            }
            else {
                this.$edit.setAttribute('disabled', 'true');
                this.$del.setAttribute('disabled', 'true');
                this.$cut.setAttribute('disabled', 'true');
                this.$copy.setAttribute('disabled', 'true');
            }
        });
        this.dataGrid.on('delete', (e) => {
            const ep = { preventDefault: false };
            this.emit('delete-prompt', ep);
            if (!ep.preventDefault && dialog.showMessageBoxSync({
                type: 'warning',
                title: 'Delete',
                message: 'Delete selected?',
                buttons: ['Yes', 'No'],
                defaultId: 1,
                noLink: true
            }) === 1)
                e.preventDefault = true;
            this.emit('delete', e);
        });
        this.dataGrid.on('cut', () => {
            if (this.dataGrid.canPaste)
                this.$paste.removeAttribute('disabled');
            else
                this.$paste.setAttribute('disabled', 'true');
        });
        this.dataGrid.on('copy', () => {
            if (this.dataGrid.canPaste)
                this.$paste.removeAttribute('disabled');
            else
                this.$paste.setAttribute('disabled', 'true');
        });
        this.dataGrid.on('add', e => {
            this.emit('add', e);
        });
        this.dataGrid.on('rows-changed', () => {
            //if (this.wizard)
            //this.wizard.data[this.id] = this.dataGrid.rows;
        });
        this.dataGrid.on('row-dblclick', (e) => {
            this.emit('edit', e);
        });
        this.$paste.disabled = !this.dataGrid.canPaste;
        if (options) {
            this.dataGrid.columns = options.columns || [];
            this.dataGrid.rows = options.rows || [];
            if (options.add)
                this.on('add', options.add);
            if (options.edit)
                this.on('edit', options.edit);
            if (options.delete)
                this.on('delete', options.delete);
        }
        this.on('reset', e => {
            if (this.wizard.defaults[this.id])
                this.wizard.data[this.id] = this.wizard.defaults[this.id].slice() || [];
            else if (!this.wizard.data[this.id])
                this.wizard.data[this.id] = [];
            else
                this.wizard.data[this.id].length = 0;
            this.dataGrid.rows = this.wizard.data[this.id];
        });
        this.on('shown', e => {
            this.$paste.disabled = !this.dataGrid.canPaste;
            if (this.dataGrid.selectedCount) {
                this.$edit.removeAttribute('disabled');
                this.$del.removeAttribute('disabled');
                if (this.dataGrid.selectedCount > 1)
                    this.$del.title = 'Delete';
                else
                    this.$del.title = 'Delete';
                this.$cut.removeAttribute('disabled');
                this.$copy.removeAttribute('disabled');
            }
            else {
                this.$edit.setAttribute('disabled', 'true');
                this.$del.setAttribute('disabled', 'true');
                this.$cut.setAttribute('disabled', 'true');
                this.$copy.setAttribute('disabled', 'true');
            }
            this.dataGrid.refresh();
        });
    }

    get title() { return super.title; }
    set title(value) {
        super.title = value;
        if (this.$title)
            this.$title.textContent = value;
    }
}

enum UpdateType {
    none = 0, rebuildNav = 1, updateNavButtons = 2, refresh = 4
}

export class Wizard extends EventEmitter {
    private $mode: WizardMode = WizardMode.normal;
    private $dialog: HTMLDialogElement;
    private $id = 'wizard';
    private $body: HTMLElement;
    private $title;
    private $titleEl: HTMLElement;
    private $height = '432px';
    private $width = '576px';
    private $next: HTMLButtonElement;
    private $prev: HTMLButtonElement;
    private $data;
    private $finish;

    private $pages: WizardPage[] = [];
    private $navPages = [];
    private $current = 0;
    private $nav: HTMLSelectElement;
    private $navMode: HTMLSelectElement;
    private $update: UpdateType;
    private _rTimeout = 0;
    public defaults;

    get id() { return this.$id; }
    set id(value) {
        if (value === this.$id) return;
        this.$id = value;
        if (this.$dialog)
            this.$dialog.id = this.$id;
    }
    get title() { return this.$title; }
    set title(value) {
        if (this.$title === value) return;
        if (this.$titleEl) {
            this.$titleEl.innerHTML = value || '';
            this.$dialog.dataset.title = value;
        }
    }

    get width() { return this.$width; }
    set width(value) {
        value = value || '576px';
        if (this.$width === value) return;
        this.$width = value;
        if (this.$dialog)
            this.$dialog.style.width = this.$width;
    }

    get height() { return this.$height; }
    set height(value) {
        value = value || '432px';
        if (this.$height === value) return;
        this.$height = value;
        if (this.$dialog)
            this.$dialog.style.height = this.$height;
    }

    get pages() { return this.$pages; }
    set pages(value) {
        value = value || [];
        if (!Array.isArray(value))
            value = [value];
        if (this.$pages === value) return;
        this.$navPages = [];
        this.unbindEvents(this.$pages);
        this.$pages = value;
        this.$pages.forEach((p, i) => {
            p.wizard = this;
            if (p.visible && p.mode <= this.$mode)
                this.$navPages.push(i);
        });
        this.bindEvents(value);
    }

    get data() { return this.$data; }

    get open() { return this.$dialog.open; }

    get disableFinish() { return this.$finish.disabled; }
    set disableFinish(value) {
        if (value === this.$finish.disabled) return;
        this.$finish.disabled = value;
    }

    get mode() { return this.$mode; }
    set mode(value: WizardMode) {
        if (value === this.$mode) return;
        this.$mode = value;
        if(this.$navMode) {
            $(this.$navMode).val('' + value);
            $(this.$navMode).selectpicker('render');        
        }
        this.refreshAll();
        this.emit('mode-changed');
    }

    constructor(options?: WizardOptions) {
        super();
        if (options) {
            this.id = options.id || 'wizard';
            this.$mode = options.mode || WizardMode.normal;
            this.pages = options.pages || [];
        }
        this.create();
        if (options) {
            this.title = options.title || '';
        }
    }

    private create() {
        this.$dialog = <HTMLDialogElement>document.createElement('dialog');
        this.$dialog.id = this.id;
        this.$dialog.classList.add('wizard');
        this.$dialog.style.width = this.$width;
        this.$dialog.style.height = this.$height;
        this.$dialog.style.padding = '5px';
        this.$dialog.addEventListener('cancel', () => {
            this.emit('cancel');
        });
        this.$dialog.addEventListener('close', () => {
            this.emit('close');
        });
        this.$dialog.addEventListener('open', () => {
            //this.emit('open');
        });
        let el;
        let button;

        el = document.createElement('div');
        el.classList.add('dialog-header');
        el.style.fontWeight = 'bold';
        button = document.createElement('button');
        button.classList.add('close');
        button.dataset.dismiss = 'modal';
        button.addEventListener('click', () => {
            this.$dialog.close();
        });
        button.innerHTML = '&times;';
        el.appendChild(button);
        this.$titleEl = document.createElement('div');
        this.$titleEl.style.paddingTop = '2px';
        this.$titleEl.textContent = this.$title || '';
        this.$dialog.dataset.title = this.$title;
        el.appendChild(this.$titleEl);
        this.$dialog.appendChild(el);
        this.$body = document.createElement('div');
        this.$body.classList.add('dialog-body', 'wizard-body');
        this.$dialog.appendChild(this.$body);

        el = document.createElement('div');
        el.classList.add('dialog-footer');

        this.$nav = document.createElement('select');
        this.$nav.style.cssFloat = 'left';
        this.$nav.classList.add('form-control', 'selectpicker', 'dropup');
        this.$nav.dataset.width = '200px';
        //this.$nav.dataset.container = '.' + this.id;
        this.$nav.dataset.dropupAuto = 'false';
        this.$nav.dataset.size = '12';
        this.$nav.addEventListener('change', (e) => {
            this.goto(+(<HTMLSelectElement>e.target).selectedIndex);
        });
        el.appendChild(this.$nav);

        this.$navMode = document.createElement('select');
        this.$navMode.style.cssFloat = 'left';
        this.$navMode.classList.add('form-control', 'selectpicker', 'dropup');
        this.$navMode.dataset.width = '100px';
        this.$navMode.dataset.dropupAuto = 'false';
        this.$navMode.dataset.size = '12';
        this.$navMode.addEventListener('change', (e) => {
            this.mode = +(<HTMLSelectElement>e.target).value;
        });
        this.$navMode.innerHTML = `<option value="${WizardMode.normal}">Normal</option><option value="${WizardMode.advanced}">Advanced</option><option value="${WizardMode.expert}">Expert</option>`
        el.appendChild(this.$navMode);
        $(this.$navMode).val('' + this.$mode);
        $(this.$navMode).selectpicker('render');
        $(this.$navMode).selectpicker('refresh');


        button = document.createElement('button');
        button.classList.add('btn', 'btn-default');
        button.style.cssFloat = 'right';
        button.addEventListener('click', () => {
            this.$dialog.close();
        });
        button.textContent = 'Cancel';
        el.appendChild(button);

        this.$finish = document.createElement('button');
        this.$finish.classList.add('btn', 'btn-primary');
        this.$finish.style.cssFloat = 'right';
        this.$finish.addEventListener('click', () => {
            if (this.$current === this.$navPages.length - 1) {
                const e = { data: this.$data, preventDefault: false };
                this.emit('finished', e);
                if (!e.preventDefault)
                    this.$dialog.close();
            }
            else
                this.last();
        });
        this.$finish.textContent = 'Finish';
        el.appendChild(this.$finish);

        button = document.createElement('div');
        button.classList.add('btn-group');
        button.style.cssFloat = 'right';
        this.$prev = document.createElement('button');
        this.$prev.title = 'Previous';
        this.$prev.classList.add('btn', 'btn-default');
        this.$prev.addEventListener('click', () => {
            this.prev();
        });
        this.$prev.innerHTML = '<i class="fa fa-chevron-left" aria-hidden="true"></i>';
        button.appendChild(this.$prev);
        this.$next = document.createElement('button');
        this.$next.title = 'Next';
        this.$next.classList.add('btn', 'btn-default');
        this.$next.addEventListener('click', () => {
            this.next();
        });
        this.$next.innerHTML = '<i class="fa fa-chevron-right" aria-hidden="true"></i>';
        button.appendChild(this.$next);

        el.appendChild(button);

        this.$dialog.appendChild(el);
        document.body.appendChild(this.$dialog);
        this.doUpdate(UpdateType.rebuildNav);
    }

    public destroy() {
        if (this.$dialog)
            this.$dialog.parentElement.removeChild(this.$dialog);
    }

    public addPages(pages) {
        if (!pages) return;
        if (!Array.isArray(pages))
            pages = [pages];
        this.$navPages = [];
        this.$pages.push(...pages);
        this.$pages.forEach((p, i) => {
            p.wizard = this
            if (p.visible && p.mode <= this.$mode)
                this.$navPages.push(i);
        });
        this.bindEvents(pages);
        this.doUpdate(UpdateType.rebuildNav | UpdateType.refresh);
    }

    public removePages(pages) {
        if (!pages) return;
        if (!Array.isArray(pages))
            pages = [pages];
        let pl = pages.length;
        let idx;
        while (pl--) {
            idx = this.$pages.indexOf(pages[pl]);
            if (idx !== -1)
                this.$pages.splice(idx, 1);
            idx = this.$navPages.indexOf(idx);
            if (idx !== -1)
                this.$navPages.splice(idx, 1);
        }
        this.unbindEvents(pages);
        this.doUpdate(UpdateType.rebuildNav | UpdateType.refresh);
    }

    public insertPages(idx, pages) {
        if (!pages) return;
        if (!Array.isArray(pages))
            pages = [pages];
        this.$navPages = [];
        this.$pages.splice(idx, 0, ...pages);
        this.$pages.forEach((p, i) => {
            p.wizard = this;
            if (p.visible && p.mode <= this.$mode)
                this.$navPages.push(i);
        });
        this.bindEvents(pages);
        this.doUpdate(UpdateType.rebuildNav | UpdateType.refresh);
    }

    private bindEvents(pages) {
        if (!pages) return;
        if (!Array.isArray(pages))
            pages = [pages];
        pages.forEach(p => {
            let e: HTMLElement[] = Array.from(p.page.querySelectorAll('input[type="checkbox"]'));
            e.forEach(c => c.addEventListener('change', this.getDataCheckbox.bind(this)));
            e = Array.from(p.page.querySelectorAll('input[type="radio"]'));
            e.forEach(c => c.addEventListener('change', this.getDataCheckbox.bind(this)));
            e = Array.from(p.page.querySelectorAll('input[type="text"]'));
            e.forEach(c => {
                c.addEventListener('change', this.getDataInput.bind(this));
                c.addEventListener('input', this.getDataInput.bind(this));
            });
            e = Array.from(p.page.querySelectorAll('input[type="number"]'));
            e.forEach(c => {
                c.addEventListener('change', this.getDataNumber.bind(this));
                c.addEventListener('input', this.getDataNumber.bind(this));
            });
            e = Array.from(p.page.querySelectorAll('textarea'));
            e.forEach(c => {
                c.addEventListener('change', this.getDataInput.bind(this));
                c.addEventListener('input', this.getDataInput.bind(this));
            });
            e = Array.from(p.page.querySelectorAll('.selectpicker'));
            e.forEach(c => c.addEventListener('change', this.getDataSelect.bind(this)));
        });
    }

    private unbindEvents(pages) {
        if (!pages) return;
        if (!Array.isArray(pages))
            pages = [pages];
        pages.forEach(p => {
            let e: HTMLElement[] = Array.from(p.page.querySelectorAll('input[type="checkbox"]'));
            e.forEach(c => c.removeEventListener('change', this.getDataCheckbox));
            e = Array.from(p.page.querySelectorAll('input[type="radio"]'));
            e.forEach(c => c.removeEventListener('change', this.getDataCheckbox));
            e = Array.from(p.page.querySelectorAll('input[type="text"]'));
            e.forEach(c => {
                c.removeEventListener('change', this.getDataInput);
                c.removeEventListener('input', this.getDataInput);
            });
            e = Array.from(p.page.querySelectorAll('input[type="number"]'));
            e.forEach(c => {
                c.removeEventListener('change', this.getDataNumber);
                c.removeEventListener('input', this.getDataNumber);
            });
            e = Array.from(p.page.querySelectorAll('textarea'));
            e.forEach(c => {
                c.removeEventListener('change', this.getDataInput);
                c.removeEventListener('input', this.getDataInput);
            });
            e = Array.from(p.page.querySelectorAll('.selectpicker'));
            e.forEach(c => c.removeEventListener('change', this.getDataSelect));
        });
    }

    private getDataInput(e) {
        const el = e.relatedTarget || e.target;
        const old = this.$data[el.id || el.name];
        this.$data[el.id || el.name] = el.value;
        if (!old || old != this.$data[el.id || el.name])
            this.emit('value-changed', { element: el, id: el.id || el.name, value: this.$data[el.id || el.name], wizard: this });
    }

    private getDataSelect(e) {
        const el = e.relatedTarget || e.target;
        const old = this.$data[el.id || el.name];
        this.$data[el.id || el.name] = { value: el.selectedOptions.length ? el.value : null, display: el.selectedOptions.length ? el.selectedOptions[0].textContent : null };
        if (!old || old.value !== this.$data[el.id || el.name].value || old.display !== this.$data[el.id || el.name].display)
            this.emit('value-changed', { element: el, id: el.id || el.name, value: this.$data[el.id || el.name].value, display: this.$data[el.id || el.name].display, wizard: this });
    }

    private getDataNumber(e) {
        const el = e.relatedTarget || e.target;
        const old = this.$data[el.id || el.name];
        this.$data[el.id || el.name] = +el.value;
        if (!old || old != this.$data[el.id || el.name])
            this.emit('value-changed', { element: el, id: el.id || el.name, value: this.$data[el.id || el.name], wizard: this });
    }

    private getDataCheckbox(e) {
        const el = e.relatedTarget || e.target;
        const old = this.$data[el.id || el.name];
        this.$data[el.id || el.name] = el.checked;
        if (!old || old != this.$data[el.id || el.name])
            this.emit('value-changed', { element: el, id: el.id || el.name, value: this.$data[el.id || el.name], wizard: this });
    }

    private rebuildNav() {
        if(!this.$nav) return;
        while (this.$nav.firstChild) {
            this.$nav.removeChild(this.$nav.firstChild);
        }
        const frag = document.createDocumentFragment();
        this.$pages.forEach((p, idx) => {
            if (!p.visible || p.mode > this.$mode) return;
            const op = document.createElement('option');
            op.textContent = p.title;
            op.value = '' + this.$navPages.indexOf(idx);
            if (idx === this.$current)
                op.selected = true;
            frag.appendChild(op);
        });
        this.$nav.appendChild(frag);
        $(this.$nav).selectpicker('refresh');
    }

    private updateNavButtons() {
        if (this.$current === 0)
            this.$prev.setAttribute('disabled', 'disabled');
        else
            this.$prev.removeAttribute('disabled');
        if (this.$current === this.$navPages.length - 1)
            this.$next.setAttribute('disabled', 'disabled');
        else
            this.$next.removeAttribute('disabled');
    }

    public goto(where, force?) {
        let dest;
        switch (where) {
            case 'first':
                dest = 0;
                break;
            case 'last':
                dest = this.$navPages.length - 1;
                break;
            case 'next':
                dest = this.$current + 1;
                break;
            case 'prev':
            case 'previous':
                dest = this.$current - 1;
                break;
            default:
                if (typeof where === 'number')
                    dest = where;
                break;
        }
        if (dest >= this.$navPages.length)
            dest = this.$navPages.length - 1;
        if (dest < 0)
            dest = 0;
        if (this.$current === dest && !force) return;
        const nDest = dest;
        dest = this.$navPages[nDest]
        let curr = this.$navPages[this.$current];
        const e = { destIndex: dest, destPage: this.$pages[dest], index: curr, page: this.$pages[curr], preventDefault: false };
        this.emit('hidden', e);
        if (e.preventDefault) return;
        if (this.$pages[curr]) {
            this.$pages[curr].emit('hidden', e);
            if (e.preventDefault) return;
        }
        this.$current = nDest;
        curr = this.$navPages[this.$current];
        this.refresh();
        this.$pages[curr].emit('shown', this.$pages[curr]);
        this.emit('shown', curr);
    }

    public next() { this.goto('next'); }
    public prev() { this.goto('prev'); }
    public previous() { this.goto('prev'); }
    public first() { this.goto(0); }
    public last() { this.goto('last'); }

    public refreshAll() {
        let curr = this.$navPages[this.$current];
        this.$navPages = [];
        this.$pages.forEach((p, i) => {
            p.wizard = this;
            if (p.visible && p.mode <= this.$mode)
                this.$navPages.push(i);
            else if (i === curr)
                curr++;
        });
        this.$current = this.$navPages.indexOf(curr);
        if (this.$current === -1)
            this.$current = this.$navPages.length - 1;
        this.rebuildNav();
        this.refresh();
    }

    public refresh() {
        if(!this.$body || !this.$nav || !this.$navPages) return;
        while (this.$body.firstChild) {
            this.$body.removeChild(this.$body.firstChild);
        }
        if (this.$navPages.length > 0 && this.$current < this.$navPages.length && this.$pages[this.$navPages[this.$current]])
            this.$body.appendChild(this.$pages[this.$navPages[this.$current]].page);
        this.$nav.selectedIndex = this.$current;
        $(this.$nav).val('' + this.$current);
        $(this.$nav).selectpicker('render');
        const inputs = this.$body.querySelectorAll('.wizard-body input,.wizard-body textarea,.wizard-body .bootstrap-select button');
        if (inputs.length !== 0)
            (<HTMLElement>inputs[0]).focus();
        this.doUpdate(UpdateType.updateNavButtons);
    }

    public show() {
        this.$data = copy(this.defaults) || {};
        if (this.$dialog.open) return;
        this.goto(0, true);
        this.$pages.forEach(p => {
            p.emit('reset', p);
            const e: HTMLElement[] = Array.from(p.page.querySelectorAll('input,textarea,.selectpicker'));
            e.forEach(c => {
                const evt = document.createEvent('HTMLEvents');
                evt.initEvent('change', false, true);
                c.dispatchEvent(evt);
            });
        });
        this.$dialog.showModal();
        this.emit('open');
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this.$update |= type;
        if (this.$update === UpdateType.none || this._rTimeout)
            return;
        this._rTimeout = window.requestAnimationFrame(() => {
            if ((this.$update & UpdateType.rebuildNav) === UpdateType.rebuildNav) {
                this.rebuildNav();
                this.$update &= ~UpdateType.rebuildNav;
            }
            if ((this.$update & UpdateType.updateNavButtons) === UpdateType.updateNavButtons) {
                this.updateNavButtons();
                this.$update &= ~UpdateType.updateNavButtons;
            }
            if ((this.$update & UpdateType.refresh) === UpdateType.refresh) {
                this.refresh();
                this.$update &= ~UpdateType.refresh;
            }
            this._rTimeout = 0;
            this.doUpdate(this.$update);
        });
    }
}