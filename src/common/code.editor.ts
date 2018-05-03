import EventEmitter = require('events');
import { existsSync, formatSize, capitalize } from './library';
const { clipboard } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

declare let ace;

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
    private $indenter: lpcIndenter;
    private $annotations = [];

    constructor(options?: EditorOptions) {
        super(options);
        this.$indenter = new lpcIndenter();
        this.$indenter.on('error', (e) => {
            this.$editor.setReadOnly(false);
            this.$annotations.push({
                row: e.line, column: e.col, text: e.message, type: "error"
            });
            if (this.$annotations.length > 0)
                this.$session.setAnnotations(this.$annotations);
            this.emit('error', e);
        });
        this.$indenter.on('progress', (p) => {
            this.emit('progress', p);
        });
        this.$indenter.on('complete', (lines) => {
            var Range = ace.require('ace/range').Range;
            this.$session.replace(new Range(0, 0, this.$session.getLength(), Number.MAX_VALUE), lines.join('\n'));
            this.$editor.setReadOnly(false);
            this.emit('progress-complete');
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
                    },
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
                setTimeout(function () { this.indentLines(lines, ln, chunk); }, 5);
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

export class lpcFormatter extends EventEmitter {

}
