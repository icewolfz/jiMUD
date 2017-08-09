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
let win, winMap;
let set, mapperMax = false;
let reload = null;
let tray = null;
let overlay = 0;
let windows = {};

app.setAppUserModelId('jiMUD');

global.settingsFile = parseTemplate(path.join('{data}', 'settings.json'));
global.mapFile = parseTemplate(path.join('{data}', 'map.sqlite'));
global.profiles = null;
global.character = null;
global.characterPass = null;
global.title = '';
global.debug = false;

let states = {
  'main': { x: 0, y: 0, width: 800, height: 600 },
  'mapper': { x: 0, y: 0, width: 800, height: 600 }
};

process.on('uncaughtException', (err) => {
  logError(err);
});

var characters;

function loadCharacter(char) {
  if (!characters)
    characters = { load: 0, characters: {} };
  if (!characters.characters[char]) {
    characters.characters[char] = { settings: path.join("{characters}", char + ".json"), map: path.join("{characters}", char + ".map") };
    var d = settings.Settings.load(parseTemplate(path.join("{data}", "settings.json")));
    d.save(parseTemplate(characters.characters[char].settings));
    fs.writeFileSync(path.join(app.getPath('userData'), "characters.json"), JSON.stringify(characters));
    if (isFileSync(parseTemplate(path.join("{data}", "map.sqlite")))) {
      copyFile(parseTemplate(path.join("{data}", "map.sqlite")), parseTemplate(characters.characters[char].map));
    }
  }
  global.character = char;
  global.settingsFile = parseTemplate(characters.characters[char].settings);
  global.mapFile = parseTemplate(characters.characters[char].map);
  global.characterPass = characters.characters[char].password || '';
  global.title = char;
  updateTray();
}

var menuTemp = [
  //File
  {
    label: '&File',
    id: 'file',
    submenu: [
      {
        label: "&Connect",
        id: "connect",
        accelerator: "CmdOrCtrl+N",
        click: () => {
          win.webContents.executeJavaScript('client.connect()');
        }
      },
      {
        label: "&Disconnect",
        id: "disconnect",
        accelerator: "CmdOrCtrl+D",
        enabled: false,
        click: () => {
          win.webContents.executeJavaScript('client.close()');
        }
      },
      {
        type: 'separator'
      },
      {
        label: "Ch&aracters...",
        id: "characters",
        accelerator: "CmdOrCtrl+H",
        click: () => {
          win.webContents.executeJavaScript('showCharacters()');
        }
      },
      { type: 'separator' },
      {
        label: '&Log',
        id: "log",
        type: 'checkbox',
        checked: false,
        click: () => {
          win.webContents.executeJavaScript('toggleLogging()');
        }
      },
      {
        label: '&View logs...'
      },
      {
        type: 'separator'
      },
      {
        label: '&Preferences...',
        id: 'preferences',
        accelerator: "CmdOrCtrl+Comma",
        click: showPrefs
      },
      {
        type: 'separator'
      },
      {
        label: 'E&xit',
        role: 'quit'
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
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        click: () => {
          win.webContents.executeJavaScript('paste()');
        }
      },
      {
        label: 'Paste special',
        accelerator: 'CmdOrCtrl+Shift+V',
        click: () => {
          win.webContents.executeJavaScript('pasteSpecial()');
        }
      },
      /*
      {
        role: 'pasteandmatchstyle'
      },
      */
      {
        role: 'delete'
      },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        click: () => {
          win.webContents.executeJavaScript('selectAll()');
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Clear',
        click: () => {
          win.webContents.executeJavaScript('client.clear()');
        }
      },
      { type: 'separator' },
      {
        label: 'Find',
        accelerator: 'CmdOrCtrl+F',
        click: () => {
          win.webContents.executeJavaScript('client.display.showFind()');
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
        id: "lock",
        type: 'checkbox',
        checked: false,
        click: () => {
          win.webContents.executeJavaScript('client.toggleScrollLock()');
        }
      },
      {
        label: '&Who is on?',
        click: () => {
          shell.openExternal("http://www.shadowmud.com/who.php", '_blank');
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
            id: "statusvisible",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("status")');
            }
          },
          {
            label: '&Refresh',
            id: "refresh",
            click: () => {
              win.webContents.executeJavaScript('client.sendGMCP(\'Core.Hello { "client": "\' + client.telnet.terminal + \'", "version": "\' + client.telnet.version + \'" }\');');
            }
          },
          { type: 'separator' },
          {
            label: '&Weather',
            id: "weather",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("weather")');
            }
          },
          {
            label: '&Limbs',
            id: "limbsmenu",
            submenu: [
              {
                label: '&Visible',
                id: "limbs",
                type: 'checkbox',
                checked: true,
                click: () => {
                  win.webContents.executeJavaScript('toggleView("limbs")');
                }
              },
              { type: 'separator' },
              {
                label: '&Health',
                id: "limbhealth",
                type: 'checkbox',
                checked: true,
                click: () => {
                  win.webContents.executeJavaScript('toggleView("limbhealth")');
                }
              },
              {
                label: '&Armor',
                id: "limbarmor",
                type: 'checkbox',
                checked: true,
                click: () => {
                  win.webContents.executeJavaScript('toggleView("limbarmor")');
                }
              },
            ]
          },
          {
            label: '&Health',
            id: "health",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("health")');
            }
          },
          {
            label: '&Experience',
            id: "experience",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("experience")');
            }
          },
          {
            label: '&Party Health',
            id: "partyhealth",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("partyhealth")');
            }
          },
          {
            label: '&Combat Health',
            id: "combathealth",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("combathealth")');
            }
          },
          {
            label: '&Lagmeter',
            id: "lagmeter",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("lagmeter")');
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
        click: () => {
          win.webContents.executeJavaScript('toggleView("buttons")');
        },
        */
        submenu: [
          {
            label: '&Visible',
            id: "buttonsvisible",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("buttons")');
            }
          },
          { type: 'separator' },
          {
            label: '&Connect',
            id: "connectbutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.connect")');
            }
          },
          {
            label: '&Characters',
            id: "charactersbutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.characters")');
            }
          },
          {
            label: '&Preferences',
            id: "preferencesbutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.preferences")');
            }
          },
          {
            label: '&Log',
            id: "logbutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.log")');
            }
          },
          {
            label: '&Clear',
            id: "clearbutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.clear")');
            }
          },
          {
            label: '&Lock',
            id: "lockbutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.lock")');
            }
          },
          {
            label: '&Map',
            id: "mapbutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.map")');
            }
          },
          {
            label: '&User buttons',
            id: "userbutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.user")');
            }
          },
        ]
      },
      {
        type: 'separator'
      },
      {
        role: 'toggledevtools'
      },
      {
        type: 'separator'
      },
      {
        role: 'resetzoom'
      },
      {
        role: 'zoomin'
      },
      {
        role: 'zoomout'
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
        click: () => {
          win.webContents.executeJavaScript('showEditor()');
        },
        accelerator: 'CmdOrCtrl+E'
      },
      {
        label: '&Chat...',
        id: 'chat',
        click: () => {
          win.webContents.executeJavaScript('showChat()');
        },
        accelerator: 'CmdOrCtrl+L'
      },
      {
        label: '&Immortal tools...',
        id: 'immortal',
        click: () => {
          win.webContents.executeJavaScript('showImmortalTools()');
        },
        visible: false,
        accelerator: 'CmdOrCtrl+I'
      },

      {
        label: '&Map...',
        click: showMapper,
        accelerator: 'CmdOrCtrl+T'
      },
      { type: 'separator' },
      {
        role: 'minimize'
      },
      {
        role: 'close'
      }
    ]
  },
  //Help
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
  menuTemp[5].submenu = [
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
  ];
}

let menubar;

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

function createMenu() {
  var profiles;
  for (var m = 0; m < menuTemp.length; m++) {
    if (menuTemp[m].id === "profiles") {
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
      click: () => {
        win.webContents.executeJavaScript('client.toggleProfile("default")');
      }
    });

  var p = path.join(app.getPath('userData'), "profiles");
  if (isDirSync(p)) {
    var files = fs.readdirSync(p);
    for (var i = 0; i < files.length; i++) {
      if (path.extname(files[i]) === ".json") {
        if (files[i].toLowerCase() === "default.json")
          continue;
        profiles.submenu.push(
          {
            label: path.basename(files[i], ".json"),
            type: 'checkbox',
            checked: false,
            id: path.basename(files[i], ".json").toLowerCase(),
            click: (menuItem, browserWindow, event) => {
              win.webContents.executeJavaScript('client.toggleProfile("' + menuItem.label.toLowerCase() + '")');
            }
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
      click: () => {
        win.webContents.executeJavaScript('showProfiles()');
      },
      accelerator: 'CmdOrCtrl+P'
    });
  menubar = Menu.buildFromTemplate(menuTemp);
  win.setMenu(menubar);
  win.webContents.send('menu-reload');
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
        let s = getWindowState('main');
        if (!s) getWindowState('main', win);
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
        let s = getWindowState('main');
        if (!s) getWindowState('main', win);
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
      click: showPrefs
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
    let s = getWindowState('main');
    if (!s) getWindowState('main', win);
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
    let s = getWindowState('main');
    if (!s) getWindowState('main', win);
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
  /*
  if(set.reportCrashes)
  {
    const {crashReporter} = require('electron')
    crashReporter.start({
      productName: 'jiMUD',
      companyName: 'jiMUD',
      submitURL: 'http://localhost:3000/api/app-crashes',
      uploadToServer: true
    })
  }
  */
  if (!set)
    set = settings.Settings.load(global.settingsFile);
  var s = loadWindowState('main');
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
  if (s.fullscreen)
    win.setFullScreen(s.fullscreen);
  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  createMenu();
  loadMenu();
  //win.setOverlayIcon(path.join(__dirname, '/../assets/icons/jimud.png'), 'Connected');

  // Open the DevTools.
  if (s.devTools)
    win.webContents.openDevTools();

  win.on('resize', () => {
    if (!win.isMaximized() && !win.isFullScreen())
      trackWindowState('main', win);
  });

  win.on('move', () => {
    if (!win.isMaximized() && !win.isFullScreen())
      trackWindowState('main', win);
  });

  win.on('maximize', () => {
    trackWindowState('main', win);
    states['main'].maximized = true;
  });

  win.on('unmaximize', () => {
    trackWindowState('main', win);
    states['main'].maximized = false;
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
        set.windows['main'] = getWindowState('main', win);
        if (winMap) {
          set.windows['mapper'] = getWindowState('mapper', winMap);
          winMap.webContents.executeJavaScript('save();');
          winMap.destroy();
        }
        for (var name in windows) {
          if (!windows.hasOwnProperty(name) || !windows[name].window)
            continue;
          windows[name].window.webContents.executeJavaScript('closing();');
          windows[name].window.webContents.executeJavaScript('closed();');
          set.windows[name] = getWindowState(name, windows[name].window);
          set.windows[name].options = copyWindowOptions(name);
          windows[name].window.destroy();
        }
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
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
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

    if (set.showMapper)
      showMapper();
    else if (set.mapper.persistent || set.mapper.enabled)
      createMapper();


    for (var name in set.windows) {
      if (set.windows[name].options) {
        if (set.windows[name].options.show)
          showWindow(name, set.windows[name].options);
        else if (set.windows[name].options.persistent)
          createNewWindow(name, set.windows[name].options);
      }
      else {
        if (set.windows[name].show)
          showWindow(name, set.windows[name]);
        else if (set.windows[name].persistent)
          createNewWindow(name, set.windows[name]);
      }
    }

  });

  win.on('close', (e) => {
    set = settings.Settings.load(global.settingsFile);
    set.windows['main'] = getWindowState('main', win);

    if (winMap) {
      set.windows['mapper'] = getWindowState('mapper', winMap);
      winMap.webContents.executeJavaScript('save();');
      winMap.destroy();
    }
    for (var name in windows) {
      if (!windows.hasOwnProperty(name) || !windows[name].window)
        continue;
      windows[name].window.webContents.executeJavaScript('closing();');
      windows[name].window.webContents.executeJavaScript('closed();');
      set.windows[name] = getWindowState(name, windows[name].window);
      set.windows[name].options = copyWindowOptions(name);
      windows[name].window.destroy();
    }
    set.save(global.settingsFile);
  });
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  if (!existsSync(path.join(app.getPath('userData'), "characters")))
    fs.mkdirSync(path.join(app.getPath('userData'), "characters"));

  loadCharacters();

  process.argv.forEach((val, index) => {
    switch (val) {
      case "-h":
      case "--help":
      case "-?":
      case "/?":
        console.log('-h, --help                    Print console help');
        console.log('-d, --debug                   Enable dev tools for all windows');
        console.log('-s=[file], --setting=[file]   Override default setting file');
        console.log('-mf=[file], --map=[file]      Override default map file');
        console.log('-c=[name], --character=[name] Allows you to load/create a character from character database');
        console.log('-pf=[list], --profiles[]      Set which profiles will be enabled, if not found will default');
        console.log('-v, --version                 Print current version');
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

    if (val.startsWith("--character=") || val.startsWith("--character:")) {
      global.character = val.substring(12);
      loadCharacter(global.character);
    }
    if (val.startsWith("-c=") || val.startsWith("-c:")) {
      global.character = val.substring(3);
      loadCharacter(global.character);
    }

    if (val.startsWith("--settings=") || val.startsWith("--settings:"))
      global.settingsFile = parseTemplate(val.substring(11));
    if (val.startsWith("-settings=") || val.startsWith("-settings:"))
      global.settingsFile = parseTemplate(val.substring(10));
    if (val.startsWith("-s=") || val.startsWith("-s:"))
      global.settingsFile = parseTemplate(val.substring(3));
    if (val.startsWith("-sf=") || val.startsWith("-sf:"))
      global.settingsFile = parseTemplate(val.substring(4));

    if (val.startsWith("--map=") || val.startsWith("--map:"))
      global.mapFile = parseTemplate(val.substring(6));
    if (val.startsWith("-map=") || val.startsWith("-map:"))
      global.mapFile = parseTemplate(val.substring(5));
    if (val.startsWith("-m=") || val.startsWith("-m:"))
      global.mapFile = parseTemplate(val.substring(3));
    if (val.startsWith("-mf=") || val.startsWith("-mf:"))
      global.mapFile = parseTemplate(val.substring(4));

    if (val.startsWith("--profiles=") || val.startsWith("--profiles:"))
      global.profiles = parseTemplate(val.substring(11)).split(',');
    if (val.startsWith("-pf=") || val.startsWith("-pf:"))
      global.profiles = parseTemplate(val.substring(4)).split(',');
  });

  createTray();
  createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  //asked to reload with a different character
  if (reload) {
    loadCharacter(reload);
    createWindow();
    reload = null;
    return;
  }
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

ipcMain.on('reload', (event, char) => {
  //already loaded so no need to reload
  if (char === global.character)
    return;
  reload = char;
  win.close();
});

ipcMain.on('load-default', (event) => {
  //already loaded so no need to switch
  var sf = parseTemplate(path.join("{data}", "settings.json"));
  var mf = parseTemplate(path.join("{data}", "map.sqlite"));
  if (sf === global.settingsFile && mf === global.mapFile)
    return;
  if (win && win.webContents)
    win.webContents.send('load-default');
  global.settingsFile = sf;
  global.mapFile = mf;

  set = settings.Settings.load(global.settingsFile);

  if (winMap) {
    winMap.webContents.executeJavaScript('save();');
    winMap.destroy();
  }
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.executeJavaScript('closed();');
    set.windows[name] = getWindowState(name, windows[name].window);
    set.windows[name].options = copyWindowOptions(name);
    windows[name].window.destroy();
  }
  if (win && win.webContents)
    win.webContents.send('change-options', global.settingsFile);

  if (set.showMapper)
    showMapper();
  else if (set.mapper.persistent || set.mapper.enabled)
    createMapper();
});

ipcMain.on('load-char', (event, char) => {
  //already loaded so no need to switch
  if (char === global.character)
    return;
  loadCharacter(char);
  set = settings.Settings.load(global.settingsFile);
  if (win && win.webContents)
    win.webContents.send('load-char', char);

  if (winMap) {
    winMap.webContents.executeJavaScript('save();');
    winMap.destroy();
  }

  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.executeJavaScript('closed();');
    set.windows[name] = getWindowState(name, windows[name].window);
    set.windows[name].options = copyWindowOptions(name);
    windows[name].window.destroy();
  }
  if (win && win.webContents)
    win.webContents.send('change-options', global.settingsFile);

  if (set.showMapper)
    showMapper();
  else if (set.mapper.persistent || set.mapper.enabled)
    createMapper();

});

ipcMain.on('reload-options', () => {
  if (win && win.webContents)
    win.webContents.send('reload-options');
  set = settings.Settings.load(global.settingsFile);
  if (set.showTrayIcon && !tray)
    createTray();
  else if (!set.showTrayIcon && tray) {
    tray.destroy();
    tray = null;
  }

  if (winMap) {
    winMap.webContents.send('reload-options');
    if (winMap.setParentWindow)
      winMap.setParentWindow(set.mapper.alwaysOnTopClient ? win : null);
    winMap.setAlwaysOnTop(set.mapper.alwaysOnTop);
    winMap.setSkipTaskbar((set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop) ? true : false);
  }
  else if (set.mapper.enabled)
    createMapper();

  for (var name in windows) {
    if (!windows.hasOwnProperty(name))
      continue;
    if (!windows[name].window) {
      if (set.windows[name].options.show)
        showWindow(name, set.windows[name].options);
      else if (set.windows[name].options.persistent)
        createNewWindow(name, set.windows[name].options);
      else
        return;
    }
    else {
      windows[name].window.webContents.send('reload-options');
      if (windows[name].window.setParentWindow)
        windows[name].window.setParentWindow(set.windows[name].options.alwaysOnTopClient ? win : null);
      windows[name].window.setAlwaysOnTop(set.windows[name].options.alwaysOnTop);
      windows[name].window.setSkipTaskbar((set.windows[name].options.alwaysOnTopClient || set.windows[name].options.alwaysOnTop) ? true : false);
    }
  }
});

ipcMain.on('set-title', (event, title) => {
  global.title = title;
  if (winMap)
    winMap.webContents.send('set-title', title);
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('set-title', title);
  }
  updateTray();
});

ipcMain.on('closed', () => {
  if (winMap)
    winMap.webContents.send('closed');
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('closed');
  }
});

ipcMain.on('connected', () => {
  if (winMap)
    winMap.webContents.send('connected');
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('connected');
  }
});

ipcMain.on('set-color', (event, type, color) => {
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('set-color', type, color);
  }
});

ipcMain.on('send-background', (event, command) => {
  if (win && win.webContents)
    win.webContents.send('send-background', command);
});

ipcMain.on('send-command', (event, command) => {
  if (win && win.webContents)
    win.webContents.send('send-command', command);
});

ipcMain.on('send-gmcp', (event, data) => {
  if (win && win.webContents)
    win.webContents.send('send-gmcp', data);
});

ipcMain.on('send-raw', (event, raw) => {
  if (win && win.webContents)
    win.webContents.send('send-raw', raw);
});

ipcMain.on('send', (event, raw, echo) => {
  if (win && win.webContents)
    win.webContents.send('send', raw, echo);
});

ipcMain.on('log', (event, raw) => {
  console.log(raw);
});

ipcMain.on('debug', (event, msg) => {
  if (win && win.webContents)
    win.webContents.send('debug', msg);
});

ipcMain.on('error', (event, err) => {
  if (win && win.webContents)
    win.webContents.send('error', err);
});

ipcMain.on('reload-profiles', (event) => {
  createMenu();
  if (win && win.webContents)
    win.webContents.send('reload-profiles');
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window || !windows[name].window.webContents)
      continue;
    windows[name].window.webContents.send('reload-profiles');
  }
});

ipcMain.on('chat', (event, text, args) => {
  for (var name in windows) {
    if (!windows.hasOwnProperty(name))
      continue;
    if (!windows[name].window) {
      if (args) {
        createNewWindow(name, args);
        setTimeout(() => { windows[name].window.webContents.send('chat', text); }, 100);
      }
    }
    else if (!windows[name].ready)
      setTimeout(() => { windows[name].window.webContents.send('chat', text); }, 100);
    else
      windows[name].window.webContents.send('chat', text);
  }
});

ipcMain.on('setting-changed', (event, data) => {
  if (data.type === "mapper" && data.name === "alwaysOnTopClient") {
    if (winMap.setParentWindow)
      winMap.setParentWindow(data.value ? win : null);
    winMap.setSkipTaskbar((set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop) ? true : false);
  }
  if (data.type === "mapper" && data.name === "setAlwaysOnTop") {
    winMap.setAlwaysOnTop(data.value);
    winMap.setSkipTaskbar((set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop) ? true : false);
  }
  if (win && event.sender != win.webContents)
    win.webContents.send('setting-changed', data);
  if (winMap && event.sender != winMap.webContents)
    winMap.webContents.send('setting-changed', data);

  if (data.type === "mapper" && data.name === "enabled" && !winMap && data.value)
    createMapper();

  var name;
  if (data.type === "windows")
    for (name in windows) {
      if (!windows.hasOwnProperty(name) || !windows[name].window)
        continue;

      if (name === data.name) {
        windows[name].alwaysOnTopClient = data.value.alwaysOnTopClient;
        windows[name].persistent = data.value.persistent;
        windows[name].alwaysOnTop = data.value.alwaysOnTop;
      }
      if (windows[name].window)
        windows[name].window.webContents.send('setting-changed', data);
      if (windows[name].window.setParentWindow)
        windows[name].window.setParentWindow(windows[name].alwaysOnTopClient ? win : null);
      windows[name].window.setSkipTaskbar((windows[name].alwaysOnTopClient || windows[name].alwaysOnTop) ? true : false);
      if (windows[name].persistent)
        createNewWindow(name, windows[name]);
    }
  if (data.type === "extensions")
    for (name in windows) {
      if (!windows.hasOwnProperty(name) || !windows[name].window)
        continue;
      if (windows[name].window)
        windows[name].window.webContents.send('setting-changed', data);
    }
});

ipcMain.on('GMCP-received', (event, data) => {
  if (winMap)
    winMap.webContents.send('GMCP-received', data);
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('GMCP-received', data);
  }
});

ipcMain.on('update-menuitem', (event, args) => {
  updateMenuItem(args);
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

ipcMain.on('set-progress-window', (event, window, args) => {
  if (window == "mapper") {
    if (winMap)
      winMap.setProgressBar(args.value, args.options);
  }
  else if (windows[window] && windows[window].window)
    windows[window].window.setProgressBar(args.value, args.options);
});

ipcMain.on('show-window', (event, window, args) => {
  if (window === "prefs")
    showPrefs();
  else if (window === "mapper")
    showMapper();
  else if (window === "color")
    showColor(args);
  else if (windows[window] && windows[window].window)
    showWindow(window, windows[window]);
  else
    createNewWindow(window, args);
});

ipcMain.on('show-dialog', (event, window, args) => {
  if (windows[window] && windows[window].window)
    dialog.showMessageBox(windows[window].window, args || {});
  else
    dialog.showMessageBox(win, args || {});
});

ipcMain.on('create-window', (event, window, args) => {
  createNewWindow(window, args);
});

ipcMain.on('import-map', (event, data) => {
  if (winMap)
    winMap.webContents.send('import', data);
});

ipcMain.on('flush', (event) => {
  if (winMap)
    winMap.webContents.send('flush');
});

ipcMain.on('flush-end', (event) => {
  if (win && win.webContents)
    win.webContents.send('flush-end');
});

ipcMain.on('reload-characters', (event) => {
  loadCharacters(true);
  loadCharacter(global.character);
});

ipcMain.on('profile-item-added', (event, type, profile, item) => {
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('profile-item-added', type, profile, item);
  }
});

ipcMain.on('profile-item-removed', (event, type, profile, idx) => {
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('profile-item-removed', type, profile, idx);
  }
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

function updateMenuItem(args) {
  var item, i = 0, items;
  var tItem, tItems;
  if (!menubar || args == null || args.menu == null) return;

  if (!Array.isArray(args.menu))
    args.menu = args.menu.split('|');

  items = menubar.items;
  tItems = menuTemp;
  for (i = 0; i < args.menu.length; i++) {
    if (!items || items.length === 0) break;
    for (var m = 0; m < items.length; m++) {
      if (!items[m].id) continue;
      if (items[m].id === args.menu[i]) {
        item = items[m];
        tItem = tItems[m];
        if (item.submenu) {
          items = item.submenu.items;
          tItems = tItem.submenu;
        }
        else
          items = null;
        break;
      }
    }
  }
  if (!item)
    return;
  if (args.enabled != null)
    item.enabled = args.enabled ? true : false;
  if (args.checked != null)
    item.checked = args.checked ? true : false;
  if (args.icon != null)
    item.icon = args.icon;
  if (args.visible != null)
    item.visible = args.visible ? true : false;
  if (args.position != null)
    item.position = args.position;

  tItem.enabled = item.enabled;
  tItem.checked = item.checked;
  tItem.icon = item.icon;
  tItem.visible = item.visible;
  tItem.position = item.position;
}

function loadMenu() {
  set = settings.Settings.load(global.settingsFile);
  updateMenuItem({ menu: ['view', 'status', 'statusvisible'], checked: set.showStatus });
  updateMenuItem({ menu: ['view', 'status', 'weather'], checked: set.showStatusWeather });
  updateMenuItem({ menu: ['view', 'status', 'limbsmenu', 'limbs'], checked: set.showStatusLimbs });
  updateMenuItem({ menu: ['view', 'status', 'limbsmenu', 'limbhealth'], checked: !set.showArmor });
  updateMenuItem({ menu: ['view', 'status', 'limbsmenu', 'limbarmor'], checked: set.showArmor });

  updateMenuItem({ menu: ['view', 'status', 'health'], checked: set.showStatusHealth });
  updateMenuItem({ menu: ['view', 'status', 'experience'], checked: set.showStatusExperience });
  updateMenuItem({ menu: ['view', 'status', 'partyhealth'], checked: set.showStatusPartyHealth });
  updateMenuItem({ menu: ['view', 'status', 'combathealth'], checked: set.showStatusCombatHealth });
  updateMenuItem({ menu: ['view', 'status', 'lagmeter'], checked: set.lagMeter });
  updateMenuItem({ menu: ['view', 'buttons'], checked: set.showButtonBar });
}

function getWindowState(id, window) {
  var bounds = states[id];
  if (!window)
    return states[id];
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreen: window.isFullScreen(),
    maximized: window.isMaximized(),
    devTools: window.webContents.isDevToolsOpened()
  };
}

function loadWindowState(window) {
  set = settings.Settings.load(global.settingsFile);
  if (!set.windows || !set.windows[window])
    return {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    };
  states[window] = {
    x: set.windows[window].x,
    y: set.windows[window].y,
    width: set.windows[window].width,
    height: set.windows[window].height,
  };
  return set.windows[window];
}

function trackWindowState(id, window) {
  if (!window) return states[id];
  var bounds = window.getBounds();
  if (!states[id])
    states[id] = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    };
  else {
    states[id].x = bounds.x;
    states[id].y = bounds.y;
    states[id].width = bounds.width;
    states[id].height = bounds.height;
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

function showPrefs() {
  var b = win.getBounds();

  let pref = new BrowserWindow({
    parent: win,
    modal: true,
    x: Math.floor(b.x + b.width / 2 - 400),
    y: Math.floor(b.y + b.height / 2 - 210),
    width: 800,
    height: 420,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    resizable: false,
    title: 'Preferences',
    icon: path.join(__dirname, '../assets/icons/png/preferences.png')
  });
  //pref.webContents.openDevTools()
  pref.setMenu(null);
  pref.on('closed', () => {
    pref = null;
  });
  pref.loadURL(url.format({
    pathname: path.join(__dirname, 'prefs.html'),
    protocol: 'file:',
    slashes: true
  }));

  if (global.debug)
    pref.webContents.openDevTools();

  pref.once('ready-to-show', () => {
    pref.show();
  });

  pref.webContents.on('crashed', (event, killed) => {
    logError(`Preferences crashed, killed: ${killed}\n`, true);
  });
  addInputContext(pref);
}

function createMapper(show) {
  if (winMap) return;
  var s = loadWindowState('mapper');
  winMap = new BrowserWindow({
    parent: set.mapper.alwaysOnTopClient ? win : null,
    alwaysOnTop: set.mapper.alwaysOnTop,
    title: 'Mapper',
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: '#eae4d6',
    show: false,
    skipTaskbar: (set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop) ? true : false,
    icon: path.join(__dirname, '../assets/icons/png/map.png')
  });

  if (s.fullscreen)
    winMap.setFullScreen(s.fullscreen);

  winMap.setMenu(null);
  winMap.loadURL(url.format({
    pathname: path.join(__dirname, 'mapper.html'),
    protocol: 'file:',
    slashes: true
  }));

  winMap.webContents.on('crashed', (event, killed) => {
    logError(`Mapper crashed, killed: ${killed}\n`, true);
  });

  winMap.on('closed', () => {
    winMap = null;
  });

  winMap.on('resize', () => {
    if (!winMap.isMaximized() && !winMap.isFullScreen())
      trackWindowState('mapper', winMap);
  });

  winMap.on('move', () => {
    trackWindowState('mapper', winMap);
  });

  winMap.on('maximize', () => {
    trackWindowState('mapper', winMap);
    states['mapper'].maximized = true;
  });

  winMap.on('unmaximize', () => {
    trackWindowState('mapper', winMap);
    states['mapper'].maximized = false;
  });

  if (global.debug)
    winMap.webContents.openDevTools();

  winMap.once('ready-to-show', () => {
    addInputContext(winMap);
    if (show) {
      if (s.maximized)
        winMap.maximize();
      else
        winMap.show();
    }
    else
      mapperMax = s.maximized;
  });

  winMap.on('close', (e) => {
    set = settings.Settings.load(global.settingsFile);
    if (win != null)
      set.showMapper = false;
    set.windows['mapper'] = getWindowState('mapper', winMap);
    set.save(global.settingsFile);
    winMap.webContents.executeJavaScript('save();');
    if (set.mapper.enabled || set.mapper.persistent) {
      e.preventDefault();
      winMap.hide();
    }
  });
}

function showMapper() {
  set = settings.Settings.load(global.settingsFile);
  set.showMapper = true;
  set.save(global.settingsFile);
  if (winMap != null) {
    if (mapperMax)
      winMap.maximize();
    else
      winMap.show();
    mapperMax = false;
  }
  else
    createMapper(true);
}

function createNewWindow(name, options) {
  if (windows[name] && windows[name].window)
    return;
  if (!options) options = {};
  var s = loadWindowState(name);
  if (options.hasOwnProperty('width')) {
    s.width = options.width;
    delete options.width;
  }
  if (options.hasOwnProperty('height')) {
    s.height = options.height;
    delete options.height;
  }
  if (options.hasOwnProperty('x')) {
    s.x = options.x;
    delete options.x;
  }
  if (options.hasOwnProperty('y')) {
    s.y = options.y;
    delete options.y;
  }
  windows[name] = options;
  windows[name].window = new BrowserWindow({
    parent: windows[name].alwaysOnTopClient ? win : null,
    title: options.title || name,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: options.background || '#000',
    show: false,
    skipTaskbar: (windows[name].alwaysOnTopClient || windows[name].alwaysOnTop) ? true : false,
    icon: path.join(__dirname, '../assets/icons/png/' + (options.icon || name) + '.png')
  });

  windows[name].window.webContents.on('crashed', (event, killed) => {
    logError(`${name} crashed, killed: ${killed}\n`, true);
  });

  if (s.fullscreen)
    windows[name].window.setFullScreen(s.fullscreen);

  windows[name].window.setMenu(options.menu || null);

  windows[name].window.loadURL(url.format({
    pathname: path.join(__dirname, (windows[name].file || (name + '.html'))),
    protocol: 'file:',
    slashes: true
  }));

  windows[name].window.on('closed', () => {
    windows[name].window = null;
    windows[name].ready = false;
  });

  windows[name].window.on('resize', () => {
    if (!windows[name].window.isMaximized() && !windows[name].window.isFullScreen())
      trackWindowState(name, windows[name].window);
  });

  windows[name].window.on('move', () => {
    trackWindowState(name, windows[name].window);
  });

  windows[name].window.on('maximize', () => {
    trackWindowState(name, windows[name].window);
  });

  windows[name].window.on('maximize', () => {
    trackWindowState(name, windows[name].window);
    states[name].maximized = true;
  });

  windows[name].window.on('unmaximize', () => {
    trackWindowState(name, windows[name].window);
    states[name].maximized = false;
  });

  windows[name].window.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
    event.preventDefault();
    if (frameName === 'modal') {
      // open window as modal
      Object.assign(options, {
        modal: true,
        parent: windows[name].window,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        resizable: false
      });

      var b = windows[name].window.getBounds();
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
    windows[name].window.webContents.openDevTools();

  windows[name].window.once('ready-to-show', () => {
    if (!options.noInput)
      addInputContext(windows[name].window);
    if (options.show) {
      if (s.maximized)
        windows[name].window.maximize();
      else
        windows[name].window.show();
    }
    else
      windows[name].max = s.maximized;
    windows[name].ready = true;
  });

  windows[name].window.on('close', (e) => {
    windows[name].window.webContents.executeJavaScript('closing();');
    set = settings.Settings.load(global.settingsFile);
    set.windows[name] = getWindowState(name, windows[name].window);
    windows[name].show = false;
    set.windows[name].options = copyWindowOptions(name);
    set.save(global.settingsFile);
    if (windows[name].persistent) {
      e.preventDefault();
      windows[name].window.hide();
    }
  });
}

function showWindow(name, options) {
  set = settings.Settings.load(global.settingsFile);
  options.show = true;
  if (!set.windows[name])
    set.windows[name] = {};
  set.windows[name].show = true;
  set.save(global.settingsFile);
  if (!options) options = { show: true };
  if (windows[name] && windows[name].window) {
    if (windows[name].max)
      windows[name].window.maximize();
    else
      windows[name].window.show();
    windows[name].max = false;
  }
  else
    createNewWindow(name, options);
}

function showColor(args) {
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

function copyFile(src, dest) {

  let readStream = fs.createReadStream(src);

  readStream.once('error', (err) => {
    console.log(err);
  });

  readStream.once('end', () => { });

  readStream.pipe(fs.createWriteStream(dest));
}

function loadCharacters(noLoad) {
  if (isFileSync(path.join(app.getPath('userData'), "characters.json"))) {
    characters = fs.readFileSync(path.join(app.getPath('userData'), "characters.json"), 'utf-8');
    if (characters.length > 0) {
      try {
        characters = JSON.parse(characters);
      }
      catch (e) {
        console.log('Could not load: \'characters.json\'');
      }
      if (!noLoad && characters.load)
        loadCharacter(characters.load);
    }
  }
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

function copyWindowOptions(name) {
  if (!name || !windows[name]) return {};
  var ops = {};
  for (var op in windows[name]) {
    if (!windows[name].hasOwnProperty(op) || op === "window")
      continue;
    ops[op] = windows[name][op];
  }
  return ops;
}