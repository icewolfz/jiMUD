import EventEmitter = require('events');
import { existsSync } from './library';
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');

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
    open?: boolean;
    new?: boolean;
}

export enum FileState {
    closed = 0,
    opened = 1,
    changed = 2,
    new = 4
}

abstract class EditorBase extends EventEmitter {

    private $parent: HTMLElement;
    private $file;
    public state: FileState = FileState.closed;

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
        if (options.open)
            this.open();
        if (options.new)
            this.state |= FileState.new;
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

    abstract createControl();

    public read(file?: string): string {
        if (!file || file.length === 0)
            file = this.file;
        if (!file || file.length === 0)
            return '';
        return fs.readFileSync(this.file);
    }

    public write(data, file?: string) {
        if (!file || file.length === 0)
            file = this.file;
        if (!file || file.length === 0) {
            throw new Error('Invalid file');
        }
        fs.writeFileSync(this.file, data);
    }

    abstract refresh(): void;

    abstract open(): void;

    abstract save(): void;

    abstract selected();

    get changed(): boolean {
        return (this.state & FileState.changed) === FileState.changed;
    }

    get new(): boolean {
        return (this.state & FileState.new) === FileState.new;
    }
}

export class CodeEditor extends EditorBase {
    private $el: HTMLTextAreaElement;
    private $editorEl;
    private $editor;
    private $session;
    private $statusbar: HTMLElement;

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
        this.$statusbar = document.createElement('div');
        this.$statusbar.id = this.parent.id + '-statusbar';
        this.$statusbar.classList.add('statusbar');
        this.$statusbar.innerHTML = '<span id="' + this.parent.id + '-filename"></span><span id="' + this.parent.id + '-filesize">File size: 0</span><span id="' + this.parent.id + '-statusmessage"></span>';
        this.parent.appendChild(this.$statusbar);
        let StatusBar = ace.require('ace/ext/statusbar').StatusBar;
        new StatusBar(this.$editor, this.$statusbar);

        this.$session.on('change', () => {
            var d = this.$session.getValue();
            this.state |= FileState.changed;
            $('#' + this.parent.id + '-filesize').text("File size: " + d.length.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
            this.emit('changed');
        });
        this.emit('created');
    }

    get file(): string {
        return super.file;
    }
    set file(value: string) {
        if (this.file != value) {
            super.file = value;
            $('#' + this.parent.id + '-filename').text(value);
        }
    }

    private getModeByFileExtension(path) {
        let list = ace.require("ace/ext/modelist");
        return list.getModeForPath(path).mode;
    }

    public open() {
        if (!this.file || this.file.length === 0 || !existsSync(this.file))
            return;
        this.$el.value = this.read();
        switch (path.extname(this.file)) {
            case '.c':
            case '.h':
                this.$session.setMode('ace/mode/lpc');
                break;
            default:
                this.$session.setMode(this.getModeByFileExtension(this.file));
                break;
        }
        this.$session.setValue(this.$el.value);
        this.emit('opened');
        this.state |= FileState.opened;
    }

    public refresh() {
        this.open();
        this.emit('refreshed');
    }

    public save() {
        this.write(this.$session.getValue());
        this.emit('saved');
    }

    public selected() {
        return this.$session.getTextRange(this.$editor.getSelectionRange());
    }
}

export class VirtualEditor extends EditorBase {
    public createControl() { }

    public refresh() { }

    public open() { }

    public save() { }

    public selected() { }
}