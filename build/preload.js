const { ipcRenderer, clipboard, ClipboardItem } = require('electron');
const { parseTemplate, isFileSync } = require('./js/library.js');

window.oldFocus = window.focus;
window.focus = () => { ipcRenderer.invoke("window", "focus"); };
window.show = () => { ipcRenderer.invoke("window", "show"); };
window.hide = () => { ipcRenderer.invoke("window", "hide"); };
window.minimize = () => { ipcRenderer.invoke("window", "minimize"); };
window.toggle = () => { ipcRenderer.invoke("window", "toggle"); };
window.update = (options) => { ipcRenderer.invoke("window", "update", options); };
window.setProgressBar = (value, mode) => { ipcRenderer.invoke("window", "setProgressBar", value, mode); };
window.toggleDevTools = () => { ipcRenderer.invoke('window', 'toggleDevTools'); }
window.isVisible = () => { return ipcRenderer.sendSync('window-info', 'isVisible'); }
window.isMinimized = () => { return ipcRenderer.sendSync('window-info', 'isMinimized'); }
window.isFullscreen = () => { return ipcRenderer.sendSync('window-info', 'isFullscreen'); }
window.toggleFullscreen = () => { ipcRenderer.invoke("window", "toggleFullscreen"); }
window.setFullscreen = (state) => { ipcRenderer.invoke("window", "setFullscreen", state); };
window.showContext = (template, options, show, close) => ipcRenderer.invoke('show-context', template, options, show, close);
window.getGlobal = (variable) => ipcRenderer.sendSync('get-global', variable);
window.setGlobal = (variable, value) => ipcRenderer.send('set-global', variable, value);
window.getSetting = (variable) => ipcRenderer.sendSync('get-setting', variable);
window.setSetting = (variable, value) => ipcRenderer.send('set-setting', variable, value);
window.error = (error) => ipcRenderer.send('error', error);
window.logError = (error, skipClient, title) => ipcRenderer.send('log-error', error, skipClient, title);
window.debug = (message) => ipcRenderer.send('debug', message);

window.addContext = func => ipcRenderer.addListener('context-menu', func);
window.removeContext = func => ipcRenderer.removeListener('context-menu', func);

window.prompt = function (prompt, val, mask) {
    if (typeof prompt === 'object')
        return ipcRenderer.sendSync('prompt', prompt);
    return ipcRenderer.sendSync('prompt', { prompt: prompt, val: val, mask: mask });
}

dialog = {
    showOpenDialog: (options) => ipcRenderer.invoke('show-dialog', 'showOpenDialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-dialog', 'showSaveDialog', options),
    showMessageBox: (options) => ipcRenderer.invoke('show-dialog', 'showMessageBox', options),
    showOpenDialogSync: (options) => ipcRenderer.sendSync('show-dialog-sync', 'showOpenDialog', options),
    showSaveDialogSync: (options) => ipcRenderer.sendSync('show-dialog-sync', 'showSaveDialog', options),
    showMessageBoxSync: (options) => ipcRenderer.sendSync('show-dialog-sync', 'showMessageBox', options),
    showErrorBox: (title, contents) => ipcRenderer.send('show-error-box', title, contents),
};

window.loadTheme = (theme, force) => {
    if (!theme) theme = window.getSetting('theme');
    var el = document.getElementById('theme');
    if (!el) return;
    theme = parseTemplate(theme) + '.css';
    if (!isFileSync(theme)) {
        const path = require('path');
        theme = parseTemplate(path.join('{themes}', 'default')) + '.css';
    }
    if (el.getAttribute('href') !== theme || force)
        el.setAttribute('href', theme);
}
window.loadTheme();

window.eClipboard = {
    readText: function (...args) {
        if (args && args.length && args[0] === 'selection')
            return ipcRenderer.sendSync('clipboard', 'readTextSelection', ...args);
        return ipcRenderer.sendSync('clipboard', 'readText', ...args);
    },
    writeText: function (...args) {
        ipcRenderer.send('clipboard', 'writeText', ...args);
    },
    readTextSelection: function (...args) {
        return ipcRenderer.sendSync('clipboard', 'readTextSelection', ...args);
    },
    writeTextSelection: function (...args) {
        ipcRenderer.send('clipboard', 'writeTextSelection', ...args);
    },
    read: function (...args) {
        return ipcRenderer.sendSync('clipboard', 'read', ...args);
    },
    write: function (items) {
        if (!items) return;
        ipcRenderer.send('clipboard', 'write', buildClipboardItems(items));
    },
    writeBoth: function (items) {
        if (!items) return;
        items = buildClipboardItems(items);
        ipcRenderer.send('clipboard', 'write', items);
        ipcRenderer.send('clipboard', 'writeSelection', items);
    },
    readSelection: function (...args) {
        return ipcRenderer.sendSync('clipboard', 'readSelection', ...args);
    },
    writeSelection: function (items) {
        if (!items) return;
        ipcRenderer.send('clipboard', 'writeSelection', buildClipboardItems(items));
    },
    writeTextBoth: function (text) {
        ipcRenderer.send('clipboard', 'writeText', text);
        ipcRenderer.send('clipboard', 'writeTextSelection', text);
    },
    writeImage: function (data) {
        ipcRenderer.send('clipboard', 'writeImage', data);
    },
    readHTML: function () {
        return ipcRenderer.sendSync('clipboard', 'readHTML');
    },
    readHTMLSelection: function () {
        return ipcRenderer.sendSync('clipboard', 'readHTMLSelection');
    },
    writeBuffer: function (format, data) {
        ipcRenderer.sendSync('clipboard', 'writeBuffer', format, data);
    },
    readBuffer: function (format) {
        return ipcRenderer.sendSync('clipboard', 'readBuffer', format);
    },
    has: function (format, type) {
        if (type === 'selection')
            return ipcRenderer.sendSync('clipboard', 'hasSelection', format);
        return ipcRenderer.sendSync('clipboard', 'has', format);
    },
    hasSelection: function (format) {
        return ipcRenderer.sendSync('clipboard', 'hasSelection', format);
    }
}

function buildClipboardItems(items) {
    let cItems = [];
    for (let [key, value] of Object.entries(user)) {
        if (typeof value !== 'string')
            value = new Blob([value]);
        if (key === 'html') key = 'text/html';
        if (key === 'png' || key === 'jpg')
            key = 'image/' + key
        cItems.push(new ClipboardItem({
            [key]: value
        }));
    }
    return cItems;
}