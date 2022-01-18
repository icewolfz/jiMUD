//spell-checker:ignore displaytype, submenu, triggernewline, triggerprompt
import { clone, keyCodeToChar, isFileSync, SortItemArrayByPriority, splitQuoted, isValidIdentifier } from './library';
const path = require('path');
const fs = require('fs');

export enum MacroModifiers {
    None = 0,
    Alt = 2,
    Ctrl = 4,
    Shift = 8,
    Meta = 16,
    All = Alt | Ctrl | Shift | Meta
}

export enum ItemDisplayType {
    Text = 0,
    Function = 1
}

export enum ItemStyle {
    Text = 0,
    Parse = 1,
    Script = 2
}

export enum TriggerType {
    Regular = 0,
    CommandInputRegular = 1,
    Event = 2,
    Alarm = 3,
    Pattern = 8,
    CommandInputPattern = 16
}

export enum TriggerTypes {
    None = 0,
    Regular = 4,
    CommandInputRegular = 1,
    Event = 2,
    Alarm = 32,
    Pattern = 8,
    CommandInputPattern = 16
}

export enum VariableType {
    Auto = 1,
    Integer = 2,
    StringExpanded = 3,
    StringLiteral = 4,
    StringList = 5,
    Record = 6,
    Float = 7,
    Array = 8
}

export function MacroDisplay(item: Macro) {
    const d = [];
    if (item.gamepad > 0) {
        d.push('Gamepad ' + item.gamepad);
        if (item.key > 0)
            d.push('Button ' + item.key);
        else if (item.gamepadAxes < 0)
            d.push('Axis ' + -item.gamepadAxes);
        else if (item.gamepadAxes > 0)
            d.push('Axis ' + item.gamepadAxes);
        if (d.length === 1)
            return 'None';
        return d.join('+');
    }
    if (item.key === 0) {
        if (item.name && item.name.length > 0)
            return 'None - ' + item.name;
        return 'None';
    }
    if ((item.modifiers & MacroModifiers.Ctrl) === MacroModifiers.Ctrl)
        d.push('Ctrl');
    if ((item.modifiers & MacroModifiers.Alt) === MacroModifiers.Alt)
        d.push('Alt');
    if ((item.modifiers & MacroModifiers.Shift) === MacroModifiers.Shift)
        d.push('Shift');
    if ((item.modifiers & MacroModifiers.Meta) === MacroModifiers.Meta) {
        if (process.platform === 'darwin')
            d.push('Cmd');
        else
            d.push('Win');
    }
    if (keyCodeToChar[item.key])
        d.push(keyCodeToChar[item.key]);
    else if (item.name && item.name.length > 0)
        return 'None - ' + item.name;
    else
        return 'None';
    if (item.name && item.name.length > 0)
        return d.join('+') + ' - ' + item.name;
    return d.join('+');
}

export class Alarm {
    public parent: Trigger;
    public pattern: string;
    public temp: boolean = false;
    public start: boolean = false;
    public seconds: number = -1;
    public secondsWildcard: boolean = true;
    public hours: number = -1;
    public hoursWildcard: boolean = true;
    public minutes: number = -1;
    public minutesWildcard: boolean = true;
    public startTime: number;
    public suspended: number = 0;
    public tempTime: number;
    public prevTime: number;

    constructor(data?, pattern?) {
        if (typeof data === 'string') {
            pattern = data;
            data = 0;
        }
        this.parent = data;
        this.pattern = pattern;
        this.startTime = Date.now();
        this.prevTime = this.startTime;
    }

    public static parse(parent, pattern?: string, readOnly?: boolean): Alarm {
        if (typeof parent === 'string') {
            pattern = parent;
            parent = 0;
        }
        if (!pattern || pattern.length === 0) {
            if (typeof parent === 'object')
                pattern = parent.pattern;
            else
                throw new Error('Blank pattern');
        }
        const t = new Alarm(parent, pattern);
        while (pattern[0] === '-' || pattern[0] === '+') {
            if (pattern[0] === '-')
                t.start = true;
            else if (pattern[0] === '+')
                t.temp = true;
            pattern = pattern.substr(1);
        }
        if (pattern !== '*') {
            const parts = pattern.split(':');
            let tmp;
            if (parts.length === 0)
                throw new Error('Invalid format: ' + pattern);
            if (parts.length === 1) {
                if (parts[0][0] === '*') {
                    t.secondsWildcard = true;
                    parts[0] = parts[0].substr(1);
                }
                tmp = parseInt(parts[0], 10);
                if (isNaN(tmp))
                    throw new Error('Invalid Format: ' + parts[0]);
                if (tmp < 0)
                    throw new Error('Seconds must be greater than or equal to 0.');
                else if (tmp > 59)
                    t.secondsWildcard = true;
                t.seconds = tmp;
            }
            else if (parts.length === 2) {
                if (parts[0][0] === '*') {
                    t.minutesWildcard = true;
                    parts[0] = parts[0].substr(1);
                }
                tmp = parseInt(parts[0], 10);
                if (isNaN(tmp))
                    throw new Error('Invalid Format: ' + parts[0]);
                if (tmp < 0 || tmp > 59)
                    throw new Error('Minutes can only be 0 to 59');
                t.minutes = tmp;

                if (parts[1][0] === '*') {
                    t.secondsWildcard = true;
                    parts[1] = parts[1].substr(1);
                }
                else
                    t.secondsWildcard = false;
                tmp = parseInt(parts[1], 10);
                if (isNaN(tmp))
                    throw new Error('Invalid Format: ' + parts[1]);
                if (tmp < 0 || tmp > 59)
                    throw new Error('Seconds can only be 0 to 59');
                t.seconds = tmp;

            }
            else {
                if (parts[0][0] === '*') {
                    t.hoursWildcard = true;
                    parts[0] = parts[0].substr(1);
                }
                tmp = parseInt(parts[0], 10);
                if (isNaN(tmp))
                    throw new Error('Invalid Format: ' + parts[0]);
                if (tmp < 0 || tmp > 23)
                    throw new Error('Hours can only be 0 to 23');
                t.hours = tmp;

                if (parts[1][0] === '*') {
                    t.minutesWildcard = true;
                    parts[1] = parts[1].substr(1);
                }
                tmp = parseInt(parts[1], 10);
                if (isNaN(tmp))
                    throw new Error('Invalid Format: ' + parts[1]);
                if (tmp < 0 || tmp > 59)
                    throw new Error('Minutes can only be 0 to 59');
                t.minutes = tmp;

                if (parts[2][0] === '*') {
                    t.secondsWildcard = true;
                    parts[2] = parts[2].substr(2);
                }
                else
                    t.secondsWildcard = false;
                tmp = parseInt(parts[2], 10);
                if (isNaN(tmp))
                    throw new Error('Invalid Format: ' + parts[2]);
                if (tmp < 0 || tmp > 59)
                    throw new Error('Seconds can only be 0 to 59');
                t.seconds = tmp;
            }
        }
        if (readOnly)
            t.temp = false;
        return t;
    }

    public setTempTime(value: number) {
        if (!value)
            this.tempTime = 0;
        else
            this.tempTime = Date.now() + value;
    }
}

export class Item {
    public name: string = '';
    public priority: number = 0;
    public display: string = 'name';
    public displaytype: ItemDisplayType = ItemDisplayType.Text;
    public value: string = '';
    public style: ItemStyle = ItemStyle.Parse;
    public group: string = '';
    public enabled: boolean = true;
    public notes: string = '';
    public profile: Profile;

    constructor(data?, profile?) {
        if (typeof data === 'object') {
            let prop;
            for (prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = data[prop];
            }
        }
        this.profile = profile;
    }

    public clone() {
        return new Item(this);
    }
}

export class Button extends Item {
    public caption: string = '';
    public icon: string = '';
    public append: boolean = false;
    public send: boolean = true;
    public chain: boolean = false;
    public stretch: boolean = false;
    public parse: boolean = false;
    constructor(data?, profile?) {
        super(data);
        this.caption = 'NewButton';
        this.display = 'caption';
        if (typeof data === 'object') {
            let prop;
            for (prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = data[prop];
            }
        }
        this.profile = profile;
    }

    public clone() {
        return new Button(this);
    }
}

export class Macro extends Item {
    public key: number = 0;
    public append: boolean = false;
    public send: boolean = true;
    public modifiers: MacroModifiers = MacroModifiers.None;
    public chain: boolean = false;
    public gamepad: number = 0;
    public gamepadAxes: number = 0;

    constructor(data?, profile?) {
        super();
        this.display = 'return MacroDisplay(item)';
        this.displaytype = ItemDisplayType.Function;
        if (typeof data === 'object') {
            let prop;
            for (prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = data[prop];
            }
        }
        this.profile = profile;
    }

    public clone() {
        return new Macro(this);
    }
}

export class Alias extends Item {
    public pattern: string = 'NewAlias';
    public regexp: boolean = false;
    public multi: boolean = false;
    public append: boolean = true;
    public params: string = '';

    constructor(pattern?: any, value?: string, profile?) {
        super();
        if (typeof pattern === 'string')
            this.pattern = pattern;
        if (value != null)
            this.value = value;
        this.display = 'pattern';
        if (typeof pattern === 'object') {
            let prop;
            for (prop in pattern) {
                if (!pattern.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = pattern[prop];
            }
        }
        this.profile = profile;
    }

    public clone() {
        return new Alias(this);
    }
}

export class Trigger extends Item {
    public pattern: string = 'NewTrigger';
    public verbatim: boolean = false;
    public triggerNewline: boolean = true;
    public triggerPrompt: boolean = false;
    public type: TriggerType = TriggerType.Regular;
    public temp: boolean = false;
    public caseSensitive: boolean = false;
    public raw: boolean = false;
    public state: number = 0;
    public params: string = '';
    public triggers: Trigger[] = [];

    constructor(data?, profile?) {
        super(data);
        this.display = 'pattern';
        if (typeof data === 'object') {
            let prop;
            for (prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                if (prop === 'triggers') {
                    this.triggers = [];
                    const il = data.triggers.length;
                    for (let i = 0; i < il; i++) {
                        this.triggers.push(new Trigger(data.triggers[i]));
                    }
                }
                else
                    this[prop] = data[prop];
            }
        }
        this.profile = profile;
    }

    public clone() {
        return new Trigger(this);
    }
}

export class Context extends Item {
    public caption: string = '';
    public icon: string = '';
    public append: boolean = false;
    public send: boolean = true;
    public chain: boolean = false;
    public parent: string = '';
    public items: Context[] = [];
    public parse: boolean = false;
    constructor(data?, profile?) {
        super(data);
        this.caption = 'NewContext';
        this.display = 'caption';
        if (typeof data === 'object') {
            let prop;
            for (prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                if (prop === 'items') {
                    let i = 0;
                    const il = data[prop].length;
                    for (; i < il; i++)
                        this.items.push(new Context(data[prop][i]));
                }
                else
                    this[prop] = data[prop];
            }
        }
        this.profile = profile;
    }

    public clone() {
        return new Context(this);
    }
}

export class Variable extends Item {
    private _type: string = 'string';

    public type: VariableType = VariableType.Auto;
    public defaultValue: string = '';
    public useDefault: boolean = false;
    public params: string = '';

    public set setValue(value: any) {
        switch (this.type) {
            case VariableType.Integer:
                if (typeof value === 'string') {
                    value = parseInt(value, 10);
                    if (isNaN(value))
                        value = 0;
                }
                else if (typeof value === 'boolean')
                    value = value ? 1 : 0;
                break;
            case VariableType.Float:
                if (typeof value === 'string') {
                    value = parseFloat(value);
                    if (isNaN(value))
                        value = 0.0;
                }
                else if (typeof value === 'boolean')
                    value = value ? 1.0 : 0.0;
                break;
        }
        super.value = value;
        this._type = typeof value;
    }
    public get getValue(): any {
        switch (this.type) {
            case VariableType.Auto:
                if (typeof this.value !== this._type) {
                    switch (this._type) {
                        case 'number':
                            return Number(this.value);
                        case 'string':
                            return this.value.toString();
                        case 'boolean':
                            return Boolean(this.value);
                    }
                }
                return this.value;
            case VariableType.Float:
                return parseFloat(this.value);
            case VariableType.Integer:
                return parseInt(this.value, 10);
            case VariableType.Record:
                if (typeof this.value === 'string')
                    try {
                        return JSON.parse(this.value);
                    }
                    catch {
                        return this.value;
                    }
                return this.value;
            case VariableType.StringList:
                if (typeof this.value === 'string')
                    return splitQuoted(this.value, '|');
                return this.value;
        }
        return this.value;
    }

    constructor(data?, profile?) {
        super(data);
        this.profile = profile;
        if (this.useDefault)
            this.setValue(this.defaultValue);
    }

    public clone() {
        return new Variable(this);
    }

    public toString() {
        switch (this.type) {
            case VariableType.Record:
                if (typeof this.value === 'string')
                    return this.value;
                return JSON.stringify(this.value);
            case VariableType.StringList:
                if (typeof this.value === 'string')
                    return this.value;
                return '"' + (<any[]>this.value).join('"|"') + '"';
        }
        return this.value?.toString();
    }
}

export class Profile {
    public name: string = '';
    public file: string = '';
    public priority: number = 0;
    public enabled: boolean = true;
    public aliases: Alias[] = [];
    public triggers: Trigger[] = [];
    public macros: Macro[] = [];
    public buttons: Button[] = [];
    public contexts: Context[] = [];
    public enableMacros: boolean = true;
    public enableTriggers: boolean = true;
    public enableAliases: boolean = true;
    public enableButtons: boolean = true;
    public enableContexts: boolean = true;
    public enableDefaultContext: boolean = true;

    constructor(name?: (string | boolean), defaults?: boolean) {
        if (typeof name === 'string') {
            this.name = name;
            this.file = name.toLowerCase();
            if (defaults == null || defaults)
                this.macros = Profile.DefaultMacros;
        }
        else if (typeof name === 'boolean') {
            if (name)
                this.macros = Profile.DefaultMacros;
        }
        else if (defaults == null || defaults)
            this.macros = Profile.DefaultMacros;
    }

    static get Default(): Profile {
        return new Profile('Default');
    }

    static get DefaultMacros(): Macro[] {
        const data = [
            {
                key: 97,
                display: 'return MacroDisplay(item)',
                displaytype: ItemDisplayType.Function,
                value: 'sw',
                style: ItemStyle.Parse,
                append: false,
                send: true,
                name: 'SouthWest',
                group: '',
                enabled: true,
                modifiers: MacroModifiers.None,
                chain: true,
                priority: 0,
                notes: ''
            },
            {
                key: 98,
                display: 'return MacroDisplay(item)',
                displaytype: ItemDisplayType.Function,
                value: 's',
                style: ItemStyle.Parse,
                append: false,
                send: true,
                name: 'South',
                group: '',
                enabled: true,
                modifiers: MacroModifiers.None,
                chain: true,
                priority: 0,
                notes: ''
            },
            {
                key: 99,
                display: 'return MacroDisplay(item)',
                displaytype: ItemDisplayType.Function,
                value: 'se',
                style: ItemStyle.Parse,
                append: false,
                send: true,
                name: 'SouthEast',
                group: '',
                enabled: true,
                modifiers: MacroModifiers.None,
                chain: true,
                priority: 0,
                notes: ''
            },
            {
                key: 100,
                display: 'return MacroDisplay(item)',
                displaytype: ItemDisplayType.Function,
                value: 'w',
                style: ItemStyle.Parse,
                append: false,
                send: true,
                name: 'West',
                group: '',
                enabled: true,
                modifiers: MacroModifiers.None,
                chain: true,
                priority: 0,
                notes: ''
            },
            {
                key: 101,
                display: 'return MacroDisplay(item)',
                displaytype: ItemDisplayType.Function,
                value: 'l',
                style: ItemStyle.Parse,
                append: false,
                send: true,
                name: 'Look',
                group: '',
                enabled: true,
                modifiers: MacroModifiers.None,
                chain: true,
                priority: 0,
                notes: ''
            },
            {
                key: 102,
                display: 'return MacroDisplay(item)',
                displaytype: ItemDisplayType.Function,
                value: 'e',
                style: ItemStyle.Parse,
                append: false,
                send: true,
                name: 'East',
                group: '',
                enabled: true,
                modifiers: MacroModifiers.None,
                chain: true,
                priority: 0,
                notes: ''
            },
            {
                key: 103,
                display: 'return MacroDisplay(item)',
                displaytype: ItemDisplayType.Function,
                value: 'nw',
                style: ItemStyle.Parse,
                append: false,
                send: true,
                name: 'NorthWest',
                group: '',
                enabled: true,
                modifiers: MacroModifiers.None,
                chain: true,
                priority: 0,
                notes: ''
            },
            {
                key: 104,
                display: 'return MacroDisplay(item)',
                displaytype: ItemDisplayType.Function,
                value: 'n',
                style: ItemStyle.Parse,
                append: false,
                send: true,
                name: 'North',
                group: '',
                enabled: true,
                modifiers: MacroModifiers.None,
                chain: true,
                priority: 0,
                notes: ''
            },
            {
                key: 105,
                display: 'return MacroDisplay(item)',
                displaytype: ItemDisplayType.Function,
                value: 'ne',
                style: ItemStyle.Parse,
                append: false,
                send: true,
                name: 'NorthEast',
                group: '',
                enabled: true,
                modifiers: MacroModifiers.None,
                chain: true,
                priority: 0,
                notes: ''
            }
        ];
        const m: Macro[] = [];
        const dl = data.length;
        for (let d = 0; d < dl; d++)
            m.push(new Macro(data[d]));
        return m;
    }

    public static load(file) {
        let profile;
        let data;
        if (typeof file === 'string') {
            if (!isFileSync(file))
                return null;
            data = fs.readFileSync(file, 'utf-8');
            if (data.length === 0)
                return new Profile(path.basename(file, '.json'));
            try {
                data = JSON.parse(data);
            }
            catch (e) {
                return new Profile(path.basename(file, '.json'));
            }
        }
        else if (typeof file === 'object')
            data = file;
        else
            return new Profile();
        profile = new Profile(false);
        let prop;
        for (prop in data) {
            if (!data.hasOwnProperty(prop)) {
                continue;
            }
            if (prop === 'aliases' || prop === 'triggers' || prop === 'macros' || prop === 'buttons' || prop === 'contexts' || prop === 'variables')
                continue;
            profile[prop] = data[prop];
        }

        let i;
        let il;
        if (data.aliases && data.aliases.length > 0) {
            il = data.aliases.length;
            for (i = 0; i < il; i++) {
                profile.aliases.push(new Alias(data.aliases[i], null, profile));
            }
        }
        if (data.triggers && data.triggers.length > 0) {
            il = data.triggers.length;
            for (i = 0; i < il; i++) {
                profile.triggers.push(new Trigger(data.triggers[i], profile));
            }
        }
        if (data.macros && data.macros.length > 0) {
            il = data.macros.length;
            profile.macros = [];
            for (i = 0; i < il; i++) {
                profile.macros.push(new Macro(data.macros[i], profile));
            }
        }
        if (data.buttons && data.buttons.length > 0) {
            il = data.buttons.length;
            for (i = 0; i < il; i++) {
                profile.buttons.push(new Button(data.buttons[i], profile));
            }
        }
        if (data.contexts && data.contexts.length > 0) {
            il = data.contexts.length;
            for (i = 0; i < il; i++) {
                profile.contexts.push(new Context(data.contexts[i], profile));
            }
        }
        profile.file = profile.name;
        return profile;
    }

    public save(p) {
        if (this.file !== this.name.toLowerCase()) {
            if (isFileSync(path.join(p, this.file + '.json')))
                fs.unlinkSync(path.join(p, this.file + '.json'));
            this.file = this.name.toLowerCase();
        }
        fs.writeFileSync(path.join(p, this.file + '.json'), JSON.stringify(this, (key, value) => {
            if (key === 'profile') return undefined;
            return value;
        }));
    }

    public clone(version?: number) {
        let data;
        let i;
        let il;
        if (version === 2) {
            data = {
                name: this.name,
                priority: this.priority,
                enabled: this.enabled,
                aliases: [],
                triggers: [],
                macros: [],
                buttons: [],
                contexts: [],
                enableMacros: this.enableMacros,
                enableTriggers: this.enableTriggers,
                enableAliases: this.enableAliases,
                enableButtons: this.enableButtons,
                enableContexts: this.enableContexts,
                enableDefaultContext: this.enableDefaultContext
            };

            if (this.aliases.length > 0) {
                il = this.aliases.length;
                for (i = 0; i < il; i++) {
                    data.aliases.push({
                        pattern: this.aliases[i].pattern,
                        value: this.aliases[i].value,
                        priority: this.aliases[i].priority,
                        regexp: this.aliases[i].regexp,
                        style: this.aliases[i].style,
                        multi: this.aliases[i].multi,
                        append: this.aliases[i].append,
                        name: this.aliases[i].name,
                        group: this.aliases[i].group,
                        enabled: this.aliases[i].enabled,
                        params: this.aliases[i].params,
                        display: this.aliases[i].display,
                        notes: this.aliases[i].notes || ''
                    });
                }
            }
            if (this.triggers.length > 0) {
                il = this.triggers.length;
                for (i = 0; i < il; i++) {
                    const t = {
                        pattern: this.triggers[i].pattern,
                        value: this.triggers[i].value,
                        priority: this.triggers[i].priority,
                        verbatim: this.triggers[i].verbatim,
                        style: this.triggers[i].style,
                        name: this.triggers[i].name,
                        group: this.triggers[i].group,
                        enabled: this.triggers[i].enabled,
                        display: this.triggers[i].display,
                        triggernewline: this.triggers[i].triggerNewline,
                        caseSensitive: this.triggers[i].caseSensitive,
                        triggerprompt: this.triggers[i].triggerPrompt,
                        raw: this.triggers[i].raw,
                        type: this.triggers[i].type,
                        notes: this.triggers[i].notes || '',
                        state: this.triggers[i].state || 0,
                        params: this.triggers[i].params || '',
                        triggers: []
                    }
                    if (this.triggers[i].triggers && this.triggers[i].triggers.length) {
                        const sl = this.triggers[i].triggers.length;
                        for (let s = 0; s < sl; s++) {
                            t.triggers.push({
                                pattern: this.triggers[i].triggers[s].pattern,
                                value: this.triggers[i].triggers[s].value,
                                priority: this.triggers[i].triggers[s].priority,
                                verbatim: this.triggers[i].triggers[s].verbatim,
                                style: this.triggers[i].triggers[s].style,
                                name: this.triggers[i].triggers[s].name,
                                group: this.triggers[i].triggers[s].group,
                                enabled: this.triggers[i].triggers[s].enabled,
                                display: this.triggers[i].triggers[s].display,
                                triggernewline: this.triggers[i].triggers[s].triggerNewline,
                                caseSensitive: this.triggers[i].triggers[s].caseSensitive,
                                triggerprompt: this.triggers[i].triggers[s].triggerPrompt,
                                raw: this.triggers[i].triggers[s].raw,
                                type: this.triggers[i].triggers[s].type,
                                notes: this.triggers[i].triggers[s].notes || '',
                                state: this.triggers[i].triggers[s].state || 0,
                                params: this.triggers[i].triggers[s].params || '',
                                triggers: []
                            });
                        }
                    }
                    data.triggers.push(t);
                }
            }
            if (this.macros.length > 0) {
                il = this.macros.length;
                for (i = 0; i < il; i++) {
                    data.macros.push({
                        key: this.macros[i].key,
                        value: this.macros[i].value,
                        style: this.macros[i].style,
                        append: this.macros[i].append,
                        send: this.macros[i].send,
                        name: this.macros[i].name,
                        group: this.macros[i].group,
                        enabled: this.macros[i].enabled,
                        display: 'if(item.key === 0) return "None"; return keyCodeToChar[item.key]',
                        displaytype: 1,
                        modifiers: this.macros[i].modifiers,
                        chain: this.macros[i].chain,
                        notes: this.macros[i].notes || ''
                    });
                }
            }
            if (this.buttons.length > 0) {
                il = this.buttons.length;
                for (i = 0; i < il; i++) {
                    data.buttons.push(clone(this.buttons[i], (key, value) => {
                        if (key === 'profile') return undefined;
                        return value;
                    }));
                }
            }
            if (this.contexts.length > 0) {
                il = this.contexts.length;
                for (i = 0; i < il; i++) {
                    data.contexts.push(clone(this.contexts[i], (key, value) => {
                        if (key === 'profile') return undefined;
                        return value;
                    }));
                }
            }
            return data;
        }
        data = clone(this);
        const profile = new Profile(false);
        let prop;
        for (prop in data) {
            if (!data.hasOwnProperty(prop)) {
                continue;
            }
            if (prop === 'aliases' || prop === 'triggers' || prop === 'macros' || prop === 'buttons' || prop === 'contexts' || prop === 'variables')
                continue;
            profile[prop] = data[prop];
        }

        if (data.aliases && data.aliases.length > 0) {
            il = data.aliases.length;
            for (i = 0; i < il; i++) {
                profile.aliases.push(new Alias(data.aliases[i], null, profile));
            }
        }
        if (data.triggers && data.triggers.length > 0) {
            il = data.triggers.length;
            for (i = 0; i < il; i++) {
                profile.triggers.push(new Trigger(data.triggers[i], profile));
            }
        }
        if (data.macros && data.macros.length > 0) {
            il = data.macros.length;
            profile.macros = [];
            for (i = 0; i < il; i++) {
                profile.macros.push(new Macro(data.macros[i], profile));
            }
        }
        if (data.buttons && data.buttons.length > 0) {
            il = data.buttons.length;
            for (i = 0; i < il; i++) {
                profile.buttons.push(new Button(data.buttons[i], profile));
            }
        }
        if (data.contexts && data.contexts.length > 0) {
            il = data.contexts.length;
            for (i = 0; i < il; i++) {
                const item = data.contexts[i].clone();
                item.profile = profile;
                profile.contexts.push(item);
            }
        }
        return profile;
    }

    public find(type, field, value) {
        let tmp;
        if (!type || type.length === 0 || !this[type] || this[type].length === 0)
            return null;
        tmp = SortItemArrayByPriority(this[type]);
        const l = tmp.length;
        for (let t = 0; t < l; t++) {
            if (tmp[t][field] === value)
                return tmp[t];
        }
        return null;
    }

    public findAny(type, field, value) {
        let tmp;
        if (!type || type.length === 0 || !this[type] || this[type].length === 0)
            return null;
        tmp = SortItemArrayByPriority(this[type]);
        const l = tmp.length;
        if (typeof field === 'object') {
            for (let t = 0; t < l; t++) {
                for (const v in field) {
                    if (!field.hasOwnProperty(v)) continue;
                    if (tmp[t][v] === field[v])
                        return tmp[t];
                }
            }
            return -1;
        }
        for (let t = 0; t < l; t++) {
            if (tmp[t][field] === value)
                return tmp[t];
        }
        return null;
    }

    public indexOfAny(type, field, value) {
        let tmp;
        if (!type || type.length === 0 || !this[type] || this[type].length === 0)
            return null;
        tmp = SortItemArrayByPriority(this[type]);
        const l = tmp.length;
        if (typeof field === 'object') {
            for (let t = 0; t < l; t++) {
                for (const v in field) {
                    if (!field.hasOwnProperty(v)) continue;
                    if (tmp[t][v] === field[v])
                        return this[type].indexOf(tmp[t]);
                }
            }
            return -1;
        }
        for (let t = 0; t < l; t++) {
            if (tmp[t][field] === value)
                return this[type].indexOf(tmp[t]);
        }
        return -1;
    }

    public indexOf(type, field, value) {
        let tmp;
        if (!type || type.length === 0 || !this[type] || this[type].length === 0)
            return null;
        tmp = SortItemArrayByPriority(this[type]);
        const l = tmp.length;
        if (typeof field === 'object') {
            for (let t = 0; t < l; t++) {
                for (const v in field) {
                    if (!field.hasOwnProperty(v)) continue;
                    if (tmp[t][v] !== field[v]) continue;
                }
                return this[type].indexOf(tmp[t]);
            }
            return -1;
        }
        for (let t = 0; t < l; t++) {
            if (tmp[t][field] === value)
                return this[type].indexOf(tmp[t]);
        }
        return -1;
    }
}

export class ProfileCollection {
    public items = {};
    public keys = [];

    constructor(defaultProfile?: Profile) {
        this.add(defaultProfile == null ? Profile.Default : defaultProfile);
    }

    public SortByPriority() {
        this.keys.sort((a, b) => {
            let ap = this.items[a].priority;
            let bp = this.items[b].priority;
            if (ap > bp)
                return -1;
            if (ap < bp)
                return 1;
            ap = this.items[a].name;
            bp = this.items[b].name;
            if (ap === 'default')
                return -1;
            if (bp === 'default')
                return 1;
            if (ap > bp)
                return -1;
            if (ap < bp)
                return 1;
            return 0;
        });
    }

    public enabled(profile: (string | Profile)): boolean {
        if (!profile || this.keys.length === 0) return false;
        if (typeof profile === 'string') {
            if (!this.items[profile.toLowerCase()])
                return false;
            return this.items[profile.toLowerCase()].enabled;
        }
        return this.items[profile.name.toLowerCase()] ? this.items[profile.name.toLowerCase()].enabled : false;
    }

    public contains(profile: (string | Profile)): boolean {
        if (!profile || this.keys.length === 0) return false;
        if (typeof profile === 'string')
            return this.items[profile.toLowerCase()] ? true : false;
        return this.items[profile.name.toLowerCase()] ? true : false;
    }

    public canDisable(profile: any) {
        if (!profile || this.keys.length === 0) return false;
        let idx: any;
        if (typeof profile === 'number') {
            if (profile < 0)
                return false;
            if (profile >= this.keys.length)
                return false;
            idx = this.keys[profile];
        }
        else if (typeof profile === 'object')
            idx = profile.name.toLowerCase();
        else if (typeof profile === 'string')
            idx = profile.toLowerCase();
        else
            return false;

        if (!this.items[idx]) return false;
        const e = !this.items[idx].enabled;
        if (!e) {
            let c = false;
            for (const key in this.items) {
                if (key === idx) continue;
                if (this.items[key].enabled) c = true;
                break;
            }
            if (!c)
                return false;
        }
        return true;
    }

    public toggle(profile: any) {
        if (!profile || this.keys.length === 0) return false;
        let idx: any;
        if (typeof profile === 'number') {
            if (profile < 0)
                return false;
            if (profile >= this.keys.length)
                return false;
            idx = this.keys[profile];
        }
        else if (typeof profile === 'object')
            idx = profile.name.toLowerCase();
        else if (typeof profile === 'string')
            idx = profile.toLowerCase();
        else
            return false;

        if (!this.items[idx]) return false;
        const e = !this.items[idx].enabled;
        if (!e) {
            let c = false;
            for (const key in this.items) {
                if (key === idx) continue;
                if (this.items[key].enabled) c = true;
                break;
            }
            if (!c)
                return false;
        }
        this.items[idx].enabled = e;
        return true;
    }

    public update() {
        this.keys = Object.keys(this.items);
        this.SortByPriority();
    }

    public add(profile: Profile) {
        if (!profile)
            return;
        this.items[profile.name.toLowerCase()] = profile;
        this.update();
    }

    public remove(profile: (string | Profile | number)) {
        if (!profile || this.keys.length === 0) return;
        if (typeof profile === 'string')
            delete this.items[profile.toLowerCase()];
        else if (typeof profile === 'number') {
            if (profile < 0 || profile >= this.keys.length) return;
            delete this.items[this.keys[profile]];
        }
        else
            delete this.items[profile.name.toLowerCase()];
        this.update();
    }

    public copy(profile: (string | Profile | number)): (Profile | Profile[]) {
        if (!profile) return clone(this.items);
        if (this.keys.length === 0)
            return null;
        if (typeof profile === 'string') {
            if (!this.items[profile.toLowerCase()])
                return null;
            return this.items[profile.toLowerCase()].clone();
        }
        if (typeof profile === 'number') {
            if (profile < 0 || profile >= this.keys.length) return null;
            return this.items[this.keys[profile]].clone();
        }
        return profile.clone();
    }

    public clone(version?: number): ProfileCollection | any {
        if (version === 2) {
            const profiles = {};
            for (const p in this.items)
                profiles[this.items[p].name] = this.items[p].clone(2);
            return profiles;
        }
        const pc = new ProfileCollection();
        for (const p in this.items)
            pc.items[this.items[p].name] = this.items[p].clone();
        pc.update();
        return pc;
    }

    public load(list: (string | string[]), p: string) {
        if (typeof list === 'string')
            list = [list];
        for (let i = 0; i < list.length; i++) {
            const n = path.join(p, list[i] + '.json');
            if (isFileSync(n))
                this.add(Profile.load(n));
        }
    }

    public loadPath(p: string) {
        const files = fs.readdirSync(p);
        for (let i = 0; i < files.length; i++) {
            if (path.extname(files[i]) === '.json') {
                this.add(Profile.load(path.join(p, files[i])));
            }
        }
    }

    public save(p) {
        let profile;
        for (profile in this.items) {
            if (!this.items.hasOwnProperty(profile)) continue;
            this.items[profile].save(p);
        }
    }

    get length(): number {
        return this.keys.length;
    }

    public count(): number { return this.keys.length; }

    get active(): Profile {
        const keys = this.keys;
        //no profiles, add default and return
        if (keys.length === 0) {
            this.add(Profile.Default);
            return this.items['default'];
        }
        //one profile
        if (keys.length === 1) {
            //profile is enabled
            if (this.items[keys[0]].enabled)
                return this.items[keys[0]];
            //profile is default enable and return
            if (this.items[keys[0]].name === 'Default') {
                this.items[keys[0]].enable = true;
                return this.items['default'];
            }
            //no default add one and return
            this.add(Profile.Default);
            return this.items['default'];
        }
        //search for first enabled profile
        for (const key in keys) {
            if (this.items[key].enabled)
                return this.items[key];
        }
        //none found, see if default exist, if so enable and return
        if (this.items['default']) {
            this.items['default'].enabled = true;
            return this.items['default'];
        }
        //no enabled or default, create and return
        this.add(Profile.Default);
        return this.items['default'];
    }

    get aliases(): Alias[] {
        const keys = this.keys;
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (!this.items[keys[0]].enabled || !this.items[keys[0]].enableAliases)
                return [];
            return this.items[keys[0]].aliases;
        }
        for (; k < kl; k++) {
            if (!this.items[keys[k]].enabled || !this.items[keys[k]].enableAliases || this.items[keys[k]].aliases.length === 0)
                continue;
            tmp = tmp.concat(this.items[keys[k]].aliases);
        }
        return tmp;
    }

    get triggers(): Trigger[] {
        const keys = this.keys;
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (!this.items[keys[0]].enabled || !this.items[keys[0]].enableTriggers)
                return [];
            return this.items[keys[0]].triggers;
        }
        for (; k < kl; k++) {
            if (!this.items[keys[k]].enabled || !this.items[keys[k]].enableTriggers || this.items[keys[k]].triggers.length === 0)
                continue;
            tmp = tmp.concat(this.items[keys[k]].triggers);
        }
        return tmp;
    }

    get macros(): Macro[] {
        const keys = this.keys;
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (!this.items[keys[0]].enabled || !this.items[keys[0]].enableMacros)
                return [];
            return this.items[keys[0]].macros;
        }
        for (; k < kl; k++) {
            if (!this.items[keys[k]].enabled || !this.items[keys[k]].enableMacros || this.items[keys[k]].macros.length === 0)
                continue;
            tmp = tmp.concat(this.items[keys[k]].macros);
        }
        return tmp;
    }

    get buttons(): Button[] {
        const keys = this.keys;
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (!this.items[keys[0]].enabled || !this.items[keys[0]].enableButtons)
                return [];
            return this.items[keys[0]].buttons;
        }
        for (; k < kl; k++) {
            if (!this.items[keys[k]].enabled || !this.items[keys[k]].enableButtons || this.items[keys[k]].buttons.length === 0)
                continue;
            tmp = tmp.concat(this.items[keys[k]].buttons);
        }
        return tmp;
    }

    get contexts(): Context[] {
        const keys = this.keys;
        let tmp = [];
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return [];
        if (kl === 1) {
            if (!this.items[keys[0]].enabled || !this.items[keys[0]].enableContexts)
                return [];
            return this.items[keys[0]].contexts;
        }
        for (; k < kl; k++) {
            if (!this.items[keys[k]].enabled || !this.items[keys[k]].enableContexts || this.items[keys[k]].contexts.length === 0)
                continue;
            tmp = tmp.concat(this.items[keys[k]].contexts);
        }
        return tmp;
    }

    get defaultContext(): boolean {
        const keys = this.keys;
        let k = 0;
        const kl = keys.length;
        if (kl === 0) return true;
        if (kl === 1) {
            if (!this.items[keys[0]].enabled)
                return true;
            return this.items[keys[0]].enableDefaultContext;
        }
        for (; k < kl; k++) {
            if (!this.items[keys[k]].enabled)
                continue;
            if (!this.items[keys[k]].enableDefaultContext)
                return false;
        }
        return true;
    }
}

/*
*            match any number (even none) of characters or white space
   .*
?            match a single character
   .
%d            match any number of digits (0-9)
   \d*
%n            match a number that starts with a + or - sign
   [+|-]?\d*
%w            match any number of alpha characters (a-z) (a word)
   \w
%a            match any number of alphanumeric characters (a-z,0-9)
   [a-zA-Z0-9]*
%s            match any amount of white space (spaces, tabs)
   \s*
%x            match any amount of non-white space
   \S*
%y            match any amount of non-white space (same as %x but matches start and end of line)
   \S*
%p            match any punctuation
   \p{P}
%q            match any punctuation (same as %p but matches start and end of line)
   \p{P}
%t            match a direction command
   ignore for now as i dont know what it does             
%e            match ESC character for ansi patterns
   \e
[range]      match any amount of characters listed in range
   as is in .net
^            force pattern to match starting at the beginning of the line
   as is in .net
$            force pattern to match ending at the end of the line
   as is in .net
(pattern)      save the matched pattern in a parameter %1 though %99
   as is in .net
~            quote the next character to prevent it to be interpreted as a wild card, required to match special characters
   replace with \                 
~~            match a quote character verbatim
   replace with \\ (not needed as ~ by itself is replaced with a \
{val1|val2|val3|...} match any of the specified strings can not use other wildcard inside this
   remove {}
@variable match any of the specified strings or keys
    parsed and replaced with the variable value
{^string}      do not match the specified string
   [^string] replace {} with []
&nn      matches exactly nn characters (fixed width pattern)
   {nn} remove & and wrap in {}
&VarName      assigns the matched string to the given variable (see below for more info)
   (?<VarName>pattern ) research more, prob is varname can contain patterns so have to parse out name and patterns
   probably best to pre-parse and get name / pattern then parse pattern separately in a recursive call
%/regex/% matches the given Regular Expression
%%function() runs any function
http://forums.zuggsoft.com/modules/mx_kb/kb.php?mode=doc&page=3&refpage=3&a=cmud_Pattern_Match
           */
export function convertPattern(pattern: string, client?) {
    if (!pattern || !pattern.length) return '';
    enum convertPatternState {
        None = 0,
        Ampersand = 1,
        Percent = 2,
        StringMatch = 3,
        SubPattern = 4,
        AmpersandPercent = 5,
        AmpersandPattern = 6,
        AmpersandRange = 7,
        PercentRegex = 8,
        Escape = 9,
        Variable = 10
    }
    let state: convertPatternState = convertPatternState.None;
    let stringBuilder = [];
    let idx = 0;
    let tl = pattern.length;
    let c;
    let i;
    let arg;
    let pat;
    let nest = 0;
    for (idx = 0; idx < tl; idx++) {
        c = pattern.charAt(idx);
        i = pattern.charCodeAt(idx);
        switch (state) {
            case convertPatternState.Ampersand:
                if (arg.length === 0 && (c === '*' || c === '?' || c === '^' || c === '$'))
                    pat = c;
                else if (arg.length === 0 && c === '%')
                    state = convertPatternState.AmpersandPercent;
                else if (pat.length === 0 && c === '(') {
                    pat = c;
                    state = convertPatternState.AmpersandPattern;
                }
                else if (pat.length === 0 && c === '[') {
                    pat = c;
                    state = convertPatternState.AmpersandRange;
                }
                else if (c === '{')
                    continue;
                //end block or no longer valid varname character
                else if (c === '}' || !((i >= 48 && i <= 57) || (i >= 65 && i <= 90) || (i >= 97 && i <= 122) || i === 95 || i === 36)) {
                    if (!isValidIdentifier(arg))
                        throw new Error('Invalid variable name');
                    if (!pat.length && /^\d+$/.exec(arg))
                        stringBuilder.push('{', arg, '}');
                    else if (!pat.length)
                        stringBuilder.push('(?<', arg, '>.*)');
                    else
                        stringBuilder.push('(?<', arg, '>', convertPattern(pat), ')');
                    if (c !== '}')
                        idx--;
                    state = convertPatternState.None;
                }
                else
                    arg += c;
                break;
            case convertPatternState.AmpersandPercent:
                pat += '%' + c;
                state = convertPatternState.Ampersand;
                break;
            case convertPatternState.AmpersandPattern:
                pat += c;
                if (c === ')')
                    state = convertPatternState.Ampersand;
                break;
            case convertPatternState.AmpersandRange:
                pat += c;
                if (c === ']')
                    state = convertPatternState.Ampersand;
                break;
            case convertPatternState.Percent:
                switch (c) {
                    case 'd':
                        stringBuilder.push("\\d+");
                        state = convertPatternState.None;
                        break;
                    case 'n':
                        stringBuilder.push("[+-]?\\d+");
                        state = convertPatternState.None;
                        break;
                    case 'w':
                        stringBuilder.push("\\w");
                        state = convertPatternState.None;
                        break;
                    case 'a':
                        stringBuilder.push("[a-zA-Z0-9]*");
                        state = convertPatternState.None;
                        break;
                    case 's':
                        stringBuilder.push("\\s*");
                        state = convertPatternState.None;
                        break;
                    case 'x':
                        stringBuilder.push("\\S*");
                        state = convertPatternState.None;
                        break;
                    case 'y':
                        stringBuilder.push("\\S*");
                        state = convertPatternState.None;
                        break;
                    case 'p':
                        stringBuilder.push("[\\.\\?\\!\\:\\;\\-\\—\\(\\)\\[\\]\\'\\\"\\\\/\\,]{1}");
                        state = convertPatternState.None;
                        break;
                    case 'q':
                        stringBuilder.push("[\\.\\?\\!\\:\\;\\-\\—\\(\\)\\[\\]\\'\\\"\\\\/\\,]{1}");
                        state = convertPatternState.None;
                        break;
                    case 't': //TODO not sure what a direction command is
                        state = convertPatternState.None;
                        break;
                    case 'e':
                        stringBuilder.push("\x1b");
                        state = convertPatternState.None;
                        break;
                    case '/': // %/pattern/%
                        state = convertPatternState.PercentRegex;
                        arg = '';
                        break;
                }
                break;
            case convertPatternState.PercentRegex:
                if (c === '%') {
                    if (!arg.endsWith('/'))
                        throw new Error('Invalid %/regex/% pattern');
                    stringBuilder.push(arg.substr(0, arg.length - 1));
                }
                else
                    arg += c;
                break;
            case convertPatternState.StringMatch:
                if (c === '^' && arg.length === 0)
                    pat = true;
                else if (c === '}') {
                    if (pat)
                        stringBuilder.push('[^', arg, ']');
                    else
                        stringBuilder.push(arg);
                    state = convertPatternState.None;
                }
                else
                    arg += c;
                break;
            case convertPatternState.SubPattern:
                if (c === ':') {
                    stringBuilder.push('(?<', arg, '>');
                    state = convertPatternState.None;
                }
                else if (c === ')') {
                    stringBuilder.push('(', convertPattern(arg), ')');
                    state = convertPatternState.None;
                    nest--;
                }
                else
                    arg += c;
                break;
            case convertPatternState.Escape:
                stringBuilder.push('\\', c);
                state = convertPatternState.None;
                break;
            case convertPatternState.Variable:
                if (c === '{' && arg.length === 0)
                    continue;
                else if (c === '}' || !((i >= 48 && i <= 57) || (i >= 65 && i <= 90) || (i >= 97 && i <= 122) || i === 95 || i === 36)) {
                    if (!isValidIdentifier(arg))
                        throw new Error('Invalid variable name')
                    if (client) {
                        if (client.variables[arg] instanceof Variable)
                            stringBuilder.push(client.variables[arg].value || '');
                        else
                            stringBuilder.push(client.variables[arg] || '');
                    }
                    if (c !== '}')
                        idx--;
                    state = convertPatternState.None;
                }
                else
                    arg += c;
                break;
            default:
                if (c === '*')
                    stringBuilder.push('.*');
                else if (c === '?')
                    stringBuilder.push('.');
                else if (c === '~')
                    state = convertPatternState.Escape;
                else if (c === '@') {
                    state = convertPatternState.Variable;
                    arg = '';
                }
                else if (c === '&') {
                    arg = '';
                    pat = '';
                    state = convertPatternState.Ampersand;
                }
                else if (c === '%')
                    state = convertPatternState.Percent;
                else if (c === '{') {
                    state = convertPatternState.StringMatch;
                    arg = '';
                }
                else if (c === '(') {
                    state = convertPatternState.SubPattern;
                    arg = '';
                    nest++;
                }
                else {
                    if (c === ')')
                        nest--;
                    stringBuilder.push(c);
                }
                break;
        }
    }
    switch (state) {
        case convertPatternState.Ampersand:
            if (!isValidIdentifier(arg))
                throw new Error('Invalid variable name');
            if (!pat.length && /^\d+$/.exec(arg))
                stringBuilder.push('{', arg, '}');
            else if (!pat.length)
                stringBuilder.push('(?<', arg, '>.*)');
            else
                stringBuilder.push('(?<', arg, '>', convertPattern(pat), ')');
            break;
        case convertPatternState.AmpersandPercent:
        case convertPatternState.AmpersandPattern:
        case convertPatternState.AmpersandRange:
            throw new Error('Invalid &VarName pattern');
        case convertPatternState.Percent:
            throw new Error('Invalid % pattern');
        case convertPatternState.PercentRegex:
            throw new Error('Invalid %/regex/% pattern');
        case convertPatternState.StringMatch:
            throw new Error('Invalid string match pattern');
        case convertPatternState.SubPattern:
            throw new Error('Invalid (sub:pattern) pattern');
        case convertPatternState.Escape:
            throw new Error('Invalid escape pattern');
        case convertPatternState.Variable:
            if (!isValidIdentifier(arg))
                throw new Error('Invalid variable name');
            if (client) {
                if (client.variables[arg] instanceof Variable)
                    stringBuilder.push(client.variables[arg].getValue() || '');
                else
                    stringBuilder.push(client.variables[arg] || '');
            }
            break;
    }
    if (nest)
        throw new Error('Invalid save matched pattern');
    return stringBuilder.join('');
}