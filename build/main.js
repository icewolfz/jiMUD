//spell-checker:words submenu, pasteandmatchstyle, statusvisible, taskbar, colorpicker, mailto, forecolor, tinymce, unmaximize
//spell-checker:ignore prefs, partyhealth, combathealth, commandinput, limbsmenu, limbhealth, selectall, editoronly, limbarmor, maximizable, minimizable
//spell-checker:ignore limbsarmor, lagmeter, buttonsvisible, connectbutton, charactersbutton, Editorbutton, zoomin, zoomout, unmaximize, resizable
const { app, BrowserWindow, BrowserView, shell, screen, Tray, dialog, Menu, MenuItem, ipcMain, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const settings = require('./js/settings');
const { TrayClick } = require('./js/types');
const { Menubar } = require('./js/menubar');
const { Characters } = require('./js/characters');

require('@electron/remote/main').initialize()

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let argv;

//check if previous command line arguments where stored load and use those instead
if (isFileSync(path.join(app.getPath('userData'), 'argv.json'))) {
    argv = fs.readFileSync(path.join(app.getPath('userData'), 'argv.json'), 'utf-8');
    try {
        argv = JSON.parse(argv);
        //make sure using correct execute path
        argv[0] = process.argv[0];
    }
    catch (e) {
        logError(e);
        argv = process.argv;
    }
    //remove file as no longer needed
    fs.unlink(path.join(app.getPath('userData'), 'argv.json'), err => {
        if (err)
            logError(err);
    });
}
else //not found use native
    argv = process.argv;

argv = require('yargs-parser')(argv, {
    string: ['data-dir', 's', 'setting', 'm', 'map', 'c', 'character', 'pf', 'profiles', 'l', 'layout'],
    boolean: ['h', 'help', 'v', 'version', 'no-pd', 'no-portable-dir', 'disable-gpu', 'd', 'debug', '?', 'il', 'ignore-layout'],
    alias: {
        'd': ['debug'],
        'eo': ['editorOnly', 'editoronly'],
        'h': ['help', '?'],
        'v': ['version'],
        'no-pd': ['no-portable-dir'],
        's': ['settings'],
        'm': ['map'],
        'c': ['character', 'char'],
        'pf': ['profiles'],
        'e': ['editor'],
        'l': ['layout'],
        'il': ['ignore-layout']
    },
    configuration: {
        'short-option-groups': false
    }
});

if (argv['data-dir'] && argv['data-dir'].length > 0)
    app.setPath('userData', argv['data-dir']);
else if (process.env.PORTABLE_EXECUTABLE_DIR && !argv['no-pd'] && !argv['no-portable-dir'])
    app.setPath('userData', process.env.PORTABLE_EXECUTABLE_DIR);

app.setAppUserModelId('jiMUD');

if (!process.env.PORTABLE_EXECUTABLE_DIR) {
    if (argv._.indexOf('/?') !== -1 || argv.h) {
        console.log('-h, --help                          Print console help');
        console.log('-d, --debug                         Enable dev tools for all windows');
        console.log('-s=[file], --setting=[file]         Override default setting file');
        console.log('-m=[file], --map=[file]             Override default map file');
        console.log('-c=[name], --character=[name]       Allows you to load/create a character from character database');
        console.log('-pf=[list], --profiles[]            Set which profiles will be enabled, if not found will default');
        console.log('-v, --version                       Print current version');
        console.log('-e, --e, -e=[file], --e=[file]      Open code editor with current/new client');
        console.log('-eo, --eo, -eo=[file], --eo=[file]  Open only the code editor');
        console.log('-no-pd, -no-portable-dir            Do not use portable dir');
        console.log('-data-dir=[file]                    Set a custom directory to store saved data');
        console.log('-l=[file], --layout=[file]          Load window layout file');
        console.log('-il, --ignore-layout                Ignore layout and do not save window states');
        app.quit();
        return;
    }
    else if (argv.v) {
        console.log(`jiMUD v${require('../package.json').version}`);
        app.quit();
        return;
    }
}

Menu.setApplicationMenu(null);

global.settingsFile = parseTemplate(path.join('{data}', 'settings.json'));
let set = settings.Settings.load(global.settingsFile);
global.debug = false;
global.editorOnly = false;
global.updating = false;

let _layout = parseTemplate(path.join('{data}', 'window.layout'));;

let clients = {}
let windows = {};
let states = {};
let focusedClient = 0;
let focusedWindow = 0;
let _clientID = 0;
let _windowID = 0;
const idMap = new Map();
let _saved = false;
let _loaded = false;
const _characters = new Characters({ file: path.join(parseTemplate('{data}'), 'characters.sqlite') });

if (isFileSync(path.join(app.getPath('userData'), 'characters.json'))) {
    let oldCharacters = fs.readFileSync(path.join(app.getPath('userData'), 'characters.json'), 'utf-8');
    try {
        //data try and convert and then import any found data
        if (oldCharacters && oldCharacters.length > 0) {
            oldCharacters = JSON.parse(oldCharacters);
            for (title in oldCharacters.characters) {
                if (!Object.prototype.hasOwnProperty.call(oldCharacters.characters, title))
                    continue;
                const character = oldCharacters.characters[title];
                _characters.addCharacter({
                    Title: title,
                    Port: character.dev ? 1035 : 1030,
                    AutoLoad: oldCharacters.load === title,
                    Disconnect: character.disconnect,
                    UseAddress: false,
                    Days: 0,
                    Name: character.name,
                    Password: character.password,
                    Preferences: character.settings,
                    Map: character.map,
                    TotalMilliseconds: 0,
                    TotalDays: 0,
                    LastConnected: 0,
                });
            }
            oldCharacters = null;
            _characters.save();
        }
        // Rename the file old file as no longer needed just in case
        fs.rename(path.join(app.getPath('userData'), 'characters.json'), path.join(app.getPath('userData'), 'characters.json.bak'), (err) => {
            if (err)
                logError(err);
        });
    }
    catch (e) {
        logError(e);
    }
}

process.on('uncaughtException', (err) => {
    logError(err);
});

function addInputContext(window, spellcheck) {
    window.webContents.on('context-menu', (e, props) => {
        const { selectionText, isEditable } = props;
        if (isEditable) {
            const inputMenu = Menu.buildFromTemplate([
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { type: 'separator' },
                { role: 'selectAll' },
            ]);
            if (global.debug) {
                inputMenu.append(new MenuItem({ type: 'separator' }));
                inputMenu.append(new MenuItem({
                    label: 'Inspect',
                    x: props.x,
                    y: props.y,
                    click: (item, mWindow) => {
                        mWindow.webContents.inspectElement(item.x, item.y);
                    }
                }));
            }
            if (spellcheck && props.dictionarySuggestions.length) {
                inputMenu.insert(0, new MenuItem({ type: 'separator' }));
                for (var w = props.dictionarySuggestions.length - 1; w >= 0; w--) {
                    inputMenu.insert(0, new MenuItem({
                        label: props.dictionarySuggestions[w],
                        x: props.x,
                        y: props.y,
                        sel: props.selectionText.length - props.misspelledWord.length,
                        idx: props.selectionText.indexOf(props.misspelledWord),
                        word: props.misspelledWord,
                        click: (item, mWindow) => {
                            executeScript(`(function spellTemp() {
                                var el = $(document.elementFromPoint(${item.x}, ${item.y}));
                                var value = el.val();
                                var start = el[0].selectionStart;
                                var wStart = start + ${item.idx};
                                value = value.substring(0, wStart) + '${item.label}' + value.substring(wStart + ${item.word.length});
                                el.val(value);
                                el[0].selectionStart = start;
                                el[0].selectionEnd = start + ${item.label.length + item.sel};
                                if(typeof windowType === 'undefined' || windowType() !== 'codeEditor') el.blur();
                                el.focus();
                            })();`, mWindow, true);
                        }
                    }));
                }
            }
            inputMenu.popup({ window: window });
        } else if (selectionText && selectionText.trim() !== '') {
            Menu.buildFromTemplate([
                { role: 'copy' },
                { type: 'separator' },
                { role: 'selectAll' },
            ]).popup({ window: window });
        }
    });
}

//id, data, file, title, icon
function createWindow(options) {
    options = options || {};
    var bounds;
    if (!options.file || options.file.length === 0)
        options.file = 'manager.html';
    if (options.data && options.data.state)
        bounds = options.data.state.bounds;
    else if (states[options.file])
        bounds = states[options.file].bounds;
    else
        bounds = {
            x: 0,
            y: 0,
            width: 800,
            height: 600,
        };
    // Create the browser window.
    let window = new BrowserWindow({
        title: options.title || 'jiMUD',
        x: getWindowX(bounds.x, bounds.width),
        y: getWindowY(bounds.y, bounds.height),
        width: bounds.width,
        height: bounds.height,
        backgroundColor: '#000',
        show: false,
        icon: path.join(__dirname, options.icon || '../assets/icons/png/64x64.png'),
        skipTaskbar: !set.showInTaskBar ? true : false,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: set ? set.spellchecking : false,
            enableRemoteModule: true,
            contextIsolation: false,
            backgroundThrottling: set ? set.enableBackgroundThrottling : true
        },
        //titleBarStyle: 'hidden',
        //titleBarOverlay: true
    });
    require("@electron/remote/main").enable(window.webContents);

    // and load the file of the app.
    window.loadURL(url.format({
        pathname: path.join(__dirname, options.file),
        protocol: 'file:',
        slashes: true
    }));

    window.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!window)
                return;
            if (result.response === 0) {
                window.reload();
                logError('Window unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                logError('Window unresponsive, closed.\n', true);
                window.destroy();
            }
            else
                logError('Window unresponsive, waiting.\n', true);
        });
    });

    window.on('focus', () => {
        focusedWindow = getWindowId(window);
        window.webContents.send('focus');
    });

    window.on('blur', () => {
        if (window && !window.isDestroyed() && window.webContents)
            window.webContents.send('blur');
    });

    window.on('minimize', () => {
        if (set.hideOnMinimize)
            window.hide();
    });

    window.webContents.on('render-process-gone', (event, details) => {
        logError(`Client render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    window.webContents.on('devtools-reload-page', () => {
        window.webContents.once('dom-ready', () => {
            const windowId = getWindowId(window);
            const cl = windows[windowId].clients.length;
            for (var idx = 0; idx < cl; idx++) {
                window.webContents.send('new-client', { id: windows[windowId].clients[idx], current: windows[windowId].current === windows[windowId].clients[idx] });
                clients[windows[windowId].clients[idx]].view.webContents.send('window-reloaded');
            }
            window.webContents.send('switch-client', windows[windowId].current);
        });
    });

    window.webContents.setWindowOpenHandler((details) => {
        var u = new url.URL(details.url);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
            shell.openExternal(details.url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: buildOptions(details, window, set)
        }
    });

    window.webContents.on('did-create-window', (childWindow, details) => {
        let frameName = details.frameName;
        let url = details.url;
        let file = url;
        if (url.startsWith('file:///' + __dirname.replace(/\\/g, '/')))
            file = url.substring(__dirname.length + 9);
        require("@electron/remote/main").enable(childWindow.webContents);
        childWindow.removeMenu();
        childWindow.once('ready-to-show', () => {
            loadWindowScripts(childWindow, frameName);
            addInputContext(childWindow, set && set.spellchecking);
            childWindow.show();
        });
        childWindow.webContents.on('render-process-gone', (event, details) => {
            logError(`${url} render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
        });
        childWindow.on('unresponsive', () => {
            dialog.showMessageBox({
                type: 'info',
                message: 'Unresponsive',
                buttons: ['Reopen', 'Keep waiting', 'Close']
            }).then(result => {
                if (!childWindow)
                    return;
                if (result.response === 0) {
                    childWindow.reload();
                    logError(`${url} unresponsive, reload.\n`, true);
                }
                else if (result.response === 2) {
                    childWindow.destroy();
                }
                else
                    logError(`${url} unresponsive, waiting.\n`, true);
            });
        });

        childWindow.on('resize', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('move', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('maximize', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('unmaximize', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('resized', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('closed', () => {
            if (window && !window.isDestroyed()) {
                executeScriptClient(`if(typeof childClosed === "function") childClosed('${url}', '${frameName}');`, window, true);
            }
        });
        childWindow.on('close', () => {
            states[file] = saveWindowState(childWindow);
        })
    });

    // Emitted when the window is closed.
    window.on('closed', () => {
        const windowId = getWindowId(window);
        idMap.delete(window);
        const cl = windows[windowId].clients.length;
        for (var idx = 0; idx < cl; idx++) {
            const id = windows[windowId].clients[idx];
            //close any child windows linked to view
            closeClientWindows(id);
            if (!window.isDestroyed())
                window.removeBrowserView(clients[id].view);
            idMap.delete(clients[id].view);
            clients[id].view.webContents.destroy();
            clients[id] = null;
            delete clients[id];
        }
        windows[windowId].window = null;
        delete windows[windowId];
        clientsChanged();
    });

    window.once('ready-to-show', () => {
        loadWindowScripts(window, 'manager');
        executeScript(`if(typeof setId === "function") setId(${getWindowId(window)});`, window);
        executeScript('if(typeof loadTheme === "function") loadTheme(\'' + set.theme.replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\');', window);
        if (options.data && options.data.data)
            executeScript('if(typeof restoreWindow === "function") restoreWindow(' + JSON.stringify(options.data.data) + ');', window);
        updateJumpList();
        checkForUpdates();
        if (options.data && options.data.state)
            restoreWindowState(window, options.data.state);
        else if (states[options.file])
            restoreWindowState(window, states[options.file]);
        else
            window.show();
    });

    //close hack due to electron's dumb ability to not allow a simple sync call to return a true/false state
    let _close = false;
    window.on('close', async (e) => {
        if (_close)
            return;
        e.preventDefault();
        //for what ever reason electron does not seem to work well with await, it sill continues to execute async instead of waiting when using ipcrender
        _close = await canCloseAllClients(getWindowId(window));
        if (_close) {
            states[options.file] = saveWindowState(window);
            //if _loaded and not saved and the last window open save as its the final state
            if (_loaded && !_saved && Object.keys(windows).length === 1) {
                await saveWindowLayout();
                _saved = true;
            }
            window.close();
        }
    });

    window.on('resize', () => {
        states[options.file] = saveWindowState(window);
    });

    window.on('move', () => {
        states[options.file] = saveWindowState(window);
    });

    window.on('restore', () => {
        getActiveClient(window).view.webContents.send('restore');
        states[options.file] = saveWindowState(window);
    });
    window.on('maximize', () => {
        getActiveClient(window).view.webContents.send('maximize');
        states[options.file] = saveWindowState(window);
    });
    window.on('unmaximize', () => {
        getActiveClient(window).view.webContents.send('unmaximize');
        states[options.file] = saveWindowState(window);
    });

    window.on('resized', () => {
        getActiveClient(window).view.webContents.send('resized');
        states[options.file] = saveWindowState(window);
    });
    if (!options.id) {
        _windowID++;
        //in case the new id is used from old layout loop until find empty id
        while (windows[_windowID])
            _windowID++;
        options.id = _windowID;
    }
    windows[options.id] = { window: window, clients: [], current: 0, menubar: options.menubar };
    if (options.menubar)
        options.menubar.window = window;
    idMap.set(window, options.id);
    return options.id;
}

function createDialog(options) {
    if (!options)
        options = {};
    options.parent = options.parent || getActiveWindow();
    const bounds = options.parent.getBounds();
    //check coords first as x and y could be 0 and that returns false
    if (!('x' in options))
        options.x = Math.floor(bounds.x + bounds.width / 2 - (options.width || 500) / 2);
    if (!('y' in options))
        options.y = Math.floor(bounds.x + bounds.width / 2 - (options.width || 560) / 2);
    const window = new BrowserWindow({
        parent: options.parent,
        modal: false,
        x: options.x,
        y: options.y,
        width: options.width || 500,
        height: options.height || 560,
        movable: options.model ? false : true,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        resizable: options.model ? false : (options.resize || false),
        title: options.title || 'jiMUD',
        icon: options.icon || path.join(__dirname, '../assets/icons/png/64x64.png'),
        webPreferences: {
            nodeIntegration: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: set ? set.spellchecking : false,
            enableRemoteModule: true,
            contextIsolation: false,
            backgroundThrottling: set ? set.enableBackgroundThrottling : true
        }
    });
    require("@electron/remote/main").enable(window.webContents);
    window.webContents.on('render-process-gone', (event, details) => {
        logError(`About render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    window.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!window)
                return;
            if (result.response === 0) {
                window.reload();
                logError('Dialog unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                window.destroy();
            }
            else
                logError('Dialog unresponsive, waiting.\n', true);
        });
    });

    window.removeMenu();
    // and load the index.html of the app.
    window.loadURL(url.format({
        pathname: options.url || path.join(__dirname, 'blank.html'),
        protocol: 'file:',
        slashes: true
    }));

    window.once('ready-to-show', () => {
        if (options.show)
            window.show();
    });
    return window;
}

if (argv['disable-gpu'])
    app.disableHardwareAcceleration();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    if (!existsSync(path.join(app.getPath('userData'), 'characters')))
        fs.mkdirSync(path.join(app.getPath('userData'), 'characters'));

    var a, al;
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
        if (argv._.indexOf('/?') !== -1 || argv.h) {
            var msg = '';
            msg += '-h, --help - Print console help\n';
            msg += '-d, --debug - Enable dev tools for all windows\n';
            msg += '-s=[file], --setting=[file] - Override default setting file\n';
            msg += '-m=[file], --map=[file] - Override default map file\n';
            msg += '-c=[name], --character=[name] - Allows you to load/create a character from character database\n';
            msg += '-pf=[list], --profiles[] - Set which profiles will be enabled, if not found will default\n';
            msg += '-v, --version - Print current version\n';
            msg += '-e, --e, -e=[file], --e=[file] - Open code editor with current/new client\n';
            msg += '-eo, --eo, -eo=[file], --eo=[file] - Open only the code editor\n';
            msg += '-no-pd, -no-portable-dir - Do not use portable dir\n';
            msg += '-data-dir=[file] - Set a custom directory to store saved data\n';
            msg += '-l=[file], --layout=[file] - Load window layout file';
            msg += '-il, --ignore-layout - Ignore layout and do not save window states';
            dialog.showMessageBox({
                type: 'info',
                message: msg
            });
            console.log('-h, --help                          Print console help');
            console.log('-d, --debug                         Enable dev tools for all windows');
            console.log('-s=[file], --setting=[file]         Override default setting file');
            console.log('-m=[file], --map=[file]             Override default map file');
            console.log('-c=[name], --character=[name]       Allows you to load/create a character from character database');
            console.log('-pf=[list], --profiles[]            Set which profiles will be enabled, if not found will default');
            console.log('-v, --version                       Print current version');
            console.log('-e, --e, -e=[file], --e=[file]      Open code editor with current/new client');
            console.log('-eo, --eo, -eo=[file], --eo=[file]  Open only the code editor');
            console.log('-no-pd, -no-portable-dir            Do not use portable dir');
            console.log('-data-dir=[file]                    Set a custom directory to store saved data');
            console.log('-l=[file], --layout=[file]          Load window layout file');
            console.log('-il, --ignore-layout                Ignore layout and do not save window states');
            app.quit();
            return;
        }
        else if (argv.v) {
            dialog.showMessageBox({
                type: 'info',
                message: `jiMUD v${require('../package.json').version}`
            });
            console.log(`jiMUD v${require('../package.json').version}`);
            app.quit();
            return;
        }
    }

    global.debug = argv.debug;
    if (argv.eo) {
        if (Array.isArray(argv.eo)) {
            al = argv.eo.length;
            a = 0;
            for (; a < al; a++) {
                if (typeof argv.eo[a] === 'string')
                    openEditor(argv.eo[a]);
            }
        }
        else if (typeof argv.eo === 'string') {
            openEditor(argv.eo);
        }
        global.editorOnly = true;
    }

    if (Array.isArray(argv.s))
        global.settingsFile = parseTemplate(argv.s[0]);
    else if (argv.s)
        global.settingsFile = parseTemplate(argv.s);

    if (Array.isArray(argv.l))
        _layout = parseTemplate(argv.l[0]);
    else if (argv.l)
        _layout = argv.l;

    if (global.editorOnly) {
        //showCodeEditor();
    }
    else {
        //use default
        let _ignore = false;
        //attempt to load layout, 
        if (isFileSync(_layout)) {
            if (!argv.il)
                _loaded = loadWindowLayout(_layout);
        }
        else if (!argv.il)
            _ignore = true;

        //if it fails load default window
        if (!_loaded) {
            //use default unless ignoring layouts
            _loaded = _ignore;
            let windowId = createWindow({ menubar: createMenu() });
            let window = windows[windowId].window;
            let id = createClient({ bounds: window.getContentBounds() });
            focusedWindow = windowId;
            focusedClient = id;
            windows[windowId].clients.push(id);
            windows[windowId].current = id;
            clients[id].parent = window;
            //window.setBrowserView(clients[id].view);
            window.addBrowserView(clients[id].view);
            window.setTopBrowserView(clients[id].view);
            //clients[id].menu.window = window;
            //window.setMenu(clients[id].menu);
            focusWindow(window, true);
            clients[id].view.webContents.once('dom-ready', clientsChanged);
            window.webContents.once('dom-ready', () => {
                window.webContents.send('new-client', { id: id });
            });
            //only load after as it requires a client window
            if (argv.e) {
                //showCodeEditor();
                if (Array.isArray(argv.e)) {
                    al = argv.eo.length;
                    a = 0;
                    for (; a < al; a++) {
                        if (typeof argv.eo[a] === 'string')
                            openEditor(argv.eo[a]);
                    }
                }
                else if (typeof argv.e === 'string') {
                    openEditor(argv.e);
                }
            }
        }
    }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (Object.keys(windows).length === 0) {
        //use default
        let _ignore = false;
        //attempt to load layout, 
        if (isFileSync(_layout)) {
            if (!argv.il)
                _loaded = loadWindowLayout(_layout);
        }
        else if (!argv.il)
            _ignore = true;

        //if it fails load default window
        if (!_loaded) {
            //use default unless ignoring layouts
            _loaded = _ignore;
            let windowId = createWindow({ menubar: createMenu() });
            let window = windows[windowId].window;
            let id = createClient({ bounds: window.getContentBounds() });
            focusedWindow = windowId;
            focusedClient = id;
            windows[windowId].clients.push(id);
            windows[windowId].current = id;
            clients[id].parent = window;
            window.addBrowserView(clients[id].view);
            window.setTopBrowserView(clients[id].view);
            //clients[id].menu.window = mWindow;
            //window.setMenu(clients[id].menu);
            focusWindow(window, true);
            clients[id].view.webContents.once('dom-ready', clientsChanged);
            window.webContents.once('dom-ready', () => {
                window.webContents.send('new-client', { id: id });
            });
        }
    }
});

app.on('before-quit', async (e) => {
    if (!await canCloseAllWindows()) {
        e.preventDefault();
        return;
    }
    /*
    if (winProfiles) {
        e.preventDefault();
        dialog.showMessageBox(winProfiles, {
            type: 'warning',
            title: 'Close profile manager',
            message: 'You must close the profile manager before you can exit.'
        });
    }
    */
    //wait until save is done before continue just to be safe
    //only saved if not already been saved somewhere else and was loaded with no errors
    if (_loaded && !_saved) {
        await saveWindowLayout();
        _saved = true;
    }
});

ipcMain.on('log', (event, raw) => {
    console.log(raw);
});

ipcMain.on('log-error', (event, err, skipClient) => {
    logError(err, skipClient);
});

ipcMain.on('debug', (event, msg) => {
    let client = getActiveClient();
    if (client)
        client.webContents.send('debug', msg);
});

ipcMain.on('error', (event, err) => {
    let client = getActiveClient();
    if (client)
        client.webContents.send('error', err);
});

ipcMain.on('ondragstart', (event, files, icon) => {
    if (!files || files.length === 0) return;
    if (typeof (files) === 'string')
        event.sender.startDrag({
            file: files,
            icon: icon ? icon : path.join(__dirname, '../assets/icons/png/drag.png')
        });
    else if (files.length === 1)
        event.sender.startDrag({
            file: files[0],
            icon: icon ? icon : path.join(__dirname, '../assets/icons/png/drag.png')
        });
    else
        event.sender.startDrag({
            files: files,
            icon: icon ? icon : path.join(__dirname, '../assets/icons/png/drag.png')
        });
});

ipcMain.on('get-global', (event, key) => {
    switch (key) {
        case 'editorOnly':
            event.returnValue = global.editorOnly;
            break;
        case 'settingsFile':
            event.returnValue = global.settingsFile;
            break;
        case 'debug':
            event.returnValue = global.debug;
            break;
        case 'updating':
            event.returnValue = global.updating;
            break;
        case 'layout':
            event.returnValue = _layout;
            break;
        default:
            event.returnValue = null;
            break;
    }
});

ipcMain.on('set-global', (event, key, value) => {
    switch (key) {
        case 'editorOnly':
            global.editorOnly = value;
            break;
        case 'settingsFile':
            global.settingsFile = value;
            break;
        case 'debug':
            global.debug = value;
            break;
        case 'updating':
            global.updating = value;
            break;
    }
});

ipcMain.on('get-pid', (event) => {
    event.returnValue = process.pid;
});

ipcMain.on('get-system-color', (event, color) => {
    if (color === 'accent')
        event.returnValue = systemPreferences.getAccentColor();
    else
        event.returnValue = systemPreferences.getColor(color);
});

ipcMain.handle('get-app', async (event, key, ...args) => {
    switch (key) {
        case 'getAppMetrics':
            return app.getAppMetrics();
        case 'getPath':
            return app.getPath(...args);
        case 'addRecentDocument':
            app.addRecentDocument(...args);
            return null;
        case 'clearRecentDocuments':
            app.clearRecentDocuments();
            return null;
        case 'getFileIcon':
            return app.getFileIcon(...args);
        case 'getFileIconDataUrl':
            let icon = await app.getFileIcon(...args);
            return icon.toDataURL();
    }
    return null;
});

ipcMain.on('get-app-sync', async (event, key, ...args) => {
    switch (key) {
        case 'getPath':
            event.returnValue = app.getPath(...args);
            break;
        case 'addRecentDocument':
            app.addRecentDocument(...args);
            break;
        case 'clearRecentDocuments':
            app.clearRecentDocuments();
            break;
        case 'getFileIconDataUrl':
            let icon = await app.getFileIcon(...args);
            event.returnValue = icon.toDataURL();
            break;
    }
});

//#region IPC dialogs
ipcMain.on('show-dialog-sync', (event, type, ...args) => {
    var sWindow = BrowserWindow.fromWebContents(event.sender);
    if (type === 'showMessageBox')
        event.returnValue = dialog.showMessageBoxSync(sWindow, ...args);
    else if (type === 'showSaveDialog')
        event.returnValue = dialog.showSaveDialogSync(sWindow, ...args);
    else if (type === 'showOpenDialog')
        event.returnValue = dialog.showOpenDialogSync(sWindow, ...args);
});

ipcMain.handle('show-dialog', (event, type, ...args) => {
    return new Promise((resolve, reject) => {
        var sWindow = BrowserWindow.fromWebContents(event.sender);
        if (type === 'showMessageBox')
            dialog.showMessageBox(sWindow, ...args).then(resolve).catch(reject);
        else if (type === 'showSaveDialog')
            dialog.showSaveDialog(sWindow, ...args).then(resolve).catch(reject);
        else if (type === 'showOpenDialog')
            dialog.showOpenDialog(sWindow, ...args).then(resolve).catch(reject);
    });
});
//#endregion
//#region IPC Show context menu
ipcMain.on('show-context-sync', (event, template, options, show, close) => {
    showContext(event, template, options, show, close);
    event.returnValue = true;
});

ipcMain.handle('show-context', showContext);

function showContext(event, template, options, show, close) {
    if (!template)
        return;
    if (!options) options = {};
    options.window = BrowserWindow.fromWebContents(event.sender);
    if (options.callback) {
        var callback = options.callback;
        options.callback = () => event.sender.executeJavaScript(callback);
    }
    template.map((item, idx) => {
        if (typeof item.click === 'string') {
            var click = item.click;
            item.click = () => event.sender.executeJavaScript(click);
        }
        else
            item.click = () => event.sender.executeJavaScript(`executeContextItem(${idx}, "${item.id}", "${item.label}", "${item.role}");`);
    });
    var cMenu = Menu.buildFromTemplate(template);
    if (show)
        cMenu.on('menu-will-show', () => {
            event.sender.executeJavaScript(show);
        });
    if (close)
        cMenu.on('menu-will-close', () => {
            event.sender.executeJavaScript(close);
        });
    cMenu.popup(options);
}

//#endregion

ipcMain.on('trash-item', (event, file) => {
    if (!file)
        return;
    shell.trashItem(file).catch(err => logError(err));
});

ipcMain.on('trash-item-sync', async (event, file) => {
    await shell.trashItem(file).catch(err => logError(err));
    event.returnValue = true;
});

ipcMain.handle('window', (event, action, ...args) => {
    var current = BrowserWindow.fromWebContents(event.sender);
    if (!current || current.isDestroyed()) return;
    if (action === "focus")
        current.focus();
    else if (action === "hide")
        current.hide();
    else if (action === "minimize")
        current.minimize();
    else if (action === "close")
        current.close();
    else if (action === 'clearCache')
        return current.webContents.session.clearCache();
    else if (action === 'openDevTools')
        current.openDevTools();
    else if (action === 'show')
        current.show();
    else if (action === 'toggle') {
        if (current.isVisible()) {
            if (args[0])
                current.hide();
            else
                current.minimize();
        }
        else
            current.show();
    }
    else if (action === 'setEnabled')
        current.setEnabled(...args);
    else if (action === 'toggleDevTools') {
        if (current.isDevToolsOpened())
            current.closeDevTools();
        else
            current.openDevTools();
    }
    else if (action === 'reload')
        current.reload();
    else if (action === 'setIcon')
        current.setIcon(...args);
});

ipcMain.on('window-info', (event, info, id, ...args) => {
    if (info === "child-count") {
        var current = BrowserWindow.fromWebContents(event.sender);
        event.returnValue = current.getChildWindows().length;;
    }
    else if (info === 'child-open') {
        if (!args || args.length === 0) {
            event.returnValue = 0;
            return
        }
        var current = BrowserWindow.fromWebContents(event.sender);
        var wins = current.getChildWindows();
        for (var w = 0, wl = wins.length; w < wl; w++) {
            if (wins[w] === current || !wins[w].isVisible())
                continue;
            if (wins[w].getTitle().startsWith(args[0]) && wins[w].getParentWindow() === current) {
                event.returnValue = 1;
                return;
            }
        }
        event.returnValue = 0;
    }
    else if (info === 'child-close') {
        var current = BrowserWindow.fromWebContents(event.sender);
        var wins = current.getChildWindows();
        var count = 0;
        for (var w = 0, wl = wins.length; w < wl; w++) {
            if (wins[w] === current || !wins[w].isVisible())
                continue;
            if (args.length && !wins[w].getTitle().startsWith(args[0])) {
                //make sure proper close systems called
                for (let name in windows) {
                    if (!Object.prototype.hasOwnProperty.call(windows, name) || windows[name].window != wins[w])
                        continue;
                    executeCloseHooks(windows[name].window);
                    set.windows[name] = getWindowState(name, windows[name].window);
                    set.windows[name].options = copyWindowOptions(name);
                    windows[name].window = null;
                    delete windows[name];
                }
                wins[w].close();
                continue;
            }
            if (wins[w].getParentWindow() !== current)
                continue;
            count++;
        }
        event.returnValue = count;
    }
    else if (info === 'isVisible') {
        var current = BrowserWindow.fromWebContents(event.sender);
        event.returnValue = current ? current.isVisible() : 0;
    }
    else if (info === 'isEnabled') {
        var current = BrowserWindow.fromWebContents(event.sender);
        event.returnValue = current ? current.isEnabled() : 0;
    }
    else if (info === 'isDevToolsOpened') {
        var current = BrowserWindow.fromWebContents(event.sender);
        event.returnValue = current ? current.isDevToolsOpened() : 0;
    }
    else if (info === 'isMinimized') {
        var current = BrowserWindow.fromWebContents(event.sender);
        event.returnValue = current ? current.isMinimized() : 0;
    }
});

ipcMain.on('window-info-by-title', (event, title, info) => {
    var current = BrowserWindow.getAllWindows().filter(w => w.getTitle() === title);
    if (!current)
        event.returnValue = 0;
    else if (info === 'isVisible')
        event.returnValue = current ? current.isVisible() : 0;
    else if (info === 'isEnabled')
        event.returnValue = current ? current.isEnabled() : 0;
    else if (info === 'isDevToolsOpened')
        event.returnValue = current ? current.isDevToolsOpened() : 0;
    else if (info === 'isMinimized')
        event.returnValue = current ? current.isMinimized() : 0;
    else if (info === 'isDestroyed')
        event.returnValue = current ? current.isDestroyed() : 0;
});

ipcMain.on('inspect', (event, x, y) => {
    event.sender.inspectElement(x || 0, y || 0);
});

//#region Client creation, docking, and related management
ipcMain.on('new-client', (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    let id = createClient({ bounds: window.getContentBounds() });
    let windowId = getWindowId(window);
    windows[windowId].clients.push(id);
    clients[id].parent = window;
    window.webContents.send('new-client', { id: id });
    clients[id].view.webContents.once('dom-ready', clientsChanged);
});

ipcMain.on('switch-client', (event, id, offset) => {
    if (clients[id]) {
        const window = BrowserWindow.fromWebContents(event.sender);
        const windowId = getWindowId(window);
        if (window != clients[id].parent) {
            //@TODO probably wanting to dock from 1 window to another
            return;
        }
        const bounds = window.getContentBounds();
        clients[id].view.setBounds({
            x: 0,
            y: (offset || 0),
            width: bounds.width,
            height: bounds.height - offset
        });
        if (windowId === focusedWindow)
            focusedClient = id;
        if (windows[windowId].current && clients[windows[windowId].current])
            clients[windows[windowId].current].view.webContents.send('deactivated');
        windows[windowId].current = id;
        clients[id].view.webContents.send('activated');
        //window.setBrowserView(clients[id].view);
        window.setTopBrowserView(clients[id].view);
        //clients[id].menu.window = window;
        //window.setMenu(clients[id].menu);
        focusWindow(window, true);
    }
});

ipcMain.on('remove-client', (event, id) => {
    if (clients[id])
        removeClient(id, true);
});

ipcMain.on('reorder-client', (event, id, index, oldIndex) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    let windowId = getWindowId(window);
    const currentIdx = windows[windowId].clients.indexOf(id);
    if (currentIdx === -1)
        return;
    windows[windowId].clients.splice(currentIdx, 1);
    windows[windowId].clients.splice(index, 0, id);
});

ipcMain.on('dock-client', (event, id, options) => {
    if (!clients[id]) return;
    //tab from a different instant, can not transfer due to process structure
    if (options && 'pid' in options && options.pid !== process.pid) return;
    let window = BrowserWindow.fromWebContents(event.sender);
    let windowId = getWindowId(window);
    const oldWindow = clients[id].parent;
    const oldWindowId = getWindowId(oldWindow);
    //same window so trying to drag out so create new window
    if (window === oldWindow) {
        //if only one client no need for a new window so bail
        if (windows[oldWindowId].clients.length === 1) {
            if (options) {
                window.setPosition(options.x || 0, options.y || 0);
            }
            return;
        }
        //remove from old window
        oldWindow.removeBrowserView(clients[id].view);
        const oldIdx = windows[oldWindowId].clients.indexOf(id);
        windows[oldWindowId].clients.splice(oldIdx, 1);
        oldWindow.webContents.send('removed-client', id);
        states['manager.html'] = saveWindowState(oldWindow);
        //all views removed so close the window
        if (windows[oldWindowId].clients.length === 0)
            oldWindow.close();
        //options and we have a state use the new x/y
        if (options && states['manager.html']) {
            states['manager.html'].bounds.x = options.x || states['manager.html'].bounds.x;
            states['manager.html'].bounds.y = options.y || states['manager.html'].bounds.y;
        }
        windowId = createWindow({ menubar: createMenu() });
        window = windows[windowId].window;
        //no state so manually set the position
        if (options && !states['manager.html']) {
            window.setPosition(options.x || 0, options.y || 0);
        }
        focusedWindow = windowId;
        focusedClient = id;
        windows[windowId].clients.push(id);
        windows[windowId].current = id;
        clients[id].parent = window;
        //window.setBrowserView(clients[id].view);
        window.addBrowserView(clients[id].view);
        window.setTopBrowserView(clients[id].view);
        //clients[id].menu.window = window;
        //window.setMenu(clients[id].menu);
        window.webContents.once('dom-ready', () => {
            window.webContents.send('new-client', { id: id });
            focusWindow(window, true);
            clientsChanged();
        });
        return;
    }
    //remove from old window
    oldWindow.removeBrowserView(clients[id].view);
    const oldIdx = windows[oldWindowId].clients.indexOf(id);
    windows[oldWindowId].clients.splice(oldIdx, 1);
    oldWindow.webContents.send('removed-client', id);
    //all views removed so close the window
    if (windows[oldWindowId].clients.length === 0)
        oldWindow.close();
    //Add to new window
    if (options && typeof options.index !== 'undefined' && options.index !== -1 && options.index < windows[windowId].clients.length)
        windows[windowId].clients.splice(options.index, 0, id);
    else
        windows[windowId].clients.push(id);
    clients[id].parent = window;
    clients[id].parent.addBrowserView(clients[id].view);
    if (windowId === focusedWindow)
        focusedClient = id;
    if (windows[windowId].current && clients[windows[windowId].current])
        clients[windows[windowId].current].view.webContents.send('deactivated');
    windows[windowId].current = id;
    clients[id].view.webContents.send('activated');
    window.setTopBrowserView(clients[id].view);
    setClientWindowsParent(id, window, oldWindow);
    if (options)
        window.webContents.send('new-client', { id: id, index: options.index });
    else
        window.webContents.send('new-client', { id: id });
    focusWindow(window, true);
    clientsChanged();
    states['manager.html'] = saveWindowState(window);
});

ipcMain.on('position-client', (event, id, options) => {
    if (!clients[id]) return;
    let window = BrowserWindow.fromWebContents(event.sender);
    const oldWindow = clients[id].parent;
    const oldWindowId = getWindowId(oldWindow);
    if (options && window === oldWindow && windows[oldWindowId].clients.length === 1) {
        window.setPosition(options.x || 0, options.y || 0);
    }
});

ipcMain.on('focus-client', (event, id) => {
    if (!clients[id]) return;
    let window = BrowserWindow.fromWebContents(event.sender);
    focusClient(id);
});

ipcMain.on('execute-client', (event, id, code) => {
    if (clients[id])
        executeScript(code, clients[id]);
});

ipcMain.on('update-client', (event, id, offset) => {
    if (clients[id]) {
        offset = offset || 0;
        var bounds = BrowserWindow.fromWebContents(event.sender).getContentBounds();
        clients[id].view.setBounds({
            x: 0,
            y: offset,
            width: bounds.width,
            height: bounds.height - offset
        });
    }
});
//#endregion

//#region Quit/close related functions
ipcMain.on('quit', quitApp)

async function quitApp() {
    if (await canCloseAllWindows()) {
        if (_loaded && !_saved) {
            await saveWindowLayout();
            _saved = true;
        }
        app.quit();
    }
}

ipcMain.on('can-close-client', async (event, id) => {
    event.returnValue = await canCloseClient(id);
});

ipcMain.on('can-close-all-client', async (event) => {
    const close = await canCloseAllClients(getWindowId(BrowserWindow.fromWebContents(event.sender)));
    event.returnValue = close;
});

ipcMain.on('can-close-all-windows', async (event) => {
    event.returnValue = await canCloseAllWindows();
});
//#endregion
ipcMain.on('execute-main', (event, code) => {
    executeScript(code, win);
});

ipcMain.on('update-title', (event, options) => {
    const client = clientFromContents(event.sender);
    if (client) {
        client.parent.webContents.send('update-title', getClientId(clients[clientId].view), options);
        if (options && typeof options.icon === 'number') {
            //only update if the overlay changed
            if (client.overlay === options.icon) return;
            client.overlay = options.icon;
            updateIcon(client.parent);
        }
    }
});

//bounds, id, data, file
function createClient(options) {
    options = options || {};
    if (!options.file || options.file.length === 0)
        options.file = 'build/index.html';
    const view = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: set ? set.spellchecking : false,
            enableRemoteModule: true,
            contextIsolation: false,
            backgroundThrottling: set ? set.enableBackgroundThrottling : true
        }
    });

    view.webContents.on('context-menu', (e, params) => {
        view.webContents.send('context-menu', params);
    });

    view.webContents.on('focus', () => {
        focusedClient = getClientId(view);
    });

    view.webContents.on('devtools-reload-page', () => {
        view.webContents.once('dom-ready', () => {
            executeScript(`if(typeof setId === "function") setId(${getClientId(view)});`, clients[getClientId(view)].view);
        });
    });

    view.webContents.setWindowOpenHandler((details) => {
        var u = new url.URL(details.url);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
            shell.openExternal(details.url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: buildOptions(details, BrowserWindow.fromBrowserView(view), set)
        }
    });

    view.webContents.on('did-create-window', (childWindow, details) => {
        let frameName = details.frameName;
        let url = details.url;
        let file = url;
        if (url.startsWith('file:///' + __dirname.replace(/\\/g, '/')))
            file = url.substring(__dirname.length + 9);
        require("@electron/remote/main").enable(childWindow.webContents);
        childWindow.removeMenu();
        childWindow.once('ready-to-show', () => {
            loadWindowScripts(childWindow, frameName);
            addInputContext(childWindow, set && set.spellchecking);
            childWindow.show();
        });
        childWindow.webContents.on('render-process-gone', (event, details) => {
            logError(`${url} render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
        });
        childWindow.on('unresponsive', () => {
            dialog.showMessageBox({
                type: 'info',
                message: 'Unresponsive',
                buttons: ['Reopen', 'Keep waiting', 'Close']
            }).then(result => {
                if (!childWindow)
                    return;
                if (result.response === 0) {
                    childWindow.reload();
                    logError(`${url} unresponsive, reload.\n`, true);
                }
                else if (result.response === 2) {
                    childWindow.destroy();
                }
                else
                    logError(`${url} unresponsive, waiting.\n`, true);
            });
        });

        childWindow.on('resize', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('move', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('maximize', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('unmaximize', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('resized', () => {
            states[file] = saveWindowState(childWindow);
        });

        childWindow.on('closed', () => {
            if (view && view.webContents && !view.webContents.isDestroyed()) {
                executeScript(`if(typeof childClosed === "function") childClosed('${url}', '${frameName}');`, view, true);
            }
            //remove remove from list
            const id = getClientId(view);
            for (var idx = 0, wl = clients[id].windows.length; idx < wl; idx++) {
                if (clients[id].windows[idx].window !== childWindow) continue;
                clients[id].windows[idx] = null;
                clients[id].windows.splice(idx, 1);
                break;
            }
        });

        childWindow.on('close', () => {
            states[file] = saveWindowState(childWindow);
        });

        clients[getClientId(view)].windows.push({ window: childWindow, details: details });
    });

    view.setAutoResize({
        width: true,
        height: true
    })
    if (options.data && options.data.state) {
        view.setBounds(options.data.state.bounds);
        if (options.data.state.devTools || global.debug)
            view.webContents.openDevTools();
    }
    else {
        view.setBounds({
            x: 0,
            y: 0,
            width: options.bounds.width,
            height: options.bounds.height
        });
        if (global.debug)
            view.webContents.openDevTools();
    }
    //@TODO change to index.html once basic window system is working
    view.webContents.loadFile(options.file);
    require("@electron/remote/main").enable(view.webContents);
    if (!options.id) {
        _clientID++;
        //in case the new id is used from old layout loop until find empty id
        while (clients[_clientID])
            _clientID++;
        options.id = _clientID;
    }
    clients[options.id] = { view: view, windows: [], parent: null, file: options.file !== 'build/index.html' ? options.file : 0 };
    idMap.set(view, options.id);
    executeScript(`if(typeof setId === "function") setId(${options.id});`, clients[options.id].view);
    if (options.data)
        executeScript('if(typeof restoreWindow === "function") restoreWindow(' + JSON.stringify({ data: options.data.data, windows: options.data.windows }) + ');', clients[options.id].view);
    else
        executeScript('if(typeof restoreWindow === "function") restoreWindow({data: {}, windows: []});', clients[options.id].view);
    //win.setTopBrowserView(view)    
    //addBrowserView
    //setBrowserView  
    return options.id;
}

async function removeClient(id) {
    const client = clients[id];
    const cancel = await executeScript('if(typeof closeable === "function") closeable()', client.view);
    //dont close
    if (cancel !== true)
        return;
    //close client windows first incase they need parent window set
    closeClientWindows(id);
    const window = client.parent;
    const windowId = getWindowId(window);
    const idx = windows[windowId].clients.indexOf(id);
    windows[windowId].clients.splice(idx, 1);
    client.parent = null;
    delete client.parent;
    idMap.delete(client.view);
    //close the view
    executeCloseHooks(client.view);
    client.view.webContents.destroy();
    clients[id] = null;
    delete clients[id];
    window.webContents.send('removed-client', id);
    clientsChanged();
}

function closeClientWindows(id) {
    //@TODO add window state saving when possible
    //no windows so just bail
    if (clients[id].windows.length === 0) return;
    const wl = clients[id].windows.length;
    for (var idx = 0; idx < wl; id++) {
        const window = clients[id].windows[idx].window;
        //call any code hooks in the child windows
        if (window && !window.isDestroyed()) {
            executeCloseHooks(window);
            window.close();
        }
    }
}

function setClientWindowsParent(id, parent, oldParent) {
    //no windows so just bail
    if (clients[id].windows.length === 0) return;
    const wl = clients[id].windows.length;
    for (var idx = 0; idx < wl; id++) {
        const window = clients[id].windows[idx].window;
        //call any code hooks in the child windows
        if (window && !window.isDestroyed()) {
            if (oldParent && window.getParentWindow() === oldParent)
                window.setParentWindow(parent);
            else if (!oldParent && window.getParentWindow())
                window.setParentWindow(parent);
        }
    }
}

function clientsChanged() {
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        clients[clientId].view.webContents.send('clients-changed', Object.keys(windows).length, windows[getWindowId(clients[clientId].parent)].clients.length);
    }
}

async function canCloseClient(id) {
    const client = clients[id];
    let close = await executeScript('if(typeof closeable === "function") closeable()', client.view);
    //main client can not close so no need to check children
    if (close === false)
        return false;
    const wl = client.windows.length;
    for (let w = 0; w < wl; w++) {
        //check each child window just to be saft
        close = await executeScript('if(typeof closeable === "function") closeable()', client.view);
        if (close === false)
            return false;
    }
    return true;;
}

async function canCloseAllClients(windowId) {
    const cl = windows[windowId].clients.length;
    for (var idx = 0; idx < cl; idx++) {
        const close = await canCloseClient(windows[windowId].clients[idx]);
        if (!close)
            return false;
    }
    return true;
}

async function canCloseAllWindows() {
    for (window in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, window))
            continue;
        const close = await canCloseAllClients(window);
        if (!close)
            return false;
    }
    return true;
}

function executeCloseHooks(window) {
    executeScript('if(typeof closing === "function") closing();', window);
    executeScript('if(typeof closed === "function") closed();', window);
    executeScript('if(typeof closeHidden === "function") closeHidden();', window);
}

function updateIcon(window) {
    //@TODO needs better logic to handle focus/unfocused of multiple windows
    const windowId = getWindowId(window);
    switch (clients[windows[windowId].current].overlay) {
        case 4:
        case 1:
            window.setIcon(path.join(__dirname, '../assets/icons/png/connected2.png'));
            break;
        case 5:
        case 2:
            window.setIcon(path.join(__dirname, '../assets/icons/png/connectednonactive2.png'));
            break;
        case 'code':
            window.setIcon(path.join(__dirname, '../assets/icons/png/code.png'));
            break;
        default:
            window.setIcon(path.join(__dirname, '../assets/icons/png/disconnected2.png'));
            break;
    }
    updateOverlay();
}

function updateOverlay() {
    let overlay = 0;
    let window = BrowserWindow.getFocusedWindow();
    let windowId;
    if (window) {
        windowId = getWindowId(window);
        overlay = clients[windows[windowId].current].overlay;
    }
    else {
        //use the last active window as the target to update info
        window = getActiveWindow().window
        for (windowId in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, windowId))
                continue;
            const cl = windows[windowId].clients.length;
            for (let idx = 0; idx < cl; idx++) {
                switch (clients[windows[windowId].clients[idx]].overlay) {
                    case 4:
                    case 1:
                        if (overlay < 1)
                            overlay = 1;
                        break;
                    case 5:
                    case 2:
                        if (overlay < 2)
                            overlay = 2;
                        break;
                }
            }
        }
    }
    switch (overlay) {
        case 4:
        case 1:
            if (process.platform !== 'linux')
                window.setOverlayIcon(path.join(__dirname, '../assets/icons/png/connected.png'), 'Connected');
            break;
        case 5:
        case 2:
            if (process.platform !== 'linux')
                window.setOverlayIcon(path.join(__dirname, '../assets/icons/png/connectednonactive.png'), 'Received data');
            break;
        case 'code':
            if (process.platform !== 'linux')
                window.setOverlayIcon(path.join(__dirname, '../assets/icons/png/codeol.png'), 'Received data');
            break;
        default:
            if (process.platform !== 'linux')
                window.setOverlayIcon(path.join(__dirname, '../assets/icons/png/disconnected.png'), 'Disconnected');
            break;
    }
    //@TODO updateTray when addded
}

ipcMain.on('parseTemplate', (event, str, data) => {
    event.returnValue = parseTemplate(str, data);
});

function parseTemplate(str, data) {
    str = str.replace(/{home}/g, app.getPath('home'));
    str = str.replace(/{path}/g, app.getAppPath());
    str = str.replace(/{appData}/g, app.getPath('appData'));
    str = str.replace(/{data}/g, app.getPath('userData'));
    str = str.replace(/{temp}/g, app.getPath('temp'));
    str = str.replace(/{desktop}/g, app.getPath('desktop'));
    str = str.replace(/{documents}/g, app.getPath('documents'));
    str = str.replace(/{downloads}/g, app.getPath('downloads'));
    str = str.replace(/{music}/g, app.getPath('music'));
    str = str.replace(/{pictures}/g, app.getPath('pictures'));
    str = str.replace(/{videos}/g, app.getPath('videos'));
    str = str.replace(/{characters}/g, path.join(app.getPath('userData'), 'characters'));
    str = str.replace(/{themes}/g, path.join(__dirname, '..', 'build', 'themes'));
    str = str.replace(/{assets}/g, path.join(__dirname, '..', 'assets'));
    if (data) {
        var keys = Object.keys(data);
        for (var key in keys) {
            if (!data.hasOwnProperty(key)) continue;
            var regex = new RegExp('{' + key + '}', 'g');
            str = str.replace(regex, data[key]);
        }
    }
    return str;
}

//#region File system functions
function isDirSync(aPath) {
    try {
        return fs.statSync(aPath).isDirectory();
    } catch (e) {
        if (e.code === 'ENOENT') {
            return false;
        } else {
            throw e;
        }
    }
}

function existsSync(filename) {
    try {
        fs.statSync(filename);
        return true;
    } catch (ex) {
        return false;
    }
}

function isFileSync(aPath) {
    try {
        return fs.statSync(aPath).isFile();
    } catch (e) {
        if (e.code === 'ENOENT') {
            return false;
        } else {
            throw e;
        }
    }
}
//#endregion

function logError(err, skipClient) {
    var msg = '';
    if (global.debug)
        console.error(err);
    if (!set)
        set = settings.Settings.load(global.settingsFile);
    if (err.stack && set.showErrorsExtended)
        msg = err.stack;
    else if (err instanceof TypeError)
        msg = err.name + ': ' + err.message;
    else if (err instanceof Error)
        msg = err.name + ': ' + err.message;
    else if (err.message)
        msg = err.message;
    else
        msg = err;

    let client = getActiveClient();

    if (!global.editorOnly && client && client.webContents && !skipClient)
        client.webContents.send('error', msg);
    else if (set.logErrors) {
        if (err.stack && !set.showErrorsExtended)
            msg = err.stack;
        fs.writeFileSync(path.join(app.getPath('userData'), 'jimud.error.log'), new Date().toLocaleString() + '\n', { flag: 'a' });
        fs.writeFileSync(path.join(app.getPath('userData'), 'jimud.error.log'), msg + '\n', { flag: 'a' });
    }
}

function loadWindowScripts(window, name) {
    if (!window || !name) return;
    if (isFileSync(path.join(app.getPath('userData'), name + '.css'))) {
        fs.readFile(path.join(app.getPath('userData'), name + '.css'), 'utf8', (err, data) => {
            window.webContents.insertCSS(parseTemplate(data));
        });
    }
    if (isFileSync(path.join(app.getPath('userData'), name + '.js'))) {
        fs.readFile(path.join(app.getPath('userData'), name + '.js'), 'utf8', (err, data) => {
            executeScript(data, window).catch(logError);
        });
    }
}

function updateJumpList() {
    if (process.platform !== 'win32')
        return;
    const list = [];
    //TODO figure out some way to open editor window for current jimud instance
    list.push({
        type: 'tasks',
        items: [
            {
                type: 'task',
                title: 'New Code Editor',
                description: 'Opens a new code editor',
                program: process.execPath,
                args: '-eo', // force editor only mode
                iconPath: process.execPath,
                iconIndex: 0
            },
            /** 
             * @TODO need to figure this out, 
             * either need to use node-ipc or some way to communicate between instances, 
             * also to see if an instance is even open, can use requestSingleInstanceLock
             * but then everything has to be in 1 program even editor only and that
             * requires changing how that works when client is also open
             * 
             * maybe offer an option to make all 1 instance or seperate, and add/remove
             * New connection as needed as if not single new connection would just open up a new window
             */
            /*
            {
                type: 'task',
                title: 'New Connection',
                description: 'Opens a new connection in active window',
                program: process.execPath,
                args: '-eo', // force editor only mode
                iconPath: process.execPath,
                iconIndex: 0
            },
            {
                type: 'task',
                title: 'New Window',
                description: 'Opens a new window',
                program: process.execPath,
                args: '-eo', // force editor only mode
                iconPath: process.execPath,
                iconIndex: 0
            }          
            */
        ]
    });
    //TODO add recent support, require instance check
    /*
    list.push({
      type: 'recent'
    });
  */
    try {
        app.setJumpList(list);
    } catch (error) {
        logError(error);
    }
}

//#region Auto updates
function createUpdater() {
    const autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.on('download-progress', progressObj => {
        if (win) {
            win.setProgressBar(progressObj.percent / 100);
            win.webContents.send('update-progress', progressObj);
        }
        else if (global.editorOnly && winCode) {
            winCode.setProgressBar(progressObj.percent / 100);
            winCode.webContents.send('update-progress', progressObj);
        }
    });
    return autoUpdater;
}

function checkForUpdates() {
    if (!set)
        set = settings.Settings.load(global.settingsFile);
    if (set.checkForUpdates) {
        //resources/app-update.yml
        if (!isFileSync(path.join(app.getAppPath(), '..', 'app-update.yml'))) {
            if (dialog.showMessageBoxSync(getParentWindow(), {
                type: 'warning',
                title: 'Not supported',
                message: 'Auto update is not supported with this version of jiMUD, try anyways?',
                buttons: ['Yes', 'No'],
                defaultId: 1,
            }) !== 0)
                return;
        }
        const autoUpdater = createUpdater();
        autoUpdater.on('update-downloaded', () => {
            if (win) {
                win.setProgressBar(-1);
                win.webContents.send('update-downloaded');
            }
            else if (global.editorOnly && winCode) {
                winCode.setProgressBar(-1);
                winCode.webContents.send('update-downloaded');
            }
            //store current line arguments to use on next load
            fs.writeFileSync(path.join(app.getPath('userData'), 'argv.json'), JSON.stringify(process.argv));
        });
        autoUpdater.on('error', (error) => {
            dialog.showErrorBox('Error: ', error == null ? 'unknown' : (error.stack || error).toString());
            if (global.editorOnly) {
                winCode.webContents.send('menu-update', 'help|check for updates...', { enabled: true });
                winCode.setProgressBar(-1);
                winCode.webContents.send('update-downloaded');
            }
            else {
                updateMenuItem({ menu: ['help', 'updater'], enabled: true });
                win.setProgressBar(-1);
                win.webContents.send('update-downloaded');
            }
        });
        autoUpdater.checkForUpdatesAndNotify();
    }
}

function checkForUpdatesManual() {
    if (!isFileSync(path.join(app.getAppPath(), '..', 'app-update.yml'))) {
        if (dialog.showMessageBoxSync(getParentWindow(), {
            type: 'warning',
            title: 'Not supported',
            message: 'Auto update is not supported with this version of jiMUD, try anyways?',
            buttons: ['Yes', 'No'],
            defaultId: 1,
        }) !== 0)
            return;
    }
    const autoUpdater = createUpdater();
    autoUpdater.autoDownload = false;
    autoUpdater.on('error', (error) => {
        dialog.showErrorBox('Error: ', error == null ? 'unknown' : (error.stack || error).toString());
        if (global.editorOnly) {
            winCode.webContents.send('menu-update', 'help|check for updates...', { enabled: true });
            winCode.setProgressBar(-1);
            winCode.webContents.send('update-downloaded');
        }
        else {
            updateMenuItem({ menu: ['help', 'updater'], enabled: true });
            win.setProgressBar(-1);
            win.webContents.send('update-downloaded');
        }
    });

    autoUpdater.on('update-available', () => {
        dialog.showMessageBox(getParentWindow(), {
            type: 'info',
            title: 'Found Updates',
            message: 'Found updates, do you want update now?',
            buttons: ['Yes', 'No', 'Open website']
        }).then(buttonIndex => {
            if (buttonIndex.response === 0)
                autoUpdater.downloadUpdate();
            else {
                if (buttonIndex.response === 2)
                    shell.openExternal('https://github.com/icewolfz/jiMUD/releases/latest', '_blank');
                if (global.editorOnly)
                    winCode.webContents.send('menu-update', 'help|check for updates...', { enabled: true });
                else
                    updateMenuItem({ menu: ['help', 'updater'], enabled: true });
            }
        });
    });

    autoUpdater.on('update-not-available', () => {
        dialog.showMessageBox(getParentWindow(), {
            title: 'No Updates',
            message: 'Current version is up-to-date.',
            buttons: ['Ok', 'Open website']
        }).then(buttonIndex => {
            if (buttonIndex.response === 1)
                shell.openExternal('https://github.com/icewolfz/jiMUD/releases/latest', '_blank');
            if (global.editorOnly)
                winCode.webContents.send('menu-update', 'help|check for updates...', { enabled: true });
            else
                updateMenuItem({ menu: ['help', 'updater'], enabled: true });
        });
    });

    autoUpdater.on('update-downloaded', () => {
        if (global.editorOnly) {
            winCode.webContents.send('menu-update', 'help|check for updates...', { enabled: false });
            winCode.setProgressBar(-1);
            winCode.webContents.send('update-downloaded');
        }
        else {
            updateMenuItem({ menu: ['help', 'updater'], enabled: false });
            win.setProgressBar(-1);
            win.webContents.send('update-downloaded');
        }
        dialog.showMessageBox({
            title: 'Install Updates',
            message: 'Updates downloaded, application will be quit for update or when you next restart the application...',
            buttons: ['Now', 'Later']
        }).then(result => {
            if (result.response === 0) {
                global.updating = true;
                //store current line arguments to use on next load
                fs.writeFileSync(path.join(app.getPath('userData'), 'argv.json'), JSON.stringify(process.argv));
                setImmediate(() => autoUpdater.quitAndInstall());
            }
        });
    });
    if (global.editorOnly)
        winCode.webContents.send('menu-update', 'help|check for updates...', { enabled: false });
    else
        updateMenuItem({ menu: ['help', 'updater'], enabled: false });
    autoUpdater.checkForUpdates();
}

ipcMain.on('check-for-updates', checkForUpdatesManual);
//#endregion

//#region Window build/position functions
function getWindowX(x, w) {
    if (set.fixHiddenWindows) {
        const { width } = screen.getPrimaryDisplay().workAreaSize;
        if (x + w >= width)
            return width - w;
        if (x + w < 0)
            return 0;
    }
    return x;
}

function getWindowY(y, h) {
    if (!set)
        set = settings.Settings.load(global.settingsFile);
    if (set.fixHiddenWindows) {
        const { height } = screen.getPrimaryDisplay().workAreaSize;
        if (y + h >= height)
            return height - h;
        if (y + h < 0)
            return 0;
    }
    return y;
}

function buildOptions(details, window, settings) {
    let file = details.url;
    if (file.startsWith('file:///' + __dirname.replace(/\\/g, '/')))
        file = file.substring(__dirname.length + 9);
    options = {
        backgroundColor: '#000',
        show: false,
        icon: path.join(__dirname, '../assets/icons/png/64x64.png'),
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: settings ? settings.spellchecking : false,
            enableRemoteModule: true,
            contextIsolation: false,
            backgroundThrottling: settings ? settings.enableBackgroundThrottling : true
        },
        width: 800,
        height: 600
    };
    if (details.features.length) {
        features = details.features.split(',');
        for (var f = 0, fl = features.length; f < fl; f++) {
            feature = features[f].split('=');
            if (feature[0] === "width" || feature[0] === "height" || feature[0] === 'x' || feature[0] === 'y')
                options[feature[0]] = parseInt(feature[1], 10);
            else
                options[feature[0]] = feature[1];
        }
        //not set so all other bounds are missing so use previous saved if found
        if (typeof options.x === 'undefined' && states[file] && states[file].bounds) {
            options.x = states[file].bounds.x;
            options.y = states[file].bounds.y;
            options.width = states[file].bounds.width;
            options.height = states[file].bounds.height;
        }
    }//not passed so see if any previous openings to use them
    else if (states[file] && states[file].bounds) {
        options.x = states[file].bounds.x;
        options.y = states[file].bounds.y;
        options.width = states[file].bounds.width;
        options.height = states[file].bounds.height;
    }
    if (details.frameName === 'modal') {
        // open window as modal
        Object.assign(options, {
            modal: true,
            parent: window,
            movable: false,
            minimizable: false,
            maximizable: false,
            skipTaskbar: true,
            resizable: false
        });

        var b = window.getBounds();
        options.x = Math.floor(b.x + b.width / 2 - options.width / 2);
        options.y = Math.floor(b.y + b.height / 2 - options.height / 2);
    }
    else {
        if (Object.prototype.hasOwnProperty.call(options, 'x'))
            options.x = getWindowX(options.x, options.width);
        if (Object.prototype.hasOwnProperty.call(options, 'y'))
            options.x = getWindowY(options.y, options.height);
    }
    return options;
}
//#endregion
//#region Window/client query functions
function getActiveClient(window) {
    if (!window) return clients[focusedClient];
    return clients[windows[getWindowId(window)].current];
}

function getActiveWindow() {
    return windows[focusedWindow];
}

function getWindowId(window) {
    if (!window) return focusedWindow;
    return idMap.get(window);
}

function getClientId(client) {
    if (!client) return focusedClient;
    return idMap.get(client);
}

function browserViewFromContents(contents) {
    if (!contents) return null
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        if (clients[clientId].view.webContents === contents)
            return clients[clientId].view;
    }
    return null;
}

function clientIdFromContents(contents) {
    if (!contents) return null
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        if (clients[clientId].view.webContents === contents)
            return clientId;
    }
    return null;
}

function clientFromContents(contents) {
    if (!contents) return null
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        if (clients[clientId].view.webContents === contents)
            return clients[clientId];
    }
    return null;
}

//#endregion
function focusWindow(window, focusWindow) {
    let client = getActiveClient(window);
    if (!client) return;
    if (focusWindow) {
        client.parent.focus();
        client.parent.webContents.focus();
    }
    client.view.webContents.focus();
}

function focusClient(clientId, focusWindow) {
    if (!clients[clientId]) return;
    client = clients[clientId];
    if (focusWindow) {
        client.parent.focus();
        client.parent.webContents.focus();
    }
    client.view.webContents.focus();
}
//#region Execute scripts in window/view
// eslint-disable-next-line no-unused-vars
async function executeScript(script, window, focus) {
    return new Promise((resolve, reject) => {
        if (!window || !window.webContents) {
            reject();
            return;
        }
        window.webContents.executeJavaScript(script).then(results => resolve(results)).catch(err => {
            if (err)
                logError(err);
            reject();
        });
    });
    //if (f)
    //w.webContents.focus();
}

// eslint-disable-next-line no-unused-vars
async function executeScriptContents(script, contents) {
    return new Promise((resolve, reject) => {
        if (!contents) {
            reject();
            return;
        }
        contents.executeJavaScript(script).then(results => resolve(results)).catch(err => {
            if (err)
                logError(err);
            reject();
        });
    });
}

// eslint-disable-next-line no-unused-vars
async function executeScriptClient(script, window, focus) {
    return new Promise(async (resolve, reject) => {
        if (!window) {
            reject();
            return;
        }
        const id = windows[getWindowId(window)].current;
        if (!clients[id]) return;
        clients[id].view.webContents.executeJavaScript(script).then(results => resolve(results)).catch(err => {
            if (err)
                logError(err);
            reject();
        });
        if (focus) {
            clients[id].parent.focus();
            clients[id].parent.webContents.focus();
            clients[id].view.webContents.focus();
        }
    });
}
//#endregion
//#region window layout systems
async function saveWindowLayout(file) {
    if (!file)
        file = parseTemplate(path.join('{data}', 'window.layout'));
    let id;
    const data = {
        windowID: _windowID, //save last id to prevent reused ids
        clientID: _clientID,
        focusedClient: focusedClient,
        focusedWindow: focusedWindow,
        windows: [],
        clients: [],
        states: states
    }
    //save windows
    //{ window: window, clients: [], current: 0 }
    for (id in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, id))
            continue;
        const wData = {
            id: getWindowId(windows[id].window), //use function to ensure proper id data type
            clients: windows[id].clients,
            current: windows[id].current,
            //get any custom data from window
            data: await executeScript('if(typeof saveWindow === "function") saveWindow()', windows[id].window),
            state: saveWindowState(windows[id].window)
        }
        data.windows.push(wData);
    }
    //save clients
    //{parent: window, view: view, menu: menu, windows: childWindows}
    for (id in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, id))
            continue;
        const cData = {
            id: getClientId(clients[id].view), //use function to ensure proper id data type
            parent: clients[id].parent ? getWindowId(clients[id].parent) : -1,
            file: clients[id].file,
            menu: null, //@TODO need to save current menu state some how, right now just have an access to menu object
            windows: [],
            state: {
                bounds: clients[id].view.getBounds(),
                devTools: clients[id].view.webContents.isDevToolsOpened()
            },
            //get any custom data from window
            data: await executeScript('if(typeof saveWindow === "function") saveWindow()', clients[id].view)
        }
        const wl = clients[id].windows.length;
        for (var idx = 0; idx < wl; id++) {
            const window = clients[id].windows[idx].window;
            const wData = {
                client: getClientId(clients[id].view), //use function to ensure proper id data type
                state: saveWindowState(window),
                details: clients[id].windows[idx].details,
                //get any custom data from window
                data: await executeScript('if(typeof saveWindow === "function") saveWindow()', window)
            }
            cData.windows.push(wData);
        }
        data.clients.push(cData);
    }
    fs.writeFileSync(file, JSON.stringify(data));
}

function loadWindowLayout(file) {
    if (!file)
        file = parseTemplate(path.join('{data}', 'window.layout'));
    //cant find so cant load
    if (!isFileSync(file))
        return false;
    let data;
    try {
        data = fs.readFileSync(file, 'utf-8');
    }
    catch (e) {
        logError(e);
        return false;
    }
    try {
        data = JSON.parse(data);
    }
    catch (e) {
        logError(e);
        return false;
    }
    //_windowID = data.windowID;
    //_clientID = data.clientID;
    focusedClient = data.focusedClient;
    focusedWindow = data.focusedWindow;
    states = data.states || {};
    //create windows
    let i, il = data.windows.length;
    for (i = 0; i < il; i++) {
        createWindow({ id: data.windows[i].id, data: { data: data.windows[i].data, state: data.windows[i].state, states: data.states }, menubar: createMenu() });
        windows[data.windows[i].id].current = data.windows[i].current;
        windows[data.windows[i].id].clients = data.windows[i].clients;
    }
    //create clients and link to windows
    il = data.clients.length;
    for (i = 0; i < il; i++) {
        const client = data.clients[i];
        createClient({ bounds: client.state.bounds, id: client.id, data: client, file: client.file });
        clients[client.id].parent = windows[client.parent].window;
    }
    //set current clients for each window after everything is created
    il = data.windows.length;
    for (i = 0; i < il; i++) {
        const window = windows[data.windows[i].id];
        let current = data.windows[i].current;
        //current is wrong for what ever reason so fall back to first client
        if (!clients[current])
            current = window.clients[0];
        window.window.webContents.once('ready-to-show', () => {
            for (var c = 0, cl = window.clients.length; c < cl; c++) {
                const clientId = window.clients[c];
                window.window.addBrowserView(clients[clientId].view);
                clients[clientId].view.webContents.once('dom-ready', () => {
                    clients[clientId].view.webContents.send('clients-changed', Object.keys(windows).length, windows[getWindowId(clients[clientId].parent)].clients.length);
                });
            }
            window.window.webContents.send('set-clients', window.clients.map(x => {
                return {
                    id: x,
                    current: x === current,
                    noUpdate: true
                };
            }, current));

            window.window.setTopBrowserView(clients[current].view);
            //clients[current].menu.window = window.window;
            //window.window.setMenu(clients[current].menu);
            if (data.focusedWindow === getWindowId(window))
                focusWindow(window, true);
        });
    }
    return true;
}

function saveWindowState(window) {
    return {
        bounds: window.getNormalBounds(),
        fullscreen: window.isFullScreen(),
        maximized: window.isMaximized(),
        minimized: window.isMinimized(),
        devTools: window.webContents.isDevToolsOpened(),
        visible: window.isVisible(),
        normal: window.isNormal(),
        enabled: window.isEnabled(),
        alwaysOnTop: window.isAlwaysOnTop()
    };
}

function restoreWindowState(window, state) {
    if (!window || !state) return;
    if (state.maximized)
        window.maximize();
    else if (state.minimized)
        window.minimize();
    if (!state.visible)
        window.hide();
    window.show();
    if (state.fullscreen)
        window.setFullScreen(state.fullscreen);
    if (state.devTools || global.debug)
        window.webContents.openDevTools();
    if (!state.enabled)
        window.setEnabled(false);
    if (state.alwaysOnTop)
        window.setAlwaysOnTop(true);
}
//#endregion
//#region Client window menu code
function createMenu() {
    var menuTemp = [
        //File
        {
            label: '&File',
            id: 'file',
            submenu: [
                {
                    label: '&Connection',
                    submenu: [
                        {
                            label: '&New',
                            id: 'newConnect',
                            accelerator: 'CmdOrCtrl+Shift+N',
                            click: (item, mWindow) => {
                                let windowId = getWindowId(mWindow);
                                let id = createClient({ bounds: mWindow.getContentBounds() });
                                focusedWindow = windowId;
                                focusedClient = id;
                                windows[windowId].clients.push(id);
                                windows[windowId].current = id;
                                clients[id].parent = mWindow;
                                clients[id].view.webContents.once('dom-ready', () => {
                                    //mWindow.setBrowserView(clients[id].view);
                                    mWindow.addBrowserView(clients[id].view);
                                    mWindow.setTopBrowserView(clients[id].view);
                                    //clients[id].menu.window = mWindow;
                                    //mWindow.setMenu(clients[id].menu);
                                    mWindow.webContents.send('new-client', { id: id });
                                    focusWindow(mWindow, true);
                                    clientsChanged();
                                });
                            }
                        },
                        {
                            label: 'New to &Development',
                            id: 'newConnect',
                            click: (item, mWindow) => {
                                let windowId = getWindowId(mWindow);
                                let id = createClient({ bounds: mWindow.getContentBounds() });
                                focusedWindow = windowId;
                                focusedClient = id;
                                windows[windowId].clients.push(id);
                                windows[windowId].current = id;
                                clients[id].parent = mWindow;
                                clients[id].view.webContents.once('dom-ready', () => {
                                    //mWindow.setBrowserView(clients[id].view);
                                    mWindow.addBrowserView(clients[id].view);
                                    mWindow.setTopBrowserView(clients[id].view);
                                    //clients[id].menu.window = mWindow;
                                    //mWindow.setMenu(clients[id].menu);
                                    mWindow.webContents.send('new-client', { id: id });
                                    clients[id].view.webContents.send('connection-settings', { dev: true });
                                    focusWindow(mWindow, true);
                                    clientsChanged();
                                });
                            }
                        },
                        {
                            type: 'separator'
                        },
                        {
                            label: 'New &Window',
                            id: '',
                            accelerator: 'CmdOrCtrl+Alt+N',
                            click: (item, mWindow) => {
                                //save the current states so it has the latest for new window
                                states['manager.html'] = saveWindowState(mWindow);
                                //offset the state so it is not an exact overlap
                                states['manager.html'].bounds.x += 20;
                                states['manager.html'].bounds.y += 20;
                                const { height, width } = screen.getPrimaryDisplay().workAreaSize;
                                //make sure the window appears on the screen
                                if (states['manager.html'].bounds.x > (width - 10))
                                    states['manager.html'].bounds.x = width - states['manager.html'].bounds.width;
                                if (states['manager.html'].bounds.x - states['manager.html'].bounds.width - 10 < 0)
                                    states['manager.html'].bounds.x = 0;
                                if (states['manager.html'].bounds.y > (height - 10) < 0)
                                    states['manager.html'].bounds.y = height - states['manager.html'].bounds.height;
                                if (states['manager.html'].bounds.y - states['manager.html'].bounds.height - 10 < 0)
                                    states['manager.html'].bounds.y = 0;

                                let windowId = createWindow({ menubar: createMenu() });
                                let window = windows[windowId].window;
                                let id = createClient({ bounds: window.getContentBounds() });
                                focusedWindow = windowId;
                                focusedClient = id;
                                windows[windowId].clients.push(id);
                                windows[windowId].current = id;
                                clients[id].parent = window;
                                //window.setBrowserView(clients[id].view);
                                window.addBrowserView(clients[id].view);
                                window.setTopBrowserView(clients[id].view);
                                //clients[id].menu.window = window;
                                //window.setMenu(clients[id].menu);
                                clients[id].view.webContents.once('dom-ready', clientsChanged);
                                window.webContents.once('dom-ready', () => {
                                    window.webContents.send('new-client', { id: id });
                                    focusWindow(window, true);
                                });
                            }
                        },
                        {
                            label: 'New Window to D&evelopment',
                            id: '',
                            click: (item, mWindow) => {
                                //save the current states so it has the latest for new window
                                states['manager.html'] = saveWindowState(mWindow);
                                //offset the state so it is not an exact overlap
                                states['manager.html'].bounds.x += 20;
                                states['manager.html'].bounds.y += 20;
                                const { height, width } = screen.getPrimaryDisplay().workAreaSize;
                                //make sure the window appears on the screen
                                if (states['manager.html'].bounds.x > (width - 10))
                                    states['manager.html'].bounds.x = width - states['manager.html'].bounds.width;
                                if (states['manager.html'].bounds.x - states['manager.html'].bounds.width - 10 < 0)
                                    states['manager.html'].bounds.x = 0;
                                if (states['manager.html'].bounds.y > (height - 10) < 0)
                                    states['manager.html'].bounds.y = height - states['manager.html'].bounds.height;
                                if (states['manager.html'].bounds.y - states['manager.html'].bounds.height - 10 < 0)
                                    states['manager.html'].bounds.y = 0;

                                let windowId = createWindow({ menubar: createMenu() });
                                let window = windows[windowId].window;
                                let id = createClient({ bounds: window.getContentBounds() });
                                focusedWindow = windowId;
                                focusedClient = id;
                                windows[windowId].clients.push(id);
                                windows[windowId].current = id;
                                clients[id].parent = window;
                                //window.setBrowserView(clients[id].view);
                                window.addBrowserView(clients[id].view);
                                window.setTopBrowserView(clients[id].view);
                                //clients[id].menu.window = window;
                                //window.setMenu(clients[id].menu);
                                clients[id].view.webContents.once('dom-ready', clientsChanged);
                                window.webContents.once('dom-ready', () => {
                                    window.webContents.send('new-client', { id: id });
                                    clients[id].view.webContents.send('connection-settings', { dev: true });
                                    focusWindow(window, true);
                                });
                            }
                        },
                        {
                            type: 'separator'
                        },
                        {
                            label: 'Change Current to &Main',
                            id: '',
                            click: (item, mWindow) => {
                                getActiveClient(mWindow).view.webContents.send('change-connection-settings', { dev: false });
                            }
                        },
                        {
                            label: 'C&hange Current to Development',
                            id: '',
                            click: (item, mWindow) => {
                                getActiveClient(mWindow).view.webContents.send('change-connection-settings', { dev: true });
                            }
                        },
                        {
                            label: 'C&hange Current to Default',
                            id: '',
                            click: (item, mWindow) => {
                                getActiveClient(mWindow).view.webContents.send('change-connection-settings', { defaultConnect: true });
                            }
                        }
                    ]
                },
                {
                    type: 'separator'
                },
                {
                    label: '&Connect',
                    id: 'connect',
                    accelerator: 'CmdOrCtrl+N',
                    click: (item, mWindow) => {
                        executeScriptClient('client.connect()', mWindow, true);
                    }
                },
                {
                    label: '&Disconnect',
                    id: 'disconnect',
                    accelerator: 'CmdOrCtrl+D',
                    enabled: false,
                    click: (item, mWindow) => {
                        executeScriptClient('client.close()', mWindow, true);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: '&Enable parsing',
                    id: 'enableParsing',
                    type: 'checkbox',
                    checked: true,
                    click: (item, mWindow) => {
                        executeScriptClient('toggleParsing()', mWindow, true);
                    }
                },
                {
                    label: 'E&nable triggers',
                    id: 'enableTriggers',
                    type: 'checkbox',
                    checked: true,
                    click: (item, mWindow) => {
                        executeScriptClient('toggleTriggers()', mWindow, true);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Ch&aracters...',
                    id: 'characters',
                    accelerator: 'CmdOrCtrl+H',
                    click: (item, mWindow) => {
                        executeScriptClient('showCharacters()', mWindow, true);
                    }
                },
                { type: 'separator' },
                {
                    label: '&Log',
                    id: 'log',
                    type: 'checkbox',
                    checked: false,
                    click: (item, mWindow) => {
                        executeScriptClient('toggleLogging()', mWindow, true);
                    }
                },
                {
                    label: '&View logs...',
                    click: (item, mWindow) => {
                        executeScriptClient('showLogViewer()', mWindow, true);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Global &Preferences...',
                    id: 'globalPreferences',
                    accelerator: 'CmdOrCtrl+Comma',
                    click: (item, mWindow) => {
                        executeScriptClient('showPrefs(true)', mWindow, true);
                    }
                },
                {
                    label: 'Client &Preferences...',
                    id: 'preferences',
                    accelerator: 'CmdOrCtrl+Comma',
                    click: (item, mWindow) => {
                        executeScriptClient('showPrefs()', mWindow, true);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Clo&se Client',
                    id: 'close',
                    accelerator: 'CmdOrCtrl+W',
                    enabled: false,
                    visible: false,
                    click: (item, mWindow) => {

                    }
                },
                {
                    label: 'E&xit',
                    //role: 'quit'
                    click: quitApp
                }
            ]
        },
        //Edit
        {
            label: '&Edit',
            id: 'edit',
            submenu: [
                {
                    role: 'undo'
                },
                {
                    role: 'redo'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'cut'
                },
                {
                    role: 'copy'
                },
                {
                    label: 'Copy as HTML',
                    accelerator: 'CmdOrCtrl+Alt+C',
                    id: 'copyHTML',
                    enabled: false,
                    click: (item, mWindow) => {
                        executeScriptClient('copyAsHTML();', mWindow, true);
                    }
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    click: (item, mWindow) => {
                        executeScriptClient('$(\'#commandinput\').data(\'selStart\', client.commandInput[0].selectionStart);$(\'#commandinput\').data(\'selEnd\', client.commandInput[0].selectionEnd);paste()', mWindow, true);
                    }
                },
                {
                    label: 'Paste special',
                    accelerator: 'CmdOrCtrl+Shift+V',
                    click: (item, mWindow) => {
                        executeScriptClient('$(\'#commandinput\').data(\'selStart\', client.commandInput[0].selectionStart);$(\'#commandinput\').data(\'selEnd\', client.commandInput[0].selectionEnd);pasteSpecial()', mWindow, true);
                    }
                },
                /*
                {
                  role: 'pasteAndMatchStyle'
                },
                */
                {
                    role: 'delete'
                },
                {
                    label: 'Select All',
                    accelerator: 'CmdOrCtrl+A',
                    click: (item, mWindow) => {
                        executeScriptClient('selectAll()', mWindow, true);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Clear',
                    click: (item, mWindow) => {
                        executeScriptClient('client.clear()', mWindow, true);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Find',
                    accelerator: 'CmdOrCtrl+F',
                    click: (item, mWindow) => {
                        focusWindow(mWindow, true);
                        executeScriptClient('client.display.showFind()', mWindow);
                    }
                },
            ]
        },
        //Profiles
        {
            label: '&Profiles',
            id: 'profiles',
            submenu: []
        },
        //View
        {
            label: '&View',
            id: 'view',
            submenu: [
                {
                    label: '&Lock',
                    id: 'lock',
                    type: 'checkbox',
                    checked: false,
                    click: (item, mWindow) => {
                        executeScriptClient('client.toggleScrollLock()', mWindow, true);
                    }
                },
                {
                    label: '&Who is on?...',
                    click: (item, mWindow) => {
                        executeScriptClient('showWho()', mWindow, true);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: '&Status',
                    id: 'status',
                    submenu: [
                        {
                            label: '&Visible',
                            id: 'statusvisible',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("status")', mWindow, true);
                            }
                        },
                        {
                            label: '&Refresh',
                            id: 'refresh',
                            click: (item, mWindow) => {
                                executeScriptClient('client.sendGMCP(\'Core.Hello { "client": "\' + client.telnet.terminal + \'", "version": "\' + client.telnet.version + \'" }\');', mWindow, true);
                            }
                        },
                        { type: 'separator' },
                        {
                            label: '&Weather',
                            id: 'weather',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("weather")', mWindow, true);
                            }
                        },
                        {
                            label: '&Limbs',
                            id: 'limbsmenu',
                            submenu: [
                                {
                                    label: '&Visible',
                                    id: 'limbs',
                                    type: 'checkbox',
                                    checked: true,
                                    click: (item, mWindow) => {
                                        executeScriptClient('toggleView("limbs")', mWindow, true);
                                    }
                                },
                                { type: 'separator' },
                                {
                                    label: '&Health',
                                    id: 'limbhealth',
                                    type: 'checkbox',
                                    checked: true,
                                    click: (item, mWindow) => {
                                        executeScriptClient('toggleView("limbhealth")', mWindow, true);
                                    }
                                },
                                {
                                    label: '&Armor',
                                    id: 'limbarmor',
                                    type: 'checkbox',
                                    checked: true,
                                    click: (item, mWindow) => {
                                        executeScriptClient('toggleView("limbarmor")', mWindow, true);
                                    }
                                },
                            ]
                        },
                        {
                            label: '&Health',
                            id: 'health',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("health")', mWindow, true);
                            }
                        },
                        {
                            label: '&Experience',
                            id: 'experience',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("experience")', mWindow, true);
                            }
                        },
                        {
                            label: '&Party Health',
                            id: 'partyhealth',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("partyhealth")', mWindow, true);
                            }
                        },
                        {
                            label: '&Combat Health',
                            id: 'combathealth',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("combathealth")', mWindow, true);
                            }
                        },
                        {
                            label: '&Lag meter',
                            id: 'lagmeter',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("lagmeter")', mWindow, true);
                            }
                        }
                    ]
                },
                {
                    label: '&Buttons',
                    id: 'buttons',
                    /*
                    type: 'checkbox',
                    checked: true,
                    click: (item, mWindow) => {
                      executeScript('toggleView("buttons")', mWindow.getBrowserView() || mWindow, true);
                    },
                    */
                    submenu: [
                        {
                            label: '&Visible',
                            id: 'buttonsvisible',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("buttons")', mWindow, true);
                            }
                        },
                        { type: 'separator' },
                        {
                            label: '&Connect',
                            id: 'connectbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.connect")', mWindow, true);
                            }
                        },
                        {
                            label: '&Characters',
                            id: 'charactersbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.characters")', mWindow, true);
                            }
                        },
                        {
                            label: 'Code &editor',
                            id: 'codeEditorbutton',
                            type: 'checkbox',
                            //click: showCodeEditor
                        },
                        {
                            label: '&Preferences',
                            id: 'preferencesbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.preferences")', mWindow, true);
                            }
                        },
                        {
                            label: '&Log',
                            id: 'logbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.log")', mWindow, true);
                            }
                        },
                        {
                            label: '&Clear',
                            id: 'clearbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.clear")', mWindow, true);
                            }
                        },
                        {
                            label: '&Lock',
                            id: 'lockbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.lock")', mWindow, true);
                            }
                        },
                        {
                            label: '&Map',
                            id: 'mapbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.map")', mWindow, true);
                            }
                        },
                        /*
                        {
                          label: 'M&ail',
                          id: "mailbutton",
                          type: 'checkbox',
                          checked: true,
                          click: (item, mWindow) => {
                            executeScriptClient('toggleView("button.mail")', mWindow, true);
                          }
                        },
                        {
                          label: '&Compose mail',
                          id: "composebutton",
                          type: 'checkbox',
                          checked: true,
                          click: (item, mWindow) => {
                            executeScriptClient('toggleView("button.compose")', mWindow, true);
                          }
                        },
                        */
                        {
                            label: '&User buttons',
                            id: 'userbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.user")', mWindow, true);
                            }
                        },
                    ]
                },
                {
                    type: 'separator'
                },
                {
                    label: '&Developer Tools',
                    id: 'devtools',
                    submenu: [
                        {
                            label: '&Toggle Window ',
                            click: (item, mWindow) => {
                                if (mWindow.webContents.isDevToolsOpened())
                                    mWindow.webContents.closeDevTools();
                                else
                                    mWindow.webContents.openDevTools();
                                focusWindow(mWindow);
                            }
                        },
                        {
                            label: 'Toggle Active &Client',
                            click: async (item, mWindow) => {
                                var view = getActiveClient(mWindow).view;
                                if (view && view.webContents.isDevToolsOpened())
                                    view.webContents.closeDevTools();
                                else if (view)
                                    view.webContents.openDevTools();
                                focusWindow(mWindow);
                            }
                        },
                        {
                            label: 'Toggle &Both',
                            click: async (item, mWindow) => {
                                if (mWindow.webContents.isDevToolsOpened())
                                    mWindow.webContents.closeDevTools();
                                else
                                    mWindow.webContents.openDevTools();
                                var view = getActiveClient(mWindow).view;
                                if (view && view.webContents.isDevToolsOpened())
                                    view.webContents.closeDevTools();
                                else if (view)
                                    view.webContents.openDevTools();
                                focusWindow(mWindow);
                            }
                        }
                    ]
                },
                {
                    type: 'separator'
                },
                {
                    role: 'resetZoom'
                },
                {
                    role: 'zoomIn'
                },
                {
                    role: 'zoomOut'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'togglefullscreen'
                }
            ]
        },
        //Window
        {
            role: 'window',
            id: 'window',
            submenu: [
                {
                    label: '&Advanced editor...',
                    id: 'editor',
                    click: (item, mWindow) => {
                        executeScriptClient('showEditor()', mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+E'
                },
                {
                    label: '&Chat...',
                    id: 'chat',
                    click: (item, mWindow) => {
                        executeScriptClient('showChat()', mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+L'
                },
                {
                    label: '&Immortal tools...',
                    id: 'immortal',
                    click: (item, mWindow) => {
                        executeScriptClient('showImmortalTools()', mWindow, true);
                    },
                    visible: false,
                    accelerator: 'CmdOrCtrl+I'
                },
                {
                    label: 'Code &editor...',
                    id: 'codeeditor',
                    click: (item, mWindow) => {
                        executeScriptClient('showCodeEditor()', mWindow, true);
                    },
                },
                {
                    label: '&Map...',
                    click: (item, mWindow) => {
                        executeScriptClient('showMapper()', mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+T'
                },
                {
                    label: '&Skills...',
                    id: 'skills',
                    click: (item, mWindow) => {
                        executeScriptClient('showSkills()', mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+S'
                },
                {
                    label: 'Command &history...',
                    id: 'history',
                    click: (item, mWindow) => {
                        executeScriptClient('showCommandHistory()', mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+Shift+H'
                },
                { type: 'separator' },
                {
                    label: 'Save &Layout',
                    id: 'saveLayout',
                    click: (item, mWindow) => {
                        var file = dialog.showSaveDialogSync(mWindow, {
                            title: 'Save as...',
                            defaultPath: path.join(parseTemplate('{documents}'), 'jiMUD-characters-data.zip'),
                            filters: [
                                { name: 'Layout files (*.layout)', extensions: ['layout'] },
                                { name: 'All files (*.*)', extensions: ['*'] },
                            ]
                        });
                        if (file === undefined || file.length === 0)
                            return;
                        saveWindowLayout(file);
                    }
                },
                {
                    label: 'L&oad Layout',
                    id: 'loadLayout',
                    click: (item, mWindow) => {
                        dialog.showOpenDialog(mWindow, {
                            defaultPath: app.getPath('userData'),
                            filters: [
                                { name: 'Layout files (*.layout)', extensions: ['layout'] },
                                { name: 'All files (*.*)', extensions: ['*'] },
                            ]
                        }).then(result => {
                            if (result.filePaths === undefined || result.filePaths.length === 0)
                                return;
                            _layout = result.filePaths[0];
                            if (!loadWindowLayout(result.filePaths[0]))
                                dialog.showMessageBox(mWindow, {
                                    type: 'error',
                                    message: `Error loading: '${result.filePaths[0]}'.`
                                });
                            else
                                _loaded = true;
                        });
                    }
                },
                {
                    label: 'Load default Layout',
                    id: 'defaultLayout',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            message: 'Load default layout?',
                            buttons: ['Yes', 'No']
                        }).then(result => {
                            if (result.response === 0) {
                                _layout = parseTemplate(path.join('{data}', 'window.layout'));
                                if (isFileSync(path.join(app.getPath('userData'), 'window.layout'))) {
                                    if (!loadWindowLayout())
                                        dialog.showMessageBox(mWindow, {
                                            type: 'error',
                                            message: `Error loading: default layout.`
                                        });
                                    else
                                        _loaded = true;
                                }
                                else
                                    dialog.showMessageBox(mWindow, {
                                        type: 'error',
                                        message: 'Unable to load, default layout not found.'
                                    });
                            }
                        });
                    }
                },
                /*
                {
                  label: '&Mail...',
                  click: (item, mWindow) => {
                    executeScriptClient('showMail()', mWindow, true);
                  },
                  visible: true,
                  //accelerator: 'CmdOrCtrl+M'
                },
                {
                  label: '&Compose mail...',
                  click: (item, mWindow) => {
                    executeScriptClient('showComposer()', mWindow, true);
                  },
                  visible: true,
                  //accelerator: 'CmdOrCtrl+M'
                },
                */
                { type: 'separator' }
            ]
        },
        //Help
        {
            label: '&Help',
            role: 'help',
            id: 'help',
            submenu: [
                {
                    label: '&ShadowMUD...',
                    click: (item, mWindow) => {
                        executeScriptClient('showSMHelp()', mWindow, true);
                    }
                },
                {
                    label: '&jiMUD...',
                    click: () => {
                        executeScriptClient('showHelp()', mWindow, true);
                    }
                },
                {
                    label: '&jiMUD website...',
                    click: (item, mWindow) => {
                        shell.openExternal('https://github.com/icewolfz/jiMUD/tree/master/docs', '_blank');
                        focusWindow(mWindow);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Check for updates...',
                    id: 'updater',
                    click: checkForUpdatesManual
                },
                { type: 'separator' },
                {
                    label: '&About...',
                    click: (item, mWindow) => createDialog({ parent: mWindow, url: path.join(__dirname, 'about.html'), title: 'About jiMUD', width: 500, height: 560 })
                }
            ]
        }
    ];

    if (process.platform === 'darwin') {
        menuTemp.unshift({
            label: app.getName(),
            submenu: [
                {
                    role: 'about'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'services',
                    submenu: []
                },
                {
                    type: 'separator'
                },
                {
                    role: 'hide'
                },
                {
                    role: 'hideothers'
                },
                {
                    role: 'unhide'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'quit'
                }
            ]
        });
        menuTemp.push()
        // Edit menu.
        menuTemp[2].submenu.push(
            {
                type: 'separator'
            },
            {
                label: 'Speech',
                submenu: [
                    {
                        role: 'startspeaking'
                    },
                    {
                        role: 'stopspeaking'
                    }
                ]
            }
        );
        // Window menu.
        menuTemp[5].submenu.push(
            {
                label: 'Close',
                accelerator: 'CmdOrCtrl+W',
                role: 'close'
            },
            {
                label: 'Minimize',
                accelerator: 'CmdOrCtrl+M',
                role: 'minimize'
            },
            {
                label: 'Zoom',
                role: 'zoom'
            },
            {
                type: 'separator'
            },
            {
                label: 'Bring All to Front',
                role: 'front'
            }
        );
    }
    else {
        menuTemp[4].submenu.push(
            {
                role: 'minimize'
            },
            {
                role: 'close'
            }
        )
    }
    var profiles;
    for (var m = 0; m < menuTemp.length; m++) {
        if (menuTemp[m].id === 'profiles') {
            profiles = menuTemp[m];
            break;
        }
    }
    profiles.submenu = [];
    profiles.submenu.push(
        {
            label: 'Default',
            type: 'checkbox',
            checked: false,
            id: 'default',
            click: (item, mWindow) => {
                executeScriptClient('client.toggleProfile("default")', mWindow, true);
            }
        });

    var p = path.join(app.getPath('userData'), 'profiles');
    if (isDirSync(p)) {
        var files = fs.readdirSync(p);
        for (var i = 0; i < files.length; i++) {
            if (path.extname(files[i]) === '.json') {
                if (files[i].toLowerCase() === 'default.json')
                    continue;
                profiles.submenu.push(
                    {
                        label: path.basename(files[i], '.json'),
                        type: 'checkbox',
                        checked: false,
                        id: path.basename(files[i], '.json').toLowerCase(),
                        click: profileToggle
                    });
            }
        }
    }
    profiles.submenu.push(
        {
            type: 'separator'
        });
    profiles.submenu.push(
        {
            label: '&Manage...',
            //click: showProfiles,
            accelerator: 'CmdOrCtrl+P'

        });
    return new Menubar(menuTemp);
    //return Menu.buildFromTemplate(menuTemp);
}

function profileToggle(menuItem, mWindow) {
    executeScriptClient('client.toggleProfile("' + menuItem.label.toLowerCase() + '")', mWindow, true);
}

ipcMain.on('update-menuitem', (event, menuitem, rebuild) => {
    updateMenuItem(BrowserWindow.fromWebContents(event.sender), menuitem, rebuild);
});

ipcMain.on('update-menuitems', (event, menuitems, rebuild) => {
    updateMenuItems(BrowserWindow.fromWebContents(event.sender), menuitems, rebuild);
});

ipcMain.on('update-menuitem-all', (event, menuitem, rebuild) => {
    updateMenuItemAll(menuitem, rebuild);
});

ipcMain.on('update-menuitems-all', (event, menuitems, rebuild) => {
    updateMenuItemsAll(menuitems, rebuild);
});

ipcMain.on('reset-profiles-menu', (event) => {
    resetProfilesMenu(BrowserWindow.fromWebContents(event.sender));
});

function resetProfilesMenu(window) {
    if (!window || !windows[getWindowId(window)].menubar) return;
    const profiles = windows[getWindowId(window)].menubar.getItem('profiles');
    profiles.submenu.items.forEach(item => {
        item.checked = false;
    });
}

function updateMenuItem(window, menuitem, rebuild) {
    if (!window || !windows[getWindowId(window)].menubar) return;
    windows[getWindowId(window)].menubar.updateItem(menuitem);
    if (rebuild)
        windows[getWindowId(windows[window])].menubar.rebuild();
}

function updateMenuItems(window, menuitems, rebuild) {
    if (!window || !windows[getWindowId(window)].menubar) return;
    windows[getWindowId(window)].menubar.updateItems(menuitems);
    windows[getWindowId(windows[window])].menubar.rebuild();
}

function updateMenuItemAll(menuitem, rebuild) {
    for (window in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, window) || !windows[getWindowId(windows[window])].menubar)
            continue;
        windows[getWindowId(windows[window])].menubar.updateItem(menuitem);
    }
    if (rebuild)
        windows[getWindowId(windows[window])].menubar.rebuild();
}

function updateMenuItemsAll(menuitems, rebuild) {
    for (window in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, window) || !windows[getWindowId(windows[window])].menubar)
            continue;
        windows[getWindowId(windows[window])].menubar.updateItems(menuitems);
    }
    if (rebuild)
        windows[getWindowId(windows[window])].menubar.rebuild();
}
//#endregion