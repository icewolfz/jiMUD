
import EventEmitter = require('events');
import { remote } from 'electron';
const { Menu, MenuItem } = remote;
const { URL } = require('url');

export enum UpdateType {
    none = 0, resize = 1, scroll = 2, scrollToTab = 4
}

export interface DockMangerOptions {
    container?;
}

export interface Panel {
    tab: HTMLElement;
    pane: HTMLElement;
    id: number;
    icon: HTMLElement;
    title: HTMLElement;
    iconCls: string;
}

export class DockManager extends EventEmitter {
    private $parent: HTMLElement;
    private $el: HTMLElement;
    private $tabstrip: HTMLElement;
    private $tabpane: HTMLElement;
    public panels: Panel[] = [];
    public active: Panel;
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
        document.addEventListener('keyup', (e) => {
            const tl = this.panels.length;
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
                    this.removePanel(this.active);
                    e.preventDefault();
                }
                else if (e.which === 9) {
                    idx = this.getPanelIndex(this.active);
                    if (idx === -1) return;
                    idx++;
                    if (idx === this.panels.length)
                        idx = 0;
                    this.switchToPanelByIndex(idx);
                    e.preventDefault();
                }
            }
        });
        window.addEventListener('blur', () => { $('.dropdown.open').removeClass('open'); });
    }

    public resize() {
        let tl = this.panels.length;
        if (tl < 0)
            tl = 1;
        this.$scrollLeft.classList.add('hidden');
        this.$scrollRight.classList.add('hidden');
        this.$scrollDropdown.classList.add('hidden');
        let tWidth = 100;
        let w = 100;

        for (let t = 0; t < tl; t++) {
            this.panels[t].title.style.overflow = 'visible';
            this.panels[t].title.style.width = 'auto';
            tWidth = this.panels[t].title.scrollWidth || this.panels[t].title.clientWidth;
            //adjust for icon and close buttons
            tWidth += 44;
            if (tWidth > w)
                w = tWidth;
            this.panels[t].title.style.overflow = '';
            this.panels[t].title.style.width = '';
        }
        /*
                if (w > 200)
                    w = 200;
                */
        for (let t = 0; t < tl; t++) {
            this.panels[t].tab.style.width = `${w}px`;
            this.panels[t].title.style.maxWidth = `${w - 22}px`;
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
        this.$scrollDropdown.classList.add('dropdown-toggle', 'hidden');
        this.$scrollDropdown.dataset.toggle = 'dropdown';
        this.$scrollDropdown.setAttribute('aria-haspopup', 'true');
        this.$scrollDropdown.setAttribute('aria-expanded', 'true');
        this.$scrollDropdown.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const menu = $(this.$scrollMenu);
            menu.empty();
            const tl = this.panels.length;
            for (let t = 0; t < tl; t++) {
                if (this.panels[t] === this.active)
                    menu.append(`<li><a href="#" class="active" data-index="${t}"><div id="cm-scroll-dropdownmenu-${t}-icon" class="${this.panels[t].icon.className}"></div> <span id="cm-scroll-dropdownmenu-${t}-title">${this.panels[t].title.innerHTML}</span></a></li>`);
                else
                    menu.append(`<li><a href="#" data-index="${t}"><div id="cm-scroll-dropdownmenu-${t}-icon" class="${this.panels[t].icon.className}"></div> <span id="cm-scroll-dropdownmenu-${t}-title">${this.panels[t].title.innerHTML}</span></a></li>`);
            }
            //$(this.$scrollDropdown).trigger('click.bs.dropdown');
        };
        d.appendChild(this.$scrollDropdown);

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

        this.$tabpane = document.createElement('div');
        this.$tabpane.id = 'cm-tabpane';
        this.$tabpane.className = 'cm-tabpane-container';
        this.$el.appendChild(this.$tabpane);
        if (this.panels.length > 0) {
            const tl = this.panels.length;
            for (let t = 0; t < tl; t++) {
                this.$tabstrip.appendChild(this.panels[t].tab);
                this.$tabpane.appendChild(this.panels[t].pane);
            }
            if (!this.active)
                this.switchToPanelByIndex(this.panels.length - 1);
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

    private scrollToTab(panel?) {
        if (!panel)
            panel = this.active;
        else
            panel = this.getPanel(panel);
        if (!panel) return;
        const idx = this.getPanelIndex(panel);
        if (idx === -1) return;
        let i = 0;
        //TODO formual should be width - padding + borders, caluatle padding/border sizes
        i = idx * (panel.tab.clientWidth - 8);
        if (i <= this._scroll) {
            this._scroll = i - 10;
        }
        else {
            i += panel.tab.clientWidth - 8;
            //50 is tab strip right padding + width of scroll button + shadow width + drop down with
            if (i >= this._scroll + this.$tabstrip.clientWidth - 58)
                this._scroll = i + 58 - this.$tabstrip.clientWidth;
        }
        this.doUpdate(UpdateType.scroll);
    }

    public addPanel(title?: string, icon?: string, tooltip?: string) {
        $('.dropdown.open').removeClass('open');
        const panel: Panel = {
            tab: document.createElement('li'),
            pane: document.createElement('div'),
            id: --this._id,
            title: document.createElement('div'),
            icon: document.createElement('div'),
            iconCls: icon || 'disconnected-icon',
        };

        panel.tab.id = 'cm-tab' + panel.id;
        panel.tab.tabIndex = 0;
        panel.tab.classList.add('cm-tab');
        panel.tab.draggable = true;
        panel.tab.appendChild(panel.icon);
        panel.tab.appendChild(panel.title);
        panel.tab.onclick = () => {
            const e = { id: panel.id, panel: panel, preventDefault: false };
            this.emit('tab-click', e);
            if (e.preventDefault || this.active === panel) return;
            this.switchToPanel(panel.id);
        };
        panel.tab.oncontextmenu = (e) => {
            this.emit('tab-contextmenu', panel.id, panel);
            e.preventDefault();
            e.stopPropagation();
        };
        panel.tab.ondblclick = (e) => {
            this.emit('tab-dblclick', panel.id, panel);
        };

        const close = document.createElement('i');
        close.classList.add('close', 'fa', 'fa-times');
        close.onclick = () => {
            this.removePanel(panel.id);
        };
        panel.tab.appendChild(close);

        panel.pane.id = 'cm-tabpane' + panel.id;
        panel.pane.classList.add('cm-tabpane');
        panel.title.classList.add('title');
        panel.icon.classList.add('icon');

        this.$tabstrip.appendChild(panel.tab);
        this.$tabpane.appendChild(panel.pane);
        this.panels.push(panel);
        this.switchToPanelByIndex(this.panels.length - 1);
        this.setPanelTitle(title || '');
        this.setPanelIcon(panel.iconCls);
        this.setPanelTooltip(tooltip || '');
        this.updateStripState();
        this.emit('add', { index: this.panels.length - 1, id: panel.id, panel: panel });
        this.doUpdate(UpdateType.resize);
        return panel;
    }

    public removePanel(panel?) {
        if (panel === undefined)
            panel = this.active;
        else
            panel = this.getPanel(panel);
        if (!panel) return;
        let idx = this.getPanelIndex(panel);
        if (idx === -1) return;
        const e = { index: idx, id: panel.id, panel: panel, cancel: false };
        this.emit('remove', e);
        if (e.cancel)
            return;
        $('.dropdown.open').removeClass('open');
        this.$tabstrip.removeChild(panel.tab);
        this.$tabpane.removeChild(panel.pane);
        this.panels.splice(idx, 1);
        if(this.panels.length === 0)
            this.active = null;
        else if (panel.id === this.active.id) {
            if (idx >= this.panels.length)
                idx--;
            this.switchToPanelByIndex(idx);
        }
        this.updateStripState();
        this.emit('removed', { index: idx, id: panel.id, panel: panel });
        this.doUpdate(UpdateType.resize);
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

    public setPanelTitle(text: string, tab?) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getPanel(tab);
        if (!tab) return;
        tab.title.innerHTML = text;
        tab.tab.title = tab.title.innerText;
        const idx = this.getPanelIndex(tab);
        $(`#cm-scroll-dropdownmenu-${idx}-title`).html(text);
    }

    public setPanelIcon(icon: string, tab?) {
        if (tab === undefined)
            tab = this.active;
        else
            tab = this.getPanel(tab);
        if (!tab) return;
        const idx = this.getPanelIndex(tab);
        tab.icon.classList.remove(...tab.iconCls.split(' '));
        tab.icon.classList.add(...icon.split(' '));
        tab.iconCls = icon;
        $(`#cm-scroll-dropdownmenu-${idx}-icon`).removeClass();
        $(`#cm-scroll-dropdownmenu-${idx}-icon`).addClass(tab.icon.className);
    }

    public getPanel(idx) {
        const tl = this.panels.length;
        let t;
        if (typeof idx !== 'number') {
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
        if(!this._hideTabstrip  && this.panels.length === 0 )
        {
            this.$tabstrip.classList.add('hidden');
            this.$tabpane.classList.add('full');
        }
        else if (!this._hideTabstrip || this.panels.length > 1) {
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