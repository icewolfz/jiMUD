//spellchecker:ignore dropdown dropdownmenu tabpane
import EventEmitter = require('events');
import { ipcRenderer, nativeImage } from 'electron';

export enum UpdateType {
    none = 0,
    resize = 1,
    scroll = 2,
    scrollToTab = 4,
    stripState = 8,
    batchAdd = 16
}

export interface Tab {
    tab: HTMLElement;
    id: number;
    icon: HTMLElement;
    title: HTMLElement;
    iconCls: string;
    iconSrc?;
    isTab: boolean;
}

export interface TabOptions {
    title?: string;
    icon?: string;
    iconCls?: string;
    iconSrc?: string;
    tooltip?: string;
    noActivate?: boolean;
    silent?: boolean;
}

export class TabStrip extends EventEmitter {
    private $parent: HTMLElement;
    private $el: HTMLElement;

    private $tabstrip: HTMLElement;
    public tabs: Tab[] = [];
    public dragTab;

    public active: Tab;
    private _useNativeMenus: boolean = false;
    private _hideTabstrip: boolean = true;
    private $scrollLeft: HTMLAnchorElement;
    private $scrollRight: HTMLAnchorElement;
    private $scrollDropDown: HTMLButtonElement;
    private $scrollMenu: HTMLUListElement;

    private _updating: UpdateType = UpdateType.none;
    private _scroll: number = 0;
    private _scrollTimer: NodeJS.Timer;
    private $addCache = [];
    private $measure: HTMLElement;

    private _tabID = 0;

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

    public set height(value) {
        this.$tabstrip.style.height = `${value}px`;
    }

    public get height() {
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
        return this.$tabstrip.getBoundingClientRect();
    }

    public get containerBounds() {
        return this.$el.getBoundingClientRect();
    }

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
        let tl = this.tabs.length;
        if (tl < 0)
            tl = 1;
        this.$scrollLeft.classList.add('hidden');
        this.$scrollRight.classList.add('hidden');
        this.$scrollDropDown.classList.add('hidden');
        let tWidth = 200;
        let w = 200;
        const m = this.$measure;
        for (let t = 0; t < tl; t++) {
            m.textContent = this.tabs[t].title.textContent;
            //adjust for icon and close buttons
            tWidth = m.clientWidth + 54;
            if (tWidth > w)
                w = tWidth;
        }

        for (let t = 0; t < tl; t++) {
            this.tabs[t].tab.style.maxWidth = `${w}px`;
            //this.tabs[t].title.style.maxWidth = `${w - 22}px`;
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
            this.$parent.removeChild(this.$el);
        }
    }

    private buildScrollMenu() {
        const tl = this.tabs.length;
        if (this._useNativeMenus) {
            var c = [];
            for (let t = 0; t < tl; t++) {
                let icon = null;
                if (this.tabs[t].iconSrc) {
                    if (this.tabs[t].iconSrc.startsWith('data:'))
                        icon = nativeImage.createFromDataURL(this.tabs[t].iconSrc).resize({ height: 16, quality: 'good' });
                    else
                        icon = nativeImage.createFromPath(this.tabs[t].iconSrc).resize({ height: 16, quality: 'good' });
                }
                else if (this.tabs[t].iconCls) {
                    const style = window.getComputedStyle(this.tabs[t].icon);
                    if (process.platform === 'win32')
                        icon = nativeImage.createFromPath(style.backgroundImage.slice(13, -2).replace(/\//g, "\\")).resize({ height: 16, quality: 'good' });
                    else
                        icon = nativeImage.createFromPath(style.backgroundImage.slice(13, -2)).resize({ height: 16, quality: 'good' });
                }
                c.push({
                    label: this.tabs[t].title.innerHTML,
                    click: `switchTab(${t})`,
                    icon: icon
                });
            }
            const rect = this.$scrollDropDown.getBoundingClientRect();
            ipcRenderer.invoke('show-context', c, { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
            return;
        }
        const menu = $(this.$scrollMenu);
        menu.empty();
        const w = this._scroll + this.$tabstrip.clientWidth - this.$scrollLeft.offsetWidth - this.$scrollRight.offsetWidth - this.$scrollDropDown.offsetWidth;
        const l = this._scroll + this.$scrollLeft.offsetWidth;
        for (let t = 0; t < tl; t++) {
            let icon = '';
            if (this.tabs[t].iconSrc)
                icon = ` style="background-image: url(${this.tabs[t].iconSrc})"`;
            if (this.tabs[t].tab.offsetLeft + this.tabs[t].tab.clientWidth >= l && this.tabs[t].tab.offsetLeft < w)
                menu.append(`<li class="visible"><a title="${this.tabs[t].tab.title}" href="#" data-index="${t}" class="visible ${this.tabs[t].tab.className}"><div id="cm-scroll-dropdown-menu-${t}-icon" class="${this.tabs[t].icon.className}"${icon}></div> <span id="cm-scroll-dropdown-menu-${t}-title">${this.tabs[t].title.innerHTML}</span></a></li>`);
            else
                menu.append(`<li><a title="${this.tabs[t].tab.title}" href="#" data-index="${t}" class="${this.tabs[t].tab.className}"><div id="cm-scroll-dropdown-menu-${t}-icon" class="${this.tabs[t].icon.className}"${icon}></div> <span id="cm-scroll-dropdown-menu-${t}-title">${this.tabs[t].title.innerHTML}</span></a></li>`);
        }
    }

    private updateScrollMenu() {
        if (this._useNativeMenus)
            return;
        if (!this.$scrollMenu || this.$scrollMenu.children.length !== this.tabs.length || this.$scrollMenu.children.length === 0 || !this.$scrollMenu.parentElement.classList.contains('open')) return;
        const tl = this.tabs.length;
        const w = this._scroll + this.$tabstrip.clientWidth - this.$scrollLeft.offsetWidth - this.$scrollRight.offsetWidth - this.$scrollDropDown.offsetWidth;
        const l = this._scroll + this.$scrollLeft.offsetWidth;
        for (let t = 0; t < tl; t++) {
            if (this.tabs[t].tab.offsetLeft + this.tabs[t].tab.clientWidth >= l && this.tabs[t].tab.offsetLeft < w)
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
            this.switchToTabByIndex(parseInt(el.dataset.index, 10));
        };
        d.appendChild(this.$scrollMenu);
        this.$el.appendChild(d);
        this.$el.appendChild(this.$tabstrip);

        if (this.tabs.length > 0) {
            const tl = this.tabs.length;
            for (let t = 0; t < tl; t++) {
                this.$tabstrip.appendChild(this.tabs[t].tab);
            }
            if (!this.active)
                this.switchToTabByIndex(this.tabs.length - 1);
        }
        this.$scrollMenu.style.maxHeight = (this.$parent.clientHeight - 4) + 'px';
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

    private scrollToTab(tab?) {
        if (!tab)
            tab = this.active;
        else
            tab = this.getTab(tab);
        if (!tab) return;
        const idx = this.getTabIndex(tab);
        if (idx === -1) return;
        let i = 0;
        //TODO formula should be width - padding + borders, calculate padding/border sizes
        i = idx * (tab.tab.clientWidth - 8);
        if (i <= this._scroll) {
            this._scroll = i - 10;
        }
        else {
            i += tab.tab.clientWidth - 8;
            //50 is tab strip right padding + width of scroll button + shadow width + drop down with
            if (i >= this._scroll + this.$tabstrip.clientWidth - 58)
                this._scroll = i + 58 - this.$tabstrip.clientWidth;
        }
        this.doUpdate(UpdateType.scroll);
    }

    private newTab(title?: string | TabOptions, icon?: string, tooltip?: string) {
        var options: TabOptions = {};
        if (typeof title === 'string' || title instanceof String)
            options = { title: <string>title, icon: icon, tooltip: tooltip || <string>title || '' };
        else
            options = title || {};
        const tab: Tab = {
            tab: document.createElement('li'),
            id: --this._tabID,
            title: document.createElement('div'),
            icon: document.createElement('div'),
            iconCls: options.icon || options.iconCls || 'disconnected-icon',
            iconSrc: options.iconSrc,
            isTab: true
        };

        tab.tab.id = 'cm-tab' + tab.id;
        tab.tab.tabIndex = 0;
        tab.tab.classList.add('cm-tab');
        tab.tab.draggable = true;
        tab.icon.draggable = false;
        tab.title.draggable = false;
        tab.tab.appendChild(tab.icon);
        tab.tab.appendChild(tab.title);
        tab.tab.onclick = () => {
            const e = { id: tab.id, tab: tab, preventDefault: false };
            this.emit('tab-click', e);
            if (e.preventDefault || this.active === tab) return;
            this.switchToTab(tab);
        };
        tab.tab.oncontextmenu = (e) => {
            this.emit('tab-contextmenu', { id: tab.id, tab: tab }, e);
            e.preventDefault();
            e.stopPropagation();
        };
        tab.tab.ondblclick = (e) => {
            this.emit('tab-dblclick', { id: tab.id, tab: tab });
        };
        tab.tab.ondragstart = (e) => {
            e.dataTransfer.dropEffect = 'move';
            e.dataTransfer.effectAllowed = 'move';
            const data: any = {};
            for (let prop in tab) {
                if (!Object.prototype.hasOwnProperty.call(tab, prop))
                    continue;
                if (typeof tab[prop] === 'object' && !Array.isArray(tab[prop])) continue;
                data[prop] = tab[prop];
            }
            var bounds = tab.tab.getBoundingClientRect();
            data.offset = { x: Math.ceil(bounds.left + (window.outerWidth - document.body.offsetWidth)), y: Math.ceil(bounds.top + (window.outerHeight - document.body.offsetHeight)) };
            //TODO recode this to be changeable to allow multiple tab strips in 1 window if need be
            e.dataTransfer.setData('jimud/tab', JSON.stringify(data));
            const eDrag = { id: tab.id, tab: tab, preventDefault: false, event: e };
            this.emit('tab-drag', eDrag);
            if (eDrag.preventDefault) return;
            if (this.active !== tab)
                this.switchToTab(tab);
            this.dragTab = tab;
            e.stopPropagation();
        };
        tab.tab.ondragover = (e) => {
            const eDrag = { id: tab.id, tab: tab, preventDefault: false, event: e };
            this.emit('tab-drag-over', eDrag);
            if (eDrag.preventDefault) return;
            if (this.dragTab === tab) {
                e.dataTransfer.dropEffect = 'none';
                e.dataTransfer.effectAllowed = 'none';
                return;
            }
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            e.stopPropagation();
        };
        tab.tab.ondragend = (e) => {
            const eDrag = { id: tab.id, tab: tab, preventDefault: false, event: e };
            this.emit('tab-drag-end', eDrag);
            if (eDrag.preventDefault) return;
            if (this.dragTab !== tab)
                e.dataTransfer.dropEffect = 'move';
            tab.tab.classList.remove('drop');
            this.dragTab = null;
        };
        tab.tab.ondragenter = (e) => {
            const eDrag = { id: tab.id, tab: tab, preventDefault: false, event: e };
            this.emit('tab-drag-enter', eDrag);
            if (eDrag.preventDefault) return;
            if (this.dragTab === tab) {
                e.dataTransfer.dropEffect = 'none';
                e.dataTransfer.effectAllowed = 'none';
                return;
            }
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            e.stopPropagation();
            tab.tab.classList.add('drop');
        };
        tab.tab.ondragleave = (e) => {
            const eDrag = { id: tab.id, tab: tab, preventDefault: false, event: e };
            this.emit('tab-drag-leave', eDrag);
            if (eDrag.preventDefault) return;
            if (this.dragTab === tab) return;
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            e.stopPropagation();
            tab.tab.classList.remove('drop');
            e.dataTransfer.dropEffect = 'move';
        };
        tab.tab.ondrop = (e) => {
            const eDrag = { id: tab.id, tab: tab, preventDefault: false, event: e };
            this.emit('tab-drop', eDrag);
            if (eDrag.preventDefault) return;
            if (this.dragTab === tab) return;
            tab.tab.classList.remove('drop');
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            e.stopPropagation();
            const idx = this.tabs.indexOf(this.dragTab);
            const idxTo = this.tabs.indexOf(tab);
            this.tabs.splice(idx, 1);
            this.tabs.splice(idxTo, 0, this.dragTab);
            if (idxTo > idx) {
                if (tab.tab.nextElementSibling)
                    tab.tab.parentNode.insertBefore(this.dragTab.tab, tab.tab.nextElementSibling);
                else
                    tab.tab.parentNode.appendChild(this.dragTab.tab);
            }
            else
                tab.tab.parentNode.insertBefore(this.dragTab.tab, tab.tab);
            this.emit('tab-moved', { oldIndex: idx, index: idxTo, id: this.dragTab.id, tab: this.dragTab, event: e });
        };

        const close = document.createElement('i');
        close.classList.add('close', 'fa', 'fa-times');
        close.draggable = false;
        close.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.removeTab(tab);
        };
        tab.tab.appendChild(close);
        tab.title.classList.add('title');
        tab.icon.classList.add('icon');
        tab.title.innerHTML = options.title;
        tab.title.title = options.tooltip || options.title || '';
        tab.tab.title = options.tooltip || options.title || '';
        if (tab.iconCls) {
            tab.icon.classList.add(...tab.iconCls.split(' '));
            tab.icon.style.backgroundImage = '';
            tab.icon.style.backgroundImage = '';
            tab.iconSrc = 0;
        }
        else if (tab.iconSrc) {
            tab.iconCls = '';
            tab.iconSrc = options.iconSrc;
            tab.icon.style.backgroundImage = `url(${options.iconSrc})`;
        }
        return tab;
    }

    public addTab(title?: string | TabOptions, icon?: string, tooltip?: string) {
        var options: TabOptions = {};
        if (typeof title === 'string' || title instanceof String)
            options = { title: <string>title, icon: icon, tooltip: tooltip ||  <string>title || ''};
        else
            options = title || {};
        $('.dropdown.open').removeClass('open');
        const tab = this.newTab(options);
        this.$addCache.push(tab);
        this.tabs.push(tab);
        if (!options.noActivate)
            this.switchToTabByIndex(this.tabs.length - 1);
        //this.setTabTitle(title || '', undefined, false);
        //this.setTabIconClass(options.icon || options.iconCls, tab, true);
        //this.setTabTooltip(tooltip || '');
        this.emit('add', { index: this.tabs.length - 1, id: tab.id, tab: tab });
        this.doUpdate(UpdateType.resize | UpdateType.stripState | UpdateType.batchAdd);
        return tab;
    }

    public createTab(title?: string | TabOptions, icon?: string, tooltip?: string) {
        var options: TabOptions = {};
        if (typeof title === 'string' || title instanceof String)
            options = { title: <string>title, icon: icon, tooltip: tooltip || <string>title || '' };
        else
            options = title || {};
        $('.dropdown.open').removeClass('open');
        const tab = this.newTab(options);
        //this.setTabTitle(title || '', tab, true);
        //this.setTabIconClass(options.icon || options.iconCls, tab, true);
        //this.setTabTooltip(tooltip || '', tab);
        return tab;
    }

    public insertTab(idx: number, title?: string | TabOptions, icon?: string, tooltip?: string) {
        var options: TabOptions = {};
        if (typeof title === 'string' || title instanceof String)
            options = { title: <string>title, icon: icon, tooltip: tooltip || <string>title || '' };
        else
            options = title || {};
        $('.dropdown.open').removeClass('open');
        const tab = this.newTab(options);
        if (idx >= this.tabs.length) {
            this.$tabstrip.appendChild(tab.tab);
            this.tabs.push(tab);
        }
        else {
            this.$tabstrip.insertBefore(tab.tab, this.tabs[idx].tab);
            this.tabs.splice(idx, 0, tab);
        }
        if (!options.noActivate)
            this.switchToTabByIndex(idx);
        //this.setTabTitle(title || '', undefined, false);
        this.setTabIconClass(tab.iconCls);
        //this.setTabTooltip(tooltip || '');
        if (!options.silent)
            this.emit('add', { index: idx, id: tab.id, tab: tab });
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
        return tab;
    }

    public addTabs(tabs: Tab[], current?: number) {
        if (!tabs || tabs.length === 0) return;
        let p = 0;
        const pl = tabs.length;
        const ts = document.createDocumentFragment();
        let cl = this.tabs.length;
        this.tabs = this.tabs.concat(tabs);
        for (; p < pl; p++) {
            const tab = tabs[p];
            ts.appendChild(tab.tab);
            this.emit('add', { index: cl, id: tab.id, tab: tab });
            cl++;
        }
        this.$tabstrip.appendChild(ts);
        if (typeof current !== 'undefined')
            this.switchToTabByIndex(current);
        else
            this.switchToTabByIndex(this.tabs.length - 1);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public removeTab(tab?, silent?) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getTab(tab);
        if (!tab) return;
        let idx = this.getTabIndex(tab);
        if (idx === -1) return;
        const e = { index: idx, id: tab.id, tab: tab, cancel: false };
        if (!silent)
            this.emit('remove', e);
        if (e.cancel)
            return;
        $('.dropdown.open').removeClass('open');
        this.$tabstrip.removeChild(tab.tab);
        this.tabs.splice(idx, 1);
        if (this.tabs.length === 0)
            this.active = null;
        else if (tab.id === this.active.id) {
            if (idx >= this.tabs.length)
                idx--;
            this.switchToTabByIndex(idx);
        }
        if (!silent)
            this.emit('removed', { index: idx, id: tab.id, tab: tab });
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public removeAllTabs(skipTab?) {
        const tl = this.tabs.length;
        let idx;
        let e;
        let tab;
        if (skipTab)
            skipTab = this.getTabIndex(skipTab);
        for (idx = tl - 1; idx >= 0; idx--) {
            if (idx === skipTab) continue;
            tab = this.tabs[idx];
            e = { index: idx, id: tab.id, tab: tab, cancel: false };
            this.emit('remove', e);
            if (e.cancel)
                continue;
            if (tab === this.active)
                this.active = null;
            this.$tabstrip.removeChild(tab.tab);
            this.tabs.splice(idx, 1);
            this.emit('removed', { index: idx, id: tab.id, tab: tab });
        }
        $('.dropdown.open').removeClass('open');
        if (this.tabs.length === 0)
            this.active = null;
        else if (!this.active)
            this.switchToTabByIndex(skipTab || 0);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public removeAllTabAfter(afterTab?) {
        let idx;
        let e;
        let tab;
        if (afterTab === undefined)
            afterTab = this.active;
        const tl = this.getTabIndex(afterTab);
        if (tl === -1)
            return;
        idx = this.tabs.length - 1;
        for (; idx > tl; idx--) {
            tab = this.tabs[idx];
            e = { index: idx, id: tab.id, tab: tab, cancel: false };
            this.emit('remove', e);
            if (e.cancel)
                continue;
            if (tab === this.active)
                this.active = null;
            this.$tabstrip.removeChild(tab.tab);
            this.tabs.splice(idx, 1);
            this.emit('removed', { index: idx, id: tab.id, tab: tab });
        }
        $('.dropdown.open').removeClass('open');
        if (this.tabs.length === 0)
            this.active = null;
        else if (!this.active)
            this.switchToTab(afterTab);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public removeAllTabsBefore(beforeTab?) {
        const tl = this.tabs.length;
        let idx;
        let e;
        let tab;
        if (beforeTab === undefined)
            beforeTab = this.active;
        beforeTab = this.getTabIndex(beforeTab);
        if (beforeTab === -1)
            return;
        idx = beforeTab - 1;
        for (; idx >= 0; idx--) {
            tab = this.tabs[idx];
            e = { index: idx, id: tab.id, tab: tab, cancel: false };
            this.emit('remove', e);
            if (e.cancel)
                continue;
            if (tab === this.active)
                this.active = null;
            this.$tabstrip.removeChild(tab.tab);
            this.tabs.splice(idx, 1);
            this.emit('removed', { index: idx, id: tab.id, tab: tab });
        }
        $('.dropdown.open').removeClass('open');
        if (this.tabs.length === 0)
            this.active = null;
        else if (!this.active)
            this.switchToTab(beforeTab);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public switchToTabByIndex(idx) {
        if (idx < 0 || idx >= this.tabs.length)
            return;
        if (this.active) {
            this.active.tab.classList.remove('active');
            this.emit('deactivated', { index: this.getTabIndex(this.active), id: this.active.id, tab: this.active });
        }
        this.active = this.tabs[idx];
        this.active.tab.classList.add('active');
        this.emit('activated', { index: idx, id: this.active.id, tab: this.active });
        this.active.tab.focus();
        this.$tabstrip.scrollTop = 0;
        this.doUpdate(UpdateType.scrollToTab);
    }

    public switchToTab(tab) {
        tab = this.getTab(tab);
        if (!tab) return;
        if (this.active) {
            this.active.tab.classList.remove('active');
            this.emit('deactivated', { index: this.getTabIndex(this.active), id: this.active.id, tab: this.active });
        }
        this.active = tab;
        this.active.tab.classList.add('active');
        this.emit('activated', { index: this.getTabIndex(this.active), id: this.active.id, tab: this.active });
        this.active.tab.focus();
        this.$tabstrip.scrollTop = 0;
        this.doUpdate(UpdateType.scrollToTab);
    }

    public setTabTooltip(text: string, tab?) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getTab(tab);
        if (!tab) return;
        tab.title.title = text;
        tab.tab.title = text;
    }

    public setTabTitle(text: string, tab?, noMenu?: boolean) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getTab(tab);
        if (!tab) return;
        tab.title.innerHTML = text;
        if (!noMenu) return;
        const idx = this.getTabIndex(tab);
        $(`#cm-scroll-dropdown-menu-${idx}-title`).html(text);
        this.doUpdate(UpdateType.resize);
    }

    public setTabIconClass(icon: string, tab?, noMenu?: boolean) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getTab(tab);
        if (!tab) return;
        if (tab.iconCls && tab.iconCls.length !== 0)
            tab.icon.classList.remove(...tab.iconCls.split(' '));
        tab.icon.classList.add(...icon.split(' '));
        tab.icon.style.backgroundImage = '';
        tab.icon.style.backgroundImage = '';
        tab.iconCls = icon;
        tab.iconSrc = 0;
        if (!noMenu) return;
        const idx = this.getTabIndex(tab);
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).removeClass();
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).addClass(tab.icon.className);
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).css('background-image', '');
        this.doUpdate(UpdateType.resize);
    }

    public setTabIcon(icon: string, tab?, noMenu?: boolean) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getTab(tab);
        if (!tab) return;
        if (tab.iconCls && tab.iconCls.length !== 0)
            tab.icon.classList.remove(...tab.iconCls.split(' '));
        tab.iconCls = '';
        tab.iconSrc = icon;
        tab.icon.style.backgroundImage = `url(${icon})`;
        if (!noMenu) return;
        const idx = this.getTabIndex(tab);
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).removeClass();
        $(`#cm-scroll-dropdown-menu-${idx}-icon`).css('background-image', `url(${icon})`);
        this.doUpdate(UpdateType.resize);
    }

    public getTab(idx) {
        const tl = this.tabs.length;
        let t;
        if (typeof idx !== 'number') {
            if (!idx)
                return null;
            if (idx.isTab)
                return idx;
            for (t = 0; t < tl; t++) {
                if (this.tabs[t] === idx)
                    return this.tabs[t];
                if (this.tabs[t].tab === idx)
                    return this.tabs[t];
            }
            return null;
        }
        else if (idx < 0 || idx >= this.tabs.length) {
            for (t = 0; t < tl; t++) {
                if (this.tabs[t].id === idx)
                    return this.tabs[t];
            }
            return null;
        }
        return this.tabs[idx];
    }

    public getTabIndex(tab) {
        const tl = this.tabs.length;
        let t;
        if (typeof tab !== 'number') {
            for (t = 0; t < tl; t++) {
                if (this.tabs[t] === tab)
                    return t;
                if (this.tabs[t].tab === tab)
                    return t;
                if (this.tabs[t].id === tab)
                    return t;
            }
            return -1;
        }
        for (t = 0; t < tl; t++) {
            if (this.tabs[t].id === tab)
                return t;
        }
        return -1;
    }

    private updateStripState() {
        if (!this._hideTabstrip && this.tabs.length === 0) {
            if (!this.$tabstrip.classList.contains('hidden')) {
                this.$tabstrip.classList.add('hidden');
                this.emit('tab-strip-hidden');
            }
        }
        else if (!this._hideTabstrip || this.tabs.length > 1) {
            if (this.$tabstrip.classList.contains('hidden')) {
                this.$tabstrip.classList.remove('hidden');
                this.emit('tab-strip-shown');
            }
        }
        else if (!this.$tabstrip.classList.contains('hidden')) {
            this.$tabstrip.classList.add('hidden');
            this.emit('tab-strip-hidden');
        }
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
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
                this.$scrollMenu.style.maxHeight = (this.$parent.clientHeight - 4) + 'px';
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
        }
        this.$tabstrip.appendChild(ts);
        this.$addCache = [];
        this.switchToTabByIndex(this.tabs.length - 1);
        this.doUpdate(UpdateType.resize | UpdateType.stripState);
    }

    public refresh() {
        this.batchAdd();
        this.updateStripState();
        this.updateScrollButtons();
        this.updateScrollButtons();
    }
}