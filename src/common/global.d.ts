/*
interface Object {
	toType(obj: any): string;
}
*/
//spellchecker:disable
interface CanvasRenderingContext2D {
	fillRoundedRect(x: number, y: number, w: number, h: number, r: number): void;
	strokeRoundedRect(x: number, y: number, w: number, h: number, r: number): void;
}

interface String {

	splice(idx: number, s: string, rem?: number): string;
	paddingLeft(paddingvalue: (string | number)): string;
	paddingRight(paddingvalue: (string | number)): string;
	splitQuote(sep: string, type?, escape?): string[];
}

interface Event {
	gamepad: any;
}

declare let $selected: string;
declare let $character: string;
declare let $selectedurl: string;
declare let $selectedline: string;
declare let $selectedword: string;
declare let $selurl: string;
declare let $selline: string;
declare let $selword: string;
declare let $copied: string;

interface JQuery {
	treeview: any;
	selectpicker: any
}

interface Window {
	i: any;
	repeatnum: any;
	$copied: string;
	$character: string;
	ResizeObserver: ResizeObserver;
}

interface CanvasRenderingContext2D {
	webkitImageSmoothingEnabled: boolean;
	mozImageSmoothingEnabled: boolean;
}

interface HTMLDialogElement extends HTMLElement {
    open: boolean;
    returnValue: string;
    close(returnValue?: string): void;
    show(): void;
    showModal(): void;
    addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLDialogElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLDialogElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

/**
 * Remove once typscript nativly supports ResizeObserver 
 */
/*
 interface ResizeObserver {
	observe: (target: Element) => void;
	unobserve: (target: Element) => void;
	disconnect: () => void;
}

declare var ResizeObserver: {
	prototype: ResizeObserver;
	new(callback: ResizeObserverCallback): ResizeObserver;
};

interface ResizeObserverCallback {
	(entries: ResizeObserverEntry[], observer: ResizeObserver): void;
}

interface ResizeObserverEntry {
	readonly target: Element;
	readonly contentRect: DOMRectReadOnly;
}

declare var ResizeObserverEntry: {
	prototype: ResizeObserverEntry;
	new(): ResizeObserverEntry;
};
*/
/** End ResizeObserver */