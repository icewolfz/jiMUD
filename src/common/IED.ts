//cSpell:words vscroll, hscroll, Commandon, cmdfont, isdoor, isclosed, triggernewline, triggerprompt
import EventEmitter = require('events');
import { Client } from "./client";
import { parseTemplate } from "./library";
const fs = require("fs");
const path = require("path");

export enum CacheType {
  filename = 0,
  encoded = 1,
  create = 2
}

export enum Echo {
    none = 0,
    simple = 1,
    debug = 2
}

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