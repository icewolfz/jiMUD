//spell-checker:words vscroll, hscroll, askoncancel, askonclose,commandon, cmdfont
//spell-checker:ignore emoteto, emotetos askonchildren YYYYMMDD Hmmss
import { NewLineType, Log, BackupSelection, TrayClick, OnDisconnect, ProfileSortOrder, OnProfileChange, OnProfileDeleted, TrayMenu, OnSecondInstance, ScriptEngineType, SettingType } from './types';
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
    public roomWidth: number = 200;
    public roomGroups: number = 1 | 2 | 4;
    public importType = 1;
    public vscroll: number = 0;
    public hscroll: number = 0;
    public scale: number = 100;
    public alwaysOnTop: boolean = false;
    public alwaysOnTopClient: boolean = true;
    public memory: boolean = false;
    public memorySavePeriod: number = 900000;
    public active = {
        ID: null,
        x: 0,
        y: 0,
        z: 0,
        area: null,
        zone: 0
    };
    public persistent: boolean = true;
    public showInTaskBar: boolean = false;
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
    public sortOrder: ProfileSortOrder = ProfileSortOrder.Priority | ProfileSortOrder.Index;
    public sortDirection: number = 1;
    public showInTaskBar: boolean = false;
    public profileSelected: string = 'default';
    public profileExpandSelected: boolean = true;
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
    //don't capture when window hidden
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
    public showInTaskBar: boolean = false;
    public showTimestamp: boolean = false;
    public timestampFormat: string = '[[]MM-DD HH:mm:ss.SSS[]] ';
    public tabWidth: number = 8;
    public displayControlCodes: boolean = false;
    public emulateTerminal: boolean = false;
    public emulateControlCodes: boolean = true;
    public wordWrap: boolean = false;
    public wrapAt: number = 0;
    public indent: number = 4;
    public scrollLocked: boolean = false;

    public find = {
        case: false,
        word: false,
        reverse: false,
        regex: false,
        selection: false,
        show: false,
        highlight: false,
        location: [5, 20]
    }
}

export class CodeEditor {
    public showInTaskBar: boolean = false;
    public persistent: boolean = false;
    public alwaysOnTop: boolean = false;
    public alwaysOnTopClient: boolean = true;
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
    ['enableSound', 0, 1, true],
    ['allowHalfOpen', 0, 1, true],
    ['editorClearOnSend', 0, 1, true],
    ['editorCloseOnSend', 0, 1, true],
    ['askOnCloseAll', 0, 1, true],
    ['askonloadCharacter', 0, 1, true],
    ['mapper.roomWidth', 0, 2, 200],
    ['mapper.roomGroups', 0, 2, 1 | 2 | 4],
    ['mapper.showInTaskBar', 0, 1, false],
    ['profiles.enabled', 0, 4, []],
    ['profiles.sortOrder', 0, 2, ProfileSortOrder.Priority | ProfileSortOrder.Index],
    ['profiles.sortDirection', 0, 2, 1],
    ['profiles.showInTaskBar', 0, 1, false],
    ['profiles.profileSelected', 0, 0, 'default'],
    ['profiles.profileExpandSelected', 0, 1, true],
    ['chat.lines', 0, 4, []],
    ['chat.showInTaskBar', 0, 1, false],
    ['chat.showTimestamp', 0, 1, false],
    ['chat.timestampFormat', 0, 0, '[[]MM-DD HH:mm:ss.SSS[]] '],
    ['chat.tabWidth', 0, 2, 8],
    ['chat.displayControlCodes', 0, 1, false],
    ['chat.emulateTerminal', 0, 1, false],
    ['chat.emulateControlCodes', 0, 1, true],
    ['chat.wordWrap', 0, 1, false],
    ['chat.wrapAt', 0, 2, 0],
    ['chat.indent', 0, 2, 4],
    ['chat.scrollLocked', 0, 1, false],
    ['chat.find.case', 0, 1, false],
    ['chat.find.word', 0, 1, false],
    ['chat.find.reverse', 0, 1, false],
    ['chat.find.regex', 0, 1, false],
    ['chat.find.selection', 0, 1, false],
    ['chat.find.show', 0, 1, false],
    ['chat.find.highlight', 0, 1, false],
    ['chat.find.location', 0, 4, [5, 20]],
    ['codeEditor.showInTaskBar', 0, 1, false],
    ['codeEditor.persistent', 0, 1, false],
    ['codeEditor.alwaysOnTop', 0, 1, false],
    ['codeEditor.alwaysOnTopClient', 0, 1, true],
    ['autoTakeoverLogin', 0, 1, false],
    ['fixHiddenWindows', 0, 1, true],
    ['maxReconnectDelay', 0, 2, 3600],
    ['enableBackgroundThrottling', 0, 1, true],
    ['enableBackgroundThrottlingClients', 0, 1, false],
    ['showInTaskBar', 0, 1, true],
    ['showLagInTitle', 0, 1, false],
    ['mspMaxRetriesOnError', 0, 2, 0],
    ['logTimestamp', 0, 1, false],
    ['logTimestampFormat', 0, 0, '[[]MM-DD HH:mm:ss.SSS[]] '],
    ['disableTriggerOnError', 0, 1, true],
    ['prependTriggeredLine', 0, 1, true],
    ['enableParameters', 0, 1, true],
    ['parametersChar', 0, 0, '%', 1],
    ['enableNParameters', 0, 1, true],
    ['nParametersChar', 0, 0, '$', 1],
    ['enableParsing', 0, 1, true],
    ['externalWho', 0, 1, true],
    ['externalHelp', 0, 1, true],
    ['watchForProfilesChanges', 0, 1, false],
    ['onProfileChange', 0, 2, OnProfileChange.Nothing],
    ['onProfileDeleted', 0, 2, OnProfileDeleted.Nothing],
    ['enableDoubleParameterEscaping', 0, 1, false],
    ['ignoreEvalUndefined', 0, 1, true],
    ['enableInlineComments', 0, 1, true],
    ['enableBlockComments', 0, 1, true],
    ['inlineCommentString', 0, 0, '//'],
    ['blockCommentString', 0, 0, '/*'],
    ['allowCommentsFromCommand', 0, 1, false],
    ['saveTriggerStateChanges', 0, 1, true],
    ['groupProfileSaves', 0, 1, false],
    ['groupProfileSaveDelay', 0, 2, 20000],
    ['returnNewlineOnEmptyValue', 0, 1, false],
    ['pathDelay', 0, 2, 0],
    ['pathDelayCount', 0, 2, 1],
    ['echoSpeedpaths', 0, 1, false],
    ['alwaysShowTabs', 0, 1, false],
    ['scriptEngineType', 0, 2, ScriptEngineType.Simple],
    ['initializeScriptEngineOnLoad', 0, 1, false],
    ['find.highlight', 0, 1, false],
    ['find.location', 0, 4, [5, 20]],
    ['display.showInvalidMXPTags', 0, 1, false],
    ['display.showTimestamp', 0, 1, false],
    ['display.timestampFormat', 0, 0, '[[]MM-DD HH:mm:ss.SSS[]] '],
    ['display.displayControlCodes', 0, 1, false],
    ['display.emulateTerminal', 0, 1, false],
    ['display.emulateControlCodes', 0, 1, true],
    ['display.wordWrap', 0, 1, false],
    ['display.tabWidth', 0, 2, 8],
    ['display.wrapAt', 0, 2, 0],
    ['display.indent', 0, 2, 4],
    ['statusWidth', 0, 2, -1],
    ['showEditorInTaskBar', 0, 1, true],
    ['trayMenu', 0, 2, TrayMenu.simple],
    ['lockLayout', 0, 1, false],
    ['loadLayout', 0, 0, ''],
    ['useSingleInstance', 0, 1, true],
    ['statusWidth', 0, 2, OnSecondInstance.Show],
    ['characterManagerDblClick', 0, 2, 8]
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
    public editorClearOnSend: boolean = false;
    public editorCloseOnSend: boolean = false;
    public AutoCopySelectedToClipboard: boolean = false;
    public autoCreateCharacter: boolean = false;
    public askonclose: boolean = true;
    public askOnCloseAll: boolean = true;
    public askonloadCharacter: boolean = true;
    public askonchildren: boolean = true;
    public dev: boolean = false;
    public mapper: Mapper = new Mapper();
    public profiles: Profiles = new Profiles();
    public chat: Chat = new Chat();
    public codeEditor: CodeEditor = new CodeEditor();
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
    public autoTakeoverLogin: boolean = false;
    public onDisconnect: OnDisconnect = OnDisconnect.ReconnectDialog;
    public commandEcho: boolean = true;
    public enableSound: boolean = true;
    public fixHiddenWindows: boolean = true;
    public maxReconnectDelay: number = 3600;
    public enableBackgroundThrottling: boolean = true;
    public enableBackgroundThrottlingClients: boolean = false;
    public showInTaskBar: boolean = true;
    public showLagInTitle: boolean = false;

    public mspMaxRetriesOnError: number = 0;

    public enableKeepAlive: boolean = false;
    public keepAliveDelay: number = 0;
    public allowHalfOpen: boolean = true;

    public newlineShortcut: NewLineType = NewLineType.Ctrl;

    public logWhat: Log = Log.Html;
    public logTimestamp: boolean = false;
    public logTimestampFormat: string = '[[]MM-DD HH:mm:ss.SSS[]] ';
    public keepLastCommand: boolean = true;
    public enableMXP: boolean = true;
    public enableMSP: boolean = true;
    public enableMCCP: boolean = true;
    public enableUTF8: boolean = true;
    public enableDebug: boolean = false;
    public parseCommands: boolean = true;

    public logErrors: boolean = true;
    public showErrorsExtended: boolean = false;
    public disableTriggerOnError: boolean = true;
    public prependTriggeredLine: boolean = true;
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

    public enableParameters: boolean = true;
    public parametersChar: string = '%';

    public enableNParameters: boolean = true;
    public nParametersChar: string = '$';

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
    public externalWho: boolean = true;
    public externalHelp: boolean = true;
    public watchForProfilesChanges = false;
    public onProfileChange: OnProfileChange = OnProfileChange.Nothing;
    public onProfileDeleted: OnProfileDeleted = OnProfileDeleted.Nothing;
    public enableDoubleParameterEscaping = false;

    public ignoreEvalUndefined: boolean = true;
    public enableInlineComments: boolean = true;
    public enableBlockComments: boolean = true;
    public inlineCommentString: string = '//';
    public blockCommentString: string = '/*';

    public allowCommentsFromCommand: boolean = false;
    public saveTriggerStateChanges: boolean = true;
    public groupProfileSaves: boolean = false;
    public groupProfileSaveDelay: number = 20000;
    public returnNewlineOnEmptyValue: boolean = false;

    public pathDelay: number = 0;
    public pathDelayCount: number = 1;
    public echoSpeedpaths: boolean = false;

    public alwaysShowTabs: boolean = false;
    public migrate: number = 0;

    public scriptEngineType: ScriptEngineType = ScriptEngineType.Simple;
    public initializeScriptEngineOnLoad: boolean = false;

    /**
     * @depreciated Allow window states have been moved to a separate layout system
     */
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
        show: false,
        highlight: false,
        location: [5, 20]
    };

    public display = {
        split: false,
        splitHeight: -1,
        splitLive: true,
        roundedOverlays: true,
        showSplitButton: true,
        hideTrailingEmptyLine: true,
        enableColors: true,
        enableBackgroundColors: true,
        showInvalidMXPTags: false,
        showTimestamp: false,
        timestampFormat: '[[]MM-DD HH:mm:ss.SSS[]] ',
        tabWidth: 8,
        displayControlCodes: false,
        emulateTerminal: false,
        emulateControlCodes: true,
        wordWrap: false,
        wrapAt: 0,
        indent: 4
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
    public showCodeEditor: boolean = false;
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
    public statusWidth: number = -1;
    public showEditorInTaskBar: boolean = true;

    public trayClick: TrayClick = TrayClick.show;
    public trayDblClick: TrayClick = TrayClick.none;
    public trayMenu: TrayMenu = TrayMenu.simple;

    public pasteSpecialPrefix: string = '';
    public pasteSpecialPostfix: string = '';
    public pasteSpecialReplace: string = '';
    public pasteSpecialPrefixEnabled: boolean = true;
    public pasteSpecialPostfixEnabled: boolean = true;
    public pasteSpecialReplaceEnabled: boolean = true;

    public lockLayout: boolean = false;
    public loadLayout: string = '';

    public useSingleInstance: boolean = true;
    public onSecondInstance: OnSecondInstance = OnSecondInstance.Show;

    public characterManagerDblClick: number = 8;

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

    public getValue(setting: string) {
        switch (setting) {
            case 'mapFollow':
            case 'mapper.follow': return this.mapper.follow;
            case 'mapEnabled':
            case 'mapper.enabled': return this.mapper.enabled;
            case 'MapperSplitArea':
            case 'mapper.split': return this.mapper.split;
            case 'MapperFillWalls':
            case 'mapper.fill': return this.mapper.fill;
            case 'MapperOpen':
            case 'showMapper': return this.showMapper;
            case 'chat.captureLines': return this.chat.captureLines;
            case 'chat.captureAllLines': return this.chat.captureAllLines;
            case 'chat.captureReviews': return this.chat.captureReviews;
            case 'chat.captureTells': return this.chat.captureTells;
            case 'chat.captureTalk': return this.chat.captureTalk;
            case 'chat.gag': return this.chat.gag;
            case 'chat.CaptureOnlyOpen': return this.chat.CaptureOnlyOpen;
            case 'mapper.legend': return this.mapper.legend;
            case 'mapper.room': return this.mapper.room;
            case 'mapper.importType': return this.mapper.importType;
            case 'mapper.vscroll': return this.mapper.vscroll;
            case 'mapper.hscroll': return this.mapper.hscroll;
            case 'mapper.scale': return this.mapper.scale;
            case 'mapper.alwaysOnTop': return this.mapper.alwaysOnTop;
            case 'mapper.alwaysOnTopClient': return this.mapper.alwaysOnTopClient;
            case 'mapper.memory': return this.mapper.memory;
            case 'mapper.memorySavePeriod': return this.mapper.memorySavePeriod;
            case 'mapper.active.ID': return this.mapper.active.ID;
            case 'mapper.active.x': return this.mapper.active.x;
            case 'mapper.active.y': return this.mapper.active.y;
            case 'mapper.active.z': return this.mapper.active.z;
            case 'mapper.active.area': return this.mapper.active.area;
            case 'mapper.active.zone': return this.mapper.active.zone;
            case 'mapper.persistent': return this.mapper.persistent;
            case 'profiles.split': return this.profiles.split;
            case 'profiles.askoncancel': return this.profiles.askoncancel;
            case 'profiles.triggersAdvanced': return this.profiles.triggersAdvanced;
            case 'profiles.aliasesAdvanced': return this.profiles.aliasesAdvanced;
            case 'profiles.buttonsAdvanced': return this.profiles.buttonsAdvanced;
            case 'profiles.macrosAdvanced': return this.profiles.macrosAdvanced;
            case 'profiles.contextsAdvanced': return this.profiles.contextsAdvanced;
            case 'profiles.codeEditor': return this.profiles.codeEditor;
            case 'profiles.watchFiles': return this.profiles.watchFiles;
            case 'chat.alwaysOnTop': return this.chat.alwaysOnTop;
            case 'chat.alwaysOnTopClient': return this.chat.alwaysOnTopClient;
            case 'chat.log': return this.chat.log;
            case 'chat.persistent': return this.chat.persistent;
            case 'chat.zoom': return this.chat.zoom;
            case 'chat.font': return this.chat.font;
            case 'chat.fontSize': return this.chat.fontSize;
            case 'buttons.connect': return this.buttons.connect;
            case 'buttons.characters': return this.buttons.characters;
            case 'buttons.preferences': return this.buttons.preferences;
            case 'buttons.log': return this.buttons.log;
            case 'buttons.clear': return this.buttons.clear;
            case 'buttons.lock': return this.buttons.lock;
            case 'buttons.map': return this.buttons.map;
            case 'buttons.user': return this.buttons.user;
            case 'buttons.mail': return this.buttons.mail;
            case 'buttons.compose': return this.buttons.compose;
            case 'buttons.immortal': return this.buttons.immortal;
            case 'buttons.codeEditor': return this.buttons.codeEditor;
            case 'find.case': return this.find.case;
            case 'find.word': return this.find.word;
            case 'find.reverse': return this.find.reverse;
            case 'find.regex': return this.find.regex;
            case 'find.selection': return this.find.selection;
            case 'find.show': return this.find.show;
            case 'display.split': return this.display.split;
            case 'display.splitHeight': return this.display.splitHeight;
            case 'display.splitLive': return this.display.splitLive;
            case 'display.roundedOverlays': return this.display.roundedOverlays;

            case 'display.showSplitButton': return this.display.showSplitButton;
            case 'chat.split': return this.chat.split;
            case 'chat.splitHeight': return this.chat.splitHeight;
            case 'chat.splitLive': return this.chat.splitLive;
            case 'chat.roundedOverlays': return this.chat.roundedOverlays;
            case 'chat.showSplitButton': return this.chat.showSplitButton;
            case 'chat.bufferSize': return this.chat.bufferSize;
            case 'chat.flashing': return this.chat.flashing;
            case 'display.hideTrailingEmptyLine': return this.display.hideTrailingEmptyLine;
            case 'display.enableColors': return this.display.enableColors;
            case 'display.enableBackgroundColors': return this.display.enableBackgroundColors;

            case 'mapper.roomWidth': return this.mapper.roomWidth;
            case 'mapper.roomGroups': return this.mapper.roomGroups;
            case 'mapper.showInTaskBar': return this.mapper.showInTaskBar;
            case 'profiles.enabled': return this.profiles.enabled;
            case 'profiles.sortOrder': return this.profiles.sortOrder;
            case 'profiles.sortDirection': return this.profiles.sortDirection;
            case 'profiles.showInTaskBar': return this.profiles.showInTaskBar;
            case 'profiles.profileSelected': return this.profiles.profileSelected;
            case 'profiles.profileExpandSelected': return this.profiles.profileExpandSelected;
            case 'chat.lines': return this.chat.lines;
            case 'chat.showInTaskBar': return this.chat.showInTaskBar;
            case 'chat.showTimestamp': return this.chat.showTimestamp;
            case 'chat.timestampFormat': return this.chat.timestampFormat;
            case 'chat.tabWidth': return this.chat.tabWidth;
            case 'chat.displayControlCodes': return this.chat.displayControlCodes;
            case 'chat.emulateTerminal': return this.chat.emulateTerminal;
            case 'chat.emulateControlCodes': return this.chat.emulateControlCodes;
            case 'chat.wordWrap': return this.chat.wordWrap;
            case 'chat.wrapAt': return this.chat.wrapAt;
            case 'chat.indent': return this.chat.indent;
            case 'chat.scrollLocked': return this.chat.scrollLocked;
            case 'chat.find.case': return this.chat.find.case;
            case 'chat.find.word': return this.chat.find.word;
            case 'chat.find.reverse': return this.chat.find.reverse;
            case 'chat.find.regex': return this.chat.find.regex;
            case 'chat.find.selection': return this.chat.find.selection;
            case 'chat.find.show': return this.chat.find.show;
            case 'chat.find.highlight': return this.chat.find.highlight;
            case 'chat.find.location': return this.chat.find.location;
            case 'codeEditor.showInTaskBar': return this.codeEditor.showInTaskBar;
            case 'codeEditor.persistent': return this.codeEditor.persistent;
            case 'codeEditor.alwaysOnTop': return this.codeEditor.alwaysOnTop;
            case 'codeEditor.alwaysOnTopClient': return this.codeEditor.alwaysOnTopClient;
            case 'find.highlight': return this.find.highlight;
            case 'find.location': return this.find.location;
            case 'display.showInvalidMXPTags': return this.display.showInvalidMXPTags;
            case 'display.showTimestamp': return this.display.showTimestamp;
            case 'display.timestampFormat': return this.display.timestampFormat;
            case 'display.displayControlCodes': return this.display.displayControlCodes;
            case 'display.emulateTerminal': return this.display.emulateTerminal;
            case 'display.emulateControlCodes': return this.display.emulateControlCodes;
            case 'display.wordWrap': return this.display.wordWrap;
            case 'display.tabWidth': return this.display.tabWidth;
            case 'display.wrapAt': return this.display.wrapAt;
            case 'display.indent': return this.display.indent;
        }
        return this[setting];
    }

    public setValue(setting: string, value) {
        switch (setting) {
            case 'mapFollow':
            case 'mapper.follow':
                this.mapper.follow = value;
                return true;
            case 'mapEnabled':
            case 'mapper.enabled':
                this.mapper.enabled = value;
                return true;
            case 'MapperSplitArea':
            case 'mapper.split':
                this.mapper.split = value;
                return true;
            case 'MapperFillWalls':
            case 'mapper.fill':
                this.mapper.fill = value;
                return true;
            case 'MapperOpen':
            case 'showMapper':
                this.showMapper = value;
                return true;
            case 'chat.captureLines':
                this.chat.captureLines = value;
                return true;
            case 'chat.captureAllLines':
                this.chat.captureAllLines = value;
                return true;
            case 'chat.captureReviews':
                this.chat.captureReviews = value;
                return true;
            case 'chat.captureTells':
                this.chat.captureTells = value;
                return true;
            case 'chat.captureTalk':
                this.chat.captureTalk = value;
                return true;
            case 'chat.gag':
                this.chat.gag = value;
                return true;
            case 'chat.CaptureOnlyOpen':
                this.chat.CaptureOnlyOpen = value;
                return true;
            case 'mapper.legend':
                this.mapper.legend = value;
                return true;
            case 'mapper.room':
                this.mapper.room = value;
                return true;
            case 'mapper.importType':
                this.mapper.importType = value;
                return true;
            case 'mapper.vscroll':
                this.mapper.vscroll = value;
                return true;
            case 'mapper.hscroll':
                this.mapper.hscroll = value;
                return true;
            case 'mapper.scale':
                this.mapper.scale = value;
                return true;
            case 'mapper.alwaysOnTop':
                this.mapper.alwaysOnTop = value;
                return true;
            case 'mapper.alwaysOnTopClient':
                this.mapper.alwaysOnTopClient = value;
                return true;
            case 'mapper.memory':
                this.mapper.memory = value;
                return true;
            case 'mapper.memorySavePeriod':
                this.mapper.memorySavePeriod = value;
                return true;
            case 'mapper.active.ID':
                this.mapper.active.ID = value;
                return true;
            case 'mapper.active.x':
                this.mapper.active.x = value;
                return true;
            case 'mapper.active.y':
                this.mapper.active.y = value;
                return true;
            case 'mapper.active.z':
                this.mapper.active.z = value;
                return true;
            case 'mapper.active.area':
                this.mapper.active.area = value;
                return true;
            case 'mapper.active.zone':
                this.mapper.active.zone = value;
                return true;
            case 'mapper.persistent':
                this.mapper.persistent = value;
                return true;
            case 'profiles.split':
                this.profiles.split = value;
                return true;
            case 'profiles.askoncancel':
                this.profiles.askoncancel = value;
                return true;
            case 'profiles.triggersAdvanced':
                this.profiles.triggersAdvanced = value;
                return true;
            case 'profiles.aliasesAdvanced':
                this.profiles.aliasesAdvanced = value;
                return true;
            case 'profiles.buttonsAdvanced':
                this.profiles.buttonsAdvanced = value;
                return true;
            case 'profiles.macrosAdvanced':
                this.profiles.macrosAdvanced = value;
                return true;
            case 'profiles.contextsAdvanced':
                this.profiles.contextsAdvanced = value;
                return true;
            case 'profiles.codeEditor':
                this.profiles.codeEditor = value;
                return true;
            case 'profiles.watchFiles':
                this.profiles.watchFiles = value;
                return true;
            case 'chat.alwaysOnTop':
                this.chat.alwaysOnTop = value;
                return true;
            case 'chat.alwaysOnTopClient':
                this.chat.alwaysOnTopClient = value;
                return true;
            case 'chat.log':
                this.chat.log = value;
                return true;
            case 'chat.persistent':
                this.chat.persistent = value;
                return true;
            case 'chat.zoom':
                this.chat.zoom = value;
                return true;
            case 'chat.font':
                this.chat.font = value;
                return true;
            case 'chat.fontSize':
                this.chat.fontSize = value;
                return true;

            case 'buttons.connect':
                this.buttons.connect = value;
                return true;
            case 'buttons.characters':
                this.buttons.characters = value;
                return true;
            case 'buttons.preferences':
                this.buttons.preferences = value;
                return true;
            case 'buttons.log':
                this.buttons.log = value;
                return true;
            case 'buttons.clear':
                this.buttons.clear = value;
                return true;
            case 'buttons.lock':
                this.buttons.lock = value;
                return true;
            case 'buttons.map':
                this.buttons.map = value;
                return true;
            case 'buttons.user':
                this.buttons.user = value;
                return true;
            case 'buttons.mail':
                this.buttons.mail = value;
                return true;
            case 'buttons.compose':
                this.buttons.compose = value;
                return true;
            case 'buttons.immortal':
                this.buttons.immortal = value;
                return true;
            case 'buttons.codeEditor':
                this.buttons.codeEditor = value;
                return true;
            case 'find.case':
                this.find.case = value;
                return true;
            case 'find.word':
                this.find.word = value;
                return true;
            case 'find.reverse':
                this.find.reverse = value;
                return true;
            case 'find.regex':
                this.find.regex = value;
                return true;
            case 'find.selection':
                this.find.selection = value;
                return true;
            case 'find.show':
                this.find.show = value;
                return true;
            case 'display.split':
                this.display.split = value;
                return true;
            case 'display.splitHeight':
                this.display.splitHeight = value;
                return true;
            case 'display.splitLive':
                this.display.splitLive = value;
                return true;
            case 'display.roundedOverlays':
                this.display.roundedOverlays = value;
                return true;

            case 'display.showSplitButton':
                this.display.showSplitButton = value;
                return true;
            case 'chat.split':
                this.chat.split = value;
                return true;
            case 'chat.splitHeight':
                this.chat.splitHeight = value;
                return true;
            case 'chat.splitLive':
                this.chat.splitLive = value;
                return true;
            case 'chat.roundedOverlays':
                this.chat.roundedOverlays = value;
                return true;
            case 'chat.showSplitButton':
                this.chat.showSplitButton = value;
                return true;
            case 'chat.bufferSize':
                this.chat.bufferSize = value;
                return true;
            case 'chat.flashing':
                this.chat.flashing = value;
                return true;
            case 'display.hideTrailingEmptyLine':
                this.display.hideTrailingEmptyLine = value;
                return true;
            case 'display.enableColors':
                this.display.enableColors = value;
                return true;
            case 'display.enableBackgroundColors':
                this.display.enableBackgroundColors = value;
                return true;
            case 'mapper.roomWidth':
                this.mapper.roomWidth = value;
                return true;
            case 'mapper.roomGroups':
                this.mapper.roomGroups = value;
                return true;
            case 'mapper.showInTaskBar':
                this.mapper.showInTaskBar = value;
                return true;
            case 'profiles.enabled':
                this.profiles.enabled = value;
                return true;
            case 'profiles.sortOrder':
                this.profiles.sortOrder = value;
                return true;
            case 'profiles.sortDirection':
                this.profiles.sortDirection = value;
                return true;
            case 'profiles.showInTaskBar':
                this.profiles.showInTaskBar = value;
                return true;
            case 'profiles.profileSelected':
                this.profiles.profileSelected = value;
                return true;
            case 'profiles.profileExpandSelected':
                this.profiles.profileExpandSelected = value;
                return true;
            case 'chat.lines':
                this.chat.lines = value;
                return true;
            case 'chat.showInTaskBar':
                this.chat.showInTaskBar = value;
                return true;
            case 'chat.showTimestamp':
                this.chat.showTimestamp = value;
                return true;
            case 'chat.timestampFormat':
                this.chat.timestampFormat = value;
                return true;
            case 'chat.tabWidth':
                this.chat.tabWidth = value;
                return true;
            case 'chat.displayControlCodes':
                this.chat.displayControlCodes = value;
                return true;
            case 'chat.emulateTerminal':
                this.chat.emulateTerminal = value;
                return true;
            case 'chat.emulateControlCodes':
                this.chat.emulateControlCodes = value;
                return true;
            case 'chat.wordWrap':
                this.chat.wordWrap = value;
                return true;
            case 'chat.wrapAt':
                this.chat.wrapAt = value;
                return true;
            case 'chat.indent':
                this.chat.indent = value;
                return true;
            case 'chat.scrollLocked':
                this.chat.scrollLocked = value;
                return true;
            case 'chat.find.case':
                this.chat.find.case = value;
                return true;
            case 'chat.find.word':
                this.chat.find.word = value;
                return true;
            case 'chat.find.reverse':
                this.chat.find.reverse = value;
                return true;
            case 'chat.find.regex':
                this.chat.find.regex = value;
                return true;
            case 'chat.find.selection':
                this.chat.find.selection = value;
                return true;
            case 'chat.find.show':
                this.chat.find.show = value;
                return true;
            case 'chat.find.highlight':
                this.chat.find.highlight = value;
                return true;
            case 'chat.find.location':
                this.chat.find.location = value;
                return true;
            case 'codeEditor.showInTaskBar':
                this.codeEditor.showInTaskBar = value;
                return true;
            case 'codeEditor.persistent':
                this.codeEditor.persistent = value;
                return true;
            case 'codeEditor.alwaysOnTop':
                this.codeEditor.alwaysOnTop = value;
                return true;
            case 'codeEditor.alwaysOnTopClient':
                this.codeEditor.alwaysOnTopClient = value;
                return true;
            case 'find.highlight':
                this.find.highlight = value;
                return true;
            case 'find.location':
                this.find.location = value;
                return true;
            case 'display.showInvalidMXPTags':
                this.display.showInvalidMXPTags = value;
                return true;
            case 'display.showTimestamp':
                this.display.showTimestamp = value;
                return true;
            case 'display.timestampFormat':
                this.display.timestampFormat = value;
                return true;
            case 'display.displayControlCodes':
                this.display.displayControlCodes = value;
                return true;
            case 'display.emulateTerminal':
                this.display.emulateTerminal = value;
                return true;
            case 'display.emulateControlCodes':
                this.display.emulateControlCodes = value;
                return true;
            case 'display.wordWrap':
                this.display.wordWrap = value;
                return true;
            case 'display.tabWidth':
                this.display.tabWidth = value;
                return true;
            case 'display.wrapAt':
                this.display.wrapAt = value;
                return true;
            case 'display.indent':
                this.display.indent = value;
                return true;
            default:
                if (setting in this) {
                    this[setting] = value;
                    return true;
                }
                return false;
        }
    }

    public static defaultValue(setting) {
        switch (setting) {
            case 'bufferSize': return 5000;
            case 'commandDelay': return 500;
            case 'commandDelayCount': return 5;
            case 'commandHistorySize': return 20;
            case 'fontSize': return '1em';
            case 'cmdfontSize': return '1em';
            case 'commandEcho': return true;
            case 'flashing': return false;
            case 'autoConnect': return true;
            case 'enableAliases': return true;
            case 'enableTriggers': return true;
            case 'enableMacros': return true;
            case 'showScriptErrors': return false;
            case 'commandStacking': return true;
            case 'commandStackingChar': return ';';
            case 'htmlLog': return true;
            case 'keepLastCommand': return true;
            case 'enableMCCP': return true;
            case 'enableUTF8': return true;
            case 'font': return '\'Courier New\', Courier, monospace';
            case 'cmdfont': return '\'Courier New\', Courier, monospace';
            case 'mapFollow':
            case 'mapper.follow': return true;
            case 'mapEnabled':
            case 'mapper.enabled': return true;
            case 'MapperSplitArea':
            case 'mapper.split': return false;
            case 'MapperFillWalls':
            case 'mapper.fill': return false;
            case 'MapperOpen':
            case 'showMapper': return false;
            case 'fullScreen': return false;
            case 'enableMXP': return true;
            case 'enableMSP': return true;
            case 'parseCommands': return true;
            case 'lagMeter': return false;
            case 'enablePing': return false;
            case 'enableEcho': return true;
            case 'enableSpeedpaths': return true;
            case 'speedpathsChar': return '!';
            case 'parseSpeedpaths': return true;
            case 'profile': return 'Default';
            case 'parseSingleQuotes': return false;
            case 'parseDoubleQuotes': return true;
            case 'logEnabled': return false;
            case 'logPrepend': return false;
            case 'logOffline': return false;
            case 'logUniqueOnConnect': return true;
            case 'enableURLDetection': return true;
            case 'notifyMSPPlay': return false;
            case 'CommandonClick': return true;
            case 'allowEval': return true;
            case 'allowEscape': return true;
            case 'AutoCopySelectedToClipboard': return false;
            case 'enableDebug': return false;
            case 'editorPersistent': return false;
            case 'askonclose': return true;
            case 'dev': return false;
            //New settings
            case 'chat.captureLines': return false;
            case 'chat.captureAllLines': return false;
            case 'chat.captureReviews': return false;
            case 'chat.captureTells': return false;
            case 'chat.captureTalk': return false;
            case 'chat.gag': return false;
            case 'chat.CaptureOnlyOpen': return false;
            case 'checkForUpdates': return false;
            case 'autoCreateCharacter': return false;
            case 'askonchildren': return true;
            case 'mapper.legend': return false;
            case 'mapper.room': return false;
            case 'mapper.importType': return 1;
            case 'mapper.vscroll': return 0;
            case 'mapper.hscroll': return 0;
            case 'mapper.scale': return 1.0;
            case 'mapper.alwaysOnTop': return false;
            case 'mapper.alwaysOnTopClient': return true;
            case 'mapper.memory': return false;
            case 'mapper.memorySavePeriod': return 900000;
            case 'mapper.active.ID': return null;
            case 'mapper.active.x': return 0;
            case 'mapper.active.y': return 0;
            case 'mapper.active.z': return 0;
            case 'mapper.active.area': return null;
            case 'mapper.active.zone': return 0;
            case 'mapper.persistent': return true;
            case 'profiles.split': return -1;
            case 'profiles.askoncancel': return true;
            case 'profiles.triggersAdvanced': return false;
            case 'profiles.aliasesAdvanced': return false;
            case 'profiles.buttonsAdvanced': return false;
            case 'profiles.macrosAdvanced': return false;
            case 'profiles.contextsAdvanced': return false;
            case 'profiles.codeEditor': return true;
            case 'profiles.watchFiles': return true;
            case 'chat.alwaysOnTop': return false;
            case 'chat.alwaysOnTopClient': return true;
            case 'chat.log': return false;
            case 'chat.persistent': return false;
            case 'chat.zoom': return 1;
            case 'chat.font': return '\'Courier New\', Courier, monospace';
            case 'chat.fontSize': return '1em';
            case 'title': return '$t';
            case 'logGagged': return false;
            case 'logTimeFormat': return 'YYYYMMDD-HHmmss';
            case 'autoConnectDelay': return 600;
            case 'autoLogin': return true;
            case 'onDisconnect': return OnDisconnect.ReconnectDialog;
            case 'enableKeepAlive': return false;
            case 'keepAliveDelay': return 0;
            case 'newlineShortcut': return NewLineType.Ctrl;
            case 'logWhat': return Log.Html;
            case 'logErrors': return true;
            case 'showErrorsExtended': return false;
            case 'reportCrashes': return false;
            case 'enableCommands': return true;
            case 'commandChar': return '#';
            case 'escapeChar': return '\\';
            case 'enableVerbatim': return true;
            case 'verbatimChar': return '`';
            case 'soundPath': return '{data}\\sounds';
            case 'logPath': return '{data}\\logs';
            case 'theme': return '{themes}\\default';
            case 'gamepads': return false;
            case 'buttons.connect': return true;
            case 'buttons.characters': return true;
            case 'buttons.preferences': return true;
            case 'buttons.log': return true;
            case 'buttons.clear': return true;
            case 'buttons.lock': return true;
            case 'buttons.map': return true;
            case 'buttons.user': return true;
            case 'buttons.mail': return true;
            case 'buttons.compose': return true;
            case 'buttons.immortal': return true;
            case 'buttons.codeEditor': return false;
            case 'find.case': return false;
            case 'find.word': return false;
            case 'find.reverse': return false;
            case 'find.regex': return false;
            case 'find.selection': return false;
            case 'find.show': return false;
            case 'display.split': return false;
            case 'display.splitHeight': return -1;
            case 'display.splitLive': return true;
            case 'display.roundedOverlays': return true;
            case 'backupLoad': return BackupSelection.All;
            case 'backupSave': return BackupSelection.All;
            case 'backupAllProfiles': return true;
            case 'scrollLocked': return false;
            case 'showStatus': return true;
            case 'showCharacterManager': return false;
            case 'showChat': return false;
            case 'showEditor': return false;
            case 'showArmor': return false;
            case 'showStatusWeather': return true;
            case 'showStatusLimbs': return true;
            case 'showStatusHealth': return true;
            case 'showStatusExperience': return true;
            case 'showStatusPartyHealth': return true;
            case 'showStatusCombatHealth': return true;
            case 'showButtonBar': return true;
            case 'allowNegativeNumberNeeded': return false;
            case 'spellchecking': return true;
            case 'hideOnMinimize': return false;
            case 'showTrayIcon': return false;
            case 'statusExperienceNeededProgressbar': return false;
            case 'trayClick': return TrayClick.show;
            case 'trayDblClick': return TrayClick.none;
            case 'pasteSpecialPrefix': return '';
            case 'pasteSpecialPostfix': return '';
            case 'pasteSpecialReplace': return '';
            case 'pasteSpecialPrefixEnabled': return true;
            case 'pasteSpecialPostfixEnabled': return true;
            case 'pasteSpecialReplaceEnabled': return true;
            case 'display.showSplitButton': return true;
            case 'chat.split': return false;
            case 'chat.splitHeight': return -1;
            case 'chat.splitLive': return true;
            case 'chat.roundedOverlays': return true;
            case 'chat.showSplitButton': return true;
            case 'chat.bufferSize': return 5000;
            case 'chat.flashing': return false;
            case 'display.hideTrailingEmptyLine': return true;
            case 'display.enableColors': return true;
            case 'display.enableBackgroundColors': return true;
            case 'enableSound': return true;
            case 'allowHalfOpen': return true;
            case 'editorClearOnSend': return true;
            case 'editorCloseOnSend': return true;
            case 'askOnCloseAll': return true;
            case 'askonloadCharacter': return true;
            case 'mapper.roomWidth': return 200;
            case 'mapper.roomGroups': return 1 | 2 | 4;
            case 'mapper.showInTaskBar': return false;
            case 'profiles.enabled': return [];
            case 'profiles.sortOrder': return ProfileSortOrder.Priority | ProfileSortOrder.Index;
            case 'profiles.sortDirection': return 1;
            case 'profiles.showInTaskBar': return false;
            case 'profiles.profileSelected': return 'default';
            case 'profiles.profileExpandSelected': return true;
            case 'chat.lines': return [];
            case 'chat.showInTaskBar': return false;
            case 'chat.showTimestamp': return false;
            case 'chat.timestampFormat': return '[[]MM-DD HH:mm:ss.SSS[]] ';
            case 'chat.tabWidth': return 8;
            case 'chat.displayControlCodes': return false;
            case 'chat.emulateTerminal': return false;
            case 'chat.emulateControlCodes': return true;
            case 'chat.wordWrap': return false;
            case 'chat.wrapAt': return 0;
            case 'chat.indent': return 4;
            case 'chat.scrollLocked': return false;
            case 'chat.find.case': return false;
            case 'chat.find.word': return false;
            case 'chat.find.reverse': return false;
            case 'chat.find.regex': return false;
            case 'chat.find.selection': return false;
            case 'chat.find.show': return false;
            case 'chat.find.highlight': return false;
            case 'chat.find.location': return [5, 20];
            case 'codeEditor.showInTaskBar': return false;
            case 'codeEditor.persistent': return false;
            case 'codeEditor.alwaysOnTop': return false;
            case 'codeEditor.alwaysOnTopClient': return true;
            case 'autoTakeoverLogin': return false;
            case 'fixHiddenWindows': return true;
            case 'maxReconnectDelay': return 3600;
            case 'enableBackgroundThrottling': return true;
            case 'enableBackgroundThrottlingClients': return false;
            case 'showInTaskBar': return true;
            case 'showLagInTitle': return false;
            case 'mspMaxRetriesOnError': return 0;
            case 'logTimestamp': return false;
            case 'logTimestampFormat': return '[[]MM-DD HH:mm:ss.SSS[]] ';
            case 'disableTriggerOnError': return true;
            case 'prependTriggeredLine': return true;
            case 'enableParameters': return true;
            case 'parametersChar': return '%';
            case 'enableNParameters': return true;
            case 'nParametersChar': return '$';
            case 'enableParsing': return true;
            case 'externalWho': return true;
            case 'externalHelp': return true;
            case 'watchForProfilesChanges': return false;
            case 'onProfileChange': return OnProfileChange.Nothing;
            case 'onProfileDeleted': return OnProfileDeleted.Nothing;
            case 'enableDoubleParameterEscaping': return false;
            case 'ignoreEvalUndefined': return true;
            case 'enableInlineComments': return true;
            case 'enableBlockComments': return true;
            case 'inlineCommentString': return '//';
            case 'blockCommentString': return '/*';
            case 'allowCommentsFromCommand': return false;
            case 'saveTriggerStateChanges': return true;
            case 'groupProfileSaves': return false;
            case 'groupProfileSaveDelay': return 20000;
            case 'returnNewlineOnEmptyValue': return false;
            case 'pathDelay': return 0;
            case 'pathDelayCount': return 1;
            case 'echoSpeedpaths': return false;
            case 'alwaysShowTabs': return false;
            case 'scriptEngineType': return ScriptEngineType.Simple;
            case 'initializeScriptEngineOnLoad': return false;
            case 'find.highlight': return false;
            case 'find.location': return [5, 20];
            case 'display.showInvalidMXPTags': return false;
            case 'display.showTimestamp': return false;
            case 'display.timestampFormat': return '[[]MM-DD HH:mm:ss.SSS[]] ';
            case 'display.displayControlCodes': return false;
            case 'display.emulateTerminal': return false;
            case 'display.emulateControlCodes': return true;
            case 'display.wordWrap': return false;
            case 'display.tabWidth': return 8;
            case 'display.wrapAt': return 0;
            case 'display.indent': return 4;
            case 'statusWidth': return -1;
            case 'showEditorInTaskBar': return true;
            case 'trayMenu': return TrayMenu.simple;
            case 'lockLayout': return false;
            case 'loadLayout': return '';
            case 'useSingleInstance': return true;
            case 'statusWidth': return OnSecondInstance.Show;
            case 'characterManagerDblClick': return 8;
        }
        return null;
    }
}