# TODO list
## Context menus 
- Buttonbar - add an edit option that opens directly to profile manager
## Advanced editor
- Test pasted html from more sources and continue to adjust paste processing to fix issues
## Mapper 
- Add a file menu and add all the features from the toolbar?
- A possible bug when 2 or more mappers open, seems they receive ipc from all clients?, should only exist when not load in memory
- Possible data loss when more then one client open
## Profile manager
- Maybe add a file menu?
- Test more then when multiple client instances open
- possible slow down due to file locks, loading profiles, converting from json, or loading icons for buttons
## Miscellaneous
- Add advanced color pref systems to allow customizing the 256 xterm colors
- ***Mac version - needs a mac, can't build or test***
- look into reducing memory
- Re-code the inline variables and functions for parse in the parsing system instead of simple js replace function calls, should improve speed as will not have to call all functions all the time
- Cleanup and optimize code as much as possible
- See about making an xp needed progress bar based on xp required to level
  - HTML and typescript code added but commented out, decide if worth adding and how
## Extension system
- Create an extension system extending the client easier
- Min info for a plugin is unique id/name
- Location of plugins allow {data}/plugins and {documents}/plugins
- convert mapper, backup, status, chat capture into plugins
- plugins are a sub folder with a package.json and maybe allow a theme.css for plugins as well?
  - chat - {data}/plugins/chat/package.json
  - mapper - {data}/plugins/mapper/package.json
  - backup - {data}/plugins/backup/package.json
  - status - {data}/plugins/status/package.json
  - immortal - {data}/plugins/immortal/package.json
- package.json min requires: { "name":"short name", "productName":"Long name", "description":"describe", "main":"path to main js"}
- basic extension: 
  - import { Client } from "./client"; export function create(client: Client) { }
  - export function menu { return [] }; return an array of menu items to be set for plugins > extension name > menu items
  - add an event to context menu that is emitted by client so extensions can hook and modify context menu
  - add execute evens to allow extensions to execute custom commands?
  - client.on('function', (event)=> {}), for custom functions
  - add IPC communication system to allow custom windows to communicate back with extension
    - good examples are mapper requires a separate window but the extension has to be created and started in main