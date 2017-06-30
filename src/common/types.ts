export interface Point {
  x: number;
  y: number;
}

export interface DisplayOptions extends ParserOptions {
  enableSplit?: boolean;
  enableSplitLive?: boolean;
}

export interface OverlayRange {
  start: Point;
  end: Point;
}

export interface LogOptions {
  path?: string;
  offline?: boolean;
  gagged?: boolean;
  enabled?: boolean;
  unique?: boolean;
  prepend?: boolean;
  name?: string;
  what?: Log;
  debug?: boolean;
}

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  fullscreen: boolean;
  maximized: boolean;
  devTools: boolean;
}

export enum BackupSelection {
  None = 0,
  Map = 2,
  Profiles = 4,
  Settings = 8,
  All = Map | Profiles | Settings
}

export enum NewLineType {
  None = 0,
  Ctrl = 1,
  Shift = 2,
  CtrlOrShift = 4,
  CtrlAndShift = 8
}

export enum Log {
  None = 0,
  Html = 1,
  Text = 2,
  Raw = 4
}

export enum FormatType {
  Normal = 0,
  Link = 1,
  LinkEnd = 2,
  MXPLink = 3,
  MXPLinkEnd = 4,
  Image = 5,
  WordBreak = 6,
  MXPSend = 7,
  MXPSendEnd = 8,
  MXPExpired = 9,
  MXPSkip = 10
}

/**
   * Enum flag for Font styles.
   * @readonly
   * @enum {number}
   * @typedef {number} FontStyle
   */
export enum FontStyle {
  None = 0,
  Bold = 1,
  Faint = 2,
  Italic = 4,
  Underline = 8,
  Slow = 16, /** @desc Slow blink text combined with slow for final blink  */
  Rapid = 32,/** @desc Rapid blink text combined with slow for final blink */
  Inverse = 64,/** @desc reverse back and fore color */
  Hidden = 128, /** @desc hide text */
  Strikeout = 256,
  DoubleUnderline = 512,
  Overline = 1024
}

export interface LineFormat {
  formatType: FormatType;
  offset: number;
  color: string | number;
  background: string | number;
  size: string;
  font: string;
  style: FontStyle;
  hr?: boolean;
}

export interface ImageFormat {
  formatType: FormatType;
  name: string;
  url: string;
  type: string;
  height: string;
  width: string;
  vspace: string;
  align: string;
  ismap: boolean;
}

export interface LinkFormat {
  formatType: FormatType;
  href?: string;
  hint?: string;
  expire?: string;
  prompt?: boolean;
  tt?: string | number;
}
export interface ParserLine {
  raw: string;
  line: string;
  fragment: boolean;
  gagged: boolean;
  formats: LineFormat[];
}

export interface ParserOptions {
  DefaultImageURL?: string;
  enableMXP?: boolean;
  enableDebug?: boolean;
  enableMSP?: boolean;
  enableURLDetection?: boolean;
  window?: Size;
  enableFlashing?: boolean;
  emulateTerminal?: boolean;
  bell?: string;
  enableBell?: boolean;
  display?;
  enableLinks?: boolean;
}

export class Size {
  public width: number = 0;
  public height: number = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

export interface FileInfo {
  date?: Date,
  hidden?: boolean,
  path: string,
  name: string,
  type: string,
  size: number
}

export enum IEDError {
  RESET = 1,
  USERRESET = 2,
  DL_USERABORT = 3,
  DL_NOTSTART = 4,
  DL_TOOMANY = 5,
  DL_INPROGRESS = 6,
  DL_UNKNOWN = 7,
  UL_USERABORT = 8,
  UL_BADENCODE = 9,
  UL_TOOLARGE = 10,
  UL_FAILWRITE = 11,
  UL_UNKNOWN = 12,
  UL_INVALIDFILE = 13,
  UL_INVALIDPATH = 14,
  DL_INVALIDFILE = 15,
  DL_INVALIDPATH = 16,
  CMD_INVALIDFMT = 17,
  CMD_INVALID = 18,
  DIR_INVALIDFMT = 19,
  DIR_INVALIDPATH = 20,
  UL_INVALIDFMT = 21,
  DL_INVALIDFMT = 22,
  DIR_TOOMANY = 23,
  DIR_CANTREAD = 24,
  DIR_NOTSTART = 25,
  CMD_DEINED = 26,
  CMD_INVALIDFILE = 27,
  CMD_INVALIDARG = 28,
  CMD_INVALIDPATH = 29,
  INVALIDPATH = 30,
  INVALIDFILE = 31,
  CMD_NOEXIST = 32,
  CMD_DIRECTORY = 33
}

export enum IEDCmdStatus {
  denied = 0,
  success = 1
}
