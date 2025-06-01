# Character manager

The character manager allows you to create multiple setups with each character
allowed their own settings and map file. This allows you to assign profiles and
settings using a character login making it easier to switch between different
characters.

To load a character use the character manager by using File > Characters or using command line
argument, -c=[name, id #, or id:#] or --character=[name, id #, or id:#]
**Note** if a name exist that is a number it will load the name not the id unless prepended with id: to force id only lookup
**Note** if more then one name exist it loads only the first one returned

## Importing

The character manager can import anything exported from the character or the raw character files
All imported data files are merged with current database and may replace or override 
current or matching characters depending on settings

Supported files:
character.json/json.bak - the older character manager format before switched to sqlite database
.sqlite - the current database format
.zip - A zip file created from the back up to zip system or a properly stored custom zip see exporting

## Exporting

If you want to backup just your character database just open the jiMUD data folder and save the character.sqlite

### Backup to zip

This will backup character database and all supporting files including profiles, maps, notes, settings, and the default windows layout
This file may be imported directly from the character manager and files will be attempted to be restored,
you can also just open or extract the zip file to the jiMUD data folder, but only if jiMUD is not open as in memory data may replace copied files
or cause corruption

#### Zip file structure

- `/characters/*` the characters data folder with all related files, most are named either by character or unique id #s
    - `.map` Map datafiles
    - `.json` Setting json files
    - `.notes` Note text file
- `/profiles/*` Profile json files
- `characters.json` Old character database if present
- `map.sqlite` Global default map database
- `settings.json` Global settings file
- `windows.layout` Windows layout file

**Warning** This may replace or cause data lost when files replace current ones, the import process attempts to reload
and update any open connections to the imported data when possible but open connections may still save over newly imported data

**Note** Some files may be locked depending on the operating system and may prevent files from being replaced. Try closing open tabs/connections and disconnecting while importing if issues happen

**Note:** This does not backup code editor data due to not being related to character data, to backup editor data copy the `{data}/editor/` folder, editor.json, editor.sess, and editor.layout files to your backup location, this also does not backup any log files, to back those up copy `{data}/logs/` folder to backup location

## Editor

- `Character` The name of the character, can be different from login, set when first created or you can right click and rename
- `Login` The login name to use when trying to auto connect if auto login is enabled
- `Password` The login password, if left blank will sit at password prompt, **Note** passwords are encrypted with aes-256-cbc, but do not rely on this to be 100% secure as any one with access to the file may be able to decrypt.
- `Settings` The setting file to use, defaults to character path + character name, generated using default setting file.
- `Map` The map file to use, defaults to character path + character name, generated using default map file.
- `Auto load` Load this profile when ever jiMUD is first loaded, can only have one auto loading character, will unset previous set.
- `Development` This character will login to the development port of the mud instead of normal
- `Disconnect on load` Disconnect from the mud when this character is loaded
