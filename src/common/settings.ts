//cSpell:words vscroll, hscroll, askoncancel, askonclose,commandon, cmdfont
//cSpell:ignore emoteto, emotetos
import { NewLineType, Log, BackupSelection, TrayClick } from './types';
const path = require('path');
const fs = require('fs');

export class Mapper {
    public enabled: boolean = true;
    public follow: boolean = true;
    public legend: boolean = false;
    public split: boolean = false;
    public fill: boolean = false;
    public room: boolean = false;
    public importType = 1;
    public vscroll: number = 0;
    public hscroll: number = 0;
    public memory: boolean = false;
    public memorySavePeriod: number = 900000;
    public active =
    {
        ID: null,
        x: 0,
        y: 0,
        z: 0,
        area: null,
        zone: 0
    };

}

export class Profiles {
    public split: number = -1;
    public askoncancel: boolean = true;
    public triggersAdvanced: boolean = false;
    public aliasesAdvanced: boolean = false;
    public buttonsAdvanced: boolean = false;
    public macrosAdvanced: boolean = false;
    public contextsAdvanced: boolean = false;
    public enabled: string[] = [];
    public codeEditor: boolean = true;
}

export class Chat {
    //chat lines
    public captureLines: boolean = false;
    public captureAllLines: boolean = false;
    //reviews for lines, tell or talking
    public captureReviews: boolean = false;
    //tell and emotetos
    public captureTells: boolean = false;
    //Say, whisper, yells, and speak
    public captureTalk: boolean = false;
    //list of lines to capture
    public lines: string[] = [];
    public log: boolean = false;
    public gag: boolean = true;
}

export class Status {
    public show: boolean = true;
    public showArmor: boolean = false;
    public showWeather: boolean = true;
    public showLimbs: boolean = true;
    public showHealth: boolean = true;
    public showExperience: boolean = true;
    public showPartyHealth: boolean = true;
    public showCombatHealth: boolean = true;
    public experienceNeededProgressbar: boolean = false;
    public allowNegativeNumberNeeded = false;
    public lagMeter: boolean = true;
    public ping: boolean = true;
}

export class Logging {
    public enabled: boolean = false;
    public offline: boolean = false;
    public prepend: boolean = false;
    public gagged: boolean = false;
    public timeFormat: string = 'YYYYMMDD-HHmmss';
    public what: Log = Log.Html;
    public errors: boolean = true;
    public uniqueOnConnect: boolean = true;
    public path = path.join('{data}', 'logs');
}

/*
format: setting, key, type, default value, max length
types:
0 string
1 boolean
2 number
3 raw setting
4 custom
5 combo-box
*/
export let SettingList: any[] = [
    ['bufferSize', 0, 2, 5000],
    ['commandDelay', 0, 2, 500],
    ['commandDelayCount', 0, 2, 5],
    ['commandHistorySize', 0, 2, 20],
    ['fontSize', 0, 0, '1em', 0],
    ['cmdfontSize', 0, 0, '1em', 0],
    ['commandEcho', 0, 1, true],
    ['flashing', 0, 1, false],
    ['autoConnect', 0, 1, true],
    ['enableAliases', -1, 1, true],
    ['enableTriggers', -1, 1, true],
    ['enableMacros', -1, 1, true],
    ['showScriptErrors', 0, 1, false],
    ['commandStacking', 0, 1, true],
    ['commandStackingChar', 0, 0, ';', 1],
    ['htmlLog', 0, 1, true],
    ['keepLastCommand', 0, 1, true],
    ['enableMCCP', 0, 1, true],
    ['enableUTF8', 0, 1, true],
    ['font', 0, 5, '\'Courier New\', Courier, monospace', 0],
    ['cmdfont', 0, 5, '\'Courier New\', Courier, monospace', 0],
    ['aliases', -1, 4],
    ['macros', -1, 4],
    ['triggers', -1, 4],
    ['mapFollow', 'mapper.follow', 1, true],
    ['mapEnabled', 'mapper.enabled', 1, true],
    ['MapperSplitArea', 'mapper.split', 1, false],
    ['MapperFillWalls', 'mapper.fill', 1, false],
    ['MapperOpen', 'showMapper', 1, false],
    ['fullScreen', -1, 3, false],
    ['enableMXP', 0, 1, true],
    ['enableMSP', 0, 1, true],
    ['parseCommands', 0, 3, true],
    ['lagMeter', 0, 1, false],
    ['enablePing', 0, 1, false],
    ['enableEcho', 0, 1, true],
    ['enableSpeedpaths', 0, 1, true],
    ['speedpathsChar', 0, 0, '!', 1],
    ['parseSpeedpaths', 0, 1, true],
    ['profile', -1, 0, 'Default', 1],
    ['parseSingleQuotes', 0, 1, false],
    ['parseDoubleQuotes', 0, 1, true],
    ['logEnabled', 0, 1, false],
    ['logPrepend', 0, 1, false],
    ['logOffline', 0, 1, false],
    ['logUniqueOnConnect', 0, 1, true],
    ['enableURLDetection', 0, 1, true],
    ['colors', 0, 4],
    ['notifyMSPPlay', 0, 1, false],
    ['CommandonClick', 0, 1, true],
    ['allowEval', 0, 1, true],
    ['allowEscape', 0, 1, true],
    ['AutoCopySelectedToClipboard', 0, 1, false],
    ['enableDebug', 0, 1, false],
    ['editorPersistent', 0, 1, false],
    ['askonclose', 0, 1, true],
    ['dev', 0, 1, false]
];

export class Settings {
    public version: number = 1;
    public AutoCopySelectedToClipboard: boolean = false;
    public autoCreateCharacter: boolean = false;
    public askonclose: boolean = true;
    public dev: boolean = false;
    public profiles: Profiles = new Profiles();
    public showScriptErrors: boolean = false;
    public title: string = '$t';
    public flashing: boolean = false;
    public parseSingleQuotes: boolean = false;
    public notifyMSPPlay: boolean = false;
    public bufferSize: number = 5000;
    public commandHistorySize: number = 20;
    public enableEcho: boolean = true;
    public autoConnect: boolean = true;
    public autoConnectDelay: number = 600;
    public autoLogin: boolean = true;
    public commandEcho: boolean = true;

    public newlineShortcut: NewLineType = NewLineType.Ctrl;

    public keepLastCommand: boolean = true;
    public enableMXP: boolean = true;
    public enableMSP: boolean = true;
    public enableMCCP: boolean = true;
    public enableUTF8: boolean = true;
    public enableDebug: boolean = false;
    public parseCommands: boolean = true;

    public reportCrashes: boolean = false;

    public parseDoubleQuotes: boolean = true;
    public enableURLDetection: boolean = true;
    public CommandonClick: boolean = true;
    public cmdfontSize: string = '1em';
    public fontSize: string = '1em';
    public cmdfont: string = '\'Courier New\', Courier, monospace';
    public font: string = '\'Courier New\', Courier, monospace';

    public commandStacking: boolean = true;
    public commandStackingChar: string = ';';

    public enableSpeedpaths: boolean = true;
    public parseSpeedpaths: boolean = true;
    public speedpathsChar: string = '!';

    public enableCommands: boolean = true;
    public commandChar: string = '#';

    public allowEscape: boolean = true;
    public escapeChar: string = '\\';

    public enableVerbatim: boolean = true;
    public verbatimChar: string = '`';

    public commandDelay: number = 500;
    public commandDelayCount: number = 5;

    public colors: string[] = [];

    public soundPath = path.join('{data}', 'sounds');
    public theme = path.join('{themes}', 'default');

    public allowEval: boolean = true;

    public logging = new Logging();

    public windows = {
        mapper: {
            options: {
                alwaysOnTop: false,
                alwaysOnTopClient: true,
                persistent: true,
                show: false
            }
        },
        chat: {
            options: {
                alwaysOnTop: false,
                alwaysOnTopClient: true,
                persistent: false,
                show: false
            }
        },
        editor: {
            options: {
                alwaysOnTop: false,
                alwaysOnTopClient: true,
                persistent: false,
                show: false
            }
        }
    };

    public buttons = {
        connect: true,
        characters: true,
        preferences: true,
        log: true,
        clear: true,
        lock: true,
        map: true,
        user: true
    };

    public find = {
        case: false,
        word: false,
        reverse: false,
        regex: false,
        selection: false,
        show: false
    };

    public display = {
        split: false,
        splitHeight: -1,
        splitLive: true,
        roundedOverlays: true
    };

    public extensions = {
        mapper: new Mapper(),
        chat: new Chat(),
        status: new Status()
    };

    public backupLoad: BackupSelection = BackupSelection.All;
    public backupSave: BackupSelection = BackupSelection.All;

    public scrollLocked: boolean = false;

    public showCharacterManager: boolean = false;
    public showButtonBar: boolean = true;
    public spellchecking: boolean = true;
    public hideOnMinimize: boolean = false;
    public showTrayIcon: boolean = false;

    public trayClick: TrayClick = TrayClick.show;
    public trayDblClick: TrayClick = TrayClick.none;

    public pasteSpecialPrefix: string = '';
    public pasteSpecialPostfix: string = '';
    public pasteSpecialReplace: string = '';
    public pasteSpecialPrefixEnabled: boolean = true;
    public pasteSpecialPostfixEnabled: boolean = true;
    public pasteSpecialReplaceEnabled: boolean = true;

    public static load(file) {
        try {
            if (!fs.statSync(file).isFile())
                return new Settings();
        }
        catch (err) {
            return new Settings();
        }
        let data = fs.readFileSync(file, 'utf-8');
        if (data.length === 0)
            return new Settings();
        try {
            data = JSON.parse(data);
        }
        catch (e) {
            return new Settings();
        }
        const settings = new Settings();
        let prop;
        let prop2;
        if (!data.version) {
            settings.extensions['status'].lagMeter = data.lagMeter;
            delete data.lagMeter;
            settings.extensions['status'].ping = data.enablePing;
            delete data.enablePing;
            settings.extensions['status'].show = data.showStatus;
            delete data.showStatus;
            settings.extensions['status'].showArmor = data.showArmor;
            delete data.showArmor;
            settings.extensions['status'].showWeather = data.showStatusWeather;
            delete data.showStatusWeather;
            settings.extensions['status'].showLimbs = data.showStatusLimbs;
            delete data.showStatusLimbs;
            settings.extensions['status'].showHealth = data.showStatusHealth;
            delete data.showStatusHealth;
            settings.extensions['status'].showExperience = data.showStatusExperience;
            delete data.showStatusExperience;
            settings.extensions['status'].showPartyHealth = data.showStatusPartyHealth;
            delete data.showStatusPartyHealth;
            settings.extensions['status'].showCombatHealth = data.showStatusCombatHealth;
            delete data.showStatusCombatHealth;
            settings.extensions['status'].allowNegativeNumberNeeded = data.allowNegativeNumberNeeded;
            delete data.allowNegativeNumberNeeded;
            settings.extensions['status'].experienceNeededProgressbar = data.statusExperienceNeededProgressbar;
            delete data.statusExperienceNeededProgressbar;

            settings.logging.enabled = data.logEnabled;
            delete data.logEnabled;
            settings.logging.offline = data.logOffline;
            delete data.logOffline;
            settings.logging.prepend = data.logPrepend;
            delete data.logPrepend;
            settings.logging.gagged = data.logGagged;
            delete data.logGagged;
            settings.logging.timeFormat = data.logTimeFormat;
            delete data.logTimeFormat;
            settings.logging.what = data.logWhat;
            delete data.logWhat;
            settings.logging.errors = data.logErrors;
            delete data.logErrors;
            settings.logging.uniqueOnConnect = data.logUniqueOnConnect;
            delete data.logUniqueOnConnect;
            settings.logging.path = data.logPath;
            delete data.logPath;

            settings.windows.editor.options.persistent = data.editorPersistent;
            delete data.editorPersistent;
            settings.windows.editor.options.show = data.showEditor;
            delete data.showEditor;

            settings.windows.mapper.options.alwaysOnTop = data.mapper.alwaysOnTop;
            delete data.mapper.alwaysOnTop;
            settings.windows.mapper.options.alwaysOnTopClient = data.mapper.alwaysOnTopClient;
            delete data.mapper.alwaysOnTopClient;
            settings.windows.mapper.options.persistent = data.mapper.persistent;
            delete data.mapper.persistent;
            settings.windows.mapper.options.show = data.showMapper;
            delete data.showMapper;

            for (prop in data['mapper']) {
                if (!data['mapper'][prop].hasOwnProperty(prop)) {
                    continue;
                }
                settings.extensions['mapper'] = data['mapper'][prop];
            }
            delete data.mapper;

            settings.windows.chat.options.alwaysOnTop = data.chat.alwaysOnTop;
            delete data.chat.alwaysOnTop;
            settings.windows.chat.options.alwaysOnTopClient = data.chat.alwaysOnTopClient;
            delete data.chat.alwaysOnTopClient;
            settings.windows.chat.options.persistent = data.chat.persistent;
            delete data.chat.persistent;
            settings.windows.chat.options.show = data.showChat;
            delete data.showChat;

            for (prop in data['chat']) {
                if (!data['chat'][prop].hasOwnProperty(prop)) {
                    continue;
                }
                settings.extensions['chat'] = data['chat'][prop];
            }
            delete data.chat;
            data.version = 1;
        }

        for (prop in data) {
            if (!data.hasOwnProperty(prop)) {
                continue;
            }
            if (prop === 'extensions' || prop === 'profiles' || prop === 'buttons' || prop === 'find' || prop === 'display' || prop === 'logging') {
                for (prop2 in data[prop]) {
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

    public static getColors() {
        const _ColorTable = [];
        let r;
        let g;
        let b;
        let idx;
        for (r = 0; r < 6; r++) {
            for (g = 0; g < 6; g++) {
                for (b = 0; b < 6; b++) {
                    idx = 16 + (r * 36) + (g * 6) + b;
                    _ColorTable[idx] = 'rgb(';
                    if (r > 0)
                        _ColorTable[idx] += r * 40 + 55;
                    else
                        _ColorTable[idx] += '0';
                    _ColorTable[idx] += ',';
                    if (g > 0)
                        _ColorTable[idx] += g * 40 + 55;
                    else
                        _ColorTable[idx] += '0';
                    _ColorTable[idx] += ',';
                    if (b > 0)
                        _ColorTable[idx] += b * 40 + 55;
                    else
                        _ColorTable[idx] += '0';
                    _ColorTable[idx] += ')';
                }
            }
        }
        for (r = 232; r <= 255; r++) {
            g = (r - 232) * 10 + 8;
            _ColorTable[r] = ['rgb(', g, ',', g, ',', g, ')'].join('');
        }
        _ColorTable[0] = 'rgb(0,0,0)'; //black fore
        _ColorTable[1] = 'rgb(128, 0, 0)'; //red fore
        _ColorTable[2] = 'rgb(0, 128, 0)'; //green fore
        _ColorTable[3] = 'rgb(128, 128, 0)'; //yellow fore
        _ColorTable[4] = 'rgb(0, 0, 238)'; //blue fore
        _ColorTable[5] = 'rgb(128, 0, 128)'; //magenta fore
        _ColorTable[6] = 'rgb(0, 128, 128)'; //cyan fore
        _ColorTable[7] = 'rgb(187, 187, 187)'; //white fore
        _ColorTable[8] = 'rgb(128, 128, 128)'; //black  bold
        _ColorTable[9] = 'rgb(255, 0, 0)'; //Red bold
        _ColorTable[10] = 'rgb(0, 255, 0)'; //green bold
        _ColorTable[11] = 'rgb(255, 255, 0)'; //yellow bold
        _ColorTable[12] = 'rgb(92, 92, 255)'; //blue bold
        _ColorTable[13] = 'rgb(255, 0, 255)'; //magenta bold
        _ColorTable[14] = 'rgb(0, 255, 255)'; //cyan bold
        _ColorTable[15] = 'rgb(255, 255, 255)'; //white bold
        _ColorTable[256] = 'rgb(0, 0, 0)'; //black faint
        _ColorTable[257] = 'rgb(118, 0, 0)'; //red  faint
        _ColorTable[258] = 'rgb(0, 108, 0)'; //green faint
        _ColorTable[259] = 'rgb(145, 136, 0)'; //yellow faint
        _ColorTable[260] = 'rgb(0, 0, 167)'; //blue faint
        _ColorTable[261] = 'rgb(108, 0, 108)'; //magenta faint
        _ColorTable[262] = 'rgb(0, 108, 108)'; //cyan faint
        _ColorTable[263] = 'rgb(161, 161, 161)'; //white faint
        _ColorTable[264] = 'rgb(0, 0, 0)'; //BackgroundBlack
        _ColorTable[265] = 'rgb(128, 0, 0)'; //red back
        _ColorTable[266] = 'rgb(0, 128, 0)'; //greenback
        _ColorTable[267] = 'rgb(128, 128, 0)'; //yellow back
        _ColorTable[268] = 'rgb(0, 0, 238)'; //blue back
        _ColorTable[269] = 'rgb(128, 0, 128)'; //magenta back
        _ColorTable[270] = 'rgb(0, 128, 128)'; //cyan back
        _ColorTable[271] = 'rgb(187, 187, 187)'; //white back
        _ColorTable[272] = 'rgb(0,0,0)'; //iceMudInfoBackground
        _ColorTable[273] = 'rgb(0, 255, 255)'; //iceMudInfoText
        _ColorTable[274] = 'rgb(0,0,0)'; //LocalEchoBackground
        _ColorTable[275] = 'rgb(255, 255, 0)'; //LocalEchoText
        _ColorTable[276] = 'rgb(0, 0, 0)'; //DefaultBack
        _ColorTable[277] = 'rgb(229, 229, 229)'; //DefaultFore
        _ColorTable[278] = 'rgb(205, 0, 0)'; //ErrorFore
        _ColorTable[279] = 'rgb(229, 229, 229)'; //ErrorBack
        _ColorTable[280] = 'rgb(255,255,255)'; //DefaultBrightFore
        return _ColorTable;
    }

    public save(file) {
        fs.writeFileSync(file, JSON.stringify(this));
    }
}