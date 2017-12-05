# jiMUD

A mud client using electron for [ShadowMUD](http://www.shadowmud.com) based on it's web client.

## Build

  To build jiMUD you must have node, npm, node-sass, typescript 2.3+, cPython 2.7.x installed
  Steps to build:

### Windows

1. npm install - install all the node modules
1. npm run rebuild:win64 - rebuild sqlite3 and spellchecker
    - npm run rebuild:win32 - rebuild 32bit version, it will override any other windows versions
1. npm run compile - will compile typescript and scss files into js and css files
1. npm run build:win64 - builds application files in dist/jiMUD-win32-x64
    - npm run build:win32 - build 32bit in dist/jiMUD-win32-ia32
1. npm run package:win64 - build installer
    - npm run build:win32 - build just 32bit window's installer, requires 32bit build folder
    - npm run build:winportable - build win 32/64 bit window's portable files, requires both build folders
    - npm run build:winportable32 - build win 32 bit window's portable files, requires 32bit build folder
    - npm run build:winportable64 - build win64 bit window's portable files, requires 64bit build folder

### Linux

1. npm install - install all the node modules
1. npm run rebuild:linux64 - rebuild sqlite3 and spellchecker
    - npm run rebuild:linux32 - rebuild 32bit version, it will override any other windows versions
    - npm run rebuild:linuxarm - rebuild for arm
1. npm run compile - will compile typescript and scss files into js and css files
1. npm run build:linux64 - builds application files in dist/jiMUD-linux-x64
    - npm run build:linux32 - build 32bit in dist/jiMUD-linux-ia32
    - npm run build:linuxarm - build arm in dist/jiMUD-linux-armv7l
1. npm run package:linux64 - build tar.xz file
    - npm run package:linux - build tar.xz files for all 3 archs
    - npm run package:linux32 - build tar.xz file
    - npm run package:linuxarm - build tar.xz file
    - npm run package:linux-other - build deb, rpm and appimage packages for all archs, requires all 3 build folders
    - npm run package:linux-other64 - build deb, rpm and appimage packages
    - npm run package:linux-other32 - build deb, rpm and appimage packages, requires 32bit build folder
    - npm run package:linux-otherarm - build deb, rpm and appimage packages, requires arm build folder

Build and package files are all saved to dist folder

## FAQ

Basic questions answered about jiMUD

- [jiMUD FAQ](docs/faq.md)

## Command line arguments

- `-h, --help`                    Print console help
- `-d, --debug`                   Enable dev tools for all windows
- `-s=[file], --setting=[file]`   Override default setting file
- `-mf=[file], --map=[file]`      Override default map file
- `-c=[name], --character=[name]` Allows you to load/create a character from character database
- `-pf=[list], --profiles[]`      Set which profiles will be enabled, if not found will default
- `-v, --version`                 Print current version

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
- [Immortal Tools](docs/immortal.md)

## Known Issues

- Display:
  - Unicode spacing has issues when displaying half or double wide characters when using mixed display formats so text may overlap.
  - Unicode selection background may be shorter then displayed text due to half or double wide characters
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
  - Reverse style has wierd results with heavy nesting of reverse tags and colors, suggest to just use normal background colors.
  - Correction from context menu may remove applied styles depending on if they are just that word
- [Mapper](docs/mapper.md#know-issues)