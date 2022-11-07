//spell-checker:ignore rgbcolor, Fraktur, aixterm, FNAME, ismap, ATTLIST, windowname, cmds, apos, doubleunderline, MXPO
import EventEmitter = require('events');
import RGBColor = require('rgbcolor');
import { ParserLine, FormatType, ParserOptions, FontStyle, LineFormat, LinkFormat, ImageFormat, Size } from './types';
import { stripQuotes, CharAllowedInURL, htmlDecode } from './library';

interface MXPBlock {
    format: LineFormat | LinkFormat | ImageFormat;
    text: string;
}

/**
   * Enum for MXP tags.
   * @readonly
   * @enum {number}
   * @typedef {number} MXPTag
   */
enum MXPTag {
    None = 0,
    B, BOLD, STRONG,
    I, ITALIC, EM,
    U, UNDERLINE,
    S, STRIKEOUT, STRIKE,
    C, COLOR, H, HIGH,
    FONT, HR,
    NOBR, P, BR, SBR,
    A, SEND, EXPIRE,
    VERSION, SUPPORT,
    RESET, H1, H2, H3, H4, H5, H6,
    V, VAR, USER, PASSWORD, Custom,
    GAUGE, STAT
}

enum lineType {
    None = -1,
    Open = 0,
    Secure = 1,
    Locked = 2,
    Reset = 3,
    TempSecure = 4,
    LockOpen = 5,
    LockSecure = 6,
    LockLocked = 7,
    RoomName = 10,
    RoomDescription = 11,
    RoomExits = 12,
    WelcomeText = 19
}

/**
 * Enum for parser state.
 * @readonly
 * @enum {number}
 * @typedef {number} ParserState
 */
enum ParserState {
    None = 0,
    Ansi = 1,
    AnsiParams = 2,
    XTermTitle = 3,
    MXPTag = 4,
    MXPTagQuoted = 5,
    MXPTagDblQuoted = 6,
    MXPEntity = 7,
    MXPComment = 8,
    MXPTagArg = 9,
    URL = 10,
    URLFound = 11,
    MSPSound = 12,
    MSPMusic = 13
}

/**
   * Object to track current state of MXP
   *
   * @property {Boolean}  [on='']								- MXP on for current block of process, determined based on line mode sent
   * @property {Number}   [lineType=0]					- Current line type, 0 to 99 based on MXP spec
   * @property {Boolean}  [locked=false]				- is the current line mode locked based on lineType
   * @property {Boolean}  [paragraph=false]			- is current block in a paragraph to ignore \n
   * @property {Boolean}  [noBreak=false]				- Ignore the next \n
   * @property {Boolean}  [expanded=false]			- element expanded so it knows to insert the new text before continuing to parse
   * @property {Number}   [capture=0]						- Capture any text processed while capture is one, supports nesting
   * @property {Strung[]} [captured=[]]					- Captured text buffers, an array of nested captures, as captures end the last one added is popped off, and capture is decreased by 1
   * @property {Boolean}  [expanded=false]			- line tag expanded
   * @property {Boolean}  [gagged=false]				- current block of text gagged from being displayed
   */
class MXPState {
    public on: boolean = false;
    public lineType: (lineType | number) = 0;
    public locked: boolean = false;
    public paragraph: boolean = false;
    public noBreak: boolean = false;
    public expanded: boolean = false;
    public lineExpanded: boolean = false;
    public capture: number = 0;
    public captured = [];
    public gagged: boolean = false;
}

/**
   * MXP Entity object
   *
   * @property {String}  [name='']					- The name of the entity
   * @property {String}  [value='']					- The value of the entity
   * @property {String}  [description='']		- the description of the entity
   * @property {Boolean} [publish=false]		- Is the entity published to the public for users to access value
   * @property {Boolean} [remote=false]			- None standard, tells the parser where the entity is from for security reasons as local users should not be able to change server set entities
   */
class Entity {
    public name: string = '';
    public value: string = '';
    public description: string = '';
    public publish: boolean = false;
    public remote: boolean = false;
    constructor(remote?: boolean) {
        this.remote = remote == null ? false : remote;
    }
}

/**
 * MXP Element object
 *
 * @property {String}  [name='']							- The name of the element
 * @property {String}  [definition='']				- The element definition to expand to
 * @property {String}  [closeDefinition='']		- The close definition built from definition
 * @property {Object}  [attributes='']				- Object to track attributes list
 * @property {Array}   [attributeIndexes=[]]	- Array to link attributes to argument index
 * @property {Number}  [tag=-1]								- Tag line, if set will present tagline codes to definition in format of <esc>[<tag>zDefinition
 * @property {String}  [flag='']							- Element tag property, mostly client dependant, see MXP spec for full list of basic ones
 * @property {Boolean} [open=false]						- Is this an open element that can be used on an open line type
 * @property {Boolean} [empty=false]					- Is this an empty tag that doesn't have a CloseDefinition
 * @property {Boolean} [remote=false]					- None standard, tells the parser where the entity is from for security reasons as local users should not be able to change server set elements
 * @property {Boolean} [gagged=false]					- Is element gagged from display as a tag could cause a custom element to be processed but hidden
 */
class Element {
    public name: string = '';
    public definition: string = '';
    public closeDefinition: string = '';
    public attributes = {};
    public attributeIndexes = [];
    public tag: (lineType | number) = lineType.None;
    public flag: string = '';
    public open: boolean = false;
    public empty: boolean = false;
    public remote: boolean = false;
    public gagged: boolean = false;
    constructor(remote?: boolean) {
        this.remote = remote == null ? false : remote;
    }
}

/**
 * MXP Line Tag object
 *
 * @property {Number}  [index=-1]						- The tag number (20-99) to change
 * @property {String}  [window='']					- Specifies the name of a window to redirect the text to, unsupported
 * @property {Boolean} [gag=false]					- Indicates that the text should be gagged from the main MUD window.
 * @property {String}  [fore='']						- The text foreground color.
 * @property {String}  [back='']						- The background color of the text.
 * @property {Boolean} [enabled=true]				- Turn this tag on or off.
 * @property {Boolean} [remote=false]				- None standard, tells the parser where the tag is from for security reasons as local users should not be able to change server set tag
 * @property {String}  [element='']					- Was the tag created by an element, as it should use that elements def/closeDef
 * @property {String}  [definition='']			- Was the tag supplied with its own colors, still link to element but these colors override any set by element
 * @property {String}  [closeDefinition='']	- The close definition built from definition
 */
class Tag {
    public index: (lineType | number) = lineType.None;
    public window: string = '';
    public gag: boolean = false;
    public fore: string = '';
    public back: string = '';
    public enabled: boolean = true;
    public remote: boolean = false;
    public element: string = '';
    public definition: string = '';
    public closeDefinition: string = '';
    constructor(index?: number, fore?: string, back?: string, remote?: boolean) {
        if (index != null) this.index = index;
        if (fore != null) this.fore = fore;
        if (back != null) this.back = back;
        if (remote != null) this.remote = remote;
    }
}

/**
 * MXPStyle object, stores the current style for display block in a stack, new styles are build on prev and pushed on stack, as style are closed they are popped off
  *
 * @property {MXPTag}    [tag=0]				- The tag that applied this style
 * @property {String}    [custom='']		- If tag is custom store its name to know the exact tag
 * @property {String}    [font='']			- The font to apply to current display block
 * @property {String}    [fontSize='']	-	The font size in any valid css format
 * @property {FontStyle} [style=_style]	- The fontStyle enum state, see fontStyle
 * @property {String}    [fore=_fore]		- The foreground color, this overrides any ansi foreground set
 * @property {String}    [back=_back]		- The background color, this overrides aay ansi background set
 * @property {Boolean}   [high=_high]		- This will brighten what ever the current foreground color is by 50% even if it is an ansi set color
 * @property {Object}    [obj=null]			- Store misc data that a tag may need for later processing
 */
class MXPStyle {
    public tag: MXPTag = MXPTag.None;
    public custom: string = '';
    public font: string = null;
    public fontSize: (string) = null;
    public style: FontStyle = FontStyle.None;
    public fore: string = '';
    public back: string = '';
    public high: boolean = false;
    public obj: any = null;
    public gagged: boolean = false;
    public open: boolean = false;
    public properties = null;
    constructor(style?: FontStyle, fore?: string, back?: string, high?: boolean, open?: boolean) {
        if (style != null) this.style = style;
        if (fore != null) this.fore = fore;
        if (back != null) this.back = back;
        this.high = high || false;
        this.open = open || false;
    }

}

/**
 * An Ansi/MXP parser, requires requires the modules src/lib/rgbcolor for color processing and validation
 *
 * @author William
 * @copyright William 2013
 * @version 1.1
 * @requires module:src/lib/rgbcolor
 * @namespace Parser
 *
 * @todo WELCOME element - just tags text as welcome for redirection purposes, don't support redirection to other windows so don't worry about this
 * @todo <FRAME NAME ACTION(OPEN|CLOSE|REDIRECT) TITLE INTERNAL ALIGN(LEFT|RIGHT|BOTTOM|TOP) LEFT TOP WIDTH HEIGHT SCROLLING(yes|no) FLOATING>
 * @constructor
 *
 * @param {Object}	options													- The options to start off with
 * @param {Boolean} [options.MXP=true]							- Enable/disable MXP parsing
 * @param {Object}	options.window									- The window view size, used for clearing screen and other ansi related systems
 * @param {Number}	[options.window.height=0]				- The window height in lines
 * @param {Number}	[options.window.width=0]				- The window width in characters
 * @param {Boolean} [options.flashing=false]				- Enable/disable ansi blink
 *
 * @property {String}  [StyleVersion='']						- The MXP cached version style set from the VERSION tag, used by a client to reply to a VERSION request
 * @property {Boolean} [displayControlCodes=false]	- Display unreadable characters, code < 32 || 127
 * @property {Boolean} [emulateControlCodes=true]		- Emulate control codes like escape, tabs, etc...
 * @property {Boolean} [EndOfLine=false]						- Is the current parser state at end of line or on a fragment
 * @property {Number}  [textLength=0]								- The current amount of text that has been parsed
 * @property {Boolean} [enableMXP=true]							- Enable/disable MXP parsing
 * @property {Boolean} [enableMSP=true]							- Enable/disable MSP parsing
 * @property {Boolean} window												- The window size, used for clearing screen and other ansi related systems
 * @property {Number}  [options.window.height=0]		- The window height in lines
 * @property {Number}  [options.window.width=0]			- The window width in characters
 * @property {Boolean} [enableFlashing=false]				- Enable/disable ansi blink
 * @property {Boolean} [emulateTerminal=false]			- Enable/disable Terminal IBM/OEM (code page 437) extended characters, will convert them to the correct unicode character in an attempt to display like classic terminal
 */
export class Parser extends EventEmitter {

    /** @private */
    private parsing = [];
    /** @private */
    /* Web detection protocols that are just followed by a :*/
    private protocols = [['m', 'a', 'i', 'l', 't', 'o'], ['s', 'k', 'y', 'p', 'e'], ['a', 'i', 'm'], ['c', 'a', 'l', 'l', 't', 'o'], ['g', 't', 'a', 'l', 'k'], ['i', 'm'], ['i', 't', 'm', 's'], ['m', 's', 'n', 'i', 'm'], ['t', 'e', 'l'], ['y', 'm', 's', 'g', 'r']];

    /** @private */
    private _ColorTable: string[] = null;
    /** @private */
    private _CurrentForeColor: (string | number) = 37;
    /** @private */
    private _CurrentBackColor: (string | number) = 40;
    /** @private */
    private _CurrentAttributes: FontStyle = FontStyle.None;
    /** @private */
    private _SplitBuffer: string = '';
    /** @private */
    private mxpState: MXPState = new MXPState();
    /** @private */
    private mxpStyles: MXPStyle[] = [];
    /** @private */
    private mxpEntities: any = {};
    /** @private */
    private mxpElements: any = {};
    /** @private */
    private mxpLines: Tag[] = [];
    /** @private */
    private iMXPDefaultMode: (lineType | number) = lineType.Open;

    public displayControlCodes: boolean = false;
    public emulateControlCodes: boolean = true;
    public StyleVersion: string = '';
    public EndOfLine: boolean = false;
    public textLength: number = 0;
    public rawLength: number = 0;
    public enableMXP: boolean = true;
    public DefaultImgUrl: string = 'themes/general';
    public enableDebug: boolean = false;
    public showInvalidMXPTags: boolean = false;
    public enableLinks: boolean = true;
    public enableMSP: boolean = true;
    public enableURLDetection: boolean = true;
    public window: Size = new Size(0, 0);
    public enableFlashing: boolean = false;
    public emulateTerminal: boolean = false;
    public bell: string = './../assets/sounds/bell.m4a';
    public enableBell: boolean = true;
    public display: any = null;
    public tabWidth: number = 8;

    public busy = false;

    constructor(options?: ParserOptions) {
        super();
        if (options != null) {
            if (options.DefaultImageURL)
                this.DefaultImgUrl = options.DefaultImageURL;
            if (options.enableMXP != null)
                this.enableMXP = options.enableMXP;
            if (options.enableDebug != null)
                this.enableDebug = options.enableDebug;
            if (options.showInvalidMXPTags != null)
                this.showInvalidMXPTags = options.showInvalidMXPTags;

            if (options.enableMSP != null)
                this.enableMSP = options.enableMSP;
            if (options.enableURLDetection != null)
                this.enableURLDetection = options.enableURLDetection;
            if (options.window != null)
                this.window = options.window;
            if (options.enableFlashing != null)
                this.enableFlashing = options.enableFlashing;
            if (options.emulateTerminal != null)
                this.emulateTerminal = options.emulateTerminal;
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

    private getColors(mxp?: MXPStyle) {
        if (typeof mxp === 'undefined')
            mxp = this.GetCurrentStyle();
        let f: (string | number);
        let b: (string | number);
        let fc: number = -1;
        let bc: number = -1;

        if (mxp.fore.length > 0) {
            if ((this._CurrentAttributes & FontStyle.Bold) === FontStyle.Bold)
                f = this.IncreaseColor(mxp.fore, 0.5);
            else if ((this._CurrentAttributes & FontStyle.Faint) === FontStyle.Faint)
                f = this.DecreaseColor(mxp.fore, 0.5);
            else
                f = mxp.fore;
        }
        else if (typeof this._CurrentForeColor === 'string')
            f = 'rgb(' + this._CurrentForeColor.replace(/;/g, ',') + ')';
        else {
            f = this._CurrentForeColor;
            if ((this._CurrentAttributes & FontStyle.Bold) === FontStyle.Bold) {
                if (f > 999)
                    f /= 1000;
                if (f >= 0 && f < 99)
                    f *= 10;
                fc = f;
                if (f <= -16)
                    f = this.IncreaseColor(this.GetColor(f), 0.5);
            }
            else if ((this._CurrentAttributes & FontStyle.Faint) === FontStyle.Faint) {
                if (f > 99 && f < 999)
                    f /= 10;
                if (f >= 0 && f < 999)
                    f *= 100;
                fc = f;
                if (f <= -16)
                    f = this.DecreaseColor(this.GetColor(f), 0.15);
            }
            else {
                fc = f;
            }
        }

        if (mxp.high) {
            if (typeof f === 'number')
                f = this.IncreaseColor(this.GetColor(f), 0.25);
            else
                f = this.IncreaseColor(f, 0.25);
        }

        if (mxp.back.length > 0)
            b = mxp.back;
        else if (typeof this._CurrentBackColor === 'string')
            b = 'rgb(' + this._CurrentBackColor.replace(/;/g, ',') + ')';
        else
            b = bc = this._CurrentBackColor;

        if ((this._CurrentAttributes & FontStyle.Inverse) === FontStyle.Inverse || (mxp.style & FontStyle.Inverse) === FontStyle.Inverse)
            return { fore: b, back: f, foreCode: bc, backCode: fc };
        return { fore: f, back: b, foreCode: fc, backCode: bc };
    }

    private getFormatBlock(offset) {
        const mxp: MXPStyle = this.GetCurrentStyle();
        const colors = this.getColors(mxp);
        return {
            formatType: FormatType.Normal,
            offset: offset,
            color: colors.fore || 0,
            background: colors.back || 0,
            size: mxp.fontSize || 0,
            font: mxp.font || 0,
            style: mxp.style | (this._CurrentAttributes & ~FontStyle.Bold),
            unicode: false
        };
    }

    private ResetColors() {
        this._CurrentForeColor = 37;
        this._CurrentBackColor = 40;
        this._CurrentAttributes = FontStyle.None;
    }

    private ProcessAnsiColorParams(params: string[]) {
        let p: number = 0;
        const pl: number = params.length;
        let i: number;
        let rgb: string;
        for (; p < pl; p++) {
            i = +params[p] || 0;
            switch (i) {
                case 0: //Reset/None
                    this.ResetColors();
                    break;
                case 1: //Bold
                    this._CurrentAttributes |= FontStyle.Bold;
                    //can only be bold or faint not both, so when you turn on bold turn off faint
                    this._CurrentAttributes &= ~FontStyle.Faint;
                    break;
                case 2: //Faint
                    this._CurrentAttributes |= FontStyle.Faint;
                    //can only be bold or faint not both, so when you turn on faint turn off bold
                    this._CurrentAttributes &= ~FontStyle.Bold;
                    break;
                case 3: //Italics
                    this._CurrentAttributes |= FontStyle.Italic;
                    break;
                case 4: //Underscore
                    this._CurrentAttributes |= FontStyle.Underline;
                    //this._CurrentAttributes &= ~FontStyle.DoubleUnderline;
                    break;
                case 5: //Blink < 150 per min
                    this._CurrentAttributes |= FontStyle.Slow;
                    break;
                case 6: //Blink Rapid >= 150 per min
                    this._CurrentAttributes |= FontStyle.Rapid;
                    break;
                case 7: //Reverse
                    this._CurrentAttributes |= FontStyle.Inverse;
                    break;
                case 8: //hidden / Concealed
                    this._CurrentAttributes |= FontStyle.Hidden;
                    break;
                case 9: //strike through on
                    this._CurrentAttributes |= FontStyle.Strikeout;
                    break;
                /*
                10 primary(default) font
                11 first alternative font
                12 second alternative font
                13 third alternative font
                14 fourth alternative font
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
                case 22: //bold off
                    this._CurrentAttributes &= ~FontStyle.Bold;
                    this._CurrentAttributes &= ~FontStyle.Faint;
                    break;
                case 23: //italics off
                    this._CurrentAttributes &= ~FontStyle.Italic;
                    break;
                case 24: //underline off
                    this._CurrentAttributes &= ~FontStyle.Underline;
                    this._CurrentAttributes &= ~FontStyle.DoubleUnderline;
                    break;
                case 25:
                    this._CurrentAttributes &= ~FontStyle.Slow;
                    break;
                case 26:
                    this._CurrentAttributes &= ~FontStyle.Rapid;
                    break;
                case 27: //inverse off
                    this._CurrentAttributes &= ~FontStyle.Inverse;
                    break;
                case 28: //visible / concealed off
                    this._CurrentAttributes &= ~FontStyle.Hidden;
                    break;
                case 29: //strike through off
                    this._CurrentAttributes &= ~FontStyle.Strikeout;
                    break;
                case -11: //error color
                case -7: //info color
                case -3: //local echo
                case 30: //set foreground color to black
                case 31: //set foreground color to red
                case 32: //set foreground color to green
                case 33:  //set foreground color to yellow
                case 34: //set foreground color to blue
                case 35:  //set foreground color to magenta (purple)
                case 36:  //set foreground color to cyan
                case 37:  //set foreground color to white
                    this._CurrentForeColor = i;
                    break;
                case 38:
                    if (p + 2 < pl && params[p + 1] === '5') {
                        this._CurrentForeColor = +params[p + 2];
                        if (isNaN(this._CurrentForeColor))
                            this._CurrentForeColor = 37;
                        else {
                            this._CurrentForeColor += 16;
                            this._CurrentForeColor *= -1;
                        }
                        p += 2;
                    }
                    else if (p + 4 < pl && params[p + 1] === '2') {
                        i = +params[p + 2] || 0;
                        if (i < 0 || i > 255)
                            continue;
                        rgb = i + ';';
                        i = +params[p + 3] || 0;
                        if (i < 0 || i > 255)
                            continue;
                        rgb += i + ';';
                        i = +params[p + 4] || 0;
                        if (i < 0 || i > 255)
                            continue;
                        rgb += i;
                        this._CurrentForeColor = rgb;
                        p += 4;
                    }
                    break;
                case 39: //set foreground color to default)
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
                    if (p + 2 < pl && params[p + 1] === '5') {
                        this._CurrentBackColor = +params[p + 2];
                        if (isNaN(this._CurrentBackColor))
                            this._CurrentBackColor = 40;
                        else {
                            this._CurrentBackColor += 16;
                            this._CurrentBackColor *= -1; //prevent overlap of protocols in color grabbing code
                        }
                        p += 2;
                    }
                    else if (p + 4 < pl && params[p + 1] === '2') {
                        i = +params[p + 2] || 0;
                        if (i < 0 || i > 255)
                            continue;
                        rgb = i + ';';
                        i = +params[p + 3] || 0;
                        if (i < 0 || i > 255)
                            continue;
                        rgb += i + ';';
                        i = +params[p + 4] || 0;
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
                //zMUD log colors, seems zMUD uses the 50s for display info for bold colors, standards use it to control borders and other effects
                //don't need zMUD colors here as we never need to open fonts, replace with the frames/overlined/etc... if it can be done in css
                case 53: //Overlined believe this draws a line above text, opposite of underline
                    this._CurrentAttributes |= FontStyle.Overline;
                    break;
                case 55: //Not overlined, turns off overlined
                    this._CurrentAttributes &= ~FontStyle.Overline;
                    break;
                case 50: //Reserved
                case 51: //Framed believe this adds a border all the way around block of text
                case 52: //Encircled, not sure maybe draws a circle around text?
                case 54: //Not framed or encircled, turns off framed/encircled
                case 56: //Reserved
                case 57: //Reserved
                case 58: //Reserved
                case 59: //Reserved
                    this._CurrentForeColor = i - 20;
                    this._CurrentAttributes |= FontStyle.Bold; //make bold
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

    private buildColorTable() {
        const _ColorTable: string[] = [];
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
        for (r = 232; r <= 255; r++)//grayscale
        {
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
        _ColorTable[270] = 'rgb(0, 128, 128)';  //cyan back
        _ColorTable[271] = 'rgb(187, 187, 187)';  //white back

        _ColorTable[272] = 'rgb(0,0,0)'; //InfoBackground
        _ColorTable[273] = 'rgb(0, 255, 255)';  //InfoText
        _ColorTable[274] = 'rgb(0,0,0)'; //LocalEchoBackground
        _ColorTable[275] = 'rgb(255, 255, 0)';  //LocalEchoText
        _ColorTable[276] = 'rgb(0, 0, 0)';  //DefaultBack
        _ColorTable[277] = 'rgb(229, 229, 229)';  //DefaultFore

        _ColorTable[278] = 'rgb(205, 0, 0)';  //ErrorFore
        _ColorTable[279] = 'rgb(229, 229, 229)';  //ErrorBack

        _ColorTable[280] = 'rgb(255,255,255)';  //DefaultBrightFore
        this._ColorTable = _ColorTable;
    }

    public GetColor(code: number) {
        if (this._ColorTable == null)
            this.buildColorTable();
        switch (code) {
            case -12:
                return this._ColorTable[279];  //ErrorBack
            case -11:
                return this._ColorTable[278];  //ErrorFore
            case -10:
                return this._ColorTable[280];  //DefaultBrightFore
            case -8:
                return this._ColorTable[272]; //InfoBackground
            case -7:
                return this._ColorTable[273];  //InfoText
            case -4:
                return this._ColorTable[274]; //LocalEchoBackground
            case -3:
                return this._ColorTable[275];  //LocalEchoText
            case 49:
            case -2:
                return this._ColorTable[276];  //DefaultBack
            case 39:
            case -1:
                return this._ColorTable[277];  //DefaultBack
            case 0:
            case 30: //set foreground color to black
                return this._ColorTable[0];
            case 1:
            case 31: //set foreground color to red
                return this._ColorTable[1];
            case 2:
            case 32: //set foreground color to green
                return this._ColorTable[2];
            case 3:
            case 33:  //set foreground color to yellow
                return this._ColorTable[3];
            case 4:
            case 34: //set foreground color to blue
                return this._ColorTable[4];
            case 5:
            case 35:  //set foreground color to magenta (purple)
                return this._ColorTable[5];
            case 6:
            case 36:  //set foreground color to cyan
                return this._ColorTable[6];
            case 7:
            case 37:  //set foreground color to white
                return this._ColorTable[7];
            case 40:  //background black
                return this._ColorTable[264];
            case 41:  //background red
                return this._ColorTable[265];
            case 42:  //background green
                return this._ColorTable[266];
            case 43:  //background yellow
                return this._ColorTable[267];
            case 44:  //background blue
                return this._ColorTable[268];
            case 45:  //background magenta
                return this._ColorTable[269];
            case 46:  //cyan
                return this._ColorTable[270];
            case 47:  //white
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
            case 330:  //set foreground color to yellow
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
            case 350:  //set foreground color to magenta (purple)
            case 450:
                return this._ColorTable[13];
            case 14:
            case 96:
            case 106:
            case 360:  //set foreground color to cyan
            case 460:
                return this._ColorTable[14];
            case 15:
            case 97:
            case 107:
            case 370:  //set foreground color to white
            case 470:
                return this._ColorTable[15];
            case 4000:
            case 3000: //set foreground color to black
                return this._ColorTable[256];
            case 4100:
            case 3100: //set foreground color to red
                return this._ColorTable[257];
            case 4200:
            case 3200: //set foreground color to green
                return this._ColorTable[258];
            case 4300:
            case 3300:  //set foreground color to yellow
                return this._ColorTable[259];
            case 4400:
            case 3400: //set foreground color to blue
                return this._ColorTable[260];
            case 4500:
            case 3500:  //set foreground color to magenta (purple)
                return this._ColorTable[261];
            case 4600:
            case 3600:  //set foreground color to cyan
                return this._ColorTable[262];
            case 4700:
            case 3700:  //set foreground color to white
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

    public SetColor(code: number, color) {
        if (this._ColorTable == null)
            this.buildColorTable();
        if (code < 0 || code >= this._ColorTable.length)
            return;
        color = new RGBColor(color);
        if (!color.ok) return;
        this._ColorTable[code] = color.toRGB();
    }

    private AddLine(line: string, raw: string, fragment: boolean, skip: boolean, formats: LineFormat[], remote: boolean) {
        const data: ParserLine = { raw: raw, line: line, fragment: fragment, gagged: skip, formats: this.pruneFormats(formats, line.length, fragment), remote: remote };
        this.emit('add-line', data);
        this.EndOfLine = !fragment;
    }

    private pruneFormats(formats, textLen, fragment) {
        //no formats or only 1 format
        if (!formats || formats.length < 2) return formats;
        const l = formats.length;
        const nF = [];
        for (let f = 0; f < l; f++) {
            const format = formats[f];
            let end;
            if (f < l - 1) {
                const nFormat = formats[f + 1];
                //skip format until find one that has different offset
                if (format.offset === nFormat.offset && nFormat.formatType === format.formatType)
                    continue;
                end = nFormat.offset;
                //empty link
                if (format.formatType === FormatType.Link && end - format.offset === 0 && nFormat.formatType === FormatType.LinkEnd)
                    continue;
                //empty send
                if (format.formatType === FormatType.MXPSend && end - format.offset === 0 && nFormat.formatType === FormatType.MXPSendEnd)
                    continue;
                //empty link
                if (format.formatType === FormatType.MXPLink && end - format.offset === 0 && nFormat.formatType === FormatType.MXPLinkEnd)
                    continue;
            }
            //trailing link with no text or empty format block and not fragment
            else if (!fragment && format.offset === textLen && textLen !== 0 && ((format.formatType === FormatType.Normal && !format.hr) || format.formatType === FormatType.Link || format.formatType === FormatType.MXPSend || format.formatType === FormatType.MXPLink))
                continue;
            nF.push(format);
        }
        return nF;
    }

    private GetEntity(entity: string) {
        if (entity === 'text')
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

    private ClearMXPToTag(tag: MXPTag, custom?: string, secure?: boolean) {
        if (custom == null) custom = '';
        let tmp = new MXPStyle();
        tmp.tag = MXPTag.None;
        let ml = this.mxpStyles.length - 1;
        for (; ml >= 0; ml--) {
            if (this.mxpStyles[ml].tag !== tag && this.mxpStyles[ml].custom !== custom) {
                if (!this.mxpStyles[ml].open && !secure) continue;
                tmp = this.mxpStyles.splice(ml, 1)[0];
            }
            else
                break;
        }
        //return the matching tag
        if (ml >= 0 && this.mxpStyles.length > 0)
            tmp = this.mxpStyles.splice(ml, 1)[0];
        else if (this.mxpStyles.length === 0)
            this.ResetMXP();
        return tmp;
    }

    private ClearMXPOpen() {
        let ml = this.mxpStyles.length;
        while (ml--) {
            if (!this.mxpStyles[ml].open) continue;
            this.mxpStyles.splice(ml, 1);
        }
        if (this.mxpStyles.length === 0)
            this.ResetMXP();
    }

    private getMXPOpenFormatBlocks() {
        if (!this.mxpState.on) return [];
        let m = 0;
        const ml = this.mxpStyles.length;
        const formats = [];
        for (; m < ml; m++) {
            if (this.mxpStyles[m].tag === MXPTag.A || this.mxpStyles[m].tag === MXPTag.SEND)
                formats.push(Object.assign({}, this.mxpStyles[m].properties));
        }
        return formats;
    }

    private getMXPCloseFormatBlocks() {
        if (!this.mxpState.on) return [];
        let ml = this.mxpStyles.length;
        const formats = [];
        while (ml--) {
            if (this.mxpStyles[ml].tag === MXPTag.A)
                formats.push({ formatType: FormatType.MXPLinkEnd });
            else if (this.mxpStyles[ml].tag === MXPTag.SEND)
                formats.push({ formatType: FormatType.MXPSendEnd });
        }
        return formats;
    }

    private getMXPBlock(tag: string, args, remote, oTag?, blocks?): MXPBlock {
        let tmp;
        let arg;
        let sArg;
        let sArgs;
        let color;
        let x;
        let xl = args.length;
        let e;
        let sl;
        let s;
        let href = '';
        let hint = '';
        let expire = '';
        let prompt = false;
        tag = tag.toUpperCase();
        if (this.enableDebug) {
            this.emit('debug', 'MXP Tag: ' + tag);
            this.emit('debug', 'MXP Tag Args: ' + args);
        }
        switch (tag) {
            case 'C':
            case 'COLOR':
                tmp = this.CloneCurrentStyle();
                tmp.tag = MXPTag[tag];
                tmp.open = true;
                if (xl > 0) {
                    arg = args[0].split('=');
                    if (arg.length > 1) {
                        color = new RGBColor(stripQuotes(arg[1]));
                        if (!color.ok) return null;
                        if (arg[0].toUpperCase() === 'BACK')
                            tmp.back = color.toRGB();
                        else
                            tmp.fore = color.toRGB();
                    }
                    else {
                        color = new RGBColor(stripQuotes(arg[0]));
                        if (color.ok)
                            tmp.fore = color.toRGB();
                    }
                }
                if (xl > 1) {
                    arg = args[1].split('=');
                    if (arg.length > 1) {
                        color = new RGBColor(stripQuotes(arg[1]));
                        if (!color.ok) return null;
                        if (arg[0].toUpperCase() === 'FORE')
                            tmp.fore = color.toRGB();
                        else
                            tmp.back = color.toRGB();

                    }
                    else {
                        color = new RGBColor(stripQuotes(arg[0]));
                        if (color.ok)
                            tmp.back = color.toRGB();
                    }
                }
                tmp.custom = '';
                this.mxpStyles.push(tmp);
                return null;
            case 'B':
            case 'BOLD':
            case 'STRONG':
                tmp = this.CloneCurrentStyle();
                tmp.open = true;
                tmp.tag = MXPTag[tag];
                tmp.style |= FontStyle.Bold;
                tmp.custom = '';
                this.mxpStyles.push(tmp);
                return null;
            case 'FONT':
                tmp = this.CloneCurrentStyle();
                tmp.open = true;
                tmp.tag = MXPTag[tag];
                for (x = 0; x < xl; x++) {
                    arg = args[x].split('=');
                    if (arg.length > 1) {
                        switch (arg[0].toUpperCase()) {
                            case 'SIZE':
                                if (this.isNumber(arg[1]))
                                    tmp.fontSize = arg[1] + 'pt';
                                else
                                    tmp.fontSize = arg[1] || 0;
                                break;
                            case 'COLOR':
                                sArgs = arg[1].split(',');
                                color = new RGBColor(stripQuotes(sArgs[0]));
                                if (color.ok) tmp.fore = color.toRGB();
                                for (s = 1, sl = sArgs.length; s < sl; s++) {
                                    switch (sArgs[s].toLowerCase()) {
                                        case 'bold':
                                            tmp.style |= FontStyle.Bold;
                                            break;
                                        case 'italic':
                                            tmp.style |= FontStyle.Italic;
                                            break;
                                        case 'underline':
                                            tmp.style |= FontStyle.Underline;
                                            break;
                                        case 'blink':
                                            tmp.style |= FontStyle.Slow;
                                            break;
                                        case 'inverse':
                                            tmp.style |= FontStyle.Inverse;
                                            break;
                                        case 'hidden':
                                            tmp.style |= FontStyle.Hidden;
                                            break;
                                        case 'strikeout':
                                            tmp.style |= FontStyle.Strikeout;
                                            break;
                                        case 'overline':
                                            tmp.style |= FontStyle.Overline;
                                            break;
                                        case 'doubleunderline':
                                            tmp.style |= FontStyle.DoubleUnderline;
                                            break;
                                    }
                                }
                                break;
                            case 'BACK':
                                color = new RGBColor(stripQuotes(arg[1]));
                                if (color.ok) tmp.back = color.toRGB();
                                break;
                            case 'FACE':
                                tmp.font = stripQuotes(arg[1]) || 0;
                                break;
                            default:
                                if (this.enableDebug) this.emit('debug', 'Invalid Argument for ' + tag + ': ' + arg[0]);
                                break;
                        }
                    }
                    else if (x === 0) {
                        tmp.font = stripQuotes(args[x]) || 0;
                    }
                    else if (x === 1) {
                        if (this.isNumber(args[x]))
                            tmp.fontSize = args[x] + 'pt';
                        else
                            tmp.fontSize = args[x] || 0;
                    }
                    else if (x === 2) {
                        color = new RGBColor(stripQuotes(args[x]));
                        if (color.ok) tmp.fore = color.toRGB();
                    }
                    else if (x === 3) {
                        color = new RGBColor(stripQuotes(args[x]));
                        if (color.ok) tmp.back = color.toRGB();
                    }
                }
                tmp.custom = '';
                this.mxpStyles.push(tmp);
                return null;
            case 'H':
            case 'HIGH':
                tmp = this.CloneCurrentStyle();
                tmp.open = true;
                tmp.tag = MXPTag[tag];
                tmp.high = true;
                tmp.custom = '';
                this.mxpStyles.push(tmp);
                return null;
            case 'I':
            case 'ITALIC':
            case 'EM':
                tmp = this.CloneCurrentStyle();
                tmp.open = true;
                tmp.tag = MXPTag[tag];
                tmp.style |= FontStyle.Italic;
                tmp.custom = '';
                this.mxpStyles.push(tmp);
                return null;
            case 'U':
            case 'UNDERLINE':
                tmp = this.CloneCurrentStyle();
                tmp.open = true;
                tmp.tag = MXPTag[tag];
                tmp.style |= FontStyle.Underline;
                tmp.custom = '';
                this.mxpStyles.push(tmp);
                return null;
            case 'S':
            case 'STRIKEOUT':
                tmp = this.CloneCurrentStyle();
                tmp.open = true;
                tmp.tag = MXPTag[tag];
                tmp.style |= FontStyle.Strikeout;
                tmp.custom = '';
                this.mxpStyles.push(tmp);
                return null;
            case '/B':
            case '/BOLD':
            case '/STRONG':
            case '/H':
            case '/HIGH':
            case '/I':
            case '/ITALIC':
            case '/EM':
            case '/U':
            case '/UNDERLINE':
            case '/S':
            case '/STRIKEOUT':
            case '/C':
            case '/COLOR':
            case '/FONT':
                this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                return null;
        }
        if (this.mxpState.lineType === lineType.Secure || this.mxpState.lineType === lineType.LockSecure || this.mxpState.lineType === lineType.TempSecure) {
            switch (tag) {
                case 'IMAGE':
                    e = {
                        formatType: FormatType.Image,
                        name: '',
                        url: this.DefaultImgUrl,
                        t: '',
                        h: '',
                        w: '',
                        hspace: '',
                        vspace: '',
                        align: 'bottom',
                        ismap: false
                    };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case 'FNAME':
                                e.name = stripQuotes(arg[1]);
                                break;
                            case 'URL':
                                e.url = stripQuotes(arg[1]);
                                break;
                            case 'TYPE':
                            case 'T':
                                if (arg[1].length > 0)
                                    e.type = arg[1];
                                break;
                            case 'HEIGHT':
                            case 'H':
                                e.h = stripQuotes(arg[1]);
                                break;
                            case 'WIDTH':
                            case 'W':
                                e.w = stripQuotes(arg[1]);
                                break;
                            case 'HSPACE':
                                e.hspace = arg[1];
                                break;
                            case 'VSPACE':
                                e.vspace = arg[1];
                                break;
                            case 'ALIGN':
                                e.align = arg[1].toLowerCase();
                                break;
                            case 'ISMAP':
                                e.ismap = true;
                                break;
                            default:
                                if (x === 0)
                                    e.name = stripQuotes(args[x]);
                                else if (x === 1)
                                    e.url = stripQuotes(args[x]);
                                else if (x === 2 && args[x].length > 0)
                                    e.type = args[x];
                                else if (x === 3)
                                    e.h = stripQuotes(args[x]);
                                else if (x === 4)
                                    e.w = stripQuotes(args[x]);
                                else if (x === 5)
                                    e.hspace = args[x];
                                else if (x === 6)
                                    e.vspace = args[x];
                                else if (x === 7)
                                    e.align = args[x].toLowerCase();
                                break;
                        }
                    }
                    return { format: e, text: null };
                case '!AT':
                case '!ATTLIST':
                    if (args.length === 0) return null;
                    e = args[0];
                    //not defined or if not from the same origin and not open cant change it
                    if (!this.mxpElements[e] || (this.mxpEntities[e].remote !== e.remote && !this.mxpEntities[e].open))
                        return null;
                    //clear out any old ones
                    this.mxpElements[e].attributes = {};
                    this.mxpElements[e].attributeIndexes = [];
                    for (x = 1; x < xl; x++) {
                        sArgs = args[x].split('=');
                        if (sArgs.length > 1)
                            this.mxpElements[e].attributes[sArgs[0].toLowerCase()] = sArgs[1];
                        else
                            this.mxpElements[e].attributes[sArgs[0].toLowerCase()] = '';
                        this.mxpElements[e].attributeIndexes.push(sArgs[0].toLowerCase());
                    }
                    break;
                case '!TAG':
                    e = new Tag();
                    e.remote = remote;
                    for (x = 0; x < xl; x++) {
                        //special case, as attribute list has = in it so test for it
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case 'WINDOWNAME':
                                e.window = stripQuotes(arg[1]);
                                break;
                            case 'FORE':
                                color = new RGBColor(stripQuotes(arg[1]));
                                if (color.ok) e.fore = color.toRGB();
                                break;
                            case 'BACK':
                                color = new RGBColor(stripQuotes(arg[1]));
                                if (color.ok) e.back = color.toRGB();
                                break;
                            case 'GAG':
                                e.gag = true;
                                break;
                            case 'ENABLE':
                                e.enabled = true;
                                break;
                            case 'DISABLE':
                                e.enabled = false;
                                break;
                            default:
                                if (x === 0) {
                                    tmp = +args[x];
                                    if (!isNaN(tmp)) e.index = tmp;
                                }
                                else if (x === 1)
                                    e.window = stripQuotes(args[x]);
                                else if (x === 2) {
                                    color = new RGBColor(stripQuotes(args[x]));
                                    if (color.ok) e.fore = color.toRGB();
                                }
                                else if (x === 3) {
                                    color = new RGBColor(stripQuotes(args[x]));
                                    if (color.ok) e.back = color.toRGB();
                                }
                                break;
                        }
                    }
                    if (e.fore.length > 0 && e.back.length > 0)
                        e.definition = `<C "${e.fore}" "${e.back}">`;
                    else if (e.fore.length > 0)
                        e.definition = `<C "${e.fore}">`;
                    else if (e.back.length > 0)
                        e.definition = `<C BACK="${e.fore}">`;
                    if (e.definition.length > 0)
                        e.closeDefinition = '</C>';
                    if (this.mxpLines[e.index]) {
                        //mud can over ride local, but local can not override remote
                        if (e.remote || this.mxpLines[e.index].remote === e.remote)
                            this.mxpLines[e.index] = e;
                    }
                    else
                        this.mxpLines[e.index] = e;
                    break;
                case '!EL':
                case '!ELEMENT':
                    e = new Element(remote);
                    for (x = 0; x < xl; x++) {
                        //special case, as attribute list has = in it so test for it
                        if (args[x].toUpperCase().startsWith('ATT=')) {
                            arg = stripQuotes(args[x]).substring(4).split(' ');
                            for (s = 0, sl = arg.length; s < sl; s++) {
                                sArgs = stripQuotes(arg[s]).split('=');
                                if (sArgs.length > 1)
                                    e.attributes[sArgs[0].toLowerCase()] = stripQuotes(sArgs[1]);
                                else
                                    e.attributes[sArgs[0].toLowerCase()] = '';
                                e.attributeIndexes.push(sArgs[0].toLowerCase());
                            }
                            continue;
                        }
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case 'TAG':
                                tmp = +arg[1];
                                if (!isNaN(tmp)) e.tag = tmp;
                                break;
                            case 'FLAG':
                                e.flag = stripQuotes(arg[1]);
                                break;
                            case 'OPEN':
                                e.open = true;
                                break;
                            case 'DELETE':
                                if (this.mxpElements[e.name] && (this.mxpEntities[e.name].remote === e.remote || this.mxpEntities[e.name].open))
                                    delete this.mxpEntities[e.name];
                                return null;
                            case 'EMPTY':
                                e.empty = true;
                                break;
                            /*
                          case "HIDDEN":
                            e.hidden = true;
                            break;
                            */
                            case 'SECURE':
                                e.open = false;
                                break;
                            default:
                                if (x === 0)
                                    e.name = stripQuotes(args[x]).toUpperCase();
                                else if (x === 1) {
                                    e.definition = stripQuotes(args[x]);
                                    e.closeDefinition = this.GetCloseTags(e.definition);
                                    if (this.enableDebug) this.emit('debug', 'MXP close definition: ' + e.closeDefinition);
                                }
                                else if (x === 2) {
                                    arg = args[x].substring(4).split(' ');
                                    for (s = 0, sl = arg.length; s < sl; s++) {
                                        sArgs = arg[s].split('=');
                                        if (sArgs.length > 1)
                                            e.attributes[sArgs[0]] = sArgs[1];
                                        else
                                            e.attributes[sArgs[0]] = '';
                                        e.attributeIndexes.push(sArgs[0]);
                                    }
                                }
                                else if (x === 3) {
                                    tmp = +args[x];
                                    if (!isNaN(tmp)) e.tag = tmp;
                                }
                                else if (x === 4)
                                    e.flag = stripQuotes(args[x]);
                                break;
                        }
                    }
                    if (e.tag > 19 && e.tag < 100) {
                        tmp = new Tag(e.tag);
                        tmp.element = e.name;
                        if (this.mxpLines[tmp.index]) {
                            //mud can over ride local, but local can not override remote
                            if (e.remote || this.mxpLines[tmp.index].remote === e.remote)
                                this.mxpLines[tmp.index] = tmp;
                        }
                        else
                            this.mxpLines[tmp.index] = tmp;
                    }
                    if (this.mxpElements[e.name]) {
                        //can only override if from same origin (eg from mud, or from local) or if an open tag
                        if (this.mxpElements[e.name].remote === e.remote || this.mxpEntities[e.name].open)
                            this.mxpElements[e.name] = e;
                    }
                    else
                        this.mxpElements[e.name] = e;
                    break;
                case '!EN':
                case '!ENTITY':
                    e = new Entity(remote);
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case 'DESC':
                                e.description = stripQuotes(arg[1]);
                                break;
                            case 'PRIVATE':
                                e.publish = false;
                                break;
                            case 'PUBLISH':
                                e.publish = true;
                                break;
                            case 'DELETE':
                                //can only modify if from same origin, eg mud can only mod mud, and user can only mod user
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote === e.remote)
                                    delete this.mxpEntities[e.name];
                                return null;
                            case 'ADD':
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote === e.remote) {
                                    if (!this.mxpEntities[e.name].value)
                                        this.mxpEntities[e.name].value = e.value;
                                    else
                                        this.mxpEntities[e.name].value += '|' + e.value;
                                    return null;
                                }
                                break;
                            case 'REMOVE':
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote === e.remote) {
                                    if (this.mxpEntities[e.name].value) {
                                        sArgs = this.mxpEntities[e.name].value.split('|');
                                        sArg = [];
                                        for (s = 0, sl = sArgs.length; s < sl; s++) {
                                            if (sArgs[s] !== e.value)
                                                sArg.push(sArgs[s]);
                                        }
                                        this.mxpEntities[e.name].value = sArg.join('|');
                                    }
                                }
                                return null;
                            default:
                                if (x === 0)
                                    e.name = stripQuotes(args[x]);
                                else if (x === 1)
                                    e.value = stripQuotes(args[x]);
                                else if (x === 2)
                                    e.description = stripQuotes(args[x]);
                                break;
                        }
                    }
                    if (this.mxpEntities[e.name]) {
                        if (this.mxpEntities[e.name].remote === e.remote)
                            this.mxpEntities[e.name] = e;
                    }
                    else
                        this.mxpEntities[e.name] = e;
                    break;
                case '/V':
                case '/VAR':
                    tmp = this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                    e = new Entity(remote);
                    if (this.mxpState.captured.length > 0)
                        e.value = this.mxpState.captured.pop().join('');
                    else
                        e.value = '';
                    this.mxpState.capture--;
                    if (this.enableDebug) this.emit('debug', 'MXP captured: ' + e.value);
                    args = tmp.obj;
                    xl = args.length;
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        switch (arg[0].toUpperCase()) {
                            case 'DESC':
                                e.description = stripQuotes(arg[1]);
                                break;
                            case 'PRIVATE':
                                e.publish = false;
                                break;
                            case 'PUBLISH':
                                e.publish = true;
                                break;
                            case 'DELETE':
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote === e.remote)
                                    delete this.mxpEntities[e.name];
                                return null;
                            case 'ADD':
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote === e.remote) {
                                    if (!this.mxpEntities[e.name].value)
                                        this.mxpEntities[e.name].value = e.value;
                                    else
                                        this.mxpEntities[e.name].value += '|' + e.value;
                                    return null;
                                }
                                break;
                            case 'REMOVE':
                                if (this.mxpEntities[e.name] && this.mxpEntities[e.name].remote === e.remote) {
                                    if (this.mxpEntities[e.name].value) {
                                        sArgs = this.mxpEntities[e.name].value.split('|');
                                        sArg = [];
                                        for (s = 0, sl = sArgs.length; s < sl; s++) {
                                            if (sArgs[s] !== e.value)
                                                sArg.push(sArgs[s]);
                                        }
                                        this.mxpEntities[e.name].value = sArg.join('|');
                                    }
                                }
                                return null;
                            default:
                                if (x === 0)
                                    e.name = stripQuotes(args[x]);
                                else if (x === 1)
                                    e.description = stripQuotes(args[x]);
                                break;
                        }
                    }
                    if (this.mxpEntities[e.name]) {
                        if (this.mxpEntities[e.name].remote === e.remote)
                            this.mxpEntities[e.name] = e;
                    }
                    else
                        this.mxpEntities[e.name] = e;
                    break;
                case 'V':
                case 'VAR':
                    this.mxpState.captured.push([]);
                    this.mxpState.capture++;
                    tmp = this.CloneCurrentStyle();
                    tmp.open = false;
                    tmp.tag = MXPTag[tag];
                    tmp.obj = args;
                    tmp.custom = '';
                    this.mxpStyles.push(tmp);
                    return null;
                case 'GAUGE':
                    e = { value: 0, max: 1, caption: '', color: 0 };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case 'VALUE':
                                    tmp = parseFloat(this.GetEntity(arg[1]));
                                    if (isNaN(tmp))
                                        tmp = this.GetEntity(arg[1]);
                                    e.value = tmp;
                                    break;
                                case 'MAX':
                                    tmp = parseFloat(this.GetEntity(arg[1]));
                                    if (isNaN(tmp))
                                        tmp = this.GetEntity(arg[1]);
                                    e.max = tmp;
                                    break;
                                case 'CAPTION':  //volume
                                    if (arg[1].length > 0)
                                        e.caption = stripQuotes(arg[1]);
                                    break;
                                case 'COLOR':  //repeat
                                    color = new RGBColor(stripQuotes(arg[1]));
                                    if (color.ok) e.color = color.toRGB();
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
                            e.caption = stripQuotes(args[x]);
                        else if (x === 3 && args[x].length > 0) {
                            color = new RGBColor(stripQuotes(arg[1]));
                            if (color.ok) e.color = color.toRGB();
                        }
                    }
                    this.mxpState.expanded = false;
                    this.emit('gauge', e);
                    break;
                case 'STAT':
                    e = { value: 0, max: 1, caption: '' };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case 'VALUE':
                                    tmp = parseFloat(this.GetEntity(arg[1]));
                                    if (isNaN(tmp))
                                        tmp = this.GetEntity(arg[1]);
                                    e.value = tmp;
                                    break;
                                case 'MAX':
                                    tmp = parseFloat(this.GetEntity(arg[1]));
                                    if (isNaN(tmp))
                                        tmp = this.GetEntity(arg[1]);
                                    e.max = tmp;
                                    break;
                                case 'CAPTION':  //volume
                                    if (arg[1].length > 0)
                                        e.caption = stripQuotes(arg[1]);
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
                            e.caption = stripQuotes(args[x]);
                    }
                    this.mxpState.expanded = false;
                    this.emit('stat', e);
                    break;
                case 'MUSIC':
                    e = { off: false, file: '', url: '', volume: 100, repeat: 1, priority: 50, type: '', continue: true };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case 'FNAME':
                                    e.file = stripQuotes(arg[1]);
                                    if (e.file.toLowerCase() === 'off') {
                                        e.off = true;
                                        e.file = '';
                                    }
                                    break;
                                case 'V':  //volume
                                    tmp = +arg[1];
                                    if (isNaN(tmp))
                                        tmp = 100;
                                    e.volume = tmp;
                                    break;
                                case 'L':  //repeat
                                    tmp = +arg[1];
                                    if (isNaN(tmp))
                                        tmp = 1;
                                    e.repeat = tmp;
                                    break;
                                case 'C':  //continue
                                    e.continue = arg[1] !== '0';
                                    break;
                                case 'T':  //type
                                    if (arg[1].length > 0)
                                        e.type = arg[1];
                                    break;
                                case 'U':  //url
                                    e.url = stripQuotes(arg[1]);
                                    if (!e.url.endsWith('/') && e.url.length > 0)
                                        e.Url += '/';
                                    break;
                            }
                        }
                        else if (x === 0) {
                            e.file = stripQuotes(args[x]);
                            if (e.file.toLowerCase() === 'off') {
                                e.off = true;
                                e.file = '';
                            }
                        }
                        else if (x === 1) {
                            tmp = +args[x];
                            if (isNaN(tmp))
                                tmp = 100;
                            e.volume = tmp;
                        }
                        else if (x === 2) {
                            tmp = +args[x];
                            if (isNaN(tmp))
                                tmp = 1;
                            e.repeat = tmp;
                        }
                        else if (x === 3)
                            e.continue = args[x] !== '0';
                        else if (x === 4) {
                            if (args[x].length > 0)
                                e.type = args[x];
                        }
                        else if (x === 5) {
                            e.url = stripQuotes(args[x]);
                            if (!e.url.endsWith('/') && e.url.length > 0)
                                e.Url += '/';
                        }
                    }
                    this.emit('music', e);
                    break;
                case 'SOUND':
                    e = { off: false, file: '', url: '', volume: 100, repeat: 1, priority: 50, type: '', continue: true };
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case 'FNAME':
                                    e.file = stripQuotes(arg[1]);
                                    if (e.file.toLowerCase() === 'off') {
                                        e.off = true;
                                        e.file = '';
                                    }
                                    break;
                                case 'V':  //volume
                                    tmp = +arg[1];
                                    if (isNaN(tmp))
                                        tmp = 100;
                                    e.volume = tmp;
                                    break;
                                case 'L':  //repeat
                                    tmp = +arg[1];
                                    if (isNaN(tmp))
                                        tmp = 1;
                                    e.repeat = tmp;
                                    break;
                                case 'P':  //priority
                                    tmp = +arg[1];
                                    if (isNaN(tmp))
                                        tmp = 1;
                                    e.priority = tmp;
                                    break;
                                case 'T':  //type
                                    if (arg[1].length > 0)
                                        e.type = arg[1];
                                    break;
                                case 'U':  //url
                                    e.url = stripQuotes(arg[1]);
                                    if (!e.url.endsWith('/') && e.url.length > 0)
                                        e.Url += '/';
                                    break;
                            }
                        }
                        else if (x === 0) {
                            e.file = stripQuotes(args[x]);
                            if (e.file.toLowerCase() === 'off') {
                                e.off = true;
                                e.file = '';
                            }
                        }
                        else if (x === 1) {
                            tmp = +args[x];
                            if (isNaN(tmp))
                                tmp = 100;
                            e.volume = tmp;
                        }
                        else if (x === 2) {
                            tmp = +args[x];
                            if (isNaN(tmp))
                                tmp = 1;
                            e.repeat = tmp;
                        }
                        else if (x === 3) {
                            tmp = +args[x];
                            if (isNaN(tmp))
                                tmp = 1;
                            e.priority = tmp;
                        }
                        else if (x === 4) {
                            if (args[x].length > 0)
                                e.type = args[x];
                        }
                        else if (x === 5) {
                            e.url = stripQuotes(args[x]);
                            if (!e.url.endsWith('/') && e.url.length > 0)
                                e.Url += '/';
                        }
                    }
                    this.emit('sound', e);
                    break;
                case 'EXPIRE':
                    //emit expire event to handle old links
                    this.emit('expire-links', args);
                    //expire any links in the current line that match
                    this.cleanMXPExpired(blocks, args?.[0] || '');
                    break;
                case 'VERSION':
                    if (xl > 0)
                        this.StyleVersion = args[0];
                    else
                        this.emit('MXP-tag-reply', tag, []);
                    break;
                case 'USER':
                case 'PASSWORD':
                    this.emit('MXP-tag-reply', tag, args);
                    break;
                case 'SUPPORT':
                    sArgs = [];
                    if (xl > 0) {
                        for (x = 0; x < xl; x++) {
                            arg = stripQuotes(args[x]);
                            if (arg.indexOf('.') === -1) {
                                arg = arg.toUpperCase();
                                switch (arg) {
                                    //TODO re-enable once font size/face  are supported
                                    //case 'FONT':
                                    case 'IMAGE':
                                    case 'HR':
                                    case 'A':
                                    case 'SEND':
                                    case 'B':
                                    case 'I':
                                    case 'COLOR':
                                    case 'C':
                                    case 'EM':
                                    case 'ITALIC':
                                    case 'STRONG':
                                    case 'BOLD':
                                    case 'UNDERLINE':
                                    case 'U':
                                    case 'S':
                                    case 'STRIKEOUT':
                                    case 'STRIKE':
                                    case 'H':
                                    case 'HIGH':
                                    case 'EXPIRE':
                                    case 'VERSION':
                                    case 'SUPPORT':
                                    case 'NOBR':
                                    case 'P':
                                    case 'BR':
                                    case 'SBR':
                                    case 'SOUND':
                                    case 'MUSIC':
                                    case 'VAR':
                                    case 'USER':
                                    case 'PASSWORD':
                                    case 'H1':
                                    case 'H2':
                                    case 'H3':
                                    case 'H4':
                                    case 'H5':
                                    case 'H6':
                                    case 'RESET':
                                    case 'GAUGE':
                                    case 'STAT':
                                        sArgs.push('+' + name);
                                        break;
                                    default:
                                        sArgs.push('-' + name);
                                        break;
                                }
                            }
                            else {
                                arg = args[x].split('.');
                                arg[0] = arg[0].toUpperCase();
                                switch (arg[0]) {
                                    case 'IMAGE':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            sArgs.push('+image.fname');
                                            sArgs.push('+image.url');
                                            sArgs.push('+image.t');
                                            sArgs.push('+image.h');
                                            sArgs.push('+image.w');
                                            sArgs.push('+image.hspace');
                                            sArgs.push('+image.vspace');
                                            sArgs.push('+image.align');
                                            sArgs.push('+image.ismap');
                                        }
                                        break;
                                    case 'SOUND':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            sArgs.push('+sound.v');
                                            sArgs.push('+sound.l');
                                            sArgs.push('+sound.p');
                                            sArgs.push('+sound.t');
                                            sArgs.push('+sound.u');
                                        }
                                        break;
                                    case 'MUSIC':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            sArgs.push('+music.v');
                                            sArgs.push('+music.l');
                                            sArgs.push('+music.c');
                                            sArgs.push('+music.t');
                                            sArgs.push('+music.u');
                                        }
                                        break;
                                    case 'A':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            sArgs.push('+a.href');
                                            sArgs.push('+a.hint');
                                            sArgs.push('+a.expire');
                                        }
                                        break;
                                    case 'SEND':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            sArgs.push('+send.href');
                                            sArgs.push('+send.hint');
                                            sArgs.push('+send.prompt');
                                            sArgs.push('+send.expire');
                                        }
                                        break;
                                    case 'COLOR':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            sArgs.push('+color.fore');
                                            sArgs.push('+color.back');
                                        }
                                        break;
                                    case 'C':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            sArgs.push('+c.fore');
                                            sArgs.push('+c.back');
                                        }
                                        break;
                                    case 'FONT':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            //TODO switch to + when face and size supported
                                            sArgs.push('-font.face');
                                            sArgs.push('-font.size');
                                            sArgs.push('+font.color');
                                            sArgs.push('+font.back');
                                        }
                                        break;
                                    case 'EXPIRE':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else
                                            sArgs.push('+expire.Name');
                                        break;
                                    case 'GAUGE':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            sArgs.push('+gauge.max');
                                            sArgs.push('+gauge.caption');
                                            sArgs.push('+gauge.color');
                                        }
                                        break;
                                    case 'STAT':
                                        if (arg[1] !== '*')
                                            sArgs.push('+' + arg[0] + '.' + arg[1]);
                                        else {
                                            sArgs.push('+stat.max');
                                            sArgs.push('+stat.caption');
                                        }
                                        break;
                                    default:
                                        if (arg[1] !== '*')
                                            sArgs.push('-' + arg[0] + '.' + arg[1]);
                                        else
                                            sArgs.push('-' + arg[0]);
                                        break;
                                }
                            }
                        }
                    }
                    else
                        //TODO enable font once font face/size are supported
                        sArgs = ['+A', '+SEND', '+B', '+I', '+COLOR', '+C', '+EM', '+ITALIC', '+STRONG', '+BOLD', '+UNDERLINE', '+U', '+S', '+STRIKEOUT', '+H', '+HIGH', '-FONT', '+EXPIRE', '+VERSION', '+SUPPORT', '+NOBR', '+P', '+BR', '+SBR', '+VAR', '+SOUND', '+MUSIC', '+USER', '+PASSWORD', '+RESET', '+STRIKE', '+H1', '+H2', '+H3', '+H4', '+H5', '+H6', '+IMAGE', '+STAT', '+GAUGE'];
                    this.emit('MXP-tag-reply', tag, sArgs);
                    break;
                case 'A':
                    tmp = this.CloneCurrentStyle();
                    tmp.open = false;
                    tmp.tag = MXPTag[tag];
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case 'HREF':
                                    href = stripQuotes(arg[1]);
                                    break;
                                case 'HINT':
                                    hint = stripQuotes(arg[1]);
                                    break;
                                case 'EXPIRE':
                                    expire = stripQuotes(arg[1]);
                                    break;
                                default:
                                    if (this.enableDebug) this.emit('debug', 'Invalid Argument for ' + tag + ': ' + arg[0]);
                                    break;
                            }
                        }
                        else if (x === 0)
                            href = stripQuotes(args[x]);
                        else if (x === 1)
                            hint = stripQuotes(args[x]);
                        else if (x === 2)
                            expire = stripQuotes(args[x]);
                    }
                    tmp.custom = '';
                    tmp.properties = {
                        formatType: FormatType.MXPLink,
                        href: href,
                        hint: hint,
                        expire: expire
                    };
                    this.mxpStyles.push(tmp);
                    if (hint.length === 0)
                        hint = href;
                    return {
                        format: {
                            formatType: FormatType.MXPLink,
                            href: href,
                            hint: hint,
                            expire: expire
                        },
                        text: null
                    };
                case 'SEND':
                    tmp = this.CloneCurrentStyle();
                    tmp.open = false;
                    tmp.tag = MXPTag[tag];
                    for (x = 0; x < xl; x++) {
                        arg = args[x].split('=');
                        if (arg[0] === 'PROMPT')
                            prompt = true;
                        else if (arg.length > 1) {
                            switch (arg[0].toUpperCase()) {
                                case 'HREF':
                                    href = stripQuotes(arg[1]);
                                    break;
                                case 'HINT':
                                    hint = stripQuotes(arg[1]);
                                    break;
                                case 'EXPIRE':
                                    expire = stripQuotes(arg[1]);
                                    break;
                                case 'PROMPT':
                                    prompt = true;
                                    break;
                                default:
                                    if (this.enableDebug) this.emit('debug', 'Invalid Argument for ' + tag + ': ' + arg[0]);
                                    break;
                            }
                        }
                        else if (x === 0)
                            href = stripQuotes(args[x]);
                        else if (x === 1)
                            hint = stripQuotes(args[x]);
                        else if (x === 2)
                            prompt = true;
                        else if (x === 3)
                            expire = stripQuotes(args[x]);
                    }
                    tmp.custom = '';
                    this.mxpStyles.push(tmp);
                    if (href.length === 0)
                        href = '&text;';
                    if (hint.length === 0)
                        hint = href;
                    const cmds = href.split('|');
                    let tt;
                    if (cmds.length > 1) {
                        const caps = hint.split('|');
                        if (caps.length === cmds.length + 1) {
                            hint = caps[0];
                            caps.shift();
                            tt = '[\'' + caps.join('\',\'') + '\']';
                        }
                        href = '[\'' + cmds.join('\',\'') + '\']';
                    }
                    else
                        href = '\'' + href + '\'';
                    tmp.properties = {
                        formatType: FormatType.MXPSend,
                        href: href,
                        hint: hint,
                        expire: expire,
                        prompt: prompt,
                        tt: tt || ''
                    };
                    return {
                        format: {
                            formatType: FormatType.MXPSend,
                            href: href,
                            hint: hint,
                            expire: expire,
                            prompt: prompt,
                            tt: tt || ''
                        },
                        text: null
                    };
                case 'H1':
                case 'H2':
                case 'H3':
                case 'H4':
                case 'H5':
                case 'H6':
                    tmp = this.CloneCurrentStyle();
                    tmp.open = true;
                    tmp.tag = MXPTag[tag];
                    tmp.style |= FontStyle.Bold;
                    tmp.custom = '';
                    this.mxpStyles.push(tmp);
                    return null;
                case '/A':
                    this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                    return {
                        format: {
                            formatType: FormatType.MXPLinkEnd
                        }, text: null
                    };
                case '/SEND':
                    this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                    return {
                        format: {
                            formatType: FormatType.MXPSendEnd
                        }, text: null
                    };
                case '/H1':
                case '/H2':
                case '/H3':
                case '/H4':
                case '/H5':
                case '/H6':
                    this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                    return null;
                case 'NOBR':
                    this.mxpState.noBreak = true;
                    return null;
                case '/P':
                    this.ClearMXPToTag(MXPTag[tag.substring(1)]);
                    this.mxpState.paragraph = false;
                    return null;
                case 'P':
                    tmp = this.CloneCurrentStyle();
                    tmp.open = false;
                    tmp.tag = MXPTag[tag];
                    tmp.custom = '';
                    this.mxpStyles.push(tmp);
                    this.mxpState.paragraph = true;
                    return null;
                case 'SBR':
                    return {
                        format: null, text: ' \u200B'
                    };
                case 'RESET':
                    this.ResetMXP();
                    return null;
                case 'HR':
                    const mxp: MXPStyle = this.GetCurrentStyle();
                    const colors = this.getColors(mxp);
                    return {
                        format: {
                            formatType: FormatType.Normal,
                            offset: 0,
                            color: colors.fore,
                            background: colors.back,
                            size: mxp.fontSize,
                            font: mxp.font,
                            style: mxp.style | (this._CurrentAttributes & ~FontStyle.Bold),
                            hr: true
                        }, text: null
                    };
            }
        }
        if (this.mxpElements[tag]) {
            e = this.mxpElements[tag];
            //not open and not in correct lineType
            if (!e.open && this.mxpState.lineType !== lineType.Secure && this.mxpState.lineType !== lineType.LockSecure && this.mxpState.lineType !== lineType.TempSecure)
                return null;
            tmp = this.CloneCurrentStyle();
            tmp.open = e.open;
            tmp.tag = MXPTag.Custom;
            tmp.custom = e.name;
            arg = e.definition;
            sArgs = {};
            //setup default values
            for (s = 0, sl = e.attributeIndexes.length; s < sl; s++)
                sArgs[e.attributeIndexes[s]] = e.attributes[e.attributeIndexes[s]];
            //change any based on passed argument
            for (x = 0; x < xl; x++) {
                sArg = args[x].split('=');
                sArg[0] = sArg[0].toLowerCase();
                if (e.attributes[sArg[0]])
                    sArgs[sArg[0]] = sArg[1];
                else if (x < e.attributeIndexes.length)
                    sArgs[e.attributeIndexes[x]] = sArg[0];
            }
            for (sArg in sArgs) {
                if (!sArgs.hasOwnProperty(sArg)) continue;
                arg = arg.replace('&' + sArg + ';', sArgs[sArg]);
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
            //this.mxpStyles.push(tmp);
            return { format: null, text: arg };
        }
        else if (tag.startsWith('/') && this.mxpElements[tag.substring(1)] && !this.mxpElements[tag.substring(1)].empty) {
            tag = tag.substring(1);
            e = this.mxpElements[tag];

            //not open and not in correct lineType
            if (!e.open && this.mxpState.lineType !== lineType.Secure && this.mxpState.lineType !== lineType.LockSecure && this.mxpState.lineType !== lineType.TempSecure)
                return null;

            //get captured text
            if (!e.empty && this.mxpState.capture > 0) {
                if (this.mxpState.captured.length > 0)
                    sArg = this.mxpState.captured.pop().join('');
                this.mxpState.capture--;
            }

            //tmp = this.ClearMXPToTag(MXPTag.Custom, tag);
            arg = e.closeDefinition;

            if (e.flag.length > 0) {
                if (e.flag.length > 4 && e.flag.toLowerCase().startsWith('set '))
                    this.emit('set-variable', e.flag.substring(4), sArg);
                this.emit('MXP-flag', e.flag, sArg);
            }
            if (e.tag > 19 && e.tag < 100 && this.mxpLines[e.tag].enabled && this.mxpLines[e.tag].closeDefinition.length > 0)
                arg += this.mxpLines[e.tag].closeDefinition;
            this.mxpState.gagged = !e.gagged;
            if (e.empty)
                return null;
            this.mxpState.expanded = true;
            return { format: null, text: arg };
        }
        if (this.showInvalidMXPTags) {
            switch (tag) {
                case 'IMAGE':
                case '!AT':
                case '!ATTLIST':
                case '!TAG':
                case '!EL':
                case '!ELEMENT':
                case '!EN':
                case '!ENTITY':
                case '/V':
                case '/VAR':
                case 'V':
                case 'VAR':
                case 'GAUGE':
                case 'STAT':
                case 'MUSIC':
                case 'SOUND':
                case 'EXPIRE':
                case 'VERSION':
                case 'USER':
                case 'PASSWORD':
                case 'SUPPORT':
                case 'A':
                case 'SEND':
                case 'H1':
                case 'H2':
                case 'H3':
                case 'H4':
                case 'H5':
                case 'H6':
                case '/A':
                case '/SEND':
                case '/H1':
                case '/H2':
                case '/H3':
                case '/H4':
                case '/H5':
                case '/H6':
                case 'NOBR':
                case '/P':
                case 'P':
                case 'SBR':
                case 'RESET':
                case 'HR':
                    return null;

            }
            return { format: null, text: '<' + oTag + '>' };
        }
        return null;
    }

    private cleanMXPExpired(blocks, args) {
        if (!blocks || blocks.length === 0 || args === null)
            return;
        const bl = blocks.length;
        for (let b = 0; b < bl; b++) {
            let format = blocks[b];
            //not a link move on
            if (format.formatType !== FormatType.MXPSend && format.formatType !== FormatType.MXPLink)
                continue;
            //only clean if no argument or matching expire
            if (args.length === 0 || format.expire === args) {
                let eType, n = 0, f = 0;
                //store current type for nest testing
                let type = format.formatType;
                //get end tag format type
                if (format.formatType === FormatType.MXPLink)
                    eType = FormatType.MXPLinkEnd;
                else
                    eType = FormatType.MXPSendEnd;
                //set link to expired
                format.formatType = FormatType.MXPExpired;
                //loop remaining tags looking for send tag, ignoring any nested tags
                for (; f < bl; f++) {
                    if (blocks[f].formatType === eType) {
                        //not nested so end tag, set to be skipped
                        if (n === 0) {
                            blocks[f].formatType = FormatType.MXPSkip;
                            break;
                        }
                        else
                            n--;
                    }
                    else if (blocks[f] === type)
                        n++;
                }
                //if did not find end tag, malformed MXP continue on
            }
        }
    }

    private GetCloseTags(tag) {
        if (typeof tag === 'undefined' || tag.length === 0)
            return '';
        let idx = 0;
        const tl = tag.length;
        const ts = [];
        let str = [];
        let c;
        let state = 0;
        for (; idx < tl; idx++) {
            c = tag.charAt(idx);
            switch (state) {
                case 1:
                    if (c === ' ') {
                        ts.push(str.join(''));
                        str = [];
                        state = 2;
                    }
                    else if (c === '>') {
                        ts.push(str.join(''));
                        str = [];
                        state = 0;
                    }
                    else
                        str.push(c);
                    break;
                case 2:
                    //ignore every thing til a >
                    if (c === '>')
                        state = 0;
                    break;
                default:
                    //only care about tags
                    if (c === '<')
                        state = 1;
                    break;
            }
        }
        if (state === 1)
            ts.push(str.join(''));
        if (ts.length === 0)
            return '';
        return '</' + ts.reverse().join('></') + '>';
    }

    private CloneCurrentStyle() {
        let tmp: MXPStyle;
        if (this.mxpStyles.length === 0)
            this.mxpStyles.push(new MXPStyle(FontStyle.None, '', '', false));
        tmp = this.mxpStyles[this.mxpStyles.length - 1];
        if (this.mxpLines[this.mxpState.lineType] && this.mxpLines[this.mxpState.lineType].enabled)
            tmp.gagged = this.mxpLines[this.mxpState.lineType].gag;
        return <MXPStyle>Object.assign({}, tmp);
    }

    private GetCurrentStyle() {
        let tmp: MXPStyle;
        if (this.mxpStyles.length === 0)
            this.mxpStyles.push(new MXPStyle(FontStyle.None, '', '', false));
        tmp = this.mxpStyles[this.mxpStyles.length - 1];
        if (this.mxpLines[this.mxpState.lineType] && this.mxpLines[this.mxpState.lineType].enabled)
            tmp.gagged = this.mxpLines[this.mxpState.lineType].gag;
        return tmp;
    }

    public DecreaseColor(clr, p) {
        const color = new RGBColor(clr);
        if (!color.ok) return clr;
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

    public IncreaseColor(clr, p) {
        const color = new RGBColor(clr);
        if (!color.ok) return clr;
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

    private MXPCapture(str) {
        if (this.mxpState.capture < 1) return;
        const il = this.mxpState.captured.length;
        for (let i = 0; i < il; i++)
            this.mxpState.captured[i].push(str);
    }

    private MXPDeCapture(cnt) {
        if (this.mxpState.capture < 1) return;
        const il = this.mxpState.captured.length;
        for (let i = 0; i < il; i++) {
            for (let p = 0; p < cnt; p++)
                this.mxpState.captured[i].pop();
        }
    }

    private isNumber(str) {
        return (/^\d+$/).test(str);
    }

    /**
     * CurrentAnsiCode - return an ansi formatted code based on current ansi state
     *
     * @returns {String}
     */
    public CurrentAnsiCode() {
        let ansi = '\x1b[';
        if (typeof this._CurrentForeColor === 'string')
            ansi += '38;2;' + this._CurrentForeColor;
        else if (this._CurrentForeColor <= -16)
            ansi += '38;5;' + (this._CurrentForeColor * -1 - 16) + ';';
        else
            ansi += this._CurrentForeColor + ';';
        if (typeof this._CurrentBackColor === 'string')
            ansi += '48;2;' + this._CurrentBackColor;
        else if (this._CurrentBackColor <= -16)
            ansi += '38;5;' + (this._CurrentBackColor * -1 - 16) + ';';
        else
            ansi += this._CurrentBackColor + ';';
        if (this._CurrentAttributes > 0) {
            if ((this._CurrentAttributes & FontStyle.Inverse) === FontStyle.Inverse)
                ansi += '7;';
            if ((this._CurrentAttributes & FontStyle.Bold) === FontStyle.Bold)
                ansi += '1;';
            if ((this._CurrentAttributes & FontStyle.Italic) === FontStyle.Italic)
                ansi += '3;';
            if ((this._CurrentAttributes & FontStyle.Underline) === FontStyle.Underline)
                ansi += '4;';
            if ((this._CurrentAttributes & FontStyle.Slow) === FontStyle.Slow)
                ansi += '5;';
            if ((this._CurrentAttributes & FontStyle.Rapid) === FontStyle.Rapid)
                ansi += '6;';
            if ((this._CurrentAttributes & FontStyle.Strikeout) === FontStyle.Strikeout)
                ansi += '9;';
            if ((this._CurrentAttributes & FontStyle.Faint) === FontStyle.Faint)
                ansi += '2;';
            if ((this._CurrentAttributes & FontStyle.DoubleUnderline) === FontStyle.DoubleUnderline)
                ansi += '21;';
            if ((this._CurrentAttributes & FontStyle.Overline) === FontStyle.Overline)
                ansi += '53;';
        }
        return ansi + 'm';
    }

    public get parseQueueLength() {
        return this.parsing.length;
    }

    public get parseQueueEndOfLine() {
        if (this.parsing.length)
            return this.parsing[this.parsing.length - 1][0].endsWith('\n');
        return false;
    }

    public parse(text: string, remote?: boolean, force?: boolean, prependSplit?: boolean) {
        if (text == null || text.length === 0)
            return text;
        if (remote == null) remote = false;
        //query data in case already parsing
        if (this.parsing.length > 0 && !force) {
            this.parsing.push([text, remote, prependSplit]);
            return;
        }
        let _TermTitle = '';
        let _TermTitleType = null;
        let _AnsiParams = null;
        let stringBuilder = [];
        let formatBuilder = [];
        let rawBuilder = [];
        let state: ParserState = ParserState.None;
        let pState: ParserState = ParserState.None;
        let lineLength = 0;
        let iTmp;
        let mOffset = 0;
        let _MXPTag;
        let _MXPOTag;
        let _MXPEntity;
        let _MXPComment;
        let _MXPArgs;
        let skip = false;
        this.busy = true;
        this.parsing.unshift([text, remote, prependSplit]);
        let format;
        if (this._SplitBuffer.length > 0) {
            if (prependSplit)
                text = text + this._SplitBuffer;
            else
                text = this._SplitBuffer + text;
            this._SplitBuffer = '';
        }
        //not end of line but text, so fragment, re-get and re-parse to ensure proper triggering
        if (!this.EndOfLine && (this.textLength > 0 || this.rawLength > 0)) {
            let lines = this.display.lines;
            if (lines.length > 0) {
                iTmp = this.display.lines[lines.length - 1].text;
                _MXPComment = this.display.lines[lines.length - 1].raw;
                formatBuilder.push.apply(formatBuilder, this.display.lines[lines.length - 1].formats);
                lineLength = this.display.lines[lines.length - 1].length;
                //remove line but do not change selection as line will be re-added back at the end
                this.display.removeLine(lines.length - 1, true);
                format = formatBuilder[formatBuilder.length - 1];
                if (format.formatType === FormatType.Link) {
                    formatBuilder.pop();
                    format = formatBuilder[formatBuilder.length - 1];
                }
                format.width = 0;
                format.height = 0;
                format.marginWidth = 0;
                format.marginHeight = 0;
                lineLength = format.offset;
                if (format.offset !== 0) {
                    stringBuilder.push(iTmp.substring(0, format.offset));
                    iTmp = iTmp.substring(format.offset);
                    if (this.mxpState.locked || this.mxpState.on)
                        mOffset = iTmp.length;
                    text = iTmp + text;
                }
                else {
                    if (this.mxpState.locked || this.mxpState.on)
                        mOffset = iTmp.length;
                    text = iTmp + text;
                }
                if (_MXPComment.endsWith(iTmp))
                    rawBuilder.push(_MXPComment.substr(0, _MXPComment.length - iTmp.length));
                else
                    rawBuilder.push(_MXPComment);
            }
            else
                formatBuilder.push(format = this.getFormatBlock(lineLength));
            lines = null;
        }
        else
            formatBuilder.push(format = this.getFormatBlock(lineLength));
        let idx = 0;
        let tl = text.length;
        let c: string;
        let i: number;
        const e: boolean = this.emulateControlCodes;
        const d: boolean = this.displayControlCodes;
        const f: boolean = this.emulateTerminal;
        const u: boolean = this.enableURLDetection;
        const s: boolean = this.enableMSP;
        const tabWidth: number = this.tabWidth;
        let lnk = 0;
        let fLnk = 0;
        let lnkOffset = 0;
        let lLnk = 0;
        let lNest = null;
        let p;
        const pl = this.protocols.length;
        try {
            for (idx = 0; idx < tl; idx++) {
                c = text.charAt(idx);
                i = text.charCodeAt(idx);
                if (idx >= mOffset)
                    rawBuilder.push(c);
                this.rawLength++;
                switch (state) {
                    case ParserState.AnsiParams:
                        if (
                            c === 'C' ||  //Move cursor # spaces
                            c === 'K' || //Clear screen Left/Right
                            c === 's' || //save cursor position: non-standard
                            c === 'u' ||  //save cursor position: non-standard
                            c === 'l' ||  //XTerm ?#l Private Mode Reset/Reset Mode #l
                            c === 'h' ||  //XTerm ?#h Private Mode/Set Mode #h
                            c === 'A' ||  //Move cursor up N lines
                            c === 'B' ||  //Move cursor down N lines
                            c === 'D' ||  //Move cursor left N spaces
                            c === 'E' ||  //Moves cursor to beginning of the line n (default 1) lines down (next line).
                            c === 'F' ||  //Moves cursor to beginning of the line n (default 1) lines up (previous line).
                            c === 'f' ||  //Moves the cursor to row n, column m. Both default to 1 if omitted. Same as CUP
                            c === 'G' ||  //Moves the cursor to column n.
                            c === 'H' ||  //Moves the cursor to row n, column m. The values are 1-based, and default to 1 (top left corner) if omitted. A sequence such as CSI ;5H is a synonym for CSI 1;5H as well as CSI 17;H is the same as CSI 17H and CSI 17;1H
                            c === 'n' ||  //Reports the cursor position to the application as (as though typed at the keyboard) ESC[n;mR, where n is the row and m is the column. (May not work on MS-DOS.)
                            c === 'S' ||  //Scroll whole page up by n (default 1) lines. New lines are added at the bottom. (not ANSI.SYS)
                            c === 'T' ||  //Scroll whole page down by n (default 1) lines. New lines are added at the top. (not ANSI.SYS)
                            c === 'r'//SET SCROLLING REGION
                        ) {
                            this.ClearMXPOpen();
                            this._SplitBuffer = '';
                            _AnsiParams = null;
                            state = ParserState.None;
                        }
                        else if (c === 'z') //mxp
                        {
                            //incase they put in a ; like e[1;z, e[1;7z or even e[;1z
                            _MXPTag = _AnsiParams.split(';');
                            //we only want the last valid #
                            //start as 0 in cause invalid # or code
                            _AnsiParams = 0;
                            for (let mt = _MXPTag.length - 1; mt >= 0; mt--) {
                                if (_MXPTag[mt].length > 0) {
                                    _AnsiParams = _MXPTag[0];
                                    break;
                                }
                            }
                            iTmp = +_AnsiParams;
                            if (isNaN(iTmp)) iTmp = 0;
                            this.mxpState.on = true;
                            this.mxpState.noBreak = false;
                            this.mxpState.paragraph = false;
                            if (this.mxpState.lineType === lineType.Open)
                                this.ClearMXPOpen();
                            switch (iTmp) {
                                case 2:
                                    this.mxpState.on = false;
                                    this.mxpState.locked = false;
                                    this.mxpState.lineType = lineType.Locked;
                                    this.ClearMXPOpen();
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
                                    const ct = text.charAt(idx + 1);
                                    if (ct !== '<') {
                                        this.mxpState.lineType = lineType.Open;
                                        this.mxpState.on = false;
                                    }
                                    this.mxpState.locked = false;
                                    this.ClearMXPOpen();
                                    break;
                                case 5:
                                    this.iMXPDefaultMode = lineType.Open;
                                    this.mxpState.locked = true;
                                    this.mxpState.lineType = lineType.LockOpen;
                                    this.ClearMXPOpen();
                                    break;
                                case 6:
                                    this.iMXPDefaultMode = lineType.Secure;
                                    this.mxpState.lineType = lineType.LockSecure;
                                    this.mxpState.locked = true;
                                    this.ClearMXPOpen();
                                    break;
                                case 7:
                                    this.iMXPDefaultMode = lineType.Locked;
                                    this.mxpState.lineType = lineType.LockLocked;
                                    this.mxpState.locked = true;
                                    this.ClearMXPOpen();
                                    break;
                                default:
                                    //invalid line so reset
                                    if (iTmp < 0 || iTmp > 99)
                                        this.ClearMXPOpen();
                                    else {
                                        this.mxpState.lineType = iTmp;
                                        this.mxpState.locked = false;
                                        //custom element linked to tag so expanded it into the line
                                        if (this.mxpLines[this.mxpState.lineType] && this.mxpLines[this.mxpState.lineType].enabled) {
                                            //strBuilder.push(EndDisplayBlock());
                                            //strBuilder.push(StartDisplayBlock(lineLength));
                                            iTmp = '';
                                            if (this.mxpLines[this.mxpState.lineType].element.length > 0)
                                                iTmp += '<' + this.mxpLines[this.mxpState.lineType].element + '>';
                                            if (this.mxpLines[this.mxpState.lineType].definition.length > 0)
                                                iTmp += this.mxpLines[this.mxpState.lineType].definition;
                                            if (iTmp.length > 0) {
                                                text = text.splice(idx + 1, iTmp);
                                                tl = text.length;
                                            }
                                        }
                                    }
                                    break;
                            }
                            this._SplitBuffer = '';
                            _AnsiParams = null;
                            state = ParserState.None;
                        }
                        else if (c === 'J')  //Clear screen Up/Down
                        {
                            this.ClearMXPOpen();
                            if (_AnsiParams.length > 0) {
                                if (+_AnsiParams === 2) {
                                    lineLength = 0;
                                    iTmp = this.window.height;
                                    formatBuilder.push(...this.getMXPCloseFormatBlocks());
                                    this.AddLine(stringBuilder.join(''), rawBuilder.join(''), false, false, formatBuilder, remote);
                                    stringBuilder = [];
                                    rawBuilder = [];
                                    formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength), ...this.getMXPCloseFormatBlocks()];
                                    for (let j = 0; j < iTmp; j++) {
                                        this.AddLine('', '\n', false, false, formatBuilder, remote);
                                        this.MXPCapture('\n');
                                    }
                                    this.textLength += iTmp;
                                    this.mxpState.noBreak = false;
                                }
                            }
                            formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength)];
                            this._SplitBuffer = '';
                            _AnsiParams = null;
                            state = ParserState.None;
                        }
                        else if (c === 'm') {
                            this.ProcessAnsiColorParams(_AnsiParams.split(';'));
                            formatBuilder.push(format = this.getFormatBlock(lineLength));
                            this._SplitBuffer = '';
                            _AnsiParams = null;
                            state = ParserState.None;
                        }
                        else {
                            this._SplitBuffer += c;
                            _AnsiParams += c;
                        }
                        break;
                    case ParserState.XTermTitle:
                        if (i === 7) {
                            this._SplitBuffer = '';
                            this.emit('set-title', _TermTitle, _TermTitleType == null ? 0 : _TermTitleType);
                            _TermTitle = '';
                            _TermTitleType = null;
                            state = ParserState.None;
                        }
                        else if (c === ';' && _TermTitleType == null) {
                            _TermTitleType = +_TermTitle;
                            if (isNaN(_TermTitleType))
                                _TermTitleType = 0;
                            _TermTitle = '';
                            this._SplitBuffer += c;
                        }
                        else if (c === '\x1b') {
                            if (this._SplitBuffer.charAt(this._SplitBuffer.length - 1) === '\n')
                                this._SplitBuffer = '';
                        }
                        else {
                            this._SplitBuffer += c;
                            _TermTitle += c;
                        }
                        break;
                    case ParserState.Ansi:
                        if (c === '[') {
                            this._SplitBuffer += c;  //store in split buffer incase split command
                            _AnsiParams = '';
                            state = ParserState.AnsiParams;
                        }
                        /*
                        else if(c === ']')
                        {
                          _SplitBuffer = '';
                          state = ParserState.None;
                        }
                        */
                        else if (c === ']') {
                            this._SplitBuffer += c;  //store in split buffer incase split command
                            _TermTitle = '';
                            state = ParserState.XTermTitle;
                        }
                        //Unsupported VT100 so skip them
                        else if (
                            c === 'D' || //Index ( down one line, scroll if at bottom )
                            c === 'E' || //Next line ( move to column 1 of next line, scroll up if at bottom )
                            c === 'M' || //Reverse index	( up one line, scroll down if at top )
                            c === '1' || //Graphic proc. option ON
                            c === '2' || //Graphic proc. option OFF
                            c === '7' || //Save cursor & attributes
                            c === '8' || //Restore cursor & attributes
                            c === '>' || //Keypad mode		Numeric
                            c === '=' || //Keypad mode		Application
                            /*
                            *LINE SIZE COMMANDS
                            *<ESC>#3 Change current line to double-height top half
                            *<ESC>#4 Change current line to double-height bottom half
                            *<ESC>#5 Change current line to single-width single-height (normal)
                            *<ESC>#6 Change current line to double-width single-height
                            */
                            c === '#'
                        ) {
                            if (d) {
                                stringBuilder.push('\u241B');
                                if (i < 16) {
                                    stringBuilder.push(String.fromCharCode(parseInt('240' + i.toString(16), 16)));
                                    this.MXPCapture('&#x241B&#x240' + i.toString(16) + ';');
                                }
                                else {
                                    stringBuilder.push(String.fromCharCode(parseInt('24' + i.toString(16), 16)));
                                    this.MXPCapture('&#x241B&#x24' + i.toString(16) + ';');
                                }
                                lineLength += 2;
                                this.textLength += 2;
                                this.mxpState.noBreak = false;
                            }
                            state = ParserState.None;
                            this._SplitBuffer = '';
                        }
                        break;
                    case ParserState.MXPTag:
                        if (_MXPTag === '!--') {
                            idx--;
                            rawBuilder.pop();
                            this.rawLength--;
                            pState = ParserState.None;
                            state = ParserState.MXPComment;
                            _MXPComment = '<!--';
                            _MXPTag = '';
                            _MXPArgs = [];
                        }
                        else if (_MXPTag.endsWith('<!--')) {
                            idx--;
                            rawBuilder.pop();
                            this.rawLength--;
                            pState = state;
                            state = ParserState.MXPComment;
                            _MXPComment = '<!--';
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
                            _MXPEntity = '';
                            pState = state;
                            state = ParserState.MXPEntity;
                            this._SplitBuffer = '';
                        }
                        else if (c === '\n' || c === '\x1b') {
                            idx--;
                            rawBuilder.pop();
                            this.rawLength--;
                            //Abnormal end, discard
                            state = ParserState.None;
                            this._SplitBuffer = '';
                            if (this.mxpState.on && c === '\n')
                                this.ClearMXPOpen();
                        }
                        else if (c === ' ') {
                            state = ParserState.MXPTagArg;
                            _MXPArgs.push('');
                            this._SplitBuffer += c;
                        }
                        else if (c === '>') {
                            _MXPOTag = _MXPTag;
                            _MXPTag = _MXPTag.toUpperCase();
                            if (_MXPTag === 'HR' && (this.mxpState.lineType === lineType.Secure || this.mxpState.lineType === lineType.LockSecure || this.mxpState.lineType === lineType.TempSecure)) {
                                if (lineLength > 0) {
                                    lineLength = 0;
                                    this.MXPCapture('\n');
                                    formatBuilder.push(...this.getMXPCloseFormatBlocks());
                                    this.AddLine(stringBuilder.join(''), rawBuilder.join(''), false, false, formatBuilder, remote);
                                    stringBuilder = [];
                                    rawBuilder = [];
                                    formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength)];
                                }
                                //skip = text.charAt(idx + 1) === '\n';
                                _MXPTag = this.getMXPBlock(_MXPTag, [], remote);
                                if (_MXPTag && _MXPTag.format) {
                                    _MXPTag.format.offset = lineLength;
                                    formatBuilder.push(_MXPTag.format);
                                    formatBuilder[0].hr = _MXPTag.format.hr;
                                }
                                formatBuilder.push(...this.getMXPCloseFormatBlocks());
                                this.AddLine(stringBuilder.join(''), rawBuilder.join(''), false, false, formatBuilder, remote);
                                this.textLength++;
                                stringBuilder = [];
                                rawBuilder = [];
                                formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength)];
                            }
                            else if (_MXPTag === 'BR' && (this.mxpState.lineType === lineType.Secure || this.mxpState.lineType === lineType.LockSecure || this.mxpState.lineType === lineType.TempSecure)) {
                                this.MXPCapture('\n');
                                formatBuilder.push(...this.getMXPCloseFormatBlocks());
                                this.AddLine(stringBuilder.join(''), rawBuilder.join(''), false, false, formatBuilder, remote);
                                skip = false;
                                lineLength = 0;
                                stringBuilder = [];
                                rawBuilder = [];
                                formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength)];
                                this.textLength++;
                            }
                            else if (_MXPTag === 'IMAGE' && (this.mxpState.lineType === lineType.Secure || this.mxpState.lineType === lineType.LockSecure || this.mxpState.lineType === lineType.TempSecure)) {
                                _MXPTag = this.getMXPBlock(_MXPTag, _MXPArgs, remote);
                                if (_MXPTag && _MXPTag.format !== null) {
                                    formatBuilder.push(_MXPTag.format);
                                    lineLength += _MXPTag.length;
                                    this.textLength += _MXPTag.length;
                                }
                                formatBuilder.push(format = this.getFormatBlock(lineLength));
                            }
                            else {
                                _MXPTag = this.getMXPBlock(_MXPTag, [], remote, _MXPOTag, formatBuilder);
                                if (this.mxpState.expanded) {
                                    if (_MXPTag && _MXPTag.text !== null) text = text.splice(idx + 1, _MXPTag.text);
                                    tl = text.length;
                                    this.mxpState.expanded = false;
                                    state = ParserState.None;
                                    _MXPTag = '';
                                    this._SplitBuffer = '';
                                    continue;
                                }
                                if (_MXPTag) {
                                    if (_MXPTag.format) {
                                        _MXPTag.format.offset = lineLength;
                                        formatBuilder.push(_MXPTag.format);
                                    }
                                    formatBuilder.push(format = this.getFormatBlock(lineLength));
                                    if (_MXPTag.text !== null && _MXPTag.text.length > 0) {
                                        stringBuilder.push(_MXPTag.text);
                                        lineLength += _MXPTag.text.length;
                                        this.textLength += _MXPTag.text.length;
                                    }
                                }
                                else
                                    formatBuilder.push(format = this.getFormatBlock(lineLength));
                            }
                            state = ParserState.None;
                            this._SplitBuffer = '';
                        }
                        //Malformed broken so just display it
                        else if (c === '<') {
                            if (this.enableDebug)
                                this.emit('debug', 'Malformed MXP Tag: ' + _MXPTag);
                            idx--;
                            rawBuilder.pop();
                            this.rawLength--;
                            stringBuilder.push('<' + _MXPTag);
                            lineLength += _MXPTag.length + 1;
                            this.textLength += _MXPTag.length + 1;
                            state = ParserState.None;
                            this._SplitBuffer = '';
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
                            rawBuilder.pop();
                            this.rawLength--;
                            //Abnormal end, discard
                            state = ParserState.None;
                            this._SplitBuffer = '';
                            if (this.mxpState.on && c === '\n')
                                this.ClearMXPOpen();
                        }
                        else if (c === ' ') {
                            state = ParserState.MXPTagArg;
                            _MXPArgs.push('');
                            this._SplitBuffer += c;
                        }
                        else if (c === '>') {
                            if (_MXPTag.toUpperCase() === 'IMAGE' && (this.mxpState.lineType === lineType.Secure || this.mxpState.lineType === lineType.LockSecure || this.mxpState.lineType === lineType.TempSecure)) {
                                _MXPTag = this.getMXPBlock(_MXPTag, _MXPArgs, remote, _MXPTag);
                                if (_MXPTag !== null && _MXPTag.format !== null) {
                                    _MXPTag.format.offset = lineLength;
                                    formatBuilder.push(_MXPTag.format);
                                }
                                formatBuilder.push(format = this.getFormatBlock(lineLength));
                            }
                            else {
                                _MXPTag = this.getMXPBlock(_MXPTag, _MXPArgs, remote, _MXPTag, formatBuilder);
                                if (this.mxpState.expanded) {
                                    if (_MXPTag !== null) text = text.splice(idx + 1, _MXPTag.text);
                                    tl = text.length;
                                    this.mxpState.expanded = false;
                                    state = ParserState.None;
                                    this._SplitBuffer = '';
                                    continue;
                                }
                                if (_MXPTag !== null) {
                                    if (_MXPTag !== null && _MXPTag.format) {
                                        _MXPTag.format.offset = lineLength;
                                        formatBuilder.push(_MXPTag.format);
                                    }
                                    formatBuilder.push(format = this.getFormatBlock(lineLength));
                                    if (_MXPTag.text !== null) {
                                        stringBuilder.push(_MXPTag.text);
                                        lineLength += _MXPTag.text.length;
                                        this.textLength += _MXPTag.text.length;
                                    }
                                }
                                else
                                    formatBuilder.push(format = this.getFormatBlock(lineLength));
                            }
                            state = ParserState.None;
                            this._SplitBuffer = '';
                        }
                        else {
                            this._SplitBuffer += c;
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        }
                        break;
                    case ParserState.MXPEntity:
                        if (c === '\n' || c === '\x1b') {
                            idx--;
                            rawBuilder.pop();
                            this.rawLength--;
                            if (this.enableDebug) this.emit('debug', 'MXP Entity: ' + _MXPEntity);
                            if (<ParserState>pState === ParserState.MXPTag) {
                                _MXPTag += '&' + _MXPEntity;
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
                                    this._SplitBuffer = '';
                                    continue;
                                }
                                _MXPOTag = htmlDecode('&' + _MXPEntity);
                                stringBuilder.push(_MXPOTag);
                                this.MXPCapture('&' + _MXPEntity);
                                lineLength += _MXPOTag.length;
                                this.textLength += _MXPOTag.length;
                                this.mxpState.noBreak = false;
                                //Abnormal end, send as is
                                state = ParserState.None;
                                this._SplitBuffer = '';
                                format.unicode = true;
                            }
                            if (this.mxpState.on && c === '\n')
                                this.ClearMXPOpen();
                        }
                        else if (c === ';') {
                            if (this.enableDebug) this.emit('debug', 'MXP Entity: ' + _MXPEntity);
                            if (<ParserState>pState !== ParserState.MXPTag) {
                                _MXPEntity = this.GetEntity(_MXPEntity);
                                if (this.mxpState.expanded) {
                                    text = text.splice(idx + 1, _MXPEntity);
                                    tl = text.length;
                                    this.mxpState.expanded = false;
                                    state = pState;
                                    this._SplitBuffer = '';
                                    continue;
                                }
                                _MXPOTag = htmlDecode('&' + _MXPEntity + ';');
                                stringBuilder.push(_MXPOTag);
                                this.MXPCapture('&');
                                this.MXPCapture(_MXPEntity);
                                this.MXPCapture(';');
                                lineLength += _MXPOTag.length;
                                this.textLength += _MXPOTag.length;
                                this.mxpState.noBreak = false;
                                this._SplitBuffer = '';
                            }
                            else
                                _MXPTag += '&' + _MXPEntity + ';';
                            format.unicode = true;
                            state = pState;
                        }
                        //malformed entity
                        else if (c === '&') {
                            if (this.enableDebug) this.emit('debug', 'Malformed MXP Entity: ' + _MXPEntity);
                            if (<ParserState>pState !== ParserState.MXPTag) {
                                stringBuilder.push('&' + _MXPEntity);
                                this.MXPCapture('&');
                                this.MXPCapture(_MXPEntity);
                                lineLength += _MXPEntity.length + 1;
                                this.textLength += _MXPEntity.length + 1;
                                this.mxpState.noBreak = false;
                                this._SplitBuffer = '';
                                idx--;
                                rawBuilder.pop();
                                this.rawLength--;
                            }
                            else
                                _MXPTag += '&' + _MXPEntity;
                            format.unicode = true;
                            state = pState;
                        }
                        else {
                            this._SplitBuffer += c;
                            _MXPEntity += c;
                        }
                        break;
                    case ParserState.MXPComment:
                        if (_MXPComment.endsWith('-->')) {
                            if (this.enableDebug) this.emit('debug', 'MXP Comment: ' + _MXPComment);
                            idx--;
                            rawBuilder.pop();
                            this.rawLength--;
                            state = pState;
                            if (state === ParserState.None)
                                this._SplitBuffer = '';
                            _MXPComment = '';
                        }
                        else if (c === '\n' || c === '\x1b') {
                            if (this.enableDebug) this.emit('debug', 'MXP Comment: ' + _MXPComment);
                            idx--;
                            rawBuilder.pop();
                            this.rawLength--;
                            state = pState;
                            _MXPComment = '';
                            if (this.mxpState.on && c === '\n')
                                this.ClearMXPOpen();
                        }
                        else
                            _MXPComment += c;
                        break;
                    case ParserState.URL:
                        if (idx > lnk + 2) {
                            stringBuilder.pop();
                            stringBuilder.pop();
                            rawBuilder.pop();
                            rawBuilder.pop();
                            this.rawLength -= 2;
                            lineLength -= 2;
                            this.textLength -= 2;
                            this.MXPDeCapture(2);
                            idx = lnk;
                            state = ParserState.None;
                        }
                        else if (c === '/') {
                            stringBuilder.push(c);
                            this.MXPCapture(c);
                            lineLength++;
                            this.textLength++;
                            if (idx === lnk + 2) {
                                state = ParserState.URLFound;
                                //Found :// so valid url
                                lnk = stringBuilder.length - 4;
                                lLnk = stringBuilder.length - 1;
                                fLnk = formatBuilder.length;
                                lnkOffset -= 2;
                                while (lnk > 0 && CharAllowedInURL(stringBuilder[lnk], true)) {
                                    lnk--;
                                    lnkOffset--;
                                }
                                if (!CharAllowedInURL(stringBuilder[lnk], true)) {
                                    lnk++;
                                    lnkOffset++;
                                }
                                lNest = [];
                                if (lnk > 0 && stringBuilder[lnk - 1] === '(')
                                    lNest.push(')');
                                if (lnk > 0 && stringBuilder[lnk - 1] === '[')
                                    lNest.push(']');
                            }
                        }
                        else if (idx > lnk + 1) {
                            stringBuilder.pop();
                            rawBuilder.pop();
                            this.rawLength--;
                            lineLength--;
                            this.textLength--;
                            this.MXPDeCapture(1);
                            idx = lnk;
                            state = ParserState.None;
                        }
                        else {
                            idx = lnk;
                            state = ParserState.None;
                            rawBuilder.pop();
                            this.rawLength--;
                        }
                        break;
                    case ParserState.URLFound:
                        if (!CharAllowedInURL(c, false)) {
                            if (lLnk !== stringBuilder.length - 1) {
                                _MXPComment += stringBuilder.slice(lnk).join('');
                                if (this.enableDebug) this.emit('debug', 'URL Found: ' + _MXPComment);
                                formatBuilder.splice(fLnk, 0,
                                    {
                                        formatType: FormatType.Link,
                                        offset: lnkOffset,
                                        href: _MXPComment
                                    });
                                formatBuilder.push({
                                    formatType: FormatType.LinkEnd,
                                    offset: lineLength,
                                    href: _MXPComment
                                });
                                formatBuilder.push(format = this.getFormatBlock(lineLength));
                            }
                            state = ParserState.None;
                            idx--;
                            rawBuilder.pop();
                            this.rawLength--;
                        }
                        else {
                            if (lNest.length > 1 && lNest[lNest.length - 1] === c) {
                                lNest.pop();
                                stringBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.textLength++;
                                if (i > 255)
                                    format.unicode = true;
                            }
                            else if (lNest.length > 0 && c === '(') {
                                lNest.push(')');
                                stringBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.textLength++;
                                if (i > 255)
                                    format.unicode = true;
                            }
                            else if (lNest.length > 0 && c === '[') {
                                lNest.push(']');
                                stringBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.textLength++;
                                if (i > 255)
                                    format.unicode = true;
                            }
                            else if (lNest.length === 1 && lNest[lNest.length - 1] === c) {
                                if (lLnk !== stringBuilder.length - 1) {
                                    _MXPComment += stringBuilder.slice(lnk).join('');
                                    if (this.enableDebug) this.emit('debug', 'URL Found: ' + _MXPComment);
                                    formatBuilder.splice(fLnk, 0,
                                        {
                                            formatType: FormatType.Link,
                                            href: _MXPComment,
                                            offset: lnkOffset
                                        });
                                    formatBuilder.push({
                                        formatType: FormatType.LinkEnd,
                                        href: _MXPComment,
                                        offset: lineLength
                                    });
                                    formatBuilder.push(format = this.getFormatBlock(lineLength));
                                }
                                state = ParserState.None;
                                idx--;
                                rawBuilder.pop();
                                this.rawLength--;
                            }
                            else {
                                if (i > 255)
                                    format.unicode = true;
                                stringBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.textLength++;
                            }
                        }
                        break;
                    case ParserState.MSPSound:
                        if (c === ')') {
                            lnk = this.mxpState.lineType;
                            this.mxpState.lineType = lineType.TempSecure;
                            this.getMXPBlock('SOUND', _MXPArgs, remote);
                            this.mxpState.lineType = lnk;
                            state = ParserState.None;
                            if (idx + 1 < tl && text.charAt(idx + 1) === '\n') {
                                idx++;
                                skip = false;
                                stringBuilder = [];
                                formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength)];
                                this.mxpState.noBreak = false;
                                lineLength = 0;
                            }
                            else if (idx + 2 < tl && text[idx + 1] === '\r' && text[idx + 2] === '\n') {
                                idx += 2;
                                skip = false;
                                stringBuilder = [];
                                formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength)];
                                this.mxpState.noBreak = false;
                                lineLength = 0;
                            }
                        }
                        else if (c === ' ')
                            _MXPArgs.push('');
                        else
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        break;
                    case ParserState.MSPMusic:
                        if (c === ')') {
                            lnk = this.mxpState.lineType;
                            this.mxpState.lineType = lineType.TempSecure;
                            this.getMXPBlock('MUSIC', _MXPArgs, remote);
                            this.mxpState.lineType = lnk;
                            state = ParserState.None;
                            if (idx + 1 < tl && text.charAt(idx + 1) === '\n') {
                                idx++;
                                skip = false;
                                stringBuilder = [];
                                formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength)];
                                this.mxpState.noBreak = false;
                                lineLength = 0;
                            }
                            else if (idx + 2 < tl && text[idx + 1] === '\r' && text[idx + 2] === '\n') {
                                idx += 2;
                                skip = false;
                                stringBuilder = [];
                                formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength)];
                                this.mxpState.noBreak = false;
                                lineLength = 0;
                            }
                        }
                        else if (c === ' ')
                            _MXPArgs.push('');
                        else
                            _MXPArgs[_MXPArgs.length - 1] += c;
                        break;
                    default:
                        if (e && i === 7) {
                            if (f) {
                                c = '\u2407';
                                stringBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.textLength++;
                                this.mxpState.noBreak = false;
                            }
                            else if (d) {
                                stringBuilder.push(c);
                                this.MXPCapture('&#x2407;');
                                lineLength++;
                                this.textLength++;
                                this.mxpState.noBreak = false;
                            }
                            this.emit('bell');
                            //this.playBell();
                        }
                        else if (e && c === '\b') {
                            skip = false;
                            //if there are characters on the line
                            if (lineLength > 0) {
                                if (stringBuilder.length) {
                                    //clean up empty ones
                                    while (stringBuilder[stringBuilder.length - 1].length === 0)
                                        stringBuilder.pop();
                                    if (stringBuilder[stringBuilder.length - 1].length === 1)
                                        stringBuilder.pop();
                                    else
                                        stringBuilder[stringBuilder.length - 1] = stringBuilder[stringBuilder.length - 1].substring(0, stringBuilder[stringBuilder.length - 1].length - 1);
                                }
                                if (format.offset === lineLength)
                                    format.offset--;
                                lineLength--;
                                this.textLength--;
                            }
                            if (d) {
                                c = '\u25D8';
                                stringBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.textLength++;
                            }
                            this.mxpState.noBreak = false;
                        }
                        else if (e && c === '\t') {
                            const _Tab = tabWidth - lineLength % tabWidth;
                            if (_Tab > 0) {
                                stringBuilder.push(Array(_Tab + 1).join(' '));
                                this.MXPCapture(Array(_Tab + 1).join(' '));
                                lineLength += _Tab;
                                this.textLength += _Tab;
                                this.mxpState.noBreak = false;
                            }
                        }
                        else if (c === '\n') {
                            if (this.mxpState.noBreak || this.mxpState.paragraph) continue;
                            if (!this.mxpState.locked) {
                                //notify client that a tag is over, allow for tagging the 10,11,12,19 tag types for auto mapper tagging/welcome test/custom tags
                                if (this.mxpState.lineType !== lineType.Open)
                                    this.emit('MXP-tag-end', this.mxpState.lineType, stringBuilder.join(''), formatBuilder);
                                //custom element linked to tag so expanded it into the line
                                if (!this.mxpState.lineExpanded && this.mxpLines[this.mxpState.lineType] && this.mxpLines[this.mxpState.lineType].enabled) {
                                    iTmp = '';
                                    if (this.mxpLines[this.mxpState.lineType].element.length > 0)
                                        iTmp += '</' + this.mxpLines[this.mxpState.lineType].element + '>';
                                    if (this.mxpLines[this.mxpState.lineType].closeDefinition.length > 0)
                                        iTmp += this.mxpLines[this.mxpState.lineType].closeDefinition;
                                    if (iTmp.length > 0) {
                                        text = text.splice(idx, iTmp);
                                        tl = text.length;
                                        idx--;
                                        rawBuilder.pop();
                                        this.rawLength--;
                                        this.mxpState.lineExpanded = true;
                                        continue;
                                    }
                                }
                                this.mxpState.lineExpanded = false;
                                formatBuilder.push(...this.getMXPCloseFormatBlocks());
                                if (this.mxpState.on)
                                    this.ClearMXPOpen();
                                this.mxpState.on = false;
                                if (this.mxpLines[this.mxpState.lineType] && this.mxpLines[this.mxpState.lineType].enabled && this.mxpLines[this.mxpState.lineType].gag)
                                    skip = true;
                                this.mxpState.lineType = this.iMXPDefaultMode;
                                if (this.mxpState.lineType !== 2 && !this.enableMXP)
                                    this.ResetMXP();
                            }
                            else {
                                formatBuilder.push(...this.getMXPCloseFormatBlocks());
                                if (this.mxpState.on)
                                    this.ClearMXPOpen();
                            }
                            lineLength = 0;
                            if (!skip)
                                this.MXPCapture('\n');
                            this.AddLine(stringBuilder.join(''), rawBuilder.join(''), false, skip, formatBuilder, remote);
                            skip = false;
                            stringBuilder = [];
                            rawBuilder = [];
                            formatBuilder = [...this.getMXPOpenFormatBlocks(), format = this.getFormatBlock(lineLength)];
                            this.textLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (e && c === '\r') {
                            continue;
                            /*
                            if (this.mxpState.noBreak || this.mxpState.paragraph) continue;
                            if (!this.mxpState.locked) {
                                if (this.mxpState.on)
                                    this.ClearMXPOpen();
                                this.mxpState.on = false;
                                this.mxpState.lineType = lineType.Open;
                            }
                            continue;
                            */
                        }
                        else if (e && c === '\x1b') {
                            this._SplitBuffer += c;  //store in split buffer incase split command
                            state = ParserState.Ansi;
                        }
                        else if (i < 32 || i === 127) {
                            if (f) {
                                if (i === 1)
                                    c = '\u263A';
                                else if (i === 2)
                                    c = '\u263B';
                                else if (i === 3)
                                    c = '\u2665';
                                else if (i === 4)
                                    c = '\u2666';
                                else if (i === 5)
                                    c = '\u2663';
                                else if (i === 6)
                                    c = '\u2660';
                                else if (i === 7)
                                    c = '\u2407';
                                else if (i === 8)
                                    c = '\u25D8';
                                else if (i === 9)
                                    c = '\u25CB';
                                else if (i === 10)
                                    c = '\u25D9';
                                else if (i === 11)
                                    c = '\u2642';
                                else if (i === 12)
                                    c = '\u2640';
                                else if (i === 13)
                                    c = '\u266A';
                                else if (i === 14)
                                    c = '\u266B';
                                else if (i === 15)
                                    c = '\u263C';
                                else if (i === 16)
                                    c = '\u25BA';
                                else if (i === 17)
                                    c = '\u25C4';
                                else if (i === 18)
                                    c = '\u2195';
                                else if (i === 19)
                                    c = '\u203C';
                                else if (i === 20)
                                    c = '\u00B6';
                                else if (i === 21)
                                    c = '\u00A7';
                                else if (i === 22)
                                    c = '\u25AC';
                                else if (i === 23)
                                    c = '\u21A8';
                                else if (i === 24)
                                    c = '\u2191';
                                else if (i === 25)
                                    c = '\u2193';
                                else if (i === 26)
                                    c = '\u2192';
                                else if (i === 27)
                                    c = '\u2190';
                                else if (i === 28)
                                    c = '\u221F';
                                else if (i === 29)
                                    c = '\u2194';
                                else if (i === 30)
                                    c = '\u25B2';
                                else if (i === 31)
                                    c = '\u25BC';
                                else if (i === 127)
                                    c = '\u2302';
                                stringBuilder.push(c);
                                this.MXPCapture(c);
                                lineLength++;
                                this.textLength++;
                                this.mxpState.noBreak = false;
                            }
                            else if (d) {
                                i = 9216 + i;
                                stringBuilder.push(String.fromCharCode(i));
                                this.MXPCapture('&#');
                                this.MXPCapture(i.toString());
                                this.MXPCapture(';');
                                lineLength++;
                                this.textLength++;
                                this.mxpState.noBreak = false;
                            }
                            else
                                continue;
                        }
                        else if (c === ' ' || (this._CurrentAttributes > 0 && (this._CurrentAttributes & FontStyle.Hidden) === FontStyle.Hidden)) {
                            stringBuilder.push(' ');
                            this.MXPCapture(' ');
                            lineLength++;
                            this.textLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (c === '<' && idx >= mOffset) {
                            if (this.enableMXP && this.mxpState.on) {
                                _MXPTag = '';
                                _MXPArgs = [];
                                this._SplitBuffer += c;  //store in split buffer incase split command
                                state = ParserState.MXPTag;
                            }
                            else {
                                stringBuilder.push('<');
                                this.MXPCapture('&lt;');
                                lineLength++;
                                this.textLength++;
                            }
                        }
                        else if (c === '>') {
                            stringBuilder.push('>');
                            this.MXPCapture('&gt;');
                            lineLength++;
                            this.textLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (c === '&' && idx >= mOffset) {
                            if (this.enableMXP && this.mxpState.on) {
                                _MXPEntity = '';
                                this._SplitBuffer += c;  //store in split buffer incase split command
                                pState = state;
                                state = ParserState.MXPEntity;
                            }
                            else {
                                stringBuilder.push(c);
                                lineLength++;
                                this.textLength++;
                                this.mxpState.noBreak = false;
                            }
                        }
                        else if (c === '"') {
                            stringBuilder.push(c);
                            this.MXPCapture('&quot;');
                            lineLength++;
                            this.textLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (c === '\'') {
                            stringBuilder.push(c);
                            this.MXPCapture('&apos;');
                            lineLength++;
                            this.textLength++;
                            this.mxpState.noBreak = false;
                        }
                        else if (c === ':') {
                            stringBuilder.push(c);
                            this.MXPCapture(c);
                            lineLength++;
                            this.textLength++;
                            this.mxpState.noBreak = false;
                            if (u) {
                                _MXPComment = '';
                                let psk;
                                let pFnd = false;
                                for (p = 0; p < pl; p++) {
                                    if (idx - this.protocols[p].length < 0)
                                        continue;
                                    psk = false;
                                    const nl = this.protocols[p].length;
                                    for (let n = 0; n < nl; n++) {
                                        if (text[idx - (nl - n)] !== this.protocols[p][n]) {
                                            psk = true;
                                            break;
                                        }
                                    }
                                    if (psk)
                                        continue;
                                    lnk = stringBuilder.length;
                                    lnkOffset = lineLength;
                                    fLnk = formatBuilder.length;
                                    if (lnk > 1 + nl && stringBuilder[lnk - (2 + nl)].length === 1 && /\S/.test(stringBuilder[lnk - (2 + nl)]) && stringBuilder[lnk - (2 + nl)] !== '(' && stringBuilder[lnk - (2 + nl)] !== '[')
                                        continue;
                                    lNest = [];
                                    lnk = stringBuilder.length - (1 + nl);
                                    lnkOffset -= (1 + nl);
                                    lLnk = stringBuilder.length - 1;
                                    if (lnk > 0 && stringBuilder[lnk - 1] === '(')
                                        lNest.push(')');
                                    if (lnk > 0 && stringBuilder[lnk - 1] === '[')
                                        lNest.push(']');
                                    state = ParserState.URLFound;
                                    pFnd = true;
                                    if (pFnd)
                                        break;
                                }
                                if (!pFnd) {
                                    state = ParserState.URL;
                                    lnk = idx;
                                    lnkOffset = lineLength;
                                }
                            }
                        }
                        else if (c === '.') {
                            stringBuilder.push(c);
                            this.MXPCapture(c);
                            lineLength++;
                            this.textLength++;
                            this.mxpState.noBreak = false;
                            if (u && idx - 3 >= 0) {
                                _MXPComment = 'http://';
                                if ((text[idx - 1] === 'w' || idx[lnk - 1] === 'W') &&
                                    (text[idx - 2] === 'w' || idx[lnk - 2] === 'W') &&
                                    (text[idx - 3] === 'w' || idx[lnk - 3] === 'W')
                                ) {
                                    lnk = stringBuilder.length;
                                    lnkOffset = lineLength;
                                    fLnk = formatBuilder.length;
                                    if (lnk > 4 && stringBuilder[lnk - 5].length === 1 && /\S/.test(stringBuilder[lnk - 5]) && stringBuilder[lnk - 5] !== '(' && stringBuilder[lnk - 5] !== '[')
                                        continue;
                                    lNest = [];
                                    lnk = stringBuilder.length - 4;
                                    lnkOffset -= 4;
                                    lLnk = stringBuilder.length - 1;
                                    if (lnk > 0 && stringBuilder[lnk - 1] === '(')
                                        lNest.push(')');
                                    if (lnk > 0 && stringBuilder[lnk - 1] === '[')
                                        lNest.push(']');
                                    state = ParserState.URLFound;
                                }
                            }
                        }
                        else if (s && lineLength === 0 && text.substring(idx, idx + 8) === '!!MUSIC(') {
                            _MXPArgs = [''];
                            state = ParserState.MSPMusic;
                            idx += 7;
                            this.mxpState.noBreak = false;
                        }
                        else if (s && lineLength === 0 && text.substring(idx, idx + 8) === '!!SOUND(') {
                            _MXPArgs = [''];
                            state = ParserState.MSPSound;
                            idx += 7;
                            this.mxpState.noBreak = false;
                        }
                        else {
                            if (f && i > 127 && i < 255) {
                                if (i === 128)
                                    c = '\u00C7';
                                else if (i === 129)
                                    c = '\u00FC';
                                else if (i === 130)
                                    c = '\u00E9';
                                else if (i === 131)
                                    c = '\u00E2';
                                else if (i === 132)
                                    c = '\u00E4';
                                else if (i === 133)
                                    c = '\u00E0';
                                else if (i === 134)
                                    c = '\u00E5';
                                else if (i === 135)
                                    c = '\u00E7';
                                else if (i === 136)
                                    c = '\u00EA';
                                else if (i === 137)
                                    c = '\u00EB';
                                else if (i === 138)
                                    c = '\u00E8';
                                else if (i === 139)
                                    c = '\u00EF';
                                else if (i === 140)
                                    c = '\u00EE';
                                else if (i === 141)
                                    c = '\u00EC';
                                else if (i === 142)
                                    c = '\u00C4';
                                else if (i === 143)
                                    c = '\u00C5';
                                else if (i === 144)
                                    c = '\u00C9';
                                else if (i === 145)
                                    c = '\u00E6';
                                else if (i === 146)
                                    c = '\u00C6';
                                else if (i === 147)
                                    c = '\u00F4';
                                else if (i === 148)
                                    c = '\u00F6';
                                else if (i === 149)
                                    c = '\u00F2';
                                else if (i === 150)
                                    c = '\u00FB';
                                else if (i === 151)
                                    c = '\u00F9';
                                else if (i === 152)
                                    c = '\u00FF';
                                else if (i === 153)
                                    c = '\u00D6';
                                else if (i === 154)
                                    c = '\u00DC';
                                else if (i === 155)
                                    c = '\u00A2';
                                else if (i === 156)
                                    c = '\u00A3';
                                else if (i === 157)
                                    c = '\u00A5';
                                else if (i === 158)
                                    c = '\u20A7';
                                else if (i === 159)
                                    c = '\u0192';
                                else if (i === 160)
                                    c = '\u00E1';
                                else if (i === 161)
                                    c = '\u00ED';
                                else if (i === 162)
                                    c = '\u00F3';
                                else if (i === 163)
                                    c = '\u00FA';
                                else if (i === 164)
                                    c = '\u00F1';
                                else if (i === 165)
                                    c = '\u00D1';
                                else if (i === 166)
                                    c = '\u00AA';
                                else if (i === 167)
                                    c = '\u00BA';
                                else if (i === 168)
                                    c = '\u00BF';
                                else if (i === 169)
                                    c = '\u2310';
                                else if (i === 170)
                                    c = '\u00AC';
                                else if (i === 171)
                                    c = '\u00BD';
                                else if (i === 172)
                                    c = '\u00BC';
                                else if (i === 173)
                                    c = '\u00A1';
                                else if (i === 174)
                                    c = '\u00AB';
                                else if (i === 175)
                                    c = '\u00BB';
                                else if (i === 176)
                                    c = '\u2591';
                                else if (i === 177)
                                    c = '\u2592';
                                else if (i === 178)
                                    c = '\u2593';
                                else if (i === 179)
                                    c = '\u2502';
                                else if (i === 180)
                                    c = '\u2524';
                                else if (i === 181)
                                    c = '\u2561';
                                else if (i === 182)
                                    c = '\u2562';
                                else if (i === 183)
                                    c = '\u2556';
                                else if (i === 184)
                                    c = '\u2555';
                                else if (i === 185)
                                    c = '\u2563';
                                else if (i === 186)
                                    c = '\u2551';
                                else if (i === 187)
                                    c = '\u2557';
                                else if (i === 188)
                                    c = '\u255D';
                                else if (i === 189)
                                    c = '\u255C';
                                else if (i === 190)
                                    c = '\u255B';
                                else if (i === 191)
                                    c = '\u2510';
                                else if (i === 192)
                                    c = '\u2514';
                                else if (i === 193)
                                    c = '\u2534';
                                else if (i === 194)
                                    c = '\u252C';
                                else if (i === 195)
                                    c = '\u251C';
                                else if (i === 196)
                                    c = '\u2500';
                                else if (i === 197)
                                    c = '\u253C';
                                else if (i === 198)
                                    c = '\u255E';
                                else if (i === 199)
                                    c = '\u255F';
                                else if (i === 200)
                                    c = '\u255A';
                                else if (i === 201)
                                    c = '\u2554';
                                else if (i === 202)
                                    c = '\u2569';
                                else if (i === 203)
                                    c = '\u2566';
                                else if (i === 204)
                                    c = '\u2560';
                                else if (i === 205)
                                    c = '\u2550';
                                else if (i === 206)
                                    c = '\u256C';
                                else if (i === 207)
                                    c = '\u2567';
                                else if (i === 208)
                                    c = '\u2568';
                                else if (i === 209)
                                    c = '\u2564';
                                else if (i === 210)
                                    c = '\u2565';
                                else if (i === 211)
                                    c = '\u2559';
                                else if (i === 212)
                                    c = '\u2558';
                                else if (i === 213)
                                    c = '\u2552';
                                else if (i === 214)
                                    c = '\u2553';
                                else if (i === 215)
                                    c = '\u256B';
                                else if (i === 216)
                                    c = '\u256A';
                                else if (i === 217)
                                    c = '\u2518';
                                else if (i === 218)
                                    c = '\u250C';
                                else if (i === 219)
                                    c = '\u2588';
                                else if (i === 220)
                                    c = '\u2584';
                                else if (i === 221)
                                    c = '\u258C';
                                else if (i === 222)
                                    c = '\u2590';
                                else if (i === 223)
                                    c = '\u2580';
                                else if (i === 224)
                                    c = '\u03B1';
                                else if (i === 225)
                                    c = '\u03B2';
                                else if (i === 226)
                                    c = '\u0393';
                                else if (i === 227)
                                    c = '\u03C0';
                                else if (i === 228)
                                    c = '\u03A3';
                                else if (i === 229)
                                    c = '\u03C3';
                                else if (i === 230)
                                    c = '\u00B5';
                                else if (i === 231)
                                    c = '\u03C4';
                                else if (i === 232)
                                    c = '\u03A6';
                                else if (i === 233)
                                    c = '\u0398';
                                else if (i === 234)
                                    c = '\u03A9';
                                else if (i === 235)
                                    c = '\u03B4';
                                else if (i === 236)
                                    c = '\u221E';
                                else if (i === 237)
                                    c = '\u2205';
                                else if (i === 238)
                                    c = '\u2208';
                                else if (i === 239)
                                    c = '\u2229';
                                else if (i === 240)
                                    c = '\u2261';
                                else if (i === 241)
                                    c = '\u00B1';
                                else if (i === 242)
                                    c = '\u2265';
                                else if (i === 243)
                                    c = '\u2264';
                                else if (i === 244)
                                    c = '\u2320';
                                else if (i === 245)
                                    c = '\u2321';
                                else if (i === 246)
                                    c = '\u00F7';
                                else if (i === 247)
                                    c = '\u2248';
                                else if (i === 248)
                                    c = '\u00B0';
                                else if (i === 249)
                                    c = '\u2219';
                                else if (i === 250)
                                    c = '\u00B7';
                                else if (i === 251)
                                    c = '\u221A';
                                else if (i === 252)
                                    c = '\u207F';
                                else if (i === 253)
                                    c = '\u00B2';
                                else if (i === 254)
                                    c = '\u25A0';
                            }
                            else if (i > 255)
                                format.unicode = true;
                            stringBuilder.push(c);
                            this.MXPCapture(c);
                            lineLength++;
                            this.textLength++;
                            this.mxpState.noBreak = false;
                        }
                        break;
                }
            }
            if (this._SplitBuffer.length) {
                this.rawLength -= this._SplitBuffer.length;
                rawBuilder.splice(rawBuilder.length - this._SplitBuffer.length, this._SplitBuffer.length);
            }
            formatBuilder.push(...this.getMXPCloseFormatBlocks());
            if (state === ParserState.URLFound) {
                formatBuilder.splice(fLnk, 0,
                    {
                        formatType: FormatType.Link,
                        offset: lnkOffset,
                        href: _MXPComment += stringBuilder.slice(lnk).join('')
                    });
            }
            this.AddLine(stringBuilder.join(''), rawBuilder.join(''), true, false, formatBuilder, remote);
        }
        catch (ex) {
            if (this.enableDebug) this.emit('debug', ex);
        }
        this.busy = false;
        this.emit('parse-done');
        this.parsing.shift();
        if (this.parsing.length > 0)
            setTimeout(this.parseNext(), 0);
    }

    private parseNext() {
        const iTmp = this.parsing.shift();
        return () => { this.parse(iTmp[0], iTmp[1], true, iTmp[2]); };
    }

    public updateWindow(width, height) {
        this.window = { width: width, height: height };
    }

    public Clear() {
        this.ResetColors();
        this.textLength = 0;
        this._SplitBuffer = '';
    }

    public ClearMXP() {
        this.mxpEntities = {};
        this.ResetMXP();
        this.mxpElements = {};
        this.mxpState = new MXPState();
    }

    public ResetMXP() {
        this.mxpStyles = [];
        this.mxpStyles.push(new MXPStyle(FontStyle.None, '', '', false));
    }

    public ResetMXPLine() {
        this.iMXPDefaultMode = lineType.Open;
        this.mxpState.lineType = lineType.Open;
    }

    //public interface, as client can only access publicly marked entities
    public GetPublicEntity(entity) {
        if (this.mxpEntities[entity] && this.mxpEntities[entity].publish)
            return this.mxpEntities[entity].value;
        return entity;
    }

    /*
    public playBell() {
      if (this.enableBell) {
        const bell = new buzz.sound(this.bell);
        bell.play();
      }
    }
    */

}