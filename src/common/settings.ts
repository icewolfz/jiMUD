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
    public alwaysOnTop: boolean = false;
    public alwaysOnTopClient: boolean = true;
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
    public persistent: boolean = true;
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
    public watchFiles: boolean = true;
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
    public alwaysOnTop: boolean = false;
    public alwaysOnTopClient: boolean = true;
    public log: boolean = false;
    public persistent: boolean = false;
    public gag: boolean = true;
    public zoom: number = 1.0;
    public font: string = '\'Courier New\', Courier, monospace';
    public fontSize: string = '1em';
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
    public editorPersistent: boolean = false;
    public AutoCopySelectedToClipboard: boolean = false;
    public autoCreateCharacter: boolean = false;
    public askonclose: boolean = true;
    public dev: boolean = false;
    public mapper: Mapper = new Mapper();
    public profiles: Profiles = new Profiles();
    public chat: Chat = new Chat();
    public showScriptErrors: boolean = false;
    public title: string = '$t';
    public flashing: boolean = false;
    public lagMeter: boolean = true;
    public enablePing: boolean = true;
    public parseSingleQuotes: boolean = false;
    public logEnabled: boolean = false;
    public logOffline: boolean = false;
    public logPrepend: boolean = false;
    public logGagged: boolean = false;
    public logTimeFormat: string = 'YYYYMMDD-HHmmss';
    public notifyMSPPlay: boolean = false;
    public bufferSize: number = 5000;
    public commandHistorySize: number = 20;
    public enableEcho: boolean = true;
    public autoConnect: boolean = true;
    public autoConnectDelay: number = 600;
    public autoLogin: boolean = true;
    public commandEcho: boolean = true;

    public newlineShortcut: NewLineType = NewLineType.Ctrl;

    public logWhat: Log = Log.Html;
    public keepLastCommand: boolean = true;
    public enableMXP: boolean = true;
    public enableMSP: boolean = true;
    public enableMCCP: boolean = true;
    public enableUTF8: boolean = true;
    public enableDebug: boolean = false;
    public parseCommands: boolean = true;

    public logErrors: boolean = true;
    public reportCrashes: boolean = false;

    public parseDoubleQuotes: boolean = true;
    public logUniqueOnConnect: boolean = true;
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
    public logPath = path.join('{data}', 'logs');
    public theme = path.join('{themes}', 'default');

    public gamepads: boolean = false;

    public allowEval: boolean = true;

    public windows = {};
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

    };

    public backupLoad: BackupSelection = BackupSelection.All;
    public backupSave: BackupSelection = BackupSelection.All;
    public backupAllProfiles = false;

    public scrollLocked: boolean = false;
    public showStatus: boolean = true;
    public showMapper: boolean = false;
    public showCharacterManager: boolean = false;
    public showChat: boolean = false;
    public showEditor: boolean = false;
    public showArmor: boolean = false;
    public showStatusWeather: boolean = true;
    public showStatusLimbs: boolean = true;
    public showStatusHealth: boolean = true;
    public showStatusExperience: boolean = true;
    public showStatusPartyHealth: boolean = true;
    public showStatusCombatHealth: boolean = true;
    public showButtonBar: boolean = true;
    public allowNegativeNumberNeeded = false;
    public spellchecking: boolean = true;
    public hideOnMinimize: boolean = false;
    public showTrayIcon: boolean = false;
    public statusExperienceNeededProgressbar: boolean = false;

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

        for (prop in data) {
            if (!data.hasOwnProperty(prop)) {
                continue;
            }
            if (prop === 'extensions' || prop === 'mapper' || prop === 'profiles' || prop === 'buttons' || prop === 'chat' || prop === 'find' || prop === 'display') {
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