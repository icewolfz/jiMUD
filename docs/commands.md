# Commands

- `#nnn commands` repeat commands NNN number of times
  - `commands` the commands you want repeated
- `#beep` play standard system beep
- `#version` or `#ver` show version information
- `#show text` or `#sh` process text as if it came from the mud and appends a newline
- `#showprompt text` or `#showp` same show but does not append a newline
- `#echo text` or `#ec` display text to the screen
- `#echoprompt text` or `#echop` same as echo but doesn't append newline
- `#say text` same as echo
- `#wait amount` or `#wa` pause current block for number of milliseconds
  - `amount` the amount of milliseconds to wait before executing remaining commands command block, must be greater then 0
- `#sayprompt text` or `#sayp` same as echoprompt
- `#alias name value` or `#al` create or alter and alias from command line
  - name argument can be either a quoted string, a number or a string
    - quoted string - if a quoted string the quotes are removed and all text between are used as the alias name
    - number - if a number it access the aliases as an array instead of by name, it is 0 to aliases count - 1,
    - string - works like quoted string but allows no spaces
  - value argument can be any text
    - quoted string - quotes are removed and this is set as value
    - text - all text quoted or unquoted is set as value
- `#unalias name` or `#una` delete an alias from command line
  - name argument is the same as #alias
- `#setsetting name value` or `#sets` alter a setting from command line, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)
  - name argument is the same as #alias
  - value same as #alias`
    - toggle - if type is boolean this special value allows you toggle the setting the opposite of the current value.
- `#getsetting name` or `#gets` display a setting value from command line, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)
  - name argument is the same as #alias, if name is all it will list all settings and current value
- `#profile name enable/disable` or `#pro` enable or disable a profile
  - name - the name of the profile to enable or disable
  - enable/disable - optional state to turn profile to, if left off it will toggle profile state
- `#profilelist` display a list of all profiles and current state
- `#stopsound` or `#stops` stop the current sound effect
- `#stopmusic` or `#stopm` stop the current background music
- `#stopallsound` or `#stopa` stop all sound effects and background music
- `#playsound soundfile` or `#plays` play a sound effect, argument is local sound file for server or a full url to a sound file, **Note:** due to security checks some sites may not allow access to files from other sites.
- `#playmusic soundfile` or `#playm` play a sound effect, argument is local sound file for server or a full url to a sound file, **Note:** due to security checks some sites may not allow access to files from other sites.
- `#musicinfo` display currently playing music, current position, and total length
- `#soundinfo` display currently playing sound, current position, and total length
- `#idletime` or `#idle` display time send a command was last sent to the mud
- `#connecttime` or `#connect` display time since connected
- `#notify 'title' message` or `#not` display a notification window
  - `title` the title of the notification, if more then one word it must be in single quotes
  - `message` the main message of the notification, this is optional
- `#raiseevent "name" arguments` or `#raise` fire a custom event, arguments is a space delimited format supported with quoted grouping
  - Example: `#raiseevent "test" 1 2 3 "4 5"` will fire an event named test with arguments 1, 2, 3, and 4 5
- `#raisedelayed milliseconds "name" arguments` or `#raisede` fire a custom event with a delay, arguments is a space delimited format supported with quoted grouping
  - Example: `#raisedelayed 3000 "test" 1 2 3 "4 5"` will fire and event named test with arguments 1, 2, 3, and 4 5 after waiting 3 seconds
- `#showclient` or `#showcl` show client
- `#hideclient` or `#hidecl` hide client
- `#toggleclient` or `#togglecl` toggle show and hide client
- `#gag number` or `#ga` gag the current or multiple lines of incoming or previous lines, if no arguments gags current line
  - `number` if >= 0 it will gag current line and that number of incoming lines, if negative it will gag the # of lines before current line
- `#ungag` or `#ung` clear previous #gag command settings
- `#alarm name {timepattern} {commands} profile`, `#ala name {timepattern} {commands} profile`, `#alarm {timepattern} {commands} profile`, or `#ala {timepattern} {commands} profile` create an alarm trigger
  - `name` is an optional and when used will update the first matching timer found with name or create a new one
  time
  - `{timepattern}` the time pattern to match
    ```
    When using alarm type pattern is in the format of hours:minutes:seconds, where hours and minutes are optional. A asterisk (*) is a wildcard to match any value for that place, if minutes or hours are missing a * is assumed. If pattern is preceded with a minus (-) the connection time is used instead of current time.

    You can also define a temporary, one time alarm if pattern is preceded with a plus (+), the trigger alarm is executed then deleted.

    Hours are defined in 24 hour format of 0 to 23, minutes and seconds are 0 to 59.

    Hours, minutes, and seconds can use a special wildcard format of *value which will match when the time MOD is zero, eg: *10 matches 10, 20, ...
    ```
  - `{commands}` the commands to be executed for alarm
  - `profile` is optional and when set will create alarm in that profile, if profile not found fails to create

## Test commands

Test commands allow you to debug or test features of the client

- `#TestList` List all test commands
- `#TestColors` Display a basic ANSI color table
- `#TestColorsDetails` Display a more detailed ANSI color table
- `#TestXTerm` Display an XTerm test pattern
- `#TestMXP` Test [MXP](https://www.gammon.com.au/mushclient/mxp.htm) support by displaying several [MXP](https://www.gammon.com.au/mushclient/mxp.htm) tags
- `#TestMXP2` Test custom elements
- `#TestMXPExpire` Test [MXP](https://www.gammon.com.au/mushclient/mxp.htm) link expiring
- `#TestMXPColors` Display a full list of all supported [MXP](https://www.gammon.com.au/mushclient/mxp.htm) color names
- `#TestMXPElements` Test more [MXP](https://www.gammon.com.au/mushclient/mxp.htm) custom elements
- `#TestMXPLines` Test [MXP](https://www.gammon.com.au/mushclient/mxp.htm) line tagging support
- `#TestMapper` Test mapper by generating a test area named `Doc Build Samples Area`, with 3 x 3 room square with different settings set for each room.
- `#TestFANSI` Test [FANSI](http://fansi.org/Index.aspx) support
- `#TestURLDetect` Test auto url detection by displaying random urls and formats
- `#TestXTermRGB` Display a more detailed XTerm color pattern
- `#TestSize` Test the current width and height of the client in characters by repeating `w` for # of columns as line 0 and displaying the numbers 1 to height - 1
- `#TestSpeed` Test the speed of the client by running the commands #TestMXPColors, #TestMXP, #TestColors, #TestColorsDetails, #TestXTerm, #TestXTermRGB 10 times taking the time it took to parse, then display. After all test have been ran it will display 0 to 9 and each time and an avg time. **Note** this will cause the client to become unresponsive or locked while running this test, either wait til done or close.