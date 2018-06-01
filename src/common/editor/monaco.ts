/// <reference path="../../../node_modules/monaco-editor/monaco.d.ts" />
import { EditorBase, EditorOptions, FileState } from './editor.base';
import { conf, language, loadCompletion, LPCIndenter, LPCFormatter } from './lpc';
import { existsSync, formatSize, capitalize, inverse } from './../library';
const { clipboard, ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');

interface LoadMonacoOptions {
    baseUrl?: string;
}

declare global {
    interface Window {
        $editor: monaco.editor.IStandaloneCodeEditor;
    }
}

//based on monaco-loader(https://github.com/felixrieseberg/monaco-loader), inlined to reduce load times
export function loadMonaco(options: LoadMonacoOptions = {}) {
    return new Promise((resolve, reject) => {
        const monacoDir = path.join(__dirname, '..', '..', '..', 'node_modules', 'monaco-editor');
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
                resolve(monaco);
            } else {
                reject('Monaco loaded, but could not find global "monaco"');
            }
        });
    });
}

export function SetupEditor() {
    return new Promise((resolve, reject) => {
        loadMonaco().then(() => {
            monaco.languages.register({
                id: 'lpc',
                extensions: ['.c', '.h'],
                aliases: ['LPC', 'LPc']
            });
            monaco.languages.onLanguage('lpc', () => {
                monaco.languages.setMonarchTokensProvider('lpc', language);
                monaco.languages.setLanguageConfiguration('lpc', conf);
                monaco.languages.registerCompletionItemProvider('lpc', {
                    provideCompletionItems: (model, position) => {
                        return loadCompletion();
                    }
                });
            });
            monaco.editor.defineTheme('lpcTheme', <monaco.editor.IStandaloneThemeData>{
                base: 'vs',
                inherit: true,
                rules: [
                    { token: 'keyword.directive.include', foreground: '008000', fontStyle: 'bold' },
                    { token: 'keyword.directive', foreground: '008000', fontStyle: 'bold' },
                    { token: 'parent', foreground: 'fdd835', fontStyle: 'bold' },
                    { token: 'parent.function', foreground: 'fdd835', fontStyle: '' },
                    { token: 'sefuns', foreground: '008080', fontStyle: 'bold' },
                    { token: 'efuns', foreground: '008080' },
                    { token: 'abbr', foreground: '008000', fontStyle: 'bold' },
                    { token: 'datatype', foreground: 'ff0000' },
                    { token: 'constant', foreground: 'ff0000', fontStyle: 'bold' },
                    { token: 'applies', foreground: 'C45AEC', fontStyle: 'bold' }
                ],
                colors: {
                    'editorGutter.background': '#f5f5f5'
                }
            });
            monaco.languages.registerDocumentFormattingEditProvider('lpc', {
                provideDocumentFormattingEdits(model, options, token): Promise<monaco.languages.TextEdit[]> {
                    const $indenter = new LPCIndenter();
                    $indenter.on('error', (e) => {
                        reject(e);
                    });
                    const $formatter = new LPCFormatter();
                    const code = $formatter.format(model.getValue());
                    return new Promise<monaco.languages.TextEdit[]>((resolve2, reject2) => {
                        $indenter.on('complete', (lines) => {
                            resolve2([{
                                range: {
                                    startLineNumber: 1,
                                    startColumn: 1,
                                    endColumn: model.getLineMaxColumn(model.getLineCount()),
                                    endLineNumber: model.getLineCount()
                                },
                                text: lines.join('\n')
                            }]);
                        });
                        $indenter.indent(code);
                    });
                }
            });

            resolve(monaco);
        });
    });
}

/*
borrowed from vscode replace command system to make it easier
*/
export class ReplaceCommandThatPreservesSelection implements monaco.editor.ICommand {

    private _range: monaco.Range;
    private _text: string;
    private _initialSelection: monaco.Selection;
    private _selectionId: string;

    constructor(editRange: monaco.Range, text: string, initialSelection: monaco.Selection) {
        this._range = editRange;
        this._text = text;
        this._initialSelection = initialSelection;
    }

    public getEditOperations(model: monaco.editor.ITextModel, builder: monaco.editor.IEditOperationBuilder): void {
        builder.addEditOperation(this._range, this._text);
        this._selectionId = builder.trackSelection(this._initialSelection);
    }

    public computeCursorState(model: monaco.editor.ITextModel, helper: monaco.editor.ICursorStateComputerData): monaco.Selection {
        return helper.getTrackedSelection(this._selectionId);
    }
}

export class ReplaceCommand implements monaco.editor.ICommand {

    private readonly _range: monaco.Range;
    private readonly _text: string;
    public readonly insertsAutoWhitespace: boolean;

    constructor(range: monaco.Range, text: string, insertsAutoWhitespace: boolean = false) {
        this._range = range;
        this._text = text;
        this.insertsAutoWhitespace = insertsAutoWhitespace;
    }

    public getEditOperations(model: monaco.editor.ITextModel, builder: monaco.editor.IEditOperationBuilder): void {
        builder.addTrackedEditOperation(this._range, this._text);
    }

    public computeCursorState(model: monaco.editor.ITextModel, helper: monaco.editor.ICursorStateComputerData): monaco.Selection {
        const inverseEditOperations = helper.getInverseEditOperations();
        const srcRange = inverseEditOperations[0].range;
        return new monaco.Selection(
            srcRange.endLineNumber,
            srcRange.endColumn,
            srcRange.endLineNumber,
            srcRange.endColumn
        );
    }
}

export class MonacoCodeEditor extends EditorBase {
    private $el: HTMLElement;
    private $editor: monaco.editor.IStandaloneCodeEditor;
    private $model: monaco.editor.ITextModel;
    private $saving = false;
    private $state;
    private $startValue = '';

    constructor(options?: EditorOptions) {
        super(options);
        if (options.value) {
            this.$startValue = options.value || '';
            this.$model.setValue(options.value);
            this.changed = false;
        }
        if (options.options)
            this.options = options.options;
        else
            this.options = {
                tabSize: 3,
                insertSpaces: true,
                trimAutoWhitespace: true
            };
    }

    public createControl() {
        //TODO tooltip show folded code
        this.$model = monaco.editor.createModel('', 'lpc');
        this.$model.onDidChangeContent((e) => {
            this.changed = true;
            this.emit('changed', this.$model.getValueLength());
        });

        setTimeout(() => {
            this.resize();
        }, 100);
        this.emit('created');
    }

    get file(): string {
        return super.file;
    }
    set file(value: string) {
        if (this.file !== value) {
            super.file = value;
            const ext = path.extname(this.file);
            switch (ext) {
                case '.c':
                case '.h':
                    //monaco.editor.setModelLanguage(this.$model, 'lpc');
                    break;
                default:
                    const found = monaco.languages.getLanguages().filter(l => { return l.extensions.indexOf(ext) !== -1; });
                    if (found.length > 0)
                        monaco.editor.setModelLanguage(this.$model, found.slice(-1)[0].id);
                    else
                        monaco.editor.setModelLanguage(this.$model, 'plaintext');
                    break;
            }

        }
    }

    public refresh() { this.emit('refreshed'); }

    public open() {
        if (!this.file || this.file.length === 0 || !existsSync(this.file) || this.new)
            return;
        this.$model.setValue(this.read());
        this.emit('opened');
        this.state |= FileState.opened;
        this.changed = false;
    }

    public save() {
        this.$saving = true;
        this.write(this.$model.getValue(monaco.editor.EndOfLinePreference.LF));
        this.changed = false;
        this.new = false;
        this.emit('saved');
    }

    public canSaveAs() { return true; }

    public deleted(keep) {
        if (keep)
            this.changed = keep;
    }

    public revert() {
        if (!this.new)
            this.open();
        else {
            this.$model.setValue(this.$startValue);
        }
        this.changed = false;
        this.emit('reverted');
    }

    public get selected() {
        if (!this.$editor) return '';
        const s = this.$editor.getSelection();
        if (!s) return '';
        return this.$model.getValueInRange(s) || '';
    }
    public selectAll() {
        if (!this.$editor) return;
        this.$editor.setSelection({
            startLineNumber: 1,
            startColumn: 1,
            endColumn: this.$model.getLineMaxColumn(this.$model.getLineCount()),
            endLineNumber: this.$model.getLineCount()
        });
    }
    public cut() {
        if (!this.$editor) return;
        this.$editor.getAction('editor.action.clipboardCutAction').run();
    }
    public copy() {
        if (!this.$editor) return;
        this.$editor.getAction('editor.action.clipboardCopyAction').run();
    }
    public paste() {
        if (!this.$editor) return;
        this.$editor.getAction('editor.action.clipboardPasteAction').run();
    }
    public delete() { /**/ }
    public undo() {
        if (!this.$editor) return;
        this.$editor.trigger('', 'undo', null);
    }
    public redo() {
        if (!this.$editor) return;
        this.$editor.trigger('', 'redo', null);
    }
    public close() {
        if (this.file && this.file.length > 0 && !this.new)
            this.emit('watch-stop', [this.file]);
    }
    public watch(action: string, file: string, details?) {
        if (file !== this.file || this.new)
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
    public set spellcheck(value: boolean) { /**/ }
    public find() {
        if (!this.$editor) return;
        this.$editor.getAction('actions.find').run();
    }
    public replace() {
        if (!this.$editor) return;
        this.$editor.getAction('editor.action.startFindReplaceAction').run();
    }
    public supports(what) {
        switch (what) {
            case 'cut':
            case 'copy':
            case 'delete':
            case 'pasteadvanced':
            case 'pasted-advanced':
                return this.selected.length > 0;
            case 'undo':
            case 'redo':
            case 'indent':
            case 'paste':
            case 'find':
            case 'replace':
            case 'select-all':
            case 'selectall':
            case 'menu|edit':
            case 'menu|context':
            case 'menu|view':
                return true;
        }
        return false;
    }
    public focus(): void {
        if (!this.$editor) return;
        this.$editor.focus();
    }
    public resize() {
        if (!this.$editor) return;
        this.$editor.layout();
    }
    public set options(value) {
        if (!value)
            return;
        this.$model.updateOptions({
            tabSize: value.hasOwnProperty('tabSize') ? value.tabSize : 3,
            insertSpaces: value.hasOwnProperty('tabSize') ? value.insertSpaces : true,
            trimAutoWhitespace: value.hasOwnProperty('tabSize') ? value.trimAutoWhitespace : true
        });
    }
    public get options() { return null; }
    public get type() {
        return 1;
    }

    public menu(menu) {
        if (menu === 'edit') {
            const selected = this.selected.length > 0;
            return [
                {
                    label: 'Formatting',
                    submenu: [
                        {
                            label: 'Insert Color...',
                            click: () => {
                                ipcRenderer.send('show-window', 'color', { type: this.file.replace(/[/|\\:]/g, ''), color: '', window: 'code-editor' });
                                const setcolor = (event, type, color, code, window) => {
                                    if (window !== 'code-editor' || type !== this.file.replace(/[/|\\:]/g, ''))
                                        return;
                                    this.insert('%^' + code.replace(/ /g, '%^%^') + '%^');
                                    ipcRenderer.removeListener('set-color', setcolor);
                                };
                                ipcRenderer.on('set-color', setcolor);
                            }
                        },
                        { type: 'separator' },
                        {
                            label: 'To Upper Case',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('editor.action.transformToUppercase').run();
                            }
                        },
                        {
                            label: 'To Lower Case',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('editor.action.transformToLowercase').run();
                            }
                        },
                        {
                            label: 'Capitalize',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('jimud.action.transformToCapitalize').run();
                            }
                        },
                        {
                            label: 'Inverse Case',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('jimud.action.transformToInverse').run();
                            }
                        },
                        { type: 'separator' },
                        {
                            label: 'Line Comment',
                            accelerator: 'CmdOrCtrl+/',
                            click: () => {
                                this.$editor.getAction('editor.action.commentLine').run();
                            }
                        },
                        {
                            label: 'Block Comment',
                            accelerator: 'Alt+Shift+A',
                            click: () => {
                                this.$editor.getAction('editor.action.blockComment').run();
                            }
                        },
                        { type: 'separator' },
                        {
                            label: 'Format Document',
                            accelerator: 'Alt+Shift+F',
                            click: () => {
                                this.$editor.getAction('editor.action.formatDocument').run();
                            }
                        }
                    ]
                }
            ];
        }
        else if (menu === 'context') {
            const selected = this.selected.length > 0;
            return [
                {
                    label: 'Formatting',
                    submenu: [
                        {
                            label: 'Insert Color...',
                            click: () => {
                                ipcRenderer.send('show-window', 'color', { type: this.file.replace(/[/|\\:]/g, ''), color: '', window: 'code-editor' });
                                const setcolor = (event, type, color, code, window) => {
                                    if (window !== 'code-editor' || type !== this.file.replace(/[/|\\:]/g, ''))
                                        return;
                                    this.insert('%^' + code.replace(/ /g, '%^%^') + '%^');
                                    ipcRenderer.removeListener('set-color', setcolor);
                                };
                                ipcRenderer.on('set-color', setcolor);
                            }
                        },
                        { type: 'separator' },
                        {
                            label: 'To Upper Case',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('editor.action.transformToUppercase').run();
                            }
                        },
                        {
                            label: 'To Lower Case',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('editor.action.transformToLowercase').run();
                            }
                        },
                        {
                            label: 'Capitalize',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('jimud.action.transformToCapitalize').run();
                            }
                        },
                        {
                            label: 'Inverse Case',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('jimud.action.transformToInverse').run();
                            }
                        },
                        { type: 'separator' },
                        {
                            label: 'Line Comment',
                            accelerator: 'CmdOrCtrl+/',
                            click: () => {
                                this.$editor.getAction('editor.action.commentLine').run();
                            }
                        },
                        {
                            label: 'Block Comment',
                            accelerator: 'Alt+Shift+A',
                            click: () => {
                                this.$editor.getAction('editor.action.blockComment').run();
                            }
                        },
                        { type: 'separator' },
                        {
                            label: 'Format Document',
                            accelerator: 'Alt+Shift+F',
                            click: () => {
                                this.$editor.getAction('editor.action.formatDocument').run();
                            }
                        }
                    ]
                },
                {
                    label: 'Folding',
                    submenu: [
                        {
                            label: 'Expand All',
                            accelerator: 'CmdOrCtrl+>',
                            click: () => {
                                this.$editor.getAction('editor.unfoldAll').run();
                            }
                        },
                        {
                            label: 'Collapse All',
                            accelerator: 'CmdOrCtrl+<',
                            click: () => {
                                this.$editor.getAction('editor.foldAll').run();
                            }
                        }
                    ]
                }
            ];
        }
        else if (menu === 'view')
            return [
                {
                    label: 'Toggle Word Wrap',
                    accelerator: 'Alt+Z',
                    click: () => {
                        this.$editor.updateOptions({ wordWrap: (this.$editor.getConfiguration().wrappingInfo.isViewportWrapping ? 'off' : 'on') });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Folding',
                    submenu: [
                        {
                            label: 'Expand All',
                            accelerator: 'CmdOrCtrl+>',
                            click: () => {
                                this.$editor.getAction('editor.unfoldAll').run();
                            }
                        },
                        {
                            label: 'Collapse All',
                            accelerator: 'CmdOrCtrl+<',
                            click: () => {
                                this.$editor.getAction('editor.foldAll').run();
                            }
                        }
                    ]
                }
            ];
    }

    public insert(text) {
        const selections = this.$editor.getSelections();
        const commands: monaco.editor.ICommand[] = [];
        const len = selections.length;
        for (let i = 0; i < len; i++) {
            const selection = selections[i];
            if (selection.isEmpty()) {
                const cursor = selection.getStartPosition();
                commands.push(new ReplaceCommand(new monaco.Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column), text));
            } else {
                commands.push(new ReplaceCommand(selection, text));
            }
        }
        this.$editor.pushUndoStop();
        this.$editor.executeCommands('jiMUD.action.insert', commands);
        this.$editor.pushUndoStop();
    }

    public get location() {
        if (!this.$editor || !this.$editor.getPosition())
            return [0, 0];
        return [this.$editor.getPosition().column, this.$editor.getPosition().lineNumber];
    }
    public get length() { return this.$model.getValueLength(); }
    public selectionChanged(e) {
        this.emit('selection-changed');
        const selected = this.selected.length > 0;
        this.emit('menu-update', 'edit|formatting|to upper case', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|to lower case', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|capitalize', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|inverse case', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|line comment', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|block comment', { enabled: selected });
    }

    public activate(editor) {
        this.$editor = editor;
        editor.setModel(this.$model);
        editor.restoreViewState(this.$state);
    }
    public deactivate(editor) {
        this.$editor = null;
        this.$state = editor.saveViewState();
        editor.setModel(null);
    }
}
