/// <reference path="../../../node_modules/monaco-editor/monaco.d.ts" />
//spellchecker:ignore sefuns efuns efun sefun lfuns lfun nroff ormatting selectall
import { EditorBase, EditorOptions, FileState, Source } from './editor.base';
import { conf, language, loadCompletion, LPCIndenter, LPCFormatter } from './lpc';
import { isFileSync, isDirSync, parseTemplate, stripPinkfish, copy, createColorDialog } from '../library';
const path = require('path');
const fs = require('fs');

interface LoadMonacoOptions {
    baseUrl?: string;
}

declare global {
    interface Window {
        $editor: monaco.editor.IStandaloneCodeEditor;
    }
    let isWordMisspelled;
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
                    provideCompletionItems: (model, position, item, token) => {
                        const word: any = model.getWordAtPosition(position);
                        if (!word) return { suggestions: [] };
                        if (!$lpcCompletionCache)
                            $lpcCompletionCache = loadCompletion();
                        const s = {
                            suggestions: copy($lpcCompletionCache)
                        };
                        s.suggestions.forEach(c => {
                            c.range = {
                                startLineNumber: position.lineNumber,
                                startColumn: word.startColumn,
                                endLineNumber: position.lineNumber,
                                endColumn: word.endColumn
                            };
                        });
                        return s;
                    },
                    resolveCompletionItem(item, token) {
                        return item;
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
                        const err = (e) => {
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
                            monaco.editor.setModelMarkers(model, 'errors', [
                                {
                                    startColumn: e.col + 1,
                                    startLineNumber: e.line + 1,
                                    endColumn: e.col + 1,
                                    endLineNumber: e.line + 1,
                                    message: e.message,
                                    severity: 8
                                }
                            ]);
                            $indenter.removeListener('error', err);
                            $indenter.removeListener('complete', complete);
                        };
                        const complete = (lines) => {
                            resolve2([{
                                range: {
                                    startLineNumber: 1,
                                    startColumn: 1,
                                    endColumn: model.getLineMaxColumn(model.getLineCount()),
                                    endLineNumber: model.getLineCount()
                                },
                                text: lines.join('\n')
                            }]);
                            $indenter.removeListener('error', err);
                            $indenter.removeListener('complete', complete);
                        };
                        $indenter.on('error', err);
                        $indenter.on('complete', complete);
                        $indenter.indent(code);
                    });
                }
            });
            //https://github.com/Microsoft/monaco-editor/issues/852
            //https://github.com/Microsoft/monaco-editor/issues/935
            monaco.languages.registerDefinitionProvider('lpc', {
                async provideDefinition(model: monaco.editor.ITextModel, position: monaco.Position, token: monaco.CancellationToken): Promise<monaco.languages.LocationLink[] | monaco.languages.Location | undefined> {
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
                            if (isFileSync(f)) {
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
                    switch (path.extname(doc)) {
                        case '.md':
                            data = markdownParse(data);
                            data.title = data.title || title;
                            return objectToHover(data);
                        case '.json':
                            data = JSON.parse(data);
                            if (Array.isArray(data))
                                return { contents: data };
                            data.title = data.title || title;
                            return objectToHover(data);
                        case '.3':
                        case '.4':
                            data = nroffParse(data);
                            data.title = data.title || title;
                            return objectToHover(data);
                    }
                    return {
                        contents: [
                            { value: `**${title}**` },
                            { value: stripPinkfish(data) }
                        ]
                    };
                }
            });
            resolve(monaco);
        });
    });
}

function nroffParse(data) {
    if (!data || data.length === 0)
        return data;
    const md = {
        name: null,
        synopsis: null,
        description: null,
        see: null,
        location: null
    };
    data = data.split(/\r\n|\n|\r/);
    const dl = data.length;
    for (let d = 0; d < dl; d++) {
        let str;
        if (data[d].startsWith('.\"') || data[d].startsWith('.TH '))
            continue;
        if (data[d] === '.SH LOCATION') {
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
            md.synopsis = str.join(' ').trim().replace(/&nbsp;$/, '').trim();
            continue;
        }
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
            md.synopsis = str.join(' ').trim().replace(/&nbsp;$/, '').trim();
            continue;
        }
        if (data[d] === '.SH DESCRIPTION') {
            d++;
            str = [];
            while (d < dl && !data[d].startsWith('.SH ')) {
                if (data[d].startsWith('.TP ') || data[d] === '.TP') {
                    d++;
                    if (d + 1 >= dl) {
                        d++;
                        continue;
                    }
                    if (str.length > 0 && !str[str.length - 1].endsWith('\n'))
                        str.push(`\n|${data[d]}|${data[d + 1]}|\n`);
                    else
                        str.push(`|${data[d]}|${data[d + 1]}|\n`);
                    d++;
                }
                else {
                    data[d] = nroffToMarkdown(data[d].trim());
                    if (!data[d]) {
                        d++;
                        continue;
                    }
                    str.push(data[d]);
                    d++;
                }
            }
            d--;
            md.description = str.join(' ').trim().replace(/&nbsp;$/, '').trim();
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
            md.name = str.join(' ').trim().replace(/&nbsp;$/, '').trim();
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
            md.see = str.join(' ').trim().replace(/&nbsp;$/, '').trim();
            continue;
        }
    }
    return md;
}

//http://home.fnal.gov/~mengel/man_page_notes.html
function nroffToMarkdown(str) {
    if (!str || str.length === 0)
        return '\n\n&nbsp;\n\n';
    if (str.startsWith('.\"') || str.startsWith('.TH '))
        return null;
    if (str.startsWith('.nf') || str.startsWith('.fi'))
        return null;
    if (str.startsWith('.br') || str.startsWith('.PP'))
        return '\n\n&nbsp;\n\n';
    if (str.startsWith('.IP'))
        return '\n\n>';
    return str;
}

function markdownParse(data) {
    if (!data || data.length === 0)
        return data;
    const md = {
        name: null,
        synopsis: null,
        description: null,
        see: null,
        location: null
    };
    data = data.split(/\r\n|\n|\r/);
    const dl = data.length;
    for (let d = 0; d < dl; d++) {
        let str;
        if (data[d].toUpperCase() === '## LOCATION') {
            d++;
            if (d < dl && data[d].trim().length === 0)
                d++;
            str = [];
            while (d < dl && !data[d].startsWith('# ') && !data[d].startsWith('## ')) {
                data[d] = markdownLine(data[d]);
                if (!data[d]) {
                    d++;
                    continue;
                }
                str.push(data[d]);
                d++;
            }
            d--;
            md.location = str.join('\n').trim();
            continue;
        }
        if (data[d].toUpperCase() === '# SYNOPSIS' || data[d].toUpperCase() === '## SYNOPSIS') {
            d++;
            if (d < dl && data[d].trim().length === 0)
                d++;
            str = [];
            while (d < dl && !data[d].startsWith('# ') && !data[d].startsWith('## ')) {
                data[d] = markdownLine(data[d]);
                if (!data[d]) {
                    d++;
                    continue;
                }
                str.push(data[d]);
                d++;
            }
            d--;
            md.synopsis = str.join('\n').trim();
            continue;
        }
        if (data[d].toUpperCase() === '## DESCRIPTION') {
            d++;
            if (d < dl && data[d].trim().length === 0)
                d++;
            str = [];
            while (d < dl && !data[d].startsWith('# ') && !data[d].startsWith('## ')) {
                data[d] = markdownLine(data[d]);
                if (!data[d]) {
                    d++;
                    continue;
                }
                str.push(data[d].replace(/\([3|4]\)/g, '()'));
                d++;
            }
            d--;
            md.description = str.join('\n').trim();
            continue;
        }
        if (data[d].toUpperCase() === '# NAME' || data[d].toUpperCase() === '## NAME') {
            d++;
            if (d < dl && data[d].trim().length === 0)
                d++;
            str = [];
            while (d < dl && !data[d].startsWith('# ') && !data[d].startsWith('## ')) {
                data[d] = markdownLine(data[d]);
                if (!data[d]) {
                    d++;
                    continue;
                }
                str.push(data[d]);
                d++;
            }
            d--;
            md.name = str.join('\n').trim();
            continue;
        }
        if (data[d].toUpperCase() === '## SEE ALSO') {
            d++;
            if (d < dl && data[d].trim().length === 0)
                d++;
            str = [];
            while (d < dl && !data[d].startsWith('# ') && !data[d].startsWith('## ')) {
                data[d] = markdownLine(data[d]);
                if (!data[d]) {
                    d++;
                    continue;
                }
                str.push(data[d].replace(/\([3|4]\)/g, '()'));
                d++;
            }
            d--;
            md.see = str.join('\n').trim();
            continue;
        }
    }
    return md;
}

function markdownLine(str) {
    if (!str || str.length === 0)
        return '\n\n';
    return str + '\n';
}

function objectToHover(data) {
    const contents = [{ value: `**${data.title}**` }];
    if (data.synopsis)
        contents.push({ value: '```lpc\n' + data.synopsis + '\n```' });
    else if (data.name)
        contents.push({ value: '```lpc\n' + data.name + '\n```' });
    if (data.description)
        contents.push({ value: data.description });
    if (data.location)
        contents.push({ value: `**Location:** ${data.location}` });
    if (data.see)
        contents.push({ value: `**See also:** ${data.see}` });
    if (contents.length === 0)
        return undefined;
    return { contents: contents };
}

function findDoc(doc, p) {
    const file = path.join(p, doc);
    if (isFileSync(file) && !isDirSync(file))
        return file;
    if (isFileSync(file + '.json') && !isDirSync(file))
        return file + '.json';
    if (isFileSync(file + '.md') && !isDirSync(file))
        return file + '.md';
    if (isFileSync(file + '.3') && !isDirSync(file))
        return file + '.3';
    if (isFileSync(file + '.4') && !isDirSync(file))
        return file + '.4';
    if (isFileSync(file + '.pre') && !isDirSync(file))
        return file + '.pre';
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
    private $options = {
        tabSize: 3,
        insertSpaces: true,
        trimAutoWhitespace: true,
        bracketColorization: true,
        independentColorPoolPerBracketType: false
    };
    private $dictionaryIgnored = [];

    public decorations;
    public rawDecorations;
    private $spellchecking;

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
                trimAutoWhitespace: true,
                bracketColorization: true,
                independentColorPoolPerBracketType: false
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
        if (this.$options)
            this.$model.updateOptions({
                tabSize: this.$options.hasOwnProperty('tabSize') ? this.$options.tabSize : 3,
                insertSpaces: this.$options.hasOwnProperty('insertSpaces') ? this.$options.insertSpaces : true,
                trimAutoWhitespace: this.$options.hasOwnProperty('trimAutoWhitespace') ? this.$options.trimAutoWhitespace : true,
                bracketColorizationOptions: {
                    enabled: this.$options.hasOwnProperty('bracketColorization') ? this.$options.bracketColorization : true,
                    independentColorPoolPerBracketType: value.hasOwnProperty('independentColorPoolPerBracketType') ? this.$options.independentColorPoolPerBracketType : false
                }
            });
        else
            this.$model.updateOptions({
                tabSize: 3,
                insertSpaces: true,
                trimAutoWhitespace: true,
                bracketColorizationOptions: {
                    enabled: true,
                    independentColorPoolPerBracketType: false
                }
            });
        if (this.rawDecorations && this.rawDecorations.length !== 0) {
            this.$model.deltaDecorations([], this.rawDecorations);
        }
        this.$model.onDidChangeContent((e) => {
            this.changed = true;
            this.emit('changed', this.$model.getValueLength(), this.$model.getLineCount());
            if (this.decorations && this.decorations.length) {
                this.$model.deltaDecorations(this.decorations, []);
                this.decorations = null;
            }
            monaco.editor.setModelMarkers(this.$model, 'errors', []);
            if (this.$spellchecking) {
                if (e.isFlush)
                    this.spellcheckDocument();
                else if (e.changes.length) {
                    monaco.editor.setModelMarkers(this.$model, 'spelling', monaco.editor.getModelMarkers({ owner: 'spelling', resource: this.$model.uri }).filter(m => {
                        if (m.startLineNumber >= e.changes[0].range.startLineNumber && m.startLineNumber <= e.changes[0].range.endLineNumber)
                            return false;
                        if (m.endLineNumber >= e.changes[0].range.startLineNumber && m.endLineNumber <= e.changes[0].range.endLineNumber)
                            return false;
                        return true;
                    }).map(m => {
                        delete m.owner;
                        delete m.resource;
                        return m;
                    }) || []);
                    this.spellCheckLines(e.changes[0].range.startLineNumber, e.changes[0].range.endLineNumber);
                }
            }
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
                    const found = monaco.languages.getLanguages().filter(l => {
                        return l.extensions ? l.extensions.indexOf(ext) !== -1 : false;
                    });
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
        if (!this.file || this.file.length === 0 || !isFileSync(this.file) || this.new)
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
                this.emit('changed', this.$model.getValueLength(), this.$model.getLineCount());
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
    public set spellcheck(value: boolean) {
        if (this.$spellchecking == value) return;
        this.$spellchecking = value;
        if (this.$spellchecking)
            this.spellcheckDocument();
        else
            monaco.editor.setModelMarkers(this.$model, 'spelling', []);
    }
    public get spellcheck() { return this.$spellchecking; }
    public find() {
        if (this.$oEditor && this.$oEditor.hasTextFocus()) {
            if (this.selected.length > 0)
                this.$oEditor.getAction('actions.findWithSelection').run();
            else
                this.$oEditor.getAction('actions.find').run();
        }
        else if (this.$editor) {
            if (this.selected.length > 0)
                this.$editor.getAction('actions.findWithSelection').run();
            else
                this.$editor.getAction('actions.find').run();
        }
    }
    public replace() {
        if (this.$oEditor && this.$oEditor.hasTextFocus()) {
            if (this.selected.length > 0)
                this.$oEditor.getAction('actions.findWithSelection').run();
            else
                this.$oEditor.getAction('actions.find').run();
        }
        else if (this.$editor) {
            if (this.selected.length > 0)
                this.$editor.getAction('actions.findWithSelection').run();
            this.$editor.getAction('editor.action.startFindReplaceAction').run();
        }
    }
    public supports(what) {
        switch (what) {
            case 'cut':
            case 'delete':
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
        this.$options = value;
        this.$model.updateOptions({
            tabSize: value.hasOwnProperty('tabSize') ? value.tabSize : 3,
            insertSpaces: value.hasOwnProperty('insertSpaces') ? value.insertSpaces : true,
            trimAutoWhitespace: value.hasOwnProperty('trimAutoWhitespace') ? value.trimAutoWhitespace : true,
            bracketColorizationOptions: {
                enabled: value.hasOwnProperty('bracketColorization') ? value.bracketColorization : true,
                independentColorPoolPerBracketType: value.hasOwnProperty('independentColorPoolPerBracketType') ? value.independentColorPoolPerBracketType : false
            }
        });
    }
    public get options() { return this.$options; }
    public get type() {
        return 1;
    }

    public menu(menu, connected) {
        let m;
        if (menu === 'edit') {
            const selected = this.$oEditor && this.$oEditor.hasTextFocus() ? false : this.selected.length > 0;
            m = [{
                label: 'F&ormatting',
                submenu: [
                    {
                        label: '&Insert Color...',
                        click: () => {
                            const _colorDialog: any = createColorDialog();
                            /*
                            _colorDialog.addEventListener('DOMContentLoaded', () => {
                                _colorDialog.setType(this.file.replace(/[/|\\:]/g, ''));
                            }, { once: true });
                            */
                            _colorDialog.addEventListener('setColor', e => {
                                //if(_colorDialog.getType() === this.file.replace(/[/|\\:]/g, ''))
                                this.insert('%^' + e.detail.code.replace(/ /g, '%^%^') + '%^');
                            });
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
                        if (this.$spellchecking)
                            this.spellcheckDocument();
                    }
                }]);
                if (this.$spellchecking)
                    m.push(...[
                        { type: 'separator' }, {
                            label: '&Spellcheck Document',
                            click: () => {
                                this.spellcheckDocument();
                            }
                        }]);
                if (path.extname(this.file) === '.c' && window.opener) {
                    m.push(...[
                        { type: 'separator' },
                        {
                            label: '&Test',
                            click: () => {
                                this.emit('debug', this.file);
                            },
                            enabled: connected || false
                        },
                        {
                            label: 'T&est Clear',
                            click: () => {
                                monaco.editor.setModelMarkers(this.$model, 'errors', []);
                                this.$model.deltaDecorations(this.decorations || [], []);
                                this.decorations = null;
                                this.rawDecorations = null;
                            },
                            enabled: connected || false
                        }
                    ]);
                }
                m.push(...[{ type: 'separator' },
                {
                    label: 'Go to Definition',
                    accelerator: 'F12',
                    click: () => {
                        this.$editor.getAction('editor.action.revealDefinition').run().then(() => {
                            this.$editor.revealPositionInCenterIfOutsideViewport(this.$editor.getPosition());    
                        });
                    }
                },
                {
                    label: 'Peek Definition',
                    accelerator: 'Alt+F12',
                    click: () => {
                        this.$editor.getAction('editor.action.peekDefinition').run();
                    },
                    position: 'after=goto',
                    id: 'peek'
                }]);
            }
            else if (this.$spellchecking)
                m.push(...[
                    { type: 'separator' }, {
                        label: '&Spellcheck Document',
                        click: () => {
                            this.spellcheckDocument();
                        }
                    }]);
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
                                const _colorDialog: any = createColorDialog();
                                /*
                                _colorDialog.addEventListener('DOMContentLoaded', () => {
                                    _colorDialog.setType(this.file.replace(/[/|\\:]/g, ''));
                                }, { once: true });
                                */
                                _colorDialog.addEventListener('setColor', e => {
                                    //if(_colorDialog.getType() === this.file.replace(/[/|\\:]/g, ''))
                                    this.insert('%^' + e.detail.code.replace(/ /g, '%^%^') + '%^');
                                });
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
                        if (this.$spellchecking)
                            this.spellcheckDocument();
                    }
                }]);
                if (this.$spellchecking)
                    m.push(...[
                        { type: 'separator' }, {
                            label: '&Spellcheck Document',
                            click: () => {
                                this.spellcheckDocument();
                            }
                        }]);
                //only show if connected and linked to a client window
                if (path.extname(this.file) === '.c' && window.opener && connected) {
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
                                monaco.editor.setModelMarkers(this.$model, 'errors', []);
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
                            this.$editor.getAction('editor.action.revealDefinition').run().then(() => {
                                this.$editor.revealPositionInCenterIfOutsideViewport(this.$editor.getPosition());    
                            });
                        },
                        position: 'before=sep',
                        id: 'goto'
                    },
                    {
                        label: 'Peek Definition',
                        accelerator: 'Alt+F12',
                        click: () => {
                            this.$editor.getAction('editor.action.peekDefinition').run();
                        },
                        position: 'after=goto',
                        id: 'peek'
                    }]);
            }
            else if (this.$spellchecking)
                m.push(...[
                    { type: 'separator' }, {
                        label: '&Spellcheck Document',
                        click: () => {
                            this.spellcheckDocument();
                        }
                    }]);

            return m;
        }
        else if (menu === 'view')
            return [
                {
                    label: 'Toggle &Word Wrap',
                    accelerator: 'Alt+Z',
                    click: () => {
                        this.$editor.updateOptions({ wordWrap: (this.$editor.getRawOptions().wordWrap ? 'off' : 'on') });
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

    public update(what, ...args) {
        if (!window.opener) return;
        if (what === 'menu') {
            args[0].updateItem('edit|test', { enabled: args[1] });
            args[0].updateItem('edit|test clear', { enabled: args[1] });
        }
    }

    public get buttons() {
        if (!window.opener || path.extname(this.source === 1 ? this.remote : this.file) !== '.c')
            return [];
        const group = document.createElement('div');
        group.classList.add('btn-group');
        group.setAttribute('role', 'group');

        let el = document.createElement('button');
        el.id = 'btn-debug';
        el.type = 'button';
        el.classList.add('btn', 'btn-default', 'btn-xs', 'connected');
        el.title = 'Test';
        el.addEventListener('click', () => {
            this.emit('debug', this.file);
        });
        el.innerHTML = '<i class="fa fa-bug"></i>';
        group.appendChild(el);
        el = document.createElement('button');
        el.id = 'btn-debug';
        el.type = 'button';
        el.classList.add('btn', 'btn-default', 'btn-xs', 'connected');
        el.title = 'Test clear';
        el.addEventListener('click', () => {
            monaco.editor.setModelMarkers(this.$model, 'errors', []);
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

    public get lineCount() { return this.$model.getLineCount(); }

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

    public spellcheckDocument() {
        monaco.editor.setModelMarkers(this.$model, 'spelling', []);
        if (this.$spellcheckTimer)
            clearTimeout(this.$spellcheckTimer);
        this.spellCheckLines(1, this.$model.getLineCount());
    }

    public isWordIgnored(word) {
        if (this.$dictionaryIgnored && this.$dictionaryIgnored.indexOf(word.toLowerCase()) !== -1)
            return true;
        return false;
    }

    public addIgnoredWord(word) {
        if (word && word.length) {
            if (!this.$dictionaryIgnored)
                this.$dictionaryIgnored = [];
            this.$dictionaryIgnored.push(word.toLowerCase());
        }
    }

    public removeIgnoredWord(word) {
        if (!word || word.length === 0 || !this.$dictionaryIgnored || this.$dictionaryIgnored.length === 0)
            return;
        const index = this.$dictionaryIgnored.indexOf(word.toLowerCase());
        if (index === -1) return;
        this.$dictionaryIgnored.splice(index, 1);
    }

    //TODO move this to a webworker to not block
    private $spellcheckTimer;
    public spellCheckLines(start, end) {
        const markers: any[] = monaco.editor.getModelMarkers({ owner: 'spelling', resource: this.$model.uri }) || [];
        if (markers.length >= 100) return;
        if (end - start > 25) {
            const oldEnd = end;
            this.$spellcheckTimer = setTimeout(() => {
                this.$spellcheckTimer = 0;
                this.spellCheckLines(start + 25, oldEnd);
            }, 250);
            end = start + 24;
        }
        for (let l = start; l <= end; l++) {
            const textLength = this.$model.getLineLength(l);
            if (textLength > 1000) continue;
            for (let c = 0; c <= textLength; c++) {
                const word = this.$model.getWordAtPosition({ column: c, lineNumber: l });
                if (!word) continue;
                if (language.keywords.indexOf(word.word) !== -1 ||
                    language.const.indexOf(word.word) !== -1 ||
                    language.efuns.indexOf(word.word) !== -1 ||
                    language.abbr.indexOf(word.word) !== -1 ||
                    language.sefuns.indexOf(word.word) !== -1 ||
                    language.applies.indexOf(word.word) !== -1
                ) continue;
                //monaco.editor.tokenize('string', 'lpc');
                let words = word.word.split(/(_)|(?=[A-Z])|(\d+)/g);
                let sCol = word.startColumn;
                for (let w = 0, wl = words.length; w < wl; w++) {
                    if (!words[w]) continue;
                    if (isWordMisspelled(words[w], this)) {
                        markers.push({
                            message: `"${words[w]}": Unknown word.`,
                            severity: monaco.MarkerSeverity.Info,
                            startLineNumber: l,
                            startColumn: sCol,
                            endLineNumber: l,
                            endColumn: sCol + words[w].length,
                            source: this.file
                        });
                    }
                    sCol += words[w].length;
                }
                //skip remaining word length
                c += word.word.length;
                if (markers.length === 100) break;
            }
            if (markers.length === 100) break;
        }
        monaco.editor.setModelMarkers(this.$model, 'spelling', markers);
    }
}
