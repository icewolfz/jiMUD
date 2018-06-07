import { remote } from 'electron';
const { Menu, MenuItem, BrowserWindow } = remote;

export enum ItemType {
    menu = 0,
    raw = 1,
    both = 2
}

export class Menubar {
    public window: Electron.BrowserWindow;
    public menu: any[];
    private _menubar;
    private $cache = {};
    private $updating;
    private $enabled = true;

    constructor(menu: any[], window?: Electron.BrowserWindow) {
        if (!window)
            this.window = remote.getCurrentWindow();
        else
            this.window = window;
        this.menu = (menu || []).map(i => {
            i.root = true;
            return i;
        });
        this.doUpdate(1);
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
                if (items[m].id === menu[i] || (items[m].label || '').toLowerCase().replace(/&/g, '') === menu[i]) {
                    item = items[m];
                    tItem = tItems[m];
                    if (item.submenu) {
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

    public updateItem(menu: (string | string[]), options) {
        let item;
        let items;
        let tItem;
        if (!menu) return;

        items = this.getItem(menu, ItemType.both);
        if (!items) return;
        item = items[0];
        tItem = items[1];

        if (options.enabled != null) {
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

        if (tItem.hasOwnProperty('rootEnabled'))
            tItem.rootEnabled = item.enabled;
        else
            tItem.enabled = item.enabled;
        tItem.checked = item.checked;
        tItem.icon = item.icon;
        tItem.visible = item.visible;
        tItem.position = item.position;

        if (tItem.root && !tItem.enabled) {
            tItem.submenu.map(f => {
                if (!f.hasOwnProperty('enabled'))
                    f.rootEnabled = true;
                else
                    f.rootEnabled = f.enabled;
                f.enabled = false;
                return f;
            });
            this.doUpdate(1);
        }
        else if (tItem.root && tItem.enabled) {
            tItem.submenu.map(f => {
                f.enabled = f.rootEnabled;
                delete f.rootEnabled;
                return f;
            });
            this.doUpdate(1);
        }
        if (options.submenu != null) {
            tItem.submenu = options.submenu;
            this.doUpdate(1);
        }
    }

    public get enabled() {
        return this.$enabled;
    }

    public set enabled(value) {
        if (value === this.$enabled) return;
        this.$enabled = value;
        this.menu.map(i => {
            this.updateItem(i.label.replace(/&/g, ''), { enabled: value });
        });
    }

    public rebuild() {
        this._menubar = Menu.buildFromTemplate(this.menu);
        this.window.setMenu(this._menubar);
        this.$cache = {};
    }

    private doUpdate(type) {
        if (!type) return;
        this.$updating |= type;
        if (this.$updating === 0)
            return;
        window.requestAnimationFrame(() => {
            if ((this.$updating & 1) === 1) {
                this.rebuild();
                this.$updating &= ~1;
            }
            this.doUpdate(this.$updating);
        });
    }
}