import EventEmitter = require('events');
import { capitalize, resetCursor, stringToEnum, enumToString } from './library';

export interface PropertyGridOptions {
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

export enum UpdateType { none = 0, build = 1 }

export class PropertyGrid extends EventEmitter {
    private $el: HTMLElement;
    private $parent: HTMLElement;
    private $id;
    private $object;
    private $options = {};
    private $state = {}
    private $editor;
    private $prevEditor;
    private $editorClick;
    private _updating;
    private $readonly: any = false;

    constructor(options?: PropertyGridOptions) {
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
            this.object = options.object;
        }
        else
            this.parent = document.body;
    }

    get readonly() { return this.$readonly; }
    set readonly(value) {
        if (value !== this.$readonly) {
            this.$readonly = value;
            var eProp;
            if (this.$editorClick)
                eProp = this.$editorClick.dataset.prop;
            this.buildProperties();
            if (eProp && !this.isReadonly(eProp))
                this.createEditor(document.querySelector('[data-prop="' + eProp + '"]'));
        }
    }

    private isReadonly(prop) {
        if (this.$options && this.$options[prop]) {
            if (this.$options[prop].readonly)
                return true;
            if (this.$options[prop].editor && this.$options[prop].editor.type === EditorType.readonly)
                return true;
        }
        if (typeof this.$readonly === 'function')
            return this.$readonly(prop, this.object[prop], this.object);
        return this.$readonly;
    }

    get id() { return this.$id || (this.parent.id + '-property-grid'); }
    set id(value) {
        if (value === this.$id) return;
        this.$id = value;
        this.$el.id = this.id;
    }

    get object() { return this.$object; }
    set object(value) {
        if (value === this.$object) return;
        var eProp;
        if (this.$editorClick)
            eProp = this.$editorClick.dataset.prop;
        this.clearEditor();
        if (this.$object)
            delete this.$object['$propertyGrid'];
        this.$object = value;
        this.$object['$propertyGrid'] = true;
        this.buildProperties();
        if (eProp)
            this.createEditor(document.querySelector('[data-prop="' + eProp + '"]'));
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

    public setPropertyOptions(prop: any, ops?) {
        if (Array.isArray(prop)) {
            var l = prop.length;
            while (l--) {
                this.$options[prop[l].property || prop[l].field] = prop[l];
            }
        }
        else if (typeof prop === 'object')
            this.$options[prop.property || prop.field] = prop;
        else if (!ops)
            delete this.$options[prop];
        else
            this.$options[prop] = ops;
        this.doUpdate(UpdateType.build);
    }

    public getPropertyOptions(prop, ops?) {
        if (!prop || !this.$options) return null;
        if (ops) {
            if (!this.$options[prop]) return null;
            return this.$options[prop][ops];
        }
        return this.$options[prop];
    }

    public propertyEditor(prop, ops) {
        this.$options[prop] = ops;
        if (this.$editor && this.$editor.property === prop)
            this.createEditor(this.$editor.el);
    }

    private createControl() {
        this.$el = document.createElement('ul');
        this.$el.id = this.id;
        this.$el.classList.add('property-grid');
        this.$parent.appendChild(this.$el);
        window.addEventListener('beforeunload', () => {
            this.clearEditor();
        });
    }

    private editorType(prop) {
        if (!prop || !this.$options[prop] || !this.$options[prop].editor)
            return EditorType.default;
        if (this.$options[prop].editor)
            return this.$options[prop].editor.type || EditorType.default;
        return EditorType.default;
    }

    private formatedValue(prop) {
        if (!prop || !this.$object)
            return null;
        if (!this.$options[prop])
            return this.$object[prop];
        if (this.$options[prop].formatter)
            return this.$options[prop].formatter(prop, this.$object[prop], this.$object);
        if (this.$options[prop].editor && this.$options[prop].editor.options && this.$options[prop].editor.type === EditorType.flag)
            return enumToString(this.$object[prop], this.$options[prop].editor.options.enum);
        return this.$object[prop];
    }

    private buildProperties() {
        this.clearEditor();
        this.$editorClick = null;
        this.$prevEditor = null;
        while (this.$el.firstChild)
            this.$el.removeChild(this.$el.firstChild);
        if (!this.$object) return;
        var layout = { 'Misc': [] };
        var group;
        var props = Object.keys(this.$object);
        props.splice(props.indexOf('$propertyGrid', 1));
        props.sort((a, b) => {
            var sA = 0, sB = 0
            if (this.$options[a])
                sA = this.$options[a].sort || 0;
            if (this.$options[b])
                sB = this.$options[b].sort || 0;
            if (sA > sB)
                return -1;
            if (sA < sB)
                return 1;
            return a.localeCompare(b) * -1;
        });
        var pl = props.length;
        while (pl--) {
            if (this.$options[props[pl]]) {
                if (this.$options[props[pl]].hasOwnProperty('visible') && !this.$options[props[pl]].visible)
                    continue;
                group = this.$options[props[pl]].group || 'Misc';
                if (!layout[group])
                    layout[group] = [];
                layout[group].push({
                    name: this.$options[props[pl]].label || props[pl],
                    value: this.formatedValue(props[pl]),
                    property: props[pl],
                    readonly: this.isReadonly(props[pl])
                });
            }
            else {
                layout['Misc'].push({
                    name: props[pl],
                    value: this.$object[props[pl]],
                    property: props[pl],
                    readonly: this.isReadonly(props[pl])
                });
            }
        }
        var frag = document.createDocumentFragment();
        var groups = Object.keys(layout).sort().reverse();
        var g = groups.length;
        while (g--) {
            group = groups[g];
            if (!layout[group].length) continue;
            var el = document.createElement('li');
            el.classList.add('property-grid-group');
            var lbl = document.createElement('i')
            lbl.dataset.group = group;
            if (this.$state[group])
                lbl.classList.add('property-grid-collapse', 'fa', 'fa-chevron-right');
            else
                lbl.classList.add('property-grid-collapse', 'fa', 'fa-chevron-down');
            lbl.addEventListener('click', (e) => {
                var el = (<HTMLElement>(<HTMLElement>e.currentTarget).parentElement.children[2]);
                var c = (<HTMLElement>e.currentTarget);
                if (el.style.display == 'none') {
                    el.style.display = '';
                    c.classList.remove('fa-chevron-right');
                    c.classList.add('fa-chevron-down');
                    this.$state[c.dataset.group] = false;
                }
                else {
                    el.style.display = 'none';
                    c.classList.add('fa-chevron-right');
                    c.classList.remove('fa-chevron-down');
                    this.$state[c.dataset.group] = true;
                }
            })
            el.appendChild(lbl);
            lbl = document.createElement('div');
            lbl.classList.add('property-grid-group-label')
            lbl.textContent = capitalize(group);
            el.appendChild(lbl);
            let children = document.createElement('ul');
            children.classList.add('property-grid-group-items');
            if (this.$state[group])
                children.style.display = 'none';
            el.appendChild(children);
            frag.appendChild(el);
            var c = 0;
            var cl = layout[group].length;
            for (; c < cl; c++) {
                el = document.createElement('li');
                el.classList.add('property-grid-item');
                lbl = document.createElement('div');
                lbl.classList.add('property-grid-item-label');
                lbl.textContent = capitalize(layout[group][c].name);
                lbl.title = capitalize(layout[group][c].name);
                el.appendChild(lbl);
                lbl = document.createElement('div');
                lbl.classList.add('property-grid-item-value');
                if (layout[group][c].readonly)
                    lbl.classList.add('readonly');
                if (typeof layout[group][c].value === 'boolean')
                    lbl.title = capitalize('' + layout[group][c].value);
                else
                    lbl.title = layout[group][c].value;
                lbl.dataset.prop = layout[group][c].property;
                lbl.dataset.readonly = layout[group][c].readonly;
                lbl.addEventListener('mousedown', (e) => {
                    this.$editorClick = e.currentTarget;
                    if (this.$editor && this.$editor.editor)
                        this.$editor.editor.editorClick = this.$editorClick;
                });
                lbl.addEventListener('mouseup', (e) => {
                    this.$editorClick = null;
                    if (this.$editor && this.$editor.editor)
                        this.$editor.editor.editorClick = null;
                });
                lbl.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.cancelBubble = true;
                    if (this.$prevEditor && this.$prevEditor.el === e.currentTarget && this.$prevEditor.type === EditorType.flag) {
                        this.$prevEditor = null;
                        return;
                    }
                    else if ((<HTMLElement>e.currentTarget).dataset.readonly === 'true')
                        this.clearEditor();
                    else
                        this.createEditor(<HTMLElement>e.currentTarget);
                });
                lbl.textContent = lbl.title;
                el.appendChild(lbl);
                children.appendChild(el);
            }
        }
        this.$el.appendChild(frag);
    }

    public clearEditor() {
        if (!this.$editor) return;
        var value;
        var oldValue;
        var prop = this.$editor.property;
        if (this.$editor.editor)
            value = this.$editor.editor.value;
        oldValue = this.$object[this.$editor.property];
        if (value !== oldValue) {
            this.$object[prop] = value;
            this.$editor.el.textContent = this.formatedValue(this.$editor.property);
        }
        if (this.$editor.editor)
            this.$editor.editor.destroy();
        this.$prevEditor = {
            el: this.$editor.el,
            property: this.$editor.property,
            type: this.$editor.type
        }
        this.$editor = null;
        //do last in case the event changes the property editor
        if (value !== oldValue)
            this.emit('value-changed', prop, value, oldValue);
    }

    public createEditor(el: HTMLElement) {
        if (!el) return;
        var prop = el.dataset.prop;
        if (!prop) return;
        if (this.$editor) {
            if (this.$editor.property === prop)
                return;
            this.clearEditor();
        }
        this.$editor = {
            el: el,
            editor: null,
            property: prop,
            type: EditorType.default,
        }
        var type = this.editorType(prop);
        var editorOptions;
        if (this.$options[prop] && this.$options[prop].editor) {
            editorOptions = this.$options[prop].editor.options;
            if (this.$options[prop].editor.hasOwnProperty('show')) {
                if (typeof this.$options[prop].editor.show === 'function') {
                    if (!this.$options[prop].editor.show(prop, this.$object[prop], this.$object)) {
                        this.$editor = null;
                        return;
                    }
                }
                else if (!this.$options[prop].editor.show) {
                    this.$editor = null;
                    return;
                }

            }
        }
        this.$editor.type = type;
        var values;
        var vl;
        switch (type) {
            case EditorType.flag:
                this.$editor.editor = new FlagValueEditor(this, el, prop, editorOptions);
                this.$editor.editor.value = this.$object[prop];
                break;
            case EditorType.number:
                this.$editor.editor = new NumberValueEditor(this, el, prop, editorOptions);
                this.$editor.editor.value = this.$object[prop];
                break;
            case EditorType.select:
                break;
            case EditorType.custom:
                if (this.$options[prop] && this.$options[prop].editor && this.$options[prop].editor.editor) {
                    this.$editor.editor = new this.$options[prop].editor.editor(this, el, prop, editorOptions);
                    this.$editor.editor.value = this.$object[prop];
                }
                break;
            default:
                switch (typeof (this.$object[prop])) {
                    case 'boolean':
                        this.$editor.editor = new BooleanValueEditor(this, el, prop, editorOptions);
                        this.$editor.editor.value = this.$object[prop];
                        break;
                    case 'number':
                        this.$editor.editor = new NumberValueEditor(this, el, prop, editorOptions);
                        this.$editor.editor.value = this.$object[prop];
                        break;
                    default:
                        this.$editor.editor = new TextValueEditor(this, el, prop, editorOptions);
                        this.$editor.editor.value = this.$object[prop];
                        break;
                }
                break;
        }
        if (this.$editor.editor)
            this.$editor.editor.focus();
        else
            this.$editor = null;
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
            if ((this._updating & UpdateType.build) === UpdateType.build) {
                this.buildProperties();
                this._updating &= ~UpdateType.build;
            }
            this.doUpdate(this._updating);
        });
    }

}

export abstract class ValueEditor extends EventEmitter {
    private $parent: HTMLElement;
    private $options: any;
    private $grid: PropertyGrid;
    public editorClick: any;
    public property;

    constructor(grid, parent, property?, options?) {
        super();
        this.parent = parent;
        this.propertyOptions = options;
        this.grid = grid;
        this.property = property
    }

    set grid(ops) {
        this.$grid = ops;
    }
    get grid() { return this.$grid; }

    set propertyOptions(ops) {
        this.$options = ops;
    }
    get propertyOptions() { return this.$options; }

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

}

class TextValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $dropdown: HTMLTextAreaElement;
    private $editor: HTMLTextAreaElement;
    private $noEnter = false;

    create() {
        this.$el = document.createElement('div');
        this.$el.classList.add('property-grid-editor-dropdown');
        var el = document.createElement('div');
        el.classList.add('property-grid-editor-dropdown-container');
        this.$el.appendChild(el);
        this.$editor = document.createElement('textarea');
        this.$editor.classList.add('property-grid-editor');
        if (this.$noEnter) {
            this.$editor.classList.add('single');
            this.$editor.addEventListener('paste', () => {
                var sel = {
                    start: this.$editor.selectionStart,
                    end: this.$editor.selectionEnd
                }
                var initialLength = this.$editor.value.length;
                window.setTimeout(() => {
                    this.$editor.value = this.$editor.value.replace(/(?:\r\n|\r|\n)/g, '');
                });
            });
        }
        this.$editor.addEventListener('blur', (e) => {
            if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'dropdown') {
                e.preventDefault();
                e.stopPropagation();
                e.cancelBubble = true;
                return;
            }
            this.grid.clearEditor();
        });
        this.$editor.addEventListener('click', (e) => {
            this.$editor.dataset.aOpen = null;
        });
        this.$editor.addEventListener('keyup', (e) => {
            if (this.$noEnter && e.keyCode === 13) {
                e.preventDefault();
                this.$editor.blur();
            }
            else if (e.keyCode === 27 || (e.keyCode === 13 && e.ctrlKey))
                this.$editor.blur();
            return;
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
            this.$dropdown.style.height = '100%';
            this.$dropdown.style.whiteSpace = 'nowrap';
            this.$dropdown.value = this.value;
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
            var b = this.parent.getBoundingClientRect();
            if (b.width < 300) {
                this.$dropdown.style.left = (b.left - 300 + b.width) + 'px';
                this.$dropdown.style.width = '300px';
            }
            else {
                this.$dropdown.style.left = b.left + 'px';
                this.$dropdown.style.width = (b.width) + 'px';
            }
            this.$dropdown.style.top = (b.bottom) + 'px';
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
                    this.grid.createEditor(ec);
                else {
                    this.focus();
                }
            }, { once: true });
            document.body.appendChild(this.$dropdown);
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

    set propertyOptions(ops) {
        super.propertyOptions = ops;
        if (ops)
            this.$noEnter = ops.singleLine || ops.noReturn;
    }
    get propertyOptions() { return super.propertyOptions; }

    get value() {
        return this.$editor.value;
    }
    set value(value: any) {
        this.$editor.value = value;
    }
}

class BooleanValueEditor extends ValueEditor {
    private $el: HTMLSelectElement;

    create() {
        this.$el = document.createElement('select');
        this.$el.classList.add('property-grid-editor');
        this.$el.innerHTML = '<option value="true">True</option><option value="false">False</option>';
        this.$el.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                e.preventDefault();
                this.$el.blur();
            }
            return;
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

class NumberValueEditor extends ValueEditor {
    private $el: HTMLInputElement;

    create() {
        this.$el = document.createElement('input');
        this.$el.classList.add('property-grid-editor');
        this.$el.type = 'number';
        this.$el.max = this.propertyOptions ? (this.propertyOptions.max || 1000) : 1000;
        this.$el.min = this.propertyOptions ? (this.propertyOptions.min || 0) : 0;
        this.$el.addEventListener('keyup', (e) => {
            if (e.keyCode === 27)
                this.$el.blur();
            return;
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

class FlagValueEditor extends ValueEditor {
    private $el: HTMLElement;
    private $dropdown: HTMLElement;
    private $editor: HTMLInputElement;
    private $value;

    create() {
        this.$el = document.createElement('div');
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
            this.grid.clearEditor();
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
            this.$dropdown.tabIndex = -1;
            this.$dropdown.classList.add('property-grid-editor-flag-dropdown');
            this.$dropdown.addEventListener('keyup', (e) => {
                if (e.keyCode === 27) {
                    this.focus();
                    this.$editor.dataset.aOpen = null;
                }
                return;
            });
            var b = this.parent.getBoundingClientRect();
            if (b.width < 150) {
                this.$dropdown.style.left = (b.left - 150 + b.width) + 'px';
                this.$dropdown.style.width = '300px';
            }
            else {
                this.$dropdown.style.left = b.left + 'px';
                this.$dropdown.style.width = (b.width) + 'px';
            }
            this.$dropdown.style.top = (b.bottom) + 'px';
            this.$dropdown.style.zIndex = '100';
            this.$dropdown.style.position = 'absolute';
            this.$dropdown.addEventListener('blur', this.$dropdownEvent, { once: true });
            var height = 154;
            if (this.propertyOptions && this.propertyOptions.enum) {
                var en = this.propertyOptions.enum;
                var values = Object.keys(en).filter(key => !isNaN(Number(en[key])));
                var vl = values.length;
                var height = vl * 22;
                while (vl--) {
                    if (this.propertyOptions.exclude && this.propertyOptions.exclude.includes(values[vl]))
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
            document.body.appendChild(this.$dropdown);
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
            this.grid.createEditor(ec);
        else {
            this.focus();
        }
    }

    get value() {
        if (!this.propertyOptions) return 0;
        return this.$value = stringToEnum(this.$editor.value, this.propertyOptions.enum, true);
    }
    set value(value: any) {
        if (!this.propertyOptions.enum) return;
        this.$value = value;
        this.$editor.value = enumToString(value, this.propertyOptions.enum);
    }
}

