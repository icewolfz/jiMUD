# Profile manager

- `Refresh` reload all profiles
- `Add` add new item based on current selected item or chosen from menu
- `Undo` undo last change
- `Redo` redo previous change
- `Cut` cut selected item
- `Copy` copy selected item
- `Paste` paste copy/cut items into current active profile
- `Delete` delete selected item
- `Import/Export` export or import profiles
  - `Export current` export current profile
  - `Export all` export all profiles as one file
  - `Import` import profiles

## Profiles

- `Enable Triggers` enable/disable triggers from being executed as text is received or sent to the mud for the selected profile
- `Enable Aliases` enable/disable aliases from being executed before text is sent to the mud. for the selected profile
- `Enable Macros` enable/disable keyboard macros when keys are key combinations are pressed for the selected profile
- `Enable Buttons` enable/disable buttons
- `Priority` The profile's priority, this allows you to control the order in which profiles are sorted when executing aliases, triggers and macros in case of duplicate names
- `Import defaults` Import and append any default items
- `Reset profile` Reset profile into an empty profile with default settings

## Aliases

- `Enable` enable/disable selected alias
- `Name` the name of the alias, this is used to execute an alias
- `Style` how the value is processed
  - `Text` send value as is
  - `Parse` do standard parsing, allows %0 ... %n to access arguments, or %name or $name, [may use alterative ${}/%{} block syntax](functions.md)
  - `Script` the value is javascript, it will evaluate and any thing returned will be sent to the mud. the value is wrapped as a function and any matched patterns are passed as arguments, use standard arguments[#] to access.
- `Value` the value to send to the mud
- `Params` this allows you to name arguments in a comma delimited list, each word in the list is the same as the %# and accessed using $name, %name, ${name}, or %{name}
- `Priority` the sort order of aliases
- `Append arguments` append any unused arguments to the end of the value before sending to the mud
- `Multi` this allows you to have aliases of all the same name, and if false to stop executing on this alias

## Macros

- `Enable` enable/disable selected macro
- `Key` the key combo to press to run macro
- `Style` how the value is processed
  - `Text` send value as is
  - `Parse` do standard parsing
  - `Script` the value is javascript, it will evaluate and any thing returned will be sent to the mud. the value is wrapped as a function and any matched patterns are passed as arguments, use standard arguments[#] to access.
- `Value` the value to send to the mud
- `Name` a simple descriptive name for easy identifying when editing macros
- `Send to Mud` send the value to the mud
- `Append to Command` append value to the end of the command input
- `Daisy Chain` this will append the value to the command line if it ends with a space then send the command line to the mud, if no space it will be handled as a standard macro and send the value.

## Triggers

- `Enable` enable/disable selected trigger
- `Pattern` the pattern to match against
- `Style` how the value is processed
  - `Text` send value as is
  - `Parse` do standard parsing, allows %0 ... %n to access arguments regex matches, [may use alterative ${}/%{} block syntax](functions.md)
  - `Script` the value is javascript, it will evaluate and any thing returned will be sent to the mud, the value is wrapped as a function and any matched patterns are passed as arguments, use standard arguments[#] to access.
- `Value` the value to send to the mud
- `Test` Allows you to test your pattern against a string and return results and any arguments found
  - `Text` the text to test pattern against.
  - `Results` the results of the test, either no match or a list of arguments found.
- `Type` the type of trigger
  - `Regular Expression` use javascript regular expressions when matching the pattern against text.
  - `Command Input Regular Expression` same as Regular Expression but only triggered against text sent from the command input.
  - `Event` fired when pattern matches an event name, either a custom name or built in:
    - `opened` fired when client has finished opening
    - `closed` fired when client is closing
    - `connected` fired when client has been connected
    - `disconnected` fired when client has bene disconnected
    - `error` fired when an error happens, first first argument is error message
    - `focus` fired when window focused
    - `blur` fired when window loses focus
    - `notify-clicked` fired when notification is clicked, argument 1 is title, argument 2 is message
    - `notify-closed` fired when notification is closed, argument 1 is title, argument 2 is message
  - `Alarm` create repeating tick timers
    ```
    When using alarm type pattern is in the format of hours:minutes:seconds, where hours and minutes are optional. A asterisk (*) is a wildcard to match any value for that place, if minutes or hours are missing a * is assumed. If pattern is preceded with a minus (-) the connection time is used instead of current time.

    You can also define a temporary, one time alarm if pattern is preceded with a plus (+), the trigger alarm is executed then deleted.

    Hours are defined in 24 hour format of 0 to 23, minutes and seconds are 0 to 59.
    If seconds are > 59 and the only pattern it will be considered the same as adding a wildcard (*) in front of the number.

    Hours, minutes, and seconds can use a special wildcard format of *value which will match when the time MOD is zero, eg: *10 matches 10, 20, ...
    ```
- `Name` a unique name to identify the trigger, if more then one trigger exist with the name, the one with the highest priority is used first
- `Priority` the sort order of triggers
- `Verbatim` the text is compared exactly how it is, including case
- `Temporary` the trigger will be deleted on first execution
- `Case sensitive` causes trigger to make sure letter cases are matched, eg A equal A and not a, off A equal a or A
- `Trigger on Newline` this causes the trigger to execute if it is a full line of text
- `Trigger on Prompt` this causes the trigger to execute if prompt/partial line of text.

## Buttons

- `Preview` - a preview of how the button will look
- `Enable` enable/disable button
- `Caption` The button caption to display for tooltip
- `Icon` A path to an icon to display, may pick from build in icons or from a file - [Predefined variables for paths](faq.md#what-predefined-variables-can-be-use-for-paths)
- `Style` how the value is processed
  - `Text` send value as is
  - `Parse` do standard parsing
  - `Script` the value is javascript, it will evaluate and any thing returned will be sent to the mud. the value is wrapped as a function and any matched patterns are passed as arguments, use standard arguments[#] to access.
- `Value` the value to send to the mud
- `Name` allows accessing the button from javascript using $(#name)
- `Send to Mud` send the value to the mud
- `Append to Command` append value to the end of the command input
- `Daisy Chain` this will append the value to the command line if it ends with a space then send the command line to the mud, if no space it will be handled as a standard macro and send the value.
- `Stretch icon` this will cause the icon to be stretched and fill all space on a button

## Context

- `Preview` - a preview of how the icon will look
- `Enable` enable/disable context item
- `Caption` The context menu caption to display for tooltip
- `Icon` A path to an icon to display, may pick from build in icons or from a file - [Predefined variables for paths](faq.md#what-predefined-variables-can-be-use-for-paths)
- `Style` how the value is processed
  - `Text` send value as is
  - `Parse` do standard parsing
  - `Script` the value is javascript, it will evaluate and any thing returned will be sent to the mud. the value is wrapped as a function and any matched patterns are passed as arguments, use standard arguments[#] to access.
- `Value` the value to send to the mud
- `Name` labels the menu to allow assigning of submenu items
- `Parent` set the parent menu item, either Name or global menu item index, **Note: When set value can not be executed**
- `Send to Mud` send the value to the mud
- `Append to Command` append value to the end of the command input
- `Daisy Chain` this will append the value to the command line if it ends with a space then send the command line to the mud, if no space it will be handled as a standard macro and send the value.