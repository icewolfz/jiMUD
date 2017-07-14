// cSpell:words cmdfont
// cSpell:ignore endof, Commandon

import EventEmitter = require('events');
import { Telnet, TelnetOption } from './telnet';
import { ParserLine, Size } from './types';
import { AnsiColorCode } from './ansi';
import { stripHTML, parseTemplate, getScrollBarHeight, SortArrayByPriority } from './library';
import { Settings } from './settings';
import { Input } from './input';
import { ProfileCollection, Alias, Trigger, Macro, Profile, Button, Context } from './profile';
import { MSP } from './msp';
import { Display } from './display';
const { version } = require('../../package.json');
const path = require('path');
const fs = require('fs');

interface ItemCache {
    triggers: Trigger[];
    aliases: Alias[];
    macros: Macro[];
    buttons: Button[];
    contexts: Context[];
    defaultContext: boolean;
}

export class Client extends EventEmitter {
    private lineID = '.line';
    private _enableDebug: boolean = false;
    private _input: Input;
    private _auto: NodeJS.Timer = null;
    private _autoError: boolean = false;
    private _settingsFile: string = parseTemplate(path.join('{data}', 'settings.json'));
    private _itemCache: ItemCache = {
        triggers: null,
        aliases: null,
        macros: null,
        buttons: null,
        contexts: null,
        defaultContext: null
    };

    public MSP: MSP;

    public version: string = version;
    public display: Display;
    public commandInput = null;

    public connecting: boolean = false;
    public options: Settings;

    public telnet: Telnet;
    public profiles: ProfileCollection = new ProfileCollection();
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
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableAliases)
                this._itemCache.aliases = [];
            else
                this._itemCache.aliases = this.profiles.items[keys[0]].aliases.sort(SortArrayByPriority);
            return this._itemCache.aliases;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableAliases || this.profiles.items[keys[k]].aliases.length === 0)
                continue;
            tmp = tmp.concat(this.profiles.items[keys[k]].aliases.sort(SortArrayByPriority));
        }
        this._itemCache.aliases = tmp;
        return this._itemCache.aliases;
    }

    get macros(): Macro[] {
        if (this._itemCache.macros)
            return this._itemCache.macros;
        const keys = this.profiles.keys;
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableMacros)
                this._itemCache.macros = [];
            else
                this._itemCache.macros = this.profiles.items[keys[0]].macros.sort(SortArrayByPriority);
            return this._itemCache.macros;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableMacros || this.profiles.items[keys[k]].macros.length === 0)
                continue;
            tmp = tmp.concat(this.profiles.items[keys[k]].macros.sort(SortArrayByPriority));
        }
        this._itemCache.macros = tmp;
        return this._itemCache.macros;
    }

    get triggers(): Trigger[] {
        if (this._itemCache.triggers)
            return this._itemCache.triggers;
        const keys = this.profiles.keys;
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableTriggers)
                this._itemCache.triggers = [];
            else
                this._itemCache.triggers = this.profiles.items[keys[0]].triggers.sort(SortArrayByPriority);
            return this._itemCache.triggers;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableTriggers || this.profiles.items[keys[k]].triggers.length === 0)
                continue;
            tmp = tmp.concat(this.profiles.items[keys[k]].triggers.sort(SortArrayByPriority));
        }
        this._itemCache.triggers = tmp;
        return this._itemCache.triggers;
    }

    get buttons(): Button[] {
        if (this._itemCache.buttons)
            return this._itemCache.buttons;
        const keys = this.profiles.keys;
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableButtons)
                this._itemCache.buttons = [];
            else
                this._itemCache.buttons = this.profiles.items[keys[0]].buttons.sort(SortArrayByPriority);
            return this._itemCache.buttons;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableButtons || this.profiles.items[keys[k]].buttons.length === 0)
                continue;
            tmp = tmp.concat(this.profiles.items[keys[k]].buttons.sort(SortArrayByPriority));
        }
        this._itemCache.buttons = tmp;
        return this._itemCache.buttons;
    }

    get contexts(): Context[] {
        if (this._itemCache.contexts)
            return this._itemCache.contexts;
        const keys = this.profiles.keys;
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (this.enabledProfiles.indexOf(keys[0]) === -1 || !this.profiles.items[keys[0]].enableContexts)
                this._itemCache.contexts = [];
            else
                this._itemCache.contexts = this.profiles.items[keys[0]].contexts.sort(SortArrayByPriority);
            return this._itemCache.contexts;
        }
        for (; k < kl; k++) {
            if (this.enabledProfiles.indexOf(keys[k]) === -1 || !this.profiles.items[keys[k]].enableContexts || this.profiles.items[keys[k]].contexts.length === 0)
                continue;
            tmp = tmp.concat(this.profiles.items[keys[k]].contexts.sort(SortArrayByPriority));
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

    get activeProfile(): Profile {
        return this.profiles.active;
    }

    public loadProfiles() {
        const p = path.join(parseTemplate('{data}'), 'profiles');
        if (!fs.existsSync(p)) {
            this.profiles.add(Profile.Default);
            return;
        }
        this.profiles.load(p);
        if (!this.profiles.contains('Default'))
            this.profiles.add(Profile.Default);
        this.clearCache();
        this.emit('profiles-loaded');
    }

    public saveProfiles() {
        const p = path.join(parseTemplate('{data}'), 'profiles');
        if (!fs.existsSync(p))
            fs.mkdirSync(p);
        this.profiles.save(p);
        this.clearCache();
        this.emit('profiles-updated');
    }

    public saveProfile(profile: string) {
        const p = path.join(parseTemplate('{data}'), 'profiles');
        if (!fs.existsSync(p))
            fs.mkdirSync(p);
        this.profiles.items[profile].save(p);
        this.clearCache();
        this.emit('profile-updated', profile);
    }

    public toggleProfile(profile: string) {
        profile = profile.toLowerCase();
        let p = this.enabledProfiles;
        if (p.indexOf(profile) === -1) {
            p.push(profile);
        }
        else {
            //remove profile
            p = p.filter((a) => { return a !== profile; });
            //cant disable if only profile
            if (p.length === 0)
                p = [profile];
        }
        this.enabledProfiles = p;
        this.saveOptions();
        this.clearCache();
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

        if (typeof command === 'string')
            this.commandInput = $(command);
        else
            this.commandInput = command;

        this.MSP = new MSP();
        this.MSP.forcedDefaultMusicURL = '';
        this.MSP.forcedDefaultSoundURL = '';
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
            this.display.scrollDisplay();
            this.emit('scroll-lock', lock);
        });

        this._input.on('item-added', (type, profile, item) => {
            this.emit('item-added', type, profile, item);
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
                    this._autoError = true;
                if (err.code)
                    this.error(err.code + ' - ' + msg.join(', '));
                else
                    this.error(msg.join(', '));
                if (err.code === 'ECONNREFUSED')
                    this.close();
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
            try {
                if (val.length > 0)
                    obj = JSON.parse(val);
            }
            catch (e) {
                this.error('Invalid GMCP');
            }
            this.emit('received-GMCP', mod, obj);
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
            this.emit('MXP-tag-reply', tag, args);
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
        this.loadProfiles();
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
        this.display.enableURLDetection = this.options.enableURLDetection;
        this.display.enableMSP = this.options.enableMSP;

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

        this.MSP.enabled = this.options.enableMSP;
        this.MSP.savePath = parseTemplate(this.options.soundPath);

        this._input.scrollLock = this.options.scrollLocked;
        this.display.scrollLock = this.options.scrollLocked;
        this.display.enableSplit = this.options.display.split;
        this.display.splitLive = this.options.display.splitLive;
        this.display.splitHeight = this.options.display.splitHeight;
        this.UpdateFonts();
        this.display.scrollDisplay();
        this.emit('options-loaded');
    }

    public saveOptions() {
        this.options.save(this._settingsFile);
    }

    public setOption(name, value) {
        if (name === -1 || name === '-1')
            return;
        let opt = this.options;
        let o;
        const ol = name.length - 1;
        name = name.split('.');
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
        const ol = name.length;
        name = name.split('.');
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
        else if (err.stack)
            msg += err.stack;
        else if (err instanceof Error || err instanceof TypeError)
            msg = err.name + ' - ' + err.message;
        else if (err.message)
            msg = err.message;
        else
            msg = err;

        this.echo('Error: ' + msg + '.', AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);

        if (this.options.logErrors) {
            fs.writeFileSync(parseTemplate(path.join('{data}', 'jimud.error.log')), new Date().toLocaleString() + '\n', { flag: 'a' });
            fs.writeFileSync(parseTemplate(path.join('{data}', 'jimud.error.log')), msg + '\n', { flag: 'a' });
        }

        if (this.options.autoConnect && !this.telnet.connected && !this._autoError) {
            if (this._auto)
                clearTimeout(this._auto);
            this._auto = setTimeout(() => { this.connect(); }, 600);
        }
    }

    public echo(str: string, fore?: number, back?: number, newline?: boolean, forceLine?: boolean) {
        if (str == null) str = '';
        if (newline == null) newline = false;
        if (forceLine == null) forceLine = false;
        if (fore == null) fore = AnsiColorCode.LocalEcho;
        if (back == null) back = AnsiColorCode.LocalEchoBack;
        const codes = this.display.CurrentAnsiCode() + '\n';
        if (str.endsWith('\n'))
            str = str.substr(0, str.length - 1);
        if (this.telnet.prompt && forceLine)
            this.print('\n\x1b[' + fore + ';' + back + 'm' + str + codes, newline);
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
        if (newline && this.display.textLength > 0 && !this.display.EndOfLine && !this.telnet.prompt)
            txt = '\n' + txt;
        this.parseInternal(txt, remote);
    }

    public send(data) {
        this.telnet.sendData(data);
        this.lastSendTime = Date.now();
    }

    public sendRaw(data) {
        this.telnet.sendData(data, true);
        this.lastSendTime = Date.now();
    }

    public sendGMCP(data) {
        this.telnet.sendGMCP(data);
        this.lastSendTime = Date.now();
    }

    public debug(str: string) {
        const data = { value: str };
        this.emit('debug', data);
        if (!this._enableDebug || data == null || typeof data === 'undefined' || data.value == null || typeof data.value === 'undefined' || data.value.length === 0)
            return;
        if (window.console)
            window.console.log(data.value);
    }

    public sendCommand(txt?: string) {
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
        if (data.value.length > 0) {
            if (this.connected)
                this.send(data.value);
            if (this.telnet.echo && this.options.commandEcho)
                this.echo(data.value);
            else
                this.echo('\n');
        }
        if (this.options.keepLastCommand)
            this.commandInput.select();
        else
            this.commandInput.val('');
    }

    public sendBackground(txt: string) {
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
        if (!data.handled && data.value.length > 0) {
            if (this.connected)
                this.send(data.value);
            if (this.telnet.echo && this.options.commandEcho)
                this.echo(data.value);
            else
                this.echo('\n');
        }
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
        if (this._auto)
            clearTimeout(this._auto);
    }

    public connect() {
        this._autoError = false;
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

    public notify(title: string, message: string) {
        if (this.enableDebug) {
            this.emit('debug', 'notify title: ' + title);
            this.emit('debug', 'notify msg: ' + message);
        }
        this.emit('notify', title, message);
    }

    public clear() {
        this.display.clear();
    }

    public parseOutgoing(text: string, eAlias?: boolean, stacking?: boolean) {
        return this._input.parseOutgoing(text, eAlias, stacking);
    }

    public clearCache() {
        this._input.clearTriggerCache();
        this._itemCache = {
            triggers: null,
            aliases: null,
            macros: null,
            buttons: null,
            contexts: null,
            defaultContext: null
        };
    }

    public beep() {
        require('electron').shell.beep();
    }
}