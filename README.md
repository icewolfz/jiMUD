# jiMUD

A mud client using electron for [ShadowMUD](http://www.shadowmud.com) based on it's web client.

# Build
  To build jiMUD you must have node, npm, cPython 2.7 installed
  Steps to install:
### Windows
1. npm install - install all the node modules
2. npm run rebuild:win - rebuild sqlite3 for windows
3. npm run compile - will compile typescript and scss files into js and css files
4. npm run build:win - builds 32 bit and 64 bit files
5. npm run package:win - build win 32/64 bit window's installers, alternatives:
    - npm run build:win32 - build just 32bit window's installer
    - npm run build:win64 - build just 64bit window's installer
    - npm run build:winportable - build win 32/64 bit window's portable files
    - npm run build:winportable32 - build win 32 bit window's portable files
    - npm run build:winportable64 - build win64 bit window's portable files

### Linux
1. npm install - install all the node modules
2. npm run rebuild:linux - to rebuild on linux
3. npm run compile - will compile typescript and scss files into js and css files
4. npm run build:linux - build linux 32 bit, 64 bit and arm
5. npm run package:linux - build ia32,x64 and arm tar.xz packages, alternatives:
    - npm run build:linux-other - build ia32/x64/arm deb, rpm and appImage files
    - npm run build:linux-other32 - build ia32 deb, rpm and appImage files
    - npm run build:linux-other64 - build x64 deb, rpm and appImage files
    - npm run build:linux-otherarm - build arm deb, rpm and appImage files

Build and package files are all saved to dist folder

## FAQ
Basic questions answered about jiMUD
- [jiMUD FAQ](docs/faq.md)

## Command line arguments
- `--debug/-d` enable dev tools for all windows

## References
- [Speedpaths](docs/speedpaths.md)
- [Commands](docs/commands.md)
- [Preferences](docs/preferences.md)
- [Scripting](docs/scripting.md)
- [Profiles](docs/profiles.md)
- [Customizing](docs/customizing.md)
- [Assets](docs/assets.md)

## Known Issues
- Advanced editor 
  - Paste may lose some colors/background colors on pasted, this is a bug in TinyMCE editor
  - When apply styles to all text some styles may get stuck  
  - Some styles will not flash when flashing is enabled depending on order of styles applied
  - Toolbar text/background color picker may be cut off in small window sizes
  - Reverse style has wierd results with heavy nesting of reverse tags and colors, suggest to just use normal background colors.