# jiMUD

A mud client using electron for [ShadowMUD](http://www.shadowmud.com) based on it's web client.

## Installation

- Window
  - Download the msi or exe of your choice to install, follow any on screen prompts
  - Portable: down load jiMUD._VERSION_windows_portable-ARCH.exe to a folder and run, all files will be contained in that folder
- Linux
  - Deb: sudo app install ./jimud_VERSION_amd64.deb
  - Snap: sudo snap install ./jimud_VERSION_amd64.snap --dangerous
  - Snap classic: sudo snap install ./jimud_VERSION_amd64_classic.snap --dangerous --classic
  - Flatpak: sudo flatpak install ./jiMUD-VERSION-x86_64.flatpak
  - Rmp: rpm -i ./jimud-VERSION.x86_64.rpm
  - AppImage: set to executable and run
    - Recommended: https://github.com/TheAssassin/AppImageLauncher

## Build

  To build jiMUD you must have nodejs 20 LTS or >=22, npm, typescript 2.3+, cPython installed
  Steps to build:

### Prerequisites

Install or download Node: https://nodejs.org/en/download/
  - Npm comes with most node installs, if not see: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
Install or download Typescript: https://www.typescriptlang.org/download/
  - easiest to just use npm globally

### Electron builder:

Required modules or packages to build different installer types: https://www.electron.build/multi-platform-build.html

#### Flatpak Prerequisites

1. Ensure flatpak and flatpak-builder are installed on build system
1. Ensure the platform and sdk runtimes are installed: flatpak install flathub org.freedesktop.Platform//23.08 org.freedesktop.Sdk//23.08 org.electronjs.Electron2.BaseApp//23.08

### Clone repository or use archive zip

1. `git clone https://github.com/icewolfz/jiMUD.git` or `git pull` if already ready cloned, or you can download and unzip the source archive

### Windows

1. npm install - install all the node modules, **Note** you will need to rerun this only if modules have been updated in the package.json
1. npm run release:win - build installer and portable exe

### Linux

1. npm install - install all the node modules, **Note** you will need to rerun this only if modules have been updated in the package.json
1. npm run release:linux - build tar, deb, appImage, rpm, and flatpak packages

#### Linux Slim - Build without flatpak

1. npm install - install all the node modules, **Note** you will need to rerun this only if modules have been updated in the package.json
1. npm run release:linux-slim - build tar, deb, appImage, and rpm packages

### Mac

1. npm install - install node modules, **Note** you will need to rerun this only if modules have been updated in the package.json
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

Usage: `jiMUD [arguments...]`

- `-h, --help` Print console help
- `-v, --version` Print current version
- `-d, --debug` Enable dev tools for all windows
- `-s=[file], --settings=[file]` Override default setting file
- `-m=[file], --map=[file]` Override default map file
- `-c=[name or id], --character=[name or id]` Load a character from character database, may be used multiple times to supply multiple characters to load
- `-c=[id:#], --character=[id:#]` Load a character from character database by id only, may be used multiple times to supply multiple characters to load
- `-e, --editor, -e=[file], --editor=[file]` Open code editor with current/new client, may be used multiple times to supply multiple files to load
- `-eo, --eo, -eo=[file], --eo=[file]`  Open only the code editor, may be used multiple times to supply multiple files to load
- `-no-pd, -no-portable-dir` When using portable exe use default local data directory
- `-data-dir=[file]` Set a custom directory to store saved data
- `-l=[file], -layout=[file]` Load window layout file
- `-il, --ignore-layout` Ignore layout and do not save window states
- `-nci, --no-character-import` Do not import old character.json
- `-fci, --force-character-import` Force import old characters.json
- `-f, --force` Force load of instance even if single only instance enable
- `-nls, --no-layout-save` Do not save any layout changes when application is closed
- `-nw, --new-window` Open a new window
- `-nw=[id], --new-window=[id]` Open a new window with and load a character
- `-nt, --new-tab` Open a new tab
- `-nt=[id], --new-tab=[id]` Open a new tab and load a character, similar to --character but will not replace current active tab if it exist
- `-el=[file], --error-log=[file]` Set a custom error log path
- `-cr, --crash-reporting` Enable crash reporting to local folder
- `-crp=[path], --crash-reporting-path=[path]`  Path where crash reporting data is saved

## References

- [Interface](docs/interface.md)
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
- [Immortal tools](docs/immortal.md)
- [Code editor](docs/codeeditor.md)
  - [Area designer](docs/codeeditor.designer.md)

## Known Issues

- Linux:
  - Tray icon: When app indicator is used on Linux, the click event is ignored, see [Electron docs for more limits](https://www.electronjs.org/docs/api/tray)
  - Auto updating is only supported by AppImage, DEB or RPM
  - Show in task bar is no longer supported because Electron removed support due to wayland
  - Immortal tools: may get permission denied errors when using snap when trying to build path navigation drop down, can be gotten around by rebuilding using classic confinement for more system access and using the --classic argument when installing
- Windows:
  - Spellchecker does not always work due to issues with how windows spell check systems work when using en-US language
- Display:
  - Unicode RTL text selection display is not correct
  - MXP Image height is limited to line height
  - MXP Image selection/copy not supported
- Backup:
  - Loading data that is related to operating system may revert to default or be ignored as paths could not exist or may be in wrong format
- Command input
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
- Mail composer
  - All issues from Advanced editor
  - Does not work if in an editor on mud or at a prompt accepting input
- General slow performance, do not use --disable-gpu it can impact overall performance
- [Mapper](docs/mapper.md#know-issues)
- [Code editor](docs/codeeditor.md#know-issues)
