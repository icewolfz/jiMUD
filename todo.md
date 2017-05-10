# TODO list
## Context menus 
* Display - expand besides basic select  
  * Allow custom items based on profiles like buttons
  * Figure out some way to capture word under mouse pt to allow setting a variable in script and some type of variable in parse like %selectedword% || %selword%
  * Extra Variables:
    * A variable for current selected text, %selected%
    * A variable for current line text under mouse, %selectedline% || %selline%
    * A variable for current url under mouse, %selectedurl% || %selurl%
    * Maybe only support variables in javascript for ease of maintaining
* Status - allow manual refresh as well as the visible toggles
* Buttonbar - allow disable, maybe open in editor directly
* Input - wait for native, or leave as custom 
## Advanced editor
* Expand color tooltips/display names to have proper names base on xterm / color list from ShadowMUD + color code  
* Figure out how to enable spell checker
* Test pasted html from more sources and continue to adjust paste processing to fix issues
* Maybe create a new textcolor plugin with different color selectors to fix being cut off when using small window size, maybe a real window to display grid
  * [Textcolor plugin source - https://github.com/tinymce/tinymce/blob/master/src/plugins/textcolor/src/main/js/Plugin.js](https://github.com/tinymce/tinymce/blob/master/src/plugins/textcolor/src/main/js/Plugin.js)
## Mapper 
* Add room exist and coords/zone check x/y/z/zone and if room found bump zone context menu, right click room list a remove room option, maybe exports
* Add a file menu and add all the features from the toolbar?
## Profile manager
* Add backup systems to allow easier backup/export of profiles with out the need to open file explorer
* Maybe add a file menu ?
* Test more then when multiple client instances open
* possible slow down due to file locks, loading profiles, converting from json, or loading icons for buttons
* Context menu
  * An editor to add/edit custom context menu items to appear when right click display
  * Icon preview similar to button, but on a white/grey bg and limit to 16x16
  * Support action image/fa/custom and generate a proper nativeImage format using canvas like image export or createIcon from Advanced editor
## MSP
* Re-code to not stream but dl to local storage
* Make local storage create proper folder structure based in {data}/sounds/.. using MSP protocol docs
## Miscellaneous
* Create better application icons, and new ones where needed
* Finish monster css icons
* Finish party css icons, do generic ones for each player race and gender if good enough icons, possible a silhouette bust of just each races head?
* Add advanced color pref systems to allow customizing the 256 xterm colors
* maybe convert from using a bell sound file in ansi parer to using electron shell.beep() [https://github.com/electron/electron/blob/master/docs/api/shell.md](https://github.com/electron/electron/blob/master/docs/api/shell.md), do this by capturing the bell event in parer or from index.html as client.parser.on('bell', ()  => { shell.beep() });
* ***Mac - needs a mac, can't build or test***
* Help files
  * Sections for mapper
  * Create a local help file based on docs
  * Finish assets.md and list all build in assets and describe what each is, if a spite list all images in sprite
* Code documentation - comment all classes/functions/enums for all typescript and javascript
* Add MCP telnet support [MCP Standard](http://www.moo.mud.org/mcp/)