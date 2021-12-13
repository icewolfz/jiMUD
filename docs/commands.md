# Commands

## **Display**

[<u>#SH</u>OW](commands/SHOW.md) text
>Process text as if it came from the MUD and append a new line

[<u>#SHOWP</u>ROMPT](commands/SHOWPROMPT.md) text
>Process text as if it came from the MUD

[<u>#EC</u>HO](commands/ECHO.md) text
>Display text to the screen and append newline

[<u>#ECHOP</u>ROMPT](commands/ECHOPROMPT.md) text
>Display text to the screen

[<u>#SA</u>Y](commands/SAY.md) text
>Display text to the screen and append newline

[<u>#SAYP</u>ROMPT](commands/SAYPROMPT.md) text
>Display text to the screen

<u>#GA</u>G *number*
>Gag the current or multiple lines of incoming or previous lines, if no arguments gags current line

<u>#UNG</u>AG
>clear previous #gag command settings

<u>#CO</u>LOR *{pattern}* fore,back,bold *profile*
>Color last added line, comma delimited colors, supports raw jiMUD color codes, ansi word values, any valid HTML color name, of ##RRGGBB html format

#CW *{pattern}* fore,back,bold *profile*
>Color all strings matching current trigger pattern, see #color for arguments

#PCOL fore,back,bold *XStart XEnd YStart YEnd*
>Color position, will assume full line if position is not supplied, if XEnd omitted will assume end of line, if xEnd -1 it will assume end of line, if YEnd omitted will assume current line, YStart and YEnd are relative to the current line, 0 current, 1 previous, ...

<u>#HI</u>GHLIGHT *pattern*
>make last line or lined with matching pattern bold or brighter color if already bold, or

## **Conditionals**

#IF {expression} {true-command} *{false-command}*
>if expression is true execute true command, if false and false commands supplied execute them

<u>#CA</u>SE index {command 1}*{command n}*
>return command from list based on the value of index

<u>#SW</u>ITCH (expression) {command} *(expression) {command} ... {else command}*
>execute each expression until one returns true, if none are true and an else command supplied it is executed instead

## **Repeating and Loops**

[#nnn](commands/nnn.md)/[#-nnn](commands/nnn.md) commands
>Repeat commands NNN number of times

<u>#BR</u>EAK
>breaks a loop

<u>#CONT</u>INUE
>skips to the next loop iteration 

<u>#LOO</u>P range {commands}
>Execute the commands a number of times given by the range. range is a min and max value separated by a comma, if max value is omitted it is assumed the single value is the max and 1 is the min value
>>`#loop 5 {#show %i}` will display numbers 1 to 5

<u>#REP</u>EAT expression {commands}
>repeat commands number of times returned by expression
>>`#repeat 5 %i` will display the numbers 1 to 5

## **Sounds**

[<u>#BE</u>EP](commands/BEEP.md)
>Play standard System beep

<u>#STOPS</u>OUND
>Stop the current sound effect

<u>#STOPM</u>USIC
>Stop the current background music

<u>#STOPA</u>LLSOUND
>stop all sound effects and background music

<u>#PLAYS</u>OUND soundfile
>Play a sound effect, to play local files use file://path/file.ext

<u>#PLAYM</u>USIC soundfile
>Play background music, to play local files use file://path/file.ext

#MUSICINFO
>display currently playing background music, current position, and total length

#SOUNDINFO
>display currently playing sound effect, current position, and total length

## **Create/Modify Profile or Items**

[#<u>AL</u>IAS](commands/ALIAS.md) name|index {commands} *profile*
>Create or alter an alias

[#<u>UNA</u>LIAS](commands/UNALIAS.md) name *profile*
>Delete an alias

<u>#PRO</u>FILE name *enable\|disable*
>enable or disable a profile

#PROFILELIST
>display a list of all profiles and current state

<u>#BU</u>TTON name|index
>Cause a button to react as if it was clicked, if index it is the position from top down starting at 0

<u>#BU</u>TTON *name caption* {commands} *{icon} options<sup>2</sup> profile*
>Update or create a button

<u>#UNB</u>UTTON name|index|caption
>remove a button, if index it is the position in order of buttons in profile manager

## **Triggers**

<u>#RAISE</u>EVENT name arguments
>fire a custom event
>>`#raiseevent "test" 1 2 3 "4 5"` will fire an event named test with arguments 1, 2, 3, and 4 5

<u>#RAISEDE</u>LAYED amount name arguments
>fire a custom event with a delay
>>`#raisedelayed 3000 "test" 1 2 3 "4 5"` will fire and event named test with arguments 1, 2, 3, and 4 5 after waiting 3 seconds

<u>#ALA</u>RM *name* {time pattern}<sup>1</sup> {commands} *profile*
>create an alarm trigger

<u>#SUS</u>PEND *name|pattern*
>disable an alarm, id arguments omitted will attempt to suspend last added alarm

<u>#RESU</u>ME *name|pattern*
>enable an alarm, id arguments omitted will attempt to suspend last suspended alarm

<u>#UNT</u>RIGGER {name\|pattern} *profile*
>remove a trigger

<u>#TR</u>IGGER *name* {pattern} *{commands} options<sup>2</sup> profile*
>create or update trigger

<u>#TR</u>IGGER name options<sup>2</sup> *profile*
Update options<sup>2</sup> for a trigger

<u>#EV</u>ENT name {commands} *options<sup>2</sup> profile*
>create or update event

<u>#UNE</u>VENT name *profile*
>Delete an event

## **Miscellaneous**

[<u>#WA</u>IT](commands/WAIT.md) amount
> Pause current block for a number of milliseconds

[<u>#VE</u>RSION](commands/VERSION.md)
>Display current jiMUD version information

<u>#SETS</u>ETTING name value
>alter a setting value see: [Keys and value types](faq.md#setting-keys-value-type-and-default-value)

<u>#GETS</u>ETTING name
>display a setting value, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)

<u>#IDLE</u>TIME
>Display time a command was last sent

<u>#CONNECT</u>TIME
>display time since connected

<u>#NOT</u>IFY title message *{icon}*
>display a notification popup with no sound, use [client.notify](scriptind.md#basic-function-list) to turn off silent option or #playsound

<u>#SHOWCL</u>IENT
>Show client window

<u>#HIDECL</u>IENT
>Hide client window

<u>#TOGGLECL</u>IENT
>Toggle show and hide of client window

<u>#CH</u>AT text
>Send text to chat window and append a new line

<u>#CHATP</u>ROMPT text
>same as #chat but does not append a new line

<u>#WIN</u>DOW name
>Open or show named window, supported names: about, prefs, mapper, editor, profiles, chat, code-editor, help, immortals, history, log-viewer, skills, who

## **Test commands**

Test commands allow you to debug or test features of the client

#TESTLIST
>List all test commands

#TESTCOLORS
>Display a basic ANSI color table

#TESTCOLORSDETAILS
>Display a more detailed ANSI color table

#TESTXTERM
>Display an XTerm test pattern

#TESTMXP
>Test [MXP](https://www.gammon.com.au/mushclient/mxp.htm) support by displaying several [MXP](https://www.gammon.com.au/mushclient/mxp.htm) tags

#TESTMXP2
>Test custom elements

#TESTMXPEXPIRE
>Test [MXP](https://www.gammon.com.au/mushclient/mxp.htm) link expiring

#TESTMXPCOLORS
>Display a full list of all supported [MXP](https://www.gammon.com.au/mushclient/mxp.htm) color names

#TESTMXPELEMENTS
>Test more [MXP](https://www.gammon.com.au/mushclient/mxp.htm) custom elements

#TESTMXPLINES
>Test [MXP](https://www.gammon.com.au/mushclient/mxp.htm) line tagging support

#TESTMAPPER
>Test mapper by generating a test area named `Doc Build Samples Area`, with 3 x 3 room square with different settings set for each room.

#TESTFANSI
>Test [FANSI](http://fansi.org/Index.aspx) support

#TESTURLDETECT
>Test auto url detection by displaying random urls and formats

#TESTXTERMRGB
>Display a more detailed XTerm color pattern

#TESTSIZE
>Test the current width and height of the client in characters by repeating `w` for # of columns as line 0 and displaying the numbers 1 to height - 1

#TESTSPEED
>Test the speed of the client by running the commands `#TestMXPColors`, `#TestMXP`, `#TestColors`, `#TestColorsDetails`, `#TestXTerm`, `#TestXTermRGB` 10 times taking the time it took to parse, then display. After all test have been ran it will display 0 to 9 and each time and an avg time. **Note** this will cause the client to become unresponsive or locked while running this test, either wait til done or close.

#TESTSPEEDFILE file
>Works exactly like #testspeed but will use file argument instead of built in test functions, **Note** file load time can cause test to run longer then total time returned

#TESTSPEEDFILER file
>Works exactly like #TestSpeedFile but will attempt to emulate as if sent from remote mud for processing

#TESTFILE file
>Loads a file, displays it and time to display **Note** this will cause the client to become unresponsive or locked while running this test, either wait til done or close.

#TESTPERIOD
>Toggle on/off a test that will alternate between #testcolors, #textxterm, #testlist every 2 seconds to simulate constant streaming of text

#TESTUNICODEEMOJI
>Display emoji unicode symbols

**Note:** All italic arguments are optional and can be left out

## Arguments

Explain what each argument does and if it is optional

|Argument|Optional||
|---|---|---|
|text|| Text to display or process by a command
|amount||The amount of milliseconds to wait, must be greater then 0
|name|Sometimes| The name for an item or [setting](faq.md#setting-keys-value-type-and-default-value)
|index|| an index of an item from 0 to max items - 1
|{commands}|| Commands to set for command, the {} are required and will be stripped when processed
|options|Yes|comma delimited list of options to set<sup>2</sup>
|profile|Yes| Which profile to search
|value|| the value to set for a command, if toggle will and boolean type it will toggle between true and false
|enable|Yes|send enable to command, if left off will toggle
|disable|Yes|send disable to command, if left off will toggle
|soundfile||A sound file from the mud or a full url to a sound file, **Note:** due to security checks some sites may not allow access to files from other sites.
|title|| the text to display for title, quote text to include spaces
|message|| the text to display as message
|arguments|| Space delimited format grouped based on [scripting quote preference](preferences.md#scripting)
|number|Yes| if >= 0 it will gag current line and that number of incoming lines, if negative it will gag the # of lines before current line
|{time pattern}||A valid time pattern <sup>1</sup>
|{pattern}|Sometimes| A valid trigger pattern
|caption|the caption to display when mouse hovers over button
|{icon}|Yes|a path to an image file, supports {assets} path

**Note** All quoted arguments will be processed based on [scripting quote preference](preferences.md#scripting) when required

1.Alarm time pattern
```
   When using alarm type pattern is in the format of hours:minutes:seconds, where hours and minutes are optional. A asterisk (*) is a wildcard to match any value for that place, if minutes or hours are missing a * is assumed. If pattern is preceded with a minus (-) the connection time is used instead of current time.

    You can also define a temporary, one time alarm if pattern is preceded with a plus (+), the trigger alarm is executed then deleted.

    Hours are defined in 24 hour format of 0 to 23, minutes and seconds are 0 to 59.
    If seconds are > 59 and the only pattern it will be considered the same as adding a wildcard (*) in front of the number.

    Hours, minutes, and seconds can use a special wildcard format of *value which will match when the time MOD is zero, eg: *10 matches 10, 20, ...
```

2.Trigger and event options

- `nocr` disable trigger on newline
- `prompt` enable trigger on prompt
- `case` enable case sensitive
- `verbatim` enable verbatim
- `disable` disable trigger
- `enable` enable trigger
- `temporary` temporary trigger
- `cmd` command input trigger, invalid for events
- `priority=#` set the priority of trigger
- `raw` raw trigger, invalid for events
