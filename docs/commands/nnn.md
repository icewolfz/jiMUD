# #nnn

### **Syntax:** #number command

> Repeat commands NNN number of times, if negative will use a reverse counter, to use variables or expressions see [#LOOP](LOOP.md) and [#REPEAT](REPEAT.md)

### **Related:** [#LOOP](LOOP.md), [#REPEAT](REPEAT.md)

### **Examples:**
`#5 #sh %i`
> Will display the numbers 1 to 5

`#-5 #sh %i`
> Will display the numbers 5 to 1

`#5 kill monster`
> Will send the command kill monster five times to the MUD