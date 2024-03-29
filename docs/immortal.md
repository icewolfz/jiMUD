# Immortal tools

Immortal tools allow wizards and other immortals to manage files. It provides a basic interface to browse, download, and upload files and common commands and features to make it easier to develop.

## Remote commands

- `backup` Run the remote file backup command for selected files
- `goto`  goto to the first selected file in list
- `dest` dest all core loaded object for selected files
- `Change to directory` change to current directory to first selected file path or folder.
- `update` update all selected files
- `renew` renew all selected files
- `clone` clone all selected files
- `copy full path` copy all selected files to a newline delimited string
- `edit...` edit remote file with internal editor, once open can edit and save from editor with out the need to upload in tools

**Note:** All remote commands are executed as normal commands as if sent from client command line but for copy full path

## Queue

- `Start` will start selected paused items
- `Pause` will pause selected items
- `Stop` will stop and remove selected items
- `Reset all` will reset all current upload and download operations

## Drag and drop

You may drag files from local to queue or remote list to upload, from remote to local or queue to download. You may drop files from outside the application on local, remote, or queue. When dropping files on local list from the local system it will perform a move if file/folder does not exist otherwise it will create a copy with an appended (#).

**Note:** if dropped from local system on queue it will be considered an upload to remote.

## Preferences

### General

- `Sync folders while browsing` this will attempt to change local or remote path to match the one that was changed
- `Show queue and log` toggles the display of the queue and log tabs
- `Upload files when changed` this will cause any file that has been changed in the current local folder to be automatically uploaded to the current remote folder
- `Focus files on finish upload/download` will focus on the item in local if downloaded, or remote if uploaded
- `Select files on finish upload/download` select item in local if downloaded, or remote if uploaded
- `Enable compression` receive and send files compressed to try and improve upload/download speeds

### File overwrite

- `Action` The action to preform
  - `Overwrite` Overwrite the exiting file
  - `Overwrite if source newer` Only overwrite if the source file date is newer then target file date
  - `Overwrite if different sizes` Only overwrite if source and target file sizes are different
  - `Overwrite if source newer or different sizes` Only overwrite if the source file date is newer then target file date or file sizes are different
  - `Rename` Auto rename the target file to a none existing file name by appending a unique # to the name
  - `Skip` Skip the file
- `Apply` How the actions are applied
  - `Just this file` Will only apply action to this file and will ask for any additional existing files
  - `Always` Always use this action and never option dialog
  - `Just for this queue` Will apply the action to the current batch upload or download

### Editor

- `Open file in editor` this causes any file that is downloaded to automatically be opened in internal or external editor
- `Open file in external editor` this causes any file that is downloaded to automatically be opened in default or provided editor if open file in editor is enabled
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

- Dragging multiple files and dropping outside to other applications/windows will only drop the first file, all others ignored. This is a limitation of electron drag and drop support, until it is added it can not be supported outside of application
- Queue pausing, The remote server only allows 2 uploads and 2 downloads at once, if you pause active upload or downloads you will receive in progress errors.