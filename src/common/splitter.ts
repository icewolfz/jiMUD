import EventEmitter = require('events');

export interface SplitterOptions {
    container?: any;
    orientation?: Orientation;
    parent?: any;
    id?: string;
    panel1?: HTMLElement;
    panel2?: HTMLElement;
}

export enum Orientation {
    horizontal, vertical
}

export class Splitter extends EventEmitter {
    private $el: HTMLElement;
    private $parent: HTMLElement;
    private $panel1: HTMLElement;
    private $panel2: HTMLElement;
    private $orientation: Orientation;
    private $panel1MinSize = 200;
    private $panel2MinSize = 200;
    private $splitterWidth = 4;
    private $dragbar: HTMLElement;
    private $ghostbar: HTMLElement;
    private $splitterDistance = 200;
    private $dragging = false;
    private $id;
    private $collapsed = 0;

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
        if (options)
            this.orientation = options.orientation || Orientation.horizontal;
        else
            this.orientation = Orientation.horizontal;
    }

    get id() { return this.$id || this.parent.id; }
    set id(value) {
        if (value === this.$id) return;
        this.$id = value;
        this.$el.id = this.id + '-splitter';
        this.$panel1.id = this.id + '-splitter-panel1';
        this.$panel2.id = this.id + '-splitter-panel2';
        this.$dragbar.id = this.id + '-splitter-drag-bar';
        if (this.$ghostbar)
            this.$ghostbar.id = this.id + '-ghost-bar';
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
        this.createControl();
    }

    get parent(): HTMLElement { return this.$parent; }

    get panel1(): HTMLElement { return this.$panel1; }

    get panel2(): HTMLElement { return this.$panel2; }

    set SplitterDistance(value) {
        if (this.$splitterDistance === value)
            return;
        this.$splitterDistance = value;
        this.updatePanels();
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
        this.updatePanels();
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
        this.updatePanels();
    }
    get Panel2MinSize() { return this.$panel2MinSize; }

    get orientation(): Orientation { return this.$orientation; }
    set orientation(value: Orientation) {
        if (value === this.$orientation) return;
        this.$orientation = value;
        this.updatePanels();
    }

    get panel1Collapsed() { return this.$collapsed === 1; }
    set panel1Collapsed(value) {
        if (value) {
            if (this.$collapsed === 1) return;
            this.$collapsed = 1;
            this.emit('collapsed', 1);
            this.updatePanels();
        }
        else if (this.$collapsed === 1) {
            this.$collapsed = 0;
            this.emit('collapsed', 0);
            this.updatePanels();
        }
    }

    get panel2Collapsed() { return this.$collapsed === 2; }
    set panel2Collapsed(value) {
        if (value) {
            if (this.$collapsed === 2) return;
            this.$collapsed = 2;
            this.emit('collapsed', 2);
            this.updatePanels();
        }
        else if (this.$collapsed === 2) {
            this.$collapsed = 0;
            this.emit('collapsed', 0);
            this.updatePanels();
        }
    }

    private updatePanels() {
        if (this.$orientation === Orientation.horizontal) {
            this.$panel1.style.left = '0';
            this.$panel1.style.top = '0';
            this.$panel1.style.right = '0';

            this.$panel2.style.left = '0';
            this.$panel2.style.top = '';
            this.$panel2.style.right = '0';
            this.$panel2.style.bottom = '0';

            this.$dragbar.style.left = '0';
            this.$dragbar.style.right = '0';
            this.$dragbar.style.top = '';
            this.$dragbar.style.bottom = (this.$splitterDistance - this.$splitterWidth) + 'px';
            this.$dragbar.style.height = this.$splitterWidth + 'px';
            this.$dragbar.style.cursor = 'row-resize';

            if (this.$collapsed === 1) {
                this.$panel1.style.display = 'none';
                this.$panel2.style.display = '';
                this.$panel2.style.top = '0';
                this.$panel2.style.height = '';
                this.$dragbar.style.display = 'none';
            }
            else if (this.$collapsed === 2) {
                this.$panel1.style.display = '';
                this.$panel1.style.bottom = '0';
                this.$panel2.style.display = 'none';
                this.$dragbar.style.display = 'none';
            }
            else {
                this.$panel1.style.display = '';
                this.$panel1.style.bottom = this.$splitterDistance + 'px';
                this.$panel2.style.display = '';
                this.$panel2.style.height = (this.$splitterDistance - this.$splitterWidth) + 'px';
                this.$dragbar.style.display = '';
            }

            this.$el.classList.remove('vertical');
            this.$el.classList.add('horizontal');
        }
        else {
            this.$panel1.style.left = '0';
            this.$panel1.style.top = '0';
            this.$panel1.style.bottom = '0';
            this.$panel1.classList.remove('horizontal');
            this.$panel1.classList.add('vertical');

            this.$panel2.style.left = '';
            this.$panel2.style.top = '0';
            this.$panel2.style.right = '0';
            this.$panel2.style.bottom = '0';

            this.$dragbar.style.left = '';
            this.$dragbar.style.right = (this.$splitterDistance - this.$splitterWidth) + 'px';
            this.$dragbar.style.top = '0';
            this.$dragbar.style.bottom = '0';
            this.$dragbar.style.width = this.$splitterWidth + 'px';
            this.$dragbar.style.cursor = 'col-resize';

            if (this.$collapsed === 1) {
                this.$panel1.style.display = 'none';
                this.$panel2.style.display = '';
                this.$panel2.style.left = '0';
                this.$panel2.style.width = '';
                this.$dragbar.style.display = 'none';
            }
            else if (this.$collapsed === 2) {
                this.$panel1.style.display = '';
                this.$panel1.style.right = '0';
                this.$panel2.style.display = 'none';
                this.$dragbar.style.display = 'none';
            }
            else {
                this.$panel1.style.display = '';
                this.$panel1.style.right = this.$splitterDistance + 'px';
                this.$panel2.style.display = '';
                this.$panel2.style.width = this.$splitterDistance - this.$splitterWidth + 'px';
                this.$dragbar.style.display = '';
            }

            this.$el.classList.remove('horizontal');
            this.$el.classList.add('vertical');

        }
    }

    private createControl() {
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
        this.$dragbar = document.createElement('div');
        this.$dragbar.id = this.id + '-splitter-drag-bar';
        this.$dragbar.classList.add('spitter-drag-bar');
        this.$el.appendChild(this.$dragbar);
        this.$dragbar.tabIndex = 1;
        this.$dragbar.addEventListener('mousedown', (e) => {
            this.$dragbar.focus();
            e.preventDefault();
            this.$dragging = true;
            this.$ghostbar = document.createElement('div');
            this.$ghostbar.id = this.id + '-ghost-bar';
            this.$ghostbar.classList.add('splitter-ghost-bar');
            const bnd = this.$panel2.getBoundingClientRect();
            if (this.$orientation === Orientation.horizontal) {
                this.$ghostbar.style.left = '0';
                this.$ghostbar.style.top = (bnd.top - this.$elBounds.top - this.$splitterWidth) + 'px';
                this.$ghostbar.style.right = '0';
                this.$ghostbar.style.bottom = '';
                this.$ghostbar.style.width = '';
                this.$ghostbar.style.height = this.$splitterWidth + 'px';
                this.$ghostbar.style.cursor = 'row-resize';
            }
            else {
                this.$ghostbar.style.left = (bnd.left - this.$elBounds.left - this.$splitterWidth) + 'px';
                this.$ghostbar.style.top = '0';
                this.$ghostbar.style.bottom = '0';
                this.$ghostbar.style.right = '';
                this.$ghostbar.style.height = '';
                this.$ghostbar.style.width = this.$splitterWidth + 'px';
                this.$ghostbar.style.cursor = 'col-resize';
            }
            (<any>this.$ghostbar).move = (ge) => {
                let l;
                if (this.$orientation === Orientation.horizontal) {
                    l = ge.pageY - this.$elBounds.top;
                    if (l < this.$panel1MinSize)
                        this.$ghostbar.style.top = this.$panel1MinSize + 'px';
                    else if (l > this.parent.clientHeight - this.$panel2MinSize)
                        this.$ghostbar.style.top = (this.parent.clientHeight - this.$panel2MinSize) + 'px';
                    else
                        this.$ghostbar.style.top = (l - 2) + 'px';
                    if (this.live) {
                        if (l < this.$panel1MinSize)
                            this.SplitterDistance = this.parent.clientHeight - this.$panel1MinSize;
                        else if (l > this.parent.clientHeight - this.$panel2MinSize)
                            this.SplitterDistance = this.$panel2MinSize;
                        else
                            this.SplitterDistance = this.parent.clientHeight - l + 2;
                    }
                }
                else {
                    l = ge.pageX - this.$elBounds.left;
                    if (l < this.$panel1MinSize)
                        this.$ghostbar.style.left = this.$panel1MinSize + 'px';
                    else if (l > this.parent.clientWidth - this.$panel2MinSize)
                        this.$ghostbar.style.left = (this.parent.clientWidth - this.$panel2MinSize) + 'px';
                    else
                        this.$ghostbar.style.left = (l - 2) + 'px';
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
            this.parent.appendChild(this.$ghostbar);
            document.addEventListener('mousemove', (<any>this.$ghostbar).move);
        });
        this.$dragbar.addEventListener('dblclick', (e) => {
            this.emit('dblclick', e);
        });
        window.addEventListener('resize', () => {
            if (this.$orientation === Orientation.vertical) {
                if (this.$panel2.clientHeight < this.$panel1MinSize)
                    this.SplitterDistance = this.$panel1MinSize;
                else if (this.$panel1.clientHeight < this.$panel2MinSize)
                    this.SplitterDistance = this.$panel2MinSize;
            }
            else {
                if (this.$panel2.clientWidth < this.$panel1MinSize)
                    this.SplitterDistance = this.$panel1MinSize;
                else if (this.$panel1.clientWidth < this.$panel2MinSize)
                    this.SplitterDistance = this.$panel2MinSize;
            }
            this.$elBounds = this.$el.getBoundingClientRect();
        });
        document.addEventListener('mouseup', (e) => {
            if (!this.$dragging) return;
            e.preventDefault();
            e.stopPropagation();
            e.cancelBubble = true;
            let l;
            if (this.$orientation === Orientation.horizontal) {
                l = e.pageY - this.$elBounds.top;
                if (l < this.$panel1MinSize)
                    this.SplitterDistance = this.parent.clientHeight - this.$panel1MinSize - 2;
                else if (l > this.parent.clientHeight - this.$panel2MinSize)
                    this.SplitterDistance = this.$panel2MinSize;
                else
                    this.SplitterDistance = this.parent.clientHeight - l + 2;
            }
            else {
                l = e.pageX - this.$elBounds.left;
                if (l < this.$panel1MinSize)
                    this.SplitterDistance = this.parent.clientWidth - this.$panel1MinSize - 2;
                else if (l > this.parent.clientWidth - this.$panel2MinSize)
                    this.SplitterDistance = this.$panel2MinSize;
                else
                    this.SplitterDistance = this.parent.clientWidth - l + 2;
            }
            this.parent.removeChild(this.$ghostbar);
            document.removeEventListener('mousemove', (<any>this.$ghostbar).move);
            this.$ghostbar = null;
            this.$dragging = false;
        });
        this.parent.appendChild(this.$el);
        setTimeout(() => {
            this.$elBounds = this.$el.getBoundingClientRect();
        }, 10);
    }
}
