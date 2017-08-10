
import EventEmitter = require('events');
import { Client } from './client';
const { URL } = require('url');

export enum UpdateType {
    none = 0, resize = 1, scroll = 2
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
    private tabs: Tab[] = [];
    private active: Tab;
    private _hideTabstrip: boolean = true;
    private _id: number = 0;
    private $scrollLeft: HTMLAnchorElement;
    private $scrollRight: HTMLAnchorElement;
    private _updating: UpdateType = UpdateType.none;

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
        });
        document.addEventListener('DOMContentLoaded', () => {
            this.doUpdate(UpdateType.resize);
        }, false);
    }

    public resize() {
        let tl = this.tabs.length;
        if (tl < 0)
            tl = 1;
        this.$scrollLeft.classList.add('hidden');
        this.$scrollRight.classList.add('hidden');
        let tWidth = 100;
        let w = 100;
        for (let t = 0; t < tl; t++) {
            this.tabs[t].title.style.overflow = 'visible';
            tWidth = this.tabs[t].title.scrollWidth || this.tabs[t].title.clientWidth;
            //adjust for icon and close buttons
            tWidth += 44;
            if (tWidth > w)
                w = tWidth;
            this.tabs[t].title.style.overflow = 'hidden';
        }

        if (w > 200)
            w = 200;
        for (let t = 0; t < tl; t++) {
            this.tabs[t].tab.style.width = `${w}px`;
            this.tabs[t].title.style.maxWidth = `${w - 22}px`;
        }

        if (this.$tabstrip.scrollWidth > window.innerWidth) {
            this.$tabstrip.classList.add('scroll');
            this.$scrollLeft.classList.remove('hidden');
            this.$scrollRight.classList.remove('hidden');
        }
        else {
            this.$tabstrip.classList.remove('scroll');
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

        this.$tabstrip = document.createElement('div');
        this.$tabstrip.id = 'cm-tabstrip';
        this.$tabstrip.className = 'cm-tabstrip';

        this.$scrollLeft = document.createElement('a');
        this.$scrollLeft.innerHTML = '<i class="fa fa-caret-left"></i>';
        this.$scrollLeft.id = 'cm-scroll-left';
        this.$scrollLeft.href = 'javascript:void(0)';
        this.$scrollLeft.onclick = () => {
            return;
        };
        this.$scrollLeft.classList.add('hidden');
        this.$tabstrip.appendChild(this.$scrollLeft);
        this.$scrollRight = document.createElement('a');
        this.$scrollRight.innerHTML = '<i class="fa fa-caret-right"></i>';
        this.$scrollRight.id = 'cm-scroll-right';
        this.$scrollRight.href = 'javascript:void(0)';
        this.$scrollRight.onclick = () => {
            return;
        };
        this.$scrollRight.classList.add('hidden');
        this.$tabstrip.appendChild(this.$scrollRight);

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
        this.updateStripState();
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
            tab: document.createElement('div'),
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
        tab.icon.classList.add(tab.iconCls);

        this.$tabstrip.appendChild(tab.tab);
        this.$tabpane.appendChild(tab.pane);
        this.tabs.push(tab);
        this.switchToTabByIndex(this.tabs.length - 1);

        this.setTabTitle(`${host}:${port}`);
        this.updateStripState();
        this.emit('add', { index: this.tabs.length - 1, id: tab.id, tab: tab });
        this.doUpdate(UpdateType.resize);
    }

    public removeClient(tab) {
        tab = this.getTab(tab);
        if (!tab) return;
        let idx = this.getTabIndex(tab);
        const e = { index: idx, id: tab.id, tab: tab, cancel: false };
        this.emit('remove', e);
        if (e.cancel)
            return;
        this.$tabstrip.removeChild(tab.tab);
        this.$tabpane.removeChild(tab.pane);
        this.tabs.slice(idx, 1);
        this.switchToTabByIndex(idx--);
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
    }

    public setTabTitle(text, idx?) {
        let tab;
        if (idx === undefined)
            tab = this.active;
        else
            tab = this.getTab(idx);
        if (!tab) return;
        tab.title.innerHTML = text;
        tab.tab.title = text;
    }

    public setTabIcon(icon, idx?) {
        let tab;
        if (idx === undefined)
            tab = this.active;
        else
            tab = this.getTab(idx);
        if (!tab) return;
        if (tab.iconCls.startsWith('fa-'))
            tab.icon.classList.remove('fa');
        tab.icon.classList.remove(tab.iconCls);
        tab.iconCls = icon;
        if (tab.iconCls.startsWith('fa-'))
            tab.icon.classList.add('fa');
        tab.icon.classList.add(icon);
    }

    public getTab(idx) {
        const tl = this.tabs.length;
        let t;
        if (typeof idx !== 'number') {
            for (t = 0; t < tl; t++) {
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
                if (this.tabs[t].client === tab)
                    return t;
                if (this.tabs[t].tab === tab)
                    return t;
                if (this.tabs[t].pane === tab)
                    return t;
            }
            return null;
        }
        for (t = 0; t < tl; t++) {
            if (this.tabs[t].id === tab)
                return t;
        }
        return null;
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
                this._updating &= ~UpdateType.resize;
            }
            if ((this._updating & UpdateType.scroll) === UpdateType.scroll) {
                //TODO add scroll
                this._updating &= ~UpdateType.scroll;
            }
            this.doUpdate(this._updating);
        });
    }
}