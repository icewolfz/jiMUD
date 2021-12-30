define("ace/mode/jimud_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    var jimudHighlightRules = function () {

        var keywords = (
            "CLR|COLOR|CO|CW|GAG|GA|ECHO|EC|ECHOPROMPT|ECHOP|FREEZE|FR|HIGHLIGHT|HI|PCOL|PRINT|PRINTPROMPT|PRINTP|SAY|SA|SAYPROMPT|SAYP|SHOW|SH|SHOWPROMPT|SHOWP|UNGAG|UNG|CASE|CA|IF|SWITCH|SW|nnn|BREAK|BR|CONTINUE|CONT|FORALL|FO|LOOP|LOO|REPEAT|REP|UNTIL|WHILE|WH|BEEP|BE|PLAYSOUND|PLAYS|PLAYMUSIC|PLAYM|MUSICINFO|SOUNDINFO|STOPALLSOUND|STOPA|STOPSOUND|STOPS|STOPMUSIC|STOPM|ALIAS|AL|BUTTON|BU|BUTTON|BU|PROFILE|PRO|PROFILELIST|UNBUTTON|UNB|VARIABLE|VAR|VA|UNALIAS|UNA|ALARM|ALA|EVENT|EV|RAISEEVENT|RAISE|RAISEDELAYED|RAISEDE|RESUME|RESU|SUSPEND|SUS|TRIGGER|TR|UNTRIGGER|UNT|UNEVENT|UNE|ADD|AD|CHAT|CH|CHATPROMPT|CHATP|CONNECTTIME|CONNECT|EVALUATE|EVA|GETSETTING|GETS|HIDECLIENT|HIDECL|IDLETIME|IDLE|MATH|MAT|NOTIFY|NOT|SETSETTING|SETS|SHOWCLIENT|SHOWCL|TOGGLECLIENT|TOGGLECL|WAIT|WA|WINDOW|WIN|VERSION|VE|TESTLIST|TESTCOLORS|TESTCOLORSDETAILS|TESTXTERM|TESTMXP|TESTMXP2|TESTMXPEXPIRE|TESTMXPCOLORS|TESTMXPELEMENTS|TESTMXPLINES|TESTMAPPER|TESTFANSI|TESTURLDETECT|TESTXTERMRGB|TESTSIZE|TESTSPEED|TESTSPEEDFILE|TESTSPEEDFILER|TESTFILE|TESTPERIOD|TESTUNICODEEMOJI"
        );

        var builtinConstants = (
            "selected|selectedword|selectedline|selectedurl|selword|selline|selurl|copied|selected\\.lower|selectedword\\.lower|selectedline\\.lower|selectedurl\\.lower|selword\\.lower|selline\\.lower|selurl\\.lower|copied\\.lower|selected\\.upper|selectedword\\.upper|selectedline\\.upper|selectedurl\\.upper|selword\\.upper|selline\\.upper|selurl\\.upper|copied\\.upper|selected\\.proper|selectedword\\.proper|selectedline\\.proper|selectedurl\\.proper|selword\\.proper|selline\\.proper|selurl\\.proper|copied\\.proper|repeatnum|cr|esc|lf|crlf|random|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z"
        );

        var builtinConstants2 = (
            "selected|selectedword|selectedline|selectedurl|selword|selline|selurl|copied"
        );

        var builtinFunctions = (
            "bitand|bitnot|bitor|bitset|bitshift|bittest|bitxor|eval|dice|diceavg|dicemin|dicemax|dicedev|zdicedev|random|number|isfloat|isnumber|string|float|case|switch|if|lower|upper|proper|char|ascii|begins|ends|len|pos|ipos|regex|trim|trimleft|trimright|time|color|zcolor|ansi"
        );

        var commandMapper = this.createKeywordMapper({
            //"support.function": builtinFunctions,
            "keyword": keywords,
            //"constant.language": builtinConstants,
            //"storage.type": dataTypes
        }, "identifier", true);

        var inlineMapper = this.createKeywordMapper({
            "constant.language": builtinConstants,
        }, "identifier");

        var functionMapper = this.createKeywordMapper({
            "support.function": builtinFunctions,
        }, "identifier");

        var inlineMapper2 = this.createKeywordMapper({
            "constant.language": builtinConstants2,
        }, "identifier");

        this.$rules = {
            "start": [{
                token: "string",           // " string
                regex: '".*?"'
            }, {
                token: "string",           // ' string
                regex: "'.*?'"
            }, {
                token: "string",           // ` string (apache drill)
                regex: "`.*?`"
            }, {
                token: ';',
                regex: ';',
                next: 'stacking'
            }, {
                token: "constant.numeric", // float
                regex: "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
            }, {
                token: 'storage.modifier',
                regex: '%x?[1-9]?\\d\\b'
            }, {
                token: 'storage.modifier',
                regex: '%\\{x?[1-9]?\\d\\}'
            }, {
                token: 'storage.modifier',
                regex: '%(repeatnum|[i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z])\\b'
            }, {
                token: 'storage.modifier',
                regex: '\\$\\{x?[1-9]?\\d\\}'
            }, {
                token: 'storage.modifier',
                regex: '[%$]\\*'
            }, {
                token: 'storage.modifier',
                regex: '[%$]{\\*}'
            }, {
                token: 'keyword',
                regex: "#\\d+\\s"
            }, {
                token: commandMapper,
                regex: "^#([a-zA-Z_$][a-zA-Z0-9_$]*)\\b"
            }, {
                token: "constant.language",
                regex: "^`.*$"
            }, {
                token: "comment",
                regex: "^\!.*$"
            }, {
                token: inlineMapper2,
                regex: "[%$]{(\\w*)\\.(lower|upper|proper)}"
            }, {
                token: inlineMapper,
                regex: "[%$]{(\\w*(\\.\\w*)?)}"
            }, {
                token: functionMapper,
                regex: "[%$]{(\\w*)\\(.*\\)}"
            }, {
                token: '{',
                regex: '\\{',
                next: 'bracket'
            }/*, {
            token : "support.function",
            regex : "[%$]{(?:"+builtinFunctions+")\\(.*\\)}"
        }
        */, {
                token: "paren.lparen",
                regex: "[\\{}]"
            }, {
                token: "paren.rparen",
                regex: "[\\}]"
            }, {
                token: "text",
                regex: "\\s+"
            }],
            "stacking": [
                {
                    token: commandMapper,
                    regex: "#([a-zA-Z_$][a-zA-Z0-9_$]*)\\b",
                    next: "start"
                }, {
                    token: 'keyword',
                    regex: "#\\d+\\s",
                    next: "start"
                }, {
                    token: "constant.language",
                    regex: "`.*$",
                    next: "start"
                }, {
                    token: "comment",
                    regex: "\!.*$",
                    next: "start"
                }, {
                    token: "text",
                    regex: "\\s*",
                    next: "start"
                }
            ],
            "bracket": [
                {
                    token: commandMapper,
                    regex: "\\s*?#([a-zA-Z_$][a-zA-Z0-9_$]*)\\b",
                    next: "start"
                }, {
                    token: "string",           // " string
                    regex: '".*?"'
                }, {
                    token: "string",           // ' string
                    regex: "'.*?'"
                }, {
                    token: "constant.language",
                    regex: "`.*$",
                    next: "start"
                }, {
                    token: "comment",
                    regex: "\!.*$",
                    next: "start"
                }, {
                    token: ';',
                    regex: ';',
                    next: 'stacking'
                }, {
                    token: 'keyword',
                    regex: "#\\d+\\s"
                }, {
                    token: "constant.numeric", // float
                    regex: "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
                },
                {
                    token: "text",
                    regex: "\\s*",
                    next: "start"
                }
            ]
        };
        this.normalizeRules();
    };

    oop.inherits(jimudHighlightRules, TextHighlightRules);

    exports.jimudHighlightRules = jimudHighlightRules;
});

define("ace/mode/jimud", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/jimud_highlight_rules"], function (require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextMode = require("./text").Mode;
    var jimudHighlightRules = require("./jimud_highlight_rules").jimudHighlightRules;

    var Mode = function () {
        this.HighlightRules = jimudHighlightRules;
        this.$behaviour = this.$defaultBehaviour;
    };
    oop.inherits(Mode, TextMode);

    (function () {
        this.$id = "ace/mode/jimud";
        this.getCompletions = function (state, session, pos, prefix) {
            var functions = ["bitand", "bitnot", "bitor", "bitset", "bitshift", "bittest", "bitxor", "eval", "dice", "diceavg", "dicemin", "dicemax", "dicedev", "zdicedev", "random", "number", "isfloat", "isnumber", "string", "float", "case", "switch", "if", "lower", "upper", "proper", "char", "ascii", "begins", "ends", "len", "pos", "ipos", "regex", "trim", "trimleft", "trimright", "time", "color", "zcolor", "ansi"].map(function (word) {
                return {
                    name: word,
                    value: '${' + word + "()}",
                    score: 0,
                    meta: "function"
                };
            });
            var variables = ["selected", "selectedword", "selectedline", "selectedurl", "selword", "selline", "selurl", "copied", "selected.lower", "selectedword.lower", "selectedline.lower", "selectedurl.lower", "selword.lower", "selline.lower", "selurl.lower", "copied.lower", "selected.upper", "selectedword.upper", "selectedline.upper", "selectedurl.upper", "selword.upper", "selline.upper", "selurl.upper", "copied.upper", "selected.proper", "selectedword.proper", "selectedline.proper", "selectedurl.proper", "selword.proper", "selline.proper", "selurl.proper", "copied.proper", "repeatnum", "cr", "esc", "lf", "crlf", "random", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"].map(function (word) {
                return {
                    name: word,
                    value: '${' + word + "}",
                    score: 0,
                    meta: "variable"
                };
            });
            var variables2 = ["repeatnum", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"].map(function (word) {
                return {
                    name: word,
                    value: '%{' + word + "}",
                    score: 0,
                    meta: "variable"
                };
            });
            var commands = ["CLR", "COLOR", "CO", "CW", "GAG", "GA", "ECHO", "EC", "ECHOPROMPT", "ECHOP", "FREEZE", "FR", "HIGHLIGHT", "HI", "PCOL", "PRINT", "PRINTPROMPT", "PRINTP", "SAY", "SA", "SAYPROMPT", "SAYP", "SHOW", "SH", "SHOWPROMPT", "SHOWP", "UNGAG", "UNG", "CASE", "CA", "IF", "SWITCH", "SW", "nnn", "BREAK", "BR", "CONTINUE", "CONT", "FORALL", "FO", "LOOP", "LOO", "REPEAT", "REP", "UNTIL", "WHILE", "WH", "BEEP", "BE", "PLAYSOUND", "PLAYS", "PLAYMUSIC", "PLAYM", "MUSICINFO", "SOUNDINFO", "STOPALLSOUND", "STOPA", "STOPSOUND", "STOPS", "STOPMUSIC", "STOPM", "ALIAS", "AL", "BUTTON", "BU", "BUTTON", "BU", "PROFILE", "PRO", "PROFILELIST", "UNBUTTON", "UNB", "VARIABLE", "VAR", "VA", "UNALIAS", "UNA", "ALARM", "ALA", "EVENT", "EV", "RAISEEVENT", "RAISE", "RAISEDELAYED", "RAISEDE", "RESUME", "RESU", "SUSPEND", "SUS", "TRIGGER", "TR", "UNTRIGGER", "UNT", "UNEVENT", "UNE", "ADD", "AD", "CHAT", "CH", "CHATPROMPT", "CHATP", "CONNECTTIME", "CONNECT", "EVALUATE", "EVA", "GETSETTING", "GETS", "HIDECLIENT", "HIDECL", "IDLETIME", "IDLE", "MATH", "MAT", "NOTIFY", "NOT", "SETSETTING", "SETS", "SHOWCLIENT", "SHOWCL", "TOGGLECLIENT", "TOGGLECL", "WAIT", "WA", "WINDOW", "WIN", "VERSION", "VE", "TESTLIST", "TESTCOLORS", "TESTCOLORSDETAILS", "TESTXTERM", "TESTMXP", "TESTMXP2", "TESTMXPEXPIRE", "TESTMXPCOLORS", "TESTMXPELEMENTS", "TESTMXPLINES", "TESTMAPPER", "TESTFANSI", "TESTURLDETECT", "TESTXTERMRGB", "TESTSIZE", "TESTSPEED", "TESTSPEEDFILE", "TESTSPEEDFILER", "TESTFILE", "TESTPERIOD", "TESTUNICODEEMOJI"].map(function (word) {
                return {
                    name: word,
                    value: '#' + word,
                    score: 0,
                    meta: "command",
                    //docHTML: "TODO add docs for each"
                };
            });
            return [...commands, ...functions, ...variables, ...variables2];
        };
    }).call(Mode.prototype);

    exports.Mode = Mode;

}); (function () {
    window.require(["ace/mode/jimud"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();
