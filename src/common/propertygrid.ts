import EventEmitter = require('events');
import { capitalize, enumToString } from './library';
import { EditorType, TextValueEditor, BooleanValueEditor, NumberValueEditor, FlagValueEditor, DropDownEditValueEditor } from './value.editors';

export interface PropertyGridOptions {
    container?: any;
    parent?: any;
    id?: string;
    object?: any;
}

export enum UpdateType { none = 0, build = 1 }

export class PropertyGrid extends EventEmitter {
    private $el: HTMLElement;
    private $parent: HTMLElement;
    private $id;
    private $object;
    private $options = {};
    private $state = {};
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
            let eProp;
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
        let eProp;
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
        const layout = { Misc: [] };
        let group;
        const props = Object.keys(this.$object);
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
        let value;
        let oldValue;
        const prop = this.$editor.property;
        let eData;
        if (this.$editor.editor) {
            value = this.$editor.editor.value;
            eData = this.$editor.editor.data;
        }
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
        };
        this.$editor = null;
        //do last in case the event changes the property editor
        if (value !== oldValue)
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
                break;
            case EditorType.custom:
                if (this.$options[prop] && this.$options[prop].editor && this.$options[prop].editor.editor)
                    this.$editor.editor = new this.$options[prop].editor.editor(this, el, prop, editorOptions);
                break;
            default:
                switch (typeof (this.$object[prop])) {
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
            this.$editor.editor.data = this.object;
            this.$editor.editor.value = this.$object[prop];
            this.$editor.editor.focus();
        }
        else
            this.$editor = null;
    }

    public beginEdit(property: string, openAdvanced?: boolean) {
        if (!property) return;
        const e = <HTMLElement>this.$el.querySelector('div.property-grid-item-value[data-prop="' + property.toLowerCase() + '"]');
        if (!e) return;
        e.click();
        if (openAdvanced)
            this.$editor.editor.openAdvanced();
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
