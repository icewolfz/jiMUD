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