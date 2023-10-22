//spell-checker:ignore triggerprompt, idletime, connecttime, soundinfo, musicinfo, playmusic, playm, playsound, stopmusic, stopm, stopsound
//spell-checker:ignore stopallsound, stopa, showprompt, showp, sayprompt, sayp, echoprompt, echop, unalias, setsetting, getsetting, profilelist
//spell-checker:ignore keycode repeatnum chatp chatprompt untrigger unevent nocr timepattern ungag showclient showcl hideclient hidecl toggleclient
//spell-checker:ignore togglecl raiseevent raisedelayed raisede diceavg dicemin dicemax zdicedev dicedev zmud
//spell-checker:ignore testfile testspeedfile testspeedfiler nosend printprompt printp pcol forall stringlist zcolor ipos trimleft trimright
//spell-checker:ignore bitand bitnot bitor bitshift bittest bitnum bitxor isfloat isnumber isdefined charcomment charnotes cmdpattern loopexpression
//spell-checker:ignore reparse reparsepattern looplines looppattern withinlines sendraw sendprompt sendp stripansi clientname speakstop speakpause speakresume
//spell-checker:ignore LOOPEXPRSSION COMMANDINPUTPATTERN COMMANDINPUTREGULAR REGULAREXPRESSION COMMANDINPUTREGULAREXPRESSION COMMANDINPUTREGULAR
/// <reference types="mathjs" />
import { EventEmitter } from 'events';
import { MacroModifiers, MacroDisplay, Alias, Trigger, Button, Profile, TriggerType, TriggerTypes, SubTriggerTypes, convertPattern } from './profile';
import { getTimeSpan, FilterArrayByKeyValue, SortItemArrayByPriority, clone, parseTemplate, isFileSync, isDirSync, splitQuoted, isValidIdentifier, fileSizeSync, getCursor } from './library';
import { Client } from './client';
import { Tests } from './test';
import { NewLineType, ProfileSaveType, ScriptEngineType, TabCompletion } from './types';
import { SettingList } from './settings';
import { getAnsiColorCode, getColorCode, isMXPColor, getAnsiCode } from './ansi';

declare let getCharacterNotes;
declare let getId;
declare let getName;
declare let clearName;
declare let resizeCommandInput;
declare let setMapFile;

/**
 * MATHJS expression engine
 * @constant
 * @type {object}
 */
let mathjs;
let _mathjs;
/**
 * Buzz sound library
 * @type {object}
 * @constant
 */
const buzz = require('buzz');
/**
 * Node path object
 * @type {object}
 * @constant
 */
const path = require('path');
/**
 * Moment time format and manipulation
 * @type {object}
 * @constant
 */
const moment = require('moment');
/**
 * Node file system
 * @type {object}
 * @constant
 */
const fs = require('fs');

const WindowVariables = ['$selectedword', '$selword', '$selectedurl', '$selurl', '$selectedline', '$selline', '$selected', '$character', '$copied', '$action', '$trigger', '$caption', '$characterid'];

/**
 * Return the proper case of a string for each word
 * @param {string} str - The string to proper capitalize each word of
 * @returns {string}
 */
function ProperCase(str) {
    return str.replace(/\w*\S*/g, (txt) => { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

/**
 * Return a fudge dice random value
 * @returns {number} Returns -1, 1 or 0 randomly
 */
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

/**
 * Enum for input parse state
 * @readonly
 * @enum {number}
 */
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
    paramsPNamed = 26,
    paramsN = 11,
    paramsNBlock = 12,
    paramsNEscape = 13,
    paramsNNamed = 14,
    escape = 15,
    verbatim = 16,
    aliasArgumentsEscape = 17,
    pathEscape = 18,
    functionEscape = 19,
    comment = 20,
    inlineCommentStart = 21,
    inlineComment = 22,
    blockCommentStart = 23,
    blockComment = 24,
    blockCommentEnd = 25
}

/**
 * Type of trigger ot test for
 */
enum TriggerTypeFilter {
    Main = 1,
    Sub = 2,
    All = 3
}

/**
 * Command input parser
 * 
 * @class Input
 * @extends {EventEmitter}
 * @param {Object} client - the mud client object
 */
export class Input extends EventEmitter {
    private _historyIdx: number = -1;
    private _tabIdx: number = -1;
    private _tabWords: string[] = null;;
    private _tabSearch: any;
    private _commandHistory: string[];
    private _locked: number = 0;
    private _tests: Tests;
    private _TriggerCache: Trigger[] = null;
    private _TriggerStates = {};
    private _TriggerFunctionCache = {};
    private _TriggerRegExCache = {};
    private _LastTriggered = '';
    private _LastTrigger = null;
    private _scrollLock: boolean = false;
    private _gag: number = 0;
    private _gagID: NodeJS.Timeout[] = [];
    private _gags: any[] = [];
    private _stack = [];
    private _vStack = [];
    private _controllers = {};
    private _controllersCount = 0;
    private _gamepadCaches = null;
    private _lastSuspend = -1;
    private _MacroCache = {};
    private _loops: number[] = [];
    private _pathQueue = [];
    private _pathTimeout: NodeJS.Timeout = null;
    private _pathPaused: boolean = false;

    public client: Client = null;
    public enableParsing: boolean = true;
    public enableTriggers: boolean = true;

    public getScope() {
        let scope: any = {};
        Object.assign(scope, this.client.variables);
        WindowVariables.forEach((a) => {
            scope[a] = window[a];
            scope[a.substr(1)] = window[a];
        });
        scope['clientid'] = getId();
        //if no stack use direct for some performance
        if (this._stack.length === 0)
            return scope;
        if (!this.stack.named && !this.loops.length)
            return scope;
        if (this.stack.named)
            Object.assign(scope, this.stack.named);
        if (this.loops.length) {
            scope.repeatnum = this.repeatnum;
            const ll = this.loops.length;
            //i to z only
            for (let l = 0; l < ll && l < 18; l++)
                scope[String.fromCharCode(105 + l)] = this.loops[l];
        }
        //scope.i = this.repeatnum;
        //scope.repeatnum = this.repeatnum;
        return scope;
    }

    public setScope(scope) {
        //if same object no need to update
        if (scope === this.client.variables) return;
        const ll = this.loops.length;
        for (const name in scope) {
            //not a property, i or repeatnum
            if (!Object.prototype.hasOwnProperty.call(scope, name) || name === 'i' || name === 'repeatnum')
                continue;
            if (WindowVariables.indexOf(name) !== -1 || WindowVariables.indexOf('$' + name) !== -1)
                continue;
            switch (name) {
                case 'clientid':
                    continue;
            }
            //if i to z and the loop exist skip it
            if (name.length === 1 && ll && name.charCodeAt(0) >= 105 && name.charCodeAt(0) < 105 + ll)
                continue;
            //part of the named arguments so skip
            if (this.stack.named && Object.prototype.hasOwnProperty.call(this.stack.named, name))
                continue;
            //update/add new variables
            this.client.variables[name] = scope[name];
        }
    }

    public evaluate(expression) {
        let scope = this.getScope();
        let results = mathjs().evaluate(expression, scope);
        this.setScope(scope);
        return results;
    }

    get stack() {
        if (this._stack.length === 0)
            this._stack.push({ args: 0, named: 0, used: 0, append: false });
        return this._stack[this._stack.length - 1];
    }

    get repeatnum() {
        if (this.loops.length === 0)
            return 0;
        return this.loops[this.loops.length - 1];
    }

    get loops() {
        if (this._stack.length === 0 || !this.stack.hasOwnProperty('loops'))
            return this._loops;
        return this.stack.loops;
    }

    get regex() {
        let sl = this._stack.length;
        if (sl === 0)
            return null;
        while (sl >= 0) {
            sl--;
            if (this._stack[sl].hasOwnProperty('regex'))
                return this._stack[sl].regex;
        }
        return null;
    }

    get indices() {
        let sl = this._stack.length;
        if (sl === 0)
            return [];
        while (sl >= 0) {
            sl--;
            if (this._stack[sl].hasOwnProperty('indices'))
                return this._stack[sl].indices;
        }
        return [];
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

    get lastTriggerExecuted() {
        return this._LastTrigger;
    }

    get lastTriggered() {
        return this._LastTriggered;
    }

    set lastTriggered(value) {
        this._LastTriggered = value;
    }

    private getDiceArguments(arg, scope, fun) {
        let res = /(\d+)\s*?d(F|f|%|\d+)(\s*?[-|+|*|\/]?\s*?\d+)?/g.exec(arg.toString());
        if (!res || res.length < 3) {
            res = /(\d+)\s*?d\s*?\/\s*?(100)(\s*?[-|+|*|\/]?\s*?\d+)?/g.exec(arg.toString());
            if (!res || res.length < 3) {
                //if failed with raw args try compiling and processing in case a variable or expression to build a string
                arg = arg.compile().evaluate(scope);
                res = /(\d+)\s*?d(F|f|%|\d+)(\s*?[-|+|*|\/]?\s*?\d+)?/g.exec(arg.toString());
                if (!res || res.length < 3) {
                    //check for % dice
                    res = /(\d+)\s*?d\s*?\/\s*?(100)(\s*?[-|+|*|\/]?\s*?\d+)?/g.exec(arg.toString());
                    if (!res || res.length < 3)
                        throw new Error('Invalid dice for ' + (fun || 'dice'));
                    res[2] = '%';
                }
            }
            else
                res[2] = '%';
        }
        return res;
    }

    private initMathJS() {
        //use minified mathjs instead of default module for performance loading
        let create, all, factory, mathEngine;
        if (this.client.getOption('scriptEngineType') === ScriptEngineType.Full)
            mathEngine = require('mathjs');
        else if (this.client.getOption('scriptEngineType') === ScriptEngineType.Simple)
            mathEngine = require('mathjs/number');
        else
            mathEngine = require('./../../node_modules/mathjs/lib/browser/math');
        create = mathEngine.create;
        all = mathEngine.all;
        factory = mathEngine.factory;
        //const { create, all, factory } = require('./../../node_modules/mathjs/lib/browser/math'); //slow but overall fastest version and kept up today
        //import {create, all, factory} from 'mathjs'; //nearly 4.5 times slower then browser version

        /**
         * Contains custom operator overrides functions for MATHJS to add string support
         * @constant
         * @type {object}
         * 
         */
        const allWithCustomFunctions = {
            ...all,

            createEqual: factory('equal', [], () => function equal(a, b) {
                return a === b
            }),

            createUnequal: factory('unequal', [], () => function unequal(a, b) {
                return a !== b
            }),

            createSmaller: factory('smaller', [], () => function smaller(a, b) {
                return a < b
            }),

            createSmallerEq: factory('smallerEq', [], () => function smallerEq(a, b) {
                return a <= b
            }),

            createLarger: factory('larger', [], () => function larger(a, b) {
                return a > b
            }),

            createLargerEq: factory('largerEq', [], () => function largerEq(a, b) {
                return a >= b
            }),

            createCompare: factory('compare', [], () => function compare(a, b) {
                return a > b ? 1 : a < b ? -1 : 0
            }),

            createAdd: factory('add', [], () => function add(a, b) {
                return a + b
            })
        };

        /**
         * MATHJS expression engine
         * @constant
         * @type {object}
         */
        _mathjs = create(allWithCustomFunctions, {});
        const functions = {
            esc: '\x1b',
            cr: '\n',
            lf: '\r',
            crlf: '\r\n',
            diceavg: (args, math, scope) => {
                let res;
                let c;
                let sides;
                let mod;
                let min;
                let max;
                if (args.length === 0) throw new Error('Invalid arguments for diceavg');
                if (args.length === 1) {
                    res = this.getDiceArguments(args[0], scope, 'diceavg');
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = args[0].compile().evaluate(scope);
                    sides = args[1].toString().trim();
                    if (sides !== 'F' && sides !== '%')
                        sides = args[1].compile().evaluate(scope);
                    if (args.length > 2)
                        mod = args[2].compile().evaluate(scope);
                }
                else
                    throw new Error('Too many arguments for diceavg');
                min = 1;
                if (sides === 'F' || sides === 'f') {
                    min = -1;
                    max = 1;
                }
                else if (sides === '%') {
                    max = 1;
                    min = 0;
                }
                else
                    max = parseInt(sides);

                if (mod)
                    return math.evaluate(((min + max) / 2 * c) + mod, scope);
                return (min + max) / 2 * c;
            },
            dicemin: (args, math, scope) => {
                let res;
                let c;
                let sides;
                let mod;
                let min;
                if (args.length === 0) throw new Error('Invalid arguments for dicemin');
                if (args.length === 1) {
                    res = res = this.getDiceArguments(args[0], scope, 'dicemin');
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = args[0].compile().evaluate(scope);
                    sides = args[1].toString().trim();
                    if (sides !== 'F' && sides !== '%')
                        sides = args[1].compile().evaluate(scope);
                    if (args.length > 2)
                        mod = args[2].compile().evaluate(scope);
                }
                else
                    throw new Error('Too many arguments for dicemin');
                min = 1;
                if (sides === 'F' || sides === 'f')
                    min = -1;
                else if (sides === '%')
                    min = 0;
                if (mod)
                    return math.evaluate((min * c) + mod, scope);
                return min * c;
            },
            dicemax: (args, math, scope) => {
                let res;
                let c;
                let sides;
                let mod;
                let max;
                if (args.length === 0) throw new Error('Invalid arguments for dicemax');
                if (args.length === 1) {
                    res = this.getDiceArguments(args[0], scope, 'dicemax');
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = args[0].compile().evaluate(scope);
                    sides = args[1].toString().trim();
                    if (sides !== 'F' && sides !== '%')
                        sides = args[1].compile().evaluate(scope);
                    if (args.length > 2)
                        mod = args[2].compile().evaluate(scope);
                }
                else
                    throw new Error('Too many arguments for dicemax');
                if (sides === 'F' || sides === 'f')
                    max = 1;
                else if (sides === '%')
                    max = 1;
                else
                    max = parseInt(sides);

                if (mod)
                    return math.evaluate((max * c) + mod, scope);
                return max * c;
            },
            dicedev: (args, math, scope) => {
                let res;
                let c;
                let sides;
                let mod;
                let max;
                if (args.length === 0) throw new Error('Invalid arguments for dicedev');
                if (args.length === 1) {
                    res = this.getDiceArguments(args[0], scope, 'dicedev');
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = args[0].compile().evaluate(scope);
                    sides = args[1].toString().trim();
                    if (sides !== 'F' && sides !== '%')
                        sides = args[1].compile().evaluate(scope);
                    if (args.length > 2)
                        mod = args[2].compile().evaluate(scope);
                }
                else
                    throw new Error('Too many arguments for dicedev');
                if (sides === 'F' || sides === 'f')
                    max = 6;
                else if (sides === '%')
                    max = 1;
                else
                    max = parseInt(sides);
                if (mod)
                    return math.evaluate(Math.sqrt(((max * max) - 1) / 12 * c) + mod, scope);
                return Math.sqrt(((max * max) - 1) / 12 * c);
            },
            zdicedev: (args, math, scope) => {
                let res;
                let c;
                let sides;
                let mod;
                let max;
                if (args.length === 0) throw new Error('Invalid arguments for zdicedev');
                if (args.length === 1) {
                    res = this.getDiceArguments(args[0], scope, 'zdicedev');
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length < 4) {
                    c = args[0].compile().evaluate(scope);
                    sides = args[1].toString().trim();
                    if (sides !== 'F' && sides !== '%')
                        sides = args[1].compile().evaluate(scope);
                    if (args.length > 2)
                        mod = args[2].compile().evaluate(scope);
                }
                else
                    throw new Error('Too many arguments for zdicedev');
                if (sides === 'F' || sides === 'f')
                    max = 6;
                else if (sides === '%')
                    max = 1;
                else
                    max = parseInt(sides);
                max--;
                if (mod)
                    return math.evaluate(Math.sqrt(((max * max) - 1) / 12 * c) + mod, scope);
                return Math.sqrt(((max * max) - 1) / 12 * c);
            },
            dice: (args, math, scope) => {
                let res;
                let c;
                let sides;
                let mod;
                if (args.length === 1) {
                    res = this.getDiceArguments(args[0], scope, 'dice');
                    c = parseInt(res[1]);
                    sides = res[2];
                    if (res.length > 3)
                        mod = res[3];
                }
                else if (args.length > 1) {
                    c = args[0].compile().evaluate(scope);
                    sides = args[1].toString().trim();
                    if (sides !== 'F' && sides !== '%')
                        sides = args[1].compile().evaluate(scope);
                    if (args.length > 2)
                        mod = args[2].compile().evaluate(scope);
                }
                else
                    throw new Error('Invalid arguments for dice');
                let sum = 0;
                for (let i = 0; i < c; i++) {
                    if (sides === 'F' || sides === 'f')
                        sum += fudgeDice();
                    else if (sides === '%')
                        sum += ~~(Math.random() * 100.0) + 1.0;
                    else
                        sum += ~~(Math.random() * sides) + 1;
                }
                if (sides === '%')
                    sum /= 100.0;
                if (mod)
                    return math.evaluate(sum + mod, scope);
                return sum;
            },
            isdefined: (args, math, scope) => {
                if (args.length === 1) {
                    args[0] = this.stripQuotes(args[0].toString());
                    if (this.client.variables.hasOwnProperty(args[0]))
                        return 1;
                    if (scope.has(args[0]))
                        return 1;
                    return 0;
                }
                throw new Error('Invalid arguments for isdefined');
            },
            defined: (args, math, scope) => {
                let sides;
                if (args.length === 0)
                    throw new Error('Missing arguments for defined');
                else if (args.length === 1) {
                    args[0] = this.stripQuotes(args[0], true);
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0) return 0;
                    //have to check each profile as the client only caches enabled items for speed
                    for (; k < kl; k++) {
                        sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].aliases);
                        sides = sides.find(i => {
                            return i.pattern === args[0];
                        });
                        if (sides) return 1;
                        sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                        sides = sides.find(i => {
                            return i.pattern === args[0] || i.name === args[0];
                        });
                        if (sides) return 1;
                        sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].macros);
                        sides = sides.find(i => {
                            return MacroDisplay(i).toLowerCase() === args[0].toLowerCase() || i.name === args[0];
                        });
                        if (sides) return 1;
                        sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].aliases);
                        sides = sides.find(i => {
                            return i.caption === args[0] || i.name === args[0]
                        });
                        if (sides) return 1;
                    }
                    return this.client.variables.hasOwnProperty(args[0]);
                }
                else if (args.length === 2) {
                    args[0] = this.stripQuotes(args[0].toString());
                    args[0] = this.stripQuotes(args[1].toString());
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0) return 0;
                    //have to check each profile as the client only caches enabled items for speed
                    for (; k < kl; k++) {
                        switch (args[1]) {
                            case 'alias':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].aliases);
                                sides = sides.find(i => {
                                    return i.pattern === args[0];
                                });
                                if (sides) return 1;
                                return 0;
                            case 'event':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                sides = sides.find(i => {
                                    return i.type === TriggerType.Event && (i.pattern === args[0] || i.name === args[0]);
                                });
                                if (sides) return 1;
                                return 0;
                            case 'trigger':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                sides = sides.find(i => {
                                    return i.pattern === args[0] || i.name === args[0];
                                });
                                if (sides) return 1;
                                return 0;
                            case 'macro':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].macros);
                                sides = sides.find(i => {
                                    return MacroDisplay(i).toLowerCase() === args[0].toLowerCase() || i.name === args[0];
                                });
                                if (sides) return 1;
                                return 0;
                            case 'button':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].aliases);
                                sides = sides.find(i => {
                                    return i.caption === args[0] || i.name === args[0]
                                });
                                if (sides) return 1;
                                return 0;
                            //case 'variable':
                            //case 'path':
                            //case 'status':
                            //case 'class':
                            //case 'menu':                        
                            //case 'module':
                        }
                    }
                    if (args[1] === 'variable')
                        return this.client.variables.hasOwnProperty(args[0]) || scope.has(args[0]);
                }
                else
                    throw new Error('Too many arguments for defined');
                return 0;
            },
            time: (args, math, scope) => {
                if (args.length > 1)
                    throw new Error('Too many arguments for time');
                if (args.length)
                    return moment().format(args[0].compile().evaluate(scope));
                return moment().format();
            },
            clip: (args, math, scope) => {
                if (args.length > 1)
                    throw new Error('Too many arguments for clip');
                if (args.length) {
                    (<any>this.client).writeClipboard(args[0].compile().evaluate(scope));
                    return;
                }
                return (<any>this.client).readClipboard();
            },
            if: (args, math, scope) => {
                if (args.length < 3)
                    throw new Error('Missing arguments for if');
                if (args.length !== 3)
                    throw new Error('Too many arguments for if');

                if (args[0].compile().evaluate(scope))
                    return args[1].compile().evaluate(scope);
                return args[2].compile().evaluate(scope);
            },
            len: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for len');
                if (args.length !== 1)
                    throw new Error('Too many arguments for len');
                return args[0].compile().evaluate(scope).toString().length;
            },
            stripansi: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for len');
                if (args.length !== 1)
                    throw new Error('Too many arguments for len');
                const ansiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))', 'g')
                return args[0].compile().evaluate(scope).toString().replace(ansiRegex, '');
            },
            ansi: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for ansi');
                args = args.map(a =>
                    getAnsiCode(a.toString()) === -1 && a.toString() !== 'current' ? a.compile().evaluate(scope).toString() : a.toString()
                );
                const c = args.length;
                let mod = [];
                let min: any = {};
                let sides;
                let max;
                for (sides = 0; sides < c; sides++) {
                    if (args[sides].trim() === 'current')
                        mod.push(args[sides].trim());
                    else {
                        max = getAnsiCode(args[sides].trim());
                        if (max === -1)
                            throw new Error('Invalid color or style for ansi');
                        //style
                        if (max >= 0 && max < 30)
                            min[max] = 1;
                        //color
                        else
                            mod.push(args[sides]);
                    }
                }
                // fore,back
                if (mod.length > 2)
                    throw new Error('Too many colors for ansi');
                if (mod.length > 1) {
                    if (mod[1] === 'current')
                        mod[1] = '';
                    else
                        mod[1] = getAnsiCode(mod[1], true);
                }
                if (mod.length > 0) {
                    if (min[1] && mod[0] === 'white')
                        mod[0] = '';
                    else if (mod[0] === 'current')
                        mod[0] = '';
                    else
                        mod[0] = getAnsiCode(mod[0]);
                }

                min = [...Object.keys(min), ...mod]
                if (!min.length)
                    throw new Error('Invalid colors or styles for ansi');
                //remove any current flags
                min = min.filter(f => f !== '');
                return `\x1b[${min.join(';')}m`;
            },
            color: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for color');
                args = args.map(a =>
                    getAnsiCode(a.toString()) === -1 && a.toString() !== 'current' ? a.compile().evaluate(scope).toString() : a.toString()
                );
                let c;
                let sides;
                if (args.length === 1) {
                    if (args[0] === 'bold')
                        return '370';
                    c = getAnsiColorCode(args[0]);
                    if (c === -1)
                        throw new Error('Invalid fore color');
                    return c.toString();
                }
                else if (args.length === 2) {
                    if (args[0] === 'bold')
                        c = 370;
                    else {
                        c = getAnsiColorCode(args[0]);
                        if (c === -1)
                            throw new Error('Invalid fore color');
                        if (args[1] === 'bold')
                            return (c * 10).toString();
                    }
                    sides = c.toString();
                    c = getAnsiColorCode(args[1], true);
                    if (c === -1)
                        throw new Error('Invalid back color');
                    return sides + ',' + c.toString();
                }
                else if (args.length === 3) {
                    if (args[0] === 'bold') {
                        args.shift();
                        args.push('bold');
                    }
                    if (args[2] !== 'bold')
                        throw new Error('Only bold is supported as third argument for color');
                    c = getAnsiColorCode(args[0]);
                    if (c === -1)
                        throw new Error('Invalid fore color');
                    sides = (c * 10).toString();
                    c = getAnsiColorCode(args[1], true);
                    if (c === -1)
                        throw new Error('Invalid back color');
                    return sides + ',' + c.toString();
                }
                throw new Error('Too many arguments');
            },
            zcolor: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for zcolor');
                else if (args.length > 1)
                    throw new Error('Too many arguments for zcolor');
                return getColorCode(parseInt(args[0].compile().evaluate(scope), 10));
            },
            case: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for case');
                let i = args[0].compile().evaluate(scope);
                if (i > 0 && i < args.length)
                    return args[i].compile().evaluate(scope);
                return null;
            },
            switch: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for switch');
                if (args.length % 2 === 1)
                    throw new Error('All expressions must have a value for switch');
                let i = args.length
                for (let c = 0; c < i; c += 2) {
                    if (args[c].compile().evaluate(scope))
                        return args[c + 1].compile().evaluate(scope);
                }
                return null;
            },
            ascii: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for ascii');
                else if (args.length > 1)
                    throw new Error('Too many arguments for ascii');
                if (args[0].toString().trim().length === 0)
                    throw new Error('Invalid argument, empty string for ascii');
                return args[0].toString().trim().charCodeAt(0);
            },
            char: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for char');
                else if (args.length > 1)
                    throw new Error('Too many arguments for char');
                let c = args[0].compile().evaluate(scope);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0].toString() + '\' must be a number for char');
                return String.fromCharCode(c);
            },
            bitand: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for bitand');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bitand');
                let c = args[0].compile().evaluate(scope);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0].toString() + '\' must be a number for bitand');
                let sides = args[1].compile().evaluate(scope);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1].toString() + '\' must be a number for bitand');
                return c & sides;
            },
            bitnot: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for bitnot');
                else if (args.length !== 1)
                    throw new Error('Too many arguments for bitnot');
                let c = args[0].compile().evaluate(scope);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0].toString() + '\' must be a number for bitnot');
                return ~c;
            },
            bitor: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for bitor');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bitor');
                let c = args[0].compile().evaluate(scope);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0].toString() + '\' must be a number for bitor');
                let sides = args[1].compile().evaluate(scope);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1].toString() + '\' must be a number for bitor');
                return c | sides;
            },
            bitset: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for bitset');
                else if (args.length > 3)
                    throw new Error('Too many arguments for bitset');
                let c = args[0].compile().evaluate(scope);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0].toString() + '\' must be a number for bitset');
                let sides = args[1].compile().evaluate(scope);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1].toString() + '\' must be a number for bitset');
                sides--;
                let mod = 1;
                if (args.length === 3) {
                    mod = args[2].compile().evaluate(scope);
                    if (isNaN(mod))
                        throw new Error('Invalid argument \'' + args[2].toString() + '\' must be a number for bitset');
                }
                return (c & (~(1 << sides))) | ((mod ? 1 : 0) << sides);
            },
            bitshift: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for bitshift');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bitshift');
                let c = args[0].compile().evaluate(scope);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0].toString() + '\' must be a number for bitshift');
                let sides = args[1].compile().evaluate(scope);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1].toString() + '\' must be a number for bitshift');
                if (sides < 0)
                    return c >> -sides;
                return c << sides
            },
            bittest: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for bittest');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bittest');
                let c = args[0].compile().evaluate(scope);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0].toString() + '\' must be a number for bittest');
                let sides = args[1].compile().evaluate(scope);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1].toString() + '\' must be a number for bittest');
                sides--;
                return ((c >> sides) % 2 != 0) ? 1 : 0;
            },
            bitxor: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for bitxor');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bitxor');
                let c = args[0].compile().evaluate(scope);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0].toString() + '\' must be a number for bitxor');
                let sides = args[1].compile().evaluate(scope);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1].toString() + '\' must be a number for bitxor');
                return c ^ sides;
            },
            tonumber: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for number');
                else if (args.length > 1)
                    throw new Error('Too many arguments for number');
                args[0] = args[0].compile().evaluate(scope).toString();
                if (args[0].match(/^\s*?[-|+]?\d+\s*?$/))
                    return parseInt(args[0], 10);
                else if (args[0].match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                    return parseFloat(args[0]);
                else if (args[0] === "true")
                    return 1;
                else if (args[0] === "false")
                    return 0;
                return 0;
            },
            isfloat: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for isfloat');
                else if (args.length > 1)
                    throw new Error('Too many arguments for isfloat');
                args[0] = args[0].compile().evaluate(scope).toString();
                if (args[0].match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                    return 1;
                return 0;

            },
            isnumber: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for isnumber');
                else if (args.length > 1)
                    throw new Error('Too many arguments for isnumber');
                args[0] = args[0].compile().evaluate(scope).toString();
                if (args[0].match(/^\s*?[-|+]?\d+\s*?$/) || args[0].match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                    return 1;
                return 0;
            },
            tostring: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for string');
                else if (args.length > 1)
                    throw new Error('Too many arguments for string');
                return args[0].compile().evaluate(scope).toString();
            },
            float: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for float');
                else if (args.length > 1)
                    throw new Error('Too many arguments for float');
                args[0] = args[0].compile().evaluate(scope).toString();
                if (args[0].match(/^\s*?[-|+]?\d+\s*?$/) || args[0].match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                    return parseFloat(args[0]);
                else if (args[0] === "true")
                    return 1.0;
                else if (args[0] === "false")
                    return 0.0;
                return 0;
            },
            trim: (args, math, scope) => {
                if (args.length !== 1)
                    throw new Error('Missing arguments for trim');
                return args[0].compile().evaluate(scope).toString().trim();
            },
            trimleft: (args, math, scope) => {
                if (args.length !== 1)
                    throw new Error('Missing arguments for trimleft');
                return args[0].compile().evaluate(scope).toString().trimLeft();
            },
            trimright: (args, math, scope) => {
                if (args.length !== 1)
                    throw new Error('Missing arguments for trimright');
                return args[0].compile().evaluate(scope).toString().trimRight();
            },
            pos: (args, math, scope) => {
                if (args.length < 2)
                    throw new Error('Missing arguments for pos');
                else if (args.length > 2)
                    throw new Error('Too many arguments for pos');
                args[0] = args[0].compile().evaluate(scope).toString();
                args[1] = args[1].compile().evaluate(scope).toString();
                return args[1].indexOf(args[0]) + 1;
            },
            ipos: (args, math, scope) => {
                if (args.length < 2)
                    throw new Error('Missing arguments for pos');
                else if (args.length > 2)
                    throw new Error('Too many arguments for pos');
                args[0] = args[0].compile().evaluate(scope).toString().toLowerCase();
                args[1] = args[1].compile().evaluate(scope).toString().toLowerCase();
                return args[1].indexOf(args[0]) + 1;
            },
            ends: (args, math, scope) => {
                if (args.length < 2)
                    throw new Error('Missing arguments for ends');
                else if (args.length > 2)
                    throw new Error('Too many arguments for ends');
                args[0] = args[0].compile().evaluate(scope).toString().toLowerCase();
                args[1] = args[1].compile().evaluate(scope).toString().toLowerCase();
                return args[0].endsWith(args[1]);
            },
            begins: (args, math, scope) => {
                if (args.length < 2)
                    throw new Error('Missing arguments for begins');
                else if (args.length > 2)
                    throw new Error('Too many arguments for begins');
                args[0] = args[0].compile().evaluate(scope).toString().toLowerCase();
                args[1] = args[1].compile().evaluate(scope).toString().toLowerCase();
                return args[0].startsWith(args[1]);
            },
            alarm: (args, math, scope) => {
                let alarms;
                let a;
                let al;
                let t;
                let p;
                switch (args.length) {
                    case 0:
                        throw new Error('Missing arguments for alarm');
                    case 1:
                        args[0] = args[0].compile().evaluate(scope).toString();
                        alarms = this.client.alarms;
                        al = alarms.length;
                        if (al === 0)
                            throw new Error('No alarms set.');
                        a = 0;
                        for (; a < al; a++) {
                            //only main state counts here
                            if (alarms[a].type !== TriggerType.Alarm) continue;
                            if (alarms[a].name === args[0] || alarms[a].pattern === args[0]) {
                                if (alarms[a].suspended)
                                    return 0;
                                return this.client.getRemainingAlarmTime(a);
                            }
                        }
                        return;
                    case 2:
                        t = args[1].compile().evaluate(scope);
                        args[0] = args[0].compile().evaluate(scope).toString();
                        alarms = this.client.alarms;
                        al = alarms.length;
                        if (al === 0)
                            throw new Error('No alarms set.');
                        a = 0;
                        if (typeof t === 'string') {
                            for (; a < al; a++) {
                                //only main state counts here
                                if (alarms[a].type !== TriggerType.Alarm) continue;
                                if (alarms[a].name === args[0] || alarms[a].pattern === args[0]) {
                                    if (alarms[a].profile.name.toUpperCase() !== t.toUpperCase())
                                        continue;
                                    if (alarms[a].suspended)
                                        return 0;
                                    return this.client.getRemainingAlarmTime(a);
                                }
                            }
                            throw new Error('Alarm not found in profile: ' + t + '.');
                        }
                        else {
                            for (; a < al; a++) {
                                //only main state counts here
                                if (alarms[a].type !== TriggerType.Alarm) continue;
                                if (alarms[a].name === args[0] || alarms[a].pattern === args[0]) {
                                    if (!alarms[a].suspended)
                                        this.client.setAlarmTempTime(a, t);
                                    return t;
                                }
                            }
                            throw new Error('Alarm not found.');
                        }
                    case 3:
                        t = args[1].compile().evaluate(scope);
                        args[0] = args[0].compile().evaluate(scope).toString()
                        p = args[2].compile().evaluate(scope).toString();
                        alarms = this.client.alarms;
                        al = alarms.length;
                        if (al === 0)
                            throw new Error('No alarms set.');
                        a = 0;
                        for (; a < al; a++) {
                            //only main state counts here
                            if (alarms[a].type !== TriggerType.Alarm) continue;
                            if (alarms[a].name === args[0] || alarms[a].pattern === args[0]) {
                                if (alarms[a].profile.name.toUpperCase() !== p.toUpperCase())
                                    continue;
                                if (!alarms[a].suspended)
                                    this.client.setAlarmTempTime(a, t);
                                return t;
                            }
                        }
                        throw Error('Could not set time, alarm not found in profile: ' + args[2] + '.');
                }
                throw new Error('Too many arguments for alarm');
            },
            state: (args, math, scope) => {
                let trigger;
                if (args.length === 0)
                    throw new Error('Missing arguments for state');
                if (args.length > 2)
                    throw new Error('Too many arguments for state');
                args[0] = args[0].compile().evaluate(scope).toString();
                if (args.length === 1) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return null;
                    if (kl === 1) {
                        if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                            throw Error('No enabled profiles found!');
                        trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                        trigger = trigger.find(t => {
                            return t.name === args[0] || t.pattern === args[0];
                        });
                    }
                    else {
                        for (; k < kl; k++) {
                            if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                continue;
                            trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                            trigger = trigger.find(t => {
                                return t.name === args[0] || t.pattern === args[0];
                            });
                            if (trigger)
                                break;
                        }
                    }
                }
                else if (args.length === 2) {
                    args[1].compile().evaluate(scope);
                    let profile;
                    if (this.client.profiles.contains(args[1]))
                        profile = this.client.profiles.items[args[1].toLowerCase()];
                    else {
                        profile = Profile.load(path.join(parseTemplate('{profiles}'), args[1].toLowerCase() + '.json'));
                        if (!profile)
                            throw new Error('Profile not found: ' + args[1]);
                    }
                    trigger = SortItemArrayByPriority(profile.triggers);
                    trigger = trigger.find(t => {
                        return t.name === args[0] || t.pattern === args[0];
                    });
                }
                if (trigger)
                    return trigger.triggers && trigger.triggers.length ? trigger.state : 0;
                throw new Error('Trigger not found');
            },
            isnull: (args, math, scope) => {
                if (args.length === 0)
                    return null;
                if (args.length !== 1)
                    throw new Error('Too many arguments for null');
                return args[0].compile().evaluate(scope) ? 1 : 0;
            },
            escape: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for unescape');
                if (args.length !== 1)
                    throw new Error('Too many arguments for unescape');
                let c;
                args[0] = args[0].compile().evaluate(scope).toString();
                if (this.client.getOption('allowEscape')) {
                    const escape = this.client.getOption('allowEscape') ? this.client.getOption('escapeChar') : '';
                    c = escape;
                    if (escape === '\\')
                        c += escape;
                    if (this.client.getOption('parseDoubleQuotes'))
                        c += '"';
                    if (this.client.getOption('parseSingleQuotes'))
                        c += '\'';
                    if (this.client.getOption('commandStacking'))
                        c += this.client.getOption('commandStackingChar');
                    if (this.client.getOption('enableSpeedpaths'))
                        c += this.client.getOption('speedpathsChar');
                    if (this.client.getOption('enableCommands'))
                        c += this.client.getOption('commandChar');
                    if (this.client.getOption('enableVerbatim'))
                        c += this.client.getOption('verbatimChar');
                    if (this.client.getOption('enableDoubleParameterEscaping'))
                        c += this.client.getOption('parametersChar');
                    if (this.client.getOption('enableNParameters'))
                        c += this.client.getOption('nParametersChar');
                    return args.replace(new RegExp(`[${c}]`, 'g'), escape + '$&');
                }
                return args.replace(/[\\"']/g, '\$&');
            },
            unescape: (args, math, scope) => {
                if (args.length === 0)
                    throw new Error('Missing arguments for unescape');
                if (args.length !== 1)
                    throw new Error('Too many arguments for unescape');
                let c;
                args[0] = args[0].compile().evaluate(scope).toString();
                if (this.client.getOption('allowEscape')) {
                    const escape = this.client.getOption('allowEscape') ? this.client.getOption('escapeChar') : '';
                    c = escape;
                    if (escape === '\\')
                        c += escape;
                    if (this.client.getOption('parseDoubleQuotes'))
                        c += '"';
                    if (this.client.getOption('parseSingleQuotes'))
                        c += '\'';
                    if (this.client.getOption('commandStacking'))
                        c += this.client.getOption('commandStackingChar');
                    if (this.client.getOption('enableSpeedpaths'))
                        c += this.client.getOption('speedpathsChar');
                    if (this.client.getOption('enableCommands'))
                        c += this.client.getOption('commandChar');
                    if (this.client.getOption('enableVerbatim'))
                        c += this.client.getOption('verbatimChar');
                    if (this.client.getOption('enableDoubleParameterEscaping'))
                        c += this.client.getOption('parametersChar');
                    if (this.client.getOption('enableNParameters'))
                        c += this.client.getOption('nParametersChar');
                    if (escape === '\\')
                        return args[0].replace(new RegExp(`\\\\[${c}]`, 'g'), (m) => m.substr(1));
                    return args[0].replace(new RegExp(`${escape}[${c}]`, 'g'), (m) => m.substr(1));
                }
                return args[0].replace(/\\[\\"']/g, (m) => m.substr(1));
            },
            charcomment: (args, math, scope) => {
                let notes;
                if (args.length === 0) {
                    notes = getCharacterNotes();
                    if (isFileSync(notes))
                        return fs.readFileSync(notes, 'utf-8');
                    return '';
                }
                else if (args.length > 1)
                    throw new Error('Too many arguments for charcomment');
                args[0] = args[0].compile().evaluate(scope).toString();
                notes = getCharacterNotes();
                if (args[0].length === 0 || !isFileSync(notes))
                    fs.writeFileSync(notes, '');
                else if (!fileSizeSync(notes))
                    fs.appendFileSync(notes, args[0]);
                else
                    fs.appendFileSync(notes, '\n' + args[0]);
            },
            charnotes: (args, math, scope) => {
                let notes;
                if (args.length === 0) {
                    notes = getCharacterNotes();
                    if (isFileSync(notes))
                        return fs.readFileSync(notes, 'utf-8');
                    return '';
                }
                else if (args.length > 1)
                    throw new Error('Too many arguments for charnotes');
                notes = getCharacterNotes();
                args[0] = args[0].compile().evaluate(scope).toString();
                fs.writeFileSync(notes, args[0]);
            },
            //clientid: getId(),
            clientname: (args, math, scope) => {
                if (args.length === 0) {
                    return getName();
                }
                else if (args.length == 1)
                    this.client.emit('set-name', args[0].compile().evaluate(scope).toString());
                else if (args.length == 2) {
                    let i = args[1].compile().evaluate(scope);
                    if (isNaN(i))
                        throw new Error('Invalid argument 2 \'' + args[1].toString() + '\' must be a number for clientname');
                    this.client.emit('set-name', args[0].compile().evaluate(scope).toString(), i);
                }
                else
                    throw new Error('Too many arguments for clientname');
            },
            prompt: (args, math, scope) => {
                if (args.length > 3)
                    throw new Error('Too many arguments');
                if (args.length === 0)
                    return window.prompt();
                args = args.map(a => a.compile().evaluate(scope).toString());
                return window.prompt(...args);
            },
            fileprompt: (args, math, scope) => {
                if (args.length > 2)
                    throw new Error('Too many arguments');
                args = args.map(a => a.compile().evaluate(scope).toString());
                let f = [
                    { name: 'All files (*.*)', extensions: ['*'] },
                ];
                if (args.length > 0 && args[0].trim().length > 0) {
                    f.unshift({
                        name: args[0],
                        extensions: args[0].split(',').map(a => a.trim())
                    })
                }
                var files = dialog.showOpenDialogSync({
                    filters: f,
                    properties: ['openFile', 'promptToCreate'],
                    defaultPath: args.length >= 2 ? parseTemplate(args[1]) : ''
                });
                if (files && files.length) return files[0];
            }
        };
        for (let fun in functions) {
            if (!functions.hasOwnProperty(fun) || typeof functions[fun] !== 'function') {
                continue;
            }
            functions[fun].rawArgs = true;
        }
        _mathjs.import(functions, {});
    }

    public resetExpressionEngine() {
        if (!_mathjs) return;
        _mathjs = undefined;
    }

    constructor(client: Client) {
        super();
        if (!client)
            throw new Error('Invalid client!');
        this.client = client;
        //wrap mathjs to load on demand for speed as not every may need math
        mathjs = () => {
            if (_mathjs) return _mathjs;
            this.initMathJS();
            return _mathjs;
        }
        this._tests = new Tests(client);
        this._commandHistory = [];
        document.addEventListener('keydown', (event) => {
            if (!this.isLocked && this.ProcessMacros(event.which, event.altKey, event.ctrlKey, event.shiftKey, event.metaKey)) {
                event.preventDefault();
                event.stopPropagation();
            }
            //toggle scroll lock
            else if (event.key === 'ScrollLock')
                this.toggleScrollLock();
        });

        this.client.on('parse-command', (data) => {
            if (this.client.getOption('parseCommands'))
                data.value = this.parseOutgoing(data.value, null, null, null, null, !data.comments);
        });

        this.client.on('add-line', (data) => {
            this.ExecuteTriggers(TriggerTypes.Regular | TriggerTypes.Pattern | TriggerTypes.LoopExpression, data.line, data.raw, data.fragment, false, true);
            if (this._gag > 0 && !data.fragment) {
                data.gagged = true;
                this._gag--;
            }
            //if not fragment and not gagged count
            if (!data.fragment)
                for (let state in this._TriggerStates) {
                    if (this._TriggerStates[state].lineCount)
                        this._TriggerStates[state].lineCount--;
                    //if (data.remote && this._TriggerStates[state].remoteCount)
                    //this._TriggerStates[state].remoteCount--;
                }
        });

        this.client.on('options-loaded', () => {
            if (!_mathjs && this.client.getOption('initializeScriptEngineOnLoad'))
                this.initMathJS();
            this.initPads();
        });

        this.client.commandInput.addEventListener('keyup', event => {
            if (event.key !== 'Escape' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
                this._historyIdx = this._commandHistory.length;
        })

        this.client.commandInput.addEventListener('keydown', event => {
            switch (event.key) {
                case 'Escape': //esc
                    //any modifier set not a proper history navigation    
                    if (event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
                    this.client.commandInput.blur();
                    this.client.commandInput.value = '';
                    this.client.commandInput.select();
                    this._historyIdx = this._commandHistory.length;
                    this._tabIdx = -1;
                    this._tabWords = null;
                    this._tabSearch = null
                    break;
                case 'ArrowUp': //up
                    //any modifier set not a proper history navigation    
                    if (event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
                    if (this._historyIdx === this._commandHistory.length && this.client.commandInput.value.length > 0) {
                        this.AddCommandToHistory(this.client.commandInput.value);
                        if (this.client.commandInput.value === this._commandHistory[this._historyIdx - 1])
                            this._historyIdx--;
                    }
                    this._historyIdx--;
                    if (this._historyIdx < 0)
                        this._historyIdx = 0;
                    if (this._commandHistory.length < 0) {
                        this._historyIdx = -1;
                        this.client.commandInput.value = '';
                    }
                    else if (this._commandHistory.length > 0 && this._historyIdx < this._commandHistory.length && this._historyIdx >= 0) {
                        this.client.commandInput.value = this._commandHistory[this._historyIdx];
                    }
                    setTimeout(() => this.client.commandInput.select(), 0);
                    if (this.client.getOption('commandAutoSize') || this.client.getOption('commandScrollbars'))
                        resizeCommandInput();
                    break;
                case 'ArrowDown': //down
                    //any modifier set not a proper history navigation    
                    if (event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
                    if (this._historyIdx === this._commandHistory.length && this.client.commandInput.value.length > 0)
                        this.AddCommandToHistory(this.client.commandInput.value);
                    this._historyIdx++;
                    if (this._historyIdx >= this._commandHistory.length || this._commandHistory.length < 1) {
                        this._historyIdx = this._commandHistory.length;
                        this.client.commandInput.value = '';
                    }
                    else if (this._commandHistory.length > 0 && this._historyIdx < this._commandHistory.length && this._historyIdx >= 0) {
                        this.client.commandInput.value = this._commandHistory[this._historyIdx];
                    }
                    setTimeout(() => this.client.commandInput.select(), 0);
                    if (this.client.getOption('commandAutoSize') || this.client.getOption('commandScrollbars'))
                        resizeCommandInput();
                    break;
                case 'Enter': // return
                    switch (this.client.getOption('newlineShortcut')) {
                        case NewLineType.Ctrl:
                            if (event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) {
                                this.client.commandInput.value += '\n';
                                if (this.client.getOption('commandAutoSize') || this.client.getOption('commandScrollbars'))
                                    resizeCommandInput();
                                this.client.commandInput.blur();
                                this.client.commandInput.focus();
                                return true;
                            }
                            break;
                        case NewLineType.CtrlAndShift:
                            if (event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey) {
                                this.client.commandInput.value += '\n';
                                if (this.client.getOption('commandAutoSize') || this.client.getOption('commandScrollbars'))
                                    resizeCommandInput();
                                this.client.commandInput.blur();
                                this.client.commandInput.focus();
                                return true;
                            }
                            break;
                        case NewLineType.CtrlOrShift:
                            if ((event.ctrlKey || event.shiftKey) && !event.metaKey && !event.altKey) {
                                this.client.commandInput.value += '\n';
                                if (this.client.getOption('commandAutoSize') || this.client.getOption('commandScrollbars'))
                                    resizeCommandInput();
                                this.client.commandInput.blur();
                                this.client.commandInput.focus();
                                return true;
                            }
                            break;
                        case NewLineType.Shift:
                            if ((event.ctrlKey && event.shiftKey) && !event.metaKey && !event.altKey) {
                                this.client.commandInput.value += '\n';
                                if (this.client.getOption('commandAutoSize') || this.client.getOption('commandScrollbars'))
                                    resizeCommandInput();
                                this.client.commandInput.blur();
                                this.client.commandInput.focus();
                                return true;
                            }
                            break;
                    }
                    //only send if no modifiers set
                    if (!event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) {
                        this._tabIdx = -1;
                        this._tabWords = null;
                        this._tabSearch = null
                        event.preventDefault();
                        this.client.sendCommand(null, null, this.client.getOption('allowCommentsFromCommand'));
                        if (this.client.getOption('commandAutoSize') || this.client.getOption('commandScrollbars'))
                            resizeCommandInput();
                    }
                    break;
                case 'Tab':
                    if (!this.client.getOption('enableTabCompletion') || this.client.commandInput.value.length === 0) return;
                    //any modifiers down do not do tab complete
                    if (event.altKey || event.ctrlKey || event.metaKey) return;
                    if (event.shiftKey)
                        this._tabIdx--;
                    else
                        this._tabIdx++;
                    let start = this.client.commandInput.selectionStart;
                    let end = this.client.commandInput.selectionEnd;
                    if (this._tabWords === null) {
                        const cursorPos = getCursor(this.client.commandInput);
                        //(?=\s[\S]+$)
                        let endPos = this.client.commandInput.value.indexOf(' ', cursorPos);
                        if (endPos === -1)
                            endPos = this.client.commandInput.value.indexOf('\n', cursorPos);
                        let startPos = this.client.commandInput.value.lastIndexOf(' ', cursorPos - 1);
                        if (startPos === -1)
                            startPos = this.client.commandInput.value.indexOf('\n', cursorPos - 1);
                        if (endPos === -1)
                            endPos = this.client.commandInput.value.length;
                        if (startPos === -1)
                            startPos = 0;
                        else
                            startPos++;
                        start = startPos;
                        end = endPos;
                        if (start === end)
                            end++;
                        const findStr = this.client.commandInput.value.substring(startPos, endPos);
                        //nothing to find so bail
                        if (findStr.length === 0) return;
                        //tabCompletionList
                        //tabCompletionType
                        //this.client.getOption('enableTabCompletion')
                        //TabCompletion
                        this._tabSearch = { start: startPos, end: endPos, find: findStr.length };
                        const regSearch = new RegExp(`^${findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, this.client.getOption('ignoreCaseTabCompletion') ? 'i' : '');
                        if (this.client.getOption('tabCompletionLookupType') === TabCompletion.List)
                            this._tabWords = [...new Set(<string>this.client.getOption('tabCompletionList').split(/\s+/).filter(word => word.match(regSearch)))];
                        else {
                            //get all words that start with findStr then reverse as you want last words first as they are the newest
                            this._tabWords = [].concat(...this.client.display.lines.slice(this.client.display.lines.length - this.client.getOption('tabCompletionBufferLimit')).map(line => line.text.split(/\s+/))).filter(word => word.match(regSearch)).reverse();
                            if (this.client.getOption('tabCompletionLookupType') === TabCompletion.PrependBuffer)
                                this._tabWords = [...new Set(<string>this.client.getOption('tabCompletionList').split(/\s+/).filter(word => word.match(regSearch)).reverse())].concat(this._tabWords);
                            else if (this.client.getOption('tabCompletionLookupType') === TabCompletion.AppendBuffer)
                                this._tabWords = this._tabWords.concat([...new Set(<string>this.client.getOption('tabCompletionList').split(/\s+/).filter(word => word.match(regSearch)).reverse())]);

                            this._tabWords = [...new Set(this._tabWords)];
                        }
                    }
                    else
                        start -= this._tabSearch.find;
                    if (this._tabWords.length === 0) return;
                    if (this._tabIdx < 0) this._tabIdx = this._tabWords.length - 1;
                    if (this._tabIdx >= this._tabWords.length) this._tabIdx = 0;

                    const tabCasing = this.client.getOption('tabCompletionReplaceCasing');
                    this.client.commandInput.value = this.client.commandInput.value.substring(0, start)
                        + (tabCasing === 1 ? (this._tabWords[this._tabIdx].toLowerCase()) : (tabCasing === 2 ? this._tabWords[this._tabIdx].toUpperCase() : this._tabWords[this._tabIdx]))
                        + this.client.commandInput.value.substring(end, this.client.commandInput.value.length);
                    this.client.commandInput.selectionStart = this._tabSearch.start + this._tabSearch.find;
                    this.client.commandInput.selectionEnd = this._tabSearch.start + this._tabWords[this._tabIdx].length;
                    event.preventDefault();
                    if (this.client.getOption('commandAutoSize') || this.client.getOption('commandScrollbars'))
                        resizeCommandInput();
                    break;
                case 'Shift':
                case 'Control':
                case 'Meta':
                case 'Alt':
                case 'CapsLock':
                case 'Fn':
                case 'NumLock':
                case 'ScrollLock':
                case 'Super':
                case 'PageDown':
                case 'PageUp':
                case 'End':
                case 'Home':
                case 'ArrowLeft':
                case 'ArrowRight':
                case 'ContextMenu':
                    //TODO see if any other keys should not effect tab complete
                    //Do not effect tab completion
                    break;
                default:
                    this._tabIdx = -1;
                    this._tabWords = null;
                    this._tabSearch = null
                    break;
            }
        });

        this.client.commandInput.addEventListener('mouseup', event => {
            this._tabIdx = -1;
            this._tabWords = null;
            this._tabSearch = null
        });
        //spell-checker:ignore gamepadconnected gamepaddisconnected
        window.addEventListener('gamepadconnected', (e) => {
            if (!this.client.getOption('gamepads')) return;
            if (!this._gamepadCaches)
                this._gamepadCaches = [];
            this._controllers[e.gamepad.index] = { pad: e.gamepad, axes: clone(e.gamepad.axes), state: { axes: [], buttons: [] }, pState: { axes: [], buttons: [] } };
            this._controllersCount++;
            this.updatePads();
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            if (!this.client.getOption('gamepads')) return;
            delete this._controllers[e.gamepad.index];
            this._controllersCount--;
        });
        this.initPads();
    }

    private async initPads() {
        if (!this.client || !this.client.options) {
            setTimeout(this.initPads, 5);
            return;
        }
        this._controllers = [];
        this._controllersCount = 0;
        this._gamepadCaches = null;
        if (!this.client.getOption('gamepads')) return;
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
        if (this._controllersCount === 0 || !this.client.getOption('gamepads'))
            return;
        const controllers = navigator.getGamepads();
        let c = 0;
        const cl = controllers.length;
        if (!this._gamepadCaches && cl > 0)
            this._gamepadCaches = [];
        for (; c < cl; c++) {
            const controller = controllers[c];
            //no control and did not correctly connect so skip
            if (!controller || !this._controllers[controller.index]) continue;
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

    public adjustLastLine(n, raw?) {
        if (!this.client.display.lines || this.client.display.lines.length === 0)
            return 0;
        if (raw) {
            if (n === this.client.display.lines.length) {
                n--;
                if (this.client.display.lines[n].text.length === 0 && this.client.display.lines[n].raw.length)
                    n--;
            }
            else if (n === this.client.display.lines.length - 1 && this.client.display.lines[n].text.length === 0 && this.client.display.lines[n].raw.length)
                n--;
        }
        else if (n === this.client.display.lines.length) {
            n--;
            if (this.client.display.lines[n].text.length === 0)
                n--;
        }
        else if (n === this.client.display.lines.length - 1 && this.client.display.lines[n].text.length === 0)
            n--;
        return n;
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
            if (this._commandHistory.length >= this.client.getOption('commandHistorySize'))
                this._commandHistory.shift();
            this._commandHistory.push(cmd);
            this.emit('command-history-changed', this._commandHistory);
        }
    }

    public clearCommandHistory() {
        this._commandHistory = [];
        this._historyIdx = -1;
        this.emit('command-history-changed', this._commandHistory);
    }

    public setHistoryIndex(index) {
        if (index < 0 || this._commandHistory.length === 0)
            this._historyIdx = -1;
        else if (index >= this._commandHistory.length)
            this._historyIdx = this._commandHistory.length - 1;
        else
            this._historyIdx = index;
    }

    public get commandHistory() { return this._commandHistory; }

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
        const pd: boolean = this.client.getOption('parseDoubleQuotes');
        const ps: boolean = this.client.getOption('parseSingleQuotes');
        const cmdChar: string = this.client.getOption('commandChar');

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
                    else if (c === '(') {
                        state = 8;
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
                case 8:
                    arg += c;
                    if (c === ')') {
                        if (s === 0) {
                            state = 2;
                        }
                        else
                            s--;
                    }
                    else if (c === '(')
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
                    if (idx === 0 && c === cmdChar) {
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
            //if (state === 3)
            //arg += '"';
            //else if (state === 4)
            //arg += '\'';
            if (arg.endsWith('\n'))
                arg = arg.substring(0, arg.length - 1);
            if (arg.length > 0) args.push(arg);
            return this.executeFunction(fun, args, raw, cmdChar);
        }
        return txt;
    }

    public executeFunction(fun: string, args, raw: string, cmdChar: string) {
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
        let avg;
        let max;
        let min;
        switch (fun.toLowerCase()) {
            case 'testfile':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' '));
                if (!args || args.length === 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'testfile file');
                if (!isFileSync(args))
                    throw new Error('Invalid file "' + args + '"');
                tmp = fs.readFileSync(args, 'utf-8');
                n = this.client.getOption('enableCommands');
                this.client.options.enableCommands = true;
                i = new Date().getTime();
                this.client.sendCommand(tmp, null, this.client.getOption('allowCommentsFromCommand'));
                p = new Date().getTime();
                this.client.options.enableCommands = n;
                this.client.print(`Time: ${p - i}\n`, true);
                return null;
            case 'testspeedfile':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' '));
                items = [];
                if (!args || args.length === 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'testspeedfile file');
                if (!isFileSync(args))
                    throw new Error('Invalid file "' + args + '"');
                tmp = fs.readFileSync(args, 'utf-8');
                n = this.client.getOption('enableCommands');
                this.client.options.enableCommands = true;
                avg = 0;
                max = 0;
                min = 0;
                for (i = 0; i < 10; i++) {
                    const start = new Date().getTime();
                    this.client.sendCommand(tmp, null, this.client.getOption('allowCommentsFromCommand'));
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
            case 'testspeedfiler':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' '));
                items = [];
                if (!args || args.length === 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'testspeedfile file');
                if (!isFileSync(args))
                    throw new Error('Invalid file "' + args + '"');
                tmp = fs.readFileSync(args, 'utf-8');
                avg = 0;
                max = 0;
                min = 0;
                for (i = 0; i < 10; i++) {
                    const start = new Date().getTime();
                    this.client.telnet.receivedData(Buffer.from(tmp), true, true);
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
                return null;
            //spell-checker:ignore chatprompt chatp
            case 'chatprompt':
            case 'chatp':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' '));
                if ((<any>this.client).sendChat)
                    (<any>this.client).sendChat(args);
                return null;
            case 'chat':
            case 'ch':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' ') + '\n');
                if ((<any>this.client).sendChat)
                    (<any>this.client).sendChat(args);
                return null;
            //spell-checker:ignore untrigger unaction
            case 'unaction':
            case 'untrigger':
            case 'unt':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                profile = null;
                name = null;
                reload = true;
                p = parseTemplate('{profiles}');
                if (args.length < 1 || args.length > 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'unt\x1b[0;-11;-12mrigger {pattern|name} \x1b[3mprofile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid name or pattern');
                //{pattern} {commands} profile
                if (args[0].match(/^\{.*\}$/g))
                    args[0] = this.parseInline(args[0].substr(1, args[0].length - 2));
                else
                    args[0] = this.parseInline(this.stripQuotes(args[0]));
                if (args.length === 2) {
                    profile = this.stripQuotes(args[2]);
                    profile = this.parseInline(profile);
                }
                if (!profile || profile.length === 0) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return null;
                    if (kl === 1) {
                        if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                            throw Error('No enabled profiles found!');
                        item = this.client.profiles.items[keys[k]].findAny('triggers', { name: args[0], pattern: args[0] });
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
                    profile = this.parseInline(profile);
                    if (this.client.profiles.contains(profile)) {
                        profile = this.client.profiles.items[profile.toLowerCase()];
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
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
                        items = this.parseInline(this.stripQuotes(args[0]));
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
                        throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'sus\x1b[0;-11;-12mpend id \x1b[3mprofile\x1b[0;-11;-12m or \x1b[4m' + cmdChar + 'sus\x1b[0;-11;-12mpend');
                }
            case 'resume':
            case 'resu':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                switch (args.length) {
                    case 0:
                        if (this._lastSuspend === -1)
                            return null;
                        this.client.setAlarmState(this._lastSuspend, true);
                        this.client.echo('Last alarm suspended resumed.', -7, -8, true, true);
                        this._lastSuspend = -1;
                        return null;
                    case 1:
                        items = this.parseInline(this.stripQuotes(args[0]));
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
                        throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'resu\x1b[0;-11;-12mme id \x1b[3mprofile\x1b[0;-11;-12m or \x1b[4m' + cmdChar + 'resu\x1b[0;-11;-12mme');
                }
            case 'action':
            case 'ac':
            case 'trigger':
            case 'tr':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#region trigger
                item = {
                    profile: null,
                    name: null,
                    pattern: null,
                    commands: null,
                    options: { priority: 0 }
                };
                p = parseTemplate('{profiles}');
                if (args.length < 2 || args.length > 5)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'tr\x1b[0;-11;-12migger name {pattern} {commands} \x1b[3moptions profile\x1b[0;-11;-12m or \x1b[4m' + cmdChar + 'tr\x1b[0;-11;-12migger {pattern} {commands} \x1b[3m{options} profile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid trigger name or pattern');

                if (args[0].match(/^\{.*\}$/g)) {
                    item.pattern = args.shift();
                    item.pattern = this.parseInline(item.pattern.substr(1, item.pattern.length - 2));
                }
                else {
                    item.name = this.parseInline(this.stripQuotes(args.shift()));
                    if (!item.name || item.name.length === 0)
                        throw new Error('Invalid trigger name');
                    if (args[0].match(/^\{.*\}$/g)) {
                        item.pattern = args.shift();
                        item.pattern = this.parseInline(item.pattern.substr(1, item.pattern.length - 2));
                    }
                }
                if (args.length !== 0) {
                    if (args[0].match(/^\{[\s\S]*\}$/g)) {
                        item.commands = args.shift();
                        item.commands = item.commands.substr(1, item.commands.length - 2);
                    }
                    if (args.length === 1) {
                        if (args[0].match(/^\{[\s\S]*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        else
                            args[0] = this.stripQuotes(args[0]);
                        if (args[0].length !== 0) {
                            this.parseInline(args[0]).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nocr':
                                    case 'prompt':
                                    case 'case':
                                    case 'verbatim':
                                    case 'disable':
                                    case 'enable':
                                    case 'cmd':
                                    case 'temporary':
                                    case 'temp':
                                    case 'raw':
                                    case 'pattern':
                                    case 'regular':
                                    case 'alarm':
                                    case 'event':
                                    case 'cmdpattern':
                                    case 'loopexpression':
                                        //case 'expression':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('param=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger param option '${o.trim()}'`);
                                            item.options['params'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('type=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger type option '${o.trim()}'`);
                                            if (!this.isTriggerType(tmp[1], TriggerTypeFilter.Main))
                                                throw new Error('Invalid trigger type');
                                            item.options['type'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
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
                        if (args[0].match(/^\{[\s\S]*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        if (args[0].length !== 0) {
                            this.parseInline(args[0]).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nocr':
                                    case 'prompt':
                                    case 'case':
                                    case 'verbatim':
                                    case 'disable':
                                    case 'enable':
                                    case 'cmd':
                                    case 'temporary':
                                    case 'temp':
                                    case 'raw':
                                    case 'pattern':
                                    case 'regular':
                                    case 'alarm':
                                    case 'event':
                                    case 'cmdpattern':
                                    case 'loopexpression':
                                        //case 'expression':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('param=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger param option '${o.trim()}'`);
                                            item.options['params'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('type=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger type option '${o.trim()}'`);
                                            if (!this.isTriggerType(tmp[1], TriggerTypeFilter.Main))
                                                throw new Error('Invalid trigger type');

                                            item.options['type'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
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
                            item.profile = this.parseInline(item.profile);
                    }
                }
                this.createTrigger(item.pattern, item.commands, item.profile, item.options, item.name);
                //#endregion
                return null;
            case 'event':
            case 'ev':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
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
                p = parseTemplate('{profiles}');
                if (args.length < 2 || args.length > 4)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'ev\x1b[0;-11;-12ment name {commands} \x1b[3moptions profile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid event name');

                item.name = this.parseInline(this.stripQuotes(args.shift()));
                if (!item.name || item.name.length === 0)
                    throw new Error('Invalid event name');
                if (args.length === 0)
                    throw new Error('Missing commands or options');

                if (args[0].match(/^\{[\s\S]*\}$/g)) {
                    item.commands = args.shift();
                    item.commands = item.commands.substr(1, item.commands.length - 2);
                }
                else
                    throw new Error('Missing commands');
                if (args.length === 1) {
                    args[0] = args[0].substr(1, args[0].length - 2);
                    if (args[0].length !== 0) {
                        this.parseInline(args[0]).split(',').forEach(o => {
                            switch (o.trim()) {
                                case 'nocr':
                                case 'prompt':
                                case 'case':
                                case 'verbatim':
                                case 'disable':
                                case 'temporary':
                                case 'temp':
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
                    if (args[0].match(/^\{[\s\S]*\}$/g))
                        args[0] = args[0].substr(1, args[0].length - 2);
                    if (args[0].length !== 0) {
                        this.parseInline(args[0]).split(',').forEach(o => {
                            switch (o.trim()) {
                                case 'nocr':
                                case 'prompt':
                                case 'case':
                                case 'verbatim':
                                case 'disable':
                                case 'temporary':
                                case 'temp':
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
                        item.profile = this.parseInline(item.profile);
                }

                if (!item.profile || item.profile.length === 0) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return null;
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
                        profile = this.client.profiles.items[item.profile.toLowerCase()];
                    else {
                        profile = Profile.load(path.join(p, item.profile.toLowerCase() + '.json'));
                        reload = false;
                        if (!profile)
                            throw new Error('Profile not found: ' + item.profile);
                    }
                    trigger = tmp.find(t => {
                        return t.name === item.name || t.pattern === item.name;
                    });
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
                if (item.options.raw)
                    trigger.raw = true;

                if (item.options.verbatim)
                    trigger.verbatim = true;
                if (item.options.disable)
                    trigger.enabled = false;
                else if (item.options.enable)
                    trigger.enabled = true;
                if (item.options.temporary || item.options.temp)
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#region unevent
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'une\x1b[0;-11;-12mvent name or \x1b[4m' + cmdChar + 'une\x1b[0;-11;-12mvent {name} \x1b[3mprofile\x1b[0;-11;-12m');
                else {
                    reload = true;
                    profile = null;
                    p = parseTemplate('{profiles}');
                    if (args[0].match(/^\{.*\}$/g) || args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g)) {
                        if (args.length > 2)
                            throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'une\x1b[0;-11;-12mvent name or \x1b[4m' + cmdChar + 'une\x1b[0;-11;-12mvent {name} \x1b[3mprofile\x1b[0;-11;-12m');
                        if (args.length === 2) {
                            profile = this.parseInline(this.stripQuotes(args[1])).toLowerCase();
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
                            n = this.parseInline(this.stripQuotes(args[0]));
                        else
                            n = this.parseInline(args[0].substr(1, args[0].length - 2));
                    }
                    else {
                        n = this.parseInline(args.join(' '));
                        profile = this.client.activeProfile;
                    }
                    items = SortItemArrayByPriority(profile.triggers.filter(t => t.type === TriggerType.Event));
                    n = this.stripQuotes(n);
                    tmp = n;
                    n = items.findIndex(i => i.pattern === n || i.name === n);
                    f = n !== -1;
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
            //#endregion
            case 'button':
            case 'bu':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#region button
                //#button name caption {commands} {icon} options profile
                //#button name|index
                //Options: enable, disable, nosend, chain, append, stretch, priority=#
                if (args.length === 1) {
                    n = this.parseInline(this.stripQuotes(args[0]));
                    items = document.getElementById('user-buttons').children;
                    if (/^\s*?\d+\s*?$/.exec(n)) {
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
                p = parseTemplate('{profiles}');
                if (args.length < 2 || args.length > 5)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'bu\x1b[0;-11;-12mtton name|index or \x1b[4m' + cmdChar + 'bu\x1b[0;-11;-12mtton name \x1b[3mcaption\x1b[0;-11;-12m {commands} \x1b[3m{icon} options profile\x1b[0;-11;-12m or \x1b[4m' + cmdChar + 'by\x1b[0;-11;-12mutton \x1b[3mcaption\x1b[0;-11;-12m {commands} \x1b[3m{icon} {options} profile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid button name, caption or commands');

                if (args[0].match(/^\{[\s\S]*\}$/g)) {
                    item.commands = args.shift();
                    item.commands = item.commands.substr(1, item.commands.length - 2);
                }
                else {
                    item.name = this.parseInline(this.stripQuotes(args.shift()));
                    if (!item.name || item.name.length === 0)
                        throw new Error('Invalid button name or caption');
                    if (args[0].match(/^\{[\s\S]*\}$/g)) {
                        item.commands = args.shift();
                        item.commands = item.commands.substr(1, item.commands.length - 2);
                    }
                    else {
                        item.caption = this.stripQuotes(args.shift());
                        if (!args[0].match(/^\{[\s\S]*\}$/g))
                            throw new Error('Missing commands');
                    }
                }

                if (args.length !== 0) {
                    if (args[0].match(/^\{.*\}$/g)) {
                        item.icon = args.shift();
                        item.icon = item.icon.substr(1, item.icon.length - 2);
                    }
                    if (args.length === 1) {
                        if (args[0].match(/^\{[\s\S]*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        else
                            args[0] = this.stripQuotes(args[0]);
                        if (args[0].length !== 0) {
                            this.parseInline(args[0]).split(',').forEach(o => {
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
                        if (args[0].match(/^\{[\s\S]*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        if (args[0].length !== 0) {
                            this.parseInline(args[0]).split(',').forEach(o => {
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
                            item.profile = this.parseInline(item.profile);
                    }
                }
                if (!item.profile || item.profile.length === 0) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return null;
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
                        profile = this.client.profiles.items[item.profile.toLowerCase()];
                    else {
                        reload = false;
                        profile = Profile.load(path.join(p, item.profile.toLowerCase() + '.json'));
                        if (!profile)
                            throw new Error('Profile not found: ' + item.profile);
                    }
                    if (item.name !== null)
                        trigger = profile.find('buttons', 'name', item.name);
                    else
                        trigger = profile.find('buttons', 'caption', item.caption);
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#region unbutton
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'unb\x1b[0;-11;-12mtton name or \x1b[4m' + cmdChar + 'unb\x1b[0;-11;-12mtton {name} \x1b[3mprofile\x1b[0;-11;-12m');
                else {
                    reload = true;
                    profile = null;
                    p = parseTemplate('{profiles}');
                    if (args[0].match(/^\{.*\}$/g) || args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g)) {
                        if (args.length > 2)
                            throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'unb\x1b[0;-11;-12mtton name or \x1b[4m' + cmdChar + 'unb\x1b[0;-11;-12mtton {name} \x1b[3mprofile\x1b[0;-11;-12m');
                        if (args.length === 2) {
                            profile = this.parseInline(this.stripQuotes(args[1]));
                            if (this.client.profiles.contains(profile))
                                profile = this.client.profiles.items[profile.toLowerCase()];
                            else {
                                name = profile;
                                reload = false;
                                profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
                                if (!profile)
                                    throw new Error('Profile not found: ' + name);
                            }
                        }
                        else
                            profile = this.client.activeProfile;
                        if (args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g))
                            n = this.parseInline(this.stripQuotes(args[0]));
                        else
                            n = this.parseInline(args[0].substr(1, args[0].length - 2));
                    }
                    else {
                        n = this.parseInline(args.join(' '));
                        profile = this.client.activeProfile;
                    }
                    items = SortItemArrayByPriority(profile.buttons);
                    tmp = n;
                    if (/^\s*?\d+\s*?$/.exec(n)) {
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            throw new Error('Button index must be >= 0 and < ' + items.length);
                        f = true;
                    }
                    else {
                        n = this.stripQuotes(n);
                        n = items.findIndex(i => i.name === n || i.caption === n);
                        f = n !== -1;
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
            //#endregion button
            case 'alarm':
            case 'ala':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#region alarm
                //spell-checker:ignore timepattern
                profile = null;
                name = null;
                reload = true;
                n = false;
                p = parseTemplate('{profiles}');
                if (args.length < 2 || args.length > 4)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'ala\x1b[0;-11;-12mrm name {timepattern} {commands} \x1b[3mprofile\x1b[0;-11;-12m, \x1b[4m' + cmdChar + 'ala\x1b[0;-11;-12mrm name {timepattern} \x1b[3mprofile\x1b[0;-11;-12m, or \x1b[4m' + cmdChar + 'ala\x1b[0;-11;-12mrm {timepattern} {commands} \x1b[3mprofile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid name or timepattern');
                //{pattern} {commands} profile
                if (args[0].match(/^\{.*\}$/g)) {
                    if (args.length > 3)
                        throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'ala\x1b[0;-11;-12mrm {timepattern} {commands} profile');
                    args[0] = args[0].substr(1, args[0].length - 2);
                    args[0] = this.parseInline(args[0]);
                    if (args[1].match(/^\{[\s\S]*\}$/g))
                        args[1] = args[1].substr(1, args[1].length - 2);
                    if (args.length === 3) {
                        profile = this.stripQuotes(args[2]);
                        profile = this.parseInline(profile);
                    }

                    if (!profile || profile.length === 0)
                        profile = this.client.activeProfile;
                    else {
                        if (this.client.profiles.contains(profile))
                            profile = this.client.profiles.items[profile.toLowerCase()];
                        else {
                            name = profile;
                            reload = false;
                            profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
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
                name = this.parseInline(name);
                let pattern = args[1];
                let commands = null;
                if (pattern.match(/^\{.*\}$/g))
                    pattern = pattern.substr(1, pattern.length - 2);
                pattern = this.parseInline(pattern);
                if (args.length === 3) {
                    if (args[2].match(/^\{[\s\S]*\}$/g))
                        commands = args[2].substr(1, args[2].length - 2);
                    else
                        profile = this.stripQuotes(args[2]);
                }
                else if (args.length === 4) {
                    commands = args[2];
                    profile = this.stripQuotes(args[3]);
                    if (commands.match(/^\{[\s\S]*\}$/g))
                        commands = commands.substr(1, commands.length - 2);
                }
                if (!profile || profile.length === 0) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return null;
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
                    profile = this.parseInline(profile);
                    if (this.client.profiles.contains(profile))
                        profile = this.client.profiles.items[profile.toLowerCase()];
                    else {
                        name = profile;
                        reload = false;
                        profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
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
            //#endregion alarm
            case 'ungag':
            case 'ung':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length > 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'ung\x1b[0;-11;-12mag number or \x1b[4m' + cmdChar + 'ung\x1b[0;-11;-12mag');
                if (this._gagID.length) {
                    clearTimeout(this._gagID.pop());
                    this._gags.pop();
                }
                this._gag = 0;
                return null;
            case 'gag':
            case 'ga':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#region gag
                if (args.length === 0) {
                    //if one exist for this line remove it and replace it with new one
                    if (this._gags.length && this._gags[this._gags.length - 1] == this.client.display.lines.length) {
                        this._gag = 0;
                        this._gags.pop();
                    }
                    this._gags.push(this.client.display.lines.length);
                    this._gagID.push(setTimeout(() => {
                        n = this.adjustLastLine(this._gags.pop());
                        if (this._gags.length) {
                            let gl = this._gags.length;
                            while (gl >= 0) {
                                gl--;
                                if (this._gags[gl] > n)
                                    this._gags[gl]--;
                            }
                        }
                        this.client.display.removeLine(n);
                    }, 0));
                    this._gag = 0;
                    return null;
                }
                else if (args.length > 1)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'ga\x1b[0;-11;-12mg number or \x1b[4m' + cmdChar + 'ga\x1b[0;-11;-12mg');
                i = parseInt(args[0], 10);
                if (isNaN(i))
                    throw new Error('Invalid number \'' + args[0] + '\'');
                //if one exist for this line remove it and replace it with new one
                if (this._gags.length && this._gags[this._gags.length - 1] == this.client.display.lines.length) {
                    this._gag = 0;
                    this._gags.pop();
                }
                this._gags.push(this.client.display.lines.length);
                if (i >= 0) {
                    this._gagID.push(setTimeout(() => {
                        n = this.adjustLastLine(this._gags.pop());
                        if (this._gags.length) {
                            let gl = this._gags.length;
                            while (gl >= 0) {
                                gl--;
                                if (this._gags[gl] > n)
                                    this._gags[gl]--;
                            }
                        }
                        this.client.display.removeLine(n);
                        this._gag = i;
                    }, 0));
                    this._gag = 0;
                }
                else {
                    this._gagID.push(setTimeout(() => {
                        n = this.adjustLastLine(this._gags.pop());
                        i *= -1;
                        if (i > this.client.display.lines.length)
                            i = this.client.display.lines.length;
                        this.client.display.removeLines(n - i, i);
                        this._gag = 0;
                    }, 0));
                    this._gag = 0;
                }
                return null;
            //#endregion gag
            case 'wait':
            case 'wa':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //filter out empty arguments to avoid trailing spaces
                args = args.filter(a => a);
                if (args.length === 0 || args.length > 1)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'wa\x1b[0;-11;-12mit number');
                i = parseInt(this.parseInline(args[0]), 10);
                if (isNaN(i))
                    throw new Error('Invalid number \'' + i + '\' for wait');
                if (i < 1)
                    throw new Error('Must be greater then zero for wait');
                return i;
            case 'showclient':
            case 'showcl':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.show();
                return null;
            case 'hideclient':
            case 'hidecl':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.hide();
                return null;
            case 'toggleclient':
            case 'togglecl':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.toggle();
                return null;
            case 'raiseevent':
            case 'raise':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (this.client.getOption('parseDoubleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.getOption('parseSingleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\'(.*)\'$/g, (v, e, w) => {
                            return e.replace(/\\\'/g, '\'');
                        });
                    });
                if (args.length === 0)
                    throw new Error('Invalid syntax use ' + cmdChar + '\x1b[4mraise\x1b[0;-11;-12mevent name or ' + cmdChar + '\x1b[4mraise\x1b[0;-11;-12mevent name arguments');
                else if (args.length === 1)
                    this.client.raise(args[0]);
                else
                    this.client.raise(args[0], args.slice(1));
                return null;
            case 'cl':
            case 'close':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (this.client.getOption('parseDoubleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.getOption('parseSingleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\'(.*)\'$/g, (v, e, w) => {
                            return e.replace(/\\\'/g, '\'');
                        });
                    });
                if (args.length > 2)
                    throw new Error('Invalid syntax use ' + cmdChar + '\x1b[4mcl\x1b[0;-11;-12mose');
                else if (args.length === 0)
                    (<any>this.client).closeWindow();
                else
                    (<any>this.client).closeWindow(this.stripQuotes(this.parseInline(args[0])));
                return null;
            case 'id':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.echo('Client ID: ' + getId(), -7, -8, true, true);
                return null
            case 'window':
            case 'win':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (this.client.getOption('parseDoubleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.getOption('parseSingleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\'(.*)\'$/g, (v, e, w) => {
                            return e.replace(/\\\'/g, '\'');
                        });
                    });
                if (args.length === 0 || args.length > 3)
                    throw new Error('Invalid syntax use ' + cmdChar + '\x1b[4mwin\x1b[0;-11;-12mdow name \x1b[3mclose\x1b[0;-11;-12m or ' + cmdChar + '\x1b[4mwin\x1b[0;-11;-12mdow new \x1b[3mcharacter\x1b[0;-11;-12m');
                else if (args.length === 3)
                    this.client.emit('window', this.stripQuotes(this.parseInline(args[0])), this.stripQuotes(this.parseInline(args[1])), this.stripQuotes(this.parseInline(args.slice(2).join(' '))));
                else if (args.length === 1)
                    this.client.emit('window', this.stripQuotes(this.parseInline(args[0])));
                else
                    this.client.emit('window', this.stripQuotes(this.parseInline(args[0])), this.stripQuotes(this.parseInline(args.slice(1).join(' '))));
                return null;
            case 'tab':
            case 'conn':
            case 'connection':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (this.client.getOption('parseDoubleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.getOption('parseSingleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\'(.*)\'$/g, (v, e, w) => {
                            return e.replace(/\\\'/g, '\'');
                        });
                    });
                if (args.length > 2) {
                    if (fun.toLowerCase() === 'tab')
                        throw new Error('Invalid syntax use ' + cmdChar + 'tab \x1b[3mcharacter or id');
                    else
                        throw new Error('Invalid syntax use ' + cmdChar + '\x1b[4mconn\x1b[0;-11;-12mection \x1b[3mcharacter or id');
                }
                else if (args.length === 2)
                    this.client.emit('connection', this.stripQuotes(this.parseInline(args[0])), this.stripQuotes(this.parseInline(args[1])));
                else if (args.length === 1)
                    this.client.emit('connection', this.stripQuotes(this.parseInline(args[0])));
                else
                    this.client.emit('connection');
                return null;
            case 'na':
            case 'name':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (this.client.getOption('parseDoubleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.getOption('parseSingleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\'(.*)\'$/g, (v, e, w) => {
                            return e.replace(/\\\'/g, '\'');
                        });
                    });
                if (args.length > 2)
                    throw new Error('Invalid syntax use ' + cmdChar + '\x1b[4mna\x1b[0;-11;-12mme name \x1b[3mid');
                else if (args.length === 0) {
                    if (getName())
                        this.client.echo('Client name: ' + getName(), -7, -8, true, true);
                    else
                        this.client.echo('Client name: Not set', -7, -8, true, true);
                }
                else if (args.length === 2) {
                    i = parseInt(this.stripQuotes(this.parseInline(args[1])), 10);
                    if (isNaN(i))
                        throw new Error('Invalid id \'' + args[1] + '\' for name');
                    args[0] = this.stripQuotes(this.parseInline(args[0]));
                    this.client.emit('set-name', args[0], i);
                    this.client.echo(`Client ${i} set to ${args[0]}`, -7, -8, true, true);
                }
                else {
                    this.client.emit('set-name', this.stripQuotes(this.parseInline(args[0])));
                    this.client.echo('Client name set to ' + getName(), -7, -8, true, true);
                }
                return null;
            case 'clearna':
            case 'clearname':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (this.client.getOption('parseDoubleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.getOption('parseSingleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\'(.*)\'$/g, (v, e, w) => {
                            return e.replace(/\\\'/g, '\'');
                        });
                    });
                if (args.length > 2)
                    throw new Error('Invalid syntax use ' + cmdChar + '\x1b[4mclearna\x1b[0;-11;-12mme \x1b[3mname or id');
                else if (args.length === 0) {
                    clearName();
                    this.client.echo('Client name cleared', -7, -8, true, true);
                }
                else {
                    name = this.parseInline(args[0]);
                    i = parseInt(name, 10);
                    if (isNaN(i))
                        clearName(this.stripQuotes(name));
                    else
                        clearName(i);
                    this.client.echo('Client ' + name + ' cleared', -7, -8, true, true);
                }
                return null;
            case 'all':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'all {commands}');
                if (args[0].match(/^\{.*\}$/g))
                    args = this.parseInline(args[0].substr(1, args[0].length - 2));
                else
                    args = args.join(' ');
                if (args.length === 0)
                    throw new Error('Missing commands argument');
                (<any>this.client).sendAllBackground(this.parseInline(this.stripQuotes(args)), null, this.client.getOption('allowCommentsFromCommand'));
                return null;
            case 'to':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 2)
                    throw new Error('Invalid syntax use ' + cmdChar + 'to name|id {commands}');
                name = args[0];
                args = args.slice(1);
                if (name.match(/^\{.*\}$/g))
                    name = name.substr(1, name.length - 2);
                name = this.parseInline(this.stripQuotes(name));
                if (args[0].match(/^\{.*\}$/g))
                    args = this.parseInline(args[0].substr(1, args[0].length - 2));
                else
                    args = args.join(' ');
                if (args.length === 0)
                    throw new Error('Missing commands argument');
                (<any>this.client).sendToBackground(name, this.parseInline(this.stripQuotes(args)), null, this.client.getOption('allowCommentsFromCommand'));
                return null;
            case 'raisedelayed':
            case 'raisede':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'raisede\x1b[0;-11;-12mlayed milliseconds name or \x1b[4m' + cmdChar + 'raisede\x1b[0;-11;-12mlayed milliseconds name arguments');
                i = parseInt(this.stripQuotes(this.parseInline(args[0])), 10);
                if (isNaN(i))
                    throw new Error('Invalid number \'' + args[0] + '\' for raisedelayed');
                if (i < 1)
                    throw new Error('Must be greater then zero for raisedelayed');
                args.shift();
                if (this.client.getOption('parseDoubleQuotes'))
                    args.forEach((a) => {
                        return a.replace(/^\"(.*)\"$/g, (v, e, w) => {
                            return e.replace(/\\\"/g, '"');
                        });
                    });
                if (this.client.getOption('parseSingleQuotes'))
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'not\x1b[0;-11;-12mify title \x1b[3mmessage icon\x1b[0;-11;-12m');
                else {
                    args[0] = this.stripQuotes(args[0]);
                    if (args[args.length - 1].match(/^\{.*\}$/g)) {
                        item = args.pop();
                        n = { icon: parseTemplate(this.parseInline(item.substr(1, item.length - 2))) };
                    }
                    if (args.length === 0)
                        throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'not\x1b[0;-11;-12mify title \x1b[3mmessage icon\x1b[0;-11;-12m');
                    if (args.length === 1)
                        this.client.notify(this.parseInline(this.stripQuotes(args[0])), null, n);
                    else
                        this.client.notify(this.parseInline(this.stripQuotes(args[0])), this.parseInline(args.slice(1).join(' ')), n);
                }
                return null;
            case 'idle':
            case 'idletime':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (!this.client.lastSendTime)
                    this.client.echo('Not connected', -7, -8, true, true);
                else
                    this.client.echo('You have been idle: ' + getTimeSpan(Date.now() - this.client.lastSendTime), -7, -8, true, true);
                return null;
            case 'connect':
            case 'connecttime':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (!this.client.connectTime) {
                    if (this.client.disconnectTime)
                        this.client.echo('Disconnected since: ' + new moment(this.client.disconnectTime).format('MM/DD/YYYY hh:mm:ss A'), -7, -8, true, true);
                    else
                        this.client.echo('Not connected', -7, -8, true, true);
                }
                else
                    this.client.echo('You have been connected: ' + getTimeSpan(Date.now() - this.client.connectTime), -7, -8, true, true);
                return null;
            case 'beep':
            case 'be':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.beep();
                return null;
            case 'version':
            case 've':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.echo(this.client.telnet.terminal + ' v' + this.client.version, -7, -8, true, true);
                return null;
            case 'soundinfo':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (this.client.MSP.SoundState.playing) {
                    this.client.echo('Playing Sound - ' + this.client.MSP.SoundState.file + ' - ' + buzz.toTimer(this.client.MSP.SoundState.sound.getTime()) + '/' + buzz.toTimer(this.client.MSP.SoundState.sound.getDuration()), -7, -8, true, true);
                }
                else
                    this.client.echo('No sound currently playing.', -7, -8, true, true);
                return null;
            case 'musicinfo':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (this.client.MSP.MusicState.playing)
                    this.client.echo('Playing Music - ' + this.client.MSP.MusicState.file + ' -  ' + buzz.toTimer(this.client.MSP.MusicState.sound.getTime()) + '/' + buzz.toTimer(this.client.MSP.MusicState.sound.getDuration()), -7, -8, true, true);
                else
                    this.client.echo('No music currently playing.', -7, -8, true, true);
                return null;
            case 'playmusic':
            case 'playm':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' '));
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' '));
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.MSP.MusicState.close();
                return null;
            case 'stopsound':
            case 'stops':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.MSP.SoundState.close();
                return null;
            case 'stopallsound':
            case 'stopa':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.MSP.MusicState.close();
                this.client.MSP.SoundState.close();
                return null;
            case 'showprompt':
            case 'showp':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' '));
                this.client.telnet.receivedData(Buffer.from(args), true, true);
                this.client.telnet.prompt = true;
                return null;
            case 'show':
            case 'sh':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' ') + '\n');
                this.client.telnet.receivedData(Buffer.from(args), true, true);
                return null;
            case 'sayprompt':
            case 'sayp':
            case 'echoprompt':
            case 'echop':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' '));
                this.client.print('\x1b[-7;-8m' + args + '\x1b[0m', false);
                return null;
            case 'say':
            case 'sa':
            case 'echo':
            case 'ec':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' '));
                if (this.client.telnet.prompt)
                    this.client.print('\n\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                else
                    this.client.print('\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                this.client.telnet.prompt = false;
                return null;
            case 'print':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                i = this.client.enableTriggers;
                this.client.enableTriggers = false;
                args = this.parseInline(args.join(' '));
                if (this.client.telnet.prompt)
                    this.client.print('\n\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                else
                    this.client.print('\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                this.client.telnet.prompt = false;
                this.client.enableTriggers = i;
                return null;
            case 'printprompt':
            case 'printp':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                i = this.client.enableTriggers;
                this.client.enableTriggers = false;
                args = this.parseInline(args.join(' '));
                this.client.print('\x1b[-7;-8m' + args + '\x1b[0m', false);
                this.client.enableTriggers = i;
                return null;
            case 'alias':
            case 'al':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'al\x1b[0;-11;-12mias name value or \x1b[4m' + cmdChar + 'al\x1b[0;-11;-12mias name {value} \x1b[3mprofile\x1b[0;-11;-12m');
                else if (args.length === 1)
                    throw new Error('Must supply an alias value');
                else {
                    n = this.parseInline(this.stripQuotes(args.shift()));
                    reload = true;
                    profile = null;
                    p = parseTemplate('{profiles}');
                    if (args[0].match(/^\{.*\}$/g) || args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g)) {
                        if (args.length > 2)
                            throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'al\x1b[0;-11;-12mias name value or \x1b[4m' + cmdChar + 'al\x1b[0;-11;-12mias name {value} \x1b[3mprofile\x1b[0;-11;-12m');
                        if (args.length === 2) {
                            profile = this.parseInline(this.stripQuotes(args[1]));
                            if (this.client.profiles.contains(profile))
                                profile = this.client.profiles.items[profile.toLowerCase()];
                            else {
                                name = profile;
                                reload = false;
                                profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
                                if (!profile)
                                    throw new Error('Profile not found: ' + name);
                            }
                        }
                        else
                            profile = this.client.activeProfile;
                        if (args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g))
                            args = this.parseInline(this.stripQuotes(args[0]));
                        else
                            args = this.parseInline(args[0].substr(1, args[0].length - 2));
                    }
                    else {
                        args = args.join(' ');
                        profile = this.client.activeProfile;
                    }
                    items = profile.aliases;
                    args = this.stripQuotes(args);
                    if (/^\s*?\d+\s*?$/.exec(n)) {
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'una\x1b[0;-11;-12mlias name or \x1b[4m' + cmdChar + 'una\x1b[0;-11;-12mlias {name} \x1b[3mprofile\x1b[0;-11;-12m');
                else {
                    reload = true;
                    profile = null;
                    p = parseTemplate('{profiles}');
                    if (args[0].match(/^\{.*\}$/g) || args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g)) {
                        if (args.length > 2)
                            throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'una\x1b[0;-11;-12mlias name or \x1b[4m' + cmdChar + 'una\x1b[0;-11;-12mlias {name} \x1b[3mprofile\x1b[0;-11;-12m');
                        if (args.length === 2) {
                            profile = this.stripQuotes(args[1]);
                            profile = this.parseInline(profile);
                            if (this.client.profiles.contains(profile))
                                profile = this.client.profiles.items[profile.toLowerCase()];
                            else {
                                name = profile;
                                reload = false;
                                profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
                                if (!profile)
                                    throw new Error('Profile not found: ' + name);
                            }
                        }
                        else
                            profile = this.client.activeProfile;
                        if (args[0].match(/^".*"$/g) || args[0].match(/^'.*'$/g))
                            n = this.parseInline(this.stripQuotes(args[0]));
                        else
                            n = this.parseInline(args[0].substr(1, args[0].length - 2));
                    }
                    else {
                        n = this.parseInline(args.join(' '));
                        profile = this.client.activeProfile;
                    }
                    items = profile.aliases;
                    n = this.stripQuotes(n);
                    if (/^\s*?\d+\s*?$/.exec(n)) {
                        tmp = n;
                        n = parseInt(n, 10);
                        if (n < 0 || n >= items.length)
                            throw new Error('Alias index must be >= 0 and < ' + items.length);
                        else
                            f = true;
                    }
                    else {
                        tmp = n;
                        n = items.findIndex(i => i.pattern === n);
                        f = n !== -1;
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'sets\x1b[0;-11;-12metting name value');
                else if (args.length === 1)
                    throw new Error('Must supply a setsetting value');
                else {
                    n = this.stripQuotes(this.parseInline(args[0]));
                    args = this.stripQuotes(this.parseInline(args.slice(1).join(' ')));
                    if (/^\s*?\d+\s*?$/.exec(n)) {
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'gets\x1b[0;-11;-12metting name');
                else {
                    n = this.stripQuotes(this.parseInline(args.join(' ')));
                    if (/^\s*?\d+\s*?$/.exec(n)) {
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
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.echo('\x1b[4mProfiles:\x1b[0m', -7, -8, true, true);
                p = parseTemplate('{profiles}');
                if (isDirSync(p)) {
                    const files = fs.readdirSync(p);
                    al = files.length;
                    for (i = 0; i < al; i++) {
                        if (path.extname(files[i]) === '.json') {
                            if (this.client.profiles.items[path.basename(files[i], '.json')] && this.client.profiles.items[path.basename(files[i], '.json')].enabled)
                                this.client.echo('   ' + this.client.profiles.keys[i] + ' is enabled', -7, -8, true, true);
                            else
                                this.client.echo('   ' + path.basename(files[i], '.json') + ' is disabled', -7, -8, true, true);
                        }
                    }
                }
                return null;
            case 'profile':
            case 'pro':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'pro\x1b[0;-11;-12mfile name or \x1b[4m' + cmdChar + 'pro\x1b[0;-11;-12mfile name enable/disable');
                else if (args.length === 1) {
                    args[0] = this.parseInline(args[0]);
                    this.client.toggleProfile(args[0]);
                    if (!this.client.profiles.contains(args[0]))
                        throw new Error('Profile not found');
                    else if (this.client.profiles.length === 1)
                        throw new Error(args[0] + ' can not be disabled as it is the only one enabled');
                    if (this.client.enabledProfiles.indexOf(args[0].toLowerCase()) !== -1)
                        args = args[0] + ' is enabled';
                    else
                        args = args[0] + ' is disabled';
                }
                else {
                    args[0] = this.parseInline(args[0]).toLowerCase();
                    if (!this.client.profiles.contains(args[0])) {
                        this.client.profiles.load(args[0], parseTemplate('{profiles}'));
                        if (!this.client.profiles.contains(args[0]))
                            throw new Error('Profile not found');
                    }
                    if (!args[1])
                        throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'pro\x1b[0;-11;-12mfile name or \x1b[4m' + cmdChar + 'pro\x1b[0;-11;-12mfile name enable/disable');
                    args[1] = this.parseInline(args[1]);
                    switch (args[1].toLowerCase()) {
                        case 'enable':
                        case 'on':
                        case 'yes':
                            if (this.client.enabledProfiles.indexOf(args[0].toLowerCase()) !== -1)
                                args = args[0] + ' is already enabled';
                            else {
                                this.client.toggleProfile(args[0]);
                                if (this.client.enabledProfiles.indexOf(args[0].toLowerCase()) !== -1)
                                    args = args[0] + ' is enabled';
                                else
                                    args = args[0] + ' remains disabled';
                            }
                            break;
                        case 'disable':
                        case 'off':
                        case 'no':
                            if (this.client.enabledProfiles.indexOf(args[0].toLowerCase()) === -1)
                                args = args[0] + ' is already disabled';
                            else {
                                if (this.client.profiles.length === 1)
                                    throw new Error(args[0] + ' can not be disabled as it is the only one enabled');
                                this.client.toggleProfile(args[0]);
                                args = args[0] + ' is disabled';
                            }
                            break;
                        default:
                            throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'pro\x1b[0;-11;-12mfile name or \x1b[4m' + cmdChar + 'pro\x1b[0;-11;-12mfile name enable/disable');
                    }
                }
                if (this.client.telnet.prompt)
                    this.client.print('\n\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                else
                    this.client.print('\x1b[-7;-8m' + args + '\x1b[0m\n', false);
                this.client.telnet.prompt = false;
                return null;
            case 'color':
            case 'co':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length > 1 && args.length < 4) {
                    item = {
                        profile: null,
                        pattern: null,
                        commands: null
                    };
                    item.pattern = args.shift();
                    if (item.pattern.match(/^\{.*\}$/g))
                        item.pattern = this.parseInline(item.pattern.substr(1, item.pattern.length - 2));
                    else
                        item.pattern = this.parseInline(this.stripQuotes(item.pattern));
                    if (args.length === 2) {
                        item.commands = cmdChar + 'COLOR ' + this.parseInline(args[0]);
                        item.profile = this.stripQuotes(args[1]);
                        if (item.profile.length !== 0)
                            item.profile = this.parseInline(item.profile);
                    }
                    else
                        item.commands = cmdChar + 'COLOR ' + this.parseInline(args[0]);
                    this.createTrigger(item.pattern, item.commands, item.profile);
                    return null;
                }
                else if (args.length !== 1)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'co\x1b[0;-11;-12mlor color or \x1b[4m' + cmdChar + 'co\x1b[0;-11;-12mlor {pattern} color \x1b[3mprofile\x1b[0;-11;-12m');
                if (args.length !== 1)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'co\x1b[0;-11;-12mlor color or \x1b[4m' + cmdChar + 'co\x1b[0;-11;-12mlor {pattern} color \x1b[3mprofile\x1b[0;-11;-12m');
                args[0] = this.parseInline(this.stripQuotes(args[0]));
                n = this.client.display.lines.length;
                if (args[0].trim().match(/^[-|+]?\d+$/g)) {
                    setTimeout(() => {
                        n = this.adjustLastLine(n);
                        this.client.display.colorSubStrByLine(n, parseInt(args[0], 10));
                    }, 0);
                }
                //back,fore from color function
                else if (args[0].trim().match(/^[-|+]?\d+\s*?,\s*?[-|+]?\d+$/g)) {
                    args[0] = args[0].split(',');
                    setTimeout(() => {
                        n = this.adjustLastLine(n);
                        this.client.display.colorSubStrByLine(n, parseInt(args[0][0], 10), parseInt(args[0][1], 10));
                    }, 0);
                }
                else {
                    args = args[0].toLowerCase().split(',');
                    if (args.length === 1) {
                        if (args[0] === 'bold')
                            i = 370;
                        if (args[0].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[0].trim();
                        else if (args[0].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[0].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[0]);
                            if (i === -1) {
                                if (isMXPColor(args[0]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid fore color');
                            }
                        }
                        setTimeout(() => {
                            n = this.adjustLastLine(n);
                            this.client.display.colorSubStrByLine(n, i);
                        }, 0);
                    }
                    else if (args.length === 2) {
                        if (args[0] === 'bold' && args[1] === 'bold')
                            throw new Error('Invalid fore color');
                        if (args[0] === 'bold')
                            i = 370;
                        else if (args[0] === 'current')
                            i = null;
                        else if (args[0].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[0].trim();
                        else if (args[0].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[0].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[0]);
                            if (i === -1) {
                                if (isMXPColor(args[0]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid fore color');
                            }
                        }
                        if (args[1] === 'bold') {
                            setTimeout(() => {
                                n = this.adjustLastLine(n);
                                if (i === 370)
                                    this.client.display.colorSubStrByLine(n, i);
                                else
                                    this.client.display.colorSubStrByLine(n, i * 10);
                            }, 0);
                        }
                        else {
                            p = i;
                            if (args[1].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                                i = args[1].trim();
                            else if (args[1].trim().match(/^[-|+]?\d+$/g))
                                i = parseInt(args[1].trim(), 10);
                            else {
                                i = getAnsiColorCode(args[1], true);
                                if (i === -1) {
                                    if (isMXPColor(args[1]))
                                        i = args[1];
                                    else
                                        throw new Error('Invalid back color');
                                }
                            }
                            setTimeout(() => {
                                n = this.adjustLastLine(n);
                                this.client.display.colorSubStrByLine(n, p, i);
                            }, 0);
                        }
                    }
                    else if (args.length === 3) {
                        if (args[0] === 'bold') {
                            args.shift();
                            args.push('bold');
                        }
                        if (args[0].trim() === 'current')
                            i = null;
                        else if (args[0].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[0].trim();
                        else if (args[0].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[0].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[0]);
                            if (i === -1) {
                                if (isMXPColor(args[0]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid fore color');
                            }
                        }
                        if (args[2] !== 'bold')
                            throw new Error('Only bold is supported as third argument');
                        else if (!i)
                            i = 370;
                        else
                            p = i * 10;
                        if (args[1].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[1].trim();
                        else if (args[1].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[1].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[1], true);
                            if (i === -1) {
                                if (isMXPColor(args[1]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid back color');
                            }
                        }
                        setTimeout(() => {
                            n = this.adjustLastLine(n);
                            this.client.display.colorSubStrByLine(n, p, i);
                        }, 0);
                    }
                }
                return null;
            case 'cw':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                trigger = this.stack.regex;
                if (args.length > 1 && args.length < 4) {
                    item = {
                        profile: null,
                        pattern: null,
                        commands: null
                    };
                    item.pattern = args.shift();
                    if (item.pattern.match(/^\{.*\}$/g))
                        item.pattern = this.parseInline(item.pattern.substr(1, item.pattern.length - 2));
                    else
                        item.pattern = this.parseInline(this.stripQuotes(item.pattern));
                    if (args.length === 2) {
                        item.commands = cmdChar + 'CW ' + this.parseInline(args[0]);
                        item.profile = this.stripQuotes(args[1]);
                        if (item.profile.length !== 0)
                            item.profile = this.parseInline(item.profile);
                    }
                    else
                        item.commands = cmdChar + 'CW ' + this.parseInline(args[0]);
                    this.createTrigger(item.pattern, item.commands, item.profile);
                    return null;
                }
                else if (args.length !== 1)
                    throw new Error('Invalid syntax use ' + cmdChar + 'cw color or ' + cmdChar + 'cw {pattern} color \x1b[3mprofile\x1b[0;-11;-12m');
                //no regex so
                if (!trigger) return null;
                args[0] = this.parseInline(this.stripQuotes(args[0]));
                n = this.client.display.lines.length;
                if (args[0].trim().match(/^[-|+]?\d+$/g)) {
                    setTimeout(() => {
                        n = this.adjustLastLine(n);
                        //verbatim so color whole line
                        if (trigger.length === 1)
                            this.client.display.colorSubStrByLine(n, parseInt(args[0], 10));
                        else {
                            trigger[1].lastIndex = 0;
                            tmp = trigger[0].matchAll(trigger[1]);
                            for (const match of tmp) {
                                this.client.display.colorSubStrByLine(n, parseInt(args[0], 10), null, match.index, match[0].length);
                            }
                        }
                    }, 0);
                }
                //back,fore from color function
                else if (args[0].trim().match(/^[-|+]?\d+,[-|+]?\d+$/g)) {
                    args[0] = args[0].split(',');
                    setTimeout(() => {
                        n = this.adjustLastLine(n);
                        //verbatim so color whole line
                        if (trigger.length === 1)
                            this.client.display.colorSubStrByLine(n, parseInt(args[0][0], 10), parseInt(args[0][1], 10));
                        else {
                            trigger[1].lastIndex = 0;
                            tmp = trigger[0].matchAll(trigger[1]);
                            for (const match of tmp) {
                                this.client.display.colorSubStrByLine(n, parseInt(args[0], 10), parseInt(args[0][1], 10), match.index, match[0].length);
                            }
                        }
                    }, 0);
                }
                else {
                    args = args[0].toLowerCase().split(',');
                    if (args.length === 1) {
                        if (args[0] === 'bold')
                            i = 370;
                        if (args[0].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[0].trim();
                        else if (args[0].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[0].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[0]);
                            if (i === -1) {
                                if (isMXPColor(args[0]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid fore color');
                            }
                        }
                        setTimeout(() => {
                            n = this.adjustLastLine(n);
                            //verbatim so color whole line
                            if (trigger.length === 1)
                                this.client.display.colorSubStrByLine(n, i);
                            else {
                                trigger[1].lastIndex = 0;
                                tmp = trigger[0].matchAll(trigger[1]);
                                for (const match of tmp) {
                                    this.client.display.colorSubStrByLine(n, i, null, match.index, match[0].length);
                                }
                            }
                        }, 0);
                    }
                    else if (args.length === 2) {
                        if (args[0] === 'bold' && args[1] === 'bold')
                            throw new Error('Invalid fore color');
                        if (args[0] === 'bold')
                            i = 370;
                        else if (args[0] === 'current')
                            i = null;
                        else if (args[0].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[0].trim();
                        else if (args[0].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[0].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[0]);
                            if (i === -1) {
                                if (isMXPColor(args[0]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid fore color');
                            }
                        }
                        if (args[1] === 'bold') {
                            setTimeout(() => {
                                n = this.adjustLastLine(n);
                                if (i !== 370)
                                    i *= 10;
                                //verbatim so color whole line
                                if (trigger.length === 1)
                                    this.client.display.colorSubStrByLine(n, i);
                                else {
                                    trigger[1].lastIndex = 0;
                                    tmp = trigger[0].matchAll(trigger[1]);
                                    for (const match of tmp) {
                                        this.client.display.colorSubStrByLine(n, i, null, match.index, match[0].length);
                                    }
                                }
                            }, 0);
                        }
                        else {
                            p = i;
                            if (args[1].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                                i = args[1].trim();
                            else if (args[1].trim().match(/^[-|+]?\d+$/g))
                                i = parseInt(args[1].trim(), 10);
                            else {
                                i = getAnsiColorCode(args[1], true);
                                if (i === -1) {
                                    if (isMXPColor(args[1]))
                                        i = args[1];
                                    else
                                        throw new Error('Invalid back color');
                                }
                            }
                            setTimeout(() => {
                                n = this.adjustLastLine(n);
                                //verbatim so color whole line
                                if (trigger.length === 1)
                                    this.client.display.colorSubStrByLine(n, p, i);
                                else {
                                    trigger[1].lastIndex = 0;
                                    tmp = trigger[0].matchAll(trigger[1]);
                                    for (const match of tmp) {
                                        this.client.display.colorSubStrByLine(n, p, i, match.index, match[0].length);
                                    }
                                }
                            }, 0);
                        }
                    }
                    else if (args.length === 3) {
                        if (args[0] === 'bold') {
                            args.shift();
                            args.push('bold');
                        }
                        if (args[0].trim() === 'current')
                            i = null;
                        else if (args[0].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[0].trim();
                        else if (args[0].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[0].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[0]);
                            if (i === -1) {
                                if (isMXPColor(args[0]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid fore color');
                            }
                        }
                        if (args[2] !== 'bold')
                            throw new Error('Only bold is supported as third argument');
                        else if (!i)
                            i = 370;
                        else
                            p = i * 10;
                        if (args[1].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[1].trim();
                        else if (args[1].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[1].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[1], true);
                            if (i === -1) {
                                if (isMXPColor(args[1]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid back color');
                            }
                        }
                        setTimeout(() => {
                            n = this.adjustLastLine(n);
                            //verbatim so color whole line
                            if (trigger.length === 1)
                                this.client.display.colorSubStrByLine(n, p, i);
                            else {
                                trigger[1].lastIndex = 0;
                                tmp = trigger[0].matchAll(trigger[1]);
                                for (const match of tmp) {
                                    this.client.display.colorSubStrByLine(n, p, i, match.index, match[0].length);
                                }
                            }
                        }, 0);
                    }
                }
                return null;
            case 'pcol':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 1 || args.length > 5)
                    throw new Error('Invalid syntax use ' + cmdChar + 'pcol color \x1b[3mXStart, XEnd, YStart, YEnd\x1b[0;-11;-12m');
                if (args.length > 1) {
                    tmp = [].concat(...args.slice(1).map(s => this.parseInline(this.stripQuotes(s)).split(' ')));
                    if (tmp.length > 4)
                        throw new Error('Too many arguments use ' + cmdChar + 'pcol color \x1b[3mXStart, XEnd, YStart, YEnd\x1b[0;-11;-12m');
                    item = { xStart: 0 };
                    if (tmp.length > 0)
                        item.xStart = parseInt(tmp[0], 10);
                    if (tmp.length > 1)
                        item.xEnd = parseInt(tmp[1], 10);
                    if (tmp.length > 2)
                        item.yStart = parseInt(tmp[2], 10);
                    if (tmp.length > 3)
                        item.yEnd = parseInt(tmp[3], 10);
                    if (item.hasOwnProperty('yEnd') && item.yEnd > item.yStart)
                        throw new Error('yEnd must be smaller or equal to yStart');
                    if (item.hasOwnProperty('xEnd') && item.xEnd < item.xStart)
                        throw new Error('xEnd must be larger or equal to xStart');
                }
                else
                    item = { xStart: 0 };
                args[0] = this.parseInline(this.stripQuotes(args[0]));
                n = this.adjustLastLine(this.client.display.lines.length);
                if (args[0].trim().match(/^[-|+]?\d+$/g)) {
                    setTimeout(() => {
                        this.colorPosition(n, parseInt(args[0], 10), null, item);
                    }, 0);
                }
                //back,fore from color function
                else if (args[0].trim().match(/^[-|+]?\d+\s*?,\s*?[-|+]?\d+$/g)) {
                    args[0] = args[0].split(',');
                    setTimeout(() => {
                        this.colorPosition(n, parseInt(args[0][0], 10), parseInt(args[0][1], 10), item);
                    }, 0);
                }
                else {
                    args = args[0].toLowerCase().split(',');
                    if (args.length === 1) {
                        if (args[0] === 'bold')
                            i = 370;
                        if (args[0].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[0].trim();
                        else if (args[0].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[0].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[0]);
                            if (i === -1) {
                                if (isMXPColor(args[0]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid fore color');
                            }
                        }
                        setTimeout(() => {
                            this.colorPosition(n, i, null, item);
                        }, 0);
                    }
                    else if (args.length === 2) {
                        if (args[0] === 'bold' && args[1] === 'bold')
                            throw new Error('Invalid fore color');
                        if (args[0] === 'bold')
                            i = 370;
                        else if (args[0] === 'current')
                            i = null;
                        else if (args[0].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[0].trim();
                        else if (args[0].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[0].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[0]);
                            if (i === -1) {
                                if (isMXPColor(args[0]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid fore color');
                            }
                        }
                        if (args[1] === 'bold') {
                            setTimeout(() => {
                                this.colorPosition(n, i === 370 ? i : i * 10, null, item);
                            }, 0);
                        }
                        else {
                            p = i;
                            if (args[1].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                                i = args[1].trim();
                            else if (args[1].trim().match(/^[-|+]?\d+$/g))
                                i = parseInt(args[1].trim(), 10);
                            else {
                                i = getAnsiColorCode(args[1], true);
                                if (i === -1) {
                                    if (isMXPColor(args[1]))
                                        i = args[1];
                                    else
                                        throw new Error('Invalid back color');
                                }
                            }
                            setTimeout(() => {
                                this.colorPosition(n, p, i, item);
                            }, 0);
                        }
                    }
                    else if (args.length === 3) {
                        if (args[0] === 'bold') {
                            args.shift();
                            args.push('bold');
                        }
                        if (args[0].trim() === 'current')
                            i = null;
                        else if (args[0].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[0].trim();
                        else if (args[0].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[0].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[0]);
                            if (i === -1) {
                                if (isMXPColor(args[0]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid fore color');
                            }
                        }
                        if (args[2] !== 'bold')
                            throw new Error('Only bold is supported as third argument');
                        else if (!i)
                            i = 370;
                        else
                            p = i * 10;
                        if (args[1].trim().match(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})\b$/g))
                            i = args[1].trim();
                        else if (args[1].trim().match(/^[-|+]?\d+$/g))
                            i = parseInt(args[1].trim(), 10);
                        else {
                            i = getAnsiColorCode(args[1], true);
                            if (i === -1) {
                                if (isMXPColor(args[1]))
                                    i = args[0];
                                else
                                    throw new Error('Invalid back color');
                            }
                        }
                        setTimeout(() => {
                            this.colorPosition(n, p, i, item);
                        }, 0);
                    }
                }
                return null;
            case 'highlight':
            case 'hi':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length > 0 && args.length < 2) {
                    item = {
                        profile: null,
                        pattern: null,
                        commands: cmdChar + 'HIGHLIGHT'
                    };
                    item.pattern = args.shift();
                    if (item.pattern.match(/^\{.*\}$/g))
                        item.pattern = this.parseInline(item.pattern.substr(1, item.pattern.length - 2));
                    else
                        item.pattern = this.parseInline(this.stripQuotes(item.pattern));
                    if (args.length === 1)
                        item.profile = this.parseInline(this.stripQuotes(args[0]));
                    this.createTrigger(item.pattern, item.commands, item.profile);
                    return null;
                }
                else if (args.length)
                    throw new Error('Too many arguments use \x1b[4m' + cmdChar + 'hi\x1b[0;-11;-12mghlight \x1b[3mpattern profile\x1b[0;-11;-12m');
                n = this.client.display.lines.length;
                setTimeout(() => {
                    n = this.adjustLastLine(n);
                    this.client.display.highlightSubStrByLine(n);
                }, 0);
                return null;
            case 'break':
            case 'br':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'br\x1b[0;-11;-12meak\x1b[0;-11;-12m');
                if (!this.loops.length)
                    throw new Error('\x1b[4m' + cmdChar + 'br\x1b[0;-11;-12meak\x1b[0;-11;-12m must be used in a loop.');
                if (this.stack.break)
                    this.stack.break++;
                else
                    this.stack.break = 1;
                return -1;
            case 'continue':
            case 'cont':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'cont\x1b[0;-11;-12minue\x1b[0;-11;-12m');
                if (!this.loops.length)
                    throw new Error('\x1b[4m' + cmdChar + 'cont\x1b[0;-11;-12minue\x1b[0;-11;-12m must be used in a loop.');
                this.stack.continue = true;
                return -2;
            case 'if':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (!args.length || args.length > 3)
                    throw new Error('Invalid syntax use ' + cmdChar + 'if {expression} {true-command} \x1b[3m{false-command}\x1b[0;-11;-12m');
                if (args[0].match(/^\{[\s\S]*\}$/g))
                    args[0] = args[0].substr(1, args[0].length - 2);
                tmp = null;
                if (this.evaluate(this.parseInline(args[0]))) {
                    if (args[1].match(/^\{[\s\S]*\}$/g))
                        args[1] = args[1].substr(1, args[1].length - 2);
                    tmp = this.parseOutgoing(args[1]);
                }
                else if (args.length > 2) {
                    if (args[2].match(/^\{[\s\S]*\}$/g))
                        args[2] = args[2].substr(1, args[2].length - 2);
                    tmp = this.parseOutgoing(args[2]);
                }
                if (tmp != null && tmp.length > 0)
                    return tmp;
                return null;
            case 'case':
            case 'ca':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (!args.length || args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'ca\x1b[0;-11;-12mse\x1b[0;-11;-12m index {command 1} \x1b[3m{command n}\x1b[0;-11;-12m');
                if (args[0].match(/^\{[\s\S]*\}$/g))
                    args[0] = args[0].substr(1, args[0].length - 2);
                n = this.evaluate(this.parseInline(args[0]));
                if (typeof n !== 'number')
                    return null;
                if (n > 0 && n < args.length) {
                    if (args[n].match(/^\{[\s\S]*\}$/g))
                        args[n] = args[n].substr(1, args[n].length - 2);
                    tmp = this.parseOutgoing(args[n]);
                    if (tmp != null && tmp.length > 0)
                        return tmp;
                }
                return null;
            case 'switch':
            case 'sw':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (!args.length || args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'sw\x1b[0;-11;-12mitch\x1b[0;-11;-12m (expression) {command} \x1b[3m(expression) {command} ... {else_command}\x1b[0;-11;-12m');
                if (args.length % 2 === 1)
                    n = args.pop();
                else
                    n = null;
                al = args.length;
                //skip every other one as odd items are the commands to execute
                for (i = 0; i < al; i += 2) {
                    if (args[i].match(/^\{[\s\S]*\}$/g))
                        args[i] = args[i].substr(1, args[i].length - 2);
                    if (this.evaluate(this.parseInline(args[i]))) {
                        if (args[i + 1].match(/^\{[\s\S]*\}$/g))
                            args[i + 1] = args[i + 1].substr(1, args[i + 1].length - 2);
                        tmp = this.parseOutgoing(args[i + 1]);
                        if (tmp != null && tmp.length > 0)
                            return tmp;
                        return null;
                    }
                }
                if (n) {
                    if (n.match(/^\{[\s\S]*\}$/g))
                        n = n.substr(1, n.length - 2);
                    tmp = this.parseOutgoing(n);
                    if (tmp != null && tmp.length > 0)
                        return tmp;
                }
                return null
            case 'loop':
            case 'loo':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'loo\x1b[0;-11;-12mp\x1b[0;-11;-12m range {commands}');
                n = this.parseInline(args.shift()).split(',');
                args = args.join(' ');
                if (args.match(/^\{[\s\S]*\}$/g))
                    args = args.substr(1, args.length - 2);
                if (n.length === 1) {
                    tmp = parseInt(n[0], 10);
                    if (isNaN(tmp))
                        throw new Error('Invalid loop range \'' + n[0] + '\' must be a number');
                    return this.executeForLoop(0, tmp, args);
                }
                tmp = parseInt(n[0], 10);
                if (isNaN(tmp))
                    throw new Error('Invalid loop min \'' + n[0] + '\' must be a number');
                i = parseInt(n[1], 10);
                if (isNaN(i))
                    throw new Error('Invalid loop max \'' + n[1] + '\' must be a number');
                if (tmp > i) tmp++;
                else tmp--;
                return this.executeForLoop(tmp, i, args);
            case 'repeat':
            case 'rep':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'rep\x1b[0;-11;-12meat\x1b[0;-11;-12m expression {commands}');
                i = args.shift();
                if (i.match(/^\{[\s\S]*\}$/g))
                    i = i.substr(1, i.length - 2);
                i = this.evaluate(this.parseInline(i));
                if (typeof i !== 'number')
                    throw new Error('Arguments must be a number');
                args = args.join(' ');
                if (args.match(/^\{[\s\S]*\}$/g))
                    args = args.substr(1, args.length - 2);
                if (i < 1)
                    return this.executeForLoop((-i) + 1, 1, args);
                return this.executeForLoop(0, i, args);
            case 'until':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 2)
                    throw new Error('Invalid syntax use ' + cmdChar + 'until expression {commands}');
                i = args.shift();
                if (i.match(/^\{[\s\S]*\}$/g))
                    i = i.substr(1, i.length - 2);
                args = args.join(' ');
                if (args.match(/^\{[\s\S]*\}$/g))
                    args = args.substr(1, args.length - 2);
                tmp = [];
                this.loops.push(0);
                while (!this.evaluate(this.parseInline(i))) {
                    let out = this.parseOutgoing(args);
                    if (out != null && out.length > 0)
                        tmp.push(out);
                    if (this.stack.continue) {
                        this.stack.continue = false;
                        continue;
                    }
                    if (this.stack.break) {
                        this.stack.break--;
                        break;
                    }
                }
                this.loops.pop();
                if (tmp.length > 0)
                    return tmp.map(v => v.trim()).join('\n');
                return null;
            case 'while':
            case 'wh':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'wh\x1b[0;-11;-12mile expression {commands}');
                i = args.shift();
                if (i.match(/^\{[\s\S]*\}$/g))
                    i = i.substr(1, i.length - 2);
                args = args.join(' ');
                if (args.match(/^\{[\s\S]*\}$/g))
                    args = args.substr(1, args.length - 2);
                tmp = [];
                this.loops.push(0);
                while (this.evaluate(this.parseInline(i))) {
                    let out = this.parseOutgoing(args);
                    if (out != null && out.length > 0)
                        tmp.push(out);
                    if (this.stack.continue) {
                        this.stack.continue = false;
                        continue;
                    }
                    if (this.stack.break) {
                        this.stack.break--;
                        break;
                    }
                }
                this.loops.pop();
                if (tmp.length > 0)
                    return tmp.map(v => v.trim()).join('\n');
                return null;
            case 'forall':
            case 'fo':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'fo\x1b[0;-11;-12mrall stringlist {commands}');
                i = args.shift();
                if (i.match(/^\{[\s\S]*\}$/g))
                    i = i.substr(1, i.length - 2);
                args = args.join(' ');
                if (args.match(/^\{[\s\S]*\}$/g))
                    args = args.substr(1, args.length - 2);
                tmp = [];
                i = this.splitByQuotes(this.stripQuotes(this.parseInline(i)), '|');
                al = i.length;
                for (n = 0; n < al; n++) {
                    this.loops.push(i[n]);
                    let out = this.parseOutgoing(args);
                    if (out != null && out.length > 0)
                        tmp.push(out);
                    if (this.stack.continue) {
                        this.stack.continue = false;
                        continue;
                    }
                    if (this.stack.break) {
                        this.stack.break--;
                        break;
                    }
                    this.loops.pop();
                }
                if (tmp.length > 0)
                    return tmp.map(v => v.trim()).join('\n');
                return null;
            case 'variable':
            case 'var':
            case 'va':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0) {
                    i = Object.keys(this.client.variables);
                    al = i.length;
                    tmp = [];
                    for (n = 0; n < al; n++)
                        tmp.push(i[n] + ' = ' + this.client.variables[i[n]]);
                    return tmp.join('\n');
                }
                i = args.shift();
                if (i.match(/^\{.*\}$/g))
                    i = i.substr(1, i.length - 2);
                i = this.parseInline(i);
                if (!isValidIdentifier(i))
                    throw new Error("Invalid variable name");
                if (args.length === 0)
                    return this.client.variables[i]?.toString();
                args = args.join(' ');
                if (args.match(/^\{[\s\S]*\}$/g))
                    args = args.substr(1, args.length - 2);
                args = this.parseInline(args);
                if (args.match(/^\s*?[-|+]?\d+\s*?$/))
                    this.client.variables[i] = parseInt(args, 10);
                else if (args.match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                    this.client.variables[i] = parseFloat(args);
                else if (args === "true")
                    this.client.variables[i] = true;
                else if (args === "false")
                    this.client.variables[i] = false;
                else
                    this.client.variables[i] = this.stripQuotes(args);
                return null;
            case 'unvar':
            case 'unv':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length !== 1)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'unv\x1b[0;-11;-12mar name ');
                i = args.shift();
                if (i.match(/^\{[\s\S]*\}$/g))
                    i = i.substr(1, i.length - 2);
                i = this.parseInline(i);
                delete this.client.variables[i];
                return null;
            case 'add':
            case 'ad':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'ad\x1b[0;-11;-12md name value');
                i = args.shift();
                if (i.match(/^\{[\s\S]*\}$/g))
                    i = i.substr(1, i.length - 2);
                i = this.parseInline(i);
                if (this.client.variables.hasOwnProperty(i) && typeof this.client.variables[i] !== 'number')
                    throw new Error(i + ' is not a number for add');
                args = args.join(' ');
                if (args.match(/^\{[\s\S]*\}$/g))
                    args = args.substr(1, args.length - 2);
                args = this.evaluate(this.parseInline(args));
                if (typeof args !== 'number')
                    throw new Error('Value is not a number for add');
                if (!this.client.variables.hasOwnProperty(i))
                    this.client.variables[i] = args;
                else
                    this.client.variables[i] += args;
                return null;
            case 'math':
            case 'mat':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length < 2)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'mat\x1b[0;-11;-12mh name value');
                i = args.shift();
                if (i.match(/^\{[\s\S]*\}$/g))
                    i = i.substr(1, i.length - 2);
                i = this.parseInline(i);
                args = args.join(' ');
                if (args.match(/^\{[\s\S]*\}$/g))
                    args = args.substr(1, args.length - 2);
                args = this.evaluate(this.parseInline(args));
                if (typeof args !== 'number')
                    throw new Error('Value is not a number for add');
                this.client.variables[i] = args;
                return null;
            case 'evaluate':
            case 'eva':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'eva\x1b[0;-11;-12mluate expression');
                args = this.evaluate(this.parseInline(args.join(' ')));
                if (this.client.getOption('ignoreEvalUndefined') && typeof args === 'undefined')
                    args = '';
                else
                    args = '' + args;
                if (this.client.telnet.prompt)
                    this.client.print('\n' + args + '\x1b[0m\n', false);
                else
                    this.client.print(args + '\x1b[0m\n', false);
                this.client.telnet.prompt = false;
                return null
            case 'freeze':
            case 'fr':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#region freeze
                if (args.length === 0) {
                    this.scrollLock = !this.scrollLock;
                    if (this.scrollLock) {
                        if (this.client.display.scrollAtBottom)
                            this.client.display.scrollUp();
                    }
                    else {
                        if (this.client.display.split && this.client.display.split.shown)
                            this.client.display.scrollDisplay(true);
                    }
                }
                else if (args.length === 1) {
                    if (args[0] === "0" || args[0] === "false") {
                        if (this.scrollLock) {
                            this.scrollLock = false;
                            if (this.client.display.split && this.client.display.split.shown)
                                this.client.display.scrollDisplay(true);
                        }
                    }
                    else if (!this.scrollLock) {
                        this.scrollLock = true;
                        if (this.client.display.scrollAtBottom)
                            this.client.display.scrollUp();
                    }
                }
                else if (args.length > 1)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'fr\x1b[0;-11;-12meeze \x1b[3mnumber\x1b[0;-11;-12m');
                return null;
            //#endregion freeze                
            case 'clr':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length)
                    throw new Error('Invalid syntax use ' + cmdChar + 'CLR');
                //nothing to clear so just bail
                if (this.client.display.lines.length === 0)
                    return null;
                i = this.client.display.WindowSize.height + 2;
                //skip trailing new lines
                n = this.client.display.lines.length;
                while (n-- && i) {
                    if (this.client.display.lines[n].text.length)
                        break;
                    i--;
                }
                tmp = [];
                while (i--)
                    tmp.push('\n');
                this.client.print(tmp.join(''), true);
                return null;
            case 'fire':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                args = this.parseInline(args.join(' ') + '\n');
                this.ExecuteTriggers(TriggerTypes.Regular | TriggerTypes.Pattern | TriggerTypes.LoopExpression, args, args, false, false);
                return null;
            case 'state': //#STATE id state profile
            case 'sta':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //setup args for easy use
                args = args.map(m => {
                    if (!m || !m.length)
                        return m;
                    if (m.match(/^\{.*\}$/g))
                        return this.parseInline(m.substr(1, m.length - 2));
                    return this.parseInline(this.stripQuotes(m));
                })
                switch (args.length) {
                    case 0:
                        throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'sta\x1b[0;-11;-12mte \x1b[3m name|pattern state profile\x1b[0;-11;-12m');
                    case 1:
                        //state
                        if (args[0].match(/^\s*?[-|+]?\d+\s*?$/)) {
                            if (!this._LastTrigger)
                                throw new Error("No trigger has fired yet, unable to set state");
                            trigger = this._LastTrigger;
                            n = trigger.state;
                            trigger.state = parseInt(args[0], 10);
                        }
                        else {
                            //name|pattern
                            const keys = this.client.profiles.keys;
                            let k = 0;
                            const kl = keys.length;
                            if (kl === 0)
                                return null;
                            if (kl === 1) {
                                if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                                    throw Error('No enabled profiles found!');
                                trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                trigger = trigger.find(t => {
                                    return t.name === args[0] || t.pattern === args[0];
                                });
                            }
                            else {
                                for (; k < kl; k++) {
                                    if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                        continue;
                                    trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                    trigger = trigger.find(t => {
                                        return t.name === args[0] || t.pattern === args[0];
                                    });
                                    if (trigger)
                                        break;
                                }
                            }
                            if (!trigger)
                                throw new Error("Trigger not found: " + args[0]);
                            n = trigger.state;
                            trigger.state = 0;
                        }
                        break;
                    case 2:
                        if (args[0].match(/^\s*?[-|+]?\d+\s*?$/))
                            throw new Error('Invalid argument to ' + cmdChar + 'state, first argument must be name|pattern');
                        //name|pattern state
                        if (args[1].match(/^\s*?[-|+]?\d+\s*?$/)) {
                            const keys = this.client.profiles.keys;
                            let k = 0;
                            const kl = keys.length;
                            if (kl === 0)
                                return null;
                            if (kl === 1) {
                                if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                                    throw Error('No enabled profiles found!');
                                trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                trigger = trigger.find(t => {
                                    return t.name === args[0] || t.pattern === args[0];
                                });
                            }
                            else {
                                for (; k < kl; k++) {
                                    if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                        continue;
                                    trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                    trigger = trigger.find(t => {
                                        return t.name === args[0] || t.pattern === args[0];
                                    });
                                    if (trigger)
                                        break;
                                }
                            }
                            if (!trigger)
                                throw new Error("Trigger not found: " + args[0]);
                            n = trigger.state;
                            trigger.state = parseInt(args[1], 10);
                        }
                        //name|pattern profile
                        else {
                            profile = args[1];
                            if (this.client.profiles.contains(profile))
                                profile = this.client.profiles.items[profile.toLowerCase()];
                            else {
                                profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
                                if (!profile)
                                    throw new Error('Profile not found: ' + args[1]);
                            }
                            trigger = SortItemArrayByPriority(profile.triggers);
                            trigger = trigger.find(t => {
                                return t.name === args[0] || t.pattern === args[0];
                            });
                            if (!trigger)
                                throw new Error("Trigger not found: " + args[0] + " in profile: " + profile.name);
                            n = trigger.state;
                            trigger.state = 0;
                        }
                        break;
                    case 3: //name|pattern state profile
                        if (args[0].match(/^\s*?[-|+]?\d+\s*?$/))
                            throw new Error('Invalid argument to ' + cmdChar + 'state, first argument must be name|pattern');
                        profile = args[2];
                        if (this.client.profiles.contains(profile))
                            profile = this.client.profiles.items[profile.toLowerCase()];
                        else {
                            profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
                            if (!profile)
                                throw new Error('Profile not found: ' + args[2]);
                        }
                        trigger = SortItemArrayByPriority(profile.triggers);
                        trigger = trigger.find(t => {
                            return t.name === args[0] || t.pattern === args[0];
                        });
                        if (!trigger)
                            throw new Error("Trigger not found: " + args[0]);
                        n = trigger.state;
                        trigger.state = parseInt(args[1], 10);
                        break;
                    default:
                        throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'sta\x1b[0;-11;-12mte \x1b[3m name|pattern state profile\x1b[0;-11;-12m');
                }
                if (trigger.state < 0 || trigger.state > trigger.triggers.length) {
                    trigger.state = n;
                    throw new Error("Trigger state must be greater than or equal to 0 or less than or equal to " + trigger.triggers.length);
                }
                i = trigger.fired;
                trigger.fired = false;
                this.resetTriggerState(this._TriggerCache.indexOf(trigger), n, i);
                this.client.restartAlarmState(trigger, n, trigger.state);
                this.client.saveProfile(trigger.profile.name, true, ProfileSaveType.Trigger);
                this.client.emit('item-updated', 'trigger', trigger.profile.name, trigger.profile.triggers.indexOf(trigger), trigger);
                this.client.echo('Trigger state set to ' + trigger.state + '.', -7, -8, true, true);
                return null;
            case 'set':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#SET pattern|name state value profile
                //setup args for easy use
                args = args.map(m => {
                    if (!m || !m.length)
                        return m;
                    if (m.match(/^\{.*\}$/g))
                        return this.parseInline(m.substr(1, m.length - 2));
                    return this.parseInline(this.stripQuotes(m));
                })
                n = 0;
                i = false;
                switch (args.length) {
                    case 0: //state - set fired to true for last trigger
                        throw new Error('Invalid syntax use ' + cmdChar + 'set \x1b[3mname|pattern\x1b[0;-11;-12m state \x1b[3mvalue profile\x1b[0;-11;-12m');
                    case 1:
                        //state
                        if (args[0].match(/^\s*?[-|+]?\d+\s*?$/)) {
                            if (!this._LastTrigger)
                                throw new Error("No trigger has fired yet, unable to set state");
                            trigger = this._LastTrigger;
                            n = parseInt(args[0], 10)
                            if (n < 0 || n > trigger.triggers.length)
                                throw new Error("Trigger state must be greater than or equal to 0 or less than or equal to " + trigger.triggers.length);
                            if (n === 0) {
                                i = trigger.fired;
                                trigger.fired = true;
                            }
                            else {
                                i = trigger.triggers[n - 1].fired;
                                trigger.triggers[n - 1].fired = true;
                            }
                        }
                        else
                            throw new Error("Trigger state must be greater than or equal to 0 or less than or equal to " + trigger.triggers.length);
                        break;
                    case 2:
                        //state value - set fired to value for last trigger
                        if (args[0].match(/^\s*?[-|+]?\d+\s*?$/)) {
                            if (!this._LastTrigger)
                                throw new Error("No trigger has fired yet, unable to set state");
                            trigger = this._LastTrigger;
                            n = parseInt(args[0], 10)
                            if (n < 0 || n > trigger.triggers.length)
                                throw new Error("Trigger state must be greater than or equal to 0 or less than or equal to " + trigger.triggers.length);
                            if (args[1] !== "0" && args[1] !== "1" && args[1] !== "true" && args[1] !== "false")
                                throw new Error("Value must be 0, 1, true, or false");
                            if (n === 0) {
                                i = trigger.fired;
                                trigger.fired = args[1] === "1" || args[1] === "true";
                            }
                            else {
                                i = trigger.triggers[n - 1].fired;
                                trigger.triggers[n - 1].fired = args[1] === "1" || args[1] === "true";
                            }
                        }
                        //pattern|name state - set trigger state fired to true
                        else {
                            const keys = this.client.profiles.keys;
                            let k = 0;
                            const kl = keys.length;
                            if (kl === 0)
                                return null;
                            if (kl === 1) {
                                if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                                    throw Error('No enabled profiles found!');
                                trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                trigger = trigger.find(t => {
                                    return t.name === args[0] || t.pattern === args[0];
                                });
                            }
                            else {
                                for (; k < kl; k++) {
                                    if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                        continue;
                                    trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                    trigger = trigger.find(t => {
                                        return t.name === args[0] || t.pattern === args[0];
                                    });
                                    if (trigger)
                                        break;
                                }
                            }
                            if (!trigger)
                                throw new Error("Trigger not found: " + args[0]);
                            n = parseInt(args[1], 10)
                            if (n < 0 || n > trigger.triggers.length)
                                throw new Error("Trigger state must be greater than or equal to 0 or less than or equal to " + trigger.triggers.length);
                            if (n === 0) {
                                i = trigger.fired;
                                trigger.fired = true;
                            }
                            else {
                                i = trigger.triggers[n - 1].fired;
                                trigger.triggers[n - 1].fired = true;
                            }
                        }
                        break;
                    case 3:
                        //pattern|name state profile - set trigger state to fired in profile
                        if (args[2] === "0" && args[2] !== "1" && args[2] !== "true" && args[21] !== "false") {
                            profile = args[2];
                            if (this.client.profiles.contains(profile))
                                profile = this.client.profiles.items[profile.toLowerCase()];
                            else {
                                profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
                                if (!profile)
                                    throw new Error('Profile not found: ' + args[1]);
                            }
                            trigger = SortItemArrayByPriority(profile.triggers);
                            trigger = trigger.find(t => {
                                return t.name === args[0] || t.pattern === args[0];
                            });
                            if (!trigger)
                                throw new Error("Trigger not found: " + args[0] + " in profile: " + profile.name);
                            n = parseInt(args[1], 10)
                            if (n < 0 || n > trigger.triggers.length)
                                throw new Error("Trigger state must be greater than or equal to 0 or less than or equal to " + trigger.triggers.length);
                            if (n === 0) {
                                i = trigger.fired;
                                trigger.fired = true;
                            }
                            else {
                                i = trigger.triggers[n - 1].fired;
                                trigger.triggers[n - 1].fired = true;
                            }
                        }
                        //pattern|name state value - set trigger state fired to value          
                        else {
                            const keys = this.client.profiles.keys;
                            let k = 0;
                            const kl = keys.length;
                            if (kl === 0)
                                return null;
                            if (kl === 1) {
                                if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                                    throw Error('No enabled profiles found!');
                                trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                trigger = trigger.find(t => {
                                    return t.name === args[0] || t.pattern === args[0];
                                });
                            }
                            else {
                                for (; k < kl; k++) {
                                    if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                        continue;
                                    trigger = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                    trigger = trigger.find(t => {
                                        return t.name === args[0] || t.pattern === args[0];
                                    });
                                    if (trigger)
                                        break;
                                }
                            }
                            if (!trigger)
                                throw new Error("Trigger not found: " + args[0]);
                            n = parseInt(args[1], 10)
                            if (n < 0 || n > trigger.triggers.length)
                                throw new Error("Trigger state must be greater than or equal to 0 or less than or equal to " + trigger.triggers.length);
                            if (n === 0) {
                                i = trigger.fired;
                                trigger.fired = args[2] === "1" || args[2] === "true";
                            }
                            else {
                                i = trigger.triggers[n - 1].fired;
                                trigger.triggers[n - 1].fired = args[2] === "1" || args[2] === "true";
                            }
                        }
                        break;
                    case 4:
                        //pattern|name state value profile - set trigger state to value in profile 
                        profile = args[2];
                        if (this.client.profiles.contains(profile))
                            profile = this.client.profiles.items[profile.toLowerCase()];
                        else {
                            profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
                            if (!profile)
                                throw new Error('Profile not found: ' + args[1]);
                        }
                        trigger = SortItemArrayByPriority(profile.triggers);
                        trigger = trigger.find(t => {
                            return t.name === args[0] || t.pattern === args[0];
                        });
                        if (!trigger)
                            throw new Error("Trigger not found: " + args[0] + " in profile: " + profile.name);
                        if (args[2] !== "0" && args[2] !== "1" && args[2] !== "true" && args[2] !== "false")
                            throw new Error("Value must be 0, 1, true, or false");
                        if (n === 0) {
                            i = trigger.fired;
                            trigger.fired = args[2] === "1" || args[2] === "true";
                        }
                        else {
                            i = trigger.triggers[n - 1].fired;
                            trigger.triggers[n - 1].fired = args[2] === "1" || args[2] === "true";
                        }
                        break;
                    default:
                        throw new Error('Invalid syntax use ' + cmdChar + 'set \x1b[3mname|pattern\x1b[0;-11;-12m state \x1b[3mvalue profile\x1b[0;-11;-12m');
                }
                this.client.saveProfile(trigger.profile.name, true, ProfileSaveType.Trigger);
                this.client.emit('item-updated', 'trigger', trigger.profile.name, trigger.profile.triggers.indexOf(trigger), trigger);
                this.resetTriggerState(this._TriggerCache.indexOf(trigger), n, i);
                if (n === 0)
                    this.client.echo('Trigger state 0 fired state set to ' + trigger.fired + '.', -7, -8, true, true);
                else {
                    this.client.echo('Trigger state ' + n + ' fired state set to ' + trigger.triggers[n - 1].fired + '.', -7, -8, true, true);
                    //manual trigger fire it using set type
                    if (trigger.enabled && trigger.triggers[n - 1].enabled && trigger.triggers[n - 1].type === SubTriggerTypes.Manual) {
                        this._LastTriggered = '';
                        this.ExecuteTrigger(trigger, [], false, this._TriggerCache.indexOf(trigger), 0, 0, trigger);
                    }
                }
                return null;
            case 'condition':
            case 'cond':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#region condition
                item = {
                    profile: null,
                    name: null,
                    pattern: null,
                    commands: null,
                    options: { priority: 0 }
                };
                p = parseTemplate('{profiles}');
                if (args.length < 2 || args.length > 5)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'cond\x1b[0;-11;-12mition name|pattern {pattern} {commands} \x1b[3moptions profile\x1b[0;-11;-12m or \x1b[4m' + cmdChar + 'cond\x1b[0;-11;-12mition {pattern} {commands} \x1b[3m{options} profile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid trigger name or pattern');

                if (args[0].match(/^\{.*\}$/g)) {
                    item.pattern = args.shift();
                    item.pattern = this.parseInline(item.pattern.substr(1, item.pattern.length - 2));
                }
                else {
                    item.name = this.parseInline(this.stripQuotes(args.shift()));
                    if (!item.name || item.name.length === 0)
                        throw new Error('Invalid trigger name');
                    if (args[0].match(/^\{.*\}$/g)) {
                        item.pattern = args.shift();
                        item.pattern = this.parseInline(item.pattern.substr(1, item.pattern.length - 2));
                    }
                }
                if (args.length !== 0) {
                    if (args[0].match(/^\{[\s\S]*\}$/g)) {
                        item.commands = args.shift();
                        item.commands = item.commands.substr(1, item.commands.length - 2);
                    }
                    if (args.length === 1) {
                        if (args[0].match(/^\{[\s\S]*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        else
                            args[0] = this.stripQuotes(args[0]);
                        if (args[0].length !== 0) {
                            this.parseInline(args[0]).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nocr':
                                    case 'prompt':
                                    case 'case':
                                    case 'verbatim':
                                    case 'disable':
                                    case 'enable':
                                    case 'cmd':
                                    case 'temporary':
                                    case 'temp':
                                    case 'raw':
                                    case 'pattern':
                                    case 'regular':
                                    case 'alarm':
                                    case 'event':
                                    case 'cmdpattern':
                                    case 'loopexpression':
                                    //case 'expression':
                                    case 'reparse':
                                    case 'reparsepattern':
                                    case 'manual':
                                    case 'skip':
                                    case 'looplines':
                                    case 'looppattern':
                                    case 'wait':
                                    case 'duration':
                                    case 'withinlines':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('param=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger param option '${o.trim()}'`);
                                            item.options['params'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('type=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger type option '${o.trim()}'`);
                                            if (!this.isTriggerType(tmp[1]))
                                                throw new Error('Invalid trigger type');
                                            item.options['type'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
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
                        if (args[0].match(/^\{[\s\S]*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        if (args[0].length !== 0) {
                            this.parseInline(args[0]).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nocr':
                                    case 'prompt':
                                    case 'case':
                                    case 'verbatim':
                                    case 'disable':
                                    case 'enable':
                                    case 'cmd':
                                    case 'temporary':
                                    case 'temp':
                                    case 'raw':
                                    case 'pattern':
                                    case 'regular':
                                    case 'alarm':
                                    case 'event':
                                    case 'cmdpattern':
                                    case 'loopexpression':
                                    //case 'expression':
                                    case 'reparse':
                                    case 'reparsepattern':
                                    case 'manual':
                                    case 'skip':
                                    case 'looplines':
                                    case 'looppattern':
                                    case 'wait':
                                    case 'duration':
                                    case 'withinlines':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('param=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger param option '${o.trim()}'`);
                                            item.options['params'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('type=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid trigger type option '${o.trim()}'`);
                                            if (!this.isTriggerType(tmp[1]))
                                                throw new Error('Invalid trigger type');

                                            item.options['type'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
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
                            item.profile = this.parseInline(item.profile);
                    }
                }
                this.createTrigger(item.pattern, item.commands, item.profile, item.options, item.name, true);
                //#endregion
                return null;
            case 'cr':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.sendBackground('\n');
                return null;
            case 'send':
            case 'se':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'se\x1b[0;-11;-12mnd file \x1b[3mprefix suffix\x1b[0;-11;-12m or \x1b[4m' + cmdChar + 'se\x1b[0;-11;-12mnd text');
                tmp = this.stripQuotes(this.parseInline(args[0]));
                if (isFileSync(tmp)) {
                    p = '';
                    i = '';
                    if (args.length > 1)
                        p = this.stripQuotes(this.parseInline(args[1]));
                    if (args.length > 2)
                        i = this.stripQuotes(this.parseInline(args[2]));
                    //handle \n and \r\n for windows and linux files
                    items = fs.readFileSync(f, 'utf8').split(/\r?\n/);
                    items.forEach(line => {
                        this.client.sendBackground(p + line + i, null, this.client.getOption('allowCommentsFromCommand'));
                    });
                }
                else {
                    args = args.join(' ');
                    if (args.length === 0)
                        throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'se\x1b[0;-11;-12mnd file \x1b[3mprefix suffix\x1b[0;-11;-12m or \x1b[4m' + cmdChar + 'se\x1b[0;-11;-12mnd text');
                    this.client.sendBackground(this.stripQuotes(args), this.client.getOption('allowCommentsFromCommand'));
                }
                return null
            case 'sendraw':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'sendraw text or ' + cmdChar + 'sendraw file \x1b[3mprefix suffix\x1b[0;-11;-12m');
                tmp = this.stripQuotes(this.parseInline(args[0]));
                if (isFileSync(tmp)) {
                    p = '';
                    i = '';
                    if (args.length > 1)
                        p = this.stripQuotes(this.parseInline(args[1]));
                    if (args.length > 2)
                        i = this.stripQuotes(this.parseInline(args[2]));
                    //handle \n and \r\n for windows and linux files
                    items = fs.readFileSync(f, 'utf8').split(/\r?\n/);
                    items.forEach(line => {
                        this.client.sendRaw(p + line + i + '\n');
                    });
                }
                else {
                    args = args.join(' ');
                    if (args.length === 0)
                        throw new Error('Invalid syntax use ' + cmdChar + 'sendraw text or ' + cmdChar + 'sendraw file \x1b[3mprefix suffix\x1b[0;-11;-12m');
                    if (!args.endsWith('\n'))
                        args = args + '\n';
                    this.client.sendRaw(args);
                }
                return null;
            case 'sendprompt':
            case 'sendp':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'sendp\x1b[0;-11;-12mrompt text');
                args = args.join(' ');
                if (args.length === 0)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'sendp\x1b[0;-11;-12mrompt text');
                this.client.sendRaw(args);
                return null;
            case 'character':
            case 'char':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                this.client.sendRaw(window.$character || '');
                return null;
            case 'speak':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'speak text');
                args = args.join(' ');
                if (args.length === 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'speak text');
                args = this.stripQuotes(this.parseInline(args));
                if (args.length !== 0)
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance(args));
                return null;
            case 'speakstop':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length !== 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'speakstop');
                window.speechSynthesis.cancel();
                return null;
            case 'speakpause':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length !== 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'speakpause');
                window.speechSynthesis.pause();
                return null;
            case 'speakresume':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length !== 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'speakresume');
                window.speechSynthesis.resume();
                return null;
            case 'comment':
            case 'comm':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                return null;
            case 'noop':
            case 'no':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length)
                    this.parseInline(args.join(' '));
                return null;
            case 'temp':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //#region temp
                item = {
                    profile: null,
                    name: null,
                    pattern: null,
                    commands: null,
                    options: { priority: 0 }
                };
                p = parseTemplate('{profiles}');
                if (args.length < 2 || args.length > 5)
                    throw new Error('Invalid syntax use ' + cmdChar + 'temp name {pattern} {commands} \x1b[3moptions profile\x1b[0;-11;-12m or ' + cmdChar + 'temp {pattern} {commands} \x1b[3m{options} profile\x1b[0;-11;-12m');
                if (args[0].length === 0)
                    throw new Error('Invalid temporary trigger or pattern');

                if (args[0].match(/^\{.*\}$/g)) {
                    item.pattern = args.shift();
                    item.pattern = this.parseInline(item.pattern.substr(1, item.pattern.length - 2));
                }
                else {
                    item.name = this.parseInline(this.stripQuotes(args.shift()));
                    if (!item.name || item.name.length === 0)
                        throw new Error('Invalid temporary trigger name');
                    if (args[0].match(/^\{.*\}$/g)) {
                        item.pattern = args.shift();
                        item.pattern = this.parseInline(item.pattern.substr(1, item.pattern.length - 2));
                    }
                }
                if (args.length !== 0) {
                    if (args[0].match(/^\{[\s\S]*\}$/g)) {
                        item.commands = args.shift();
                        item.commands = item.commands.substr(1, item.commands.length - 2);
                    }
                    if (args.length === 1) {
                        if (args[0].match(/^\{[\s\S]*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        else
                            args[0] = this.stripQuotes(args[0]);
                        if (args[0].length !== 0) {
                            this.parseInline(args[0]).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nocr':
                                    case 'prompt':
                                    case 'case':
                                    case 'verbatim':
                                    case 'disable':
                                    case 'enable':
                                    case 'cmd':
                                    case 'raw':
                                    case 'pattern':
                                    case 'regular':
                                    case 'alarm':
                                    case 'event':
                                    case 'cmdpattern':
                                    case 'loopexpression':
                                        //case 'expression':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('param=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid temporary trigger param option '${o.trim()}'`);
                                            item.options['params'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('type=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid temporary trigger type option '${o.trim()}'`);
                                            if (!this.isTriggerType(tmp[1], TriggerTypeFilter.Main))
                                                throw new Error('Invalid temporary trigger type');
                                            item.options['type'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid temporary trigger priority option '${o.trim()}'`);
                                            i = parseInt(tmp[1], 10);
                                            if (isNaN(i))
                                                throw new Error('Invalid temporary trigger priority value \'' + tmp[1] + '\' must be a number');
                                            item.options['priority'] = i;
                                        }
                                        else
                                            throw new Error(`Invalid temporary trigger option '${o.trim()}'`);
                                }
                            });
                        }
                        else
                            throw new Error('Invalid temporary trigger options');
                    }
                    else if (args.length === 2) {
                        if (args[0].match(/^\{[\s\S]*\}$/g))
                            args[0] = args[0].substr(1, args[0].length - 2);
                        if (args[0].length !== 0) {
                            this.parseInline(args[0]).split(',').forEach(o => {
                                switch (o.trim()) {
                                    case 'nocr':
                                    case 'prompt':
                                    case 'case':
                                    case 'verbatim':
                                    case 'disable':
                                    case 'enable':
                                    case 'cmd':
                                    case 'raw':
                                    case 'pattern':
                                    case 'regular':
                                    case 'alarm':
                                    case 'event':
                                    case 'cmdpattern':
                                    case 'loopexpression':
                                        //case 'expression':
                                        item.options[o.trim()] = true;
                                        break;
                                    default:
                                        if (o.trim().startsWith('param=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid temporary trigger param option '${o.trim()}'`);
                                            item.options['params'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('type=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid temporary trigger type option '${o.trim()}'`);
                                            if (!this.isTriggerType(tmp[1], TriggerTypeFilter.Main))
                                                throw new Error('Invalid temporary trigger type');

                                            item.options['type'] = tmp[1];
                                        }
                                        else if (o.trim().startsWith('pri=') || o.trim().startsWith('priority=')) {
                                            tmp = o.trim().split('=');
                                            if (tmp.length !== 2)
                                                throw new Error(`Invalid temporary trigger priority option '${o.trim()}'`);
                                            i = parseInt(tmp[1], 10);
                                            if (isNaN(i))
                                                throw new Error('Invalid temporary trigger priority value \'' + tmp[1] + '\' must be a number');
                                            item.options['priority'] = i;
                                        }
                                        else
                                            throw new Error(`Invalid temporary trigger option '${o.trim()}'`);
                                }
                            });
                        }
                        else
                            throw new Error('Invalid temporary trigger options');
                        item.profile = this.stripQuotes(args[1]);
                        if (item.profile.length !== 0)
                            item.profile = this.parseInline(item.profile);
                    }
                }
                item.options.temporary = true;
                this.createTrigger(item.pattern, item.commands, item.profile, item.options, item.name);
                //#endregion
                return null;
            case 'wrap':
            case 'wr':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                //filter out empty arguments to avoid trailing spaces
                args = args.filter(a => a);
                if (args.length > 1)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'wr\x1b[0;-11;-12map or \x1b[4m' + cmdChar + 'wr\x1b[0;-11;-12map number');
                if (args.length === 0) {
                    this.client.options.display.wordWrap = !this.client.getOption('display.wordWrap');
                    this.client.display.wordWrap = this.client.getOption('display.wordWrap');
                    this.client.saveOptions();
                }
                else {
                    i = parseInt(this.parseInline(args[0]), 10);
                    if (isNaN(i))
                        throw new Error('Invalid number \'' + i + '\' for wrap');
                    if (i < 0)
                        throw new Error('Must be greater then or equal to zero for wrap');
                    this.client.options.display.wordWrap = true;
                    this.client.options.display.wrapAt = i;
                    this.client.display.wordWrap = true;
                    this.client.display.wrapAt = i;
                    this.client.saveOptions();
                }
                return null;
            case 'prompt':
            case 'pr':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0 || args.length > 4)
                    throw new Error('Invalid syntax use \x1b[4m' + cmdChar + 'pr\x1b[0;-11;-12mompt variable \x1b[3mmessage defaultValue mask\x1b[0;-11;-12m');
                else {
                    i = args.shift();
                    if (i.match(/^\{.*\}$/g))
                        i = i.substr(1, i.length - 2);
                    i = this.parseInline(i);
                    if (!isValidIdentifier(i))
                        throw new Error("Invalid variable name");
                    args = args.map(a => this.parseInline(this.stripQuotes(a)))
                    if (args.length === 3 && args[2] && args[2].toLowerCase() === 'true')
                        args[2] = true;
                    args = window.prompt(...args);
                    if (args?.match(/^\s*?[-|+]?\d+\s*?$/))
                        this.client.variables[i] = parseInt(args, 10);
                    else if (args?.match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                        this.client.variables[i] = parseFloat(args);
                    else if (args === "true")
                        this.client.variables[i] = true;
                    else if (args === "false")
                        this.client.variables[i] = false;
                    else
                        this.client.variables[i] = args;
                }
                return null;
            case 'setmap':
                if ((this.client.getOption('echo') & 4) === 4)
                    this.client.echo(raw, -3, -4, true, true);
                if (args.length === 0)
                    throw new Error('Invalid syntax use ' + cmdChar + 'setmap file \x1b[3msetCharacter\x1b[0;-11;-12m');
                tmp = parseTemplate(this.stripQuotes(this.parseInline(args.shift())) || '');
                if (!tmp || !tmp.length)
                    throw new Error('Empty file\x1b[0;-11;-12m');
                if (args.length > 1)
                    p = this.stripQuotes(this.parseInline(args.join(' '))).toLocaleLowerCase().trim();
                else
                    p = '';
                setMapFile(tmp, p === 'true' || p === 'yes', true);
                return null;
        }
        if (fun.match(/^[-|+]?\d+$/)) {
            if ((this.client.getOption('echo') & 4) === 4)
                this.client.echo(raw, -3, -4, true, true);
            i = parseInt(fun, 10);
            if (args.length === 0)
                throw new Error('Invalid syntax use ' + cmdChar + 'nnn commands');
            args = args.join(' ');
            if (args.match(/^\{[\s\S]*\}$/g))
                args = args.substr(1, args.length - 2);
            if (i < 1)
                return this.executeForLoop((-i) + 1, 1, args);
            return this.executeForLoop(0, i, args);
        }
        const data = { name: fun, args: args, raw: raw, handled: false, return: null };
        this.client.emit('function', data);
        if (data.handled) {
            if ((this.client.getOption('echo') & 4) === 4)
                this.client.echo(raw, -3, -4, true, true);
            return data.return;
        }
        if (data.raw.startsWith(cmdChar))
            return cmdChar + this.parseOutgoing(data.raw.substr(1), null, null, null, true);
        return this.parseOutgoing(data.raw + '\n', null, null, null, true);
    }

    private executeForLoop(start: number, end: number, commands: string) {
        let tmp = [];
        let r: number;
        if (start > end) {
            for (r = start - 1; r >= end; r--) {
                this.loops.push(r);
                try {
                    let out = this.parseOutgoing(commands);
                    if (out != null && out.length > 0)
                        tmp.push(out);
                    if (this.stack.continue) {
                        this.stack.continue = false;
                        continue;
                    }
                    if (this.stack.break) {
                        this.stack.break--;
                        break;
                    }
                }
                catch (e) {
                    throw e;
                }
                finally {
                    this.loops.pop();
                }
            }
        }
        else {
            for (r = start; r < end; r++) {
                this.loops.push(r + 1);
                try {
                    let out = this.parseOutgoing(commands);
                    if (out != null && out.length > 0)
                        tmp.push(out);
                    if (this.stack.continue) {
                        this.stack.continue = false;
                        continue;
                    }
                    if (this.stack.break) {
                        this.stack.break--;
                        break;
                    }
                }
                catch (e) {
                    throw e;
                }
                finally {
                    this.loops.pop();
                }
            }
        }
        if (tmp.length > 0)
            return tmp.map(v => v.trim()).join('\n');
        return null;
    }

    public parseInline(text) {
        return this.parseOutgoing(text, false, null, false, true);
    }

    public parseOutgoing(text: string, eAlias?: boolean, stacking?: boolean, append?: boolean, noFunctions?: boolean, noComments?: boolean) {
        const tl = text.length;
        if (!this.enableParsing || text == null || tl === 0)
            return text;
        let str: string = '';
        let alias: string = '';
        let AliasesCached;
        let state = 0;
        //store as local vars to speed up parsing
        const aliases = this.client.aliases;
        const stackingChar: string = this.client.getOption('commandStackingChar');
        const spChar: string = this.client.getOption('speedpathsChar');
        const ePaths: boolean = this.client.getOption('enableSpeedpaths');
        const eCmd: boolean = this.client.getOption('enableCommands');
        const cmdChar: string = this.client.getOption('commandChar');
        const eEscape: boolean = this.client.getOption('allowEscape');
        const escChar: string = this.client.getOption('escapeChar');
        const verbatimChar: string = this.client.getOption('verbatimChar');
        const eVerbatim: boolean = this.client.getOption('enableVerbatim');
        const eParamEscape: boolean = this.client.getOption('enableDoubleParameterEscaping');
        const paramChar: string = this.client.getOption('parametersChar');
        const eParam: boolean = this.client.getOption('enableParameters');
        const nParamChar: string = this.client.getOption('nParametersChar');
        const eNParam: boolean = this.client.getOption('enableNParameters');
        const eEval: boolean = this.client.getOption('allowEval');
        const iEval: boolean = this.client.getOption('ignoreEvalUndefined');
        const iComments: boolean = this.client.getOption('enableInlineComments') && !noComments;
        const bComments: boolean = this.client.getOption('enableBlockComments') && !noComments;
        const iCommentsStr: string[] = this.client.getOption('inlineCommentString').split('');
        const bCommentsStr: string[] = this.client.getOption('blockCommentString').split('');
        const bTrim: boolean = this.client.getOption('ignoreInputLeadingWhitespace');
        let sTrim = '';
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
        let _pos: boolean = false;
        let _fall: boolean = false;
        let nest: number = 0;
        const pd: boolean = this.client.getOption('parseDoubleQuotes');
        const ps: boolean = this.client.getOption('parseSingleQuotes');

        if (eAlias == null)
            eAlias = aliases.length > 0;
        else
            eAlias = eAlias && aliases.length > 0;

        //if no character set treat it as disabled
        if (stackingChar.length === 0)
            stacking = false;
        else if (stacking == null)
            stacking = this.client.getOption('commandStacking');
        else
            stacking = stacking && this.client.getOption('commandStacking');

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
                    else if (eEscape && c === escChar) {
                        state = ParseState.aliasArgumentsEscape;
                        start = false;
                    }
                    //end of alias at end of text, new line, or command stack if enabled
                    else if (idx === tl - 1 || c === '\n' || (stacking && c === stackingChar)) {
                        if (!(c === '\n' || (stacking && c === stackingChar)))
                            arg += c;
                        //save any arg that was found
                        if (arg.length > 0)
                            args.push(this.parseInline(arg));
                        al = AliasesCached.length;
                        for (a = 0; a < al; a++) {
                            str = this.ExecuteAlias(AliasesCached[a], args);
                            if (typeof str === 'number') {
                                if (str >= 0)
                                    this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
                                if (out.length === 0) return null;
                                return out;
                            }
                            if (str !== null) out += str;
                            str = '';
                            if (!a.multi) break;
                            if (this.stack.continue || this.stack.break) {
                                if (out.length === 0) return null;
                                return out;
                            }
                        }
                        alias = '';
                        state = ParseState.none;
                        AliasesCached = null;
                        start = true;
                    }
                    //space so new argument
                    else if (c === ' ') {
                        args.push(this.parseInline(arg));
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
                case ParseState.aliasArgumentsEscape:
                    state = ParseState.aliasArguments;
                    if (c === escChar || (stacking && c === stackingChar) || (eVerbatim && c === verbatimChar) || (ePaths && c === spChar) || (eCmd && c === cmdChar) || (eParamEscape && c === paramChar) || (eNParam && c === nParamChar))
                        arg += c;
                    else if (iComments && c == iCommentsStr[0])
                        tmp2 = c;
                    else if (bComments && c == bCommentsStr[0])
                        tmp2 = c;
                    else if ('"\'{'.indexOf(c) !== -1)
                        arg += c;
                    else
                        arg += escChar + c;
                    break;
                case ParseState.path: //path found
                    if (eEscape && c === escChar) {
                        state = ParseState.pathEscape;
                        start = false;
                    }
                    else if (c === '\n' || (stacking && c === stackingChar)) {
                        state = ParseState.none;
                        str = this.ProcessPath(str);
                        if (str !== null) out += str;
                        str = '';
                        start = true;
                        if (this.stack.continue || this.stack.break) {
                            if (out.length === 0) return null;
                            return out;
                        }
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
                case ParseState.pathEscape:
                    state = ParseState.path;
                    if (c === escChar || (stacking && c === stackingChar) || (eVerbatim && c === verbatimChar) || (ePaths && c === spChar) || (eCmd && c === cmdChar) || (eParamEscape && c === paramChar) || (eNParam && c === nParamChar))
                        str += c;
                    else if (iComments && c == iCommentsStr[0])
                        tmp2 = c;
                    else if (bComments && c == bCommentsStr[0])
                        tmp2 = c;
                    else if ('"\'{'.indexOf(c) !== -1)
                        str += c;
                    else
                        str += escChar + c;
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
                    else if (nest === 0 && eEscape && c === escChar) {
                        state = ParseState.functionEscape;
                        start = false;
                    }
                    else if (nest === 0 && (c === '\n' || (stacking && c === stackingChar))) {
                        state = ParseState.none;
                        str = this.executeScript(cmdChar + str);
                        if (typeof str === 'number') {
                            if (str >= 0)
                                this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
                            if (out.length === 0) return null;
                            return out;
                        }
                        if (str !== null) {
                            out += sTrim + str + '\n';
                            /*
                            if (str.startsWith(cmdChar))
                                out += cmdChar + this.parseOutgoing(str.substr(1));
                            else
                                out += this.parseOutgoing(str);
                            */
                        }
                        if (this.stack.continue || this.stack.break) {
                            if (out.length === 0) return null;
                            return out;
                        }
                        str = '';
                        start = true;
                    }
                    else {
                        str += c;
                        start = false;
                    }
                    break;
                case ParseState.functionEscape:
                    state = ParseState.function;
                    str += escChar + c;
                    break;
                case ParseState.paramsP:
                    if (c === '{' && arg.length === 0) {
                        state = ParseState.paramsPBlock;
                        continue;
                    }
                    /*
                    if (eEscape && c === escChar && arg.length === 0) {
                        state = ParseState.paramsPEscape;
                        continue;
                    }
                    */
                    switch (c) {
                        case paramChar:
                            if (arg.length === 0) {
                                if (eAlias && findAlias)
                                    alias += paramChar;
                                else
                                    str += paramChar;
                                state = ParseState.none;
                                if (!eParamEscape)
                                    idx--;
                            }
                            break;
                        case '*':
                            if (arg.length === 0) {
                                if (this.stack.args) {
                                    if (eAlias && findAlias)
                                        alias += this.stack.args.slice(1).join(' ');
                                    else
                                        str += this.stack.args.slice(1).join(' ');
                                    this.stack.used = this.stack.args.length;
                                }
                                else if (eAlias && findAlias)
                                    alias += paramChar + '*';
                                else
                                    str += paramChar + '*';
                                state = ParseState.none;
                                break;
                            }
                        case '-':
                            if (arg.length === 0) {
                                _neg = true;
                                break;
                            }
                            else if (_pos && arg.length == 1) {
                                _neg = true;
                                break;
                            }
                            else
                                _fall = true;
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
                            if (!_fall) {
                                arg += c;
                                break;
                            }
                        case 'x':
                            if (!_fall && arg.length === 0) {
                                _pos = true;
                                break;
                            }
                        default:
                            if (this.stack.args && arg.length > 0) {
                                tmp = parseInt(arg, 10);
                                if (_pos) {
                                    if (_neg && this.stack.args.indices && tmp < this.stack.args.length)
                                        tmp = this.stack.indices.slice(tmp).map(v => v ? (v[0] + ' ' + v[1]) : '0 0').join(' ');
                                    else if (this.stack.args.indices && tmp < this.stack.args.length)
                                        tmp = this.stack.args.indices[tmp] ? (this.stack.args.indices[tmp][0] + ' ' + this.stack.args.indices[tmp][1]) : '0 0';
                                    else if (_neg)
                                        tmp = paramChar + 'x-' + tmp;
                                    else
                                        tmp = paramChar + 'x' + tmp;
                                }
                                else {
                                    if (_neg && tmp < this.stack.args.length)
                                        tmp = this.stack.args.slice(arg).join(' ');
                                    else if (tmp < this.stack.args.length)
                                        tmp = this.stack.args[tmp];
                                    else if (_neg)
                                        tmp = paramChar + '-' + tmp;
                                    else
                                        tmp = paramChar + tmp;
                                    if (_neg)
                                        this.stack.used = this.stack.args.length;
                                    else if (arg > this.stack.used)
                                        this.stack.used = parseInt(arg, 10);
                                }
                                if (eAlias && findAlias)
                                    alias += tmp;
                                else
                                    str += tmp;
                                idx--;
                            }
                            else {
                                if (arg.length === 0 && this.loops.length > 0) {
                                    tmp = c.charCodeAt(0) - 105;
                                    if (tmp >= 0 && tmp < 18 && tmp < this.loops.length) {
                                        if (eAlias && findAlias)
                                            alias += this.loops[tmp];
                                        else
                                            str += this.loops[tmp];
                                        state = ParseState.none;
                                        break;
                                    }
                                }
                                if (eAlias && findAlias) {
                                    alias += paramChar;
                                    if (_neg)
                                        alias += '-';
                                    if (_pos)
                                        alias += 'x';
                                }
                                else {
                                    str += paramChar;
                                    if (_neg)
                                        str += '-';
                                    if (_pos)
                                        str += 'x';
                                }
                                idx = idx - arg.length - 1;
                            }
                            state = ParseState.none;
                            arg = '';
                            break;
                    }
                    break;
                case ParseState.paramsPNamed:
                    if (c.match(/[^a-zA-Z0-9_]/g)) {
                        if (this.stack.named.hasOwnProperty(arg)) {
                            if (eAlias && findAlias)
                                alias += this.stack.named[arg];
                            else
                                str += this.stack.named[arg];
                        }
                        else if (eAlias && findAlias)
                            alias += paramChar + arg;
                        else
                            str += paramChar + arg;
                        idx--;
                        state = ParseState.none;
                        arg = '';
                    }
                    else
                        arg += c;
                    break;
                case ParseState.paramsPBlock:
                    if (c === '}' && nest === 0) {
                        if (arg === 'i')
                            tmp2 = this.loops[0];
                        else if (arg === 'repeatnum')
                            tmp2 = this.repeatnum;
                        else if (this.stack.args && arg === '*') {
                            tmp2 = this.stack.args.slice(1).join(' ');
                            this.stack.used = this.stack.args.length;
                        }
                        else if (this.stack.named && this.stack.named.hasOwnProperty(arg))
                            tmp2 = this.stack.named[arg];
                        else {
                            if (this.stack.args && !isNaN(arg)) {
                                tmp = parseInt(arg, 10);
                                if (tmp < 0) {
                                    if (-tmp >= this.stack.args.length) {
                                        if (eEval)
                                            tmp2 = tmp;
                                        else {
                                            tmp2 = paramChar;
                                            idx = idx - tmp.length - 2;
                                        }
                                    }
                                    else {
                                        tmp2 = this.stack.args.slice(tmp).join(' ');
                                        this.stack.used = this.stack.args.length;
                                    }
                                }
                                else if (tmp < this.stack.args.length) {
                                    tmp2 = this.stack.args[tmp];
                                    if (arg > this.stack.used)
                                        this.stack.used = tmp;
                                }
                                else if (eEval)
                                    tmp2 = tmp;
                                else {
                                    tmp2 = paramChar;
                                    idx = idx - arg.length - 2;
                                }
                            }
                            else if (this.stack.args && this.stack.args.indices && arg.match(/^x[-|+]?\d+$/)) {
                                tmp = parseInt(arg.substring(1), 10);
                                if (tmp < 0) {
                                    if (-tmp >= this.stack.args.length) {
                                        tmp2 = paramChar;
                                        idx = idx - tmp.length - 2;
                                    }
                                    else
                                        tmp2 = this.stack.indices.slice(tmp).map(v => v ? (v[0] + ' ' + v[1]) : '0 0').join(' ');
                                }
                                else if (tmp < this.stack.args.length)
                                    tmp2 = this.stack.args.indices[tmp] ? (this.stack.args.indices[tmp][0] + ' ' + this.stack.args.indices[tmp][1]) : '0 0';
                                else {
                                    tmp2 = paramChar;
                                    idx = idx - arg.length - 2;
                                }
                            }
                            else {
                                tmp = this.parseVariable(arg);
                                if (tmp != null)
                                    tmp2 = tmp;
                                else if (eEval) {
                                    tmp2 = this.evaluate(this.parseInline(arg));
                                    if (iEval && typeof tmp2 === 'undefined')
                                        tmp2 = null;
                                    else
                                        tmp2 = '' + tmp2;
                                }
                                else {
                                    tmp2 = paramChar;
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
                /*
                case ParseState.paramsPEscape:
                    if (c === '{')
                        tmp2 = paramChar+'{';
                    else if (c === escChar)
                        tmp2 = paramChar + escChar;
                    else {
                        tmp2 = paramChar + escChar;
                        idx--;
                    }
                    if (eAlias && findAlias)
                        alias += tmp2;
                    else
                        str += tmp2;
                    state = ParseState.none;
                    break;
                */
                case ParseState.paramsN:
                    if (c === '{')
                        state = ParseState.paramsNBlock;
                    /*
                    else if (eEscape && c === escChar)
                        state = ParseState.paramsNEscape;
                    */
                    else if (c.match(/[^a-zA-Z_$]/g)) {
                        state = ParseState.none;
                        idx--;
                        if (eAlias && findAlias)
                            alias += nParamChar;
                        else
                            str += nParamChar;
                    }
                    else {
                        arg = c;
                        state = ParseState.paramsNNamed;
                    }
                    break;
                case ParseState.paramsNNamed:
                    if (c.match(/[^a-zA-Z0-9_]/g)) {
                        if (this.stack.named && this.stack.named.hasOwnProperty(arg)) {
                            if (eAlias && findAlias)
                                alias += this.stack.named[arg];
                            else
                                str += this.stack.named[arg];
                        }
                        else if (this.client.variables.hasOwnProperty(arg)) {
                            if (eAlias && findAlias)
                                alias += this.client.variables[arg];
                            else
                                str += this.client.variables[arg];
                        }
                        else if (eAlias && findAlias)
                            alias += nParamChar + arg;
                        else
                            str += nParamChar + arg;
                        idx--;
                        state = ParseState.none;
                        arg = '';
                    }
                    else
                        arg += c;
                    break;
                /*
                                case ParseState.paramsNEscape:
                                    if (c === '{')
                                        tmp2 = `\{`;
                                    else if (c === escChar) 
                                        tmp2 = escChar;
                                    else {
                                        tmp2 = nParamChar + escChar;
                                        idx--;
                                    }
                                    if (eAlias && findAlias)
                                        alias += tmp2;
                                    else
                                        str += tmp2;
                                    state = ParseState.none;
                                    break;
                                    */
                case ParseState.paramsNBlock:
                    if (c === '}' && nest === 0) {
                        tmp2 = null;
                        if (arg === 'i')
                            tmp2 = this.loops[0];
                        else if (arg === 'repeatnum')
                            tmp2 = this.repeatnum;
                        else if (this.stack.args && arg === '*') {
                            tmp2 = this.stack.args.slice(1).join(' ');
                            this.stack.used = this.stack.args.length;
                        }
                        else if (this.stack.named && this.stack.named.hasOwnProperty(arg))
                            tmp2 = this.stack.named[arg];
                        else {
                            if (this.stack.args && !isNaN(arg)) {
                                tmp = parseInt(arg, 10);
                                if (tmp < 0) {
                                    if (-tmp >= this.stack.args.length) {
                                        if (eEval)
                                            tmp2 = tmp;
                                        else {
                                            tmp2 = nParamChar;
                                            idx = idx - arg.length - 2;
                                        }
                                    }
                                    else {
                                        tmp2 = this.stack.args.slice(tmp).join(' ');
                                        this.stack.used = this.stack.args.length;
                                    }
                                }
                                else if (tmp < this.stack.args.length) {
                                    tmp2 = this.stack.args[tmp];
                                    if (tmp > this.stack.used)
                                        this.stack.used = tmp;
                                }
                                else if (eEval)
                                    tmp2 = tmp;
                                else {
                                    tmp2 = nParamChar;
                                    idx = idx - arg.length - 2;
                                }
                            }
                            else if (this.stack.args && this.stack.args.indices && arg.match(/^x[-|+]?\d+$/)) {
                                tmp = parseInt(arg.substring(1), 10);
                                if (tmp < 0) {
                                    if (-tmp >= this.stack.args.length) {
                                        tmp2 = nParamChar;
                                        idx = idx - arg.length - 2;
                                    }
                                    else
                                        tmp2 = this.stack.indices.slice(tmp).map(v => v ? (v[0] + ' ' + v[1]) : '0 0').join(' ');
                                }
                                else if (tmp < this.stack.args.length)
                                    tmp2 = this.stack.args.indices[tmp] ? (this.stack.args.indices[tmp][0] + ' ' + this.stack.args.indices[tmp][1]) : '0 0';
                                else {
                                    tmp2 = nParamChar;
                                    idx = idx - arg.length - 2;
                                }
                            }
                            else {
                                c = this.parseVariable(arg);
                                if (c != null)
                                    tmp2 = c;
                                else if (eEval) {
                                    tmp2 = this.evaluate(this.parseInline(arg));
                                    if (iEval && typeof tmp2 === 'undefined')
                                        tmp2 = null;
                                    else
                                        tmp2 = '' + tmp2;
                                }
                                else {
                                    tmp2 = nParamChar;
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
                    if (c === escChar || (stacking && c === stackingChar) || (eVerbatim && c === verbatimChar) || (ePaths && c === spChar) || (eCmd && c === cmdChar) || (eParamEscape && c === paramChar) || (eNParam && c === nParamChar))
                        tmp2 = c;
                    else if (iComments && c == iCommentsStr[0])
                        tmp2 = c;
                    else if (bComments && c == bCommentsStr[0])
                        tmp2 = c;
                    else if ('"\'{'.indexOf(c) !== -1)
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
                case ParseState.comment:
                    if (iComments && c === iCommentsStr[1])
                        state = ParseState.inlineComment;
                    else if (bComments && c === bCommentsStr[1])
                        state = ParseState.blockComment;
                    else {
                        state = ParseState.none;
                        if (eAlias && findAlias)
                            alias += iCommentsStr[0];
                        else
                            str += iCommentsStr[0];
                        idx--;
                    }
                    break;
                case ParseState.inlineCommentStart:
                    if (c === iCommentsStr[1])
                        state = ParseState.inlineComment;
                    else {
                        state = ParseState.none;
                        if (eAlias && findAlias)
                            alias += iCommentsStr[0];
                        else
                            str += iCommentsStr[0];
                        idx--;
                    }
                    break;
                case ParseState.blockCommentStart:
                    if (bComments && c === bCommentsStr[1])
                        state = ParseState.blockCommentEnd;
                    else {
                        state = ParseState.none;
                        if (eAlias && findAlias)
                            alias += bCommentsStr[0];
                        else
                            str += bCommentsStr[0];
                        idx--;
                    }
                    break;
                case ParseState.inlineComment:
                    if (c === '\n') {
                        state = ParseState.none;
                        if (!start)
                            idx--;
                        else {
                            alias = '';
                            //new line so need to check for aliases again
                            findAlias = true;
                            start = true;
                        }
                    }
                    break;
                case ParseState.blockComment:
                    if (bCommentsStr.length === 1) {
                        if (c === bCommentsStr[0])
                            state = ParseState.none;
                    }
                    else if (c === bCommentsStr[1])
                        state = ParseState.blockCommentEnd;
                    break;
                case ParseState.blockCommentEnd:
                    if (c === bCommentsStr[0])
                        state = ParseState.none;
                    else
                        state = ParseState.blockComment;
                    break;
                default:
                    if ((iComments || bComments) && c === iCommentsStr[0] && c === bCommentsStr[0]) {
                        if (iComments && iCommentsStr.length === 1)
                            state = ParseState.inlineComment;
                        else if (bComments && bCommentsStr.length === 1)
                            state = ParseState.blockComment;
                        else
                            state = ParseState.comment;
                        continue;
                    }
                    else if (iComments && c === iCommentsStr[0]) {
                        if (iCommentsStr.length === 1)
                            state = ParseState.inlineComment;
                        else
                            state = ParseState.inlineCommentStart;
                        continue;
                    }
                    else if (bComments && c === bCommentsStr[0]) {
                        if (bCommentsStr.length === 1)
                            state = ParseState.blockComment;
                        else
                            state = ParseState.blockCommentStart;
                        continue;
                    }
                    else if (eEscape && c === escChar) {
                        state = ParseState.escape;
                        start = false;
                        continue;
                    }
                    else if (eParam && c === paramChar) {
                        state = ParseState.paramsP;
                        _neg = false;
                        _pos = false;
                        _fall = false;
                        arg = '';
                        start = false;
                    }
                    else if (eNParam && c === nParamChar) {
                        state = ParseState.paramsN;
                        _neg = false;
                        _pos = false;
                        _fall = false;
                        arg = '';
                        start = false;
                    }
                    else if (!noFunctions && eCmd && start && c === cmdChar) {
                        state = ParseState.function;
                        start = false;
                        if (alias.length) {
                            sTrim = alias;
                            alias = '';
                        }
                        else {
                            sTrim = str || '';
                            str = '';
                        }
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
                    //\f\r\t\v\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff
                    else if (start && bTrim && (c === ' ' || c === '\t' || c === '\f' || c === '\r' || c === '\v' || c === '\u0020' || c === '\u00a0' || c === '\u1680' || c === '\u2000-' || c === '\u200a' || c === '\u2028' || c === '\u2029' || c === '\u202f' || c === '\u205f' || c === '\u3000' || c === '\ufeff')) {
                        if (eAlias && findAlias)
                            alias += c;
                        else
                            str += c;
                    }
                    //if looking for an alias and a space check
                    else if (eAlias && findAlias && c === ' ') {
                        AliasesCached = FilterArrayByKeyValue(aliases, 'pattern', bTrim ? alias.trimStart() : alias);
                        //are aliases enabled and does it match an alias?
                        if (AliasesCached.length > 0) {
                            //move to alias parsing
                            state = ParseState.aliasArguments;
                            //init args
                            args.length = 0;
                            arg = '';
                            args.push(bTrim ? alias.trimStart() : alias);
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
                            AliasesCached = FilterArrayByKeyValue(aliases, 'pattern', bTrim ? alias.trimStart() : alias);
                            //are aliases enabled and does it match an alias?
                            if (AliasesCached.length > 0) {
                                args.push(bTrim ? alias.trimStart() : alias);
                                //move to alias parsing
                                al = AliasesCached.length;
                                for (a = 0; a < al; a++) {
                                    str = this.ExecuteAlias(AliasesCached[a], args);
                                    if (typeof str === 'number') {
                                        if (str >= 0)
                                            this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
                                        if (out.length === 0) return null;
                                        return out;
                                    }
                                    if (str !== null) out += str;
                                    if (!a.multi) break;
                                    if (this.stack.continue || this.stack.break) {
                                        if (out.length === 0) return null;
                                        return out;
                                    }
                                }
                                str = '';
                                //init args
                                args.length = 0;
                                arg = '';
                            }
                            else //else not an alias so normal space
                            {
                                str = this.ExecuteTriggers(TriggerTypes.CommandInputRegular | TriggerTypes.CommandInputPattern, alias, alias, false, true);
                                if (typeof str === 'number') {
                                    if (str >= 0)
                                        this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
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
                            str = this.ExecuteTriggers(TriggerTypes.CommandInputRegular | TriggerTypes.CommandInputPattern, str, str, false, true);
                            if (typeof str === 'number') {
                                if (str >= 0)
                                    this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
                                if (out.length === 0) return null;
                                return out;
                            }
                            if (str !== null) out += str + '\n';
                            str = '';
                        }
                        if (this.stack.continue || this.stack.break) {
                            if (out.length === 0) return null;
                            return out;
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
        else if (state === ParseState.paramsNNamed && arg.length > 0) {
            if (this.stack.named && this.stack.named[arg])
                str += this.stack.named[arg];
            else if (this.client.variables.hasOwnProperty(arg))
                str += this.client.variables[arg];
            else {
                arg = this.parseInline(arg);
                str += nParamChar;
                if (arg != null) str += arg;
            }
        }
        else if (state === ParseState.paramsP && arg.length > 0) {
            if (this.stack.args) {
                arg = parseInt(arg, 10);
                if (_pos && this.stack.args.indices && arg < this.stack.args.length)
                    str += this.stack.args.indices[arg] ? (this.stack.args.indices[arg][0] + ' ' + this.stack.args.indices[arg][1]) : '0 0';
                else {
                    if (_neg && arg < this.stack.args.length)
                        str += this.stack.args.slice(arg).join(' ');
                    else if (arg < this.stack.args.length)
                        str += this.stack.args[arg];
                    if (_neg)
                        this.stack.used = this.stack.args.length;
                    else if (arg > this.stack.used)
                        this.stack.used = arg;
                }
            }
            else {
                arg = this.parseInline(arg);
                str += paramChar;
                if (_neg)
                    str += '-';
                if (_pos)
                    str += 'x';
                if (arg != null) str += arg;
            }
        }
        else if (state === ParseState.paramsPBlock) {
            arg = this.parseInline(arg);
            str += paramChar + '{';
            if (arg != null) str += arg;
        }
        else if (state === ParseState.paramsN && arg.length > 0) {
            if (this.stack.named) {
                if (this.stack.named.hasOwnProperty(arg)) {
                    str += this.stack.named[arg];
                }
                else {
                    arg = this.parseInline(arg);
                    str += nParamChar;
                    if (arg != null) str += arg;
                }
            }
            else {
                arg = this.parseInline(arg);
                str += nParamChar;
                if (arg != null) str += arg;
            }
        }
        else if (state === ParseState.paramsNBlock) {
            arg = this.parseInline(arg);
            str += `${nParamChar}{`;
            if (arg != null) str += arg;
        }
        else if (state === ParseState.path) {
            str = this.ProcessPath(str);
            if (str !== null) out += str;
            str = '';
        }
        else if (state === ParseState.comment) {
            str += iCommentsStr[0];
            idx--;
        }
        else if (state === ParseState.inlineCommentStart) {
            str += iCommentsStr[0];
            idx--;
        }
        else if (state === ParseState.blockCommentStart) {
            str += bCommentsStr[0];
            idx--;
        }

        if (!noFunctions && state === ParseState.function) {
            str = this.executeScript(cmdChar + str);
            if (typeof str === 'number') {
                if (str >= 0)
                    this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
                if (out.length === 0) return null;
                return out;
            }
            if (str !== null) {
                if (append && eAlias && this.stack.args && this.stack.append && this.stack.args.length - 1 > 0 && this.stack.used + 1 < this.stack.args.length) {
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
                    this.stack.used = this.stack.args.length;
                    if (r) str += '\n';
                }
                out += sTrim + str;
            }
            else if (out.length === 0) return null;
            if (this.stack.continue || this.stack.break) {
                if (out.length === 0) return null;
                return out;
            }
        }
        else if (state === ParseState.verbatim) {
            if (append && eAlias && this.stack.args && this.stack.append && this.stack.args.length - 1 > 0 && this.stack.used + 1 < this.stack.args.length) {
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
                this.stack.used = this.stack.args.length;
                if (r) str += '\n';
            }
            out += str;
        }
        else if (alias.length > 0 && eAlias && findAlias) {
            if (append && eAlias && this.stack.args && this.stack.append && this.stack.args.length - 1 > 0 && this.stack.used + 1 < this.stack.args.length) {
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
                this.stack.used = this.stack.args.length;
                if (r) str += '\n';
            }
            if (str.length > 0)
                alias += str;
            AliasesCached = FilterArrayByKeyValue(aliases, 'pattern', bTrim ? alias.trimStart() : alias);
            //are aliases enabled and does it match an alias?
            if (AliasesCached.length > 0) {
                //move to alias parsing
                args.push(bTrim ? alias.trimStart() : alias);
                al = AliasesCached.length;
                for (a = 0; a < al; a++) {
                    str = this.ExecuteAlias(AliasesCached[a], args);
                    if (typeof str === 'number') {
                        if (str >= 0)
                            this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
                        if (out.length === 0) return null;
                        return out;
                    }
                    if (str !== null) out += str;
                    else if (out.length === 0) return null;
                    if (this.stack.continue || this.stack.break) {
                        return out;
                    }
                    if (!a.multi) break;
                }
            }
            else //else not an alias so normal space
            {
                str = this.ExecuteTriggers(TriggerTypes.CommandInputRegular | TriggerTypes.CommandInputPattern, alias, alias, false, true);
                if (typeof str === 'number') {
                    if (str >= 0)
                        this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
                    if (out.length === 0) return null;
                    return out;
                }
                if (str !== null) out += str;
                else if (out.length === 0) return null;
                if (this.stack.continue || this.stack.break) {
                    return out;
                }
            }
            AliasesCached = null;
        }
        else if (alias.length > 0) {
            if (str.length > 0)
                alias += str;
            str = this.ExecuteTriggers(TriggerTypes.CommandInputRegular | TriggerTypes.CommandInputPattern, alias, alias, false, true);
            if (typeof str === 'number') {
                if (str >= 0)
                    this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
                if (out.length === 0) return null;
                return out;
            }
            if (str !== null) {
                if (append && eAlias && this.stack.args && this.stack.append && this.stack.args.length - 1 > 0 && this.stack.used + 1 < this.stack.args.length) {
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
                    this.stack.used = this.stack.args.length;
                    if (r) str += '\n';
                }
                out += str;
            }
            else if (out.length === 0) return null;
            if (this.stack.continue || this.stack.break) {
                if (out.length === 0) return null;
                return out;
            }
        }
        else if (str.length > 0) {
            str = this.ExecuteTriggers(TriggerTypes.CommandInputRegular | TriggerTypes.CommandInputPattern, str, str, false, true);
            if (typeof str === 'number') {
                if (str >= 0)
                    this.executeWait(text.substr(idx + 1), str, eAlias, stacking, append, noFunctions, noComments);
                if (out.length === 0) return null;
                return out;
            }
            if (str !== null) {
                if (append && eAlias && this.stack.args && this.stack.append && this.stack.args.length - 1 > 0 && this.stack.used + 1 < this.stack.args.length) {
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
                out += str;
            }
            else if (out.length === 0) return null;
            if (this.stack.continue || this.stack.break) {
                if (out.length === 0) return null;
                return out;
            }
        }

        args.length = 0;
        args = null;
        arg = null;
        alias = null;
        return out;
    }

    public parseVariable(text) {
        let notes;
        let c;
        switch (text) {
            case 'clientid':
                return getId();
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
                return this.loops[0];
            case 'repeatnum':
                return this.vStack['$repeatnum'] || this.repeatnum;
            case 'character':
                return window.$character;
            case 'character.lower':
                return window.$character.toLowerCase();
            case 'character.upper':
                return window.$character.toUpperCase();
            case 'character.proper':
                return ProperCase(window.$character);
            case 'selected':
            case 'selectedurl':
            case 'selectedline':
            case 'selectedword':
            case 'selurl':
            case 'selline':
            case 'selword':
            case 'action':
            case 'trigger':
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
            case 'random':
                return mathjs().randomInt(0, 100);
            case 'charcomment':
            case 'charnotes':
                notes = getCharacterNotes();
                if (isFileSync(notes))
                    return fs.readFileSync(notes, 'utf-8');
                return '';
            case 'clientname':
                return getName();
        }
        if (WindowVariables.indexOf(text) !== -1)
            return this.vStack['$' + text] || window['$' + text] || '';
        if (this.loops.length && text.length === 1) {
            let i = text.charCodeAt(0) - 105;
            if (i >= 0 && i < 18 && i < this.loops.length)
                return this.loops[i];
        }
        const re = new RegExp('^([a-zA-Z]+)\\((.*)\\)$', 'g');
        let res = re.exec(text);
        if (!res || !res.length) return null;
        let sides;
        let mod;
        let args;
        let min;
        let max;
        let escape = this.client.getOption('allowEscape') ? this.client.getOption('escapeChar') : '';
        switch (res[1]) {
            case 'time':
                if (res[2] && res[2].length > 0)
                    return moment().format(this.stripQuotes(this.parseInline(res[2])));
                return moment().format();
            case 'clip':
                if (res[2] && res[2].length > 0) {
                    (<any>this.client).writeClipboard(this.stripQuotes(this.parseInline(res[2])));
                    return null;
                }
                return (<any>this.client).readClipboard();
            case 'lower':
                return this.stripQuotes(this.parseInline(res[2]).toLowerCase());
            case 'upper':
                return this.stripQuotes(this.parseInline(res[2]).toUpperCase());
            case 'proper':
                return ProperCase(this.stripQuotes(this.parseInline(res[2])));
            case 'eval':
                args = this.evaluate(this.parseInline(res[2]));
                if (this.client.getOption('ignoreEvalUndefined') && typeof args === 'undefined')
                    return null;
                return '' + args;
            case 'dice':
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice');
                if (args.length === 1) {
                    res = /(\d+)\s*?d(F|f|%|\d+)(\s*?[-|+|*|\/]?\s*?\d+)?/g.exec(args[0]);
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
                    throw new Error('Too many arguments for dice');

                if (sides === 'F' || sides === 'f')
                    sides = 'F';
                else if (sides !== '%')
                    sides = parseInt(sides);

                let sum = 0;
                for (let i = 0; i < c; i++) {
                    if (sides === 'F' || sides === 'f')
                        sum += fudgeDice();
                    else if (sides === '%')
                        sum += ~~(Math.random() * 100.0) + 1.0;
                    else
                        sum += ~~(Math.random() * sides) + 1;
                }
                if (sides === '%')
                    sum /= 100.0;
                if (mod)
                    return this.evaluate(sum + mod);
                return '' + sum;
            case 'diceavg':
                //The average of any XdY is X*(Y+1)/2.
                //(min + max) / 2 * a + m
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice for diceavg');
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
                    throw new Error('Too many arguments for diceavg');
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
                    return this.evaluate(((min + max) / 2 * c) + mod);
                return '' + ((min + max) / 2 * c);
            case 'dicemin':
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice for dicemin');
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
                    throw new Error('Too many arguments for dicemin');
                min = 1;
                if (sides === 'F' || sides === 'f')
                    min = -1;
                else if (sides === '%')
                    min = 0;

                if (mod)
                    return this.evaluate((min * c) + mod);
                return '' + (min * c);
            case 'dicemax':
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice for dicemax');
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
                    throw new Error('Too many arguments for dicemax');

                if (sides === 'F' || sides === 'f')
                    max = 1;
                else if (sides === '%')
                    max = 1;
                else
                    max = parseInt(sides);
                if (mod)
                    return this.evaluate((max * c) + mod);
                return '' + (max * c);
            case 'zdicedev':
            case 'dicedev':
                const fun = res[1];
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid dice for ' + fun);
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
                    throw new Error('Too many arguments for ' + fun);

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
                    return this.evaluate(Math.sqrt(((max * max) - 1) / 12 * c) + mod);
                return '' + Math.sqrt(((max * max) - 1) / 12 * c);
            case 'color':
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for color');
                else if (args.length === 1) {
                    if (args[0] === 'bold')
                        return '370';
                    c = getAnsiColorCode(args[0]);
                    if (c === -1)
                        throw new Error('Invalid fore color');
                    return c.toString();
                }
                else if (args.length === 2) {
                    if (args[0] === 'bold')
                        c = 370;
                    else {
                        c = getAnsiColorCode(args[0]);
                        if (c === -1)
                            throw new Error('Invalid fore color');
                        if (args[1] === 'bold')
                            return (c * 10).toString();
                    }
                    sides = c.toString();
                    c = getAnsiColorCode(args[1], true);
                    if (c === -1)
                        throw new Error('Invalid back color');
                    return sides + ',' + c.toString();
                }
                else if (args.length === 3) {
                    if (args[0] === 'bold') {
                        args.shift();
                        args.push('bold');
                    }
                    if (args[2] !== 'bold')
                        throw new Error('Only bold is supported as third argument for color');
                    c = getAnsiColorCode(args[0]);
                    if (c === -1)
                        throw new Error('Invalid fore color');
                    sides = (c * 10).toString();
                    c = getAnsiColorCode(args[1], true);
                    if (c === -1)
                        throw new Error('Invalid back color');
                    return sides + ',' + c.toString();
                }
                throw new Error('Too many arguments');
            case 'zcolor':
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for zcolor');
                else if (args.length > 1)
                    throw new Error('Too many arguments for zcolor');
                return getColorCode(parseInt(args[0], 10));
            case 'ansi':
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for ansi');
                c = args.length;
                mod = [];
                min = {};
                for (sides = 0; sides < c; sides++) {
                    if (args[sides].trim() === 'current')
                        mod.push(args[sides].trim());
                    else {
                        max = getAnsiCode(args[sides].trim());
                        if (max === -1)
                            throw new Error('Invalid color or style for ansi');
                        //style
                        if (max >= 0 && max < 30)
                            min[max] = 1;
                        //color
                        else
                            mod.push(args[sides]);
                    }
                }
                // fore,back
                if (mod.length > 2)
                    throw new Error('Too many colors for ansi');
                if (mod.length > 1) {
                    if (mod[1] === 'current')
                        mod[1] = '';
                    else
                        mod[1] = getAnsiCode(mod[1], true);
                }
                if (mod.length > 0) {
                    if (min[1] && mod[0] === 'white')
                        mod[0] = '';
                    else if (mod[0] === 'current')
                        mod[0] = '';
                    else
                        mod[0] = getAnsiCode(mod[0]);
                }

                min = [...Object.keys(min), ...mod]
                if (!min.length)
                    throw new Error('Invalid colors or styles for ansi');
                //remove any current flags
                min = min.filter(f => f !== '');
                return `\x1b[${min.join(';')}m`;
            case 'random':
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0) throw new Error('Invalid random');
                if (args.length === 1)
                    return mathjs().randomInt(0, parseInt(args[0], 10) + 1);
                else if (args.length === 2)
                    return mathjs().randomInt(parseInt(args[0], 10), parseInt(args[1], 10) + 1);
                else
                    throw new Error('Too many arguments for random');
            case 'case': //case(index,n1,n2...)
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for case');
                c = this.evaluate(this.parseInline(args[0]));
                if (typeof c !== 'number')
                    return '';
                if (c > 0 && c < args.length)
                    return this.stripQuotes(args[c]);
                return '';
            case 'switch': //switch(exp,value...)
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for switch');
                if (args.length % 2 === 1)
                    throw new Error('All expressions must have a value for switch');
                sides = args.length;
                for (c = 0; c < sides; c += 2) {
                    if (this.evaluate(args[c]))
                        return this.stripQuotes(args[c + 1]);
                }
                return '';
            case 'if': //if(exp,true,false)
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length < 3)
                    throw new Error('Missing arguments for if');
                if (args.length !== 3)
                    throw new Error('Too many arguments for if');
                if (this.evaluate(args[0]))
                    return this.stripQuotes(args[1].trim());
                return this.stripQuotes(args[2].trim());
            case 'ascii': //ascii(string)
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for ascii');
                else if (args.length > 1)
                    throw new Error('Too many arguments for ascii');
                if (args[0].trim().length === 0)
                    throw new Error('Invalid argument, empty string for ascii');
                return args[0].trim().charCodeAt(0);
            case 'char': //char(number)
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for char');
                else if (args.length > 1)
                    throw new Error('Too many arguments for char');
                c = parseInt(args[0], 10);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0] + '\' must be a number for char');
                return String.fromCharCode(c);
            case 'begins'://(string1,string2)` return true if string 1 starts with string 2
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length < 2)
                    throw new Error('Missing arguments for begins');
                else if (args.length > 2)
                    throw new Error('Too many arguments for begins');
                return this.stripQuotes(args[0]).startsWith(this.stripQuotes(args[1]));
            case 'ends'://(string1, string2)` returns true if string 1 ends with string 2
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length < 2)
                    throw new Error('Missing arguments for ends');
                else if (args.length > 2)
                    throw new Error('Too many arguments for ends');
                return this.stripQuotes(args[0]).endsWith(this.stripQuotes(args[1]));
            case 'len'://(string)` returns the length of string
                return this.stripQuotes(this.parseInline(res[2])).length;
            case 'stripansi':
                const ansiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))', 'g')
                return this.stripQuotes(this.parseInline(res[2])).replace(ansiRegex, '');
            case 'pos'://(pattern,string)` returns the position pattern in string on 1 index scale, 0 if not found
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length < 2)
                    throw new Error('Missing arguments for pos');
                else if (args.length > 2)
                    throw new Error('Too many arguments for pos');
                return this.stripQuotes(args[1]).indexOf(this.stripQuotes(args[0])) + 1;
            case 'ipos'://(pattern,string)` returns the position pattern in string on 1 index scale, 0 if not found
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length < 2)
                    throw new Error('Missing arguments for ipos');
                else if (args.length > 2)
                    throw new Error('Too many arguments for ipos');
                return this.stripQuotes(args[1]).toLowerCase().indexOf(this.stripQuotes(args[0]).toLowerCase()) + 1;
            case 'regex'://(string,regex,var1,...,varN)
                args = this.splitByQuotes(res[2], ',');
                if (args.length < 2)
                    throw new Error('Missing arguments for regex');
                c = new RegExp(this.stripQuotes(args[1]), 'gd');
                c = c.exec(this.stripQuotes(this.parseInline(args[0])));
                args.shift();
                args.shift();
                if (c == null || c.length === 0)
                    return 0;
                if (args.length) {
                    for (sides = 1; sides < c.length; sides++) {
                        if (!args.length)
                            break;
                        this.client.variables[this.stripQuotes(this.parseInline(args[0]))] = c[sides];
                        args.shift();
                    }
                    if (args.length)
                        this.client.variables[this.stripQuotes(this.parseInline(args[0]))] = c[0].length;
                }
                if (!c.indices[0])
                    return 1;
                return c.indices[0][0] + 1;
            case 'trim':
                return this.stripQuotes(this.parseInline(res[2])).trim();
            case 'trimleft':
                return this.stripQuotes(this.parseInline(res[2])).trimLeft();
            case 'trimright':
                return this.stripQuotes(this.parseInline(res[2])).trimRight();
            case 'bitand'://bitand(v1,v2)
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for bitand');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bitand');
                c = parseInt(args[0], 10);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0] + '\' must be a number for bitand');
                sides = parseInt(args[1], 10);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1] + '\' must be a number for bitand');
                return c & sides;
            case 'bitnot'://bitnot(v1)
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for bitnot');
                else if (args.length !== 1)
                    throw new Error('Too many arguments for bitnot');
                c = parseInt(args[0], 10);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0] + '\' must be a number for bitnot');
                return ~c;
            case 'bitor': //bitor(v1,v2)
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for bitor');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bitor');
                c = parseInt(args[0], 10);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0] + '\' must be a number for bitor');
                sides = parseInt(args[1], 10);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1] + '\' must be a number for bitor');
                return c | sides;
            case 'bitset':
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for bitset');
                else if (args.length > 3)
                    throw new Error('Too many arguments for bitset');
                c = parseInt(args[0], 10);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0] + '\' must be a number for bitset');
                sides = parseInt(args[1], 10);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1] + '\' must be a number for bitset');
                sides--;
                mod = 1;
                if (args.length === 3) {
                    mod = parseInt(args[2], 10);
                    if (isNaN(mod))
                        throw new Error('Invalid argument \'' + args[2] + '\' must be a number for bitset');
                }
                return (c & (~(1 << sides))) | ((mod ? 1 : 0) << sides);
            case 'bitshift'://bitshift(value,num)
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for bitshift');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bitshift');
                c = parseInt(args[0], 10);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0] + '\' must be a number for bitshift');
                sides = parseInt(args[1], 10);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1] + '\' must be a number for bitshift');
                if (sides < 0)
                    return c >> -sides;
                return c << sides
            case 'bittest'://bittest(i,bitnum)
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for bittest');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bittest');
                c = parseInt(args[0], 10);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0] + '\' must be a number for bittest');
                sides = parseInt(args[1], 10);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1] + '\' must be a number for bittest');
                sides--;
                return ((c >> sides) % 2 != 0) ? 1 : 0;
            case 'bitxor'://bitxor(v1,v2)
                args = this.parseInline(res[2]).split(',');
                if (args.length === 0)
                    throw new Error('Missing arguments for bitxor');
                else if (args.length !== 2)
                    throw new Error('Too many arguments for bitxor');
                c = parseInt(args[0], 10);
                if (isNaN(c))
                    throw new Error('Invalid argument \'' + args[0] + '\' must be a number for bitxor');
                sides = parseInt(args[1], 10);
                if (isNaN(sides))
                    throw new Error('Invalid argument \'' + args[1] + '\' must be a number for bitxor');
                return c ^ sides;
            case 'number': //number(s)
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for number');
                else if (args.length > 1)
                    throw new Error('Too many arguments for number');
                args[0] = this.stripQuotes(args[0], true);
                if (args[0].match(/^\s*?[-|+]?\d+\s*?$/))
                    return parseInt(args[0], 10);
                else if (args[0].match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                    return parseFloat(args[0]);
                else if (args[0] === "true")
                    return 1;
                else if (args[0] === "false")
                    return 0;
                return 0;
            case 'isfloat'://isfloat(value)
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for isfloat');
                else if (args.length > 1)
                    throw new Error('Too many arguments for isfloat');
                if (args[0].match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                    return 1;
                return 0;
            case 'isnumber': //isnumber(s)
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for isnumber');
                else if (args.length > 1)
                    throw new Error('Too many arguments for isnumber');
                if (args[0].match(/^\s*?[-|+]?\d+\s*?$/) || args[0].match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                    return 1;
                return 0;
            case 'string'://string(value)
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for string');
                else if (args.length > 1)
                    throw new Error('Too many arguments for string');
                return `"${this.stripQuotes(args[0]), true}"`;
            case 'float'://float(value)
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for float');
                else if (args.length > 1)
                    throw new Error('Too many arguments for float');
                args[0] = this.stripQuotes(args[0], true);
                if (args[0].match(/^\s*?[-|+]?\d+\s*?$/) || args[0].match(/^\s*?[-|+]?\d+\.\d+\s*?$/))
                    return parseFloat(args[0]);
                else if (args[0] === "true")
                    return 1.0;
                else if (args[0] === "false")
                    return 0.0;
                return 0;
            case 'isdefined':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for isdefined');
                else if (args.length > 1)
                    throw new Error('Too many arguments for isdefined');
                args[0] = this.stripQuotes(args[0], true);
                if (this.client.variables.hasOwnProperty(args[0]))
                    return 1;
                return 0;
            case 'defined':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for defined');
                else if (args.length === 1) {
                    args[0] = this.stripQuotes(args[0], true);
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0) return 0;
                    //have to check each profile as the client only caches enabled items for speed
                    for (; k < kl; k++) {
                        sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].aliases);
                        sides = sides.find(i => {
                            return i.pattern === args[0];
                        });
                        if (sides) return 1;
                        sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                        sides = sides.find(i => {
                            return i.pattern === args[0] || i.name === args[0];
                        });
                        if (sides) return 1;
                        sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].macros);
                        sides = sides.find(i => {
                            return MacroDisplay(i).toLowerCase() === args[0].toLowerCase() || i.name === args[0];
                        });
                        if (sides) return 1;
                        sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].aliases);
                        sides = sides.find(i => {
                            return i.caption === args[0] || i.name === args[0]
                        });
                        if (sides) return 1;
                    }
                    return this.client.variables.hasOwnProperty(args[0]);
                }
                else if (args.length === 2) {
                    args[0] = this.stripQuotes(args[0], true);
                    args[1] = this.stripQuotes(args[1], true).toLowerCase();
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0) return 0;
                    //have to check each profile as the client only caches enabled items for speed
                    for (; k < kl; k++) {
                        switch (args[1]) {
                            case 'alias':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].aliases);
                                sides = sides.find(i => {
                                    return i.pattern === args[0];
                                });
                                if (sides) return 1;
                                return 0;
                            case 'event':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                sides = sides.find(i => {
                                    return i.type === TriggerType.Event && (i.pattern === args[0] || i.name === args[0]);
                                });
                                if (sides) return 1;
                                return 0;
                            case 'trigger':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                                sides = sides.find(i => {
                                    return i.pattern === args[0] || i.name === args[0];
                                });
                                if (sides) return 1;
                                return 0;
                            case 'macro':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].macros);
                                sides = sides.find(i => {
                                    return MacroDisplay(i).toLowerCase() === args[0].toLowerCase() || i.name === args[0];
                                });
                                if (sides) return 1;
                                return 0;
                            case 'button':
                                sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].aliases);
                                sides = sides.find(i => {
                                    return i.caption === args[0] || i.name === args[0]
                                });
                                if (sides) return 1;
                                return 0;
                            //case 'variable':
                            //case 'path':
                            //case 'status':
                            //case 'class':
                            //case 'menu':                        
                            //case 'module':
                        }
                    }
                    if (args[1] === 'variable')
                        return this.client.variables.hasOwnProperty(args[0]);
                }
                else
                    throw new Error('Too many arguments for defined');
                return 0;
            case 'escape':
                args = this.stripQuotes(this.parseInline(res[2]));
                if (this.client.getOption('allowEscape')) {
                    c = escape;
                    if (escape === '\\')
                        c += escape;
                    if (this.client.getOption('parseDoubleQuotes'))
                        c += '"';
                    if (this.client.getOption('parseSingleQuotes'))
                        c += '\'';
                    if (this.client.getOption('commandStacking'))
                        c += this.client.getOption('commandStackingChar');
                    if (this.client.getOption('enableSpeedpaths'))
                        c += this.client.getOption('speedpathsChar');
                    if (this.client.getOption('enableCommands'))
                        c += this.client.getOption('commandChar');
                    if (this.client.getOption('enableVerbatim'))
                        c += this.client.getOption('verbatimChar');
                    if (this.client.getOption('enableDoubleParameterEscaping'))
                        c += this.client.getOption('parametersChar');
                    if (this.client.getOption('enableNParameters'))
                        c += this.client.getOption('nParametersChar');
                    return args.replace(new RegExp(`[${c}]`, 'g'), escape + '$&');
                }
                return args.replace(/[\\"']/g, '\$&');
            case 'unescape':
                args = this.stripQuotes(this.parseInline(res[2]));
                if (this.client.getOption('allowEscape')) {
                    c = escape;
                    if (escape === '\\')
                        c += escape;
                    if (this.client.getOption('parseDoubleQuotes'))
                        c += '"';
                    if (this.client.getOption('parseSingleQuotes'))
                        c += '\'';
                    if (this.client.getOption('commandStacking'))
                        c += this.client.getOption('commandStackingChar');
                    if (this.client.getOption('enableSpeedpaths'))
                        c += this.client.getOption('speedpathsChar');
                    if (this.client.getOption('enableCommands'))
                        c += this.client.getOption('commandChar');
                    if (this.client.getOption('enableVerbatim'))
                        c += this.client.getOption('verbatimChar');
                    if (this.client.getOption('enableDoubleParameterEscaping'))
                        c += this.client.getOption('parametersChar');
                    if (this.client.getOption('enableNParameters'))
                        c += this.client.getOption('nParametersChar');
                    if (escape === '\\')
                        return args.replace(new RegExp(`\\\\[${c}]`, 'g'), (m) => m.substr(1));
                    return args.replace(new RegExp(`${escape}[${c}]`, 'g'), (m) => m.substr(1));
                }
                return args.replace(/\\[\\"']/g, (m) => m.substr(1));
            case 'alarm':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for alarm');
                if (args.length > 3)
                    throw new Error('Too many arguments for alarm');
                args[0] = this.stripQuotes(args[0]);
                sides = this.client.alarms;
                max = sides.length;
                if (max === 0)
                    throw new Error('No alarms set.');
                c = 0;
                if (args.length === 1) {
                    for (; c < max; c++) {
                        //only main state counts here
                        if (sides[c].type !== TriggerType.Alarm) continue;
                        if (sides[c].name === args[0] || sides[c].pattern === args[0]) {
                            if (sides[c].suspended)
                                return 0;
                            return this.client.getRemainingAlarmTime(c);
                        }
                    }
                }
                else if (args.length === 2) {
                    mod = parseInt(args[1], 10);
                    if (isNaN(mod)) {
                        args[1] = this.stripQuotes(args[1].trim());
                        for (; c < max; c++) {
                            //only main state counts here
                            if (sides[c].type !== TriggerType.Alarm) continue;
                            if (sides[c].name === args[0] || sides[c].pattern === args[0]) {
                                if (sides[c].profile.name.toUpperCase() !== args[1].toUpperCase())
                                    continue;
                                if (sides[c].suspended)
                                    return 0;
                                return this.client.getRemainingAlarmTime(c);
                            }
                        }
                        throw Error('Alarm not found in profile: ' + args[1] + '.');
                    }
                    else {
                        for (; c < max; c++) {
                            //only main state counts here
                            if (sides[c].type !== TriggerType.Alarm) continue;
                            if (sides[c].name === args[0] || sides[c].pattern === args[0]) {
                                if (!sides[c].suspended)
                                    this.client.setAlarmTempTime(c, mod);
                                return mod;
                            }
                        }
                        throw Error('Alarm not found.');
                    }
                }
                else if (args.length === 3) {
                    mod = parseInt(args[1], 10);
                    if (isNaN(mod))
                        throw new Error("Invalid time for alarm");
                    args[2] = this.stripQuotes(args[2].trim());
                    for (; c < max; c++) {
                        //only main state counts here
                        if (sides[c].type !== TriggerType.Alarm) continue;
                        if (sides[c].name === args[0] || sides[c].pattern === args[0]) {
                            if (sides[c].profile.name.toUpperCase() !== args[2].toUpperCase())
                                continue;
                            if (!sides[c].suspended)
                                this.client.setAlarmTempTime(c, mod);
                            return mod;
                        }
                    }
                    throw Error('Could not set time, alarm not found in profile: ' + args[2] + '.');
                }
                return 0;
            case 'state':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    throw new Error('Missing arguments for state');
                if (args.length > 2)
                    throw new Error('Too many arguments for state');
                args[0] = this.stripQuotes(args[0]);
                mod = null;
                if (args.length === 1) {
                    const keys = this.client.profiles.keys;
                    let k = 0;
                    const kl = keys.length;
                    if (kl === 0)
                        return null;
                    if (kl === 1) {
                        if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                            throw Error('No enabled profiles found!');
                        sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                        sides = sides.find(t => {
                            return t.name === args[0] || t.pattern === args[0];
                        });
                    }
                    else {
                        for (; k < kl; k++) {
                            if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                                continue;
                            sides = SortItemArrayByPriority(this.client.profiles.items[keys[k]].triggers);
                            sides = sides.find(t => {
                                return t.name === args[0] || t.pattern === args[0];
                            });
                            if (sides)
                                break;
                        }
                    }
                }
                else if (args.length === 2) {
                    args[1] = this.stripQuotes(args[1].trim());
                    if (this.client.profiles.contains(args[1]))
                        mod = this.client.profiles.items[args[1].toLowerCase()];
                    else {
                        mod = Profile.load(path.join(parseTemplate('{profiles}'), args[1].toLowerCase() + '.json'));
                        if (!mod)
                            throw new Error('Profile not found: ' + args[1]);
                    }
                    sides = SortItemArrayByPriority(mod.triggers);
                    sides = sides.find(t => {
                        return t.name === args[0] || t.pattern === args[0];
                    });
                }
                if (sides)
                    return sides.triggers && sides.triggers.length ? sides.state : 0;
                throw new Error('Trigger not found');
            case 'isnull':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    return null;
                if (args.length !== 1)
                    throw new Error('Too many arguments for null');
                return this.evaluate(args[0]) === null ? 1 : 0;
            case 'charcomment':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0) {
                    notes = getCharacterNotes();
                    if (isFileSync(notes))
                        return fs.readFileSync(notes, 'utf-8');
                    return '';
                }
                else if (args.length > 1)
                    throw new Error('Too many arguments for charcomment');
                if (this.client.getOption('allowEval')) return null;
                notes = getCharacterNotes();
                if (args[0].length === 0 || !isFileSync(notes))
                    fs.writeFileSync(notes, '');
                else if (!fileSizeSync(notes))
                    fs.appendFileSync(notes, args[0]);
                else
                    fs.appendFileSync(notes, '\n' + args[0]);
                return null;
            case 'charnotes':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0) {
                    notes = getCharacterNotes();
                    if (isFileSync(notes))
                        return fs.readFileSync(notes, 'utf-8');
                    return '';
                }
                else if (args.length > 1)
                    throw new Error('Too many arguments for charnotes');
                if (this.client.getOption('allowEval')) return null;
                notes = getCharacterNotes();
                args[0] = this.stripQuotes(args[0], true);
                fs.writeFileSync(notes, args[0]);
                return null;
            case 'clientname':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    return getName();
                else if (args.length === 1)
                    this.client.emit('set-name', args[0]);
                else if (args.length === 2) {
                    c = parseInt(args[1], 10);
                    if (isNaN(1))
                        throw new Error('Invalid argument 2 \'' + args[0] + '\' must be a number for clientname');
                    this.client.emit('set-name', args[0], args[1]);
                }
                else
                    throw new Error('Too many arguments for clientname');
                return null;
            case 'prompt':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length === 0)
                    return window.prompt() || '';
                if (args.length > 3)
                    throw new Error('Too many arguments');
                args = args.map(a => this.stripQuotes(a));
                return window.prompt(...args) || '';
            case 'fileprompt':
                args = this.splitByQuotes(this.parseInline(res[2]), ',');
                if (args.length > 2)
                    throw new Error('Too many arguments');
                args = args.map(a => this.stripQuotes(a));
                let f = [
                    { name: 'All files (*.*)', extensions: ['*'] },
                ];
                if (args.length > 0 && args[0].trim().length > 0) {
                    f.unshift({
                        name: args[0],
                        extensions: args[0].split(',').map(a => a.trim())
                    })
                }
                var files = dialog.showOpenDialogSync({
                    filters: f,
                    properties: ['openFile', 'promptToCreate'],
                    defaultPath: args.length >= 2 ? parseTemplate(args[1]) : ''
                });
                if (files && files.length) return files[0];
                return '';
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
            if (n[s].startsWith('$')) n[s] = n[s].substring(1);
            if (!n[s].match(/^[a-zA-Z0-9_][a-zA-Z0-9_]+$/g)) continue;
            if (!isValidIdentifier(n[s])) continue;
            if (named[n[s]]) continue;
            named[n[s]] = (s + 1 < al) ? args[s + 1] : '';
        }
        return named;
    }

    public ExecuteAlias(alias, args) {
        if (!alias.enabled) return;
        let ret; // = '';
        if (alias.value.length)
            switch (alias.style) {
                case 1:
                    this._stack.push({ loops: [], args: args, named: this.GetNamedArguments(alias.params, args), append: alias.append, used: 0 });
                    ret = this.parseOutgoing(alias.value, null, null, true);
                    this._stack.pop();
                    break;
                case 2:
                    if ((this.client.getOption('echo') & 2) === 2)
                        this.client.echo(alias.value, -7, -8, true, true);
                    /*jslint evil: true */
                    const named = this.GetNamedArguments(alias.params, args);
                    if (named)
                        ret = Object.keys(named).map(v => `let ${v} = this._input.stack.named["${v}"];`).join('') + '\n';
                    else
                        ret = '';
                    const f = new Function('try { ' + ret + alias.value + '\n} catch (e) { if(this.getOption(\'showScriptErrors\')) this.error(e);}');
                    this._stack.push({ loops: [], args: args, named: named, append: alias.append, used: 0 });
                    try {
                        ret = f.apply(this.client, args);
                    }
                    catch (e) {
                        throw e;
                    }
                    finally {
                        this._stack.pop();
                    }
                    if (typeof ret === 'string')
                        ret = this.parseOutgoing(ret, null, null, true);
                    break;
                default:
                    ret = alias.value;
                    break;
            }
        if (ret == null || ret === undefined)
            return null;
        ret = this.ExecuteTriggers(TriggerTypes.CommandInputRegular | TriggerTypes.CommandInputPattern, ret, ret, false, true);
        if (ret == null || ret === undefined)
            return null;
        //Convert to string
        if (typeof ret !== 'string')
            ret = ret.toString();
        if (ret.length === 0 && !this.client.getOption('returnNewlineOnEmptyValue'))
            return null;
        if (ret.endsWith('\n'))
            return ret;
        return ret + '\n';
    }

    public ProcessMacros(keycode, alt, ctrl, shift, meta) {
        if (!keycode || (keycode > 9 && keycode < 19)) return false;
        //if(!this.client.getOption('enableMacros')) return false;
        //Possible cache by modifier but  not sure if it it matters as there is a limit of 1 macro per key combo so at most there probably wont be more then 5 to maybe 20 macros per key
        //const macros = this._MacroCache[`${keycode}_${mod}`] || (this._MacroCache[`${keycode}_${mod}`] = FilterArrayByKeyValue(FilterArrayByKeyValue(this.client.macros, 'key', keycode), 'modifiers', mod));
        const macros = this._MacroCache[keycode] || (this._MacroCache[keycode] = FilterArrayByKeyValue(this.client.macros, 'key', keycode));
        let m = 0;
        const ml = macros.length;
        let mod = MacroModifiers.None;
        if (alt)
            mod |= MacroModifiers.Alt;
        if (ctrl)
            mod |= MacroModifiers.Ctrl;
        if (shift)
            mod |= MacroModifiers.Shift;
        if (meta)
            mod |= MacroModifiers.Meta;
        for (; m < ml; m++) {
            if (!macros[m].enabled || mod !== macros[m].modifiers) continue;
            if (this.ExecuteMacro(macros[m]))
                return true;
        }
        return false;
    }

    public ExecuteMacro(macro) {
        if (!macro.enabled) return false;
        let ret; // = '';
        if (macro.value.length)
            switch (macro.style) {
                case 1:
                    this._stack.push({ loops: [], args: 0, named: 0, used: 0 });
                    try {
                        ret = this.parseOutgoing(macro.value);
                    }
                    catch (e) {
                        throw e;
                    }
                    finally {
                        this._stack.pop();
                    }
                    break;
                case 2:
                    if ((this.client.getOption('echo') & 2) === 2)
                        this.client.echo(macro.value, -7, -8, true, true);
                    /*jslint evil: true */
                    const f = new Function('try { ' + macro.value + '\n} catch (e) { if(this.getOption(\'showScriptErrors\')) this.error(e);}');
                    this._stack.push({ loops: [], args: 0, named: 0, used: 0 });
                    try {
                        ret = f.apply(this.client);
                    }
                    catch (e) {
                        throw e;
                    }
                    finally {
                        this._stack.pop();
                    }
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
        if (ret.length === 0 && !this.client.getOption('returnNewlineOnEmptyValue'))
            return null;
        if (macro.send) {
            if (!ret.endsWith('\n'))
                ret += '\n';
            if (macro.chain && this.client.commandInput.value.endsWith(' ')) {
                this.client.commandInput.value = this.client.commandInput.value + ret;
                this.client.sendCommand(null, null, this.client.getOption('allowCommentsFromCommand'));
            }
            else
                this.client.send(ret, true);
        }
        else if (macro.append)
            this.client.commandInput.value = this.client.commandInput.value + ret;
        return true;
    }

    public ProcessPath(str, replace?: boolean) {
        if (str.length === 0)
            return '';
        let out: string[] = [];

        let state = 0;
        let cmd: string = '';
        let num: string = '';
        let idx = 0;
        let c: string;
        let i: number;
        let t;
        let p;
        let n = 0;
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
                case 3:
                    if (n === 0 && c === ')')
                        state = 0;
                    else {
                        if (c === '(')
                            n++;
                        else if (c === ')')
                            n--;
                        cmd += c;
                    }
                    break;
                case 4:
                    if (n === 0 && c === '}')
                        state = 0;
                    else {
                        if (c === '{')
                            n++;
                        else if (c === '}')
                            n--;
                        cmd += c;
                    }
                    break;
                default:
                    if (i > 47 && i < 58) {
                        if (cmd.length > 0) {
                            if (num.length === 0)
                                t = 1;
                            else
                                t = parseInt(num, 10);
                            for (p = 0; p < t; p++)
                                out.push(cmd);
                            cmd = '';
                        }
                        state = 1;
                        num = c;
                    }
                    else if (c === '(') {
                        state = 3;
                        n = 0;
                    }
                    else if (c === '{') {
                        state = 4;
                        n = 0;
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
            for (p = 0; p < t; p++)
                out.push(cmd);
        }
        if (replace && this._pathQueue.length) {
            this._pathQueue[0] = {
                id: str,
                current: out,
                previous: []
            };
        }
        else
            this._pathQueue.push({
                id: str,
                current: out,
                previous: []
            });
        this.ExecutePath();
        return null;
    }

    public ExecutePath() {
        //if already running or no queue bail
        if (this._pathTimeout || !this._pathQueue.length || this._pathPaused) return;
        let delay = this.client.getOption('pathDelay');
        if (delay < 0) delay = 0;
        //being processing query
        this._pathTimeout = setTimeout(() => {
            const pPath = this.client.getOption('parseSpeedpaths');
            const ePath = this.client.getOption('echoSpeedpaths');
            let cnt = this.client.getOption('pathDelayCount');
            if (cnt < 1) cnt = 1;
            const current = this._pathQueue[0];
            /*
            if (!current.previous.length) {
                if (this.client.telnet.echo && this.client.getOption('commandEcho'))
                    this.client.echo(this.client.getOption('speedpathsChar') + current.id);
                else
                    this.client.echo('\n');
            }
            */
            while (cnt--) {
                let cmd = current.current.shift();
                current.previous.push(cmd);
                if (pPath)
                    this.client.sendBackground(cmd + '\n', !ePath);
                else
                    this.client.send(cmd + '\n', !ePath);
                if (!current.current.length) break;
            }
            //if at the end remove
            if (!current.current.length)
                this._pathQueue.shift();
            this._pathTimeout = null;
            //step manually so do not call next block, allows commands to handle steeping instead of auto moving to next one
            if (this._pathQueue.length && this._pathQueue[0].manual)
                return;
            //process next paths
            this.ExecutePath();
        }, delay);
    }

    public toggleScrollLock() {
        this.scrollLock = !this.scrollLock;
    }

    private hasTriggerType(types: TriggerTypes | SubTriggerTypes, type: TriggerType | SubTriggerTypes): boolean {
        if (type === TriggerType.Alarm && (types & TriggerTypes.Alarm) == TriggerTypes.Alarm)
            return true;
        if (type === TriggerType.CommandInputPattern && (types & TriggerTypes.CommandInputPattern) == TriggerTypes.CommandInputPattern)
            return true;
        if (type === TriggerType.CommandInputRegular && (types & TriggerTypes.CommandInputRegular) == TriggerTypes.CommandInputRegular)
            return true;
        if (type === TriggerType.Event && (types & TriggerTypes.Event) == TriggerTypes.Event)
            return true;
        if (type === TriggerType.Pattern && (types & TriggerTypes.Pattern) == TriggerTypes.Pattern)
            return true;
        if (type === TriggerType.Regular && (types & TriggerTypes.Regular) == TriggerTypes.Regular)
            return true;
        if (type === TriggerType.LoopExpression && (types & TriggerTypes.LoopExpression) == TriggerTypes.LoopExpression)
            return true;
        //if (type === TriggerType.Expression && (types & TriggerTypes.Expression) == TriggerTypes.Expression)
        //return true;            
        return false;
    }

    private isSubTriggerType(type) {
        if ((type & SubTriggerTypes.Skip) == SubTriggerTypes.Skip)
            return true;
        if ((type & SubTriggerTypes.Wait) == SubTriggerTypes.Wait)
            return true;
        if ((type & SubTriggerTypes.LoopPattern) == SubTriggerTypes.LoopPattern)
            return true;
        if ((type & SubTriggerTypes.LoopLines) == SubTriggerTypes.LoopLines)
            return true;
        if ((type & SubTriggerTypes.Duration) == SubTriggerTypes.Duration)
            return true;
        if ((type & SubTriggerTypes.WithinLines) == SubTriggerTypes.WithinLines)
            return true;
        if ((type & SubTriggerTypes.Manual) == SubTriggerTypes.Manual)
            return true;
        if ((type & SubTriggerTypes.ReParse) == SubTriggerTypes.ReParse)
            return true;
        if ((type & SubTriggerTypes.ReParsePattern) == SubTriggerTypes.ReParsePattern)
            return true;
        return false;
    }

    private getTriggerType(type: TriggerType | SubTriggerTypes) {
        if (type === TriggerType.Regular)
            return TriggerTypes.Regular;
        if (type === TriggerType.Alarm)
            return TriggerTypes.Alarm;
        return type;
    }

    public ExecuteTriggers(type: TriggerTypes, line?, raw?, frag?: boolean, ret?: boolean, subtypes?: boolean) {
        if (!this.enableTriggers || line == null) return line;
        if (ret == null) ret = false;
        if (frag == null) frag = false;
        //make sure raw is set
        raw = raw || line;
        this.buildTriggerCache();
        let t = 0;
        let pattern;
        let changed = false;
        let val;
        //scope to get performance
        const triggers = this._TriggerCache;
        const tl = triggers.length;
        const states = this._TriggerStates;
        const rCache = this._TriggerRegExCache;
        let tType;
        for (; t < tl; t++) {
            let trigger = triggers[t];
            const parent = trigger;
            //extra check in case error disabled it and do not want to keep triggering the error
            if (!trigger.enabled) continue;
            //safety check in case a state was deleted
            if (!parent.triggers || !parent.triggers.length || trigger.state > parent.triggers.length)
                parent.state = 0;
            if (trigger.state !== 0 && parent.triggers && parent.triggers.length) {
                //trigger states are 1 based as 0 is parent trigger
                trigger = parent.triggers[trigger.state - 1];
                //skip disabled states
                while (!trigger.enabled && parent.state !== 0) {
                    //advance state
                    parent.state++;
                    //if no more states start over and stop
                    if (parent.state > parent.triggers.length) {
                        parent.state = 0;
                        //reset to first state
                        trigger = parent;
                        //stop checking
                        break;
                    }
                    if (parent.state)
                        trigger = parent.triggers[parent.state - 1];
                    else
                        trigger = parent;
                    changed = true;
                }
                //changed state save
                if (changed) {
                    if (this.client.getOption('saveTriggerStateChanges'))
                        this.client.saveProfile(parent.profile.name, true, ProfileSaveType.Trigger);
                    this.client.emit('item-updated', 'trigger', parent.profile.name, parent.profile.triggers.indexOf(parent), parent);
                }
                //last check to be 100% sure enabled
                if (!trigger.enabled) continue;
            }
            tType = this.getTriggerType(trigger.type);
            if (trigger.type !== undefined && (type & tType) !== tType) {
                if (!subtypes || (subtypes && !this.isSubTriggerType(trigger.type)))
                    continue;
            }
            //manual can only be fired with #set
            if (trigger.type === SubTriggerTypes.Manual) continue;
            if (frag && !trigger.triggerPrompt) continue;
            if (!frag && !trigger.triggerNewline && (trigger.triggerNewline !== undefined))
                continue;
            if (states[t]) {
                if (states[t].type === SubTriggerTypes.Wait) {
                    //time still has not passed
                    if (states[t].time > Date.now())
                        continue;
                    delete states[t];
                }
                else if (states[t].type === SubTriggerTypes.Duration) {
                    //trigger time has paused, delete it and advance
                    if (states[t].time < Date.now()) {
                        delete states[t];
                        this.advanceTrigger(trigger, parent, t);
                        //need to reparse as the state is no longer valid and the next state might be
                        if (!states[t])
                            states[t] = { reParse: true };
                        else
                            states[t].reParse = true;
                        t = this.cleanUpTriggerState(t);
                        continue;
                    }
                }
                else if (states[t].type === SubTriggerTypes.Skip) {
                    //skip until that many lines have passed
                    if (states[t].lineCount > 0)
                        continue;
                    delete states[t];
                }
                else if (states[t].type === SubTriggerTypes.LoopLines) {
                    //move on after line count
                    if (states[t].lineCount < 1) {
                        this.advanceTrigger(trigger, parent, t);
                        //reparse as new state may be valid
                        if (!states[t])
                            states[t] = { reParse: true }
                        else
                            states[t].reParse = true;
                        t = this.cleanUpTriggerState(t);
                        continue;
                    }
                }
                else if (states[t].type === SubTriggerTypes.WithinLines) {
                    if (states[t].lineCount < 1) {
                        this.advanceTrigger(trigger, parent, t);
                        //reparse as new state may be valid
                        if (!states[t])
                            states[t] = { reParse: true }
                        else
                            states[t].reParse = true;
                        t = this.cleanUpTriggerState(t);
                        continue;
                    }
                }
                /*
                else if (states[t].type === TriggerType.LoopExpression) {
                    //move on after line count
                    if (states[t].loop != -1 && states[t].lineCount < 1) {
                        this.advanceTrigger(trigger, parent, t);
                        //reparse as new state may be valid
                        if (!states[t])
                            states[t] = { reParse: true }
                        else
                            states[t].reParse = true;
                        t = this.cleanUpTriggerState(t);
                        continue;
                    }
                }
                */
            }
            try {
                if (trigger.type === TriggerType.LoopExpression) {
                    if (this.evaluate(this.parseInline(trigger.pattern))) {
                        if (!states[t]) {
                            const state = this.createTriggerState(trigger, false, parent);
                            if (state)
                                states[t] = state;
                        }
                        else if (states[t].loop !== -1 && states[t].lineCount < 1)
                            continue;
                        this._LastTriggered = (trigger.raw ? raw : line);
                        val = this.ExecuteTrigger(trigger, [this._LastTriggered], ret, t, [this._LastTriggered], 0, parent);
                    }
                    else {
                        //this.updateTriggerState(trigger, t);
                        this.advanceTrigger(trigger, parent, t);
                        continue;
                    }
                }
                else if (trigger.verbatim) {
                    if (!trigger.caseSensitive && (trigger.raw ? raw : line).toLowerCase() !== trigger.pattern.toLowerCase()) {
                        //if reparse and if failed advance anyways
                        if (!states[t] && (trigger.type === SubTriggerTypes.ReParse || trigger.type === SubTriggerTypes.ReParsePattern)) {
                            this.advanceTrigger(trigger, parent, t);
                            t = this.cleanUpTriggerState(t);
                        }
                        continue;
                    }
                    else if (trigger.caseSensitive && (trigger.raw ? raw : line) !== trigger.pattern) {
                        //if reparse and if failed advance anyways
                        if (!states[t] && (trigger.type === SubTriggerTypes.ReParse || trigger.type === SubTriggerTypes.ReParsePattern)) {
                            this.advanceTrigger(trigger, parent, t);
                            t = this.cleanUpTriggerState(t);
                        }
                        continue;
                    }
                    this._LastTriggered = (trigger.raw ? raw : line);
                    val = this.ExecuteTrigger(trigger, [this._LastTriggered], ret, t, [this._LastTriggered], 0, parent);
                }
                else {
                    let re;
                    if (trigger.type === TriggerType.Pattern || trigger.type === TriggerType.CommandInputPattern || trigger.type === SubTriggerTypes.ReParsePattern)
                        pattern = convertPattern(trigger.pattern, this.client);
                    else
                        pattern = trigger.pattern;
                    if (trigger.caseSensitive)
                        re = rCache['g' + pattern] || (rCache['g' + pattern] = new RegExp(pattern, 'gd'));
                    else
                        re = rCache['gi' + pattern] || (rCache['gi' + pattern] = new RegExp(pattern, 'gid'));
                    //reset from last use always
                    re.lastIndex = 0;
                    const res = re.exec(trigger.raw ? raw : line);
                    if (!res || !res.length) {
                        //if reparse and if failed advance anyways
                        if (!states[t] && (trigger.type === SubTriggerTypes.ReParse || trigger.type === SubTriggerTypes.ReParsePattern)) {
                            this.advanceTrigger(trigger, parent, t);
                            t = this.cleanUpTriggerState(t);
                        }
                        continue;
                    }
                    let args;
                    this._LastTriggered = trigger.raw ? raw : line;
                    if ((trigger.raw ? raw : line) === res[0] || !this.client.getOption('prependTriggeredLine'))
                        args = res;
                    else {
                        args = [this._LastTriggered, ...res];
                        args.indices = [[0, args[0].length], ...res.indices];
                    }
                    if (res.groups)
                        Object.keys(res.groups).map(v => this.client.variables[v] = res.groups[v]);
                    val = this.ExecuteTrigger(trigger, args, ret, t, [this._LastTriggered, re], res.groups, parent);
                }
                if (states[t] && states[t].reParse) {
                    if (!states[t].type || states[t].type === SubTriggerTypes.ReParse || states[t].type === SubTriggerTypes.ReParsePattern)
                        delete states[t];
                    else
                        delete states[t].reParse;
                    t--;
                }
                else if (ret) return val;
            }
            catch (e) {
                if (this.client.getOption('disableTriggerOnError')) {
                    trigger.enabled = false;
                    setTimeout(() => {
                        this.client.saveProfile(parent.profile.name, false, ProfileSaveType.Trigger);
                        this.emit('item-updated', 'trigger', parent.profile, parent.profile.triggers.indexOf(parent), parent);
                    });
                }
                if (this.client.getOption('showScriptErrors'))
                    this.client.error(e);
                else
                    this.client.debug(e);
            }
        }
        return line;
    }

    public TestTrigger(trigger, parent, t, line?, raw?, frag?: boolean) {
        let val;
        let pattern;
        try {
            if (trigger.verbatim) {
                if (!trigger.caseSensitive && (trigger.raw ? raw : line).toLowerCase() !== trigger.pattern.toLowerCase()) {
                    //if reparse and if failed advance anyways
                    if (!this._TriggerStates[t]) {
                        this.advanceTrigger(trigger, parent, t);
                        t = this.cleanUpTriggerState(t);
                    }
                    return t;
                }
                else if (trigger.caseSensitive && (trigger.raw ? raw : line) !== trigger.pattern) {
                    //if reparse and if failed advance anyways
                    if (!this._TriggerStates[t]) {
                        this.advanceTrigger(trigger, parent, t);
                        t = this.cleanUpTriggerState(t);
                    }
                    return t;
                }
                this._LastTriggered = (trigger.raw ? raw : line);
                val = this.ExecuteTrigger(trigger, [this._LastTriggered], false, t, [this._LastTriggered], 0, parent);
            }
            else {
                let re;
                if (trigger.type === TriggerType.Pattern || trigger.type === TriggerType.CommandInputPattern || trigger.type === SubTriggerTypes.ReParsePattern)
                    pattern = convertPattern(trigger.pattern, this.client);
                else
                    pattern = trigger.pattern;
                if (trigger.caseSensitive)
                    re = this._TriggerRegExCache['g' + pattern] || (this._TriggerRegExCache['g' + pattern] = new RegExp(pattern, 'gd'));
                else
                    re = this._TriggerRegExCache['gi' + pattern] || (this._TriggerRegExCache['gi' + pattern] = new RegExp(pattern, 'gid'));
                //reset from last use always
                re.lastIndex = 0;
                const res = re.exec(trigger.raw ? raw : line);
                if (!res || !res.length) {
                    //if reparse and if failed advance anyways
                    if (!this._TriggerStates[t] && (trigger.type === SubTriggerTypes.ReParse || trigger.type === SubTriggerTypes.ReParsePattern)) {
                        this.advanceTrigger(trigger, parent, t);
                        t = this.cleanUpTriggerState(t);
                    }
                    return t;
                }
                let args;
                this._LastTriggered = (trigger.raw ? raw : line);
                if ((trigger.raw ? raw : line) === res[0] || !this.client.getOption('prependTriggeredLine'))
                    args = res;
                else {
                    args = [this._LastTriggered, ...res];
                    args.indices = [[0, args[0].length], ...res.indices];
                }
                if (res.groups)
                    Object.keys(res.groups).map(v => this.client.variables[v] = res.groups[v]);
                val = this.ExecuteTrigger(trigger, args, false, t, [this._LastTriggered, re], res.groups, parent);
            }
            t = this.cleanUpTriggerState(t);
        }
        catch (e) {
            if (this.client.getOption('disableTriggerOnError')) {
                trigger.enabled = false;
                setTimeout(() => {
                    this.client.saveProfile(parent.profile.name, false, ProfileSaveType.Trigger);
                    this.emit('item-updated', 'trigger', parent.profile, parent.profile.triggers.indexOf(parent), parent);
                });
            }
            if (this.client.getOption('showScriptErrors'))
                this.client.error(e);
            else
                this.client.debug(e);
        }
        return t;
    }

    public ExecuteTrigger(trigger, args, r: boolean, idx, regex?, named?, parent?: Trigger) {
        if (r == null) r = false;
        if (!trigger.enabled) return '';
        if (this._TriggerStates[idx] && this._TriggerStates[idx].type === SubTriggerTypes.Duration)
            delete this._TriggerStates[idx];
        if (trigger.fired) {
            trigger.fired = false;
            this.advanceTrigger(trigger, parent, idx);
            if (this._TriggerStates[idx])
                this._TriggerStates[idx].reParse = true;
            else
                this._TriggerStates[idx] = { reParse: true };
            return '';
        }
        this._LastTrigger = trigger;
        let ret; // = '';
        //remove temp and advance state before executing value in case it does a trigger on trigger to avoid double triggering
        if (trigger.temp) {
            if (parent.triggers.length) {
                if (parent.state === 0) {
                    //main trigger temp, replace with first state
                    const item = parent.triggers.shift();
                    item.triggers = parent.triggers;
                    item.state = parent.state;
                    item.name = parent.name;
                    item.profile = parent.profile;
                    //if removed temp shift state adjust
                    if (item.state > item.triggers.length)
                        item.state = 0;
                    if (idx >= 0)
                        this._TriggerCache[idx] = item;
                    this.client.saveProfile(parent.profile.name, false, ProfileSaveType.Trigger);
                    const pIdx = parent.profile.triggers.indexOf(parent);
                    parent.profile.triggers[pIdx] = item;
                    this.client.emit('item-updated', 'trigger', parent.profile.name, pIdx, item);
                }
                else {
                    //remove only temp sub state
                    parent.triggers.splice(parent.state - 1, 1);
                    //if removed temp shift state adjust
                    if (parent.state > parent.triggers.length)
                        parent.state = 0;
                    this.client.saveProfile(parent.profile.name, false, ProfileSaveType.Trigger);
                    this.client.emit('item-updated', 'trigger', parent.profile.name, parent.profile.triggers.indexOf(parent), parent);
                }
            }
            else {
                if (idx >= 0)
                    this._TriggerCache.splice(idx, 1);
                if (this._TriggerStates[idx])
                    this.clearTriggerState(idx);
                this.client.removeTrigger(parent);
            }
        }
        else if (parent.triggers.length)
            this.advanceTrigger(trigger, parent, idx);
        if ((this.client.getOption('echo') & 8) === 8)
            this.client.echo('Trigger fired: ' + trigger.pattern, -7, -8, true, true);
        if (trigger.value.length)
            switch (trigger.style) {
                case 1:
                    this._stack.push({ loops: [], args: args, named: 0, used: 0, regex: regex });
                    try {
                        ret = this.parseOutgoing(trigger.value);
                    }
                    catch (e) {
                        throw e;
                    }
                    finally {
                        this._stack.pop();
                    }
                    break;
                case 2:
                    if ((this.client.getOption('echo') & 2) === 2)
                        this.client.echo(trigger.value, -7, -8, true, true);
                    //do not cache temp triggers
                    if (trigger.temp) {
                        ret = new Function('try { ' + trigger.value + '\n} catch (e) { if(this.getOption(\'showScriptErrors\')) this.error(e);}');
                        ret = ret.apply(this.client, args);
                    }
                    else {
                        if (!this._TriggerFunctionCache[idx]) {
                            if (named)
                                ret = Object.keys(named).map(v => `let ${v} = this.variables["${v}"];`).join('') + '\n';
                            else
                                ret = '';
                            /*jslint evil: true */
                            this._TriggerFunctionCache[idx] = new Function('try { ' + ret + trigger.value + '\n} catch (e) { if(this.getOption(\'showScriptErrors\')) this.error(e);}');
                        }
                        this._stack.push({ loops: [], args: args, named: 0, used: 0, regex: regex, indices: args.indices });
                        try {
                            ret = this._TriggerFunctionCache[idx].apply(this.client, args);
                        }
                        catch (e) {
                            throw e;
                        }
                        finally {
                            this._stack.pop();
                        }
                    }
                    if (typeof ret === 'string')
                        ret = this.parseOutgoing(ret);
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
        if (ret.length === 0 && !this.client.getOption('returnNewlineOnEmptyValue'))
            return null;
        if (!ret.endsWith('\n'))
            ret += '\n';
        if (this.client.connected)
            this.client.telnet.sendData(ret);
        if (this.client.telnet.echo && this.client.getOption('commandEcho')) {
            const delay = function () {
                this.client.echo(ret);
            };
            setTimeout(delay, 1);
        }
    }

    private advanceTrigger(trigger, parent, idx) {
        if (this._TriggerStates[idx]) {
            if (this._TriggerStates[idx].type === SubTriggerTypes.LoopPattern) {
                this._TriggerStates[idx].loop--;
                //stay on this state until loop is done
                if (this._TriggerStates[idx].loop > 0)
                    return;
                this.clearTriggerState(idx);
            }
            //match within the # of lines so clear state and move on
            else if (this._TriggerStates[idx].type === SubTriggerTypes.LoopLines) {
                //keep matching until loop is over
                if (this._TriggerStates[idx].lineCount > 0)
                    return;
                this.clearTriggerState(idx);
            }
            else if (this._TriggerStates[idx].type === SubTriggerTypes.WithinLines)
                this.clearTriggerState(idx);
            else if (this._TriggerStates[idx].type === TriggerType.LoopExpression) {
                //infinite until expression is false
                if (this._TriggerStates[idx].loop === -1)
                    return;
                //else if uses a line count
                if (this._TriggerStates[idx].lineCount > 0)
                    return;
            }
        }
        parent.state++;
        //1 based
        if (parent.state > parent.triggers.length)
            parent.state = 0;
        //changed state save
        if (this.client.getOption('saveTriggerStateChanges'))
            this.client.saveProfile(parent.profile.name, true, ProfileSaveType.Trigger);
        this.client.emit('item-updated', 'trigger', parent.profile.name, parent.profile.triggers.indexOf(parent), parent);
        //is new subtype a reparse? if so reparse using current trigger instant
        if (parent.state !== 0) {
            const state = this.createTriggerState(parent.triggers[parent.state - 1]);
            if (state)
                this._TriggerStates[idx] = state;
        }
    }

    public createTriggerState(trigger, reparse?, parent?) {
        let params;
        let state;
        switch (trigger.type) {
            case SubTriggerTypes.ReParse:
            case SubTriggerTypes.ReParsePattern:
                state = { reParse: true };
                break;
            case SubTriggerTypes.Duration:
            case SubTriggerTypes.Wait:
                params = trigger.params;
                if (params && params.length) {
                    params = parseInt(params, 10);
                    if (isNaN(params))
                        params = 0;
                }
                else
                    params = 0;
                state = { time: Date.now() + params };
                break;
            case SubTriggerTypes.WithinLines:
            case SubTriggerTypes.LoopLines:
            case SubTriggerTypes.Skip:
                params = trigger.params;
                if (params && params.length) {
                    params = parseInt(params, 10);
                    if (isNaN(params))
                        params = 1;
                }
                else
                    params = 1;
                state = { lineCount: params + 1 };
                break;
            /*          
                params = trigger.params;
                if (params && params.length) {
                    params = parseInt(params, 10);
                    if (isNaN(params))
                        params = 1;
                }
                else
                    params = 1;
                state = { remoteCount: params + 1 };
                break;
            */
            case SubTriggerTypes.LoopPattern:
                params = trigger.params;
                if (params && params.length) {
                    params = parseInt(params, 10);
                    if (isNaN(params))
                        params = 0;
                }
                else
                    params = 0;
                state = { loop: params };
                break;
            case TriggerType.LoopExpression:
                params = trigger.params;
                if (params && params.length) {
                    params = parseInt(params, 10);
                    if (isNaN(params))
                        params = 1;
                    if (parent === trigger)
                        state = { lineCount: params - 1 };
                    else
                        state = { lineCount: params };
                }
                else
                    state = { loop: -1 };
                break;
        }
        if (state)
            state.type = trigger.type;
        if (!state && reparse)
            return { reParse: true };
        else if (reparse)
            state.reparse = true;
        return state;
    }

    public updateTriggerState(trigger, idx) {
        if (!this._TriggerStates[idx]) return;
        let params;
        switch (this._TriggerStates[idx].type) {
            case SubTriggerTypes.Wait:
            case SubTriggerTypes.Duration:
                params = trigger.params;
                if (params && params.length) {
                    params = parseInt(params, 10);
                    if (isNaN(params))
                        params = 0;
                }
                else
                    params = 0;
                this._TriggerStates[idx].time = Date.now() + params;
                break;
            case SubTriggerTypes.WithinLines:
            case SubTriggerTypes.Skip:
            case SubTriggerTypes.LoopLines:
                params = trigger.params;
                if (params && params.length) {
                    params = parseInt(params, 10);
                    if (isNaN(params))
                        params = 0;
                }
                else
                    params = 0;
                this._TriggerStates[idx].lineCount = params;
                break;
            /*
                            params = trigger.params;
                            if (params && params.length) {
                                params = parseInt(params, 10);
                                if (isNaN(params))
                                    params = 0;
                            }
                            else
                                params = 0;
                            this._TriggerStates[idx].remoteCount = params;
                            break;
            */
            case SubTriggerTypes.LoopPattern:
                params = trigger.params;
                if (params && params.length) {
                    params = parseInt(params, 10);
                    if (isNaN(params))
                        params = 0;
                }
                else
                    params = 0;
                this._TriggerStates[idx].loop = params;
                break;
            case TriggerType.LoopExpression:
                params = trigger.params;
                if (params && params.length) {
                    params = parseInt(params, 10);
                    if (isNaN(params))
                        params = 1;
                    this._TriggerStates[idx].lineCount = params + 1;
                }
                else
                    this._TriggerStates[idx].loop = -1;
                break;
        }
    }

    public getTriggerState(idx) {
        return this._TriggerStates[idx];
    }

    public cleanUpTriggerState(idx) {
        if (this._TriggerStates[idx] && this._TriggerStates[idx].reParse) {
            //remove only if reparse type of no type defined, else remove just the rePrase flag
            if (!this._TriggerStates[idx].type || this._TriggerStates[idx].type === SubTriggerTypes.ReParse || this._TriggerStates[idx].type === SubTriggerTypes.ReParsePattern)
                delete this._TriggerStates[idx];
            else
                delete this._TriggerStates[idx].reParse;
            if (idx < 0)
                idx++;
            else
                idx--;
        }
        return idx;
    }

    public clearTriggerState(idx) {
        delete this._TriggerStates[idx];
    }

    public setTriggerState(idx, data) {
        this._TriggerStates[idx] = data;
    }

    public clearTriggerCache() { this._TriggerCache = null; this._TriggerStates = {}; this._TriggerFunctionCache = {}; this._TriggerRegExCache = {}; }

    public resetTriggerState(idx, oldState, oldFire?) {
        if (idx === -1) return;
        if (idx < 0 || idx >= this._TriggerCache.length) return;
        let trigger = this._TriggerCache[idx];
        let oTrigger;
        const parent = trigger;
        let params;
        let reParse = false;
        if (parent.state !== 0)
            trigger = parent.triggers[parent.state - 1];
        if (oldState === 0)
            oTrigger = parent;
        else
            oTrigger = parent.triggers[oldState - 1];
        if (oldState === parent.state) {
            if (this._TriggerStates[idx]) {
                if (!trigger.fired)
                    this.updateTriggerState(trigger, idx);
                else
                    this.clearTriggerState(idx);
            }
            else {
                if (!trigger.fired)
                    this.updateTriggerState(trigger, idx);
            }
        }
        else {
            if (this._TriggerStates[idx]) {
                if (!this._TriggerStates[idx].type || (this._TriggerStates[idx].type !== SubTriggerTypes.ReParsePattern && this._TriggerStates[idx].type !== SubTriggerTypes.ReParse))
                    reParse = this._TriggerStates[idx].reParse;
            }
            this.clearTriggerState(idx);
            if (!trigger.fired) {
                const state = this.createTriggerState(trigger, reParse);
                if (state)
                    this._TriggerStates[idx] = state;
            }
            else
                this._TriggerStates[idx] = { reParse: true };
        }
    }

    public buildTriggerCache() {
        if (this._TriggerCache == null) {
            this._TriggerCache = $.grep(this.client.triggers, (a) => {
                if (a && a.enabled && a.triggers.length) {
                    if (a.type !== TriggerType.Alarm) return true;
                    //loop sub states if one is not alarm cache it for future
                    for (let s = 0, sl = a.triggers.length; s < sl; s++)
                        if (a.triggers[s].enabled && a.triggers[s].type !== TriggerType.Alarm)
                            return true;
                    return false;
                }
                return a.enabled && a.type !== TriggerType.Alarm;
            });
        }
    }

    public clearCaches() {
        this._TriggerCache = null;
        this._TriggerStates = {};
        this._TriggerFunctionCache = {};
        this._gamepadCaches = null;
        this._lastSuspend = -1;
        this._MacroCache = {};
    }

    public triggerEvent(event: string, args?) {
        if (!this.enableTriggers) return;
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
            let trigger = this._TriggerCache[t];
            const parent = trigger;
            let changed = false;
            //in case it got disabled by something
            if (!trigger.enabled) continue;
            //safety check in case a state was deleted
            if (trigger.state > parent.triggers.length)
                trigger.state = 0;
            if (trigger.state !== 0 && parent.triggers && parent.triggers.length) {
                //trigger states are 1 based as 0 is parent trigger
                trigger = parent.triggers[trigger.state - 1];
                //skip disabled states
                while (!trigger.enabled && parent.state !== 0) {
                    //advance state
                    parent.state++;
                    //if no more states start over and stop
                    if (parent.state > parent.triggers.length) {
                        parent.state = 0;
                        //reset to first state
                        trigger = parent;
                        //stop checking
                        break;
                    }
                    if (parent.state)
                        trigger = parent.triggers[parent.state - 1];
                    else
                        trigger = parent;
                    changed = true;
                }
                //changed state save
                if (changed) {
                    if (this.client.getOption('saveTriggerStateChanges'))
                        this.client.saveProfile(parent.profile.name, true, ProfileSaveType.Trigger);
                    this.client.emit('item-updated', 'trigger', parent.profile.name, parent.profile.triggers.indexOf(parent), parent);
                }
                //last check to be 100% sure enabled
                if (!trigger.enabled) continue;
            }
            if (trigger.type === SubTriggerTypes.ReParse || trigger.type === SubTriggerTypes.ReParsePattern) {
                const val = this.adjustLastLine(this.client.display.lines.length, true);
                const line = this.client.display.lines[val];
                t = this.TestTrigger(trigger, parent, t, line, this.client.display.lines[val].raw || line, val === this.client.display.lines.length - 1);
                continue;
            }
            if (trigger.type !== TriggerType.Event) continue;
            if (trigger.caseSensitive && event !== trigger.pattern) continue;
            if (!trigger.caseSensitive && event.toLowerCase() !== trigger.pattern.toLowerCase()) continue;
            this._LastTriggered = event;
            this.ExecuteTrigger(trigger, args, false, t, 0, 0, parent);
            t = this.cleanUpTriggerState(t);
        }
    }

    public executeWait(text, delay: number, eAlias?: boolean, stacking?: boolean, append?: boolean, noFunctions?: boolean, noComments?: boolean) {
        if (!text || text.length === 0) return;
        const s = { loops: this.loops.splice(0), args: 0, named: 0, used: this.stack.used, append: this.stack.append };
        if (this.stack.args)
            s.args = this.stack.args.slice();
        if (this.stack.named)
            s.named = this.stack.named.slice();

        if (delay < 0)
            delay = 0;
        setTimeout(() => {
            this._stack.push(s);
            let ret = this.parseOutgoing(text, eAlias, stacking, append, noFunctions, noComments);
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
        if (this.client.getOption('commandStacking') && this.client.getOption('commandStackingChar') && this.client.getOption('commandStackingChar').length > 0)
            lines = str.split(new RegExp('\n|' + this.client.getOption('commandStackingChar')));
        else
            lines = str.split('\n');
        */
        if (this.client.getOption('commandStacking') && this.client.getOption('commandStackingChar') && this.client.getOption('commandStackingChar').length > 0)
            lines = str.splitQuote('\n' + this.client.getOption('commandStackingChar'));
        else
            lines = str.splitQuote('\n');
        let l = 0;
        const ll = lines.length;
        const code = [];
        const b = [];
        const cmdChar = this.client.getOption('commandChar');
        for (; l < ll; l++) {
            if (lines[l].trim().startsWith(cmdChar + 'wait ')) {
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

    public stripQuotes(str: string, force?: boolean, forceSingle?: boolean) {
        if (!str || str.length === 0)
            return str;
        if (force || this.client.getOption('parseDoubleQuotes'))
            str = str.replace(/^\"(.*)\"$/g, (v, e, w) => {
                return e.replace(/\\\"/g, '"');
            });
        if (forceSingle || this.client.getOption('parseSingleQuotes'))
            str = str.replace(/^\'(.*)\'$/g, (v, e, w) => {
                return e.replace(/\\\'/g, '\'');
            });
        return str;
    }

    public splitByQuotes(str: string, sep: string, force?: boolean, forceSingle?: boolean) {
        let t = 0;
        let e = 0;
        if (!str || str.length === 0)
            return [];
        if (force || this.client.getOption('parseDoubleQuotes')) {
            t |= 2;
            e |= this.client.getOption('allowEscape') ? 2 : 0;
        }
        if (forceSingle || this.client.getOption('parseSingleQuotes')) {
            t |= 1;
            e |= this.client.getOption('allowEscape') ? 1 : 0;
        }
        return splitQuoted(str, sep, t, e, this.client.getOption('escapeChar'));
    }

    public createTrigger(pattern: string, commands: string, profile?: string | Profile, options?, name?: string, subTrigger?: boolean) {
        let trigger;
        let sTrigger;
        let reload = true;
        let isNew = false;
        const p = parseTemplate('{profiles}');
        if (!pattern && !name)
            throw new Error(`Trigger '${name || ''}' not found`);
        if (!profile) {
            const keys = this.client.profiles.keys;
            let k = 0;
            const kl = keys.length;
            if (kl === 0)
                return;
            if (kl === 1) {
                if (this.client.enabledProfiles.indexOf(keys[0]) === -1 || !this.client.profiles.items[keys[0]].enableTriggers)
                    throw Error('No enabled profiles found!');
                profile = this.client.profiles.items[keys[0]];
                if (subTrigger) {
                    if (!name) {
                        if (!this.client.profiles.items[keys[k]].triggers.length)
                            throw new Error(`No triggers exist`);
                        trigger = this.client.profiles.items[keys[k]].triggers[this.client.profiles.items[keys[k]].triggers.length - 1];
                    }
                    else
                        trigger = this.client.profiles.items[keys[k]].findAny('triggers', { name: name, pattern: name });
                }
                else if (name !== null)
                    trigger = this.client.profiles.items[keys[k]].find('triggers', 'name', name);
                else
                    trigger = this.client.profiles.items[keys[k]].find('triggers', 'pattern', pattern);
            }
            else {
                for (; k < kl; k++) {
                    if (this.client.enabledProfiles.indexOf(keys[k]) === -1 || !this.client.profiles.items[keys[k]].enableTriggers || this.client.profiles.items[keys[k]].triggers.length === 0)
                        continue;
                    if (subTrigger) {
                        if (!name) {
                            if (!this.client.profiles.items[keys[k]].triggers.length)
                                throw new Error(`No triggers exist`);
                            trigger = this.client.profiles.items[keys[k]].triggers[this.client.profiles.items[keys[k]].triggers.length - 1];
                        }
                        else
                            trigger = this.client.profiles.items[keys[k]].findAny('triggers', { name: name, pattern: name });
                    }
                    else if (name !== null)
                        trigger = this.client.profiles.items[keys[k]].find('triggers', 'name', name);
                    else
                        trigger = this.client.profiles.items[keys[k]].find('triggers', 'pattern', pattern);
                    if (trigger) {
                        profile = this.client.profiles.items[keys[k]];
                        break;
                    }
                }
                if (!profile)
                    profile = this.client.activeProfile;
            }
        }
        else if (typeof profile === 'string') {
            if (this.client.profiles.contains(profile.toLowerCase()))
                profile = this.client.profiles.items[profile.toLowerCase()];
            else {
                reload = false;
                profile = Profile.load(path.join(p, profile.toLowerCase() + '.json'));
                if (!profile)
                    throw new Error('Profile not found: ' + profile);
            }
            if (subTrigger) {
                if (!name) {
                    if (!(<Profile>profile).triggers.length)
                        throw new Error(`No triggers exist`);
                    trigger = (<Profile>profile).triggers[(<Profile>profile).triggers.length - 1];
                }
                else
                    trigger = (<Profile>profile).findAny('triggers', { name: name, pattern: name });
            }
            else if (name !== null)
                trigger = (<Profile>profile).find('triggers', 'name', name);
            else
                trigger = (<Profile>profile).find('triggers', 'pattern', pattern);
        }
        if (subTrigger) {
            if (!trigger)
                throw new Error(`Trigger '${name || ''}' not found`);
            sTrigger
            sTrigger = new Trigger();
            sTrigger.pattern = pattern;
            reload = false;
            if (pattern !== null)
                sTrigger.pattern = pattern;
            if (commands !== null)
                sTrigger.value = commands;
            if (options) {
                if (options.cmd)
                    sTrigger.type = TriggerType.CommandInputRegular;

                if (options.pattern)
                    sTrigger.type = TriggerType.Pattern;
                if (options.regular)
                    sTrigger.type = TriggerType.Regular;
                if (options.alarm)
                    sTrigger.type = TriggerType.Alarm;
                if (options.event)
                    sTrigger.type = TriggerType.Event;
                if (options.cmdpattern)
                    sTrigger.type = TriggerType.CommandInputPattern;
                if (options.loopexpression)
                    sTrigger.type = TriggerType.LoopExpression;
                //if(options.expression)
                //sTrigger.type = TriggerType.Expression;                    
                if (options.reparse)
                    sTrigger.type = SubTriggerTypes.ReParse;
                if (options.reparsepattern)
                    sTrigger.type = SubTriggerTypes.ReParsePattern;
                if (options.manual)
                    sTrigger.type = SubTriggerTypes.Manual;
                if (options.skip)
                    sTrigger.type = SubTriggerTypes.Skip;
                if (options.looplines)
                    sTrigger.type = SubTriggerTypes.LoopLines;
                if (options.looppattern)
                    sTrigger.type = SubTriggerTypes.LoopPattern;
                if (options.wait)
                    sTrigger.type = SubTriggerTypes.Wait;
                if (options.duration)
                    sTrigger.type = SubTriggerTypes.Duration;
                if (options.withinlines)
                    sTrigger.type = SubTriggerTypes.WithinLines;

                if (options.prompt)
                    sTrigger.triggerPrompt = true;
                if (options.nocr)
                    sTrigger.triggerNewline = false;
                if (options.case)
                    sTrigger.caseSensitive = true;
                if (options.raw)
                    sTrigger.raw = true;
                if (options.verbatim)
                    sTrigger.verbatim = true;
                if (options.disable)
                    sTrigger.enabled = false;
                else if (options.enable)
                    sTrigger.enabled = true;
                if (options.temporary || options.temp)
                    sTrigger.temp = true;
                if (options.params)
                    sTrigger.params = options.params;
                if (options.type) {
                    if (this.isTriggerType(options.type))
                        sTrigger.type = this.convertTriggerType(options.type);
                    else
                        throw new Error('Invalid trigger type');
                }
            }
            trigger.triggers.push(sTrigger);
            this.client.echo('Trigger sub state added.', -7, -8, true, true);
        }
        else {
            if (!trigger) {
                if (!pattern)
                    throw new Error(`Trigger '${name || ''}' not found`);
                trigger = new Trigger();
                trigger.name = name || '';
                trigger.pattern = pattern;
                (<Profile>profile).triggers.push(trigger);
                this.client.echo('Trigger added.', -7, -8, true, true);
                isNew = true;
            }
            else
                this.client.echo('Trigger updated.', -7, -8, true, true);
            if (pattern !== null)
                trigger.pattern = pattern;
            if (commands !== null)
                trigger.value = commands;
            if (options) {
                if (options.cmd)
                    trigger.type = TriggerType.CommandInputRegular;
                if (options.pattern)
                    trigger.type = TriggerType.Pattern;
                if (options.regular)
                    trigger.type = TriggerType.Regular;
                if (options.alarm)
                    trigger.type = TriggerType.Alarm;
                if (options.event)
                    trigger.type = TriggerType.Event;
                if (options.cmdpattern)
                    trigger.type = TriggerType.CommandInputPattern;
                if (options.loopexpression)
                    trigger.type = TriggerType.LoopExpression;
                //if(options.expression)
                //trigger.type = TriggerType.Expression;

                if (options.prompt)
                    trigger.triggerPrompt = true;
                if (options.nocr)
                    trigger.triggerNewline = false;
                if (options.case)
                    trigger.caseSensitive = true;
                if (options.raw)
                    trigger.raw = true;
                if (options.verbatim)
                    trigger.verbatim = true;
                if (options.disable)
                    trigger.enabled = false;
                else if (options.enable)
                    trigger.enabled = true;
                if (options.temporary || options.temp)
                    trigger.temp = true;
                if (options.params)
                    trigger.params = options.params;
                if (options.type) {
                    if (this.isTriggerType(options.type, TriggerTypeFilter.Main))
                        trigger.type = this.convertTriggerType(options.type);
                    else
                        throw new Error('Invalid trigger type');
                }
                trigger.priority = options.priority;
            }
            else
                trigger.priority = 0;
        }
        (<Profile>profile).save(p);
        if (reload)
            this.client.clearCache();
        if (isNew)
            this.emit('item-added', 'trigger', (<Profile>profile).name, trigger);
        else
            this.emit('item-updated', 'trigger', (<Profile>profile).name, (<Profile>profile).triggers.indexOf(trigger), trigger);
        profile = null;
    }

    private isTriggerType(type, filter?: TriggerTypeFilter) {
        if (!filter) filter = TriggerTypeFilter.All;
        switch (type.replace(/ /g, '').toUpperCase()) {
            case 'REGULAREXPRESSION':
            case 'COMMANDINPUTREGULAREXPRESSION':
                return (filter & TriggerTypeFilter.Main) === TriggerTypeFilter.Main ? true : false;
            case '0':
            case '1':
            case '2':
            case '3':
            case '8':
            case '16':
            //case '64':
            case '128':
            case 'REGULAR':
            case 'COMMANDINPUTREGULAR':
            case 'EVENT':
            case 'ALARM':
            case 'COMMAND':
            case 'COMMANDINPUTPATTERN':
            case 'LOOPEXPRSSION':
                //case 'EXPRESSION':
                return (filter & TriggerTypeFilter.Main) === TriggerTypeFilter.Main ? true : false;
            case 'SKIP':
            case '512':
            case 'WAIT':
            case '1024':
            case 'LOOPPATTERN':
            case '4096':
            case 'LOOPLINES':
            case '8192':
            case 'DURATION':
            case '16384':
            case 'WITHINLINES':
            case '32768':
            case 'MANUAL':
            case '65536':
            case 'REPARSE':
            case '131072':
            case 'REPARSEPATTERN':
            case '262144':
                return (filter & TriggerTypeFilter.Sub) === TriggerTypeFilter.Sub ? true : false;
        }
        return false;
    }

    private convertTriggerType(type) {
        switch (type.replace(/ /g, '').toUpperCase()) {
            case 'REGULAREXPRESSION':
                return TriggerType.Regular;
            case 'COMMANDINPUTREGULAREXPRESSION':
                return TriggerType.CommandInputRegular;
            case '0':
            case '1':
            case '2':
            case '3':
            case '8':
            case '16':
            case '128':
                //case '64':
                return TriggerType[parseInt(type, 10)];
            case 'REGULAR':
            case 'COMMANDINPUTREGULAR':
            case 'EVENT':
            case 'ALARM':
            case 'COMMAND':
            case 'COMMANDINPUTPATTERN':
            case 'LOOPEXPRSSION':
                //case 'EXPRESSION':
                return TriggerType[type];
            case '512':
            case '1024':
            case '4096':
            case '8192':
            case '16384':
            case '32768':
            case '65536':
            case '131072':
            case '262144':
                return SubTriggerTypes[parseInt(type, 10)];
            case 'SKIP':
            case 'WAIT':
            case 'LOOPPATTERN':
            case 'LOOPLINES':
            case 'DURATION':
            case 'WITHINLINES':
            case 'MANUAL':
            case 'REPARSE':
            case 'REPARSEPATTERN':
                return SubTriggerTypes[type];
        }
        throw new Error('Invalid trigger type');
    }

    private colorPosition(n: number, fore, back, item) {
        n = this.adjustLastLine(n);
        if (!item.hasOwnProperty('yStart'))
            this.client.display.colorSubStringByLine(n, fore, back, item.xStart, item.hasOwnProperty('xEnd') && item.xEnd >= 0 ? item.xEnd : null);
        else {
            const xEnd = item.hasOwnProperty('xEnd') && item.xEnd >= 0 ? item.xEnd : null;
            const xStart = item.xStart;
            let line = n - item.yStart;
            let end = n;
            if (item.hasOwnProperty('yEnd'))
                end = n - item.yEnd;
            while (line <= end) {
                this.client.display.colorSubStringByLine(line, fore, back, xStart, xEnd);
                line++;
            }
        }
    }
}