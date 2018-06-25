//cSpell:words keycode
import EventEmitter = require('events');

export class Search extends EventEmitter {
    private $parent;
    private _control;

    private _timer;
    private _results;
    private _position;
    private _case;
    private _word;
    private _reverse;
    private _regex;
    private _all = false;
    private _key;

    public search;

    constructor(parent?) {
        super();
        this.parent = parent;
        this.createControl();
        this._key = (e) => {
            if (e.keyCode === 27) { // escape key maps to keycode `27`
                this.hide();
            }
        };
        window.document.addEventListener('keyup', this._key.bind(this));

        this._control.on('keydown', (e) => {
            if (e.keyCode !== 8) return;
            clearTimeout(this._timer);
            //delay find update to try and batch group text updates ot improve speeds, make regex a little slower as regex can be more complex
            this._timer = setTimeout(() => { this.find(); }, this._regex ? 500 : 250);
        });

        this._control.on('keypress', () => {
            clearTimeout(this._timer);
            //delay find update to try and batch group text updates ot improve speeds, make regex a little slower as regex can be more complex
            this._timer = setTimeout(() => { this.find(); }, this._regex ? 500 : 250);
        });
    }

    get id() {
        if (!this.parent) return '';
        return this.parent.id;
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
    }

    get parent(): HTMLElement { return this.$parent; }

    get MatchCase(): boolean {
        return this._case;
    }

    set MatchCase(value: boolean) {
        if (value !== this._case) {
            this._case = value;
            if (this._case)
                $('#' + this.id + '-find-case', this._control).addClass('active');
            else
                $('#' + this.id + '-find-case', this._control).removeClass('active');
            this.find(true);
            this.emit('case');
        }
    }

    get RegularExpression(): boolean {
        return this._regex;
    }

    set RegularExpression(value: boolean) {
        if (value !== this._regex) {
            this._regex = value;
            if (this._case)
                $('#' + this.id + '-find-regex', this._control).addClass('active');
            else
                $('#' + this.id + '-find-regex', this._control).removeClass('active');
            this.find(true);
            this.emit('regex');
        }
    }

    get MatchWord(): boolean {
        return this._word;
    }

    set MatchWord(value: boolean) {
        if (value !== this._word) {
            this._word = value;
            if (this._word)
                $('#' + this.id + '-find-word', this._control).addClass('active');
            else
                $('#' + this.id + '-find-word', this._control).removeClass('active');
            this.find(true);
            this.emit('word');
        }
    }

    get Reverse(): boolean {
        return this._reverse;
    }

    set Reverse(value: boolean) {
        if (value !== this._reverse) {
            this._reverse = value;
            if (this._reverse) {
                $('#' + this.id + '-find-reverse', this._control).addClass('active');
                $('#' + this.id + '-find-next', this._control).html('<i class="fa fa-arrow-up"></i>');
                $('#' + this.id + '-find-prev', this._control).html('<i class="fa fa-arrow-down"></i>');
            }
            else {
                $('#' + this.id + '-find-reverse', this._control).removeClass('active');
                $('#' + this.id + '-find-next', this._control).html('<i class="fa fa-arrow-down"></i>');
                $('#' + this.id + '-find-prev', this._control).html('<i class="fa fa-arrow-up"></i>');
            }
            this._position = this._results.length - this._position - 1;
            this.updateButtons();
            this.updateCount();
            this.find(true);
            this.emit('reverse');
        }
    }

    private createControl() {
        this._control = $('<div id="' + this.id + '-find" class="find"><input placeholder="Find" /><button id="' + this.id + '-find-case" title="Match Case" class="find-case">Aa</button><button id="' + this.id + '-find-word" title="Match Whole Word" class="find-word">Aa|</button><button id="' + this.id + '-find-regex" title="Use Regular Expression" class="find-regex">.*</button><div id="' + this.id + '-find-count" class="find-count"></div><button id="' + this.id + '-find-prev" title="Previous Match" disabled="disabled" class="find-prev"><i class="fa fa-arrow-up"></i></button><button id="' + this.id + '-find-next" title="Next Match" disabled="disabled" class="find-next"><i class="fa fa-arrow-down"></i></button><button id="' + this.id + '-find-selection" title="Find in selection" disabled="disabled" class="find-selection"><i class="fa fa-align-left"></i></button><button id="' + this.id + '-find-reverse" title="Search Down" class="find-reverse"><i class="fa fa-caret-down"></i></button><button id="' + this.id + '-find-close" title="Close" class="find-close"><i class="fa fa-close"></i></button></div>');
        $('#' + this.id + '-find-close', this._control).on('click', () => {
            this.hide();
        });
        $('#' + this.id + '-find-prev', this._control).on('click', () => {
            this.gotoPrevious();
        });
        $('#' + this.id + '-find-next', this._control).on('click', () => {
            this.gotoNext();
        });
        $('#' + this.id + '-find-case', this._control).on('click', () => {
            this.MatchCase = !this.MatchCase;
        });
        $('#' + this.id + '-find-word', this._control).on('click', () => {
            this.MatchWord = !this.MatchWord;
        });
        $('#' + this.id + '-find-reverse', this._control).on('click', () => {
            this.Reverse = !this.Reverse;
        });
        $('#' + this.id + '-find-regex', this._control).on('click', () => {
            this.RegularExpression = !this.RegularExpression;
        });
        window.document.body.appendChild(this._control[0]);
    }

    public show(selection?) {
        this._control.slideDown();
        if (selection && selection.length)
            $('input', this._control).val(selection);
        $('input', this._control).focus().select();
        this.find();
        this.emit('shown');
    }

    public hide() {
        this._control.slideUp(() => {
            $('input', this._control).val('');
            this.clear();
            this.emit('closed');
        });
    }

    public find(search?, focus?: boolean) {
        const val = $('input', this._control).val();
        this.clear();
        if (val.length === 0) {
            $('#' + this.id + '-find-count', this._control).html('No Results');
            this.emit('found-results', this._results);
            return;
        }
        this.search = search || this.search;
        if (!this.search) return;
        //let hs = this._display.text();
        let pattern;
        if (this._regex)
            pattern = val;
        else
            pattern = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        let re;
        if (this._word)
            pattern = '\\b' + pattern + '\\b';
        if (this._case)
            re = new RegExp(pattern, 'g');
        else
            re = new RegExp(pattern, 'gi');
        const content = this.search.textContent;
        let m;
        let items;

        items = [];
        m = re.exec(content);
        while (m !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === re.lastIndex) {
                re.lastIndex++;
            }
            items.push({
                index: m.index,
                length: m[0].length
            });
            m = re.exec(content);
        }
        //items.reverse();
        this._results.push.apply(this._results, items);

        if (this.Reverse)
            this._results.reverse();
        this.gotoResult(0, !focus);
        this.emit('found-results', this._results);
    }

    public gotoNext() {
        this._position++;
        this.gotoResult(this._position, true);
    }

    public gotoPrevious() {
        this._position--;
        this.gotoResult(this._position, true);
    }

    public gotoCurrent() {
        this.gotoResult(this._position, true);
    }

    private getTextNodesIn(node) {
        const textNodes = [];
        if (node.nodeType === 3) {
            textNodes.push(node);
        } else {
            const children = node.childNodes;
            const len = children.length;
            for (let i = 0; i < len; ++i) {
                textNodes.push.apply(textNodes, this.getTextNodesIn(children[i]));
            }
        }
        return textNodes;
    }

    private setSelectionRange(el, start, end) {
        const od = el.ownerDocument;
        const ow = el.ownerDocument.defaultView;
        const range = od.createRange();
        range.selectNodeContents(el);
        const textNodes = this.getTextNodesIn(el);
        let foundStart = false;
        let charCount = 0;
        let endCharCount;
        let textNode;
        const il = textNodes.length;
        for (let i = 0; i < il; i++) {
            textNode = textNodes[i];
            endCharCount = charCount + textNode.length;
            if (!foundStart && start >= charCount
                && (start < endCharCount ||
                    (start === endCharCount && i <= textNodes.length))) {
                range.setStart(textNode, start - charCount);
                foundStart = true;
            }
            if (foundStart && end <= endCharCount) {
                range.setEnd(textNode, end - charCount);
                break;
            }
            charCount = endCharCount;
        }

        const sel = ow.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

    }

    private scrollIntoView(t) {
        if (typeof (t) !== 'object') return;

        if (t.getRangeAt) {
            // we have a Selection object
            if (t.rangeCount === 0) return;
            t = t.getRangeAt(0);
        }

        if (t.cloneRange) {
            // we have a Range object
            const r = t.cloneRange();	// do not modify the source range
            r.collapse(true);		// collapse to start
            t = r.startContainer;
            // if start is an element, then startOffset is the child number
            // in which the range starts
            if (t.nodeType === 1) t = t.childNodes[r.startOffset];
        }

        // if t is not an element node, then we need to skip back until we find the
        // previous element with which we can call scrollIntoView()
        let o = t;
        while (o && o.nodeType !== 1) o = o.previousSibling;
        t = o || t.parentNode;
        if (t) {
            t.scrollIntoView();
        }
    }

    public gotoResult(idx: number, focus?: boolean) {
        if (!this.search) return;
        if (idx < 0) idx = 0;
        if (idx >= this._results.length)
            idx = this._results.length - 1;
        this._position = idx;
        this.updateCount();
        if (this._results.length > 0) {
            const r = this._results[idx];
            this.setSelectionRange(this.search, r.index, r.index + r.length);
            if (focus) {
                //let n = this.search.textContent.lastIndexOf('\n', r.index);
                //if (n < 0) n = 0;
                const ow = this.search.ownerDocument.defaultView;
                this.scrollIntoView(ow.getSelection());
                //n = r.index - n;
                //this.search.scrollLeft = n * 16;
            }
        }
        setTimeout(() => { this.emit('moved', this._position, idx); }, 0);
        this.updateButtons();
    }

    public clear() {
        this._results = [];
        this._position = 0;
        this.updateButtons();
        this.emit('reset');
    }

    private updateButtons() {
        if (this._position >= this._results.length - 1)
            $('#' + this.id + '-find-next', this._control).prop('disabled', true);
        else
            $('#' + this.id + '-find-next', this._control).prop('disabled', false);
        if (this._position === 0 || this._results.length === 0)
            $('#' + this.id + '-find-prev', this._control).prop('disabled', true);
        else
            $('#' + this.id + '-find-prev', this._control).prop('disabled', false);
    }

    private updateCount() {
        if (this._results.length === 0)
            $('#' + this.id + '-find-count', this._control).html('<span class=\'find-no-results\'>No Results</span>');
        else if (this._results.length > 999)
            $('#' + this.id + '-find-count', this._control).html((this._position + 1) + ' of 999+');
        else
            $('#' + this.id + '-find-count', this._control).html((this._position + 1) + ' of ' + this._results.length);
    }

    public dispose() {
        this._control.remove();
        window.document.removeEventListener('keyup', this._key);
    }
}