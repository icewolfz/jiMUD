//spell-checker:words vscroll, hscroll, Commandon, cmdfont, isdoor, isclosed, triggernewline, triggerprompt
import EventEmitter = require('events');
import { Client } from './client';
import { parseTemplate, existsSync } from './library';
import { BackupSelection, Log } from './types';
import { ProfileCollection, Profile, Alias, Macro, Button, Trigger, Context } from './profile';
const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');
const LZString = require('lz-string');

/**
 * Control loading and saving system for ShadowMUD remote storage protocols
 *
 * @export
 * @class Backup
 * @extends {EventEmitter}
 */
export class Backup extends EventEmitter {
    private client: Client = null;
    private _abort: boolean = false;
    private _user;
    //private _action;
    private _save;
    private _port;

    public mapFile: string = path.join(parseTemplate('{data}'), 'map.sqlite');

    public loadSelection: BackupSelection = BackupSelection.All;
    public saveSelection: BackupSelection = BackupSelection.All;

    get URL(): string {
        if (this._port === 1035)
            return 'http://shadowmud.com:1132/client';
        return 'http://shadowmud.com:1130/client';
    }

    constructor(client: Client, map?: string) {
        super();
        if (!client)
            throw new Error('Invalid client!');
        this.client = client;
        this.client.telnet.GMCPSupports.push('Client 1');

        this.client.on('connected', () => {
            this._port = this.client.port;
        });

        this.client.on('closed', () => {
            this._port = this.client.port;
        });

        this.client.on('received-GMCP', (mod, obj) => {
            if (mod.toLowerCase() !== 'client' || !obj) return;
            switch (obj.action) {
                case 'save':
                    if (this._abort) return;
                    this._user = obj.user;
                    //this._action = obj.action;
                    this.emit('progress-start', 'Saving data');
                    this._abort = false;
                    //this.save(2);
                    break;
                case 'load':
                    this.client.debug(`Starting load\n    Chunks: ${obj.chunks}\n    Start chunk: ${obj.chunk}\n    Size: ${obj.size}\n`);
                    this._abort = false;
                    this._user = obj.user;
                    //this._action = obj.action;
                    this.emit('progress-start', 'Loading data');
                    this._save = [obj.chunks || 1, obj.chunk || 0, obj.size, ''];
                    //this.getChunk();
                    break;
                case 'error':
                    this.emit('error', obj.error);
                    this.abort();
                    break;
            }
        });
        if (map && map.length > 0)
            this.mapFile = map;
        this._port = this.client.port;
    }

    public save(version?: number) {
        this.client.debug('Map file: ' + this.mapFile);
        const _db = new sqlite3(this.mapFile);
        const rows = _db.prepare('Select * FROM Rooms left join exits on Exits.ID = Rooms.ID').all();
        _db.close();
        const data = {
            version: version,
            profiles: {},
            settings: {
                mapEnabled: this.client.options.mapper.enabled,
                mapFollow: this.client.options.mapper.follow,
                legend: this.client.options.mapper.legend,
                MapperSplitArea: this.client.options.mapper.split,
                MapperFillWalls: this.client.options.mapper.fill,
                vscroll: this.client.options.mapper.vscroll,
                hscroll: this.client.options.mapper.hscroll,
                mapperMemory: this.client.options.mapper.memory,
                showScriptErrors: this.client.options.showScriptErrors,
                title: this.client.options.title,
                flashing: this.client.options.flashing,
                lagMeter: this.client.options.lagMeter,
                enablePing: this.client.options.enablePing,
                parseSingleQuotes: this.client.options.parseSingleQuotes,
                logEnabled: this.client.options.logEnabled,
                logOffline: this.client.options.logOffline,
                logPrepend: this.client.options.logPrepend,
                notifyMSPPlay: this.client.options.notifyMSPPlay,
                bufferSize: this.client.options.bufferSize,
                commandHistorySize: this.client.options.commandHistorySize,
                enableEcho: this.client.options.enableEcho,
                autoConnect: this.client.options.autoConnect,
                autoConnectDelay: this.client.options.autoConnectDelay,
                commandEcho: this.client.options.commandEcho,
                commandStacking: this.client.options.commandStacking,
                htmlLog: (this.client.options.logWhat & Log.Html) === Log.Html,
                keepLastCommand: this.client.options.keepLastCommand,
                enableMXP: this.client.options.enableMXP,
                enableMSP: this.client.options.enableMSP,
                enableMCCP: this.client.options.enableMCCP,
                enableUTF8: this.client.options.enableUTF8,
                enableDebug: this.client.options.enableDebug,
                parseCommands: this.client.options.parseCommands,
                enableSpeedpaths: this.client.options.enableSpeedpaths,
                parseSpeedpaths: this.client.options.parseSpeedpaths,
                parseDoubleQuotes: this.client.options.parseDoubleQuotes,
                logUniqueOnConnect: this.client.options.logUniqueOnConnect,
                enableURLDetection: this.client.options.enableURLDetection,
                CommandonClick: this.client.options.CommandonClick,
                cmdfontSize: this.client.options.cmdfontSize,
                fontSize: this.client.options.fontSize,
                cmdfont: this.client.options.cmdfont,
                font: this.client.options.font,
                commandStackingChar: this.client.options.commandStackingChar,
                speedpathsChar: this.client.options.speedpathsChar,
                commandDelay: this.client.options.commandDelay,
                commandDelayCount: this.client.options.commandDelayCount,
                soundPath: this.client.options.soundPath,
                logPath: this.client.options.logPath,
                scrollLocked: this.client.options.scrollLocked,
                showStatus: this.client.options.showStatus,
                MapperOpen: this.client.options.showMapper,
                showCharacterManager: this.client.options.showCharacterManager,
                logErrors: this.client.options.logErrors,
                showErrorsExtended: this.client.options.showErrorsExtended
            },
            map: {}
        };

        let prop;
        let prop2;

        if (this.client.options.backupAllProfiles) {
            const profiles = new ProfileCollection();
            profiles.loadPath(path.join(parseTemplate('{data}'), 'profiles'));
            data.profiles = profiles.clone(2);
        }
        else
            data.profiles = this.client.profiles.clone(2);

        for (prop in this.client.options) {
            if (!this.client.options.hasOwnProperty(prop)) {
                continue;
            }
            if (prop === 'extensions' || prop === 'mapper' || prop === 'profiles' || prop === 'buttons' || prop === 'chat' || prop === 'find' || prop === 'display') {
                if (!data.settings[prop]) data.settings[prop] = {};
                for (prop2 in this.client.options[prop]) {
                    if (!this.client.options[prop].hasOwnProperty(prop2)) {
                        continue;
                    }
                    data.settings[prop][prop2] = this.client.options[prop][prop2];
                }
            }
            else
                data.settings[prop] = this.client.options[prop];
        }

        const rooms = {};
        if (rows) {
            const rl = rows.length;
            for (let r = 0; r < rl; r++) {
                if (!rows[r].ID || rows[r].ID.length === 0) continue;
                rows[r].ID = parseInt(rows[r].ID, 10);
                if (rooms[rows[r].ID]) {
                    rooms[rows[r].ID].exits[rows[r].Exit] = {
                        num: parseInt(rows[r].DestID, 10),
                        isdoor: rows[r].IsDoor,
                        isclosed: rows[r].IsClosed
                    };
                }
                else {
                    rooms[rows[r].ID] = { num: rows[r].ID };
                    for (prop in rows[r]) {
                        if (prop === 'ID')
                            continue;
                        if (!rows[r].hasOwnProperty(prop)) {
                            continue;
                        }
                        rooms[rows[r].ID][prop.toLowerCase()] = rows[r][prop];
                    }
                    rooms[rows[r].ID].exits = {};
                    if (rows[r].Exit) {
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: parseInt(rows[r].DestID, 10),
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        };
                    }
                }
            }
            this.client.debug('Total mapper room/exits: ' + rows.length);
        }
        else
            this.client.debug('No mapper data to save.');
        data.map = rooms;
        if ((this.saveSelection & BackupSelection.Map) !== BackupSelection.Map) {
            delete data.map;
            this.client.debug('Setting for no mapper data enabled.');
        }
        if ((this.saveSelection & BackupSelection.Profiles) !== BackupSelection.Profiles) {
            delete data.profiles;
            this.client.debug('Setting for no profiles enabled.');
        }
        if ((this.saveSelection & BackupSelection.Settings) !== BackupSelection.Settings) {
            delete data.settings;
            this.client.debug('Setting for no settings data enabled.');
        }
        let jData = JSON.stringify(data);
        jData = LZString.compressToEncodedURIComponent(jData);
        this._save = [jData.match(/((\S|\s|.){1,20000})/g), 0, 0];
        this._save[3] = this._save[0].length;
        this.saveChunk();
    }

    public abort(err?) {
        if (err)
            this.client.debug('client load/save aborted for' + err);
        else
            this.client.debug('client load/save aborted');
        this.emit('abort', err);
        this._save = 0;
        this._abort = true;
        $.ajax({
            type: 'POST',
            url: this.URL,
            data:
            {
                user: this._user,
                a: 'abort'
            }
        });
    }

    public close() {
        this.emit('close');
        this._save = 0;
        this._abort = false;
        $.ajax({
            type: 'POST',
            url: this.URL,
            data:
            {
                user: this._user,
                a: 'done'
            }
        });
    }

    public getChunk() {
        this.client.debug('Requesting client chunk ' + this._save[1]);
        $.ajax(
            {
                type: 'POST',
                url: this.URL,
                data:
                {
                    user: this._user,
                    a: 'get',
                    c: ++this._save[1]
                },
                dataType: 'json',
                success: (data) => {
                    if (this._abort) return;
                    if (!data)
                        this.abort('No data returned');
                    else if (data.error)
                        this.abort(data.error);
                    else {
                        this._save[1] = data.chunk || 0;
                        this._save[3] += data.data || '';
                        this.client.debug('Got client chunk ' + this._save[1]);
                        this.emit('progress', (this._save[1] + 1) / this._save[0] * 100);
                        if (this._save[1] >= this._save[0] - 1)
                            this.finishLoad();
                        else
                            this.getChunk();
                    }
                },
                error: (data, error, errorThrown) => {
                    this.abort(error);
                }
            });
    }

    public saveChunk() {
        $.ajax(
            {
                type: 'POST',
                url: this.URL,
                data:
                {
                    user: this._user,
                    a: 'save',
                    data: this._save[0].shift(),
                    append: (this._save[1] > 0 ? 1 : 0)
                },
                dataType: 'json',
                success: (data) => {
                    if (!data)
                        this.abort('No data returned');
                    else if (data.msg !== 'Successfully saved')
                        this.abort(data.msg || 'Error');
                    else if (this._save[0].length > 0) {
                        this.emit('progress', this._save[1] / this._save[3] * 100);
                        this._save[1]++;
                        this.saveChunk();
                    }
                    else {
                        if (typeof (this._save[2]) === 'function') this._save[2]();
                        this.emit('finish-save');
                        this.close();
                    }
                },
                error: (data, error, errorThrown) => {
                    this.abort(error);
                }
            });
    }

    /*
    public reset() {

    }
    */

    public finishLoad() {
        this.client.debug('Got last chunk, processing data');
        let data = LZString.decompressFromEncodedURIComponent(this._save[3]);
        data = JSON.parse(data);
        if (data.version === 2) {
            if (data.map && (this.loadSelection & BackupSelection.Map) === BackupSelection.Map)
                this.emit('import-map', data.map);

            if (data.profiles && (this.loadSelection & BackupSelection.Profiles) === BackupSelection.Profiles) {
                const profiles = new ProfileCollection();
                const keys = Object.keys(data.profiles);
                const kl = keys.length;
                let n;
                let k = 0;
                for (; k < kl; k++) {
                    n = keys[k];
                    const p = new Profile(n);
                    p.priority = data.profiles[keys[k]].priority;
                    p.enabled = data.profiles[keys[k]].enabled ? true : false;
                    p.enableMacros = data.profiles[keys[k]].enableMacros ? true : false;
                    p.enableTriggers = data.profiles[keys[k]].enableTriggers ? true : false;
                    p.enableAliases = data.profiles[keys[k]].enableAliases ? true : false;
                    p.enableDefaultContext = data.profiles[keys[k]].enableDefaultContext ? true : false;
                    p.macros = [];
                    let l = data.profiles[keys[k]].macros.length;
                    let item;
                    if (l > 0) {
                        for (let m = 0; m < l; m++) {
                            item = new Macro();
                            item.key = data.profiles[keys[k]].macros[m].key;
                            item.value = data.profiles[keys[k]].macros[m].value;
                            item.style = data.profiles[keys[k]].macros[m].style;
                            item.append = data.profiles[keys[k]].macros[m].append ? true : false;
                            item.send = data.profiles[keys[k]].macros[m].send ? true : false;
                            item.name = data.profiles[keys[k]].macros[m].name;
                            item.group = data.profiles[keys[k]].macros[m].group;
                            item.enabled = data.profiles[keys[k]].macros[m].enabled ? true : false;
                            item.modifiers = data.profiles[keys[k]].macros[m].modifiers;
                            item.chain = data.profiles[keys[k]].macros[m].chain ? true : false;
                            item.notes = data.profiles[keys[k]].macros[m].notes || '';
                            p.macros.push(item);
                        }
                    }

                    l = data.profiles[keys[k]].aliases.length;
                    if (l > 0) {
                        for (let m = 0; m < l; m++) {
                            item = new Alias();
                            item.pattern = data.profiles[keys[k]].aliases[m].pattern;
                            item.value = data.profiles[keys[k]].aliases[m].value;
                            item.style = data.profiles[keys[k]].aliases[m].style;
                            item.multi = data.profiles[keys[k]].aliases[m].multi ? true : false;
                            item.append = data.profiles[keys[k]].aliases[m].append ? true : false;
                            item.name = data.profiles[keys[k]].aliases[m].name;
                            item.group = data.profiles[keys[k]].aliases[m].group;
                            item.enabled = data.profiles[keys[k]].aliases[m].enabled ? true : false;
                            item.params = data.profiles[keys[k]].aliases[m].params;
                            item.priority = data.profiles[keys[k]].aliases[m].priority;
                            item.notes = data.profiles[keys[k]].aliases[m].notes || '';
                            p.aliases.push(item);
                        }
                    }

                    l = data.profiles[keys[k]].triggers.length;
                    if (l > 0) {
                        for (let m = 0; m < l; m++) {
                            item = new Trigger();
                            item.pattern = data.profiles[keys[k]].triggers[m].pattern;
                            item.value = data.profiles[keys[k]].triggers[m].value;
                            item.style = data.profiles[keys[k]].triggers[m].style;
                            item.verbatim = data.profiles[keys[k]].triggers[m].verbatim ? true : false;
                            item.name = data.profiles[keys[k]].triggers[m].name;
                            item.group = data.profiles[keys[k]].triggers[m].group;
                            item.enabled = data.profiles[keys[k]].triggers[m].enabled ? true : false;
                            item.priority = data.profiles[keys[k]].triggers[m].priority;
                            item.triggerNewline = data.profiles[keys[k]].triggers[m].triggernewline ? true : false;
                            item.caseSensitive = data.profiles[keys[k]].triggers[m].caseSensitive ? true : false;
                            item.triggerPrompt = data.profiles[keys[k]].triggers[m].triggerprompt ? true : false;
                            item.temp = data.profiles[keys[k]].triggers[m].temp ? true : false;
                            item.type = data.profiles[keys[k]].triggers[m].type;
                            item.notes = data.profiles[keys[k]].triggers[m].notes || '';
                            p.triggers.push(item);
                        }
                    }

                    if (data.profiles[keys[k]].buttons) {
                        l = data.profiles[keys[k]].buttons.length;
                        if (l > 0) {
                            for (let m = 0; m < l; m++) {
                                item = new Button(data.profiles[keys[k]].buttons[m]);
                                p.buttons.push(item);
                            }
                        }
                    }

                    if (data.profiles[keys[k]].contexts) {
                        l = data.profiles[keys[k]].contexts.length;
                        if (l > 0) {
                            for (let m = 0; m < l; m++) {
                                item = new Context(data.profiles[keys[k]].contexts[m]);
                                p.contexts.push(item);
                            }
                        }
                    }
                    profiles.add(p);
                }
                const pf = path.join(parseTemplate('{data}'), 'profiles');
                if (!existsSync(pf))
                    fs.mkdirSync(pf);
                profiles.save(pf);
                //this.client.loadProfiles();
                this.emit('imported-profiles');
            }

            if ((this.loadSelection & BackupSelection.Settings) === BackupSelection.Settings) {
                this.client.options.mapper.enabled = data.settings.mapEnabled ? true : false;
                this.client.options.mapper.follow = data.settings.mapFollow ? true : false;
                this.client.options.mapper.legend = data.settings.legend ? true : false;
                this.client.options.mapper.split = data.settings.MapperSplitArea ? true : false;
                this.client.options.mapper.fill = data.settings.MapperFillWalls ? true : false;
                this.client.options.mapper.vscroll = data.settings.vscroll;
                this.client.options.mapper.hscroll = data.settings.hscroll;
                this.client.options.mapper.memory = data.settings.mapperMemory ? true : false;
                this.client.options.showScriptErrors = data.settings.showScriptErrors ? true : false;
                if (data.settings.title)
                    this.client.options.title = data.settings.title;
                this.client.options.flashing = data.settings.flashing ? true : false;
                this.client.options.lagMeter = data.settings.lagMeter ? true : false;
                this.client.options.enablePing = data.settings.enablePing ? true : false;
                this.client.options.parseSingleQuotes = data.settings.parseSingleQuotes ? true : false;
                this.client.options.logEnabled = data.settings.logEnabled ? true : false;
                this.client.options.logOffline = data.settings.logOffline ? true : false;
                this.client.options.logPrepend = data.settings.logPrepend ? true : false;
                this.client.options.notifyMSPPlay = data.settings.notifyMSPPlay ? true : false;
                this.client.options.bufferSize = data.settings.bufferSize;
                this.client.options.commandHistorySize = data.settings.commandHistorySize;
                this.client.options.enableEcho = data.settings.enableEcho ? true : false;
                this.client.options.autoConnect = data.settings.autoConnect ? true : false;
                this.client.options.autoConnectDelay = data.settings.autoConnectDelay || 600;
                this.client.options.commandEcho = data.settings.commandEcho ? true : false;
                this.client.options.commandStacking = data.settings.commandStacking ? true : false;
                this.client.options.logWhat = data.settings ? Log.Html : Log.None;
                this.client.options.keepLastCommand = data.settings.keepLastCommand ? true : false;
                this.client.options.enableMXP = data.settings.enableMXP ? true : false;
                this.client.options.enableMSP = data.settings.enableMSP ? true : false;
                this.client.options.enableMCCP = data.settings.enableMCCP ? true : false;
                this.client.options.enableUTF8 = data.settings.enableUTF8 ? true : false;
                this.client.options.enableDebug = data.settings.enableDebug ? true : false;
                this.client.options.parseCommands = data.settings.parseCommands ? true : false;
                this.client.options.enableSpeedpaths = data.settings.enableSpeedpaths ? true : false;
                this.client.options.parseSpeedpaths = data.settings.parseSpeedpaths ? true : false;

                this.client.options.parseDoubleQuotes = data.settings.parseDoubleQuotes ? true : false;
                this.client.options.logUniqueOnConnect = data.settings.logUniqueOnConnect ? true : false;
                this.client.options.enableURLDetection = data.settings.enableURLDetection ? true : false;
                this.client.options.CommandonClick = data.settings.CommandonClick ? true : false;
                this.client.options.cmdfontSize = data.settings.cmdfontSize;
                this.client.options.fontSize = data.settings.fontSize;
                this.client.options.cmdfont = data.settings.cmdfont;
                this.client.options.font = data.settings.font;

                this.client.options.commandStackingChar = data.settings.commandStackingChar;
                this.client.options.speedpathsChar = data.settings.speedpathsChar;
                this.client.options.commandDelay = data.settings.commandDelay;
                this.client.options.commandDelayCount = data.settings.commandDelayCount;

                //this.client.options.colors = data.settings.;
                if (data.settings.soundPath)
                    this.client.options.soundPath = data.settings.soundPath;
                if (data.settings.logPath)
                    this.client.options.logPath = data.settings.logPath;

                this.client.options.scrollLocked = data.settings.scrollLocked ? true : false;
                this.client.options.showStatus = data.settings.showStatus ? true : false;
                this.client.options.showMapper = data.settings.MapperOpen ? true : false;
                this.client.options.showCharacterManager = data.settings.showCharacterManager ? true : false;
                this.client.options.logErrors = data.settings.logErrors ? true : false;
                this.client.options.showErrorsExtended = data.settings.showCharacterManager ? true : false;

                let prop;
                let prop2;

                for (prop in this.client.options) {
                    if (!this.client.options.hasOwnProperty(prop) || !data.settings.hasOwnProperty(prop)) {
                        continue;
                    }
                    if (prop === 'extensions' || prop === 'mapper' || prop === 'profiles' || prop === 'buttons' || prop === 'chat' || prop === 'find' || prop === 'display') {
                        for (prop2 in this.client.options[prop]) {
                            if (!this.client.options[prop].hasOwnProperty(prop2)) {
                                continue;
                            }
                            this.client.options[prop][prop2] = data.settings[prop][prop2];
                        }
                    }
                    else if (typeof this.client.options[prop] === 'boolean')
                        this.client.options[prop] = data.settings[prop] ? true : false;
                    else
                        this.client.options[prop] = data.settings[prop];
                }
                //attempt to normalize paths with windows vs linux
                if (process.platform.indexOf('win') === 0) {
                    if (this.client.options.theme.startsWith('{themes}'))
                        this.client.options.theme = this.client.options.theme.replace(/\//g, '\\');
                    if (this.client.options.soundPath.startsWith('{data}'))
                        this.client.options.soundPath = this.client.options.soundPath.replace(/\//g, '\\');
                    if (this.client.options.logPath.startsWith('{data}'))
                        this.client.options.logPath = this.client.options.logPath.replace(/\//g, '\\');
                }
                else {
                    if (this.client.options.theme.startsWith('{themes}'))
                        this.client.options.theme = this.client.options.theme.replace(/\\/g, '/');
                    if (this.client.options.soundPath.startsWith('{data}'))
                        this.client.options.soundPath = this.client.options.soundPath.replace(/\\/g, '/');
                    if (this.client.options.logPath.startsWith('{data}'))
                        this.client.options.logPath = this.client.options.logPath.replace(/\\/g, '/');
                }
                this.client.clearCache();
                this.client.saveOptions();
                this.client.loadOptions();
                this.emit('imported-settings');
            }
        }
        this.emit('finish-load');
        this.close();
    }

}