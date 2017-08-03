/**
 * IED
 *
 * send and receive IED gmcp protocol
 * @arthur William
 */
//cSpell:words fswin, chunksize
import EventEmitter = require('events');
import { Client } from './client';
import { parseTemplate, isDirSync } from './library';
import { FileInfo, IEDError, IEDCmdStatus, TempType } from './types';
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const { ipcRenderer } = require('electron');
let fswin;
if (process.platform.indexOf('win') === 0) {
    try {
        fswin = require('../../lib/fswin');
    }
    catch (err) {
        //console.log('Not windows!');
    }
}
export class IED extends EventEmitter {
    public static windows = process.platform.indexOf('win') === 0;
    private _data = {};
    private _callbacks = {};
    private _worker: Worker;
    private _paths = {};
    private _id: number = 0;
    private _gmcp = [];
    private _temp: TempType = TempType.extension;
    private _activeIdx: number = -1;

    public local;
    public remote;
    public queue: Item[] = [];
    public active: Item;
    public bufferSize: number = 0;

    get useTemp(): TempType { return this._temp; }
    set useTemp(value: TempType) {
        if (value === this._temp) return;
        this._temp = value;
        const ql = this.queue.length;
        for (let q = 0; q < ql; q++)
            this.queue[q].tmp = this._temp;
    }

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
        this._worker = new Worker('./js/ied.background.js');
        this._worker.onmessage = (e) => {
            if (!this.active) return;
            switch (e.data.event) {
                case 'decoded':
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
                        ipcRenderer.send('send-gmcp', 'IED.download.more ' + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: this.active.ID }));
                    }
                    else {
                        this.active.state = ItemState.done;
                        try {
                            this.active.moveFinal();
                            this.active.info = IED.getFileInfo(this.active.local);
                            this.emit('download-finished', this.active);
                            this.emit('message', 'Download complete: ' + this.active.local);
                        }
                        catch (err) {
                            this.emit('error', err);
                        }
                        this.removeActive();
                    }
                    break;
                case 'encoded':
                    ipcRenderer.send('send-gmcp', 'IED.upload.chunk ' + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: this.active.ID, data: e.data.data, last: e.data.last ? 1 : 0 }));
                    if (e.data.last) {
                        this.active.state = ItemState.done;
                        this.emit('upload-finished', this.active);
                        this.emit('message', 'Upload complete: ' + this.active.remote);
                        this.removeActive();
                    }
                    else {
                        this.emit('update', this.active);
                    }
                    break;
            }
        };
        this._worker.onerror = (e) => {
            this.emit('error', e);
        };
    }

    public processGMCP(mod: string, obj) {
        const mods = mod.split('.');
        let item;
        if (mods.length < 2 || mods[0] !== 'IED') return;
        if (this._gmcp.length > 0) {
            this._gmcp.push([mod, obj]);
            return;
        }
        this._gmcp.unshift([mod, obj]);

        switch (mods[1]) {
            case 'init':
                this.emit('init');
                break;
            case 'error':
                switch (obj.code) {
                    case IEDError.DL_NOTSTART:
                    case IEDError.DL_TOOMANY:
                    case IEDError.DL_INPROGRESS:
                        item = this.getItem(obj.tag);
                        if (item)
                            item.state = ItemState.error;
                        this.emit('message', `Download error for '${obj.path}/${obj.file}': ${obj.msg}`);
                        this.emit('update', item);
                        break;
                    case IEDError.DL_INVALIDFMT:
                    case IEDError.DL_UNKNOWN:
                    case IEDError.DL_USERABORT:
                    case IEDError.DL_INVALIDFILE:
                    case IEDError.DL_INVALIDPATH:
                        if (this.active && this.active.ID === obj.tag)
                            this.removeActive();
                        this.emit('message', `Download aborted for '${obj.path}/${obj.file}': ${obj.msg}`);
                        break;
                    case IEDError.RESET:
                        this.emit('message', 'Server reset: ' + obj.msg);
                        this.clear();
                        this.emit('reset');
                        break;
                    case IEDError.USERRESET:
                        this.emit('message', obj.msg);
                        this.clear();
                        this.emit('reset');
                        break;
                    case IEDError.UL_TOOMANY:
                    case IEDError.UL_INPROGRESS:
                        item = this.getItem(obj.tag);
                        item.state = ItemState.error;
                        this.emit('message', `Upload error for '${obj.path}/${obj.file}': ${obj.msg}`);
                        this.emit('update', item);
                        break;
                    case IEDError.UL_INVALIDFMT:
                    case IEDError.UL_USERABORT:
                    case IEDError.UL_BADENCODE:
                    case IEDError.UL_TOOLARGE:
                    case IEDError.UL_FAILWRITE:
                    case IEDError.UL_UNKNOWN:
                    case IEDError.UL_INVALIDFILE:
                    case IEDError.UL_INVALIDPATH:
                    case IEDError.UL_DENIED:
                    case IEDError.UL_FILE:
                        if (this.active && this.active.ID === obj.tag)
                            this.removeActive();
                        this.emit('message', `Upload aborted for '${obj.path}/${obj.file}': ${obj.msg}`);
                        break;
                    case IEDError.CMD_EXIST:
                        if (obj && this._callbacks[obj.tag]) {
                            this._callbacks[obj.tag](obj.path + '/' + obj.file, (obj.tag.startsWith('mkdirIgnore') || obj.tag.startsWith('mkdirPIgnore')) ? IEDCmdStatus.success : IEDCmdStatus.failed);
                            delete this._callbacks[obj.tag];
                        }
                        this.emit('message', `File or directory already exist: '${obj.path}/${obj.file}`);
                        break;
                    case IEDError.CMD_DIRECTORY:
                        if (obj && this._callbacks[obj.tag]) {
                            this._callbacks[obj.tag](obj.path + '/' + obj.file, IEDCmdStatus.failed);
                            delete this._callbacks[obj.tag];
                        }
                        this.emit('message', `File is a directory: '${obj.path}/${obj.file}`);
                        break;
                    case IEDError.CMD_NOEXIST:
                        if (obj && this._callbacks[obj.tag]) {
                            this._callbacks[obj.tag](obj.path + '/' + obj.file, IEDCmdStatus.failed);
                            delete this._callbacks[obj.tag];
                        }
                        this.emit('message', `File or directory does not exist: '${obj.path}/${obj.file}`);
                        break;
                    case IEDError.CMD_FILE:
                        if (obj && this._callbacks[obj.tag]) {
                            this._callbacks[obj.tag](obj.path + '/' + obj.file, IEDCmdStatus.failed);
                            delete this._callbacks[obj.tag];
                        }
                        this.emit('message', `File not a directory: '${obj.path}/${obj.file}`);
                        break;
                }
                this.emit('error', obj);
                break;
            case 'reset':
                this.clear();
                this.emit('reset');
                break;
            case 'resolved':
                this.emit('resolved', obj.path, obj.tag || '');
                switch (obj.tag || '') {
                    case 'dir:browse':
                        this.getDir(obj.path, true);
                        break;
                    case 'deleteDir':
                        this.deleteDirectory(obj.path, false);
                        break;
                    case 'deleteDirFiles':
                        this.deleteDirectory(obj.path, false, true);
                        break;
                    case 'delete':
                        this.deleteFile(obj.path + '/' + obj.file);
                        break;
                    case 'rename':
                        ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: path.dirname(this._data['rename']), file: path.basename(this._data['rename']), tag: 'rename2' }));
                        this.emit('message', 'Resolving: ' + this._data['rename']);
                        this._data['rename'] = obj.path + '/' + obj.file;
                        break;
                    case 'rename2':
                        this.rename(this._data['rename'], obj.path + '/' + obj.file);
                        break;
                    default:
                        if (obj.tag) {
                            if (obj.tag.startsWith('download:'))
                                this.download(obj.path + '/' + obj.file, false, obj.tag);
                            else if (obj.tag.startsWith('downloadTo:'))
                                this.download(obj.path + '/' + obj.file, false, obj.tag);
                            else if (obj.tag.startsWith('downloadMkdir:'))
                                this.download(obj.path + '/' + obj.file, false, obj.tag, true);
                            else if (obj.tag.startsWith('downloadToMkdir:'))
                                this.download(obj.path + '/' + obj.file, false, obj.tag, true);
                            else if (obj.tag.startsWith('upload:'))
                                this.upload(obj.path + '/' + obj.file, false, obj.tag);
                            else if (obj.tag.startsWith('uploadTo:'))
                                this.upload(obj.path + '/' + obj.file, false, obj.tag);
                            else if (obj.tag.startsWith('uploadMkdir:'))
                                this.upload(obj.path + '/' + obj.file, false, obj.tag, true);
                            else if (obj.tag.startsWith('uploadToMkdir:'))
                                this.upload(obj.path + '/' + obj.file, false, obj.tag, true);
                            else if (obj.tag.startsWith('mkdir:'))
                                this.makeDirectory(obj.path + '/' + obj.file, false, false, this._callbacks[obj.tag]);
                            else if (obj.tag.startsWith('mkdirIgnore:'))
                                this.makeDirectory(obj.path + '/' + obj.file, false, true, this._callbacks[obj.tag]);
                            else if (obj.tag.startsWith('mkdirP:'))
                                this.makeDirectoryParent(obj.path + '/' + obj.file, false, false, this._callbacks[obj.tag]);
                            else if (obj.tag.startsWith('mkdirPIgnore:'))
                                this.makeDirectoryParent(obj.path + '/' + obj.file, false, true, this._callbacks[obj.tag]);
                            else if (obj.tag.startsWith('dir:'))
                                this.getDir(obj.path, true, obj.tag.substr(4));
                        }
                        break;
                }
                break;
            case 'dir':
                if (!obj) {
                    this.emit('error', { msg: 'Getting Directory: no data found' });
                    this.nextGMCP();
                    return;
                }
                else if (!obj.files) {
                    this.emit('error', { path: obj.path, tag: obj.tag, msg: 'Getting Directory: no files found' });
                    this.nextGMCP();
                    return;
                }
                const files = this._data[obj.tag || 'dir'] || [];
                files.push.apply(files, obj.files || []);
                if (!obj.last) {
                    this._data[obj.tag || 'dir'] = files;
                    ipcRenderer.send('send-gmcp', 'IED.dir.more ' + JSON.stringify({ path: obj.path, tag: obj.tag || 'dir' }));
                }
                else {
                    delete this._data[obj.tag || 'dir'];
                    this.emit('dir', obj.path, files, obj.tag || 'dir');
                }
                break;
            case 'download':
                if (mods.length > 2) {
                    switch (mods[2]) {
                        case 'init':
                            this.emit('message', 'Download initialize: ' + obj.path + '/' + obj.file);
                            this.active.totalSize = obj.size;
                            if (this.active.totalSize < 1)
                                this.removeActive();
                            break;
                        case 'chunk':
                            if (!this.active) {
                                this.emit('error', 'Download chunk error');
                                this.nextGMCP();
                                return;
                            }
                            this.active.chunks++;
                            this._worker.postMessage({ action: 'decode', file: obj.path + '/' + obj.file, download: true, last: obj.last, data: obj.data });
                            if (obj.last)
                                this.emit('message', 'Download last chunk: ' + obj.path + '/' + obj.file);
                            else
                                this.emit('message', 'Download chunk ' + this.active.chunks + ': ' + obj.path + '/' + obj.file);
                            break;
                    }
                }
                break;
            case 'upload':
                if (mods.length > 2) {
                    switch (mods[2]) {
                        case 'request':
                            this.uploadChunk(obj);
                            break;
                    }
                    break;
                }
                break;
            case 'cmd':
                if (mods.length > 2 && mods[2] === 'status') {
                    if (obj && this._callbacks[obj.tag]) {
                        this._callbacks[obj.tag](obj.path + '/' + obj.file, obj.code);
                        delete this._callbacks[obj.tag];
                    }
                    this.emit('cmd', obj);
                }
                else if (obj && this._callbacks[obj.tag]) {
                    this._callbacks[obj.tag](obj.path + '/' + obj.file, IEDCmdStatus.failed);
                    delete this._callbacks[obj.tag];
                }
                break;
        }
        this.nextGMCP();
    }

    private nextGMCP() {
        this._gmcp.shift();
        if (this._gmcp.length > 0) {
            const iTmp = this._gmcp.shift();
            setTimeout(() => {
                this.processGMCP(iTmp[0], iTmp[1]);
            }, 0);
        }
    }

    public getDir(dir: string, noResolve?: boolean, tag?) {
        if (noResolve) {
            ipcRenderer.send('send-gmcp', 'IED.dir ' + JSON.stringify({ path: dir, tag: 'dir:' + (tag || 'browse') }));
            this.emit('message', 'Getting Directory: ' + dir);
        }
        else {
            delete this._data['browse'];
            ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: dir, file: '', tag: 'dir:' + (tag || 'browse') }));
            this.emit('message', 'Resolving: ' + dir);
        }
    }

    public download(file, resolve?: boolean, tag?: string, mkdir?: boolean) {
        if (!resolve) {
            let item;
            if (tag)
                item = new Item(tag);
            else {
                item = new Item('download:' + this._id);
                this._id++;
            }
            item.tmp = this._temp;
            item.download = true;
            item.remote = file;
            item.mkdir = mkdir;
            if (this._paths[tag]) {
                item.local = path.join(this._paths[tag], path.basename(file));
                delete this._paths[tag];
            }
            else
                item.local = path.join(this.local, path.basename(file));
            this.addItem(item);
        }
        else {
            if (mkdir) {
                this._paths['downloadMkdir:' + this._id] = this.local;
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: path.dirname(file), file: path.basename(file), tag: 'downloadMkdir:' + this._id }));
            }
            else {
                this._paths['download:' + this._id] = this.local;
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: path.dirname(file), file: path.basename(file), tag: 'download:' + this._id }));
            }
            this._id++;
            this.emit('message', 'Resolving: ' + file);
        }
    }

    public downloadTo(file, local, resolve?: boolean, tag?: string, mkdir?: boolean) {
        if (!resolve) {
            let item;
            if (tag)
                item = new Item(tag);
            else {
                item = new Item('download:' + this._id);
                this._id++;
            }
            item.tmp = this._temp;
            item.download = true;
            item.remote = file;
            item.mkdir = mkdir;
            if (this._paths[tag]) {
                item.local = path.join(this._paths[tag], path.basename(file));
                delete this._paths[tag];
            }
            else
                item.local = path.join(local, path.basename(file));
            this.addItem(item);
        }
        else {
            if (mkdir) {
                this._paths['downloadMkdir:' + this._id] = local;
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: path.dirname(file), file: path.basename(file), tag: 'downloadMkdirTo:' + this._id }));
            }
            else {
                this._paths['download:' + this._id] = local;
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: path.dirname(file), file: path.basename(file), tag: 'downloadTo:' + this._id }));
            }
            this._id++;
            this.emit('message', 'Resolving: ' + file);
        }
    }

    public upload(file, resolve?: boolean, tag?: string, mkdir?: boolean) {
        if (!resolve) {
            let item;
            if (tag)
                item = new Item(tag);
            else {
                item = new Item('upload:' + this._id);
                this._id++;
            }
            item.mkdir = mkdir;
            if (this._paths[tag]) {
                item.local = this._paths[tag];
                item.remote = file;
            }
            else {
                item.local = file;
                item.remote = this.remote + '/' + path.basename(file);
            }
            item.tmp = this._temp;
            item.info = IED.getFileInfo(item.local);
            item.totalSize = item.info.size;
            this.addItem(item);
        }
        else {
            if (mkdir) {
                this._paths['uploadMkdir:' + this._id] = file;
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: this.remote, file: path.basename(file), tag: 'uploadMkdir:' + this._id }));
            }
            else {
                this._paths['upload:' + this._id] = file;
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: this.remote, file: path.basename(file), tag: 'upload:' + this._id }));
            }
            this._id++;
            this.emit('message', 'Resolving: ' + file);
        }
    }

    public uploadTo(file, remote, resolve?: boolean, tag?: string, mkdir?: boolean) {
        if (!resolve) {
            let item;
            if (tag)
                item = new Item(tag);
            else {
                item = new Item('upload:' + this._id);
                this._id++;
            }
            item.mkdir = mkdir;
            if (this._paths[tag]) {
                item.local = this._paths[tag];
                item.remote = remote;
            }
            else {
                item.local = file;
                item.remote = remote;
            }
            item.tmp = this._temp;
            item.info = IED.getFileInfo(item.local);
            item.totalSize = item.info.size;
            this.addItem(item);
        }
        else {
            if (mkdir) {
                this._paths['uploadToMkdir:' + this._id] = file;
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: remote, file: path.basename(remote), tag: 'uploadToMkdir:' + this._id }));
            }
            else {
                this._paths['uploadTo:' + this._id] = file;
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: remote, file: path.basename(remote), tag: 'uploadTo:' + this._id }));
            }
            this._id++;
            this.emit('message', 'Resolving: ' + file);
        }
    }

    public deleteFile(file, resolve?: boolean) {
        if (resolve) {
            ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: path.dirname(file), file: path.basename(file), tag: 'delete' }));
            this.emit('message', 'Resolving: ' + file);
        }
        else {
            ipcRenderer.send('send-gmcp', 'IED.cmd ' + JSON.stringify({ cmd: 'rm', path: path.dirname(file), file: path.basename(file), tag: 'delete' }));
            this.emit('message', 'Deleting: ' + file);
        }
    }

    public deleteDirectory(file, resolve?: boolean, files?: boolean) {
        if (resolve) {
            if (files)
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: file, tag: 'deleteDirFiles' }));
            else
                ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: file, tag: 'deleteDir' }));
            this.emit('message', 'Resolving: ' + file);
        }
        else if (files) {
            this.getDir(file, !resolve, 'delete');
        }
        else {
            ipcRenderer.send('send-gmcp', 'IED.cmd ' + JSON.stringify({ cmd: 'rmdir', path: file, tag: 'deleteDir' }));
            this.emit('message', 'Deleting: ' + file);
        }
    }

    public rename(file, file2, resolve?: boolean) {
        if (resolve) {
            this._data['rename'] = file2;
            ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: path.dirname(file), file: path.basename(file), tag: 'rename' }));
            this.emit('message', 'Resolving: ' + file);
        }
        else {
            ipcRenderer.send('send-gmcp', 'IED.cmd ' + JSON.stringify({ cmd: 'mv', path: path.dirname(file), file: path.basename(file), path2: path.dirname(file2), file2: path.basename(file2), tag: 'rename' }));
            this.emit('message', 'Renaming: ' + file + ' to ' + file2);
        }
    }

    public makeDirectory(file, resolve?: boolean, ignore?: boolean, callback?) {
        if (callback)
            this._callbacks[(ignore ? 'mkdirIgnore' : 'mkdir') + this._id] = callback;
        if (resolve) {
            ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: path.dirname(file), file: path.basename(file), tag: (ignore ? 'mkdirIgnore' : 'mkdir') + this._id }));
            this.emit('message', 'Resolving: ' + file);
        }
        else {
            ipcRenderer.send('send-gmcp', 'IED.cmd ' + JSON.stringify({ cmd: 'mkdir', path: file, tag: (ignore ? 'mkdirIgnore' : 'mkdir') + this._id }));
            this.emit('message', 'Creating directory: ' + file);
        }
        this._id++;
    }

    public makeDirectoryParent(file, resolve?: boolean, ignore?: boolean, callback?) {
        if (callback)
            this._callbacks[(ignore ? 'mkdirPIgnore' : 'mkdirP') + this._id] = callback;
        if (resolve) {
            ipcRenderer.send('send-gmcp', 'IED.resolve ' + JSON.stringify({ path: path.dirname(file), file: path.basename(file), tag: (ignore ? 'mkdirPIgnore' : 'mkdirP') + this._id }));
            this.emit('message', 'Resolving: ' + file);
        }
        else {
            ipcRenderer.send('send-gmcp', 'IED.cmd ' + JSON.stringify({ cmd: 'mkdirP', args: '-p', path: file, tag: (ignore ? 'mkdirPIgnore' : 'mkdirP') + this._id }));
            this.emit('message', 'Creating directory: ' + file);
        }
        this._id++;
    }

    public static isHidden(p, skipwin?: boolean) {
        const basename = path.basename(p);
        let dirname = path.dirname(p);
        if (dirname === '.') dirname = '';
        if (basename[0] === '.')
            return true;
        if (skipwin)
            return false;
        if (IED.windows) {
            const a = fswin.getAttributesSync(p);
            if (!a) return false;
            return a.IS_HIDDEN;
        }
        return false;
    }

    public static getFileInfo(file: string) {
        const info: FileInfo = {
            path: file,
            name: path.basename(file),
            size: 0,
            type: path.extname(file)
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
        info.hidden = IED.isHidden(info.path);
        if (stat.isDirectory()) {
            info.type = 'Directory';
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

    public static invalidFile(file: string) {
        if (IED.windows)
            return file.match(/[^0-9a-zA-Z^&'@\{\}\[\],$=!#\(\)%.+~_\s.-]/g);
        return file.match(/[/\0]/g);
    }

    public removeActive() {
        if (this.active) {
            if (this.active.state !== ItemState.done && this.active.download)
                ipcRenderer.send('send-gmcp', 'IED.download.abort ' + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: this.active.ID }));
            else if (this.active.state !== ItemState.done)
                ipcRenderer.send('send-gmcp', 'IED.upload.abort ' + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: this.active.ID }));
            this.emit('remove', this.active);
            this.active.clean();
            this.active = null;
            this.queue.splice(this._activeIdx, 1);
            this._activeIdx = -1;
        }
        this.nextItem();
    }

    public addItem(item) {
        this.emit('add', item);
        this.queue.push(item);
        if (!this.active)
            this.nextItem();
        else {
            if (item.download)
                this.emit('message', 'Download queried: ' + item.remote);
            else
                this.emit('message', 'Upload queried: ' + item.remote);
        }
    }

    public reset() {
        ipcRenderer.send('send-gmcp', 'IED.reset ' + JSON.stringify({ msg: 'Requested reset' }));
        this._id++;
        this.emit('message', 'Requesting reset');
    }

    public clear() {
        if (this.active) {
            this.active.clean();
            this.active = null;
            this._activeIdx = -1;
        }
        this.queue = [];
        this._paths = {};
        this._id = 0;
        this._gmcp = [];
        this.startWorker();
        this._data = {};
        this._callbacks = {};
    }

    public startItem(id) {
        const ql = this.queue.length;
        for (let q = 0; q < ql; q++) {
            if (this.queue[q].ID === id) {
                this.queue[q].state = ItemState.working;
                this.emit('update', this.queue[q]);
                break;
            }
        }
        this.nextItem();
    }

    public pauseItem(id) {
        const ql = this.queue.length;
        for (let q = 0; q < ql; q++) {
            if (this.queue[q].ID === id) {
                this.queue[q].state = ItemState.paused;
                this.emit('update', this.queue[q]);
                break;
            }
        }
        this.nextItem();
    }

    public getItem(id) {
        const ql = this.queue.length;
        for (let q = 0; q < ql; q++) {
            if (this.queue[q].ID === id)
                return this.queue[q];
        }
        return null;
    }

    public removeItem(id) {
        let q;
        let ql;
        if (this.active && this.active.ID === id) {
            this.removeActive();
            return;
        }
        for (q = 0, ql = this.queue.length; q < ql; q++) {
            if (this.queue[q].ID === id) {
                if (this.queue[q].download) {
                    ipcRenderer.send('send-gmcp', 'IED.download.abort ' + JSON.stringify({ path: path.dirname(this.queue[q].remote), file: path.basename(this.queue[q].remote), tag: this.queue[q].ID }));
                    this.emit('message', 'Download request abort: ' + this.queue[q].remote);
                }
                else {
                    ipcRenderer.send('send-gmcp', 'IED.upload.abort ' + JSON.stringify({ path: path.dirname(this.queue[q].remote), file: path.basename(this.queue[q].remote), tag: this.queue[q].ID }));
                    this.emit('message', 'Upload request abort: ' + this.queue[q].remote);
                }
                this.emit('remove', this.queue[q]);
                this.queue.splice(q, 1);
                if (q >= this._activeIdx)
                    this._activeIdx--;
                break;
            }
        }
        this.nextItem();
    }

    public nextItem() {
        //already working on an item so just bail
        if (this.active && this.active.state === ItemState.working) return;
        this.active = null;
        this._activeIdx = -1;
        const ql = this.queue.length;
        for (let q = 0; q < ql; q++) {
            if (this.queue[q].state !== ItemState.working) continue;
            this.active = this.queue[q];
            this._activeIdx = q;
            break;
        }
        if (!this.active) return;
        if (this.active.download) {
            if (!this.active.inProgress) {
                this.active.inProgress = true;
                ipcRenderer.send('send-gmcp', 'IED.download ' + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: this.active.ID }));
                this.emit('message', 'Download start: ' + this.active.remote);
            }
            else {
                ipcRenderer.send('send-gmcp', 'IED.download.more ' + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: this.active.ID }));
                this.emit('message', 'Download resume: ' + this.active.remote);
            }
        }
        if (this.active.inProgress) {
            this.uploadChunk(this.active.obj);
        }
        else {
            this.active.inProgress = true;
            ipcRenderer.send('send-gmcp', 'IED.upload ' + JSON.stringify({ path: path.dirname(this.active.remote), file: path.basename(this.active.remote), tag: this.active.ID, size: this.active.totalSize, mkdir: this.active.mkdir }));
            this.emit('message', 'Upload start: ' + this.active.remote);
        }
    }

    public uploadChunk(obj) {
        if (!obj) return;
        let data;
        let size = obj.chunksize;
        const item = this.getItem(obj.tag);
        if (!item) return;
        if (item.state !== ItemState.working)
            return;
        item.obj = obj;
        if (this.bufferSize > 0 && this.bufferSize < size)
            size = this.bufferSize;
        try {
            data = item.read(size);
        }
        catch (err) {
            this.emit('error', err);
            this.nextGMCP();
            return;
        }
        item.currentSize += data.length;
        item.chunks++;
        this._worker.postMessage({
            action: 'encode',
            file: obj.path + '/' + obj.file,
            download: false,
            last: (data.length < size || item.currentSize === item.totalSize),
            data: data
        });
        if (data.length < size || item.currentSize === item.totalSize)
            this.emit('message', 'Upload last chunk: ' + obj.path + '/' + obj.file);
        else
            this.emit('message', 'Upload chunk ' + item.chunks + ': ' + obj.path + '/' + obj.file);
    }
}

export enum ItemState {
    stopped = 0,
    paused = 1,
    done = 2,
    working = 3,
    error = 4
}

export interface FileInfo {
    date?: Date;
    hidden?: boolean;
    path: string;
    name: string;
    type: string;
    size: number;
}

export class Item {
    private _local: string = '';
    private _tmp: TempType = TempType.extension;
    private _tmpObj;
    private append = false;
    private stream;

    public obj;
    public remote: string = '';
    public info: FileInfo;
    public totalSize: number = 0;
    public currentSize: number = 0;
    public waiting: boolean = false;
    public download: boolean = false;
    public ID: string = '';
    public state: ItemState = ItemState.working;
    public inProgress = false;
    public chunks: number = 0;
    public mkdir: boolean = false;

    constructor(id: string, download?: boolean) {
        this.ID = id;
        this.download = download;
    }

    get tmp(): TempType { return this._tmp; }
    set tmp(value: TempType) {
        if (value !== this._tmp) {
            if (this._tmp === TempType.file && this._tmpObj) {
                this._tmpObj.removeCallback();
                this._tmpObj = null;
            }
            this._tmp = value;
            if (value === TempType.file)
                this._tmpObj = tmp.fileSync({ prefix: 'jiMUD-' });
        }
    }

    get temp(): string {
        return this._tmpObj ? this._tmpObj.name : null;
    }

    get local(): string { return this._local; }
    set local(value: string) {
        const dir = IED.sanitizePath(path.dirname(value));
        const file = IED.sanitizeFile(path.basename(value));
        this._local = path.join(dir, file);
    }

    get percent(): number {
        return this.totalSize ? (Math.round(this.currentSize / this.totalSize * 100) / 100) : 0;
    }

    public read(size: number, callback?: any) {
        const position = this.currentSize;
        if (!this.stream)
            this.stream = fs.openSync(this._local, 'r+');
        let buffer: Buffer;
        let br;
        if (position + size > this.totalSize) {
            buffer = new Buffer(this.totalSize - position);
            br = fs.readSync(this.stream, buffer, 0, this.totalSize - position, position);
        }
        else {
            buffer = new Buffer(size);
            br = fs.readSync(this.stream, buffer, 0, size, position);
        }
        return buffer.toString();
    }

    public write(data: string) {
        if (!this.stream) {
            if (this.mkdir) {
                const parts = path.dirname(this._local).split(path.sep);
                const pl = parts.length;
                let c = '';
                let p = 0;
                //windows only, if drive letter move to next
                if (IED.windows && parts.length > 0 && parts[0].endsWith(':')) {
                    p++;
                    c = parts[0];
                }
                for (; p < pl; p++) {
                    c = path.join(c, parts[p]);
                    if (!isDirSync(c))
                        fs.mkdirSync(c);
                }
            }
            if (this.tmp === TempType.file && this._tmpObj)
                this.stream = fs.openSync(this._tmpObj.name, this.append ? 'a' : 'w');
            else if (this.tmp === TempType.extension)
                this.stream = fs.openSync(this._local + '.tmp', this.append ? 'a' : 'w');
            else
                this.stream = fs.openSync(this._local, this.append ? 'a' : 'w');
        }
        fs.writeSync(this.stream, data);
        this.append = true;
    }

    public moveFinal() {
        this.clean();
        if (this.tmp === TempType.file && this._tmpObj) {
            fs.renameSync(this._tmpObj.name, this._local);
            this._tmpObj.removeCallback();
            this._tmpObj = null;
        }
        else if (this.tmp === TempType.extension)
            fs.renameSync(this._local + '.tmp', this._local);
        this.append = true;
    }

    public clean() {
        if (this.stream)
            this.stream = fs.closeSync(this.stream);
    }

}
