# Commands
- `#beep` play standard system beep
- `#version` or `#ver`
show version information
- `#show text` or `#sh`
process text as if it came from the mud and appends a newline
- `#showprompt text` or `#showp`
same show but does not append a newline
- `#echo text` or `#ec`
display text to the screen
- `#echoprompt text` or `#echop`
same as echo but doesn't append newline
- `#say text`
same as echo
- `#sayprompt text` or `#sayp`
same as echoprompt
- `#alias name value` or `#al`
create or alter and alias from command line
  - name argument can be wither a quoted string, a number or a string
    - quoted string - if a quoted string the quotes are removed and all text between are used as the alias name
    - number - if a number it access the aliases as an array instead of by name, it is 0 to aliases count - 1,
    - string - works like quoted string but allows no spaces
  - value argument can be any text
    - quoted string - quotes are removed and this is set as value
    - text - all text quoted or unquoted is set as value
- `#unalias name` or `#una`
delete an alias from command line
  - name argument is the same as #alias
- `#setsetting name value` or `#sets`
alter a setting from command line, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)
  - name argument is the same as #alias
  - value same as #alias`
    - toggle - if type is boolean this special value allows you toggle the setting the opposite of the current value.
- `#getsetting name` or `#gets`
display a setting value from command line, [Keys and value types](faq.md#setting-keys-value-type-and-default-value)
  - name argument is the same as #alias, if name is all it will list all settings and current value
- `#profile name enable/disable` or `#pro`
enable or disable a profile
  - name - the name of the profile to enable or disable
  - enable/disable - optional state to turn profile to, if left off it will toggle profile state
- `#profilelist`
display a list of all profiles and current state
- `#stopsound` or `#stops`
stop the current sound effect
- `#stopmusic` or `#stopm`
stop the current background music
- `#stopallsound` or `#stopa`
stop all sound effects and background music
- `#playsound soundfile` or `#plays`
play a sound effect, argument is local sound file for server or a full url to a sound file, **Note:** due to security checks some sites may not allow access to files from other sites.
- `#playmusic soundfile` or `#playm`
play a sound effect, argument is local sound file for server or a full url to a sound file, **Note:** due to security checks some sites may not allow access to files from other sites.
- `#musicinfo`
display currently playing music, current position, and total length
- `#soundinfo`
display currently playing sound, current position, and total length
- `#idletime` or `#idle`
display time send a command was last sent to the mud
- `#connecttime` or `#connect`
display time since connected
- `#notify 'title' message` or `#not`
display a notification window
  - `title` the title of the notification, if more then one word it must be in single quotes
  - `message` the main message of the notification, this is optional
- `#event 'name' arguments` or `#eve` 
fire a custom event, arguments is a space or comma delimited format supported with quoted grouping
  - Example: `#event 'test' 1 2 3 '4 5'` will fire and event named test with arguments 1, 2, 3, and 4 5
- `#showclient` or `#showcl`
show client
- `#hideclient` or `#hidecl`
hide client
- `#toggleclient` or `#togglecl`
toggle show and hide client