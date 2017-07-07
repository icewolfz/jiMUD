# Immortal tools

Immortal tools allow wizards and other immortals to manage files. It provides a basic interface to browse, download, and upload files and common commands and features to make it easier to develop.

## Preferences
### General
- `Sync folders while browsing` this will attempt to change local or remote path to match the one that was changed
- `Show queue and log` toggles the display of the queue and log tabs
- `Upload files when changed` this will cause any file that has been changed in the current local folder to be automatically uploaded to the current remote folder
- `Open file in editor` this causes any file that is downloaded to automaticly be opened in default or provided editor
- `Path to editor` this is a path to the editor you want to open files in instead default
### Window
- `Always on top of parent` causes window to remain on top of main client
- `Always on top of all` causes window to be on top of all windows
- `Persistent` will attempt to reload tools when client is loaded
### Advanced
- `Buffer Size` upload buffer size, Buffer size will revert to server if size greater then server
- `Temporary type when downloading` determine how files are downloaded
  - `None` directly override current file
  - `Extension` append '.tmp' extension to current name, when download complete copy over original then remote temporary file.
  - `File` will create a standard OS temporary file, when download complete will copy over original then remote temporary file.
- `Show hidden files` this will toggle weather to show system hidden files, those files that start with a . or have the hidden attribute set
- `Enable debugging` out put debugging data to the web console
- `Log errors` log all errors to log file

## Known Issues
- Dragging multiple files and dropping outside to other applications will only drop the first file, all others ignored. This is a limitation of electron drag and drop support, until it is added it can not be supported outside of application  
- Queue pausing, The remote server only allows 2 uploads and 2 downloads at once, if you pause active upload or downloads you will receive in progress errors.