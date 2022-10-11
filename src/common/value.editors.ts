//spellchecker:ignore datagrid dropdown
import EventEmitter = require('events');
import { capitalize, resetCursor, stringToEnum, enumToString } from './library';
import { DataGrid } from './datagrid';

export enum EditorType {
    default,
    flag,
    number,
    select,
    check,
    custom,
    readonly,
    dropdown,
    collection,
    button
}

export abstract class ValueEditor extends EventEmitter {
    private $parent: HTMLElement;
    private $options: any;
    private $control: any;
    private $container: HTMLElement;
    private $data: any;
    public editorClick: any;
    public property;
    public editors: any[];

    constructor(control, parent, property?, options?) {
        super();
        this.options = options;
        this.parent = parent;
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
    public destroy() {
        $(this.parent).tooltip('destroy');
    }
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

    public valid() {
        if (this.options && this.options.validate) {
            this.$parent.title = '';
            const r = this.options.validate(this.data[this.property], this.value, this.data);
            if (typeof r === 'string') {
                this.$parent.title = r;
                $(this.$parent).tooltip({ container: 'body', delay: { show: 100, hide: 250 } });
                $(this.$parent).tooltip('show');
                this.focus();
                return false;
            }
            else if (!r) {
                this.$parent.title = 'Invalid value';
                $(this.$parent).tooltip({ container: 'body', delay: { show: 100, hide: 250 } });
                $(this.$parent).tooltip('show');
                this.focus();
                return false;
            }
        }
        return true;
    }
}

export class TextValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $dropdown: HTMLTextAreaElement;
    private $editor: HTMLTextAreaElement;
    private $noEnter;
    private $wrap;
    private $ignore = false;
    private $dBlur;
    private $cancel = false;
    private $clicked = false;

    public create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor-dropdown-fill');
        if (this.options && this.options.noDropdown)
            this.$el.classList.add('property-grid-no-dropdown');
        const el = document.createElement('div');
        el.classList.add('property-grid-editor-dropdown-fill-container');
        this.$el.appendChild(el);
        this.$editor = document.createElement('textarea');
        if (this.options && this.options.placeholder)
            this.$editor.placeholder = this.options.placeholder;
        this.$editor.classList.add('property-grid-editor');
        if (this.$wrap)
            this.$editor.style.whiteSpace = 'normal';
        this.$editor.addEventListener('paste', (e) => {
            if (!this.$noEnter) return;
            const sel = {
                start: this.$editor.selectionStart,
                end: this.$editor.selectionEnd,
                new: e.clipboardData.getData('text/plain').replace(/(?:\r\n|\r|\n)/g, '').length
            };
            window.setTimeout(() => {
                const len = this.$editor.value.length;
                this.$editor.value = this.$editor.value.replace(/(?:\r\n|\r|\n)/g, '');
                //only worry about if different lengths
                if (len === this.$editor.value.length) return;
                this.$editor.selectionStart = sel.start + sel.new;
                this.$editor.selectionEnd = sel.end + sel.new;
            });
        });
        this.$editor.addEventListener('blur', (e) => {
            if (this.$ignore) return;
            if (this.$clicked) {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                this.$clicked = false;
                return;
            }
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
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$editor.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$editor.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$editor.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (!this.$noEnter && e.keyCode === 13 && e.ctrlKey) {
                e.preventDefault();
                e.cancelBubble = true;
                e.stopPropagation();
                return false;
            }
            else if (e.keyCode === 13) {
                e.preventDefault();
                e.cancelBubble = true;
                e.stopPropagation();
                setTimeout(() => this.control.clearEditor(e, this));
                return false;
            }
            else if (e.keyCode === 27) {
                setTimeout(() => this.control.clearEditor(e, false, true));
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
        this.$editor.addEventListener('keypress', e => {
            if (e.keyCode === 13) {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return false;
            }
        });
        this.$editor.addEventListener('keydown', (e) => {
            if (!this.$noEnter && e.keyCode === 13 && e.ctrlKey) {
                const start = this.$editor.selectionStart;
                const end = this.$editor.selectionEnd;
                const value = this.$editor.value;
                this.$editor.value = value.substring(0, start) + '\n' + value.substring(end);
                this.$editor.selectionStart = start + 1;
                this.$editor.selectionEnd = start + 1;
                this.$editor.setSelectionRange(start + 2, start + 2);
                this.$ignore = true;
                this.$editor.blur();
                this.$editor.focus();
                this.$ignore = false;
                e.preventDefault();
                e.cancelBubble = true;
                e.stopPropagation();
                return false;
            }
            else if (e.keyCode === 13) {
                e.preventDefault();
                e.cancelBubble = true;
                e.stopPropagation();
                return false;
            }
            else if (e.keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });

        el.appendChild(this.$editor);
        if (!this.options || !this.options.noDropdown) {
            const vl = document.createElement('button');
            vl.title = 'Open editor...';
            vl.innerHTML = '<span class="caret"></span>';
            vl.dataset.editor = 'dropdown';
            vl.addEventListener('click', (e) => {
                if (this.options && this.options.dialog) {
                    e.stopPropagation();
                    e.cancelBubble = true;
                    this.$clicked = true;
                    const notes: HTMLDialogElement = <HTMLDialogElement>document.createElement('dialog');
                    notes.id = 'text-' + new Date().getTime();
                    notes.addEventListener('open', () => this.control.emit('dialog-open'));
                    notes.addEventListener('close', () => {
                        if (notes.open)
                            notes.close();
                        notes.remove();
                        this.control.emit('dialog-close');
                    });
                    notes.addEventListener('cancel', () => {
                        if (notes.open)
                            notes.close();
                        notes.remove();
                        this.control.emit('dialog-cancel');
                    });

                    notes.style.width = '400px';
                    notes.style.height = '450px';
                    notes.style.padding = '0px';
                    notes.innerHTML = `
                <div class="dialog-header" style="font-weight: bold">
                    <button title="close" type="button" class="close" data-dismiss="modal" onclick="document.getElementById('${notes.id}').close();">&times;</button>
                    <button title="Open advanced editor..." type="button" class="close" style="font-size: 16px;padding-top: 3px;padding-right: 4px;" onclick="openAdvancedEditor(document.getElementById('${notes.id}-value').value);document.getElementById('${notes.id}-value').focus();"><i class="fa fa-edit"></i></button>
                    <div style="padding-top: 2px;">${this.options ? this.options.title || 'Edit&hellip;' : 'Edit&hellip;'}</div>
                </div>
                <div class="dialog-body" style="padding-top:33px">
                    <div class="form-group"><label class="control-label" style="padding: 10px;width: 100%">
                    <textarea class="input-sm form-control" id="${notes.id}-value" style="width: 100%;height: 338px;">${this.value || ''}</textarea></label></div>
                </div>
                <div class="dialog-footer">
                    <button style="float: right" type="button" class="btn btn-default" onclick="document.getElementById('${notes.id}').close();">Cancel</button>
                    <button style="float: right" type="button" class="btn btn-primary">Ok</button>
                </div>`;
                    document.body.appendChild(notes);
                    notes.lastElementChild.lastElementChild.addEventListener('click', () => {
                        this.value = notes.children[1].querySelector('textarea').value;
                        if (notes.open)
                            notes.close();
                        notes.remove();
                        this.$editor.focus();
                    });
                    notes.showModal();
                    return;
                }
                this.$cancel = false;
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
                    else if (!this.$noEnter && e2.keyCode === 13 && e2.ctrlKey) {
                        const start = this.$dropdown.selectionStart;
                        const end = this.$dropdown.selectionEnd;
                        const value = this.$dropdown.value;
                        this.$dropdown.value = value.substring(0, start) + '\n' + value.substring(end);
                        this.$dropdown.selectionStart = start + 1;
                        this.$dropdown.selectionEnd = start + 1;
                        this.$dropdown.setSelectionRange(start + 1, start + 1);
                        this.$ignore = true;
                        this.$dropdown.blur();
                        this.$dropdown.focus();
                        this.$ignore = false;
                        e2.preventDefault();
                        e2.stopPropagation();
                        return false;
                    }
                    else if (this.$noEnter && e2.keyCode === 13) {
                        e2.preventDefault();
                        e2.cancelBubble = true;
                        e2.stopPropagation();
                        return false;
                    }
                });
                this.$dropdown.addEventListener('keypress', (e2) => {
                    if (e2.keyCode === 13) {
                        e2.preventDefault();
                        e2.stopPropagation();
                        return false;
                    }
                    if (e2.keyCode === 27) {
                        e2.preventDefault();
                        e2.stopPropagation();
                        return false;
                    }
                });
                this.$dropdown.addEventListener('keyup', (e2) => {
                    if (!this.$noEnter && e2.keyCode === 13 && e2.ctrlKey) {
                        e2.preventDefault();
                        e2.stopPropagation();
                        return;
                    }
                    if (e2.keyCode === 13) {
                        this.focus();
                        this.$editor.dataset.aOpen = null;
                        e2.preventDefault();
                    }
                    else if (e2.keyCode === 27) {
                        this.$cancel = true;
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
                this.$dBlur = (e2) => {
                    if (this.$ignore) {
                        this.$dropdown.addEventListener('blur', this.$dBlur.bind(this), { once: true });
                        return;
                    }
                    const ec = this.editorClick;
                    if (!this.$cancel)
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
                };
                this.$dropdown.addEventListener('blur', this.$dBlur.bind(this), { once: true });
                this.$dropdown.addEventListener('click', (e2) => {
                    e2.stopPropagation();
                    e2.cancelBubble = true;
                });
                this.$dropdown.addEventListener('dblclick', (e2) => {
                    e2.stopPropagation();
                    e2.cancelBubble = true;
                });
                this.$dropdown.addEventListener('mousedown', (e2) => {
                    e2.stopPropagation();
                    e2.cancelBubble = true;
                });
                this.$dropdown.addEventListener('mouseup', (e2) => {
                    e2.stopPropagation();
                    e2.cancelBubble = true;
                });
                this.container.appendChild(this.$dropdown);
                if (this.$noEnter)
                    this.$dropdown.placeholder = 'Press enter to accept text.';
                else
                    this.$dropdown.placeholder = 'Press ctrl+enter to begin a new line.\nPress enter to accept text.';
                this.$dropdown.focus();
                resetCursor(this.$dropdown);
            });
            this.$el.appendChild(vl);
        }
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$editor.focus();
        resetCursor(this.$editor);
    }
    public destroy() {
        super.destroy();
        if (this.$dropdown && this.$dropdown.parentNode && this.$dropdown.parentNode.contains(this.$dropdown))
            this.$dropdown.remove();
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() {
        if (this.$dropdown)
            this.positionDropdown();
    }

    public openAdvanced() {
        (<HTMLButtonElement>this.parent.lastChild.lastChild).click();
    }

    private positionDropdown() {
        const b = this.parent.getBoundingClientRect();
        const c = this.container.getBoundingClientRect();
        let left = 0;
        let width = this.options.minWidth || 300;
        let top = b.bottom - c.top;
        if (b.width < width) {
            left = (b.left - width + b.width - c.left);
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
            if (this.$editor)
                this.$editor.classList.add('single');
            if (this.$dropdown)
                this.$dropdown.classList.add('single');
        }
        else {
            if (this.$editor)
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
                setTimeout(() => this.control.clearEditor(e, this));
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
        super.destroy();
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
        this.$el.min = this.options ? (this.options.min || 0) : -1000;
        this.$el.addEventListener('keydown', (e2) => {
            if (e2.keyCode === 27) {
                e2.preventDefault();
                e2.stopPropagation();
                return false;
            }
        });
        this.$el.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                e.stopPropagation();
                e.preventDefault();
                setTimeout(() => this.control.clearEditor(e, this));
                return false;
            }
            else if (e.keyCode === 27) {
                setTimeout(() => this.control.clearEditor(e, null, true));
                e.stopPropagation();
                e.preventDefault();
                return false;
            }
            return;
        });
        this.$el.addEventListener('blur', (e) => {
            setTimeout(() => this.control.clearEditor(e));
        });
        this.$el.addEventListener('click', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$el.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$el.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$el.focus();
    }
    public destroy() {
        super.destroy();
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
    private $dValue;
    private $cancel;

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
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$editor.addEventListener('keydown', (e2) => {
            if (e2.keyCode === 27) {
                e2.preventDefault();
                e2.stopPropagation();
                return false;
            }
        });
        this.$editor.addEventListener('db;click', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$editor.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$editor.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
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
        this.$el.appendChild(this.$editor);

        const vl = document.createElement('button');
        vl.title = 'Open editor...';
        vl.innerHTML = '<span class="caret"></span>';
        vl.dataset.editor = 'dropdown';
        vl.addEventListener('click', (e) => {
            this.$cancel = false;
            this.$dValue = this.$value;
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
                if (e2.keyCode === 13) {
                    setTimeout(() => this.control.clearEditor(e, this));
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
                else if (e2.keyCode === 27) {
                    this.$cancel = true;
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
                        this.$dValue = value;
                        this.$dropdown.focus();
                    });
                    l.appendChild(i);
                    l.appendChild(document.createTextNode(capitalize(values[val].replace(/_/g, ' ').toLowerCase())));
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
            this.$dropdown.addEventListener('click', (e2) => {
                e2.stopPropagation();
                e2.cancelBubble = true;
            });
            this.$dropdown.addEventListener('dblclick', (e2) => {
                e2.stopPropagation();
                e2.cancelBubble = true;
            });
            this.$dropdown.addEventListener('mousedown', (e2) => {
                e2.stopPropagation();
                e2.cancelBubble = true;
            });
            this.$dropdown.addEventListener('mouseup', (e2) => {
                e2.stopPropagation();
                e2.cancelBubble = true;
            });
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
        super.destroy();
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
        if (!this.$cancel)
            this.value = this.$dValue;
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
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$editor.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
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
        this.$editor.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
        });
        this.$editor.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
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
                if (e2.keyCode === 13) {
                    setTimeout(() => this.control.clearEditor(e, this));
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
                else if (e2.keyCode === 27) {
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
            const data = this.options ? this.options.data || [] : [];
            let tl = data.length;
            const height = tl * 20;
            while (tl--) {
                const el = document.createElement('div');
                el.classList.add('property-grid-editor-flag-dropdown-item');
                if (typeof data[tl] === 'object') {
                    if (data[tl].type === 'group') {
                        el.classList.add('property-grid-editor-flag-dropdown-item-group');
                        if (data[tl].items) {
                            const f = document.createDocumentFragment();
                            data[tl].items.forEach(i => {
                                const el2 = document.createElement('div');
                                el2.classList.add('property-grid-editor-flag-dropdown-item-group-item');
                                el2.textContent = capitalize(i.display || i.value);
                                el2.dataset.value = i.value;
                                el2.addEventListener('click', (e2) => {
                                    this.value = (<HTMLElement>e2.currentTarget).dataset.value || (<HTMLElement>e2.currentTarget).textContent.toLowerCase();
                                    this.focus();
                                    this.$editor.dataset.aOpen = null;
                                });
                                f.appendChild(el2);
                            });
                            this.$dropdown.insertBefore(f, this.$dropdown.firstChild);
                        }
                        if (data[tl].value)
                            el.addEventListener('click', (e2) => {
                                this.value = (<HTMLElement>e2.currentTarget).dataset.value;
                                this.focus();
                                this.$editor.dataset.aOpen = null;
                            });
                    }
                    el.textContent = capitalize(data[tl].display || data[tl].value);
                    el.dataset.value = data[tl].value;
                }
                else
                    el.textContent = capitalize(data[tl]);
                if (typeof data[tl] !== 'object' || (typeof data[tl] === 'object' && data[tl].type !== 'group'))
                    el.addEventListener('click', (e2) => {
                        this.value = (<HTMLElement>e2.currentTarget).dataset.value || (<HTMLElement>e2.currentTarget).textContent.toLowerCase();
                        this.focus();
                        this.$editor.dataset.aOpen = null;
                    });
                this.$dropdown.insertBefore(el, this.$dropdown.firstChild);
            }
            if (height < 160) {
                this.$dropdown.style.height = height + 'px';
                this.$dropdown.style.overflow = 'hidden';
                this.positionDropdown(height);
            }
            else {
                this.$dropdown.style.height = '160px';
                this.positionDropdown(160);
            }
            this.$dropdown.addEventListener('click', (e2) => {
                e2.stopPropagation();
                e2.cancelBubble = true;
            });
            this.$dropdown.addEventListener('dblclick', (e2) => {
                e2.stopPropagation();
                e2.cancelBubble = true;
            });
            this.$dropdown.addEventListener('mousedown', (e2) => {
                e2.stopPropagation();
                e2.cancelBubble = true;
            });
            this.$dropdown.addEventListener('mouseup', (e2) => {
                e2.stopPropagation();
                e2.cancelBubble = true;
            });
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
        super.destroy();
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

    private positionDropdown(height?) {
        const b = this.parent.getBoundingClientRect();
        const c = this.container.getBoundingClientRect();
        let left = 0;
        let width = 150;
        let top = b.bottom - c.top;
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
        height = height || this.$dropdown.offsetHeight;
        //extends past bottom so open up
        if (top + height > document.body.clientHeight)
            top = b.top - height;

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

export class CollectionValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $editor: HTMLInputElement;
    private $value;
    private $edit;
    private $del;
    private $copy;
    private $cut;
    private $paste;
    private $dButton;
    private $dialog;

    public create() {
        this.$el = document.createElement('div');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor-dropdown', 'property-grid-editor-collection');
        this.$editor = document.createElement('input');
        this.$editor.type = 'text';
        this.$editor.readOnly = true;
        this.$editor.classList.add('property-grid-editor');
        this.$editor.addEventListener('blur', (e) => {
            if ((this.$dialog && this.$dialog.contains(e.relatedTarget)) || (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'dropdown')) {
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
        this.$editor.addEventListener('click', e => {
            this.openAdvanced();
        });
        this.$dButton = document.createElement('button');
        this.$dButton.title = 'Edit' + (this.options ? ' ' + this.options.type + 's' : '') + '...';
        this.$dButton.innerHTML = '&hellip;';
        this.$dButton.dataset.editor = 'dropdown';
        this.$dButton.addEventListener('click', (e) => {
            if (this.$dialog && this.$dialog.open)
                return;
            this.$dialog = <HTMLDialogElement>document.createElement('dialog');
            this.$dialog.style.width = '500px';
            this.$dialog.style.height = '300px';
            this.$dialog.style.padding = '5px';
            this.$dialog.cleanUp = () => {
                this.options.columns.forEach(c => {
                    if (c.editor && c.editor.options && c.editor.options.container === this.$dialog)
                        delete c.editor.options.container;
                });
                this.$dialog.remove();
                this.focus();
            };
            this.$dialog.addEventListener('close', () => {
                this.control.emit('dialog-close');
                this.$dialog.cleanUp();
            });
            this.$dialog.addEventListener('cancel', () => {
                this.control.emit('dialog-cancel');
                this.$dialog.cleanUp();
            });
            let header = document.createElement('div');
            header.classList.add('dialog-header');
            header.style.fontWeight = 'bold';
            let button = document.createElement('button');
            button.classList.add('close');
            button.type = 'button';
            button.dataset.dismiss = 'modal';
            button.addEventListener('click', () => {
                this.$dialog.close();
                this.$dialog.cleanUp();
            });
            button.innerHTML = '&times;';
            header.appendChild(button);
            let el = document.createElement('div');
            el.style.paddingTop = '2px';
            el.innerHTML = capitalize(this.control.getPropertyOptions(this.property, 'label') || this.property) + '&hellip;';
            header.appendChild(el);
            this.$dialog.appendChild(header);
            header = document.createElement('div');
            header.classList.add('dialog-body');
            header.style.paddingTop = '40px';
            this.$dialog.appendChild(header);
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
            dg.enterMoveNew = this.options ? this.options.enterMoveNew : true;
            dg.clipboardPrefix = 'jiMUD/';
            if (this.options && this.options.columns) {
                dg.columns = this.options.columns.map(c => {
                    if (!c.editor)
                        c.editor = { options: { container: this.$dialog } };
                    else if (!c.editor.options)
                        c.editor.options = { container: this.$dialog };
                    else if (!c.editor.options.container)
                        c.editor.options.container = this.$dialog;
                    return c;
                });
            }
            dg.addRows(this.$value.map(a => ({ ...a })));
            dg.on('selection-changed', () => {
                if (dg.selectedCount) {
                    this.$edit.removeAttribute('disabled');
                    this.$del.removeAttribute('disabled');
                    if (dg.selectedCount > 1)
                        this.$del.title = 'Delete' + (this.options ? ' ' + this.options.type + 's' : '');
                    else
                        this.$del.title = 'Delete' + (this.options ? ' ' + this.options.type : '');
                    this.$cut.removeAttribute('disabled');
                    this.$copy.removeAttribute('disabled');
                }
                else {
                    this.$edit.setAttribute('disabled', 'true');
                    this.$del.setAttribute('disabled', 'true');
                    this.$del.title = 'Delete' + (this.options ? ' ' + this.options.type + '(s)' : '');
                    this.$cut.setAttribute('disabled', 'true');
                    this.$copy.setAttribute('disabled', 'true');
                }
            });
            dg.on('delete', (e2) => {
                if (dialog.showMessageBoxSync({
                    type: 'warning',
                    title: 'Delete',
                    message: 'Delete selected ' + (this.options ? this.options.type + (dg.selectedCount > 1 ? 's' : '') : '') + '?',
                    buttons: ['Yes', 'No'],
                    defaultId: 1,
                    noLink: true
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
                if (this.options.add)
                    this.options.add(e2);
                if (this.options.onAdd)
                    this.options.onAdd(e2);
            });
            header = document.createElement('div');
            header.classList.add('dialog-footer');
            this.$dialog.appendChild(header);
            button = document.createElement('button');
            button.style.cssFloat = 'right';
            button.type = 'button';
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                this.$dialog.close();
                this.$dialog.cleanUp();
            });
            button.textContent = 'Cancel';
            header.appendChild(button);
            button = document.createElement('button');
            button.style.cssFloat = 'right';
            button.type = 'button';
            button.classList.add('btn', 'btn-primary');
            button.addEventListener('click', () => {
                this.value = dg.rows;
                this.$dialog.close();
                this.$dialog.cleanUp();
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
            button.title = 'Add' + (this.options ? ' ' + this.options.type : '');
            button.innerHTML = '<i class="fa fa-plus"></i>';
            el.appendChild(button);
            button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.classList.add('btn', 'btn-default');
            button.addEventListener('click', () => {
                dg.beginEdit(dg.selected[0].row);
            });
            button.title = 'Edit' + (this.options ? ' ' + this.options.type : '');
            button.innerHTML = '<i class="fa fa-edit"></i>';
            this.$edit = button;
            el.appendChild(button);
            button = document.createElement('button');
            button.disabled = true;
            button.type = 'button';
            button.title = 'Delete' + (this.options ? ' ' + this.options.type + '(s)' : '');
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
            document.body.appendChild(this.$dialog);
            this.control.emit('dialog-open');
            this.$dialog.showModal();
        });
        this.$el.appendChild(this.$dButton);
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$editor.focus();
    }
    public destroy() {
        super.destroy();
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
export class SelectValueEditor extends ValueEditor {
    private $el: HTMLSelectElement;

    public create() {
        this.$el = document.createElement('select');
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('property-grid-editor');
        if (this.options && Array.isArray(this.options.data)) {
            const dl = this.options.data.length;
            const values = this.options.data;
            const dField = this.options.display || 'display';
            const vField = this.options.value || 'value';
            let group;
            let elGroup;
            let i;
            for (let d = 0; d < dl; d++) {
                if (typeof values[d] === 'object') {
                    if (this.options.exclude && this.options.exclude.includes(values[d][vField]))
                        continue;
                    if (values[d].group !== group) {
                        group = values[d].group;
                        elGroup = document.createElement('optgroup');
                        elGroup.label = group;
                        this.$el.appendChild(elGroup);
                    }
                    i = document.createElement('option');
                    i.value = values[d][vField];
                    i.textContent = values[d][dField];
                }
                else {
                    if (this.options.exclude && this.options.exclude.includes(values[d]))
                        continue;
                    i = document.createElement('option');
                    i.value = values[d];
                    i.textContent = capitalize(values[d].replace(/_/g, ' ').toLowerCase());
                }
                if (elGroup)
                    elGroup.appendChild(i);
                else
                    this.$el.appendChild(i);
            }
        }
        else if (this.options && typeof this.options.data === 'object') {
            const en = this.options.data;
            const values = Object.keys(en).filter(key => !isNaN(Number(en[key])));
            const dl = values.length;
            for (let d = 0; d < dl; d++) {
                if (this.options.exclude && this.options.exclude.includes(values[d]))
                    continue;
                const i = document.createElement('option');
                i.value = en[values[d]];
                i.textContent = capitalize(values[d].replace(/_/g, ' ').toLowerCase());
                this.$el.appendChild(i);
            }
        }
        this.$el.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                e.preventDefault();
                setTimeout(() => this.control.clearEditor(e, this));
            }
            return;
        });
        this.$el.addEventListener('blur', (e) => {
            setTimeout(() => this.control.clearEditor(e));
        });
        this.$el.addEventListener('change', e => {
            if (this.options && this.options.change)
                this.options.change(this);
        });
        this.parent.appendChild(this.$el);
    }
    public focus() {
        this.$el.focus();
    }
    public destroy() {
        super.destroy();
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
    }

    public scroll() { /**/ }

    public openAdvanced() { /**/ }

    get value() {
        if (this.options && Array.isArray(this.options.data)) {
            if (this.options.data.length > 0 && typeof this.options.data[0][this.options.value || 'value'] === 'number')
                return +this.$el.value;
            return this.$el.value;
        }
        if (this.options && typeof this.options.data === 'object')
            return +this.$el.value;
        return this.$el.value;
    }
    set value(value: any) {
        this.$el.value = value;
    }
}
export class ButtonValueEditor extends ValueEditor {
    private $el: HTMLButtonElement;
    private $val;
    private $clicked;

    public create() {
        this.$el = document.createElement('button');
        this.$el.innerHTML = this.options ? this.options.caption || this.options.label || '&hellip;' : '&hellip;';
        this.$el.title = this.options ? this.options.title || '' : '';
        this.$el.dataset.editor = 'true';
        this.$el.classList.add('btn', 'btn-default', 'btn-xs', 'property-grid-editor-button');
        this.$el.addEventListener('keydown', (e2) => {
            if (e2.keyCode === 27) {
                e2.preventDefault();
                e2.stopPropagation();
                return false;
            }
        });
        this.$el.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                e.stopPropagation();
                e.preventDefault();
                setTimeout(() => this.control.clearEditor(e, this));
                return false;
            }
            else if (e.keyCode === 27) {
                setTimeout(() => this.control.clearEditor(e, null, true));
                e.stopPropagation();
                e.preventDefault();
                return false;
            }
            return;
        });
        this.$el.addEventListener('blur', (e) => {
            if (this.$clicked) {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                this.$clicked = false;
                return;
            }
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
        this.$el.addEventListener('click', (e) => {
            e.stopPropagation();
            e.cancelBubble = true;
            this.$clicked = true;
            if (this.options && this.options.click)
                this.options.click(this);
        });
        this.parent.appendChild(this.$el);
        this.parent.classList.add('property-grid-editor-button-container');
    }
    public focus() {
        this.$el.focus();
    }
    public destroy() {
        super.destroy();
        if (this.$el && this.$el.parentNode && this.$el.parentNode.contains(this.$el))
            this.$el.remove();
        this.parent.classList.remove('property-grid-editor-button-container');
    }

    public scroll() { /**/ }

    public openAdvanced() {
        this.$el.click();
    }

    get value() {
        return this.$val;
    }
    set value(value: any) {
        this.$val = value;
    }
}
