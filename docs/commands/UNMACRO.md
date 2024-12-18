# #UNMACRO

## <u>UNM</u>ACRO

### **Syntax:** #UNM key|index *profile*
> Delete a macro

### **Arguments:**
- key - The key combo of macro using + to separate each modifier
    Supported modifiers: ctrl, alt, shift, or meta
    win is the same as meta modifier
    cmd is the same as ctrl for macs
- index - The index of the alias to delete, based on sorted priority
- *profile* - The optional profile to look in, if not supplied defaults to current active profile

### **Related:** [#ALIAS](ALIAS.md)

### **Examples:**
`#unm f1`
> Delete the f1 macro or displays not found
`#unm ctrl+f1`
> Delete the f1 macro with modifier ctrl or displays not found