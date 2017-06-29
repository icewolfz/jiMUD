//cSpell:words fswin, chunksize
import EventEmitter = require('events');
import { Client } from "./client";
import { parseTemplate } from "./library";
import { FileInfo, IEDError } from "./types";
const fs = require("fs");
const path = require("path");
const fswin = require('../../lib/fswin');
const { ipcRenderer } = require('electron');


export class IED extends EventEmitter {
    public static windows = process.platform.indexOf("win") === 0;
    private _data = {};
    private _worker: Worker;
    private _paths = {};
    private _id: number = 0;
    private _gmcp = [];

    public local;
    public remote;
    public queue: Item[] = [];
    public active: Item;
    public bufferSize: number = 0;

    constructor(local: string, remote: string) {
        super();
        this.local = local;
        this.remote = remote;
        this.startWorker();
    }

    private startWorker() {
        if (this._worker) {
            this._worker.terminate();
            delete this._worker;
        }
        this._worker = new Worker('./js/IED.background.js');
        this._worker.onmessage = (e) => {
            if (!this.active) return;
            switch (e.data.event) {
                case "decoded":
                    if (e.data.download) {
                        this.active.currentSize += e.data.data.length;
                        try {
                            this.active.write(e.data.data);
                        }
                        catch (err) {
                            this.emit('error', err);
                        }
                    }
                    this.emit('update', this.active);
                    if (!e.data.last) {
                        ipcRenderer.send('send-gmcp', "IED.download.more " + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: this.active.ID }));
                    }
                    else {
                        try {
                            this.active.moveFinal();
                            this.emit('download-finished', this.active.local);
                            this.emit('message', "Download complete: " + this.active.local);
                        }
                        catch (err) {
                            this.emit('error', err);
                        }
                        this.removeActive();
                    }
                    break;
                case "encoded":
                    ipcRenderer.send('send-gmcp', "IED.upload.chunk " + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: this.active.ID, data: e.data.data, last: e.data.last }));
                    if (e.data.last) {
                        this.emit('upload-finished', this.active.remote);
                        this.emit('message', "Upload complete: " + this.active.remote);
                        this.removeActive();
                    }
                    else {
                        this.emit('update', this.active);
                    }
                    break;
            }
        }
        this._worker.onerror = (e) => {
            this.emit('error', e);
        };
    }

    public processGMCP(mod: string, obj) {
        var mods = mod.split(".");
        if (mods.length < 2 || mods[0] != "IED") return;
        if (this._gmcp.length > 0) {
            this._gmcp.push([mod, obj]);
            return;
        }
        this._gmcp.unshift([mod, obj]);

        switch (mods[1]) {
            case "error":
                switch (obj.code) {
                    case IEDError.DL_INPROGRESS:
                    case IEDError.DL_NOTSTART:
                    case IEDError.DL_TOOMANY:
                    case IEDError.DL_UNKNOWN:
                    case IEDError.DL_USERABORT:
                    case IEDError.DL_INVALIDFILE:
                    case IEDError.DL_INVALIDPATH:
                        this.removeActive();
                        this.emit('message', `Download aborted for '${obj.path}/${obj.file}': ${obj.msg}`);
                        break
                    case IEDError.RESET:
                        this.emit('message', "Server reset: " + obj.msg);
                        this.active = null;
                        this._paths = {};
                        this._id = 0;
                        this._gmcp = [];
                        this.startWorker();
                        this.emit('reset');
                        break;
                    case IEDError.USERRESET:
                        this.emit('message', obj.msg);
                        this.active = null;
                        this._paths = {};
                        this._id = 0;
                        this._gmcp = [];
                        this.startWorker();
                        this.emit('reset');
                        break;
                    case IEDError.UL_USERABORT:
                    case IEDError.UL_BADENCODE:
                    case IEDError.UL_TOOLARGE:
                    case IEDError.UL_FAILWRITE:
                    case IEDError.UL_UNKNOWN:
                    case IEDError.UL_INVALIDFILE:
                    case IEDError.UL_INVALIDPATH:
                        this.removeActive();
                        this.emit('message', `Upload aborted for '${obj.path}/${obj.file}': ${obj.msg}`);
                        break
                }
                this.emit('error', obj);
                break;
            case 'reset':
                this.active = null;
                this._paths = {};
                this._id = 0;
                this._gmcp = [];
                this.startWorker();
                this.emit('reset');
                break;
            case 'resolved':
                this.emit('resolved', obj.path, obj.tag || "");
                switch (obj.tag || "") {
                    case "browse":
                        this.getDir(obj.path, true);
                        break;
                    default:
                        if (obj.tag && obj.tag.startsWith('download:'))
                            this.download(obj.path + "/" + obj.file, false, obj.tag);
                        else if (obj.tag && obj.tag.startsWith('upload:'))
                            this.upload(obj.path + "/" + obj.file, false, obj.tag);
                        break;
                }
                break;
            case 'dir':
                if (!obj) {
                    this.emit('error', { msg: 'Getting Directory: no data found' })
                    return;
                }
                else if (!obj.files) {
                    this.emit('error', { path: obj.path, tag: obj.tag, msg: "Getting Directory: no files found" });
                    return;
                }
                let files = this._data[obj.tag || "dir"] || [];
                files.push.apply(files, obj.files || []);
                if (!obj.last) {
                    this._data[obj.tag || "dir"] = files;
                    ipcRenderer.send('send-gmcp', "IED.dir.more " + JSON.stringify({ path: obj.path, tag: obj.tag || "dir" }));
                }
                else {
                    delete this._data[obj.tag || "dir"];
                    this.emit('dir', obj.path, files, obj.tag || "dir");
                }
                break;
            case 'download':
                if (mods.length > 2) {
                    switch (mods[2]) {
                        case "init":
                            this.emit('message', "Download initialize: " + obj.path + "/" + obj.file);
                            this.active.totalSize = obj.size;
                            if (this.active.totalSize < 1)
                                this.removeActive();
                            break;
                        case "chunk":
                            if (!this.active) {
                                this.emit('error', 'Download chunk error');
                                return;
                            }
                            this.active.chunks++;
                            this._worker.postMessage({ action: 'decode', file: obj.path + "/" + obj.file, download: true, last: obj.last, data: obj.data });
                            if (obj.last)
                                this.emit('message', "Download last chunk: " + obj.path + "/" + obj.file);
                            else
                                this.emit('message', "Download chunk " + this.active.chunks + ": " + obj.path + "/" + obj.file);
                            break;
                    }
                }
                break;
            case 'upload':
                if (mods.length > 2) {
                    switch (mods[2]) {
                        case "request":
                            let data;
                            let size = obj.chunksize;
                            if (this.bufferSize > 0 && this.bufferSize < size)
                                size = this.bufferSize;
                            try {
                                data = this.active.read(size);
                            }
                            catch (err) {
                                this.emit('error', err);
                                return;
                            }
                            this.active.currentSize += data.length;
                            this.active.chunks++;
                            this._worker.postMessage({
                                action: 'encode',
                                file: obj.path + "/" + obj.file,
                                download: false,
                                last: (data.length < size || this.active.currentSize == this.active.totalSize),
                                data: data
                            });
                            if (data.length < size || this.active.currentSize == this.active.totalSize)
                                this.emit('message', "Upload last chunk: " + obj.path + "/" + obj.file);
                            else
                                this.emit('message', "Upload chunk " + this.active.chunks + ": " + obj.path + "/" + obj.file);
                            break;
                    }
                    break;
                }
        }
        this._gmcp.shift();
        if (this._gmcp.length > 0) {
            var iTmp = this._gmcp.shift();
            setTimeout(() => {
                this.processGMCP(iTmp[0], iTmp[1]);
            }, 0);
        }
    }

    public getDir(dir: string, noResolve?: boolean) {
        if (noResolve) {
            ipcRenderer.send('send-gmcp', "IED.dir " + JSON.stringify({ path: dir, tag: 'browse' }));
            this.emit('message', "Getting Directory: " + dir);
        }
        else {
            delete this._data["browse"];
            ipcRenderer.send('send-gmcp', "IED.resolve " + JSON.stringify({ path: dir, file: "", tag: 'browse' }));
            this.emit('message', "Resolving: " + dir);
        }
    }

    public download(file, resolve?: boolean, tag?: string) {
        if (!resolve) {
            let item;
            if (tag)
                item = new Item(tag);
            else {
                item = new Item('download:' + this._id);
                this._id++;
            }
            item.download = true;
            item.remote = file;
            if (this._paths[tag]) {
                item.local = path.join(this._paths[tag], path.basename(file));
                delete this._paths[tag];
            }
            else
                item.local = path.join(this.local, path.basename(file));
            this.addItem(item);
        }
        else {
            this._paths["download:" + this._id] = this.local;
            ipcRenderer.send('send-gmcp', "IED.resolve " + JSON.stringify({ path: path.dirname(file), file: path.basename(file), tag: 'download:' + this._id }));
            this._id++;
            this.emit('message', "Resolving: " + file);
        }
    }

    public upload(file, resolve?: boolean, tag?: string) {
        if (!resolve) {
            let item;
            if (tag)
                item = new Item(tag);
            else {
                item = new Item('upload:' + this._id);
                this._id++;
            }
            if (this._paths[tag]) {
                item.local = this._paths[tag];
                item.remote = file;
            }
            else {
                item.local = file;
                item.remote = path.join(this.remote, path.basename(file));
            }
            item.info = IED.getFileInfo(item.local);
            item.totalSize = item.info.size;
            this.addItem(item);
        }
        else {
            this._paths["upload:" + this._id] = file;
            ipcRenderer.send('send-gmcp', "IED.resolve " + JSON.stringify({ path: this.remote, file: path.basename(file), tag: 'upload:' + this._id }));
            this._id++;
            this.emit('message', "Resolving: " + file);
        }
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

    public static sanitizePath(p: string) {
        //if (IED.windows)
        //return p.replace(/[^0-9a-zA-Z^&'@\{\}\[\],$=!#\(\)%.+~_\\:.\s-]/g, '_');
        //return p.replace(/[/\0]/g, '_');
        return p;
    }

    public static sanitizeFile(file: string) {
        if (IED.windows)
            return file.replace(/[^0-9a-zA-Z^&'@\{\}\[\],$=!#\(\)%.+~_\s.-]/g, '_');
        return file.replace(/[/\0]/g, '_');
    }

    public removeActive() {
        if (this.active) {
            this.emit('remove', this.active);
            this.active = null;
        }
        if (this.queue.length > 0) {
            this.active = this.queue.shift();
            if (this.active.download) {
                ipcRenderer.send('send-gmcp', "IED.download " + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: 'download' }));
                this.emit('message', "Download start: " + this.active.remote);
            }
            else {
                ipcRenderer.send('send-gmcp', "IED.upload " + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: 'upload', size: this.active.totalSize }));
                this.emit('message', "Upload start: " + this.active.remote);
            }
        }
    }

    public addItem(item) {
        this.emit('add', item);
        if (!this.active) {
            this.active = item;
            if (item.download) {
                ipcRenderer.send('send-gmcp', "IED.download " + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: 'download' }));
                this.emit('message', "Download start: " + this.active.remote);
            }
            else {
                ipcRenderer.send('send-gmcp', "IED.upload " + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: 'upload', size: this.active.totalSize }));
                this.emit('message', "Upload start: " + this.active.remote);
            }
        }
        else {
            this.queue.push(item);
            if (item.download)
                this.emit('message', "Download queried: " + this.active.remote);
            else
                this.emit('message', "Upload queried: " + this.active.remote);
        }
    }

    public reset() {
        ipcRenderer.send('send-gmcp', "IED.reset " + JSON.stringify({ msg: 'Requested reset' }));
        this._id++;
        this.emit('message', "Requesting reset");

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
    public chunks: number = 0;

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
        return this.totalSize ? (Math.round(this.currentSize / this.totalSize * 100) / 100) : 0
    }

    public read(size: number, callback?: any);
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
            fs.renameSync(this._local + ".tmp", this._local)
        this.append = true;
    }

    public clean() {
        if (this.stream)
            this.stream = fs.closeSync(this.stream);
    }

}
