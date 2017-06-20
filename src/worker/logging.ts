import { ParserLine, Log, LogOptions } from "./types";
const fs = require("fs");
const path = require("path");

let options: LogOptions = {
    path: "",
    timeStamp: 0,
    logging: false,
    offline: false,
    gagged:  false,
    enabled: false,
    unique: true,
    prepend:  false,
    name: "",
    what: Log.Html
}
let connected: boolean = false;

self.addEventListener('message', (e:MessageEvent) => {
    if (!e.data) return;
    switch (e.data.action) {
        case 'options':
            break;
    }
}, false);

