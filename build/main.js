//spell-checker:words submenu, pasteandmatchstyle, statusvisible, taskbar, colorpicker, mailto, forecolor, tinymce, unmaximize
//spell-checker:ignore prefs, partyhealth, combathealth, commandinput, limbsmenu, limbhealth, selectall, editoronly, limbarmor, maximizable, minimizable
//spell-checker:ignore limbsarmor, lagmeter, buttonsvisible, connectbutton, charactersbutton, Editorbutton, zoomin, zoomout, unmaximize, resizable
const { app, BrowserWindow, WebContentsView, shell, screen, Tray, dialog, Menu, MenuItem, ipcMain, systemPreferences, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const URL = require('url');
const { Settings } = require('./js/settings');
const { TrayClick, TrayMenu, OnSecondInstance } = require('./js/types');
const { Menubar } = require('./js/menubar');
const { Characters } = require('./js/characters');

const timers = [];

require('@electron/remote/main').initialize();

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
    fs.unlink(path.join(app.getPath('userData'), 'argv.json'), logError);
}
else //not found use native
    argv = process.argv;

argv = require('yargs-parser')(argv, {
    string: ['data-dir', 's', 'setting', 'm', 'map', 'c', 'character', 'l', 'layout', 'el', 'error-log', 'crp', 'crash-reporting-path'],
    boolean: ['h', 'help', 'v', 'version', 'no-pd', 'no-portable-dir', 'disable-gpu', 'd', 'debug', '?', 'il', 'ignore-layout', 'nci', 'no-character-import', 'f', 'force', 'nls', 'no-layout-save', 'fci', 'force-character-import', 'cr', 'crash-reporting'],
    alias: {
        'd': ['debug'],
        'eo': ['editorOnly', 'editoronly'],
        'h': ['help', '?'],
        'v': ['version'],
        'no-pd': ['no-portable-dir'],
        's': ['settings'],
        'm': ['map'],
        'c': ['character', 'char'],
        'e': ['editor'],
        'l': ['layout'],
        'il': ['ignore-layout'],
        'nci': ['no-character-import'],
        'fci': ['force-character-import'],
        'f': ['force'],
        'nc': ['new-connection', 'nt', 'new-tab'],
        'nw': ['new-window'],
        'nls': ['no-layout-save'],
        'el': ['error-log'],
        'cr': ['crash-reporting'],
        'crp': ['crash-reporting-path']
    },
    configuration: {
        'short-option-groups': false
    }
});

if (argv['data-dir'] && argv['data-dir'].length > 0)
    app.setPath('userData', path.resolve(path.normalize(argv['data-dir'])));
else if (process.env.PORTABLE_EXECUTABLE_DIR && !argv['no-pd'] && !argv['no-portable-dir'])
    app.setPath('userData', process.env.PORTABLE_EXECUTABLE_DIR);

let errorLog = parseTemplate(path.join('{data}', 'jimud.error.log'));

if (argv.el && argv.el.length)
    errorLog = parseTemplate(argv.el);

app.setAppUserModelId('jiMUD');

if (!process.env.PORTABLE_EXECUTABLE_DIR) {
    if (argv._.indexOf('/?') !== -1 || argv.h) {
        displayConsoleHelp();
        app.quit();
        return;
    }
    else if (argv.v) {
        console.log(`jiMUD v${require('../package.json').version}`);
        app.quit();
        return;
    }
}
else if (process.env.PORTABLE_EXECUTABLE_DIR) {
    if (argv._.indexOf('/?') !== -1 || argv.h) {
        dialog.showMessageBox({
            type: 'info',
            message: commandLineArgumentHelp()
        });
        displayConsoleHelp();
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

Menu.setApplicationMenu(null);

global.settingsFile = parseTemplate(path.join('{data}', 'settings.json'));
global.mapFile = parseTemplate(path.join('{data}', 'map.sqlite'));
global.debug = false;
global.editorOnly = false;
global.updating = false;
let _settings = Settings.load(global.settingsFile);
let _checkingUpdates = false;
let _layout = parseTemplate(path.join('{data}', 'window.layout'));

let clients = {}
let windows = {};
let states = {};
let names = {};
let focusedClient = 0;
let focusedWindow = 0;
let _clientID = 0;
let _windowID = 0;
const idMap = new Map();
let _saved = false;
let _loaded = false;
let _characters;
let tray = null;
let _focused = false;
let _reloading = false;
const stateMap = new Map();

process.on('uncaughtException', logError);
process.on('unhandledRejection', (reason, promise) => {
    logError(reason);
    if (global.debug || getSetting('enableDebug'))
        console.error(promise);
});

process.on('warning', warning => {
    if (global.debug || getSetting('enableDebug'))
        console.warn(warning);
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
            if (global.debug || getSetting('enableDebug')) {
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
                        click: (item, mWindow) => {
                            mWindow.webContents.replaceMisspelling(item.label);
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

function commandLineArgumentHelp() {
    let msg = 'Usage: jiMUD [arguments...]\n\n';
    msg += '-h, --help - Print console help\n';
    msg += '-v, --version - Print current version\n';
    msg += '-d, --debug - Enable dev tools for all windows\n';
    msg += '-s=[file], --setting=[file] - Override default setting file\n';
    msg += '-m=[file], --map=[file] - Override default map file\n';
    msg += '-c=[name or id], --character=[name or id] - Load a character from character database, may be used multiple times to supply multiple characters to load\n';
    msg += '-c=[id:#], --character=[id:#] - Load a character from character database by id only, may be used multiple times to supply multiple characters to load\n';
    msg += '-e, --e, -e=[file], --e=[file] - Open code editor with current/new client\n';
    msg += '-eo, --eo, -eo=[file], --eo=[file] - Open only the code editor\n';
    msg += '-no-pd, -no-portable-dir - Do not use portable dir\n';
    msg += '-data-dir=[file] - Set a custom directory to store saved data\n';
    msg += '-l=[file], --layout=[file] - Load window layout file\n';
    msg += '-il, --ignore-layout - Ignore layout and do not save window states\n';
    msg += '-nci, --no-character-import - Do not import old characters.json\n';
    msg += '-fci, --force-character-import - Force import old characters.json\n';
    msg += '-f, --force - Force load of instance even if single only instance enabled\n';
    msg += '-nls, --no-layout-save - Do not save any layout changes when application is closed\n';
    msg += '-nw, --new-window - Open a new window\n';
    msg += '-nw=[id], --new-window=[id] - Open a new window with and load a character\n';
    msg += '-nt, --new-tab - Open a new tab\n';
    msg += '-nt=[id], --new-tab=[id] - Open a new tab and load a character, similar to --character but will not replace current active connection if it exist\n';
    msg += '-el=[file], --error-log=[file] Set a custom error log path';
    msg += '-cr, --crash-reporting Enable crash reporting to local folder';
    msg += '-crp=[path], --crash-reporting-path=[path] Path where crash reporting data is saved';
    return msg;
}

function displayConsoleHelp() {
    console.log('Usage: jiMUD [arguments...]');
    console.log('');
    console.log('-h, --help                                 Print console help');
    console.log('-v, --version                              Print current version');
    console.log('-d, --debug                                Enable dev tools for all windows');
    console.log('-s=[file], --setting=[file]                Override default setting file');
    console.log('-m=[file], --map=[file]                    Override default map file');
    console.log('-c=[name or id], --character=[name or id]  Load a character from character database, may be used multiple times to supply multiple characters to load');
    console.log('-c=[id:#], --character=[id:#]              Load a character from character database by id only, may be used multiple times to supply multiple characters to load');
    console.log('-e, --e, -e=[file], --e=[file]             Open code editor with current/new client');
    console.log('-eo, --eo, -eo=[file], --eo=[file]         Open only the code editor');
    console.log('-no-pd, -no-portable-dir                   Do not use portable dir');
    console.log('-data-dir=[file]                           Set a custom directory to store saved data');
    console.log('-l=[file], --layout=[file]                 Load window layout file');
    console.log('-il, --ignore-layout                       Ignore layout and do not save window states');
    console.log('-nci, --no-character-import                Do not import old characters.json');
    console.log('-fci, --force-character-import             Force import old characters.json');
    console.log('-f, --force                                Force load of instance even if single only instance enabled');
    console.log('-nls, --no-layout-save                     Do not save any layout changes when application is closed');
    console.log('-nw, --new-window                          Open a new window');
    console.log('-nw=[id], --new-window=[id]                Open a new window with and load a character');
    console.log('-nt, --new-tab                             Open a new tab')
    console.log('-nt=[id], --new-tab=[id]                   Open a new tab and load a character, similar to --character but will not replace current active connection if it exist');
    console.log('-el=[file], --error-log=[file]             Set a custom error log path');
    console.log('-cr, --crash-reporting                     Enable crash reporting to local folder');
    console.log('-crp=[path], --crash-reporting-path=[path] Path where crash reporting data is saved');
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
    let backgroundColor = '#000';
    switch (path.basename(getSetting('theme'), path.extname(getSetting('theme')))) {
        case 'zen':
            backgroundColor = '#dad2ba';
            break;
        case 'lightgray':
            backgroundColor = 'rgb(240, 240, 240)';
            break;
        case 'dark':
            backgroundColor = 'rgb(30, 30, 30)';
            break;
    }
    // Create the browser window.
    let window = new BrowserWindow({
        parent: options.parent || null,
        title: options.title || 'jiMUD',
        x: getWindowX(bounds.x, bounds.width),
        y: getWindowY(bounds.y, bounds.height),
        width: bounds.width,
        height: bounds.height,
        backgroundColor: options.backgroundColor || backgroundColor,
        show: false,
        icon: path.join(__dirname, options.icon || '../assets/icons/png/64x64.png'),
        skipTaskbar: !getSetting('showInTaskBar'),
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            nodeIntegrationInSubFrames: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: _settings ? getSetting('spellchecking') : false,
            enableRemoteModule: 'remote' in options ? options.remote : true,
            contextIsolation: false,
            backgroundThrottling: _settings ? getSetting('enableBackgroundThrottling') : true,
            preload: path.join(__dirname, 'preload.js')
        },
        //titleBarStyle: 'hidden',
        //titleBarOverlay: true
    });
    if (!('remote' in options) || options.remote)
        require("@electron/remote/main").enable(window.webContents);

    // and load the file of the app.
    window.loadURL(URL.format({
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
        _focused = true;
    });

    window.on('blur', () => {
        if (window && !window.isDestroyed() && window.webContents)
            window.webContents.send('blur');
        _focused = false;
    });

    window.on('minimize', () => {
        if (getSetting('hideOnMinimize') && !global.editorOnly)
            window.hide();
    });

    window.webContents.on('render-process-gone', (event, details) => {
        logError(`Client render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    window.webContents.on('devtools-reload-page', () => {
        onContentsLoaded(window.webContents).then(() => {
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
        var u = new URL.URL(details.url);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
            shell.openExternal(details.url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: buildOptions(details, window, _settings)
        }
    });

    window.webContents.on('did-create-window', (childWindow, details) => {
        let frameName = details.frameName;
        let url = details.url;
        let file = url;
        if (file.startsWith(URL.pathToFileURL(__dirname).href))
            file = file.substring(URL.pathToFileURL(__dirname).href.length + 1);
        initializeChildWindow(childWindow, url, details);

        childWindow.on('closed', e => {
            if (window && !window.isDestroyed())
                executeScriptClient(`if(typeof childClosed === "function") childClosed('${file}', '${url}', '${frameName}');`, window, true).catch(logError);
            idMap.delete(childWindow);
            stateMap.delete(childWindow);
        });
        childWindow.on('close', e => {
            const id = getWindowId(window);
            const index = getChildWindowIndex(windows[id].windows, childWindow);
            if (window && !window.isDestroyed()) {
                if (index !== -1) {
                    if (windows[id].windows[index].details.options.persistent) {
                        e.preventDefault();
                        executeScript('if(typeof closeHidden !== "function" || closeHidden(true)) window.hide();', childWindow);
                    }
                    else {
                        windows[id].windows[index] = null;
                        windows[id].windows.splice(index, 1);
                    }
                }
            }
        });

        windows[getWindowId(window)].windows.push({ window: childWindow, details: details });
        idMap.set(childWindow, getWindowId(window));
    });

    // Emitted when the window is closed.
    window.on('closed', async () => {
        const windowId = getWindowId(window);
        idMap.delete(window);
        stateMap.delete(window);
        const cl = windows[windowId].clients.length;
        for (var idx = 0; idx < cl; idx++) {
            const id = windows[windowId].clients[idx];
            //close any child windows linked to view
            closeClientWindows(id);
            if (!window.isDestroyed())
                window.contentView.removeChildView(clients[id].view);
            idMap.delete(clients[id].view);
            if (clients[id].view.webContents)
                clients[id].view.webContents.destroy();
            if (clients[id].name)
                delete names[clients[id].name];
            clients[id] = null;
            delete clients[id];
        }
        windows[windowId].window = null;
        delete windows[windowId];
        if (windowId === focusedWindow && Object.keys(windows).length) {
            if (global.editorOnly) //editor only just to be safe
                focusedWindow = parseInt(Object.keys(windows)[0], 10);
            else
                focusedWindow = parseInt(Object.keys(windows).filter(key => windows[key].clients.length)[0], 10);
        }
        clientsChanged();
    });
    //restore state sooner to try and prevent visual glitches
    if (options.data && options.data.state) {
        restoreWindowState(window, options.data.state);
        stateMap.set(window, options.data.state);
    }
    else if (states[options.file]) {
        restoreWindowState(window, states[options.file]);
        stateMap.set(window, states[options.file]);
    }
    else
        stateMap.set(window, saveWindowState(window));
    window.once('ready-to-show', () => {
        loadWindowScripts(window, options.script || path.basename(options.file, '.html'));
        executeScript(`if(typeof setId === "function") setId(${getWindowId(window)});`, window);
        executeScript('window.loadTheme();', window);
        if (options.data && options.data.data)
            executeScript('if(typeof restoreWindow === "function") restoreWindow(' + JSON.stringify(options.data.data) + ');', window);
        if (options.data && options.data.state) {
            //restoreWindowState(window, options.data.state);
        }
        else if (states[options.file]) {
            //restoreWindowState(window, states[options.file]);
        }
        else
            window.show();
        if (options.menubar)
            options.menubar.enabled = true;
    });

    window.on('close', async (e) => {
        //for what ever reason electron does not seem to work well with await, it sill continues to execute async instead of waiting
        //so we prevent default to cancel the event and later remove the events and close again
        e.preventDefault();
        //check all open clients in the window if they can be closed
        if (await canCloseAllClients(getWindowId(window)).catch(logError)) {
            //call close hooks
            await executeCloseHooksClients(getWindowId(window));    
            //save window state
            states[options.file] = saveWindowState(window, stateMap.get(window) || states[options.file]);
            stateMap.set(window, states[options.file]);
            //if _loaded and not saved and the last window open save as its the final state
            if (_loaded && !_saved && Object.keys(windows).length === 1) {
                await saveWindowLayout(null, getSetting('lockLayout'));
                _saved = true;
            }
            //prevent double calling the events
            window.removeAllListeners('close');
            window.close();
        }
    });

    window.on('resize', () => {
        //Issues with linux KDE 6 on javascript resize, so lets send an IPC version just in case
        if (window.webContents)
            window.webContents.send('resize');
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('resize');
        //on lt store state changes if not full screen
        if (window.isMaximized() || window.isFullScreen()) return;
        states[options.file] = saveWindowState(window, stateMap.get(window) || states[options.file]);
        stateMap.set(window, states[options.file]);
    });

    window.on('move', () => {
        if (window.isMaximized() || window.isFullScreen()) return;
        states[options.file] = saveWindowState(window, stateMap.get(window) || states[options.file]);
        stateMap.set(window, states[options.file]);
    });

    window.on('show', () => {
        updateOverlay();
    });

    window.on('restore', () => {
        //const active = getActiveClient(window);
        //if (active)
        //active.view.webContents.send('restore');
        //states[options.file] = saveWindowState(window, stateMap.get(window) || states[options.file]);
        //stateMap.set(window, states[options.file]);
    });
    window.on('maximize', () => {
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('maximize');
        states[options.file] = saveWindowState(window, stateMap.get(window) || states[options.file]);
        states[options.file].maximized = true;
        stateMap.set(window, states[options.file]);
    });
    window.on('unmaximize', () => {
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('unmaximize');
        states[options.file] = saveWindowState(window, stateMap.get(window) || states[options.file]);
        //linux has issues with correctly resetting maxmized as this event fires when the window is hidden so only store the state if not linux or visible
        if (process.platform !== 'linux' || window.isVisible())
            states[options.file].maximized = false;
        stateMap.set(window, states[options.file]);
    });

    window.on('enter-full-screen', () => {
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('maximize');
        states[options.file] = saveWindowState(window, stateMap.get(window) || states[options.file]);
        states[options.file].fullscreen = true;
        stateMap.set(window, states[options.file]);
        window.webContents.send('enter-full-screen');
    });

    window.on('leave-full-screen', () => {
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('maximize');
        states[options.file] = saveWindowState(window, stateMap.get(window) || states[options.file]);
        states[options.file].fullscreen = false;
        stateMap.set(window, states[options.file]);
        window.webContents.send('leave-full-screen');
    });

    window.on('resized', () => {
        /*
        if (window.isMaximized() || window.isFullScreen())  return;
        const active = getActiveClient(window);
        if (active)
            active.view.webContents.send('resized');
        states[options.file] = saveWindowState(window, stateMap.get(window) || states[options.file]);
        stateMap.set(window, states[options.file]);
        */
    });

    initializeIPCDebug(window.webContents, `Window Id: ${getWindowId(window)}`);

    if (!options.id) {
        _windowID++;
        //in case the new id is used from old layout loop until find empty id
        while (windows[_windowID])
            _windowID++;
        options.id = _windowID;
    }
    windows[options.id] = { options: { file: options.file !== 'manager.html' ? options.file : undefined, remote: options.remote, backgroundColor: options.backgroundColor, icon: options.icon, title: options.title }, window: window, clients: [], current: 0, menubar: options.menubar, windows: [] };
    if (options.menubar) {
        options.menubar.window = window;
        options.menubar.enabled = false;
    }
    idMap.set(window, options.id);
    addInputContext(window, getSetting('spellchecking'));
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
        movable: options.modal ? false : options.movable,
        alwaysOnTop: options.alwaysOnTop || false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        show: false,
        resizable: options.modal ? false : (options.resize || false),
        title: options.title || 'jiMUD',
        icon: options.icon || path.join(__dirname, '../assets/icons/png/64x64.png'),
        backgroundColor: options.backgroundColor || '#000',
        frame: options.hasOwnProperty('frame') ? options.frame : true,
        webPreferences: {
            nodeIntegration: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: _settings ? getSetting('spellchecking') : false,
            enableRemoteModule: true,
            contextIsolation: false,
            backgroundThrottling: _settings ? getSetting('enableBackgroundThrottling') : true,
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

    initializeIPCDebug(window.webContents, `Dialog URL: ${options.url}`);

    window.removeMenu();
    // and load the index.html of the app.
    if (options.rawUrl)
        window.loadURL(options.rawUrl);
    else
        window.loadURL(URL.format({
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
    addInputContext(window, getSetting('spellchecking'));
    return window;
}

function openCharacters() {
    if (_characters) return;
    _characters = new Characters({ file: path.join(parseTemplate('{data}'), 'characters.sqlite') });
    _characters.on('error', logError);
}

if (argv['disable-gpu'])
    app.disableHardwareAcceleration();

global.debug = argv.debug;
if (Array.isArray(argv.s)) {
    global.settingsFile = parseTemplate(argv.s[0]);
    _settings = Settings.load(global.settingsFile);
}
else if (argv.s) {
    global.settingsFile = parseTemplate(argv.s);
    _settings = Settings.load(global.settingsFile);
}

if (Array.isArray(argv.m))
    global.mapFile = parseTemplate(argv.m[0]);
else if (argv.m)
    global.mapFile = parseTemplate(argv.m);

if (argv.eo)
    global.editorOnly = true;

//fake already being saved to not save any changes
if (argv.nls)
    _saved = true;

if (argv.crp && argv.crp.length > 0)
    app.setPath('crashDumps', path.resolve(path.normalize(argv.crp)));

if (getSetting('enableCrashReporting') || argv.cr) {
    const { crashReporter } = require('electron')
    crashReporter.start({ uploadToServer: false });
}

if (getSetting('useSingleInstance') && !global.editorOnly && !argv.f) {
    var lock = app.requestSingleInstanceLock();
    if (!lock) {
        app.quit();
        return;
    }
    else
        app.on('second-instance', (event, second_argv, workingDirectory, additionalData) => {
            second_argv = require('yargs-parser')(second_argv, {
                string: ['data-dir', 's', 'setting', 'm', 'map', 'c', 'character', 'l', 'layout', 'el', 'error-log', 'crp', 'crash-reporting-path'],
                boolean: ['h', 'help', 'v', 'version', 'no-pd', 'no-portable-dir', 'disable-gpu', 'd', 'debug', '?', 'il', 'ignore-layout', 'nci', 'no-character-import', 'f', 'force', 'nls', 'no-layout-save', 'fci', 'force-character-import', 'cr', 'crash-reporting'],
                alias: {
                    'd': ['debug'],
                    'eo': ['editorOnly', 'editoronly'],
                    'h': ['help', '?'],
                    'v': ['version'],
                    'no-pd': ['no-portable-dir'],
                    's': ['settings'],
                    'm': ['map'],
                    'c': ['character', 'char'],
                    'e': ['editor'],
                    'l': ['layout'],
                    'il': ['ignore-layout'],
                    'nci': ['no-character-import'],
                    'fci': ['force-character-import'],
                    'f': ['force'],
                    'nc': ['new-connection', 'nt', 'new-tab'],
                    'nw': ['new-window'],
                    'nls': ['no-layout-save'],
                    'el': ['error=log'],
                    'cr': ['crash-reporting'],
                    'crp': ['crash-reporting-path']
                },
                configuration: {
                    'short-option-groups': false
                }
            });
            const active = getActiveWindow();
            let fWindow = -1;
            let char;
            if (Array.isArray(second_argv.nw)) {
                for (let nc = 0, ncl = second_argv.nw.length; nc < ncl; nc++) {
                    if (typeof second_argv.nw[nc] === 'string' || typeof second_argv.nw[nc] === 'number') {
                        char = getCharacterFromId(second_argv.nw[nc]);
                        newClientWindow(active.window, null, {
                            characterId: char.ID,
                            settings: parseTemplate(char.Preferences),
                            map: parseTemplate(char.Map),
                            port: char.Port
                        });
                    }
                    else
                        newClientWindow(active.window);
                }
                fWindow = 0;
            }
            else if (typeof second_argv.nw === 'string' || typeof second_argv.nw === 'number') {
                char = getCharacterFromId(second_argv.nw);
                newClientWindow(active.window, null, {
                    characterId: char.ID,
                    settings: parseTemplate(char.Preferences),
                    map: parseTemplate(char.Map),
                    port: char.Port
                });
                fWindow = 0;
            }
            else if (second_argv.nw) {
                newClientWindow(active.window);
                fWindow = 0;
            }

            if (Array.isArray(second_argv.nc)) {
                for (let nc = 0, ncl = second_argv.nc.length; nc < ncl; nc++) {
                    if (typeof second_argv.nw[nc] === 'string' || typeof second_argv.nw[nc] === 'number') {
                        char = getCharacterFromId(second_argv.nw[nc]);
                        newConnection(active.window, null, {
                            characterId: char.ID,
                            settings: parseTemplate(char.Preferences),
                            map: parseTemplate(char.Map),
                            port: char.Port
                        });
                    }
                    else
                        newConnection(active.window);
                }
                fWindow = 1;
            }
            else if (typeof second_argv.nc === 'string' || typeof second_argv.nc === 'number') {
                char = getCharacterFromId(second_argv.nw);
                newConnection(active.window, null, {
                    characterId: char.ID,
                    settings: parseTemplate(char.Preferences),
                    map: parseTemplate(char.Map),
                    port: char.Port
                });
                fWindow = 0;
            }
            else if (second_argv.nc) {
                newConnection(active.window);
                fWindow = 1;
            }

            if (Array.isArray(second_argv.c)) {
                second_argv.c.map(c => {
                    char = getCharacterFromId(c);
                    newConnection(active.window, null, {
                        characterId: char.ID,
                        settings: parseTemplate(char.Preferences),
                        map: parseTemplate(char.Map),
                        port: char.Port
                    });
                });
                fWindow = 1;
            }
            else if (second_argv.c) {
                char = getCharacterFromId(second_argv.c);
                newConnection(active.window, null, {
                    characterId: char.ID,
                    settings: parseTemplate(char.Preferences),
                    map: parseTemplate(char.Map),
                    port: char.Port
                });
                fWindow = 1;
            }
            if (argv.e) {
                //showCodeEditor();
                if (Array.isArray(argv.e))
                    executeScriptClient(`openFiles("${argv.e.join('", "')}")`, active.window, true);
                else if (typeof argv.e === 'string')
                    executeScriptClient(`openFiles("${argv.e}")`, active.window, true);
                else
                    executeScriptClient('openWindow("code.editor")', active.window, true);
                fWindow = 1;
            }

            //if a new connect focus current
            if (fWindow === 1) {
                restoreWindowState(active.window, stateMap.get(active.window), 2);
                active.window.focus();
            }
            //if no connection or window do onSecondInstance setting
            else if (fWindow == -1) {
                if (getSetting('onSecondInstance') === OnSecondInstance.Show) {
                    restoreWindowState(active.window, stateMap.get(active.window), 2);
                    active.window.focus();
                }
                else if (getSetting('onSecondInstance') === OnSecondInstance.NewConnection) {
                    newConnection(active.window);
                    restoreWindowState(active.window, stateMap.get(active.window), 2);
                    active.window.focus();
                }
                else if (getSetting('onSecondInstance') === OnSecondInstance.NewWindow) {
                    newClientWindow(active.window);
                }
            }
        });
}

if (Array.isArray(argv.l))
    _layout = parseTemplate(argv.l[0]);
else if (argv.l)
    _layout = argv.l;
else if (global.editorOnly)
    _layout = parseTemplate(path.join('{data}', 'editor.layout'));
else if (getSetting('loadLayout'))
    _layout = parseTemplate(getSetting('loadLayout'));

app.on('render-process-gone', (event, webContents, details) => {
    if (webContents)
        logError(`Render process gone, url: ${webContents.getURL()}, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    else
        logError(`Render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
});

app.on('child-process-gone', (event, details) => {
    var data = [];
    if (details.serviceName && details.serviceName.length)
        data.push(`service name: ${details.serviceName}`);
    if (details.name && details.name.length)
        data.push(`name: ${details.name}`);
    logError(`Child process gone, name: ${data.join(', ')}reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    //do not import if editor only mode, process after instance use to avoid processing file if not needed
    if (isFileSync(path.join(app.getPath('userData'), 'characters.json'))) {
        //if force import, import with out any prompts as its a command line and they should know better
        if (argv.fci) {
            _settings.migrate = 1;
            _settings.save(global.settingsFile);
            openCharacters();
            _characters.import(path.join(app.getPath('userData'), 'characters.json'));
        }
        //if not editor only, can import and not migrated ask 
        else if (!argv.eo && !argv.nci && _settings.migrate < 1)
            switch (dialog.showMessageBoxSync({
                type: 'question',
                title: 'Import characters',
                message: 'Import old characters?',
                buttons: ['Yes', 'No', 'Never ask again'],
                defaultId: 1,
                noLink: true
            })) {
                case 0:
                    _settings.migrate = 1;
                    _settings.save(global.settingsFile);
                    openCharacters();
                    _characters.import(path.join(app.getPath('userData'), 'characters.json'));
                    break;
                case 2:
                    _settings.migrate = 1;
                    _settings.save(global.settingsFile);
                    break;
            }
    }

    let window;
    let charID;
    if (!existsSync(path.join(app.getPath('userData'), 'characters')))
        fs.mkdirSync(path.join(app.getPath('userData'), 'characters'));

    //use default
    let _ignore = false;
    //attempt to load layout, 
    if (isFileSync(_layout)) {
        if (!argv.il) {
            if (!global.editorOnly && (argv.c || argv.nc)) {
                if (Array.isArray(argv.c))
                    charID = argv.c.map(c => {
                        char = getCharacterFromId(c);
                        return {
                            characterId: char.ID,
                            settings: parseTemplate(char.Preferences),
                            map: parseTemplate(char.Map),
                            port: char.Port
                        }
                    });
                else if (argv.c) {
                    getCharacterFromId(argv.c);
                    charID = [{
                        characterId: charID.ID,
                        settings: parseTemplate(charID.Preferences),
                        map: parseTemplate(charID.Map),
                        port: charID.Port
                    }];
                }
                //not set so set first as null as new connections do not replace current connection
                if (!charID) charID = [null];
                if (Array.isArray(argv.nc))
                    charID.push(...argv.nc.map(c => {
                        if (typeof c === 'string' || typeof c === 'number') {
                            char = getCharacterFromId(c);
                            return {
                                characterId: char.ID,
                                settings: parseTemplate(char.Preferences),
                                map: parseTemplate(char.Map),
                                port: char.Port
                            }
                        }
                        else
                            return {
                                settings: global.settingsFile,
                                map: global.mapFile
                            }
                    }));
                else if (typeof argv.nc === 'string' || typeof argv.nc === 'number') {
                    char = getCharacterFromId(argv.nc);
                    charID.push({
                        characterId: char.ID,
                        settings: parseTemplate(char.Preferences),
                        map: parseTemplate(char.Map),
                        port: char.Port
                    });
                }
                else if (argv.nc) {
                    charID.push({
                        settings: global.settingsFile,
                        map: global.mapFile
                    });
                }
                _loaded = loadWindowLayout(_layout, charID);
            }
            else
                _loaded = loadWindowLayout(_layout);
        }
    }
    else if (!argv.il)
        _ignore = true;

    //if it fails load default window
    if (!_loaded) {
        //use default unless ignoring layouts
        _loaded = _ignore;
        if (global.editorOnly)
            newEditorWindow(null, argv.eo);
        else if (argv.c || argv.nc) {
            if (Array.isArray(argv.c))
                charID = argv.c.map(c => {
                    char = getCharacterFromId(c);
                    return {
                        characterId: char.ID,
                        settings: parseTemplate(char.Preferences),
                        map: parseTemplate(char.Map),
                        port: char.Port
                    }
                });
            else if (argv.c) {
                getCharacterFromId(argv.c);
                charID = [{
                    characterId: charID.ID,
                    settings: parseTemplate(charID.Preferences),
                    map: parseTemplate(charID.Map),
                    port: charID.Port
                }];
            }
            if (!charID) charID = [];
            if (Array.isArray(argv.nc))
                charID.push(...argv.nc.map(c => {
                    if (typeof c === 'string' || typeof c === 'number') {
                        char = getCharacterFromId(c);
                        return {
                            characterId: char.ID,
                            settings: parseTemplate(char.Preferences),
                            map: parseTemplate(char.Map),
                            port: char.Port
                        }
                    }
                    else
                        return {
                            settings: global.settingsFile,
                            map: global.mapFile
                        }
                }));
            else if (typeof argv.nc === 'string' || typeof argv.nc === 'number') {
                char = getCharacterFromId(argv.nc);
                charID.push({
                    characterId: char.ID,
                    settings: parseTemplate(char.Preferences),
                    map: parseTemplate(char.Map),
                    port: char.Port
                });
            }
            else if (argv.nc) {
                charID.push({
                    settings: global.settingsFile,
                    map: global.mapFile
                });
            }
            newClientWindow(null, null, charID);
        }
        else
            newClientWindow();
    }
    else if (Array.isArray(argv.eo) || typeof argv.eo === 'string') {
        window = getActiveWindow();
        if (window)
            onContentsLoaded(window.window.webContents).then(() => {
                window.window.webContents.send('open-editor', argv.eo);
                focusWindow(window, true);
            });
    }

    if (!global.editorOnly) {
        //current active window
        window = getActiveWindow();
        //only load after as it requires a client window
        if (argv.e && window) {
            //showCodeEditor();
            if (Array.isArray(argv.e))
                executeScriptClient(`openFiles("${argv.e.join('", "')}")`, window.window, true);
            else if (typeof argv.e === 'string')
                executeScriptClient(`openFiles("${argv.e}")`, window.window, true);
            else
                executeScriptClient('openWindow("code.editor")', window.window, true);
        }

        if (Array.isArray(argv.nw)) {
            for (let nc = 0, ncl = argv.nw.length; nc < ncl; nc++) {
                if (typeof argv.nw[nc] === 'string' || typeof argv.nw[nc] === 'number') {
                    char = getCharacterFromId(argv.nw[nc]);
                    newClientWindow(window.window, null, {
                        characterId: char.ID,
                        settings: parseTemplate(char.Preferences),
                        map: parseTemplate(char.Map),
                        port: char.Port
                    });
                }
                else
                    newClientWindow(window.window);
            }
        }
        else if (typeof argv.nw === 'string' || typeof argv.nw === 'number') {
            char = getCharacterFromId(argv.nw);
            newClientWindow(window.window, null, {
                characterId: char.ID,
                settings: parseTemplate(char.Preferences),
                map: parseTemplate(char.Map),
                port: char.Port
            });
        }
        else if (argv.nw) {
            newClientWindow(window.window);
        }
        createTray();
    }
    updateJumpList();
    checkForUpdates();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (!_reloading && process.platform !== 'darwin') {
        if (tray)
            tray.destroy();
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
    //wait until save is done before continue just to be safe
    //only saved if not already been saved somewhere else and was loaded with no errors
    if (_loaded && !_saved) {
        await saveWindowLayout(null, getSetting('lockLayout'));
        _saved = true;
    }
    if (app.hasSingleInstanceLock())
        app.releaseSingleInstanceLock();
});

ipcMain.on('log', (event, raw) => {
    console.log(raw);
});

ipcMain.on('log-error', (event, err, skipClient, title) => {
    logError(err, skipClient, title);
});

ipcMain.on('debug', (event, msg, id) => {
    sendClient('debug', msg, id);
});

ipcMain.on('error', (event, err, id) => {
    sendClient('error', err, id);
});

function sendClient(channel, msg, id) {
    let client = id ? clients[id] : getActiveClient();
    if (client && client.view.webContents) {
        client.view.webContents.send(channel, msg);
        return true;
    }
    return false;
}

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
        case 'mapFile':
            event.returnValue = global.mapFile;
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
        case 'errorLog':
            event.returnValue = errorLog;
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
        case 'mapFile':
            global.mapFile = value;
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
    event.returnValue = getSetting(key);
});

function getSetting(key) {
    if (!_settings)
        return null;
    const setting = _settings.getValue(key)
    if (typeof setting === 'undefined')
        return Settings.defaultValue(key);
    return setting;
}

ipcMain.on('set-setting', (event, key, value) => {
    setSetting(key, value);
});

function setSetting(key, value) {
    if (_settings && _settings.setValue(key, value))
        _settings.save(global.settingsFile);
}

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
            if (!icon) return null;
            return icon.toDataURL();
        case 'getVersion':
            return app.getVersion();
        case 'getName':
            return app.getName();
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
            event.returnValue = null;
            break;
        case 'clearRecentDocuments':
            app.clearRecentDocuments();
            event.returnValue = null;
            break;
        case 'getFileIconDataUrl':
            let icon = await app.getFileIcon(...args);
            event.returnValue = icon.toDataURL();
            break;
        case 'getVersion':
            event.returnValue = app.getVersion();
            break;
        case 'getName':
            event.returnValue = app.getName();
            break;
    }
});

ipcMain.on('set-progress', (event, progress, mode) => {
    const window = windowFromContents(event.sender);
    const clientId = getClientId(viewFromContents(event.sender));
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

ipcMain.on('import-characters', (event, file, id, backup, replace) => {
    openCharacters();
    _characters.import(file, backup, replace);
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId) || parseInt(clientId, 10) === id)
            continue;
        clients[clientId].view.webContents.send('characters-imported');
    }
});

ipcMain.on('get-characters', (event, options) => {
    openCharacters();
    event.returnValue = _characters.getCharacters(options);
});

ipcMain.on('get-character', (event, id, property) => {
    openCharacters();
    let character = _characters.getCharacter(id);
    event.returnValue = character ? (property ? character[property] : character) : null;
});

ipcMain.on('update-character', (event, character, id, noReload) => {
    openCharacters();
    _characters.updateCharacter(character);
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId) || parseInt(clientId, 10) === id)
            continue;
        clients[clientId].view.webContents.send('character-updated', character.ID, noReload);
    }
});

ipcMain.on('update-character-time', (event, data, id) => {
    openCharacters();
    let character = _characters.getCharacter(data.ID);
    data.TotalMilliseconds += character.TotalMilliseconds;
    /*
    if (data.TotalMilliseconds >= 86400000)
    {
        data.TotalDays = character.TotalDays + (data.TotalMilliseconds / 86400000);
        data.TotalMilliseconds %= 86400000;
    }
    */
    _characters.updateCharacter(data);
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId) || parseInt(clientId, 10) === id)
            continue;
        clients[clientId].view.webContents.send('character-updated', character.ID, true);
    }
});

ipcMain.on('add-character', (event, character) => {
    openCharacters();
    const id = _characters.addCharacter(character);
    event.returnValue = id;
    character.ID = id;
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        clients[clientId].view.webContents.send('character-added', character);
    }
});

ipcMain.on('get-character-next-id', (event) => {
    openCharacters();
    event.returnValue = _characters.getNextId();
});

ipcMain.on('remove-character', (event, id) => {
    openCharacters();
    _characters.removeCharacter(id);
});

ipcMain.on('get-character-from-id', (event, id, property) => {
    openCharacters();
    let character = getCharacterFromId(id);
    event.returnValue = character ? (property ? character[property] : character) : null;
});

function getCharacterId(id) {
    openCharacters();
    if (id.startsWith('id:')) {
        id = id.substring(3);
        if (id.length === 0)
            return 0;
        id = parseInt(id, 10);
        if (_characters.getCharacter(id))
            return id;
    }
    const chars = _characters.getCharactersByTitle(id);
    if (chars.length !== 0)
        return chars[0].ID;
    id = parseInt(id, 10);
    if (_characters.getCharacter(id))
        return id;
    return 0;
}

function getCharacterFromId(id) {
    openCharacters();
    if (id.startsWith('id:')) {
        id = id.substring(3);
        if (id.length === 0)
            return 0;
        id = parseInt(id, 10);
        return _characters.getCharacter(id);
    }
    const chars = _characters.getCharactersByTitle(id);
    if (chars.length !== 0)
        return chars[0].ID;
    id = parseInt(id, 10);
    return _characters.getCharacter(id)
}

//#region IPC dialogs
ipcMain.on('show-dialog-sync', (event, type, ...args) => {
    var sWindow = windowFromContents(event.sender);
    if (type === 'showMessageBox')
        event.returnValue = dialog.showMessageBoxSync(sWindow, ...args);
    else if (type === 'showSaveDialog')
        event.returnValue = dialog.showSaveDialogSync(sWindow, ...args);
    else if (type === 'showOpenDialog')
        event.returnValue = dialog.showOpenDialogSync(sWindow, ...args);
    else {
        logError('Invalid show-dialog-sync: ' + type);
        event.returnValue = null;
    }
});

ipcMain.handle('show-dialog', (event, type, ...args) => {
    var sWindow = windowFromContents(event.sender);
    if (type === 'showMessageBox')
        return dialog.showMessageBox(sWindow, ...args);
    else if (type === 'showSaveDialog')
        return dialog.showSaveDialog(sWindow, ...args);
    else if (type === 'showOpenDialog')
        return dialog.showOpenDialog(sWindow, ...args);
    else if (type === 'showErrorBox')
        return dialog.showErrorBox(sWindow, ...args);
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
    options.window = windowFromContents(event.sender);
    if (options.callback) {
        var callback = options.callback;
        options.callback = () => event.sender.executeJavaScript(callback);
    }
    template.map((item, idx) => {
        if (typeof item.click === 'string') {
            var click = item.click;
            item.click = (item, window, keyboard) => event.sender.executeJavaScript(`(function() { event = ${JSON.stringify(keyboard)}; ${click} })();`);
        }
        else
            item.click = (item, window, keyboard) => event.sender.executeJavaScript(`executeContextItem(${idx}, "${item.id}", "${item.label}", "${item.role}", ${JSON.stringify(keyboard)});`);
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
    shell.trashItem(file).catch(logError);
});

ipcMain.on('trash-item-sync', async (event, file) => {
    await shell.trashItem(file).catch(logError);
    event.returnValue = true;
});

ipcMain.handle('window', (event, action, ...args) => {
    var current = windowFromContents(event.sender);
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
        restoreWindowState(current, stateMap.get(current), 2);
    else if (action === 'toggle') {
        if (current.isVisible()) {
            if (args[0])
                current.hide();
            else
                current.minimize();
        }
        else
            restoreWindowState(current, stateMap.get(current), 2);
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
    var current = windowFromContents(event.sender);
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
        restoreWindowState(current, stateMap.get(current), 2);
    else if (action === 'toggle') {
        if (current.isVisible()) {
            if (args[0])
                current.hide();
            else
                current.minimize();
        }
        else
            restoreWindowState(current, stateMap.get(current), 2);
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
    else if (action === 'replaceMisspelling')
        event.sender.replaceMisspelling(...args);
    else if (action === 'inspectElement')
        event.sender.inspectElement(...args);
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
        var current = windowFromContents(event.sender);
        event.returnValue = current ? current.isVisible() : 0;
    }
    else if (info === 'isEnabled') {
        var current = windowFromContents(event.sender);
        event.returnValue = current ? current.isEnabled() : 0;
    }
    else if (info === 'isDevToolsOpened') {
        var current = windowFromContents(event.sender);
        event.returnValue = current ? current.isDevToolsOpened() : 0;
    }
    else if (info === 'isMinimized') {
        var current = windowFromContents(event.sender);
        event.returnValue = current ? current.isMinimized() : 0;
    }
    else {
        logError('Invalid window-info: ' + info);
        event.returnValue = false;
    }
});

ipcMain.on('cancel-close', event => {
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        clients[clientId].view.webContents.send('cancel-close');
    }
});

//#region Client creation, docking, and related management
ipcMain.on('new-client', (event, connection, data, name) => {
    newConnection(windowFromContents(event.sender), connection, data, name);
});

ipcMain.on('new-window', (event, connection, data, name) => {
    newClientWindow(windowFromContents(event.sender), connection, data, name);
});

ipcMain.on('switch-client', (event, id, offset) => {
    if (clients[id]) {
        const window = windowFromContents(event.sender);
        const windowId = getWindowId(window);
        if (window != clients[id].parent) {
            //Probably wanting to dock from 1 window to another, so just ignore
            return;
        }
        const bounds = window.getContentBounds();
        clients[id].view.setBounds({
            x: 0,
            y: (offset || 0),
            width: bounds.width,
            height: bounds.height - (offset || 0)
        });
        //closed or some other reason so do not switch
        if (window.contentView.children.length === 0)
            return;
        if (windowId === focusedWindow)
            focusedClient = id;
        if (windows[windowId].current && clients[windows[windowId].current])
            clients[windows[windowId].current].view.webContents.send('deactivated');
        setVisibleClient(windowId, id);
        clients[id].view.webContents.send('activated');
        focusWindow(window, true);
    }
});

ipcMain.on('remove-client', (event, id) => {
    if (clients[id])
        removeClient(id, true);
});

ipcMain.on('remove-other-clients', (event, id) => {
    if (clients[id]) {
        const windowId = getWindowId(clients[id].parent);
        const window = windows[windowId];
        for (c = window.clients.length - 1; c >= 0; c--) {
            if (window.clients[c] === id) continue;
            removeClient(window.clients[c], true);
        }
    }
});

ipcMain.on('goto-client', (event, id, action) => {
    let window;
    if (action === 3) {
        if (!clients[id]) return;
        window = clients[id].parent;
    }
    else
        window = windowFromContents(event.sender);
    const windowId = getWindowId(window);
    let idx;
    //if only 1 client or no clients ignore
    if (windows[windowId].clients.length < 2) return;
    //goto next client
    if (action === 1) {
        idx = windows[windowId].clients.indexOf(id);
        if (idx === -1) return;
        idx++;
        if (idx >= windows[windowId].clients.length)
            idx = 0;
        window.webContents.send('switch-client', windows[windowId].clients[idx]);
    }
    //goto previous client
    else if (action === 2) {
        idx = windows[windowId].clients.indexOf(id);
        if (idx === -1) return;
        idx--;
        if (idx < 0)
            idx = windows[windowId].clients.length - 1;
        window.webContents.send('switch-client', windows[windowId].clients[idx]);
    }
    //goto client
    else
        window.webContents.send('switch-client', id);
})

ipcMain.on('reorder-client', (event, id, index, oldIndex) => {
    let window = windowFromContents(event.sender);
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
    let window = windowFromContents(event.sender);
    let windowId = getWindowId(window);
    const oldWindow = clients[id].parent;
    const oldWindowId = getWindowId(oldWindow);
    //same window so trying to drag out so create new window
    if (!window || window === oldWindow) {
        //if only one client no need for a new window so bail
        if (window && windows[oldWindowId].clients.length === 1) {
            if (options) {
                window.setPosition(options.x || 0, options.y || 0);
            }
            return;
        }
        //remove from old window
        oldWindow.contentView.removeChildView(clients[id].view);
        const oldIdx = windows[oldWindowId].clients.indexOf(id);
        windows[oldWindowId].clients.splice(oldIdx, 1);
        oldWindow.webContents.send('removed-client', id);
        states['manager.html'] = saveWindowState(oldWindow, stateMap.get(oldWindow) || states['manager.html']);
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
        window.contentView.addChildView(clients[id].view);
        clients[id].parent = window;
        setVisibleClient(windowId, id);
        //clients[id].menu.window = window;
        //window.setMenu(clients[id].menu);
        onContentsLoaded(window.webContents).then(() => {
            window.webContents.send('new-client', { id: id });
            if (focusedClient === id && focusedWindow === windowId)
                focusWindow(window, true);
            clientsChanged();
            clients[id].view.webContents.send('activated', true);
        });
        return;
    }
    //remove from old window
    oldWindow.contentView.removeChildView(clients[id].view);
    const oldIdx = windows[oldWindowId].clients.indexOf(id);
    windows[oldWindowId].clients.splice(oldIdx, 1);
    oldWindow.webContents.send('removed-client', id);
    setClientWindowsParent(id, window, oldWindow);
    //all views removed so close the window
    if (windows[oldWindowId].clients.length === 0)
        oldWindow.close();
    //Add to new window
    if (options && typeof options.index !== 'undefined' && options.index !== -1 && options.index < windows[windowId].clients.length)
        windows[windowId].clients.splice(options.index, 0, id);
    else
        windows[windowId].clients.push(id);
    clients[id].parent = window;
    clients[id].parent.contentView.addChildView(clients[id].view);
    if (windowId === focusedWindow)
        focusedClient = id;
    if (windows[windowId].current && clients[windows[windowId].current])
        clients[windows[windowId].current].view.webContents.send('deactivated');
    setVisibleClient(windowId, id);
    clients[id].view.webContents.send('activated', true);
    if (options)
        window.webContents.send('new-client', { id: id, index: options.index });
    else
        window.webContents.send('new-client', { id: id });
    focusWindow(window, true);
    clientsChanged();
    states['manager.html'] = saveWindowState(window, stateMap.get(window) || states['manager.html']);
    stateMap.set(window, states['manager.html']);
});

ipcMain.on('position-client', (event, id, options) => {
    if (!clients[id]) return;
    let window = windowFromContents(event.sender);
    const oldWindow = clients[id].parent;
    const oldWindowId = getWindowId(oldWindow);
    if (options && window === oldWindow && windows[oldWindowId].clients.length === 1) {
        window.setPosition(options.x || 0, options.y || 0);
    }
});

ipcMain.on('focus-client', (event, id, window, switchClient) => {
    if (typeof id === 'string')
        id = names[id];
    if (!clients[id]) return;
    if (window)
        restoreWindowState(clients[id].parent, stateMap.get(clients[id].parent), 2);
    focusClient(id, false, switchClient);
});

ipcMain.on('focus-window', (event, id, clientId) => {
    if (!windows[id]) return;
    restoreWindowState(windows[id].window, stateMap.get(windows[id].window), 2);
    if (clientId && windows[id].clients.indexOf(id) !== -1)
        windows[id].window.webContents.send('switch-client', parseInt(clientId, 10));
})

ipcMain.on('close-window', (event, id) => {
    let window;
    if (window === 'profile-manager')
        window = getWindowId('profiles');
    else if (window === 'about')
        window = getWindowId('about');
    else if (window === 'global-preferences')
        window = getWindowId('prefs');
    else if (window === 'progress')
        window = progressMap.get(windowFromContents(event.sender));
    else if (window === 'windows')
        window = getWindowId('windows');
    else if (windows[id])
        window = windows[id].window;
    if (window)
        window.close();
});

ipcMain.on('execute-client', (event, id, code) => {
    if (typeof id === 'string')
        id = names[id];
    if (clients[id])
        executeScript(code, clients[id].view);
});

ipcMain.on('execute-all-clients', (event, code) => {
    for (id in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, id) || getClientId(clients[id].view) === clientId)
            continue;
        executeScript(code, clients[id].view);
    }
});

ipcMain.on('update-client', (event, id, offset) => {
    if (clients[id]) {
        offset = offset || 0;
        var bounds = windowFromContents(event.sender).getContentBounds();
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
            await saveWindowLayout(null, getSetting('lockLayout'));
            _saved = true;
        }
        app.quit();
    }
}

ipcMain.on('save-window-layout', async (event, checkWindows) => {
    if (_loaded && !_saved) {
        if (checkWindows && Object.keys(windows).length > 1)
            return;
        await saveWindowLayout(null, getSetting('lockLayout'));
        _saved = true;
    }
    event.returnValue = true;
});

ipcMain.on('can-close-client', async (event, id) => {
    if (id === undefined || !clients[id])
        event.returnValue = false;
    else
        event.returnValue = await canCloseClient(id);
});

ipcMain.on('can-close-all-client', async (event) => {
    event.returnValue = await canCloseAllClients(getWindowId(windowFromContents(event.sender)));
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
            if (!options.force && client.overlay === options.icon) return;
            client.overlay = options.icon;
            updateIcon(client.parent);
        }
        else if (tray) //something changed the title even if icon did not change update the menu to be safe
            updateTrayContext();
        const windowsDialog = getWindowId('windows');
        if (windowsDialog) {
            const windowId = getWindowId(client.parent);
            windowsDialog.webContents.send('client-updated', {
                id: getClientId(client.view), title: client.view.webContents.getTitle(), overlay: client.overlay
            }, {
                id: windowId, title: client.parent.getTitle(), overlay: windows[windowId].overlay
            });
        }
    }
});

ipcMain.on('window-update-title', event => {
    const windowsDialog = getWindowId('windows');
    if (windowsDialog) {
        const window = windowFromContents(event.sender);
        const windowId = getWindowId(window);
        windowsDialog.webContents.send('client-updated', null, { id: getWindowId(window), title: window.getTitle(), overlay: windows[windowId].overlay });
    }
});

ipcMain.on('get-options', (event, isWindow) => {
    if (isWindow) {
        const window = windowFromContents(event.sender);
        event.returnValue = { windows: windows[getWindowId(window)].windows.map(w => w.details) }
    }
    else {
        const view = viewFromContents(event.sender);
        event.returnValue = clients[getClientId(view)].options;
    }
});

ipcMain.on('get-connection-settings', event => {
    const view = viewFromContents(event.sender);
    event.returnValue = clients[getClientId(view)].connection;
});

ipcMain.on('get-preference', (event, preference) => {
    event.returnValue = _settings[preference];
});

ipcMain.on('set-preference', (event, preference, value) => {
    _settings[preference] = value;
});

ipcMain.on('reload-options', (events, preferences, clientId) => {
    if (preferences === global.settingsFile) {
        _settings = Settings.load(global.settingsFile);
        for (window in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, window))
                continue;
            windows[window].window.webContents.send('reload-options');
            updateWebContents(windows[window].window.webContents, { enableBackgroundThrottling: getSetting('enableBackgroundThrottling') });
        }
        for (id in clients) {
            if (!Object.prototype.hasOwnProperty.call(clients, id) || getClientId(clients[id].view) === clientId)
                continue;
            clients[id].view.webContents.send('reload-options', preferences, preferences === global.settingsFile);
            updateWebContents(clients[id].view.webContents, { enableBackgroundThrottling: getSetting('enableBackgroundThrottlingClients') });
        }
        if (getSetting('showTrayIcon') && !tray)
            createTray();
        else if (!getSetting('showTrayIcon') && tray) {
            tray.destroy();
            tray = null;
        }
        else if (tray)
            _updateTrayContext();
    }
    else {
        for (id in clients) {
            if (!Object.prototype.hasOwnProperty.call(clients, id) || getClientId(clients[id].view) === clientId)
                continue;
            clients[id].view.webContents.send('reload-options', preferences, preferences === global.settingsFile);
        }
    }
});

ipcMain.on('get-client-id', (event, name) => {
    if (name)
        event.returnValue = names[name];
    else
        event.returnValue = getClientId(viewFromContents(event.sender));
});

ipcMain.on('get-client-name', (event, id) => {
    if (!id)
        id = getClientId(viewFromContents(event.sender));
    if (clients[id])
        event.returnValue = clients[id].name;
    else
        event.returnValue = null;
});

ipcMain.on('clear-client-name', (event, id) => {
    if (!id)
        id = getClientId(viewFromContents(event.sender));
    else if (typeof id === 'string')
        id = names[id];
    if (clients[id] && clients[id].name) {
        delete names[clients[id].name];
        delete clients[id].name;
    }
});

ipcMain.on('set-client-name', (event, name, id) => {
    if (!id)
        id = getClientId(viewFromContents(event.sender));
    if (clients[id]) {
        //if already named remove name from old window
        if (names[name] && clients[names[name]])
            delete clients[names[name]].name;
        clients[id].name = name;
        names[name] = id;
    }
});

ipcMain.on('is-client-name', (event, id) => {
    event.returnValue = names[id] ? true : false
});

ipcMain.on('is-client', (event, id) => {
    event.returnValue = names[id] || clients[id] ? true : false
});

ipcMain.on('get-window-id', event => {
    event.returnValue = getWindowId(event.sender);
});

ipcMain.on('get-windows-and-clients', event => {
    const _windows = [];
    for (window in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, window))
            continue;
        const data = {
            title: windows[window].window.getTitle(),
            id: getWindowId(windows[window].window),
            overlay: windows[window].overlay,
            clients: [],
            windows: []
        };
        for (let wc = 0, wcl = windows[window].windows.length; wc < wcl; wc++) {
            data.windows.push({
                title: windows[window].windows[wc].window.getTitle(),
                index: wc
            });
        }
        for (let c = 0, cl = windows[window].clients.length; c < cl; c++) {
            if (!clients[windows[window].clients[c]] || !clients[windows[window].clients[c]].view) continue;
            client = {
                id: windows[window].clients[c],
                title: clients[windows[window].clients[c]].view.webContents.getTitle(),
                overlay: clients[windows[window].clients[c]].overlay,
                windows: []
            };
            for (let wc = 0, wcl = clients[client.id].windows.length; wc < wcl; wc++) {
                client.windows.push({
                    title: clients[client.id].windows[wc].window.getTitle(),
                    index: wc
                });
            }
            data.clients.push(client);
        }
        _windows.push(data);
    }
    event.returnValue = _windows;
});

ipcMain.on('get-window-client-count', (event) => {
    const window = windowFromContents(event.sender);
    const windowId = getWindowId(window);
    event.returnValue = {
        windows: Object.keys(windows).length,
        clients: windows[windowId].clients.length
    };
})

ipcMain.on('get-window-title', (event, id) => {
    if (windows[id])
        event.returnValue = windows[id].window.getTitle();
    else
        event.returnValue = '';
});

ipcMain.on('get-client-title', (event, id) => {
    if (clients[id])
        event.returnValue = clients[id].view.webContents.getTitle();
    else
        event.returnValue = '';
});

ipcMain.on('get-client-parent-id', (event, id) => {
    if (clients[id])
        event.returnValue = getWindowId(clients[id].parent);
    else
        event.returnValue = -1;
});

ipcMain.on('set-client-bounds', (event, id, bounds) => {
    if (!id || !clients[id] || !bounds) return;
    clients[id].view.setBounds(bounds);
});

ipcMain.on('get-window-content-bounds', (event, id) => {
    if (windows[id])
        event.returnValue = windows[id].window.getContentBounds();
    else
        event.returnValue = windowFromContents(event.sender).getContentBounds();
});


//bounds, id, data, file
function createClient(options) {
    options = options || {};
    if (!options.file || options.file.length === 0)
        options.file = 'build/index.html';
    const view = new WebContentsView({
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            nodeIntegrationInSubFrames: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: _settings ? getSetting('spellchecking') : false,
            enableRemoteModule: true,
            contextIsolation: false,
            backgroundThrottling: _settings ? getSetting('enableBackgroundThrottlingClients') : true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    //view.setVisible(false);
    switch (path.basename(getSetting('theme'), path.extname(getSetting('theme')))) {
        case 'zen':
            view.setBackgroundColor(options.backgroundColor || '#dad2ba');
            break;
        case 'lightgray':
            view.setBackgroundColor(options.backgroundColor || 'rgb(240, 240, 240)');
            break;
        case 'dark':
            view.setBackgroundColor(options.backgroundColor || 'rgb(30, 30, 30)');
            break;
        default:
            view.setBackgroundColor(options.backgroundColor || 'black');
            break;
    }

    view.webContents.on('context-menu', (e, params) => {
        view.webContents.send('context-menu', params);
    });

    view.webContents.on('focus', () => {
        focusedClient = getClientId(view);
    });

    view.webContents.on('devtools-reload-page', () => {
        onContentsLoaded(view.webContents).then(() => {
            executeScript(`if(typeof setId === "function") setId(${getClientId(view)});`, clients[getClientId(view)].view);
            executeScript('window.loadTheme();', clients[options.id].view);
            /*
            if (options.data)
                executeScript('if(typeof restoreWindow === "function") restoreWindow(' + JSON.stringify({ data: options.data.data, windows: options.data.windows, states: options.data.states }) + ');', clients[options.id].view);
            else
                executeScript('if(typeof restoreWindow === "function") restoreWindow({data: {}, windows: [], states: {}});', clients[options.id].view);
            */
        });
    });

    view.webContents.on('render-process-gone', (event, goneDetails) => {
        logError(`${options.file} render process gone, reason: ${goneDetails.reason}, exitCode ${goneDetails.exitCode}\n`, true);
    });

    view.webContents.setWindowOpenHandler((details) => {
        var u = new URL.URL(details.url);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
            shell.openExternal(details.url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: buildOptions(details, windowFromContents(view.webContents), _settings)
        }
    });

    view.webContents.on('did-create-window', (childWindow, details) => {
        let frameName = details.frameName;
        let url = details.url;
        let file = url;
        if (file.startsWith(URL.pathToFileURL(__dirname).href))
            file = file.substring(URL.pathToFileURL(__dirname).href.length + 1);
        initializeChildWindow(childWindow, url, details, false);

        childWindow.on('resize', () => {
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('move', () => {
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('maximize', () => {
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('unmaximize', () => {
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('enter-full-screen', () => {
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('leave-full-screen', () => {
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('resized', () => {
            clients[getClientId(view)].states[file] = states[file];
        });

        childWindow.on('closed', () => {
            if (view && view.webContents && !view.webContents.isDestroyed()) {
                executeScript(`if(typeof childClosed === "function") childClosed('${file}', '${url}', '${frameName}');`, view, true).catch(logError);
                //remove remove from list
                const id = getClientId(view);
                if (clients[id]) {
                    const index = getChildWindowIndex(clients[id].windows, childWindow);
                    if (index !== -1) {
                        clients[id].windows[index] = null;
                        clients[id].windows.splice(index, 1);
                    }
                }
            }
            idMap.delete(childWindow);
            stateMap.delete(childWindow);
        });

        childWindow.on('close', async e => {
            //for what ever reason electron does not seem to work well with await, it sill continues to execute async instead of waiting
            //so we prevent default to cancel the event and later remove the events and close again
            e.preventDefault();
            //check if can close window
            if (!await executeScript(`if(typeof closeable === "function") closeable(); else (function() { return true; })();`, childWindow).catch(logError)) return;
            //get client window is for
            const id = getClientId(view);
            if (clients[id]) {
                //find the index to access window options
                const index = getChildWindowIndex(clients[id].windows, childWindow);
                //save the window state
                clients[id].states[file] = states[file];
                //if window is persistent do not close it and instead use close Hidden hook to check if closeable
                if (index !== -1 && clients[id].windows[index].details.options.persistent) {
                    executeScript('if(typeof closeHidden !== "function" || closeHidden(true)) window.hide();', childWindow).catch(logError);
                    return;
                }
            }
            //wait until close hooks executed
            await executeCloseHooks(childWindow);
            //if window not destroyed close it for real
            if (childWindow && !childWindow.isDestroyed()) {
                //remove events to prevent double executing
                childWindow.removeAllListeners('close');
                childWindow.close();
            }
            if (clients[id] && clients[id].parent)
                clients[id].parent.focus();
        });
        clients[getClientId(view)].windows.push({ window: childWindow, details: details });
        idMap.set(childWindow, getClientId(view));
    });

    initializeIPCDebug(view.webContents, `Client Id: ${getClientId(view)}`);

    //view.setAutoResize({
    //width: true,
    //height: true
    //})
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
            height: options.bounds.height - (options.offset || 0)
        });
        if (global.debug)
            openDevtools(view.webContents, { activate: false });
    }
    view.webContents.loadFile(options.file);
    require("@electron/remote/main").enable(view.webContents);
    if (!options.id) {
        _clientID++;
        //in case the new id is used from old layout loop until find empty id
        while (clients[_clientID])
            _clientID++;
        options.id = _clientID;
    }
    clients[options.id] = { view: view, windows: [], parent: options.parent, file: options.file !== 'build/index.html' ? options.file : 0, states: {} };
    idMap.set(view, options.id);
    loadWindowScripts(view, options.script || 'user');
    script = `if(typeof setId === "function") setId(${options.id});window.loadTheme();`;
    if (options.data)
        clients[options.id].options = { data: options.data.data, windows: options.data.windows || [], states: options.data.states || {} };
    else
        clients[options.id].options = { data: {}, windows: [], states: {} };
    // + 'if(typeof restoreWindow === "function") restoreWindow(' + JSON.stringify(clients[options.id].options) + ');'
    executeScript(script, clients[options.id].view);
    if (options.name && options.name.length !== 0) {
        clients[options.id].name = options.name;
        names[options.name] = options.id;
    }
    //addInputContext(view, getSetting('spellchecking'));
    return options.id;
}

async function removeClient(id) {
    const client = clients[id];
    //don't close
    if (await canCloseClient(id, true) !== true)
        return;
    const window = client.parent;
    const windowId = getWindowId(window);
    const idx = windows[windowId].clients.indexOf(id);
    //last client so close window instead of removing
    if (windows[windowId].clients.length === 1 && idx !== -1) {
        windows[windowId].window.close();
        return;
    }
    //close client windows first incase they need parent window set
    closeClientWindows(id);
    windows[windowId].clients.splice(idx, 1);
    if (windows[windowId].current === id) {
        if (idx >= windows[windowId].clients.length)
            windows[windowId].current = windows[windowId].clients[windows[windowId].clients.length - 1];
        else
            windows[windowId].current = windows[windowId].clients[idx];
    }
    client.parent = null;
    delete client.parent;
    idMap.delete(client.view);
    //close the view, not used in clients but leave in case added in future
    //await executeCloseHooks(client.view);    
    //due to a bug in electron it does not fire the unload event, so we fake it to ensure cleanup code is called
    await executeScript('window.dispatchEvent(new Event("beforeunload"))', client.view).catch(logError);
    //remove the view to avoid crashing window
    window.contentView.removeChildView(client.view);
    client.view.webContents.destroy();
    if (clients[id].name)
        delete names[clients[id].name];
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
    return;
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
    if (!clients) return;
    const windowLength = Object.keys(windows).length;
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId) || !clients[clientId].view.webContents || clients[clientId].view.webContents.isDestroyed())
            continue;
        const windowId = getWindowId(clients[clientId].parent);
        clients[clientId].view.webContents.send('clients-changed', windowLength, (windows[windowId] && windows[windowId].clients) ? windows[windowId].clients.length : 0);
    }
    const windowsDialog = getWindowId('windows');
    if (windowsDialog)
        windowsDialog.webContents.send('clients-changed', windowLength, Object.keys(clients).length);
    updateTray();
}

async function canCloseClient(id, warn, all, allWindows) {
    const client = clients[id];
    //main client can not close so no need to check children
    if (await executeScript(`if(typeof closeable === "function") closeable(${all}, ${allWindows || false}); else (function() { return true; })();`, client.view) === false)
        return false;
    const wl = client.windows.length;
    for (let w = 0; w < wl; w++) {
        let window = client.windows[w].window;
        if (window && !window.isDestroyed() && window.isModal()) {
            if (warn) {
                dialog.showMessageBox(client.parent, {
                    type: 'info',
                    message: `All modal dialogs must be closed before you can exit.`
                });
                window.focus();
            }
            return false;
        }
        //check each child window just to be safe
        if (await executeScript(`if(typeof closeable === "function") closeable(${all}, ${allWindows || false}); else (function() { return true; })();`, window) === false)
            return false;
    }
    return true;
}

async function canCloseAllClients(windowId, warn, all) {
    //reset all tracking unless its all windows trying to close
    if (!all) {
        global.closeAll = false;
        global.noCloseAll = false;
    }
    const cl = windows[windowId].clients.length;
    for (var idx = 0; idx < cl; idx++) {
        if (!await canCloseClient(windows[windowId].clients[idx], warn, true, all))
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
        if (!await canCloseAllClients(window, warn, true))
            return false;
    }
    if (getWindowId('profiles') && !getWindowId('profiles').isDestroyed()) {
        dialog.showMessageBox(getWindowId('profiles'), {
            type: 'info',
            message: `Profile manager must be closed before you can exit.`
        });
        getWindowId('profiles').focus();
        return false;
    }
    if (getWindowId('about') && !getWindowId('about').isDestroyed()) {
        dialog.showMessageBox(getWindowId('about'), {
            type: 'info',
            message: `About dialog must be closed before you can exit.`
        });
        getWindowId('about').focus();
        return false;
    }
    if (getWindowId('prefs') && !getWindowId('prefs').isDestroyed()) {
        dialog.showMessageBox(getWindowId('prefs'), {
            type: 'info',
            message: `Preference dialog must be closed before you can exit.`
        });
        getWindowId('prefs').focus();
        return false;
    }
    if (progressMap.size) {
        dialog.showMessageBox({
            type: 'info',
            message: `All progress dialogs must be closed before you can exit.`
        });
        return false;
    }
    return true;
}

function initializeChildWindow(window, link, details, noClose) {
    let file = link;
    if (file.startsWith(URL.pathToFileURL(__dirname).href))
        file = file.substring(URL.pathToFileURL(__dirname).href.length + 1);
    require("@electron/remote/main").enable(window.webContents);
    window.removeMenu();
    window.once('ready-to-show', () => {
        if (details.options.overlayIcon)
            window.setOverlayIcon(details.options.overlayIcon, details.options.overlayTip || details.options.title || '');
        //exclude the -ID when loading scripts
        if (/\-[0-9]+$/.test(details.frameName))
            loadWindowScripts(window, details.frameName.substring(0, details.frameName.lastIndexOf('-')));
        else
            loadWindowScripts(window, details.frameName);
        if (!details.options.noInputContext)
            addInputContext(window, getSetting('spellchecking'));
        if ('visible' in details.options && !details.options.visible)
            window.hide();
        else
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
        var u = new URL.URL(childDetails.url);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
            shell.openExternal(childDetails.url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: buildOptions(childDetails, window, _settings)
        }
    });

    window.webContents.on('did-create-window', (childWindow, childDetails) => {
        initializeChildWindow(childWindow, childDetails.url, childDetails);
    });

    window.webContents.on('context-menu', (e, params) => {
        window.webContents.send('context-menu', params);
    });

    window.on('resize', () => {
        states[file] = saveWindowState(window, stateMap.get(window) || states[file]);
        stateMap.set(window, states[file]);
    });

    window.on('move', () => {
        states[file] = saveWindowState(window, stateMap.get(window) || states[file]);
        stateMap.set(window, states[file]);
    });

    window.on('maximize', () => {
        states[file] = saveWindowState(window, stateMap.get(window) || states[file]);
        states[file].maximized = true;
        stateMap.set(window, states[file]);
    });

    window.on('unmaximize', () => {
        states[file] = saveWindowState(window, stateMap.get(window) || states[file]);
        states[file].maximized = false;
        stateMap.set(window, states[file]);
    });

    window.on('enter-full-screen', () => {
        states[file] = saveWindowState(window, stateMap.get(window) || states[file]);
        states[file].fullscreen = true;
        stateMap.set(window, states[file]);
    });

    window.on('leave-full-screen', () => {
        states[file] = saveWindowState(window, stateMap.get(window) || states[file]);
        states[file].fullscreen = true;
        stateMap.set(window, states[file]);
    });

    window.on('resized', () => {
        states[file] = saveWindowState(window, stateMap.get(window) || states[file]);
        stateMap.set(window, states[file]);
    });

    window.on('closed', () => {
        stateMap.delete(window);
        if (noClose || !details || !details.options) return;
        const parent = details.options.parent;
        if (parent && !parent.isDestroyed() && parent.webContents && !parent.webContents.isDestroyed())
            executeScript(`if(typeof childClosed === "function") childClosed('${file}', '${link}', '${details.frameName}');`, parent, true).catch(logError);
    });

    window.on('close', e => {
        states[file] = saveWindowState(window, stateMap.get(window) || states[file]);
    });
    stateMap.set(window, saveWindowState(window) || states[file]);
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

async function executeCloseHooks(window) {
    if (!window) return;
    await executeScript('if(typeof closing === "function") closing();', window).catch(logError);
    await executeScript('if(typeof closed === "function") closed();', window).catch(logError);
    await executeScript('if(typeof closeHidden === "function") closeHidden();', window).catch(logError);
}

async function executeCloseHooksClients(windowId) {
    const cl = windows[windowId].clients.length;
    for (var idx = 0; idx < cl; idx++){
        //main client never calls the close hooks so just ignore them
        //await executeCloseHooks(clients[windows[windowId].clients[idx]].view);
        //due to a bug in electron it does not fire the unload event, so we fake it to ensure cleanup code is called
        await executeScript('window.dispatchEvent(new Event("beforeunload"))', clients[windows[windowId].clients[idx]].view).catch(logError);
    }
}

function updateIcon(window) {
    const windowId = getWindowId(window);
    switch (clients[windows[windowId].current].overlay) {
        case 4:
        case 1:
            window.setIcon(getOverlayIcon(7));
            break;
        case 5:
        case 2:
            window.setIcon(getOverlayIcon(8));
            break;
        case 'code':
            window.setIcon(path.join(__dirname, '../assets/icons/png/code.png'));
            break;
        default:
            window.setIcon(getOverlayIcon(6));
            break;
    }
    updateOverlay();
}

function updateOverlay() {
    let overlay = 0;
    let window = BrowserWindow.getFocusedWindow();
    let windowId;
    if (global.editorOnly)
        overlay = 'code';
    else if (window && getWindowId(window) && windows[getWindowId(window)] && clients[windows[getWindowId(window)].current]) {
        windowId = getWindowId(window);
        if (!clients[windows[windowId].current])
            overlay = 0;
        else
            overlay = clients[windows[windowId].current].overlay;
        if (overlay === 5)
            windows[windowId].overlay = 2;
        else if (overlay === 4)
            windows[windowId].overlay = 1;
        else if (overlay === 3)
            windows[windowId].overlay = 0;
        else
            windows[windowId].overlay = overlay;
    }
    else {
        //use the last active window as the target to update info
        window = getActiveWindow().window;
        for (windowId in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, windowId))
                continue;
            const cl = windows[windowId].clients.length;
            windows[windowId].overlay = 0;
            for (let idx = 0; idx < cl; idx++) {
                switch (clients[windows[windowId].clients[idx]].overlay) {
                    case 4:
                    case 1:
                        if (overlay < 1) {
                            overlay = 1;
                            windows[windowId].overlay = 1;
                        }
                        break;
                    case 5:
                    case 2:
                        if (overlay < 2) {
                            overlay = 2;
                            windows[windowId].overlay = 2;
                        }
                        break;
                }
            }
            if (windows[windowId].overlay === 3)
                windows[windowId].overlay = 0;
        }
    }
    switch (overlay) {
        case 4:
        case 1:
            if (process.platform !== 'linux')
                window.setOverlayIcon(getOverlayIcon(1), 'Connected');
            break;
        case 5:
        case 2:
            if (process.platform !== 'linux') {
                if (_focused)
                    window.setOverlayIcon(getOverlayIcon(1), 'Connected');
                else
                    window.setOverlayIcon(getOverlayIcon(2), 'Received data');
            }
            break;
        case 'code':
            if (process.platform !== 'linux')
                window.setOverlayIcon(path.join(__dirname, '../assets/icons/png/codeol.png'), 'Code editor');
            break;
        default:
            if (process.platform !== 'linux')
                window.setOverlayIcon(getOverlayIcon(0), 'Disconnected');
            break;
    }
    updateTray();
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
    str = str.replace(/{profiles}/g, path.join(app.getPath('userData'), 'profiles'));
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

ipcMain.on('templatePath', (event, p) => {
    event.returnValue = templatePath(p);
});

function templatePath(p) {
    const paths = [
        '{characters}',
        '{themes}',
        '{assets}',
        '{data}',
        '{home}',
        '{path}',
        '{appData}',
        '{temp}',
        '{desktop}',
        '{documents}',
        '{downloads}',
        '{music}',
        '{pictures}',
        '{videos}',
        '{profiles}'
    ];
    const sl = paths.length;
    //cache the path for some speed boost 
    const testPath = getFilePath(p);
    for (let s = 0; s < sl; s++) {
        const t = getFilePath(parseTemplate(paths[s]));
        if (testPath.startsWith(t))
            return paths[s] + p.substr(t.length);
    }
    return p;
}

function templateObject(obj) {
    if (!obj) return obj;
    for (prop in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, prop))
            continue;
        if (typeof obj[prop] === 'object')
            obj[prop] = templateObject(obj[prop]);
        else if (typeof obj[prop] === 'string')
            obj[prop] = templatePath(obj[prop]);
    }
    return obj
}

function parseTemplateObject(obj) {
    if (!obj) return obj;
    for (prop in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, prop))
            continue;
        if (typeof obj[prop] === 'object')
            obj[prop] = parseTemplateObject(obj[prop]);
        else if (typeof obj[prop] === 'string')
            obj[prop] = parseTemplate(obj[prop]);
    }
    return obj
}

//#region File system functions
//Hack to fix window/mac casing issues
function getFilePath(file) {
    if (file && process.platform !== 'linux')
        return file.toLowerCase();
    return file;
}

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

function logError(err, skipClient, title) {
    if (!err) {
        if (!global.debug) return;
        err = new Error('Empty error');
    }
    title = title || '';
    if (title && title.length) title += '\n';
    var msg = '';
    if (global.debug || getSetting('enableDebug'))
        console.error(title + err);
    if (err.stack && getSetting('showErrorsExtended'))
        msg = err.stack;
    else if (err instanceof TypeError)
        msg = err.name + ': ' + err.message;
    else if (err instanceof Error)
        msg = err.name + ': ' + err.message;
    else if (err.message)
        msg = err.message;
    else
        msg = err;
    if (!global.editorOnly && !skipClient) {
        //found a client else fallback to global settings
        if (sendClient('error', title + msg))
            return;
    }
    if (getSetting('logErrors')) {
        if (!getSetting('showErrorsExtended')) {
            if (err.stack)
                msg = err.stack;
            else {
                err = new Error(err);
                msg = err.stack;
            }
        }
        else if (!err.stack) {
            err = new Error(err);
            msg = err.stack;
        }
        fs.writeFileSync(errorLog, `${new Date().toLocaleString()}\n${title}${msg}\n`, { flag: 'a' });
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
    list.push({
        type: 'tasks',
        items: [
            {
                type: 'task',
                title: 'New code editor',
                description: 'Opens a new code editor',
                program: process.execPath,
                args: '-eo', // force editor only mode
                iconPath: path.join(__dirname, '..', '..', 'app.asar.unpacked', 'assets', 'icons', 'win', 'code2.ico'),//process.execPath,
                iconIndex: 0
            }
        ]
    });
    if (getSetting('useSingleInstance'))
        list[0].items.push(...[
            {
                type: 'task',
                title: 'New tab',
                description: 'Opens a new tab in active window',
                program: process.execPath,
                args: '-nt',
                iconPath: path.join(__dirname, '..', '..', 'app.asar.unpacked', 'assets', 'icons', 'win', 'tab.ico'),
                iconIndex: 0
            },
            {
                type: 'task',
                title: 'New window',
                description: 'Opens a new window',
                program: process.execPath,
                args: '-nw',
                iconPath: path.join(__dirname, '..', '..', 'app.asar.unpacked', 'assets', 'icons', 'win', 'window.ico'),
                iconIndex: 0
            }
        ]);
    try {
        app.setJumpList(list);
    } catch (error) {
        logError(error);
    }
}

function showAllWindows() {
    for (window in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, window) || !windows[window] || windows[window].window.isDestroyed())
            continue;
        restoreWindowState(windows[window].window, states[windows[window].file || 'manager.html'], 2);
    }
}

function hideAllWindows() {
    for (window in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, window) || !windows[window] || windows[window].window.isDestroyed())
            continue;
        if (getSetting('hideOnMinimize'))
            windows[window].window.hide();
        else
            windows[window].window.minimize();
    }
}

function toggleAllWindows() {
    for (window in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, window) || !windows[window] || windows[window].window.isDestroyed())
            continue;
        if (windows[window].window.isVisible()) {
            if (getSetting('hideOnMinimize'))
                windows[window].window.hide();
            else
                windows[window].window.minimize();
        }
        else
            restoreWindowState(windows[window].window, states[windows[window].file || 'manager.html'], 2);
    }
}

async function closeAllWindows(checkClose) {
    return new Promise(async (resolve, reject) => {
        for (window in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, window))
                continue;
            if (checkClose && !await canCloseAllClients(window, warn, true))
                return false;
            windows[window].window.close();
        }
        setTimeout(() => {
            allWindowsClosed().then(resolve).catch(reject);
        }, 0);
    });
}

async function allWindowsClosed() {
    return new Promise((resolve, reject) => {
        if (Object.keys(windows).length === 0 && Object.keys(clients).length === 0)
            resolve();
        else
            setTimeout(() => {
                allWindowsClosed().then(resolve).catch(reject);
            }, 0);
    });
}

//#region Auto updates
function createUpdater(window) {
    const autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.on('download-progress', progressObj => {
        window.setProgressBar(progressObj.percent / 100);
        const progress = progressMap.get(window);
        if (progress)
            progress.webContents.send('progress', 'update', progressObj);
    });
    return autoUpdater;
}

function checkForUpdates() {
    const window = getActiveWindow().window;
    if (getSetting('checkForUpdates') && !_checkingUpdates) {
        _checkingUpdates = true;
        //resources/app-update.yml
        if (!isFileSync(path.join(app.getAppPath(), '..', 'app-update.yml'))) {
            if (dialog.showMessageBoxSync({
                type: 'warning',
                title: 'Not supported',
                message: 'Auto update is not supported with this version of jiMUD, try anyways?',
                buttons: ['Yes', 'No'],
                defaultId: 1,
                noLink: true
            }) !== 0)
                return;
        }
        const autoUpdater = createUpdater(window);
        autoUpdater.on('update-downloaded', () => {
            window.setProgressBar(-1);
            const progress = progressMap.get(window);
            if (progress)
                progress.close();
            //store current line arguments to use on next load
            fs.writeFileSync(path.join(app.getPath('userData'), 'argv.json'), JSON.stringify(process.argv));
            _checkingUpdates = false;
        });
        autoUpdater.on('error', (error) => {
            dialog.showErrorBox('Error: ', error == null ? 'unknown' : (error.stack || error).toString());
            window.setProgressBar(-1);
            const progress = progressMap.get(window);
            if (progress)
                progress.close();
            _checkingUpdates = false;
        });
        autoUpdater.on('update-available', () => {
            openProgress(window, 'Downloading update&hellip;');
        });
        autoUpdater.on('update-not-available', () => {
            window.setProgressBar(-1);
            const progress = progressMap.get(window);
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
            noLink: true
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
        const progress = progressMap.get(window);
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
        const progress = progressMap.get(window);
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
    if (getSetting('fixHiddenWindows')) {
        const { width } = screen.getPrimaryDisplay().workAreaSize;
        if (x + w >= width)
            return width - w;
        if (x + w < 0)
            return 0;
    }
    return x;
}

function getWindowY(y, h) {
    if (getSetting('fixHiddenWindows')) {
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
    if (file.startsWith(URL.pathToFileURL(__dirname).href))
        file = file.substring(URL.pathToFileURL(__dirname).href.length + 1);
    options = {
        file: file,
        backgroundColor: '#000',
        show: true,
        icon: path.join(__dirname, '../assets/icons/png/64x64.png'),
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            nodeIntegrationInSubFrames: true,
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
                case '':
                    continue;
                case 'defaultX':
                case 'defaultY':
                    if (feature[1] === 'center')
                        options[feature[0]] = feature[1];
                    else
                        options[feature[0]] = parseInt(feature[1], 10);
                    options.features[feature[0]] = options[feature[0]];
                    break;
                case 'defaultWidth':
                case 'defaultHeight':
                case "width":
                case "height":
                case "x":
                case "y":
                case "minWidth":
                case "minHeight":
                case "maxWidth":
                case "maxHeight":
                case "defaultFontSize":
                case "defaultMonospaceFontSize":
                case "minimumFontSize":
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
    if ('visible' in options)
        options.show = options.visible;
    //if no width or height see if a default was supplied
    if (!('width' in options))
        options.width = 'defaultWidth' in options ? options.defaultWidth : 800;
    if (!('height' in options))
        options.height = 'defaultHeight' in options ? options.defaultHeight : 600;
    if (!('x' in options)) {
        if ('defaultX' in options) {
            if (options.defaultX === 'center') {
                parentBounds = window.getBounds();
                options.x = Math.floor(parentBounds.x + parentBounds.width / 2 - options.width / 2);
            }
            else
                options.x = options.defaultX;
        }
        else
            options.x = 0;
    }
    if (!('y' in options)) {
        if ('defaultY' in options) {
            if (options.defaultY === 'center') {
                parentBounds = window.getBounds();
                options.y = Math.floor(parentBounds.y + parentBounds.height / 2 - options.height / 2);
            }
            else
                options.y = options.defaultY;
        }
        else
            options.y = 0;
    }
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
    //if not found default to the first window with clients
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

function viewFromContents(contents) {
    if (!contents) return null
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        if (clients[clientId].view.webContents === contents)
            return clients[clientId].view;
    }
    return null;
}

function setVisibleClient(windowId, clientId) {
    if (!windows[windowId] || !clients[clientId]) return;
    const view = clients[clientId].view;
    const current = windows[windowId].current;
    clients[clientId].view.setVisible(true);
    //z-ordering to move view to top most
    windows[windowId].window.contentView.addChildView(clients[clientId].view);
    //clients[clientId].view.webContents.invalidate();
    //if current is client skip hiding old to avoid flicker/cpu/gpu changes
    if (clients[current] && current !== clientId)
        clients[current].view.setVisible(false);
    windows[windowId].current = clientId;
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

function windowFromContents(contents) {
    if (!contents) return null;
    let window = BrowserWindow.fromWebContents(contents);
    if (!window) {
        const client = clientFromContents(contents)
        if (client)
            return client.parent;
    }
    return window;
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

function focusClient(clientId, focusWindow, switchClient) {
    if (!clients[clientId]) return;
    client = clients[clientId];
    //client.parent.webContents.send('switch-client', clientId);
    if (focusWindow) {
        client.parent.focus();
        client.parent.webContents.focus();
    }
    const windowId = getWindowId(client.parent);
    if (switchClient && windows[windowId].current !== clientId)
        client.parent.webContents.send('switch-client', clientId);
    if (client.view && client.view.webContents)
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
    //if no if more then likely a main window
    if (!clientId) return;
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

function newConnectionFromCharacterId(id, window) {
    const charID = getCharacterFromId(id);
    if (charID) {
        //window.webContents.once('did-finish-load', () => {
        newConnection(window, null, {
            characterId: charID.ID,
            settings: parseTemplate(charID.Preferences),
            map: parseTemplate(charID.Map),
            port: charID.Port
        });
        //});
    }
}

function newConnection(window, connection, data, name) {
    let windowId = getWindowId(window);
    let id;
    if (data)
        id = createClient({ parent: window, name: name, offset: windows[windowId].clients.length ? clients[windows[windowId].current].view.getBounds().y : 0, bounds: window.getContentBounds(), data: { data: data } });
    else
        id = createClient({ parent: window, name: name, offset: windows[windowId].clients.length ? clients[windows[windowId].current].view.getBounds().y : 0, bounds: window.getContentBounds() });
    focusedWindow = windowId;
    focusedClient = id;
    windows[windowId].clients.push(id);
    window.contentView.addChildView(clients[id].view);
    setVisibleClient(windowId, id);
    //did-navigate //fires before dom-ready but view seems to still not be loaded and delayed
    //did-finish-load //slowest but ensures the view is in the window and visible before firing
    window.webContents.send('new-client', { id: id, current: windows[windowId].current === id });
    //if (connection)
    //clients[id].view.webContents.send('connection-settings', connection);
    clients[id].connection = connection;
    onContentsLoaded(clients[id].view.webContents).then(() => {
        if (connection)
            clients[id].view.webContents.send('connection-settings', connection);
        if (focusedClient === id && focusedWindow === windowId)
            focusWindow(window, true);
        clientsChanged();
    });
}

async function newClientWindow(caller, connection, data, name) {
    if (caller) {
        //save the current states so it has the latest for new window
        states['manager.html'] = saveWindowState(caller, stateMap.get(caller) || states['manager.html']);
        stateMap.set(caller, states['manager.html']);
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
    let window = windows[windowId];
    let id;
    focusedWindow = windowId;
    if (Array.isArray(data)) {
        for (let d = 0, dl = data.length; d < dl; d++) {
            id = createClient({ parent: window.window, name: d === 0 ? name : null, bounds: window.window.getContentBounds(), data: { data: data[d] } });
            window.clients.push(id);
            window.window.contentView.addChildView(clients[id].view);
            clients[id].view.setVisible(id === window.current);
        }
        focusedClient = id;
        for (var c = 0, cl = window.clients.length; c < cl; c++) {
            const clientId = window.clients[c];
            //if (connection)
            //clients[id].view.webContents.send('connection-settings', connection);
            clients[id].connection = connection;
            onContentsLoaded(clients[clientId].view.webContents).then(() => {
                if (connection)
                    clients[id].view.webContents.send('connection-settings', connection);
                clients[clientId].view.webContents.send('clients-changed', Object.keys(windows).length, window.clients.length);
                //if (clientId !== window.current)
                //clients[clientId].view.setVisible(false);
            });
        }
        window.window.once('ready-to-show', () => {
            window.window.webContents.send('set-clients', window.clients.map(x => {
                return {
                    id: x,
                    current: x === window.current,
                    noUpdate: true
                };
            }), window.current);
            setVisibleClient(windowId, window.current);
            if (focusedWindow === windowId)
                focusWindow(window.window, true);
        });
    }
    else {
        if (data)
            id = createClient({ parent: window.window, name: name, bounds: window.window.getContentBounds(), data: { data: data } });
        else
            id = createClient({ parent: window.window, name: name, bounds: window.window.getContentBounds() });
        focusedClient = id;
        window.clients.push(id);
        window.window.contentView.addChildView(clients[id].view);
        setVisibleClient(windowId, id);
        //if (connection)
        //clients[id].view.webContents.send('connection-settings', connection);
        clients[id].connection = connection;
        onContentsLoaded(clients[id].view.webContents).then(() => {
            clientsChanged();
            if (connection)
                clients[id].view.webContents.send('connection-settings', connection);
        });
        window.window.webContents.send('new-client', { id: id });
        onContentsLoaded(window.window.webContents).then(() => {
            if (focusedClient === id && focusedWindow === windowId)
                focusWindow(window.window, true);
        });
    }
    return window.window;
}

function newEditorWindow(caller, files) {
    if (caller) {
        //save the current states so it has the latest for new window
        states['code.editor.html'] = saveWindowState(caller, stateMap.get(caller) || states['code.editor.html']);
        stateMap.set(caller, states['code.editor.html']);
        //offset the state so it is not an exact overlap
        states['code.editor.html'].bounds.x += 20;
        states['code.editor.html'].bounds.y += 20;
        const { height, width } = screen.getPrimaryDisplay().workAreaSize;
        //make sure the window appears on the screen
        if (states['code.editor.html'].bounds.x > (width - 10))
            states['code.editor.html'].bounds.x = width - states['code.editor.html'].bounds.width;
        if (states['code.editor.html'].bounds.x < 10)
            states['code.editor.html'].bounds.x = 10;
        if (states['code.editor.html'].bounds.y > (height - 10))
            states['code.editor.html'].bounds.y = height - states['code.editor.html'].bounds.height;
        if (states['code.editor.html'].bounds.y < 10)
            states['code.editor.html'].bounds.y = 10;
    }
    let windowId = createWindow({ file: 'code.editor.html', backgroundColor: 'gray', icon: '../assets/icons/win/code.ico', title: 'Code editor' });
    let window = windows[windowId].window;
    focusedWindow = windowId;
    onContentsLoaded(window.webContents).then(() => {
        if (Array.isArray(files) || typeof files === 'string')
            window.webContents.send('open-editor', files);
        focusWindow(window, true);
        if (process.platform === 'linux')
            window.setIcon(path.join(__dirname, '../assets/icons/png/code.png'));
        else
            window.setOverlayIcon(path.join(__dirname, '../assets/icons/png/codeol.png'), 'Code editor');
    });
    addInputContext(window, getSetting('spellchecking'));
    return window;
}
//#region Execute scripts in window/view
// eslint-disable-next-line no-unused-vars
async function executeScript(script, window, focus) {
    return new Promise((resolve, reject) => {
        if (!window || (typeof window.isDestroyed === 'function' && window.isDestroyed()) || !window.webContents || window.webContents.isDestroyed()) {
            reject();
            return;
        }
        window.webContents.executeJavaScript(script).then(results => resolve(results)).catch(err => {
            logError(new Error(`Window: ${window.webContents.getURL() || 'Unknown'}\nScript error: ${script}`), !getSetting('showErrorsExtended'));
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
            logError(new Error(`Window: ${window.webContents.getURL() || 'Unknown'}\nScript error: ${script}`), !getSetting('showErrorsExtended'));
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
async function saveWindowLayout(file, locked) {
    if (!file)
        file = parseTemplate(path.join('{data}', global.editorOnly ? 'editor.layout' : 'window.layout'));
    let id;
    let data;
    //lock layout loads old layout data and only updates global states and leaves windows/clients alone
    if (locked) {
        try {
            data = fs.readFileSync(file, 'utf-8');
        }
        catch (e) {
            logError(e);
            return;
        }
        try {
            data = JSON.parse(data);
        }
        catch (e) {
            logError(e);
            return;
        }
        data.states = states;
    }
    else {
        data = {
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
                data: await executeScript('if(typeof saveWindow === "function") saveWindow()', windows[id].window).catch(logError),
                state: saveWindowState(windows[id].window, stateMap.get(windows[id].window)),
                menubar: windows[id].menubar ? true : false,
                options: windows[id].options,
                windows: []
            }
            if (windows[id].windows) {
                const wl = windows[id].windows.length;
                for (var idx = 0; idx < wl; idx++) {
                    wData.push({
                        options: windows[id].windows[idx].details.options.features,
                        state: saveWindowState(windows[id].windows[idx].window, stateMap.get(windows[id].windows[idx].window)),
                        data: await executeScript('if(typeof saveWindow === "function") saveWindow()', windows[id].windows[idx].window).catch(logError),
                    });
                }
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
                data: templateObject(await executeScript('if(typeof saveWindow === "function") saveWindow()', clients[id].view).catch(logError)),
                states: clients[id].states,
                name: clients[id].name
            }
            const wl = clients[id].windows.length;
            for (var idx = 0; idx < wl; idx++) {
                const window = clients[id].windows[idx].window;
                //for what ever reason skip the window, eg chat window no longer needed for what ever reason
                if (await executeScript(`if(typeof skipSaveWindow === "function") skipSaveWindow(); else (function() { return false; })();`, window).catch(logError))
                    continue;
                const wData = {
                    client: getClientId(clients[id].view), //use function to ensure proper id data type
                    state: saveWindowState(window, stateMap.get(window)),
                    details: { url: templatePath(URL.fileURLToPath(clients[id].windows[idx].details.url)), options: templateObject(clients[id].windows[idx].details.options.features) },
                    //get any custom data from window
                    data: templateObject(await executeScript('if(typeof saveWindow === "function") saveWindow()', window).catch(logError))
                }
                if (wData.details.options) {
                    for (key in wData.state) {
                        if (!Object.prototype.hasOwnProperty.call(wData.state, key) || key === 'alwaysOnTop')
                            continue;
                        if (key in wData.details.options)
                            delete wData.details.options[key];
                    }
                    delete wData.details.options.x;
                    delete wData.details.options.y;
                    delete wData.details.options.width;
                    delete wData.details.options.height;
                }
                cData.windows.push(wData);
            }
            data.clients.push(cData);
        }
    }
    fs.writeFileSync(file, JSON.stringify(data));
}

function loadWindowLayout(file, charData) {
    if (!file)
        file = parseTemplate(path.join('{data}', global.editorOnly ? 'editor.layout' : 'window.layout'));
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
        if (global.editorOnly)
            newEditorWindow();
        else if (charData)
            newClientWindow(null, null, charData);
        else
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
        createWindow({
            ...data.windows[i].options,
            ...{
                id: data.windows[i].id,
                data: { data: data.windows[i].data, state: data.windows[i].state, states: data.states }
            }
        });
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
        if (client.id === windows[focusedWindow].current && charData) {
            if (charData[0])
                client.data = charData[0];
            charData.shift();
        }
        else
            client.data = parseTemplateObject(client.data);
        for (let w = 0, wl = client.windows.length; w < wl; w++) {
            client.windows[w].details.options = parseTemplateObject(client.windows[w].details.options);
            if (!client.windows[w].details.url.startsWith('file://')) {
                client.windows[w].details.url = URL.pathToFileURL(parseTemplate(client.windows[w].details.url)).toString();
            }
        }
        createClient({ parent: windows[client.parent].window, name: client.name, bounds: client.state.bounds, id: client.id, data: client, file: client.file });
    }
    //append any remaining new characters
    if (charData && charData.length) {
        il = charData.length;
        let id;
        for (i = 0; i < il; i++) {
            id = createClient({ parent: windows[focusedWindow].window, bounds: windows[focusedWindow].window.getContentBounds(), data: { data: charData[i] } });
            windows[focusedWindow].clients.push(id);
        }
        windows[focusedWindow].current = id;
        focusedClient = id;
        data.windows[i].current = id;
    }
    //set current clients for each window after everything is created
    il = data.windows.length;
    for (i = 0; i < il; i++) {
        const window = windows[data.windows[i].id];
        //no clients so move on probably different type of window
        if (window.clients.length === 0) {
            onContentsLoaded(window.window.webContents).then(() => {
                if (data.focusedWindow === getWindowId(window))
                    focusWindow(window, true);
                if (window.options.file === 'code.editor.html') {
                    if (process.platform === 'linux')
                        window.window.setIcon(path.join(__dirname, '../assets/icons/png/code.png'));
                    else
                        window.window.setOverlayIcon(path.join(__dirname, '../assets/icons/png/codeol.png'), 'Code editor');
                }
            });
            continue;
        }
        let current = data.windows[i].current;
        //current is wrong for what ever reason so fall back to first client
        if (!clients[current])
            current = window.clients[0];
        for (var c = 0, cl = window.clients.length; c < cl; c++) {
            const clientId = window.clients[c];
            window.window.contentView.addChildView(clients[clientId].view);
            clients[clientId].view.setVisible(true);
            clients[clientId].view.webContents.send('clients-changed', Object.keys(windows).length, window.clients.length);
            onContentsLoaded(clients[clientId].view.webContents).then(() => {
                clients[clientId].view.webContents.send('clients-changed', Object.keys(windows).length, window.clients.length);
                clients[clientId].view.setVisible(clientId === current);
            });
        }
        onContentsLoaded(window.window.webContents).then(() => {
            window.window.webContents.send('set-clients', window.clients.map(x => {
                return {
                    id: x,
                    current: x === current,
                    noUpdate: true
                };
            }), current);
            setVisibleClient(getWindowId(window.window), current)
            if (data.focusedWindow === getWindowId(window.window))
                focusWindow(window.window, true);
        });
    }
    return true;
}

function saveWindowState(window, previous) {
    try {
        if (!window || window.isDestroyed())
            return previous;
        const state = {
            bounds: previous && previous.fullscreen ? previous.bounds : window.getNormalBounds(),
            fullscreen: previous ? previous.fullscreen : window.isFullScreen(),
            maximized: previous ? previous.maximized : window.isMaximized(),
            minimized: previous ? previous.minimized : window.isMinimized(),
            devTools: global.debug ? false : window.webContents.isDevToolsOpened(),
            visible: window.isVisible(),
            normal: window.isNormal(),
            enabled: window.isEnabled(),
            alwaysOnTop: window.isAlwaysOnTop()
        };
        //due to bugs getNormalBounds returns the full maxed size instead of the normalized bounds so hack and use the previous ones when possible
        if (process.platform === 'linux' && previous && (previous.maximized || window.isMaximized()))
            state.bounds = previous.bounds;
        return state;
    }
    catch (err) {
        logError(err);
    }
    return previous;
}

function restoreWindowState(window, state, showType) {
    if (!window || !state) return;
    //linux restore hack if a window was hidden it will use the maximized bounds instead of the saved normal bounds
    //main issue is it will resize the window to the small bounds then restore it ot the max/fullscreen bounds
    //only restore if the state was maxed
    if (process.platform === 'linux' && state.maximized)
        window.setBounds(state.bounds);
    //hack to improve visual loading
    if (showType !== 2)
        window.hide();
    if (state.maximized)
        window.maximize();
    else if (state.minimized)
        window.minimize();
    if (!state.visible && showType !== 2)
        window.hide();
    else if (!showType !== 1)
        window.show();
    if (state.fullscreen)
        window.setFullScreen(state.fullscreen);
    if (global.debug && showType !== 2)
        openDevtools(window.webContents, { mode: 'detach', activate: false });
    else if (state.devTools && showType !== 2)
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
                    label: 'New &Tab',
                    id: 'newConnect',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: (item, mWindow, keyboard) => {
                        //allow for some hidden ways to force open main/dev if needed with out the complex menus
                        if (!keyboard.triggeredByAccelerator) {
                            if (keyboard.ctrlKey)
                                newConnection(window || mWindow, { port: 1035 });
                            else if (keyboard.shiftKey)
                                newConnection(window || mWindow, { port: 1030 });
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
                                newClientWindow(window || mWindow, { port: 1035 });
                            else if (keyboard.shiftKey)
                                newClientWindow(window || mWindow, { port: 1030 });
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
                /*
                {
                    label: 'Enable &notifications',
                    id: 'enableNotifications',
                    type: 'checkbox',
                    checked: true,
                    click: (item, mWindow) => {
                        executeScriptClient('toggleNotifications()', window || mWindow, true);
                    }
                },
                */
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
                        executeScriptClient('client.commandInput.dataset.selStart = client.commandInput.selectionStart;client.commandInput.dataset.selEnd = client.commandInput.selectionEnd;pasteSpecial()', window || mWindow, true);
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
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.codeEditor")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Immortal tools',
                            id: 'immortalbutton',
                            type: 'checkbox',
                            visible: false,
                            checked: false,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.immortal")', window || mWindow, true);
                            }
                        },
                        {
                            label: '&Preferences',
                            id: 'preferencesbutton',
                            type: 'checkbox',
                            checked: false,
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
                        */
                        {
                            label: '&Compose mail',
                            id: "composebutton",
                            type: 'checkbox',
                            checked: true,
                            click: (item, mWindow) => {
                                executeScriptClient('toggleView("button.compose")', window || mWindow, true);
                            }
                        },
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
                                    mWindow.webContents.openDevTools({ mode: 'detach' });
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
                                    mWindow.webContents.openDevTools({ mode: 'detach' });
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
                    label: '&Word wrap',
                    type: 'checkbox',
                    accelerator: 'Alt+Z',
                    click: (item, mWindow) => {
                        executeScriptClient('toggleWrap()', window || mWindow, true);
                    }
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
                /*
                {
                  label: '&Mail...',
                  click: (item, mWindow) => {
                    executeScriptClient('showMail()', window || mWindow, true);
                  },
                  visible: true,
                  //accelerator: 'CmdOrCtrl+M'
                },
                */
                {
                    label: '&Compose mail...',
                    click: (item, mWindow) => {
                        executeScriptClient('openWindow("composer")', window || mWindow, true);
                    },
                    visible: true,
                    //accelerator: 'CmdOrCtrl+M'
                },
                { type: 'separator' },
                {
                    label: 'Save &Layout...',
                    id: 'saveLayout',
                    click: (item, mWindow) => {
                        var file = dialog.showSaveDialogSync(window || mWindow, {
                            title: 'Save as...',
                            defaultPath: path.join(app.getPath('userData'), 'window.layout'),
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
                    label: 'L&oad Layout...',
                    id: 'loadLayout',
                    click: (item, mWindow) => {
                        dialog.showOpenDialog(window || mWindow, {
                            defaultPath: app.getPath('userData'),
                            filters: [
                                { name: 'Layout files (*.layout)', extensions: ['layout'] },
                                { name: 'All files (*.*)', extensions: ['*'] },
                            ]
                        }).then(async result => {
                            if (result.filePaths === undefined || result.filePaths.length === 0)
                                return;
                            if (!await canCloseAllWindows(true))
                                return;
                            _reloading = true;
                            await closeAllWindows();
                            const previousLayout = _layout;
                            _layout = result.filePaths[0];
                            _loaded = loadWindowLayout(result.filePaths[0]);
                            if (!_loaded) {
                                dialog.showMessageBox(window || mWindow, {
                                    type: 'error',
                                    message: `Error loading: '${result.filePaths[0]}'.`
                                });
                                _loaded = loadWindowLayout(previousLayout);
                            }
                            _saved = false;
                            _reloading = false;
                        });
                    }
                },
                /*
                {
                    label: 'Reset Layout',
                    id: 'resetLayout',
                    click: (item, mWindow) => {
                        dialog.showMessageBox({
                            type: 'info',
                            message: 'Reset layout to defaults?',
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
                label: '&Windows...',
                click: (item, mWindow) => openWindows(window || mWindow)
            },
            { type: 'separator' },
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
                label: 'Close &others',
                accelerator: 'CmdOrCtrl+Shift+W',
                click: (item, mWindow) => {
                    mWindow = window || mWindow;
                    const _windows = windows[getWindowId(mWindow)];
                    const current = _windows.current;
                    for (c = _windows.clients.length - 1; c >= 0; c--) {
                        if (_windows.clients[c] === current) continue;
                        removeClient(_windows.clients[c], true);
                    }
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
                label: '&Windows...',
                click: (item, mWindow) => openWindows(window || mWindow)
            },
            { type: 'separator' },
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
            },
            {
                label: 'Close &others',
                accelerator: 'CmdOrCtrl+Shift+W',
                click: (item, mWindow) => {
                    mWindow = window || mWindow;
                    const _windows = windows[getWindowId(mWindow)];
                    const current = _windows.current;
                    for (c = _windows.clients.length - 1; c >= 0; c--) {
                        if (_windows.clients[c] === current) continue;
                        removeClient(_windows.clients[c], true);
                    }
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
    updateMenuItem(windowFromContents(event.sender), menuitem, rebuild);
});

ipcMain.on('update-menuitems', (event, menuitems, rebuild) => {
    updateMenuItems(windowFromContents(event.sender), menuitems, rebuild);
});

ipcMain.on('update-menuitem-all', (event, menuitem, rebuild) => {
    updateMenuItemAll(menuitem, rebuild);
});

ipcMain.on('update-menuitems-all', (event, menuitems, rebuild) => {
    updateMenuItemsAll(menuitems, rebuild);
});

ipcMain.on('reset-profiles-menu', (event) => {
    resetProfilesMenu(windowFromContents(event.sender));
});

ipcMain.on('show-window', (event, window, ...args) => {
    if (window === 'profile-manager')
        openProfileManager(windowFromContents(event.sender));
    else if (window === 'about')
        openAbout(windowFromContents(event.sender));
    else if (window === 'global-preferences')
        openPreferences(windowFromContents(event.sender));
    else if (window === 'progress')
        openProgress(windowFromContents(event.sender), ...args)
    else if (window === 'windows')
        openWindows(windowFromContents(event.sender));
});

ipcMain.on('reset-windows', (event, id) => {
    if (id) {
        if (clients[id])
            clients[id].states = {};
    }
    else {
        //clear window states
        states = {};
        let x = 0;
        let y = 0;
        for (window in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, window))
                continue;
            windows[window].window.setBounds({ x: x, y: y, width: 800, height: 600 });
            x += 10;
            y += 10;
            windows[window].state = saveWindowState(windows[window].window);
        }
        for (client in clients) {
            if (!Object.prototype.hasOwnProperty.call(clients, client))
                continue;
            clients[client].states = {};
            executeScript('resetWindows()', clients[client].view);
        }
    }
    event.returnValue = true;
});

const progressMap = new Map();
ipcMain.on('progress', (event, ...args) => {
    window = windowFromContents(event.sender);
    const parent = window.getParentWindow();
    //no parent means the main window wants to send to progress
    if (!parent || !window.getURL().endsWith('progress.html')) {
        const progress = progressMap.get(window);
        progress.webContents.send('progress', ...args);
    }
    else //else progress wants to send to main
        parent.webContents.send('progress', ...args);
});

ipcMain.on('addWordToSpellCheckerDictionary', (event, word) => {
    if (!word || !word.length) return;
    event.sender.session.addWordToSpellCheckerDictionary(word);
});

ipcMain.on('removeWordFromSpellCheckerDictionary', (event, word) => {
    if (!word || !word.length) return;
    event.sender.session.removeWordFromSpellCheckerDictionary(word);
});

ipcMain.handle('listWordsInSpellCheckerDictionary', async (event) => {
    return await event.sender.session.listWordsInSpellCheckerDictionary();
});

ipcMain.on('setSpellCheckerLanguages', (event, languages) => {
    event.sender.session.setSpellCheckerLanguages(languages || []);
});

ipcMain.on('getSpellCheckerLanguages', (event) => {
    event.returnValue = event.sender.session.getSpellCheckerLanguages();
});

function resetProfilesMenu(window) {
    if (!window || !windows[getWindowId(window)].menubar) return;
    const profiles = windows[getWindowId(window)].menubar.getItem('profiles', 2);
    profiles[0].submenu.items.forEach(item => {
        item.checked = false;
    });
    profiles[1].submenu.forEach(item => {
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
        window.on('closed', () => {
            idMap.delete('prefs');
            stateMap.delete(window);
        });
        idMap.set('prefs', window);
    }
}

function openWindows(parent) {
    let window = getWindowId('windows');
    if (window && !window.isDestroyed())
        window.focus();
    else {
        let bounds = { width: 420, height: 300 };
        if (states['windows.html']) {
            bounds.x = states['windows.html'].bounds.x;
            bounds.y = states['windows.html'].bounds.y;
        }
        window = createDialog({
            show: true,
            parent: parent,
            url: path.join(__dirname, 'windows.html'),
            title: 'Windows',
            bounds: bounds,
            icon: path.join(__dirname, '../assets/icons/png/windows.png'),
            resize: false,
            backgroundColor: 'white'
        });
        window.on('closed', () => {
            idMap.delete('windows');
        });
        window.on('close', () => {
            states['windows.html'] = saveWindowState(window);
        });
        idMap.set('windows', window);
    }
}

function openAbout(parent) {
    let window = getWindowId('about');
    if (window && !window.isDestroyed())
        window.focus();
    else {
        window = createDialog({ show: true, parent: parent, url: path.join(__dirname, 'about.html'), title: 'About jiMUD', bounds: { width: 500, height: 560 } });
        window.on('closed', () => {
            idMap.delete('about');
            stateMap.delete(window);
        });
        idMap.set('about', window);
    }
}

function openProgress(parent, title, modal) {
    let window = progressMap.get(parent);
    if (window && !window.isDestroyed())
        window.focus();
    else {
        window = createDialog({ modal: modal, show: true, parent: parent, url: path.join(__dirname, 'progress.html'), title: title, bounds: { width: 200, height: 70 }, backgroundColor: '#fff', icon: path.join(__dirname, '../../assets/icons/png/progress.png') });
        window.on('closed', () => {
            stateMap.delete(window);
            progressMap.delete(parent);
        });
        window.once('ready-to-show', () => {
            window.webContents.send('progress', 'title', title);
        });
        progressMap.set(parent, window);
    }
    return window;
}

function openProfileManager(parent) {
    let window = getWindowId('profiles');
    if (window && !window.isDestroyed())
        window.focus();
    else {
        window = createWindow({ id: 'profiles', file: 'profiles.html', parent: parent, icon: '../assets/icons/png/profiles.png', title: 'Profile Manger' });
        window.setSkipTaskbar(!getSetting('profiles.showInTaskBar'));
    }
}
//#endregion

async function openDevtools(window, options) {
    window.openDevTools(options);
}

//#region Tray functions
async function createTray() {
    if (!getSetting('showTrayIcon'))
        return;
    tray = new Tray(path.join(__dirname, '../assets/icons/png/disconnected2.png'));
    updateTray();
    if (getSetting('trayMenu') === TrayMenu.simple)
        _updateTrayContext();
    tray.on('click', () => {
        const active = getActiveWindow();
        switch (getSetting('trayClick')) {
            case TrayClick.show:
                if (active)
                    restoreWindowState(active.window, states[active.file || 'manager.html'], 2);
                break;
            case TrayClick.toggle:
                if (active) {
                    if (active.window.isVisible()) {
                        if (getSetting('hideOnMinimize'))
                            active.window.hide();
                        else
                            active.window.minimize();
                    }
                    else
                        restoreWindowState(active.window, states[active.file || 'manager.html'], 2);
                }
                break;
            case TrayClick.hide:
                if (active) {
                    if (getSetting('hideOnMinimize'))
                        active.window.hide();
                    else
                        active.window.minimize();
                }
                break;
            case TrayClick.showAll:
                showAllWindows();
                break;
            case TrayClick.hideAll:
                hideAllWindows();
                break;
            case TrayClick.toggleAll:
                toggleAllWindows();
                break;
            case TrayClick.menu:
                tray.popUpContextMenu();
                break;
        }
        for (clientId in clients) {
            if (!Object.prototype.hasOwnProperty.call(clients, clientId))
                continue;
            clients[clientId].view.webContents.send('tray-click');
        }
    });

    tray.on('double-click', () => {
        const active = getActiveWindow();
        switch (getSetting('trayClick')) {
            case TrayClick.show:
                if (active)
                    restoreWindowState(active.window, states[active.file || 'manager.html'], 2);
                break;
            case TrayClick.toggle:
                if (active) {
                    if (active.window.isVisible()) {
                        if (getSetting('hideOnMinimize'))
                            active.window.hide();
                        else
                            active.window.minimize();
                    }
                    else
                        restoreWindowState(active.window, states[active.file || 'manager.html'], 2);
                }
                break;
            case TrayClick.hide:
                if (active) {
                    if (getSetting('hideOnMinimize'))
                        active.window.hide();
                    else
                        active.window.minimize();
                }
                break;
            case TrayClick.showAll:
                showAllWindows();
                break;
            case TrayClick.hideAll:
                hideAllWindows();
                break;
            case TrayClick.toggleAll:
                toggleAllWindows();
                break;
            case TrayClick.menu:
                tray.popUpContextMenu();
                break;
        }
        for (clientId in clients) {
            if (!Object.prototype.hasOwnProperty.call(clients, clientId))
                continue;
            clients[clientId].view.webContents.send('tray-double-click');
        }
    });
}

function getClientConnectionState(clientId) {
    //STATE as NAME from/on DEV
    let title = clients[clientId].view.webContents.getTitle();
    //find if on dev
    let dev = title.split(/ on| from/);
    //if length 2 means on dev
    if (dev.length === 2) {
        title = dev[0].trim();
        dev = true;
    }
    else
        dev = false;
    let name = title.split(' as ');
    if (name.length === 2) {
        title = name[0];
        name = name[1];
    }
    else
        name = '';
    return { state: title, dev: dev, name: name };
}

function getTrayClientContext(window) {
    return [{
        label: 'Ch&aracters...',
        id: 'characters',
        click: () => {
            if (!window) return;
            restoreWindowState(window, stateMap.get(window), 2);
            executeScriptClient('openWindow("characters")', window, true);
        }
    },
    {
        label: '&Manage profiles...',
        click: (item, mWindow) => {
            if (!window) return;
            restoreWindowState(window, stateMap.get(window), 2);
            executeScriptClient('openWindow("profiles")', window, true);
        }
    },
    {
        label: '&Code editor...',
        click: () => {
            if (!window) return;
            restoreWindowState(window, stateMap.get(window), 2);
            executeScriptClient('openWindow("code.editor")', window, true);
        },
    },
    { type: 'separator' },
    {
        label: '&Preferences...',
        click: (item, mWindow) => {
            if (!window) return;
            restoreWindowState(window, stateMap.get(window), 2);
            executeScriptClient('openWindow("prefs");', window, true);
        }
    },
    { type: 'separator' },
    {
        label: '&Who is on?...',
        click: () => {
            if (!window) return;
            restoreWindowState(window, stateMap.get(window), 2);
            executeScriptClient('openWindow("who")', window, true);
        }
    },
    { type: 'separator' },
    {
        label: '&Help',
        role: 'help',
        submenu: [
            {
                label: '&ShadowMUD...',
                click: () => {
                    if (!window) return;
                    restoreWindowState(window, stateMap.get(window), 2);
                    executeScriptClient('openWindow("smhelp")', window, true);
                }
            },
            {
                label: '&jiMUD...',
                click: () => {
                    if (!window) return;
                    restoreWindowState(window, stateMap.get(window), 2);
                    executeScriptClient('openWindow("help")', window, true);
                }
            },
            {
                label: '&jiMUD website...',
                click: () => {
                    shell.openExternal('https://github.com/icewolfz/jiMUD/tree/master/docs', '_blank');
                }
            },
            { type: 'separator' },
            {
                label: '&About...',
                click: () => {
                    if (!window) return;
                    restoreWindowState(window, stateMap.get(window), 2);
                    openAbout(window)
                }
            }
        ]
    }];
}

function getTrayWindowContext(window, windowId, noNew) {
    const contextMenu = [];
    if (!noNew)
        contextMenu.push(...[
            {
                label: 'New &Tab',
                id: 'newConnect',
                click: (item, mWindow, keyboard) => {
                    if (!window) return;
                    //allow for some hidden ways to force open main/dev if needed with out the complex menus
                    if (!keyboard.triggeredByAccelerator) {
                        if (keyboard.ctrlKey)
                            newConnection(window, { port: 1035 });
                        else if (keyboard.shiftKey)
                            newConnection(window, { port: 1030 });
                        else
                            newConnection(window);
                    }
                    else
                        newConnection(window);
                }
            }, { type: 'separator' }]);
    contextMenu.push(...[
        {
            label: '&Show window...', click: () => {
                if (!window) return;
                restoreWindowState(window, stateMap.get(window), 2);
            }
        },
        {
            label: 'H&ide window...', click: () => {
                if (!window) return;
                if (getSetting('hideOnMinimize'))
                    window.hide();
                else
                    window.minimize();
            }
        },
        { type: 'separator' }
    ]);
    if (getSetting('trayMenu') === TrayMenu.compact)
        return contextMenu;
    const cl = windows[windowId].clients.length;
    if (cl === 1) {
        contextMenu.push(...getTrayClientContext(windows[windowId].window));
    }
    else {
        contextMenu.push({
            label: 'Clients',
            submenu: []
        });
        const clientMenu = contextMenu[contextMenu.length - 1];
        for (let c = 0; c < cl; c++) {
            const clientId = windows[windowId].clients[c];
            const state = getClientConnectionState(clientId);
            const item = {
                label: state.name || state.state,
                id: clientId,
                icon: nativeImage.createFromPath(getOverlayIcon(clients[windows[windowId].clients[c]].overlay)).resize({ height: 16, quality: 'good' }),
                click: (item) => {
                    if (!window) return;
                    restoreWindowState(window, stateMap.get(window), 2);
                    window.webContents.send('switch-client', parseInt(item.id, 10));
                }
            };
            clientMenu.submenu.push(item);
        }
    }
    return contextMenu;
}

function getOverlayIcon(overlay) {
    switch (overlay) {
        case 1:
            return path.join(__dirname, '../assets/icons/png/connected.png');
        case 2:
            return path.join(__dirname, '../assets/icons/png/connectednonactive.png');
        case 3:
            return path.join(__dirname, '../assets/icons/png/code.disconnected.png');
        case 4:
            return path.join(__dirname, '../assets/icons/png/code.connected.png');
        case 5:
            return path.join(__dirname, '../assets/icons/png/code.connectednonactive.png');
        case 6:
            return path.join(__dirname, '../assets/icons/png/disconnected2.png');
        case 7:
            return path.join(__dirname, '../assets/icons/png/connected2.png');
        case 8:
            return path.join(__dirname, '../assets/icons/png/connectednonactive2.png');
    }
    return path.join(__dirname, '../assets/icons/png/disconnected.png');
}

//debounce the context updater to improve performance
let _trayContextTimer;
function updateTrayContext() {
    if (_trayContextTimer || getSetting('trayMenu') === TrayMenu.simple) return;
    _trayContextTimer = setTimeout(_updateTrayContext, 250);
}

async function _updateTrayContext() {
    if (!tray) return;
    const active = getActiveWindow();
    const activeID = active ? getWindowId(active.window) : 0;
    let contextMenu = [];

    if (getSetting('trayMenu') === TrayMenu.simple) {
        contextMenu.push(...[
            {
                label: 'New &Tab',
                id: 'newConnect',
                click: (item, mWindow, keyboard) => {
                    if (!active) return;
                    //allow for some hidden ways to force open main/dev if needed with out the complex menus
                    if (!keyboard.triggeredByAccelerator) {
                        if (keyboard.ctrlKey)
                            newConnection(active.window, { port: 1035 });
                        else if (keyboard.shiftKey)
                            newConnection(active.window, { port: 1030 });
                        else
                            newConnection(active.window);
                    }
                    else
                        newConnection(active.window);
                }
            },
            {
                label: 'New &Window',
                id: '',
                click: (item, mWindow, keyboard) => {
                    //allow for some hidden ways to force open main/dev if needed with out the complex menus
                    if (!active) return;
                    if (!keyboard.triggeredByAccelerator) {
                        if (keyboard.ctrlKey)
                            newClientWindow(active.window, { port: 1035 });
                        else if (keyboard.shiftKey)
                            newClientWindow(active.window, { port: 1030 });
                        else
                            newClientWindow(active.window);
                    }
                    else
                        newClientWindow(active.window);
                }
            },
            {
                type: 'separator'
            },
            {
                label: '&Show window...', click: () => {
                    if (!active) return;
                    restoreWindowState(active.window, stateMap.get(active.window), 2);
                }
            },
            {
                label: 'H&ide window...', click: () => {
                    if (!active) return;
                    if (getSetting('hideOnMinimize'))
                        active.window.hide();
                    else
                        active.window.minimize();
                }
            }]);
        if (Object.keys(windows).length > 1)
            contextMenu.push(...[
                { type: 'separator' },
                {
                    label: '&Show all windows', click: showAllWindows
                },
                {
                    label: 'H&ide all windows', click: hideAllWindows
                },
            ]);
        contextMenu.push(...[
            { type: 'separator' },
            {
                label: '&Windows...',
                click: (item, mWindow) => {
                    if (!active) return;
                    openWindows(active.window);
                }
            },
            { type: 'separator' },
            {
                label: 'Ch&aracters...',
                click: (item, mWindow) => {
                    executeScriptClient('openWindow("characters")', active.window);
                }
            },
            { type: 'separator' },
            {
                label: 'E&xit',
                //role: 'quit'
                click: quitApp
            }
        ]);
        tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
        _trayContextTimer = 0;
        return;
    }

    //1 window so standard hide/show
    if (activeID && Object.keys(windows).length === 1) {
        contextMenu.push(...[
            {
                label: 'New &Tab',
                id: 'newConnect',
                click: (item, mWindow, keyboard) => {
                    if (!active) return;
                    //allow for some hidden ways to force open main/dev if needed with out the complex menus
                    if (!keyboard.triggeredByAccelerator) {
                        if (keyboard.ctrlKey)
                            newConnection(active.window, { port: 1035 });
                        else if (keyboard.shiftKey)
                            newConnection(active.window, { port: 1030 });
                        else
                            newConnection(active.window);
                    }
                    else
                        newConnection(active.window);
                }
            },
            {
                label: 'New &Window',
                id: '',
                click: (item, mWindow, keyboard) => {
                    //allow for some hidden ways to force open main/dev if needed with out the complex menus
                    if (!active) return;
                    if (!keyboard.triggeredByAccelerator) {
                        if (keyboard.ctrlKey)
                            newClientWindow(active.window, { port: 1035 });
                        else if (keyboard.shiftKey)
                            newClientWindow(active.window, { port: 1030 });
                        else
                            newClientWindow(active.window);
                    }
                    else
                        newClientWindow(active.window);
                }
            },
            {
                type: 'separator'
            }
        ]);
        if (windows[activeID].clients.length === 1) {
            contextMenu.push(...[
                {
                    label: '&Show window...', click: () => {
                        if (!active) return;
                        restoreWindowState(active.window, stateMap.get(active.window), 2);
                    }
                },
                {
                    label: 'H&ide window...', click: () => {
                        if (!active) return;
                        if (getSetting('hideOnMinimize'))
                            active.window.hide();
                        else
                            active.window.minimize();
                    }
                },
                { type: 'separator' },
            ]);
            contextMenu.push(...getTrayClientContext(active.window));
        }
        else {
            contextMenu.push(...getTrayWindowContext(active.window, activeID, true));
            contextMenu.push({ type: 'separator' });
        }
    }
    else {
        contextMenu.push(...[
            {
                label: 'New &Window',
                id: '',
                click: (item, mWindow, keyboard) => {
                    //allow for some hidden ways to force open main/dev if needed with out the complex menus
                    if (!active) return;
                    if (!keyboard.triggeredByAccelerator) {
                        if (keyboard.ctrlKey)
                            newClientWindow(active.window, { port: 1035 });
                        else if (keyboard.shiftKey)
                            newClientWindow(active.window, { port: 1030 });
                        else
                            newClientWindow(active.window);
                    }
                    else
                        newClientWindow(active.window);
                }
            },
            { type: 'separator' },
            {
                label: '&Show all windows', click: showAllWindows
            },
            {
                label: 'H&ide all windows', click: hideAllWindows
            },
            { type: 'separator' }
        ]);
        const item = {
            label: 'Windows',
            submenu: []
        };
        for (window in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, window) || !windows[window] || windows[window].window.isDestroyed() || windows[window].clients.length === 0)
                continue;
            item.submenu.push({
                label: windows[window].window.getTitle(),
                icon: nativeImage.createFromPath(getOverlayIcon(windows[window].clients.length > 1 ? (windows[window].overlay + 6) : clients[windows[window].clients[0]].overlay)).resize({ height: 16, quality: 'good' }),
                submenu: getTrayWindowContext(windows[window].window, getWindowId(windows[window].window))
            });
        }
        contextMenu.push(item);
        contextMenu.push({ type: 'separator' });
    }
    contextMenu.push(
        {
            label: '&Windows...',
            click: (item, mWindow) => {
                if (!active) return;
                openWindows(active.window);
            }
        },
        { type: 'separator' },
        {
            label: 'E&xit',
            //role: 'quit'
            click: quitApp
        }
    );
    tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
    _trayContextTimer = 0;
}

async function updateTray() {
    if (!tray) return;
    let overlay = 0;
    const cState = {
        connected: 0,
        total: 0,
    }
    for (clientId in clients) {
        if (!Object.prototype.hasOwnProperty.call(clients, clientId))
            continue;
        cState.total++;
        switch (clients[clientId].overlay) {
            case 4:
            case 1:
                if (overlay < 1)
                    overlay = 1;
                cState.connected++;
                break;
            case 5:
            case 2:
                if (_focused) {
                    if (overlay < 1)
                        overlay = 1;
                }
                else if (overlay < 2)
                    overlay = 2;
                cState.connected++;
                break;
        }
    }
    let title = '';
    if (cState.total === 1)
        title = cState.connected ? 'Connected' : 'Disconnected';
    else {
        if (cState.connected)
            title = `${cState.connected} Connected`;
        if (cState.total !== cState.connected)
            title += `${title ? ', ' : ''}${cState.total - cState.connected} Disconnected`;
    }
    title += ' - jiMUD';
    switch (overlay) {
        case 4:
        case 1:
            tray.setImage(getOverlayIcon(7));
            break;
        case 5:
        case 2:
            tray.setImage(getOverlayIcon(8));
            break;
        default:
            tray.setImage(getOverlayIcon(6));
            break;
    }
    tray.setTitle(title);
    tray.setToolTip(title);
    updateTrayContext();
}
//Windows only, pretty much the same as the notification system
/*
ipcMain.on('tray-display-balloon', (event, options) => {
    if (!tray || !options) return;
    if (!options.icon) options.icon = path.join(__dirname, '../assets/icons/png/64x64.png');
    tray.displayBalloon(options);
})

ipcMain.on('tray-remove-balloon', event => {
    if (!tray) return;
    tray.removeBalloon();
})
*/
//#endregion

//#region Debug
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

function initializeIPCDebug(webContents, prefix) {
    if (!global.debug) return;
    if (prefix)
        prefix += ', ';
    else
        prefix = '';
    webContents.on('ipc-message', (event, channel, ...args) => {
        if (channel.startsWith('REMOTE_')) return;
        console.log(`${prefix}ipc-message: ${channel}`);
        console.log(args);
    });
    webContents.on('ipc-message-sync', (event, channel, ...args) => {
        if (channel.startsWith('REMOTE_')) return;
        console.log(`${prefix}ipc-message-sync: ${channel}`);
        console.log(args);
    });
}
//#endregion
//Wrapper for loading contents as some times it may already be loaded and the event may not fire
function onContentsLoaded(contents) {
    return new Promise((resolve, reject) => {
        if (!contents || contents.isDestroyed()) reject();
        //if loading event probably not fired
        if (contents.isLoading()) {
            contents.once('dom-ready', () => {
                resolve();
            });
        }
        else
            resolve();
    })
}

/**
 * Prompt dialog
 * 
 * Adds a dialog to simulate window.prompt dialog
 */
ipcMain.on('prompt', (event, options) => {
    var promptResponse;
    var promptResponseEvent = (event, arg) => promptResponse = (arg === '' ? null : arg)
    options.val = options.val || '';
    let height = 120;
    if ((options.prompt && options.prompt.length) || (options.title && options.title.length))
        height = 148;
    var promptWindow = createDialog({
        show: true,
        parent: windowFromContents(event.sender),
        url: path.join(__dirname, 'prompt.html'),
        title: options.title || options.prompt,
        bounds: { width: options.width || 350, height: options.height || height },
        modal: true,
        backgroundColor: options.background || '#fff',
        frame: false
    });
    promptWindow.on('closed', function () {
        event.returnValue = promptResponse;
        promptWindow = null;
        ipcMain.removeListener('prompt-response', promptResponseEvent);
    });
    promptWindow.once('ready-to-show', () => {
        executeScript(`setValue('${options.val}',${options.mask && typeof options.mask === 'string' ? ('\'' + options.mask + '\'') : options.mask});
        setPrompt(${(options.prompt || options.title) ? '\'' + (options.prompt || options.title) + '\'' : 0});
        document.title = '${options.title || options.prompt || ''}';`, promptWindow);
    });
    ipcMain.on('prompt-response', promptResponseEvent);
});

/**
 * File exist dialog
 * 
 * Adds a dialog to ask how to handle file overwrite with the action and always option or null
 */
ipcMain.on('file-exist-dialog', (event, source, target, options) => {
    var dialogResponse;
    var dialogResponseEvent = (event, arg) => dialogResponse = (arg === '' ? null : arg)
    var dialogWindow = createDialog({
        show: true,
        parent: windowFromContents(event.sender),
        url: path.join(__dirname, 'file.exists.html'),
        title: 'File exist...',
        bounds: { width: 600, height: 393 },
        modal: true,
        backgroundColor: '#fff',
        frame: false
    });
    dialogWindow.on('closed', function () {
        event.returnValue = dialogResponse;
        dialogWindow = null;
        ipcMain.removeListener('file-exist-response', dialogResponseEvent);
    });
    dialogWindow.once('ready-to-show', () => {
        executeScript(`setData(${JSON.stringify(source)}, ${JSON.stringify(target)}, ${JSON.stringify(options)});`, dialogWindow);
    });
    ipcMain.on('file-exist-response', dialogResponseEvent);
});