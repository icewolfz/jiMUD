# Speedpaths

- Speedpaths are a formated string expanded by the client before sent to the mud allowing for easy repetitive commands in the format of #command repeated with as many commands as you like with no spaces between. The leader command is the only command that can not have a number
- Speedpaths are executed by starting the line with the speedpath character if enabled, which by default is ! and can be changed in Settings > General
- You can escape the speedpath character by doubling it so !!2n would send !2n to the mud instead of being expanded, you can escape a number but doing \# so \0 would be considered a 0 in th command

## Examples:

- n2w would be expanded to "north west west" with each one being sent to the mud as a command
- 2say test2poke monster would be say test 2 times then poke monster 2 times
- 2say \4tee would say 4tee 2 times
