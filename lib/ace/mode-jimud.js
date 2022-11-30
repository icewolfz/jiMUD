define("ace/mode/jimud_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    var jimudHighlightRules = function () {

        var keywords = (
            "CLR|COLOR|CO|CW|GAG|GA|ECHO|EC|ECHOPROMPT|ECHOP|FREEZE|FR|HIGHLIGHT|HI|PCOL|PRINT|PRINTPROMPT|PRINTP|SAY|SA|SAYPROMPT|SAYP|SHOW|SH|SHOWPROMPT|SHOWP|UNGAG|UNG|CASE|CA|IF|SWITCH|SW|nnn|BREAK|BR|CONTINUE|CONT|FORALL|FO|LOOP|LOO|REPEAT|REP|UNTIL|WHILE|WH|BEEP|BE|PLAYSOUND|PLAYS|PLAYMUSIC|PLAYM|MUSICINFO|SOUNDINFO|STOPALLSOUND|STOPA|STOPSOUND|STOPS|STOPMUSIC|STOPM|ALIAS|AL|BUTTON|BU|BUTTON|BU|PROFILE|PRO|PROFILELIST|UNBUTTON|UNB|VARIABLE|VAR|VA|UNALIAS|UNA|ALARM|ALA|EVENT|EV|RAISEEVENT|RAISE|RAISEDELAYED|RAISEDE|RESUME|RESU|SUSPEND|SUS|TRIGGER|TR|UNTRIGGER|UNT|UNEVENT|UNE|ADD|AD|CHAT|CH|CHATPROMPT|CHATP|CONNECTTIME|CONNECT|EVALUATE|EVA|GETSETTING|GETS|HIDECLIENT|HIDECL|IDLETIME|IDLE|MATH|MAT|NOTIFY|NOT|SETSETTING|SETS|SHOWCLIENT|SHOWCL|TOGGLECLIENT|TOGGLECL|WAIT|WA|WINDOW|WIN|VERSION|VE|TESTLIST|TESTCOLORS|TESTCOLORSDETAILS|TESTXTERM|TESTMXP|TESTMXP2|TESTMXPEXPIRE|TESTMXPCOLORS|TESTMXPELEMENTS|TESTMXPLINES|TESTMAPPER|TESTFANSI|TESTURLDETECT|TESTXTERMRGB|TESTSIZE|TESTSPEED|TESTSPEEDFILE|TESTSPEEDFILER|TESTFILE|TESTPERIOD|TESTUNICODEEMOJI|COMMENT|COMM|NOOP|NO|UNACTION|TEMP|ACTION|AC|FIRE|STATE|STA|SET|CONDITION|COND|CR|SEND|SE|SENDRAW|SENDPROMPT|SENDP|UNVAR|UNV|CHARACTER|CHAR|SPEAK|SPEAKSTOP|SPEAKPAUSE|SPEAKRESUME|CLOSE|ALL|TAB|NAME|ID|CLEARNAME|TO|WRAP|WR|NA|CLEARNA"
        );

        var builtinConstants = (
            "selected|selectedword|selectedline|selectedurl|selword|selline|selurl|copied|character|character\\.lower|character\\.upper|character\\.proper|selected\\.lower|selectedword\\.lower|selectedline\\.lower|selectedurl\\.lower|selword\\.lower|selline\\.lower|selurl\\.lower|copied\\.lower|selected\\.upper|selectedword\\.upper|selectedline\\.upper|selectedurl\\.upper|selword\\.upper|selline\\.upper|selurl\\.upper|copied\\.upper|selected\\.proper|selectedword\\.proper|selectedline\\.proper|selectedurl\\.proper|selword\\.proper|selline\\.proper|selurl\\.proper|copied\\.proper|repeatnum|cr|esc|lf|crlf|random|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z|clientid|clientname|action|trigger|caption|characterid"
        );

        var builtinConstants2 = (
            "selected|selectedword|selectedline|selectedurl|selword|selline|selurl|copied|character"
        );

        var builtinFunctions = (
            "bitand|bitnot|bitor|bitset|bitshift|bittest|bitxor|eval|dice|diceavg|dicemin|dicemax|dicedev|zdicedev|random|number|isfloat|isnumber|string|float|case|switch|if|lower|upper|proper|char|ascii|begins|ends|len|pos|ipos|regex|trim|trimleft|trimright|time|color|zcolor|ansi|isdefined|clip|alarm|state|defined|isnull|stripansi|escape|unescape|charcomment|charnotes|clientname"
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
    let docType = {
        command: 2,
        function: 4,
        variables: 8,
        paramaters: 16,
        paramaters2: 32
    }
    var docs = {
        //functions
        'bitand': { text: '<b>bitand(number1,number2)</b><br/>returns the bitwise AND of the two numbers. ', type: 4 },
        'bitnot': { text: '<b>bitnot(number)</b><br/>returns the bitwise inverse of the given number.', type: 4 },
        'bitor': { text: '<b>bitor(number1,number2)</b><br/>returns the bitwise OR of the two numbers. ', type: 4 },
        'bitset': { text: '<b>bitset(i,bitnum,value)</b><br/>Set or reset a bit within a numeric value and return the new numeric value. If value is omitted, 1 (true) is used to set the bit. To reset a bit, the value must be zero. ', type: 4 },
        'bitshift': { text: '<b>bitshift(value,number)</b><br/>shifts the value the num bits to the left. If num is negative, then the value is shifted to the right. ', type: 4 },
        'bittest': { text: '<b>bittest(i,bitnum)</b><br/>Test a bit within a numeric value and return true if it is set, false if it is not set. bitnum starts at 1. ', type: 4 },
        'bitxor': { text: '<b>bitxor(number1,number2)</b><br/>returns the bitwise XOR of the two numbers.', type: 4 },
        'eval': { text: '<b>eval(expression)</b><br/>evaluate the expression and return the results, a long version of `expression`', type: 4 },
        'dice': { text: '<b>dice(xdy+n)</b><br/>roll a dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier', type: 4 },
        'diceavg': { text: '<b>diceavg(xdy+n)</b><br/>the avg roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier', type: 4 },
        'dicemin': { text: '<b>dicemin(xdy+n)</b><br/>the minimum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier', type: 4 },
        'dicemax': { text: '<b>dicemax(xdy+n)</b><br/>the maximum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier', type: 4 },
        'dicedev': { text: '<b>dicedev(xdy+n)</b><br/>return standard deviation of dice `sqrt((y^2 - 1) / 12 * x)`, x is the # of dice, y is the # of sides, with optional +, -, *, / modifier', type: 4 },
        'zdicedev': { text: '<b>zdicedev(xdy+n)</b><br/>return zMUD/cMUD standard deviation of dice `sqrt(((y - 1)^2 - 1) / 12 * x)`, x is the # of dice, y is the # of sides, with optional +, -, *, / modifier', type: 4 },
        'random': { text: '<b>random(i,j)</b><br/>return a random number between i and j, if j omitted, i is then considered the maximum and will return a number between 0 and i', type: 4 },
        'number': { text: '<b>number(s)</b><br/>convert a numeric string to a number. ', type: 4 },
        'isfloat': { text: '<b>isfloat(value)</b><br/>Returns true if value is a valid floating point number', type: 4 },
        'isnumber': { text: '<b>isnumber(s)</b><br/>true if s represents a valid number. ', type: 4 },
        'string': { text: '<b>string(value)</b><br/>converts value to a string. Quotes are added around the value.', type: 4 },
        'float': { text: '<b>float(value)</b><br/>Returns value as a floating point number.', type: 4 },
        'case': { text: '<b>case(n,value1,value2,value3...)</b><br/>return the nth value of arguments, from 1 to last argument', type: 4 },
        'switch': { text: '<b>switch(expression1,value1,...expressionN,valueN)</b><br/>return value of the first expression that evaluates to true', type: 4 },
        'if': { text: '<b>if(expression,true-value,false-value)</b><br/>evaluate expression and return true or false value', type: 4 },
        'lower': { text: '<b>lower(TEXT)</b><br/>force TEXT into lower case, for example \${lower(\${selword})} is the same as ${selword.lower}', type: 4 },
        'upper': { text: '<b>upper(TEXT)</b><br/>force TEXT into upper case', type: 4 },
        'proper': { text: '<b>proper(TEXT)</b><br/>force TEXT into proper casing', type: 4 },
        'char': { text: '<b>char(i)</b><br/>return ASCII character for i', type: 4 },
        'ascii': { text: '<b>ascii(string)</b><br/>return the ascii value for first letter in string', type: 4 },
        'begins': { text: '<b>begins(string1,string2)</b><br/>return true if string 1 starts with string 2', type: 4 },
        'ends': { text: '<b>ends(string1, string2)</b><br/>returns true if string 1 ends with string 2', type: 4 },
        'len': { text: '<b>len(string)</b><br/>returns the length of string', type: 4 },
        'pos': { text: '<b>pos(pattern,string)</b><br/>returns the position of pattern in string on 1 index scale, 0 if not found', type: 4 },
        'ipos': { text: '<b>ipos(pattern,string)</b><br/>returns the position of pattern in string on 1 index scale, 0 if not found ignoring case', type: 4 },
        'regex': { text: '<b>regex(string,regex,var1,...,varN,varN+1)</b><br/>test if string matches the regex pattern, if found returns the position of the match, starting at 1 else returns 0, var1 ... varN are optional variable names to store any sub pattern matches, varN+1 is the length of matched string. <b>Note</b> the regex argument is not parsed and passed as is due to the complexity of regex formats', type: 4 },
        'trim': { text: '<b>trim(string)</b><br/>Returns the string without any spaces at the beginning or end', type: 4 },
        'trimleft': { text: '<b>trimleft(string)</b><br/>Returns the string without any spaces at the beginning', type: 4 },
        'trimright': { text: '<b>trimright(string)</b><br/>Returns the string without any spaces at the end', type: 4 },
        'time': { text: '<b>time(format)</b><br/>display current time in format, if format omitted displays YYYY-MM-DDTHH:mm:ss[Z]<ul><li><b>YYYY</b>4 or 2 digit year</li><li><b>YY</b>2 digit year</li><li><b>Y</b>Year with any number of digits and sign</li><li><b>Q</b>Quarter of year. Sets month to first month in quarter.</li><li><b>M MM</b>Month number</li><li><b>MMM MMMM</b>Month name in locale set by moment.locale()</li><li><b>D DD</b>Day of month</li><li><b>Do</b>Day of month with ordinal</li><li><b>DDD DDDD</b>Day of year</li><li><b>X</b>Unix timestamp</li><li><b>x</b>Unix ms timestamp</li></ul>', type: 4 },
        'color': { text: '<b>color(fore,back,bold)</b><br/>returns color code in string format of fore,back or just fore<ul><li><b>fore</b>the foreground color or bold, if bold it returns bold white<li><b>back</b>the background color, if bold returns bold fore<li><b>bold</b>ansi bold color, if bold returns bold fore<li><b>Colors</b></li> red, blue, orange, yellow, green, black, white, cyan, magenta, gray<ul>', type: 4 },
        'zcolor': { text: '<b>zcolor(code)</b><br/>converts a zmud/cmud color code into a code supported by jiMUD', type: 4 },
        'ansi': { text: '<b>ansi(style,fore,back)</b><br/>insert ansi control characters into string same as ${esc}[CODESm<ul><li><b>style</b>the styles to apply, <i>optional</i><ul><li><b>reset</b>reset all styles andcolors</li><li>bold,faint,italic,underline,blink,reverse,hidden,strikethrough,doubleunderline,boldoff,italicoff,blinkoff,blinkrapidoff,visible,strikethroughoff</li></ul></li><li><b>fore</b>the ground color, if bold and a valid colored bold is considered the foreground color, may also be default</li><li><b>back</b>the background color, may be default <i>optional</i></li><li><ul><li><b>jiMUD custom colors: localecho, infotext, infobackground, errortext<li><b>Colors: red, blue, orange, yellow, green, black, white, cyan, magenta, gray<ul><li>prepend with x for aixterm bright colors</li><li>append background to get background code directly</li><li>eg redbackground to get red background, xred to get aixterm red or xredbackground to get aixterm red background</li></ul></li></ul>', type: 4 },
        'isdefined': { text: '<b>isdefined(name)</b><br/>Returns 1 if a variable is defined, 0 if undefined', type: 4 },
        //variables
        'selected': { text: '<b>selected</b><br/>selected text', type: docType.variables },
        'selectedword': { text: '<b>selectedword</b><br/>word under mouse when right clicked', type: docType.variables },
        'selectedline': { text: '<b>selectedline</b><br/>line under mouse when right clicked', type: docType.variables },
        'selectedurl': { text: '<b>selectedurl</b><br/>url under mouse when right clicked', type: docType.variables },
        'selword': { text: '<b>selword</b><br/>word under mouse when right clicked', type: docType.variables },
        'selline': { text: '<b>selline</b><br/>line under mouse when right clicked', type: docType.variables },
        'selurl': { text: '<b>selurl</b><br/>url under mouse when right clicked', type: docType.variables },
        'copied': { text: '<b>copied</b><br/>return clipboard text', type: docType.variables },
        'selected.lower': { text: '<b>selected.lower</b><br/>selected text forced to lower case', type: docType.variables },
        'selectedword.lower': { text: '<b>selectedword.lower</b><br/>word under mouse when right clicked forced to lower case', type: docType.variables },
        'selectedline.lower': { text: '<b>selectedline.lower</b><br/>line under mouse when right clicked forced to lower case', type: docType.variables },
        'selectedurl.lower': { text: '<b>selectedurl.lower</b><br/>url under mouse when right clicked forced to lower case', type: docType.variables },
        'selword.lower': { text: '<b>selword.lower</b><br/>word under mouse when right clicked forced to lower case', type: docType.variables },
        'selline.lower': { text: '<b>selline.lower</b><br/>line under mouse when right clicked forced to lower case', type: docType.variables },
        'selurl.lower': { text: '<b>selurl.lower</b><br/>url under mouse when right clicked forced to lower case', type: docType.variables },
        'copied.lower': { text: '<b>copied.lower</b><br/>return clipboard text forced to lower case', type: docType.variables },
        'selected.upper': { text: '<b>selected.upper</b><br/>selected text forced to upper case', type: docType.variables },
        'selectedword.upper': { text: '<b>selectedword.upper</b><br/>word under mouse when right clicked forced to upper case', type: docType.variables },
        'selectedline.upper': { text: '<b>selectedline.upper</b><br/>line under mouse when right clicked forced to upper case', type: docType.variables },
        'selectedurl.upper': { text: '<b>selectedurl.upper</b><br/>url under mouse when right clicked forced to upper case', type: docType.variables },
        'selword.upper': { text: '<b>selword.upper</b><br/>word under mouse when right clicked forced to upper case', type: docType.variables },
        'selline.upper': { text: '<b>selline.upper</b><br/>line under mouse when right clicked forced to upper case', type: docType.variables },
        'selurl.upper': { text: '<b>selurl.upper</b><br/>url under mouse when right clicked forced to upper case', type: docType.variables },
        'copied.upper': { text: '<b>copied.upper</b><br/>return clipboard text forced to upper case', type: docType.variables },
        'selected.proper': { text: '<b>selected.proper</b><br/>selected text force to proper casing', type: docType.variables },
        'selectedword.proper': { text: '<b>selectedword.proper</b><br/>word under mouse when right clicked force to proper casing', type: docType.variables },
        'selectedline.proper': { text: '<b>selectedline.proper</b><br/>line under mouse when right clicked force to proper casing', type: docType.variables },
        'selectedurl.proper': { text: '<b>selectedurl.proper</b><br/>url under mouse when right clicked force to proper casing', type: docType.variables },
        'selword.proper': { text: '<b>selword.proper</b><br/>word under mouse when right clicked force to proper casing', type: docType.variables },
        'selline.proper': { text: '<b>selline.proper</b><br/>line under mouse when right clicked force to proper casing', type: docType.variables },
        'selurl.proper': { text: '<b>selurl.proper</b><br/>url under mouse when right clicked force to proper casing', type: docType.variables },
        'copied.proper': { text: '<b>copied.proper</b><br/>return clipboard text force to proper casing', type: docType.variables },
        'repeatnum': { text: '<b>repeatnum</b><br/>returns the current index during #nnn or string from #FORALL', type: docType.variables | docType.paramaters },
        'cr': { text: '<b>cr</b><br/>replace with carriage return', type: docType.variables },
        'esc': { text: '<b>esc</b><br/>escape character, useful for creating ansi color codes', type: docType.variables },
        'lf': { text: '<b>lf</b><br/>replace with line feed', type: docType.variables },
        'crlf': { text: '<b>crlf</b><br/>replace with carriage return and linefeed', type: docType.variables },
        'random': { text: '<b>random</b><br/>a random number between 0 and 99', type: docType.variables },
        'i': { text: '<b>i</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'j': { text: '<b>j</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'k': { text: '<b>k</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'l': { text: '<b>l</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'm': { text: '<b>m</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'n': { text: '<b>n</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'o': { text: '<b>o</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'p': { text: '<b>p</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'q': { text: '<b>q</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'r': { text: '<b>r</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        's': { text: '<b>s</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        't': { text: '<b>t</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'u': { text: '<b>u</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'v': { text: '<b>v</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'w': { text: '<b>w</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'x': { text: '<b>x</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'y': { text: '<b>y</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        'z': { text: '<b>z</b><br/>return the index based on the nested order from outer to inner loops', type: docType.variables | docType.paramaters | docType.paramaters2 },
        //Commands
        'CLR': { text: '<b>#CLR</b><br/>Add blank lines to clear the screen ignoring any current trailing blank lines', type: 2 },
        'COLOR': { text: '<b><u>#CO</u>LOR <i>{pattern}</i> fore,back,bold <i>profile</i></b><br>Color last added line, comma delimited colors, supports raw jiMUD color codes, ansi word values, any valid HTML color name, of ##RRGGBB html format', type: 2 },
        'CO': { text: '<b><u>#CO</u>LOR <i>{pattern}</i> fore,back,bold <i>profile</i></b><br>Color last added line, comma delimited colors, supports raw jiMUD color codes, ansi word values, any valid HTML color name, of ##RRGGBB html format', type: 2 },
        'CW': { text: '<b>#CW <i>{pattern}</i> fore,back,bold <i>profile</i></b><br/>Color all strings matching current trigger pattern, see #color for arguments', type: 2 },
        'GAG': { text: '<b><u>#GA</u>G <i>number</i></b><br/>Gag the current or multiple lines of incoming or previous lines, if no arguments gags current line', type: 2 },
        'GA': { text: '<b><u>#GA</u>G <i>number</i></b><br/>Gag the current or multiple lines of incoming or previous lines, if no arguments gags current line', type: 2 },
        'ECHO': { text: '<b><u>#EC</u>HO text</b><br/>Display text to the screen and append newline', type: 2 },
        'EC': { text: '<b>u>#EC</u>HO text</b><br/>Display text to the screen and append newline', type: 2 },
        'ECHOPROMPT': { text: '<b><u>#ECHOP</u>ROMPT text</b><br/>Display text to the screen', type: 2 },
        'ECHOP': { text: '<b><u>#ECHOP</u>ROMPT text</b><br/>Display text to the screen', type: 2 },
        'FREEZE': { text: '<b><u>#FR</u>EEZE <i>state</i></b><br/>Scroll lock the display, if state is omitted it will toggle the scroll lock, if state is 0 or false it will disable scroll lock, if state is anything else it will lock the scroll back', type: 2 },
        'FR': { text: '<b><u>#FR</u>EEZE <i>state</i></b><br/>Scroll lock the display, if state is omitted it will toggle the scroll lock, if state is 0 or false it will disable scroll lock, if state is anything else it will lock the scroll back', type: 2 },
        'HIGHLIGHT': { text: '<b><u>#HI</u>GHLIGHT <i>pattern</i></b><br/>make last line or lined with matching pattern bold or brighter color if already bold, or', type: 2 },
        'HI': { text: '<b><u>#HI</u>GHLIGHT <i>pattern</i></b><br/>make last line or lined with matching pattern bold or brighter color if already bold, or', type: 2 },
        'PCOL': { text: '<b>#PCOL fore,back,bold <i>XStart XEnd YStart YEnd</i></b><br/>Color position, will assume full line if position is not supplied, if XEnd omitted will assume end of line, if xEnd -1 it will assume end of line, if YEnd omitted will assume current line, YStart and YEnd are relative to the current line, 0 current, 1 previous, ...', type: 2 },
        'PRINT': { text: '<b>#PRINT text</b><br/>Display text to the screen and append newline, and the display text will not fire triggers', type: 2 },
        'PRINTPROMPT': { text: '<b><u>#PRINTP</u>ROMPT text</b><br/>Display text to the screen, and the display text will not fire triggers', type: 2 },
        'PRINTP': { text: '<b><u>#PRINTP</u>ROMPT text</b><br/>Display text to the screen, and the display text will not fire triggers', type: 2 },
        'SAY': { text: '<b><u>#SA</u>Y text</b><br/>Display text to the screen and append newline', type: 2 },
        'SA': { text: '<b><u>#SA</u>Y text</b><br/>Display text to the screen and append newline', type: 2 },
        'SAYPROMPT': { text: '<b><u>#SAYP</u>ROMPT text</b><br/>Display text to the screen', type: 2 },
        'SAYP': { text: '<b><u>#SAYP</u>ROMPT text</b><br/>Display text to the screen', type: 2 },
        'SHOW': { text: '<b><u>#SH</u>OW text</b><br/>Process text as if it came from the MUD and append a new line', type: 2 },
        'SH': { text: '<b><u>#SH</u>OW text</b><br/>Process text as if it came from the MUD and append a new line', type: 2 },
        'SHOWPROMPT': { text: '<b><u>#SHOWP</u>ROMPT text</b><br/>Process text as if it came from the MUD', type: 2 },
        'SHOWP': { text: '<b><u>#SHOWP</u>ROMPT] text</b><br/>Process text as if it came from the MUD', type: 2 },
        'UNGAG': { text: '<b><u>#UNG</u>AG</b><br/>clear previous #gag command settings', type: 2 },
        'UNG': { text: '<b><u>#UNG</u>AG</b><br/>clear previous #gag command settings', type: 2 },
        'CASE': { text: '<b><u>#CA</u>SE index {command 1}*{command n}</i></b><br/>return command from list based on the value of index', type: 2 },
        'CA': { text: '<b><u>#CA</u>SE index {command 1}*{command n}</i></b><br/>return command from list based on the value of index', type: 2 },
        'IF': { text: '<b>#IF {expression} {true-command} <i>{false-command}</i></b><br/>if expression is true execute true command, if false and false commands supplied execute them', type: 2 },
        'SWITCH': { text: '<b><u>#SW</u>ITCH (expression) {command} <i>(expression) {command} ... {else command}</i></b><br/>execute each expression until one returns true, if none are true and an else command supplied it is executed instead', type: 2 },
        'SW': { text: '<b><u>#SW</u>ITCH (expression) {command} <i>(expression) {command} ... {else command}</i></b><br/>execute each expression until one returns true, if none are true and an else command supplied it is executed instead', type: 2 },
        'nnn': { text: '<b[#nnn commands</b><br/>Repeat commands NNN number of times', type: 0 },
        '-nnn': { text: '<b[#-nnn commands</b><br/>Repeat commands NNN number of times', type: 0 },
        'BREAK': { text: '<b><u>#BR</u>EAK</b><br/>breaks a loop', type: 2 },
        'BR': { text: '<b><u>#BR</u>EAK</b><br/>breaks a loop', type: 2 },
        'CONTINUE': { text: '<b><u>#CONT</u>INUE</b><br/>>skips to the next loop iteration ', type: 2 },
        'CONT': { text: '<b><u>#CONT</u>INUE</b><br/>>skips to the next loop iteration ', type: 2 },
        'FORALL': { text: '<b><u>#FO</u>RALL stringlist {commands}</b><br/>loop stringlist, in the format of a | delimited string and set %i as each word', type: 2 },
        'FO': { text: '<b><u>#FO</u>RALL stringlist {commands}</b><br/>loop stringlist, in the format of a | delimited string and set %i as each word', type: 2 },
        'LOOP': { text: '<b><u>#LOO</u>P range {commands}</b><br/>Execute the commands a number of times given by the range. range is a min and max value separated by a comma, if max value is omitted it is assumed the single value is the max and 1 is the min value', type: 2 },
        'LOO': { text: '<b><u>#LOO</u>P range {commands}</b><br/>Execute the commands a number of times given by the range. range is a min and max value separated by a comma, if max value is omitted it is assumed the single value is the max and 1 is the min value', type: 2 },
        'REPEAT': { text: '<b><u>#REP</u>EAT expression {commands}</b><br/>repeat commands number of times returned by expression', type: 2 },
        'REP': { text: '<b><u>#REP</u>EAT expression {commands}</b><br/>repeat commands number of times returned by expression', type: 2 },
        'UNTIL': { text: '<b>#UNTIL expression {commands}</b><br/>Execute commands until the expression evaluates to TRUE', type: 2 },
        'WHILE': { text: '<b><u>#WH</u>ILE expression {commands}</b><br/>Execute commands as long as expression evaluates to TRUE', type: 2 },
        'WH': { text: '<b><u>#WH</u>ILE expression {commands}</b><br/>Execute commands as long as expression evaluates to TRUE', type: 2 },
        'BEEP': { text: '<b><u>#BE</u>EP</b><br/>Play standard System beep', type: 2 },
        'BE': { text: '<b><u>#BE</u>EP</b><br/>Play standard System beep', type: 2 },
        'PLAYSOUND': { text: '<b><u>#PLAYS</u>OUND soundfile</b><br/>Play a sound effect, to play local files use file://path/file.ext', type: 2 },
        'PLAYS': { text: '<b><u>#PLAYS</u>OUND soundfile</b><br/>Play a sound effect, to play local files use file://path/file.ext', type: 2 },
        'PLAYMUSIC': { text: '<b><u>#PLAYM</u>USIC soundfile</b><br/>Play background music, to play local files use file://path/file.ext', type: 2 },
        'PLAYM': { text: '<b><u>#PLAYM</u>USIC soundfile</b><br/>Play background music, to play local files use file://path/file.ext', type: 2 },
        'MUSICINFO': { text: '<b>#MUSICINFO</b><br/>display currently playing background music, current position, and total length', type: 2 },
        'SOUNDINFO': { text: '<b>#SOUNDINFO</b><br/>display currently playing sound effect, current position, and total length', type: 2 },
        'STOPALLSOUND': { text: '<b><u>#STOPA</u>LLSOUND</b><br/>stop all sound effects and background music', type: 2 },
        'STOPA': { text: '<b><u>#STOPA</u>LLSOUND</b><br/>stop all sound effects and background music', type: 2 },
        'STOPSOUND': { text: '<b><u>#STOPS</u>OUND</b><br/>Stop the current sound effect', type: 2 },
        'STOPS': { text: '<b><u>#STOPS</u>OUND</b><br/>Stop the current sound effect', type: 2 },
        'STOPMUSIC': { text: '<b><u>#STOPM</u>USIC</b><br/>Stop the current background music', type: 2 },
        'STOPM': { text: '<b><u>#STOPM</u>USIC</b><br/>Stop the current background music', type: 2 },
        'ALIAS': { text: '<b>#<u>AL</u>IAS name|index {commands} <i>profile</i></b><br/>Create or alter an alias', type: 2 },
        'AL': { text: '<b>#<u>AL</u>IAS name|index {commands} <i>profile</i></b><br/>Create or alter an alias', type: 2 },
        'BUTTON': { text: '<b><u>#BU</u>TTON name|index</b><br/>Cause a button to react as if it was clicked, if index it is the position from top down starting at 0<br><br><b><u>#BU</u>TTON <i>name caption</i> {commands} <i>{icon} options<sup>2</sup> profile</i></b></br>Update or create a button', type: 2 },
        'BU': { text: '<b><u>#BU</u>TTON name|index</b><br/>Cause a button to react as if it was clicked, if index it is the position from top down starting at 0<br><br><b><u>#BU</u>TTON <i>name caption</i> {commands} <i>{icon} options<sup>2</sup> profile</i></b></br>Update or create a button', type: 2 },
        'PROFILE': { text: '<b><u>#PRO</u>FILE name <i>enable\|disable</i></b><br/>enable or disable a profile', type: 2 },
        'PRO': { text: '<b><u>#PRO</u>FILE name <i>enable\|disable</i></b><br/>enable or disable a profile', type: 2 },
        'PROFILELIST': { text: '<b>#PROFILELIST</b><br/>display a list of all profiles and current state', type: 2 },
        'UNBUTTON': { text: '<b><u>#UNB</u>UTTON name|index|caption</b><br/>remove a button, if index it is the position in order of buttons in profile manager', type: 2 },
        'UNB': { text: '<b><u>#UNB</u>UTTON name|index|caption</b><br/>remove a button, if index it is the position in order of buttons in profile manager', type: 2 },
        'VARIABLE': { text: '<b><u>#VA</u>RIABLE <i>name value</i></b><br/>Set, get, or display all user set variables', type: 2 },
        'VAR': { text: '<b><u>#VA</u>RIABLE <i>name value</i></b><br/>Set, get, or display all user set variables', type: 2 },
        'VA': { text: '<b><u>#VA</u>RIABLE <i>name value</i></b><br/>Set, get, or display all user set variables', type: 2 },
        'UNALIAS': { text: '<b>#<u>UNA</u>LIAS name <i>profile</i></b><br/>Delete an alias', type: 2 },
        'UNA': { text: '<b>#<u>UNA</u>LIAS name <i>profile</i></b><br/>Delete an alias', type: 2 },
        'ALARM': { text: '<b><u>#ALA</u>RM <i>name</i> {time pattern} {commands} <i>profile</i></b><br/>Create or alter an alarm trigger', type: 2 },
        'ALA': { text: '<b[<u>#ALA</u>RM <i>name</i> {time pattern} {commands} <i>profile</i></b><br/>Create or alter an alarm trigger', type: 2 },
        'EVENT': { text: '<b><u>#EV</u>ENT name {commands} <i>options<sup>1</sup> profile</i></b><br/>create or update event', type: 2 },
        'EV': { text: '<b><u>#EV</u>ENT name {commands} <i>options<sup>1</sup> profile</i></b><br/>create or update event', type: 2 },
        'RAISEEVENT': { text: '<b><u>#RAISE</u>EVENT name arguments</b><br/>fire a custom event', type: 2 },
        'RAISE': { text: '<b><u>#RAISE</u>EVENT name arguments</b><br/>fire a custom event', type: 2 },
        'RAISEDELAYED': { text: '<b><u>#RAISEDE</u>LAYED amount name arguments</b><br/>fire a custom event with a delay', type: 2 },
        'RAISEDE': { text: '<b<u>#RAISEDE</u>LAYED amount name arguments></b><br/>fire a custom event with a delay', type: 2 },
        'RESUME': { text: '<b><u>#RESU</u>ME <i>name|pattern</i></b><br/>enable an alarm, id arguments omitted will attempt to suspend last suspended alarm', type: 2 },
        'RESU': { text: '<b><u>#RESU</u>ME <i>name|pattern</i></b><br/>enable an alarm, id arguments omitted will attempt to suspend last suspended alarm', type: 2 },
        'SUSPEND': { text: '<b><u>#SUS</u>PEND <i>name|pattern</i></b><br/>disable an alarm, id arguments omitted will attempt to suspend last added alarm', type: 2 },
        'SUS': { text: '<b><u>#SUS</u>PEND <i>name|pattern</i></b><br/>disable an alarm, id arguments omitted will attempt to suspend last added alarm', type: 2 },
        'TRIGGER': { text: '<b><u>#TR</u>IGGER <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/><u>#TR</u>IGGER name options<sup>1</sup> <i>profile</i><br><br><b><u>#TR</u>IGGER name options<sup>1</sup> <i>profile</i></b><br/>Update options<sup>1</sup> for a trigger', type: 2 },
        'TR': { text: '<b><u>#TR</u>IGGER <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/><u>#TR</u>IGGER name options<sup>1</sup> <i>profile</i><br><br><b><u>#TR</u>IGGER name options<sup>1</sup> <i>profile</i></b><br/>Update options<sup>1</sup> for a trigger', type: 2 },
        'UNTRIGGER': { text: '<b><u>#UNT</u>RIGGER {name\|pattern} <i>profile</i></b><br/>remove a trigger', type: 2 },
        'UNT': { text: '<b><u>#UNT</u>RIGGER {name\|pattern} <i>profile</i></b><br/>remove a trigger', type: 2 },
        'UNEVENT': { text: '<b><u>#UNE</u>VENT name <i>profile</i></b><br/>Delete an event', type: 2 },
        'UNE': { text: '<b><u>#UNE</u>VENT name <i>profile</i></b><br/>Delete an event', type: 2 },
        'ADD': { text: '<b><u>#AD</u>D name value</b><br/>Add value to variable named name, if current value is non numeric an error will be displayed', type: 2 },
        'AD': { text: '<b><u>#AD</u>D name value</b><br/>Add value to variable named name, if current value is non numeric an error will be displayed', type: 2 },
        'CHAT': { text: '<b><u>#CH</u>AT text</b><br/>Send text to chat window and append a new line', type: 2 },
        'CH': { text: '<b><u>#CH</u>AT text</b><br/>Send text to chat window and append a new line', type: 2 },
        'CHATPROMPT': { text: '<b><b><u>#CHATP</u>ROMPT text</b><br/>same as #chat but does not append a new line', type: 2 },
        'CHATP': { text: '<b><b><u>#CHATP</u>ROMPT text</b><br/>same as #chat but does not append a new line', type: 2 },
        'CONNECTTIME': { text: '<b><u>#CONNECT</u>TIME</b><br/>display time since connected', type: 2 },
        'CONNECT': { text: '<b><u>#CONNECT</u>TIME</b><br/>display time since connected', type: 2 },
        'EVALUATE': { text: '<b><u>#EVA</u>LUATE expression</b><br/>Evaluate expression and display to screen like show', type: 2 },
        'EVA': { text: '<b><u>#EVA</u>LUATE expression</b><br/>Evaluate expression and display to screen like show', type: 2 },
        'GETSETTING': { text: '<b><u>#GETS</u>ETTING name</b><br/>display a setting value, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)', type: 2 },
        'GETS': { text: '<b><u>#GETS</u>ETTING name</b><br/>display a setting value, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)', type: 2 },
        'HIDECLIENT': { text: '<b><u>#HIDECL</u>IENT</b><br/>Hide client window', type: 2 },
        'HIDECL': { text: '<b><u>#HIDECL</u>IENT</b><br/>Hide client window', type: 2 },
        'IDLETIME': { text: '<b><u>#IDLE</u>TIME</b><br/>Display time a command was last sent', type: 2 },
        'IDLE': { text: '<b><u>#IDLE</u>TIME</b><br/>Display time a command was last sent', type: 2 },
        'MATH': { text: '<b><u>#MAT</u>H name value</b><br/>Set value to variable named name', type: 2 },
        'MAT': { text: '<b><u>#MAT</u>H name value</b><br/>Set value to variable named name', type: 2 },
        'NOTIFY': { text: '<b><u>#NOT</u>IFY title message *{icon}*</b><br/>display a notification popup with no sound, use [client.notify](scriptind.md#basic-function-list) to turn off silent option or #playsound', type: 2 },
        'NOT': { text: '<b><u>#NOT</u>IFY title message *{icon}*</b><br/>display a notification popup with no sound, use [client.notify](scriptind.md#basic-function-list) to turn off silent option or #playsound', type: 2 },
        'SETSETTING': { text: '<b><u>#SETS</u>ETTING name value</b><br/>alter a setting value see: [Keys and value types](faq.md#setting-keys-value-type-and-default-value)', type: 2 },
        'SETS': { text: '<b><u>#SETS</u>ETTING name value</b><br/>alter a setting value see: [Keys and value types](faq.md#setting-keys-value-type-and-default-value)', type: 2 },
        'SHOWCLIENT': { text: '<b><u>#SHOWCL</u>IENT</b><br/>Show client window', type: 2 },
        'SHOWCL': { text: '<b><u>#SHOWCL</u>IENT</b><br/>Show client window', type: 2 },
        'TOGGLECLIENT': { text: '<b><u>#TOGGLECL</u>IENT</b><br/>Toggle show and hide of client window', type: 2 },
        'TOGGLECL': { text: '<b><u>#TOGGLECL</u>IENT</b><br/>Toggle show and hide of client window', type: 2 },
        'WAIT': { text: '<b><u>#WA</u>IT amount</b><br/> Pause current block for a number of milliseconds', type: 2 },
        'WA': { text: '<b><u>#WA</u>IT amount</b><br/> Pause current block for a number of milliseconds', type: 2 },
        'WINDOW': { text: '<b><u>#WIN</u>DOW name</b><br/>Open or show named window, supported names: about, prefs, mapper, editor, profiles, chat, code-editor, help, immortals, history, log-viewer, skills, who', type: 2 },
        'WIN': { text: '<b><u>#WIN</u>DOW name</b><br/>Open or show named window, supported names: about, prefs, mapper, editor, profiles, chat, code-editor, help, immortals, history, log-viewer, skills, who', type: 2 },
        'VERSION': { text: '<b><u>#VE</u>RSION</b><br/>Display current jiMUD version information', type: 2 },
        'VE': { text: '<b><u>#VE</u>RSION</b><br/>Display current jiMUD version information', type: 2 },
        'TESTLIST': { text: '<b>#TESTLIST</b><br/>List all test commands', type: 2 },
        'TESTCOLORS': { text: '<b>#TESTCOLORS</b><br/>Display a basic ANSI color table', type: 2 },
        'TESTCOLORSDETAILS': { text: '<b>#TESTCOLORSDETAILS</b><br/>Display a more detailed ANSI color table', type: 2 },
        'TESTXTERM': { text: '<b>#TESTXTERM</b><br/>Display an XTerm test pattern', type: 2 },
        'TESTMXP': { text: '<b>#TESTMXP</b><br/>Test MXP support by displaying several MXP tags', type: 2 },
        'TESTMXP2': { text: '<b>#TESTMXP2</b><br/>Test custom elements', type: 2 },
        'TESTMXPEXPIRE': { text: '<b>#TESTMXPEXPIRE</b><br/>Test MXP link expiring', type: 2 },
        'TESTMXPCOLORS': { text: '<b>#TESTMXPCOLORS</b><br/>Display a full list of all supported MXP color names', type: 2 },
        'TESTMXPELEMENTS': { text: '<b>#TESTMXPELEMENTS</b><br/>Test more MXP custom elements', type: 2 },
        'TESTMXPLINES': { text: '<b>#TESTMXPLINES</b><br/>Test MXP line tagging support', type: 2 },
        'TESTMAPPER': { text: '<b>#TESTMAPPER</b><br/>Test mapper by generating a test area named `Doc Build Samples Area`, with 3 x 3 room square with different settings set for each room.', type: 2 },
        'TESTFANSI': { text: '<b>#TESTFANSI</b><br/>Test FANSIa support', type: 2 },
        'TESTURLDETECT': { text: '<b>#TESTURLDETECT</b><br/>Test auto url detection by displaying random urls and formats', type: 2 },
        'TESTXTERMRGB': { text: '<b>#TESTXTERMRGB</b><br/>Display a more detailed XTerm color pattern', type: 2 },
        'TESTSIZE': { text: '<b>#TESTSIZE</b><br/>Test the current width and height of the client in characters by repeating `w` for # of columns as line 0 and displaying the numbers 1 to height - 1', type: 2 },
        'TESTSPEED': { text: '<b>#TESTSPEED</b><br/>Test the speed of the client by running the commands `#TestMXPColors`, `#TestMXP`, `#TestColors`, `#TestColorsDetails`, `#TestXTerm`, `#TestXTermRGB` 10 times taking the time it took to parse, then display. After all test have been ran it will display 0 to 9 and each time and an avg time. **Note** this will cause the client to become unresponsive or locked while running this test, either wait til done or close.', type: 2 },
        'TESTSPEEDFILE': { text: '<b>#TESTSPEEDFILE file</b><br/>Works exactly like #testspeed but will use file argument instead of built in test functions, **Note** file load time can cause test to run longer then total time returned', type: 2 },
        'TESTSPEEDFILER': { text: '<b>#TESTSPEEDFILER file</b><br/>Works exactly like #TestSpeedFile but will attempt to emulate as if sent from remote mud for processing', type: 2 },
        'TESTFILE': { text: '<b>#TESTFILE file</b><br/>Loads a file, displays it and time to display **Note** this will cause the client to become unresponsive or locked while running this test, either wait til done or close.', type: 2 },
        'TESTPERIOD': { text: '<b>#TESTPERIOD</b><br/>Toggle on/off a test that will alternate between #testcolors, #textxterm, #testlist every 2 seconds to simulate constant streaming of text', type: 2 },
        'TESTUNICODEEMOJI': { text: '<b>#TESTUNICODEEMOJI</b><br/>Display emoji unicode symbols', type: 2 },
        'COMMENT': { text: '<b><u>#COMM</u>ENT <i>text</i></b><br/>Does nothing, allows commenting scripts', type: 2 },
        'COMM': { text: '<b><u>#COMM</u>ENT <i>text</i></b><br/>Does nothing, allows commenting scripts', type: 2 },
        'NOOP': { text: '<b><u>#NO</u>OP <i>text</i></b><br/>Does nothing, but will expand arguments', type: 2 },
        'NO': { text: '<b><u>#NO</u>OP <i>text</i></b><br/>Does nothing, but will expand arguments', type: 2 },
        'UNACTION': { text: '<b>#UNACTION {name|pattern} <i>profile</i></b><br/>Same as #UNTRIGGER, see #UNTRIGGER for more details', type: 2 },
        'TEMP': { text: '<b>#TEMP <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>Create temporary trigger', type: 2 },
        'ACTION': { text: '<b><u>#AC</u>TION <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>Same as #TRIGGER, see #trigger for more details', type: 2 },
        'AC': { text: '<b><u>#AC</u>TION <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>Same as #TRIGGER, see #trigger for more details', type: 2 },
        'FIRE': { text: '<b>#FIRE text</b><br/>Send text to trigger system as if received from the mud, triggering matching triggers with out displaying to screen and effecting current last line', type: 2 },
        'STATE': { text: '<b><u>#STA</u>TE <i>name|pattern state profile</i></b><br/>Set the state of trigger, if pattern and profile are omitted, state is set of the last executed trigger, if state omitted trigger state is set to 0, and fire state is set to not fired to ready fire the trigger', type: 2 },
        'STA': { text: '<b><u>#STA</u>TE <i>name|pattern state profile</i></b><br/>Set the state of trigger, if pattern and profile are omitted, state is set of the last executed trigger, if state omitted trigger state is set to 0, and fire state is set to not fired to ready fire the trigger', type: 2 },
        'SET': { text: '<b>#SET <i>name|pattern state value profile</i></b><br/>Set the fired state of trigger, if pattern omitted it will set the fired state of the last executed trigger, if value is omitted it will set the fired state to true, if trigger type is manual it will set the fired state then fire the trigger based on the new state, value must be 0, 1, true, or false, when fired state set to true when the trigger is executed it will be skipped and reset the fired state to default for next execution', type: 2 },
        'CONDITION': { text: '<b><u>#COND</u>ITION <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>create a new trigger sub state, if name or pattern is omitted state will be added to last created trigger', type: 2 },
        'COND': { text: '<b><u>#COND</u>ITION <i>name</i> {pattern} <i>{commands} options<sup>1</sup> profile</i></b><br/>create a new trigger sub state, if name or pattern is omitted state will be added to last created trigger', type: 2 },
        'CR': { text: '<b>#CR<br/>Send a blank line to the mud', type: 2 },
        'SEND': { text: '<b><u>#SE</u>ND <i>file prefix suffix</i></b><br/>Send file to mud line by line pre-pending and appending supplied prefix and suffix to each line as if sent from command input<br/><br/><b><u>#SE</u>ND text</b><br/>Send text to mud as if sent from command line', type: 2 },
        'SE': { text: '<b><u>#SE</u>ND <i>file prefix suffix</i></b><br/>Send file to mud line by line pre-pending and appending supplied prefix and suffix to each line as if sent from command input<br/><br/><b><u>#SE</u>ND text</b><br/>Send text to mud as if sent from command line', type: 2 },
        'SENDRAW': { text: '<b>#SENDRAW <i>file prefix suffix</i></b><br/>Send file to mud line by line pre-pending and appending supplied prefix and suffix to each line with out parsing or echoing to the screen<br/><br/><b>#SENDRAW <i>text</i></b><br/>Send raw text directly to mud with out parsing or echoing to the screen appending a newline if needed', type: 2 },
        'SENDPROMPT': { text: '<b><u>#SENDP</u>ROMPT text</b><br/>Send raw text directly to mud with out parsing or echoing to the screen with no appended newline', type: 2 },
        'SENDP': { text: '<b><u>#SENDP</u>ROMPT text</b><br/>Send raw text directly to mud with out parsing or echoing to the screen with no appended newline', type: 2 },
        'UNVAR': { text: '<b><u>#UNV</u>AR name</b><br/>Delete variable', type: 2 },
        'UNV': { text: '<b><u>#UNV</u>AR name</b><br/>Delete variable', type: 2 },
        'CHARACTER': { text: '<b><u>#CHAR</u>ACTER</b><br/>Send current character name to the mud, without echoing to the screen', type: 2 },
        'CHAR': { text: '<b><u>#CHAR</u>ACTER</b><br/>Send current character name to the mud, without echoing to the screen', type: 2 },
        'SPEAK': { text: '<b>#SPEAK test</b><br/>Speak text using the text to speech system', type: 2 },
        'SPEAKSTOP': { text: '<b>#SPEAKSTOP</b><br/>Stop all speaking and clear queue', type: 2 },
        'SPEAKPAUSE': { text: '<b>#SPEAKPAUSE</b><br/>Pause speaking', type: 2 },
        'SPEAKRESUME': { text: '<b>#SPEAKRESUME</b><br/>Resume speaking', type: 2 },
        'CLOSE': { text: '<b>#CLOSE <i>name or id</i></b><br/>Close current tab/window or named window', type: 2 },
        'ALL': { text: '<b>#ALL {commands}</b><br/>Send commands to all client windows as if sent from command line', type: 2 },
        'TAB': { text: '<b>#TAB <i>character or id</i></b><br/>Create a new client tab in current window', type: 2 },
        'NA': { text: '<b><u>#NA</u>ME <i>name id</i></b><br/>Set the name for the current window or for the window id<br/>If no arguments, displays current window name', type: 2 },
        'NAME': { text: '<b><u>#NA</u>ME <i>name id</i></b><br/>Set the name for the current window or for the window id<br/>If no arguments, displays current window name', type: 2 },
        'ID': { text: '<b>#ID</b><br/>Display client id', type: 2 },
        'CLEARNA': { text: '<b><u>#CLEARNA</u>ME <i>name or id</i></b><br/>Clear client current or named client\'s name', type: 2 },
        'CLEARNAME': { text: '<b><u>#CLEARNA</u>ME <i>name or id</i></b><br/>Clear client current or named client\'s name', type: 2 },
        'TO': { text: '<b>#TO name or id</b><br/>Send commands to named client or client id as if sent from command line', type: 2 },
        'WR': { text: '<b><u>#WR</u>AP <i>number</i></b><br/>Toggle word wrap and set the wrap column to number if supplied, if number is 0 disables wrap at column', type: 2 },
        'WRAP': { text: '<b><u>#WR</u>AP <i>number</i></b><br/>Toggle word wrap and set the wrap column to number if supplied, if number is 0 disables wrap at column', type: 2 },
        'clip': { text: '<b>clip(<i>string</i>)</b><br/>Return or set text to the clipboard', type: 4 },
        'alarm': { text: '<b>alarm("name|pattern")<br>alarm("name|pattern", <i>"profile"</i>)<br>alarm("name|pattern", <i>setTime</i>)<br>alarm("name|pattern", <i>setTime, "profile"</i>)</b><br/>Return or set the time for alarm with name or matching pattern', type: 4 },
        'state': { text: '<b>state("name|pattern", <i>"profile"</i>)</b><br/>Returns the current trigger state of the trigger given by the name or pattern, if no profile it will search all enabled profiles until match found', type: 4 },
        'defined': { text: '<b>defined(name, <i><type/i>)</b><br/>Returns 1 if item is defined, 0 if undefined, if type is omitted will search all supported items<br>Types: alias, event, trigger, macro, button, variable', type: 4 },
        'isnull': { text: '<b>isnull(<i>value</i>)</b><br/>Returns 1 if value null, 0 if not null, if value omitted returns null', type: 4 },
        'stripansi': { text: '<b>stripansi(string)</b><br/>Strip all ansi codes from strip', type: 4 },
        'escape': { text: '<b>escape(string)</b><br/>Returns a string with all special characters escaped based on what is enabled in scripting settings', type: 4 },
        'unescape': { text: '<b>unescape(string)</b><br/>Returns a string with all escapes based on what is enabled in scripting settings removed', type: 4 },
        'charcomment': { text: '<b>charcomment(<i>text</i>)</b><br/>Returns or sets the current character\'s notes, text not supplied current notes returned, if text is blank, "", it will clear the notes field, else text is applied as a new line to the notes', type: 4 },
        'charnotes': { text: '<b>charnotes(<i>text</i>)</b><br/>Returns or sets the current character\'s notes, text not supplied current notes returned else all notes are replaced with text', type: docType.function },
        'clientid': { text: '<b>clientid</b><br/>return current client id', type: docType.variables },
        'clientname': { text: '<b>clientname(<i>name, id</i>)</b><br/>Return or set the client name', type: docType.function },
        'action': { text: '<b>action</b><br/>Last triggered action executed', type: docType.variables },
        'trigger': { text: '<b>trigger</b><br/>Last text, event, or pattern that caused last trigger to fire', type: docType.variables },
        'caption': { text: '<b>caption</b><br/>returns the executing item\'s caption, only set for buttons and context menu items', type: docType.variables },
        'characterid': { text: '<b>characterid</b><br/>returns current character id for client', type: docType.variables }
    };
    (function () {
        this.$id = "ace/mode/jimud";
        this.getCompletions = function (state, session, pos, prefix) {
            var functions = Object.keys(docs).filter(d => (docs[d].type & 4) === 4).map(function (word) {
                return {
                    name: word,
                    value: '${' + word + "()}",
                    score: 0,
                    meta: "function",
                    docHTML: docs[word] && docs[word].text ? '<div style="width:300px;white-space: normal;">' + docs[word].text + '</div>' : 0
                };
            });
            var variables = Object.keys(docs).filter(d => (docs[d].type & 8) === 8).map(function (word) {
                return {
                    name: word,
                    value: '${' + word + "}",
                    score: 0,
                    meta: "variable",
                    docHTML: docs[word] && docs[word].text ? '<div style="width:300px;white-space: normal;">' + docs[word].text + '</div>' : 0
                };
            });
            var variables2 = Object.keys(docs).filter(d => (docs[d].type & 16) === 16).map(function (word) {
                return {
                    name: word,
                    value: '%{' + word + "}",
                    score: 0,
                    meta: "variable",
                    docHTML: docs[word] && docs[word].text ? '<div style="width:300px;white-space: normal;">' + docs[word].text + '</div>' : 0
                };
            });
            var variables3 = Object.keys(docs).filter(d => (docs[d].type & 32) === 32).map(function (word) {
                return {
                    name: word,
                    value: '%' + word,
                    score: 0,
                    meta: "variable",
                    docHTML: docs[word] && docs[word].text ? '<div style="width:300px;white-space: normal;">' + docs[word].text + '</div>' : 0
                };
            });
            var commands = Object.keys(docs).filter(d => (docs[d].type & 2) === 2).map(function (word) {
                return {
                    name: word,
                    value: '#' + word,
                    score: 0,
                    meta: "command",
                    docHTML: docs[word] && docs[word].text ? '<div style="width:300px;white-space: normal;">' + docs[word].text + '</div>' : 0
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
