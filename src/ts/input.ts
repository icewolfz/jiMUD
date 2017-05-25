//cSpell:ignore triggerprompt, idletime, connecttime, soundinfo, musicinfo, playmusic, playm, playsound, stopmusic, stopm, stopsound
//cSpell:ignore stopallsound, stopa, showprompt, showp, sayprompt, sayp, echoprompt, echop, unalias, setsetting, getsetting, profilelist
//cSpell:ignore keycode
import EventEmitter = require('events');
import { clipboard } from 'electron';
import { MacroModifiers } from "./profile";
import { getTimeSpan, FilterArrayByKeyValue, SortArrayByPriority } from "./library";
import { Client } from "./client";
import { Tests } from "./test";
import { Alias, Trigger, Macro, Profile } from "./profile";
import { SettingList, NewLineType } from "./settings";

const buzz = require('buzz');

function ProperCase(str) {
    return str.replace(/\w*\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

export class input extends EventEmitter {
    private _historyIdx: number = -1;
    private _commandHistory: string[]
    private _locked: number = 0;
    private _tests: Tests;
    private _TriggerCache: Trigger[] = null;
    private _TriggerFunctionCache = {};
    private _scrollLock: boolean = false;

    public client: Client = null;

    get scrollLock(): boolean {
        return this._scrollLock;
    }
    set scrollLock(locked: boolean) {
        if (locked != this._scrollLock) {
            this._scrollLock = locked;
            this.emit('scroll-lock', this.scrollLock);
        }
    }

    constructor(client: Client) {
        super();
        if (!client)
            throw "Invalid client!";
        this.client = client;
        this._tests = new Tests(client);
        this._commandHistory = [];
        $(document).keydown((event) => {
            if (!this.isLocked && this.ProcessMacros(event.which, event.altKey, event.ctrlKey, event.shiftKey, event.metaKey)) {
                event.preventDefault();
                event.stopPropagation();
            }
            //toggle scroll lock
            else if (event.which == 145)
                this.toggleScrollLock();
        });

        this.client.on('parse-command', (data) => {
            if (this.client.options.parseCommands)
                data.value = this.parseOutgoing(data.value);
        });

        this.client.on('add-line', (data) => {
            this.ExecuteTriggers(0, data.raw, data.fragment, false);
        });

        this.client.commandInput.keyup((event) => {
            if (event.which != 27 && event.which != 38 && event.which != 40)
                this._historyIdx = this._commandHistory.length;
        });

        this.client.commandInput.keydown((event) => {
            switch (event.which) {
                case 27://esc
                    client.commandInput.blur();
                    client.commandInput.val("");
                    client.commandInput.select();
                    this._historyIdx = this._commandHistory.length;
                    break;
                case 38://up
                    if (this._historyIdx == this._commandHistory.length && this.client.commandInput.val().length > 0) {
                        this.AddCommandToHistory(this.client.commandInput.val());
                        if (this.client.commandInput.val() == this._commandHistory[this._historyIdx - 1])
                            this._historyIdx--;
                    }
                    this._historyIdx--;
                    if (this._historyIdx < 0)
                        this._historyIdx = 0;
                    if (this._commandHistory.length < 0) {
                        this._historyIdx = -1;
                        this.client.commandInput.val("");
                        this.client.commandInput.select();
                    }
                    else {
                        if (this._commandHistory.length > 0 && this._historyIdx < this._commandHistory.length && this._historyIdx >= 0)
                            this.client.commandInput.val(this._commandHistory[this._historyIdx]);
                        this.client.commandInput.select();
                    }
                    break;
                case 40://down
                    if (this._historyIdx == this._commandHistory.length && this.client.commandInput.val().length > 0)
                        this.AddCommandToHistory(this.client.commandInput.val());
                    this._historyIdx++;
                    if (this._historyIdx >= this._commandHistory.length || this._commandHistory.length < 1) {
                        this._historyIdx = this._commandHistory.length;
                        this.client.commandInput.val("");
                        this.client.commandInput.select();
                    }
                    else {
                        if (this._commandHistory.length > 0 && this._historyIdx < this._commandHistory.length && this._historyIdx >= 0)
                            this.client.commandInput.val(this._commandHistory[this._historyIdx]);
                        this.client.commandInput.select();
                    }
                    break;
                case 13: // return
                    switch (this.client.options.newlineShortcut) {
                        case NewLineType.Ctrl:
                            if (event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) {
                                this.client.commandInput.val(function (i, val) {
                                    return val + "\n";
                                });
                                return true;
                            }
                            break;
                        case NewLineType.CtrlAndShift:
                            if (event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey) {
                                this.client.commandInput.val(function (i, val) {
                                    return val + "\n";
                                });
                                return true;
                            }
                            break;
                        case NewLineType.CtrlOrShift:
                            if ((event.ctrlKey || event.shiftKey) && !event.metaKey && !event.altKey) {
                                this.client.commandInput.val(function (i, val) {
                                    return val + "\n";
                                });
                                return true;
                            }
                            break;
                        case NewLineType.Shift:
                            if ((event.ctrlKey && event.shiftKey) && !event.metaKey && !event.altKey) {
                                this.client.commandInput.val(function (i, val) {
                                    return val + "\n";
                                });
                                return true;
                            }
                            break;
                    }
                    event.preventDefault();
                    this.client.sendCommand();
                    break;
            }
        }).keypress((event) => {
            return true;
        });

    }

    get isLocked(): boolean {
        return this._locked === 0 ? false : true;
    }

    addLock() {
        this._locked++;
    }

    removeLock() {
        this._locked--;
    }

    AddCommandToHistory(cmd: string) {
        if ((this._commandHistory.length < 1 || this._commandHistory[this._commandHistory.length - 1] != cmd) && cmd.length > 0) {
            if (this._commandHistory.length >= this.client.options.commandHistorySize)
                this._commandHistory.shift();
            this._commandHistory.push(cmd);
        }
    }

    executeScript(txt: string) {
        if (txt == null)
            return txt;
        var tTxt: string = txt.trim();
        if (this._tests.TestFunctions[tTxt]) {
            if (this._tests.TestFunctions[tTxt]) {
                this._tests.TestFunctions[tTxt].apply(this._tests, []);
                return null;
            }
        }

        var state: number = 0;
        var idx: number = 0, c: string, r;
        var tl: number = txt.length;
        var fun: string = "";
        var args = [];
        var arg: string = "";
        var raw: string;
        var pd: boolean = this.client.options.parseDoubleQuotes;
        var ps: boolean = this.client.options.parseSingleQuotes;

        for (; idx < tl; idx++) {
            c = txt.charAt(idx);
            switch (state) {
                case 1:
                    if (c === ' ') {
                        state = 2;
                        raw += c;
                    }
                    else {
                        fun += c;
                        raw += c;
                    }
                    break;
                case 2:
                    if (c === ' ') {
                        args.push(arg);
                        arg = "";
                    }
                    else {
                        if (c === '"' && pd)
                            state = 3;
                        else if (c === '\'' && ps)
                            state = 4;
                        arg += c;
                    }
                    raw += c;
                    break;
                case 3:
                    if (c === '"')
                        state = 2;
                    arg += c;
                    raw += c;
                    break;
                case 4:
                    if (c === '\'')
                        state = 2;
                    arg += c;
                    raw += c;
                    break;
                default:
                    if (idx === 0 && c === "#") {
                        state = 1;
                        fun = "";
                        args = [];
                        arg = "";
                        raw = c;
                    }
                    else
                        return txt;
                    break;
            }
        }
        if (fun.length > 0) {
            if (state == 3)
                arg += '"';
            else if (state == 4)
                arg += '\'';
            if (arg.length > 0) args.push(arg);
            return this.executeFunction(fun, args, raw);
        }
        return txt;
    }

    executeFunction(fun: string, args, raw: string) {
        var n, f = false;
        var items, al, i, tmp;
        switch (fun.toLowerCase()) {
            case "notify":
            case "not":
                n = args[0];
                al = args.length;
                if (n.startsWith('\'')) {
                    n = n.substring(1);
                    if (n.endsWith('\'') && !n.endsWith('\\\'')) {
                        i = 1;
                    }
                    else {
                        for (i = 1; i < al; i++) {
                            n += " " + args[i];
                            if (args[i].endsWith('\'')) {
                                if (args[i].endsWith('\\\''))
                                    continue;
                                n = n.substring(0, n.length - 1);
                                i++;
                                break;
                            }
                        }
                    }
                }
                else
                    i = 1;
                if (i < al)
                    args = args.slice(i).join(' ');
                else
                    args = '';
                n = n.replace(/\\\'/g, '\'');
                args = args.replace(/\\\'/g, '\'');
                if (/^"(.*)"$/.exec(n) !== null || /^'(.*)'$/.exec(n) !== null)
                    n = n.substring(1, n.length - 1);
                if (/^"(.*)"$/.exec(args) !== null || /^'(.*)'$/.exec(args) !== null)
                    args = args.substring(1, args.length - 1);
                this.client.notify(n, args);
                return null;
            case "idle":
            case "idletime":
                if (!this.client.lastSendTime)
                    this.client.echo("Not connected", -7, -8, true, true);
                else
                    this.client.echo("You have been idle: " + getTimeSpan(Date.now() - this.client.lastSendTime), -7, -8, true, true);
                return null;
            case "connect":
            case "connecttime":
                if (!this.client.connectTime)
                    this.client.echo("Not connected", -7, -8, true, true);
                else
                    this.client.echo("You have been connected: " + getTimeSpan(Date.now() - this.client.connectTime), -7, -8, true, true);
                return null;
            case "beep":
                this.client.beep();
                return null;
            case "version":
            case "ve":
                this.client.echo(this.client.telnet.terminal + " v" + this.client.version, -7, -8, true, true);
                return null;
            case "soundinfo":
                if (this.client.MSP.SoundState.playing) {
                    this.client.echo("Playing Sound - " + this.client.MSP.SoundState.file + " - " + buzz.toTimer(this.client.MSP.SoundState.sound.getTime()) + "/" + buzz.toTimer(this.client.MSP.SoundState.sound.getDuration()), -7, -8, true, true);
                }
                else
                    this.client.echo("No sound currently playing.", -7, -8, true, true);
                return null;
            case "musicinfo":
                if (this.client.MSP.MusicState.playing)
                    this.client.echo("Playing Music - " + this.client.MSP.MusicState.file + " -  " + buzz.toTimer(this.client.MSP.MusicState.sound.getTime()) + "/" + buzz.toTimer(this.client.MSP.MusicState.sound.getDuration()), -7, -8, true, true);
                else
                    this.client.echo("No music currently playing.", -7, -8, true, true);
                return null;
            case "playmusic":
            case "playm":
                args = args.join(' ');
                tmp = { off: false, file: "", url: "", volume: 100, repeat: 1, priority: 50, type: "", continue: true };
                i = args.lastIndexOf('/');
                if (i === -1)
                    tmp.file = args;
                else {
                    tmp.file = args.substring(i + 1);
                    tmp.url = args.substring(0, i + 1);
                }
                this.client.MSP.music(tmp);
                return null;
            case "playsound":
            case "plays":
                args = args.join(' ');
                tmp = { off: false, file: "", url: "", volume: 100, repeat: 1, priority: 50, type: "", continue: true };
                i = args.lastIndexOf('/');
                if (i === -1)
                    tmp.file = args;
                else {
                    tmp.file = args.substring(i + 1);
                    tmp.url = args.substring(0, i + 1);
                }
                this.client.MSP.sound(tmp);
                return null;
            case "stopmusic":
            case "stopm":
                this.client.MSP.MusicState.close();
                return null;
            case "stopsound":
            case "stops":
                this.client.MSP.SoundState.close();
                return null;
            case "stopallsound":
            case "stopa":
                this.client.MSP.MusicState.close();
                this.client.MSP.SoundState.close();
                return null;
            case "showprompt":
            case "showp":
                args = args.join(' ');
                this.client.telnet.receivedData(args);
                this.client.telnet.prompt = true;
                return null;
            case "show":
            case "sh":
                args = args.join(' ') + "\n";
                this.client.telnet.receivedData(args);
                return null;
            case "sayprompt":
            case "sayp":
            case "echoprompt":
            case "echop":
                args = args.join(' ');
                this.client.print("\x1b[-7;-8m" + args + "\x1b[0m", false);
                return null;
            case "say":
            case "sa":
            case "echo":
            case "ec":
                args = args.join(' ');
                if (this.client.telnet.prompt)
                    this.client.print("\n\x1b[-7;-8m" + args + "\x1b[0m\n", false);
                else
                    this.client.print("\x1b[-7;-8m" + args + "\x1b[0m\n", false);
                this.client.telnet.prompt = false;
                return null;
            case "alias":
            case "al":
                if (args.length === 0)
                    this.client.error("Invalid syntax use #alias name value");
                else if (args.length === 1)
                    this.client.error("Must supply an alias value");
                else {
                    items = this.client.activeProfile.aliases;
                    n = args[0];
                    args = args.slice(1).join(' ');
                    if (/^"(.*)"$/.exec(args) !== null || /^'(.*)'$/.exec(args) !== null)
                        args = args.substring(1, args.length - 1);
                    if (/^\d+$/.exec(n)) {
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            this.client.error("Alias index must be >= 0 and < " + items.length);
                        else {
                            items[n].value = args;
                            this.client.echo("Alias '" + items[n].pattern + "' updated.", -7, -8, true, true);
                            this.client.activeProfile.aliases = items;
                            this.client.saveProfile(this.client.activeProfile.name);
                        }
                    }
                    else {
                        if (/^"(.*)"$/.exec(n) !== null || /^'(.*)'$/.exec(n) !== null)
                            n = n.substring(1, n.length - 1);
                        for (i = 0, al = items.length; i < al; i++) {
                            if (items[i]["pattern"] == n) {
                                items[i].value = args;
                                this.client.echo("Alias '" + n + "' updated.", -7, -8, true, true);
                                f = true;
                                break;
                            }
                        }
                        if (!f) {
                            tmp = new Alias(n, args);
                            items.push(f);
                            //TODO when profile manager added add code to update loaded profiles
                            //if (_dlgPro && !_dlgPro.dialog("options").closed)
                            //AddItem('Alias', 'aliases', f, items.length - 1, this.client.activeProfile.name);
                            this.client.echo("Alias '" + n + "' added.", -7, -8, true, true);
                        }
                        this.client.activeProfile.aliases = items;
                        this.client.saveProfile(this.client.activeProfile.name);
                    }
                }
                return null;
            case "unalias":
            case "una":
                if (args.length === 0)
                    this.client.error("Invalid syntax use #unalias name");
                else {
                    items = this.client.activeProfile.aliases;
                    n = args.join(' ');
                    if (/^\d+$/.exec(n)) {
                        tmp = n;
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            this.client.error("Alias index must be >= 0 and < " + items.length);
                        else
                            f = true;
                    }
                    else {
                        if (/^"(.*)"$/.exec(n) !== null || /^'(.*)'$/.exec(n) !== null)
                            n = n.substring(1, n.length - 1);
                        tmp = n;
                        for (i = 0, al = items.length; i < al; i++) {
                            if (items[i]["pattern"] == n) {
                                n = i;
                                f = true;
                                break;
                            }
                        }
                    }
                    if (!f)
                        this.client.echo("Alias '" + tmp + "' not found.", -7, -8, true, true);
                    else {
                        this.client.echo("Alias '" + items[n].pattern + "' removed.", -7, -8, true, true);
                        items.splice(n, 1);
                        //TODO update once profile manager is created to ensure interface is updated
                        //if (_dlgPro && !_dlgPro.dialog("options").closed)
                        //DeleteItem('Alias', 'aliases', n, this.client.activeProfile.name);
                        this.client.activeProfile.aliases = items;
                        this.client.saveProfile(this.client.activeProfile.name);
                    }
                }
                return null;
            case "setsetting":
            case "sets":
                if (args.length === 0)
                    this.client.error("Invalid syntax use #setsetting name value");
                else if (args.length === 1)
                    this.client.error("Must supply a setsetting value");
                else {
                    n = args[0];
                    args = args.slice(1).join(' ');
                    if (/^"(.*)"$/.exec(args) !== null || /^'(.*)'$/.exec(args) !== null)
                        args = args.substring(1, args.length - 1);
                    if (/^\d+$/.exec(n)) {
                        tmp = n;
                        n = parseInt(n, 10);
                        if (n < 0 || n >= SettingList.length)
                            this.client.error("Setting index must be >= 0 and < " + SettingList.length);
                        f = true;
                    }
                    else {
                        if (/^"(.*)"$/.exec(n) !== null || /^'(.*)'$/.exec(n) !== null)
                            n = n.substring(1, n.length - 1);
                        n = n.toLowerCase();
                        for (i = 0, al = SettingList.length; i < al; i++) {
                            if (SettingList[i][0].toLowerCase() == n) {
                                n = i;
                                f = true;
                                break;
                            }
                        }
                    }
                    if (!f)
                        this.client.error("Unknown setting '" + tmp + "'");
                    else {
                        switch (SettingList[n][2]) {
                            case 0:
                                if (SettingList[n][4] > 0 && args.length > SettingList[n][4])
                                    this.client.error("String can not be longer then " + SettingList[n][4] + " characters");
                                else {
                                    this.client.setOption(SettingList[n][1] || SettingList[n][0], args);
                                    this.client.echo("Setting '" + SettingList[n][0] + "' set to '" + args + "'.", -7, -8, true, true);
                                    this.client.loadOptions();
                                }
                                break;
                            case 1:
                            case 3:
                                switch (args.toLowerCase()) {
                                    case "true":
                                    case "1":
                                    case "yes":
                                        this.client.setOption(SettingList[n][1] || SettingList[n][0], true);
                                        this.client.echo("Setting '" + SettingList[n][0] + "' set to true.", -7, -8, true, true);
                                        this.client.loadOptions();
                                        break;
                                    case "no":
                                    case "false":
                                    case "0":
                                        this.client.setOption(SettingList[n][1] || SettingList[n][0], false);
                                        this.client.echo("Setting '" + SettingList[n][0] + "' set to false.", -7, -8, true, true);
                                        this.client.loadOptions();
                                        break;
                                    case "toggle":
                                        args = this.client.getOption(SettingList[n][1] || SettingList[n][0]) ? false : true;
                                        this.client.setOption(SettingList[n][1] || SettingList[n][0], args);
                                        this.client.echo("Setting '" + SettingList[n][0] + "' set to " + args + ".", -7, -8, true, true);
                                        this.client.loadOptions();
                                        break;
                                    default:
                                        this.client.error("Invalid value, must be true or false");
                                        break;
                                }
                                break;
                            case 2:
                                i = parseInt(args, 10);
                                if (isNaN(i))
                                    this.client.error("Invalid number '" + args + "'");
                                else {
                                    this.client.setOption(SettingList[n][1] || SettingList[n][0], i);
                                    this.client.echo("Setting '" + SettingList[n][0] + "' set to '" + i + "'.", -7, -8, true, true);
                                    this.client.loadOptions();
                                }
                                break;
                            case 4:
                            case 5:
                                this.client.error("Unsupported setting '" + n + "'");
                                break;
                        }
                    }
                }
                return null;
            case "getsetting":
            case "gets":
                if (args.length === 0)
                    this.client.error("Invalid syntax use #getsetting name");
                else {
                    n = args.join(' ');
                    if (/^\d+$/.exec(n)) {
                        n = parseInt(n, 10);
                        if (n < 0 || n >= SettingList.length)
                            this.client.error("Setting index must be >= 0 and < " + SettingList.length);
                        else
                            f = true;
                    }
                    else {
                        if (/^"(.*)"$/.exec(n) !== null || /^'(.*)'$/.exec(n) !== null)
                            n = n.substring(1, n.length - 1);
                        tmp = n;
                        n = n.toLowerCase();
                        if (n != "all") {
                            for (i = 0, al = SettingList.length; i < al; i++) {
                                if (SettingList[i][0].toLowerCase() == n) {
                                    n = i;
                                    f = true;
                                    break;
                                }
                            }
                        }
                        if (n == "all") {
                            tmp = "Current settings:\n";
                            //this.client.echo("Current settings:", -7, -8, true, true);
                            for (i = 0, al = SettingList.length; i < al; i++) {
                                switch (SettingList[i][2]) {
                                    case 0:
                                    case 2:
                                        //this.client.echo("    "+_SettingList[i][0]+": "+getSetting(_SettingList[i][0]), -7, -8, true, true);
                                        tmp += "    " + SettingList[i][0] + ": " + this.client.getOption(SettingList[n][1] || SettingList[n][0]) + "\n";
                                        break;
                                    case 1:
                                    case 3:
                                        if (this.client.getOption(SettingList[n][1] || SettingList[n][0]))
                                            tmp += "    " + SettingList[i][0] + ": true\n";
                                        //this.client.echo("    "+_SettingList[i][0]+": true", -7, -8, true, true);
                                        else
                                            tmp += "    " + SettingList[i][0] + ": false\n";
                                        //this.client.echo("    "+_SettingList[i][0]+": false", -7, -8, true, true);
                                        break;
                                }
                            }
                            this.client.echo(tmp, -7, -8, true, true);
                        }
                        else if (!f)
                            this.client.error("Unknown setting '" + n + "'");
                        else {
                            switch (SettingList[n][2]) {
                                case 0:
                                case 2:
                                    this.client.echo("Setting '" + SettingList[n][0] + "' is '" + this.client.getOption(SettingList[n][1] || SettingList[n][0]) + "'", -7, -8, true, true);
                                    break;
                                case 1:
                                case 3:
                                    if (this.client.getOption(SettingList[n][1] || SettingList[n][0]))
                                        this.client.echo("Setting '" + SettingList[n][0] + "' is true", -7, -8, true, true);
                                    else
                                        this.client.echo("Setting '" + SettingList[n][0] + "' is false", -7, -8, true, true);
                                    break;
                            }
                        }
                    }
                }
                return null;
            case "profilelist":
                i = 0;
                al = this.client.profiles.length;
                this.client.echo("\x1b[4mProfiles:\x1b[0m", -7, -8, true, true);
                for (; i < al; i++) {
                    if (this.client.profiles.items[this.client.profiles.items[i]].enabled)
                        this.client.echo("   " + this.client.profiles.items[i] + " is enabled", -7, -8, true, true);
                    else
                        this.client.echo("   " + this.client.profiles.items[i] + " is disabled", -7, -8, true, true);
                }
                return null;
            case "profile":
            case "pro":
                if (args.length === 0)
                    this.client.error("Invalid syntax use #profile name or #profile name enable/disable");
                else if (args.length === 1) {
                    if (!this.client.profiles.toggle(args[0])) {
                        if (!this.client.profiles.contains(args[0])) {
                            this.client.error("Profile not found");
                            return null;
                        }
                        else {
                            this.client.error(args[0] + " can not be disabled as it is the only one enabled");
                            return null;
                        }
                    }
                    this.client.saveProfile(args[0]);
                    if (this.client.profiles[args[0]].enabled)
                        args = args[0] + " is enabled";
                    else
                        args = args[0] + " is disabled";
                }
                else {
                    if (!this.client.profiles[args[0]])
                        this.client.error("Profile not found");
                    if (!args[1])
                        this.client.error("Invalid syntax use #profile name or #profile name enable/disable");
                    switch (args[1].toLowerCase()) {
                        case "enable":
                        case "on":
                        case "yes":
                            if (this.client.profiles[args[0]].enabled)
                                args = args[0] + " is already enabled";
                            else {
                                if (!this.client.profiles.toggle(args[0])) {
                                    if (!this.client.profiles.contains(args[0])) {
                                        this.client.error("Profile not found");
                                        return null;
                                    }
                                    args = args[0] + " remains disabled";
                                }
                                else
                                    args = args[0] + " is enabled";
                                this.client.saveProfile(args[0]);
                            }
                            break;
                        case "disable":
                        case "off":
                        case "no":
                            if (!this.client.profiles[args[0]].enabled)
                                args = args[0] + " is already disabled";
                            else {
                                if (!this.client.profiles.toggle(args[0])) {
                                    if (!this.client.profiles.contains(args[0])) {
                                        this.client.error("Profile not found");
                                        return null;
                                    }
                                    else {
                                        this.client.error(args[0] + " can not be disabled as it is the only one enabled");
                                        return null;
                                    }
                                }
                                this.client.saveProfile(args[0]);
                                args = args[0] + " is disabled";
                            }
                            break;
                        default:
                            this.client.error("Invalid syntax use #profile name or #profile name enable/disable");
                            return null;
                    }
                }
                if (this.client.telnet.prompt)
                    this.client.print("\n\x1b[-7;-8m" + args + "\x1b[0m\n", false);
                else
                    this.client.print("\x1b[-7;-8m" + args + "\x1b[0m\n", false);
                this.client.telnet.prompt = false;
                return null;
        }
        var data = { name: fun, args: args, raw: raw, handled: false };
        this.client.emit('function', data);
        if (data.handled)
            return null;
        return data.raw;
    }

    parseOutgoing(text: string, eAlias?: boolean, stacking?: boolean) {
        var tl = text.length;
        if (text === null || tl === 0)
            return text;
        var str: string = "";
        var alias: string = "", AliasesCached;
        var state = 0;
        var aliases = this.client.aliases;
        var stackingChar: string = this.client.options.commandStackingChar;
        var spChar: string = this.client.options.speedpathsChar;
        var ePaths: boolean = this.client.options.enableSpeedpaths;
        var args = [];
        var arg: string = "";
        var findAlias: boolean = true;
        var out: string = "";
        var a, c: string, al: number;
        var idx: number = 0, start: boolean = true;
        var pd: boolean = this.client.options.parseDoubleQuotes;
        var ps: boolean = this.client.options.parseSingleQuotes;

        if (eAlias == null)
            eAlias = aliases.length > 0;
        else
            eAlias = eAlias && aliases.length > 0;

        //if no character set treat it as disabled
        if (stackingChar.length === 0)
            stacking = false;
        else if (stacking == null)
            stacking = this.client.options.commandStacking;
        else
            stacking = stacking && this.client.options.commandStacking;
        //@TODO re-code someday to be part of the parser engine instead of simple regex
        var copied = clipboard.readText('selection') || '';
        text = text.replace(/(\%|\$)\{copied\}/g, copied);
        text = text.replace(/(\%|\$)\{copied.lower\}/g, copied);
        text = text.replace(/(\%|\$)\{copied.upper\}/g, copied.toUpperCase());
        text = text.replace(/(\%|\$)\{copied.proper\}/g, ProperCase(copied));

        text = text.replace(/(\%|\$)\{(selected|selectedurl|selectedline|selectedword|selurl|selline|selword)\}/g, function (v, e, w) { return window["$" + w]; });
        text = text.replace(/(\%|\$)\{(selected|selectedurl|selectedline|selectedword|selurl|selline|selword).lower\}/g, function (v, e, w) { return window["$" + w].toLowerCase(); });
        text = text.replace(/(\%|\$)\{(selected|selectedurl|selectedline|selectedword|selurl|selline|selword).upper\}/g, function (v, e, w) { return window["$" + w].toUpperCase(); });
        text = text.replace(/(\%|\$)\{(selected|selectedurl|selectedline|selectedword|selurl|selline|selword).proper\}/g, function (v, e, w) { return ProperCase(window["$" + w]); });

        text = text.replace(/(\%|\$)\{lower\((.*)\)\}/g, function (v, e, w) { return w.toLowerCase(); });
        text = text.replace(/(\%|\$)\{upper\((.*)\)\}/g, function (v, e, w) { return w.toUpperCase(); });
        text = text.replace(/(\%|\$)\{proper\((.*)\)\}/g, function (v, e, w) { return ProperCase(w); });

        tl = text.length;

        for (idx = 0; idx < tl; idx++) {
            c = text.charAt(idx);
            switch (state) {
                case 1:
                    //quoted string
                    if (c === '"' && pd)
                        state = 0;
                    if (eAlias && findAlias)
                        alias += c;
                    else
                        str += c;
                    start = false;
                    break;
                case 2:
                    //quoted string
                    if (c === '\'' && ps)
                        state = 0;
                    if (eAlias && findAlias)
                        alias += c;
                    else
                        str += c;
                    start = false;
                    break;
                case 3:
                    //quoted string so keep intact
                    if (c === '"' && pd) {
                        arg += c;
                        state = 4;
                        start = false;
                    }
                    //quoted string so keep int
                    else if (c === '\'' && ps) {
                        arg += c;
                        state = 5;
                        start = false;
                    }
                    //end of alias at end of text, new line, or command stack if enabled
                    else if (idx === tl - 1 || c === '\n' || (stacking && c === stackingChar)) {
                        //save any arg that was found
                        if (arg.length > 0)
                            args.push(arg);
                        al = AliasesCached.length;
                        for (a = 0; a < al; a++) {
                            str = this.executeScript(this.ExecuteAlias(AliasesCached[a], args));
                            if (str !== null) out += str;
                            str = "";
                            if (!a.multi) break;
                        }
                        alias = "";
                        state = 0;
                        AliasesCached = null;
                        start = true;
                    }
                    //space so new argument
                    else if (c === ' ') {
                        args.push(arg);
                        arg = "";
                        start = false;
                    }
                    else {
                        arg += c;
                        start = false;
                    }
                    break;
                case 4: //quoted alias argument
                    if (c === '"')
                        state = 3;
                    arg += c;
                    start = false;
                    break;
                case 5: //quoted alias argument
                    if (c === '\'')
                        state = 3;
                    arg += c;
                    start = false;
                    break;
                case 6: //path found
                    if (c === '\n' || (stacking && c === stackingChar)) {
                        state = 0;
                        str = this.ProcessPath(str);
                        if (str !== null) out += str;
                        str = "";
                        start = true;
                    }
                    else if (idx === 1 && c === spChar) {
                        state = 0;
                        idx--;
                        start = false;
                    }
                    else {
                        str += c;
                        start = false;
                    }
                    break;
                default:
                    if (ePaths && start && c === spChar) {
                        state = 6;
                        start = false;
                    }
                    else if (c === '"' && pd) {
                        if (eAlias && findAlias)
                            alias += c;
                        else
                            str += c;
                        state = 1;
                        start = false;
                    }
                    else if (c === '\'' && ps) {
                        if (eAlias && findAlias)
                            alias += c;
                        else
                            str += c;
                        state = 2;
                        start = false;
                    }
                    //if looking for an alias and a space check
                    else if (eAlias && findAlias && c == ' ') {
                        AliasesCached = FilterArrayByKeyValue(aliases, "pattern", alias);
                        //are aliases enabled and does it match an alias?
                        if (AliasesCached.length > 0) {
                            //move to alias parsing
                            state = 3;
                            //init args
                            args.length = 0;
                            arg = "";
                            args.push(alias);
                        }
                        else //else not an alias so normal space
                        {
                            str += alias + ' ';
                            alias = "";
                            AliasesCached = null;
                        }
                        //no longer look for an alias
                        findAlias = false;
                        start = false;
                    }
                    else if (c === '\n' || (stacking && c === stackingChar)) {
                        if (eAlias && findAlias && alias.length > 0) {
                            AliasesCached = FilterArrayByKeyValue(aliases, "pattern", alias);
                            //are aliases enabled and does it match an alias?
                            if (AliasesCached.length > 0) {
                                args.push(alias);
                                //move to alias parsing
                                al = AliasesCached.length;
                                for (a = 0; a < al; a++) {
                                    str = this.executeScript(this.ExecuteAlias(AliasesCached[a], args));
                                    if (str !== null) out += str;
                                    if (!a.multi) break;
                                }
                                str = "";
                                //init args
                                args.length = 0;
                                arg = "";
                            }
                            else //else not an alias so normal space
                            {
                                str = this.executeScript(this.ExecuteTriggers(1, alias, false, true));
                                if (str !== null) out += str + "\n";
                                str = "";
                                AliasesCached = null;
                            }
                            //no longer look for an alias
                        }
                        else {
                            str = this.executeScript(this.ExecuteTriggers(1, str, false, true));
                            if (str !== null) out += str + "\n";
                            str = "";
                        }
                        alias = "";
                        //new line so need to check for aliases again
                        findAlias = true;
                        start = true;
                    }
                    else if (eAlias && findAlias) {
                        alias += c;
                        start = false;
                    }
                    else {
                        str += c;
                        start = false;
                    }
                    break;
            }
        }
        if (alias.length > 0 && eAlias && findAlias) {
            if (str.length > 0)
                alias += str;
            AliasesCached = FilterArrayByKeyValue(aliases, "pattern", alias);
            //are aliases enabled and does it match an alias?
            if (AliasesCached.length > 0) {
                //move to alias parsing
                args.push(alias);
                al = AliasesCached.length;
                for (a = 0; a < al; a++) {
                    str = this.executeScript(this.ExecuteAlias(AliasesCached[a], args));
                    if (str !== null) out += str;
                    else if (out.length === 0) return null;
                    if (!a.multi) break;
                }
            }
            else //else not an alias so normal space
            {
                str = this.executeScript(this.ExecuteTriggers(1, alias, false, true));
                if (str !== null) out += str;
                else if (out.length === 0) return null;
            }
            AliasesCached = null;
        }
        else if (alias.length > 0) {
            if (str.length > 0)
                alias += str;
            str = this.executeScript(this.ExecuteTriggers(1, alias, false, true));
            if (str !== null) out += str;
            else if (out.length === 0) return null;
        }
        else if (str.length > 0) {
            str = this.executeScript(this.ExecuteTriggers(1, str, false, true));
            if (str !== null) out += str;
            else if (out.length === 0) return null;
        }

        args.length = 0;
        args = null;
        arg = null;
        alias = null;
        return out;
    }

    ParseString(text: string, args, named, append?: boolean) {
        if (text == null) return "";
        var tl = text.length;
        if (tl === 0)
            return "";
        var str: string = "";
        var state = 0;
        var arg: any = "";
        var _used = 0;
        var _neg: boolean = false;
        var idx: number = 0, c: string;

        if (append == null)
            append = true;

        for (; idx < tl; idx++) {
            c = text.charAt(idx);
            switch (state) {
                case 1:
                    switch (c) {
                        case "%":
                            str += "%";
                            state = 0;
                            break;
                        case "*":
                            str += args.slice(1).join(" ");
                            state = 0;
                            _used = args.length;
                            break;
                        case "-":
                            _neg = true;
                            break;
                        case "0":
                        case "1":
                        case "2":
                        case "3":
                        case "4":
                        case "5":
                        case "6":
                        case "7":
                        case "8":
                        case "9":
                            arg += c;
                            break;
                        default:
                            if (arg.length > 0) {
                                arg = parseInt(arg, 10);
                                if (_neg && arg < args.length)
                                    str += args.slice(arg).join(" ");
                                else if (arg < args.length)
                                    str += args[arg];
                                if (_neg)
                                    _used = args.length;
                                else if (arg > _used)
                                    _used = arg;
                            }
                            else
                                str += "%" + c;
                            state = 0;
                            break;
                    }
                    break;
                case 2:
                    if (c.match(/[^a-zA-Z_$]/g)) {
                        state = 0;
                        str += "$" + c;
                        break;
                    }
                    else {
                        arg = c;
                        state = 3;
                    }
                    break;
                case 3:
                    if (c.match(/[^a-zA-Z0-9_]/g)) {
                        if (named[arg])
                            str += named[arg];
                        idx--;
                        state = 0;
                        break;
                    }
                    else
                        arg += c;
                    break;
                default:
                    if (c === "$") {
                        state = 2;
                        arg = "";
                    }
                    else if (c === "%") {
                        state = 1;
                        arg = "";
                        _neg = false;
                    }
                    else
                        str += c;
                    break;
            }
        }
        if (state === 3 && arg.length > 0) {
            if (named[arg])
                str += named[arg];
        }
        else if (state === 1 && arg.length > 0) {
            arg = parseInt(arg, 10);
            if (arg < args.length)
                str += args[arg];
        }
        //ignore args[0] as 0 should be the "original text"
        if (args.length - 1 > 0 && append && _used + 1 < args.length) {
            var r = false;
            if (str.endsWith("\n")) {
                str = str.substring(0, str.length - 1);
                r = true;
            }
            if (!str.endsWith(" "))
                str += " ";
            if (_used < 1)
                str += args.slice(1).join(" ");
            else
                str += args.slice(_used + 1).join(" ");
            if (r) str += "\n";
        }
        return str;
    }

    GetNamedArguments(str: string, args, append?: boolean) {
        if (str == "*")
            return args;
        if (append == null) append = false;
        if (str === null || str.length === 0)
            return append ? args : [];
        var n = str.split(",");
        var nl = n.length;
        var al = args.length;
        //no values to process
        if (nl === 0)
            return append ? args : [];
        var named;

        if (append)
            named = args.slice();
        else
            named = [];
        for (var s = 0; s < nl; s++) {
            n[s] = $.trim(n[s]);
            if (n[s].length < 1) continue;
            if (!n[s].match(/[^a-zA-Z0-9_]/g)) continue;
            if (n[s].startsWith("$")) n[s] = n[s].substring(1);
            if (named[n[s]]) continue;
            named[n[s]] = (s + 1 < al) ? args[s + 1] : "";
        }
        return named;
    }

    ExecuteAlias(alias, args) {
        if (!alias.enabled) return;
        var ret;// = "";
        switch (alias.style) {
            case 1:
                ret = this.parseOutgoing(this.ParseString(alias.value, args, this.GetNamedArguments(alias.params, args), alias.append));
                break;
            case 2:
                /*jslint evil: true */
                var f = new Function("try { " + alias.value + "} catch (e) { if(this.options.showScriptErrors) this.error(e);}");
                ret = f.apply(this.client, this.GetNamedArguments(alias.params, args, alias.append));
                break;
            default:
                ret = alias.value;
                break;
        }
        if (ret === null)
            return null;
        ret = this.ExecuteTriggers(1, ret, false, true);
        if (ret.endsWith("\n"))
            return ret;
        return ret + "\n";
    }

    ProcessMacros(keycode, alt, ctrl, shift, meta) {
        //if(!this.client.options.enableMacros) return false;
        var macros = FilterArrayByKeyValue(this.client.macros, "key", keycode);
        var m = 0, ml = macros.length;
        for (; m < ml; m++) {
            if (!macros[m].enabled) continue;
            if (alt === ((macros[m].modifiers & MacroModifiers.Alt) != MacroModifiers.Alt)) continue;
            if (ctrl === ((macros[m].modifiers & MacroModifiers.Ctrl) != MacroModifiers.Ctrl)) continue;
            if (shift === ((macros[m].modifiers & MacroModifiers.Shift) != MacroModifiers.Shift)) continue;
            if (meta === ((macros[m].modifiers & MacroModifiers.Meta) != MacroModifiers.Meta)) continue;
            if (this.ExecuteMacro(macros[m]))
                return true;
        }
        return false;
    }

    ExecuteMacro(macro) {
        if (!macro.enabled) return false;
        var ret;// = "";
        switch (macro.style) {
            case 1:
                ret = this.parseOutgoing(macro.value);
                break;
            case 2:
                /*jslint evil: true */
                var f = new Function("try { " + macro.value + "} catch (e) { if(this.options.showScriptErrors) this.error(e);}");
                ret = f.apply(this.client);
                break;
            default:
                ret = macro.value;
                break;
        }
        if (ret == null)
            return true;
        if (macro.send) {
            if (!ret.endsWith("\n"))
                ret += "\n";
            if (macro.chain && this.client.commandInput.val().endsWith(" ")) {
                this.client.commandInput.val(this.client.commandInput.val() + ret);
                this.client.sendCommand();
                return true;
            }
            if (this.client.connected)
                this.client.send(ret);
            if (this.client.telnet.echo && this.client.options.commandEcho)
                this.client.echo(ret);
        }
        else if (macro.append)
            this.client.commandInput.val(this.client.commandInput.val() + ret);
        return true;
    }

    ProcessPath(str) {
        if (str.length === 0)
            return "";
        var pPaths: boolean = this.client.options.parseSpeedpaths;
        var out: string = "";

        var state = 0;
        var cmd: string = "";
        var num: string = "";
        var idx = 0, c: string, i: number, t, p;
        var tl: number = str.length;

        for (; idx < tl; idx++) {
            c = str.charAt(idx);
            i = str.charCodeAt(idx);
            switch (state) {
                case 1:
                    if (i > 47 && i < 58)
                        num += c;
                    else if (c === '\\')
                        state = 2;
                    else {
                        state = 0;
                        cmd = c;
                    }
                    break;
                case 2:
                    if (i > 47 && i < 58)
                        cmd += c;
                    else {
                        cmd += "\\";
                        idx--;
                    }
                    state = 0;
                    break;
                default:
                    if (i > 47 && i < 58) {
                        if (cmd.length > 0) {
                            if (num.length === 0)
                                t = 1;
                            else
                                t = parseInt(num, 10);
                            for (p = 0; p < t; p++) {
                                if (pPaths) {
                                    num = this.parseOutgoing(cmd);
                                    if (num && num.length > 0)
                                        out += num + "\n";
                                }
                                else
                                    out += cmd + "\n";
                            }
                            cmd = "";
                        }
                        state = 1;
                        num = c;
                    }
                    else if (c === '\\')
                        state = 2;
                    else
                        cmd += c;
                    break;
            }
        }

        if (cmd.length > 0) {
            if (num.length === 0)
                t = 1;
            else
                t = parseInt(num, 10);
            for (p = 0; p < t; p++) {
                if (pPaths) {
                    num = this.parseOutgoing(cmd);
                    if (num && num.length > 0)
                        out += num + "\n";
                }
                else
                    out += cmd + "\n";
            }
        }
        return out;
    }

    toggleScrollLock() {
        this.scrollLock = !this.scrollLock;
    };

    ExecuteTriggers(type, raw?, frag?: boolean, ret?: boolean) {
        if (raw == null) return raw;
        if (ret == null) ret = false;
        if (frag == null) frag = false;
        if (this._TriggerCache === null) {
            this._TriggerCache = $.grep(this.client.triggers, function (a) {
                return a.enabled;
            });
            this._TriggerCache.sort(SortArrayByPriority);
        }
        var t = 0, tl = this._TriggerCache.length;
        for (; t < tl; t++) {
            if (typeof this._TriggerCache[t].type != "undefined" && this._TriggerCache[t].type != type) continue;
            if (frag && !this._TriggerCache[t].triggerPrompt) continue;
            if (!frag && !this._TriggerCache[t].triggerNewline && (typeof this._TriggerCache[t].triggerNewline != "undefined"))
                continue;
            if (this._TriggerCache[t].verbatim) {
                if (raw != this._TriggerCache[t].pattern) continue;
                if (ret)
                    return this.ExecuteTrigger(this._TriggerCache[t], [raw], true, t);
                this.ExecuteTrigger(this._TriggerCache[t], [raw], false, t);
            }
            else {
                try {
                    var re = new RegExp(this._TriggerCache[t].pattern, 'g');
                    var res = re.exec(raw);
                    if (!res || !res.length) continue;
                    if (ret)
                        return this.ExecuteTrigger(this._TriggerCache[t], res, true, t);
                    this.ExecuteTrigger(this._TriggerCache[t], res, false, t);
                }
                catch (e) {
                    if (this.client.options.showScriptErrors)
                        this.client.error(e);
                    else
                        this.client.debug(e);
                }
            }
        }
        return raw;
    }

    ExecuteTrigger(trigger, args, r: boolean, idx) {
        if (r == null) r = false;
        if (!trigger.enabled) return "";
        var ret;// = "";
        switch (trigger.style) {
            case 1:
                ret = this.parseOutgoing(this.ParseString(trigger.value, args, [], false));
                break;
            case 2:
                if (!this._TriggerFunctionCache[idx])
                    /*jslint evil: true */
                    this._TriggerFunctionCache[idx] = new Function("try { " + trigger.value + "} catch (e) { if(this.options.showScriptErrors) this.error(e);}");
                ret = this._TriggerFunctionCache[idx].apply(this.client, args);
                break;
            default:
                ret = trigger.value;
                break;
        }
        if (ret === null || typeof ret == 'undefined')
            return null;
        if (r)
            return ret;
        if (!ret.endsWith("\n"))
            ret += "\n";
        if (this.client.connected)
            this.client.telnet.sendData(ret);
        if (this.client.telnet.echo && this.client.options.commandEcho) {
            var delay = function () {
                this.client.echo(ret);
            };
            setTimeout(delay, 1);
        }
    }

    clearTriggerCache() { this._TriggerCache = null; this._TriggerFunctionCache = {}; };



}