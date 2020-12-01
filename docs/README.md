# jiMUD

A mud client using electron for [ShadowMUD](http://www.shadowmud.com) based on it's web client.

## Build

  To build jiMUD you must have node, npm, node-sass, typescript 2.3+, cPython 2.7.x installed
  Steps to build:

### Windows

1. npm install - install all the node modules
1. npm run release:win - build installer and portable exe

### Linux

1. npm install - install all the node modules
1. npm run release:linux - build tar, deb, appImage, and rpm packages

### Mac

1. npm install - install node modules
1. npm run release:mac - build Mac packages

Build and package files are all saved to dist folder

## FAQ

Basic questions answered about jiMUD

- [jiMUD FAQ](faq.md)

## Command line arguments

- `-h, --help`                                Print console help
- `-d, --debug`                               Enable dev tools for all windows
- `-s=[file], --settings=[file]`               Override default setting file
- `-mf=[file], --map=[file]`                  Override default map file
- `-c=[name], --character=[name]`             Allows you to load/create a character from character database
- `-pf=[list], --profiles[]`                  Set which profiles will be enabled, if not found will default
- `-v, --version`                             Print current version
- `-e, --editor, -e=[file], --editor=[file]`  Open code editor
- `-eo, --eo, -eo=[file], --eo=[file]`        Open only the code editor
- `-no-pd, -no-portable-dir`                  When using portable exe use default local data directory
- `-data-dir=[file]`                          Set a custom directory to store saved data

## References

- [Profiles](profiles.md)
- [Speedpaths](speedpaths.md)
- [Commands](commands.md)
- [Functions](functions.md)
- [Preferences](preferences.md)
- [Scripting](scripting.md)
- [Customizing](customizing.md)
- [Assets](assets.md)
- [Mapper](mapper.md)
- [Character manager](character.manager.md)
- [Immortal Tools](immortal.md)
- [Code editor](codeeditor.md)
  - [Area designer](codeeditor.designer.md)

## Known Issues

- Display:
  - Unicode RTL text selection display is not correct
  - MXP Image height is limited to line height
  - MXP Image selection/copy not supported
- Backup:
  - Loading data that is related to operating system may revert to default or be ignored as paths could not exist or may be in wrong format
- Command input
  - Spell checking will not check for errors until a space or newline is entered, or when the command box is refocused, you may right click any word at any point to get a forced list of suggested corrections.
  - Text selection may be lost when other controls are given focus
- Immortal tools
  - Dragging multiple files and dropping outside to other applications will only drop the first file, all others ignored. This is a limitation of electron drag and drop support, until it is added it can not be supported outside of application
- Advanced editor
  - Paste may lose some colors/background colors on pasted, this is a bug in TinyMCE editor
  - When apply styles to all text some styles may get stuck
  - Some styles will not flash when flashing is enabled depending on order of styles applied
  - Reverse style has weird results with heavy nesting of reverse tags and colors, suggest to just use normal background colors.
  - Correction from context menu may remove applied styles depending on if they are just that word
- General slow performance, do not use --disable-gpu it can impact overall performance  
- [Mapper](mapper.md#know-issues)
- [Code editor](codeeditor.md#know-issues)
