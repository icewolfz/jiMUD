import EventEmitter = require('events');
import { existsSync, formatSize, capitalize } from './library';
const { clipboard, ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

//const loader = require('monaco-loader')

declare let ace;
declare let monaco: any;

interface loadMonacoOptions {
    baseUrl?
}

//based on monaco-loader(https://github.com/felixrieseberg/monaco-loader), inlined to reduce load times
function loadMonaco(options: loadMonacoOptions = {}) {
    return new Promise((resolve, reject) => {
        const monacoDir = path.join(__dirname, '..', '..', 'node_modules', 'monaco-editor');
        const loader: any = require(path.join(monacoDir, '/min/vs/loader.js'));
        if (!loader) {
            return reject(`Found monaco-editor in ${monacoDir}, but failed to require!`);
        }
        loader.require.config({
            baseUrl: options.baseUrl || `file:///${monacoDir}/min`
        });
        (<any>self).module = undefined;
        (<any>self).process.browser = true;
        loader.require(['vs/editor/editor.main'], () => {
            if (monaco) {
                resolve(monaco)
            } else {
                reject('Monaco loaded, but could not find global "monaco"')
            }
        })
    });
}

class DebugTimer {
    private $s = [];

    public start() {
        this.$s.push(new Date().getTime());
    }
    public end(lbl) {
        if (this.$s.length === 0) return;
        var e = new Date().getTime();
        var t = e - this.$s.pop();
        if (!lbl)
            lbl = 'Execution time';
        console.debug(lbl + ': ' + t);
    }
}

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
    abstract resize(): void;
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

    abstract set options(value);
    abstract get options();
    abstract get type();
}

export class CodeEditor extends EditorBase {
    private $el: HTMLTextAreaElement;
    private $editorEl;
    private $editor;
    private $session;
    private $statusbar: HTMLElement;
    private $sbSize: HTMLElement;
    private $sbMsg: HTMLElement;
    private $indenter: lpcIndenter;
    private $formatter: lpcFormatter;
    private $annotations = [];
    private $saving = false;
    private $tooltip;

    constructor(options?: EditorOptions) {
        super(options);
        this.$indenter = new lpcIndenter();
        this.$formatter = new lpcFormatter();
        this.$indenter.on('error', (e) => {
            this.$editor.setReadOnly(false);
            this.$annotations.push({
                row: e.line, column: e.col, text: e.message, type: "error"
            });
            if (this.$annotations.length > 0)
                this.$session.setAnnotations(this.$annotations);
            this.emit('error', e, 'indent');
        });
        this.$indenter.on('start', () => {
            this.emit('progress-start', 'indent');
        });
        this.$indenter.on('progress', (p) => {
            this.emit('progress', p, 'indent');
        });
        this.$indenter.on('complete', (lines) => {
            var Range = ace.require('ace/range').Range;
            this.$session.replace(new Range(0, 0, this.$session.getLength(), Number.MAX_VALUE), lines.join('\n'));
            this.$editor.setReadOnly(false);
            this.emit('progress-complete', 'indent');
        });
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
        let fragment = document.createDocumentFragment();
        this.$el = document.createElement('textarea');
        this.$el.id = this.parent.id + '-textbox';
        this.$el.style.display = 'none';
        fragment.appendChild(this.$el);
        this.$editorEl = document.createElement('pre');
        this.$editorEl.classList.add('editor');
        this.$editorEl.id = this.parent.id + '-editor';
        fragment.appendChild(this.$editorEl);
        this.parent.appendChild(fragment);

        this.$editor = ace.edit(this.$editorEl.id);
        this.$editor.commands.removeCommand('showSettingsMenu');
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
        this.$tooltip = new (ace.require('ace/tooltip').Tooltip)(this.$editor.container);
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
        this.$session.on('changeFold', () => {
            this.$tooltip.hide();
        })
        this.$editor.on('mousemove', (e) => {
            var pos = e.getDocumentPosition();
            var fold = this.$session.getFoldAt(pos.row, pos.column, 1);
            if (fold) {
                var t = this.$session.getDocument().getTextRange(fold.range).replace(/^\n+|\s+$/g, '');
                var s = t.split(/\n/);
                if (s.length > 10) {
                    t = s.slice(0, 10).join("\n").replace(/\s+$/g, '') + "\n...";
                }
                var h = $(window).height();
                var th = this.$tooltip.getHeight();
                var x = e.clientX;
                var y = e.clientY;
                if (y + th > h)
                    y = y - th;
                this.$tooltip.show(t, x, y);
                e.stop();
            }
            else
                this.$tooltip.hide();
        });
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
        this.$saving = true;
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
                if (!this.$saving)
                    this.emit('reload', action);
                else
                    this.$saving = false;
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
            case 'menu|view':
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
                        {
                            label: 'Insert Color...',
                            click: () => {
                                ipcRenderer.send('show-window', 'color', { type: this.file.replace(/[/|\\:]/g, ''), color: '', window: 'code-editor' });
                                var setcolor = (event, type, color, code, window) => {
                                    if (window !== 'code-editor' || type !== this.file.replace(/[/|\\:]/g, ''))
                                        return;
                                    this.$editor.insert('%^' + code.replace(/ /g, '%^%^') + '%^');
                                    ipcRenderer.removeListener('set-color', setcolor);
                                }
                                ipcRenderer.on('set-color', setcolor);
                            }
                        },
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
                            accelerator: 'CmdOrCtrl+I',
                            click: () => {
                                var Range = ace.require('ace/range').Range;
                                this.$editor.setReadOnly(true);
                                this.$session.clearAnnotations();
                                this.$indenter.indent(this.$session.getValue());
                            }
                        },
                        {
                            label: 'Format File',
                            accelerator: 'CmdOrCtrl+Shift+F',
                            click: () => {
                                this.emit('progress-start', 'format');
                                this.$editor.setReadOnly(true);
                                var Range = ace.require('ace/range').Range;
                                this.$session.replace(new Range(0, 0, this.$session.getLength(), Number.MAX_VALUE), this.$formatter.format(this.$session.getValue()));
                                this.$editor.setReadOnly(false);
                                this.emit('progress-complete', 'format');
                            }
                        },
                        {
                            label: 'Format and Indent File',
                            accelerator: 'CmdOrCtrl+Shift+I',
                            click: () => {
                                this.emit('progress-start', 'format');
                                this.$editor.setReadOnly(true);
                                var code = this.$formatter.format(this.$session.getValue());
                                this.emit('progress-complete', 'format');
                                this.$indenter.indent(code);
                            }
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
                    },
                }
            ]
    }

    public focus(): void {
        this.$editor.focus();
    }

    public resize() {
        this.$editor.resize(true);
    }

    public set options(value) {
        var mode = this.$editor.getOption('mode');
        this.$editor.setOptions(value);
        this.$session.setMode(mode);
    }
    public get options() {
        return this.$editor.getOptions();
    }
    public get type() {
        return 1;
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
    public resize() { }
    public set options(value) { }
    public get options() { return null; }
    public get type() {
        return 2;
    }
}

export class CodeEditor2 extends EditorBase {
    private $el: HTMLElement;
    private $editor;
    private $loaded;

    constructor(options?: EditorOptions) {
        super(options);
        if (options.value) {
            this.checkReady(() => {
                this.$editor.setValue(options.value);
                this.changed = false;
            });
        }
    }


    public createControl() {
        this.$el = document.createElement('div');
        this.$el.id = this.parent.id + '-editor';
        this.$el.classList.add('editor');
        this.parent.appendChild(this.$el);
        loadMonaco().then((monaco: any) => {
            this.$editor = monaco.editor.create(this.$el, {
                language: 'cpp',
                autoIndent: true,
                scrollBeyondLastLine: false,
                rulers: [80]
            });
            this.$editor.getModel().updateOptions({
                tabSize: 3,
                insertSpaces: true
            });
            var r = this.$loaded.length;
            while (r--)
                this.$loaded[r]();
            setTimeout(() => {
                this.resize();
            }, 100);
        });
    }

    public refresh() { }

    public open() {
        if (!this.file || this.file.length === 0 || !existsSync(this.file) || this.new)
            return;
        this.checkReady(() => {
            this.$editor.setValue(this.read());
            this.emit('opened');
            this.state |= FileState.opened;
            this.changed = false;
        });
    }

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
    public resize() {
        this.checkReady(() => {
            this.$editor.layout();
        })
    }
    public set options(value) { }
    public get options() { return null; }
    public get type() {
        return 2;
    }

    public checkReady(callback) {
        if (!this.$editor) {
            if (!this.$loaded) this.$loaded = [];
            this.$loaded.unshift(callback);
            return false;
        }
        else if (callback)
            callback();
    }
}


enum TokenType {
    SEMICOLON = 0,
    LBRACKET = 1,
    RBRACKET = 2,
    LOPERATOR = 3,
    ROPERATOR = 4,
    LHOOK = 5,
    LHOOK2 = 6,
    RHOOK = 7,
    TOKEN = 8,
    ELSE = 9,
    IF = 10,
    SWITCH = 11,
    FOR = 12,
    WHILE = 13,
    XDO = 14,
    XEOT = 15
}

class Stack {
    public size: number;
    private $stack = [];
    private position = 0;

    constructor(size) {
        this.size = size;
        if (Array.isArray(size))
            this.$stack = size;
        else
            this.$stack = new Array(size).fill(0);
    }

    set set(value) {
        this.$stack[this.position] = value;
    }
    public query(p) {
        if (!p)
            return this.$stack[this.position];
        if (p < 0)
            return this.$stack[0];
        if (p >= this.$stack.length)
            this.$stack[this.$stack.length - 1]
        return this.$stack[p];
    }

    public getnext(p) {
        if (!p) p = 0;
        return this.query(p + this.position);
    }

    public next(value?) {
        if (this.position < this.$stack.length - 1)
            this.position++;
        if (value !== undefined)
            this.$stack[this.position] = value;
        return this.$stack[this.position];
    }

    public prev(value?) {
        if (this.position > 0)
            this.position--;
        if (value !== undefined)
            this.$stack[this.position] = value;
        return this.$stack[this.position];
    }

    public last(value?) {
        this.position = this.$stack.length - 1;
        if (value !== undefined)
            this.$stack[this.position] = value;
        return this.$stack[this.position];
    }

    get current() {
        return this.$stack[this.position];
    }

    get length() {
        return this.$stack.length;
    }

    get bottom() {
        return this.position >= this.$stack.length;
    }

    get stack() {
        return this.$stack;
    }

    public copy() {
        return this.$stack.slice();
    }
}

export class lpcIndenter extends EventEmitter {
    private $stack: Stack; /* token stack */
    private $ind: Stack; /* indent stack */
    private $quote; /* ' or " */
    private $in_ppcontrol;
    private $after_keyword_t;
    private $in_mblock; /* status */
    private $in_comment;
    private $last_term;
    private $last_term_len;
    private $shi; /* the current shift (negative for left shift) */

    private $f = [7, 1, 7, 1, 2, 1, 1, 6, 4, 2, 6, 7, 7, 7, 2, 0,];
    private $g = [2, 2, 1, 7, 1, 5, 5, 1, 3, 6, 2, 2, 2, 2, 2, 0,];

    private shiftLine(line) {
        if (!line || line.length === 0)
            return line;
        let ii = 0;
        let ptr = 0;
        let ll = line.length;
        let c = line.charAt(ptr);
        while (ptr < ll && (c === ' ' || c === '\t')) {
            if (c === ' ')
                ii++;
            else
                ii = ii + 8 - (ii % 8);
            ptr++;
            c = line.charAt(ptr);
        }
        if (ptr >= ll) return line;

        ii += this.$shi;

        var newline = "";
        /* fill with leading ws */
        while (ii > 0) {
            newline += ' ';
            --ii;
        }
        return newline + line.substring(ptr);
    }

    private strncmp(str1, str2, n) {
        str1 = str1.substring(0, n);
        str2 = str2.substring(0, n);
        return ((str1 == str2) ? 0 : ((str1 > str2) ? 1 : -1));
    }

    private isalpha(c) {
        return (((c >= 'a') && (c <= 'z')) || ((c >= 'A') && (c <= 'Z')));
    }

    private isdigit(c) {
        return ((c >= '0') && (c <= '9'));
    }

    private isalnum(c) {
        return (this.isalpha(c) || this.isdigit(c));
    }
    private indent_line(line, lineNo) {
        if (!line || line.length === 0) return line;
        var pl = line.length, opl = line.length;
        var p = 0;
        var do_indent = false;
        var indent_index = 0;
        var ident;
        var token, top;
        var ip, sp;
        var newLine;

        if (this.$quote)
            this.$shi = 0;
        else if (this.$in_ppcontrol || line.charAt(p) === '#') {
            while (p < pl) {
                if (line.charAt(p) == '\\' && p + 1 === pl) {
                    this.$in_ppcontrol = true;
                    return newLine || line;
                }
                p++;
            }
            this.$in_ppcontrol = false;
            return newLine || line;
        }
        else if (this.$in_mblock) {
            if (!this.strncmp(line, this.$last_term, this.$last_term.length)) {
                this.$in_mblock = false;
                p += this.$last_term.length;
            }
            else
                return newLine || line;
        }
        else {
            while (p < pl && (line.charAt(p) === ' ' || line.charAt(p) === '\t')) {
                if (line.charAt(p++) == ' ')
                    indent_index++;
                else
                    indent_index = indent_index + 8 - (indent_index % 8);
            }
            if (p >= pl)
                return newLine || line;
            else if (this.$in_comment > 0) {
                newLine = this.shiftLine(newLine || line);
            }
            else
                do_indent = true;
        }

        pl = line.length;

        var start = p;
        while (p < pl) {
            ident = "";
            if (this.$in_comment > 0) {
                while (line.charAt(p) !== '*') {
                    if (p >= pl) {
                        if (this.$in_comment === 2) this.$in_comment = 0;
                        return newLine || line;
                    }
                    p++;
                }
                while (line.charAt(p) === '*')
                    p++;
                if (line.charAt(p) === '/') {
                    this.$in_comment = 0;
                    p++;
                }
                continue;
            }
            else if (this.$quote) {
                for (; ;) {
                    if (line.charAt(p) === this.$quote) {
                        this.$quote = 0;
                        p++;
                        break;
                    }
                    else if (p >= pl)
                        throw { message: "Unterminated string", line: lineNo, col: p - 1 };
                    else if (line.charAt(p) === '\\' && p + 1 == pl)
                        break;
                    p++;
                }
                token = TokenType.TOKEN;
            }
            else {
                var c = line.charAt(p++);
                switch (c) {
                    case ' ':
                    case '\t':
                        continue;
                    case '\'':
                    case '"':
                        this.$quote = c;
                        if (p >= pl)
                            throw { message: "Unterminated string", line: lineNo, col: p - 1 };
                        continue;
                    case '@':
                        var j = 0;
                        c = line.charAt(p);
                        if (c === '@')
                            c = line.charAt(p++);
                        this.$last_term = "";
                        while (this.isalnum(c) || c === '_') {
                            this.$last_term += c;
                            c = line.charAt(++p);
                        }
                        this.$in_mblock = true;
                        return newLine || line;
                    case '/':
                        if (line.charAt(p) === '*' || line.charAt(p) === '/') {
                            this.$in_comment = (line.charAt(p) === '*') ? 1 : 2;
                            if (do_indent) {
                                this.$shi = this.$ind.current - indent_index;

                                newLine = this.shiftLine(newLine || line);
                                //p += shi;
                                do_indent = false;
                            }
                            else {
                                var q;
                                var index2 = this.$ind.current;
                                for (q = start; q < p - 1; q++) {
                                    if (line.charAt(q) === '\t') {
                                        indent_index = indent_index + 8 - (indent_index % 8);
                                        index2 = index2 + 8 - (index2 % 8);
                                    }
                                    else {
                                        indent_index++;
                                        index2++;
                                    }
                                }
                                this.$shi = index2 - indent_index;
                            }
                            p++;
                            if (p >= pl && this.$in_comment === 2)
                                this.$in_comment = 0;
                            if (this.$in_comment === 2) {
                                this.$in_comment = 0;
                                return newLine || line;
                            }
                            continue;
                        }
                        token = TokenType.TOKEN;
                        break;
                    case '{':
                        token = TokenType.LBRACKET;
                        break;
                    case '(':
                        if (this.$after_keyword_t) {
                            token = TokenType.LOPERATOR;
                            break;
                        }
                        if (line.charAt(p) === '{' || line.charAt(p) === '[' || (line.charAt(p) === ':' && line.charAt(p + 1) != ':')) {
                            p++;
                            token = TokenType.LHOOK2;
                            break;
                        }
                        token = TokenType.LHOOK;
                        break;
                    case '[':
                        token = TokenType.LHOOK;
                        break;
                    case ':':
                        if (line.charAt(p) === ')') {
                            p++;
                            token = TokenType.RHOOK;
                            break;
                        }
                        token = TokenType.TOKEN;
                        break;
                    case '}':
                        if (line.charAt(p) !== ')') {
                            token = TokenType.RBRACKET;
                            break;
                        }
                        p++;
                        token = TokenType.RHOOK;
                        break;
                    case ']':
                        if (line.charAt(p) === ')' &&
                            (this.$stack.current === TokenType.LHOOK2 ||
                                (this.$stack.current != TokenType.XEOT && (this.$stack.getnext(1) === TokenType.LHOOK2 || (this.$stack.getnext(1) === TokenType.ROPERATOR && this.$stack.getnext(2) == TokenType.LHOOK2)))))
                            p++;
                        token = TokenType.RHOOK;
                        break;
                    case ')':
                        token = TokenType.RHOOK;
                        break;
                    case ';':
                        token = TokenType.SEMICOLON;
                        break;
                    default:
                        if (this.isalpha(line.charAt(--p)) || line.charAt(p) == '_') {
                            ident = "";
                            do {
                                ident += line.charAt(p++);
                            }
                            while (this.isalnum(line.charAt(p)) || line.charAt(p) === '_');
                            if (ident === "switch")
                                token = TokenType.SWITCH;
                            else if (ident === "if")
                                token = TokenType.IF;
                            else if (ident === "else")
                                token = TokenType.ELSE;
                            else if (ident === "for")
                                token = TokenType.FOR;
                            else if (ident === "foreach")
                                token = TokenType.FOR;
                            else if (ident === "while")
                                token = TokenType.WHILE;
                            else if (ident === "do")
                                token = TokenType.XDO;
                            else
                                token = TokenType.TOKEN;
                        }
                        else {
                            p++;
                            token = TokenType.TOKEN;
                        }
                        break;
                }
            }

            sp = this.$stack;
            ip = this.$ind;
            for (; ;) {
                top = sp.current;
                if (top == TokenType.LOPERATOR && token == TokenType.RHOOK)
                    token = TokenType.ROPERATOR;
                if (this.$f[top] <= this.$g[token]) { /* shift the token on the stack */
                    var i, i2 = 0;
                    if (sp.bottom)
                        throw { message: "Nesting too deep", line: lineNo, col: p - 1 };

                    i = ip.current;
                    if ((token === TokenType.LBRACKET &&
                        (sp.current === TokenType.ROPERATOR || sp.current === TokenType.ELSE || sp.current === TokenType.XDO)) ||
                        token === TokenType.RBRACKET || (token === TokenType.IF && sp.current === TokenType.ELSE)) {
                        i -= 3; //shift
                    }
                    else if (token == TokenType.RHOOK || token == TokenType.ROPERATOR) {
                        i -= 1; //shift / 2
                    }
                    /* shift the current line, if appropriate */
                    if (do_indent) {
                        this.$shi = i - indent_index + i2;
                        if (token == TokenType.TOKEN && sp.current == TokenType.LBRACKET && (ident === "case" || ident === "default"))
                            this.$shi -= 3; //shift
                        newLine = this.shiftLine(newLine || line);
                        //p += shi;
                        do_indent = false;
                    }
                    /* change indentation after current token */
                    switch (token) {
                        case TokenType.SWITCH:
                            //i += 3;
                            break;
                        case TokenType.IF:
                            break;
                        case TokenType.LBRACKET:
                        case TokenType.ROPERATOR:
                        case TokenType.ELSE:
                        case TokenType.XDO:
                            {
                                /* add indentation */
                                i += 3;
                                break;
                            }
                        case TokenType.LOPERATOR:
                        case TokenType.LHOOK:
                        case TokenType.LHOOK2:
                            /* Is this right? */
                            {
                                /* half indent after ( [ ({ ([ */
                                i += 1;
                                break;
                            }
                        case TokenType.SEMICOLON:
                            {
                                /* in case it is followed by a comment */
                                if (sp.current == TokenType.ROPERATOR || sp.current == TokenType.ELSE)
                                    i -= 3;
                                break;
                            }
                    }
                    sp.prev(token);
                    ip.prev(i);
                    break;
                }
                do {
                    top = sp.current;
                    sp.next();
                    ip.next();
                } while (this.$f[sp.current] >= this.$g[top]);
            }
            this.$stack = sp;
            this.$ind = ip;

            this.$after_keyword_t = (token >= TokenType.IF);
        }
        if (p >= pl && this.$quote)
            throw { message: "Unterminated string", line: lineNo, col: p - 1 };

        return newLine || line;
    }

    private indentLines(lines, c, chunk) {
        var ce = c + chunk;
        var ln = c;
        var ll = lines.length;
        try {
            for (; ln < ll && ln < ce; ln++)
                lines[ln] = this.indent_line(lines[ln], ln);
            if (ln < lines.length - 1) {
                ce = Math.ceil(100 * ce / lines.length);
                setTimeout(() => { this.indentLines(lines, ln, chunk); }, 5);
                this.emit('progress', ce, c, chunk, lines);
            }
            else {
                this.emit('complete', lines);
            }
        }
        catch (e) {
            this.emit('error', e);
        }
    }

    public reset() {
        this.$stack = new Stack(2048);
        this.$stack.last(TokenType.XEOT);
        this.$ind = new Stack(2048);
        this.$ind.last(0);
        this.$in_ppcontrol = 0;
        this.$in_comment = 0;
        this.$in_mblock = 0;
        this.$quote = 0;
        this.emit('start');
    }

    public indent(code) {
        if (!code || code.length === 0)
            return code;
        this.reset();
        var lines = code.split("\n");
        this.indentLines(lines, 0, 100);
    };

    public indentEditor(editor) {
        if (!editor) return;
        let session = editor.getSession();
        this.reset();
        var ll = session.getLength();
        var ln = 0, l;
        try {
            var Range = ace.require('ace/range').Range;
            for (; ln < ll; ln++) {
                l = session.getLine(ln);
                session.replace(new Range(ln, 0, ln, l.length), this.indent_line(l, ln));
            }
        }
        catch (e) {
            this.emit('error', e);
        }
    };

}

enum FormatTokenType {
    unknown,
    text,
    keyword,
    datatype,
    modifier,
    constant,
    parenLmapping,
    parenLarray,
    parenLclosure,
    parenLparen,
    parenLbrace,
    parenLbracket,
    parenRarray,
    parenRbrace,
    parenRbracket,
    parenRmapping,
    parenRbracken,
    parenRclosure,
    parenRparen,
    string,
    whitespace,
    newline,
    operator,
    operatorBase,
    operatorMethod,
    operatorNot,
    commentInline,
    commentLeft,
    commentRight,
    flatten,
    semicolon,
    precompiler,
    comma,
    stringblock
}

interface FormatToken {
    value: string;
    type: FormatTokenType;
}

export class lpcFormatter extends EventEmitter {
    private $src = "";
    private $position = 0;
    private tokens = [];
    private block = [];
    private b = [];

    public format(source) {
        if (!source || source.length === 0)
            return "";

        this.block = [];
        this.b = [];
        this.$src = source;
        this.$position = 0;
        this.tokens = [];
        this.tokenize();
        this.emit('start');
        var tp = 0;
        var tl = this.tokens.length;
        var op = "";
        var s, e, t, t2, tll, t3, t1;
        var pc, incase;
        var incomment = 0;
        var inclosure = 0;
        var inif = 0;
        var p = 0;
        var mblock = 0;
        var leading;
        for (; tp < tl; tp++) {
            leading = "";
            for (t = 0, tll = this.tokens[tp].length; t < tll; t++) {
                if (this.tokens[tp][t].type !== FormatTokenType.whitespace)
                    break;
                op += this.tokens[tp][t].value;
                leading += this.tokens[tp][t].value;
            }
            s = t;
            pc = this.tokens[tp][t].type === FormatTokenType.precompiler ? 1 : 0;
            incase = 0;
            if (incomment === 1) incomment = 0;
            while (t < tll) {
                if (this.tokens[tp][t].type === FormatTokenType.stringblock && t + 1 < tll)
                    mblock = this.tokens[tp][t + 1].type;
                if (!mblock) {
                    if (incomment === 0 && inif && this.tokens[tp][t].type === FormatTokenType.parenLparen)
                        p++;
                    else if (this.tokens[tp][t].type === FormatTokenType.parenLclosure)
                        inclosure++;
                    else if (this.tokens[tp][t].type === FormatTokenType.parenRclosure)
                        inclosure--;
                    else if (incomment === 0 && this.tokens[tp][t].type === FormatTokenType.commentInline)
                        incomment = 1;
                    else if (incomment === 0 && this.tokens[tp][t].type === FormatTokenType.commentInline)
                        incomment = 2;
                    else if (this.tokens[tp][t].type === FormatTokenType.commentRight)
                        incomment = 0;
                    else if (!pc && incomment === 0 && inclosure === 0 && s !== t && this.tokens[tp][t].type === FormatTokenType.keyword) {
                        switch (this.tokens[tp][t].value) {
                            case "break":
                            case "case":
                            case "continue":
                            case "default":
                            case "do":
                            case "else":
                            case "for":
                            case "foreach":
                            case "goto":
                            case "return":
                            case "switch":
                            case "while":
                            case "catch":
                            case "try":
                            case "throw":
                            case "using":
                                if (!op.rtrim().endsWith("\n"))
                                    op += "\n" + leading + "   ";
                                break;
                            case "if":
                                if (!op.endsWith("else ") && !op.rtrim().endsWith("\n"))
                                    op += "\n" + leading + "   ";
                                break;
                        }
                    }
                }
                incase = (incase || this.tokens[tp][t].value === "case" || this.tokens[tp][t].value === "default") ? 1 : 0;
                if (!mblock && incomment === 0) {
                    if (s !== t) {
                        if (this.tokens[tp][t].type === FormatTokenType.comma || this.tokens[tp][t].type === FormatTokenType.semicolon)
                            op = op.rtrim();
                        else if (!pc && this.tokens[tp][t].type === FormatTokenType.operator) {
                            if (!incase || (incase && this.tokens[tp][t].value !== ":")) {
                                if (this.tokens[tp][t].value === '-') {
                                    t3 = t - 1;
                                    while (t3 >= 0 && this.tokens[tp][t3].type === FormatTokenType.whitespace) {
                                        t3--;
                                        if (t3 <= 0)
                                            break;
                                    }
                                    if (t3 < 0 || this.tokens[tp][t3].type !== FormatTokenType.operatorNot) {
                                        op = op.rtrim();
                                        op += " ";
                                    }
                                }
                                else {
                                    op = op.rtrim();
                                    op += " ";
                                }
                            }
                        }
                        else if (this.tokens[tp][t].type === FormatTokenType.parenLclosure || this.tokens[tp][t].type === FormatTokenType.parenRclosure || this.tokens[tp][t].type === FormatTokenType.parenLmapping || this.tokens[tp][t].type === FormatTokenType.parenRmapping || this.tokens[tp][t].type === FormatTokenType.parenRarray || this.tokens[tp][t].type === FormatTokenType.parenLarray) {
                            op = op.rtrim();
                            op += " ";
                        }
                    }
                    if ((this.tokens[tp][t].type === FormatTokenType.parenRbrace || this.tokens[tp][t].type === FormatTokenType.parenLbrace) && s !== t && !op.rtrim().endsWith("\n"))
                        op += "\n" + leading;
                }
                op += this.tokens[tp][t].value;
                e = t;
                if (!mblock && incomment === 0) {
                    if (t + 1 < tll) {
                        if (this.tokens[tp][t].type === FormatTokenType.parenLbrace || this.tokens[tp][t].type === FormatTokenType.parenRbrace) {
                            t++;
                            for (; t < tll; t++) {
                                if (this.tokens[tp][t].type === FormatTokenType.whitespace) {
                                    op += this.tokens[tp][t].value;
                                    continue;
                                }
                                break;
                            }
                            if (this.tokens[tp][t].type !== FormatTokenType.newline && !op.rtrim().endsWith("\n"))
                                op += "\n" + leading;
                        }
                        else if (!pc && this.tokens[tp][t].type === FormatTokenType.operator || this.tokens[tp][t].type === FormatTokenType.comma || this.tokens[tp][t].type === FormatTokenType.semicolon) {
                            t2 = t + 1;
                            t3 = t - 1;
                            t1 = t;
                            if (this.tokens[tp][t2].type !== FormatTokenType.newline) {
                                while (this.tokens[tp][t2].type === FormatTokenType.whitespace) {
                                    t++;
                                    e++;
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                while (t3 >= 0 && this.tokens[tp][t3].type === FormatTokenType.whitespace) {
                                    t3--;
                                    if (t3 <= 0)
                                        break;
                                }
                                if (t2 < tll) {
                                    //only - matters as only operator that can standalone for signage
                                    if (this.tokens[tp][t1].value === '-') {
                                        //previous is text so should add a space
                                        if (t3 >= 0 && this.tokens[tp][t3].type === FormatTokenType.text) {
                                            op = op.rtrim();
                                            op += " ";
                                        }
                                    } //datatype + * is an array no space after
                                    else if (this.tokens[tp][t1].value === '*') {
                                        //previous is text so should add a space
                                        if (t3 < 0 || (t3 >= 0 && this.tokens[tp][t3].type !== FormatTokenType.datatype)) {
                                            op = op.rtrim();
                                            op += " ";
                                        }
                                    }
                                    else {
                                        op = op.rtrim();
                                        op += " ";
                                    }
                                }
                            }
                        }
                        else if (!pc && this.tokens[tp][t].type === FormatTokenType.operatorNot && this.tokens[tp][t].value === '!') {
                            t2 = t + 1;
                            if (this.tokens[tp][t2].type !== FormatTokenType.newline) {
                                while (this.tokens[tp][t2].type === FormatTokenType.whitespace) {
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                if (t2 < tll) {
                                    if (this.tokens[tp][t2].type === FormatTokenType.text) {
                                        e = t2 - 1;
                                        t = t2 - 1;
                                    }
                                    else if (this.tokens[tp][t2].type === FormatTokenType.operator && this.tokens[tp][t2].value === '-') {
                                        e = t2 - 1;
                                        t = t2 - 1;
                                    }
                                    else if (this.tokens[tp][t2].type === FormatTokenType.operatorNot && this.tokens[tp][t2].value === '!') {
                                        e = t2 - 1;
                                        t = t2 - 1;
                                    }
                                }
                            }
                        }
                        else if ((this.tokens[tp][t].type === FormatTokenType.parenLclosure || this.tokens[tp][t].type === FormatTokenType.parenRclosure || this.tokens[tp][t].type === FormatTokenType.parenLmapping || this.tokens[tp][t].type === FormatTokenType.parenRmapping || this.tokens[tp][t].type === FormatTokenType.parenRarray || this.tokens[tp][t].type === FormatTokenType.parenLarray)) {
                            t2 = t + 1;
                            if (this.tokens[tp][t2].type !== FormatTokenType.newline) {
                                while (this.tokens[tp][t2].type === FormatTokenType.whitespace) {
                                    t++;
                                    e++;
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                if (t2 < tll) {
                                    op = op.rtrim();
                                    op += " ";
                                }
                            }
                        }
                        else if (!pc && inclosure === 0 && this.tokens[tp][t].type === FormatTokenType.keyword) {
                            t2 = t + 1;
                            switch (this.tokens[tp][t].value) {
                                case "return":
                                    while (this.tokens[tp][t2].type === FormatTokenType.whitespace) {
                                        t++;
                                        e++;
                                        t2++;
                                        if (t2 >= tll)
                                            break;
                                    }
                                    if (this.tokens[tp][t2].type !== FormatTokenType.semicolon)
                                        op += " ";
                                    break;
                                case "break":
                                case "continue":
                                case "default":
                                    while (this.tokens[tp][t2].type === FormatTokenType.whitespace) {
                                        t++;
                                        e++;
                                        t2++;
                                        if (t2 >= tll)
                                            break;
                                    }
                                    break;
                                case "case":
                                case "do":
                                case "else":
                                case "for":
                                case "foreach":
                                case "goto":
                                case "switch":
                                case "while":
                                case "catch":
                                case "try":
                                case "throw":
                                case "using":
                                    break;
                                case "if":
                                    while (this.tokens[tp][t2].type === FormatTokenType.whitespace) {
                                        t++;
                                        e++;
                                        t2++;
                                        if (t2 >= tll)
                                            break;
                                    }
                                    inif = 1;
                                    break;
                            }
                        }
                    }
                    if (inif && this.tokens[tp][t].type === FormatTokenType.parenRparen) {
                        p--;
                        if (p === 0) {
                            t2 = t + 1;
                            if (t2 < tll && this.tokens[tp][t2].type !== FormatTokenType.newline && this.tokens[tp][t].type !== FormatTokenType.parenLbrace && this.tokens[tp][t].type !== FormatTokenType.keyword) {
                                while (this.tokens[tp][t2].type === FormatTokenType.whitespace) {
                                    t++;
                                    e++;
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                if (t2 < tll && this.tokens[tp][t2].type !== FormatTokenType.newline && this.tokens[tp][t2].type !== FormatTokenType.parenLbrace && this.tokens[tp][t2].type !== FormatTokenType.keyword) {
                                    op = op.rtrim();
                                    op += "\n" + leading;
                                }
                            }
                            inif = 0;
                        }
                    }
                }
                if (mblock === this.tokens[tp][t].value)
                    mblock = 0;
                t = e;
                t++;
            }
        }
        this.emit('end');
        return op;
    };

    private typetoken(txt) {
        switch (txt) {
            case "break":
            case "case":
            case "continue":
            case "default":
            case "do":
            case "else":
            case "for":
            case "foreach":
            case "goto":
            case "if":
            case "return":
            case "switch":
            case "while":
            case "catch":
            case "try":
            case "throw":
            case "using":
                return { value: txt, type: FormatTokenType.keyword };
            case "object":
            case "function":
            case "float":
            case "mapping":
            case "string":
            case "int":
            case "struct":
            case "void":
            case "class":
            case "status":
            case "mixed":
            case "buffer":
            case "array":
                return { value: txt, type: FormatTokenType.datatype };
            case "private":
            case "protected":
            case "public":
            case "static":
            case "varargs":
            case "nosave":
            case "nomask":
            case "virtual":
            case "inherit":
                return { value: txt, type: FormatTokenType.modifier };
            case "MUDOS":
            case "__PORT__":
            case "__ARCH__":
            case "__COMPILER__":
            case "__OPTIMIZATION__":
            case "MUD_NAME":
            case "HAS_ED":
            case "HAS_PRINTF":
            case "HAS_RUSAGE":
            case "HAS_DEBUG_LEVEL":
            case "__DIR__":
            case "FLUFFOS":
            case "__WIN32__":
            case "__HAS_RUSAGE__":
            case "__M64__":
            case "__PACKAGE_DB__":
            case "__GET_CHAR_IS_BUFFERED__":
            case "__DSLIB__":
            case "__DWLIB__":
            case "__FD_SETSIZE__":
            case "__VERSION__":
            case "__DEBUG__":
            case "SIZEOFINT":
            case "MAX_INT":
            case "MIN_INT":
            case "MAX_FLOAT":
            case "MIN_FLOAT":
                return { value: txt, type: FormatTokenType.constant };
        }
        return { value: txt, type: FormatTokenType.text };
    }

    private getToken(): FormatToken {
        var len = this.$src.length;
        var idx = this.$position;
        var s = this.$src;
        var val = "";
        var state = 0;
        var c;
        for (; idx < len; idx++) {
            c = s.charAt(idx);
            //i = s.charCodeAt(idx);
            switch (state) {
                case 1:
                    switch (c) {
                        case "[":
                            this.$position = idx + 1;
                            state = 0;
                            return { value: "([", type: FormatTokenType.parenLmapping };
                        case "{":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "({", type: FormatTokenType.parenLarray };
                        case ":":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "(:", type: FormatTokenType.parenLclosure };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: "(", type: FormatTokenType.parenLparen };
                    }
                case 2:
                    switch (c) {
                        case ")":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "})", type: FormatTokenType.parenRarray };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: "}", type: FormatTokenType.parenRbrace };
                    }
                case 3:
                    switch (c) {
                        case ")":
                            state = 0;
                            if (this.b.length) {
                                this.$position = idx;
                                this.b.pop();
                                return { value: "]", type: FormatTokenType.parenRbracket };
                            }
                            this.$position = idx + 1;
                            return { value: "])", type: FormatTokenType.parenRmapping };
                        default:
                            state = 0;
                            this.$position = idx;
                            this.b.pop();
                            return { value: "]", type: FormatTokenType.parenRbracket };
                    }
                case 4:
                    if (c == "\\") {
                        val += c;
                        state = 5;
                    }
                    else if (c == '"') {
                        val += c;
                        this.$position = idx + 1;
                        state = 0;
                        return { value: val, type: FormatTokenType.string };
                    }
                    else {
                        val += c;
                        this.$position = idx + 1;
                    }
                    break;
                case 5:
                    val += c;
                    this.$position = idx + 1;
                    state = 4;
                    break;
                case 6:
                    if (c == " " || c == "\t") {
                        val += c;
                        this.$position = idx + 1;
                    }
                    else {
                        this.$position = idx;
                        state = 0;
                        return { value: val, type: FormatTokenType.whitespace };
                    }
                    break;
                case 7:
                    switch (c) {
                        case ")":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: ":)", type: FormatTokenType.parenRclosure };
                        case ":":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "::", type: FormatTokenType.operatorBase };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: ":", type: FormatTokenType.operator };
                    }
                case 8:
                    switch (c) {
                        case "/":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "//", type: FormatTokenType.commentInline };
                        case "*":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "/*", type: FormatTokenType.commentLeft };
                        case "=":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "/=", type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: "/", type: FormatTokenType.operator };
                    }
                case 9:
                    switch (c) {
                        case "/":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "*/", type: FormatTokenType.commentRight };
                        case "=":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "*=", type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: "*", type: FormatTokenType.operator };
                    }
                case 10:
                    switch (c) {
                        case val:
                        case "=":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: val, type: FormatTokenType.operator };
                    }
                case 11:// -- -= ->
                    switch (c) {
                        case "-":
                        case "=":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        case ">":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: "->", type: FormatTokenType.operatorMethod };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: "-", type: FormatTokenType.operator };
                    }
                case 12:
                    switch (c) {
                        case "=":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: val, type: FormatTokenType.operator };
                    }
                case 13:
                    switch (c) {
                        case "=":
                            state = 0;
                            this.$position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: val, type: FormatTokenType.operatorNot };
                    }
                case 14:
                    switch (c) {
                        case ".":
                            val += c;
                            this.$position = idx + 1;
                            if (val.length === 3) {
                                state = 0;
                                return { value: val, type: FormatTokenType.flatten };
                            }
                            break;
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: val, type: FormatTokenType.unknown };
                    }
                    break;
                default:
                    switch (c) {
                        case '(':
                            if (val.length > 0) return this.typetoken(val);
                            state = 1;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: "(", type: FormatTokenType.parenLparen };
                            }
                            break;
                        case ')':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            return { value: ")", type: FormatTokenType.parenRparen };
                        case '{':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            return { value: '{', type: FormatTokenType.parenLbrace };
                        case '}':
                            if (val.length > 0) return this.typetoken(val);
                            state = 2;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: "}", type: FormatTokenType.parenRbrace };
                            }
                            break;
                        case ':':
                            if (val.length > 0) return this.typetoken(val);
                            state = 7;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: ":", type: FormatTokenType.operator };
                            }
                            break;
                        case '/':
                            if (val.length > 0) return this.typetoken(val);
                            state = 8;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: "/", type: FormatTokenType.operator };
                            }
                            break;
                        case '*':
                            if (val.length > 0) return this.typetoken(val);
                            state = 9;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: "*", type: FormatTokenType.operator };
                            }
                            break;
                        case '[':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            this.b.push('[');
                            return { value: '[', type: FormatTokenType.parenLbracket };
                        case ']':
                            if (val.length > 0) return this.typetoken(val);
                            state = 3;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                this.b.pop();
                                return { value: "]", type: FormatTokenType.parenRbracket };
                            }
                            break;
                        case '"':
                            if (val.length > 0) return this.typetoken(val);
                            state = 4;
                            val = "\"";
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: "\"", type: FormatTokenType.text };
                            }
                            break;
                        case '\r':
                            this.$position = idx + 1;
                            break;
                        case '\n':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            return { value: '\n', type: FormatTokenType.newline };
                        case ' ':
                        case '\t':
                            if (val.length > 0) return this.typetoken(val);
                            val += c;
                            this.$position = idx + 1;
                            state = 6;
                            break;
                        case '#':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.precompiler };
                        case '&': //&& &=
                        case '|': // || |=
                        case '+': // ++ +=
                        case '<': // << <=
                        case '>': // >> >=
                            if (val.length > 0) return this.typetoken(val);
                            state = 10;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.operator };
                            }
                            break;
                        case '-':// -- -= ->
                            if (val.length > 0) return this.typetoken(val);
                            state = 11;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.operator };
                            }
                            break;
                        case '=':// ==
                        case '%':// %=
                            if (val.length > 0) return this.typetoken(val);
                            state = 12;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.operator };
                            }
                            break;
                        case '!':// !=
                            if (val.length > 0) return this.typetoken(val);
                            state = 13;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.operatorNot };
                            }
                            break;
                        case '.'://...
                            if (val.length > 0) return this.typetoken(val);

                            state = 14;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.unknown };
                            }
                            break;
                        case '?':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.operator };
                        case ';':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.semicolon };
                        case '\\':
                        case '\'':
                        case '~':
                        case '.':
                        case '^':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.text };
                        case ',':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.comma };
                        case '@':
                            if (val.length > 0) return this.typetoken(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.stringblock };
                        default:
                            if (c === "_" || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
                                val += c;
                                this.$position = idx + 1;
                            }
                            else {
                                if (val.length > 0) return this.typetoken(val);
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.unknown };
                            }
                            break;
                    }
                    break;
            }
        }
        if (idx >= len && val.length === 0)
            return null;
        if (state === 6)
            return { value: val, type: FormatTokenType.whitespace };
        return this.typetoken(val);
    }

    private tokenize() {
        var token: FormatToken = this.getToken();
        var t = [];
        while (token) {
            t.push(token);
            if (token.type === FormatTokenType.newline) {
                this.tokens.push(t);
                t = [];
            }
            token = this.getToken();
        }
        if (t.length)
            this.tokens.push(t);
    }
}
