# Changelog

## 0.4.41

- **Changed:**
  - Upgrade electron to 1.8.4
- **Fixed:**
  - Mapper: force save in case the mapper window is unloaded
  - Immortal tools: could not click in rename text box to position cursor
  - Character manager: do not close dialog when no is clicked from confirm dialog
  - Monster icons not displaying due to case sensitivity
  - Status: trim training # to monster name to allow unique monster classes to be used

## 0.4.40

- **Changed:**
  - Upgrade several 3rd party dependencies
- **Fixed:**
  - Mapper: in memory option was broken

## 0.4.39 2018-02-12

- **New:**
  - Preference: Show extended error messages, hide expanded error messages unless told to but for logging
- **Changed:**
  - Update to electron 1.7.12
- **Fixed:**
  - Fix double, triple, and quad click text selection
  - Immortal tools:
    - Double clicking a folder in local while remote is root (/) would cause a double // in the path
    - When uploading or downloading a new file it would fail to correctly focus on item when Focus on finish was enabled
  - Correctly detect window focus state on load
  - Backup: fix an issue when restoring and setting logErrors to the wrong value
  - Only show disconnect dialog if it was a connection error
  - Reset disconnect timers when clicking any button but reconnect from disconnect dialog

## 0.4.38 2018-01-15

- **New:**
  - MXP: add version, support, user, and password tag support but leave user/password disabled for now due to server side not supporting it
  - Immortal tools: When using quick jump selecting a sub folder will now sync local/remote if sync is enabled, similar as if you had double clicked the folder
- **Changed:**
  - Character Manager:
    - Double clicking now does a close load, instead of just a load
    - Remove load and just load and close with single button to remove confusion
- **Fixed:**
  - Fixed scroll lock when using split screen mode, lock button/scroll when turned off should scroll to the end and remove split view
  - Prevent disconnect dialog hotkeys from being sent to command input when pressed.
  - Fixed issue with disconnect dialog count down timer
  - Immortal tools:
    - Fix double clicking items as they are removed from local/remote/queue table
    - Update queue table properly when local/remote folder are changed to refresh the file path state
    - When double clicking a folder in local when sync enabled, fails when in root remote (/)
  - Mapper:
    - When reloading the same character it would not refresh the map file if it changed from previous load.
    - When import progress dialog is closed with escape key properly end import.
  - Display scroll bars where not correctly updated when buttons/status display was hidden/shown
  - View > Buttons > Button check state was not correctly set when setting toggled
  - GMCP event is no longer triggered when an error decoding GMCP is done

## 0.4.37 2017-12-26

- **Changed:**
  - Immortal tools: Local/remote paths in queue list now replace start of path with . if local/remote paths match current working local/remote
- **Fixed:**
  - Immortal tools:
    - Downloading multiple folders at once was broken
    - Queue progress is more accurate
    - Could not download empty folders

## 0.4.36 2017-12-25

- **New:**
  - Immortal tools:
    - Task bar progress now is based on total active items now just current item
    - Quick toggle open in editor button when downloading files, making it easier to disable when downloading bulk files, and on for single quick changes
    - Reveal in explorer, Open, and Open with editor local buttons for easier opening of selected items
- **Changed:**
  - Logging:
    - Logging now begins when trying to connect instead of waiting for it to connect first, this fixes some logs being created with only 1 or 2 lines of text
    - Added extra new lines to HTML log to improve raw readability and separate each HTML line to its own text line.
- **Fixed:**
  - Immortal tools:
    - Shift selection after using keyboard search would select wrong items
    - Downloads/upload tracking counts where not always correct
    - Update local/remote toolbar button states when the folder is changed
  - Send NAWS updates when status/button bar are hidden so that the mud has new display width
  - Minor issue where disconnect code was ran with reconnect code causing double disconnect dialogs.
  - Logging:
    - An infinite loop by not correctly handling error catching.
    - Files where not correctly renamed after setting character name on login.
    - Text was written out of order.

## 0.4.35 2017-12-18

- **Fixed:**
  - Rebuild context and buttons after a profile enabled state has changed
  - Profile menu states where not updated based on new setting data
  - Profile Manager:
    - When profile toggled from menu and profile manager is open update the enabled state
    - Enabled check state was not correctly set when profile is selected, causing the profile to be set based on previous selected item
  - Mapper: fix minor issue when trying to process data before the mapper window is ready
  - Dont attempt to show disconnect dialog if already open

## 0.4.34 2017-12-14

- **Fixed:**
  - Preferences where not being saved, introduced in 0.4.32 with correcting windows open

## 0.4.33 2017-12-12

- **New:**
  - Add dev setting per character login to allow easier development login
- **Fixed:**
  - Bug in disconnect code
  - Fix an issue with game pads
  - Fix chat, mapper, and editor windows when characters are changed so they close and reopen as needed
  - Fix character data not saving before loading new character

## 0.4.32 2017-12-12

- **New:**
  - On disconnect preference, allows you to pick what happens when you are disconnected
    - Nothing - do nothing
    - Reconnect - reconnect using auto connect rules
    - Reconnect dialog - show a dialog with an auto reconnect count down with buttons to allow you to pick
    - Show character manager - display the character manager
    - Quit - quit the client
  - Immortal Tools:
    - Queue list now contains an status column to display any errors from upload/downloading
    - Queue list error icon now has error as tooltip
- **Changed:**
  - Immortal Tools: Performance tweaks to lower cpu when downloading or uploading
  - Immortal Tools: Update data table control to newest version
- **Fixed:**
  - Immortal Tools:
    - Update status bar when reset
    - Fix creating sub folders in current local folder
    - Statusbar now shows correct remote file counts
    - Mark items with an error icon instead of just removing
  - Fixed issue where new client window was created instead of a sub window
  - When reloading options, close all child windows and recreate based on new options
  - Fixed issue with exporting macros

## 0.4.31 2017-12-05

- **New:**
  - Add [#untrigger](docs/commands.md) command to remove triggers or alarms
  - Immortal Tools: can zoom in/out and reset from menu bar
  - Mapper, immortal tools, profile manager, advanced editor, and chat window now support loading css/js to allow [customizing](docs/customizing.md) by creating files in the appdata folder.
    - Profile manger: profiles.js and profiles.css
    - Chat capture window: chat.js and chat.css
    - Mapper: map.js and map.css
    - Advanced editor: editor.js and editor.css
    - Immortal tools: immortal.js and immortal.css
- **Changed:**
  - Immortal Tools: use natural sort when sorting file names
- **Fixed:**
  - Chat capture: crafting and tattooist menus should now be ignored
  - Keep alive was setting as milliseconds instead on seconds.
  - Keep alive delay was not set due to a bug in node it was not setting correctly unless already connected.
  - Fixed var tag in #TestMXP
  - Fixed parsing of var tag if invalid tag matching
  - Immortal Tools: List view key down selection search now ignores case for more accurate searching

## 0.4.30 2017-11-29

- **New:**
  - Character manager: login name independent of the character group, this allows you to create 2 characters with same login name but different group name, this makes it easier for those that have a character on dev mud and main mud using the same name but different setting files
- **Changed:**
  - Expand error catching to try and get more information
  - Change how active profile is found, active profile now should be highest priority profile or default
  - [#alarm](docs/commands.md) when just passing a single # now allows more then 59 seconds, to create second only timers, if over 59 it assumes wildcard
  - [#alarm](docs/commands.md), [#suspend](docs/commands.md), [#resume](docs/commands.md) now parse id, timepattern, and profile arguments so functions and variables can be used
- **Fixed:**
  - Fixed loading profiles not clearing internal caches
  - Fix suspend/resume to correctly time suspended alarms when resumed
  - Immortal tools: Error dealing with missing type2 column used for date sorting

## 0.4.29 2017-11-27

- **New:**
  - Character manager: Added load default and close, and load and close buttons
  - Keep alive, this allows you to enable keep alive for sockets and the initial delay in seconds
  - Triggers:
    - Alarms, this allows you to create trigger timers similar to zMUD/cMUD
    - Temporary, this removes a trigger once it has been executed once
  - Add [#alarm](docs/commands.md) command to create alarm triggers
  - Add [#suspend](docs/commands.md) command to disable alarm trigger
  - Add [#resume](docs/commands.md) command to enable alarm trigger
  - Add [%{time(format)}](docs/functions.md) function to display current date/time
- **Changed:**
  - When loading character a character it will now try and refocus on the main window if mapper, chat, or editor window are opened.
  - Moved show script errors to scripting area in preference dialog
- **Fixed:**
  - Close check was not correctly working and closed even if you said now when connected
  - Profile manager:
    - when closing did not correctly check if changes wanted to be saved
    - Fix never ask again when closing
  - Immortal tools:
    - List views now correctly scroll to top when remote or local path has been changed
    - List view key down selection search now works more like windows explorer, will start from current selected item
    - Date modified column groups folders and files instead of mixing them up

## 0.4.28 2017-11-15

- **Fixed:**
  - Backup:
    - Fixed hang when trying to load remote data and mapper window not created
    - Fixed importing map data if mapper disabled
  - Tray icon no longer lingers in system tray when client closed.
  - MXP parsing not correctly closing custom element tags

## 0.4.27 2017-11-04

- **Fixed:**
  - MXP parsing replacing custom tags with ''
  - Chat capture:
    - Fixed capture of who list when only 1 user online
    - Fixed clearing chat window using clear button

## 0.4.26 2017-10-27

- **Fixed:**
  - Chat capture: finally fix ignoring stores and lockers

## 0.4.25 2017-10-26

- **Fixed:**
  - Chat capture: fix ignore captures for stores and lockers, use a counter instead of a simple flag
  - Fix spaces in skill/weapon ids to convert to - so large sword and small sword icons work
  - Mapper:
    - auto walk buttons not correctly set to enabled when current room is different from selected room
    - Re-coded draw timing to be synced with core drawing system to try and lower cpu

## 0.4.24 2017-10-14

- **New:**
  - Preference: can now disable file watcher for profile manager.
  - Backup all profiles: allow all profiles to be saved when using client save
- **Fixed:**
  - Chat capture: ignore all lines between ------ for stores/lockers
  - Backup: make sure room id is a number when saving
  - Mapper: make sure room id is a number when exporting

## 0.4.23 2017-10-07

- **Fixed:**
  - Mapper:
    - Fix zone yet again, attempt to only change the zone if a room exist at coords
    - Assign current zone to the new room

## 0.4.22 2017-10-06

- **New:**
  - Experimental game pad support
  - Mapper: Added zoom in, zoom out, zoom reset, toggle developer tools, and toggle full screen
- **Fixed:**
  - Chat capture: Capture all lines no matter what characters they may contain when capture all lines is enabled
  - Mapper: Fix zones not assigning right when moving to a new area
  - Immortal button not being hidden on disconnect then re-login with a non immortal login
  - Backup system was not having the correct map file set when character was changed.

## 0.4.21 2017-09-26

- **Fixed:**
  - Mapper: Fix mapper new zone correctly this time

## 0.4.20 2017-09-26

- **New:**
  - Chat capture:
    - Add zoom in, out and reset buttons
    - Add font and font size settings
- **Fixed:**
  - Mapper:
    - Fixed an issue when creating new zones.
    - Fixed an issue when adding new rooms it was attempting to add them twice

## 0.4.19 2017-09-25

- **Fixed:**
  - Profile manager:
    - Where not correctly reloading deleted ones from memory.
    - New profiles enabled checks where set to disabled, yet where
    - Removed profiled, then re-added new with same name didn't save correctly
    - Linux: Was not correctly removing profile data files due to casing issues
  - Chat capture: capture name that include a ' and spaces

## 0.4.18 2017-09-18

- **New:**
  - Chat capture: Add shout to tell captures for chat window
- **Fixed:**
  - Mapper: Area navigation drop down fails when area name contained a space
  - Chat capture: ignore fragmented lines due to split packets or mixed parsing

## 0.4.17 2017-09-16

- **New:**
  - Added preference to disable code editor in profile manager
- **Fixed:**
  - Mapper:
    - Area navigation not updated when new area created
    - Room property editor position not updating when toolbar wraps

## 0.4.16 2017-09-15

- **Fixed:**
  - Downgrade to electron 1.7.7 to fix a crashing bug with 1.8.0
  - An issue with auto connect not working

## 0.4.15 2017-09-14

- **Changed:**
  - Updated electron to 1.8.0
  - Updated spell checker and sqlite
- **Fixed:**
  - Copy was not working on linux
  - Fix command argument parsing
  - Mapper: Zone/level not updating when active room
  - Verbatim was failing to append new line characters
  - Profile manger: Fix display of html characters in tree view
  - Fixed a bug in parsing %# arguments

## 0.4.14 2017-09-04

- **Fixed:**
  - Fixed display width when status display hidden
  - Added a trailing ; to the linux category
  - Fixed spell checker on linux
  - Fixed parsing of double/single quotes as strings when ending of a command

## 0.4.13 2017-08-19

- **New:**
  - Added new Windows 10 color scheme
  - Added Current color scheme to reset colors back to original colors
  - Added --disable-gpu command line arg
  - Added linux Categories
- **Changed:**
  - Changed how copy system works for main client
- **Fixed:**
  - When picking a predefined color scheme it was not saving
  - Display scrolling in split view or scroll lock when new text added
  - #TestSize size was broken when new display added
  - Mapper will now send a room request for current every time it is loaded/reloaded/importing fixing the mapper from getting lost when connected and changing mapper settings
  - Client saving was not correctly getting mapper data when in memory option was enabled

## 0.4.12 2017-08-16

- **Fixed:**
  - Backup exported macro display code wrong
  - Profile manager editor title text overflowed and filled background

## 0.4.11 2017-08-16

- **New:**
  - Added function doc file to explain functions and list predefined variables
  - Added intern corner support for overlays (selection, find)
  - Preference: Enable rounded overlays, disable or enable rounded corner effect for selection and find highlighting
  - ${eval(expression)} to allow evaluation a math expression when ${expression} is disabled
  - Add proper escape system with parser changes, characters: $%"'{\ and command stack character, to escape a character simply just do \CHARACTER
  - Expressions now allow the function dice to be used as if normal math function, eg: `${5 + dice(2d6) * 5}` is the same as `${5 + ${dice(2d6)} * 5}`
  - Functions:
    - ${dice(**x**d**y**__+n__)}, roll a dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
      - example: ${dice(2d6+5)}, rolls 2, 6 sided dice and returns the sum + 5
    - ${diceavg(**x**d**y**__+n__)} the avg roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
    - ${dicemin(**x**d**y**__+n__)} the minimum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
    - ${dicemax(**x**d**y**__+n__)} the maximum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
    - ${dicedev(**x**d**y**__+n__)} return standard deviation of dice `sqrt((y^2-1)/12 * x)`, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
    - ${zdicedev(**x**d**y**__+n__)} return zMUD/cMUD standard deviation of dice `sqrt(((y-1)^2-1)/12 * x)`, x is the # of dice, y is the # of sides, with optional +,-,*,/ modifier
  - Verbatim system, you can now start a line of text with a ` and all text after that to a newline will be sent as is to the mud with no parsing or manipulation
  - Preferences:
    - Escape character, allows changing which character is used for escaping
    - Command character, allow you to change the # character for commands
    - Enable commands, disable command system
    - Verbatim character, change which character is used to mark the start of a verbatim block
    - Enable verbatim, control if verbatim system is enabled
  - Updated command doc to list all test commands
  - Inspect item for button bar, input, display default, and status bar context menus when enable debug is on or when --debug has been set to allow easier debugging of GUI
  - Chat gag preference to control if you want the lines gagged from the main client window or not
- **Change:**
  - Context menu is now cached when profiles are loaded, this may increase load time/memory by small amount but allows context menu to open nearly instantly where before it had a minor delay when rebuilding the menu each time.
  - Remove experimental tags for scroll and scroll live preferences
  - Preferences:
    - Move allow escape, command stacking, and speed path preferences to scripting > special characters
  - Test commands now follow standard format of #Test????? where ??? is the different test name, use #TestList to see a list of all test commands
- **Fixed:**
  - Alias, context, triggers, button, and macro sort order was not correct, most noticeable when using context menus
  - ${i}/${repeatnum} always returning 0
  - ${expression} was not working correctly with repeatnum/i
  - one letter named arguments where not processed correctly
  - %/${name} where not being processed
  - #show was converting text into binary
  - #show was trying to decompress string when MCCP was enabled
  - Parsing was re-coded to properly handled ${}, %{}, %*, and %# variables with proper stack tracking
  - #wait would have broken %# values, fixed with new proper parsing and stack
  - selected, selectedword, selword, selectedline, selline, selectedurl, selurl, and copied now return the correct values when used outside of context menus
  - Mapper persistance setting was not correctly restored always
  - Tray toggle was not correctly done when using #toggleclient
  - Backup:
    - Loading would break when trying to load settings from main using a dev connection
    - Profile buttons where not being correctly restored and being appended to triggers
    - Profile context items where not being restored
    - Profile default context option was not being restored
  - Onload focus on main window instead of chat/mapper/editor windows

## 0.4.10 2017-08-03

- **Change:**
  - When window shown it will now focus on command input
  - Window now receive focus when tray show is triggered
- **Fixed:**
  - Backup: attempt to fix paths when imported when defaults are used
  - Immortal tools:
    - Not correctly ignoring fswin node module
    - Set a min size for panel size when loading
    - When loading window was not correctly passing options
    - When saving options, options not correctly applied to active window
    - Remote drag and drop on linux was broken

## 0.4.9 2017-07-30

- **New:**
  - Auto login system if using character manager, allows you to store a password encrypted using aes, this is basic encryption and nothing else.
  - Immortal tools: create new empty local file
  - Event [trigger type](docs/profiles.md#Triggers), you can now create triggers that will fire when events fire
    - You can create custom events using #event or use a built in event name:
      - `opened` fired when client has finished opening
      - `closed` fired when client is closing
      - `connected` fired when client has been connected
      - `disconnected` fired when client has bene disconnected
      - `error` fired when an error happens, first first argument is error message
      - `focus` fired when window focused
      - `blur` fired when window loses focus
      - `notify-clicked` fired when notification is clicked, argument 1 is title, argument 2 is message
      - `notify-closed` fired when notification is closed, argument 1 is title, argument 2 is message
  - Add [#raisevent](docs/commands.md) command to fire custom events
  - Add [#raisedelayed](docs/commands.md) command to fire custom events with a delay
  - Add [#gag](docs/commands.md) command to gag lines
  - Add [#ungag](docs/commands.md) command to cancel #gag
  - Add [#showclient, #hideclient, #toggleclient](docs/commands.md) commands to go with scripting functions
  - Add [#wait](docs/commands.md) command to pause command execution for that command block
  - Add [#nnn](docs/commands.md) command to repeat commands
  - Add [%{repeatnum}/${i}](docs/profiles.md) returns the current index during #nnn
  - Add [${cr}, ${lf}, and ${crlf}](docs/profiles.md) for carriage return, line feed, and carriage return + line feed
  - Add [${expression}](docs/profiles.md) evaluate the math expression and return the results
  - Add [client.raise('event', args, delay)](docs/scripting.md#Basic-function-list) function to emit custom events
  - Add [client.show()](docs/scripting.md#Basic-function-list) function to show the window
  - Add [client.hide()](docs/scripting.md#Basic-function-list) function to hide the window
  - Add [client.toggle()](docs/scripting.md#Basic-function-list) to toggle hide and show
  - Added ${#}, %{#}, %{*}, ${*} formats to match {} variable format
  - Added proper %\{, $\{ escape system
  - New scripting setting scripting for allow expression/evaluate and moved parse double/single quote options there value returned
- **Change:**
  - Immortal tools: focusing on local or remote path text box will now auto select all text
  - Profile manger
    - Context items with parents will now appear under their parent item, if not found it will default to standard context location
    - All item are now sorted by priority then by order, added this allows you to see the exact order items will be executed or loaded
  - #notify now uses command line quote parse settings to build arguments, based on setting you can use ' or " to wrap title argument
  - Parsing errors now stop parsing and display error
- **Fixed:**
  - Windows meta data was not set for application
  - Character manager was not reloading the loaded character when changes happened
  - Character name was not being set when using character manager on initial load
  - Profile manger: initial profile enabled checkbox in treeview where not being set
  - Immortal tools:
    - Select on finish now clears previous selected items
    - A memory leak when running mkdir commands
    - An issue when maximizing and un-maximizing window
    - Queue no longer works from newest to oldest, it now correctly uploads oldest in queue first
  - Auto connect will now correctly fire when changing character settings based on if connected or not
  - Fixed a bug in echoing system and it restoring the previous ansi state

## 0.4.8 2017-07-25

- **New:**
  - Immortal tools:
    - Focus files on finish upload/download
    - Select files on finish upload/download
- **Fixed:**
  - When closing a dynamic window dialog it would error saying window destroyed
  - Fixed saving dynamic window alwaysOnTop, alwaysOnTopClient, and persistent
  - Fix window close states for all windows
  - Backup was not correctly loading settings when using client load
  - Fix MXP music, sound, gauge and stat tag argument parsing
  - Immortal tools:
    - Updated status bar to have more generic information
    - Preference dialog now correctly sets and saves window settings
    - Scroll position is no longer lost when local, remote, or queue list are updated
    - Selection state is no longer lost when local or remote files are updated
    - Remote list is now properly reinitialized when the mud sends init code
    - Error when dropping files for remote upload

## 0.4.7 2017-07-24

- **New:**
  - Tray: added profile manager and preference to menu
  - Auto connect delay - new option to allow control how of long to wait before auto connecting
  - Add -v/version to command line to print version
- **Change:**
  - Immortal tools: updated the window icon
  - Default profile is now the first in list instead of alpha order based on priority first
  - Only load the spellchecker if enabled
  - Tray: Tooltip now list if connected to dev and better display format
  - Change how allowNegativeNumberNeeded is applied
  - Reverse needed xp progress bar fill
- **Fixed:**
  - Preference dialog
    - Select drop downs in wrong location
    - Optimize load times to speed up opening dialog
  - Profile manager: advanced panel visible states where not being saved
  - Dynamic windows: save options better so it can properly restore windows
  - Some windows would try and send commands after the main window was closed, now all remote commands test to make sure main window is there
  - Scroll area size was not correctly being restored when using display scroll system
  - When connection is reset it will now properly close connection and attempt to reconnect if auto connected enable
  - Backup: remote backup should now save all settings
  - Bug with display window size
  - Chat capture: fix some issues causing it not to display text

## 0.4.6 2017-07-21

- **New:**
  - Status: allow experience needed to be displayed as a progress bar
  - Mapper
    - Added menu bar for standard gui
    - Add stable marker support and expanded trainer support to display for stat/skill/advance rooms
  - Profile manager: added menu for standard gui
  - Immortal tools
    - Upload folder support
    - Download folder support
    - More file type icons
    - Color some icons to try and make them stand out
  - Expanded the client.notify function to have an optional options argument to pass more advanced notification options: dir (auto, rtl, ltr), icon (supports {variables}), lang, tag [Notification Options](https://developer.mozilla.org/en-US/docs/Web/API/notification/Notification)
  - Preference dialog
    - Redesigned to allow easier organizing by replacing tab control with a treeview/panel
    - New status section that now contains all preferences related to status display
    - Added mapper/chat window sub areas for window related settings
- **Change:**
  - Active icon is no longer triggered when zero length data is returned
  - Updated to electron 1.7.5 beta
  - #notify and client.notify will cut messages over 127 characters long to prevent abuse, if you want more text you can create raw notifications in javascript
  - Update treeview control to 2.1.5
- **Fixed:**
  - Set application id to 'jiMUD' instead of the default 'Electron'
  - Dynamic windows when max/min tracking fix was added
  - String parser where it was cutting off a character when parsing parameters
  - #notify was not correctly parsing single word titles wrapped with ''
  - New notifications should now trigger if old one is still displayed
  - Tray: tray hide will now minimize if [hide on minimize](docs/preferences.md#advanced) is not enabled
  - Profiles where not correctly sorted by priority
  - Immortal tools
    - Remote drag and drop support
    - Queue adding more then 1 item was displaying active item path for all items added
    - Making a new remote directory was not correctly setting the path
    - Issue when dragging and dropping remote files
    - When running backup remote command from context or menu and bak folder did not exist was setting wrong path when created in remote list

## 0.4.5 2017-07-14

- **New:**
  - Context menu:
    - Urls now add open/copy url/copy text.
    - MXP links add open/copy text
  - Tray icon support
  - Hide when minimized - will hide window when you minimize the main window
  - Preferences: display and command font selectors now list the original basic fonts as well as installed system fonts now
    - Mac OS X 10.5 and later supported via CoreText
    - Windows 7 and later supported via DirectWrite
    - Linux supported via fontconfig
      - May need to install `sudo apt-get install libfontconfig-dev`
  - Add better error checking for spell checker to prevent crashes if spell checker breaks
  - Buttons, aliases, triggers, macros, and context are now cached better, so global arrays are only built only when loaded or changed instead of each time accessed.
- **Change:**
  - Profiles loading use to load all profiles into memory even if not needed, now only profiles that are enabled are loaded to speed up loading times. Note this does not effect profile manager
- **Fixed:**
  - MXP: links where not displaying correct tool tips
  - $selectedurl was always empty when right clicking a link
  - Buttons, aliases, triggers, macros, and context should now be properly sorted by priorities. All items are first sorted by profile priority then by type priority.
  - Mapper window progress task bar

## 0.4.4 2017-07-12

- **New:**
  - Immortal tools: current queue progress now supports windows task bar progress
  - Mapper: import task bar progress should now support separate window update + main client on task bar
- **Fixed:**
  - Mapper: during code cleanup moved to a stricter compare (===) and the mud sends a # while it is stored as a string in the mapper, it now converts remote data into string
  - Profile manager: During code cleanup deleted a line of code that broke macro editor

## 0.4.3 2017-07-08

- **Fixed:**
  -Advanced editor was broken due to previous code cleanups

## 0.4.2 2017-07-07

- **New:**
  - Immortal tools:
    - Rename local and remote files
    - Make new folders local and remote
    - Drag and drop support to ul/dl files
    - Remote command support from menu or context menu for selected items: backup, goto, change to dir, clone, dest, update, renew
    - Queue stop, pause, resume items
  - Immortal doc file
- **Fixed:**
  - An issue with scroll bars inner borders when nothing to scroll
  - Default and clean theme background colors now correctly black
  - When font/font size are changed it needs to rebuild lines to correctly calculate widths
  - Update window event is not fired when font/font size changed so NAWS did not send new screen sizes
  - Font sample displays no longer cover other preferences when font is larger then width or cause other sizing issues.
  - Immortal tools: fixed remote delete trying to delete folders
  - Fixed a bug in #alias not correctly adding a new alias
  - Fixed a bug with MSP link expiring and nested tags
  - Profile Manager:
    - Fixed an issue when editing macros and key is always None.
    - #alias/#unalias notify profile manager directly now notifying that profiles have changed.
  - Minor bug fixes related to cleaning code.

## 0.4.1 2017-07-03

- **New:**
  - Immortal tools
    - Download files and open in an editor
    - Upload files
    - Delete files, local files moved to trash, remote deleted permanently
  - Paste special, allows pasting text with different modifiers like adding post/pre fixes to each line
- **Change:**
  - Updated to electron 1.7.4 beta
- **Fixed:**
  - Preferences: Log path browse button now works
  - Triggers where trigger on raw line instead of text
  - MSP: fixed an issue with mal-formed urls breaking streaming sound
  - MSP: fixed playing notification message not displaying duration dime
  - Fixed issues with paste menu item not pasting into command input

## 0.4.0 2017-06-23

- **New:**
  - Display control
    - Faster then old system by nearly 50% when processing
    - Fixes find all highlighting performance issues
    - Cleaner text selection effect
    - Better experimental scroll support
  - Logging
    - Log html - Log html to a separate log file
    - Log text - Log text to a separate log file
    - Log raw - Log raw ansi to a separate log file.
    - Format Timestamp in file name using moment
  - Chat capture find text

## 0.3.3 2017-06-21

- **Fixed:**
  - Fixed options undefined errors
  - Log mapper errors to log file when log errors enabled
  - Fixed issues with error log not correctly logging the error message
  - Attempted fixes to mapper losing data

## 0.3.2 2017-06-16

- **New:**
  - Add enable spellchecking preference to allow spell checking to be turned off
- **Change:**
  - Log error setting default to on
  - Improved trigger performance by changing how some test are done
  - Re-enable TestMapper() to allow testing of mapper
  - Updated to electron 1.7.3 beta
- **Fixed:**
  - Fix bell Unicode character display
  - Editor:
    - New lines where not correctly being sent when sending as formatted text
    - Trailing newlines where being cut off
    - Fix flashing format not being sent when flashing disabled
  - Fix a bug in aliases and macros when script style was used, would error due to strict type comparison
  - Fix a bug in aliases, macros, and triggers when script style returns a non string/null/undefined

## 0.3.1 - 2017-05-30

- **Fixed:**
  - Character manager: file not found issues, will now properly check if characters file exist before accessing it
  - Do not attempt to access user data folder until app is ready, fixes character folder creation checks

## 0.3.0 - 2017-05-30

- **New:**
  - Split scroll, **Experimental**  this will allow you to scroll while displaying the most recent lines at the bottom with option live update or post update
  - Basic error logging to appdata/jiMUD/jimud.error.log when enabled from preferences > advanced > log errors
  - Auto create character, will auto create a new settings file/map file based on GMCP character name
  - Newline shortcut, allows you to pick a shortcut for adding newlines to command input
    - None, no shortcut enter always sends command
    - Ctrl+Enter, add newline on ctrl+enter
    - Shift+Enter, add newline on shift+enter
    - (Ctrl | Shift + Enter), add a new line on ctrl+enter or shift+enter
    - Ctrl+Shift+Enter, add a newline on ctrl+shift+enter
  - Character manager:
    - Add, edit, rename, delete character settings/map files
    - Select character to auto load
    - Load character on demand
    - Access from menu or new button on button bar
  - Command line arguments:
    - `-h, --help` display console help
    - `-s=[file], --setting=[file]` override default setting file
    - `-mf=[file], --map=[file]` override default map file
    - `-c=[name], --character=[name]` allows you to load/create a character from character database
    - `-pf=[list], --profiles[]` set which profiles will be enabled, if not found will default
  - About memory tab now includes process type, cpu usage and idle wakeups as of when the dialog was opened.
- **Changed:**
  - Profiles: enabled systems are no longer linked to profiles but will instead be saved with the setting systems, this allows per setting file enabled profile list, allow better multiple instances of the client to not clash
  - Clear icons for display and chat windows have an X added to them to symbolize remove/delete
  - Convert command input into a textarea field to allow multi-line text
  - Preferences:
    - Dialog now centers on main client window
    - Moved several settings to a new Advanced tab to simplify general settings
  - Due to performance reasons fight now has a new highlight all option, default now will only highlight current match
  - Upgrade to electron 1.7.2, adds better debugger support and other bug fixes
  - Upgrade the about memory tab to use new API instead of old deprecated API
- **Fixed:**
  - Preferences: font and command font not being correctly set
  - Window states for mapper, chat or editor where not saved depending on always on top settings when closing the main client
  - Fixed errors not being correctly caught and displayed when connecting
  - Fixed uncaught errors not being displayed
  - Fixed a bug when changing settings it would reset connect button while still connected
  - Issues with ansi parser and line heights, empty lines had wrong pixel hight throwing off other calculations, now all newlines are wrapped in basic ansi formatting to ensure empty lines have exactly the same height as all other lines.

## 0.2.4 - 2017-05-22

- **Changed:**
  - Profile manager: treeview should now sort by profile name, with default always being first
- **Fixed:**
  - Profile manger:
    - importing from file was broken, now will ask to replace, do nothing, or copy if name exist instead of defaulting to copy
    - Undo/redo of adding profiles was broken when you undo an add then redid it would break and lose profile
  - Trigger cache was not clearing when profiles enabled/disabled

## 0.2.3 - 2017-05-21

- **New:**
  - Add some of the newer settings to set/getsetting commands
- **Changed:**
  - Adjusted dark theme scroll bars
  - Lock button now sets style to "on" when scroll lock enabled
- **Fixed:**
  - Mapper:
    - Area navigation was not updating
    - Walk button/context item should be enabled as long as current and selected room are set now just when path highlighted
    - Highlight button/context item are only enabled if current room/selected room and are not the same

## 0.2.2 - 2017-05-20

- **Fixed:**
  - Default profile appearing twice in menu on first load
  - Backup:
    - loading wrong url when using development setting
    - corrupted load data due to a previous bug fix with data type

## 0.2.1 - 2017-05-20

- **Changed:**
  - Adjusted dark mouse over colors to be more visible
  - Mapper window will now show when a backup import triggers to show mapper progress
- **Fixed:**
  - Fix issues with closing client and still being connected and saying no to close
  - Sound/Music commands work
  - setsetting/getsetting commands work
  - A bug in backup when ajax error happens and not being able to abort load/save
  - A bug when importing legacy profiles and settings not correctly converting to boolean datatype
  - Backup settings where not being applied until a restart

## 0.2.0 - 2017-05-19

- **New:**
  - Add ${variable.FUNCTION} format support to allow similar format to javascript.
  - Add find text system to main client
    - Match case - ignore case or not
    - Match word - match exact word
    - Regular Expression - allow use of regular expressions to match text
    - Result list - show you how many results found and current one at
    - High light - will highlight all matches
  - Theme support, you can now created a css theme file and place it in %appdata%/themes/name.css or my documents/jiMUD/themes/name.css
    - Default - the default theme
    - Clean - a version of the Default theme with more simple borders and no images.
    - Dark - a dark theme with dark grays and blacks with silver highlights
    - Lightgray - a light gray theme
  - About dialog now includes memory information.
  - Preferences
    - Mapper: default import type, allows you to determine how map data will be imported when using default import systems
    - Backup load/save selections, determine what is saved or loaded when using the remote client backup system
- **Changed:**
  - Default button icons have been converted to font-awesome or svg icons for easy themeing and crisper look
  - Upgrade electron to 1.7.1, fixes a few crashers with --debug
  - New application icons, should be cleaner and support linux, windows and mac
- **Fixed:**
  - Ansi parser would return empty elements due to changing styles and colors, the empty blocks are now removed when the lines have been added, should reduce memory
  - Preferences was not saving display/command font setting
  - View > Status > Visible was showing wrong check state
  - Fixed lines not being trimmed to buffer size, was introduced when display was converted to an iframe to fix the selection bugs.
  - Mapper
    - Fixed a javascript bug when clicking cancel button on progress dialogs
    - Import dialog would not close when imported data had no rooms

## 0.1.9 - 2017-05-14

- **New:**
  - User context menus, create custom items for the right click display menu
  - new variables in javascript
    - `$selectedword/$selword` - returns the word under the mouse when right clicked
    - `$selected` - returns the current selected text
    - `$selectedline/$selline` - returns the current line text
    - `$selectedurl/$selurl` - returns the current url when right clicked
    - `$copied` - return clipboard text
  - Parsed variables that work like the javascript ones in format of %{variable}, you may force upper, lower, or proper case by appending .lower, or .upper, for example %{selword.lower} will return lower cased version, or using the inline parse functions
  - `%{copied}` - replace with clipboard contents, for javascript use this.readClipboard() or client.readClipboard where needed
  - inline parse functions to manipulate parsable variables
    - `%{lower(TEXT)}` - convert TEXT to lower case
    - `%{upper(TEXT)}` - convert TEXT to upper case
    - `%{proper(TEXT)}` - convert TEXT to proper case
  - Added beep function for scripting
  - Added #beep command for playing system beep
  - Profile Manger: Added export current and export all that will allow easy export/import with web client
  - Added context menu to status display area, allows toggling of what is visible
  - Added context menu to button bar to toggle buttons/visible
  - Add how mapper, chat, and editor windows are unloaded, either persistent or reloaded each time. if reloaded it will save memory but cause the windows to load a little slower
  - Advanced Editor now supports spell checking with a context menu replacement, warning all styles are lost when replaced.
  - Command input now supports spell checking with proper context menu suggestion replacements
  - Mapper: Added context menu, if over a room you can mark as current, remove, highlight path to room, walk to room if not over room can clear path, refresh, or compact
- **Changed:**
  - Advanced Editor
    - Tooltips/color menus now display color code and display name based on XTerm 256 color names and ShadowMUD color database
    - Color selection has been trimmed to the basic 16 colors + no color, with an option to open a more advanced color selection dialog, this should reduce load times.
  - Profile manager
    - Moved import button to a export/import drop down
    - drop down menus and context menus are now created on demand in stead of made when loaded
  - Mapper
    - Changed how drop down menus where created, now creates on demand instead of staying loaded in memory
    - Area navigator is now  fixed with in the toolbar, should keep it from jumping around or being cut off with long area names
  - Converted from custom bell to system bell sound
  - View > Status > Limbs was expanded to a new submenu for visible, health and armor toggling
  - Upgrade electron to 1.7.0
- **Fixed:**
  - Capture window
    - not saving window state on close
    - logging button was not toggled on when logging enabled
  - A bug when closing client and mapper is not set as always on top of main window
  - Mapper
    - When not always on top of main window and not reopening next load
    - When a room was removed it would clear current, selected, and active rooms even if room was not one of those
    - When a room removed it would not clear path if the room was in the path
    - When changing mapper options from the preferences dialog it would not save current room/mapper data before reloading
    - When clear all was done it would not remove areas from area navigator
    - When a room was removed it would not updated the area navigator if it was the only room in the area
  - Profile manager
    - Fixed import button by moving to drop down menu
    - importing now ask to replace a profile if name exist
  - View > Status menu items now work to toggle what is displayed
  - Fixed a bug in display being in a frame and parser capturing previous line fragments
  - Fixed a bug that when always on top was turned off for chat, mapper, advanced editor windows would stay open after main client was closed, now all windows are closed when main client window is closed.

## 0.1.8 - 2017-05-11

- **New:**
  - Allow negative numbers for experience needed in status display
  - Mapper Load in memory will now save to disk every 15 minutes
  - Mapper Save period can be set in milliseconds
  - Basic context menu for main display (copy/select all/clear) with ground work for custom items later on.
- **Changed:**
  - Changed how editor, chat, and mapper windows are cached to try and improve memory and speed by not loading in the background unless needed
  - Mapper load in memory no longer requires restart to enable
- **Fixed:**
  - Mapper now properly reloads to take into account any setting changes from preference changes.
  - Profile manger
    - An issue with treeview context menu
    - A bug with the add new item button

## 0.1.7 - 2017-05-09

- **New:**
  - Chat window
    - Capture lines/tells/room talk and related reviews, including related settings to control the window and what to capture into the new chat window.
    - Independent logging using logging settings to create a separate log.
  - Added log gagged lines option.
  - Mapper
    - A compact button to allow you to cause the db to compact and free space for a possible speed boost.
    - A memory only mode, requires a restart after enabling, will cause the memory to be loaded 100% into memory and only access the disk on load or when the window or client are closed. **WARNING _if the client or OS crash all in memory data will be lost and not saved to disk_**
- **Changed:**
  - Logging now logs per line instead of when all lines are done parsed, this fixes the issue of allow gagged lines to be captured
  - Updated jquery to v3.2.1
  - Updated ace editor to v1.2.6
- **Fixed:**
  - A bug in auto copy not clearing when mouse leaves the window
  - A bug when using the cancel button on profile manager and warning about saving changes when nothing has been changed
  - Flashing when enabled should now correctly sync blocks in advanced editor, display, and chat window.
  - Fixed profile manager context menus
  - Fix preference context menus
  - Fixed bug with newline/prompt when executing triggers
  - A bug in needed xp being -#

## 0.1.6 - 2017-05-07

- **New:**
  - Advanced editor
    - Now supports Overline (ctrl+o), Double Underline (ctrl+d), Flash (ctrl+f), and Reverse (ctrl+r) styles
    - Added send as command no echo for both formatted and verbatim
    - Can now be opened using Ctrl+A
    - Fonts are now set to same font as command box
    - Normal and bold colors are now created from settings
    - Flashing style is now styled based on setting, if off will style as underline
    - Basic debug is sent to the main client when enable debug option is enabled from preferences
  - Auto copy selected text from display to clipboard when done
  - Copying from main client should be smarter, if selected text and command input is focused it will copy display, if command focused and has selected text will copy that text
  - Profile manager can now be opened using Ctrl+P
  - Profile manager now supports undo/redo systems only limited by your system's memory and cpu
  - Added some [docs](docs/README.md) to the GIT repo
  - Mapper can now be set to always be on top of client, all windows, or independent
  - Mapper import, profile import, and backup load now set windows taskbar progress bar
- **Changed:**
  - Advanced editor now uses monospaced font
  - Removed insert date/time from advanced editor context
  - Display re-coded into an iframe to fix selection disappearing when lost focus.
  - Simplified mapper image export
  - Can no longer close client until profile manager has been closed
  - Changed how deleted profiles where moved to trash, now uses framework instead of extra node module
  - Upgraded to electron 1.6.8
  - All css/js files are ran into minifiers to gain some speed
  - Help > jiMUD now opens up to the github docs
  - Changed how options are reloaded for main client, instead of a direct call, fire event
  - Rearranged the profile manager interface to simply and condense code
  - Cleaned up profile manager code to reduce size and improve load speeds
- **Fixed:**
  - Context menus in advanced editor have been converted into native context menus, fixing menus being cut off in small window size
  - When underline would remove double underline effect when following double underline ansi attribute
  - Status > Visible menu check was not updating to show current state
  - Advanced editor
    - Should strip all unsupported HTML tags when sending pasted text.
    - Will properly convert pre tags and preserve newlines
  - Profile Manager
    - When closing the profile manager it always asked to save even if no changes had been made
    - When editing a macro they where not correctly being saved
    - Better color detection for pasted formatted text, it will now attempt to find the closet color supported in the 256 colors
    - Changing the item style will now correctly change the editor mode again

## 0.1.5 - 2017-05-01

- **New:**
  - Advanced editor has been added
    - Supports full WYSIWYG style for bold, italic, underline, strikeout, and all colors by simple select text and clicking a button
    - Import a text file into editor
    - Send to mud in multi ways
      - Formatted as commands - send after formatting into color codes as standard commands with full parsing (Default)
      - Text as commands - strip all formatting and send as standard commands
      - Formatted verbatim (No echo) - send formatted with no parsing and no echo
      - Text verbatim (No echo) - strip all formatting and send with no parsing and no echo
      - Raw formatted (No echo) - send formatted text as raw data
      - Raw text (No echo) - send text as raw data
  - Basic context menu for all editable fields
  - When closing profile manager will ask to save changes when using the window close button
  - When closing client will now warn if still connected with option to never ask again
  - Added javascript aliases for OoMUD so web client scripts will work with little to no changes.
- **Changed:**
  - Minified all javascript code to try and improve speed
  - Compressed all PNG files to reduce size for loading improvements
- **Fixed:**
  - Profile manager
    - Button preview was broken in last update, now working again
    - Profiles where not deleted correctly
    - Copy/cut/paste should once again work with input areas when they have focus
  - Properly working Linux packages

## 0.1.4 - 2017-04-29

- **New:**
  - Application icon, temporary for now will create a better one in th future
  - Profile manager
    - Properly tracks all changes for future undo/redo stack
    - Ask to save changes on cancel, with option to never ask again
    - Cut/Copy/Paste/Delete now work
    - Treeview context menu
    - Import defaults will import and merge the default profile aliases, macros, triggers, and buttons if any
    - Reset will reset current profile to empty profile with default settings
    - Sidebar width should now be remembered
    - Advanced option panel on each editor will remember show/hidden state
- **Fixed:**
  - When changing enable TYPE on profile editor it would not update treeview check state
  - When saving profiles and closing, if invalid profile name supplied it would not save profile, now it will properly cancel save until name fixed
  - When cloning a profile default macros where appended.

## 0.1.3 - 2017-04-26

- **Changed:**
  - Mapper Clear/Walk path are now disabled when no path highlighted
- **Fixed:**
  - Mapper vertical and horizontal scroll where not correctly being restored on load.
  - Profile cloning was erroring do to calling the wrong collections
  - Client was emitting wrong event when new text was added to display causing
  - triggers and anything that relied on that event to fail

## 0.1.2 - 2017-04-25

- **New:**
  - Trainer mapper npc type
- **Changed:**
  - Mapper room details editor updated
- **Fixed:**
  - Mapper saving open/close state
  - Missing RGBColor module for settings dialog
  - Window size not being sent to mud when resized

## 0.1.1 - 2017-04-24

- **Fixed:**
  - Profile menu looking for a profile folder when does not exist
  - Turned off debug mode by default
- **Changed:**
  - Upgraded to electron 1.6.7

## 0.1.0 - 2017-04-24

- Initial release