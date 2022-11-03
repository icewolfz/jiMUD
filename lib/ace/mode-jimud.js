define("ace/mode/jimud_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    var jimudHighlightRules = function () {

        var keywords = (
            "CLR|COLOR|CO|CW|GAG|GA|ECHO|EC|ECHOPROMPT|ECHOP|FREEZE|FR|HIGHLIGHT|HI|PCOL|PRINT|PRINTPROMPT|PRINTP|SAY|SA|SAYPROMPT|SAYP|SHOW|SH|SHOWPROMPT|SHOWP|UNGAG|UNG|CASE|CA|IF|SWITCH|SW|nnn|BREAK|BR|CONTINUE|CONT|FORALL|FO|LOOP|LOO|REPEAT|REP|UNTIL|WHILE|WH|BEEP|BE|PLAYSOUND|PLAYS|PLAYMUSIC|PLAYM|MUSICINFO|SOUNDINFO|STOPALLSOUND|STOPA|STOPSOUND|STOPS|STOPMUSIC|STOPM|ALIAS|AL|BUTTON|BU|BUTTON|BU|PROFILE|PRO|PROFILELIST|UNBUTTON|UNB|VARIABLE|VAR|VA|UNALIAS|UNA|ALARM|ALA|EVENT|EV|RAISEEVENT|RAISE|RAISEDELAYED|RAISEDE|RESUME|RESU|SUSPEND|SUS|TRIGGER|TR|UNTRIGGER|UNT|UNEVENT|UNE|ADD|AD|CHAT|CH|CHATPROMPT|CHATP|CONNECTTIME|CONNECT|EVALUATE|EVA|GETSETTING|GETS|HIDECLIENT|HIDECL|IDLETIME|IDLE|MATH|MAT|NOTIFY|NOT|SETSETTING|SETS|SHOWCLIENT|SHOWCL|TOGGLECLIENT|TOGGLECL|WAIT|WA|WINDOW|WIN|VERSION|VE|TESTLIST|TESTCOLORS|TESTCOLORSDETAILS|TESTXTERM|TESTMXP|TESTMXP2|TESTMXPEXPIRE|TESTMXPCOLORS|TESTMXPELEMENTS|TESTMXPLINES|TESTMAPPER|TESTFANSI|TESTURLDETECT|TESTXTERMRGB|TESTSIZE|TESTSPEED|TESTSPEEDFILE|TESTSPEEDFILER|TESTFILE|TESTPERIOD|TESTUNICODEEMOJI|COMMENT|COMM|NOOP|NO|UNACTION|TEMP|ACTION|AC|FIRE|STATE|STA|SET|CONDITION|COND|CR|SEND|SE|SENDRAW|SENDPROMPT|SENDP|UNVAR|UNV|CHARACTER|CHAR|SPEAK|SPEAKSTOP|SPEAKPAUSE|SPEAKRESUME"
        );

        var builtinConstants = (
            "selected|selectedword|selectedline|selectedurl|selword|selline|selurl|copied|character|character\\.lower|character\\.upper|character\\.proper|selected\\.lower|selectedword\\.lower|selectedline\\.lower|selectedurl\\.lower|selword\\.lower|selline\\.lower|selurl\\.lower|copied\\.lower|selected\\.upper|selectedword\\.upper|selectedline\\.upper|selectedurl\\.upper|selword\\.upper|selline\\.upper|selurl\\.upper|copied\\.upper|selected\\.proper|selectedword\\.proper|selectedline\\.proper|selectedurl\\.proper|selword\\.proper|selline\\.proper|selurl\\.proper|copied\\.proper|repeatnum|cr|esc|lf|crlf|random|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z"
        );

        var builtinConstants2 = (
            "selected|selectedword|selectedline|selectedurl|selword|selline|selurl|copied|character"
        );

        var builtinFunctions = (
            "bitand|bitnot|bitor|bitset|bitshift|bittest|bitxor|eval|dice|diceavg|dicemin|dicemax|dicedev|zdicedev|random|number|isfloat|isnumber|string|float|case|switch|if|lower|upper|proper|char|ascii|begins|ends|len|pos|ipos|regex|trim|trimleft|trimright|time|color|zcolor|ansi|isdefined|clip|alarm|state|defined|isnull|stripansi|escape|unescape|charcomment|charnotes"
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
                token: 'paren.lparen',
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
            }, {
                token: "comment",
                regex: "//$",
                next: "start"
            }, {
                token: "comment",
                regex: "//",
                next: "singleLineComment"
            },
            {
                token: "comment", // multi line comment
                regex: "\\/\\*",
                next: "comment"
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
            ],
            "comment": [
                {
                    token: "comment", // closing comment
                    regex: "\\*\\/",
                    next: "start"
                }, {
                    defaultToken: "comment"
                }
            ],
            "singleLineComment": [
                {
                    token: "comment",
                    regex: /\\$/,
                    next: "singleLineComment"
                }, {
                    token: "comment",
                    regex: /$/,
                    next: "start"
                }, {
                    defaultToken: "comment"
                }
            ]
        };
        this.normalizeRules();
    };


    oop.inherits(jimudHighlightRules, TextHighlightRules);

    exports.jimudHighlightRules = jimudHighlightRules;
});

define("ace/mode/folding/jimud", ["require", "exports", "module", "ace/lib/oop", "ace/range", "ace/mode/folding/fold_mode"], function (require, exports, module) {
    "use strict";

    var oop = require("../../lib/oop");
    var Range = require("../../range").Range;
    var BaseFoldMode = require("./fold_mode").FoldMode;

    var FoldMode = exports.FoldMode = function (commentRegex) {
        if (commentRegex) {
            this.foldingStartMarker = new RegExp(
                this.foldingStartMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.start)
            );
            this.foldingStopMarker = new RegExp(
                this.foldingStopMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.end)
            );
        }
    };
    oop.inherits(FoldMode, BaseFoldMode);

    (function () {

        this.foldingStartMarker = /([\{\[\(])[^\}\]\)]*$|^\s*(\/\*)/;
        this.foldingStopMarker = /^[^\[\{\(]*([\}\]\)])|^[\s\*]*(\*\/)/;
        this.singleLineBlockCommentRe = /^\s*(\/\*).*\*\/\s*$/;
        this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
        //this.startRegionRe = /^\s*(\/\*|\/\/)#?region\b/;
        this._getFoldWidgetBase = this.getFoldWidget;
        this.getFoldWidget = function (session, foldStyle, row) {
            var line = session.getLine(row);

            if (this.singleLineBlockCommentRe.test(line)) {
                if (!this.startRegionRe.test(line) && !this.tripleStarBlockCommentRe.test(line))
                    return "";
            }

            var fw = this._getFoldWidgetBase(session, foldStyle, row);

            /*
            if (!fw && this.startRegionRe.test(line))
                return "start"; // lineCommentRegionStart
            */
            return fw;
        };

        this.getFoldWidgetRange = function (session, foldStyle, row, forceMultiline) {
            var line = session.getLine(row);

            /*
            if (this.startRegionRe.test(line))
                return this.getCommentRegionBlock(session, line, row);
            */

            var match = line.match(this.foldingStartMarker);
            if (match) {
                var i = match.index;

                if (match[1])
                    return this.openingBracketBlock(session, match[1], row, i);

                var range = session.getCommentFoldRange(row, i + match[0].length, 1);

                if (range && !range.isMultiLine()) {
                    if (forceMultiline) {
                        range = this.getSectionRange(session, row);
                    } else if (foldStyle != "all")
                        range = null;
                }

                return range;
            }

            if (foldStyle === "markbegin")
                return;

            var match = line.match(this.foldingStopMarker);
            if (match) {
                var i = match.index + match[0].length;

                if (match[1])
                    return this.closingBracketBlock(session, match[1], row, i);

                return session.getCommentFoldRange(row, i, -1);

            }
        };

        this.getSectionRange = function (session, row) {
            var line = session.getLine(row);
            var startIndent = line.search(/\S/);
            var startRow = row;
            var startColumn = line.length;
            row = row + 1;
            var endRow = row;
            var maxRow = session.getLength();
            while (++row < maxRow) {
                line = session.getLine(row);
                var indent = line.search(/\S/);
                if (indent === -1)
                    continue;
                if (startIndent > indent)
                    break;
                var subRange = this.getFoldWidgetRange(session, "all", row);

                if (subRange) {
                    if (subRange.start.row <= startRow) {
                        break;
                    } else if (subRange.isMultiLine()) {
                        row = subRange.end.row;
                    } else if (startIndent == indent) {
                        break;
                    }
                }
                endRow = row;
            }

            return new Range(startRow, startColumn, endRow, session.getLine(endRow).length);
        };

        this.getCommentRegionBlock = function (session, line, row) {
            var startColumn = line.search(/\s*$/);
            var maxRow = session.getLength();
            var startRow = row;

            var re = /^\s*(?:\/\*|\/\/|--)#?(end)?region\b/;
            var depth = 1;
            while (++row < maxRow) {
                line = session.getLine(row);
                var m = re.exec(line);
                if (!m) continue;
                if (m[1]) depth--;
                else depth++;

                if (!depth) break;
            }

            var endRow = row;
            if (endRow > startRow) {
                return new Range(startRow, startColumn, endRow, line.length);
            }
        };

    }).call(FoldMode.prototype);

});

define("ace/mode/jimud", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/jimud_highlight_rules", "ace/mode/folding/jimud"], function (require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextMode = require("./text").Mode;
    var jimudHighlightRules = require("./jimud_highlight_rules").jimudHighlightRules;
    var CStyleFoldMode = require("./folding/jimud").FoldMode;

    var Mode = function () {
        this.HighlightRules = jimudHighlightRules;
        this.$behaviour = this.$defaultBehaviour;
        this.foldingRules = new CStyleFoldMode();
    };
    oop.inherits(Mode, TextMode);
    var docs = {
        //functions
        'bitand': '<b>bitand(number1,number2)</b><br/>returns the bitwise AND of the two numbers. ',
        'bitnot': '<b>bitnot(number)</b><br/>returns the bitwise inverse of the given number.',
        'bitor': '<b>bitor(number1,number2)</b><br/>returns the bitwise OR of the two numbers. ',
        'bitset': '<b>bitset(i,bitnum,value)</b><br/>Set or reset a bit within a numeric value and return the new numeric value. If value is omitted, 1 (true) is used to set the bit. To reset a bit, the value must be zero. ',
        'bitshift': '<b>bitshift(value,number)</b><br/>shifts the value the num bits to the left. If num is negative, then the value is shifted to the right. ',
        'bittest': '<b>bittest(i,bitnum)</b><br/>Test a bit within a numeric value and return true if it is set, false if it is not set. bitnum starts at 1. ',
        'bitxor': '<b>bitxor(number1,number2)</b><br/>returns the bitwise XOR of the two numbers.',
        'eval': '<b>eval(expression)</b><br/>evaluate the expression and return the results, a long version of `expression`',
        'dice': '<b>dice(xdy+n)</b><br/>roll a dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier',
        'diceavg': '<b>diceavg(xdy+n)</b><br/>the avg roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier',
        'dicemin': '<b>dicemin(xdy+n)</b><br/>the minimum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier',
        'dicemax': '<b>dicemax(xdy+n)</b><br/>the maximum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier',
        'dicedev': '<b>dicedev(xdy+n)</b><br/>return standard deviation of dice `sqrt((y^2 - 1) / 12 * x)`, x is the # of dice, y is the # of sides, with optional +, -, *, / modifier',
        'zdicedev': '<b>zdicedev(xdy+n)</b><br/>return zMUD/cMUD standard deviation of dice `sqrt(((y - 1)^2 - 1) / 12 * x)`, x is the # of dice, y is the # of sides, with optional +, -, *, / modifier',
        'random': '<b>random(i,j)</b><br/>return a random number between i and j, if j omitted, i is then considered the maximum and will return a number between 0 and i',
        'number': '<b>number(s)</b><br/>convert a numeric string to a number. ',
        'isfloat': '<b>isfloat(value)</b><br/>Returns true if value is a valid floating point number',
        'isnumber': '<b>isnumber(s)</b><br/>true if s represents a valid number. ',
        'string': '<b>string(value)</b><br/>converts value to a string. Quotes are added around the value.',
        'float': '<b>float(value)</b><br/>Returns value as a floating point number.',
        'case': '<b>case(n,value1,value2,value3...)</b><br/>return the nth value of arguments, from 1 to last argument',
        'switch': '<b>switch(expression1,value1,...expressionN,valueN)</b><br/>return value of the first expression that evaluates to true',
        'if': '<b>if(expression,true-value,false-value)</b><br/>evaluate expression and return true or false value',
        'lower': '<b>lower(TEXT)</b><br/>force TEXT into lower case, for example \${lower(\${selword})} is the same as ${selword.lower}',
        'upper': '<b>upper(TEXT)</b><br/>force TEXT into upper case',
        'proper': '<b>proper(TEXT)</b><br/>force TEXT into proper casing',
        'char': '<b>char(i)</b><br/>return ASCII character for i',
        'ascii': '<b>ascii(string)</b><br/>return the ascii value for first letter in string',
        'begins': '<b>begins(string1,string2)</b><br/>return true if string 1 starts with string 2',
        'ends': '<b>ends(string1, string2)</b><br/>returns true if string 1 ends with string 2',
        'len': '<b>len(string)</b><br/>returns the length of string',
        'pos': '<b>pos(pattern,string)</b><br/>returns the position of pattern in string on 1 index scale, 0 if not found',
        'ipos': '<b>ipos(pattern,string)</b><br/>returns the position of pattern in string on 1 index scale, 0 if not found ignoring case',
        'regex': '<b>regex(string,regex,var1,...,varN,varN+1)</b><br/>test if string matches the regex pattern, if found returns the position of the match, starting at 1 else returns 0, var1 ... varN are optional variable names to store any sub pattern matches, varN+1 is the length of matched string. <b>Note</b> the regex argument is not parsed and passed as is due to the complexity of regex formats',
        'trim': '<b>trim(string)</b><br/>Returns the string without any spaces at the beginning or end',
        'trimleft': '<b>trimleft(string)</b><br/>Returns the string without any spaces at the beginning',
        'trimright': '<b>trimright(string)</b><br/>Returns the string without any spaces at the end',
        'time': '<b>time(format)</b><br/>display current time in format, if format omitted displays YYYY-MM-DDTHH:mm:ss[Z]<ul><li><b>YYYY</b>4 or 2 digit year</li><li><b>YY</b>2 digit year</li><li><b>Y</b>Year with any number of digits and sign</li><li><b>Q</b>Quarter of year. Sets month to first month in quarter.</li><li><b>M MM</b>Month number</li><li><b>MMM MMMM</b>Month name in locale set by moment.locale()</li><li><b>D DD</b>Day of month</li><li><b>Do</b>Day of month with ordinal</li><li><b>DDD DDDD</b>Day of year</li><li><b>X</b>Unix timestamp</li><li><b>x</b>Unix ms timestamp</li></ul>',
        'color': '<b>color(fore,back,bold)</b><br/>returns color code in string format of fore,back or just fore<ul><li><b>fore</b>the foreground color or bold, if bold it returns bold white<li><b>back</b>the background color, if bold returns bold fore<li><b>bold</b>ansi bold color, if bold returns bold fore<li><b>Colors</b></li> red, blue, orange, yellow, green, black, white, cyan, magenta, gray<ul>',
        'zcolor': '<b>zcolor(code)</b><br/>converts a zmud/cmud color code into a code supported by jiMUD',
        'ansi': '<b>ansi(style,fore,back)</b><br/>insert ansi control characters into string same as ${esc}[CODESm<ul><li><b>style</b>the styles to apply, <i>optional</i><ul><li><b>reset</b>reset all styles andcolors</li><li>bold,faint,italic,underline,blink,reverse,hidden,strikethrough,doubleunderline,boldoff,italicoff,blinkoff,blinkrapidoff,visible,strikethroughoff</li></ul></li><li><b>fore</b>the ground color, if bold and a valid colored bold is considered the foreground color, may also be default</li><li><b>back</b>the background color, may be default <i>optional</i></li><li><ul><li><b>jiMUD custom colors: localecho, infotext, infobackground, errortext<li><b>Colors: red, blue, orange, yellow, green, black, white, cyan, magenta, gray<ul><li>prepend with x for aixterm bright colors</li><li>append background to get background code directly</li><li>eg redbackground to get red background, xred to get aixterm red or xredbackground to get aixterm red background</li></ul></li></ul>',
        'isdefined': '<b>isdefined(name)</b><br/>Returns 1 if a variable is defined, 0 if undefined',
        //variables
        'selected': '<b>selected</b><br/>selected text',
        'selectedword': '<b>selectedword</b><br/>word under mouse when right clicked',
        'selectedline': '<b>selectedline</b><br/>line under mouse when right clicked',
        'selectedurl': '<b>selectedurl</b><br/>url under mouse when right clicked',
        'selword': '<b>selword</b><br/>word under mouse when right clicked',
        'selline': '<b>selline</b><br/>line under mouse when right clicked',
        'selurl': '<b>selurl</b><br/>url under mouse when right clicked',
        'copied': '<b>copied</b><br/>return clipboard text',
        'selected.lower': '<b>selected.lower</b><br/>selected text forced to lower case',
        'selectedword.lower': '<b>selectedword.lower</b><br/>word under mouse when right clicked forced to lower case',
        'selectedline.lower': '<b>selectedline.lower</b><br/>line under mouse when right clicked forced to lower case',
        'selectedurl.lower': '<b>selectedurl.lower</b><br/>url under mouse when right clicked forced to lower case',
        'selword.lower': '<b>selword.lower</b><br/>word under mouse when right clicked forced to lower case',
        'selline.lower': '<b>selline.lower</b><br/>line under mouse when right clicked forced to lower case',
        'selurl.lower': '<b>selurl.lower</b><br/>url under mouse when right clicked forced to lower case',
        'copied.lower': '<b>copied.lower</b><br/>return clipboard text forced to lower case',
        'selected.upper': '<b>selected.upper</b><br/>selected text forced to upper case',
        'selectedword.upper': '<b>selectedword.upper</b><br/>word under mouse when right clicked forced to upper case',
        'selectedline.upper': '<b>selectedline.upper</b><br/>line under mouse when right clicked forced to upper case',
        'selectedurl.upper': '<b>selectedurl.upper</b><br/>url under mouse when right clicked forced to upper case',
        'selword.upper': '<b>selword.upper</b><br/>word under mouse when right clicked forced to upper case',
        'selline.upper': '<b>selline.upper</b><br/>line under mouse when right clicked forced to upper case',
        'selurl.upper': '<b>selurl.upper</b><br/>url under mouse when right clicked forced to upper case',
        'copied.upper': '<b>copied.upper</b><br/>return clipboard text forced to upper case',
        'selected.proper': '<b>selected.proper</b><br/>selected text force to proper casing',
        'selectedword.proper': '<b>selectedword.proper</b><br/>word under mouse when right clicked force to proper casing',
        'selectedline.proper': '<b>selectedline.proper</b><br/>line under mouse when right clicked force to proper casing',
        'selectedurl.proper': '<b>selectedurl.proper</b><br/>url under mouse when right clicked force to proper casing',
        'selword.proper': '<b>selword.proper</b><br/>word under mouse when right clicked force to proper casing',
        'selline.proper': '<b>selline.proper</b><br/>line under mouse when right clicked force to proper casing',
        'selurl.proper': '<b>selurl.proper</b><br/>url under mouse when right clicked force to proper casing',
        'copied.proper': '<b>copied.proper</b><br/>return clipboard text force to proper casing',
        'repeatnum': '<b>repeatnum</b><br/>returns the current index during #nnn or string from #FORALL',
        'cr': '<b>cr</b><br/>replace with carriage return',
        'esc': '<b>esc</b><br/>escape character, useful for creating ansi color codes',
        'lf': '<b>lf</b><br/>replace with line feed',
        'crlf': '<b>crlf</b><br/>replace with carriage return and linefeed',
        'random': '<b>random</b><br/>a random number between 0 and 99',
        'i': '<b>i</b><br/>return the index based on the nested order from outer to inner loops',
        'j': '<b>j</b><br/>return the index based on the nested order from outer to inner loops',
        'k': '<b>k</b><br/>return the index based on the nested order from outer to inner loops',
        'l': '<b>l</b><br/>return the index based on the nested order from outer to inner loops',
        'm': '<b>m</b><br/>return the index based on the nested order from outer to inner loops',
        'n': '<b>n</b><br/>return the index based on the nested order from outer to inner loops',
        'o': '<b>o</b><br/>return the index based on the nested order from outer to inner loops',
        'p': '<b>p</b><br/>return the index based on the nested order from outer to inner loops',
        'q': '<b>q</b><br/>return the index based on the nested order from outer to inner loops',
        'r': '<b>r</b><br/>return the index based on the nested order from outer to inner loops',
        's': '<b>s</b><br/>return the index based on the nested order from outer to inner loops',
        't': '<b>t</b><br/>return the index based on the nested order from outer to inner loops',
        'u': '<b>u</b><br/>return the index based on the nested order from outer to inner loops',
        'v': '<b>v</b><br/>return the index based on the nested order from outer to inner loops',
        'w': '<b>w</b><br/>return the index based on the nested order from outer to inner loops',
        'x': '<b>x</b><br/>return the index based on the nested order from outer to inner loops',
        'y': '<b>y</b><br/>return the index based on the nested order from outer to inner loops',
        'z': '<b>z</b><br/>return the index based on the nested order from outer to inner loops',
        //Commands
        'CLR': '<b>#CLR</b><br/>Add blank lines to clear the screen ignoring any current trailing blank lines',
        'COLOR': '<b><u>#CO</u>LOR <i>{pattern}</i> fore,back,bold <i>profile</i></b><br>Color last added line, comma delimited colors, supports raw jiMUD color codes, ansi word values, any valid HTML color name, of ##RRGGBB html format',
        'CO': '<b><u>#CO</u>LOR <i>{pattern}</i> fore,back,bold <i>profile</i></b><br>Color last added line, comma delimited colors, supports raw jiMUD color codes, ansi word values, any valid HTML color name, of ##RRGGBB html format',
        'CW': '<b>#CW <i>{pattern}</i> fore,back,bold <i>profile</i></b><br/>Color all strings matching current trigger pattern, see #color for arguments',
        'GAG': '<b><u>#GA</u>G <i>number</i></b><br/>Gag the current or multiple lines of incoming or previous lines, if no arguments gags current line',
        'GA': '<b><u>#GA</u>G <i>number</i></b><br/>Gag the current or multiple lines of incoming or previous lines, if no arguments gags current line',
        'ECHO': '<b><u>#EC</u>HO text</b><br/>Display text to the screen and append newline',
        'EC': '<b>u>#EC</u>HO text</b><br/>Display text to the screen and append newline',
        'ECHOPROMPT': '<b><u>#ECHOP</u>ROMPT text</b><br/>Display text to the screen',
        'ECHOP': '<b><u>#ECHOP</u>ROMPT text</b><br/>Display text to the screen',
        'FREEZE': '<b><u>#FR</u>EEZE <i>state</i></b><br/>Scroll lock the display, if state is omitted it will toggle the scroll lock, if state is 0 or false it will disable scroll lock, if state is anything else it will lock the scroll back',
        'FR': '<b><u>#FR</u>EEZE <i>state</i></b><br/>Scroll lock the display, if state is omitted it will toggle the scroll lock, if state is 0 or false it will disable scroll lock, if state is anything else it will lock the scroll back',
        'HIGHLIGHT': '<b><u>#HI</u>GHLIGHT <i>pattern</i></b><br/>make last line or lined with matching pattern bold or brighter color if already bold, or',
        'HI': '<b><u>#HI</u>GHLIGHT <i>pattern</i></b><br/>make last line or lined with matching pattern bold or brighter color if already bold, or',
        'PCOL': '<b>#PCOL fore,back,bold <i>XStart XEnd YStart YEnd</i></b><br/>Color position, will assume full line if position is not supplied, if XEnd omitted will assume end of line, if xEnd -1 it will assume end of line, if YEnd omitted will assume current line, YStart and YEnd are relative to the current line, 0 current, 1 previous, ...',
        'PRINT': '<b>#PRINT text</b><br/>Display text to the screen and append newline, and the display text will not fire triggers',
        'PRINTPROMPT': '<b><u>#PRINTP</u>ROMPT text</b><br/>Display text to the screen, and the display text will not fire triggers',
        'PRINTP': '<b><u>#PRINTP</u>ROMPT text</b><br/>Display text to the screen, and the display text will not fire triggers',
        'SAY': '<b><u>#SA</u>Y text</b><br/>Display text to the screen and append newline',
        'SA': '<b><u>#SA</u>Y text</b><br/>Display text to the screen and append newline',
        'SAYPROMPT': '<b><u>#SAYP</u>ROMPT text</b><br/>Display text to the screen',
        'SAYP': '<b><u>#SAYP</u>ROMPT text</b><br/>Display text to the screen',
        'SHOW': '<b><u>#SH</u>OW text</b><br/>Process text as if it came from the MUD and append a new line',
        'SH': '<b><u>#SH</u>OW text</b><br/>Process text as if it came from the MUD and append a new line',
        'SHOWPROMPT': '<b><u>#SHOWP</u>ROMPT text</b><br/>Process text as if it came from the MUD',
        'SHOWP': '<b><u>#SHOWP</u>ROMPT] text</b><br/>Process text as if it came from the MUD',
        'UNGAG': '<b><u>#UNG</u>AG</b><br/>clear previous #gag command settings',
        'UNG': '<b><u>#UNG</u>AG</b><br/>clear previous #gag command settings',
        'CASE': '<b><u>#CA</u>SE index {command 1}*{command n}</i></b><br/>return command from list based on the value of index',
        'CA': '<b><u>#CA</u>SE index {command 1}*{command n}</i></b><br/>return command from list based on the value of index',
        'IF': '<b>#IF {expression} {true-command} <i>{false-command}</i></b><br/>if expression is true execute true command, if false and false commands supplied execute them',
        'SWITCH': '<b><u>#SW</u>ITCH (expression) {command} <i>(expression) {command} ... {else command}</i></b><br/>execute each expression until one returns true, if none are true and an else command supplied it is executed instead',
        'SW': '<b><u>#SW</u>ITCH (expression) {command} <i>(expression) {command} ... {else command}</i></b><br/>execute each expression until one returns true, if none are true and an else command supplied it is executed instead',
        'nnn': '<b[#nnn commands</b><br/>Repeat commands NNN number of times',
        '-nnn': '<b[#-nnn commands</b><br/>Repeat commands NNN number of times',
        'BREAK': '<b><u>#BR</u>EAK</b><br/>breaks a loop',
        'BR': '<b><u>#BR</u>EAK</b><br/>breaks a loop',
        'CONTINUE': '<b><u>#CONT</u>INUE</b><br/>>skips to the next loop iteration ',
        'CONT': '<b><u>#CONT</u>INUE</b><br/>>skips to the next loop iteration ',
        'FORALL': '<b><u>#FO</u>RALL stringlist {commands}</b><br/>loop stringlist, in the format of a | delimited string and set %i as each word',
        'FO': '<b><u>#FO</u>RALL stringlist {commands}</b><br/>loop stringlist, in the format of a | delimited string and set %i as each word',
        'LOOP': '<b><u>#LOO</u>P range {commands}</b><br/>Execute the commands a number of times given by the range. range is a min and max value separated by a comma, if max value is omitted it is assumed the single value is the max and 1 is the min value',
        'LOO': '<b><u>#LOO</u>P range {commands}</b><br/>Execute the commands a number of times given by the range. range is a min and max value separated by a comma, if max value is omitted it is assumed the single value is the max and 1 is the min value',
        'REPEAT': '<b><u>#REP</u>EAT expression {commands}</b><br/>repeat commands number of times returned by expression',
        'REP': '<b><u>#REP</u>EAT expression {commands}</b><br/>repeat commands number of times returned by expression',
        'UNTIL': '<b>#UNTIL expression {commands}</b><br/>Execute commands until the expression evaluates to TRUE',
        'WHILE': '<b><u>#WH</u>ILE expression {commands}</b><br/>Execute commands as long as expression evaluates to TRUE',
        'WH': '<b><u>#WH</u>ILE expression {commands}</b><br/>Execute commands as long as expression evaluates to TRUE',
        'BEEP': '<b><u>#BE</u>EP</b><br/>Play standard System beep',
        'BE': '<b><u>#BE</u>EP</b><br/>Play standard System beep',
        'PLAYSOUND': '<b><u>#PLAYS</u>OUND soundfile</b><br/>Play a sound effect, to play local files use file://path/file.ext',
        'PLAYS': '<b><u>#PLAYS</u>OUND soundfile</b><br/>Play a sound effect, to play local files use file://path/file.ext',
        'PLAYMUSIC': '<b><u>#PLAYM</u>USIC soundfile</b><br/>Play background music, to play local files use file://path/file.ext',
        'PLAYM': '<b><u>#PLAYM</u>USIC soundfile</b><br/>Play background music, to play local files use file://path/file.ext',
        'MUSICINFO': '<b>#MUSICINFO</b><br/>display currently playing background music, current position, and total length',
        'SOUNDINFO': '<b>#SOUNDINFO</b><br/>display currently playing sound effect, current position, and total length',
        'STOPALLSOUND': '<b><u>#STOPA</u>LLSOUND</b><br/>stop all sound effects and background music',
        'STOPA': '<b><u>#STOPA</u>LLSOUND</b><br/>stop all sound effects and background music',
        'STOPSOUND': '<b><u>#STOPS</u>OUND</b><br/>Stop the current sound effect',
        'STOPS': '<b><u>#STOPS</u>OUND</b><br/>Stop the current sound effect',
        'STOPMUSIC': '<b><u>#STOPM</u>USIC</b><br/>Stop the current background music',
        'STOPM': '<b><u>#STOPM</u>USIC</b><br/>Stop the current background music',
        'ALIAS': '<b>#<u>AL</u>IAS name|index {commands} <i>profile</i></b><br/>Create or alter an alias',
        'AL': '<b>#<u>AL</u>IAS name|index {commands} <i>profile</i></b><br/>Create or alter an alias',
        'BUTTON': '<b><u>#BU</u>TTON name|index</b><br/>Cause a button to react as if it was clicked, if index it is the position from top down starting at 0<br><br><b><u>#BU</u>TTON <i>name caption</i> {commands} <i>{icon} options<sup>2</sup> profile</i></b></br>Update or create a button',
        'BU': '<b><u>#BU</u>TTON name|index</b><br/>Cause a button to react as if it was clicked, if index it is the position from top down starting at 0<br><br><b><u>#BU</u>TTON <i>name caption</i> {commands} <i>{icon} options<sup>2</sup> profile</i></b></br>Update or create a button',
        'PROFILE': '<b><u>#PRO</u>FILE name <i>enable\|disable</i></b><br/>enable or disable a profile',
        'PRO': '<b><u>#PRO</u>FILE name <i>enable\|disable</i></b><br/>enable or disable a profile',
        'PROFILELIST': '<b>#PROFILELIST</b><br/>display a list of all profiles and current state',
        'UNBUTTON': '<b><u>#UNB</u>UTTON name|index|caption</b><br/>remove a button, if index it is the position in order of buttons in profile manager',
        'UNB': '<b><u>#UNB</u>UTTON name|index|caption</b><br/>remove a button, if index it is the position in order of buttons in profile manager',
        'VARIABLE': '<b><u>#VA</u>RIABLE <i>name value</i></b><br/>Set, get, or display all user set variables',
        'VAR': '<b><u>#VA</u>RIABLE <i>name value</i></b><br/>Set, get, or display all user set variables',
        'VA': '<b><u>#VA</u>RIABLE <i>name value</i></b><br/>Set, get, or display all user set variables',
        'UNALIAS': '<b>#<u>UNA</u>LIAS name <i>profile</i></b><br/>Delete an alias',
        'UNA': '<b>#<u>UNA</u>LIAS name <i>profile</i></b><br/>Delete an alias',
        'ALARM': '<b><u>#ALA</u>RM <i>name</i> {time pattern} {commands} <i>profile</i></b><br/>Create or alter an alarm trigger',
        'ALA': '<b[<u>#ALA</u>RM <i>name</i> {time pattern} {commands} <i>profile</i></b><br/>Create or alter an alarm trigger',
        'EVENT': '<b><u>#EV</u>ENT name {commands} <i>options<sup>1</sup> profile</i></b><br/>create or update event',
        'EV': '<b><u>#EV</u>ENT name {commands} <i>options<sup>1</sup> profile</i></b><br/>create or update event',
        'RAISEEVENT': '<b><u>#RAISE</u>EVENT name arguments</b><br/>fire a custom event',
        'RAISE': '<b><u>#RAISE</u>EVENT name arguments</b><br/>fire a custom event',
        'RAISEDELAYED': '<b><u>#RAISEDE</u>LAYED amount name arguments</b><br/>fire a custom event with a delay',
        'RAISEDE': '<b<u>#RAISEDE</u>LAYED amount name arguments></b><br/>fire a custom event with a delay',
        'RESUME': '<b><u>#RESU</u>ME <i>name|pattern</i></b><br/>enable an alarm, id arguments omitted will attempt to suspend last suspended alarm',
        'RESU': '<b><u>#RESU</u>ME <i>name|pattern</i></b><br/>enable an alarm, id arguments omitted will attempt to suspend last suspended alarm',
        'SUSPEND': '<b><u>#SUS</u>PEND <i>name|pattern</i></b><br/>disable an alarm, id arguments omitted will attempt to suspend last added alarm',
        'SUS': '<b><u>#SUS</u>PEND <i>name|pattern</i></b><br/>disable an alarm, id arguments omitted will attempt to suspend last added alarm',
        'TRIGGER': '<b><u>#TR</u>IGGER <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/><u>#TR</u>IGGER name options<sup>1</sup> <i>profile</i><br><br><b><u>#TR</u>IGGER name options<sup>1</sup> <i>profile</i></b><br/>Update options<sup>1</sup> for a trigger',
        'TR': '<b><u>#TR</u>IGGER <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/><u>#TR</u>IGGER name options<sup>1</sup> <i>profile</i><br><br><b><u>#TR</u>IGGER name options<sup>1</sup> <i>profile</i></b><br/>Update options<sup>1</sup> for a trigger',
        'UNTRIGGER': '<b><u>#UNT</u>RIGGER {name\|pattern} <i>profile</i></b><br/>remove a trigger',
        'UNT': '<b><u>#UNT</u>RIGGER {name\|pattern} <i>profile</i></b><br/>remove a trigger',
        'UNEVENT': '<b><u>#UNE</u>VENT name <i>profile</i></b><br/>Delete an event',
        'UNE': '<b><u>#UNE</u>VENT name <i>profile</i></b><br/>Delete an event',
        'ADD': '<b><u>#AD</u>D name value</b><br/>Add value to variable named name, if current value is non numeric an error will be displayed',
        'AD': '<b><u>#AD</u>D name value</b><br/>Add value to variable named name, if current value is non numeric an error will be displayed',
        'CHAT': '<b><u>#CH</u>AT text</b><br/>Send text to chat window and append a new line',
        'CH': '<b><u>#CH</u>AT text</b><br/>Send text to chat window and append a new line',
        'CHATPROMPT': '<b><b><u>#CHATP</u>ROMPT text</b><br/>same as #chat but does not append a new line',
        'CHATP': '<b><b><u>#CHATP</u>ROMPT text</b><br/>same as #chat but does not append a new line',
        'CONNECTTIME': '<b><u>#CONNECT</u>TIME</b><br/>display time since connected',
        'CONNECT': '<b><u>#CONNECT</u>TIME</b><br/>display time since connected',
        'EVALUATE': '<b><u>#EVA</u>LUATE expression</b><br/>Evaluate expression and display to screen like show',
        'EVA': '<b><u>#EVA</u>LUATE expression</b><br/>Evaluate expression and display to screen like show',
        'GETSETTING': '<b><u>#GETS</u>ETTING name</b><br/>display a setting value, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)',
        'GETS': '<b><u>#GETS</u>ETTING name</b><br/>display a setting value, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)',
        'HIDECLIENT': '<b><u>#HIDECL</u>IENT</b><br/>Hide client window',
        'HIDECL': '<b><u>#HIDECL</u>IENT</b><br/>Hide client window',
        'IDLETIME': '<b><u>#IDLE</u>TIME</b><br/>Display time a command was last sent',
        'IDLE': '<b><u>#IDLE</u>TIME</b><br/>Display time a command was last sent',
        'MATH': '<b><u>#MAT</u>H name value</b><br/>Set value to variable named name',
        'MAT': '<b><u>#MAT</u>H name value</b><br/>Set value to variable named name',
        'NOTIFY': '<b><u>#NOT</u>IFY title message *{icon}*</b><br/>display a notification popup with no sound, use [client.notify](scriptind.md#basic-function-list) to turn off silent option or #playsound',
        'NOT': '<b><u>#NOT</u>IFY title message *{icon}*</b><br/>display a notification popup with no sound, use [client.notify](scriptind.md#basic-function-list) to turn off silent option or #playsound',
        'SETSETTING': '<b><u>#SETS</u>ETTING name value</b><br/>alter a setting value see: [Keys and value types](faq.md#setting-keys-value-type-and-default-value)',
        'SETS': '<b><u>#SETS</u>ETTING name value</b><br/>alter a setting value see: [Keys and value types](faq.md#setting-keys-value-type-and-default-value)',
        'SHOWCLIENT': '<b><u>#SHOWCL</u>IENT</b><br/>Show client window',
        'SHOWCL': '<b><u>#SHOWCL</u>IENT</b><br/>Show client window',
        'TOGGLECLIENT': '<b><u>#TOGGLECL</u>IENT</b><br/>Toggle show and hide of client window',
        'TOGGLECL': '<b><u>#TOGGLECL</u>IENT</b><br/>Toggle show and hide of client window',
        'WAIT': '<b><u>#WA</u>IT amount</b><br/> Pause current block for a number of milliseconds',
        'WA': '<b><u>#WA</u>IT amount</b><br/> Pause current block for a number of milliseconds',
        'WINDOW': '<b><u>#WIN</u>DOW name</b><br/>Open or show named window, supported names: about, prefs, mapper, editor, profiles, chat, code-editor, help, immortals, history, log-viewer, skills, who',
        'WIN': '<b><u>#WIN</u>DOW name</b><br/>Open or show named window, supported names: about, prefs, mapper, editor, profiles, chat, code-editor, help, immortals, history, log-viewer, skills, who',
        'VERSION': '<b><u>#VE</u>RSION</b><br/>Display current jiMUD version information',
        'VE': '<b><u>#VE</u>RSION</b><br/>Display current jiMUD version information',
        'TESTLIST': '<b>#TESTLIST</b><br/>List all test commands',
        'TESTCOLORS': '<b>#TESTCOLORS</b><br/>Display a basic ANSI color table',
        'TESTCOLORSDETAILS': '<b>#TESTCOLORSDETAILS</b><br/>Display a more detailed ANSI color table',
        'TESTXTERM': '<b>#TESTXTERM</b><br/>Display an XTerm test pattern',
        'TESTMXP': '<b>#TESTMXP</b><br/>Test MXP support by displaying several MXP tags',
        'TESTMXP2': '<b>#TESTMXP2</b><br/>Test custom elements',
        'TESTMXPEXPIRE': '<b>#TESTMXPEXPIRE</b><br/>Test MXP link expiring',
        'TESTMXPCOLORS': '<b>#TESTMXPCOLORS</b><br/>Display a full list of all supported MXP color names',
        'TESTMXPELEMENTS': '<b>#TESTMXPELEMENTS</b><br/>Test more MXP custom elements',
        'TESTMXPLINES': '<b>#TESTMXPLINES</b><br/>Test MXP line tagging support',
        'TESTMAPPER': '<b>#TESTMAPPER</b><br/>Test mapper by generating a test area named `Doc Build Samples Area`, with 3 x 3 room square with different settings set for each room.',
        'TESTFANSI': '<b>#TESTFANSI</b><br/>Test FANSIa support',
        'TESTURLDETECT': '<b>#TESTURLDETECT</b><br/>Test auto url detection by displaying random urls and formats',
        'TESTXTERMRGB': '<b>#TESTXTERMRGB</b><br/>Display a more detailed XTerm color pattern',
        'TESTSIZE': '<b>#TESTSIZE</b><br/>Test the current width and height of the client in characters by repeating `w` for # of columns as line 0 and displaying the numbers 1 to height - 1',
        'TESTSPEED': '<b>#TESTSPEED</b><br/>Test the speed of the client by running the commands `#TestMXPColors`, `#TestMXP`, `#TestColors`, `#TestColorsDetails`, `#TestXTerm`, `#TestXTermRGB` 10 times taking the time it took to parse, then display. After all test have been ran it will display 0 to 9 and each time and an avg time. **Note** this will cause the client to become unresponsive or locked while running this test, either wait til done or close.',
        'TESTSPEEDFILE': '<b>#TESTSPEEDFILE file</b><br/>Works exactly like #testspeed but will use file argument instead of built in test functions, **Note** file load time can cause test to run longer then total time returned',
        'TESTSPEEDFILER': '<b>#TESTSPEEDFILER file</b><br/>Works exactly like #TestSpeedFile but will attempt to emulate as if sent from remote mud for processing',
        'TESTFILE': '<b>#TESTFILE file</b><br/>Loads a file, displays it and time to display **Note** this will cause the client to become unresponsive or locked while running this test, either wait til done or close.',
        'TESTPERIOD': '<b>#TESTPERIOD</b><br/>Toggle on/off a test that will alternate between #testcolors, #textxterm, #testlist every 2 seconds to simulate constant streaming of text',
        'TESTUNICODEEMOJI': '<b>#TESTUNICODEEMOJI</b><br/>Display emoji unicode symbols',
        'COMMENT': '<b><u>#COMM</u>ENT <i>text</i></b><br/>Does nothing, allows commenting scripts',
        'COMM': '<b><u>#COMM</u>ENT <i>text</i></b><br/>Does nothing, allows commenting scripts',
        'NOOP': '<b><u>#NO</u>OP <i>text</i></b><br/>Does nothing, but will expand arguments',
        'NO': '<b><u>#NO</u>OP <i>text</i></b><br/>Does nothing, but will expand arguments',
        'UNACTION': '<b>#UNACTION {name|pattern} <i>profile</i></b><br/>Same as #UNTRIGGER, see #UNTRIGGER for more details',
        'TEMP': '<b>#TEMP <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>Create temporary trigger',
        'ACTION': '<b><u>#AC</u>TION <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>Same as #TRIGGER, see #trigger for more details',
        'AC': '<b><u>#AC</u>TION <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>Same as #TRIGGER, see #trigger for more details',
        'FIRE': '<b>#FIRE text</b><br/>Send text to trigger system as if received from the mud, triggering matching triggers with out displaying to screen and effecting current last line',
        'STATE': '<b><u>#STA</u>TE <i>name|pattern state profile</i></b><br/>Set the state of trigger, if pattern and profile are omitted, state is set of the last executed trigger, if state omitted trigger state is set to 0, and fire state is set to not fired to ready fire the trigger',
        'STA': '<b><u>#STA</u>TE <i>name|pattern state profile</i></b><br/>Set the state of trigger, if pattern and profile are omitted, state is set of the last executed trigger, if state omitted trigger state is set to 0, and fire state is set to not fired to ready fire the trigger',
        'SET': '<b>#SET <i>name|pattern state value profile</i></b><br/>Set the fired state of trigger, if pattern omitted it will set the fired state of the last executed trigger, if value is omitted it will set the fired state to true, if trigger type is manual it will set the fired state then fire the trigger based on the new state, value must be 0, 1, true, or false, when fired state set to true when the trigger is executed it will be skipped and reset the fired state to default for next execution',
        'CONDITION': '<b><u>#COND</u>ITION <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>create a new trigger sub state, if name or pattern is omitted state will be added to last created trigger',
        'COND': '<b><u>#COND</u>ITION <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>create a new trigger sub state, if name or pattern is omitted state will be added to last created trigger',
        'CR': '<b>#CR<br/>Send a blank line to the mud',
        'SEND': '<b><u>#SE</u>ND <i>file prefix suffix</i></b><br/>Send file to mud line by line pre-pending and appending supplied prefix and suffix to each line as if sent from command input<br/><br/><b><u>#SE</u>ND text</b><br/>Send text to mud as if sent from command line',
        'SE': '<b><u>#SE</u>ND <i>file prefix suffix</i></b><br/>Send file to mud line by line pre-pending and appending supplied prefix and suffix to each line as if sent from command input<br/><br/><b><u>#SE</u>ND text</b><br/>Send text to mud as if sent from command line',
        'SENDRAW': '<b>#SENDRAW <i>file prefix suffix</i></b><br/>Send file to mud line by line pre-pending and appending supplied prefix and suffix to each line with out parsing or echoing to the screen<br/><br/><b>#SENDRAW <i>text</i></b><br/>Send raw text directly to mud with out parsing or echoing to the screen appending a newline if needed',
        'SENDPROMPT': '<b><u>#SENDP</u>ROMPT text</b><br/>Send raw text directly to mud with out parsing or echoing to the screen with no appended newline',
        'SENDP': '<b><u>#SENDP</u>ROMPT text</b><br/>Send raw text directly to mud with out parsing or echoing to the screen with no appended newline',
        'UNVAR': '<b><u>#UNV</u>AR name</b><br/>Delete variable',
        'UNV': '<b><u>#UNV</u>AR name</b><br/>Delete variable',
        'CHARACTER': '<b><u>#CHAR</u>ACTER</b><br/>Send current character name to the mud, without echoing to the screen',
        'CHAR': '<b><u>#CHAR</u>ACTER</b><br/>Send current character name to the mud, without echoing to the screen',
        'SPEAK': '<b>#SPEAK test</b><br/>Speak text using the text to speech system',
        'SPEAKSTOP': '<b>#SPEAKSTOP</b><br/>Stop all speaking and clear queue',
        'SPEAKPAUSE': '<b>#SPEAKPAUSE</b><br/>Pause speaking',
        'SPEAKRESUME': '<b>#SPEAKRESUME</b><br/>Resume speaking',
        'clip': '<b>clip(<i>string</i>)</b><br/>Return or set text to the clipboard',
        'alarm': '<b>alarm("name|pattern")<br>alarm("name|pattern", <i>"profile"</i>)<br>alarm("name|pattern", <i>setTime</i>)<br>alarm("name|pattern", <i>setTime, "profile"</i>)</b><br/>Return or set the time for alarm with name or matching pattern',
        'state': '<b>state("name|pattern", <i>"profile"</i>)</b><br/>Returns the current trigger state of the trigger given by the name or pattern, if no profile it will search all enabled profiles until match found',
        'defined': '<b>defined(name, <i><type/i>)</b><br/>Returns 1 if item is defined, 0 if undefined, if type is omitted will search all supported items<br>Types: alias, event, trigger, macro, button, variable',
        'isnull': '<b>isnull(<i>value</i>)</b><br/>Returns 1 if value null, 0 if not null, if value omitted returns null',
        'stripansi': '<b>stripansi(string)</b><br/>Strip all ansi codes from strip',
        'escape': '<b>escape(string)</b><br/>Returns a string with all special characters escaped based on what is enabled in scripting settings',
        'unescape': '<b>unescape(string)</b><br/>Returns a string with all escapes based on what is enabled in scripting settings removed',
        'charcomment':'<b>charcomment(<i>text</i>)</b><br/>Returns or sets the current character\'s notes, text not supplied current notes returned, if text is blank, "", it will clear the notes field, else text is applied as a new line to the notes',
        'charnotes':'<b>charnotes(<i>text</i>)</b><br/>Returns or sets the current character\'s notes, text not supplied current notes returned else all notes are replaced with text'
    };
    (function () {
        this.$id = "ace/mode/jimud";
        this.getCompletions = function (state, session, pos, prefix) {
            var functions = ["bitand", "bitnot", "bitor", "bitset", "bitshift", "bittest", "bitxor", "eval", "dice", "diceavg", "dicemin", "dicemax", "dicedev", "zdicedev", "random", "number", "isfloat", "isnumber", "string", "float", "case", "switch", "if", "lower", "upper", "proper", "char", "ascii", "begins", "ends", "len", "pos", "ipos", "regex", "trim", "trimleft", "trimright", "time", "color", "zcolor", "ansi"].map(function (word) {
                return {
                    name: word,
                    value: '${' + word + "()}",
                    score: 0,
                    meta: "function",
                    docHTML: docs[word] ? '<div style="width:300px;white-space: normal;">' + docs[word] + '</div>' : 0
                };
            });
            var variables = ["selected", "selectedword", "selectedline", "selectedurl", "selword", "selline", "selurl", "copied", "selected.lower", "selectedword.lower", "selectedline.lower", "selectedurl.lower", "selword.lower", "selline.lower", "selurl.lower", "copied.lower", "selected.upper", "selectedword.upper", "selectedline.upper", "selectedurl.upper", "selword.upper", "selline.upper", "selurl.upper", "copied.upper", "selected.proper", "selectedword.proper", "selectedline.proper", "selectedurl.proper", "selword.proper", "selline.proper", "selurl.proper", "copied.proper", "repeatnum", "cr", "esc", "lf", "crlf", "random", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"].map(function (word) {
                return {
                    name: word,
                    value: '${' + word + "}",
                    score: 0,
                    meta: "variable",
                    docHTML: docs[word] ? '<div style="width:300px;white-space: normal;">' + docs[word] + '</div>' : 0
                };
            });
            var variables2 = ["repeatnum", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"].map(function (word) {
                return {
                    name: word,
                    value: '%{' + word + "}",
                    score: 0,
                    meta: "variable",
                    docHTML: docs[word] ? '<div style="width:300px;white-space: normal;">' + docs[word] + '</div>' : 0
                };
            });
            var variables3 = ["i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"].map(function (word) {
                return {
                    name: word,
                    value: '%' + word,
                    score: 0,
                    meta: "variable",
                    docHTML: docs[word] ? '<div style="width:300px;white-space: normal;">' + docs[word] + '</div>' : 0
                };
            });
            var commands = ["CLR", "COLOR", "CO", "CW", "GAG", "GA", "ECHO", "EC", "ECHOPROMPT", "ECHOP", "FREEZE", "FR", "HIGHLIGHT", "HI", "PCOL", "PRINT", "PRINTPROMPT", "PRINTP", "SAY", "SA", "SAYPROMPT", "SAYP", "SHOW", "SH", "SHOWPROMPT", "SHOWP", "UNGAG", "UNG", "CASE", "CA", "IF", "SWITCH", "SW", "nnn", "-nnn", "BREAK", "BR", "CONTINUE", "CONT", "FORALL", "FO", "LOOP", "LOO", "REPEAT", "REP", "UNTIL", "WHILE", "WH", "BEEP", "BE", "PLAYSOUND", "PLAYS", "PLAYMUSIC", "PLAYM", "MUSICINFO", "SOUNDINFO", "STOPALLSOUND", "STOPA", "STOPSOUND", "STOPS", "STOPMUSIC", "STOPM", "ALIAS", "AL", "BUTTON", "BU", "PROFILE", "PRO", "PROFILELIST", "UNBUTTON", "UNB", "VARIABLE", "VAR", "VA", "UNALIAS", "UNA", "ALARM", "ALA", "EVENT", "EV", "RAISEEVENT", "RAISE", "RAISEDELAYED", "RAISEDE", "RESUME", "RESU", "SUSPEND", "SUS", "TRIGGER", "TR", "UNTRIGGER", "UNT", "UNEVENT", "UNE", "ADD", "AD", "CHAT", "CH", "CHATPROMPT", "CHATP", "CONNECTTIME", "CONNECT", "EVALUATE", "EVA", "GETSETTING", "GETS", "HIDECLIENT", "HIDECL", "IDLETIME", "IDLE", "MATH", "MAT", "NOTIFY", "NOT", "SETSETTING", "SETS", "SHOWCLIENT", "SHOWCL", "TOGGLECLIENT", "TOGGLECL", "WAIT", "WA", "WINDOW", "WIN", "VERSION", "VE", "TESTLIST", "TESTCOLORS", "TESTCOLORSDETAILS", "TESTXTERM", "TESTMXP", "TESTMXP2", "TESTMXPEXPIRE", "TESTMXPCOLORS", "TESTMXPELEMENTS", "TESTMXPLINES", "TESTMAPPER", "TESTFANSI", "TESTURLDETECT", "TESTXTERMRGB", "TESTSIZE", "TESTSPEED", "TESTSPEEDFILE", "TESTSPEEDFILER", "TESTFILE", "TESTPERIOD", "TESTUNICODEEMOJI"].map(function (word) {
                return {
                    name: word,
                    value: '#' + word,
                    score: 0,
                    meta: "command",
                    docHTML: docs[word] ? '<div style="width:300px;white-space: normal;">' + docs[word] + '</div>' : 0
                };
            });
            return [...commands, ...functions, ...variables, ...variables2, ...variables3];
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
