//cSpell:ignore triggerprompt, idletime, connecttime, soundinfo, musicinfo, playmusic, playm, playsound, stopmusic, stopm, stopsound
//cSpell:ignore stopallsound, stopa, showprompt, showp, sayprompt, sayp, echoprompt, echop, unalias, setsetting, getsetting, profilelist
//cSpell:ignore keycode
import EventEmitter = require('events');
import { clipboard } from 'electron';
import { MacroModifiers } from './profile';
import { getTimeSpan, FilterArrayByKeyValue, SortArrayByPriority } from './library';
import { Client } from './client';
import { Tests } from './test';
import { Alias, Trigger, Macro, Profile, TriggerType } from './profile';
import { NewLineType } from './types';
import { SettingList } from './settings';
const mathjs = require('mathjs-expression-parser');

const buzz = require('buzz');

function ProperCase(str) {
    return str.replace(/\w*\S*/g, (txt) => { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

export class Input extends EventEmitter {
    private _historyIdx: number = -1;
    private _commandHistory: string[];
    private _locked: number = 0;
    private _tests: Tests;
    private _TriggerCache: Trigger[] = null;
    private _TriggerFunctionCache = {};
    private _scrollLock: boolean = false;
    private _gag: number = 0;
    private _gagID: NodeJS.Timer = null;

    public client: Client = null;

    get scrollLock(): boolean {
        return this._scrollLock;
    }
    set scrollLock(locked: boolean) {
        if (locked !== this._scrollLock) {
            this._scrollLock = locked;
            this.emit('scroll-lock', this.scrollLock);
        }
    }

    constructor(client: Client) {
        super();
        if (!client)
            throw new Error('Invalid client!');
        this.client = client;
        window.repeatnum = 0;
        this._tests = new Tests(client);
        this._commandHistory = [];
        $(document).keydown((event) => {
            if (!this.isLocked && this.ProcessMacros(event.which, event.altKey, event.ctrlKey, event.shiftKey, event.metaKey)) {
                event.preventDefault();
                event.stopPropagation();
            }
            //toggle scroll lock
            else if (event.which === 145)
                this.toggleScrollLock();
        });

        this.client.on('parse-command', (data) => {
            if (this.client.options.parseCommands)
                data.value = this.parseOutgoing(data.value);
        });

        this.client.on('add-line', (data) => {
            this.ExecuteTriggers(TriggerType.Regular, data.line, data.fragment, false);
            if (this._gag > 0) {
                data.gagged = true;
                this._gag--;
            }
        });

        this.client.commandInput.keyup((event) => {
            if (event.which !== 27 && event.which !== 38 && event.which !== 40)
                this._historyIdx = this._commandHistory.length;
        });

        this.client.commandInput.keydown((event) => {
            switch (event.which) {
                case 27: //esc
                    client.commandInput.blur();
                    client.commandInput.val('');
                    client.commandInput.select();
                    this._historyIdx = this._commandHistory.length;
                    break;
                case 38: //up
                    if (this._historyIdx === this._commandHistory.length && this.client.commandInput.val().length > 0) {
                        this.AddCommandToHistory(this.client.commandInput.val());
                        if (this.client.commandInput.val() === this._commandHistory[this._historyIdx - 1])
                            this._historyIdx--;
                    }
                    this._historyIdx--;
                    if (this._historyIdx < 0)
                        this._historyIdx = 0;
                    if (this._commandHistory.length < 0) {
                        this._historyIdx = -1;
                        this.client.commandInput.val('');
                        this.client.commandInput.select();
                    }
                    else {
                        if (this._commandHistory.length > 0 && this._historyIdx < this._commandHistory.length && this._historyIdx >= 0)
                            this.client.commandInput.val(this._commandHistory[this._historyIdx]);
                        this.client.commandInput.select();
                    }
                    break;
                case 40: //down
                    if (this._historyIdx === this._commandHistory.length && this.client.commandInput.val().length > 0)
                        this.AddCommandToHistory(this.client.commandInput.val());
                    this._historyIdx++;
                    if (this._historyIdx >= this._commandHistory.length || this._commandHistory.length < 1) {
                        this._historyIdx = this._commandHistory.length;
                        this.client.commandInput.val('');
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
                                this.client.commandInput.val((i, val) => {
                                    return val + '\n';
                                });
                                return true;
                            }
                            break;
                        case NewLineType.CtrlAndShift:
                            if (event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey) {
                                this.client.commandInput.val((i, val) => {
                                    return val + '\n';
                                });
                                return true;
                            }
                            break;
                        case NewLineType.CtrlOrShift:
                            if ((event.ctrlKey || event.shiftKey) && !event.metaKey && !event.altKey) {
                                this.client.commandInput.val((i, val) => {
                                    return val + '\n';
                                });
                                return true;
                            }
                            break;
                        case NewLineType.Shift:
                            if ((event.ctrlKey && event.shiftKey) && !event.metaKey && !event.altKey) {
                                this.client.commandInput.val((i, val) => {
                                    return val + '\n';
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

    public addLock() {
        this._locked++;
    }

    public removeLock() {
        this._locked--;
    }

    public AddCommandToHistory(cmd: string) {
        if ((this._commandHistory.length < 1 || this._commandHistory[this._commandHistory.length - 1] !== cmd) && cmd.length > 0) {
            if (this._commandHistory.length >= this.client.options.commandHistorySize)
                this._commandHistory.shift();
            this._commandHistory.push(cmd);
        }
    }

    public executeScript(txt: string) {
        if (txt == null)
            return txt;
        const tTxt: string = txt.trim();
        if (this._tests.TestFunctions[tTxt]) {
            if (this._tests.TestFunctions[tTxt]) {
                this._tests.TestFunctions[tTxt].apply(this._tests, []);
                return null;
            }
        }

        let state: number = 0;
        let idx: number = 0;
        let c: string;
        const tl: number = txt.length;
        let fun: string = '';
        let args = [];
        let arg: string = '';
        let raw: string;
        const pd: boolean = this.client.options.parseDoubleQuotes;
        const ps: boolean = this.client.options.parseSingleQuotes;

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
                        arg = '';
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
                    //if (c === '\\')
                    //state = 5;
                    //else {
                    arg += c;
                    raw += c;
                    //}
                    break;
                case 4:
                    if (c === '\'')
                        state = 2;
                    //if (c === '\\')
                    //state = 6;
                    //else {
                    arg += c;
                    raw += c;
                    //}
                    break;
                /*
            case 5:
                if (c === '"') {
                    arg += c;
                    raw += c;
                }
                else {
                    arg += '\\';
                    raw += '\\';
                    idx--;
                }
                state = 3;
                break;
            case 6:
                if (c === '\'') {
                    arg += c;
                    raw += c;
                }
                else {
                    arg += '\\';
                    raw += '\\';
                    idx--;
                }
                state = 4;
                break;
                */
                default:
                    if (idx === 0 && c === '#') {
                        state = 1;
                        fun = '';
                        args = [];
                        arg = '';
                        raw = c;
                    }
                    else
                        return txt;
                    break;
            }
        }
        if (fun.length > 0) {
            if (state === 3)
                arg += '"';
            else if (state === 4)
                arg += '\'';
            if (arg.endsWith('\n'))
                arg = arg.substring(0, args.length - 1);
            if (arg.length > 0) args.push(arg);
            return this.executeFunction(fun, args, raw);
        }
        return txt;
    }

    public executeFunction(fun: string, args, raw: string) {
        let n;
        let f = false;
        let items;
        let al;
        let i;
        let tmp;
        switch (fun.toLowerCase()) {
            case 'ungag':
            case 'ung':
                if (args.length > 0)
                    throw new Error('Invalid syntax use \x1b[4m#ung\x1b[0;-11;-12mag number or \x1b[4m#ung\x1b[0;-11;-12mag');
                if (this._gagID)
                    clearTimeout(this._gagID);
                this._gag = 0;
                this._gagID = null;
                return null;
            case 'gag':
            case 'ga':
                if (args.length === 0) {
                    if (this._gagID)
                        clearTimeout(this._gagID);
                    this._gagID = setTimeout(() => {
                        this.client.display.removeLine(this.client.display.lines.length - 1);
                        this._gagID = null;
                    }, 0);
                    this._gag = 0;
                    return null;
                }
                else if (args.length > 1)
                    throw new Error('Invalid syntax use \x1b[4m#ga\x1b[0;-11;-12mg number or \x1b[4m#ga\x1b[0;-11;-12mg');
                i = parseInt(args[0], 10);
                if (isNaN(i))
                    throw new Error('Invalid number \'' + args[0] + '\'');
                if (i >= 0) {
                    if (this._gagID)
                        clearTimeout(this._gagID);
                    this._gagID = setTimeout(() => {
                        this.client.display.removeLine(this.client.display.lines.length - 1);
                        this._gag = i - 1;
                        this._gagID = null;
                    }, 0);
                    this._gag = 0;
                }
                else {
                    if (this._gagID)
                        clearTimeout(this._gagID);
                    this._gagID = setTimeout(() => {
                        i *= -1;
                        if (i > this.client.display.lines.length)
                            i = this.client.display.lines.length;
                        this.client.display.removeLines(this.client.display.lines.length - i, i);
                        this._gagID = null;
                        this._gag = 0;
                    }, 0);
                    this._gag = 0;
                }
                return null;
            case 'wait':
            case 'wa':
                if (args.length === 0 || args.length > 1)
                    throw new Error('Invalid syntax use \x1b[4m#wa\x1b[0;-11;-12mit number');
                i = parseInt(args[0], 10);
                if (isNaN(i))
                    throw new Error('Invalid number \'' + args[0] + '\'');
                if (i < 1)
                    throw new Error('Must be greater then zero');
                return i;
            case 'showclient':
            case 'showcl':
                this.client.show();
                return null;
            case 'hideclient':
            case 'hidecl':
                this.client.hide();
                return null;
            case 'toggleclient':
            case 'togglecl':
                this.client.toggle();
                return null;
            case 'raiseevent':
            case 'raise':
                if (this.client.options.parseDoubleQuotes)
                    args.map((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.options.parseSingleQuotes)
                    args.map((a) => {
                        return a.replace(/^\'(.*)\'$/g, (v, e, w) => {
                            return e.replace(/\\\'/g, '\'');
                        });
                    });
                if (args.length === 0)
                    throw new Error('Invalid syntax use #\x1b[4mraise\x1b[0;-11;-12mevent name or #\x1b[4mraise\x1b[0;-11;-12mevent name arguments');
                else if (args.length === 1)
                    this.client.raise(args[0]);
                else
                    this.client.raise(args[0], args.slice(1));
                return null;
            case 'raisedelayed':
            case 'raisede':
                if (args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m#raisede\x1b[0;-11;-12mlayed milliseconds name or \x1b[4m#raisede\x1b[0;-11;-12mlayed milliseconds name arguments');
                i = parseInt(args[0], 10);
                if (isNaN(i))
                    throw new Error('Invalid number \'' + args[0] + '\'');
                if (i < 1)
                    throw new Error('Must be greater then zero');
                args.shift();
                if (this.client.options.parseDoubleQuotes)
                    args.map((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.options.parseSingleQuotes)
                    args.map((a) => {
                        return a.replace(/^\'(.*)\'$/g, (v, e, w) => {
                            return e.replace(/\\\'/g, '\'');
                        });
                    });

                if (args.length === 1)
                    this.client.raise(args[0], 0, i);
                else
                    this.client.raise(args[0], args.slice(1), i);
                return null;
            case 'notify':
            case 'not':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#not\x1b[0;-11;-12mify \'title\' message');
                else {
                    if (this.client.options.parseDoubleQuotes)
                        args[0] = args[0].replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    if (this.client.options.parseSingleQuotes)
                        args[0] = args[0].replace(/^\'(.*)\'$/g, (v, e, w) => {
                            return e.replace(/\\\'/g, '"');
                        });
                    if (args.length === 1)
                        this.client.notify(args[0], null);
                    else
                        this.client.notify(args[0], args.slice(1).join(' '));
                }
                return null;
            case 'idle':
            case 'idletime':
                if (!this.client.lastSendTime)
                    this.client.echo('Not connected', -7, -8, true, true);
                else
                    this.client.echo('You have been idle: ' + getTimeSpan(Date.now() - this.client.lastSendTime), -7, -8, true, true);
                return null;
            case 'connect':
            case 'connecttime':
                if (!this.client.connectTime)
                    this.client.echo('Not connected', -7, -8, true, true);
                else
                    this.client.echo('You have been connected: ' + getTimeSpan(Date.now() - this.client.connectTime), -7, -8, true, true);
                return null;
            case 'beep':
                this.client.beep();
                return null;
            case 'version':
            case 've':
                this.client.echo(this.client.telnet.terminal + ' v' + this.client.version, -7, -8, true, true);
                return null;
            case 'soundinfo':
                if (this.client.MSP.SoundState.playing) {
                    this.client.echo('Playing Sound - ' + this.client.MSP.SoundState.file + ' - ' + buzz.toTimer(this.client.MSP.SoundState.sound.getTime()) + '/' + buzz.toTimer(this.client.MSP.SoundState.sound.getDuration()), -7, -8, true, true);
                }
                else
                    this.client.echo('No sound currently playing.', -7, -8, true, true);
                return null;
            case 'musicinfo':
                if (this.client.MSP.MusicState.playing)
                    this.client.echo('Playing Music - ' + this.client.MSP.MusicState.file + ' -  ' + buzz.toTimer(this.client.MSP.MusicState.sound.getTime()) + '/' + buzz.toTimer(this.client.MSP.MusicState.sound.getDuration()), -7, -8, true, true);
                else
                    this.client.echo('No music currently playing.', -7, -8, true, true);
                return null;
            case 'playmusic':
            case 'playm':
                args = args.join(' ');
                tmp = { off: false, file: '', url: '', volume: 100, repeat: 1, priority: 50, type: '', continue: true };
                i = args.lastIndexOf('/');
                if (i === -1)
                    tmp.file = args;
                else {
                    tmp.file = args.substring(i + 1);
                    tmp.url = args.substring(0, i + 1);
                }
                this.client.MSP.music(tmp);
                return null;
            case 'playsound':
            case 'plays':
                args = args.join(' ');
                tmp = { off: false, file: '', url: '', volume: 100, repeat: 1, priority: 50, type: '', continue: true };
                i = args.lastIndexOf('/');
                if (i === -1)
                    tmp.file = args;
                else {
                    tmp.file = args.substring(i + 1);
                    tmp.url = args.substring(0, i + 1);
                }
                this.client.MSP.sound(tmp);
                return null;
            case 'stopmusic':
            case 'stopm':
                this.client.MSP.MusicState.close();
                return null;
            case 'stopsound':
            case 'stops':
                this.client.MSP.SoundState.close();
                return null;
            case 'stopallsound':
            case 'stopa':
                this.client.MSP.MusicState.close();
                this.client.MSP.SoundState.close();
                return null;
            case 'showprompt':
            case 'showp':
                args = args.join(' ');
                this.client.telnet.receivedData(args);
                this.client.telnet.prompt = true;
                return null;
            case 'show':
            case 'sh':
                args = args.join(' ') + '\n';
                this.client.telnet.receivedData(args);
                return null;
            case 'sayprompt':
            case 'sayp':
            case 'echoprompt':
            case 'echop':
                args = args.join(' ');
                this.client.print('\x1b[-7;-8m' + args + '\x1b[0m', false);
                return null;
            case 'say':
            case 'sa':
            case 'echo':
            case 'ec':
                args = args.join(' ');
                if (this.client.telnet.prompt)
                    this.client.print('\n\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                else
                    this.client.print('\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                this.client.telnet.prompt = false;
                return null;
            case 'alias':
            case 'al':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#al\x1b[0;-11;-12mias name value');
                else if (args.length === 1)
                    throw new Error('Must supply an alias value');
                else {
                    items = this.client.activeProfile.aliases;
                    n = args[0];
                    args = args.slice(1).join(' ');
                    if (/^"(.*)"$/.exec(args) !== null || /^'(.*)'$/.exec(args) !== null)
                        args = args.substring(1, args.length - 1);
                    if (/^\d+$/.exec(n)) {
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            throw new Error('Alias index must be >= 0 and < ' + items.length);
                        else {
                            items[n].value = args;
                            this.client.echo('Alias \'' + items[n].pattern + '\' updated.', -7, -8, true, true);
                            this.client.activeProfile.aliases = items;
                            this.client.saveProfile(this.client.activeProfile.name);
                        }
                    }
                    else {
                        if (/^"(.*)"$/.exec(n) !== null || /^'(.*)'$/.exec(n) !== null)
                            n = n.substring(1, n.length - 1);
                        for (i = 0, al = items.length; i < al; i++) {
                            if (items[i]['pattern'] === n) {
                                items[i].value = args;
                                this.client.echo('Alias \'' + n + '\' updated.', -7, -8, true, true);
                                f = true;
                                break;
                            }
                        }
                        if (!f) {
                            tmp = new Alias(n, args);
                            items.push(tmp);
                            this.emit('item-added', 'alias', this.client.activeProfile.name, tmp);
                            this.client.echo('Alias \'' + n + '\' added.', -7, -8, true, true);
                        }
                        this.client.activeProfile.aliases = items;
                        this.client.saveProfile(this.client.activeProfile.name);
                    }
                }
                return null;
            case 'unalias':
            case 'una':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#una\x1b[0;-11;-12mlias name');
                else {
                    items = this.client.activeProfile.aliases;
                    n = args.join(' ');
                    if (/^\d+$/.exec(n)) {
                        tmp = n;
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            throw new Error('Alias index must be >= 0 and < ' + items.length);
                        else
                            f = true;
                    }
                    else {
                        if (/^"(.*)"$/.exec(n) !== null || /^'(.*)'$/.exec(n) !== null)
                            n = n.substring(1, n.length - 1);
                        tmp = n;
                        for (i = 0, al = items.length; i < al; i++) {
                            if (items[i]['pattern'] === n) {
                                n = i;
                                f = true;
                                break;
                            }
                        }
                    }
                    if (!f)
                        this.client.echo('Alias \'' + tmp + '\' not found.', -7, -8, true, true);
                    else {
                        this.client.echo('Alias \'' + items[n].pattern + '\' removed.', -7, -8, true, true);
                        items.splice(n, 1);
                        this.emit('item-removed', 'alias', this.client.activeProfile.name, n);
                        this.client.activeProfile.aliases = items;
                        this.client.saveProfile(this.client.activeProfile.name);
                    }
                }
                return null;
            case 'setsetting':
            case 'sets':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#sets\x1b[0;-11;-12metting name value');
                else if (args.length === 1)
                    throw new Error('Must supply a setsetting value');
                else {
                    n = args[0];
                    args = args.slice(1).join(' ');
                    if (/^"(.*)"$/.exec(args) !== null || /^'(.*)'$/.exec(args) !== null)
                        args = args.substring(1, args.length - 1);
                    if (/^\d+$/.exec(n)) {
                        tmp = n;
                        n = parseInt(n, 10);
                        if (n < 0 || n >= SettingList.length)
                            throw new Error('Setting index must be >= 0 and < ' + SettingList.length);
                        f = true;
                    }
                    else {
                        if (/^"(.*)"$/.exec(n) !== null || /^'(.*)'$/.exec(n) !== null)
                            n = n.substring(1, n.length - 1);
                        n = n.toLowerCase();
                        for (i = 0, al = SettingList.length; i < al; i++) {
                            if (SettingList[i][0].toLowerCase() === n) {
                                n = i;
                                f = true;
                                break;
                            }
                        }
                    }
                    if (!f)
                        throw new Error('Unknown setting \'' + tmp + '\'');
                    else {
                        switch (SettingList[n][2]) {
                            case 0:
                                if (SettingList[n][4] > 0 && args.length > SettingList[n][4])
                                    throw new Error('String can not be longer then ' + SettingList[n][4] + ' characters');
                                else {
                                    this.client.setOption(SettingList[n][1] || SettingList[n][0], args);
                                    this.client.echo('Setting \'' + SettingList[n][0] + '\' set to \'' + args + '\'.', -7, -8, true, true);
                                    this.client.loadOptions();
                                }
                                break;
                            case 1:
                            case 3:
                                switch (args.toLowerCase()) {
                                    case 'true':
                                    case '1':
                                    case 'yes':
                                        this.client.setOption(SettingList[n][1] || SettingList[n][0], true);
                                        this.client.echo('Setting \'' + SettingList[n][0] + '\' set to true.', -7, -8, true, true);
                                        this.client.loadOptions();
                                        break;
                                    case 'no':
                                    case 'false':
                                    case '0':
                                        this.client.setOption(SettingList[n][1] || SettingList[n][0], false);
                                        this.client.echo('Setting \'' + SettingList[n][0] + '\' set to false.', -7, -8, true, true);
                                        this.client.loadOptions();
                                        break;
                                    case 'toggle':
                                        args = this.client.getOption(SettingList[n][1] || SettingList[n][0]) ? false : true;
                                        this.client.setOption(SettingList[n][1] || SettingList[n][0], args);
                                        this.client.echo('Setting \'' + SettingList[n][0] + '\' set to ' + args + '.', -7, -8, true, true);
                                        this.client.loadOptions();
                                        break;
                                    default:
                                        throw new Error('Invalid value, must be true or false');
                                }
                                break;
                            case 2:
                                i = parseInt(args, 10);
                                if (isNaN(i))
                                    throw new Error('Invalid number \'' + args + '\'');
                                else {
                                    this.client.setOption(SettingList[n][1] || SettingList[n][0], i);
                                    this.client.echo('Setting \'' + SettingList[n][0] + '\' set to \'' + i + '\'.', -7, -8, true, true);
                                    this.client.loadOptions();
                                }
                                break;
                            case 4:
                            case 5:
                                throw new Error('Unsupported setting \'' + n + '\'');
                        }
                    }
                }
                return null;
            case 'getsetting':
            case 'gets':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#gets\x1b[0;-11;-12metting name');
                else {
                    n = args.join(' ');
                    if (/^\d+$/.exec(n)) {
                        n = parseInt(n, 10);
                        if (n < 0 || n >= SettingList.length)
                            throw new Error('Setting index must be >= 0 and < ' + SettingList.length);
                        else
                            f = true;
                    }
                    else {
                        if (/^"(.*)"$/.exec(n) !== null || /^'(.*)'$/.exec(n) !== null)
                            n = n.substring(1, n.length - 1);
                        tmp = n;
                        n = n.toLowerCase();
                        if (n !== 'all') {
                            for (i = 0, al = SettingList.length; i < al; i++) {
                                if (SettingList[i][0].toLowerCase() === n) {
                                    n = i;
                                    f = true;
                                    break;
                                }
                            }
                        }
                        if (n === 'all') {
                            tmp = 'Current settings:\n';
                            //this.client.echo("Current settings:", -7, -8, true, true);
                            for (i = 0, al = SettingList.length; i < al; i++) {
                                switch (SettingList[i][2]) {
                                    case 0:
                                    case 2:
                                        //this.client.echo("    "+_SettingList[i][0]+": "+getSetting(_SettingList[i][0]), -7, -8, true, true);
                                        tmp += '    ' + SettingList[i][0] + ': ' + this.client.getOption(SettingList[n][1] || SettingList[n][0]) + '\n';
                                        break;
                                    case 1:
                                    case 3:
                                        if (this.client.getOption(SettingList[n][1] || SettingList[n][0]))
                                            tmp += '    ' + SettingList[i][0] + ': true\n';
                                        //this.client.echo("    "+_SettingList[i][0]+": true", -7, -8, true, true);
                                        else
                                            tmp += '    ' + SettingList[i][0] + ': false\n';
                                        //this.client.echo("    "+_SettingList[i][0]+": false", -7, -8, true, true);
                                        break;
                                }
                            }
                            this.client.echo(tmp, -7, -8, true, true);
                        }
                        else if (!f)
                            throw new Error('Unknown setting \'' + n + '\'');
                        else {
                            switch (SettingList[n][2]) {
                                case 0:
                                case 2:
                                    this.client.echo('Setting \'' + SettingList[n][0] + '\' is \'' + this.client.getOption(SettingList[n][1] || SettingList[n][0]) + '\'', -7, -8, true, true);
                                    break;
                                case 1:
                                case 3:
                                    if (this.client.getOption(SettingList[n][1] || SettingList[n][0]))
                                        this.client.echo('Setting \'' + SettingList[n][0] + '\' is true', -7, -8, true, true);
                                    else
                                        this.client.echo('Setting \'' + SettingList[n][0] + '\' is false', -7, -8, true, true);
                                    break;
                            }
                        }
                    }
                }
                return null;
            case 'profilelist':
                i = 0;
                al = this.client.profiles.length;
                this.client.echo('\x1b[4mProfiles:\x1b[0m', -7, -8, true, true);
                for (; i < al; i++) {
                    if (this.client.profiles.items[this.client.profiles.items[i]].enabled)
                        this.client.echo('   ' + this.client.profiles.items[i] + ' is enabled', -7, -8, true, true);
                    else
                        this.client.echo('   ' + this.client.profiles.items[i] + ' is disabled', -7, -8, true, true);
                }
                return null;
            case 'profile':
            case 'pro':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#pro\x1b[0;-11;-12mfile name or \x1b[4m#pro\x1b[0;-11;-12mfile name enable/disable');
                else if (args.length === 1) {
                    if (!this.client.profiles.toggle(args[0])) {
                        if (!this.client.profiles.contains(args[0]))
                            throw new Error('Profile not found');
                        else
                            throw new Error(args[0] + ' can not be disabled as it is the only one enabled');
                    }
                    this.client.saveProfile(args[0]);
                    if (this.client.profiles[args[0]].enabled)
                        args = args[0] + ' is enabled';
                    else
                        args = args[0] + ' is disabled';
                }
                else {
                    if (!this.client.profiles[args[0]])
                        throw new Error('Profile not found');
                    if (!args[1])
                        throw new Error('Invalid syntax use \x1b[4m#pro\x1b[0;-11;-12mfile name or \x1b[4m#pro\x1b[0;-11;-12mfile name enable/disable');
                    switch (args[1].toLowerCase()) {
                        case 'enable':
                        case 'on':
                        case 'yes':
                            if (this.client.profiles[args[0]].enabled)
                                args = args[0] + ' is already enabled';
                            else {
                                if (!this.client.profiles.toggle(args[0])) {
                                    if (!this.client.profiles.contains(args[0]))
                                        throw new Error('Profile not found');
                                    args = args[0] + ' remains disabled';
                                }
                                else
                                    args = args[0] + ' is enabled';
                                this.client.saveProfile(args[0]);
                            }
                            break;
                        case 'disable':
                        case 'off':
                        case 'no':
                            if (!this.client.profiles[args[0]].enabled)
                                args = args[0] + ' is already disabled';
                            else {
                                if (!this.client.profiles.toggle(args[0])) {
                                    if (!this.client.profiles.contains(args[0]))
                                        throw new Error('Profile not found');
                                    else
                                        throw new Error(args[0] + ' can not be disabled as it is the only one enabled');
                                }
                                this.client.saveProfile(args[0]);
                                args = args[0] + ' is disabled';
                            }
                            break;
                        default:
                            throw new Error('Invalid syntax use \x1b[4m#pro\x1b[0;-11;-12mfile name or \x1b[4m#pro\x1b[0;-11;-12mfile name enable/disable');
                    }
                }
                if (this.client.telnet.prompt)
                    this.client.print('\n\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                else
                    this.client.print('\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                this.client.telnet.prompt = false;
                return null;
        }
        i = parseInt(fun, 10);
        if (!isNaN(i)) {
            if (i < 1)
                throw new Error('Number must be greater then 0.');
            if (args.length === 0)
                throw new Error('Invalid syntax use #nnn commands');
            args = args.join(' ');
            tmp = [];
            for (let r = 0; r < i; r++) {
                window.repeatnum = r;
                n = this.parseOutgoing(args);
                if (n != null && n.length > 0)
                    tmp.push(n);
            }
            window.repeatnum = 0;
            if (tmp.length > 0)
                return tmp.join('\n');
            return null;
        }
        const data = { name: fun, args: args, raw: raw, handled: false, return: null };
        this.client.emit('function', data);
        if (data.handled)
            return data.return;
        return data.raw;
    }

    public parseOutgoing(text: string, eAlias?: boolean, stacking?: boolean) {
        const tl = text.length;
        if (text == null || tl === 0)
            return text;
        let str: string = '';
        let alias: string = '';
        let AliasesCached;
        let state = 0;
        const aliases = this.client.aliases;
        const stackingChar: string = this.client.options.commandStackingChar;
        const spChar: string = this.client.options.speedpathsChar;
        const ePaths: boolean = this.client.options.enableSpeedpaths;
        let args = [];
        let arg: string = '';
        let findAlias: boolean = true;
        let out: string = '';
        let a;
        let c: string;
        let al: number;
        let idx: number = 0;
        let start: boolean = true;
        const pd: boolean = this.client.options.parseDoubleQuotes;
        const ps: boolean = this.client.options.parseSingleQuotes;

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
                            if (typeof str === 'number') {
                                this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                                if (out.length === 0) return null;
                                return out;
                            }
                            if (str !== null) out += str;
                            str = '';
                            if (!a.multi) break;
                        }
                        alias = '';
                        state = 0;
                        AliasesCached = null;
                        start = true;
                    }
                    //space so new argument
                    else if (c === ' ') {
                        args.push(arg);
                        arg = '';
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
                        str = '';
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
                    else if (eAlias && findAlias && c === ' ') {
                        AliasesCached = FilterArrayByKeyValue(aliases, 'pattern', alias);
                        //are aliases enabled and does it match an alias?
                        if (AliasesCached.length > 0) {
                            //move to alias parsing
                            state = 3;
                            //init args
                            args.length = 0;
                            arg = '';
                            args.push(alias);
                        }
                        else //else not an alias so normal space
                        {
                            str += alias + ' ';
                            alias = '';
                            AliasesCached = null;
                        }
                        //no longer look for an alias
                        findAlias = false;
                        start = false;
                    }
                    else if (c === '\n' || (stacking && c === stackingChar)) {
                        if (str.length > 0 && str[0] === '#') {
                            str = this.executeScript(this.ExecuteTriggers(TriggerType.CommandInputRegular, this.executeScript(str), false, true));
                            if (typeof str === 'number') {
                                this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                                if (out.length === 0) return null;
                                return out;
                            }
                            if (str !== null) out += str + '\n';
                            str = '';
                        }
                        else if (eAlias && findAlias && alias.length > 0) {
                            AliasesCached = FilterArrayByKeyValue(aliases, 'pattern', alias);
                            //are aliases enabled and does it match an alias?
                            if (AliasesCached.length > 0) {
                                args.push(alias);
                                //move to alias parsing
                                al = AliasesCached.length;
                                for (a = 0; a < al; a++) {
                                    str = this.executeScript(this.ExecuteAlias(AliasesCached[a], args));
                                    if (typeof str === 'number') {
                                        this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                                        if (out.length === 0) return null;
                                        return out;
                                    }
                                    if (str !== null) out += str;
                                    if (!a.multi) break;
                                }
                                str = '';
                                //init args
                                args.length = 0;
                                arg = '';
                            }
                            else //else not an alias so normal space
                            {
                                str = this.executeScript(this.ExecuteTriggers(TriggerType.CommandInputRegular, alias, false, true));
                                if (typeof str === 'number') {
                                    this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                                    if (out.length === 0) return null;
                                    return out;
                                }
                                if (str !== null) out += str + '\n';
                                str = '';
                                AliasesCached = null;
                            }
                            //no longer look for an alias
                        }
                        else {
                            str = this.executeScript(this.ExecuteTriggers(TriggerType.CommandInputRegular, str, false, true));
                            if (typeof str === 'number') {
                                this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                                if (out.length === 0) return null;
                                return out;
                            }
                            if (str !== null) out += str + '\n';
                            str = '';
                        }
                        alias = '';
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
        if (str.length > 0 && str[0] === '#') {
            str = this.executeScript(this.ExecuteTriggers(TriggerType.CommandInputRegular, this.executeScript(str), false, true));
            if (typeof str === 'number') {
                this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                if (out.length === 0) return null;
                return out;
            }
            if (str !== null) out += str;
            else if (out.length === 0) return null;
        }
        else if (alias.length > 0 && eAlias && findAlias) {
            if (str.length > 0)
                alias += str;
            AliasesCached = FilterArrayByKeyValue(aliases, 'pattern', alias);
            //are aliases enabled and does it match an alias?
            if (AliasesCached.length > 0) {
                //move to alias parsing
                args.push(alias);
                al = AliasesCached.length;
                for (a = 0; a < al; a++) {
                    str = this.executeScript(this.ExecuteAlias(AliasesCached[a], args));
                    if (typeof str === 'number') {
                        this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                        if (out.length === 0) return null;
                        return out;
                    }
                    if (str !== null) out += str;
                    else if (out.length === 0) return null;
                    if (!a.multi) break;
                }
            }
            else //else not an alias so normal space
            {
                str = this.executeScript(this.ExecuteTriggers(TriggerType.CommandInputRegular, alias, false, true));
                if (typeof str === 'number') {
                    this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                    if (out.length === 0) return null;
                    return out;
                }
                if (str !== null) out += str;
                else if (out.length === 0) return null;
            }
            AliasesCached = null;
        }
        else if (alias.length > 0) {
            if (str.length > 0)
                alias += str;
            str = this.executeScript(this.ExecuteTriggers(TriggerType.CommandInputRegular, alias, false, true));
            if (typeof str === 'number') {
                this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                if (out.length === 0) return null;
                return out;
            }
            if (str !== null) out += str;
            else if (out.length === 0) return null;
        }
        else if (str.length > 0) {
            str = this.executeScript(this.ExecuteTriggers(TriggerType.CommandInputRegular, str, false, true));
            if (typeof str === 'number') {
                this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                if (out.length === 0) return null;
                return out;
            }
            if (str !== null) out += str;
            else if (out.length === 0) return null;
        }

        args.length = 0;
        args = null;
        arg = null;
        alias = null;
        return out;
    }

    public parseVariable(text) {
        //@TODO re-code someday to be part of the parser engine instead of simple regex
        switch (text) {
            case 'cr':
                return '\n';
            case 'lf':
                return '\r';
            case 'crlf':
                return '\r\n';
            case 'copied':
                return clipboard.readText('selection') || '';
            case 'upper':
                return text.toUpperCase();
        }
        return null;
        /*
        text = text.replace(/(\%|\$)\{cr\}/g, '\n');
        text = text.replace(/(\%|\$)\{lf\}/g, '\r');
        text = text.replace(/(\%|\$)\{crlf\}/g, '\r\n');
        text = text.replace(/(\%|\$)\{copied\}/g, copied);
        text = text.replace(/(\%|\$)\{copied.lower\}/g, copied);
        text = text.replace(/(\%|\$)\{copied.upper\}/g, copied.toUpperCase());
        text = text.replace(/(\%|\$)\{copied.proper\}/g, ProperCase(copied));
        //text = text.replace(/(\%|\$)\{(repeatnum|i)\}/g, window.repeatnum);

        text = text.replace(/(\%|\$)\{(selected|selectedurl|selectedline|selectedword|selurl|selline|selword)\}/g, (v, e, w) => { return window['$' + w]; });
        text = text.replace(/(\%|\$)\{(selected|selectedurl|selectedline|selectedword|selurl|selline|selword).lower\}/g, (v, e, w) => { return window['$' + w].toLowerCase(); });
        text = text.replace(/(\%|\$)\{(selected|selectedurl|selectedline|selectedword|selurl|selline|selword).upper\}/g, (v, e, w) => { return window['$' + w].toUpperCase(); });
        text = text.replace(/(\%|\$)\{(selected|selectedurl|selectedline|selectedword|selurl|selline|selword).proper\}/g, (v, e, w) => { return ProperCase(window['$' + w]); });

        text = text.replace(/(\%|\$)\{lower\((.*)\)\}/g, (v, e, w) => { return w.toLowerCase(); });
        text = text.replace(/(\%|\$)\{upper\((.*)\)\}/g, (v, e, w) => { return w.toUpperCase(); });
        text = text.replace(/(\%|\$)\{proper\((.*)\)\}/g, (v, e, w) => { return ProperCase(w); });
*/
        /*
        if (this.client.options.allowEscape) {
            text = text.replace(/\%\\{/g, '%{');
            text = text.replace(/\$\\{/g, `\${`);
            text = text.replace(/\%\\\\/g, '%\\');
            text = text.replace(/\$\\\\/g, `\$\\`);
        }
        */
    }

    public ParseString(text: string, args?, named?, append?: boolean) {
        if (text == null) return '';
        const tl = text.length;
        if (tl === 0)
            return '';
        let str: string = '';
        let state = 0;
        let arg: any = '';
        let _used = 0;
        let _neg: boolean = false;
        let idx: number = 0;
        let c: string;
        const e = this.client.options.allowEscape;

        if (append == null)
            append = true;

        for (; idx < tl; idx++) {
            c = text.charAt(idx);
            switch (state) {
                case 1:
                    if (c === '{' && arg.length === 0) {
                        state = 4;
                        continue;
                    }
                    if (e && c === '\\' && arg.length === 0) {
                        state = 6;
                        continue;
                    }
                    switch (c) {
                        case '%':
                            str += '%';
                            state = 0;
                            break;
                        case '*':
                            if (args) {
                                str += args.slice(1).join(' ');
                                _used = args.length;
                            }
                            else
                                str += '%*';
                            state = 0;
                            break;
                        case '-':
                            _neg = true;
                            break;
                        case '0':
                        case '1':
                        case '2':
                        case '3':
                        case '4':
                        case '5':
                        case '6':
                        case '7':
                        case '8':
                        case '9':
                            arg += c;
                            break;
                        default:
                            if (args && arg.length > 0) {
                                arg = parseInt(arg, 10);
                                if (_neg && arg < args.length)
                                    str += args.slice(arg).join(' ');
                                else if (arg < args.length)
                                    str += args[arg];
                                if (_neg)
                                    _used = args.length;
                                else if (arg > _used)
                                    _used = arg;
                                idx--;
                            }
                            else {
                                str += '%';
                                idx -= arg.length || 1;
                            }
                            state = 0;
                            arg = '';
                            break;
                    }
                    break;
                case 2:
                    if (c === '{')
                        state = 5;
                    else if (e && c === '\\')
                        state = 7;
                    else if (!named || c.match(/[^a-zA-Z_$]/g)) {
                        state = 0;
                        str += '$' + c;
                    }
                    else {
                        arg = c;
                        state = 3;
                    }
                    break;
                case 3:
                    if (c.match(/[^a-zA-Z0-9_]/g)) {
                        if (named && named.hasOwnProperty(arg))
                            str += named[arg];
                        idx--;
                        state = 0;
                        arg = '';
                    }
                    else
                        arg += c;
                    break;
                case 4:
                    if (c === '}') {
                        if (arg === 'i')
                            str += window.repeatnum;
                        else if (arg === 'repeatnum')
                            str += window.repeatnum;
                        else if (args && arg === '*') {
                            str += args.slice(1).join(' ');
                            _used = args.length;
                        }
                        else if (named && named.hasOwnProperty(arg))
                            str += named[arg];
                        else {
                            if (args && !isNaN(arg)) {
                                arg = parseInt(arg, 10);
                                if (arg < 0) {
                                    str += args.slice(arg).join(' ');
                                    _used = args.length;
                                }
                                else {
                                    str += args[arg];
                                    if (arg > _used)
                                        _used = arg;
                                }
                            }
                            else {
                                c = this.parseVariable(arg);
                                if (c)
                                    str += c;
                                else if (this.client.options.allowEval) {
                                    if (named)
                                        str += '' + mathjs.eval(this.ParseString(arg, args, named, false), Object.assign({ i: window.repeatnum || 0, repeatnum: window.repeatnum || 0 }, named));
                                    else
                                        str += '' + mathjs.eval(this.ParseString(arg, args, named, false), { i: window.repeatnum || 0, repeatnum: window.repeatnum || 0 });
                                }
                                else {
                                    str += '%';
                                    idx = idx - arg.length - 2;
                                }
                            }
                        }
                        state = 0;
                        arg = '';
                    }
                    else
                        arg += c;
                    break;
                case 5:
                    if (c === '}') {
                        if (arg === 'i')
                            str += window.repeatnum;
                        else if (arg === 'repeatnum')
                            str += window.repeatnum;
                        else if (args && arg === '*') {
                            str += args.slice(1).join(' ');
                            _used = args.length;
                        }
                        else if (named && named.hasOwnProperty(arg))
                            str += named[arg];
                        else {
                            if (args && !isNaN(arg)) {
                                arg = parseInt(arg, 10);
                                if (arg < 0) {
                                    str += args.slice(arg).join(' ');
                                    _used = args.length;
                                }
                                else {
                                    str += args[arg];
                                    if (arg > _used)
                                        _used = arg;
                                }
                            }
                            else {
                                c = this.parseVariable(arg);
                                if (c)
                                    str += c;
                                else if (this.client.options.allowEval) {
                                    if (named)
                                        str += '' + mathjs.eval(this.ParseString(arg, args, named, false), Object.assign({ i: window.repeatnum || 0, repeatnum: window.repeatnum || 0 }, named));
                                    else
                                        str += '' + mathjs.eval(this.ParseString(arg, args, named, false), { i: window.repeatnum || 0, repeatnum: window.repeatnum || 0 });
                                }
                                else {
                                    str += '$';
                                    idx = idx - arg.length - 2;
                                }
                            }
                        }
                        state = 0;
                        arg = '';
                    }
                    else
                        arg += c;
                    break;
                case 6:
                    if (c === '{')
                        str += '%{';
                    else if (c === '\\')
                        str += '%\\';
                    else {
                        str += '%\\';
                        idx--;
                    }
                    state = 0;
                    break;
                case 7:
                    if (c === '{')
                        str += `\${`;
                    else if (c === '\\')
                        str += '$\\';
                    else {
                        str += '$\\';
                        idx--;
                    }
                    state = 0;
                    break;
                default:
                    if (c === '$') {
                        state = 2;
                        arg = '';
                    }
                    else if (c === '%') {
                        state = 1;
                        arg = '';
                        _neg = false;
                    }
                    else
                        str += c;
                    break;
            }
        }
        if (state === 3 && arg.length > 0) {
            if (named && named[arg])
                str += named[arg];
            else
                str += '%' + arg;
        }
        else if (state === 1 && arg.length > 0) {
            if (args) {
                arg = parseInt(arg, 10);
                if (_neg && arg < args.length)
                    str += args.slice(arg).join(' ');
                else if (arg < args.length)
                    str += args[arg];
                if (_neg)
                    _used = args.length;
                else if (arg > _used)
                    _used = arg;
            }
            else
                str += '%' + arg;
        }
        else if (state === 4) {
            str += '%{' + arg;
        }
        else if (arg.length > 0)
            str += arg;
        //ignore args[0] as 0 should be the "original text"
        if (args && append && args.length - 1 > 0 && _used + 1 < args.length) {
            let r = false;
            if (str.endsWith('\n')) {
                str = str.substring(0, str.length - 1);
                r = true;
            }
            if (!str.endsWith(' '))
                str += ' ';
            if (_used < 1)
                str += args.slice(1).join(' ');
            else
                str += args.slice(_used + 1).join(' ');
            if (r) str += '\n';
        }
        return str;
    }

    public GetNamedArguments(str: string, args, append?: boolean) {
        if (str === '*')
            return args;
        if (append == null) append = false;
        if (str == null || str.length === 0)
            return append ? args : [];
        const n = str.split(',');
        const nl = n.length;
        const al = args.length;
        //no values to process
        if (nl === 0)
            return append ? args : [];
        let named;

        if (append)
            named = args.slice();
        else
            named = [];
        for (let s = 0; s < nl; s++) {
            n[s] = $.trim(n[s]);
            if (n[s].length < 1) continue;
            if (!n[s].match(/[^a-zA-Z0-9_]/g)) continue;
            if (n[s].startsWith('$')) n[s] = n[s].substring(1);
            if (named[n[s]]) continue;
            named[n[s]] = (s + 1 < al) ? args[s + 1] : '';
        }
        return named;
    }

    public ExecuteAlias(alias, args) {
        if (!alias.enabled) return;
        let ret; // = '';
        switch (alias.style) {
            case 1:
                ret = this.parseOutgoing(this.ParseString(alias.value, args, this.GetNamedArguments(alias.params, args), alias.append));
                break;
            case 2:
                /*jslint evil: true */
                const f = new Function('try { ' + alias.value + '} catch (e) { if(this.options.showScriptErrors) this.error(e);}');
                ret = f.apply(this.client, this.GetNamedArguments(alias.params, args, alias.append));
                break;
            default:
                ret = alias.value;
                break;
        }
        if (ret == null || ret === undefined)
            return null;
        ret = this.ExecuteTriggers(TriggerType.CommandInputRegular, ret, false, true);
        if (ret == null || ret === undefined)
            return null;
        //Convert to string
        if (typeof ret !== 'string')
            ret = ret.toString();

        if (ret.endsWith('\n'))
            return ret;
        return ret + '\n';
    }

    public ProcessMacros(keycode, alt, ctrl, shift, meta) {
        //if(!this.client.options.enableMacros) return false;
        const macros = FilterArrayByKeyValue(this.client.macros, 'key', keycode);
        let m = 0;
        const ml = macros.length;
        for (; m < ml; m++) {
            if (!macros[m].enabled) continue;
            if (alt === ((macros[m].modifiers & MacroModifiers.Alt) !== MacroModifiers.Alt)) continue;
            if (ctrl === ((macros[m].modifiers & MacroModifiers.Ctrl) !== MacroModifiers.Ctrl)) continue;
            if (shift === ((macros[m].modifiers & MacroModifiers.Shift) !== MacroModifiers.Shift)) continue;
            if (meta === ((macros[m].modifiers & MacroModifiers.Meta) !== MacroModifiers.Meta)) continue;
            if (this.ExecuteMacro(macros[m]))
                return true;
        }
        return false;
    }

    public ExecuteMacro(macro) {
        if (!macro.enabled) return false;
        let ret; // = '';
        switch (macro.style) {
            case 1:
                ret = this.parseOutgoing(macro.value);
                break;
            case 2:
                /*jslint evil: true */
                const f = new Function('try { ' + macro.value + '} catch (e) { if(this.options.showScriptErrors) this.error(e);}');
                ret = f.apply(this.client);
                break;
            default:
                ret = macro.value;
                break;
        }
        if (ret == null || ret === undefined)
            return true;
        //Convert to string
        if (typeof ret !== 'string')
            ret = ret.toString();
        if (macro.send) {
            if (!ret.endsWith('\n'))
                ret += '\n';
            if (macro.chain && this.client.commandInput.val().endsWith(' ')) {
                this.client.commandInput.val(this.client.commandInput.val() + ret);
                this.client.sendCommand();
            }
            else
                this.client.send(ret, true);
        }
        else if (macro.append)
            this.client.commandInput.val(this.client.commandInput.val() + ret);
        return true;
    }

    public ProcessPath(str) {
        if (str.length === 0)
            return '';
        const pPaths: boolean = this.client.options.parseSpeedpaths;
        let out: string = '';

        let state = 0;
        let cmd: string = '';
        let num: string = '';
        let idx = 0;
        let c: string;
        let i: number;
        let t;
        let p;
        const tl: number = str.length;

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
                        cmd += '\\';
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
                                        out += num + '\n';
                                }
                                else
                                    out += cmd + '\n';
                            }
                            cmd = '';
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
                        out += num + '\n';
                }
                else
                    out += cmd + '\n';
            }
        }
        return out;
    }

    public toggleScrollLock() {
        this.scrollLock = !this.scrollLock;
    }

    public ExecuteTriggers(type: TriggerType, raw?, frag?: boolean, ret?: boolean) {
        if (raw == null) return raw;
        if (ret == null) ret = false;
        if (frag == null) frag = false;
        this.buildTriggerCache();
        let t = 0;
        const tl = this._TriggerCache.length;
        for (; t < tl; t++) {
            if (this._TriggerCache[t].type !== undefined && this._TriggerCache[t].type !== type) continue;
            if (frag && !this._TriggerCache[t].triggerPrompt) continue;
            if (!frag && !this._TriggerCache[t].triggerNewline && (this._TriggerCache[t].triggerNewline !== undefined))
                continue;
            if (this._TriggerCache[t].verbatim) {
                if (raw !== this._TriggerCache[t].pattern) continue;
                if (ret)
                    return this.ExecuteTrigger(this._TriggerCache[t], [raw], true, t);
                this.ExecuteTrigger(this._TriggerCache[t], [raw], false, t);
            }
            else {
                try {
                    const re = new RegExp(this._TriggerCache[t].pattern, 'g');
                    const res = re.exec(raw);
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
        return this.ParseString(raw, 0, 0, false);
    }

    public ExecuteTrigger(trigger, args, r: boolean, idx) {
        if (r == null) r = false;
        if (!trigger.enabled) return '';
        let ret; // = '';
        switch (trigger.style) {
            case 1:
                ret = this.parseOutgoing(this.ParseString(trigger.value, args, [], false));
                break;
            case 2:
                if (!this._TriggerFunctionCache[idx])
                    /*jslint evil: true */
                    this._TriggerFunctionCache[idx] = new Function('try { ' + trigger.value + '} catch (e) { if(this.options.showScriptErrors) this.error(e);}');
                ret = this._TriggerFunctionCache[idx].apply(this.client, args);
                break;
            default:
                ret = trigger.value;
                break;
        }
        if (ret == null || ret === undefined)
            return null;
        if (r)
            return ret;
        //Convert to string
        if (typeof ret !== 'string')
            ret = ret.toString();
        if (!ret.endsWith('\n'))
            ret += '\n';
        if (this.client.connected)
            this.client.telnet.sendData(ret);
        if (this.client.telnet.echo && this.client.options.commandEcho) {
            const delay = function () {
                this.client.echo(ret);
            };
            setTimeout(delay, 1);
        }
    }

    public clearTriggerCache() { this._TriggerCache = null; this._TriggerFunctionCache = {}; }

    public buildTriggerCache() {
        if (this._TriggerCache == null) {
            this._TriggerCache = $.grep(this.client.triggers, (a) => {
                return a.enabled;
            });
        }
    }

    public triggerEvent(event: string, args?) {
        this.buildTriggerCache();
        let t = 0;
        if (!args)
            args = [event];
        else if (!Array.isArray(args))
            args = [event, args];
        else
            args.unshift(event);
        const tl = this._TriggerCache.length;
        for (; t < tl; t++) {
            if (this._TriggerCache[t].type !== TriggerType.Event) continue;
            if (event !== this._TriggerCache[t].pattern) continue;
            this.ExecuteTrigger(this._TriggerCache[t], args, false, t);
        }
    }

    public executeWait(text, delay: number, eAlias?: boolean, stacking?: boolean) {
        if (!text || text.length === 0) return;
        if (delay < 0)
            delay = 0;
        setTimeout(() => {
            let ret = this.parseOutgoing(text, eAlias, stacking);
            if (ret == null || typeof ret === 'undefined' || ret.length === 0) return;
            if (!ret.endsWith('\n'))
                ret = ret + '\n';
            this.client.send(ret, true);
        }, delay);
    }

    public buildScript(str: string) {
        if (!str) return '';
        let lines;
        /*
        if (this.client.options.commandStacking && this.client.options.commandStackingChar && this.client.options.commandStackingChar.length > 0)
            lines = str.split(new RegExp('\n|' + this.client.options.commandStackingChar));
        else
            lines = str.split('\n');
        */
        if (this.client.options.commandStacking && this.client.options.commandStackingChar && this.client.options.commandStackingChar.length > 0)
            lines = str.splitQuote('\n' + this.client.options.commandStackingChar);
        else
            lines = str.splitQuote('\n');
        let l = 0;
        const ll = lines.length;
        const code = [];
        const b = [];
        for (; l < ll; l++) {
            if (lines[l].trim().startsWith('#wait ')) {
                code.push('setTimeout(()=> {');
                b.unshift(parseInt(lines[l].trim().substr(5), 10) || 0);
            }
            else {
                code.push('client.sendCommand(\'');
                code.push(lines[l]);
                code.push('\\n\');');
            }
        }
        const bl = b.length;
        for (l = 0; l < bl; l++) {
            code.push('}, ');
            code.push(b[l]);
            code.push(');');
        }
        return code.join('');
    }
}