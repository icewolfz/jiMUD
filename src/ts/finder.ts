//cSpell:words keycode
import EventEmitter = require('events');
import { Display, OverlayRange } from './display.js';

export enum validTextRange {
    not = 0,
    before = 1,
    exact = 2,
    after = 3,
    within = 4
}

export class Finder extends EventEmitter {
    private _display: Display;
    private _document;
    private _control;

    private _timer;
    private _results;
    private _position;
    private _case;
    private _word;
    private _reverse;
    private _regex;
    private _all = false;

    constructor(display) {
        super();
        this._display = display;
        this._document = display._el.ownerDocument;
        this.createControl();

        $(window.document).keyup((e) => {
            if (e.keyCode === 27) { // escape key maps to keycode `27`
                this.hide();
            }
        });

        this._control.on("keydown", (e) => {
            if (e.keyCode != 8) return;
            clearTimeout(this._timer);
            //delay find update to try and batch group text updates ot improve speeds, make regex a little slower as regex can be more complex
            this._timer = setTimeout(() => { this.find() }, this._regex ? 500 : 250);
        });

        this._control.on("keypress", () => {
            clearTimeout(this._timer);
            //delay find update to try and batch group text updates ot improve speeds, make regex a little slower as regex can be more complex
            this._timer = setTimeout(() => { this.find() }, this._regex ? 500 : 250);
        });

        //create box
    }

    get MatchCase(): boolean {
        return this._case;
    }

    set MatchCase(value: boolean) {
        if (value != this._case) {
            this._case = value;
            if (this._case)
                $("#find-case", this._control).addClass("active");
            else
                $("#find-case", this._control).removeClass("active");
            this.find(true);
            this.emit('case');
        }
    }

    get RegularExpression(): boolean {
        return this._regex;
    }

    set RegularExpression(value: boolean) {
        if (value != this._regex) {
            this._regex = value;
            if (this._case)
                $("#find-regex", this._control).addClass("active");
            else
                $("#find-regex", this._control).removeClass("active");
            this.find(true);
            this.emit('regex');
        }
    }

    get MatchWord(): boolean {
        return this._word;
    }

    set MatchWord(value: boolean) {
        if (value != this._word) {
            this._word = value;
            if (this._word)
                $("#find-word", this._control).addClass("active");
            else
                $("#find-word", this._control).removeClass("active");
            this.find(true);
            this.emit('word');
        }
    }

    get Reverse(): boolean {
        return this._reverse;
    }

    set Reverse(value: boolean) {
        if (value != this._reverse) {
            this._reverse = value;
            if (this._reverse) {
                $("#find-reverse", this._control).addClass("active");
                $("#find-prev", this._control).html('<i class="fa fa-arrow-up"></i>');
                $("#find-next", this._control).html('<i class="fa fa-arrow-down"></i>');
            }
            else {
                $("#find-reverse", this._control).removeClass("active");
                $("#find-prev", this._control).html('<i class="fa fa-arrow-down"></i>');
                $("#find-next", this._control).html('<i class="fa fa-arrow-up"></i>');
            }
            //this._position = this._results.length - this._position - 1;
            //this.updateButtons();
            //this.updateCount();
            this.find(true);
            this.emit('reverse');
        }
    }

    get Highlight(): boolean { return this._all; }
    set Highlight(value: boolean) {
        if (value != this._all) {
            this._all = value;
            if (this._all) {
                $("#find-all", this._control).addClass("active");
            }
            else {
                $("#find-all", this._control).removeClass("active");
            }
            this.find(true);
            this.emit('highlight');
        }
    }
    private createControl() {
        this._control = $('<div id="find"><input placeholder="Find" /><button id="find-case" title="Match Case">Aa</button><button id="find-word" title="Match Whole Word">Aa|</button><button id="find-regex" title="Use Regular Expression">.*</button><button id="find-all" title="Highlight all matches"><i class="fa fa-paint-brush"></i></button><div id="find-count"></div><button id="find-prev" title="Previous Match" disabled="disabled"><i class="fa fa-arrow-down"></i></button><button id="find-next" title="Next Match" disabled="disabled"><i class="fa fa-arrow-up"></i></button><button id="find-selection" title="Find in selection" disabled="disabled"><i class="fa fa-align-left"></i></button><button id="find-reverse" title="Search Down"><i class="fa fa-caret-down"></i></button><button id="find-close" title="Close"><i class="fa fa-close"></i></button></div>');
        $("#find-close", this._control).on('click', () => {
            this.hide();
        });
        $("#find-prev", this._control).on('click', () => {
            this.gotoPrevious();
        });
        $("#find-next", this._control).on('click', () => {
            this.gotoNext();
        });
        $("#find-case", this._control).on('click', () => {
            this.MatchCase = !this.MatchCase;
        });
        $("#find-word", this._control).on('click', () => {
            this.MatchWord = !this.MatchWord;
        });
        $("#find-reverse", this._control).on('click', () => {
            this.Reverse = !this.Reverse;
        });
        $("#find-all", this._control).on('click', () => {
            this.Highlight = !this.Highlight;
        });
        $("#find-regex", this._control).on('click', () => {
            this.RegularExpression = !this.RegularExpression;
        });
        window.document.body.appendChild(this._control[0]);
    }

    show() {
        this._control.slideDown();
        var sel = this._display.selection;
        if (sel.length)
            $("input", this._control).val(sel);
        $("input", this._control).focus().select();
        this.find();
        this.emit('shown');
    }

    hide() {
        this._control.slideUp(() => {
            $("input", this._control).val('');
            this.clear();
            this.emit('closed');
        });
    }

    find(focus?: boolean) {
        var val = $("input", this._control).val();
        this.clear();
        if (val.length === 0) {
            $("#find-count", this._control).html("No Results")
            this.emit('found-results', this._results);
            return;
        }
        //var hs = this._display.text();
        var pattern;
        if (this._regex)
            pattern = val;
        else
            pattern = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        var re;
        if (this._word)
            pattern = "\\b" + pattern + "\\b";
        if (this._case)
            re = new RegExp(pattern, 'g');
        else
            re = new RegExp(pattern, 'gi');
        var lines = this._display.lines;
        var m, id = 0, items;
        var ranges: OverlayRange[] = [];
        for (var l = lines.length - 1; l >= 0; l--) {
            items = [];
            while ((m = re.exec(lines[l])) !== null) {
                id++;
                // This is necessary to avoid infinite loops with zero-width matches
                if (m.index === re.lastIndex) {
                    re.lastIndex++;
                }
                items.push({
                    line: l,
                    index: m.index,
                    length: m[0].length,
                    range: ranges.length
                });
                if (this._all) {
                    ranges.push(
                        {
                            start: { x: m.index, y: l },
                            end: { x: m.index + m[0].length, y: l }
                        }
                    )
                }
            }
            items.reverse();
            this._results.push.apply(this._results, items);
        }
        if (ranges.length)
            this._display.addOverlays(ranges, 'find-highlight', 'find');
        if (this.Reverse)
            this._results.reverse();
        this.gotoResult(0, !focus);
        this.emit('found-results', this._results);
    }

    gotoNext() {
        this._position++;
        this.gotoResult(this._position, true);
    }

    gotoPrevious() {
        this._position--;
        this.gotoResult(this._position, true);
    }

    gotoCurrent() {
        this.gotoResult(this._position, true);
    }

    gotoResult(idx: number, focus?: boolean) {
        if (idx < 0) idx = 0;
        if (idx >= this._results.length)
            idx = this._results.length - 1;
        this._position = idx;
        this.updateCount();
        this._display.clearOverlay('find-current');
        if (this._results.length > 0) {
            var r = this._results[idx];
            this._display.addOverlays([{
                start: { x: r.index, y: r.line },
                end: { x: r.index + r.length, y: r.line }
            }], 'find-highlight current', 'find-current');
            if (focus)
                this._display.scrollToCharacter(r.index, r.line);
        }
        setTimeout(() => { this.emit('moved', this._position, idx); }, 0);
        this.updateButtons();
    }

    clear() {
        this._results = [];
        this._position = 0;
        this._display.clearOverlay('find');
        this._display.clearOverlay('find-current');
        this.updateButtons();
        this.emit('reset');
    }

    private updateButtons() {
        if (this._position >= this._results.length - 1)
            $("#find-next", this._control).prop('disabled', true);
        else
            $("#find-next", this._control).prop('disabled', false);
        if (this._position === 0 || this._results.length === 0)
            $("#find-prev", this._control).prop('disabled', true);
        else
            $("#find-prev", this._control).prop('disabled', false);
    }

    private updateCount() {
        if (this._results.length === 0)
            $("#find-count", this._control).html("<span class='find-no-results'>No Results</span>")
        else if (this._results.length > 999)
            $("#find-count", this._control).html((this._position + 1) + " of 999+");
        else
            $("#find-count", this._control).html((this._position + 1) + " of " + this._results.length);
    }
}