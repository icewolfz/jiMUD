
import EventEmitter = require('events');
import { capitalize, resetCursor, stringToEnum, enumToString } from './library';

export enum EditorType {
    default,
    flag,
    number,
    select,
    check,
    custom,
    readonly,
    dropdown
}

export abstract class ValueEditor extends EventEmitter {
    private $parent: HTMLElement;
    private $options: any;
    private $control: any;
    private $container: HTMLElement;
    private $data: any;
    public editorClick: any;
    public property;

    constructor(control, parent, property?, options?) {
        super();
        this.parent = parent;
        this.options = options;
        this.control = control;
        this.property = property;
    }

    set data(value) {
        this.$data = value;
    }
    get data() { return this.$data; }

    set control(ops) {
        this.$control = ops;
    }
    get control() { return this.$control; }

    set options(ops) {
        this.$options = ops;
    }
    get options() { return this.$options; }

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
        this.create();
    }

    get parent(): HTMLElement { return this.$parent; }

    public abstract create(): void;
    public abstract focus(): void;
    public abstract destroy(): void;
    public abstract scroll(): void;
    public abstract openAdvanced(): void;

    abstract get value(): any;
    abstract set value(value: any);

    public get container() {
        if (this.$container)
            return this.$container;
        const d = (this.control.parent || document.body);
        if (!this.options)
            return this.$container = d;
        if (typeof this.options.container === 'string') {
            if ((<string>this.options.container).startsWith('#'))
                return this.$container = document.getElementById((<string>this.options.container).substr(1)) || d;
            else
                return this.$container = document.body.querySelector(this.options.container) || d;
        }
        else if (this.options.container instanceof $)
            return this.$container = this.options.container[0] || d;
        else if (this.options.container instanceof HTMLElement)
            return this.$container = this.options.container || d;
        return this.$container = d;
    }
}

export class TextValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $dropdown: HTMLTextAreaElement;
    private $editor: HTMLTextAreaElement;
    private $noEnter;
    private $wrap;

    public create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor-dropdown-fill');
        const el = document.createElement('div');
        el.classList.add('property-grid-editor-dropdown-fill-container');
        this.$el.appendChild(el);
        this.$editor = document.createElement('textarea');
        this.$editor.classList.add('property-grid-editor');
        if (this.$wrap)
            this.$editor.style.whiteSpace = 'normal';
        this.$editor.addEventListener('paste', () => {
            if (!this.$noEnter) return;
            const sel = {
                start: this.$editor.selectionStart,
                end: this.$editor.selectionEnd
            };
            window.setTimeout(() => {
                this.$editor.value = this.$editor.value.replace(/(?:\r\n|\r|\n)/g, '');
                this.$editor.selectionStart = sel.start;
                this.$editor.selectionEnd = sel.end;
            });
        });
        this.$editor.addEventListener('keydown', (e) => {
            if (this.$noEnter && e.keyCode === 13) {
                e.preventDefault();
                e.cancelBubble = true;
                e.stopPropagation();
                return false;
            }
        });
        this.$editor.addEventListener('blur', (e) => {
            if (e.relatedTarget && ((<HTMLElement>e.relatedTarget).dataset.editor === 'dropdown')) {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return;
            }
            if (this.control.parent === e.relatedTarget)
                return;
            setTimeout(() => this.control.clearEditor(e));
        });
        this.$editor.addEventListener('click', (e) => {
            this.$editor.dataset.aOpen = null;
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (this.$noEnter && e.keyCode === 13) {
                e.preventDefault();
                e.cancelBubble = true;
                e.stopPropagation();
                this.$editor.blur();
                return false;
            }
            else if (e.keyCode === 27 || (e.keyCode === 13 && e.ctrlKey)) {
                this.$editor.blur();
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
        el.appendChild(this.$editor);

        const vl = document.createElement('button');
        vl.title = 'Open editor...';
        vl.innerHTML = '<span class="caret"></span>';
        vl.dataset.editor = 'dropdown';
        vl.addEventListener('click', (e) => {
            if (this.$editor.dataset.aOpen === 'true') {
                this.$editor.dataset.aOpen = null;
                this.$editor.focus();
                resetCursor(this.$editor);
                return;
            }
            this.$dropdown = document.createElement('textarea');
            this.$dropdown.classList.add('grid-editor-dropdown');
            if (this.$noEnter)
                this.$dropdown.classList.add('single');
            (<any>this.$dropdown).editor = this.$editor;
            if (!this.$wrap)
                this.$dropdown.classList.add('no-wrap');
            this.$dropdown.value = this.value;
            this.$dropdown.addEventListener('keydown', (e2) => {
                if (e2.keyCode === 27) {
                    e2.preventDefault();
                    e2.stopPropagation();
                    return false;
                }
                if (this.$noEnter && e2.keyCode === 13) {
                    e2.preventDefault();
                    e2.cancelBubble = true;
                    e2.stopPropagation();
                    return false;
                }
            });
            this.$dropdown.addEventListener('keypress', (e2) => {
                if (e2.keyCode === 27) {
                    e2.preventDefault();
                    e2.stopPropagation();
                    return false;
                }
            });
            this.$dropdown.addEventListener('keyup', (e2) => {
                if (this.$noEnter && e2.keyCode === 13) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                    e2.preventDefault();
                }
                else if (e2.keyCode === 27 || (e2.keyCode === 13 && e2.ctrlKey)) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                    e2.preventDefault();
                    e2.stopPropagation();
                    return false;
                }
                return;
            });
            this.positionDropdown();
            this.$dropdown.style.height = '150px';
            this.$dropdown.style.zIndex = '100';
            this.$dropdown.style.position = 'absolute';
            this.$dropdown.addEventListener('blur', (e2) => {
                const ec = this.editorClick;
                this.value = this.$dropdown.value;
                this.$editor.dataset.aOpen = 'true';
                this.$dropdown.remove();
                this.$dropdown = null;
                if (ec)
                    this.control.createEditor(ec);
                else if (e2 && e2.relatedTarget && (<any>e2.relatedTarget).tagNAME === 'BUTTON' && e2.relatedTarget !== e2.currentTarget) {
                    (<HTMLButtonElement>e2.relatedTarget).click();
                    this.$editor.dataset.aOpen = null;
                }
                else if (e2 && e.relatedTarget && this.control.parent.contains(e2.relatedTarget) && !this.$el.contains(<HTMLElement>e2.relatedTarget)) {
                    this.$editor.dataset.aOpen = null;
                }
                else {
                    this.focus();
                }
            }, { once: true });
            this.container.appendChild(this.$dropdown);
            if (this.$noEnter)
                this.$dropdown.placeholder = 'Press enter to accept text.';
            else
                this.$dropdown.placeholder = 'Press enter to begin a new line.\nPress Ctrl+Enter to accept text.';
            this.$dropdown.focus();
            resetCursor(this.$dropdown);
        });
        this.$el.appendChild(vl);
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$editor.focus();
        resetCursor(this.$editor);
    }
    public destroy() {
        if (this.$dropdown && this.$dropdown.parentNode && this.$dropdown.parentNode.contains(this.$dropdown))
            this.$dropdown.remove();
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() {
        if (this.$dropdown)
            this.positionDropdown();
    }

    public openAdvanced() { /**/ }

    private positionDropdown() {
        const b = this.parent.getBoundingClientRect();
        const c = this.container.getBoundingClientRect();
        let left = 0;
        let width = 300;
        let top = b.bottom - c.top;
        if (b.width < 300) {
            left = (b.left - 300 + b.width - c.left);
        }
        else {
            left = b.left - c.left;
            width = b.width;
        }
        if (left < -c.left)
            left = -c.left;
        if (width > document.body.clientWidth)
            width = document.body.clientWidth;
        if (Math.abs(left) + width > document.body.clientWidth)
            left = document.body.clientWidth - width;
        //extends past bottom so open up
        if (top + 150 > document.body.clientHeight)
            top = b.top - 150;

        this.$dropdown.style.left = left + 'px';
        this.$dropdown.style.width = width + 'px';
        this.$dropdown.style.top = top + 'px';
    }

    set options(ops) {
        super.options = ops;
        if (ops) {
            this.$noEnter = ops.singleLine || ops.noReturn;
            this.$wrap = ops.wrap;
        }
        if (this.$noEnter) {
            this.$editor.classList.add('single');
            if (this.$dropdown)
                this.$dropdown.classList.add('single');
        }
        else {
            this.$editor.classList.remove('single');
            if (this.$dropdown)
                this.$dropdown.classList.remove('single');
        }
        if (this.$wrap && this.$editor)
            this.$editor.style.whiteSpace = 'normal';
        else if (this.$editor)
            this.$editor.style.whiteSpace = '';
        if (this.$wrap && this.$dropdown)
            this.$dropdown.classList.remove('no-wrap');
        else if (this.$dropdown)
            this.$dropdown.classList.add('no-wrap');
    }
    get options() { return super.options; }

    get value() {
        return this.$editor.value;
    }
    set value(value: any) {
        this.$editor.value = value;
        resetCursor(this.$editor);
    }
}

export class BooleanValueEditor extends ValueEditor {
    private $el: HTMLSelectElement;

    public create() {
        this.$el = document.createElement('select');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor');
        this.$el.innerHTML = '<option value="true">True</option><option value="false">False</option>';
        this.$el.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                e.preventDefault();
                this.$el.blur();
            }
            return;
        });
        this.$el.addEventListener('blur', (e) => {
            setTimeout(() => this.control.clearEditor(e));
        });
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$el.focus();
    }
    public destroy() {
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() { /**/ }

    public openAdvanced() { /**/ }

    get value() {
        return this.$el.value === 'true';
    }
    set value(value: any) {
        this.$el.value = value ? 'true' : 'false';
    }
}

export class NumberValueEditor extends ValueEditor {
    private $el: HTMLInputElement;

    public create() {
        this.$el = document.createElement('input');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor');
        this.$el.type = 'number';
        this.$el.max = this.options ? (this.options.max || 1000) : 1000;
        this.$el.min = this.options ? (this.options.min || 0) : 0;
        this.$el.addEventListener('keydown', (e2) => {
            if (e2.keyCode === 27) {
                e2.preventDefault();
                e2.stopPropagation();
                return false;
            }
        });
        this.$el.addEventListener('keyup', (e) => {
            if (e.keyCode === 27 || e.keyCode === 13) {
                this.$el.blur();
                e.stopPropagation();
                e.preventDefault();
                return false;
            }
            return;
        });
        this.$el.addEventListener('blur', (e) => {
            setTimeout(() => this.control.clearEditor(e));
        });
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$el.focus();
    }
    public destroy() {
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() { /**/ }

    public openAdvanced() { /**/ }

    get value() {
        let value = +this.$el.value;
        if (value < +this.$el.min)
            value = +this.$el.min;
        if (value > +this.$el.max)
            value = +this.$el.max;
        return value;
    }
    set value(value: any) {
        this.$el.value = value;
    }
}

export class FlagValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $dropdown: HTMLElement;
    private $editor: HTMLInputElement;
    private $value;

    public create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
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
            if (this.control.parent === e.relatedTarget)
                return;
            setTimeout(() => this.control.clearEditor(e));
        });
        this.$editor.addEventListener('focus', () => {
            this.$editor.select();
        });
        this.$editor.addEventListener('click', (e) => {
            this.$editor.dataset.aOpen = null;
        });
        this.$editor.addEventListener('keydown', (e2) => {
            if (e2.keyCode === 27) {
                e2.preventDefault();
                e2.stopPropagation();
                return false;
            }
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (e.keyCode === 27 || e.keyCode === 13) {
                this.$editor.blur();
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
        this.$el.appendChild(this.$editor);

        const vl = document.createElement('button');
        vl.title = 'Open editor...';
        vl.innerHTML = '<span class="caret"></span>';
        vl.dataset.editor = 'dropdown';
        vl.addEventListener('click', (e) => {
            if (this.$editor.dataset.aOpen === 'true') {
                this.$editor.dataset.aOpen = null;
                this.$editor.focus();
                resetCursor(this.$editor);
                return;
            }
            this.$dropdown = document.createElement('div');
            (<any>this.$dropdown).editor = this.$editor;
            this.$dropdown.tabIndex = -1;
            this.$dropdown.classList.add('property-grid-editor-flag-dropdown');
            this.$dropdown.addEventListener('keyup', (e2) => {
                if (e2.keyCode === 27) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                    e2.preventDefault();
                    e2.stopPropagation();
                    return false;
                }
                return;
            });
            this.$dropdown.addEventListener('keydown', (e2) => {
                if (e2.keyCode === 27) {
                    e2.preventDefault();
                    e2.stopPropagation();
                    return false;
                }
            });
            this.$dropdown.style.zIndex = '100';
            this.$dropdown.style.position = 'absolute';
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            let height = 154;
            if (this.options && this.options.enum) {
                const en = this.options.enum;
                const values = Object.keys(en).filter(key => !isNaN(Number(en[key])));
                let val = values.length;
                height = val * 22;
                while (val--) {
                    if (this.options.exclude && this.options.exclude.includes(values[val]))
                        continue;
                    const l = document.createElement('label');
                    const i = document.createElement('input');
                    i.type = 'checkbox';
                    i.value = en[values[val]];
                    i.addEventListener('change', (e2) => {
                        const children = Array.from(this.$dropdown.children, c => c.children[0]);
                        let cl = children.length;
                        let child;
                        let value = 0;
                        if ((<HTMLInputElement>e2.currentTarget).value === '0') {
                            while (cl--) {
                                child = children[cl];
                                if (child.value !== '0')
                                    child.checked = false;
                            }
                            child.checked = true;
                        }
                        else {
                            let none;
                            while (cl--) {
                                child = children[cl];
                                if (child.value === '0') {
                                    none = child;
                                    child.checked = false;
                                }
                                else if (child.checked)
                                    value |= +child.value;
                            }
                            if (none && value === 0)
                                none.checked = true;
                        }
                        this.value = value;
                        this.$dropdown.focus();
                    });
                    l.appendChild(i);
                    l.appendChild(document.createTextNode(values[val]));
                    if (this.$value !== 0 && en[values[val]] === 0)
                        i.checked = false;
                    else
                        i.checked = (this.$value & en[values[val]]) === en[values[val]];
                    this.$dropdown.appendChild(l);
                }
            }
            if (height < 154) {
                this.$dropdown.style.height = height + 'px';
                this.$dropdown.style.overflow = 'hidden';
            }
            else
                this.$dropdown.style.height = '154px';
            this.positionDropdown();
            this.container.appendChild(this.$dropdown);
            this.$dropdown.focus();
        });
        this.$el.appendChild(vl);
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$editor.focus();
        resetCursor(this.$editor);
    }
    public destroy() {
        if (this.$dropdown && this.$dropdown.parentNode && this.$dropdown.parentNode.contains(this.$dropdown))
            this.$dropdown.remove();
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() {
        if (this.$dropdown)
            this.positionDropdown();
    }

    public openAdvanced() { /**/ }

    private positionDropdown() {
        const b = this.parent.getBoundingClientRect();
        const c = this.container.getBoundingClientRect();
        let left = 0;
        let width = 300;
        let top = b.top + this.$editor.parentElement.offsetHeight - c.top;
        if (b.width < 300) {
            left = (b.left - 300 + b.width - c.left);
        }
        else {
            left = b.left - c.left;
            width = b.width;
        }
        if (left < -c.left)
            left = -c.left;
        if (width > document.body.clientWidth)
            width = document.body.clientWidth;
        if (Math.abs(left) + width > document.body.clientWidth)
            left = document.body.clientWidth - width;
        //extends past bottom so open up
        if (top + this.$dropdown.clientHeight > document.body.clientHeight)
            top = b.top - this.$dropdown.clientHeight;

        this.$dropdown.style.left = left + 'px';
        this.$dropdown.style.width = width + 'px';
        this.$dropdown.style.top = top + 'px';
    }

    private $dropdownEvent = (e) => {
        if (e.relatedTarget && (<HTMLElement>e.relatedTarget).parentElement && (<HTMLElement>e.relatedTarget).parentElement.parentElement === this.$dropdown) {
            e.preventDefault();
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            return;
        }
        const ec = this.editorClick;
        this.$editor.dataset.aOpen = 'true';
        this.$dropdown.remove();
        this.$dropdown = null;
        if (ec)
            this.control.createEditor(ec);
        else if (e && e.relatedTarget && (<any>e.relatedTarget).tagNAME === 'BUTTON' && e.relatedTarget !== e.currentTarget) {
            (<HTMLButtonElement>e.relatedTarget).click();
            this.$editor.dataset.aOpen = null;
        }
        else if (e && e.relatedTarget && this.control.parent.contains(e.relatedTarget) && !this.$el.contains(<HTMLElement>e.relatedTarget)) {
            this.$editor.dataset.aOpen = null;
        }
        else {
            this.focus();
        }
    }

    get value() {
        if (!this.options) return 0;
        return this.$value = stringToEnum(this.$editor.value, this.options.enum, true);
    }
    set value(value: any) {
        if (!this.options.enum) return;
        this.$value = value;
        this.$editor.value = enumToString(value, this.options.enum);
        resetCursor(this.$editor);
    }
}

export class DropDownEditValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $dropdown: HTMLElement;
    private $editor: HTMLInputElement;

    public create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
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
            if (this.control.parent === e.relatedTarget)
                return;
            setTimeout(() => this.control.clearEditor(e));
        });
        this.$editor.addEventListener('focus', () => {
            this.$editor.select();
        });
        this.$editor.addEventListener('click', (e) => {
            this.$editor.dataset.aOpen = null;
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (e.keyCode === 27 || e.keyCode === 13) {
                this.$editor.blur();
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
        vl.title = 'Open editor...';
        vl.innerHTML = '<span class="caret"></span>';
        vl.dataset.editor = 'dropdown';
        vl.addEventListener('click', (e) => {
            if (this.$editor.dataset.aOpen === 'true') {
                this.$editor.dataset.aOpen = null;
                this.$editor.focus();
                resetCursor(this.$editor);
                return;
            }
            this.$dropdown = document.createElement('div');
            (<any>this.$dropdown).editor = this.$editor;
            this.$dropdown.tabIndex = -1;
            this.$dropdown.classList.add('property-grid-editor-flag-dropdown');
            this.$dropdown.addEventListener('keyup', (e2) => {
                if (e2.keyCode === 27) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                    e2.preventDefault();
                    e2.stopPropagation();
                    return false;
                }
                return;
            });
            this.$dropdown.addEventListener('keydown', (e2) => {
                if (e2.keyCode === 27) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                    e2.preventDefault();
                    e2.stopPropagation();
                    return false;
                }
            });
            this.$dropdown.style.zIndex = '100';
            this.$dropdown.style.position = 'absolute';
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            const data = this.options ? this.options.data || [] : [];
            let tl = data.length;
            const height = tl * 20;
            while (tl--) {
                const el = document.createElement('div');
                el.textContent = capitalize(data[tl]);
                el.addEventListener('click', (e2) => {
                    this.value = (<HTMLElement>e2.currentTarget).textContent.toLowerCase();
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
            this.positionDropdown();
            this.container.appendChild(this.$dropdown);
            this.$dropdown.focus();
        });
        this.$el.appendChild(vl);
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$editor.focus();
        resetCursor(this.$editor);
    }
    public destroy() {
        if (this.$dropdown && this.$dropdown.parentNode && this.$dropdown.parentNode.contains(this.$dropdown))
            this.$dropdown.remove();
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() {
        if (this.$dropdown)
            this.positionDropdown();
    }

    public openAdvanced() { /**/ }

    private positionDropdown() {
        const b = this.parent.getBoundingClientRect();
        const c = this.container.getBoundingClientRect();
        let left = 0;
        let width = 150;
        let top = b.top + this.$editor.parentElement.offsetHeight - c.top;
        if (b.width < 150) {
            left = (b.left - 150 + b.width - c.left);
        }
        else {
            left = b.left - c.left;
            width = b.width;
        }
        if (left < -c.left)
            left = -c.left;
        if (width > document.body.clientWidth)
            width = document.body.clientWidth;
        if (Math.abs(left) + width > document.body.clientWidth)
            left = document.body.clientWidth - width;
        //extends past bottom so open up
        if (top + this.$dropdown.offsetHeight > document.body.clientHeight)
            top = b.top - this.$dropdown.offsetHeight;

        this.$dropdown.style.left = left + 'px';
        this.$dropdown.style.width = width + 'px';
        this.$dropdown.style.top = top + 'px';
    }

    private $dropdownEvent = (e) => {
        if (e.relatedTarget && (<HTMLElement>e.relatedTarget).parentElement === this.$dropdown) {
            e.preventDefault();
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            return;
        }
        const ec = this.editorClick;
        this.$editor.dataset.aOpen = 'true';
        this.$dropdown.remove();
        this.$dropdown = null;
        if (ec)
            this.control.createEditor(ec);
        else if (e && e.relatedTarget && (<any>e.relatedTarget).tagNAME === 'BUTTON' && e.relatedTarget !== e.currentTarget) {
            (<HTMLButtonElement>e.relatedTarget).click();
            this.$editor.dataset.aOpen = null;
        }
        else if (e && e.relatedTarget && this.control.parent.contains(e.relatedTarget) && !this.$el.contains(<HTMLElement>e.relatedTarget)) {
            this.$editor.dataset.aOpen = null;
        }
        else {
            this.focus();
        }
    }

    get value() {
        return this.$editor.value;
    }
    set value(value: any) {
        this.$editor.value = value;
        resetCursor(this.$editor);
    }
}
