import EventEmitter = require('events');
import { existsSync, formatSize, capitalize } from './library';
const { clipboard } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

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
    value?: any;
    remote?: string;
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
    private $remote;
    public state: FileState = FileState.closed;

    get file(): string {
        return this.$file;
    }
    set file(value: string) {
        if (this.$file != value) {
            if (this.$file && this.$file.length > 0 && !this.new)
                this.emit('watch-stop', [this.$file]);
            this.$file = value;
            if (!this.new)
                this.emit('watch', [this.$file]);
        }
    }

    get filename(): string {
        if (!this.$file || this.$file.length === 0)
            return '';
        return path.basename(this.$file);
    }

    get remote(): string {
        return this.$remote;
    }
    set remote(value: string) {
        if (this.$remote != value) {
            this.$remote = value;
        }
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
        if (options.remote)
            this.remote = options.remote;
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
        return fs.readFileSync(this.file, 'utf8');
    }

    public write(data, file?: string) {
        if (!file || file.length === 0)
            file = this.file;
        if (!file || file.length === 0) {
            throw new Error('Invalid file');
        }
        fs.writeFileSync(this.file, data);
    }

    abstract revert(): void;

    abstract open(): void;

    abstract save(): void;

    abstract close(); void;
    abstract watch(action: string, file: string, details?): void;

    abstract get selected(): string;
    abstract focus(): void;

    abstract supports(what): boolean;

    abstract set spellcheck(value: boolean);

    set changed(value: boolean) {
        if (value)
            this.state |= FileState.changed;
        else
            this.state &= ~FileState.changed;
    }

    get changed(): boolean {
        return (this.state & FileState.changed) === FileState.changed;
    }

    set new(value: boolean) {
        if (value)
            this.state |= FileState.new;
        else
            this.state &= ~FileState.new;
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
    private $sbSize: HTMLElement;
    private $sbMsg: HTMLElement;

    constructor(options?: EditorOptions) {
        super(options);
        if (options.value) {
            this.$el.value = options.value;
            this.$session.setValue(options.value);
            this.$session.getUndoManager().reset();
            this.changed = false;
        }
    }

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
        this.$editor.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            let position = this.$editor.selection.getCursor();
            let token = this.$session.getTokenAt(position.row, position.column);
            this.emit('contextmenu', e, token);
            return false;
        });
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
        this.$statusbar.innerHTML = '<span id="' + this.parent.id + '-filename"></span>';
        this.$sbSize = document.createElement('span');
        this.$sbSize.id = this.parent.id + '-filesize';
        this.$statusbar.appendChild(this.$sbSize);
        this.$sbMsg = document.createElement('span');
        this.$sbMsg.id = this.parent.id + '-statusmessage';
        this.$statusbar.appendChild(this.$sbSize);
        this.parent.appendChild(this.$statusbar);
        let StatusBar = ace.require('ace/ext/statusbar').StatusBar;
        new StatusBar(this.$editor, this.$statusbar);

        this.$session.on('change', (e) => {
            var d = this.$session.getValue();
            this.changed = true;
            this.$sbSize.textContent = 'File size: ' + formatSize(d.length);
            this.emit('changed');
        });
        this.$session.getSelection().on('changeSelection', () => {
            this.emit('selection-changed');
            let selected = this.selected.length > 0;
            this.emit('menu-update', 'edit|formatting|to upper case', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|to lower case', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|capitalize', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|inverse case', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|line comment', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|block comment', { enabled: selected });
        })
        this.emit('created');
    }

    public set spellcheck(value: boolean) {
        this.$editor.setOption('spellcheck', value);
    };

    get file(): string {
        return super.file;
    }
    set file(value: string) {
        if (this.file != value) {
            super.file = value;
            $('#' + this.parent.id + '-filename').text(value);
            switch (path.extname(this.file)) {
                case '.c':
                case '.h':
                    this.$session.setMode('ace/mode/lpc');
                    break;
                default:
                    this.$session.setMode(this.getModeByFileExtension(this.file));
                    break;
            }
        }
    }

    private getModeByFileExtension(path) {
        let list = ace.require("ace/ext/modelist");
        return list.getModeForPath(path).mode;
    }

    public open() {
        if (!this.file || this.file.length === 0 || !existsSync(this.file) || this.new)
            return;
        this.$el.value = this.read();
        this.$session.setValue(this.$el.value);
        this.emit('opened');
        this.state |= FileState.opened;
        this.changed = false;
    }

    public refresh() {
        //this.open();
        this.emit('refreshed');
    }

    public save() {
        this.write(this.$session.getValue());
        this.changed = false;
        this.new = false;
        this.emit('saved');
    }

    public close() {
        if (this.file && this.file.length > 0 && !this.new)
            this.emit('watch-stop', [this.file]);
    }

    public get selected(): string {
        return this.$session.getTextRange(this.$editor.getSelectionRange());
    }

    public watch(action: string, file: string, details?) {
        if (file != this.file || this.new)
            return;
        switch (action) {
            case 'add':
            case 'change':
            case 'unlink':
                this.emit('reload', action);
                break;
        }
    }

    public revert() {
        if (!this.new)
            this.open();
        else {
            this.$el.value = '';
            this.$session.setValue('');
        }
        this.$session.getUndoManager().reset();
        this.changed = false;
        this.emit('reverted');
    }

    public selectAll() { this.$editor.selectAll() };

    public cut() {
        let text = this.$editor.getCopyText();
        clipboard.writeText(text || '');
        clipboard.writeText(text || '', 'selection');
        this.$editor.execCommand('cut');
    }
    public copy() {
        let text = this.$editor.getCopyText();
        clipboard.writeText(text || '');
        clipboard.writeText(text || '', 'selection');
    }
    public paste() {
        let text = clipboard.readText();
        if (text.length === 0)
            return;
        this.$editor.insert(text);
    }
    public delete() { this.$editor.remove("right"); }
    public undo() { this.$editor.undo(); }
    public redo() { this.$editor.redo(); }
    public find() { this.$editor.execCommand('find'); }
    public replace() { this.$editor.execCommand('replace'); }
    public supports(what) {
        switch (what) {
            case 'undo':
            case 'redo':
            case 'cut':
            case 'copy':
                return this.selected.length > 0;
            case 'indent':
            case 'paste':
            case 'find':
            case 'replace':
            case 'delete':
            case 'select-all':
            case 'selectall':
            case 'menu|edit':
            case 'menu|context':
                return true;
        }
        return false;
    }
    public menu(menu) {
        if (menu === 'edit' || menu === 'context') {
            return [
                {
                    label: 'Formatting',
                    submenu: [
                        { label: 'Insert Color...' },
                        { type: 'separator' },
                        {
                            label: 'To Upper Case',
                            enabled: this.selected.length > 0,
                            click: () => {
                                var r = this.$editor.getSelectionRange();
                                this.$session.replace(r, this.$editor.getSelectedText().toUpperCase());
                                this.$session.getSelection().setSelectionRange(r);
                            }
                        },
                        {
                            label: 'To Lower Case',
                            enabled: this.selected.length > 0,
                            click: () => {
                                var r = this.$editor.getSelectionRange();
                                this.$session.replace(r, this.$editor.getSelectedText().toLowerCase());
                                this.$session.getSelection().setSelectionRange(r);
                            }
                        },
                        {
                            label: 'Capitalize',
                            enabled: this.selected.length > 0,
                            click: () => {
                                var r = this.$editor.getSelectionRange();
                                this.$session.replace(r, capitalize(this.$editor.getSelectedText()));
                                this.$session.getSelection().setSelectionRange(r);
                            }
                        },
                        {
                            label: 'Inverse Case',
                            enabled: this.selected.length > 0,
                            click: () => {
                                var s = this.$editor.getSelectedText().split(" ");
                                var c;
                                for (var i = 0, il = s.length; i < il; i++) {
                                    for (var p = 0, pl = s[i].length; p < pl; p++) {
                                        c = s[i].charAt(p);
                                        if (c >= 'A' && c <= 'Z')
                                            s[i] = s[i].substr(0, p) + c.toLowerCase() + s[i].substr(p + 1);
                                        else if (c >= 'a' && c <= 'z')
                                            s[i] = s[i].substr(0, p) + c.toUpperCase() + s[i].substr(p + 1);
                                    }
                                }
                                var r = this.$editor.getSelectionRange();
                                this.$session.replace(r, s.join(" "));
                                this.$session.getSelection().setSelectionRange(r);
                            }
                        },
                        { type: 'separator' },
                        {
                            label: 'Line Comment',
                            enabled: this.selected.length > 0,
                            accelerator: 'CmdOrCtrl+/',
                            click: () => {
                                var r = this.$editor.getSelectionRange();
                                if (r.start.row !== r.end.row) {
                                    let str = this.$editor.getSelectedText();
                                    str = '// ' + str.replace(/(?:\r\n|\r|\n)/g, '\n// ');
                                    this.$session.replace(r, str);
                                    r.end.column += 3;
                                }
                                else {
                                    this.$session.replace(r, "// " + this.$editor.getSelectedText());
                                    r.end.column += 3;
                                }
                                this.$session.getSelection().setSelectionRange(r);
                            }
                        },
                        {
                            label: 'Block Comment',
                            enabled: this.selected.length > 0,
                            accelerator: 'Alt+Shift+A',
                            click: () => {
                                var r = this.$editor.getSelectionRange();
                                // if (r.start.row !== r.end.row) {
                                //     this.$session.replace(r, "/*\n" + this.$editor.getSelectedText() + "\n*/");
                                //     r.end.row += 2;
                                //     r.end.column = 2;
                                // }
                                // else {
                                this.$session.replace(r, "/* " + this.$editor.getSelectedText() + " */");
                                r.end.column += 6;
                                //}

                                this.$session.getSelection().setSelectionRange(r);
                            }
                        },
                        { type: 'separator' },
                        {
                            label: 'Indent File',
                            accelerator: 'CmdOrCtrl+I'
                        },
                        {
                            label: 'Format File',
                            accelerator: 'CmdOrCtrl+Shift+F'
                        },
                        {
                            label: 'Format and Indent File',
                            accelerator: 'CmdOrCtrl+Shift+I'
                        }
                    ]
                },
                {
                    label: 'Folding',
                    submenu: [
                        {
                            label: 'Expand All',
                            accelerator: "CmdOrCtrl+>",
                            click: () => {
                                this.$session.unfold();
                            }
                        },
                        {
                            label: 'Collapse All',
                            accelerator: "CmdOrCtrl+<",
                            click: () => {
                                this.$session.foldAll();
                            }
                        }
                    ]
                }
            ]
        }
        if (menu === 'view')
            return [
                {
                    label: 'Toggle Word Wrap',
                    accelerator: 'Alt+Z',
                    click: () => {
                        this.$session.setUseWrapMode(!this.$session.getUseWrapMode());
                    }
                }
            ]
    }

    public focus(): void {
        this.$editor.focus();
    }
}

export class VirtualEditor extends EditorBase {
    public createControl() { }

    public refresh() { }

    public open() { }

    public save() { }

    public revert() { }

    public get selected() { return ''; }
    public selectAll() { };
    public cut() { }
    public copy() { }
    public paste() { }
    public delete() { }
    public undo() { }
    public redo() { }
    public close() { }
    public watch(action: string, file: string, details?) { }
    public set spellcheck(value: boolean) { };
    public find() { }
    public replace() { }
    public supports(what) { return false; }
    public focus(): void { }
}