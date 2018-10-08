//spell-checker:ignore Eisu, Junja, Hanja, Nonconvert, Modechange, printscreen, jisho, Masshou, Touroku, loya, roya
//spell-checker:ignore Wsctrl, Cusel, Enlw, Backtab, Crsel, Exsel, Ereof rtrim ltrim rgbcolor Dropdown DBLUNDERLINE noflash
const path = require('path');
const fs = require('fs');
let crypto;
const { app } = require('electron').remote;

declare global {
    interface String {
        trimLeft(): string;
        trimRight(): string;
        rtrim(): string;
        ltrim(): string;
    }
}

export function SortArrayByPriority(a, b) {
    if (a.priority > b.priority)
        return -1;
    if (a.priority < b.priority)
        return 1;
    return 0;
}

export function SortMapByPriority(a, b) {
    if (a.priority > b.priority)
        return -1;
    if (a.priority < b.priority)
        return 1;
    if (a.index < b.index)
        return -1;
    if (a.index > b.index)
        return 1;
    return 0;
}

export function SortItemArrayByPriority(list) {
    const map = list.map((el, i) => {
        return { index: i, priority: el.priority };
    });
    map.sort(SortMapByPriority);
    return map.map((el) => {
        return list[el.index];
    });
}

export function FilterArrayByKeyValue(array, k, v) {
    const res = [];
    if (!array || array.length === 0) return res;
    const al = array.length;
    for (let i = 0; i < al; i++) {
        if (array[i]['enabled'] && array[i][k] === v)
            res.push(array[i]);
    }
    if (res.length <= 1) return res;
    return res.sort(SortArrayByPriority);
}

/*
export function htmlEncode(value) {
    return $('<div/>').text(value).html();
}

export function htmlDecode(value) {
    return $('<div/>').html(value).text();
}
*/

const _edCache = document.createElement('div');
export function htmlEncode(value) {
    _edCache.textContent = value;
    return _edCache.innerHTML;
}

export function htmlDecode(value) {
    _edCache.innerHTML = value;
    return _edCache.textContent;
}

export function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function stripHTML(html) {
    _edCache.innerHTML = html;
    return _edCache.textContent || _edCache.innerText || '';
}

export function stripParentheses(str) {
    return str.replace(/(^\()|(\)$)/g, '');
}

export function stripQuotes(str) {
    str = str.replace(/^"(.+(?="$))?"$/, '$1');
    str = str.replace(/^'(.+(?='$))?'$/, '$1');
    return str;
}

export function CharAllowedInURL(chr, proto) {
    if (chr.length > 1)
        return false;
    if (
        chr === '-' ||
        chr === '_' ||
        chr === '.' ||
        chr === '~' ||
        chr === '!' ||
        chr === '*' ||
        chr === '\'' ||
        chr === ';' ||
        chr === ':' ||
        chr === '@' ||
        chr === '&' ||
        chr === '=' ||
        chr === '+' ||
        chr === '$' ||
        chr === ',' ||
        chr === '/' ||
        chr === '?' ||
        chr === '%' ||
        chr === '#' ||
        chr === '[' ||
        chr === ']' ||
        chr === '(' ||
        chr === ')'
    )
        return !proto;
    const i = chr.charCodeAt(0);
    if (i > 64 && i < 91)
        return true;
    if (i > 96 && i < 123)
        return true;
    if (i > 47 && i < 58)
        return true;
    return false;
}

export let keyCodeToChar = {
    3: 'Cancel',
    6: 'Help',
    8: 'Backspace',
    9: 'Tab',
    19: 'Pause/Break',
    20: 'Caps Lock',
    21: 'Kana',
    22: 'Eisu',
    23: 'Junja',
    24: 'Final',
    25: 'Hanja',
    27: 'Esc',
    28: 'Convert',
    29: 'Nonconvert',
    30: 'Accept',
    31: 'Modechange',
    32: 'Space',
    33: 'Page Up',
    34: 'Page Down',
    35: 'End',
    36: 'Home',
    37: 'Left',
    38: 'Up',
    39: 'Right',
    40: 'Down',
    41: 'Select',
    42: 'Print',
    43: 'Execute',
    44: 'Printscreen',
    45: 'Insert',
    46: 'Delete',
    48: '0',
    49: '1',
    50: '2',
    51: '3',
    52: '4',
    53: '5',
    54: '6',
    55: '7',
    56: '8',
    57: '9',
    58: 'Colon',
    59: 'Semicolon',
    60: 'Less Than',
    61: 'Equals2',
    62: 'Greater Than',
    63: 'Question Mark',
    65: 'A',
    66: 'B',
    67: 'C',
    68: 'D',
    69: 'E',
    70: 'F',
    71: 'G',
    72: 'H',
    73: 'I',
    74: 'J',
    75: 'K',
    76: 'L',
    77: 'M',
    78: 'N',
    79: 'O',
    80: 'P',
    81: 'Q',
    82: 'R',
    83: 'S',
    84: 'T',
    85: 'U',
    86: 'V',
    87: 'W',
    88: 'X',
    89: 'Y',
    90: 'Z',
    93: 'Context Menu',
    95: 'Sleep',
    96: 'Numpad 0',
    97: 'Numpad 1',
    98: 'Numpad 2',
    99: 'Numpad 3',
    100: 'Numpad 4',
    101: 'Numpad 5',
    102: 'Numpad 6',
    103: 'Numpad 7',
    104: 'Numpad 8',
    105: 'Numpad 9',
    106: 'Numpad *',
    107: 'Numpad +',
    109: 'Numpad -',
    110: 'Numpad .',
    111: 'Numpad /',
    112: 'F1',
    113: 'F2',
    114: 'F3',
    115: 'F4',
    116: 'F5',
    117: 'F6',
    118: 'F7',
    119: 'F8',
    120: 'F9',
    121: 'F10',
    122: 'F11',
    123: 'F12',
    124: 'F13',
    125: 'F14',
    126: 'F15',
    127: 'F16',
    128: 'F17',
    129: 'F18',
    130: 'F19',
    131: 'F20',
    132: 'F21',
    133: 'F22',
    134: 'F23',
    135: 'F24',
    144: 'Num Lock',
    145: 'Scroll Lock',
    146: 'Win Oem Fj Jisho',
    147: 'Win Oem Fj Masshou',
    148: 'Win Oem Fj Touroku',
    149: 'Win Oem Fj Loya',
    150: 'Win Oem Fj Roya',
    160: 'Circumflex',
    161: 'Exclamation',
    162: 'Double Quote',
    163: 'Hash',
    164: 'Dollar',
    165: 'Percent',
    166: 'Ampersand',
    167: 'Underscore',
    168: 'Open Paren',
    169: 'Close Paren',
    170: 'Asterisk',
    171: 'Plus',
    172: 'Pipe',
    173: 'Hyphen Minus',
    174: 'Open Curly Bracket',
    175: 'Close Curly Bracket',
    176: 'Tilde',
    181: 'Volume Mute',
    182: 'Volume Down',
    183: 'Volume Up',
    186: ';',
    187: 'Equals',
    188: ',',
    189: 'Minus',
    190: '.',
    191: '/',
    192: '`',
    219: '[',
    220: '\\',
    221: ']',
    222: '\'',
    227: 'Win Ico Help',
    228: 'Win Ico 00',
    230: 'Win Ico Clear',
    233: 'Win Oem Reset',
    234: 'Win Oem Jump',
    235: 'Win Oem Pa1',
    236: 'Win Oem Pa2',
    237: 'Win Oem Pa3',
    238: 'Win Oem Wsctrl',
    239: 'Win Oem Cusel',
    240: 'Win Oem Attn',
    241: 'Win Oem Finish',
    242: 'Win Oem Copy',
    243: 'Win Oem Auto',
    244: 'Win Oem Enlw',
    245: 'Win Oem Backtab',
    246: 'Attn',
    247: 'Crsel',
    248: 'Exsel',
    249: 'Ereof',
    250: 'Play',
    251: 'Zoom',
    253: 'Pa1',
    254: 'Win Oem Clear'
};

export let keyCharToCode = {
    Cancel: 3,
    Help: 6,
    Backspace: 8,
    Tab: 9,
    'Pause/Break': 19,
    'Caps Lock': 20,
    Esc: 27,
    Space: 32,
    'Page Up': 33,
    'Page Down': 34,
    End: 35,
    Home: 36,
    Left: 37,
    Up: 38,
    Right: 39,
    Down: 40,
    Insert: 45,
    Delete: 46,
    0: 48,
    1: 49,
    2: 50,
    3: 51,
    4: 52,
    5: 53,
    6: 54,
    7: 55,
    8: 56,
    9: 57,
    A: 65,
    B: 66,
    C: 67,
    D: 68,
    E: 69,
    F: 70,
    G: 71,
    H: 72,
    I: 73,
    J: 74,
    K: 75,
    L: 76,
    M: 77,
    N: 78,
    O: 79,
    P: 80,
    Q: 81,
    R: 82,
    S: 83,
    T: 84,
    U: 85,
    V: 86,
    W: 87,
    X: 88,
    Y: 89,
    Z: 90,
    'Numpad 0': 96,
    'Numpad 1': 97,
    'Numpad 2': 98,
    'Numpad 3': 99,
    'Numpad 4': 100,
    'Numpad 5': 101,
    'Numpad 6': 102,
    'Numpad 7': 103,
    'Numpad 8': 104,
    'Numpad 9': 105,
    'Numpad *': 106,
    'Numpad +': 107,
    'Numpad -': 109,
    'Numpad .': 110,
    'Numpad /': 111,
    F1: 112,
    F2: 113,
    F3: 114,
    F4: 115,
    F5: 116,
    F6: 117,
    F7: 118,
    F8: 119,
    F9: 120,
    F10: 121,
    F11: 122,
    F12: 123,
    'Num Lock': 144,
    'Scroll Lock': 145,
    ';': 186,
    ',': 188,
    '.': 190,
    '/': 191,
    '`': 192,
    '[': 219,
    '\\': 220,
    ']': 221,
    '\'': 222,
    Kana: 21,
    Eisu: 22,
    Junja: 23,
    Final: 24,
    Hanja: 25,
    Convert: 28,
    Nonconvert: 29,
    Accept: 30,
    Modechange: 31,
    Select: 41,
    Print: 42,
    Execute: 43,
    Printscreen: 44,
    Colon: 58,
    Semicolon: 59,
    'Less Than': 60,
    Equals2: 61,
    'Greater Than': 62,
    'Question Mark': 63,
    'Context Menu': 93,
    Sleep: 95,
    F13: 124,
    F14: 125,
    F15: 126,
    F16: 127,
    F17: 128,
    F18: 129,
    F19: 130,
    F20: 131,
    F21: 132,
    F22: 133,
    F23: 134,
    F24: 135,
    'Win Oem Fj Jisho': 146,
    'Win Oem Fj Masshou': 147,
    'Win Oem Fj Touroku': 148,
    'Win Oem Fj Loya': 149,
    'Win Oem Fj Roya': 150,
    Circumflex: 160,
    Exclamation: 161,
    'Double Quote': 162,
    Hash: 163,
    Dollar: 164,
    Percent: 165,
    Ampersand: 166,
    Underscore: 167,
    'Open Paren': 168,
    'Close Paren': 169,
    Asterisk: 170,
    Plus: 171,
    Pipe: 172,
    'Hyphen Minus': 173,
    'Open Curly Bracket': 174,
    'Close Curly Bracket': 175,
    Tilde: 176,
    'Volume Mute': 181,
    'Volume Down': 182,
    'Volume Up': 183,
    Equals: 187,
    Minus: 189,
    'Win Ico Help': 227,
    'Win Ico 00': 228,
    'Win Ico Clear': 230,
    'Win Oem Reset': 233,
    'Win Oem Jump': 234,
    'Win Oem Pa1': 235,
    'Win Oem Pa2': 236,
    'Win Oem Pa3': 237,
    'Win Oem Wsctrl': 238,
    'Win Oem Cusel': 239,
    'Win Oem Attn': 240,
    'Win Oem Finish': 241,
    'Win Oem Copy': 242,
    'Win Oem Auto': 243,
    'Win Oem Enlw': 244,
    'Win Oem Backtab': 245,
    Attn: 246,
    Crsel: 247,
    Exsel: 248,
    Ereof: 249,
    Play: 250,
    Zoom: 251,
    Pa1: 253,
    'Win Oem Clear': 254

};

export function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export function cloneObject(obj) {
    if (!obj) return obj;
    const nObj = {};
    let prop;
    for (prop in obj) {
        if (!obj.hasOwnProperty(prop)) continue;
        if (obj[prop])
            nObj[prop] = obj[prop];
        else if (typeof obj[prop] === 'object')
            nObj[prop] = cloneObject(obj[prop]);
        else if (Array.isArray(obj[prop]))
            nObj[prop] = cloneArray(obj[prop]);
        else
            nObj[prop] = obj[prop];
    }
    return nObj;
}

export function cloneArray(arr) {
    if (!arr || arr.length === 0) return new Array();
    const nArr = new Array(arr.length);
    let l = arr.length;
    while (l--) {
        if (typeof arr[l] === 'object')
            nArr[l] = cloneObject(arr[l]);
        else if (Array.isArray(arr[l]))
            nArr[l] = cloneArray(arr[l]);
        else
            nArr[l] = cloneObject(arr[l]);
    }
    return nArr;
}

export function copy(o) {
    let output;
    let v;
    let key;
    if (!o || (typeof o !== 'object' && !Array.isArray(o)))
        return o;
    output = Array.isArray(o) ? [] : {};
    for (key in o) {
        if (!o.hasOwnProperty(key)) continue;
        v = o[key];
        output[key] = (v && (typeof v === 'object' || Array.isArray(v))) ? copy(v) : v;
    }
    return output;
}

export function setSelectionRange(input, selectionStart, selectionEnd) {
    if (input.setSelectionRange) {
        input.focus();
        input.setSelectionRange(selectionStart, selectionEnd);
    }
    else if (input.createTextRange) {
        const range = input.createTextRange();
        range.collapse(true);
        range.moveEnd('character', selectionEnd);
        range.moveStart('character', selectionStart);
        range.select();
    }
}

CanvasRenderingContext2D.prototype.fillRoundedRect = function (this, x: number, y: number, w: number, h: number, r: number) {
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    this.fill();
};

CanvasRenderingContext2D.prototype.strokeRoundedRect = function (this, x: number, y: number, w: number, h: number, r: number) {
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    this.stroke();
};

/*
Object.prototype.toType = function(this, obj) {
return ({}).toString.call(obj).match(/\s([a-z|A-Z]+)/)[1].toLowerCase();
};
*/

if (typeof String.prototype.splice !== 'function') {
    String.prototype.splice = function (this: string, idx: number, s: string, rem?: number) {
        if (typeof rem === 'undefined') rem = 0;
        return (this.slice(0, idx) + s + this.slice(idx + Math.abs(rem)));
    };
}

if (typeof String.prototype.paddingLeft !== 'function') {
    String.prototype.paddingLeft = function (this: string, paddingValue: (string | number)) {
        if (typeof paddingValue === 'number')
            paddingValue = ' '.repeat(paddingValue);
        return String(paddingValue + this).slice(-paddingValue.length);
    };
}

if (typeof String.prototype.paddingRight !== 'function') {
    String.prototype.paddingRight = function (this: string, paddingValue: (string | number)) {
        if (typeof paddingValue === 'number') {
            if (paddingValue <= this.length) return this;
            paddingValue = ' '.repeat(paddingValue - this.length);
            return this + paddingValue;
        }
        if (paddingValue.length <= this.length) return this;
        return this + paddingValue.slice(-this.length);
    };
}

String.prototype.rtrim = function (this: string) {
    let e = this.length;
    while (e--) {
        if (this.charAt(e) !== ' ' && this.charAt(e) !== '\t')
            break;
    }
    return this.slice(0, e + 1);
};

String.prototype.ltrim = function (this: string) {
    return this.replace(/^\h\h*/, '');
};

/*
if (typeof String.prototype.trimEnd !== 'function') {
    String.prototype.trimEnd = function (this: string) {
        return this.trimRight();
    };
}

if (typeof String.prototype.trimStart !== 'function') {
    String.prototype.trimStart = function (this: string) {
        return this.trimLeft();
    };
}
*/

String.prototype.splitQuote = function (this: string, sep: string, type?, escape?) {
    if (this.length === 0)
        return [this];
    if (!type) type = 1 | 2;
    if (!escape) escape = 1 | 2;
    let quote: boolean = false;
    let sQuote: boolean = false;
    const str = [];
    let pS = 0;
    let s = 0;
    let c: string;
    let pC = '';
    let sp;
    const spl = sep.length;
    let spC: string;
    const tl = this.length;
    for (; s < tl; s++) {
        c = this.charAt(s);
        if (c === '"' && (type & 2) === 2) {
            if ((escape & 2) === 2) {
                if (s === 0 || pC !== '\\')
                    quote = !quote;
            }
            else
                quote = !quote;
        }
        else if (c === '\'' && (type & 1) === 1) {
            if ((escape & 1) === 1) {
                if (s === 0 || pC !== '\\')
                    sQuote = !sQuote;
            }
            else
                sQuote = !sQuote;
        }
        else if (!quote && !sQuote) {
            for (sp = 0; sp < spl; sp++) {
                spC = sep.charAt(sp);
                if (c === spC) {
                    if (s > pS || s === 0) {
                        str.push(this.substr(pS, s - pS));
                        pS = s + 1;
                    }
                    else if (s === tl - 1)
                        str.push('');
                }
            }
        }
        pC = c;
    }
    if (s === tl && s === pS && sep.indexOf(pC) !== -1) {
        str.push('');
        pS = s + 1;
    }
    if (s > pS)
        str.push(this.substr(pS, s - pS));
    return str;
};

export function getTimeSpan(i: number): string {
    let al;
    const tmp = [];

    al = Math.floor(i / (1000 * 60 * 60 * 24));
    i -= al * (1000 * 60 * 60 * 24);
    if (al > 0) tmp.push(al + ' days');

    al = Math.floor(i / (1000 * 60 * 60));
    i -= al * (1000 * 60 * 60);
    if (al > 0) tmp.push(al + ' hours');

    al = Math.floor(i / (1000 * 60));
    i -= al * (1000 * 60);
    if (al > 0) tmp.push(al + ' minutes');

    al = Math.floor(i / (1000));
    i -= al * (1000);
    if (al > 0) tmp.push(al + ' seconds');
    if (tmp.length === 0)
        tmp.push('0 seconds');
    return tmp.join(', ');
}

export function parseTemplate(str: string, data?) {
    str = str.replace(/{home}/g, app.getPath('home'));
    str = str.replace(/{path}/g, app.getAppPath());
    str = str.replace(/{appData}/g, app.getPath('appData'));
    str = str.replace(/{data}/g, app.getPath('userData'));
    str = str.replace(/{temp}/g, app.getPath('temp'));
    str = str.replace(/{desktop}/g, app.getPath('desktop'));
    str = str.replace(/{documents}/g, app.getPath('documents'));
    str = str.replace(/{downloads}/g, app.getPath('downloads'));
    str = str.replace(/{music}/g, app.getPath('music'));
    str = str.replace(/{pictures}/g, app.getPath('pictures'));
    str = str.replace(/{videos}/g, app.getPath('videos'));
    str = str.replace(/{characters}/g, path.join(app.getPath('userData'), 'characters'));
    str = str.replace(/{themes}/g, path.join(__dirname, '..', 'themes'));
    str = str.replace(/{assets}/g, path.join(__dirname, '..', '..', 'assets'));
    if (data) {
        const keys = Object.keys(data);
        let key;
        for (key in keys) {
            if (!keys.hasOwnProperty(key)) continue;
            const regex = new RegExp('{}' + key + '}', 'g');
            str = str.replace(regex, data[key]);
        }
    }
    return str;
}

export function templatePath(p: string) {
    const paths = [
        '{characters}',
        '{themes}',
        '{assets}',
        '{data}',
        '{home}',
        '{path}}',
        '{appData}',
        '{temp}',
        '{desktop}',
        '{documents}',
        '{downloads}',
        '{music}',
        '{pictures}',
        '{videos}'
    ];
    const sl = paths.length;
    for (let s = 0; s < sl; s++) {
        const t = parseTemplate(paths[s]);
        if (p.startsWith(t))
            return paths[s] + p.substr(t.length);
    }
    return p;
}

export function naturalCompare(a, b) {
    const ax = [];
    const bx = [];

    a.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { ax.push([$1 || Infinity, $2 || '']); });
    b.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { bx.push([$1 || Infinity, $2 || '']); });

    while (ax.length && bx.length) {
        const an = ax.shift();
        const bn = bx.shift();
        const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
        if (nn) return nn;
    }

    return ax.length - bx.length;
}

export function getScrollBarWidth(el) {
    if (!el) return 0;
    const inner = document.createElement('p');
    inner.style.width = '100%';
    inner.style.height = '100%';
    inner.style.position = 'absolute';
    inner.style.top = '0px';
    inner.style.left = '0px';
    inner.style.visibility = 'hidden';

    el.style.overflowY = 'hidden';
    el.style.overflowX = 'hidden';

    el.appendChild(inner);
    const w1 = inner.offsetWidth;
    el.style.overflowY = '';
    el.style.overflowX = '';

    let w2 = inner.offsetWidth;
    if (w1 === w2) w2 = el.clientWidth;

    el.removeChild(inner);

    return (w1 - w2);
}

export function getScrollBarHeight(el) {
    if (!el) return 0;
    const inner = document.createElement('p');
    inner.style.width = '100%';
    inner.style.height = '100%';
    inner.style.position = 'absolute';
    inner.style.top = '0px';
    inner.style.left = '0px';
    inner.style.visibility = 'hidden';

    el.style.overflowY = 'hidden';
    el.style.overflowX = 'hidden';

    el.appendChild(inner);
    const w1 = inner.offsetHeight;
    el.style.overflowY = '';
    el.style.overflowX = '';

    let w2 = inner.offsetHeight;
    if (w1 === w2) w2 = el.clientHeight;

    el.removeChild(inner);

    return (w1 - w2);
}

export function getScrollBarSize(el) {
    if (!el) return 0;
    const inner = document.createElement('p');
    inner.style.width = '100%';
    inner.style.height = '100%';
    inner.style.position = 'absolute';
    inner.style.top = '0px';
    inner.style.left = '0px';
    inner.style.visibility = 'hidden';

    el.style.overflowY = 'hidden';
    el.style.overflowX = 'hidden';

    el.appendChild(inner);

    const w1 = inner.offsetWidth;
    const h1 = inner.offsetHeight;

    el.style.overflowY = '';
    el.style.overflowX = '';

    let w2 = inner.offsetWidth;
    let h2 = inner.offsetHeight;
    if (w1 === w2) w2 = el.clientWidth;
    if (h1 === h2) h2 = el.clientHeight;

    el.removeChild(inner);

    return [(w1 - w2), (h1 - h2)];
}

export function existsSync(filename) {
    try {
        fs.statSync(filename);
        return true;
    } catch (ex) {
        return false;
    }
}

export function exists(filename, cb) {
    fs.stat(filename, cb);
}

export function isDirSync(aPath) {
    try {
        return fs.statSync(aPath).isDirectory();
    } catch (e) {
        if (e.code === 'ENOENT') {
            return false;
        } else {
            throw e;
        }
    }
}

export function isFileSync(aPath) {
    try {
        return fs.statSync(aPath).isFile();
    } catch (e) {
        if (e.code === 'ENOENT') {
            return false;
        } else {
            throw e;
        }
    }
}

export function encrypt(text, key, iv, algorithm, input_encoding, output_encoding) {
    let cipher;
    let encrypted;
    if (algorithm == null) {
        algorithm = 'aes-256-cbc';
    }
    if (input_encoding == null) {
        input_encoding = 'utf-8';
    }
    if (output_encoding == null) {
        output_encoding = 'hex';
    }
    if (!crypto) crypto = require('crypto');
    cipher = crypto.createCipheriv(algorithm, key, iv);
    encrypted = cipher.update(text, input_encoding, output_encoding);
    encrypted += cipher.final(output_encoding);
    return encrypted;
}

export function decrypt(encrypted, key, iv, algorithm, input_encoding, output_encoding) {
    let decipher;
    let decrypted;
    if (algorithm == null) {
        algorithm = 'aes-256-cbc';
    }
    if (input_encoding == null) {
        input_encoding = 'hex';
    }
    if (output_encoding == null) {
        output_encoding = 'utf-8';
    }
    if (!crypto) crypto = require('crypto');
    decipher = crypto.createDecipheriv(algorithm, key, iv);
    decrypted = decipher.update(encrypted, input_encoding, output_encoding);
    decrypted += decipher.final(output_encoding);
    return decrypted;
}

export function formatSize(size) {
    if (size >= 1073741824)
        return Math.round(size / 1073741824).toLocaleString() + ' GB';
    else if (size >= 1048576)
        return Math.round(size / 1048576).toLocaleString() + ' MB';
    else if (size >= 1024)
        return Math.round(size / 1024).toLocaleString() + ' KB';
    return size.toLocaleString() + ' B';
}

export function capitalize(s, first?) {
    if (!s) return '';
    s = s.split(' ');
    let c;
    let i;
    let p;
    const il = first ? 1 : s.length;
    for (i = 0; i < il; i++) {
        const pl = s[i].length;
        for (p = 0; p < pl; p++) {
            c = s[i].charAt(p);
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
                s[i] = s[i].substr(0, p) + c.toUpperCase() + s[i].substr(p + 1).toLowerCase();
                break;
            }
        }
    }
    return s.join(' ');
}

export function capitalizePinkfish(s) {
    const p = string_parts(s);
    if (p.length !== 3)
        return capitalize(s, true);
    return p[0] + capitalize(p[1], true) + p[2];
}

function is_color(str) {
    if (!_colorCodes)
        loadColors();
    if (!str)
        return false;
    if (_colorCodes[str])
        return true;
    switch (str) {
        case 'ITALIC':
        case 'UNDERLINE':
        case 'STRIKEOUT':
        case 'DBLUNDERLINE':
        case 'OVERLINE':
        case 'FLASH':
        case 'REVERSE':
        case 'RESET':
        case 'DEFAULT':
        case 'BOLD':
            return true;
    }
    return false;
}

function string_parts(str) {
    let tmp;
    let t2;
    let ss;
    let se;
    let sm;
    let s;
    let e;
    let c;
    //more accurate then a regex even if slower in some cases
    if (!str.length) return ['', '', ''];
    tmp = str.split('%^');
    c = tmp.length;
    if (c === 1)
        return ['', str, ''];

    if (tmp[0].length === 0) {
        for (s = 0; s < c; s++) {
            t2 = tmp[s];
            if (!t2.length) continue;
            if (!is_color(t2)) {
                s--;
                break;
            }
        }
    }
    else
        s--;
    if (tmp[c - 1].length === 0) {
        for (e = c - 1; e > s; e--) {
            t2 = tmp[e];
            if (!t2.length) continue;
            if (!is_color(t2)) {
                e++;
                break;
            }
        }
    }
    else
        e = c;
    sm = tmp.slice(s + 1, e).join('%^');
    if (!sm.length)
        return [str, '', ''];
    ss = tmp.slice(0, s + 1).join('%^');
    se = tmp.slice(e).join('%^');
    if (sm.length) {
        if (ss.length)
            ss += '%^';
        if (se.length)
            se = '%^' + se;
    }
    return [ss, sm, se];
}

export function inverse(s) {
    if (!s) return '';
    s = s.split(' ');
    let c;
    let i;
    let p;
    const il = s.length;
    for (i = 0; i < il; i++) {
        const pl = s[i].length;
        for (p = 0; p < pl; p++) {
            c = s[i].charAt(p);
            if (c >= 'A' && c <= 'Z')
                s[i] = s[i].substr(0, p) + c.toLowerCase() + s[i].substr(p + 1);
            else if (c >= 'a' && c <= 'z')
                s[i] = s[i].substr(0, p) + c.toUpperCase() + s[i].substr(p + 1);
        }
    }
    return s.join(' ');
}

export function invert(obj) {
    const new_obj = {};
    let prop;
    for (prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            new_obj[obj[prop]] = prop;
        }
    }
    return new_obj;
}

export function walkSync(dir, fileList?, dirList?, empty?) {
    // tslint:disable-next-line:no-use-before-declare, no-shadowed-variable
    const p = path || require('path');
    // tslint:disable-next-line:no-use-before-declare, no-shadowed-variable
    const f = fs || require('fs');
    const files = f.readdirSync(dir);
    fileList = fileList || [];
    dirList = dirList || [];
    empty = empty || [];
    if (files.length === 0)
        empty.push(dir);
    files.forEach((file) => {
        if (f.statSync(p.join(dir, file)).isDirectory()) {
            dirList.push(p.join(dir, file));
            const t = walkSync(p.join(dir, file), fileList, dirList, empty);
            fileList = t.files;
            dirList = t.dirs;
            empty = t.empty;
        }
        else {
            fileList.push(path.join(dir, file));
        }
    });
    return { files: fileList, dirs: dirList, empty: empty };
}

export function walk(dir, callback) {
    // tslint:disable-next-line:block-scoped, no-shadowed-variable
    const p = path || require('path');
    // tslint:disable-next-line:block-scoped, no-shadowed-variable
    const f = fs || require('fs');
    f.readdir(dir, (err, files) => {
        let fileList = [];
        let dirList = [];
        let empty = [];
        if (files.length === 0)
            empty.push(dir);
        files.forEach((file) => {
            if (f.statSync(p.join(dir, file)).isDirectory()) {
                dirList.push(p.join(dir, file));
                const t = walkSync(p.join(dir, file), fileList, dirList, empty);
                fileList = t.files;
                dirList = t.dirs;
                empty = t.empty;
            }
            else {
                fileList.push(p.join(dir, file));
            }
        });
        if (callback)
            callback(fileList, dirList, empty);

    });
}

export function Cardinal(x) {
    let str;
    if (x === 0) return 'zero';
    if (x < 0) {
        str = 'negative ';
        x = Math.abs(x);
    }
    else
        str = '';
    switch (x) {
        case 1:
            return str + 'one';
        case 2:
            return str + 'two';
        case 3:
            return str + 'three';
        case 4:
            return str + 'four';
        case 5:
            return str + 'five';
        case 6:
            return str + 'six';
        case 7:
            return str + 'seven';
        case 8:
            return str + 'eight';
        case 9:
            return str + 'nine';
        case 10:
            return str + 'ten';
        case 11:
            return str + 'eleven';
        case 12:
            return str + 'twelve';
        case 13:
            return str + 'thirteen';
        case 14:
            return str + 'fourteen';
        case 15:
            return str + 'fifteen';
        case 16:
            return str + 'sixteen';
        case 17:
            return str + 'seventeen';
        case 18:
            return str + 'eighteen';
        case 19:
            return str + 'nineteen';
        case 20:
            return str + 'twenty';
        default:
            if (x > 1000000000)
                return 'over a billion';
            else if (x / 1000000 > 0) {
                if (x % 1000000 > 0)
                    return +' million ' + Cardinal(x % 1000000);
                return Cardinal((x / 1000000) >> 0) + ' million';
            }
            else if (x / 1000 > 0) {
                if (x % 1000 > 0)
                    return Cardinal((x / 1000) >> 0) + ' thousand ' + Cardinal(x % 1000);
                return Cardinal((x / 1000) >> 0) + ' thousand';
            }
            else if (x / 100 > 0) {
                if (x % 100 > 0)
                    return Cardinal((x / 100) >> 0) + ' hundred' + Cardinal(x % 100);
                return Cardinal((x / 100) >> 0) + ' hundred';
            }
            else {
                if (x % 10 > 0)
                    str = '-' + Cardinal(x % 10);
                else
                    str = '';
                switch (x / 10) {
                    case 2:
                        return 'twenty' + str;
                    case 3:
                        return 'thirty' + str;
                    case 4:
                        return 'forty' + str;
                    case 5:
                        return 'fifty' + str;
                    case 6:
                        return 'sixty' + str;
                    case 7:
                        return 'seventy' + str;
                    case 8:
                        return 'eighty' + str;
                    case 9:
                        return 'ninety' + str;
                    default:
                        return 'error';
                }
            }
    }
}

export function wordwrap(str, maxWidth, newLineStr?) {
    let done = false;
    let res = '';
    let found;
    let i;
    newLineStr = newLineStr || '\n';
    do {
        found = false;
        // Inserts new line at first whitespace of the line
        for (i = maxWidth - 1; i >= 0; i--) {
            if (testWhite(str.charAt(i))) {
                res = res + [str.slice(0, i + 1), newLineStr].join('');
                str = str.slice(i + 1);
                found = true;
                break;
            }
        }
        // Inserts new line at maxWidth position, the word is too long to wrap
        if (!found) {
            res += [str.slice(0, maxWidth), newLineStr].join('');
            str = str.slice(maxWidth);
        }

        if (str.length < maxWidth)
            done = true;
    } while (!done);
    if (str.length > 0)
        return res + str;
    return res;
}

function testWhite(x) {
    return /^\s$/.test(x.charAt(0));
}

export function splitQuoted(str, sep, t?, e?) {
    if (typeof (t) === 'undefined') t = 1 | 2;
    if (typeof (e) === 'undefined') e = 0;
    if (!str || str.length === 0 || !sep || sep.length === 0)
        return [str];
    sep = sep.split('');
    let q = false;
    let sq = false;
    const strings = [];
    let ps = 0;
    let s = 0;
    const sl = str.length;
    let c;
    for (; s < sl; s++) {
        c = str.charAt(s);
        if (c === '"' && (t & 2) === 2) {
            if ((e & 2) === 2 && s > 0) {
                if (s - 1 > 0 && str.charAt(s - 1) !== '\\')
                    q = !q;
            }
            else
                q = !q;
        }
        else if (c === '\'' && (t & 1) === 1) {
            if ((e & 1) === 1 && s > 0) {
                if (s - 1 > 0 && str.charAt(s - 1) !== '\\')
                    sq = !sq;
            }
            else
                sq = !sq;
        }
        else if (!sq && !q) {
            const spl = sep.length;
            for (let sp = 0; sp < spl; sp++) {
                if (c === sep[sp]) {
                    if (s > ps || s === 0) {
                        strings.push(str.substring(ps, s));
                        ps = s + 1;
                        break;
                    }
                    else if (s === (sl - 1))
                        strings.push('');
                }
            }
        }
    }
    if (s === sl && s === ps && sep.indexOf(str.charAt(s - 1)) > -1) {
        strings.push('');
        ps = s + 1;
    }
    if (s > ps)
        strings.push(str.substring(ps, s));
    return strings;
}

export function leadingZeros(num, totalChars: number, padWith: string, trim?: boolean) {
    num = num + '';
    padWith = (padWith) ? padWith : '0';
    if (num.length < totalChars) {
        while (num.length < totalChars) {
            num = padWith + num;
        }
    }
    if (trim && num.length > totalChars) {
        num = num.substring((num.length - totalChars), totalChars);
    }
    return num;
}

export function resetCursor(txtElement) {
    txtElement.scrollTop = 0;
    txtElement.scrollLeft = 0;
    if (typeof txtElement.selectionStart === 'number') {
        txtElement.selectionStart = 0;
        txtElement.selectionEnd = 0;
    }
    else if (txtElement.setSelectionRange) {
        txtElement.focus();
        txtElement.setSelectionRange(0, 0);
        txtElement.focus();
    } else if (txtElement.createTextRange) {
        const range = txtElement.createTextRange();
        range.moveStart('character', 0);
        range.select();
    }
}

export function moveCursorToEnd(el) {
    el.scrollTop = el.scrollHeight;
    if (typeof el.selectionStart === 'number') {
        el.selectionStart = el.selectionEnd = el.value.length;
    } else if (typeof el.createTextRange !== 'undefined') {
        el.focus();
        const range = el.createTextRange();
        range.collapse(false);
        range.select();
    }
}

export function stringToEnum(str, en, ignoreCase?) {
    if (!str || !en) return 0;
    if (ignoreCase)
        str = str.toUpperCase();
    //split strip and trim spaces
    str = str.split(',').map(v => v.trim());
    //init value
    let value = 0;
    let sl = str.length;
    //get the enum keys
    const values = Object.keys(en).filter(key => !isNaN(Number(en[key])));
    let test = values.slice(0);
    //ignore case just make everything upper
    if (ignoreCase)
        test = test.map(v => v.toUpperCase());
    //loop the strings
    while (sl--) {
        let vl = values.length;
        //loop the enum to try and find the string value
        while (vl--) {
            //found value add it on
            if (test[vl] === str[sl]) {
                value |= en[values[vl].replace(/ /g, '_')];
                break;
            }
        }
    }
    //return final value
    return value;
}

export function enumToString(value, en) {
    let state;
    const states = Object.keys(en).filter(key => !isNaN(Number(en[key])));
    if (value === 0)
        return en[0];
    const f = [];
    state = states.length;
    while (state--) {
        if (en[states[state]] === 0) continue;
        if ((value & en[states[state]]) === en[states[state]])
            f.push(capitalize(states[state].replace(/_/g, ' ')));
    }
    return f.join(', ');
}

//https://j11y.io/snippets/wordwrap-for-javascript/
export function wordWrap(str, width, brk, cut) {
    brk = brk || 'n';
    width = width || 75;
    cut = cut || false;
    if (!str) return str;
    const regex = '.{1,' + width + '}(\s|$)' + (cut ? '|.{' + width + '}|.+$' : '|\S+?(\s|$)');
    return str.match(RegExp(regex, 'g')).join(brk);
}

export function wordBreak(str, start, length) {
    if (length < 0) return 0;
    let wBreak = length - 1;
    if (start + wBreak >= str.length)
        return str.length - start;
    while (wBreak >= 0 && str.charAt(start + wBreak) !== ' ' && str.charAt(start + wBreak) !== '\\')
        wBreak--;
    if (wBreak <= 0)
        return length;
    wBreak++;
    return wBreak;
}

export function formatString(str, indent, width?, prefix?, postFix?, preIdent?) {
    if (!str || str.length === 0) return '';
    width = width || 66;
    if (width < 40) width = 40;
    if (typeof prefix !== 'string')
        prefix = '"';
    if (typeof postFix !== 'string')
        postFix = '"';
    preIdent = preIdent || '';
    if (str.length <= width)
        return prefix + str + postFix;
    const list = [];
    let wBreak = wordBreak(str, 0, width);
    list.push(str.substr(0, wBreak));
    let len = str.length - wBreak;
    let tmp = wBreak; // set start of next line at window width
    while (len / width > 0) { // while full lines loop
        wBreak = wordBreak(str, tmp, width);
        list.push(str.substr(tmp, wBreak));
        tmp += wBreak; // move to next line
        len -= wBreak; // remove line width
    }
    if (len > 0) // left over
        list.push(str.substr(tmp, len));
    return prefix + list.join(postFix + '\n' + preIdent + ' '.repeat(indent) + prefix) + postFix;
}

export function consolidate(amt, str) {
    let y;
    let l;
    let e = '';
    if (!amt || !str || amt < 2) return str;
    if (str.endsWith(' ')) {
        e = ' ';
        str = str.trim();
    }
    str = str.split(' ');
    if (str[0].toLowerCase() === 'a' || str[0].toLowerCase() === 'an' || str[0].toLowerCase() === 'the')
        str.shift();
    l = str.length;
    y = str.indexOf('of');
    if (y > 0)
        str[y - 1] = pluralize(str[y - 1]);
    else if (str[l - 1].endsWith(')')) {
        y = l - 1;
        while (y >= 0) {
            if (str[y].startsWith('('))
                break;
            y--;
        }
        if (y - 1 >= 0)
            str[y - 1] = pluralize(str[y - 1]);
    }
    else if (str[l - 1].match(/\(.*\)/)) {
        if (l - 2 >= 0)
            str[l - 2] = pluralize(str[l - 2]);
    }
    else
        str[l - 1] = pluralize(str[l - 1]);
    if (amt > 10)
        return 'numerous ' + str.join(' ') + e;
    return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][amt] + ' ' + str.join(' ') + e;
}

//spell-checker:disable
export function pluralize(revert) {
    const plural = {
        '(quiz)$': '$1zes',
        '^(ox)$': '$1en',
        '([m|l])ouse$': '$1ice',
        '(matr|vert|ind)ix|ex$': '$1ices',
        '(x|ch|ss|sh)$': '$1es',
        '([^aeiouy]|qu)y$': '$1ies',
        '(hive)$': '$1s',
        '(?:([^f])fe|([lr])f)$': '$1$2ves',
        '(shea|lea|loa|thie)f$': '$1ves',
        sis$: 'ses',
        '([ti])um$': '$1a',
        '(tomat|potat|ech|her|vet)o$': '$1oes',
        '(bu)s$': '$1ses',
        '(alias)$': '$1es',
        '(octop)us$': '$1i',
        '(ax|test)is$': '$1es',
        '(us)$': '$1es',
        '([^s]+)$': '$1s'
    };

    const singular = {
        '(quiz)zes$': '$1',
        '(matr)ices$': '$1ix',
        '(vert|ind)ices$': '$1ex',
        '^(ox)en$': '$1',
        '(alias)es$': '$1',
        '(octop|vir)i$': '$1us',
        '(cris|ax|test)es$': '$1is',
        '(shoe)s$': '$1',
        '(o)es$': '$1',
        '(bus)es$': '$1',
        '([m|l])ice$': '$1ouse',
        '(x|ch|ss|sh)es$': '$1',
        '(m)ovies$': '$1ovie',
        '(s)eries$': '$1eries',
        '([^aeiouy]|qu)ies$': '$1y',
        '([lr])ves$': '$1f',
        '(tive)s$': '$1',
        '(hive)s$': '$1',
        '(li|wi|kni)ves$': '$1fe',
        '(shea|loa|lea|thie)ves$': '$1f',
        '(^analy)ses$': '$1sis',
        '((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)ses$': '$1$2sis',
        '([ti])a$': '$1um',
        '(n)ews$': '$1ews',
        '(h|bl)ouses$': '$1ouse',
        '(corpse)s$': '$1',
        '(us)es$': '$1',
        s$: ''
    };

    const irregular = {
        move: 'moves',
        foot: 'feet',
        goose: 'geese',
        sex: 'sexes',
        child: 'children',
        man: 'men',
        tooth: 'teeth',
        person: 'people'
    };

    const uncountable = [
        'sheep',
        'fish',
        'deer',
        'moose',
        'series',
        'species',
        'money',
        'rice',
        'information',
        'equipment'
    ];

    // save some time in the case that singular and plural are the same
    if (uncountable.indexOf(revert.toLowerCase()) >= 0)
        return revert;
    let word;
    // check for irregular forms
    for (word in irregular) {
        if (!irregular.hasOwnProperty(word)) continue;
        let pattern;
        let replace;
        if (revert) {
            pattern = new RegExp(irregular[word] + '$', 'i');
            replace = word;
        } else {
            pattern = new RegExp(word + '$', 'i');
            replace = irregular[word];
        }
        if (pattern.test(revert))
            return revert.replace(pattern, replace);
    }
    let array;
    if (revert) array = singular;
    else array = plural;
    let reg;

    // check for matches using regular expressions
    for (reg in array) {
        if (!array.hasOwnProperty(reg)) continue;
        const pattern = new RegExp(reg, 'i');

        if (pattern.test(revert))
            return revert.replace(pattern, array[reg]);
    }

    return revert;
}
//spell-checker:enable

export function stripPinkfish(text) {
    text = text || '';
    text = text.split('%^');
    const stack = [];
    let t = 0;
    const tl = text.length;
    for (; t < tl; t++) {
        if (text[t].startsWith('B_') && is_color(text[t].substr(2)))
            continue;
        else if (is_color(text[t]))
            continue;
        stack.push(text[t]);
    }
    return stack.join('');
}

let _colorCodes;
export function pinkfishToHTML(text) {
    text = text || '';
    text = text.split('%^');
    if (!_colorCodes)
        loadColors();
    const stack = [];
    let codes = [];
    let t = 0;
    let tl = text.length;
    let bold = false;
    let classes = [];
    for (; t < tl; t++) {
        switch (text[t]) {
            case 'ITALIC':
                this.stack.push('<em>');
                this.codes.push('</em>');
                break;
            case 'UNDERLINE':
                classes.push('underline');
                break;
            case 'STRIKEOUT':
                classes.push('strikeout');
                break;
            case 'DBLUNDERLINE':
                classes.push('dblunderline');
                break;
            case 'OVERLINE':
                classes.push('overline');
                break;
            case 'FLASH':
                classes.push('noflash');
                break;
            case 'REVERSE':
                classes.push('reverse');
                break;
            case 'RESET':
            case 'DEFAULT':
                const cl = codes.length;
                for (let c = 0; c < cl; c++)
                    stack.push(codes[c]);
                codes = [];
                classes = [];
                break;
            case 'BOLD':
                bold = true;
                break;
            case '':
                break;
            default:
                if (text[t].startsWith('B_')) {
                    text[t] = text[t].substr(2);
                    if (bold) {
                        stack.push('<span style="border: inherit;text-decoration:inherit;color: #' + _colorCodes['BOLD%^%^WHITE'] + '">');
                        codes.push('</span>');
                    }
                    stack.push('<span style=border: inherit;text-decoration:inherit;"background-color: #' + _colorCodes[text[t]] + '">');
                    codes.push('</span>');
                    bold = false;
                    continue;
                }
                else if (_colorCodes[text[t]]) {
                    if (bold && !_colorCodes['BOLD%^%^' + text[t]]) {
                        stack.push('<span style="border: inherit;text-decoration:inherit;color: #' + _colorCodes['BOLD%^%^WHITE'] + '">');
                        codes.push('</span>');
                    }
                    else if (bold) {
                        stack.push('<span style="border: inherit;text-decoration:inherit;color: #' + _colorCodes['BOLD%^%^' + text[t]] + '">');
                        codes.push('</span>');
                        continue;
                    }
                    stack.push('<span style="border: inherit;text-decoration:inherit;color: #' + _colorCodes[text[t]] + '">');
                    codes.push('</span>');
                    continue;
                }
                else if (bold) {
                    stack.push('<span style="border: inherit;text-decoration:inherit;color: #' + _colorCodes['BOLD%^%^WHITE'] + '">');
                    codes.push('</span>');
                }
                if (classes.length) {
                    stack.push('<span class="' + classes.join(' ') + '">');
                    codes.push('</span>');
                    classes = [];
                }
                stack.push(text[t]);
                bold = false;
                break;
        }
    }
    if (classes.length) {
        stack.push('<span class="' + classes.join(' ') + '">');
        codes.push('</span>');
    }
    for (t = 0, tl = codes.length; t < tl; t++)
        stack.push(codes[t]);
    return stack.join('');
}

function loadColors() {
    const rgbcolor = require('rgbcolor');
    const _dColors = getColors();
    let c;
    let color;
    let r;
    let g;
    let b;
    let idx;
    _colorCodes = {};

    _colorCodes['BLACK'] = new rgbcolor(_dColors[0]).toHex().substr(1).toUpperCase();
    _colorCodes['RED'] = new rgbcolor(_dColors[1]).toHex().substr(1).toUpperCase();
    _colorCodes['GREEN'] = new rgbcolor(_dColors[2]).toHex().substr(1).toUpperCase();
    _colorCodes['ORANGE'] = new rgbcolor(_dColors[3]).toHex().substr(1).toUpperCase();
    _colorCodes['BLUE'] = new rgbcolor(_dColors[4]).toHex().substr(1).toUpperCase();
    _colorCodes['MAGENTA'] = new rgbcolor(_dColors[5]).toHex().substr(1).toUpperCase();
    _colorCodes['CYAN'] = new rgbcolor(_dColors[6]).toHex().substr(1).toUpperCase();
    _colorCodes['WHITE'] = new rgbcolor(_dColors[7]).toHex().substr(1).toUpperCase();
    _colorCodes['mono11'] = new rgbcolor(_dColors[8]).toHex().substr(1).toUpperCase();
    _colorCodes['BOLD%^%^RED'] = new rgbcolor(_dColors[9]).toHex().substr(1).toUpperCase();
    _colorCodes['BOLD%^%^GREEN'] = new rgbcolor(_dColors[10]).toHex().substr(1).toUpperCase();
    _colorCodes['YELLOW'] = new rgbcolor(_dColors[11]).toHex().substr(1).toUpperCase();
    _colorCodes['BOLD%^%^BLUE'] = new rgbcolor(_dColors[12]).toHex().substr(1).toUpperCase();
    _colorCodes['BOLD%^%^MAGENTA'] = new rgbcolor(_dColors[13]).toHex().substr(1).toUpperCase();
    _colorCodes['BOLD%^%^CYAN'] = new rgbcolor(_dColors[14]).toHex().substr(1).toUpperCase();
    _colorCodes['BOLD%^%^WHITE'] = new rgbcolor(_dColors[15]).toHex().substr(1).toUpperCase();

    for (r = 0; r < 6; r++) {
        for (g = 0; g < 6; g++) {
            for (b = 0; b < 6; b++) {
                idx = `RGB${r}${g}${b}`;
                color = '';
                c = 0;
                c = r * 40 + 55;
                if (c < 16)
                    color += '0';
                color += c.toString(16);
                c = 0;
                c = g * 40 + 55;
                if (c < 16)
                    color += '0';
                color += c.toString(16);
                c = 0;
                c = b * 40 + 55;
                if (c < 16)
                    color += '0';
                color += c.toString(16);
                if (!_colorCodes[idx])
                    _colorCodes[idx] = color.toUpperCase();
            }
        }
    }

    for (r = 232; r <= 255; r++) {
        g = (r - 232) * 10 + 8;
        if (g < 16)
            g = '0' + g.toString(16).toUpperCase();
        else
            g = g.toString(16).toUpperCase();
        g = g + g + g;
        if (r < 242)
            _colorCodes['mono0' + (r - 232)] = g;
        else
            _colorCodes['mono' + (r - 232)] = g;
    }
}

export function getColors() {
    const _ColorTable = [];
    let r;
    let g;
    let b;
    let idx;
    for (r = 0; r < 6; r++) {
        for (g = 0; g < 6; g++) {
            for (b = 0; b < 6; b++) {
                idx = 16 + (r * 36) + (g * 6) + b;
                _ColorTable[idx] = 'rgb(';
                if (r > 0)
                    _ColorTable[idx] += r * 40 + 55;
                else
                    _ColorTable[idx] += '0';
                _ColorTable[idx] += ',';
                if (g > 0)
                    _ColorTable[idx] += g * 40 + 55;
                else
                    _ColorTable[idx] += '0';
                _ColorTable[idx] += ',';
                if (b > 0)
                    _ColorTable[idx] += b * 40 + 55;
                else
                    _ColorTable[idx] += '0';
                _ColorTable[idx] += ')';
            }
        }
    }
    for (r = 232; r <= 255; r++) {
        g = (r - 232) * 10 + 8;
        _ColorTable[r] = ['rgb(', g, ',', g, ',', g, ')'].join('');
    }
    _ColorTable[0] = 'rgb(0,0,0)'; //black fore
    _ColorTable[1] = 'rgb(128, 0, 0)'; //red fore
    _ColorTable[2] = 'rgb(0, 128, 0)'; //green fore
    _ColorTable[3] = 'rgb(128, 128, 0)'; //yellow fore
    _ColorTable[4] = 'rgb(0, 0, 238)'; //blue fore
    _ColorTable[5] = 'rgb(128, 0, 128)'; //magenta fore
    _ColorTable[6] = 'rgb(0, 128, 128)'; //cyan fore
    _ColorTable[7] = 'rgb(187, 187, 187)'; //white fore
    _ColorTable[8] = 'rgb(128, 128, 128)'; //black  bold
    _ColorTable[9] = 'rgb(255, 0, 0)'; //Red bold
    _ColorTable[10] = 'rgb(0, 255, 0)'; //green bold
    _ColorTable[11] = 'rgb(255, 255, 0)'; //yellow bold
    _ColorTable[12] = 'rgb(92, 92, 255)'; //blue bold
    _ColorTable[13] = 'rgb(255, 0, 255)'; //magenta bold
    _ColorTable[14] = 'rgb(0, 255, 255)'; //cyan bold
    _ColorTable[15] = 'rgb(255, 255, 255)'; //white bold
    _ColorTable[256] = 'rgb(0, 0, 0)'; //black faint
    _ColorTable[257] = 'rgb(118, 0, 0)'; //red  faint
    _ColorTable[258] = 'rgb(0, 108, 0)'; //green faint
    _ColorTable[259] = 'rgb(145, 136, 0)'; //yellow faint
    _ColorTable[260] = 'rgb(0, 0, 167)'; //blue faint
    _ColorTable[261] = 'rgb(108, 0, 108)'; //magenta faint
    _ColorTable[262] = 'rgb(0, 108, 108)'; //cyan faint
    _ColorTable[263] = 'rgb(161, 161, 161)'; //white faint
    _ColorTable[264] = 'rgb(0, 0, 0)'; //BackgroundBlack
    _ColorTable[265] = 'rgb(128, 0, 0)'; //red back
    _ColorTable[266] = 'rgb(0, 128, 0)'; //greenback
    _ColorTable[267] = 'rgb(128, 128, 0)'; //yellow back
    _ColorTable[268] = 'rgb(0, 0, 238)'; //blue back
    _ColorTable[269] = 'rgb(128, 0, 128)'; //magenta back
    _ColorTable[270] = 'rgb(0, 128, 128)'; //cyan back
    _ColorTable[271] = 'rgb(187, 187, 187)'; //white back
    _ColorTable[272] = 'rgb(0,0,0)'; //iceMudInfoBackground
    _ColorTable[273] = 'rgb(0, 255, 255)'; //iceMudInfoText
    _ColorTable[274] = 'rgb(0,0,0)'; //LocalEchoBackground
    _ColorTable[275] = 'rgb(255, 255, 0)'; //LocalEchoText
    _ColorTable[276] = 'rgb(0, 0, 0)'; //DefaultBack
    _ColorTable[277] = 'rgb(229, 229, 229)'; //DefaultFore
    _ColorTable[278] = 'rgb(205, 0, 0)'; //ErrorFore
    _ColorTable[279] = 'rgb(229, 229, 229)'; //ErrorBack
    _ColorTable[280] = 'rgb(255,255,255)'; //DefaultBrightFore
    return _ColorTable;
}

export function updateEditDropdown(d) {
    const m = Array.from(d.querySelectorAll('ul > li > a'));
    const ip = d.querySelector('input');
    const b = d.querySelector('button');
    m.forEach(i => {
        (<HTMLElement>i).addEventListener('click', (e) => {
            if (e.ctrlKey && (d.dataset.multiple === '1' || d.dataset.multiple === 'true')) {
                if (ip.value.length !== 0)
                    ip.value += ',' + ((<HTMLElement>e.target).dataset.value || (<HTMLElement>e.target).textContent || '');
                else
                    ip.value = (<HTMLElement>e.target).dataset.value || (<HTMLElement>e.target).textContent || '';
            }
            else
                ip.value = (<HTMLElement>e.target).dataset.value || (<HTMLElement>e.target).textContent || '';
            const evt = document.createEvent('HTMLEvents');
            evt.initEvent('change', false, true);
            ip.dispatchEvent(evt);
            e.returnValue = false;
            e.preventDefault();
            if (b.parentElement.classList.contains('autocomplete')) {
                b.parentElement.classList.remove('autocomplete');
                Array.from(b.nextElementSibling.querySelectorAll('li')).forEach(a => (<HTMLElement>a).style.display = '');
            }
            return false;
        });
    });
}

export function initEditDropdown(d) {
    updateEditDropdown(d);
    const ip = d.querySelector('input');
    const b = d.querySelector('button');

    b.addEventListener('click', () => {
        const m = Array.from(b.nextElementSibling.querySelectorAll('li > a'));
        let val;
        if (d.dataset.multiple === '1' || d.dataset.multiple === 'true')
            val = ip.value.toLowerCase().split(',');
        else if (ip.value.length !== 0)
            val = [ip.value.toLowerCase()];
        else
            val = [];
        m.forEach(i => {
            (<HTMLElement>i).classList.remove('active');
        });
        let el: any = m.filter(i => (val.indexOf(((<HTMLElement>i).dataset.value || '').toLowerCase()) !== -1));
        if (el.length === 0)
            el = m.filter(i => val.indexOf((<HTMLElement>i).textContent.toLowerCase()) !== -1);
        if (el.length === 0) {
            b.nextElementSibling.scrollTop = 0;
            return;
        }
        if (d.dataset.multiple === '1' || d.dataset.multiple === 'true') {
            el.forEach(a => a.classList.add('active'));
            if (el.length !== 0)
                b.nextElementSibling.scrollTop = el[0].parentElement.offsetTop;
        }
        else {
            el = el[0];
            el.classList.add('active');
            setTimeout(() => {
                b.nextElementSibling.scrollTop = el.parentElement.offsetTop;
            }, 50);
        }
    });

    ip.addEventListener('blur', (e) => {
        if (b.parentElement.classList.contains('autocomplete') && (!e.relatedTarget || !b.parentElement.contains(e.relatedTarget))) {
            b.parentElement.classList.remove('open', 'autocomplete');
            Array.from(b.nextElementSibling.querySelectorAll('li')).forEach(a => (<HTMLElement>a).style.display = '');
        }
    });

    ip.addEventListener('input', () => {
        const parent = b.parentElement;
        const list = b.nextElementSibling;
        let items = Array.from(list.querySelectorAll('li'));
        items.forEach(e => (<HTMLElement>e).firstElementChild.classList.remove('active'));
        items.forEach(e => (<HTMLElement>e).style.display = '');
        items = items.filter(e => !(<HTMLElement>e).textContent.match(new RegExp(ip.value)));
        items.forEach(e => (<HTMLElement>e).style.display = 'none');
        if (items.length !== 0)
            parent.classList.add('open', 'autocomplete');
        else
            parent.classList.remove('open', 'autocomplete');
    });
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return mergeDeep(target, ...sources);
}