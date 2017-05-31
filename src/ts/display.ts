import EventEmitter = require('events');
import { Parser, ParserLine, ParserOptions } from "./parser";
import { AnsiColorCode } from "./ansi";
import { Size, stripHTML, getScrollBarSize } from "./library";
const electron = require('electron');

export interface Line extends ParserLine {
    raw: string;
}

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
    scroll: Point;
    drag: boolean;
    scrollTimer;
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
        scrollTimer: null,
        drag: false
    };
    private _borderSize: Size = { width: 0, height: 0 };
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

        this.updateBox();

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
        this._charWidth = parseFloat(window.getComputedStyle(this._character).width);
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
            if (data.raw === "\n")
                this.lines.push("");
            else
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

        this._el.addEventListener('mousedown', (e) => {
            //var sb =getScrollBarSize(this._el);
            var os = this.offset(this._el);
            if(e.pageX - os.left > this._el.clientWidth)
                return;
            if(e.pageY - os.top > this._el.clientHeight)
                return;



            var o = this.getLineOffset(e);
            if (e.buttons && e.button == 0) {
                if(e.shiftKey)
                {
                    this._currentSelection.end = o;
                }
                else
                {
                    this._currentSelection.start = o;
                    this._currentSelection.end = o;
                }
                this._currentSelection.drag = true;
                this.updateSelection();
                this.emit('selection-start');
            }
        })

        this._el.addEventListener('mousemove', (e) => {
            if (!this._currentSelection.drag) return;
            var o = this.getLineOffset(e);
            this._currentSelection.end = o;
            this.updateSelection();
            this.emit('selection-changed');
        })

        this._el.addEventListener('mouseup', (e) => {
            if (this._currentSelection.drag) {
                this._currentSelection.drag = false;
                var o = this.getLineOffset(e);
                this._currentSelection.end = o;
                this.updateSelection();
                this.emit('selection-done');
            }
        })

        this._el.addEventListener('dblclick', (e) => {
            var o = this.getLineOffset(e);
            //select word
        })

        this._el.addEventListener('click', (e) => {
            if (e.detail === 3) {
                var o = this.getLineOffset(e);
                //select paragraph
            }
        })

        this._el.addEventListener('mouseenter', (e) => {
            if (!e.buttons || e.button != 0) {
                if (this._currentSelection.drag)
                    this.emit('selection-done');
                this._currentSelection.drag = false;
            }
            this._currentSelection.scroll = { x: 0, y: 0 };
            clearInterval(this._currentSelection.scrollTimer);
        })

        this._el.addEventListener('mouseleave', (e) => {
            if (e.buttons && e.button === 0) {
                if (e.pageY < 0)
                    this._currentSelection.scroll.y = -1;
                else if (e.pageY >= this._el.clientHeight)
                    this._currentSelection.scroll.y = 1;

                if (e.pageX < 0)
                    this._currentSelection.scroll.x = -1;
                else if (e.pageX >= this._el.clientWidth)
                    this._currentSelection.scroll.x = 1;

                console.log(e);
                this._currentSelection.scrollTimer = setInterval(() => {
                    /// pull as long as you can scroll either direction
                    //console.log(electron.screen.getCursorScreenPoint());

                    let y = this._currentSelection.scroll.y;
                    let x = this._currentSelection.scroll.x;

                    if (y < 0 && this._el.scrollTop == 0) {
                        this._currentSelection.end.x = 0;
                        clearInterval(this._currentSelection.scrollTimer);
                        this.updateSelection();
                        this.emit('selection-changed');
                        return;
                    }
                    else if (y > 0 && this._el.scrollTop == this._el.scrollHeight - this._el.clientHeight) {
                        this._currentSelection.end.x = this.lines[this.lines.length - 1].length;
                        clearInterval(this._currentSelection.scrollTimer);
                        this.updateSelection();
                        this.emit('selection-changed');
                        return;
                    }
                    else if (x < 0 && this._el.scrollLeft == 0) {
                        clearInterval(this._currentSelection.scrollTimer);
                        this.updateSelection();
                        this.emit('selection-changed');
                        return;
                    }
                    else if (x > 0 && this._el.scrollLeft == this._el.scrollWidth - this._el.clientWidth) {
                        clearInterval(this._currentSelection.scrollTimer);
                        this.updateSelection();
                        this.emit('selection-changed');
                        return;
                    }

                    if (this._currentSelection.scroll.x < 0) {
                        x = -1 * this._charWidth;
                        this._currentSelection.end.x--;
                    }
                    else if (this._currentSelection.scroll.x > 0) {
                        x = this._charWidth;
                        this._currentSelection.end.x++;
                    }
                    if (this._currentSelection.scroll.y < 0) {
                        y = -1 * this._charHeight;;
                        this._currentSelection.end.y--;
                    }
                    else if (this._currentSelection.scroll.y > 0) {
                        y = this._charHeight;
                        this._currentSelection.end.y++;
                        if (this._currentSelection.end.y >= this.lines.length)
                            this._currentSelection.end.x = this.lines[this.lines.length - 1].length;
                    }
                    this.emit('selection-changed');
                    this._el.scrollTop += y;
                    this._el.scrollLeft += x;
                    this.updateSelection();
                }, 50);
            }
        })


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
            drag: false,
            scrollTimer: null
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
            this._charWidth = parseFloat(window.getComputedStyle(this._character).width);
            this.updateBox();
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
        /*
        if (start === undefined)
            start = this._viewRange.start;
        if (end === undefined)
            end = this._viewRange.end
            */
        let overlays = [];
        for (let ol in this._overlays) {
            if (!this._overlays.hasOwnProperty(ol))
                continue;
            //overlays.push.apply(overlays, this._overlays[ol].slice(start, end));
            overlays.push.apply(overlays, this._overlays[ol]);
        }
        this._overlay.innerHTML = overlays.join('');
        $(this._overlay).empty().append(overlays);
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
        this._el.addEventListener('click', callback);
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

    private getLineOffset(e) {
        if (this.lines.length === 0)
            return { x: 0, y: 0 }
        var os = this.offset(this._el);
        var y = (e.pageY - os.top) + this._el.scrollTop;
        y = Math.floor(y / this._charHeight);
        if (y < 0)
            y = 0;
        if (y >= this.lines.length)
            y = this.lines.length - 1;
        if (this.lines[y].length) {
            if (y >= this.lines.length) {
                x = this.lines[y].length + 1;
                return { x: x, y: this.lines.length - 1 };
            }
        }
        var x = (e.pageX - os.left) + this._el.scrollLeft;
        x = Math.floor(x / this._charWidth);
        var l = this.lines[y].length;
        if (x > l)
            x = l;
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
        var s, e, sL, eL, l, c, parts, w, w2, txt = '';
        //display.overlays.fill('');
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
            s = Math.min(sel.start.x, sel.end.x);
            e = Math.max(sel.start.x, sel.end.x);
            //txt = this.lines[sel.start.y].substring(s, e);
            e = (e - s) * this._charWidth;
            s *= this._charWidth;
            s += 2;
            this._overlays.selection[sel.start.y] = $(`<div style="top: ${sel.start.y * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line"><span class="select-text trc tlc brc blc" style="left: ${s}px;width: ${e}px">${txt}</span></div>`)
            this.updateOverlays();
            return;
        }
        var len = this.lines.length;
        let flat = 0;
        let extern = 1;
        let intern = 2;
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
                top: extern,
                bottom: extern
            }
            let endStyle = {
                top: extern,
                bottom: extern
            }

            let cl = sL == line ? s : 0;
            let cr = eL == line ? e : (this.lines[line].length || 1);
            if (line > sL) {
                let pl = sL == line - 1 ? s : 0;
                let pr = this.lines[line - 1].length || 1;


                if (cl == pl)
                    startStyle.top = flat;
                else if (cl > pl)
                    startStyle.top = intern;
                if (cr == pr)
                    endStyle.top = flat;
                else if (pl < cr && cr < pr)
                    endStyle.top = intern;
            }

            if (line < eL) {
                let nl = 0;
                let nr = eL == line + 1 ? e : (this.lines[line + 1].length || 1);
                if (cl === nl) {
                    startStyle.bottom = flat;
                } else if (nl < cl && cl < nr) {
                    startStyle.bottom = intern;
                }

                if (cr === nr) {
                    endStyle.bottom = flat;
                } else if (cr < nr) {
                    endStyle.bottom = intern;
                }
            }

            parts = [];
            let cls = 'select-text';
            if (startStyle.top === extern) {
                cls += ' tlc';
            }
            if (startStyle.bottom === extern) {
                cls += ' blc';
            }
            if (endStyle.top === extern) {
                cls += ' trc';
            }
            if (endStyle.bottom === extern) {
                cls += ' brc';
            }
            if (sL == line) {
                w = ((this.lines[line].length || 1) - s) * this._charWidth;
                //txt = this.lines[line].substring(s);
            }
            else if (eL == line) {
                w = e * this._charWidth;
                //txt = this.lines[line].substring(0, e);
            }
            else {
                w = (this.lines[line].length || 1) * this._charWidth;
                //txt = this.lines[line];
            }
            parts.push(`<span class="${cls}" style="left:${cl * this._charWidth + 2}px;width: ${w}px;">${txt}</span>`);

            if (startStyle.top == intern || startStyle.bottom == intern) {
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth)}px;width: 2px;"></span>`);
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth)}px;width: 2px;background-color:black;border-bottom-right-radius: 2px"></span>`);
            }
            if (endStyle.top === intern) {
                //parts.push(`<span class="select-text" style="top:0px;height:2px;left:${(cl * this._charWidth) + 2 + w}px;width: 2px;"></span>`);
                //parts.push(`<span class="select-text" style="top:0px;height:2px;left:${(cl * this._charWidth) + 2 + w}px;width: 2px;background-color:black;border-top-left-radius: 2px"></span>`);
            }
            if (endStyle.bottom === intern) {
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth) + 2 + w}px;width: 2px;"></span>`);
                //parts.push(`<span class="select-text" style="bottom:0px;height:2px;left:${(cl * this._charWidth) + 2 + w}px;width: 2px;background-color:black;border-bottom-left-radius: 2px"></span>`);
            }

            //parts.push(`<span class="select-text" style="left:${l}px;width: ${w}px;background-color:rgba(0,128,0,0.5)"></span>`);
            //parts.push(`<span class="select-text" style="left:${l}px;width: ${w}px;background-color:rgba(255,0,0,0.5)"></span>`);

            this._overlays.selection[line] = $(`<div style="top: ${line * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line">${parts.join('')}</div>`);
        }
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
            scroll: { x: null, y: null },
            scrollTimer: null,
            drag: false
        };
        this.emit('selection-done');
        this.updateSelection();
    }

    public clearSelection() {
        this._currentSelection = {
            start: { x: null, y: null },
            end: { x: null, y: null },
            scroll: { x: null, y: null },
            scrollTimer: null,
            drag: false
        };
        this.emit('selection-changed');
        this.updateSelection();
    }

    private updateBox() {
        let t = window.getComputedStyle(this._el);
        this._borderSize.height = parseInt(t.borderTopWidth) || 0;
        this._borderSize.width = parseInt(t.borderLeftWidth) || 0;
    }
}
