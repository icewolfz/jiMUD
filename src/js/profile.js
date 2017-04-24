"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const library_1 = require("./library");
const path = require('path');
const fs = require('fs');
var MacroModifiers;
(function (MacroModifiers) {
    MacroModifiers[MacroModifiers["None"] = 0] = "None";
    MacroModifiers[MacroModifiers["Alt"] = 2] = "Alt";
    MacroModifiers[MacroModifiers["Ctrl"] = 4] = "Ctrl";
    MacroModifiers[MacroModifiers["Shift"] = 8] = "Shift";
    MacroModifiers[MacroModifiers["Meta"] = 16] = "Meta";
    MacroModifiers[MacroModifiers["All"] = 30] = "All";
})(MacroModifiers = exports.MacroModifiers || (exports.MacroModifiers = {}));
var ItemDisplayType;
(function (ItemDisplayType) {
    ItemDisplayType[ItemDisplayType["Text"] = 0] = "Text";
    ItemDisplayType[ItemDisplayType["Function"] = 1] = "Function";
})(ItemDisplayType = exports.ItemDisplayType || (exports.ItemDisplayType = {}));
var ItemStyle;
(function (ItemStyle) {
    ItemStyle[ItemStyle["Text"] = 0] = "Text";
    ItemStyle[ItemStyle["Parse"] = 1] = "Parse";
    ItemStyle[ItemStyle["Script"] = 2] = "Script";
})(ItemStyle = exports.ItemStyle || (exports.ItemStyle = {}));
;
var TriggerType;
(function (TriggerType) {
    TriggerType[TriggerType["Regular"] = 0] = "Regular";
    TriggerType[TriggerType["CommandInputRegular"] = 1] = "CommandInputRegular";
})(TriggerType = exports.TriggerType || (exports.TriggerType = {}));
function MacroDisplay(item) {
    if (item.key === 0) {
        if (item.name && item.name.length > 0)
            return "None - " + item.name;
        return "None";
    }
    var d = [];
    if ((item.modifiers & MacroModifiers.Ctrl) == MacroModifiers.Ctrl)
        d.push("Ctrl");
    if ((item.modifiers & MacroModifiers.Alt) == MacroModifiers.Alt)
        d.push("Alt");
    if ((item.modifiers & MacroModifiers.Shift) == MacroModifiers.Shift)
        d.push("Shift");
    if ((item.modifiers & MacroModifiers.Meta) == MacroModifiers.Meta) {
        if (process.platform == "darwin")
            d.push("Cmd");
        else
            d.push("Win");
    }
    if (library_1.keyCodeToChar[item.key])
        d.push(library_1.keyCodeToChar[item.key]);
    else if (item.name && item.name.length > 0)
        return "None - " + item.name;
    else
        return "None";
    if (item.name && item.name.length > 0)
        return d.join("+") + " - " + item.name;
    return d.join("+");
}
exports.MacroDisplay = MacroDisplay;
class Item {
    constructor(data) {
        this.name = '';
        this.priority = 0;
        this.display = 'name';
        this.displaytype = ItemDisplayType.Text;
        this.value = '';
        this.style = ItemStyle.Parse;
        this.group = '';
        this.enabled = true;
        this.notes = '';
        if (typeof data == "object") {
            for (var prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = data[prop];
            }
        }
    }
    clone() {
        return new Item(this);
    }
}
exports.Item = Item;
class Button extends Item {
    constructor(data) {
        super(data);
        this.caption = '';
        this.icon = '';
        this.append = false;
        this.send = true;
        this.chain = false;
        this.stretch = false;
        this.caption = "NewButton";
        this.display = 'caption';
        if (typeof data == "object") {
            for (var prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = data[prop];
            }
        }
    }
    clone() {
        return new Button(this);
    }
}
exports.Button = Button;
class Macro extends Item {
    constructor(data) {
        super();
        this.key = 0;
        this.append = false;
        this.send = true;
        this.modifiers = MacroModifiers.None;
        this.chain = false;
        this.display = 'return MacroDisplay(item)';
        this.displaytype = ItemDisplayType.Function;
        if (typeof data == "object") {
            for (var prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = data[prop];
            }
        }
    }
    clone() {
        return new Macro(this);
    }
}
exports.Macro = Macro;
;
class Alias extends Item {
    constructor(pattern, value) {
        super();
        this.pattern = 'NewAlias';
        this.regexp = false;
        this.multi = false;
        this.append = true;
        this.params = '';
        if (typeof pattern == "string")
            this.pattern = pattern;
        if (value != null)
            this.value = value;
        this.display = 'pattern';
        if (typeof pattern == "object") {
            for (var prop in pattern) {
                if (!pattern.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = pattern[prop];
            }
        }
    }
    clone() {
        return new Alias(this);
    }
}
exports.Alias = Alias;
class Trigger extends Item {
    constructor(data) {
        super(data);
        this.pattern = 'NewTrigger';
        this.verbatim = false;
        this.triggerNewline = true;
        this.triggerPrompt = false;
        this.type = TriggerType.Regular;
        this.display = 'pattern';
        if (typeof data == "object") {
            for (var prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = data[prop];
            }
        }
    }
    clone() {
        return new Trigger(this);
    }
}
exports.Trigger = Trigger;
class Context extends Item {
    constructor(data) {
        super(data);
        this.caption = '';
        this.icon = '';
        this.append = false;
        this.send = true;
        this.chain = false;
        this.submenu = '';
        this.caption = "NewContext";
        this.display = 'caption';
        if (typeof data == "object") {
            for (var prop in data) {
                if (!data.hasOwnProperty(prop)) {
                    continue;
                }
                this[prop] = data[prop];
            }
        }
    }
    clone() {
        return new Button(this);
    }
}
exports.Context = Context;
class Profile {
    constructor(name, defaults) {
        this.name = '';
        this.file = '';
        this.priority = 0;
        this.enabled = true;
        this.aliases = [];
        this.triggers = [];
        this.macros = [];
        this.buttons = [];
        this.contexts = [];
        this.enableMacros = true;
        this.enableTriggers = true;
        this.enableAliases = true;
        this.enableButtons = true;
        this.enableContext = true;
        this.enableDefaultContext = true;
        if (typeof name == "string") {
            this.name = name;
            this.file = name.toLowerCase();
            if (defaults == null || defaults)
                this.macros = Profile.DefaultMacros;
        }
        else if (typeof name === "boolean") {
            if (name)
                this.macros = Profile.DefaultMacros;
        }
        else if (defaults == null || defaults)
            this.macros = Profile.DefaultMacros;
    }
    static get Default() {
        return new Profile('Default');
    }
    static get DefaultMacros() {
        var data = [
            {
                key: 97,
                display: "return MacroDisplay(item)",
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
                display: "return MacroDisplay(item)",
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
                display: "return MacroDisplay(item)",
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
                display: "return MacroDisplay(item)",
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
                display: "return MacroDisplay(item)",
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
                display: "return MacroDisplay(item)",
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
                display: "return MacroDisplay(item)",
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
                display: "return MacroDisplay(item)",
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
                display: "return MacroDisplay(item)",
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
        var m = [];
        for (var d = 0, dl = data.length; d < dl; d++)
            m.push(new Macro(data[d]));
        return m;
    }
    ;
    static load(file) {
        if (!fs.existsSync(file))
            return null;
        var profile;
        var data = fs.readFileSync(file, 'utf-8');
        if (data.length == 0)
            return new Profile(path.basename(file, ".json"));
        try {
            data = JSON.parse(data);
        }
        catch (e) {
            return new Profile(path.basename(file, ".json"));
        }
        profile = new Profile();
        var prop;
        for (prop in data) {
            if (!data.hasOwnProperty(prop)) {
                continue;
            }
            if (prop == "aliases" || prop == "triggers" || prop == "macros" || prop == "buttons" || prop == "contexts")
                continue;
            profile[prop] = data[prop];
        }
        var i, il;
        if (data.aliases && data.aliases.length > 0) {
            il = data.aliases.length;
            for (i = 0; i < il; i++) {
                profile.aliases.push(new Alias(data.aliases[i]));
            }
        }
        if (data.triggers && data.triggers.length > 0) {
            il = data.triggers.length;
            for (i = 0; i < il; i++) {
                profile.triggers.push(new Trigger(data.triggers[i]));
            }
        }
        if (data.macros && data.macros.length > 0) {
            il = data.macros.length;
            profile.macros = [];
            for (i = 0; i < il; i++) {
                profile.macros.push(new Macro(data.macros[i]));
            }
        }
        if (data.buttons && data.buttons.length > 0) {
            il = data.buttons.length;
            for (i = 0; i < il; i++) {
                profile.buttons.push(new Button(data.buttons[i]));
            }
        }
        if (data.contexts && data.contexts.length > 0) {
            il = data.contexts.length;
            for (i = 0; i < il; i++) {
                profile.contexts.push(new Context(data.contexts[i]));
            }
        }
        profile.file = profile.name;
        return profile;
    }
    save(p) {
        if (this.file != this.name.toLowerCase()) {
            if (fs.existsSync(path.join(p, this.file + ".json")))
                fs.unlinkSync(path.join(p, this.file + ".json"));
            this.file = this.name.toLowerCase();
        }
        fs.writeFileSync(path.join(p, this.file + ".json"), JSON.stringify(this));
    }
    clone(version) {
        var data, i, il;
        if (version == 2) {
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
                enableContext: this.enableContext,
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
                        notes: this.aliases[i].notes || ""
                    });
                }
            }
            if (this.triggers.length > 0) {
                il = this.triggers.length;
                for (i = 0; i < il; i++) {
                    data.triggers.push({
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
                        triggerprompt: this.triggers[i].triggerPrompt,
                        type: this.triggers[i].type,
                        notes: this.triggers[i].notes || ""
                    });
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
                        display: 'if(item.key : : :  0) return "None", return keyCodeToChar[item.key]',
                        displaytype: 1,
                        modifiers: this.macros[i].modifiers,
                        chain: this.macros[i].chain,
                        notes: this.macros[i].notes || ""
                    });
                }
            }
            if (this.buttons.length > 0) {
                il = this.buttons.length;
                for (i = 0; i < il; i++) {
                    data.buttons.push(library_1.clone(this.buttons[i]));
                }
            }
            if (this.contexts.length > 0) {
                il = this.contexts.length;
                for (i = 0; i < il; i++) {
                    data.contexts.push(library_1.clone(this.contexts[i]));
                }
            }
            return data;
        }
        data = library_1.clone(this);
        var profile = new Profile(false);
        var prop;
        for (prop in data) {
            if (!data.hasOwnProperty(prop)) {
                continue;
            }
            if (prop == "aliases" || prop == "triggers" || prop == "macros" || prop == "buttons" || prop == "contexts")
                continue;
            profile[prop] = data[prop];
        }
        if (data.aliases && data.aliases.length > 0) {
            il = data.aliases.length;
            for (i = 0; i < il; i++) {
                profile.aliases.push(new Alias(data.aliases[i]));
            }
        }
        if (data.triggers && data.triggers.length > 0) {
            il = data.triggers.length;
            for (i = 0; i < il; i++) {
                profile.triggers.push(new Trigger(data.triggers[i]));
            }
        }
        if (data.macros && data.macros.length > 0) {
            il = data.macros.length;
            profile.macros = [];
            for (i = 0; i < il; i++) {
                profile.macros.push(new Macro(data.macros[i]));
            }
        }
        if (data.buttons && data.buttons.length > 0) {
            il = data.buttons.length;
            for (i = 0; i < il; i++) {
                profile.buttons.push(new Button(data.buttons[i]));
            }
        }
        if (data.contexts && data.contexts.length > 0) {
            il = data.mencontextsus.length;
            for (i = 0; i < il; i++) {
                profile.contexts.push(data.contexts[i].clone());
            }
        }
        return profile;
    }
}
exports.Profile = Profile;
class ProfileCollection {
    constructor(defaultProfile) {
        this.items = {};
        this.keys = [];
        this.add(defaultProfile == null ? Profile.Default : defaultProfile);
    }
    SortByPrioity() {
        this.keys.sort((a, b) => {
            var ap = this.items[a].priority;
            var bp = this.items[a].priority;
            if (ap > bp)
                return -1;
            if (ap < bp)
                return 1;
            ap = this.items[a].name;
            bp = this.items[a].name;
            if (ap > bp)
                return -1;
            if (ap < bp)
                return 1;
            return 0;
        });
    }
    enabled(profile) {
        if (!profile || this.keys.length == 0)
            return false;
        if (typeof profile == "string") {
            if (!this.items[profile.toLowerCase()])
                return false;
            return this.items[profile.toLowerCase()].enabled;
        }
        return this.items[profile.name.toLowerCase()] ? this.items[profile.name.toLowerCase()].enabled : false;
    }
    contains(profile) {
        if (!profile || this.keys.length == 0)
            return false;
        if (typeof profile == "string")
            return this.items[profile.toLowerCase()] ? true : false;
        return this.items[profile.name.toLowerCase()] ? true : false;
    }
    canDisable(profile) {
        if (!profile || this.keys.length == 0)
            return false;
        var idx;
        if ((typeof profile) == "Profile")
            idx = profile.name.toLowerCase();
        else if (typeof profile == "number") {
            if (profile < 0)
                return false;
            if (profile >= this.keys.length)
                return false;
            idx = this.keys[profile];
        }
        else if (typeof profile == "object")
            idx = profile.name.toLowerCase();
        else if (typeof profile == "string")
            idx = profile.toLowerCase();
        else
            return false;
        if (!this.items[idx])
            return false;
        var e = !this.items[idx].enabled;
        if (!e) {
            var c = false;
            for (var key in this.items) {
                if (key == idx)
                    continue;
                if (this.items[key].enabled)
                    c = true;
                break;
            }
            if (!c)
                return false;
        }
        return true;
    }
    toggle(profile) {
        if (!profile || this.keys.length == 0)
            return false;
        var idx;
        if ((typeof profile) == "Profile")
            idx = profile.name.toLowerCase();
        else if (typeof profile == "number") {
            if (profile < 0)
                return false;
            if (profile >= this.keys.length)
                return false;
            idx = this.keys[profile];
        }
        else if (typeof profile == "object")
            idx = profile.name.toLowerCase();
        else if (typeof profile == "string")
            idx = profile.toLowerCase();
        else
            return false;
        if (!this.items[idx])
            return false;
        var e = !this.items[idx].enabled;
        if (!e) {
            var c = false;
            for (var key in this.items) {
                if (key == idx)
                    continue;
                if (this.items[key].enabled)
                    c = true;
                break;
            }
            if (!c)
                return false;
        }
        this.items[idx].enabled = e;
        return true;
    }
    update() {
        this.keys = Object.keys(this.items);
        this.SortByPrioity();
    }
    add(profile) {
        if (!profile)
            return;
        this.items[profile.name.toLowerCase()] = profile;
        this.update();
    }
    remove(profile) {
        if (!profile || this.keys.length == 0)
            return;
        if (typeof profile == "string")
            delete this.items[profile.toLowerCase()];
        else if (typeof profile == "number") {
            if (profile < 0 || profile >= this.keys.length)
                return;
            delete this.items[this.keys[profile]];
        }
        else
            delete this.items[profile.name.toLowerCase()];
        this.update();
    }
    copy(profile) {
        if (!profile)
            return library_1.clone(this.items);
        if (this.keys.length == 0)
            return null;
        if (typeof profile == "string") {
            if (!this.items[profile.toLowerCase()])
                return null;
            return this.items[profile.toLowerCase()].clone();
        }
        if (typeof profile == "number") {
            if (profile < 0 || profile >= this.keys.length)
                return null;
            return this.items[this.keys[profile]].clone();
        }
        return profile.clone();
    }
    clone(version) {
        if (version == 2) {
            var profiles = {};
            for (var p in this.items)
                profiles[this.items[p].name] = this.items[p].clone(2);
            return profiles;
        }
        var pc = new ProfileCollection();
        for (var p in this.items)
            pc.items[this.items[p].name] = this.items[p].clone();
        pc.update();
        return pc;
    }
    load(p) {
        var files = fs.readdirSync(p);
        for (var i = 0; i < files.length; i++) {
            if (path.extname(files[i]) === ".json") {
                this.add(Profile.load(path.join(p, files[i])));
            }
        }
    }
    save(p) {
        for (var profile in this.items) {
            this.items[profile].save(p);
        }
    }
    get length() {
        return this.keys.length;
    }
    count() { return this.keys.length; }
    get active() {
        var keys = this.keys;
        //no profiles, add default and return
        if (keys.length == 0) {
            this.add(Profile.Default);
            return this.items['default'];
        }
        //one profile
        if (keys.length == 1) {
            //profile is enabled
            if (this.items[keys[0]].enabled)
                return this.items[keys[0]];
            //profile is default enable and return
            if (this.items[keys[0]].name == "Default") {
                this.items[keys[0]].enable = true;
                return this.items['default'];
            }
            //no default add one and return
            this.add(Profile.Default);
            return this.items['default'];
        }
        //search for first enabled profile
        for (var key in keys) {
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
    get aliases() {
        var keys = this.keys;
        var tmp = [], k = 0, kl = keys.length;
        if (kl === 0)
            return [];
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
    get triggers() {
        var keys = this.keys;
        var tmp = [], k = 0, kl = keys.length;
        if (kl === 0)
            return [];
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
    get macros() {
        var keys = this.keys;
        var tmp = [], k = 0, kl = keys.length;
        if (kl === 0)
            return [];
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
    get buttons() {
        var keys = this.keys;
        var tmp = [], k = 0, kl = keys.length;
        if (kl === 0)
            return [];
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
    get contexts() {
        var keys = this.keys;
        var tmp = [], k = 0, kl = keys.length;
        if (kl === 0)
            return [];
        if (kl === 1) {
            if (!this.items[keys[0]].enabled || !this.items[keys[0]].enableContext)
                return [];
            return this.items[keys[0]].contexts;
        }
        for (; k < kl; k++) {
            if (!this.items[keys[k]].enabled || !this.items[keys[k]].enableContext || this.items[keys[k]].contexts.length === 0)
                continue;
            tmp = tmp.concat(this.items[keys[k]].contexts);
        }
        return tmp;
    }
}
exports.ProfileCollection = ProfileCollection;
