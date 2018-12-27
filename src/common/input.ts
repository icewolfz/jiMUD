//spell-checker:ignore triggerprompt, idletime, connecttime, soundinfo, musicinfo, playmusic, playm, playsound, stopmusic, stopm, stopsound
//spell-checker:ignore stopallsound, stopa, showprompt, showp, sayprompt, sayp, echoprompt, echop, unalias, setsetting, getsetting, profilelist
//spell-checker:ignore keycode repeatnum chatp chatprompt untrigger unevent nocr timepattern ungag showclient showcl hideclient hidecl toggleclient
//spell-checker:ignore togglecl raiseevent raisedelayed raisede diceavg dicemin dicemax zdicedev dicedev zmud
import EventEmitter = require('events');
import { MacroModifiers } from './profile';
import { getTimeSpan, FilterArrayByKeyValue, SortItemArrayByPriority, clone, parseTemplate, isFileSync } from './library';
import { Client } from './client';
import { Tests } from './test';
import { Alias, Trigger, Button, Profile, TriggerType } from './profile';
import { NewLineType } from './types';
import { SettingList } from './settings';
const mathjs = require('mathjs-expression-parser');
const buzz = require('buzz');
const path = require('path');
const moment = require('moment');
const fs = require('fs');

function ProperCase(str) {
    return str.replace(/\w*\S*/g, (txt) => { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

function fudgeDice() {
    switch (~~(Math.random() * 6) + 1) {
        case 1:
        case 4:
            return -1;
        case 3:
        case 2:
            return 1;
    }
    return 0;
}

enum ParseState {
    none = 0,
    doubleQuoted = 1,
    singleQuoted = 2,
    aliasArguments = 3,
    aliasArgumentsDouble = 4,
    aliasArgumentsSingle = 5,
    path = 6,
    function = 7,
    paramsP = 8,
    paramsPBlock = 9,
    paramsPEscape = 10,
    paramsD = 11,
    paramsDBlock = 12,
    paramsDEscape = 13,
    paramsDNamed = 14,
    escape = 15,
    verbatim = 16
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
    private _stack = [];
    private _vStack = [];
    private _controllers = {};
    private _controllersCount = 0;
    private _gamepadCaches = null;
    private _lastSuspend = -1;

    public client: Client = null;

    get stack() {
        if (this._stack.length === 0)
            this._stack.push({ args: 0, named: 0, used: 0, append: false });
        return this._stack[this._stack.length - 1];
    }

    get vStack() {
        if (this._vStack.length === 0)
            return {};
        return this._vStack[this._vStack.length - 1];
    }

    public vStackPush(obj) {
        this._vStack.push(obj);
    }

    public vStackPop() {
        this._vStack.pop();
    }

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

        const dice: any = (args, math, scope) => {
            let res;
            let c;
            let sides;
            let mod;
            if (args.length === 1) {
                res = /(\d+)\s+d(F|f|%|\d+)([-|+|*|/]?\d+)?/g.exec(args[0].toString());
                if (!res || res.length < 3) throw new Error('Invalid dice');
                c = parseInt(res[1]);
                sides = res[2];
                if (res.length > 3 && args[2])
                    mod = mathjs.eval(res[3]);
            }
            else if (args.length > 1) {
                c = parseInt(args[0].toString());
                sides = args[1].toString().trim();
                if (sides !== 'F' && sides !== '%')
                    sides = args[1].compile().eval(scope);
                if (args.length > 2)
                    mod = args[2].compile().eval(scope);
            }
            else
                throw new Error('Invalid arguments to dice');
            let sum = 0;
            for (let i = 0; i < c; i++) {
                if (sides === 'F')
                    sum += fudgeDice();
                else if (sides === '%')
                    sum += ~~(Math.random() * 100) + 1;
                else
                    sum += ~~(Math.random() * sides) + 1;
            }
            if (sides === '%')
                sum /= 100;
            if (mod)
                return mathjs.eval(sum + mod);
            return sum;
        };

        dice.rawArgs = true;

        mathjs.import({
            dice: dice
        });

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

        this.client.on('options-loaded', () => {
            this.updatePads();
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
        //spell-checker:ignore gamepadconnected gamepaddisconnected
        window.addEventListener('gamepadconnected', (e) => {
            if (!this._gamepadCaches)
                this._gamepadCaches = [];
            this._controllers[e.gamepad.index] = { pad: e.gamepad, axes: clone(e.gamepad.axes), state: { axes: [], buttons: [] }, pState: { axes: [], buttons: [] } };
            this._controllersCount++;
            this.updatePads();
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            delete this._controllers[e.gamepad.index];
            this._controllersCount--;
        });

        const controllers = navigator.getGamepads();
        let ct = 0;
        const cl = controllers.length;
        for (; ct < cl; ct++) {
            if (!controllers[ct]) continue;
            this._controllers[controllers[ct].index] = { pad: controllers[ct], axes: clone(controllers[ct].axes), state: { axes: [], buttons: [] }, pState: { axes: [], buttons: [] } };
            this._controllersCount++;
        }
        this.updatePads();
    }

    private updatePads() {
        if (this._controllersCount === 0 || !this.client.options.gamepads)
            return;
        const controllers = navigator.getGamepads();
        let c = 0;
        const cl = controllers.length;
        if (!this._gamepadCaches && cl > 0)
            this._gamepadCaches = [];
        for (; c < cl; c++) {
            const controller = controllers[c];
            if (!controller) continue;
            const state = this._controllers[controller.index].state;
            const axes = this._controllers[controller.index].axes;
            const bl = controller.buttons.length;
            let i;
            let macros;
            if (!this._gamepadCaches[c])
                this._gamepadCaches[c] = FilterArrayByKeyValue(this.client.macros, 'gamepad', c + 1);
            macros = this._gamepadCaches[c];
            let m = 0;
            const ml = macros.length;
            if (ml === 0) continue;
            for (i = 0; i < bl; i++) {
                let val: any = controller.buttons[i];
                let pressed;
                if (typeof (val) === 'object') {
                    pressed = val.pressed;
                    val = val.value;
                }
                else
                    pressed = val >= 0.5;
                if (state.buttons[i]) {
                    if (state.buttons[i].pressed !== pressed) {
                        state.buttons[i].pressed = pressed;
                        if (!pressed) {
                            for (; m < ml; m++) {
                                if (!macros[m].enabled) continue;
                                if (macros[m].key !== i + 1) continue;
                                if (this.ExecuteMacro(macros[m])) {
                                    if (this._controllersCount > 0 || controllers.length > 0)
                                        requestAnimationFrame(() => { this.updatePads(); });
                                    return;
                                }
                            }
                        }
                    }
                }
                else {
                    state.buttons[i] = { pct: Math.round(val * 100), pressed: pressed };
                }
            }

            const al = controller.axes.length;
            let a = 0;
            for (i = 0; i < al; i++) {
                if (state.axes[i] !== controller.axes[i] && controller.axes[i] !== axes[i]) {
                    state.axes[i] = controller.axes[i];
                    if (state.axes[i] < -0.75) {
                        a = -(i + 1);
                    }
                    else if (state.axes[i] > 0.75) {
                        a = i + 1;
                    }
                }
                else if (state.axes[i] < -0.75) {
                    a = -(i + 1);
                }
                else if (state.axes[i] > 0.75) {
                    a = i + 1;
                }
                if (a !== 0)
                    for (; m < ml; m++) {
                        if (!macros[m].enabled) continue;
                        if (macros[m].gamepadAxes !== i + 1) continue;
                        if (this.ExecuteMacro(macros[m])) {
                            if (this._controllersCount > 0 || controllers.length > 0)
                                requestAnimationFrame(() => { this.updatePads(); });
                            return;
                        }
                    }
            }
        }
        if (this._controllersCount > 0 || controllers.length > 0)
            requestAnimationFrame(() => { this.updatePads(); });
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
        const tTxt: string = txt.trim().substr(1);
        if (this._tests.TestFunctions[tTxt.toLowerCase()]) {
            this._tests.TestFunctions[tTxt.toLowerCase()].apply(this._tests, []);
            return null;
        }

        let state: number = 0;
        let idx: number = 0;
        let c: string;
        const tl: number = txt.length;
        let fun: string = '';
        let args = [];
        let arg: string = '';
        let raw: string;
        let s = 0;
        const pd: boolean = this.client.options.parseDoubleQuotes;
        const ps: boolean = this.client.options.parseSingleQuotes;

        for (; idx < tl; idx++) {
            c = txt.charAt(idx);
            switch (state) {
                //find name
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
                //find arguments
                case 2:
                    if (c === '{') {
                        state = 7;
                        arg += c;
                    }
                    else if (c === ' ') {
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
                case 7:
                    arg += c;
                    if (c === '}') {
                        if (s === 0) {
                            state = 2;
                        }
                        else
                            s--;
                    }
                    else if (c === '{')
                        s++;
                    raw += c;
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
        let profile = null;
        let name = null;
        let item;
        let p;
        let reload;
        let trigger;
        switch (fun.toLowerCase()) {
            case 'testfile':
                args = this.parseOutgoing(args.join(' '), false);
                if (!args || args.length === 0)
                    throw new Error('Invalid syntax use #testfile file');
                if (!isFileSync(args))
                    throw new Error('Invalid file "' + args + '"');
                tmp = fs.readFileSync(args, 'utf-8');
                n = this.client.options.enableCommands;
                this.client.options.enableCommands = true;
                i = new Date().getTime();
                this.client.sendCommand(tmp);
                p = new Date().getTime();
                this.client.options.enableCommands = n;
                this.client.print(`Time: ${p - i}\n`, true);
                return null;
            case 'testspeedfile':
                args = this.parseOutgoing(args.join(' '), false);
                items = [];
                if (!args || args.length === 0)
                    throw new Error('Invalid syntax use #testspeedfile file');
                if (!isFileSync(args))
                    throw new Error('Invalid file "' + args + '"');
                tmp = fs.readFileSync(args, 'utf-8');
                n = this.client.options.enableCommands;
                this.client.options.enableCommands = true;
                let avg = 0;
                let max = 0;
                let min = 0;
                for (i = 0; i < 10; i++) {
                    const start = new Date().getTime();
                    this.client.sendCommand(tmp);
                    const end = new Date().getTime();
                    p = end - start;
                    avg += p;
                    if (p > max) max = p;
                    if (!min || p < min) min = p;
                    items.push(`${i} - ${p}`);
                }
                items.push(`Total - ${avg}`);
                items.push(`Average - ${avg / 10}`);
                items.push(`Min - ${min}`);
                items.push(`Max - ${max}`);
                this.client.print(items.join('\n') + '\n', true);
                this.client.options.enableCommands = n;
                return null;
            //spell-checker:ignore chatprompt chatp
            case 'chatprompt':
            case 'chatp':
                args = this.parseOutgoing(args.join(' '), false);
                if ((<any>this.client).sendChat)
                    (<any>this.client).sendChat(args);
                return null;
            case 'chat':
            case 'ch':
                args = this.parseOutgoing(args.join(' ') + '\n', false);
                if ((<any>this.client).sendChat)
                    (<any>this.client).sendChat(args);
                return null;
            //spell-checker:ignore untrigger
            case 'untrigger':
            case 'unt':
                profile = null;
                name = null;
                reload = true;
                p = path.join(parseTemplate('{data}'), 'profiles');
                if (args.length < 1 || args.length > 2)
                    throw new Error('Invalid syntax use \x1b[4m#unt\x1b[0;-11;-12mrigger {pattern|name} \x1b[3mprofile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid name or pattern');
                //{pattern} {commands} profile
                if (args[0].match(/^\{.*\}$/g)) {
                    args[0] = args[0].substr(1, args[0].length - 2);
                    args[0] = this.parseOutgoing(args[0], false);
                }
                else if (args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g))
                    args[0] = this.parseOutgoing(this.stripQuotes(args[0]), false);
                if (args.length === 2) {
                    profile = this.stripQuotes(args[2]);
                    profile = this.parseOutgoing(profile, false);
                }
                if (!profile || profile.length === 0) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return;
                    if (kl === 1) {
                        if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                            throw Error('No enabled profiles found!');
                        item = profile.findAny('triggers', { name: args[0], pattern: args[0] });
                    }
                    else {
                        for (; k < kl; k++) {
                            if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                continue;
                            item = this.client.profiles.items[keys[k]].findAny('triggers', { name: args[0], pattern: args[0] });
                            if (item) {
                                profile = this.client.profiles.items[keys[k]];
                                break;
                            }
                        }
                    }
                    if (!item)
                        throw new Error('Trigger \'' + args[0] + '\' not found in \'' + profile.name + '\'!');
                    this.client.removeTrigger(item);
                    this.client.echo('Trigger \'' + args[0] + '\' removed from \'' + profile.name + '\'.', -7, -8, true, true);
                    return null;
                }
                else {
                    profile = this.parseOutgoing(profile, false);
                    if (this.client.profiles.contains(profile)) {
                        profile = this.client.profiles.items[profile];
                        item = profile.findAny('triggers', { name: args[0], pattern: args[0] });
                        if (!item)
                            throw new Error('Trigger \'' + args[0] + '\' not found in \'' + profile.name + '\'!');
                        this.client.removeTrigger(item);
                        this.client.echo('Trigger \'' + args[0] + '\' removed from \'' + profile.name + '\'.', -7, -8, true, true);
                        return null;
                    }
                    else {
                        name = profile;
                        profile = Profile.load(path.join(p, profile + '.json'));
                        if (!profile)
                            throw new Error('Profile not found: ' + name);
                        item = profile.indexOfAny('triggers', { name: args[0], pattern: args[0] });
                        if (item === -1)
                            throw new Error('Trigger \'' + args[0] + '\' not found in \'' + profile.name + '\'!');
                        profile.triggers.splice(item, 1);
                        profile.save(p);
                        profile = null;
                        this.client.echo('Trigger \'' + args[0] + '\' removed from \'' + profile.name + '\'.', -7, -8, true, true);
                        this.emit('item-removed', 'trigger', profile.name, item);
                    }
                }
                return null;
            case 'suspend':
            case 'sus':
                switch (args.length) {
                    case 0:
                        tmp = this.client.alarms;
                        if (tmp.length === 0)
                            this.client.echo('No alarms defined.', -7, -8, true, true);
                        else {
                            this.client.setAlarmState(0, false);
                            this._lastSuspend = 0;
                            this.client.echo('Last alarm suspended.', -7, -8, true, true);
                        }
                        return null;
                    case 1:
                        items = this.stripQuotes(args[0]);
                        items = this.parseOutgoing(items, false);
                        tmp = this.client.alarms;
                        al = tmp.length;
                        for (let a = tmp.length - 1; a >= 0; a--) {
                            if (tmp[a].name === items || tmp[a].pattern === items) {
                                this.client.setAlarmState(a, false);
                                this.client.echo('Alarm \'' + items + '\' suspended.', -7, -8, true, true);
                                this._lastSuspend = a;
                                break;
                            }
                        }
                        return null;
                    default:
                        throw new Error('Invalid syntax use \x1b[4m#sus\x1b[0;-11;-12mpend id \x1b[3mprofile\x1b[0;-11;-12m or \x1b[4m#sus\x1b[0;-11;-12mpend');
                }
            case 'resume':
            case 'resu':
                switch (args.length) {
                    case 0:
                        if (this._lastSuspend === -1)
                            return null;
                        this.client.setAlarmState(this._lastSuspend, true);
                        this.client.echo('Last alarm suspended resumed.', -7, -8, true, true);
                        this._lastSuspend = -1;
                        return null;
                    case 1:
                        items = this.stripQuotes(args[0]);
                        items = this.parseOutgoing(items, false);
                        tmp = this.client.alarms;
                        al = tmp.length;
                        for (let a = al - 1; a >= 0; a--) {
                            if (tmp[a].name === items || tmp[a].pattern === items) {
                                this.client.setAlarmState(a, true);
                                this.client.echo('Alarm \'' + items + '\' resumed.', -7, -8, true, true);
                                break;
                            }
                        }
                        return null;
                    default:
                        throw new Error('Invalid syntax use \x1b[4m#resu\x1b[0;-11;-12mme id \x1b[3mprofile\x1b[0;-11;-12m or \x1b[4m#resu\x1b[0;-11;-12mme');
                }
            case 'trigger':
            case 'tr':
                //#region trigger
                profile = null;
                reload = true;
                item = {
                    profile: null,
                    name: null,
                    pattern: null,
                    commands: null,
                    options: { priority: 0 }
                };
                p = path.join(parseTemplate('{data}'), 'profiles');
                if (args.length < 2 || args.length > 5)
                    throw new Error('Invalid syntax use \x1b[4m#tr\x1b[0;-11;-12migger name {pattern} {commands} \x1b[3moptions profile\x1b[0;-11;-12m or \x1b[4m#tr\x1b[0;-11;-12migger {pattern} {commands} \x1b[3m{options} profile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid trigger name or pattern');

                if (args[0].match(/^\{.*\}$/g)) {
                    item.pattern = args.shift();
                    item.pattern = this.parseOutgoing(item.pattern.substr(1, item.pattern.length - 2), false);
                }
                else {
                    item.name = this.stripQuotes(args.shift());
                    if (!item.name || item.name.length === 0)
                        throw new Error('Invalid trigger name');
                    if (args[0].match(/^\{.*\}$/g)) {
                        item.pattern = args.shift();
                        item.pattern = item.pattern.substr(1, item.pattern.length - 2);
                        item.pattern = this.parseOutgoing(item.pattern, false);
                    }
                }
                if (args.length !== 0) {
                    if (args[0].match(/^\{.*\}$/g)) {
                        item.commands = args.shift();
                        item.commands = item.commands.substr(1, item.commands.length - 2);
                    }
                    if (args.length === 1) {
                        if (args[0].match(/^\{.*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        else
                            args[0] = this.stripQuotes(args[0]);
                        if (args[0].length !== 0) {
                            this.parseOutgoing(args[0], false).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nocr':
                                    case 'prompt':
                                    case 'case':
                                    case 'verbatim':
                                    case 'disable':
                                    case 'enable':
                                    case 'cmd':
                                    case 'temporary':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger priority option '${o.trim()}'`);
                                            i = parseInt(tmp[1], 10);
                                            if (isNaN(i))
                                                throw new Error('Invalid trigger priority value \'' + tmp[1] + '\' must be a number');
                                            item.options['priority'] = i;
                                        }
                                        else
                                            throw new Error(`Invalid trigger option '${o.trim()}'`);
                                }
                            });
                        }
                        else
                            throw new Error('Invalid trigger options');
                    }
                    else if (args.length === 2) {
                        if (args[0].match(/^\{.*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        if (args[0].length !== 0) {
                            this.parseOutgoing(args[0], false).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nocr':
                                    case 'prompt':
                                    case 'case':
                                    case 'verbatim':
                                    case 'disable':
                                    case 'enable':
                                    case 'cmd':
                                    case 'temporary':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger priority option '${o.trim()}'`);
                                            i = parseInt(tmp[1], 10);
                                            if (isNaN(i))
                                                throw new Error('Invalid trigger priority value \'' + tmp[1] + '\' must be a number');
                                            item.options['priority'] = i;
                                        }
                                        else
                                            throw new Error(`Invalid trigger option '${o.trim()}'`);
                                }
                            });
                        }
                        else
                            throw new Error('Invalid trigger options');
                        item.profile = this.stripQuotes(args[1]);
                        if (item.profile.length !== 0)
                            tmp = this.parseOutgoing(item.profile, false);
                    }
                }
                if (!item.profile || item.profile.length === 0) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return;
                    if (kl === 1) {
                        if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                            throw Error('No enabled profiles found!');
                        profile = this.client.profiles.items[keys[0]];
                        if (item.name !== null)
                            trigger = this.client.profiles.items[keys[k]].find('triggers', 'name', item.name);
                        else
                            trigger = this.client.profiles.items[keys[k]].find('triggers', 'pattern', item.pattern);
                    }
                    else {
                        for (; k < kl; k++) {
                            if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                continue;
                            if (item.name !== null)
                                trigger = this.client.profiles.items[keys[k]].find('triggers', 'name', item.name);
                            else
                                trigger = this.client.profiles.items[keys[k]].find('triggers', 'pattern', item.pattern);
                            if (trigger) {
                                profile = this.client.profiles.items[keys[k]];
                                break;
                            }
                        }
                        if (!profile)
                            profile = this.client.activeProfile;
                    }
                }
                else {
                    if (this.client.profiles.contains(item.profile))
                        profile = this.client.profiles.items[item.profile];
                    else {
                        reload = false;
                        profile = Profile.load(path.join(p, item.profile + '.json'));
                        if (!profile)
                            throw new Error('Profile not found: ' + item.profile);
                    }
                }
                if (!trigger) {
                    if (!item.pattern)
                        throw new Error(`Trigger '${item.name || ''}' not found`);
                    trigger = new Trigger();
                    trigger.name = item.name || '';
                    trigger.pattern = item.pattern;
                    profile.triggers.push(trigger);
                    this.client.echo('Trigger \'' + (trigger.name || trigger.pattern) + '\' added.', -7, -8, true, true);
                    item.new = true;
                }
                else
                    this.client.echo('Trigger \'' + (trigger.name || trigger.pattern) + '\' updated.', -7, -8, true, true);
                if (item.pattern !== null)
                    trigger.pattern = item.pattern;
                if (item.commands !== null)
                    trigger.value = item.commands;
                if (item.options.cmd)
                    trigger.type = TriggerType.CommandInputRegular;
                if (item.options.prompt)
                    trigger.triggerPrompt = true;
                if (item.options.nocr)
                    trigger.triggerNewline = false;
                if (item.options.case)
                    trigger.caseSensitive = true;

                if (item.options.verbatim)
                    trigger.verbatim = true;
                if (item.options.disable)
                    trigger.enabled = false;
                else if (item.options.enable)
                    trigger.enabled = true;
                if (item.options.temporary)
                    trigger.temp = true;
                trigger.priority = item.options.priority;
                profile.save(p);
                if (reload)
                    this.client.clearCache();
                if (item.new)
                    this.emit('item-added', 'trigger', profile.name, trigger);
                else
                    this.emit('item-updated', 'trigger', profile.name, profile.triggers.indexOf(trigger), trigger);
                profile = null;
                //#endregion
                return null;
            case 'event':
            case 'ev':
                //#region event
                profile = null;
                reload = true;
                item = {
                    profile: null,
                    name: null,
                    pattern: null,
                    commands: null,
                    options: { priority: 0 }
                };
                p = path.join(parseTemplate('{data}'), 'profiles');
                if (args.length < 2 || args.length > 4)
                    throw new Error('Invalid syntax use \x1b[4m#ev\x1b[0;-11;-12ment name {commands} \x1b[3moptions profile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid event name');

                item.name = this.stripQuotes(args.shift());
                if (!item.name || item.name.length === 0)
                    throw new Error('Invalid event name');
                if (args.length === 0)
                    throw new Error('Missing commands or options');

                if (args[0].match(/^\{.*\}$/g)) {
                    item.commands = args.shift();
                    item.commands = item.commands.substr(1, item.commands.length - 2);
                }
                else
                    throw new Error('Missing commands');
                if (args.length === 1) {
                    args[0] = args[0].substr(1, args[0].length - 2);
                    if (args[0].length !== 0) {
                        this.parseOutgoing(args[0], false).split(',').forEach(o => {
                            switch (o.trim()) {
                                case 'nocr':
                                case 'prompt':
                                case 'case':
                                case 'verbatim':
                                case 'disable':
                                case 'temporary':
                                    item.options[o.trim()] = true;
                                    break;
                                default:
                                    if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
                                        tmp = o.trim().split('=');
                                        if (tmp.length !== 2)
                                            throw new Error(`Invalid event priority option '${o.trim()}'`);
                                        i = parseInt(tmp[1], 10);
                                        if (isNaN(i))
                                            throw new Error('Invalid event priority value \'' + tmp[1] + '\' must be a number');
                                        item.options['priority'] = i;
                                    }
                                    else
                                        throw new Error(`Invalid event option '${o.trim()}'`);
                            }
                        });
                    }
                    else
                        throw new Error('Invalid event options');
                }
                else if (args.length === 2) {
                    if (args[0].match(/^\{.*\}$/g))
                        args[0] = args[0].substr(1, args[0].length - 2);
                    if (args[0].length !== 0) {
                        this.parseOutgoing(args[0], false).split(',').forEach(o => {
                            switch (o.trim()) {
                                case 'nocr':
                                case 'prompt':
                                case 'case':
                                case 'verbatim':
                                case 'disable':
                                case 'temporary':
                                    item.options[o.trim()] = true;
                                    break;
                                default:
                                    if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
                                        tmp = o.trim().split('=');
                                        if (tmp.length !== 2)
                                            throw new Error(`Invalid event priority option '${o.trim()}'`);
                                        i = parseInt(tmp[1], 10);
                                        if (isNaN(i))
                                            throw new Error('Invalid event priority value \'' + tmp[1] + '\' must be a number');
                                        item.options['priority'] = i;
                                    }
                                    else
                                        throw new Error(`Invalid event option '${o.trim()}'`);
                            }
                        });
                    }
                    else
                        throw new Error('Invalid event options');
                    item.profile = this.stripQuotes(args[1]);
                    if (item.profile.length !== 0)
                        tmp = this.parseOutgoing(item.profile, false);
                }

                if (!item.profile || item.profile.length === 0) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return;
                    if (kl === 1) {
                        if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                            throw Error('No enabled profiles found!');
                        profile = this.client.profiles.items[keys[0]];
                        tmp = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers.filter(t => t.type === TriggerType.Event));
                        trigger = tmp.find(t => {
                            return t.name === item.name || t.pattern === item.name;
                        });
                    }
                    else {
                        for (; k < kl; k++) {
                            if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                continue;
                            tmp = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers.filter(t => t.type === TriggerType.Event));
                            trigger = tmp.find(t => {
                                return t.name === item.name || t.pattern === item.name;
                            });
                            if (trigger) {
                                profile = this.client.profiles.items[keys[k]];
                                break;
                            }
                        }
                        if (!profile)
                            profile = this.client.activeProfile;
                    }
                }
                else {
                    if (this.client.profiles.contains(item.profile))
                        profile = this.client.profiles.items[item.profile];
                    else {
                        profile = Profile.load(path.join(p, item.profile + '.json'));
                        reload = false;
                        if (!profile)
                            throw new Error('Profile not found: ' + item.profile);
                    }
                }
                if (!trigger) {
                    trigger = new Trigger();
                    trigger.name = item.name;
                    profile.triggers.push(trigger);
                    this.client.echo('Event \'' + trigger.name + '\' added.', -7, -8, true, true);
                    item.new = true;
                }
                else
                    this.client.echo('Event \'' + trigger.name + '\' updated.', -7, -8, true, true);
                trigger.pattern = item.name;
                if (item.commands !== null)
                    trigger.value = item.commands;
                trigger.type = TriggerType.Event;
                if (item.options.prompt)
                    trigger.triggerPrompt = true;
                if (item.options.nocr)
                    trigger.triggerNewline = false;
                if (item.options.case)
                    trigger.caseSensitive = true;

                if (item.options.verbatim)
                    trigger.verbatim = true;
                if (item.options.disable)
                    trigger.enabled = false;
                else if (item.options.enable)
                    trigger.enabled = true;
                if (item.options.temporary)
                    trigger.temp = true;
                trigger.priority = item.options.priority;
                profile.save(p);
                if (reload)
                    this.client.clearCache();
                if (item.new)
                    this.emit('item-added', 'trigger', profile.name, trigger);
                else
                    this.emit('item-updated', 'trigger', profile.name, profile.triggers.indexOf(trigger), trigger);
                profile = null;
                //#endregion
                return null;
            case 'unevent':
            case 'une':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#une\x1b[0;-11;-12mvent name or \x1b[4m#une\x1b[0;-11;-12mvent {name} \x1b[3mprofile\x1b[0;-11;-12m');
                else {
                    reload = true;
                    profile = null;
                    p = path.join(parseTemplate('{data}'), 'profiles');
                    if (args[0].match(/^\{.*\}$/g) || args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g)) {
                        if (args.length > 2)
                            throw new Error('Invalid syntax use \x1b[4m#une\x1b[0;-11;-12mvent name or \x1b[4m#une\x1b[0;-11;-12mvent {name} \x1b[3mprofile\x1b[0;-11;-12m');
                        if (args.length === 2) {
                            profile = this.stripQuotes(args[1]);
                            profile = this.parseOutgoing(profile, false);
                            if (this.client.profiles.contains(profile))
                                profile = this.client.profiles.items[profile];
                            else {
                                name = profile;
                                reload = false;
                                profile = Profile.load(path.join(p, profile + '.json'));
                                if (!profile)
                                    throw new Error('Profile not found: ' + name);
                            }
                        }
                        else
                            profile = this.client.activeProfile;
                        if (args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g))
                            n = this.parseOutgoing(this.stripQuotes(args[0]), false);
                        else
                            n = this.parseOutgoing(args[0].substr(1, args[0].length - 2), false);
                    }
                    else {
                        n = this.parseOutgoing(args.join(' '), false);
                        profile = this.client.activeProfile;
                    }
                    items = SortItemArrayByPriority(profile.triggers.filter(t => t.type === TriggerType.Event));
                    n = this.stripQuotes(n);
                    tmp = n;
                    for (i = 0, al = items.length; i < al; i++) {
                        if (items[i].name === n || items[i]['pattern'] === n) {
                            n = i;
                            f = true;
                            break;
                        }
                    }
                    if (!f)
                        this.client.echo('Event \'' + tmp + '\' not found.', -7, -8, true, true);
                    else {
                        this.client.echo('Event \'' + (items[n].name || items[n].pattern) + '\' removed.', -7, -8, true, true);
                        if (reload)
                            this.client.removeTrigger(items[n]);
                        else {
                            n = profile.triggers.indexOf(items[n]);
                            profile.triggers.splice(n, 1);
                            profile.save(p);
                            this.emit('item-removed', 'trigger', profile.name, n);
                        }
                        profile = null;
                    }
                }
                return null;
            case 'button':
            case 'bu':
                //#region button
                //#button name caption {commands} {icon} options profile
                //#button name|index
                //Options: enable, disable, nosend, chain, append, stretch, priority=#
                if (args.length === 1) {
                    n = this.stripQuotes(args[0]);
                    n = this.parseOutgoing(n, false);
                    items = document.getElementById('user-buttons').children;
                    if (/^\d+$/.exec(n)) {
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            throw new Error('Button index must be >= 0 and < ' + items.length);
                        else
                            items[n].click();
                    }
                    else if (items[n])
                        items[n].click();
                    else
                        throw new Error(`Button '${n}' not found`);
                    return null;
                }
                profile = null;
                reload = true;
                item = {
                    profile: null,
                    name: null,
                    caption: null,
                    commands: null,
                    icon: null,
                    options: { priority: 0 }
                };
                p = path.join(parseTemplate('{data}'), 'profiles');
                if (args.length < 2 || args.length > 5)
                    throw new Error('Invalid syntax use \x1b[4m#bu\x1b[0;-11;-12mtton name|index or \x1b[4m#bu\x1b[0;-11;-12mtton name \x1b[3mcaption\x1b[0;-11;-12m {commands} \x1b[3m{icon} options profile\x1b[0;-11;-12m or \x1b[4m#by\x1b[0;-11;-12mutton \x1b[3mcaption\x1b[0;-11;-12m {commands} \x1b[3m{icon} {options} profile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid button name, caption or commands');

                if (args[0].match(/^\{.*\}$/g)) {
                    item.commands = args.shift();
                    item.commands = item.commands.substr(1, item.commands.length - 2);
                }
                else {
                    item.name = this.stripQuotes(args.shift());
                    if (!item.name || item.name.length === 0)
                        throw new Error('Invalid button name or caption');
                    if (args[0].match(/^\{.*\}$/g)) {
                        item.commands = args.shift();
                        item.commands = item.commands.substr(1, item.commands.length - 2);
                    }
                    else {
                        item.caption = this.stripQuotes(args.shift());
                        if (!args[0].match(/^\{.*\}$/g))
                            throw new Error('Missing commands');
                    }
                }

                if (args.length !== 0) {
                    if (args[0].match(/^\{.*\}$/g)) {
                        item.icon = args.shift();
                        item.icon = item.icon.substr(1, item.icon.length - 2);
                    }
                    if (args.length === 1) {
                        if (args[0].match(/^\{.*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        else
                            args[0] = this.stripQuotes(args[0]);
                        if (args[0].length !== 0) {
                            this.parseOutgoing(args[0], false).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nosend':
                                    case 'chain':
                                    case 'append':
                                    case 'stretch':
                                    case 'disable':
                                    case 'enable':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid button priority option '${o.trim()}'`);
                                            i = parseInt(tmp[1], 10);
                                            if (isNaN(i))
                                                throw new Error('Invalid button priority value \'' + tmp[1] + '\' must be a number');
                                            item.options['priority'] = i;
                                        }
                                        else
                                            throw new Error(`Invalid button option '${o.trim()}'`);
                                }
                            });
                        }
                        else
                            throw new Error('Invalid button options');
                    }
                    else if (args.length === 2) {
                        if (args[0].match(/^\{.*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        if (args[0].length !== 0) {
                            this.parseOutgoing(args[0], false).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nosend':
                                    case 'chain':
                                    case 'append':
                                    case 'stretch':
                                    case 'disable':
                                    case 'enable':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid button priority option '${o.trim()}'`);
                                            i = parseInt(tmp[1], 10);
                                            if (isNaN(i))
                                                throw new Error('Invalid button priority value \'' + tmp[1] + '\' must be a number');
                                            item.options['priority'] = i;
                                        }
                                        else
                                            throw new Error(`Invalid button option '${o.trim()}'`);
                                }
                            });
                        }
                        else
                            throw new Error('Invalid button options');
                        item.profile = this.stripQuotes(args[1]);
                        if (item.profile.length !== 0)
                            tmp = this.parseOutgoing(item.profile, false);
                    }
                }
                if (!item.profile || item.profile.length === 0) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return;
                    if (kl === 1) {
                        if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                            throw Error('No enabled profiles found!');
                        profile = this.client.profiles.items[keys[0]];
                        if (item.name !== null)
                            trigger = this.client.profiles.items[keys[k]].find('buttons', 'name', item.name);
                        else
                            trigger = this.client.profiles.items[keys[k]].find('buttons', 'caption', item.caption);
                    }
                    else {
                        for (; k < kl; k++) {
                            if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                continue;
                            if (item.name !== null)
                                trigger = this.client.profiles.items[keys[k]].find('buttons', 'name', item.name);
                            else
                                trigger = this.client.profiles.items[keys[k]].find('buttons', 'caption', item.caption);
                            if (trigger) {
                                profile = this.client.profiles.items[keys[k]];
                                break;
                            }
                        }
                        if (!profile)
                            profile = this.client.activeProfile;
                    }
                }
                else {
                    if (this.client.profiles.contains(item.profile))
                        profile = this.client.profiles.items[item.profile];
                    else {
                        reload = false;
                        profile = Profile.load(path.join(p, item.profile + '.json'));
                        if (!profile)
                            throw new Error('Profile not found: ' + item.profile);
                    }
                }
                if (!trigger) {
                    trigger = new Button();
                    trigger.name = item.name || '';
                    trigger.caption = item.caption || '';
                    profile.buttons.push(trigger);
                    if (!item.name && !item.caption)
                        this.client.echo('Button added.', -7, -8, true, true);
                    else
                        this.client.echo('Button \'' + (trigger.name || trigger.caption || '') + '\' added.', -7, -8, true, true);
                    item.new = true;
                }
                else
                    this.client.echo('Button \'' + (trigger.name || trigger.caption || '') + '\' updated.', -7, -8, true, true);
                if (item.caption !== null)
                    trigger.caption = item.caption;
                if (item.commands !== null)
                    trigger.value = item.commands;

                if (item.options.icon)
                    trigger.icon = item.options.icon;
                if (item.options.nosend)
                    trigger.send = false;
                if (item.options.chain)
                    trigger.chain = true;
                if (item.options.append)
                    trigger.append = true;
                if (item.options.stretch)
                    trigger.stretch = true;
                if (item.options.disable)
                    trigger.enabled = false;
                else if (item.options.enable)
                    trigger.enabled = true;
                trigger.priority = item.options.priority;
                profile.save(p);
                if (reload)
                    this.client.clearCache();
                if (item.new)
                    this.emit('item-added', 'button', profile.name, trigger);
                else
                    this.emit('item-updated', 'button', profile.name, profile.buttons.indexOf(trigger), trigger);
                profile = null;
                //#endregion
                return null;
            case 'unbutton':
            case 'unb':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#unb\x1b[0;-11;-12mtton name or \x1b[4m#unb\x1b[0;-11;-12mtton {name} \x1b[3mprofile\x1b[0;-11;-12m');
                else {
                    reload = true;
                    profile = null;
                    p = path.join(parseTemplate('{data}'), 'profiles');
                    if (args[0].match(/^\{.*\}$/g) || args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g)) {
                        if (args.length > 2)
                            throw new Error('Invalid syntax use \x1b[4m#unb\x1b[0;-11;-12mtton name or \x1b[4m#unb\x1b[0;-11;-12mtton {name} \x1b[3mprofile\x1b[0;-11;-12m');
                        if (args.length === 2) {
                            profile = this.stripQuotes(args[1]);
                            profile = this.parseOutgoing(profile, false);
                            if (this.client.profiles.contains(profile))
                                profile = this.client.profiles.items[profile];
                            else {
                                name = profile;
                                reload = false;
                                profile = Profile.load(path.join(p, profile + '.json'));
                                if (!profile)
                                    throw new Error('Profile not found: ' + name);
                            }
                        }
                        else
                            profile = this.client.activeProfile;
                        if (args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g))
                            n = this.parseOutgoing(this.stripQuotes(args[0]), false);
                        else
                            n = this.parseOutgoing(args[0].substr(1, args[0].length - 2), false);
                    }
                    else {
                        n = this.parseOutgoing(args.join(' '), false);
                        profile = this.client.activeProfile;
                    }
                    items = SortItemArrayByPriority(profile.buttons);
                    tmp = n;
                    if (/^\d+$/.exec(n)) {
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            throw new Error('Button index must be >= 0 and < ' + items.length);
                        f = true;
                    }
                    else {
                        n = this.stripQuotes(n);
                        for (i = 0, al = items.length; i < al; i++) {
                            if (items[i].name === n || items[i]['caption'] === n) {
                                n = i;
                                f = true;
                                break;
                            }
                        }
                    }
                    if (!f)
                        this.client.echo('Button \'' + tmp + '\' not found.', -7, -8, true, true);
                    else {
                        if (items[n].name.length === 0 && items[n].caption.length === 0)
                            this.client.echo('Button \'' + tmp + '\' removed.', -7, -8, true, true);
                        else
                            this.client.echo('Button \'' + (items[n].name || items[n].caption) + '\' removed.', -7, -8, true, true);
                        n = profile.buttons.indexOf(items[n]);
                        profile.buttons.splice(n, 1);
                        profile.save(p);
                        if (reload)
                            this.client.clearCache();
                        this.emit('item-removed', 'button', profile.name, n);
                        profile = null;
                    }
                }
                return null;
            case 'alarm':
            case 'ala':
                //spell-checker:ignore timepattern
                profile = null;
                name = null;
                reload = true;
                n = false;
                p = path.join(parseTemplate('{data}'), 'profiles');
                if (args.length < 2 || args.length > 4)
                    throw new Error('Invalid syntax use \x1b[4m#ala\x1b[0;-11;-12mrm name {timepattern} {commands} \x1b[3mprofile\x1b[0;-11;-12m, \x1b[4m#ala\x1b[0;-11;-12mrm name {timepattern} \x1b[3mprofile\x1b[0;-11;-12m, or \x1b[4m#ala\x1b[0;-11;-12mrm {timepattern} {commands} \x1b[3mprofile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid name or timepattern');
                //{pattern} {commands} profile
                if (args[0].match(/^\{.*\}$/g)) {
                    if (args.length > 3)
                        throw new Error('Invalid syntax use \x1b[4m#ala\x1b[0;-11;-12mrm {timepattern} {commands} profile');
                    args[0] = args[0].substr(1, args[0].length - 2);
                    args[0] = this.parseOutgoing(args[0], false);
                    if (args[1].match(/^\{.*\}$/g))
                        args[1] = args[1].substr(1, args[1].length - 2);
                    if (args.length === 3) {
                        profile = this.stripQuotes(args[2]);
                        profile = this.parseOutgoing(profile, false);
                    }

                    if (!profile || profile.length === 0)
                        profile = this.client.activeProfile;
                    else {
                        if (this.client.profiles.contains(profile))
                            profile = this.client.profiles.items[profile];
                        else {
                            name = profile;
                            reload = false;
                            profile = Profile.load(path.join(p, profile + '.json'));
                            if (!profile)
                                throw new Error('Profile not found: ' + name);
                        }
                    }
                    trigger = new Trigger();
                    trigger.pattern = args[0];
                    trigger.value = args[1];
                    trigger.type = TriggerType.Alarm;
                    profile.triggers.push(trigger);
                    profile.save(p);
                    if (reload) {
                        this._lastSuspend = -1;
                        this.client.updateAlarms();
                    }
                    this.client.echo('Alarm \'' + trigger.pattern + '\' added.', -7, -8, true, true);
                    this.emit('item-added', 'trigger', profile.name, trigger);
                    profile = null;
                    return null;
                }
                name = this.stripQuotes(args[0]);
                if (!name || name.length === 0)
                    throw new Error('Invalid alarm name');
                name = this.parseOutgoing(name, false);
                let pattern = args[1];
                let commands = null;
                if (pattern.match(/^\{.*\}$/g))
                    pattern = pattern.substr(1, pattern.length - 2);
                pattern = this.parseOutgoing(pattern, false);
                if (args.length === 3) {
                    if (args[2].match(/^\{.*\}$/g))
                        commands = args[2].substr(1, args[2].length - 2);
                    else
                        profile = this.stripQuotes(args[2]);
                }
                else if (args.length === 4) {
                    commands = args[2];
                    profile = this.stripQuotes(args[3]);
                    if (commands.match(/^\{.*\}$/g))
                        commands = commands.substr(1, commands.length - 2);
                }
                if (!profile || profile.length === 0) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return;
                    if (kl === 1) {
                        if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                            throw Error('No enabled profiles found!');
                        profile = this.client.profiles.items[keys[0]];
                        trigger = profile.find('triggers', 'name', name);
                        if (!trigger && !commands)
                            throw new Error('Alarm not found!');
                        else if (!trigger) {
                            trigger = new Trigger();
                            trigger.name = name;
                            profile.triggers.push(trigger);
                            this.client.echo('Alarm \'' + trigger.name + '\' added.', -7, -8, true, true);
                            n = true;
                        }
                        else
                            this.client.echo('Alarm \'' + trigger.name + '\' updated.', -7, -8, true, true);
                    }
                    else {
                        for (; k < kl; k++) {
                            if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                continue;
                            trigger = this.client.profiles.items[keys[k]].find('triggers', 'name', name);
                            if (trigger) {
                                profile = this.client.profiles.items[keys[k]];
                                break;
                            }
                        }
                        if (!profile && !commands)
                            throw new Error('Alarm not found!');
                        if (!profile)
                            profile = this.client.activeProfile;
                        if (!trigger) {
                            trigger = new Trigger();
                            n = true;
                            trigger.name = name;
                            profile.triggers.push(trigger);
                            this.client.echo('Alarm \'' + trigger.name + '\' added.', -7, -8, true, true);
                        }
                        else
                            this.client.echo('Alarm \'' + trigger.name + '\' updated.', -7, -8, true, true);
                    }
                }
                else {
                    profile = this.parseOutgoing(profile, false);
                    if (this.client.profiles.contains(profile))
                        profile = this.client.profiles.items[profile];
                    else {
                        name = profile;
                        reload = false;
                        profile = Profile.load(path.join(p, profile + '.json'));
                        if (!profile)
                            throw new Error('Profile not found: ' + name);
                    }
                    trigger = profile.find('triggers', 'name', name);
                    if (!trigger && !commands)
                        throw new Error('Alarm not found!');
                    else if (!trigger) {
                        trigger = new Trigger();
                        trigger.name = name;
                        profile.triggers.push(trigger);
                        n = true;
                        this.client.echo('Alarm \'' + trigger.name + '\' added.', -7, -8, true, true);
                    }
                    else
                        this.client.echo('Alarm \'' + trigger.name + '\' updated.', -7, -8, true, true);
                }
                trigger.pattern = pattern;
                trigger.type = TriggerType.Alarm;
                if (commands)
                    trigger.value = commands;
                profile.save(p);
                if (n)
                    this.emit('item-added', 'trigger', profile.name, trigger);
                else
                    this.emit('item-updated', 'trigger', profile.name, profile.triggers.indexOf(trigger), trigger);
                profile = null;
                if (reload) {
                    this._lastSuspend = -1;
                    this.client.updateAlarms();
                }
                return null;
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
                    args.forEach((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.options.parseSingleQuotes)
                    args.forEach((a) => {
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
                i = parseInt(this.stripQuotes(args[0]), 10);
                if (isNaN(i))
                    throw new Error('Invalid number \'' + args[0] + '\'');
                if (i < 1)
                    throw new Error('Must be greater then zero');
                args.shift();
                if (this.client.options.parseDoubleQuotes)
                    args.forEach((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.options.parseSingleQuotes)
                    args.forEach((a) => {
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
                    throw new Error('Invalid syntax use \x1b[4m#not\x1b[0;-11;-12mify title \x1b[3mmessage icon\x1b[0;-11;-12m');
                else {
                    args[0] = this.stripQuotes(args[0]);
                    if (args[args.length - 1].match(/^\{.*\}$/g)) {
                        item = args.pop();
                        n = { icon: parseTemplate(this.parseOutgoing(item.substr(1, item.length - 2), false)) };
                    }
                    if (args.length === 0)
                        throw new Error('Invalid syntax use \x1b[4m#not\x1b[0;-11;-12mify title \x1b[3mmessage icon\x1b[0;-11;-12m');
                    if (args.length === 1)
                        this.client.notify(this.parseOutgoing(this.stripQuotes(args[0]), false), null, n);
                    else
                        this.client.notify(this.parseOutgoing(this.stripQuotes(args[0]), false), this.parseOutgoing(args.slice(1).join(' '), false), n);
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
                args = this.parseOutgoing(args.join(' '), false);
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
                args = this.parseOutgoing(args.join(' '), false);
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
                args = this.parseOutgoing(args.join(' '), false);
                this.client.telnet.receivedData(Buffer.from(args), true);
                this.client.telnet.prompt = true;
                return null;
            case 'show':
            case 'sh':
                args = this.parseOutgoing(args.join(' ') + '\n', false);
                this.client.telnet.receivedData(Buffer.from(args), true);
                return null;
            case 'sayprompt':
            case 'sayp':
            case 'echoprompt':
            case 'echop':
                args = this.parseOutgoing(args.join(' '));
                this.client.print('\x1b[-7;-8m' + args + '\x1b[0m', false);
                return null;
            case 'say':
            case 'sa':
            case 'echo':
            case 'ec':
                args = this.parseOutgoing(args.join(' '), false);
                if (this.client.telnet.prompt)
                    this.client.print('\n\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                else
                    this.client.print('\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                this.client.telnet.prompt = false;
                return null;
            case 'alias':
            case 'al':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#al\x1b[0;-11;-12mias name value or \x1b[4m#al\x1b[0;-11;-12mias name {value} \x1b[3mprofile\x1b[0;-11;-12m');
                else if (args.length === 1)
                    throw new Error('Must supply an alias value');
                else {
                    n = this.stripQuotes(args.shift());
                    n = this.parseOutgoing(n, false);
                    reload = true;
                    profile = null;
                    p = path.join(parseTemplate('{data}'), 'profiles');
                    if (args[0].match(/^\{.*\}$/g) || args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g)) {
                        if (args.length > 2)
                            throw new Error('Invalid syntax use \x1b[4m#al\x1b[0;-11;-12mias name value or \x1b[4m#al\x1b[0;-11;-12mias name {value} \x1b[3mprofile\x1b[0;-11;-12m');
                        if (args.length === 2) {
                            profile = this.stripQuotes(args[1]);
                            profile = this.parseOutgoing(profile, false);
                            if (this.client.profiles.contains(profile))
                                profile = this.client.profiles.items[profile];
                            else {
                                name = profile;
                                reload = false;
                                profile = Profile.load(path.join(p, profile + '.json'));
                                if (!profile)
                                    throw new Error('Profile not found: ' + name);
                            }
                        }
                        else
                            profile = this.client.activeProfile;
                        if (args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g))
                            args = this.parseOutgoing(this.stripQuotes(args[0]), false);
                        else
                            args = this.parseOutgoing(args[0].substr(1, args[0].length - 2), false);
                    }
                    else {
                        args = args.join(' ');
                        profile = this.client.activeProfile;
                    }
                    items = profile.aliases;
                    args = this.stripQuotes(args);
                    if (/^\d+$/.exec(n)) {
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            throw new Error('Alias index must be >= 0 and < ' + items.length);
                        else {
                            items[n].value = args;
                            this.client.echo('Alias \'' + items[n].pattern + '\' updated.', -7, -8, true, true);
                        }
                    }
                    else {
                        for (i = 0, al = items.length; i < al; i++) {
                            if (items[i]['pattern'] === n) {
                                items[i].value = args;
                                this.client.echo('Alias \'' + n + '\' updated.', -7, -8, true, true);
                                this.emit('item-updated', 'alias', profile.name, i, tmp);
                                f = true;
                                break;
                            }
                        }
                        if (!f) {
                            tmp = new Alias(n, args);
                            items.push(tmp);
                            this.emit('item-added', 'alias', profile.name, tmp);
                            this.client.echo('Alias \'' + n + '\' added.', -7, -8, true, true);
                        }
                    }
                    profile.aliases = items;
                    profile.save(p);
                    profile = null;
                    if (reload)
                        this.client.clearCache();
                }
                return null;
            case 'unalias':
            case 'una':
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m#una\x1b[0;-11;-12mlias name or \x1b[4m#una\x1b[0;-11;-12mlias {name} \x1b[3mprofile\x1b[0;-11;-12m');
                else {
                    reload = true;
                    profile = null;
                    p = path.join(parseTemplate('{data}'), 'profiles');
                    if (args[0].match(/^\{.*\}$/g) || args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g)) {
                        if (args.length > 2)
                            throw new Error('Invalid syntax use \x1b[4m#una\x1b[0;-11;-12mlias name or \x1b[4m#una\x1b[0;-11;-12mlias {name} \x1b[3mprofile\x1b[0;-11;-12m');
                        if (args.length === 2) {
                            profile = this.stripQuotes(args[1]);
                            profile = this.parseOutgoing(profile, false);
                            if (this.client.profiles.contains(profile))
                                profile = this.client.profiles.items[profile];
                            else {
                                name = profile;
                                reload = false;
                                profile = Profile.load(path.join(p, profile + '.json'));
                                if (!profile)
                                    throw new Error('Profile not found: ' + name);
                            }
                        }
                        else
                            profile = this.client.activeProfile;
                        if (args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g))
                            n = this.parseOutgoing(this.stripQuotes(args[0]), false);
                        else
                            n = this.parseOutgoing(args[0].substr(1, args[0].length - 2), false);
                    }
                    else {
                        n = this.parseOutgoing(args.join(' '), false);
                        profile = this.client.activeProfile;
                    }
                    items = profile.aliases;
                    n = this.stripQuotes(n);
                    if (/^\d+$/.exec(n)) {
                        tmp = n;
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            throw new Error('Alias index must be >= 0 and < ' + items.length);
                        else
                            f = true;
                    }
                    else {
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
                        profile.aliases = items;
                        profile.save(p);
                        if (reload)
                            this.client.clearCache();
                        profile = null;
                        this.emit('item-removed', 'alias', profile.name, n);
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
                    n = this.stripQuotes(this.parseOutgoing(args[0], false));
                    args = this.stripQuotes(this.parseOutgoing(args.slice(1).join(' '), false));
                    if (/^\d+$/.exec(n)) {
                        tmp = n;
                        n = parseInt(n, 10);
                        if (n < 0 || n >= SettingList.length)
                            throw new Error('Setting index must be >= 0 and < ' + SettingList.length);
                        f = true;
                    }
                    else {
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
                    n = this.stripQuotes(this.parseOutgoing(args.join(' '), false));
                    if (/^\d+$/.exec(n)) {
                        n = parseInt(n, 10);
                        if (n < 0 || n >= SettingList.length)
                            throw new Error('Setting index must be >= 0 and < ' + SettingList.length);
                        else
                            f = true;
                    }
                    else {

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
                    args[0] = this.parseOutgoing(args[0], false);
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
                    args[0] = this.parseOutgoing(args[0], false);
                    if (!this.client.profiles[args[0]])
                        throw new Error('Profile not found');
                    if (!args[1])
                        throw new Error('Invalid syntax use \x1b[4m#pro\x1b[0;-11;-12mfile name or \x1b[4m#pro\x1b[0;-11;-12mfile name enable/disable');
                    args[1] = this.parseOutgoing(args[1], false);
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
            window.repeatnum = undefined;
            if (tmp.length > 0)
                return tmp.join('\n');
            return null;
        }
        const data = { name: fun, args: args, raw: raw, handled: false, return: null };
        this.client.emit('function', data);
        if (data.handled)
            return data.return;
        return data.raw + '\n';
    }

    public parseOutgoing(text: string, eAlias?: boolean, stacking?: boolean) {
        const tl = text.length;
        if (text == null || tl === 0)
            return text;
        let str: string = '';
        let alias: string = '';
        let AliasesCached;
        let state = 0;
        //store as local vars to speed up parsing
        const aliases = this.client.aliases;
        const stackingChar: string = this.client.options.commandStackingChar;
        const spChar: string = this.client.options.speedpathsChar;
        const ePaths: boolean = this.client.options.enableSpeedpaths;
        const eCmd: boolean = this.client.options.enableCommands;
        const cmdChar: string = this.client.options.commandChar;
        const eEscape: boolean = this.client.options.allowEscape;
        const escChar: string = this.client.options.escapeChar;
        const verbatimChar: string = this.client.options.verbatimChar;
        const eVerbatim: boolean = this.client.options.enableVerbatim;
        let args = [];
        let arg: any = '';
        let findAlias: boolean = true;
        let out: string = '';
        let a;
        let c: string;
        let al: number;
        let idx: number = 0;
        let tmp;
        let tmp2;
        let start: boolean = true;
        let _neg: boolean = false;
        let nest: number = 0;
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
                case ParseState.doubleQuoted:
                    //quoted string
                    if (c === '"' && pd)
                        state = ParseState.none;
                    if (eAlias && findAlias)
                        alias += c;
                    else
                        str += c;
                    start = false;
                    break;
                case ParseState.singleQuoted:
                    //quoted string
                    if (c === '\'' && ps)
                        state = ParseState.none;
                    if (eAlias && findAlias)
                        alias += c;
                    else
                        str += c;
                    start = false;
                    break;
                case ParseState.aliasArguments:
                    //quoted string so keep intact
                    if (c === '"' && pd) {
                        arg += c;
                        state = ParseState.aliasArgumentsDouble;
                        start = false;
                    }
                    //quoted string so keep int
                    else if (c === '\'' && ps) {
                        arg += c;
                        state = ParseState.aliasArgumentsSingle;
                        start = false;
                    }
                    //end of alias at end of text, new line, or command stack if enabled
                    else if (idx === tl - 1 || c === '\n' || (stacking && c === stackingChar)) {
                        //save any arg that was found
                        if (arg.length > 0)
                            args.push(arg);
                        al = AliasesCached.length;
                        for (a = 0; a < al; a++) {
                            str = this.ExecuteAlias(AliasesCached[a], args);
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
                        state = ParseState.none;
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
                case ParseState.aliasArgumentsDouble: //quoted alias argument
                    if (c === '"')
                        state = ParseState.aliasArguments;
                    arg += c;
                    start = false;
                    break;
                case ParseState.aliasArgumentsSingle: //quoted alias argument
                    if (c === '\'')
                        state = ParseState.aliasArguments;
                    arg += c;
                    start = false;
                    break;
                case ParseState.path: //path found
                    if (c === '\n' || (stacking && c === stackingChar)) {
                        state = ParseState.none;
                        str = this.ProcessPath(str);
                        if (str !== null) out += str;
                        str = '';
                        start = true;
                    }
                    else if (idx === 1 && c === spChar) {
                        state = ParseState.none;
                        idx--;
                        start = false;
                    }
                    else {
                        str += c;
                        start = false;
                    }
                    break;
                case ParseState.function:
                    if (c === '{') {
                        start = false;
                        str += c;
                        nest++;
                    }
                    else if (c === '}') {
                        start = false;
                        str += c;
                        nest--;
                    }
                    else if (nest === 0 && (c === '\n' || (stacking && c === stackingChar))) {
                        state = ParseState.none;
                        str = this.executeScript('#' + str);
                        if (typeof str === 'number') {
                            this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                            if (out.length === 0) return null;
                            return out;
                        }
                        if (str !== null) {
                            if (str.startsWith('#'))
                                out += '#' + this.parseOutgoing(str.substr(1));
                            else
                                out += this.parseOutgoing(str);
                        }
                        str = '';
                        start = true;
                    }
                    else {
                        str += c;
                        start = false;
                    }
                    break;
                case ParseState.paramsP:
                    if (c === '{' && arg.length === 0) {
                        state = ParseState.paramsPBlock;
                        continue;
                    }
                    if (eEscape && c === escChar && arg.length === 0) {
                        state = ParseState.paramsPEscape;
                        continue;
                    }
                    switch (c) {
                        case '%':
                            if (eAlias && findAlias)
                                alias += '%';
                            else
                                str += '%';
                            state = ParseState.none;
                            break;
                        case '*':
                            if (this.stack.args) {
                                if (eAlias && findAlias)
                                    alias += this.stack.args.slice(1).join(' ');
                                else
                                    str += this.stack.args.slice(1).join(' ');
                                this.stack.used = this.stack.args.length;
                            }
                            else if (eAlias && findAlias)
                                alias += '%*';
                            else
                                str += '%*';
                            state = ParseState.none;
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
                            if (this.stack.args && arg.length > 0) {
                                tmp = parseInt(arg, 10);
                                if (_neg && tmp < this.stack.args.length)
                                    tmp = this.stack.args.slice(arg).join(' ');
                                else if (tmp < this.stack.args.length)
                                    tmp = this.stack.args[tmp];
                                if (_neg)
                                    this.stack.used = this.stack.args.length;
                                else if (arg > this.stack.used)
                                    this.stack.used = arg;
                                if (eAlias && findAlias)
                                    alias += tmp;
                                else
                                    str += tmp;
                                idx--;
                            }
                            else {
                                if (eAlias && findAlias)
                                    alias += '%';
                                else
                                    str += '%';
                                idx = idx - arg.length - 1;
                            }
                            state = ParseState.none;
                            arg = '';
                            break;
                    }
                    break;
                case ParseState.paramsPBlock:
                    if (c === '}' && nest === 0) {
                        if (arg === 'i')
                            tmp2 = window.repeatnum;
                        else if (arg === 'repeatnum')
                            tmp2 = window.repeatnum;
                        else if (this.stack.args && arg === '*') {
                            tmp2 = this.stack.args.slice(1).join(' ');
                            this.stack.used = this.stack.args.length;
                        }
                        else if (this.stack.named && this.stack.named.hasOwnProperty(arg))
                            tmp2 = this.stack.named[arg];
                        else {
                            if (this.stack.args && !isNaN(arg)) {
                                arg = parseInt(arg, 10);
                                if (arg < 0) {
                                    tmp2 = this.stack.args.slice(arg).join(' ');
                                    this.stack.used = this.stack.args.length;
                                }
                                else {
                                    tmp2 = this.stack.args[arg];
                                    if (arg > this.stack.used)
                                        this.stack.used = arg;
                                }
                            }
                            else {
                                tmp = this.parseVariable(arg);
                                if (tmp != null)
                                    tmp2 = tmp;
                                else if (this.client.options.allowEval) {
                                    if (this.stack.named)
                                        tmp2 = '' + mathjs.eval(this.parseOutgoing(arg), Object.assign({ i: window.repeatnum || 0, repeatnum: window.repeatnum || 0 }, this.stack.named));
                                    else
                                        tmp2 = '' + mathjs.eval(this.parseOutgoing(arg), { i: window.repeatnum || 0, repeatnum: window.repeatnum || 0 });
                                }
                                else {
                                    tmp2 += '%';
                                    idx = idx - arg.length - 2;
                                }
                            }
                        }
                        if (tmp2 != null && eAlias && findAlias)
                            alias += tmp2;
                        else if (tmp2 != null)
                            str += tmp2;
                        state = 0;
                        arg = '';
                    }
                    else if (c === '{') {
                        nest++;
                        arg += c;
                    }
                    else if (c === '}') {
                        nest--;
                        arg += c;
                    }
                    else
                        arg += c;
                    break;
                case ParseState.paramsPEscape:
                    if (c === '{')
                        tmp2 = '%{';
                    else if (c === escChar)
                        tmp2 = '%' + escChar;
                    else {
                        tmp2 = '%' + escChar;
                        idx--;
                    }
                    if (eAlias && findAlias)
                        alias += tmp2;
                    else
                        str += tmp2;
                    state = ParseState.none;
                    break;
                case ParseState.paramsD:
                    if (c === '{')
                        state = ParseState.paramsDBlock;
                    else if (eEscape && c === escChar)
                        state = ParseState.paramsDEscape;
                    else if (!this.stack.named || c.match(/[^a-zA-Z_$]/g)) {
                        state = ParseState.none;
                        idx--;
                        if (eAlias && findAlias)
                            alias += '$';
                        else
                            str += '$';
                    }
                    else {
                        arg = c;
                        state = ParseState.paramsDNamed;
                    }
                    break;
                case ParseState.paramsDNamed:
                    if (c.match(/[^a-zA-Z0-9_]/g)) {
                        if (this.stack.named.hasOwnProperty(arg)) {
                            if (eAlias && findAlias)
                                alias += this.stack.named[arg];
                            else
                                str += this.stack.named[arg];
                        }
                        idx--;
                        state = ParseState.none;
                        arg = '';
                    }
                    else
                        arg += c;
                    break;
                case ParseState.paramsDEscape:
                    if (c === '{')
                        tmp2 = `\${`;
                    else if (c === escChar)
                        tmp2 = '$' + escChar;
                    else {
                        tmp2 = '$' + escChar;
                        idx--;
                    }
                    if (eAlias && findAlias)
                        alias += tmp2;
                    else
                        str += tmp2;
                    state = ParseState.none;
                    break;
                case ParseState.paramsDBlock:
                    if (c === '}' && nest === 0) {
                        tmp2 = null;
                        if (arg === 'i')
                            tmp2 = window.repeatnum;
                        else if (arg === 'repeatnum')
                            tmp2 = window.repeatnum;
                        else if (this.stack.args && arg === '*') {
                            tmp2 = this.stack.args.slice(1).join(' ');
                            this.stack.used = this.stack.args.length;
                        }
                        else if (this.stack.named && this.stack.named.hasOwnProperty(arg))
                            tmp2 = this.stack.named[arg];
                        else {
                            if (args && !isNaN(arg)) {
                                arg = parseInt(arg, 10);
                                if (arg < 0) {
                                    tmp2 = this.stack.args.slice(arg).join(' ');
                                    this.stack.used = this.stack.args.length;
                                }
                                else {
                                    tmp2 = this.stack.args[arg];
                                    if (arg > this.stack.used)
                                        this.stack.used = arg;
                                }
                            }
                            else {
                                c = this.parseVariable(arg);
                                if (c != null)
                                    tmp2 = c;
                                else if (this.client.options.allowEval) {
                                    if (this.stack.named)
                                        tmp2 = '' + mathjs.eval(this.parseOutgoing(arg), Object.assign({ i: window.repeatnum || 0, repeatnum: window.repeatnum || 0 }, this.stack.named));
                                    else
                                        tmp2 = '' + mathjs.eval(this.parseOutgoing(arg), { i: window.repeatnum || 0, repeatnum: window.repeatnum || 0 });
                                }
                                else {
                                    tmp2 = '$';
                                    idx = idx - arg.length - 2;
                                }
                            }
                        }
                        if (tmp2 != null && eAlias && findAlias)
                            alias += tmp2;
                        else if (tmp2 != null)
                            str += tmp2;
                        state = ParseState.none;
                        arg = '';
                    }
                    else if (c === '{') {
                        nest++;
                        arg += c;
                    }
                    else if (c === '}') {
                        nest--;
                        arg += c;
                    }
                    else
                        arg += c;
                    break;
                case ParseState.escape:
                    if (c === escChar || c === stackingChar || c === verbatimChar || c === spChar)
                        tmp2 = c;
                    else if ('$%"\'{'.indexOf(c) !== -1)
                        tmp2 = c;
                    else
                        tmp2 = escChar + c;
                    if (eAlias && findAlias)
                        alias += tmp2;
                    else
                        str += tmp2;
                    state = ParseState.none;
                    break;
                case ParseState.verbatim:
                    if (c === '\n') {
                        state = ParseState.none;
                        out += str + c;
                        str = '';
                        start = true;
                    }
                    else {
                        str += c;
                        start = false;
                    }
                    break;
                default:
                    if (eEscape && c === escChar) {
                        state = ParseState.escape;
                        start = false;
                        continue;
                    }
                    else if (c === '%') {
                        state = ParseState.paramsP;
                        _neg = false;
                        arg = '';
                        start = false;
                    }
                    else if (c === '$') {
                        state = ParseState.paramsD;
                        _neg = false;
                        arg = '';
                        start = false;
                    }
                    else if (eCmd && start && c === cmdChar) {
                        state = ParseState.function;
                        start = false;
                    }
                    else if (eVerbatim && start && c === verbatimChar) {
                        state = ParseState.verbatim;
                        start = false;
                    }
                    else if (ePaths && start && c === spChar) {
                        state = ParseState.path;
                        start = false;
                    }
                    else if (c === '"' && pd) {
                        if (eAlias && findAlias)
                            alias += c;
                        else
                            str += c;
                        state = ParseState.doubleQuoted;
                        start = false;
                    }
                    else if (c === '\'' && ps) {
                        if (eAlias && findAlias)
                            alias += c;
                        else
                            str += c;
                        state = ParseState.singleQuoted;
                        start = false;
                    }
                    //if looking for an alias and a space check
                    else if (eAlias && findAlias && c === ' ') {
                        AliasesCached = FilterArrayByKeyValue(aliases, 'pattern', alias);
                        //are aliases enabled and does it match an alias?
                        if (AliasesCached.length > 0) {
                            //move to alias parsing
                            state = ParseState.aliasArguments;
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
                        if (eAlias && findAlias && alias.length > 0) {
                            AliasesCached = FilterArrayByKeyValue(aliases, 'pattern', alias);
                            //are aliases enabled and does it match an alias?
                            if (AliasesCached.length > 0) {
                                args.push(alias);
                                //move to alias parsing
                                al = AliasesCached.length;
                                for (a = 0; a < al; a++) {
                                    str = this.ExecuteAlias(AliasesCached[a], args);
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
                                str = this.ExecuteTriggers(TriggerType.CommandInputRegular, alias, false, true);
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
                            str = this.ExecuteTriggers(TriggerType.CommandInputRegular, str, false, true);
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
        if (state === ParseState.escape)
            str += escChar;
        else if (state === ParseState.paramsDNamed && arg.length > 0) {
            if (this.stack.named && this.stack.named[arg])
                str += this.stack.named[arg];
            else {
                arg = this.parseOutgoing(arg);
                str += '$';
                if (arg != null) str += arg;
            }
        }
        else if (state === ParseState.paramsP && arg.length > 0) {
            if (this.stack.args) {
                arg = parseInt(arg, 10);
                if (_neg && arg < this.stack.args.length)
                    str += this.stack.args.slice(arg).join(' ');
                else if (arg < this.stack.args.length)
                    str += this.stack.args[arg];
                if (_neg)
                    this.stack.used = this.stack.args.length;
                else if (arg > this.stack.used)
                    this.stack.used = arg;
            }
            else {
                arg = this.parseOutgoing(arg);
                str += '%';
                if (arg != null) str += arg;
            }
        }
        else if (state === ParseState.paramsPBlock) {
            arg = this.parseOutgoing(arg);
            str += '%{';
            if (arg != null) str += arg;
        }
        else if (state === ParseState.paramsD && arg.length > 0) {
            if (this.stack.args) {
                arg = parseInt(arg, 10);
                if (_neg && arg < this.stack.args.length)
                    str += this.stack.args.slice(arg).join(' ');
                else if (arg < this.stack.args.length)
                    str += this.stack.args[arg];
                if (_neg)
                    this.stack.used = this.stack.args.length;
                else if (arg > this.stack.used)
                    this.stack.used = arg;
            }
            else {
                arg = this.parseOutgoing(arg);
                str += '$';
                if (arg != null) str += arg;
            }
        }
        else if (state === ParseState.paramsDBlock) {
            arg = this.parseOutgoing(arg);
            str += `\${`;
            if (arg != null) str += arg;
        }
        else if (state === ParseState.path) {
            str = this.ProcessPath(str);
            if (str !== null) out += str;
            str = '';
        }
        if (this.stack.args && this.stack.append && this.stack.args.length - 1 > 0 && this.stack.used + 1 < this.stack.args.length) {
            let r = false;
            if (str.endsWith('\n')) {
                str = str.substring(0, str.length - 1);
                r = true;
            }
            if (!str.endsWith(' '))
                str += ' ';
            if (this.stack.used < 1)
                str += this.stack.args.slice(1).join(' ');
            else
                str += this.stack.args.slice(this.stack.used + 1).join(' ');
            if (r) str += '\n';
        }

        if (state === ParseState.function) {
            str = this.executeScript('#' + str);
            if (typeof str === 'number') {
                this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                if (out.length === 0) return null;
                return out;
            }
            if (str !== null) out += str;
            else if (out.length === 0) return null;
        }
        else if (state === ParseState.verbatim)
            out += str;
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
                    str = this.ExecuteAlias(AliasesCached[a], args);
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
                str = this.ExecuteTriggers(TriggerType.CommandInputRegular, alias, false, true);
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
            str = this.ExecuteTriggers(TriggerType.CommandInputRegular, alias, false, true);
            if (typeof str === 'number') {
                this.executeWait(text.substr(idx + 1), str, eAlias, stacking);
                if (out.length === 0) return null;
                return out;
            }
            if (str !== null) out += str;
            else if (out.length === 0) return null;
        }
        else if (str.length > 0) {
            str = this.ExecuteTriggers(TriggerType.CommandInputRegular, str, false, true);
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
        switch (text) {
            case 'esc':
                return '\x1b';
            case 'cr':
                return '\n';
            case 'lf':
                return '\r';
            case 'crlf':
                return '\r\n';
            case 'copied':
                return window.$copied;
            case 'copied.lower':
                return window.$copied.toLowerCase();
            case 'copied.upper':
                return window.$copied.toUpperCase();
            case 'copied.proper':
                return ProperCase(window.$copied);
            case 'i':
            case 'repeatnum':
                return window.repeatnum;
            case 'selected':
            case 'selectedurl':
            case 'selectedline':
            case 'selectedword':
            case 'selurl':
            case 'selline':
            case 'selword':
                return this.vStack['$' + text] || window['$' + text] || '';
            case 'selected.lower':
            case 'selectedurl.lower':
            case 'selectedline.lower':
            case 'selectedword.lower':
            case 'selurl.lower':
            case 'selline.lower':
            case 'selword.lower':
                return (this.vStack['$' + text.substr(0, text.length - 6)] || window['$' + text.substr(0, text.length - 6)] || '').toLowerCase();
            case 'selected.upper':
            case 'selectedurl.upper':
            case 'selectedline.upper':
            case 'selectedword.upper':
            case 'selurl.upper':
            case 'selline.upper':
            case 'selword.upper':
                return (this.vStack['$' + text.substr(0, text.length - 6)] || window['$' + text.substr(0, text.length - 6)] || '').toUpperCase();
            case 'selected.proper':
            case 'selectedurl.proper':
            case 'selectedline.proper':
            case 'selectedword.proper':
            case 'selurl.proper':
            case 'selline.proper':
            case 'selword.proper':
                return ProperCase(this.vStack['$' + text.substr(0, text.length - 7)] || window['$' + text.substr(0, text.length - 7)]);
        }
        const re = new RegExp('^([a-zA-Z]+)\\((.*)\\)$', 'g');
        let res = re.exec(text);
        if (!res || !res.length) return null;
        let c;
        let sides;
        let mod;
        let args;
        let min;
        let max;
        switch (res[1]) {
            case 'time':
                if (res[2] && res[2].length > 0)
                    return moment().format(res[2]);
                return moment().format();
            case 'lower':
                return this.parseOutgoing(res[2]).toLowerCase();
            case 'upper':
                return this.parseOutgoing(res[2]).toUpperCase();
            case 'proper':
                return ProperCase(this.parseOutgoing(res[2]));
            case 'eval':
                return '' + mathjs.eval(this.parseOutgoing(res[2]), { i: window.repeatnum || 0, repeatnum: window.repeatnum || 0 });
            case 'dice':
                args = this.parseOutgoing(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice');
                if (args.length === 1) {
                    res = /(\d+)d(F|f|%|\d+)([-|+|*|/]?\d+)?/g.exec(args[0]);
                    if (!res || res.length < 3) return null;
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = parseInt(args[0]);
                    sides = args[1].trim();
                    if (args.length > 2)
                        mod = args[2].trim();
                }
                else
                    throw new Error('Too many arguments');

                if (sides === 'F' || sides === 'f')
                    sides = 'F';
                else if (sides === '%')
                    sides = 100;
                else
                    sides = parseInt(sides);

                let sum = 0;
                for (let i = 0; i < c; i++) {
                    if (sides === 'F')
                        sum += fudgeDice();
                    else if (sides === '%')
                        sum += ~~(Math.random() * 100) + 1;
                    else
                        sum += ~~(Math.random() * sides) + 1;
                }
                if (sides === '%')
                    sum /= 100;
                if (mod)
                    return mathjs.eval(sum + mod);
                return '' + sum;
            case 'diceavg':
                //The average of any XdY is X*(Y+1)/2.
                //(min + max) / 2 * a + m
                args = this.parseOutgoing(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice');
                if (args.length === 1) {
                    res = /(\d+)d(F|f|%|\d+)([-|+|*|/]?\d+)?/g.exec(args[0]);
                    if (!res || res.length < 3) return null;
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = parseInt(args[0]);
                    sides = args[1].trim();
                    if (args.length > 2)
                        mod = args[2].trim();
                }
                else
                    throw new Error('Too many arguments');
                min = 1;
                if (sides === 'F' || sides === 'f') {
                    min = -1;
                    max = 1;
                }
                else if (sides === '%') {
                    min = 0;
                    max = 1;
                }
                else
                    max = parseInt(sides);

                if (mod)
                    return mathjs.eval(((min + max) / 2 * c) + mod);
                return '' + ((min + max) / 2 * c);
            case 'dicemin':
                args = this.parseOutgoing(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice');
                if (args.length === 1) {
                    res = /(\d+)d(F|f|%|\d+)([-|+|*|/]?\d+)?/g.exec(args[0]);
                    if (!res || res.length < 3) return null;
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = parseInt(args[0]);
                    sides = args[1].trim();
                    if (args.length > 2)
                        mod = args[2];
                }
                else
                    throw new Error('Too many arguments');
                min = 1;
                if (sides === 'F' || sides === 'f')
                    min = -1;
                else if (sides === '%')
                    min = 0;
                else
                    sides = parseInt(sides);

                if (mod)
                    return mathjs.eval((min * c) + mod);
                return '' + (min * c);
            case 'dicemax':
                args = this.parseOutgoing(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice');
                if (args.length === 1) {
                    res = /(\d+)d(F|f|%|\d+)([-|+|*|/]?\d+)?/g.exec(args[0]);
                    if (!res || res.length < 3) return null;
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = parseInt(args[0]);
                    sides = args[1].trim();
                    if (args.length > 2)
                        mod = args[2].trim();
                }
                else
                    throw new Error('Too many arguments');

                if (sides === 'F' || sides === 'f')
                    max = 1;
                else if (sides === '%')
                    max = 1;
                else
                    max = parseInt(sides);
                if (mod)
                    return mathjs.eval((max * c) + mod);
                return '' + (max * c);
            case 'zdicedev':
            case 'dicedev':
                const fun = res[1];
                args = this.parseOutgoing(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice');
                if (args.length === 1) {
                    res = /(\d+)d(F|f|%|\d+)([-|+|*|/]?\d+)?/g.exec(args[0]);
                    if (!res || res.length < 3) return null;
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = parseInt(args[0]);
                    sides = args[1].trim();
                    if (args.length > 2)
                        mod = args[2].trim();
                }
                else
                    throw new Error('Too many arguments');

                if (sides === 'F' || sides === 'f')
                    max = 6;
                else if (sides === '%')
                    max = 1;
                else
                    max = parseInt(sides);

                //zmud formula seems to be 0 index based
                if (fun === 'zdicedev')
                    max--;
                if (mod)
                    return mathjs.eval(Math.sqrt((max * max - 1) / 12 * c) + mod);
                return '' + Math.sqrt((max * max - 1) / 12 * c);
        }
        return null;
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
                this._stack.push({ args: args, named: this.GetNamedArguments(alias.params, args), append: alias.append, used: 0 });
                ret = this.parseOutgoing(alias.value);
                this._stack.pop();
                break;
            case 2:
                /*jslint evil: true */
                const f = new Function('try { ' + alias.value + '} catch (e) { if(this.options.showScriptErrors) this.error(e);}');
                ret = f.apply(this.client, this.GetNamedArguments(alias.params, args, alias.append));
                if (typeof ret === 'string')
                    ret = this.parseOutgoing(ret);
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
        //scope to get performance
        const triggers = this._TriggerCache;
        const tl = triggers.length;
        for (; t < tl; t++) {
            const trigger = triggers[t];
            if (trigger.type !== undefined && trigger.type !== type) continue;
            if (frag && !trigger.triggerPrompt) continue;
            if (!frag && !trigger.triggerNewline && (trigger.triggerNewline !== undefined))
                continue;
            if (trigger.verbatim) {
                if (!trigger.caseSensitive && raw.toLowerCase() !== trigger.pattern.toLowerCase()) continue;
                else if (trigger.caseSensitive && raw !== trigger.pattern) continue;
                if (ret)
                    return this.ExecuteTrigger(trigger, [raw], true, t);
                this.ExecuteTrigger(trigger, [raw], false, t);
            }
            else {
                try {
                    let re;
                    if (trigger.caseSensitive)
                        re = new RegExp(trigger.pattern, 'g');
                    else
                        re = new RegExp(trigger.pattern, 'gi');
                    const res = re.exec(raw);
                    if (!res || !res.length) continue;
                    if (ret)
                        return this.ExecuteTrigger(trigger, res, true, t);
                    this.ExecuteTrigger(trigger, res, false, t);
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

    public ExecuteTrigger(trigger, args, r: boolean, idx) {
        if (r == null) r = false;
        if (!trigger.enabled) return '';
        let ret; // = '';
        switch (trigger.style) {
            case 1:
                this._stack.push({ args: args, named: [], used: 0 });
                ret = this.parseOutgoing(trigger.value);
                this._stack.pop();
                break;
            case 2:
                //do not cache temp triggers
                if (trigger.temp) {
                    ret = new Function('try { ' + trigger.value + '} catch (e) { if(this.options.showScriptErrors) this.error(e);}');
                    ret = ret.apply(this.client, args);
                }
                else {
                    if (!this._TriggerFunctionCache[idx])
                        /*jslint evil: true */
                        this._TriggerFunctionCache[idx] = new Function('try { ' + trigger.value + '} catch (e) { if(this.options.showScriptErrors) this.error(e);}');
                    ret = this._TriggerFunctionCache[idx].apply(this.client, args);
                }
                if (typeof ret === 'string')
                    ret = this.parseOutgoing(ret);
                break;
            default:
                ret = trigger.value;
                break;
        }
        if (trigger.temp) {
            if (idx >= 0)
                this._TriggerCache.splice(idx, 1);
            this.client.removeTrigger(trigger);
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
                return a.enabled && a.type !== TriggerType.Alarm;
            });
        }
    }

    public clearCaches() {
        this._TriggerCache = null;
        this._TriggerFunctionCache = {};
        this._gamepadCaches = null;
        this._lastSuspend = -1;
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
            if (this._TriggerCache[t].caseSensitive && event !== this._TriggerCache[t].pattern) continue;
            if (!this._TriggerCache[t].caseSensitive && event.toLowerCase() !== this._TriggerCache[t].pattern.toLowerCase()) continue;
            this.ExecuteTrigger(this._TriggerCache[t], args, false, t);
        }
    }

    public executeWait(text, delay: number, eAlias?: boolean, stacking?: boolean) {
        if (!text || text.length === 0) return;
        const s = { args: 0, named: 0, used: this.stack.used, append: this.stack.append };
        if (this.stack.args)
            s.args = this.stack.args.slice();
        if (this.stack.named)
            s.named = this.stack.named.slice();

        if (delay < 0)
            delay = 0;
        setTimeout(() => {
            this._stack.push(s);
            let ret = this.parseOutgoing(text, eAlias, stacking);
            this._stack.pop();
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

    public stripQuotes(str: string) {
        if (!str || str.length === 0)
            return str;
        if (this.client.options.parseDoubleQuotes)
            str = str.replace(/^\"(.*)\"$/g, (v, e, w) => {
                return e.replace(/\\\"/g, '"');
            });
        if (this.client.options.parseSingleQuotes)
            str = str.replace(/^\'(.*)\'$/g, (v, e, w) => {
                return e.replace(/\\\'/g, '\'');
            });
        return str;
    }
}