# jiMUD

A mud client using electron for [ShadowMUD](http://www.shadowmud.com) based on it's web client.

## FAQ
Basic questions answered about jiMUD
- [jiMUD FAQ](docs/faq.md)

## References
- [Speedpaths](docs/speedpaths.md)
- [Commands](docs/commands.md)
- [Preferences](docs/preferences.md)
- [Scripting](docs/scripting.md)
- [Profiles](docs/profiles.md)
- [Customizing](docs/customizing.md)
- [Assets](docs/assets.md)

## Known Issues
- Advanced editor 
  - Paste may lose some colors/background colors on pasted, this is a bug in TinyMCE editor
  - When apply styles to all text some styles may get stuck  
  - Some styles will not flash when flashing is enabled depending on order of styles applied
  - Toolbar text/background color picker may be cut off in small window sizes
  - Reverse style has wierd results with heavy nesting of reverse tags and colors, suggest to just use normal background colors.