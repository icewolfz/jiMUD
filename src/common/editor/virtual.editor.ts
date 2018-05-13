import { EditorBase, EditorOptions, FileState } from './editor.base';
import { existsSync, formatSize, capitalize, inverse } from './../library';
const { clipboard, ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');

export class VirtualEditor extends EditorBase {
    public createControl() { }

    public refresh() { }

    public open() { }

    public save() { }

    public revert() { }

    public get selected() { return ''; }
    public selectAll() { };
    public cut() { }
    public copy() { }
    public paste() { }
    public delete() { }
    public undo() { }
    public redo() { }
    public close() { }
    public watch(action: string, file: string, details?) { }
    public set spellcheck(value: boolean) { };
    public find() { }
    public replace() { }
    public supports(what) { return false; }
    public focus(): void { }
    public resize() { }
    public set options(value) { }
    public get options() { return null; }
    public get type() {
        return 2;
    }
    public insert(text) { }
    public get location() { return [0, 0]; }
    public get length() { return 0; }
}
