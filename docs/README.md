# jiMUD

A mud client using electron for [ShadowMUD](http://www.shadowmud.com) based on it's web client.

# Build
  To build jiMUD you must have node, npm, node-sass, typescript 2.3+, cPython 2.7.x installed
  Steps to build:
### Windows
1. npm install - install all the node modules
2. npm run rebuild:win64 - rebuild sqlite3 and spellchecker
    - npm run rebuild:win32 - rebuild 32bit verison, it will override any other windows versions
3. npm run compile - will compile typescript and scss files into js and css files
4. npm run build:win64 - builds application files in dist/jiMUD-win32-x64
    - npm run build:win32 - build 32bit in dist/jiMUD-win32-ia32
5. npm run package:win64 - build intaller
    - npm run build:win32 - build just 32bit window's installer, requires 32bit build folder
    - npm run build:winportable - build win 32/64 bit window's portable files, requires both build folders
    - npm run build:winportable32 - build win 32 bit window's portable files, requires 32bit build folder
    - npm run build:winportable64 - build win64 bit window's portable files, requires 64bit build folder

### Linux
1. npm install - install all the node modules
2. npm run rebuild:linux64 - rebuild sqlite3 and spellchecker
    - npm run rebuild:linux32 - rebuild 32bit verison, it will override any other windows versions
    - npm run rebuild:linuxarm - rebuild for arm
3. npm run compile - will compile typescript and scss files into js and css files
4. npm run build:linux64 - builds application files in dist/jiMUD-linux-x64
    - npm run build:linux32 - build 32bit in dist/jiMUD-linux-ia32
    - npm run build:linuxarm - build arm in dist/jiMUD-linux-armv7l
5. npm run package:linux64 - build tar.xz file
    - npm run package:linux - build tar.xz files for all 3 archs
    - npm run package:linux32 - build tar.xz file
    - npm run package:linuxarm - build tar.xz file
    - npm run package:linux-other - build deb, rpm and appimage packges for all archs, requires all 3 build folders
    - npm run package:linux-other64 - build deb, rpm and appimage packages
    - npm run package:linux-other32 - build deb, rpm and appimage packages, requires 32bit build folder
    - npm run package:linux-otherarm - build deb, rpm and appimage packages, requires arm build folder
  
Build and package files are all saved to dist folder

## FAQ
Basic questions answered about jiMUD
- [jiMUD FAQ](faq.md)

## Command line arguments
- `-h, --help`                    Print console help
- `-d, --debug`                   Enable dev tools for all windows
- `-s=[file], --setting=[file]`   Override default setting file
- `-mf=[file], --map=[file]`      Override default map file
- `-c=[name], --character=[name]` Allows you to load/create a character from character database
- `-pf=[list], --profiles[]`      Set which profiles will be enabled, if not found will default

## References
- [Profiles](profiles.md)
- [Speedpaths](speedpaths.md)
- [Commands](commands.md)
- [Preferences](preferences.md)
- [Scripting](scripting.md)
- [Customizing](customizing.md)
- [Assets](assets.md)
- [Mapper](mapper.md)

## Known Issues
- Command input spell checking
  - Spell checking will not check for errors until a space or newline is entered, or when the command box is refocused, you may right click any word at any point to get a forced list of suggested corrections.
- Advanced editor 
  - Paste may lose some colors/background colors on pasted, this is a bug in TinyMCE editor
  - When apply styles to all text some styles may get stuck  
  - Some styles will not flash when flashing is enabled depending on order of styles applied
  - Toolbar text/background color picker may be cut off in small window sizes
  - Reverse style has wierd results with heavy nesting of reverse tags and colors, suggest to just use normal background colors.
  - Correction from context menu may remove applied styles depending on if they are just that word
- [Mapper](mapper.md#know-issues)