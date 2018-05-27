
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
    public editorClick: any;
    public property;
    public data;

    constructor(control, parent, property?, options?) {
        super();
        this.parent = parent;
        this.options = options;
        this.control = control;
        this.property = property
    }

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

    abstract create(): void;
    abstract focus(): void;
    abstract destroy(): void;

    abstract get value(): any;
    abstract set value(value: any);

    public get container() {
        if (this.$container)
            return this.$container;
        if (!this.options)
            return this.$container = document.body;
        if (typeof this.options.container === 'string') {
            if ((<string>this.options.container).startsWith('#'))
                return this.$container = document.getElementById((<string>this.options.container).substr(1)) || document.body;
            else
                return this.$container = document.body.querySelector(this.options.container) || document.body;
        }
        else if (this.options.container instanceof $)
            return this.$container = this.options.container[0] || document.body;
        else if (this.options.container instanceof HTMLElement)
            return this.$container = this.options.container || document.body;
        return this.$container = document.body;
    }
}

export class TextValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $dropdown: HTMLTextAreaElement;
    private $editor: HTMLTextAreaElement;
    private $noEnter;
    private $wrap;

    create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor-dropdown-fill');
        var el = document.createElement('div');
        el.classList.add('property-grid-editor-dropdown-fill-container');
        this.$el.appendChild(el);
        this.$editor = document.createElement('textarea');
        this.$editor.classList.add('property-grid-editor');
        if (this.$wrap)
            this.$editor.style.whiteSpace = 'normal';
        this.$editor.addEventListener('paste', () => {
            if (!this.$noEnter) return;
            var sel = {
                start: this.$editor.selectionStart,
                end: this.$editor.selectionEnd
            }
            var initialLength = this.$editor.value.length;
            window.setTimeout(() => {
                this.$editor.value = this.$editor.value.replace(/(?:\r\n|\r|\n)/g, '');
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
            if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'dropdown') {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return;
            }
            this.control.clearEditor(e);
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
            else if (e.keyCode === 27 || (e.keyCode === 13 && e.ctrlKey))
                this.$editor.blur();
        });
        el.appendChild(this.$editor);

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
            this.$dropdown = document.createElement('textarea');
            (<any>this.$dropdown).editor = this.$editor;
            this.$dropdown.style.height = '100%';
            if (!this.$wrap)
                this.$dropdown.style.whiteSpace = 'nowrap';
            this.$dropdown.value = this.value;
            this.$dropdown.addEventListener('keydown', (e) => {
                if (this.$noEnter && e.keyCode === 13) {
                    e.preventDefault();
                    e.cancelBubble = true;
                    e.stopPropagation();
                    return false;
                }
            });
            this.$dropdown.addEventListener('keyup', (e) => {
                if (this.$noEnter && e.keyCode === 13) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                    e.preventDefault();
                }
                else if (e.keyCode === 27 || (e.keyCode === 13 && e.ctrlKey)) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                }
                return;
            });
            this.positionDropdown();
            this.$dropdown.style.height = '150px';
            this.$dropdown.style.zIndex = '100';
            this.$dropdown.style.position = 'absolute';
            this.$dropdown.addEventListener('blur', (e) => {
                var ec = this.editorClick;
                this.$editor.value = this.$dropdown.value;
                this.$editor.dataset.aOpen = 'true';
                this.$dropdown.parentElement.removeChild(this.$dropdown);
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
            }, { once: true });
            this.container.appendChild(this.$dropdown);
            if (this.$noEnter)
                this.$dropdown.placeholder = 'Press enter to accept text.'
            else
                this.$dropdown.placeholder = 'Press enter to begin a new line.\nPress Ctrl+Enter to accept text.'
            this.$dropdown.focus();
            resetCursor(this.$dropdown);
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

    private positionDropdown() {
        var b = this.parent.getBoundingClientRect();
        var c = this.container.getBoundingClientRect();
        var left = 0;
        var width = 300;
        var top = b.bottom - c.top;
        if (b.width < 300) {
            left = (b.left - 300 + b.width - c.left);
        }
        else {
            left = b.left - c.left;
            width = b.width;
        }
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
        if (this.$noEnter)
            this.$editor.classList.add('single');
        else
            this.$editor.classList.add('remove');
        if (this.$wrap && this.$editor)
            this.$editor.style.whiteSpace = 'normal';
        else if (this.$editor)
            this.$editor.style.whiteSpace = '';
        if (this.$wrap && this.$dropdown)
            this.$dropdown.style.whiteSpace = 'normal';
        else if (this.$dropdown)
            this.$dropdown.style.whiteSpace = 'nowrap';
    }
    get options() { return super.options; }

    get value() {
        return this.$editor.value;
    }
    set value(value: any) {
        this.$editor.value = value;
    }
}

export class BooleanValueEditor extends ValueEditor {
    private $el: HTMLSelectElement;

    create() {
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
            this.control.clearEditor(e);
        });
        this.parent.appendChild(this.$el);
    }
    focus() {
        this.$el.focus();
    }
    destroy() {
        if (this.$el.parentElement)
            this.$el.parentElement.removeChild(this.$el);
    }

    get value() {
        return this.$el.value;
    }
    set value(value: any) {
        this.$el.value = value ? 'True' : 'False';
    }
}

export class NumberValueEditor extends ValueEditor {
    private $el: HTMLInputElement;

    create() {
        this.$el = document.createElement('input');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor');
        this.$el.type = 'number';
        this.$el.max = this.options ? (this.options.max || 1000) : 1000;
        this.$el.min = this.options ? (this.options.min || 0) : 0;
        this.$el.addEventListener('keyup', (e) => {
            if (e.keyCode === 27)
                this.$el.blur();
            return;
        });
        this.$el.addEventListener('blur', (e) => {
            this.control.clearEditor(e);
        });
        this.parent.appendChild(this.$el);
    }
    focus() {
        this.$el.focus();
    }
    destroy() {
        if (this.$el.parentElement)
            this.$el.parentElement.removeChild(this.$el);
    }

    get value() {
        var value = +this.$el.value;
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

    create() {
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
            this.control.clearEditor(e);
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
            (<any>this.$dropdown).editor = this.$editor;
            this.$dropdown.tabIndex = -1;
            this.$dropdown.classList.add('property-grid-editor-flag-dropdown');
            this.$dropdown.addEventListener('keyup', (e) => {
                if (e.keyCode === 27) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                }
                return;
            });
            this.$dropdown.style.zIndex = '100';
            this.$dropdown.style.position = 'absolute';
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            var height = 154;
            if (this.options && this.options.enum) {
                var en = this.options.enum;
                var values = Object.keys(en).filter(key => !isNaN(Number(en[key])));
                var vl = values.length;
                var height = vl * 22;
                while (vl--) {
                    if (this.options.exclude && this.options.exclude.includes(values[vl]))
                        continue;
                    var l = document.createElement('label');
                    var i = document.createElement('input');
                    i.type = 'checkbox';
                    i.value = en[values[vl]];
                    i.addEventListener('change', (e) => {
                        var children = Array.from(this.$dropdown.children, c => c.children[0]);
                        var cl = children.length;
                        var child;
                        var value = 0;
                        if ((<HTMLInputElement>e.currentTarget).value === '0') {
                            while (cl--) {
                                child = children[cl];
                                if (child.value !== '0')
                                    child.checked = false;
                            }
                            child.checked = true;
                        }
                        else {
                            var none;
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
                    l.appendChild(document.createTextNode(values[vl]));
                    if (this.$value !== 0 && en[values[vl]] === 0)
                        i.checked = false;
                    else
                        i.checked = (this.$value & en[values[vl]]) === en[values[vl]];
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

    private positionDropdown() {
        var b = this.parent.getBoundingClientRect();
        var c = this.container.getBoundingClientRect();
        var left = 0;
        var width = 300;
        var top = b.top + this.$editor.parentElement.offsetHeight - c.top;
        if (b.width < 300) {
            left = (b.left - 300 + b.width - c.left);
        }
        else {
            left = b.left - c.left;
            width = b.width;
        }
        //extends past bottom so open up
        if (top + this.$dropdown.clientHeight > document.body.clientHeight)
            top = b.top - this.$dropdown.clientHeight;

        this.$dropdown.style.left = left + 'px';
        this.$dropdown.style.width = width + 'px';
        this.$dropdown.style.top = top + 'px';
    }

    private $dropdownEvent = (e) => {
        if (e.relatedTarget && (<HTMLElement>e.relatedTarget).parentElement && (<HTMLElement>e.relatedTarget).parentElement.parentElement == this.$dropdown) {
            e.preventDefault();
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            return;
        }
        var ec = this.editorClick;
        this.$editor.dataset.aOpen = 'true';
        this.$dropdown.parentElement.removeChild(this.$dropdown);
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
    }
}

export class DropdownEditValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $dropdown: HTMLElement;
    private $editor: HTMLInputElement;
    private $value;

    create() {
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
            this.control.clearEditor(e);
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
            (<any>this.$dropdown).editor = this.$editor;
            this.$dropdown.tabIndex = -1;
            this.$dropdown.classList.add('property-grid-editor-flag-dropdown');
            this.$dropdown.addEventListener('keyup', (e) => {
                if (e.keyCode === 27) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                }
                return;
            });
            this.$dropdown.style.zIndex = '100';
            this.$dropdown.style.position = 'absolute';
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            var data = this.options ? this.options.data || [] : [];
            var tl = data.length;
            var height = tl * 20;
            while (tl--) {
                var el = document.createElement('div');
                el.textContent = capitalize(data[tl]);
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
            this.positionDropdown();
            this.container.appendChild(this.$dropdown);
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

    private positionDropdown() {
        var b = this.parent.getBoundingClientRect();
        var c = this.container.getBoundingClientRect();
        var left = 0;
        var width = 150;
        var top = b.top + this.$editor.parentElement.offsetHeight - c.top;
        if (b.width < 150) {
            left = (b.left - 150 + b.width - c.left);
        }
        else {
            left = b.left - c.left;
            width = b.width;
        }
        //extends past bottom so open up
        if (top + this.$dropdown.offsetHeight > document.body.clientHeight)
            top = b.top - this.$dropdown.offsetHeight;

        this.$dropdown.style.left = left + 'px';
        this.$dropdown.style.width = width + 'px';
        this.$dropdown.style.top = top + 'px';
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
    }
}
