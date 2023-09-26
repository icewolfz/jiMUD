# color

### **Syntax:** prompt(*prompt*,*defaultValue*,*mask*)
>Displays a prompt dialog to enter text and return the value, if canceled or closed result is null or empty string

### **Arguments:**
  - `prompt` Optional prompt message to display, if '' or null will not be displayed
  - `defaultValue` Default value to set input value to
  - `mask` true to use default masking or a character to use as a mask, *Only the first letter is used when supplying a custom mask if more then one letter*

## **Warning**
>This is a blocking command and may cause the client to appear frozen until input has been returned from the dialog
