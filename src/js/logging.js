"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EventEmitter = require("events");
const library_1 = require("./library");
const fs = require("fs");
const path = require("path");
class Logger extends EventEmitter {
    constructor(client) {
        super();
        this.client = null;
        this._path = "";
        this.timeStamp = 0;
        this.currentfile = "";
        this.logging = false;
        this._name = "";
        if (!client)
            throw "Invalid client!";
        this.client = client;
        this._path = library_1.parseTemplate(this.client.options.logPath);
        if (!fs.existsSync(this._path))
            fs.mkdirSync(this._path);
        this.client.on('optionsLoaded', () => {
            var p = library_1.parseTemplate(this.client.options.logPath);
            if (p != this._path) {
                this._path = p;
                if (!fs.existsSync(this._path))
                    fs.mkdirSync(this._path);
                if (this.logging)
                    this.fileChanged();
            }
        });
        this.client.on('closed', () => {
            if (!this.client.options.logOffline)
                this.stop();
        });
        this.client.on('connected', () => {
            this.start();
        });
        this.client.on('parseDone', (lines) => {
            this.writeLines(lines);
        });
        if (this.client.options.logOffline)
            this.start();
    }
    get name() { return this._name; }
    set name(name) {
        this._name = name;
        if (this.logging)
            this.fileChanged();
    }
    fileChanged() {
        var f = path.join(this._path, this.timeStamp.toString()) + ".htm";
        this.buildFilename();
        if (fs.existsSync(f) && f != this.currentfile)
            fs.renameSync(f, this.currentfile);
        if (this.client.enableDebug)
            this.client.emit('debug', 'File changed: "' + f + '" to "' + this.currentfile + '"');
    }
    buildFilename() {
        this.currentfile = this.timeStamp.toString();
        if (this._name && this._name.length > 0)
            this.currentfile += "." + this._name;
        this.currentfile = path.join(this._path, this.currentfile) + ".htm";
        if (this.client.enableDebug)
            this.client.emit('debug', 'Log file: "' + this.currentfile + '"');
    }
    writeHeader() {
        this.buildFilename();
        if (fs.existsSync(this.currentfile))
            return;
        fs.appendFile(this.currentfile, "<head>\n<style>\nbody\n{\n	font-family: Inconsolata, \'Courier New\', Courier, monospace;\n	text-align: left;\n	font-size: 1em;\n	white-space: pre;\n	background-color: black;	\n}\n/* --- Start CSS for ansi display --- */\n@-webkit-keyframes blinker { \n 	0% { opacity: 1.0; }\n  50% { opacity: 0.0; }\n  100% { opacity: 1.0; }\n} \n\n@keyframes blinker { \n 	0% { opacity: 1.0; }\n  50% { opacity: 0.0; }\n  100% { opacity: 1.0; }\n} \n\n.ansi-blink { \n	text-decoration:blink;\n	animation-name: blinker;\n	animation-iteration-count: infinite; \n	animation-timing-function: cubic-bezier(1.0,0,0,1.0); \n	animation-duration: 1s; \n	-webkit-animation-name: blinker;\n	-webkit-animation-iteration-count: infinite; \n	-webkit-animation-timing-function: cubic-bezier(1.0,0,0,1.0); \n	-webkit-animation-duration: 1s; \n}\n\n.ansi\n{\n	padding: 0px;\n	margin:0px;\n	\n}\n\n.line \n{\n	word-wrap:break-word;\n	word-break:break-all;\n	width: 100%;\n	display: block;\n	padding-bottom:1px;\n	clear:both;\n	line-height: normal;\n}	\n\n.line hr{ border: 0px; }\n/* --- End CSS for ansi display --- */\n\n.line a, .line a:link \n{\n	color: inherit;\n	font-weight: inherit;\n	text-decoration: underline;\n}\n\n.URLLink, .URLLink:link\n{\n	text-decoration: underline;\n	cursor: pointer;\n}\n</style>\n", (err) => {
            if (err)
                throw err;
        });
    }
    write(data) {
        if (!this.logging || (!this.client.options.logOffline && !this.client.connected))
            return;
        this.writeHeader();
        fs.appendFile(this.currentfile, data, (err) => {
            if (err)
                throw err;
        });
    }
    writeLines(lines) {
        this.write(lines.join(''));
    }
    start() {
        if (!this.client.options.logEnabled)
            return;
        this.logging = true;
        if (this.client.options.logUniqueOnConnect || this.timeStamp === 0)
            this.timeStamp = new Date().getTime();
        this.buildFilename();
        if (this.client.options.logPrepend)
            this.write(this.client.display.html());
        this.emit('started');
    }
    stop() {
        this.logging = false;
        this.emit('stopped');
    }
    toggle() {
        this.client.options.logEnabled = !this.client.options.logEnabled;
        this.client.saveOptions();
        var c = this.client.options.logUniqueOnConnect;
        this.client.options.logUniqueOnConnect = false;
        if (this.client.options.logEnabled && !this.logging)
            this.start();
        else if (!this.client.options.logEnabled && this.logging)
            this.stop();
        this.client.options.logUniqueOnConnect = c;
    }
}
exports.Logger = Logger;
