//spell-checker:words submenu, pasteandmatchstyle, statusvisible, taskbar, colorpicker, mailto, forecolor, tinymce, unmaximize
//spell-checker:ignore prefs, partyhealth, combathealth, commandinput, limbsmenu, limbhealth, selectall, editoronly, limbarmor, maximizable, minimizable
//spell-checker:ignore limbsarmor, lagmeter, buttonsvisible, connectbutton, charactersbutton, Editorbutton, zoomin, zoomout, unmaximize, resizable
const { app, BrowserWindow, BrowserView, shell, screen } = require('electron');
const { Tray, dialog, Menu, MenuItem } = require('electron');
const ipcMain = require('electron').ipcMain;
const path = require('path');
const fs = require('fs');
const url = require('url');
const settings = require('./js/settings');
const { EditorSettings } = require('./js/editor/code.editor.settings');
const { TrayClick } = require('./js/types');

require('@electron/remote/main').initialize()
//require('electron-local-crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let winProfiles, winCode;
let codeMax = false;
let edSet;
let codeReady = 0, profilesReady = 0;
let loadID;
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

let clients = {}
let windows = {};
let focusedClient = 0;
let focusedWindow = 0;
let _clientID = 0;
let _windowID = 0;
const idMap = new Map();

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
                                ${((mWindow !== winCode) ? 'el.blur();\n' : '')}
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

function createMenu() {
    var menuTemp = [
        //File
        {
            label: '&File',
            id: 'file',
            submenu: [
                {
                    label: '&New connection',
                    id: 'newConnect',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: (item, mWindow) => {
                        let windowId = getWindowId(mWindow);
                        let id = createClient(mWindow.getContentBounds());
                        focusedWindow = windowId;
                        focusedClient = id;
                        windows[windowId].clients.push(id);
                        windows[windowId].current = id;
                        clients[id].parent = mWindow;
                        clients[id].view.webContents.once('dom-ready', () => {
                            mWindow.setBrowserView(clients[id].view);
                            mWindow.setMenu(clients[id].menu);
                            mWindow.webContents.send('new-client', id);
                            focusClient(mWindow, true);
                        });
                    }
                },
                {
                    label: '&New window',
                    id: '',
                    accelerator: 'CmdOrCtrl+Alt+N',
                    click: () => {
                        let windowId = createWindow();
                        let window = windows[windowId].window;
                        let id = createClient(window.getContentBounds());
                        focusedWindow = windowId;
                        focusedClient = id;
                        windows[windowId].clients.push(id);
                        windows[windowId].current = id;
                        clients[id].parent = window;
                        window.setBrowserView(clients[id].view);
                        window.setMenu(clients[id].menu);
                        window.webContents.once('dom-ready', () => {
                            window.webContents.send('new-client', id);
                            focusClient(window, true);
                        });
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
                        focusClient(mWindow, true);
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
                            click: showCodeEditor
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
                                focusClient(mWindow);
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
                                focusClient(mWindow);
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
                                focusClient(mWindow);
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
                    label: '&Code editor...',
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
                    label: '&Command history...',
                    id: 'history',
                    click: (item, mWindow) => {
                        executeScriptClient('showCommandHistory()', mWindow, true);
                    },
                    accelerator: 'CmdOrCtrl+Shift+H'
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
                        focusClient(mWindow);
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
                    click: (item, mWindow) => showAbout(mWindow)
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
            click: showProfiles,
            accelerator: 'CmdOrCtrl+P'

        });
    return Menu.buildFromTemplate(menuTemp);
}

function profileToggle(menuItem, mWindow) {
    executeScriptClient('client.toggleProfile("' + menuItem.label.toLowerCase() + '")', mWindow, true);
}

function createWindow() {
    var s = loadWindowState();
    // Create the browser window.
    let window = new BrowserWindow({
        title: 'jiMUD',
        x: getWindowX(s.x, s.width),
        y: getWindowY(s.y, s.height),
        width: s.width,
        height: s.height,
        backgroundColor: '#000',
        show: false,
        icon: path.join(__dirname, '../assets/icons/png/64x64.png'),
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
        }
    });
    require("@electron/remote/main").enable(window.webContents);

    // and load the index.html of the app.
    window.loadURL(url.format({
        pathname: path.join(__dirname, 'manager.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Open the DevTools.
    if (s.devTools)
        window.webContents.openDevTools();
    window.on('resize', () => {
    });

    window.on('move', () => {
    });

    window.on('maximize', () => {
    });

    window.on('unmaximize', () => {
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
            for (var idx = 0; idx < cl; idx++)
                window.webContents.send('new-client', windows[windowId].clients[idx]);
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
        if (global.debug)
            childWindow.webContents.openDevTools();
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

        childWindow.on('closed', () => {
            if (window && !window.isDestroyed()) {
                executeScriptClient(`if(typeof childClosed === "function") childClosed('${url}', '${frameName}');`, window, true);
            }
        });
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
    });

    window.once('ready-to-show', async () => {
        loadWindowScripts(window, 'manager');
        executeScript(`if(typeof setId === "function") setId(${_clientID});`, clients[_clientID].view);
        executeScript('if(typeof loadTheme === "function") loadTheme(\'' + set.theme.replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\');', window);
        updateJumpList();
        checkForUpdates();
        window.show();
    });

    window.on('close', (e) => {
    });
    window.on('restore', () => {
        window.getBrowserView().webContents.send('restore');
    });
    window.on('maximize', () => {
        window.getBrowserView().webContents.send('maximize');
    });
    window.on('unmaximize', () => {
        window.getBrowserView().webContents.send('unmaximize');
    });

    window.on('resized', () => {
        window.getBrowserView().webContents.send('resized');
    });
    _windowID++
    windows[_windowID] = { window: window, clients: [] };
    idMap.set(window, _windowID);
    return _windowID;
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

    if (Array.isArray(argv.s))
        global.settingsFile = parseTemplate(argv.s[0]);
    else if (argv.s)
        global.settingsFile = parseTemplate(argv.s);

    if (global.editorOnly)
        showCodeEditor();
    else {
        let windowId = createWindow();
        let window = windows[windowId].window;
        let id = createClient(window.getContentBounds());
        focusedWindow = windowId;
        focusedClient = id;
        windows[windowId].clients.push(id);
        windows[windowId].current = id;
        clients[id].parent = window;
        window.setBrowserView(clients[id].view);
        window.setMenu(clients[id].menu);
        focusClient(window, true);
        window.webContents.once('dom-ready', () => {
            window.webContents.send('new-client', id);
        });
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
    //if (win == null) {
    //createWindow();
    //}
});

app.on('before-quit', (e) => {
    if (winProfiles) {
        e.preventDefault();
        dialog.showMessageBox(winProfiles, {
            type: 'warning',
            title: 'Close profile manager',
            message: 'You must close the profile manager before you can exit.'
        });
    }
});

ipcMain.on('check-for-updates', checkForUpdatesManual);

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

ipcMain.on('trash-item', (event, file) => {
    if (!file)
        return;
    shell.trashItem(file).catch(err => logError(err));
});

ipcMain.on('trash-item-sync', async (event, file) => {
    await shell.trashItem(file).catch(err => logError(err));
    event.returnValue = true;
});

ipcMain.on('parseTemplate', (event, str, data) => {
    event.returnValue = parseTemplate(str, data);
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
        if (args && args.length)
            showSelectedWindow(args[0], args.slice(1));
        else if (current.isVisible()) {
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
    else if (action === 'closeWindows')
        closeWindows(true, false);
});

ipcMain.handle('attach-context-event', event => {
    event.sender.on('context-menu', (e, props) => {
        executeScriptContents(`executeContextMenu(${JSON.stringify(props)})`, event.sender);
    });
});

ipcMain.handle('attach-context-event-prevent', event => {
    event.sender.on('context-menu', (e, props) => {
        executeScriptContents(`executeContextMenu(${JSON.stringify(props)})`, event.sender);
    });
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

ipcMain.on('new-client', (event, focus, offset) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    let id = createClient(window.getContentBounds(), offset);
    let windowId = getWindowId(window);
    windows[windowId].clients.push(id);
    clients[id].parent = window;
    window.webContents.send('new-client', id);
});

ipcMain.on('switch-client', (event, id, offset) => {
    if (clients[id]) {
        let window = BrowserWindow.fromWebContents(event.sender);
        let windowId = getWindowId(window);
        if (window != clients[id].parent) {
            //@TODO probably wanting to dock from 1 window to another
            return;
        }
        let bounds = window.getContentBounds();
        clients[id].view.setBounds({
            x: 0,
            y: 0 || offset,
            width: bounds.width,
            height: bounds.height - offset
        });
        if (windowId === focusedWindow)
            focusedClient = id;
        windows[windowId].current = id;
        window.setBrowserView(clients[id].view);
        window.setMenu(clients[id].menu);
        focusClient(window, true);
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



ipcMain.on('undock-client', (event, id) => {
    if (clients[id] && !clients[id].parent) {
        var windowId = createWindow();
        // Create the browser window.
        let window = windows[windowId];
        window.once('ready-to-show', () => {
            addInputContext(clients[id].window, global.editorOnly ? (edSet && edSet.spellchecking) : (set && set.spellchecking));
            clients[id].parent.removeBrowserView(clients[id].view);
            clients[id].parent = window;
            var bounds = window.getContentBounds();
            clients[id].view.setBounds({
                x: 0,
                y: 0,
                width: bounds.width,
                height: bounds.height
            });
            clients[id].window.setBrowserView(clients[id].view);
        });
    }
});

ipcMain.on('dock-client', (event, id, offset) => {
    if (clients[id] && clients[id].window) {
        clients[id].window.removeBrowserView(clients[id].view);
        clients[id].window.close();
        clients[id].window = null;
        delete clients[id].window;
        var bounds = BrowserWindow.fromWebContents(event.sender).getContentBounds();
        clients[id].view.setBounds({
            x: 0,
            y: offset,
            width: bounds.width,
            height: bounds.height - offset
        });
    }
});

ipcMain.on('execute-client', (event, id, code) => {
    if (clients[id])
        executeScript(code, clients[id]);
});

ipcMain.on('update-client', (event, id, offset) => {
    if (clients[id]) {
        var bounds = BrowserWindow.fromWebContents(event.sender).getContentBounds();
        clients[id].view.setBounds({
            x: 0,
            y: 0 || offset,
            width: bounds.width,
            height: bounds.height - offset
        });
    }
});

ipcMain.on('can-close-client', async (event, id) => {
    event.returnValue = await canCloseClient(id);
});

ipcMain.on('can-close-all-client', async (event) => {
    event.returnValue = await canCloseAllClients(getWindowId(BrowserWindow.fromWebContents(event.sender)));
});

ipcMain.on('execute-main', (event, code) => {
    executeScript(code, win);
});

ipcMain.on('dock-main', (event, id) => {
    executeScript(`dockClient(${id})`, win);
});

function createClient(bounds, offset) {
    offset = offset || 0;
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
        if (global.debug)
            childWindow.webContents.openDevTools();
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

        childWindow.on('closed', () => {
            if (view && view.webContents && !view.webContents.isDestroyed()) {
                executeScript(`if(typeof childClosed === "function") childClosed('${url}', '${frameName}');`, view, true);
            }
            //remove remove from list
            const idx = clients[getClientId(view)].windows.indexOf(childWindow);
            clients[getClientId(view)].windows[idx] = null;
            clients[getClientId(view)].windows.splice(idx, 1);

        });

        childWindow.on('close', () => {
        });

        clients[getClientId(view)].windows.push(childWindow);
    });

    view.setAutoResize({
        width: true,
        height: true
    })
    view.setBounds({
        x: 0,
        y: 0 || offset,
        width: bounds.width,
        height: bounds.height - offset
    });
    //@TODO change to index.html once basic window system is working
    view.webContents.loadFile("build/blank.html");
    require("@electron/remote/main").enable(view.webContents);
    _clientID++;
    clients[_clientID] = { view: view, menu: createMenu(), windows: [] };
    idMap.set(view, _clientID);
    executeScript(`if(typeof setId === "function") setId(${_clientID});`, clients[_clientID].view);
    //clients[id].view.webContents.openDevTools();
    //win.setTopBrowserView(view)    
    //addBrowserView
    //setBrowserView  
    return _clientID;
}

async function removeClient(id) {
    const client = clients[id];
    const cancel = await executeScript('if(typeof close === "function") close()', client.view);
    //dont close
    if (cancel !== true)
        return;
    //close client windows first incase they need parent window set
    closeClientWindows(id);
    const window = client.parent;
    const windowId = getWindowId(window);
    const idx = windows[windowId].clients.indexOf(id)
    windows[windowId].clients.splice(idx, 1);
    client.parent = null;
    delete client.parent;
    idMap.delete(client.view);
    client.view.webContents.destroy();
    clients[id] = null;
    delete clients[id];
    window.webContents.send('removed-client', id);
}

function closeClientWindows(id) {
    //@TODO add window state saving when possible
    //no windows so just bail
    if (clients[id].windows.length === 0) return;
    const client = clients[id];
    for (window in clients[id].windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, clients[id].windows))
            continue;
        //call any code hooks in the child windows
        if (window && !window.isDestroyed()) {
            executeCloseHooks(window);
            window.close();
        }
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
    const window = windows[windowId];
    const cl = windows[windowId].clients.length;
    for (var idx = 0; idx < cl; idx++) {
        const close = await canCloseClient(windows[windowId].clients[idx]);
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
    if (window.isMinimized())
        return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            fullscreen: bounds.fullscreen || window.isFullScreen(),
            maximized: bounds.maximized || window.isMaximized(),
            devTools: window.webContents.isDevToolsOpened()
        };
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
    if (window === 'code-editor') {
        if (!edSet)
            edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
        if (global.editorOnly) {
            if (!edSet.stateOnly)
                return {
                    x: 0,
                    y: 0,
                    width: 800,
                    height: 600,
                };
            states[window] = {
                x: edSet.stateOnly.x,
                y: edSet.stateOnly.y,
                width: edSet.stateOnly.width,
                height: edSet.stateOnly.height,
            };
            return edSet.stateOnly;
        }
        if (!edSet.state)
            return {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
            };
        states[window] = {
            x: edSet.state.x,
            y: edSet.state.y,
            width: edSet.state.width,
            height: edSet.state.height,
        };
        return edSet.state;
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

function restoreWindowState(window, state, show, focus) {
    if (!window) return;
    if (state && state.maximized)
        window.maximize();
    if (show)
        window.show();
    if (state && state.fullscreen)
        window.setFullScreen(state.fullscreen);
    if (focus)
        window.focus();
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

function showProfiles() {
    if (winProfiles != null) {
        winProfiles.show();
        return;
    }
    var s = loadWindowState('profiles');
    winProfiles = new BrowserWindow({
        parent: getParentWindow(),
        x: getWindowX(s.x, s.width),
        y: getWindowY(s.y, s.height),
        width: s.width,
        height: s.height,
        movable: true,
        minimizable: true,
        maximizable: true,
        skipTaskbar: !set.profiles.showInTaskBar,
        resizable: true,
        title: 'Profile Manger',
        icon: path.join(__dirname, '../assets/icons/png/profiles.png'),
        show: false,
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
    require("@electron/remote/main").enable(winProfiles.webContents);
    winProfiles.webContents.on('render-process-gone', (event, details) => {
        logError(`Profile manager render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    winProfiles.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!winProfiles)
                return;
            if (result.response === 0) {
                winProfiles.reload();
                logError('Profile manager unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                winProfiles.destroy();
            }
            else
                logError('Profile manager unresponsive, waiting.\n', true);
        });
    });

    if (global.debug)
        winProfiles.webContents.openDevTools();

    winProfiles.webContents.on('did-finish-load', () => {
        profilesReady = 2;
    });

    winProfiles.removeMenu();
    winProfiles.on('closed', () => {
        winProfiles = null;
        profilesReady = 0;
    });
    winProfiles.loadURL(url.format({
        pathname: path.join(__dirname, 'profiles.html'),
        protocol: 'file:',
        slashes: true
    }));
    winProfiles.once('ready-to-show', () => {
        loadWindowScripts(winProfiles, 'profiles');
        //addInputContext(winProfiles, set && set.spellchecking);
        restoreWindowState(winProfiles, s, true);
        if (profilesReady !== 2)
            profilesReady = 1;
    });

    winProfiles.on('close', () => {
        set = settings.Settings.load(global.settingsFile);
        set.windows.profiles = getWindowState('profiles', winProfiles);
        if (win && !win.isDestroyed() && win.webContents)
            win.webContents.send('setting-changed', { type: 'window', name: 'profiles', value: set.windows.profiles, noSave: true });
        set.save(global.settingsFile);
        win.focus();
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
        states.profiles.maximized = true;
    });

    winProfiles.on('unmaximize', () => {
        trackWindowState('profiles', winProfiles);
        states.profiles.maximized = false;
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
    if (isFileSync(path.join(app.getPath('userData'), 'characters.json'))) {
        characters = fs.readFileSync(path.join(app.getPath('userData'), 'characters.json'), 'utf-8');
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

function copyWindowOptions(name) {
    if (!name || !windows[name]) return {};
    var ops = {};
    for (var op in windows[name]) {
        if (!Object.prototype.hasOwnProperty.call(windows[name], op) || op === 'window')
            continue;
        ops[op] = windows[name][op];
    }
    return ops;
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

function closeWindows(save, clear) {
    if (!set)
        set = settings.Settings.load(global.settingsFile);
    var name;
    var cWin;
    for (name in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, name))
            continue;
        if (windows[name].window) {
            executeCloseHooks(windows[name].window);
            set.windows[name] = getWindowState(name, windows[name].window);
        }
        set.windows[name].options = copyWindowOptions(name);
        if (windows[name].window) {
            cWin = windows[name].window;
            windows[name].window = null;
            cWin.close();
        }
    }
    if (clear)
        windows = {};
    if (save) {
        if (win && !win.isDestroyed() && win.webContents)
            win.webContents.send('setting-changed', { type: 'window', name: name, value: set.windows[name], noSave: true });
        set.save(global.settingsFile);
    }
}

function createCodeEditor(show, loading, loaded) {
    if (winCode) return;
    if (!edSet)
        edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
    var s = loadWindowState('code-editor');
    if (global.editorOnly) {
        if (!edSet.stateOnly)
            edSet.stateOnly = {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
            };
        states['code-editor'] = edSet.stateOnly;
    }
    else {
        if (!edSet.state)
            edSet.state = {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
            };
        states['code-editor'] = edSet.state;
    }
    winCode = new BrowserWindow({
        parent: (!global.editorOnly && edSet.window.alwaysOnTopClient) ? win : null,
        alwaysOnTop: edSet.window.alwaysOnTop,
        title: 'Code editor',
        x: getWindowX(s.x, s.width),
        y: getWindowY(s.y, s.height),
        width: s.width,
        height: s.height,
        backgroundColor: 'grey',
        show: false,
        skipTaskbar: (!global.editorOnly && (edSet.window.alwaysOnTopClient || edSet.window.alwaysOnTop)) ? true : false,
        icon: path.join(__dirname, '../assets/icons/win/code.ico'),
        webPreferences: {
            nodeIntegration: true,
            webviewTag: false,
            sandbox: false,
            spellcheck: edSet ? edSet.spellchecking : false,
            enableRemoteModule: true,
            contextIsolation: false,
            backgroundThrottling: edSet ? edSet.enableBackgroundThrottling : true
        }

    });
    require("@electron/remote/main").enable(winCode.webContents);
    winCode.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!winCode)
                return;
            if (result.response === 0) {
                winCode.reload();
                logError('Code editor unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                winCode.destroy();
            }
            else
                logError('Code editor unresponsive, waiting.\n', true);
        });
    });

    winCode.removeMenu();
    winCode.loadURL(url.format({
        pathname: path.join(__dirname, 'code.editor.html'),
        protocol: 'file:',
        slashes: true
    }));

    winCode.webContents.on('render-process-gone', (event, details) => {
        logError(`Code editor render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    winCode.on('closed', (e) => {
        if (e.sender !== winCode) return;
        winCode = null;
        codeReady = 0;
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

    winCode.webContents.on('did-finish-load', () => {
        codeReady = 2;
    });

    winCode.once('ready-to-show', () => {
        loadWindowScripts(winCode, 'code.editor');
        addInputContext(winCode, edSet && edSet.spellchecking);
        if (show)
            restoreWindowState(winCode, s, true);
        else {
            if (s.fullscreen)
                winCode.setFullScreen(s.fullscreen);
            codeMax = s.maximized;
        }
        if (loading) {
            clearTimeout(loadID);
            if (!global.editorOnly)
                loadID = setTimeout(() => { win.focus(); }, 500);
        }
        if (loaded)
            loaded();
        if (codeReady !== 2)
            codeReady = 1;
        if (global.editorOnly) {
            updateJumpList();
            checkForUpdates();
            if (process.platform === 'linux')
                winCode.setIcon(path.join(__dirname, '../assets/icons/png/code.png'));
            else
                winCode.setOverlayIcon(path.join(__dirname, '../assets/icons/png/codeol.png'), 'Received data');
        }
    });

    winCode.on('close', (e) => {
        //force a reload to make sure newest settings are saved
        edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
        if (!global.editorOnly) {
            if (winCode && winCode.getParentWindow() == win)
                edSet.window.show = false;
            else if (winCode != null)
                edSet.window.show = true;
            edSet.state = getWindowState('code-editor', winCode);
        }
        else
            edSet.stateOnly = getWindowState('code-editor', winCode || e.sender);
        edSet.save(parseTemplate(path.join('{data}', 'editor.json')));
        if (winCode === e.sender && winCode && !global.editorOnly && edSet.window.persistent) {
            e.preventDefault();
            executeScript('if(typeof closeHidden === "function") closeHidden()', winCode);
        }
    });

    winCode.webContents.setWindowOpenHandler((details) => {
        var u = new url.URL(details.url);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
            shell.openExternal(details.url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: buildOptions(details, winCode, edSet)
        }
    });

    winCode.webContents.on('did-create-window', (w, details) => {
        let frameName = details.frameName;
        let url = details.url;
        if (global.debug)
            w.webContents.openDevTools();
        w.removeMenu();
        w.once('ready-to-show', () => {
            loadWindowScripts(w, frameName);
            addInputContext(w, edSet && edSet.spellchecking);
            w.show();
            //w.reload();
        });
        w.webContents.on('render-process-gone', (event, details) => {
            logError(`${url} render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
        });

        w.on('unresponsive', () => {
            dialog.showMessageBox({
                type: 'info',
                message: 'Unresponsive',
                buttons: ['Reopen', 'Keep waiting', 'Close']
            }).then(result => {
                if (!w)
                    return;
                if (result.response === 0) {
                    w.reload();
                    logError(`${url} unresponsive, reload.\n`, true);
                }
                else if (result.response === 2) {
                    w.destroy();
                }
                else
                    logError(`${url} unresponsive, waiting.\n`, true);
            });
        });

        w.on('close', () => {
            if (w && w.getParentWindow()) {
                executeScript(`if(typeof childClosed === "function") childClosed('${url}', '${frameName}');`, w.getParentWindow());
                w.getParentWindow().focus();
            }
        });
    });
}

function showCodeEditor(loading) {
    if (!edSet)
        edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
    if (!global.editorOnly)
        edSet.window.show = true;
    edSet.save(parseTemplate(path.join('{data}', 'editor.json')));
    if (winCode != null) {
        if (!codeReady)
            return;
        var s = getWindowState('code-editor', winCode);
        restoreWindowState(winCode, {
            maximized: codeMax,
            fullscreen: s.fullscreen
        }, true);
        codeMax = false;
        if (loading) {
            clearTimeout(loadID);
            loadID = setTimeout(() => { win.focus(); }, 500);
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

function showAbout(mWindow) {
    var b;
    mWindow = mWindow || getParentWindow();
    b = mWindow.getBounds();

    let about = new BrowserWindow({
        parent: mWindow,
        modal: false,
        x: Math.floor(b.x + b.width / 2 - 250),
        y: Math.floor(b.y + b.height / 2 - 280),
        width: 500,
        height: 560,
        movable: true,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        resizable: false,
        title: 'About jiMUD',
        icon: path.join(__dirname, '../assets/icons/png/64x64.png'),
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
    require("@electron/remote/main").enable(about.webContents);
    about.webContents.on('render-process-gone', (event, details) => {
        logError(`About render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    about.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!about)
                return;
            if (result.response === 0) {
                about.reload();
                logError('About unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                about.destroy();
            }
            else
                logError('About unresponsive, waiting.\n', true);
        });
    });

    about.removeMenu();
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

function getParentWindow() {
    if (global.editorOnly)
        return winCode;
    return win;
}

// eslint-disable-next-line no-unused-vars
async function executeScript(script, w, f) {
    return new Promise((resolve, reject) => {
        if (!w || !w.webContents) {
            reject();
            return;
        }
        w.webContents.executeJavaScript(script).then(results => resolve(results)).catch(err => {
            if (err)
                logError(err);
            reject();
        });
    });
    //if (f)
    //w.webContents.focus();
}

// eslint-disable-next-line no-unused-vars
async function executeScriptContents(script, w) {
    return new Promise((resolve, reject) => {
        if (!w) {
            reject();
            return;
        }
        w.executeJavaScript(script).then(results => resolve(results)).catch(err => {
            if (err)
                logError(err);
            reject();
        });
    });
}

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

/*
function focusAndPerform(methodName) {
  return function(menuItem, window) {
    window.webContents.focus();
    window.webContents[methodName]();
  };
}
*/

function buildOptions(details, window, settings) {
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
            if (feature[0] == "width" || feature[0] == "height" || feature[0] == 'x' || feature[0] == 'y')
                options[feature[0]] = parseInt(feature[1], 10);
            else
                options[feature[0]] = feature[1];
        }
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

function focusClient(window, focusWindow) {
    let client = getActiveClient(window);
    if (!client) return;
    if (focusWindow) {
        client.parent.focus();
        client.parent.webContents.focus();
    }
    client.view.webContents.focus();
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
        clients[id].webContents.executeJavaScript(script).then(results => resolve(results)).catch(err => {
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
