import EventEmitter = require('events');
import { Parser, ParserLine, ParserOptions } from "./parser";
import { AnsiColorCode } from "./ansi";
import { Size, stripHTML, getScrollBarHeight } from "./library";
const electron = require('electron');

export interface Line extends ParserLine {
    raw: string;
}

export interface DisplayOptions extends ParserOptions {
    enableSplit?: boolean;
    enableSplitLive?: boolean;
}

interface Overlays {
    selection: string[];
    find: string[];
}

interface Point {
    x: number,
    y: number
}

interface Selection {
    start: Point;
    end: Point;
    scroll: Point;
    drag: boolean;
}

interface Range {
    start: number;
    end: number;
}

export class Display extends EventEmitter {
    private _parser: Parser;
    private _el: HTMLElement;
    private _elJ: JQuery;
    private _overlay: HTMLElement;
    private _view: HTMLElement;
    private _maxLineLength: number = 0;
    private _currentSelection: Selection = {
        start: { x: null, y: null },
        end: { x: null, y: null },
        scroll: { x: null, y: null },
        drag: false
    };
    private _character: HTMLElement;
    private _viewRange: Range = { start: 0, end: 0 };
    private _enableDebug: boolean = false;

    public lines: string[] = [];
    public _maxLines: number = 5000;
    private _charHeight: number;
    private _charWidth: number;
    private _htmlCache: string[] = [];
    private _overlays: Overlays = {
        selection: [],
        find: []
    };

    public scrollLock: boolean = false;

    constructor(display: string, options?);
    constructor(display: JQuery, options?);
    constructor(display: HTMLElement, options?);
    constructor(display?: any, options?: DisplayOptions) {
        super();
        if (!display)
            throw "Display must be an id, element or jquery object";
        if (typeof display === "string") {
            if (display.startsWith("#"))
                this._el = document.getElementById(display.substr(1));
            else
                this._el = document.getElementById(display);
        }
        else if (display instanceof $)
            this._el = display[0];
        else if (display instanceof HTMLElement)
            this._el = display;
        else
            throw "Display must be an id, element or jquery object";

        this._elJ = $(this._el);

        this._overlay = document.createElement('div')
        this._overlay.id = this._el.id + "-overlay";
        this._el.appendChild(this._overlay);

        this._view = document.createElement('div')
        this._view.id = this._el.id + "-view";
        this._el.appendChild(this._view);

        this._character = document.createElement('div');
        this._character.id = 'Character';
        this._character.className = 'ansi';
        this._character.style.borderBottom = '1px solid black';
        this._character.innerText = 'W';
        document.body.appendChild(this._character);

        this._charHeight = Math.ceil($(this._character).innerHeight() + 0.5);
        this._charWidth = this._character.clientWidth;
        if (!options)
            options = { display: this }
        else
            options.display = this;
        this._parser = new Parser(options);
        this._parser.on('debug', (msg) => { this.debug(msg) });

        this._parser.on('bell', () => { this.emit('bell') })

        this._parser.on('add-line', (data: Line) => {
            var t;
            data.raw = stripHTML(data.line);
            this.emit('add-line', data);
            if (data === null || typeof data == "undefined" || data.line === null || typeof data.line == "undefined" || data.line.length === 0)
                return;
            this.emit('add-line-done', data);
            if (data.gagged)
                return;
            t = $(data.line);
            //clean up any empty elements to reduce memory and processing times
            $("span:empty", t).remove();
            this.lines.push(data.raw);
            //t.css('top', ((this.lines.length - 1) * this._charHeight) + "px");
            //t.css('height', (this._charHeight) + "px");
            //t.data('index', this.lines.length - 1);
            if (data.raw.length > this._maxLineLength)
                this._maxLineLength = data.raw.length;
            this._htmlCache.push(t[0]);
        });

        this._parser.on('expire-links', (args) => {
            //TODO loop html and strip out expired links
            /*
            var expire;
            if (args.length > 0)
                expire = this.display.find("a[expire='" + args[0] + "']");
            else
                expire = this.display.find("a[expire]");
            expire.wrapInner('<span/>');
            if (args.length > 0)
                expire = this.display.find("a[expire='" + args[0] + "'] span");
            else
                expire = this.display.find("a[expire] span");
            expire.unwrap();
            */

            this.emit('expire-links', args);
        });

        this._parser.on("parse-done", () => {
            //disable animation
            this._el.classList.remove('animate');
            let bar = this._elJ.hasHorizontalScrollBar();
            //TODO update overlays, either remove or recalculate
            $(this._view).append(this._htmlCache);
            this.trimLines();
            //this.updateView();
            if (bar != this._elJ.hasHorizontalScrollBar())
                this.updateWindow();
            //TODO split screen support
            this.scrollDisplay();
            this.emit('parse-done');
            this._htmlCache = [];

            //renable animation so they are all synced
            this._el.classList.add('animate');
        });

        this._parser.on('set-title', (title, type) => {
            this.emit('set-title', title, type);
        });
        this._parser.on('music', (data) => {
            this.emit('music', data);
        });
        this._parser.on('sound', (data) => {
            this.emit('sound', data);
        });

        this._el.addEventListener('scroll', (e) => {
            this.updateView();
        });

    }

    get maxLines(): number { return this._maxLines; }
    set maxLines(value: number) {
        if (value != this._maxLines) {
            this._maxLines = value;
            this.trimLines();
        }
    }

    get enableDebug(): boolean {
        return this._enableDebug;
    }

    set enableDebug(enable: boolean) {
        this._enableDebug = enable;
        this._parser.enableDebug = enable;
    }

    get textLength(): number {
        return this._parser.textLength;
    }

    get EndOfLine(): boolean {
        return this._parser.EndOfLine;
    }

    set enableFlashing(value: boolean) {
        this._parser.enableFlashing = value;
    }
    get enableFlashing(): boolean {
        return this._parser.enableFlashing;
    }

    set enableMXP(value: boolean) {
        this._parser.enableMXP = value;
    }
    get enableMXP(): boolean {
        return this._parser.enableMXP;
    }

    set enableBell(value: boolean) {
        this._parser.enableBell = value;
    }
    get enableBell(): boolean {
        return this._parser.enableBell;
    }

    set linkFunction(value: string) {
        this._parser.linkFunction = value;
    }
    get linkFunction(): string {
        return this._parser.linkFunction;
    }

    set mxpLinkFunction(value: string) {
        this._parser.mxpLinkFunction = value;
    }
    get mxpLinkFunction(): string {
        return this._parser.mxpLinkFunction;
    }

    set mxpSendFunction(value: string) {
        this._parser.mxpSendFunction = value;
    }
    get mxpSendFunction(): string {
        return this._parser.mxpSendFunction;
    }

    set mxpTooltipFunction(value: string) {
        this._parser.mxpTooltipFunction = value;
    }
    get mxpTooltipFunction(): string {
        return this._parser.mxpTooltipFunction;
    }

    set enableURLDetection(value: boolean) {
        this._parser.enableURLDetection = value;
    }
    get enableURLDetection(): boolean {
        return this._parser.enableURLDetection;
    }

    set enableMSP(value: boolean) {
        this._parser.enableMSP = value;
    }
    get enableMSP(): boolean {
        return this._parser.enableMSP;
    }

    set displayControlCodes(value: boolean) {
        this._parser.displayControlCodes = value;
    }
    get displayControlCodes(): boolean {
        return this._parser.displayControlCodes;
    }

    set emulateTerminal(value: boolean) {
        this._parser.emulateTerminal = value;
    }
    get emulateTerminal(): boolean {
        return this._parser.emulateTerminal;
    }

    public debug(msg) {
        this.emit('debug', msg);
    }

    public append(txt: string, remote?: boolean, force?: boolean) {
        this._parser.parse(txt, remote || false, force || false);
    }

    public CurrentAnsiCode() {
        return this._parser.CurrentAnsiCode();
    }

    public updateWindow(width?, height?) {
        if (width === undefined) {
            width = this.WindowWidth;
            height = this.WindowHeight;
        }
        this._parser.updateWindow(width, height);
        this.emit('update-window', width, height);
    };

    public clear() {
        this._parser.Clear();
        this.lines = [];
        this._overlays = {
            selection: [],
            find: []
        }
        this._htmlCache = [];
        this._viewRange = { start: 0, end: 0 };
        this._maxLineLength = 0;
        this._overlay.innerHTML = null;
        this._view.innerHTML = null;
        this._currentSelection = {
            start: { x: null, y: null },
            end: { x: null, y: null },
            scroll: { x: null, y: null },
            drag: false
        };
        this._parser.Clear();
    };

    public updateFont(font?: string, size?: string) {
        if (!font || font.length === 0)
            font = "'Courier New', Courier, monospace";
        else //fall back just incase
            font += ", monospace";
        if (!size || size.length === 0)
            size = "1em";
        if (font != this._el.style.fontFamily || size != this._el.style.fontSize) {
            //set styles using raw javascript for minor speed
            this._el.style.fontSize = size;
            this._el.style.fontFamily = font;
            this._character.style.fontSize = size;
            this._character.style.fontFamily = font;
            //recalculate height/width of characters so display can be calculated
            this._charHeight = Math.ceil($(this._character).innerHeight() + 0.5);
            this._charWidth = this._character.clientWidth;

            /*
            let html = this._htmlLines, t;
            let h = this._charHeight;
            for (let l = 0, ll = html.length; l < ll; l++) {
                t = $(html[l]);
                t.css('top', (l * h) + "px");
                html[l] = t[0].outerHTML;
            }
            */
            //update view to display any line height changes
            this.updateView();
        }
    }

    public updateView() {
        /*
        let w = this._maxLineLength * this._charWidth;
        let h = this.lines.length * this._charHeight;
        this._view.style.height = h + "px";
        this._view.style.width = w + "px";

        this._overlay.style.height = Math.max(h, this._el.clientHeight) + "px";
        this._overlay.style.width = Math.max(w, this._el.clientWidth) + "px";

        this._viewRange.start = Math.floor(this._el.scrollTop / this._charHeight) - 6;
        if (this._viewRange.start < 0)
            this._viewRange.start = 0;
        this._viewRange.end = Math.ceil((this._el.scrollTop + this._elJ.innerHeight()) / this._charHeight) + 6;
        if (this._viewRange.end >= this.lines.length)
            this._viewRange.end = this.lines.length - 1;
        let lines = this._htmlLines.slice(this._viewRange.start, this._viewRange.end + 1);
        $(this._view).empty().append(lines);
        */
        //this._view.innerHTML = lines.join('');
        this.updateOverlays();
    }

    public updateOverlays(start?: number, end?: number) {
        if (start === undefined)
            start = this._viewRange.start;
        if (end === undefined)
            end = this._viewRange.end
        let overlays = [];
        for (let ol in this._overlays) {
            if (!this._overlays.hasOwnProperty(ol))
                continue;
            overlays.push.apply(overlays, this._overlays[ol].slice(start, end));
        }
        this._overlay.innerHTML = overlays.join('');
    }

    public scrollDisplay() {
        if (!this.scrollLock)
            this._el.scrollTop = this._el.scrollHeight;
    }

    get WindowSize(): Size {
        return new Size(this.WindowWidth, this.WindowHeight);
    }

    get WindowWidth(): number {
        return Math.floor((this._elJ.innerWidth() - 12) / parseFloat(window.getComputedStyle(this._character).width)) - 1;
    }

    get WindowHeight(): number {
        if (this._elJ.hasHorizontalScrollBar())
            return Math.floor((this._elJ.innerHeight() - 12 - 4) / ($(this._character).innerHeight() + 0.5)) - 1;
        return Math.floor((this._elJ.innerHeight() - 4) / ($(this._character).innerHeight() + 0.5)) - 1;
    }

    click(callback) {
        this._elJ.click(callback);
    }

    removeLine(line: number) {
        if (line < 0 || line >= this.lines.length) return;
        this.emit('line-removed', line, this.lines[line]);
        this.lines.splice(line, 1);
        $($(this._view).children().splice(line, 1)).remove();
        //let lines = this._view.children;
        //let h = this._charHeight;
        //for (let l = 0, ll = lines.length; l < ll; l++)
            //(lines[l] as HTMLElement).style.top = l * h + "px";


        //TODO redo overlays
        this.updateView();
    }

    SetColor(code: number, color) {
        this._parser.SetColor(code, color);
    }

    ClearMXP() {
        this._parser.ClearMXP();
    }

    ResetMXPLine() {
        this._parser.ResetMXPLine();
    }

    get html(): string {
        return $(this._view).html();
    }

    get text(): string {
        return this.lines.join('\n');
    }

    public trimLines() {
        if (this.lines.length > this._maxLines) {
            this.lines.splice(0, this.lines.length - this._maxLines);
            $(this._view).children().slice(0, this.lines.length - this._maxLines).remove()

            let m = 0;
            let lines = this.lines;
            let t;
            let h = this._charHeight;
            //let html = $(this._view).children();
            for (let l = 0, ll = lines.length; l < ll; l++) {
                if (lines[l].length > m)
                    m = lines[l].length;
                //t = $(html[l]);
                //t.css('top', (l * h) + "px");
            }
            this._maxLineLength = m;
        }
    }

}
