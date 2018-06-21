import EventEmitter = require('events');

export interface WizardOptions {
    id: string;
    pages?: WizardPage[];
    title?: string;
}

export interface PageOptions {
    title: string;
    body;
    reset?: Function;
}

export class WizardPage extends EventEmitter {
    private $body;
    private $el: HTMLElement;
    public title;
    private $reset;

    constructor(options?: PageOptions) {
        super();
        this.$el = document.createElement('div');
        this.$el.classList.add('wizard-page');
        if (options) {
            this.title = options.title || '';
            this.body = options.body;
            if (options.reset)
                this.on('reset', options.reset);
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

    public pages: WizardPage[] = [];
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
            if (this.$current === this.pages.length - 1) {
                this.emit('finished');
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
        this.pages.push(...pages);
        this.doUpdate(UpdateType.rebuildNav | UpdateType.refresh);
    }

    public removePages(pages) {
        if (!pages) return;
        if (!Array.isArray(pages))
            pages = [pages];
        let pl = pages.length;
        let idx;
        while (pl--) {
            idx = this.pages.indexOf(pages[pl]);
            this.pages.splice(idx, 1);
        }
        this.doUpdate(UpdateType.rebuildNav | UpdateType.refresh);
    }

    public insertPages(idx, pages) {
        if (!pages) return;
        if (!Array.isArray(pages))
            pages = [pages];
        this.pages.splice(idx, 0, ...pages);
        this.doUpdate(UpdateType.rebuildNav | UpdateType.refresh);
    }

    private rebuildNav() {
        while (this.$nav.firstChild) {
            this.$nav.removeChild(this.$nav.firstChild);
        }
        const frag = document.createDocumentFragment();
        this.pages.forEach((p, idx) => {
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
        if (this.$current === this.pages.length - 1)
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
                dest = this.pages.length - 1;
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
        if (dest >= this.pages.length)
            dest = this.pages.length - 1;
        if (dest < 0)
            dest = 0;
        if (this.$current === dest && !force) return;
        this.emit('hidden', this.$current);
        this.$current = dest;
        this.refresh();
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
        if (this.pages.length > 0)
            this.$body.appendChild(this.pages[this.$current].page);
        this.$nav.selectedIndex = this.$current;
        $(this.$nav).val('' + this.$current);
        $(this.$nav).selectpicker('render');
        const inputs = this.$body.querySelectorAll('.wizard-body input,.wizard-body textarea,.wizard-body .bootstrap-select button');
        if (inputs.length !== 0)
            (<HTMLElement>inputs[0]).focus();
        this.doUpdate(UpdateType.updateNavButtons);
    }

    public show() {
        if (this.$dialog.open) return;
        this.goto(0, true);
        this.pages.forEach(p => {
            p.emit('reset');
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