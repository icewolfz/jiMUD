// spell-checker:words cmdfont
// spell-checker:ignore endof, Commandon errored

import EventEmitter = require('events');
import { Telnet, TelnetOption } from './telnet';
import { ParserLine } from './types';
import { AnsiColorCode } from './ansi';
import { parseTemplate, SortItemArrayByPriority, existsSync } from './library';
import { Settings } from './settings';
import { Input } from './input';
import { ProfileCollection, Alias, Trigger, Alarm, Macro, Profile, Button, Context, TriggerType, Variable } from './profile';
import { MSP } from './msp';
import { Display } from './display';
import { exec } from 'child_process';
const { version } = require('../../package.json');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

interface ItemCache {
    alarmPatterns: any[];
    alarms: Trigger[];
    triggers: Trigger[];
    aliases: Alias[];
    macros: Macro[];
    buttons: Button[];
    contexts: Context[];
    defaultContext: boolean;
    variables: Variable[];
}

/**
 * Mud client
 *
 * @export
 * @class Client
 * @extends {EventEmitter}
 */
export class Client extends EventEmitter {
    private _enableDebug: boolean = false;
    private _input: Input;
    public errored: boolean = false;
    private _settingsFile: string = parseTemplate(path.join('{data}', 'settings.json'));
    private _itemCache: ItemCache = {
        triggers: null,
        aliases: null,
        macros: null,
        buttons: null,
        contexts: null,
        defaultContext: null,
        alarms: null,
        alarmPatterns: [],
        variables: null
    };
    private _alarm: NodeJS.Timer;

    public MSP: MSP;

    public version: string = version;
    public display: Display;
    public commandInput = null;

    public connecting: boolean = false;
    public options: Settings;

    public telnet: Telnet;
    public profiles: ProfileCollection;
    public connectTime: number = 0;
    public lastSendTime: number = 0;
    public defaultTitle = 'jiMUD';

    set enabledProfiles(value: string[]) {
        const a = [];
        let v;
        let vl;
        //can only enable profiles that exist, so scan the array for valid profiles
        for (v = 0, vl = value.length; v < vl; v++) {
            if (this.profiles.contains(value[v]))
                a.push(value[v]);
        }
        if (a.length === 0)
            a.push('default');
        this.options.profiles.enabled = a;
        this.saveOptions();
    }

    get enabledProfiles(): string[] {
        if (this.options.profiles.enabled.length === 0) {
            const a = [];
            let profile;
            for (profile in this.profiles.items) {
                if (!this.profiles.items.hasOwnProperty(profile)) continue;
                if (this.profiles.items[profile].enabled)
                    a.push(profile);
            }
            if (a.length === 0)
                a.push('default');
            this.options.profiles.enabled = a;
            this.saveOptions();
        }
        return this.options.profiles.enabled;
    }

    set enableParsing(value) {
        this.options.enableParsing = value;
        this._input.enableParsing = value;
        this.saveOptions();
    }

    get enableParsing() { return this.options.enableParsing; }

    set enableTriggers(value) {
        this.options.enableTriggers = value;
        this._input.enableTriggers = value;
        this.startAlarms();
        this.saveOptions();
    }

    get enableTriggers() { return this.options.enableTriggers; }

    set settingsFile(val: string) {
        if (this._settingsFile !== val) {
            this._settingsFile = val;
            this.loadOptions();
        }
    }

    get settingsFile(): string { return this._settingsFile; }

    get aliases(): Alias[] {
        if (this._itemCache.aliases)
            return this._itemCache.aliases;
        const keys = this.profiles.keys;
        const tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableAliases)
                this._itemCache.aliases = [];
            else
                this._itemCache.aliases = SortItemArrayByPriority(this.profiles.items[keys[k]].aliases);
            return this._itemCache.aliases;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableAliases || this.profiles.items[keys[k]].aliases.length === 0)
                continue;
            tmp.push.apply(tmp, SortItemArrayByPriority(this.profiles.items[keys[k]].aliases));
        }
        this._itemCache.aliases = tmp;
        return this._itemCache.aliases;
    }

    get macros(): Macro[] {
        if (this._itemCache.macros)
            return this._itemCache.macros;
        const keys = this.profiles.keys;
        const tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableMacros)
                this._itemCache.macros = [];
            else
                this._itemCache.macros = SortItemArrayByPriority(this.profiles.items[keys[k]].macros);
            return this._itemCache.macros;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableMacros || this.profiles.items[keys[k]].macros.length === 0)
                continue;
            tmp.push.apply(tmp, SortItemArrayByPriority(this.profiles.items[keys[k]].macros));
        }
        this._itemCache.macros = tmp;
        return this._itemCache.macros;
    }

    get triggers(): Trigger[] {
        if (this._itemCache.triggers)
            return this._itemCache.triggers;
        const keys = this.profiles.keys;
        const tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableTriggers)
                this._itemCache.triggers = [];
            else
                this._itemCache.triggers = SortItemArrayByPriority(this.profiles.items[keys[0]].triggers);
            return this._itemCache.triggers;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableTriggers || this.profiles.items[keys[k]].triggers.length === 0)
                continue;
            tmp.push.apply(tmp, SortItemArrayByPriority(this.profiles.items[keys[k]].triggers));
        }
        this._itemCache.triggers = tmp;
        return this._itemCache.triggers;
    }

    public removeTrigger(trigger: Trigger) {
        const keys = this.profiles.keys;
        let k = 0;
        const kl = keys.length;
        let idx = -1;
        if (kl === 0)
            return;
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableTriggers)
                return;
            idx = this.profiles.items[keys[k]].triggers.indexOf(trigger);
        }
        else
            for (; k < kl && idx !== -1; k++) {
                if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableTriggers || this.profiles.items[keys[k]].triggers.length === 0)
                    continue;
                idx = this.profiles.items[keys[k]].triggers.indexOf(trigger);
            }
        if (idx === -1)
            return;
        this.profiles.items[keys[k]].triggers.splice(idx, 1);
        this._itemCache.triggers = null;
        if (trigger.type === TriggerType.Alarm && this._itemCache.alarms) {
            idx = this._itemCache.alarms.indexOf(trigger);
            if (idx !== -1) {
                this._itemCache.alarms.splice(idx, 1);
                this._itemCache.alarmPatterns.splice(idx, 1);
            }
        }
        this.saveProfile(keys[k]);
        this.emit('item-removed', 'trigger', keys[k], idx);
    }

    get alarms(): Trigger[] {
        if (this._itemCache.alarms)
            return this._itemCache.alarms;
        const keys = this.profiles.keys;
        const tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableTriggers)
                this._itemCache.alarms = [];
            else
                this._itemCache.alarms = $.grep(SortItemArrayByPriority(this.profiles.items[keys[k]].triggers), (a) => {
                    return a && a.enabled && a.type === TriggerType.Alarm;
                });
            this._itemCache.alarms.reverse();
            return this._itemCache.alarms;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableTriggers || this.profiles.items[keys[k]].triggers.length === 0)
                continue;
            tmp.push.apply(tmp, SortItemArrayByPriority(this.profiles.items[keys[k]].triggers));
        }
        this._itemCache.alarms = $.grep(tmp, (a) => {
            return a && a.enabled && a.type === TriggerType.Alarm;
        });
        this._itemCache.alarms.reverse();
        return this._itemCache.alarms;
    }

    get buttons(): Button[] {
        if (this._itemCache.buttons)
            return this._itemCache.buttons;
        const keys = this.profiles.keys;
        const tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableButtons)
                this._itemCache.buttons = [];
            else
                this._itemCache.buttons = SortItemArrayByPriority(this.profiles.items[keys[k]].buttons);
            return this._itemCache.buttons;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableButtons || this.profiles.items[keys[k]].buttons.length === 0)
                continue;
            tmp.push.apply(tmp, SortItemArrayByPriority(this.profiles.items[keys[k]].buttons));
        }
        this._itemCache.buttons = tmp;
        return this._itemCache.buttons;
    }

    get contexts(): Context[] {
        if (this._itemCache.contexts)
            return this._itemCache.contexts;
        const keys = this.profiles.keys;
        const tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableContexts)
                this._itemCache.contexts = [];
            else
                this._itemCache.contexts = SortItemArrayByPriority(this.profiles.items[keys[k]].contexts);
            return this._itemCache.contexts;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableContexts || this.profiles.items[keys[k]].contexts.length === 0)
                continue;
            tmp.push.apply(tmp, SortItemArrayByPriority(this.profiles.items[keys[k]].contexts));
        }
        this._itemCache.contexts = tmp;
        return this._itemCache['contexts'];
    }

    get defaultContext(): boolean {
        if (this._itemCache.defaultContext !== null)
            return this._itemCache.defaultContext;
        this._itemCache.defaultContext = this.profiles.defaultContext;
        return this._itemCache.defaultContext;
    }

    get variables(): Variable[] {
        if (this._itemCache.variables)
            return this._itemCache.variables;
        const keys = this.profiles.keys;
        const tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableVariables)
                this._itemCache.variables = [];
            else
                this._itemCache.variables = SortItemArrayByPriority(this.profiles.items[keys[k]].variables);
            return this._itemCache.variables;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableVariables || this.profiles.items[keys[k]].variables.length === 0)
                continue;
            tmp.push.apply(tmp, SortItemArrayByPriority(this.profiles.items[keys[k]].variables));
        }
        this._itemCache.variables = tmp;
        return this._itemCache.variables;
    }

    public getVariable(name) {
        const va = this.variables.find(x => x.name === name);
        if (!va) return null;
        return va.rawValue;
    }

    public setVariable(name: string, value, profile?) {
        let va = this.variables.find(x => x.name === name);
        if (!va) {
            va = new Variable({ name: name });
            if (!profile)
                profile = this.activeProfile.variables.push(va);
            else if (typeof profile === 'string')
                profile = this.profiles.items[profile];
            if (!profile || !profile.variables)
                throw new Error('Invalid profile');
            profile.variables.push(va);
            this._itemCache.variables = null;
        }
        va.rawValue = value;
    }

    public hasVariable(name) {
        return this.variables.find(x => x.name === name) !== null;
    }

    get activeProfile(): Profile {
        const keys = this.profiles.keys;
        //search for first enabled profile
        for (const key in keys) {
            if (this.enabledProfiles.indexOf(keys[key]) !== -1)
                return this.profiles.items[keys[key]];
        }
        //if none found fall back to default
        return this.profiles.active;
    }

    public get commandHistory() {
        return this._input.commandHistory;
    }

    public get indices() {
        return this._input.indices;
    }

    public get repeatnum() {
        return this._input.repeatnum;
    }

    public setHistoryIndex(index) {
        this._input.setHistoryIndex(index);
    }

    public clearCommandHistory() {
        this._input.clearCommandHistory();
    }

    public AddCommandToHistory(txt) {
        this._input.AddCommandToHistory(txt);
    }

    public loadProfiles() {
        const p = path.join(parseTemplate('{data}'), 'profiles');
        //clear out all current profiles
        this.profiles = new ProfileCollection();
        if (!existsSync(p)) {
            this.profiles.add(Profile.Default);
            this.clearCache();
            this.startAlarms();
            this.emit('profiles-loaded');
            return;
        }
        //backward compat, if no enabled one just load all so enabled profile setting can be scanned
        //use direct setting instead of wrapper as wrapper assumes profiles are loaded if empty
        if (this.options.profiles.enabled.length === 0)
            this.profiles.loadPath(p);
        else if (this.options.profiles.enabled.indexOf('default') === -1) {
            this.profiles.load(this.options.profiles.enabled, p);
            //always load default just incase
            this.profiles.load('default', p);
        }
        else
            this.profiles.load(this.options.profiles.enabled, p);
        //ensure default exist and is loaded
        if (!this.profiles.contains('default'))
            this.profiles.add(Profile.Default);
        this.clearCache();
        this.startAlarms();
        this.emit('profiles-loaded');
    }

    public loadProfile(profile) {
        if (!profile) return;
        const p = path.join(parseTemplate('{data}'), 'profiles');
        if (!existsSync(p))
            return;
        this.profiles.remove(profile);
        this.profiles.load(profile, p);
        this.clearCache();
        this.startAlarms();
        this.emit('profile-loaded', profile);
    }

    public removeProfile(profile) {
        if (!profile) return;
        this.profiles.remove(profile);
        this.clearCache();
        this.startAlarms();
        this.emit('profile-removed', profile);
    }

    public saveProfiles() {
        const p = path.join(parseTemplate('{data}'), 'profiles');
        if (!existsSync(p))
            fs.mkdirSync(p);
        this.profiles.save(p);
        this.clearCache();
        this.startAlarms();
        this.emit('profiles-updated');
    }

    public saveProfile(profile: string) {
        profile = profile.toLowerCase();
        //is not loaded so no reason to even save it
        if (!this.profiles.contains(profile))
            return;
        const p = path.join(parseTemplate('{data}'), 'profiles');
        if (!existsSync(p))
            fs.mkdirSync(p);
        this.profiles.items[profile].save(p);
        this.clearCache();
        this.startAlarms();
        this.emit('profile-updated', profile);
    }

    public toggleProfile(profile: string) {
        profile = profile.toLowerCase();
        let p = this.enabledProfiles;
        if (p.indexOf(profile) === -1) {
            p.push(profile);
            //load if not loaded
            if (!this.profiles.contains(profile))
                this.profiles.load(profile, path.join(parseTemplate('{data}'), 'profiles'));
        }
        else {
            //remove profile, don't bother unloading as they may turn it back on so just leave it loaded
            p = p.filter((a) => { return a !== profile; });
            //cant disable if only profile
            if (p.length === 0)
                p = [profile];
        }
        this.enabledProfiles = p;
        this.saveOptions();
        this.clearCache();
        this.startAlarms();
        this.emit('profile-toggled', profile, p.indexOf(profile) !== -1);
    }

    public startAlarms() {
        const al = this.alarms.length;
        if ((al === 0 || !this.options.enableTriggers) && this._alarm) {
            clearInterval(this._alarm);
            this._alarm = null;
        }
        else if (al && !this._alarm)
            this._alarm = setInterval((client) => { client.process_alarms(); }, 1000, this);
    }

    public setAlarmState(idx, state: boolean) {
        if (typeof idx === 'object')
            idx = this.alarms.indexOf(idx);
        if (idx === -1 || idx >= this.alarms.length)
            return 0;
        let pattern = this._itemCache.alarmPatterns[idx];
        if (!pattern) {
            pattern = Alarm.parse(this.alarms[idx]);
            this._itemCache.alarmPatterns[idx] = pattern;
        }
        if (state) {
            pattern.startTime += Date.now() - pattern.suspended;
            pattern.suspended = 0;
        }
        else
            pattern.suspended = Date.now();
    }

    public updateAlarms() {
        if (this._itemCache.alarmPatterns) {
            const old = this._itemCache.alarmPatterns;
            const oAlarms = this.alarms;
            this._itemCache.alarmPatterns = [];
            this._itemCache.alarms = null;
            const al = this.alarms.length;
            let idx = -1;
            for (let a = 0; a < al; a++) {
                idx = oAlarms.indexOf(this.alarms[a]);
                if (idx !== -1)
                    this._itemCache.alarmPatterns[a] = old[idx];
            }
        }
        this.startAlarms();
    }

    private process_alarms() {
        if (!this.options.enableTriggers)
            return;
        let a = 0;
        const al = this.alarms.length;
        if (al === 0 && this._alarm) {
            clearInterval(this._alarm);
            this._alarm = null;
            return;
        }
        const patterns = this._itemCache.alarmPatterns;
        const now = Date.now();
        const alarms = this.alarms;
        for (a = al - 1; a >= 0; a--) {
            let alarm = patterns[a];
            if (!alarm) {
                alarm = Alarm.parse(alarms[a]);
                patterns[a] = alarm;
            }
            let match: boolean = true;
            let ts;
            if (alarm.start)
                ts = moment.duration(now - this.connectTime);
            else
                ts = moment.duration(now - alarm.startTime);
            if (ts.asMilliseconds() < 1000)
                continue;
            const sec = Math.floor(ts.asMilliseconds() / 1000);
            const min = Math.floor(sec / 60);
            const hr = Math.floor(min / 60);
            if (alarm.hoursWildCard) {
                if (alarm.hours === 0)
                    match = match && ts.hours() === 0;
                else if (alarm.hours !== -1)
                    match = match && hr % alarm.hours === 0;
            }
            else if (alarm.hours !== -1)
                match = match && alarm.hours === ts.hours();
            if (alarm.minutesWildcard) {
                if (alarm.minutes === 0)
                    match = match && ts.minutes() === 0;
                else if (alarm.minutes !== -1)
                    match = match && min % alarm.minutes === 0;
            }
            else if (alarm.minutes !== -1)
                match = match && alarm.minutes === ts.minutes();
            if (alarm.secondsWildcard) {
                if (alarm.seconds === 0)
                    match = match && ts.seconds() === 0;
                else if (alarm.seconds !== -1)
                    match = match && sec % alarm.seconds === 0;
            }
            else if (alarm.seconds !== -1)
                match = match && alarm.seconds === ts.seconds();

            if (match && !alarm.suspended) {
                this._input.ExecuteTrigger(alarms[a], [alarm.pattern], false, -a);
                if (alarm.temp)
                    this.removeTrigger(alarms[a]);
            }
        }
    }

    constructor(display, command, settings?: string) {
        super();
        if (command == null || typeof command === 'undefined') {
            throw new Error('Missing command input');
        }

        this.display = new Display(display);

        this.display.click((event) => {
            if (this.options.CommandonClick)
                this.commandInput.focus();
        });

        this.display.on('split-move-done', (h) => {
            this.options.display.splitHeight = h;
            this.saveOptions();
        });

        this.display.on('scroll-lock', (lock) => {
            this.scrollLock = lock;
        });

        if (typeof command === 'string')
            this.commandInput = $(command);
        else
            this.commandInput = command;

        this.MSP = new MSP({ forcedDefaultMusicURL: '', forcedDefaultSoundURL: '' });
        this.MSP.on('playing', (data) => {
            if (this.enableDebug) this.debug('MSP ' + (data.type ? 'Music' : 'Sound') + ' Playing ' + data.file + ' for ' + data.duration);
            if (!this.options.notifyMSPPlay) return;
            if (this.options.enableDebug)
                this.debug(data);
            this.echo((data.type ? 'Music' : 'Sound') + ' Playing ' + data.file + ' for ' + data.duration, AnsiColorCode.InfoText, AnsiColorCode.InfoBackground, true, true);
        });
        this.MSP.on('error', (err) => {
            this.error(err);
        });
        this._input = new Input(this);
        this._input.on('scroll-lock', (lock) => {
            this.display.scrollLock = lock;
            if (this.display.split)
                this.display.scrollDisplay(true);
            this.emit('scroll-lock', lock);
        });
        this._input.on('command-history-changed', history => this.emit('command-history-changed', history));

        this._input.on('item-added', (type, profile, item) => {
            this.emit('item-added', type, profile, item);
        });

        this._input.on('item-updated', (type, profile, idx, item) => {
            this.emit('item-updated', type, profile, idx, item);
        });

        this._input.on('item-removed', (type, profile, idx) => {
            this.emit('item-removed', type, profile, idx);
        });

        this.commandInput.val('');
        this.commandInput.focus();

        this.telnet = new Telnet();
        this.telnet.terminal = 'jiMUD';
        this.telnet.version = version;
        this.telnet.on('error', (err) => {
            if (this.enableDebug) this.debug(err);
            if (err) {
                if (err.type === 'close' && err.code === 1006)
                    return;
                const msg = [];
                if (err.type)
                    msg.push(err.type);
                if (err.text)
                    msg.push(err.text);
                if (err.message)
                    msg.push(err.message);
                if (err.reason)
                    msg.push(err.reason);
                if (err.code === 'ECONNREFUSED')
                    this.errored = true;
                if (err.code)
                    this.error(err.code + ' - ' + msg.join(', '));
                else
                    this.error(msg.join(', '));
                if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET')
                    this.close();
                else
                    this.emit('reconnect');
            }
            else
                this.error('Unknown telnet error.');
        });
        this.telnet.on('connecting', () => {
            this.connecting = true;
            this.echo('Trying to connect to ' + this.host + ':' + this.port, AnsiColorCode.InfoText, AnsiColorCode.InfoBackground, true, true);
        });
        this.telnet.on('connect', () => {
            this.connecting = false;
            this.echo('Connected...', AnsiColorCode.InfoText, AnsiColorCode.InfoBackground, true, true);
            this.connectTime = Date.now();
            this.lastSendTime = Date.now();
            this.emit('connected');
            this.raise('connected');
        });
        this.telnet.on('debug', (msg) => {
            this.debug(msg);
        });
        this.telnet.on('receive-option', (data: TelnetOption) => {
            this.MSP.processOption(data);
            this.emit('received-option', data);
        });
        this.telnet.on('close', () => {
            this.connecting = false;
            this.echo('Connection closed to ' + this.host + ':' + this.port, AnsiColorCode.InfoText, AnsiColorCode.InfoBackground, true, true);
            this.connectTime = 0;
            this.lastSendTime = 0;
            this.MSP.reset();
            this.emit('closed');
            this.raise('disconnected');
        });
        this.telnet.on('received-data', (data) => {
            data = { value: data };
            this.emit('received-data', data);
            if (data == null || typeof data === 'undefined' || data.value == null || typeof data.value === 'undefined')
                return;
            this.printInternal(data.value, false, true);
            this.debug('Latency: ' + this.telnet.latency + 'ms');
            this.debug('Latency: ' + (this.telnet.latency / 1000) + 's');
        });

        this.telnet.on('received-MSDP', (data) => {
            this.emit('received-MSDP', data);
        });

        this.telnet.on('received-GMCP', (data) => {
            let val: string = data.value;
            let mod: string;
            let idx: number = 0;
            const dl: number = val.length;
            let c;
            if (dl === 0) return;
            for (idx = 0; idx < dl; idx++) {
                c = val.charAt(idx);
                if (c === ' ' || c === '{' || c === '[')
                    break;
            }
            mod = val.substr(0, idx).trim();
            val = val.substr(idx).trim();
            this.debug('GMCP Module: ' + mod);
            this.debug('GMCP Data: ' + val);
            let obj;
            if (mod.toLowerCase() === 'client.gui') {
                obj = val.split('/n');
                if (val.length >= 2) {
                    obj = {
                        version: parseInt(obj[0], 10),
                        url: obj[1]
                    };
                }
                else if (val.length > 0) {
                    obj = {
                        version: parseInt(obj[0], 10),
                        url: obj[1]
                    };
                }
                else
                    obj = { version: obj, url: '' };
                this.emit('received-GMCP', mod, obj);
                return;
            }
            try {
                if (val.length > 0)
                    obj = JSON.parse(val);
            }
            catch (e) {
                this.error('Invalid GMCP');
                return;
            }
            this.emit('received-GMCP', mod, obj);
            this.MSP.processGMCP(mod, obj);
        });

        this.telnet.on('windowSize', () => { this.UpdateWindow(); });

        this.display.on('update-window', (width, height) => {
            this.telnet.updateWindow(width, height);
        });

        this.display.on('debug', (msg) => { this.debug(msg); });
        this.display.on('add-line', (data: ParserLine) => {
            this.emit('add-line', data);
        });
        this.display.on('add-line-done', (data: ParserLine) => {
            this.emit('add-line-done', data);
        });
        this.display.on('MXP-tag-reply', (tag, args) => {
            const e = { tag: tag, args: args, preventDefault: false };
            this.emit('MXP-tag-reply', e);
            if (e.preventDefault)
                return;
            switch (tag) {
                case 'VERSION':
                    if (this.display.MXPStyleVersion && this.display.MXPStyleVersion.length) {
                        this.debug(`MXP Tag REPLY: <VERSION MXP=1.0 STYLE=${this.display.MXPStyleVersion} CLIENT=jiMUD VERSION=${this.version} REGISTERED=no>`);
                        this.send(`\x1b[1z<VERSION MXP=1.0 STYLE=${this.display.MXPStyleVersion} CLIENT=jiMUD VERSION=${this.version} REGISTERED=no>\r\n`);
                    }
                    else {
                        this.debug(`MXP Tag REPLY: <VERSION MXP=1.0 CLIENT=jiMUD VERSION=${this.version} REGISTERED=no>`);
                        this.send(`\x1b[1z<VERSION MXP=1.0 CLIENT=jiMUD VERSION=${this.version} REGISTERED=no>\r\n`);
                    }
                    break;
                case 'SUPPORT':
                    this.debug(`MXP Tag REPLY: <SUPPORTS ${args.join(' ')}>`);
                    this.send(`\x1b[1z<SUPPORTS ${args.join(' ')}>\r\n`);
                    break;
            }
        });
        this.display.on('expire-links', (args) => {
            this.emit('expire-links', args);
        });

        this.display.on('parse-done', () => {
            this.emit('parse-done');
        });
        this.display.on('set-title', (title, type) => {

            if (typeof title === 'undefined' || title == null || title.length === 0)
                window.document.title = this.defaultTitle;
            else if (type !== 1)
                window.document.title = this.options.title.replace('$t', title);

        });
        this.display.on('music', (data) => {
            this.MSP.music(data);
            this.emit('music', data);
        });
        this.display.on('sound', (data) => {
            this.MSP.sound(data);
            this.emit('sound', data);
        });
        if (settings && settings.length > 0)
            this._settingsFile = settings;
        this.loadOptions();
        this.emit('initialized');
    }

    get enableDebug(): boolean {
        return this._enableDebug;
    }

    set enableDebug(enable: boolean) {
        this._enableDebug = enable;
        this.telnet.enableDebug = enable;
        this.display.enableDebug = enable;
        this.MSP.enableDebug = enable;
    }

    get host(): string {
        return this.telnet.host;
    }
    set host(host: string) {
        this.telnet.host = host;
    }

    get port(): number {
        return this.telnet.port;
    }
    set port(port: number) {
        this.telnet.port = port;
    }

    get connected(): boolean {
        return this.telnet.connected;
    }

    public loadOptions() {
        this.options = Settings.load(this._settingsFile);

        this.enableDebug = this.options.enableDebug;
        this.display.maxLines = this.options.bufferSize;
        this.display.enableFlashing = this.options.flashing;
        this.display.enableMXP = this.options.enableMXP;
        this.display.showInvalidMXPTags = this.options.display.showInvalidMXPTags;
        this.display.enableURLDetection = this.options.enableURLDetection;
        this.display.enableMSP = this.options.enableMSP;
        this.display.enableColors = this.options.display.enableColors;
        this.display.enableBackgroundColors = this.options.display.enableBackgroundColors;

        if (this.options.colors.length > 0) {
            const colors = this.options.colors;
            let c;
            const cl = colors.length;
            for (c = 0; c < cl; c++) {
                if (!colors[c] || colors[c].length === 0) continue;
                this.display.SetColor(c, colors[c]);
            }
        }

        this.telnet.options.MCCP = this.options.enableMCCP;
        this.telnet.options.MXP = this.options.enableMXP;
        this.telnet.UTF8 = this.options.enableUTF8;
        this.telnet.options.ECHO = this.options.enableEcho;
        this.telnet.enableLatency = this.options.lagMeter;
        this.telnet.enablePing = this.options.enablePing;
        this.telnet.keepAlive = this.options.enableKeepAlive;
        this.telnet.keepAliveDelay = this.options.keepAliveDelay;
        this.telnet.allowHalfOpen = this.options.allowHalfOpen;

        this.MSP.enabled = this.options.enableMSP;
        this.MSP.enableSound = this.options.enableSound;
        this.MSP.savePath = parseTemplate(this.options.soundPath);

        this._input.scrollLock = this.options.scrollLocked;
        this._input.enableParsing = this.options.enableParsing;
        this._input.enableTriggers = this.options.enableTriggers;
        this.display.scrollLock = this.options.scrollLocked;
        this.display.enableSplit = this.options.display.split;
        this.display.hideTrailingEmptyLine = this.options.display.hideTrailingEmptyLine;
        this.display.splitLive = this.options.display.splitLive;
        this.display.splitHeight = this.options.display.splitHeight;
        this.display.roundedRanges = this.options.display.roundedOverlays;
        this.display.showSplitButton = this.options.display.showSplitButton;
        this.UpdateFonts();
        this.display.scrollDisplay();
        this.loadProfiles();
        this.emit('options-loaded');
    }

    public saveOptions() {
        this.options.save(this._settingsFile);
        this.emit('options-saved');
    }

    public setOption(name, value) {
        if (name === -1 || name === '-1')
            return;
        let opt = this.options;
        let o;
        name = name.split('.');
        const ol = name.length - 1;
        for (o = 0; o < ol; o++)
            opt = opt[name[o]];
        opt[name[name.length - 1]] = value;
        this.saveOptions();
    }

    public getOption(name) {
        if (name === -1 || name === '-1')
            return null;
        let opt = this.options;
        let o;
        name = name.split('.');
        const ol = name.length;
        for (o = 0; o < ol; o++)
            opt = opt[name[o]];
        return opt;
    }

    public UpdateFonts() {
        //can only update if display has been setup
        if (!this.display) return;
        this.display.updateFont(this.options.font, this.options.fontSize);
        this.commandInput.css('font-size', this.options.cmdfontSize);
        this.commandInput.css('font-family', this.options.cmdfont + ', monospace');
    }

    public parse(txt: string) {
        this.parseInternal(txt, false);
    }

    private parseInternal(txt: string, remote: boolean, force?: boolean) {
        this.display.append(txt, remote, force);
    }

    public error(err: any) {
        this.debug(err);
        let msg = '';
        if (err == null || typeof err === 'undefined')
            msg = 'Unknown';
        else if (typeof err === 'string' && err.length === 0)
            msg = 'Unknown';
        else if (err.stack && this.options.showErrorsExtended)
            msg = err.stack;
        else if (err instanceof Error || err instanceof TypeError)
            msg = err.name + ' - ' + err.message;
        else if (err.message)
            msg = err.message;
        else
            msg = '' + err;

        if (msg.match(/^.*Error: /g) || msg.match(/^.*Error - /g))
            this.echo(msg, AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);
        else
            this.echo('Error: ' + msg, AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);

        if (this.options.logErrors) {
            if (!this.options.showErrorsExtended && err.stack)
                msg = err.stack;
            fs.writeFileSync(parseTemplate(path.join('{data}', 'jimud.error.log')), new Date().toLocaleString() + '\n', { flag: 'a' });
            fs.writeFileSync(parseTemplate(path.join('{data}', 'jimud.error.log')), msg + '\n', { flag: 'a' });
        }

        if (err === 'Error: ECONNRESET - read ECONNRESET.' && this.telnet.connected)
            this.close();
        //else
        //this.emit('reconnect');
        this.raise('error', msg);
    }

    public echo(str: string, fore?: number, back?: number, newline?: boolean, forceLine?: boolean) {
        if (str == null) str = '';
        if (newline == null) newline = false;
        if (forceLine == null) forceLine = false;
        if (fore == null) fore = AnsiColorCode.LocalEcho;
        if (back == null) back = AnsiColorCode.LocalEchoBack;
        const codes = '\x1b[0,' + this.display.CurrentAnsiCode() + '\n';
        if (str.endsWith('\n'))
            str = str.substr(0, str.length - 1);
        if (this.telnet.prompt && forceLine) {
            this.print('\n\x1b[' + fore + ';' + back + 'm' + str + codes, newline);
            this.telnet.prompt = false;
        }
        else
            this.print('\x1b[' + fore + ';' + back + 'm' + str + codes, newline);
    }

    public print(txt: string, newline?: boolean) {
        this.printInternal(txt, newline, false);
    }

    private printInternal(txt: string, newline?: boolean, remote?: boolean) {
        if (txt == null || typeof txt === 'undefined') return;
        if (newline == null) newline = false;
        if (remote == null) remote = false;
        if (newline && this.display.textLength > 0 && !this.display.EndOfLine && this.display.EndOfLineLength !== 0 && !this.telnet.prompt)
            txt = '\n' + txt;
        this.parseInternal(txt, remote);
    }

    public send(data, echo?: boolean) {
        this.telnet.sendData(data);
        this.lastSendTime = Date.now();
        if (echo && this.telnet.echo && this.options.commandEcho)
            this.echo(data);
        else if (echo)
            this.echo('\n');
    }

    public sendRaw(data) {
        this.telnet.sendData(data, true);
        this.lastSendTime = Date.now();
    }

    public sendGMCP(data) {
        this.telnet.sendGMCP(data);
        this.lastSendTime = Date.now();
    }

    public debug(str: string, style?) {
        const data = { value: str };
        this.emit('debug', data);
        if (!this._enableDebug || data == null || typeof data === 'undefined' || data.value == null || typeof data.value === 'undefined' || data.value.length === 0)
            return;
        if (window.console) {
            if (style)
                window.console.log('%c' + str, style);
            else
                window.console.log(data.value);
        }
    }

    public sendCommand(txt?: string, noEcho?: boolean) {
        if (txt == null) {
            txt = this.commandInput.val();
            if (!this.telnet.echo)
                this.commandInput.val('');
            else
                this._input.AddCommandToHistory(txt);
        }
        if (!txt.endsWith('\n'))
            txt = txt + '\n';
        const data = { value: txt, handled: false };
        this.emit('parse-command', data);
        if (data == null || typeof data === 'undefined') return;
        if (data.handled || data.value == null || typeof data.value === 'undefined') return;
        if (data.value.length > 0)
            this.send(data.value, !noEcho);
        if (this.options.keepLastCommand)
            this.commandInput.select();
        else
            this.commandInput.val('');
    }

    public sendBackground(txt: string, noEcho?: boolean) {
        if (txt == null) {
            txt = this.commandInput.val();
            if (!this.telnet.echo)
                this.commandInput.val('');
            else
                this._input.AddCommandToHistory(txt);
        }
        if (!txt.endsWith('\n'))
            txt = txt + '\n';
        const data = { value: txt, handled: false };
        this.emit('parse-command', data);
        if (data == null || typeof data === 'undefined') return;
        if (data.value == null || typeof data.value === 'undefined') return;
        if (!data.handled && data.value.length > 0)
            this.send(data.value, !noEcho);
    }

    get scrollLock(): boolean {
        return this._input.scrollLock;
    }

    set scrollLock(enabled: boolean) {
        this._input.scrollLock = enabled;
    }

    public toggleScrollLock() {
        this._input.toggleScrollLock();
    }

    public UpdateWindow() {
        this.display.updateWindow();
    }

    public close() {
        this.telnet.close();
    }

    public connect() {
        this.errored = false;
        this.emit('connecting');
        this.MSP.reset();
        this.display.ClearMXP();
        this.display.ResetMXPLine();
        this.telnet.connect();
        this.emit('connect');
        this.commandInput.focus();
    }

    public receivedData(data) {
        this.telnet.receivedData(data);
    }

    public notify(title: string, message: string, options?: NotificationOptions) {
        if (this.enableDebug) {
            this.emit('debug', 'notify title: ' + title);
            this.emit('debug', 'notify msg: ' + message);
        }
        this.emit('notify', title, message, options);
    }

    public clear() {
        this.display.clear();
        this.emit('cleared');
    }

    public parseInline(text: string) {
        return this._input.parseInline(text);
    }

    public parseOutgoing(text: string, eAlias?: boolean, stacking?: boolean, noFunction?: boolean) {
        return this._input.parseOutgoing(text, eAlias, stacking, noFunction);
    }

    public clearCache() {
        this._input.clearCaches();
        this._itemCache = {
            triggers: null,
            aliases: null,
            macros: null,
            buttons: null,
            contexts: null,
            variables: null,
            defaultContext: null,
            alarms: null,
            alarmPatterns: []
        };
    }

    public beep() {
        require('electron').shell.beep();
    }

    public raise(event: string, args?, delay?: number) {
        if (!delay || delay < 1)
            this._input.triggerEvent(event, args);
        else
            setTimeout(() => {
                this._input.triggerEvent(event, args);
            }, delay);
    }

    public show() {
        this.emit('show');
    }

    public hide() {
        this.emit('hide');
    }

    public toggle() {
        this.emit('toggle');
    }
}