//cSpell:ignore fname
const buzz = require('buzz');
const path = require('path');
const fs = require('fs');
import EventEmitter = require('events');
import { stripQuotes } from "./library";
import { TelnetOption } from "./telnet";

enum ParseMode {
    default = 0,
    inline = 1,
    strict = 2
}

class SoundState extends EventEmitter {
    public _file: string = "";
    private _repeats: number = 1;
    private _volume: number = 100;
    private _priority: number = 50;

    public current: number = 0;
    public sound = null;
    public playing: boolean = false;
    public url: string = "";
    public continue: boolean = true;

    set file(file: string) {
        if (!this.continue)
            this.close();
        this._file = file;
    }
    get file(): string {
        return this._file;
    }

    set repeats(repeats: number) {
        if (repeats >= -1)
            this._repeats = repeats;
        else
            this._repeats = 1;
        this.current = 0;
    }

    get repeats(): number {
        return this._repeats;
    }

    set volume(volume: number) {
        if (volume >= 0 && volume <= 100)
            this._volume = volume;
        else
            this._volume = 1;
    }

    get volume(): number {
        return this._volume;
    }

    set priority(priority: number) {
        if (priority >= 0 && priority <= 100)
            this._priority = priority;
        else
            this._priority = 50;
    }

    get priority(): number {
        return this._priority;
    }

    play() {
        this.playing = true;
        if (this._repeats > 0 && this.current < this._repeats) {
            this.current++;
            this.close();
            this.open();
            this.sound.setVolume(this._volume).play();
            if (this.current < this._repeats) {
                this.sound.bind("ended abort", (e) => {
                    this.play();
                });
            }
            else
                this.sound.bind("ended abort", (e) => {
                    this.playing = false;
                    this.emit('ended');
                });
            if (this.sound.isEnded())
                this.playing = false;
        }
        else if (this._repeats === -1) {
            this.close();
            this.open();
            this.sound.setVolume(this._volume).loop().play();
            if (this.sound.isEnded())
                this.playing = false;
        }
        else
            this.playing = false;
    };

    open() {
        this.close();
        this.sound = new buzz.sound(this.url + this._file);
        this.sound.bind("loadeddata", (e) => {
            this.emit('playing', { file: this._file, sound: this.sound, state: this, duration:buzz.toTimer(this.sound.getDuration()) });
        });
        this.emit('opened');
    };

    close() {
        if (this.sound) {
            this.stop();
            delete this.sound;
            this.sound = null;
        }
        this.emit('closed');
    };

    stop() {
        if (this.sound)
            this.sound.stop();
        this.playing = false;
        this.emit('stopped');
    };
}

/**
 * Implementation of the MSP (MUD Sound Protocol)
 *
 * @author Icewolfz
 * @copyright Icewolfz 2013
 * @version 1.1
 * MSP requires the modules {@link module:telnet}.
 * MSP requires the modules {@link module:buzz}.
 * @requires module:buzz
 * @requires module:telnet
 * @namespace MSP
 * @constructor
 *
 * @property {Object} [server=false]	- Weather the server willing to do MSP
 * @property {Object} [enabled=true]	- Is MSP module enabled
 * @property {string} savePath          - Where sounds will be saved
 */
export class MSP extends EventEmitter {
    public enabled: boolean = true;
    public server: boolean = false;
    public enableDebug: boolean = false;

    public savePath:string = "";
    public defaultSoundURL: string = "";
    public defaultMusicURL: string = "";
    public forcedDefaultMusicURL: string = "http://" + window.location.hostname + "/sounds/";
    public forcedDefaultSoundURL: string = "http://" + window.location.hostname + "/sounds/";
    public defaultSoundExt: string = ".m4a";
    public defaultMusicExt: string = ".m4a";
    public MusicState: SoundState = new SoundState();
    public SoundState: SoundState = new SoundState();
    public parseMode: ParseMode = ParseMode.default;

    constructor() {
        super();
        this.MusicState.on('playing', (data) => { data.type = 1; this.emit('playing', data); });
        this.SoundState.on('playing', (data) => { data.type = 0; this.emit('playing', data) });
    }


    /**
     * getArguments - process a line of text and extract any arguments and return
     * them as an object for consuming and handle it due to being a web browser can't
     * save sounds, so they either need a url or be on the local http server using
     * the default url set
     *
     * @param {String} text the line of text extract arguments from
     * @param {Number} type the type of arguments to process, 0 SOUND, 1 MUSIC
     * @returns {Object} return a MUSIC or SOUND argument object
     */
    private getArguments(text: string, type: number) {
        var e = { off: false, file: "", url: "", volume: 100, repeat: 1, priority: 50, type: "", continue: true };
        var args = [];
        var state: number = 0;
        var str = [];
        var x: number = 0, xl: number = text.length, c: string;
        var arg, tmp;
        for (; x < xl; x++) {
            c = text.charAt(x);
            switch (state) {
                case 1:
                    if (c == "\"") {
                        state = 0;
                        str.push(c);
                    }
                    else
                        str.push(c);
                    break;
                case 2:
                    if (c == "'") {
                        state = 0;
                        str.push(c);
                    }
                    else
                        str.push(c);
                    break;
                default:
                    if (c == " ") {
                        args.push(str.join(''));
                        str = [];
                    }
                    else if (c == "\"") {
                        state = 1;
                        str.push(c);
                    }
                    else if (c == "'") {
                        state = 2;
                        str.push(c);
                    }
                    else
                        str.push(c);

                    break;
            }
        }
        if (str.length > 0) {
            args.push(str.join(''));
            str = [];
        }
        x = 0;
        xl = args.length;
        if (this.enableDebug) this.emit('debug', "MSP arguments found: " + args);
        for (x = 0; x < xl; x++) {
            arg = args[x].split('=');
            if (arg.length > 1) {
                switch (arg[0].toUpperCase()) {
                    case "FNAME":
                        e.file = stripQuotes(arg[1]);
                        if (e.file.toLowerCase() == "off") {
                            e.off = true;
                            e.file = "";
                        }
                        break;
                    case "V"://volume
                        tmp = parseInt(arg[1], 10);
                        if (isNaN(tmp))
                            tmp = 100;
                        e.volume = tmp;
                        break;
                    case "L"://repeat
                        tmp = parseInt(arg[1], 10);
                        if (isNaN(tmp))
                            tmp = 1;
                        e.repeat = tmp;
                        break;
                    //Sound only
                    case "P"://priority
                        tmp = parseInt(arg[1], 10);
                        if (isNaN(tmp))
                            tmp = 1;
                        e.priority = tmp;
                        break;
                    //Music only
                    case "C"://continue
                        e.continue = arg[1] != "0";
                        break;
                    case "T"://type
                        if (arg[1].length > 0)
                            e.type = arg[1];
                        break;
                    case "U"://url
                        e.url = stripQuotes(arg[1]);
                        if (!e.url.endsWith("/") && e.url.length > 0)
                            e.url += "/";
                        break;
                }
            }
            else if (x === 0) {
                e.file = stripQuotes(args[x]);
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
            else if (x === 3 && type === 1)
                e.continue = args[x] != "0";
            else if (x === 3) {
                tmp = parseInt(args[x], 10);
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
                if (!e.url.endsWith("/") && e.url.length > 0)
                    e.url += "/";
            }
        }
        if (this.enableDebug) this.emit('debug', e);
        return e;
    }

    reset() {
        this.server = false;
    }

    /**
     * music - process music object and player/stop based on object options
     *
     * @param {Object} data Music argument object, contains all settings
     */
    music(data) {
        if (!this.enabled) return false;
        if (!data.file || data.file.length === 0) {
            if (data.off && data.url && data.url.length > 0)
                this.defaultMusicURL = data.url;
            else if (data.off)
                this.MusicState.stop();
            return;
        }
        else if (data.off) {
            this.MusicState.stop();
            return;
        }
        this.MusicState.volume = data.volume;
        this.MusicState.repeats = data.repeat;
        this.MusicState.continue = data.continue;
        var old = this.MusicState.file;

        if (data.file.lastIndexOf('.') === -1)
            this.MusicState.file = data.file + this.defaultMusicExt;
        else
            this.MusicState.file = data.file;
        if (data.url && data.url.length > 0)
            this.MusicState.url = data.url;
        else if (this.forcedDefaultMusicURL && this.forcedDefaultMusicURL.length > 0)
            this.MusicState.url = this.forcedDefaultMusicURL;
        else if (this.defaultMusicURL && this.defaultMusicURL.length > 0)
            this.MusicState.url = this.defaultMusicURL;
        if (this.MusicState.url.length > 0 && !this.MusicState.url.endsWith("/"))
            this.MusicState.url += "/";
        if (data.type && data.type.length > 0) {
            this.MusicState.url += data.type;
            if (this.MusicState.url.length > 0 && !this.MusicState.url.endsWith("/"))
                this.MusicState.url += "/";
        }
        if (old !== this.MusicState.file || !data.continue || !this.MusicState.playing)
            this.MusicState.play();
    };

    /**
     * sound - process music object and player/stop based on object options
     *
     * @param {Object} data Sound argument object, contains all settings
     * @todo make it play/stop sound
     */
    sound(data) {
        if (!this.enabled) return false;
        if (!data.file || data.file.length === 0) {
            if (data.off && data.url && data.url.length > 0)
                this.defaultSoundURL = data.url;
            else if (data.off)
                this.SoundState.stop();
            return;
        }
        else if (data.off) {
            this.SoundState.stop();
            return;
        }
        //if playing and new priority is lower, do not play new sound
        if (this.SoundState.playing && data.priority < this.SoundState.priority)
            return false;

        this.SoundState.volume = data.volume;
        this.SoundState.repeats = data.repeat;
        this.SoundState.priority = data.priority;
        var old = this.SoundState.file;
        if (data.file.lastIndexOf('.') === -1)
            this.SoundState.file = data.file + this.defaultSoundExt;
        else
            this.SoundState.file = data.file;
        if (data.url && data.url.length > 0)
            this.SoundState.url = data.url;
        else if (this.forcedDefaultSoundURL && this.forcedDefaultSoundURL.length > 0)
            this.SoundState.url = this.forcedDefaultSoundURL;
        else if (this.defaultSoundURL && this.defaultSoundURL.length > 0)
            this.SoundState.url = this.defaultSoundURL;
        if (this.SoundState.url.length > 0 && !this.SoundState.url.endsWith("/"))
            this.SoundState.url += "/";
        if (data.type && data.type.length > 0) {
            this.SoundState.url += data.type;
            if (this.SoundState.url.length > 0 && !this.SoundState.url.endsWith("/"))
                this.SoundState.url += "/";
        }
        this.SoundState.play();
    };

    /**
     * processOption - process telnet options, if its MSP handle it and correctly reply yes we support MSP or no don't
     *
     * @param {Object} data Telnet#replyToOption event object
     */
    processOption(data: TelnetOption) {
        if (data.option === 90) {
            if (this.enableDebug)
                this.emit('Debug', "<MSP>");
            if (data.verb === 253) {
                this.server = true;
                if (this.enabled) {
                    if (this.enableDebug) this.emit('debug', "REPLY: <IAC><WILL><MSP>");
                    data.telnet.sendData([255, 251, 90], true);
                }
                else {
                    if (this.enableDebug) this.emit('debug', "REPLY: <IAC><DONT><MSP>");
                    data.telnet.sendData([255, 254, 90], true);
                }
            }
            else if (data.verb === 254) {
                this.server = false;
                if (this.enableDebug) this.emit('debug', "REPLY: <IAC><WONT><MSP>");
                data.telnet.sendData([255, 252, 90], true);
            }
            else if (data.verb === 251) {
                this.server = true;
                if (this.enabled) {
                    if (this.enableDebug) this.emit('debug', "REPLY: <IAC><DO><MSP>");
                    data.telnet.sendData([255, 253, 90], true);
                }
                else {
                    if (this.enableDebug) this.emit('debug', "REPLY: <IAC><DONT><MSP>");
                    data.telnet.sendData([255, 254, 90], true);
                }
            }
            else if (data.verb === 252) {
                this.server = false;
                if (this.enableDebug) this.emit('debug', "REPLY: <IAC><DONT><MSP>");
                data.telnet.sendData([255, 254, 90], true);
            }
            data.handled = true;
        }
    };
}
