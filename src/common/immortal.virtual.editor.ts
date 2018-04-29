import EventEmitter = require('events');

export enum UpdateType {
    none = 0, resize = 1
}

export class ImmortalVirtualEditor extends EventEmitter {
    private $el: HTMLElement;
    private $parent: HTMLElement;

    constructor(container?: any) {
        super();

        if (container)
            this.setParent(container.container ? container.container : container);
        else
            this.setParent(document.body);
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