//cSpell:words submenu, pasteandmatchstyle, statusvisible, taskbar
//cSpell:ignore prefs, partyhealth, combathealth
const { app, BrowserWindow, shell } = require('electron');
const { Tray, dialog, Menu } = require('electron');
const ipcMain = require('electron').ipcMain;
const path = require('path');
const fs = require('fs');
const url = require('url');
const settings = require('./js/settings');
const { EditorSettings } = require('./js/editor/code.editor.settings');
const { TrayClick } = require('./js/types');


//require('electron-local-crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win, winWho, winMap, winProfiles, winEditor, winChat, winCode;//winHelp
let set, mapperMax = false, editorMax = false, chatMax = false, codeMax = false;
let edset;
let chatReady = false, codeReady = false, editorReady = false;
let reload = null;
let tray = null;
let overlay = 0;
let windows = {};
let loadid;

var argv = require('yargs-parser')(process.argv, {
  string: ['data-dir', 's', 'setting', 'm', 'mf', 'map', 'c', 'character', 'pf', 'profiles'],
  boolean: ['h', 'help', 'v', 'version', 'no-pd', 'no-portable-dir', 'disable-gpu', 'd', 'debug', '?'],
  alias: {
    'd': ['debug'],
    'eo': ['editorOnly', 'editoronly'],
    'h': ['help', '?'],
    'v': ['version'],
    'no-pd': ['no-portable-dir'],
    's': ['settings'],
    'mf': ['map', 'm'],
    'c': ['character', 'char'],
    'pf': ['profiles']
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
    console.log('-mf=[file], --map=[file]            Override default map file');
    console.log('-c=[name], --character=[name]       Allows you to load/create a character from character database');
    console.log('-pf=[list], --profiles[]            Set which profiles will be enabled, if not found will default');
    console.log('-v, --version                       Print current version');
    console.log('-e, --e, -e=[file], --e=[file]      Open code editor');
    console.log('-eo, --eo, -eo=[file], --eo=[file]  Open only the code editor');
    console.log('-data-dir=[file]                    Set a custom directory to store saved data');
    app.quit();
    return;
  }
  else if (argv.v) {
    console.log(`jiMUD v${require("../package.json").version}`);
    app.quit();
    return;
  }
}

global.settingsFile = parseTemplate(path.join('{data}', 'settings.json'));
global.mapFile = parseTemplate(path.join('{data}', 'map.sqlite'));
global.profiles = null;
global.character = null;
global.characterLogin = null;
global.characterPass = null;
global.dev = false;
global.title = '';
global.debug = false;
global.editorOnly = false;
global.connected = false;

let states = {
  'main': { x: 0, y: 0, width: 800, height: 600 },
  'help': { x: 0, y: 0, width: 800, height: 600 },
  'mapper': { x: 0, y: 0, width: 800, height: 600 },
  'profiles': { x: 0, y: 0, width: 800, height: 600 },
  'editor': { x: 0, y: 0, width: 300, height: 225 },
  'chat': { x: 0, y: 0, width: 300, height: 225 },
};

process.on('uncaughtException', (err) => {
  logError(err);
});

var characters;

function loadCharacter(char) {
  if (!char || char.length === 0) {
    global.settingsFile = parseTemplate(path.join('{data}', 'settings.json'));
    global.mapFile = parseTemplate(path.join('{data}', 'map.sqlite'));
    global.profiles = null;
    global.character = null;
    global.characterLogin = null;
    global.characterPass = null;
    global.dev = false;
    global.title = '';
    global.debug = false;
    global.editorOnly = false;
    return;
  }
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
  global.characterLogin = characters.characters[char].name || (char || '').replace(/[^a-zA-Z0-9]+/g, '');
  global.dev = characters.characters[char].dev;
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
        label: '&View logs...',
        click: () => {
          win.webContents.executeJavaScript('showLogViewer()');
        }
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
          if (winWho) {
            winWho.show();
            return;
          }
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
            label: '&Lag meter',
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
            label: 'Code &editor',
            id: "codeEditorbutton",
            type: 'checkbox',
            click: showCodeEditor
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
          /*
          {
            label: 'M&ail',
            id: "mailbutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.mail")');
            }
          },
          {
            label: '&Compose mail',
            id: "composebutton",
            type: 'checkbox',
            checked: true,
            click: () => {
              win.webContents.executeJavaScript('toggleView("button.compose")');
            }
          },
          */
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
        label: '&Toggle Developer Tools',
        click: () => {
          if (win.webContents.isDevToolsOpened())
            win.webContents.closeDevTools();
          else
            win.webContents.openDevTools();
        }
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
        click: showEditor,
        accelerator: 'CmdOrCtrl+E'
      },
      {
        label: '&Chat...',
        id: 'chat',
        click: showChat,
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
        label: '&Code editor...',
        id: 'codeeditor',
        click: showCodeEditor
      },
      {
        label: '&Map...',
        click: showMapper,
        accelerator: 'CmdOrCtrl+T'
      },
      /*
      {
        label: '&Mail...',
        click: () => {
          win.webContents.executeJavaScript('showMail()');
        },
        visible: true,
        //accelerator: 'CmdOrCtrl+M'
      },
      {
        label: '&Compose mail...',
        click: () => {
          win.webContents.executeJavaScript('showComposer()');
        },
        visible: true,
        //accelerator: 'CmdOrCtrl+M'
      },
      */
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
          //showHelpWindow('http://www.shadowmud.com:1130/help', 'ShadowMUD Help');
          //showHelpWindow('http://www.shadowmud.com/OoMUD/smhelp.php', 'ShadowMUD Help');
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
        label: 'Check for updates...',
        id: 'updater',
        click: checkForUpdatesManual
      },
      { type: 'separator' },
      {
        label: '&About...',
        click: showAbout
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
      inputMenu.popup({ window: window });
    } else if (selectionText && selectionText.trim() !== '') {
      selectionMenu.popup({ window: window });
    }
  });
}

/*
function showHelpWindow(url, title) {
  if (winHelp != null) {
    winHelp.title = title;
    winHelp.loadURL(url);
    winHelp.show();
    return;
  }
  var s = loadWindowState('help');
  if (!title || title.length === 0)
    title = "Help";
  winHelp = new BrowserWindow({
    parent: win,
    title: title,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: '#000',
    show: false, skipTaskbar: false
  });

  winHelp.webContents.on('crashed', (event, killed) => {
    logError(`Help crashed, killed: ${killed}\n`, true);
  });


  if (s.fullscreen)
    winHelp.setFullScreen(s.fullscreen);

  winHelp.setMenu(null);
  winHelp.loadURL(url);
  winHelp.on('closed', () => {
    winHelp = null;
  });

  winHelp.on('resize', () => {
    if (!winHelp.isMaximized() && !winHelp.isFullScreen())
      trackWindowState('help', winHelp);
  });

  winHelp.on('move', () => {
    trackWindowState('help', winHelp);
  });

  winHelp.on('unmaximize', () => {
    trackWindowState('help', winHelp);
  });

  if (s.devTools)
    winHelp.webContents.openDevTools();

  winHelp.once('ready-to-show', () => {
    addInputContext(winHelp);
    if (url != null && url.length != 0) {
      if (s.maximized)
        winHelp.maximize();
      else
        winHelp.show();
    }
  });

  winHelp.on('close', () => {
    set = settings.Settings.load(global.settingsFile);
    set.windows['help'] = getWindowState('help', winHelp);
    set.save(global.settingsFile);
  });
}
*/

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
      click: showProfiles,
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
        win.show();
        if (s.isFullScreen)
          win.setFullScreen(s.fullscreen);
        win.focus();
        win.webContents.executeJavaScript('showCharacters()');
      }
    },
    {
      label: '&Manage profiles...',
      click: showProfiles,
    },
    {
      label: '&Code editor...',
      click: showCodeEditor,
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
        if (winWho) {
          winWho.show();
          return;
        }
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
  if ((set && set.dev) || global.dev)
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
          winMap.webContents.executeJavaScript('closeWindow()');
          winMap = null;
        }
        if (winEditor) {
          set.windows['editor'] = getWindowState('editor', winEditor);
          winEditor.close();
          winEditor = null;
        }
        if (winChat) {
          set.windows['chat'] = getWindowState('chat', winChat);
          winChat.close();
          winChat = null;
        }
        if (winCode) {
          if (!edset)
            edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
          if (global.editorOnly)
            edset.stateOnly = getWindowState('code-editor', winCode);
          else {
            if (winCode != null)
              edset.window.show = true;
            edset.state = getWindowState('code-editor', winCode);
          }
          edset.save(parseTemplate(path.join('{data}', 'editor.json')));
          winCode.webContents.executeJavaScript('closeWindow()');
          winCode = null;
        }
        closeWindows(false, true);
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
      loadWindowScripts(w, frameName);
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
    if (winMap) {
      set.windows['mapper'] = getWindowState('mapper', winMap);
      winMap.webContents.executeJavaScript('closeWindow()');
      winMap = null;
    }
    if (winEditor) {
      set.windows['editor'] = getWindowState('editor', winEditor);
      winEditor.close();
      winEditor = null;
    }
    if (winChat) {
      set.windows['chat'] = getWindowState('chat', winChat);
      winChat.close();
      winChat = null;
    }
    if (winCode && winCode.getParentWindow() == win) {
      if (!edset)
        edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
      if (global.editorOnly)
        edset.stateOnly = getWindowState('code-editor', winCode);
      else {
        edset.state = getWindowState('code-editor', winCode);
        edset.window.show = true;
      }
      edset.save(parseTemplate(path.join('{data}', 'editor.json')));
      winCode.webContents.executeJavaScript('closeWindow()');
      winCode = null;
    }
    closeWindows(true, false);
    set.save(global.settingsFile);
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
    loadWindowScripts(win, "user");
    if (s.maximized)
      win.maximize();
    win.show();

    if (set.showMapper)
      showMapper(true);
    else if (set.mapper.persistent || set.mapper.enabled)
      createMapper();

    if (set.showEditor)
      showEditor(true);
    else if (set.editorPersistent)
      createEditor();
    if (set.showChat)
      showChat(true);
    else if (set.chat.persistent || set.chat.captureTells || set.chat.captureTalk || set.chat.captureLines)
      createChat();

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

    if (!edset)
      edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
    if (edset.window.show)
      showCodeEditor(true);
    else if (!global.editorOnly && edset.window.persistent)
      createCodeEditor();
    updateJumpList();
    checkForUpdates();
  });

  win.on('close', (e) => {
    set = settings.Settings.load(global.settingsFile);
    set.windows['main'] = getWindowState('main', win || e.sender);

    if (winProfiles) {
      e.preventDefault();
      dialog.showMessageBox(winProfiles, {
        type: 'warning',
        title: 'Close profile manager',
        message: 'You must close the profile manager before you can exit.'
      });
      set.save(global.settingsFile);
      return;
    }
    if (winMap && !winMap.isDestroyed() && !winMap.isVisible())
      winMap.webContents.executeJavaScript('closeHidden()');
    set.save(global.settingsFile);
  });
}

function resetProfiles() {
  updateMenuItem({ menu: ['profiles', 'default'], checked: false });
  var p = path.join(app.getPath('userData'), "profiles");
  if (isDirSync(p)) {
    var files = fs.readdirSync(p);
    for (var i = 0; i < files.length; i++) {
      if (path.extname(files[i]) !== ".json")
        continue;
      updateMenuItem({ menu: ['profiles', path.basename(files[i], ".json")], checked: false });
    }
  }
}

if (argv['disable-gpu'])
  app.disableHardwareAcceleration();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  if (!existsSync(path.join(app.getPath('userData'), "characters")))
    fs.mkdirSync(path.join(app.getPath('userData'), "characters"));

  loadCharacters();
  var a, al;
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    if (argv._.indexOf('/?') !== -1 || argv.h) {
      var msg = '';
      msg += '-h, --help - Print console help\n';
      msg += '-d, --debug - Enable dev tools for all windows\n';
      msg += '-s=[file], --setting=[file] - Override default setting file\n';
      msg += '-mf=[file], --map=[file] - Override default map file\n';
      msg += '-c=[name], --character=[name] - Allows you to load/create a character from character database\n';
      msg += '-pf=[list], --profiles[] - Set which profiles will be enabled, if not found will default\n';
      msg += '-v, --version - Print current version\n';
      msg += '-e, --e, -e=[file], --e=[file] - Open code editor\n';
      msg += '-eo, --eo, -eo=[file], --eo=[file] - Open only the code editor\n';
      msg += '-no-pd, -no-portable-dir - Do not use portable dir\n';
      msg += '-data-dir=[file] - Set a custom directory to store saved data';
      dialog.showMessageBox({
        type: 'info',
        message: msg
      });
      console.log('-h, --help                          Print console help');
      console.log('-d, --debug                         Enable dev tools for all windows');
      console.log('-s=[file], --setting=[file]         Override default setting file');
      console.log('-mf=[file], --map=[file]            Override default map file');
      console.log('-c=[name], --character=[name]       Allows you to load/create a character from character database');
      console.log('-pf=[list], --profiles[]            Set which profiles will be enabled, if not found will default');
      console.log('-v, --version                       Print current version');
      console.log('-e, --e, -e=[file], --e=[file]      Open code editor');
      console.log('-eo, --eo, -eo=[file], --eo=[file]  Open only the code editor');
      console.log('-data-dir=[file]                    Set a custom directory to store saved data');
      app.quit();
      return;
    }
    else if (argv.v) {
      dialog.showMessageBox({
        type: 'info',
        message: `jiMUD v${require("../package.json").version}`
      });
      console.log(`jiMUD v${require("../package.json").version}`);
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
  if (argv.e) {
    showCodeEditor();
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
  }

  if (Array.isArray(argv.c)) {
    global.character = argv.c;
    loadCharacter(global.character);
  }
  else if (argv.c) {
    global.character = argv.c;
    loadCharacter(global.character);
  }
  if (Array.isArray(argv.s))
    global.settingsFile = parseTemplate(argv.s[0]);
  else if (argv.s)
    global.settingsFile = parseTemplate(argv.s);

  if (Array.isArray(argv.mf))
    global.settingsFile = parseTemplate(argv.mf[0]);
  else if (argv.mf)
    global.settingsFile = parseTemplate(argv.mf);

  if (Array.isArray(argv.pf))
    global.settingsFile = parseTemplate(argv.pf[0]);
  else if (argv.pf)
    global.settingsFile = parseTemplate(argv.pf);

  if (Array.isArray(argv.s))
    global.settingsFile = parseTemplate(argv.s[0]);
  else if (argv.s)
    global.settingsFile = parseTemplate(argv.s);

  if (global.editorOnly)
    showCodeEditor();
  else {
    createTray();
    createWindow();
  }
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
    if (tray)
      tray.destroy();
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

app.on('before-quit', () => {

});

ipcMain.on('check-for-updates', checkForUpdatesManual);

ipcMain.on('reload', (event, char) => {
  //already loaded so no need to reload
  if (char === global.character)
    return;
  reload = char;
  win.close();
});

ipcMain.on('load-default', (event) => {
  var name;
  var cWin;
  //already loaded so no need to switch
  var sf = parseTemplate(path.join("{data}", "settings.json"));
  var mf = parseTemplate(path.join("{data}", "map.sqlite"));
  if (sf === global.settingsFile && mf === global.mapFile) {
    for (name in windows) {
      if (!windows.hasOwnProperty(name) || !windows[name].window)
        continue;
      windows[name].webContents.send('load-default');
    }
    return;
  }
  if (win && win.webContents)
    win.webContents.send('load-default');
  global.settingsFile = sf;
  global.mapFile = mf;
  resetProfiles();
  set = settings.Settings.load(global.settingsFile);

  if (winMap) {
    winMap.webContents.executeJavaScript('closeWindow()');
    winMap = null;
  }

  if (winEditor) {
    winEditor.close();
    winEditor = null;
  }
  if (winChat) {
    winChat.close();
    winChat = null;
  }
  for (name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.executeJavaScript('closed();');
    set.windows[name] = getWindowState(name, windows[name].window);
    set.windows[name].options = copyWindowOptions(name);
    cWin = windows[name].window;
    windows[name].window = null;
    cWin.close();
  }
  if (win && win.webContents)
    win.webContents.send('change-options', global.settingsFile);

  if (set.showMapper)
    showMapper(true);
  else if (set.mapper.persistent || set.mapper.enabled)
    createMapper();

  if (set.showEditor)
    showEditor(true);
  else if (set.editorPersistent)
    createEditor();
  if (set.showChat)
    showChat(true);
  else if (set.chat.persistent || set.chat.captureTells || set.chat.captureTalk || set.chat.captureLines)
    createChat();
  if (!edset)
    edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
  if (edset.window.show)
    showCodeEditor(true);
  else if (!global.editorOnly && edset.window.persistent)
    createCodeEditor();
});

ipcMain.on('load-char', (event, char) => {
  var name;
  //already loaded so no need to switch
  if (char === global.character) {
    loadCharacter(char);
    win.webContents.send('load-char', char);
    if (winMap)
      winMap.webContents.send('load-char', char);
    for (name in windows) {
      if (!windows.hasOwnProperty(name) || !windows[name].window)
        continue;
      windows[name].window.webContents.send('load-char', char);
    }
    return;
  }
  closeWindows(false, true);
  set.windows['main'] = getWindowState('main', win);
  if (winMap) {
    set.windows['mapper'] = getWindowState('mapper', winMap);
    winMap.webContents.executeJavaScript('closeWindow()');
    winMap = null;
  }
  if (winEditor) {
    set.windows['editor'] = getWindowState('editor', winEditor);
    winEditor.close();
    winEditor = null;
  }
  if (winChat) {
    set.windows['chat'] = getWindowState('chat', winChat);
    winChat.close();
    winChat = null;
  }
  set.save(global.settingsFile);
  loadCharacter(char);
  resetProfiles();
  set = settings.Settings.load(global.settingsFile);
  if (win && win.webContents)
    win.webContents.send('load-char', char);

  if (winMap) {
    winMap.webContents.executeJavaScript('closeWindow()');
    winMap = null;
  }

  if (winEditor) {
    winEditor.close();
    winEditor = null;
  }
  if (winChat) {
    winChat.close();
    winChat = null;
  }
  if (winCode) {
    winCode.webContents.executeJavaScript('closeWindow()');
    winCode = null;
  }
  if (win && win.webContents)
    win.webContents.send('change-options', global.settingsFile);

  if (set.showMapper)
    showMapper(true);
  else if (set.mapper.persistent || set.mapper.enabled)
    createMapper();

  if (set.showEditor)
    showEditor(true);
  else if (set.editorPersistent)
    createEditor();

  if (set.showChat)
    showChat(true);
  else if (set.chat.persistent || set.chat.captureTells || set.chat.captureTalk || set.chat.captureLines)
    createChat();

  if (!edset)
    edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
  if (edset.window.show)
    showCodeEditor(true);
  else if (!global.editorOnly && edset.window.persistent)
    createCodeEditor();

  for (name in set.windows) {
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

ipcMain.on('options-changed', (event, save) => {
  set = settings.Settings.load(global.settingsFile);
});

ipcMain.on('reload-options', (event, save) => {
  resetProfiles();
  closeWindows(save, true, true);
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
  if (winChat) {
    winChat.webContents.send('reload-options');
    if (winChat.setParentWindow)
      winChat.setParentWindow(set.chat.alwaysOnTopClient ? win : null);
    winChat.setAlwaysOnTop(set.chat.alwaysOnTop);
    winChat.setSkipTaskbar((set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false);
  }

  if (winProfiles)
    winProfiles.webContents.send('reload-options');
  if (winEditor)
    winEditor.webContents.send('reload-options');

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

ipcMain.on('set-title', (event, title) => {
  global.title = title;
  if (winChat)
    winChat.webContents.send('set-title', title);
  if (winProfiles)
    winProfiles.webContents.send('set-title', title);
  if (winEditor)
    winEditor.webContents.send('set-title', title);
  if (winMap)
    winMap.webContents.send('set-title', title);
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('set-title', title);
  }
  updateTray();
});

ipcMain.on('closed', (event) => {
  global.connected = false;
  if (winChat)
    winChat.webContents.send('closed');
  if (winProfiles)
    winProfiles.webContents.send('closed');
  if (winEditor)
    winEditor.webContents.send('closed');
  if (winMap)
    winMap.webContents.send('closed');
  if (winCode)
    winCode.webContents.send('closed');
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('closed');
  }
});

ipcMain.on('connected', (event) => {
  global.connected = true;
  if (winChat)
    winChat.webContents.send('connected');
  if (winProfiles)
    winProfiles.webContents.send('connected');
  if (winEditor)
    winEditor.webContents.send('connected');
  if (winMap)
    winMap.webContents.send('connected');
  if (winCode)
    winCode.webContents.send('connected');
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('connected');
  }
});

ipcMain.on('set-color', (event, type, color, code, window) => {
  if (winEditor)
    winEditor.webContents.send('set-color', type, color, code, window);
  if (winCode)
    winCode.webContents.send('set-color', type, color, code, window);
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.send('set-color', type, color, code, window);
  }
});

ipcMain.on('open-editor', (event, file, remote, remoteEdit) => {
  showCodeEditor();
  openEditor(file, remote, remoteEdit);
});

function openEditor(file, remote, remoteEdit) {
  console.log(file);
  console.log('CodeREady: ' + codeReady);
  if (!codeReady || !winCode) {
    setTimeout(() => {
      openEditor(file, remote, remoteEdit);
    }, 1000);
  }
  else {
    winCode.webContents.send('open-editor', file, remote, remoteEdit);
  }
}

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

ipcMain.on('send-editor', (event, text, window, show, args) => {
  if (show)
    showSelectedWindow(window, args);
  sendEditor(text, window);
});

function sendEditor(text, window) {
  if ((!codeReady || !winCode || !winCode.isVisible()) && window === 'code-editor') {
    setTimeout(() => {
      sendEditor(text, window);
    }, 1000);
  }
  else if ((!editorReady || !winEditor || !winEditor.isVisible()) && window === 'editor') {
    setTimeout(() => {
      sendEditor(text, window);
    }, 1000);
  }
  else {
    if (winEditor)
      winEditor.webContents.send('send-editor', text, window);
    if (winCode)
      winCode.webContents.send('send-editor', text, window);
    for (var name in windows) {
      if (!windows.hasOwnProperty(name) || !windows[name].window)
        continue;
      windows[name].window.webContents.send('send-editor', text, window);
    }
  }
}

ipcMain.on('log', (event, raw) => {
  console.log(raw);
});

ipcMain.on('log-error', (event, err, skipClient) => {
  logError(err, skipClient);
});

ipcMain.on('debug', (event, msg) => {
  if (win && win.webContents)
    win.webContents.send('debug', msg);
});

ipcMain.on('error', (event, err) => {
  if (win && win.webContents)
    win.webContents.send('error', err);
});

ipcMain.on('reload-mail', (event) => {
  createMenu();
  if (win && win.webContents)
    win.webContents.send('reload-mail');
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window || !windows[name].window.webContents)
      continue;
    windows[name].window.webContents.send('reload-mail');
  }
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

ipcMain.on('chat', (event, text) => {
  if (!winChat) {
    createChat();
    setTimeout(() => { winChat.webContents.send('chat', text); }, 100);
  }
  else if (!chatReady)
    setTimeout(() => { winChat.webContents.send('chat', text); }, 100);
  else
    winChat.webContents.send('chat', text);
  for (var name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
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

  if (data.type === "chat" && data.name === "alwaysOnTopClient") {
    if (winChat.setParentWindow)
      winChat.setParentWindow(data.value ? win : null);
    winChat.setSkipTaskbar((set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false);
  }
  if (data.type === "chat" && data.name === "setAlwaysOnTop") {
    winChat.setAlwaysOnTop(data.value);
    winChat.setSkipTaskbar((set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false);
  }
  if (data.type === "mapper" && data.name === "enabled" && !winMap && data.value)
    createMapper();
  if (!winChat && data.type === "chat" && (data.name === 'captureTells' || data.name === 'captureTalk' || data.name === 'captureLines')) {
    if (data.value)
      createChat();
  }
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

ipcMain.on('editor-setting-changed', (event, data) => {
  if (winCode)
    winCode.webContents.send('editor-setting-changed');
  if (winCode.setParentWindow)
    winCode.setParentWindow((!global.editorOnly && data.alwaysOnTopClient) ? win : null);
  winCode.setSkipTaskbar((!global.editorOnly && (data.alwaysOnTopClient || data.alwaysOnTop)) ? true : false);
  if (!global.editorOnly && data.persistent && !winCode)
    createCodeEditor();
});

ipcMain.on('editor-settings-saved', (event) => {
  edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
});

ipcMain.on('GMCP-received', (event, data) => {
  if (winMap)
    winMap.webContents.send('GMCP-received', data);
  if (winCode)
    winCode.webContents.send('GMCP-received', data);
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
  if (!win) return;
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
  else if (global.editorOnly && winCode)
    winCode.setProgressBar(args.value, args.options);
});

ipcMain.on('set-progress-window', (event, window, args) => {
  if (window == "mapper") {
    if (winMap)
      winMap.setProgressBar(args.value, args.options);
  }
  else if (window === 'code-editor') {
    if (winCode)
      winCode.setProgressBar(args.value, args.options);
  }
  else if (windows[window] && windows[window].window)
    windows[window].window.setProgressBar(args.value, args.options);
});

ipcMain.on('show-window', (event, window, args) => {
  showSelectedWindow(window, args);
});

function showSelectedWindow(window, args) {
  if (window === 'about')
    showAbout();
  else if (window === "prefs")
    showPrefs();
  else if (window === "mapper")
    showMapper();
  else if (window === "editor")
    showEditor();
  else if (window === "profiles")
    showProfiles();
  else if (window === "chat")
    showChat();
  else if (window === "color")
    showColor(args);
  else if (window === 'code-editor')
    showCodeEditor();
  else if (windows[window] && windows[window].window)
    showWindow(window, windows[window]);
  else
    createNewWindow(window, args);
}

ipcMain.on('import-map', (event, data) => {
  if (winMap)
    winMap.webContents.send('import', data);
  else if (data) {
    createMapper(false, false, () => { winMap.webContents.send('import', data); });
  }
});

ipcMain.on('flush', (event, sender) => {
  if (winMap)
    winMap.webContents.send('flush', sender);
  else if (win && win.webContents)
    win.webContents.send('flush-end', sender);
});

ipcMain.on('flush-end', (event, sender) => {
  if (win && win.webContents)
    win.webContents.send('flush-end', sender);
});

ipcMain.on('reload-characters', (event) => {
  loadCharacters(true);
  if (global.character)
    loadCharacter(global.character);
});

ipcMain.on('profile-item-added', (event, type, profile, item) => {
  if (winProfiles)
    winProfiles.webContents.send('profile-item-added', type, profile, item);
});

ipcMain.on('profile-item-removed', (event, type, profile, idx) => {
  if (winProfiles)
    winProfiles.webContents.send('profile-item-removed', type, profile, idx);
});

ipcMain.on('profile-toggled', (event, profile, enabled) => {
  if (winProfiles)
    winProfiles.webContents.send('profile-toggled', profile, enabled);
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
  if (!window || window.isDestroyed())
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
  if (!set)
    set = settings.Settings.load(global.settingsFile);
  if (window === 'code-editor') {
    if (!edset)
      edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
    if (global.editorOnly) {
      if (!edset.stateOnly)
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 600,
        };
      states[window] = {
        x: edset.stateOnly.x,
        y: edset.stateOnly.y,
        width: edset.stateOnly.width,
        height: edset.stateOnly.height,
      };
      return edset.stateOnly;
    }
    if (!edset.state)
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      };
    states[window] = {
      x: edset.state.x,
      y: edset.state.y,
      width: edset.state.width,
      height: edset.state.height,
    };
    return edset.state;
  }
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
  else if (!window.isMaximized()) {
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
  var b;
  if (win)
    b = win.getBounds();
  else
    b = { x: 0, y: 0, height: 600, width: 800 };

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

function createMapper(show, loading, loaded) {
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

  winMap.on('closed', (e) => {
    if (e.sender === winMap) {
      if (!winMap.isDestroyed() && !winMap.isVisible())
        winMap.webContents.executeJavaScript('closeHidden()');
      winMap = null;
    }
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
    loadWindowScripts(winMap, "map");
    addInputContext(winMap);
    if (show) {
      if (s.maximized)
        winMap.maximize();
      winMap.show();
    }
    else
      mapperMax = s.maximized;
    if (loading) {
      clearTimeout(loadid);
      loadid = setTimeout(() => { win.focus(); }, 500);
    }
    if (loaded)
      loaded();
  });

  winMap.on('close', (e) => {
    set = settings.Settings.load(global.settingsFile);
    if (win != null && winMap === e.sender)
      set.showMapper = false;
    set.windows['mapper'] = getWindowState('mapper', e.sender);
    set.save(global.settingsFile);
    if (winMap === e.sender && winMap && (set.mapper.enabled || set.mapper.persistent)) {
      e.preventDefault();
      winMap.webContents.executeJavaScript('closeHidden()');
      winMap.hide();
    }
  });
}

function showMapper(loading) {
  set = settings.Settings.load(global.settingsFile);
  set.showMapper = true;
  set.save(global.settingsFile);
  if (winMap != null) {
    if (mapperMax)
      winMap.maximize();
    winMap.show();
    mapperMax = false;
    if (loading) {
      clearTimeout(loadid);
      loadid = setTimeout(() => { win.focus(); }, 500);
    }
  }
  else
    createMapper(true, loading);
}

function showProfiles() {
  if (winProfiles != null) {
    winProfiles.show();
    return;
  }
  var s = loadWindowState('profiles');
  winProfiles = new BrowserWindow({
    parent: win,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    movable: true,
    minimizable: true,
    maximizable: true,
    skipTaskbar: true,
    resizable: true,
    title: 'Profile Manger',
    icon: path.join(__dirname, '../assets/icons/png/profiles.png'),
    show: false
  });

  winProfiles.webContents.on('crashed', (event, killed) => {
    logError(`Profile manager crashed, killed: ${killed}\n`, true);
  });

  if (s.fullscreen)
    winProfiles.setFullScreen(s.fullscreen);

  if (global.debug)
    winProfiles.webContents.openDevTools();

  winProfiles.setMenu(null);
  winProfiles.on('closed', () => {
    winProfiles = null;
  });
  winProfiles.loadURL(url.format({
    pathname: path.join(__dirname, 'profiles.html'),
    protocol: 'file:',
    slashes: true
  }));
  winProfiles.once('ready-to-show', () => {
    loadWindowScripts(winProfiles, "profiles");
    //addInputContext(winProfiles);
    if (s.maximized)
      winProfiles.maximize();
    winProfiles.show();
  });

  winProfiles.on('close', (e) => {
    set = settings.Settings.load(global.settingsFile);
    set.windows['profiles'] = getWindowState('profiles', winProfiles);
    set.save(global.settingsFile);
  });

  winProfiles.on('resize', () => {
    if (!winProfiles.isMaximized() && !winProfiles.isFullScreen())
      trackWindowState('profiles', winProfiles);
  });

  winProfiles.on('move', () => {
    trackWindowState('profiles', winProfiles);
  });

  winProfiles.on('maximize', () => {
    trackWindowState('profiles', winProfiles);
    states['profiles'].maximized = true;
  });

  winProfiles.on('unmaximize', () => {
    trackWindowState('profiles', winProfiles);
    states['profiles'].maximized = false;
  });

}

function createEditor(show, loading) {
  if (winEditor) return;
  var s = loadWindowState('editor');
  winEditor = new BrowserWindow({
    parent: global.editorOnly ? winCode : win,
    title: 'Advanced Editor',
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: '#000',
    show: false,
    skipTaskbar: false,
    icon: path.join(__dirname, '../assets/icons/png/edit.png')
  });

  winEditor.webContents.on('crashed', (event, killed) => {
    logError(`Advanced editor crashed, killed: ${killed}\n`, true);
  });

  if (s.fullscreen)
    winEditor.setFullScreen(s.fullscreen);

  winEditor.setMenu(null);
  winEditor.loadURL(url.format({
    pathname: path.join(__dirname, 'editor.html'),
    protocol: 'file:',
    slashes: true
  }));

  winEditor.on('closed', (e) => {
    if (e.sender !== winEditor) return;
    winEditor = null;
    editorReady = false;
  });

  winEditor.on('resize', () => {
    if (!winEditor.isMaximized() && !winEditor.isFullScreen())
      trackWindowState('editor', winEditor);
  });

  winEditor.on('move', () => {
    trackWindowState('editor', winEditor);
  });

  winEditor.on('maximize', () => {
    trackWindowState('editor', winEditor);
    states['editor'].maximized = true;
  });

  winEditor.on('unmaximize', () => {
    trackWindowState('editor', winEditor);
    states['editor'].maximized = false;
  });

  if (global.debug)
    winEditor.webContents.openDevTools();

  winEditor.once('ready-to-show', () => {
    loadWindowScripts(winEditor, 'editor');
    addInputContext(winEditor);
    if (show) {
      if (s.maximized)
        winEditor.maximize();
      winEditor.show();
    }
    else
      editorMax = s.maximized;
    if (loading) {
      clearTimeout(loadid);
      loadid = setTimeout(() => { win.focus(); }, 500);
    }
    editorReady = true;
  });

  winEditor.on('close', (e) => {
    set = settings.Settings.load(global.settingsFile);
    set.showEditor = false;
    set.windows['editor'] = getWindowState('editor', winEditor || e.sender);
    set.save(global.settingsFile);
    e.sender.webContents.executeJavaScript('tinymce.activeEditor.setContent(\'\');');
    if (winEditor === e.sender && winEditor && (set.editorPersistent && !global.editorOnly)) {
      e.preventDefault();
      winEditor.webContents.executeJavaScript('closeHidden()');
      winEditor.hide();
    }
  });
}

function showEditor(loading) {
  set = settings.Settings.load(global.settingsFile);
  set.showEditor = true;
  set.save(global.settingsFile);
  if (winEditor != null) {
    if (editorMax)
      winEditor.maximize();
    winEditor.show();
    editorMax = false;
    if (loading) {
      clearTimeout(loadid);
      loadid = setTimeout(() => { win.focus(); }, 500);
    }
  }
  else
    createEditor(true, loading);
}

function createChat(show, loading) {
  if (winChat) return;
  var s = loadWindowState('chat');
  winChat = new BrowserWindow({
    parent: set.chat.alwaysOnTopClient ? win : null,
    title: 'Chat',
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: '#000',
    show: false,
    skipTaskbar: (set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false,
    icon: path.join(__dirname, '../assets/icons/png/chat.png'),
    webPreferences: {
      nodeIntegrationInWorker: true
    }
  });

  winChat.webContents.on('crashed', (event, killed) => {
    logError(`Chat capture crashed, killed: ${killed}\n`, true);
  });

  if (s.fullscreen)
    winChat.setFullScreen(s.fullscreen);

  winChat.setMenu(null);
  winChat.loadURL(url.format({
    pathname: path.join(__dirname, 'chat.html'),
    protocol: 'file:',
    slashes: true
  }));

  winChat.on('closed', (e) => {
    if (e.sender !== winChat) return;
    winChat = null;
    chatReady = false;
  });

  winChat.on('resize', () => {
    if (!winChat.isMaximized() && !winChat.isFullScreen())
      trackWindowState('chat', winChat);
  });

  winChat.on('move', () => {
    trackWindowState('chat', winChat);
  });

  winChat.on('maximize', () => {
    trackWindowState('chat', winChat);
    states['chat'].maximized = true;
  });

  winChat.on('unmaximize', () => {
    trackWindowState('chat', winChat);
    states['chat'].maximized = false;
  });

  if (global.debug)
    winChat.webContents.openDevTools();

  winChat.once('ready-to-show', () => {
    loadWindowScripts(winChat, 'chat');
    addInputContext(winChat);
    if (show) {
      if (s.maximized)
        winChat.maximize();
      winChat.show();
    }
    else
      chatMax = s.maximized;
    chatReady = true;
    if (loading) {
      clearTimeout(loadid);
      loadid = setTimeout(() => { win.focus(); }, 500);
    }
  });

  winChat.on('close', (e) => {
    set = settings.Settings.load(global.settingsFile);
    if (winChat === e.sender)
      set.showChat = false;
    set.windows['chat'] = getWindowState('chat', e.sender);
    set.save(global.settingsFile);
    if (winChat === e.sender && winChat && (set.chat.persistent || set.chat.captureTells || set.chat.captureTalk || set.chat.captureLines)) {
      e.preventDefault();
      winChat.webContents.executeJavaScript('closeHidden()');
      winChat.hide();
    }
  });
}

function showChat(loading) {
  set = settings.Settings.load(global.settingsFile);
  set.showChat = true;
  set.save(global.settingsFile);
  if (winChat != null) {
    if (chatMax)
      winChat.maximize();
    winChat.show();
    chatMax = false;
    if (loading) {
      clearTimeout(loadid);
      loadid = setTimeout(() => { win.focus(); }, 500);
    }
  }
  else
    createChat(true, loading);
}

function createNewWindow(name, options) {
  if (windows[name] && windows[name].window)
    return;
  if (!options) options = {};
  var s = loadWindowState(name);
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

  windows[name].window.on('closed', (e) => {
    if (!windows || !windows[name] || e.sender !== windows[name].window) return;
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
      loadWindowScripts(w, frameName);
      addInputContext(w);
      w.show();
    });
    w.webContents.on('crashed', (event, killed) => {
      logError(`${url} crashed, killed: ${killed}\n`, true);
    });

    w.on('close', () => {
      if (w && w.getParentWindow()) {
        w.getParentWindow().webContents.executeJavaScript(`childClosed('${url}', '${frameName}');`);
      }
    });

    w.loadURL(url);
    event.newGuest = w;
  });

  if (global.debug)
    windows[name].window.webContents.openDevTools();

  windows[name].window.once('ready-to-show', () => {
    loadWindowScripts(windows[name].window, name);
    if (!options.noInput)
      addInputContext(windows[name].window);
    if (options.show) {
      if (s.maximized)
        windows[name].window.maximize();
      windows[name].window.show();
    }
    else
      windows[name].max = s.maximized;
    windows[name].ready = true;
  });

  windows[name].window.on('close', (e) => {
    set = settings.Settings.load(global.settingsFile);
    set.windows[name] = getWindowState(name, e.sender);
    if (windows[name].window === e.sender)
      windows[name].show = false;
    set.windows[name].options = copyWindowOptions(name);
    set.save(global.settingsFile);
    if (windows[name].window === e.sender && windows[name].window && windows[name].persistent) {
      e.preventDefault();
      windows[name].window.webContents.executeJavaScript('closeHidden()');
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
    windows[name].window.show();
    windows[name].max = false;
  }
  else
    createNewWindow(name, options);
}

function showColor(args) {
  var w;
  if (windows[args.window])
    w = windows[args.window].window;
  else
    w = winEditor || win;
  let cp = new BrowserWindow({
    parent: w,
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
    cp.webContents.executeJavaScript('setType("' + (args.type || 'forecolor') + '");setColor("' + (args.color || '') + '");setWindow("' + (args.window || '') + '");');
  });
}

function copyFile(src, dest) {

  let readStream = fs.createReadStream(src);

  readStream.once('error', (err) => {
    console.error(err);
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
        console.error('Could not load: \'characters.json\'');
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
  if (!set)
    set = settings.Settings.load(global.settingsFile);
  if (err.stack && set.showErrorsExtended)
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
  else if (set.logErrors) {
    if (err.stack && !set.showErrorsExtended)
      msg = err.stack;
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

function loadWindowScripts(window, name) {
  if (!window || !name) return;
  if (isFileSync(path.join(app.getPath('userData'), name + '.css'))) {
    fs.readFile(path.join(app.getPath('userData'), '.css'), 'utf8', (err, data) => {
      window.webContents.insertCSS(parseTemplate(data));
    });
  }
  if (isFileSync(path.join(app.getPath('userData'), '.js'))) {
    fs.readFile(path.join(app.getPath('userData'), '.js'), 'utf8', (err, data) => {
      window.webContents.executeJavaScript(data);
    });
  }
}

function closeWindows(save, clear, force) {
  if (!set)
    set = settings.Settings.load(global.settingsFile);
  var name;
  var cWin;
  var ce = false;
  for (name in windows) {
    if (!windows.hasOwnProperty(name) || !windows[name].window)
      continue;
    windows[name].window.webContents.executeJavaScript('closing();');
    windows[name].window.webContents.executeJavaScript('closed();');
    set.windows[name] = getWindowState(name, windows[name].window);
    set.windows[name].options = copyWindowOptions(name);
    cWin = windows[name].window;
    windows[name].window = null;
    cWin.close();
  }
  if (clear)
    windows = {};
  if (save)
    set.save(global.settingsFile);
}

function createCodeEditor(show, loading, loaded) {
  if (winCode) return;
  if (!edset)
    edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
  var s = loadWindowState('code-editor');
  if (global.editorOnly) {
    if (!edset.stateOnly)
      edset.stateOnly = {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      };
    states['code-editor'] = edset.stateOnly;
  }
  else {
    if (!edset.state)
      edset.state = {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      };
    states['code-editor'] = edset.state;
  }
  winCode = new BrowserWindow({
    parent: (!global.editorOnly && edset.window.alwaysOnTopClient) ? win : null,
    alwaysOnTop: edset.window.alwaysOnTop,
    title: 'Code editor',
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: 'grey',
    show: false,
    skipTaskbar: (!global.editorOnly && (edset.window.alwaysOnTopClient || edset.window.alwaysOnTop)) ? true : false,
    icon: path.join(__dirname, '../assets/icons/win/code.ico')
  });

  if (s.fullscreen)
    winCode.setFullScreen(s.fullscreen);
  winCode.setMenu(null);
  winCode.loadURL(url.format({
    pathname: path.join(__dirname, 'code.editor.html'),
    protocol: 'file:',
    slashes: true
  }));

  winCode.webContents.on('crashed', (event, killed) => {
    logError(`Code editor crashed, killed: ${killed}\n`, true);
  });

  winCode.on('closed', (e) => {
    if (e.sender !== winCode) return;
    winCode = null;
    codeReady = false;
  });

  winCode.on('resize', () => {
    if (!winCode.isMaximized() && !winCode.isFullScreen())
      trackWindowState('code-editor', winCode);
  });

  winCode.on('move', () => {
    trackWindowState('code-editor', winCode);
  });

  winCode.on('maximize', () => {
    trackWindowState('code-editor', winCode);
    states['code-editor'].maximized = true;
  });

  winCode.on('unmaximize', () => {
    trackWindowState('code-editor', winCode);
    states['code-editor'].maximized = false;
  });

  if (global.debug)
    winCode.webContents.openDevTools();

  winCode.once('ready-to-show', () => {
    loadWindowScripts(winCode, "code.editor");
    addInputContext(winCode);
    if (show) {
      if (s.maximized)
        winCode.maximize();
      winCode.show();
    }
    else
      codeMax = s.maximized;
    if (loading) {
      clearTimeout(loadid);
      if (!global.editorOnly)
        loadid = setTimeout(() => { win.focus(); }, 500);
    }
    if (loaded)
      loaded();
    codeReady = true;
    if (global.editorOnly) {
      updateJumpList();
      checkForUpdates();
    }
  });

  winCode.on('close', (e) => {
    //force a reload to make sure newest settings are saved
    edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
    if (!global.editorOnly) {
      if (winCode && winCode.getParentWindow() == win)
        edset.window.show = false;
      else if (winCode != null)
        edset.window.show = true;
      edset.state = getWindowState('code-editor', winCode);
    }
    else
      edset.stateOnly = getWindowState('code-editor', winCode || e.sender);
    edset.save(parseTemplate(path.join('{data}', 'editor.json')));
    if (winCode === e.sender && winCode && !global.editorOnly && edset.window.persistent) {
      e.preventDefault();
      winCode.webContents.executeJavaScript('closeHidden()');
    }
  });

  winCode.webContents.on('new-window', (event, URL, frameName, disposition, options, additionalFeatures) => {
    event.preventDefault();
    var u = new url.URL(URL);
    if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
      shell.openExternal(URL);
      return;
    }
    if (frameName === 'modal') {
      // open window as modal
      Object.assign(options, {
        modal: true,
        parent: winCode,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        resizable: false
      });

      var b = winCode.getBounds();
      options.x = Math.floor(b.x + b.width / 2 - options.width / 2);
      options.y = Math.floor(b.y + b.height / 2 - options.height / 2);
    }
    options.show = false;
    const w = new BrowserWindow(options);
    if (global.debug)
      w.webContents.openDevTools();
    w.setMenu(null);
    w.once('ready-to-show', () => {
      loadWindowScripts(w, frameName);
      addInputContext(w);
      w.show();
    });
    w.webContents.on('crashed', (event, killed) => {
      logError(`${URL} crashed, killed: ${killed}\n`, true);
    });

    w.on('close', () => {
      if (w && w.getParentWindow()) {
        w.getParentWindow().webContents.executeJavaScript(`childClosed('${URL}', '${frameName}');`);
      }
    });
    w.loadURL(URL);
    event.newGuest = w;
  });
}

function showCodeEditor(loading) {
  if (!edset)
    edset = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
  if (!global.editorOnly)
    edset.window.show = true;
  edset.save(parseTemplate(path.join('{data}', 'editor.json')));
  if (winCode != null) {
    if(!codeReady)
      return;
    if (codeMax)
      winCode.maximize();
    winCode.show();
    codeMax = false;
    if (loading) {
      clearTimeout(loadid);
      loadid = setTimeout(() => { win.focus(); }, 500);
    }
  }
  else
    createCodeEditor(true, loading);
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
        title: "New Code Editor",
        description: "Opens a new code editor",
        program: process.execPath,
        args: '-eo', // force editor only mode
        iconPath: process.execPath,
        iconIndex: 0
      }
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

function createUpdater() {
  const autoUpdater = require("electron-updater").autoUpdater;
  autoUpdater.on('download-progress', progressObj => {
    if (win) {
      win.setProgressBar(progressObj.percent);
      win.webContents.send('update-progress', progressObj);
    }
    else if (global.editorOnly && winCode) {
      winCode.setProgressBar(progressObj.percent);
      winCode.webContents.send('update-progress', progressObj);
    }
  });
  return autoUpdater;
}

function checkForUpdates() {
  if (!set)
    set = settings.Settings.load(global.settingsFile);
  if (set.checkForUpdates) {
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
    });
    autoUpdater.checkForUpdatesAndNotify();
  }
}

function checkForUpdatesManual() {
  const autoUpdater = createUpdater();
  autoUpdater.autoDownload = false;
  autoUpdater.on('error', (error) => {
    dialog.showErrorBox('Error: ', error == null ? "unknown" : (error.stack || error).toString());
  });

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox(global.editorOnly ? winCode : win, {
      type: 'info',
      title: 'Found Updates',
      message: 'Found updates, do you want update now?',
      buttons: ['Yes', 'No', 'Open website']
    }, (buttonIndex) => {
      if (buttonIndex === 0)
        autoUpdater.downloadUpdate();
      else {
        if (buttonIndex === 2)
          shell.openExternal("https://github.com/icewolfz/jiMUD/releases/latest", '_blank');
        if (global.editorOnly)
          winCode.webContents.send('update-menu', 'help|check for updates...', { enabled: true });
        else
          updateMenuItem({ menu: ['help', 'updater'], enabled: true });
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    dialog.showMessageBox(global.editorOnly ? winCode : win, {
      title: 'No Updates',
      message: 'Current version is up-to-date.',
      buttons: ['Ok', 'Open website']
    }, (buttonIndex) => {
      if (buttonIndex === 0)
        shell.openExternal("https://github.com/icewolfz/jiMUD/releases/latest", '_blank');
      if (global.editorOnly)
        winCode.webContents.send('update-menu', 'help|check for updates...', { enabled: true });
      else
        updateMenuItem({ menu: ['help', 'updater'], enabled: true });
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(global.editorOnly ? winCode : win, {
      title: 'Install Updates',
      message: 'Updates downloaded, application will be quit for update...'
    }, () => {
      setImmediate(() => autoUpdater.quitAndInstall());
    });
  });
  if (global.editorOnly) {
    winCode.webContents.send('update-menu', 'help|check for updates...', { enabled: false });
    winCode.setProgressBar(-1);
    winCode.webContents.send('update-downloaded');
  }
  else {
    updateMenuItem({ menu: ['help', 'updater'], enabled: false });
    win.setProgressBar(-1);
    win.webContents.send('update-downloaded');
  }
  autoUpdater.checkForUpdates();
}

function showAbout() {
  var b;

  if (global.editorOnly)
    b = winCode.getBounds();
  else
    b = win.getBounds();

  let about = new BrowserWindow({
    parent: global.editorOnly ? winCode : win,
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