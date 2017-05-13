//cSpell:words submenu, pasteandmatchstyle, statusvisible, lagmeter, taskbar, 
//cSpell:ignore prefs, partyhealth, combathealth
const { app, BrowserWindow, shell } = require('electron')
const { dialog, Menu, MenuItem } = require('electron')
const ipcMain = require('electron').ipcMain
const path = require('path')
const fs = require('fs');
const url = require('url')
const settings = require('./js/settings');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win, winHelp, winWho, winMap, winProfiles, winEditor, winChat
let set, mapperMax = false, editorMax = false, chatMax = false, debug = false;
let chatReady = false;

let windows = {};

let states = {
  'main': { x: 0, y: 0, width: 800, height: 600 },
  'help': { x: 0, y: 0, width: 800, height: 600 },
  'mapper': { x: 0, y: 0, width: 800, height: 600 },
  'profiles': { x: 0, y: 0, width: 800, height: 600 },
  'editor': { x: 0, y: 0, width: 300, height: 225 },
  'chat': { x: 0, y: 0, width: 300, height: 225 },
};

process.argv.forEach((val, index) => {
  switch (val) {
    case "-debug":
    case "--debug":
    case "-d":
    case "--d":
      debug = true;
      break;
  }
});

var menuTemp = [
  //File
  {
    label: '&File',
    id: 'file',
    submenu: [
      {
        label: "&Connect",
        id: "connect",
        accelerator: "Ctrl+N",
        click: () => {
          win.webContents.executeJavaScript('client.connect()');
        }
      },
      {
        label: "&Disconnect",
        id: "disconnect",
        accelerator: "Ctrl+D",
        enabled: false,
        click: () => {
          win.webContents.executeJavaScript('client.close()');
        }
      },
      {
        type: 'separator'
      },
      {
        label: '&Log',
        id: "log",
        type: 'checkbox',
        checked: false
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
        role: 'paste'
      },
      {
        role: 'pasteandmatchstyle'
      },
      {
        role: 'delete'
      },
      {
        label: 'Select All',
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
      }
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
        click: showEditor,
        accelerator: 'CmdOrCtrl+A'
      },
      {
        label: '&Chat...',
        id: 'chat',
        click: showChat,
        accelerator: 'CmdOrCtrl+L'
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
        label: '&About...',
        click: () => {
          let about = new BrowserWindow({
            parent: win,
            modal: true,
            width: 440,
            height: 390,
            movable: false,
            minimizable: false,
            maximizable: false,
            skipTaskbar: true,
            resizable: false,
            title: 'About jiMUD',
            icon: path.join(__dirname, '../assets/icons/png/app.png')
          })
          about.setMenu(null);
          about.on('closed', () => {
            about = null
          })

          // and load the index.html of the app.
          about.loadURL(url.format({
            pathname: path.join(__dirname, 'about.html'),
            protocol: 'file:',
            slashes: true
          }))

          about.once('ready-to-show', () => {
            about.show()
          })
        }
      }
    ]
  }
]

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
  })
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
  )
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
  ]
}

let menubar;

const selectionMenu = Menu.buildFromTemplate([
  { role: 'copy' },
  { type: 'separator' },
  { role: 'selectall' },
])

const inputMenu = Menu.buildFromTemplate([
  { role: 'undo' },
  { role: 'redo' },
  { type: 'separator' },
  { role: 'cut' },
  { role: 'copy' },
  { role: 'paste' },
  { type: 'separator' },
  { role: 'selectall' },
])

function addInputContext(window) {
  window.webContents.on('context-menu', (e, props) => {
    const { selectionText, isEditable } = props;
    if (isEditable) {
      inputMenu.popup(window);
    } else if (selectionText && selectionText.trim() !== '') {
      selectionMenu.popup(window);
    }
  })
}

function showHelpWindow(url, title) {
  if (winHelp != null) {
    winHelp.title = title;
    winHelp.loadURL(url);
    winHelp.show();
    return;
  }
  s = loadWindowState('help')
  if (!title || title.length == 0)
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
  })

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
  })

  winHelp.on('move', () => {
    trackWindowState('help', winHelp);
  })


  winHelp.on('unmaximize', () => {
    trackWindowState('help', winHelp);
  })



  if (s.devTools)
    winHelp.webContents.openDevTools()

  winHelp.once('ready-to-show', () => {
    addInputContext(winHelp);
    if (url != null && url.length != 0) {
      if (s.maximized)
        winHelp.maximize();
      else
        winHelp.show()
    }
  })

  winHelp.on('close', () => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.windows['help'] = getWindowState('help', winHelp);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
  })
}

function createMenu() {
  var profiles;
  for (var m = 0; m < menuTemp.length; m++) {
    if (menuTemp[m].id == "profiles") {
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
    })

  var p = path.join(app.getPath('userData'), "profiles");
  if (fs.existsSync(p)) {
    var files = fs.readdirSync(p);
    for (var i = 0; i < files.length; i++) {
      if (path.extname(files[i]) === ".json") {
        if (files[i].toLowerCase() == "default.json")
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
          })
      }
    }
  }
  else {
    profiles.submenu.push(
      {
        label: "Default",
        type: 'checkbox',
        checked: false,
        id: "default.json",
        click: (menuItem, browserWindow, event) => {
          win.webContents.executeJavaScript('client.toggleProfile("' + menuItem.label.toLowerCase() + '")');
        }
      })
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

function createWindow() {
  s = loadWindowState('main');
  // Create the browser window.
  win = new BrowserWindow({
    title: 'jiMUD',
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: '#000',
    show: false,
    icon: path.join(__dirname, '../assets/icons/png/app.png')
  })
  if (s.fullscreen)
    win.setFullScreen(s.fullscreen);
  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  createMenu();
  loadMenu();
  //win.setOverlayIcon(path.join(__dirname, '/../assets/icons/jimud.png'), 'Connected');

  // Open the DevTools.
  if (s.devTools)
    win.webContents.openDevTools()

  win.on('resize', () => {
    if (!win.isMaximized() && !win.isFullScreen())
      trackWindowState('main', win);
  })

  win.on('move', () => {
    trackWindowState('main', win);
  })

  win.on('unmaximize', () => {
    trackWindowState('main', win);
  })


  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    if (winMap)
      winMap.webContents.executeJavaScript('save();');
    win = null;
  })

  win.once('ready-to-show', () => {
    addInputContext(win);
    if (fs.existsSync(path.join(app.getPath('userData'), "monsters.css"))) {
      fs.readFile(path.join(app.getPath('userData'), "monsters.css"), 'utf8', (err, data) => {
        win.webContents.insertCSS(parseTemplate(data));
      });
    }
    if (fs.existsSync(path.join(app.getPath('userData'), "user.css"))) {
      fs.readFile(path.join(app.getPath('userData'), "user.css"), 'utf8', (err, data) => {
        win.webContents.insertCSS(parseTemplate(data));
      });
    }
    if (fs.existsSync(path.join(app.getPath('userData'), "user.js"))) {
      fs.readFile(path.join(app.getPath('userData'), "user.js"), 'utf8', (err, data) => {
        win.webContents.executeJavaScript(data);
      });
    }
    if (s.maximized)
      win.maximize();
    else
      win.show()

    if (set.showMapper)
      showMapper();
    else if (set.mapper.enabled)
      createMapper();

    if (set.showEditor)
      showEditor();
    //else
    //createEditor();
    if (set.showChat)
      showChat();
    else if (set.chat.captureTells || set.chat.captureTalk || set.chat.captureLines)
      createChat();
  })

  win.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.windows['main'] = getWindowState('main', win);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
    if (winMap)
      winMap.webContents.executeJavaScript('save();');
    if (winProfiles) {
      e.preventDefault();
      dialog.showMessageBox(winProfiles, {
        type: 'warning',
        title: 'Close profile manager',
        message: 'You must close the profile manager before you can exit.'
      });
    }
  })

  if (!set)
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

ipcMain.on('reload-options', () => {
  win.webContents.send('reload-options');
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
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

  for (var name in windows) {
    if (!windows[r].hasOwnProperty(name) && windows[name].window)
      continue;
    windows[name].window.webContents.send('reload-options');
  }
});

ipcMain.on('set-title', (event, title) => {
  if (winChat)
    winChat.webContents.send('set-title', title);
  if (winProfiles)
    winProfiles.webContents.send('set-title', title);
  if (winEditor)
    winEditor.webContents.send('set-title', title);
  if (winMap)
    winMap.webContents.send('set-title', title);
  for (var name in windows) {
    if (!windows[r].hasOwnProperty(name) && windows[name].window)
      continue;
    windows[name].window.webContents.send('set-title', title);
  }
})

ipcMain.on('closed', (event) => {
  if (winChat)
    winChat.webContents.send('closed');
  if (winProfiles)
    winProfiles.webContents.send('closed');
  if (winEditor)
    winEditor.webContents.send('closed');
  if (winMap)
    winMap.webContents.send('closed');
  for (var name in windows) {
    if (!windows[r].hasOwnProperty(name) && windows[name].window)
      continue;
    windows[name].window.webContents.send('closed');
  }
})

ipcMain.on('connected', (event) => {
  if (winChat)
    winChat.webContents.send('connected');
  if (winProfiles)
    winProfiles.webContents.send('connected');
  if (winEditor)
    winEditor.webContents.send('connected');
  if (winMap)
    winMap.webContents.send('connected');
  for (var name in windows) {
    if (!windows[r].hasOwnProperty(name) && windows[name].window)
      continue;
    windows[name].window.webContents.send('connected');
  }
})


ipcMain.on('send-background', (event, command) => {
  win.webContents.send('send-background', command);
})

ipcMain.on('send-command', (event, command) => {
  win.webContents.send('send-command', command);
})

ipcMain.on('send-raw', (event, raw) => {
  win.webContents.send('send-raw', raw);
})

ipcMain.on('send', (event, raw) => {
  win.webContents.send('send', raw);
})

ipcMain.on('log', (event, raw) => {
  console.log(raw);
})

ipcMain.on('debug', (event, msg) => {
  win.webContents.send('send', msg);
})

ipcMain.on('reload-profiles', (event) => {
  createMenu();
  win.webContents.send('reload-profiles');
  for (var name in windows) {
    if (!windows[r].hasOwnProperty(name) && windows[name].window)
      continue;
    windows[name].window.webContents.send('reload-profiles');
  }
})

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
    if (!windows[r].hasOwnProperty(name) && windows[name].window)
      continue;
    windows[name].window.webContents.send('chat', titexttle);
  }
})

ipcMain.on('setting-changed', (event, data) => {
  if (data.type == "mapper" && data.name == "alwaysOnTopClient") {
    winMap.setParentWindow(data.value ? win : null);
    winMap.setSkipTaskbar((set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop) ? true : false);
  }
  if (data.type == "mapper" && data.name == "setAlwaysOnTop") {
    winMap.setAlwaysOnTop(data.value);
    winMap.setSkipTaskbar((set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop) ? true : false);
  }
  if (win && event.sender != win.webContents)
    win.webContents.send('setting-changed', data);
  if (winMap && event.sender != winMap.webContents)
    winMap.webContents.send('setting-changed', data);

  if (data.type == "chat" && data.name == "alwaysOnTopClient") {
    winChat.setParentWindow(data.value ? win : null);
    winChat.setSkipTaskbar((set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false);
  }
  if (data.type == "chat" && data.name == "setAlwaysOnTop") {
    winChat.setAlwaysOnTop(data.value);
    winChat.setSkipTaskbar((set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false);
  }
  if (data.type == "mapper" && data.name == "enabled" && !winMap && data.value)
    createMapper();
  if (!winChat && data.type == "chat" && (data.name == 'captureTells' || data.name == 'captureTalk' || data.name == 'captureLines')) {
    if (data.value)
      createChat();
  }
  for (var name in windows) {
    if (!windows[r].hasOwnProperty(name) && windows[name].window)
      continue;
    windows[name].window.setSkipTaskbar((set.windows[name].alwaysOnTopClient || set.windows[name].alwaysOnTop) ? true : false);
    if (windows[name].cache)
      createNewWindow(name);
  }
})

ipcMain.on('GMCP-received', (event, data) => {
  if (winMap)
    winMap.webContents.send('GMCP-received', data);
  for (var name in windows) {
    if (!windows[r].hasOwnProperty(name) && windows[name].window)
      continue;
    windows[name].window.webContents.send('GMCP-received', data);
  }
});

ipcMain.on('update-menuitem', (event, args) => {
  updateMenuItem(args);
});

ipcMain.on('set-overlay', (event, args) => {
  switch (args) {
    case 1:
      win.setOverlayIcon(path.join(__dirname, '../assets/icons/png/connected.png'), 'Connected')
      break;
    case 2:
      win.setOverlayIcon(path.join(__dirname, '../assets/icons/png/connectednonactive.png'), 'Received text')
      break;
    default:
      win.setOverlayIcon(path.join(__dirname, '../assets/icons/png/disconnected.png'), 'Disconnected')
      break;
  }
});

ipcMain.on('set-progress', (event, args) => {
  win.setProgressBar(args.value, args.options);
});

ipcMain.on('show-window', (event, window) => {
  if (window == "prefs")
    showPrefs();
  else if (window == "mapper")
    showMapper();
  else if (window == "editor")
    showEditor();
  else if (window == "profiles")
    showProfiles();
  else if (window == "chat")
    showChat();
  if (windows[window] && windows[window].window)
    showWindow(window, windows[window]);
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
  if (winMap)
    win.webContents.send('flush-end');
});

function updateMenuItem(args) {
  var item, i = 0, ic, items;
  var tItem, tItems;
  if (!menubar || args == null || args.menu == null) return;

  if (!Array.isArray(args.menu))
    args.menu = args.menu.split('|');

  items = menubar.items;
  tItems = menuTemp;
  for (i = 0; i < args.menu.length; i++) {
    if (!items || items.length == 0) break;
    for (m = 0; m < items.length; m++) {
      if (!items[m].id) continue;
      if (items[m].id == args.menu[i]) {
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
    item.enabled = args.enabled;
  if (args.checked != null)
    item.checked = args.checked;
  if (args.icon != null)
    item.icon = args.icon;
  if (args.visible != null)
    item.visible = args.visible;
  if (args.position != null)
    item.position = args.position;

  tItem.enabled = item.enabled;
  tItem.checked = item.checked;
  tItem.icon = item.icon;
  tItem.visible = item.visible;
  tItem.position = item.position;
}

function loadMenu() {
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  updateMenuItem({ menu: ['view', 'status', 'visible'], checked: set.showStatus });
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
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  if (!set.windows || !set.windows[window])
    return {
      x: 0,
      y: 0,
      width: 800,
      height: 600
    }
  states[window] = {
    x: set.windows[window].x,
    y: set.windows[window].y,
    width: set.windows[window].width,
    height: set.windows[window].height
  }
  return set.windows[window];
}

function trackWindowState(id, window) {
  var bounds = window.getBounds();
  states[id] = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

function parseTemplate(str, data) {
  str = str.replace(/{home}/g, "file://" + app.getPath('home').replace(/\\/g, "/"));
  str = str.replace(/{path}/g, "file://" + app.getAppPath().replace(/\\/g, "/"));
  str = str.replace(/{appData}/g, "file://" + app.getPath('appData').replace(/\\/g, "/"));
  str = str.replace(/{data}/g, "file://" + app.getPath('userData').replace(/\\/g, "/"));
  str = str.replace(/{temp}/g, "file://" + app.getPath('temp').replace(/\\/g, "/"));
  str = str.replace(/{desktop}/g, "file://" + app.getPath('desktop').replace(/\\/g, "/"));
  str = str.replace(/{documents}/g, "file://" + app.getPath('documents').replace(/\\/g, "/"));
  str = str.replace(/{downloads}/g, "file://" + app.getPath('downloads').replace(/\\/g, "/"));
  str = str.replace(/{music}/g, "file://" + app.getPath('music').replace(/\\/g, "/"));
  str = str.replace(/{pictures}/g, "file://" + app.getPath('pictures').replace(/\\/g, "/"));
  str = str.replace(/{videos}/g, "file://" + app.getPath('videos').replace(/\\/g, "/"));
  str = str.replace(/{assets}/g, "./../assets/");
  if (data) {
    var keys = Object.keys(data);
    for (var key in keys) {
      var regex = new RegExp("{}" + key + "}", "g");
      str = str.replace(regex, data[key]);
    }
  }
  return str;
}

function showPrefs() {
  let pref = new BrowserWindow({
    parent: win,
    modal: true,
    width: 800,
    height: 400,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    resizable: false,
    title: 'Preferences',
    icon: path.join(__dirname, '../assets/icons/png/preferences.png')
  })
  //pref.webContents.openDevTools()
  pref.setMenu(null);
  pref.on('closed', () => {
    pref = null
  })
  pref.loadURL(url.format({
    pathname: path.join(__dirname, 'prefs.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (debug)
    pref.webContents.openDevTools();

  pref.once('ready-to-show', () => {
    pref.show()
  })
  addInputContext(pref);
}

function createMapper(show) {
  if (winMap) return;
  s = loadWindowState('mapper')
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
    icon: path.join(__dirname, '../assets/icons/png/map2.png')
  })

  if (s.fullscreen)
    winMap.setFullScreen(s.fullscreen);

  winMap.setMenu(null);
  winMap.loadURL(url.format({
    pathname: path.join(__dirname, 'mapper.html'),
    protocol: 'file:',
    slashes: true
  }));

  winMap.on('closed', () => {
    winMap = null;
  });

  winMap.on('resize', () => {
    if (!winMap.isMaximized() && !winMap.isFullScreen())
      trackWindowState('mapper', winMap);
  })

  winMap.on('move', () => {
    trackWindowState('mapper', winMap);
  })

  winMap.on('unmaximize', () => {
    trackWindowState('mapper', winMap);
  })

  if (debug)
    winMap.webContents.openDevTools()

  winMap.once('ready-to-show', () => {
    addInputContext(winMap);
    if (show) {
      if (s.maximized)
        winMap.maximize();
      else
        winMap.show()
    }
    else
      mapperMax = s.maximized;
  })

  winMap.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    if (win != null)
      set.showMapper = false;
    set.windows['mapper'] = getWindowState('mapper', winMap);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
    e.preventDefault();
    winMap.webContents.executeJavaScript('save();');
    winMap.hide();
  })
}

function showMapper() {
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  set.showMapper = true;
  set.save(path.join(app.getPath('userData'), 'settings.json'));
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

function showProfiles() {
  if (winProfiles != null) {
    winProfiles.show();
    return;
  }
  s = loadWindowState('profiles');
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
    title: 'Preferences',
    icon: path.join(__dirname, '../assets/icons/png/profiles.png'),
    show: false
  })

  if (s.fullscreen)
    winProfiles.setFullScreen(s.fullscreen);

  if (debug)
    winProfiles.webContents.openDevTools()

  winProfiles.setMenu(null);
  winProfiles.on('closed', () => {
    winProfiles = null
  })
  winProfiles.loadURL(url.format({
    pathname: path.join(__dirname, 'profiles.html'),
    protocol: 'file:',
    slashes: true
  }))
  winProfiles.once('ready-to-show', () => {
    //addInputContext(winProfiles);
    if (s.maximized)
      winProfiles.maximize();
    else
      winProfiles.show();
  })

  winProfiles.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.windows['profiles'] = getWindowState('profiles', winProfiles);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
  })

  winProfiles.on('resize', () => {
    if (!winProfiles.isMaximized() && !winProfiles.isFullScreen())
      trackWindowState('profiles', winProfiles);
  })

  winProfiles.on('move', () => {
    trackWindowState('profiles', winProfiles);
  })

  winProfiles.on('unmaximize', () => {
    trackWindowState('profiles', winProfiles);
  })
}

function createEditor(show) {
  if (winEditor) return;
  s = loadWindowState('editor')
  winEditor = new BrowserWindow({
    parent: win,
    title: 'Advanced Editor',
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: '#eae4d6',
    show: false,
    skipTaskbar: false,
    icon: path.join(__dirname, '../assets/icons/png/edit.png')
  })

  if (s.fullscreen)
    winEditor.setFullScreen(s.fullscreen);

  winEditor.setMenu(null);
  winEditor.loadURL(url.format({
    pathname: path.join(__dirname, 'editor.html'),
    protocol: 'file:',
    slashes: true
  }));

  winEditor.on('closed', () => {
    winEditor = null;
  });

  winEditor.on('resize', () => {
    if (!winEditor.isMaximized() && !winEditor.isFullScreen())
      trackWindowState('editor', winEditor);
  })

  winEditor.on('move', () => {
    trackWindowState('editor', winEditor);
  })

  winEditor.on('unmaximize', () => {
    trackWindowState('editor', winEditor);
  })

  if (debug)
    winEditor.webContents.openDevTools()

  winEditor.once('ready-to-show', () => {
    addInputContext(winEditor);
    if (show) {
      if (s.maximized)
        winEditor.maximize();
      else
        winEditor.show();
    }
    else
      editorMax = s.maximized;
  })

  winEditor.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.showEditor = false;
    set.windows['editor'] = getWindowState('editor', winEditor);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
    winEditor.webContents.executeJavaScript('tinymce.activeEditor.setContent(\'\');');
    e.preventDefault();
    winEditor.hide();
  })
}

function showEditor() {
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  set.showEditor = true;
  set.save(path.join(app.getPath('userData'), 'settings.json'));
  if (winEditor != null) {
    if (editorMax)
      winEditor.maximize();
    else
      winEditor.show();
    editorMax = false;
  }
  else
    createEditor(true);
}

function createChat(show) {
  if (winChat) return;
  s = loadWindowState('chat')
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
    icon: path.join(__dirname, '../assets/icons/png/chat.png')
  })

  if (s.fullscreen)
    winChat.setFullScreen(s.fullscreen);

  winChat.setMenu(null);
  winChat.loadURL(url.format({
    pathname: path.join(__dirname, 'chat.html'),
    protocol: 'file:',
    slashes: true
  }));

  winChat.on('closed', () => {
    winChat = null;
    chatReady = false;
  });

  winChat.on('resize', () => {
    if (!winChat.isMaximized() && !winChat.isFullScreen())
      trackWindowState('chat', winChat);
  })

  winChat.on('move', () => {
    trackWindowState('chat', winChat);
  })

  winChat.on('unmaximize', () => {
    trackWindowState('chat', winChat);
  })

  if (debug)
    winChat.webContents.openDevTools()

  winChat.once('ready-to-show', () => {
    addInputContext(winChat);
    if (show) {
      if (s.maximized)
        winChat.maximize();
      else
        winChat.show();
    }
    else
      chatMax = s.maximized;
    chatReady = true;
  })

  winChat.on('closed', () => {
    winChat = null;
  })

  winChat.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.showChat = false;
    set.windows['chat'] = getWindowState('chat', winChat);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
    if (set.chat.captureTells || set.chat.captureTalk || set.chat.captureLines) {
      e.preventDefault();
      winChat.hide();
    }

  })
}

function showChat() {
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  set.showChat = true;
  set.save(path.join(app.getPath('userData'), 'settings.json'));
  if (winChat != null) {
    if (chatMax)
      winChat.maximize();
    else
      winChat.show();
    chatMax = false;
  }
  else
    createChat(true);
}

function createNewWindow(name, options) {
  if (windows[name] && windows[name].window)
    return;
  if (!options) options = {};
  s = loadWindowState(name);
  windows[name] = options;
  windows[name].window = new BrowserWindow({
    parent: set.windows[name].alwaysOnTopClient ? win : null,
    title: options.title || name,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: options.background || '#000',
    show: false,
    skipTaskbar: (set.windows[name].alwaysOnTopClient || set.windows[name].alwaysOnTop) ? true : false,
    icon: path.join(__dirname, '../assets/icons/png/' + (options.icon || name) + '.png')
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
  })

  windows[name].window.on('move', () => {
    trackWindowState(name, windows[name].window);
  })

  windows[name].window.on('unmaximize', () => {
    trackWindowState(name, windows[name].window);
  })

  if (debug)
    windows[name].window.webContents.openDevTools()

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
  })

  windows[name].window.on('closed', () => {
    windows[name].window = null;
  })

  windows[name].window.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.windows[name] = getWindowState(name, windows[name].window);
    set.windows[name].show = false;
    set.save(path.join(app.getPath('userData'), 'settings.json'));
    if (windows[name].cache) {
      e.preventDefault();
      windows[name].window.hide();
    }
  })
}

function showWindow(name, options) {
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  if (!set.windows[name])
    set.windows[name] = {};
  set.windows[name].show = true;
  set.save(path.join(app.getPath('userData'), 'settings.json'));
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