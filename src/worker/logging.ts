//spellchecker:ignore ismap yyyymmdd hmmss
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
let writingHeader = false;
let colors = {};
let colorsCnt = 0;
let backgrounds = {};
let backgroundsCnt = 0;
let buffer = {};
let fd = {};
let flushBuffer;

self.addEventListener('message', (e: MessageEvent) => {
    let c;
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
                else if (flushBuffer && option === 'what' && options[option] !== e.data.args[option]) {
                    c = Log.None;
                    //Test to see what options where removed, and flush just those
                    if ((options[option] & Log.Html) === Log.Html && (e.data.args[option] & Log.Html) !== Log.Html)
                        c |= Log.Html;
                    if ((options[option] & Log.Text) === Log.Text && (e.data.args[option] & Log.Text) !== Log.Text)
                        c |= Log.Text;
                    if ((options[option] & Log.Raw) === Log.Raw && (e.data.args[option] & Log.Raw) !== Log.Raw)
                        c |= Log.Raw;
                    //Options changed so flush the ones removed
                    if (c !== Log.None) {
                        //store old buffer data
                        const fOld = flushBuffer;
                        //sett options that got removed
                        flushBuffer.what = c;
                        //flush using those options
                        flush(true);
                        //set old options to new options
                        fOld.what = options[option];
                        //restore buffer with new options
                        flushBuffer = fOld;
                    }
                    //store options
                    options[option] = e.data.args[option];
                }
                else
                    options[option] = e.data.args[option];
                if (timeStamp !== 0) {
                    fTimeStamp = new moment(timeStamp).format(options.format || 'YYYYMMDD-HHmmss');
                    buildFilename();
                    flush(true);
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
            c = options.unique;
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
        case 'flush':
            flush(e.data.args);
            break;
        case 'add-line':
            const data: ParserLine = e.data.args;
            //if a fragment buffer as next full line will probably start with fragment
            if (data.fragment) {
                flushBuffer = data;
                flushBuffer.logging = logging;
                flushBuffer.file = currentFile;
                flushBuffer.connected = connected;
                flushBuffer.what = options.what;
                flushBuffer.gagged = data.gagged || (options.gagged && data.gagged);
                return;
            }
            //clear buffer
            flushBuffer = null;
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
    //previous file
    const pFile = currentFile;
    //generate current file
    buildFilename();
    //same info so move on
    if (pFile === currentFile) return;
    if ((options.what & Log.Html) === Log.Html) {
        const f = pFile + '.htm';
        if (isFileSync(f))
            fs.renameSync(f, currentFile + '.htm');
        if (options.debug)
            postMessage({ event: 'debug', args: 'File changed: "' + f + '.htm" to "' + currentFile + '.htm"' });
    }
    if ((options.what & Log.Raw) === Log.Raw) {
        const f = pFile + '.raw.txt';
        if (isFileSync(f))
            fs.renameSync(f, currentFile + '.raw.txt');
        if (options.debug)
            postMessage({ event: 'debug', args: 'File changed: "' + f + '.raw.txt" to "' + currentFile + '.raw.txt"' });
    }
    if ((options.what & Log.Text) === Log.Text || options.what === Log.None) {
        const f = pFile + '.txt';
        if (isFileSync(f))
            fs.renameSync(f, currentFile + '.txt');
        if (options.debug)
            postMessage({ event: 'debug', args: 'File changed: "' + f + '.txt" to "' + currentFile + '.txt"' });
    }
    //if flush buffer and file is not the same as previous file flush it
    if (flushBuffer && flushBuffer.currentFile !== pFile)
        flush(true);
    else if (flushBuffer) // if buffer set to new file name
        flushBuffer.currentFile = currentFile;
}

function buildFilename() {
    const o = currentFile;
    if (options.prefix)
        currentFile = options.prefix + fTimeStamp;
    else
        currentFile = fTimeStamp;
    if (options.name && options.name.length > 0)
        currentFile += '.' + options.name;
    currentFile = path.join(options.path, currentFile);
    if (options.postfix)
        currentFile += options.postfix;
    if (options.debug && o !== currentFile)
        postMessage({ event: 'debug', args: 'Log file: "' + currentFile + '"' });
}

function appendFile(file, data, force?) {
    try {
        if (!buffer[file]) buffer[file] = [];
        if (buffer[file].length && !force) {
            buffer[file].push({ file: file, data: data });
            return;
        }
        buffer[file].unshift({ file: file, data: data });
        if (!fd[file]) {
            fd[file] = fs.createWriteStream(file, { flags: 'a' });
            fd[file].on('error', err => postMessage({ event: 'error', args: err }));
        }
        fd[file].write(data, 'utf-8', () => {
            buffer[file].shift();
            if (buffer[file].length) {
                const tmp = buffer[file].shift();
                appendFile(tmp.file, tmp.data, true);
            }
            else {
                delete buffer[file];
                fd[file].end();
                delete fd[file];
            }
        });
    }
    catch (err) {
        postMessage({ event: 'error', args: err });
    }
}

function appendFileSync(file, data) {
    try {
        fs.appendFileSync(file, data);
    }
    catch (err) {
        postMessage({ event: 'error', args: err });
    }
}

function writeHeader() {
    if (!currentFile || currentFile.length === 0)
        buildFilename();
    if (!isFileSync(currentFile + '.htm') && (options.what & Log.Html) === Log.Html && !writingHeader) {
        colors = {};
        colorsCnt = 0;
        backgrounds = {};
        backgroundsCnt = 0;
        writingHeader = true;
        appendFileSync(currentFile + '.htm', fs.readFileSync(path.join(path.join(__dirname, '..', '..', 'assets'), 'log.header.html'), 'utf-8').replace(/\n|\r|\n\r|\r\n/g, ''));
        writingHeader = false;
    }
}

function writeText(data) {
    if (!logging || (!options.offline && !connected)) return;
    writeHeader();
    appendFile(currentFile + '.txt', data);
}

function writeHtml(data) {
    if (!logging || (!options.offline && !connected)) return;
    writeHeader();
    appendFile(currentFile + '.htm', data + '\n');
}

function writeRaw(data) {
    if (!logging || (!options.offline && !connected)) return;
    writeHeader();
    appendFile(currentFile + '.raw.txt', data);
}

function flush(newline?) {
    //no buffer done
    if (!flushBuffer) return;
    //store current state
    const c = connected;
    const f = currentFile;
    const l = logging;
    //restore state when buffer saved
    logging = flushBuffer.logging;
    connected = flushBuffer.connected;
    currentFile = flushBuffer.currentFile;
    //write buffer based on buffer state
    if (!flushBuffer.gagged) {
        let nl = '';
        //some times we may want to force a new line, eg when the screen has been cleared as we do not want to lose data so the fragment becomes a full line
        if (newline)
            nl = '\n';
        if ((flushBuffer.what & Log.Html) === Log.Html)
            writeHtml(createLine(flushBuffer.line, flushBuffer.formats));
        if ((flushBuffer.what & Log.Text) === Log.Text || flushBuffer.what === Log.None)
            writeText(flushBuffer.line + nl);
        if ((flushBuffer.what & Log.Raw) === Log.Raw)
            writeRaw(flushBuffer.raw + nl);
    }
    //restore previous state and clear buffer
    logging = l;
    connected = c;
    currentFile = f;
    flushBuffer = null;
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
        flush(true);
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

function getClassName(str) {
    if (!str || str.length === 0) return null;
    return str.replace(/[,]/g, '-').replace(/[\(\)\s;]/g, '');
}

function createLine(text: string, formats: any[]) {
    const parts = [];
    let offset = 0;
    let fCls;
    const len = formats.length;
    const styles = [];

    for (let f = 0; f < len; f++) {
        const format = formats[f];
        let nFormat;
        let end;
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
            fCls = [];
            if (backgrounds[getClassName(format.background)])
                fCls.push(' b', backgrounds[getClassName(format.background)]);
            else if (format.background) {
                backgrounds[getClassName(format.background)] = backgroundsCnt;
                fCls.push(' b', backgroundsCnt);
                styles.push(`.b${backgroundsCnt} { background-color: ${format.background}; }`);
                backgroundsCnt++;
            }
            if (colors[getClassName(format.color)])
                fCls.push(' c', colors[getClassName(format.color)]);
            else if (format.color) {
                colors[getClassName(format.color)] = colorsCnt;
                fCls.push(' c', colorsCnt);
                styles.push(`.c${colorsCnt} { color: ${format.color}; }`);
                colorsCnt++;
            }

            if (colors[getClassName(format.font)])
                fCls.push(' f', colors[getClassName(format.font)]);
            else if (format.font) {
                colors[getClassName(format.font)] = colorsCnt;
                fCls.push(' f', colorsCnt);
                styles.push(`.f${colorsCnt} { font-family: ${format.font}; }`);
                colorsCnt++;
            }
            if (colors[getClassName(format.size)])
                fCls.push(' f', colors[getClassName(format.size)]);
            else if (format.size) {
                colors[getClassName(format.size)] = colorsCnt;
                fCls.push(' f', colorsCnt);
                styles.push(`.f${colorsCnt} { font-size: ${format.size}; }`);
                colorsCnt++;
            }

            if (format.style !== FontStyle.None) {
                if ((format.style & FontStyle.Bold) === FontStyle.Bold)
                    fCls.push(' b');
                if ((format.style & FontStyle.Italic) === FontStyle.Italic)
                    fCls.push(' i');
                if ((format.style & FontStyle.Overline) === FontStyle.Overline)
                    fCls.push(' o');
                if ((format.style & FontStyle.DoubleUnderline) === FontStyle.DoubleUnderline || (format.style & FontStyle.Underline) === FontStyle.Underline)
                    fCls.push(' u');
                if ((format.style & FontStyle.DoubleUnderline) === FontStyle.DoubleUnderline)
                    fCls.push(' du');
                if ((format.style & FontStyle.Rapid) === FontStyle.Rapid || (format.style & FontStyle.Slow) === FontStyle.Slow) {
                    if (this.enableFlashing)
                        fCls.push(' ansi-blink');
                    else if ((format.style & FontStyle.DoubleUnderline) !== FontStyle.DoubleUnderline && (format.style & FontStyle.Underline) !== FontStyle.Underline)
                        fCls.push(' u');
                }
                if ((format.style & FontStyle.Strikeout) === FontStyle.Strikeout)
                    fCls.push(' s');
            }
            if (format.hr) {
                if (!backgrounds[getClassName(format.color)]) {
                    backgrounds[getClassName(format.color)] = backgroundsCnt;
                    fCls.push(' b', backgroundsCnt);
                    styles.push(`.b${backgroundsCnt} { background-color: ${format.color}; }`);
                    backgroundsCnt++;
                }
                parts.push('<span class="ansi', ...fCls, '"><div class="hr" class="b', backgrounds[getClassName(format.color)], '"></div></span>');
            }
            else if (end - offset !== 0)
                parts.push('<span class="ansi', ...fCls, '">', htmlEncode(text.substring(offset, end)), '</span>');
        }
        else if (format.formatType === FormatType.Link) {
            parts.push('<a draggable="false" class="URLLink" href="javascript:void(0);" title="', format.href, '" onclick="', this.linkFunction, '(\'', format.href, '\');return false;">');
            if (end - offset === 0) continue;
            parts.push('<span class="ansi', ...fCls, '">', htmlEncode(text.substring(offset, end)), '</span>');
        }
        else if (format.formatType === FormatType.LinkEnd || format.formatType === FormatType.MXPLinkEnd || format.formatType === FormatType.MXPSendEnd) {
            parts.push('</a>');
        }
        else if (format.formatType === FormatType.WordBreak)
            parts.push('<wbr>');
        else if (format.formatType === FormatType.MXPLink) {
            parts.push('<a draggable="false" class="MXPLink" href="javascript:void(0);" title="', format.href, '" onclick="', this.mxpLinkFunction, '(this, \'', format.href, '\');return false;">');
            if (end - offset === 0) continue;
            parts.push('<span class="ansi', ...fCls, '">', htmlEncode(text.substring(offset, end)), '</span>');
        }
        else if (format.formatType === FormatType.MXPSend) {
            parts.push('<a draggable="false" class="MXPLink" href="javascript:void(0);" title="', format.hint, '" onmouseover="', this.mxpTooltipFunction, '(this);" onclick="', this.mxpSendFunction, '(event||window.event, this, ', format.href, ', ', format.prompt ? 1 : 0, ', ', format.tt, ');return false;">');
            if (end - offset === 0) continue;
            parts.push('<span class="ansi', ...fCls, '">', htmlEncode(text.substring(offset, end)), '</span>');
        }
        else if (format.formatType === FormatType.MXPExpired && end - offset !== 0)
            parts.push('<span class="ansi', ...fCls, '">', htmlEncode(text.substring(offset, end)), '</span>');
        else if (format.formatType === FormatType.Image) {
            let tmp = '';
            parts.push();
            if (format.url.length > 0) {
                tmp += format.url;
                if (!tmp.endsWith('/'))
                    tmp += '/';
            }
            if (format.t.length > 0) {
                tmp += format.t;
                if (!tmp.endsWith('/'))
                    tmp += '/';
            }
            tmp += format.name;
            parts.push('<img src="', tmp, '"  style="');
            if (format.w.length > 0)
                parts.push('width:', formatUnit(format.w), ';');
            if (format.h.length > 0)
                parts.push('height:', formatUnit(format.h), ';');
            switch (format.align.toLowerCase()) {
                case 'left':
                    parts.push('float:left;');
                    break;
                case 'right':
                    parts.push('float:right;');
                    break;
                case 'top':
                case 'middle':
                case 'bottom':
                    parts.push('vertical-align:', format.align, ';');
                    break;
            }
            if (format.hspace.length > 0 && format.vspace.length > 0)
                parts.push('margin:', formatUnit(format.vspace), ' ', formatUnit(format.hspace), ';');
            else if (format.hspace.length > 0)
                parts.push('margin:0px ', formatUnit(format.hspace), ';');
            else if (format.vspace.length > 0)
                parts.push('margin:', formatUnit(format.vspace), ' 0px;');
            parts.push('"');
            if (format.ismap) parts.push(' ismap onclick="return false;"');
            parts.push(`src="${tmp}"/>`);
        }
    }
    if (styles.length)
        parts.push('<style>', ...styles, '</style>');
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

function formatUnit(str) {
    if (!str) return str;
    if (/^\d+c$/.test(str))
        return str + 'h';
    if (/^\d+$/.test(str))
        return parseInt(str, 10) + 'px';
    return str;
}