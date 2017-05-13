# TODO list
## Context menus 
* Buttonbar - add an edit option that opens directly to profile manager
* Input - wait for native, or leave as custom 
## Advanced editor
* Figure out how to enable spell checker
* Test pasted html from more sources and continue to adjust paste processing to fix issues
* Maybe create a new textcolor plugin with different color selectors to fix being cut off when using small window size, maybe a real window to display grid
  * [Textcolor plugin source - https://github.com/tinymce/tinymce/blob/master/src/plugins/textcolor/src/main/js/Plugin.js](https://github.com/tinymce/tinymce/blob/master/src/plugins/textcolor/src/main/js/Plugin.js)
## Mapper 
* Add room exist and coords/zone check x/y/z/zone and if room found bump zone context menu, right click room list a remove room option, maybe exports
* Add a file menu and add all the features from the toolbar?
* a bug when 2 mappers open, seems thet receive ipc from all clients?
## Profile manager
* Maybe add a file menu?
* Test more then when multiple client instances open
* possible slow down due to file locks, loading profiles, converting from json, or loading icons for buttons
## MSP
* Re-code to not stream but dl to local storage
* Make local storage create proper folder structure based in {data}/sounds/.. using MSP protocol docs
## Miscellaneous
* Create better application icons, and new ones where needed
* Finish monster css icons
* Finish party css icons, do generic ones for each player race and gender if good enough icons, possible a silhouette bust of just each races head?
* Add advanced color pref systems to allow customizing the 256 xterm colors
* ***Mac - needs a mac, can't build or test***
* Help files
  * Create a local help file based on docs
  * Finish assets.md and list all build in assets and describe what each is, if a spite list all images in sprite
* Code documentation - comment all classes/functions/enums for all typescript and javascript
* Add MCP telnet support [MCP Standard](http://www.moo.mud.org/mcp/)
* look into reducing memory
* Re-code the inline variables and functions for parse om the parsing system instead of simple js replace function calls, should improve speed as will not have to call all functions all the time
