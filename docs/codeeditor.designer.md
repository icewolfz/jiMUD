# Area designer

Allows you to design areas quickly and easily

- Layout room exits and properties
- Assign monsters and objects to rooms
- A basic room preview to give general idea what a room may look like to a player

## Designer room editor

The room editor allows you to edit the currently selected rooms, if rooms have different property values, that property will remain blank until edited.
Pressing escape inside any active property editor will cancel the editor and not modify the value, pressing enter or clicking outside of the editor will confirm the change and update the value.

### Advanced

Advanced options for when creating a room

- `Type` The room type, either an area base room or a standard room type
- `Background` a css background color to make the room stand out in the map, not used for anything else
- `Sub Area` An optional subarea name that will be used when creating code
- `Sounds` Sounds the player can listen to with the listen command
  - `Sound` the sound to listen to
  - `Description` the sound to display
- `Smells` smells for the room
  - `Smell` the smell
  - `Description` the smell to display
- `Searches` searches the player can, in general this should be used to create stubs and expanded once the area is generated
  - `search` what to search
  - `Message` if a string will be displayed to player
  - `function` if in the format of (:name:) it will generate a function stub to later fill in with more advanced search code
- `No Base Items` replace inherited base object items, if false items are merged with base items, and any with the same name are replaced with current
- `No Base Monsters` disable base inherited monsters
- `No Base Objects` disable base inherited objects
- `No Base Forage` do not return inherited forage object function
- `No Base rummage` do not return inherited rummage object function
- `Forage Objects` objects to return when a player forages for food
  - `Name` the object to return
  - `Random` the chance it is this object  
- `Rummage Objects` objects to return when a player rummages for materials
  - `Name` the object to return
  - `Random` the chance it is this object  

### Description

The basic properties used to describe the room

- `Short` the room short
- `Long` the room long description
- `Items` the items that can be looked at in a room
- `Monsters` the monsters that will appear in the room, selected from the area monster list
- `Objects` the objects that should be created in the room that the player can take or interact with, selected from the area object list
- `Terrain` the terrain type for a room, can be anything or pick from a preselected dropdown
- `Default Smell` the default smell for the room
- `Default Sound` the default sound for the room

### Exits

- `Exits` The room exits, allows you to edit exits, external exits, and climbs all in one place
  - `Exit` the exit to create
  - `Destination` the path to where the exit leads to, if blank use default destinations
    - **Note** You can link to any room in the are by  using x,y,z as the file name, eg 0,0,0 is the very first room and what ever file it ends up named as will replace it
  - `Door` door name if this exit should be a door to open or close
  - `Key ID` a unique key id to link a key object so door can be locked or unlocked
  - `Hidden` is the room visible to players
  - `Blocker` a name or list of comma delimited names of monsters that block exit
  - `Prevent peer` a string to display if can no peer exit
  - `Destination door` the destination door id from the destination
  - `Locked` is the door locked or unlocked every room reset
  - `Closed` is the door opened or closed every room reset
  - `Climb` is this exit a climb
  - `Climb difficulty` if climb how hard is it
- `External` A simple read only field to display if current selection has external exits
- `Climbs` A simple read only field to display if current selection has climbs

### Location

The coordinates of the room as read only values, will display z value if multi level map

- `X` The x coordinate
- `Y` The y coordinate
- `Z` The z coordinate if depth of area is more then 1

### Properties

General room properties

- `Light` how much light the room has
- `Night adjustment` the amount of light to adjust the room with when night
- `Properties` Simple toggle properties
  - `Melee as ability` all melee in room should be treated as abilities when calculation protections
  - `No dirt` can not dirt in this room
  - `Enable pk` can kill other players
  - `No forage` can not forage for food
  - `Hide exits` hide all exits, good to simulate being blind
  - `No map send` do not send map data to client
  - `Explored` room will be counted to % explored
  - `No teleport` can not teleport out of room
  - `No attack` can not attack in room
  - `No magic` can not do magic or faith in room
  - `Council` allows combat with fake death, good for making arenas
  - `No scry` can not scry people in room
  - `Indoors` room is indoors
  - `Sinking up` is room sink up, **Note** this requires sink room type or custom handling, this will call set_up(path to up) and set_living_sink to on
  - `Sinking down` is room sink down, **Note** this requires sink room type or custom handling, this will call set_down(path to down) and set_living_sink to on
  - `No mgive` do not allow mages to mgive to people in this room
- `Forage` the amount of food returned each forage, -1 default to random amount of Max forage
- `Max forage` the max amount player can forage per reset
- `Secret exit` provide a hint that there is a secret exit in this room
- `Dirt type` custom dirt type, if empty it will be based on terrain and weather
- `Prevent peer` a message, true/false or a function to prevent peering any exit
- `Temperature` set the room Temperature, every 100 or -100 triggers damage done by heat or cold

## Design properties

### General

The general properties for the area design

- `Default room` The default room type to set when creating a room
- `Default monster` The default monster type to set when creating a monster

### Base rooms

Allows you to create base room types for rooms to inherit

- `Name` A unique name, used to create a define in area.h of NAMEROOM
- `No base monsters` Do not add monsters from inherited type
- `No base Objects` Do not add objects from inherited type
- `No base items` replace items from inherited type else merge and only replace matching names
- `No base forage` do not return inherited forage object function
- `Objects` the default objects for the room
  - `Name` the item to add
  - `Min amount` the minimum amount to add
  - `Max amount` the maximum amount to add
  - `Random` the random chance the object will be added, 0 to 100, 0/100 always
  - `Unique` Only one should ever exist
- `Monsters` the default monsters to create
  - `Name` the item to add
  - `Min amount` the minimum amount to add
  - `Max amount` the maximum amount to add
  - `Random` the random chance the object will be added, 0 to 100, 0/100 always
  - `Unique` Only one should ever exist
- `...` open room editor to allow more fine control of different room properties
  - `Forage objects` objects to return when a player forages for food
    - `Name` the object to return
    - `Random` the chance it is this object
  - `Rummage objects` objects to return when a player rummages for materials
    - `Name` the object to return
    - `Random` the chance it is this object  
  - see [Room wizard](codeeditor.md#newroom) for more details
  - `Notes` optional notes about the monster, included in the header comments when code generated

### Base monsters

Allows you to create base monsters for monsters to inherit

- `Name` A unique name, used to create a define in area.h of NAMEMONSTER
- `Max amount` the max amount of this type of monster, ignored if -1 or 0, or overridden by monster
- `No base objects` do not add inherited objects from base type
- `No base topics` do not ask topics from base type else merge and replace same named
- `Objects` the default objects for the monster
  - `Name` the item to add
  - `Min amount` the minimum amount to add
  - `Max amount` the maximum amount to add
  - `Random` the random chance the object will be added, 0 to 100, 0/100 always
  - `Unique` Only one should ever exist
  - `Action` an action to do with the item
- `...` open monster editor to allow more fine control of different monster properties
  - see [Monster wizard](codeeditor.md#newmonster) for details
  - `Notes` optional notes about the monster, included in the header comments when code generated

## Monster editor

Create monsters for your area

- `Name` The name of the monster
- `Short` the short description of the monster
- `Max amount` the max amount of this monster that should be created in the area
- `No base objects` do not add inherited objects from base type
- `No base topics` do not ask topics from base type else merge and replace same named
- `Objects` the default objects for the monster
  - `Name` the item to add
  - `Min amount` the minimum amount to add
  - `Max amount` the maximum amount to add
  - `Random` the random chance the object will be added, 0 to 100, 0/100 always
  - `Unique` Only one should ever exist
  - `Action` an action to do with the item
- `...` open monster editor to allow more fine control of different monster properties
  see [Monster wizard](codeeditor.md#newmonster) for details
  - `Notes` optional notes about the monster, included in the header comments when code generated

## Object editor

Create objects for your area

- `Name` The name of the object, can include color codes
- `Short` the short description of the object, can include color codes
- `Type` the type of object to create
  - `Object` a basic object, good for keys and generic stuff
  - `Chest` a chest to contain other objects, money or gems
  - `Material` Material usable in crafting
  - `Ore` Raw ores for crafting
  - `Weapon` a weapon
  - `Armor` a piece of armor
  - `Sheath` a weapon sheath
  - `Material weapon` a weapon that can also be used as material in crafting
  - `Rope` rope for climbing
  - `Instrument` bard instruments
- `...` open object editor to allow more fine control of different object properties
  - `Description` Descriptions that all objects support
    - `Name` the name of the object, can include color codes, **BOLD**if using color codes always end with %^DEFAULT%^
    - `Short` the short description, can include color codes, **BOLD**if using color codes always end with %^DEFAULT%^
    - `Nouns` a comma separated list of nouns to describe the object
    - `Adjectives` a comma separated list of adjectives to describe the object
  - `Long` the long description of the object
  - `General properties` general properties that all objects support
    - `KeyID` a unique key id to turn an object into a key to unlock doors/chest, if object type is chest this is used to assign a key to chest
    - `Mass` the mass of the object, only objects that are weapons or armors have default mass
    - `Material` what the object is made from, must be a valid material or alloy, may select from list of supported materials
  - `Prevent actions` prevent certain action from working
    - `Prevent offer` do not allow offering object
    - `Prevent get` can not get object
    - `Prevent drop` can not drop object
    - `Prevent put` can not put object in storage items
    - `Prevent steal` can not steal item
  - `Reads` things can be read on the object, **Note** they must be included as an noun to be readable
    - `Read` the id to match
    - `Description` the description to display to the user
    - `Language` the language the description is in
  - `Bonuses` get bonuses granted by object or used for crafting, not all objects allow bonuses
    - `Type` the type of bonus
      - `Property` a generic bonus
      - `Stat` a stat bonus
      - `Skill` a skill bonus
      - `Resistance` a resistance to a type of damage
    - `Adjust` what to adjust, can be any value, predefined list are provided for quick selection based on type
    - `Amount` the amount to adjust can be any number or string value
      - `small` only supported with skills, stats, or resistance types
      - `respectable` only supported with skills, stats, or resistance types
      - `large` only supported with skills, stats, or resistance types
  - `Skill requirements` skill requirements to wield or wear weapons/sheaths/armors
    - `Type` the type of requirement
      - `Skill` test weapon or armor skill
      - `Level` test the players level
    - `Class` the class to test, either all or picked class
    - `Amount` the amount of skill or level to check for
    - `Message` the message to display to the player when check fails
  - `Type properties` these pages contain properties and settings that only apply based on the selected object type
    - `Armor`
      - `Type` the type of armor, select from the supported list
      - `Limbs` a comma delimited list of limbs the armor is for
      - `Quality` the quality of the armor
      - `Enchantment` the natural enchantment of the armor
      - `Damaged armor descriptions` list of descriptions for an armor that has limbs that have broken off
        - `Type` the type of description
          - `Name` the name of the armor
          - `Short` the short of the armor
          - `Long` the long description of the armor
          - `Nouns` a comma delimited list of nouns
          - `Adjectives` a comma delimited list of adjectives
          - `ID` a comma delimitied list of ids, not needed of nouns/adjectives are enough
        - `Limbs` the missing limbs, can be from a predefined list, or a comma delimited list of limbs to match
        - `Description` the description to use for the type and if the missing limbs match
        - `Max wearable` the maximum amount of this armor that can be worn at one time
    - `Sheath` has all the same properties as armor but for weapon type
      - `Weapon type` the type of weapon the sheath is for
      - `Damaged armor descriptions` see armor
      - `Max wearable` the maximum amount of this sheath that can be worn at one time
    - `Chest`
      - `Blockers` a comma delimited list of monster names that will attack when trying to open, get or unlock the chest
      - `Lock strength` how strong a lock is when being picked
      - `Max encumbrance` the max mass the chest can hold
      - `Reduce mass` adjust the mass of an item put in a chest, mass * reduct = final mass
      - `Contents` the contents of the chest that if empty will be restored every room reset
        - `Item` the item to add, can be an object, money, or type of gem
        - `Min amount` the minimum amount to add
        - `Max amount` the maximum amount to add
        - `Random` the random chance the item gets added to the chest
    - `Material`
      - `Size` the size of material, can pick from a quick word list or use raw #s
      - `Quality` the quality of the material
      - `Describers` a comma delimited list of words that describe the material
    - `Ore` same as material but limited to ore material types, if a none ore type is set as material will randomly pick
    - `Instrument`
      - `Type` the type of instrument to create
      - `Weapon type` an optional weapon type for the instrument for non bard uses
      - `Quality` the quality of the Instrument
      - `Enchantment` the natural enchantment of the Instrument
    - `Rope`
      - `Quality` the quality of the Instrument
      - `Enchantment` the natural enchantment of the rope
    - `Weapon`
      - `Type` the type of weapon to create
      - `Quality` the quality of the Weapon
      - `Enchantment` the natural enchantment of the Weapon
    - `Material weapon` the same as weapon but for size and describers
      - `Size` the size of material, can pick from a quick word list or use raw #s
      - `Describers` a comma delimited list of words that describe the material
