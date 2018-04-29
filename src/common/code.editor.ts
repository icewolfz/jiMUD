import EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');

declare let ace;

ace.config.set('basePath', '../lib/ace');
ace.require('ace/ext/language_tools');

let aceTooltip;

export enum UpdateType {
    none = 0, resize = 1
}

export interface EditorOptions {
    file: string;
    container?: any;
}

export class EditorBase extends EventEmitter {

    private $parent: HTMLElement;
    private $file;

    get file(): string {
        return this.$file;
    }
    set file(value: string) {
        if (this.$file != value) {
            this.$file = value;
        }
    }

    get filename(): string {
        if (!this.$file || this.$file.length === 0)
            return '';
        return path.basename(this.$file);
    }

    constructor(options?: EditorOptions) {
        super();

        if (options && options.container)
            this.parent = options.container.container ? options.container.container : options.container;
        else
            this.parent = document.body;
        this.file = options.file;
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

    public createControl() { }

    public read() {
        if (!this.$file || this.$file.length === 0)
            return '';
        try {
            return fs.readFileSync(this.$file);
        }
        catch (err) {
            this.emit('error', err);
        }
        return '';
    }

    public write() {

    }

    public refresh() {}

}

export class CodeEditor extends EditorBase {
    private $el: HTMLTextAreaElement;
    private $editorEl;
    private $editor;
    private $session;

    public createControl() {
        if (this.$el) {
            this.parent.removeChild(this.$el);
        }
        this.$el = document.createElement('textarea');
        this.$el.id = this.parent.id + '-textbox';
        this.$el.style.display = 'none';
        this.parent.appendChild(this.$el);
        this.$editorEl = document.createElement('pre');
        this.$editorEl.classList.add('editor');
        this.$editorEl.id = this.parent.id + '-editor';
        this.parent.appendChild(this.$editorEl);
        this.$editor = ace.edit(this.$editorEl.id);
        this.$session = this.$editor.getSession();

        this.$editor.$blockScrolling = Infinity;
        this.$editor.getSelectedText = function () {
            return this.session.getTextRange(this.getSelectionRange());
        };

        if (!aceTooltip) {
            const Tooltip = ace.require('ace/tooltip').Tooltip;
            aceTooltip = new Tooltip($('#content')[0]);
        }

        this.$editor.setTheme('ace/theme/visual_studio');
        this.$session.setUseSoftTabs(true);

        this.$editor.setOptions({
            enableBasicAutocompletion: true,
            enableSnippets: true,
            enableLiveAutocompletion: true,
            newLineMode: 'unix',
            tabSize: 3
        });

    }

    public openFile() {
        if (!this.file || this.file.length === 0)
            return;
        this.$el.value = this.read();
        switch (path.extname(this.file)) {
            case '.c':
            case '.h':
                this.$session.setMode('ace/mode/lpc');
                break;
            default:
                this.$session.setMode('ace/mode/text');
                break;
        }
        this.$session.setValue(this.$el.value);
        this.emit('opened');
    }

    get file():string {
        return super.file;
    }

    set file(value: string) {
        if (super.file != value) {
            super.file = value;
            this.openFile();
        }
    }    
}

export class VirtualEditor extends EditorBase {
}