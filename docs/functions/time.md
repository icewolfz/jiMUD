# time

### **Syntax:** time(format)
> Display current time in format, if format omitted displays YYYY-MM-DDTHH:mm:ss[Z]

#### **Arguments:**

- format - The format to display the time as
  - `YYYY` 4 or 2 digit year
  - `YY` 2 digit year
  - `Y` Year with any number of digits and sign
  - `Q` Quarter of year. Sets month to first month in quarter.
  - `M MM` Month number
  - `MMM MMMM` Month name in locale set by moment.locale()
  - `D DD` Day of month
  - `Do` Day of month with ordinal
  - `DDD DDDD` Day of year
  - `X` Unix timestamp
  - `x` Unix ms timestamp

### **Examples:**

`${time(MM/DD/YYYY)}`
>Displays current Mouth/Day/Year

`%{time(x)}`
>Displays the current date as a ms timestamp