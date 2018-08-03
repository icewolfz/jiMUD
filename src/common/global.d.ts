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
declare let $selectedurl: string;
declare let $selectedline: string;
declare let $selectedword: string;
declare let $selurl: string;
declare let $selline: string;
declare let $selword: string;
declare let $copied: string;

interface JQuery {
	hasHorizontalScrollBar(): boolean;
	innerText(msg): string;
	textContents(msg): string;
	treeview: any;
	selectpicker: any
}

interface Window {
	i: any;
	repeatnum: any;
	$copied: string;
}