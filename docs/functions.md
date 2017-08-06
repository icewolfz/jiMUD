# Functions and predefined variables

Functions and variables allow a user to manipulate text and data with out having to use full scripting abilities and is only available from the command line or when an alias, macro, context, button, or trigger are set to the parse style.

All functions and variables use the ${function/variable} or %{function/variable} syntax for easy embedding into other text for example, `Rolled: ${dice(2d5)}` would roll 2 five sided dice and return Rolled: #. You may also nest functions and variables inside of each other: `${dice(${i}d6)}` would roll the # of i dice

There is a special format for argument variables for aliases and triggers. 
- `%#`, `%{#}`, or `${#}` allows you to access arguments for alias and triggers, where # is the argument you want, while 0 is the full text
- `%*`, `%{*}`, or `${*}` returns the full text minus alias name or matched text for triggers
- `$name`, `%name`, `${name}`, or `%{name}` is for aliased [parameters](profiles.md#aliases), this allow yous to name arguments for easier understanding, where name is from the alias parameter list

[Repeat command `#nnn`](commands.md) special format for i/repeatnum
- `%i`. `%repeatnum` a more simple version of i/repeatnum or use the normal ${}/%{} forms

Expressions, [when enabled](preferences.md#scripting) or using eval(), are basic math or supported math functions supported by [Mathjs](http://mathjs.org/) which include all the standard javascript Math functions, the i and repeatnum variables You may also embed ${} variables and functions as well for example: ${5+5} will return 10 or ${5 + i} will return 5 + what ever the current value of i is, ${5 + ${dice(2d10)}} will return 5 + a 2, 10 sided dice rolls noticed how it requires the ${} as dice is a jiMUD functions not a math function.

**Note** expressions only work with numbers, math symbols, predefined constants, or ${} functions

Escaping allows you to prevent special characters from being parsed and allow them to be used as normal, characters that are escaped are $%"'{, command character, escape character, speedpath character, verbatim character. For example: \${copied} would return as ${copied} as the \ prevents the $ from being parsed as variable or function, note how you do not have to escape the { as it is not required as the $ is not processed so { will be read as a normal character.

## Predefined variables

- `selected` - selected text
- `selectedword` - word under mouse when right clicked
- `selectedline` - line under mouse when right clicked
- `selectedurl` - url under mouse when right clicked
- `selword` same as $selectedword
- `selline` sane as $selline
- `selurl` same as $selected url
- `copied` return clipboard text
- `selected`, `selectedword`, `selectedline`, `selectedurl`, `selword`, `selline`, `selurl`, or `copied` allow the following post fixes:
  - `.lower` - force to all lower case by appending .lower
  - `.upper` - force to all upper case by appending .lower
  - `.proper` - force to proper casing by appending .proper
- `repeatnum` - returns the current index during #nnn
- `i` - same as repeatnum
- `cr` - replace with carriage return
- `lf` - replace with line feed
- `crlf` - replace with carriage return and linefeed
- `expression` - evaluate the math expression and return the results when [allow evaluate is enabled](preferences.md#scripting)

## Functions

- `lower(TEXT)` - force TEXT into lower case, for example ${lower(${selword})} is the same as ${selword.lower}
- `upper(TEXT)` - force TEXT into upper case
- `proper(TEXT)` - force TEXT into proper casing
- `eval(expression)` - evaluate the expression and return the results, a long version of `expression`
- `dice(xdy+n)` - roll a dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
- `diceavg(xdy+n)` the avg roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
- `dicemin(xdy+n)` the minimum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
- `dicemax(xdy+n)` the maximum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
- `dicedev(xdy+n)` return standard deviation of dice sqrt((y^2-1)/12 * x), x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
- `zdicedev(xdy+n)` return zMUD/cMUD standard deviation of dice sqrt(((y-1)^2-1)/12 * x), x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier