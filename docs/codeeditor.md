# Code editor

The code editor allows immortals or those wanting to code lpc files using a graphical editor

See [Area designer](codeeditor.designer.md) for area designer docs

## Sessions

The session system allows you to save current opened tabs as a session file to allow restoring them at a later time.
You may open a session and merge it with current opened files or you may attempt to replace the current session with another. If the current session has open files it will attempt to save them, if you cancel them it will prevent them from closing as normal and they will be merged with the new session

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
  - `Advanced` optional advanced features
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
- `New area design` allows you to create a new area design that can be later used to create all the required code for an area
  - `Width` the width of the new area, min 2, max 100, can be resized later
  - `Height` the height of the new area, min 2, max 100, can be resized later
  - `Depth` the height of the new area, min 1, max 100, can be resized later
  
### New room

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
  - `Forage` the amount of food returned each forage, -1 default to random amount of Max forage
  - `Max forage` the max amount player can forage per reset
  - `Secret exit` provide a hint that there is a secret exit in this room
  - `Temperature` set the room Temperature, every 100 or -100 triggers damage done by heat or cold
- `Combat properties` properties related to combat
  - `No attack` disable all combat in the room
  - `Council` allow players to kill each other using council rooms, good for arenas
  - `Melee as ability` all basic melee combat will be considered an ability for protection calculation
  - `Enable pk` allow players to kill each other
  - `No dirt` can not throw dirt
  - `Dirt type` custom dirt type, if empty it will be based on terrain and weather
- `Custom properties` custom properties you may want to set for a room, **Advanced**
- `Items` the items you can look at in the room, there should be one for each noun from the description
  - `Item` the item name
  - `Description` the item description, you should also add any looks for nouns in descriptions of other items
- `Reads` things can be read in the room, **Note** they must be included as an item to be readable, **Advanced**
  - `Read` the id to match
  - `Description` the description to display to the user
  - `Language` the language the description is in
- `Exits` Exits from the room, can be standard, doors, or climbs, **Note** climbs are only supported with standard, base (see area if supported), and climb types.
  - `Exit` the exit name, a list predefined list of standard exits is provided to pick from or you can enter a custom one
  - `Door` is this exit a door
  - `Key ID` a unique key id to use to lock or unlock if the exit is a door
  - `Hidden` is the exit hidden
  - `Blocker` a comma delimited list of monster ids that block the exit
  - `Prevent peer` a message, true/false or a function to prevent peering this exit
  - `Destination door` optional destination door id, defaults to door if empty
  - `Locked` does the door lock or unlock every reset
  - `Closed` is the door closed or open every reset
  - `Climb` is this exit a climbs, **Note** climbs are only supported with standard, base (see area if supported), and climb types.
  - `Climbing difficulty` how hard the climb is if this exit is a climb
- `Smells` the smells for the room
  - `Smell` the smell, use `default` to have the smell set as default room smell
  - `Description` the smell description
- `Sounds` the sounds for the room
  - `Sound` the sound, use `default` to have the smell set as default room smell
  - `Description` the sound description
- `Searches` the searches for the room, **Advanced**
  - `Search` the search/searches, you can supply a comma delimited list to assign all searches the same description
  - `Message` the message to display or a function to execute
- `Finish` A final summary of selected options and properties, some properties and options will always be set even if empty: terrain, short, long, exits, items, **Note** climbs are only supported with standard, base (see area if supported), and climb types and will prevent you from finishing until you pick a supported type or remove climbs.

### New monster

Create a new monster using a wizard for easy option selection

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
  - `Body type` allows you to pick a body type to set the initial limbs for monster, if not set will be determined based on race
- `Resistances` Monster damage resistances, **Advanced**
  - `Type` The type of resistance to protect against
  - `Amount` The amount to protect, should be in a -100 to 100 range
- `Ask` Control if monster can be asked about questions, **Advanced**
  - `Can be asked questions` Enable ask system
  - `Ask no topic reply` Message to display when topic is not found
  - `Ask response type` How a monster will responses when asked a question
    - `Say` reply using the say command
    - `Tell` send a tell to asking player
    - `Speak` reply using speak command
    - `Whisper` reply using whisper command
    - `Custom` use a custom system to control, will require advanced coding after code created
- `Ask Topics` The topics that the monster can be questioned about, **Advanced**
  - `Topic` The topic to ask about
  - `Message` The message to display
- `Advanced properties` Advanced options that while useful are not always needed, **Advanced**
  - `No corpse` will the monster leave a corpse, string will be displayed to player and no corpse left, if "" no message and no corpse, $N/$n replaced with monster's name
  - `No limbs` will the limbs be dropped on the ground, if "" no limbs and no message, else message displayed to player, $L/$l will be replaced with limb name, $N/$n replaced with monster's name
- `Custom properties` custom properties you may want to set for a monster, **Advanced**
  - `Type` The type of property
    - `Temporary` lost when monster is saved using auto save system
    - `Normal` will be saved if monster is autosaved
  - `Name` The name of the property
  - `Value` The value of the property
- `Reputation` The monsters reputation, **Advanced**
  - `Default group` The default reputation
  - `Type` The type of reputation
    - `Attack` Applied if attacked
    - `Die` Applied when dies
  - `Group` The reputation group that is effected
  - `Amount` The amount of reputation to apply
- `Movement` determine if the monster will wander randomly or a set list of direction, **Advanced**
  - `Speed` he speed the monster moves in heartbeats, must be set to enable movement
  - `Patrol route` a set list of exits the monster will attempt to follow
  - `No walk rooms` a list of room file names that the monster can no enter, allows containment of monster to a general area, **Note** filenames should always include the trailing `.c`
- `Emotes and speaks` random emote or speak when players are in the room, **Advanced**
  - `Emote chance` the chance a normal emote will display
  - `Emote combat` the chance a combat emote will display during combat
  - `Speak chance` the chance a monster will speak
  - `Speak combat` the chance a monster will speak during combat
  - `Emotes and Speaks`
    - `Type` the type of emote or Speak
      - `emote` a normal emote
      - `emote combat` an emote during combat
      - `Speak` a normal speak
      - `Speak combat` speak during combat
    - `message` the emote to display or Speak to say
    - `language` the language to speak in, **Note** for Speak or Speak combat only
- `Combat` combat related options
  - `Attack commands` a list of comma delimited abilities or commands the monster will randomly do during combat
  - `Attack command chance` the chance a command will be used, from 0 to 101, 0 never, 100/101 always
  - `Attack initiators` list of comma delimited commands or abilities to randomly picked from when the monster starts combat
- `Tracking` Monster tracking system, **Advanced**
  - `Enable attacker tracking` Will cause monster to track those that it is attacking
  - `Track aggressively only` Constantly follower attacker
  - `Enter message` Message to display when monster enters a room by tracking someone
  - `Enter message action` How the enter messages is displayed
- `Aggressive` monsters aggressiveness, can be a simple number or a complex mapping of values to determine how different races, classes and others options effects auto attacking, see /doc/build/monster/haggle on mud for full list and details
- `Actions` actions or reactions to different things, **Advanced**
  - `Auto drop` drop items after a delay of seconds
  - `Open storage` open storage items that have been given and how long to wait
  - `Auto wield` wield any weapon given or looted after a delay of seconds
  - `Auto loot` loot the room of items after a delay of seconds
  - `Auto wear` wear any armor given or looted after a delay of seconds
  - `Wimpy` wimpy after percent of damage is reached
  - `Drop encumbered` drop extra inventory when 50% or higher encumbered
  - `Drop encumbered combat` drop extra inventory when 50% or higher encumbered if in combat
  - `Auto stand` stand backup when lying on the ground during combat
- `Reactions` Determine how your monster reactions to different effects, **Advanced**
  - `Type` The type of reaction, see /doc/build/monster/reactions
    - `Normal` a normal reaction that happens out side of combat
    - `Party` a normal reaction that happens outside of combat but only effects party members
    - `Combat` a reaction during combat
    - `Combat party` a reaction during combat that effects party members
  - `Reaction` the reaction that causes monsters to react
    - `low health` fired when < 10% hp
    - `half health` fired when < 50% hp
    - `hurt` fired when hp < max hp
    - `full health` fired when 100% hp
    - `poisoned` fired when poisoned
    - `bleeding` fired when bleeding
    - `severed limb` fired if has severed limbs
    - `magic protection` fired if no magical protection (buffer/skins)
    - `faith protection` fired if no faith protection (fortify)
    - `cursed` fired if cursed
    - `held` fired being held but something
    - `cloaked` fired if cloaked
    - `no cloak` fired if not cloaked
    - `0 minions` fired if no minions
    - `1 minions` fired if 1 minion
    - `2 minions` fired if 2 minions
    - `3 minions` fired if 3 minions
    - `4 minions` fired if 4 minions
    - `encumbered 90` fired if encumbered 90% or higher
    - `encumbered 50` fired if encumbered 50% or higher
    - `encumbered 10` fired if encumbered 10% or higher
    - `present` a special reaction to reaction to objects in the room format of command is an array ({"id", "command to fire"})
    - `not present` opposite of present
    - `enhance` a special reaction that will fire if the command enhancement system is used and able to use it, format of command:
      - ({"command", "command 2", ... }) or
      - ({ ({"command", "syntax to fire"}), ({"command 2", "syntax to fire"}), ... })
      - ({ ({"command", "syntax to fire", target}), ({"command 2", "syntax to fire", target}), ... })
      - target can be an object or a string, if string will look for an object with matching id in room of monster
    - `enhance self` a special reaction that will fire if the command enhancement system is used and able to use it and target yourself, format of command:
      - ({"command", "command 2", ... }) or
      - ({ ({"command", "syntax to fire"}), ({"command 2", "syntax to fire"}), ... })
    - `temp property` special reaction that will fire a property matches a value, it requires a more advanced command format:
      - format of command is an array
      - ({"property name", value to match, "command to fire"}) or
      - ({"property name", value to match, function test, "command to fire"})
    - `temp properties` special reaction that will fire a property matches a value, it requires a more advanced command format
      - format of command is an array of arrays from temp property
      - ({ ({"property name", value to match, "command to fire"}), ... })
  - `Action` the action to do, see docs for full formatting for more advanced reactions
- `Finish` A final summary of selected options and properties, some properties and options will always be set even if empty: name, level, race, short, long

#### Monster type properties

##### Vendor properties

Visible when monster type is a vendor

- `Vendor type` the type of vendor
- `Use default storage` Weather to use global default storage room
- `Do not clean storage` Do not clean storage on room reset
- `Storage room` The path to the room that contains objects the vendor sells
- `List item(s)` A comma delimited list of items that a user can read to see vendor syntaxes
- `List type` Used to build dynamic sign text
- `Append display list long to room` Will append the list long to the rooms description
- `List item long` The long description of the item when it appears in the room

##### Vendor advanced properties, **Advanced**

More advanced vendor properties, most of these should be left alone unless you know what they do

- `Max number of each item` The max number of items to keep in storage, all over this amount will be removed
- `Permanent Percent` The percent to adjust permanent inventory as more are sold
- `Permanent offset` The number of items to sell at base value
- `Currency type` The type of currency the vendor takes, only used if  `Only except currency type` enabled
- `Only except currency type` Only allow currency type when items are bought/sold
- `Translate` Translate all items to the vendor's primary language
- `Translate list` Translate the displayed sign
- `Translate commands` Translate the command words
- `Enable price tracking` Enable price tracking to offer supply and demand adjustments
- `Price tracking weight` How much to weight tracked items
- `Price tracking max` The max amount to weight tracked items

##### Barkeep menu

The menu a barkeep sells

- `Short` The item's short name, normal the name with a/an prepended
- `Name` The item's name
- `Strength` How strong the item is when a person drinks/eats it
- `Type` The type of item
  - `alcoholic` Item is alcoholic drink
  - `caffeine` Item is caffeine
  - `drink` Item is a generic drink that does not get drinker drunk
  - `food` Item is food
- `Long` The long description of item when looked at
- `Nouns` The item nouns that are used to build the item's id, should aim no more then 2 or 3
- `Adjectives` The item's adjectives used to build item's id, should be no more then 2 or 3
- `Category` The item's category when displayed on menu, drinks should all be in the drink category
- `My Message` The message displays to the person who eats/drinks item
- `Your Message` The message displayed to the room when person eats/drinks tiem

##### Barkeep properties, **Advanced**

- `Menu title` The menus title
- `Read item(s)` The items used to display menu when read/looked
- `No money message` The message displayed when buyer does not have enough money
- `Pre menu text` The text before the menu
- `Post menu test` The text after the menu
- `Can refill` Can the barkeep refill drink containers
- `Can buy empty` Can barkeep buy empty bottles

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
- Basic spell checking, **See known issues**
  - Can add words to custom editor dictionary or OS dictionary if supported
  - Can ignore words until next time editor is opened

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
- Resize map allowing you to anchor top or bottom / left or right / up or down to determine how the rooms will be shifted when resized **Warning** when resized smaller, old rooms are lost and any dangling exits are removed
- Show colors, create a color scale map based on terrain indexes
- Show terrains, show terrain numbers for each room
- Allow walk exits, allows you to create exits by walking the map using num pad
- Allow walk resize, allows you to resize the map by walking off the edge of the map

### Room editor

The room editor allows you to edit the currently selected rooms, if rooms have different property values, that property will remain blank until edited.
Pressing escape inside any active property editor will cancel the editor and not modify the value, pressing enter or clicking outside of the editor will confirm the change and update the value.

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

Allows you to edit, add or delete terrain descriptions.
Pressing escape inside any active property editor will cancel the editor and not modify the value, pressing enter or clicking outside of the editor will confirm the change and update the value.

- `Index` read-only index of the description, used to tie terrains to rooms, unused descriptions will have red indexes
- `Short` The rooms short description which is a single line of text
- `Light` The amount of light for a room
- `Terrain` The terrain for the room, 0 or empty value is considered no terrain set
- `Long` The long detailed room description
- `Sound` The default sound for the room
- `Smell` The default smell for the room

**Notes** When cutting or deleting the associated items from the item database are removed as well, When copying, associated items will be copied along with terrain, when pasting associated items will be pasted but will ask if you want to replace any existing ones

### Item editor

Allows editing of all items in one location.
Pressing escape inside any active property editor will cancel the editor and not modify the value, pressing enter or clicking outside of the editor will confirm the change and update the value.

- `Index` The item index, most of the time this matches to the terrain index
- `Item` The item name
- `Description` The item description

### External exit editor

Allows you to edit all external exits in one location
Pressing escape inside any active property editor will cancel the editor and not modify the value, pressing enter or clicking outside of the editor will confirm the change and update the value.

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
- `Hide open files on recent menu` Do not display the open files on the open recent menu
- `Remember opened files on reload` remember opened files when editor was last closed and reopen them
- `Use native icons in tabs` use the native icon associated with file type set in OS
- `Enable spellchecking when possible` detect spelling errors when possible **Requires restart**
- `Enable remote caching` cache remote file names linked to local files in {data}/editor/ folder, each local file will have a file linked to it to store remote data associated with local file
- `Enable view state` cache file view states to remember folding and other states to restore
- `Enable debug` enable debugging output to the dev tool console

### Editor

- `Enable auto closing brackets` Whether or not to close brackets when open one entered
- `Enable auto indentation adjustment` Indent next line based on previous line
- `Enable empty selection copying` Copy current line when nothing is selected
- `Enable folding` enable or disable code folding
- `Enable detecting links` enable detection
- `Enable highlighting of matching brackets` highlight the matching end bracket
- `Enable bracket colorization` enable or disable matching bracket colorization
- `Select line when line number clicked` select line when line number clicked
- `Trim whitespace` trim whitespace
- `Scroll beyond last line` allows you to scroll up to one screen past last line
- `Line numbers` display line numbers
- `Show Folding Controls` how to show folding controls
- `Tab size` how many spaces equal a tab
- `Theme` set the main editor as dark or light theme

### Editor Font

- `Font` the editor font
- `Font weight` the editor font weight
- `Font size` the editor font size

### Virtual Area Editor

- `Move to next editor or next row when editing data grid` when editing a data grid, move to next editor on enter
- `Move back to first on enter in last row when editing data grid` when editing a data grid, move to first row if on last on enter
- `Add new row on enter if last row when editing data grid` Add new row on enter if last row
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

### Designer

- `Move to next editor or next row when editing data grid` when editing a data grid, move to next editor on enter
- `Move back to first on enter in last row when editing data grid` when editing a data grid, move to first row if on last on enter
- `Add new row on enter if last row when editing data grid` Add new row on enter if last row
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
- `Insert spaces` prefer spaces over tabs
- `Enable Background Throttling` disable or enable throttling when a window is in the background or hidden

## Known issues

- `Slow performance` Make sure you are not using --disable-gpu, with out the gpu it can cause slow performance from maps taking 10 to 100 times longer to load
- Missing context menus, will be addressed in future releases
- You can not edit remote virtual maps in virtual map editor, as most virtual maps require multiple files and at the moment it is impossible to know all the remote files
- Pasting virtual area rooms into other maps does not copy descriptions or items
- Spell checking is disabled for lines longer then 1000 characters
- Spell checking is limited to only displaying 100 misspelled words
