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

    constructor(menu: any[], window?: Electron.BrowserWindow) {
        if (!window)
            this.window = remote.getCurrentWindow();
        else
            this.window = window;
        this.menu = menu;
        this.rebuild();
    }

    public getItem(menu: (string | string[]), type?: ItemType) {
        let item;
        let i = 0;
        let items;
        let tItem;
        let tItems;
        if (!menu) return null;
        if (!Array.isArray(menu))
            menu = menu.split('|');
        items = this._menubar.items;
        tItems = this.menu;
        let il = menu.length;
        let f = 0;
        for (i = 0; i < il; i++) {
            if (!menu[i] || !items || items.length === 0) break;            
            let ml = items.length;
            for (let m = 0; m < ml; m++) {
                if (!items[m]) continue;
                if (items[m].id === menu[i] || (items[m].label || '').toLowerCase().replace(/&/g, '') === menu[i].toLowerCase()) {
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
        if (type === ItemType.both)
            return [item, tItem];
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

        if (options.enabled != null)
            item.enabled = options.enabled ? true : false;
        if (options.checked != null)
            item.checked = options.checked ? true : false;
        if (options.icon != null)
            item.icon = options.icon;
        if (options.visible != null)
            item.visible = options.visible ? true : false;
        if (options.position != null)
            item.position = options.position;

        tItem.enabled = item.enabled;
        tItem.checked = item.checked;
        tItem.icon = item.icon;
        tItem.visible = item.visible;
        tItem.position = item.position;

        if (options.submenu != null) {
            tItem.submenu = options.submenu;
            this.rebuild();
        }
    }

    public rebuild() {
        this._menubar = Menu.buildFromTemplate(this.menu);
        this.window.setMenu(this._menubar);
    }
}