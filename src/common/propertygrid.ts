//spellchecker:ignore dropdown
import EventEmitter = require('events');
import { capitalize, enumToString } from './library';
import { EditorType, TextValueEditor, BooleanValueEditor, NumberValueEditor, FlagValueEditor, DropDownEditValueEditor, CollectionValueEditor, SelectValueEditor, ButtonValueEditor } from './value.editors';

export interface PropertyGridOptions {
    container?: any;
    parent?: any;
    id?: string;
    object?: any;
    objects?: any;
}

export enum UpdateType { none = 0, build = 1 }

export class PropertyGrid extends EventEmitter {
    private $el: HTMLElement;
    private $parent: HTMLElement;
    private $id;
    private $objects = [];
    private $options = {};
    private $state = {};
    private $editor;
    private $prevEditor;
    private $editorClick;
    private _updating;
    private $readonly: any = false;

    public defaults;
    public hideUnSetProperties = false;

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
            if (options.objects)
                this.objects = options.objects;
            else
                this.object = options.object;
        }
        else
            this.parent = document.body;
    }

    get readonly() { return this.$readonly; }
    set readonly(value) {
        if (value !== this.$readonly) {
            this.$readonly = value;
            let eProp;
            if (this.$editorClick)
                eProp = this.$editorClick.dataset.prop;
            this.buildProperties();
            if (eProp && !this.isReadonly(eProp))
                this.createEditor(this.$el.querySelector('[data-prop="' + eProp + '"]'));
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
            return this.$readonly(prop, this.getValue(prop), this.$objects.length !== 0 ? this.$objects : null);
        return this.$readonly;
    }

    get id() { return this.$id || (this.parent.id + '-property-grid'); }
    set id(value) {
        if (value === this.$id) return;
        this.$id = value;
        this.$el.id = this.id;
    }

    get object() {
        if (this.$objects.length === 0) return null;
        return this.$objects[0];
    }
    set object(value) {
        this.objects = value;
    }

    get objects() { return this.$objects; }
    set objects(value) {
        if (!Array.isArray(value))
            value = [value];
        value = value.filter(v => v);
        if (value === this.$objects) return;
        let eProp;
        if (this.$editorClick)
            eProp = this.$editorClick.dataset.prop;
        this.clearEditor();
        if (this.$objects.length)
            this.$objects.forEach(o => delete o['$propertyGrid']);
        this.$objects = value;
        this.$objects.forEach(o => o['$propertyGrid'] = true);
        this.buildProperties();
        if (eProp) {
            const el = <HTMLElement>this.$el.querySelector('[data-prop="' + eProp + '"]');
            if (!el) return;
            if (el.dataset.readonly !== 'true')
                this.createEditor(el);
        }
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

    public refresh() {
        this.doUpdate(UpdateType.build);
    }

    public getValue(prop) {
        if (this.$objects.length === 0)
            return null;
        return this.$objects[0][prop];
    }
    public setValue(prop, value) {
        if (this.$objects.length === 0) return;
        this.$objects.forEach(o => o[prop] = value);
    }

    public setPropertyOptions(prop: any, ops?) {
        if (Array.isArray(prop)) {
            let l = prop.length;
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

    public get properties() {
        return Object.keys(this.$options);
    }

    private createControl() {
        this.$el = document.createElement('ul');
        this.$el.id = this.id;
        this.$el.classList.add('property-grid');
        this.$el.addEventListener('scroll', (e) => {
            if (this.$editor && this.$editor.editor)
                this.$editor.editor.scroll();
        });
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

    private defaultValue(prop) {
        if (!prop || !this.$options[prop])
            return null;
        if (this.defaults)
            return this.$options[prop].default || this.defaults[prop];
        return this.$options[prop].default;
    }

    private formattedValue(prop) {
        if (!prop || this.$objects.length === 0)
            return null;
        if (!this.$options[prop])
            return this.getValue(prop);
        if (this.$options[prop].formatter)
            return this.$options[prop].formatter(prop, this.getValue(prop), this.$objects.length !== 0 ? this.$objects : null);
        if (this.$options[prop].editor && this.$options[prop].editor.options && this.$options[prop].editor.type === EditorType.flag)
            return enumToString(this.getValue(prop), this.$options[prop].editor.options.enum);
        return this.getValue(prop);
    }

    private defaultFormattedValue(prop) {
        if (!prop)
            return null;
        if (!this.$options[prop])
            return this.defaultValue(prop);
        if (this.$options[prop].formatter)
            return this.$options[prop].formatter(prop, this.defaultValue(prop), this.$objects.length !== 0 ? this.$objects : null, 1);
        if (this.$options[prop].editor && this.$options[prop].editor.options && this.$options[prop].editor.type === EditorType.flag)
            return enumToString(this.defaultValue(prop), this.$options[prop].editor.options.enum);
        return this.defaultValue(prop);
    }

    private sameValue(prop) {
        const obs = this.$objects;
        const obj = this.$objects[0];
        return obs.filter(o => o[prop] === obj[prop]).length === obs.length;
    }

    private buildProperties() {
        this.clearEditor();
        this.$editorClick = null;
        this.$prevEditor = null;
        while (this.$el.firstChild)
            this.$el.removeChild(this.$el.firstChild);
        if (this.$objects.length === 0) return;
        const layout = { Misc: [] };
        let group;
        const obj = this.$objects[0];
        const props = Object.keys(obj);
        props.splice(props.indexOf('$propertyGrid', 1));
        props.sort((a, b) => {
            let sA = 0;
            let sB = 0;
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
        let pl = props.length;
        const obs = this.$objects;
        while (pl--) {
            const prop = props[pl];
            const same = obs.filter(o => o[prop] === obj[prop]).length === obs.length;
            if (this.$options[prop]) {
                if (Object.prototype.hasOwnProperty.call(this.$options[prop], 'visible') && !this.$options[prop].visible)
                    continue;
                group = this.$options[prop].group || 'Misc';
                if (!layout[group])
                    layout[group] = [];
                layout[group].push({
                    name: this.$options[prop].label || prop,
                    value: same ? this.formattedValue(prop) : '',
                    property: prop,
                    readonly: this.isReadonly(prop),
                    align: this.$options[prop].align
                });
            }
            else if (!this.hideUnSetProperties) {
                layout['Misc'].push({
                    name: prop,
                    value: same ? obj[prop] : '',
                    property: prop,
                    readonly: this.isReadonly(prop)
                });
            }
        }
        const frag = document.createDocumentFragment();
        const groups = Object.keys(layout).sort().reverse();
        let g = groups.length;
        while (g--) {
            group = groups[g];
            if (!layout[group].length) continue;
            let el = document.createElement('li');
            el.classList.add('property-grid-group');
            let lbl = document.createElement('i');
            lbl.dataset.group = group;
            if (this.$state[group])
                lbl.classList.add('property-grid-collapse', 'fa', 'fa-chevron-right');
            else
                lbl.classList.add('property-grid-collapse', 'fa', 'fa-chevron-down');
            lbl.addEventListener('click', (e) => {
                const el2 = (<HTMLElement>(<HTMLElement>e.currentTarget).parentElement.children[2]);
                const c2 = (<HTMLElement>e.currentTarget);
                if (el2.style.display === 'none') {
                    el2.style.display = '';
                    c2.classList.remove('fa-chevron-right');
                    c2.classList.add('fa-chevron-down');
                    this.$state[c2.dataset.group] = false;
                }
                else {
                    el2.style.display = 'none';
                    c2.classList.add('fa-chevron-right');
                    c2.classList.remove('fa-chevron-down');
                    this.$state[c2.dataset.group] = true;
                }
            });
            el.appendChild(lbl);
            lbl = document.createElement('div');
            lbl.classList.add('property-grid-group-label');
            lbl.textContent = capitalize(group);
            el.appendChild(lbl);
            const children = document.createElement('ul');
            children.classList.add('property-grid-group-items');
            if (this.$state[group])
                children.style.display = 'none';
            el.appendChild(children);
            frag.appendChild(el);
            let c = 0;
            const cl = layout[group].length;
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
                if (layout[group][c].align && layout[group][c].align.length !== 0)
                    lbl.style.textAlign = layout[group][c].align;
                if (layout[group][c].readonly)
                    lbl.classList.add('readonly');
                if (layout[group][c].value === this.defaultFormattedValue(layout[group][c].property))
                    lbl.classList.add('default');
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

    public updateValue() {
        if (!this.$editor) return;
        let value;
        let oldValue;
        const prop = this.$editor.property;
        if (this.$editor.editor)
            value = this.$editor.editor.value;
        oldValue = this.$objects[0][this.$editor.property];
        if (value !== oldValue || !this.sameValue(prop)) {
            this.$objects.forEach(o => o[prop] = value);
            this.$editor.el.textContent = this.formattedValue(this.$editor.property);
        }
        if (value === this.defaultFormattedValue(prop))
            this.$editor.el.classList.add('default');
        else
            this.$editor.el.classList.remove('default');
        if (value !== oldValue)
            this.emit('value-changed', prop, value, oldValue);
    }

    public clearEditor(evt?, next?, canceled?) {
        if (!this.$editor) return;
        let value;
        let oldValue;
        const prop = this.$editor.property;
        if (this.$editor.editor)
            value = this.$editor.editor.value;
        oldValue = this.$objects[0][this.$editor.property];
        if (!canceled && (value !== oldValue || !this.sameValue(prop))) {
            this.$objects.forEach(o => o[prop] = value);
            this.$editor.el.textContent = this.formattedValue(this.$editor.property);
        }
        if (this.$editor.editor)
            this.$editor.editor.destroy();
        this.$prevEditor = {
            el: this.$editor.el,
            property: this.$editor.property,
            type: this.$editor.type
        };
        if (value === this.defaultFormattedValue(prop))
            this.$editor.el.classList.add('default');
        else
            this.$editor.el.classList.remove('default');
        this.$editor = null;
        //do last in case the event changes the property editor
        if (!canceled && value !== oldValue)
            this.emit('value-changed', prop, value, oldValue);
    }

    public createEditor(el: HTMLElement) {
        if (!el) return;
        const prop = el.dataset.prop;
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
            type: EditorType.default
        };
        const type = this.editorType(prop);
        let editorOptions;
        if (this.$options[prop] && this.$options[prop].editor) {
            editorOptions = this.$options[prop].editor.options;
            if (Object.prototype.hasOwnProperty.call(this.$options[prop].editor, 'show')) {
                if (typeof this.$options[prop].editor.show === 'function') {
                    if (!this.$options[prop].editor.show(prop, this.$objects[0][prop], this.$objects)) {
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
        switch (type) {
            case EditorType.flag:
                this.$editor.editor = new FlagValueEditor(this, el, prop, editorOptions);
                break;
            case EditorType.number:
                this.$editor.editor = new NumberValueEditor(this, el, prop, editorOptions);
                break;
            case EditorType.dropdown:
                this.$editor.editor = new DropDownEditValueEditor(this, el, prop, editorOptions);
                break;
            case EditorType.select:
                this.$editor.editor = new SelectValueEditor(this, el, prop, editorOptions);
                break;
            case EditorType.collection:
                this.$editor.editor = new CollectionValueEditor(this, el, prop, editorOptions);
                break;
            case EditorType.button:
                this.$editor.editor = new ButtonValueEditor(this, el, prop, editorOptions);
                break;
            case EditorType.custom:
                if (this.$options[prop] && this.$options[prop].editor && this.$options[prop].editor.editor)
                    this.$editor.editor = new this.$options[prop].editor.editor(this, el, prop, editorOptions);
                break;
            default:
                switch (typeof (this.$objects[0][prop])) {
                    case 'boolean':
                        this.$editor.editor = new BooleanValueEditor(this, el, prop, editorOptions);
                        break;
                    case 'number':
                        this.$editor.editor = new NumberValueEditor(this, el, prop, editorOptions);
                        break;
                    default:
                        this.$editor.editor = new TextValueEditor(this, el, prop, editorOptions);
                        break;
                }
                break;
        }
        if (this.$editor.editor) {
            this.$editor.editor.data = this.$objects[0];
            this.$editor.editor.value = this.sameValue(prop) ? this.$objects[0][prop] : null;
            this.$editor.editor.focus();
            if (editorOptions && editorOptions.open)
                this.$editor.editor.openAdvanced();
        }
        else
            this.$editor = null;
    }

    public beginEdit(property: string, openAdvanced?: boolean) {
        if (!property) return;
        const e = <HTMLElement>this.$el.querySelector('div.property-grid-item-value[data-prop="' + property.toLowerCase() + '"]');
        if (!e) return;
        e.focus();
        e.click();
        if (openAdvanced) {
            this.$editor.editor.focus();
            this.$editor.editor.openAdvanced();
        }
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
