import EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');

export interface EditorOptions {
    file: string;
    container?: any;
    parent?: any;
    open?: boolean;
    new?: boolean;
    value?: any;
    remote?: string;
    options?: any;
    watch?: Function;
    watchStop?: Function;
    source?: Source;
}

export enum FileState {
    closed = 0,
    opened = 1,
    changed = 2,
    new = 4
}

export enum Source {
    local = 0,
    remote = 1
}

export abstract class EditorBase extends EventEmitter {

    private $parent: HTMLElement;
    private $file;
    private $remote;
    public state: FileState = FileState.closed;
    public source: Source = Source.local;

    get file(): string {
        return this.$file;
    }
    set file(value: string) {
        if (this.$file !== value) {
            if (this.$file && this.$file.length > 0 && !this.new)
                this.emit('watch-stop', [this.$file]);
            this.$file = value;
            if (!this.new)
                this.emit('watch', [this.$file]);
        }
    }

    get filename(): string {
        if (!this.$file || this.$file.length === 0)
            return '';
        return path.basename(this.$file);
    }

    get remote(): string {
        return this.$remote;
    }
    set remote(value: string) {
        if (this.$remote !== value) {
            this.$remote = value;
        }
    }

    constructor(options?: EditorOptions) {
        super();
        if (!options) {
            this.parent = document.body;
            return;
        }
        if (options.watch)
            this.on('watch', options.watch);
        if (options.watchStop)
            this.on('watch-stop', options.watchStop);
        if (options.parent)
            this.parent = options.parent;
        else if (options.container)
            this.parent = options.container.container ? options.container.container : options.container;
        else
            this.parent = document.body;
        this.file = options.file;
        if (options.open)
            this.open();
        if (options.new)
            this.state |= FileState.new;
        if (options.remote)
            this.remote = options.remote;
        if (options.source !== Source.local)
            this.source = options.source;
    }

    set parent(parent) {
        if (typeof parent === 'string') {
            if ((<string>parent).startsWith('#'))
                this.$parent = document.getElementById((<string>parent).substr(1));
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

    get parent(): HTMLElement { return this.$parent; }

    public abstract createControl();

    public read(file?: string): string {
        if (!file || file.length === 0)
            file = this.file;
        if (!file || file.length === 0)
            return '';
        return fs.readFileSync(file, 'utf8');
    }

    public write(data, file?: string) {
        if (!file || file.length === 0)
            file = this.file;
        if (!file || file.length === 0) {
            throw new Error('Invalid file');
        }
        fs.writeFileSync(file, data);
    }

    public abstract revert(): void;

    public abstract open(): void;

    public abstract save(): void;
    public abstract canSaveAs(): boolean;

    public abstract close(): void;
    public abstract watch(action: string, file: string, details?): void;

    abstract get selected(): string;
    public abstract focus(): void;
    public abstract resize(): void;
    public abstract supports(what): boolean;

    abstract set spellcheck(value: boolean);

    public abstract deleted(keep): void;

    set changed(value: boolean) {
        if (value)
            this.state |= FileState.changed;
        else
            this.state &= ~FileState.changed;
    }

    get changed(): boolean {
        return (this.state & FileState.changed) === FileState.changed;
    }

    set new(value: boolean) {
        if (value)
            this.state |= FileState.new;
        else
            this.state &= ~FileState.new;
    }
    get new(): boolean {
        return (this.state & FileState.new) === FileState.new;
    }

    abstract set options(value);
    abstract get options();
    abstract get type();
    public abstract insert(text);
    abstract get location();
    abstract get length();
}

export class DebugTimer {
    private $s = [];

    public start() {
        this.$s.push(new Date().getTime());
    }
    public end(lbl) {
        if (this.$s.length === 0) return;
        const e = new Date().getTime();
        const t = e - this.$s.pop();
        if (!lbl)
            lbl = 'Execution time';
        // tslint:disable-next-line:no-console
        console.log(lbl + ': ' + t);
    }
}
