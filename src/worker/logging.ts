const fs = require('fs');
const path = require('path');
const moment = require('moment');

enum FormatType {
    Normal = 0,
    Link = 1,
    LinkEnd = 2,
    MXPLink = 3,
    MXPLinkEnd = 4,
    Image = 5,
    WordBreak = 6,
    MXPSend = 7,
    MXPSendEnd = 8,
    MXPExpired = 9,
    MXPSkip = 10
}

enum FontStyle {
    None = 0,
    Bold = 1,
    Faint = 2,
    Italic = 4,
    Underline = 8,
    Slow = 16, /** @desc Slow blink text combined with slow for final blink  */
    Rapid = 32, /** @desc Rapid blink text combined with slow for final blink */
    Inverse = 64, /** @desc reverse back and parts color */
    Hidden = 128, /** @desc hide text */
    Strikeout = 256,
    DoubleUnderline = 512,
    Overline = 1024
}

interface LineFormat {
    formatType: FormatType;
    offset: number;
    color: string | number;
    background: string | number;
    size: string;
    font: string;
    style: FontStyle;
    hr?: boolean;
}

interface ParserLine {
    raw: string;
    line: string;
    fragment: boolean;
    gagged: boolean;
    formats: LineFormat[];
}

enum Log {
    None = 0,
    Html = 1,
    Text = 2,
    Raw = 4
}

interface LogOptions {
    path?: string;
    offline?: boolean;
    gagged?: boolean;
    enabled?: boolean;
    unique?: boolean;
    prepend?: boolean;
    name?: string;
    what?: Log;
    debug?: boolean;
    postfix?: string;
    prefix?: string;
    format?: string;
}

let options: LogOptions = {
    path: '',
    offline: false,
    gagged: false,
    enabled: false,
    unique: true,
    prepend: false,
    name: '',
    what: Log.Html,
    debug: false
};

let connected: boolean = false;
let timeStamp: number;
let fTimeStamp: string = '';
let logging: boolean = false;
let currentFile: string = '';

self.addEventListener('message', (e: MessageEvent) => {
    if (!e.data) return;
    switch (e.data.action) {
        case 'options':
            let option;
            for (option in e.data.args) {
                if (!e.data.args.hasOwnProperty(option))
                    continue;
                if (option === 'path') {
                    if (options.path !== e.data.args.path) {
                        options.path = e.data.args.path;
                        try {
                            fs.statSync(options.path);
                        } catch (ex) {
                            fs.mkdirSync(options.path);
                        }
                        if (logging)
                            fileChanged();
                    }
                }
                else
                    options[option] = e.data.args[option];
                if (timeStamp !== 0) {
                    fTimeStamp = new moment(timeStamp).format(options.format || 'YYYYMMDD-HHmmss');
                    buildFilename();
                }
                if (options.offline)
                    postMessage({ event: 'start' });
            }
            break;
        case 'name':
            options.name = e.data.args;
            if (logging)
                fileChanged();
            break;
        case 'connected':
            connected = e.data.args;
            buildFilename();
            break;
        case 'logging':
            postMessage({ event: 'logging', args: logging });
            break;
        case 'toggle':
            toggle();
            break;
        case 'stop':
            stop();
            break;
        case 'startInternal':
            const c = options.unique;
            options.unique = false;
            if (!e.data.args)
                start([], [], [], false);
            else
                start(e.data.args.lines, e.data.args.raw, e.data.args.formats, e.data.args.fragment);
            options.unique = c;
            break;

        case 'start':
            if (!e.data.args)
                start([], [], [], false);
            else
                start(e.data.args.lines, e.data.args.raw, e.data.args.formats, e.data.args.fragment);
            break;
        case 'add-line':
            const data: ParserLine = e.data.args;
            if (data.fragment) return;
            if (!data.gagged || (options.gagged && data.gagged)) {
                if ((options.what & Log.Html) === Log.Html)
                    writeHtml(createLine(data.line, data.formats));
                if ((options.what & Log.Text) === Log.Text || options.what === Log.None)
                    writeText(data.line + '\n');
                if ((options.what & Log.Raw) === Log.Raw)
                    writeRaw(data.raw);
            }
            break;
    }
}, false);

function fileChanged() {
    if ((options.what & Log.Html) === Log.Html) {
        const f = path.join(options.path, fTimeStamp) + '.raw.txt';
        buildFilename();
        if (isFileSync(f) && f !== currentFile + '.raw.txt')
            fs.renameSync(f, currentFile);
        if (options.debug)
            postMessage({ event: 'debug', args: 'File changed: "' + f + '" to "' + currentFile + '"' });
    }
}

function buildFilename() {
    if (options.prefix)
        currentFile = options.prefix + fTimeStamp;
    else
        currentFile = fTimeStamp;
    if (options.name && options.name.length > 0)
        currentFile += '.' + options.name;
    currentFile = path.join(options.path, currentFile);
    if (options.postfix)
        currentFile += options.postfix;
    if (options.debug)
        postMessage({ event: 'debug', args: 'Log file: "' + currentFile + '"' });
}

function writeHeader() {
    buildFilename();
    if (!isFileSync(currentFile + '.htm') && (options.what & Log.Html) === Log.Html)
        fs.appendFile(currentFile + '.htm', '<style>\nbody\n{\n	font-family: \'Courier New\', Courier, monospace;\n	text-align: left;\n	font-size: 1em;\n	white-space: pre;\n	background-color: black;	\n}\n/* --- Start CSS for ansi display --- */\n@-webkit-keyframes blinker { \n 	0% { opacity: 1.0; }\n  50% { opacity: 0.0; }\n  100% { opacity: 1.0; }\n} \n\n@keyframes blinker { \n 	0% { opacity: 1.0; }\n  50% { opacity: 0.0; }\n  100% { opacity: 1.0; }\n} \n\n.ansi-blink { \n	text-decoration:blink;\n	animation-name: blinker;\n	animation-iteration-count: infinite; \n	animation-timing-function: cubic-bezier(1.0,0,0,1.0); \n	animation-duration: 1s; \n	-webkit-animation-name: blinker;\n	-webkit-animation-iteration-count: infinite; \n	-webkit-animation-timing-function: cubic-bezier(1.0,0,0,1.0); \n	-webkit-animation-duration: 1s; \n}\n\n.ansi\n{\n	padding: 0px;\n	margin:0px;\n	\n}\n\n.line \n{\n	word-wrap:break-word;\n	word-break:break-all;\n	width: 100%;\n	display: block;\n	padding-bottom:1px;\n	clear:both;\n	line-height: normal;\n  padding-bottom:2px\n}	\n\n.line hr{ border: 0px; }\n/* --- End CSS for ansi display --- */\n\n.line a, .line a:link \n{\n	color: inherit;\n	font-weight: inherit;\n	text-decoration: underline;\n}\n\n.URLLink, .URLLink:link\n{\n	text-decoration: underline;\n	cursor: pointer;\n}\n</style>\n', (err) => {
            if (err)
                postMessage({ event: 'error', args: err });
        });
}

function writeText(data) {
    if (!logging || (!options.offline && !connected)) return;
    writeHeader();
    fs.appendFile(currentFile + '.txt', data, (err) => {
        if (err)
            postMessage({ event: 'error', args: err });
    });
}

function writeHtml(data) {
    if (!logging || (!options.offline && !connected)) return;
    writeHeader();
    fs.appendFile(currentFile + '.htm', data, (err) => {
        if (err)
            postMessage({ event: 'error', args: err });
    });
}

function writeRaw(data) {
    if (!logging || (!options.offline && !connected)) return;
    writeHeader();
    fs.appendFile(currentFile + '.raw.txt', data, (err) => {
        if (err)
            postMessage({ event: 'error', args: err });
    });
}

function start(lines: string[], raw: string[], formats: any[], fragment: boolean) {
    if (!options.enabled) {
        if (logging)
            stop();
        return;
    }
    logging = true;
    if (options.unique || timeStamp === 0) {
        timeStamp = new Date().getTime();
        fTimeStamp = new moment(timeStamp).format(options.format || 'YYYYMMDD-HHmmss');
    }
    buildFilename();
    if (options.prepend && lines && lines.length > 0) {
        if ((options.what & Log.Html) === Log.Html)
            writeHtml(createLines(lines || [], formats || []));
        if ((options.what & Log.Text) === Log.Text || options.what === Log.None)
            writeText(lines.join('\n') + (fragment || lines.length === 0 ? '' : '\n'));
        if ((options.what & Log.Raw) === Log.Raw)
            writeRaw(raw.join(''));
    }
    postMessage({ event: 'started', args: logging });
}

function stop() {
    logging = false;
    postMessage({ event: 'stopped', args: logging });
}

function toggle() {
    options.enabled = !options.enabled;
    postMessage({ event: 'toggled', args: options.enabled });
    const c = options.unique;
    options.unique = false;
    if (options.enabled && !logging)
        postMessage({ event: 'startInternal' });
    else if (!options.enabled && logging)
        stop();
    options.unique = c;
}

function createLines(lines: string[], formats: any[]) {
    const text = [];
    const ll = lines.length;
    for (let l = 0; l < ll; l++)
        text.push(createLine(lines[l], formats[l]));
    return text.join('');
}

function createLine(text: string, formats: any[]) {
    const parts = [];
    let offset = 0;
    let style = [];
    let fCls;
    const len = formats.length;

    for (let f = 0; f < len; f++) {
        const format = formats[f];
        let nFormat;
        let end;
        const td = [];
        //let oSize;
        //let oFont;
        if (f < len - 1) {
            nFormat = formats[f + 1];
            //skip empty blocks
            if (format.offset === nFormat.offset && nFormat.formatType === format.formatType)
                continue;
            end = nFormat.offset;
        }
        else
            end = text.length;
        offset = format.offset;
        if (format.formatType === FormatType.Normal) {
            style = [];
            fCls = [];
            if (format.background)
                style.push('background:', format.background, ';');
            if (format.color)
                style.push('color:', format.color, ';');
            if (format.font)
                style.push('font-family: ', format.font, ';');
            if (format.size)
                style.push('font-size: ', format.size, ';');
            if (format.style !== FontStyle.None) {
                if ((format.style & FontStyle.Bold) === FontStyle.Bold)
                    style.push('font-weight: bold;');
                if ((format.style & FontStyle.Italic) === FontStyle.Italic)
                    style.push('font-style: italic;');
                if ((format.style & FontStyle.Overline) === FontStyle.Overline)
                    td.push('overline ');
                if ((format.style & FontStyle.DoubleUnderline) === FontStyle.DoubleUnderline || (format.style & FontStyle.Underline) === FontStyle.Underline)
                    td.push('underline ');
                if ((format.style & FontStyle.DoubleUnderline) === FontStyle.DoubleUnderline)
                    style.push('border-bottom: 1px solid ', format.color, ';');
                else
                    style.push('padding-bottom: 1px;');
                if ((format.style & FontStyle.Rapid) === FontStyle.Rapid || (format.style & FontStyle.Slow) === FontStyle.Slow) {
                    if (this.enableFlashing)
                        fCls.push(' ansi-blink');
                    else if ((format.style & FontStyle.DoubleUnderline) !== FontStyle.DoubleUnderline && (format.style & FontStyle.Underline) !== FontStyle.Underline)
                        td.push('underline ');
                }
                if ((format.style & FontStyle.Strikeout) === FontStyle.Strikeout)
                    td.push('line-through ');
                if (td.length > 0)
                    style.push('text-decoration:', td.join(''), ';');
            }
            if (format.hr)
                parts.push('<span style="', style.join(''), '" class="ansi', fCls.join(''), '"><div class="hr" style="background-color:', format.color, '"></div></span>');
            else
                parts.push('<span style="', style.join(''), '" class="ansi', fCls.join(''), '">', htmlEncode(text.substring(offset, end)), '</span>');
        }
        else if (format.formatType === FormatType.Link) {
            parts.push('<a draggable="false" class="URLLink" href="javascript:void(0);" title="');
            parts.push(format.href);
            parts.push('" onclick="', this.linkFunction, '(\'', format.href, '\');return false;">');
            parts.push('<span style="', style.join(''), '" class="ansi', fCls.join(''), '">');
            parts.push(htmlEncode(text.substring(offset, end)));
            parts.push('</span>');
        }
        else if (format.formatType === FormatType.LinkEnd || format.formatType === FormatType.MXPLinkEnd || format.formatType === FormatType.MXPSendEnd) {
            parts.push('</a>');
        }
        else if (format.formatType === FormatType.WordBreak)
            parts.push('<wbr>');
        else if (format.formatType === FormatType.MXPLink) {
            parts.push('<a draggable="false" class="MXPLink" href="javascript:void(0);" title="');
            parts.push(format.href);
            parts.push('"');
            parts.push('onclick="', this.mxpLinkFunction, '(this, \'', format.href, '\');return false;">');
            parts.push('<span style="', style.join(''), '" class="ansi', fCls.join(''), '">');
            parts.push(htmlEncode(text.substring(offset, end)));
            parts.push('</span>');
        }
        else if (format.formatType === FormatType.MXPSend) {
            parts.push('<a draggable="false" class="MXPLink" href="javascript:void(0);" title="');
            parts.push(format.hint);
            parts.push('"');
            parts.push(' onmouseover="', this.mxpTooltipFunction, '(this);"');
            parts.push(' onclick="', this.mxpSendFunction, '(event||window.event, this, ', format.href, ', ', format.prompt ? 1 : 0, ', ', format.tt, ');return false;">');
            parts.push('<span style="', style.join(''), '" class="ansi', fCls.join(''), '">');
            parts.push(htmlEncode(text.substring(offset, end)));
            parts.push('</span>');
        }
        else if (format.formatType === FormatType.MXPExpired) {
            parts.push('<span style="', style.join(''), '" class="ansi', fCls.join(''), '">');
            parts.push(htmlEncode(text.substring(offset, end)));
            parts.push('</span>');
        }
        //TODO add image
        //TODO once supported update parser support tag to add image
    }
    return `<span class="line">${parts.join('')}<br></span>`;
}

function htmlEncode(text) {
    if (!text || text.length === 0)
        return;
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function isFileSync(aPath) {
    try {
        return fs.statSync(aPath).isFile();
    } catch (e) {
        if (e.code === 'ENOENT') {
            return false;
        } else {
            throw e;
        }
    }
}