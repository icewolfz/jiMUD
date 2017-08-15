//cSpell:words submenu, pasteandmatchstyle, statusvisible, lagmeter, taskbar, 
//cSpell:ignore prefs, partyhealth, combathealth
const { app, BrowserWindow, shell } = require('electron');
const { Tray, dialog, Menu } = require('electron');
const ipcMain = require('electron').ipcMain;
const path = require('path');
const fs = require('fs');
const url = require('url');
const settings = require('./js/settings');
const { TrayClick } = require('./js/types');

//require('electron-local-crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
let set;
let tray = null;
let overlay = 0;

app.setAppUserModelId('jiMUD');

global.settingsFile = parseTemplate(path.join('{data}', 'settings.json'));
global.title = '';
global.debug = false;
global.clients = {};

let state = { x: 0, y: 0, width: 800, height: 600 };

process.on('uncaughtException', (err) => {
  logError(err);
});

const selectionMenu = Menu.buildFromTemplate([
  { role: 'copy' },
  { type: 'separator' },
  { role: 'selectall' },
]);

const inputMenu = Menu.buildFromTemplate([
  { role: 'undo' },
  { role: 'redo' },
  { type: 'separator' },
  { role: 'cut' },
  { role: 'copy' },
  { role: 'paste' },
  { type: 'separator' },
  { role: 'selectall' },
]);

function addInputContext(window) {
  window.webContents.on('context-menu', (e, props) => {
    const { selectionText, isEditable } = props;
    if (isEditable) {
      inputMenu.popup(window);
    } else if (selectionText && selectionText.trim() !== '') {
      selectionMenu.popup(window);
    }
  });
}

function createTray() {
  if (!set)
    set = settings.Settings.load(global.settingsFile);
  if (!set.showTrayIcon)
    return;
  tray = new Tray(path.join(__dirname, '../assets/icons/png/disconnected2.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '&Show window...', click: () => {
        let s = getWindowState();
        if (s.maximized)
          win.maximize();
        else
          win.show();
        if (s.isFullScreen)
          win.setFullScreen(s.fullscreen);
        win.focus();
      }
    },
    {
      label: 'H&ide window...', click: () => {
        if (set.hideOnMinimize)
          win.hide();
        else
          win.minimize();
      }
    },
    { type: 'separator' },
    {
      label: "Ch&aracters...",
      id: "characters",
      click: () => {
        let s = getWindowState();
        if (s.maximized)
          win.maximize();
        else
          win.show();
        if (s.isFullScreen)
          win.setFullScreen(s.fullscreen);
        win.focus();
        win.webContents.executeJavaScript('showCharacters()');
      }
    },
    {
      label: '&Manage profiles...',
      click: () => {
        win.webContents.executeJavaScript('showProfiles()');
      }
    },
    { type: 'separator' },
    {
      label: '&Preferences...',
      click: () => {
        win.webContents.executeJavaScript('showPrefs()');
      }
    },
    { type: 'separator' },
    {
      label: '&Who is on?',
      click: () => {
        shell.openExternal("http://www.shadowmud.com/who.php", '_blank');
      }
    },
    { type: 'separator' },
    {
      label: '&Help',
      role: 'help',
      submenu: [
        {
          label: '&ShadowMUD',
          click: () => {
            shell.openExternal("http://www.shadowmud.com/help.php", '_blank');
          }
        },
        {
          label: '&jiMUD',
          click: () => {
            shell.openExternal("https://github.com/icewolfz/jiMUD/tree/master/docs", '_blank');
          }
        },
        { type: 'separator' },
        {
          label: '&About...',
          click: () => {
            var b = win.getBounds();

            let about = new BrowserWindow({
              parent: win,
              modal: true,
              x: Math.floor(b.x + b.width / 2 - 225),
              y: Math.floor(b.y + b.height / 2 - 200),
              width: 450,
              height: 400,
              movable: false,
              minimizable: false,
              maximizable: false,
              skipTaskbar: true,
              resizable: false,
              title: 'About jiMUD',
              icon: path.join(__dirname, '../assets/icons/png/64x64.png')
            });
            about.webContents.on('crashed', (event, killed) => {
              logError(`About crashed, killed: ${killed}\n`, true);
            });

            about.setMenu(null);
            about.on('closed', () => {
              about = null;
            });

            // and load the index.html of the app.
            about.loadURL(url.format({
              pathname: path.join(__dirname, 'about.html'),
              protocol: 'file:',
              slashes: true
            }));

            about.once('ready-to-show', () => {
              about.show();
            });
          }
        }
      ]
    },
    { type: 'separator' },
    { label: 'E&xit', role: 'quit' }
  ]);
  updateTray();
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    let s = getWindowState();
    switch (set.trayClick) {
      case TrayClick.show:
        if (s.maximized)
          win.maximize();
        else
          win.show();
        if (s.isFullScreen)
          win.setFullScreen(s.fullscreen);
        win.focus();
        break;
      case TrayClick.toggle:
        if (win.isVisible()) {
          if (set.hideOnMinimize)
            win.hide();
          else
            win.minimize();
        }
        else {
          if (s.maximized)
            win.maximize();
          else
            win.show();
          if (s.isFullScreen)
            win.setFullScreen(s.fullscreen);
          win.focus();
        }
        break;
      case TrayClick.hide:
        if (set.hideOnMinimize)
          win.hide();
        else
          win.minimize();
        break;
      case TrayClick.menu:
        tray.popUpContextMenu();
        break;
    }
  });

  tray.on('double-click', () => {
    let s = getWindowState();
    switch (set.trayClick) {
      case TrayClick.show:
        if (s.maximized)
          win.maximize();
        else
          win.show();
        if (s.isFullScreen)
          win.setFullScreen(s.fullscreen);
        win.focus();
        break;
      case TrayClick.toggle:
        if (win.isVisible()) {
          if (set.hideOnMinimize)
            win.hide();
          else
            win.minimize();
        }
        else {
          if (s.maximized)
            win.maximize();
          else
            win.show();
          if (s.isFullScreen)
            win.setFullScreen(s.fullscreen);
          win.focus();
        }
        break;
      case TrayClick.hide:
        if (set.hideOnMinimize)
          win.hide();
        else
          win.minimize();
        break;
      case TrayClick.menu:
        tray.popUpContextMenu();
        break;
    }
  });
}

function updateTray() {
  if (!tray) return;
  let t = '';
  let d = '';
  let title = global.title;
  if (!title || title.length === 0)
    title = global.character;
  if (set && set.dev)
    d = " to Development";
  switch (overlay) {
    case 1:
      tray.setImage(path.join(__dirname, '../assets/icons/png/connected2.png'));
      if (title && title.length > 0)
        t = `Connected${d} as ${title} - jiMUD`;
      else
        t = `Connected${d} - jiMUD`;
      break;
    case 2:
      if (title && title.length > 0)
        t = `Connected${d} as ${title} - jiMUD`;
      else
        t = `Connected${d} - jiMUD`;
      tray.setImage(path.join(__dirname, '../assets/icons/png/connectednonactive2.png'));
      break;
    default:
      if (title && title.length > 0)
        t = `Disconnected${d} as ${title} - jiMUD`;
      else
        t = `Disconnected${d} - jiMUD`;
      tray.setImage(path.join(__dirname, '../assets/icons/png/disconnected2.png'));
      break;
  }

  tray.setTitle(t);
  tray.setToolTip(t);
}

function createWindow() {
  if (!set)
    set = settings.Settings.load(global.settingsFile);
  var s = loadWindowState();
  // Create the browser window.
  win = new BrowserWindow({
    title: 'jiMUD',
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: '#000',
    show: false,
    icon: path.join(__dirname, '../assets/icons/png/64x64.png'),
    webPreferences: {
      nodeIntegrationInWorker: true
    }
  });
  win.setMenu(null);
  if (s.fullscreen)
    win.setFullScreen(s.fullscreen);
  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Open the DevTools.
  //if (s.devTools)
  win.webContents.openDevTools();

  win.on('resize', () => {
    if (!win.isMaximized() && !win.isFullScreen())
      trackWindowState();
  });

  win.on('move', () => {
    if (!win.isMaximized() && !win.isFullScreen())
      trackWindowState();
  });

  win.on('maximize', () => {
    trackWindowState();
    state.maximized = true;
  });

  win.on('unmaximize', () => {
    trackWindowState();
    state.maximized = false;
  });

  win.on('unresponsive', () => {
    dialog.showMessageBox({
      type: 'info',
      message: 'Unresponsive',
      buttons: ['Reopen', 'Keep waiting', 'Close']
    }, result => {
      if (!win)
        return;
      if (result === 0) {
        win.reload();
        logError(`Client unresponsive, reload.\n`, true);
      }
      else if (result === 2) {
        set = settings.Settings.load(global.settingsFile);
        set.windows['main'] = getWindowState();
        closeWindows();
        logError(`Client unresponsive, closed.\n`, true);
        set.save(global.settingsFile);
        win.destroy();
        win = null;
      }
      else
        logError(`Client unresponsive, waiting.\n`, true);
    });
  });

  win.on('minimize', () => {
    if (set.hideOnMinimize)
      win.hide();
  });

  win.webContents.on('crashed', (event, killed) => {
    logError(`Client crashed, killed: ${killed}\n`, true);
  });

  win.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
    event.preventDefault();
    if (frameName === 'modal') {
      // open window as modal
      Object.assign(options, {
        modal: true,
        parent: win,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        resizable: false
      });

      var b = win.getBounds();
      options.x = Math.floor(b.x + b.width / 2 - options.width / 2);
      options.y = Math.floor(b.y + b.height / 2 - options.height / 2);
    }
    options.show = false;
    const w = new BrowserWindow(options);
    if (global.debug)
      w.webContents.openDevTools();
    w.setMenu(null);
    w.once('ready-to-show', () => {
      addInputContext(w);
      w.show();
    });
    w.webContents.on('crashed', (event, killed) => {
      logError(`${url} crashed, killed: ${killed}\n`, true);
    });

    w.on('closed', () => {
      if (win && win.webContents) {
        win.webContents.executeJavaScript(`childClosed('${url}', '${frameName}');`);
      }
    });

    w.loadURL(url);
    event.newGuest = w;
  });

  // Emitted when the window is closed.
  win.on('closed', () => {
    win = null;
  });

  win.once('ready-to-show', () => {
    addInputContext(win);
    if (isFileSync(path.join(app.getPath('userData'), "monsters.css"))) {
      fs.readFile(path.join(app.getPath('userData'), "monsters.css"), 'utf8', (err, data) => {
        win.webContents.insertCSS(parseTemplate(data));
      });
    }
    if (isFileSync(path.join(app.getPath('userData'), "user.css"))) {
      fs.readFile(path.join(app.getPath('userData'), "user.css"), 'utf8', (err, data) => {
        win.webContents.insertCSS(parseTemplate(data));
      });
    }
    if (isFileSync(path.join(app.getPath('userData'), "user.js"))) {
      fs.readFile(path.join(app.getPath('userData'), "user.js"), 'utf8', (err, data) => {
        win.webContents.executeJavaScript(data);
      });
    }
    if (s.maximized)
      win.maximize();
    else
      win.show();
  });

  win.on('close', (e) => {
    set = settings.Settings.load(global.settingsFile);
    set.windows['main'] = getWindowState();
    closeWindows();
    set.save(global.settingsFile);
  });
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  process.argv.forEach((val, index) => {
    switch (val) {
      case "-h":
      case "--help":
      case "-?":
      case "/?":
        console.log('Usage: jiMUD [options] [telnet://[user[:password]@]server[:port]]\n');
        console.log('Options:');
        console.log('  -h, --help                    Print console help');
        console.log('  -d, --debug                   Enable dev tools for all windows');
        console.log('  -s=[file], --setting=[file]   Override default setting file');
        console.log('  -mf=[file], --map=[file]      Override default map file');
        console.log('  -c=[list], --character=[list] A comma delimited list of characters to load/create');
        console.log('  -pf=[list], --profiles[list]  A comma delimited list of profiles to use instead of selected');
        console.log('  -v, --version                 Print current version');
        app.quit();
        return;
      case "--version":
      case "-v":
      case "--v":
        console.log(`jiMUD v${require("../package.json").version}`);
        app.quit();
        break;
      case "-debug":
      case "--debug":
      case "-d":
      case "--d":
        global.debug = true;
        break;
    }
  });
  createTray();
  createWindow();
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
  if (win == null) {
    createWindow();
  }
});

ipcMain.on('reload-options', (event, client, settingsFile) => {
  if (win && win.webContents)
    win.webContents.send('reload-options', client, settingsFile);
  if (settingsFile === global.settingsFile) {
    set = settings.Settings.load(global.settingsFile);
    if (set.showTrayIcon && !tray)
      createTray();
    else if (!set.showTrayIcon && tray) {
      tray.destroy();
      tray = null;
    }
  }
});

ipcMain.on('get-setting', (event, setting) => {
  if (!set)
    set = settings.Settings.load(global.settingsFile);
  event.returnValue = set[setting];
});

ipcMain.on('set-title', (event, title) => {
  global.title = title;
  updateTray();
});

ipcMain.on('closed', (event, client) => {
});

ipcMain.on('connected', (event, client) => {
});

ipcMain.on('set-color', (event, type, color, client) => {
  win.webContents.send('reload-options', type, color, client);
});

ipcMain.on('send-background', (event, command, client) => {
  if (win && win.webContents)
    win.webContents.send('send-background', command, client);
});

ipcMain.on('send-command', (event, command, client) => {
  if (win && win.webContents)
    win.webContents.send('send-command', command, client);
});

ipcMain.on('send-gmcp', (event, data, client) => {
  if (win && win.webContents)
    win.webContents.send('send-gmcp', data, client);
});

ipcMain.on('send-raw', (event, raw, client) => {
  if (win && win.webContents)
    win.webContents.send('send-raw', raw, client);
});

ipcMain.on('send', (event, raw, echo, client) => {
  if (win && win.webContents)
    win.webContents.send('send', raw, echo, client);
});

ipcMain.on('log', (event, raw) => {
  console.log(raw);
});

ipcMain.on('debug', (event, msg, client) => {
  if (win && win.webContents)
    win.webContents.send('debug', msg, client);
});

ipcMain.on('error', (event, err, client) => {
  if (win && win.webContents)
    win.webContents.send('error', err, client);
});

ipcMain.on('reload-profiles', (event) => {
  if (win && win.webContents)
    win.webContents.send('reload-profiles');
});

ipcMain.on('setting-changed', (event, data, client) => {
  if (win && win.webContents)
    win.webContents.send('setting-changed', data, client);
});

ipcMain.on('GMCP-received', (event, data, client) => {

});

ipcMain.on('set-overlay', (event, args) => {
  overlay = args;
  switch (args) {
    case 1:
      win.setOverlayIcon(path.join(__dirname, '../assets/icons/png/connected.png'), 'Connected');
      break;
    case 2:
      win.setOverlayIcon(path.join(__dirname, '../assets/icons/png/connectednonactive.png'), 'Received data');
      break;
    default:
      win.setOverlayIcon(path.join(__dirname, '../assets/icons/png/disconnected.png'), 'Disconnected');
      break;
  }
  updateTray();
});

ipcMain.on('set-progress', (event, args) => {
  if (win)
    win.setProgressBar(args.value, args.options);
});

ipcMain.on('set-progress-window', (event, window, args, client) => {
  if (win && win.webContents)
    win.webContents.send('setting-changed', window, args, client);
});

ipcMain.on('show-window', (event, window, args, state, client) => {
  if (!global.clients || !global.clients[client]) return;
  if (window === "color")
    showColor(args, client);
  else if (global.clients[client][window] && global.clients[client][window].window)
    showWindow(window, global.clients[client][window], client);
  else
    createNewWindow(window, args, state, client);
});

ipcMain.on('create-window', (event, window, args, state, client) => {
  createNewWindow(window, args, state, client);
});

ipcMain.on('flush', (event, client) => {
});

ipcMain.on('flush-end', (event, client) => {
  if (win && win.webContents)
    win.webContents.send('flush-end', client);
});

ipcMain.on('profile-item-added', (event, type, profile, item) => {
  if (win && win.webContents)
    win.webContents.send('profile-item-added', type, profile, item);
});

ipcMain.on('profile-item-removed', (event, type, profile, idx) => {
  if (win && win.webContents)
    win.webContents.send('profile-item-added', type, profile, idx);
});

ipcMain.on('ondragstart', (event, files, icon) => {
  if (!files || files.length === 0) return;
  if (typeof (files) === "string")
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

ipcMain.on('add', (event, id) => {
  if (!global.clients[id])
    global.clients[id] = {};
});

ipcMain.on('remove', (event, id) => {
  if (!global.clients[id])
    return;
  delete global.clients[id];
});

ipcMain.on('get-window', (events, name, client) => {
  if (!global.clients || !global.clients[client])
    events.returnValue = null;
  events.returnValue = global.clients[client][name].window;
  if (win)
    win.webContents.send('get-window', events.returnValue);
});

function getWindowState() {
  var bounds = state;
  if (!win)
    return bounds;
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreen: win.isFullScreen(),
    maximized: win.isMaximized(),
    devTools: win.webContents.isDevToolsOpened()
  };
}

function loadWindowState() {
  set = settings.Settings.load(global.settingsFile);
  if (!set.windows || !set.windows['main'])
    return {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    };
  state = {
    x: set.windows['main'].x,
    y: set.windows['main'].y,
    width: set.windows['main'].width,
    height: set.windows['main'].height,
  };
  return set.windows['main'];
}

function trackWindowState() {
  if (!win) return state;
  var bounds = win.getBounds();
  if (!state)
    state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    };
  else {
    state.x = bounds.x;
    state.y = bounds.y;
    state.width = bounds.width;
    state.height = bounds.height;
  }
}

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
  str = str.replace(/{characters}/g, path.join(app.getPath('userData'), "characters"));
  str = str.replace(/{themes}/g, path.join(__dirname, "..", "build", "themes"));
  str = str.replace(/{assets}/g, path.join(__dirname, "..", "assets"));

  if (data) {
    var keys = Object.keys(data);
    for (var key in keys) {
      var regex = new RegExp("{}" + key + "}", "g");
      str = str.replace(regex, data[key]);
    }
  }
  return str;
}

function createNewWindow(name, options, state, client) {
  if (!global.clients || !global.clients[client]) return;
  if (global.clients[client][name] && global.clients[client][name].window)
    return;
  if (!options) options = {};
  global.clients[client][name] = options;
  global.clients[client][name].window = new BrowserWindow({
    parent: global.clients[client][name].alwaysOnTopClient ? win : null,
    title: options.title || name,
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    backgroundColor: options.background || '#000',
    show: false,
    skipTaskbar: (global.clients[client][name].alwaysOnTopClient || global.clients[client][name].alwaysOnTop) ? true : false,
    icon: path.join(__dirname, '../assets/icons/png/' + (options.icon || name) + '.png')
  });

  global.clients[client][name].window.webContents.on('crashed', (event, killed) => {
    logError(`${name} crashed, killed: ${killed}\n`, true);
  });

  if (state.fullscreen)
    global.clients[client][name].window.setFullScreen(state.fullscreen);

  global.clients[client][name].window.setMenu(options.menu || null);

  global.clients[client][name].window.loadURL(url.format({
    pathname: path.join(__dirname, (global.clients[client][name].file || (name + '.html'))),
    protocol: 'file:',
    slashes: true
  }));

  global.clients[client][name].window.on('closed', () => {
    global.clients[client][name].window = null;
    global.clients[client][name].ready = false;
  });

  global.clients[client][name].window.on('resize', () => {
    if (!global.clients[client][name].window.isMaximized() && !global.clients[client][name].window.isFullScreen())
      win.webContents.send('track-window-state', name, client);
  });

  global.clients[client][name].window.on('move', () => {
    win.webContents.send('track-window-state', name, client);
  });

  global.clients[client][name].window.on('maximize', () => {
    win.webContents.send('track-window-state', name, client);
  });

  global.clients[client][name].window.on('maximize', () => {
    win.webContents.send('track-window-state', name, client, { maximized: true });
  });

  global.clients[client][name].window.on('unmaximize', () => {
    win.webContents.send('track-window-state', name, client, { maximized: false });
  });

  global.clients[client][name].window.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
    event.preventDefault();
    if (frameName === 'modal') {
      // open window as modal
      Object.assign(options, {
        modal: true,
        parent: global.clients[client][name].window,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        resizable: false
      });

      var b = global.clients[client][name].window.getBounds();
      options.x = Math.floor(b.x + b.width / 2 - options.width / 2);
      options.y = Math.floor(b.y + b.height / 2 - options.height / 2);
    }
    options.show = false;
    const w = new BrowserWindow(options);
    if (global.debug)
      w.webContents.openDevTools();
    w.setMenu(null);
    w.once('ready-to-show', () => {
      addInputContext(w);
      w.show();
    });
    w.webContents.on('crashed', (event, killed) => {
      logError(`${url} crashed, killed: ${killed}\n`, true);
    });

    w.on('close', () => {
      if (w.getParentWindow()) {
        w.getParentWindow().webContents.executeJavaScript(`childClosed('${url}', '${frameName}');`);
      }
    });

    w.loadURL(url);
    event.newGuest = w;
  });

  if (global.debug)
    global.clients[client][name].window.webContents.openDevTools();

  global.clients[client][name].window.once('ready-to-show', () => {
    if (!options.noInput)
      addInputContext(global.clients[client][name].window);
    if (options.show) {
      if (state.maximized)
        global.clients[client][name].window.maximize();
      else
        global.clients[client][name].window.show();
    }
    else
      global.clients[client][name].max = state.maximized;
    global.clients[client][name].ready = true;
  });

  global.clients[client][name].window.on('close', (e) => {
    if (win && win.webContents) {
      win.webContents.executeJavaScript(`childClosed('${path.join(__dirname, (global.clients[client][name].file || (name + '.html'))).replace(/\\/g, '\\\\')}', '${name}');`);
    }
    global.clients[client][name].window.webContents.executeJavaScript('closing();');
    global.clients[client][name].window.webContents.executeJavaScript('closed();');
    global.clients[client][name].show = false;
    win.webContents.send('save-window', name, copyWindowOptions(global.clients[client][name]), getClientWindowState(global.clients[client][name].window), client);
    if (global.clients[client][name].persistent) {
      e.preventDefault();
      global.clients[client][name].window.hide();
    }
  });
}

function showWindow(name, options, state, client) {
  win.webContents.send('update-window-options', name, { show: true }, client);
  if (!options) options = { show: true };
  if (global.clients[client][name] && global.clients[client][name].window) {
    if (global.clients[client][name].max)
      global.clients[client][name].window.maximize();
    else
      global.clients[client][name].window.show();
    global.clients[client][name].max = false;
  }
  else
    createNewWindow(name, options, state, client);
}

function showColor(args, client) {
  let cp = new BrowserWindow({
    parent: args.window || win,
    modal: true,
    width: 326,
    height: 296,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    resizable: false,
    title: 'Pick color',
    icon: path.join(__dirname, '../assets/icons/png/color.png'),
    show: false,
  });
  cp.webContents.on('crashed', (event, killed) => {
    logError(`Colorpicker crashed, killed: ${killed}\n`, true);
  });

  cp.setMenu(null);
  cp.on('closed', () => {
    cp = null;
  });
  cp.loadURL(url.format({
    pathname: path.join(__dirname, 'colorpicker.html'),
    protocol: 'file:',
    slashes: true
  }));

  if (global.debug)
    cp.webContents.openDevTools();

  cp.once('ready-to-show', () => {
    cp.show();
    cp.webContents.executeJavaScript('setType("' + (args.type || 'forecolor') + '");setColor("' + (args.color || '') + '");');
  });
}

function logError(err, skipClient) {
  var msg = '';
  if (global.debug)
    console.error(err);
  if (err.stack)
    msg = err.stack;
  else if (err instanceof TypeError)
    msg = err.name + " - " + err.message;
  else if (err instanceof Error)
    msg = err.name + " - " + err.message;
  else if (err.message)
    msg = err.message;
  else
    msg = err;


  if (win && win.webContents && !skipClient)
    win.webContents.send('error', msg);
  else if (set && set.logErrors) {
    fs.writeFileSync(path.join(app.getPath('userData'), "jimud.error.log"), new Date().toLocaleString() + '\n', { flag: 'a' });
    fs.writeFileSync(path.join(app.getPath('userData'), "jimud.error.log"), msg + '\n', { flag: 'a' });
  }
}

function closeWindows() {
  for (var client in global.clients)
    for (var name in global.clients[client]) {
      if (!global.clients[client].hasOwnProperty(name) || !global.clients[client][name].window)
        continue;
      global.clients[client][name].window.webContents.executeJavaScript('closing();');
      global.clients[client][name].window.webContents.executeJavaScript('closed();');
      win.webContents.send('save-window', name, copyWindowOptions(global.clients[client][name]), getClientWindowState(global.clients[client][name].window), client);
      global.clients[client][name].window.destroy();
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

function copyWindowOptions(window) {
  if (!window) return {};
  var ops = {};
  for (var op in window) {
    if (!window.hasOwnProperty(op) || op === "window")
      continue;
    ops[op] = window[op];
  }
  return ops;
}

function getClientWindowState(window) {
  if (!window)
    return 0;
  return {
    fullscreen: window.isFullScreen(),
    maximized: window.isMaximized(),
    devTools: window.webContents.isDevToolsOpened()
  };
}
