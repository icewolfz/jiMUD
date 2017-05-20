
# FAQ
## I am having trouble with the client, what do I do?
You should always make sure you have the latest version.
If you are getting garbled or missing text try disabling MCCP, MXP, or UTF-8 in the [Telnet settings](preferences.md#telnet) then disconnect and reconnect, if still happens try reinstalling or opening an issue.
## I am getting 'TypeError - some message. ', what does it mean?
This means there is an error, most of the time the error is from a broken profile item with bad or invalid javascript.        
## If your question is not listed:
Open an issue about it or log on to [ShadowMUD](http://www,shadowmud.com) using the jiMUD or the [ShadowMUD web client](http://www,shadowmud.com/mud.php)
## What predefined variables can be use for paths
* `{home}` User's home directory.
* `{path}` The current application directory.
* `{appData}` Per-user application data directory, which by default points to:
  * `%APPDATA%` on Windows
  * `$XDG_CONFIG_HOME` or `~/.config` on Linux
  * `~/Library/Application Support` on macOS
* `{data}` The directory for storing jiMUD's configuration files is `{appData}\jiMUD`
* `{temp}` Temporary directory.
* `{desktop}` The current user's Desktop directory.
* `{documents}` Directory for a user's "My Documents".
* `{downloads}` Directory for a user's downloads.
* `{music}` Directory for a user's music.
* `{pictures}` Directory for a user's pictures.
* `{videos}` Directory for a user's videos.
* `{assets}` Directory for accessing client assets, ***Read only***
## Setting keys, value type and default value
Setting                     | Type    | Default
----------------------------|---------|-------------
bufferSize                  | integer | 5000
commandDelay                | integer | 500
commandDelayCount           | integer | 5
commandHistorySize          | integer | 20
fontSize                    | string  | 1em
cmdfontSize                 | string  | 1em
commandEcho                 | boolean | true
flashing                    | boolean | false
autoConnect                 | boolean | true
showScriptErrors            | boolean | false
commandStacking             | boolean | true
commandStackingChar         | string  | ;
keepLastCommand             | boolean | true
enableMCCP                  | boolean | true
enableUTF8                  | boolean | true
font                        | string  | Courier New
cmdfont                     | string  | Courier New
mapFollow                   | boolean | true
mapEnabled                  | boolean | true
fullScreen                  | boolean | false
enableMXP                   | boolean | true
enableMSP                   | boolean | true
notifyMSPPlay               | boolean | false
parseCommands               | boolean | true
lagMeter                    | boolean | false
enablePing                  | boolean | false
enableEcho                  | boolean | true
enableSpeedpaths            | boolean | true
speedpathsChar              | string  | !
parseSpeedpaths             | boolean | true
parseSingleQuotes           | boolean | false
parseDoubleQuotes           | boolean | true
CommandonClick              | boolean | true
AutoCopySelectedToClipboard | boolean | false