# Profile manager

- `Refresh` reload all profiles
- `Add` add new item based on current selected item or choosen from list
- `Undo` undo last change
- `Redo` redo previous change
- `Cut` cut selected item
- `Copy` copy selected item
- `Paste` paste copy/cut items into current active profile
- `Delete` delete selected item

## Profiles
- `Enable Triggers` enable/disable triggers from being executed as text is received or sent to the mud for the selected profile
- `Enable Aliases` enable/disable aliases from being executed before text is sent to the mud. for the selected profile
- `Enable Macros` enable/disable keyboard macros when keys are key combinations are pressed for the selected profile
- `Enable Buttons` enable/disable buttons
- `Priority` The profile's priority, this allows you to control the order in which profiles are sorted when executing alaises, triggers and macros in case of duplate names
- `Import defaults` Import and append any default items
- `Reset profile` Reset profile into an empty profile with default settings

## Aliases

- `Enable` enable/disable selected alias
- `Name` the name of the alias, this is used to execute an alias
- `Style` how the value is processed
  - `Text` send value as is
  - `Parse` do standard parsing, allows %0 ... %n to access arguments, or %name
  - `Script` the value is javascript, it will evaluate and any thing returned will be sent to the mud. the value is wrapped as a function and any matched patterns are passed as arguments, use standard arguments[#] to access.
- `Value` the value to send to the mud
- `Params` this allows you to name arguments in a comma delimited list, each word in the list is the same as the %#
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
- `Name` a simple descriptive name for easy iding when editing macros
- `Send to Mud` send the value to the mud
- `Append to Command` append value to the end of the command input
- `Daisy Chain` this will append the value to the command line if it ends with a space then send the command line to the mud, if no space it will be handled as a standard macro and send the value.

## Triggers

- `Enable` enable/disable selected trigger
- `Pattern` the pattern to match against
- `Style` how the value is processed
  - `Text` send value as is
  - `Parse` do standard parsing, allows %0 ... %n to access arguments regex matches
  - `Script` the value is javascript, it will evaluate and any thing returned will be sent to the mud, the value is wrapped as a function and any matched patterns are passed as arguments, use standard arguments[#] to access.
- `Value` the value to send to the mud
- `Test` Allows you to test your pattern agaist a string and return results and any arguments found
  - `Text` the text to test pattern agaist.
  - `Results` the results of the test, either no match or a list of arguments found.
- `Type` the type of trigger
  - `Regular Expression` use javascript regular expressions when matching the pattern agaist text.
  - `Command Input Regular Expression` same as Regular Expression but only triggered agaist text sent from teh command input.
- `Priority` the sort order of triggers
- `Verbatim` the text is combared exactly how it is, including case
- `Trigger on Newline` this causes the trigger to execute if it is a full line of text
- `Trigger on Prompt` this causes the trigger to execute if prompt/partial line of text.

## Buttons
- `Preivew` - a preview of how the button will look
- `Enable` enable/disable button
- `Caption` The button caption to display for tooltip
- `Icon` A path to an icon to display, may pick from build in icons or from a file - [Predefined variables for paths](faq.md@variables)
- `Style` how the value is processed
  - `Text` send value as is
  - `Parse` do standard parsing
  - `Script` the value is javascript, it will evaluate and any thing returned will be sent to the mud. the value is wrapped as a function and any matched patterns are passed as arguments, use standard arguments[#] to access.
- `Value` the value to send to the mud
- `Name` allows accessing the button from javascript using $(#name)
- `Send to Mud` send the value to the mud
- `Append to Command` append value to the end of the command input
- `Daisy Chain` this will append the value to the command line if it ends with a space then send the command line to the mud, if no space it will be handled as a standard macro and send the value.
- `Stretch icon` this will cause the icon to be streched and fill all space on a button