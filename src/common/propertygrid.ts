import EventEmitter = require('events');
import { capitalize } from './library';
import { createDeflate } from 'zlib';

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
        if(this.$editorClick)
            eProp = this.$editorClick.dataset.prop;
        this.clearEditor();
        if(this.$object)
            delete this.$object['$propertyGrid'];
        this.$object = value;
        this.$object['$propertyGrid'] = true;
        this.buildProperties();
        if(eProp)
            this.createEditor(document.querySelector('[data-prop="'+eProp+'"]'));
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

    public propertyOptions(prop: any, ops?) {
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
        if (typeof this.$options[prop].editor === 'object')
            return this.$options[prop].editor.type || EditorType.default;
        return this.$options[prop].editor;
    }

    private editorValue(prop) {
        if (!prop || !this.$options[prop] || !this.$options[prop].editor)
            return undefined;
        if (typeof this.$options[prop].editor === 'object')
            return this.$options[prop].editor.value;
        return undefined;
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
        for (var prop in this.$object) {
            if (!this.$object.hasOwnProperty(prop) || prop === '$propertyGrid') continue;
            if (this.$options[prop]) {
                if (this.$options[prop].hasOwnProperty('visible') && !this.$options[prop].visible)
                    continue;
                group = this.$options[prop].group || 'Misc';
                if (!layout[group])
                    layout[group] = [];
                layout[group].push({
                    name: this.$options[prop].label || prop,
                    value: this.$options[prop].formatter ? this.$options[prop].formatter(prop, this.$object[prop], this.$object) : this.$object[prop],
                    property: prop,
                    readonly: this.$options[prop].readonly || (this.$options[prop].editor ? this.$options[prop].editor.type === EditorType.readonly : false)
                });
            }
            else {
                layout['Misc'].push({
                    name: prop,
                    value: this.$object[prop],
                    property: prop,
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
                lbl.title = layout[group][c].value;
                lbl.dataset.prop = layout[group][c].property;
                lbl.dataset.readonly = layout[group][c].readonly;
                lbl.addEventListener('mousedown', (e) => {
                    this.$editorClick = e.currentTarget;
                });
                lbl.addEventListener('mouseup', (e) => {
                    this.$editorClick = null;
                });
                lbl.addEventListener('click', (e) => {
                    console.log(e.currentTarget);
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
                lbl.textContent = layout[group][c].value;
                el.appendChild(lbl);
                children.appendChild(el);
            }
        }
        this.$el.appendChild(frag);
    }

    private clearEditor() {
        if (!this.$editor) return;
        var value;
        var oldValue;
        var prop = this.$editor.property;
        if (this.$editor.type === EditorType.check)
            value = this.$editor.editor.checked;
        else if (this.$editor.type === EditorType.number) {
            value = +this.$editor.editor.value;
            if (value < this.$editor.min)
                value = this.$editor.min;
            if (value > this.$editor.max)
                value = this.$editor.max;
        }
        else if (this.$editor.type === EditorType.flag) {
            var cl = this.$editor.dropdown.children.length;
            value = 0;
            while (cl--) {
                if (this.$editor.checks[cl].checked)
                    value |= +this.$editor.checks[cl].value;
            }
        }
        else
            value = this.$editor.editor.value;
        oldValue = this.$object[this.$editor.property];
        if (value !== oldValue) {
            if (this.$options[this.$editor.property] && this.$options[this.$editor.property].formatter)
                this.$editor.el.textContent = this.$options[this.$editor.property].formatter(this.$editor.property, value, this.$object)
            else
                this.$editor.el.textContent = value;
            this.$object[prop] = value;
        }
        if (this.$editor.type === EditorType.flag) {
            this.$editor.clear();
        }
        if (this.$editor.editor && this.$editor.parentElement === this.$editor.el)
            this.$editor.el.removeChild(this.$editor.editor);
        else if (this.$editor.editor && this.$editor.editor.parentElement)
            this.$editor.editor.parentElement.removeChild(this.$editor.editor);
        this.$prevEditor = {
            el: this.$editor.el,
            property: this.$editor.property,
            type: this.$editor.type
        }
        this.$editor = null;
        //do last in case the event changes the property editor
        if(value !== oldValue)
            this.emit('value-changed', prop, value, oldValue);
    }

    private createEditor(el: HTMLElement) {
        if(!el) return;
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
        var value = this.editorValue(prop);
        var max = 1000;
        var min = 0;
        if (this.$options[prop]) {
            max = this.$options[prop].max || 1000;
            min = this.$options[prop].min || 0;
        }
        this.$editor.min = min;
        this.$editor.max = max;
        this.$editor.type = type;
        var values;
        var vl;
        switch (type) {
            case EditorType.flag:
                this.$editor.el.style.border = '1px solid #f2cb7f';
                this.$editor.el.style.top = '-1px';
                this.$editor.el.style.paddingRight = '18px';
                this.$editor.el.style.paddingLeft = '1px';
                this.$editor.editor = document.createElement('button');
                this.$editor.editor.innerHTML = '<span class="caret"></span>';
                this.$editor.editor.classList.add('flag-editor');
                this.$editor.editor.addEventListener('click', (e) => {
                    this.clearEditor();
                    this.$prevEditor = null;
                    e.preventDefault();
                    e.stopPropagation();
                    e.cancelBubble = true;
                });
                this.$editor.dropdown = document.createElement('div');
                this.$editor.dropdown.classList.add('flag-editor-dropdown');
                this.$editor.dropdown.tabIndex = 1;
                this.$editor.checks = [];
                values = Object.keys(value).filter(key => !isNaN(Number(value[key])));
                vl = values.length;
                while (vl--) {
                    var l = document.createElement('label');
                    var i = document.createElement('input');
                    i.type = 'checkbox';
                    i.value = value[values[vl]];
                    i.addEventListener('change', (e) => {
                        var cl = this.$editor.checks.length;
                        if ((<HTMLInputElement>e.currentTarget).value === '0') {
                            while (cl--) {
                                if (this.$editor.checks[cl].value !== '0')
                                    this.$editor.checks[cl].checked = false;
                            }
                        }
                        else {
                            while (cl--) {
                                if (this.$editor.checks[cl].value === '0') {
                                    this.$editor.checks[cl].checked = false;
                                    break;
                                }
                            }
                        }
                    });
                    l.appendChild(i);
                    l.appendChild(document.createTextNode(values[vl]));
                    if (this.$object[prop] !== 0 && value[values[vl]] === 0)
                        i.checked = false;
                    else
                        i.checked = (this.$object[prop] & value[values[vl]]) === value[values[vl]];
                    this.$editor.dropdown.appendChild(l);
                    this.$editor.checks.push(i);
                }

                document.body.appendChild(this.$editor.dropdown);
                this.$editor.clear = () => {
                    document.body.removeChild(this.$editor.dropdown);
                    this.$editor.el.style.border = '';
                    this.$editor.el.style.right = '';
                    this.$editor.el.style.top = '';
                    this.$editor.el.style.paddingRight = '';
                    this.$editor.el.style.paddingLeft = '';
                };
                this.$editor.dropdown.addEventListener('blur', (e) => {
                    if (e.relatedTarget && e.relatedTarget.parentElement && e.relatedTarget.parentElement.parentElement == e.currentTarget) {
                        this.$editor.dropdown.focus();
                        return;
                    }
                    var el = this.$editor.el;
                    this.clearEditor();
                    if (this.$editorClick !== el)
                        this.$prevEditor = null;
                });
                var b = this.$editor.el.getBoundingClientRect();
                if (b.width < 150) {
                    this.$editor.dropdown.style.left = (b.left - 150 + b.width) + 'px';
                    this.$editor.dropdown.style.width = '150px';
                }
                else {
                    this.$editor.dropdown.style.left = b.left + 'px';
                    this.$editor.dropdown.style.width = (b.width) + 'px';
                }
                this.$editor.dropdown.style.top = (b.bottom) + 'px';
                this.$editor.dropdown.style.height = '200px';
                this.$editor.dropdown.focus();
                break;
            case EditorType.number:
                this.$editor.editor = document.createElement('input');
                this.$editor.editor.classList.add('property-grid-editor');
                this.$editor.editor.type = 'number';
                this.$editor.editor.value = this.$object[prop];
                break;
            case EditorType.select:
                break;
            default:
                this.$editor.editor = document.createElement('input');
                this.$editor.editor.classList.add('property-grid-editor');
                switch (typeof (this.$object[prop])) {
                    case 'boolean':
                        this.$editor.editor.type = 'checkbox';
                        if (this.$object[prop])
                            this.$editor.editor.checked = true;
                        this.$editor.type = EditorType.check;
                        break;
                    case 'number':
                        this.$editor.editor.type = 'number';
                        this.$editor.editor.value = this.$object[prop];
                        this.$editor.editor.max = max;
                        this.$editor.editor.min = min;
                        this.$editor.type = EditorType.number;
                        break;
                    default:
                        this.$editor.editor.type = 'text';
                        this.$editor.editor.value = this.$object[prop];
                        break;
                }
                break;
        }
        if (this.$editor.editor) {
            if (this.$editor.type !== EditorType.custom && this.$editor.type !== EditorType.flag) {
                this.$editor.editor.addEventListener('blur', (e) => {
                    this.clearEditor();
                });
                el.appendChild(this.$editor.editor);
                this.$editor.editor.focus();
            }
            else
                el.appendChild(this.$editor.editor);
        }
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