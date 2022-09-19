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

//TODO make wrappers for dialogs, eg window.showDIALOG or maybe window.dialogs.showDIALOG