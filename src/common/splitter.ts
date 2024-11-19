//spellchecker:ignore
import { EventEmitter } from 'events';

export interface SplitterOptions {
    container?: any;
    orientation?: Orientation;
    parent?: any;
    id?: string;
    panel1?: HTMLElement;
    panel2?: HTMLElement;
    anchor?: PanelAnchor;
}

export enum Orientation {
    horizontal, vertical
}

export enum PanelAnchor {
    panel1 = 1, panel2 = 2
}

/**
 * Splitter display control
 *
 * @export
 * @class Splitter
 * @extends {EventEmitter}
 */
export class Splitter extends EventEmitter {
    private $el: HTMLElement;
    private $parent: HTMLElement;
    private $panel1: HTMLElement;
    private $panel2: HTMLElement;
    private $orientation: Orientation;
    private $panel1MinSize = 200;
    private $panel2MinSize = 200;
    private $splitterWidth = 4;
    private $dragBar: HTMLElement;
    private $ghostBar: HTMLElement;
    private $splitterDistance = 204;
    private $dragging = false;
    private $id;
    private $collapsed = 0;
    private $resizeObserver;
    private $resizeObserverCache;
    private $observer: MutationObserver;
    private $anchor: PanelAnchor;

    public live = true;

    private $elBounds;

    public hide() {
        this.$el.style.display = 'none';
    }

    public show() {
        this.$el.style.display = '';
    }

    constructor(options?: SplitterOptions) {
        super();
        if (options && options.id)
            this.$id = options.id;
        if (options) {
            this.$panel1 = options.panel1;
            this.$panel2 = options.panel2;
        }
        if (options && options.container)
            this.parent = options.container.container ? options.container.container : options.container;
        else if (options && options.parent)
            this.parent = options.parent;
        else
            this.parent = document.body;
        if (options) {
            if ('anchor' in options)
                this.$anchor = options.anchor;
            else
                this.$anchor = PanelAnchor.panel2;
            this.orientation = options.orientation || Orientation.horizontal;
        }
        else {
            this.$anchor = PanelAnchor.panel2;
            this.orientation = Orientation.horizontal;
        }
    }

    get splitterWidth() { return this.$splitterWidth; }
    set splitterWidth(value) {
        if (this.$splitterWidth === value) return;
        this.$splitterWidth = value;
        this._updatePanels();
    }

    get id() { return this.$id || this.parent.id; }
    set id(value) {
        if (value === this.$id) return;
        this.$id = value;
        this.$el.id = this.id + '-splitter';
        this.$panel1.id = this.id + '-splitter-panel1';
        this.$panel2.id = this.id + '-splitter-panel2';
        this.$dragBar.id = this.id + '-splitter-drag-bar';
        if (this.$ghostBar)
            this.$ghostBar.id = this.id + '-splitter-ghost-bar';
    }

    set parent(parent) {
        if (typeof parent === 'string') {
            if ((<string>parent).startsWith('#'))
                this.$parent = document.getElementById((<string>parent).substr(1));
            else
                this.$parent = document.getElementById(parent);
        }
        else if (parent instanceof $)
            this.$parent = parent[0];
        else if (parent instanceof HTMLElement)
            this.$parent = parent;
        if (!this.$parent)
            this.$parent = document.body;
        this._createControl();
    }

    get parent(): HTMLElement { return this.$parent; }

    get panel1(): HTMLElement { return this.$panel1; }

    get panel2(): HTMLElement { return this.$panel2; }

    get anchor(): PanelAnchor { return this.$anchor; }
    set anchor(value: PanelAnchor) {
        if (this.$anchor === value) return;
        this.$anchor = 2;
        this._updatePanels();
    }

    set SplitterDistance(value) {
        if (this.$splitterDistance === value)
            return;
        this.$splitterDistance = value;
        this._updatePanels();
        this.emit('splitter-moved', value);
    }
    get SplitterDistance() { return this.$splitterDistance; }

    set Panel1MinSize(value) {
        if (this.$panel1MinSize === value)
            return;
        this.$panel1MinSize = value;
        if (this.$orientation === Orientation.horizontal) {
            if (this.$panel1.clientWidth < value)
                this.$splitterDistance = this.parent.clientWidth - this.$panel1MinSize;
        }
        else if (this.$panel1.clientHeight < value)
            this.$splitterDistance = this.parent.clientHeight - this.$panel1MinSize;
        this._updatePanels();
    }
    get Panel1MinSize() { return this.$panel1MinSize; }

    set Panel2MinSize(value) {
        if (this.$panel2MinSize === value)
            return;
        this.$panel2MinSize = value;
        if (this.$orientation === Orientation.horizontal) {
            if (this.$panel2.clientWidth < value)
                this.$splitterDistance = value;
        }
        else if (this.$panel2.clientHeight < value)
            this.$splitterDistance = value;
        this._updatePanels();
    }
    get Panel2MinSize() { return this.$panel2MinSize; }

    get orientation(): Orientation { return this.$orientation; }
    set orientation(value: Orientation) {
        if (value === this.$orientation) return;
        this.$orientation = value;
        this._updatePanels();
        this.resize();
    }

    get panel1Collapsed() { return this.$collapsed === 1; }
    set panel1Collapsed(value) {
        if (value) {
            if (this.$collapsed === 1) return;
            this.$collapsed = 1;
            this.panel1.dataset.collapsed = 'true';
            this.panel2.dataset.collapsed = 'false';
            this.emit('collapsed', 1);
            this._updatePanels();
        }
        else if (this.$collapsed === 1) {
            this.$collapsed = 0;
            delete this.panel1.dataset.collapsed;
            delete this.panel2.dataset.collapsed;
            this.emit('collapsed', 0);
            this._updatePanels();
        }
    }

    get panel2Collapsed() { return this.$collapsed === 2; }
    set panel2Collapsed(value) {
        if (value) {
            if (this.$collapsed === 2) return;
            this.$collapsed = 2;
            this.panel1.dataset.collapsed = 'false';
            this.panel2.dataset.collapsed = 'true';
            this.emit('collapsed', 2);
            this._updatePanels();
        }
        else if (this.$collapsed === 2) {
            this.$collapsed = 0;
            delete this.panel1.dataset.collapsed;
            delete this.panel2.dataset.collapsed;
            this.emit('collapsed', 0);
            this._updatePanels();
        }
    }

    private _updatePanels() {
        if (this.$orientation === Orientation.horizontal) {
            this.$panel1.style.left = '0';
            this.$panel1.style.top = '0';
            this.$panel1.style.right = '0';
            this.$panel1.style.bottom = '';

            this.$panel2.style.left = '0';
            this.$panel2.style.top = '';
            this.$panel2.style.right = '0';
            this.$panel2.style.bottom = '0';

            this.$dragBar.style.left = '0';
            this.$dragBar.style.right = '0';
            if (this.$anchor === PanelAnchor.panel1) {
                this.$dragBar.style.bottom = '';
                this.$dragBar.style.top = (this.$splitterDistance - this.$splitterWidth) + 'px';
            }
            else {
                this.$dragBar.style.top = '';
                this.$dragBar.style.bottom = (this.$splitterDistance - this.$splitterWidth) + 'px';
            }
            this.$dragBar.style.height = this.$splitterWidth + 'px';
            this.$dragBar.style.width = '';
            this.$dragBar.style.cursor = 'ns-resize';
            this.$panel1.style.width = '';
            this.$panel2.style.width = '';
            if (this.$collapsed === 1) {
                this.$panel1.style.display = 'none';
                this.$panel2.style.display = '';
                this.$panel2.style.top = '0';
                this.$panel2.style.height = '';
                this.$dragBar.style.display = 'none';
            }
            else if (this.$collapsed === 2) {
                this.$panel1.style.display = '';
                this.$panel1.style.bottom = '0';
                this.$panel1.style.height = '';
                this.$panel2.style.display = 'none';
                this.$dragBar.style.display = 'none';
            }
            else if (this.$anchor === PanelAnchor.panel1) {
                this.$panel1.style.display = '';
                this.$panel1.style.height = (this.$splitterDistance - this.$splitterWidth) + 'px';
                this.$panel2.style.display = '';
                this.$panel2.style.top = (this.$splitterDistance) + 'px';
                this.$panel2.style.height = '';
                this.$dragBar.style.display = '';
            }
            else {
                this.$panel1.style.display = '';
                this.$panel1.style.bottom = this.$splitterDistance + 'px';
                this.$panel2.style.display = '';
                this.$panel2.style.height = (this.$splitterDistance - this.$splitterWidth) + 'px';
                this.$dragBar.style.display = '';
            }

            this.$el.classList.remove('vertical');
            this.$el.classList.add('horizontal');
        }
        else {
            this.$panel1.style.left = '0';
            this.$panel1.style.top = '0';
            this.$panel1.style.right = '';
            this.$panel1.style.bottom = '0';
            this.$panel1.classList.remove('horizontal');
            this.$panel1.classList.add('vertical');

            this.$panel2.style.left = '';
            this.$panel2.style.top = '0';
            this.$panel2.style.right = '0';
            this.$panel2.style.bottom = '0';
            if (this.$anchor === PanelAnchor.panel1) {
                this.$dragBar.style.right = '';
                this.$dragBar.style.left = (this.$splitterDistance - this.$splitterWidth) + 'px';
            }
            else {
                this.$dragBar.style.left = '';
                this.$dragBar.style.right = (this.$splitterDistance - this.$splitterWidth) + 'px';
            }
            this.$dragBar.style.top = '0';
            this.$dragBar.style.bottom = '0';
            this.$dragBar.style.width = this.$splitterWidth + 'px';
            this.$dragBar.style.height = '';
            this.$dragBar.style.cursor = 'ew-resize';
            this.$panel1.style.height = '';
            this.$panel2.style.height = '';
            if (this.$collapsed === 1) {
                this.$panel1.style.display = 'none';
                this.$panel2.style.display = '';
                this.$panel2.style.left = '0';
                this.$panel2.style.width = '';
                this.$dragBar.style.display = 'none';
            }
            else if (this.$collapsed === 2) {
                this.$panel1.style.display = '';
                this.$panel1.style.right = '0';
                this.$panel1.style.width = '';
                this.$panel2.style.display = 'none';
                this.$dragBar.style.display = 'none';
            }
            else if (this.$anchor === PanelAnchor.panel1) {
                this.$panel1.style.display = '';
                this.$panel1.style.width = (this.$splitterDistance - this.$splitterWidth) + 'px';
                this.$panel2.style.display = '';
                this.$panel2.style.left = this.$splitterDistance + 'px';
                this.$panel2.style.width = '';
                this.$dragBar.style.display = '';
            }
            else {
                this.$panel1.style.display = '';
                this.$panel1.style.right = this.$splitterDistance + 'px';
                this.$panel2.style.display = '';
                this.$panel2.style.width = this.$splitterDistance - this.$splitterWidth + 'px';
                this.$dragBar.style.display = '';
            }
            this.$el.classList.remove('horizontal');
            this.$el.classList.add('vertical');

        }
    }

    private _createControl() {
        this.$el = document.createElement('div');
        this.$el.id = this.id + '-splitter';
        this.$el.classList.add('splitter');
        if (!this.$panel1) {
            this.$panel1 = document.createElement('div');
            this.$panel1.id = this.id + '-splitter-panel1';
        }
        this.$panel1.classList.add('splitter-panel', 'splitter-panel-1');
        this.$el.appendChild(this.$panel1);
        if (!this.$panel2) {
            this.$panel2 = document.createElement('div');
            this.$panel2.id = this.id + '-splitter-panel2';
        }
        this.$panel2.classList.add('splitter-panel', 'splitter-panel-2');
        this.$el.appendChild(this.$panel2);
        this.$dragBar = document.createElement('div');
        this.$dragBar.id = this.id + '-splitter-drag-bar';
        this.$dragBar.classList.add('spitter-drag-bar');
        this.$el.appendChild(this.$dragBar);
        this.$dragBar.tabIndex = 1;
        this.$dragBar.addEventListener('mousedown', (e) => {
            this.$dragBar.focus();
            e.preventDefault();
            //disable pointer events as some elements capture mouse events like iframes
            this.$panel1.style.pointerEvents = 'none';
            this.$panel2.style.pointerEvents = 'none';
            this.$dragging = true;
            this.$ghostBar = document.createElement('div');
            this.$ghostBar.id = this.id + '-splitter-ghost-bar';
            this.$ghostBar.classList.add('splitter-ghost-bar');
            let bnd = this.$panel2.getBoundingClientRect();
            if (this.$anchor === PanelAnchor.panel1)
                bnd = this.$panel1.getBoundingClientRect();
            if (this.$orientation === Orientation.horizontal) {
                this.$ghostBar.style.left = '0';
                if (this.$anchor === PanelAnchor.panel1)
                    this.$ghostBar.style.top = (bnd.bottom - this.$elBounds.top) + 'px';
                else
                    this.$ghostBar.style.top = (bnd.top - this.$elBounds.top - this.$splitterWidth) + 'px';
                this.$ghostBar.style.right = '0';
                this.$ghostBar.style.bottom = '';
                this.$ghostBar.style.width = '';
                this.$ghostBar.style.height = this.$splitterWidth + 'px';
                this.$ghostBar.style.cursor = 'ns-resize';
            }
            else {
                if (this.$anchor === PanelAnchor.panel1)
                    this.$ghostBar.style.left = (bnd.right - this.$elBounds.left) + 'px';
                else
                    this.$ghostBar.style.left = (bnd.left - this.$elBounds.left - this.$splitterWidth) + 'px';
                this.$ghostBar.style.top = '0';
                this.$ghostBar.style.bottom = '0';
                this.$ghostBar.style.right = '';
                this.$ghostBar.style.height = '';
                this.$ghostBar.style.width = this.$splitterWidth + 'px';
                this.$ghostBar.style.cursor = 'ew-resize';
            }
            (<any>this.$ghostBar).move = (ge) => {
                let l;
                if (this.$orientation === Orientation.horizontal && this.$anchor === PanelAnchor.panel1) {
                    l = ge.pageY - this.$elBounds.top;
                    if (l < this.$panel1MinSize + this.$splitterWidth)
                        this.$ghostBar.style.top = this.$panel1MinSize + 'px';
                    else if (l > this.parent.clientHeight - this.$panel2MinSize - this.$splitterWidth)
                        this.$ghostBar.style.top = (this.parent.clientHeight - this.$panel2MinSize - this.$splitterWidth) + 'px';
                    else
                        this.$ghostBar.style.top = (l - 2) + 'px';
                    if (this.live) {
                        if (l < this.$panel1MinSize + this.$splitterWidth)
                            this.SplitterDistance = this.$panel1MinSize + this.$splitterWidth;
                        else if (l > this.parent.clientHeight - this.$panel2MinSize - this.$splitterWidth)
                            this.SplitterDistance = this.parent.clientHeight - this.$panel2MinSize;
                        else
                            this.SplitterDistance = l - 2 + this.$splitterWidth;
                    }
                }
                else if (this.$orientation === Orientation.horizontal) {
                    l = ge.pageY - this.$elBounds.top;
                    if (l < this.$panel1MinSize)
                        this.$ghostBar.style.top = this.$panel1MinSize + 'px';
                    else if (l > this.parent.clientHeight - this.$panel2MinSize)
                        this.$ghostBar.style.top = (this.parent.clientHeight - this.$panel2MinSize) + 'px';
                    else
                        this.$ghostBar.style.top = (l - 2) + 'px';
                    if (this.live) {
                        if (l < this.$panel1MinSize)
                            this.SplitterDistance = this.parent.clientHeight - this.$panel1MinSize;
                        else if (l > this.parent.clientHeight - this.$panel2MinSize)
                            this.SplitterDistance = this.$panel2MinSize;
                        else
                            this.SplitterDistance = this.parent.clientHeight - l + 2;
                    }
                }
                else if (this.$orientation === Orientation.vertical && this.$anchor === PanelAnchor.panel1) {
                    l = ge.pageX - this.$elBounds.left;
                    if (l < this.$panel1MinSize + this.$splitterWidth)
                        this.$ghostBar.style.left = this.$panel1MinSize + 'px';
                    else if (l >= this.parent.clientWidth - this.$panel2MinSize - this.$splitterWidth)
                        this.$ghostBar.style.left = (this.parent.clientWidth - this.$panel2MinSize - this.$splitterWidth) + 'px';
                    else
                        this.$ghostBar.style.left = (l - 2) + 'px';
                    if (this.live) {
                        if (l < this.$panel1MinSize + this.$splitterWidth)
                            this.SplitterDistance = this.$panel1MinSize + this.$splitterWidth;
                        else if (l >= this.parent.clientWidth - this.$panel2MinSize - this.$splitterWidth)
                            this.SplitterDistance = this.parent.clientWidth - this.$panel2MinSize;
                        else
                            this.SplitterDistance = l - 2 + this.$splitterWidth;
                    }
                }
                else {
                    l = ge.pageX - this.$elBounds.left;
                    if (l < this.$panel1MinSize)
                        this.$ghostBar.style.left = this.$panel1MinSize + 'px';
                    else if (l > this.parent.clientWidth - this.$panel2MinSize)
                        this.$ghostBar.style.left = (this.parent.clientWidth - this.$panel2MinSize) + 'px';
                    else
                        this.$ghostBar.style.left = (l - 2) + 'px';
                    if (this.live) {
                        if (l < this.$panel1MinSize)
                            this.SplitterDistance = this.parent.clientWidth - this.$panel1MinSize;
                        else if (l > this.parent.clientWidth - this.$panel2MinSize)
                            this.SplitterDistance = this.$panel2MinSize;
                        else
                            this.SplitterDistance = this.parent.clientWidth - l + 2;
                    }
                }
                this.emit('splitter-moving', l);
            };
            this.$el.appendChild(this.$ghostBar);
            document.addEventListener('mousemove', (<any>this.$ghostBar).move);
        });
        this.$dragBar.addEventListener('dblclick', (e) => {
            this.emit('dblclick', e);
        });
        window.addEventListener('resize', () => {
            this.resize();
        });
        document.addEventListener('mouseup', (e) => {
            if (!this.$dragging) return;
            e.preventDefault();
            e.stopPropagation();
            e.cancelBubble = true;
            let l;
            if (this.$orientation === Orientation.horizontal) {
                l = e.pageY - this.$elBounds.top;
                if (this.$anchor === PanelAnchor.panel1) {
                    if (l < this.$panel1MinSize + this.$splitterWidth)
                        this.SplitterDistance = this.$panel1MinSize + this.$splitterWidth;
                    else if (l > this.parent.clientHeight - this.$panel2MinSize - this.$splitterWidth)
                        this.SplitterDistance = this.parent.clientHeight - this.$panel2MinSize;
                    else
                        this.SplitterDistance = l - 2 + this.$splitterWidth;
                }
                else if (l < this.$panel1MinSize)
                    this.SplitterDistance = this.parent.clientHeight - this.$panel1MinSize - 2;
                else if (l > this.parent.clientHeight - this.$panel2MinSize)
                    this.SplitterDistance = this.$panel2MinSize;
                else
                    this.SplitterDistance = this.parent.clientHeight - l + 2;
            }
            else {
                l = e.pageX - this.$elBounds.left;
                if (this.$anchor === PanelAnchor.panel1) {
                    if (l < this.$panel1MinSize + this.$splitterWidth)
                        this.SplitterDistance = this.$panel1MinSize + this.$splitterWidth;
                    else if (l > this.parent.clientWidth - this.$panel2MinSize - this.$splitterWidth)
                        this.SplitterDistance = this.parent.clientWidth - this.$panel2MinSize;
                    else
                        this.SplitterDistance = l - 2 + this.$splitterWidth;
                }
                else if (l < this.$panel1MinSize)
                    this.SplitterDistance = this.parent.clientWidth - this.$panel1MinSize - 2;
                else if (l > this.parent.clientWidth - this.$panel2MinSize)
                    this.SplitterDistance = this.$panel2MinSize;
                else
                    this.SplitterDistance = this.parent.clientWidth - l + 2;
            }
            this.$el.removeChild(this.$ghostBar);
            document.removeEventListener('mousemove', (<any>this.$ghostBar).move);
            this.$ghostBar = null;
            this.$dragging = false;
            this.$panel1.style.pointerEvents = '';
            this.$panel2.style.pointerEvents = '';
        });
        this.parent.appendChild(this.$el);
        setTimeout(() => {
            this.$elBounds = this.$el.getBoundingClientRect();
        }, 10);

        this.$resizeObserver = new ResizeObserver((entries, observer) => {
            if (entries.length === 0) return;
            if (!entries[0].contentRect || entries[0].contentRect.width === 0 || entries[0].contentRect.height === 0)
                return;
            if (!this.$resizeObserverCache || this.$resizeObserverCache.width !== entries[0].contentRect.width || this.$resizeObserverCache.height !== entries[0].contentRect.height) {
                this.$resizeObserverCache = { width: entries[0].contentRect.width, height: entries[0].contentRect.height };
                this.resize();
            }
        });
        this.$resizeObserver.observe(this.$el);
        this.$observer = new MutationObserver((mutationsList) => {
            let mutation;
            for (mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (mutation.oldValue === 'display: none;')
                        this.resize();
                }
            }
        });
        this.$observer.observe(this.$el, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
    }

    public resize() {
        if (this.$orientation === Orientation.horizontal && this.$anchor === PanelAnchor.panel1) {
            if (this.$panel2.clientHeight && this.$panel2.clientHeight < this.$panel2MinSize && this.$panel1.clientHeight > this.$panel1MinSize)
                this.SplitterDistance = this.parent.clientHeight - this.$panel2MinSize;
        }
        else if (this.$orientation === Orientation.horizontal) {
            if (this.$panel1.clientHeight && this.$panel1.clientHeight < this.$panel1MinSize && this.$panel2.clientHeight > this.$panel2MinSize)
                this.SplitterDistance = this.$panel1MinSize;
        }
        else if (this.$orientation === Orientation.vertical && this.$anchor === PanelAnchor.panel1) {
            if (this.$panel2.clientWidth && this.$panel2.clientWidth < this.$panel2MinSize && this.$panel1.clientWidth > this.$panel1MinSize)
                this.SplitterDistance = this.parent.clientWidth - this.$panel2MinSize;
        }
        else if (this.$panel1.clientWidth < this.$panel1MinSize && this.$panel2.clientWidth > this.$panel2MinSize)
            this.SplitterDistance = this.$panel1MinSize;
        this.$elBounds = this.$el.getBoundingClientRect();
    }
}
