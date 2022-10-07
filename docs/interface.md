# Main interface

## Tab bar

All open client tabs, hidden with only one client open unless [Always show window tabs](preferences.md#interface) is enabled,
when [Show add new button next to tabs](preferences.md#interface) enabled display an add new tab button to open new client tabs

## Menu

### File

- `New Tab` Create a new connections in current window
- `New Window` Open a new window with a single mud connection
- `Connect` Connect to the mud
- `Disconnect` Disconnect from the mud
- `Enable parsing` toggle input parsing on and off
- `Enable triggers` A quick toggle to disable triggers in the current connection
- `Characters...` Open the character manager dialog
- `Log` Toggle logging on and off for current connection
- `View logs...` Open log viewer dialog connected to the current connection
- `Global Preferences...` When visible will open the preference dialog to edit global preferences
- `Preferences...` Will open global preferences if current mud is using global preferences or the current mud preferences if not using the global settings
- `Close` Visible when more then one tab open, will close current active client tab
- `Exit` Close all clients, windows and save the current layout based on layout preferences

### Edit

- `Undo` Undo currently focused input box
- `Redo` Redo currently focused input box
- `Cut` Cut from currently focused input box
- `Copy` Copy selected text from the display or currently focused input box selected if no selected text in main display
- `Copy as HTML` Copy selected text from display as html with full color support as valid html tags
- `Paste` Paste text into currently focused input box
- `Paste special` Open the paste special dialog to paste text into command input
    `Replace With` Replace new lines with text
    `Prefix` Prepend prefix to all lines
    `Postfix` Append postfix to all lines
- `Delete` Selected text from currently focused input box
- `Select All` Select all text in the display
- `Clear` Clear display of all text
- `Find` Open the find dialog to search the display for matching text

### Profiles

A list of all profiles that can be toggled on and off

- `Manage...` Open profile manager to edit profiles

### View

- `Lock` toggle scroll lock on or off
- `Who is on?` Display who is currently on the mud depending on settings, by default it will open the url in default web browser, can be set to open in a jiMUD window in preferences if desired
- `Status` Control right status bar visible state and sub sections visible states
    - `Visible` Show status bar or not
    - `Refresh` Force refresh status bar and request update from mud if connected
    - `Weather` Display weather status box
    - `Limbs` Control limb display state
        - `Visible` Show or hide limb status
        - `Health` Display limb health
        - `Armor` Display armour protection
    - `Health` Toggle health bars on or off
    - `Experience`Toggle display of experience status box
    - `Party Health` Display party health bars when in a party
    - `Combat Health` Display current target health bars
    - `Lag meter` Toggle display of lag meter
- `Buttons` Control button bar visible state and what buttons to display
    - `Visible` Toggle display of button bar
    - `Connect` Display connect/disconnect button
    - `Characters` Display button to show character manager
    - `Code editor` Display button to show code editor
    - `Immortal tools` Display button to open immortal tools, visible only when connected as an immortal
    - `Preferences` Display button to open preference dialog, if using global settings opens global preference dialog or client preferences
    - `Clear` Display button that clears display
    - `Lock` Display button that toggles scroll lock
    - `Map` Display button that opens mapper window
    - `User buttons` Toggle display of user profile buttons
- `Developer Tools` Toggle developer tools for window or active client
    - `Toggle Window` Open or close the window's developer tools
    - `Toggle Active Client` Open or close the developer tools for the current active client tab
    - `Toggle Both` toggle both window and active client tools
- `Actual Size` Reset zoom to default size
- `Zoom In` Make window scale larger
- `Zoom Out` Make window scale smaller
- `Toggle Full Screen` Toggle full screen mode on or off

### Window

- `Advanced Editor...` Open the advanced editor window
- `Chat...` Open the chat capture window
- `Code editor...` Open code editor window
- `Map...` Open auto mapper window
- `Skills...` Open skills window
- `Command history...` Open command history window
- `Save Layout` Save current client and window layout as a custom layout file
- `Windows...` Open windows dialog to show all open windows and clients
- `Minimize` Minimized current window
- `Close` Close current client tab or window if only one client open

### Help

- `ShadowMUD...` Open shadowmud help url in browser or jiMUD window depending on preferences
- `jiMUD...` Open jiMUD help window
- `jiMUD website...` Open the jiMUD github website in default browser
- `Check for updates...` Check for updates and offer an option to update if possible
- `About` Open about dialog with a basic resource usage tab

## Button bar

Buttons that offer access to open basic feature or user butters from profiles

## Display

Main mud display - displays all incoming text from mud

## Status display

Character status when logged into the mud

- `Weather` displays current weather for room character is in as well as the night/day and any visible moons
- `Limbs` display current limb health or armor protection
    - `Name` Logged in character
    - `Buttons` buttons to switch between health and armor display
- `Health bars` Bars that display current health
    - `HP` current health points
    - `SP` current stamina points
    - `MP` current mana/mental points
- `Experience` Displays current experience status    
    - `XP` Total experiences
    - `Needed` experience pointed needed to level
    - `Earned` Amount of experience earned since connected
    - `BankedXP` Amount of spendable experience points
- `Party health bars` Display all current party member health
- `Combat health bars` Display all attacking target health
- `Lag meter` Display approximate lag to mud

## Command input

Main command input to send text to mud or execute client commands

- `Show command history` Display a menu of last commands executed and an option to open command history window
- `Toggle parsing` Quick toggle to enable or disable text parsing in client
- `Toggle triggers` Quick toggle to enable or disable client triggers
- `Show advanced editor` Open advanced editor window

    