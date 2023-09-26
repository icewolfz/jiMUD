# #UNALIAS

## <u>PR</u>OMPT

### **Syntax:** #PR variable *message defaultValue mask*
> Displays a prompt dialog to enter text and store results in variable, if canceled or closed result is null

### **Arguments:**
- variable - Variable name to store returned result
- *prompt* - Optional prompt message to display, if '' or null will not be displayed
- *defaultValue* - Default value to set input value to
- *mask* - true to use default masking or a character to use as a mask, *Only the first letter is used when supplying a custom mask if more then one letter*

### **Warning:**
> This is a blocking command and may cause the client to appear frozen until input has been returned from the dialog

### **Examples:**
`#PR name`
> Opens a prompt and save the results to name variable