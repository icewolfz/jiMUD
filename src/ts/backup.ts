//cSpell:words vscroll, hscroll, Commandon, cmdfont, isdoor, isclosed, triggernewline, triggerprompt
import EventEmitter = require('events');
import { Client } from "./client";
import { parseTemplate } from "./library";
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const LZString = require("lz-string");
const { ProfileCollection, Profile, Alias, Macro, Button, Trigger, MacroDisplay, MacroModifiers, ItemStyle } = require('./profile');

export enum BackupSelection {
    None = 0,
    Map = 2,
    Profiles = 4,
    Settings = 8,
    All = Map | Profiles | Settings
}

export class Backup extends EventEmitter {
    private client: Client = null;
    private _url: string = "http://shadowmud.com:"
    private _abort: boolean = false;
    private _user;
    private _action;
    private _save;

    public loadSelection: BackupSelection = BackupSelection.All;
    public saveSelection: BackupSelection = BackupSelection.All;

    constructor(client: Client) {
        super();
        if (!client)
            throw "Invalid client!";
        this.client = client;
        if (this.client.port == 1035)
            this._url += "1132/client";
        else
            this._url += "1130/client";
        this.client.telnet.GMCPSupports.push("Client 1");

        this.client.on('connected', () => {
            this.reset();
        });

        this.client.on('closed', () => {
            this.reset();
        });

        this.client.on('received-GMCP', (mod, obj) => {
            if (mod.toLowerCase() != "client") return;
            switch (obj.action) {
                case "save":
                    if (this._abort) return;
                    this._user = obj.user;
                    this._action = obj.action;
                    this.emit('progress-start', "Saving data");
                    this._abort = false;
                    this.save(2);
                    break;
                case "load":
                    this._abort = false;
                    this._user = obj.user;
                    this._action = obj.action;
                    this.emit('progress-start', "Loading data");
                    this._save = [obj.chunks, obj.chunk, obj.size, ""];
                    this.getChunk();
                    break;
                case "error":
                    this.emit('error', obj.error);
                    this.abort();
                    break;
            }
        });
    }

    save(version?: number) {
        var _db = new sqlite3.Database(path.join(parseTemplate("{data}"), "map.sqlite"));
        _db.all("Select * FROM Rooms inner join exits on Exits.ID = Rooms.ID", (err, rows) => {
            var data = {
                version: version,
                profiles: this.client.profiles.clone(2),
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
                    commandEcho: this.client.options.commandEcho,
                    commandStacking: this.client.options.commandStacking,
                    htmlLog: this.client.options.htmlLog,
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
                    MapperOpen: this.client.options.showMapper
                },
                map: {}
            };

            var rooms = {};
            if (rows) {
                var rl = rows.length;
                for (var r = 0; r < rl; r++) {
                    if (rooms[rows[r].ID]) {
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        }
                    }
                    else {
                        rooms[rows[r].ID] = { num: rows[r].ID };
                        for (var prop in rows[r]) {
                            if (prop == "ID")
                                continue;
                            if (!rows[r].hasOwnProperty(prop)) {
                                continue;
                            }
                            rooms[rows[r].ID][prop.toLowerCase()] = rows[r][prop];
                        }
                        rooms[rows[r].ID].exits = {};
                        rooms[rows[r].ID].exits[rows[r].Exit] = {
                            num: rows[r].DestID,
                            isdoor: rows[r].IsDoor,
                            isclosed: rows[r].IsClosed
                        }
                    }
                }
            }
            data.map = rooms;
            if ((this.saveSelection & BackupSelection.Map) != BackupSelection.Map)
                delete data.map;
            if ((this.saveSelection & BackupSelection.Profiles) != BackupSelection.Profiles)
                delete data.profiles;
            if ((this.saveSelection & BackupSelection.Settings) != BackupSelection.Settings)
                delete data.settings;
            var jData = JSON.stringify(data);
            jData = LZString.compressToEncodedURIComponent(jData);
            this._save = [jData.match(/((\S|\s|.){1,20000})/g), 0, 0];
            this._save[3] = this._save[0].length;
            this.saveChunk();

        });
    }

    abort(err?) {
        this.emit('abort', err);
        this._save = 0;
        this._abort = true;
        $.ajax({
            type: 'POST',
            url: this._url,
            data:
            {
                'user': this._user,
                'a': 'abort'
            }
        });
    }

    close() {
        this.emit('close');
        this._save = 0;
        this._abort = false;
        $.ajax({
            type: 'POST',
            url: this._url,
            data:
            {
                'user': this._user,
                'a': 'done'
            }
        });
    }

    getChunk() {
        $.ajax(
            {
                type: 'POST',
                url: this._url,
                data:
                {
                    'user': this._user,
                    'a': 'get',
                    'c': ++this._save[1]
                },
                dataType: 'json',
                success: (data) => {
                    if (this._abort) return;
                    if (!data)
                        this.abort(data.error);
                    else if (data.error)
                        this.abort(data.error);
                    else {
                        this._save[1] = data.chunk||0;
                        this._save[3] += data.data||0;
                        this.emit('progress', (this._save[1] + 1) / this._save[0] * 100)
                        if (this._save[1] >= this._save[0] - 1)
                            this.finishLoad();
                        else
                            this.getChunk();
                    }
                },
                error: (data, error, errorThrown) =>    {
                    this.abort(error);
                }
            });
    }

    saveChunk() {
        $.ajax(
            {
                type: 'POST',
                url: this._url,
                data:
                {
                    'user': this._user,
                    'a': 'save',
                    'data': this._save[0].shift(),
                    'append': (this._save[1] > 0 ? 1 : 0)
                },
                dataType: 'json',
                success: (data) => {
                    if (!data)
                        this.abort();
                    else if (data.msg !== "Successfully saved")
                        this.abort(data.msg || "Error");
                    else if (this._save[0].length > 0) {
                        this.emit('progress', this._save[1] / this._save[3] * 100)
                        this._save[1]++;
                        this.saveChunk();
                    }
                    else {
                        if (typeof (this._save[2]) === "function") this._save[2]();
                        this.close();
                    }
                },
                error: (data, error, errorThrown) => {
                    this.abort(error);
                }
            });
    }

    reset() {

    }

    finishLoad() {
        var data = LZString.decompressFromEncodedURIComponent(this._save[3]);
        data = JSON.parse(data);
        if (data.version == 2) {
            if (data.map && (this.loadSelection & BackupSelection.Map) == BackupSelection.Map)
                this.emit('import-map', data.map);

            if (data.profiles && (this.loadSelection & BackupSelection.Profiles) == BackupSelection.Profiles) {
                var profiles = new ProfileCollection();
                var keys = Object.keys(data.profiles);
                var n, k = 0, kl = keys.length;
                for (; k < kl; k++) {
                    n = keys[k];
                    var p = new Profile(n);
                    p.priority = data.profiles[keys[k]].priority;
                    p.enabled = data.profiles[keys[k]].enabled ? true : false;
                    p.enableMacros = data.profiles[keys[k]].enableMacros ? true : false;
                    p.enableTriggers = data.profiles[keys[k]].enableTriggers ? true : false;
                    p.enableAliases = data.profiles[keys[k]].enableAliases ? true : false;
                    p.macros = [];
                    var l = data.profiles[keys[k]].macros.length;
                    if (l > 0) {
                        for (var m = 0; m < l; m++) {
                            var item = new Macro();
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
                        for (var m = 0; m < l; m++) {
                            var item = new Alias();
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
                        for (var m = 0; m < l; m++) {
                            var item = new Trigger();
                            item.pattern = data.profiles[keys[k]].triggers[m].pattern;
                            item.value = data.profiles[keys[k]].triggers[m].value;
                            item.style = data.profiles[keys[k]].triggers[m].style;
                            item.verbatim = data.profiles[keys[k]].triggers[m].verbatim ? true : false;
                            item.name = data.profiles[keys[k]].triggers[m].name;
                            item.group = data.profiles[keys[k]].triggers[m].group;
                            item.enabled = data.profiles[keys[k]].triggers[m].enabled ? true : false;
                            item.priority = data.profiles[keys[k]].triggers[m].priority;
                            item.triggerNewline = data.profiles[keys[k]].triggers[m].triggernewline ? true : false;
                            item.triggerPrompt = data.profiles[keys[k]].triggers[m].triggerprompt ? true : false;
                            item.type = data.profiles[keys[k]].triggers[m].type;
                            item.notes = data.profiles[keys[k]].triggers[m].notes || '';
                            p.triggers.push(item);
                        }
                    }

                    if (data.profiles[keys[k]].buttons) {
                        l = data.profiles[keys[k]].buttons.length;
                        if (l > 0) {
                            for (var m = 0; m < l; m++) {
                                var item = new Button(data.profiles[keys[k]].buttons[m]);
                                p.triggers.push(item);
                            }
                        }
                    }
                    profiles.add(p);
                }
                var p = path.join(parseTemplate("{data}"), "profiles");
                if (!fs.existsSync(p))
                    fs.mkdirSync(p);
                profiles.save(p);
                //this.client.loadProfiles();
                this.emit('imported-profiles');
            }

            if ((this.loadSelection & BackupSelection.Settings) != BackupSelection.Settings) {
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
                this.client.options.commandEcho = data.settings.commandEcho ? true : false;
                this.client.options.commandStacking = data.settings.commandStacking ? true : false;
                this.client.options.htmlLog = data.settings.htmlLog ? true : false;
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
                this.client.options.enableURLDetection = data.settings.enableURLDetection  ? true : false;
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

                this.client.clearTriggerCache();
                this.client.saveOptions();
                this.client.loadOptions();
                this.emit('imported-settings');
            }
        }
        this.emit('finish-load');
        this.close();
    }

}