"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 *
 *
 * @export
 * @enum {number}
 */
var Ansi;
(function (Ansi) {
    Ansi[Ansi["None"] = 0] = "None";
    Ansi[Ansi["Bold"] = 1] = "Bold";
    Ansi[Ansi["Faint"] = 2] = "Faint";
    Ansi[Ansi["Underline"] = 4] = "Underline";
    Ansi[Ansi["Italic"] = 3] = "Italic";
    Ansi[Ansi["Slow"] = 5] = "Slow";
    Ansi[Ansi["Rapid"] = 6] = "Rapid";
    Ansi[Ansi["Inverse"] = 7] = "Inverse";
    Ansi[Ansi["Hidden"] = 8] = "Hidden";
    Ansi[Ansi["Strikeout"] = 9] = "Strikeout";
    Ansi[Ansi["DoubleUnderline"] = 21] = "DoubleUnderline";
    Ansi[Ansi["Overline"] = 53] = "Overline";
})(Ansi = exports.Ansi || (exports.Ansi = {}));
/**
 * Enum for Ansi color codes.
 * @readonly
 * @enum {number}
 */
var AnsiColorCode;
(function (AnsiColorCode) {
    /** @desc  Custom color for error Infomation */
    AnsiColorCode[AnsiColorCode["ErrorBackground"] = -12] = "ErrorBackground";
    /** @desc  Custom background color for error Infomation */
    AnsiColorCode[AnsiColorCode["ErrorText"] = -11] = "ErrorText";
    /** @desc  Custom background color for client Infomation */
    AnsiColorCode[AnsiColorCode["InfoBackground"] = -8] = "InfoBackground";
    /** @desc  Custom foreground color for client Infomation */
    AnsiColorCode[AnsiColorCode["InfoText"] = -7] = "InfoText";
    /** @desc  Custom tag for localecho */
    AnsiColorCode[AnsiColorCode["LocalEcho"] = -3] = "LocalEcho";
    /** @desc  Custom tag for localecho */
    AnsiColorCode[AnsiColorCode["LocalEchoBack"] = -4] = "LocalEchoBack";
    /** @desc All attibutes off */
    AnsiColorCode[AnsiColorCode["Reset"] = 0] = "Reset";
    /** @desc Bold ON */
    AnsiColorCode[AnsiColorCode["Bold"] = 1] = "Bold";
    /** @desc Faint ON */
    AnsiColorCode[AnsiColorCode["Faint"] = 2] = "Faint";
    /** @desc Italic ON */
    AnsiColorCode[AnsiColorCode["Italic"] = 3] = "Italic";
    /** @desc Underscore */
    AnsiColorCode[AnsiColorCode["Underline"] = 4] = "Underline";
    /** @desc Blink ON (Slow) */
    AnsiColorCode[AnsiColorCode["Blink"] = 5] = "Blink";
    /** @desc Blink ON (Rapid) */
    AnsiColorCode[AnsiColorCode["BlinkRapid"] = 6] = "BlinkRapid";
    /** @desc Reverse Video ON */
    AnsiColorCode[AnsiColorCode["Reverse"] = 7] = "Reverse";
    /** @desc Concealed ON */
    AnsiColorCode[AnsiColorCode["Hidden"] = 8] = "Hidden";
    /** @desc  strikethrough */
    AnsiColorCode[AnsiColorCode["StrikeThrough"] = 9] = "StrikeThrough";
    /** @desc double udnerline on */
    AnsiColorCode[AnsiColorCode["DoubleUnderline"] = 21] = "DoubleUnderline";
    /** @desc bold off */
    AnsiColorCode[AnsiColorCode["BoldOff"] = 22] = "BoldOff";
    /** @desc italics off */
    AnsiColorCode[AnsiColorCode["ItalicOff"] = 23] = "ItalicOff";
    /** @desc underline off */
    AnsiColorCode[AnsiColorCode["UnderlineOff"] = 24] = "UnderlineOff";
    /** @desc blink off (slow) */
    AnsiColorCode[AnsiColorCode["BlinkOff"] = 25] = "BlinkOff";
    /** @desc blink off (rapid) */
    AnsiColorCode[AnsiColorCode["BlinkRapidOff"] = 26] = "BlinkRapidOff";
    /** @desc inverse off */
    AnsiColorCode[AnsiColorCode["ReverseOff"] = 27] = "ReverseOff";
    /** @desc Visiable */
    AnsiColorCode[AnsiColorCode["Visible"] = 28] = "Visible";
    /** @desc strikethrough off */
    AnsiColorCode[AnsiColorCode["StrikeThroughOff"] = 29] = "StrikeThroughOff";
    /** @desc Black Foreground */
    AnsiColorCode[AnsiColorCode["Black"] = 30] = "Black";
    /** @desc Red Foreground */
    AnsiColorCode[AnsiColorCode["Red"] = 31] = "Red";
    /** @desc Green Foreground */
    AnsiColorCode[AnsiColorCode["Green"] = 32] = "Green";
    /** @desc Yellow Foreground */
    AnsiColorCode[AnsiColorCode["Yellow"] = 33] = "Yellow";
    /** @desc Blue Foreground */
    AnsiColorCode[AnsiColorCode["Blue"] = 34] = "Blue";
    /** @desc Magneta Foreground */
    AnsiColorCode[AnsiColorCode["Magneta"] = 35] = "Magneta";
    /** @desc Cyan Foreground */
    AnsiColorCode[AnsiColorCode["Cyan"] = 36] = "Cyan";
    /** @desc White Foreground */
    AnsiColorCode[AnsiColorCode["White"] = 37] = "White";
    /** @desc Default */
    AnsiColorCode[AnsiColorCode["DefaultFore"] = 39] = "DefaultFore";
    /** @desc Black Background */
    AnsiColorCode[AnsiColorCode["BlackBackground"] = 40] = "BlackBackground";
    /** @desc Red Background */
    AnsiColorCode[AnsiColorCode["RedBackground"] = 41] = "RedBackground";
    /** @desc Green Background */
    AnsiColorCode[AnsiColorCode["GreenBackground"] = 42] = "GreenBackground";
    /** @desc Yellow Background */
    AnsiColorCode[AnsiColorCode["YellowBackground"] = 43] = "YellowBackground";
    /** @desc Blue Background */
    AnsiColorCode[AnsiColorCode["BlueBackground"] = 44] = "BlueBackground";
    /** @desc Magneta Background */
    AnsiColorCode[AnsiColorCode["MagnetaBackground"] = 45] = "MagnetaBackground";
    /** @desc Cyan Background */
    AnsiColorCode[AnsiColorCode["CyanBackground"] = 46] = "CyanBackground";
    /** @desc White Background */
    AnsiColorCode[AnsiColorCode["WhiteBackground"] = 47] = "WhiteBackground";
    /** @desc default */
    AnsiColorCode[AnsiColorCode["DefaultBack"] = 49] = "DefaultBack";
    /** @desc Subscript */
    AnsiColorCode[AnsiColorCode["Subscript"] = 48] = "Subscript";
    /** @desc Superscript */
    AnsiColorCode[AnsiColorCode["Superscript"] = 49] = "Superscript";
    // xterm 16 color support
    /** @desc Set foreground color to Black */
    AnsiColorCode[AnsiColorCode["XBlack"] = 90] = "XBlack";
    /** @desc Set foreground color to Red */
    AnsiColorCode[AnsiColorCode["XRed"] = 91] = "XRed";
    /** @desc Set foreground color to Green */
    AnsiColorCode[AnsiColorCode["XGreen"] = 92] = "XGreen";
    /** @desc Set foreground color to Yellow */
    AnsiColorCode[AnsiColorCode["XYellow"] = 93] = "XYellow";
    /** @desc Set foreground color to Blue */
    AnsiColorCode[AnsiColorCode["XBlue"] = 94] = "XBlue";
    /** @desc Set foreground color to Magenta */
    AnsiColorCode[AnsiColorCode["XMagenta"] = 95] = "XMagenta";
    /** @desc Set foreground color to Cyan */
    AnsiColorCode[AnsiColorCode["XCyan"] = 96] = "XCyan";
    /** @desc Set foreground color to White */
    AnsiColorCode[AnsiColorCode["XWhite"] = 97] = "XWhite";
    /** @desc Set background color to Black */
    AnsiColorCode[AnsiColorCode["XBlackBackground"] = 100] = "XBlackBackground";
    /** @desc Set background color to Red */
    AnsiColorCode[AnsiColorCode["XRedBackground"] = 101] = "XRedBackground";
    /** @desc Set background color to Green */
    AnsiColorCode[AnsiColorCode["XGreenBackground"] = 102] = "XGreenBackground";
    /** @desc Set background color to Yellow */
    AnsiColorCode[AnsiColorCode["XYellowBackground"] = 103] = "XYellowBackground";
    /** @desc Set background color to Blue */
    AnsiColorCode[AnsiColorCode["XBlueBackground"] = 104] = "XBlueBackground";
    /** @desc Set background color to Magenta */
    AnsiColorCode[AnsiColorCode["XMagentaBackground"] = 105] = "XMagentaBackground";
    /** @desc Set background color to Cyan */
    AnsiColorCode[AnsiColorCode["XCyanBackground"] = 106] = "XCyanBackground";
    /** @desc Set background color to White */
    AnsiColorCode[AnsiColorCode["XWhiteBackground"] = 107] = "XWhiteBackground";
})(AnsiColorCode = exports.AnsiColorCode || (exports.AnsiColorCode = {}));
;
