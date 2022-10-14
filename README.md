# jiMUD

A mud client using electron for [ShadowMUD](http://www.shadowmud.com) based on it's web client.

## Build

  To build jiMUD you must have node, npm, typescript 2.3+, cPython installed
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

## Run

1. npm install - install node modules
1. npm run rebuild - this rebuilds modules to work with electron if needed
1. npm run compile - compile typescript into javascript files
1. npm run start - start jiMUD

This will allow you to run jiMUD directly from this folder with out the need to
package into a self contained folder or building an installer.
**Note** you only need to run the install, rebuild, and compile steps the first 
time or any time you update the packages.

## Standalone application

1. npm install - install node modules
1. npm run build:debug-compile

This will compile typescript into javascript, rebuild native node modules and create
a runnable package that can be ran from dist/ARCH-unpacked folder. This can be used
for debugging or running it as full app with out the need to install, just run
the jiMUD executable in dist/ARCH-unpacked folder.

## FAQ

Basic questions answered about jiMUD

- [jiMUD FAQ](docs/faq.md)

## Command line arguments

- `-h, --help`                                Print console help
- `-d, --debug`                               Enable dev tools for all windows
- `-s=[file], --settings=[file]`              Override default setting file
- `-mf=[file], --map=[file]`                  Override default map file
- `-c=[name], --character=[name]`             Allows you to load/create a character from character database
- `-pf=[list], --profiles=[list]`             Set which profiles will be enabled, if not found will default
- `-v, --version`                             Print current version
- `-e, --editor, -e=[file], --editor=[file]`  Open code editor
- `-eo, --eo, -eo=[file], --eo=[file]`        Open only the code editor
- `-no-pd, -no-portable-dir`                  When using portable exe use default local data directory
- `-data-dir=[file]`                          Set a custom directory to store saved data

## References

- [Profiles](docs/profiles.md)
- [Speedpaths](docs/speedpaths.md)
- [Commands](docs/commands.md)
- [Functions](docs/functions.md)
- [Preferences](docs/preferences.md)
- [Scripting](docs/scripting.md)
- [Customizing](docs/customizing.md)
- [Assets](docs/assets.md)
- [Mapper](docs/mapper.md)
- [Character manager](docs/character.manager.md)
- [Immortal Tools](docs/immortal.md)
- [Code editor](docs/codeeditor.md)
  - [Area designer](docs/codeeditor.designer.md)

## Known Issues

- Linux:
  - The minimize event does not correctly fire, thus `Hide when minimized` may not work
  - Tray icon: When app indicator is used on Linux, the click event is ignored, see [Electron docs for more limits](https://www.electronjs.org/docs/api/tray)
  - Auto updating is only supported by Appimage
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
  - When applying styles to all text some styles may get stuck
  - Some styles will not flash when flashing is enabled depending on order of styles applied
  - Reverse style has weird results with heavy nesting of reverse tags and colors, suggest to just use normal background colors.
  - Correction from context menu may remove applied styles depending on if they are just that word
  - Complex color codes may be returned due to nesting and other complex style choices
- General slow performance, do not use --disable-gpu it can impact overall performance
- [Mapper](docs/mapper.md#know-issues)
- [Code editor](docs/codeeditor.md#know-issues)
