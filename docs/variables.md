# Variables

Variables allow users to store data as needed. 

To use a variable use @NAME, @NAME[KEY|INDEX], @{NAME} or @{NAME[KEY|INDEX]} formats
To assign a value use @{NAME=value}, @{NAME[KEY|INDEX]=value} or @NAME=value if at start of line

You may also edit variables in the profile manager by settings it value using raw formatting

## Formats:

- Auto type will attempt to test the value based on several rules and formats and convert the value into a usable variable or leave it as a basic string
- Integer will force convert value into a number, if not a value number will be set to 0
- String expanded and string literal are left as is and handled as gotten
- String List is a formatted string of values separated by a | that is treated as an array allowing you to use indexes as a key to access values, if you want a | in a value quote the string, eg "value with a |"|another
- Record is a key value formatted comma delimited key=value or key:value format, with optional [] or {} blocking if you want a comma or = in value encase in quotes
  - Examples:
    - "name":"icewolfz","class":"rogue","level":100
    - "name"="icewolfz","class"="rogue","level"=100
- Float is a floating point number
- Array is like a string list but is formatted using a comma delimited string with optional [] blocking, if you want a comma in value encase in quotes
  - Example: icewolfz,rogue
- JSON is a valid json formatting that will be converted to a real object
  - Example: {"name":"icewolfz", "class":"rogue", "level":100}

## Session variables

Session variables when set will be deleted when the client closes, you may create a session variable using the profile manager or [#TEMPVAR](createmodify-profile-or-items)
