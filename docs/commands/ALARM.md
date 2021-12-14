# #ALARM

## <u>ALA</u>RM

### **Syntax:** #ALA *name* {time pattern} {commands} *profile*
> Create or alter an alarm trigger

### **Related:** [#SUSPEND](SUSPEND.md), [#RESUME](RESUME.md), [#TRIGGER](TRIGGER.md), [$UNTRIGGER](UNTRIGGER.md)

#### **Arguments:**
- name - optional name of alarm to alter
- {time pattern} - The time pattern to trigger on
- {command} - The commands to execute when alarm triggers
- *profile* - The optional profile to create or update in, if not supplied defaults to current active profile

#### **Alarm time pattern**
```
    When using alarm type pattern is in the format of hours:minutes:seconds, where hours and minutes are optional. A asterisk (*) is a wildcard to match any value for that place, if minutes or hours are missing a * is assumed. If pattern is preceded with a minus (-) the connection time is used instead of current time.

    You can also define a temporary, one time alarm if pattern is preceded with a plus (+), the trigger alarm is executed then deleted.

    Hours are defined in 24 hour format of 0 to 23, minutes and seconds are 0 to 59.
    If seconds are > 59 and the only pattern it will be considered the same as adding a wildcard (*) in front of the number.

    Hours, minutes, and seconds can use a special wildcard format of *value which will match when the time MOD is zero, eg: *10 matches 10, 20, ...
```
### **Examples:**
`#ALARM {-30:00} {save}`
> Executes the save command every 30 minutes 

`#ALARM {+5} {save}`
> Executes the save command every 5 seconds