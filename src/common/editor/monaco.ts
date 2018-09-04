/// <reference path="../../../node_modules/monaco-editor/monaco.d.ts" />
import { EditorBase, EditorOptions, FileState, Source } from './editor.base';
import { conf, language, loadCompletion, LPCIndenter, LPCFormatter } from './lpc';
import { existsSync, isDirSync, parseTemplate } from '../library';
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

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

let $lpcCompletionCache;
let $lpcIndenter;
let $lpcFormatter;
let $lpcDefineCache;

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
                        if ($lpcCompletionCache) return $lpcCompletionCache;
                        return ($lpcCompletionCache = loadCompletion());
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
            monaco.editor.defineTheme('lpcThemeDark', <monaco.editor.IStandaloneThemeData>{
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'keyword.directive.include', foreground: '608b4e', fontStyle: 'bold' },
                    { token: 'keyword.directive', foreground: '608b4e', fontStyle: 'bold' },
                    { token: 'parent', foreground: 'c3a624', fontStyle: 'bold' },
                    { token: 'parent.function', foreground: 'c3a624', fontStyle: '' },
                    { token: 'sefuns', foreground: '008080', fontStyle: 'bold' },
                    { token: 'efuns', foreground: '008080' },
                    { token: 'abbr', foreground: '608b4e', fontStyle: 'bold' },
                    { token: 'datatype', foreground: 'bb0000' },
                    { token: 'constant', foreground: 'bb0000', fontStyle: 'bold' },
                    { token: 'applies', foreground: '9655af', fontStyle: 'bold' }
                ],
                colors: {
                    'editorGutter.background': '#000'
                }
            });
            monaco.languages.registerDocumentFormattingEditProvider('lpc', {
                provideDocumentFormattingEdits(model, options, token): Promise<monaco.languages.TextEdit[]> {
                    return new Promise<monaco.languages.TextEdit[]>((resolve2, reject2) => {
                        const $formatter = $lpcFormatter || ($lpcFormatter = new LPCFormatter());
                        const code = $formatter.format(model.getValue());
                        const $indenter = $lpcIndenter || ($lpcIndenter = new LPCIndenter());
                        $indenter.on('error', (e) => {
                            //reject2(e);
                            model.pushStackElement();
                            model.pushEditOperations([], [{
                                range: new monaco.Range(1, 1, model.getLineCount(), model.getLineMaxColumn(model.getLineCount())),
                                text: code
                            }], () => []);
                            model.pushStackElement();
                            model.deltaDecorations(model.getAllDecorations(null, true).filter(f => f.options.marginClassName === 'line-error-margin' || f.options.marginClassName === 'line-warning-margin').map(f => f.id), [{
                                range: new monaco.Range(e.line + 1, e.col + 1, e.line + 1, e.col + 1),
                                options: {
                                    stickiness: 1,
                                    isWholeLine: true,
                                    //className: 'line-error-content',
                                    //glyphMarginHoverMessage: { value: e.message },
                                    //glyphMarginClassName: 'line-error-glyph',
                                    marginClassName: 'line-error-margin',
                                    zIndex: 1
                                }
                            }]);
                            monaco.editor.setModelMarkers(model, '', [
                                {
                                    startColumn: e.col + 1,
                                    startLineNumber: e.line + 1,
                                    endColumn: e.col + 1,
                                    endLineNumber: e.line + 1,
                                    message: e.message,
                                    severity: 8
                                }
                            ]);
                        });
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
            //https://github.com/Microsoft/monaco-editor/issues/852
            //https://github.com/Microsoft/monaco-editor/issues/935
            monaco.languages.registerDefinitionProvider('lpc', {
                async provideDefinition(model: monaco.editor.ITextModel, position: monaco.Position, token: monaco.CancellationToken): Promise<monaco.languages.DefinitionLink[] | monaco.languages.Definition | undefined> {
                    if (!model) return undefined;
                    if (!$lpcDefineCache) $lpcDefineCache = {};
                    const defines = [];
                    //monaco.Uri.file()
                    const resource = model.uri;
                    let word: any = model.getWordAtPosition(position);
                    if (word)
                        word = word.word;
                    const value = model.getValue();
                    const root = path.dirname(resource.fsPath);
                    const def = /^#define ([_a-zA-Z0-9]+)[ |\(].*$/gm;
                    let dValue;
                    if (isDirSync(root)) {
                        //const p = path.dirname((<any>model).file);
                        const reg = /^#include "(.*)"$/gm;
                        let result = reg.exec(value);
                        while (result !== null) {
                            if (result.index === reg.lastIndex) {
                                reg.lastIndex++;
                            }
                            const f = path.join(root, result[1]);
                            if (existsSync(f)) {
                                if (!$lpcDefineCache[f]) {
                                    $lpcDefineCache[f] = {};
                                    dValue = fs.readFileSync(f, 'utf8').split('\n');
                                    dValue.forEach((l, i) => {
                                        let results2 = def.exec(l);
                                        while (results2 !== null) {
                                            if (results2.index === def.lastIndex) {
                                                def.lastIndex++;
                                            }
                                            $lpcDefineCache[f][results2[1]] = {
                                                uri: monaco.Uri.file(f),
                                                range: new monaco.Range(i + 1, 9, i + 1, 9 + results2[1].length)
                                            };
                                            defines[results2[1]] = $lpcDefineCache[f][results2[1]];
                                            results2 = def.exec(l);
                                        }
                                    });
                                } else {
                                    Object.keys($lpcDefineCache[f]).forEach(k => {
                                        defines[k] = $lpcDefineCache[f][k];
                                    });
                                }
                            }
                            result = reg.exec(value);
                        }
                    }
                    dValue = value.split('\n');
                    dValue.forEach((l, i) => {
                        let results2 = def.exec(l);
                        while (results2 !== null) {
                            if (results2.index === def.lastIndex) {
                                def.lastIndex++;
                            }
                            defines[results2[1]] = {
                                uri: model.uri,
                                range: new monaco.Range(i + 1, results2.index + 1, i + 1, results2.index + 1)
                            };
                            results2 = def.exec(l);
                        }
                    });
                    if (defines[word])
                        return defines[word];
                    return undefined;
                }
            });

            monaco.languages.registerHoverProvider('lpc', {
                provideHover: async (model, position): Promise<monaco.languages.Hover> => {
                    if (!model)
                        return undefined;
                    let word: any = model.getWordAtPosition(position);
                    if (!word)
                        return undefined;
                    const p = parseTemplate(path.join('{assets}', 'editor', 'docs'));
                    word = word.word;
                    let doc = findDoc(word, path.join(p, 'applies'));
                    let title = 'apply';
                    if (!doc) {
                        doc = findDoc(word, path.join(p, 'efuns'));
                        title = 'efun';
                    }
                    if (!doc) {
                        doc = findDoc(word, path.join(p, 'sefuns'));
                        title = 'sefun';
                    }
                    if (!doc) {
                        doc = findDoc(word, path.join(p, 'lfuns'));
                        title = 'lfun';
                    }
                    if (!doc) {
                        doc = findDoc(word, path.join(p, 'constants'));
                        title = 'constant';
                    }
                    if (!doc || isDirSync(doc))
                        return undefined;
                    let data = fs.readFileSync(doc, 'utf8');
                    if (!data || data.length === 0)
                        return undefined;
                    let contents;
                    //http://home.fnal.gov/~mengel/man_page_notes.html
                    switch (path.extname(doc)) {
                        case '.json':
                            data = JSON.parse(data);
                            if (Array.isArray(data))
                                return { contents: data };
                            contents = [{ isTrusted: true, value: `**${title}**` }];
                            if (data.synopsis)
                                contents.push({ isTrusted: true, value: data.synopsis });
                            else if (data.name)
                                contents.push({ isTrusted: true, value: data.name });
                            if (data.description)
                                contents.push({ isTrusted: true, value: data.description });
                            if (data.see)
                                contents.push({ isTrusted: true, value: `**See also:** ${data.see}` });
                            if (contents.length === 0)
                                return undefined;
                            return { contents: contents };
                        case '.3':
                        case '.4':
                        case '.pre':
                            data = nroffParts(data);
                            contents = [{ isTrusted: true, value: `**${title}**` }];
                            if (data.synopsis)
                                contents.push({ isTrusted: true, value: data.synopsis });
                            else if (data.name)
                                contents.push({ isTrusted: true, value: data.name });
                            if (data.description) {
                                contents.push({ isTrusted: true, value: data.description });
                                /*
                                contents.push(...data.description.split('\n').map(l => {
                                    return { value: l };
                                }));
                                */
                            }
                            if (data.see)
                                contents.push({ value: `**See also:** ${data.see}` });
                            if (contents.length === 0)
                                return undefined;
                            return { contents: contents };
                    }
                    return {
                        contents: [
                            { value: `**${title}**` },
                            { value: data }
                        ]
                    };
                }
            });

            resolve(monaco);
        });
    });
}

function nroffParts(data) {
    if (!data || data.length === 0)
        return data;
    const md = {
        name: null,
        synopsis: null,
        description: null,
        see: null
    };
    data = data.split(/\r\n|\n|\r/);
    const dl = data.length;
    for (let d = 0; d < dl; d++) {
        let str;
        if (data[d].startsWith('.\"') || data[d].startsWith('.TH '))
            continue;
        if (data[d] === '.SH SYNOPSIS') {
            d++;
            str = [];
            while (d < dl && !data[d].startsWith('.SH ')) {
                data[d] = nroffToMarkdown(data[d].trim());
                if (!data[d]) {
                    d++;
                    continue;
                }
                str.push(data[d]);
                d++;
            }
            d--;
            md.synopsis = str.join(' ').replace(/&nbsp;&nbsp;$/, '').trim();
            continue;
        }
        if (data[d] === '.SH DESCRIPTION') {
            d++;
            str = [];
            while (d < dl && !data[d].startsWith('.SH ')) {
                data[d] = nroffToMarkdown(data[d].trim());
                if (!data[d]) {
                    d++;
                    continue;
                }
                str.push(data[d]);
                d++;
            }
            d--;
            md.description = str.join(' ').replace(/&nbsp;&nbsp;$/, '').trim();
            continue;
        }
        if (data[d] === '.SH NAME') {
            d++;
            str = [];
            while (d < dl && !data[d].startsWith('.SH ')) {
                data[d] = nroffToMarkdown(data[d].trim());
                if (!data[d]) {
                    d++;
                    continue;
                }
                str.push(data[d]);
                d++;
            }
            d--;
            md.name = str.join(' ').replace(/&nbsp;&nbsp;$/, '').trim();
            continue;
        }
        if (data[d] === '.SH SEE ALSO') {
            d++;
            str = [];
            while (d < dl && !data[d].startsWith('.SH ')) {
                data[d] = nroffToMarkdown(data[d].trim());
                if (!data[d]) {
                    d++;
                    continue;
                }
                str.push(data[d].replace(/\([3|4]\)/g, '()'));
                d++;
            }
            d--;
            md.see = str.join(' ').replace(/&nbsp;&nbsp;$/, '').trim();
            continue;
        }
    }
    return md;
}

function nroffToMarkdown(str) {
    if (!str || str.length === 0)
        return '\n\n';
    if (str.startsWith('.\"') || str.startsWith('.TH '))
        return null;
    if (str.startsWith('.nf'))
        return null;
    if (str.startsWith('.PP'))
        return '\n\n';
    if (str.startsWith('.IP'))
        return '\n\n>';
    return str;
}

function findDoc(doc, p) {
    if (existsSync(path.join(p, doc)))
        return path.join(p, doc);
    if (existsSync(path.join(p, doc + '.json')))
        return path.join(p, doc + '.json');
    if (existsSync(path.join(p, doc + '.md')))
        return path.join(p, doc + '.md');
    if (existsSync(path.join(p, doc + '.3')))
        return path.join(p, doc + '.3');
    if (existsSync(path.join(p, doc + '.4')))
        return path.join(p, doc + '.4');
    if (existsSync(path.join(p, doc + '.pre')))
        return path.join(p, doc + '.pre');
    const files = fs.readdirSync(p);
    const fl = files.length;
    let d;
    for (let f = 0; f < fl; f++) {
        if (fs.statSync(path.join(p, files[f])).isDirectory()) {
            d = findDoc(doc, path.join(p, files[f]));
            if (d)
                return d;
        }
    }
    return null;
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
    private $oEditor: monaco.editor.IStandaloneCodeEditor;
    private $editor: monaco.editor.IStandaloneCodeEditor;
    private $dEditor: monaco.editor.IStandaloneDiffEditor;
    private $model: monaco.editor.ITextModel;
    private $saving = false;
    private $state;
    private $diffState;
    private $startValue = '';
    private $diffModel: monaco.editor.ITextModel;
    private $pSelectedLength;

    public decorations;
    public rawDecorations;

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

    private createModel() {
        let value = '';
        if (this.$model) {
            value = this.$model.getValue(monaco.editor.EndOfLinePreference.LF);
            this.$model.dispose();
        }
        if (!this.new && this.file && this.file.length !== 0 && this.source === Source.local) {
            this.$model = monaco.editor.getModel(monaco.Uri.file(this.file));
            if (this.$model) {
                value = this.$model.getValue(monaco.editor.EndOfLinePreference.LF);
                this.$model.dispose();
            }
        }
        this.$model = monaco.editor.createModel(value, 'lpc', !this.new && this.file && this.file.length !== 0 && this.source === Source.local ? monaco.Uri.file(this.file) : null);
        if (this.rawDecorations && this.rawDecorations.length !== 0) {
            this.$model.deltaDecorations([], this.rawDecorations);
        }
        this.$model.onDidChangeContent((e) => {
            this.changed = true;
            this.emit('changed', this.$model.getValueLength());
            if (this.decorations && this.decorations.length) {
                this.$model.deltaDecorations(this.decorations, []);
                this.decorations = null;
            }
            monaco.editor.setModelMarkers(this.$model, '', []);
        });
        this.$model.onDidChangeDecorations(e => {
            this.decorations = this.$model.getAllDecorations(null, true).filter(f => f.options.marginClassName === 'line-error-margin' || f.options.marginClassName === 'line-warning-margin').map(f => f.id);
            if (this.decorations.length === 0)
                this.decorations = null;
        });
        if (this.$dEditor) {
            this.$dEditor.setModel({
                original: this.$diffModel || this.$model,
                modified: this.$model
            });
            this.$dEditor.restoreViewState({
                modified: this.$state,
                original: this.$diffState || this.$state
            });
        }
        else if (this.$editor) {
            this.$editor.setModel(this.$model);
            this.$editor.restoreViewState(this.$state);
        }
    }

    public createControl() {
        //TODO tooltip show folded code
        if (!this.$model)
            this.createModel();
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
            this.createModel();
            const ext = path.extname(this.source === 1 ? this.remote : this.file);
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
            //(<any>this.$model).file = this.file;
        }
    }

    set diff(value) {
        if (value) {
            if (!this.$diffModel)
                this.$diffModel = monaco.editor.createModel(value, 'lpc');
            else
                this.$diffModel.setValue(value);
        }
        else if (this.$diffModel) {
            this.$diffModel.setValue('');
            this.$diffModel.dispose();
            this.$diffModel = null;
            this.$diffState = null;
        }
    }
    get diff() { return this.$diffModel ? 'true' : null; }

    public refresh() { this.emit('refreshed'); }

    public open() {
        if (!this.file || this.file.length === 0 || !existsSync(this.file) || this.new)
            return;
        this.opened = new Date().getTime();
        this.$model.setValue(this.read());
        this.emit('opened', this.file);
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

    public get value() { return this.$model.getValue(monaco.editor.EndOfLinePreference.LF); }

    public upload(remoteFile?) {
        remoteFile = remoteFile || this.remote;
        if (!remoteFile || remoteFile.length === 0) return;
        if (this.changed || this.new)
            this.emit('upload', [{ value: this.$model.getValue(monaco.editor.EndOfLinePreference.LF), remote: remoteFile }]);
        else
            this.emit('upload', [{ local: this.file, remote: remoteFile }]);
    }

    public deleted(keep) {
        if (keep) {
            const old = this.changed;
            this.changed = keep;
            if (keep && !old)
                this.emit('changed', this.$model.getValueLength());
        }
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
        let s;
        if (this.$oEditor && this.$oEditor.hasTextFocus()) {
            s = this.$oEditor.getSelection();
            if (!s) return '';
            return this.$diffModel.getValueInRange(s) || '';
        }
        if (!this.$editor) return '';
        s = this.$editor.getSelection();
        if (!s) return '';
        return this.$model.getValueInRange(s) || '';
    }

    public selectAll() {
        if (this.$oEditor && this.$oEditor.hasTextFocus())
            this.$oEditor.setSelection({
                startLineNumber: 1,
                startColumn: 1,
                endColumn: this.$model.getLineMaxColumn(this.$model.getLineCount()),
                endLineNumber: this.$model.getLineCount()
            });
        else if (this.$editor)
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
        if (this.$oEditor && this.$oEditor.hasTextFocus())
            this.$oEditor.getAction('editor.action.clipboardCopyAction').run();
        else if (!this.$editor) return;
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
                if (!this.$saving) {
                    if (details && details.mtimeMs < this.opened)
                        return;
                    this.emit('reload', action);
                }
                else {
                    this.opened = new Date().getTime();
                    this.$saving = false;
                }
                break;
        }
    }
    public set spellcheck(value: boolean) { /**/ }
    public find() {
        if (this.$oEditor && this.$oEditor.hasTextFocus())
            this.$oEditor.getAction('actions.find').run();
        else if (this.$editor)
            this.$editor.getAction('actions.find').run();
    }
    public replace() {
        if (this.$oEditor && this.$oEditor.hasTextFocus())
            this.$oEditor.getAction('editor.action.find').run();
        else if (this.$editor)
            this.$editor.getAction('editor.action.startFindReplaceAction').run();
    }
    public supports(what) {
        switch (what) {
            case 'cut':
            case 'delete':
            case 'pasteadvanced':
            case 'paste-advanced':
                if (this.$oEditor && this.$oEditor.hasTextFocus())
                    return false;
                return this.selected.length > 0;
            case 'copy':
                return this.selected.length > 0;
            case 'paste':
            case 'undo':
            case 'redo':
                if (this.$oEditor && this.$oEditor.hasTextFocus())
                    return false;
                return true;
            case 'indent':
            case 'find':
            case 'replace':
            case 'select-all':
            case 'selectall':
            case 'menu|edit':
            case 'menu|context':
            case 'menu|view':
            case 'diff':
            case 'buttons':
                return true;
            case 'upload':
            case 'upload-as':
                return true;
        }
        return false;
    }
    public focus(): void {
        if (!this.$editor) return;
        this.$editor.focus();
    }
    public resize() {
        if (this.$editor)
            this.$editor.layout();
        if (this.$oEditor)
            this.$oEditor.layout();
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
        let m;
        if (menu === 'edit') {
            const selected = this.$oEditor && this.$oEditor.hasTextFocus() ? false : this.selected.length > 0;
            m = [{
                label: 'F&ormatting',
                submenu: [
                    {
                        label: '&Insert Color...',
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
                        label: 'To &Upper Case',
                        enabled: selected,
                        click: () => {
                            this.$editor.getAction('editor.action.transformToUppercase').run();
                        }
                    },
                    {
                        label: 'To &Lower Case',
                        enabled: selected,
                        click: () => {
                            this.$editor.getAction('editor.action.transformToLowercase').run();
                        }
                    },
                    {
                        label: '&Capitalize',
                        enabled: selected,
                        click: () => {
                            this.$editor.getAction('jimud.action.transformToCapitalize').run();
                        }
                    },
                    {
                        label: 'In&verse Case',
                        enabled: selected,
                        click: () => {
                            this.$editor.getAction('jimud.action.transformToInverse').run();
                        }
                    }
                ]
            }];
            if (path.extname(this.file) === '.c' || path.extname(this.file) === '.h') {
                m[0].submenu.push(...[{ type: 'separator' },
                {
                    label: '&Line Comment',
                    accelerator: 'CmdOrCtrl+/',
                    click: () => {
                        this.$editor.getAction('editor.action.commentLine').run();
                    }
                },
                {
                    label: '&Block Comment',
                    accelerator: 'Alt+Shift+A',
                    click: () => {
                        this.$editor.getAction('editor.action.blockComment').run();
                    }
                },
                { type: 'separator' },
                {
                    label: '&Format Document',
                    accelerator: 'Alt+Shift+F',
                    click: () => {
                        monaco.editor.setModelMarkers(this.$model, '', []);
                        this.$editor.getAction('editor.action.formatDocument').run();
                    }
                }]);
                if (path.extname(this.file) === '.c') {
                    m.push(...[
                        { type: 'separator' },
                        {
                            label: '&Test',
                            click: () => {
                                this.emit('debug', this.file);
                            }
                        },
                        {
                            label: 'T&est Clear',
                            click: () => {
                                monaco.editor.setModelMarkers(this.$model, '', []);
                                this.$model.deltaDecorations(this.decorations || [], []);
                                this.decorations = null;
                                this.rawDecorations = null;
                            }
                        }
                    ]);
                }
                m.push(...[{ type: 'separator' },
                {
                    label: 'Go to Definition',
                    accelerator: 'F12',
                    click: () => {
                        this.$editor.getAction('editor.action.goToDeclaration').run();
                    }
                }]);
            }
            m.push({ type: 'separator' });
            m.push({
                label: '&Go to line...',
                accelerator: 'CmdOrCtrl+G',
                click: () => {
                    this.$editor.getAction('editor.action.gotoLine').run();
                }
            });
            return m;
        }
        else if (menu === 'context') {
            const selected = this.selected.length > 0;
            if (this.$oEditor && this.$oEditor.hasTextFocus())
                return [
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
                ];
            m = [
                {
                    label: 'F&ormatting',
                    submenu: [
                        {
                            label: '&Insert Color...',
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
                            label: 'To &Upper Case',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('editor.action.transformToUppercase').run();
                            }
                        },
                        {
                            label: 'To &Lower Case',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('editor.action.transformToLowercase').run();
                            }
                        },
                        {
                            label: '&Capitalize',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('jimud.action.transformToCapitalize').run();
                            }
                        },
                        {
                            label: 'In&verse Case',
                            enabled: selected,
                            click: () => {
                                this.$editor.getAction('jimud.action.transformToInverse').run();
                            }
                        }
                    ]
                }, {
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

            if (path.extname(this.file) === '.c' || path.extname(this.file) === '.h') {
                m[0].submenu.push(...[{ type: 'separator' },
                {
                    label: '&Line Comment',
                    accelerator: 'CmdOrCtrl+/',
                    click: () => {
                        this.$editor.getAction('editor.action.commentLine').run();
                    }
                },
                {
                    label: '&Block Comment',
                    accelerator: 'Alt+Shift+A',
                    click: () => {
                        this.$editor.getAction('editor.action.blockComment').run();
                    }
                },
                { type: 'separator' },
                {
                    label: '&Format Document',
                    accelerator: 'Alt+Shift+F',
                    click: () => {
                        monaco.editor.setModelMarkers(this.$model, '', []);
                        this.$editor.getAction('editor.action.formatDocument').run();
                    }
                }]);
                if (path.extname(this.file) === '.c') {
                    m.push(...[
                        { type: 'separator' },
                        {
                            label: '&Test',
                            click: () => {
                                this.emit('debug', this.file);
                            }
                        },
                        {
                            label: 'T&est Clear',
                            click: () => {
                                monaco.editor.setModelMarkers(this.$model, '', []);
                                this.$model.deltaDecorations(this.decorations || [], []);
                                this.decorations = null;
                                this.rawDecorations = null;
                            }
                        }
                    ]);
                }
                m.push(...[
                    { id: 'sep', type: 'separator', position: 'before=1' },
                    {
                        label: 'Go to Definition',
                        accelerator: 'F12',
                        click: () => {
                            this.$editor.getAction('editor.action.goToDeclaration').run();
                        },
                        position: 'before=sep',
                        id: 'goto'
                    },
                    {
                        label: 'Peek Definition',
                        accelerator: 'Alt+F12',
                        click: () => {
                            this.$editor.getAction('editor.action.previewDeclaration').run();
                        },
                        position: 'after=goto',
                        id: 'peek'
                    }]);
            }

            return m;
        }
        else if (menu === 'view')
            return [
                {
                    label: 'Toggle &Word Wrap',
                    accelerator: 'Alt+Z',
                    click: () => {
                        this.$editor.updateOptions({ wordWrap: (this.$editor.getConfiguration().wrappingInfo.isViewportWrapping ? 'off' : 'on') });
                    }
                },
                { type: 'separator' },
                {
                    label: '&Folding',
                    submenu: [
                        {
                            label: '&Expand All',
                            accelerator: 'CmdOrCtrl+>',
                            click: () => {
                                if (this.$oEditor && this.$oEditor.hasTextFocus())
                                    this.$oEditor.getAction('editor.unfoldAll').run();
                                else
                                    this.$editor.getAction('editor.unfoldAll').run();
                            }
                        },
                        {
                            label: '&Collapse All',
                            accelerator: 'CmdOrCtrl+<',
                            click: () => {
                                if (this.$oEditor && this.$oEditor.hasTextFocus())
                                    this.$oEditor.getAction('editor.foldAll').run();
                                else
                                    this.$editor.getAction('editor.foldAll').run();
                            }
                        }
                    ]
                }
            ];
    }

    public get buttons() {
        if (path.extname(this.source === 1 ? this.remote : this.file) !== '.c')
            return [];
        const group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');

        let el = document.createElement('button');
        el.id = 'btn-debug';
        el.type = 'button';
        el.classList.add('btn', 'btn-default', 'btn-xs');
        el.title = 'Test';
        el.addEventListener('click', () => {
            this.emit('debug', this.file);
        });
        el.innerHTML = '<i class="fa fa-bug"></i>';
        group.appendChild(el);
        el = document.createElement('button');
        el.id = 'btn-debug';
        el.type = 'button';
        el.classList.add('btn', 'btn-default', 'btn-xs');
        el.title = 'Test clear';
        el.addEventListener('click', () => {
            monaco.editor.setModelMarkers(this.$model, '', []);
            this.$model.deltaDecorations(this.decorations || [], []);
            this.decorations = null;
            this.rawDecorations = null;
        });
        el.innerHTML = '<i class="fa fa-times"></i>';
        group.appendChild(el);
        return [group];
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
        if (this.$oEditor && this.$oEditor.hasTextFocus()) {
            if (!this.$oEditor.getPosition())
                return [0, 0];
            return [this.$oEditor.getPosition().column, this.$oEditor.getPosition().lineNumber];
        }
        if (!this.$editor || !this.$editor.getPosition())
            return [0, 0];
        return [this.$editor.getPosition().column, this.$editor.getPosition().lineNumber];
    }
    public get length() { return this.$model.getValueLength(); }

    public get model() { return this.model; }

    public selectionChanged(e) {
        this.emit('selection-changed');
        const selected = this.selected.length > 0;
        //dont update if nothing changed
        if (this.$pSelectedLength === selected) return;
        this.$pSelectedLength = selected;
        this.emit('menu-update', 'edit|formatting|to upper case', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|to lower case', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|capitalize', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|inverse case', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|line comment', { enabled: selected });
        this.emit('menu-update', 'edit|formatting|block comment', { enabled: selected });
    }

    public activate(editor) {
        if (editor.getEditorType() === 'vs.editor.ICodeEditor') {
            this.$editor = editor;
            this.$oEditor = null;
            this.$dEditor = null;
            editor.setModel(this.$model);
            editor.restoreViewState(this.$state);
        }
        else {
            this.$dEditor = editor;
            this.$editor = editor.getModifiedEditor();
            this.$oEditor = editor.getOriginalEditor();
            editor.setModel({
                original: this.$diffModel || this.$model,
                modified: this.$model
            });
            editor.restoreViewState({
                modified: this.$state,
                original: this.$diffState || this.$state
            });
        }
    }
    public deactivate(editor) {
        if (editor.getEditorType() === 'vs.editor.ICodeEditor') {
            this.$state = editor.saveViewState();
            editor.setModel(null);
        }
        else {
            this.$state = editor.saveViewState().modified;
            this.$diffState = editor.saveViewState().original;
            editor.setModel(null);
        }
        this.$editor = null;
    }

    public clear() { /** */ }
}
