// cSpell:words cmdfont
// cSpell:ignore endof, Commandon

import EventEmitter = require('events');
import { Telnet, TelnetOption } from "./telnet";
import { Parser, ParserLine } from "./parser";
import { AnsiColorCode } from "./ansi";
import { stripHTML, Size, parseTemplate } from "./library";
import { Settings } from "./settings";
import { input } from "./input";
import { ProfileCollection, Alias, Trigger, Macro, Profile, Button, Context } from "./profile";
import { MSP } from "./msp";
const { version } = require("../../package.json");
const path = require('path');
const fs = require("fs");

interface Line extends ParserLine {
    raw: string;
}

export class Client extends EventEmitter {
    private lineID = ".line";
    private lineCache: string[] = [];
    private _enableDebug: boolean = false;
    private _input: input;
    private _auto: NodeJS.Timer = null;
    private _autoError: boolean = false;
    private _settingsFile: string = parseTemplate(path.join('{data}', 'settings.json'));

    public MSP: MSP;

    public version: string = version;
    public display = null;
    public commandInput = null;
    public character = null;
    public commandCharacter = null;

    public connecting: boolean = false;
    public options: Settings;

    public telnet: Telnet;
    public parser: Parser;
    public profiles: ProfileCollection = new ProfileCollection();
    public connectTime: number = 0;
    public lastSendTime: number = 0;
    public defaultTitle = 'jiMUD';

    set settingsFile(val: string) {
        if (this._settingsFile != val) {
            this._settingsFile = val;
            this.loadOptions();
        }
    }

    get settingsFile(): string { return this._settingsFile; }

    get aliases(): Alias[] {
        return this.profiles.aliases;
    }

    get macros(): Macro[] {
        return this.profiles.macros;
    }

    get triggers(): Trigger[] {
        return this.profiles.triggers;
    }

    get buttons(): Button[] {
        return this.profiles.buttons;
    }

    get contexts(): Context[] {
        return this.profiles.contexts;
    }

    get defaultContext(): boolean {
        return this.profiles.defaultContext;
    }

    get activeProfile(): Profile {
        return this.profiles.active;
    }

    loadProfiles() {
        var p = path.join(parseTemplate("{data}"), "profiles");
        if (!fs.existsSync(p)) {
            this.profiles.add(Profile.Default);
            return;
        }
        this.profiles.load(p);
        if (!this.profiles.contains('Default'))
            this.profiles.add(Profile.Default);
        this.clearTriggerCache();
        this.emit('profiles-loaded');
    }

    saveProfiles() {
        var p = path.join(parseTemplate("{data}"), "profiles");
        if (!fs.existsSync(p))
            fs.mkdirSync(p);
        this.profiles.save(p);
        this.clearTriggerCache();
        this.emit('profiles-updated');
    }

    saveProfile(profile: string) {
        var p = path.join(parseTemplate("{data}"), "profiles");
        if (!fs.existsSync(p))
            fs.mkdirSync(p);
        this.profiles.items[profile].save(p);
        this.clearTriggerCache();
        this.emit('profile-updated', profile);
    }

    toggleProfile(profile: string) {
        this.profiles.toggle(profile);
        this.saveProfile(profile);
        this.clearTriggerCache();
    }

    constructor(display, command, settings?: string) {
        super();
        if (command === null || typeof command == 'undefined') {
            throw "Missing command input";
        }
        if (display === null || typeof display == 'undefined')
            throw "Missing display";

        if (typeof display === 'string')
            this.display = $(display);
        else
            this.display = display;

        this.display.click((event) => {
            if (this.options.CommandonClick)
                this.commandInput.focus();
        });

        if (typeof command === 'string')
            this.commandInput = $(command);
        else
            this.commandInput = command;

        this.MSP = new MSP();
        this.MSP.on('playing', (data) => {
            if (this.enableDebug) this.debug('MSP ' + (data.type ? 'Music' : 'Sound') + ' Playing ' + data.file + ' for ' + data.duration);
            if (!this.options.notifyMSPPlay) return;
            this.echo((data.type ? 'Music' : 'Sound') + ' Playing ' + data.file + ' for ' + data.duration, AnsiColorCode.InfoText, AnsiColorCode.InfoBackground, true, true);
        });
        this.MSP.on('error', (err) => {
            this.error(err);
        });
        this._input = new input(this);
        this._input.on('scroll-lock', (lock) => {
            this.emit('scroll-lock', lock);
        });
        this.character = $("<div id='Character' class='ansi' style='border-bottom: 1px solid black'>W</div>");
        this.character.appendTo('body');
        this.commandCharacter = $("<div id='CmdCharacter'>W</div>");
        this.commandCharacter.appendTo('body');

        this.commandInput.val("");
        this.commandInput.focus();

        this.telnet = new Telnet();
        this.telnet.terminal = "jiMUD";
        this.telnet.version = version;
        this.telnet.on('error', (err) => {
            if (this.enableDebug) this.debug(err);
            if (err) {
                if (err.type == "close" && err.code == 1006)
                    return;
                var msg = [];
                if (err.type)
                    msg.push(err.type);
                if (err.text)
                    msg.push(err.text);
                if (err.message)
                    msg.push(err.message);
                if (err.reason)
                    msg.push(err.reason);

                if (err.code == "ECONNREFUSED")
                    this._autoError = true;
                if (err.code)
                    this.error(err.code + " - " + msg.join(", "));
                else
                    this.error(msg.join(", "));
                if (err.code == "ECONNREFUSED")
                    this.close();
            }
            else
                this.error("Unknown telnet error.");
        });
        this.telnet.on('connecting', () => {
            this.connecting = true;
            this.echo("Trying to connect to " + this.host + ":" + this.port, AnsiColorCode.InfoText, AnsiColorCode.InfoBackground, true, true);
        });
        this.telnet.on('connect', () => {
            this.connecting = false;
            this.echo("Connected...", AnsiColorCode.InfoText, AnsiColorCode.InfoBackground, true, true);
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
            this.echo("Connection closed to " + this.host + ":" + this.port, AnsiColorCode.InfoText, AnsiColorCode.InfoBackground, true, true);
            this.connectTime = 0;
            this.lastSendTime = 0;
            this.MSP.reset();
            this.emit('closed');
        });
        this.telnet.on('received-data', (data) => {
            data = { value: data };
            this.emit('received-data', data);
            if (data === null || typeof data == "undefined" || data.value === null || typeof data.value == "undefined")
                return;
            this.printInternal(data.value, false, true);
            this.debug("Latency: " + this.telnet.latency + "ms");
            this.debug("Latency: " + (this.telnet.latency / 1000) + "s");
        });

        this.telnet.on('received-MSDP', (data) => {
            this.emit('received-MSDP', data);
        });

        this.telnet.on('received-GMCP', (data) => {
            var val: string = data.value;
            var mod: string, idx: number = 0, dl: number = val.length, c;
            if (dl === 0) return;
            for (idx = 0; idx < dl; idx++) {
                c = val.charAt(idx);
                if (c === " " || c === "{" || c === "[")
                    break;
            }
            mod = val.substr(0, idx).trim();
            val = val.substr(idx).trim();
            this.debug("GMCP Module: " + mod);
            this.debug("GMCP Data: " + val);
            var obj;
            try {
                if (val.length > 0)
                    obj = JSON.parse(val);
            }
            catch (e) {
            }
            this.emit('received-GMCP', mod, obj);
        });

        this.telnet.on('windowSize', () => { this.UpdateWindow(); });

        this.parser = new Parser({ display: this.display });
        this.parser.on('debug', (msg) => { this.debug(msg) });
        this.parser.on('add-line', (data: Line) => {
            var t;
            data.raw = stripHTML(data.line);
            this.emit('add-line', data);
            if (data === null || typeof data == "undefined" || data.line === null || typeof data.line == "undefined" || data.line.length === 0)
                return;
            this.emit('add-line-done', data);
            if (data.gagged)
                return;
            t = $(data.line);
            $("span:empty", t).remove();
            this.lineCache.push(t[0].outerHTML);
        });
        this.parser.on('MXP-tag-reply', (tag, args) => {

        });
        this.parser.on('expire-links', (args) => {
            var expire;
            if (args.length > 0)
                expire = this.display.find("a[expire='" + args[0] + "']");
            else
                expire = this.display.find("a[expire]");
            expire.wrapInner('<span/>');
            if (args.length > 0)
                expire = this.display.find("a[expire='" + args[0] + "'] span");
            else
                expire = this.display.find("a[expire] span");
            expire.unwrap();
        });

        this.parser.on("parse-done", () => {
            this.display.removeClass("animate");
            if (this.lineCache.length > 0) {
                var bar = this.display.hasHorizontalScrollBar();
                this.display.append(this.lineCache.join(''));
                if (bar != this.display.hasHorizontalScrollBar())
                    this.UpdateWindow();
                this.scrollDisplay();
                this.emit('parse-done', this.lineCache);
                this.lineCache = [];
            }
            var lines = $(this.lineID, this.display);
            if (lines.length > this.options.bufferSize) {
                var l = 0, c = lines.length - this.options.bufferSize;
                for (; l < c; l++)
                    $(lines[l]).remove();
            }
            lines = null;
            this.display.addClass("animate");
        });
        this.parser.on('set-title', (title, type) => {

            if (typeof title == "undefined" || title === null || title.length === 0)
                window.document.title = this.defaultTitle;
            else if (type !== 1)
                window.document.title = this.options.title.replace("$t", title);

        });
        this.parser.on('music', (data) => {
            this.MSP.music(data);
            this.emit('music', data);
        });
        this.parser.on('sound', (data) => {
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
        this.parser.enableDebug = enable;
        this.MSP.enableDebug = enable;
    }

    get host(): string {
        return this.telnet.host;
    };
    set host(host: string) {
        this.telnet.host = host;
    }

    get port(): number {
        return this.telnet.port;
    };
    set port(port: number) {
        this.telnet.port = port;
    }

    get connected(): boolean {
        return this.telnet.connected;
    }

    loadOptions() {
        this.options = Settings.load(this._settingsFile);

        this.enableDebug = this.options.enableDebug;
        this.parser.enableFlashing = this.options.flashing;
        this.parser.enableMXP = this.options.enableMXP;
        this.parser.enableURLDetection = this.options.enableURLDetection;
        this.parser.enableMSP = this.options.enableMSP;

        if (this.options.colors.length > 0) {
            var colors = this.options.colors;
            for (var c = 0, cl = colors.length; c < cl; c++) {
                if (!colors[c] || colors[c].length === 0) continue;
                this.parser.SetColor(c, colors[c]);
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

        this.UpdateFonts();
        this.scrollDisplay();
        this.emit('options-loaded');
    }

    saveOptions() {
        this.options.save(this._settingsFile);
    }

    setOption(name, value) {
        if (name == -1 || name == "-1")
            return;
        var opt = this.options;
        name = name.split(".");
        for (var o = 0, ol = name.length - 1; o < ol; o++)
            opt = opt[name[o]];
        opt[name[name.length - 1]] = value;
        this.saveOptions();
    }

    getOption(name) {
        if (name == -1 || name == "-1")
            return null;
        var opt = this.options;
        name = name.split(".");
        for (var o = 0, ol = name.length; o < ol; o++)
            opt = opt[name[o]];
        return opt;
    }

    UpdateFonts() {
        //can only update if display has been setup
        if (!this.display) return;
        this.display.css("font-size", this.options.fontSize);
        this.display.css("font-family", this.options.font + ", monospace");
        this.commandInput.css("font-size", this.options.cmdfontSize);
        this.commandInput.css("font-family", this.options.cmdfont + ", monospace");
        this.character.css("font-size", this.options.fontSize);
        this.character.css("font-family", this.options.font + ", monospace");
        this.commandCharacter.css("font-size", this.options.cmdfontSize);
        this.commandCharacter.css("font-family", this.options.cmdfont + ", monospace");
        //this.parser.lineHeight = this.character.height();
    };

    parse(txt: string) {
        this.parseInternal(txt, false);
    };

    private parseInternal(txt: string, remote: boolean, force?: boolean) {
        this.parser.parse(txt, remote, force);
    }

    error(err) {
        err = { error: err, handled: false };
        //this.emit('error', err);
        if (err === null || typeof err == "undefined")
            return;
        if (err.handled) return;
        if (err.error === null || typeof err.error == "undefined")
            this.echo("Error: Unknown.", AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);
        else if (typeof err.error == "string" && err.error.length === 0)
            this.echo("Error: Unknown.", AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);
        else if (err.error instanceof ReferenceError) {
            if (err.error.lineNumber)
                this.echo("Error: File: " + err.error.fileName + ", Line: " + err.error.lineNumber + ", " + err.error.message + ".", AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);
            else
                this.echo("Error: " + err.error + ".", AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);
        }
        else if (err.error instanceof Error)
            this.echo("Error: " + err.error.name + " - " + err.error.message + ".", AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);
        else if (err.error.message)
            this.echo("Error: " + err.error.message + ".", AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);
        else
            this.echo("Error: " + err.error + ".", AnsiColorCode.ErrorText, AnsiColorCode.ErrorBackground, true, true);
        if (this.options.autoConnect && !this.telnet.connected && !this._autoError) {
            if (this._auto)
                clearTimeout(this._auto);
            this._auto = setTimeout(() => { this.connect(); }, 600);
        }
    }

    echo(str: string, fore?: number, back?: number, newline?: boolean, forceLine?: boolean) {
        if (str == null) str = "";
        if (newline == null) newline = false;
        if (forceLine == null) forceLine = false;
        if (fore == null) fore = AnsiColorCode.LocalEcho;
        if (back == null) back = AnsiColorCode.LocalEchoBack;
        var codes = this.parser.CurrentAnsiCode() + "\n";
        if (str.endsWith("\n"))
            str = str.substr(0, str.length - 1);
        if (this.telnet.prompt && forceLine)
            this.print("\n\x1b[" + fore + ";" + back + "m" + str + codes, newline);
        else
            this.print("\x1b[" + fore + ";" + back + "m" + str + codes, newline);
    }

    print(txt: string, newline?: boolean) {
        this.printInternal(txt, newline, false);
    }

    private printInternal(txt: string, newline?: boolean, remote?: boolean) {
        if (txt === null || typeof txt == "undefined") return;
        if (newline == null) newline = false;
        if (remote == null) remote = false;
        if (newline && this.parser.TextLength > 0 && !this.parser.EndofLine && !this.telnet.prompt)
            txt = "\n" + txt;
        this.parseInternal(txt, remote);
    }

    send(data) {
        this.telnet.sendData(data);
        this.lastSendTime = Date.now();
    };
    sendRaw(data) {
        this.telnet.sendData(data, true);
        this.lastSendTime = Date.now();
    };
    sendGMCP(data) {
        this.telnet.sendGMCP(data);
        this.lastSendTime = Date.now();
    };

    debug(str: string) {

        var data = { value: str };
        this.emit('debug', data);
        if (!this._enableDebug || data === null || typeof data == "undefined" || data.value === null || typeof data.value == "undefined" || data.value.length === 0)
            return;
        if (window.console)
            console.log(data.value);
    }

    sendCommand(txt?: string) {
        if (txt == null) {
            txt = this.commandInput.val();
            if (!this.telnet.echo)
                this.commandInput.val("");
            else
                this._input.AddCommandToHistory(txt);
        }
        if (!txt.endsWith("\n"))
            txt = txt + "\n";
        var data = { value: txt, handled: false };
        this.emit('parse-command', data);
        if (data === null || typeof data == "undefined") return;
        if (data.handled || data.value === null || typeof data.value == "undefined") return;
        if (data.value.length > 0) {
            if (this.connected)
                this.send(data.value);
            if (this.telnet.echo && this.options.commandEcho)
                this.echo(data.value);
            else
                this.echo("\n");
        }
        if (this.options.keepLastCommand)
            this.commandInput.select();
        else
            this.commandInput.val("");
    }

    sendBackground(txt: string) {
        if (txt == null) {
            txt = this.commandInput.val();
            if (!this.telnet.echo)
                this.commandInput.val("");
            else
                this._input.AddCommandToHistory(txt);
        }
        if (!txt.endsWith("\n"))
            txt = txt + "\n";
        var data = { value: txt, handled: false };
        this.emit('parse-command', data);
        if (data === null || typeof data == "undefined") return;
        if (data.value === null || typeof data.value == "undefined") return;
        if (!data.handled && data.value.length > 0) {
            if (this.connected)
                this.send(data.value);
            if (this.telnet.echo && this.options.commandEcho)
                this.echo(data.value);
            else
                this.echo("\n");
        }
    };

    get WindowSize(): Size {
        return new Size(this.WindowWidth, this.WindowHeight);
    }

    get WindowWidth(): number {
        return Math.floor((this.display.innerWidth() - 12) / parseFloat(window.getComputedStyle(this.character[0]).width)) - 1;
    }

    get WindowHeight(): number {
        if (this.display.hasHorizontalScrollBar())
            return Math.floor((this.display.innerHeight() - 12 - 4) / (this.character.innerHeight() + 0.5)) - 1;
        return Math.floor((this.display.innerHeight() - 4) / (this.character.innerHeight() + 0.5)) - 1;
    }

    get scrollLock(): boolean {
        return this._input.scrollLock;
    }

    set scrollLock(enabled: boolean) {
        this._input.scrollLock = enabled;
    }

    toggleScrollLock() {
        this._input.toggleScrollLock();
    }

    UpdateWindow() {
        var ws: Size = this.WindowSize;
        this.parser.updateWindow(ws.width, ws.height);
        this.telnet.updateWindow(ws.width, ws.height);
    }

    scrollDisplay() {
        if (!this._input.scrollLock && this.display)
            this.display[0].scrollTop = this.display[0].scrollHeight;
    }

    close() {
        this.telnet.close();
        if (this._auto)
            clearTimeout(this._auto);
    }

    connect() {
        this._autoError = false;
        this.emit('connecting');
        this.MSP.reset();
        this.parser.ClearMXP();
        this.parser.ResetMXPLine();
        this.telnet.connect();
        this.emit("connect");
        this.commandInput.focus();
    };

    receivedData(data) {
        this.telnet.receivedData(data);
    };

    notify(title: string, message: string) {
        if (this.enableDebug) {
            this.emit('debug', "notify title: " + title);
            this.emit('debug', "notify msg: " + message);
        }
        this.emit('notify', title, message);
    }

    clear() {
        this.display.empty();
        this.parser.Clear();
    }

    parseOutgoing(text: string, eAlias?: boolean, stacking?: boolean) {
        return this._input.parseOutgoing(text, eAlias, stacking);
    }

    clearTriggerCache() {
        this._input.clearTriggerCache();
    }


    beep() {
        require('electron').shell.beep();
    };
}