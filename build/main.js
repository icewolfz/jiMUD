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

const timers = [];

require('@electron/remote/main').initialize();

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
    boolean: ['h', 'help', 'v', 'version', 'no-pd', 'no-portable-dir', 'disable-gpu', 'd', 'debug', '?', 'il', 'ignore-layout', 'nci', 'noCharacterImport'],
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
        'il': ['ignore-layout'],
        'nci': ['noCharacterImport']
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
        console.log('-nci, --noCharacterImport           Do not import old character.json');
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
global.mapFile = parseTemplate(path.join('{data}', 'map.sqlite'));
let set = settings.Settings.load(global.settingsFile);
global.debug = false;
global.editorOnly = false;
global.updating = false;
let _checkingUpdates = false;

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

if (!argv.nci && isFileSync(path.join(app.getPath('userData'), 'characters.json'))) {
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
                    Name: character.name || (title || '').replace(/[^a-zA-Z0-9]+/g, ''),
                    Password: character.password,
                    Preferences: character.settings,
                    Map: character.map,
                    Notes: path.join('{characters}', `${title}.notes`),
                    TotalMilliseconds: 0,
                    TotalDays: 0,
                    LastConnected: 0
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
            if (global.debug || set.enableDebug) {
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
        bounds = options.bounds || {
            x: 0,
            y: 0,
            width: 800,
            height: 600,
        };
    // Create the browser window.
    let window = new BrowserWindow({
        parent: options.parent || null,
        title: options.title || 'jiMUD',
        x: getWindowX(bounds.x, bounds.width),
        y: getWindowY(bounds.y, bounds.height),
        width: bounds.width,
        height: bounds.height,
        backgroundColor: options.backgroundColor || '#000',
        show: false,
        icon: path.join(__dirname, options.icon || '../assets/icons/png/64x64.png'),
        skipTaskbar: !set.showInTaskBar,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: set ? set.spellchecking : false,
            enableRemoteModule: 'remote' in options ? options.remote : true,
            contextIsolation: false,
            backgroundThrottling: set ? set.enableBackgroundThrottling : true,
            preload: path.join(__dirname, 'preload.js')
        },
        //titleBarStyle: 'hidden',
        //titleBarOverlay: true
    });
    if (!('remote' in options) || options.true)
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
        initializeChildWindow(childWindow, url, details);

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

        childWindow.on('closed', e => {
            if (window && !window.isDestroyed())
                executeScriptClient(`if(typeof childClosed === "function") childClosed('${file}', '${url}', '${frameName}');`, window, true);
            idMap.delete(childWindow);
        });
        childWindow.on('close', e => {
            states[file] = saveWindowState(childWindow);
            const id = getWindowId(window);
            const index = getChildWindowIndex(windows[id].windows, childWindow);
            if (window && !window.isDestroyed()) {
                if (index !== -1 && windows[id].windows[index].details.options.persistent) {
                    e.preventDefault();
                    executeScript('if(typeof closeHidden !== "function" || closeHidden(true)) window.hide();', childWindow);
                }
            }
        });
        windows[getWindowId(window)].windows.push({ window: childWindow, details: details });
        idMap.set(childWindow, getWindowId(window));
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
        loadWindowScripts(window, options.script || 'manager');
        executeScript(`if(typeof setId === "function") setId(${getWindowId(window)});`, window);
        executeScript('if(typeof loadTheme === "function") loadTheme(\'' + set.theme.replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\');', window);
        if (options.data && options.data.data)
            executeScript('if(typeof restoreWindow === "function") restoreWindow(' + JSON.stringify(options.data.data) + ');', window);
        updateJumpList();
        if (options.data && options.data.state)
            restoreWindowState(window, options.data.state);
        else if (states[options.file])
            restoreWindowState(window, states[options.file]);
        else
            window.show();
        if (options.menubar)
            options.menubar.enabled = true;
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
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('restore');
        states[options.file] = saveWindowState(window);
    });
    window.on('maximize', () => {
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('maximize');
        states[options.file] = saveWindowState(window);
    });
    window.on('unmaximize', () => {
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('unmaximize');
        states[options.file] = saveWindowState(window);
    });

    window.on('resized', () => {
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('resized');
        states[options.file] = saveWindowState(window);
    });
    if (!options.id) {
        _windowID++;
        //in case the new id is used from old layout loop until find empty id
        while (windows[_windowID])
            _windowID++;
        options.id = _windowID;
    }
    windows[options.id] = { window: window, clients: [], current: 0, menubar: options.menubar, windows: [] };
    if (options.menubar) {
        options.menubar.window = window;
        options.menubar.enabled = false;
    }
    idMap.set(window, options.id);
    return options.id;
}

function createDialog(options) {
    if (!options)
        options = {};
    options.parent = options.parent || getActiveWindow().window;
    const bounds = options.parent.getBounds();
    //a bounds passed do some basic safety checks
    if (options.bounds) {
        //check for width/height if missing default
        if (!('width' in options.bounds))
            options.bounds.width = 500;
        if (!('height' in options.bounds))
            options.bounds.height = 560;
        //check coords first as x and y could be 0 and that returns false
        if (!('x' in options.bounds))
            options.bounds.x = Math.floor(bounds.x + bounds.width / 2 - options.bounds.width / 2);
        if (!('y' in options.bounds))
            options.bounds.y = Math.floor(bounds.y + bounds.height / 2 - options.bounds.height / 2);
    }
    else
        options.bounds = {
            x: Math.floor(bounds.x + bounds.width / 2 - 250),
            y: Math.floor(bounds.y + bounds.height / 2 - 280),
            width: 500,
            height: 560,
        }
    const window = new BrowserWindow({
        parent: options.parent,
        modal: options.modal,
        x: options.bounds.x,
        y: options.bounds.y,
        width: options.bounds.width || 500,
        height: options.bounds.height || 560,
        movable: options.modal ? false : true,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        show: false,
        resizable: options.modal ? false : (options.resize || false),
        title: options.title || 'jiMUD',
        icon: options.icon || path.join(__dirname, '../assets/icons/png/64x64.png'),
        backgroundColor: options.backgroundColor || '#000',
        webPreferences: {
            nodeIntegration: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: set ? set.spellchecking : false,
            enableRemoteModule: true,
            contextIsolation: false,
            backgroundThrottling: set ? set.enableBackgroundThrottling : true,
            preload: path.join(__dirname, 'preload.js')
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
        if (global.debug)
            openDevtools(window.webContents, { activate: false });
    });
    addInputContext(window, set.spellchecking);
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
            msg += '-l=[file], --layout=[file] - Load window layout file\n';
            msg += '-il, --ignore-layout - Ignore layout and do not save window states\n';
            msg += '-nci, --noCharacterImport - Do not import old character.json';
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
            console.log('-nci, --noCharacterImport           Do not import old character.json');
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

    if (Array.isArray(argv.s)) {
        global.settingsFile = parseTemplate(argv.s[0]);
        set = settings.Settings.load(global.settingsFile);
    }
    else if (argv.s) {
        global.settingsFile = parseTemplate(argv.s);
        set = settings.Settings.load(global.settingsFile);
    }

    if (Array.isArray(argv.m))
        global.mapFile = parseTemplate(argv.m[0]);
    else if (argv.m)
        global.mapFile = parseTemplate(argv.m);



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
            newClientWindow();
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
        checkForUpdates();
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
            newClientWindow();
        }
    }
});

app.on('before-quit', async (e) => {
    if (!await canCloseAllWindows(true)) {
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
        case 'mapfile':
            event.returnValue = global.mapfile;
            break;
        case 'debug':
            event.returnValue = global.debug;
            break;
        case 'updating':
            event.returnValue = global.updating;
            break;
        case 'closeAll':
            event.returnValue = global.closeAll || false;
            break;
        case 'noCloseAll':
            event.returnValue = global.noCloseAll || false;
            break;
        case 'layout':
            event.returnValue = _layout;
            break;
        case 'theme':
            event.returnValue = set ? set.theme : '';
            break;
        case 'askonloadCharacter':
            event.returnValue = set ? set.askonloadCharacter : true;
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
        case 'mapfile':
            global.mapfile = value;
            break;
        case 'debug':
            global.debug = value;
            break;
        case 'updating':
            global.updating = value;
            break;
        case 'closeAll':
            global.closeAll = value;
            break;
        case 'noCloseAll':
            global.noCloseAll = value;
            break;
    }
});


ipcMain.on('get-setting', (event, key) => {
    if (!set) {
        event.returnValue = null;
        return;
    }
    switch (key) {
        case 'theme':
            event.returnValue = set.theme;
            break;
        case 'askonloadCharacter':
            event.returnValue = set.askonloadCharacter;
            break;
        case 'spellchecking':
            event.returnValue = set.spellchecking;
            break;
        case 'alwaysShowTabs':
            event.returnValue = set.alwaysShowTabs;
            break;
        case 'enableBackgroundThrottling':
            event.returnValue = set.enableBackgroundThrottling;
            return;
        case 'showTabsAddNewButton':
            event.returnValue = set.showTabsAddNewButton;
            return;
        case 'askOnCloseAll':
            event.returnValue = set.askOnCloseAll;
            return;
        default:
            event.returnValue = null;
            break;
    }
});

ipcMain.on('set-setting', (event, key, value) => {
    if (!set)
        return;
    switch (key) {
        case 'theme':
            set.theme = value;
            set.save(global.settingsFile);
            break;
        case 'askonloadCharacter':
            set.askonloadCharacter = value;
            set.save(global.settingsFile);
            break;
        case 'spellchecking':
            set.spellchecking = value;
            set.save(global.settingsFile);
            break;
        case 'alwaysShowTabs':
            set.alwaysShowTabs = value;
            set.save(global.settingsFile);
            break;
        case 'enableBackgroundThrottling':
            set.enableBackgroundThrottling = value;
            set.save(global.settingsFile);
            break;
        case 'showTabsAddNewButton':
            set.showTabsAddNewButton = value;
            set.save(global.settingsFile);
            break
        case 'askOnCloseAll':
            set.askOnCloseAll = value;
            set.save(global.settingsFile);
            break
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

ipcMain.on('set-progress', (event, progress, mode) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const clientId = getClientId(browserViewFromContents(event.sender));
    const windowId = getWindowId(window);
    clients[clientId].progress = progress.value;
    clients[clientId].progressMode = progress.mode || mode;
    const cl = windows[windowId].clients.length;
    let totalProgress = 0.0;
    let totalCount = 0;
    let progressMode = 'normal';
    for (let c = 0; c < cl; c++) {
        if (clients[windows[windowId].clients[c]].progress === -1 || !('progress' in clients[windows[windowId].clients[c]]))
            continue;
        if (clients[clientId].progressMode && clients[clientId].progressMode.length)
            progressMode = clients[clientId].progressMode;
        totalProgress += clients[windows[windowId].clients[c]].progress;
        totalCount++;
    }
    if (!totalCount)
        totalProgress = -1;
    else
        totalProgress /= totalCount;

    window.setProgressBar(totalProgress, { mode: progressMode });
});

ipcMain.on('reload-profiles', event => {
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        clients[clientId].view.webContents.send('reload-profiles');
    }
});

ipcMain.on('reload-profile', (event, profile) => {
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        clients[clientId].view.webContents.send('reload-profile', profile);
    }
});

ipcMain.on('get-characters', (event, options) => {
    event.returnValue = _characters.getCharacters(options);
});

ipcMain.on('get-character', (event, id, property) => {
    let character = _characters.getCharacter(id);
    event.returnValue = character ? (property ? character[property] : character) : null;
});

ipcMain.on('updatef-character', (event, character, id) => {
    _characters.updateCharacter(character);
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId) || clientId === id)
            continue;
        clients[clientId].view.webContents.send('character-updated', character);
    }
});

ipcMain.on('add-character', (event, character) => {
    event.returnValue = _characters.addCharacter(character);
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        clients[clientId].view.webContents.send('character-added', character);
    }
});

ipcMain.on('get-character-next-id', (event) => {
    event.returnValue = _characters.getNextId();
});

ipcMain.on('remove-character', (event, id) => {
    _characters.removeCharacter(id);
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
    var sWindow = BrowserWindow.fromWebContents(event.sender);
    if (type === 'showMessageBox')
        return dialog.showMessageBox(sWindow, ...args);
    else if (type === 'showSaveDialog')
        return dialog.showSaveDialog(sWindow, ...args);
    else if (type === 'showOpenDialog')
        return dialog.showOpenDialog(sWindow, ...args);
    return new Promise();
});

ipcMain.on('show-error-box', (event, title, contents) => {
    dialog.showErrorBox(title, contents);
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
    else if (action === 'update')
        updateWindow(current, getChildParentWindow(current), ...args);
    else if (action === 'updateAll')
        updateAll(...args);
    else if (action === 'setProgress' || action === 'setProgressBar')
        current.setProgressBar(...args);
});

ipcMain.handle('parent-window', (event, action, ...args) => {
    var current = BrowserWindow.fromWebContents(event.sender);
    //get parent or default back to caller
    current = current.getParentWindow() || current;
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
    else if (action === 'update')
        updateWindow(current, getChildParentWindow(current), ...args);
    else if (action === 'updateAll')
        updateAll(...args);
    else if (action === 'setProgress' || action === 'setProgressBar')
        current.setProgressBar(...args);
});

ipcMain.handle('contents', (event, action, ...args) => {
    if (event.sender.isDestroyed()) return;
    if (action === 'update')
        updateWebContents(event.sender, ...args);
})

ipcMain.on('window-info', (event, info, id, ...args) => {
    if (info === "child-count") {
        event.returnValue = clients[id] ? clients[id].windows.length : 0;
    }
    else if (info === 'child-open') {
        if (!clients[id] || !args || args.length === 0) {
            event.returnValue = 0;
            return
        }
        const wl = clients[id].windows.length;
        for (var idx = 0; idx < wl; idx++) {
            const window = clients[id].windows[idx].window;
            //call any code hooks in the child windows
            if (window && !window.isDestroyed() && window.getTitle().startsWith(args[0])) {
                event.returnValue = 1;
                return;
            }
        }
        event.returnValue = 0;
    }
    else if (info === 'child-close') {
        if (!clients[id])
            event.returnValue = 0;
        else {
            event.returnValue = clients[id].windows.length;
            closeClientWindows(id);
        }
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

ipcMain.on('inspect', (event, x, y) => {
    event.sender.inspectElement(x || 0, y || 0);
});

//#region Client creation, docking, and related management
ipcMain.on('new-client', (event, connection, data) => {
    newConnection(BrowserWindow.fromWebContents(event.sender), connection, data);
});

ipcMain.on('new-window', (event, connection, data) => {
    newClientWindow(BrowserWindow.fromWebContents(event.sender), connection, data);
});

ipcMain.on('switch-client', (event, id, offset) => {
    if (clients[id]) {
        const window = BrowserWindow.fromWebContents(event.sender);
        const windowId = getWindowId(window);
        if (window != clients[id].parent) {
            //TODO probably wanting to dock from 1 window to another
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
        windowId = createWindow({ remote: false });
        windows[windowId].menubar = createMenu(windows[windowId].window);
        //windows[windowId].menubar.enabled = false;
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
    if (await canCloseAllWindows(true)) {
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

ipcMain.on('get-options', event => {
    const view = browserViewFromContents(event.sender);
    event.returnValue = clients[getClientId(view)].options;
});

ipcMain.on('get-preference', (event, preference) => {
    event.returnValue = set[preference];
});

ipcMain.on('set-preference', (event, preference, value) => {
    set[preference] = value;
});

ipcMain.on('reload-options', (events, preferences, clientId) => {
    if (preferences === global.settingsFile) {
        set = settings.Settings.load(global.settingsFile);
        for (window in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, window))
                continue;
            windows[window].window.webContents.send('reload-options');
        }
        //TODO add tray support back
    }
    for (id in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, id) || getClientId(clients[id].view) === clientId)
            continue;
        clients[id].view.webContents.send('reload-options', preferences, preferences === global.settingsFile);
        updateWebContents(clients[id].view.webContents, set);
    }
});

ipcMain.on('get-client-id', event => {
    event.returnValue = getClientId(browserViewFromContents(event.sender));
})
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
            backgroundThrottling: set ? set.enableBackgroundThrottling : true,
            preload: path.join(__dirname, 'preload.js')
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
            executeScript('if(typeof loadTheme === "function") loadTheme(\'' + set.theme.replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\');', clients[options.id].view);
            /*
            if (options.data)
                executeScript('if(typeof restoreWindow === "function") restoreWindow(' + JSON.stringify({ data: options.data.data, windows: options.data.windows, states: options.data.states }) + ');', clients[options.id].view);
            else
                executeScript('if(typeof restoreWindow === "function") restoreWindow({data: {}, windows: [], states: {}});', clients[options.id].view);
            */
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
        initializeChildWindow(childWindow, url, details);

        childWindow.on('resize', () => {
            states[file] = saveWindowState(childWindow);
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('move', () => {
            states[file] = saveWindowState(childWindow);
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('maximize', () => {
            states[file] = saveWindowState(childWindow);
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('unmaximize', () => {
            states[file] = saveWindowState(childWindow);
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('resized', () => {
            states[file] = saveWindowState(childWindow);
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('closed', () => {
            if (view && view.webContents && !view.webContents.isDestroyed()) {
                executeScript(`if(typeof childClosed === "function") childClosed('${file}', '${url}', '${frameName}');`, view, true);
                //remove remove from list
                const id = getClientId(view);
                const index = getChildWindowIndex(clients[id].windows, childWindow);
                if (index !== -1) {
                    clients[id].windows[index] = null;
                    clients[id].windows.splice(index, 1);
                }
            }
            idMap.delete(childWindow);
        });

        childWindow.on('close', e => {
            const id = getClientId(view);
            const index = getChildWindowIndex(clients[id].windows, childWindow);
            if (index !== -1 && clients[id].windows[index].details.options.persistent) {
                e.preventDefault();
                executeScript('if(typeof closeHidden !== "function" || closeHidden(true)) window.hide();', childWindow);
                states[file] = saveWindowState(childWindow);
                clients[getClientId(view)].states[file] = states[file];
                return;
            }
            states[file] = saveWindowState(childWindow);
            clients[id].states[file] = states[file];
            executeCloseHooks(childWindow);
        });

        clients[getClientId(view)].windows.push({ window: childWindow, details: details });
        idMap.set(childWindow, getClientId(view));
    });

    view.setAutoResize({
        width: true,
        height: true
    })
    if (options.data && options.data.state) {
        view.setBounds(options.data.state.bounds);
        if (global.debug)
            openDevtools(view.webContents, { activate: false });
        else if (options.data.state.devTools)
            openDevtools(view.webContents);
    }
    else {
        view.setBounds({
            x: 0,
            y: options.offset || 0,
            width: options.bounds.width,
            height: options.bounds.height
        });
        if (global.debug)
            openDevtools(view.webContents, { activate: false });
    }
    //TODO change to index.html once basic window system is working
    view.webContents.loadFile(options.file);
    require("@electron/remote/main").enable(view.webContents);
    if (!options.id) {
        _clientID++;
        //in case the new id is used from old layout loop until find empty id
        while (clients[_clientID])
            _clientID++;
        options.id = _clientID;
    }
    clients[options.id] = { view: view, windows: [], parent: null, file: options.file !== 'build/index.html' ? options.file : 0, states: {} };
    idMap.set(view, options.id);
    loadWindowScripts(view, options.script || 'user');
    script = `if(typeof setId === "function") setId(${options.id});if(typeof loadTheme === "function") loadTheme('${set.theme.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}');`;
    if (options.data)
        clients[options.id].options = { data: options.data.data, windows: options.data.windows || [], states: options.data.states || {} };
    else
        clients[options.id].options = { data: {}, windows: [], states: {} };
    // + 'if(typeof restoreWindow === "function") restoreWindow(' + JSON.stringify(clients[options.id].options) + ');'
    executeScript(script, clients[options.id].view);
    //win.setTopBrowserView(view)    
    //addBrowserView
    //setBrowserView  
    //addInputContext(view, set.spellchecking);
    return options.id;
}

async function removeClient(id) {
    const client = clients[id];
    const cancel = await canCloseClient(id, true);
    //const cancel = await executeScript('if(typeof closeable === "function") closeable()', client.view);
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
    //no windows so just bail
    if (!clients[id] || clients[id].windows.length === 0) return;
    const wl = clients[id].windows.length;
    for (var idx = 0; idx < wl; idx++) {
        const window = clients[id].windows[idx].window;
        //call any code hooks in the child windows
        if (window && !window.isDestroyed()) {
            //executeCloseHooks(window);
            window.close();
        }
    }
}

function setClientWindowsParent(id, parent, oldParent) {
    //no windows so just bail
    if (clients[id].windows.length === 0) return;
    const wl = clients[id].windows.length;
    for (var idx = 0; idx < wl; idx++) {
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

async function canCloseClient(id, warn, all, allWindows) {
    const client = clients[id];
    let close = await executeScript(`if(typeof closeable === "function") closeable(${all}, ${allWindows})`, client.view);
    //main client can not close so no need to check children
    if (close === false)
        return false;
    const wl = client.windows.length;
    for (let w = 0; w < wl; w++) {
        //check each child window just to be saft
        close = await executeScript(`if(typeof closeable === "function") closeable(${all}, ${allWindows})`, client.windows[w].window);
        if (client.windows[w].window.isModal()) {
            if (warn) {
                dialog.showMessageBox(mWindow, {
                    type: 'info',
                    message: `All modal dialogs must be closed before you can exit.`
                });
                client.windows[w].window.focus();
            }
            return false;
        }
        if (close === false)
            return false;
    }
    return true;;
}

async function canCloseAllClients(windowId, warn, all) {
    //reset all tracking unless its all windows trying to close
    if (!all) {
        global.closeAll = false;
        global.noCloseAll = false;
    }
    const cl = windows[windowId].clients.length;
    for (var idx = 0; idx < cl; idx++) {
        const close = await canCloseClient(windows[windowId].clients[idx], warn, true, all);
        if (!close)
            return false;
    }
    return true;
}

async function canCloseAllWindows(warn) {
    //reset all tracking
    global.closeAll = false;
    global.noCloseAll = false;
    for (window in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, window))
            continue;
        const close = await canCloseAllClients(window, warn, true);
        if (!close)
            return false;
    }
    return true;
}

function initializeChildWindow(window, link, details) {
    require("@electron/remote/main").enable(window.webContents);
    window.removeMenu();
    window.once('ready-to-show', () => {
        loadWindowScripts(window, details.frameName);
        if (!details.options.noInputContext)
            addInputContext(window, set.spellchecking);
        if (!details.options.hide)
            window.show();
        if (global.debug)
            openDevtools(window.webContents, { activate: false });
    });
    window.webContents.on('render-process-gone', (event, goneDetails) => {
        logError(`${link} render process gone, reason: ${goneDetails.reason}, exitCode ${goneDetails.exitCode}\n`, true);
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
                logError(`${link} unresponsive, reload.\n`, true);
            }
            else if (result.response === 2) {
                window.destroy();
            }
            else
                logError(`${link} unresponsive, waiting.\n`, true);
        });
    });

    window.webContents.setWindowOpenHandler((childDetails) => {
        var u = new url.URL(childDetails.url);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
            shell.openExternal(childDetails.url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: buildOptions(childDetails, window, set)
        }
    });

    window.webContents.on('did-create-window', (childWindow, childDetails) => {
        initializeChildWindow(childWindow, childDetails.url, childDetails);
    });
}

function getChildWindowIndex(windows, childWindow) {
    if (!windows | windows.length === 0) return -1;
    for (var idx = 0, wl = windows.length; idx < wl; idx++) {
        if (windows[idx].window === childWindow)
            return idx;
    }
    return -1;
}

function getWindowClientId(window) {
    const clientId = idMap.get(window);
    if (clients[clientId])
        return clientId;
    return null;
}

function executeCloseHooks(window) {
    if (!window) return;
    executeScript('if(typeof closing === "function") closing();', window);
    executeScript('if(typeof closed === "function") closed();', window);
    executeScript('if(typeof closeHidden === "function") closeHidden();', window);
}

function updateIcon(window) {
    //TODO needs better logic to handle focus/unfocused of multiple windows
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
    //TODO updateTray when added
}

ipcMain.on('parseTemplate', (event, str, data) => {
    event.returnValue = parseTemplate(str, data);
});

function parseTemplate(str, data) {
    if (!str) return str;
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
    if (global.debug || set.enableDebug)
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
             * TODO need to figure this out, 
             * either need to use node-ipc or some way to communicate between instances, 
             * also to see if an instance is even open, can use requestSingleInstanceLock
             * but then everything has to be in 1 program even editor only and that
             * requires changing how that works when client is also open
             * 
             * maybe offer an option to make all 1 instance or separate, and add/remove
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
function createUpdater(window) {
    const autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.on('download-progress', progressObj => {
        window.setProgressBar(progressObj.percent / 100);
        const progress = getWindowId('progress');
        if (progress)
            progress.webContents.send('progress', progressObj);
    });
    return autoUpdater;
}

function checkForUpdates() {
    const window = getActiveWindow().window;
    if (set.checkForUpdates && !_checkingUpdates) {
        _checkingUpdates = true;
        //resources/app-update.yml
        if (!isFileSync(path.join(app.getAppPath(), '..', 'app-update.yml'))) {
            if (dialog.showMessageBoxSync({
                type: 'warning',
                title: 'Not supported',
                message: 'Auto update is not supported with this version of jiMUD, try anyways?',
                buttons: ['Yes', 'No'],
                defaultId: 1,
            }) !== 0)
                return;
        }
        const autoUpdater = createUpdater(window);
        autoUpdater.on('update-downloaded', () => {
            window.setProgressBar(-1);
            const progress = getWindowId('progress');
            if (progress)
                progress.close();
            //store current line arguments to use on next load
            fs.writeFileSync(path.join(app.getPath('userData'), 'argv.json'), JSON.stringify(process.argv));
            _checkingUpdates = false;
        });
        autoUpdater.on('error', (error) => {
            dialog.showErrorBox('Error: ', error == null ? 'unknown' : (error.stack || error).toString());
            window.setProgressBar(-1);
            const progress = getWindowId('progress');
            if (progress)
                progress.close();
            _checkingUpdates = false;
        });
        autoUpdater.on('update-available', () => {
            openProgress(window, 'Downloading update&hellip;');
        });
        autoUpdater.on('update-not-available', () => {
            window.setProgressBar(-1);
            const progress = getWindowId('progress');
            if (progress)
                progress.close();
            _checkingUpdates = false;
        });
        autoUpdater.checkForUpdatesAndNotify().then((results) => {
            if (!results)
                _checkingUpdates = false;
        });
    }
}

function checkForUpdatesManual() {
    const window = getActiveWindow().window;
    if (!isFileSync(path.join(app.getAppPath(), '..', 'app-update.yml'))) {
        if (dialog.showMessageBoxSync(window, {
            type: 'warning',
            title: 'Not supported',
            message: 'Auto update is not supported with this version of jiMUD, try anyways?',
            buttons: ['Yes', 'No'],
            defaultId: 1,
        }) !== 0)
            return;
    }
    if (_checkingUpdates) return;
    _checkingUpdates = true;

    const autoUpdater = createUpdater(window);
    autoUpdater.autoDownload = false;
    autoUpdater.on('error', (error) => {
        dialog.showErrorBox('Error: ', error == null ? 'unknown' : (error.stack || error).toString());
        window.setProgressBar(-1);
        const progress = getWindowId('progress');
        if (progress)
            progress.close();
        _checkingUpdates = false;
    });

    autoUpdater.on('update-available', () => {
        dialog.showMessageBox(window, {
            type: 'info',
            title: 'Found Updates',
            message: 'Found updates, do you want update now?',
            buttons: ['Yes', 'No', 'Open website']
        }).then(buttonIndex => {
            if (buttonIndex.response === 0) {
                openProgress(window, 'Downloading update&hellip;');
                autoUpdater.downloadUpdate();
            }
            else {
                if (buttonIndex.response === 2)
                    shell.openExternal('https://github.com/icewolfz/jiMUD/releases/latest', '_blank');
                _checkingUpdates = false;
            }
        });
    });

    autoUpdater.on('update-not-available', () => {
        dialog.showMessageBox(window, {
            title: 'No Updates',
            message: 'Current version is up-to-date.',
            buttons: ['Ok', 'Open website']
        }).then(buttonIndex => {
            if (buttonIndex.response === 1)
                shell.openExternal('https://github.com/icewolfz/jiMUD/releases/latest', '_blank');
            _checkingUpdates = false;
        });
    });

    autoUpdater.on('update-downloaded', () => {
        window.setProgressBar(-1);
        const progress = getWindowId('progress');
        if (progress)
            progress.close();
        _checkingUpdates = false;
        dialog.showMessageBox({
            title: 'Install Updates',
            message: 'Updates downloaded, Quit for update now or when you next restart the application...',
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
    autoUpdater.checkForUpdates().then((results) => {
        if (!results)
            _checkingUpdates = false;
    });
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
            backgroundThrottling: settings ? settings.enableBackgroundThrottling : true,
            preload: path.join(__dirname, 'preload.js')
        }
    };
    if (details.features.length) {
        features = details.features.split(',');
        options.features = {};
        for (var f = 0, fl = features.length; f < fl; f++) {
            feature = features[f].split('=');
            switch (feature[0]) {
                case 'defaultWidth':
                case 'defaultHeight':
                case 'defaultX':
                case 'defaultY':
                case "width":
                case "height":
                case "x":
                case "y":
                    options[feature[0]] = parseInt(feature[1], 10);
                    options.features[feature[0]] = options[feature[0]];
                    break;
                default:
                    if (feature.length === 1 || feature[1] === "true") {
                        options[feature[0]] = true;
                        options.features[feature[0]] = options[feature[0]];
                    }
                    else if (feature[1] === "false") {
                        options[feature[0]] = false;
                        options.features[feature[0]] = options[feature[0]];
                    }
                    else if (feature[1] !== '[object Object]') {
                        options[feature[0]] = feature[1];
                        options.features[feature[0]] = options[feature[0]];
                    }
                    break;
            }
        }
        //if passed but showInTaskBar is passed set skipTaskbar based on that setting
        if (!('skipTaskbar' in options) && 'showInTaskBar' in options)
            options.skipTaskbar = (!options.showInTaskBar && (options.alwaysOnTopClient || options.alwaysOnTop)) ? true : false;
        if (options.alwaysOnTopClient)
            options.parent = window;
    }
    //not passed so see if any previous openings to use them as defaults
    if (states[file]) {
        if (states[file].bounds) {
            if (!('x' in options))
                options.x = states[file].bounds.x;
            if (!('y' in options))
                options.y = states[file].bounds.y;
            if (!('width' in options))
                options.width = states[file].bounds.width;
            if (!('height' in options))
                options.height = states[file].bounds.height;
        }
        Object.keys(states[file]).map(key => {
            if (key === 'bounds') return;
            if (!(key in options))
                options[key] = states[file][key];
        });
    }
    //if no width or height see if a default was supplied
    if (!('width' in options))
        options.width = 'defaultWidth' in options ? options.defaultWidth : 800;
    if (!('height' in options))
        options.height = 'defaultHeight' in options ? options.defaultHeight : 600;
    if (!('x' in options))
        options.x = 'defaultX' in options ? options.defaultX : 0;
    if (!('y' in options))
        options.y = 'defaultY' in options ? options.defaultY : 0;
    if (details.frameName === 'modal' || details.frameName.startsWith('modal-')) {
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
            options.y = getWindowY(options.y, options.height);
    }
    return options;
}
//#endregion
//#region Window/client query functions
function getActiveClient(window) {
    if (!window) return clients[focusedClient];
    if (windows[getWindowId(window)].current === 0 || windows[getWindowId(window)].clients.length === 0)
        return null;
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

function updateWindow(window, parent, options) {
    if (!window || !options) return;
    if ('alwaysOnTopClient' in options)
        window.setParentWindow(options.alwaysOnTopClient ? parent : null);
    if ('alwaysOnTop' in options)
        window.setAlwaysOnTop(options.alwaysOnTop);
    if ('showInTaskBar' in options)
        window.setSkipTaskbar((!options.showInTaskBar && (options.alwaysOnTopClient || options.alwaysOnTop)) ? true : false);
    updateWebContents(window.webContents, options);
    const clientId = getWindowClientId(window);
    for (child in clients[clientId].windows) {
        if (!Object.prototype.hasOwnProperty.call(clients[clientId].windows, child))
            continue;
        if (clients[clientId].windows[child].window === window) {
            //update live options to ensure any window data is saved correctly
            const details = clients[clientId].windows[child].details;
            for (option in options) {
                if (!Object.prototype.hasOwnProperty.call(options, option)) continue;
                details.options[option] = options[option];
                if (option in details.options.features)
                    details.options.features[option] = options[option];
            }
            break;
        }
    }
}

function updateWebContents(contents, options) {
    if (!contents || !options) return;
    if ('enableBackgroundThrottling' in options)
        contents.setBackgroundThrottling(options.enableBackgroundThrottling);
}

function updateAll(options) {
    const windows = BrowserWindow.getAllWindows();
    const l = windows.length;
    for (let idx = 0; idx < l; idx++) {
        if (idMap.has(windows[windows[idx]]) && 'showInTaskBar' in options)
            windows[idx].setSkipTaskbar(!options.showInTaskBar);
        updateWebContents(windows[idx].webContents);
    }
    for (id in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, id))
            continue;
        updateWebContents(clients[id].view.webContents, options);
    }
}

function getChildParentWindow(child) {
    if (!child) return null;
    //if set use current parent
    let parent = child.getParentWindow();
    if (parent) return parent;
    let id = getWindowId(child);
    //if has a parent so find it
    if (typeof id === 'number') {
        //a main window is parent so return the window
        if (windows[id])
            return windows[id].window;
        //if a client return the client parent
        else if (clients[id])
            return clients[id].parent;
    }
    //if all else fails try and drill client child windows
    /*
    for (id in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, id))
            continue;
        //search all the clients for child window
        const wl = clients[id].windows.length;
        for (var idx = 0; idx < wl; idx++) {
            if (clients[id].windows[idx].window === child)
                return clients[id].parent;
        }
    }
    */
    //parent not found so bail
    return null;
}

function newConnection(window, connection, data) {
    let windowId = getWindowId(window);
    let id;
    if (data)
        id = createClient({ offset: windows[windowId].clients.length ? clients[windows[windowId].current].view.getBounds().y : 0, bounds: window.getContentBounds(), data: { data: data } });
    else
        id = createClient({ offset: windows[windowId].clients.length ? clients[windows[windowId].current].view.getBounds().y : 0, bounds: window.getContentBounds() });
    focusedWindow = windowId;
    focusedClient = id;
    windows[windowId].clients.push(id);
    windows[windowId].current = id;
    clients[id].parent = window;
    //did-navigate //fires before dom-ready but view seems to still not be loaded and delayed
    //did-finish-load //slowest but ensures the view is in the window and visible before firing
    window.addBrowserView(clients[id].view);
    window.setTopBrowserView(clients[id].view);
    clients[id].view.webContents.once('dom-ready', () => {
        window.webContents.send('new-client', { id: id });
        if (connection)
            clients[id].view.webContents.send('connection-settings', connection);
        focusWindow(window, true);
        clientsChanged();
    });
}

function newClientWindow(caller, connection, data) {
    if (caller) {
        //save the current states so it has the latest for new window
        states['manager.html'] = saveWindowState(caller);
        //offset the state so it is not an exact overlap
        states['manager.html'].bounds.x += 20;
        states['manager.html'].bounds.y += 20;
        const { height, width } = screen.getPrimaryDisplay().workAreaSize;
        //make sure the window appears on the screen
        if (states['manager.html'].bounds.x > (width - 10))
            states['manager.html'].bounds.x = width - states['manager.html'].bounds.width;
        if (states['manager.html'].bounds.x < 10)
            states['manager.html'].bounds.x = 10;
        if (states['manager.html'].bounds.y > (height - 10))
            states['manager.html'].bounds.y = height - states['manager.html'].bounds.height;
        if (states['manager.html'].bounds.y < 10)
            states['manager.html'].bounds.y = 10;
    }
    let windowId = createWindow({ remote: false });
    windows[windowId].menubar = createMenu(windows[windowId].window);
    //windows[windowId].menubar.enabled = false;    
    let window = windows[windowId].window;
    if (data)
        id = createClient({ bounds: window.getContentBounds(), data: { data: data } });
    else
        id = createClient({ bounds: window.getContentBounds() });
    focusedWindow = windowId;
    focusedClient = id;
    windows[windowId].clients.push(id);
    windows[windowId].current = id;
    clients[id].parent = window;
    window.addBrowserView(clients[id].view);
    window.setTopBrowserView(clients[id].view);
    clients[id].view.webContents.once('dom-ready', () => {
        clientsChanged();
        if (connection)
            clients[id].view.webContents.send('connection-settings', connection);
    });
    window.webContents.once('dom-ready', () => {
        window.webContents.send('new-client', { id: id });
        focusWindow(window, true);
    });
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
            state: saveWindowState(windows[id].window),
            menubar: windows[id].menubar ? true : false
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
            windows: [],
            state: {
                bounds: clients[id].view.getBounds(),
                devTools: clients[id].view.webContents.isDevToolsOpened()
            },
            //get any custom data from window
            data: await executeScript('if(typeof saveWindow === "function") saveWindow()', clients[id].view),
            states: clients[id].states
        }
        const wl = clients[id].windows.length;
        for (var idx = 0; idx < wl; idx++) {
            const window = clients[id].windows[idx].window;
            const wData = {
                client: getClientId(clients[id].view), //use function to ensure proper id data type
                state: saveWindowState(window),
                details: { url: clients[id].windows[idx].details.url, options: clients[id].windows[idx].details.options.features },
                //get any custom data from window
                data: await executeScript('if(typeof saveWindow === "function") saveWindow()', window)
            }
            if (wData.details.parent)
                wData.details.parent = true;
            if (wData.details.options && wData.details.options.parent) {
                wData.details.options.parent = true;
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
    states = data.states || {};
    //no windows so for what ever reason so just start a clean client
    if (data.windows.length === 0) {
        newClientWindow();
        return true;
    }
    //_windowID = data.windowID;
    //_clientID = data.clientID;
    focusedClient = data.focusedClient;
    focusedWindow = data.focusedWindow;
    //create windows
    let i, il = data.windows.length;
    for (i = 0; i < il; i++) {
        createWindow({ id: data.windows[i].id, data: { data: data.windows[i].data, state: data.windows[i].state, states: data.states }, remote: false });
        if (data.windows[i].menubar)
            windows[data.windows[i].id].menubar = createMenu(windows[data.windows[i].id].window);
        //windows[data.windows[i].id].menubar.enabled = false;
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
        //no clients so move on probably different type of window
        if (window.clients.length === 0) {
            if (data.focusedWindow === getWindowId(window))
                window.window.webContents.once('ready-to-show', () => {
                    focusWindow(window, true);
                });
            continue;
        }
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
            }), current);

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
        devTools: global.debug ? false : window.webContents.isDevToolsOpened(),
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
    if (global.debug)
        openDevtools(window.webContents, { activate: false });
    else if (state.devTools)
        openDevtools(window.webContents);
    if (!state.enabled)
        window.setEnabled(false);
    if (state.alwaysOnTop)
        window.setAlwaysOnTop(true);
}
//#endregion
//#region Client window menu code
function createMenu(window) {
    var menuTemp = [
        //File
        {
            label: '&File',
            id: 'file',
            submenu: [
                {
                    label: 'New &Connection',
                    id: 'newConnect',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: (item, mWindow, keyboard) => {
                        //allow for some hidden ways to force open main/dev if needed with out the complex menus
                        if (!keyboard.triggeredByAccelerator) {
                            if (keyboard.ctrlKey)
                                newConnection(window || mWindow, { dev: true });
                            else if (keyboard.shiftKey)
                                newConnection(window || mWindow, { dev: false });
                            else
                                newConnection(window || mWindow);
                        }
                        else
                            newConnection(window || mWindow);
                    }
                },
                {
                    label: 'New &Window',
                    id: '',
                    accelerator: 'CmdOrCtrl+Alt+N',
                    click: (item, mWindow, keyboard) => {
                        //allow for some hidden ways to force open main/dev if needed with out the complex menus
                        if (!keyboard.triggeredByAccelerator) {
                            if (keyboard.ctrlKey)
                                newClientWindow(window || mWindow, { dev: true });
                            else if (keyboard.shiftKey)
                                newClientWindow(window || mWindow, { dev: false });
                            else
                                newClientWindow(window || mWindow);
                        }
                        else
                            newClientWindow(window || mWindow);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: '&Connect',
                    id: 'connect',
                    accelerator: 'CmdOrCtrl+N',
                    click: (item, mWindow) => {
                        executeScriptClient('client.connect()', window || mWindow, true);
                    }
                },
                {
                    label: '&Disconnect',
                    id: 'disconnect',
                    accelerator: 'CmdOrCtrl+D',
                    enabled: false,
                    click: (item, mWindow) => {
                        executeScriptClient('client.close()', window || mWindow, true);
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
                        executeScriptClient('toggleParsing()', window || mWindow, true);
                    }
                },
                {
                    label: 'E&nable triggers',
                    id: 'enableTriggers',
                    type: 'checkbox',
                    checked: true,
                    click: (item, mWindow) => {
                        executeScriptClient('toggleTriggers()', window || mWindow, true);
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
                        executeScriptClient('openWindow("characters")', window || mWindow, true);
                    }
                },
                { type: 'separator' },
                {
                    label: '&Log',
                    id: 'log',
                    type: 'checkbox',
                    checked: false,
                    click: (item, mWindow) => {
                        executeScriptClient('toggleLogging()', window || mWindow, true);
                    }
                },
                {
                    label: '&View logs...',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("log.viewer")', window || mWindow, true);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: '&Global Preferences...',
                    id: 'globalPreferences',
                    accelerator: 'CmdOrCtrl+Comma',
                    click: (item, mWindow) => openPreferences(window || mWindow)
                },
                {
                    label: '&Preferences...',
                    id: 'preferences',
                    accelerator: 'CmdOrCtrl+Comma',
                    click: (item, mWindow) => executeScriptClient('openWindow("prefs");', window || mWindow, true),
                    visible: false
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Clo&se',
                    id: 'close',
                    accelerator: 'CmdOrCtrl+W',
                    enabled: false,
                    visible: false,
                    click: (item, mWindow) => {
                        mWindow = window || mWindow;
                        if (windows[getWindowId(mWindow)].clients.length === 1)
                            mWindow.close();
                        else
                            removeClient(windows[getWindowId(mWindow)].current, true);
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
                        executeScriptClient('copyAsHTML();', window || mWindow, true);
                    }
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    click: (item, mWindow) => {
                        executeScriptClient('client.commandInput.dataset.selStart = client.commandInput.selectionStart;client.commandInput.dataset.selEnd = client.commandInput.selectionEnd;paste()', window || mWindow, true);
                    }
                },
                {
                    label: 'Paste special',
                    accelerator: 'CmdOrCtrl+Shift+V',
                    click: (item, mWindow) => {
                        executeScriptClient('client.commandInput.dataset.selStart client.commandInput.selectionStart;client.commandInput.dataset.selEnd = client.commandInput.selectionEnd;pasteSpecial()', window || mWindow, true);
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
                        executeScriptClient('selectAll()', window || mWindow, true);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Clear',
                    click: (item, mWindow) => {
                        executeScriptClient('client.clear()', window || mWindow, true);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Find',
                    accelerator: 'CmdOrCtrl+F',
                    click: (item, mWindow) => {
                        focusWindow(window || mWindow, true);
                        executeScriptClient('client.display.showFind()', window || mWindow);
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
                        executeScriptClient('client.toggleScrollLock()', window || mWindow, true);
                    }
                },
                {
                    label: '&Who is on?...',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("who")', window || mWindow, true);
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
                                executeScriptClient('toggleView("status")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Refresh',
                            id: 'refresh',
                            click: (item, mWindow) => {
                                executeScriptClient('client.sendGMCP(\'Core.Hello { "client": "\' + client.telnet.terminal + \'", "version": "\' + client.telnet.version + \'" }\');', window || mWindow, true);
                            }
                        },
                        { type: 'separator' },
                        {
                            label: '&Weather',
                            id: 'weather',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("weather")', window || mWindow, true);
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
                                        executeScriptClient('toggleView("limbs")', window || mWindow, true);
                                    }
                                },
                                { type: 'separator' },
                                {
                                    label: '&Health',
                                    id: 'limbhealth',
                                    type: 'checkbox',
                                    checked: true,
                                    click: (item, mWindow) => {
                                        executeScriptClient('toggleView("limbhealth")', window || mWindow, true);
                                    }
                                },
                                {
                                    label: '&Armor',
                                    id: 'limbarmor',
                                    type: 'checkbox',
                                    checked: true,
                                    click: (item, mWindow) => {
                                        executeScriptClient('toggleView("limbarmor")', window || mWindow, true);
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
                                executeScriptClient('toggleView("health")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Experience',
                            id: 'experience',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("experience")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Party Health',
                            id: 'partyhealth',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("partyhealth")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Combat Health',
                            id: 'combathealth',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("combathealth")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Lag meter',
                            id: 'lagmeter',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("lagmeter")', window || mWindow, true);
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
                      executeScript('toggleView("buttons")', window || mWindow, true);
                    },
                    */
                    submenu: [
                        {
                            label: '&Visible',
                            id: 'buttonsvisible',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("buttons")', window || mWindow, true);
                            }
                        },
                        { type: 'separator' },
                        {
                            label: '&Connect',
                            id: 'connectbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.connect")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Characters',
                            id: 'charactersbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.characters")', window || mWindow, true);
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
                                executeScriptClient('toggleView("button.preferences")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Log',
                            id: 'logbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.log")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Clear',
                            id: 'clearbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.clear")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Lock',
                            id: 'lockbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.lock")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Map',
                            id: 'mapbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.map")', window || mWindow, true);
                            }
                        },
                        /*
                        {
                          label: 'M&ail',
                          id: "mailbutton",
                          type: 'checkbox',
                          checked: true,
                          click: (item, mWindow) => {
                            executeScriptClient('toggleView("button.mail")', window || mWindow, true);
                          }
                        },
                        {
                          label: '&Compose mail',
                          id: "composebutton",
                          type: 'checkbox',
                          checked: true,
                          click: (item, mWindow) => {
                            executeScriptClient('toggleView("button.compose")', window || mWindow, true);
                          }
                        },
                        */
                        {
                            label: '&User buttons',
                            id: 'userbutton',
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.user")', window || mWindow, true);
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
                                mWindow = window || mWindow;
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
                                mWindow = window || mWindow;
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
                                mWindow = window || mWindow;
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
            //role: 'window',
            id: 'window',
            label: '&Window',
            submenu: [
                {
                    label: '&Advanced editor...',
                    id: 'editor',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("editor")', window || mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+E'
                },
                {
                    label: '&Chat...',
                    id: 'chat',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("chat")', window || mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+L'
                },
                {
                    label: '&Immortal tools...',
                    id: 'immortal',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("immortal")', window || mWindow, true);
                    },
                    visible: false,
                    accelerator: 'CmdOrCtrl+I'
                },
                {
                    label: 'Code &editor...',
                    id: 'codeeditor',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("code.editor")', window || mWindow, true);
                    },
                },
                {
                    label: '&Map...',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("mapper")', window || mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+T'
                },
                {
                    label: '&Skills...',
                    id: 'skills',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("skills")', window || mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+S'
                },
                {
                    label: 'Command &history...',
                    id: 'history',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("history")', window || mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+Shift+H'
                },
                { type: 'separator' },
                {
                    label: 'Save &Layout',
                    id: 'saveLayout',
                    click: (item, mWindow) => {
                        var file = dialog.showSaveDialogSync(window || mWindow, {
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
                        dialog.showOpenDialog(window || mWindow, {
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
                                dialog.showMessageBox(window || mWindow, {
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
                    click: (item, mWindow) => {
                        dialog.showMessageBox({
                            type: 'info',
                            message: 'Load default layout?',
                            buttons: ['Yes', 'No']
                        }).then(result => {
                            if (result.response === 0) {
                                _layout = parseTemplate(path.join('{data}', 'window.layout'));
                                if (isFileSync(path.join(app.getPath('userData'), 'window.layout'))) {
                                    if (!loadWindowLayout())
                                        dialog.showMessageBox(window || mWindow, {
                                            type: 'error',
                                            message: `Error loading: default layout.`
                                        });
                                    else
                                        _loaded = true;
                                }
                                else
                                    dialog.showMessageBox(window || mWindow, {
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
                    executeScriptClient('showMail()', window || mWindow, true);
                  },
                  visible: true,
                  //accelerator: 'CmdOrCtrl+M'
                },
                {
                  label: '&Compose mail...',
                  click: (item, mWindow) => {
                    executeScriptClient('showComposer()', window || mWindow, true);
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
                        executeScriptClient('openWindow("smhelp")', window || mWindow, true);
                    }
                },
                {
                    label: '&jiMUD...',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("help")', window || mWindow, true);
                    }
                },
                {
                    label: '&jiMUD website...',
                    click: (item, mWindow) => {
                        shell.openExternal('https://github.com/icewolfz/jiMUD/tree/master/docs', '_blank');
                        focusWindow(window || mWindow);
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
                    click: (item, mWindow) => openAbout(window || mWindow)
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
                    label: 'E&xit',
                    //role: 'quit'
                    click: quitApp
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
                label: 'Clo&se',
                accelerator: 'CmdOrCtrl+W',
                click: (item, mWindow) => {
                    mWindow = window || mWindow;
                    if (windows[getWindowId(mWindow)].clients.length === 1)
                        mWindow.close();
                    else
                        removeClient(windows[getWindowId(mWindow)].current, true);
                }
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
                label: 'Clo&se',
                accelerator: 'CmdOrCtrl+W',
                click: (item, mWindow) => {
                    mWindow = window || mWindow;
                    if (windows[getWindowId(mWindow)].clients.length === 1)
                        mWindow.close();
                    else
                        removeClient(windows[getWindowId(mWindow)].current, true);
                }
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
                executeScriptClient('client.toggleProfile("default")', window || mWindow, true);
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
            accelerator: 'CmdOrCtrl+P',
            //click: (item, mWindow) => openProfileManager(window || mWindow)
            click: (item, mWindow) => executeScriptClient('openWindow("profiles")', window || mWindow, true)

        });
    return new Menubar(menuTemp, window);
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

ipcMain.on('show-global-preferences', event => {
    openPreferences(BrowserWindow.fromWebContents(event.sender));
})

ipcMain.on('show-about', event => {
    openAbout(BrowserWindow.fromWebContents(event.sender));
});

ipcMain.on('show-profile-manager', event => {
    openProfileManager(BrowserWindow.fromWebContents(event.sender));
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
    if (rebuild)
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

function openPreferences(parent) {
    let window = getWindowId('prefs');
    if (window && !window.isDestroyed())
        window.focus();
    else {
        window = createDialog({
            show: true,
            parent: parent,
            url: path.join(__dirname, 'prefs.html'),
            title: 'Global Preferences',
            bounds: { width: 800, height: 460 },
            icon: path.join(__dirname, '../assets/icons/png/preferences.png'),
            modal: true
        });
        window.on('closed', () => idMap.delete('prefs'));
        idMap.set('prefs', window);
    }
}

function openAbout(parent) {
    let window = getWindowId('about');
    if (window && !window.isDestroyed())
        window.focus();
    else {
        window = createDialog({ show: true, parent: parent, url: path.join(__dirname, 'about.html'), title: 'About jiMUD', bounds: { width: 500, height: 560 } });
        window.on('closed', () => idMap.delete('about'));
        idMap.set('about', window);
    }
}

function openProgress(parent, title) {
    let window = getWindowId('progress');
    if (window && !window.isDestroyed())
        window.focus();
    else {
        window = createDialog({ show: true, parent: parent, url: path.join(__dirname, 'progress.html'), title: title, bounds: { width: 200, height: 70 }, backgroundColor: '#fff', icon: path.join(__dirname, '../../assets/icons/png/progress.png') });
        window.on('closed', () => idMap.delete('progress'));
        window.webContents.send(title);
        idMap.set('progress', window);
    }
    return window;
}

function openProfileManager(parent) {
    let window = getWindowId('profiles');
    if (window && !window.isDestroyed())
        window.focus();
    else {
        window = createWindow({ id: 'profiles', file: 'profiles.html', parent: parent, icon: '../assets/icons/png/profiles.png', title: 'Profile Manger' });
        window.setSkipTaskbar(!set.profiles.showInTaskBar);
    }
}
//#endregion

async function openDevtools(window, options) {
    window.openDevTools(options);
}

function StartDebugTimer() {
    timers.push(Date.now());
}

function EndDebugTimer(label) {
    label = label || `Timer: ${timers.length}`;
    const start = timers.pop();
    console.log(`${label} ${Date.now() - start}`);
}

ipcMain.on('StartDebugTimer', event => {
    StartDebugTimer();
});

ipcMain.on('EndDebugTimer', (event, label) => {
    EndDebugTimer(label);
});