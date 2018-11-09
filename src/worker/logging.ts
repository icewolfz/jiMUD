//spellchecker:ignore ismap yyyymmdd hmmss rgbcolor
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const RGBColor = require('rgbcolor');

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
let colorTable = null;

self.addEventListener('message', (e: MessageEvent) => {
    let c;
    if (!e.data) return;
    switch (e.data.action) {
        case 'options':
            let option;
            for (option in e.data.args) {
                if (!e.data.args.hasOwnProperty(option))
                    continue;
                if (option === 'colors') {
                    const _colors = e.data.args[option];
                    if (_colors.length > 0) {
                        let clr;
                        const cl = _colors.length;
                        for (clr = 0; clr < cl; clr++) {
                            if (!_colors[clr] || _colors[clr].length === 0) continue;
                            SetColor(clr, _colors[clr]);
                        }
                    }
                    continue;
                }
                else if (option === 'path') {
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
                flushBuffer.offline = options.offline;
                flushBuffer.what = options.what;
                flushBuffer.gagged = data.gagged || (options.gagged && data.gagged);
                return;
            }
            //clear buffer
            flushBuffer = null;
            if (!logging || (!options.offline && !connected)) return;
            if (data.gagged && !options.gagged) return;
            if ((options.what & Log.Html) === Log.Html)
                writeHtml(createLine(data.line, data.formats));
            if ((options.what & Log.Text) === Log.Text || options.what === Log.None)
                writeText(data.line + '\n');
            if ((options.what & Log.Raw) === Log.Raw)
                writeRaw(data.raw);
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
    //no buffer or not logging at that point so bail
    if (!flushBuffer || !flushBuffer.logging || (!flushBuffer.offline && !flushBuffer.connected)) return;
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
        let color;
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
            color = format.background;
            if (typeof color === 'number')
                color = GetColor(color);
            if (backgrounds[getClassName(color)])
                fCls.push(' b', backgrounds[getClassName(color)]);
            else if (color) {
                backgrounds[getClassName(color)] = backgroundsCnt;
                fCls.push(' b', backgroundsCnt);
                styles.push(`.b${backgroundsCnt} { background-color: ${color}; }`);
                backgroundsCnt++;
            }
            color = format.color;
            if (typeof color === 'number')
                color = GetColor(color);
            if (colors[getClassName(color)])
                fCls.push(' c', colors[getClassName(color)]);
            else if (color) {
                colors[getClassName(color)] = colorsCnt;
                fCls.push(' c', colorsCnt);
                styles.push(`.c${colorsCnt} { color: ${color}; }`);
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
                color = format.color;
                if (typeof color === 'number')
                    color = GetColor(color);
                if (!backgrounds[getClassName(color)]) {
                    backgrounds[getClassName(color)] = backgroundsCnt;
                    fCls.push(' b', backgroundsCnt);
                    styles.push(`.b${backgroundsCnt} { background-color: ${color}; }`);
                    backgroundsCnt++;
                }
                parts.push('<span class="ansi', ...fCls, '"><div class="hr" class="b', backgrounds[getClassName(color)], '"></div></span>');
            }
            else if (end - offset !== 0)
                parts.push('<span class="ansi', ...fCls, '">', htmlEncode(text.substring(offset, end)), '</span>');
        }
        else if (format.formatType === FormatType.Link) {
            parts.push('<a draggable="false" class="URLLink" href="javascript:void(0);" title="', format.href.replace(/"/g, '&quot;'), '" onclick="doLink(\'', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), '\');return false;">');
            if (end - offset === 0) continue;
            parts.push('<span class="ansi', ...fCls, '">', htmlEncode(text.substring(offset, end)), '</span>');
        }
        else if (format.formatType === FormatType.LinkEnd || format.formatType === FormatType.MXPLinkEnd || format.formatType === FormatType.MXPSendEnd) {
            parts.push('</a>');
        }
        else if (format.formatType === FormatType.WordBreak)
            parts.push('<wbr>');
        else if (format.formatType === FormatType.MXPLink) {
            parts.push('<a draggable="false" class="MXPLink" href="javascript:void(0);" title="', format.href.replace(/"/g, '&quot;'), '" onclick="doMXPLink(this, \'', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), '\');return false;">');
            if (end - offset === 0) continue;
            parts.push('<span class="ansi', ...fCls, '">', htmlEncode(text.substring(offset, end)), '</span>');
        }
        else if (format.formatType === FormatType.MXPSend) {
            parts.push('<a draggable="false" class="MXPLink" href="javascript:void(0);" title="', format.hint.replace(/"/g, '&quot;'), '" onmouseover="doMXPTooltip(this);" onclick="doMXPSend(event||window.event, this, ', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), ', ', format.prompt ? 1 : 0, ', ', format.tt.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), ');return false;">');
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

function buildColorTable() {
    const _ColorTable: string[] = [];
    let r;
    let g;
    let b;
    let idx;
    for (r = 0; r < 6; r++) {
        for (g = 0; g < 6; g++) {
            for (b = 0; b < 6; b++) {
                idx = 16 + (r * 36) + (g * 6) + b;
                _ColorTable[idx] = 'rgb(';
                if (r > 0)
                    _ColorTable[idx] += r * 40 + 55;
                else
                    _ColorTable[idx] += '0';
                _ColorTable[idx] += ',';
                if (g > 0)
                    _ColorTable[idx] += g * 40 + 55;
                else
                    _ColorTable[idx] += '0';
                _ColorTable[idx] += ',';
                if (b > 0)
                    _ColorTable[idx] += b * 40 + 55;
                else
                    _ColorTable[idx] += '0';
                _ColorTable[idx] += ')';
            }
        }
    }
    for (r = 232; r <= 255; r++)//grayscale
    {
        g = (r - 232) * 10 + 8;
        _ColorTable[r] = ['rgb(', g, ',', g, ',', g, ')'].join('');
    }
    _ColorTable[0] = 'rgb(0,0,0)'; //black fore
    _ColorTable[1] = 'rgb(128, 0, 0)'; //red fore
    _ColorTable[2] = 'rgb(0, 128, 0)'; //green fore
    _ColorTable[3] = 'rgb(128, 128, 0)'; //yellow fore
    _ColorTable[4] = 'rgb(0, 0, 238)'; //blue fore
    _ColorTable[5] = 'rgb(128, 0, 128)'; //magenta fore
    _ColorTable[6] = 'rgb(0, 128, 128)'; //cyan fore
    _ColorTable[7] = 'rgb(187, 187, 187)'; //white fore
    _ColorTable[8] = 'rgb(128, 128, 128)'; //black  bold
    _ColorTable[9] = 'rgb(255, 0, 0)'; //Red bold
    _ColorTable[10] = 'rgb(0, 255, 0)'; //green bold
    _ColorTable[11] = 'rgb(255, 255, 0)'; //yellow bold
    _ColorTable[12] = 'rgb(92, 92, 255)'; //blue bold
    _ColorTable[13] = 'rgb(255, 0, 255)'; //magenta bold
    _ColorTable[14] = 'rgb(0, 255, 255)'; //cyan bold
    _ColorTable[15] = 'rgb(255, 255, 255)'; //white bold
    _ColorTable[256] = 'rgb(0, 0, 0)'; //black faint
    _ColorTable[257] = 'rgb(118, 0, 0)'; //red  faint
    _ColorTable[258] = 'rgb(0, 108, 0)'; //green faint
    _ColorTable[259] = 'rgb(145, 136, 0)'; //yellow faint
    _ColorTable[260] = 'rgb(0, 0, 167)'; //blue faint
    _ColorTable[261] = 'rgb(108, 0, 108)'; //magenta faint
    _ColorTable[262] = 'rgb(0, 108, 108)'; //cyan faint
    _ColorTable[263] = 'rgb(161, 161, 161)'; //white faint
    _ColorTable[264] = 'rgb(0, 0, 0)'; //BackgroundBlack
    _ColorTable[265] = 'rgb(128, 0, 0)'; //red back
    _ColorTable[266] = 'rgb(0, 128, 0)'; //greenback
    _ColorTable[267] = 'rgb(128, 128, 0)'; //yellow back
    _ColorTable[268] = 'rgb(0, 0, 238)'; //blue back
    _ColorTable[269] = 'rgb(128, 0, 128)'; //magenta back
    _ColorTable[270] = 'rgb(0, 128, 128)';  //cyan back
    _ColorTable[271] = 'rgb(187, 187, 187)';  //white back

    _ColorTable[272] = 'rgb(0,0,0)'; //iceMudInfoBackground
    _ColorTable[273] = 'rgb(0, 255, 255)';  //iceMudInfoText
    _ColorTable[274] = 'rgb(0,0,0)'; //LocalEchoBackground
    _ColorTable[275] = 'rgb(255, 255, 0)';  //LocalEchoText
    _ColorTable[276] = 'rgb(0, 0, 0)';  //DefaultBack
    _ColorTable[277] = 'rgb(229, 229, 229)';  //DefaultFore

    _ColorTable[278] = 'rgb(205, 0, 0)';  //ErrorFore
    _ColorTable[279] = 'rgb(229, 229, 229)';  //ErrorBack

    _ColorTable[280] = 'rgb(255,255,255)';  //DefaultBrightFore
    colorTable = _ColorTable;
}

function GetColor(code) {
    if (colorTable == null)
        buildColorTable();
    switch (code) {
        case -12:
            return colorTable[279];  //ErrorBack
        case -11:
            return colorTable[278];  //ErrorFore
        case -10:
            return colorTable[280];  //DefaultBrightFore
        case -8:
            return colorTable[272]; //iceMudInfoBackground
        case -7:
            return colorTable[273];  //iceMudInfoText
        case -4:
            return colorTable[274]; //LocalEchoBackground
        case -3:
            return colorTable[275];  //LocalEchoText
        case 49:
        case -2:
            return colorTable[276];  //DefaultBack
        case 39:
        case -1:
            return colorTable[277];  //DefaultBack
        case 0:
        case 30: //set foreground color to black
            return colorTable[0];
        case 1:
        case 31: //set foreground color to red
            return colorTable[1];
        case 2:
        case 32: //set foreground color to green
            return colorTable[2];
        case 3:
        case 33:  //set foreground color to yellow
            return colorTable[3];
        case 4:
        case 34: //set foreground color to blue
            return colorTable[4];
        case 5:
        case 35:  //set foreground color to magenta (purple)
            return colorTable[5];
        case 6:
        case 36:  //set foreground color to cyan
            return colorTable[6];
        case 7:
        case 37:  //set foreground color to white
            return colorTable[7];
        case 40:  //background black
            return colorTable[264];
        case 41:  //background red
            return colorTable[265];
        case 42:  //background green
            return colorTable[266];
        case 43:  //background yellow
            return colorTable[267];
        case 44:  //background blue
            return colorTable[268];
        case 45:  //background magenta
            return colorTable[269];
        case 46:  //cyan
            return colorTable[270];
        case 47:  //white
            return colorTable[271];
        case 8:
        case 90:
        case 100:
        case 300: //set foreground color to black
        case 400:
            return colorTable[8];
        case 9:
        case 91:
        case 101:
        case 310: //set foreground color to red
        case 410:
            return colorTable[9];
        case 10:
        case 92:
        case 102:
        case 320: //set foreground color to green
        case 420:
            return colorTable[10];
        case 11:
        case 93:
        case 103:
        case 330:  //set foreground color to yellow
        case 430:
            return colorTable[11];
        case 12:
        case 94:
        case 104:
        case 340: //set foreground color to blue
        case 440:
            return colorTable[12];
        case 13:
        case 95:
        case 105:
        case 350:  //set foreground color to magenta (purple)
        case 450:
            return colorTable[13];
        case 14:
        case 96:
        case 106:
        case 360:  //set foreground color to cyan
        case 460:
            return colorTable[14];
        case 15:
        case 97:
        case 107:
        case 370:  //set foreground color to white
        case 470:
            return colorTable[15];
        case 4000:
        case 3000: //set foreground color to black
            return colorTable[256];
        case 4100:
        case 3100: //set foreground color to red
            return colorTable[257];
        case 4200:
        case 3200: //set foreground color to green
            return colorTable[258];
        case 4300:
        case 3300:  //set foreground color to yellow
            return colorTable[259];
        case 4400:
        case 3400: //set foreground color to blue
            return colorTable[260];
        case 4500:
        case 3500:  //set foreground color to magenta (purple)
            return colorTable[261];
        case 4600:
        case 3600:  //set foreground color to cyan
            return colorTable[262];
        case 4700:
        case 3700:  //set foreground color to white
            return colorTable[263];
        default:
            if (code <= -16) {
                code += 16;
                code *= -1;
            }
            if (code >= 0 && code < 281)
                return colorTable[code];
            return colorTable[277];
    }
}

function SetColor(code: number, color) {
    if (colorTable == null)
        buildColorTable();
    if (code < 0 || code >= colorTable.length)
        return;
    color = new RGBColor(color);
    if (!color.ok) return;
    colorTable[code] = color.toRGB();
}