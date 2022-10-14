# #ALIAS

## <u>AL</u>IAS

### **Syntax:** #AL name|index {commands} *profile*
> Create or alter an alias

### **Arguments:**
- name - The name of the alias to create
- index - The index of the alias to alter
- {commands} - The commands the alias will use when executed
- *profile* - The optional profile to look or create the alias in, if not supplied defaults to current active profile

### **Related:** [#UNALIAS](UNALIAS.md)

### **Examples:**
`#al l {look %*}`
> Will create or alter an alias named l that will send the look command with any arguments appended to the end to the mud