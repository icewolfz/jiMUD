# #WAIT

## <u>WA</u>IT

### **Syntax:** #WA amount
> Pause current block for a number of milliseconds

#### **Arguments:**
- amount - The amount of time to wait in milliseconds

### **Examples:**
`#showp hello;#wa 1009;#sh  world`
> Will display hello as a prompt, wait 1 second then append world, for a final display of hello world

`#5 {#wait ${i * 1000};#sh %i}`
>Will count from 1 to 5, displaying current count every second