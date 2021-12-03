//spell-checker:ignore Xred
/**
 *
 *
 * @export
 * @enum {number}
 */
export enum Ansi {
    None = 0,
    Bold = 1,
    Faint = 2,
    Underline = 4,
    Italic = 3,
    Slow = 5,
    Rapid = 6,
    Inverse = 7,
    Hidden = 8,
    Strikeout = 9,
    DoubleUnderline = 21,
    Overline = 53
}

/**
 * Enum for Ansi color codes.
 * @readonly
 * @enum {number}
 */
export enum AnsiColorCode {
    /** @desc  Custom color for error Information */
    ErrorBackground = -12,
    /** @desc  Custom background color for error Information */
    ErrorText = -11,
    /** @desc  Custom background color for client Information */
    InfoBackground = -8,
    /** @desc  Custom foreground color for client Information */
    InfoText = -7,
    /** @desc  Custom tag for local echo */
    LocalEcho = -3,
    /** @desc  Custom tag for local echo */
    LocalEchoBack = -4,
    /** @desc All attributes off */
    Reset = 0,
    /** @desc Bold ON */
    Bold = 1,
    /** @desc Faint ON */
    Faint = 2,
    /** @desc Italic ON */
    Italic = 3,
    /** @desc Underscore */
    Underline = 4,
    /** @desc Blink ON (Slow) */
    Blink = 5,
    /** @desc Blink ON (Rapid) */
    BlinkRapid = 6,
    /** @desc Reverse Video ON */
    Reverse = 7,
    /** @desc Concealed ON */
    Hidden = 8,
    /** @desc  strike through */
    StrikeThrough = 9,
    /** @desc double underline on */
    DoubleUnderline = 21,
    /** @desc bold off */
    BoldOff = 22,
    /** @desc italics off */
    ItalicOff = 23,
    /** @desc underline off */
    UnderlineOff = 24,
    /** @desc blink off (slow) */
    BlinkOff = 25,
    /** @desc blink off (rapid) */
    BlinkRapidOff = 26,
    /** @desc inverse off */
    ReverseOff = 27,
    /** @desc Visible */
    Visible = 28,
    /** @desc strike through off */
    StrikeThroughOff = 29,
    /** @desc Black Foreground */
    Black = 30,
    /** @desc Red Foreground */
    Red = 31,
    /** @desc Green Foreground */
    Green = 32,
    /** @desc Yellow Foreground */
    Yellow = 33,
    /** @desc Blue Foreground */
    Blue = 34,
    /** @desc Magenta Foreground */
    Magenta = 35,
    /** @desc Cyan Foreground */
    Cyan = 36,
    /** @desc White Foreground */
    White = 37,
    /** @desc Default */
    DefaultFore = 39,
    /** @desc Black Background */
    BlackBackground = 40,
    /** @desc Red Background */
    RedBackground = 41,
    /** @desc Green Background */
    GreenBackground = 42,
    /** @desc Yellow Background */
    YellowBackground = 43,
    /** @desc Blue Background */
    BlueBackground = 44,
    /** @desc Magenta Background */
    MagentaBackground = 45,
    /** @desc Cyan Background */
    CyanBackground = 46,
    /** @desc White Background */
    WhiteBackground = 47,
    /** @desc default */
    DefaultBack = 49,
    /** @desc Subscript */
    Subscript = 48,
    /** @desc Superscript */
    Superscript = 49,
    // xterm 16 color support
    /** @desc Set foreground color to Black */
    XBlack = 90,
    /** @desc Set foreground color to Red */
    XRed = 91,
    /** @desc Set foreground color to Green */
    XGreen = 92,
    /** @desc Set foreground color to Yellow */
    XYellow = 93,
    /** @desc Set foreground color to Blue */
    XBlue = 94,
    /** @desc Set foreground color to Magenta */
    XMagenta = 95,
    /** @desc Set foreground color to Cyan */
    XCyan = 96,
    /** @desc Set foreground color to White */
    XWhite = 97,
    /** @desc Set background color to Black */
    XBlackBackground = 100,
    /** @desc Set background color to Red */
    XRedBackground = 101,
    /** @desc Set background color to Green */
    XGreenBackground = 102,
    /** @desc Set background color to Yellow */
    XYellowBackground = 103,
    /** @desc Set background color to Blue */
    XBlueBackground = 104,
    /** @desc Set background color to Magenta */
    XMagentaBackground = 105,
    /** @desc Set background color to Cyan */
    XCyanBackground = 106,
    /** @desc Set background color to White */
    XWhiteBackground = 107
}

export function getAnsiColorCode(color: string, back?: boolean) {
    switch (color.toLowerCase()) {
        case 'black':
            return back ? 40 : 30;
        case 'red':
            return back ? 41 : 31;
        case 'green':
            return back ? 42 : 32;
        case 'yellow':
            return back ? 43 : 33;
        case 'blue':
            return back ? 44 : 34;
        case 'magenta':
            return back ? 45 : 35;
        case 'cyan':
            return back ? 46 : 36;
        case 'white':
            return back ? 47 : 37;
        case 'default':
            return back ? 49 : 39;
    }
    return -1;
}

export function getColorCode(code) {
    let f = -1;
    let b = -1;
    let bold = false;
    if (code - 128 >= 0) {
        code -= 128;
    }
    if (code - 112 >= 0) {
        code -= 112
        b = 47;
    }
    if (code - 96 >= 0) {
        code -= 96;
        b = 43;
    }
    if (code - 80 >= 0) {
        code -= 80;
        b = 45;
    }
    if (code - 64 >= 0) {
        code -= 64;
        b = 41;
    }
    if (code - 48 >= 0) {
        code -= 48;
        b = 46
    }
    if (code - 32 >= 0) {
        code -= 32;
        b = 42;
    }
    if (code - 16 >= 0) {
        code -= 16;
        b = 44;
    }
    if (code >= 8) {
        code -= 8;
        bold = true;
    }
    switch (code) {
        case 0:
            f = 30;
            break;
        case 1:
            f = 34;
            break;
        case 2:
            f = 32;
            break;
        case 3:
            f = 36;
            break;
        case 4:
            f = 31;
            break;
        case 5:
            f = 35;
            break;
        case 6:
            f = 33;
            break;
        case 7:
            f = 37;
            break;
    }
    if (bold && f === -1) f = 370;
    else if (bold) f *= 10;
    if (f === -1)
        return `,${b}`;
    if (b === -1)
        return f.toString();
    return `${f},${b}`
}

export function isMXPColor(color) {
    if (!color || color.length === 0) return false;
    return ['indianred', 'lightcoral', 'salmon', 'darksalmon', 'lightsalmon',
        'crimson', 'red', 'firebrick', 'darkred', 'pink', 'lightpink', 'hotpink', 'deeppink',
        'mediumvioletred', 'palevioletred', 'lightsalmon', 'coral', 'tomato', 'orangered',
        'darkorange', 'orange', 'gold', 'yellow', 'lightyellow', 'lemonchiffon',
        'lightgoldenrodyellow', 'papayawhip', 'moccasin', 'peachpuff', 'palegoldenrod',
        'khaki', 'darkkhaki', 'lavender', 'thistle', 'plum', 'violet', 'orchid', 'fuchsia',
        'magenta', 'mediumorchid', 'mediumpurple', 'blueviolet', 'darkviolet',
        'darkorchid', 'darkmagenta', 'purple', 'indigo', 'slateblue', 'darkslateblue',
        'mediumslateblue', 'greenyellow', 'chartreuse', 'lawngreen', 'lime', 'limegreen',
        'palegreen', 'lightgreen', 'mediumspringgreen', 'springgreen', 'mediumseagreen',
        'seagreen', 'forestgreen', 'green', 'darkgreen', 'yellowgreen', 'olivedrab',
        'olive', 'darkolivegreen', 'mediumaquamarine', 'darkseagreen', 'lightseagreen',
        'darkcyan', 'teal', 'aqua', 'cyan', 'lightcyan', 'paleturquoise', 'aquamarine',
        'turquoise', 'mediumturquoise', 'darkturquoise', 'cadetblue', 'steelblue',
        'lightsteelblue', 'powderblue', 'lightblue', 'skyblue', 'lightskyblue',
        'deepskyblue', 'dodgerblue', 'cornflowerblue', 'mediumslateblue', 'royalblue',
        'blue', 'mediumblue', 'darkblue', 'navy', 'midnightblue', 'cornsilk',
        'blanchedalmond', 'bisque', 'navajowhite', 'wheat', 'burlywood', 'tan',
        'rosybrown', 'sandybrown', 'goldenrod', 'darkgoldenrod', 'peru', 'chocolate',
        'saddlebrown', 'sienna', 'brown', 'maroon', 'white', 'snow', 'honeydew',
        'mintcream', 'azure', 'aliceblue', 'ghostwhite', 'whitesmoke', 'seashell',
        'beige', 'oldlace', 'floralwhite', 'ivory', 'antiquewhite', 'linen',
        'lavenderblush', 'mistyrose', 'gainsboro', 'lightgrey', 'silver', 'darkgray',
        'gray', 'dimgray', 'lightslategray', 'slategray', 'darkslategray', 'black'].indexOf(color.toLowerCase()) != -1;
}