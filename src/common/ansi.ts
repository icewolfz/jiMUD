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
    Subscript = 74,
    /** @desc Superscript */
    Superscript = 73,
    SubSuperOff = 75,
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

export function getAnsiCode(str, back?: boolean) {
    switch (str) {
        /** @desc  custom color for error information */
        case 'errortextbackground':
        case 'errorbackground':
            return -12;
        /** @desc  custom background color for error information */
        case 'errortext':
            return back ? -12 : -11;
        /** @desc  custom background color for client information */
        case 'infobackground':
            return -8;
        /** @desc  custom foreground color for client information */
        case 'infotext':
            return back ? -8 : -7;
        /** @desc  custom tag for local echo */
        case 'localecho':
            return back ? -4 : -3;
        /** @desc  custom tag for local echo */
        case 'localechoback':
            return -4;
        /** @desc all attributes off */
        case 'reset':
            return 0;
        /** @desc bold on */
        case 'bold':
            return 1;
        /** @desc faint on */
        case 'faint':
            return 2;
        /** @desc italic on */
        case 'italic':
            return 3;
        /** @desc underscore */
        case 'underline':
            return 4;
        /** @desc blink on (slow) */
        case 'blink':
            return 5;
        /** @desc blink on (rapid) */
        case 'blinkrapid':
            return 6;
        /** @desc reverse video on */
        case 'reverse':
            return 7;
        /** @desc concealed on */
        case 'hidden':
            return 8;
        /** @desc  strike through */
        case 'strikethrough':
            return 9;
        /** @desc double underline on */
        case 'doubleunderline':
            return 21;
        /** @desc bold off */
        case 'boldoff':
            return 22;
        /** @desc italics off */
        case 'italicoff':
            return 23;
        /** @desc underline off */
        case 'underlineoff':
            return 24;
        /** @desc blink off (slow) */
        case 'blinkoff':
            return 25;
        /** @desc blink off (rapid) */
        case 'blinkrapidoff':
            return 26;
        /** @desc inverse off */
        case 'reverseoff':
            return 27;
        /** @desc visible */
        case 'visible':
            return 28;
        /** @desc strike through off */
        case 'strikethroughoff':
            return 29;
        /** @desc black foreground */
        case 'black':
            return back ? 40 : 30;
        /** @desc red foreground */
        case 'red':
            return back ? 41 : 31;
        /** @desc green foreground */
        case 'green':
            return back ? 42 : 32;
        /** @desc yellow foreground */
        case 'yellow':
            return back ? 43: 33;
        /** @desc blue foreground */
        case 'blue':
            return back ? 44 : 34;
        /** @desc magenta foreground */
        case 'magenta':
            return back ? 45 : 35;
        /** @desc cyan foreground */
        case 'cyan':
            return back ? 46 : 36;
        /** @desc white foreground */
        case 'white':
            return back ? 47 : 37;
        /** @desc default */
        case 'default':
        case 'defaultfore':
            return back ? 49 : 39;
        /** @desc black background */
        case 'blackbackground':
            return 40;
        /** @desc red background */
        case 'redbackground':
            return 41;
        /** @desc green background */
        case 'greenbackground':
            return 42;
        /** @desc yellow background */
        case 'yellowbackground':
            return 43;
        /** @desc blue background */
        case 'bluebackground':
            return 44;
        /** @desc magenta background */
        case 'magentabackground':
            return 45;
        /** @desc cyan background */
        case 'cyanbackground':
            return 46;
        /** @desc white background */
        case 'whitebackground':
            return 47;
        /** @desc default */
        case 'defaultbackground':
        case 'defaultback':
            return 49;
        /** @desc subscript */
        case 'subscript':
            return 74;
        /** @desc superscript */
        case 'superscript':
            return 73;
        case 'subsuperoff':
            return 75;
        // xterm 16 color support
        /** @desc set foreground color to black */
        case 'xblack':
            return back ? 100 : 90;
        /** @desc set foreground color to red */
        case 'xred':
            return back ? 101 :91;
        /** @desc set foreground color to green */
        case 'xgreen':
            return back ? 102 :92;
        /** @desc set foreground color to yellow */
        case 'xyellow':
            return back ? 103 :93;
        /** @desc set foreground color to blue */
        case 'xblue':
            return back ? 104 :94;
        /** @desc set foreground color to magenta */
        case 'xmagenta':
            return back ? 105 :95;
        /** @desc set foreground color to cyan */
        case 'xcyan':
            return back ? 106 :96;
        /** @desc set foreground color to white */
        case 'xwhite':
            return back ? 107 :97;
        /** @desc set background color to black */
        case 'xblackbackground':
            return 100;
        /** @desc set background color to red */
        case 'xredbackground':
            return 101;
        /** @desc set background color to green */
        case 'xgreenbackground':
            return 102;
        /** @desc set background color to yellow */
        case 'xyellowbackground':
            return 103;
        /** @desc set background color to blue */
        case 'xbluebackground':
            return 104;
        /** @desc set background color to magenta */
        case 'xmagentabackground':
            return 105;
        /** @desc set background color to cyan */
        case 'xcyanbackground':
            return 106;
        /** @desc set background color to white */
        case 'xwhitebackground':
            return 107
    }
    return -1;
}