# Speedpaths

- Speedpaths are a formatted string expanded by the client before sent to the mud allowing for easy repetitive commands in the format of #command repeated with as many commands as you like with no spaces between. The leader command is the only command that can not have a number
- Speedpaths are executed by starting the line with the speedpath character if enabled, which by default is ! and can be changed in Settings > General
- You can escape the speedpath character by doubling it so !!2n would send !2n to the mud instead of being expanded, you can escape a number but doing \\# so \0 would be considered a 0 in th command
- You may also group commands using () or {} and all text in () or {} will not be parsed allowing you to do nested speed paths

## Preferences

- [Delay between path command](preferences.md#scripting) allows you to set how fast to send path commands in milliseconds, default: 0
- [Amount of path commands to send](preferences.md#scripting) allows you you batch send commands between delay, default: 1
- Under Scripting Characters you can set:
    - `Character` the character to use for speed paths, default: !
    - `Parse` weather to parse commands using the command input parser as if entered from the command line, default: enabled
    - `Echo` echo each command to the screen as it is sent to the mud, default: disabled

## Examples

- `!n2w` would be expanded to "north west west" with each one being sent to the mud as a command
- `!2say test2poke monster` would be "say test" 2 times then "poke monster" 2 times
- `!2say test \1\2\3` would "say test 1 2 3" 2 times
- `!2{n;w}` would send n;w twice, if parse enabled and command stack is ; it would send n, w, n, w
