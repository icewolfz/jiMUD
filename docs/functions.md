# Functions and predefined variables

Functions and variables allow a user to manipulate text and data with out having to use full scripting abilities and is only available from the command line or when an alias, macro, context, button, or trigger are set to the parse style.

All functions and variables use the \${function/variable} or %{function/variable} syntax for easy embedding into other text for example, `Rolled: ${dice(2d5)}` would roll 2 five sided dice and return Rolled: #. You may also nest functions and variables inside of each other: `${dice(${i}d6)}` would roll the # of i dice

There is a special format for argument variables for aliases and triggers.

- `%#`, `%{#}`, or `${#}` allows you to access arguments for alias and triggers, where # is the argument you want, while 0 is the full text
- `%x#`, `%{x#}`, or `${x#}` allows you to access arguments' start and end indexes for triggers, where # is the argument indexes you want, while 0 is the full text indexes in format of START END
- `%*`, `%{*}`, or `${*}` returns the full text minus alias name or matched text for triggers
- `$name`, `${name}`, or `%{name}` is for aliased [parameters](profiles.md#aliases), this allow you to name arguments for easier understanding, where name is from the alias parameter list
- `%%` allows you to escape a %, can be disabled setting [Disable double parameter escaping](preferences.md#scripting)
- `\%` using the [set escape character](preferences.md#scripting--special-characters), default `\`

[Repeat command `#nnn`](commands.md) special format to get loop iteration

- `%i..%z`  return loop iteration and nested loop, supports %i,#{i},${i}, each nested loop gets its own %letter
  - Example: #5 #10 %i %j would display 0 0..0 9, 1 0..1 9, ... 4 0..4 9
- `%repeatnum` return current loop iteration, supports #{repeatnum}/${repeatnum} only

Expressions, [when enabled](preferences.md#scripting) or using eval(), are basic math or supported math functions supported by [Mathjs](http://mathjs.org/) which include all the standard javascript Math functions, the i and repeatnum variables You may also embed \${} variables and functions as well for example: \${5+5} will return 10 or \${5 + i} will return 5 + what ever the current value of i is, \${5 + \${dice(2d10)}} will return 5 + a 2, 10 sided dice rolls noticed how it requires the ${} as dice is a jiMUD functions not a math function.

**Note** expressions only work with numbers, math symbols, predefined constants, or ${} functions

Escaping allows you to prevent special characters from being parsed and allow them to be used as normal, characters that are escaped are $%"'{, command character, escape character, speedpath character, verbatim character. For example: \${copied} would return as ${copied} as the \ prevents the \$ from being parsed as variable or function, note how you do not have to escape the { as it is not required as the $ is not processed so { will be read as a normal character.

## Predefined variables

- `selected` selected text
- `selectedword` word under mouse when right clicked
- `selectedline` line under mouse when right clicked
- `selectedurl` url under mouse when right clicked
- `selword` same as $selectedword
- `selline` same as $selline
- `selurl` same as $selectedurl
- `copied` return clipboard text
- `character` return current character name from GMCP, falls back to character manager login name, or empty string
- `selected`, `selectedword`, `selectedline`, `selectedurl`, `selword`, `selline`, `selurl`, `character`, or `copied` allow the following post fixes:
  - `.lower` force to all lower case by appending .lower
  - `.upper` force to all upper case by appending .lower
  - `.proper` force to proper casing by appending .proper
- `repeatnum` returns the current index during [#nnn](commands.md#repeating-and-loops) or string from [#FORALL](commands.md#repeating-and-loops)
- `i..z` return the index based on the nested order from outer to inner loops
- `cr` replace with carriage return
- `esc` escape character, useful for creating ansi color codes
- `lf` replace with line feed
- `crlf` replace with carriage return and linefeed
- `expression` evaluate the math expression and return the results when [allow evaluate is enabled](preferences.md#scripting)
- `random` a random number between 0 and 99

## User variables

You can create custom variables using the expression system and the assignment operator (=) to assign or update the value.  These variables can be accessed in scripting using client.variables.NAME, client.variables['NAME'], this.variables.NAME, this.variables['NAME'] as needed, any changes there will be reflected in the expression system. The variables i and repeatnum should never be used as they are dynamic and replaced as needed by the scope level for looping and repeating systems in the command parser. **variables lost when client is closed**

**Warning** Named arguments will replace variables of the same name in current scope level, meaning any values set to them will be lost once finished as named variables are alias scope and will override global variables of the same name.

## Functions

### **Math**

- `bitand(number1,number2)` returns the bitwise AND of the two numbers. 
- `bitnot(number)` returns the bitwise inverse of the given number.
- `bitor(number1,number2)` returns the bitwise OR of the two numbers. 
- `bitset(i,bitnum,value)` Set or reset a bit within a numeric value and return the new numeric value. If value is omitted, 1 (true) is used to set the bit. To reset a bit, the value must be zero. 
- `bitshift(value,number)` shifts the value the num bits to the left. If num is negative, then the value is shifted to the right. 
- `bittest(i,bitnum)` Test a bit within a numeric value and return true if it is set, false if it is not set. bitnum starts at 1. 
- `bitxor(number1,number2)` returns the bitwise XOR of the two numbers.
- `eval(expression)` evaluate the expression and return the results, a long version of `expression`
- `dice(xdy+n)` roll a dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
- `diceavg(xdy+n)` the avg roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
- `dicemin(xdy+n)` the minimum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
- `dicemax(xdy+n)` the maximum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
- `dicedev(xdy+n)` return standard deviation of dice `sqrt((y^2 - 1) / 12 * x)`, x is the # of dice, y is the # of sides, with optional +, -, *, / modifier
- `zdicedev(xdy+n)` return zMUD/cMUD standard deviation of dice `sqrt(((y - 1)^2 - 1) / 12 * x)`, x is the # of dice, y is the # of sides, with optional +, -, *, / modifier
- `random(i,j)` return a random number between i and j, if j omitted, i is then considered the maximum and will return a number between 0 and i
- `number(s)` convert a numeric string to a number. 
- `isfloat(value)` Returns true if value is a valid floating point number
- `isnumber(s)` true if s represents a valid number. 
- `string(value)` converts value to a string. Quotes are added around the value.
- `float(value)` Returns value as a floating point number.

### **Conditionals**

- `case(n,value1,value2,value3...)` return the nth value of arguments, from 1 to last argument
- `switch(expression1,value1,...expressionN,valueN)` return value of the first expression that evaluates to true
- `if(expression,true-value,false-value)` evaluate expression and return true or false value

### **String**

- `lower(TEXT)` force TEXT into lower case, for example \${lower(\${selword})} is the same as ${selword.lower}
- `upper(TEXT)` force TEXT into upper case
- `proper(TEXT)` force TEXT into proper casing
- `char(i)` return ASCII character for i
- `ascii(string)` return the ascii value for first letter in string
- `begins(string1,string2)` return true if string 1 starts with string 2
- `ends(string1, string2)` returns true if string 1 ends with string 2
- `len(string)` returns the length of string
- `pos(pattern,string)` returns the position of pattern in string on 1 index scale, 0 if not found
- `ipos(pattern,string)` returns the position of pattern in string on 1 index scale, 0 if not found ignoring case
- `regex(string,regex,var1,...,varN,varN+1)` test if string matches the regex pattern, if found returns the position of the match, starting at 1 else returns 0, var1 ... varN are optional variable names to store any sub pattern matches, varN+1 is the length of matched string. **Note** the regex argument is not parsed and passed as is due to the complexity of regex formats
- `trim(string)` Returns the string without any spaces at the beginning or end
- `trimleft(string)` Returns the string without any spaces at the beginning
- `trimright(string)` Returns the string without any spaces at the end

### **Miscellaneous**
- `time(format)` display current time in format, if format omitted displays YYYY-MM-DDTHH:mm:ss[Z]
  - `YYYY` 4 or 2 digit year
  - `YY` 2 digit year
  - `Y` Year with any number of digits and sign
  - `Q` Quarter of year. Sets month to first month in quarter.
  - `M MM` Month number
  - `MMM MMMM` Month name in locale set by moment.locale()
  - `D DD` Day of month
  - `Do` Day of month with ordinal
  - `DDD DDDD` Day of year
  - `X` Unix timestamp
  - `x` Unix ms timestamp
- `color(fore,back,bold)` returns color code in string format of fore,back or just fore
  - `fore` the foreground color or bold, if bold it returns bold white
  - `back` the background color, if bold returns bold fore
  - `bold` ansi bold color, if bold returns bold fore
  - Colors: red, blue, orange, yellow, green, black, white, cyan, magenta, gray
- `zcolor(code)` converts a zmud/cmud color code into a code supported by jiMUD
  - Example: ${zcolor(1)} would return 370 for bold white
- `ansi(style,fore,back)` insert ansi control characters into string same as ${esc}[CODESm
    - `style` the styles to apply, *optional*
        - reset - reset all styles and colors
        - bold,faint,italic,underline,blink,reverse,hidden,strikethrough,doubleunderline,boldoff,italicoff,blinkoff,blinkrapidoff,visible,strikethroughoff
    - `fore` the ground color, if bold and a valid colored bold is considered the foreground color, may also be default
    - `back` the background color, may be default *optional*
    - jiMUD custom colors: localecho, infotext, infobackground, errortext
    - Colors: red, blue, orange, yellow, green, black, white, cyan, magenta, gray
      - prepend with x for aixterm bright colors
      - append background to get background code directly
      - eg redbackground to get red background, xred to get aixterm red or xredbackground to get aixterm red background
- `isdefined(name)` Returns 1 if a variable is defined, 0 if undefined
