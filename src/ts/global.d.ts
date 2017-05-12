/*
interface Object {
	toType(obj: any): string;
}
*/

interface CanvasRenderingContext2D {
	fillRoundedRect(x: number, y: number, w: number, h: number, r: number): void;
	strokeRoundedRect(x: number, y: number, w: number, h: number, r: number): void;
}

interface String {
	splice(idx: number, s: string, rem?: number): string;
	paddingLeft(paddingvalue:(string|number)): string;
	paddingRight(paddingvalue:(string|number)): string;
}

declare var $selected:string;
declare var $selectedurl:string;
declare var $selectedline:string;
declare var $selectedword:string;
declare var $selurl:string;
declare var $selline:string;
declare var $selword:string;