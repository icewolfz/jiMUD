# Code editor

The code editor allows immortals or those wanting to code lpc files using a graphical editor

## Basic Features

- `New area` allows creation of a new area with standard folder layout and all standard files with basic info and set dates/creator name if possible
  - `Save path` the local path where all files will be created
  - `Remote path` optional remote path to be used in code to set default path defines
  - `Name` the area name, will be created as  folder under save path with all standard folders and files for an area
- `New virtual area` allows creation of a new virtual area for a current area or create an entire area using the optional area create setting
  - `General` Basic required options for a virtual area
    - `Save path` the local path where all files will be created
    - `Remote path` optional remote path to be used in code to set default path defines
    - `Area` create an entire area with this name, if not enabled will create just a virtual server under save path
    - `Width` the width of the virtual area, min 2, max 100
    - `Height` the height of the virtual area, min 2, max 100
    - `Depth` the height of the virtual area, min 1, max 100
  - `Advanced` optional advanced featuers
    - `Coordinates` Enable coordinate system and assign x,y,z coords to each room
    - `Room cache` the # of rooms the area caches before it starts removing old rooms, default: 200
    - `Default exits` the default exits each room will start with, note edge rooms will have all exits leading out of the area stripped out, **Note** up and down are disabled if depth is only 1
    - `Default states` the default states for each room
      - `No attack` do not allow combat
      - `No magic` do not allow magic
      - `Council` council flag enabled, allows player killing
      - `Outdoors` rooms are all outdoor
      - `Indoors` rooms are indoor
      - `Water` rooms are under water
      - `Hot` room temperature is set to 200
      - `Cold` room temperature is set to -200
      - `Sinking Down` rooms will sink down to room below if possible, only works if base room inherits SINK_ROOM, or has custom set_down(room below path), **Note** disabled if depth is only 1
      - `Sinking Up` rooms will float up to the room above if possible, only works if base room inherits SINK_ROOM, or has custom set_up(room above path), **Note** disabled if depth is only 1
      - `None` turn off all states
- `New room`
  - `General properties` general room properties
    - `Type` the room type
    - `Terrain` the room's terrain
    - `Short` the short description
    - `Light` the amount of light in the room
    - `Night light adjustment` the amount to adjust light when nigh
    - `Prevent peer all direction` a message, true/false or a function to prevent peering any exit
  - `Description` The long description, with link to open advanced editor to allow editing in editor for easy colorizing
  - `Properties` Miscellaneous properties
    - `Indoors` is the room indoors
    - `No magic` disable all magic in the room
    - `No scry` prevent scrying people while in room
    - `No teleport` prevent teleport in and out
    - `Explored marker` set an explored marker when player enters room
    - `No map send` do not send map data to client
    - `Hide exits` hide the exit line from the player
    - `No forage` can not forage for food
    - `Forage` the max amount a player gets each time they forage
    - `Max forage` the max amount player can forage per reset
    - `Secret exit` provide a hint that there is a secret exit in this room
  - `Combat properties` properties related to combat
    - `No attack` disable all combat in the room
    - `Council` allow players to kill each other using council rooms, good for arenas
    - `Melee as ability` all basic melee combat will be considered an ability for protection calculation
    - `Enable pk` allow players to kill each other
    - `No dirt` can not throw dirt
    - `Dirt type` custom dirt type, if empty it will be based on terrain and weather    
  - `Items` the items you can look at in the room, there should be one for each noun from the description
    - `Item` the item name
    - `Description` the item description, you should also add any looks for nouns in descripitions of other items
  - `Exits` Exits from the room, can be standard, doors, or climbs, **Note** climbs are only supported with standard, base (see area if supported), and climb types.
    - `Exit` the exit name, a list predefined list of standard exits is provided to pick from or you can enter a custom one
    - `Door` is this exit a door
    - `Key ID` a unquie key id to use to lock or unlock if the exit is a door
    - `Hidden` is the exit hidden
    - `Blocker` a comma delimited list of monster ids that block the exit
    - `Prevent peer` a message, true/false or a function to prevent peering this exit
    - `Destination door` optional destination door id, defaults to door if empty
    - `Locked` does the door lock every reset
    - `Climb` is this exit a climbs, **Note** climbs are only supported with standard, base (see area if supported), and climb types.
    - `Climbing difficulty` how hard the climb is if this exit is a climb
  - `Smells` the smells for the room
    - `Smell` the smell, use `default` to have the smell set as default room smell
    - `Description` the smell description
  - `Sounds` the sounds for the room
    - `Sound` the sound, use `default` to have the smell set as default room smell
    - `Description` the sound description
  - `Searches` the searches for the room
    - `Search` the search/searches, you can supply a comma delimited list to assign all searches the same description
    - `Message` the message to display or a function to execute
  - `Finish` A final summary of selected options and properties, some properties and options will always be set even if empty: terrain, short, long, exits, items, **Note** climbs are only supported with standard, base (see area if supported), and climb types and will prevent you from finishing until you pick a supported type or remove climbs.
- `New monster` create a new monster using a wizard for easy option selection
  - `General properties` general monster properties
    - `Type` the monster type
    - `Level` the level
    - `Alignment` The alignment, can pick from preselected list or use -1000 to 1000 raw number values, defaults to neutral if empty
    - `Race` pick from predefined list or supply a custom race, defaults to human if empty
    - `Class` pick from predefined list of classes and subclasses or supply your own
    - `Language` pick primary language from predefined list, custom language or leave blank to determine based on race
    - `Ridable` is monster ridable
    - `Flying` can the monster fly
    - `Getable` can the monster be picked up
    - `Undead` is the monster undead, **Note** some monster races are automatically undead and setting this will not matter
    - `Water breathing` can monster breathe under water
    - `Requires water` requires water to live, if out of water it will suffocate
    - `No bleeding` monster will not bleed
  - `Description` Basic description properties
    - `Name` the monster's name
    - `Short` the monster's short, normal proper cased name or name prefixed with a/a/the
    - `Nouns` a list of comma delimited nouns used to build an id list
    - `Adjectives` a list of comma delimited adjectives use to build an id list with nouns
  - `Long description` The long description, with link to open advanced editor to allow editing in editor for easy colorizing
  - `Physical properties` properties related to physical attributes
    - `Mass` the monsters mass, 0 will default to internal formula based on several factors
    - `Height` the height of the monster in inches from 1 to infinity
    - `Eye color` monster's eye color, pick from predefined list or supply any color you wish
    - `Hair color` monster's hair color, pick from predefined list or supply any color you wish
    - `Gender` the monster's gender, male, female, or none
    - `Body type` allows you to pick a body type to set the inital limbs for monster, if not set will be determined based on race
  - `Advanced properties` Advanced options that while usefule are not always needed
    - `No corpse` will the monster leave a corpse, string will be displayed to player and no corpse left, if "" no message and no corpse, $N/$n replaced with monster's name
    - `No limbs` will the limbs be dropped on the groud, if "" no limbs and no message, else message displayed to player, $L/$l will be replaced with limb name, $N/$n replaced with monster's name
  - `Movement` determine if the monste will wander randomly or a set list of direction
    - `Speed` he speed the monster moves in heartbeats, must be set to enable movement
    - `Patrol route` a set list of exits the monster will attempt to follow
    - `No walk rooms` a list of room file names that the monster can no enter, allows containment of monster to a general area, **Note** filenames should always include the trailing `.c`
  - `Combat` combat related options
    - `Attack commands` a list of comma delimited abilities or commands the monster will randomly do during combat
    - `Attack command chance` the chance a command will be used, from 0 to 101, 0 never, 100/101 always
    - `Attack initiators` list of comma delimited commands or abilities to randomly picked from when the monster starts combat
  - `Aggressive` monsters aggressiveness, can be a simple number or a complex mapping of values to determine how different races, classes and others options effects auto attacking, see /doc/build/monster/haggle on mud for full list and details
  - `Actions` actions or reactions to different things
    - `Auto drop` drop items after a delay of seconds
    - `Open storage` open storage items that have been given and how long to wait
    - `Auto wield` wield any weapon given or looted after a delay of seconds
    - `Auto loot` loot the room of items after a delay of seconds
    - `Auto wear` wear any armor given or looted after a delay of seconds
    - `Wimpy` wimpy after percent of damage is reached
    - `Drop encumbered` drop extra inventory when 50% or higher encumbered
    - `Drop encumbered combat` drop extra inventory when 50% or higher encumbered if in combat
    - `Auto stand` stand backup when lying on the ground during combat
  - `Finish` A final summary of selected options and properties, some properties and options will always be set even if empty: name, level, race, short, long

## Code editor features

- Syntax highlighting
- Code folding
- Templates to quickly create basic objects, rooms, monsters, weapons and armors
- Formatting and indention system for making code easier and more standard
- Side by side file views for up to 3 files, just drag and drop to layout how how you want to view files, with restore state on reopen if `Remember opened files on reload` turned on
- Diff file with original file if changed or local file
- Diff file with remote file, does not cache to allow you to test against any file as needed
- Remote testing, allows you to test a local file in its remote location, if no remote data it will allow you to browse to the remote file location
- Remote caching, will cache remote file data in %appdata%\jiMUD\editor to allow local files to be linked to remote files
- Clear remote data in code preference dialog or deleting the files in %appdata%\jiMUD\editor
- Remote editing, allows you to edit files directly on server using local temp files and using IED to download/upload on open/save.
- Upload/Upload as to directly upload file to mud using IED

**Note:** You must be connected to the mud and logged in as an immortal to use remote features

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

### Description editor

Allows you to edit, add or delete terrain descriptions

- `Index` read-only index of the description, used to tie terrains to rooms
- `Short` The rooms short description which is a single line of text
- `Light` The amount of light for a room
- `Terrain` The terrain for the room, 0 or empty value is considered no terrain set
- `Long` The long detailed room description
- `Sound` The default sound for the room
- `Smell` The default smell for the room

**Notes** When cutting or deleting the associated items from the item database are removed as well, When copying, associated items will be copied along with terrain, when pasting associated items will be pasted but will ask if you want to replace any existing ones

### Item editor

Allows editing of all items in one location.

- `Index` The item index, most of the time this matches to the terrain index
- `Item` The item name
- `Description` The item description

### External exit editor

Allows you to edit all external exits in one location

- `Enabled` is exit enabled
- `X`, `Y`, `Z` the coordinates of the room the exit will be added to, Z is only shown/required if using multi level area
- `Exit` the exit used, can be anything or you can pick from a pre suggested list
- `Destination` the full remote path to destination file, include the .c

### Raw data editors

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
- `Remember opened files on reload` remember opened files when editor was last closed and reopen them
- `Use native icons in tabs` use the native icon associated with file type set in OS
- `Enable spellchecking when possible` detect spelling errors when possible
- `Enable remote caching` cache remote file names linked to local files in {data}/editor/ folder, each local file will have a file linked to it to store remote data associated with local file
- `Enable debug` enable debugging output to the dev tool console

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
- `Room terrain index on delete` Select what to do when a room has a matching index to a deleted or cut description
  - `Leave` Leave it as is
  - `End` Set it to last description
  - `End + 1` Set it to last description + 1
  - `Start` Set to first description
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

- `Slow performance` Make sure you are not using --disable-gpu, with out the gpu it can cause slow performance from maps taking 10 to 100 times longer to load
- Missing context menus, will be addressed in future releases
- You can not edit remote virtual maps in virtual map editor, as most virtual maps require multiple files and at the moment it is impossible to know all the remote files