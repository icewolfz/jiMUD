//spell-checker:words keycode
import { EventEmitter } from 'events';

/**
 * Simple search box dialog
 *
 * @export
 * @class Search
 * @extends {EventEmitter}
 */
export class ProfileSearch extends EventEmitter {
    private $parent;
    private _control;

    private _timer;
    private _results;
    private _position;
    private _case;
    private _word;
    private _reverse;
    private _regex;
    private _key;
    private _value;
    //private $profiles = [];

    public manager;
    public tree;

    /*
    public addProfile(profile) {
        this.$profiles.push(profile);
    }

    public removeProfile(profile) {
        let idx = -1;
        if (!this.$profiles.length) return;
        if (typeof profile === 'string') {
            for (let p = 0, pl = this.$profiles.length; p < pl; p++) {
                if (this.$profiles[p].name === profile) {
                    idx = p;
                    break;
                }
            }
        }
        else
            idx = this.$profiles.indexOf(profile);
        if (idx === -1) return;
        this.$profiles.splice(idx, 1);
    }

    public clearProfiles() {
        this.$profiles = [];
    }

    public setProfiles(profiles) {
        this.$profiles = profiles;
    }
    */

    constructor(manager, tree, parent?) {
        super();
        this.parent = parent;
        this.manager = manager;
        this.tree = tree;
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
            this._timer = setTimeout(() => { this.manager.noEditorFocus = true; this.find(true); this.manager.noEditorFocus = false; }, this._regex ? 500 : 250);
        });

        this._control.on('keypress', () => {
            clearTimeout(this._timer);
            //delay find update to try and batch group text updates ot improve speeds, make regex a little slower as regex can be more complex
            this._timer = setTimeout(() => { this.manager.noEditorFocus = true; this.find(true); this.manager.noEditorFocus = false; }, this._regex ? 500 : 250);
        });

        this._control.on('paste', (e) => {
            clearTimeout(this._timer);
            //delay find update to try and batch group text updates ot improve speeds, make regex a little slower as regex can be more complex
            this._timer = setTimeout(() => { this.manager.noEditorFocus = true; this.find(true); this.manager.noEditorFocus = false; }, this._regex ? 500 : 250);
        });

        this._control.on('cut', (e) => {
            clearTimeout(this._timer);
            //delay find update to try and batch group text updates ot improve speeds, make regex a little slower as regex can be more complex
            this._timer = setTimeout(() => { this.manager.noEditorFocus = true; this.find(true); this.manager.noEditorFocus = false; }, this._regex ? 500 : 250);
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
            if (this._regex)
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

    get SearchValue(): boolean {
        return this._value;
    }

    set SearchValue(value: boolean) {
        if (value !== this._value) {
            this._value = value;
            if (this._value)
                $('#' + this.id + '-find-value', this._control).addClass('active');
            else
                $('#' + this.id + '-find-value', this._control).removeClass('active');
            this.find(true);
            this.emit('value');
        }
    }

    private createControl() {
        this._control = $('<div id="' + this.id + '-find" class="find"><input placeholder="Find" /><button id="' + this.id + '-find-case" title="Match Case" class="find-case">Aa</button><button id="' + this.id + '-find-word" title="Match Whole Word" class="find-word">Aa|</button><button id="' + this.id + '-find-regex" title="Use Regular Expression" class="find-regex">.*</button><button id="' + this.id + '-find-value" title="Search values" class="find-value"><i class="fa fa-code"></i></button><div id="' + this.id + '-find-count" class="find-count"></div><button id="' + this.id + '-find-prev" title="Previous Match" disabled="disabled" class="find-prev"><i class="fa fa-arrow-up"></i></button><button id="' + this.id + '-find-next" title="Next Match" disabled="disabled" class="find-next"><i class="fa fa-arrow-down"></i></button><button id="' + this.id + '-find-selection" title="Find in selection" disabled="disabled" class="find-selection"><i class="fa fa-align-left"></i></button><button id="' + this.id + '-find-reverse" title="Search Up" class="find-reverse"><i class="fa fa-caret-up"></i></button><button id="' + this.id + '-find-close" title="Close" class="find-close"><i class="fa fa-close"></i></button></div>');
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
        $('#' + this.id + '-find-value', this._control).on('click', () => {
            this.SearchValue = !this.SearchValue;
        });        
        window.document.body.appendChild(this._control[0]);
    }

    public show(selection?) {
        this._control.slideDown();
        this.manager.noEditorFocus = true;
        if (selection && selection.length)
            $('input', this._control).val(selection);
        $('input', this._control).focus().select();
        this.find();
        this.manager.noEditorFocus = false;
        this.emit('shown');
    }

    public hide() {
        this._control.slideUp(() => {
            $('input', this._control).val('');
            this.clear();
            this.emit('closed');
        });
    }

    public find(focus?: boolean) {
        const val = <string>$('input', this._control).val();
        this.clear();
        if (val.length === 0) {
            this.updateCount();
            this.emit('found-results', this._results);
            return;
        }

        if (!this.manager.profiles.length) {
            this.updateCount();
            this.emit('found-results', this._results);
            return;
        }
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
        let items = [];
        let m;
        let i;
        let il;
        let item;
        const profiles = Object.values<any>(this.manager.profiles.items);
        for (let p = 0, pl = profiles.length; p < pl; p++) {
            let profile = profiles[p];
            m = re.exec(profile.name);
            const key = 'Profile' + profile.name.toLowerCase().replace(/^[^a-z]+|[^\w:.-]+/gi, '-');
            if (m) {
                items.push({
                    key: key,
                });
            }
            il = profile.aliases.length;
            for (i = 0; i < il; i++) {
                item = profile.aliases[i];
                if (this.matchItem(re, item) || re.exec(item.pattern))
                    items.push({ key: key + 'aliases' + i, parents: [key, 'aliases'] });
            }
            il = profile.triggers.length;
            for (i = 0; i < il; i++) {
                item = profile.triggers[i];
                if (this.matchItem(re, item) || re.exec(item.pattern))
                    items.push({ key: key + 'triggers' + i, state: 0, parents: [key, 'triggers'] });
                else if (item.triggers.length) {
                    for (let t = 0, tl = item.triggers.length; t < tl; t++)
                        if (this.matchItem(re, item.triggers[t]) || re.exec(item.triggers[t].pattern))
                            items.push({ key: key + 'triggers' + i, state: t + 1, parents: [key, 'triggers'] });
                }
            }
            il = profile.macros.length;
            for (i = 0; i < il; i++) {
                item = profile.macros[i];
                if (this.matchItem(re, item))
                    items.push({ key: key + 'macros' + i, parents: [key, 'macros'] });
            }
            il = profile.buttons.length;
            for (i = 0; i < il; i++) {
                item = profile.buttons[i];
                if (this.matchItem(re, item) || re.exec(item.caption))
                    items.push({ key: key + 'buttons' + i, parents: [key, 'buttons'] });
            }
            il = profile.contexts.length;
            for (i = 0; i < il; i++) {
                item = profile.contexts[i];
                if (this.matchItem(re, item) || re.exec(item.caption))
                    items.push({ key: key + 'contexts' + i, parents: [key, 'contexts'] });
            }
        }
        this._results.push.apply(this._results, items);

        if (this.Reverse)
            this._results.reverse();
        this.gotoResult(0, focus);
        this.emit('found-results', this._results);
    }

    private matchItem(re, item) {
        if (re.exec(item.name))
            return true;
        if (re.exec(this.manager.GetDisplay(item)))
            return true;
        if (this._value && re.exec(item.value))
            return true;
        return false;
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

    public gotoResult(idx: number, focus?: boolean) {
        if (!this.manager.profiles.length) return;
        if (idx < 0) idx = 0;
        if (idx >= this._results.length)
            idx = this._results.length - 1;
        this._position = idx;
        this.updateCount();
        if (this._results.length > 0) {
            const r = this._results[idx];
            let n;
            if (r.parents) {
                let parent = '';
                for (let p = 0, pl = r.parents.length; p < pl; p++) {
                    parent += r.parents[p];
                    n = this.tree.treeview('findNodes', ['^' + parent + '$', 'id']);
                    this.tree.treeview('expandNode', [n, { levels: 1, silent: false }]);
                }
            }
            n = this.tree.treeview('findNodes', ['^' + r.key + '$', 'id']);
            if (n.length) {
                if (!n[0].state.selected)
                    this.tree.treeview('selectNode', [n, { silent: false }]);
                n[0].$el[0].scrollIntoView({ block: 'center' });
            }
            if (r.hasOwnProperty('state') && typeof r.state === 'number')
                this.manager.SelectTriggerState(r.state);
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

function getScrollParent(node) {
    if (node == null)
        return null;
    if (node.scrollHeight > node.clientHeight)
        return node;
    return getScrollParent(node.parentNode);
}