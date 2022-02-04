//spell-checker:words submenu, pasteandmatchstyle, statusvisible, taskbar, colorpicker, mailto, forecolor, tinymce, unmaximize
//spell-checker:ignore prefs, partyhealth, combathealth, commandinput, limbsmenu, limbhealth, selectall, editoronly, limbarmor, maximizable, minimizable
//spell-checker:ignore limbsarmor, lagmeter, buttonsvisible, connectbutton, charactersbutton, Editorbutton, zoomin, zoomout, unmaximize, resizable
const { app, BrowserWindow, shell, screen } = require('electron');
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
let win, winMap, winProfiles, winEditor, winChat, winCode, winProgress;
let _winProgressTimer = 0;
let set, mapperMax = false, editorMax = false, chatMax = false, codeMax = false;
let edSet;
let chatReady = 0, codeReady = 0, editorReady = 0, progressReady = 0, profilesReady = 0;
let reload = null;
let tray = null;
let overlay = 0;
let windows = {};
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
global.mapFile = parseTemplate(path.join('{data}', 'map.sqlite'));
global.profiles = null;
global.character = null;
global.characterLogin = null;
global.characterPass = null;
global.dev = false;
global.disconnect = false;
global.title = '';
global.debug = false;
global.editorOnly = false;
global.connected = false;
global.updating = false;

let states = {
    'main': { x: 0, y: 0, width: 800, height: 600 },
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
        global.disconnect = false;
        global.title = '';
        global.debug = false;
        global.editorOnly = false;
        return;
    }
    if (!characters)
        characters = { load: 0, characters: {} };
    if (!characters.characters[char]) {
        characters.characters[char] = { settings: path.join('{characters}', char + '.json'), map: path.join('{characters}', char + '.map') };
        var d = settings.Settings.load(parseTemplate(path.join('{data}', 'settings.json')));
        d.save(parseTemplate(characters.characters[char].settings));
        fs.writeFileSync(path.join(app.getPath('userData'), 'characters.json'), JSON.stringify(characters));
        if (isFileSync(parseTemplate(path.join('{data}', 'map.sqlite')))) {
            copyFile(parseTemplate(path.join('{data}', 'map.sqlite')), parseTemplate(characters.characters[char].map));
        }
    }
    global.character = char;
    global.settingsFile = parseTemplate(characters.characters[char].settings);
    global.mapFile = parseTemplate(characters.characters[char].map);
    global.characterLogin = characters.characters[char].name || (char || '').replace(/[^a-zA-Z0-9]+/g, '');
    global.dev = characters.characters[char].dev;
    global.disconnect = characters.characters[char].disconnect || false;
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
                label: '&Connect',
                id: 'connect',
                accelerator: 'CmdOrCtrl+N',
                click: () => {
                    executeScript('client.connect()', win, true);
                }
            },
            {
                label: '&Disconnect',
                id: 'disconnect',
                accelerator: 'CmdOrCtrl+D',
                enabled: false,
                click: () => {
                    executeScript('client.close()', win, true);
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
                click: () => {
                    executeScript('toggleParsing()', win, true);
                }
            },
            {
                label: 'E&nable triggers',
                id: 'enableTriggers',
                type: 'checkbox',
                checked: true,
                click: () => {
                    executeScript('toggleTriggers()', win, true);
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Ch&aracters...',
                id: 'characters',
                accelerator: 'CmdOrCtrl+H',
                click: () => {
                    executeScript('showCharacters()', win, true);
                }
            },
            { type: 'separator' },
            {
                label: '&Log',
                id: 'log',
                type: 'checkbox',
                checked: false,
                click: () => {
                    executeScript('toggleLogging()', win, true);
                }
            },
            {
                label: '&View logs...',
                click: () => {
                    executeScript('showLogViewer()', win, true);
                }
            },
            {
                type: 'separator'
            },
            {
                label: '&Preferences...',
                id: 'preferences',
                accelerator: 'CmdOrCtrl+Comma',
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
                label: 'Copy as HTML',
                accelerator: 'CmdOrCtrl+Alt+C',
                id: 'copyHTML',
                enabled: false,
                click: () => {
                    executeScript('copyAsHTML();', win, true);
                }
            },
            {
                label: 'Paste',
                accelerator: 'CmdOrCtrl+V',
                click: () => {
                    executeScript('$(\'#commandinput\').data(\'selStart\', client.commandInput[0].selectionStart);$(\'#commandinput\').data(\'selEnd\', client.commandInput[0].selectionEnd);paste()', win, true);
                }
            },
            {
                label: 'Paste special',
                accelerator: 'CmdOrCtrl+Shift+V',
                click: () => {
                    executeScript('$(\'#commandinput\').data(\'selStart\', client.commandInput[0].selectionStart);$(\'#commandinput\').data(\'selEnd\', client.commandInput[0].selectionEnd);pasteSpecial()', win, true);
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
                click: () => {
                    executeScript('selectAll()', win, true);
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Clear',
                click: () => {
                    executeScript('client.clear()', win, true);
                }
            },
            { type: 'separator' },
            {
                label: 'Find',
                accelerator: 'CmdOrCtrl+F',
                click: () => {
                    win.webContents.focus();
                    executeScript('client.display.showFind()', win, true);
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
                click: () => {
                    executeScript('client.toggleScrollLock()', win, true);
                }
            },
            {
                label: '&Who is on?...',
                click: () => {
                    executeScript('showWho()', win, true);
                    win.webContents.focus();
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
                        click: () => {
                            executeScript('toggleView("status")', win, true);
                        }
                    },
                    {
                        label: '&Refresh',
                        id: 'refresh',
                        click: () => {
                            executeScript('client.sendGMCP(\'Core.Hello { "client": "\' + client.telnet.terminal + \'", "version": "\' + client.telnet.version + \'" }\');', win, true);
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '&Weather',
                        id: 'weather',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("weather")', win, true);
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
                                click: () => {
                                    executeScript('toggleView("limbs")', win, true);
                                }
                            },
                            { type: 'separator' },
                            {
                                label: '&Health',
                                id: 'limbhealth',
                                type: 'checkbox',
                                checked: true,
                                click: () => {
                                    executeScript('toggleView("limbhealth")', win, true);
                                }
                            },
                            {
                                label: '&Armor',
                                id: 'limbarmor',
                                type: 'checkbox',
                                checked: true,
                                click: () => {
                                    executeScript('toggleView("limbarmor")', win, true);
                                }
                            },
                        ]
                    },
                    {
                        label: '&Health',
                        id: 'health',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("health")', win, true);
                        }
                    },
                    {
                        label: '&Experience',
                        id: 'experience',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("experience")', win, true);
                        }
                    },
                    {
                        label: '&Party Health',
                        id: 'partyhealth',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("partyhealth")', win, true);
                        }
                    },
                    {
                        label: '&Combat Health',
                        id: 'combathealth',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("combathealth")', win, true);
                        }
                    },
                    {
                        label: '&Lag meter',
                        id: 'lagmeter',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("lagmeter")', win, true);
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
                  executeScript('toggleView("buttons")', win, true);
                },
                */
                submenu: [
                    {
                        label: '&Visible',
                        id: 'buttonsvisible',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("buttons")', win, true);
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '&Connect',
                        id: 'connectbutton',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("button.connect")', win, true);
                        }
                    },
                    {
                        label: '&Characters',
                        id: 'charactersbutton',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("button.characters")', win, true);
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
                        click: () => {
                            executeScript('toggleView("button.preferences")', win, true);
                        }
                    },
                    {
                        label: '&Log',
                        id: 'logbutton',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("button.log")', win, true);
                        }
                    },
                    {
                        label: '&Clear',
                        id: 'clearbutton',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("button.clear")', win, true);
                        }
                    },
                    {
                        label: '&Lock',
                        id: 'lockbutton',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("button.lock")', win, true);
                        }
                    },
                    {
                        label: '&Map',
                        id: 'mapbutton',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("button.map")', win, true);
                        }
                    },
                    /*
                    {
                      label: 'M&ail',
                      id: "mailbutton",
                      type: 'checkbox',
                      checked: true,
                      click: () => {
                        executeScript('toggleView("button.mail")', win, true);
                      }
                    },
                    {
                      label: '&Compose mail',
                      id: "composebutton",
                      type: 'checkbox',
                      checked: true,
                      click: () => {
                        executeScript('toggleView("button.compose")', win, true);
                      }
                    },
                    */
                    {
                        label: '&User buttons',
                        id: 'userbutton',
                        type: 'checkbox',
                        checked: true,
                        click: () => {
                            executeScript('toggleView("button.user")', win, true);
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
                    win.webContents.focus();
                }
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
                    executeScript('showImmortalTools()', win, true);
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
            {
                label: '&Skills...',
                id: 'skills',
                click: () => {
                    executeScript('showSkills()', win, true);
                },
                accelerator: 'CmdOrCtrl+S'
            },
            {
                label: '&Command history...',
                id: 'history',
                click: () => {
                    executeScript('showCommandHistory()', win, true);
                },
                accelerator: 'CmdOrCtrl+Shift+H'
            },
            /*
            {
              label: '&Mail...',
              click: () => {
                executeScript('showMail()', win, true);
              },
              visible: true,
              //accelerator: 'CmdOrCtrl+M'
            },
            {
              label: '&Compose mail...',
              click: () => {
                executeScript('showComposer()', win, true);
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
                click: () => {
                    executeScript('showSMHelp()', win, true);
                }
            },
            {
                label: '&jiMUD...',
                click: () => {
                    executeScript('showHelp()', win, true);
                }
            },
            {
                label: '&jiMUD website...',
                click: () => {
                    shell.openExternal('https://github.com/icewolfz/jiMUD/tree/master/docs', '_blank');
                    win.webContents.focus();
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

let menubar;

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
                    click: (item) => {
                        window.webContents.inspectElement(item.x, item.y);
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
                        click: (item) => {
                            executeScript(`(function spellTemp() {
                                var el = $(document.elementFromPoint(${item.x}, ${item.y}));
                                var value = el.val();
                                var start = el[0].selectionStart;
                                var wStart = start + ${item.idx};
                                value = value.substring(0, wStart) + '${item.label}' + value.substring(wStart + ${item.word.length});
                                el.val(value);
                                el[0].selectionStart = start;
                                el[0].selectionEnd = start + ${item.label.length + item.sel};
                                ${((window !== winCode) ? 'el.blur();\n' : '')}
                                el.focus();
                            })();`, window, true);
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
            click: () => {
                executeScript('client.toggleProfile("default")', win, true);
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
    menubar = Menu.buildFromTemplate(menuTemp);
    win.setMenu(menubar);
    Menu.setApplicationMenu(menubar);
    win.webContents.send('menu-reload');
}

function profileToggle(menuItem) {
    if (!win || !win.webContents) return;
    executeScript('client.toggleProfile("' + menuItem.label.toLowerCase() + '")', win, true);
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
                showSelectedWindow();
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
            label: 'Ch&aracters...',
            id: 'characters',
            click: () => {
                restoreWindowState(win, getWindowState('main') || getWindowState('main', win), true, true);
                executeScript('showCharacters()', win, true);
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
            label: '&Who is on?...',
            click: () => {
                executeScript('showWho()', win, true);
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
                        executeScript('showSMHelp()', win, true);
                    }
                },
                {
                    label: '&jiMUD...',
                    click: () => {
                        executeScript('showHelp()', win, true);
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
                        showAbout();
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
        switch (set.trayClick) {
            case TrayClick.show:
                showSelectedWindow();
                break;
            case TrayClick.toggle:
                if (win.isVisible()) {
                    if (set.hideOnMinimize)
                        win.hide();
                    else
                        win.minimize();
                }
                else
                    restoreWindowState(win, getWindowState('main') || getWindowState('main', win), true, true);
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
        switch (set.trayClick) {
            case TrayClick.show:
                showSelectedWindow();
                break;
            case TrayClick.toggle:
                if (win.isVisible()) {
                    if (set.hideOnMinimize)
                        win.hide();
                    else
                        win.minimize();
                }
                else
                    restoreWindowState(win, getWindowState('main') || getWindowState('main', win), true, true);
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
        d = ' to Development';
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
    require("@electron/remote/main").enable(win.webContents);

    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));
    /*
    if(s.maximized) {
        let wSize = screen.getPrimaryDisplay().workAreaSize;
        win.setContentSize(wSize.width, wSize.height);
    }
    */
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
        states.main.maximized = true;
    });

    win.on('unmaximize', () => {
        trackWindowState('main', win);
        states.main.maximized = false;
    });

    win.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!win)
                return;
            if (result.response === 0) {
                win.reload();
                logError('Client unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                set = settings.Settings.load(global.settingsFile);
                set.windows.main = getWindowState('main', win);
                if (winMap) {
                    set.windows.mapper = getWindowState('mapper', winMap);
                    win.webContents.send('setting-changed', { type: 'window', name: 'mapper', value: set.windows.mapper, noSave: true });
                    executeScript('closeWindow()', winMap);
                    winMap = null;
                }
                if (winEditor) {
                    set.windows.editor = getWindowState('editor', winEditor);
                    win.webContents.send('setting-changed', { type: 'window', name: 'editor', value: set.windows.editor, noSave: true });
                    winEditor.close();
                    winEditor = null;
                }
                if (winChat) {
                    set.windows.chat = getWindowState('chat', winChat);
                    win.webContents.send('setting-changed', { type: 'window', name: 'chat', value: set.windows.chat, noSave: true });
                    winChat.close();
                    winChat = null;
                }
                if (winCode) {
                    if (!edSet)
                        edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
                    if (global.editorOnly)
                        edSet.stateOnly = getWindowState('code-editor', winCode);
                    else {
                        if (winCode != null)
                            edSet.window.show = true;
                        edSet.state = getWindowState('code-editor', winCode);
                    }
                    edSet.save(parseTemplate(path.join('{data}', 'editor.json')));
                    executeScript('closeWindow()', winCode);
                    winCode = null;
                }
                closeWindows(false, true);
                logError('Client unresponsive, closed.\n', true);
                set.save(global.settingsFile);
                win.destroy();
                win = null;
            }
            else
                logError('Client unresponsive, waiting.\n', true);
        });
    });

    win.on('minimize', () => {
        if (set.hideOnMinimize)
            win.hide();
    });

    win.webContents.on('render-process-gone', (event, details) => {
        logError(`Client render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    win.webContents.setWindowOpenHandler((details) => {
        var u = new url.URL(details.url);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
            shell.openExternal(details.url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: buildOptions(details, win, set)
        }
    });

    win.webContents.on('did-create-window', (w, details) => {
        let frameName = details.frameName;
        let url = details.url;
        if (global.debug)
            w.webContents.openDevTools();
        require("@electron/remote/main").enable(w.webContents);
        w.removeMenu();
        w.once('ready-to-show', () => {
            loadWindowScripts(w, frameName);
            addInputContext(w, set && set.spellchecking);
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

        w.on('closed', () => {
            if (win && !win.isDestroyed() && win.webContents) {
                executeScript(`childClosed('${url}', '${frameName}');`, win, true);
                win.focus();
            }
        });
    });

    // Emitted when the window is closed.
    win.on('closed', () => {
        if (winMap) {
            set.windows.mapper = getWindowState('mapper', winMap);
            //win.webContents.send('setting-changed', { type: 'window', name: 'mapper', value: set.windows.mapper, noSave: true });
            executeScript('closeWindow()', winMap);
            winMap = null;
        }
        if (winEditor) {
            set.windows.editor = getWindowState('editor', winEditor);
            //win.webContents.send('setting-changed', { type: 'window', name: 'editor', value: set.windows.editor, noSave: true });
            winEditor.close();
            winEditor = null;
        }
        if (winChat) {
            set.windows.chat = getWindowState('chat', winChat);
            //win.webContents.send('setting-changed', { type: 'window', name: 'chat', value: set.windows.chat, noSave: true });
            winChat.close();
            winChat = null;
        }
        if (winCode && winCode.getParentWindow() == win) {
            if (!edSet)
                edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
            if (global.editorOnly)
                edSet.stateOnly = getWindowState('code-editor', winCode);
            else {
                edSet.state = getWindowState('code-editor', winCode);
                edSet.window.show = true;
            }
            edSet.save(parseTemplate(path.join('{data}', 'editor.json')));
            executeScript('closeWindow()', winCode);
            winCode = null;
        }
        closeWindows(true, false);
        set.save(global.settingsFile);
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });

    win.once('ready-to-show', async () => {
        createMenu();
        loadMenu();

        //addInputContext(win, set && set.spellchecking);
        if (isFileSync(path.join(app.getPath('userData'), 'monsters.css'))) {
            fs.readFile(path.join(app.getPath('userData'), 'monsters.css'), 'utf8', (err, data) => {
                win.webContents.insertCSS(parseTemplate(data));
            });
        }
        loadWindowScripts(win, 'user');
        await executeScript('loadTheme(\'' + set.theme.replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\');updateInterface();', win);
        //win.setContentSize(s.width, s.height);
        restoreWindowState(win, s, true);
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
            if (name === 'main') continue;
            if (set.windows[name].options) {
                if (set.windows[name].options.show)
                    showWindow(name, set.windows[name].options, true);
                else if (set.windows[name].options.persistent)
                    createNewWindow(name, set.windows[name].options);
            }
            else {
                if (set.windows[name].show)
                    showWindow(name, set.windows[name], true);
                else if (set.windows[name].persistent)
                    createNewWindow(name, set.windows[name]);
            }
        }
        set.save(global.settingsFile);

        if (!edSet)
            edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
        if (edSet.window.show)
            showCodeEditor(true);
        else if (!global.editorOnly && edSet.window.persistent)
            createCodeEditor();
        updateJumpList();
        checkForUpdates();
    });

    win.on('close', (e) => {
        set = settings.Settings.load(global.settingsFile);
        set.windows.main = getWindowState('main', win || e.sender);
        win.webContents.send('setting-changed', { type: 'window', name: 'main', value: set.windows.main, noSave: true });
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
            executeScript('closeHidden()', winMap);
        set.save(global.settingsFile);
    });
}

function resetProfiles() {
    updateMenuItem({ menu: ['profiles', 'default'], checked: false });
    var p = path.join(app.getPath('userData'), 'profiles');
    if (isDirSync(p)) {
        var files = fs.readdirSync(p);
        for (var i = 0; i < files.length; i++) {
            if (path.extname(files[i]) !== '.json')
                continue;
            updateMenuItem({ menu: ['profiles', path.basename(files[i], '.json')], checked: false });
        }
    }
}

if (argv['disable-gpu'])
    app.disableHardwareAcceleration();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    if (!existsSync(path.join(app.getPath('userData'), 'characters')))
        fs.mkdirSync(path.join(app.getPath('userData'), 'characters'));

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

app.on('before-quit', (e) => {
    if (winProfiles) {
        e.preventDefault();
        dialog.showMessageBox(winProfiles, {
            type: 'warning',
            title: 'Close profile manager',
            message: 'You must close the profile manager before you can exit.'
        });
        set.save(global.settingsFile);
    }
});

ipcMain.on('check-for-updates', checkForUpdatesManual);

ipcMain.on('reload', (event, char) => {
    //already loaded so no need to reload
    if (char === global.character)
        return;
    reload = char;
    win.close();
});

ipcMain.on('load-default', () => {
    var name;
    var cWin;
    //already loaded so no need to switch
    var sf = parseTemplate(path.join('{data}', 'settings.json'));
    var mf = parseTemplate(path.join('{data}', 'map.sqlite'));
    if (sf === global.settingsFile && mf === global.mapFile) {
        for (name in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
                continue;
            windows[name].webContents.send('load-default', true);
        }
        return;
    }
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('load-default');
    global.settingsFile = sf;
    global.mapFile = mf;
    resetProfiles();
    set = settings.Settings.load(global.settingsFile);

    if (winMap) {
        executeScript('closeWindow()', winMap);
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
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
            continue;
        executeScript('closed();', windows[name].window);
        set.windows[name] = getWindowState(name, windows[name].window);
        set.windows[name].options = copyWindowOptions(name);
        cWin = windows[name].window;
        windows[name].window = null;
        cWin.close();
    }
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('change-options', global.settingsFile, true);

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
    if (!edSet)
        edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
    if (edSet.window.show)
        showCodeEditor(true);
    else if (!global.editorOnly && edSet.window.persistent)
        createCodeEditor();
});

ipcMain.on('load-char', (event, char) => {
    var name;
    //already loaded so no need to switch
    if (char === global.character) {
        loadCharacter(char);
        win.webContents.send('load-char', char, true);
        if (winMap)
            winMap.webContents.send('load-char', char, true);
        for (name in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
                continue;
            windows[name].window.webContents.send('load-char', char, true);
        }
        return;
    }
    closeWindows(false, true);
    set.windows.main = getWindowState('main', win);
    if (winMap) {
        set.windows.mapper = getWindowState('mapper', winMap);
        win.webContents.send('setting-changed', { type: 'window', name: 'mapper', value: set.windows.mapper, noSave: true });
        executeScript('closeWindow()', winMap);
        winMap = null;
    }
    if (winEditor) {
        set.windows.editor = getWindowState('editor', winEditor);
        win.webContents.send('setting-changed', { type: 'window', name: 'editor', value: set.windows.editor, noSave: true });
        winEditor.close();
        winEditor = null;
    }
    if (winChat) {
        set.windows.chat = getWindowState('chat', winChat);
        win.webContents.send('setting-changed', { type: 'window', name: 'chat', value: set.windows.chat, noSave: true });
        winChat.close();
        winChat = null;
    }
    set.save(global.settingsFile);
    loadCharacter(char);
    resetProfiles();
    set = settings.Settings.load(global.settingsFile);
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('load-char', char);

    if (winMap) {
        executeScript('closeWindow()', winMap);
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
        executeScript('closeWindow()', winCode);
        winCode = null;
    }
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('change-options', global.settingsFile, true);

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

    if (!edSet)
        edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
    if (edSet.window.show)
        showCodeEditor(true);
    else if (!global.editorOnly && edSet.window.persistent)
        createCodeEditor();

    for (name in set.windows) {
        if (name === 'main') continue;
        if (set.windows[name].options) {
            if (set.windows[name].options.show)
                showWindow(name, set.windows[name].options, true);
            else if (set.windows[name].options.persistent)
                createNewWindow(name, set.windows[name].options);
        }
        else {
            if (set.windows[name].show)
                showWindow(name, set.windows[name], true);
            else if (set.windows[name].persistent)
                createNewWindow(name, set.windows[name]);
        }
    }
    set.save(global.settingsFile);
});

ipcMain.on('options-changed', () => {
    set = settings.Settings.load(global.settingsFile);
});

ipcMain.on('reload-options', (event, save) => {
    var s;
    resetProfiles();
    closeWindows(save, true, true);
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('reload-options');
    set = settings.Settings.load(global.settingsFile);
    if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.setBackgroundThrottling(set.enableBackgroundThrottling);
        win.setSkipTaskbar(!set.showInTaskBar ? true : false);
    }
    if (set.showTrayIcon && !tray)
        createTray();
    else if (!set.showTrayIcon && tray) {
        tray.destroy();
        tray = null;
    }

    if (winMap) {
        s = loadWindowState('mapper');
        winMap.setBounds({ x: s.x, y: s.y, width: s.width, height: s.height });
        winMap.webContents.send('reload-options');
        if (winMap.setParentWindow)
            winMap.setParentWindow(set.mapper.alwaysOnTopClient ? win : null);
        winMap.setAlwaysOnTop(set.mapper.alwaysOnTop);
        winMap.setSkipTaskbar((!set.mapper.showInTaskBar && (set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop)) ? true : false);
        winMap.webContents.setBackgroundThrottling(set.enableBackgroundThrottling);
    }
    else if (set.mapper.enabled)
        createMapper();
    if (winChat) {
        s = loadWindowState('chat');
        winChat.setBounds({ x: s.x, y: s.y, width: s.width, height: s.height });
        winChat.webContents.send('reload-options');
        if (winChat.setParentWindow)
            winChat.setParentWindow(set.chat.alwaysOnTopClient ? win : null);
        winChat.setAlwaysOnTop(set.chat.alwaysOnTop);
        winChat.setSkipTaskbar((!set.chat.showInTaskBar && (set.chat.alwaysOnTopClient || set.chat.alwaysOnTop)) ? true : false);
        winChat.webContents.setBackgroundThrottling(set.enableBackgroundThrottling);
    }

    if (winProfiles) {
        s = loadWindowState('profiles');
        winProfiles.setBounds({ x: s.x, y: s.y, width: s.width, height: s.height });
        winProfiles.webContents.send('reload-options');
        winProfiles.webContents.setBackgroundThrottling(set.enableBackgroundThrottling);
    }
    if (winEditor) {
        s = loadWindowState('editor');
        winEditor.setBounds({ x: s.x, y: s.y, width: s.width, height: s.height });
        winEditor.webContents.send('reload-options');
        winEditor.webContents.setBackgroundThrottling(set.enableBackgroundThrottling);
    }

    for (var name in set.windows) {
        if (name === 'main') continue;
        if (set.windows[name].window) {
            s = loadWindowState(name);
            set.windows[name].window.setBounds({ x: s.x, y: s.y, width: s.width, height: s.height });
            if (set.windows[name].window.webContents)
                set.windows[name].window.webContents.setBackgroundThrottling(set.enableBackgroundThrottling);
        }
        if (set.windows[name].options) {
            if (set.windows[name].options.show)
                showWindow(name, set.windows[name].options, true);
            else if (set.windows[name].options.persistent)
                createNewWindow(name, set.windows[name].options);
        }
        else {
            if (set.windows[name].show)
                showWindow(name, set.windows[name], true);
            else if (set.windows[name].persistent)
                createNewWindow(name, set.windows[name]);
        }
    }
    set.save(global.settingsFile);

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
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
            continue;
        windows[name].window.webContents.send('set-title', title);
    }
    updateTray();
});

ipcMain.on('closed', () => {
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
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
            continue;
        windows[name].window.webContents.send('closed');
    }
});

ipcMain.on('connected', () => {
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
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
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
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
            continue;
        windows[name].window.webContents.send('set-color', type, color, code, window);
    }
});

ipcMain.on('open-editor', (event, file, remote, remoteEdit) => {
    showCodeEditor();
    openEditor(file, remote, remoteEdit);
});

function openEditor(file, remote, remoteEdit) {
    if (codeReady !== 2 || !winCode) {
        setTimeout(() => {
            openEditor(file, remote, remoteEdit);
        }, 1000);
    }
    else {
        winCode.webContents.send('open-editor', file, remote, remoteEdit);
    }
}

ipcMain.on('send-background', (event, command, noEcho, comments) => {
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('send-background', command, noEcho, comments);
});

ipcMain.on('send-command', (event, command, noEcho, comments) => {
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('send-command', command, noEcho, comments);
});

ipcMain.on('send-gmcp', (event, data) => {
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('send-gmcp', data);
});

ipcMain.on('send-raw', (event, raw) => {
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('send-raw', raw);
});

ipcMain.on('send', (event, raw, echo) => {
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('send', raw, echo);
});

ipcMain.on('send-editor', (event, text, window, show, args) => {
    if (show)
        showSelectedWindow(window, args);
    sendEditor(text, window);
});

function sendEditor(text, window) {
    if ((codeReady !== 2 || !winCode || !winCode.isVisible()) && window === 'code-editor') {
        setTimeout(() => {
            sendEditor(text, window);
        }, 1000);
    }
    else if ((editorReady !== 2 || !winEditor || !winEditor.isVisible()) && window === 'editor') {
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
            if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
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
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('debug', msg);
});

ipcMain.on('error', (event, err) => {
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('error', err);
});

ipcMain.on('reload-mail', () => {
    createMenu();
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('reload-mail');
    for (var name in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window || !windows[name].window.webContents)
            continue;
        windows[name].window.webContents.send('reload-mail');
    }
});

ipcMain.on('reload-profiles', () => {
    createMenu();
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('reload-profiles');
    for (var name in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window || !windows[name].window.webContents)
            continue;
        windows[name].window.webContents.send('reload-profiles');
    }
});

ipcMain.on('chat', (event, text) => {
    sendChat(text);
    for (var name in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
            continue;
        windows[name].window.webContents.send('chat', text);
    }
});

function sendChat(text) {
    if (chatReady !== 2 || !winChat) {
        setTimeout(() => { sendChat(text); }, 100);
        return;
    }
    else
        winChat.webContents.send('chat', text);
}

ipcMain.on('profile-edit-item', (event, profile, type, index) => {
    showProfiles();
    profileEditItem(profile, type, index);
});

function profileEditItem(profile, type, index) {
    if (profilesReady !== 2 || !winProfiles) {
        setTimeout(() => { profileEditItem(profile, type, index); }, 100);
        return;
    }
    else
        winProfiles.webContents.send('profile-edit-item', profile, type, index);
}

ipcMain.on('setting-changed', (event, data) => {
    if (data.type === 'mapper' && data.name === 'alwaysOnTopClient') {
        if (winMap.setParentWindow)
            winMap.setParentWindow(data.value ? win : null);
        winMap.setSkipTaskbar((!set.mapper.showInTaskBar && (set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop)) ? true : false);
    }
    if (data.type === 'mapper' && data.name === 'setAlwaysOnTop') {
        winMap.setAlwaysOnTop(data.value);
        winMap.setSkipTaskbar((!set.mapper.showInTaskBar && (set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop)) ? true : false);
    }
    if (win && event.sender != win.webContents) {
        win.webContents.send('setting-changed', data);
        win.setSkipTaskbar(!set.showInTaskBar ? true : false);
    }
    if (winMap && event.sender != winMap.webContents)
        winMap.webContents.send('setting-changed', data);

    if (data.type === 'chat' && data.name === 'alwaysOnTopClient') {
        if (winChat.setParentWindow)
            winChat.setParentWindow(data.value ? win : null);
        winChat.setSkipTaskbar((!set.chat.showInTaskBar && (set.chat.alwaysOnTopClient || set.chat.alwaysOnTop)) ? true : false);
    }
    if (data.type === 'chat' && data.name === 'setAlwaysOnTop') {
        winChat.setAlwaysOnTop(data.value);
        winChat.setSkipTaskbar((!set.chat.showInTaskBar && (set.chat.alwaysOnTopClient || set.chat.alwaysOnTop)) ? true : false);
    }
    if (data.type === 'mapper' && data.name === 'enabled' && !winMap && data.value)
        createMapper();
    if (!winChat && data.type === 'chat' && (data.name === 'captureTells' || data.name === 'captureTalk' || data.name === 'captureLines')) {
        if (data.value)
            createChat();
    }
    var name;
    if (data.type === 'windows')
        for (name in windows) {
            if (name === 'main' || !Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
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
    if (data.type === 'extensions')
        for (name in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
                continue;
            if (windows[name].window)
                windows[name].window.webContents.send('setting-changed', data);
        }
});

ipcMain.on('editor-setting-changed', (event, data) => {
    if (winCode) {
        winCode.webContents.send('editor-setting-changed');
        if (edSet)
            winCode.webContents.setBackgroundThrottling(edSet.enableBackgroundThrottling);
    }
    if (winCode.setParentWindow)
        winCode.setParentWindow((!global.editorOnly && data.alwaysOnTopClient) ? win : null);
    winCode.setSkipTaskbar((!global.editorOnly && (data.alwaysOnTopClient || data.alwaysOnTop)) ? true : false);
    if (!global.editorOnly && data.persistent && !winCode)
        createCodeEditor();
});

ipcMain.on('editor-settings-saved', () => {
    edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
});

ipcMain.on('GMCP-received', (event, data) => {
    if (winMap)
        winMap.webContents.send('GMCP-received', data);
    if (winCode)
        winCode.webContents.send('GMCP-received', data);
    for (var name in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
            continue;
        windows[name].window.webContents.send('GMCP-received', data);
    }
});

ipcMain.on('request-command-history', () => {
    if (win)
        win.webContents.send('request-command-history');
});

ipcMain.on('change-command-history-index', (event, index) => {
    if (win)
        win.webContents.send('change-command-history-index', index);
});

ipcMain.on('add-command-history', (event, cmd) => {
    if (win)
        win.webContents.send('add-command-history', cmd);
});

ipcMain.on('clear-command-history', () => {
    if (win)
        win.webContents.send('clear-command-history');
});

ipcMain.on('command-history', (event, history) => {
    if (winMap)
        winMap.webContents.send('command-history', history);
    if (winCode)
        winCode.webContents.send('command-history', history);
    for (var name in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
            continue;
        windows[name].window.webContents.send('command-history', history);
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
            if (process.platform === 'linux')
                win.setIcon(path.join(__dirname, '../assets/icons/png/connected2.png'));
            else
                win.setOverlayIcon(path.join(__dirname, '../assets/icons/png/connected.png'), 'Connected');
            break;
        case 2:
            if (process.platform === 'linux')
                win.setIcon(path.join(__dirname, '../assets/icons/png/connectednonactive2.png'));
            else
                win.setOverlayIcon(path.join(__dirname, '../assets/icons/png/connectednonactive.png'), 'Received data');
            break;
        default:
            if (process.platform === 'linux')
                win.setIcon(path.join(__dirname, '../assets/icons/png/disconnected2.png'));
            else
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
    if (window == 'mapper') {
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

ipcMain.on('progress-show', (event, title) => {
    if (winProgress != null) {
        if (!progressReady) return;
        winProgress.show();
        if (typeof title === 'string')
            setProgressTitle(title);
        else if (title)
            setProgress(title);
    }
    else {
        progressReady = 0;
        var sender = BrowserWindow.fromWebContents(event.sender);
        var b = sender.getBounds();
        winProgress = new BrowserWindow({
            parent: sender,
            modal: true,
            x: Math.floor(b.x + b.width / 2 - 100),
            y: Math.floor(b.y + b.height / 2 - 35),
            width: 200,
            height: 70,
            movable: false,
            minimizable: false,
            maximizable: false,
            skipTaskbar: true,
            resizable: false,
            frame: false,
            title: title,
            icon: path.join(__dirname, '../assets/icons/png/progress.png'),
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
        require("@electron/remote/main").enable(winProgress.webContents);
        winProgress.removeMenu();
        winProgress.on('closed', () => {
            winProgress = null;
            progressReady = 3;
        });
        winProgress.loadURL(url.format({
            pathname: path.join(__dirname, 'progress.html'),
            protocol: 'file:',
            slashes: true
        }));

        if (global.debug)
            winProgress.webContents.openDevTools();

        winProgress.webContents.on('did-finish-load', () => {
            progressReady = 2;
        });

        winProgress.once('ready-to-show', () => {
            if (progressReady !== 2)
                progressReady = 1;
            winProgress.show();
            if (typeof title === 'string')
                setProgressTitle(title);
            else if (title)
                setProgress(title);
        });

        winProgress.webContents.on('render-process-gone', (event, details) => {
            logError(`Progress render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
        });
        winProgress.on('unresponsive', () => {
            dialog.showMessageBox({
                type: 'info',
                message: 'Unresponsive',
                buttons: ['Reopen', 'Keep waiting', 'Close']
            }).then(result => {
                if (!winProgress)
                    return;
                if (result.response === 0) {
                    winProgress.reload();
                    logError('Progress unresponsive, reload.\n', true);
                }
                else if (result.response === 2) {
                    winProgress.destroy();
                }
                else
                    logError('Progress unresponsive, waiting.\n', true);
            });
        });
    }
});

ipcMain.on('progress', (event, progressObj) => {
    setProgress(progressObj);
});

ipcMain.on('progress-close', (event, progressObj) => {
    if (winProgress)
        winProgress.webContents.send('progress-close', progressObj);
    if (win)
        win.setProgressBar(0);
    else if (global.editorOnly && winCode)
        winCode.setProgressBar(0);
});

ipcMain.on('get-skills', (event, window) => {
    if (win)
        win.webContents.send('get-skills', window);
});

ipcMain.on('skills', (event, skills, window) => {
    if (window) {
        if (!Object.prototype.hasOwnProperty.call(windows, window) || !windows[window].window)
            return;
        windows[window].window.webContents.send('skills', skills);
    }
    else
        for (let name in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
                continue;
            windows[name].window.webContents.send('skills', skills);
        }
});

ipcMain.on('skill-updated', (event, skill, data) => {
    for (let name in windows) {
        if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
            continue;
        windows[name].window.webContents.send('skill-updated', skill, data);
    }
});

ipcMain.on('skills-reset', (event, window) => {
    if (window) {
        if (!Object.prototype.hasOwnProperty.call(windows, window) || !windows[window].window)
            return;
        windows[window].window.webContents.send('skills-reset');
    }
    else
        for (let name in windows) {
            if (!Object.prototype.hasOwnProperty.call(windows, name) || !windows[name].window)
                continue;
            windows[name].window.webContents.send('skills-reset');
        }
});

function setProgress(progressObj) {
    clearTimeout(_winProgressTimer);
    if (progressReady === 3) return;
    if (progressReady !== 2)
        _winProgressTimer = setTimeout(() => setProgress(progressObj), 100);
    else {
        winProgress.webContents.send('progress', progressObj);
        if (win)
            win.setProgressBar((progressObj.value || progressObj.percent) / 100, progressObj.options);
        else if (global.editorOnly && winCode)
            winCode.setProgressBar((progressObj.value || progressObj.percent) / 100, progressObj.options);
    }
}

function setProgressTitle(title) {
    if (progressReady === 3) return;
    if (progressReady !== 2 || !winProgress)
        setTimeout(() => setProgressTitle(title), 100);
    else
        winProgress.webContents.send('progress-title', title);
}

ipcMain.on('progress-title', (event, title) => {
    setProgressTitle(title);
});

ipcMain.on('progress-closed', () => {
    if (winProgress && winProgress.getParentWindow())
        winProgress.getParentWindow().webContents.send('progress-closed');
    setProgress({ percent: 0 });
});

ipcMain.on('progress-canceled', async () => {
    if (winProgress && winProgress.getParentWindow()) {
        winProgress.getParentWindow().webContents.send('progress-canceled');
        await executeScript('progressCanceled()', winProgress.getParentWindow());
    }
    setProgress({ percent: 0 });
});

ipcMain.on('progress-loaded', () => {
    if (winProgress && winProgress.getParentWindow())
        winProgress.getParentWindow().webContents.send('progress-loaded');
});

ipcMain.on('progress-cancelable', (enable) => {
    if (winProgress)
        winProgress.webContents.send('progress-cancelable', enable);
});

ipcMain.on('show-window', (event, window, args) => {
    showSelectedWindow(window, args);
});

function showSelectedWindow(window, args) {
    if (!window || window === 'main') {
        if (global.editorOnly)
            restoreWindowState(winCode, getWindowState('code-editor') || getWindowState('code-editor', winCode), true, true);
        else
            restoreWindowState(win, getWindowState('main') || getWindowState('main', win), true, true);
    }
    else if (window === 'about')
        showAbout();
    else if (window === 'prefs')
        showPrefs();
    else if (window === 'mapper')
        showMapper();
    else if (window === 'editor')
        showEditor();
    else if (window === 'profiles')
        showProfiles();
    else if (window === 'chat')
        showChat();
    else if (window === 'color')
        showColor(args);
    else if (window === 'code-editor')
        showCodeEditor();
    else if (windows[window] && windows[window].window)
        showWindow(window, windows[window], false);
    else
        createNewWindow(window, args);
}

ipcMain.on('import-map', (event, data) => {
    if (winMap)
        winMap.webContents.send('import', data);
    else if (data) {
        createMapper(false, true, () => { winMap.webContents.send('import', data); });
    }
});

ipcMain.on('flush', (event, sender) => {
    if (winMap)
        winMap.webContents.send('flush', sender);
    else if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('flush-end', sender);
});

ipcMain.on('flush-end', (event, sender) => {
    if (win && !win.isDestroyed() && win.webContents)
        win.webContents.send('flush-end', sender);
});

ipcMain.on('reload-characters', () => {
    loadCharacters(true);
    if (global.character)
        loadCharacter(global.character);
});

ipcMain.on('profile-item-added', (event, type, profile, item) => {
    if (winProfiles)
        winProfiles.webContents.send('profile-item-added', type, profile, item);
});

ipcMain.on('profile-item-updated', (event, type, profile, idx, item) => {
    if (winProfiles)
        winProfiles.webContents.send('profile-item-updated', type, profile, idx, item);
});

ipcMain.on('profile-item-removed', (event, type, profile, idx) => {
    if (winProfiles)
        winProfiles.webContents.send('profile-item-removed', type, profile, idx);
});

ipcMain.on('profile-updated', (event, profile, noChanges, type) => {
    if (winProfiles)
        winProfiles.webContents.send('profile-updated', profile, noChanges, type);
});

ipcMain.on('profile-toggled', (event, profile, enabled) => {
    if (winProfiles)
        winProfiles.webContents.send('profile-toggled', profile, enabled);
});

ipcMain.on('profile-enabled', (event, profile) => {
    if (winProfiles)
        winProfiles.webContents.send('profile-enabled', profile);
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
        case 'mapFile':
            event.returnValue = global.mapFile;
            break;
        case 'profiles':
            event.returnValue = global.profiles;
            break;
        case 'character':
            event.returnValue = global.character;
            break;
        case 'characterLogin':
            event.returnValue = global.characterLogin;
            break;
        case 'characterPass':
            event.returnValue = global.characterPass;
            break;
        case 'dev':
            event.returnValue = global.dev;
            break;
        case 'disconnect':
            event.returnValue = global.disconnect;
            break;
        case 'title':
            event.returnValue = global.title;
            break;
        case 'debug':
            event.returnValue = global.debug;
            break;
        case 'connected':
            event.returnValue = global.connected;
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
        case 'mapFile':
            global.mapFile = value;
            break;
        case 'profiles':
            global.profiles = value;
            break;
        case 'character':
            global.character = value;
            break;
        case 'characterLogin':
            global.characterLogin = value;
            break;
        case 'characterPass':
            global.characterPass = value;
            break;
        case 'dev':
            global.dev = value;
            break;
        case 'disconnect':
            global.disconnect = value;
            break;
        case 'title':
            global.title = value;
            break;
        case 'debug':
            global.debug = value;
            break;
        case 'connected':
            global.connected = value;
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
    if (!current) return;
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

ipcMain.on('window-info', (event, info, ...args) => {
    if (info === "child-count") {
        var wins = BrowserWindow.getAllWindows();
        var current = BrowserWindow.fromWebContents(event.sender);
        var count = 0;
        for (var w = 0, wl = wins.length; w < wl; w++) {
            if (wins[w] === current || !wins[w].isVisible())
                continue;
            if (wins[w].getParentWindow() !== current)
                continue;
            count++;
        }
        event.returnValue = count;
    }
    else if (info === 'child-open') {
        if (!args || args.length === 0) {
            event.returnValue = 0;
            return
        }
        var wins = BrowserWindow.getAllWindows();
        var current = BrowserWindow.fromWebContents(event.sender);
        for (var w = 0, wl = wins.length; w < wl; w++) {
            if (wins[w] === current || !wins[w].isVisible())
                continue;
            if (v[w].getTitle().startsWith(args[0]) && v[w].getParentWindow() === current) {
                event.returnValue = 1;
                return;
            }
        }
        event.returnValue = 0;
    }
    else if (info === 'child-close') {
        var wins = BrowserWindow.getAllWindows();
        var current = BrowserWindow.fromWebContents(event.sender);
        var count = 0;
        for (var w = 0, wl = wins.length; w < wl; w++) {
            if (wins[w] === current || !wins[w].isVisible())
                continue;
            if (args.length && !wins[w].getTitle().startsWith(args[0])) {
                //make sure proper close systems called
                for (let name in windows) {
                    if (!Object.prototype.hasOwnProperty.call(windows, name) || windows[name].window != wins[w])
                        continue;
                    executeScript('if(closing) closing();', windows[name].window);
                    executeScript('if(closed) closed();', windows[name].window);
                    set.windows[name] = getWindowState(name, windows[name].window);
                    set.windows[name].options = copyWindowOptions(name);
                    windows[name].window = null;
                    delete windows[name];
                }
                if (winMap == wins[w]) {
                    set.windows.mapper = getWindowState('mapper', winMap);
                    win.webContents.send('setting-changed', { type: 'window', name: 'mapper', value: set.windows.mapper, noSave: true });
                    executeScript('closeWindow()', winMap);
                    winMap = null;
                }
                if (winEditor == wins[w]) {
                    set.windows.editor = getWindowState('editor', winEditor);
                    win.webContents.send('setting-changed', { type: 'window', name: 'editor', value: set.windows.editor, noSave: true });
                    winEditor = null;
                }
                if (winChat == wins[w]) {
                    set.windows.chat = getWindowState('chat', winChat);
                    win.webContents.send('setting-changed', { type: 'window', name: 'chat', value: set.windows.chat, noSave: true });
                    winChat = null;
                }
                if (winCode == wins[w] && winCode.getParentWindow() == win) {
                    if (!edSet)
                        edSet = EditorSettings.load(parseTemplate(path.join('{data}', 'editor.json')));
                    if (global.editorOnly)
                        edSet.stateOnly = getWindowState('code-editor', winCode);
                    else {
                        edSet.state = getWindowState('code-editor', winCode);
                        edSet.window.show = true;
                    }
                    edSet.save(parseTemplate(path.join('{data}', 'editor.json')));
                    executeScript('closeWindow()', winCode);
                    winCode = null;
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
    if (!set)
        set = settings.Settings.load(global.settingsFile);
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

function showPrefs() {
    var b;
    if (win)
        b = win.getBounds();
    else
        b = { x: 0, y: 0, height: 600, width: 800 };

    let pref = new BrowserWindow({
        parent: getParentWindow(),
        modal: true,
        x: Math.floor(b.x + b.width / 2 - 400),
        y: Math.floor(b.y + b.height / 2 - 230),
        width: 800,
        height: 460,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        resizable: false,
        title: 'Preferences',
        icon: path.join(__dirname, '../assets/icons/png/preferences.png'),
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
    require("@electron/remote/main").enable(pref.webContents);
    pref.removeMenu();
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

    pref.webContents.on('render-process-gone', (event, details) => {
        logError(`Preferences render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });
    pref.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!pref)
                return;
            if (result.response === 0) {
                pref.reload();
                logError('Preferences unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                pref.destroy();
            }
            else
                logError('Preferences unresponsive, waiting.\n', true);
        });
    });
    addInputContext(pref, set && set.spellchecking);
}

function createMapper(show, loading, loaded) {
    if (winMap) return;
    var s = loadWindowState('mapper');
    winMap = new BrowserWindow({
        parent: set.mapper.alwaysOnTopClient ? getParentWindow() : null,
        alwaysOnTop: set.mapper.alwaysOnTop,
        title: 'Mapper',
        x: getWindowX(s.x, s.width),
        y: getWindowY(s.y, s.height),
        width: s.width,
        height: s.height,
        backgroundColor: '#eae4d6',
        show: false,
        skipTaskbar: (!set.mapper.showInTaskBar && (set.mapper.alwaysOnTopClient || set.mapper.alwaysOnTop)) ? true : false,
        icon: path.join(__dirname, '../assets/icons/png/map.png'),
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
    require("@electron/remote/main").enable(winMap.webContents);


    winMap.removeMenu();
    winMap.loadURL(url.format({
        pathname: path.join(__dirname, 'mapper.html'),
        protocol: 'file:',
        slashes: true
    }));

    winMap.webContents.on('render-process-gone', (event, details) => {
        logError(`Mapper render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    winMap.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!winMap)
                return;
            if (result.response === 0) {
                winMap.reload();
                logError('Mapper unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                winMap.destroy();
            }
            else
                logError('Mapper unresponsive, waiting.\n', true);
        });
    });

    winMap.on('closed', (e) => {
        if (e.sender === winMap) {
            if (!winMap.isDestroyed() && !winMap.isVisible())
                executeScript('closeHidden()', winMap);
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
        states.mapper.maximized = true;
    });

    winMap.on('unmaximize', () => {
        trackWindowState('mapper', winMap);
        states.mapper.maximized = false;
    });

    if (global.debug)
        winMap.webContents.openDevTools();

    winMap.once('ready-to-show', () => {
        loadWindowScripts(winMap, 'map');
        addInputContext(winMap, set && set.spellchecking);
        if (show) {
            restoreWindowState(winMap, s, true);
        }
        else {
            if (s.fullscreen)
                winMap.setFullScreen(s.fullscreen);
            mapperMax = s.maximized;
        }
        if (loading) {
            clearTimeout(loadID);
            loadID = setTimeout(() => { win.focus(); }, 500);
        }
        if (loaded)
            loaded();
    });

    winMap.on('close', (e) => {
        set = settings.Settings.load(global.settingsFile);
        if (win != null && winMap === e.sender) {
            set.showMapper = false;
            win.webContents.send('setting-changed', { type: 'normal', name: 'showMapper', value: false, noSave: true });
        }
        set.windows.mapper = getWindowState('mapper', e.sender);
        if (win && !win.isDestroyed() && win.webContents)
            win.webContents.send('setting-changed', { type: 'window', name: 'mapper', value: set.windows.mapper, noSave: true });
        set.save(global.settingsFile);
        if (winMap === e.sender && winMap && (set.mapper.enabled || set.mapper.persistent)) {
            e.preventDefault();
            executeScript('closeHidden()', winMap);
            winMap.hide();
        }
    });
}

function showMapper(loading) {
    set = settings.Settings.load(global.settingsFile);
    set.showMapper = true;
    win.webContents.send('setting-changed', { type: 'normal', name: 'showMapper', value: true, noSave: true });
    set.save(global.settingsFile);
    if (winMap != null) {
        restoreWindowState(winMap, {
            maximized: mapperMax,
        }, true);
        mapperMax = false;
        if (loading) {
            clearTimeout(loadID);
            loadID = setTimeout(() => { win.focus(); }, 500);
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

function createEditor(show, loading) {
    if (winEditor) return;
    var s = loadWindowState('editor');
    winEditor = new BrowserWindow({
        parent: getParentWindow(),
        title: 'Advanced Editor',
        x: getWindowX(s.x, s.width),
        y: getWindowY(s.y, s.height),
        width: s.width,
        height: s.height,
        backgroundColor: '#000',
        show: false,
        skipTaskbar: !set.showEditorInTaskBar,
        icon: path.join(__dirname, '../assets/icons/png/edit.png'),
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
    require("@electron/remote/main").enable(winEditor.webContents);
    winEditor.webContents.on('render-process-gone', (event, details) => {
        logError(`Advanced editor process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    winEditor.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!winEditor)
                return;
            if (result.response === 0) {
                winEditor.reload();
                logError('Advanced editor unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                winEditor.destroy();
            }
            else
                logError('Advanced editor unresponsive, waiting.\n', true);
        });
    });

    winEditor.removeMenu();
    winEditor.loadURL(url.format({
        pathname: path.join(__dirname, 'editor.html'),
        protocol: 'file:',
        slashes: true
    }));

    winEditor.on('closed', (e) => {
        if (e.sender !== winEditor) return;
        winEditor = null;
        editorReady = 0;
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
        states.editor.maximized = true;
    });

    winEditor.on('unmaximize', () => {
        trackWindowState('editor', winEditor);
        states.editor.maximized = false;
    });

    if (global.debug)
        winEditor.webContents.openDevTools();

    winEditor.webContents.on('did-finish-load', () => {
        editorReady = 2;
    });

    winEditor.once('ready-to-show', () => {
        loadWindowScripts(winEditor, 'editor');
        //addInputContext(winEditor, set && set.spellchecking);
        if (show) {
            restoreWindowState(winEditor, s, true);
        }
        else {
            if (s.fullscreen)
                winEditor.setFullScreen(s.fullscreen);
            editorMax = s.maximized;
        }
        if (loading) {
            clearTimeout(loadID);
            if (editorOnly && winCode)
                loadID = setTimeout(() => { winCode.focus(); }, 500);
            else if (win)
                loadID = setTimeout(() => { win.focus(); }, 500);
        }
        if (editorReady !== 2)
            editorReady = 1;
    });

    winEditor.on('close', (e) => {
        set = settings.Settings.load(global.settingsFile);
        set.showEditor = false;
        set.windows.editor = getWindowState('editor', winEditor || e.sender);
        if (win) {
            win.webContents.send('setting-changed', { type: 'window', name: 'editor', value: set.windows.editor, noSave: true });
            win.webContents.send('setting-changed', { type: 'normal', name: 'showEditor', value: false, noSave: true });
            win.focus();
        }
        set.save(global.settingsFile);
        executeScript('tinymce.activeEditor.setContent(\'\');', e.sender);
        if (winEditor === e.sender && winEditor && (set.editorPersistent && !global.editorOnly)) {
            e.preventDefault();
            executeScript('if(closeHidden) closeHidden()', winEditor);
            winEditor.hide();
        }
    });
}

function showEditor(loading) {
    set = settings.Settings.load(global.settingsFile);
    set.showEditor = true;
    if (win)
        win.webContents.send('setting-changed', { type: 'normal', name: 'showEditor', value: true, noSave: true });
    set.save(global.settingsFile);
    if (winEditor != null) {
        if (!editorReady)
            return;
        restoreWindowState(winEditor, {
            maximized: editorMax
        }, true);
        editorMax = false;
        if (loading) {
            clearTimeout(loadID);
            loadID = setTimeout(() => { win.focus(); }, 500);
        }
    }
    else
        createEditor(true, loading);
}

function createChat(show, loading) {
    if (winChat) return;
    var s = loadWindowState('chat');
    winChat = new BrowserWindow({
        parent: set.chat.alwaysOnTopClient ? getParentWindow() : null,
        title: 'Chat',
        x: getWindowX(s.x, s.width),
        y: getWindowY(s.y, s.height),
        width: s.width,
        height: s.height,
        backgroundColor: '#000',
        show: false,
        skipTaskbar: (!set.chat.showInTaskBar && (set.chat.alwaysOnTopClient || set.chat.alwaysOnTop)) ? true : false,
        icon: path.join(__dirname, '../assets/icons/png/chat.png'),
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
    require("@electron/remote/main").enable(winChat.webContents);
    winChat.webContents.on('render-process-gone', (event, details) => {
        logError(`Chat capture render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    winChat.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!winChat)
                return;
            if (result.response === 0) {
                winChat.reload();
                logError('Chat capture unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                winChat.destroy();
            }
            else
                logError('Chat capture unresponsive, waiting.\n', true);
        });
    });

    winChat.removeMenu();
    winChat.loadURL(url.format({
        pathname: path.join(__dirname, 'chat.html'),
        protocol: 'file:',
        slashes: true
    }));

    winChat.on('closed', (e) => {
        if (e.sender !== winChat) return;
        winChat = null;
        chatReady = 0;
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
        states.chat.maximized = true;
    });

    winChat.on('unmaximize', () => {
        trackWindowState('chat', winChat);
        states.chat.maximized = false;
    });

    if (global.debug)
        winChat.webContents.openDevTools();

    winChat.webContents.on('did-finish-load', () => {
        chatReady = 2;
    });

    winChat.once('ready-to-show', () => {
        loadWindowScripts(winChat, 'chat');
        addInputContext(winChat, set && set.spellchecking);
        if (show) {
            restoreWindowState(winChat, s, true);
        }
        else {
            if (s.fullscreen)
                winChat.setFullScreen(s.fullscreen);
            chatMax = s.maximized;
        }
        if (chatReady !== 2)
            chatReady = 1;
        if (loading) {
            clearTimeout(loadID);
            loadID = setTimeout(() => { win.focus(); }, 500);
        }
    });

    winChat.on('close', (e) => {
        set = settings.Settings.load(global.settingsFile);
        if (winChat === e.sender) {
            set.showChat = false;
            if (win && !win.isDestroyed() && win.webContents)
                win.webContents.send('setting-changed', { type: 'normal', name: 'showChat', value: false, noSave: true });
        }
        set.windows.chat = getWindowState('chat', e.sender);
        if (win && !win.isDestroyed() && win.webContents)
            win.webContents.send('setting-changed', { type: 'window', name: 'chat', value: set.windows.chat, noSave: true });
        set.save(global.settingsFile);
        if (winChat === e.sender && winChat && (set.chat.persistent || set.chat.captureTells || set.chat.captureTalk || set.chat.captureLines)) {
            e.preventDefault();
            executeScript('closeHidden()', winChat);
            winChat.hide();
        }
    });
}

function showChat(loading) {
    set = settings.Settings.load(global.settingsFile);
    set.showChat = true;
    win.webContents.send('setting-changed', { type: 'normal', name: 'showChat', value: true, noSave: true });
    set.save(global.settingsFile);
    if (winChat != null) {
        if (!chatReady)
            return;
        restoreWindowState(winChat, {
            maximized: chatMax
        }, true);
        chatMax = false;
        if (loading) {
            clearTimeout(loadID);
            loadID = setTimeout(() => { win.focus(); }, 500);
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
        parent: windows[name].alwaysOnTopClient ? getParentWindow() : null,
        title: options.title || name,
        x: getWindowX(options.x || s.x, options.width || s.width),
        y: getWindowY(options.y || s.y, options.height || s.height),
        width: options.width || s.width,
        height: options.height || s.height,
        backgroundColor: options.background || '#000',
        show: false,
        skipTaskbar: (!windows[name].showInTaskBar && (windows[name].alwaysOnTopClient || windows[name].alwaysOnTop)) ? true : false,
        icon: path.join(__dirname, '../assets/icons/png/' + (options.icon || name) + '.png'),
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
    require("@electron/remote/main").enable(windows[name].window.webContents);
    delete windows[name].width;
    delete windows[name].height;
    delete windows[name].x;
    delete windows[name].y;

    windows[name].window.webContents.on('render-process-gone', (event, details) => {
        logError(`${name} render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    windows[name].window.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!windows[name].window)
                return;
            if (result.response === 0) {
                windows[name].window.reload();
                logError(`${name} unresponsive, reload.\n`, true);
            }
            else if (result.response === 2) {
                windows[name].window.destroy();
            }
            else
                logError(`${name} unresponsive, waiting.\n`, true);
        });
    });

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
        if (windows[name].alwaysOnTopClient)
            getParentWindow().focus();
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

    windows[name].window.webContents.setWindowOpenHandler((details) => {
        var u = new url.URL(details.url);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
            shell.openExternal(details.url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: buildOptions(details, windows[name].window, set)
        }
    });

    windows[name].window.webContents.on('did-create-window', (w, details) => {
        let frameName = details.frameName;
        let url = details.url;
        if (global.debug)
            w.webContents.openDevTools();
        w.removeMenu();
        w.once('ready-to-show', () => {
            loadWindowScripts(w, frameName);
            if (!options.noInput)
                addInputContext(w, global.editorOnly ? (edSet && edSet.spellchecking) : (set && set.spellchecking));
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
                executeScript(`if(childClosed) childClosed('${url}', '${frameName}');`, w.getParentWindow());
                w.focus();
            }
        });
    });

    if (global.debug)
        windows[name].window.webContents.openDevTools();

    windows[name].window.once('ready-to-show', () => {
        loadWindowScripts(windows[name].window, name);
        if (!options.noInput)
            addInputContext(windows[name].window, global.editorOnly ? (edSet && edSet.spellchecking) : (set && set.spellchecking));
        if (options.show) {
            restoreWindowState(windows[name].window, s, true);
        }
        else {
            if (s.fullscreen)
                windows[name].window.setFullScreen(s.fullscreen);
            windows[name].max = s.maximized;
        }
        windows[name].ready = true;
    });

    windows[name].window.on('close', (e) => {
        set = settings.Settings.load(global.settingsFile);
        set.windows[name] = getWindowState(name, e.sender);
        if (windows[name].window === e.sender)
            windows[name].show = false;
        set.windows[name].options = copyWindowOptions(name);
        set.save(global.settingsFile);
        if (win && !win.isDestroyed() && win.webContents)
            win.webContents.send('setting-changed', { type: 'window', name: name, value: set.windows[name], noSave: true });
        if (windows[name].window === e.sender && windows[name].window && windows[name].persistent) {
            e.preventDefault();
            executeScript('if(closeHidden) closeHidden()', windows[name].window);
        }
    });
}

function showWindow(name, options, skipSave) {
    if (name === 'main') return;
    if (!set)
        set = settings.Settings.load(global.settingsFile);
    options.show = true;
    if (!set.windows[name])
        set.windows[name] = {};
    set.windows[name].show = true;
    win.webContents.send('setting-changed', { type: 'window', name: name, value: set.windows[name], noSave: true });
    if (!skipSave)
        set.save(global.settingsFile);
    if (!options) options = { show: true };
    if (windows[name] && windows[name].window) {
        restoreWindowState(windows[name].window, {
            maximized: windows[name].max
        }, true);
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
        w = winEditor || getParentWindow();
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
    require("@electron/remote/main").enable(cp.webContents);
    cp.webContents.on('render-process-gone', (event, details) => {
        logError(`Colorpicker render process gone, reason: ${details.reason}, exitCode ${details.exitCode}\n`, true);
    });

    cp.on('unresponsive', () => {
        dialog.showMessageBox({
            type: 'info',
            message: 'Unresponsive',
            buttons: ['Reopen', 'Keep waiting', 'Close']
        }).then(result => {
            if (!cp)
                return;
            if (result.response === 0) {
                cp.reload();
                logError('Colorpicker unresponsive, reload.\n', true);
            }
            else if (result.response === 2) {
                cp.destroy();
            }
            else
                logError('Colorpicker unresponsive, waiting.\n', true);
        });
    });

    cp.removeMenu();
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
        executeScript('setType("' + (args.type || 'forecolor') + '");setColor("' + (args.color || '') + '");setWindow("' + (args.window || '') + '");', cp);
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


    if (!global.editorOnly && win && !win.isDestroyed() && win.webContents && !skipClient)
        win.webContents.send('error', msg);
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
            executeScript(data, window);
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
            executeScript('if(closing) closing();', windows[name].window);
            executeScript('if(closed) closed();', windows[name].window);
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
            executeScript('if(closeHidden) closeHidden()', winCode);
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
                executeScript(`if(childClosed) childClosed('${url}', '${frameName}');`, w.getParentWindow());
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
        if (global.editorOnly)
            winCode.webContents.send('menu-update', 'help|check for updates...', { enabled: true });
        else
            updateMenuItem({ menu: ['help', 'updater'], enabled: true });
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

function showAbout() {
    var b;

    if (global.editorOnly)
        b = winCode.getBounds();
    else
        b = win.getBounds();

    let about = new BrowserWindow({
        parent: getParentWindow(),
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
        w.webContents.executeJavaScript(script).then(() => resolve()).catch(err => {
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
        w.executeJavaScript(script).then(() => resolve()).catch(err => {
            if (err)
                logError(err);
            reject();
        });
    });
}

function getWindowX(x, w) {
    if (!set)
        set = settings.Settings.load(global.settingsFile);
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