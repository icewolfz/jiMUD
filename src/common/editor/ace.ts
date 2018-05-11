import { EditorBase, EditorOptions, FileState } from './editor.base';
import { lpcIndenter, lpcFormatter } from './lpc';
import { existsSync, formatSize, capitalize, inverse } from './../library';
const { clipboard, ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');

declare let ace;

export class AceCodeEditor extends EditorBase {
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
        this.$sbMsg.id = this.parent.id + '-status-message';
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

    public insert(text) { }
}
