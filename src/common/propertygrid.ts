import EventEmitter = require('events');
import { capitalize, resetCursor } from './library';
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
        if (this.$options[prop].editor)
            return this.$options[prop].editor.type || EditorType.default;
        return EditorType.default;
    }

    private editorValue(prop) {
        if (!prop || !this.$options[prop] || !this.$options[prop].editor)
            return undefined;
        if (this.$options[prop].editor && this.$options[prop].editor.options)
            return this.$options[prop].editor.options.value;
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
                    value: this.$options[props[pl]].formatter ? this.$options[props[pl]].formatter(props[pl], this.$object[props[pl]], this.$object) : this.$object[props[pl]],
                    property: props[pl],
                    readonly: this.$options[props[pl]].readonly || (this.$options[props[pl]].editor ? this.$options[props[pl]].editor.type === EditorType.readonly : false)
                });
            }
            else {
                layout['Misc'].push({
                    name: props[pl],
                    value: this.$object[props[pl]],
                    property: props[pl],
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
        if (this.$editor.type === EditorType.flag) {
            var cl = this.$editor.dropdown.children.length;
            value = 0;
            while (cl--) {
                if (this.$editor.checks[cl].checked)
                    value |= +this.$editor.checks[cl].value;
            }
        }
        else if (this.$editor.editor)
            value = this.$editor.editor.value;
        oldValue = this.$object[this.$editor.property];
        if (value !== oldValue) {
            if (this.$options[this.$editor.property] && this.$options[this.$editor.property].formatter)
                this.$editor.el.textContent = this.$options[this.$editor.property].formatter(this.$editor.property, value, this.$object)
            else
                this.$editor.el.textContent = value;
            this.$object[prop] = value;
        }
        if (this.$editor.clear)
            this.$editor.clear();
        if (this.$editor.editor && this.$editor.type === EditorType.custom)
            this.$editor.editor.destroy();
        else if (this.$editor.editor && this.$editor.editor.parentElement)
            this.$editor.editor.parentElement.removeChild(this.$editor.editor);
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
        if(this.$options[prop] && this.$options[prop].editor)
            editorOptions = this.$options[prop].editor.options;
        this.$editor.type = type;
        var values;
        var vl;
        switch (type) {
            case EditorType.flag:
                var value = this.editorValue(prop);
                this.$editor.el.style.border = '1px solid #f2cb7f';
                this.$editor.el.style.top = '-1px';
                this.$editor.el.style.paddingRight = '1px';
                this.$editor.el.style.paddingLeft = '1px';
                this.$editor.editor = document.createElement('button');
                this.$editor.editor.innerHTML = '<span class="caret"></span>';
                this.$editor.editor.dataset.editor = 'flag';
                this.$editor.editor.classList.add('flag-editor');
                this.$editor.editor.style.display = 'none';
                /*
                this.$editor.editor.addEventListener('click', (e) => {
                    this.clearEditor();
                    this.$prevEditor = null;
                    e.preventDefault();
                    e.stopPropagation();
                    e.cancelBubble = true;
                });
                */
                this.$editor.dropdown = document.createElement('div');
                this.$editor.dropdown.classList.add('flag-editor-dropdown');
                this.$editor.dropdown.tabIndex = 1;
                this.$editor.checks = [];
                values = Object.keys(value).filter(key => !isNaN(Number(value[key])));
                vl = values.length;
                while (vl--) {
                    if (editorOptions && editorOptions.exclude) {
                        if (editorOptions.exclude.includes(values[vl]))
                            continue;
                    }
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
                    var el = this.$editor.el;
                    this.clearEditor();
                    if (this.$editorClick !== el)
                        this.$prevEditor = null;
                }, { once: true });
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
                this.$editor.editor = new NumberValueEditor(this, el, editorOptions);
                this.$editor.editor.value = this.$object[prop];
                this.$editor.type = EditorType.custom;
                break;
            case EditorType.select:
                break;
            case EditorType.custom:
                if (this.$options[prop] && this.$options[prop].editor && this.$options[prop].editor.editor) {
                    this.$editor.editor = new this.$options[prop].editor.editor(this, el, editorOptions);
                    this.$editor.editor.value = this.$object[prop];
                }
                /*
                    this.$editor.editor = document.createElement('div');
                    this.$editor.editor.classList.add('property-grid-editor-mulitline');
                    values = document.createElement('div')
                    values.classList.add('property-grid-editor-multiline-container');
                    this.$editor.editor.appendChild(values);
                    this.$editor.editor.value = this.$object[prop];
                    var pEditor = document.createElement('textarea');
                    pEditor.classList.add('property-grid-editor');
                    pEditor.value = this.$object[prop];
                    pEditor.addEventListener('blur', (e) => {
                        if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'multiline') {
                            e.preventDefault();
                            e.stopPropagation();
                            e.cancelBubble = true;
                            return;
                        }
                        this.$editor.editor.value = (<HTMLTextAreaElement>e.currentTarget).value;
                        this.clearEditor();
                    });
                    pEditor.addEventListener('click', (e) => {
                        pEditor.dataset.aOpen = null;
                    });
                    values.appendChild(pEditor);
                    vl = document.createElement('button');
                    vl.title = 'Open editor...'
                    //vl.innerHTML = '&hellip;';
                    vl.innerHTML = '<span class="caret"></span>';
                    vl.dataset.editor = 'multiline';
                    var tEditor;
                    var editorData = this.$editor;
                    vl.addEventListener('click', (e) => {
                        var mDialog = <HTMLDialogElement>document.createElement('dialog');
                        mDialog.style.width = '500px';
                        mDialog.style.height = '300px';
                        mDialog.style.padding = '5px';
                        mDialog.addEventListener('close', () => {
                            if (mDialog.parentElement)
                                mDialog.parentElement.removeChild(mDialog);
                            pEditor.focus();
                        });
                        var header = document.createElement('div');
                        header.classList.add('dialog-header');
                        header.style.fontWeight = 'bold';
                        var button = document.createElement('button');
                        button.classList.add('close');
                        button.type = 'button';
                        button.dataset.dismiss = 'modal';
                        button.addEventListener('click', () => {
                            mDialog.close();
                            if (mDialog.parentElement)
                                mDialog.parentElement.removeChild(mDialog);
                            pEditor.focus();
                        })
                        button.innerHTML = '&times;';
                        header.appendChild(button);
                        var el = document.createElement('div');
                        el.style.paddingTop = '2px';
                        el.innerHTML = capitalize(this.$options[editorData.property].label || editorData.property) + '&hellip;';
                        header.appendChild(el);
                        mDialog.appendChild(header);
                        header = document.createElement('div');
                        header.classList.add('dialog-body');
                        header.style.paddingTop = '40px';
                        mDialog.appendChild(header);
                        el = document.createElement('div');
                        el.classList.add('form-group');
                        el.style.margin = '0';
                        el.style.position = 'absolute';
                        el.style.left = '5px';
                        el.style.right = '5px';
                        el.style.bottom = '60px';
                        el.style.top = '38px';
                        header.appendChild(el);
                        el.appendChild(tEditor);
                        header = document.createElement('div');
                        header.classList.add('dialog-footer');
                        mDialog.appendChild(header);
                        button = document.createElement('button');
                        button.style.cssFloat = 'right';
                        button.type = 'button';
                        button.classList.add('btn', 'btn-default');
                        button.addEventListener('click', () => {
                            mDialog.close();
                            if (mDialog.parentElement)
                                mDialog.parentElement.removeChild(mDialog);
                            pEditor.focus();
                        });
                        button.textContent = 'Cancel';
                        header.appendChild(button);
                        button = document.createElement('button');
                        button.style.cssFloat = 'right';
                        button.type = 'button';
                        button.classList.add('btn', 'btn-primary');
                        button.addEventListener('click', () => {
                            this.$editor = editorData;
                            this.$editor.editor.value = tEditor.value;
                            this.clearEditor();
                            mDialog.close();
                            if (mDialog.parentElement)
                                mDialog.parentElement.removeChild(mDialog);
                            pEditor.focus();
                        });
                        button.textContent = 'Ok';
                        header.appendChild(button);
                        document.body.appendChild(mDialog);
                        mDialog.showModal();
                    });
                    this.$editor.editor.focus = () => {
                        this.$editor.editor.children[0].children[0].focus();
                        resetCursor(this.$editor.editor.children[0].children[0]);
                    };
                    this.$editor.editor.appendChild(vl);
                    this.$editor.clear = () => {
                        if (tEditor && tEditor.parentElement)
                            tEditor.parentElement.removeChild(tEditor);
                    };
                    */
                break;
            default:
                switch (typeof (this.$object[prop])) {
                    case 'boolean':
                        this.$editor.editor = new BooleanValueEditor(this, el, editorOptions);
                        this.$editor.editor.value = this.$object[prop];
                        this.$editor.type = EditorType.custom;
                        break;
                    case 'number':
                        this.$editor.editor = new NumberValueEditor(this, el, editorOptions);
                        this.$editor.editor.value = this.$object[prop];
                        this.$editor.type = EditorType.custom;
                        break;
                    default:
                        this.$editor.editor = new TextValueEditor(this, el, editorOptions);
                        this.$editor.editor.value = this.$object[prop];
                        this.$editor.type = EditorType.custom;
                        break;
                }
                break;
        }
        if (this.$editor.editor) {
            if (this.$editor.type !== EditorType.custom && this.$editor.type !== EditorType.flag) {
                this.$editor.editor.addEventListener('blur', (e) => {
                    this.clearEditor();
                }, { once: true });
                el.appendChild(this.$editor.editor);
                this.$editor.editor.focus();
            }
            else if (this.$editor.type === EditorType.custom)
                this.$editor.editor.focus();
            else {
                el.appendChild(this.$editor.editor);
                if (this.$editor.focus)
                    this.$editor.focus();
            }
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

export abstract class ValueEditor extends EventEmitter {
    private $parent: HTMLElement;
    private $options: any;
    private $grid: PropertyGrid;
    public editorClick: any;

    constructor(grid, parent, options?) {
        super();
        this.parent = parent;
        this.propertyOptions = options;
        this.grid = grid;
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
    private $value;

    create() {
        this.$el = document.createElement('div');
        this.$el.classList.add('property-grid-editor-mulitline');
        var el = document.createElement('div');
        el.classList.add('property-grid-editor-multiline-container');
        this.$el.appendChild(el);
        this.$editor = document.createElement('textarea');
        this.$editor.classList.add('property-grid-editor')
        this.$editor.addEventListener('blur', (e) => {
            if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'multiline') {
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
        el.appendChild(this.$editor);

        var vl = document.createElement('button');
        vl.title = 'Open editor...'
        vl.innerHTML = '<span class="caret"></span>';
        vl.dataset.editor = 'multiline';
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
                if (e.keyCode === 27 || (e.keyCode === 13 && e.ctrlKey)) {
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

    get value() {
        return this.$editor.value;
    }
    set value(value: any) {
        this.$editor.value = value;
    }
}

class BooleanValueEditor extends ValueEditor {
    private $el: HTMLSelectElement;

    private $value;

    create() {
        this.$el = document.createElement('select');
        this.$el.classList.add('property-grid-editor');
        this.$el.innerHTML = '<option value="true">True</option><option value="false">False</option>';
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

    private $value;

    create() {
        this.$el = document.createElement('input');
        this.$el.classList.add('property-grid-editor');
        this.$el.type = 'number';
        this.$el.max = this.propertyOptions ? (this.propertyOptions.max || 1000) : 1000;
        this.$el.min = this.propertyOptions ? (this.propertyOptions.min || 0) : 0;
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
    private $dropdown: HTMLTextAreaElement;
    private $editor: HTMLTextAreaElement;
    private $value;

    create() {
        this.$el = document.createElement('div');
        this.$el.classList.add('property-grid-editor-mulitline');
        var el = document.createElement('div');
        el.classList.add('property-grid-editor-multiline-container');
        this.$el.appendChild(el);
        this.$editor = document.createElement('textarea');
        this.$editor.classList.add('property-grid-editor')
        this.$editor.addEventListener('blur', (e) => {
            if (e.relatedTarget && (<HTMLElement>e.relatedTarget).dataset.editor === 'multiline') {
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
        el.appendChild(this.$editor);

        var vl = document.createElement('button');
        vl.title = 'Open editor...'
        vl.innerHTML = '<span class="caret"></span>';
        vl.dataset.editor = 'multiline';
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
                if (e.keyCode === 27 || (e.keyCode === 13 && e.ctrlKey)) {
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

    get value() {
        /*
        var cl = this.$editor.dropdown.children.length;
        value = 0;
        while (cl--) {
            if (this.$editor.checks[cl].checked)
                value |= +this.$editor.checks[cl].value;
        }
        */

        return this.$editor.value;
    }
    set value(value: any) {
        this.$editor.value = value;
    }
}
