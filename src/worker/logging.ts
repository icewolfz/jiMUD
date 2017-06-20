const fs = require("fs");
const path = require("path");

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
    Rapid = 32,/** @desc Rapid blink text combined with slow for final blink */
    Inverse = 64,/** @desc reverse back and fore color */
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
}

let options: LogOptions = {
    path: "",
    offline: false,
    gagged: false,
    enabled: false,
    unique: true,
    prepend: false,
    name: "",
    what: Log.Html,
    debug: false
}

let connected: boolean = false;
let timeStamp: number = 0;
let logging: boolean = false;
let currentFile: string = "";

self.addEventListener('message', (e: MessageEvent) => {
    postMessage({ event: 'debug', args: e.data });
    if (!e.data) return;
    switch (e.data.action) {
        case 'options':
            for (let option in e.data.args) {
                if (!e.data.args.hasOwnProperty(option))
                    continue;
                if (option == "path") {
                    if (options.path != e.data.args.path) {
                        options.path = e.data.args.path;
                        if (!fs.existsSync(options.path))
                            fs.mkdirSync(options.path);
                        if (logging)
                            fileChanged();
                    }
                }
                else
                    options[option] = e.data.args[option];
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
        case 'start':
            if (!e.data.args)
                start([], [], [], false);
            else
                start(e.data.args.lines, e.data.args.raw, e.data.args.formats, e.data.args.fragment);
            break;
        case 'add-line':
            var data = e.data.args;
            if (!data.gagged || (options.gagged && data.gagged)) {
                if ((options.what & Log.Html) === Log.Html) {
                    //TODO build html from formats
                    //writeHtml("");
                }
                if ((options.what & Log.Text) === Log.Text || options.what === Log.None)
                    writeText(data.line + "\n");
                if ((options.what & Log.Raw) === Log.Raw)
                    writeRaw(data.raw);
            }
            break;
    }
}, false);

function fileChanged() {
    if ((options.what & Log.Html) === Log.Html) {
        var f = path.join(options.path, timeStamp.toString()) + ".htm";
        buildFilename();
        if (fs.existsSync(f) && f != currentFile + ".htm")
            fs.renameSync(f, currentFile);
        if (options.debug)
            postMessage({ event: 'debug', args: 'File changed: "' + f + '" to "' + currentFile + '"' });
    }
    if ((options.what & Log.Text) === Log.Text || options.what === Log.None) {
        var f = path.join(options.path, timeStamp.toString()) + ".txt";
        buildFilename();
        if (fs.existsSync(f) && f != currentFile + ".txt")
            fs.renameSync(f, currentFile);
        if (options.debug)
            postMessage({ event: 'debug', args: 'File changed: "' + f + '" to "' + currentFile + '"' });
    }
    if ((options.what & Log.Raw) === Log.Raw) {
        var f = path.join(options.path, timeStamp.toString()) + ".raw.txt";
        buildFilename();
        if (fs.existsSync(f) && f != currentFile + ".raw.txt")
            fs.renameSync(f, currentFile);
        if (options.debug)
            postMessage({ event: 'debug', args: 'File changed: "' + f + '" to "' + currentFile + '"' });
    }
}

function buildFilename() {
    currentFile = timeStamp.toString();
    if (options.name && options.name.length > 0)
        currentFile += "." + options.name;
    currentFile = path.join(options.path, currentFile);
    if (options.debug)
        postMessage({ event: 'debug', args: 'Log file: "' + currentFile + '"' });
}

function writeHeader() {
    buildFilename();
    if (!fs.existsSync(currentFile + ".htm") && (options.what & Log.Html) === Log.Html)
        fs.appendFile(currentFile + ".htm", "<style>\nbody\n{\n	font-family: \'Courier New\', Courier, monospace;\n	text-align: left;\n	font-size: 1em;\n	white-space: pre;\n	background-color: black;	\n}\n/* --- Start CSS for ansi display --- */\n@-webkit-keyframes blinker { \n 	0% { opacity: 1.0; }\n  50% { opacity: 0.0; }\n  100% { opacity: 1.0; }\n} \n\n@keyframes blinker { \n 	0% { opacity: 1.0; }\n  50% { opacity: 0.0; }\n  100% { opacity: 1.0; }\n} \n\n.ansi-blink { \n	text-decoration:blink;\n	animation-name: blinker;\n	animation-iteration-count: infinite; \n	animation-timing-function: cubic-bezier(1.0,0,0,1.0); \n	animation-duration: 1s; \n	-webkit-animation-name: blinker;\n	-webkit-animation-iteration-count: infinite; \n	-webkit-animation-timing-function: cubic-bezier(1.0,0,0,1.0); \n	-webkit-animation-duration: 1s; \n}\n\n.ansi\n{\n	padding: 0px;\n	margin:0px;\n	\n}\n\n.line \n{\n	word-wrap:break-word;\n	word-break:break-all;\n	width: 100%;\n	display: block;\n	padding-bottom:1px;\n	clear:both;\n	line-height: normal;\n}	\n\n.line hr{ border: 0px; }\n/* --- End CSS for ansi display --- */\n\n.line a, .line a:link \n{\n	color: inherit;\n	font-weight: inherit;\n	text-decoration: underline;\n}\n\n.URLLink, .URLLink:link\n{\n	text-decoration: underline;\n	cursor: pointer;\n}\n</style>\n", (err) => {
            postMessage({ event: 'error', args:err });
        });
}

function writeText(data) {
    if (!logging || (!options.offline && !connected)) return;
    writeHeader();
    fs.appendFile(currentFile + ".txt", data, (err) => {
        postMessage({ event: 'error', args:err });
    });
}

function writeHtml(data) {
    if (!logging || (!options.offline && !connected)) return;
    writeHeader();
    fs.appendFile(currentFile + ".htm", data, (err) => {
        postMessage({ event: 'error', args:err });
    });
}

function writeRaw(data) {
    if (!logging || (!options.offline && !connected)) return;
    writeHeader();
    fs.appendFile(currentFile + ".raw.txt", data, (err) => {
        postMessage({ event: 'error', args:err });
    });
}

function start(lines: string[], raw: string[], formats: any[], fragment:boolean) {
    if (!options.enabled)
    {
        if(logging)
            stop();
        return;
    }
    logging = true;
    if (options.unique || timeStamp === 0)
        timeStamp = new Date().getTime();
    buildFilename();
    if (options.prepend) {
        if ((options.what & Log.Html) === Log.Html) {
            //TODO build html from formats
            //writeHtml("");
        }
        if ((options.what & Log.Text) === Log.Text || options.what === Log.None)
            writeText(lines.join('\n') + (fragment || lines.length === 0 ? "" :"\n"));
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
    var c = options.unique;
    options.unique = false;
    if (options.enabled && !logging)
        postMessage({ event: 'start' });
    else if (!options.enabled && logging)
        stop();
    options.unique = c;
}
