import EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');

export enum UpdateType {
    none = 0, resize = 1
}

export interface EditorOptions {
    file: string;
    container?: any;
}

export class EditorBase extends EventEmitter {
    private $el: HTMLElement;
    private $parent: HTMLElement;
    private $file;

    get file(): string {
        return this.$file;
    }
    set file(value: string) {
        if (this.$file != value) {
            this.$file = value;
        }
    }

    get filename(): string {
        if (!this.$file || this.$file.length === 0)
            return '';
        return path.basename(this.$file);
    }

    constructor(options?: EditorOptions) {
        super();

        if (options && options.container)
            this.setParent(options.container.container ? options.container.container : options.container);
        else
            this.setParent(document.body);
        this.file = options.file;
    }

    public setParent(parent?: string | JQuery | HTMLElement) {
        if (typeof parent === 'string') {
            if (parent.startsWith('#'))
                this.$parent = document.getElementById(parent.substr(1));
            else
                this.$parent = document.getElementById(parent);
        }
        else if (parent instanceof $)
            this.$parent = parent[0];
        else if (parent instanceof HTMLElement)
            this.$parent = parent;
        if (!this.$parent)
            this.$parent = document.body;
        this.createControl();
    }

    public createControl() {
        if (this.$el) {
            this.$parent.removeChild(this.$el);
        }
    }
}

export class CodeEditor extends EditorBase {
}

export class VirtualEditor extends EditorBase {
}