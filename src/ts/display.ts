import EventEmitter = require('events');
import { Parser, ParserLine, ParserOptions, LineFormat, FormatType, FontStyle, ImageFormat, LinkFormat } from "./parser";
import { AnsiColorCode } from "./ansi";
import { clone, Size, stripHTML, getScrollBarSize, htmlEncode } from "./library";
const electron = require('electron');

export interface DisplayOptions extends ParserOptions {
    enableSplit?: boolean;
    enableSplitLive?: boolean;
}

interface Overlays {
    selection: any[];
    find: any[];
}

interface Point {
    x: number,
    y: number
}

interface Selection {
    start: Point;
    end: Point;
    drag: boolean;
    scrollTimer: NodeJS.Timer;
}

interface Range {
    start: number;
    end: number;
}

interface ScrollState {
    dragging: boolean,
    dragPosition: number,
    position: number
}

export enum ScrollType { vertical = 0, horizontal = 1 }

enum CornerType {
    Flat = 0,
    Extern = 1,
    Intern = 2
}

interface ContextEvent extends PointerEvent {
    word: string;
    url: string;
    line: string;
}

export class Display extends EventEmitter {
    private _parser: Parser;
    private _el: HTMLElement;
    private _elJ: JQuery;
    private _os;

    private _overlay: HTMLElement;
    private _view: HTMLElement;
    private _background: HTMLElement;

    private _maxLineLength: number = 0;
    private _currentSelection: Selection = {
        start: { x: null, y: null },
        end: { x: null, y: null },
        scrollTimer: null,
        drag: false
    };
    private _borderSize: Size = { width: 0, height: 0 };
    private _character: HTMLElement;
    private _viewRange: Range = { start: 0, end: 0 };
    private _enableDebug: boolean = false;
    private _lastMouse: MouseEvent;
    private _mouseTimer;



    public lines: string[] = [];
    private lineFormats = [];
    public _maxLines: number = 5000;
    private _charHeight: number;
    private _charWidth: number;
    private _viewLines: string[] = [];
    private _backgroundLines: string[] = [];
    private _overlays: Overlays = {
        selection: [],
        find: []
    };

    private _VScroll: ScrollBar;
    private _HScroll: ScrollBar;

    private _expire = {};

    public scrollLock: boolean = false;

    private _linkFunction;
    private _mxpLinkFunction;
    private _mxpSendFunction;
    private _mxpTooltipFunction;


    get linkFunction(): string {

        return this._linkFunction || "doLink";
    }

    set linkFunction(val: string) {
        this._linkFunction = val;
    }

    get mxpLinkFunction(): string {
        return this._mxpLinkFunction || "doMXPLink";
    }

    set mxpLinkFunction(val: string) {
        this._mxpLinkFunction = val;
    }

    get mxpSendFunction(): string {
        return this._mxpSendFunction || "doMXPSend";
    }

    set mxpSendFunction(val: string) {
        this._mxpSendFunction = val;
    }

    get mxpTooltipFunction(): string {
        return this._mxpTooltipFunction || "doMXPTooltip";
    }

    set mxpTooltipFunction(val: string) {
        this._mxpTooltipFunction = val;
    }

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

        this._background = document.createElement('div')
        this._background.id = this._el.id + "-background";
        this._el.appendChild(this._background);

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
        this._charWidth = parseFloat(window.getComputedStyle(this._character).width);

        this._VScroll = new ScrollBar(this._el, this._view);
        this._VScroll.on('scroll', (amt) => {
            this._view.style.top = -amt + "px";
            this._background.style.top = -amt + "px";
            this._overlay.style.top = -amt + "px";
            this.updateView();
        })
        this._HScroll = new ScrollBar(this._el, this._view);
        this._HScroll.type = ScrollType.horizontal;
        this._HScroll.on('scroll', (amt) => {
            this._view.style.left = -amt + "px";
            this._background.style.left = -amt + "px";
            this._overlay.style.left = -amt + "px";
        })
        this.update();

        if (!options)
            options = { display: this }
        else
            options.display = this;
        this._parser = new Parser(options);
        this._parser.on('debug', (msg) => { this.debug(msg) });

        this._parser.on('bell', () => { this.emit('bell') })

        this._parser.on('add-line', (data: ParserLine) => {
            var t;
            this.emit('add-line', data);
            if (data === null || typeof data == "undefined" || data.line === null || typeof data.line == "undefined")
                return;
            this.emit('add-line-done', data);
            if (data.gagged)
                return;
            if (data.line === "\n" || data.line.length == 0)
                this.lines.push("");
            else
                this.lines.push(data.line);
            this.lineFormats.push(data.formats);
            if (data.line.length > this._maxLineLength)
                this._maxLineLength = data.line.length;
            t = this.createLine();
            this._viewLines.push(t[0]);
            this._backgroundLines.push(t[1]);
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
            //$(this._view).append(this._viewCache);
            //$(this._background).append(this._backgroundCache);
            this.trimLines();
            this.updateView();
            this.updateScrollbars();
            if (bar != this._elJ.hasHorizontalScrollBar())
                this.updateWindow();
            //TODO split screen support
            this.scrollDisplay();
            this.emit('parse-done');
            //this._viewCache = [];
            //this._backgroundCache = [];

            //re-enable animation so they are all synced
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
            //this.updateView();
        });

        this._el.addEventListener('mousedown', (e) => {
            if (e.buttons && e.button == 0) {
                e.preventDefault();
                e.cancelBubble = true;
                var os = this._os;
                if (e.pageX - os.left > this._el.clientWidth)
                    return;
                if (e.pageY - os.top > this._el.clientHeight)
                    return;
                this._currentSelection.drag = true;
                if (e.shiftKey) {
                    var o = this._currentSelection.end;
                    this._currentSelection.end = this.getLineOffset(e);
                    this.emit('selection-start');
                    this.updateSelectionRange(o);
                }
                else {
                    this._currentSelection.start = this.getLineOffset(e);
                    this._currentSelection.end = this._currentSelection.start;
                    this.emit('selection-start');
                    this.updateSelection();
                }

            }
        })

        this._el.addEventListener('dblclick', (e) => {
            if (this.lines.length === 0) return;
            var o = this.getLineOffset(e);
            if (o.y >= 0 && o.y < this.lines.length) {
                let line = this.lines[o.y];
                let len = line.length;
                if (o.x >= 0 || o.x < len) {
                    let sPos = o.x, ePos = o.x;
                    while (line.substr(sPos, 1).match(/([a-zA-Z0-9_-])/g) && sPos >= 0) {
                        sPos--;
                        if (sPos < 0)
                            break;
                    }
                    sPos++;
                    var ll = line.length;
                    while (line.substr(ePos, 1).match(/([a-zA-Z0-9_-])/g) && ePos < len) {
                        ePos++;
                    }
                    if (sPos >= 0 && ePos <= len) {
                        this._currentSelection = {
                            start: { x: sPos, y: o.y },
                            end: { x: ePos, y: o.y },
                            scrollTimer: null,
                            drag: false
                        };
                        this.emit('selection-changed');
                        this.emit('selection-done');
                        this.updateSelection();
                    }
                }
            }

        })

        this._el.addEventListener('click', (e) => {
            if (this.lines.length === 0) return;
            if (e.detail === 3) {
                var o = this.getLineOffset(e);
                if (o.y >= 0 && o.y < this.lines.length) {
                    this._currentSelection = {
                        start: { x: 0, y: o.y },
                        end: { x: this.lines[o.y].length, y: o.y },
                        scrollTimer: null,
                        drag: false
                    };
                    this.emit('selection-changed');
                    this.emit('selection-done');
                    this.updateSelection();
                }
            }
            else if (e.detail === 4)
                this.selectAll();
        })

        this._el.addEventListener('mouseenter', (e) => {
            if (!e.buttons || e.button != 0) {
                if (this._currentSelection.drag) {
                    this.emit('selection-changed');
                    this.emit('selection-done');
                    this.updateSelection();
                }
                this._currentSelection.drag = false;
            }
            clearInterval(this._currentSelection.scrollTimer);
            this._currentSelection.scrollTimer = null;
        })

        this._el.addEventListener('mouseleave', (e) => {
            if (this._currentSelection.drag) {
                this._lastMouse = e;
                this._currentSelection.scrollTimer = setInterval(() => {
                    /// pull as long as you can scroll either direction
                    //console.log(electron.screen.getCursorScreenPoint());

                    if (!this._lastMouse) {
                        clearInterval(this._currentSelection.scrollTimer);
                        this._currentSelection.scrollTimer = null;
                        return;
                    }
                    let os = this._os;

                    let x = this._lastMouse.pageX - os.left, y = this._lastMouse.pageY - os.top;
                    let old: Point = this._currentSelection.end;

                    if (y <= 0 && this._el.scrollTop > 0) {
                        y = -1 * this._charHeight;;
                        this._currentSelection.end.y--;
                    }
                    else if (y >= this._el.clientHeight && this._el.scrollTop < this._el.scrollHeight - this._el.clientHeight) {
                        y = this._charHeight;
                        this._currentSelection.end.y++;
                        if (this._currentSelection.end.y >= this.lines.length)
                            this._currentSelection.end.x = this.lines[this.lines.length - 1].length;
                    }
                    else
                        y = 0;

                    if (x < 0 && this._el.scrollLeft > 0) {
                        x = -1 * this._charWidth;
                        this._currentSelection.end.x--;
                    }
                    else if (x >= this._el.clientWidth && this._el.scrollLeft < this._el.scrollWidth - this._el.clientWidth) {
                        x = this._charWidth;
                        this._currentSelection.end.x++;
                    }
                    else
                        x = 0;

                    if (x == 0 && y == 0)
                        return;

                    this.emit('selection-changed');
                    this._el.scrollTop += y;
                    this._el.scrollLeft += x;
                    this.updateSelectionRange(old);
                }, 50);
            }
        })

        this._el.addEventListener('contextmenu', (e: ContextEvent) => {
            let word: string = '', line: string = '', url: string = '';
            if (this.lines.length > 0) {
                var o = this.getLineOffset(e);
                if (o.y >= 0 && o.y < this.lines.length) {
                    line = this.lines[o.y];
                    let len = line.length;
                    if (o.x >= 0 || o.x < len) {
                        let sPos = o.x, ePos = o.x;
                        while (line.substr(sPos, 1).match(/([a-zA-Z0-9_-])/g) && sPos >= 0) {
                            sPos--;
                            if (sPos < 0)
                                break;
                        }
                        sPos++;
                        var ll = line.length;
                        while (line.substr(ePos, 1).match(/([a-zA-Z0-9_-])/g) && ePos < len) {
                            ePos++;
                        }
                        if (sPos >= 0 && ePos <= len)
                            word = line.substring(sPos, ePos);
                        let formats = this.lineFormats[o.y];
                        for (let l = 0, len = formats.length; l < len; l++) {
                            let format = formats[l];
                            if (format.formatType !== FormatType.Link && format.formatType !== FormatType.MXPLink)
                                continue;
                            let end = format.offset;
                            if (l < len - 1) {
                                let nFormat = formats[l + 1];
                                //skip empty blocks
                                if (format.offset === nFormat.offset && nFormat.formatType === format.formatType)
                                    continue;
                                end = nFormat.offset;
                            }
                            else
                                end = line.length;
                            if (o.x >= format.offset && o.x < end) {
                                url = format.href;
                                break;
                            }
                        }
                    }
                }
            }
            e.word = word;
            e.url = url;
            e.line = line;
            this.emit('context-menu', e);
        })

        window.addEventListener('mousemove', (e) => {
            this._lastMouse = e;
            if (this._currentSelection.drag) {
                var o = this._currentSelection.end;
                this._currentSelection.end = this.getLineOffset(e);
                this.emit('selection-changed');
                this.updateSelectionRange(o);
            }
        })

        window.addEventListener('mouseup', (e) => {
            this._lastMouse = e;
            if (this._currentSelection.drag) {
                clearInterval(this._currentSelection.scrollTimer);
                this._currentSelection.scrollTimer = null;
                this._currentSelection.drag = false;
                var o = this._currentSelection.end;
                this._currentSelection.end = this.getLineOffset(e);
                this.emit('selection-done');
                this.updateSelectionRange(o);
            }
        })

        window.addEventListener('resize', (e) => {
            this.update();
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
        this.lineFormats = [];
        this._expire = {};
        this._overlays = {
            selection: [],
            find: []
        }
        this._viewLines = [];
        this._backgroundLines = [];
        this._viewRange = { start: 0, end: 0 };
        this._maxLineLength = 0;
        this._overlay.innerHTML = null;
        this._view.innerHTML = null;
        this._background.innerHTML = null;
        this._currentSelection = {
            start: { x: null, y: null },
            end: { x: null, y: null },
            drag: false,
            scrollTimer: null
        };
        this._parser.Clear();
        this._VScroll.reset();
        this._HScroll.reset();
        this.updateScrollbars();
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
            this._charWidth = parseFloat(window.getComputedStyle(this._character).width);
            this.update();
            this.updateSelection();
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
            this.updateScrollbars();
        }
    }

    public updateView() {
        let w = this._maxLineLength * this._charWidth;
        let h = this.lines.length * this._charHeight;
        this._view.style.height = h + "px";
        this._view.style.width = w + "px";

        this._overlay.style.height = Math.max(h, this._el.clientHeight) + "px";
        this._overlay.style.width = Math.max(w, this._el.clientWidth) + "px";

        //this._viewRange.start = Math.floor(this._el.scrollTop / this._charHeight) - 6;
        //this._viewRange.end = Math.ceil((this._el.scrollTop + this._elJ.innerHeight()) / this._charHeight) + 6;
        this._viewRange.start = Math.floor(this._VScroll.position / this._charHeight);
        this._viewRange.end = Math.ceil((this._VScroll.position + this._elJ.innerHeight()) / this._charHeight);

        if (this._viewRange.start < 0)
            this._viewRange.start = 0;
        if (this._viewRange.end > this.lines.length)
            this._viewRange.end = this.lines.length;
        let lines = this._viewLines.slice(this._viewRange.start, this._viewRange.end + 1);
        //$(this._view).empty().append(lines);
        this._view.innerHTML = lines.join('');

        lines = this._backgroundLines.slice(this._viewRange.start, this._viewRange.end + 1);
        this._background.innerHTML = lines.join('');
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
            overlays.push.apply(overlays, this._overlays[ol].slice(start, end + 1));
            //overlays.push.apply(overlays, this._overlays[ol]);
        }
        this._overlay.innerHTML = overlays.join('');
        //$(this._overlay).empty().append(overlays);
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
        this._el.addEventListener('click', callback);
    }

    removeLine(line: number) {
        if (line < 0 || line >= this.lines.length) return;
        this.emit('line-removed', line, this.lines[line]);
        this.lines.splice(line, 1);
        this.lineFormats.splice(line, 1);
        this._backgroundLines.splice(line, 1);
        this._viewLines.splice(line, 1);
        //$($(this._view).children().splice(line, 1)).remove();
        //$($(this._background).children().splice(line, 1)).remove();



        //TODO redo overlays
        this.updateView();
        this.updateScrollbars();
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
            var amt = this.lines.length - this._maxLines
            this.lines.splice(0, amt);
            this.lineFormats.splice(0, amt);
            this._viewLines.splice(0, amt);
            this._backgroundLines.splice(0, amt);
            //$(this._view).children().slice(0, amt).remove()
            //$(this._background).children().slice(0, amt).remove()

            let m = 0;
            let lines = this.lines;
            //let t;
            //let h = this._charHeight;
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

    private getLineOffset(e) {
        if (this.lines.length === 0)
            return { x: 0, y: 0 }
        var os = this._os;
        //var y = (e.pageY - os.top) + this._el.scrollTop;
        var y = (e.pageY - os.top) + this._VScroll.position;
        y = Math.floor(y / this._charHeight);
        //var x = (e.pageX - os.left) + this._el.scrollLeft;
        var x = (e.pageX - os.left) + this._HScroll.position;
        x = Math.floor(x / this._charWidth);
        return { x: x, y: y };
    }

    private offset(elt) {
        var rect = elt.getBoundingClientRect(), bodyElt = document.body;
        return {
            top: rect.top + bodyElt.scrollTop,
            left: rect.left + bodyElt.scrollLeft
        }
    }

    private updateSelection() {
        var sel = this._currentSelection;
        var s, e, sL, eL, c, parts, w;
        this._overlays.selection = [];
        if (sel.start.y > sel.end.y) {
            sL = sel.end.y;
            eL = sel.start.y;
            s = sel.end.x;
            e = sel.start.x;
        }
        else if (sel.start.y < sel.end.y) {
            sL = sel.start.y;
            eL = sel.end.y;
            s = sel.start.x;
            e = sel.end.x;
        }
        else if (sel.start.x == sel.end.x) {
            this.updateOverlays();
            return;
        }
        else {
            sL = sel.start.y;
            if (sL < 0 || sL >= this.lines.length)
                return;
            s = Math.min(sel.start.x, sel.end.x);
            e = Math.max(sel.start.x, sel.end.x);
            if (s < 0) s = 0;
            if (e > this.lines[sel.start.y].length)
                e = this.lines[sel.start.y].length;

            e = (e - s) * this._charWidth;
            s *= this._charWidth;
            this._overlays.selection[sL] = `<div style="top: ${sel.start.y * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line"><span class="select-text trc tlc brc blc" style="left: ${s}px;width: ${e}px"></span></div>`
            this.updateOverlays();
            return;
        }
        var len = this.lines.length;

        if (sL < 0)
            sL = 0;
        if (eL >= len)
            eL = len - 1;
        if (s < 0)
            s = 0;
        if (e > this.lines[eL].length)
            e = this.lines[eL].length;


        for (let line = sL; line < eL + 1; line++) {
            let startStyle = {
                top: CornerType.Extern,
                bottom: CornerType.Extern
            }
            let endStyle = {
                top: CornerType.Extern,
                bottom: CornerType.Extern
            }

            let cl = sL == line ? s : 0;
            let cr = eL == line ? e : (this.lines[line].length || 1);
            if (line > sL) {
                let pl = sL == line - 1 ? s : 0;
                let pr = this.lines[line - 1].length || 1;


                if (cl == pl)
                    startStyle.top = CornerType.Flat;
                else if (cl > pl)
                    startStyle.top = CornerType.Intern;
                if (cr == pr)
                    endStyle.top = CornerType.Flat;
                else if (pl < cr && cr < pr)
                    endStyle.top = CornerType.Intern;
            }

            if (line < eL) {
                let nl = 0;
                let nr = eL == line + 1 ? e : (this.lines[line + 1].length || 1);
                if (cl === nl) {
                    startStyle.bottom = CornerType.Flat;
                } else if (nl < cl && cl < nr) {
                    startStyle.bottom = CornerType.Intern;
                }

                if (cr === nr) {
                    endStyle.bottom = CornerType.Flat;
                } else if (cr < nr) {
                    endStyle.bottom = CornerType.Intern;
                }
            }

            parts = [];
            let cls = 'select-text';
            if (startStyle.top === CornerType.Extern) {
                cls += ' tlc';
            }
            if (startStyle.bottom === CornerType.Extern) {
                cls += ' blc';
            }
            if (endStyle.top === CornerType.Extern) {
                cls += ' trc';
            }
            if (endStyle.bottom === CornerType.Extern) {
                cls += ' brc';
            }
            if (sL == line) {
                w = ((this.lines[line].length || 1) - s) * this._charWidth;
            }
            else if (eL == line) {
                w = e * this._charWidth;
            }
            else {
                w = (this.lines[line].length || 1) * this._charWidth;
            }

            parts.push(`<span class="${cls}" style="left:${cl * this._charWidth}px;width: ${w}px;"></span>`);

            if (startStyle.top == CornerType.Intern || startStyle.bottom == CornerType.Intern) {
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth)}px;width: 2px;"></span>`);
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth)}px;width: 2px;background-color:black;border-bottom-right-radius: 2px"></span>`);
            }
            if (endStyle.top === CornerType.Intern) {
                //parts.push(`<span class="select-text" style="top:0px;height:2px;left:${(cl * this._charWidth) + w}px;width: 2px;"></span>`);
                //parts.push(`<span class="select-text" style="top:0px;height:2px;left:${(cl * this._charWidth) + w}px;width: 2px;background-color:black;border-top-left-radius: 2px"></span>`);
            }
            if (endStyle.bottom === CornerType.Intern) {
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth) + w}px;width: 2px;"></span>`);
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth) + w}px;width: 2px;background-color:black;border-bottom-left-radius: 2px"></span>`);
            }

            //parts.push(`<span class="select-text" style="left:${l}px;width: ${w}px;background-color:rgba(0,128,0,0.5)"></span>`);
            //parts.push(`<span class="select-text" style="left:${l}px;width: ${w}px;background-color:rgba(255,0,0,0.5)"></span>`);

            this._overlays.selection[line] = `<div style="top: ${line * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line">${parts.join('')}</div>`;
        }
        this.updateOverlays();
    }

    private updateSelectionRange(end: Point) {
        var sel = this._currentSelection;
        var s, e, sL, eL, parts, w;
        var c, cE;
        //nothing changed so bail
        if (end.x == sel.end.x && end.y == sel.end.y)
            return;
        this._overlays.selection = [];
        if (sel.start.y > sel.end.y) {
            sL = sel.end.y;
            eL = sel.start.y;
            s = sel.end.x;
            e = sel.start.x;
        }
        else if (sel.start.y < sel.end.y) {
            sL = sel.start.y;
            eL = sel.end.y;
            s = sel.start.x;
            e = sel.end.x;
        }
        else if (sel.start.x == sel.end.x) {
            this.updateOverlays();
            return;
        }
        else {
            sL = sel.start.y;
            if (sL < 0 || sL >= this.lines.length)
                return;
            s = Math.min(sel.start.x, sel.end.x);
            e = Math.max(sel.start.x, sel.end.x);
            if (s < 0) s = 0;
            if (e > this.lines[sel.start.y].length)
                e = this.lines[sel.start.y].length;

            e = (e - s) * this._charWidth;
            s *= this._charWidth;

            this._overlays.selection[sL] = `<div style="top: ${sel.start.y * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line"><span class="select-text trc tlc brc blc" style="left: ${s}px;width: ${e}px"></span></div>`;
            this.updateOverlays();
            return;
        }
        var len = this.lines.length;

        if (sL < 0)
            sL = 0;
        if (eL >= len)
            eL = len - 1;
        if (s < 0)
            s = 0;
        if (e > this.lines[eL].length)
            e = this.lines[eL].length;


        for (let line = sL; line < eL + 1; line++) {
            let startStyle = {
                top: CornerType.Extern,
                bottom: CornerType.Extern
            }
            let endStyle = {
                top: CornerType.Extern,
                bottom: CornerType.Extern
            }

            let cl = sL == line ? s : 0;
            let cr = eL == line ? e : (this.lines[line].length || 1);
            if (line > sL) {
                let pl = sL == line - 1 ? s : 0;
                let pr = this.lines[line - 1].length || 1;


                if (cl == pl)
                    startStyle.top = CornerType.Flat;
                else if (cl > pl)
                    startStyle.top = CornerType.Intern;
                if (cr == pr)
                    endStyle.top = CornerType.Flat;
                else if (pl < cr && cr < pr)
                    endStyle.top = CornerType.Intern;
            }

            if (line < eL) {
                let nl = 0;
                let nr = eL == line + 1 ? e : (this.lines[line + 1].length || 1);
                if (cl === nl) {
                    startStyle.bottom = CornerType.Flat;
                } else if (nl < cl && cl < nr) {
                    startStyle.bottom = CornerType.Intern;
                }

                if (cr === nr) {
                    endStyle.bottom = CornerType.Flat;
                } else if (cr < nr) {
                    endStyle.bottom = CornerType.Intern;
                }
            }

            parts = [];
            let cls = 'select-text';
            if (startStyle.top === CornerType.Extern) {
                cls += ' tlc';
            }
            if (startStyle.bottom === CornerType.Extern) {
                cls += ' blc';
            }
            if (endStyle.top === CornerType.Extern) {
                cls += ' trc';
            }
            if (endStyle.bottom === CornerType.Extern) {
                cls += ' brc';
            }
            if (sL == line) {
                w = ((this.lines[line].length || 1) - s) * this._charWidth;
            }
            else if (eL == line) {
                w = e * this._charWidth;
            }
            else {
                w = (this.lines[line].length || 1) * this._charWidth;
            }

            parts.push(`<span class="${cls}" style="left:${cl * this._charWidth}px;width: ${w}px;"></span>`);

            if (startStyle.top == CornerType.Intern || startStyle.bottom == CornerType.Intern) {
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth)}px;width: 2px;"></span>`);
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth)}px;width: 2px;background-color:black;border-bottom-right-radius: 2px"></span>`);
            }
            if (endStyle.top === CornerType.Intern) {
                //parts.push(`<span class="select-text" style="top:0px;height:2px;left:${(cl * this._charWidth) + w}px;width: 2px;"></span>`);
                //parts.push(`<span class="select-text" style="top:0px;height:2px;left:${(cl * this._charWidth) + w}px;width: 2px;background-color:black;border-top-left-radius: 2px"></span>`);
            }
            if (endStyle.bottom === CornerType.Intern) {
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth) + w}px;width: 2px;"></span>`);
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth) + w}px;width: 2px;background-color:black;border-bottom-left-radius: 2px"></span>`);
            }

            //parts.push(`<span class="select-text" style="left:${l}px;width: ${w}px;background-color:rgba(0,128,0,0.5)"></span>`);
            //parts.push(`<span class="select-text" style="left:${l}px;width: ${w}px;background-color:rgba(255,0,0,0.5)"></span>`);

            this._overlays.selection[line] = `<div style="top: ${line * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line">${parts.join('')}</div>`
        }
        //this.updateOverlays();
        this.updateOverlays();
    }

    get hasSelection(): boolean {
        var sel = this._currentSelection;
        if (sel.start.x == sel.end.x && sel.start.y == sel.end.y)
            return false;
        return true;
    }

    get selection(): string {
        var sel = this._currentSelection;
        var s, e, sL, eL;
        if (sel.start.y > sel.end.y) {
            sL = sel.end.y;
            eL = sel.start.y;
            s = sel.end.x;
            e = sel.start.x;
        }
        else if (sel.start.y < sel.end.y) {
            sL = sel.start.y;
            eL = sel.end.y;
            s = sel.start.x;
            e = sel.end.x;
        }
        else if (sel.start.x == sel.end.x) {
            return "";
        }
        else {
            s = Math.min(sel.start.x, sel.end.x);
            e = Math.max(sel.start.x, sel.end.x);
            return this.lines[sel.start.y].substring(s, e);
        }
        if (sL < 0)
            sL = 0;
        if (eL >= len)
            eL = len - 1;
        if (s < 0)
            s = 0;
        if (e > this.lines[eL].length)
            e = this.lines[eL].length;
        var len = this.lines.length;
        var txt = [this.lines[sL].substring(s)];
        sL++;
        if (eL - sL > 0)
            txt.push.apply(txt, this.lines.slice(sL, eL));
        txt.push(this.lines[eL].substring(0, e));
        return txt.join('\n');
    }

    public selectAll() {
        let ll = this.lines.length;
        if (ll === 0) return;
        ll--;
        this._currentSelection = {
            start: { x: 0, y: 0 },
            end: { x: this.lines[ll].length, y: ll },
            scrollTimer: null,
            drag: false
        };
        this.emit('selection-changed');
        this.emit('selection-done');
        this.updateSelection();
    }

    public clearSelection() {
        this._currentSelection = {
            start: { x: null, y: null },
            end: { x: null, y: null },
            scrollTimer: null,
            drag: false
        };
        this.emit('selection-changed');
        this.emit('selection-done');
        this.updateSelection();
    }


    private update() {
        this._os = this.offset(this._el);
        let t = window.getComputedStyle(this._el);
        this._borderSize.height = parseInt(t.borderTopWidth) || 0;
        this._borderSize.width = parseInt(t.borderLeftWidth) || 0;
        this.updateScrollbars();
    }

    private createLine(idx?: number) {
        if (idx === undefined)
            idx = this.lines.length - 1;
        let back = [], fore = [];
        let text = this.lines[idx];
        let formats = this.lineFormats[idx];
        let offset = 0, bStyle = [];
        let fStyle = [], fCls;
        let height = this._charHeight;
        for (let f = 0, len = formats.length; f < len; f++) {
            let format = formats[f];
            let nFormat, end, td = [];
            let oSize, oFont;
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
                bStyle = [];
                fStyle = [];
                fCls = [];
                if (format.background)
                    bStyle.push("background:", format.background, ";");
                if (format.color)
                    fStyle.push("color:", format.color, ";");
                if (format.font || format.size) {
                    oSize = this._character.style.fontSize;
                    oFont = this._character.style.fontFamily;
                }
                if (format.font) {
                    fStyle.push("font-family: ", format.font, ";")
                    this._character.style.fontFamily = format.font;
                }
                if (format.size) {
                    this._character.style.fontSize = format.size;
                }
                if (format.font || format.size) {
                    height = Math.max(height, Math.ceil($(this._character).innerHeight() + 0.5));
                    this._character.style.fontSize = oSize;
                    this._character.style.fontFamily = oFont;
                }
                if (format.style !== FontStyle.None) {
                    if ((format.style & FontStyle.Bold) == FontStyle.Bold)
                        fStyle.push("font-weight: bold;");
                    if ((format.style & FontStyle.Italic) == FontStyle.Italic)
                        fStyle.push("font-style: italic;");
                    if ((format.style & FontStyle.Overline) == FontStyle.Overline)
                        td.push("overline ");
                    if ((format.style & FontStyle.DoubleUnderline) == FontStyle.DoubleUnderline || (format.style & FontStyle.Underline) == FontStyle.Underline)
                        td.push("underline ");
                    if ((format.style & FontStyle.DoubleUnderline) == FontStyle.DoubleUnderline)
                        fStyle.push("border-bottom: 1px solid ", format.color, ";");
                    else
                        fStyle.push("padding-bottom: 1px;");
                    if ((format.style & FontStyle.Rapid) == FontStyle.Rapid || (format.style & FontStyle.Slow) == FontStyle.Slow) {
                        if (this.enableFlashing)
                            fCls.push(" ansi-blink");
                        else if ((format.style & FontStyle.DoubleUnderline) != FontStyle.DoubleUnderline && (format.style & FontStyle.Underline) != FontStyle.Underline)
                            td.push("underline ");
                    }
                    if ((format.style & FontStyle.Strikeout) == FontStyle.Strikeout)
                        td.push("line-through ");
                    if (td.length > 0)
                        fStyle.push("text-decoration:", td.join(''), ";");
                }
                back.push('<span style="left:', offset * this._charWidth, 'px;width:', (end - offset) * this._charWidth, 'px;', bStyle.join(''), '" class="ansi"></span>');
                fore.push('<span style="left:', offset * this._charWidth, 'px;width:', (end - offset) * this._charWidth, 'px;', fStyle.join(''), '" class="ansi', fCls.join(''), '">', htmlEncode(text.substring(offset, end)), '</span>');
            }
            else if (format.formatType === FormatType.Link) {
                fore.push('<a draggable="false" class="URLLink" href="javascript:void(0);" title="');
                fore.push(format.href);
                fore.push('" onclick="', this.linkFunction, '(\'', format.href, '\');return false;">');
                back.push('<span style="left:', offset * this._charWidth, 'px;width:', (end - offset) * this._charWidth, 'px;', bStyle.join(''), '" class="ansi"></span>');
                fore.push('<span style="left:', offset * this._charWidth, 'px;width:', (end - offset) * this._charWidth, 'px;', fStyle.join(''), '" class="ansi', fCls.join(''), '">');
                fore.push(htmlEncode(text.substring(offset, end)));
                fore.push('</span>');
            }
            else if (format.formatType === FormatType.LinkEnd) {
                fore.push("</a>");
            }
            else if (format.formatType === FormatType.WordBreak)
                fore.push('<wbr>')
            else if (format.formatType === FormatType.MXPLink) {
                fore.push('<a draggable="false" data-index="', idx, '" class="MXPLink" href="javascript:void(0);" title="');
                fore.push(format.href);
                fore.push('" expire="', format.expire, '"');
                fore.push('onclick="', this.mxpLinkFunction, '(this, \'', format.href, '\');return false;">');
                back.push('<span style="left:', offset * this._charWidth, 'px;width:', (end - offset) * this._charWidth, 'px;', bStyle.join(''), '" class="ansi"></span>');
                fore.push('<span style="left:', offset * this._charWidth, 'px;width:', (end - offset) * this._charWidth, 'px;', fStyle.join(''), '" class="ansi', fCls.join(''), '">');
                fore.push(htmlEncode(text.substring(offset, end)));
                fore.push('</span>');
            }
            else if (format.formatType === FormatType.MXPLinkEnd) {
                fore.push("</a>");
            }
            else if (format.formatType === FormatType.MXPSend) {
                fore.push('<a draggable="false" data-index="', idx, '" class="MXPLink" href="javascript:void(0);" title="');
                fore.push(format.hint);
                fore.push('" expire="', format.expire, '"');
                fore.push(' onmouseover="', this.mxpTooltipFunction, '(this);"');
                fore.push(' onclick="', this.mxpSendFunction, '(event||window.event, this, ', format.href, ', ', format.prompt ? 1 : 0, ', ', format.tt, ');return false;">');
                back.push('<span style="left:', offset * this._charWidth, 'px;width:', (end - offset) * this._charWidth, 'px;', bStyle.join(''), '" class="ansi"></span>');
                fore.push('<span style="left:', offset * this._charWidth, 'px;width:', (end - offset) * this._charWidth, 'px;', fStyle.join(''), '" class="ansi', fCls.join(''), '">');
                fore.push(htmlEncode(text.substring(offset, end)));
                fore.push('</span>');
            }
            else if (format.formatType === FormatType.MXPSendEnd) {
                fore.push("</a>");
            }
            //TODO add image and hr support
        }
        return [`<span class="line" data-index="${idx}" style="top:${idx * this._charHeight}px;height:${this._charHeight}px;">${fore.join('')}<br></span>`, `<span class="background-line" style="top:${idx * this._charHeight}px;height:${this._charHeight}px;">${back.join('')}<br></span>`];
    }

    public scrollDisplay() {
        if (!this.scrollLock)
            this._VScroll.scrollToEnd();
    }

    private _scrollCorner: HTMLElement;

    updateScrollbars() {
        this._HScroll.offset = this._VScroll.track.clientWidth;
        this._HScroll.resize();
        this._HScroll.visible = this._HScroll.scrollSize >= 0;
        this._VScroll.offset = this._HScroll.visible ? this._HScroll.track.clientHeight : 0;
        this._VScroll.resize();

        if (!this._HScroll.visible && this._scrollCorner) {
            this._el.removeChild(this._scrollCorner);
            this._scrollCorner = null;
        }
        else if (this._HScroll.visible && !this._scrollCorner) {
            this._scrollCorner = document.createElement('div')
            this._scrollCorner.className = 'scroll-corner';
            this._scrollCorner.style.position = "absolute";
            this._scrollCorner.style.right = "0";
            this._scrollCorner.style.bottom = "0";
            this._el.appendChild(this._scrollCorner);
        }
    }
}

export class ScrollBar extends EventEmitter {
    private _parent;
    private _content;
    private _contentSize;
    private _parentSize;
    private _percentView;
    private _visible = true;
    private _offset = 0;
    private _os = { left: 0, top: 0 };

    private _lastMouse: MouseEvent;
    public _type: ScrollType = ScrollType.vertical;

    public thumb: HTMLElement;
    public track: HTMLElement;
    public position: number = 0;
    public scrollSize: number = 0;
    public maxPosition: number = 0;
    public state: ScrollState = {
        dragging: false,
        dragPosition: 0,
        position: 0
    }

    get offset(): number { return this._offset; }
    set offset(value: number) {
        if (value != this._offset) {
            this._offset = value;
            this.updateLocation();
        }
    }
    get type(): ScrollType { return this._type; }
    set type(value: ScrollType) {
        if (this._type != value) {
            this._type = value;
            this.updateLocation();
        }
    }
    get visible(): boolean { return this._visible; }
    set visible(value: boolean) {
        if (!this._visible == value) {
            this._visible = value;
            this.track.style.display = value ? 'block' : 'none';
        }
    }

    constructor(parent?: HTMLElement, content?: HTMLElement) {
        super();
        this.setParent(parent, content);
    }

    setParent(parent: HTMLElement, content?: HTMLElement) {

        if (this.track)
            this._parent.removeChild(this.track);
        this._parent = parent;
        this._content = content || parent;
        this.createBar();
    }

    private updateLocation() {
        if (this._type === ScrollType.horizontal) {
            this.track.style.top = "";
            this.track.style.right = this.offset + "px";
            this.track.style.left = "0";
            this.track.style.bottom = "0";
            this.track.style.width = "auto";
            this.track.style.height = "";

            this.thumb.style.height = "100%";
            this.thumb.style.width = "";
        }
        else {
            this.track.style.top = "0";
            this.track.style.right = "0";
            this.track.style.left = "";
            this.track.style.bottom = this.offset + "px";
            this.track.style.width = "";
            this.track.style.height = "auto";

            this.thumb.style.height = "";
            this.thumb.style.width = "100%";
        }
        this.thumb.style.left = "0";
        this.thumb.style.top = "0";
        this._os = this.elOffset(this.track);
    }

    private createBar() {
        this.track = document.createElement('div')
        this.track.className = 'scroll-track';
        this.track.style.position = "absolute";
        this._parent.appendChild(this.track);

        this.thumb = document.createElement('div')
        this.thumb.className = 'scroll-thumb';
        this.thumb.style.position = "absolute";
        this.track.appendChild(this.thumb);
        this.updateLocation();
        this.thumb.addEventListener('mousedown', (e) => {
            if (e.button === 0 && e.buttons) {
                e.preventDefault();
                e.cancelBubble = true;
                this.state.dragging = true;
                this.state.dragPosition = (this._type === ScrollType.horizontal ? (e.pageX - this._os.left) : (e.pageY - this._os.top)) - this.state.position;
            }
        });
        this._parent.addEventListener('wheel', (event) => {
            this.scrollBy(this._type === ScrollType.horizontal ? event.deltaX : event.deltaY);
        });

        window.addEventListener('mousemove', (e) => {
            this._lastMouse = e;
            if (this.state.dragging) {
                this.updatePosition(this.currentPosition());
            }
        })

        window.addEventListener('mouseup', (e) => {
            this._lastMouse = e;
            if (this.state.dragging) {
                this.state.dragging = false;
                this.updatePosition(this.currentPosition());
            }
        })

        window.addEventListener('resize', (e) => {
            this.resize();
        });
        this.resize();
    }

    reset() {
        this.state = {
            dragging: false,
            dragPosition: 0,
            position: 0
        }
        this.maxPosition = 0;
        this.updatePosition(0);
        this.update();
    }

    update() {
        let thumbSize = Math.ceil(1 / this._percentView * this._parentSize);
        if (thumbSize > this._parentSize)
            thumbSize = this._parentSize;
        this.thumb.style[this._type === ScrollType.horizontal ? "width" : "height"] = thumbSize + "px";
    }

    scrollBy(amount: number) {
        amount = this.position + (amount < 0 ? Math.floor(amount) : Math.ceil(amount));
        this.updatePosition(amount / this.scrollSize * this.maxPosition);
    }

    scrollToEnd() {
        this.updatePosition(this.maxPosition);
    }

    resize() {
        if (this._type === ScrollType.horizontal) {
            this._contentSize = this._content.clientWidth;
            this._parentSize = this._parent.clientWidth - this.offset;
        }
        else {
            this._contentSize = this._content.clientHeight;
            this._parentSize = this._parent.clientHeight - this.offset;
        }
        this.scrollSize = this._contentSize - this._parentSize;
        this._percentView = this._contentSize / this._parentSize;
        this.maxPosition = this._parentSize - Math.ceil(1 / this._percentView * this._parentSize);
        if (this.maxPosition < 0)
            this.maxPosition = 0;
        this.update();
    }

    currentPosition() {
        let p = this._type === ScrollType.horizontal ? (this._lastMouse.pageX - this.state.position - this._os.left) : (this._lastMouse.pageY - this.state.position - this._os.top);
        if (p < 0)
            return 0;
        if (p > this.maxPosition)
            return this.maxPosition;
        return p;
    }

    private updatePosition(p) {
        if (p < 0)
            p = 0;
        else if (p > this.maxPosition)
            p = this.maxPosition;
        this.thumb.style[this._type === ScrollType.horizontal ? "left" : "top"] = p + "px";
        this.state.dragPosition = p;
        if (this.maxPosition != 0)
            this.position = (p / this.maxPosition) * this.scrollSize;
        else
            this.position = 0;
        if (this.position <= 0)
            this.position = 0;
        else if (this.position > this.scrollSize)
            this.position = this.scrollSize;
        this.update();
        this.emit('scroll', this.position);
    }

    private elOffset(elt) {
        var rect = elt.getBoundingClientRect(), bodyElt = document.body;
        return {
            top: rect.top + bodyElt.scrollTop,
            left: rect.left + bodyElt.scrollLeft
        }
    }
}
