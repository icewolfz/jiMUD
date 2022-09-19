const { ipcRenderer } = require('electron')

window.oldFocus = window.focus;
window.focus = () => { ipcRenderer.invoke("window", "focus"); };
window.show = () => { ipcRenderer.invoke("window", "show"); };
window.hide = () => { ipcRenderer.invoke("window", "hide"); };
window.toggle = () => { ipcRenderer.invoke("window", "toggle"); };
window.update = (options) => { ipcRenderer.invoke("window", "update", options); };
window.setProgressBar = (value, mode) => { ipcRenderer.invoke("window", "setProgressBar", value, mode); };
window.toggleDevTools = () => { ipcRenderer.invoke('window', 'toggleDevTools'); }
window.isVisible = () => { return ipcRenderer.sendSync('window-info', 'isVisible'); }
window.isMinimized = () => { return ipcRenderer.sendSync('window-info', 'isMinimized'); }
window.showContext = (template, options, show, close) => ipcRenderer.invoke('show-context', template, options, show, close);
window.getGlobal = (variable) => ipcRenderer.sendSync('get-global', variable);
window.setGlobal = (variable, value) => ipcRenderer.send('set-global', variable, value);
window.getSetting = (variable) => ipcRenderer.sendSync('get-setting', variable);
window.setSetting = (variable, value) => ipcRenderer.send('set-setting', variable, value);

dialog = {
    showOpenDialog: (options) => ipcRenderer.invoke('show-dialog', 'showOpenDialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-dialog', 'showSaveDialog', options),
    showMessageBox: (options) => ipcRenderer.invoke('show-dialog', 'showMessageBox', options),
    showOpenDialogSync: (options) => ipcRenderer.sendSync('show-dialog-sync', 'showOpenDialog', options),
    showSaveDialogSync: (options) => ipcRenderer.sendSync('show-dialog-sync', 'showSaveDialog', options),
    showMessageBoxSync: (options) => ipcRenderer.sendSync('show-dialog-sync', 'showMessageBox', options),
    showErrorBox: (title, contents) => ipcRenderer.send('show-error-box', title, contents),
};
