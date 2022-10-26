# Preferences

Reset - Resetting will revert all settings back to default values

## General

- `Auto connect onload` This will cause the client to try and connect as soon as the client has finished loading.
- `Auto create character` When connecting to mud and if it returns a character name, create/load character, if character manager open will open add dialog instead of creating data
- `Auto login` Attempt to auto login using character and supplied password from character manager
- `Auto takeover login` Automatically issue yes to takeover character after login
- `Show character manager onload` open the character manager when the client first loads.
- `Enable spellchecking` support spellchecking in command line and advanced editor **Requires restart** <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Persistent advanced editor` causes the advanced editor to remain in memory to help speed up load times on future uses
- `On disconnect do` What to do when disconnected from the mud
  - `Nothing` do nothing
  - `Reconnect` reconnect using auto connect options
  - `Reconnect dialog` show the reconnect dialog with options and delayed reconnect timer
  - `Character manager` show character manager
  - `Close` close the client
- `Auto connect delay` This determines the delay before an auto connect happens
- `Max reconnect delay` set the maximum time in seconds, for reconnecting when using reconnect dialog, setting to 0 will revert to classic unlimited behavior.
- `Check for updates on load` check for new version every time you load the client <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Enable sound` disable or enable sound globally

## Interface

- `Theme` the theme for the main client window, the theme list is built from built in themes and themes located in {data}\themes folder and {documents}\jiMUD\themes, see [customizing](customizing.md#themes) doc for more themes information <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Always show window tabs` always show tabs even if only one client open <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Show add new button next to tabs` add a button to allow creation of new connections from tab strip <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Lock layout` saving only the last known global window states and preserve the previous saved windows and clients opened <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Load layout on open` set a layout file to use when loading client <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>

## Display

- `Enable flashing text` Enable ansi flashing/blinking text, when disabled flashing text appears as underlined text **note** this can cause a performance hit when enabled.
- `Auto copy selected to clipboard` This will copy selected text to the clipboard automatically when mouse released and then clear selection
- `Echo commands` Will display commands as they are sent to the mud
- `Enable URL detection` Attempt to detect urls and convert them into links that can be clicked to.
- `Focus to command input on click` Will auto focus to the command input when the display area is clicked.
- `Enable rounded overlays` disable or enable rounded corner effect for selection and find highlighting
- `Split scroll` Enable split screen scroll, this will allow you to scroll while displaying the most recent lines at the bottom, has known issues with text selection and find system scroll to view
- `Split scroll live update` determines how the split screen updates as resize bar is adjusted, if on it will update once resize bar released, if slow resizing enable this as it should reduce cpu load during drag
- `Show split button` Show or hide split toggle button in split scroll to allow for quick toggling
- `Buffer size` How many lines to keep in the display before removing them, **note** the higher this is the more memory or slower things might get.
- `Hide trailing line`  Hide trailing empty line, **note** if more then one it will only hide the final line
- `Enable colors` disable or enable all colors
- `Enable background colors` disable or enable just background colors
- `Show invalid MXP tags` display any MXP tags as normal text if they are not standard or custom elements
- `Display control codes` Display unreadable characters, code < 32 || 127 as visual characters
- `Emulate terminal extended characters` Enable/disable Terminal IBM/OEM (code page 437) extended characters, will convert them to the correct unicode character in an attempt to display like classic terminal
- `Emulate control codes` Emulate control codes: bell, tab, backspace, escape
- `Tab width` How many spaces in a tab
- `Show timestamp` display the timestamp for when line of text was added
- `Timestamp format` the timestamp display format**Note** Supports all moment time formats

## Display > Fonts

- `Font` The font for the display area, mono spaced fonts work the best.
- `Font size` The font size for the display area

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
- `Log what` what type formatted text to log
  - `HTML` log text as formatted html into a LOGNAMEFORMAT.htm log file
  - `Text` log text to LOGNAMEFORMAT.txt log file
  - `Raw` log all text and raw control codes to LOGNAMEFORMAT.raw.txt log file
- `Date/time format` format for date/time when included in log file name **Note** Supports all moment time formats, **WARNING** take note of your operating system's allowed characters or it may break logging
- `Save path` The location to save log files to, **note** path must exist supports

[Predefined variables for paths](faq.md#what-predefined-variables-can-be-use-for-paths)

## Logging > Viewer

- `Remember opened files on reload` Restore any files that where opened last time the viewer was closed
- `Always on top of the main window` Force viewer window to always be above main client window, when ever client window is focused it will bring the viewer window along with it. **Requires restart on windows**
- `Always on top of all windows` Force viewer window to always be on top of all windows
- `Persistent` causes the viewer window to remain in memory to help speed up load times on future uses

## Telnet

Settings to control how to handle telnet options and emulation

- `MUD Compression Protocol (MCCP)` Disables or enables MUD Client Compression Protocol, this allows the mud to send all data as compressed to save bandwidth, only disable if you seem to have issues or need to try and save some local resources.
- `UTF-8` Disables or enables UTF8 processing, disabling it may gain you some cpu or speed but you could get garbled or incorrectly displayed text.
- `MUD eXtension Protocol (MXP)` Disables or enables MUD eXtension Protocol parsing and telnet option
- `Echo` Disable or enables Echo option to display/hide text when server requests
- `MUD Sound Protocol (MSP)` Disable or enable MSP
- `Display Notification on MSP Play` Display a message when a file has started to play
- `MSP: max retries on error` Amount of retries to attempt play a file before stopping, 0 disables

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
- `Always on top of the main window` Force mapper window to always be above main client window, when ever client window is focused it will bring the mapper along with it. **Requires restart on windows**
- `Always on top of all windows` Force mapper to always be on top of all windows
- `Show in taskbar` Always show mapper window in taskbar **Ignored when Always on top enabled in windows**

## Chat

Controls what is captured into the chat window

- `Capture tells` Causes all tells, emoteto, shouts and any related lines.
- `Capture talk` Capture all talking, which are says, yells, whispers, and speaking and any related lines.
- `Capture reviews` Determines if line, say, or tell reviews are captured. The capturing is determined based on the settings enabled. Tell reviews are only captured if capture tells is enabled, say review with only capture say, all line reviews or selective reviews when enabled.
- `Capture lines` Enable capture of chat lines
  - `All` capture all chat lines
  - `Selective` capture only those provided in the selective lines list
- `Selective lines` A comma delimited list of lines to selectively capture, For example: Chat,Rp,Mudinfo will capture Chat, Rp, and Mudinfo lines.
- `Capture only when open` Only capture when window is open

**Note:** line names are case sensitive.

## Chat > Display

- `Font` The font for the display area, mono spaced fonts work the best.
- `Font size` The font size for the display area
- `Enable flashing text` Enable ansi flashing/blinking text, when disabled flashing text appears as underlined text **note** this can cause a performance hit when enabled.
- `Enable rounded overlays` disable or enable rounded corner effect for selection and find highlighting
- `Split scroll` Enable split screen scroll, this will allow you to scroll while displaying the most recent lines at the bottom, has known issues with text selection and find system scroll to view
- `Split scroll live update` determines how the split screen updates as resize bar is adjusted, if on it will update as resize bar is moved, if slow resizing disable this as it should reduce cpu load during drag
- `Show split button` Show or hide split toggle button in split scroll to allow for quick toggling
- `Display control codes` Display unreadable characters, code < 32 || 127 as visual characters
- `Emulate terminal extended characters` Enable/disable Terminal IBM/OEM (code page 437) extended characters, will convert them to the correct unicode character in an attempt to display like classic terminal
- `Emulate control codes` Emulate control codes: bell, tab, backspace, escape
- `Buffer size` How many lines to keep in the display before removing them, **note** the higher this is the more memory or slower things might get.
- `Tab width` How many spaces in a tab
- `Show timestamp` display the timestamp for when line of text was added
- `Timestamp format` the timestamp display format**Note** Supports all moment time formats

## Chat > Window

- `Always on top of the main window` Force chat window to always be above main client window, when ever client window is focused it will bring the chat window along with it. **Requires restart on windows**
- `Always on top of all windows` Force chat window to always be on top of all windows
- `Persistent` causes the chat window to remain in memory to help speed up load times on future uses, note this setting only has effect if capture settings are off
- `Show in taskbar` Always show mapper window in taskbar **Ignored when Always on top enabled in windows**

## Code Editor

- `Persistent` causes the code editor window to remain in memory to help speed up load times on future uses
- `Always on top of the main window` Force code editor window to always be above main client window, when ever client window is focused it will bring the code editor along with it. **Requires restart on windows**
- `Always on top of all windows` Force code editor to always be on top of all windows
- `Show in taskbar` Always show code editor window in taskbar **Ignored when Always on top enabled in windows**

## Status

- `Show Lagmeter` Whether to enable the lag meter, **note** this is not 100% correct always due to overhead variables that cant be controlled.
- `Show lag in title` Display lag in title bar, **note** this is not 100% correct always due to overhead variables that cant be controlled.
- `Show Experience Needed as Progressbar` display the experience needed value as a progress bar
- `Allow negative number for experience needed` causes the needed xp value in status display to allow to display negative when you have xp over required amt.

## Scripting

- `Allow evaluate` will enable ${expression} evaluation
- `Show Script Errors` Disable any errors that triggers, aliases, or macros produces when script type.
- `Parse single quotes as strings` Treat single quotes as string encasing, meaning all text found inside single quotes are treated as is and not parsed.
- `Parse double quotes as strings` Treat double quotes as string encasing, meaning all text found inside double quotes are treated as is and not parsed.
- `Disable trigger on error` Disable a trigger if an error happens when executing a trigger
- `Prepend triggered line` Disable the fix to prepend the triggered line as %0,$0, or %{0} to return to previous usage
- `Enable Double Parameter Escaping` Enable doubling up of the parameter character `%` to escape as well as using escape character
- `Ignore Eval Undefined` When enabled will make undefined results blank, else it will display the word undefined
- `Allow Comments From Command` Allow inline and block comments from the command input
- `Save Trigger State Changes` When a trigger state changes save profile
- `Delay between path commands` The amount of milliseconds between sending of path commands for speed paths.
- `Amount of path commands to send` the # of commands to send between speed path delay

## Scripting > Special characters

- `Command Stacking`
  - `Character` The character to use when repeating command into multiple commands, Default: `;`
  - `Enable` This will enable command stacking systems and use the command stacking character to know where to break a command into a list commands.
- `Speedpaths`
  - `Character` The character that is used to determine if the command is a speedpath to expand, Default: `!`
  - `Enable` Whether or not to expand speedpaths, if disabled the line is parsed as normal command
  - `Parse` Parse each command as if it was sent from the command line, if disabled each command is sent to the mud as is.
  - `Echo` Echo each command to the screen as they are sent
- `Command`
  - `Character` The character to use with build in client commands, Default: `#`
  - `Enable` This will enable or disable command systems
- `Escape`
  - `Character` The character to use when escaping $%"'{ or special characters, Default: `\`
  - `Enable` Enable escaping of characters
- `Verbatim`
  - `Character` The character used at the start of a line to signify the line should be sent as is starting after the verbatim character, Default: `
  - `Enabled` Enable or disable verbatim system
- `Parameter`
  - `Character` The character used for inline variables and functions and trigger/alias parameters %#, see [functions](functions.md) for more details, Default: `%`
  - `Enabled` Enable or disable parameters
- `N Parameter`
  - `Character` Similar to Parameter but allows full name symbols when possible for user variables and named parameters, eg $name, see [functions](functions.md) for more details, Default: `\$`
  - `Enabled` Enable or disable N Parameter system
- `Inline Comment`
  - `String` The 1 or 2 character string for inline comments, Default: `//`
  - `Enabled` Enable or disable inline comments
- `Block Comment`
  - `String` The 1 or 2 character string for block comments, closing block comment is the string reversed, Default: `/*`
  - `Enabled` Enable or disable block comments

  ## Advanced

- `Use only single instance` Allow only one instance of the application to open, all other attempts to open another instance will show the active window of the current instance, may use `-f` or `--force` argument to force open a new instance, -eo/--editor-only will open a new instance always <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
  - Supported command arguments passed on:
    - `-c/--character` When passed will open new connection for character in active window
    - `-e/--editor` When passed will open code editor for active client
    - `-nc/--new-connection` special argument that will open a new connection in active window
    - `-nw/--new-window` special argument that will open a new window with a default connection
- `On second instance` What to do when you open a second instance when use only one instance enabled and no command line arguments passed
  - `Nothing` Do nothing
  - `Show` Show and focus on active window
  - `New Connection` Create a new connection in active window then show and focus on active window
  - `New Window` Create a new window then focus on it
- `Enable gamepads` Enable gamepad support to allow creating macros using gamepad axes or buttons. **Experimental**
- `Enable GMCP Ping for lag meter` When text received from mud send back a GMCP ping if enabled to get a better time for the lag meter.
- `Enable debug` Will display debug data to the dev tool console
- `Log errors` Log errors to {data}/jimud.error.log [FAQ - Predefined path variables](faq.md#what-predefined-variables-can-be-use-for-paths)
- `Show extended error messages` Display extended stack information for errors
- `Fix hidden windows` Move windows that have been hidden off screen to on onscreen <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Hide when minimized` will hide the main window and any window set as a child **note** due to bugs in linux this feature may not work <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Show in taskbar` will show or hide the main window from the system's taskbar <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Enable Background Throttling` disable or enable throttling when a window is in the background or hidden <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Enable Background Throttling for Clients` disable or enable throttling when a client is in the background or hidden <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Enable warning dialog when connected and closing client` disable or enable warning check when closing mud and connected
- `Enable warning dialog when any client is connected and closing window with more then 1 client` disable or enable warning check when closing window with more then one client open <span style="font-size:0.8em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preference*</span>
- `Enable warning dialog when closing client and child windows are open` disable or enable warning dialog when closing and child windows are open
- `Enable warning dialog when loading a character from manager` disable or enable warning dialog when loading a character
- `Open 'Who is on' in web browser` Open the 'Who is on?' in a web browser, if disabled will open in a child window of jiMUD
- `Open ShadowMUD help in web browser` Open the ShadowMUD help in a web browser, if disabled will open in a child window of jiMUD

## Advanced > Backup

- `Backup save` what to save when using remote backup systems
- `Backup load` what to load when using remote backup systems
- `Backup all profiles` backup all profiles or just enabled profiles

## Advanced > Connection

- `Connect to development` Connect to the development mud.
- `Enable Keep alive` Enable socket keep alive
- `Keep alive delay` The number of seconds for initial keep alive delay
- `Enable allow Half Open sockets` Indicates whether half-opened TCP connections are allowed

## Advanced > Profiles

- `Save trigger state changes` Save profile every time a trigger state changes
- `Watch for profile changes` when enabled will watch for profile changes
- `On profile change do` what to do when a profile is changed when `Watch for profile changes` enabled
  - `Nothing` Do nothing
  - `Reload` Force reload of profiles, this may cause profile changes to be lost
  - `Ask` Ask you if you want to reload or do nothing
  - `Warn` Display a warning to the mud window
- `On profile deleted do` what to do when a profile is deleted when `Watch for profile changes` enabled
  - `Nothing` Do nothing
  - `Remove` Force remove of profiles, this may cause profile changes to be lost
  - `Ask` Ask you if you want to remove or do nothing
  - `Warn` Display a warning to the mud window  
- `Group profile saves` Group profile saves
  - **WARNING:** Enabling profile group saving could cause sync issues and loss of data when preferences saved or profile manager saves, as when saved it will flush all in memory changes and reload
- `Group profile save delay` How often between save profiles when group saves are enabled
- `Return newline on empty value` Return new line if processed item value is empty

## Advanced > Profile manager

- `Enable profile manager code editor` disable or enable the code editor for the profile manager
- `Enable profile manager file watcher` disable or enable watching for profile file changes to warn when saving overrides
- `Profile manager sort order` determine how items are sorted in the profile manager display tree, priority is first, then alpha, finally index, you cna have one or all three options enabled **note** Changing this setting while profile manager is open will not resort the displayed items
  - `Alpha` sort by alpha numeric
  - `Index` sort by index
  - `Priority` sort by item priority
- `Profile manager sort direction` select to display items in ascending or descending order  **note** Changing this setting while profile manager is open will not resort the displayed items
- `Profile to select on load` select which profile to pick when profile manager is first opened, falls back to Default if profile not found
- `Expand selected profile on load` auto expand selected profile when profile manager is first opened

## Advanced > Tray <span style="font-size: 0.5em;background-color: #555;border-radius: 4px;padding: 0px 4px">*Global preferences*</span>

- `Show tray icon` display an icon in the system tray/notification area
- `Tray context menu style` determine how complex a menu to display
  - `Simple` a simple menu that allows new connection/window, show/hide active window and quit
  - `Full` a full menu with all window and client sub menus as needed, **note** this may cause a slow down as when enabled all incoming text from mud causes a menu rebuild to reflect current active state
  - `Compact` similar to full but with out the client submenus, **note** see Full note
- `Tray icon single click` set what happens when the tray icon is clicked  **note** see known issues with linux
  - `None` - do nothing when clicked
  - `Show` - show or focus on active window
  - `Hide` - hide or minimize active window based on `Hide when minimized` setting
  - `Toggle` - Toggle between show / hide for active
  - `Show All` show all windows
  - `Hide All` all windows all windows based on `Hide when minimized` setting
  - `Toggle All` Toggle between show / hide for all windows
  - `Menu` - display the tray menu
- `Tray icon double click` set what happens when the tray icon is double clicked, same values as single click. __Mac__, __Windows__
