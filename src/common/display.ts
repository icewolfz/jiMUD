//spellchecker:ignore ismap
/**
 * Ansi display
 *
 * Display ansi and mxp formatted text
 *
 * @author  William
 */
import { Size, ParserLine, FormatType, FontStyle } from './types';
import EventEmitter = require('events');
import { Parser } from './parser';
import { htmlEncode, formatUnit } from './library';
import { Finder } from './finder';
import { DisplayOptions, OverlayRange, Point } from './types';
const moment = require('moment');

//const CONTAINS_RTL = /(?:[\u05BE\u05C0\u05C3\u05C6\u05D0-\u05F4\u0608\u060B\u060D\u061B-\u064A\u066D-\u066F\u0671-\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u0710\u0712-\u072F\u074D-\u07A5\u07B1-\u07EA\u07F4\u07F5\u07FA-\u0815\u081A\u0824\u0828\u0830-\u0858\u085E-\u08BD\u200F\uFB1D\uFB1F-\uFB28\uFB2A-\uFD3D\uFD50-\uFDFC\uFE70-\uFEFC]|\uD802[\uDC00-\uDD1B\uDD20-\uDE00\uDE10-\uDE33\uDE40-\uDEE4\uDEEB-\uDF35\uDF40-\uDFFF]|\uD803[\uDC00-\uDCFF]|\uD83A[\uDC00-\uDCCF\uDD00-\uDD43\uDD50-\uDFFF]|\uD83B[\uDC00-\uDEBB])/;
//const CONTAINS_LTR = /(?:[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF'+'\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF])/;
//https://www.compart.com/en/unicode/bidiclass
//http://www.unicode.org/reports/tr44/tr44-18.html
//const CONTAINS_WEAK = /(?:[\d\s\u002b\u002d\u207a\u207b\u208a\u208b\u2212\ufb29\ufe62\ufe63\uff0b\uff0d\,\.\/\:\u00a0\u060c\u202e\u2044\ufe50\ufe52\ufe55\uff0c\uff0e\uff0f\uff1a\u0300-\u036f\u0483-\u0489\u0591-\u05c7\u0610-\u065f\u0670\u06d6-\u06ed\u0711\u0730-\u074a\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0829\u082a-\u082d\u0859-\u085b\u08d4-\u0902\u093a\u093c\u0941-\u0948\u094d\u0951-\u0957\u0962\u0963])/;
//const CONTAINS_RTL = /(?:[\u05BE\u05BF\u05C0\u05C3\u05C6\u05D0-\u05F4\u0608\u060B\u060D\u061B-\u064A\u066D-\u066F\u0671-\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u0710\u0712-\u072F\u074D-\u07A5\u07B1-\u07EA\u07F4\u07F5\u07FA-\u0815\u081A\u0824\u0828\u0830-\u0858\u085E-\u08BD\u200F\uFB1D\uFB1F-\uFB28\uFB2A-\uFD3D\uFD50-\uFDFC\uFE70-\uFEFC]|\uD802[\uDC00-\uDD1B\uDD20-\uDE00\uDE10-\uDE33\uDE40-\uDEE4\uDEEB-\uDF35\uDF40-\uDFFF]|\uD803[\uDC00-\uDCFF]|\uD83A[\uDC00-\uDCCF\uDD00-\uDD43\uDD50-\uDFFF]|\uD83B[\uDC00-\uDEBB])/;
//const CONTAINS_RTL2 = /[\u0590-\u05ff\u0600-\u06ff]/u;

interface Overlays {
    selection: any[];
}

interface Selection extends OverlayRange {
    drag: boolean;
    scrollTimer: NodeJS.Timer;
}

interface Range {
    start: number;
    end: number;
}

interface ScrollState {
    dragging: boolean;
    dragPosition: number;
    position: number;
}

export enum ScrollType { vertical = 0, horizontal = 1 }
export enum UpdateType {
    none = 0,
    view = 1 << 0,
    overlays = 1 << 1,
    selection = 1 << 2,
    scrollbars = 1 << 3,
    update = 1 << 4,
    scroll = 1 << 5,
    scrollEnd = 1 << 6,
    scrollView = 1 << 7,
    display = 1 << 8,
    selectionChanged = 1 << 9,
    scrollViewOverlays = 1 << 10,
    layout = 1 << 11,
    scrollReset = 1 << 12,
    calculateLines = 1 << 13
}

enum CornerType {
    Flat = 0,
    Extern = 1,
    Intern = 2
}

interface ContextEvent extends PointerEvent {
    word: string;
    url: string;
    line: string;
    wrappedLine: string;
}

/**
 * Contains data for a wrapped display line that is the part of a full line, replaces Line interface
 */
interface WrapLine {
    line: number;           //The line number
    id: number;             //The line id
    height: number          //the height of the line
    width: number;          //lets cache the width for faster calculations
    top: number;            //cache the top to speed up display
    images: number;         //track loading images
    startOffset: number;    //the text start offset
    startFormat: number;    //the starting fragment index
    endOffset: number;      //the text end offset
    endFormat: number;      //the ending fragment index
    indent: boolean;        //is line indented
    formatWidths: number[]  //format widths
    hr: boolean             //is a horizontal rule line
}

/**
 * Contains parsed line data
 */
interface LineData {
    text: string;       //the line text
    formats: any[];     //the line formatting data
    raw: string;        //the raw line data including all ansi codes
    id: number;         //unique id for line
    timestamp: number;  //timestamp the line was added
}

/**
 * Ansi display control
 *
 * @export
 * @class Display
 * @extends {EventEmitter}
 * @todo Add MXP font - requires selection to measure using format fonts not default font
 * @todo Add MXP font size - requires variable line height, selection requires using format block to get correct size
 * @todo fix RTL unicode selection display
 * @todo Add MXP image height - requires variable line height support
 * @todo Add/fix MXP image selection highlighting
 */
export class Display extends EventEmitter {
    private _model: DisplayModel;

    private _el: HTMLElement;
    private _os;
    private _padding = [0, 0, 0, 0];

    private _overlay: HTMLElement;
    private _view: HTMLElement;
    private _background: HTMLElement;
    private _finder: Finder;
    private _maxView: number = 0;
    private _maxViewHeight: number = 0;

    private _maxWidth: number = 0;
    private _maxHeight: number = 0;
    private _currentSelection: Selection = {
        start: { x: null, y: null, lineID: null, lineOffset: null },
        end: { x: null, y: null, lineID: null, lineOffset: null },
        scrollTimer: null,
        drag: false
    };
    /*
    private _prevSelection: OverlayRange = {
        start: { x: null, y: null, lineID: null, lineOffset: null },
        end: { x: null, y: null, lineID: null, lineOffset: null }
    };
    */
    private _borderSize: Size = { width: 0, height: 0 };
    private _character: HTMLElement;
    private _viewRange: Range = { start: 0, end: 0 };
    private _viewCache = {};
    private _enableDebug: boolean = false;
    private _lastMouse: MouseEvent;
    private _roundedRanges: boolean = true;

    private _lines: WrapLine[] = [];

    public scrollToEnd: boolean = true;
    private _maxLines: number = 5000;
    private _charHeight: number;
    private _charWidth: number;
    private _overlays: Overlays = {
        selection: []
    };
    private _overlayRanges = {};
    private _VScroll: ScrollBar;
    private _HScroll: ScrollBar;
    private _updating: UpdateType = UpdateType.none;
    private _splitHeight: number = -1;
    private _wordWrap: boolean = false;
    private _wrapAt: number = 0;
    private _indent: number = 4;
    private _timestamp: boolean = false;
    private _timestampFormat: string = '[[]MM-DD HH:mm:ss.SSS[]] ';
    private _timestampWidth: number = 0;

    public split = null;
    public splitLive: boolean = false;
    private _scrollLock: boolean = false;

    get scrollLock(): boolean {
        return this._scrollLock;
    }
    set scrollLock(locked: boolean) {
        if (locked !== this._scrollLock) {
            this._scrollLock = locked;
            this._VScroll.autoScroll = !locked;
        }
    }

    private _linkFunction;
    private _mxpLinkFunction;
    private _mxpSendFunction;
    private _mxpTooltipFunction;
    private _wMove;
    private _wUp;
    private _wResize;
    private _canvas: HTMLCanvasElement;
    private _context: CanvasRenderingContext2D;
    private _contextFont: string;
    private _ruler: HTMLElement;
    private _styles: HTMLStyleElement;

    private _innerWidth;
    private _innerHeight;

    private $resizeObserver;
    private $resizeObserverCache;
    private $observer: MutationObserver;

    private _showSplitButton = true;
    private _hideTrailingEmptyLine = true;
    private _enableColors = true;
    private _enableBackgroundColors = true;
    private _linesMap: Map<number, WrapLine[]> = new Map<number, WrapLine[]>();

    get model() { return this._model; }
    set model(value: DisplayModel) {
        if (this._model === value) return;
        //if model set remove all listeners
        if (this._model)
            this._model.removeAllListeners();
        //set model and assign all the events needed
        this._model = value;
        this._model.on('debug', msg => this.debug);
        this._model.on('bell', () => { this.emit('bell'); });
        this._model.on('add-line', data => { this.emit('add-line', data); });
        this._model.on('add-line-done', data => { this.emit('add-line-done', data); });
        this._model.on('line-added', (data, noUpdate) => {
            const idx = this._model.lines.length - 1;
            const t = this.calculateWrapLines(idx, 0, this._indent, (this._timestamp ? this._timestampWidth : 0));
            //track wrapped lines to line to make it easier ot lookup all wrapped lines and allow indexOf and other build in functions
            this._linesMap.set(this._model.getLineID(idx), t);
            if (data.formats[0].hr) {
                t[0].hr = true;
                this._maxWidth = Math.max(this._maxWidth, this._maxView);
                this._maxHeight = Math.max(this._maxHeight, this._charHeight);
            }
            else {
                this._maxWidth = Math.max(this._maxWidth, t[0].width);
                this._maxHeight = Math.max(this._maxHeight, t[0].height);
            }
            if (this._lines.length > 0)
                t[0].top = this._lines[this._lines.length - 1].top + this._lines[this._lines.length - 1].height;
            for (let l = 1, ll = t.length; l < ll; l++) {
                t[l].top = t[l - 1].top + t[l - 1].height;
                this._maxWidth = Math.max(this._maxWidth, t[l].width + ((this._indent || 0) * this._charWidth));
                this._maxHeight = Math.max(this._maxHeight, t[l].height);
            }
            this._lines.push(...t);

            if (this.split) this.split.dirty = true;
            if (!noUpdate)
                this.doUpdate(UpdateType.display);
            this.doUpdate(UpdateType.display);
        });

        this._model.on('expire-links', args => {
            this.doUpdate(UpdateType.view);
            this.emit('expire-links');
        });
        this._model.on('parse-done', () => {
            this.emit('parse-done');
        });

        this._model.on('set-title', (title, type) => {
            this.emit('set-title', title, type);
        });
        this._model.on('music', (data) => {
            this.emit('music', data);
        });
        this._model.on('sound', (data) => {
            this.emit('sound', data);
        });

        this._model.on('MXP-tag-reply', (tag, args) => {
            this.emit('MXP-tag-reply', tag, args);
        });

        this._model.on('expire-link-line', idx => {
            if (this.split && idx >= this.split._viewRange.start && idx <= this.split._viewRange.end && this.split._viewRange.end !== 0 && !this._model.busy) {
                this.split.dirty = true;
                this.doUpdate(UpdateType.display);
            }
            if (idx >= this._viewRange.start && idx <= this._viewRange.end && this._viewRange.end !== 0 && !this._model.busy) {
                if (this.split) this.split.dirty = true;
                this.doUpdate(UpdateType.display);
            }
        });
    }

    get showTimestamp() { return this._timestamp; }
    set showTimestamp(value: boolean) {
        if (value === this._timestamp) return;
        this._timestamp = value;
        this._viewCache = {};
        if (this.split)
            this.split.viewCache = {};
        this.doUpdate(UpdateType.display);
    }

    get timestampFormat() { return this._timestampFormat; }
    set timestampFormat(value: string) {
        if (this._timestampFormat === value) return;
        this._timestampFormat = value;
        this._timestampWidth = this.textWidth(moment().format(this._timestampFormat));
        this._viewCache = {};
        if (this.split)
            this.split.viewCache = {};
        this.doUpdate(UpdateType.display);
    }

    get wordWrap() { return this._wordWrap; }
    set wordWrap(value: boolean) {
        if (value === this._wordWrap) return;
        this._wordWrap = value;
        this.doUpdate(UpdateType.calculateLines);
    }

    get wrapAt() { return this._wrapAt; }
    set wrapAt(value: number) {
        if (value === this._wrapAt) return;
        this._wrapAt = value;
        this.doUpdate(UpdateType.calculateLines);
    }

    get indent() { return this._indent; }
    set indent(value: number) {
        if (value === this._indent)
            return;
        this._indent = value;
        this.doUpdate(UpdateType.calculateLines);
    }

    get enableColors() { return this._enableColors; }
    set enableColors(value) {
        if (value === this._enableColors) return;
        this._enableColors = value;
        this.buildStyleSheet();
    }

    get enableBackgroundColors() { return this._enableBackgroundColors; }
    set enableBackgroundColors(value) {
        if (value === this._enableBackgroundColors) return;
        this._enableBackgroundColors = value;
        this.buildStyleSheet();
    }

    get showSplitButton() { return this._showSplitButton; }
    set showSplitButton(value) {
        if (value === this._showSplitButton) return;
        this._showSplitButton = value;
        if (this._scrollCorner) {
            this._el.removeChild(this._scrollCorner);
            this._scrollCorner = null;
        }
        this.updateScrollbars();
    }

    get hideTrailingEmptyLine() { return this._hideTrailingEmptyLine; }
    set hideTrailingEmptyLine(value) {
        if (value === this._hideTrailingEmptyLine) return;
        this._hideTrailingEmptyLine = value;
        this.doUpdate(UpdateType.view | UpdateType.scrollView | UpdateType.scrollbars);
    }

    get roundedRanges(): boolean { return this._roundedRanges; }
    set roundedRanges(value: boolean) {
        if (value !== this._roundedRanges) {
            this._roundedRanges = value;
            this.doUpdate(UpdateType.selection | UpdateType.overlays | UpdateType.scrollViewOverlays);
        }
    }

    get splitHeight(): number { return this._splitHeight; }
    set splitHeight(value: number) {
        if (this._splitHeight !== value) {
            this._splitHeight = value;
            if (this.split)
                this.split.style.height = this._splitHeight + '%';
        }
    }

    get enableSplit(): boolean { return this.split == null; }
    set enableSplit(value: boolean) {
        const id = this._el.id;
        //reset the scroll corner to ensure it is in proper state
        if (this._scrollCorner) {
            this._el.removeChild(this._scrollCorner);
            this._scrollCorner = null;
        }
        if (!this.split && value) {
            this.split = document.createElement('div');
            this.split.dirty = true;
            this.split.id = id + '-split-frame';
            this.split.bar = document.createElement('div');
            this.split.bar.id = id + '-split-bar';
            this.split.background = document.createElement('div');
            this.split.overlay = document.createElement('div');
            this.split.view = document.createElement('div');
            this.split.view.classList.add('view');
            this.split.background.classList.add('background');
            this.split.overlay.classList.add('overlay');
            this.split._viewRange = { start: 0, end: 0 };
            this.split.viewCache = {};

            this.split.appendChild(this.split.bar);
            this.split.appendChild(this.split.background);
            this.split.appendChild(this.split.overlay);
            this.split.appendChild(this.split.view);
            this._el.appendChild(this.split);
            if (this._splitHeight !== -1)
                this.split.style.height = this._splitHeight + '%';
            this.split._innerHeight = this.split.clientHeight;
            this.split.updatePosition = () => {
                const t = this._view.clientHeight - this.split._innerHeight + this._padding[2];
                this.split.overlay.style.transform = `translate(${-this._HScroll.position}px, ${-t}px)`;
                this.split.view.style.transform = `translate(${-this._HScroll.position}px, ${-t}px)`;
                this.split.background.style.transform = `translate(${-this._HScroll.position}px, ${-t}px)`;
                this.doUpdate(UpdateType.view);
            };
            this.split.updateView = () => {
                if (this._HScroll.size !== this.split.bottom) {
                    this.split.style.bottom = this._HScroll.size + 'px';
                    this.split.bottom = this._HScroll.size;
                }
                if (this.split.dirty && this.split.shown && this._VScroll.scrollSize >= 0 && this._lines.length > 0) {
                    this.split._viewRange.start = Math.trunc(this._VScroll.scrollSize / this._charHeight);
                    this.split._viewRange.end = Math.ceil((this._VScroll.scrollSize + this._innerHeight) / this._charHeight);

                    if (this.split._viewRange.start < 0)
                        this.split._viewRange.start = 0;
                    if (this.split._viewRange.end > this._lines.length)
                        this.split._viewRange.end = this._lines.length;
                    const lines = [];
                    const bLines = [];
                    let start = this.split._viewRange.start;
                    const end = this.split._viewRange.end;
                    const overlays = [];
                    let ol;
                    for (ol in this._overlays) {
                        if (!this._overlays.hasOwnProperty(ol) || ol === 'selection')
                            continue;
                        overlays.push.apply(overlays, this._overlays[ol].slice(start, end + 1));
                    }
                    overlays.push.apply(overlays, this._overlays['selection'].slice(start, end + 1));
                    const mw = '' + (this._maxWidth === 0 ? 0 : Math.max((this._timestamp ? this._timestampWidth : 0) + this._maxWidth, this._maxView));
                    const mv = '' + this._maxView;
                    this.split.view.style.width = (this._timestamp ? this._timestampWidth : 0) + this._maxWidth + 'px';
                    this.split.background.style.width = (this._timestamp ? this._timestampWidth : 0) + this._maxWidth + 'px';
                    const cache = {};
                    for (; start < end; start++) {
                        if (this.split.viewCache[start])
                            cache[start] = this.split.viewCache[start];
                        else
                            cache[start] = this.buildLineDisplay(start, mw, mv);
                        lines.push(cache[start][0]);
                        bLines.push(cache[start][1]);
                    }
                    this.split.viewCache = cache;
                    this.split.overlay.innerHTML = overlays.join('');
                    this.split.view.innerHTML = lines.join('');
                    this.split.background.innerHTML = bLines.join('');
                    this.split.updatePosition();
                    this.split.dirty = false;
                }
            };
            this.split.updateOverlays = () => {
                if (this.split.shown && this._VScroll.scrollSize >= 0 && this._lines.length > 0) {
                    const start = this.split._viewRange.start;
                    const end = this.split._viewRange.end;
                    const overlays = [];
                    let ol;
                    for (ol in this._overlays) {
                        if (!this._overlays.hasOwnProperty(ol) || ol === 'selection')
                            continue;
                        overlays.push.apply(overlays, this._overlays[ol].slice(start, end + 1));
                    }
                    overlays.push.apply(overlays, this._overlays['selection'].slice(start, end + 1));
                    this.split.overlay.innerHTML = overlays.join('');
                }
            };
            this.split.bar.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.cancelBubble = true;
                this.split.ghostBar = document.createElement('div');
                this.split.ghostBar.id = id + '-split-ghost-bar';
                this.split.ghostBar.style.top = (this.offset(this.split).top - this.split.bar.offsetHeight) + 'px';
                this.split.ghostBar.style.display = this.splitLive ? 'none' : 'block';
                this._el.appendChild(this.split.ghostBar);
                this._el.addEventListener('mousemove', this.split.mouseMove);
                this._el.addEventListener('mouseup', this.split.moveDone);
                this._el.addEventListener('mouseleave', this.split.moveDone);
            });

            this.split.mouseMove = (e) => {
                e.preventDefault();
                e.cancelBubble = true;
                if (e.pageY < 20)
                    this.split.ghostBar.style.top = '20px';
                else if (e.pageY > this._innerHeight - 150)
                    this.split.ghostBar.style.top = (this._innerHeight - 150 - this.split.bar.offsetHeight) + 'px';
                else
                    this.split.ghostBar.style.top = (e.pageY - this.split.bar.offsetHeight) + 'px';
                let h;
                if (this.splitLive) {
                    if (e.pageY < 20)
                        h = this._innerHeight - 20 + this.split.bar.offsetHeight - this._HScroll.size;
                    else if (e.pageY > this._innerHeight - 150)
                        h = 150;
                    else
                        h = this._innerHeight - e.pageY + this.split.bar.offsetHeight - this._HScroll.size;

                    h = (h / this._innerHeight * 100);
                    this.split.style.height = h + '%';
                    this.split._innerHeight = this.split.clientHeight;
                    this.doUpdate(UpdateType.scrollView | UpdateType.view | UpdateType.scroll);
                }
                this.emit('split-move', h);
            };

            this.split.moveDone = (e) => {
                if (this.split.ghostBar) {
                    let h;
                    if (e.pageY < 20)
                        h = this._innerHeight - 20 + this.split.bar.offsetHeight - this._HScroll.size;
                    else if (e.pageY > this._innerHeight - 150)
                        h = 150;
                    else
                        h = this._innerHeight - e.pageY + this.split.bar.offsetHeight - this._HScroll.size;
                    h = (h / this._innerHeight * 100);
                    this.split.style.height = h + '%';
                    this.split._innerHeight = this.split.clientHeight;
                    this.split.updatePosition();
                    this._el.removeChild(this.split.ghostBar);
                    delete this.split.ghostBar;
                    this.emit('split-move-done', h);
                }

                this._el.removeEventListener('mousemove', this.split.mouseMove);
                this._el.removeEventListener('mouseup', this.split.moveDone);
                this._el.removeEventListener('mouseleave', this.split.moveDone);
            };
            this.split.addEventListener('mouseup', (e) => {
                if (!e.button)
                    this._el.click();
            });
        }
        else if (this.split && !value) {
            this._el.removeEventListener('mouseup', this.split.moveDone);
            this._el.removeEventListener('mouseleave', this.split.moveDone);
            this._el.removeChild(this.split);
            this.split = null;
        }
        if (this._VScroll.atBottom)
            this.doUpdate(UpdateType.scrollEnd);
        this.doUpdate(UpdateType.scrollbars | UpdateType.scroll | UpdateType.view | UpdateType.scrollView);
    }

    get linkFunction(): string {
        return this._linkFunction || 'doLink';
    }

    set linkFunction(val: string) {
        this._linkFunction = val;
    }

    get mxpLinkFunction(): string {
        return this._mxpLinkFunction || 'doMXPLink';
    }

    set mxpLinkFunction(val: string) {
        this._mxpLinkFunction = val;
    }

    get mxpSendFunction(): string {
        return this._mxpSendFunction || 'doMXPSend';
    }

    set mxpSendFunction(val: string) {
        this._mxpSendFunction = val;
    }

    get mxpTooltipFunction(): string {
        return this._mxpTooltipFunction || 'doMXPTooltip';
    }

    set mxpTooltipFunction(val: string) {
        this._mxpTooltipFunction = val;
    }

    get id() {
        if (this._el) return this._el.id;
        return '';
    }

    get lines() {
        return this._model.lines;
    }

    get wrappedLines() {
        return this._lines;
    }

    constructor(display: string | JQuery | HTMLElement, options?);
    constructor(display?: any, options?: DisplayOptions) {
        super();
        if (options && options.hasOwnProperty('backgroundColors'))
            this._enableBackgroundColors = options.backgroundColors;
        if (options && options.hasOwnProperty('colors'))
            this._enableColors = options.colors;
        if (!display)
            throw new Error('Display must be an id, element or jquery object');
        if (typeof display === 'string') {
            if (display.startsWith('#'))
                this._el = document.getElementById(display.substr(1));
            else
                this._el = document.getElementById(display);
        }
        else if (display instanceof $)
            this._el = display[0];
        else if (display instanceof HTMLElement)
            this._el = display;
        else
            throw new Error('Display must be an id, element or jquery object');
        this._canvas = document.createElement('canvas');
        this._canvas.style.position = 'absolute';
        this._canvas.style.left = '-1000px';
        this._styles = document.createElement('style');

        this._innerHeight = this._el.clientHeight;
        this._innerWidth = this._el.clientWidth;
        const fragment = document.createDocumentFragment();
        fragment.appendChild(this._styles);
        this._background = document.createElement('div');
        this._background.id = this._el.id + '-background';
        this._background.classList.add('background');
        fragment.appendChild(this._background);

        this._overlay = document.createElement('div');
        this._overlay.id = this._el.id + '-overlay';
        this._overlay.classList.add('overlay');
        fragment.appendChild(this._overlay);

        this._view = document.createElement('div');
        this._view.id = this._el.id + '-view';
        this._view.classList.add('view');
        this._view.setAttribute('aria-live', 'polite');
        this._view.setAttribute('role', 'log');
        fragment.appendChild(this._view);
        this._el.appendChild(fragment);

        this._canvas = document.createElement('canvas');
        this._context = this._canvas.getContext('2d', { alpha: false });

        this._ruler = document.createElement('div');
        this._ruler.id = this.id + '-ruler';
        this._ruler.className = 'ansi';
        this._ruler.style.position = 'absolute';
        this._ruler.style.zIndex = '-1';
        this._ruler.style.left = '-1000px';
        this._ruler.style.whiteSpace = 'pre';
        this._ruler.style.lineHeight = 'normal';
        this._ruler.style.borderBottom = '1px solid black';
        this._ruler.style.visibility = 'hidden';
        this._el.appendChild(this._ruler);

        this._character = document.createElement('div');
        this._character.id = this.id + '-Character';
        this._character.className = 'ansi';
        //this._character.style.borderBottom = '1px solid black';
        this._character.innerText = 'W';
        this._character.style.visibility = 'hidden';
        this._ruler.style.visibility = 'hidden';
        this._el.appendChild(this._character);

        this._charHeight = parseFloat(window.getComputedStyle(this._character).height);
        this._charWidth = parseFloat(window.getComputedStyle(this._character).width);
        this.buildStyleSheet();

        this._VScroll = new ScrollBar({ parent: this._el, content: this._view, autoScroll: true, type: ScrollType.vertical });
        this._VScroll.on('scroll', (pos, changed) => {
            if (!changed)
                this.doUpdate(UpdateType.view);
            else
                this.doUpdate(UpdateType.scroll | UpdateType.view);
        });
        this._HScroll = new ScrollBar({ parent: this._el, content: this._view, type: ScrollType.horizontal, autoScroll: false });
        this._HScroll.on('scroll', (pos, changed) => {
            if (changed)
                this.doUpdate(UpdateType.scroll);
        });
        //this.update();

        if (!options)
            options = { display: this };
        else
            options.display = this;

        this.model = new DisplayModel(options);

        this._el.addEventListener('mousedown', (e) => {
            if (e.buttons && e.button === 0) {
                e.preventDefault();
                e.cancelBubble = true;
                const os = this._os;
                if (e.pageX - os?.left > this._maxView)
                    return;
                if (e.pageY - os?.top > this._maxViewHeight)
                    return;
                this._currentSelection.drag = true;
                /*
                this._prevSelection = {
                    start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset },
                    end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset }
                };
                */
                if (e.shiftKey) {
                    this._currentSelection.end = this.getLineOffset(e.pageX, e.pageY);
                    this.emit('selection-start');
                    this.doUpdate(UpdateType.selection);
                }
                else {
                    this._currentSelection.start = this.getLineOffset(e.pageX, e.pageY);
                    this._currentSelection.end = this._currentSelection.start;
                    this.emit('selection-start');
                    this.doUpdate(UpdateType.selection);
                }

            }
        });

        this._el.addEventListener('mouseup', (e) => {
            if (this._lines.length === 0 || e.button !== 0) return;
            if (e.detail === 2) {
                const o = this.getLineOffset(e.pageX, e.pageY);
                if (o.y >= 0 && o.y < this._lines.length) {
                    const line = this.getLineText(o.y);
                    const len = line.length;
                    if (o.x >= 0 || o.x < len) {
                        let sPos = o.x;
                        let ePos = o.x;
                        while (line.substr(sPos, 1).match(/([^\s.,/#!$%^&*;:{}=`~()[\]@&|\\?><"'+])/gu) && sPos >= 0) {
                            sPos--;
                            if (sPos < 0)
                                break;
                        }
                        sPos++;
                        while (line.substr(ePos, 1).match(/([^\s.,/#!$%^&*;:{}=`~()[\]@&|\\?><"'+])/gu) && ePos < len) {
                            ePos++;
                        }
                        if (sPos >= 0 && ePos <= len) {
                            /*
                            this._prevSelection = {
                                start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset },
                                end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset }
                            };
                            */
                            this._currentSelection = {
                                start: { x: sPos, y: o.y, lineID: this._lines[o.y].id, lineOffset: this._lines[o.y].startOffset + sPos },
                                end: { x: ePos, y: o.y, lineID: this._lines[o.y].id, lineOffset: this._lines[o.y].startOffset + ePos },
                                scrollTimer: null,
                                drag: false
                            };
                            this.emit('selection-changed');
                            this.emit('selection-done');
                            this.doUpdate(UpdateType.selection);
                        }
                    }
                }
            }
            else if (e.detail === 3) {
                const o = this.getLineOffset(e.pageX, e.pageY);
                if (o.y >= 0 && o.y < this._lines.length) {
                    /*
                    this._prevSelection = {
                        start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset },
                        end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset }
                    };
                    */
                    this._currentSelection = {
                        start: { x: 0, y: o.y, lineID: this._lines[o.y].id, lineOffset: this._lines[o.y].startOffset },
                        end: { x: this.getLineText(o.y).length, y: o.y, lineID: this._lines[o.y].id, lineOffset: this._lines[o.y].startOffset + this.getLineText(o.y).length },
                        scrollTimer: null,
                        drag: false
                    };
                    this.emit('selection-changed');
                    this.emit('selection-done');
                    this.doUpdate(UpdateType.selection);
                }
            }
            else if (e.detail === 4)
                this.selectAll();
        });

        this._el.addEventListener('mouseenter', (e) => {
            if (!e.buttons || e.button !== 0) {
                if (this._currentSelection.drag) {
                    this.emit('selection-changed');
                    this.emit('selection-done');
                    this.doUpdate(UpdateType.selection);
                }
                this._currentSelection.drag = false;
            }
            clearInterval(this._currentSelection.scrollTimer);
            this._currentSelection.scrollTimer = null;
        });

        this._el.addEventListener('mouseleave', (e) => {
            if (this._currentSelection.drag) {
                this._lastMouse = e;
                this._currentSelection.scrollTimer = setInterval(() => {
                    /*
                    this._prevSelection = {
                        start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset },
                        end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset }
                    };
                    */
                    /// pull as long as you can scroll either direction

                    if (!this._lastMouse) {
                        clearInterval(this._currentSelection.scrollTimer);
                        this._currentSelection.scrollTimer = null;
                        return;
                    }
                    const os = this._os;
                    let x = this._lastMouse.pageX - os.left;
                    let y = this._lastMouse.pageY - os.top;

                    if (y <= 0 && this._VScroll.position > 0) {
                        y = -1 * this._charHeight;
                        this._currentSelection.end.y--;
                    }
                    else if (y >= this._innerHeight && this._VScroll.position < this._VScroll.scrollSize) {
                        y = this._charHeight;
                        this._currentSelection.end.y++;
                        if (this._lines.length === 0)
                            this._currentSelection.end.x = 0;
                        else if (this._currentSelection.end.y >= this._lines.length)
                            this._currentSelection.end.x = this.getLineText(this._lines.length - 1).length;
                    }
                    else
                        y = 0;

                    if (x < 0 && this._HScroll.position > 0) {
                        x = -1 * this._charWidth;
                        this._currentSelection.end.x--;
                    }
                    else if (x >= this._innerWidth && this._HScroll.position < this._HScroll.scrollSize) {
                        x = this._charWidth;
                        this._currentSelection.end.x++;
                    }
                    else if (x > 0 && this._currentSelection.end.y >= this._lines.length) {
                        x = 0;
                        if (this._lines.length === 0)
                            this._currentSelection.end.x = 0;
                        else
                            this._currentSelection.end.x = this.getLineText(this.lines.length - 1).length;
                    }
                    else {
                        x = 0;
                        this._currentSelection.end.x = 0;
                    }
                    if (this._currentSelection.end.y >= this._lines.length) {
                        this._currentSelection.end.lineID = this._lines[this._lines.length - 1].id;
                        this._currentSelection.end.lineOffset = this._lines[this._lines.length - 1].endOffset;
                    }
                    else {
                        this._currentSelection.end.lineID = this._lines[this._currentSelection.end.y].id;
                    }
                    if (x === 0 && y === 0)
                        return;

                    this.emit('selection-changed');
                    this._VScroll.scrollBy(y);
                    this._HScroll.scrollBy(x);
                    this.doUpdate(UpdateType.selection);
                }, 20);
            }
        });

        this._el.addEventListener('contextmenu', (e: ContextEvent) => {
            const o = this.getLineOffset(e.pageX, e.pageY);
            if (o.y >= 0 && o.y < this._lines.length) {
                e.line = this.getLineText(o.y, true);
                e.wrappedLine = this.getLineText(o.y);
            }
            else {
                e.line = '';
                e.wrappedLine = this.getLineText(o.y);
            }
            e.word = this.getWordFromPosition(o);
            e.url = this.getUrlFromPosition(o);
            this.emit('context-menu', e);
        });

        this._wMove = (e) => {
            if (this._currentSelection.drag) {
                this._lastMouse = e;
                this.doUpdate(UpdateType.selectionChanged | UpdateType.selection);
            }
        };
        this._wUp = (e) => {
            if (this._currentSelection.drag) {
                this._lastMouse = e;
                clearInterval(this._currentSelection.scrollTimer);
                this._currentSelection.scrollTimer = null;
                this._currentSelection.drag = false;
                this._currentSelection.end = this.getLineOffset(e.pageX, e.pageY);
                if (this._currentSelection.end.y < 0) {
                    this._currentSelection.end.y = 0;
                    this._currentSelection.end.x = 0;
                }
                if (this._currentSelection.end.y >= this._lines.length) {
                    this._currentSelection.end.y = this._lines.length - 1;
                    this._currentSelection.end.x = this.getLineText(this._currentSelection.end.y).length;
                }
                else if (this._currentSelection.end.y === this._lines.length - 1 && this._currentSelection.end.x > this.getLineText(this._currentSelection.end.y).length) {
                    this._currentSelection.end.x = this.getLineText(this._currentSelection.end.y).length;
                }
                this.emit('selection-done');
                this.doUpdate(UpdateType.selection);
            }
        };
        this._wResize = (e) => {
            if (this.split) this.split.dirty = true;
            this.doUpdate(UpdateType.update);
        };

        window.addEventListener('mousemove', this._wMove.bind(this));

        window.addEventListener('mouseup', this._wUp.bind(this));

        window.addEventListener('resize', this._wResize.bind(this));

        this._finder = new Finder(this);
        this._finder.on('word', () => {
            this.emit('word');
        });
        this._finder.on('case', () => {
            this.emit('case');
        });
        this._finder.on('reverse', () => {
            this.emit('reverse');
        });
        this._finder.on('regex', () => {
            this.emit('regex');
        });

        this._finder.on('shown', () => {
            this.emit('shown');
        });
        this._finder.on('closed', () => {
            this.emit('closed');
        });
        this._finder.on('highlight', () => {
            this.emit('highlight');
        });

        this._finder.on('moving', location => {
            this.emit('finder-moving', location);
        });

        this._finder.on('moved', location => {
            this.emit('finder-moved', location);
        });

        this._finder.on('found-results', () => {
            this.doUpdate(UpdateType.scrollView);
            this.emit('found-results');
        });

        this._finder.on('moved', () => {
            this.doUpdate(UpdateType.scrollView);
            this.emit('moved');
        });

        if (options && options != null) {
            if (options.enableSplit != null)
                this.enableSplit = options.enableSplit;
            if (options.enableSplitLive != null)
                this.splitLive = options.enableSplitLive;
            if (options.enableRoundedRanges != null)
                this.roundedRanges = options.enableRoundedRanges;
        }
        this._el.appendChild(this._canvas);
        this.doUpdate(UpdateType.update);

        this.$resizeObserver = new ResizeObserver((entries, observer) => {
            if (entries.length === 0) return;
            if (!entries[0].contentRect || entries[0].contentRect.width === 0 || entries[0].contentRect.height === 0)
                return;
            if (!this.$resizeObserverCache || this.$resizeObserverCache.width !== entries[0].contentRect.width || this.$resizeObserverCache.height !== entries[0].contentRect.height) {
                this.update();
                this.$resizeObserverCache = { width: entries[0].contentRect.width, height: entries[0].contentRect.height };
                if (this.split) this.split.dirty = true;
                this.doUpdate(UpdateType.view);
                this.emit('resize');
            }
        });
        this.$resizeObserver.observe(this._el);
        this.$observer = new MutationObserver((mutationsList) => {
            let mutation;
            for (mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (this.split) this.split.dirty = true;
                    this.doUpdate(UpdateType.scrollbars | UpdateType.update | UpdateType.view | UpdateType.layout);
                    this.emit('resize');
                }
            }
        });
        this.$observer.observe(this._el, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
        //setTimeout(() => { this.update(); }, 0);
        //this.update();
        this.updateLayout();
    }

    get MatchCase(): boolean {
        return this._finder.MatchCase;
    }

    set MatchCase(value: boolean) {
        this._finder.MatchCase = value;
    }

    get RegularExpression(): boolean {
        return this._finder.RegularExpression;
    }

    set RegularExpression(value: boolean) {
        this._finder.RegularExpression = value;
    }

    get MatchWord(): boolean {
        return this._finder.MatchWord;
    }

    set MatchWord(value: boolean) {
        this._finder.MatchWord = value;
    }

    get Reverse(): boolean {
        return this._finder.Reverse;
    }

    set Reverse(value: boolean) {
        this._finder.Reverse = value;
    }

    get Highlight(): boolean {
        return this._finder.Highlight;
    }
    set Highlight(value: boolean) {
        this._finder.Highlight = value;
    }

    get finderLocation() {
        return this._finder.location;
    }

    set finderLocation(value) {
        this._finder.location = value;
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
            if ((this._updating & UpdateType.layout) === UpdateType.layout) {
                this.updateLayout();
                this._updating &= ~UpdateType.layout;
            }
            if ((this._updating & UpdateType.display) === UpdateType.display) {
                this.updateDisplay();
                this._updating &= ~UpdateType.display;
            }
            if ((this._updating & UpdateType.scroll) === UpdateType.scroll) {
                if (this.split) {
                    if (this._VScroll.atBottom) {
                        this.split.style.display = '';
                        this.split.shown = false;
                        if (this._scrollCorner) this._scrollCorner.classList.remove('active');
                        this.emit('scroll-lock', false);
                    }
                    else if (!this.split.shown) {
                        this.split.style.display = 'block';
                        this.split.shown = true;
                        this.split._innerHeight = this.split.clientHeight;
                        if (this._scrollCorner) this._scrollCorner.classList.add('active');
                        this.emit('scroll-lock', true);
                        this.split.updatePosition();
                    }
                    else
                        this.split.updatePosition();
                }
                this._updating |= UpdateType.scrollReset;
                this._updating &= ~UpdateType.scroll;
            }
            if ((this._updating & UpdateType.scrollReset) === UpdateType.scrollReset) {
                this._view.style.transform = `translate(${-this._HScroll.position}px, ${-this._VScroll.position}px)`;
                this._background.style.transform = `translate(${-this._HScroll.position}px, ${-this._VScroll.position}px)`;
                this._overlay.style.transform = `translate(${-this._HScroll.position}px, ${-this._VScroll.position}px)`;
                this._updating &= ~UpdateType.scrollReset;
            }
            if ((this._updating & UpdateType.view) === UpdateType.view) {
                this.updateView();
                if (this.split)
                    this.split.updateView();
                this._updating &= ~UpdateType.view;
                this._updating &= ~UpdateType.scrollView;
            }
            else if ((this._updating & UpdateType.scrollView) === UpdateType.scrollView) {
                if (this.split)
                    this.split.updateView();
                this._updating &= ~UpdateType.scrollView;
            }
            else if ((this._updating & UpdateType.scrollViewOverlays) === UpdateType.scrollViewOverlays) {
                if (this.split)
                    this.split.updateOverlays();
                this._updating &= ~UpdateType.scrollViewOverlays;
            }

            if ((this._updating & UpdateType.selectionChanged) === UpdateType.selectionChanged) {
                //this._prevSelection.end = this._currentSelection.end;
                this._currentSelection.end = this.getLineOffset(this._lastMouse.pageX, this._lastMouse.pageY);
                this.emit('selection-changed');
                this._updating &= ~UpdateType.selectionChanged;
            }
            if ((this._updating & UpdateType.selection) === UpdateType.selection) {
                this.updateSelection();
                this._updating &= ~UpdateType.selection;
            }
            if ((this._updating & UpdateType.overlays) === UpdateType.overlays) {
                this.updateOverlays();
                this._updating &= ~UpdateType.overlays;
            }
            if ((this._updating & UpdateType.calculateLines) === UpdateType.calculateLines) {
                this.update();
                this.reCalculateLines();
                if (this.split) this.split.dirty = true;
                this.doUpdate(UpdateType.display | UpdateType.scrollbars);
                this._updating &= ~UpdateType.calculateLines;
                this._updating &= ~UpdateType.update;
            }
            if ((this._updating & UpdateType.update) === UpdateType.update) {
                this.update();
                if (this._wordWrap && !this._wrapAt)
                    this.reCalculateLines();
                this.updateScrollbars();
                this._updating &= ~UpdateType.update;
                this._updating &= ~UpdateType.scrollbars;
            }
            else if ((this._updating & UpdateType.scrollbars) === UpdateType.scrollbars) {
                this.updateScrollbars();
                this._updating &= ~UpdateType.scrollbars;
            }
            if ((this._updating & UpdateType.scrollEnd) === UpdateType.scrollEnd) {
                this.scrollDisplay();
                this._updating &= ~UpdateType.scrollEnd;
            }
            this.doUpdate(this._updating);
        });
    }

    get maxLines(): number { return this._maxLines; }
    set maxLines(value: number) {
        if (value !== this._maxLines) {
            this._maxLines = value;
            this.trimLines();
        }
    }

    get enableDebug(): boolean {
        return this._enableDebug;
    }

    set enableDebug(enable: boolean) {
        this._enableDebug = enable;
        this._model.enableDebug = enable;
    }

    get tabWidth(): number {
        return this._model.tabWidth;
    }

    set tabWidth(value) {
        this._model.tabWidth = value;
    }

    get textLength(): number {
        return this._model.textLength;
    }

    get EndOfLine(): boolean {
        return this._model.EndOfLine;
    }

    get parseQueueLength(): number {
        return this._model.parseQueueLength;
    }

    get parseQueueEndOfLine(): boolean {
        return this._model.parseQueueEndOfLine;
    }

    get EndOfLineLength(): number {
        if (this._lines.length === 0)
            return 0;
        return this.lines[this.lines.length - 1].text.length;
    }

    set enableFlashing(value: boolean) {
        this._model.enableFlashing = value;
    }
    get enableFlashing(): boolean {
        return this._model.enableFlashing;
    }

    set enableMXP(value: boolean) {
        this._model.enableMXP = value;
    }
    get enableMXP(): boolean {
        return this._model.enableMXP;
    }

    set showInvalidMXPTags(value: boolean) {
        this._model.showInvalidMXPTags = value;
    }
    get showInvalidMXPTags(): boolean {
        return this._model.showInvalidMXPTags;
    }

    set enableBell(value: boolean) {
        this._model.enableBell = value;
    }
    get enableBell(): boolean {
        return this._model.enableBell;
    }

    set enableURLDetection(value: boolean) {
        this._model.enableURLDetection = value;
    }
    get enableURLDetection(): boolean {
        return this._model.enableURLDetection;
    }

    set enableMSP(value: boolean) {
        this._model.enableMSP = value;
    }
    get enableMSP(): boolean {
        return this._model.enableMSP;
    }

    set displayControlCodes(value: boolean) {
        this._model.displayControlCodes = value;
    }
    get displayControlCodes(): boolean {
        return this._model.displayControlCodes;
    }

    set emulateTerminal(value: boolean) {
        this._model.emulateTerminal = value;
    }
    get emulateTerminal(): boolean {
        return this._model.emulateTerminal;
    }

    set emulateControlCodes(value: boolean) {
        this._model.emulateControlCodes = value;
    }
    get emulateControlCodes(): boolean {
        return this._model.emulateControlCodes;
    }

    set MXPStyleVersion(value: string) {
        this._model.MXPStyleVersion = value;
    }
    get MXPStyleVersion(): string {
        return this._model.MXPStyleVersion;
    }

    public debug(msg) {
        this.emit('debug', msg);
    }

    public append(txt: string, remote?: boolean, force?: boolean, prependSplit?: boolean) {
        this._model.append(txt, remote || false, force || false, prependSplit || false);
    }

    public CurrentAnsiCode() {
        return this._model.CurrentAnsiCode();
    }

    public updateWindow(width?, height?) {
        if (width === undefined) {
            width = this.WindowWidth;
            height = this.WindowHeight;
        }
        this._model.updateWindow(width, height);
        this.emit('update-window', width, height);
    }

    public clear() {
        this._model.clear();
        this._overlays = {
            selection: []
        };
        this._viewCache = {};

        this._lines = [];

        this._viewRange = { start: 0, end: 0 };
        this._maxWidth = 0;
        this._maxHeight = 0;
        this._overlay.innerHTML = null;
        this._view.innerHTML = null;
        this._background.innerHTML = null;
        this._currentSelection = {
            start: { x: null, y: null, lineID: null, lineOffset: null },
            end: { x: null, y: null, lineID: null, lineOffset: null },
            drag: false,
            scrollTimer: null
        };
        this._VScroll.reset();
        this._HScroll.reset();
        if (this.split) {
            this.split.viewCache = {};
            this.split.dirty = true;
            if (this.split.shown) {
                this.split.style.display = '';
                this.split.shown = false;
                if (this._scrollCorner) this._scrollCorner.classList.remove('active');
            }
        }
        this._updating &= ~UpdateType.scroll;
        this.doUpdate(UpdateType.scrollbars | UpdateType.scrollReset);
    }

    public updateFont(font?: string, size?: string) {
        if (!font || font.length === 0)
            font = '"Courier New", Courier, monospace';
        else //fall back just incase
            font += ', monospace';
        if (!size || size.length === 0)
            size = '1em';
        if (font !== this._el.style.fontFamily || size !== this._el.style.fontSize) {
            //turn off observer as we are changing styles
            this.$observer.disconnect();
            //set styles using raw javascript for minor speed
            this._el.style.fontSize = size;
            this._el.style.fontFamily = font;
            this._character.style.fontSize = size;
            this._character.style.fontFamily = font;
            this._ruler.style.fontSize = size;
            this._ruler.style.fontFamily = font;

            this._contextFont = `${size} ${font}`;
            this._context.font = this._contextFont;
            //recalculate height/width of characters so display can be calculated
            this._charHeight = parseFloat(window.getComputedStyle(this._character).height);
            this._charWidth = parseFloat(window.getComputedStyle(this._character).width);
            this.buildStyleSheet();
            this.reCalculateLines();
            if (this._VScroll.atBottom)
                this.doUpdate(UpdateType.scrollEnd);
            //update view to display any line height changes
            this.doUpdate(UpdateType.view | UpdateType.selection | UpdateType.update | UpdateType.scrollView | UpdateType.overlays);
            this.updateWindow();
            //re-enable in case something outside of font change triggers a change
            this.$observer.observe(this._el, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
            this._timestampWidth = this.textWidth(moment().format(this._timestampFormat));
        }
        const pc = window.getComputedStyle(this._el);
        const padding = [
            parseInt(pc.getPropertyValue('padding-top')) || 0,
            parseInt(pc.getPropertyValue('padding-right')) || 0,
            parseInt(pc.getPropertyValue('padding-bottom')) || 0,
            parseInt(pc.getPropertyValue('padding-left')) || 0
        ];
        if (padding[0] !== this._padding[0] ||
            padding[1] !== this._padding[1] ||
            padding[2] !== this._padding[2] ||
            padding[3] !== this._padding[3]
        ) {
            this._padding = padding;
            this.doUpdate(UpdateType.view | UpdateType.selection | UpdateType.update | UpdateType.scrollbars);
        }
    }

    public updateView() {
        const w = (this._timestamp ? this._timestampWidth : 0) + this._maxWidth;
        let l = this._lines.length;
        if (this._hideTrailingEmptyLine && l && this.getLineText(l - 1).length === 0)
            l--;
        const h = l * this._charHeight;
        const mw = '' + (w === 0 ? 0 : Math.max(w, this._maxView));
        const mv = '' + this._maxView;
        this._view.style.height = h + 'px';
        this._view.style.width = w + 'px';

        this._background.style.height = h + 'px';
        this._background.style.width = w + 'px';

        this._overlay.style.height = Math.max(h, this._innerHeight) + 'px';
        this._overlay.style.width = mw + 'px';

        this._viewRange.start = Math.trunc(this._VScroll.position / this._charHeight);
        if (this.split && this.split.shown)
            this._viewRange.end = Math.ceil((this._VScroll.position + this._innerHeight - this.split._innerHeight) / this._charHeight);
        else
            this._viewRange.end = Math.ceil((this._VScroll.position + this._innerHeight) / this._charHeight);

        if (this._viewRange.start < 0)
            this._viewRange.start = 0;
        if (this._viewRange.end > l)
            this._viewRange.end = l;
        const lines = [];
        const bLines = [];
        l = this._viewRange.start;
        const le = this._viewRange.end;
        const cache = {};
        for (; l < le; l++) {
            if (this._viewCache[l])
                cache[l] = this._viewCache[l];
            else
                cache[l] = this.buildLineDisplay(l, mw, mv);
            lines.push(cache[l][0]);
            bLines.push(cache[l][1]);
        }
        this._viewCache = cache;
        this._view.innerHTML = lines.join('');
        this._background.innerHTML = bLines.join('');
        this.doUpdate(UpdateType.overlays);
    }

    public updateOverlays(start?: number, end?: number) {
        if (start === undefined)
            start = this._viewRange.start;
        if (end === undefined)
            end = this._viewRange.end;
        const overlays = [];
        let ol;
        for (ol in this._overlays) {
            if (!this._overlays.hasOwnProperty(ol) || ol === 'selection')
                continue;
            overlays.push.apply(overlays, this._overlays[ol].slice(start, end + 1));
        }
        overlays.push.apply(overlays, this._overlays['selection'].slice(start, end + 1));
        this._overlay.innerHTML = overlays.join('');
    }

    private updateDisplay() {
        //disable animation
        this._el.classList.remove('animate');
        const bar = this._HScroll.visible;
        this.trimLines();
        if (this.scrollToEnd)
            this.doUpdate(UpdateType.view | UpdateType.scrollbars | UpdateType.scrollEnd | UpdateType.scrollView);
        else
            this.doUpdate(UpdateType.view | UpdateType.scrollbars | UpdateType.scrollView);
        if (bar !== this._HScroll.visible)
            this.updateWindow();
        //re-enable animation so they are all synced
        this._el.classList.add('animate');
    }

    private updateTops(line: number) {
        const l = this._lines.length;
        if (l === 0) return;
        this._viewCache = {};
        if (this.split) this.split.viewCache = {};
        if (line === 0) {
            this._lines[line].top = 0;
            line++;
        }
        while (line < l) {
            this._lines[line].top = this._lines[line - 1].top + this._lines[line - 1].height;
            //this._viewLines[line] = this._viewLines[line].replace(/top:\d+px/, `top:${line * this._charHeight}px`);
            //this._backgroundLines[line] = this._backgroundLines[line].replace(/top:\d+px/, `top:${line * this._charHeight}px`);
            line++;
        }
    }

    get WindowSize(): Size {
        return new Size(this.WindowWidth, this.WindowHeight);
    }

    get WindowWidth(): number {
        return Math.trunc(this._maxView / this._charWidth);
    }

    get WindowHeight(): number {
        if (this._HScroll.visible)
            return Math.trunc((this._innerHeight - this._HScroll.size - this._padding[0] - this._padding[2]) / this._charHeight);
        return Math.trunc((this._innerHeight - this._padding[0] - this._padding[2]) / this._charHeight);
    }

    public click(callback) {
        this._el.addEventListener('click', callback);
    }

    public removeLine(line: number, noSelectionChange?: boolean) {
        if (line < 0 || line >= this.lines.length) return;
        this.emit('line-removed', line, this.lines[line].text);
        const lineID = this._model.getLineID(line);
        const wrapIndex = this._lines.findIndex(l => l.id === lineID);
        let amt = 0;
        for (let idx = wrapIndex, ll = this._lines.length; idx < ll; idx++) {
            if (this._lines[idx].id != lineID) break;
            amt++;
            if (this._viewCache[idx])
                delete this._viewCache[idx];
            if (this.split && this.split.viewCache[idx])
                delete this.split.viewCache[idx];
        }
        this._lines.splice(wrapIndex, amt);
        this._model.removeLine(line);
        this._linesMap.delete(lineID);
        if (!noSelectionChange && !this._currentSelection.drag) {
            for (let l = wrapIndex; l < wrapIndex + amt; l++) {
                if (this._currentSelection.start.y >= l && this._currentSelection.end.y >= l) {
                    this._currentSelection.start.y = null;
                    this._currentSelection.start.x = null;
                    this._currentSelection.start.lineID = null;
                    this._currentSelection.start.lineOffset = null;
                    this._currentSelection.end.y = null;
                    this._currentSelection.end.x = null;
                    this._currentSelection.end.lineID = null;
                    this._currentSelection.end.lineOffset = null;
                    break;
                }
                else if (this._currentSelection.start.y === l) {
                    if (this._currentSelection.start.y > this._currentSelection.end.y) {
                        this._currentSelection.start.y--;
                        if (this._currentSelection.start.y >= 0 && this._currentSelection.start.y < this._lines.length)
                            this._currentSelection.start.x = this.getLineText(this._currentSelection.start.y).length;
                        else
                            this._currentSelection.start.x = 0;
                    }
                    else {
                        this._currentSelection.start.y++;
                        this._currentSelection.start.x = 0;
                    }
                }
                else if (this._currentSelection.end.y === l) {
                    if (this._currentSelection.start.y > this._currentSelection.end.y) {
                        this._currentSelection.end.y++;
                        this._currentSelection.end.x = 0;
                    }
                    else {
                        this._currentSelection.end.y--;
                        if (this._currentSelection.end.y >= 0 && this._currentSelection.end.y < this._lines.length)
                            this._currentSelection.end.x = this.getLineText(this._currentSelection.end.y).length;
                        else
                            this._currentSelection.end.x = 0;
                    }
                }
            }
            if (this._lines.length && this._currentSelection.start.y !== null && this._currentSelection.start.y >= 0 && this._currentSelection.start.y < this._lines.length) {
                this._currentSelection.start.lineID = this._lines[this._currentSelection.start.y].id;
                this._currentSelection.start.lineOffset = this._currentSelection.start.x + this._lines[this._currentSelection.start.y].startOffset;
            }
            if (this._lines.length && this._currentSelection.end.y !== null && this._currentSelection.end.y >= 0 && this._currentSelection.end.y < this._lines.length) {
                this._currentSelection.end.lineID = this._lines[this._currentSelection.end.y].id;
                this._currentSelection.end.lineOffset = this._currentSelection.end.x + this._lines[this._currentSelection.end.y].startOffset;
            }
        }
        let ol;
        for (ol in this._overlays) {
            if (!this._overlays.hasOwnProperty(ol) || this._overlays[ol].length === 0 || line >= this._overlays[ol].length)
                continue;
            this._overlays[ol].splice(wrapIndex, amt);
        }
        if (this.split) this.split.dirty = true;
        this.updateTops(wrapIndex);
        this.doUpdate(UpdateType.view | UpdateType.scrollbars | UpdateType.overlays | UpdateType.selection);
    }

    public removeLines(line: number, amt: number) {
        if (line < 0 || line >= this.lines.length) return;
        if (amt < 1) amt = 1;
        this.emit('lines-removed', line, this._lines.slice(line, amt));
        const lineID = this._model.getLineID(line);
        const wrapIndex = this._lines.findIndex(l => l.id === lineID);
        let wrapAmt = 0;
        //loop map and count wrapped lines
        for (let l = line; l < amt; l++) {
            const dLine = this._model.getLineID(line);
            wrapAmt += this._linesMap.get(dLine).length;
            this._linesMap.delete(dLine);
        }
        this._lines.splice(wrapIndex, wrapAmt);
        this._model.removeLines(line, amt);
        for (let a = 0; a < wrapAmt; a++) {
            if (this._viewCache[wrapIndex + a])
                delete this._viewCache[wrapIndex + a];
            if (this.split && this.split.viewCache[wrapIndex + a])
                delete this.split.viewCache[wrapIndex + a];
        }

        if (!this._currentSelection.drag) {
            for (let l = wrapIndex; l < wrapIndex + wrapAmt; l++) {
                if (this._currentSelection.start.y >= l && this._currentSelection.end.y >= l) {
                    this._currentSelection.start.y = null;
                    this._currentSelection.start.x = null;
                    this._currentSelection.start.lineID = null;
                    this._currentSelection.start.lineOffset = null;
                    this._currentSelection.end.y = null;
                    this._currentSelection.end.x = null;
                    this._currentSelection.end.lineID = null;
                    this._currentSelection.end.lineOffset = null;
                    break;
                }
                else if (this._currentSelection.start.y === l) {
                    if (this._currentSelection.start.y > this._currentSelection.end.y) {
                        this._currentSelection.start.y--;
                        if (this._currentSelection.start.y >= 0 && this._currentSelection.start.y < this._lines.length)
                            this._currentSelection.start.x = this.getLineText(this._currentSelection.start.y).length;
                        else
                            this._currentSelection.start.x = 0;
                    }
                    else {
                        this._currentSelection.start.y++;
                        this._currentSelection.start.x = 0;
                    }
                }
                else if (this._currentSelection.end.y === l) {
                    if (this._currentSelection.start.y > this._currentSelection.end.y) {
                        this._currentSelection.end.y++;
                        this._currentSelection.end.x = 0;
                    }
                    else {
                        this._currentSelection.end.y--;
                        if (this._currentSelection.end.y >= 0 && this._currentSelection.end.y < this._lines.length)
                            this._currentSelection.end.x = this.getLineText(this._currentSelection.end.y).length;
                        else
                            this._currentSelection.end.x = 0;
                    }
                }
            }
            if (this._lines.length && this._currentSelection.start.y !== null && this._currentSelection.start.y >= 0 && this._currentSelection.start.y < this._lines.length) {
                this._currentSelection.start.lineID = this._lines[this._currentSelection.start.y].id;
                this._currentSelection.start.lineOffset = this._currentSelection.start.x + this._lines[this._currentSelection.start.y].startOffset;
            }
            if (this._lines.length && this._currentSelection.end.y !== null && this._currentSelection.end.y >= 0 && this._currentSelection.end.y < this._lines.length) {
                this._currentSelection.end.lineID = this._lines[this._currentSelection.end.y].id;
                this._currentSelection.end.lineOffset = this._currentSelection.end.x + this._lines[this._currentSelection.end.y].startOffset;
            }
        }
        let ol;
        for (ol in this._overlays) {
            if (!this._overlays.hasOwnProperty(ol) || this._overlays[ol].length === 0 || line >= this._overlays[ol].length)
                continue;
            this._overlays[ol].splice(wrapIndex, wrapAmt);
        }
        if (this.split) this.split.dirty = true;
        this.updateTops(wrapIndex);
        this.doUpdate(UpdateType.view | UpdateType.scrollbars | UpdateType.overlays | UpdateType.selection);
    }

    public colorSubStrByLine(idx: number, fore, back?, start?: number, len?: number, style?: FontStyle) {
        this.colorSubStringByLine(idx, fore, back, start, start + len, style);
    }

    public colorSubStringByLine(idx: number, fore, back?, start?: number, end?: number, style?: FontStyle) {
        //only update if something changed
        if (!this._model.colorSubStringByLine(idx, fore, back, start, end, style))
            return;
        //rebuild wraps in case a format was removed
        this.reCalculateWrapLines(idx, 0, this._indent, (this._timestamp ? this._timestampWidth : 0));
    }

    public removeStyleSubStrByLine(idx: number, style: FontStyle, start?: number, len?: number) {
        this.removeStyleSubStringByLine(idx, style, start, start + len);
    }

    //color like javascript.substring using 0 index for start and end
    public removeStyleSubStringByLine(idx: number, style: FontStyle, start?: number, end?: number) {
        //only update if something changed
        if (!this._model.removeStyleSubStringByLine(idx, style, start, end))
            return;
        //rebuild wraps in case a format was removed
        this.reCalculateWrapLines(idx, 0, this._indent, (this._timestamp ? this._timestampWidth : 0));
    }

    public highlightSubStrByLine(idx: number, start?: number, len?: number) {
        this.highlightStyleSubStringByLine(idx, start, start + len);
    }

    //color like javascript.substring using 0 index for start and end
    public highlightStyleSubStringByLine(idx: number, start?: number, end?: number, color?: boolean) {
        //only update if something changed
        if (!this._model.highlightStyleSubStringByLine(idx, start, end, color))
            return;
        //rebuild wraps in case a format was removed
        this.reCalculateWrapLines(idx, 0, this._indent, (this._timestamp ? this._timestampWidth : 0));
    }

    public SetColor(code: number, color) {
        this._model.SetColor(code, color);
    }

    public ClearMXP() {
        this._model.ClearMXP();
    }

    public ResetMXPLine() {
        this._model.ResetMXPLine();
    }

    get html(): string {
        const l = this.lines.length;
        const html = [];
        for (let idx = 0; idx < l; idx++)
            html.push(this.getLineHTML(idx));
        return html.join('');
    }

    get text(): string {
        return this._model.text;
    }

    get raw(): string {
        return this._model.raw;
    }

    public trimLines() {
        if (this._maxLines === -1)
            return;
        if (this.lines.length > this._maxLines) {
            const amt = this.lines.length - this._maxLines;
            const lastLineID = this._model.getLineID(amt);
            //let wrapAmt = this._lines.findIndex(l => l.id == lastLineID);
            const _lines = this._lines;
            let wrapAmt = 0;
            const _linesLength = _lines.length;
            for (wrapAmt = 0; wrapAmt < _linesLength; wrapAmt++) {
                if (_lines[wrapAmt].id >= lastLineID) break;
            }
            this._lines.splice(0, wrapAmt);
            this._model.removeLines(0, amt);
            if (this.hasSelection) {
                this._currentSelection.start.y -= amt;
                this._currentSelection.end.y -= amt;

                if (this._currentSelection.start.y < 0 && this._currentSelection.end.y < 0) {
                    this._currentSelection = {
                        start: { x: null, y: null, lineID: null, lineOffset: null },
                        end: { x: null, y: null, lineID: null, lineOffset: null },
                        scrollTimer: null,
                        drag: false
                    };
                }
                else if (this._currentSelection.start.y < 0) {
                    this._currentSelection.start.y = 0;
                    this._currentSelection.start.x = 0;
                }
                else if (this._currentSelection.end.y < 0) {
                    this._currentSelection.end.y = 0;
                    this._currentSelection.end.x = 0;
                }
                this.emit('selection-changed');
                this.emit('selection-done');
            }
            let ol;
            for (ol in this._overlays) {
                if (!this._overlays.hasOwnProperty(ol) || this._overlays[ol].length === 0)
                    continue;
                this._overlays[ol].splice(0, amt);
            }

            let m = 0;
            let mh = 0;
            const lines = this._lines;
            const ll = lines.length;
            const ww = this._maxView;
            for (let l = 0; l < ll; l++) {
                if (lines[l].hr) {
                    m = Math.max(m, ww);
                    mh = Math.max(mh, this._charHeight);
                }
                else if (lines[l].indent) {
                    m = Math.max(m, this._lines[l].width + ((this._indent || 0) * this._charWidth));
                    mh = Math.max(mh, this._lines[l].height);
                }
                else {
                    m = Math.max(m, this._lines[l].width);
                    mh = Math.max(mh, this._lines[l].height);
                }
            }
            this._viewCache = {};
            if (this.split)
                this.split.viewCache = {};
            this._maxWidth = m;
            this._maxHeight = mh;
            if (this.split) this.split.dirty = true;
            this.doUpdate(UpdateType.selection | UpdateType.overlays);
        }
    }

    //TODO add font support, as different blocks of text could have different font formats, need to not just measure with but measure based on format block data
    public getLineOffset(pageX, pageY): Point {
        if (this._lines.length === 0)
            return { x: 0, y: 0, lineID: 0, lineOffset: 0 };
        if (this._timestamp)
            pageX -= this._timestampWidth;
        const os = this._os;
        let y = (pageY - os.top);
        if (this.split && this.split.shown) {
            if (y >= this._VScroll.trackSize - this.split._innerHeight)
                y += this._VScroll.scrollSize;
            else
                y += this._VScroll.position;
        }
        else
            y += this._VScroll.position;
        y = Math.trunc(y / this._charHeight);

        let xPos = (pageX - os.left) + this._HScroll.position;
        let x = Math.trunc(xPos / this._charWidth);
        let id = 0;
        let offset = 0;
        if (y >= 0) {
            let text;
            let line = y;
            if (y >= this._lines.length)
                line = this._lines.length - 1;
            //if indented offset by the indent width
            if (this._lines[line].indent) {
                xPos -= this._indent * this._charWidth;
                x = Math.trunc(xPos / this._charWidth);
            }
            text = this.getLineText(y).replace(/ /g, '\u00A0');
            const tl = text.length;
            let w = Math.ceil(this.wrapLineWidth(line, 0, x));
            id = this._model.getLineFromID(this._lines[line].id);
            offset = this._lines[line].startOffset;
            //let w = Math.ceil(this.textWidth(text.substr(0, x)));
            if (w > xPos && xPos > 0) {
                while (w > xPos && x > 0) {
                    x--;
                    //unicode surrogate pair check
                    while (x > 0 && text.charCodeAt(x) >= 0xD800 && text.charCodeAt(x) <= 0xDBFF)
                        x--;
                    w = Math.ceil(this.wrapLineWidth(line, 0, x));
                }
                x++;
                //unicode modifier check
                while (x > 0 && this.isUnicodeModifierCode(text.charCodeAt(x)))
                    x--;
            }
            else if (w > 0 && w < xPos) {
                while (w < xPos && x < tl) {
                    x++;
                    //unicode modifier check
                    while (tl > x + 1 && this.isUnicodeModifierCode(text.charCodeAt(x)))
                        x++;
                    w = Math.ceil(this.wrapLineWidth(line, 0, x));
                }
                if (w > xPos) {
                    x--;
                    //unicode modifier check
                    while (x > 0 && this.isUnicodeModifierCode(text.charCodeAt(x)))
                        x--;
                }
                else if (x > 0 && this.isUnicodeModifierCode(text.charCodeAt(x)))
                    x--;
            }
            else if (w === 0 && x > 0 && xPos >= 0) {
                while (w <= 0 && x < tl) {
                    x++;
                    //unicode modifier check
                    while (tl > x + 1 && this.isUnicodeModifierCode(text.charCodeAt(x)))
                        x++;
                    w = Math.ceil(this.wrapLineWidth(line, 0, x));
                }
            }
            //unicode modifier check
            else {
                while (x > 0 && this.isUnicodeModifierCode(text.charCodeAt(x)))
                    x--;
            }
        }
        return { x: x, y: y, lineID: id, lineOffset: offset + x };
    }

    public getWrapOffset(line, offset) {
        if (line < 0 || line >= this._model.lines.length) return { x: 0, y: 0 };
        const lineID = this._model.getLineID(line);
        const t = this._linesMap.get(lineID);
        for (let l = 0, ll = t.length; l < ll; l++) {
            if (offset >= t[l].startOffset && offset < t[l].endOffset)
                return { x: offset - t[l].startOffset, y: this._lines.indexOf(t[l]) };
            else if (offset === t[l].endOffset)
                return { x: offset - t[l].startOffset, y: this._lines.indexOf(t[l]) };
        }
        return { x: offset - t[t.length - 1].startOffset, y: this._lines.indexOf(t[t.length - 1]) };
    }

    public getWrapOffsetByLineID(lineID, offset) {
        const t = this._linesMap.get(lineID);
        if (!t) return this._model.getLineFromID(lineID);
        for (let l = 0, ll = t.length; l < ll; l++) {
            if (offset >= t[l].startOffset && offset < t[l].endOffset)
                return { x: offset - t[l].startOffset, y: this._lines.indexOf(t[l]) };
            else if (offset === t[l].endOffset)
                return { x: offset - t[l].startOffset, y: this._lines.indexOf(t[l]) };
        }
        return { x: offset - t[t.length - 1].startOffset, y: this._lines.indexOf(t[t.length - 1]) };
    }

    public getWordFromPosition(position) {
        if (position.y >= 0 && position.y < this._lines.length) {
            const line = this.getLineText(position.y);
            const len = line.length;
            if (position.x >= 0 || position.x < len) {
                let sPos = position.x;
                let ePos = position.x;
                while (line.substr(sPos, 1).match(/([^\s.,/#!$%^&*;:{}=`~()[\]@&|\\?><"'+])/gu) && sPos >= 0) {
                    sPos--;
                    if (sPos < 0)
                        break;
                }
                sPos++;
                while (line.substr(ePos, 1).match(/([^\s.,/#!$%^&*;:{}=`~()[\]@&|\\?><"'+])/gu) && ePos < len) {
                    ePos++;
                }
                if (sPos >= 0 && ePos <= len)
                    return line.substring(sPos, ePos);
            }
        }
        return '';
    }

    public getUrlFromPosition(position) {
        if (position.y >= 0 && position.y < this._lines.length) {
            const line = this.getLineText(position.y, true);
            const len = line.length;
            const idx = this._model.getLineFromID(this._lines[position.y].id);
            const x = position.x + this._lines[position.y].startOffset;
            if (x >= 0 || x < len) {
                const formats = this.lines[idx].formats;
                const fl = formats.length;
                let l;
                for (l = 0; l < fl; l++) {
                    const format = formats[l];
                    if (format.formatType !== FormatType.Link && format.formatType !== FormatType.MXPLink)
                        continue;
                    let end = format.offset;
                    l++;
                    for (; l < fl; l++) {
                        const nFormat = formats[l];
                        if (format.offset === nFormat.offset && nFormat.formatType === format.formatType)
                            continue;
                        if (format.formatType === FormatType.Link && formats[l].formatType === FormatType.LinkEnd) {
                            end = nFormat.offset;
                            break;
                        }
                        else if (format.formatType === FormatType.MXPLink && formats[l].formatType === FormatType.MXPLinkEnd) {
                            end = nFormat.offset;
                            break;
                        }
                    }
                    if (l >= fl)
                        end = line.length;
                    if (x >= format.offset && x < end) {
                        return format.href;
                    }
                }
            }
        }
        return '';
    }

    private isUnicodeModifierCode(code: number) {
        //test if surrogate
        if (code >= 0xDC00 && code <= 0xDFFF)
            return true;
        //test if variant
        if (code >= 0xFE00 && code <= 0xFE0F)
            return true;
        //https://en.wikipedia.org/wiki/Combining_character
        //Combining Diacritical Marks
        if (code >= 0x0300 && code <= 0x036F)
            return true;
        //Combining Diacritical Marks Extended
        if (code >= 0x1AB0 && code <= 0x1AFF)
            return true;
        //Combining Diacritical Marks Supplement
        if (code >= 0x1DC0 && code <= 0x1DFF)
            return true;
        //Combining Diacritical Marks for Symbols
        if (code >= 0xFE20 && code <= 0xFE2F)
            return true;
        //Combining Half Marks
        if (code >= 0x20D0 && code <= 0x20FF)
            return true;
        //COMBINING CYRILLIC    
        if (code >= 0x0484 && code <= 0x0489)
            return true;
        //Nko Combining        
        if (code >= 0x07EB && code <= 0x07F3)
            return true;
        switch (code) {
            //COMBINING KATAKANA-HIRAGANA
            case 0x3099:
            case 0x309A:
            //Devanagari 
            case 0x0901:
            case 0x0953:
            case 0x0953:
            //Ethiopic Combining                
            case 0x135D:
            case 0x135E:
            case 0x135F:
                return true;
        }
        return false;
    }

    private offset(elt) {
        const rect = elt.getBoundingClientRect();
        const bodyElt = document.body;
        return {
            top: rect.top + bodyElt.scrollTop,
            left: rect.left + bodyElt.scrollLeft
        };
    }

    private textWidth(txt, font?, style?) {
        if (!txt || txt.length === 0) return 0;
        font = font || this._contextFont;
        const canvas = this._canvas || (this._canvas = document.createElement('canvas'));
        const context = this._context || (this._context = canvas.getContext('2d', { alpha: false }));
        if ((style & FontStyle.Bold) === FontStyle.Bold)
            font = "bold " + font;
        if ((style & FontStyle.Italic) === FontStyle.Italic)
            font = "italic " + font;
        context.font = font;
        const metrics = context.measureText(txt);
        return metrics.width;
    }

    private textHeight(txt, font?, size?) {
        this._ruler.textContent = txt;
        this._ruler.style.fontFamily = font || this._character.style.fontFamily;
        this._ruler.style.fontSize = size || this._character.style.fontSize;
        return parseInt(window.getComputedStyle(this._ruler).fontSize, 10);
    }

    private wrapLineWidth(idx, start?, len?) {
        if (idx < 0 || idx >= this._lines.length)
            return 0;
        if (start === undefined || start === null)
            return this._lines[idx].width;
        if (len === undefined || len === null || len > this.getLineText(idx).length)
            len = this.getLineText(idx).length;
        if (len - start <= 0) return 0;
        if (start === 0 && len >= this.getLineText(idx).length)
            return this._lines[idx].width;
        const text = this.getLineText(idx).replace(/ /g, '\u00A0');
        const line = this._model.getLineFromID(this._lines[idx].id);

        const formats = this.lines[line].formats;
        const fLen = formats.length;
        const tl = text.length;
        const endFormat = this._lines[idx].endFormat
        const startOffset = this._lines[idx].startOffset;
        let f = this._lines[idx].startFormat;
        let end;
        let font;
        let offset;
        let width = 0;
        for (; f <= endFormat; f++) {
            //no width so ignore these blocks
            if (!formats[f].width || formats[f].formatType === FormatType.LinkEnd || formats[f].formatType === FormatType.MXPLinkEnd || formats[f].formatType === FormatType.MXPSendEnd)
                continue;
            //TODO not supported in width calculations at the moment
            if (formats[f].align === 'right')
                continue;
            //find end
            if (f < fLen - 1)
                end = formats[f + 1].offset - startOffset;
            else
                end = tl;
            //not in this block so move to next
            if (start >= end)
                continue;
            offset = formats[f].offset - startOffset;
            //block is between start/end so whole width and move on
            if (offset >= start && len >= end) {
                width += formats[f].width + (formats[f].marginWidth || 0);
                continue;
            }
            //get font
            if (formats[f].font || formats[f].size)
                font = `${formats[f].size || this._character.style.fontSize} ${formats[f].font || this._character.style.fontFamily}`;
            else
                font = 0;
            if (offset > start)
                start = offset;
            if (len < end)
                end = len;
            //if unicode or non standard font calculate width
            if (formats[f].unicode || font)
                width += this.textWidth(text.substring(start, end), font, formats[f].style);
            else
                width += text.substring(start, end).length * this._charWidth;
            //len is in block so quit
            if (len <= end)
                break;
        }
        return width;
    }

    //get line width of full non wrapped line
    private lineWidth(line, start?, len?) {
        if (line < 0 || line >= this.lines.length)
            return 0;
        if (start === undefined || start === null)
            start = 0;
        if (len === undefined || len === null || len > this.lines[line].text.length)
            len = this.lines[line].text.length;
        if (len - start <= 0) return 0;
        const text = this.lines[line].text.replace(/ /g, '\u00A0');
        const formats = this.lines[line].formats;
        const fLen = formats.length;
        const tl = text.length;
        let f = 0;
        let end;
        let font;
        let offset;
        let width = 0;
        for (; f < fLen; f++) {
            //no width so ignore these blocks
            if (!formats[f].width || formats[f].formatType === FormatType.LinkEnd || formats[f].formatType === FormatType.MXPLinkEnd || formats[f].formatType === FormatType.MXPSendEnd)
                continue;
            //TODO not supported in width calculations at the moment
            if (formats[f].align === 'right')
                continue;
            //find end
            if (f < fLen - 1)
                end = formats[f + 1].offset;
            else
                end = tl;
            //not in this block so move to next
            if (start >= end)
                continue;
            offset = formats[f].offset;
            //block is between start/end so whole width and move on
            if (offset >= start && len >= end) {
                width += formats[f].width + (formats[f].marginWidth || 0);
                continue;
            }
            //get font
            if (formats[f].font || formats[f].size)
                font = `${formats[f].size || this._character.style.fontSize} ${formats[f].font || this._character.style.fontFamily}`;
            else
                font = 0;
            if (offset > start)
                start = offset;
            if (len < end)
                end = len;
            //if unicode or non standard font calculate width
            if (formats[f].unicode || font)
                width += this.textWidth(text.substring(start, end), font, formats[f].style);
            else
                width += text.substring(start, end).length * this._charWidth;
            //len is in block so quit
            if (len <= end)
                break;
        }
        return width;
    }

    public clearOverlay(type?: string) {
        if (!type)
            type = 'default';
        if (!this._overlays[type] || this._overlays[type].length === 0) return;
        this._overlays[type] = [];
        delete this._overlayRanges[type];
        if (this.split) this.split.dirty = true;
        this.doUpdate(UpdateType.overlays);
    }

    //TODO add font support, as different blocks of text could have different font formats, need to not just measure with but measure based on format block data
    public addOverlays(ranges: OverlayRange[], rangeCls?: string, type?: string) {
        let s;
        let e;
        let sL;
        let eL;
        let w;
        let r;
        let range;
        const rl = ranges.length;
        if (!type)
            type = 'default';
        if (!rangeCls || rangeCls.length === 0)
            rangeCls = 'overlay-default';
        this._overlays[type] = [];
        const fl = Math.trunc;
        const mw = Math.max((this._timestamp ? this._timestampWidth : 0) + this._maxWidth, this._maxView);
        const len = this._lines.length;
        this._overlayRanges[type] = { ranges: ranges, cls: rangeCls };
        for (r = 0; r < rl; r++) {
            range = ranges[r];
            if (range.start.y > range.end.y) {
                sL = range.end.y;
                eL = range.start.y;
                s = range.end.x;
                e = range.start.x;
            }
            else if (range.start.y < range.end.y) {
                sL = range.start.y;
                eL = range.end.y;
                s = range.start.x;
                e = range.end.x;
            }
            else if (range.start.x === range.end.x) {
                //empty range
                if (this.split) {//} && (range.start.y >= this.split._viewRange.start)) {
                    this.split.dirty = true;
                    this.doUpdate(UpdateType.scrollViewOverlays);
                }
                this.doUpdate(UpdateType.overlays);
                continue;
            }
            else {
                sL = range.start.y;
                //invalid view
                if (sL < 0 || sL >= this._lines.length)
                    continue;

                if (this._lines[sL].hr) {
                    s = 0;
                    e = mw;
                }
                else {
                    s = Math.min(range.start.x, range.end.x);
                    e = Math.max(range.start.x, range.end.x);
                    if (s < 0) s = 0;
                    if (e > this.getLineText(sL).length)
                        e = this.getLineText(sL).length;
                    e = this.wrapLineWidth(sL, s, e);
                    s = this.wrapLineWidth(sL, 0, s);
                    //e = this.textWidth(this.lines[sL].substring(s, e).replace(/ /g, '\u00A0'));
                    //s = this.textWidth(this.lines[sL].substring(0, s).replace(/ /g, '\u00A0'));
                }
                s += (this._timestamp ? this._timestampWidth : 0);
                if (this._lines[sL].indent)
                    s += this._indent * this._charWidth;
                if (!this._overlays[type][sL])
                    this._overlays[type][sL] = [];
                if (this._roundedRanges)
                    this._overlays[type][sL].push(`<span id="${type}-${r}" class="${rangeCls} trc tlc brc blc" style="left: ${s}px;width: ${e}px"></span>`);
                else
                    this._overlays[type][sL].push(`<span id="${type}-${r}" class="${rangeCls}" style="left: ${s}px;width: ${e}px"></span>`);
                continue;
            }

            if (sL < 0)
                sL = 0;
            if (eL >= len) {
                eL = len - 1;
                e = this.getLineText(eL).length;
            }
            if (s < 0)
                s = 0;
            if (e > this.getLineText(eL).length)
                e = this.getLineText(eL).length;
            for (let line = sL; line < eL + 1; line++) {
                const startStyle = {
                    top: CornerType.Extern,
                    bottom: CornerType.Extern
                };
                const endStyle = {
                    top: CornerType.Extern,
                    bottom: CornerType.Extern
                };
                let cls = rangeCls;
                let cl = 0;
                if (sL === line) {
                    const tLine = this.getLineText(line).replace(/ /g, '\u00A0');
                    if (s >= tLine.length)
                        cl = tLine.length;
                    else
                        cl = s;
                }
                if (this._lines[line].hr)
                    w = mw;
                else if (sL === line)
                    w = this.wrapLineWidth(line, s) + this._charWidth;
                //w = this.textWidth(this.lines[sL].substr(s).replace(/ /g, '\u00A0')) + this._charWidth;
                else if (eL === line)
                    w = this.wrapLineWidth(line, 0, e);
                //w = this.textWidth(tLine.substring(0, e));
                else
                    w = this._lines[line].width + this._charWidth;
                cl = this.wrapLineWidth(line, 0, cl);
                if (this._lines[line].indent)
                    cl += this._indent * this._charWidth;
                cl = fl(cl);
                //cl = this.textWidth(tLine.substring(0, cl));
                if (this._roundedRanges) {
                    let cr;
                    if (this._lines[line].hr)
                        cr = mw;
                    else if (this._lines[line].indent)
                        cr = fl((eL === line ? this.wrapLineWidth(line, 0, e) : (this._lines[line].width + this._charWidth)) + this._indent * this._charWidth);
                    else
                        cr = fl(eL === line ? this.wrapLineWidth(line, 0, e) : (this._lines[line].width + this._charWidth));
                    //cr = fl(eL === line ? this.textWidth(tLine.substring(0, e)) : (this._lines[line].width + this._charWidth));
                    if (line > sL) {
                        let plIndent = this._lines[line - 1].indent ? this._indent * this._charWidth : 0;
                        let pl = fl(plIndent);
                        if (sL === line - 1) {
                            if (this._lines[line - 1].hr)
                                pl = 0;
                            else if (fl(this.wrapLineWidth(sL, 0, s) + plIndent) >= fl(this._lines[line - 1].width + this._charWidth + plIndent))
                                //else if (fl(this.textWidth(this.lines[sL].substr(0, s).replace(/ /g, '\u00A0'))) >= fl(this._lines[line - 1].width + this._charWidth))
                                pl = fl(this._lines[line - 1].width + plIndent) + this._charWidth;
                            else
                                pl = fl(this.wrapLineWidth(sL, 0, s) + plIndent);
                            //pl = fl(this.textWidth(this.lines[sL].substring(0, s).replace(/ /g, '\u00A0')));
                        }
                        const pr = this._lines[line - 1].hr ? mw : fl(this._lines[line - 1].width + this._charWidth + plIndent);

                        if (cl === pl)
                            startStyle.top = CornerType.Flat;
                        else if (cl > pl)
                            startStyle.top = CornerType.Intern;
                        if (cr === pr)
                            endStyle.top = CornerType.Flat;
                        else if (pl < cr && cr < pr)
                            endStyle.top = CornerType.Intern;
                        else if (cr === 0 && line === eL)
                            endStyle.top = CornerType.Intern;
                    }

                    if (line < eL) {
                        let nr;
                        let nrIndent = this._lines[line + 1].indent ? this._indent * this._charWidth : 0;
                        if (this._lines[line + 1].hr)
                            nr = mw;
                        else
                            nr = fl(eL === line + 1 ? (this.wrapLineWidth(line + 1, 0, e) + nrIndent) : (this._lines[line + 1].width + this._charWidth + nrIndent));
                        //nr = fl(eL === line + 1 ? this.textWidth(this.lines[line + 1].substring(0, e).replace(/ /g, '\u00A0')) : (this._lines[line + 1].width + this._charWidth));
                        if (cl === fl(nrIndent))
                            startStyle.bottom = CornerType.Flat;
                        else if (fl(nrIndent) < cl && cl < nr)
                            startStyle.bottom = CornerType.Intern;

                        if (cr === nr)
                            endStyle.bottom = CornerType.Flat;
                        else if (cr < nr)
                            endStyle.bottom = CornerType.Intern;
                    }

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
                }

                if (!this._overlays[type][line])
                    this._overlays[type][line] = [];
                this._overlays[type][line].push(`<span id="${type}-${r}" class="${cls}" style="left:${(this._timestamp ? this._timestampWidth : 0) + cl}px;width: ${w}px;"></span>`);
                if (startStyle.top === CornerType.Intern)
                    this._overlays[type][line].push(`<span class="${rangeCls} ist" style="top:$0px;left:${(this._timestamp ? this._timestampWidth : 0) + (cl - 7)}px;"></span>`);
                if (startStyle.bottom === CornerType.Intern)
                    this._overlays[type][line].push(`<span class="${rangeCls} isb" style="top:${this._charHeight - 7}px;left:${(this._timestamp ? this._timestampWidth : 0) + (cl - 7)}px;"></span>`);
                if (endStyle.top === CornerType.Intern)
                    this._overlays[type][line].push(`<span class="${rangeCls} iet" style="top:0px;left:${(this._timestamp ? this._timestampWidth : 0) + (cl) + w}px;"></span>`);
                if (endStyle.bottom === CornerType.Intern)
                    this._overlays[type][line].push(`<span class="${rangeCls} ieb" style="top:${this._charHeight - 7}px;left:${(this._timestamp ? this._timestampWidth : 0) + (cl) + w}px;"></span>`);
            }
        }
        let ol;
        for (ol in this._overlays[type]) {
            if (!this._overlays[type].hasOwnProperty(ol))
                continue;
            this._overlays[type][ol] = `<div style="top: ${(+ol || 0) * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line">${this._overlays[type][ol].join('')}</div>`;
            if (this.split) { //&& ol >= this.split._viewRange.start) {
                this.split.dirty = true;
                this.doUpdate(UpdateType.scrollViewOverlays);
            }
        }
        this.doUpdate(UpdateType.overlays);
    }

    //TODO add font support, as different blocks of text could have different font formats, need to not just measure with but measure based on format block data
    private updateSelection() {
        this.addOverlays([{ start: this._currentSelection.start, end: this._currentSelection.end }], 'select-text', 'selection');
    }

    get hasSelection(): boolean {
        const sel = this._currentSelection;
        if (sel.start.x === sel.end.x && sel.start.y === sel.end.y)
            return false;
        return true;
    }

    get selection(): string {
        if (this._lines.length === 0) return '';
        const sel = this._currentSelection;
        let s = sel.start.x;
        let e = sel.end.x;
        let sL = sel.start.y;
        let eL = sel.end.y;
        if (sL < 0)
            sL = 0;
        else if (sL >= this._lines.length)
            sL = this._lines.length - 1;
        if (eL < 0)
            eL = 0;
        else if (eL >= this._lines.length)
            eL = this._lines.length - 1;
        //convert wrap offset to text offsets
        s = this._lines[sL].startOffset + s;
        e = this._lines[eL].startOffset + e;
        //convert wrap lines to text lines
        sL = this._model.getLineFromID(this._lines[sL].id);
        eL = this._model.getLineFromID(this._lines[eL].id);
        if (sL > eL) {
            sL = sel.end.y;
            eL = sel.start.y;
            s = sel.end.x;
            e = sel.start.x;
        }
        else if (sL < eL) {
            sL = sel.start.y;
            eL = sel.end.y;
            s = sel.start.x;
            e = sel.end.x;
        }
        else if (s === e) {
            return '';
        }
        else if (sel.start.y > 0 && sel.start.y < this._lines.length && this._lines[sel.start.y].hr)
            return '---';
        else
            return this._model.getText(sL, Math.min(s, e), Math.max(s, e));
        const len = this._lines.length;

        if (sL < 0)
            sL = 0;
        if (eL >= len) {
            eL = len - 1;
            e = this.getLineText(eL).length;
        }
        if (s < 0)
            s = 0;
        if (e > this.getLineText(eL).length)
            e = this.getLineText(eL).length;

        //convert wrap offset to text offsets
        s = this._lines[sL].startOffset + s;
        e = this._lines[eL].startOffset + e;
        //convert wrap lines to text lines
        sL = this._model.getLineFromID(this._lines[sL].id);
        eL = this._model.getLineFromID(this._lines[eL].id);
        const txt = [];
        const lines = this._model.lines;
        if (this.lines[sL].formats[0].hr)
            txt.push('---');
        else
            txt.push(lines[sL].text.substring(s));
        sL++;
        while (sL < eL) {
            if (lines[sL].formats[0].hr)
                txt.push('---');
            else
                txt.push(lines[sL].text);
            sL++;
        }
        if (lines[eL].formats[0].hr)
            txt.push('---');
        else
            txt.push(lines[eL].text.substring(0, e));
        return txt.join('\n');
    }

    get selectionAsHTML(): string {
        if (this._lines.length === 0) return '';
        const sel = this._currentSelection;
        let s = sel.start.x;
        let e = sel.end.x;
        let sL = sel.start.y;
        let eL = sel.end.y;
        if (sL < 0)
            sL = 0;
        else if (sL >= this._lines.length)
            sL = this._lines.length - 1;
        if (eL < 0)
            eL = 0;
        else if (eL >= this._lines.length)
            eL = this._lines.length - 1;
        //convert wrap offset to text offsets
        s = this._lines[sL].startOffset + s;
        e = this._lines[eL].startOffset + e;
        //convert wrap lines to text lines
        sL = this._model.getLineFromID(this._lines[sL].id);
        eL = this._model.getLineFromID(this._lines[eL].id);
        if (sL > eL) {
            sL = sel.end.y;
            eL = sel.start.y;
            s = sel.end.x;
            e = sel.start.x;
        }
        else if (sL < eL) {
            sL = sel.start.y;
            eL = sel.end.y;
            s = sel.start.x;
            e = sel.end.x;
        }
        else if (sel.start.x === sel.end.x) {
            return '';
        }
        else {
            sL = sel.start.y;
            if (sL < 0) sL = 0;
            if (sL >= this._lines.length)
                sL = this._lines.length - 1;
            //convert wrap offset to text offsets
            s = this._lines[sL].startOffset + s;
            e = this._lines[eL].startOffset + e;
            s = Math.min(sel.start.x, sel.end.x);
            e = Math.max(sel.start.x, sel.end.x);
            //convert wrap lines to text lines
            sL = this._model.getLineFromID(this._lines[sel.start.y].id);
            return this.getLineHTML(sL, s, e);
        }
        const len = this._lines.length;

        if (sL < 0)
            sL = 0;
        if (eL >= len) {
            eL = len - 1;
            e = this.getLineText(eL).length;
        }
        if (s < 0)
            s = 0;
        if (e > this.getLineText(eL).length)
            e = this.getLineText(eL).length;
        //convert wrap offset to text offsets
        s = this._lines[sL].startOffset + s;
        e = this._lines[eL].startOffset + e;
        //convert wrap lines to text lines
        sL = this._model.getLineFromID(this._lines[sL].id);
        eL = this._model.getLineFromID(this._lines[eL].id);

        const txt = [this.getLineHTML(sL, s)];
        sL++;
        while (sL < eL) {
            txt.push(this.getLineHTML(sL));
            sL++;
        }
        txt.push(this.getLineHTML(eL, 0, e));
        return txt.join('\n');
    }

    public selectAll() {
        let ll = this._lines.length;
        if (ll === 0) return;
        ll--;
        /*
        this._prevSelection = {
            start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset },
            end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset }
        };
        */
        this._currentSelection = {
            start: { x: 0, y: 0, lineID: this._lines[0].id, lineOffset: 0 },
            end: { x: this.getLineText(ll).length, y: ll, lineID: this._lines[ll].id, lineOffset: this._lines[ll].endOffset },
            scrollTimer: null,
            drag: false
        };
        this.emit('selection-changed');
        this.emit('selection-done');
        this.updateSelection();
    }

    public clearSelection() {
        /*
        this._prevSelection = {
            start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset },
            end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y, lineID: this._currentSelection.end.lineID, lineOffset: this._currentSelection.end.lineOffset }
        };
        */
        this._currentSelection = {
            start: { x: null, y: null, lineID: null, lineOffset: null },
            end: { x: null, y: null, lineID: null, lineOffset: null },
            scrollTimer: null,
            drag: false
        };
        this.emit('selection-changed');
        this.emit('selection-done');
        this.updateSelection();
    }

    private update() {
        if (this.split) this.split.dirty = true;
        this._os = this.offset(this._el);
        this._maxView = this._el.clientWidth - this._padding[1] - this._padding[3] - this._VScroll.size;
        this._maxViewHeight = this._el.clientHeight - this._padding[0] - this._padding[2] - this._HScroll.size;
        //resized so new width needs a recalculate
        this._viewCache = {};
        if (this.split) {
            this.split.viewCache = {};
            this.split._innerHeight = this.split.clientHeight;
        }
        this._innerHeight = this._el.clientHeight;
        this._innerWidth = this._el.clientWidth;
    }

    private buildStyleSheet() {
        let styles = `.background > span, .view > span, .line, .background-line { height: ${this._charHeight}px; line-height: ${this._charHeight - 2}px; }`;
        if (!this._enableColors)
            styles += '.view > span span {color: inherit !important;}';
        if (!this._enableColors || !this._enableBackgroundColors)
            styles += '.background > span span {background-color: inherit !important;}';
        this._styles.innerHTML = styles;
    }

    private buildLineDisplay(idx?: number, mw?, mv?) {
        if (idx === undefined)
            idx = this._lines.length - 1;
        const back = [];
        const fore = [];
        //const text = this.getLineText(idx).replace(/ /g, '\u00A0');
        const id = this._lines[idx].id;
        const line = this._model.getLineFromID(id);
        const text = this.lines[line].text.replace(/ /g, '\u00A0');
        const formats = this.lines[line].formats;
        let offset = 0;
        let bStyle: any = '';
        let fStyle: any = '';
        let fCls: any = '';
        const ch = this._charHeight;
        const cw = this._charWidth;
        const len = formats.length;
        const endFormat = this._lines[idx].endFormat
        const endOffset = this._lines[idx].endOffset;
        const startOffset = this._lines[idx].startOffset;
        const startFormat = this._lines[idx].startFormat;
        let left = 0;
        let links = 0;
        let right = false;
        if (this._timestamp) {
            back.push('<span style="float: left;left:0;width:', this._timestampWidth, 'px;background:', this._model.GetColor(-8), ';"></span>');
            if (this._lines[idx].indent)
                fore.push('<span style="float: left;left:0;width:', this._timestampWidth, 'px;color:', this._model.GetColor(-7), ';"></span>');
            else
                fore.push('<span style="float: left;left:0;width:', this._timestampWidth, 'px;color:', this._model.GetColor(-7), ';">', moment(this.lines[line].timestamp).format(this._timestampFormat), '</span>');
            left += this._timestampWidth;
        }
        if (this._lines[idx].indent) {
            back.push('<span style="float: left;left:0;width:', (this._indent || 0) * cw, 'px;"></span>');
            fore.push('<span style="float: left;left:0;width:', (this._indent || 0) * cw, 'px;"></span>');
            left += (this._indent || 0) * cw;
        }
        for (let f = 0; f <= endFormat; f++) {
            const format = formats[f];
            let nFormat;
            let end;
            let eText;
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
            if (offset < startOffset)
                offset = startOffset;
            if (end > endOffset)
                end = endOffset;
            let width = this._lines[idx].formatWidths[f] || format.width;
            if (format.formatType === FormatType.Normal) {
                eText = text.substring(offset, end);
                if (format.bStyle) {
                    bStyle = format.bStyle;
                    fStyle = format.fStyle;
                    fCls = format.fCls;
                }
                else {
                    bStyle = [];
                    fStyle = [];
                    fCls = [];
                    if (typeof format.background === 'number')
                        bStyle.push('background:', this._model.GetColor(format.background), ';');
                    else if (format.background)
                        bStyle.push('background:', format.background, ';');
                    if (typeof format.color === 'number')
                        fStyle.push('color:', this._model.GetColor(format.color), ';');
                    else if (format.color)
                        fStyle.push('color:', format.color, ';');

                    //TODO variable character height is not supported
                    //TODO once supported update parser support tag to add font
                    /*
                    if (format.font || format.size) {
                        if (format.font) fStyle.push('font-family: ', format.font, ';');
                        if (format.size) fStyle.push('font-size: ', format.size, ';');
                    }
                    */

                    if (format.style !== FontStyle.None) {
                        if ((format.style & FontStyle.Bold) === FontStyle.Bold)
                            fCls.push('b');
                        if ((format.style & FontStyle.Italic) === FontStyle.Italic)
                            fCls.push('i');
                        if ((format.style & FontStyle.Overline) === FontStyle.Overline)
                            fCls.push('o');
                        if ((format.style & FontStyle.DoubleUnderline) === FontStyle.DoubleUnderline || (format.style & FontStyle.Underline) === FontStyle.Underline)
                            fCls.push('u');
                        if ((format.style & FontStyle.DoubleUnderline) === FontStyle.DoubleUnderline)
                            fCls.push('du');
                        if ((format.style & FontStyle.Rapid) === FontStyle.Rapid || (format.style & FontStyle.Slow) === FontStyle.Slow) {
                            if (this.enableFlashing)
                                fCls.push('ansi-blink');
                            else if ((format.style & FontStyle.DoubleUnderline) !== FontStyle.DoubleUnderline && (format.style & FontStyle.Underline) !== FontStyle.Underline)
                                fCls.push('u');
                        }
                        if ((format.style & FontStyle.Strikeout) === FontStyle.Strikeout)
                            fCls.push('s');
                    }
                    format.bStyle = bStyle = bStyle.join('');
                    format.fStyle = fStyle = fStyle.join('');
                    if (fCls.length !== 0)
                        format.fCls = fCls = ' class="' + fCls.join(' ') + '"';
                    else
                        format.fCls = fCls = '';
                }
                if (f < startFormat) continue;
                if (format.hr) {
                    back.push('<span style="left:0;width:', mw, 'px;', bStyle, '"></span>');
                    fore.push('<span style="left:0;width:', mw, 'px;', fStyle, '"', fCls, '><div class="hr" style="background-color:', (typeof format.color === 'number' ? this._model.GetColor(format.color) : format.color), '"></div></span>');
                }
                else if (end - offset !== 0) {
                    back.push('<span style="left:', left, 'px;width:', width, 'px;', bStyle, '"></span>');
                    fore.push('<span style="left:', left, 'px;width:', width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                    left += width;
                }
            }
            else if (format.formatType === FormatType.Link) {
                if (f < startFormat) continue;
                links++;
                fore.push('<a draggable="false" class="URLLink" href="javascript:void(0);" title="', format.href.replace(/"/g, '&quot;'), '" onclick="', this.linkFunction, '(\'', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), '\');return false;">');
                if (end - offset === 0) continue;
                eText = text.substring(offset, end);
                back.push('<span style="left:', left, 'px;width:', width, 'px;', bStyle, '"></span>');
                fore.push('<span style="left:', left, 'px;width:', width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                left += width;
            }
            else if (format.formatType === FormatType.LinkEnd || format.formatType === FormatType.MXPLinkEnd || format.formatType === FormatType.MXPSendEnd) {
                if (f < startFormat) continue;
                links--;
                fore.push('</a>');
            }
            else if (format.formatType === FormatType.MXPLink) {
                if (f < startFormat) continue;
                links++;
                fore.push('<a draggable="false" data-id="', id, '" class="MXPLink" data-href="', format.href, '" href="javascript:void(0);" title="', format.hint.replace(/"/g, '&quot;'), '" onclick="', this.mxpLinkFunction, '(this, \'', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), '\');return false;">');
                if (end - offset === 0) continue;
                eText = text.substring(offset, end);
                back.push('<span style="left:', left, 'px;width:', width, 'px;', bStyle, '"></span>');
                fore.push('<span style="left:', left, 'px;width:', width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                left += width;
            }
            else if (format.formatType === FormatType.MXPSend) {
                if (f < startFormat) continue;
                links++;
                fore.push('<a draggable="false" data-id="', id, '" class="MXPLink" href="javascript:void(0);" title="', format.hint.replace(/"/g, '&quot;'), '" onmouseover="', this.mxpTooltipFunction, '(this);"', ' onclick="', this.mxpSendFunction, '(event||window.event, this, ', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), ', ', format.prompt ? 1 : 0, ', ', format.tt.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), ');return false;">');
                if (end - offset === 0) continue;
                eText = text.substring(offset, end);
                back.push('<span style="left:', left, 'px;width:', width, 'px;', bStyle, '" ></span>');
                fore.push('<span style="left:', left, 'px;width:', width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                left += width;
            }
            else if (format.formatType === FormatType.MXPExpired && end - offset !== 0) {
                if (f < startFormat) continue;
                eText = text.substring(offset, end);
                back.push('<span style="left:', left, 'px;width:', width, 'px;', bStyle, '"></span>');
                fore.push('<span style="left:', left, 'px;width:', width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                left += width;
            }
            else if (format.formatType === FormatType.Image) {
                if (f < startFormat) continue;
                eText = '';
                const tmp = ['<img style="'];
                if (format.url.length > 0) {
                    eText += format.url;
                    if (!format.url.endsWith('/'))
                        eText += '/';
                }
                if (format.t.length > 0) {
                    eText += format.t;
                    if (!format.t.endsWith('/'))
                        eText += '/';
                }
                eText += format.name;
                if (width)
                    tmp.push('width:', width, 'px;');
                else if (format.w.length > 0)
                    tmp.push('width:', formatUnit(format.w, cw), ';');

                if (format.height)
                    tmp.push('height:', format.height, 'px;');
                else if (format.h.length > 0)
                    tmp.push('height:', formatUnit(format.h, ch), ';');

                switch (format.align.toLowerCase()) {
                    case 'left':
                        tmp.push('float:left;');
                        break;
                    case 'right':
                        tmp.push('float:right;');
                        right = true;
                        break;
                    case 'top':
                    case 'middle':
                    case 'bottom':
                        tmp.push('vertical-align:', format.align, ';');
                        break;
                }
                if (format.hspace.length > 0 && format.vspace.length > 0)
                    tmp.push('margin:', formatUnit(format.vspace, cw), ' ', formatUnit(format.hspace, ch), ';');
                else if (format.hspace.length > 0)
                    tmp.push('margin: 0px ', formatUnit(format.hspace, ch), ';');
                else if (format.vspace.length > 0)
                    tmp.push('margin:', formatUnit(format.vspace, cw), ' 0px;');
                //TODO remove max-height when variable height supported
                tmp.push('max-height:', '' + ch, 'px;"');
                back.push(tmp.join(''), ` src="./../assets/blank.png"/>`);
                if (format.ismap) tmp.push(' ismap onclick="return false;"');
                fore.push(tmp.join(''), ` src="${eText}"/>`);
            }
        }
        //close any open links
        while (links--)
            fore.push('</a>');
        if (right)
            return [`<span data-id="${id}" style="top:${idx * ch}px;min-width:${mv}px;">${fore.join('')}<br></span>`, `<span style="top:${idx * ch}px;min-width:${mv}px;">${back.join('')}<br></span>`];
        return [`<span data-id="${id}" style="top:${idx * ch}px;">${fore.join('')}<br></span>`, `<span style="top:${idx * ch}px;">${back.join('')}<br></span>`];
    }

    public getLineHTML(idx?: number, start?: number, len?: number) {
        if (idx === undefined || idx >= this.lines.length)
            idx = this.lines.length - 1;
        else if (idx < 0)
            idx = 0;
        if (start === undefined)
            start = 0;
        if (len === undefined)
            len = this.lines[idx].text.length;
        const parts = [];
        let offset = 0;
        let style: any = '';
        let fCls: any = '';
        const text = this.lines[idx].text;
        const formats = this.lines[idx].formats;
        const fLen = formats.length;
        let right = false;
        for (let f = 0; f < fLen; f++) {
            const format = formats[f];
            let nFormat;
            let end;
            const td = [];
            //let oSize;
            //let oFont;
            if (f < fLen - 1) {
                nFormat = formats[f + 1];
                //skip empty blocks
                if (format.offset === nFormat.offset && nFormat.formatType === format.formatType)
                    continue;
                end = nFormat.offset;
            }
            else
                end = text.length;
            offset = format.offset;

            if (end > len)
                end = len;
            if (offset < start)
                offset = start;

            if (format.formatType === FormatType.Normal) {
                style = [];
                fCls = [];
                if (typeof format.background === 'number')
                    style.push('background:', this._model.GetColor(format.background), ';');
                else if (format.background)
                    style.push('background:', format.background, ';');
                if (typeof format.color === 'number')
                    style.push('color:', this._model.GetColor(format.color), ';');
                else if (format.color)
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
                        style.push('border-bottom: 1px solid ', (typeof format.color === 'number' ? this._model.GetColor(format.color) : format.color), ';');
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
                        style.push('text-decoration:', td.join('').trim(), ';');
                }
                if (offset < start || end < start)
                    continue;
                style = style.join('').trim();
                if (fCls.length !== 0)
                    fCls = ' class="' + fCls.join('').trim() + '"';
                else
                    fCls = '';
                if (format.hr)
                    parts.push('<span style="', style, 'min-width:100%;width:100%;"', fCls, '><div style="position:relative;top: 50%;transform: translateY(-50%);height:4px;width:100%; background-color:', (typeof format.color === 'number' ? this._model.GetColor(format.color) : format.color), '"></div></span>');
                else if (end - offset !== 0)
                    parts.push('<span style="', style, '"', fCls, '>', htmlEncode(text.substring(offset, end)), '</span>');
            }
            else if (format.formatType === FormatType.Link) {
                if (offset < start || end < start)
                    continue;
                parts.push('<a draggable="false" class="URLLink" href="javascript:void(0);" title="');
                parts.push(format.href.replace(/"/g, '&quot;'));
                parts.push('" onclick="', this.linkFunction, '(\'', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), '\');return false;">');
                if (end - offset === 0) continue;
                parts.push('<span style="', style, '"', fCls, '>');
                parts.push(htmlEncode(text.substring(offset, end)));
                parts.push('</span>');
            }
            else if (format.formatType === FormatType.LinkEnd || format.formatType === FormatType.MXPLinkEnd || format.formatType === FormatType.MXPSendEnd) {
                if (offset < start || end < start)
                    continue;
                parts.push('</a>');
            }
            else if (format.formatType === FormatType.MXPLink) {
                if (offset < start || end < start)
                    continue;
                parts.push('<a draggable="false" class="MXPLink" href="javascript:void(0);" title="');
                parts.push(format.href.replace(/"/g, '&quot;'));
                parts.push('"');
                parts.push('onclick="', this.mxpLinkFunction, '(this, \'', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), '\');return false;">');
                if (end - offset === 0) continue;
                parts.push('<span style="', style, '"', fCls, '>');
                parts.push(htmlEncode(text.substring(offset, end)));
                parts.push('</span>');
            }
            else if (format.formatType === FormatType.MXPSend) {
                if (offset < start || end < start)
                    continue;
                parts.push('<a draggable="false" class="MXPLink" href="javascript:void(0);" title="');
                parts.push(format.hint.replace(/"/g, '&quot;'));
                parts.push('"');
                parts.push(' onmouseover="', this.mxpTooltipFunction, '(this);"');
                parts.push(' onclick="', this.mxpSendFunction, '(event||window.event, this, ', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), ', ', format.prompt ? 1 : 0, ', ', format.tt.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), ');return false;">');
                if (end - offset === 0) continue;
                parts.push('<span style="', style, '"', fCls, '>');
                parts.push(htmlEncode(text.substring(offset, end)));
                parts.push('</span>');
            }
            else if (format.formatType === FormatType.MXPExpired && end - offset !== 0) {
                if (offset < start || end < start)
                    continue;
                parts.push('<span style="', style, '"', fCls, '>');
                parts.push(htmlEncode(text.substring(offset, end)));
                parts.push('</span>');
            }
            else if (format.formatType === FormatType.Image) {
                if (offset < start || end < start)
                    continue;
                let tmp = '';
                parts.push('<img src="');
                if (format.url.length > 0) {
                    parts.push(format.url);
                    tmp += format.url;
                    if (!format.url.endsWith('/')) {
                        parts.push('/');
                        tmp += '/';
                    }
                }
                if (format.t.length > 0) {
                    parts.push(format.t);
                    tmp += format.t;
                    if (!format.t.endsWith('/')) {
                        parts.push('/');
                        tmp += '/';
                    }
                }
                tmp += format.name;
                parts.push(format.name, '"  style="');
                if (format.w.length > 0)
                    parts.push('width:', formatUnit(format.w, this._charWidth), ';');
                if (format.h.length > 0)
                    parts.push('height:', formatUnit(format.h, this._charHeight), ';');
                switch (format.align.toLowerCase()) {
                    case 'left':
                        parts.push('float:left;');
                        break;
                    case 'right':
                        parts.push('float:right;');
                        right = true;
                        break;
                    case 'top':
                    case 'middle':
                    case 'bottom':
                        parts.push('vertical-align:', format.align, ';');
                        break;
                }
                if (format.hspace.length > 0 && format.vspace.length > 0) {
                    parts.push('margin:');
                    parts.push(formatUnit(format.vspace, this._charWidth), ' ');
                    parts.push(formatUnit(format.hspace, this._charHeight), ';');
                }
                else if (format.hspace.length > 0) {
                    parts.push('margin:');
                    parts.push('0px ', formatUnit(format.hspace, this._charHeight), ';');
                }
                else if (format.vspace.length > 0) {
                    parts.push('margin:');
                    parts.push(formatUnit(format.vspace, this._charWidth), ' 0px;');
                }
                parts.push('"');
                if (format.ismap) parts.push(' ismap onclick="return false;"');
                parts.push(`src="${tmp}"/>`);
            }
        }
        if (right && len < this.lines[idx].text.length)
            return `<span class="line" style="min-width:100%">${parts.join('')}</span>`;
        if (right)
            return `<span class="line" style="min-width:100%">${parts.join('')}<br></span>`;
        if (len < this.lines[idx].text.length)
            return `<span class="line">${parts.join('')}</span>`;
        return `<span class="line">${parts.join('')}<br></span>`;
    }

    public reCalculateLines() {
        const ll = this.lines.length;
        this._lines = [];
        this._linesMap.clear();
        this._maxWidth = 0;
        this._maxHeight = 0
        //only recalculate if have lines
        if (ll === 0) return;
        let t: WrapLine[] = this.calculateWrapLines(0, 0, this._indent, (this._timestamp ? this._timestampWidth : 0), true);
        if (this.lines[0].formats[0].hr) {
            t[0].hr = true;
            this._maxWidth = Math.max(this._maxWidth, this._maxView);
            this._maxHeight = Math.max(this._maxHeight, this._charHeight);
        }
        else {
            this._maxWidth = Math.max(this._maxWidth, t[0].width);
            this._maxHeight = Math.max(this._maxHeight, t[0].height);
        }
        for (let l = 1, ll = t.length; l < ll; l++) {
            t[l].top = t[l - 1].top + t[l - 1].height;
            this._maxWidth = Math.max(this._maxWidth, t[l].width + ((this._indent || 0) * this._charWidth));
            this._maxHeight = Math.max(this._maxHeight, t[l].height);
        }
        this._linesMap.set(t[0].id, t);
        this._lines.push(...t);

        for (let l = 1; l < ll; l++) {
            const t = this.calculateWrapLines(l, 0, this._indent, (this._timestamp ? this._timestampWidth : 0), true);
            if (this.lines[l].formats[0].hr) {
                t[0].hr = true;
                this._maxWidth = Math.max(this._maxWidth, this._maxView);
                this._maxHeight = Math.max(this._maxHeight, this._charHeight);
            }
            else {
                this._maxWidth = Math.max(this._maxWidth, t[0].width);
                this._maxHeight = Math.max(this._maxHeight, t[0].height);
            }
            this._linesMap.set(t[0].id, t);
            t[0].top = this._lines[this._lines.length - 1].top + this._lines[this._lines.length - 1].height;
            for (let l = 1, ll = t.length; l < ll; l++) {
                t[l].top = t[l - 1].top + t[l - 1].height;
                this._maxWidth = Math.max(this._maxWidth, t[l].width + ((this._indent || 0) * this._charWidth));
                this._maxHeight = Math.max(this._maxHeight, t[l].height);
            }
            this._lines.push(...t);
        }
        let offset;
        if (this._currentSelection.start.y !== null) {
            offset = this.getWrapOffsetByLineID(this._currentSelection.start.lineID, this._currentSelection.start.lineOffset)
            this._currentSelection.start.y = offset.y;
            this._currentSelection.start.x = offset.x;
            this.doUpdate(UpdateType.selection);
        }
        if (this._currentSelection.end.y !== null) {
            offset = this.getWrapOffsetByLineID(this._currentSelection.end.lineID, this._currentSelection.end.lineOffset)
            this._currentSelection.end.y = offset.y;
            this._currentSelection.end.x = offset.x;
            this.doUpdate(UpdateType.selection);
        }

        let ol;
        for (ol in this._overlayRanges) {
            //skip selection as that is custom handled, find/find-current are handled by the finder refresh call
            if (!this._overlayRanges.hasOwnProperty(ol) || !this._overlayRanges[ol] || ol === 'selection' || ol === 'find' || ol === 'find-current')
                continue;
            const ranges = this._overlayRanges[ol].ranges;
            const rangesLength = ranges.length;
            for (let r = 0; r < rangesLength; r++) {
                const range = ranges[r];
                if (range.start.y !== null) {
                    offset = this.getWrapOffsetByLineID(range.start.lineID, range.start.lineOffset);
                    range.start.y = offset.y;
                    range.start.x = offset.x;
                }
                if (range.end.y !== null) {
                    offset = this.getWrapOffsetByLineID(range.end.lineID, range.end.lineOffset);
                    range.end.y = offset.y;
                    range.end.x = offset.x;
                }
            }
            this.addOverlays(this._overlayRanges[ol].ranges, this._overlayRanges[ol].cls, ol);
        }
        this._finder.refresh();
    }

    public scrollDisplay(force?: boolean) {
        if (this.split) {
            if (this.split.shown && !force)
                return;
            if (this.scrollLock && !this.split.shown && this._VScroll.scrollSize > 0) {
                this.split.style.display = 'block';
                this.split.shown = true;
                this.split._innerHeight = this.split.clientHeight;
                if (this._scrollCorner) this._scrollCorner.classList.add('active');
                this.doUpdate(UpdateType.scrollView);
            }
        }
        if (!this.scrollLock)
            this._VScroll.scrollToEnd();
    }

    private _scrollCorner: HTMLElement;

    public updateScrollbars() {
        if (this._model.busy)
            return;
        this._HScroll.offset = this._VScroll.trackOffset;
        this._HScroll.resize();
        this._HScroll.visible = this._HScroll.scrollSize > 0;
        this._VScroll.offset = this._HScroll.visible ? this._HScroll.trackOffsetSize.height : 0;
        this._VScroll.resize();
        if (this._VScroll.offset === 0 && this._showSplitButton && this.split && !this._HScroll.visible)
            this._VScroll.padding = this._HScroll.trackOffsetSize.height || this._VScroll.trackOffsetSize.width;
        else
            this._VScroll.padding = 0;

        if (!this._HScroll.visible && this._scrollCorner && (!this.split || !this._showSplitButton)) {
            this._el.removeChild(this._scrollCorner);
            this._scrollCorner = null;
        }
        else if ((this.split || this._HScroll.visible) && !this._scrollCorner) {
            this._scrollCorner = document.createElement('div');
            if (this._showSplitButton && this.split) {
                this._scrollCorner.classList.add('scroll-corner', 'scroll-split-button');
                this._scrollCorner.title = 'Toggle split view';
                this._scrollCorner.innerHTML = '<i class="fa fa-minus"></i>';
                this._scrollCorner.addEventListener('click', e => {
                    e.cancelBubble = true;
                    e.stopPropagation();
                    this.scrollLock = !this.scrollLock;
                    if (this.split.shown)
                        this.scrollDisplay(true);
                    else
                        this._VScroll.scrollBy(-this._charHeight);
                });
            }
            else
                this._scrollCorner.className = 'scroll-corner';
            this._el.appendChild(this._scrollCorner);
        }
        if (this.split) {
            this.split.dirty = true;
            if (this._scrollCorner)
                if (this._VScroll.scrollSize >= 0)
                    this._scrollCorner.classList.remove('disabled');
                else
                    this._scrollCorner.classList.add('disabled');
        }
    }

    public showFind() {
        this._finder.show();
    }

    public hideFind() {
        this._finder.hide();
    }

    public find(focus?: boolean) {
        {
            this._finder.find(false);
        }
    }

    public scrollTo(x: number, y: number) {
        this._VScroll.scrollTo(y);
        this._HScroll.scrollTo(x);
    }

    public scrollToCharacter(x: number, y: number) {
        x *= this._charWidth;
        y *= this._charHeight;
        if (this.split && this.split.shown) {
            if (y < this._VScroll.position)
                this._VScroll.scrollTo(y);
            else if (y + this._charHeight > this._VScroll.position + this._VScroll.trackSize - this.split._innerHeight)
                this._VScroll.scrollTo(y - this._VScroll.trackSize + this.split._innerHeight + this._charHeight);
        }
        else if (y < this._VScroll.position)
            this._VScroll.scrollTo(y);
        else if (y + this._charHeight > this._VScroll.position + this._VScroll.trackSize)
            this._VScroll.scrollTo(y - this._VScroll.trackSize + this._charHeight);
        if (x < this._HScroll.position)
            this._HScroll.scrollTo(x);
        else if (x + this._charWidth > this._HScroll.position + this._HScroll.trackSize)
            this._HScroll.scrollTo(x - this._HScroll.trackSize + this._charWidth);
    }

    public scrollBy(x: number, y: number) {
        this._VScroll.scrollBy(y);
        this._HScroll.scrollBy(x);
    }

    public scrollByCharacter(x: number, y: number) {
        this._VScroll.scrollBy(y * this._charHeight);
        this._HScroll.scrollBy(x * this._charWidth);
    }

    public scrollUp() {
        if (this._viewRange.start < 1 || this._viewRange.start - 1 >= this._lines.length)
            return;
        this._VScroll.scrollBy(-this._lines[this._viewRange.start - 1].height);
    }

    public scrollDown() {
        if (this._viewRange.start + 1 >= this._lines.length)
            return;
        this._VScroll.scrollBy(this._lines[this._viewRange.start + 1].height);
    }

    public scrollLeft() {
        if (this._viewRange.start + 1 >= this._lines.length)
            return;
        this._VScroll.scrollBy(this._lines[this._viewRange.start + 1].height);
    }

    public pageUp() {
        if (this.split)
            this._VScroll.pageUp(this.split._innerHeight);
        else
            this._VScroll.pageUp();
    }

    public pageDown() {
        if (this.split)
            this._VScroll.pageDown(this.split._innerHeight);
        else
            this._VScroll.pageDown();
    }

    public scrollToBottom() {
        this._VScroll.scrollToEnd();
    }

    public get scrollAtBottom() {
        return this._VScroll.atBottom;
    }

    public dispose() {
        this._finder.dispose();
        this._HScroll.dispose();
        this._VScroll.dispose();
        document.body.removeChild(this._character);
        while (this._el.firstChild)
            this._el.removeChild(this._el.firstChild);
        window.removeEventListener('mousemove', this._wMove);
        window.removeEventListener('mouseup', this._wUp);
        window.removeEventListener('resize', this._wResize);
    }

    public updateLayout() {
        const t = window.getComputedStyle(this._el);
        this._borderSize.height = parseInt(t.borderTopWidth) || 0;
        this._borderSize.width = parseInt(t.borderLeftWidth) || 0;
        const padding = [
            parseInt(t.getPropertyValue('padding-top')) || 0,
            parseInt(t.getPropertyValue('padding-right')) || 0,
            parseInt(t.getPropertyValue('padding-bottom')) || 0,
            parseInt(t.getPropertyValue('padding-left')) || 0
        ];
        if (padding[0] !== this._padding[0] ||
            padding[1] !== this._padding[1] ||
            padding[2] !== this._padding[2] ||
            padding[3] !== this._padding[3]
        ) {
            this._padding = padding;
            this.doUpdate(UpdateType.view | UpdateType.selection | UpdateType.scrollbars);
        }
        this._VScroll.updateLayout();
        this._HScroll.updateLayout();
    }

    public getLineText(line, full?: boolean) {
        //if line out of range, or if for what ever reason the line is missing data return empty string
        if (line < 0 || line >= this._lines.length || !this._lines[line]) return '';
        //get line from id in case lines where removed
        const idx = this._model.getLineFromID(this._lines[line].id);
        //line id not found, removed some how return empty string
        if (idx === -1) return '';
        if (full)
            return this.lines[idx].text;
        return this.lines[idx].text.substring(this._lines[line].startOffset, this._lines[line].endOffset);
    }

    public reCalculateWrapLines(line: number, width?: number, indent?: number, left?: number, force?: boolean) {
        const wraps = this.calculateWrapLines(line, width, indent, left, force);
        const lineID = this._model.getLineID(line);
        const wrapIndex = this._lines.findIndex(l => l.id === lineID);
        const wrapAmount = this._linesMap.get(lineID).length;
        this._lines.splice(wrapIndex, wrapAmount, ...wraps);
        this._linesMap.delete(lineID);
        this._linesMap.set(lineID, wraps);
        //clear cache
        for (let a = 0; a < wrapAmount; a++) {
            if (this._viewCache[wrapIndex + a])
                delete this._viewCache[wrapIndex + a];
            if (this.split && this.split.viewCache[wrapIndex + a])
                delete this.split.viewCache[wrapIndex + a];
        }
        if (this.split) this.split.dirty = true;
        this.doUpdate(UpdateType.view | UpdateType.scrollView);
    }

    /**
     *  Calculate the wrapped lines for raw line
     * 
     * @param {number} line the line index to calculate wrapped lines for
     * @param {number=} width the width to wrap to
     * @param {number=} indent the amount of leading indention to prepend
     * @param {number=} left the starting left spacing to allow for fixed columns or addons
     * @param {boolean=} force force the recalculate of each fragment's width
     * @returns {wrapLine[]}
     */
    public calculateWrapLines(line: number, width?: number, indent?: number, left?: number, force?: boolean): WrapLine[] {
        if (line === undefined || line < 0)
            line = 0;
        if (line >= this.lines.length)
            line = this.lines.length - 1;
        if (!width || typeof width !== 'number') {
            if (this._wrapAt)
                width = this._wrapAt * this._charWidth;
            else
                width = this.WindowWidth * this._charWidth;//this._maxView;
        }
        if (width < 200)
            width = 200;
        left = left || 0;
        //cache locally for a performance boost
        const charWidth = this._charWidth;
        const charHeight = this._charHeight;
        //calculate the indent with
        indent = (indent || 0) * charWidth;
        const wrapLines: WrapLine[] = [];
        const lineID = this._model.getLineID(line);
        let currentLine: WrapLine = {
            line: line,
            height: charHeight,
            width: 0,
            top: 0,
            images: 0,
            startOffset: 0,
            startFormat: 0,
            endOffset: 0,
            endFormat: 0,
            indent: false,
            id: lineID,
            formatWidths: [],
            hr: false
        };
        const formats = this.lines[line].formats;
        const formatsLength = formats.length;
        const text = this.lines[line].text.replace(/ /g, '\u00A0');
        const rawText = this.lines[line].text;
        const wrapText = this._wordWrap;
        let endOffset = 0;
        let startOffset = 0;
        let measureText;
        let font: any = 0;
        //start at left column
        let lineWidth = left;
        let lineHeight = charHeight;
        let formatIdx;
        let currentWidth;
        let breakOffset = -1;
        for (formatIdx = 0; formatIdx < formatsLength; formatIdx++) {
            const currentFormat = formats[formatIdx];
            const currentIdx = formatIdx;
            let nextFormat;
            if (formatIdx < formatsLength - 1) {
                nextFormat = formats[formatIdx + 1];
                //empty format block so move on until a new block to process
                if (currentFormat.offset === nextFormat.offset && nextFormat.formatType === currentFormat.formatType)
                    continue;
                endOffset = nextFormat.offset;
            }
            else
                endOffset = text.length;
            if (force) {
                currentFormat.width = 0;
                currentFormat.height = 0;
            }
            startOffset = currentFormat.offset;
            if (!currentLine) {
                currentLine = {
                    line: line,
                    height: charHeight,
                    width: 0,
                    top: 0,
                    images: 0,
                    startOffset: startOffset,
                    startFormat: formatIdx,
                    endOffset: 0,
                    endFormat: 0,
                    indent: true,
                    id: lineID,
                    formatWidths: [],
                    hr: false
                }
            }
            switch (currentFormat.formatType) {
                case FormatType.Normal:
                case FormatType.Link:
                case FormatType.MXPLink:
                case FormatType.MXPSend:
                case FormatType.MXPExpired:
                    //empty block so skip
                    if (endOffset - startOffset === 0) continue;
                    measureText = text.substring(startOffset, endOffset);
                    //TODO add font/variable height support
                    /*
                    if (format.font || format.size) {
                        lineHeight = (Math.max(lineHeight, format.height = format.height || this.textHeight(eText, format.font, format.size) || charHeight));
                        format.width = format.width || this.textWidth(eText, font = `${format.size || this._character.style.fontSize} ${format.font || this._character.style.fontFamily}`);
                    }
                    else */
                    if (currentFormat.unicode || font)
                        currentFormat.width = currentFormat.width || this.textWidth(measureText, font, currentFormat.style);
                    else
                        currentFormat.width = currentFormat.width || measureText.length * charWidth;
                    if (wrapText && lineWidth + currentFormat.width > width) {
                        lineHeight = Math.max(lineHeight, currentFormat.height || charHeight);
                        let currentOffset = startOffset + 1;
                        currentWidth = 0;
                        let formatEnd = -1;
                        for (; currentOffset <= endOffset; currentOffset++) {
                            //if unicode in block make sure to include any unicode modifiers if they are right after current char
                            //also make sure surrogate pair are included
                            if (currentFormat.unicode)
                                //FIXME does not work correctly when the last character in the text is surrogate pair it will wrap but it will wrap 2 chars instead of just the one
                                //https://dmitripavlutin.com/what-every-javascript-developer-should-know-about-unicode/#24-surrogate-pairs
                                if ((text.charCodeAt(currentOffset) >= 0xD800 && text.charCodeAt(currentOffset) <= 0xDBFF)) {
                                    currentOffset++;
                                    if (currentOffset === endOffset - 1)
                                        currentOffset++;
                                }
                                else
                                    while (currentOffset <= endOffset && (this.isUnicodeModifierCode(text.charCodeAt(currentOffset + 1))))
                                        currentOffset++;
                            measureText = text.substring(startOffset, currentOffset);
                            if (currentFormat.unicode)
                                currentWidth = this.textWidth(measureText, 0, currentFormat.style);
                            else
                                currentWidth = measureText.length * charWidth;
                            const char = rawText.charAt(currentOffset);
                            if (char === ' ' || char === '-')
                                breakOffset = currentOffset;
                            if (lineWidth + currentWidth > width) {
                                if (currentOffset === endOffset) {
                                    currentOffset--;
                                    while (currentOffset > 0 && this.isUnicodeModifierCode(text.charCodeAt(currentOffset)))
                                        currentOffset--;
                                }
                                else {
                                    while (currentOffset > 0 && this.isUnicodeModifierCode(text.charCodeAt(currentOffset)))
                                        currentOffset--;
                                    if ((text.charCodeAt(currentOffset) >= 0xD800 && text.charCodeAt(currentOffset) <= 0xDBFF))
                                        currentOffset--;
                                    currentOffset--;
                                }
                                //found a break point in current fragment use it to prevent extra searching
                                if (breakOffset !== -1 && breakOffset <= currentOffset) {
                                    currentOffset = breakOffset;
                                    measureText = text.substring(startOffset, currentOffset);
                                    if (currentFormat.unicode)
                                        currentWidth = this.textWidth(measureText, 0, currentFormat.style);
                                    else
                                        currentWidth = measureText.length * charWidth;
                                    currentLine.width = lineWidth + currentWidth - left;
                                }
                                //no break point and still in fragment so just leave it whole to speed things up
                                else if (breakOffset === -1 && currentLine.startFormat === formatIdx) {
                                    measureText = text.substring(startOffset, currentOffset);
                                    if (currentFormat.unicode)
                                        currentWidth = this.textWidth(measureText, 0, currentFormat.style);
                                    else
                                        currentWidth = measureText.length * charWidth;
                                    currentLine.width = lineWidth + currentWidth - left;
                                }
                                else {
                                    const wordBreak = this.findLineBreak(line, currentLine.startFormat, currentLine.startOffset, formatIdx, currentOffset);
                                    currentOffset = wordBreak.offset;
                                    //format block changed so remeasure the entire section to get correct width
                                    if (formatIdx !== wordBreak.fragment) {
                                        formatIdx = wordBreak.fragment;
                                        formatEnd = 0;
                                        if (formatIdx < formatsLength - 1) {
                                            nextFormat = formats[formatIdx + 1];
                                            //empty format block so move on until a new block to process
                                            //if (currentFormat.offset === nextFormat.offset && nextFormat.formatType === currentFormat.formatType)
                                            //continue;
                                            formatEnd = nextFormat.offset;
                                        }
                                        else
                                            formatEnd = text.length;
                                        currentLine.width = this.lineWidth(line, currentLine.startOffset, currentOffset - currentLine.startOffset);
                                        if (currentLine.indent)
                                            currentLine.width += indent;
                                        currentWidth = 0;
                                        //changed format so new end offset
                                        endOffset = formatEnd;
                                    }
                                    //if same block measure the adjusted string width
                                    else {
                                        measureText = text.substring(startOffset, currentOffset);
                                        if (currentFormat.unicode)
                                            currentWidth = this.textWidth(measureText, 0, currentFormat.style);
                                        else
                                            currentWidth = measureText.length * charWidth;
                                        currentLine.width = lineWidth + currentWidth - left;
                                    }
                                }
                                if (formatEnd === currentOffset && currentFormat.formatType !== FormatType.Normal)
                                    formatIdx++;
                                currentLine.formatWidths[formatIdx] = currentWidth;
                                breakOffset = -1;
                                currentLine.endFormat = formatIdx;
                                currentLine.endOffset = currentOffset;
                                currentLine.height = lineHeight;
                                if (currentLine.indent)
                                    currentLine.width -= indent;
                                wrapLines.push(currentLine);
                                //start at left column + indent width
                                lineWidth = left + indent;
                                currentWidth = 0;
                                lineHeight = charHeight;
                                startOffset = currentOffset;
                                //new line start with image
                                currentLine = {
                                    line: line,
                                    height: charHeight,
                                    width: 0,
                                    top: 0,
                                    images: 0,
                                    startOffset: startOffset,
                                    //if start and end same use next format
                                    startFormat: formatIdx,
                                    endOffset: 0,
                                    endFormat: 0,
                                    indent: true,
                                    id: lineID,
                                    formatWidths: [],
                                    hr: false
                                }
                            }
                            else {
                                currentLine.formatWidths[formatIdx] = currentWidth;
                                //last char so it does not wrap here so add to line width for next block
                                if (currentOffset === endOffset && startOffset !== currentFormat.offset && formatIdx >= currentIdx)
                                    lineWidth += currentWidth;
                            }
                        }
                    }
                    else {
                        lineWidth += currentFormat.width || 0;
                        //new fragment so reset breakOffset
                        breakOffset = -1;
                    }
                    break;
                case FormatType.Image:
                    if (!currentFormat.width || !currentFormat.height) {
                        const img = new Image();
                        measureText = '';
                        if (currentFormat.url.length > 0) {
                            measureText += currentFormat.url;
                            if (!currentFormat.url.endsWith('/'))
                                measureText += '/';
                        }
                        if (currentFormat.t.length > 0) {
                            measureText += currentFormat.t;
                            if (!currentFormat.t.endsWith('/'))
                                measureText += '/';
                        }
                        measureText += currentFormat.name;
                        img.src = measureText;
                        img.dataset.id = '' + this._model.getLineID(line);
                        img.dataset.f = '' + formatIdx;
                        img.dataset.line = '' + line;
                        this._el.appendChild(img);
                        Object.assign(img.style, {
                            position: 'absolute',
                            top: (this._innerWidth + 100) + 'px'
                        });
                        if (currentFormat.w.length > 0 && currentFormat.h.length > 0) {
                            Object.assign(img.style, {
                                width: formatUnit(currentFormat.w, charWidth),
                                height: formatUnit(currentFormat.h, charHeight)
                            });
                        }
                        else if (currentFormat.w.length > 0)
                            img.style.width = formatUnit(currentFormat.w, charWidth);
                        else if (currentFormat.h.length > 0)
                            img.style.height = formatUnit(currentFormat.h, charHeight);
                        else //if not set mark as loading
                            this._lines[line].images++;
                        const bounds = img.getBoundingClientRect();
                        if (currentFormat.w.length > 0)
                            currentFormat.width = bounds.width || img.width;
                        if (currentFormat.h.length > 0)
                            currentFormat.height = bounds.height || img.height;
                        currentFormat.marginHeight = 0;
                        currentFormat.marginWidth = 0;
                        if (currentFormat.hspace.length > 0 && currentFormat.vspace.length > 0) {
                            img.style.marginLeft = formatUnit(currentFormat.hspace, charWidth);
                            img.style.marginTop = formatUnit(currentFormat.vspace, charHeight);
                            const styles = getComputedStyle(img);
                            currentFormat.marginHeight = parseFloat(styles.marginTop) * 2;
                            currentFormat.marginWidth = parseFloat(styles.marginLeft) * 2;
                        }
                        else if (currentFormat.hspace.length > 0) {
                            img.style.marginLeft = formatUnit(currentFormat.hspace, charWidth);
                            const styles = getComputedStyle(img);
                            currentFormat.marginWidth = parseFloat(styles.marginLeft) * 2;
                        }
                        else if (currentFormat.vspace.length > 0) {
                            img.style.marginTop = formatUnit(currentFormat.vspace, charHeight);
                            const styles = getComputedStyle(img);
                            currentFormat.marginHeight = parseFloat(styles.marginTop) * 2;
                        }
                        //only calculate if width or height not set
                        if (!currentFormat.width || !currentFormat.height) {
                            //only append if needing to calculate otherwise just let it be garbage collected
                            img.onload = () => {
                                //get index from id as lines could have been removed
                                const lIdx = this._model.getLineFromID(+img.dataset.id);
                                //if index not found or larger then current lines, line probably was removed
                                if (lIdx === -1 || lIdx >= this.lines.length) return;
                                this._lines[lIdx].images--;
                                const fIdx = +img.dataset.f;
                                const fmt = this.lines[lIdx].formats[fIdx];
                                const bounds = img.getBoundingClientRect();
                                fmt.width = bounds.width || img.width;
                                fmt.height = bounds.height || img.height;
                                this._el.removeChild(img);
                                if (this._lines[lIdx].images !== 0) return;
                                this.reCalculateWrapLines(lIdx, width, indent, left, force);
                                this.updateTops(lIdx);
                                if (lIdx >= this._viewRange.start && lIdx <= this._viewRange.end && this._viewRange.end !== 0 && !this._model.busy) {
                                    if (this.split) this.split.dirty = true;
                                    this.doUpdate(UpdateType.display);
                                }
                            };
                        }
                        else
                            this._el.removeChild(img);
                    }
                    if (currentFormat.marginHeight)
                        lineHeight = Math.max(lineHeight, (currentFormat.height + currentFormat.marginHeight) || charHeight);
                    else
                        lineHeight = Math.max(lineHeight, currentFormat.height || charHeight);
                    lineHeight = charHeight;
                    if (wrapText && lineWidth + (currentFormat.marginWidth || 0) + currentFormat.width > width) {
                        //empty line so image is the current line
                        if (currentLine.width === 0) {
                            if (currentFormat.marginHeight)
                                currentLine.height = Math.max(lineHeight, currentFormat.height + (currentFormat.marginHeight || 0));
                            else
                                currentLine.height = Math.max(lineHeight, currentFormat.height || charHeight);
                            currentLine.width = currentFormat.width;
                            currentLine.endOffset = endOffset;
                            currentLine.endFormat = formatIdx;
                            wrapLines.push(currentLine);
                            currentLine = null;
                            lineWidth = left + indent
                            continue;
                        }
                        else {
                            currentLine.width = lineWidth - left;
                            currentLine.endOffset = startOffset;
                            currentLine.endFormat = formatIdx - 1;
                            if (currentLine.indent)
                                currentLine.width -= indent;
                            wrapLines.push(currentLine);
                            lineWidth = left + indent
                            //new line start with image
                            currentLine = {
                                line: line,
                                height: 0,
                                width: 0,
                                top: 0,
                                images: 0,
                                startOffset: startOffset,
                                startFormat: formatIdx,
                                endOffset: 0,
                                endFormat: 0,
                                indent: true,
                                id: lineID,
                                formatWidths: [],
                                hr: false
                            }
                        }
                    }
                    lineWidth += currentFormat.marginWidth || 0;
                    lineWidth += currentFormat.width || 0;
                    break;
            }
            if (currentFormat.marginHeight)
                lineHeight = Math.max(lineHeight, (currentFormat.height + currentFormat.marginHeight) || charHeight);
            else
                lineHeight = Math.max(lineHeight, currentFormat.height || charHeight);
        }
        if (currentLine) {
            currentLine.height = lineHeight
            currentLine.width = lineWidth - left;
            currentLine.endFormat = formatIdx - 1;
            currentLine.endOffset = endOffset;
            if (currentLine.indent)
                currentLine.width -= indent;
            wrapLines.push(currentLine);
        }
        return wrapLines;
    }

    private findLineBreak(line: number, startFragment: number, startOffset: number, endFragment: number, endOffset: number) {
        if (endOffset <= startOffset)
            return {
                fragment: endFragment,
                offset: endOffset
            };
        const formats = this.lines[line].formats;
        const text = this.lines[line].text;
        let fragmentEndOffset = endOffset;
        for (let formatIdx = endFragment; formatIdx >= startFragment; formatIdx--) {
            const currentFormat = formats[formatIdx];
            let offset = currentFormat.offset;
            if (offset < startOffset)
                offset = startOffset;
            if (endOffset - startOffset === 0)
                continue;
            //if an image break at image
            if (currentFormat.formatType === FormatType.Image)
                return {
                    fragment: endFragment,
                    offset: offset
                };
            const measureText = text.substring(offset, fragmentEndOffset);
            for (let idx = measureText.length - 1; idx >= 0; idx--) {
                //break at space or hyphen
                const char = measureText.charAt(idx);
                if (char === ' ' || char === '-')
                    return {
                        fragment: formatIdx,
                        offset: offset + idx + 1 //make sure space is part of current line
                    }
            }
            fragmentEndOffset = offset;
        }
        return {
            fragment: endFragment,
            offset: endOffset
        }
    }
}

interface ScrollBarOptions {
    parent?;
    content?;
    type?: ScrollType;
    autoScroll?: boolean;
}

/**
 * Scroll bar control
 *
 * @export
 * @class ScrollBar
 * @extends {EventEmitter}
 */
export class ScrollBar extends EventEmitter {
    private _parent;
    private _content;
    private _contentSize;
    private _parentSize;
    private _percentView;
    private _visible = true;
    private _offset = 0;
    private $padding = 0;
    private _os = { left: 0, top: 0 };
    private _padding = [0, 0, 0, 0];
    private _position: number = 0;
    private _thumbSize: number = 0;
    private _ratio: number = 0;
    private _ratio2: number = 0;

    private _lastMouse: MouseEvent;

    private _maxDrag: number = 0;
    private _wMove;
    private _wUp;
    private _wResize;

    private $resizeObserver;
    private $resizeObserverCache;
    private $observer: MutationObserver;
    private _type: ScrollType = ScrollType.vertical;

    public maxPosition: number = 0;

    public thumb: HTMLElement;
    public track: HTMLElement;
    public scrollSize: number = 0;
    public trackSize: number = 0;
    public trackOffset: number = 0;
    public trackOffsetSize = { width: 0, height: 0 };
    public autoScroll = true;

    public state: ScrollState = {
        dragging: false,
        dragPosition: 0,
        position: 0
    };

    /**
     * set or return the content element
     *
     * @memberof ScrollBar
     */
    get content() { return this._content; }
    set content(value) {
        if (this._content === value) return;
        this._content = value;
        this.resize();
    }

    /**
     * Current size of scroll bar
     *
     * @readonly
     * @type {number}
     * @memberof ScrollBar
     */
    get size(): number { return this._visible ? (this._type === ScrollType.horizontal ? this.track.offsetHeight : this.track.offsetWidth) : 0; }

    /**
     * Current position of the scroll bar
     *
     * @readonly
     * @type {number}
     * @memberof ScrollBar
     */
    get position(): number { return Math.round(this._position - (this._type === ScrollType.horizontal ? this._padding[3] : this._padding[0])); }

    get positionRaw(): number { return this._position - (this._type === ScrollType.horizontal ? this._padding[3] : this._padding[0]); }

    /**
     * An offset amount to adjust the whole scroll bar by that effects total size
     *
     * @type {number}
     * @memberof ScrollBar
     */
    get offset(): number { return this._offset; }
    set offset(value: number) {
        if (value !== this._offset) {
            this._offset = value;
            this.updateLocation();
            this.resize();
        }
    }

    /**
     * A padding amount to adjust the scroll bar by and effects track size
     *
     * @type {number}
     * @memberof ScrollBar
     */
    get padding(): number { return this.$padding; }
    set padding(value: number) {
        if (value !== this.$padding) {
            this.$padding = value;
            this.updateLocation();
            this.resize();
        }
    }

    /**
     * The type of scroll bar, either vertical or horizontal
     *
     * @type {ScrollType}
     * @memberof ScrollBar
     */
    get type(): ScrollType { return this._type; }
    set type(value: ScrollType) {
        if (this._type !== value) {
            this._type = value;
            this.trackOffsetSize = { width: 0, height: 0 };
            this.track.className = 'scroll-track scroll-' + (this._type === ScrollType.horizontal ? 'horizontal' : 'vertical');
            this.updateLocation();
            this.resize();
        }
    }

    /**
     * Is scroll var visible
     *
     * @type {boolean}
     * @memberof ScrollBar
     */
    get visible(): boolean { return this._visible; }
    set visible(value: boolean) {
        if (!this._visible === value) {
            this._visible = value;
            this.track.style.display = value ? 'block' : 'none';
            this.resize();
        }
    }

    /**
     * is scroll bar at the bottom
     *
     * @readonly
     * @type {boolean}
     * @memberof ScrollBar
     */
    get atBottom(): boolean { return this.position >= this.scrollSize; }

    /**
     * Creates an instance of ScrollBar.
     *
     * @param {HTMLElement} [parent] element that will contain the scroll bar
     * @param {HTMLElement} [content] element that will be scrolled, if left off will default to parent
     * @param {ScrollType} [type=ScrollType.vertical] type of scroll bar
     * @memberof ScrollBar
     */
    constructor(options: ScrollBarOptions) {
        super();
        if (options) {
            this.setParent(options.parent, options.content);
            this.type = options.type || ScrollType.vertical;
            if (options.hasOwnProperty('autoScroll'))
                this.autoScroll = options.autoScroll;
        }
        else
            this.type = ScrollType.vertical;
    }

    /**
     * sets the parent element with optional content element
     *
     * @param {HTMLElement} parent element that will contain the scroll bar
     * @param {HTMLElement} [content] element that will be scrolled, if left off will default to parent
     * @memberof ScrollBar
     */
    public setParent(parent: HTMLElement, content?: HTMLElement) {
        if (this.track)
            this._parent.removeChild(this.track);
        this._parent = parent;
        this._content = content || parent;
        this.createBar();
    }

    /**
     * Updates the location of the scroll bar in the parent based on type
     *
     * @private
     * @memberof ScrollBar
     */
    private updateLocation() {
        if (this._type === ScrollType.horizontal) {
            this.track.style.top = '';
            this.track.style.right = (this.offset + this.padding) + 'px';
            this.track.style.left = '0';
            this.track.style.bottom = '0';
            this.track.style.width = 'auto';
            this.track.style.height = '';

            this.thumb.style.height = '100%';
            this.thumb.style.width = '';
        }
        else {
            this.track.style.top = '0';
            this.track.style.right = '0';
            this.track.style.left = '';
            this.track.style.bottom = (this.offset + this.padding) + 'px';
            this.track.style.width = '';
            this.track.style.height = 'auto';

            this.thumb.style.height = '';
            this.thumb.style.width = '100%';
        }
        this.thumb.style.left = '0';
        this.thumb.style.top = '0';
        this._os = this.elOffset(this.track);
    }

    /**
     * Creates scroll bar elements
     *
     * @private
     * @memberof ScrollBar
     */
    private createBar() {
        this.track = document.createElement('div');
        this.track.className = 'scroll-track scroll-' + (this._type === ScrollType.horizontal ? 'horizontal' : 'vertical');
        this.track.style.position = 'absolute';
        this.track.style.overflow = 'hidden';
        this.track.addEventListener('mousedown', (e) => {
            if (e.button === 0 && e.buttons) {
                this._lastMouse = e;
                e.preventDefault();
                e.cancelBubble = true;
                this.state.dragging = true;
                this.state.position = 0;
                this.state.dragPosition = (this._type === ScrollType.horizontal ? (e.pageX - this._os.left) : (e.pageY - this._os.top)) - this.state.position;
                this.updatePosition(this.currentPosition());
            }
        });
        this._parent.appendChild(this.track);

        this.thumb = document.createElement('div');
        this.thumb.className = 'scroll-thumb';
        this.thumb.style.position = 'absolute';
        this.track.appendChild(this.thumb);
        this.updateLocation();
        this.thumb.addEventListener('mousedown', (e) => {
            this._lastMouse = e;
            if (e.button === 0 && e.buttons) {
                e.preventDefault();
                e.cancelBubble = true;
                this.state.dragging = true;
                this.state.position = (this._type === ScrollType.horizontal ? e.pageX : e.pageY) - this.state.dragPosition;
                this.state.dragPosition = (this._type === ScrollType.horizontal ? (e.pageX - this._os.left) : (e.pageY - this._os.top)) - this.state.position;
            }
        });
        this._parent.addEventListener('wheel', (event) => {
            this.scrollBy(this._type === ScrollType.horizontal ? event.deltaX : event.deltaY);
        }, { passive: true });
        this._wMove = (e) => {
            this._lastMouse = e;
            if (this.state.dragging) {
                this.updatePosition(this.currentPosition());
            }
        };
        this._wUp = (e) => {
            this._lastMouse = e;
            if (this.state.dragging) {
                this.state.dragging = false;
                this.updatePosition(this.currentPosition());
            }
        };
        this._wResize = (e) => {
            this.resize(true);
        };

        window.addEventListener('mousemove', this._wMove.bind(this));

        window.addEventListener('mouseup', this._wUp.bind(this));

        window.addEventListener('resize', this._wResize.bind(this));
        this.resize(true);
        this.$resizeObserver = new ResizeObserver((entries, observer) => {
            if (entries.length === 0) return;
            if (!entries[0].contentRect || entries[0].contentRect.width === 0 || entries[0].contentRect.height === 0)
                return;
            if (!this.$resizeObserverCache || this.$resizeObserverCache.width !== entries[0].contentRect.width || this.$resizeObserverCache.height !== entries[0].contentRect.height) {
                this.$resizeObserverCache = { width: entries[0].contentRect.width, height: entries[0].contentRect.height };
                this.resize(true);
            }
        });
        this.$resizeObserver.observe(this.track);
        this.$observer = new MutationObserver((mutationsList) => {
            let mutation;
            for (mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    this.updateLayout();
                }
            }
        });
        this.$observer.observe(this.track, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
        this.updateLayout();
    }

    /**
     * resets the scroll bar to 0 position
     *
     * @memberof ScrollBar
     */
    public reset() {
        this.state = {
            dragging: false,
            dragPosition: 0,
            position: 0
        };
        this.maxPosition = 0;
        this.updatePosition(0, true);
        this.update();
    }

    /**
     * Updates the scroll bar thumb and drag sizes
     *
     * @memberof ScrollBar
     */
    public update() {
        if (this.scrollSize >= 0)
            this.track.classList.remove('scroll-disabled');
        else
            this.track.classList.add('scroll-disabled');
        this._thumbSize = Math.ceil(1 / this._percentView * this.trackSize) || 0;
        if (this._thumbSize > this.trackSize)
            this._thumbSize = this.trackSize;
        if (this._thumbSize < 15)
            this._thumbSize = 15;
        this.thumb.style[this._type === ScrollType.horizontal ? 'width' : 'height'] = this._thumbSize + 'px';
        this._maxDrag = this.trackSize - this._thumbSize;
        if (this._maxDrag <= 0) {
            this._maxDrag = 0;
            this._ratio = 1;
            this._ratio2 = 1;
        }
        else {
            this._ratio = (this._contentSize - this._parentSize) / (this._maxDrag);
            this._ratio2 = (this._maxDrag) / (this._contentSize - this._parentSize);
        }
    }

    /**
     * Scroll by a certain amount
     *
     * @param {number} amount the amount to scroll from current position
     * @returns
     * @memberof ScrollBar
     */
    public scrollBy(amount: number) {
        if (amount === 0) return;
        amount = this.positionRaw + (amount < 0 ? Math.floor(amount) : Math.ceil(amount));
        amount = amount * this._ratio2;
        this.updatePosition(amount);
    }

    /**
     * scroll to an exact position
     *
     * @param {number} position the position to scroll to
     * @memberof ScrollBar
     */
    public scrollTo(position: number) {
        position = (position < 0 ? Math.floor(position) : Math.ceil(position));
        position = position * this._ratio2;
        this.updatePosition(position);
    }

    /**
     * scroll to the end position of the scroll bar
     *
     * @memberof ScrollBar
     */
    public scrollToEnd() {
        this.updatePosition(this.maxPosition);
    }

    /**
     * scroll to the start position
     *
     * @memberof ScrollBar
     */
    public scrollToStart() {
        this.updatePosition(0);
    }

    public pageUp(offset?) {
        offset = offset || 0;
        this.scrollBy(-(this._parentSize - (this._type === ScrollType.horizontal ? this._padding[3] : this._padding[2]) - offset));
    }

    public pageDown(offset?) {
        offset = offset || 0;
        this.scrollBy(this._parentSize - (this._type === ScrollType.horizontal ? this._padding[3] : this._padding[2]) - offset);
    }

    /**
     * resize the scroll bar to the parent
     *
     * @memberof ScrollBar
     */
    public resize(bar?, contentSize?, parentSize?) {
        const bottom = this.atBottom;
        if (this._type === ScrollType.horizontal) {
            if (!contentSize)
                contentSize = this._content.clientWidth;
            if (!parentSize)
                parentSize = this._parent.clientWidth;
            this._contentSize = contentSize + this._padding[1] + this._padding[3];
            this._parentSize = parentSize - this.offset;
            if (bar || !this.trackSize) {
                this.trackSize = this.track.clientWidth;
                this.trackOffset = this.track.clientHeight;
            }
            this.scrollSize = this._contentSize - this._parentSize - this._padding[3];
        }
        else {
            if (!contentSize)
                contentSize = this._content.clientHeight;
            if (!parentSize)
                parentSize = this._parent.clientHeight;
            this._contentSize = contentSize + this._padding[0] + this._padding[2];
            this._parentSize = parentSize - this.offset;
            if (bar) {
                this.trackSize = this.track.clientHeight;
                this.trackOffset = this.track.clientWidth;
            }
            this.scrollSize = this._contentSize - this._parentSize - this._padding[2];
        }
        if (bar || !this.trackOffsetSize.width)
            this.trackOffsetSize = { height: this.track.offsetHeight, width: this.track.offsetWidth };
        this._percentView = this._contentSize / this._parentSize;
        //not sure why i subtracted from parent size to get maxPosition as it breaks resize and scroll to wne
        this.maxPosition = this._parentSize;// - Math.ceil(1 / this._percentView * this._parentSize);
        if (this.maxPosition < 0)
            this.maxPosition = 0;
        this.update();
        if (bottom && this.autoScroll)
            this.updatePosition(this.maxPosition);
        else
            this.updatePosition(this._position * this._ratio2);
    }

    public updateLayout() {
        const pc = window.getComputedStyle(this._parent);
        this._padding = [
            parseInt(pc.getPropertyValue('padding-top')) || 0,
            parseInt(pc.getPropertyValue('padding-right')) || 0,
            parseInt(pc.getPropertyValue('padding-bottom')) || 0,
            parseInt(pc.getPropertyValue('padding-left')) || 0
        ];
    }

    /**
     * current position of scroll bar
     *
     * @returns
     * @memberof ScrollBar
     */
    public currentPosition() {
        const p = this._type === ScrollType.horizontal ? (this._lastMouse.pageX - this.state.position - this._os.left) : (this._lastMouse.pageY - this.state.position - this._os.top);
        if (p < 0)
            return 0;
        if (p > this.maxPosition)
            return this.maxPosition;
        return p;
    }

    /**
     * update position of scroll bar
     *
     * @private
     * @param {*} p
     * @memberof ScrollBar
     * @fires ScrollBar#scroll
     */
    private updatePosition(p, force?) {
        if (p < 0 || this._maxDrag < 0)
            p = 0;
        else if (p > this._maxDrag)
            p = this._maxDrag;
        const prv = this.position;
        this.thumb.style[this._type === ScrollType.horizontal ? 'left' : 'top'] = p + 'px';
        this.state.dragPosition = p;
        this._position = p * this._ratio;
        if (this._position < 0)
            this._position = 0;
        this.update();
        this.emit('scroll', this.position, prv !== this.position || force);
    }

    /**
     * calculate the offset of an element
     *
     * @private
     * @param {*} elt element to get offset for
     * @returns {position} returns the top and left positions
     * @memberof ScrollBar
     */
    private elOffset(elt) {
        const rect = elt.getBoundingClientRect();
        const bodyElt = document.body;
        return {
            top: rect.top + bodyElt.scrollTop,
            left: rect.left + bodyElt.scrollLeft
        };
    }

    /**
     * remove the scroll bar
     *
     * @memberof ScrollBar
     */
    public dispose() {
        if (this.track)
            this._parent.removeChild(this.track);
        window.removeEventListener('mousemove', this._wMove);
        window.removeEventListener('mouseup', this._wUp);
        window.removeEventListener('resize', this._wResize);
    }
}

export class DisplayModel extends EventEmitter {
    private _lineID = 0;
    private _parser: Parser;
    public lines: LineData[] = [];
    private lineIDs: number[] = [];
    private _expire = {};
    private _expire2 = [];

    get enableDebug() {
        return this._parser.enableDebug;
    }

    set enableDebug(value) {
        this._parser.enableDebug = value;
    }

    get tabWidth(): number {
        return this._parser.tabWidth;
    }

    set tabWidth(value) {
        this._parser.tabWidth = value;
    }

    get textLength(): number {
        return this._parser.textLength;
    }

    get EndOfLine(): boolean {
        return this._parser.EndOfLine;
    }

    get parseQueueLength(): number {
        return this._parser.parseQueueLength;
    }

    get parseQueueEndOfLine(): boolean {
        return this._parser.parseQueueEndOfLine;
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

    set showInvalidMXPTags(value: boolean) {
        this._parser.showInvalidMXPTags = value;
    }
    get showInvalidMXPTags(): boolean {
        return this._parser.showInvalidMXPTags;
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

    set emulateControlCodes(value: boolean) {
        this._parser.emulateControlCodes = value;
    }
    get emulateControlCodes(): boolean {
        return this._parser.emulateControlCodes;
    }

    set MXPStyleVersion(value: string) {
        this._parser.StyleVersion = value;
    }
    get MXPStyleVersion(): string {
        return this._parser.StyleVersion;
    }

    constructor(options: DisplayOptions) {
        super();
        this._parser = new Parser(options);
        this._parser.on('debug', (msg) => { this.emit(msg); });

        this._parser.on('bell', () => { this.emit('bell'); });

        this._parser.on('add-line', (data: ParserLine) => {
            this.addParserLine(data, true);
        });

        this._parser.on('expire-links', (args) => {
            let lines;
            let line;
            let expire;
            if (!args || args.length === 0) {
                for (line in this._expire2) {
                    if (!this._expire2.hasOwnProperty(line))
                        continue;
                    this.expireLineLinkFormat(this._expire2[line], +line);
                }
                for (expire in this._expire) {
                    if (!this._expire.hasOwnProperty(expire))
                        continue;
                    lines = this._expire[expire];
                    for (line in lines) {
                        if (!lines.hasOwnProperty(line))
                            continue;
                        this.expireLineLinkFormat(lines[line], +line);
                    }
                }
                this._expire2 = [];
                this._expire = {};
                this.emit('expire-links', args);
            }
            else if (this._expire[args]) {
                lines = this._expire[args];
                for (line in lines) {
                    if (!lines.hasOwnProperty(line))
                        continue;
                    this.expireLineLinkFormat(lines[line], +line);
                }
                delete this._expire[args];
                this.emit('expire-links', args);
            }
        });

        this._parser.on('parse-done', () => {
            this.emit('parse-done');
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

        this._parser.on('MXP-tag-reply', (tag, args) => {
            this.emit('MXP-tag-reply', tag, args);
        });

    }

    public addParserLine(data: ParserLine, noUpdate?: boolean) {
        data.timestamp = Date.now();
        this.emit('add-line', data);
        if (data == null || typeof data === 'undefined' || data.line == null || typeof data.line === 'undefined')
            return;
        this.emit('add-line-done', data);
        if (data.gagged)
            return;
        const line: LineData = {
            text: (data.line === '\n' || data.line.length === 0) ? '' : data.line,
            raw: data.raw,
            formats: data.formats,
            id: this._lineID,
            timestamp: data.timestamp
        }
        this.lines.push(line);
        this.lineIDs.push(this._lineID);
        this._lineID++;
        this.buildLineExpires(this.lines.length - 1);
        this.emit('line-added', data, noUpdate);
    }

    private expireLineLinkFormat(formats, idx: number) {
        let f;
        let fs;
        let fl;
        let fsl;
        let type;
        let eType;
        let format;
        let n = 0;
        for (fs = 0, fsl = formats.length; fs < fsl; fs++) {
            fl = this.lines[idx].formats.length;
            f = formats[fs];
            format = this.lines[idx].formats[f];
            type = format.formatType;
            if (format.formatType === FormatType.MXPLink)
                eType = FormatType.MXPLinkEnd;
            else
                eType = FormatType.MXPSendEnd;
            format.formatType = FormatType.MXPExpired;
            f++;
            for (; f < fl; f++) {
                if (this.lines[idx].formats[f] === eType) {
                    if (n === 0) {
                        this.lines[idx].formats[f].formatType = FormatType.MXPSkip;
                        break;
                    }
                    else
                        n--;
                }
                else if (this.lines[idx].formats[f] === type)
                    n++;
            }
        }
        this.emit('expire-link-line', idx);
    }

    public clear() {
        this._parser.Clear();
        this.lines = [];
        this._expire = {};
        this._expire2 = [];
        this.lineIDs = [];
        this._lineID = 0;
    }

    public IncreaseColor(color, percent) {
        return this._parser.IncreaseColor(color, percent);
    }

    public GetColor(color) {
        return this._parser.GetColor(color);
    }

    public append(txt: string, remote?: boolean, force?: boolean, prependSplit?: boolean) {
        this._parser.parse(txt, remote || false, force || false, prependSplit || false);
    }

    public CurrentAnsiCode() {
        return this._parser.CurrentAnsiCode();
    }

    public updateWindow(width?, height?) {
        this._parser.updateWindow(width, height);
    }

    public SetColor(code: number, color) {
        this._parser.SetColor(code, color);
    }

    public ClearMXP() {
        this._parser.ClearMXP();
    }

    public ResetMXPLine() {
        this._parser.ResetMXPLine();
    }

    get busy() {
        return this._parser.busy;
    }

    public removeLine(line: number) {
        this.lines.splice(line, 1);
        this.lineIDs.splice(line, 1);
        this._expire2.splice(line, 1);
    }

    public removeLines(line: number, amt: number) {
        this.lines.splice(line, amt);
        this.lineIDs.splice(line, amt);
        this._expire2.splice(line, amt);
        for (let ol in this._expire) {
            if (!this._expire.hasOwnProperty(ol) || this._expire[ol].length === 0 || line >= this._expire[ol].length)
                continue;
            this._expire[ol].splice(line, amt);
        }
    }

    public getLineID(line: number) {
        if (line < 0 || line >= this.lineIDs.length) return -1;
        return this.lineIDs[line];
    }

    public get getNextLineID() {
        return this._lineID;
    }

    public getLineFromID(id) {
        return this.lineIDs.indexOf(id);
    }

    private buildLineExpires(idx) {
        if (idx === undefined)
            idx = this.lines.length - 1;
        const formats = this.lines[idx].formats;
        for (const ol in this._expire) {
            if (!this._expire.hasOwnProperty(ol))
                continue;
            if (this._expire[ol][idx])
                delete this._expire[ol][idx];
        }
        delete this._expire2[idx];
        let f = formats.length;
        let format;
        while (f--) {
            format = formats[f];
            if (format.formatType === FormatType.MXPSend || format.formatType === FormatType.MXPLink) {
                if (format.expire && format.expire.length > 0) {
                    if (!this._expire[format.expire])
                        this._expire[format.expire] = [];
                    if (!this._expire[format.expire][idx])
                        this._expire[format.expire][idx] = [];
                    this._expire[format.expire][idx].push(f);
                }
                else {
                    if (!this._expire2[idx])
                        this._expire2[idx] = [];
                    this._expire2[idx].push(f);
                }
            }
        }
    }

    //color like javascript.substr using 0 index and length
    public colorSubStrByLine(idx: number, fore, back?, start?: number, len?: number, style?: FontStyle) {
        return this.colorSubStringByLine(idx, fore, back, start, start + len, style);
    }

    //color like javascript.substring using 0 index for start and end
    public colorSubStringByLine(idx: number, fore, back?, start?: number, end?: number, style?: FontStyle) {
        //invalid line bail
        if (idx < 0 || idx >= this.lines.length) return false;
        const lineLength = this.lines[idx].text.length;
        //passed line skip
        if (start >= lineLength) return false;
        if (!start || start < 0) start = 0;
        if (!end || end > lineLength)
            end = lineLength;
        if (start === end)
            return false;
        const formats = this.lines[idx].formats;
        let len = formats.length;
        let found: boolean = false;
        //whole line so just do everything
        if (start === 0 && end >= lineLength) {
            for (let f = 0; f < len; f++) {
                const format = formats[f];
                //only worry about normal types
                if (format.formatType !== FormatType.Normal)
                    continue;
                found = true;
                if (format.bStyle) {
                    format.bStyle = 0;
                    format.fStyle = 0;
                    format.fCls = 0;
                }
                format.color = fore || format.color;
                format.background = back || format.background;
                format.style |= style || FontStyle.None;
            }
            //found no text block must create one
            if (!found) {
                formats.unshift({
                    formatType: FormatType.Normal,
                    offset: 0,
                    color: fore || 0,
                    background: back || 0,
                    size: 0,
                    font: 0,
                    style: style || FontStyle.None,
                    unicode: false
                });
            }
        }
        else {
            let nFormat;
            let formatEnd;
            for (let f = 0; f < len; f++) {
                const format = formats[f];
                //only worry about normal types
                if (format.formatType !== FormatType.Normal)
                    continue;
                //find the end of he format
                if (f < len - 1) {
                    let nF = f + 1;
                    nFormat = formats[nF];
                    //skip empty blocks
                    if (format.offset === nFormat.offset && nFormat.formatType === format.formatType)
                        continue;
                    //find next block that is not same offset
                    while (format.offset === nFormat.offset && nFormat.formatType === format.formatType && nF < len - 1)
                        nFormat = formats[++nF];
                    //last block same offset use total length
                    if (nF === len && format.offset === nFormat.offset)
                        formatEnd = lineLength;
                    else
                        formatEnd = nFormat.offset;
                }
                else
                    formatEnd = lineLength;
                if (start < format.offset) continue;
                //passed end so try next block
                if (start >= formatEnd) continue;
                //after this block move on.
                //not offset so need to insert a new block
                found = true;
                if (format.bStyle) {
                    format.bStyle = 0;
                    format.fStyle = 0;
                    format.fCls = 0;
                }
                //if end middle of block, add new block with old info to split
                if (end < formatEnd) {
                    format.width = 0;
                    formats.splice(f + 1, 0, {
                        formatType: format.formatType,
                        offset: end,
                        color: format.color,
                        background: format.background,
                        size: format.size,
                        font: format.font,
                        style: format.style,
                        unicode: format.unicode
                    });
                    len++;
                }
                if (start != format.offset) {
                    //clean old width
                    format.width = 0;
                    //insert new block with new colors
                    formats.splice(f + 1, 0, {
                        formatType: format.formatType,
                        offset: start,
                        color: fore || format.color,
                        background: back || format.background,
                        size: format.size,
                        font: format.font,
                        style: format.style | (style || FontStyle.None),
                        unicode: format.unicode
                    });
                    len++;
                }
                else {
                    format.color = fore || format.color;
                    format.background = back || format.background;
                    format.style |= (style || FontStyle.None);
                }
                //not end so shift start to next block
                if (end > formatEnd)
                    start = formatEnd;
            }
            //clean out duplicates and other no longer needed blocks
            this.lines[idx].formats = this.pruneFormats(formats, this.textLength);
        }
        return true;
    }

    public removeStyleSubStrByLine(idx: number, style: FontStyle, start?: number, len?: number) {
        return this.removeStyleSubStringByLine(idx, style, start, start + len);
    }

    //color like javascript.substring using 0 index for start and end
    public removeStyleSubStringByLine(idx: number, style: FontStyle, start?: number, end?: number) {
        //invalid line bail
        if (idx < 0 || idx >= this.lines.length) return false;
        const lineLength = this.lines[idx].text.length;
        //passed line skip
        if (start >= lineLength) return false;
        if (!start || start < 0) start = 0;
        if (!end || end > lineLength)
            end = lineLength;

        const formats = this.lines[idx].formats;
        let len = formats.length;
        let found: boolean = false;
        //whole line so just do everything
        if (start === 0 && end >= lineLength) {
            for (let f = 0; f < len; f++) {
                const format = formats[f];
                //only worry about normal types
                if (format.formatType !== FormatType.Normal)
                    continue;
                found = true;
                if (format.bStyle) {
                    format.bStyle = 0;
                    format.fStyle = 0;
                    format.fCls = 0;
                }
                format.style &= ~(style || FontStyle.None);
            }
            //found no text block must create one
            if (!found) {
                formats.unshift({
                    formatType: FormatType.Normal,
                    offset: 0,
                    color: 0,
                    background: 0,
                    size: 0,
                    font: 0,
                    style: FontStyle.None,
                    unicode: false
                });
            }
        }
        else {
            let nFormat;
            let formatEnd;
            for (let f = 0; f < len; f++) {
                const format = formats[f];
                //only worry about normal types
                if (format.formatType !== FormatType.Normal)
                    continue;
                //find the end of he format
                if (f < len - 1) {
                    let nF = f + 1;
                    nFormat = formats[nF];
                    //skip empty blocks
                    if (format.offset === nFormat.offset && nFormat.formatType === format.formatType)
                        continue;
                    //find next block that is not same offset
                    while (format.offset === nFormat.offset && nFormat.formatType === format.formatType && nF < len - 1)
                        nFormat = formats[++nF];
                    //last block same offset use total length
                    if (nF === len && format.offset === nFormat.offset)
                        formatEnd = lineLength;
                    else
                        formatEnd = nFormat.offset;
                }
                else
                    formatEnd = lineLength;
                if (start < format.offset) continue;
                //passed end so try next block
                if (start >= formatEnd) continue;
                //after this block move on.
                //not offset so need to insert a new block
                found = true;
                if (format.bStyle) {
                    format.bStyle = 0;
                    format.fStyle = 0;
                    format.fCls = 0;
                }
                //if end middle of block, add new block with old info to split
                if (end < formatEnd) {
                    format.width = 0;
                    formats.splice(f + 1, 0, {
                        formatType: format.formatType,
                        offset: end,
                        color: format.color,
                        background: format.background,
                        size: format.size,
                        font: format.font,
                        style: format.style,
                        unicode: format.unicode
                    });
                    len++;
                }
                if (start != format.offset) {
                    //clean old width
                    format.width = 0;
                    //insert new block with new colors
                    formats.splice(f + 1, 0, {
                        formatType: format.formatType,
                        offset: start,
                        color: format.color,
                        background: format.background,
                        size: format.size,
                        font: format.font,
                        style: format.style & ~(style || FontStyle.None),
                        unicode: format.unicode
                    });
                    len++;
                }
                else {
                    format.style &= ~(style || FontStyle.None);
                }
                //not end so shift start to next block
                if (end > formatEnd)
                    start = formatEnd;
            }
            //clean out duplicates and other no longer needed blocks
            this.lines[idx].formats = this.pruneFormats(formats, this.textLength);
        }
        return true;
    }

    public highlightSubStrByLine(idx: number, start?: number, len?: number) {
        return this.highlightStyleSubStringByLine(idx, start, start + len);
    }

    //color like javascript.substring using 0 index for start and end
    public highlightStyleSubStringByLine(idx: number, start?: number, end?: number, color?: boolean) {
        //invalid line bail
        if (idx < 0 || idx >= this.lines.length) return false;
        const lineLength = this.lines[idx].text.length;
        //passed line skip
        if (start >= lineLength) return false;
        if (!start || start < 0) start = 0;
        if (!end || end > lineLength)
            end = lineLength;

        const formats = this.lines[idx].formats;
        let len = formats.length;
        let found: boolean = false;
        //whole line so just do everything
        if (start === 0 && end >= lineLength) {
            for (let f = 0; f < len; f++) {
                const format = formats[f];
                //only worry about normal types
                if (format.formatType !== FormatType.Normal)
                    continue;
                found = true;
                if (format.bStyle) {
                    format.bStyle = 0;
                    format.fStyle = 0;
                    format.fCls = 0;
                }
                if (color || (format.style & FontStyle.Bold) === FontStyle.Bold) {
                    if (typeof format.color === 'number')
                        format.color = this._parser.IncreaseColor(this._parser.GetColor(format.color), 0.25);
                    else
                        format.color = this._parser.IncreaseColor(format.color, 0.25);
                }
                else
                    format.style |= FontStyle.Bold;
            }
            //found no text block must create one
            if (!found) {
                formats.unshift({
                    formatType: FormatType.Normal,
                    offset: 0,
                    color: color ? 370 : 0,
                    background: 0,
                    size: 0,
                    font: 0,
                    style: color ? FontStyle.None : FontStyle.Bold,
                    unicode: false
                });
            }
        }
        else {
            let nFormat;
            let formatEnd;
            for (let f = 0; f < len; f++) {
                const format = formats[f];
                //only worry about normal types
                if (format.formatType !== FormatType.Normal)
                    continue;
                //find the end of he format
                if (f < len - 1) {
                    let nF = f + 1;
                    nFormat = formats[nF];
                    //skip empty blocks
                    if (format.offset === nFormat.offset && nFormat.formatType === format.formatType)
                        continue;
                    //find next block that is not same offset
                    while (format.offset === nFormat.offset && nFormat.formatType === format.formatType && nF < len - 1)
                        nFormat = formats[++nF];
                    //last block same offset use total length
                    if (nF === len && format.offset === nFormat.offset)
                        formatEnd = lineLength;
                    else
                        formatEnd = nFormat.offset;
                }
                else
                    formatEnd = lineLength;
                if (start < format.offset) continue;
                //passed end so try next block
                if (start >= formatEnd) continue;
                //after this block move on.
                //not offset so need to insert a new block
                found = true;
                if (format.bStyle) {
                    format.bStyle = 0;
                    format.fStyle = 0;
                    format.fCls = 0;
                }
                //if end middle of block, add new block with old info to split
                if (end < formatEnd) {
                    format.width = 0;
                    formats.splice(f + 1, 0, {
                        formatType: format.formatType,
                        offset: end,
                        color: format.color,
                        background: format.background,
                        size: format.size,
                        font: format.font,
                        style: format.style,
                        unicode: format.unicode
                    });
                    len++;
                }
                if (start != format.offset) {
                    //clean old width
                    format.width = 0;
                    //insert new block with new colors
                    nFormat = {
                        formatType: format.formatType,
                        offset: start,
                        color: format.color,
                        background: format.background,
                        size: format.size,
                        font: format.font,
                        style: format.style,
                        unicode: format.unicode
                    }
                    if (color || (format.style & FontStyle.Bold) === FontStyle.Bold) {
                        if (typeof format.color === 'number')
                            nFormat.color = this._parser.IncreaseColor(this._parser.GetColor(format.color), 0.25);
                        else
                            nFormat.color = this._parser.IncreaseColor(format.color, 0.25);
                    }
                    else
                        nFormat.style |= FontStyle.Bold;
                    formats.splice(f + 1, 0, nFormat);
                    len++;
                }
                else if (color || (format.style & FontStyle.Bold) === FontStyle.Bold) {
                    if (typeof format.color === 'number')
                        format.color = this._parser.IncreaseColor(this._parser.GetColor(format.color), 0.25);
                    else
                        format.color = this._parser.IncreaseColor(format.color, 0.25);
                }
                else
                    format.style |= FontStyle.Bold;

                //not end so shift start to next block
                if (end > formatEnd)
                    start = formatEnd;
            }
            //clean out duplicates and other no longer needed blocks
            this.lines[idx].formats = this.pruneFormats(formats, this.textLength);
        }
        return true;
    }

    private pruneFormats(formats, textLen) {
        //no formats or only 1 format
        if (!formats || formats.length < 2) return formats;
        const l = formats.length;
        const nF = [];
        for (let f = 0; f < l; f++) {
            const format = formats[f];
            let end;
            if (f < l - 1) {
                const nFormat = formats[f + 1];
                //old links that have expired so no longer needed clean
                //if (format.formatType === FormatType.MXPSkip) continue;
                //skip format until find one that has different offset
                if (format.offset === nFormat.offset && nFormat.formatType === format.formatType)
                    continue;
                end = nFormat.offset;
                //empty link
                if (format.formatType === FormatType.Link && end - format.offset === 0 && nFormat.formatType === FormatType.LinkEnd)
                    continue;
                //empty send
                if (format.formatType === FormatType.MXPSend && end - format.offset === 0 && nFormat.formatType === FormatType.MXPSendEnd)
                    continue;
                //empty link
                if (format.formatType === FormatType.MXPLink && end - format.offset === 0 && nFormat.formatType === FormatType.MXPLinkEnd)
                    continue;
                //same data but offset is higher, set next block current offset, clear width and continue;
                if (
                    format.formatType === nFormat.formatType &&
                    format.color === nFormat.color &&
                    format.background === nFormat.background &&
                    format.size === nFormat.size &&
                    format.font === nFormat.font &&
                    format.style === nFormat.style &&
                    format.unicode === nFormat.unicode
                ) {
                    nFormat.offset = format.offset;
                    nFormat.width = 0;
                    continue;
                }
            }
            //trailing link with no text or empty format block and not fragment
            else if (format.offset === textLen && textLen !== 0 && ((format.formatType === FormatType.Normal && !format.hr) || format.formatType === FormatType.Link || format.formatType === FormatType.MXPSend || format.formatType === FormatType.MXPLink))
                continue;
            nF.push(format);
        }
        return nF;
    }

    get text(): string {
        return this.lines.map(line => line.text).join('\n');
    }

    get raw(): string {
        return this.lines.map(line => line.raw).join('');
    }

    public getText(line, start, end?) {
        if (line < 0 || line >= this.lines.length) return '';
        if (start < 0) start = 0;
        if (typeof end === 'undefined' || end > this.lines[line].text.length)
            return this.lines[line].text.substring(start);
        return this.lines[line].text.substring(start, end);
    }
}