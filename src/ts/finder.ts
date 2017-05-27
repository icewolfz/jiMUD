//cSpell:words keycode
import EventEmitter = require('events');

export class Finder extends EventEmitter {
    private _display;
    private _document;
    private _frame;
    private _window;
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
        this._document = display[0].ownerDocument;
        this._frame = this._document.defaultView || this._document.parentWindow;
        this._window = this._frame.parent;
        this.createControl();

        $(this._window.document).keyup((e) => {
            if (e.keyCode == 27) { // escape key maps to keycode `27`
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
        this._window.document.body.append(this._control[0]);
    }

    private getDisplaySelectionText() {
        var text = "";
        if (this._frame.getSelection) {
            text = this._frame.getSelection().toString();
        } else if (this._document.selection && this._document.selection.type != "Control") {
            text = this._document.selection.createRange().text;
        }
        return text;
    }

    show() {
        this._control.slideDown();
        var sel = this.getDisplaySelectionText();
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
        var hs = this._display.text();
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
        var lines = this._display[0].children;
        var m, id = 0, items;
        for (var l = lines.length - 1; l >= 0; l--) {
            items = [];
            while ((m = re.exec(lines[l].textContent)) !== null && id < 1000) {
                id++;
                // This is necessary to avoid infinite loops with zero-width matches
                if (m.index === re.lastIndex) {
                    re.lastIndex++;
                }
                items.push({
                    lineNo: l,
                    line: lines[l],
                    index: m.index,
                    length: m[0].length
                });
                if (this._all) {
                    this.addAnnotationElement(this.getTextSelection(lines[l], m.index, m.index + m[0].length), lines[l], "find-" + id);
                    var t = $('.find-' + id + '-child', lines[l]);
                    if (t.length > 1) {
                        t.each(function (idx) {
                            if (idx == 0)
                                $(this).addClass('start');
                            else if (idx == t.length - 1)
                                $(this).addClass('end');
                            else
                                $(this).addClass('middle');
                        })
                    };
                    items[items.length - 1].els = t;
                }
            }
            items.reverse();
            this._results = this._results.concat(items);
        }
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
        $(".current", this._display).removeClass("current");
        if (this._results.length > 0) {
            if (this._all) {
                this._results[this._position].els.addClass('current');
                if (focus && this._results[this._position].els.length > 0)
                    this._results[this._position].els[0].scrollIntoView(false);
            }
            else {
                $(".find-highlight", this._display).removeClass("find-highlight");
                var r = this._results[idx];
                this.addAnnotationElement(this.getTextSelection(r.line, r.index, r.index + r.length), r.line, " find");
                var t = $('.find-highlight', r.line);
                if (t.length > 1) {
                    t.each(function (idx) {
                        if (idx == 0)
                            $(this).addClass('start');
                        else if (idx == t.length - 1)
                            $(this).addClass('end');
                        else
                            $(this).addClass('middle');
                    })
                };
                t[0].scrollIntoView(false);
            }
        }
        setTimeout(() => { this.emit('moved', this._position, idx); }, 0);
        this.updateButtons();
    }

    clear() {
        this._results = [];
        this._position = 0;
        $(".find-highlight", this._display).each(function () {
            $(this).replaceWith(this.textContent);
        });
        this.updateButtons();
        this.emit('reset');
    }

    private updateButtons() {
        if (this._position >= this._results.length - 1)
            $("#find-next", this._control).prop('disabled', true);
        else
            $("#find-next", this._control).prop('disabled', false);
        if (this._position == 0 || this._results.length == 0)
            $("#find-prev", this._control).prop('disabled', true);
        else
            $("#find-prev", this._control).prop('disabled', false);
    }

    private updateCount() {
        if (this._results.length == 0)
            $("#find-count", this._control).html("<span class='find-no-results'>No Results</span>")
        else if (this._results.length >= 999)
            $("#find-count", this._control).html("? of 999");
        else
            $("#find-count", this._control).html((this._position + 1) + " of " + this._results.length);
    }

    private getTextNodesIn(node) {
        var textNodes = [];
        if (node.nodeType == 3) {
            textNodes.push(node);
        } else {
            var children = node.childNodes;
            for (var i = 0, len = children.length; i < len; ++i) {
                textNodes.push.apply(textNodes, this.getTextNodesIn(children[i]));
            }
        }
        return textNodes;
    }

    private getTextSelection(el, start, end) {
        var range = document.createRange();
        range.selectNodeContents(el);
        var textNodes = this.getTextNodesIn(el);
        var foundStart = false;
        var charCount = 0, endCharCount;

        for (var i = 0, textNode; textNode = textNodes[i++];) {
            endCharCount = charCount + textNode.length;
            if (!foundStart && start >= charCount
                && (start < endCharCount ||
                    (start == endCharCount && i <= textNodes.length))) {
                range.setStart(textNode, start - charCount);
                foundStart = true;
            }
            if (foundStart && end <= endCharCount) {
                range.setEnd(textNode, end - charCount);
                break;
            }
            charCount = endCharCount;
        }

        return range;
    }

    private setTextSelection(range) {
        var sel = this._frame.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    private addAnnotationElement(str, elem, id, c?: boolean) {
        var text, textParent, origText, prevText, nextText, childCount,
            annotationTextRange,
            span = document.createElement('span');

        if (elem.nodeType === 3) {
            if (c)
                span.setAttribute('class', 'find-highlight ' + id + '-child');
            else
                span.setAttribute('class', 'find-highlight ' + id);
            origText = elem.textContent;
            annotationTextRange = this.validateTextRange(str, elem);
            if (annotationTextRange == 'textBeforeRangeButIntersect') {
                text = origText.substring(0, str.endOffset);
                nextText = origText.substring(str.endOffset);
            } else if (annotationTextRange == 'textAfterRangeButIntersect') {
                prevText = origText.substring(0, str.startOffset);
                text = origText.substring(str.startOffset);
            } else if (annotationTextRange == 'textExactlyInRange') {
                text = origText
            } else if (annotationTextRange == 'textWithinRange') {
                prevText = origText.substring(0, str.startOffset);
                text = origText.substring(str.startOffset, str.endOffset);
                nextText = origText.substring(str.endOffset);
            } else if (annotationTextRange == 'textNotInRange') {
                return;
            }
            span.textContent = text;
            textParent = elem.parentElement;
            textParent.replaceChild(span, elem);
            if (prevText) {
                var prevDOM = document.createTextNode(prevText);
                textParent.insertBefore(prevDOM, span);
            }
            if (nextText) {
                var nextDOM = document.createTextNode(nextText);
                textParent.insertBefore(nextDOM, span.nextSibling);
            }
            return;
        }
        childCount = elem.childNodes.length;
        for (var i = 0; i < childCount; i++) {
            var elemChildNode = elem.childNodes[i];
            if (!elemChildNode.tagName ||
                !(elemChildNode.tagName.toLowerCase() === 'span' &&
                    elemChildNode.classList.contains('find-highlight'))) {
                this.addAnnotationElement(str, elem.childNodes[i], id, true);
            }
            childCount = elem.childNodes.length;
        }
    }

    private validateTextRange(str, elem) {
        var textRange = document.createRange();

        textRange.selectNodeContents(elem);
        if (str.compareBoundaryPoints(Range.START_TO_END, textRange) <= 0) {
            return 'textNotInRange';
        }
        else {
            if (str.compareBoundaryPoints(Range.END_TO_START, textRange) >= 0) {
                return 'textNotInRange';
            }
            else {
                var startPoints = str.compareBoundaryPoints(Range.START_TO_START, textRange),
                    endPoints = str.compareBoundaryPoints(Range.END_TO_END, textRange);

                if (startPoints < 0) {
                    if (endPoints < 0) {
                        return 'textBeforeRangeButIntersect';
                    }
                    else {
                        return "textExactlyInRange";
                    }
                }
                else {
                    if (endPoints > 0) {
                        return 'textAfterRangeButIntersect';
                    }
                    else {
                        if (startPoints === 0 && endPoints === 0) {
                            return "textExactlyInRange";
                        }
                        else {
                            return 'textWithinRange';
                        }
                    }
                }
            }
        }
    }

}