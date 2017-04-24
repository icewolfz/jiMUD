"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="global.d.ts" />
const EventEmitter = require("events");
const RGBColor = require("rgbcolor");
const library_1 = require("./library");
const buzz = require('buzz');
/**
   * Enum for MXP tags.
   * @readonly
   * @enum {number}
   * @typedef {number} MXPTag
   */
var MXPTag;
(function (MXPTag) {
    MXPTag[MXPTag["None"] = 0] = "None";
    MXPTag[MXPTag["B"] = 1] = "B";
    MXPTag[MXPTag["BOLD"] = 2] = "BOLD";
    MXPTag[MXPTag["STRONG"] = 3] = "STRONG";
    MXPTag[MXPTag["I"] = 4] = "I";
    MXPTag[MXPTag["ITALIC"] = 5] = "ITALIC";
    MXPTag[MXPTag["EM"] = 6] = "EM";
    MXPTag[MXPTag["U"] = 7] = "U";
    MXPTag[MXPTag["UNDERLINE"] = 8] = "UNDERLINE";
    MXPTag[MXPTag["S"] = 9] = "S";
    MXPTag[MXPTag["STRIKEOUT"] = 10] = "STRIKEOUT";
    MXPTag[MXPTag["STRIKE"] = 11] = "STRIKE";
    MXPTag[MXPTag["C"] = 12] = "C";
    MXPTag[MXPTag["COLOR"] = 13] = "COLOR";
    MXPTag[MXPTag["H"] = 14] = "H";
    MXPTag[MXPTag["HIGH"] = 15] = "HIGH";
    MXPTag[MXPTag["FONT"] = 16] = "FONT";
    MXPTag[MXPTag["HR"] = 17] = "HR";
    MXPTag[MXPTag["NOBR"] = 18] = "NOBR";
    MXPTag[MXPTag["P"] = 19] = "P";
    MXPTag[MXPTag["BR"] = 20] = "BR";
    MXPTag[MXPTag["SBR"] = 21] = "SBR";
    MXPTag[MXPTag["A"] = 22] = "A";
    MXPTag[MXPTag["SEND"] = 23] = "SEND";
    MXPTag[MXPTag["EXPIRE"] = 24] = "EXPIRE";
    MXPTag[MXPTag["VERSION"] = 25] = "VERSION";
    MXPTag[MXPTag["SUPPORT"] = 26] = "SUPPORT";
    MXPTag[MXPTag["RESET"] = 27] = "RESET";
    MXPTag[MXPTag["H1"] = 28] = "H1";
    MXPTag[MXPTag["H2"] = 29] = "H2";
    MXPTag[MXPTag["H3"] = 30] = "H3";
    MXPTag[MXPTag["H4"] = 31] = "H4";
    MXPTag[MXPTag["H5"] = 32] = "H5";
    MXPTag[MXPTag["H6"] = 33] = "H6";
    MXPTag[MXPTag["V"] = 34] = "V";
    MXPTag[MXPTag["VAR"] = 35] = "VAR";
    MXPTag[MXPTag["USER"] = 36] = "USER";
    MXPTag[MXPTag["PASSWORD"] = 37] = "PASSWORD";
    MXPTag[MXPTag["Custom"] = 38] = "Custom";
    MXPTag[MXPTag["GAUGE"] = 39] = "GAUGE";
    MXPTag[MXPTag["STAT"] = 40] = "STAT";
})(MXPTag || (MXPTag = {}));
var lineType;
(function (lineType) {
    lineType[lineType["None"] = -1] = "None";
    lineType[lineType["Open"] = 0] = "Open";
    lineType[lineType["Secure"] = 1] = "Secure";
    lineType[lineType["Locked"] = 2] = "Locked";
    lineType[lineType["Reset"] = 3] = "Reset";
    lineType[lineType["TempSecure"] = 4] = "TempSecure";
    lineType[lineType["LockOpen"] = 5] = "LockOpen";
    lineType[lineType["LockSecure"] = 6] = "LockSecure";
    lineType[lineType["LockLocked"] = 7] = "LockLocked";
    lineType[lineType["RoonName"] = 10] = "RoonName";
    lineType[lineType["RoomDescription"] = 11] = "RoomDescription";
    lineType[lineType["RoomExits"] = 12] = "RoomExits";
    lineType[lineType["WelcomeText"] = 19] = "WelcomeText";
})(lineType || (lineType = {}));
/**
   * Enum flag for Font styles.
   * @readonly
   * @enum {number}
   * @typedef {number} FontStyle
   */
var FontStyle;
(function (FontStyle) {
    FontStyle[FontStyle["None"] = 0] = "None";
    FontStyle[FontStyle["Bold"] = 1] = "Bold";
    FontStyle[FontStyle["Faint"] = 2] = "Faint";
    FontStyle[FontStyle["Italic"] = 4] = "Italic";
    FontStyle[FontStyle["Underline"] = 8] = "Underline";
    FontStyle[FontStyle["Slow"] = 16] = "Slow";
    FontStyle[FontStyle["Rapid"] = 32] = "Rapid";
    FontStyle[FontStyle["Inverse"] = 64] = "Inverse";
    FontStyle[FontStyle["Hidden"] = 128] = "Hidden";
    FontStyle[FontStyle["Strikeout"] = 256] = "Strikeout";
    FontStyle[FontStyle["DoubleUnderline"] = 512] = "DoubleUnderline";
    FontStyle[FontStyle["Overline"] = 1024] = "Overline";
})(FontStyle || (FontStyle = {}));
/**
 * Enum for parser state.
 * @readonly
 * @enum {number}
 * @typedef {number} ParserState
 */
var ParserState;
(function (ParserState) {
    ParserState[ParserState["None"] = 0] = "None";
    ParserState[ParserState["Ansi"] = 1] = "Ansi";
    ParserState[ParserState["AnsiParams"] = 2] = "AnsiParams";
    ParserState[ParserState["XTermTitle"] = 3] = "XTermTitle";
    ParserState[ParserState["MXPTag"] = 4] = "MXPTag";
    ParserState[ParserState["MXPTagQuoted"] = 5] = "MXPTagQuoted";
    ParserState[ParserState["MXPTagDblQuoted"] = 6] = "MXPTagDblQuoted";
    ParserState[ParserState["MXPEntity"] = 7] = "MXPEntity";
    ParserState[ParserState["MXPComment"] = 8] = "MXPComment";
    ParserState[ParserState["MXPTagArg"] = 9] = "MXPTagArg";
    ParserState[ParserState["URL"] = 10] = "URL";
    ParserState[ParserState["URLFound"] = 11] = "URLFound";
    ParserState[ParserState["MSPSound"] = 12] = "MSPSound";
    ParserState[ParserState["MSPMusic"] = 13] = "MSPMusic";
})(ParserState || (ParserState = {}));
/**
   * Object to track current state of MXP
   *
   * @property {Boolean}  [on=""]								- MXP on for current block of process, determined based on linemode sent
   * @property {Number}   [lineType=0]					- Current linetype, 0 to 99 based on MXP spec
   * @property {Boolean}  [locked=false]				- is the current line mode locked based on lineType
   * @property {Boolean}  [paragraph=false]			- is current block in a paragraph to ignore \n
   * @property {Boolean}  [noBreak=false]				- Ignore the next \n
   * @property {Boolean}  [expanded=false]			- element expanded so it knows to insert the new text before continuing to parse
   * @property {Number}   [capture=0]						- Capture any text processed while capture is one, supports nesting
   * @property {Strung[]} [captured=[]]					- Captured text buffers, an array of nested captures, as captures end the last one added is poped off, and capture is decreased by 1
   * @property {Boolean}  [expanded=false]			- line tag expanded
   * @property {Boolean}  [gagged=false]				- current block of text gagged from being displayed
   */
class MXPState {
    constructor() {
        this.on = false;
        this.lineType = 0;
        this.locked = false;
        this.paragraph = false;
        this.noBreak = false;
        this.expanded = false;
        this.lineExpanded = false;
        this.capture = 0;
        this.captured = [];
        this.gagged = false;
    }
}
;
/**
   * MXP Entity object
   *
   * @property {String}  [name=""]					- The name of the entity
   * @property {String}  [value=""]					- The value of the entity
   * @property {String}  [description=""]		- the description of the entity
   * @property {Boolean} [publish=false]		- Is the entity published to the public for users to access value
   * @property {Boolean} [remote=false]			- None standard, tells the parser where the entity is from for security reasons as local users should not beable to change server set entities
   */
class Entity {
    constructor(remote) {
        this.name = "";
        this.value = "";
        this.description = "";
        this.publish = false;
        this.remote = false;
        this.remote = remote == null ? false : remote;
    }
}
;
/**
 * MXP Element object
 *
 * @property {String}  [name=""]							- The name of the element
 * @property {String}  [definition=""]				- The element definition to expand to
 * @property {String}  [closeDefinition=""]		- The close definition built from definition
 * @property {Object}  [attributes=""]				- Object to track attriutes list
 * @property {Array}   [attributeIndexes=[]]	- Array to link attriutes to argument index
 * @property {Number}  [tag=-1]								- Tag line, if set will present tagline codes to definition in format of <esc>[<tag>zDefinition
 * @property {String}  [flag=""]							- Elmental tag property, mostly client depentant, see MXP spec for full list of basic ones
 * @property {Boolean} [open=false]						- Is this an open element that can be used on an open line type
 * @property {Boolean} [empty=false]					- Is this an empty tag that doesnt have a CloseDefinition
 * @property {Boolean} [remote=false]					- None standard, tells the parser where the entity is from for security reasons as local users should not beable to change server set elements
 * @property {Boolean} [gagged=false]					- Is element gagged from display as a tag could cause a custom elment to be processed but hidden
 */
class Element {
    constructor(remote) {
        this.name = "";
        this.definition = "";
        this.closeDefinition = "";
        this.attributes = {};
        this.attributeIndexes = [];
        this.tag = lineType.None;
        this.flag = "";
        this.open = false;
        this.empty = false;
        this.remote = false;
        this.gagged = false;
        this.remote = remote == null ? false : remote;
    }
}
;
/**
 * MXP Line Tag object
 *
 * @property {Number}  [index=-1]						- The tag number (20-99) to change
 * @property {String}  [window=""]					- Specifies the name of a window to redirect the text to, unsupported
 * @property {Boolean} [gag=false]					- Indicates that the text should be gagged from the main MUD window.
 * @property {String}  [fore=""]						- The text foreground color.
 * @property {String}  [back=""]						- The background color of the text.
 * @property {Boolean} [enabled=true]				- Turn this tag on or off.
 * @property {Boolean} [remote=false]				- None standard, tells the parser where the tag is from for security reasons as local users should not beable to change server set tag
 * @property {String}  [element=""]					- Was the tag created by an element, as it should use that elements def/closeDef
 * @property {String}  [definition=""]			- Was the tag supplied with its own colors, still link to element but these colors override anyset by element
 * @property {String}  [closeDefinition=""]	- The close definition built from definition
 */
class Tag {
    constructor(index, fore, back, remote) {
        this.index = lineType.None;
        this.window = "";
        this.gag = false;
        this.fore = "";
        this.back = "";
        this.enabled = true;
        this.remote = false;
        this.element = "";
        this.definition = "";
        this.closeDefinition = "";
        if (index != null)
            this.index = index;
        if (fore != null)
            this.fore = fore;
        if (back != null)
            this.back = back;
        if (remote != null)
            this.remote = remote;
    }
}
;
/**
 * MXPStyle object, stores the current style for display block in a stack, new styles are build on prev and pushed on stack, as style are closed they are poped off
  *
 * @property {MXPTag}    [tag=0]				- The tag that applied this style
 * @property {String}    [custom=""]		- If tag is custom store its name to know the exact tag
 * @property {String}    [font=""]			- The font to apply to current display block
 * @property {String}    [fontSize=""]	-	The font size in any valid css format
 * @property {FontStyle} [style=_style]	- The fontStyle enum state, see fontStyle
 * @property {String}    [fore=_fore]		- The foreground color, this overrides any ansi foreground set
 * @property {String}    [back=_back]		- The background color, this overrides aay ansi background set
 * @property {Boolean}   [high=_high]		- This will brigten what ever the current foreground color is by 50% even if it is an ansi set color
 * @property {Object}    [obj=null]			- Store misc data that a tag may need for later processing
 */
class MXPStyle {
    constructor(style, fore, back, high) {
        this.tag = MXPTag.None;
        this.custom = "";
        this.font = "";
        this.fontSize = "";
        this.style = FontStyle.None;
        this.fore = "";
        this.back = "";
        this.high = false;
        this.obj = null;
        this.gagged = false;
        if (style != null)
            this.style = style;
        if (fore != null)
            this.fore = fore;
        if (back != null)
            this.back = back;
        if (high != null)
            this.high = high;
    }
}
;
/**
 * An Ansi/MXP parser, requires requires the modules src/lib/rgbcolor for color processing and validation
 *
 * @author Icewolfz
 * @copyright Icewolfz 2013
 * @version 1.1
 * @requires module:src/lib/rgbcolor
 * @namespace Parser
 *
 * @todo WELCOME element - just tags text as welcome for redirection purposes, dont support redirection to other windows so dont worry about this
 * @todo <FRAME NAME ACTION(OPEN|CLOSE|REDIRECT) TITLE INTERNAL ALIGN(LEFT|RIGHT|BOTTOM|TOP) LEFT TOP WIDTH HEIGHT SCROLLING(yes|no) FLOATING>
 * @constructor
 *
 * @param {Object}	options													- The options to start off with
 * @param {Boolean} [options.MXP=true]							- Enable/disable MXP parsing
 * @param {Object}	options.window									- The window viewsize, used for clearning screen and other ansi related systems
 * @param {Number}	[options.window.height=0]				- The window height in lines
 * @param {Number}	[options.window.width=0]				- The window width in charcters
 * @param {Boolean} [options.flashing=false]				- Enable/disable ansi blink
 *
 * @property {String}  [StyleVersion=""]						- The MXP cached version style set from the VERSION tag, used by a client to reply to a VERSION request
 * @property {Boolean} [displayControlCodes=false]	- Display unreadable characters, code < 32 || 127
 * @property {Boolean} [emulateControlCodes=true]		- Emulate control codes like escape, tabs, etc...
 * @property {Boolean} [EndofLine=false]						- Is the current parser state at end of line or on a fragment
 * @property {Number}  [TextLength=0]								- The current amount of text that has been parsed
 * @property {Boolean} [enableMXP=true]							- Enable/disable MXP parsing
 * @property {Boolean} [enableMSP=true]							- Enable/disable MSP parsing
 * @property {Boolean} window												- The window size, used for clearning screen and other ansi related systems
 * @property {Number}  [options.window.height=0]		- The window height in lines
 * @property {Number}  [options.window.width=0]			- The window width in charcters
 * @property {Boolean} [enableFlashing=false]				- Enable/disable ansi blink
 * @property {Boolean} [emulateTerminal=false]			- Enable/disable Terminal IBM/OEM (code page 437) extended characters, will convert them to the correct unicode character in an attempt to display like classic terminal
 */
class Parser extends EventEmitter {
    constructor(options) {
        super();
        /** @private */
        this.parsing = [];
        /** @private */
        /* Web detction protocols that are just followed by a :*/
        this.protocols = [["m", "a", "i", "l", "t", "o"], ["s", "k", "y", "p", "e"], ["a", "i", "m"], ["c", "a", "l", "l", "t", "o"], ["g", "t", "a", "l", "k"], ["i", "m"], ["i", "t", "m", "s"], ["m", "s", "n", "i", "m"], ["t", "e", "l"], ["y", "m", "s", "g", "r"]];
        /** @private */
        this._ColorTable = null;
        /** @private */
        this._CurrentForeColor = 37;
        /** @private */
        this._CurrentBackColor = 40;
        /** @private */
        this._CurrentAttributes = FontStyle.None;
        /** @private */
        this._SplitBuffer = "";
        /** @private */
        this.mxpState = new MXPState();
        /** @private */
        this.mxpStyles = [];
        /** @private */
        this.mxpEntities = {};
        /** @private */
        this.mxpElements = {};
        /** @private */
        this.mxpLines = [];
        /** @private */
        this.iMXPDefaultMode = lineType.Open;
        this.displayControlCodes = false;
        this.emulateControlCodes = true;
        this.StyleVersion = "";
        this.EndofLine = false;
        this.TextLength = 0;
        this.enableMXP = true;
        this.DefaultImgUrl = "themes/general";
        this.enableDebug = false;
        this.enableLinks = true;
        this.enableMSP = true;
        this.enableURLDetection = true;
        this.window = new library_1.Size(0, 0);
        this.enableFlashing = false;
        this.emulateTerminal = false;
        this.bell = "./../assets/sounds/bell.m4a";
        this.enableBell = true;
        this.display = null;
        if (options != null) {
            if (options.DefaultImageURL)
                this.DefaultImgUrl = options.DefaultImageURL;
            if (options.enableMXP != null)
                this.enableMXP = options.MXP;
            if (options.enableDebug != null)
                this.enableDebug = options.enableDebug;
            if (options.MSP != null)
                this.enableMSP = options.MSP;
            if (options.URLDetection != null)
                this.enableURLDetection = options.enableURLDetection;
            if (options.window != null)
                this.window = options.window;
            if (options.flashing != null)
                this.enableFlashing = options.flashing;
            if (options.terminal != null)
                this.emulateTerminal = options.terminal;
            if (options.bell != null)
                this.bell = options.bell;
            if (options.enableBell != null)
                this.enableBell = options.enableBell;
            if (options.display != null)
                this.display = options.display;
            if (options.enableLinks)
                this.enableLinks = options.enableLinks;
        }
    }
    getColors(mxp) {
        if (typeof mxp == "undefined")
            mxp = this.GetCurrentStyle();
        var f, b, fc = -1, bc = -1;
        if (mxp.fore.length > 0) {
            if ((this._CurrentAttributes & FontStyle.Bold) == FontStyle.Bold)
                f = this.IncreaseColor(mxp.fore, 0.5);
            else if ((this._CurrentAttributes & FontStyle.Faint) == FontStyle.Faint)
                f = this.DecreaseColor(mxp.fore, 0.5);
            else
                f = mxp.fore;
        }
        else if (typeof this._CurrentForeColor === "string")
            f = "rgb(" + this._CurrentForeColor.replace(/;/g, ",") + ")";
        else {
            f = this._CurrentForeColor;
            if ((this._CurrentAttributes & FontStyle.Bold) == FontStyle.Bold) {
                if (f > 999)
                    f /= 1000;
                if (f >= 0 && f < 99)
                    f *= 10;
                fc = f;
                if (f <= -16)
                    f = this.IncreaseColor(this.GetColor(f), 0.5);
                else
                    f = this.GetColor(f);
            }
            else if ((this._CurrentAttributes & FontStyle.Faint) == FontStyle.Faint) {
                if (f > 99 && f < 999)
                    f /= 10;
                if (f >= 0 && f < 999)
                    f *= 100;
                fc = f;
                if (f <= -16)
                    f = this.DecreaseColor(this.GetColor(f), 0.15);
                else
                    f = this.GetColor(f);
            }
            else {
                fc = f;
                f = this.GetColor(f);
            }
        }
        if (mxp.high)
            f = this.IncreaseColor(f, 0.25);
        if (mxp.back.length > 0)
            b = mxp.back;
        else if (typeof this._CurrentBackColor === "string")
            b = "rgb(" + this._CurrentBackColor.replace(/;/g, ",") + ")";
        else {
            bc = this._CurrentBackColor;
            b = this.GetColor(this._CurrentBackColor);
        }
        if ((this._CurrentAttributes & FontStyle.Inverse) == FontStyle.Inverse || (mxp.style & FontStyle.Inverse) == FontStyle.Inverse)
            return { fore: b, back: f, fcode: bc, bcode: fc };
        return { fore: f, back: b, fcode: fc, bcode: bc };
    }
    StartDisplayBlock() {
        var mxp = this.GetCurrentStyle();
        var colors = this.getColors(mxp);
        var cls = "", td = "";
        var strBuilder = ["<span style=\"", "color: ", colors.fore, ";", "background-color: ", colors.back, ";"];
        if (mxp.font.length > 0)
            strBuilder.push("font-family: ", mxp.font, ";");
        if (mxp.fontSize.length > 0)
            strBuilder.push("font-size: ", mxp.fontSize, ";");
        if ((mxp.style & FontStyle.Bold) == FontStyle.Bold)
            strBuilder.push("font-weight: bold;");
        //combine after mxp bold as bold weight vs ansi bold are different effects
        mxp.style |= this._CurrentAttributes;
        if (mxp.style > 0) {
            if ((mxp.style & FontStyle.Italic) == FontStyle.Italic)
                strBuilder.push("font-style: italic;border-top: 1px solid ", colors.back, ";");
            if ((mxp.style & FontStyle.Overline) == FontStyle.Overline)
                td += "overline ";
            if ((mxp.style & FontStyle.DoubleUnderline) == FontStyle.DoubleUnderline || (mxp.style & FontStyle.Underline) == FontStyle.Underline)
                td += "underline ";
            if ((mxp.style & FontStyle.DoubleUnderline) == FontStyle.DoubleUnderline)
                strBuilder.push("border-bottom: 1px solid ", colors.fore, ";");
            else
                strBuilder.push("border-bottom: 1px solid ", colors.back, ";");
            if ((mxp.style & FontStyle.Rapid) == FontStyle.Rapid || (mxp.style & FontStyle.Slow) == FontStyle.Slow) {
                if (this.enableFlashing)
                    cls += " ansi-blink";
                else if ((mxp.style & FontStyle.DoubleUnderline) != FontStyle.DoubleUnderline && (mxp.style & FontStyle.Underline) != FontStyle.Underline)
                    td += "underline ";
            }
            if ((mxp.style & FontStyle.Strikeout) == FontStyle.Strikeout)
                td += "line-through ";
            if (td.length > 0)
                strBuilder.push("text-decoration:", td, ";");
        }
        else
            strBuilder.push("border-bottom: 1px solid ", colors.back, ";");
        strBuilder.push("\" class=\"ansi", cls, " ansifore", colors.fcode, " ansiback", colors.bcode, "\">");
        return strBuilder.join('');
    }
    EndDisplayBlock() {
        return "</span>";
    }
    ResetColors() {
        this._CurrentForeColor = 37;
        this._CurrentBackColor = 40;
        this._CurrentAttributes = FontStyle.None;
    }
    ProcessAnsiColorParams(parms) {
        var p = 0, pl = parms.length, i;
        var rgb;
        for (; p < pl; p++) {
            i = parseInt(parms[p], 10);
            switch (i) {
                case 0:
                    this.ResetColors();
                    break;
                case 1:
                    this._CurrentAttributes |= FontStyle.Bold;
                    //can only be bold or faint not both, so when you turn on bold turn off faint
                    this._CurrentAttributes &= ~FontStyle.Faint;
                    break;
                case 2:
                    this._CurrentAttributes |= FontStyle.Faint;
                    //can only be bold or faint not both, so when you turn on faint turn off bold
                    this._CurrentAttributes &= ~FontStyle.Bold;
                    break;
                case 3:
                    this._CurrentAttributes |= FontStyle.Italic;
                    break;
                case 4:
                    this._CurrentAttributes |= FontStyle.Underline;
                    //this._CurrentAttributes &= ~FontStyle.DoubleUnderline;
                    break;
                case 5:
                    this._CurrentAttributes |= FontStyle.Slow;
                    break;
                case 6:
                    this._CurrentAttributes |= FontStyle.Rapid;
                    break;
                case 7:
                    this._CurrentAttributes |= FontStyle.Inverse;
                    break;
                case 8:
                    this._CurrentAttributes |= FontStyle.Hidden;
                    break;
                case 9:
                    this._CurrentAttributes |= FontStyle.Strikeout;
                    break;
                /*
                10 primary(default) font
                11 first alternative font
                12 second alternative font
                13 thirdalternative font
                14 fourthalternative font
                15 fifth alternative font
                16 sixth alternative font
                17 seventh alternative font
                18 eighth alternative font
                19 ninth alternative font
                20 Fraktur(Gothic)
                */
                case 21:
                    this._CurrentAttributes |= FontStyle.DoubleUnderline;
                    //this._CurrentAttributes &= ~FontStyle.Underline;
                    break;
                case 22:
                    this._CurrentAttributes &= ~FontStyle.Bold;
                    this._CurrentAttributes &= ~FontStyle.Faint;
                    break;
                case 23:
                    this._CurrentAttributes &= ~FontStyle.Italic;
                    break;
                case 24:
                    this._CurrentAttributes &= ~FontStyle.Underline;
                    this._CurrentAttributes &= ~FontStyle.DoubleUnderline;
                    break;
                case 25:
                    this._CurrentAttributes &= ~FontStyle.Slow;
                    break;
                case 26:
                    this._CurrentAttributes &= ~FontStyle.Rapid;
                    break;
                case 27:
                    this._CurrentAttributes &= ~FontStyle.Inverse;
                    break;
                case 28:
                    this._CurrentAttributes &= ~FontStyle.Hidden;
                    break;
                case 29:
                    this._CurrentAttributes &= ~FontStyle.Strikeout;
                    break;
                case -11: //error color
                case -7: //info color
                case -3: //local echo
                case 30: //set foreground color to black
                case 31: //set foreground color to red
                case 32: //set foreground color to green
                case 33: //set foreground color to yellow
                case 34: //set foreground color to blue
                case 35: //set foreground color to magenta (purple)
                case 36: //set foreground color to cyan
                case 37:
                    this._CurrentForeColor = i;
                    break;
                case 38:
                    if (p + 2 < pl && parms[p + 1] == "5") {
                        this._CurrentForeColor = parseInt(parms[p + 2], 10);
                        if (isNaN(this._CurrentForeColor))
                            this._CurrentForeColor = 37;
                        else {
                            this._CurrentForeColor += 16;
                            this._CurrentForeColor *= -1;
                        }
                        p += 2;
                    }
                    else if (p + 4 < pl && parms[p + 1] == "2") {
                        i = parseInt(parms[p + 2], 10);
                        if (i < 0 || i > 255)
                            continue;
                        rgb = i + ";";
                        i = parseInt(parms[p + 3], 10);
                        if (i < 0 || i > 255)
                            continue;
                        rgb += i + ";";
                        i = parseInt(parms[p + 4], 10);
                        if (i < 0 || i > 255)
                            continue;
                        rgb += i;
                        this._CurrentForeColor = rgb;
                        p += 4;
                    }
                    break;
                case 39:
                    this._CurrentForeColor = -1;
                    break;
                case -12: //error color
                case -8:
                case -4:
                case 40:
                case 41:
                case 42:
                case 43:
                case 44:
                case 45:
                case 46:
                case 47:
                    this._CurrentBackColor = i;
                    break;
                case 48:
                    if (p + 2 < pl && parms[p + 1] == "5") {
                        this._CurrentBackColor = parseInt(parms[p + 2], 10);
                        if (isNaN(this._CurrentBackColor))
                            this._CurrentBackColor = 40;
                        else {
                            this._CurrentBackColor += 16;
                            this._CurrentBackColor *= -1; //prevent overlap of protcals in color grabbing code
                        }
                        p += 2;
                    }
                    else if (p + 4 < pl && parms[p + 1] == "2") {
                        i = parseInt(parms[p + 2], 10);
                        if (i < 0 || i > 255)
                            continue;
                        rgb = i + ";";
                        i = parseInt(parms[p + 3], 10);
                        if (i < 0 || i > 255)
                            continue;
                        rgb += i + ";";
                        i = parseInt(parms[p + 4], 10);
                        if (i < 0 || i > 255)
                            continue;
                        rgb += i;
                        this._CurrentBackColor = rgb;
                        p += 4;
                    }
                    break;
                case 49:
                    this._CurrentBackColor = -2;
                    break;
                //Zmud log colors, seems zmud uses the 50s for display info for bold colors, standards use it to control borders and other effects
                //dont need zmud colors here as we never need to open fonts, replace wiht the frames/overlined/etc... if it can be done in css
                case 53:
                    this._CurrentAttributes |= FontStyle.Overline;
                    break;
                case 55:
                    this._CurrentAttributes &= ~FontStyle.Overline;
                    break;
                case 50: //Reserved
                case 51: //Framed beleave this adds a border all the way around block of text
                case 52: //Encircled, not sure maybe draws a circle around text?
                case 54: //Not framed or encircled, turns off framed/encircled
                case 56: //Reserved
                case 57: //Reserved
                case 58: //Reserved
                case 59:
                    this._CurrentForeColor = i - 20;
                    this._CurrentAttributes |= FontStyle.Bold; //makebold
                    break;
                //xterm 16 but color
                //Assume that xterm?s resources are set so that the ISO color codes are the first 8 of a set of 16.
                //Then the aixterm colors are the bright versions of the ISO colors:
                case 90:
                case 91:
                case 92:
                case 93:
                case 94:
                case 95:
                case 96:
                case 97:
                    this._CurrentForeColor = i;
                    break;
                case 100:
                case 101:
                case 102:
                case 103:
                case 104:
                case 105:
                case 106:
                case 107:
                    this._CurrentBackColor = i;
                    break;
            }
        }
    }
    buildColorTable() {
        var _ColorTable = [];
        var r, g, b, idx;
        for (r = 0; r < 6; r++) {
            for (g = 0; g < 6; g++) {
                for (b = 0; b < 6; b++) {
                    idx = 16 + (r * 36) + (g * 6) + b;
                    _ColorTable[idx] = "rgb(";
                    if (r > 0)
                        _ColorTable[idx] += r * 40 + 55;
                    else
                        _ColorTable[idx] += "0";
                    _ColorTable[idx] += ",";
                    if (g > 0)
                        _ColorTable[idx] += g * 40 + 55;
                    else
                        _ColorTable[idx] += "0";
                    _ColorTable[idx] += ",";
                    if (b > 0)
                        _ColorTable[idx] += b * 40 + 55;
                    else
                        _ColorTable[idx] += "0";
                    _ColorTable[idx] += ")";
                }
            }
        }
        for (r = 232; r <= 255; r++) {
            g = (r - 232) * 10 + 8;
            _ColorTable[r] = ["rgb(", g, ",", g, ",", g, ")"].join('');
        }
        _ColorTable[0] = "rgb(0,0,0)"; //black fore
        _ColorTable[1] = "rgb(128, 0, 0)"; //red fore
        _ColorTable[2] = "rgb(0, 128, 0)"; //green fore
        _ColorTable[3] = "rgb(128, 128, 0)"; //yellow fore
        _ColorTable[4] = "rgb(0, 0, 238)"; //blue fore
        _ColorTable[5] = "rgb(128, 0, 128)"; //magenta fore
        _ColorTable[6] = "rgb(0, 128, 128)"; //cyan fore
        _ColorTable[7] = "rgb(187, 187, 187)"; //white fore
        _ColorTable[8] = "rgb(128, 128, 128)"; //black  bold
        _ColorTable[9] = "rgb(255, 0, 0)"; //Red bold
        _ColorTable[10] = "rgb(0, 255, 0)"; //green bold
        _ColorTable[11] = "rgb(255, 255, 0)"; //yellow bold
        _ColorTable[12] = "rgb(92, 92, 255)"; //blue bold
        _ColorTable[13] = "rgb(255, 0, 255)"; //magenta bold
        _ColorTable[14] = "rgb(0, 255, 255)"; //cyan bold
        _ColorTable[15] = "rgb(255, 255, 255)"; //white bold
        _ColorTable[256] = "rgb(0, 0, 0)"; //black faint
        _ColorTable[257] = "rgb(118, 0, 0)"; //red  faint
        _ColorTable[258] = "rgb(0, 108, 0)"; //green faint
        _ColorTable[259] = "rgb(145, 136, 0)"; //yellow faint
        _ColorTable[260] = "rgb(0, 0, 167)"; //blue faint
        _ColorTable[261] = "rgb(108, 0, 108)"; //magenta faint
        _ColorTable[262] = "rgb(0, 108, 108)"; //cyan faint
        _ColorTable[263] = "rgb(161, 161, 161)"; //white faint
        _ColorTable[264] = "rgb(0, 0, 0)"; //BackgroundBlack
        _ColorTable[265] = "rgb(128, 0, 0)"; //red back
        _ColorTable[266] = "rgb(0, 128, 0)"; //greenback
        _ColorTable[267] = "rgb(128, 128, 0)"; //yellow back
        _ColorTable[268] = "rgb(0, 0, 238)"; //blue back
        _ColorTable[269] = "rgb(128, 0, 128)"; //magenta back
        _ColorTable[270] = "rgb(0, 128, 128)"; //cyan back
        _ColorTable[271] = "rgb(187, 187, 187)"; //white back
        _ColorTable[272] = "rgb(0,0,0)"; //iceMudInfoBackground
        _ColorTable[273] = "rgb(0, 255, 255)"; //iceMudInfoText
        _ColorTable[274] = "rgb(0,0,0)"; //LocalEchoBackground
        _ColorTable[275] = "rgb(255, 255, 0)"; //LocalEchoText
        _ColorTable[276] = "rgb(0, 0, 0)"; //DefaultBack
        _ColorTable[277] = "rgb(229, 229, 229)"; //DefaultFore
        _ColorTable[278] = "rgb(205, 0, 0)"; //ErrorFore
        _ColorTable[279] = "rgb(229, 229, 229)"; //ErrorBack
        _ColorTable[280] = "rgb(255,255,255)"; //DefaultBrightFore
        this._ColorTable = _ColorTable;
    }
    GetColor(code) {
        if (this._ColorTable == null)
            this.buildColorTable();
        switch (code) {
            case -12:
                return this._ColorTable[279]; //ErrorBack
            case -11:
                return this._ColorTable[278]; //ErrorFore
            case -10:
                return this._ColorTable[280]; //DefaultBrightFore
            case -8:
                return this._ColorTable[272]; //iceMudInfoBackground
            case -7:
                return this._ColorTable[273]; //iceMudInfoText
            case -4:
                return this._ColorTable[274]; //LocalEchoBackground
            case -3:
                return this._ColorTable[275]; //LocalEchoText
            case 49:
            case -2:
                return this._ColorTable[276]; //DefaultBack
            case 39:
            case -1:
                return this._ColorTable[277]; //DefaultBack
            case 0:
            case 30:
                return this._ColorTable[0];
            case 1:
            case 31:
                return this._ColorTable[1];
            case 2:
            case 32:
                return this._ColorTable[2];
            case 3:
            case 33:
                return this._ColorTable[3];
            case 4:
            case 34:
                return this._ColorTable[4];
            case 5:
            case 35:
                return this._ColorTable[5];
            case 6:
            case 36:
                return this._ColorTable[6];
            case 7:
            case 37:
                return this._ColorTable[7];
            case 40:
                return this._ColorTable[264];
            case 41:
                return this._ColorTable[265];
            case 42:
                return this._ColorTable[266];
            case 43:
                return this._ColorTable[267];
            case 44:
                return this._ColorTable[268];
            case 45:
                return this._ColorTable[269];
            case 46:
                return this._ColorTable[270];
            case 47:
                return this._ColorTable[271];
            case 8:
            case 90:
            case 100:
            case 300: //set foreground color to black
            case 400:
                return this._ColorTable[8];
            case 9:
            case 91:
            case 101:
            case 310: //set foreground color to red
            case 410:
                return this._ColorTable[9];
            case 10:
            case 92:
            case 102:
            case 320: //set foreground color to green
            case 420:
                return this._ColorTable[10];
            case 11:
            case 93:
            case 103:
            case 330: //set foreground color to yellow
            case 430:
                return this._ColorTable[11];
            case 12:
            case 94:
            case 104:
            case 340: //set foreground color to blue
            case 440:
                return this._ColorTable[12];
            case 13:
            case 95:
            case 105:
            case 350: //set foreground color to magenta (purple)
            case 450:
                return this._ColorTable[13];
            case 14:
            case 96:
            case 106:
            case 360: //set foreground color to cyan
            case 460:
                return this._ColorTable[14];
            case 15:
            case 97:
            case 107:
            case 370: //set foreground color to white
            case 470:
                return this._ColorTable[15];
            case 4000:
            case 3000:
                return this._ColorTable[256];
            case 4100:
            case 3100:
                return this._ColorTable[257];
            case 4200:
            case 3200:
                return this._ColorTable[258];
            case 4300:
            case 3300:
                return this._ColorTable[259];
            case 4400:
            case 3400:
                return this._ColorTable[260];
            case 4500:
            case 3500:
                return this._ColorTable[261];
            case 4600:
            case 3600:
                return this._ColorTable[262];
            case 4700:
            case 3700:
                return this._ColorTable[263];
            default:
                if (code <= -16) {
                    code += 16;
                    code *= -1;
                }
                if (code >= 0 && code < 281)
                    return this._ColorTable[code];
                return this._ColorTable[277];
        }
    }
    ;
    SetColor(code, color) {
        if (this._ColorTable === null)
            this.buildColorTable();
        if (code < 0 || code >= this._ColorTable.length)
            return;
        color = new RGBColor(color);
        if (!color.ok)
            return;
        this._ColorTable[code] = color.toRGB();
    }
    ;
    AddLine(line, fragment, skip) {
        var data = { line: line, fragment: fragment, gagged: skip };
        this.emit('addLine', data);
        this.EndofLine = !fragment;
    }
    GetEntity(entity) {
        if (entity == "text")
            return entity;
        //custom entity
        if (this.mxpEntities[entity]) {
            //expanded it for processing
            this.mxpState.expanded = true;
            //return value to be processed as value could contain mxp tags and other entities
            return this.mxpEntities[entity].value;
        }
        return entity;
    }
    ClearMXPToTag(tag, custom) {
        if (custom == null)
            custom = "";
        var tmp = new MXPStyle();
        tmp.tag = MXPTag.None;
        var ml = this.mxpStyles.length - 1;
        for (; ml >= 0; ml--) {
            if (this.mxpStyles[ml].tag != tag && this.mxpStyles[ml].custom != custom)
                tmp = this.mxpStyles.pop();
            else
                break;
        }
        if (this.mxpStyles.length > 0)
            tmp = this.mxpStyles.pop();
        else if (this.mxpStyles.length === 0)
            this.ResetMXP();
        return tmp;
    }
    ParseMXPTag(tag, args, remote) {
        var tmp, arg, sarg, sargs, color, x, xl = args.length, e, sl, s;
        var href = "", hint = "", expire = "", prompt = false;
        tag = tag.toUpperCase();
        if (this.enableDebug) {
            this.emit('debug', "MXP Tag: " + tag);
            this.emit('debug', "MXP Tag Args: " + args);
        }
        switch (tag) {
            case "C":
            case "COLOR":
                tmp = this.GetCurrentStyle();
                tmp.tag = MXPTag[tag];
                if (xl > 0) {
                    arg = args[0].split('=');
                    if (arg.length > 1) {
                        color = new RGBColor(library_1.stripQuotes(arg[1]));
                        if (!color.ok)
                            return null;
                        if (arg[0].toUpperCase() == "BACK")
                            tmp.back = color.toRGB();
                        else
                            tmp.fore = color.toRGB();
                    }
                    else {
                        color = new RGBColor(library_1.stripQuotes(arg[0]));
                        if (color.ok)
                            tmp.fore = color.toRGB();
                    }
                }
                if (xl > 1) {
                    arg = args[1].split('=');
                    if (arg.length > 1) {
                        color = new RGBColor(library_1.stripQuotes(arg[1]));
                        if (!color.ok)
                            return null;
                        if (arg[0].toUpperCase() == "FORE")
                            tmp.fore = color.toRGB();
                        else
                            tmp.back = color.toRGB();
                    }
                    else {
                        color = new RGBColor(library_1.stripQuotes(arg[0]));
                        if (color.ok)
                            tmp.back = color.toRGB();
                    }
                }
                tmp.custom = "";
                this.mxpStyles.push(tmp);
                return null;
            case "B":
            case "BOLD":
            case "STRONG":
                tmp = this.GetCurrentStyle();
                tmp.tag = MXPTag[tag];
                tmp.style |= FontStyle.Bold;
                tmp.custom = "";
                this.mxpStyles.push(tmp);
                return null;
            case "FONT":
                tmp = this.GetCurrentStyle();
                tmp.tag = MXPTag[tag];
                for (x = 0; x < xl; x++) {
                    arg = args[x].split('=');
                    if (arg.length > 1) {
                        switch (arg[0].toUpperCase()) {
                            case "SIZE":
                                if (this.isNumber(arg[1]))
                                    tmp.fontSize = arg[1] + "pt";
                                else
                                    tmp.fontSize = arg[1];
                                break;
                            case "COLOR":
                                sargs = arg[1].split(',');
                                color = new RGBColor(library_1.stripQuotes(sargs[0]));
                                if (color.ok)
                                    tmp.fore = color.toRGB();
                                for (s = 1, sl = sargs.length; s < sl; s++) {
                                    switch (sargs[s].toLowerCase()) {
                                        case "bold":
                                            tmp.style |= FontStyle.Bold;
                                            break;
                                        case "italic":
                                            tmp.style |= FontStyle.Italic;
                                            break;
                                        case "underline":
                                            tmp.style |= FontStyle.Underline;
                                            break;
                                        case "blink":
                                            tmp.style |= FontStyle.Slow;
                                            break;
                                        case "inverse":
                                            tmp.style |= FontStyle.Inverse;
                                            break;
                                    }
                                }
                                break;
                            case "BACK":
                                color = new RGBColor(library_1.stripQuotes(arg[1]));
                                if (color.ok)
                                    tmp.back = color.toRGB();
                                break;
                            case "FACE":
                                tmp.font = library_1.stripQuotes(arg[1]);
                                break;
                            default:
                                if (this.enableDebug)
                                    this.emit('debug', "Invalid Argument for " + tag + ": " + arg[0]);
                                break;
                        }
                    }
                    else if (x === 0)
                        tmp.font = library_1.stripQuotes(args[x]);
                    else if (x == 1) {
                        if (this.isNumber(args[x]))
                            tmp.fontSize = args[x] + "pt";
                        else
                            tmp.fontSize = args[x];
                    }
                    else if (x == 2) {
                        color = new RGBColor(library_1.stripQuotes(args[x]));
                        if (color.ok)
                            tmp.fore = color.toRGB();
                    }
                    else if (x == 3) {
                        color = new RGBColor(library_1.stripQuotes(args[x]));
                        if (color.ok)
                            tmp.back = color.toRGB();
                    }
                }
                tmp.custom = "";
                this.mxpStyles.push(tmp);
                return null;
            case "H":
            case "HIGH":
                tmp = this.GetCurrentStyle();
                tmp.tag = MXPTag[tag];
                tmp.high = true;
                tmp.custom = "";
                this.mxpStyles.push(tmp);
                return null;
            case "I":
            case "ITALIC":
            case "EM":
                tmp = this.GetCurrentStyle();
                tmp.tag = MXPTag[tag];
                tmp.style |= FontStyle.Italic;
                tmp.custom = "";
                this.mxpStyles.push(tmp);
                return null;
            case "U":
            case "UNDERLINE":
                tmp = this.GetCurrentStyle();
                tmp.tag = MXPTag[tag];
                tmp.style |= FontStyle.Underline;
                tmp.custom = "";
                this.mxpStyles.push(tmp);
                return null;
            case "S":
            case "STRIKEOUT":
                tmp = this.GetCurrentStyle();
                tmp.tag = MXPTag[tag];
                tmp.style |= FontStyle.Strikeout;
                tmp.custom = "";
                this.mxpStyles.push(tmp);
                return null;
            case "/B":
            case "/BOLD":
            case "/STRONG":
            case "/H":
            case "/HIGH":
            case "/I":
            case "/ITALIC":
            case "/EM":
            case "/U":
            case "/UNDERLINE":
            case "/S":
            case "/STRIKEOUT":
            case "/C":
            case "/COLOR":
            case "/FONT":
                this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                return null;
        }
        if (this.mxpState.lineType == lineType.Secure || this.mxpState.lineType == lineType.LockSecure || this.mxpState.lineType == lineType.TempSecure) {
            switch (tag) {
                case "IMAGE":
                    e = {
                        name: "",
                        url: this.DefaultImgUrl,
                        t: "",
                        h: "",
                        w: "",
                        hspace: "",
                        vspace: "",
                        align: "bottom",
                        ismap: false
                    };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case "FNAME":
                                e.name = library_1.stripQuotes(arg[1]);
                                break;
                            case "URL":
                                e.url = library_1.stripQuotes(arg[1]);
                                break;
                            case "T":
                                if (arg[1].length > 0)
                                    e.type = arg[1];
                                break;
                            case "H":
                                e.h = library_1.stripQuotes(arg[1]);
                                break;
                            case "W":
                                e.w = library_1.stripQuotes(arg[1]);
                                break;
                            case "HSPACE":
                                e.hspace = arg[1];
                                break;
                            case "VSPACE":
                                e.vspace = arg[1];
                                break;
                            case "ALIGN":
                                e.align = arg[1];
                                break;
                            case "ISMAP":
                                e.ismap = true;
                                break;
                            default:
                                if (x === 0)
                                    e.name = library_1.stripQuotes(args[x]);
                                else if (x === 1)
                                    e.url = library_1.stripQuotes(args[x]);
                                else if (x === 2 && args[x].length > 0)
                                    e.type = args[x];
                                else if (x === 3)
                                    e.h = library_1.stripQuotes(args[x]);
                                else if (x === 4)
                                    e.w = library_1.stripQuotes(args[x]);
                                else if (x === 5)
                                    e.hspace = args[x];
                                else if (x === 6)
                                    e.vspace = args[x];
                                else if (x === 7)
                                    e.align = args[x];
                                break;
                        }
                    }
                    tmp = "";
                    s = ["<img src=\""];
                    if (e.url.length > 0) {
                        s.push(e.url);
                        tmp += e.url;
                        if (!e.url.endsWith("/")) {
                            s.push("/");
                            tmp += "/";
                        }
                    }
                    if (e.t.length > 0) {
                        s.push(e.t);
                        tmp += e.t;
                        if (!e.t.endsWith("/")) {
                            s.push("/");
                            tmp += "/";
                        }
                    }
                    tmp += e.name;
                    s.push(e.name);
                    s.push("\"");
                    s.push(" style=\"");
                    if (e.w.length > 0) {
                        s.push("width:");
                        s.push(e.w);
                        s.push(";");
                    }
                    if (e.h.length > 0) {
                        s.push("height:");
                        s.push(e.h);
                        s.push(";");
                    }
                    switch (e.align.toLowerCase()) {
                        case "left":
                            s.push("float:left;");
                            break;
                        case "right":
                            s.push("float:right;");
                            break;
                        case "top":
                        case "middle":
                        case "bottom":
                            s.push("vertical-align:");
                            s.push(e.align);
                            s.push(";");
                            break;
                    }
                    if (e.hspace.length > 0 && e.vspace.length > 0) {
                        s.push("margin:");
                        if (this.isNumber(e.vspace))
                            e.vspace = parseInt(e.vspace, 10) + "px";
                        s.push(e.vspace, " ");
                        if (this.isNumber(e.hspace))
                            e.hspace = parseInt(e.hspace, 10) + "px";
                        s.push(e.hspace, ";");
                    }
                    else if (e.hspace.length > 0) {
                        s.push("margin:");
                        if (this.isNumber(e.hspace))
                            e.hspace = parseInt(e.hspace, 10) + "px";
                        s.push("0px ", e.hspace, ";");
                    }
                    else if (e.vspace.length > 0) {
                        s.push("margin:");
                        if (this.isNumber(e.vspace))
                            e.vspace = parseInt(e.vspace, 10) + "px";
                        s.push(e.vspace, " 0px;");
                    }
                    s.push("\"");
                    if (e.ismap)
                        s.push(" ismap onclick=\"return false;\"");
                    s.push("/>");
                    //try and preload the image to try and save some time and prevent height issues.
                    var img = new Image();
                    img.src = tmp;
                    return s.join('');
                case "!AT":
                case "!ATTLIST":
                    if (args.length === 0)
                        return null;
                    e = args[0];
                    //not defined or if not from the same orien and not open cant change it
                    if (!this.mxpElements[e] || (this.mxpEntities[e].remote != e.remote && !this.mxpEntities[e].open))
                        return null;
                    //clear out any old ones
                    this.mxpElements[e].attributes = {};
                    this.mxpElements[e].attributeIndexes = [];
                    for (x = 1; x < xl; x++) {
                        sargs = args[x].split('=');
                        if (sargs.length > 1)
                            this.mxpElements[e].attributes[sargs[0].toLowerCase()] = sargs[1];
                        else
                            this.mxpElements[e].attributes[sargs[0].toLowerCase()] = "";
                        this.mxpElements[e].attributeIndexes.push(sargs[0].toLowerCase());
                    }
                    break;
                case "!TAG":
                    e = new Tag();
                    e.remote = remote;
                    for (x = 0; x < xl; x++) {
                        //speical case, as attribute list has = in it so test for it
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case "WINDOWNAME":
                                e.window = library_1.stripQuotes(arg[1]);
                                break;
                            case "FORE":
                                color = new RGBColor(library_1.stripQuotes(arg[1]));
                                if (color.ok)
                                    e.fore = color.toRGB();
                                break;
                            case "BACK":
                                color = new RGBColor(library_1.stripQuotes(arg[1]));
                                if (color.ok)
                                    e.back = color.toRGB();
                                break;
                            case "GAG":
                                e.gag = true;
                                break;
                            case "ENABLE":
                                e.enabled = true;
                                break;
                            case "DISABLE":
                                e.enabled = false;
                                break;
                            default:
                                if (x === 0) {
                                    tmp = parseInt(args[x], 10);
                                    if (!isNaN(tmp))
                                        e.index = tmp;
                                }
                                else if (x === 1)
                                    e.window = library_1.stripQuotes(args[x]);
                                else if (x === 2) {
                                    color = new RGBColor(library_1.stripQuotes(args[x]));
                                    if (color.ok)
                                        e.fore = color.toRGB();
                                }
                                else if (x === 3) {
                                    color = new RGBColor(library_1.stripQuotes(args[x]));
                                    if (color.ok)
                                        e.back = color.toRGB();
                                }
                                break;
                        }
                    }
                    if (e.fore.length > 0 && e.back.length > 0)
                        e.definition = "<C \"" + e.fore + "\" \"" + e.back + "\">";
                    else if (e.fore.length > 0)
                        e.definition = "<C \"" + e.fore + "\">";
                    else if (e.back.length > 0)
                        e.definition = "<C BACK=\"" + e.back + "\">";
                    if (e.definition.length > 0)
                        e.closeDefinition = "</C>";
                    if (this.mxpLines[e.index]) {
                        //mud can over ride local, but local can not override remote
                        if (e.remote || this.mxpLines[e.index].remote == e.remote)
                            this.mxpLines[e.index] = e;
                    }
                    else
                        this.mxpLines[e.index] = e;
                    break;
                case "!EL":
                case "!ELEMENT":
                    e = new Element(remote);
                    for (x = 0; x < xl; x++) {
                        //speical case, as attribute list has = in it so test for it
                        if (args[x].toUpperCase().startsWith("ATT=")) {
                            arg = library_1.stripQuotes(args[x]).substring(4).split(' ');
                            for (s = 0, sl = arg.length; s < sl; s++) {
                                sargs = library_1.stripQuotes(arg[s]).split('=');
                                if (sargs.length > 1)
                                    e.attributes[sargs[0].toLowerCase()] = library_1.stripQuotes(sargs[1]);
                                else
                                    e.attributes[sargs[0].toLowerCase()] = "";
                                e.attributeIndexes.push(sargs[0].toLowerCase());
                            }
                            continue;
                        }
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case "TAG":
                                tmp = parseInt(arg[1], 10);
                                if (!isNaN(tmp))
                                    e.tag = tmp;
                                break;
                            case "FLAG":
                                e.flag = library_1.stripQuotes(arg[1]);
                                break;
                            case "OPEN":
                                e.open = true;
                                break;
                            case "DELETE":
                                if (this.mxpElements[e.name] && (this.mxpEntities[e.name].remote == e.remote || this.mxpEntities[e.name].open))
                                    delete this.mxpEntities[e.name];
                                return null;
                            case "EMPTY":
                                e.empty = true;
                                break;
                            /*
                          case "HIDDEN":
                            e.hidden = true;
                            break;
                            */
                            case "SECURE":
                                e.open = false;
                                break;
                            default:
                                if (x === 0)
                                    e.name = library_1.stripQuotes(args[x]).toUpperCase();
                                else if (x === 1) {
                                    e.definition = library_1.stripQuotes(args[x]);
                                    e.closeDefinition = this.GetCloseTags(e.definition);
                                    if (this.enableDebug)
                                        this.emit('debug', "MXP close defintion: " + e.closeDefinition);
                                }
                                else if (x === 2) {
                                    arg = args[x].substring(4).split(' ');
                                    for (s = 0, sl = arg.length; s < sl; s++) {
                                        sargs = arg[s].split('=');
                                        if (sargs.length > 1)
                                            e.attributes[sargs[0]] = sargs[1];
                                        else
                                            e.attributes[sargs[0]] = "";
                                        e.attributeIndexes.push(sargs[0]);
                                    }
                                }
                                else if (x === 3) {
                                    tmp = parseInt(args[x], 10);
                                    if (!isNaN(tmp))
                                        e.tag = tmp;
                                }
                                else if (x === 4)
                                    e.flag = library_1.stripQuotes(args[x]);
                                break;
                        }
                    }
                    if (e.tag > 19 && e.tag < 100) {
                        tmp = new Tag(e.tag);
                        tmp.element = e.name;
                        if (this.mxpLines[tmp.index]) {
                            //mud can over ride local, but local can not override remote
                            if (e.remote || this.mxpLines[tmp.index].remote == e.remote)
                                this.mxpLines[tmp.index] = tmp;
                        }
                        else
                            this.mxpLines[tmp.index] = tmp;
                    }
                    if (this.mxpElements[e.name]) {
                        //can only override if from same orgine (eg from mud, or from local) or if an open tag
                        if (this.mxpElements[e.name].remote == e.remote || this.mxpEntities[e.name].open)
                            this.mxpElements[e.name] = e;
                    }
                    else
                        this.mxpElements[e.name] = e;
                    break;
                case "!EN":
                case "!ENTITY":
                    e = new Entity(remote);
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case "DESC":
                                e.description = library_1.stripQuotes(arg[1]);
                                break;
                            case "PRIVATE":
                                e.publish = false;
                                break;
                            case "PUBLISH":
                                e.publish = true;
                                break;
                            case "DELETE":
                                //can only modify if from same origin, eg mud can only mod mud, and user can only mod user
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote == e.remote)
                                    delete this.mxpEntities[e.name];
                                return null;
                            case "ADD":
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote == e.remote) {
                                    if (!this.mxpEntities[e.name].value)
                                        this.mxpEntities[e.name].value = e.value;
                                    else
                                        this.mxpEntities[e.name].value += "|" + e.value;
                                    return null;
                                }
                                break;
                            case "REMOVE":
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote == e.remote) {
                                    if (this.mxpEntities[e.name].value) {
                                        sargs = this.mxpEntities[e.name].value.split('|');
                                        sarg = [];
                                        for (s = 0, sl = sargs.length; s < sl; s++) {
                                            if (sargs[s] != e.value)
                                                sarg.push(sargs[s]);
                                        }
                                        this.mxpEntities[e.name].value = sarg.join('|');
                                    }
                                }
                                return null;
                            default:
                                if (x === 0)
                                    e.name = library_1.stripQuotes(args[x]);
                                else if (x === 1)
                                    e.value = library_1.stripQuotes(args[x]);
                                else if (x === 2)
                                    e.description = library_1.stripQuotes(args[x]);
                                break;
                        }
                    }
                    if (this.mxpEntities[e.name]) {
                        if (this.mxpEntities[e.name].remote == e.remote)
                            this.mxpEntities[e.name] = e;
                    }
                    else
                        this.mxpEntities[e.name] = e;
                    break;
                case "/V":
                case "/VAR":
                    tmp = this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                    e = new Entity(remote);
                    e.value = this.mxpState.captured.pop().join('');
                    this.mxpState.capture--;
                    if (this.enableDebug)
                        this.emit('debug', "MXP captured: " + e.value);
                    args = tmp.obj;
                    xl = args.length;
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case "DESC":
                                e.description = library_1.stripQuotes(arg[1]);
                                break;
                            case "PRIVATE":
                                e.publish = false;
                                break;
                            case "PUBLISH":
                                e.publish = true;
                                break;
                            case "DELETE":
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote == e.remote)
                                    delete this.mxpEntities[e.name];
                                return null;
                            case "ADD":
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote == e.remote) {
                                    if (!this.mxpEntities[e.name].value)
                                        this.mxpEntities[e.name].value = e.value;
                                    else
                                        this.mxpEntities[e.name].value += "|" + e.value;
                                    return null;
                                }
                                break;
                            case "REMOVE":
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote == e.remote) {
                                    if (this.mxpEntities[e.name].value) {
                                        sargs = this.mxpEntities[e.name].value.split('|');
                                        sarg = [];
                                        for (s = 0, sl = sargs.length; s < sl; s++) {
                                            if (sargs[s] != e.value)
                                                sarg.push(sargs[s]);
                                        }
                                        this.mxpEntities[e.name].value = sarg.join('|');
                                    }
                                }
                                return null;
                            default:
                                if (x === 0)
                                    e.name = library_1.stripQuotes(args[x]);
                                else if (x === 1)
                                    e.description = library_1.stripQuotes(args[x]);
                                break;
                        }
                    }
                    if (this.mxpEntities[e.name]) {
                        if (this.mxpEntities[e.name].remote == e.remote)
                            this.mxpEntities[e.name] = e;
                    }
                    else
                        this.mxpEntities[e.name] = e;
                    break;
                case "V":
                case "VAR":
                    this.mxpState.captured.push([]);
                    this.mxpState.capture++;
                    tmp = this.GetCurrentStyle();
                    tmp.tag = MXPTag[tag];
                    tmp.obj = args;
                    tmp.custom = "";
                    this.mxpStyles.push(tmp);
                    return null;
                case "GAUGE":
                    e = { value: 0, max: 1, caption: "", color: "" };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case "VALUE":
                                    tmp = parseFloat(this.GetEntity(args[x]));
                                    if (isNaN(tmp))
                                        tmp = this.GetEntity(args[x]);
                                    e.value = tmp;
                                    break;
                                case "MAX":
                                    tmp = parseFloat(this.GetEntity(args[x]));
                                    if (isNaN(tmp))
                                        tmp = this.GetEntity(args[x]);
                                    e.max = tmp;
                                    break;
                                case "CAPTION":
                                    if (arg[x].length > 0)
                                        e.caption = library_1.stripQuotes(args[x]);
                                    break;
                                case "COLOR":
                                    color = new RGBColor(library_1.stripQuotes(arg[1]));
                                    if (color.ok)
                                        e.color = color.toRGB();
                                    break;
                            }
                        }
                        else if (x === 0) {
                            tmp = parseFloat(this.GetEntity(args[x]));
                            if (isNaN(tmp))
                                tmp = this.GetEntity(args[x]);
                            e.value = tmp;
                        }
                        else if (x === 1) {
                            tmp = parseFloat(this.GetEntity(args[x]));
                            if (isNaN(tmp))
                                tmp = this.GetEntity(args[x]);
                            e.max = tmp;
                        }
                        else if (x === 2 && args[x].length > 0)
                            e.caption = library_1.stripQuotes(args[x]);
                        else if (x === 3 && args[x].length > 0) {
                            color = new RGBColor(library_1.stripQuotes(arg[1]));
                            if (color.ok)
                                e.color = color.toRGB();
                        }
                    }
                    this.mxpState.expanded = false;
                    this.emit('gauge', e);
                    break;
                case "STAT":
                    e = { value: 0, max: 1, caption: "" };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case "VALUE":
                                    tmp = parseFloat(this.GetEntity(args[x]));
                                    if (isNaN(tmp))
                                        tmp = this.GetEntity(args[x]);
                                    e.value = tmp;
                                    break;
                                case "MAX":
                                    tmp = parseFloat(this.GetEntity(args[x]));
                                    if (isNaN(tmp))
                                        tmp = this.GetEntity(args[x]);
                                    e.max = tmp;
                                    break;
                                case "CAPTION":
                                    if (arg[x].length > 0)
                                        e.caption = library_1.stripQuotes(args[x]);
                                    break;
                            }
                        }
                        else if (x === 0) {
                            tmp = parseFloat(this.GetEntity(args[x]));
                            if (isNaN(tmp))
                                tmp = this.GetEntity(args[x]);
                            e.value = tmp;
                        }
                        else if (x === 1) {
                            tmp = parseFloat(this.GetEntity(args[x]));
                            if (isNaN(tmp))
                                tmp = this.GetEntity(args[x]);
                            e.max = tmp;
                        }
                        else if (x === 2 && args[x].length > 0)
                            e.caption = library_1.stripQuotes(args[x]);
                    }
                    this.mxpState.expanded = false;
                    this.emit('stat', e);
                    break;
                case "MUSIC":
                    e = { off: false, file: "", url: "", volume: 100, repeat: 1, prioirty: 50, type: "", continue: true };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case "FNAME":
                                    e.file = library_1.stripQuotes(arg[x]);
                                    if (e.file.toLowerCase() == "off") {
                                        e.off = true;
                                        e.file = "";
                                    }
                                    break;
                                case "V":
                                    tmp = parseInt(arg[x], 10);
                                    if (isNaN(tmp))
                                        tmp = 100;
                                    e.volume = tmp;
                                    break;
                                case "L":
                                    tmp = parseInt(arg[x], 10);
                                    if (isNaN(tmp))
                                        tmp = 1;
                                    e.repeat = tmp;
                                    break;
                                case "C":
                                    e.continue = arg[x] != "0";
                                    break;
                                case "T":
                                    if (arg[1].length > 0)
                                        e.type = arg[x];
                                    break;
                                case "U":
                                    e.url = library_1.stripQuotes(arg[x]);
                                    if (!e.url.endsWith("/") && e.url.length > 0)
                                        e.Url += "/";
                                    break;
                            }
                        }
                        else if (x === 0) {
                            e.file = library_1.stripQuotes(args[x]);
                            if (e.file.toLowerCase() == "off") {
                                e.off = true;
                                e.file = "";
                            }
                        }
                        else if (x === 1) {
                            tmp = parseInt(args[x], 10);
                            if (isNaN(tmp))
                                tmp = 100;
                            e.volume = tmp;
                        }
                        else if (x === 2) {
                            tmp = parseInt(args[x], 10);
                            if (isNaN(tmp))
                                tmp = 1;
                            e.repeat = tmp;
                        }
                        else if (x === 3)
                            e.continue = args[x] != "0";
                        else if (x === 4) {
                            if (args[x].length > 0)
                                e.type = args[x];
                        }
                        else if (x === 5) {
                            e.url = library_1.stripQuotes(args[x]);
                            if (!e.url.endsWith("/") && e.url.length > 0)
                                e.Url += "/";
                        }
                    }
                    this.emit('music', e);
                    break;
                case "SOUND":
                    e = { off: false, file: "", url: "", volume: 100, repeat: 1, prioirty: 50, type: "", continue: true };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case "FNAME":
                                    e.file = library_1.stripQuotes(arg[x]);
                                    if (e.file.toLowerCase() == "off") {
                                        e.off = true;
                                        e.file = "";
                                    }
                                    break;
                                case "V":
                                    tmp = parseInt(arg[x], 10);
                                    if (isNaN(tmp))
                                        tmp = 100;
                                    e.volume = tmp;
                                    break;
                                case "L":
                                    tmp = parseInt(arg[x], 10);
                                    if (isNaN(tmp))
                                        tmp = 1;
                                    e.repeat = tmp;
                                    break;
                                case "P":
                                    tmp = parseInt(arg[x], 10);
                                    if (isNaN(tmp))
                                        tmp = 1;
                                    e.prioirty = tmp;
                                    break;
                                case "T":
                                    if (arg[x].length > 0)
                                        e.type = arg[x];
                                    break;
                                case "U":
                                    e.url = library_1.stripQuotes(arg[x]);
                                    if (!e.url.endsWith("/") && e.url.length > 0)
                                        e.Url += "/";
                                    break;
                            }
                        }
                        else if (x === 0) {
                            e.file = library_1.stripQuotes(args[x]);
                            if (e.file.toLowerCase() == "off") {
                                e.off = true;
                                e.file = "";
                            }
                        }
                        else if (x === 1) {
                            tmp = parseInt(args[x], 10);
                            if (isNaN(tmp))
                                tmp = 100;
                            e.volume = tmp;
                        }
                        else if (x === 2) {
                            tmp = parseInt(args[x], 10);
                            if (isNaN(tmp))
                                tmp = 1;
                            e.repeat = tmp;
                        }
                        else if (x === 3) {
                            tmp = parseInt(args[x], 10);
                            if (isNaN(tmp))
                                tmp = 1;
                            e.prioirty = tmp;
                        }
                        else if (x === 4) {
                            if (args[x].length > 0)
                                e.type = args[x];
                        }
                        else if (x === 5) {
                            e.url = library_1.stripQuotes(args[x]);
                            if (!e.url.endsWith("/") && e.url.length > 0)
                                e.Url += "/";
                        }
                    }
                    this.emit('sound', e);
                    break;
                case "EXPIRE":
                    var self = this;
                    setTimeout(function () { self.emit('expireLinks', args); }, 1);
                    break;
                case "VERSION":
                    if (xl > 0)
                        this.StyleVersion = args[0];
                    else
                        this.emit('MXPTagReply', tag, []);
                    break;
                case "USER":
                case "PASSWORD":
                    this.emit('MXPTagReply', tag, args);
                    break;
                case "SUPPORT":
                    sargs = [];
                    if (xl > 0) {
                        for (x = 0; x < xl; x++) {
                            arg = library_1.stripQuotes(args[x]);
                            if (arg.indexOf(".") == -1) {
                                arg = arg.toUpperCase();
                                switch (arg) {
                                    case "HR":
                                    case "A":
                                    case "SEND":
                                    case "B":
                                    case "I":
                                    case "COLOR":
                                    case "C":
                                    case "EM":
                                    case "ITALIC":
                                    case "STRONG":
                                    case "BOLD":
                                    case "UNDERLINE":
                                    case "U":
                                    case "S":
                                    case "STRIKEOUT":
                                    case "STRIKE":
                                    case "H":
                                    case "HIGH":
                                    case "FONT":
                                    case "EXPIRE":
                                    case "VERSION":
                                    case "SUPPORT":
                                    case "NOBR":
                                    case "P":
                                    case "BR":
                                    case "SBR":
                                    case "SOUND":
                                    case "MUSIC":
                                    case "VAR":
                                    case "USER":
                                    case "PASSWORD":
                                    case "H1":
                                    case "H2":
                                    case "H3":
                                    case "H4":
                                    case "H5":
                                    case "H6":
                                    case "IMAGE":
                                    case "RESET":
                                    case "GAUGE":
                                    case "STAT":
                                        sargs.push("+" + name);
                                        break;
                                    default:
                                        sargs.push("-" + name);
                                        break;
                                }
                            }
                            else {
                                arg = args[x].split('.');
                                arg[0] = arg[0].toUpperCase();
                                switch (arg[0]) {
                                    case "IMAGE":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+image.fname");
                                            sargs.push("+image.url");
                                            sargs.push("+image.t");
                                            sargs.push("+image.h");
                                            sargs.push("+image.w");
                                            sargs.push("+image.hspace");
                                            sargs.push("+image.vspace");
                                            sargs.push("+image.align");
                                            sargs.push("+image.ismap");
                                        }
                                        break;
                                    case "SOUND":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+sound.v");
                                            sargs.push("+sound.l");
                                            sargs.push("+sound.p");
                                            sargs.push("+sound.t");
                                            sargs.push("+sound.u");
                                        }
                                        break;
                                    case "MUSIC":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+music.v");
                                            sargs.push("+music.l");
                                            sargs.push("+music.c");
                                            sargs.push("+music.t");
                                            sargs.push("+music.u");
                                        }
                                        break;
                                    case "A":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+a.href");
                                            sargs.push("+a.hint");
                                            sargs.push("+a.expire");
                                        }
                                        break;
                                    case "SEND":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+send.href");
                                            sargs.push("+send.hint");
                                            sargs.push("+send.prompt");
                                            sargs.push("+send.expire");
                                        }
                                        break;
                                    case "COLOR":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+color.fore");
                                            sargs.push("+color.back");
                                        }
                                        break;
                                    case "C":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+c.fore");
                                            sargs.push("+c.back");
                                        }
                                        break;
                                    case "FONT":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+font.face");
                                            sargs.push("+font.size");
                                            sargs.push("+font.color");
                                            sargs.push("+font.back");
                                        }
                                        break;
                                    case "EXPIRE":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else
                                            sargs.push("+expire.Name");
                                        break;
                                    case "GAUGE":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+gauge.max");
                                            sargs.push("+gauge.caption");
                                            sargs.push("+gauge.color");
                                        }
                                        break;
                                    case "STAT":
                                        if (arg[1] != "*")
                                            sargs.push("+" + arg[0] + "." + arg[1]);
                                        else {
                                            sargs.push("+stat.max");
                                            sargs.push("+stat.caption");
                                        }
                                        break;
                                    default:
                                        if (arg[1] != "*")
                                            sargs.push("-" + arg[0] + "." + arg[1]);
                                        else
                                            sargs.push("-" + arg[0]);
                                        break;
                                }
                            }
                        }
                    }
                    else
                        this.emit('MXPTagReply', tag, ["+A", "+SEND", "+B", "+I", "+COLOR", "+C", "+EM", "+ITALIC", "+STRONG", "+BOLD", "+UNDERLINE", "+U", "+S", "+STRIKEOUT", "+H", "+HIGH", "+FONT", "+EXPIRE", "+VERSION", "+SUPPORT", "+NOBR", "+P", "+BR", "+SBR", "+VAR", "+SOUND", "+MUSIC", "+USER", "+PASSWORD", "+RESET", "+STRIKE", "+H1", "+H2", "+H3", "+H4", "+H5", "+H6", "+IMAGE", "+STAT", "+GAUGE"]);
                    break;
                case "A":
                    tmp = this.GetCurrentStyle();
                    tmp.tag = MXPTag[tag];
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case "HREF":
                                    href = library_1.stripQuotes(arg[1]);
                                    break;
                                case "HINT":
                                    hint = library_1.stripQuotes(arg[1]);
                                    break;
                                case "EXPIRE":
                                    expire = library_1.stripQuotes(arg[1]);
                                    break;
                                default:
                                    if (this.enableDebug)
                                        this.emit('debug', "Invalid Argument for " + tag + ": " + arg[0]);
                                    break;
                            }
                        }
                        else if (x === 0)
                            href = library_1.stripQuotes(args[x]);
                        else if (x === 1)
                            hint = library_1.stripQuotes(args[x]);
                        else if (x === 2)
                            expire = library_1.stripQuotes(args[x]);
                    }
                    tmp.custom = "";
                    this.mxpStyles.push(tmp);
                    if (hint.length === 0)
                        hint = href;
                    if (expire.length > 0)
                        return "<a class=\"MXPLink\" href=\"javascript:void(0);\" title=\"" + hint + "\" expire=\"" + expire + "\" onclick=\"" + this.mxpLinkFunction + "(this, '" + href + "');return false;\">";
                    return "<a class=\"MXPLink\" href=\"javascript:void(0);\" title=\"" + hint + "\" onclick=\"" + this.mxpLinkFunction + "(this, '" + href + "');return false;\">";
                case "SEND":
                    tmp = this.GetCurrentStyle();
                    tmp.tag = MXPTag[tag];
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg[0] == "PROMPT")
                            prompt = true;
                        else if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case "HREF":
                                    href = library_1.stripQuotes(arg[1]);
                                    break;
                                case "HINT":
                                    hint = library_1.stripQuotes(arg[1]);
                                    break;
                                case "EXPIRE":
                                    expire = library_1.stripQuotes(arg[1]);
                                    break;
                                case "PROMPT":
                                    prompt = true;
                                    break;
                                default:
                                    if (this.enableDebug)
                                        this.emit('debug', "Invalid Argument for " + tag + ": " + arg[0]);
                                    break;
                            }
                        }
                        else if (x === 0)
                            href = library_1.stripQuotes(args[x]);
                        else if (x === 1)
                            hint = library_1.stripQuotes(args[x]);
                        else if (x === 2)
                            prompt = true;
                        else if (x === 3)
                            expire = library_1.stripQuotes(args[x]);
                    }
                    tmp.custom = "";
                    this.mxpStyles.push(tmp);
                    if (href.length === 0)
                        href = "&text;";
                    if (hint.length === 0)
                        hint = href;
                    var cmds = href.split("|");
                    var tt = 0;
                    if (cmds.length > 1) {
                        var caps = hint.split("|");
                        if (caps.length == cmds.length + 1) {
                            hint = caps[0];
                            caps.shift();
                            tt = "['" + caps.join('\',\'') + "']";
                        }
                        href = "['" + cmds.join('\',\'') + "']";
                    }
                    else
                        href = '\'' + href + '\'';
                    var l = ["<a class=\"MXPLink\" href=\"javascript:void(0);\" onclick=\"" + this.mxpSendFunction + "(event||window.event, this, ", href, ", ", (prompt ? 1 : 0), ", ", tt, ");return false;\" title=\"", hint, "\" onmouseover=\"" + this.mxpTooltipFunction + "(this)\""];
                    if (expire.length > 0)
                        l.push(" expire=\"", expire, "\"");
                    l.push(">");
                    return l.join('');
                case "H1":
                case "H2":
                case "H3":
                case "H4":
                case "H5":
                case "H6":
                    tmp = this.GetCurrentStyle();
                    tmp.tag = MXPTag[tag];
                    tmp.style |= FontStyle.Bold;
                    tmp.custom = "";
                    this.mxpStyles.push(tmp);
                    return null;
                case "/A":
                case "/SEND":
                    this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                    return "</a>";
                case "/H1":
                case "/H2":
                case "/H3":
                case "/H4":
                case "/H5":
                case "/H6":
                    this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                    return null;
                case "NOBR":
                    this.mxpState.noBreak = true;
                    return null;
                case "/P":
                    this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                    this.mxpState.paragraph = false;
                    return null;
                case "P":
                    tmp = this.GetCurrentStyle();
                    tmp.tag = MXPTag[tag];
                    tmp.custom = "";
                    this.mxpStyles.push(tmp);
                    this.mxpState.paragraph = true;
                    return null;
                case "SBR":
                    return "<wbr> ";
                case "RESET":
                    this.ResetMXP();
                    return null;
                case "HR":
                    var colors = this.getColors();
                    return "<div class=\"line ansiback" + colors.bcode + "\" style=\"position:relative;background-color:" + colors.back + "\"> <div style=\"position:absolute;top: 49%;height:4px;width:100%;background-color:" + colors.fore + "\" class=\" ansifore" + colors.fcode + "\"><hr/></div></div>";
            }
        }
        if (this.mxpElements[tag]) {
            e = this.mxpElements[tag];
            //not open and not in correct lineType
            if (!e.open && this.mxpState.lineType != lineType.Secure && this.mxpState.lineType != lineType.LockSecure && this.mxpState.lineType != lineType.TempSecure)
                return null;
            tmp = this.GetCurrentStyle();
            tmp.tag = MXPTag.Custom;
            tmp.custom = e.name;
            arg = e.definition;
            sargs = {};
            //setup default values
            for (s = 0, sl = e.attributeIndexes.length; s < sl; s++)
                sargs[e.attributeIndexes[s]] = e.attributes[e.attributeIndexes[s]];
            //change any based on passed argument
            for (x = 0; x < xl; x++) {
                sarg = args[x].split('=');
                sarg[0] = sarg[0].toLowerCase();
                if (e.attributes[sarg[0]])
                    sargs[sarg[0]] = sarg[1];
                else if (x < e.attributeIndexes.length)
                    sargs[e.attributeIndexes[x]] = sarg[0];
            }
            for (sarg in sargs) {
                if (!sargs.hasOwnProperty(sarg))
                    continue;
                arg = arg.replace("&" + sarg + ";", sargs[sarg]);
            }
            if (!e.empty) {
                this.mxpState.captured.push([]);
                this.mxpState.capture++;
            }
            //mxpState.hidden = e.hidden;
            if (e.tag > 19 && e.tag < 100 && this.mxpLines[e.tag].enabled && this.mxpLines[e.tag].definition.length > 0) {
                arg = this.mxpLines[e.tag].definition + arg;
                tmp.gagged = this.mxpLines[e.tag].gag;
            }
            this.mxpState.gagged = tmp.gagged;
            this.mxpState.expanded = true;
            this.mxpStyles.push(tmp);
            return arg;
        }
        else if (tag.startsWith("/") && this.mxpElements[tag.substring(1)] && !this.mxpElements[tag.substring(1)].empty) {
            tag = tag.substring(1);
            e = this.mxpElements[tag];
            //not open and not in correct lineType
            if (!e.open && this.mxpState.lineType != lineType.Secure && this.mxpState.lineType != lineType.LockSecure && this.mxpState.lineType != lineType.TempSecure)
                return null;
            //get captured text]
            if (!e.empty && this.mxpState.capture > 0) {
                sarg = this.mxpState.captured.pop().join('');
                this.mxpState.capture--;
            }
            //tmp = ClearMXPToTag(MXPTag.Custom, tag);
            arg = e.closeDefinition;
            if (e.flag.length > 0) {
                if (e.flag.length > 4 && e.flag.toLowerCase().startsWith("set "))
                    this.emit('setVariable', e.flag.substring(4), sarg);
                this.emit('MXPFlag', e.flag, sarg);
            }
            if (e.tag > 19 && e.tag < 100 && this.mxpLines[e.tag].enabled && this.mxpLines[e.tag].closeDefinition.length > 0)
                arg += this.mxpLines[e.tag].closeDefinition;
            this.mxpState.gagged = !e.gagged;
            if (e.empty)
                return null;
            this.mxpState.expanded = true;
            return arg;
        }
        return null;
    }
    GetCloseTags(tag) {
        if (typeof tag == "undefined" || tag.length === 0)
            return "";
        var idx = 0, tl = tag.length;
        var ts = [], str = [];
        var c, i;
        var state = 0;
        for (; idx < tl; idx++) {
            c = tag.charAt(idx);
            switch (state) {
                case 1:
                    if (c == ' ') {
                        ts.push(str.join(''));
                        str = [];
                        state = 2;
                    }
                    else if (c == '>') {
                        ts.push(str.join(''));
                        str = [];
                        state = 0;
                    }
                    else
                        str.push(c);
                    break;
                case 2:
                    //ignore every thing til a >
                    if (c == '>')
                        state = 0;
                    break;
                default:
                    //only care about tags
                    if (c == '<')
                        state = 1;
                    break;
            }
        }
        if (state == 1)
            ts.push(str.join(''));
        if (ts.length === 0)
            return "";
        return "</" + ts.reverse().join('></') + ">";
    }
    GetCurrentStyle() {
        var tmp;
        if (this.mxpStyles.length === 0)
            this.mxpStyles.push(new MXPStyle(FontStyle.None, "", "", false));
        tmp = this.mxpStyles[this.mxpStyles.length - 1];
        if (this.mxpLines[this.mxpState.lineType] && this.mxpLines[this.mxpState.lineType].enabled)
            tmp.gagged = this.mxpLines[this.mxpState.lineType].gag;
        return library_1.clone(tmp);
    }
    DecreaseColor(clr, p) {
        var color = new RGBColor(clr);
        if (!color.ok)
            return clr;
        color.b -= Math.ceil(color.b * p);
        if (color.b < 0)
            color.b = 0;
        color.g -= Math.ceil(color.g * p);
        if (color.g < 0)
            color.g = 0;
        color.r -= Math.ceil(color.r * p);
        if (color.r < 0)
            color.r = 0;
        return color.toRGB();
    }
    IncreaseColor(clr, p) {
        var color = new RGBColor(clr);
        if (!color.ok)
            return clr;
        color.b += Math.ceil(color.b * p);
        if (color.b > 255)
            color.b = 255;
        color.g += Math.ceil(color.g * p);
        if (color.g > 255)
            color.g = 255;
        color.r += Math.ceil(color.r * p);
        if (color.r > 255)
            color.r = 255;
        return color.toRGB();
    }
    MXPCapture(str) {
        if (this.mxpState.capture < 1)
            return;
        for (var i = 0, il = this.mxpState.captured.length; i < il; i++)
            this.mxpState.captured[i].push(str);
    }
    MXPDeCapture(cnt) {
        if (this.mxpState.capture < 1)
            return;
        for (var i = 0, il = this.mxpState.captured.length; i < il; i++) {
            for (var p = 0; p < cnt; p++)
                this.mxpState.captured[i].pop();
        }
    }
    isNumber(str) {
        return (/^\d+$/).test(str);
    }
    /**
     * CurrentAnsiCode - return an ansi formated code based on current ansi state
     *
     * @returns {String}
     */
    CurrentAnsiCode() {
        var ansi = "\x1b[";
        if (typeof this._CurrentForeColor === "string")
            ansi += "38;2;" + this._CurrentForeColor;
        else if (this._CurrentForeColor <= -16)
            ansi += "38;5;" + (this._CurrentForeColor * -1 - 16) + ";";
        else
            ansi += this._CurrentForeColor + ";";
        if (typeof this._CurrentBackColor === "string")
            ansi += "48;2;" + this._CurrentBackColor;
        else if (this._CurrentBackColor <= -16)
            ansi += "38;5;" + (this._CurrentBackColor * -1 - 16) + ";";
        else
            ansi += this._CurrentBackColor + ";";
        if (this._CurrentAttributes > 0) {
            if ((this._CurrentAttributes & FontStyle.Inverse) == FontStyle.Inverse)
                ansi += "7;";
            if ((this._CurrentAttributes & FontStyle.Bold) == FontStyle.Bold)
                ansi += "1;";
            if ((this._CurrentAttributes & FontStyle.Italic) == FontStyle.Italic)
                ansi += "3;";
            if ((this._CurrentAttributes & FontStyle.Underline) == FontStyle.Underline)
                ansi += "4;";
            if ((this._CurrentAttributes & FontStyle.Slow) == FontStyle.Slow)
                ansi += "5;";
            if ((this._CurrentAttributes & FontStyle.Rapid) == FontStyle.Rapid)
                ansi += "6;";
            if ((this._CurrentAttributes & FontStyle.Strikeout) == FontStyle.Strikeout)
                ansi += "9;";
            if ((this._CurrentAttributes & FontStyle.Faint) == FontStyle.Faint)
                ansi += "2;";
            if ((this._CurrentAttributes & FontStyle.DoubleUnderline) == FontStyle.DoubleUnderline)
                ansi += "21;";
            if ((this._CurrentAttributes & FontStyle.Overline) == FontStyle.Overline)
                ansi += "53;";
        }
        return ansi + "m";
    }
    ;
    parse(text, remote, force) {
        if (text === null || text.length === 0)
            return text;
        if (remote == null)
            remote = false;
        var _TermTitle = "";
        var _TermTitleType = null;
        var _AnsiParams = null;
        var strBuilder = ["<span class=\"line\">"];
        var state = ParserState.None;
        var pState = ParserState.None;
        var lineLength = 0;
        var itmp, _MXPTag, _MXPEntity, _MXPComment, _MXPArgs, skip = false;
        //query data in case already parsing
        if (this.parsing.length > 0 && !force) {
            this.parsing.push([text, remote]);
            return;
        }
        this.parsing.unshift([text, remote]);
        //store remote state as mxp requires it
        //not end of line but text, so fragment, reget and reparse to ensure proper triggering
        if (!this.EndofLine && this.TextLength > 0) {
            var lines;
            if (this.display && this.display !== null)
                lines = this.display.children(".line");
            else
                lines = $("#display .line");
            var line = lines[lines.length - 1];
            strBuilder.push($(line).html());
            $(line).remove();
            line = null;
            lines = null;
        }
        strBuilder.push(this.StartDisplayBlock());
        if (this._SplitBuffer.length > 0) {
            text = this._SplitBuffer + text;
            this._SplitBuffer = "";
        }
        var idx = 0, tl = text.length;
        var c, i, e = this.emulateControlCodes;
        var d = this.displayControlCodes;
        var f = this.emulateTerminal;
        var u = this.enableURLDetection;
        var s = this.enableMSP;
        var lnk = 0;
        var llnk = 0;
        var lnest = null;
        var p, pl = this.protocols.length;
        try {
            for (idx = 0; idx < tl; idx++) {
                c = text.charAt(idx);
                i = text.charCodeAt(idx);
                switch (state) {
                    case ParserState.AnsiParams:
                        if (c === 'C' ||
                            c === 'K' ||
                            c === 's' ||
                            c === 'u' ||
                            c === 'l' ||
                            c === 'h' ||
                            c === 'A' ||
                            c === 'B' ||
                            c === 'D' ||
                            c === 'E' ||
                            c === 'F' ||
                            c === 'f' ||
                            c === 'G' ||
                            c === 'H' ||
                            c === 'n' ||
                            c === 'S' ||
                            c === 'T' ||
                            c === 'r' //SET SCROLLING REGION
                        ) {
                            this.ResetMXP();
                            this._SplitBuffer = "";
                            _AnsiParams = null;
                            state = ParserState.None;
                        }
                        else if (c === 'z') {
                            //incase they put in a ; like e[1;z, e[1;7z or even e[;1z
                            _MXPTag = _AnsiParams.split(';');
                            //we only want the last valid #
                            //start as 0 incause invalid # or code
                            _AnsiParams = 0;
                            for (var mt = _MXPTag.length - 1; mt >= 0; mt--) {
                                if (_MXPTag[mt].length > 0) {
                                    _AnsiParams = _MXPTag[0];
                                    break;
                                }
                            }
                            itmp = parseInt(_AnsiParams, 10);
                            if (isNaN(itmp))
                                itmp = 0;
                            this.mxpState.on = true;
                            this.mxpState.noBreak = false;
                            this.mxpState.paragraph = false;
                            if (this.mxpState.lineType === lineType.Open)
                                this.ResetMXP();
                            switch (itmp) {
                                case 2:
                                    this.mxpState.on = false;
                                    this.mxpState.locked = false;
                                    this.mxpState.lineType = lineType.Locked;
                                    break;
                                case 3:
                                    this.ResetMXP();
                                    break;
                                case 4:
                                    this.mxpState.lineType = lineType.TempSecure;
                                    if (idx + 1 >= tl) {
                                        this._SplitBuffer += c;
                                        break;
                                    }
                                    var ct = text.charAt(idx + 1);
                                    if (ct != '<') {
                                        this.mxpState.lineType = lineType.Open;
                                        this.mxpState.on = false;
                                    }
                                    this.mxpState.locked = false;
                                    break;
                                case 5:
                                    this.iMXPDefaultMode = lineType.Open;
                                    this.mxpState.locked = true;
                                    this.mxpState.lineType = lineType.LockOpen;
                                    break;
                                case 6:
                                    this.iMXPDefaultMode = lineType.Secure;
                                    this.mxpState.lineType = lineType.LockSecure;
                                    this.mxpState.locked = true;
                                    break;
                                case 7:
                                    this.iMXPDefaultMode = lineType.Locked;
                                    this.mxpState.lineType = lineType.LockLocked;
                                    this.mxpState.locked = true;
                                    break;
                                default:
                                    //invalid line so reset
                                    if (itmp < 0 || itmp > 99)
                                        this.ResetMXP();
                                    else {
                                        this.mxpState.lineType = itmp;
                                        this.mxpState.locked = false;
                                        //custom element linked totag so epanded itinto the line
                                        if (this.mxpLines[this.mxpState.lineType] && this.mxpLines[this.mxpState.lineType].enabled) {
                                            //strBuilder.push(EndDisplayBlock());
                                            //strBuilder.push(StartDisplayBlock());
                                            itmp = "";
                                            if (this.mxpLines[this.mxpState.lineType].element.length > 0)
                                                itmp += "<" + this.mxpLines[this.mxpState.lineType].element + ">";
                                            if (this.mxpLines[this.mxpState.lineType].definition.length > 0)
                                                itmp += this.mxpLines[this.mxpState.lineType].definition;
                                            if (itmp.length > 0) {
                                                text = text.splice(idx + 1, itmp);
                                                tl = text.length;
                                            }
                                        }
                                    }
                                    break;
                            }
                            this._SplitBuffer = "";
                            _AnsiParams = null;
                            state = ParserState.None;
                        }
                        else if (c === 'J') {
                            this.ResetMXP();
                            if (_AnsiParams.length > 0) {
                                if (parseInt(_AnsiParams, 10) == 2) {
                                    lineLength = 0;
                                    itmp = this.window.height;
                                    for (var j = 0; j < itmp; j++) {
                                        strBuilder.push("<br/>");
                                        this.MXPCapture("\n");
                                    }
                                    strBuilder.push("</div>");
                                    this.AddLine(strBuilder.join(''), false, false);
                                    strBuilder = ["<div class=\"line\">"];
                                    this.TextLength += itmp;
                                    this.mxpState.noBreak = false;
                                }
                            }
                            this._SplitBuffer = "";
                            _AnsiParams = null;
                            state = ParserState.None;
                        }
                        else if (c === 'm') {
                            strBuilder.push(this.EndDisplayBlock());
                            this.ProcessAnsiColorParams(_AnsiParams.split(';'));
                            strBuilder.push(this.StartDisplayBlock());
                            this._SplitBuffer = "";
                            _AnsiParams = null;
                            state = ParserState.None;
                        }
                        else {
                            this._SplitBuffer += c;
                            _AnsiParams += c;
                        }
                        break;
                    case ParserState.XTermTitle:
                        if (i == 7) {
                            this._SplitBuffer = "";
                            this.emit('setTitle', _TermTitle, _TermTitleType === null ? 0 : _TermTitleType);
                            _TermTitle = "";
                            _TermTitleType = null;
                            state = ParserState.None;
                        }
                        else if (c === ";" && _TermTitleType === null) {
                            _TermTitleType = parseInt(_TermTitle, 10);
                            if (isNaN(_TermTitleType))
                                _TermTitleType = 0;
                            _TermTitle = "";
                            this._SplitBuffer += c;
                        }
                        else if (c === '\x1b') {
                            if (this._SplitBuffer.charAt(this._SplitBuffer.length - 1) === '\n')
                                this._SplitBuffer = "";
                        }
                        else {
                            this._SplitBuffer += c;
                            _TermTitle += c;
                        }
                        break;
                    case ParserState.Ansi:
                        if (c === '[') {
                            this._SplitBuffer += c; //store in split buffer incase split command
                            _AnsiParams = "";
                            state = ParserState.AnsiParams;
                        }
                        else if (c === ']') {
                            this._SplitBuffer += c; //store in split buffer incase split command
                            _TermTitle = "";
                            state = ParserState.XTermTitle;
                        }
                        else if (c === 'D' ||
                            c === 'E' ||
                            c === 'M' ||
                            c === '1' ||
                            c === '2' ||
                            c === '7' ||
                            c === '8' ||
                            c === '>' ||
                            c === '=' ||
                            /*
                            *LINE SIZE COMMANDS
                            *<ESC>#3 Change current line to double-height top half
                            *<ESC>#4 Change current line to double-height bottom half
                            *<ESC>#5 Change current line to single-width single-height (normal)
                            *<ESC>#6 Change current line to double-width single-height
                            */
                            c === '#') {
                            if (d) {
                                if (i < 16) {
                                    strBuilder.push("&#x240", i.toString(16), ";");
                                    this.MXPCapture("&#x240" + i.toString(16) + ";");
                                }
                                else {
                                    strBuilder.push("&#x241B&#x24", i.toString(16), ";");
                                    this.MXPCapture("&#x241B&#x24" + i.toString(16) + ";");
                                }
                                lineLength += 2;
                                this.TextLength += 2;
                                this.mxpState.noBreak = false;
                            }
                            state = ParserState.None;
                            this._SplitBuffer = "";
                        }
                        break;
                    case ParserState.MXPTag:
                        if (_MXPTag === "!--") {
                            idx--;
                            pState = ParserState.None;
                            state = ParserState.MXPComment;
                            _MXPComment = "<!--";
                            _MXPTag = "";
                            _MXPArgs = [];
                        }
                        else if (_MXPTag.endsWith("<!--")) {
                            idx--;
                            pState = state;
                            state = ParserState.MXPComment;
                            _MXPComment = "<!--";
                            _MXPTag = _MXPTag.substring(0, _MXPTag.length - 4);
                            _MXPArgs = [];
                        }
                        else if (c === '"') {
                            state = ParserState.MXPTagDblQuoted;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                            this._SplitBuffer += c;
                        }
                        else if (c === '\'') {
                            state = ParserState.MXPTagQuoted;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                            this._SplitBuffer += c;
                        }
                        else if (c === '&') {
                            _MXPEntity = "";
                            pState = state;
                            state = ParserState.MXPEntity;
                            this._SplitBuffer = "";
                        }
                        else if (c === '\n' || c === '\x1b') {
                            idx--;
                            //Abnormal end, discard
                            state = ParserState.None;
                            this._SplitBuffer = "";
                        }
                        else if (c === ' ') {
                            state = ParserState.MXPTagArg;
                            _MXPArgs.push("");
                            this._SplitBuffer += c;
                        }
                        else if (c === '>') {
                            if (_MXPTag.toUpperCase() === "HR" && (this.mxpState.lineType === lineType.Secure || this.mxpState.lineType === lineType.LockSecure || this.mxpState.lineType === lineType.TempSecure)) {
                                strBuilder.push(this.EndDisplayBlock());
                                if (lineLength > 0) {
                                    lineLength = 0;
                                    strBuilder.push("<br></span>");
                                    this.MXPCapture("\n");
                                    this.AddLine(strBuilder.join(''), false, false);
                                }
                                //skip = true;
                                strBuilder = [this.ParseMXPTag(_MXPTag, [], remote)];
                                this.AddLine(strBuilder.join(''), false, false);
                                this.TextLength++;
                                strBuilder = ["<span class=\"line\">", this.StartDisplayBlock()];
                            }
                            else if (_MXPTag.toUpperCase() === "BR" && (this.mxpState.lineType === lineType.Secure || this.mxpState.lineType === lineType.LockSecure || this.mxpState.lineType === lineType.TempSecure)) {
                                lineLength = 0;
                                strBuilder.push(this.EndDisplayBlock(), "<br></span>");
                                this.MXPCapture("\n");
                                this.AddLine(strBuilder.join(''), false, false);
                                skip = false;
                                strBuilder = ["<span class=\"line\">", this.StartDisplayBlock()];
                                this.TextLength++;
                            }
                            else if (_MXPTag.toUpperCase() === "IMAGE" && (this.mxpState.lineType === lineType.Secure || this.mxpState.lineType === lineType.LockSecure || this.mxpState.lineType === lineType.TempSecure)) {
                                strBuilder.push(this.EndDisplayBlock());
                                _MXPTag = this.ParseMXPTag(_MXPTag, _MXPArgs, remote);
                                if (_MXPTag !== null && _MXPTag.length > 0) {
                                    strBuilder.push(_MXPTag);
                                    lineLength += _MXPTag.length;
                                    this.TextLength += _MXPTag.length;
                                }
                                strBuilder.push(this.StartDisplayBlock());
                            }
                            else {
                                _MXPTag = this.ParseMXPTag(_MXPTag, [], remote);
                                if (this.mxpState.expanded) {
                                    if (_MXPTag !== null)
                                        text = text.splice(idx + 1, _MXPTag);
                                    tl = text.length;
                                    this.mxpState.expanded = false;
                                    state = ParserState.None;
                                    _MXPTag = "";
                                    continue;
                                }
                                if (_MXPTag != "</a>") {
                                    strBuilder.push(this.EndDisplayBlock());
                                    strBuilder.push(this.StartDisplayBlock());
                                }
                                if (_MXPTag !== null && _MXPTag.length > 0) {
                                    strBuilder.push(_MXPTag);
                                    lineLength += _MXPTag.length;
                                    this.TextLength += _MXPTag.length;
                                }
                            }
                            state = ParserState.None;
                            this._SplitBuffer = "";
                        }
                        else {
                            this._SplitBuffer += c;
                            _MXPTag += c;
                        }
                        break;
                    case ParserState.MXPTagQuoted:
                        if (c === '\'') {
                            state = ParserState.MXPTagArg;
                            this._SplitBuffer += c;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        }
                        else {
                            this._SplitBuffer += c;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        }
                        break;
                    case ParserState.MXPTagDblQuoted:
                        if (c === '"') {
                            state = ParserState.MXPTagArg;
                            this._SplitBuffer += c;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        }
                        else {
                            this._SplitBuffer += c;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        }
                        break;
                    case ParserState.MXPTagArg:
                        if (c === '\'') {
                            state = ParserState.MXPTagQuoted;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                            this._SplitBuffer += c;
                        }
                        else if (c === '"') {
                            state = ParserState.MXPTagDblQuoted;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                            this._SplitBuffer += c;
                        }
                        else if (c === '\n' || c === '\x1b') {
                            idx--;
                            //Abnormal end, discard
                            state = ParserState.None;
                            this._SplitBuffer = "";
                        }
                        else if (c === ' ') {
                            state = ParserState.MXPTagArg;
                            _MXPArgs.push("");
                            this._SplitBuffer += c;
                        }
                        else if (c === '>') {
                            if (_MXPTag.toUpperCase() === "IMAGE" && (this.mxpState.lineType === lineType.Secure || this.mxpState.lineType === lineType.LockSecure || this.mxpState.lineType === lineType.TempSecure)) {
                                strBuilder.push(this.EndDisplayBlock());
                                _MXPTag = this.ParseMXPTag(_MXPTag, _MXPArgs, remote);
                                if (_MXPTag !== null && _MXPTag.length > 0) {
                                    strBuilder.push(_MXPTag);
                                    lineLength += _MXPTag.length;
                                    this.TextLength += _MXPTag.length;
                                }
                                strBuilder.push(this.StartDisplayBlock());
                            }
                            else {
                                strBuilder.push(this.EndDisplayBlock());
                                _MXPTag = this.ParseMXPTag(_MXPTag, _MXPArgs, remote);
                                if (this.mxpState.expanded) {
                                    if (_MXPTag !== null)
                                        text = text.splice(idx + 1, _MXPTag);
                                    tl = text.length;
                                    this.mxpState.expanded = false;
                                    state = ParserState.None;
                                    continue;
                                }
                                strBuilder.push(this.StartDisplayBlock());
                                if (_MXPTag !== null && _MXPTag.length > 0) {
                                    strBuilder.push(_MXPTag);
                                    lineLength += _MXPTag.length;
                                    this.TextLength += _MXPTag.length;
                                }
                            }
                            state = ParserState.None;
                            this._SplitBuffer = "";
                        }
                        else {
                            this._SplitBuffer += c;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        }
                        break;
                    case ParserState.MXPEntity:
                        if (c === '\n' || c === '\x1b') {
                            idx--;
                            if (this.enableDebug)
                                this.emit('debug', "MXP Entity: " + _MXPEntity);
                            if (pState == ParserState.MXPTag) {
                                _MXPTag += "&" + _MXPEntity;
                                state = pState;
                            }
                            else {
                                _MXPEntity = this.GetEntity(_MXPEntity);
                                if (this.mxpState.expanded) {
                                    if (_MXPTag !== null)
                                        text = text.splice(idx + 1, _MXPEntity);
                                    tl = text.length;
                                    this.mxpState.expanded = false;
                                    state = ParserState.None;
                                    continue;
                                }
                                strBuilder.push("&");
                                strBuilder.push(_MXPEntity);
                                this.MXPCapture("&" + _MXPEntity);
                                lineLength++;
                                this.TextLength++;
                                this.mxpState.noBreak = false;
                                //Abnormal end, send as is
                                state = ParserState.None;
                                this._SplitBuffer = "";
                            }
                        }
                        else if (c === ';') {
                            if (this.enableDebug)
                                this.emit('debug', "MXP Entity: " + _MXPEntity);
                            if (pState != ParserState.MXPTag) {
                                _MXPEntity = this.GetEntity(_MXPEntity);
                                if (this.mxpState.expanded) {
                                    text = text.splice(idx + 1, _MXPEntity);
                                    tl = text.length;
                                    this.mxpState.expanded = false;
                                    state = pState;
                                    continue;
                                }
                                strBuilder.push("&", _MXPEntity, ";");
                                this.MXPCapture("&");
                                this.MXPCapture(_MXPEntity);
                                this.MXPCapture(";");
                                lineLength++;
                                this.TextLength++;
                                this.mxpState.noBreak = false;
                                this._SplitBuffer = "";
                            }
                            else
                                _MXPTag += "&" + _MXPEntity + ";";
                            state = pState;
                        }
                        else {
                            this._SplitBuffer += c;
                            _MXPEntity += c;
                        }
                        break;
                    case ParserState.MXPComment:
                        if (_MXPComment.endsWith("-->")) {
                            if (this.enableDebug)
                                this.emit('debug', "MXP Comment: " + _MXPComment);
                            idx--;
                            state = pState;
                            if (state === ParserState.None)
                                this._SplitBuffer = "";
                            _MXPComment = "";
                        }
                        else if (c === '\n' || c === '\x1b') {
                            if (this.enableDebug)
                                this.emit('debug', "MXP Comment: " + _MXPComment);
                            idx--;
                            state = pState;
                            _MXPComment = "";
                        }
                        else
                            _MXPComment += c;
                        break;
                    case ParserState.URL:
                        if (idx > lnk + 2) {
                            strBuilder.pop();
                            strBuilder.pop();
                            lineLength -= 2;
                            this.TextLength -= 2;
                            this.MXPDeCapture(2);
                            idx = lnk;
                            state = ParserState.None;
                        }
                        else if (c === '/') {
                            strBuilder.push(c);
                            this.MXPCapture(c);
                            lineLength++;
                            this.TextLength++;
                            if (idx == lnk + 2) {
                                state = ParserState.URLFound;
                                //Found :// so valid url
                                lnk = strBuilder.length - 4;
                                llnk = strBuilder.length - 1;
                                while (lnk > 0 && library_1.CharAllowedInURL(strBuilder[lnk], true))
                                    lnk--;
                                if (!library_1.CharAllowedInURL(strBuilder[lnk], true))
                                    lnk++;
                                lnest = [];
                                if (lnk > 0 && strBuilder[lnk - 1] === "(")
                                    lnest.push(")");
                                if (lnk > 0 && strBuilder[lnk - 1] === "[")
                                    lnest.push("]");
                            }
                        }
                        else if (idx > lnk + 1) {
                            strBuilder.pop();
                            lineLength--;
                            this.TextLength--;
                            this.MXPDeCapture(1);
                            idx = lnk;
                            state = ParserState.None;
                        }
                        else {
                            idx = lnk;
                            state = ParserState.None;
                        }
                        break;
                    case ParserState.URLFound:
                        if (!library_1.CharAllowedInURL(c, false)) {
                            if (llnk != strBuilder.length - 1) {
                                _MXPComment += strBuilder.slice(lnk).join('');
                                if (this.enableDebug)
                                    this.emit('debug', "URL Found: " + _MXPComment);
                                if (this.enableLinks) {
                                    strBuilder.splice(lnk, 0, "<a class=\"URLLink\" href=\"javascript:void(0);\" title=\"" + _MXPComment + "\" onclick=\"" + this.linkFunction + "('" + _MXPComment + "');return false;\">");
                                    strBuilder.push("</a>");
                                }
                                else {
                                    strBuilder.splice(lnk, 0, "<span class=\"URLLink\" title=\"" + _MXPComment + "\">");
                                    strBuilder.push("</span>");
                                }
                            }
                            state = ParserState.None;
                            idx--;
                        }
                        else {
                            var si = strBuilder.length - 1;
                            if (lnest.length > 1 && lnest[lnest.length - 1] == c) {
                                lnest.pop();
                                strBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.TextLength++;
                            }
                            else if (lnest.length > 0 && c == '(') {
                                lnest.push(')');
                                strBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.TextLength++;
                            }
                            else if (lnest.length > 0 && c == '[') {
                                lnest.push(']');
                                strBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.TextLength++;
                            }
                            else if (lnest.length == 1 && lnest[lnest.length - 1] == c) {
                                if (llnk != strBuilder.length - 1) {
                                    _MXPComment += strBuilder.slice(lnk).join('');
                                    if (this.enableDebug)
                                        this.emit('debug', "URL Found: " + _MXPComment);
                                    if (this.enableLinks) {
                                        strBuilder.splice(lnk, 0, "<a class=\"URLLink\" href=\"javascript:void(0);\" title=\"" + _MXPComment + "\" onclick=\"" + this.linkFunction + "('" + _MXPComment + "');return false;\">");
                                        strBuilder.push("</a>");
                                    }
                                    else {
                                        strBuilder.splice(lnk, 0, "<span class=\"URLLink\" title=\"" + _MXPComment + "\">");
                                        strBuilder.push("</span>");
                                    }
                                }
                                state = ParserState.None;
                                idx--;
                            }
                            else {
                                strBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.TextLength++;
                            }
                        }
                        break;
                    case ParserState.MSPSound:
                        if (c === ")") {
                            lnk = this.mxpState.lineType;
                            this.mxpState.lineType = lineType.TempSecure;
                            _MXPTag = this.ParseMXPTag("SOUND", _MXPArgs, remote);
                            this.mxpState.lineType = lnk;
                            state = ParserState.None;
                            if (idx + 1 < tl && text.charAt(idx + 1) === '\n') {
                                idx++;
                                skip = false;
                                strBuilder = ["<span class=\"line\">", this.StartDisplayBlock()];
                                this.mxpState.noBreak = false;
                                lineLength = 0;
                            }
                            else if (idx + 2 < tl && text[idx + 1] === "\r" && text[idx + 2] == "\n") {
                                idx += 2;
                                skip = false;
                                strBuilder = ["<span class=\"line\">", this.StartDisplayBlock()];
                                this.mxpState.noBreak = false;
                                lineLength = 0;
                            }
                        }
                        else if (c === " ")
                            _MXPArgs.push("");
                        else
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        break;
                    case ParserState.MSPMusic:
                        if (c === ")") {
                            lnk = this.mxpState.lineType;
                            this.mxpState.lineType = lineType.TempSecure;
                            _MXPTag = this.ParseMXPTag("MUSIC", _MXPArgs, remote);
                            this.mxpState.lineType = lnk;
                            state = ParserState.None;
                            if (idx + 1 < tl && text.charAt(idx + 1) === '\n') {
                                idx++;
                                skip = false;
                                strBuilder = ["<span class=\"line\">", this.StartDisplayBlock()];
                                this.mxpState.noBreak = false;
                                lineLength = 0;
                            }
                            else if (idx + 2 < tl && text[idx + 1] === "\r" && text[idx + 2] == "\n") {
                                idx += 2;
                                skip = false;
                                strBuilder = ["<span class=\"line\">", this.StartDisplayBlock()];
                                this.mxpState.noBreak = false;
                                lineLength = 0;
                            }
                        }
                        else if (c === " ")
                            _MXPArgs.push("");
                        else
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        break;
                    default:
                        if (e && i === 7) {
                            if (f) {
                                c = "\u2022";
                                strBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.TextLength++;
                                this.mxpState.noBreak = false;
                            }
                            else if (d) {
                                strBuilder.push("&#x2407;");
                                this.MXPCapture("&#x2407;");
                                lineLength++;
                                this.TextLength++;
                                this.mxpState.noBreak = false;
                            }
                            this.emit('bell');
                            this.playBell();
                        }
                        else if (e && c === '\t') {
                            var _Tab = 8 - lineLength % 8;
                            if (_Tab > 0) {
                                strBuilder.push(Array(_Tab + 1).join(" "));
                                this.MXPCapture(Array(_Tab + 1).join(" "));
                                lineLength += _Tab;
                                this.TextLength += _Tab;
                                this.mxpState.noBreak = false;
                            }
                        }
                        else if (c === '\n') {
                            if (this.mxpState.noBreak || this.mxpState.paragraph)
                                continue;
                            if (!this.mxpState.locked) {
                                //notify client that a tag is over, allow for tagging the 10,11,12,19 tag types for auto mapper tagging/welcome test/cutom tags
                                if (this.mxpState.lineType !== lineType.Open)
                                    this.emit('MXPTagEnd', this.mxpState.lineType, strBuilder.join(''));
                                //custom element linked totag so epanded itinto the line
                                if (!this.mxpState.lineExpanded && this.mxpLines[this.mxpState.lineType] && this.mxpLines[this.mxpState.lineType].enabled) {
                                    itmp = "";
                                    if (this.mxpLines[this.mxpState.lineType].element.length > 0)
                                        itmp += "</" + this.mxpLines[this.mxpState.lineType].element + ">";
                                    if (this.mxpLines[this.mxpState.lineType].closeDefinition.length > 0)
                                        itmp += this.mxpLines[this.mxpState.lineType].closeDefinition;
                                    if (itmp.length > 0) {
                                        text = text.splice(idx, itmp);
                                        tl = text.length;
                                        idx--;
                                        this.mxpState.lineExpanded = true;
                                        continue;
                                    }
                                }
                                this.mxpState.lineExpanded = false;
                                this.mxpState.on = false;
                                if (this.mxpLines[this.mxpState.lineType] && this.mxpLines[this.mxpState.lineType].enabled && this.mxpLines[this.mxpState.lineType].gag)
                                    skip = true;
                                this.mxpState.lineType = this.iMXPDefaultMode;
                                if (this.mxpState.lineType != 2 && !this.enableMXP)
                                    this.ResetMXP();
                            }
                            lineLength = 0;
                            if (!skip) {
                                strBuilder.push(this.EndDisplayBlock(), "<br></span>");
                                this.MXPCapture("\n");
                            }
                            this.AddLine(strBuilder.join(''), false, skip);
                            skip = false;
                            strBuilder = ["<span class=\"line\">", this.StartDisplayBlock()];
                            this.TextLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (e && c === '\r') {
                            if (this.mxpState.noBreak || this.mxpState.paragraph)
                                continue;
                            if (!this.mxpState.locked) {
                                this.mxpState.on = false;
                                this.mxpState.lineType = lineType.Open;
                            }
                            continue;
                        }
                        else if (e && c === '\x1b') {
                            this._SplitBuffer += c; //store in split buffer incase split command
                            state = ParserState.Ansi;
                        }
                        else if (i < 32 || i === 127) {
                            if (f) {
                                if (i === 1)
                                    c = "\u263A";
                                else if (i === 2)
                                    c = "\u263B";
                                else if (i === 3)
                                    c = "\u2665";
                                else if (i === 4)
                                    c = "\u2666";
                                else if (i === 5)
                                    c = "\u2663";
                                else if (i === 6)
                                    c = "\u2660";
                                else if (i === 7)
                                    c = "\u2022";
                                else if (i === 8)
                                    c = "\u25D8";
                                else if (i === 9)
                                    c = "\u25CB";
                                else if (i === 10)
                                    c = "\u25D9";
                                else if (i === 11)
                                    c = "\u2642";
                                else if (i === 12)
                                    c = "\u2640";
                                else if (i === 13)
                                    c = "\u266A";
                                else if (i === 14)
                                    c = "\u266B";
                                else if (i === 15)
                                    c = "\u263C";
                                else if (i === 16)
                                    c = "\u25BA";
                                else if (i === 17)
                                    c = "\u25C4";
                                else if (i === 18)
                                    c = "\u2195";
                                else if (i === 19)
                                    c = "\u203C";
                                else if (i === 20)
                                    c = "\u00B6";
                                else if (i === 21)
                                    c = "\u00A7";
                                else if (i === 22)
                                    c = "\u25AC";
                                else if (i === 23)
                                    c = "\u21A8";
                                else if (i === 24)
                                    c = "\u2191";
                                else if (i === 25)
                                    c = "\u2193";
                                else if (i === 26)
                                    c = "\u2192";
                                else if (i === 27)
                                    c = "\u2190";
                                else if (i === 28)
                                    c = "\u221F";
                                else if (i === 29)
                                    c = "\u2194";
                                else if (i === 30)
                                    c = "\u25B2";
                                else if (i === 31)
                                    c = "\u25BC";
                                else if (i === 127)
                                    c = "\u2302";
                                strBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.TextLength++;
                                this.mxpState.noBreak = false;
                            }
                            else if (d) {
                                i = 9215 + i;
                                strBuilder.push("&#", i.toString(), ";");
                                this.MXPCapture("&#");
                                this.MXPCapture(i.toString());
                                this.MXPCapture(";");
                                lineLength++;
                                this.TextLength++;
                                this.mxpState.noBreak = false;
                            }
                            else
                                continue;
                        }
                        else if (c === ' ' || (this._CurrentAttributes > 0 && (this._CurrentAttributes & FontStyle.Hidden) === FontStyle.Hidden)) {
                            strBuilder.push(' ');
                            this.MXPCapture(' ');
                            lineLength++;
                            this.TextLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (c === '<') {
                            if (this.enableMXP && this.mxpState.on) {
                                _MXPTag = "";
                                _MXPArgs = [];
                                this._SplitBuffer += c; //store in split buffer incase split command
                                state = ParserState.MXPTag;
                            }
                            else {
                                strBuilder.push("&lt;");
                                this.MXPCapture("&lt;");
                                lineLength++;
                                this.TextLength++;
                            }
                        }
                        else if (c === '>') {
                            strBuilder.push("&gt;");
                            this.MXPCapture("&gt;");
                            lineLength++;
                            this.TextLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (c === '&') {
                            if (this.enableMXP && this.mxpState.on) {
                                _MXPEntity = "";
                                this._SplitBuffer += c; //store in split buffer incase split command
                                pState = state;
                                state = ParserState.MXPEntity;
                            }
                            else {
                                strBuilder.push("&amp;");
                                lineLength++;
                                this.TextLength++;
                                this.mxpState.noBreak = false;
                            }
                        }
                        else if (c === '"') {
                            strBuilder.push("&quot;");
                            this.MXPCapture("&quot;");
                            lineLength++;
                            this.TextLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (c === "'") {
                            strBuilder.push("&apos;");
                            this.MXPCapture("&apos;");
                            lineLength++;
                            this.TextLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (c == ":") {
                            strBuilder.push(c);
                            this.MXPCapture(c);
                            lineLength++;
                            this.TextLength++;
                            this.mxpState.noBreak = false;
                            if (u) {
                                _MXPComment = "";
                                var psk, pfnd = false;
                                for (p = 0; p < pl; p++) {
                                    if (idx - this.protocols[p].length < 0)
                                        continue;
                                    psk = false;
                                    var nl = this.protocols[p].length;
                                    for (var n = 0; n < nl; n++) {
                                        if (text[idx - (nl - n)] !== this.protocols[p][n]) {
                                            psk = true;
                                            break;
                                        }
                                    }
                                    if (psk)
                                        continue;
                                    lnk = strBuilder.length;
                                    if (lnk > 1 + nl && strBuilder[lnk - (2 + nl)].length === 1 && /\S/.test(strBuilder[lnk - (2 + nl)]) && strBuilder[lnk - (2 + nl)] !== "(" && strBuilder[lnk - (2 + nl)] !== "[")
                                        continue;
                                    lnest = [];
                                    lnk = strBuilder.length - (1 + nl);
                                    llnk = strBuilder.length - 1;
                                    if (lnk > 0 && strBuilder[lnk - 1] === "(")
                                        lnest.push(")");
                                    if (lnk > 0 && strBuilder[lnk - 1] === "[")
                                        lnest.push("]");
                                    state = ParserState.URLFound;
                                    pfnd = true;
                                    if (pfnd)
                                        break;
                                }
                                if (!pfnd) {
                                    state = ParserState.URL;
                                    lnk = idx;
                                }
                            }
                        }
                        else if (c == ".") {
                            strBuilder.push(c);
                            this.MXPCapture(c);
                            lineLength++;
                            this.TextLength++;
                            this.mxpState.noBreak = false;
                            if (u && idx - 3 >= 0) {
                                _MXPComment = "http://";
                                if ((text[idx - 1] === 'w' || idx[lnk - 1] === 'W') &&
                                    (text[idx - 2] === 'w' || idx[lnk - 2] === 'W') &&
                                    (text[idx - 3] === 'w' || idx[lnk - 3] === 'W')) {
                                    lnk = strBuilder.length;
                                    if (lnk > 4 && strBuilder[lnk - 5].length === 1 && /\S/.test(strBuilder[lnk - 5]) && strBuilder[lnk - 5] !== "(" && strBuilder[lnk - 5] !== "[")
                                        continue;
                                    lnest = [];
                                    lnk = strBuilder.length - 4;
                                    llnk = strBuilder.length - 1;
                                    if (lnk > 0 && strBuilder[lnk - 1] === "(")
                                        lnest.push(")");
                                    if (lnk > 0 && strBuilder[lnk - 1] === "[")
                                        lnest.push("]");
                                    state = ParserState.URLFound;
                                }
                            }
                        }
                        else if (s && lineLength === 0 && text.substring(idx, idx + 8) == "!!MUSIC(") {
                            _MXPArgs = [""];
                            state = ParserState.MSPMusic;
                            idx += 7;
                            this.mxpState.noBreak = false;
                        }
                        else if (s && lineLength === 0 && text.substring(idx, idx + 8) == "!!SOUND(") {
                            _MXPArgs = [""];
                            state = ParserState.MSPSound;
                            idx += 7;
                            this.mxpState.noBreak = false;
                        }
                        else {
                            if (f && i > 127 && i < 255) {
                                if (i === 128)
                                    c = "\u00C7";
                                else if (i === 129)
                                    c = "\u00FC";
                                else if (i === 130)
                                    c = "\u00E9";
                                else if (i === 131)
                                    c = "\u00E2";
                                else if (i === 132)
                                    c = "\u00E4";
                                else if (i === 133)
                                    c = "\u00E0";
                                else if (i === 134)
                                    c = "\u00E5";
                                else if (i === 135)
                                    c = "\u00E7";
                                else if (i === 136)
                                    c = "\u00EA";
                                else if (i === 137)
                                    c = "\u00EB";
                                else if (i === 138)
                                    c = "\u00E8";
                                else if (i === 139)
                                    c = "\u00EF";
                                else if (i === 140)
                                    c = "\u00EE";
                                else if (i === 141)
                                    c = "\u00EC";
                                else if (i === 142)
                                    c = "\u00C4";
                                else if (i === 143)
                                    c = "\u00C5";
                                else if (i === 144)
                                    c = "\u00C9";
                                else if (i === 145)
                                    c = "\u00E6";
                                else if (i === 146)
                                    c = "\u00C6";
                                else if (i === 147)
                                    c = "\u00F4";
                                else if (i === 148)
                                    c = "\u00F6";
                                else if (i === 149)
                                    c = "\u00F2";
                                else if (i === 150)
                                    c = "\u00FB";
                                else if (i === 151)
                                    c = "\u00F9";
                                else if (i === 152)
                                    c = "\u00FF";
                                else if (i === 153)
                                    c = "\u00D6";
                                else if (i === 154)
                                    c = "\u00DC";
                                else if (i === 155)
                                    c = "\u00A2";
                                else if (i === 156)
                                    c = "\u00A3";
                                else if (i === 157)
                                    c = "\u00A5";
                                else if (i === 158)
                                    c = "\u20A7";
                                else if (i === 159)
                                    c = "\u0192";
                                else if (i === 160)
                                    c = "\u00E1";
                                else if (i === 161)
                                    c = "\u00ED";
                                else if (i === 162)
                                    c = "\u00F3";
                                else if (i === 163)
                                    c = "\u00FA";
                                else if (i === 164)
                                    c = "\u00F1";
                                else if (i === 165)
                                    c = "\u00D1";
                                else if (i === 166)
                                    c = "\u00AA";
                                else if (i === 167)
                                    c = "\u00BA";
                                else if (i === 168)
                                    c = "\u00BF";
                                else if (i === 169)
                                    c = "\u2310";
                                else if (i === 170)
                                    c = "\u00AC";
                                else if (i === 171)
                                    c = "\u00BD";
                                else if (i === 172)
                                    c = "\u00BC";
                                else if (i === 173)
                                    c = "\u00A1";
                                else if (i === 174)
                                    c = "\u00AB";
                                else if (i === 175)
                                    c = "\u00BB";
                                else if (i === 176)
                                    c = "\u2591";
                                else if (i === 177)
                                    c = "\u2592";
                                else if (i === 178)
                                    c = "\u2593";
                                else if (i === 179)
                                    c = "\u2502";
                                else if (i === 180)
                                    c = "\u2524";
                                else if (i === 181)
                                    c = "\u2561";
                                else if (i === 182)
                                    c = "\u2562";
                                else if (i === 183)
                                    c = "\u2556";
                                else if (i === 184)
                                    c = "\u2555";
                                else if (i === 185)
                                    c = "\u2563";
                                else if (i === 186)
                                    c = "\u2551";
                                else if (i === 187)
                                    c = "\u2557";
                                else if (i === 188)
                                    c = "\u255D";
                                else if (i === 189)
                                    c = "\u255C";
                                else if (i === 190)
                                    c = "\u255B";
                                else if (i === 191)
                                    c = "\u2510";
                                else if (i === 192)
                                    c = "\u2514";
                                else if (i === 193)
                                    c = "\u2534";
                                else if (i === 194)
                                    c = "\u252C";
                                else if (i === 195)
                                    c = "\u251C";
                                else if (i === 196)
                                    c = "\u2500";
                                else if (i === 197)
                                    c = "\u253C";
                                else if (i === 198)
                                    c = "\u255E";
                                else if (i === 199)
                                    c = "\u255F";
                                else if (i === 200)
                                    c = "\u255A";
                                else if (i === 201)
                                    c = "\u2554";
                                else if (i === 202)
                                    c = "\u2569";
                                else if (i === 203)
                                    c = "\u2566";
                                else if (i === 204)
                                    c = "\u2560";
                                else if (i === 205)
                                    c = "\u2550";
                                else if (i === 206)
                                    c = "\u256C";
                                else if (i === 207)
                                    c = "\u2567";
                                else if (i === 208)
                                    c = "\u2568";
                                else if (i === 209)
                                    c = "\u2564";
                                else if (i === 210)
                                    c = "\u2565";
                                else if (i === 211)
                                    c = "\u2559";
                                else if (i === 212)
                                    c = "\u2558";
                                else if (i === 213)
                                    c = "\u2552";
                                else if (i === 214)
                                    c = "\u2553";
                                else if (i === 215)
                                    c = "\u256B";
                                else if (i === 216)
                                    c = "\u256A";
                                else if (i === 217)
                                    c = "\u2518";
                                else if (i === 218)
                                    c = "\u250C";
                                else if (i === 219)
                                    c = "\u2588";
                                else if (i === 220)
                                    c = "\u2584";
                                else if (i === 221)
                                    c = "\u258C";
                                else if (i === 222)
                                    c = "\u2590";
                                else if (i === 223)
                                    c = "\u2580";
                                else if (i === 224)
                                    c = "\u03B1";
                                else if (i === 225)
                                    c = "\u03B2";
                                else if (i === 226)
                                    c = "\u0393";
                                else if (i === 227)
                                    c = "\u03C0";
                                else if (i === 228)
                                    c = "\u03A3";
                                else if (i === 229)
                                    c = "\u03C3";
                                else if (i === 230)
                                    c = "\u00B5";
                                else if (i === 231)
                                    c = "\u03C4";
                                else if (i === 232)
                                    c = "\u03A6";
                                else if (i === 233)
                                    c = "\u0398";
                                else if (i === 234)
                                    c = "\u03A9";
                                else if (i === 235)
                                    c = "\u03B4";
                                else if (i === 236)
                                    c = "\u221E";
                                else if (i === 237)
                                    c = "\u2205";
                                else if (i === 238)
                                    c = "\u2208";
                                else if (i === 239)
                                    c = "\u2229";
                                else if (i === 240)
                                    c = "\u2261";
                                else if (i === 241)
                                    c = "\u00B1";
                                else if (i === 242)
                                    c = "\u2265";
                                else if (i === 243)
                                    c = "\u2264";
                                else if (i === 244)
                                    c = "\u2320";
                                else if (i === 245)
                                    c = "\u2321";
                                else if (i === 246)
                                    c = "\u00F7";
                                else if (i === 247)
                                    c = "\u2248";
                                else if (i === 248)
                                    c = "\u00B0";
                                else if (i === 249)
                                    c = "\u2219";
                                else if (i === 250)
                                    c = "\u00B7";
                                else if (i === 251)
                                    c = "\u221A";
                                else if (i === 252)
                                    c = "\u207F";
                                else if (i === 253)
                                    c = "\u00B2";
                                else if (i === 254)
                                    c = "\u25A0";
                            }
                            strBuilder.push(c);
                            this.MXPCapture(c);
                            lineLength++;
                            this.TextLength++;
                            this.mxpState.noBreak = false;
                        }
                        break;
                }
            }
            if (lineLength > 0) {
                strBuilder.push(this.EndDisplayBlock());
                strBuilder.push("</span>");
                this.AddLine(strBuilder.join(''), true, false);
            }
        }
        catch (ex) {
            if (this.enableDebug)
                this.emit('debug', ex);
        }
        this.emit('parseDone');
        this.parsing.shift();
        if (this.parsing.length > 0)
            setTimeout(this.parseNext(), 0);
    }
    ;
    parseNext() {
        var itmp = this.parsing.shift();
        var self = this;
        return function () { self.parse(itmp[0], itmp[1], true); };
    }
    updateWindow(width, height) {
        this.window = { width: width, height: height };
    }
    ;
    Clear() {
        this.ResetColors();
        this.TextLength = 0;
    }
    ;
    ClearMXP() {
        this.mxpEntities = {};
        this.ResetMXP();
        this.mxpElements = {};
        this.mxpState = new MXPState();
    }
    ;
    ResetMXP() {
        this.mxpStyles = [];
        this.mxpStyles.push(new MXPStyle(FontStyle.None, "", "", false));
    }
    ;
    ResetMXPLine() {
        this.iMXPDefaultMode = lineType.Open;
        this.mxpState.lineType = lineType.Open;
    }
    ;
    //public interface, as client can only access publicly marked entities
    GetPublicEntity(entity) {
        if (this.mxpEntities[entity] && this.mxpEntities[entity].publish)
            return this.mxpEntities[entity].value;
        return entity;
    }
    ;
    playBell() {
        if (this.enableBell) {
            var bell = new buzz.sound(this.bell);
            bell.play();
        }
    }
    ;
    get linkFunction() {
        return this._linkFunction || "doLink";
    }
    set linkFunction(val) {
        this._linkFunction = val;
    }
    get mxpLinkFunction() {
        return this._mxpLinkFunction || "doMXPLink";
    }
    set mxpLinkFunction(val) {
        this._mxpLinkFunction = val;
    }
    get mxpSendFunction() {
        return this._mxpSendFunction || "doMXPSend";
    }
    set mxpSendFunction(val) {
        this._mxpSendFunction = val;
    }
    get mxpTooltipFunction() {
        return this._mxpTooltipFunction || "doMXPTooltip";
    }
    set mxpTooltipFunction(val) {
        this._mxpTooltipFunction = val;
    }
}
exports.Parser = Parser;
;
