
# FAQ

## I am having trouble with the client, what do I do?

You should always make sure you have the latest version.
If you are getting garbled or missing text try disabling MCCP, MXP, or UTF-8 in the [Telnet settings](preferences.md#telnet) then disconnect and reconnect, if still happens try reinstalling or opening an issue.

## I am getting 'TypeError - some message. ', what does it mean?

This means there is an error, most of the time the error is from a broken profile item with bad or invalid javascript.

## A window is not shown?

This means there is a chance the window is being opened off screen due to change in desktop resolution, using backups from a different computer with different screen sizes, or similar issues, if this happens you can clear all window states in the preferences byu clicking the 'Reset Windows' to clear all window states when the settings are saved. If you have used backup system from the mud there is also an [advanced setting](preferences.md#Advanced) to ignore saving window states. Lastly you can manually edit the settings file window state data to adjust the window data, this has to be down when jiMUD is not loaded or it will just override the data with new state data, settings.json file is found in app data folder/jiMUD or appdata/jiMUD/characters/NAME.settings file if using character manager

## If your question is not listed

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

Setting                           | Type    | Default
----------------------------------|---------|-----------------------------------
bufferSize                        | integer | 5000
commandDelay                      | integer | 500
commandDelayCount                 | integer | 5
commandHistorySize                | integer | 20
fontSize                          | string  | 1em
cmdfontSize                       | string  | 1em
commandEcho                       | boolean | true
flashing                          | boolean | false
autoConnect                       | boolean | true
enableAliases                     | boolean | true
enableTriggers                    | boolean | true
enableMacros                      | boolean | true
showScriptErrors                  | boolean | false
commandStacking                   | boolean | true
commandStackingChar               | string  | ;
htmlLog                           | boolean | true
keepLastCommand                   | boolean | true
enableMCCP                        | boolean | true
enableUTF8                        | boolean | true
font                              | string  | 'Courier New', Courier, monospace
cmdfont                           | string  | 'Courier New', Courier, monospace
mapFollow                         | boolean | true
mapEnabled                        | boolean | true
MapperSplitArea                   | boolean | false
MapperFillWalls                   | boolean | false
MapperOpen                        | boolean | false
fullScreen                        | string  | false
enableMXP                         | boolean | true
enableMSP                         | boolean | true
parseCommands                     | string  | true
lagMeter                          | boolean | false
enablePing                        | boolean | false
enableEcho                        | boolean | true
enableSpeedpaths                  | boolean | true
speedpathsChar                    | string  | !
parseSpeedpaths                   | boolean | true
parseSingleQuotes                 | boolean | false
parseDoubleQuotes                 | boolean | true
logEnabled                        | boolean | false
logPrepend                        | boolean | false
logOffline                        | boolean | false
logUniqueOnConnect                | boolean | true
enableURLDetection                | boolean | true
notifyMSPPlay                     | boolean | false
CommandonClick                    | boolean | true
allowEval                         | boolean | true
allowEscape                       | boolean | true
AutoCopySelectedToClipboard       | boolean | false
enableDebug                       | boolean | false
editorPersistent                  | boolean | false
askonclose                        | boolean | true
dev                               | boolean | false
chat.captureLines                 | boolean | false
chat.captureAllLines              | boolean | false
chat.captureReviews               | boolean | false
chat.captureTells                 | boolean | false
chat.captureTalk                  | boolean | false
chat.gag                          | boolean | false
chat.CaptureOnlyOpen              | boolean | false
checkForUpdates                   | boolean | false
autoCreateCharacter               | boolean | false
askonchildren                     | boolean | true
mapper.legend                     | boolean | false
mapper.room                       | boolean | false
mapper.importType                 | integer | 1
mapper.vscroll                    | integer | 0
mapper.hscroll                    | integer | 0
mapper.scale                      | float   | 1.0
mapper.alwaysOnTop                | boolean | false
mapper.alwaysOnTopClient          | boolean | true
mapper.memory                     | boolean | false
mapper.memorySavePeriod           | integer | 900000
mapper.active.ID                  | string  | null
mapper.active.x                   | integer | 0
mapper.active.y                   | integer | 0
mapper.active.z                   | integer | 0
mapper.active.area                | string  | null
mapper.active.zone                | integer | 0
mapper.persistent                 | boolean | true
profiles.split                    | integer | -1
profiles.askoncancel              | boolean | true
profiles.triggersAdvanced         | boolean | false
profiles.aliasesAdvanced          | boolean | false
profiles.buttonsAdvanced          | boolean | false
profiles.macrosAdvanced           | boolean | false
profiles.contextsAdvanced         | boolean | false
profiles.codeEditor               | boolean | true
profiles.watchFiles               | boolean | true
chat.alwaysOnTop                  | boolean | false
chat.alwaysOnTopClient            | boolean | true
chat.log                          | boolean | false
chat.persistent                   | boolean | false
chat.zoom                         | integer | 1
chat.font                         | string  | 'Courier New', Courier, monospace
chat.fontSize                     | string  | 1em
title                             | string  | $t
logGagged                         | boolean | false
logTimeFormat                     | string  | YYYYMMDD-HHmmss
autoConnectDelay                  | integer | 600
autoLogin                         | boolean | true
onDisconnect                      | integer | 2
enableKeepAlive                   | boolean | false
keepAliveDelay                    | integer | 0
newlineShortcut                   | integer | 1
logWhat                           | integer | 1
logErrors                         | boolean | true
showErrorsExtended                | boolean | false
reportCrashes                     | boolean | false
enableCommands                    | boolean | true
commandChar                       | string  | #
escapeChar                        | string  | \
enableVerbatim                    | boolean | true
verbatimChar                      | string  | `
soundPath                         | string  | {data}\sounds
logPath                           | string  | {data}\logs
theme                             | string  | {themes}\default
gamepads                          | boolean | false
buttons.connect                   | boolean | true
buttons.characters                | boolean | true
buttons.preferences               | boolean | true
buttons.log                       | boolean | true
buttons.clear                     | boolean | true
buttons.lock                      | boolean | true
buttons.map                       | boolean | true
buttons.user                      | boolean | true
buttons.mail                      | boolean | true
buttons.compose                   | boolean | true
buttons.immortal                  | boolean | true
buttons.codeEditor                | boolean | false
find.case                         | boolean | false
find.word                         | boolean | false
find.reverse                      | boolean | false
find.regex                        | boolean | false
find.selection                    | boolean | false
find.show                         | boolean | false
display.split                     | boolean | false
display.splitHeight               | integer | -1
display.splitLive                 | boolean | true
display.roundedOverlays           | boolean | true
backupLoad                        | integer | 14
backupSave                        | integer | 14
backupAllProfiles                 | boolean | true
scrollLocked                      | boolean | false
showStatus                        | boolean | true
showCharacterManager              | boolean | false
showChat                          | boolean | false
showEditor                        | boolean | false
showArmor                         | boolean | false
showStatusWeather                 | boolean | true
showStatusLimbs                   | boolean | true
showStatusHealth                  | boolean | true
showStatusExperience              | boolean | true
showStatusPartyHealth             | boolean | true
showStatusCombatHealth            | boolean | true
showButtonBar                     | boolean | true
allowNegativeNumberNeeded         | boolean | false
spellchecking                     | boolean | true
hideOnMinimize                    | boolean | false
showTrayIcon                      | boolean | false
statusExperienceNeededProgressbar | boolean | false
trayClick                         | integer | 1
trayDblClick                      | integer | 0
pasteSpecialPrefix                | string  |
pasteSpecialPostfix               | string  |
pasteSpecialReplace               | string  |
pasteSpecialPrefixEnabled         | boolean | true
pasteSpecialPostfixEnabled        | boolean | true
pasteSpecialReplaceEnabled        | boolean | true
display.showSplitButton           | boolean | true
chat.split                        | boolean | false
chat.splitHeight                  | integer | -1
chat.splitLive                    | boolean | true
chat.roundedOverlays              | boolean | true
chat.showSplitButton              | boolean | true
chat.bufferSize                   | integer | 5000
chat.flashing                     | boolean | false
display.hideTrailingEmptyLine     | boolean | true
display.enableColors              | boolean | true
display.enableBackgroundColors    | boolean | true
enableSound                       | boolean | true
allowHalfOpen                     | boolean | true

### trayClick and trayDblClick values

Value | Results
------|------------------
0     | do nothing
1     | show client
2     | hide client
3     | toggle show/hide
4     | show menu

### onDisconnect values

Value | Results
------|------------------------
0     | Do nothing
1     | Attenmpt to reconnect
2     | Open reconnect dialog
4     | Open character manager
8     | Close client

### newlineShortcut values

Value | Results
------|-----------------------------------------
0     | Nothing
1     | ctrl + enter appends newline
2     | shift + enter appends newline
4     | ctrl or shift + enter appends newline
8     | ctrl and shift + enter appends new line

### logWhat

Value | Results
------|----------
0     | Nothing
1     | Log HTML
2     | Log Text
4     | Log Raw

To load more then one type simple add the numbers together, for example to load as HTML and text you would use the value of 3, HTML + raw would be 5, all would be 7

### backupLoad and backupSave values

Value | Results
------|----------
0     | Nothing
2     | Map data
4     | Profiles
8     | Settings
16    | Windows

To pick more then 1 type simple add them 2 values together, eg
2 + 4 = 6 to backup map and profiles only, 14 will load or save all
