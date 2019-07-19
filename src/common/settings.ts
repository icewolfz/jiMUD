//spell-checker:words vscroll, hscroll, askoncancel, askonclose,commandon, cmdfont
//spell-checker:ignore emoteto, emotetos askonchildren YYYYMMDD Hmmss
import { NewLineType, Log, BackupSelection, TrayClick, OnDisconnect } from './types';
const path = require('path');
const fs = require('fs');

/**
 * Class that contains all mapper related options
 *
 * @export
 * @class Mapper
 */
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
    public scale: number = 100;
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

/**
 * Class that contains all profile manager related options
 *
 * @export
 * @class Profiles
 */
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

/**
 * Class that contains all chat capture related options
 *
 * @export
 * @class Chat
 */
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
    //dont capture when window hidden
    public CaptureOnlyOpen: boolean = false;
    public alwaysOnTop: boolean = false;
    public alwaysOnTopClient: boolean = true;
    public log: boolean = false;
    public persistent: boolean = false;
    public gag: boolean = true;
    public zoom: number = 1.0;
    public font: string = '\'Courier New\', Courier, monospace';
    public fontSize: string = '1em';

    public split: boolean = false;
    public splitHeight: number = -1;
    public splitLive: boolean = true;
    public roundedOverlays: boolean = true;
    public showSplitButton: boolean = true;
    public bufferSize: number = 5000;
    public flashing: boolean = false;
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

list = [];
var fmt = (arr, obj, prefix) => {
	arr.forEach(p => {
		if(prefix && prefix.length !== 0)
			key = prefix + '.' + p;
		else
			key = p;
		if(SettingList.SettingList.filter(s => s[0] === key || s[1] === key).length) return;
		var i = [key, 0, 0, obj[p]];
		switch(typeof(obj[p]))
		{
			case 'boolean':
				i[2] = 1;
				break;
			case 'number':
				i[2] = 2;
				break;
			case 'object':
				if(obj[p]) {
					fmt(Object.keys(obj[p]), obj[p], key);
					return;
				}
				else
					i =[key, 0, 0, null];
				break;
		}
		list.push(i);
	});
}
fmt(props, s);
*/
/**
 * Array that contains details about setting values
 * [settingKey, object property, setting data type, default value, max length
 *
 * settingKey - unique key value, object property value if object property undefined, 0 or null
 * object property - the value used to access setting if settingKey is not property, can use . to denote nested properties
 * setting data type - the data type of setting
 *      0 string
 *      1 boolean
 *      2 number
 *      3 raw setting
 *      4 custom
 *      5 combo-box
 * default value - the default value of setting
 * max length - optional max length
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
    ['dev', 0, 1, false],
    //New settings
    ['chat.captureLines', 0, 1, false],
    ['chat.captureAllLines', 0, 1, false],
    ['chat.captureReviews', 0, 1, false],
    ['chat.captureTells', 0, 1, false],
    ['chat.captureTalk', 0, 1, false],
    ['chat.gag', 0, 1, false],
    ['chat.CaptureOnlyOpen', 0, 1, false],
    ['checkForUpdates', 0, 1, false],
    ['autoCreateCharacter', 0, 1, false],
    ['askonchildren', 0, 1, true],
    ['mapper.legend', 0, 1, false],
    ['mapper.room', 0, 1, false],
    ['mapper.importType', 0, 2, 1],
    ['mapper.vscroll', 0, 2, 0],
    ['mapper.hscroll', 0, 2, 0],
    ['mapper.scale', 0, 2, 1.0],
    ['mapper.alwaysOnTop', 0, 1, false],
    ['mapper.alwaysOnTopClient', 0, 1, true],
    ['mapper.memory', 0, 1, false],
    ['mapper.memorySavePeriod', 0, 2, 900000],
    ['mapper.active.ID', 0, 0, null],
    ['mapper.active.x', 0, 2, 0],
    ['mapper.active.y', 0, 2, 0],
    ['mapper.active.z', 0, 2, 0],
    ['mapper.active.area', 0, 0, null],
    ['mapper.active.zone', 0, 2, 0],
    ['mapper.persistent', 0, 1, true],
    ['profiles.split', 0, 2, -1],
    ['profiles.askoncancel', 0, 1, true],
    ['profiles.triggersAdvanced', 0, 1, false],
    ['profiles.aliasesAdvanced', 0, 1, false],
    ['profiles.buttonsAdvanced', 0, 1, false],
    ['profiles.macrosAdvanced', 0, 1, false],
    ['profiles.contextsAdvanced', 0, 1, false],
    ['profiles.codeEditor', 0, 1, true],
    ['profiles.watchFiles', 0, 1, true],
    ['chat.alwaysOnTop', 0, 1, false],
    ['chat.alwaysOnTopClient', 0, 1, true],
    ['chat.log', 0, 1, false],
    ['chat.persistent', 0, 1, false],
    ['chat.zoom', 0, 2, 1],
    ['chat.font', 0, 5, '\'Courier New\', Courier, monospace'],
    ['chat.fontSize', 0, 0, '1em'],
    ['title', 0, 0, '$t'],
    ['logGagged', 0, 1, false],
    ['logTimeFormat', 0, 0, 'YYYYMMDD-HHmmss'],
    ['autoConnectDelay', 0, 2, 600],
    ['autoLogin', 0, 1, true],
    ['onDisconnect', 0, 2, OnDisconnect.ReconnectDialog],
    ['enableKeepAlive', 0, 1, false],
    ['keepAliveDelay', 0, 2, 0],
    ['newlineShortcut', 0, 2, NewLineType.Ctrl],
    ['logWhat', 0, 2, Log.Html],
    ['logErrors', 0, 1, true],
    ['showErrorsExtended', 0, 1, false],
    ['reportCrashes', 0, 1, false],
    ['enableCommands', 0, 1, true],
    ['commandChar', 0, 0, '#', 1],
    ['escapeChar', 0, 0, '\\', 1],
    ['enableVerbatim', 0, 1, true],
    ['verbatimChar', 0, 0, '`'],
    ['soundPath', 0, 0, '{data}\\sounds'],
    ['logPath', 0, 0, '{data}\\logs'],
    ['theme', 0, 0, '{themes}\\default'],
    ['gamepads', 0, 1, false],
    ['buttons.connect', 0, 1, true],
    ['buttons.characters', 0, 1, true],
    ['buttons.preferences', 0, 1, true],
    ['buttons.log', 0, 1, true],
    ['buttons.clear', 0, 1, true],
    ['buttons.lock', 0, 1, true],
    ['buttons.map', 0, 1, true],
    ['buttons.user', 0, 1, true],
    ['buttons.mail', 0, 1, true],
    ['buttons.compose', 0, 1, true],
    ['buttons.immortal', 0, 1, true],
    ['buttons.codeEditor', 0, 1, false],
    ['find.case', 0, 1, false],
    ['find.word', 0, 1, false],
    ['find.reverse', 0, 1, false],
    ['find.regex', 0, 1, false],
    ['find.selection', 0, 1, false],
    ['find.show', 0, 1, false],
    ['display.split', 0, 1, false],
    ['display.splitHeight', 0, 2, -1],
    ['display.splitLive', 0, 1, true],
    ['display.roundedOverlays', 0, 1, true],
    ['backupLoad', 0, 2, BackupSelection.All],
    ['backupSave', 0, 2, BackupSelection.All],
    ['backupAllProfiles', 0, 1, true],
    ['scrollLocked', 0, 1, false],
    ['showStatus', 0, 1, true],
    ['showCharacterManager', 0, 1, false],
    ['showChat', 0, 1, false],
    ['showEditor', 0, 1, false],
    ['showArmor', 0, 1, false],
    ['showStatusWeather', 0, 1, true],
    ['showStatusLimbs', 0, 1, true],
    ['showStatusHealth', 0, 1, true],
    ['showStatusExperience', 0, 1, true],
    ['showStatusPartyHealth', 0, 1, true],
    ['showStatusCombatHealth', 0, 1, true],
    ['showButtonBar', 0, 1, true],
    ['allowNegativeNumberNeeded', 0, 1, false],
    ['spellchecking', 0, 1, true],
    ['hideOnMinimize', 0, 1, false],
    ['showTrayIcon', 0, 1, false],
    ['statusExperienceNeededProgressbar', 0, 1, false],
    ['trayClick', 0, 2, TrayClick.show],
    ['trayDblClick', 0, 2, TrayClick.none],
    ['pasteSpecialPrefix', 0, 0, ''],
    ['pasteSpecialPostfix', 0, 0, ''],
    ['pasteSpecialReplace', 0, 0, ''],
    ['pasteSpecialPrefixEnabled', 0, 1, true],
    ['pasteSpecialPostfixEnabled', 0, 1, true],
    ['pasteSpecialReplaceEnabled', 0, 1, true],
    ['display.showSplitButton', 0, 1, true],
    ['chat.split', 0, 1, false],
    ['chat.splitHeight', 0, 2, -1],
    ['chat.splitLive', 0, 1, true],
    ['chat.roundedOverlays', 0, 1, true],
    ['chat.showSplitButton', 0, 1, true],
    ['chat.bufferSize', 0, 2, 5000],
    ['chat.flashing', 0, 1, false],
    ['display.hideTrailingEmptyLine', 0, 1, true],
    ['display.enableColors', 0, 1, true],
    ['display.enableBackgroundColors', 0, 1, true],
    ['enableSound', 0, 1, true]
];

/**
 * Class that contains all options, sets default values and allows loading and saving to json files
 *
 * @export
 * @class Settings
 */
export class Settings {
    public checkForUpdates: boolean = false;
    public editorPersistent: boolean = false;
    public AutoCopySelectedToClipboard: boolean = false;
    public autoCreateCharacter: boolean = false;
    public askonclose: boolean = true;
    public askonchildren: boolean = true;
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
    public onDisconnect: OnDisconnect = OnDisconnect.ReconnectDialog;
    public commandEcho: boolean = true;
    public enableSound: boolean = true;

    public enableKeepAlive: boolean = false;
    public keepAliveDelay: number = 0;

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
    public showErrorsExtended: boolean = false;
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

    public enableParsing: boolean = true;
    public enableTriggers: boolean = true;

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
        user: true,
        mail: true,
        compose: true,
        immortal: true,
        codeEditor: false
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
        roundedOverlays: true,
        showSplitButton: true,
        hideTrailingEmptyLine: true,
        enableColors: true,
        enableBackgroundColors: true
    };

    public extensions = {

    };

    public backupLoad: BackupSelection = BackupSelection.All;
    public backupSave: BackupSelection = BackupSelection.All;
    public backupAllProfiles = true;

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

    public save(file) {
        const data = JSON.stringify(this);
        if (!data || data.length === 0)
            throw new Error('Could not serialize settings');
        fs.writeFileSync(file, data);
    }
}