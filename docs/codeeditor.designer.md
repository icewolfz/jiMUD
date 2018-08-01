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
- `Sub Area` An optional subarea name that will be used when creating code
- `Sounds` Sounds the player can listen to with the listen command
    - `Sound` the sound to listen to
    - `Description` the sound to display
- `Smells` smells for the room
    - `Smell` the smell
    - `Descrpition` the smell to display
- `Searches` searches the player can, in general this should be used to create stubs and expanded once the area is generated
    - `search` what to search
    - `Message` if a string will be displayed to player
      - `function` if in the format of (:name:) it will generate a function stub to later fill in with more advanced search code

### Description

The basic properties used to describe the room

- `Short` the room short
- `Long` the room long description
- `Items` the items that can be looked at in a room
- `Objects` the objects that should be created in the room that the player can take or interact with, selected from the area object list
- `Monsters` the monsters that will appear in the room, selected from the area monster list
- `Terrain` the terrain type for a room, can be anything or pick from a preselected dropdown
- `Default Smell` the default smell for the room
- `Default Sound` the default sound for the room

### Exits

- `Exits` The room exits, allows you to edit exits, external exits, and climbs all in one place
    - `Exit` the exit to create
    - `Destination` the path to where the exit leads to, if blank use default destinations
    - `Door` door name if this exit should be a door to open or close
    - `Key ID` a unique key id to link a key object so door can be locked or unlocked
    - `Hidden` is the room visible to players
    - `Blocker` a name or list of comma delimited names of monsters that block exit
    - `Prevent peer` a string to display if can no peer exit
    - `Destination door` the destination door id from the destination
    - `Locked` is the door locked every repop
    - `Climb` is this exit a climb
    - `Climb difficulty` if climb how hard is it
- `External` A simple read only field to display if current selection has external exits
- `Climbs` A simple read only field to display if current selection has climbs

### Location

The coordinates of the room as read only values, will display z value if multi level map

- `X` The x coordinate
- `Y` The y coordinate
- `Z` The z corrdinate if depth of area is more then 1

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
    - `Water` room is water, allows you to create an underwater room with different terrain
    - `Hot` is room hot, will set the temperature to 200
    - `Cold` is room cold, will set temperature to -200
    - `Sinking up` is room sink up, **Note** this requires sink room type or custom handling, this will call set_up(path to up) and set_living_sink to on
    - `Sinking down` is room sink down, **Note** this requires sink room type or custom handling, this will call set_down(path to down) and set_living_sink to on
- `Forage` the amount of food returned each forage, -1 default to random amount of Max forage
- `Max forage` the max amount player can forage per reset
- `Secret exit` provide a hint that there is a secret exit in this room
- `Dirt type` custom dirt type, if empty it will be based on terrain and weather
- `Prevent peer` a message, true/false or a function to prevent peering any exit
- `Temperature` set the room Temperature, every 100 or -100 triggers damage done by heat or cold

## Design properties

### General

The genearal properties for the area design

- `Default room` The default room type to set when creating a room
- `Default monster` The default monster type to set when creating a monster

### Base rooms

Allows you to create base room types for rooms to inherit

- `Name` A unique name, used to create a define in area.h of NAMEROOM
- `Objects` the default objects for the room
- `Monsters` the default monsters to create
- `...` open room editor to allow more fine control of different room properties

### Base monsters

Allows you to create base monsters for monsters to inherit

- `Name` A unique name, used to create a define in area.h of NAMEMONSTER
- `Max amount` the max amount of this type of monster, ignored if -1 or 0, or overridden by monster
- `Objects` the default objects for the monster
- `...` open monster editor to allow more fine control of different monster properties

## Monster editor

Create monsters for your area

## Object editor

Create objects for your area