# Code editor

The code editor allows immortals or those wanting to code lpc files using a graphical editor

## Code editor features

- Syntax highlighting
- Code folding
- Templates to quickly create basic objects, rooms, monsters, weapons and armors
- Formatting and indention system for making code easier and more standard
- Side by side file views for up to 3 files, just drag and drop to layout how how you want to view files, with restore state on reopen if `Remember open files on reload` turned on

## Virtual map editor

Allows you to edit a virtual map easily with out having to know all file formats

- Edit room exits for all basic directions plus up and down
- Set states for each room
- Set terrain and edit terrain for room and changes effect all rooms that have same indexes
- Open/create external room files by double clicking a room or open from room editor
- Edit external exits for any room
- Edit list of room items for room with changes effecting all rooms with matching index
- Room preview to show how the room will possibly look to a player, with underline marking for matching items, includes preview of external rooms
- View all terrain descriptions in a list editor to easily remove, add or copy terrains
- View all items in a list editor easily remove, add, or copy items
- View all external exits in a list editor to easily remove, add, or copy external exits
- View all raw data files that exist and are related to the current map.

### Room editor

The room editor allows you to editor the currently selected room

- `Description` the properties of a room related to description
  - `Short` the room short
  - `Long` the room long description
  - `Items` the items that can be looked at in a room
  - `Terrain` the terrain type for a room, can be anything or pick from a preselected dropdown
  - `Light` how much light the room has
  - `Smell` the default smell for the room
  - `Sound` the default sound for the room
- `Location` The coordinates of the room as read only values, will display z value if multi level map
- `Misc` miscellaneous properties of selected room
  - `Terrain Index` the terrain index to use from the database, when you edit Description properties it uses this to determine where to save the data, if item index matches terrain index, it will be changed to match when terrain index is changed
  - `Item Index` the index of the items for the room from the item database, most of the time it should be the same as Terrain index
  - `State` different states the room can apply
  - `Exits` the exits the rooms has
  - `Climbs` a read only options that displays if an external room has climbs
  - `External Exits` exits that link to outside areas
  - `External File` the name of the file if it is an external room with option to open it

## External exit editor

Allows you to edit all external exits in one location

- `Enabled` is exit enabled
- `X`, `Y`, `Z` the coordinates of the room the exit will be added to, Z is only shown/required if using multi level area
- `Exit` the exit used, can be anything or you can pick from a presuggested list
- `Destination` the full remote path to destination file, include the .c

## Raw data editors

These all you to directly edit any raw files linked to the map, see /doc/build/virtual/generic_virtual on mud for formatting details for each file

- `Map` the raw map file
- `Terrain` the raw terrain map, this is to assign indexes too rooms, this is an optional file as terrain indexes can be stored in map raw as well, if not available terrain indexes are stored in main map data
- `Descriptions` this is the raw descriptions file containing a list of all the room data
- `Items` the items database
- `State` state data map, optional, if not available states are stored in main map data
- `Exits` the external exits list

## Preferences

Editor preferences are stored in their own file independent of client or character settings and saved to `{data}/editor.json`, this allows the editor to not be required to reload every time settings are changed for each character and reduce load times

### General

- `Max recent items` max number of items to store in recent list
- `Remember open files on reload` remember open files when editor reopened
- `Use native icons in tabs` use the native icon associated with file type set in OS
- `Enable spellchecking when possible` detect spelling errors when possible

### Editor

- `Enable auto closing brackets` Whether or not to close brackets when open one entered
- `Enable auto indentation adjustment` Indent next line based on previous line
- `Enable empty selection copying` Copy current line when nothing is selected
- `Enable folding` enable or disable code folding
- `Enable detecting links` enable detection
- `Enable highlighting of matching brackets` highlight the matching end bracket
- `Select line when line number clicked` select line when line number clicked
- `Trim whitespace` trim whitespace
- `Scroll beyond last line` allows you to scroll up to one screen past last line
- `Line numbers` display line numbers
- `Show Folding Controls` how to show folding controls
- `Tab size` how many spaces equal a tab

### Editor Font

- `Font` the editor font
- `Font weight` the editor font weight
- `Font size` the editor font size

### Virtual Area Editor

- `Raw Font` font used for raw editors
- `Raw Font weight` font weight for raw editors
- `Raw Font size` font size for raw editors
- `Enable or disable spellcheck on raw text editors` Enable or disable spellchecking on raw editors **Note:** When enabled it could cause performance issues due to the large amount of text
- `Preview Font` font for room preview
- `Preview Font size` font size for room preview

### Window

- `Always on top of parent` causes window to remain on top of main client, **Requires restart on windows**, **Note:** if set enabled, main window will warn if open to prevent lose of data, if off code editor will remain open independent of main window closing
- `Always on top of all` causes window to be on top of all windows
- `Persistent` will attempt to reload tools when client is loaded

### Advanced

- `Cursor style` how to display the cursor
- `Cursor animation style` how to animate the cursor
- `Accept suggestions on ENTER` accept suggested text when hitting enter
- `Seed find with selected text` fill in find input with selected text
- `Enable quick suggestions` enable quick suggestions
- `Enable rendering of control characters` render control characters in editor
- `Render the editor selection with rounded borders` add rounded corners to selection box
- `Render whitespace` how to render whitespace
- `Enable snippet suggestions` enable snippets
- `Inserting and deleting whitespace follows tab stops` use tab stops
- `Enable the rendering of the minimap` show minimap
- `Limit the width of the minimap` how many columns to display in minimap
- `Show Minimap Slider` when to display minimap slider
- `Render the actual text on a line in minimap` show text or blocks in minimap
- `Minimap location` where minimap is placed in editor
- `Insert spaces`

## Known issues

- `Slow performance` Make sure you are not using --disable-gpu, with out the gpu it can cause slow perfmance from maps taking 10 to 100 times longer to load
- Missing context menus, will be addressed in future releases