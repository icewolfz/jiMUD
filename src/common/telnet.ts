// cSpell:words TELOP, TERMINALTYPE, NEWENVIRON, Achaea, Webdings, ENDOFRECORD, USERVAR
import EventEmitter = require('events');
import net = require('net');
import util = require('util');

const ZLIB: any = require('./../../lib/inflate_stream.min.js').Zlib;

const Socket = net.Socket;

export interface TelnetOption {
    telnet: Telnet;
    option: number;
    verb: number;
    value: string;
    handled: boolean;
}

export interface TelnetOptions {
    MCCP: boolean;
    MXP: boolean;
    NAWS: boolean;
    MSDP: boolean;
    GMCP: boolean;
    MSSP: boolean;
    ECHO: boolean;
    TTYPE: boolean;
    EOR: boolean;
    NEWENVIRON: boolean;
    ZMP: boolean;
    ATCP: boolean;
    CHARSET: boolean;
}

export interface TelnetOptionsServer {
    MCCP1: boolean;
    MCCP2: boolean;
    MXP: boolean;
    NAWS: boolean;
    MSDP: boolean;
    GMCP: boolean;
    MSSP: boolean;
    EOR: boolean;
    NEWENVIRON: boolean;
    ZMP: boolean;
    ATCP: boolean;
    CHARSET: boolean;
}

/**
 * A telnet base telnet object to create a connection to a host:port and handle
 * the base telnet protocol. In addition to the base protocol it also handles MCCP 1 & 2,
 * NAWS, MXP, GMCP, MSSP, CHARSET for UTF-8. To support MCCP it requires the module {@link module:./lib/inflate_Stream.min}.
 *
 * @author Icewolfz
 * @copyright Icewolfz 2013
 * @class Telnet
 * @extends {EventEmitter}
 * @version 2.0
 * @requires module:src/lib/zlib-inflate
 * @namespace Telnet
 * @constructor
 * @param {Object} options				- The options to start off with
 * @param {Object} options.host			- The host to connect to
 * @param {Object} options.port			- The port to connect to
 *
 * @todo add ZMP support
 * @todo add ENVIRON/NEWENVIRON exactly the same, but for var/value reversed, and there are rules to detect this so just treat ENVIRON as NEWENVIRON
 * @todo add ATCP support similar to GMCP
 * @todo add MSDP table/array support
 * @todo add MCP (Mud client protocol) - encodes protocol in text that is processed out and separates into an in bound (normal text), and out of bound (protocol data) see http://www.moo.mud.org/mcp/
 *
 * @property {Object}  options						- The telnet options to enable or disable
 * @property {Boolean} [options.ECHO=1]				- Enable/disable Echo (1)
 * @property {Boolean} [options.TTYPE=1]			- Enable/disable Terminal Type - Does MTTS (http://tintin.sourceforge.net/mtts/) (TTYPE) (24)
 * @property {Boolean} [options.EOR=1]				- Enable/disable End of record (EOR) (25/239)
 * @property {Boolean} [options.NAWS=1]				- Enable/disable Negotiate About Window Size (NAWS) (31)
 * @property {Boolean} [options.NEWENVIRON=0]	    - Enable/disable Environment Option (36/39)
 * @property {Boolean} [options.MSDP=1]				- Enable/disable Mud Server Data Protocol (MSDP) (69)
 * @property {Boolean} [options.MSSP=0]				- Enable/disable Mud Server Status Protocol (MSSP) (70)
 * @property {Boolean} [options.MCCP=1]				- Enable/disable MUD Compression Protocol (MCCP) (85/86)
 * @property {Boolean} [options.MXP=1]				- Enable/disable MUD eXtension Protocol  (MXP) (91)
 * @property {Boolean} [options.ZMP=0]				- Enable/disable Zenith MUD Protocol (ZMP) (93)
 * @property {Boolean} [options.GMCP=1]				- Enable/disable Generic Mud Communication Protocol/ATCP2 protocol (GMCP) (201)
 * @property {Boolean} [options.ATCP=0]				- Enable/disable Achaea Telnet Client Protocol (ATCP) (200)
 * @property {Boolean} [options.CHARSET=1]		    - Enable/disable CHARSET enabled, and which type, 1 is UTF-8
 * @property {Object}  server						- The telnet options the server has enabled or disabled
 * @property {Boolean} [server.NAWS=0]				- Is NAWS enabled
 * @property {Boolean} [server.MSDP=0]				- Is MSDP enabled
 * @property {Boolean} [server.GMCP=0]				- Is GMCP enabled
 * @property {Boolean} [server.MXP=0]				- Is MXP enabled
 * @property {Boolean} [server.MCCP1=0]				- Is MCCP1 enabled
 * @property {Boolean} [server.MCCP2=0]				- Is MCCP2 enabled
 * @property {Boolean} [server.MSSP=0]				- Is MSSP enabled
 * @property {Boolean} [server.NEWENVIRON=0]	    - Is NEWENVIRON enabled
 * @property {Boolean} [server.ZMP=0]				- Is ZMP enabled
 * @property {Boolean} [server.EOR=0]				- Is EOR enabled
 * @property {Boolean} [server.ATCP=0]				- Is ATCP enabled
 * @property {Boolean} [server.CHARSET=0]			- Is CHARSET enabled, and which type, 1 is UTF-8
 * @property {String}  host							- The host
 * @property {Number}  port							- The port
 * @property {Boolean} [prompt=false]				- The prompt state to determine if current end of line is a prompt or not
 * @property {Boolean} [echo=true]					- The echo state to determine if you should echo text to the screen
 * @property {Boolean} [firstSent=true]				- Weather anything has been sent yet, excluding telnet options
 * @property {Boolean} [firstReceived=true]		    - Weather anything has been received yet, excluding telnet options
 * @property {String}  version						- The version of the client to send for GMCP Core.Hello
 * @property {String}  [terminal=ansi]				- The terminal type to send the first time for TTYPE
 * @property {Boolean} [UTF8=true]					- Force process data after telnet options as UTF8 character
 * @property {Object}  [MSSP={}]					- MSSP object that contains all variables and their assigned values.
 * @property {Object}  [socket=null]				- The websocket object
 * @property {Number}  [latency=0]					- The milliseconds between the last send and the current received data
 * @property {Boolean} [enableLatency=false]	    - Attempt to calculate the latency between a send/receive, and if sent on receive send a GMCP ping back and attempt to get latency of a connection
 * @property {Number}  [latencyAvg=0]				- The average milliseconds between the last send and the current received data
 * @property {Number}  [enablePing=false]			- Enable GMCP ping back to better track latency
 * @property {Number}  [keepAlive=false]            - Enable socket KeepAlive
 * @property {Number}  [keepAliveDelay=0]           - Set socket KeepAlive delay in seconds
 * @property {Array}   GMCPSupports					- An array of supported GMCP modules for mat of "Modulate 0|1", defaults are "Core 1", "Char 1", "Char.Vitals 1", "Char.Experience 1"
 */
export class Telnet extends EventEmitter {
    private _splitBuffer: number[] = [];
    private _connected: boolean = false;
    private _MTTS: number = 0;
    private zStream: any = 0;
    private _latencyTime: Date = null;
    private _doPing: boolean = false;
    private _closed: boolean = true;
    private _zlib: boolean = false;
    private _keepAlive: boolean = false;
    private _keepAliveDelay: number = 0;

    public options: TelnetOptions = { MCCP: true, MXP: true, NAWS: true, MSDP: true, GMCP: true, MSSP: false, ECHO: true, TTYPE: true, EOR: true, NEWENVIRON: false, ZMP: false, ATCP: false, CHARSET: true };
    public host: string = '';
    public port: number = 23;
    public prompt: boolean = false;
    public echo: boolean = true;
    public firstSent: boolean = true;
    public firstReceived: boolean = true;
    public server: TelnetOptionsServer = { NAWS: false, MSDP: false, GMCP: false, MXP: false, MCCP1: false, MCCP2: false, MSSP: false, NEWENVIRON: false, ZMP: false, EOR: false, ATCP: false, CHARSET: false };
    public version: string = '2.0';
    public terminal: string = 'ansi';
    public UTF8: boolean = true;
    public MSSP = {};
    public socket = null;
    public latency: number = 0;
    public latencyAvg: number = null;
    public enableLatency: boolean = false;
    public enablePing: boolean = false;
    public GMCPSupports: string[] = ['Core 1', 'Char 1', 'Char.Vitals 1', 'Char.Experience 1'];
    public enableDebug: boolean = false;

    /**
     * Creates an instance of Telnet.
     *
     * @param {any} options a list of options to set
     *
     * @memberOf Telnet
     */
    constructor(options?: TelnetOptions | any) {
        super();
        if (options) {
            if (options.host) {
                this.host = options.host;
                delete options.host;
            }
            if (options.port) {
                this.port = options.port;
                delete options.port;
            }
        }
        this.options = Object.assign(this.options, options || {});
    }

    /**
     * @name connected
     * @desc determine if connected to host
     * @returns {Boolean} weather connected to host or not
     *
     * @readonly
     *
     * @memberOf Telnet
     */
    get connected(): boolean {
        if (!this.socket || typeof this.socket === 'undefined')
            return false;
        return this._connected;
    }

    /**
     * @name keepalive
     * @desc set socket keepalive
     * @returns {boolean} is keepalive enabled
     * @memberOf Telnet
     */

    get keepAlive(): boolean {
        return this._keepAlive;
    }

    set keepAlive(value: boolean) {
        this._keepAlive = value;
        if (this.socket)
            this.socket.setKeepAlive(this._keepAlive, this._keepAliveDelay * 1000);
    }

    /**
     * @name keepaliveDelay
     * @desc set socket keepalive delay
     * @returns {number} current keepalive delay in seconds
     * @memberOf Telnet
     */

    get keepAliveDelay(): number {
        return this._keepAliveDelay;
    }

    set keepAliveDelay(value: number) {
        this._keepAliveDelay = value;
        if (this.socket)
            this.socket.setKeepAlive(this._keepAlive, this._keepAliveDelay * 1000);
    }

    /**
         * @name Telnet#reset
         * @desc reset state in preparation for a connect
         */
    public reset() {
        this._MTTS = 0;
        this.firstSent = true;
        this.firstReceived = true;
        this.prompt = false;
        this.echo = true;
        this.server = { NAWS: false, MSDP: false, GMCP: false, MXP: false, MCCP1: false, MCCP2: false, MSSP: false, EOR: false, NEWENVIRON: false, ATCP: false, CHARSET: false, ZMP: false };
        this._splitBuffer = [];
        this._endMCCP();
        this._connected = false;
        this._closed = false;
        if (this.enableDebug)
            this.emit('debug', 'Reset');
    }

    /**
     * @name connect
     * @desc connect to target host
     *
     * @fires Telnet#connecting
     */
    public connect() {
        this._destroySocket();
        this.reset();
        this.emit('connecting');
        this.socket = this._createSocket();
        try {
            this.socket.connect(this.port, this.host);
        }
        catch (e) {
            this.emit('error', e);
        }
        if (this.enableDebug)
            this.emit('debug', 'Connecting to ' + this.host + ':' + this.port);
    }

    /**
     * @name Telnet#close
     * @desc close the connection ot host and reset state in preparation for next connection
     *
     * @fires Telnet#close
     */
    public close() {
        if (this._closed) return;
        this._destroySocket();
        this.reset();
        this.emit('close');
        this._closed = true;
        if (this.enableDebug)
            this.emit('debug', 'Closed');
    }

    /**
     * @name Telnet#receivedData
     * @desc data that is received from the host to be processed
     *
     * @param {String} data string received from host
     * @fires Telnet#received-data
     */
    public receivedData(data, skipDecompress?: boolean) {
        if (this.enableLatency) {
            if (this._latencyTime !== null) {
                this.latency = new Date().getTime() - this._latencyTime.getTime();
                if (this.latencyAvg == null)
                    this.latencyAvg = this.latency;
                else
                    this.latencyAvg = (this.latency + this.latencyAvg) / 2;
                this._latencyTime = null;
                this._doPing = false;
                this.emit('latency-changed', this.latency, this.latencyAvg);
            }
            else if (!this._doPing && this.enablePing)
                this._doPing = true;
            else {
                this._latencyTime = null;
                this._doPing = false;
            }
        }
        if (this.enableDebug)
            this.emit('debug', 'PreProcess:' + data, 1);
        data = this.processData(data, skipDecompress);
        if (this.enableDebug)
            this.emit('debug', 'PostProcess:' + data, 1);
        this.emit('received-data', data);
        if (this.enableLatency) {
            //split packet more then likely so reset timer for next part
            if (this._splitBuffer.length > 0) {
                if (this.enablePing) this._doPing = true;
                this._latencyTime = null;
            }
            //gmcp ping, send after process to have a more accurate time
            else if (this._doPing && this.enablePing) {
                setTimeout(() => {
                    this._latencyTime = new Date();
                    this.sendGMCP('Core.Ping ' + this.latencyAvg);
                });
            }
            else
                this._doPing = false;
        }
    }

    /**
     * @name Telnet#sendTerminal
     * @desc Send terminal type telnet option to mud to identify the terminal
     */
    public sendTerminal() {
        if (this.enableDebug) {
            if (this._MTTS === 0)
                this.emit('debug', 'REPLY: <IAC><SB><TERMINALTYPE><IS>' + this.terminal + '<IAC><SE>');
            else if (this._MTTS === 1)
                this.emit('debug', 'REPLY: <IAC><SB><TERMINALTYPE><IS>ANSI-256COLOR<IAC><SE>');
            else if (this._MTTS >= 2)
                this.emit('debug', 'REPLY: <IAC><SB><TERMINALTYPE><IS>MTTS 9<IAC><SE>');
        }
        if (this._MTTS === 0) {
            this.sendData([255, 250, 24, 0], true);
            this.sendData(Buffer.from(this.terminal, 'ascii'), true);
            this.sendData([255, 240], true);
        }
        else if (this._MTTS === 1)
            this.sendData([255, 250, 24, 0, 65, 78, 83, 73, 45, 50, 53, 54, 67, 79, 76, 79, 82, 255, 240], true);
        else if (this._MTTS >= 2)
            this.sendData([255, 250, 24, 0, 77, 84, 84, 83, 32, 57, 255, 240], true);
    }

    /**
     * @name Telnet#sendData
     * @desc Send data to the host
     *
     * @param {String} data string to send
     * @param {Boolean} raw send raw unescaped telnet data to host, other wise it will escape the IAC for proper telnet
     * @fires Telnet#data-sent
     */
    public sendData(data: any, raw?: boolean) {
        if (data == null || typeof data === 'undefined' || data.length === 0)
            return;
        if (this.connected) {
            try {
                if (!raw) {
                    this.prompt = false;
                    data = this._escapeData(data);
                    if (this.enableLatency) this._latencyTime = new Date();
                }
                if (this.socket !== null) {
                    if (!Buffer.isBuffer(data))
                        data = Buffer.from(data, 'binary');
                    if (this.enableDebug)
                        this.emit('debug', 'sendData:' + data.toString('binary'), 2);
                    this.socket.write(data, 'binary');
                    if (!raw) this.firstSent = false;
                }

            }
            catch (e) {
                this.emit('error', e);
            }
        }
        else if (this.enableLatency)
            this._latencyTime = null;
        this.emit('data-sent', data);
    }

    /**
     * @name Telnet#processData
     * @desc Process raw incoming data
     *
     * @param {string} data The data to process
     * @returns {string} The results of the processed data
     * @fires Telnet#receive-option
     * @fires Telnet#receive-MSDP
     * @fires Telnet#receive-GMCP
     * @fires Telnet#receive-MSSP
     * @fires Telnet#receive-NEWENVIRON
     * @fires Telnet#receive-CHARSET
     */
    //this.processData = function(data) { return data; };
    public processData(data, skipDecompress?: boolean) {
        let len: number;
        let _sb;
        if (data == null)
            return data;
        if (!skipDecompress)
            data = this._decompressData(data);
        len = data.length;
        if (len === 0)
            return data;
        _sb = this._splitBuffer;

        if (_sb.length > 0) {
            if (this.enableDebug) this.emit('debug', 'Split buffer length: ' + _sb.length, 1);
            data = Buffer.concat([Buffer.from(_sb, 'binary'), data]);
            _sb = [];
            len = data.length;
        }
        let state: number = 0;
        let pState: number = 0;
        let processed: (Buffer | any[]) = [];

        const ga: boolean = this.prompt;
        let verb: number = 0;
        let option: number = 0;
        let msdp_val: string = '';
        let msdp_var: string = '';
        let _MSSP;
        let i: number = 0;
        let ne: number;
        let idx: number = 0;
        let tmp: (string | boolean) = '';
        //reset for new state
        this.prompt = false;
        let debugOp = '';
        try {
            for (; idx < len; idx++) {
                i = data[idx];
                switch (state) {
                    case 0:
                        // If the current byte is the "Interpret as Command" code, set the state to 1.
                        if (i === 255) {
                            if (this.enableDebug) debugOp = 'TELOP: <IAC>';
                            //store in case it is split;
                            _sb.push(i);
                            state = 1;
                        }
                        else
                            processed.push(i);
                        break;
                    case 1: // Telnet Option
                        if (i === 255) //escaped
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<IAC>');
                                debugOp = '';
                            }
                            processed.push(i);
                            _sb = [];
                            state = 0;
                        }
                        else if ((!this.options.EOR || !this.server.EOR) && i === 239) //EOR, if not enabled treat as NOP
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<NOP>');
                                debugOp = '';
                            }
                            _sb = [];
                            state = 0;
                        }
                        else if (i === 241 || i === 130) //no operation, just continue on
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<NOP>');
                                debugOp = '';
                            }
                            _sb = [];
                            state = 0;
                        }
                        else if (i === 249 || i === 239) //EOR | GA
                        {
                            if (this.enableDebug) {
                                if (i === 239)
                                    this.emit('debug', debugOp + '<EOR>');
                                else
                                    this.emit('debug', debugOp + '<GA>');
                                debugOp = '';
                            }
                            //more data to read, so ga means nothing but a new line
                            if (idx + 1 < len && len - idx > 2) {
                                processed.push(10);
                                this.prompt = false;
                            }
                            else
                                this.prompt = true;
                            _sb = [];
                            state = 0;
                        }
                        else if (i === 253 || i === 254 || i === 251 || i === 252) //WILL DONT WONT DO
                        {
                            if (this.enableDebug) {
                                switch (i) {
                                    case 253: debugOp += '<DO>'; break;
                                    case 254: debugOp += '<DONT>'; break;
                                    case 251: debugOp += '<WILL>'; break;
                                    case 252: debugOp += '<WONT>'; break;
                                }
                            }
                            //store in case it is split;
                            _sb.push(i);
                            verb = i;
                            state = 2;
                        }
                        else if (i === 250) // Sub negotiation
                        {
                            if (this.enableDebug) debugOp += '<SB>';
                            _sb.push(i);
                            state = 3;
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            _sb = [];
                            state = 0;
                        }
                        break;
                    case 2: //WILL DONT WONT DO response
                        if (i === 1) // ECHO
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<ECHO>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                if (this.options.ECHO) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><ECHO>');
                                    this.replyToOption(i, 251, verb);
                                    this.echo = false;
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><ECHO>');
                                    this.echo = true;
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><ECHO>');
                                this.replyToOption(i, 252, verb);
                                this.echo = true;
                            }
                            else if (verb === 251) {
                                if (this.options.ECHO) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><ECHO>');
                                    this.replyToOption(i, 253, verb);
                                    this.echo = false;
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><ECHO>');
                                    this.echo = true;
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><ECHO>');
                                this.echo = true;
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 24) // TERMINALTYPE
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<TERMINALTYPE>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                if (this.options.TTYPE) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><TERMINALTYPE>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><TERMINALTYPE>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><TERMINALTYPE>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                if (this.options.TTYPE) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><TERMINALTYPE>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><TERMINALTYPE>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><TERMINALTYPE>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 25) // END OF RECORD
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<ENDOFRECORD>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.EOR = true;
                                if (this.options.EOR) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><ENDOFRECORD>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><ENDOFRECORD>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><ENDOFRECORD>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.EOR = true;
                                if (this.options.EOR) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><ENDOFRECORD>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><ENDOFRECORD>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><ENDOFRECORD>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 31) // NAWS
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<NAWS>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.NAWS = true;
                                if (this.options.NAWS) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><NAWS>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><NAWS>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                this.server.NAWS = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><NAWS>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.NAWS = true;
                                if (this.options.NAWS) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><NAWS>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><NAWS>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                this.server.NAWS = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><NAWS>');
                                this.replyToOption(i, 254, verb);
                            }
                            this.emit('windowSize');
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 36 || i === 39) // NEWENVIRON
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<NEWENVIRON>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.NEWENVIRON = true;
                                if (this.options.NEWENVIRON) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><NEWENVIRON>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><NEWENVIRON>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><NEWENVIRON>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.NEWENVIRON = true;
                                if (this.options.NEWENVIRON) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><NEWENVIRON>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><NEWENVIRON>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><NEWENVIRON>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 69) // MSDP
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<MSDP>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.MSDP = true;
                                if (this.options.MSDP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><MSDP>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MSDP>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                this.server.MSDP = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><MSDP>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.MSDP = true;
                                if (this.options.MSDP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><MSDP>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MSDP>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                this.server.MSDP = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MSDP>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 70) // MSSP
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<MSSP>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.MSSP = true;
                                if (this.options.MSSP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><MSSP>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MSSP>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                this.server.MSSP = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><MSSP>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.MSSP = true;
                                if (this.options.MSSP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><MSSP>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MSSP>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                this.server.MSSP = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MSSP>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 85) // MCCP1
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<MCCP1>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.MCCP1 = true;
                                if (this.options.MCCP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><MCCP1>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MCCP1>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                this.server.MCCP1 = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><MCCP1>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.MCCP1 = true;
                                if (this.options.MCCP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><MCCP1>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MCCP1>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                this.server.MCCP1 = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MCCP1>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 86) // MCCP2
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<MCCP2>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.MCCP2 = true;
                                if (this.options.MCCP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><MCCP2>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MCCP2>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                this.server.MCCP2 = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><MCCP2>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.MCCP2 = true;
                                if (this.options.MCCP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><MCCP2>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MCCP2>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                this.server.MCCP2 = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MCCP2>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 91) // MXP
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<MXP>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.MXP = true;
                                if (this.options.MXP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><MXP>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MXP>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                this.server.MXP = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><MXP>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.MXP = true;
                                if (this.options.MXP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><MXP>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MXP>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                this.server.MXP = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><MXP>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 130 || i === 241) // NOP
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<NOP>');
                                debugOp = '';
                            }
                            this._fireReceiveOption(i, verb, '');
                            _sb = [];
                            state = 0;
                        }
                        else if (i === 201) //GMCP
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<GMCP>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.GMCP = true;
                                if (this.options.GMCP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><GMCP>');
                                    this.replyToOption(i, 251, verb);
                                    this._startGMCP();
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><GMCP>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                this.server.GMCP = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><GMCP>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.GMCP = true;
                                if (this.options.GMCP) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><GMCP>');
                                    this.replyToOption(i, 253, verb);
                                    this._startGMCP();
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><GMCP>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                this.server.GMCP = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><GMCP>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 42) //CHARSET
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<CHARSET>');
                                debugOp = '';
                            }
                            if (verb === 253) {
                                this.server.CHARSET = true;
                                if (this.options.CHARSET) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WILL><CHARSET>');
                                    this.replyToOption(i, 251, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><CHARSET>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 254) {
                                this.server.CHARSET = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><CHARSET>');
                                this.replyToOption(i, 252, verb);
                            }
                            else if (verb === 251) {
                                this.server.CHARSET = true;
                                if (this.options.CHARSET) {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DO><CHARSET>');
                                    this.replyToOption(i, 253, verb);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><CHARSET>');
                                    this.replyToOption(i, 254, verb);
                                }
                            }
                            else if (verb === 252) {
                                this.server.CHARSET = false;
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><CHARSET>');
                                this.replyToOption(i, 254, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        else // Blindly reject the option.
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + this._formatByte(i));
                                debugOp = '';
                            }
                            if (verb === 251 || verb === 252) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><DONT><' + i + '>');
                                this.replyToOption(i, 254, verb);
                            }
                            else if (verb === 254 || verb === 253) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><WONT><' + i + '>');
                                this.replyToOption(i, 252, verb);
                            }
                            state = 0;
                            _sb = [];
                        }
                        break;
                    case 3: // Sub negotiation
                        option = i;
                        if (i === 24) // TERMINALTYPE
                        {
                            if (this.enableDebug) debugOp += '<TERMINALTYPE>';
                            _sb.push(i);
                            option = i;
                            state = 4;
                        }
                        else if (i === 36 || i === 39) // NEWENVIRON
                        {
                            if (this.enableDebug) debugOp += '<NEWENVIRON>';
                            _sb.push(i);
                            option = i;
                            state = 12;
                            ne = -1;
                        }
                        else if (i === 69) // MSDP
                        {
                            if (this.enableDebug) debugOp += '<MSDP>';
                            _sb.push(i);
                            option = i;
                            state = 4;
                        }
                        else if (i === 70) // MSSP
                        {
                            if (this.enableDebug) debugOp += '<MSSP>';
                            _sb.push(i);
                            option = i;
                            state = 8;
                            _MSSP = {};
                        }
                        else if (i === 85 || i === 86) // MCCP1 & MCCP2
                        {
                            if (this.enableDebug) debugOp += i === 85 ? '<MCCP1>' : '<MCCP2>';
                            _sb.push(i);
                            option = i;
                            state = 11;
                        }
                        else if (i === 201) {
                            if (this.enableDebug) debugOp += '<GMCP>';
                            _sb.push(i);
                            option = i;
                            state = 7;
                        }
                        //IAC SB MXP IAC SE - this tells the client that from now on we are sending MXP sequences.
                        //http://www.mushclient.com/mushclient/addingservermxp.htm
                        //Not sure what to reply once you receive this from a sever
                        //else if(i === 91)
                        //{
                        //}
                        else if (i === 240) // SE
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                debugOp = '';
                            }
                            this._fireReceiveOption(option, 250, Buffer.from(_sb.slice(1, _sb.length - 4)).toString('ascii'));
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 42) //CHARSET
                        {
                            if (this.enableDebug) debugOp += '<CHARSET>';
                            _sb.push(i);
                            option = i;
                            state = 17;
                            msdp_val = '';
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            _sb.push(i);
                        }
                        break;
                    case 4: //MSDP negotiation
                        if (option === 24 && i === 1) // TERMINALTYPE SEND
                        {
                            if (this.enableDebug) debugOp += '<SEND>';
                            _sb.push(i);
                            verb = 1;
                        }
                        else if (i === 240) // SE
                        {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                debugOp = '';
                            }
                            if (option === 24 && verb === 1) // TERMINALTYPE
                            {
                                tmp = false;
                                this._fireReceiveOption(option, 250, '');
                                if (!tmp) {
                                    this.sendTerminal(); //sending it once doesn't seem to work, sending it a 2nd time seems to register it correctly
                                    this.sendTerminal();
                                    this._MTTS++;
                                }
                            }
                            state = 0;
                            _sb = [];
                        }
                        else if (option === 69 && i === 1) // MSDP
                        {
                            if (this.enableDebug) debugOp += '<MSDP_VAR>';
                            _sb.push(i);
                            msdp_var = '';
                            state = 5;
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            _sb.push(i);
                        }
                        break;
                    case 5: // MSDP Variable
                        if (i === 2) {
                            if (this.enableDebug) debugOp += '<MSDP_VAL>';
                            _sb.push(i);
                            msdp_val = '';
                            state = 6;
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            msdp_var += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                    case 6: // MSDP Value
                        if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                        }
                        else if (i === 1) {
                            if (this.enableDebug) debugOp += '<MSDP_VAR>';
                            this._fireReceiveMSDP(msdp_var, msdp_val);
                            msdp_val = '';
                            msdp_var = '';
                            _sb.push(i);
                            state = 5;
                        }
                        else if (i === 240) {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                debugOp = '';
                            }
                            this._fireReceiveOption(option, 250, Buffer.from(_sb.slice(1, _sb.length - 4)).toString('ascii'));
                            this._fireReceiveMSDP(msdp_var, msdp_val);
                            msdp_val = '';
                            msdp_var = '';
                            state = 0;
                            _sb = [];
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            msdp_val += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                    case 7: // GMCP Sub Sub negotiation
                        if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                        }
                        else if (i === 240) {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                debugOp = '';
                            }
                            this._fireReceiveOption(option, 250, Buffer.from(_sb.slice(1, _sb.length - 4)).toString('ascii'));
                            this._fireReceiveGMCP(msdp_val);
                            state = 0;
                            msdp_val = '';
                            _sb = [];
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            msdp_val += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                    case 8: // MSSP Sub negotiation
                        if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                        }
                        else if (i === 240) {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                this.emit('debug', this.MSSP);
                                debugOp = '';
                            }
                            this._fireReceiveOption(option, 250, Buffer.from(_sb.slice(1, _sb.length - 4)).toString('ascii'));
                            this.emit('receive-MSSP', _MSSP);
                            msdp_val = '';
                            msdp_var = '';
                            _MSSP = 0;
                            state = 0;
                            _sb = [];
                        }
                        else if (i === 1) {
                            if (this.enableDebug) debugOp += '<MSSP_VAR>';
                            _sb.push(i);
                            msdp_var = '';
                            state = 9;
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            _sb.push(i);
                        }
                        break;
                    case 9: // MSSP Variable
                        if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                            state = 8;
                        }
                        else if (i === 1) {
                            if (this.enableDebug) debugOp += '<MSSP_VAR>';
                            _sb.push(i);
                            msdp_var = '';
                        }
                        else if (i === 2) {
                            if (this.enableDebug) debugOp += '<MSSP_VAL>';
                            _sb.push(i);
                            this.MSSP[msdp_var] = '';
                            _MSSP[msdp_var] = '';
                            state = 10;
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            msdp_var += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                    case 10: // MSSP Value
                        if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                            state = 8;
                        }
                        else if (i === 1) {
                            if (this.enableDebug) debugOp += '<MSSP_VAR>';
                            _sb.push(i);
                            msdp_var = '';
                            state = 9;
                        }
                        else if (i === 2) {
                            if (this.enableDebug) debugOp += '<MSSP_VAL>';
                            _sb.push(i);
                            this.MSSP[msdp_var] = '';
                            _MSSP[msdp_var] = '';
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            this.MSSP[msdp_var] += String.fromCharCode(i);
                            _MSSP[msdp_var] += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                    case 11: // MCCP Sub negotiation
                        if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                        }
                        else if (i === 240) {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                debugOp = '';
                            }
                            this._fireReceiveOption(option, 86, '');
                            this._startMCCP();
                            state = 0;
                            _sb = [];
                            if (idx < len - 1)
                                processed = processed.concat(this.processData(data.slice(idx + 1), skipDecompress).slice());
                            idx = len;
                        }
                        break;
                    case 12: // NEWENVIRON Sub sub negotiation
                        if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                        }
                        else if (i === 240) {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                debugOp = '';
                            }
                            this._fireReceiveOption(option, 250, Buffer.from(_sb.slice(1, _sb.length - 4)).toString('ascii'));
                            this._fireReceiveGMCP(msdp_val);
                            state = 0;
                            msdp_val = '';
                            _sb = [];
                        }
                        else if (i === 0) // IS
                        {
                            if (this.enableDebug) debugOp += '<IS>';
                            _sb.push(i);
                            state = 13;
                            verb = i;
                        }
                        else if (i === 1) // SEND
                        {
                            if (this.enableDebug) debugOp += '<SEND>';
                            _sb.push(i);
                            state = 13;
                            verb = i;
                        }
                        else if (i === 2) // INFO
                        {
                            if (this.enableDebug) debugOp += '<SEND>';
                            _sb.push(i);
                            state = 13;
                            verb = i;
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            msdp_val += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                    case 13: // NEWENVIRON
                        if (i === 0) //var
                        {
                            if (this.enableDebug) debugOp += '<VAR>';
                            _sb.push(i);
                            state = 14;
                            verb = i;
                            msdp_var = '';
                            if (ne === -1) ne = 0;
                        }
                        else if (i === 1) //value
                        {
                            if (this.enableDebug) debugOp += '<VALUE>';
                            _sb.push(i);
                            state = 13;
                            verb = i;
                            if (ne === -1) ne = 1;
                        }
                        else if (i === 3) //user var
                        {
                            if (this.enableDebug) debugOp += '<USERVAR>';
                            _sb.push(i);
                            state = 13;
                            verb = i;
                        }
                        else if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                        }
                        else if (i === 240) {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                debugOp = '';
                            }
                            tmp = this._fireReceiveOption(option, 250, Buffer.from(_sb.slice(1, _sb.length - 4)).toString('ascii'));
                            this.emit('receive-NEWENVIRON', msdp_val);
                            //custom handled so dont do defaults
                            if (!tmp) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><SB><NEWENVIRON><IS><IAC><SE>');
                                this.sendData([255, 250, option, 0, 255, 40], true);
                            }
                            state = 0;
                            msdp_val = '';
                            _sb = [];
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            msdp_val += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                    case 14:  // NEWENVIRON Var
                        if (i === 2) //escape
                        {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            _sb.push(i);
                            state = 15;
                            pState = 14;
                        }
                        else if (i === 255 || i <= 3) {
                            idx--;
                            state = 13;
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            msdp_var += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                    case 15:
                        if (this.enableDebug) debugOp += this._formatByte(i);
                        if (pState === 16)
                            msdp_val += String.fromCharCode(i);
                        else
                            msdp_var += String.fromCharCode(i);
                        state = pState;
                        _sb.push(i);
                        break;
                    case 16:
                        break;
                    case 17: //CHARSET
                        if (i === 1) //REQUEST
                        {
                            if (this.enableDebug) debugOp += '<REQUEST>';
                            _sb.push(i);
                            state = 18;
                            msdp_val = '';
                        }
                        //TODO add table support
                        else if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                        }
                        else if (i === 240) {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                debugOp = '';
                            }
                            tmp = this._fireReceiveOption(option, 250, msdp_val);
                            this.emit('receive-CHARSET', msdp_val);
                            if (!tmp) {
                                if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><SB><CHARSET><REJECTED><IAC><SE>');
                                this.sendData([255, 250, 42, 3, 255, 240], true);
                            }
                            state = 0;
                            msdp_val = '';
                            _sb = [];
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            msdp_val += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                    case 18: //CHARSET REQUEST
                        if (i === 255) {
                            if (this.enableDebug) debugOp += '<IAC>';
                            _sb.push(i);
                        }
                        else if (i === 240) {
                            if (this.enableDebug) {
                                this.emit('debug', debugOp + '<SE>');
                                debugOp = '';
                            }
                            tmp = this._fireReceiveOption(option, 250, msdp_val);
                            this.emit('receive-CHARSET', msdp_val.slice(1));
                            if (!tmp) {
                                if (this.options.CHARSET && msdp_val.slice(1).toLowerCase() === 'utf-8') {
                                    this.server.CHARSET = true;
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><SB><ACCEPTED>UTF-8<IAC><SE>');
                                    this.sendData([255, 250, 42, 2], true);
                                    this.sendData('UTF-8', true);
                                    this.sendData([255, 240], true);
                                }
                                else {
                                    if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><SB><CHARSET><REJECTED><IAC><SE>');
                                    this.sendData([255, 250, 42, 3, 255, 240], true);
                                }
                            }
                            state = 0;
                            msdp_val = '';
                            _sb = [];
                        }
                        else {
                            if (this.enableDebug) debugOp += this._formatByte(i);
                            msdp_val += String.fromCharCode(i);
                            _sb.push(i);
                        }
                        break;
                }
            }
        }
        catch (e) {
            this.emit('error', e);
        }
        if (this.enableDebug) {
            {
                if (debugOp.length > 0)
                    this.emit('debug', debugOp);
            }
            this.emit('debug', 'Post Split buffer length: ' + _sb.length, 1);
            this.emit('debug', 'Post Split buffer  ' + Buffer.from(_sb), 1);
        }
        //if processed and was prev goAhead, it needs to starts a new line to correctly end goAhead
        if (ga && processed.length > 0)
            processed.unshift(10);
        else if (ga)  //go ahead wasn't effected and if prev true, so reset back to true
            this.prompt = true;
        if (processed.length > 0)
            this.firstReceived = false;
        this._splitBuffer = _sb;

        processed = Buffer.from(processed);
        //force UTF8 or if charset is enabled and type is UTF8 process data as UTF8 data
        if (this.UTF8 || (this.options.CHARSET))
            return processed.toString('UTF8');
        return processed;
    }

    /**
     * @name Telnet#replyToOption
     * @desc Replay to a telnet option
     *
     * @param {Number} op The telnet option code
     * @param {Number} verb The telnet verb to reply with
     * @param {Number} reply The telnet verb your reply from
     * @param {String|undefined} val The value if the option has one
     * @return boolean returns if the reply was handled or not
     * @fires Telnet#receive-option
     */
    public replyToOption(op: number, verb: number, reply: number, val?: string): boolean {
        if (typeof val === 'undefined') val = '';
        if (this._fireReceiveOption(op, reply, val))
            return false;
        this.sendData([255, verb, op], true);
        return true;
    }

    /**
     * @name Telnet#updateWindow
     * @desc Send a NAWS Window update
     *
     * @param {Number} w The current width in lines of the window
     * @param {Number} h The current height in characters of the window
     */
    public updateWindow(w, h) {
        if (h < 1 || w < 1 || !this.connected || !this.server.NAWS) return;
        try {
            let w1;
            let w2;
            let h1;
            let h2;
            const mf = Math.floor;
            w1 = mf(w / 256);
            if (w1 > 256)
                w1 = 255;
            w2 = w % 256;
            h1 = mf(h / 256);
            if (h1 > 256)
                h1 = 255;
            h2 = h % 256;
            if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><SB><NAWS><' + w1 + '><' + w2 + '><' + h1 + '><' + h2 + '><IAC><SE>');
            this.sendData([255, 250, 31, w1, w2, h1, h2, 255, 240], true);
        }
        catch (e) {
            this.emit('error', { message: 'UpdateWindow Error: ' + e, err: e });
        }
    }

    /**
     * @name Telnet#sendGMCP
     * @desc Send a GMCP formated string
     *
     * @param {String} str The GMCP formated string to send to the host
     */
    public sendGMCP(str) {
        if (this.connected && this.server.GMCP) {
            if (this.enableDebug) this.emit('debug', 'REPLY: <IAC><SB><GMCP>' + this._escapeData(str).toString('binary') + '<IAC><SE>');
            this.sendData([255, 250, 201], true);
            this.sendData(this._escapeData(str), true);
            this.sendData([255, 240], true);
        }
    }

    /**
     * @name Telnet#startGMCP
     * @desc Start GMCP and send Core.Hello and Core.Support.Set
     */
    private _startGMCP() {
        if (this.server.GMCP) {
            if (this.enableDebug)
                this.emit('debug', 'REPLY: <IAC><SB><GMCP>Core.Hello { "client": "' + this.terminal + '", "version": "' + this.version + '" }<IAC><SE>');
            this.sendData([255, 250, 201], true);
            this.sendData('Core.Hello { "client": "' + this.terminal + '", "version": "' + this.version + '" }', true);
            this.sendData([255, 240], true);
            this.sendData([255, 250, 201], true);

            if (this.GMCPSupports.length > 0) {
                //ensure we at least support core module
                if (this.GMCPSupports.indexOf('Core 1') === -1)
                    this.GMCPSupports.unshift('Core 1');
                if (this.enableDebug)
                    this.emit('debug', 'REPLY: <IAC><SB><GMCP>' + JSON.stringify(this.GMCPSupports) + '<IAC><SE>');
                this.sendData('Core.Supports.Set ' + JSON.stringify(this.GMCPSupports));
            }
            else {
                if (this.enableDebug)
                    this.emit('debug', 'REPLY: <IAC><SB><GMCP>Core.Supports.Set [ "Core 1" ]<IAC><SE>');
                this.sendData('Core.Supports.Set [ "Core 1" ]', true);
            }
            this.sendData([255, 240], true);
        }
    }

    /**
     * @name Telnet#startMCCP
     * @desc Start MCCP compression protocol and set compress state on
     */
    private _startMCCP() {
        this._zlib = true;
    }

    /**
     * @name Telnet#endMCCP
     * @desc End MCCP compression protocol and set compress state off
     */
    private _endMCCP() {
        this._zlib = false;
        this.zStream = 0;
    }

    /**
     * @name Telnet#decompressData
     * @desc Decompresses a ZLIB stream if ZLIB is present and compress state is on
     *
     * @param {String} data The compressed data string
     * @returns {String} The decompressed data or the original data i ZLIB is not found or compress state is off
     */
    private _decompressData(data) {
        if (!this._zlib) return data;
        if (!this.zStream)
            this.zStream = new ZLIB.InflateStream();
        if (this.enableDebug) this.emit('debug', 'Pre decompress:' + data.toString('binary'), 1);
        data = this.zStream.decompress(data);
        if (this.enableDebug) this.emit('debug', 'Post decompress:' + data.toString('binary'), 1);
        return new Buffer(data, 'binary');
    }

    /**
     * @name Telnet#escapeData
     * @desc Escape data for sending over telnet, IAC should become IAC IAC and \r to \r\0 and \n to \r\n
     *
     * @param {String} data the data to be escaped
     * @returns {String} the data after being escaped
     *
     */
    private _escapeData(data) {
        if (data == null || typeof data === 'undefined') return data;
        let dl;
        let ba;
        let idx = 0;
        if (!Buffer.isBuffer(data) && !Array.isArray(data))
            data = Buffer.from(data);
        dl = data.length;
        ba = [];
        for (; idx < dl; idx++) {
            ba.push(data[idx]);
            if (data[idx] === 255)
                ba.push(255);
            else if (data[idx] === 13 && dl === 1)
                ba.push(10);
            else if (data[idx] === 10 && dl === 1) {
                ba.push(13);
                ba.push(0);
            }
        }
        return Buffer.from(ba, 'binary');
    }

    /**
     * @name Telnet#createSocket
     * @desc Create a websocket object and assign events
     *
     * @returns {object} returns the socket object
     */
    private _createSocket() {
        let _socket;
        try {
            _socket = new Socket({ allowHalfOpen: true });
            //_socket.setEncoding('binary');
            _socket.on('close', err => {
                if (err)
                    this.emit('error', { message: 'Closed due to transmission error', err: err });
                else
                    this.close();
            });
            _socket.on('connect', () => {
                _socket.setKeepAlive(this._keepAlive, this._keepAliveDelay * 1000);
                this.emit('connect');
                this._connected = true;
            });
            _socket.on('data', data => {
                if (this.enableDebug) this.emit('debug', 'Data received: ' + data, 1);
                this.receivedData(data);
            });
            _socket.on('end', () => {
                this.close();
            });
            _socket.on('timeout', () => {
                this.emit('error', 'Connection timed out.');
            });
            _socket.on('error', (err) => {
                this.emit('error', err);
            });
            return _socket;
        }
        catch (e) {
            this.emit('error', e);
        }
        return null;
    }

    /**
    * @name Telnet#destroySocket
    * @desc Destroy the current websocket object by assigning all functions to be empty
    *
    * @returns {object} returns null
    */
    private _destroySocket() {
        if (!this.socket || this.socket == null) return;
        try {
            this.socket.removeAllListeners();
            if (this.connected)
                this.socket.end();
            delete this.socket;
        }
        catch (e) {
            this.emit('error', e);
        }
        this.socket = null;
    }

    /**
    * @name Telnet#fireTelnetOption
    * @desc Fire the onTelnetOption e
    *
    * @returns {object} returns null
    */
    private _fireReceiveOption(option, verb, val) {
        const data: TelnetOption = { telnet: this, option: option, verb: 250, value: val, handled: false };
        this.emit('received-option', data);
        return data.handled;
    }

    private _fireReceiveMSDP(msdp_var, msdp_val) {
        const data = { telnet: this, variable: msdp_var, value: msdp_val, handled: false };
        this.emit('received-MSDP', data);
        return data.handled;
    }

    private _fireReceiveGMCP(val) {
        const data = { telnet: this, value: val, handled: false };
        this.emit('received-GMCP', data);
        return data.handled;
    }

    private _formatByte(b) {
        if (b < 32 || b >= 127)
            return '<' + b + '>';
        return String.fromCharCode(b);
    }
}