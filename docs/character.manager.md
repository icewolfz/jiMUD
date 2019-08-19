# Character manager

The character manager allows you to create multiple setups with each character
allowed their own settings and map file. This allows you to assign profiles and
settings using a character login making it easier to switch between different
characters.

To load a character you use the character manager by using File > characters or using command line
argument, -c=[name] or --character=[name].

## Editor

- `Character` The name of the character, can be different from login, set when first created or you can right click and rename
- `Login` The login name to use when trying to auto connect if auto login is enabled
- `Password` The login password, if left blank will sit at password prompt, **Note** passwords are encrypted with aes-256-cbc, but do not rely on this to be 100% secure as any one with access to the file may be able to decrypt.
- `Settings` The setting file to use, defaults to character path + character name, generated using default setting file.
- `Map` The map file to use, defaults to character path + character name, generated using default map file.
- `Auto load` Load this profile when ever jiMUD is first loaded, can only have one auto loading character, will unset previous set.
- `Development` This character will login to the development port of the mud instead of normal
