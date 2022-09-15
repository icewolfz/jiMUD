let BrowserWindow, Menu;
const isRender = typeof process === 'undefined' || !process || process.type === 'renderer';
if (isRender) {
    BrowserWindow = require('@electron/remote').BrowserWindow;
    Menu = require('@electron/remote').Menu;
}
else {
    BrowserWindow = require('electron').BrowserWindow;
    Menu = require('electron').Menu;
}

export enum ItemType {
    menu = 0,
    raw = 1,
    both = 2
}

interface MenuItem {
    menu: string | string[];
    options;
}

/**
 * Menubar controller
 *
 * extends native menu system and provides ability to update items
 *
 * @export
 * @class Menubar
 */
export class Menubar {
    private _window: Electron.BrowserWindow;
    public menu: any[];
    private _menubar;
    private $cache = {};
    private $updating;
    private _rTimeout: any = 0;
    private $enabled = true;
    private $busy = false;

    constructor(menu: any[], window?: Electron.BrowserWindow) {
        if (!window)
            this._window = BrowserWindow.getCurrentWindow ? BrowserWindow.getCurrentWindow() : null;
        else
            this._window = window;
        this.menu = (menu || []).map(i => {
            i.root = true;
            i.enabled = true;
            return i;
        });
        this.rebuild();
    }

    public getItem(menu: (string | string[]), type?: ItemType) {
        let item;
        let i = 0;
        let items;
        let tItem;
        let tItems;
        if (!menu || !this._menubar) return null;
        if (!Array.isArray(menu)) {
            if (this.$cache[menu.toLowerCase()] && type === ItemType.both)
                return this.$cache[menu.toLowerCase()];
            menu = menu.toLowerCase().split('|');
        }
        else
            menu = menu.map(x => x.toLowerCase());
        items = this._menubar.items;
        tItems = this.menu;
        const il = menu.length;
        let f = 0;
        for (i = 0; i < il; i++) {
            if (!menu[i] || !items || items.length === 0) break;
            //let ml = items.length;
            //for (let m = 0; m < ml; m++) {
            let m = items.length;
            while (m--) {
                if (!items[m]) continue;
                if ((items[m].id || '').toLowerCase() === menu[i] || (items[m].label || '').toLowerCase().replace(/&/g, '') === menu[i]) {
                    item = items[m];
                    tItem = tItems[m];
                    if (item.submenu && item.submenu.items) {
                        items = item.submenu.items;
                        tItems = tItem.submenu;
                    }
                    else
                        items = null;
                    f++;
                    break;
                }
            }
        }
        if (f !== menu.length)
            return null;
        if (type === ItemType.raw)
            return tItem;
        if (type === ItemType.both) {
            this.$cache[menu.join('|').toLowerCase()] = [item, tItem];
            return [item, tItem];
        }
        return item;
    }

    public updateItem(menu: (string | string[] | MenuItem), options?) {
        if (this.$busy || (this.$updating & 1) === 1) {
            setTimeout(() => {
                this.updateItem(menu, options);
            }, 10);
        }
        else
            this._updateItem(menu, options);
    }

    private _updateItem(menu: (string | string[] | MenuItem), options?, noRebuild?) {
        let item;
        let items;
        let tItem;
        //If not a string or an array its a menuitem so convert to local variables for easy processing
        if (typeof menu !== 'string' && !Array.isArray(menu)) {
            noRebuild = options;
            options = menu.options;
            menu = menu.menu;
        }
        items = this.getItem(<string | string[]>menu, ItemType.both);
        if (!items) return;
        item = items[0];
        tItem = items[1];
        if (options.hasOwnProperty('enabled')) {
            if (tItem.hasOwnProperty('rootEnabled'))
                tItem.rootEnabled = options.enabled ? true : false;
            else
                item.enabled = options.enabled ? true : false;
        }
        if (options.checked != null)
            item.checked = options.checked ? true : false;
        if (options.icon != null)
            item.icon = options.icon;
        if (options.visible != null)
            item.visible = options.visible ? true : false;
        if (options.position != null)
            item.position = options.position;
        if (options.label != null) {
            item.label = options.label;
            if (!noRebuild)
                this.doUpdate(1);
        }
        if (!tItem.hasOwnProperty('rootEnabled'))
            tItem.enabled = item.enabled;
        tItem.checked = item.checked;
        tItem.icon = item.icon;
        tItem.visible = item.visible;
        tItem.position = item.position;
        tItem.label = item.label;
        if (options.submenu != null) {
            tItem.submenu = options.submenu;
            if (!noRebuild)
                this.doUpdate(1);
        }
        if (tItem.root && !tItem.enabled) {
            tItem.submenu.forEach(f => {
                if (f.hasOwnProperty('rootEnabled'))
                    return f;
                if (!f.hasOwnProperty('enabled'))
                    f.rootEnabled = true;
                else
                    f.rootEnabled = f.enabled || false;
                f.enabled = false;
                return f;
            });
            if (!noRebuild)
                this.doUpdate(1);
        }
        else if (tItem.root && tItem.enabled) {
            tItem.submenu.forEach(f => {
                if (!f.hasOwnProperty('rootEnabled')) return f;
                f.enabled = f.rootEnabled || false;
                delete f.rootEnabled;
                return f;
            });
            if (!noRebuild)
                this.doUpdate(1);
        }
    }

    public updateItems(menuitems: MenuItem[]) {
        this._updateItems(menuitems);
    }

    private _updateItems(menuitems: MenuItem[], noRebuild?) {
        let item;
        let items;
        let tItem;
        const ml = menuitems.length;
        let build = false;
        for (let m = 0; m < ml; m++) {
            items = this.getItem(menuitems[m].menu, ItemType.both);
            if (!items) continue;
            const options = menuitems[m].options;
            item = items[0];
            tItem = items[1];
            if (options.hasOwnProperty('enabled')) {
                if (tItem.hasOwnProperty('rootEnabled'))
                    tItem.rootEnabled = options.enabled ? true : false;
                else
                    item.enabled = options.enabled ? true : false;
            }
            if (options.checked != null)
                item.checked = options.checked ? true : false;
            if (options.icon != null)
                item.icon = options.icon;
            if (options.visible != null)
                item.visible = options.visible ? true : false;
            if (options.position != null)
                item.position = options.position;
            if (options.label != null) {
                item.label = options.label;
                if (!noRebuild)
                    build = build || true;
            }

            if (!tItem.hasOwnProperty('rootEnabled'))
                tItem.enabled = item.enabled;
            tItem.checked = item.checked;
            tItem.icon = item.icon;
            tItem.visible = item.visible;
            tItem.position = item.position;
            tItem.label = item.label;
            if (options.submenu != null) {
                tItem.submenu = options.submenu;
                build = build || true;
            }
            if (tItem.root && !tItem.enabled) {
                tItem.submenu.forEach(f => {
                    if (f.hasOwnProperty('rootEnabled'))
                        return f;
                    if (!f.hasOwnProperty('enabled'))
                        f.rootEnabled = true;
                    else
                        f.rootEnabled = f.enabled || false;
                    f.enabled = false;
                    return f;
                });
                build = build || true;
            }
            else if (tItem.root && tItem.enabled) {
                tItem.submenu.forEach(f => {
                    if (!f.hasOwnProperty('rootEnabled')) return f;
                    f.enabled = f.rootEnabled || false;
                    delete f.rootEnabled;
                    return f;
                });
                build = build || true;
            }
        }
        if (build && !noRebuild)
            this.doUpdate(1);
    }


    public get enabled() {
        return this.$enabled;
    }

    public set enabled(value) {
        if (this.$busy || (this.$updating & 1) === 1) {
            setTimeout(() => {
                this.enabled = value;
            }, 10);
            return;
        }
        if (value === this.$enabled) return;
        this.$busy = true;
        this.$enabled = value;
        this.menu.forEach(i => {
            this._updateItem(i.id || i.label.replace(/&/g, ''), { enabled: value }, true);
        });
        this.doUpdate(1);
        this.$busy = false;
    }

    public rebuild() {
        this._menubar = Menu.buildFromTemplate(this.menu);
        if (this._window)
            this._window.setMenu(this._menubar);
        this.$cache = {};
    }

    private doUpdate(type) {
        if (!type) return;
        this.$updating |= type;
        //no updates or already running so wait until it finishes
        if (this.$updating === 0 || this._rTimeout !== 0)
            return;
        let upFun = () => {
            if ((this.$updating & 1) === 1) {
                this.rebuild();
                this.$updating &= ~1;
            }
            this._rTimeout = 0
            this.doUpdate(this.$updating);
        };
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
            this._rTimeout = window.requestAnimationFrame(upFun);
        else
            this._rTimeout = setTimeout(upFun, 100);
    }

    public set window(value) {
        if (this._window === value) return;
        //clear old window
        if (this._window)
            this._window.setMenu(null);
        this._window = value;
        this._window.setMenu(this._menubar);
    }

    public get window() {
        return this._window;
    }
}