# Scripting

# Predefined varibles:
- `$selected` - selected text
- `$selectedword` - word under mouse when right clicked
- `$selectedline` - line under mouse when right clicked
- `$selectedurl` - url under mouse when right clicked
- `$selword` same as $selectedword
- `$selline` sane as $selline
- `$selurl` same as $selected url

# Basic function list:
- `this.send(text)` send text directly to the mud, telnet code IAC is escaped, note you should always try and append a new lien as most muds require it to process any text.
- `this.sendRaw(text)` sends raw text directly to the mud as is
- `this.sendCommand(text)` sends a command as if sent from the command line
- `this.sendBackground(text)` sends a command as if sent from the command line with out modifying the current command line
- `this.print(text, newline)` print text to screen, newline argument is optional and controls weather to start a newline if last line was a fragment/prompt
- `this.echo(text, fore, back, newline, forceline)` echo text to the screen
  - `test` the text to echo
  - `fore` ansi foreground code default is local echo
  - `back` background color
  - `newline` see this.print
  - `foreline` always force a new line regardless of current last line state
- `this.parse(text)` send raw text to the screen to be parsed and displayed, can be used to send raw ansi or MXP coded
- `this.sendGMCP(text)` send a GMCP formatted string to the mud, see GMCP spec notes for formatting, its mostly in {module, data} where data is a JSON formatted string
### **WARNING**: you can effect the client if you access the wrong function, so any function used other then this list may caused unknown results and could cause the client to stop working

Notice how all the functions have a this. in front of them, this is the client object that has all functions related to the client, with out the this the functions will not work as they are not in the function scope. Client functions can also be access using client.function for global code or inline functions
## Scripting Examples
#### Mono grayscale rainbow text alias
```
/*
Start mono gray-scale rainbow example

syntax: monoline [line] [text]

to use this alias in OoMUD, create a new alias named monoline, set the style to Script
and ensure append arguments is checked
*/
//the line to display text on
var line = arguments[1];
//new string
var str = "";
//colors to use
var colors = [];
//random start
var offset = Math.ceil(Math.random()*1000);
//build color list
for(var i=0; i&lt;20; i++)
{
  if(3+i &lt; 10)
    colors[i] = "%^mono0"+(3+i)+"%^";
  else
  	colors[i] = "%^mono"+(3+i)+"%^";
  if(23-i &lt; 10)
  	colors[i+20] = "%^mono0"+(23-i)+"%^";
  else
  	colors[i+20] = "%^mono"+(23-i)+"%^";
}

//start at arguments 2 since 0 is full line, and 1 is the line, 
//so any thing after 2 is the text we want
var args = Array.prototype.slice.call(arguments);
var oldstr = args.slice(2).join(" ");

for(var c = 0; c&lt;oldstr.length;c++) 
{
	var i = (c+offset)%colors.length;
	str += colors[i]+oldstr.charAt(c); 
}
this.sendCommand(line + " " + str);
//End mono grayscale example
```