"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require('path');
const fs = require('fs');
class Mapper {
    constructor() {
        this.enabled = true;
        this.follow = true;
        this.legend = false;
        this.split = false;
        this.fill = false;
        this.room = false;
        this.vscroll = 0;
        this.hscroll = 0;
        this.active = {
            ID: null,
            x: 0,
            y: 0,
            z: 0,
            area: null,
            zone: 0
        };
    }
}
exports.Mapper = Mapper;
class Profiles {
    constructor() {
        this.split = -1;
        this.askoncancel = true;
        this.triggersAdvanced = false;
        this.aliasesAdvanced = false;
        this.buttonsAdvanced = false;
        this.macrosAdvanced = false;
    }
}
exports.Profiles = Profiles;
class Settings {
    constructor() {
        this.AutoCopySelectedToClipboard = false;
        this.askonclose = true;
        this.dev = false;
        this.mapper = new Mapper();
        this.profiles = new Profiles();
        this.showScriptErrors = false;
        this.title = "$t";
        this.flashing = false;
        this.lagMeter = true;
        this.enablePing = true;
        this.parseSingleQuotes = false;
        this.logEnabled = false;
        this.logOffline = false;
        this.logPrepend = false;
        this.notifyMSPPlay = false;
        this.bufferSize = 5000;
        this.commandHistorySize = 20;
        this.enableEcho = true;
        this.autoConnect = true;
        this.commandEcho = true;
        this.enableAliases = true;
        this.enableTriggers = true;
        this.enableButtons = true;
        this.enableMacros = true;
        this.commandStacking = true;
        this.htmlLog = true;
        this.keepLastCommand = true;
        this.enableMXP = true;
        this.enableMSP = true;
        this.enableMCCP = true;
        this.enableUTF8 = true;
        this.enableDebug = false;
        this.parseCommands = true;
        this.enableSpeedpaths = true;
        this.parseSpeedpaths = true;
        this.parseDoubleQuotes = true;
        this.logUniqueOnConnect = true;
        this.enableURLDetection = true;
        this.CommandonClick = true;
        this.cmdfontSize = "1em";
        this.fontSize = "1em";
        this.cmdfont = "'Courier New', Courier, monospace";
        this.font = "'Courier New', Courier, monospace";
        this.commandStackingChar = ';';
        this.speedpathsChar = '!';
        this.commandDelay = 500;
        this.commandDelayCount = 5;
        this.colors = [];
        this.soundPath = path.join("{data}", "sounds");
        this.logPath = path.join("{data}", "logs");
        this.windows = {};
        this.buttons = {
            connect: true,
            preferences: true,
            log: true,
            clear: true,
            lock: true,
            map: true,
            user: true
        };
        this.scrollLocked = false;
        this.showStatus = true;
        this.showMapper = false;
        this.showEditor = false;
        this.showArmor = false;
        this.showStatusWeather = true;
        this.showStatusLimbs = true;
        this.showStatusHealth = true;
        this.showStatusExperience = true;
        this.showStatusPartyHealth = true;
        this.showStatusCombatHealth = true;
        this.showButtonBar = true;
    }
    static load(file) {
        if (!fs.existsSync(file))
            return new Settings();
        var data = fs.readFileSync(file, 'utf-8');
        if (data.length == 0)
            return new Settings();
        try {
            data = JSON.parse(data);
        }
        catch (e) {
            return new Settings();
        }
        var settings = new Settings();
        for (var prop in data) {
            if (!data.hasOwnProperty(prop)) {
                continue;
            }
            if (prop == 'mapper' || prop == 'profiles' || prop == 'buttons') {
                for (var prop2 in data[prop]) {
                    if (!data[prop].hasOwnProperty(prop2)) {
                        continue;
                    }
                    settings[prop][prop2] = data[prop][prop2];
                }
            }
            else
                settings[prop] = data[prop];
        }
        return settings;
    }
    static getColors() {
        var _ColorTable = [];
        var r, g, b, idx;
        for (r = 0; r < 6; r++) {
            for (g = 0; g < 6; g++) {
                for (b = 0; b < 6; b++) {
                    idx = 16 + (r * 36) + (g * 6) + b;
                    _ColorTable[idx] = "rgb(";
                    if (r > 0)
                        _ColorTable[idx] += r * 40 + 55;
                    else
                        _ColorTable[idx] += "0";
                    _ColorTable[idx] += ",";
                    if (g > 0)
                        _ColorTable[idx] += g * 40 + 55;
                    else
                        _ColorTable[idx] += "0";
                    _ColorTable[idx] += ",";
                    if (b > 0)
                        _ColorTable[idx] += b * 40 + 55;
                    else
                        _ColorTable[idx] += "0";
                    _ColorTable[idx] += ")";
                }
            }
        }
        for (r = 232; r <= 255; r++) {
            g = (r - 232) * 10 + 8;
            _ColorTable[r] = ["rgb(", g, ",", g, ",", g, ")"].join('');
        }
        _ColorTable[0] = "rgb(0,0,0)"; //black fore
        _ColorTable[1] = "rgb(128, 0, 0)"; //red fore
        _ColorTable[2] = "rgb(0, 128, 0)"; //green fore
        _ColorTable[3] = "rgb(128, 128, 0)"; //yellow fore
        _ColorTable[4] = "rgb(0, 0, 238)"; //blue fore
        _ColorTable[5] = "rgb(128, 0, 128)"; //magenta fore
        _ColorTable[6] = "rgb(0, 128, 128)"; //cyan fore
        _ColorTable[7] = "rgb(187, 187, 187)"; //white fore
        _ColorTable[8] = "rgb(128, 128, 128)"; //black  bold
        _ColorTable[9] = "rgb(255, 0, 0)"; //Red bold
        _ColorTable[10] = "rgb(0, 255, 0)"; //green bold
        _ColorTable[11] = "rgb(255, 255, 0)"; //yellow bold
        _ColorTable[12] = "rgb(92, 92, 255)"; //blue bold
        _ColorTable[13] = "rgb(255, 0, 255)"; //magenta bold
        _ColorTable[14] = "rgb(0, 255, 255)"; //cyan bold
        _ColorTable[15] = "rgb(255, 255, 255)"; //white bold
        _ColorTable[256] = "rgb(0, 0, 0)"; //black faint
        _ColorTable[257] = "rgb(118, 0, 0)"; //red  faint
        _ColorTable[258] = "rgb(0, 108, 0)"; //green faint
        _ColorTable[259] = "rgb(145, 136, 0)"; //yellow faint
        _ColorTable[260] = "rgb(0, 0, 167)"; //blue faint
        _ColorTable[261] = "rgb(108, 0, 108)"; //magenta faint
        _ColorTable[262] = "rgb(0, 108, 108)"; //cyan faint
        _ColorTable[263] = "rgb(161, 161, 161)"; //white faint
        _ColorTable[264] = "rgb(0, 0, 0)"; //BackgroundBlack
        _ColorTable[265] = "rgb(128, 0, 0)"; //red back
        _ColorTable[266] = "rgb(0, 128, 0)"; //greenback
        _ColorTable[267] = "rgb(128, 128, 0)"; //yellow back
        _ColorTable[268] = "rgb(0, 0, 238)"; //blue back
        _ColorTable[269] = "rgb(128, 0, 128)"; //magenta back
        _ColorTable[270] = "rgb(0, 128, 128)"; //cyan back
        _ColorTable[271] = "rgb(187, 187, 187)"; //white back
        _ColorTable[272] = "rgb(0,0,0)"; //iceMudInfoBackground
        _ColorTable[273] = "rgb(0, 255, 255)"; //iceMudInfoText
        _ColorTable[274] = "rgb(0,0,0)"; //LocalEchoBackground
        _ColorTable[275] = "rgb(255, 255, 0)"; //LocalEchoText
        _ColorTable[276] = "rgb(0, 0, 0)"; //DefaultBack
        _ColorTable[277] = "rgb(229, 229, 229)"; //DefaultFore
        _ColorTable[278] = "rgb(205, 0, 0)"; //ErrorFore
        _ColorTable[279] = "rgb(229, 229, 229)"; //ErrorBack
        _ColorTable[280] = "rgb(255,255,255)"; //DefaultBrightFore
        return _ColorTable;
    }
    save(file) {
        fs.writeFileSync(file, JSON.stringify(this));
    }
}
exports.Settings = Settings;
