//spellchecker:ignore dropdown dropdownmenu tabpane
import { EventEmitter } from 'events';
import { nativeImage } from 'electron';

declare let window;

export enum UpdateType {
    none = 0,
    resize = 1,
    scroll = 2,
    scrollToTab = 4,
    stripState = 8,
    batchAdd = 16
}

export interface DockMangerOptions {
    container?: string | JQuery | HTMLElement;
}

export interface Panel {
    tab: HTMLElement;
    pane: HTMLElement;
    id: number;
    icon: HTMLElement;
    title: HTMLElement;
    iconCls: string;
    iconSrc?;
    isPanel: boolean;
    dock: DockPane;
}

export enum DockLocation {
    fill, left, right, bottom, top
}

export interface PanelOptions {
    title?: string;
    icon?: string;
    iconCls?: string;
    iconSrc?: string;
    tooltip?: string;
    noActivate?: boolean;
    silent?: boolean;
}

export interface DockManagerOptions {
    parent?: any;
    layout?: any;
}

export class DockManager extends EventEmitter {
    public panes: DockPane[] = [];
    private $parent: HTMLElement;
    private $el: HTMLElement;
    private $activePane: DockPane;
    public dragPanel;
    private _updating: UpdateType = UpdateType.none;
    private _rTimeout = 0;
    private $widths: number[] = [];
    private $width;
    private $dropOutline;
    private $dragBounds;
    private _hideTabs;
    private _useNativeMenus: boolean = false;
    public panelID: number = 0;
    private $layout;
    private $bars: HTMLElement[] = [];
    private $ghostBar: HTMLElement = null;

    private $resizeObserver;
    private $resizeObserverCache;
    private $observer: MutationObserver;

    private _dropDataFormat: string = 'dockmanger/tab';

    constructor(options?: any | DockManagerOptions) {
        super();

        if (options && options.layout)
            this.$widths = options.layout;
        if (options && options.parent)
            this.parent = options.parent;
        else
            this.parent = document.body;

        window.addEventListener('resize', (e) => {
            this.doUpdate(UpdateType.resize);
        });
        window.addEventListener('load', () => {
            this.doUpdate(UpdateType.resize);
        });

        this.$resizeObserver = new ResizeObserver((entries, observer) => {
            if (entries.length === 0) return;
            if (!entries[0].contentRect || entries[0].contentRect.width === 0 || entries[0].contentRect.height === 0)
                return;
            if (!this.$resizeObserverCache || this.$resizeObserverCache.width !== entries[0].contentRect.width || this.$resizeObserverCache.height !== entries[0].contentRect.height) {
                this.$resizeObserverCache = { width: entries[0].contentRect.width, height: entries[0].contentRect.height };
                this.doUpdate(UpdateType.resize);
            }
        });
        this.$resizeObserver.observe(this.$el);
        this.$observer = new MutationObserver((mutationsList) => {
            let mutation;
            for (mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    this.doUpdate(UpdateType.resize);
                }
            }
        });
        this.$observer.observe(this.$el, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });        
    }

    public get parent() { return this.$parent; }
    public set parent(parent: string | JQuery | HTMLElement) {
        if (typeof parent === 'string') {
            if (parent.startsWith('#'))
                this.$parent = document.getElementById(parent.substr(1));
            else
                this.$parent = document.getElementById(parent);
        }
        else if (parent instanceof $)
            this.$parent = parent[0];
        else if (parent instanceof HTMLElement)
            this.$parent = parent;
        if (!this.$parent)
            this.$parent = document.body;
        this.create();
    }

    private createPane() {
        const pane = new DockPane(this.$el);
        this.emit('create-pane', pane);
        pane.hideTabstrip = this._hideTabs;
        pane.useNativeMenus = this._useNativeMenus;
        pane.dropDataFormat = this._dropDataFormat;
        pane.manager = this;
        pane.on('mousedown', (e) => {
            this.focusPane(pane);
        });
        pane.on('tab-strip-hidden', () => this.emit('tab-strip-hidden', this.panes.indexOf(pane)));
        pane.on('tab-strip-shown', () => this.emit('tab-strip-shown', this.panes.indexOf(pane)));
        pane.on('dragenter', e => {
            this.emit('dragenter', e, this.panes.indexOf(pane));
            if (e.defaultPrevented || !this.dragPanel) return;
            //if (pane === this.dragPanel.pane) return;
            this.$dropOutline.style.display = 'block';
            const b = pane.bounds;
            this.$dragBounds = b;
            this.$dropOutline.style.height = b.height + 'px';
            this.$dropOutline.style.top = b.top + 'px';

            if (this.dragPanel.dock === pane && pane.panels.length === 1) {
                this.$dropOutline.style.width = b.width + 'px';
                this.$dropOutline.style.left = b.left + 'px';
            }
            else if ((e.clientX - b.left) / b.width <= 0.2 && this.panes.length < 3) {
                this.$dropOutline.style.width = (b.width / 2) + 'px';
                this.$dropOutline.style.left = b.left + 'px';
            }
            else if ((e.clientX - b.left) / b.width >= 0.8 && this.panes.length < 3) {
                this.$dropOutline.style.width = (b.width / 2) + 'px';
                this.$dropOutline.style.left = (b.left + b.width / 2) + 'px';
            }
            else {
                this.$dropOutline.style.width = b.width + 'px';
                this.$dropOutline.style.left = b.left + 'px';
            }

            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            e.stopPropagation();
        });
        pane.on('dragleave', e => {
            this.emit('dragleave', e, this.panes.indexOf(pane));
            if (e.defaultPrevented || !this.dragPanel) return;
            this.$dropOutline.style.display = 'none';
            e.preventDefault();
            e.stopPropagation();
        });
        pane.on('dragover', e => {
            this.emit('dragover', e, this.panes.indexOf(pane));
            if (e.defaultPrevented || !this.dragPanel) return;
            this.$dropOutline.style.display = 'block';
            const b = this.$dragBounds;
            if (this.dragPanel.dock === pane && pane.panels.length === 1) {
                this.$dropOutline.style.width = b.width + 'px';
                this.$dropOutline.style.left = b.left + 'px';
            }
            else if ((e.clientX - b.left) / b.width <= 0.2 && this.panes.length < 3) {
                this.$dropOutline.style.width = (b.width / 2) + 'px';
                this.$dropOutline.style.left = b.left + 'px';
            }
            else if ((e.clientX - b.left) / b.width >= 0.8 && this.panes.length < 3) {
                this.$dropOutline.style.width = (b.width / 2) + 'px';
                this.$dropOutline.style.left = (b.left + b.width / 2) + 'px';
            }
            else {
                this.$dropOutline.style.width = b.width + 'px';
                this.$dropOutline.style.left = b.left + 'px';
            }
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            e.stopPropagation();
        });
        pane.on('drop', e => {
            this.emit('drop', e, this.panes.indexOf(pane));
            if (e.defaultPrevented || !this.dragPanel) return;
            this.$dropOutline.style.display = 'none';
            let p;
            const dock = this.dragPanel.dock;
            let rw = false;
            const b = this.$dragBounds;
            let idx = this.panes.indexOf(pane);
            if (this.dragPanel.dock === pane && pane.panels.length === 1)
                return;
            else if ((e.clientX - b.left) / b.width <= 0.2 && this.panes.length < 3) {
                p = this.createPane();
                if (idx === 0) {
                    this.panes.unshift(p);
                    this.emit('add-pane', 0, p);
                }
                else {
                    this.panes.splice(idx, 0, p);
                    this.emit('add-pane', idx, p);
                }
                this.$bars.push(this.createBar());
                this.dock(this.dragPanel, p, true);
                rw = true;
            }
            else if ((e.clientX - b.left) / b.width >= 0.8 && this.panes.length < 3) {
                idx++;
                p = this.createPane();
                if (idx < this.panes.length) {
                    this.panes.splice(idx, 0, p);
                    this.emit('add-pane', idx, p);
                }
                else {
                    this.panes.push(p);
                    this.emit('add-pane', this.panes.length - 1, p);
                }
                this.$bars.push(this.createBar());
                this.dock(this.dragPanel, p, true);
                rw = true;
            }
            else if (this.dragPanel.dock === pane)
                return;
            else
                this.dock(this.dragPanel, pane, true);

            if (dock.panels.length === 0) {
                idx = this.panes.indexOf(dock);
                if (idx !== -1) {
                    this.emit('destroy-pane', idx, dock);
                    this.panes.splice(idx, 1);
                    this.$bars[0].remove();
                    this.$bars.splice(0, 1);
                    dock.destroy();
                    rw = true;
                }
            }
            if (rw)
                this.resizeWidths();
            this.resize();
            this.freePanes();
            e.preventDefault();
            e.stopPropagation();
        });
        pane.on('contextmenu', e => this.emit('contextmenu', e, this.panes.indexOf(pane)));
        pane.on('tab-click', e => {
            this.focusPane(pane);
            this.emit('tab-click', e, this.panes.indexOf(pane));
        });
        pane.on('tab-contextmenu', (data, e) => {
            data = data || {};
            data.pane = this.panes.indexOf(pane);
            this.emit('tab-contextmenu', data, e);
        });
        pane.on('tab-dblclick', e => this.emit('tab-dblclick', e, this.panes.indexOf(pane)));
        pane.on('tab-drag', e => this.emit('tab-drag', e, this.panes.indexOf(pane)));
        pane.on('tab-drag-over', e => this.emit('tab-drag-over', e, this.panes.indexOf(pane)));
        pane.on('tab-drag-end', e => this.emit('tab-drag-end', e, this.panes.indexOf(pane)));
        pane.on('tab-drag-enter', e => this.emit('tab-drag-enter', e, this.panes.indexOf(pane)));
        pane.on('tab-drag-leave', e => this.emit('tab-drag-leave', e, this.panes.indexOf(pane)));

        pane.on('tab-moved', e => this.emit('tab-moved', e, this.panes.indexOf(pane)));
        pane.on('add', e => this.emit('add', e, this.panes.indexOf(pane)));
        pane.on('removed', e => {
            const dock = e.panel.dock;
            const idx = this.panes.indexOf(dock);
            this.emit('removed', e, idx);
            this.destroyPane(dock);
        });
        pane.on('remove', e => this.emit('remove', e, this.panes.indexOf(pane)));
        pane.on('deactivated', e => this.emit('deactivated', e, this.panes.indexOf(pane)));
        pane.on('activated', e => {
            this.focusPane(pane);
            this.emit('activated', e, this.panes.indexOf(pane));
        });
        return pane;
    }

    private resizeWidths() {
        this.$widths = [];
        let l = this.panes.length;
        const w = 1.0 / this.panes.length;
        while (l--)
            this.$widths[l] = w;
    }

    public focusPane(pane) {
        if (this.$activePane === pane) return;
        if (this.$activePane) {
            this.emit('pane-deactivated', this.panes.indexOf(this.$activePane));
            this.$activePane.focused = false;
        }
        this.$activePane = pane;
        this.$activePane.focused = true;
        this.emit('pane-activated', this.panes.indexOf(pane));
    }

    public freePanes() {
        let l = this.panes.length;
        while (l--)
            this.panes[l].pane.style.pointerEvents = '';
    }

    public freezePanes() {
        let l = this.panes.length;
        while (l--)
            this.panes[l].pane.style.pointerEvents = 'none';
    }

    private createBar() {
        const el = document.createElement('div');
        el.classList.add('spitter-drag-bar', 'vertical');
        el.tabIndex = 1;
        el.addEventListener('mousedown', (e) => {
            this.freezePanes();
            el.focus();
            e.preventDefault();
            this.$ghostBar = document.createElement('div');
            this.$ghostBar.classList.add('splitter-ghost-bar');
            this.$ghostBar.style.left = el.style.left;
            this.$ghostBar.style.top = '0';
            this.$ghostBar.style.bottom = '0';
            this.$ghostBar.style.right = '';
            this.$ghostBar.style.height = '';
            this.$ghostBar.style.width = '4px';
            this.$ghostBar.style.cursor = 'ew-resize';
            (<any>this.$ghostBar).index = this.$bars.indexOf(el);
            (<any>this.$ghostBar).bounds = this.$el.getBoundingClientRect();
            (<any>this.$ghostBar).move = (ge) => {
                const idx = (<any>this.$ghostBar).index;
                const lBounds = this.panes[idx].bounds;
                const rBounds = this.panes[idx + 1].bounds;
                const l = ge.pageX - lBounds.left;
                const s = lBounds.width + rBounds.width + 4;
                if (l < 150)
                    this.$ghostBar.style.left = (lBounds.left + 150) + 'px';
                else if (l > s - 150)
                    this.$ghostBar.style.left = (lBounds.left + s - 150) + 'px';
                else
                    this.$ghostBar.style.left = (lBounds.left + l - 2) + 'px';
                let d;
                if (l < 150)
                    d = 150;
                else if (l > s - 150)
                    d = s - 150;
                else
                    d = l - 2;
                let w = this.panes[idx].width;
                const tw = (this.$el.clientWidth - (this.$bars.length * 4));
                this.$widths[idx] = d / tw;
                w = this.panes[idx + 1].width + w - d;
                this.$widths[idx + 1] = w / tw;
                this.doUpdate(UpdateType.resize);
            };
            this.$el.appendChild(this.$ghostBar);
            document.addEventListener('mousemove', (<any>this.$ghostBar).move);
        });
        el.style.top = '0';
        el.style.bottom = '0';
        el.style.width = '4px';
        el.style.cursor = 'ew-resize';
        this.$el.appendChild(el);
        return el;
    }

    private create() {
        this.$el = document.createElement('div');
        this.$el.classList.add('dock-manager');
        this.$parent.appendChild(this.$el);
        if (this.$layout) {
            let l = this.$widths.length;
            while (l--) {
                this.panes.push(this.createPane());
                this.$bars.push(this.createBar());
                this.emit('add-pane', this.panes.length - 1, this.panes[this.panes.length - 1]);
            }
            this.$activePane = this.panes[0];
            this.$activePane.focused = true;
        }
        else {
            this.panes = [this.createPane()];
            this.$widths = [1.0];
            this.$activePane = this.panes[0];
            this.$activePane.focused = true;
        }
        this.$width = this.$el.clientWidth;
        this.$dropOutline = document.createElement('div');
        this.$dropOutline.classList.add('drop');
        this.$dropOutline.style.display = 'none';
        this.$dropOutline.style.zIndex = '10000000';
        this.$dropOutline.style.position = 'absolute';
        this.$dropOutline.style.pointerEvents = 'none';
        this.$el.appendChild(this.$dropOutline);
        this.doUpdate(UpdateType.resize);
        document.addEventListener('mouseup', (e) => {
            if (!this.$ghostBar) return;
            e.preventDefault();
            e.stopPropagation();
            e.cancelBubble = true;

            const idx = (<any>this.$ghostBar).index;
            const lBounds = this.panes[idx].bounds;
            const rBounds = this.panes[idx + 1].bounds;
            const l = e.pageX - lBounds.left;
            const s = lBounds.width + rBounds.width + 4;
            let d;
            if (l < 150)
                d = 150;
            else if (l > s - 150)
                d = s - 150;
            else
                d = l - 2;
            let w = this.panes[idx].width;
            const tw = (this.$el.clientWidth - (this.$bars.length * 4));
            this.$widths[idx] = d / tw;
            w = this.panes[idx + 1].width + w - d;
            this.$widths[idx + 1] = w / tw;

            this.$ghostBar.remove();
            document.removeEventListener('mousemove', (<any>this.$ghostBar).move);
            this.$ghostBar = null;
            this.freePanes();
        });
        document.addEventListener('keyup', (e) => {
            this.emit('keyup', e);
            if (e.defaultPrevented)
                return;
        });
        document.addEventListener('keydown', (e) => {
            let idx;
            const tl = this.panels.length;
            this.emit('keydown', e);
            if (e.defaultPrevented)
                return;
            if (!e.altKey && e.ctrlKey && !e.shiftKey && !e.metaKey) {
                if (e.which === 87) {
                    this.$activePane.removePanel(this.$activePane.active);
                    e.preventDefault();
                }
                else if (e.which === 9) {
                    idx = this.$activePane.getPanelIndex(this.$activePane.active);
                    if (idx === -1) return;
                    idx++;
                    if (idx === this.$activePane.panels.length)
                        idx = 0;
                    this.$activePane.switchToPanelByIndex(idx);
                    e.preventDefault();
                }
            }
        });
    }

    public get layout() { return this.$widths; }
    public set layout(value) { this.setLayout(value); }

    public setLayout(value, noMerge?) {
        if (this.$width === value) return;
        this.$widths = value;
        while (this.$widths.length > this.panes.length) {
            this.panes.push(this.createPane());
            this.$bars.push(this.createBar());
            this.emit('add-pane', this.panes.length - 1, this.panes[this.panes.length - 1]);
        }
        while (this.$widths.length < this.panes.length) {
            const p = this.panes.pop();
            const idx = this.panes.length;
            if (p.panels.length && !noMerge) {
                const ps = p.panels;
                p.removeAllPanels();
                this.panes[idx - 1].addPanels(ps);
            }
            this.emit('destroy-pane', this.panes.length, p);
            this.$bars[0].remove();
            this.$bars.splice(0, 1);
            this.panes.splice(this.panes.length, 1);
            p.destroy();
        }
        this.doUpdate(UpdateType.resize);
        setTimeout(() => this.validateLayout(), 0);
    }

    private validateLayout() {
        let p = this.panes.length;
        while (p--) {
            if (this.panes.length === 1) break;
            if (this.panes[p].panels.length !== 0) continue;
            this.emit('destroy-pane', p, this.panes[p]);
            const pane = this.panes[p];
            this.panes.splice(p, 1);
            this.$bars[0].remove();
            this.$bars.splice(0, 1);
            pane.destroy();
            const w = this.$widths[p];
            this.$widths.splice(p, 1);
            if (p === 0)
                this.$widths[0] += w;
            else if (p >= this.panes.length)
                this.$widths[this.panes.length - 1] += w;
            else {
                this.$widths[p - 1] += w / 2;
                this.$widths[p] += w / 2;
            }
        }
        const t = this.$widths.reduce((acc, val) => { return acc + val; });
        if (t < 1.0 || t > 1.0)
            this.resizeWidths();
        this.doUpdate(UpdateType.resize);
    }

    public get hideTabstrip(): boolean {
        return this._hideTabs;
    }

    public set hideTabstrip(value: boolean) {
        if (this._hideTabs === value) return;
        this._hideTabs = value;
        let pl = this.panes.length;
        while (pl--)
            this.panes[pl].hideTabstrip = value;
    }

    public get dropDataFormat(): string {
        return this._dropDataFormat;
    }

    public set dropDataFormat(value: string) {
        if (this._dropDataFormat === value) return;
        this._dropDataFormat = value;
        let pl = this.panes.length;
        while (pl--)
            this.panes[pl].dropDataFormat = value;
    }

    public get useNativeMenus(): boolean {
        return this._useNativeMenus;
    }

    public set useNativeMenus(value: boolean) {
        if (this._useNativeMenus === value) return;
        this._useNativeMenus = value;
        let pl = this.panes.length;
        while (pl--)
            this.panes[pl].useNativeMenus = value;
    }

    public get active() {
        return this.$activePane.active;
    }
    public set active(value) {
        this.$activePane.active = value;
    }

    public get activePane() {
        return this.$activePane;
    }
    public set activePane(value) {
        this.$activePane = value;
    }

    public get panels() {
        return this.$activePane.panels;
    }
    public set panels(value) {
        this.$activePane.panels = value;
    }

    public dock(panel, dock, active?) {
        const oDock = panel.dock;
        oDock.removePanel(panel, true);
        dock.addPanels([panel]);
        const nIndex = dock.panels.indexOf(panel);
        this.emit('dock-changed', { panel: panel, oldDock: oDock, dock: dock, oldIndex: oDock, index: nIndex }, this.panes.indexOf(dock), this.panes.indexOf(oDock));
        if (active && dock !== this.$activePane) {
            this.$activePane.focused = false;
            this.$activePane = dock;
            this.$activePane.focused = true;
        }
        this.destroyPane(oDock);
    }

    public addPanel(title?: string, icon?: string, tooltip?: string, dock?) {
        if (dock)
            return dock.addPanel(title, icon, tooltip);
        return this.$activePane.addPanel(title, icon, tooltip);
    }

    public createPanel(title?: string, icon?: string, tooltip?: string, dock?) {
        if (dock)
            return dock.createPanel(title, icon, tooltip);
        return this.$activePane.createPanel(title, icon, tooltip);
    }

    public addPanels(panels: Panel[], dock?) {
        if (dock)
            return dock.addPanels(panels);
        return this.$activePane.addPanels(panels);

    }
    public removePanel(panel?, dock?, silent?) {
        if (typeof dock === 'boolean') {
            silent = dock;
            dock = null;
        }
        if (dock)
            dock.removePanel(panel, silent);
        else
            this.$activePane.removePanel(panel, silent);
    }
    public removeAllPanels(skipPanel?, dock?) {
        if (dock)
            dock.removeAllPanels(skipPanel);
        else
            this.$activePane.removeAllPanels(skipPanel);
    }
    public removeAllPanelsAfter(afterPanel?, dock?) {
        if (dock)
            dock.removeAllPanels(afterPanel);
        else this.$activePane.removeAllPanelsAfter(afterPanel);
    }
    public removeAllPanelsBefore(beforePanel?, dock?) {
        if (dock)
            dock.removeAllPanelsBefore(beforePanel);
        else
            this.$activePane.removeAllPanelsBefore(beforePanel);
    }
    public switchToPanelByIndex(idx, dock?) {
        if (dock)
            dock.switchToPanelByIndex(idx);
        else
            this.$activePane.switchToPanelByIndex(idx);
    }
    public switchToPanel(panel, dock?) {
        if (dock)
            dock.switchToPanel(panel);
        else if (panel.dock)
            panel.dock.switchToPanel(panel);
        else
            this.$activePane.switchToPanel(panel);
    }
    public setPanelTooltip(text: string, tab?, dock?) {
        if (dock)
            dock.setPanelTooltip(text, tab);
        else
            this.$activePane.setPanelTooltip(text, tab);
    }
    public setPanelTitle(text: string, tab?, noMenu?: boolean, dock?) {
        if (dock)
            dock.setPanelTitle(text, tab, noMenu);
        else
            this.$activePane.setPanelTitle(text, tab, noMenu);
    }
    public setPanelIconClass(icon: string, tab?, noMenu?: boolean, dock?) {
        if (dock)
            dock.setPanelIconClass(icon, tab, noMenu);
        else
            this.$activePane.setPanelIconClass(icon, tab, noMenu);
    }
    public setPanelIcon(icon: string, tab?, noMenu?: boolean, dock?) {
        if (dock)
            dock.setPanelIcon(icon, tab, noMenu);
        else
            this.$activePane.setPanelIcon(icon, tab, noMenu);
    }
    public getPanel(idx, dock?) {
        if (dock)
            return dock.getPanel(idx);
        return this.$activePane.getPanel(idx);
    }
    public getPanelIndex(tab, dock?) {
        return this.$activePane.getPanelIndex(tab);
    }
    public findPanel(id) {
        let p = this.panes.length;
        let panel;
        while (p--) {
            panel = this.panes[p].getPanel(id);
            if (panel) return panel;
        }
        return null;
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none || this._rTimeout)
            return;
        this._rTimeout = window.requestAnimationFrame(() => {
            if ((this._updating & UpdateType.resize) === UpdateType.resize) {
                this.resize();
                this._updating &= ~UpdateType.resize;
            }
            this._rTimeout = 0;
            this.doUpdate(this._updating);
        });
    }

    public resize() {
        let t = this.panes.length;
        const bWidth = (this.$bars.length * 4);
        let l = 0;
        let w = 0;
        for (; l < t; l++) {
            this.panes[l].width = this.$widths[l] * (this.$el.clientWidth - bWidth);
            this.panes[l].left = w;
            this.panes[l].doUpdate(UpdateType.resize);
            w += this.panes[l].width + 4;
        }
        t = this.$bars.length;
        while (t--) {
            this.$bars[t].style.left = this.panes[t + 1].left - 4 + 'px';
        }
        this.$width = this.$el.clientWidth;
        this.emit('resize');
    }

    public refresh(dock?) {
        if (dock)
            dock.refresh();
        else
            this.$activePane.refresh();
    }

    private destroyPane(pane) {
        if (this.panes.length > 1 && pane.panels.length === 0) {
            const idx = this.panes.indexOf(pane);
            if (this.$activePane === pane) {
                if (idx < this.panes.length - 1) {
                    this.focusPane(this.panes[idx + 1]);
                    if (this.active)
                        this.emit('activated', { index: this.$activePane.panels.indexOf(this.active), id: this.active.id, panel: this.active }, idx + 1);
                }
                else {
                    this.focusPane(this.panes[idx - 1]);
                    if (this.active)
                        this.emit('activated', { index: this.$activePane.panels.indexOf(this.active), id: this.active.id, panel: this.active }, idx - 1);
                }
            }
            this.emit('destroy-pane', idx, pane);
            this.panes.splice(idx, 1);
            this.$bars[0].remove();
            this.$bars.splice(0, 1);
            pane.destroy();
            this.$widths = [];
            let l = this.panes.length;
            const w = 1.0 / this.panes.length;
            while (l--)
                this.$widths[l] = w;
            this.resize();
        }
    }
}

export class DockPane extends EventEmitter {
    private $parent: HTMLElement;
    private $el: HTMLElement;
    public manager: DockManager;

    private $tabstrip: HTMLElement;
    private $tabPane: HTMLElement;
    public panels: Panel[] = [];

    public active: Panel;
    private _useNativeMenus: boolean = false;
    private _hideTabstrip: boolean = true;
    private $scrollLeft: HTMLAnchorElement;
    private $scrollRight: HTMLAnchorElement;
    private $scrollDropDown: HTMLButtonElement;
    private $scrollMenu: HTMLUListElement;

    private _updating: UpdateType = UpdateType.none;
    private _rTimeout = 0;
    private _scroll: number = 0;
    private _scrollTimer: NodeJS.Timeout;
    private $addCache = [];
    private $measure: HTMLElement;

    public dropDataFormat = 'dockmanger/tab';

    public set focused(value) {
        if (value)
            this.$el.classList.add('focused');
        else
            this.$el.classList.remove('focused');
    }
    public get focused() { return this.$el.classList.contains('focused'); }

    public set useNativeMenus(value) {
        if (value === this._useNativeMenus) return;
        this._useNativeMenus = value;
        if (this.$scrollDropDown) {
            if (value) {
                this.$scrollDropDown.classList.remove('dropdown-toggle');
                delete this.$scrollDropDown.dataset.toggle;
            }
            else {
                this.$scrollDropDown.classList.add('dropdown-toggle');
                this.$scrollDropDown.dataset.toggle = 'dropdown';
            }
        }
        if (this.$scrollMenu) {
            if (value)
                this.$scrollMenu.classList.remove('dropdown-menu');
            else
                this.$scrollMenu.classList.add('dropdown-menu');
        }
    }
    public get useNativeMenus() { return this._useNativeMenus; }

    public get hideTabstrip(): boolean {
        return this._hideTabstrip;
    }

    public set hideTabstrip(value: boolean) {
        if (this._hideTabstrip !== value) {
            this._hideTabstrip = value;
            this.doUpdate(UpdateType.stripState);
        }
    }

    public set width(value) {
        this.$el.style.width = `${value}px`;
    }

    public get width() {
        return this.$el.clientWidth;
    }

    public set tabstripHeight(value) {
        this.$tabstrip.style.height = `${value}px`;
    }

    public get tabstripHeight() {
        if (this.hideTabstrip)
            return 0;
        return Math.max(this.$tabstrip.offsetHeight, this.$tabstrip.clientHeight);
    }

    public set left(value) {
        if (!value)
            this.$el.style.left = `${value}`;
        else
            this.$el.style.left = `${value}px`;
    }

    public get left() {
        if (this.$el.style.left === '')
            return 0;
        return parseInt(this.$el.style.left, 10);
    }

    public get bounds() {
        return this.$el.getBoundingClientRect();
    }

    public get paneBounds() {
        return this.$tabPane.getBoundingClientRect();
    }

    public get pane() { return this.$tabPane; }

    constructor(container?: any) {
        super();

        if (container)
            this.setParent(container.container ? container.container : container);
        else
            this.setParent(document.body);

        window.addEventListener('resize', (e) => {
            this.doUpdate(UpdateType.resize);
        });
        window.addEventListener('load', () => {
            this.doUpdate(UpdateType.resize);
        });
        window.addEventListener('blur', () => { $('.dropdown.open').removeClass('open'); });
        this.$measure = document.createElement('div');
        this.$measure.classList.add('title');
        this.$parent.appendChild(this.$measure);
        this.$measure.style.position = 'absolute';
        this.$measure.style.left = '-10px';
        this.$measure.style.top = '-100px';
    }

    public resize() {
        let tl = this.panels.length;
        if (tl < 0)
            tl = 1;
        this.$scrollLeft.classList.add('hidden');
        this.$scrollRight.classList.add('hidden');
        this.$scrollDropDown.classList.add('hidden');
        let tWidth = 100;
        let w = 100;
        const m = this.$measure;
        for (let t = 0; t < tl; t++) {
            m.textContent = this.panels[t].title.textContent;
            //adjust for icon and close buttons
            tWidth = m.clientWidth + 54;
            if (tWidth > w)
                w = tWidth;
        }

        for (let t = 0; t < tl; t++) {
            this.panels[t].tab.style.width = `${w}px`;
            this.panels[t].title.style.maxWidth = `${w - 22}px`;
        }

        if (this.$tabstrip.scrollWidth > this.$el.clientWidth)
            this.$tabstrip.classList.add('scroll');
        else
            this.$tabstrip.classList.remove('scroll');
        if (this._scroll < 0)
            this._scroll = 0;
        if (this._scroll > this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth)
            this._scroll = this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth;
        this.updateScrollButtons();
    }

    public updateScrollButtons() {
        if (this.$tabstrip.scrollWidth > this.$el.clientWidth) {
            this.$scrollLeft.classList.remove('hidden');
            this.$scrollRight.classList.remove('hidden');
            this.$scrollDropDown.classList.remove('hidden');
            if (this.$tabstrip.scrollLeft === 0)
                this.$scrollLeft.classList.add('disabled');
            else
                this.$scrollLeft.classList.remove('disabled');
            if (this.$tabstrip.scrollLeft >= this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth) {
                this.$scrollRight.classList.add('disabled');
                this.$scrollDropDown.classList.add('single');
            }
            else {
                this.$scrollRight.classList.remove('disabled');
                this.$scrollDropDown.classList.remove('single');
            }
        }
        else {
            this.$tabstrip.classList.remove('scroll');
            this.$scrollLeft.classList.add('hidden');
            this.$scrollRight.classList.add('hidden');
            this.$scrollDropDown.classList.add('hidden');
            $('.dropdown.open').removeClass('open');
        }
        this.updateScrollMenu();
    }

    public setParent(parent?: string | JQuery | HTMLElement) {
        if (typeof parent === 'string') {
            if (parent.startsWith('#'))
                this.$parent = document.getElementById(parent.substr(1));
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

    public destroy() {
        if (this.$measure && this.$measure.parentElement)
            this.$measure.parentElement.removeChild(this.$measure);
        if (this.$el) {
            this.$el.removeChild(this.$tabstrip);
            this.$el.removeChild(this.$tabPane);
            this.$parent.removeChild(this.$el);
        }
    }

    private buildScrollMenu() {
        const tl = this.panels.length;
        if (this._useNativeMenus) {
            var c = [];
            for (let t = 0; t < tl; t++) {
                let icon = null;
                if (this.panels[t].iconSrc) {
                    if (this.panels[t].iconSrc.startsWith('data:'))
                        icon = nativeImage.createFromDataURL(this.panels[t].iconSrc).resize({ height: 16, quality: 'good' });
                    else
                        icon = nativeImage.createFromPath(this.panels[t].iconSrc).resize({ height: 16, quality: 'good' });
                }
                else if (this.panels[t].iconCls) {
                    const style = window.getComputedStyle(this.panels[t].icon);
                    if (process.platform === 'win32')
                        icon = nativeImage.createFromPath(style.backgroundImage.slice(13, -2).replace(/\//g, "\\")).resize({ height: 16, quality: 'good' });
                    else
                        icon = nativeImage.createFromPath(style.backgroundImage.slice(13, -2)).resize({ height: 16, quality: 'good' });
                }
                c.push({
                    label: this.panels[t].title.innerHTML,
                    click: `switchTab(${t})`,
                    icon: icon
                });
            }
            const rect = this.$scrollDropDown.getBoundingClientRect();
            window.showContext(c, { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
            return;
        }
        const menu = $(this.$scrollMenu);
        menu.empty();
        const w = this._scroll + this.$tabstrip.clientWidth - this.$scrollLeft.offsetWidth - this.$scrollRight.offsetWidth - this.$scrollDropDown.offsetWidth;
        const l = this._scroll + this.$scrollLeft.offsetWidth;
        for (let t = 0; t < tl; t++) {
            let icon = '';
            if (this.panels[t].iconSrc)
                icon = ` style="background-image: url(${this.panels[t].iconSrc})"`;
            if (this.panels[t].tab.offsetLeft + this.panels[t].tab.clientWidth >= l && this.panels[t].tab.offsetLeft < w)
                menu.append(`<li class="visible"><a title="${this.panels[t].tab.title}" href="#" data-index="${t}" class="visible ${this.panels[t].tab.className}"><div id="cm-scroll-dropdown-menu-${t}-icon" class="${this.panels[t].icon.className}"${icon}></div> <span id="cm-scroll-dropdown-menu-${t}-title">${this.panels[t].title.innerHTML}</span></a></li>`);
            else
                menu.append(`<li><a title="${this.panels[t].tab.title}" href="#" data-index="${t}" class="${this.panels[t].tab.className}"><div id="cm-scroll-dropdown-menu-${t}-icon" class="${this.panels[t].icon.className}"${icon}></div> <span id="cm-scroll-dropdown-menu-${t}-title">${this.panels[t].title.innerHTML}</span></a></li>`);
        }
    }

    private updateScrollMenu() {
        if (this._useNativeMenus)
            return;
        if (!this.$scrollMenu || this.$scrollMenu.children.length !== this.panels.length || this.$scrollMenu.children.length === 0 || !this.$scrollMenu.parentElement.classList.contains('open')) return;
        const tl = this.panels.length;
        const w = this._scroll + this.$tabstrip.clientWidth - this.$scrollLeft.offsetWidth - this.$scrollRight.offsetWidth - this.$scrollDropDown.offsetWidth;
        const l = this._scroll + this.$scrollLeft.offsetWidth;
        for (let t = 0; t < tl; t++) {
            if (this.panels[t].tab.offsetLeft + this.panels[t].tab.clientWidth >= l && this.panels[t].tab.offsetLeft < w)
                this.$scrollMenu.children[t].classList.add('visible');
            else
                this.$scrollMenu.children[t].classList.remove('visible');
        }
    }

    public createControl() {
        this.destroy();
        this.$el = document.createElement('div');
        this.$el.id = 'cm';
        this.$el.className = 'cm';
        this.$el.addEventListener('dragenter', (e) => {
            this.emit('dragenter', e);
            if (e.defaultPrevented)
                return;
        });
        this.$el.addEventListener('dragleave', (e) => {
            this.emit('dragleave', e);
            if (e.defaultPrevented)
                return;
        });
        this.$el.addEventListener('dragover', (e) => {
            this.emit('dragover', e);
            if (e.defaultPrevented)
                return;
        });
        this.$el.addEventListener('drop', (e) => {
            this.emit('drop', e);
            if (e.defaultPrevented)
                return;
        });
        this.$el.addEventListener('click', (e) => {
            this.emit('click', e);
        });
        this.$el.addEventListener('mouseup', (e) => {
            this.emit('mouseup', e);
        });
        this.$el.addEventListener('mousedown', (e) => {
            this.emit('mousedown', e);
        });
        this.$parent.appendChild(this.$el);

        this.$tabstrip = document.createElement('ul');
        this.$tabstrip.id = 'cm-tabstrip';
        this.$tabstrip.className = 'cm-tabstrip';
        this.$tabstrip.addEventListener('contextmenu', (e) => {
            this.emit('contextmenu');
            e.preventDefault();
            e.stopPropagation();
        });
        this.$tabstrip.addEventListener('wheel', (event) => {
            this._scroll += (event.deltaY || event.deltaX);
            if (this._scroll < 0)
                this._scroll = 0;
            else if (this._scroll > this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth)
                this._scroll = this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth;
            this.doUpdate(UpdateType.scroll);
        }, { passive: true });
        this.$scrollLeft = document.createElement('a');
        this.$scrollLeft.innerHTML = '<i class="fa fa-chevron-left"></i>';
        this.$scrollLeft.id = 'cm-scroll-left';
        this.$scrollLeft.href = 'javascript:void(0)';
        this.$scrollLeft.onmousedown = (e) => {
            if (e.button !== 0)
                return;
            if (this._scroll > 0)
                this.scrollTabs(-16);
        };
        this.$scrollLeft.ondragenter = e => {
            if (e.dataTransfer.types && e.dataTransfer.types.indexOf(this.dropDataFormat) !== -1) 
                this.scrollTabs(-16);
        };
        this.$scrollLeft.ondragleave = e => {
            if (e.dataTransfer.types && e.dataTransfer.types.indexOf(this.dropDataFormat) !== -1) 
                clearTimeout(this._scrollTimer);            
        };
        this.$scrollLeft.onmouseup = (e) => {
            clearTimeout(this._scrollTimer);
        };
        this.$scrollLeft.onmouseleave = (e) => {
            clearTimeout(this._scrollTimer);
        };
        this.$scrollLeft.classList.add('hidden');
        this.$el.appendChild(this.$scrollLeft);
        this.$scrollRight = document.createElement('a');
        this.$scrollRight.innerHTML = '<i class="fa fa-chevron-right"></i>';
        this.$scrollRight.id = 'cm-scroll-right';
        this.$scrollRight.href = 'javascript:void(0)';
        this.$scrollRight.onmousedown = (e) => {
            if (e.button !== 0)
                return;
            if (this._scroll < this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth)
                this.scrollTabs(16);
        };
        this.$scrollRight.onmouseup = (e) => {
            clearTimeout(this._scrollTimer);
        };
        this.$scrollRight.onmouseleave = (e) => {
            clearTimeout(this._scrollTimer);
        };

        this.$scrollRight.ondragenter = e => {
            if (e.dataTransfer.types && e.dataTransfer.types.indexOf(this.dropDataFormat) !== -1) 
                this.scrollTabs(16);
        };
        this.$scrollRight.ondragleave = e => {
            if (e.dataTransfer.types && e.dataTransfer.types.indexOf(this.dropDataFormat) !== -1) 
                clearTimeout(this._scrollTimer);            
        };        
        this.$scrollRight.classList.add('hidden');
        this.$el.appendChild(this.$scrollRight);

        const d = document.createElement('div');
        d.classList.add('dropdown');
        d.id = 'cm-scroll-dropdown-container';

        this.$scrollDropDown = document.createElement('button');
        this.$scrollDropDown.innerHTML = '<i class="fa fa-caret-down"></i>';
        this.$scrollDropDown.id = 'cm-scroll-dropdown';
        this.$scrollDropDown.classList.add('dropdown-toggle', 'hidden');
        this.$scrollDropDown.dataset.toggle = 'dropdown';
        this.$scrollDropDown.setAttribute('aria-haspopup', 'true');
        this.$scrollDropDown.setAttribute('aria-expanded', 'true');
        this.$scrollDropDown.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.buildScrollMenu();
            //$(this.$scrollDropDown).trigger('click.bs.dropdown');
        };
        d.appendChild(this.$scrollDropDown);

        this.$scrollMenu = document.createElement('ul');
        this.$scrollMenu.id = 'cm-scroll-menu';
        this.$scrollMenu.dataset.container = 'body';
        this.$scrollMenu.classList.add('dropdown-menu', 'pull-right');
        this.$scrollMenu.setAttribute('aria-labelledby', 'cm-scroll-dropdown');
        this.$scrollMenu.onclick = (e) => {
            let el;
            if (!e.target)
                return;
            el = e.target;
            if (el.tagName !== 'A')
                el = el.parentNode;
            if (!el.dataset || !el.dataset.index)
                return;
            this.switchToPanelByIndex(parseInt(el.dataset.index, 10));
        };
        d.appendChild(this.$scrollMenu);
        this.$el.appendChild(d);
        this.$el.appendChild(this.$tabstrip);

        this.$tabPane = document.createElement('div');
        this.$tabPane.id = 'cm-tabpane';
        this.$tabPane.className = 'cm-tabpane-container';
        this.$el.appendChild(this.$tabPane);
        if (this.panels.length > 0) {
            const tl = this.panels.length;
            for (let t = 0; t < tl; t++) {
                this.$tabstrip.appendChild(this.panels[t].tab);
                this.$tabPane.appendChild(this.panels[t].pane);
            }
            if (!this.active)
                this.switchToPanelByIndex(this.panels.length - 1);
        }
        this.$scrollMenu.style.maxHeight = (this.$tabPane.clientHeight - 4) + 'px';
        this.doUpdate(UpdateType.stripState);
        $('.dropdown-toggle').dropdown();
    }

    private scrollTabs(amt) {
        this._scrollTimer = setTimeout(() => {
            this._scroll += amt;
            if (this._scroll < 0)
                this._scroll = 0;
            else if (this._scroll > this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth)
                this._scroll = this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth;
            else
                this.scrollTabs(amt);
            this.doUpdate(UpdateType.scroll);
        }, 100);
    }

    private scrollToTab(panel?) {
        if (!panel)
            panel = this.active;
        else
            panel = this.getPanel(panel);
        if (!panel) return;
        const idx = this.getPanelIndex(panel);
        if (idx === -1) return;
        let i = 0;
        //Formula should be width - padding + borders, calculate padding/border sizes
        i = idx * (panel.tab.clientWidth - 8);
        if (i <= this._scroll) {
            this._scroll = i - 10;
        }
        else {
            i += panel.tab.clientWidth - 8;
            //58 is tab strip right padding + width of scroll button + shadow width + drop down with
            if (i >= this._scroll + this.$tabstrip.clientWidth - 58)
                this._scroll = i + 58 - this.$tabstrip.clientWidth;
        }
        this.doUpdate(UpdateType.scroll);
    }

    private newPanel(title?: string | PanelOptions, icon?: string, tooltip?: string) {
        var options: PanelOptions = {};
        if (typeof title === 'string' || title instanceof String)
            options = { title: <string>title, icon: icon, tooltip: tooltip };
        else
            options = title || {};
        const panel: Panel = {
            tab: document.createElement('li'),
            pane: document.createElement('div'),
            id: --this.manager.panelID,
            title: document.createElement('div'),
            icon: document.createElement('div'),
            iconCls: options.icon || options.iconCls || 'disconnected-icon',
            iconSrc: options.iconSrc,
            isPanel: true,
            dock: null
        };

        panel.tab.id = 'cm-tab' + panel.id;
        panel.tab.tabIndex = 0;
        panel.tab.classList.add('cm-tab');
        panel.tab.draggable = true;
        panel.icon.draggable = false;
        panel.title.draggable = false;
        panel.tab.appendChild(panel.icon);
        panel.tab.appendChild(panel.title);
        panel.tab.onclick = () => {
            const e = { id: panel.id, panel: panel, preventDefault: false };
            panel.dock.emit('tab-click', e);
            if (e.preventDefault || panel.dock.active === panel) return;
            panel.dock.switchToPanel(panel);
        };
        panel.tab.oncontextmenu = (e) => {
            panel.dock.emit('tab-contextmenu', { id: panel.id, panel: panel }, e);
            e.preventDefault();
            e.stopPropagation();
        };
        panel.tab.ondblclick = (e) => {
            panel.dock.emit('tab-dblclick', { id: panel.id, panel: panel });
        };
        panel.tab.ondragstart = (e) => {
            e.dataTransfer.dropEffect = 'move';
            e.dataTransfer.effectAllowed = 'move';
            const data: any = {};
            for (let prop in panel) {
                if (!Object.prototype.hasOwnProperty.call(panel, prop))
                    continue;
                if (typeof panel[prop] === 'object' && !Array.isArray(panel[prop])) continue;
                data[prop] = panel[prop];
            }
            var bounds = panel.tab.getBoundingClientRect();
            data.offset = { x: Math.ceil(bounds.left + (window.outerWidth - document.body.offsetWidth)), y: Math.ceil(bounds.top + (window.outerHeight - document.body.offsetHeight)) };
            e.dataTransfer.setData(this.dropDataFormat, JSON.stringify(data));
            const eDrag = { id: panel.id, panel: panel, preventDefault: false, event: e };
            panel.dock.emit('tab-drag', eDrag);
            if (eDrag.preventDefault) return;
            if (panel.dock.active !== panel)
                panel.dock.switchToPanel(panel);
            panel.dock.manager.dragPanel = panel;
            e.stopPropagation();
            panel.dock.manager.freezePanes();
        };
        panel.tab.ondragover = (e) => {
            const eDrag = { id: panel.id, panel: panel, preventDefault: false, event: e };
            panel.dock.emit('tab-drag-over', eDrag);
            if (eDrag.preventDefault) return;
            if (panel.dock.manager.dragPanel === panel) {
                e.dataTransfer.dropEffect = 'none';
                e.dataTransfer.effectAllowed = 'none';
                return;
            }
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            e.stopPropagation();
        };
        panel.tab.ondragend = (e) => {
            const eDrag = { id: panel.id, panel: panel, preventDefault: false, event: e };
            panel.dock.emit('tab-drag-end', eDrag);
            if (eDrag.preventDefault) return;
            if (panel.dock.manager.dragPanel !== panel)
                e.dataTransfer.dropEffect = 'move';
            panel.tab.classList.remove('drop');
            panel.dock.manager.dragPanel = null;
            panel.dock.manager.dragPanel = null;
            panel.dock.manager.freePanes();
        };
        panel.tab.ondragenter = (e) => {
            const eDrag = { id: panel.id, tab: panel, preventDefault: false, event: e };
            panel.dock.emit('tab-drag-enter', eDrag);
            if (eDrag.preventDefault) return;
            if (panel.dock.manager.dragPanel === panel) {
                e.dataTransfer.dropEffect = 'none';
                e.dataTransfer.effectAllowed = 'none';
                return;
            }
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            e.stopPropagation();
            panel.tab.classList.add('drop');
        };
        panel.tab.ondragleave = (e) => {
            const eDrag = { id: panel.id, tab: panel, preventDefault: false, event: e };
            panel.dock.emit('tab-drag-leave', eDrag);
            if (eDrag.preventDefault) return;
            if (panel.dock.manager.dragPanel === panel) return;
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            e.stopPropagation();
            panel.tab.classList.remove('drop');
            e.dataTransfer.dropEffect = 'move';
        };
        panel.tab.ondrop = (e) => {
            const eDrag = { id: panel.id, panel: panel, preventDefault: false, event: e };
            panel.dock.emit('tab-drop', eDrag);
            if (eDrag.preventDefault || !panel.dock.manager.dragPanel) return;
            if (panel.dock.manager.dragPanel === panel) return;
            panel.tab.classList.remove('drop');
            e.dataTransfer.dropEffect = 'move';
            let tl = -1;
            if (panel.dock !== this.manager.dragPanel.dock) {
                tl = panel.dock.panels.length - 1;
                this.manager.dock(this.manager.dragPanel, panel.dock, true);
            }
            e.preventDefault();
            e.stopPropagation();
            const idx = panel.dock.panels.indexOf(panel.dock.manager.dragPanel);
            const idxTo = panel.dock.panels.indexOf(panel);
            panel.dock.panels.splice(idx, 1);
            panel.dock.panels.splice(idxTo, 0, panel.dock.manager.dragPanel);
            if (idxTo > idx || (idxTo === tl && tl !== -1)) {
                if (panel.tab.nextElementSibling)
                    panel.tab.parentNode.insertBefore(panel.dock.manager.dragPanel.tab, panel.tab.nextElementSibling);
                else
                    panel.tab.parentNode.appendChild(panel.dock.manager.dragPanel.tab);
            }
            else
                panel.tab.parentNode.insertBefore(panel.dock.manager.dragPanel.tab, panel.tab);
            panel.dock.emit('tab-moved', { oldIndex: idx, index: idxTo, id: panel.dock.manager.dragPanel.id, panel: panel.dock.manager.dragPanel, event: e });
            panel.dock.manager.freePanes();
        };

        const close = document.createElement('i');
        close.classList.add('close', 'fa', 'fa-times');
        close.draggable = false;
        close.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            panel.dock.removePanel(panel);
        };
        panel.tab.appendChild(close);

        panel.pane.id = 'cm-tabpane' + panel.id;
        panel.pane.classList.add('cm-tabpane');
        panel.title.classList.add('title');
        panel.icon.classList.add('icon');
        panel.title.innerHTML = options.title;;
        panel.title.title = options.tooltip;;
        panel.tab.title = options.tooltip;;
        if (panel.iconCls) {
            panel.icon.classList.add(...panel.iconCls.split(' '));
            panel.icon.style.backgroundImage = '';
            panel.icon.style.backgroundImage = '';
            panel.iconSrc = 0;
        }
        else if (panel.iconSrc) {
            panel.iconCls = '';
            panel.iconSrc = options.iconSrc;
            panel.icon.style.backgroundImage = `url(${options.iconSrc})`;
        }
        return panel;
    }

    public addPanel(title?: string | PanelOptions, icon?: string, tooltip?: string) {
        var options: PanelOptions = {};
        if (typeof title === 'string' || title instanceof String)
            options = { title: <string>title, icon: icon, tooltip: tooltip };
        else
            options = title || {};
        $('.dropdown.open').removeClass('open');
        const panel = this.newPanel(options);
        panel.dock = this;
        this.$addCache.push(panel);
        this.panels.push(panel);
        this.switchToPanelByIndex(this.panels.length - 1);
        //this.setPanelTitle(title || '', undefined, false);
        //this.setPanelIconClass(panel.iconCls);
        //this.setPanelTooltip(tooltip || '');
        this.emit('add', { index: this.panels.length - 1, id: panel.id, panel: panel });
        this.doUpdate(UpdateType.resize | UpdateType.stripState | UpdateType.batchAdd);
        return panel;
    }

    public createPanel(title?: string | PanelOptions, icon?: string, tooltip?: string) {
        var options: PanelOptions = {};
        if (typeof title === 'string' || title instanceof String)
            options = { title: <string>title, icon: icon, tooltip: tooltip };
        else
            options = title || {};
        $('.dropdown.open').removeClass('open');
        const panel = this.newPanel(options);
        //this.setPanelTitle(title || '', tab, true);
        //this.setPanelIconClass(panel.iconCls, panel, true);
        //this.setPanelTooltip(tooltip || '', tab);
        return panel;
    }

    public insertPanel(idx: number, title?: string | PanelOptions, icon?: string, tooltip?: string) {
        var options: PanelOptions = {};
        if (typeof title === 'string' || title instanceof String)
            options = { title: <string>title, icon: icon, tooltip: tooltip };
        else
            options = title || {};
        $('.dropdown.open').removeClass('open');
        const panel = this.newPanel(options);
        panel.dock = this;
        if (idx >= this.panels.length) {
            this.$tabstrip.appendChild(panel.tab);
            this.$tabPane.appendChild(panel.tab);
            this.panels.push(panel);
        }
        else {
            this.$tabstrip.insertBefore(panel.tab, this.panels[idx].tab);
            this.$tabPane.insertBefore(panel.tab, this.panels[idx].pane);
            this.panels.splice(idx, 0, panel);
        }
        this.switchToPanelByIndex(idx);
        //this.setPanelTitle(title || '', undefined, false);
        this.setPanelIconClass(panel.iconCls);
        //this.setPanelTooltip(tooltip || '');
        this.emit('add', { index: idx, id: panel.id, panel: panel });
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
        return panel;
    }

    public addPanels(panels: Panel[], current?: number) {
        if (!panels || panels.length === 0) return;
        let p = 0;
        const pl = panels.length;
        const ts = document.createDocumentFragment();
        const tp = document.createDocumentFragment();
        let cl = this.panels.length;
        this.panels = this.panels.concat(panels);
        for (; p < pl; p++) {
            const panel = panels[p];
            panel.dock = this;
            ts.appendChild(panel.tab);
            tp.appendChild(panel.pane);
            this.emit('add', { index: cl, id: panel.id, panel: panel });
            cl++;
        }
        this.$tabstrip.appendChild(ts);
        this.$tabPane.appendChild(tp);
        if (typeof current !== 'undefined')
            this.switchToPanelByIndex(current);
        else
            this.switchToPanelByIndex(this.panels.length - 1);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public removePanel(panel?, silent?) {
        if (panel === undefined)
            panel = this.active;
        else
            panel = this.getPanel(panel);
        if (!panel) return;
        let idx = this.getPanelIndex(panel);
        if (idx === -1) return;
        const e = { index: idx, id: panel.id, panel: panel, cancel: false };
        if (!silent)
            this.emit('remove', e);
        if (e.cancel)
            return;
        $('.dropdown.open').removeClass('open');
        this.$tabstrip.removeChild(panel.tab);
        this.$tabPane.removeChild(panel.pane);
        this.panels.splice(idx, 1);
        if (this.panels.length === 0)
            this.active = null;
        else if (panel.id === this.active.id) {
            if (idx >= this.panels.length)
                idx--;
            this.switchToPanelByIndex(idx);
        }
        if (!silent)
            this.emit('removed', { index: idx, id: panel.id, panel: panel });
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public removeAllPanels(skipPanel?) {
        const tl = this.panels.length;
        let idx;
        let e;
        let panel;
        if (skipPanel)
            skipPanel = this.getPanelIndex(skipPanel);
        for (idx = tl - 1; idx >= 0; idx--) {
            if (idx === skipPanel) continue;
            panel = this.panels[idx];
            e = { index: idx, id: panel.id, panel: panel, cancel: false };
            this.emit('remove', e);
            if (e.cancel)
                continue;
            if (panel === this.active)
                this.active = null;
            this.$tabstrip.removeChild(panel.tab);
            this.$tabPane.removeChild(panel.pane);
            this.panels.splice(idx, 1);
            this.emit('removed', { index: idx, id: panel.id, panel: panel });
        }
        $('.dropdown.open').removeClass('open');
        if (this.panels.length === 0)
            this.active = null;
        else if (!this.active)
            this.switchToPanelByIndex(skipPanel || 0);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public removeAllPanelsAfter(afterPanel?) {
        let idx;
        let e;
        let panel;
        if (afterPanel === undefined)
            afterPanel = this.active;
        const tl = this.getPanelIndex(afterPanel);
        if (tl === -1)
            return;
        idx = this.panels.length - 1;
        for (; idx > tl; idx--) {
            panel = this.panels[idx];
            e = { index: idx, id: panel.id, panel: panel, cancel: false };
            this.emit('remove', e);
            if (e.cancel)
                continue;
            if (panel === this.active)
                this.active = null;
            this.$tabstrip.removeChild(panel.tab);
            this.$tabPane.removeChild(panel.pane);
            this.panels.splice(idx, 1);
            this.emit('removed', { index: idx, id: panel.id, panel: panel });
        }
        $('.dropdown.open').removeClass('open');
        if (this.panels.length === 0)
            this.active = null;
        else if (!this.active)
            this.switchToPanel(afterPanel);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public removeAllPanelsBefore(beforePanel?) {
        const tl = this.panels.length;
        let idx;
        let e;
        let panel;
        if (beforePanel === undefined)
            beforePanel = this.active;
        beforePanel = this.getPanelIndex(beforePanel);
        if (beforePanel === -1)
            return;
        idx = beforePanel - 1;
        for (; idx >= 0; idx--) {
            panel = this.panels[idx];
            e = { index: idx, id: panel.id, panel: panel, cancel: false };
            this.emit('remove', e);
            if (e.cancel)
                continue;
            if (panel === this.active)
                this.active = null;
            this.$tabstrip.removeChild(panel.tab);
            this.$tabPane.removeChild(panel.pane);
            this.panels.splice(idx, 1);
            this.emit('removed', { index: idx, id: panel.id, panel: panel });
        }
        $('.dropdown.open').removeClass('open');
        if (this.panels.length === 0)
            this.active = null;
        else if (!this.active)
            this.switchToPanel(beforePanel);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public switchToPanelByIndex(idx) {
        if (idx < 0 || idx >= this.panels.length)
            return;
        if (this.active) {
            this.active.tab.classList.remove('active');
            this.active.pane.classList.remove('active');
            this.emit('deactivated', { index: this.getPanelIndex(this.active), id: this.active.id, panel: this.active });
        }
        this.active = this.panels[idx];
        this.active.tab.classList.add('active');
        this.active.pane.classList.add('active');
        this.emit('activated', { index: idx, id: this.active.id, panel: this.active });
        this.active.tab.focus();
        this.$tabstrip.scrollTop = 0;
        this.doUpdate(UpdateType.scrollToTab);
    }

    public switchToPanel(panel) {
        panel = this.getPanel(panel);
        if (!panel) return;
        if (this.active) {
            this.active.tab.classList.remove('active');
            this.active.pane.classList.remove('active');
            this.emit('deactivated', { index: this.getPanelIndex(this.active), id: this.active.id, panel: this.active });
        }
        this.active = panel;
        this.active.tab.classList.add('active');
        this.active.pane.classList.add('active');
        this.emit('activated', { index: this.getPanelIndex(this.active), id: this.active.id, panel: this.active });
        this.active.tab.focus();
        this.$tabstrip.scrollTop = 0;
        this.doUpdate(UpdateType.scrollToTab);
    }

    public setPanelTooltip(text: string, tab?) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getPanel(tab);
        if (!tab) return;
        tab.title.title = text;
        tab.tab.title = text;
    }

    public setPanelTitle(text: string, tab?, noMenu?: boolean) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getPanel(tab);
        if (!tab) return;
        tab.title.innerHTML = text;
        if (!noMenu) return;
        const idx = this.getPanelIndex(tab);
        $(`#cm-scroll-dropdown-menu-${idx}-title`).html(text);
        this.doUpdate(UpdateType.resize);
    }

    public setPanelIconClass(icon: string, tab?, noMenu?: boolean) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getPanel(tab);
        if (!tab) return;
        if (tab.iconCls && tab.iconCls.length !== 0)
            tab.icon.classList.remove(...tab.iconCls.split(' '));
        tab.icon.classList.add(...icon.split(' '));
        tab.icon.style.backgroundImage = '';
        tab.icon.style.backgroundImage = '';
        tab.iconCls = icon;
        tab.iconSrc = 0;
        if (!noMenu) return;
        const idx = this.getPanelIndex(tab);
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).removeClass();
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).addClass(tab.icon.className);
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).css('background-image', '');
        this.doUpdate(UpdateType.resize);
    }

    public setPanelIcon(icon: string, tab?, noMenu?: boolean) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getPanel(tab);
        if (!tab) return;
        if (tab.iconCls && tab.iconCls.length !== 0)
            tab.icon.classList.remove(...tab.iconCls.split(' '));
        tab.iconCls = '';
        tab.iconSrc = icon;
        tab.icon.style.backgroundImage = `url(${icon})`;
        if (!noMenu) return;
        const idx = this.getPanelIndex(tab);
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).removeClass();
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).css('background-image', `url(${icon})`);
        this.doUpdate(UpdateType.resize);
    }

    public getPanel(idx) {
        const tl = this.panels.length;
        let t;
        if (typeof idx !== 'number') {
            if (!idx)
                return null;
            if (idx.isPanel)
                return idx;
            for (t = 0; t < tl; t++) {
                if (this.panels[t] === idx)
                    return this.panels[t];
                if (this.panels[t].tab === idx)
                    return this.panels[t];
                if (this.panels[t].pane === idx)
                    return this.panels[t];
            }
            return null;
        }
        else if (idx < 0 || idx >= this.panels.length) {
            for (t = 0; t < tl; t++) {
                if (this.panels[t].id === idx)
                    return this.panels[t];
            }
            return null;
        }
        return this.panels[idx];
    }

    public getPanelIndex(tab) {
        const tl = this.panels.length;
        let t;
        if (typeof tab !== 'number') {
            for (t = 0; t < tl; t++) {
                if (this.panels[t] === tab)
                    return t;
                if (this.panels[t].tab === tab)
                    return t;
                if (this.panels[t].pane === tab)
                    return t;
                if (this.panels[t].id === tab)
                    return t;
            }
            return -1;
        }
        for (t = 0; t < tl; t++) {
            if (this.panels[t].id === tab)
                return t;
        }
        return -1;
    }

    private updateStripState() {
        if (!this._hideTabstrip && this.panels.length === 0) {
            if (!this.$tabstrip.classList.contains('hidden')) {
                this.$tabstrip.classList.add('hidden');
                this.$tabPane.classList.add('full');
                this.emit('tab-strip-hidden');
            }
        }
        else if (!this._hideTabstrip || this.panels.length > 1) {
            if (this.$tabstrip.classList.contains('hidden')) {
                this.$tabstrip.classList.remove('hidden');
                this.$tabPane.classList.remove('full');
                this.emit('tab-strip-shown');
            }
        }
        else if (!this.$tabstrip.classList.contains('hidden')) {
            this.$tabstrip.classList.add('hidden');
            this.$tabPane.classList.add('full');
            this.emit('tab-strip-hidden');
        }
    }

    public doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none || this._rTimeout)
            return;
        this._rTimeout = window.requestAnimationFrame(() => {
            if ((this._updating & UpdateType.batchAdd) === UpdateType.batchAdd) {
                this.batchAdd();
                this._updating &= ~UpdateType.batchAdd;
            }
            if ((this._updating & UpdateType.stripState) === UpdateType.stripState) {
                this.updateStripState();
                this._updating &= ~UpdateType.stripState;
            }
            if ((this._updating & UpdateType.resize) === UpdateType.resize) {
                this.resize();
                this.$scrollMenu.style.maxHeight = (this.$tabPane.clientHeight - 4) + 'px';
                this.$tabstrip.scrollLeft = this._scroll;
                this.updateScrollButtons();
                this._updating &= ~UpdateType.resize;
                this._updating &= ~UpdateType.scroll;
            }
            if ((this._updating & UpdateType.scroll) === UpdateType.scroll) {
                this.$tabstrip.scrollLeft = this._scroll;
                this.updateScrollButtons();
                this._updating &= ~UpdateType.scroll;
            }
            if ((this._updating & UpdateType.scrollToTab) === UpdateType.scrollToTab) {
                this.scrollToTab();
                this._updating &= ~UpdateType.scrollToTab;
            }
            this._rTimeout = 0;
            this.doUpdate(this._updating);
        });
    }

    private batchAdd() {
        if (this.$addCache.length === 0) return;
        let p = 0;
        const pl = this.$addCache.length;
        const ts = document.createDocumentFragment();
        const tp = document.createDocumentFragment();
        for (; p < pl; p++) {
            ts.appendChild(this.$addCache[p].tab);
            tp.appendChild(this.$addCache[p].pane);
        }
        this.$tabstrip.appendChild(ts);
        this.$tabPane.appendChild(tp);
        this.$addCache = [];
        this.switchToPanelByIndex(this.panels.length - 1);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public refresh() {
        this.batchAdd();
        this.updateStripState();
        this.updateScrollButtons();
        this.updateScrollButtons();
    }
}