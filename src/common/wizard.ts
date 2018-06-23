import EventEmitter = require('events');
import { DataGrid } from './datagrid';
const { remote } = require('electron');
const { dialog } = remote;

export interface WizardOptions {
    id: string;
    pages?: WizardPage[];
    title?: string;
}

export interface PageOptions {
    id: string;
    title: string;
    body?: any;
    reset?: Function;
    shown?: Function;
    hidden?: Function;
}

export interface DataGridPageOptions extends PageOptions {
    rows?: any[];
    columns?: any[];
    add?: Function;
    edit?: Function;
    delete?: Function;
}

export class WizardPage extends EventEmitter {
    private $body;
    private $el: HTMLElement;
    public title;
    public wizard: Wizard;

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
        }
    }

    public set body(value) {
        if (value === this.$body) return;
        if (this.$body) {
            while (this.$body.firstChild) {
                this.$body.removeChild(this.$body.firstChild);
            }
        }
        this.$body = value;
        if (!value) return;
        if (typeof value === 'string')
            this.$el.innerHTML = value;
        else if (value instanceof $) {
            const bl = value.length;
            for (let b = 0; b < bl; b++)
                this.$el.appendChild(value[b]);
        }
        else if (value instanceof HTMLElement)
            this.$el.appendChild(value);
    }
    public get body() { return this.$body; }

    public get page() { return this.$el; }
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
            if (!ep.preventDefault && dialog.showMessageBox(
                remote.getCurrentWindow(),
                {
                    type: 'warning',
                    title: 'Delete',
                    message: 'Delete selected?',
                    buttons: ['Yes', 'No'],
                    defaultId: 1
                })
                === 1)
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
            if (!this.wizard.data[this.id])
                this.wizard.data[this.id] = [];
            else
                this.wizard.data[this.id].length = 0;
            this.dataGrid.rows = this.wizard.data[this.id];
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
    private $dialog: HTMLDialogElement;
    private $id = 'wizard';
    private $body: HTMLElement;
    private $title;
    private $titleEl: HTMLElement;
    private $height = '208px';
    private $width = '500px';
    private $next: HTMLButtonElement;
    private $prev: HTMLButtonElement;
    private $data;

    private $pages: WizardPage[] = [];
    private $current = 0;
    private $nav: HTMLSelectElement;
    private $update: UpdateType;

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
        value = value || '500px';
        if (this.$width === value) return;
        this.$width = value;
        if (this.$dialog)
            this.$dialog.style.width = this.$width;
    }

    get height() { return this.$height; }
    set height(value) {
        value = value || '208px';
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
        this.unbindEvents(this.$pages);
        this.$pages = value;
        this.$pages.forEach(p => p.wizard = this);
        this.bindEvents(value);
    }

    get data() { return this.$data; }

    get open() { return this.$dialog.open; }

    constructor(options?: WizardOptions) {
        super();
        if (options) {
            this.id = options.id || 'wizard';
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
        this.$nav.classList.add('form-control', 'selectpicker');
        this.$nav.dataset.width = '200px';
        this.$nav.addEventListener('change', (e) => {
            this.goto(+(<HTMLSelectElement>e.target).selectedIndex);
        });
        el.appendChild(this.$nav);

        button = document.createElement('button');
        button.classList.add('btn', 'btn-default');
        button.style.cssFloat = 'right';
        button.addEventListener('click', () => {
            this.$dialog.close();
        });
        button.textContent = 'Cancel';
        el.appendChild(button);

        button = document.createElement('button');
        button.classList.add('btn', 'btn-primary');
        button.style.cssFloat = 'right';
        button.addEventListener('click', () => {
            if (this.$current === this.$pages.length - 1) {
                const e = { data: this.$data, preventDefault: false };
                this.emit('finished', e);
                if (!e.preventDefault)
                    this.$dialog.close();
            }
            else
                this.last();
        });
        button.textContent = 'Finish';
        el.appendChild(button);

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
        this.$pages.push(...pages);
        this.$pages.forEach(p => p.wizard = this);
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
            this.$pages.splice(idx, 1);
        }
        this.unbindEvents(pages);
        this.doUpdate(UpdateType.rebuildNav | UpdateType.refresh);
    }

    public insertPages(idx, pages) {
        if (!pages) return;
        if (!Array.isArray(pages))
            pages = [pages];
        this.$pages.splice(idx, 0, ...pages);
        this.$pages.forEach(p => p.wizard = this);
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
        this.$data[el.id || el.name] = el.value;
    }

    private getDataSelect(e) {
        const el = e.relatedTarget || e.target;
        this.$data[el.id || el.name] = { value: el.value, display: el.selectedOptions[0].textContent };
    }

    private getDataNumber(e) {
        const el = e.relatedTarget || e.target;
        this.$data[el.id || el.name] = +el.value;
    }

    private getDataCheckbox(e) {
        const el = e.relatedTarget || e.target;
        this.$data[el.id || el.name] = el.checked;
    }

    private rebuildNav() {
        while (this.$nav.firstChild) {
            this.$nav.removeChild(this.$nav.firstChild);
        }
        const frag = document.createDocumentFragment();
        this.$pages.forEach((p, idx) => {
            const op = document.createElement('option');
            op.textContent = p.title;
            op.value = '' + idx;
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
        if (this.$current === this.$pages.length - 1)
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
                dest = this.$pages.length - 1;
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
        if (dest >= this.$pages.length)
            dest = this.$pages.length - 1;
        if (dest < 0)
            dest = 0;
        if (this.$current === dest && !force) return;
        this.emit('hidden', this.$current);
        this.$pages[this.$current].emit('hidden', this.$pages[this.$current]);
        this.$current = dest;
        this.refresh();
        this.$pages[this.$current].emit('shown', this.$pages[this.$current]);
        this.emit('shown', this.$current);
    }

    public next() { this.goto('next'); }
    public prev() { this.goto('prev'); }
    public previous() { this.goto('prev'); }
    public first() { this.goto(0); }
    public last() { this.goto('last'); }

    public refresh() {
        while (this.$body.firstChild) {
            this.$body.removeChild(this.$body.firstChild);
        }
        if (this.$pages.length > 0)
            this.$body.appendChild(this.$pages[this.$current].page);
        this.$nav.selectedIndex = this.$current;
        $(this.$nav).val('' + this.$current);
        $(this.$nav).selectpicker('render');
        const inputs = this.$body.querySelectorAll('.wizard-body input,.wizard-body textarea,.wizard-body .bootstrap-select button');
        if (inputs.length !== 0)
            (<HTMLElement>inputs[0]).focus();
        this.doUpdate(UpdateType.updateNavButtons);
    }

    public show() {
        this.$data = {};
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
        if (this.$update === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
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
            this.doUpdate(this.$update);
        });
    }
}