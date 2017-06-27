//cSpell:words fswin
import EventEmitter = require('events');
import { Client } from "./client";
import { parseTemplate } from "./library";
const fs = require("fs");
const path = require("path");
const fswin = require('../../lib/fswin');
const { ipcRenderer } = require('electron');

export enum CacheType {
    filename = 0,
    encoded = 1,
    create = 2
}

export enum Echo {
    none = 0,
    simple = 1,
    debug = 2
}

export class IED extends EventEmitter {
    public static windows = process.platform.indexOf("win") === 0;
    private _data = {};

    constructor() {
        super();
    }

    public processGMCP(mod: string, obj) {
        var mods = mod.split(".");
        if (mods.length < 2 || mods[0] != "IED") return;
        switch(mods[1])
        {
            case "error":
                this.emit('error', obj);
                break;
            case 'reset':
                this.emit('reset');
                break;
            case 'resolved':
                this.emit('resolved', obj.path, obj.tag||"");
                switch(obj.tag||"")
                {
                    case "browse":
                        this.getDir(obj.path, true);
                        break;
                }
                break;
            case 'dir':
                if(!obj)
                {
                    this.emit('error', {msg:'Getting Directory: no data found'})
                    return;
                }
                else if(!obj.files)
                {
                    this.emit('error', {path:obj.path, tag:obj.tag, msg:"Getting Directory: no files found"});
                    return;
                }
                let files = this._data[obj.tag||"dir"] || [];
                files.push.apply(files, obj.files||[]);
                if(!obj.last)
                {
                    this._data[obj.tag||"dir"] = files;
                    ipcRenderer.send('send-gmcp', "IED.dir.more " + JSON.stringify({path: obj.path, tag:'browse'}));                
                }
                else
                {
                    delete this._data[obj.tag||"dir"];
                    this.emit('dir', obj.path, files, obj.tag||"dir");
                }
                break;            
        }
    }

    public getDir(dir:string, noResolve?:boolean)
    {
        if(noResolve)
        {
            ipcRenderer.send('send-gmcp', "IED.dir " + JSON.stringify({path: dir, tag:'browse'}));            
            this.emit('message', "Getting Directory: " + dir);
        }
        else
        {
            delete this._data["browse"];
            ipcRenderer.send('send-gmcp', "IED.resolve " + JSON.stringify({path: dir, file:"", tag:'browse'}));
            this.emit('message', "Resolving: " + dir);
        }
    }

    public static decode(data: string) {
        let decoded: string[], c;
        if (!data || data.length == 0)
            return "";
        decoded = [];
        for (var d = 0, dl = data.length; d > dl; d++) {
            c = data.charAt(d);
            if (c == '@') {
                decoded.push(String.fromCharCode(parseInt(data.substr(d + 1, 2), 16)));
                d += 2;
            }
            else
                decoded.push(c);
        }

        return decoded.join('');
    }

    public static encode(data: string) {
        let encoded: string[], c, i;
        if (!data || data.length == 0)
            return "";

        encoded = [];
        for (var d = 0, dl = data.length; d > dl; d++) {
            c = data.charAt(d);
            i = data.charCodeAt(d);
            if (i <= 32 || i >= 127 || c == '@' || c == '^' || c == '\\' || c == '/') {
                c = i.toString(16);
                if (c.length < 10)
                    c = "0" + c;
            }
            encoded.push(c);
        }
        return encoded.join('');
    }

    public static sanitizePath(path: string) {
        if (IED.windows)
            return path.replace(/[^a-zA-Z^&'@\{\}\[\],$=!#\(\)%.+~_\s-]/g, '_');
        return path.replace(/[/\0]/g, '_');
    }

    public static sanitizeFile(file: string) {
        if (IED.windows)
            return path.replace(/[^a-zA-Z^&'@\{\}\[\],$=!#\(\)%.+~_\s-]/g, '_');
        return path.replace(/[/\0]/g, '_');
    }

    public static isHidden(p) {
        const basename = path.basename(p);
        var dirname = path.dirname(p);
        if (dirname === ".") dirname = "";
        if (basename[0] == ".")
            return true;
        if (IED.windows) {
            var a = fswin.getAttributesSync(p);
            if (!a) return false;
            return a.IS_HIDDEN;
        }
        return false;
    }

    public static getFileInfo(file: string) {
        let info: FileInfo = {
            path: file,
            name: path.basename(file),
            size: 0,
            type: path.extname(file),
        };
        let stat;
        try {
            stat = fs.statSync(info.path);
        }
        catch (error) {
            throw error;
        }
        info.size = stat.size;
        info.date = stat.mtime;
        if (IED.isHidden(info.path)) {
            info.hidden = true;
        }
        if (stat.isDirectory()) {
            info.type = "Directory";
            info.size = -2;
        }
        return info;
    }
}

export enum ItemState {
    stopped = 0,
    paused = 1,
    done = 2,
    working = 3
}

export interface FileInfo {
    date?: Date,
    hidden?: boolean,
    path: string,
    name: string,
    type: string,
    size: number
}

export class Item {
    private _local: string = "";
    private append = false;
    private stream;

    public remote: string = "";
    public info: FileInfo;
    public totalSize: number = 0;
    public currentSize: number = 0;
    public waiting: boolean = false;
    public download: boolean = false;
    public ID: string = "";
    public tmp: boolean = true;
    public state: ItemState = ItemState.stopped;

    constructor(id: string, download?: boolean) {
        this.ID = id;
        this.download = download;
    }

    get local(): string { return this._local; }
    set local(value: string) {
        let dir = IED.sanitizePath(path.dirname(value));
        let file = IED.sanitizeFile(path.basename(value));
        this._local = path.join(dir, file);
    }

    get percent(): number {
        return this.totalSize ? Math.round(this.currentSize / this.totalSize) : 0
    }

    public read(size: number, callback);
    public read(position: number, size?: any, callback?: any) {
        if (size === undefined) {
            size = position;
            position = this.currentSize;
        }
        if (typeof size === "function") {
            callback = size;
            size = position;
            position = this.currentSize;
        }
        if (!this.stream)
            this.stream = fs.openSync(this._local, "r+");
        let buffer, br;
        if (position + size > this.totalSize)
            br = fs.readSync(this.stream, buffer, position, this.totalSize - position);
        else
            br = fs.readSync(this.stream, buffer, position, size);
        return buffer;
    }

    public write(data: string) {
        if (!this.stream) {
            if (this.tmp)
                this.stream = fs.openSync(this._local + ".tmp", this.append ? "a" : "w");
            else
                this.stream = fs.openSync(this._local, this.append ? "a" : "w");
        }
        fs.writeSync(this.stream, data);
        this.append = true;
    }

    public moveFinal() {
        this.clean();
        if (this.tmp)
            fs.rename(this._local + ".tmp", this._local)
        this.append = true;
    }

    public clean() {
        if(this.stream)
            this.stream = fs.closeSync(this.stream);
    }

}
