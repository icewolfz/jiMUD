//cSpell:words vscroll, hscroll, Commandon, cmdfont, isdoor, isclosed, triggernewline, triggerprompt
import EventEmitter = require('events');
import { Client } from "./client";
import { parseTemplate } from "./library";
const fs = require("fs");
const path = require("path");

export class IED extends EventEmitter {
    constructor() {
        super();
    }

    public processGMCP(mod: string, obj) {
        console.log(mod);
        console.log(obj);
        var mods = mod.split(".");
        if (mods.length < 2 || mods[0] != "IED") return;
    }
}