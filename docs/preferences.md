# Preferences

Reset - Resetting will revert all settings back to default values

## General

- `Auto connect onload` This will cause the client to try and connect as soon as the client has finished loading.
- `Auto connect delay` This determins the delay before an auto connect happens
- `Auto create character` When connecting to mud and if it returns a character name, create/load character
- `Auto login` Attempt to auto login using characer and supplied password from character manager
- `Show character manager onload` open the character manager when the client first loads.
- `Enable spellchecking` support spellchecking in command line and advanced editor
- `Persistent advanced editor` causes the advanced editor to remain in memory to help speed up load times on future uses
- `Allow evaluate` will enable ${expression} evaluation
- `Theme` the theme for the main client window

## Display

- `Font` The font for the display area, mono spaced fonts work the best.
- `Font size` The font size for the display area
- `Enable flashing text` Enable ansi flashing/blinking text, when disabled flashing text appears as underlined text **note** this can cause a preformance hit when enabled.
- `Auto copy selected to clipboard` This will copy selected text to the clipboard automatically when mouse released and then clear selection
- `Echo commands` Will display commands as they are sent to the mud
- `Enable URL detection` Attempt to detect urls and convert them into links that can be clicked to.
- `Focus to command input on click` Will auto focus to the command input when the display area is clicked.
- `Split scroll` **Experimental** Enable split screen scroll, this will allow you to scroll while displaying the most recent lines at the bottom, has known issues with text selection and find system scroll to view
- `Split scroll live update` **Experimental**  determines how the split screen updates as resize bar is adjusted, if on it will update once resize bar released, if slow resizing enable this as it should reduce cpu load during drag
- `Buffer size` How many lines to keep in the display before removing them, **note** the higher this is the more memory or slower things might get.

## Colors

- `Color scheme` Let you pick predefined colors schemes
- `Default` The default font color when no color codes have been supplied
- `Local echo` The local echo color
- `Information` The color of any information from the client
- `Error` The color of error messages
- `Ansi colors` You can set the 8 regular colors, 8 background colors, 8 bold/bright colors and the 8 faint colors.

## Command Line

- `Font` The font for the command input box
- `Font size` The font size for the command input box
- `Keep Last Command` This leaves the last command entered into the command input and selected it, if disabled it will be cleared
- `History Size` The number of items to keep in command history when navigating using the up/down arrow.
- `Command Stacking` 
  - `Character` The character to use when repeating command into multiple commands.
  - `Enable` This will enable command stacking systems and use the command stacking character to know where to break a command into a list commands.
- `Speedpaths`
  - `Character` The character that is used to determine if the command is a speedpath to expand, default is !
  - `Enable` Weather or not to expand speedpaths, if disabled the line is parsed as normal command
  - `Parse` Parse each command as if it was sent from the command line, if disabled each command is sent to the mud as is.
- `Parse single quotes as strings` Treat single quotes as string encasing, meaning all text found inside single quotes are treated as is and not parsed.
- `Parse double quotes as strings` Treat double quotes as string encasing, meaning all text found inside double quotes are treated as is and not parsed.
- `Newline shortcut` A shortcut for adding newlines to command input
  - `None` no shortcut enter always sends command
  - `Ctrl + Enter` add newline on ctrl+enter
  - `Shift + Enter` add newline on shift+enter
  - `(Ctrl | Shift) + Enter` add a new line on ctrl+enter or shift+enter
  - `Ctrl + Shift + Enter` add a newline on ctrl+shift+enter

## Logging

- `Enable Logging` Enable logger, can also be toggled by the log icon on the toolbar.
- `Pre-pend current buffer starting to log` Will pre-pend the current text on display to the log when started
- `Enable Logging of offline text` Log text when not connected.
- `Create logs for every connection` This setting will force a new log every time you connect to the mud, if disabled it will attempt to create one large log for the current session. 
- `Log gagged lines` This forces the logger to include any lines that may have been hidden, for example when capture chat is enabled the lines are removed from the main flow, this setting will enable you keep them or keep the log as only whats on the display.
- `Save path` The location to save log files to, **note** path must exist supports
[Predefined variables for paths](faq.md#what-predefined-variables-can-be-use-for-paths)

## Telnet

Settings to control how to handle telnet options and emulation

- `MUD Compression Protocol (MCCP)` Disables or enables MUD Client Compression Protocol, this allows the mud to send all data as compressed to save bandwidth, only disable if you seem to have issues or need to try and save some local resources.
- `UTF-8` Disables or enables UTF8 processing, disabling it may gain you some cpu or speed but you cuold get garbled or incorrectly displayed text.
- `MUD eXtension Protocol (MXP)` Disables or enables MUD eXtension Protocol parsing and telnet option
- `Echo` Disable or enables Echo option to display/hide text when server requests
- `MUD Sound Protocol (MSP)` Disable or enable MSP
- `Display Notification on MSP Play` Display a message when a file has started to play

## Mapper
- `Enable Mapper` Enable the mapper and create rooms as player moves
- `Follow Player` Set the current room to the players as they move
- `Show legend` Show map legend
- `Split Areas` Attempt to draw maps split up by area/zones
- `Display Walls` Draw walls between rooms to try and help display a more dungeon feel
- `Reset Window` Reset the mapper windows to default, this allows you to re-center window in case you dragged it off screen.
- `Delay between directions` The amount of milliseconds between sending # of directions for speed walking.
- `Directions to send` the # of directions to send between delays
- `Load in Memory` load mapper in to memory and only access disk on load and window/client close, try if slow or have large amounts of memory. **Requires restart on windows**, **WARNING _if the client or OS crash all in memory data will be lost and not saved to disk_**
- `Save period` how often to flush to disk when using load in memory option
- `Default import type` determines how default import system imports new map data

## Mapper > Window

- `Open on load` Open the mapper when you load the client
- `Persistent` causes the mapper window to remain in memory to help speed up load times on future uses, note this setting only has effect if mapper is not enabled
- `Always on top of the main window` Force mapper window to always be above main client window, when ever client window is focused it will bring the mapper along with it. _When disabled requires mapper to be closed to fully exits client_ **Requires restart on windows**
- `Always on top of all windows` Force mapper to always be on top of all windows

## Chat
Controls what is captured into the chat window

- `Capture tells` Causes all tells, emoteto and any related lines.
- `Capture talk` Capture all talking, which are says, yells, whispers, and speaking and any related lines.
- `Capture reviews` Determines if line, say, or tell reviews are captured. The capturing is determined based on the settings enabled. Tell reviews are only captured if capture tells is enabled, say review with only capture say, all line reviews or selective reviews when enabled.
- `Capture lines` Enable capture of chat lines
  - `All` capture all chat lines
  - `Selective` capture only those provided in the selective lines list
- `Selective lines` A comma delimited list of lines to selectively capture, For example: Chat,Rp,Mudinfo will capture Chat, Rp, and Mudinfo lines.

**Note:** line names are case sensitive.

## Chat > Window

- `Always on top of the main window` Force chat window to always be above main client window, when ever client window is focused it will bring the chat window along with it. _When disabled requires chat to be closed to fully exits client_ **Requires restart on windows**
- `Always on top of all windows` Force chat window to always be on top of all windows
- `Persistent` causes the mapper window to remain in memory to help speed up load times on future uses, note this setting only has effect if capture settings are off

## Status

- `Show Lagmeter` Weather to enable the lagmeter, **note** this is not 100% correct always due to overhead variables that cant be controlled.
- `Show Experience Needed as Progressbar` display the experience needed value as a progress bar

## Advanced

- `Connect to development` Connect to the developement mud.
- `Show Script Errors` Disable any errors that triggers, aliases, or macros produces when script type.
- `Enable GMCP Ping for lagmeter` When text received from mud send back a GMCP ping if enabled to get a better time for the lagmeter.
- `Enable debug` Will display debug data to the dev tool console
- `Log errors` Log errors to {data}/jimud.error.log [FAQ - Predefined path variables](faq.md#what-predefined-variables-can-be-use-for-paths)
- `Allow negative number for experience needed` causes the needed xp value in status display to allow to display negative when you have xp over required amt.
- `Backup save` what to save when using remote backup systems
- `Backup load` what to load when using remote backup systems
- `Hide when minimized` will hide the main window and any window set as a child

## Advanced > Tray

- `Show tray icon` display an icon in the system tray/notification area
- `Tray icon single click` set what happens when the tray icon is clicked
  - `None` - do nothing when clicked
  - `Show` - show or focus on client window
  - `Hide` - hide or minimize client window based on `Hide when minimized` setting
  - `Toggle` - Toggle between show / hide
  - `Menu` - display the tray menu
- `Tray icon double click` set what happens when the tray icon is double clicked, same values as single click. __Mac__, __Windows__