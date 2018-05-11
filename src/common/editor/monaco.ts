/// <reference path="../../../node_modules/monaco-editor/monaco.d.ts" />
import { EditorBase, EditorOptions, FileState } from './editor.base';
import { conf, language, loadCompletion, lpcIndenter, lpcFormatter } from './lpc';
import { existsSync, formatSize, capitalize, inverse } from './../library';
const { clipboard, ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');

interface loadMonacoOptions {
    baseUrl?: string
}

//based on monaco-loader(https://github.com/felixrieseberg/monaco-loader), inlined to reduce load times
export function loadMonaco(options: loadMonacoOptions = {}) {
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
                resolve(monaco)
            } else {
                reject('Monaco loaded, but could not find global "monaco"')
            }
        })
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
                    provideCompletionItems: function (model, position) {
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
                    { token: 'applies', foreground: 'C45AEC', fontStyle: 'bold' },
                ],
                colors: {
                    'editorGutter.background': '#f5f5f5'
                }
            });
            monaco.languages.registerDocumentFormattingEditProvider('lpc', {
                provideDocumentFormattingEdits(model, options, token): Promise<monaco.languages.TextEdit[]> {
                    var $indenter = new lpcIndenter();
                    $indenter.on('error', (e) => {
                        reject(e);
                    });
                    var $formatter = new lpcFormatter();
                    var code = $formatter.format(model.getValue());
                    return new Promise<monaco.languages.TextEdit[]>((resolve, reject) => {
                        $indenter.on('complete', (lines) => {
                            resolve([{
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
class ReplaceCommandThatPreservesSelection implements monaco.editor.ICommand {

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

class ReplaceCommand implements monaco.editor.ICommand {

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
        let inverseEditOperations = helper.getInverseEditOperations();
        let srcRange = inverseEditOperations[0].range;
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

    constructor(options?: EditorOptions) {
        super(options);
        if (options.value) {
            this.$editor.setValue(options.value);
            this.changed = false;
        }
    }

    public createControl() {

        //TODO tooltip show folded code
        this.$el = document.createElement('div');
        this.$el.id = this.parent.id + '-editor';
        this.$el.classList.add('editor');
        this.parent.appendChild(this.$el);
        this.$editor = monaco.editor.create(this.$el, {
            language: 'lpc',
            autoIndent: true,
            scrollBeyondLastLine: false,
            rulers: [80],
            contextmenu: false,
            theme: 'lpcTheme'
        });

        this.$editor.addAction({
            id: 'jimud.action.transformToInverse',
            label: 'Transform to Inverse',
            run: function (editor: monaco.editor.IStandaloneCodeEditor) {
                let selections = editor.getSelections();
                let model = editor.getModel();
                let commands: monaco.editor.ICommand[] = [];

                for (let i = 0, len = selections.length; i < len; i++) {
                    let selection = selections[i];
                    if (selection.isEmpty()) {
                        let cursor = selection.getStartPosition();
                        let word = model.getWordAtPosition(cursor);
                        if (!word) {
                            continue;
                        }

                        let wordRange = new monaco.Range(cursor.lineNumber, word.startColumn, cursor.lineNumber, word.endColumn);
                        let text = model.getValueInRange(wordRange);
                        commands.push(new ReplaceCommandThatPreservesSelection(wordRange, inverse(text), new monaco.Selection(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column)));

                    } else {
                        let text = model.getValueInRange(selection);
                        commands.push(new ReplaceCommandThatPreservesSelection(selection, inverse(text), selection));
                    }
                }
                editor.pushUndoStop();
                editor.executeCommands(this.id, commands);
                editor.pushUndoStop();
            }
        });

        this.$editor.addAction({
            id: 'jimud.action.transformToCapitalize',
            label: 'Transform to Capitalize',
            run: function (editor: monaco.editor.IStandaloneCodeEditor) {
                let selections = editor.getSelections();
                let model = editor.getModel();
                let commands: monaco.editor.ICommand[] = [];

                for (let i = 0, len = selections.length; i < len; i++) {
                    let selection = selections[i];
                    if (selection.isEmpty()) {
                        let cursor = selection.getStartPosition();
                        let word = model.getWordAtPosition(cursor);
                        if (!word) {
                            continue;
                        }

                        let wordRange = new monaco.Range(cursor.lineNumber, word.startColumn, cursor.lineNumber, word.endColumn);
                        let text = model.getValueInRange(wordRange);
                        commands.push(new ReplaceCommandThatPreservesSelection(wordRange, capitalize(text), new monaco.Selection(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column)));

                    } else {
                        let text = model.getValueInRange(selection);
                        commands.push(new ReplaceCommandThatPreservesSelection(selection, capitalize(text), selection));
                    }
                }
                editor.pushUndoStop();
                editor.executeCommands(this.id, commands);
                editor.pushUndoStop();
            }
        });

        this.$editor.addAction({
            id: 'jimud.action.insertColor',
            label: 'Transform to Capitalize',
            run: function (editor: monaco.editor.IStandaloneCodeEditor) {
                let selections = editor.getSelections();
                let model = editor.getModel();
                let commands: monaco.editor.ICommand[] = [];

                for (let i = 0, len = selections.length; i < len; i++) {
                    let selection = selections[i];
                    if (selection.isEmpty()) {
                        let cursor = selection.getStartPosition();
                        let word = model.getWordAtPosition(cursor);
                        if (!word) {
                            continue;
                        }

                        let wordRange = new monaco.Range(cursor.lineNumber, word.startColumn, cursor.lineNumber, word.endColumn);
                        let text = model.getValueInRange(wordRange);
                        commands.push(new ReplaceCommandThatPreservesSelection(wordRange, capitalize(text), new monaco.Selection(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column)));

                    } else {
                        let text = model.getValueInRange(selection);
                        commands.push(new ReplaceCommandThatPreservesSelection(selection, capitalize(text), selection));
                    }
                }
                editor.pushUndoStop();
                editor.executeCommands(this.id, commands);
                editor.pushUndoStop();
            }
        });

        this.$editor.onContextMenu((e) => {
            this.emit('contextmenu', e);
        });
        this.$editor.onDidChangeCursorSelection((e) => {
            this.emit('selection-changed');
            let selected = this.selected.length > 0;
            this.emit('menu-update', 'edit|formatting|to upper case', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|to lower case', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|capitalize', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|inverse case', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|line comment', { enabled: selected });
            this.emit('menu-update', 'edit|formatting|block comment', { enabled: selected });
        });
        this.$editor.onDidChangeCursorPosition((e) => {
            this.emit('location-changed', e.position.column, e.position.lineNumber);
        });
        this.$model = this.$editor.getModel();
        this.$model.updateOptions({
            tabSize: 3,
            insertSpaces: true
        });
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
        if (this.file != value) {
            super.file = value;
            var ext = path.extname(this.file);
            switch (ext) {
                case '.c':
                case '.h':
                    //monaco.editor.setModelLanguage(this.$model, 'lpc');
                    break;
                default:
                    var found = monaco.languages.getLanguages().filter(l => { return l.extensions.indexOf(ext) !== -1 });
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
        this.$editor.setValue(this.read());
        this.emit('opened');
        this.state |= FileState.opened;
        this.changed = false;
    }

    public save() {
        this.$saving = true;
        this.write(this.$model.getValue());
        this.changed = false;
        this.new = false;
        this.emit('saved');
    }

    public revert() {
        if (!this.new)
            this.open();
        else {
            this.$model.setValue('');
        }
        this.changed = false;
        this.emit('reverted');
    }

    public get selected() { return this.$model.getValueInRange(this.$editor.getSelection()) || ''; }
    public selectAll() {
        this.$editor.setSelection({
            startLineNumber: 1,
            startColumn: 1,
            endColumn: this.$model.getLineMaxColumn(this.$model.getLineCount()),
            endLineNumber: this.$model.getLineCount()
        });
    };
    public cut() { this.$editor.getAction('editor.action.clipboardCutAction').run(); }
    public copy() { this.$editor.getAction('editor.action.clipboardCopyAction').run(); }
    public paste() { this.$editor.getAction('editor.action.clipboardPasteAction').run(); }
    public delete() { }
    public undo() { this.$editor.trigger('', 'undo', null); }
    public redo() { this.$editor.trigger('', 'redo', null); }
    public close() {
        if (this.file && this.file.length > 0 && !this.new)
            this.emit('watch-stop', [this.file]);
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
    public set spellcheck(value: boolean) { };
    public find() { this.$editor.getAction('actions.find').run(); }
    public replace() { this.$editor.getAction('editor.action.startFindReplaceAction').run(); }
    public supports(what) {
        switch (what) {
            case 'cut':
            case 'copy':
            case 'delete':
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
    public focus(): void { this.$editor.focus(); }
    public resize() {
        this.$editor.layout();
    }
    public set options(value) { }
    public get options() { return null; }
    public get type() {
        return 1;
    }

    public menu(menu) {
        if (menu === 'edit' || menu === 'context') {
            var selected = this.selected.length > 0;
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
                                    this.insert('%^' + code.replace(/ /g, '%^%^') + '%^');
                                    ipcRenderer.removeListener('set-color', setcolor);
                                }
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
                        },
                    ]
                },
                {
                    label: 'Folding',
                    submenu: [
                        {
                            label: 'Expand All',
                            accelerator: "CmdOrCtrl+>",
                            click: () => {
                                this.$editor.getAction('editor.unfoldAll').run();
                            }
                        },
                        {
                            label: 'Collapse All',
                            accelerator: "CmdOrCtrl+<",
                            click: () => {
                                this.$editor.getAction('editor.foldAll').run();
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
                        this.$editor.updateOptions({ wordWrap: (this.$editor.getConfiguration().wrappingInfo.isViewportWrapping ? 'off' : 'on') });
                    },
                }
            ]
    }

    public insert(text) {
        let selections = this.$editor.getSelections();
        let commands: monaco.editor.ICommand[] = [];
        for (let i = 0, len = selections.length; i < len; i++) {
            let selection = selections[i];
            if (selection.isEmpty()) {
                let cursor = selection.getStartPosition();
                commands.push(new ReplaceCommand(new monaco.Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column), text));
            } else {
                commands.push(new ReplaceCommand(selection, text));
            }
        }
        this.$editor.pushUndoStop();
        this.$editor.executeCommands('jiMUD.action.insert', commands);
        this.$editor.pushUndoStop();
    }

    public get location() { return [this.$editor.getPosition().column, this.$editor.getPosition().lineNumber]; }
    public get length() { return this.$model.getValueLength(); }
    public selectionChanged(e) {
        this.emit('selection-changed');
        let selected = this.selected.length > 0;
        this.emit('menu-update', 'edit|formatting|to upper case', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|to lower case', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|capitalize', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|inverse case', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|line comment', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|block comment', { enabled: selected });
    }
}
