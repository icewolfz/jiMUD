# Customizing

When loading the client will look for and load files in jiMUD's data directory:

- `%APPDATA%\jiMUD` on Windows
- `$XDG_CONFIG_HOME/jiMUD` or `~/.config/jiMUD` on Linux
- `~/Library/Application Support/jiMUD` on macOS

## Themes

jiMUd comes with a list of built in themes to pick from, but also allows you to create you own them and customize the interface.
A theme file is simply a css named as themename.css and stored in one of the two theme
folders: {data}\themes or {documents}\jiMUD\themes, see [faq](faq.md#what-predefined-variables-can-be-use-for-paths) for variables for paths.
The theme files are just css rules using custom class names, ids, and other selectors
allowed by css to create the interface, when position the main window elements (button bar, display, command box, status display) you should use
position based off the edges of left,right,top,and bottoms so they will resize correctly with the window.
There is no official list of supported classes, ids or rules, you can use the current
themes from the git repo as a base, they come in sass formats that can be compiled into final
css.

## user.css

Allows for custom css to adjust or change the client interface, you may need to use !important rule modifier but all css should be loaded after main client css. Supports [Predefined variables for paths](faq.md#what-predefined-variables-can-be-use-for-paths),
for example you can do `.class{ background-image: {assets}/icons/map.png}` to load the map icon.

## monster.css

Allows you to create monster css classes to set monster icons, can also be done in user.css but this allow for a cleaner separation, this code is loaded after user.css.

## user.js

Runs javascript code after the client finishes loading allowing to define custom functions and other javascript options.

## other windows

Other windows support loading of javascript and css to allow them to be adjusted and customized.

- Profile manger: profiles.js and profiles.css
- Chat capture window: chat.js and chat.css
- Mapper: map.js and map.css
- Advanced editor: editor.js and editor.css
- Immortal tools: immortal.js and immortal.css

### CSS monster / party member class names

jiMUD assigns all monster/party member icons with a list of supported css classes based on monster/player data supplied from the mud in order of broad to more detailed naming all.

- Monster classes
  - `.monster-class` the monster's class if it has one
  - `.monster-gender` the monster's gender, `.monster-male`, `.monster-female`, or `.monster-it`
  - `.monster-race` the monster's race, for example `.monster-elf`
  - `.monster-guild` the monster's guild
  - `.monster-name` the monster's name
- Party member classes
  - `.party-class` the monster's class if it has one
  - `.party-gender` the monster's gender, `.party-male`, `.party-female`, or `.party-it`
  - `.party-race` the monster's race, for example `.party-elf`
  - `.party-guild` the monster's guild
  - `.party-name` the monster's name

#### Examples

```css
.monster-cerberus {
    /*image is set by background-image*/
    background-image: url({assets}/monsters/32x32-2.png);
    /*32x32-2 is a image sprite of icons 32x32, so we supply the top corner offset in -#*/
    background-position: -160px -992px;
    /*set an optional background, all build in icons are transparent background*/
    background-color: maroon;
}

.monster-skeleton {
    /*image is set*/
    background-image: url({assets}/monsters/SkeletonWarrior60.png);
    /*this is not a sprite but it is larger then the supported 32x32 size so we use css background-size to resize the image to fit the location*/
    background-size: 32px 32px;
}
```

**Note**: if the class, race, guild, or name contain non supported characters they are stripped out, for example `Old Man` would be `monster-OldMan`, notice the casing remains. Supported characters: a-z, A-Z, 0-9, _, and -
