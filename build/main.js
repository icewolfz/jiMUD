const { app, BrowserWindow, shell } = require('electron')
const { dialog, Menu, MenuItem } = require('electron')
const ipcMain = require('electron').ipcMain
const path = require('path')
const fs = require('fs');
const url = require('url')
const settings = require('./js/settings');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win, winhelp, winwho, winmap, winprofiles, wineditor, winchat
let set, mappermax = false, editormax = false, chatmax = false, debug = false;

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

var menutemp = [
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
          if (winwho) {
            winwho.show();
            return;
          }
          shell.openExternal("http://www.shadowmud.com/who.php", '_blank');
          /*
          winwho = new BrowserWindow({
            parent: win,
            width: 600,
            height: 400,
            title: 'Who is on?',
            icon: '',
          })
          winwho.setMenu(null);
          winwho.on('closed', () => {
            winwho = null
          })

          // and load the index.html of the app.
          winwho.loadURL("http://shadowmud.com/who.php?slim=1");
          winwho.once('ready-to-show', () => {
            winwho.webContents.insertCSS(".top { display: none !important; } div div { display : none !important; }");
            winwho.show()
          })

          winwho.webContents.on('did-finish-load', function () {
            winwho.webContents.insertCSS(".top { display: none !important; } div div { display : none !important; }");
          });
          */
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
            checked: true
          },
          {
            label: '&Limbs',
            id: "limbs",
            type: 'checkbox',
            checked: true
          },
          {
            label: '&Health',
            id: "heatlh",
            type: 'checkbox',
            checked: true
          },
          {
            label: '&Experience',
            id: "experience",
            type: 'checkbox',
            checked: true
          },
          {
            label: '&Party Health',
            id: "partyhealth",
            type: 'checkbox',
            checked: true
          },
          {
            label: '&Combat Health',
            id: "combathealth",
            type: 'checkbox',
            checked: true
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

          /*
          dialog.showMessageBox(win, {
            type:'info',
            message:'About jiMud',
            detail: 'jiMUD v'+app.getVersion(),
            buttons: ["OK"],
          });
          */
        }
      }
    ]
  }
]

if (process.platform === 'darwin') {
  menutemp.unshift({
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
  menutemp[2].submenu.push(
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
  menutemp[5].submenu = [
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

function addInutContext(window) {
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
  if (winhelp != null) {
    winhelp.title = title;
    winhelp.loadURL(url);
    winhelp.show();
    return;
  }
  s = loadWindowState('help')
  if (!title || title.length == 0)
    title = "Help";
  winhelp = new BrowserWindow({
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
    winhelp.setFullScreen(s.fullscreen);

  winhelp.setMenu(null);
  winhelp.loadURL(url);
  winhelp.on('closed', () => {
    winhelp = null;
  });

  winhelp.on('resize', () => {
    if (!winhelp.isMaximized() && !winhelp.isFullScreen())
      trackWindowState('help', winhelp);
  })

  winhelp.on('move', () => {
    trackWindowState('help', winhelp);
  })


  winhelp.on('unmaximize', () => {
    trackWindowState('help', winhelp);
  })



  if (s.devTools)
    winhelp.webContents.openDevTools()

  winhelp.once('ready-to-show', () => {
    addInutContext(winhelp);
    if (url != null && url.length != 0) {
      if (s.maximized)
        winhelp.maximize();
      else
        winhelp.show()
    }
  })

  winhelp.on('close', () => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.windows['help'] = getWindowState('help', winhelp);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
  })
}

function createMenu() {
  var profiles;
  for (var m = 0; m < menutemp.length; m++) {
    if (menutemp[m].id == "profiles") {
      profiles = menutemp[m];
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
  menubar = Menu.buildFromTemplate(menutemp);
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
    if (winmap)
      winmap.webContents.executeJavaScript('saveRoom()');
    win = null;
  })

  win.once('ready-to-show', () => {
    addInutContext(win);
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
    else
      createMapper();

    if (set.showEditor)
      showEditor();
    else
      createEditor();
    if (set.showChat)
      showChat();
    else
      createChat();

  })

  win.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.windows['main'] = getWindowState('main', win);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
    if (winmap)
      winmap.webContents.executeJavaScript('saveRoom()');
    if (winprofiles) {
      e.preventDefault();
      dialog.showMessageBox(winprofiles, {
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
  if (winmap) {
    winmap.webContents.send('reload-options');
    if (winmap.setParentWindow)
      winmap.setParentWindow(set.mapper.alwaysOnTopClient ? win : null);
    winmap.setAlwaysOnTop(set.mapper.alwaysOnTop);
    winmap.setSkipTaskbar((set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop) ? true : false);
  }
  if (winchat) {
    winchat.webContents.send('reload-options');
    if (winchat.setParentWindow)
      winchat.setParentWindow(set.chat.alwaysOnTopClient ? win : null);
    winchat.setAlwaysOnTop(set.chat.alwaysOnTop);
    winchat.setSkipTaskbar((set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false);
  }

  if (winprofiles)
    winprofiles.webContents.send('reload-options');
  if (wineditor)
    wineditor.webContents.send('reload-options');

});

ipcMain.on('set-title', (event, title) => {
  if (winchat)
    winchat.webContents.send('set-title', title);
  if (winprofiles)
    winprofiles.webContents.send('set-title', title);
  if (wineditor)
    wineditor.webContents.send('set-title', title);
  if (winmap)
    winmap.webContents.send('set-title', title);
})

ipcMain.on('closed', (event, title) => {
  if (winchat)
    winchat.webContents.send('closed', title);
  if (winprofiles)
    winprofiles.webContents.send('closed', title);
  if (wineditor)
    wineditor.webContents.send('closed', title);
  if (winmap)
    winmap.webContents.send('closed', title);
})

ipcMain.on('connected', (event, title) => {
  if (winchat)
    winchat.webContents.send('connected', title);
  if (winprofiles)
    winprofiles.webContents.send('connected', title);
  if (wineditor)
    wineditor.webContents.send('connected', title);
  if (winmap)
    winmap.webContents.send('connected', title);
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
})

ipcMain.on('chat', (event, text) => {
  winchat.webContents.send('chat', text);
})

ipcMain.on('setting-changed', (event, data) => {
  if (data.type == "mapper" && data.name == "alwaysOnTopClient") {
    winmap.setParentWindow(data.value ? win : null);
    winmap.setSkipTaskbar((set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop) ? true : false);
  }
  if (data.type == "mapper" && data.name == "setAlwaysOnTop") {
    winmap.setAlwaysOnTop(data.value);
    winmap.setSkipTaskbar((set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop) ? true : false);
  }
  if (event.sender != win.webContents)
    win.webContents.send('setting-changed', data);
  if (winmap && event.sender != winmap.webContents)
    winmap.webContents.send('setting-changed', data);

  if (data.type == "chat" && data.name == "alwaysOnTopClient") {
    winchat.setParentWindow(data.value ? win : null);
    winchat.setSkipTaskbar((set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false);
  }
  if (data.type == "chat" && data.name == "setAlwaysOnTop") {
    winchat.setAlwaysOnTop(data.value);
    winchat.setSkipTaskbar((set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false);
  }

})

ipcMain.on('GMCP-received', (event, data) => {
  if (winmap)
    winmap.webContents.send('GMCP-received', data);
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
});

ipcMain.on('import-map', (event, data) => {
  if (winmap)
    winmap.webContents.send('import', data);
});

function updateMenuItem(args) {
  var item, i = 0, ic, items;
  var titem, titems;
  if (!menubar || args == null || args.menu == null) return;

  if (!Array.isArray(args.menu))
    args.menu = args.menu.split('|');

  items = menubar.items;
  titems = menutemp;
  for (i = 0; i < args.menu.length; i++) {
    if (!items || items.length == 0) break;
    for (m = 0; m < items.length; m++) {
      if (!items[m].id) continue;
      if (items[m].id == args.menu[i]) {
        item = items[m];
        titem = titems[m];
        if (item.submenu) {
          items = item.submenu.items;
          titems = titem.submenu;
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

  titem.enabled = item.enabled;
  titem.checked = item.checked;
  titem.icon = item.icon;
  titem.visible = item.visible;
  titem.position = item.position;
}

function loadMenu() {
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  updateMenuItem({ menu: ['view', 'status', 'visible'], checked: set.showStatus });
  updateMenuItem({ menu: ['view', 'status', 'weather'], checked: set.showStatusWeather });
  updateMenuItem({ menu: ['view', 'status', 'limbs'], checked: set.showStatusLimbs });
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
  //addInutContext(pref);
}

function createMapper(show) {
  s = loadWindowState('mapper')
  winmap = new BrowserWindow({
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
    winmap.setFullScreen(s.fullscreen);

  winmap.setMenu(null);
  winmap.loadURL(url.format({
    pathname: path.join(__dirname, 'mapper.html'),
    protocol: 'file:',
    slashes: true
  }));

  winmap.on('closed', () => {
    winmap = null;
  });

  winmap.on('resize', () => {
    if (!winmap.isMaximized() && !winmap.isFullScreen())
      trackWindowState('mapper', winmap);
  })

  winmap.on('move', () => {
    trackWindowState('mapper', winmap);
  })

  winmap.on('unmaximize', () => {
    trackWindowState('mapper', winmap);
  })

  //if (s.devTools)
  if (debug)
    winmap.webContents.openDevTools()

  winmap.once('ready-to-show', () => {
    addInutContext(winmap);
    if (show) {
      if (s.maximized)
        winmap.maximize();
      else
        winmap.show()
    }
    else
      mappermax = s.maximized;
  })

  winmap.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.showMapper = false;
    set.windows['mapper'] = getWindowState('mapper', winmap);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
    e.preventDefault();
    winmap.webContents.executeJavaScript('saveRoom()');
    winmap.hide();
  })
}

function showMapper() {
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  set.showMapper = true;
  set.save(path.join(app.getPath('userData'), 'settings.json'));
  if (winmap != null) {
    if (mappermax)
      winmap.maximize();
    else
      winmap.show();
    mappermax = false;
  }
  else
    createMapper(true);
}

function showProfiles() {
  if (winprofiles != null) {
    winprofiles.show();
    return;
  }
  s = loadWindowState('profiles');
  winprofiles = new BrowserWindow({
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
    winprofiles.setFullScreen(s.fullscreen);
  //if (s.devTools)
  if (debug)
    winprofiles.webContents.openDevTools()

  winprofiles.setMenu(null);
  winprofiles.on('closed', () => {
    winprofiles = null
  })
  winprofiles.loadURL(url.format({
    pathname: path.join(__dirname, 'profiles.html'),
    protocol: 'file:',
    slashes: true
  }))
  winprofiles.once('ready-to-show', () => {
    addInutContext(winprofiles);
    if (s.maximized)
      winprofiles.maximize();
    else
      winprofiles.show();
  })

  winprofiles.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.windows['profiles'] = getWindowState('profiles', winprofiles);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
  })

  winprofiles.on('resize', () => {
    if (!winprofiles.isMaximized() && !winprofiles.isFullScreen())
      trackWindowState('profiles', winprofiles);
  })

  winprofiles.on('move', () => {
    trackWindowState('profiles', winprofiles);
  })

  winprofiles.on('unmaximize', () => {
    trackWindowState('profiles', winprofiles);
  })
}

function createEditor(show) {
  s = loadWindowState('editor')
  wineditor = new BrowserWindow({
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
    wineditor.setFullScreen(s.fullscreen);

  wineditor.setMenu(null);
  wineditor.loadURL(url.format({
    pathname: path.join(__dirname, 'editor.html'),
    protocol: 'file:',
    slashes: true
  }));

  wineditor.on('closed', () => {
    wineditor = null;
  });

  wineditor.on('resize', () => {
    if (!wineditor.isMaximized() && !wineditor.isFullScreen())
      trackWindowState('editor', wineditor);
  })

  wineditor.on('move', () => {
    trackWindowState('editor', wineditor);
  })

  wineditor.on('unmaximize', () => {
    trackWindowState('editor', wineditor);
  })

  //if (s.devTools)
  if (debug)
    wineditor.webContents.openDevTools()

  wineditor.once('ready-to-show', () => {
    addInutContext(wineditor);
    if (show) {
      if (s.maximized)
        wineditor.maximize();
      else
        wineditor.show();
    }
    else
      editormax = s.maximized;
  })

  wineditor.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.showEditor = false;
    set.windows['editor'] = getWindowState('editor', wineditor);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
    wineditor.webContents.executeJavaScript('tinymce.activeEditor.setContent(\'\');');
    e.preventDefault();
    wineditor.hide();
  })
}

function showEditor() {
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  set.showEditor = true;
  set.save(path.join(app.getPath('userData'), 'settings.json'));
  if (wineditor != null) {
    if (editormax)
      wineditor.maximize();
    else
      wineditor.show();
    editormax = false;
  }
  else
    createEditor(true);
}

function createChat(show) {
  s = loadWindowState('chat')
  winchat = new BrowserWindow({
    parent: set.chat.alwaysOnTopClient ? win : null,
    title: 'Chat',
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    backgroundColor: '#eae4d6',
    show: false,
    skipTaskbar: (set.chat.alwaysOnTopClient || set.chat.alwaysOnTop) ? true : false,
    icon: path.join(__dirname, '../assets/icons/png/chat.png')
  })

  if (s.fullscreen)
    winchat.setFullScreen(s.fullscreen);

  winchat.setMenu(null);
  winchat.loadURL(url.format({
    pathname: path.join(__dirname, 'chat.html'),
    protocol: 'file:',
    slashes: true
  }));

  winchat.on('closed', () => {
    winchat = null;
  });

  winchat.on('resize', () => {
    if (!winchat.isMaximized() && !winchat.isFullScreen())
      trackWindowState('chat', winchat);
  })

  winchat.on('move', () => {
    trackWindowState('chat', winchat);
  })

  winchat.on('unmaximize', () => {
    trackWindowState('chat', winchat);
  })

  //if (s.devTools)
  if (debug)
    winchat.webContents.openDevTools()

  winchat.once('ready-to-show', () => {
    addInutContext(winchat);
    if (show) {
      if (s.maximized)
        winchat.maximize();
      else
        winchat.show();
    }
    else
      chatmax = s.maximized;
  })

  winchat.on('close', (e) => {
    set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
    set.showChat = false;
    set.windows['hat'] = getWindowState('chat', winchat);
    set.save(path.join(app.getPath('userData'), 'settings.json'));
    e.preventDefault();
    winchat.hide();
  })
}

function showChat() {
  set = settings.Settings.load(path.join(app.getPath('userData'), 'settings.json'));
  set.showChat = true;
  set.save(path.join(app.getPath('userData'), 'settings.json'));
  if (winchat != null) {
    if (chatmax)
      winchat.maximize();
    else
      winchat.show();
    chatmax = false;
  }
  else
    createChat(true);
}
