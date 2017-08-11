
import EventEmitter = require('events');
import { Client } from './client';
import { remote } from 'electron';
const { Menu, MenuItem } = remote;
const { URL } = require('url');

export enum UpdateType {
    none = 0, resize = 1, scroll = 2, scrollToTab = 4
}

export interface ClientMangerOptions {
    container?;
}

export interface Tab {
    client: Client;
    tab: HTMLElement;
    pane: HTMLElement;
    id: number;
    icon: HTMLElement;
    title: HTMLElement;
    iconCls: string;
}

export class ClientManager extends EventEmitter {
    private $parent: HTMLElement;
    private $el: HTMLElement;
    private $tabstrip: HTMLElement;
    private $tabpane: HTMLElement;
    public tabs: Tab[] = [];
    public active: Tab;
    private _hideTabstrip: boolean = true;
    private _id: number = 0;
    private $scrollLeft: HTMLAnchorElement;
    private $scrollRight: HTMLAnchorElement;
    private $scrollDropdown: HTMLButtonElement;
    private $scrollMenu: HTMLUListElement;
    private _updating: UpdateType = UpdateType.none;
    private _scroll: number = 0;
    private _scrollTimer: NodeJS.Timer;

    public get hideTabstrip(): boolean {
        return this._hideTabstrip;
    }

    public set hideTabstrip(value: boolean) {
        if (this._hideTabstrip !== value) {
            this._hideTabstrip = value;
            this.updateStripState();
        }
    }

    constructor(container?: any) {
        super();

        if (container)
            this.setParent(container.container ? container.container : container);
        else
            this.setParent(document.body);

        window.addEventListener('resize', (e) => {
            this.doUpdate(UpdateType.resize);
            this.$scrollMenu.style.maxHeight = (this.$tabpane.clientHeight - 4) + 'px';
        });
        document.addEventListener('DOMContentLoaded', () => {
            this.doUpdate(UpdateType.resize);
        }, false);
        document.addEventListener('keydown', (e) => {
            let idx;
            if (e.defaultPrevented)
                return;
            if (!e.altKey && e.ctrlKey && !e.shiftKey && !e.metaKey) {
                if (e.which === 87) {
                    this.removeClient(this.active);
                    e.preventDefault();
                }
                else if (e.which === 9) {
                    idx = this.getTabIndex(this.active);
                    if (idx === -1) return;
                    idx++;
                    if (idx === this.tabs.length)
                        idx = 0;
                    this.switchToTabByIndex(idx);
                    e.preventDefault();
                }
            }
        });
        window.addEventListener('blur', () => { $('.dropdown.open').removeClass('open'); });
    }

    public resize() {
        let tl = this.tabs.length;
        if (tl < 0)
            tl = 1;
        this.$scrollLeft.classList.add('hidden');
        this.$scrollRight.classList.add('hidden');
        this.$scrollDropdown.classList.add('hidden');
        let tWidth = 100;
        let w = 100;

        for (let t = 0; t < tl; t++) {
            this.tabs[t].title.style.overflow = 'visible';
            this.tabs[t].title.style.width = 'auto';
            tWidth = this.tabs[t].title.scrollWidth || this.tabs[t].title.clientWidth;
            //adjust for icon and close buttons
            tWidth += 44;
            if (tWidth > w)
                w = tWidth;
            this.tabs[t].title.style.overflow = '';
            this.tabs[t].title.style.width = '';
        }
        /*
                if (w > 200)
                    w = 200;
                */
        for (let t = 0; t < tl; t++) {
            this.tabs[t].tab.style.width = `${w}px`;
            this.tabs[t].title.style.maxWidth = `${w - 22}px`;
        }

        if (this.$tabstrip.scrollWidth > this.$parent.clientWidth)
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
        if (this.$tabstrip.scrollWidth > this.$parent.clientWidth) {
            this.$scrollLeft.classList.remove('hidden');
            this.$scrollRight.classList.remove('hidden');
            this.$scrollDropdown.classList.remove('hidden');
            if (this.$tabstrip.scrollLeft === 0)
                this.$scrollLeft.classList.add('disabled');
            else
                this.$scrollLeft.classList.remove('disabled');
            if (this.$tabstrip.scrollLeft >= this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth) {
                this.$scrollRight.classList.add('disabled');
                this.$scrollDropdown.classList.add('single');
            }
            else {
                this.$scrollRight.classList.remove('disabled');
                this.$scrollDropdown.classList.remove('single');
            }
        }
        else {
            this.$tabstrip.classList.remove('scroll');
            this.$scrollLeft.classList.add('hidden');
            this.$scrollRight.classList.add('hidden');
            this.$scrollDropdown.classList.add('hidden');
            $('.dropdown.open').removeClass('open');
        }
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

    public createControl() {
        if (this.$el) {
            this.$el.removeChild(this.$tabstrip);
            this.$el.removeChild(this.$tabpane);
            this.$parent.removeChild(this.$el);
        }

        this.$el = document.createElement('div');
        this.$el.id = 'cm';
        this.$el.className = 'cm';
        this.$parent.appendChild(this.$el);

        this.$tabstrip = document.createElement('ul');
        this.$tabstrip.id = 'cm-tabstrip';
        this.$tabstrip.className = 'cm-tabstrip';
        this.$tabstrip.addEventListener('wheel', (event) => {
            this._scroll += (event.deltaY || event.deltaX);
            if (this._scroll < 0)
                this._scroll = 0;
            else if (this._scroll > this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth)
                this._scroll = this.$tabstrip.scrollWidth - this.$tabstrip.clientWidth;
            this.doUpdate(UpdateType.scroll);
        });
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
        this.$scrollRight.classList.add('hidden');
        this.$el.appendChild(this.$scrollRight);

        const d = document.createElement('div');
        d.classList.add('dropdown');
        d.id = 'cm-scroll-dropdown-container';

        this.$scrollDropdown = document.createElement('button');
        this.$scrollDropdown.innerHTML = '<i class="fa fa-caret-down"></i>';
        this.$scrollDropdown.id = 'cm-scroll-dropdown';
        this.$scrollDropdown.classList.add('dropdown-toggle');
        this.$scrollDropdown.dataset.toggle = 'dropdown';
        this.$scrollDropdown.setAttribute('aria-haspopup', 'true');
        this.$scrollDropdown.setAttribute('aria-expanded', 'true');
        this.$scrollDropdown.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const menu = $(this.$scrollMenu);
            menu.empty();
            const tl = this.tabs.length;
            for (let t = 0; t < tl; t++) {
                if (this.tabs[t] === this.active)
                    menu.append(`<li><a href="#" class="active" data-index="${t}"><div id="cm-scroll-dropdownmenu-${t}-icon" class="${this.tabs[t].icon.className}"></div> <span id="cm-scroll-dropdownmenu-${t}-title">${this.tabs[t].title.innerHTML}</span></a></li>`);
                else
                    menu.append(`<li><a href="#" data-index="${t}"><div id="cm-scroll-dropdownmenu-${t}-icon" class="${this.tabs[t].icon.className}"></div> <span id="cm-scroll-dropdownmenu-${t}-title">${this.tabs[t].title.innerHTML}</span></a></li>`);
            }
            //$(this.$scrollDropdown).trigger('click.bs.dropdown');
        };
        this.$scrollDropdown.classList.add('hidden');
        d.appendChild(this.$scrollDropdown);

        this.$scrollMenu = document.createElement('ul');
        this.$scrollMenu.id = 'cm-scroll-menu';
        this.$scrollMenu.dataset.container = 'body';
        this.$scrollMenu.classList.add('dropdown-menu');
        this.$scrollMenu.classList.add('pull-right');
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

        this.$tabpane = document.createElement('div');
        this.$tabpane.id = 'cm-tabpane';
        this.$tabpane.className = 'cm-tabpane-container';
        this.$el.appendChild(this.$tabpane);
        if (this.tabs.length > 0) {
            const tl = this.tabs.length;
            for (let t = 0; t < tl; t++) {
                this.$tabstrip.appendChild(this.tabs[t].tab);
                this.$tabpane.appendChild(this.tabs[t].pane);
            }
            if (!this.active)
                this.switchToTabByIndex(this.tabs.length - 1);
        }
        this.$scrollMenu.style.maxHeight = (this.$tabpane.clientHeight - 4) + 'px';
        this.updateStripState();
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
        //TODO formual should be width - padding + borders, caluatle padding/border sizes
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

    public addClient(host: string, port?: number) {
        if (!host)
            throw new Error('Invalid host');
        if (!port) {
            const u = new URL(host);
            port = u.port || 23;
            host = u.hostname;
        }
        const tab: Tab = {
            client: null,
            tab: document.createElement('li'),
            pane: document.createElement('div'),
            id: --this._id,
            title: document.createElement('div'),
            icon: document.createElement('div'),
            iconCls: 'disconnected-icon'
        };

        tab.tab.id = 'cm-tab' + tab.id;
        tab.tab.classList.add('cm-tab');
        tab.tab.appendChild(tab.icon);
        tab.tab.appendChild(tab.title);
        tab.tab.onclick = () => {
            const e = { id: tab.id, tab: tab, preventDefault: false };
            this.emit('tab-click', e);
            if (e.preventDefault) return;
            this.switchToTab(tab.id);
        };
        tab.tab.oncontextmenu = () => {
            this.emit('tab-contextmenu', tab.id, tab);
        };
        tab.tab.ondblclick = (e) => {
            this.emit('tab-dblclick', tab.id, tab);
        };

        const close = document.createElement('i');
        close.classList.add('close');
        close.classList.add('fa');
        close.classList.add('fa-times');
        close.onclick = () => {
            this.removeClient(tab.id);
        };
        tab.tab.appendChild(close);

        tab.pane.id = 'cm-tabpane' + tab.id;
        tab.pane.classList.add('cm-tabpane');
        tab.pane.innerHTML = `<h1>${tab.id}</h1>`;
        tab.title.classList.add('title');
        tab.icon.classList.add('icon');

        this.$tabstrip.appendChild(tab.tab);
        this.$tabpane.appendChild(tab.pane);
        this.tabs.push(tab);
        this.switchToTabByIndex(this.tabs.length - 1);

        this.setTabTitle(`${host}:${port}`);
        this.setTabIcon(tab.iconCls);
        this.updateStripState();
        this.emit('add', { index: this.tabs.length - 1, id: tab.id, tab: tab });
        this.doUpdate(UpdateType.resize);
    }

    public removeClient(tab) {
        tab = this.getTab(tab);
        if (!tab) return;
        let idx = this.getTabIndex(tab);
        if (idx === -1) return;
        const e = { index: idx, id: tab.id, tab: tab, cancel: false };
        this.emit('remove', e);
        if (e.cancel)
            return;
        this.$tabstrip.removeChild(tab.tab);
        this.$tabpane.removeChild(tab.pane);
        this.tabs.splice(idx, 1);
        if (tab.id === this.active.id) {
            if (idx >= this.tabs.length)
                idx--;
            this.switchToTabByIndex(idx);
        }
        this.updateStripState();
        this.doUpdate(UpdateType.resize);
    }

    public switchToTabByIndex(idx) {
        if (idx < 0 || idx >= this.tabs.length)
            return;
        if (this.active) {
            this.active.tab.classList.remove('active');
            this.active.pane.classList.remove('active');
            this.emit('deactivated', { index: this.getTabIndex(this.active), tab: this.active });
        }
        this.active = this.tabs[idx];
        this.active.tab.classList.add('active');
        this.active.pane.classList.add('active');
        this.emit('activated', { index: idx, tab: this.active });
        this.doUpdate(UpdateType.scrollToTab);
    }

    public switchToTab(tab) {
        tab = this.getTab(tab);
        if (!tab) return;
        if (this.active) {
            this.active.tab.classList.remove('active');
            this.active.pane.classList.remove('active');
            this.emit('deactivated', { index: this.getTabIndex(this.active), tab: this.active });
        }
        this.active = tab;
        this.active.tab.classList.add('active');
        this.active.pane.classList.add('active');
        this.emit('activated', { index: this.getTabIndex(this.active), tab: this.active });
        this.doUpdate(UpdateType.scrollToTab);
    }

    public setTabTitle(text, tab?) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getTab(tab);
        if (!tab) return;
        tab.title.innerHTML = text;
        tab.tab.title = tab.title.innerText;
        const idx = this.getTabIndex(tab);
        $(`#cm-scroll-dropdownmenu-${idx}-title`).html(text);
    }

    public setTabIcon(icon, tab?) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getTab(tab);
        if (!tab) return;
        const idx = this.getTabIndex(tab);
        if (tab.iconCls.startsWith('fa-'))
            tab.icon.classList.remove('fa');
        tab.icon.classList.remove(tab.iconCls);
        tab.iconCls = icon;
        if (tab.iconCls.startsWith('fa-'))
            tab.icon.classList.add('fa');
        tab.icon.classList.add(icon);
        $(`#cm-scroll-dropdownmenu-${idx}-icon`).removeClass();
        $(`#cm-scroll-dropdownmenu-${idx}-icon`).addClass(tab.icon.className);
    }

    public getTab(idx) {
        const tl = this.tabs.length;
        let t;
        if (typeof idx !== 'number') {
            for (t = 0; t < tl; t++) {
                if (this.tabs[t] === idx)
                    return this.tabs[t];
                if (this.tabs[t].client === idx)
                    return this.tabs[t];
                if (this.tabs[t].tab === idx)
                    return this.tabs[t];
                if (this.tabs[t].pane === idx)
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
                if (this.tabs[t].client === tab)
                    return t;
                if (this.tabs[t].tab === tab)
                    return t;
                if (this.tabs[t].pane === tab)
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
        if (!this._hideTabstrip || this.tabs.length > 1) {
            this.$tabstrip.classList.remove('hidden');
            this.$tabpane.classList.remove('full');
        }
        else {
            this.$tabstrip.classList.add('hidden');
            this.$tabpane.classList.add('full');
        }
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none)
            return;
        window.requestAnimationFrame(() => {
            if ((this._updating & UpdateType.resize) === UpdateType.resize) {
                this.resize();
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
}