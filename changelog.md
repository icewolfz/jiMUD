# Changelog

## 1.7.0 2025-07-22

- **New:**
  - Add [#FULLSCREEN](docs/commands.md#display) Enable fullscreen mode, if state is omitted it will toggle fullscreen, if state is 0 or false it will disable fullscreen, if state is anything else it will enable fullscreen
  - Allow about dialog to be resized
  - Add [#TESTSTATUS](docs/commands/commands.md#teststatus) to send commands to test the status display bar
  - Add [#TESTSCREEN](docs/commands/commands.md#testscreen) to display basic display data
  - Character manger: Add support to import zipped data file from export system
  - Mapper: Add option to reload map
- **Fixed:**
  - Code editor:
    - Fix find text context menu
    - Fix some drop downs being positioned wrong in dialogs
  - Fix resizing command input when status or button bar are hidden/shown
  - Character manger: Do not check for map database when trying to import character database
  - Mapper: Fix import merge/replace menu items as they where reversed function
  - Fix MSP telnet protocol from not working
  - Fix telnet encoding of single \n
  - Fix issues with window menu bar and fullscreen toggling
  - Fix issue when no echo and sitting at telnet prompt
- **Changed:**
  - Update electron 34.2.0 to 37.2.3
  - Update mathjs 14.2.0 to 14.5.3
  - Update electron-updater 6.6.0 to 6.6.2
  - Update better-sqlite3 11.8.1 to 12.2.0
  - Update yargs-parser 21.1.1 to 22.0.0
  - Update ace-editor 1.35.0 to 1.41.0
  - Update @electron/remote 2.1.2 to 2.1.3

## 1.6.1 2025-02-23

- **Fixed:**
  - Code editor:
    - Fix paste not working due to updates to chrome permission system
    - Fix insert color over selected text
- **Changed:**
  - Update electron-updater 6.5.0 to 6.6.0

## 1.6.0 2025-02-15

- **New:**
  - Add [client.sendChatRaw](docs/scripting.md) to send raw text to chat window
  - Add [#UNMACRO/#UNKEY](docs/commands/UNMACRO.md) to delete macros from command input
  - Status: Add color aura's to reflect buffer/fortify state
  - Composer now properly checks if you are in edit mode to avoid sending mail
  - Add `Set Default MXP on state to true` preference, Set the default state for mxp line state, when true it works more like MUSHclient and Mudlet and requires all < and > to be encoded from the mud
  - Expand [#TRIGGER](docs/commands.md#triggers)/[#BUTTON](docs/commands.md#createmodify-profile-or-items)/[#EVENT](docs/commands.md#triggers) options to allow explicit true/value support of option=true|false
- **Fixed:**
  - Fix issue with MXP image maps not correctly appending ?x,y to command
  - Fix status not removing separator between party/combat bars when party members removed
  - Preferences: Fix `Log gagged lines` not being settable
  - Backup:
    - Reset state on disconnect/reconnect
    - Fix load not displaying error messages always
  - Fix broken resize when client first used
  - Fix command input auto size when html tags in text
  - Disable MXP parsing when echoing text as echo should always be raw text and ignore MXP commands
  - Fix MXP TempSecure line mode
  - Fix MXP Reset line mode
  - Fix bug in #trigger/#action when creating new trigger
  - Fix #IF and %{if} not allowing optional else argument
  - Fix XTerm set title to properly handle other commands
  - Remove dead protocols from url detection
- **Changed:**
  - Change [client.sendChat](docs/scripting.md) to parse text then send to chat window, works like #chat now
  - Update electron 32.2.2 to 34.2.0
  - Update mathjs 13.2.0 to 14.2.0
  - Update yauzl 3.1.3 to 3.2.0
  - Update yazl 3.1.0 to 3.3.1
  - Update better-sqlite3 11.5.0 to 11.8.1
  - Update chokidar 4.0.1 to 4.0.3
  - Update fs-extra 11.2.0 to 11.3.0
  - Update electron-updater 6.3.9 to 6.5.0

## 1.5.1 2024-10-26

- **New:**
  - Code editor:
    - Update the area and virtual area wizards to better explain paths
    - Add option to hide open files on recent menu
    - Area Designer:
      - Add ctrl+click selection system
      - Fix code generation of room sounds and smells
      - Add hover previews to display monster look/item longs for room preview and monster preview panels
      - Add includes and defines to area properties
      - Add functions, inherits, includes, and defines to room editor
      - Add standard object support to add money, gems, and standard objects
      - Add argument support to objects and monsters to allow passing arguments when object is created
      - Hide water properties unless waterdrink flag enabled
      - Add monster type basic vendor and barkeep property support
      - Allow x,y format for exit destination if z is 0
    - Virtual area editor: Add ctrl+click selection system
    - Fix where data could be lost when closing window and datagrid/property editor open
    - Add normal, advanced, and expert view modes to room, monster, and object wizards to show/hide more complex pages and properties
  - Add `Simple Alarms` preference, disables using moment duration when alarm pattern matching, may give a minor speed boost if lots of alarms
  - Add [#testfiler](docs/commands.md#test-commands) works similar to [#testfile](docs/commands.md#test-commands) but will simulate as if the data was sent from a mud
  - Add `Select Last Command` preference to control if text is selected or not when keep last command enabled
- **Fixed:**
  - Increase progress dialog height
  - Fix issue when using non default theme and button bar hidden
  - Fix always on top for child windows opened outside of client
  - Fix datagrid body height issue not accounting for horizontal scroll bar
  - Advanced editor/Mail composer:
    - Fix inserted text defaulting to bold white
    - Fix YELLOW code not correctly formatting when combined with bold
    - Fix issue with stacked formats being ignored
  - Code editor:
    - No longer generate function stubs if invalid function names in (: :) values
    - Fix creating duplicate function stubs in generated code
    - Fix collection dialog editor not comparing arrays correctly
    - Fix issue when trying to read include files for peek/goto define
    - Fix formatting of mappings in generated code
    - Do not autocomplete pairs when in a string
    - Area Designer:
      - Fix type in monster resistances code
      - Room editor now remembers collapsed state
      - Fix issue where base rooms lose room types on load
    - Fix usage of advanced editor in text edit dialogs
    - Fix advanced edit text drop downs being cut off when used in a dialog window
    - Fix error tooltips not displaying correctly
    - Dialogs that validate data will no longer close until error is corrected
    - Fix new monster/room wizard titles when launched from file menu
    - Fix invalid formatting of >>= and <<= operators
  - Fix issue not respecting escape when parsing " and ' quoted strings when parse quoted enabled
  - Fix typo in MSP protocol URL parameter
  - Fix [#GAG](docs/commands.md#display) when removing multiple lines
  - Fix [#PROFILELIST](docs/commands.md#display) not correctly showing enabled state
  - Fix [%state("name|pattern", "profile")](docs/functions.md#miscellaneous) profile argument evaluated
  - Fix issue when converting background pinkfish codes to html
  - Fix sorting profile priorities with default profile
  - Fix sort profiles by alpha when priorities are the same
- **Changed:**
  - Make chat capture selective line mode ignore case
  - Code editor:
    - Hide items that only should appear when text is selected in context menu
    - Area Designer: Room property groups now sort advanced at the bottom
  - Update electron 31.1.0 to 32.2.2
  - Update better-sqlite3 11.2.1 to 11.5.0
  - Update chokidar 3.6.0 to 4.0.1
  - Update mathjs 13.1.1 to 13.2.0
  - Update electron-updater 6.3.4 to 6.3.9
  - Update yazl 2.5.1 to 3.1.0

## 1.5.0 2024-09-01

- **New:**
  - Code editor:
    - Add include path support for Go To/Peek Definition
    - Add Insert Comment Header to formatting menu to allow adding a comment header at the start of file with current date and logged in username
    - Add resistance page to monster wizard/editor
    - Area Designer:
      - Add monster preview pane to monster editor
      - Alt + numpad when auto walking enabled will clone the previous room data into the destination room
    - Virtual area editor:
      - Added explored marker for room states
      - Parse external room code better to capture more data
      - Alt + numpad when auto walking enabled will clone the previous room data into the destination room
  - Backup: Add option to back up character database and related setting files **Warning** this does not backup mapping data due to size of maps
  - Added client.getVariable(name), client.setVariable(name, value), client.setVariables(Object), client.hasVariable(name), client.removeVariable(name), these should be used to access client.variables in case client.variables is ever changed to support more complex types
- **Fixed:**
  - Fixed child windows not correctly setting new window when tab un-docked
  - Profile manager: Fixed not updating the menu bar after profile added or removed
  - Immortal tools: Fix bug in remote delete of deeply nested folders
  - Mapper: properly encode ' when used in an area name
  - Code editor:
    - Area Designer:
      - Fix bug min encumbrance not being correctly set for armors when created or edited in wizard
      - Fix monster/object editor tooltips and display previews of data
      - Fix monster editor not saving reputation data
      - Fix an issue when undoing a single room change
      - Fixed paste for Linux
      - Fixed an issue with auto resize when auto walking and not grouping undo as one action
      - Fix room counting
    - Fixed a bug in diff view not correctly setting the height
    - Fixed datagrid tooltips not updating when value changed and fall back to value formatting when customized
    - Fixed virtual area creation wizard
    - Fixed bold black and nested bold colors when generating color previews
    - Fixed virtual area 3d map adding invalid exits when created from wizard
    - Fixed resize dialog when changing level anchor
    - Fixed when closing cancel from save not preventing close
    - Fixed room/monster property code generation place temp properties as permanent properties
    - Fixed Go to Definition and Peek Definition
    - Fixed editor font list not allowing selection of system fonts
    - Fixed issue with progress dialog if completed before shown
    - Virtual area editor:
      - Change code in generation of external room to use BASEROOM define
      - Fixed extra map codes being added to rooms when building raw map files
      - Fixed terrain/state files not having correct sizes when maps resized
      - Fixed issue when opening map it would lose sub file data
      - Fixed drag and drop of text when dealing with raw text editors
      - Fixed changing external exits not correctly updating visual map
      - Fixed adding new external exit breaking last added external exit
      - Fixed an issue when undoing a single room change
      - Fixed paste for Linux
- **Changed:**
  - Update electron 31.1.0 to 32.0.1
  - Update better-sqlite3 11.1.1 to 11.2.1
  - Update mathjs 13.0.1 to 13.1.1
  - Update electron-updater 6.2.1 to 6.3.4
  - Update fswin 3.24.524 to 3.24.829

## 1.4.0 2024-06-29

- **New:**
  - Allow opening character manager from tray and tabstrip context menus
  - Active tab now has a larger top border to make it stand out and easier to know which tab is active
  - Add `tray-click` and `tray-double-click` trigger events to allow executing triggers when tray icon is clicked
  - Optimize auto login and chat triggers for better performance
  - Add `Skip more prompt` system to allow auto paging after a set amount of time
  - Add `Minimum number of lines` The minimum # of lines to display in command prompt, min of 1, max of 30 or 50% of the display screen
  - Preferences: Add a search to the advanced view for preference
  - Code editor: Add a basic session system to allow saving/opening a session for restoring groups of tabs
  - Mapper:
    - Auto walk/highlight path now support up/down directions
    - Add copy path systems to allow copying full path, as command stacked, or as a speedpath
    - Add auto walk highlighted path
- **Fixed:**
  - Prevent double close issues if saving window layout takes time
  - Fix issue with hidden windows and not correctly restoring bounds when maximized
  - Clear window title bar text when tab text is empty
  - Fix color dialog size in advanced editor in windows
  - Center color dialog contents in case OS makes window larger then contents
  - Fix closing clean up when tab closed
  - Fix layout loading when invalid parent window
  - Fix broken tabs from being hidden in the background when loading saved layout
  - Code editor: Fix issue when no tabs and ui trying to update
  - Mapper:
    - Fix bug in mouse wheel zooming out
    - Fix area drop down not updating when opening new map
    - Fix invalid area selection if area no longer exist in map, defaults to first found area
  - Correctly focus on first found text as input is typed into find dialog
- **Changed:**
  - Update electron 29.3.0 to 31.1.0
  - Convert BrowserView to WebContentsView
  - Update monaco-editor 0.47.0 to 0.50.0
  - Update mathjs 12.4.1 to 13.0.1
  - Update better-sqlite3 9.5.0 to 11.1.1
  - Update fswin 3.23.311 to 3.24.524
  - Update electron-updater 6.1.8 to 6.2.1

## 1.3.0 2024-04-22

- **Fixed:**
  - Preferences: Fix color changing erroring when colors have never been set
  - Fix focus and resize issues with new KDE 6
  - Reduce resize white border on resize for linux
- **Changed:**
  - Update electron 28.2.4 to 29.3.0
  - Update tmp 0.2.1 to 0.2.3
  - Update yauzl 3.1.0 to 3.1.3
  - Update monaco-editor 0.46.0 to 0.47.0
  - Update mathjs 12.4.0 to 12.4.1
  - Update markdown-it 14.0.0 to 14.1.0
  - Update better-sqlite3 9.4.3 to 9.5.0

## 1.2.1 2024-02-23

- **New:**
  - [#WINDOW](docs/commands.md) Add 'map' as supported short version of mapper window
  - Profile manager: Add simple search to allow searching for item/profile names/trigger patterns and similar item text
  - Code editor:
    - Add column selection mode menu toggle
    - Add waterdrink room template
    - Area designer: Add basic water drink property to side property room editor
- **Fixed:**
  - Help: Hide find in selection button as not implemented
  - Fix issue with moving items on menubars
  - Code editor:
    - Fix remote diff options not being correctly applied on first use
    - Fix remote browsing icon alignments
- **Changed:**
  - Code editor:
    - Change WATERSOURCE to WATERDRINK to avoid naming issues in code complete
    - Add waterdrink doc references to pier
    - When uploading file use current remote path + file name if no valid remote path or upload as option set
  - Update mathjs 12.2.0 to 12.4.0
  - Update electron 28.0.0 to 28.2.4
  - Update moment 2.29.4 to 2.30.1
  - Update better-sqlite3 9.2.2 to 9.4.3
  - Update @electron/remote 2.1.1 to 2.1.2
  - Update monaco-editor 0.45.0 to 0.46.0
  - Update chokidar 3.5.3 to 3.6.0
  - Update electron-updater 6.1.7 to 6.1.8
  - Update yauzl 2.10.0 to 3.1.0

## 1.2.0 2023-12-18

- **Fixed:**
  - Fix progress dialog text not updating when first shown
  - Immortal tools:
    - Fix being stuck on errored downloads or uploads
    - Fix permission denied breaking downloading of folders
    - Fix download override failing to sanitize file names when checking remote names to local
    - Fix file exist dialog overriding when bulk downloading or uploading
    - Fix file exist dialog source date and path when bulk downloading
  - Fix linux snap packages by moving to core22
  - Mapper: Fix options load bug
  - Triggers: clear regex cache when profiles are saved to prevent old ones from staying in memory
  - Profile manager:
    - Scroll to new item in treeview when added
    - When item deleted select the item before it instead of the main profile
  - Code editor: Update diff navigation to new monaco-editor systems
  - Command input:
    - Correctly insert newline at cursor position instead of at end of text
    - Fix resize when escape hit
    - Paste/Paste special no longer break undo/redo
  - Fix window tab drag over effects to highlight which tab it will be inserted at
  - Fix child windows incase one crashes does not break main client
- **Changed:**
  - Immortal tools: Make unknown download/upload error messages more verbose
  - Update fs-extra 11.1.1 to 11.2.0
  - Update electron 27.1.2 to 28.0.0
  - Update better-sqlite3 9.1.1 to 9.2.2
  - Update mathjs 12.1.0 to 12.2.0
  - Update markdown-it 13.0.2 to 14.0.0
  - Update monaco-editor 0.44.0 to 0.45.0
  - Update @electron/remote 2.1.0 to 2.1.1

## 1.1.1 2023-11-27

- **Fixed:**
  - Immortal tools: Fix build downloading
- **Changed:**
  - Update electron 27.0.2 to 27.1.2
  - Update mathjs 11.11.2 to 12.1.0
  - Update @electron/remote 2.0.12 to 2.1.0
  - Update better-sqlite3 9.0.0 to 9.1.1
  - Update electron-updater 6.1.4 to 6.1.7

## 1.1.0 2023-10-22

- **New:**
  - Add a working javascript prompt() function
  - Add [%prompt(_prompt_, _defaultValue_, _mask_)](docs/functions.md#miscellaneous) Display input prompt
  - Add [#PROMPT](docs/commands/PROMPT.md) Displays a prompt dialog to enter text and store results in variable
  - Add [#SETMAP](docs/commands/SETMAP.md) Set the map file for the current connection and open mapper with optional flag to set to character if using character manager
  - Add [%fileprompt(_filters_, _defaultPath_)](docs/functions.md#miscellaneous) Display open file dialog, returns first file path or empty string
  - Preferences:
    - `Parse commands` Enable parsing of commands from command line or sendBackground/sendCommand scripting functions
  - Advanced editor:
    - Add paste as text option to ignore all formatting
    - Add paste, paste formatted, and paste as text toolbar buttons
    - Give paste formatted its own icon
  - Code editor:
    - Toggle word wrap menu item now displays if wrap is on or off
    - Last set editor options are now saved
  - About:
    - Add support to copy paths to clipboard
    - Add error log path
  - Mapper: Allow opening of maps directly with options to set them for connection/loaded character
- **Fixed:**
  - Fix auto update progress dialog not updating title or progress state
  - Datagrid:
    - Fix datagrid edit context item
    - Make edit context item edit item clicked on instead of first selected item
  - Fix skill window drop down filter not correctly including all item on first load
  - Code editor:
    - Fix remote browse dialog file type filter drop down
    - Fix textbox context menus not working in editor only mode
    - Fix diff display not supporting word wrap
  - Advanced editor:
    - Fix not correctly storing last color when using advanced dialog
    - Fix paste formatted not saving newlines
    - Fix paste white space being stripped
    - Improve paste format bold support
  - Prevent connection timeouts from staying connected
  - Do not update client when active tab is clicked
  - Fix scroll corner font alignment issues for split scroll icon
  - Recalculate word wrap on resize sooner to reduce flickering
  - Compose mail:
    - Fix not correctly storing last color when using advanced dialog
    - Fix paste formatted not saving newlines
    - Fix paste white space being stripped
    - Improve paste format bold support
    - Fix loading of options setting wrong fonts and flashing effects
  - Child windows: Improve document titles by including character name/development tags in more places
  - About: Fix open theme folder
  - Fix connection if dns lookup fails by correctly closing it
  - Fix on some reconnects not resetting logs, button states, and icons/titles
  - Character manger: Fix mapper not resetting to default map when loading global as current tab
  - Mapper:
    - Only update the loaded map once when options loaded
    - Save current room changes before switching maps
  - Input parser: Fix bug when splitting by quotes and empty string
- **Changed:**
  - Update electron 21.4.2 to 27.0.2
  - Update mathjs 11.6.0 to 11.11.2
  - Update fs-extra 11.1.0 to 11.1.1
  - Update better-sqlite3 8.1.0 to 9.0.0
  - Update monaco-editor 0.36.1 to 0.44.0
  - Update @electron/remote 2.0.9 to 2.0.12
  - Update electron-updater 5.3.0 to 6.1.4
  - Update markdown-it 13.0.1 to 13.0.2
  - Adjust window resize systems to only adjust clients and send data after all resizing has stopped

## 1.0.1 2023-03-14

- **Fixed:**
  - Tray context menu hide show/hide all windows if only 1 window exists for simple menu
  - Fixed error when theme file not found
  - Fixed default paths for themes, sounds and logs for non window systems
  - Immortal tools:
    - Fixed issue with drop down path navigation on linux with duplicate paths listed
    - Display / as root name instead of a blank entry on linux
  - Code editor:
    - Fix toggle word wrap
    - Fix spell checker snippet insert not adjusting old marker lines
- **Changed:**
  - Update better-sqlite3 8.1.0 to 8.2.0
  - Update fswin 3.23.119 to 3.23.311
  - Replace font-list with native queryLocalFonts

## 1.0.0 2023-03-05

- **New:**
  - Preferences:
    - `Enable tab completion` Enable tab complete, when enabled pressing tab will complete the current word form the last lines of buffered text
    - `Tab completion buffer limit` The number of buffered lines to use for tab completion
    - `Ignore case for tab completion` Ignore letter cashing when searching for matching words
    - `Tab completion list` Custom list of words to prepend, append, or use for tab completion
    - `Tab completion lookup type` Where to look up tab completion
      - `Prepend list to buffer` Prepend completion list to buffer for look up
      - `Append list to buffer` Append completion list to end of buffer for look up
      - `Buffer only` Use buffer only for look up
      - `List only` Use tab completion list only for look up
    - `Tab completion replace casing` The casing to use for the tab completion
      - `Original` Use the words original casing
      - `Lower case` Convert to all lower case
      - `Upper case` Convert to all upper case
    - `Enable Notifications` Enable notifications, effects [#notify](commands.md#Miscellaneous) and [client.notify](scripting.md)
    - `Echo` Determine what echos to the screen
      - `Triggers` Echo trigger pattern to screen if fired, **Warning** this may cause infinite looping if pattern is exact matching
      - `Scripts` Echo script type values to the screen before they are executed
      - `Commands` Echo #commands to the screen
    - Command line:
      - `Auto size to contents` Resize command input height based on contents
      - `Word wrap` Wrap long lines in command input
      - `Scrollbars` Add scrollbars when needed to command input
    - `Character Manager Add Button Action` Control the action of the add button
    - `Enable crash reporting` Enable crash reporting, will save mini dump files to local by default to {data}\Crashpad
    - `Ignore leading whitespace` Ignore leading whitespace for commands and aliases
  - Code editor:
    - Add right click spell check support for systems that support it
    - Add basic spell checking
    - Add problem panel to display all errors and misspellings
  - Add basic mail composer dialog to allow mailing to players easier
  - Character manger: Ability to resize left panel using a drag and drop bar
- **Fixed:**
  - Display:
    - Round word wrap widths to prevent floating point math errors
    - Fix word wrap calculations for long urls
    - Fix incorrect selection width for certain text style combinations
  - Code editor:
    - Fix goto line to correctly scroll to when clicking an error from output window
    - Fix tab strip to scroll when a tab is dragged over scroll buttons
    - Fix goto/peek Definition menu and context items
    - Fix tab strip dropdown menu height when output panel visible
    - Fix text search to focus on find dialog when using current selected text
    - Cleanup help menu items
    - Fix help dialog when using editor only mode
    - Fix opening virtual areas and missing new flag
  - Interface:
    - Fix tab strip to scroll when a tab is dragged over scroll buttons
    - Command input box resizes correctly to set font size to a max of 50% window height
    - Fix issues when dragging and dropping tab onto another client window
  - Command input:
    - Send command only on enter key and no modifiers held down
    - Allow history navigation only if no modifier keys are held down, fixing shift selection support
    - Newline shortcut now correctly scrolls to the empty line
    - Fix command stacking when using command character not correctly stacking
    - Fix #command parsing when command does not exist to correctly parse all text after the # character
  - Fix alias, macro, and trigger script type to use inherited showScriptErrors setting correctly
  - Fix context menu script type 'this' error
  - Profile manager: Fix cut marking items in newly expanded profiles with wrong state style
  - Input:
    - Add safety checks in case game pads were not correctly detected
    - Correctly build game pad data when setting changed and only save data if setting enabled
  - Fix serializing of window layout child window paths to save relative to the open jiMUD making it easier to port data to new computers
  - Fix template paths with mixed cases in windows and mac
  - Character manger: Select new character and focus on login field when created
  - Fix drag-grip being cut in half
  - Fix Tab and window title not being correctly set when drag and dropped
  - Immortal tools:
    - Fix queue panel drag and drop not factoring in status bar height
    - Fix batch downloading of folders an files
    - Fix issue with remote dropdown path list
  - Help:
    - Search correctly goes to first found result when text changed
    - Fix search scrolling offsetting main help window
  - Backup:
    - Fix importing of paths when not defined
    - Fix importing settings
  - Progress: Fix progress dialogs
  - Mapper: Fix export, remove, and other related buttons/menu items
  - Parser: Fix appending undefined before unknown functions when using %{} scripting when expressions are disabled
  - Fix window closing after opening dialogs attached to a main window instead of clients
- **Changed:**
  - `Character manager on row double click load in:` Now defaults to open in new tab
  - Character manger:
    - New icon for new tab button
    - Set a minimum width and height for when window is resized
  - Display: Adjust word wrap break points to have better flow
  - Update electron 19.1.5 to 21.4.2
  - Update mathjs 11.3.3 to 11.6.0
  - Update better-sqlite3 7.6.2 to 8.1.0
  - Update fs-extra 10.1.0 to 11.1.0
  - Update @electron/remote 2.0.8 to 2.0.9
  - Update fswin 3.22.106 to 3.23.119
  - Update monaco-editor 0.34.1 to 0.36.1
  - Update lz-string 1.4.4 to 1.5.0
  - Advanced editor: Remove bold style as ansi uses colors instead

## 1.0.0-alpha 2022-11-15

- **New:**
  - New Multiple Document Interface:
    - Allows multiple clients to be docked in one window with tabbed interface or separate windows
    - Full drag and drop support between windows of the same instance
    - Color coded tabs based on client activity
    - Tab icons based on main or dev connection
    - Overall reduced memory and performance speed ups
    - Remembers all last open clients and child windows
    - Can save current layout to be loaded as it was saved
    - Changed how child windows interact with clients to improve between window lag
  - Character manager:
    - Now uses sqlite as backend
    - Reduced memory and load times
    - Tracks connection time
    - Keeps last connected date
    - Import old character manager data and rename old to .bak
      - Name is now the only way to set login name, the text displayed in the list is now just a display title for easy sorting
      - Notes is now a tracked file path like settings and map and can be changed by the user
      - All new characters will use a unique generated id number instead of title or name for data files to prevent sharing files by default
    - New toolbar buttons to open characters or profiles folder
  - Command line arguments:
    - Added [-l/--layout](docs/README.md) to allow loading of a saved layout
    - Added [-il/--ignore-layout](docs/README.md) to ignore loading last used layout or --layout
    - Added [-el/--error-log](docs/README.md) to allow setting custom error log files
    - `-data-dir` now supports relative paths and will attempt to resolve them based on the current working directory of the application
  - Preferences:
    - Preferences now uses an inherit system of Default < Global < Client, where it will drill down to default depending if the client or global values are not set, this system allows you to set the global value and all clients will use that setting unless they have already set it
    - Add an advanced view for editing
    - `Show add new button next to tabs` add a button to allow creation of new connections from tab strip, _Global preference_
    - `Lock layout` saving only the last known global window states and preserve the previous saved windows and clients opened, _Global preference_
    - `Load layout on open` set a layout file to use when loading client, _Global preference_
    - `Use only single instance` Allow only one instance of the application to open, _Global preference_
    - `On second instance` What to do whe na second instance is opened when `Use only single instance` is enabled and no command line arguments passed, _Global preference_
    - `Display control codes` Display unreadable characters, code < 32 || 127 as visual characters
    - `Emulate terminal extended characters` Enable/disable Terminal IBM/OEM (code page 437) extended characters, will convert them to the correct unicode character in an attempt to display like classic terminal
    - `Emulate control codes` Emulate control codes: bell, tab, backspace, escape
    - `Clear advanced editor on send` clear the advanced editor after sending text to the mud
    - `Close advanced editor on send` close the advanced editor after sending text to the mud, **Note** If Persistent is enabled this will merely hide the editor until next use
    - `Word wrap` wrap long lines of text, added for chat and main display
    - `Word wrap column` wrap lines at a fixed character column, added for chat and main display
    - `word wrap indent` indent wrapped line with the set amount of spaces, added for chat and main display
    - `Expression engine` Which expression engine to use when executing expressions, this changes how mathjs library is executed
    - `Initialize expression engine on load` Initialize the expression engine on client load instead of on first use, enabling this can cause client to load slower but can speed up first use of an expression
    - `Character manager on row double click load in:` Determine how to load a character when a row is doubled clicked in character manager
  - `#connecttime` now displays last disconnect time when possible if disconnected
  - Chat:
    - Window display now uses global theme for display scroll bars
    - Title bar now displays connected character name when possible
    - All internal errors should now be logged to error log file
    - Add ability to scroll lock the screen using a toggle button or scroll lock key
    - Find dialog settings are now saved and restored
  - Add [#WINDOW](docs/commands.md) close and new argument support
  - Add [#CLOSE](docs/commands.md) close an open window
  - Add [#ALL](docs/commands.md) send commands to all client windows as if sent from command line
  - Add [#TAB](docs/commands.md) Create a new client tab in current window
  - Add [#NAME](docs/commands.md) Set name for current tab or client id
  - Add [#ID](docs/commands.md) Display client id
  - Add [#CLEARNAME](docs/commands.md) clear current tab or client id's name
  - Add [#TO](docs/commands.md) Send commands to target client name/id
  - Add [#WRAP](docs/commands.md) Toggle word wrap and set the wrap column to number if supplied, if number is 0 disables wrap at column
  - Add [client.id](docs/scripting.md) return client id
  - Add [client.setName](docs/scripting.md) set client name
  - Add [client.getName](docs/scripting.md) return client name
  - Add [client.clearName](docs/scripting.md) clear client name
  - Add [client.sendAll](docs/scripting.md) for scripting to send text to mud for all client windows
  - Add [client.sendAllRaw](docs/scripting.md) for scripting to send raw text to mud for all client windows
  - Add [client.sendAllCommand](docs/scripting.md) for scripting to send command to all client windows
  - Add [client.sendAllBackground](docs/scripting.md) for scripting to send command to all client windows
  - Add [client.sendTo](docs/scripting.md) for scripting to send text to mud for all client windows
  - Add [client.sendToRaw](docs/scripting.md) for scripting to send raw text to mud for all client windows
  - Add [client.sendToCommand](docs/scripting.md) for scripting to send command to all client windows
  - Add [client.sendToBackground](docs/scripting.md) for scripting to send command to all client windows
  - Add [client.closeWindow](docs/scripting.md) for scripting to close an open window/tab
  - Add [${clientid}](docs/functions#predefined-variables) return current client id
  - Add [${clientname}](docs/functions#predefined-variables) return current client name
  - Add [%clientname(_name_, _id_)](docs/functions.md#miscellaneous) Return or set the client name
  - Add [$action](docs/functions#predefined-variables) Last triggered action executed
  - Add [$trigger](docs/functions#predefined-variables) Last text, event, or pattern that caused last trigger to fire
  - Add [$caption](docs/functions#predefined-variables) returns the executing item's caption, only set for buttons and context menu items
  - Add [$characterid](docs/functions#predefined-variables) returns current character id for client
  - Mapper:
    - Room editor panel is now resizable
    - Title bar now displays connected character name when possible
    - All internal errors should now be logged to error log file
  - Immortal tools:
    - File overwrite system has been added for all but uploading paths
    - Title bar now displays connected character name when possible
  - Advanced editor, Skills, Profile manager, Command history:
    - Title bar now displays connected character name when possible
  - Add tab character width control for main and chat display
  - Profile manager:
    - All internal errors should now be logged to error log file
    - File item to open profile folder
  - Log viewer: All internal errors should now be logged to error log file
  - Find dialog is now movable to allow you to see text under it if need be
  - Add `{profiles}` to path parsing to allow using profiles folder easier
  - About: Add path tab that list data, profiles, and character paths with buttons to directly open them
- **Fixed:**
  - Fixed --data-dir by normalizing the path to ensure all / and \ are correct for target os
  - Fixed a bug in parsing #command arguments and quotes
  - Immortal tools:
    - Fixed issue with multiple events not correctly working
    - Fixed issue when remote path was cut and it force updated the file list
    - Fixed corruption issue when attempting to get multiple directory listings at once, now queues directory calls and updates as needed
  - Profile manager:
    - Fixed code editor spell checking replacement
    - Fixed treeview checkboxes for none selected items effecting selected item
  - Fixed #wait error when followed by trailing whitespace
  - Profiles: Fixed loading of copied profile data files not correctly loading
  - Code editor:
    - Fixed upload cancel button
    - Fixed Area designer/Virtual area property drop downs shifting editors
  - Display:
    - Fixed MXP image hspace and vspace parsing
    - Fixed window character height and width smaller then should be
    - Fixed not tracking highlight all setting for find
    - Fixed scroll to end state when window resized or large amount of text added when non split view enabled
    - Fixed display control character unicode symbol being wrong ones
    - Fixed finder current overlay to display correctly when highlight all enabled
    - Fixed finder regular expression button being set to active in correctly
    - Fixed toggle split view button/scroll corner losing text selection when clicked
    - Fixed link not styling overline, strike-though, and related combinations
  - Logging:
    - Fixed logger not enabling/disabling when changed from settings dialog
    - Fixed logger not enabling/disabling on load
  - Help files: Add missing logging preferences
  - Fix number input type boxes in preferences dialog not correctly saving some values
  - Chat:
    - Fixed copy button always being disabled
    - Fixed capturing of immortal tells when hidden
    - Fixed bug in display breaking when zoomed
  - [#LOOP](docs/commands.md) now throws an error when an invalid range is supplied
  - Fixed a bug when executing context menus and corrupting script variable stack
  - Fixed issue with corrupted ansi codes when displaying local text
  - Ansi Parser: Add safety checks for malformed ansi codes
- **Changed:**
  - All dark icons now have a white stroke to make them work better with dark mode and dark colors
  - Preferences that are now global:
    - `Spellchecking` can only now be set as a global preference and requires a restart to effect any already opening clients or windows as it can only be set on window creation
    - `Theme` only the global preference theme will be used for all clients
    - `Enable warning dialog when loading a character from manager` easier to just use global setting when dealing with character manager
  - Preferences: Remove `Enable warning dialog when closing client and child windows are open` as each child window now has it's own close rules
  - Removed character auto load system as it was limited, replaced with saveable layout that can remember all open characters and reload them based on settings
  - Command line arguments:
    - Changed -s/--setting to set the global preference file to use
    - Changed -m/--map to set working global map file for generic new connections
    - Changed -c/--character to support # ids
    - Removed -mf argument to keep argument name scheme flowing
    - Removed -pf/--profiles as no longer supported, use character manager with per user settings
  - Mapper: Switch room editor to property grid control
  - Update electron 19.1.1 to 19.1.5
  - Update electron-updater 5.2.1 to 5.3.0
  - Update mathjs 11.2.1 to 11.3.3
  - Update monaco-editor 0.34.0 to 0.34.1

## 0.19.6 2022-10-2

- **Fixed:**
  - Fixed disconnect dialog when window size is small
  - Immortal tools: Fixed error when navigating by using keyboard
  - Code editor: Fixed bugs in tabstrip
  - Command line arguments:
    - Fixed --profiles/-pf not loading new profiles and only setting already loaded profiles as enabled
  - Remove `Hide On Minimize` hack as electron fixed minimize event and hack now breaks linux when option enabled
  - Display: revert a performance fix that added flicker
- **Changed:**
  - Update electron 19.0.16 to 19.1.1
  - Code editor:
    - Virtual area editor: When creating a new virtual area will create a separate terrain and state file to reduce file size instead of one large map file
    - Area designer: Compress design files using gzip to save space

## 0.19.5 2022-09-14

- **Fixed:**
  - Immortal tools: Fixed a bug introduced in 19.4 performance updates
- **Changed:**
  - About: rename memory tab to resources
  - Exclude a bundled module to make packaged size smaller
  - Update mathjs 11.2.0 to 11.2.1

## 0.19.4 2022-09-12

- **New:**
  - Profile Manager: Add a break out editor for trigger pattern to allow easier editing of more complex patterns
- **Fixed:**
  - Auto update: close download dialog when error happens
  - Fixed an issue that caused window to now close correctly, causing the main window to hang and requiring a second close
  - Code editor: Fixed bugs in tabstrip
  - Command line arguments:
    - Fixed --map/-mf not correctly setting the map file and breaking settings
    - Fixed --profiles/-pf not correctly setting the profile list and breaking settings
    - Fixed --character/-c when more then one is set, now if more then one, only first is used
    - Fixed --editor/-e to work and load new files in code editor while opening default client
  - Fixed issues with display scrollbar corner in several themes
- **Changed:**
  - Update electron 19.0.14 to 19.0.16
  - Switch mathjs from module to script to speed up load times
  - Update mathjs 11.1.0 to 11.2.0
  - Convert several internal functions into async to speed up load times

## 0.19.3 2022-08-27

- **New:**
  - [Preferences](docs/preferences.md):
    - Add `MSP: max retries on error`, Amount of retries to attempt play a file before stopping
- **Fixed:**
  - Fixed alarm wildcard patterns that have no # eg _:_:30 would fire every 30 seconds but errors as it fails to parse the _:_: right, _:_:30 should be the same as just 30
  - Fixed alarm error invalid formats to use disableTriggerOnError when enabled
  - Profile manager: Fix trigger tester failing on multi group optional triggers
  - Fixed %x# variables when multi group optional trigger pattern used
  - Fixed #show and #showprompt breaking telnet ops when split buffer happens
  - Fixed Linux icon not being correctly set in built packages, use mac icns file instead to generate all the correct files, fixes AppImage icons and others
  - Fixed ansi parsing when remote data is split and appending local text to prevent split ansi codes
  - Added an error check to context menu if unable to determine focused control to fall back to default context menu
  - [Preferences](docs/preferences.md):
    - Fixed reset not working
    - Fixed log viewer window options not being saved always
  - MSP: Fixed rare instant where volume or playing status would be wrong due to loading taking awhile from async loading of data
- **Changed:**
  - Update electron 19.0.13 to 19.0.14
  - Update mathjs 11.0.1 to 11.1.0

## 0.19.2 2022-08-17

- **New:**
  - Code editor:
    - Line count is now displayed in the status bar after file length
    - Area designer: Add \${rms}, \${mon}, \${std}, \${obj}, \${cmds} variables for exit destinations
    - New code overlay icon for editor only when used on windows
- **Fixed:**
  - Code editor:
    - Fixed text color for select dropdowns for selected items being hard to read
    - Monster wizard: Fixed not correctly clearing out monster type list
    - Datagrid: Fix some editor width issues being cut off by buttons
    - Fixed issue when closing resize dialog caused focus to be lost
    - Virtual area editor:
      - Used state data instead of terrain data when updating terrain data
      - Fixed room editor not updating after changing terrain or item indexes
      - Fixed undo/redo when multiple rooms are changed at one time
      - Fixed undo/redo not changing synced item index with terrain index
      - Fixed undo/redo when map is shrunk and rooms deleted
      - Fixed resize map issues when odd numbered dimensions and center
    - Area designer:
      - Fixed undo/redo when multiple rooms are changed at one time
      - Fixed exit paths when using the area path, std, mon, cmds, obj paths to reduce duplicate defines
      - Fixed room editor not updating after changes
      - Fixed room preview not updating when some items changed
      - Fixed room preview object line not clearing when 1 item and set to 0 after being set to 1
      - Fixed undo/redo when map is shrunk and rooms deleted
      - Fixed resize map issues when odd numbered dimensions and center
  - Fix Auto create character system
  - Fix sub windows not getting load-char event when loading a new character
  - Fix issue with about dialog and memory display for non window systems
- **Changed:**
  - Code editor:
    - Find will now update to current selection when using shortcut or menu items
    - Editor only mode window icon will now have a code icon overlay on windows, and set the icon to code icon on linux
  - Update electron 19.0.8 to 19.0.13
  - Update mathjs 10.6.4 to 11.0.1
  - Update electron-updater 5.0.5 to 5.2.1
  - Update monaco-editor 0.33.0 to 0.34.0
  - Update yargs-parser 21.0.1 to 21.1.1

## 0.19.1 2022-07-20

- **New:**
  - Code editor:
    - Virtual area editor:
      - Add flip area horizontally, vertically, or by depth
    - Area designer:
      - Add flip area horizontally, vertically, or by depth
- **Fixed:**
  - Character manager: Fix context menu items not working
  - Code editor:
    - Virtual area editor:
      - Resize did not correctly shift external exit coordinates based on anchor settings
      - Fix edit menu items not being added
      - Fix resizing breaking external exit table editor
      - Fix undo for external exits set by room editor
    - Area designer:
      - Fix edit exit context menu item not opening exit editor dialog
      - Fix not marking map as changed when resized
  - Fixed a minor error when trying to update interface before client has finished loading
- **Changed:**
  - Update better-sqlite3 7.5.3 to 7.6.2
  - Update moment 2.29.3 to 2.29.4
  - Update electron 19.0.7 to 19.0.8

## 0.19.0 2022-07-04

- **Fixed:**
  - Code editor: Virtual area editor:
    - Fixed infinite loop when building terrain and state data
- **Changed:**
  - Linux 32bit is no longer supported
  - Update electron 17.3.1 to 19.0.7
  - Update electron-updater 4.6.5 to 5.0.5
  - Update better-sqlite3 7.5.0 to 7.5.3
  - Update moment 2.29.2 to 2.29.3
  - Update mathjs 10.4.2 to 10.6.4
  - Update markdown-it 12.3.2 to 13.0.1
  - Update fs-extra 10.0.1 to 10.1.0

## v0.18.1 2022-04-04

- **Fixed:**
  - Character manager: Fix name list not scrolling
- **Changed:**
  - Update electron 17.0.1 to 17.3.1
  - Update @electron/remote 2.0.4 to 2.0.8
  - Update fs-extra 10.0.0 to 10.0.1
  - Update yargs-parser 21.0.0 to 21.0.1
  - Update mathjs 10.1.1 to 10.4.2
  - Update monaco-editor 0.32.1 to 0.33.0
  - Update moment 2.29.1 to 2.29.2

## v0.18.0 2022-02-16

- **New:**
  - New speed path system, adds option to group by amount of commands, and the delay between each group
  - [Preferences](docs/preferences.md):
    - [Delay between path commands](docs/preferences.md#scripting) The amount of milliseconds between sending of path commands for speed paths.
    - [Amount of path commands to send](docs/preferences.md#scripting) the # of commands to send between speed path delay
    - Speedpaths:
      - [Echo](docs/preferences.md#scripting-characters) echo each command to the screen as they are sent
      - Parsing of speed paths now allows you to use ( ) or { } to group a command, eg !2(n;w) would send n;w twice
  - Character manager: Notes field has been added to allow you to add notes that can be edited, they are saved directly to a file in character folder named character.notes, by saving directly to file it avoids keeping large amounts of text loaded into memory
  - Add [%charcomment(text)](docs/functions.md#miscellaneous) to allow appending comments to character notes or getting notes field
  - Add [%charnotes(_string_)](docs/functions.md#miscellaneous) to allow setting notes or getting notes field
  - Profile manager: double clicking an item in treeview will now toggle expand or collapse state
- **Fixed:**
  - Try to make sure window size is sent to the mud more accurately
  - Optimize debounce systems so it is cleaner and runs less
  - Mapper: Default to 1 if [Directions to send](docs/preferences.md#mapper) is ever less then 1 so auto walk path sent always
  - Remove extra `Enable Double Parameter Escaping` from preferences dialog.
  - Immortal tools: fix minor bug in remote drag and drop download
  - Profile manager: Fixed issue when sub item group was selected and profile option changed that would cause treeview to replace sub item with profile
- **Changed:**
  - Profile manager: sort profiles by priority sort if set, then alpha always, ignore index as profiles are stored by name
  - Update electron 16.0.8 to 17.0.1
  - Update monaco-editor 0.31.1 to 0.32.1
  - Update fswin 2.21.1015 to 3.22.106
  - Update electron-updater 4.6.1 to 4.6.5

## v0.17.7 2022-02-02

- **New:**
  - Add [#COMMENT](docs/commands.md#miscellaneous) does nothing, used to create quick comments in scripts
  - Add [#NOOP](docs/commands.md#miscellaneous) does nothing, will expand arguments and execute any functions but return nothing to the screen
  - Add [#UNACTION](docs/commands.md#triggers) same as [#UNTRIGGER](docs/commands.md#triggers)
  - Add [#TEMP](docs/commands.md#triggers) create a temporary trigger
  - Add [%clip(string)](docs/functions.md#miscellaneous) return or set text on clipboard
  - [Preferences](docs/preferences.md):
    - Add [Ignore Eval Undefined](docs/preferences.md#scripting) Will cause undefined results to be ignored if enabled, else it will be converted to a string and the word undefined displayed
    - Add [Allow Comments From Command](docs/preferences.md#scripting) Allow inline and block comments from the command input
    - Add [Inline Comment String](docs/preferences.md#scripting--special-characters) The 1 or 2 character string for inline comments
    - Add [Enable Inline Comment](docs/preferences.md#scripting--special-characters) disable inline comment support
    - Add [Block Comment String](docs/preferences.md#scripting--special-characters) The 1 or 2 character string for block comments, ending block comment is string reversed
    - Add [Block Inline Comment](docs/preferences.md#scripting--special-characters) disable block comment support
    - Add [Save Trigger State Changes](docs/preferences.md#advanced--profiles) Add option to control if state changes are saved every time they change
    - New Advanced sub page for all profile related preferences.
    - Add [Group profile saves](docs/preferences.md#advanced--profiles) and [Group profile save delay](docs/preferences.md#advanced--profiles) to allow grouping of profile saves
    - Add [Return newline on empty value](docs/preferences.md#advanced--profiles) Return new line if processed item value is empty
  - [Triggers](docs/profiles.md#triggers)
    - Add `Loop Expression` trigger type
    - Add `ReParse` and `ReParse Pattern` sub type triggers
    - Add `Manual` sub type, can only be fired using [#SET](docs/commands.md#triggers) command
    - Add `Wait` sub type trigger
    - Add `Duration` sub type trigger
    - Add `Skip` sub type trigger
    - Add `Loop Lines` sub type trigger
    - Add `Loop Pattern` sub type trigger
    - Add `Within Lines` sub type trigger
  - Add [#TRIGGER](docs/commands.md#triggers) and [#CONDITION](docs/commands.md#triggers) short options for type=value
- **Fixed:**
  - Added type checks to [#ADD](docs/commands.md#miscellaneous) and [#MATH](docs/commands.md#miscellaneous) to ensure the resulting value is a number
  - Added type check to [#CASE](docs/commands.md#conditionals) and [#REPEAT](docs/commands.md#repeating-and-loops) to ensure the value is a number
  - Fixed bug in multi state triggers when sub trigger is disabled
  - Fixed issue where temp triggers or re-parse type triggers would be double executed if the pattern was in trigger value
  - Fixed issue with temp alarms and re-parse issues with [#SET](docs/commands.md#triggers) fire state setting
  - Fixed [Disable trigger on error](docs/preferences.md#scripting) when a sub trigger errors
  - Only update button bar is buttons have been changed
  - Only update context menus when menus have been changed
  - Fixed bugs in [#GAG](docs/commands.md#display)
  - When context menu item, button from bar, or url is clicked focus on command input if [Focus to command input on click](docs/preferences.md#display) enabled
  - Profile manager: Add new functions and commands to editor highlight and documents
- **Changed:**
  - [Triggers](docs/profiles.md#triggers), [Buttons](docs/profiles.md#buttons), [Macros](docs/profiles.md#macros), [Context](docs/profiles.md#context), and [Aliases](docs/profiles.md#aliases) values will now be ignored if empty, thus not creating blank lines, you can use a value of ${cr} to send a blank line
  - [#ADD](docs/commands.md#miscellaneous) will default to 0 if variable is not defined and define variable
  - Update electron 16.0.7 to 16.0.8
  - Update @electron/remote 2.0.1 to 2.0.4
  - Update mathjs 10.1.0 to 10.1.1

## v0.17.6 2022-01-24

- **New:**
  - Add [%alarm("name|pattern", setTime, "profile")](docs/functions.md#miscellaneous) return or set the time for alarm with name or matching pattern
  - Add [#FIRE text](docs/commands.md#triggers) Send text to trigger system as if received from the mud, triggering matching triggers with out displaying to screen and effecting current last line
  - Add [#STATE name|pattern state profile](docs/commands.md#triggers) Set the state of a trigger
  - Add [#SET name|pattern state value profile](docs/commands.md#triggers) Set the fired state of a trigger
  - Add [#CONDITION name|pattern {pattern} {commands} options profile](docs/commands.md#triggers) create a new trigger sub state, if name or pattern is omitted state will be added to last created trigger
  - Add [#CR](docs/commands.md#miscellaneous) Send a blank line to the mud
  - Add [#SEND](docs/commands.md#miscellaneous) Send file to mud line by line pre-pending and appending supplied prefix and suffix to each line as if sent from command input, if not a valid file sent as text if from command input
  - Add [#SENDRAW](docs/commands.md#miscellaneous) Send raw text or file directly to mud with out parsing or echoing to the screen appending a newline if needed
  - Add [#SENDPROMPT](docs/commands.md#miscellaneous) Send raw text directly to mud with out parsing or echoing to the screen with no appended newline
  - Add [#UNVAR name](docs/commands.md#createmodify-profile-or-items) Delete variable
  - Add [#ACTION](docs/commands.md#triggers) same as [#TRIGGER](docs/commands.md#triggers)
  - Add [#CHARACTER](docs/commands.md#miscellaneous) send current character to the mud, without echoing to the screen
  - Add [#SPEAK text](docs/commands.md#sounds) speak text using text to speech systems
  - Add [#SPEAKSTOP](docs/commands.md#sounds) stop speak and clear all queued
  - Add [#SPEAKPAUSE](docs/commands.md#sounds) pause speaking
  - Add [#SPEAKRESUME](docs/commands.md#sounds) resume speaking
  - Add [%state("name|pattern", "profile")](docs/functions.md#miscellaneous) Returns the current trigger state of the trigger given by the name or pattern, if no profile it will search all enabled profiles until match found
  - Add [%defined(name,type)](docs/functions.md#miscellaneous) is item defined, similar to isdefined
  - Add [%isnull(value)](docs/functions.md#string) return if value is null or not if value omitted returns null
  - Add [%stripansi(string)](docs/functions.md#string) Strip all ansi codes from strip
  - Mapper: Add `Edit > Reset map` to allow users to delete and create a fresh map file
  - Profile Manager: Parse style now has basic code folding
  - Multi State triggers - Allows you to create multi line or conditional triggers
    - Full profile manger support to add, edit, reorder, delete each state
- **Fixed:**
  - Profile manager:
    - Profiles are now sorted according to the [Profile manager sort order](docs/preferences.md#advanced--profile-manager) and [Profile manager sort direction](docs/preferences.md#advanced--profile-manager) settings like items
    - Fixed context menu editor icon sample width
  - Fixed [#TRIGGER](docs/commands.md#triggers) name syntax not working
  - Fixed [#UNTRIGGER](docs/commands.md#triggers) failing when trying to remove when only 1 profile exist
  - Fixed extra new lines being added when parsing text in the middle of triggers
  - Fixed temporary triggers and [#UNTRIGGER](docs/commands.md#triggers) some times removing trigger from wrong profile
  - Fixed issue with client.echo, client.sendCommand, and client.sendBackground when used in script type and passing non string values
  - Fixed Trigger alarms to be more accurate and not double fire some times
  - Fixed Trigger alarms always being stuck in wildcard mode, should require \* explicit to execute wildcards
  - Fixed auto connect when loading same character again
  - Fix profile loading issues for [#TRIGGER](docs/commands.md#triggers), [#UNTRIGGER](docs/commands.md#triggers), [#EVENT](docs/commands.md#triggers), [#UNEVENT](docs/commands.md#triggers), [#BUTTON](docs/commands.md#createmodify-profile-or-items), [#UNBUTTON](docs/commands.md#createmodify-profile-or-items), [#ALARM](docs/commands.md#riggers), [#ALIAS](docs/commands.md#createmodify-profile-or-items), [#UNALIAS](docs/commands.md#createmodify-profile-or-items)
  - Fix parsing of some arguments for [#TRIGGER](docs/commands.md#triggers), [#UNTRIGGER](docs/commands.md#triggers), [#EVENT](docs/commands.md#triggers), [#BUTTON](docs/commands.md#createmodify-profile-or-items)
  - Fixed [%ansi(style,fore,back)](docs/functions.md#miscellaneous) for bold,color making it backgroound instead of bold fore color
  - Fixed [%time(format)](docs/functions.md#miscellaneous) not being parsed
- **Changed:**
  - Display: split bar highlights when mouse over and when being moved
  - [#TRIGGER](docs/commands.md#triggers) add/update message no longer contains name or pattern to prevent trigger from accidentally triggering
  - Reformat [functions](docs/functions.md) doc layout
  - Update electron 16.0.6 to 16.0.7
  - Update font-list 1.4.3 to 1.4.5
  - Update mathjs 10.0.2 to 10.1.0
  - Update better-sqlite3 7.4.6 to 7.5.0
  - Update chokidar 3.5.2 to 3.5.3

## v0.17.5 2022-01-10

- **New:**
  - Add [%escape(string)](docs/functions.md#string) escape all characters in string if escaping is allowed and if those characters need escaping
  - Add [%unescape(string)](docs/functions.md#string) strip escape characters from string if escaping is allowed and those characters are enabled
  - Add $selectedword, $selword, $selectedurl, $selurl, $selectedline, $selline, $selected, $character, $copied for direct access in expressions
  - Add versions of most predefined functions to the expression system to allow for inline usage using [%eval](docs/functions.md#math) or in math, note this is not always the same as full expanded form of ${function(args)} as that will process in the command parsing system while when used with eval or math expressions it will be parsed with the expression engine instead
  - [Preferences](docs/preferences.md):
    - Add [Profile to select on load](docs/preferences.md#advanced--profile-manager) pick which profile is auto selected when profile manager opened
    - Add [Expand selected profile on load](docs/preferences.md#advanced--profile-manager) auto expand selected profile when profile manager opened
- **Fixed:**
  - Input parser:
    - Correctly escape function arguments when quoting arguments with respect to scripting quote settings
    - Use custom escape character when splitting function arguments with quotes
    - Fix escaping of command stack when used in a path, after a function, or alias
    - Fix issue when parsing command arguments ending with a newline
  - Fix dice when using fudge dice
  - Fix dice when using #d% returning 1d100 instead of a % of 0 to 1
  - Fix parsing of sub context menus
  - Fix $selectedword, $selword, $selectedurl, $selurl, $selectedline, $selline, when used from command line to use mouse position to correctly get the selected word,line, or url
  - Fix [#CW](docs/commands.md#display), [#COLOR](docs/commands.md#display), [#HIGHLIGHT](docs/commands.md#display) trigger creation syntax to use set command character instead of hard coded #
  - All #command error messages now correctly use the set command character when displaying syntax
  - Make [#VARIABLE](docs/commands.md#createmodify-profile-or-items) respect strip quote settings when storing value
  - Display: issues with overlays and Unicode background selection sizes
  - Fixed code editor not being correctly restored if already open
  - Help: Fixed command page links
- **Changed:**
  - Error messages for commands and functions will add name to better understand where the error is
  - Update markdown-it 12.3.1 to 12.3.2

## v0.17.4 2022-01-07

- **New:**
  - Add [#FREEZE](docs/commands.md#display) Scroll lock the display, if state is omitted it will toggle the scroll lock, if state is 0 or false it will disable scroll lock, if state is anything else it will lock the scroll back
  - Add [#CLR](docs/commands.md#display) Add blank lines to clear the screen ignoring any current trailing blank lines
  - Add [%begins(string1,string2](docs/functions.md#string) return true if string 1 starts with string 2
  - Add [%ends(string1, string2)](docs/functions.md#string) returns true if string 1 ends with string 2
  - Add [%len(string)](docs/functions.md#string) returns the length of string
  - Add [%pos(pattern,string)](docs/functions.md#string) returns the position of pattern in string on 1 index scale, 0 if not found
  - Add [%ipos(pattern,string)](docs/functions.md#string) returns the position of pattern in string on 1 index scale, 0 if not found ignoring case
  - Add [%regex(string,regex,var1,...,varN,varN+1)](docs/functions.md#string) test if string matches the regex pattern, if found returns the position of the match, starting at 1 else returns 0, var1 ... varN are optional variable names to store any sub pattern matches, varN+1 is the length of matched string]
  - Add [%trim(string)](docs/functions.md#string) Returns the string without any spaces at the beginning or end
  - Add [%trimleft(string)](docs/functions.md#string)` Returns the string without any spaces at the beginning
  - Add [%trimright(string)](docs/functions.md#string) Returns the string without any spaces at the end
  - Add [%bitand(number1,number2)](docs/functions.md#math) returns the bitwise AND of the two numbers.
  - Add [%bitnot(number)](docs/functions.md#math) returns the bitwise inverse of the given number.
  - Add [%bitor(number1,number2)](docs/functions.md#math) returns the bitwise OR of the two numbers.
  - Add [%bitset(i,bitnum,value)](docs/functions.md#math) Set or reset a bit within a numeric value and return the new numeric value. If value is omitted, 1 (true) is used to set the bit. To reset a bit, the value must be zero.
  - Add [%bitshift(value,number)](docs/functions.md#math) shifts the value the num bits to the left. If num is negative, then the value is shifted to the right.
  - Add [%bittest(i,bitnum)](docs/functions.md#math) Test a bit within a numeric value and return true if it is set, false if it is not set. bitnum starts at 1.
  - Add [%bitxor(number1,number2)](docs/functions.md#math) returns the bitwise XOR of the two numbers.
  - Add [%number(s))](docs/functions.md#math) convert a numeric string to a number.
  - Add [%isfloat(value))](docs/functions.md#math) Returns true if value is a valid floating point number
  - Add [%isnumber(s))](docs/functions.md#math) true if s represents a valid number.
  - Add [%string(value))](docs/functions.md#math) converts value to a string. Quotes are added around the value.
  - Add [%float(value))](docs/functions.md#math) Returns value as a floating point number.
  - Add [%isdefined(name)](docs/functions.md#miscellaneous) Returns 1 if a variable is defined, 0 if undefined
  - Add noEcho argument for [client.sendBackground](docs/functions.md) and [client.sendCommand](docs/functions.md) to allow hiding from display
  - Add [$character](docs/functions#predefined-variables) to return current name from GMCP status info if possible and falls back to character manager login name or empty string
  - [Triggers](docs/profiles.md):
    - Add support for regex name capture that work similar to alias named params
    - Add `Pattern` and `Command Input Pattern` types to support zMUD/TinTin type pattern matching
  - Help: Add more known issue for advanced editor
  - Add save image as, copy image, copy image link to MXP image context menu
  - Input parser: Add $var user variable style support
  - Profile Manager:
    - Alias params are now highlighted with an error if invalid
    - Parse style is now syntax highlighted using special characters defined from options
  - [Preferences](docs/preferences.md):
    - Add [Enable Double Parameter Escaping](docs/preferences.md#scripting) to enable/disable doubling up of the parameter character `%` to escape as well as using escape character, default to off as there is an escape system
    - [Parameters character](docs/preferences.md#scripting--special-characters) allows you to change the % character for parameters
    - [Enable Parameters](docs/preferences.md#scripting--special-characters) disable parameter system
    - [N Parameters character](docs/preferences.md#scripting--special-characters) allows you to change the $ character for named parameters
    - [Enable N Parameters](docs/preferences.md#scripting--special-characters) disable N parameter system
    - [Show lag in title](docs/preferences.md#status) Display lag in title bar
  - Add [Parse caption](docs/profiles.md#context) to parse context menu captions using the command parser to allow predefined variables or expressions
- **Fixed:**
  - Updated README to update build requirements
  - Display:
    - Fixed bug with scroll lock auto scrolling when at bottom of display
    - Fixed bug with scroll lock being lost when screen is empty
    - Fixed bug with scroll lock being lost when split view is enabled
  - Advanced editor:
    - Fixed `Formatted as commands (No echo)` and `Text as commands (No echo)` echoing to the display
    - Fixed context menu
    - Fixed background color codes being wrapped in extra %^
    - Clean up extra codes between 2 resets blocks
    - Fixed Bold white background color to use RGB555 color code correctly
  - Profile Manager:
    - Trigger tester still did not correctly apply [Prepend triggered line](docs/preferences.md#scripting) preference
    - Fix trigger type select width
    - Focus on value editor on select
    - Fix out of sync closing when asking to save/apply over changed file
    - Fix erroring when trying to delete a profile that did not exist
  - Fixed alias named arguments not being directly accessible in scripting type
  - Fixed full screen not always being restored on load
  - Fixed maximized state not being correctly restored on load if window was closed minimized
  - Input parser:
    - Detect newlines when using {} block formatting for multi line blocks when possible
    - Skip alias invalid named params
    - Fixed number parsing in places not accepting +#, as +# is a valid positive number and converted to simple #
    - Fixed ignore spaces around number arguments for functions and commands
    - Fixed escape characters following parameters, eg $\ or %\ where not correctly parsing escape characters
    - Fixed not escaping command special character
    - Fixed do not escape disabled special characters
    - Fixed command character not being correctly replaced with custom character in some places
    - Fixed saving nested loop variables as user variables
    - Fixed bug when splitting quoted strings
  - Fixed [%dice(xdy+n)](docs/functions.md#math) not correctly parsings argument format
  - Fixed [%if(expression,true,false)](docs/functions.md#conditionals) not erroring if missing false argument
  - Fixed [#variable](docs/commands.md) should not evaluate the value to allow use of raw strings as needed, eg #va test {3+5} should store 3+5 not 8, if you want the evaluated value use #var test \${3+5} or #va test \{${3+5}}
  - Fixed [#variable](docs/commands.md) throws an error now when invalid variable names are used
  - Fixed Select control selected color text
  - Fixed [Watch for profile changes](docs/preferences.md#advanced) not always being cleared when client closed
  - Docs: Fixed [i..z](docs/functions.md#predefined-variables) description
- **Changed:**
  - Revert 0.17.1 hack for child windows as electron seems to have fixed the bug
  - Update tinymce 4.8.3 to 5.10.1
  - Update electron 16.0.4 to 16.0.6
  - Update font-list 1.4.2 to 1.4.3
  - Update mathjs 10.0.0 to 10.0.2
  - Update better-sqlite3 7.4.5 to 7.4.6
  - Rearrange [General](docs/preferences.md#general) to reduce scrolling
  - Increase character manager dialog height to remove scrolling when possible
  - Update markdown-it 12.3.0 to 12.3.1

## v0.17.3 2021-12-14

- **New:**
  - Add [#CW](docs/commands.md#display) colors all words matching current trigger pattern
  - Add [#PCOL](docs/commands.md#display) color text based on start and end positions
  - Add [#HIGHLIGHT](docs/commands.md#display) make text bold or brighter color if already bold
  - Add [#COLOR {pattern} fore,back,bold profile](docs/commands.md#display) pattern and profile arguments to allow for quick trigger creation
  - Add [%x1..%x99](docs/functions.md) predefined variable support, this variable will be replaced the matching groups start and end indexes, use this.indices or client.indices in script type to access
  - Add [%ansi(style,fore,back)](docs/functions.md) function to return ansi formatted string
  - Add [%i](docs/functions.md) predefined variable
  - Add [%j..%z](docs/functions.md) predefined variables for nested looping support
  - Add [%random](docs/functions.md) predefined variable and function
  - Add [%char(i)](docs/functions.md) return ASCII character for i
  - Add [%ascii(string)](docs/functions.md) return the ascii value for first letter in string
  - Add [%case(n,value1,value2,value3...)](docs/functions.md) return the nth value of arguments, from 1 to last argument
  - Add [%switch(expression1,value1,...expressionN,valueN)](docs/functions.md) return value of the first expression that evaluates to true
  - Add [%if(expression,true-value,false-value)](docs/functions.md) evaluate expression and return true or false value
  - Add [#break](docs/commands.md#repeating-and-loops) break loop
  - Add [#continue](docs/commands.md#repeating-and-loops) skips to the next loop iteration
  - Add {} grouping support to [#nnn](docs/commands.md#repeating-and-loops) argument
  - Add [#-nnn](docs/commands.md#repeating-and-loops) repeat commands NNN number of times but with a reverse counter
  - Add [#IF](docs/commands.md#conditionals) if expression is true execute true command, if false and false commands supplied execute them
  - Add [#CASE](docs/commands.md#conditionals) return command from list based on the value of index
  - Add [#SWITCH](docs/commands.md#conditionals) execute each expression until one returns true, if none are true and an else command supplied it is executed instead
  - Add [#LOOP](docs/commands.md#repeating-and-loops) Execute the commands a number of times given by the range
  - Add [#REPEAT](docs/commands.md#repeating-and-loops) repeat commands number of times returned by expression
  - Add [#BE](docs/commands.md#sounds) short version of [#BEEP](docs/commands.md)
  - Add [#ADD](docs/commands.md#miscellaneous) Add value to variable named name, if current value is non numeric an error will be displayed
  - Add [#MATH](docs/commands.md#miscellaneous) Set value to variable named name
  - Add [#VARIABLE](docs/commands.md) Set, get, or display all user set variables
  - Add [#UNTIL](docs/commands.md#repeating-and-loops) Execute commands until the expression evaluates to TRUE
  - Add [#WHILE](docs/commands.md#repeating-and-loops) Execute commands as long as expression evaluates to TRUE
  - Add [#FORALL](docs/commands.md#repeating-and-loops loop stringlist, in the format of a | delimited string and set %i as each word)
  - Add [#EVALUATE](docs/commands.md#miscellaneous) Evaluate expression and display to screen like show
  - Add [#PRINT](docs/commands.md#display) Display text to the screen and append newline, and the display text will not fire triggers
  - Add [#PRINTPROMPT](docs/commands.md#display) Display text to the screen, and the display text will not fire triggers
  - Input parser:
    - Add support to expression system for string comparison
    - Add support to expression system for string concat using + not just concat function
    - Add user variable support to expression system, can access in scripting using client.variables['NAME'] or client.variables.NAME
    - Add proper loop nesting using %i..%z variables for nested loops
  - [Preferences](docs/preferences.md)
    - Add [Watch for profile changes](docs/preferences.md#advanced) when enabled will watch for profile changes
    - Add [On profile change do](docs/preferences.md#advanced) what to do when a profile is changed when `Watch for profile changes` enabled
    - Add [On profile deleted do](docs/preferences.md#advanced) what to do when a profile is deleted when `Watch for profile changes` enabled
    - Add [Open ShadowMUD help in web browser](docs/preferences.md#advanced) to open ShadowMUD in child window or web browser
  - Help: Add left navigation tree to allow easier navigation besides the top navigation drop down, due to new command help pages to prevent large scroll when wanted
- **Fixed:**
  - [#nnn](docs/commands.md)
    - Fixed being double parsed
    - Fixed issues with trailing newlines with nested loops
    - Fixed format error checking to accept only numbers
  - Fixed window size being sent to the mud when status display is hidden/shown
  - Fixed bug in [#TRIGGER](docs/commands.md#triggers) command and adding to profile not correctly finding if one exist already
  - Fixed bug in [#EVENT](docs/commands.md#triggers) command and adding to profile not correctly finding if one exist already
  - Fixed bug in [#WAIT](docs/commands.md#miscellaneous) to allow parsing of argument to allow for %i and expressions
  - Profile Manager: trigger tester did not correctly apply [Prepend triggered line](docs/preferences.md#scripting) preference
  - Fixed bug with File > Exit when profile manager open and should not close
  - Fixed bug in [#COLOR](docs/commands.md#display) and [#CW](docs/commands.md#display) not correctly parsing profile argument
  - Input parser:
    - Fixed - being lost after %
    - Fixed # being lose if %# had a -, \* or % following it
    - Fixed corrupted stack after trigger errors
    - Fixed issue with $named argument format
    - Fixed named arguments not working
    - Fixed bugs in [repeatnum](docs/functions.md) not having correct name in all places
    - Fixed how alias unused arguments are appended
    - Fixed alias arguments values not correctly parsing before being used
    - No longer parse #commands if in a command/function argument as it would break inline parsing in most cases
  - Fixed execution of buttons and context items with broken parsing stacks
  - Fixed buttons and context not having error trapping code that broke cleanup
  - Status Display: Fixed resize bar conflicting with profile manger resize bar due to theming
  - Help:
    - Fixed crashing issue when opening external links
    - Fixed changelog links not working
  - Fixed issue with modal child windows not being set to correct parent window
  - Immortal tools:
    - Fixed rename editor to close when right clicking outside of editor
    - Fixed rename editor context menu to show standard edit menu
- **Changed:**
  - Remove %named argument support from docs as it never was supported and easier to just remove it
  - [#nnn](docs/commands.md#repeating-and-loops) counter is now 1 based when using %i..%z instead of 0 based
  - Allow group by ( and ) in command argument parsing
  - Update markdown-it 12.2.0 to 12.3.0
  - Update monaco-editor 0.30.1 to 0.31.1
  - Update bootstrap 3.3.7 to 3.4.1
  - Update datatables from 1.10.18 to 1.11.3
  - Update bootstrap select 1.13.17 to 1.13.18
  - Help: Command help has been redesigned and commands will slowly have individual help pages

## v0.17.2 2021-12-06

- **New:**
  - Add [#COLOR](docs/commands.md) color last added line
  - Add [#WINDOW](docs/commands.md) to open/show supported windows
  - Add [#TESTUNICODEEMOJI](docs/commands.md) to display Unicode emoji symbols
  - [Preferences](docs/preferences.md)
    - Add [Open 'Who is on' in web browser](docs/preferences.md#advanced) to open who in child window or browser
    - Add [Disable trigger on error](docs/preferences.md#scripting) to disable a trigger if an error happens, either from pattern or scripting, enabled by default to prevent spamming of broken trigger
    - Add [Prepend triggered line](docs/preferences.md#scripting) disable the fix to prepend the triggered line as %0,$0, or %{0} to return to previous usage
  - Add [%color(fore,back,bold)](docs/functions.md) function to return color codes
  - Add [%zcolor(fore,back,effect)](docs/functions.md) function to convert zmud/cmud style color codes into supported jiMUD codes
  - Status Display: Add ability to resize
  - Triggers: Add [Trigger on raw](docs/profiles.md) option to match on raw line including any ansi escape codes
  - Themes: Add two new themes, updated [preference](docs/preferences.md) docs to mention custom theme folders and [customizing](docs/customizing.md) docs to explain themes
    - Clean-large: scaled version of clean theme, 150% larger
    - Clean-extra-large: scaled version of clean theme, 200% larger
- **Fixed:**
  - Mac: Fix window menu item on main bar
  - Display:
    - Fixed Unicode combining character selection issues
    - Fixed Unicode selection width when font style is italic
    - Fixed mouse cursor to use standard text cursor
    - Fixed more Unicode surrogate/variant pair selection issues
    - Fixed bug in MXP expire not clearing send/link end tag
    - Fixed split view resize when horizontal scroll bar visible
  - Ansi Parser: Fixed bug in MXP expire tag not correctly expiring links on same line that come before the tag
  - Fixed bug with [#GAG](docs/commands.md) not working from command line
  - Fixed bug with [#GAG](docs/commands.md) and number argument not correctly working
  - Triggers:
    - Fixed bug with regex trigger caching
    - Fixed bug with %0, ${0}, $0 not always return full raw line of text **Warning:** this may break some triggers
    - Fixed bug with verbatim not error catching
  - Fixed bug when client was maximized then minimized and not correctly sending the new size to the mud
  - Focus on main window when profile manager, advanced editor, or child windows closed
  - Fixed bug that would not correctly clean up when window closed by close button
  - Fixed bug where window would not correctly save open state when main window closed
  - Advanced Editor: Fixed bug with context menu and colorizing selected text
  - Status Display: Fixed some monster icon positions
  - Backup: Fixed importing of [Show Script Errors](docs/preferences.md#scripting) setting
- **Changed:**
  - Expand [#TESTMXPEXPIRE](docs/commands.md) to test same line expiring
  - Use resize cursors instead of column resize cursors for resizable areas
  - Update electron 16.0.1 to 16.0.4

## v0.17.1 2021-11-23

- **Fixed:**
  - Fixed issue with electron and child windows open using window.open and invalid module paths

## v0.17.0 2021-11-23

- **New:**
  - Add context-pre-build, context-open, context-closed trigger events for when the context menu is open or closed
  - Add $contextMenu scripting variable to allow access to the context menu item array, **WARNING** changing this can break your context menu
- **Fixed:**
  - Fix scripting predefined variables $selectedword, $selectedline, $selectedurl, $selword, $selline, $selurl so they are correctly set for use in javascript
  - Display:
    - Fix to Unicode width when italic font style
    - Fix to Unicode surrogate/variant pair selection
  - Code editor: change how ([ ]) and ({ }) are handled in bracket detection for better matching and coloring support
  - Preferences: Fixed color scheme selection not working
- **Changed:**
  - Update electron 13.5.1 to 16.0.1
  - Update fswin 2.21.929 to 2.21.1015
  - Update monaco-editor 0.28.1 to 0.30.1
  - Update mathjs 9.5.0 to 10.0.0
  - Update better-sqlite3 7.4.3 to 7.4.5
  - Update font-list 1.4.0 to 1.4.2
  - Update yargs-parser 20.2.9 to 21.0.0
  - Update electron-updater 4.3.9 to 4.6.1

## v0.16.5 2021-10-03

- **New:**
  - Code editor:
    - Add bracket colorization matching
    - Add dark theme support for editors
- **Fixed:**
  - Auto update: when error happens correctly re-enable menu item
  - Code editor: fix Enable Background Throttling preference not being set
- **Changed:**
  - Update electron 13.3.0 to 13.5.1
  - Update fswin 2.21.905 to 2.21.929
  - Update monaco-editor 0.27.0 to 0.28.1
  - Update mathjs 9.4.4 to 9.5.0
  - Update font-list 1.3.1 to 1.4.0

## v0.16.4 2021-09-06

- **New:**
  - Add skills window
  - Added [#testspeedfiler](docs/commands.md) to load a file and run timed test as if it was sent from a mud
- **Fixed:**
  - Fixed error with linux on hide minimize hack when first loading
- **Changed:**
  - Replace more remote context menus
  - Replace all remote module dialogs
  - Update electron 13.2.2 to 13.3.0
  - Update fswin 3.21.107 to 2.21.905

## v0.16.3 2021-08-25

- **New:**
  - Preferences:
    - Add showInTaskBar option for main window
    - Add help blocks for tray click events when using linux
  - Tray icon: Add known issues when using linux to readme
- **Fixed:**
  - Code editor:
    - Fix issue using old promises
    - Fix issue with recent open list not being updated fast enough
  - Add hack for linux not firing minimize event
  - Auto update: Add message box for linux non Appimage installs as they are not supported
  - Use setIcon for linux to try and change icon based on connected, active, or disconnected state
  - Backup: refocus on main client window after backup has completed
- **Changed:**
  - Update monaco-editor 0.25.1 to 0.27.0
  - Update electron 13.1.2 to 13.2.2
  - Update yargs-parser 20.2.7 to 20.2.9
  - Update markdown-it 12.0.6 to 12.2.0
  - Update mathjs 9.4.3 to 9.4.4
  - Update better-sqlite3 7.4.1 to 7.4.3

## v0.16.2 2021-06-16

- **New:**
  - Character manager: Added `Disconnect on load` for each character allowing you to force the current connection to disconnect and using the new characters auto connect settings
  - Code editor: add armour of holding support to area designer and code template
- **Fixed:**
  - Code editor:
    - Select drop downs cutoff or causing scrolling when used in dialogs
    - Fix native tab icons when opening multiple files at once
- **Changed:**
  - Update electron 13.1.1 to 13.1.2
  - Update font-list 1.2.14 to 1.3.1
  - Update monaco-editor 0.24.0 to 0.25.1
  - Update chokidar 3.5.1 to 3.5.2

## v0.16.1 2021-06-07

- **Fixed:**
  - Fixed debug inspect content menu item
- **Changed:**
  - Update electron 13.0.1 to 13.1.1
  - Update better-sqlite3 7.4.0 to 7.4.1
  - Update mathjs 9.4.1 to 9.4.2

## v0.16.0 2021-05-26

- **Fixed:**
  - Fix opening child windows
- **Changed:**
  - Update electron 12.0.9 to 13.0.1

## v0.15.2 2021-05-26

- **New:**
  - Preferences:
    - Add `Max reconnect delay` to set the maximum time before reconnecting when using reconnect dialog.
    - Add `Enable Background Throttling` to allow disabling of throttling when a window is in the background or hidden
- **Fixed:**
  - Filled in some missing docs for preference settings
- **Changed:**
  - Separated backups, connection, and profile manager preferences into sub advanced pages to make advanced page easier to read
  - Update electron 12.0.7 to 12.0.9
  - Update mathjs 9.4.0 to 9.4.1
  - Re-code window.open systems as old systems have been deprecated and replaced

## v0.15.1 2021-05-16

- **Fixed:**
  - Files not correctly moved to trash
  - Code editor:
    - Fix undo, redo, cut, copy, and paste did not work from menus/context after upgrading to 0.21.x monaco-editor
    - Fix custom actions when using diff system
    - Fix issue with advanced editor in editor only mode
    - Only clear the menu recent documents, not the os recent documents
    - Fix native icon support
  - Log viewer:
    - Only clear the menu recent documents, not the os recent documents
  - Advanced editor: Fix due to typo added by mistake
- **Changed:**
  - Recode internal path parser to remove remote reliance and simplify code base by having only one function
  - Moved all app calls to main process using IPC
  - Moved all window operations into main process using IPC
  - Update better-sqlite3 7.1.2 to 7.4.0
  - Update electron 12.0.1 to 12.0.7
  - Update node-disk-info 1.1.0 to 1.3.0
  - Update markdown-it 12.0.4 to 12.0.6
  - Update fs-extra 9.1.0 to 10.0.0
  - Update font-list 1.2.13 to 1.2.14
  - Update monaco-editor 0.21.3 to 0.24.0
  - Replace mathjs-expression-parser with mathjs 9.4.0 due to mathjs-expression-parser not being updated
  - Update electron-updater 4.3.5 to 4.3.9

## v0.15.0 2021-03-15

- **New**
  - Enable allow Half Open sockets - Indicates whether half-opened TCP connections are allowed
- **Changed:**
  - Update electron 11.3.0 to 12.0.1
  - Updated crash logging to newer more detailed version
  - Update font-list 1.2.12 to 1.2.13
  - Update yargs-parser 20.2.6 to 20.2.7

## v0.14.1 2021-02-24

- **Fixed:**
  - Code editor:
    - Fix remote diff/editing systems, broken in v0.11.3 due to tmp changing how temp directories worked
    - Fix new area dialog title and default name being [Object object]
    - Fix ([]) and ({}) from adding an extra )
- **Changed:**
  - Update electron 11.0.3 to 11.3.0
  - Update markdown-it 12.0.2 to 12.0.4
  - Update better-sqlite3 7.1.1 to 7.1.2
  - Update chokidar 3.4.3 to 3.5.1
  - Update fswin 3.19.908 to 3.21.107
  - Update monaco-editor 0.21.2 to 0.21.3
  - Update fs-extra 9.0.1 to 9.1.0
  - Update yargs-parser 20.2.4 to 20.2.6
  - Update font-list 1.2.11 to 1.2.12

## v0.14.0 2020-12-05

- **Fixed:**
  - Chat capture: fixed issue introduced in v0.13.2
- **Changed:**
  - Update electron 10.1.5 to 11.0.3

## v0.13.2 2020-11-16

- **New:**
  - Preferences: Add `Auto takeover login` to automatically issue yes to takeover character after login
- **Fixed:**
  - Chat Capture:
    - Cache regex objects to improve performance
    - Optimize `Capture only when open` preference when not enabled
    - Fixed issue when reloading settings and chat window open
  - Auto login:
    - Improve performance checks
    - Use login name not character manager name when auto logging in
    - Cache login name to improve performance checks
  - Display: Fixed Split scroll live update when enabled
  - Code editor:
    - Add better error logging when editor breaks
    - Fix random hang issue
- **Changed:**
  - Update yargs-parser 20.2.3 to 20.2.4

## v0.13.1 2020-10-26

- **New:**
  - Preferences: Add Show invalid MXP tags to display any MXP tags as normal text if they are not standard or custom elements
- **Fixed:**
  - Parser:
    - MXP:
      - Fixed issue with fragmented line parsing and disappearing text
      - Fixed issue when malformed tag processed
      - Fixed issue with malformed entities
      - Fixed bug when applying formats and not found entities
      - Fixed issue with custom tags and elements causing double display
  - Hopefully fix issue where menu bar is default menu instead of proper menu
  - Fix command history window list delay update on first command
  - Code editor:
    - Fixed issue where editor would randomly hang
    - Fixed issue where virtual/area designer maps would not be drawn on first load
    - Fixed issue when virtual/area designer property editor would fail to create an editor on click
- **Changed:**
  - Update electron 10.1.2 to 10.1.5
  - Update electron-updater 4.3.4 to 4.3.5
  - Update yargs-parser 20.0.0 to 20.2.3
  - Update moment 2.28.0 to 2.29.1
  - Update monaco-editor 0.20.0 to 0.21.2
  - Update chokidar 3.4.2 to 3.4.3
  - Update markdown-it 11.0.1 to 12.0.2

## v0.13.0 2020-09-15

- **New:**
  - Add GMCP Client.Media support
  - Preferences:
    - Fix hidden windows, move any hidden windows to main screen when they are opened
    - Add show in taskbar option for chat and mapper windows
- **Fixed:**
  - Color picker: Fixed tooltip color names
  - MXP: Remove version style attribute if not set when replying to mud
  - Fixed script type aliases, triggers, macros, buttons, context menus would error when last line was a //comment
- **Changed:**
  - Update electron 9.1.0 to 10.1.2
  - Update chokidar 3.4.0 to 3.4.2
  - Update yargs-parser 18.1.3 to 20.0.0
  - Update better-sqlite3 7.1.0 to 7.1.1
  - Update markdown-it 11.0.0 to 11.0.1
  - Update moment 2.27.0 to 2.28.0

## v0.12.2 2020-07-10

- **Fixed:**
  - Mapper:
    - Fixed export image/data dialogs
    - Fixed export data cancel system, prevents crash and works
  - Fixed file save dialogs not correctly canceling
- **Changed:**
  - Update electron 9.0.5 to 9.1.0

## v0.12.1 2020-07-02

- **Fixed:**
  - Fixed #profilelist not working
  - Fixed #profile not working
- **Changed:**
  - Update electron 9.0.4 to 9.0.5
  - Update moment 2.26.0 to 2.27.0

## v0.12.0 2020-06-15

- **Fixed:**
  - Set the theme sooner to have a smoother loading feel
  - Resize interface before showing window to remove status bar resize flickering
  - Buttons with image icons now have a colored overlay to better show they are the button to be clicked
  - Fix open file dialogs not correctly canceling
  - Immortal tools: fix remote delete
- **Changed:**
  - Update electron 8.3.0 to 9.0.4
  - Update markdown-it 10.0.0 to 11.0.0
  - Replace drivelist 8.0.10 with node-disk-info 1.1.0
  - Replace fontmanager-redux 0.4.0 with font-list 1.2.11
  - Update bootstrap select 1.12.4 to 1.13.2
  - Update moment 2.25.3 to 2.26.0
  - Update fs-extra 9.0.0 to 9.0.1

## v0.11.3 2020-05-18

- **New:**
  - Add button to reset window locations in preference dialog
  - New backup/restore option to save/ignore window states
- **Fixed:**
  - Preference reset would not correctly reset window states for open windows
  - Fix rare chance of phantom window objects being created
- **Changed:**
  - Update electron 8.2.0 to 8.3.0
  - Update yargs-parser 18.1.2 to 18.1.3
  - Update tmp 0.1.0 to 0.2.1
  - Update better-sqlite3 6.0.1 to 7.0.1
  - Update chokidar 3.3.1 to 3.4.0
  - Update electron-updater 4.2.5 to 4.3.1
  - Update moment 2.24.0 to 2.25.3

## v0.11.2 2020-03-31

- **Changed:**
  - Update electron 8.1.1 to 8.2.0
  - Update yargs-parser 18.1.1 to 18.1.2

## v0.11.1 2020-03-23

- **New:**
  - Triggers: Cache regular expression objects so they are only created first time a trigger is ran
  - Use native built in spellchecker systems, add support for most editable fields
- **Fixed:**
  - Fix command input lost when canceling open link confirm box
- **Changed:**
  - Update monaco-editor 0.19.3 to 0.20.0
  - Update electron 8.0.1 to 8.1.1
  - Update drivelist 8.0.9 to 8.0.10
  - Update electron-updater 4.2.0 to 4.2.5
  - Update better-sqlite3 5.4.3 to 6.0.1
  - Update yargs-parser 17.0.0 to 18.1.1
  - Update fs-extra from 8.1.0 to 9.0.0
  - Remove spellchecker 3.7.0

## v0.11.0 2020-02-10

- **New:**
  - Add button bar overflow support to allow scrolling of buttons
- **Fixed:**
  - Profile manager: Fix issue when using capital letters and renaming a profile
- **Changed:**
  - Update electron 7.1.10 to 8.0.0
  - Update yargs-parser 16.1.0 to 17.0.0
  - Make wheel mouse events passive to allow better optimizing of scrolling for mapper and main display
  - Code editor: revert a quick hack to menu issues

## v0.10.2 2020-01-27

- **New:**
  - Optimize macro execution
- **Changed:**
  - Update monaco-editor 0.19.2 to 0.19.3
  - Update electron 7.1.9 to 7.1.10

## v0.10.1 2020-01-13

- **New:**
  - Profile manager:
    - Preference to change how items are sorted: Alpha, index, or priority
    - Preference to change sort direction from ascending or descending
- **Changed:**
  - Update electron 7.1.1 to 7.1.9
  - Update chokidar 3.3.0 to 3.3.1
  - Update monaco-editor 0.18.1 to 0.19.2

## v0.10.0 2019-11-11

- **Fixed:**
  - Immortal tools: fix upload fail not being correctly registered
  - Code editor: Ignore formatting for inline comments
  - About: update process memory info display using new built in api's
  - Character manager: Add close button if mac
- **Changed:**
  - Refactor hasOwnProperty checks to use proper calls for more security when running dynamic scripts
  - Update electron 6.0.9 to 7.1.1
  - Update monaco-editor 0.18.0 to 0.18.1
  - Update chokidar 3.1.0 to 3.3.0
  - Update drivelist 8.0.6 to 8.0.9
  - Update yargs-parser 13.1.1 to 16.1.0
  - Replace font-manager 0.3.0 with fontmanager-redux 0.4.0
  - Update electron-updater 4.1.2 to 4.2.0

## v0.9.4 2019-09-16

- **Fixed:**
  - Auto updater: fix now/later being reversed function
  - Immortal tools: Add upload/download to folder context menus
  - Remove some menu hacks as electron 6.0.8 seems to have fixed menu issues
- **Changed:**
  - Update electron 6.0.7 to 6.0.9
  - Update better-sqlite3 5.4.2 to 5.4.3
  - Update monaco-editor 0.17.1 to 0.18.0
  - Update yargs-parser 13.1.1 to 14.0.0
  - Update fswin 3.18.918 to 3.19.908
  - Update markdown-it 9.1.0 to 10.0.0
  - Update chokidar 3.0.2 to 3.1.0

## v0.9.3 2019-09-02

- **New:**
  - About: re-add memory display using 3rd party module until electron 7 is released
- **Changed:**
  - Update electron 6.0.4 to 6.0.7
  - Convert all open file dialogs to use newer syntaxes
- **Fixed:**
  - Fixed save dialogs not working due to electron 6 dialog changes

## v0.9.2 2019-08-26

- **New:**
  - Auto updater: Option to install update later next time the client is started
- **Changed:**
  - About:
    - Update copyright date
    - No longer a modal dialog and movable
  - Auto updater: Force close even if connected or sub windows open
  - Update electron 6.0.3 to 6.0.4
- **Fixed:**
  - Fixed progress dialog titles not being correctly set in places
  - Display: Fixed incorrect vertical scrollbar height
  - Fixed dialogs boxes broken in electron 6 update
  - Code editor: do not add a newline if throw is a function for a object

## v0.9.1 2019-08-21

- **Fixed:**
  - Help: Fixed character manager help topic not being listed
  - Code editor: a quick fix to crash due to menu issues in electron 6
  - Profile manager: Fix issue when trying to update a profile that contained a non Alpha numeric character, :, ., or -
- **Changed:**
  - Update electron 6.0.2 to 6.0.3

## v0.9.0 2019-08-19

- **New:**
  - Added character manager doc
- **Fixed:**
  - Fixed check for updates open website dialog button
  - Fixed issues when reloading preferences and closing child windows
  - Themes: tweaks to health bars to better handle zooming
- **Changed:**
  - Update electron 5.0.8 to 6.0.2
  - Update better-sqlite3 5.4.1 to 5.4.2
  - Update markdown-it 9.0.1 to 9.1.0

## v0.8.4 2019-07-29

- **New:**
  - Character manager: Add Never ask again when warning on loading default or character
  - Preferences: Allow toggling never ask again check when closing client option
- **Fixed:**
  - Main menu hacks in an attempt to fix some menu issues.
  - Mapper: Fixed fill walls, split area, and show legend not correctly restoring on load
  - Display: MXP Image caching was not correctly handled when old lines where trimmed at buffer max
- **Changed:**
  - Update electron 5.0.7 to 5.0.8
  - Update spellchecker 3.6.1 to 3.7.0

## v0.8.3 2019-07-22

- **New:**
  - Status: add tooltip to combat/party bars with full names
- **Fixed:**
  - Command history: Fixed selection of commands while browsing
  - Paste special: losing text when clicking ok or return key
  - Preferences: Fixed dialog height to prevent theme drop down not correctly showing
- **Changed:**
  - Themes:
    - Bump combat/party names to be larger and easier to read
    - Increase all progressbar heights a little and increase fonts for easier reading
  - Update chokidar 3.0.1 to 3.0.2
  - Update markdown-it 8.4.2 to 9.0.1
  - Update better-sqlite3 5.4.0 to 5.4.1
  - Update electron 5.0.6 to 5.0.7
  - Update electron-updater 4.0.14 to 4.1.2
  - Preferences: Backup all profiles is now default true to mimic web client behavior

## v0.8.2 2019-07-01

- **Fixed:**
  - Mapper: Fixed get new zone system
  - Immortal tools: Fix drive dropdown explorer
- **Changed:**
  - Update electron 5.0.3 to 5.0.6
  - Update fs-extra from 8.0.1 to 8.1.0
  - Update spellchecker 3.6.0 to 3.6.1
  - Update monaco-editor 0.17.0 to 0.17.1

## v0.8.1 2019-06-10

- **Fixed:**
  - Fixed spell checker, electron 5.0 changed api
  - Fixed issue not resetting telnet prompt flag when doing local text display
  - Fixed URL detection and valid Unicode characters
  - Fixed Copy and open url to properly URL encode characters
- **Changed:**
  - Update fs-extra from 7.0.1 to 8.0.1
  - Update electron 5.0.1 to 5.0.3
  - Update chokidar 3.0.0 to 3.0.1
  - Update spellchecker 3.5.3 to 3.6.0
  - Update yargs-parser 13.1.0 to 13.1.1

## v0.8.0 2019-05-06

- **Changed:**
  - Update electron 4.1.3 to 5.0.1
  - Update spellchecker 3.5.2 to 3.5.3
  - Update chokidar 2.1.5 to 3.0.0
  - Update monaco-editor 0.16.2 to 0.17.0

## v0.7.5 2019-04-01

- **Changed:**
  - Update electron 4.0.5 to 4.1.3
  - Update drivelist 7.0.3 to 8.0.6
  - Update monaco-editor 0.15.6 to 0.16.2
  - Update chokidar from 2.1.2 to 2.1.5
  - Update tmp from 0.0.33 to 0.1.0

## v0.7.4 2019-02-25

- **Fixed:**
  - Command history: Add text ... overflow systems for long commands to prevent drop up display from being hidden off screen
  - Code editor:
    - Virtual/area editor: Fix issue with room preview and item formatting when item text is empty
- **Changed:**
  - Update drivelist 7.0.0 to 7.0.3
  - Update electron 4.0.2 to 4.0.5
  - Update yargs-parser 11.1.1 to 13.0.0
  - Update chokidar 2.0.4 to 2.1.2

## v0.7.3 2019-01-28

- **Fixed:**
  - Fixed #gets/#sets commands

## v0.7.2 2019-01-28

- **New:**
  - Global enable parsing toggle system to allow disabling of command paring with a simple on / off button or menu click
  - Global enable trigger toggle system to allow disabling of trigger with a simple on / off button or menu click
- **Changed:**
  - Update moment 2.23.0 to 2.24.0
  - Update electron 4.0.1 to 4.0.2
  - Update better-sqlite3 5.3.0 to 5.4.0
  - Update spellchecker 3.5.0 to 3.5.1
  - Update drivelist 6.4.3 to 7.0.0
- **Fixed:**
  - ANSI Parser: Line feeds (\r) are now ignored when parsing text to fix MXP state management
  - Fixed copy/paste short cut display in command input context menu

## v0.7.1 2019-01-14

- **New:**
  - Add command history window
  - Character manager: Backup to zip with all related files as a zip file
  - Preferences: Backup up all settings and related files as a zip file
  - Logs: Backup up all logs as a zip file
  - Profile manager: Add export and import as zip file
- **Changed:**
  - Remove memory info from about, no longer supported in electron 4
  - Update electron 4.0.0 to 4.0.1
  - Update better-sqlite3 5.2.1 to 5.3.0
  - Update drivelist 6.4.3 to 6.4.6
- **Fixed:**
  - Advanced editor: Fixed unable to add new lines
  - Code editor:
    - Fixed formatting of else single line to newline/indent like single line if
    - Fixed formatting of an inline comment following if/else

## v0.7.0 2018-12-31

- **Changed:**
  - Update electron 3.0.13 to 4.0.0
- **Fixed:**
  - Code editor:
    - Fixed save as not updating window title.
  - Display:
    - Fixed horizontal scrolling when split view visible
    - Refresh scroll bars when window restored from a minimized state.
  - Command parsing:
    - Fixed %_ parameter of append %_
    - Fixed ${\*} not correctly marking arguments as used thus appending them if append was turned on
    - Fixed %%
    - Fixed $STRING parameters
    - Fixed appending unused variables to inner blocks of parsed lines
    - Fixed aliases when value does not end in newline
  - ${repeatnum} and ${i} are now saved on stack correctly so instead of last use it is now the correct # based on where it is executed, making nested #nnn in aliases better

## v0.6.15 2018-12-20

- **Fixed:**
  - Parser: Fixed issue of trimming end formatting codes on fragmented lines
  - Fixed issue where some window settings where not correctly saving

## v0.6.14 2018-12-17

- **Fixed:**
  - Parser: Fixed split text issue introduced in v0.6.13 when fixing split URLs

## v0.6.13 2018-12-17

- **New:**
  - Display: Add page up/down support
  - Chat: Add page up/down, arrow key, home, end scroll support
  - Code editor:
    - Area designer:
      - Room background color will now set based on inherited type when possible
      - Add underwater property flag
      - Add custom properties for rooms and support from monster/room wizards
    - Add underwater property to room wizard
    - Add custom properties for monster and room wizards
- **Changed:**
  - Update electron 3.0.9 to 3.0.13
  - Update electron-updated 4.0.5 to 4.0.6
  - Update better-sqlite from 5.0.1 to 5.2.1
- **Fixed:**
  - Display:
    - Fixed issue with URL context menu
    - Fixed split button scrolling instead of toggling
    - Fixed horizontal scroll when mouse dragging leaves bottom of display area
    - Improve URL detection when text is split
    - Improve prompt line detection
  - Code editor:
    - Fixed save file as tab tool-tip
    - Area designer:
      - Fixed delete and cut correctly removing rooms
      - Fixed base room delete/cut
      - Fixed base monster delete/cut
      - Fixed default room/monster drop down not updating
      - Fixed Update all empty rooms to new default room type
    - Virtual area editor:
      - Fixed external exit editing for hidden flag

## v0.6.12 2018-12-03

- **Changed:**
  - Update electron-updater 4.0.4 to 4.0.5
  - Display: Make selected background color transparent
- **Fixed:**
  - Fixed ${selword}, ${selurl}, ${selline}, ${selectedword}, ${selectedurl}, and ${selectedline} for context menus
  - Fixed auto connect firing when switching from a character with it on to one with it off
  - Display:
    - Correctly re-calculate widths and heights when font changed
    - Fixed split button not correctly locking when new lines added
    - Fixed clear display when split view shown
    - Fixed Yet another rounding issue with scroll bars
  - Code editor:
    - Rebuild recent menu as soon as opening is finished instead of de-bouncing it
    - Tab widths not correctly updated when file saved as
    - Virtual area editor
      - Fixed reloading when changes made to file
      - Always add a trailing line as read_file on server seems to not work with out it correctly
    - Code generation
      - Fixed functions that have no arguments
      - Strip colors for header name/descriptions
      - Fixed room open door
      - Fixed room reads

## v0.6.11 2018-11-26

- **Changed:**
  - Update monaco-editor from 0.15.5 to 0.15.6
  - Update mathjs-expression-parser from 1.0.0 to 1.0.2
- **Fixed:**
  - Display:
    - Fixed scroll position rounding issue
    - Fixed horizontal scroll bar when it first appears auto scrolling right correctly this time
  - Fixed [#showclient and #toggleclient](docs/commands.md) commands not correctly restoring maximized state

## v0.6.10 2018-11-21

- **Fixed:**
  - Display: Fix scroll bar rounding issue.

## v0.6.9 2018-11-21

- **New:**
  - Code editor:
    - Add limb optional support to object editor for armors and sheaths
    - Add random gender support to monster wizard
    - Add advanced properties to object editor
  - About: do live updates of CPU/memory usage
- **Changed:**
  - ANSI Parser: use Unicode zero space character instead of wbr tag to reduce memory
  - Update monaco-editor from 0.15.0 to 0.15.5
  - Update electron-updater 3.2.3 to 4.0.4
  - Update electron 3.0.9 to 3.0.10
  - Update yargs-parser 11.1.0 to 11.1.1
- **Fixed:**
  - Code editor:
    - Fixed drop down edit boxes
    - Fixed monster wizard emote type display
    - Fixed auto complete
    - Force all templates to use Linux line endings
    - Area designer:
      - Fixed saving monster gender
      - Fixed code generation cancel not resetting task bar progress
      - Fixed object bonus code generation
      - Do not generate set*prevent*\* functions of empty string for objects
      - Cancel on error when generating code
      - Remove buckler as an accessory for armors
      - Fixed set_long string wrapping
      - Fixed room set_long/short when empty
      - Fixed monster/object file name if empty
      - Fixed several minor issues with code generation
  - Progress dialog: fix task bar progress not being cleared on close
  - Display:
    - Set line-height to better control Unicode
    - Fixed horizontal scroll bar when it first appears auto scrolling right
    - Fixed calculating number of text rows
    - Fixed scroll bar position calculations

## v0.6.8 2018-11-12

- **Changed:**
  - Update electron from 3.0.8 to 3.0.9npm
- **Fixed:**
  - Display: Fixed a bug when removing lines
  - Character manager: fix the property section to scroll bar just in case contents do not fit height
  - Profile manager:
    - Fixed expanding children after new profile created
    - Fixed issue when renaming profile and attempting to update child nodes
    - Fixed deleting a profile after it was renamed

## v0.6.7 2018-11-12

- **New:**
  - Code editor:
    - Area designer: Exits that are closed doors are now hidden in the room preview to mimic standard door usage
  - Added [Enable sound](docs/preferences.md#general) to disable or enable sounds without the need to disable msp
  - Added Copy as HTML to edit menu to copy selected text as HTML formatted markup
  - Added [#testperiod](docs/commands.md) toggle on/off a test that will alternate between #testcolors, #textxterm, #testlist every 2 seconds to simulate constant streaming of text
- **Changed:**
  - Update electron from 3.0.7 to 3.0.8
  - Update electron-updater 3.1.6 to 3.2.3
  - Update yargs-parser 11.0.0 to 11.1.0
  - Update monaco-editor from 0.14.3 to 0.15.0
  - Clear local cache every time the preferences are changed
  - Clear local cache when leaving combat if it has been at least an hour since last time
  - Display:
    - Tweak performance and memory usage to try and balance between not using to much memory and using enough to get performance gains
    - Changed how formatted data is stored and cached
    - Converted to DOM generation instead of building HTML strings, removes extra step of parsing HTML into DOM
    - Allow scroll bar thumb to be a little smaller
  - Input: Performance tweaks when executing triggers
  - Status:
    - Performance tweaks by grouping updates when possible
    - Removed jQuery where possible to remove overhead and improve performance
  - Process all GMCP in async to try and improve performance
  - Immortal tools:
    - Bump max file size to 307,200 bytes using 1024 bytes as base
    - Add error codes to error messages
- **Fixed:**
  - Code editor:
    - Area designer:
      - Fixed room preview item matching generating corrupt HTML
      - Fixed read display format in room property editor
      - Fixed text selection for room preview
      - Fixed room preview tool tips when item appears multiple times in long
    - Virtual area editor:
      - Fixed room preview tool tips when item appears multiple times in long
    - Fixed Value editors moving cursor location after pasting text
  - MSP:
    - Fixed not displaying error when file not found or unable to play
    - Reset current sound when sound/MSP enabled/disabled
  - Display:
    - Fixed URLs containing quotes or \ not correctly encoding in tool tips and link following
    - Fixed overlay and selection to add extra ending space to represent newlines better
    - Fixed rounded corner selection/overlay placements
    - Fixed double click counting [, ], @, ?, |, <, >, ", ', +, and \ as part of words
    - Fixed MXP tag closing to separate open and secure closings
    - Fixed MXP image caching not clearing correctly
    - Fixed MXP send/a tags not correctly spanning multiple lines
  - Fixed context word selection to not count [, ], @, ?, |, <, >, ", ', +, and \ as part of words
  - Logger:
    - Fixed URLs containing quotes or \ not correctly encoding in tool tips and link following
    - Fixed URL click scripts by including some minor JavaScript to execute URLs
    - Fixed generating HTML when not logging to save memory and CPU time
    - Fixed flushing when logging disabled
  - Fixed drake monster icon
  - Fixed memory leak in temporary triggers and alarms
  - Fixed Invalid GMCP error when a different error happened
  - Status: Fixed combat/party health bar percent display rare case of trailing decimals
  - Fixed #testmxp send examples to use correct testmxpcolors and textmxpexpire commands
  - ANSI Parser:
    - Fixed raw data doubling split buffer data
    - Fixed extra line when controls at beginning of a line are split
  - Immortal tools: Fixed error message display

## v0.6.6 2018-11-05

- **New:**
  - Added [Hide trailing line](docs/preferences.md#display) display preference to hide trailing empty line.
  - Added [Enable colors](docs/preferences.md#display) enable or disable colors.
  - Added [Enable background colors](docs/preferences.md#display) enable or disable background colors
  - Added new Zen theme
  - ANSI Parser: Added backspace character support
- **Changed:**
  - Remove clean and default scroll track rounded corners to properly hide background text
  - Update electron from 3.0.6 to 3.0.7
  - Update electron-updater 3.1.5 to 3.1.6
  - Change show split button disabled look for all themes to not light up
  - Logger:
    - Re-coded HTML logger to use classes and style blocks to reduce file sizes
    - Convert write system to use a stream to batch write to improve write speeds
  - Preferences: Move display font selection to own sub section under display
- **Fixed:**
  - Display:
    - Detect changes to display better to handle theme changes
    - Calculate split bar movement using current split bar height
    - Use current scroll bar height/widths instead of fixed #s to allow for better theme support
    - Correctly factor in current theme display padding into available character width and height
    - Fixed vertical scroll bar when split button shown
    - Fixed show split button being shown after turning off split scroll
    - Re-add -(minus) and \_(underscore) as selectable characters for double click and context menu word selection
    - Fixed selection when dragging below display window
    - Fixed split scroll window bottom padding spacing for all themes
    - Fixed MXP image align=right
    - Fixed getting wrong character for mouse position
  - Fixed matching whole Unicode words on context
  - ANSI Parser: Always append line fragment when parsing, better fix to the previous missing raw data issue
  - Window size not correctly sent to mud when maximizing window, broken in v0.6.5
  - Logger:
    - Fixed MXP hr style effects
    - Flush When closing, clearing screen or logging options changed to ensure last line is saved when required
    - Fixed When path changed in the middle of logging it failed to correctly move current logs to new path

## v0.6.5 2018-10-29

- **New:**
  - Added copy support as HTML format to allow copying colors and formats and paste into applications that support HTML markup
  - Logger: Added support for MXP images
  - Display:
    - Added basic MXP image support, limits height to line height
    - Added more color attributes for color tag: hidden, strikeout, overline, and doubleunderline
    - Added a split toggle button at the bottom right corner for quick off/on, similar to clicking scroll lock button
  - Expanded [client.writeClipboard](docs/scripting.md) added html argument to add formatted html as well as plain text
  - Expanded [client.writeClipboardHTML](docs/scripting.md) write HTML markup to clipboard to produce formatted text for applications that support HTML pasting
  - Expanded [client.readClipboardHTML](docs/scripting.md) read HTML markup from clipboard if clipboard has HTML support
  - Added total time to [#testspeed](docs/commands.md) command
  - Added [#testspeedfile](docs/commands.md) to load a file and run timed test
  - Added [#testfile](docs/commands.md) to load a file
  - Preference:
    - Added [Show split button](docs/preferences.md#display), Show or hide split toggle button in split scroll to allow for quick toggling
    - Added [display](docs/preferences.md#chat) sub area for chat display preferences
  - Chat:
    - Added split scroll support, allow enabling of split scrolling for chat window
    - Added Independent [buffer size preference](docs/preferences.md#chat) instead of using the same one as main display
    - Added [flashing preference](docs/preferences.md#chat)
- **Changed:**
  - Update electron from 3.0.5 to 3.0.6
  - Update electron-updater 3.1.2 to 3.1.5
  - Log viewer uses simpler HTML generation
- **Fixed:**
  - Auto updater: Attempt to preserve command line arguments when restarted
  - Status:
    - Fixed sleet weather overlay for all themes
    - Fixed issue with lost right spacing when status display is hidden
  - Display:
    - Not correctly clearing text
    - Improve performance by generating cleaner HTML markup
    - MXP:
      - Fixed horizontal rulers display
      - Fixed selection highlighting of horizontal rulers
      - Fixed copying horizontal rulers and use --- on own line in text
      - Fixed closing of custom defined tags
      - Fixed MXP send tags
    - Fixed HTML property to return correct HTML markup
    - Match whole Unicode words on context or double click
    - Debounce selection mouse dragging to improve performance
    - Fixed split view selection performance issues
    - Fixed split position on resize
    - Fixed scrolling issues with large amount of lines
    - Fixed resize issues when status display/button bar hidden
  - Fixed scroll lock scrolling to end when not in split screen mode
  - ANSI Parser:
    - Fixed extra characters being added after : in raw text, fixes raw ansi logging
    - Fixed loss of some raw data when line only contains ansi control characters resulting in loss of blank lines
  - Chat:
    - Fix display not using URL detection settings and MXP settings
    - Fix zoom reset not being saved

## v0.6.4 2018-10-22

- **New:**
  - Code editor: Add hover effects to tabs to make it easier to know what your clicking
- **Changed:**
  - Update electron from 3.0.4 to 3.0.5
- **Fixed:**
  - Display:
    - Fixed selection width for Unicode fonts
  - Fixed paste and paste special not correctly replacing selected text in command input box
  - Status: Fix sleet weather overlay

## v0.6.3 2018-10-12

- **Changed:**
  - Update better-sqlite from 4.1.4 to 5.0.1
  - Update fs-extra from 6.0.1 to 7.0.0
  - Update yargs-parser from 10.1.0 to 11.0.0
  - Update electron from 3.0.3 to 3.0.4
- **Fixed:**
  - Display:
    - Fixed a font spacing issue when using em font size
    - Fixed a Unicode display issue by converting spaces to non-breaking spaces
    - Fixed bug when selection the first letter of a line of text
  - Fixed command input context menu copy/cut actions not working when display has selected text
  - Improved load times
  - Preferences: Sort fonts by alphabetic

## v0.6.2 2018-10-09

- **Fixed:**
  - Fixed Unicode corruption when receiving split packets when UTF-8 or charset telnet option is enabled
  - Fixed Telnet charset option being on even if server did not turn it on
  - Fixed properly parse Client.GUI GMCP
  - Backup: Fixed serializing of profiles not ignoring new profile key

## v0.6.1 2018-10-08

- **New:**
  - [#notify](docs/commands.md) - add icon argument {icon}
  - Add search box to help browser
  - Add edit button context menu when right clicking a button on the button bar
  - Add title bar to paste special dialog to identify what the dialog is for
  - Paste special, when hitting enter it will move to the next input box, if in last last input will run paste special
- **Changed:**
  - [#notify](docs/commands.md) - make silent
  - [client.notify](docs/scripting.md) - make silent by default, add silent: false to options argument, eg: client.notify('test', 'test2', {silent: false})
  - Update electron from 3.0.2 to 3.0.3
- **Fixed:**
  - Code editor:
    - Area designer:
      - Room preview:
        - Fix displaying climbs as normal exits.
        - Fix room and base room climbs being combined
        - Fix flying monsters by append (flying) to monsters
      - Fix some code generation not being generated right
  - Only display copy url text if different from url for link context menu
  - Fixed [#notify](docs/commands.md) displaying the word null when no message body
  - Fixed MSP system not correctly clearing previous file url
  - Fixed Paste special error when trying to open the dialog when already open
  - Profile manager:
    - Fixed add button to create new item based on currently selected item
    - Fixed add button tool tip shows type of new item to be created
  - Display:
    - Fixed overlay and selection highlighting for Unicode half and full width characters
    - Fixed pasting or cutting text into find search box
    - Fixed Unicode spacing issues when different colors or font styles are used
    - Fixed split section not firing click event
  - Preferences dialog:
    - Fixed drop down font selection height not being correct
    - Fixed color scheme drop down width

## v0.6.0 2018-10-01

- **New:**
  - Code editor:
    - Virtual area editor:
      - Improve open times
      - Add new hidden external exit support
      - Add support for older virtual areas in external exits that ise VV define
    - Wizards: Add autocomplete suggestions to all editable dropdowns
  - New about dialog logo, clean and more simple
  - Events:
    - `backup-loaded` fired when backup has finished loading
    - `backup-saved` fired when backup has finished saving
- **Changed:**
  - Update electron from 2.0.10 to 3.0.2
  - Update jquery from 3.2.1 to 3.3.1
  - Update bootstrap select from 1.12.4 to 1.13.2
  - Update bootstrap treeview to 2.1.7
  - Update zlib to 0.3.1
  - Update datatables from 1.10.16 to 1.10.18
  - Remove ResizerObserver polyfill as electron 3 includes native support
  - Update tinymce from 4.8.1 to 4.8.3
  - Update ace editor to 1.4.1
- **Fixed:**
  - Code editor:
    - Changed how files are tested if they exist in so directories are not counted as files
    - More error catching when opening a file
    - Fixed remote editing file icon
    - Fixed reopening of remote edited files
    - Area designer:
      - Fixed monster alignment not being correctly saved when using string word
  - Advanced editor: Fixed spacing and border issues
  - Fixed window ready checks for chat, editor, code editor, and progress dialogs to make sure they are 100% loaded before processing any data
  - Profile manager: Fixed syntax highlighting when changing styles

## v0.5.5 2018-09-26

- **New:**
  - Code editor:
    - Area designer:
      - Allow ctrl+click to append items for object editor limb selections
- **Changed:**
  - Update fswin to 3.18.918, and use package instead of custom builds for easier electron upgrades
  - Update electron from 2.0.9 to 2.0.10
  - Cut bloat from install package by more then 50%
- **Fixed:**
  - Correctly disable check for update menu item while in the middle of a check
  - Immortal tools: Fix show hidden files/folders preference
  - Fix mapper default zoom scale from 25% to 100%
  - Code editor:
    - Fix drawing focused room indicator for virtual area and area designer when clicking on axis number
    - Fix room wizard clipboard data grids so they are compatible with area designer data grids
    - Fix wizard data grids to correctly restore default data
    - Fix wizard paste button states
    - Fix output window space when disabled
    - Area designer:
      - Fix room preview to support comma delimited item list
      - Fix room preview item underline casing display
      - Fix code generation of long/short if empty and base not empty
      - Fix room preview to use base long/short if selected long/short is empty
      - Fix room preview when long/short starts and ends with a quote
      - Fix code generation and not correctly handling quotes in certain places
      - Fix drop downs in object editor
      - Fix ctrl+click opening multiple editor windows when using drop down list
      - Fix quality value for object editor not being set correctly

## v0.5.4 2018-09-17

- **Fixed:**
  - Auto login: delay sending the character name by a small amount to ensure the client has finished processing the incoming text
  - Make test commands case insensitive like all other #commands
  - Fix sending text that starts with # and is not a function
  - Mapper: Fix clear current area not updating the drop down navigation correctly
  - Code editor: Fix editor losing editor options when using save as

## v0.5.3 2018-09-10

- **New:**
  - Code editor:
    - Colorize syntax hover help line
    - Add hover tool tips for all FluffOS defined constants
- **Changed:**
  - Update spellchecker
  - Update electron from 2.0.8 to 2.0.9
- **Fixed:**
  - Auto update: disable manual check for updates when checking
  - Code editor:
    - Fixed memory leak with code formatting systems
    - Fixed set_reactions code generation in monster wizard and area designer

## v0.5.2 2018-09-04

- **New:**
  - Mapper:
    - Custom zooming to better draw the map
    - Keyboard support, Use numpad or arrow keys to scroll, delete key to remove a room, + or - to change level, / or \* to change zone
    - Mouse scroll lock, double clicking will lock scroll mode until click or escape ends it.
  - Code editor:
    - Add hover help for efuns, sefuns, and other supported functions that have supplied help data
    - Add basic Go to/Peek definition, works only with #define macros and only if in current file or included files relative to file
    - Format set_aggressive better when generating monster code
    - Virtual area editor:
      - Parse external rooms for doors to mark them as exits
      - Check if exit destinations start with VIR and if not mark them as external exits
- **Changed:**
  - Help: Rename main to home
  - Code editor: Menu and context menu now only show code related commands for .c files
- **Fixed:**
  - Help: Fixed main page
  - Auto update: Fixed taskbar progress for windows
  - Code editor:
    - Add functions efun to syntax highlighting
    - Fixed issue when opening a file it would open in the panel not linked to it's tab.
    - Monster wizard: fixed a minor issue when aggressive value set
    - Fixed copy selected text
    - Fixed formatting of text after a case in a switch statement
    - Area designer:
      - Fixed capitalizing of monster names in room preview
      - Fixed pasting rooms from different depth levels
      - Fixed object editing showing bait properties for object types that should not be bait
      - Fixed object editor dialog height covering parts of bait input fields
      - Fixed monster ask response type when editing
    - Virtual area editor:
      - Fixed external room code generation for set_items and set_exits to have proper comma formatting and no trailing comma
      - Trim all data values for external room generation to remove trailing spaces
      - Trim all external room strings when parsing
      - Correctly add add_exits for external rooms
      - Fixed pasting rooms from different depth levels
  - Mapper:
    - Fixed gap around map where rooms where not being drawn
    - Fixed double click break mouse drag scroll
    - Fixed drag cursor appearing on click, will now only appear when you start to drag when mouse down or scroll lock.

## v0.5.1 2018-08-27

- **New:**
  - Add tool tips to weapon icons displaying weapon type being held
  - Basic jiMUD help viewer, lets you read the jiMUD help docs with out having to load a website, help > jiMUD
  - Added jiMUD website to help drop down as jiMUD now opens new jiMUD help viewer
  - Code editor:
    - Add basic rules to add \* for block comments when adding new lines
    - Area designer:
      - Add visible doors to up/down exits on map
  - Mapper: Can scroll with mouse wheel when hovering a scroll icon.
- **Changed:**
  - Mapper: switch image-rendering to crisp-edges instead of pixilated
- **Fixed:**
  - Auto updater was updated to latest in attempt to fix auto update bugs.
  - Mapper:
    - Fixed an issue when adding a new room and not checking if a room exist at the same locations for an area
    - Added more error catching to new mapper systems
  - Code editor:
    - If more then one area designer or virtual area editor open property grids got stuck when selecting room editor fields
    - Fixed placement of area designer and virtual area map container and being overlapped by the x/y coordinate rulers
    - Area designer:
      - Fixed drawing of doors
      - Fixed room editor type selection not having new base rooms added
      - Fixed base room/monster editing not filtering out self from type dropdown
      - Fixed base room/monster grids not correctly resizing when new data added when tabs hidden
      - Fixed room/monster wizard editing to update inherit types

## v0.5.0 2018-08-25

- **New:**
  - Code editor:
    - Add library functions to code complete
    - Area designer:
      - Added hidden exit display to room editor, displays a list of hidden exits in a read only field
  - Mapper: optimize drawing systems to increase performance and scrolling speeds
  - Move from node-sqlite3 to better-sqlite3 4.1.4 as it offers better performance
  - Change how native node modules are packaged, they are no longer packed and should prevent them from having to be unpacked every time the client loads giving a small speed boost and prevent creating temporary files
  - Add case sensitive option to triggers to control if casing should be matched or ignored
  - Add [#event](docs/commands.md) add or update event
  - Add [#unevent](docs/commands.md) delete event
  - Add [#trigger](docs/commands.md) add or update trigger
  - Add [#button](docs/commands.md) add or update button
  - Add [#unbutton](docs/commands.md) delete button
  - Add profile argument support for [#alias](docs/commands.md) and [#unalias](docs/commands.md)
  - Add all supported settings for [#setsetting](docs/commands.md) and [#getsetting](docs/commands.md), see [faq](docs/faq.md) for list of supported settings and value types
- **Changed:**
  - Code editor:
    - Area designer: changed hidden exit color to orange to make it easier to see on white background
    - Virtual area editor: changed drawing system to use the same as area designer to offer indoor/outdoor room styles
  - Update electron from 2.0.6 to 2.0.8
  - Updated [Command docs](docs/commands.md) to use tables for better formatting
- **Fixed:**
  - Code editor:
    - Save scroll view state
    - Virtual area editor:
      - Fixed losing map dimensions after deleting or cutting room descriptions from the description editor
      - Fixed item editing when item index is greater then items created
      - Fixed parsing external rooms when changed and how set_items is parsed
      - Watch only files in the virtual map root path
      - Fixed external set_long formatting
      - Double clicking text in a data grid field editor did not always work and do native word text selection and would instead focus on first editor in row
      - External room parsing now correctly sets states to know the external room states that are supported in the editor
    - Area designer:
      - Re-coded drawing system to use sprites as larger maps where slow drawing
      - Fixed up, down, enter, and out exit colors when hidden
      - Fixed browsing for external exits
      - Fixed depth toolbar min/max
      - Fixed collection dialog editor and drop down sub editors
  - Immortal tools: do not attempt to open paths in code editor
  - Mapper: Fix some issues with reloading preferences after they have been changed
  - Fixed quote parsing for several #commands so that they strip based on quote settings
  - Fixed an issue where active profile was returning null breaking any #command that tried to access profiles
  - Fixed alarm and untrigger not sending notification that a trigger was removed or added to profile manager
  - Profile manager: Fix deleting selected items by context menu not clearing the current item editor correctly

## v0.4.62 2018-08-13

- **New:**
  - Code editor:
    - Add crafter and shipwright templates and to monster wizard
    - Add basic races to monster race list in monster wizard
    - Add monster random emote and speech support to monster wizard
    - View state caching, will remember the view state of files to restore them when reopened, eg folding should be remembered
  - Area designer:
    - New progress dialog for code generation to allow you to cancel and see progress better
    - Add food, drink, fishing poles, backpacks, and bags of holding objects
    - Add value property for all objects
    - All external exits are now defines in area.h per area standard, need to improve the name scheme still
    - Allow custom forage objects to be returned when players forage for food
    - Allow custom rummage objects to be returned when players rummage for materials
    - Monsters can now use other monsters as a base to allow you ultimate control and flexibility on how monsters are created
    - Monsters, rooms, and objects now all contain a note field to allow additional notes or info, this info will also be added to the header when code is generated
    - Objects that support bonuses can now be set, depending on the object bonuses are used differently
    - Armor and sheaths now support max wearable property and damaged systems
    - Add max encumbrance, lock strength, and item reduction properties to chest
    - Add prevent actions for all objects to control how certain actions work with objects
    - All armor and weapon objects can now have custom skill requirements set for all or per different classes
    - Food and generic objects can be turned into fishing bait
    - Add room and object read support
    - Merge all the No base \* in to single property field to make grids cleaner
  - Add [#setsetting](docs/commands.md) options for chat, see [faq](docs/faq.md) for list of all supported settings
  - Add [#chat](docs/commands.md) command to send test to chat window and append newline
  - Add [#chatprompt](docs/commands.md) command to send test to chat window with no newline
  - Chat capture: add option to disable capture as long as the chat window is hidden/closed
  - Immortal tools: added close button to queue/log panel
- **Changed:**
  - Area designer:
    - Generated file names will no longer append a number at the end if there is only one matching name
    - Long description editor now opens a dialog with more space and an option to open the advanced editor for easier color editing
  - Update tinymce to 4.8.1
  - Update monaco-editor to 0.14.2
- **Fixed:**
  - Area designer:
    - Fixed advanced button column for data grids
    - Fixed room editor monster and object drop downs not updating to reflect new monsters/objects or changes to name
    - Fixed room preview formatting when consolidating same named items or items with multiples
    - Fixed empty room checks so rooms that have objects, monsters, smells, items, sounds, and searches, as long as there is one the room will not be considered empty and be generated in code or be drawn in the mapper, this allows you to create shop storage and other misc rooms that may not have exits for what ever reasons
    - Fixed a bug with door code generation not setting external destination link
    - Fixed an issue when editing sheaths that quality and weapon where wrong
  - Code editor:
    - Fixed string formats for code generation
    - Fixed issue with virtual editor and area designer selection rooms when not focused
  - Refresh status display after settings are changed
  - Fixed some missing monster icons
  - Fixed -#s when using show needed xp as progress bar
  - Chat capture: Fix bug when using persistent window setting

## v0.4.61 2018-08-06

- **New:**
  - Code editor:
    - Add go to line for code editing, edit > go to to line or ctrl+g
    - Add warning and error icons for debug/formatting errors to make it easier to see errors/warnings
    - Room wizard: added temperature property to control temperatures of room
    - Virtual area editor: Room preview long description now supports color code preview
    - Area designer:
      - Create an area in a gui designer to create quick basic areas with rooms, monsters and objects
    - Monster wizard: Added full reaction support to let you give your monsters a little smarts
- **Changed:**
  - Update electron from 2.0.4 to 2.0.6
  - Update node-sqlite3 from 4.0.1 to 4.0.2
  - Several minor 3rd party libraries have been updated
  - Code editor:
    - Room wizard: Group types by area/standard types
    - Monster wizard:
      - Group types by area/standard types
      - Removed drop encumbered/drop combat encumbered
- **Fixed:**
  - Code editor:
    - Fixed formatting of case statements when they use parentheses
    - Clear remote file name for save as... as new file has unknown remote linkage
    - Fixed bug with test button when trying to test unsaved or new files
    - Fixed indenting errors to report correct line #s
    - Clear test / formatting errors when changed text as errors are probably no longer valid
    - Add filter efun to syntax highlighting
    - When opening many files fast from immortal tools editor would not load correctly
    - Fixed issue when dragging and drop tabs to display side by side
    - Room wizard
      - Fixed bugs with climbs, maxforage, prevent exit peers, and hidden exits in code generation
      - Fixed bugs with type order setting for climb/doors
    - Monster wizard
      - Fixed double set_height, mass being set to hair and other minor issues
    - When files saved update open time to save time, as file has been changed and old open is invalid
  - Fixed loading of external css/js scripts for different windows
  - Profile manager: Fix macro editing, at some point and upgrade to typescript changed how it imported a function block
  - Auto update: fix progress dialog not showing correct percent
  - Fixed -c command line argument
  - Fixed error logging in low level systems
  - Fixed disconnect dialog count down timer when it is disconnects more then 3 times
  - Advanced editor: fix bug when inserting pinkfish formatted text
  - Fixed disconnect not fully disconnecting from mud

## v0.4.60 2018-07-23

- **New:**
  - Auto update:
    - Show download progress in task bar for windows
    - Display download progress in main window
  - Code editor:
    - Virtual area editor:
      - Undo/redo system
      - Allow exit walk - lets you disable/enable exit generation from the num pad
      - Allow resize walk - disable/enable resizing of map using num pad by walking off the edges of the map
      - Resize map, set new width, height, and depth then pick how you want to position the current rooms
- **Fixed:**
  - When loading the same character over ensure auto connect is reran even if settings are the same and not reloaded
  - Code editor:
    - Tab navigation buttons and menu would not appear sometimes when using side by side views
    - Fixed ctrl+w and ctrl+tab to use on current active tab group
    - Error updating scroll dropdown menu when not open
    - Room editor/Data grids:
      - Advanced text editing now break by word not by letter when wrapping text
      - Exit/state editing text box was hidden behind drop down button
    - Room preview now correctly handles mixed cased items in matching to items
  - Menu bars did not always re-enable correctly

## v0.4.59 2018-07-16

- **New:**
  - Code editor:
    - Added copy remote path to tab context menu
    - Tabstrip drop down navigation menu: Visible tabs now show an indicator in the drop down menu if visible
- **Fixed:**
  - Code editor:
    - Virtual area editor was not correctly firing resizing system to update offsets
    - Do not watch new files for disk changes as they do not exist
    - When saving file as, add resulting file to recent
    - Fixed issue with external exits and room editor doing data multiple times
    - Fixed format document indenting of arrays if last element in a mapping was an array lookup using []
    - Fixed escaped characters when parsing strings when indenting
    - Tabstrip drop down navigation menu:
      - Colorized to match tab colors
      - Display tab tooltips when hovered
      - Correctly updates when window resized
    - Correctly remember last active open file when reopen is enabled
    - Fixed drag and drop of tabs between two tab groups
    - Add line/column #s to errors when formatting
  - Immortal tools:
    - Fixed windows file name sanitize system, replaces invalid characters with \_
    - Fixed issue with compressed dir decoding, if it fails attempt to re-get data

## v0.4.58 2018-07-07

- **Fixed:**
  - Code editor:
    - Changing item data would update the new selected room instead of the previous selected room
    - When saving catch any errors and display them

## v0.4.57 2018-07-07

- **New:**
  - New build process, 32 and 64 bit for windows are now all contained in a single installer/portable exe
    - Adds check for new updates feature with the new build process
  - Code editor: Add help menu with basic links to public immortal tutorial, code editor doc on github, and jiMUD help, and jiMUD about dialog
- **Changed:**
  - Update electron from 2.0.2 to 2.0.4
  - Update node-sqlite3 from 3.1.13 to 4.0.1
- **Fixed:**
  - Code editor:
    - Fixed minor issue updating room if no focused room set
    - Track open timestamp in an attempt to remove weird file change checks

## v0.4.56 2018-07-04

- **New:**
  - Mapper: character name is appended to window title to easily know who a map window is for
- **Fixed:**
  - Code editor:
    - Path not updated in status bar after save as
    - New area local/remote file browsing buttons
    - Try not to display a change dialog when opening files
    - Fixed menubar being enabled when item or external exit dialogs open
    - Fixed error when accepting external exit dialog
    - Fixed external exits not updating when set from room editor
    - Fixed items not correctly updating when changed from room editor
  - Immortal tools: fix undefined/undefined error correctly this time
  - Mapper: fix export as image

## v0.4.55 2018-07-03

- **New:**
  - Code editor:
    - Use enter key to begin editing of currently focused row when data grid is focused
    - Enter in active editor in a data grid will accept current changes and move to next and begin editing or add a new row
    - Add preferences to control how enter works in data grids, either move on to next cell, or close editor
- **Changed:**
  - Code editor:
    - Changed how multi-line text editor works in room editor advanced item and data grids, enter now always accepts, ctrl+enter will insert a new lines if allowed, if not will accept like normal enter
    - Escape now truly cancels editors with out changing values
- **Fixed:**
  - Replace localstorage for connection state with a global variable, removes major slowdown when loading jimud
  - Immortal tools:
    - Fixed undefined/undefined error when uploading folders, now correctly displays error or ignores error if required
    - Fixed bug when downloading a folder with multiple sub folders, was not correctly storing related local folder destination
    - Fixed open in editor button state when option is changed from preferences dialog
  - Code editor:
    - Fixed enter accept for editable dropdowns and checkbox dropdowns
    - Fixed when adding new external exit did not update changed state when starting with no exits
    - Fixed editing items in dedicated item editor

## v0.4.54 2018-07-02

- **Changed:**
  - Code editor: light range for virtual editor room/descriptions is now -15 to 15 instead of default
- **Fixed:**
  - Code editor:
    - Virtual editor:
      - External exits was displaying empty always after multiple room support was added
      - Fixed cut/deleting of descriptions, was doing smallest to largest index, throwing off later #s, now reversed and does largest to smallest fixing the issue
      - Fixed cut/deleting descriptions was formatting terrain file wrong
      - Fixed shift click selection for room editor
      - Fixed status bar better supported in virtual editor
      - Fixed issues parsing external room files in virtual editor
      - Do not display terrain text for external rooms
      - Fixed display of external file name in room editor
      - Ignore comments embedded in mappings when parsing external room code
      - Add room states to external room generation
      - Corrected code formatting of generated external room
      - Fixed when used in split views
      - Update terrain color scale after using short customs +/- or when new descriptions added
      - Fixed room editor/room preview breaking when no items
      - Fixed removing northwest exit of connected room when room deleted or cut
      - Fixed room edits when switching selected rooms, was updating new selection instead of previous
    - Make diff navigation buttons visible but disabled when not in use as you can not hide the menu due to a limitation in election not allowing hiding of separators

## v0.4.53 2018-06-30

- **Fixed:**
  - Data grid:
    - Fixed position and width of advanced editors for data grid on smaller windows, as data grid advanced editors are not true floating windows and must fit inside the window for full visibility.
    - Readd focus outline to advance editor buttons to know when focused from tab
  - Code editor:
    - Virtual editor:
      - When deleting a description from the description editor it was using width instead of height for adjusting room terrain indexes
      - Deleting descriptions where being saved to the wrong file
      - Room terrain indexes where not saved when changed from deleting a description
      - Room editor would throw an error when switching rooms with a property is in active edit.
      - When hitting enter after editing a number in a number editor did not cause the editor to close and save

## v0.4.52 2018-06-29

- **New:**
  - Code editor:
    - Virtual area editor now supports multi room selection by clicking and dragging mouse to form a selection box, all rooms inside the box will be selected or by clicking one room then shift click in a 2nd one and all rooms that form a rectangle using the 2 rooms as corners will be selected.
    - You can edit multiple rooms at once with the room editor, just selection them all in a block using drag selection and then change the option, **Note** if values for a property are all different the property will be set to blank until edited.
    - Unused terrains in the description editor will have their index # in bolded in red
    - Diff navigation, use previous or next buttons to move between changes when viewing in diff mode
    - Diff editor is better supported, menu items and context menus should now effect focused editor or supported editor
- **Changed:**
  - Code editor:
    - Change how commas are formatted following a }
    - When deleting a room it will now set terrain and item indexes to 0
    - Changed default settings for show colors/terrains to on
- **Fixed:**
  - Code editor:
    - Virtual area editor
      - Did not update terrains when raw terrains map is edited
      - Did not update descriptions when raw file was edited
      - Did not save changes to terrain or state files when changed from the visual map
      - Reverting map did not refresh the visual map
      - Fixed x axis numbers not being displayed correctly
      - Correctly highlight row or column of rooms when map has been scrolled
      - When using arrow or number pad to move around map, it would not correctly scroll the newly selected room if you have scrolled off the old room
      - Fixed mouse hover room while scroll, as old x/y they are now invalid
      - When after editing a room property and clicking on a read only field it would allow you to edit the field
      - Fixed advanced editors for single lines to wrap text
    - Fixed issue when split view and scrolling tabs not correctly setting scroll width
    - String blocks where not correctly terminated and formatted text in side
    - Save file as would not correctly clear the previous file name data
    - Would open files sent from immortal tools always in remote edit mode if code editor is not already open
    - Fixed context menus for data grid editors
    - Fixed toolbar buttons being covered when width is small
  - Fixed window save state system, correctly saves restore state so when un-minimized it returns to previous size instead of max size
  - Fixed data grid editors closing dialogs when pressing escape to exit editor

## v0.4.51 2018-06-25

- **Fixed:**
  - Code editor: Virtual editor property grid had wrong variable

## v0.4.50 2018-06-25

- **New:**
  - Log viewer: display your logs as if from the mud, supports html, raw ansi, and text files
  - Code editor:
    - Add upload and upload as system
    - Add open remote
    - Drag and drop local or remote files from immortal tools
    - Add new virtual area creation dialog for quick and easy virtual area creation, either for a current area or an entire new area
    - Add new monster using wizard for selection different properties and options
    - Add new room using wizard for selection of properties and options
  - Immortal tools:
    - Edit remote files directly using internal editor using the editor save to upload changed file
- **Changed:**
  - Immortal tools: Only allow drag out of files not paths
  - Update chokidar to 2.0.4
  - Rename x32 to ia32 for windows installer/portable to match standard arch naming
  - Advanced editor: Do not add sent to mud buttons when in editor only mode
- **Fixed:**
  - Profile editor: editor did not properly resize when advanced panel was toggled
  - Display:
    - When split scroll enabled would toggle scroll when preferences reloaded
    - When searching it would not correctly refocus when you reversed search
  - When loading the width of display and command box are incorrect leaving them very narrow when status display was hidden
  - Code editor:
    - Fixed test system for changed/new files, before it only uploaded data saved to disk unsaved files
    - When closing editor it would not correctly remember new files that where saved
    - Remove errors when dragging non tab over editor
    - Fixed issues with menus not being correctly enabled/disabled globally
    - Fixed paste advanced not being enabled when allowed
    - Fixed opening files on load that no longer exist
    - Fixed change event firing when new files created
  - Immortal tools: Fix issues when using with code editor
  - Advanced editor:
    - Some colors where broken when codes where pasted in or sent from other windows
    - Link window to code editor when in editor only mode so the window stays on top and closes when the editor closes

## v0.4.49 2018-06-17

- **New:**
  - Code editor:
    - Add a remote caching system to save remote paths and data for local files, allowing diff remote/debug systems to work with out having to ask for remote path every time
      - Clear remote caching from preferences dialog or remove all files from %appdata%\jiMUD\editor
    - Performance tweaks and fixes
    - Formatting will now auto strip trailing white space
    - Remote diff - browse and select a file from the mud if connected and compare it to open file
    - Remote test - allows you to select a remote location to test your local file by uploading it to a temporary name in the same folder as the real remote file.
    - New area dialog now allows you to browse and select remote destination if connected to the mud
    - Virtual area editor:
      - Description editor that allows you to view all terrains, add, delete, cut, copy descriptions and related items
      - Item editor to edit,add, delete, cut, copy any item group or items in a group
      - Exit editor destination allows remote file selection if connected to mud
  - Character manager: Allow more then # and letters for name, strip any invalid characters and set as login
  - Immortal tools: Error dialogs should appear for all non upload and download errors, as upload and download errors will appear in the queue list next to the item that caused the error
  - Backup: more debugging output
- **Changed:**
  - Code editor:
    - Changed formatting rule for semicolon (;), no long can be on a line alone, mostly happened when following a catch or time_expression block
    - Change how catch is formatted, before it used to be put on its own line, it is now treated more like a function, as catch acts more as a function then a keyword
    - Changed how {} are formatted after catch, leave { on the same line as catch as catch is treated more like a function
    - Moved diff clear, diff local, and diff original into a new sub menu folder to help cleanup file menu
  - Immortal tools: prefix all immortal tool remote commands with a unique prefix to allow it to know what commands it has sent compared to other window operations
- **Fixed:**
  - Code editor:
    - Fixed empty editor on first load if no files opened
    - New area dialog now properly disables menu bar when open
    - Fixed formatting of 'char' blocks, most noticeable when '' wrapped a none alpha numeric character
    - After saving new files it should now mark the tab as no longer new
    - Running diff local again on a different file cleared the diff instead
    - Recent list was cleared when trying to open a file that has been moved, deleted or renamed
    - Remove spaces between ! and :: when formatting
    - Display errors found when formatting
    - Virtual area editor: room external/item editor would update value even if cancel was selected
  - Character manager:
    - Prevent running OK event multiple times after adding/renaming/copying more then one or canceling
    - Renaming lost login, password, and development setting
    - Copying did not copy login, password, and development setting
    - When requesting the client reload the character database, when no character load it would create an invalid character named null
  - Attempt to refocus on command input after disconnect, paste special, and progress dialogs are closed

## v0.4.48 2018-06-05

- **New:**
  - Add a limit to how many times to try to auto login in a row
  - Do not attempt to login using character name if ShadowMUD says it does not exist
  - Code editor:
    - Diff file with original if changed or local file
  - Immortal tools:
    - Compressed dir systems to allow receiving of compressed dir file list to send data for larger folders faster
    - Dir performance tweaks to improve loading and changing directory speeds
- **Fixed:**
  - Backup: map file was not correctly updating when new character was loaded when connected to mud
  - Code editor:
    - Fixed output window display
    - Fixed dock change asking to save new files
    - Fixed file save cancel
    - Validate split layout better to ensure it is restored to a usable state
    - Properly update tab state for save all/ revert all
    - Tabs resetting editors every time they are clicked
    - Fixed tab context menu
    - Formatting :: operator when following keywords and constants stripping spaces
    - Do not add a space between -- or ++ and text
    - Remove all spaces after \* when in a variable declaration statement

## v0.4.47 2018-06-03

- **New:**
  - Code editor:
    - Code complete for ShadowMUD inheritable files, simple begin to type inherit and it will suggest a list of predefined inherits
    - Drag and drop reorder opened files
    - Drag and drop side by side viewing for up to 3 files at once with ability to resize each splitter area.
  - Backup: add debug output when doing client save
- **Fixed:**
  - Code editor:
    - Editor did not correctly resize when output window resized
    - Formatting :: directly after a (: was incorrect
  - Mapper:
    - Adding new rooms was broken when normalizing was added by mistake in v0.4.44
    - Fixed issues with area names with single quotes (')
    - Fixed issues with rooms with no exits being ignored

## v0.4.46 2018-05-30

- **Changed:**
  - Switch workers to es2017
  - Mapper:
    - New database index to try and improve performance
    - Other adjustments and changes to database settings to try and improve performance
    - Changed import code to streamline and improve performance
- **Fixed:**
  - Mapper:
    - When window hidden for persistent/enabled data was not flushed to disk correctly when using in memory
    - When switching characters was not correctly closing old windows
  - Child windows show state not being correctly saved

## v0.4.45 2018-05-28

- **Changed:**
  - Upgrade all 3rd party libraries to latest
- **Fixed:**
  - Mapper: Fix walk/highlight path, broken in 0.4.44 when adding normalizing and fixing save bugs

## v0.4.44 2018-05-28

- **New:**
  - Code editor:
    - Virtual map editor
      - Edit exits, descriptions, external exits, room items
      - Generate external room files quickly based on current room settings
      - Preview selected room as if on mud, with item highlight
      - Generate exits by using number pad, and ctrl+number pad to remove exits
      - Edit raw files directly when needed
      - Edit all external exits in a single list
    - Window can be persistent when not in editor only mode again
    - [Use native icons in tabs](docs/codeeditor.md) preference to allow control over icon display
    - When using editor only mode will maintain separate window state systems
  - Immortal tools:
    - Download and or upload files in compressed format for faster speeds
    - Added a max file check of 200,000 bytes and error if file is larger
    - Revert new files to initial starting code, either empty or template code
  - `-data-dir` command line argument, this allows you to override the default data storage folder with one of your own
  - `-no-pd, -no-portable-dir` command line argument, this forces portable application to use the default data folder instead of the application directory, `--data-dir` super cedes this
- **Changed:**
  - Upgrade to electron 2.0.2
  - Switch to es2017
  - Code editor:
    - Replaced ace editor with monaco editor which is faster and offers more features
    - Moved folding from edit to view menu
    - Formatter: remove spaces after ( and before ) and after and before ::
  - When using portable version it now defaults to using current application directory as data folder, use `-no-pd` to restore previous usage
  - Mapper: all imported and exported data is normalized to try and ensure it is the correct data coming and going out
- **Fixed:**
  - Code editor:
    - Fixed reopen order when restoring files
    - Fixed insert color dialog
    - Editor only losing task bar icon when preference changed
    - Fixed state loading
    - Fixed file watching to ask if reload or keep open
    - No longer loaded always after editor only mode used
    - Fixed new monster from file menu not working
  - Advanced editor:
    - Fixed extra new line added when sending text to mud or code editor
  - Fixed help display for command line for -e and -eo arguments
  - Force error into a string to ensure it is displayed.
  - Mapper:
    - Area list not being populated correctly on load
    - Area list is now sorted in alphabetic order
    - Mapper window was closing before mapper data was fully flushed to disk when [Load in memory](preferences.md#mapper) is enabled

## v0.4.43 2018-05-07

- **New:**
  - Status: dominant weapon hand is now bordered with red
  - Code editor:
    - Allows you to view and edit code lpc code
    - When closing if left open will remind you before closing
    - Multi tabbed interface to open multiple files
    - Drop files on to main code area to open
  - Immortal tools: New [open file in external editor](docs/immortal.md) preference, allows you to choose to ignore the new internal code editor
  - Advanced editor:
    - Can send formatted text to open code editor to be inserted at current cursor
    - Copy formatted, copy selected text with the format codes, using Ctrl+Shift+C or context menu
    - Paste formatted, paste text formatted with pinkfish codes and have it display in the editor with full formatting, Ctrl+Shift+P or context menu
  - More monster icons
- **Changed:**
  - Upgrade ace editor to newest build
  - Upgrade several 3rd party dependencies
  - Immortal tools:
    - Rename old editor to external editor
    - Add new editor using new internal code editor.
  - Display: Optimize display creation
  - Advanced editor: Changed bold black to send mono11, as many clients cant handle bold black and the mud will handle converts of the code to other clients
  - Remove keyboard shortcut for toggling dev tools for all windows as they are mint for advanced debugging of client
  - Convert all old menu bars into new menu bar system for united code base for easier bug fixing
- **Fixed:**
  - Immortal tools:
    - Buffer size was not correctly being stored as a number when changed from default in preferences
    - When saving preferences was not correctly updating temp and buffer size options
  - Telnet:
    - MCCP was not correctly being processed.
    - Split buffer was not always correctly cleared
  - Character manager:
    - Profiles where not correctly saving when switching characters
    - Profile menu list state was being updated to match correctly enabled profiles
  - Fixed color picker not being a modal dialog in some instances

## v0.4.42 2018-04-23

- **Changed:**
  - Status: Use unique player/monster ids if supplied then fall back to the old name id
  - Immortal tools:
    - Rename when no extension will not select all by default
    - Double clicking local folder would not always change remote folder if matching sub folder exist
    - Fixed added 'change to directory' to context when nothing selected

## v0.4.41 2018-04-17

- **Changed:**
  - Upgrade electron to 1.8.4
- **Fixed:**
  - Mapper: force save in case the mapper window is unloaded
  - Immortal tools: could not click in rename text box to position cursor
  - Character manager: Do not close dialog when no is clicked from confirm dialog
  - Monster icons not displaying due to case sensitivity and numeric additions to names
  - Status: trim training # to monster name to allow unique monster classes to be used
  - When reloading options it would not reinitialize the profiles to correctly load the new enabled ones

## v0.4.40 2018-03-20

- **Changed:**
  - Upgrade several 3rd party dependencies
- **Fixed:**
  - Mapper: in memory option was broken

## v0.4.39 2018-02-12

- **New:**
  - Preference: Show extended error messages, hide expanded error messages unless told to but for logging
- **Changed:**
  - Update to electron 1.7.12
- **Fixed:**
  - Fixed double, triple, and quad click text selection
  - Immortal tools:
    - Double clicking a folder in local while remote is root (/) would cause a double // in the path
    - When uploading or downloading a new file it would fail to correctly focus on item when Focus on finish was enabled
  - Correctly detect window focus state on load
  - Backup: fix an issue when restoring and setting logErrors to the wrong value
  - Only show disconnect dialog if it was a connection error
  - Reset disconnect timers when clicking any button but reconnect from disconnect dialog

## v0.4.38 2018-01-15

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
    - Fixed double clicking items as they are removed from local/remote/queue table
    - Update queue table properly when local/remote folder are changed to refresh the file path state
    - When double clicking a folder in local when sync enabled, fails when in root remote (/)
  - Mapper:
    - When reloading the same character it would not refresh the map file if it changed from previous load.
    - When import progress dialog is closed with escape key properly end import.
  - Display scroll bars where not correctly updated when buttons/status display was hidden/shown
  - View > Buttons > Button check state was not correctly set when setting toggled
  - GMCP event is no longer triggered when an error decoding GMCP is done

## v0.4.37 2017-12-26

- **Changed:**
  - Immortal tools: Local/remote paths in queue list now replace start of path with . if local/remote paths match current working local/remote
- **Fixed:**
  - Immortal tools:
    - Downloading multiple folders at once was broken
    - Queue progress is more accurate
    - Could not download empty folders

## v0.4.36 2017-12-25

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

## v0.4.35 2017-12-18

- **Fixed:**
  - Rebuild context and buttons after a profile enabled state has changed
  - Profile menu states where not updated based on new setting data
  - Profile Manager:
    - When profile toggled from menu and profile manager is open update the enabled state
    - Enabled check state was not correctly set when profile is selected, causing the profile to be set based on previous selected item
  - Mapper: fix minor issue when trying to process data before the mapper window is ready
  - Don't attempt to show disconnect dialog if already open

## v0.4.34 2017-12-14

- **Fixed:**
  - Preferences where not being saved, introduced in 0.4.32 with correcting windows open

## v0.4.33 2017-12-12

- **New:**
  - Add dev setting per character login to allow easier development login
- **Fixed:**
  - Bug in disconnect code
  - Fixed an issue with game pads
  - Fixed chat, mapper, and editor windows when characters are changed so they close and reopen as needed
  - Fixed character data not saving before loading new character

## v0.4.32 2017-12-12

- **New:**
  - On disconnect preference, allows you to pick what happens when you are disconnected
    - Nothing - do nothing
    - Reconnect - reconnect using auto connect rules
    - Reconnect dialog - show a dialog with an auto reconnect count down with buttons to allow you to pick
    - Show character manager - display the character manager
    - Quit - quit the client
  - Immortal tools:
    - Queue list now contains an status column to display any errors from upload/downloading
    - Queue list error icon now has error as tooltip
- **Changed:**
  - Immortal tools: Performance tweaks to lower cpu when downloading or uploading
  - Immortal tools: Update data table control to newest version
- **Fixed:**
  - Immortal tools:
    - Update status bar when reset
    - Fixed creating sub folders in current local folder
    - Statusbar now shows correct remote file counts
    - Mark items with an error icon instead of just removing
  - Fixed issue where new client window was created instead of a sub window
  - When reloading options, close all child windows and recreate based on new options
  - Fixed issue with exporting macros

## v0.4.31 2017-12-05

- **New:**
  - Add [#untrigger](docs/commands.md) command to remove triggers or alarms
  - Immortal tools: can zoom in/out and reset from menu bar
  - Mapper, immortal tools, profile manager, advanced editor, and chat window now support loading css/js to allow [customizing](docs/customizing.md) by creating files in the application data folder.
    - Profile manger: profiles.js and profiles.css
    - Chat capture window: chat.js and chat.css
    - Mapper: map.js and map.css
    - Advanced editor: editor.js and editor.css
    - Immortal tools: immortal.js and immortal.css
- **Changed:**
  - Immortal tools: use natural sort when sorting file names
- **Fixed:**
  - Chat capture: crafting and tattooist menus should now be ignored
  - Keep alive was setting as milliseconds instead on seconds.
  - Keep alive delay was not set due to a bug in node it was not setting correctly unless already connected.
  - Fixed var tag in #TestMXP
  - Fixed parsing of var tag if invalid tag matching
  - Immortal tools: List view key down selection search now ignores case for more accurate searching

## v0.4.30 2017-11-29

- **New:**
  - Character manager: login name independent of the character group, this allows you to create 2 characters with same login name but different group name, this makes it easier for those that have a character on dev mud and main mud using the same name but different setting files
- **Changed:**
  - Expand error catching to try and get more information
  - Change how active profile is found, active profile now should be highest priority profile or default
  - [#alarm](docs/commands.md) when just passing a single # now allows more then 59 seconds, to create second only timers, if over 59 it assumes wildcard
  - [#alarm](docs/commands.md), [#suspend](docs/commands.md), [#resume](docs/commands.md) now parse id, time pattern, and profile arguments so functions and variables can be used
- **Fixed:**
  - Fixed loading profiles not clearing internal caches
  - Fixed suspend/resume to correctly time suspended alarms when resumed
  - Immortal tools: Error dealing with missing type2 column used for date sorting

## v0.4.29 2017-11-27

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
    - Fixed never ask again when closing
  - Immortal tools:
    - List views now correctly scroll to top when remote or local path has been changed
    - List view key down selection search now works more like windows explorer, will start from current selected item
    - Date modified column groups folders and files instead of mixing them up

## v0.4.28 2017-11-15

- **Fixed:**
  - Backup:
    - Fixed hang when trying to load remote data and mapper window not created
    - Fixed importing map data if mapper disabled
  - Tray icon no longer lingers in system tray when client closed.
  - MXP parsing not correctly closing custom element tags

## v0.4.27 2017-11-04

- **Fixed:**
  - MXP parsing replacing custom tags with ''
  - Chat capture:
    - Fixed capture of who list when only 1 user online
    - Fixed clearing chat window using clear button

## v0.4.26 2017-10-27

- **Fixed:**
  - Chat capture: finally fix ignoring stores and lockers

## v0.4.25 2017-10-26

- **Fixed:**
  - Chat capture: fix ignore captures for stores and lockers, use a counter instead of a simple flag
  - Fixed spaces in skill/weapon ids to convert to - so large sword and small sword icons work
  - Mapper:
    - auto walk buttons not correctly set to enabled when current room is different from selected room
    - Re-coded draw timing to be synced with core drawing system to try and lower cpu

## v0.4.24 2017-10-14

- **New:**
  - Preference: can now disable file watcher for profile manager.
  - Backup all profiles: allow all profiles to be saved when using client save
- **Fixed:**
  - Chat capture: ignore all lines between ------ for stores/lockers
  - Backup: make sure room id is a number when saving
  - Mapper: make sure room id is a number when exporting

## v0.4.23 2017-10-07

- **Fixed:**
  - Mapper:
    - Fixed zone yet again, attempt to only change the zone if a room exist at coords
    - Assign current zone to the new room

## v0.4.22 2017-10-06

- **New:**
  - Experimental game pad support
  - Mapper: Added zoom in, zoom out, zoom reset, toggle developer tools, and toggle full screen
- **Fixed:**
  - Chat capture: Capture all lines no matter what characters they may contain when capture all lines is enabled
  - Mapper: Fix zones not assigning right when moving to a new area
  - Immortal button not being hidden on disconnect then re-login with a non immortal login
  - Backup system was not having the correct map file set when character was changed.

## v0.4.21 2017-09-26

- **Fixed:**
  - Mapper: Fix mapper new zone correctly this time

## v0.4.20 2017-09-26

- **New:**
  - Chat capture:
    - Add zoom in, out and reset buttons
    - Add font and font size settings
- **Fixed:**
  - Mapper:
    - Fixed an issue when creating new zones.
    - Fixed an issue when adding new rooms it was attempting to add them twice

## v0.4.19 2017-09-25

- **Fixed:**
  - Profile manager:
    - Where not correctly reloading deleted ones from memory.
    - New profiles enabled checks where set to disabled, yet where
    - Removed profiled, then re-added new with same name didn't save correctly
    - Linux: Was not correctly removing profile data files due to casing issues
  - Chat capture: capture name that include a ' and spaces

## v0.4.18 2017-09-18

- **New:**
  - Chat capture: Add shout to tell captures for chat window
- **Fixed:**
  - Mapper: Area navigation drop down fails when area name contained a space
  - Chat capture: ignore fragmented lines due to split packets or mixed parsing

## v0.4.17 2017-09-16

- **New:**
  - Added preference to disable code editor in profile manager
- **Fixed:**
  - Mapper:
    - Area navigation not updated when new area created
    - Room property editor position not updating when toolbar wraps

## v0.4.16 2017-09-15

- **Fixed:**
  - Downgrade to electron 1.7.7 to fix a crashing bug with 1.8.0
  - An issue with auto connect not working

## v0.4.15 2017-09-14

- **Changed:**
  - Updated electron to 1.8.0
  - Updated spell checker and sqlite
- **Fixed:**
  - Copy was not working on Linux
  - Fixed command argument parsing
  - Mapper: Zone/level not updating when active room
  - Verbatim was failing to append new line characters
  - Profile manger: Fix display of html characters in tree view
  - Fixed a bug in parsing %# arguments

## v0.4.14 2017-09-04

- **Fixed:**
  - Fixed display width when status display hidden
  - Added a trailing ; to the Linux category
  - Fixed spell checker on Linux
  - Fixed parsing of double/single quotes as strings when ending of a command

## v0.4.13 2017-08-19

- **New:**
  - Added new Windows 10 color scheme
  - Added Current color scheme to reset colors back to original colors
  - Added --disable-gpu command line arg
  - Added Linux Categories
- **Changed:**
  - Changed how copy system works for main client
- **Fixed:**
  - When picking a predefined color scheme it was not saving
  - Display scrolling in split view or scroll lock when new text added
  - #TestSize size was broken when new display added
  - Mapper will now send a room request for current every time it is loaded/reloaded/importing fixing the mapper from getting lost when connected and changing mapper settings
  - Client saving was not correctly getting mapper data when in memory option was enabled

## v0.4.12 2017-08-16

- **Fixed:**
  - Backup exported macro display code wrong
  - Profile manager editor title text overflowed and filled background

## v0.4.11 2017-08-16

- **New:**
  - Added function doc file to explain functions and list predefined variables
  - Added intern corner support for overlays (selection, find)
  - Preference: Enable rounded overlays, disable or enable rounded corner effect for selection and find highlighting
  - ${eval(expression)} to allow evaluation a math expression when ${expression} is disabled
  - Add proper escape system with parser changes, characters: $%"'{\ and command stack character, to escape a character simply just do \CHARACTER
  - Expressions now allow the function dice to be used as if normal math function, eg: `${5 + dice(2d6) * 5}` is the same as `${5 + ${dice(2d6)} * 5}`
  - Functions:
    - ${dice(**x**d**y\*\***+n\*\*)}, roll a dice, x is the # of dice, y is the # of sides, with optional +,-,\*,/ modifier
      - example: ${dice(2d6+5)}, rolls 2, 6 sided dice and returns the sum + 5
    - ${diceavg(**x**d**y\*\***+n\*\*)} the avg roll of dice, x is the # of dice, y is the # of sides, with optional +,-,\*,/ modifier
    - ${dicemin(**x**d**y\*\***+n\*\*)} the minimum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,\*,/ modifier
    - ${dicemax(**x**d**y\*\***+n\*\*)} the maximum roll of dice, x is the # of dice, y is the # of sides, with optional +,-,\*,/ modifier
    - ${dicedev(**x**d**y\*\***+n\*_)} return standard deviation of dice `sqrt((y^2-1)/12 _ x)`, x is the # of dice, y is the # of sides, with optional +,-,\*,/ modifier
    - ${zdicedev(**x**d**y\*\***+n\*_)} return zMUD/cMUD standard deviation of dice `sqrt(((y-1)^2-1)/12 _ x)`, x is the # of dice, y is the # of sides, with optional +,-,\*,/ modifier
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
  - Parsing was re-coded to properly handled ${}, %{}, %\*, and %# variables with proper stack tracking
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

## v0.4.10 2017-08-03

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
    - Remote drag and drop on Linux was broken

## v0.4.9 2017-07-30

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
  - Added \${#}, %{#}, %{_}, ${_} formats to match {} variable format
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

## v0.4.8 2017-07-25

- **New:**
  - Immortal tools:
    - Focus files on finish upload/download
    - Select files on finish upload/download
- **Fixed:**
  - When closing a dynamic window dialog it would error saying window destroyed
  - Fixed saving dynamic window alwaysOnTop, alwaysOnTopClient, and persistent
  - Fixed window close states for all windows
  - Backup was not correctly loading settings when using client load
  - Fixed MXP music, sound, gauge and stat tag argument parsing
  - Immortal tools:
    - Updated status bar to have more generic information
    - Preference dialog now correctly sets and saves window settings
    - Scroll position is no longer lost when local, remote, or queue list are updated
    - Selection state is no longer lost when local or remote files are updated
    - Remote list is now properly reinitialized when the mud sends init code
    - Error when dropping files for remote upload

## v0.4.7 2017-07-24

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

## v0.4.6 2017-07-21

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

## v0.4.5 2017-07-14

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

## v0.4.4 2017-07-12

- **New:**
  - Immortal tools: current queue progress now supports windows task bar progress
  - Mapper: import task bar progress should now support separate window update + main client on task bar
- **Fixed:**
  - Mapper: during code cleanup moved to a stricter compare (===) and the mud sends a # while it is stored as a string in the mapper, it now converts remote data into string
  - Profile manager: During code cleanup deleted a line of code that broke macro editor

## v0.4.3 2017-07-08

- **Fixed:**
  -Advanced editor was broken due to previous code cleanups

## v0.4.2 2017-07-07

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

## v0.4.1 2017-07-03

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

## v0.4.0 2017-06-23

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

## v0.3.3 2017-06-21

- **Fixed:**
  - Fixed options undefined errors
  - Log mapper errors to log file when log errors enabled
  - Fixed issues with error log not correctly logging the error message
  - Attempted fixes to mapper losing data

## v0.3.2 2017-06-16

- **New:**
  - Add enable spellchecking preference to allow spell checking to be turned off
- **Change:**
  - Log error setting default to on
  - Improved trigger performance by changing how some test are done
  - Re-enable TestMapper() to allow testing of mapper
  - Updated to electron 1.7.3 beta
- **Fixed:**
  - Fixed bell Unicode character display
  - Editor:
    - New lines where not correctly being sent when sending as formatted text
    - Trailing newlines where being cut off
    - Fixed flashing format not being sent when flashing disabled
  - Fixed a bug in aliases and macros when script style was used, would error due to strict type comparison
  - Fixed a bug in aliases, macros, and triggers when script style returns a non string/null/undefined

## v0.3.1 - 2017-05-30

- **Fixed:**
  - Character manager: file not found issues, will now properly check if characters file exist before accessing it
  - Do not attempt to access user data folder until app is ready, fixes character folder creation checks

## v0.3.0 - 2017-05-30

- **New:**
  - Split scroll, **Experimental** this will allow you to scroll while displaying the most recent lines at the bottom with option live update or post update
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
    - `-pf=[list], --profiles=[list]` set which profiles will be enabled, if not found will default
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

## v0.2.4 - 2017-05-22

- **Changed:**
  - Profile manager: treeview should now sort by profile name, with default always being first
- **Fixed:**
  - Profile manger:
    - importing from file was broken, now will ask to replace, do nothing, or copy if name exist instead of defaulting to copy
    - Undo/redo of adding profiles was broken when you undo an add then redid it would break and lose profile
  - Trigger cache was not clearing when profiles enabled/disabled

## v0.2.3 - 2017-05-21

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

## v0.2.2 - 2017-05-20

- **Fixed:**
  - Default profile appearing twice in menu on first load
  - Backup:
    - loading wrong url when using development setting
    - corrupted load data due to a previous bug fix with data type

## v0.2.1 - 2017-05-20

- **Changed:**
  - Adjusted dark mouse over colors to be more visible
  - Mapper window will now show when a backup import triggers to show mapper progress
- **Fixed:**
  - Fixed issues with closing client and still being connected and saying no to close
  - Sound/Music commands work
  - setsetting/getsetting commands work
  - A bug in backup when ajax error happens and not being able to abort load/save
  - A bug when importing legacy profiles and settings not correctly converting to boolean datatype
  - Backup settings where not being applied until a restart

## v0.2.0 - 2017-05-19

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
    - Light gray - a light gray theme
  - About dialog now includes memory information.
  - Preferences
    - Mapper: default import type, allows you to determine how map data will be imported when using default import systems
    - Backup load/save selections, determine what is saved or loaded when using the remote client backup system
- **Changed:**
  - Default button icons have been converted to font-awesome or svg icons for easy theming and crisper look
  - Upgrade electron to 1.7.1, fixes a few crashers with --debug
  - New application icons, should be cleaner and support Linux, windows and mac
- **Fixed:**
  - Ansi parser would return empty elements due to changing styles and colors, the empty blocks are now removed when the lines have been added, should reduce memory
  - Preferences was not saving display/command font setting
  - View > Status > Visible was showing wrong check state
  - Fixed lines not being trimmed to buffer size, was introduced when display was converted to an iframe to fix the selection bugs.
  - Mapper
    - Fixed a JavaScript bug when clicking cancel button on progress dialogs
    - Import dialog would not close when imported data had no rooms

## v0.1.9 - 2017-05-14

- **New:**
  - User context menus, create custom items for the right click display menu
  - new variables in javascript
    - `$selectedword/$selword` - returns the word under the mouse when right clicked
    - `$selected` - returns the current selected text
    - `$selectedline/$selline` - returns the current line text
    - `$selectedurl/$selurl` - returns the current url when right clicked
    - `$copied` - return clipboard text
  - Parsed variables that work like the JavaScript ones in format of %{variable}, you may force upper, lower, or proper case by appending .lower, or .upper, for example %{selword.lower} will return lower cased version, or using the inline parse functions
  - `%{copied}` - replace with clipboard contents, for JavaScript use this.readClipboard() or client.readClipboard where needed
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
    - Tooltip/color menus now display color code and display name based on XTerm 256 color names and ShadowMUD color database
    - Color selection has been trimmed to the basic 16 colors + no color, with an option to open a more advanced color selection dialog, this should reduce load times.
  - Profile manager
    - Moved import button to a export/import drop down
    - drop down menus and context menus are now created on demand in stead of made when loaded
  - Mapper
    - Changed how drop down menus where created, now creates on demand instead of staying loaded in memory
    - Area navigator is now fixed with in the toolbar, should keep it from jumping around or being cut off with long area names
  - Converted from custom bell to system bell sound
  - View > Status > Limbs was expanded to a new sub menu for visible, health and armor toggling
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

## v0.1.8 - 2017-05-11

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

## v0.1.7 - 2017-05-09

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
  - Fixed preference context menus
  - Fixed bug with newline/prompt when executing triggers
  - A bug in needed xp being -#

## v0.1.6 - 2017-05-07

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
  - Added some [docs](docs/README.md) to the GIT repository
  - Mapper can now be set to always be on top of client, all windows, or independent
  - Mapper import, profile import, and backup load now set windows task bar progress bar
- **Changed:**
  - Advanced editor now uses monospaced font
  - Removed insert date/time from advanced editor context
  - Display re-coded into an iframe to fix selection disappearing when lost focus.
  - Simplified mapper image export
  - Can no longer close client until profile manager has been closed
  - Changed how deleted profiles where moved to trash, now uses framework instead of extra node module
  - Upgraded to electron 1.6.8
  - All css/js files are ran into minimizers to gain some speed
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

## v0.1.5 - 2017-05-01

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
  - Added JavaScript aliases for OoMUD so web client scripts will work with little to no changes.
- **Changed:**
  - Minified all JavaScript code to try and improve speed
  - Compressed all PNG files to reduce size for loading improvements
- **Fixed:**
  - Profile manager
    - Button preview was broken in last update, now working again
    - Profiles where not deleted correctly
    - Copy/cut/paste should once again work with input areas when they have focus
  - Properly working Linux packages

## v0.1.4 - 2017-04-29

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

## v0.1.3 - 2017-04-26

- **Changed:**
  - Mapper Clear/Walk path are now disabled when no path highlighted
- **Fixed:**
  - Mapper vertical and horizontal scroll where not correctly being restored on load.
  - Profile cloning was erroring do to calling the wrong collections
  - Client was emitting wrong event when new text was added to display causing
  - triggers and anything that relied on that event to fail

## v0.1.2 - 2017-04-25

- **New:**
  - Trainer mapper npc type
- **Changed:**
  - Mapper room details editor updated
- **Fixed:**
  - Mapper saving open/close state
  - Missing RGBColor module for settings dialog
  - Window size not being sent to mud when resized

## v0.1.1 - 2017-04-24

- **Fixed:**
  - Profile menu looking for a profile folder when does not exist
  - Turned off debug mode by default
- **Changed:**
  - Upgraded to electron 1.6.7

## v0.1.0 - 2017-04-24

- Initial release
