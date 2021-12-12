# Commands

|Command|Short|Arguments||Example|
|---|---|---|---|---
|#nnn||commands|repeat commands NNN number of times|`#5 %i` will display the numbers 0 to 4
|#-nnn||commands|repeat commands NNN number of times but with a reverse counter|`#5 %i` will display the numbers 4 to 0
|#beep||| play standard system beep
|#version|#ver||display version information
|#show|#sh|text|process text as if it came from the mud and append a new line
|#showprompt|#showp|text|same as show but does not append new line
|#echo|#ec|text|display text to the screen and append newline
|#echoprompt|#echop|text|same as echo but does not append new line
|#say||text|same as echo
|#sayprompt|#sayp|text|same as echoprompt
|#wait|#wa|amount|pause current block for number of milliseconds
|#alias|#al|<nobr>name {commands} *profile*</nobr>|create or alter an alias
|#alias|#al|<nobr>index {commands} *profile*</nobr>|create or alter an alias
|#unalias|#una|name *profile*|delete an alias
|#setsetting|#sets|name value|alter a setting value see: [Keys and value types](faq.md#setting-keys-value-type-and-default-value)
|#getsetting|#gets|name|display a setting value, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)
|#profile|#pro|name *enable\|disable*|enable or disable a profile
|#profilelist|||display a list of all profiles and current state
|#stopsound|#stops||Stop the current sound effect
|#stopmusic|#stopm||Stop the current background music
|#stopallsound|#stopa||stop all sound effects and background music
|#playsound|#plays|soundfile|Play a sound effect, to play local files use file://path/file.ext
|#playmusic|#playm|soundfile|Play background music, to play local files use file://path/file.ext
|#musiciinfo|||display currently playing background music, current position, and total length
|#soundinfo|||display currently playing sound effect, current position, and total length
|#idletime|#idle||Display time a command was last sent
|#connecttime|#connect||display time since connected
|#notify|#not|title message *{icon}*|display a notification popup with no sound, use [client.notify](scriptind.md#basic-function-list) to turn off silent option or #playsound
|#raiseevent|#raise|name arguments|fire a custom event|`#raiseevent "test" 1 2 3 "4 5"` will fire an event named test with arguments 1, 2, 3, and 4 5
|#raisedelayed|#raisede|amount name arguments|fire a custom event with a delay|`#raisedelayed 3000 "test" 1 2 3 "4 5"` will fire and event named test with arguments 1, 2, 3, and 4 5 after waiting 3 seconds
|#showclient|#showcl||Show client window
|#hideclient|#hidecl||Hide client window
|#toggleclient|#togglecl||Toggle show and hide of client window
|#gag|#ga|*number*|gag the current or multiple lines of incoming or previous lines, if no arguments gags current line
|#ungag|#ung||clear previous #gag command settings
|#alarm|#ala| <nobr>*name* {time pattern}<sup>1</sup> {commands} *profile*</nobr>|create an alarm trigger
|#suspend|#sus|*name\|pattern*|disable an alarm, id arguments omitted will attempt to suspend last added alarm
|#resume|#resu|*name\|pattern*|enable an alarm, id arguments omitted will attempt to suspend last suspended alarm
|#untrigger|#unt|{name\|pattern} *profile*|remove a trigger
|#chat|#ch|text|Send text to chat window and append a new line
|#chatprompt|#chatp|text|same as #chat but does not append a new line
|#trigger|#tr|*name* {pattern} *{commands} options<sup>2</sup> profile*|create or update trigger
|#trigger|#tr| name options<sup>2</sup> *profile*|Update options<sup>2</sup> for a trigger
|#event|#ev|name {commands} *options<sup>2</sup> profile*|create or update event
|#unevent|#une|name *profile*|Delete an event
|#button|#bu|name\|index|Cause a button to react as if it was clicked, if index it is the position from top down starting at 0
|#button|#bu|*name caption* {commands} *{icon} options<sup>2</sup> profile*|Update or create a button
|#unbutton|#unb|name\|index\|caption| remove a button, if index it is the position in order of buttons in profile manager
|#window|#win|name|Open or show named window, supported names: about, prefs, mapper, editor, profiles, chat, code-editor, help, immortals, history, log-viewer, skills, who
|#color|#co|*{pattern}* fore,back,bold *profile*|Color last added line, comma delimited colors, supports raw jiMUD color codes, ansi word values, any valid HTML color name, of ##RRGGBB html format
|#cw||*{pattern}* fore,back,bold *profile*|Color all strings matching current trigger pattern, see #color for arguments
|#pcol||fore,back,bold *XStart XEnd YStart YEnd*|Color position, will assume full line if position is not supplied, if XEnd omitted will assume end of line, if xEnd -1 it will assume end of line, if YEnd omitted will assume current line, YStart and YEnd are relative to the current line, 0 current, 1 previous, ...
|#highlight|#hi|*pattern*| make last line or lined with matching pattern bold or brighter color if already bold, or
|#break|#br|| breaks a loop
|#continue|#con|| skips to the next loop iteration 
|#if||{expression} {true-command} *{false-command}*| if expression is true execute true command, if false and false commands supplied execute them
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

## Test commands

Test commands allow you to debug or test features of the client

|Command||
|---|---|
|#TestList|List all test commands
|#TestColors|Display a basic ANSI color table
|#TestColorsDetails|Display a more detailed ANSI color table
|#TestXTerm|Display an XTerm test pattern
|#TestMXP|Test [MXP](https://www.gammon.com.au/mushclient/mxp.htm) support by displaying several [MXP](https://www.gammon.com.au/mushclient/mxp.htm) tags
|#TestMXP2|Test custom elements
|#TestMXPExpire|Test [MXP](https://www.gammon.com.au/mushclient/mxp.htm) link expiring
|#TestMXPColors|Display a full list of all supported [MXP](https://www.gammon.com.au/mushclient/mxp.htm) color names
|#TestMXPElements|Test more [MXP](https://www.gammon.com.au/mushclient/mxp.htm) custom elements
|#TestMXPLines|Test [MXP](https://www.gammon.com.au/mushclient/mxp.htm) line tagging support
|#TestMapper|Test mapper by generating a test area named `Doc Build Samples Area`, with 3 x 3 room square with different settings set for each room.
|#TestFANSI|Test [FANSI](http://fansi.org/Index.aspx) support
|#TestURLDetect|Test auto url detection by displaying random urls and formats
|#TestXTermRGB|Display a more detailed XTerm color pattern
|#TestSize|Test the current width and height of the client in characters by repeating `w` for # of columns as line 0 and displaying the numbers 1 to height - 1
|#TestSpeed|Test the speed of the client by running the commands `#TestMXPColors`, `#TestMXP`, `#TestColors`, `#TestColorsDetails`, `#TestXTerm`, `#TestXTermRGB` 10 times taking the time it took to parse, then display. After all test have been ran it will display 0 to 9 and each time and an avg time. **Note** this will cause the client to become unresponsive or locked while running this test, either wait til done or close.
|#TestSpeedFile file|Works exactly like #testspeed but will use file argument instead of built in test functions, **Note** file load time can cause test to run longer then total time returned
|#TestSpeedFiler file|Works exactly like #TestSpeedFile but will attempt to emulate as if sent from remote mud for processing
|#TestFile file|Loads a file, displays it and time to display **Note** this will cause the client to become unresponsive or locked while running this test, either wait til done or close.
|#TestPeriod|Toggle on/off a test that will alternate between #testcolors, #textxterm, #testlist every 2 seconds to simulate constant streaming of text
|#TestUnicodeEmoji|Display emoji unicode symbols
