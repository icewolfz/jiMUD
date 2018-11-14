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
import { DisplayOptions, OverlayRange } from './types';

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
export enum UpdateType { none = 0, view = 1, overlays = 2, selection = 4, scrollbars = 8, update = 16, scroll = 32, scrollEnd = 64, scrollView = 128, display = 256, selectionChanged = 512, scrollViewOverlays = 1024, layout = 2048 }

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

interface Line {
    height: number;
    top: number;
    width: number;
    images: number;
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
 * @todo Add/fox MXP image selection highlighting
 */
export class Display extends EventEmitter {
    private _lineID = 0;
    private _parser: Parser;
    private _el: HTMLElement;
    private _os;
    private _padding = [0, 0, 0, 0];

    private _overlay: HTMLElement;
    private _view: HTMLElement;
    private _background: HTMLElement;
    private _finder: Finder;
    private _maxView: number = 0;

    private _maxLineLength: number = 0;
    private _currentSelection: Selection = {
        start: { x: null, y: null },
        end: { x: null, y: null },
        scrollTimer: null,
        drag: false
    };
    private _prevSelection = {
        start: { x: null, y: null },
        end: { x: null, y: null }
    };
    private _borderSize: Size = { width: 0, height: 0 };
    private _character: HTMLElement;
    private _viewRange: Range = { start: 0, end: 0 };
    private _viewCache = {};
    private _enableDebug: boolean = false;
    private _lastMouse: MouseEvent;
    private _roundedRanges: boolean = true;

    private _lines: Line[] = [];

    public lines: string[] = [];
    private lineIDs: number[] = [];
    public rawLines: string[] = [];
    public scrollToEnd: boolean = true;
    private lineFormats = [];
    private _maxLines: number = 5000;
    private _charHeight: number;
    private _charWidth: number;
    private _expire = {};
    private _expire2 = [];
    private _overlays: Overlays = {
        selection: []
    };
    private _VScroll: ScrollBar;
    private _HScroll: ScrollBar;
    private _updating: UpdateType = UpdateType.none;
    private _splitHeight: number = -1;

    public split = null;
    public splitLive: boolean = false;
    public scrollLock: boolean = false;

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
            this.doUpdate(UpdateType.selection | UpdateType.overlays);
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
                if (this.split.dirty && this.split.shown && this._VScroll.scrollSize >= 0 && this.lines.length > 0) {
                    this.split._viewRange.start = Math.trunc(this._VScroll.scrollSize / this._charHeight);
                    this.split._viewRange.end = Math.ceil((this._VScroll.scrollSize + this._innerHeight) / this._charHeight);

                    if (this.split._viewRange.start < 0)
                        this.split._viewRange.start = 0;
                    if (this.split._viewRange.end > this.lines.length)
                        this.split._viewRange.end = this.lines.length;
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
                    const mw = '' + (this._maxLineLength === 0 ? 0 : Math.max(this._maxLineLength * this._charWidth, this._maxView));
                    const mv = '' + this._maxView;
                    this.split.view.style.width = this._maxLineLength * this._charWidth + 'px';
                    this.split.background.style.width = this._maxLineLength * this._charWidth + 'px';
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
                if (this.split.shown && this._VScroll.scrollSize >= 0 && this.lines.length > 0) {
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
                else if (e.pageY > this._innerHeight - 150 - this._HScroll.size)
                    this.split.ghostBar.style.top = (this._innerHeight - 150 - this.split.bar.offsetHeight - this._HScroll.size) + 'px';
                else
                    this.split.ghostBar.style.top = (e.pageY - this.split.bar.offsetHeight) + 'px';
                let h;
                if (this.splitLive) {
                    if (e.pageY < 20)
                        h = this._innerHeight - 20 + this.split.bar.offsetHeight;
                    else if (e.pageY > this._innerHeight - 150)
                        h = 150;
                    else
                        h = this._innerHeight - e.pageY + this.split.bar.offsetHeight;

                    h = (h / this._innerHeight * 100);
                    this.split.style.height = h + '%';
                    this.split._innerHeight = this.split.clientHeight;
                    this.doUpdate(UpdateType.scrollView | UpdateType.view);
                }
                this.emit('split-move', h);
            };

            this.split.moveDone = (e) => {
                if (this.split.ghostBar) {
                    let h;
                    if (e.pageY < 20)
                        h = this._innerHeight - 20 + this.split.bar.offsetHeight - this._HScroll.size;
                    else if (e.pageY > this._innerHeight - 150 - this._HScroll.size)
                        h = 150;
                    else
                        h = this._innerHeight - e.pageY + this.split.bar.offsetHeight;
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
        document.body.appendChild(this._ruler);

        this._character = document.createElement('div');
        this._character.id = this.id + '-Character';
        this._character.className = 'ansi';
        //this._character.style.borderBottom = '1px solid black';
        this._character.innerText = 'W';
        this._character.style.visibility = 'hidden';
        this._ruler.style.visibility = 'hidden';
        document.body.appendChild(this._character);

        this._charHeight = $(this._character).innerHeight();
        this._charWidth = parseFloat(window.getComputedStyle(this._character).width);
        this.buildStyleSheet();

        this._VScroll = new ScrollBar(this._el, this._view);
        this._VScroll.on('scroll', () => {
            this.doUpdate(UpdateType.scroll | UpdateType.view);
        });
        this._HScroll = new ScrollBar(this._el, this._view, ScrollType.horizontal);
        this._HScroll.on('scroll', () => {
            this.doUpdate(UpdateType.scroll);
        });
        //this.update();

        if (!options)
            options = { display: this };
        else
            options.display = this;
        this._parser = new Parser(options);
        this._parser.on('debug', (msg) => { this.debug(msg); });

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
                this.doUpdate(UpdateType.view);
            }
            else if (this._expire[args]) {
                lines = this._expire[args];
                for (line in lines) {
                    if (!lines.hasOwnProperty(line))
                        continue;
                    this.expireLineLinkFormat(lines[line], +line);
                }
                delete this._expire[args];
                this.doUpdate(UpdateType.view);
            }
            this.emit('expire-links', args);
        });

        this._parser.on('parse-done', () => {
            this.doUpdate(UpdateType.display);
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

        this._el.addEventListener('mousedown', (e) => {
            if (e.buttons && e.button === 0) {
                e.preventDefault();
                e.cancelBubble = true;
                const os = this._os;
                if (e.pageX - os.left > this._innerWidth)
                    return;
                if (e.pageY - os.top > this._innerHeight)
                    return;
                this._currentSelection.drag = true;
                this._prevSelection = {
                    start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y },
                    end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y }
                };
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
            if (this.lines.length === 0 || e.button !== 0) return;
            if (e.detail === 2) {
                const o = this.getLineOffset(e.pageX, e.pageY);
                if (o.y >= 0 && o.y < this.lines.length) {
                    const line = this.lines[o.y];
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
                            this._prevSelection = {
                                start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y },
                                end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y }
                            };
                            this._currentSelection = {
                                start: { x: sPos, y: o.y },
                                end: { x: ePos, y: o.y },
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
                if (o.y >= 0 && o.y < this.lines.length) {
                    this._prevSelection = {
                        start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y },
                        end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y }
                    };
                    this._currentSelection = {
                        start: { x: 0, y: o.y },
                        end: { x: this.lines[o.y].length, y: o.y },
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
                    this._prevSelection = {
                        start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y },
                        end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y }
                    };
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
                        if (this._currentSelection.end.y >= this.lines.length)
                            this._currentSelection.end.x = this.lines[this.lines.length - 1].length;
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
                    else if (x > 0 && this._currentSelection.end.y >= this.lines.length) {
                        this._currentSelection.end.x = this.lines[this.lines.length - 1].length;
                    }
                    else {
                        x = 0;
                        this._currentSelection.end.x = 0;
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
            let word: string = '';
            let line: string = '';
            let url: string = '';
            if (this.lines.length > 0) {
                const o = this.getLineOffset(e.pageX, e.pageY);
                if (o.y >= 0 && o.y < this.lines.length) {
                    line = this.lines[o.y];
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
                        if (sPos >= 0 && ePos <= len)
                            word = line.substring(sPos, ePos);
                        const formats = this.lineFormats[o.y];
                        const fl = formats.length;
                        let l;
                        for (l = 0; l < fl; l++) {
                            const format = formats[l];
                            if (format.formatType !== FormatType.Link && format.formatType !== FormatType.MXPLink)
                                continue;
                            let end = format.offset;
                            if (l < fl - 1) {
                                const nFormat = formats[l + 1];
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
            }
        });
        this.$resizeObserver.observe(this._el);
        this.$observer = new MutationObserver((mutationsList) => {
            let mutation;
            for (mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (this.split) this.split.dirty = true;
                    this.doUpdate(UpdateType.scrollbars | UpdateType.update | UpdateType.view | UpdateType.layout);
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
                }
                this._view.style.transform = `translate(${-this._HScroll.position}px, ${-this._VScroll.position}px)`;
                this._background.style.transform = `translate(${-this._HScroll.position}px, ${-this._VScroll.position}px)`;
                this._overlay.style.transform = `translate(${-this._HScroll.position}px, ${-this._VScroll.position}px)`;
                this._updating &= ~UpdateType.scroll;
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
                this._prevSelection.end = this._currentSelection.end;
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
            if ((this._updating & UpdateType.update) === UpdateType.update) {
                this.update();
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
        this._parser.enableDebug = enable;
    }

    get textLength(): number {
        return this._parser.textLength;
    }

    get EndOfLine(): boolean {
        return this._parser.EndOfLine;
    }

    get EndOfLineLength(): number {
        if (this.lines.length === 0)
            return 0;
        return this.lines[this.lines.length - 1].length;
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

    set MXPStyleVersion(value: string) {
        this._parser.StyleVersion = value;
    }
    get MXPStyleVersion(): string {
        return this._parser.StyleVersion;
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
    }

    public clear() {
        this._parser.Clear();
        this.lines = [];
        this.rawLines = [];
        this.lineFormats = [];
        this._expire = {};
        this._expire2 = [];
        this._overlays = {
            selection: []
        };
        this._viewCache = {};
        if (this.split) {
            this.split.viewCache = {};
            this.split.dirty = true;
        }
        this.lineIDs = [];
        this._lines = [];
        this._lineID = 0;
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
        this.doUpdate(UpdateType.scrollbars);
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
            this._charHeight = $(this._character).innerHeight();
            this._charWidth = parseFloat(window.getComputedStyle(this._character).width);
            this.buildStyleSheet();
            //update view to display any line height changes
            this.doUpdate(UpdateType.view | UpdateType.selection | UpdateType.update | UpdateType.scrollView | UpdateType.overlays);
            this.updateWindow();
            //re-enable in case something outside of font change triggers a change
            this.$observer.observe(this._el, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
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
        const w = this._maxLineLength * this._charWidth;
        let l = this.lines.length;
        if (this._hideTrailingEmptyLine && l && this.lines[l - 1].length === 0)
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
        while (line < l) {
            //this._viewLines[line] = this._viewLines[line].replace(/top:\d+px/, `top:${line * this._charHeight}px`);
            //this._backgroundLines[line] = this._backgroundLines[line].replace(/top:\d+px/, `top:${line * this._charHeight}px`);
            line++;
        }
    }

    get WindowSize(): Size {
        return new Size(this.WindowWidth, this.WindowHeight);
    }

    get WindowWidth(): number {
        return Math.trunc((this._innerWidth - this._VScroll.size - this._padding[1] - this._padding[3]) / parseFloat(window.getComputedStyle(this._character).width)) - 1;
    }

    get WindowHeight(): number {
        if (this._HScroll.visible)
            return Math.trunc((this._innerHeight - this._HScroll.size - this._padding[0] - this._padding[2]) / ($(this._character).innerHeight() + 0.5)) - 1;
        return Math.trunc((this._innerHeight - this._padding[0] - this._padding[2]) / ($(this._character).innerHeight() + 0.5)) - 1;
    }

    public click(callback) {
        this._el.addEventListener('click', callback);
    }

    public addParserLine(data: ParserLine, noUpdate?: boolean) {
        let t;
        this.emit('add-line', data);
        if (data == null || typeof data === 'undefined' || data.line == null || typeof data.line === 'undefined')
            return;
        this.emit('add-line-done', data);
        if (data.gagged)
            return;
        if (data.line === '\n' || data.line.length === 0)
            this.lines.push('');
        else
            this.lines.push(data.line);
        this.rawLines.push(data.raw);
        this.lineFormats.push(data.formats);
        if (data.formats[0].hr) {
            t = this.WindowWidth;
            if (t > this._maxLineLength)
                this._maxLineLength = t;
        }
        else if (data.line.length > this._maxLineLength)
            this._maxLineLength = data.line.length;
        this.lineIDs.push(this._lineID);
        const idx = this.lines.length - 1;

        this._lines.push({ height: 0, top: 0, width: 0, images: 0 });
        t = this.calculateSize(idx);
        this.buildLineExpires(idx);
        this._lines[idx].height = t.height;
        this._lines[idx].width = t.width;
        if (idx - 1 >= 0)
            this._lines[idx].top = this._lines[idx - 1].top + this._lines[idx].height;
        this._lineID++;
        if (this.split) this.split.dirty = true;
        if (!noUpdate)
            this.doUpdate(UpdateType.display);
    }

    public removeLine(line: number) {
        if (line < 0 || line >= this.lines.length) return;
        this.emit('line-removed', line, this.lines[line]);
        this.lines.splice(line, 1);
        this.lineIDs.splice(line, 1);
        this._lines.splice(line, 1);
        this.rawLines.splice(line, 1);
        this.lineFormats.splice(line, 1);
        this._expire2.splice(line, 1);
        if (this._viewCache[line])
            delete this._viewCache[line];
        if (this.split && this.split.viewCache[line])
            delete this.split.viewCache[line];

        if (!this._currentSelection.drag) {
            if (this._currentSelection.start.y === line && this._currentSelection.end.y === line) {
                this._currentSelection.start.y = null;
                this._currentSelection.start.x = null;
                this._currentSelection.end.y = null;
                this._currentSelection.end.x = null;
            }
            else if (this._currentSelection.start.y === line) {
                if (this._currentSelection.start.y > this._currentSelection.end.y) {
                    this._currentSelection.start.y--;
                    if (this._currentSelection.start.y >= 0 && this._currentSelection.start.y < this.lines.length)
                        this._currentSelection.start.x = this.lines[this._currentSelection.start.y].length;
                    else
                        this._currentSelection.start.x = 0;
                }
                else {
                    this._currentSelection.start.y++;
                    this._currentSelection.start.x = 0;
                }
            }
            else if (this._currentSelection.end.y === line) {
                if (this._currentSelection.start.y > this._currentSelection.end.y) {
                    this._currentSelection.end.y++;
                    this._currentSelection.end.x = 0;
                }
                else {
                    this._currentSelection.end.y--;
                    if (this._currentSelection.end.y >= 0 && this._currentSelection.end.y < this.lines.length)
                        this._currentSelection.end.x = this.lines[this._currentSelection.end.y].length;
                    else
                        this._currentSelection.end.x = 0;
                }
            }
        }
        let ol;
        for (ol in this._overlays) {
            if (!this._overlays.hasOwnProperty(ol) || this._overlays[ol].length === 0 || line >= this._overlays[ol].length)
                continue;
            this._overlays[ol].splice(line, 1);
        }

        for (ol in this._expire) {
            if (!this._expire.hasOwnProperty(ol) || this._expire[ol].length === 0 || line >= this._expire[ol].length)
                continue;
            this._expire[ol].splice(line, 1);
        }
        if (this.split) this.split.dirty = true;
        this.updateTops(line);
        this.doUpdate(UpdateType.view | UpdateType.scrollbars | UpdateType.overlays | UpdateType.selection);
    }

    public removeLines(line: number, amt: number) {
        if (line < 0 || line >= this.lines.length) return;
        if (amt < 1) amt = 1;
        this.emit('lines-removed', line, this.lines.slice(line, amt));
        this.lines.splice(line, amt);
        this.lineIDs.splice(line, amt);
        this._lines.splice(line, amt);
        this.rawLines.splice(line, amt);
        this.lineFormats.splice(line, amt);
        this._expire2.splice(line, amt);

        for (let a = 0; a < amt; a++) {
            if (this._viewCache[line + a])
                delete this._viewCache[line + a];
            if (this.split && this.split.viewCache[line + a])
                delete this.split.viewCache[line + a];
        }

        if (!this._currentSelection.drag) {
            for (let l = line; l < line + amt; l++) {
                if (this._currentSelection.start.y >= l && this._currentSelection.end.y >= l) {
                    this._currentSelection.start.y = null;
                    this._currentSelection.start.x = null;
                    this._currentSelection.end.y = null;
                    this._currentSelection.end.x = null;
                    break;
                }
                else if (this._currentSelection.start.y === l) {
                    if (this._currentSelection.start.y > this._currentSelection.end.y) {
                        this._currentSelection.start.y--;
                        if (this._currentSelection.start.y >= 0 && this._currentSelection.start.y < this.lines.length)
                            this._currentSelection.start.x = this.lines[this._currentSelection.start.y].length;
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
                        if (this._currentSelection.end.y >= 0 && this._currentSelection.end.y < this.lines.length)
                            this._currentSelection.end.x = this.lines[this._currentSelection.end.y].length;
                        else
                            this._currentSelection.end.x = 0;
                    }
                }
            }
        }
        let ol;
        for (ol in this._overlays) {
            if (!this._overlays.hasOwnProperty(ol) || this._overlays[ol].length === 0 || line >= this._overlays[ol].length)
                continue;
            this._overlays[ol].splice(line, amt);
        }

        for (ol in this._expire) {
            if (!this._expire.hasOwnProperty(ol) || this._expire[ol].length === 0 || line >= this._expire[ol].length)
                continue;
            this._expire[ol].splice(line, amt);
        }
        if (this.split) this.split.dirty = true;
        this.updateTops(line);
        this.doUpdate(UpdateType.view | UpdateType.scrollbars | UpdateType.overlays | UpdateType.selection);
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

    get html(): string {
        const l = this.lines.length;
        const html = [];
        for (let idx = 0; idx < l; idx++)
            html.push(this.getLineHTML(idx));
        return html.join('');
    }

    get text(): string {
        return this.lines.join('\n');
    }

    get raw(): string {
        return this.rawLines.join('');
    }

    public trimLines() {
        if (this._maxLines === -1)
            return;
        if (this.lines.length > this._maxLines) {
            const amt = this.lines.length - this._maxLines;
            this.lines.splice(0, amt);
            this.lineIDs.splice(0, amt);
            this._lines.splice(0, amt);
            this.rawLines.splice(0, amt);
            this.lineFormats.splice(0, amt);
            this._expire2.splice(0, amt);
            if (this.hasSelection) {
                this._currentSelection.start.y -= amt;
                this._currentSelection.end.y -= amt;

                if (this._currentSelection.start.y < 0 && this._currentSelection.end.y < 0) {
                    this._currentSelection = {
                        start: { x: null, y: null },
                        end: { x: null, y: null },
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

            for (ol in this._expire) {
                if (!this._expire.hasOwnProperty(ol) || this._expire[ol].length === 0)
                    continue;
                this._expire[ol].splice(0, amt);
            }

            let m = 0;
            const lines = this.lines;
            const formats = this.lineFormats;
            const ll = lines.length;
            for (let l = 0; l < ll; l++) {
                if (formats[0].hr) {
                    if (this.WindowWidth > m)
                        m = this.WindowWidth;
                }
                else if (lines[l].length > m)
                    m = lines[l].length;
            }
            this._viewCache = {};
            if (this.split)
                this.split.viewCache = {};
            this._maxLineLength = m;
            if (this.split) this.split.dirty = true;
            this.doUpdate(UpdateType.selection | UpdateType.overlays);
        }
    }

    private getLineOffset(pageX, pageY) {
        if (this.lines.length === 0)
            return { x: 0, y: 0 };
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

        const xPos = (pageX - os.left) + this._HScroll.position;
        let x = Math.trunc(xPos / this._charWidth);
        if (y >= 0) {
            let text;
            if (y < this.lines.length)
                text = this.lines[y].replace(/ /g, '\u00A0');
            else
                text = this.lines[this.lines.length - 1].replace(/ /g, '\u00A0');
            const tl = text.length;
            let w = Math.ceil(this.textWidth(text.substr(0, x)));
            if (w > xPos && xPos > 0) {
                while (w > xPos && x > 0) {
                    x--;
                    w = Math.ceil(this.textWidth(text.substr(0, x)));
                }
                x++;
            }
            else if (w > 0 && w < xPos) {
                while (w < xPos && x < tl) {
                    x++;
                    w = Math.ceil(this.textWidth(text.substr(0, x)));
                }
                if (w > xPos)
                    x--;
            }
            else if (w === 0 && x > 0 && xPos >= 0) {
                while (w <= 0 && x < tl) {
                    x++;
                    w = Math.ceil(this.textWidth(text.substr(0, x)));
                }
            }
        }
        return { x: x, y: y };
    }

    private offset(elt) {
        const rect = elt.getBoundingClientRect();
        const bodyElt = document.body;
        return {
            top: rect.top + bodyElt.scrollTop,
            left: rect.left + bodyElt.scrollLeft
        };
    }

    private textWidth(txt, font?) {
        if (!txt || txt.length === 0) return 0;
        font = font || this._contextFont;
        const canvas = this._canvas || (this._canvas = document.createElement('canvas'));
        const context = this._context || (this._context = canvas.getContext('2d', { alpha: false }));
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

    private lineWidth(line, start?, len?) {
        if (line < 0 || line >= this.lines.length)
            return 0;
        if (start === undefined || start === null)
            return this._lines[line].width;
        if (len === undefined || len === null || len > this.lines[line].length)
            len = this.lines[line].length;
        if (len - start <= 0) return 0;
        if (start === 0 && len >= this.lines[line].length)
            return this._lines[line].width;
        const text = this.lines[line].replace(/ /g, '\u00A0');
        const formats = this.lineFormats[line];
        const fLen = formats.length;
        const tl = text.length;
        let f = 0;
        let end;
        let font;
        let offset;
        let width = 0;
        for (; f < fLen; f++) {
            //no width so ignore these blocks
            if (!formats[f].width || formats[f].formatType === FormatType.WordBreak || formats[f].formatType === FormatType.LinkEnd || formats[f].formatType === FormatType.MXPLinkEnd || formats[f].formatType === FormatType.MXPSendEnd)
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
                width += this.textWidth(text.substring(start, end), font);
            else
                width += text.substring(start, end).length * this._charWidth;
            //len is in block so quit
            if (len <= end)
                break;
        }
        return width;
    }

    private calculateSize(idx) {
        if (idx === undefined)
            idx = this.lines.length - 1;
        const text = this.lines[idx].replace(/ /g, '\u00A0');
        const formats = this.lineFormats[idx];
        let offset = 0;
        let height = 0;
        const len = formats.length;
        const cw = this._charWidth;
        const id = this.lineIDs[idx];
        let width = 0;
        let font: any = 0;
        for (let f = 0; f < len; f++) {
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
            if (format.formatType === FormatType.Normal) {
                eText = text.substring(offset, end);
                font = 0;
                /*
                if (format.font || format.size) {
                    height = (Math.max(height, format.height = format.height || this.textHeight(eText, format.font, format.size)));
                    format.width = format.width || this.textWidth(eText, font = `${format.size || this._character.style.fontSize} ${format.font || this._character.style.fontFamily}`);
                }
                else */
                if (format.unicode)
                    format.width = format.width || this.textWidth(eText);
                else
                    format.width = format.width || eText.length * cw;
            }
            else if (format.formatType === FormatType.Link && end - offset !== 0) {
                eText = text.substring(offset, end);
                if (format.unicode || font)
                    format.width = format.width || this.textWidth(eText, font);
                else
                    format.width = format.width || eText.length * cw;
            }
            else if (format.formatType === FormatType.MXPLink && end - offset !== 0) {
                eText = text.substring(offset, end);
                if (format.unicode || font)
                    format.width = format.width || this.textWidth(eText, font);
                else
                    format.width = format.width || eText.length * cw;
            }
            else if (format.formatType === FormatType.MXPSend && end - offset !== 0) {
                eText = text.substring(offset, end);
                if (format.unicode || font)
                    format.width = format.width || this.textWidth(eText, font);
                else
                    format.width = format.width || eText.length * cw;
            }
            else if (format.formatType === FormatType.MXPExpired && end - offset !== 0) {
                eText = text.substring(offset, end);
                if (format.unicode || font)
                    format.width = format.width || this.textWidth(eText, font);
                else
                    format.width = format.width || eText.length * cw;
            }
            else if (format.formatType === FormatType.Image) {
                width += format.marginWidth || 0;
                if (!format.width) {
                    this._lines[idx].images++;
                    const img = new Image();
                    eText = '';
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
                    img.src = eText;
                    img.dataset.id = '' + id;
                    img.dataset.f = '' + f;
                    Object.assign(img.style, {
                        position: 'absolute',
                        top: (this._innerWidth + 100) + 'px'
                    });
                    this._el.appendChild(img);
                    img.onload = () => {
                        const lIdx = this.lineIDs.indexOf(+img.dataset.id);
                        this._lines[lIdx].images--;
                        if (lIdx === -1 || lIdx >= this.lines.length) return;
                        const fIdx = +img.dataset.f;
                        const fmt = this.lineFormats[lIdx][fIdx];
                        if (fmt.w.length > 0 && fmt.h.length > 0) {
                            Object.assign(img.style, {
                                width: formatUnit(fmt.w),
                                height: formatUnit(fmt.h, this._charHeight)
                            });
                        }
                        else if (fmt.w.length > 0)
                            img.style.width = formatUnit(fmt.w);
                        else if (fmt.h.length > 0)
                            img.style.height = formatUnit(fmt.h, this._charHeight);
                        const bounds = img.getBoundingClientRect();
                        fmt.width = bounds.width || img.width;
                        fmt.height = bounds.height || img.height;
                        if (format.hspace.length > 0 || format.vspace.length > 0) {
                            const styles = getComputedStyle(img);
                            fmt.marginHeight = parseFloat(styles.marginTop) + parseFloat(styles.marginBottom);
                            fmt.marginWidth = parseFloat(styles.marginLeft) + parseFloat(styles.marginRight);
                        }
                        else {
                            fmt.marginHeight = 0;
                            fmt.marginWidth = 0;
                        }
                        this._el.removeChild(img);
                        if (this._viewCache[lIdx])
                            delete this._viewCache[lIdx];
                        if (this._lines[lIdx].images !== 0) return;
                        const t = this.calculateSize(lIdx);
                        this._lines[lIdx].width = t.width;
                        this._lines[lIdx].height = t.height;
                        this.updateTops(lIdx);
                        if (lIdx >= this._viewRange.start && lIdx <= this._viewRange.end && this._viewRange.end !== 0 && !this._parser.busy) {
                            if (this.split) this.split.dirty = true;
                            this.doUpdate(UpdateType.display);
                        }
                    };
                }
                if (format.marginHeight)
                    height = Math.max(height, format.height + format.marginHeight);
                else
                    height = Math.max(height, format.height || 0);
            }
            width += format.width || 0;
        }
        return { width: width, height: this._charHeight };
    }

    private buildLineExpires(idx) {
        if (idx === undefined)
            idx = this.lines.length - 1;
        const formats = this.lineFormats[idx];
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

    public clearOverlay(type?: string) {
        if (!type)
            type = 'default';
        if (!this._overlays[type] || this._overlays[type].length === 0) return;
        this._overlays[type] = [];
        if (this.split) this.split.dirty = true;
        this.doUpdate(UpdateType.overlays);
    }

    //TODO add font support, as different blocks of text could have different font formats, need to not just measure with but measure based on format block data
    public addOverlays(ranges: OverlayRange[], cls?: string, type?: string) {
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
        if (!cls || cls.length === 0)
            cls = 'overlay-default';
        this._overlays[type] = [];
        const fl = Math.trunc;
        const mw = Math.max(this._maxLineLength * this._charWidth, this._maxView);
        const len = this.lines.length;
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
                continue;
            }
            else {
                sL = range.start.y;
                //invalid view
                if (sL < 0 || sL >= this.lines.length)
                    continue;

                if (this.lineFormats[sL][0].hr) {
                    s = 0;
                    e = mw;
                }
                else {
                    s = Math.min(range.start.x, range.end.x);
                    e = Math.max(range.start.x, range.end.x);
                    if (s < 0) s = 0;
                    if (e > this.lines[sL].length)
                        e = this.lines[sL].length;
                    e = this.textWidth(this.lines[sL].substring(s, e).replace(/ /g, '\u00A0'));
                    s = this.textWidth(this.lines[sL].substring(0, s).replace(/ /g, '\u00A0'));
                }
                if (!this._overlays[type][sL])
                    this._overlays[type][sL] = [];
                if (this._roundedRanges)
                    this._overlays[type][sL].push(`<span id="${type}-${r}" class="${cls} trc tlc brc blc" style="left: ${s}px;width: ${e}px"></span>`);
                else
                    this._overlays[type][sL].push(`<span id="${type}-${r}" class="${cls}" style="left: ${s}px;width: ${e}px"></span>`);
                continue;
            }

            if (sL < 0)
                sL = 0;
            if (eL >= len)
                eL = len - 1;
            if (s < 0)
                s = 0;
            if (e > this.lines[eL].length)
                e = this.lines[eL].length;
            for (let line = sL; line < eL + 1; line++) {
                const startStyle = {
                    top: CornerType.Extern,
                    bottom: CornerType.Extern
                };
                const endStyle = {
                    top: CornerType.Extern,
                    bottom: CornerType.Extern
                };
                let rCls = cls;
                let cl = 0;
                const tLine = this.lines[line].replace(/ /g, '\u00A0');
                if (sL === line) {
                    if (s >= tLine.length)
                        cl = tLine.length;
                    else
                        cl = s;
                }
                if (this.lineFormats[line][0].hr)
                    w = mw;
                else if (sL === line)
                    w = this.textWidth(this.lines[sL].substr(s)) + this._charWidth;
                else if (eL === line)
                    w = this.textWidth(tLine.substring(0, e));
                else
                    w = this._lines[line].width + this._charWidth;
                cl = this.textWidth(tLine.substring(0, cl));
                if (this._roundedRanges) {
                    let cr;
                    if (this.lineFormats[line][0].hr)
                        cr = mw;
                    else
                        cr = fl(eL === line ? this.textWidth(tLine.substring(0, e)) : (this._lines[line].width + this._charWidth));
                    if (line > sL) {
                        let pl = 0;
                        if (sL === line - 1) {
                            if (this.lineFormats[line - 1][0].hr)
                                pl = 0;
                            else if (fl(this.textWidth(this.lines[sL].substr(0, s).replace(/ /g, '\u00A0'))) >= fl(this._lines[line - 1].width + this._charWidth))
                                pl = fl(this._lines[line - 1].width) + this._charWidth;
                            else
                                pl = fl(this.textWidth(this.lines[sL].substring(0, s).replace(/ /g, '\u00A0')));
                        }
                        const pr = this.lineFormats[line - 1][0].hr ? mw : fl(this._lines[line - 1].width + this._charWidth);

                        if (fl(cl) === pl)
                            startStyle.top = CornerType.Flat;
                        else if (fl(cl) > pl)
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
                        if (this.lineFormats[line + 1][0].hr)
                            nr = mw;
                        else
                            nr = fl(eL === line + 1 ? this.textWidth(this.lines[line + 1].substring(0, e).replace(/ /g, '\u00A0')) : (this._lines[line + 1].width + this._charWidth));
                        if (fl(cl) === 0)
                            startStyle.bottom = CornerType.Flat;
                        else if (0 < fl(cl) && fl(cl) < nr)
                            startStyle.bottom = CornerType.Intern;

                        if (cr === nr)
                            endStyle.bottom = CornerType.Flat;
                        else if (cr < nr)
                            endStyle.bottom = CornerType.Intern;
                    }

                    if (startStyle.top === CornerType.Extern) {
                        rCls += ' tlc';
                    }
                    if (startStyle.bottom === CornerType.Extern) {
                        rCls += ' blc';
                    }
                    if (endStyle.top === CornerType.Extern) {
                        rCls += ' trc';
                    }
                    if (endStyle.bottom === CornerType.Extern) {
                        rCls += ' brc';
                    }
                }

                if (!this._overlays[type][line])
                    this._overlays[type][line] = [];
                this._overlays[type][line].push(`<span id="${type}-${r}" class="${rCls}" style="left:${cl * this._charWidth}px;width: ${w}px;"></span>`);
                if (startStyle.top === CornerType.Intern || startStyle.bottom === CornerType.Intern)
                    this._overlays[type][line].push(`<span class="${cls} isb" style="top:${this._charHeight - 7}px;left:${(cl * this._charWidth - 7)}px;"></span>`);
                if (endStyle.top === CornerType.Intern)
                    this._overlays[type][line].push(`<span class="${cls} iet" style="top:0px;left:${(cl * this._charWidth) + w}px;"></span>`);
                if (endStyle.bottom === CornerType.Intern)
                    this._overlays[type][line].push(`<span class="${cls} ieb" style="top:${this._charHeight - 7}px;left:${(cl * this._charWidth) + w}px;"></span>`);
            }
        }
        let ol;
        for (ol in this._overlays[type]) {
            if (!this._overlays[type].hasOwnProperty(ol))
                continue;
            this._overlays[type][ol] = `<div style="top: ${(+ol || 0) * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line">${this._overlays[type][ol].join('')}</div>`;
            if (this.split && ol >= this.split._viewRange.start) {
                this.split.dirty = true;
                this.doUpdate(UpdateType.scrollViewOverlays);
            }
        }
        this.doUpdate(UpdateType.overlays);
    }

    //TODO add font support, as different blocks of text could have different font formats, need to not just measure with but measure based on format block data
    private updateSelection() {
        const sel = this._currentSelection;
        let s;
        let e;
        let sL;
        let eL;
        let parts;
        let w;
        let text;
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
        else if (sel.start.x === sel.end.x) {
            if (this.split && (sel.start.y >= this.split._viewRange.start || this._prevSelection.start.y >= this.split._viewRange.start)) {
                this.split.dirty = true;
                this.doUpdate(UpdateType.scrollViewOverlays);
            }
            this.doUpdate(UpdateType.overlays);
            this._prevSelection = {
                start: { x: sel.end.x, y: sel.end.y },
                end: { x: sel.end.x, y: sel.end.y }
            };
            return;
        }
        else {
            sL = sel.start.y;
            if (sL < 0 || sL >= this.lines.length) {
                this._prevSelection = {
                    start: { x: sel.end.x, y: sel.end.y },
                    end: { x: sel.end.x, y: sel.end.y }
                };
                return;
            }
            /*
                        w = e;
                        while (w >= s) {
                            if (!CONTAINS_RTL.test(text[w])) {
                                break;
                            }
                            w--;
                        }
                        if (w !== e) {
                            eL = e;
                            e = this.textWidth(text.substring(s, w));
                            s = this.textWidth(text.substring(0, s));
                            parts = [`<span class="select-text" style="left: ${s}px;width: ${e}px"></span>`];
                            w = this.textWidth(text.substring(w, eL));
                            s += e - w;
                            parts.push(`<span class="select-text" style="left: ${s}px;width: ${w}px"></span>`);
                        }
                        else {
                            e = this.textWidth(text.substring(s, e));
                            s = this.textWidth(text.substring(0, s));
                            if (this._roundedRanges)
                                parts = [`<span class="select-text trc tlc brc blc" style="left: ${s}px;width: ${e}px"></span>`];
                            else
                                parts = [`<span class="select-text" style="left: ${s}px;width: ${e}px"></span>`];
                        }
                        this._overlays.selection[sL] = `<div style="top: ${sL * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line">${parts.join('')}</div>`;
            */
            /*
             w = this.textWidth(text.substring(0, s));
             parts = [];
             while (s <= e) {
                 eL = this.textWidth(text.substr(s, 1));
                 if (CONTAINS_RTL.test(text[s]))
                     parts.push(`<span class="select-text" style="background-color:red !important;left: ${w}px;width: ${eL}px"></span>`);
                 else
                     parts.push(`<span class="select-text" style="left: ${w}px;width: ${eL}px"></span>`);
                 s++;
                 w += eL;
             }
             this._overlays.selection[sL] = `<div style="top: ${sL * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line">${parts.join('')}</div>`;
 */
            if (this.lineFormats[sL][0].hr) {
                s = 0;
                e = Math.max(this._maxLineLength * this._charWidth, this._maxView);
            }
            else {
                s = Math.min(sel.start.x, sel.end.x);
                e = Math.max(sel.start.x, sel.end.x);
                text = this.lines[sL];
                if (s < 0) s = 0;
                if (e > text.length)
                    e = text.length;
                e = this.textWidth(text.substring(s, e).replace(/ /g, '\u00A0'));
                s = this.textWidth(text.substring(0, s).replace(/ /g, '\u00A0'));
            }
            if (this._roundedRanges)
                this._overlays.selection[sL] = `<div style="top: ${sL * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line"><span class="select-text trc tlc brc blc" style="left: ${s}px;width: ${e}px"></span></div>`;
            else
                this._overlays.selection[sL] = `<div style="top: ${sL * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line"><span class="select-text" style="left: ${s}px;width: ${e}px"></span></div>`;

            /*
                        const ranges = [];
                        let range = { start: s, end: s, direction: CONTAINS_RTL.test(text[w]) ? 1 : 0 };
                        ranges.push(range);
                        let state = range.direction;
                        w = s + 1;
                        while (w <= e) {
                            if (state === 0 && CONTAINS_RTL.test(text[w])) {
                                range.end++;
                                range = { start: w, end: w, direction: 1 };
                                ranges.push(range);
                                state = 1;
                            }
                            else if (state === 1 && CONTAINS_LTR.test(text[w])) {
                                range.end++;
                                range = { start: w, end: w, direction: 0 };
                                ranges.push(range);
                                state = 0;
                            }
                            range.end = w;
                            w++;
                        }
                        console.log(ranges);
                        s = this.textWidth(text.substring(0, s));
                        eL = ranges.length;
                        parts = [];
                        for (w = 0; w < eL; w++) {
                            e = this.textWidth(text.substring(ranges[w].start, ranges[w].end));
                            if (ranges[w].direction)
                                parts.push(`<span class="select-text" style="background-color:red; left: ${s}px;width: ${e}px"></span>`);
                            else
                                parts.push(`<span class="select-text" style="left: ${s}px;width: ${e}px"></span>`);
                            s += e;
                        }
                        this._overlays.selection[sL] = `<div style="top: ${sL * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line">${parts.join('')}</div>`;
            */
            if (this.split && (sL >= this.split._viewRange.start || this._prevSelection.start.y >= this.split._viewRange.start)) {
                this.split.dirty = true;
                this.doUpdate(UpdateType.scrollViewOverlays);
            }
            this.doUpdate(UpdateType.overlays);
            this._prevSelection = {
                start: { x: sel.end.x, y: sel.end.y },
                end: { x: sel.end.x, y: sel.end.y }
            };
            return;
        }
        const len = this.lines.length;
        const mw = Math.max(this._maxLineLength * this._charWidth, this._maxView);

        if (sL < 0)
            sL = 0;
        if (eL >= len) {
            eL = len - 1;
            e = this.lines[eL].length;
        }
        if (s < 0)
            s = 0;
        if (e > this.lines[eL].length)
            e = this.lines[eL].length;
        const fl = Math.trunc;
        for (let line = sL; line < eL + 1; line++) {
            const startStyle = {
                top: CornerType.Extern,
                bottom: CornerType.Extern
            };
            const endStyle = {
                top: CornerType.Extern,
                bottom: CornerType.Extern
            };
            parts = [];
            let cls = 'select-text';
            let cl = 0;
            const tLine = this.lines[line].replace(/ /g, '\u00A0');
            if (sL === line) {
                if (s >= tLine.length)
                    cl = tLine.length;
                else
                    cl = s;
            }
            if (this.lineFormats[line][0].hr)
                w = mw;
            else if (sL === line)
                w = this.textWidth(this.lines[sL].substr(s).replace(/ /g, '\u00A0')) + this._charWidth;
            else if (eL === line)
                w = this.textWidth(tLine.substring(0, e));
            else
                w = this._lines[line].width + this._charWidth;
            cl = this.textWidth(tLine.substring(0, cl));

            if (this._roundedRanges) {
                let cr;
                if (this.lineFormats[line][0].hr)
                    cr = mw;
                else
                    cr = fl(eL === line ? this.textWidth(tLine.substring(0, e)) : (this._lines[line].width + this._charWidth));
                if (line > sL) {
                    let pl = 0;
                    if (sL === line - 1) {
                        if (this.lineFormats[line - 1][0].hr)
                            pl = 0;
                        else if (fl(this.textWidth(this.lines[sL].substr(0, s).replace(/ /g, '\u00A0'))) >= fl(this._lines[line - 1].width + this._charWidth))
                            pl = fl(this._lines[line - 1].width) + this._charWidth;
                        else
                            pl = fl(this.textWidth(this.lines[sL].substring(0, s).replace(/ /g, '\u00A0')));
                    }
                    const pr = this.lineFormats[line - 1][0].hr ? mw : fl(this._lines[line - 1].width + this._charWidth);

                    if (fl(cl) === pl)
                        startStyle.top = CornerType.Flat;
                    else if (fl(cl) > pl)
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
                    if (this.lineFormats[line + 1][0].hr)
                        nr = mw;
                    else
                        nr = fl(eL === line + 1 ? this.textWidth(this.lines[line + 1].substring(0, e).replace(/ /g, '\u00A0')) : (this._lines[line + 1].width + this._charWidth));
                    if (fl(cl) === 0)
                        startStyle.bottom = CornerType.Flat;
                    else if (0 < fl(cl) && fl(cl) < nr)
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

            parts.push(`<span class="${cls}" style="left:${cl}px;width: ${w}px;"></span>`);

            if (startStyle.top === CornerType.Intern || startStyle.bottom === CornerType.Intern)
                parts.push(`<span class="select-text isb" style="top:${this._charHeight - 7}px;left:${(cl - 7)}px;"></span>`);
            if (endStyle.top === CornerType.Intern)
                parts.push(`<span class="select-text iet" style="top:0px;left:${(cl) + w}px;"></span>`);
            if (endStyle.bottom === CornerType.Intern)
                parts.push(`<span class="select-text ieb" style="top:${this._charHeight - 7}px;left:${(cl) + w}px;"></span>`);

            this._overlays.selection[line] = `<div style="top: ${line * this._charHeight}px;height:${this._charHeight}px;" class="overlay-line">${parts.join('')}</div>`;
        }
        if (this.split && (sL >= this.split._viewRange.start || eL >= this.split._viewRange.start || this._prevSelection.start.y >= this.split._viewRange.start || this._prevSelection.end.y >= this.split._viewRange.start)) {
            this.split.dirty = true;
            this.doUpdate(UpdateType.scrollViewOverlays);
        }
        this.doUpdate(UpdateType.overlays);
        this._prevSelection = {
            start: { x: sel.end.x, y: sel.end.y },
            end: { x: sel.end.x, y: sel.end.y }
        };
    }

    get hasSelection(): boolean {
        const sel = this._currentSelection;
        if (sel.start.x === sel.end.x && sel.start.y === sel.end.y)
            return false;
        return true;
    }

    get selection(): string {
        if (this.lines.length === 0) return '';
        const sel = this._currentSelection;
        let s;
        let e;
        let sL;
        let eL;
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
        else if (sel.start.x === sel.end.x) {
            return '';
        }
        else if (sel.start.y > 0 && sel.start.y < this.lineFormats.length && this.lineFormats[sel.start.y][0].hr)
            return '---';
        else {
            s = Math.min(sel.start.x, sel.end.x);
            e = Math.max(sel.start.x, sel.end.x);
            return this.lines[sel.start.y].substring(s, e);
        }
        const len = this.lines.length;

        if (sL < 0)
            sL = 0;
        if (eL >= len) {
            eL = len - 1;
            e = this.lines[eL].length;
        }
        if (s < 0)
            s = 0;
        if (e > this.lines[eL].length)
            e = this.lines[eL].length;

        const txt = [];
        if (this.lineFormats[sL][0].hr)
            txt.push('---');
        else
            txt.push(this.lines[sL].substring(s));
        sL++;
        while (sL < eL) {
            if (this.lineFormats[sL][0].hr)
                txt.push('---');
            else
                txt.push(this.lines[sL]);
            sL++;
        }
        if (this.lineFormats[eL][0].hr)
            txt.push('---');
        else
            txt.push(this.lines[eL].substring(0, e));
        return txt.join('\n');
    }

    get selectionAsHTML(): string {
        if (this.lines.length === 0) return '';
        const sel = this._currentSelection;
        let s;
        let e;
        let sL;
        let eL;
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
        else if (sel.start.x === sel.end.x) {
            return '';
        }
        else {
            s = Math.min(sel.start.x, sel.end.x);
            e = Math.max(sel.start.x, sel.end.x);
            return this.getLineHTML(sel.start.y, s, e);
        }
        const len = this.lines.length;

        if (sL < 0)
            sL = 0;
        if (eL >= len) {
            eL = len - 1;
            e = this.lines[eL].length;
        }
        if (s < 0)
            s = 0;
        if (e > this.lines[eL].length)
            e = this.lines[eL].length;

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
        let ll = this.lines.length;
        if (ll === 0) return;
        ll--;
        this._prevSelection = {
            start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y },
            end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y }
        };
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
        this._prevSelection = {
            start: { x: this._currentSelection.end.x, y: this._currentSelection.end.y },
            end: { x: this._currentSelection.end.x, y: this._currentSelection.end.y }
        };
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
        if (this.split) this.split.dirty = true;
        this._os = this.offset(this._el);
        this._maxView = this._el.clientWidth - this._padding[1] - this._padding[3] - this._VScroll.size;
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
        let styles = `.background > span, .view > span, .line, .background-line { height: ${this._charHeight}px; }`;
        if (!this._enableColors)
            styles += '.view > span span {color: inherit !important;}';
        if (!this._enableColors || !this._enableBackgroundColors)
            styles += '.background > span span {background-color: inherit !important;}';
        this._styles.innerHTML = styles;
    }

    private buildLineDisplay(idx?: number, mw?, mv?) {
        if (idx === undefined)
            idx = this.lines.length - 1;
        const back = [];
        const fore = [];
        const text = this.lines[idx].replace(/ /g, '\u00A0');
        const formats = this.lineFormats[idx];
        let offset = 0;
        let bStyle: any = '';
        let fStyle: any = '';
        let fCls: any = '';
        const ch = this._charHeight;
        const len = formats.length;
        let left = 0;
        const id = this.lineIDs[idx];
        let right = false;

        for (let f = 0; f < len; f++) {
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
                        bStyle.push('background:', this._parser.GetColor(format.background), ';');
                    else if (format.background)
                        bStyle.push('background:', format.background, ';');
                    if (typeof format.color === 'number')
                        fStyle.push('color:', this._parser.GetColor(format.color), ';');
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
                    format.bStyle = bStyle = bStyle.join('').trim();
                    format.fStyle = fStyle = fStyle.join('').trim();
                    if (fCls.length !== 0)
                        format.fCls = fCls = ' class="' + fCls.join('').trim() + '"';
                    else
                        format.fCls = fCls = '';
                }
                if (format.hr) {
                    back.push('<span style="left:0;width:', mw, 'px;', bStyle, '"></span>');
                    fore.push('<span style="left:0;width:', mw, 'px;', fStyle, '"', fCls, '><div class="hr" style="background-color:', (typeof format.color === 'number' ? this._parser.GetColor(format.color) : format.color), '"></div></span>');
                }
                else if (end - offset !== 0) {
                    back.push('<span style="left:', left, 'px;width:', format.width, 'px;', bStyle, '"></span>');
                    fore.push('<span style="left:', left, 'px;width:', format.width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                    left += format.width;
                }
            }
            else if (format.formatType === FormatType.Link) {
                fore.push('<a draggable="false" class="URLLink" href="javascript:void(0);" title="', format.href.replace(/"/g, '&quot;'), '" onclick="', this.linkFunction, '(\'', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), '\');return false;">');
                if (end - offset === 0) continue;
                eText = text.substring(offset, end);
                back.push('<span style="left:', left, 'px;width:', format.width, 'px;', bStyle, '"></span>');
                fore.push('<span style="left:', left, 'px;width:', format.width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                left += format.width;
            }
            else if (format.formatType === FormatType.LinkEnd || format.formatType === FormatType.MXPLinkEnd || format.formatType === FormatType.MXPSendEnd) {
                fore.push('</a>');
            }
            else if (format.formatType === FormatType.WordBreak)
                fore.push('<wbr>');
            else if (format.formatType === FormatType.MXPLink) {
                fore.push('<a draggable="false" data-id="', id, '" class="MXPLink" data-href="', format.href, '" href="javascript:void(0);" title="', format.hint.replace(/"/g, '&quot;'), '" onclick="', this.mxpLinkFunction, '(this, \'', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), '\');return false;">');
                if (end - offset === 0) continue;
                eText = text.substring(offset, end);
                back.push('<span style="left:', left, 'px;width:', format.width, 'px;', bStyle, '"></span>');
                fore.push('<span style="left:', left, 'px;width:', format.width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                left += format.width;
            }
            else if (format.formatType === FormatType.MXPSend) {
                fore.push('<a draggable="false" data-id="', id, '" class="MXPLink" href="javascript:void(0);" title="', format.hint.replace(/"/g, '&quot;'), '" onmouseover="', this.mxpTooltipFunction, '(this);"', ' onclick="', this.mxpSendFunction, '(event||window.event, this, ', format.href.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), ', ', format.prompt ? 1 : 0, ', ', format.tt.replace(/\\/g, '\\\\').replace(/"/g, '&quot;'), ');return false;">');
                if (end - offset === 0) continue;
                eText = text.substring(offset, end);
                back.push('<span style="left:', left, 'px;width:', format.width, 'px;', bStyle, '" ></span>');
                fore.push('<span style="left:', left, 'px;width:', format.width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                left += format.width;
            }
            else if (format.formatType === FormatType.MXPExpired && end - offset !== 0) {
                eText = text.substring(offset, end);
                back.push('<span style="left:', left, 'px;width:', format.width, 'px;', bStyle, '"></span>');
                fore.push('<span style="left:', left, 'px;width:', format.width, 'px;', fStyle, '"', fCls, '>', htmlEncode(eText), '</span>');
                left += format.width;
            }
            else if (format.formatType === FormatType.Image) {
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
                if (format.width)
                    tmp.push('width:', format.width, 'px;');
                else if (format.w.length > 0)
                    tmp.push('width:', formatUnit(format.w), ';');

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
                    tmp.push('margin:', formatUnit(format.vspace), ' ', formatUnit(format.hspace, ch), ';');
                else if (format.hspace.length > 0)
                    tmp.push('margin: 0px ', formatUnit(format.hspace, ch), ';');
                else if (format.vspace.length > 0)
                    tmp.push('margin:', formatUnit(format.vspace), ' 0px;');
                //TODO remove max-height when variable height supported
                tmp.push('max-height:', '' + ch, 'px;"');
                back.push(tmp.join(''), ` src="./../assets/blank.png"/>`);
                if (format.ismap) tmp.push(' ismap onclick="return false;"');
                fore.push(tmp.join(''), ` src="${eText}"/>`);
            }
        }
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
            len = this.lines[idx].length;
        const parts = [];
        let offset = 0;
        let style: any = '';
        let fCls: any = '';
        const text = this.lines[idx].replace(/ /g, '\u00A0');
        const formats = this.lineFormats[idx];
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
                    style.push('background:', this._parser.GetColor(format.background), ';');
                else if (format.background)
                    style.push('background:', format.background, ';');
                if (typeof format.color === 'number')
                    style.push('color:', this._parser.GetColor(format.color), ';');
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
                        style.push('border-bottom: 1px solid ', (typeof format.color === 'number' ? this._parser.GetColor(format.color) : format.color), ';');
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
                    parts.push('<span style="', style, 'min-width:100%;width:100%;"', fCls, '><div style="position:relative;top: 50%;transform: translateY(-50%);height:4px;width:100%; background-color:', (typeof format.color === 'number' ? this._parser.GetColor(format.color) : format.color), '"></div></span>');
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
            else if (format.formatType === FormatType.WordBreak) {
                if (offset < start || end < start)
                    continue;
                parts.push('<wbr>');
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
                    parts.push('width:', formatUnit(format.w), ';');
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
                    parts.push(formatUnit(format.vspace), ' ');
                    parts.push(formatUnit(format.hspace, this._charHeight), ';');
                }
                else if (format.hspace.length > 0) {
                    parts.push('margin:');
                    parts.push('0px ', formatUnit(format.hspace, this._charHeight), ';');
                }
                else if (format.vspace.length > 0) {
                    parts.push('margin:');
                    parts.push(formatUnit(format.vspace), ' 0px;');
                }
                parts.push('"');
                if (format.ismap) parts.push(' ismap onclick="return false;"');
                parts.push(`src="${tmp}"/>`);
            }
        }
        if (right && len < this.lines[idx].length)
            return `<span class="line" style="min-width:100%">${parts.join('')}</span>`;
        if (right)
            return `<span class="line" style="min-width:100%">${parts.join('')}<br></span>`;
        if (len < this.lines[idx].length)
            return `<span class="line">${parts.join('')}</span>`;
        return `<span class="line">${parts.join('')}<br></span>`;
    }

    public rebuildLines() {
        /*
        let t;
        const ll = this.lines.length;
        for (let l = 0; l < ll; l++) {
            t = this.buildLineDisplay(l);
            this._viewLines[l] = t[0];
            this._backgroundLines[l] = t[1];
        }
        */
        if (this.split) this.split.dirty = true;
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
        if (this._parser.busy)
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
                this._scrollCorner.innerHTML = '<i class="fa fa-minus"></i>';
                this._scrollCorner.addEventListener('click', () => {
                    this.scrollLock = !this.scrollLock;
                    this.scrollDisplay(true);
                });
            }
            else
                this._scrollCorner.className = 'scroll-corner';
            this._el.appendChild(this._scrollCorner);
        }
        if (this.split) {
            this.split.dirty = true;
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
            fl = this.lineFormats[idx].length;
            f = formats[fs];
            format = this.lineFormats[idx][f];
            type = format.formatType;
            if (format.formatType === FormatType.MXPLink)
                eType = FormatType.MXPLinkEnd;
            else
                eType = FormatType.MXPSendEnd;
            format.formatType = FormatType.MXPExpired;
            f++;
            for (; f < fl; f++) {
                if (this.lineFormats[idx][f] === eType) {
                    if (n === 0) {
                        format.formatType = FormatType.MXPSkip;
                        break;
                    }
                    else
                        n--;
                }
                else if (this.lineFormats[idx][f] === type)
                    n++;
            }
        }
        if (this.split && idx >= this.split._viewRange.start && idx <= this.split._viewRange.end && this.split._viewRange.end !== 0 && !this._parser.busy) {
            this.split.dirty = true;
            this.doUpdate(UpdateType.display);
        }
        if (idx >= this._viewRange.start && idx <= this._viewRange.end && this._viewRange.end !== 0 && !this._parser.busy) {
            if (this.split) this.split.dirty = true;
            this.doUpdate(UpdateType.display);
        }
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
    get position(): number { return this._position - (this._type === ScrollType.horizontal ? this._padding[3] : this._padding[0]); }

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
    constructor(parent?: HTMLElement, content?: HTMLElement, type?: ScrollType) {
        super();
        this.setParent(parent, content);
        this.type = type || ScrollType.vertical;
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
        });
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
        this.updatePosition(0);
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
        this._thumbSize = Math.ceil(1 / this._percentView * this.trackSize);
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
        amount = this.position + (amount < 0 ? Math.floor(amount) : Math.ceil(amount));
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
            this.scrollSize = this._contentSize - this._parentSize - this._padding[1] - this._padding[3];
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
            this.scrollSize = this._contentSize - this._parentSize - this._padding[0] - this._padding[2];
        }
        if (bar || !this.trackOffsetSize.width)
            this.trackOffsetSize = { height: this.track.offsetHeight, width: this.track.offsetWidth };
        this._percentView = this._contentSize / this._parentSize;
        this.maxPosition = this._parentSize - Math.ceil(1 / this._percentView * this._parentSize);
        if (this.maxPosition < 0)
            this.maxPosition = 0;
        this.update();
        if (bottom)
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
    private updatePosition(p) {
        if (p < 0 || this._maxDrag < 0)
            p = 0;
        else if (p > this._maxDrag)
            p = this._maxDrag;

        this.thumb.style[this._type === ScrollType.horizontal ? 'left' : 'top'] = p + 'px';
        this.state.dragPosition = p;
        this._position = p * this._ratio;
        if (this._position < 0)
            this._position = 0;
        this.update();
        this.emit('scroll', this.position);
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
