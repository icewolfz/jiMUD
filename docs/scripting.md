# Scripting

jiMUD allows you to use javascript for macros, trigger, aliases, buttons, or context items. This allows
for powerful and more advanced features over the basic #functions and just sending text.

To use scripting you just have to select script as the type from the type dropdown in the item editor.

## Predefined variables

- `$selected` - selected text
- `$selectedword` - word under mouse when right clicked
- `$selectedline` - line under mouse when right clicked
- `$selectedurl` - url under mouse when right clicked
- `$selword` same as $selectedword
- `$selline` sane as $selline
- `$selurl` same as $selected url
- `$contextMenu` access to the context menu item array, manipulating this will effect the displayed context menu, **WARNING** this could break the context menu, if broken you can refresh by causing a profile to be re-saved

## [User variables](variables.md)

You can access them scripting from using client.getVariable('NAME', 'SUBKEY') and client.setVariable('NAME'', 'SUBKEY', value). Some variables may not be accessible to the parser: i and repeatnum are special variables and are used in loops and are not accessible in scripting style, named arguments in scripting style will be used instead of any user defined of the same name

Example:
```javascript
//set the variable named test to 5
this.setVariable('test', 5);
client.setVariable('test', 5);
//get the value of test
var test = this.getVariable('test');
var test = client.getVariable('test');
```

Set or created variables can be access in the expression system by name eg ${test + 5} would be 10 based from example

## Named arguments

Naming convention use javascript identifier rules, which are must be at least 1 character of a-z,A-Z,$, or _ followed by a-z,A-Z,$,_, or 0 - 9, and not a javascript keyword

Aliases allow named arguments set using a command delimited list which are converted into local scoped javascript variables,
Example:
Alias with named arguments: name,message
```javascript
this.print(name + ' says ' + message);
```

Triggers allow named capturing which are converted into local scoped javascript variables
Example:
Trigger pattern: (?\<name>.\*) says (?\<message>.*)
```javascript
this.print(name + ' says ' + message);
```

## Basic function list

- `client.beep()` play system beep sound
- `client.readClipboard()` read text from clipboard, can also access from window.readClipboard()
- `client.writeClipboard(text, html)` write text to clipboard, can also access from window.writeClipboard(text), html argument is optional, allows formatted html markup of text for applications that support pasting html
- `client.readClipboardHTML()` read HTML from clipboard, can also access from window.readClipboardHTML()
- `client.send(text, echo?)` send text directly to the mud, telnet code IAC is escaped, note you should always try and append a new line as most muds require it to process any text.
  - `text` the text to send
  - `echo` echo text to display
- `client.sendRaw(text)` sends raw text directly to the mud as is
- `client.sendCommand(text, noEcho?, comments?)` sends a command as if sent from the command line
  - `text` the text to send
  - `noEcho` do not echo text to screen
  - `comments` parse inline and block comments
- `client.sendBackground(text, noEcho?, comments?)` sends a command as if sent from the command line with out modifying the current command line
  - `text` the text to send
  - `noEcho` do not echo text to screen
  - `comments` parse inline and block comments
- `client.print(text, newline)` print text to screen, newline argument is optional and controls weather to start a newline if last line was a fragment/prompt
- `client.echo(text, fore, back, newline, forceline)` echo text to the screen
  - `test` the text to echo
  - `fore` ansi foreground code default is local echo
  - `back` background color
  - `newline` see this.print
  - `forceline` always force a new line regardless of current last line state
- `client.parse(text)` send raw text to the screen to be parsed and displayed, can be used to send raw ansi or MXP coded
- `client.sendGMCP(text)` send a GMCP formatted string to the mud, see GMCP spec notes for formatting, its mostly in {module, data} where data is a JSON formatted string
- `client.notify(title, message, options)` display a windows notification for systems that support it, options are optional
  - `title` the title of the notification
  - `message` the message to display
  - `options` additional options to customize the display [Notification Options](https://developer.mozilla.org/en-US/docs/Web/API/notification/Notification)
    - `dir` - auto, rtl, ltr
    - `icon` - full icon path, supports {variables}
    - `silent` - play sound or not, default false
- `client.raise(event, args, delay)` fire an event with optional delay and arguments
  - `event` the event name to fire
  - `args` an optional array of arguments to pass to the event, if you do not want to pass arguments but want a delay just pass 0 or []
  - `delay` the number of milliseconds to wait before firing event
  - Example" `client.raise('get all', [], 2000);`
- `client.show()` show client
- `client.hide()` hide client
- `client.toggle()` toggle hide and show
- `client.sendChat(text)` send text to chat window
- `client.indices` return the current indices for trigger or an empty array same as [%x1..$x99](functions.md)

### **WARNING**: you can effect the client if you access the wrong function, so any function used other then this list may caused unknown results and could cause the client to stop working

Notice how all the functions have a client. in front of them, this is the client object that has all functions related to the client. For backward compatible with the ShadowMUD
web client we also support OoMUD and this for non ES6 arrow function formats.

## Scripting Examples

### Basic alarm

- Name: alarm
- Style: script
- Value:

```javascript
/*
Syntax to use: <alarm [message] [seconds]>
*/
//store message in local variable so it can be passed to timer
var message = arguments[1];
//convert to number and multiply by 1000 to convert to milliseconds
var ms = 1000 * parseInt(arguments[2], 10);
setTimeout( function() {
  //echo message to screen
  client.sendCommand("#echo " + message);
}, ms);
```

### Emulate #wait command from zMUD/cMUD

```javascript
setTimeout(()=> {
  //send a command to the mud
  client.sendCommand("say Hello world.");
}, 2000);
//wait additional time to say it again
setTimeout(()=> {
  //send a command to the mud
  client.sendCommand("say Hello world again");
}, 4000);
//notice the timing is 4000 this is 2000 from the original + 2000 for the new for a total of 4 seconds
//Unlike zMUD where timing is build up, with javascript you will have to handle your own consecutive timing
```

#### Mono grayscale rainbow text alias

```javascript
/*
Start mono gray-scale rainbow example

syntax: monoline [line] [text]

to use this alias in OoMUD, create a new alias named monoline, set the style to Script
and ensure append arguments is checked
*/
//the line to display text on
var line = arguments[1];
//new string
var str = '';
//colors to use
var colors = [];
//random start
var offset = Math.ceil(Math.random()*1000);
//build color list
for(var i=0; i < 20; i++)
{
  if(3+i < 10)
    colors[i] = '%^mono0'+(3+i)+'%^';
  else
    colors[i] = '%^mono'+(3+i)+'%^';
  if(23-i < 10)
    colors[i+20] = '%^mono0'+(23-i)+'%^';
  else
    colors[i+20] = '%^mono'+(23-i)+'%^';
}

//start at arguments 2 since 0 is full line, and 1 is the line,
//so any thing after 2 is the text we want
var args = Array.prototype.slice.call(arguments);
var oldStr = args.slice(2).join(' ');

for(var c = 0; c < oldStr.length;c++)
{
  var i = (c + offset) % colors.length;
  str += colors[i]+oldStr.charAt(c);
}
this.sendCommand(line + ' ' + str);
//End mono grayscale example
```

### Rainbow 256 color say alias

```javascript
/*
Start Rainbow 256 example

syntax: rs [text]

to use this alias, create a new alias named rs, set the style to Script
and ensure append arguments is checked and past this in the value
*/
//the string to send to the mud
var out = '';
//counter variable for looping
var i;
//build table once and store to speed up
if(!window.forecolors256)
{
  //initialize color table
   window.forecolors256 = [];
   for(i=0; i<30; i++)
      window.forecolors256.push([0,0,0]); //set each color to [R,G,B] array for manipulation
   //build rainbow colors
   for(i=0; i<5; i++)
   {
      /*0-4*/ window.forecolors256[i][0]+=5; window.forecolors256[i][1]+=i+1;
      /*5-9*/ window.forecolors256[i+5][0]+=4-i; window.forecolors256[i+5][1]+=5;
      /*10-14*/ window.forecolors256[i+10][1]+=5; window.forecolors256[i+10][2]+=i+1;
      /*15-19*/ window.forecolors256[i+15][1]+=4-i; window.forecolors256[i+15][2]+=5;
      /*20-24*/ window.forecolors256[i+20][2]+=5; window.forecolors256[i+20][0]+=i+1;
      /*25-29*/ window.forecolors256[i+25][0]+=5; window.forecolors256[i+25][2]+=4-i;
   }
   //Build final color codes using the R,G,B array
   window.forecolors256 = window.forecolors256.map(c => `%^RGB${c[0]}${c[1]}${c[2]}%^`);
}
//random color offset
var offset=Math.ceil(Math.random()*1000);
//build the string, this ensures all arguments are gotten
var args = Array.prototype.slice.call(arguments);
//start at the first argument as 0 is the alias + arguments, and convert to an array
var str = [...args.slice(1).join(' ')];
//store length for a little extra speed
var l = str.length;
//loop array and build new string inserting color codes
for(i=0; i<l; i++)
{
   var i2= (i+offset) % window.forecolors256.length;
   out += window.forecolors256[i2]+str[i];
}
client.sendCommand("'%^RESET%^"+out+"%^DEFAULT%^");
```