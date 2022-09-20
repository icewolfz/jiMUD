//spell-checker:ignore dropdown, selectall, treeview, displaytype, uncheck, selectpicker, Profiledefault, askoncancel, triggernewline, triggerprompt, exportmenu
//spell-checker:ignore gamepadconnected gamepaddisconnected
import { ipcRenderer, nativeImage } from 'electron';
const remote = require('@electron/remote');
const { Menu, MenuItem } = remote;
import { FilterArrayByKeyValue, parseTemplate, keyCodeToChar, clone, isFileSync, isDirSync, existsSync, htmlEncode, walkSync, isValidIdentifier } from './library';
import { ProfileCollection, Profile, Alias, Macro, Button, Trigger, Context, MacroModifiers, ItemStyle, convertPattern } from './profile';
export { MacroDisplay } from './profile';
import { Settings } from './settings';
import { Menubar } from './menubar';
const path = require('path');
const fs = require('fs');
//const trash = require('trash');

declare let ace, dialog;
declare global {
    interface Window {
        getGlobal: any;
        getSetting: any;
    }
}

let profiles = new ProfileCollection();
let currentProfile;
let currentNode;
let watcher;
let filesChanged = false;
let _clip;
let _pUndo;
let _undo = [];
let _redo = [];
let _remove = [];
let _enabled = [];
let _never = true;
let _gamepads = false;
let _watch = true;
let _sort = 6;
let _sortDir = 1;
let _close;
let _loading = 0;
let _ide = true;
let _macro = false;
let archiver;
let unarchiver;
let archive;
let _spellchecker = true;
let _prependTrigger = true;
let _parameter = '%';
let _nParameter = '$';
let _command = '#';
let _stacking = ';';
let _speed = '!';
let _verbatim = '`';
let _profileLoadExpand = true;
let _profileLoadSelect = 'default';
let _iComments = true;
let _bComments = true;
let _iCommentsStr = ['/', '/'];
let _bCommentsStr = ['/', '*'];

let options = getOptions();

const _controllers = {};
let _controllersCount = 0;

window.addEventListener('gamepadconnected', (e) => {
    _controllers[e.gamepad.index] = { pad: e.gamepad, axes: clone(e.gamepad.axes), state: { axes: [], buttons: [] } };
    _controllersCount++;
    updatePads();
});

window.addEventListener('gamepaddisconnected', (e) => {
    delete _controllers[e.gamepad.index];
    _controllersCount--;
});

function updatePads() {
    if (_controllersCount === 0 || !_macro || !_gamepads)
        return;
    const controllers = navigator.getGamepads();
    let c = 0;
    const cl = controllers.length;
    for (; c < cl; c++) {
        const controller = controllers[c];
        if (!controller) continue;
        const state = _controllers[controller.index].state;
        const axes = _controllers[controller.index].axes;
        const bl = controller.buttons.length;
        let i;
        let key = 0;
        let d = '';
        for (i = 0; i < bl; i++) {
            let val: any = controller.buttons[i];
            let pressed;
            if (typeof (val) === 'object') {
                pressed = val.pressed;
                val = val.value;
            }
            else
                pressed = val >= 0.5;
            if (state.buttons[i]) {
                if (state.buttons[i].pressed !== pressed) {
                    state.buttons[i].pressed = pressed;
                }
            }
            else {
                state.buttons[i] = { pct: Math.round(val * 100), pressed: pressed };
            }
            if (pressed) {
                d = 'Button ' + (i + 1);
                key = i + 1;
            }
        }
        const al = controller.axes.length;
        let a = 0;
        for (i = 0; i < al; i++) {

            if (state.axes[i] !== controller.axes[i] && controller.axes[i] !== axes[i]) {
                state.axes[i] = controller.axes[i];
                if (state.axes[i] < -0.75) {
                    //state.axes[i] = -1;
                    d = 'Axis ' + (i + 1) + ' Minus';
                    a = -(i + 1);
                    key = 0;
                }
                else if (state.axes[i] > 0.75) {
                    //state.axes[i] = 1;
                    d = 'Axis ' + (i + 1) + ' Plus';
                    a = i + 1;
                    key = 0;
                }
            }
            else if (state.axes[i] < -0.75) {
                a = -(i + 1);
                key = 0;
                d = 'Axis ' + (i + 1) + ' Minus';
            }
            else if (state.axes[i] > 0.75) {
                a = i + 1;
                key = 0;
                d = 'Axis ' + (i + 1) + ' Plus';
            }
        }
        if (d.length > 0) {
            $('#macro-key').val('Gamepad ' + (c + 1) + '+' + d);
            $('#macro-key').data('key', key);
            $('#macro-key').data('mod', 0);
            $('#macro-key').data('gamepad', c + 1);
            $('#macro-key').data('axes', a);
            UpdateMacro();
        }
    }
    if (_controllersCount > 0 || controllers.length > 0)
        requestAnimationFrame(updatePads);
}

enum UpdateState {
    NoChange,
    Changed,
    Error
}

const menubar: Menubar = new Menubar([
    {
        label: '&File',
        id: 'file',
        submenu: [
            {
                label: '&New',
                submenu: [
                    {
                        label: '&Empty profile', click() {
                            clearButton('#btn-add-dropdown');
                            AddNewProfile();
                        }
                    },
                    {
                        label: '&Profile with defaults', click() {
                            clearButton('#btn-add-dropdown');
                            AddNewProfile(true);
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '&Alias', click() {
                            clearButton('#btn-add-dropdown');
                            addItem('Alias', 'aliases', new Alias());
                        }
                    },
                    {
                        label: '&Macro', click() {
                            clearButton('#btn-add-dropdown');
                            addItem('Macro', 'macros', new Macro());
                        }
                    },
                    {
                        label: '&Trigger', click() {
                            clearButton('#btn-add-dropdown');
                            addItem('Trigger', 'triggers', new Trigger());
                        }
                    },
                    {
                        label: '&Button', click() {
                            clearButton('#btn-add-dropdown');
                            addItem('Button', 'buttons', new Button());
                        }
                    },
                    {
                        label: '&Context', click() {
                            clearButton('#btn-add-dropdown');
                            addItem('Context', 'contexts', new Context());
                        }
                    }
                ]
            },
            { type: 'separator' },
            { label: '&Save', click: saveProfiles },
            { label: 'Sa&ve and close', click: () => { if (saveProfiles()) window.close(); } },
            { type: 'separator' },
            { label: 'E&xport current...', click: exportCurrent },
            { label: 'Export &all...', click: exportAll },
            { label: 'Export all as &zip...', click: exportAllZip },
            { type: 'separator' },
            { label: '&Import...', click: importProfiles },
            { type: 'separator' },
            { label: '&Close', click: doClose }
        ]
    },
    {
        label: '&Edit',
        submenu: [
            { label: 'R&efresh', accelerator: 'F5', click: doRefresh },
            { type: 'separator' },
            { label: '&Undo', enabled: false, accelerator: 'CmdOrCtrl+Z', click: doUndo },
            { label: '&Redo', enabled: false, accelerator: 'CmdOrCtrl+Y', click: doRedo },
            { type: 'separator' },
            { label: 'Cu&t', enabled: false, accelerator: 'CmdOrCtrl+X', click: doCut },
            { label: '&Copy', enabled: false, accelerator: 'CmdOrCtrl+C', click: doCopy },
            { label: '&Paste', enabled: false, accelerator: 'CmdOrCtrl+V', click: doPaste },
            { label: '&Delete', enabled: false, accelerator: 'Delete', click: doDelete }
        ]
    }
]);

interface MenuItemConstructorOptionsCustom extends Electron.MenuItemConstructorOptions {
    x?: number;
    y?: number;
    sel?: number;
    idx?: number;
    word?: string;
}

function addInputContext() {
    remote.getCurrentWindow().webContents.on('context-menu', (e, props) => {
        e.preventDefault();
        const inputMenu = Menu.buildFromTemplate(<Electron.MenuItemConstructorOptions[]>[
            {
                label: 'Undo',
                click: () => { doUndo(); },
                accelerator: 'CmdOrCtrl+Z'
            },
            {
                label: 'Redo',
                click: () => { doRedo(); },
                accelerator: 'CmdOrCtrl+Y'
            },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { type: 'separator' },
            { role: 'selectAll' }
        ]);
        if (window.getGlobal('debug')) {
            inputMenu.append(new MenuItem({ type: 'separator' }));
            inputMenu.append(new MenuItem(<MenuItemConstructorOptionsCustom>{
                label: 'Inspect',
                x: props.x,
                y: props.y,
                click: (item: any) => {
                    remote.getCurrentWindow().webContents.inspectElement(item.x, item.y);
                }
            }));
        }
        if (_spellchecker && props.dictionarySuggestions.length) {
            inputMenu.insert(0, new MenuItem({ type: 'separator' }));
            for (let w = props.dictionarySuggestions.length - 1; w >= 0; w--) {
                inputMenu.insert(0, new MenuItem(<MenuItemConstructorOptionsCustom>{
                    label: props.dictionarySuggestions[w],
                    x: props.x,
                    y: props.y,
                    sel: props.selectionText.length - props.misspelledWord.length,
                    idx: props.selectionText.indexOf(props.misspelledWord),
                    word: props.misspelledWord,
                    click: (item: any) => {
                        const el = $(document.elementFromPoint(item.x, item.y));
                        let value: string = (<string>el.val());
                        const start = (<HTMLInputElement>el[0]).selectionStart;
                        const wStart = start + item.idx;
                        value = value.substring(0, wStart) + item.label + value.substring(wStart + item.word.length);
                        el.val(value);
                        (<HTMLInputElement>el[0]).selectionStart = start;
                        (<HTMLInputElement>el[0]).selectionEnd = start + item.label.length + item.sel;
                        el.blur();
                        el.focus();
                    }
                }));
            }
        }
        inputMenu.popup({ window: remote.getCurrentWindow() });
    });
}

function profileID(name) {
    return name.toLowerCase().replace(/^[^a-z]+|[^\w:.-]+/gi, '-');
}

export function AddNewItem() {
    let t;
    if (currentNode) {
        currentNode.state.selected = false;
        t = 'profile';
        if (!currentNode.dataAttr.type)
            t = currentNode.text.toLowerCase();
        else
            t = currentNode.dataAttr.type;
        switch (t) {
            case 'profile':
                AddNewProfile(true);
                break;
            case 'aliases':
            case 'alias':
                addItem('Alias', 'aliases', new Alias());
                break;
            case 'macros':
            case 'macro':
                addItem('Macro', 'macros', new Macro());
                break;
            case 'triggers':
            case 'trigger':
                addItem('Trigger', 'triggers', new Trigger());
                break;
            case 'buttons':
            case 'button':
                addItem('Button', 'buttons', new Button());
                break;
            case 'contexts':
            case 'context':
                addItem('Context', 'contexts', new Context());
                break;
        }
    }
}

function AddNewProfile(d?: Boolean) {
    let i = profiles.length;
    let n = 'NewProfile' + i;
    while (profiles.contains(n)) {
        i++;
        n = 'NewProfile' + i;
    }
    const p = new Profile(n);
    if (!d) p.macros = [];
    profiles.add(p);
    const txt = n;
    n = n.toLowerCase();
    const node = {
        text: txt,
        id: 'Profile' + profileID(n),
        state: {
            checked: true
        },
        dataAttr: {
            type: 'profile',
            profile: n,
            priority: p.priority,
        },
        nodes: [
            {
                text: 'Aliases',
                id: 'Profile' + profileID(n) + 'aliases',
                dataAttr: {
                    profile: n,
                    type: 'aliases'
                },
                lazyLoad: profiles.items[n].aliases.length > 0,
                state: {
                    checked: profiles.items[n].enableAliases
                }
            },
            {
                text: 'Macros',
                id: 'Profile' + profileID(n) + 'macros',
                dataAttr: {
                    profile: n,
                    type: 'macros'
                },
                lazyLoad: profiles.items[n].macros.length > 0,
                state: {
                    checked: profiles.items[n].enableMacros
                }
            },
            {
                text: 'Triggers',
                id: 'Profile' + profileID(n) + 'triggers',
                dataAttr: {
                    profile: n,
                    type: 'triggers'
                },
                lazyLoad: profiles.items[n].triggers.length > 0,
                state: {
                    checked: profiles.items[n].enableTriggers
                }
            },
            {
                text: 'Buttons',
                id: 'Profile' + profileID(n) + 'buttons',
                dataAttr: {
                    profile: n,
                    type: 'buttons'
                },
                lazyLoad: profiles.items[n].buttons.length > 0,
                state: {
                    checked: profiles.items[n].enableButtons
                }
            },
            {
                text: 'Contexts',
                id: 'Profile' + profileID(n) + 'contexts',
                dataAttr: {
                    profile: n,
                    type: 'contexts'
                },
                lazyLoad: profiles.items[n].contexts.length > 0,
                state: {
                    checked: profiles.items[n].enableContexts
                }
            }
        ]
    };
    $('#profile-tree').treeview('addNode', [node, false, false]);
    pushUndo({ action: 'add', type: 'profile', item: [p.clone()] });
    _enabled.push(p.name.toLowerCase());
    n = p.name;
    _remove = _remove.filter((a) => { return a.name !== n; });
}

export function RunTester() {
    if ((<string>$('#trigger-test-text').val()).length === 0) {
        $('#trigger-test-results').val('No text to test against!');
        return;
    }
    try {
        if ($('#trigger-verbatim').prop('checked')) {
            if (!$('#trigger-caseSensitive').prop('checked') && (<string>$('#trigger-pattern').val()).toLowerCase() !== (<string>$('#trigger-test-text').val()).toLowerCase())
                $('#trigger-test-results').val('Pattern doesn\'t Match!');
            else if ($('#trigger-caseSensitive').prop('checked') && $('#trigger-pattern').val() !== $('#trigger-test-text').val())
                $('#trigger-test-results').val('Pattern doesn\'t Match!');
            else
                $('#trigger-test-results').val(_parameter + '0 : ' + $('#trigger-test-text').val() + '\n');
        }
        else {
            let re;
            let pattern;
            pattern = <string>$('#trigger-pattern').val();
            if ($('#trigger-type').val() === '8' || $('#trigger-type').val() === '16' || $('#trigger-type').val() === 8 || $('#trigger-type').val() === 16)
                pattern = convertPattern(pattern);

            if ($('#trigger-caseSensitive').prop('checked'))
                re = new RegExp(pattern, 'gd');
            else
                re = new RegExp(pattern, 'gid');
            const res = re.exec($('#trigger-test-text').val());
            if (res == null || res.length === 0)
                $('#trigger-test-results').val('Pattern doesn\'t Match!');
            else {
                let r = '';
                let m = 0;
                if (res[0] !== $('#trigger-test-text').val() && _prependTrigger) {
                    r += _parameter + '0 : ' + $('#trigger-test-text').val() + '\n';
                    r += _parameter + 'x0 : 0 ' + (<string>$('#trigger-test-text').val()).length + '\n';
                    m = 1;
                }
                let i;
                for (i = 0; i < res.length; i++) {
                    r += _parameter + (i + m) + ' : ' + res[i] + '\n';
                    if (!res[i])
                        r += `${_parameter}x${i + m} : 0 0\n`;
                    else
                        r += `${_parameter}x${i + m} : ${res.indices[i][0]} ${res.indices[i][1]}\n`;
                }
                if (res.groups) {
                    let g = Object.keys(res.groups);
                    for (i = 0; i < g.length; i++)
                        r += `${_nParameter}${g[i]} : ${res.groups[g[i]]}\n`;
                }
                $('#trigger-test-results').val(r);
            }
        }

    }
    catch (e) {
        $('#trigger-test-results').val('Error: ' + e);
    }
}

function addTriggerStateDropdown(item, state, contentOnly?) {
    var content = `<a href="#" style="padding-right: 62px;" onclick="profileUI.SelectTriggerState(${state});">${state}: ${htmlEncode(GetDisplay(item))}
    <span class="btn-group" style="right: 0px;position: absolute;padding-right: 15px;">    
    <button title="Move state up" id="trigger-states" class="btn btn-default btn-xs" type="button" onclick="profileUI.moveTriggerState(${state}, -1);event.cancelBubble = true;">
    <i class="fa fa-angle-double-up"></i></button>
    <button title="Move state down" id="trigger-states" class="btn btn-default btn-xs" type="button" onclick="profileUI.moveTriggerState(${state}, 1);event.cancelBubble = true;"><i class="fa fa-angle-double-down"></i></button></span></a>`;
    if (contentOnly)
        return content;
    return `<li>${content}</li>`;
}

function initTriggerEditor(item) {
    setState(0);
    if (item.triggers && item.triggers.length) {
        $($('#trigger-states').parent()).css('display', '');
        let items = [];
        const tl = item.triggers.length;
        items.push(addTriggerStateDropdown(item, 0));
        for (let t = 0; t < tl; t++) {
            items.push(addTriggerStateDropdown(item.triggers[t], t + 1));
        }
        $('#trigger-states-dropdown').html(items.join(''));
        $('#trigger-states-dropdown li:last-child button:nth-child(2)').prop('disabled', true);
        $('#trigger-states-dropdown li:first-child button:nth-child(1)').prop('disabled', true);
    }
    else {
        $('#trigger-states-dropdown').html(addTriggerStateDropdown(item, 0));
        $('#trigger-states-dropdown li:first-child button:nth-child(1)').prop('disabled', true);
        $($('#trigger-states').parent()).css('display', 'none');
    }
    $('#trigger-states-dropdown li')[0].classList.add('selected', 'active');
    $('#trigger-states-delete').prop('disabled', !(item.triggers && item.triggers.length));
    $('#trigger-priority').parent().css('display', '');
    $('#trigger-priority').parent().prev().css('display', '');
    $('#trigger-state').parent().css('display', item.triggers && item.triggers.length ? '' : 'none');
    $('#trigger-state').parent().prev().css('display', item.triggers && item.triggers.length ? '' : 'none');
    $('#triggers-name').css('display', '');
    $('option[data-type="sub"]').prop('hidden', true);
    $('#trigger-type').selectpicker('refresh').selectpicker('render');
    $(window).trigger('resize');
}

function clearTriggerTester() {
    $('#trigger-test-text').val('');
    $('#trigger-test-results').val('');
    $('.nav-tabs a[href="#tab-trigger-value"]').tab('show');
    $('#trigger-type').trigger('change');
}

export function AddTriggerState() {
    const item = new Trigger();
    currentProfile.triggers[currentNode.dataAttr.index].triggers.push(item);
    $('#trigger-states-dropdown li:last-child button:nth-child(2)').prop('disabled', false);
    $('#trigger-states-dropdown').append((addTriggerStateDropdown(item, currentProfile.triggers[currentNode.dataAttr.index].triggers.length)));
    $('#trigger-states-dropdown li:last-child button:nth-child(2)').prop('disabled', true);
    $('#trigger-states-delete').prop('disabled', false);
    $($('#trigger-states').parent()).css('display', '');
    if (currentProfile.triggers[currentNode.dataAttr.index].triggers.length === 1)
        $(window).trigger('resize');
    SelectTriggerState(currentProfile.triggers[currentNode.dataAttr.index].triggers.length);
}

export function SelectTriggerState(state, noUpdate?) {
    if (!noUpdate)
        UpdateTrigger();
    setState(state);
    if (state === 0)
        UpdateEditor('trigger', currentProfile.triggers[currentNode.dataAttr.index], { post: clearTriggerTester });
    else
        UpdateEditor('trigger', currentProfile.triggers[currentNode.dataAttr.index].triggers[state - 1], { post: clearTriggerTester });
    focusEditor('trigger-value');
    if (!currentProfile.triggers[currentNode.dataAttr.index].triggers || currentProfile.triggers[currentNode.dataAttr.index].triggers.length === 0)
        return;
    $('#trigger-states-dropdown li').removeClass('selected');
    $('#trigger-states-dropdown li').removeClass('active');
    $('#trigger-states-dropdown li')[state].classList.add('selected', 'active');
    $('#trigger-priority').parent().css('display', state === 0 ? '' : 'none');
    $('#trigger-priority').parent().prev().css('display', state === 0 ? '' : 'none');
    $('#trigger-state').parent().css('display', state === 0 ? '' : 'none');
    $('#trigger-state').parent().prev().css('display', state === 0 ? '' : 'none');
    $('#triggers-name').css('display', state === 0 ? '' : 'none');
    $('option[data-type="sub"]').prop('hidden', state === 0);
    $('#trigger-type').selectpicker('refresh').selectpicker('render');
}

export function DeleteTriggerState() {
    const state = getState();
    dialog.showMessageBox({
        type: 'question',
        title: 'Delete current trigger state?',
        message: 'Are you sure you want to delete this trigger state?',
        buttons: ['Yes', 'No'],
        defaultId: 1
    }).then(result => {
        if (result.response === 0) {
            removeTriggerState(state, currentProfile, currentNode.dataAttr.index, true);
        }
    });
}

function removeTriggerState(state, profile, idx, update, customUndo?) {
    let item = profile.triggers[idx];
    if (!customUndo)
        pushUndo({ action: 'deletestate', type: 'trigger', data: { key: 'triggers', idx: idx, profile: profile.name.toLowerCase() }, item: item.clone(), subitem: state });
    if (state === 0) {
        sortNodeChildren('Profile' + profileID(profile.name) + 'triggers');
        const items = item.triggers;
        item = items.shift();
        item.state = profile.triggers[idx].state;
        item.priority = profile.triggers[idx].priority;
        item.name = profile.triggers[idx].name;
        item.triggers = items;
        if (item.type === 262144)
            item.type = 8;
        else if (item.type > 16)
            item.type = 0;
        profile.triggers[idx] = item;
        UpdateItemNode(profile.triggers[idx]);
        if (update)
            $('#editor-title').text('Trigger: ' + GetDisplay(profile.triggers[idx]));
    }
    else {
        item.triggers.splice(state - 1, 1);
        if (state > item.triggers.length)
            state = item.triggers.length;
        if (update) {
            if (state === 0)
                $('#editor-title').text('Trigger: ' + GetDisplay(profile.triggers[idx]));
            else
                $('#editor-title').text('Trigger: ' + GetDisplay(profile.triggers[idx].triggers[state - 1]));
        }
    }
    if (!update)
        return;
    if (item.triggers && item.triggers.length) {
        $($('#trigger-states').parent()).css('display', '');
        let items = [];
        const tl = item.triggers.length;
        items.push(addTriggerStateDropdown(item, 0));
        for (let t = 0; t < tl; t++) {
            items.push(addTriggerStateDropdown(item.triggers[t], t + 1));
        }
        $('#trigger-states-dropdown').html(items.join(''));
        $('#trigger-states-dropdown li:last-child button:nth-child(2)').prop('disabled', true);
        $('#trigger-states-dropdown li:first-child button:nth-child(1)').prop('disabled', true);
    }
    else {
        $('#trigger-states-dropdown').html(addTriggerStateDropdown(item, 0));
        $('#trigger-states-dropdown li:first-child button:nth-child(1)').prop('disabled', true);
        $($('#trigger-states').parent()).css('display', 'none');
    }
    $('#trigger-states-delete').prop('disabled', !(item.triggers && item.triggers.length));
    $('#trigger-priority').parent().css('display', !(item.triggers && item.triggers.length) || state === 0 ? '' : 'none');
    $('#trigger-priority').parent().prev().css('display', !(item.triggers && item.triggers.length) || state === 0 ? '' : 'none');
    $('#trigger-state').parent().css('display', item.triggers && item.triggers.length ? (state === 0 ? '' : 'none') : 'none');
    $('#trigger-state').parent().prev().css('display', item.triggers && item.triggers.length ? (state === 0 ? '' : 'none') : 'none');
    $('#triggers-name').css('display', !(item.triggers && item.triggers.length) || state === 0 ? '' : 'none');
    if (state === 0) {
        $('#trigger-type').val(item.type);
        $('#trigger-type').selectpicker('val', item.type);
    }
    SelectTriggerState(state, true);
}

export function moveTriggerState(state, direction) {
    swapTriggerState(state, state + direction, currentProfile, currentNode.dataAttr.index, true);
}

function swapTriggerState(oldState, newState, profile, idx, update, customUndo?) {
    let item = profile.triggers[idx];
    if (newState < 0 || newState > item.triggers.length)
        return;
    if (!customUndo)
        pushUndo({ action: 'swapstate', type: 'trigger', data: { key: 'triggers', idx: idx, profile: profile.name.toLowerCase() }, item: item.clone(), prevItem: oldState, newItem: newState });
    const items = item.triggers;
    let o;
    let n;
    //new one becomes main trigger
    if (newState == 0) {
        o = items.shift();
        o.triggers = items;
        if (o.type === 262144)
            o.type = 8;
        else if (o.type > 16)
            o.type = 0;
        n = item;
        n.triggers = [];
        o.state = n.state;
        o.priority = n.priority;
        o.name = n.name;
        items.unshift(n);
        profile.triggers[idx] = o;
        UpdateItemNode(profile.triggers[idx]);
        if (update) {
            $('#trigger-states-dropdown li:nth-child(1)').html(addTriggerStateDropdown(o, 0, true));
            $('#trigger-states-dropdown li:nth-child(2)').html(addTriggerStateDropdown(n, 1, true));
            $('#trigger-priority').parent().css('display', '');
            $('#trigger-priority').parent().prev().css('display', '');
            $('#trigger-state').parent().css('display', '');
            $('#trigger-state').parent().prev().css('display', '');
            $('#triggers-name').css('display', '');
            $('#trigger-type').val(n.type);
            $('#trigger-type').selectpicker('val', n.type);
        }
    }
    //main trigger becomes first state
    else if (oldState === 0) {
        n = items.shift();
        n.triggers = items;
        if (n.type === 262144)
            n.type = 8;
        else if (n.type > 16)
            n.type = 0;
        o = item;
        o.triggers = [];
        n.state = o.state;
        n.priority = o.priority;
        n.name = o.name;
        items.unshift(o);
        profile.triggers[idx] = n;
        UpdateItemNode(profile.triggers[idx]);
        if (update) {
            $('#trigger-states-dropdown li:nth-child(1)').html(addTriggerStateDropdown(n, 0, true));
            $('#trigger-states-dropdown li:nth-child(2)').html(addTriggerStateDropdown(o, 1, true));
            $('#trigger-priority').parent().css('display', 'none');
            $('#trigger-priority').parent().prev().css('display', 'none');
            $('#trigger-state').parent().css('display', 'none');
            $('#trigger-state').parent().prev().css('display', 'none');
            $('#triggers-name').css('display', 'none');
        }
    }
    else {
        n = items[newState - 1];
        items[newState - 1] = items[oldState - 1];
        items[oldState - 1] = n;
        if (update) {
            $('#trigger-states-dropdown li:nth-child(' + (newState + 1) + ')').html(addTriggerStateDropdown(items[newState - 1], newState, true));
            $('#trigger-states-dropdown li:nth-child(' + (oldState + 1) + ')').html(addTriggerStateDropdown(items[oldState - 1], oldState, true));
        }
    }
    $('#trigger-states-dropdown li:first-child button:nth-child(1)').prop('disabled', true);
    $('#trigger-states-dropdown li:last-child button:nth-child(2)').prop('disabled', true);
    if (oldState === getState()) {
        setState(newState);
        $('#trigger-states-dropdown li')[oldState].classList.remove('selected', 'active');
        $('#trigger-states-dropdown li')[newState].classList.add('selected', 'active');
    }
}

export function UpdateButtonSample() {
    const button = $('#button-sample');
    const icon = <string>$('#button-icon').val();
    if ($('#button-stretch').prop('checked'))
        button.addClass('button-stretch');
    else
        button.removeClass('button-stretch');
    button.prop('title', $('#button-caption').val());

    if (icon.startsWith('fa-'))
        button.html('<i class="fa ' + icon + '"></i>');
    else if (icon.startsWith('gi-'))
        button.html('<i class="glyphicon glyphicon-' + icon.substring(3) + '"></i>');
    else if (icon.startsWith('glyphicon-'))
        button.html('<i class="glyphicon ' + icon + '"></i>');
    else if (icon.startsWith('.'))
        button.html('<i class="fa button-icon ' + icon.substring(1) + '"></i>');
    else if (icon.length > 0)
        button.html('<img src="' + parseTemplate(icon) + '" />');
    else
        button.html('<i class="fa fa-question"></i>');
}

export function UpdateContextSample() {
    const button = $('#context-sample');
    button.prop('title', $('#context-caption').val());
    const icon = <string>$('#context-icon').val();
    if (icon.length > 0)
        button.html('<img src="' + nativeImage.createFromPath(parseTemplate(icon)).toDataURL() + '" />');
    else
        button.html('<span></span>');
}

export function openImage(field?, callback?) {
    if (!field) field = '#button-icon';
    dialog.showOpenDialog({
        defaultPath: path.dirname($(field).val()),
        filters: [
            { name: 'Images (*.jpg, *.png, *.gif)', extensions: ['jpg', 'png', 'gif'] },
            { name: 'All files (*.*)', extensions: ['*'] }
        ]
    }).then(result => {
        if (result.filePaths === undefined || result.filePaths.length === 0) {
            return;
        }
        $(field).trigger('keyup').val(result.filePaths[0]).trigger('keydown');
        UpdateButtonSample();
        if (callback) callback();
    });
}

function MacroKeys(item) {
    if (item.key === 0)
        return 'None';
    const d = [];
    if (item.gamepad > 0) {
        d.push('Gamepad ' + item.gamepad);
        if (item.key > 0)
            d.push('Button ' + item.key);
        else if (item.gamepadAxes < 0)
            d.push('Axis ' + -item.gamepadAxes);
        else if (item.gamepadAxes > 0)
            d.push('Axis ' + item.gamepadAxes);
        if (d.length === 1)
            return 'None';
        return d.join('+');
    }
    if ((item.modifiers & MacroModifiers.Ctrl) === MacroModifiers.Ctrl)
        d.push('Ctrl');
    if ((item.modifiers & MacroModifiers.Alt) === MacroModifiers.Alt)
        d.push('Alt');
    if ((item.modifiers & MacroModifiers.Shift) === MacroModifiers.Shift)
        d.push('Shift');
    if ((item.modifiers & MacroModifiers.Meta) === MacroModifiers.Meta) {
        if (process.platform === 'darwin')
            d.push('Cmd');
        else
            d.push('Win');
    }
    if (keyCodeToChar[item.key])
        d.push(keyCodeToChar[item.key]);
    else
        return 'None';
    return d.join('+');
}

function clearButton(id) {
    $(id).removeClass('open');
    $(id).blur();
}

function GetDisplay(arr) {
    if (arr.displaytype === 1) {
        /*jslint evil: true */
        const f = new Function('item', arr.display);
        return f(arr);
    }
    if ($.isFunction(arr.display))
        return arr.display(arr);
    if ($.isFunction(arr[arr.display]))
        return arr[arr.display](arr);
    if (!arr[arr.display])
        return arr['name'];
    return arr[arr.display];
}

function addItem(type: string, key: string, item, idx?: number, profile?: Profile, customUndo?: boolean) {
    if (!profile)
        profile = currentProfile;
    if (!idx && typeof idx !== 'number')
        idx = profile[key].length;
    type = type.toLowerCase();
    const n = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + key + '$', 'id']);
    $('#profile-tree').treeview('expandNode', [n, { levels: 1, silent: false }]);
    profile[key][idx] = item;
    const nodes = [newItemNode(item, idx, type, profile)];
    $('#profile-tree').treeview('addNode', [nodes, n, false, { silent: false }]);
    $('#profile-tree').treeview('selectNode', [nodes, { silent: false }]);
    sortNodeChildren('Profile' + profileID(profile.name) + key);
    if (!customUndo)
        pushUndo({ action: 'add', type: type.toLowerCase(), item: item.clone(), data: { type: type, key: key, item: item, idx: idx, profile: profile.name.toLowerCase() } });
}

export function UpdateEnabled() {
    let t = 'profile';
    if (!currentNode.dataAttr.type) {
        const parent = $('#profile-tree').treeview('getParents', currentNode)[0];
        t = parent.dataAttr.type;
    }
    else
        t = currentNode.dataAttr.type;
    switch (t) {
        case 'aliases':
        case 'macros':
        case 'triggers':
        case 'buttons':
        case 'contexts':
        case 'profile':
            const parent = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(currentProfile.name) + '$', 'id']);
            if (!$('#editor-enabled').prop('checked') && _enabled.indexOf(currentProfile.name.toLowerCase()) !== -1) {
                _enabled = _enabled.filter((a) => { return a !== currentProfile.name.toLowerCase(); });
                if (_enabled.length === 0) {
                    _enabled.push(currentProfile.name.toLowerCase());
                    $('#editor-enabled').prop('checked', true);
                    $('#profile-tree').treeview('checkNode', [parent, { silent: true }]);
                }
                else {
                    $('#profile-tree').treeview('uncheckNode', [parent, { silent: true }]);
                    pushUndo({ action: 'update', type: 'profile', profile: currentProfile.name.toLowerCase(), data: { enabled: true } });
                }
            }
            else if ($('#editor-enabled').prop('checked') && _enabled.indexOf(currentProfile.name.toLowerCase()) === -1) {
                $('#profile-tree').treeview('checkNode', [parent, { silent: true }]);
                pushUndo({ action: 'update', type: 'profile', profile: currentProfile.name.toLowerCase(), data: { enabled: false } });
                _enabled.push(currentProfile.name.toLowerCase());
            }
            break;
        case 'alias':
            if ($('#editor-enabled').prop('checked'))
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
            else
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.aliases[currentNode.dataAttr.index].enabled } });
            currentProfile.aliases[currentNode.dataAttr.index].enabled = $('#editor-enabled').prop('checked');
            break;
        case 'macro':
            if ($('#editor-enabled').prop('checked'))
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
            else
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.macros[currentNode.dataAttr.index].enabled } });
            currentProfile.macros[currentNode.dataAttr.index].enabled = $('#editor-enabled').prop('checked');
            break;
        case 'trigger':
            const state = getState();
            if (state === 0) {
                if ($('#editor-enabled').prop('checked'))
                    $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
                else
                    $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
                pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.triggers[currentNode.dataAttr.index].enabled } });
                currentProfile.triggers[currentNode.dataAttr.index].enabled = $('#editor-enabled').prop('checked');
            }
            else {
                pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, subitem: state, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.triggers[currentNode.dataAttr.index].triggers[state - 1].enabled } });
                currentProfile.triggers[currentNode.dataAttr.index].triggers[state - 1].enabled = $('#editor-enabled').prop('checked');
            }
            break;
        case 'button':
            if ($('#editor-enabled').prop('checked'))
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
            else
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.buttons[currentNode.dataAttr.index].enabled } });
            currentProfile.buttons[currentNode.dataAttr.index].enabled = $('#editor-enabled').prop('checked');
            break;
        case 'context':
            if ($('#editor-enabled').prop('checked'))
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
            else
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.contexts[currentNode.dataAttr.index].enabled } });
            currentProfile.contexts[currentNode.dataAttr.index].enabled = $('#editor-enabled').prop('checked');
            break;

    }
}

function UpdateItemNode(item, updateNode?, old?) {
    if (!updateNode)
        updateNode = currentNode;
    else if (typeof updateNode === 'string')
        updateNode = $('#profile-tree').treeview('findNodes', ['^' + updateNode + '$', 'id'])[0];
    const selected = updateNode.state.selected || updateNode.id === currentNode.id;
    const key = getKey(updateNode.dataAttr.type);
    //clone node
    let newNode = cloneNode(updateNode);
    //only text or check state effect node
    newNode.text = htmlEncode(GetDisplay(item));
    newNode.state.checked = item.enabled;
    newNode.dataAttr.name = item.name;
    newNode.dataAttr.priority = item.priority;
    newNode.dataAttr.parent = item.parent;
    //re-find node just in case
    //let node = $('#profile-tree').treeview('findNodes', ['^' + updateNode.id + "$", 'id'])[0];
    $('#profile-tree').treeview('updateNode', [updateNode, newNode]);
    let n;
    if (newNode.dataAttr.type === 'context') {
        if (item.parent && item.parent.length > 0 && item.parent !== item.name) {
            updateNode = $('#profile-tree').treeview('findNodes', ['^' + updateNode.id + '$', 'id'])[0];
            //remove node
            $('#profile-tree').treeview('removeNode', [updateNode, { silent: true }]);
            //find parent node
            n = $('#profile-tree').treeview('findNodes', ['^' + item.parent + '$', 'dataAttr.name']);
            //no parent use root
            if (!n.length) {
                n = $('#profile-tree').treeview('findNodes', ['^Profile' + newNode.dataAttr.profile + key + '$', 'id']);
                $('#profile-tree').treeview('addNode', [cleanNode(newNode), n, false, { silent: true }]);
            }
            else {
                $('#profile-tree').treeview('addNode', [cleanNode(newNode), n, false, { silent: true }]);
                sortNodeChildren(n[0].id);
            }
        }
        if (item.name !== old.name && item.name && item.name.length > 0) {
            //move old children to root
            const root = $('#profile-tree').treeview('findNodes', ['^Profile' + newNode.dataAttr.profile + key + '$', 'id']);
            updateNode = $('#profile-tree').treeview('findNodes', ['^' + updateNode.id + '$', 'id'])[0];
            let mn;
            if (old.name && old.name.length > 0) {
                n = $('#profile-tree').treeview('findNodes', ['^' + old.name + '$', 'dataAttr.parent']);
                mn = [];
                mn.push.apply(mn, n);
                while (n.length > 0) {
                    $('#profile-tree').treeview('removeNode', [n, { silent: true }]);
                    n = $('#profile-tree').treeview('findNodes', ['^' + old.name + '$', 'dataAttr.parent']);
                }
                $('#profile-tree').treeview('addNode', [cleanNodes(mn), root, false, { silent: true }]);
                newNode = clone(updateNode);
                delete newNode.nodes;
                $('#profile-tree').treeview('updateNode', [updateNode, cleanNode(newNode)]);
                updateNode = $('#profile-tree').treeview('findNodes', ['^' + updateNode.id + '$', 'id'])[0];
            }
            n = $('#profile-tree').treeview('findNodes', ['^' + item.name + '$', 'dataAttr.parent']);
            mn = [];
            mn.push.apply(mn, n);
            while (n.length > 0) {
                $('#profile-tree').treeview('removeNode', [n, { silent: true }]);
                n = $('#profile-tree').treeview('findNodes', ['^' + item.name + '$', 'dataAttr.parent']);
            }
            mn = mn.sort(sortNodes);
            $('#profile-tree').treeview('addNode', [cleanNodes(mn), updateNode, false, { silent: true }]);
        }
    }
    if (selected) {
        updateNode = $('#profile-tree').treeview('findNodes', ['^' + updateNode.id + '$', 'id'])[0];
        $('#profile-tree').treeview('selectNode', [updateNode, { silent: true }]);
        if (updateNode.id === currentNode.id)
            currentNode = updateNode;
    }
    if (updateNode.id === currentNode.id)
        $('#editor-title').text(updateNode.dataAttr.type + ': ' + updateNode.text);
    sortNodeChildren('Profile' + profileID(newNode.dataAttr.profile) + key);
}

function getEditorValue(editor, style: ItemStyle) {
    if (editors[editor]) {
        if (style === ItemStyle.Script)
            editors[editor].getSession().setMode('ace/mode/javascript');
        else if (style === ItemStyle.Parse)
            setParseSyntax(editor);
        else
            editors[editor].getSession().setMode('ace/mode/text');
        return editors[editor].getSession().getValue();
    }
    return $('#' + editor).val();
}

function setEditorValue(editor, value) {
    if (editors[editor])
        editors[editor].getSession().setValue(value);
    else
        $('#' + editor).val(value);
}

function focusEditor(editor) {
    if (editors[editor])
        editors[editor].focus();
    else
        $('#' + editor).focus();
}

export function UpdateEditorMode(type) {
    if (editors[type + '-value']) {
        if ($('#' + type + '-style').val() === '2' || $('#' + type + '-style').val() === ItemStyle.Script) {
            editors[type + '-value'].getSession().setMode('ace/mode/javascript');
            setTimeout(() => editors[type + '-value'].getSession().setMode('ace/mode/javascript'), 100);
        }
        else if ($('#' + type + '-style').val() === '1' || $('#' + type + '-style').val() === ItemStyle.Parse) {
            setParseSyntax(type + '-value');
            setTimeout(() => setParseSyntax(type + '-value'), 100);
        }
        else {
            editors[type + '-value'].getSession().setMode('ace/mode/text');
            setTimeout(() => editors[type + '-value'].getSession().setMode('ace/mode/text'), 100);
        }
    }
}

function UpdateMacro(customUndo?: boolean): UpdateState {
    let data: any = UpdateItem(currentProfile.macros[currentNode.dataAttr.index], 'macro', { key: true, gamepad: true, gamepadAxes: true });
    if (currentProfile.macros[currentNode.dataAttr.index].key !== parseInt($('#macro-key').data('key'), 10)) {
        if (!data) data = {};
        data.key = currentProfile.macros[currentNode.dataAttr.index].key;
        currentProfile.macros[currentNode.dataAttr.index].key = parseInt($('#macro-key').data('key'), 10);
    }
    if (currentProfile.macros[currentNode.dataAttr.index].modifiers !== parseInt($('#macro-key').data('mod'), 10)) {
        if (!data) data = {};
        data.modifiers = currentProfile.macros[currentNode.dataAttr.index].modifiers;
        currentProfile.macros[currentNode.dataAttr.index].modifiers = parseInt($('#macro-key').data('mod'), 10);
    }
    if (currentProfile.macros[currentNode.dataAttr.index].gamepad !== parseInt($('#macro-key').data('gamepad'), 10)) {
        if (!data) data = {};
        data.gamepad = currentProfile.macros[currentNode.dataAttr.index].gamepad;
        currentProfile.macros[currentNode.dataAttr.index].gamepad = parseInt($('#macro-key').data('gamepad'), 10);
    }
    if (currentProfile.macros[currentNode.dataAttr.index].gamepadAxes !== parseInt($('#macro-key').data('axes'), 10)) {
        if (!data) data = {};
        data.gamepadAxes = currentProfile.macros[currentNode.dataAttr.index].gamepadAxes;
        currentProfile.macros[currentNode.dataAttr.index].gamepadAxes = parseInt($('#macro-key').data('axes'), 10);
    }
    if (data) {
        UpdateItemNode(currentProfile.macros[currentNode.dataAttr.index], 0, data);
        $('#editor-title').text('Macro: ' + GetDisplay(currentProfile.macros[currentNode.dataAttr.index]));
        if (!customUndo)
            pushUndo({ action: 'update', type: 'macro', item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

function UpdateAlias(customUndo?: boolean): UpdateState {
    /*
    if (!validateIdentifiers(<HTMLInputElement>document.getElementById('alias-params'), true)) {
        if (!$('#alias-editor .btn-adv').data('open'))
            $('#alias-editor .btn-adv').trigger('click');
        document.getElementById('alias-params').focus();
        return UpdateState.Error;
    }
    */
    const data: any = UpdateItem(currentProfile.aliases[currentNode.dataAttr.index]);
    if (data) {
        UpdateItemNode(currentProfile.aliases[currentNode.dataAttr.index], 0, data);
        $('#editor-title').text('Alias: ' + GetDisplay(currentProfile.aliases[currentNode.dataAttr.index]));
        if (!customUndo)
            pushUndo({ action: 'update', type: 'alias', item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

function getState() {
    return parseInt((<HTMLInputElement>document.getElementById('state')).value, 10);
}

function setState(state) {
    (<HTMLInputElement>document.getElementById('state')).value = state;
}

function UpdateTrigger(customUndo?: boolean): UpdateState {
    const state = getState();
    let data: any;
    if (state === 0)
        data = UpdateItem(currentProfile.triggers[currentNode.dataAttr.index]);
    else
        data = UpdateItem(currentProfile.triggers[currentNode.dataAttr.index].triggers[state - 1]);
    if (data) {
        if (state === 0) {
            $('#trigger-states-dropdown li:nth-child(' + (state + 1) + ') a').contents().first().replaceWith(`${state}: ${htmlEncode(GetDisplay(currentProfile.triggers[currentNode.dataAttr.index]))}`);
            UpdateItemNode(currentProfile.triggers[currentNode.dataAttr.index], 0, data);
            $('#editor-title').text('Trigger: ' + GetDisplay(currentProfile.triggers[currentNode.dataAttr.index]));
            if (!customUndo)
                pushUndo({ action: 'update', type: 'trigger', item: currentNode.dataAttr.index, subitem: 0, profile: currentProfile.name.toLowerCase(), data: data });
        }
        else {
            $('#trigger-states-dropdown li:nth-child(' + (state + 1) + ') a').contents().first().replaceWith(`${state}: ${htmlEncode(GetDisplay(currentProfile.triggers[currentNode.dataAttr.index].triggers[state - 1]))}`);
            $('#editor-title').text('Trigger: ' + GetDisplay(currentProfile.triggers[currentNode.dataAttr.index].triggers[state - 1]));
            if (!customUndo)
                pushUndo({ action: 'update', type: 'trigger', item: currentNode.dataAttr.index, subitem: state, profile: currentProfile.name.toLowerCase(), data: data });
        }
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

function UpdateButton(customUndo?: boolean): UpdateState {
    const data: any = UpdateItem(currentProfile.buttons[currentNode.dataAttr.index]);
    if (data) {
        UpdateButtonSample();
        UpdateItemNode(currentProfile.buttons[currentNode.dataAttr.index], 0, data);
        $('#editor-title').text('Button: ' + GetDisplay(currentProfile.buttons[currentNode.dataAttr.index]));
        if (!customUndo)
            pushUndo({ action: 'update', type: 'button', item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

function UpdateContext(customUndo?: boolean): UpdateState {
    const data: any = UpdateItem(currentProfile.contexts[currentNode.dataAttr.index]);
    if (data) {
        UpdateContextSample();
        UpdateItemNode(currentProfile.contexts[currentNode.dataAttr.index], 0, data);
        $('#editor-title').text('Context: ' + GetDisplay(currentProfile.contexts[currentNode.dataAttr.index]));
        if (!customUndo)
            pushUndo({ action: 'update', type: 'context', item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

function UpdateItem(item, type?, options?) {
    if (!item) return null;
    let changed = 0;
    const data: any = {};
    if (typeof type === 'object') {
        options = type;
        type = getType(item);
    }
    else if (!type)
        type = getType(item);
    if (!options) options = {};

    if (item.enabled !== $('#editor-enabled').prop('checked')) {
        data.enabled = item.enabled;
        changed++;
        item.enabled = $('#editor-enabled').prop('checked');
    }
    let prop;
    for (prop in item) {
        if (!item.hasOwnProperty(prop) || prop === 'enabled') {
            continue;
        }
        const id = '#' + type + '-' + prop;
        if ($(id).length === 0 || options[prop])
            continue;
        else if ($(id).hasClass('selectpicker')) {
            if (item[prop] !== parseInt($(id).selectpicker('val'), 10)) {
                data[prop] = item[prop];
                changed++;
                item[prop] = parseInt($(id).selectpicker('val'), 10);
            }
        }
        else if (typeof item[prop] === 'boolean') {
            if (item[prop] !== $(id).prop('checked')) {
                data[prop] = item[prop];
                changed++;
                item[prop] = $(id).prop('checked');
            }
        }
        else if (typeof item[prop] === 'number') {
            if (item[prop] !== parseInt(<string>$(id).val(), 10)) {
                data[prop] = item[prop];
                changed++;
                item[prop] = parseInt(<string>$(id).val(), 10);
            }
        }
        else if (editors[type + '-' + prop]) {
            const val = getEditorValue(type + '-' + prop, item.style);
            if (item[prop] !== val) {
                data[prop] = item[prop];
                changed++;
                item[prop] = val;
            }
        }
        else {
            if (item[prop] !== $(id).val()) {
                data[prop] = item[prop];
                changed++;
                item[prop] = $(id).val();
            }
        }
    }
    if (changed > 0)
        return data;
    return null;
}

function UpdateProfileNode(profile?) {
    if (!profile)
        profile = currentProfile;
    else if (typeof profile === 'string')
        profile = profiles.items[profile];
    if (currentProfile.name === profile.name)
        $('#editor-title').text('Profile: ' + profile.name);
    const val = profile.name;
    let node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(val) + '$', 'id'])[0];
    const selected = node.state.selected;
    const expanded = node.state.expanded;
    const newNode = newProfileNode(profile);
    //Rebuild child nodes based on current expand state and to update incase of name change
    const nl = node.nodes.length;
    for (let n = 0; n < nl; n++) {
        if (node.nodes[n].length > 0) {
            if (!node.nodes[n].lazyLoad) {
                newNode.nodes[n].lazyLoad = false;
                const key = newNode.nodes[n].dataAttr.type;
                if (!newNode.nodes[n].nodes)
                    newNode.nodes[n].nodes = [];
                const cl = node.nodes[n].nodes.length;
                for (let c = 0; c < cl; c++) {
                    newNode.nodes[n].nodes.push(newItemNode(profile[key][c]));
                }
            }
        }
    }
    $('#profile-tree').treeview('updateNode', [node, newNode]);
    //re-select node to get the new object for proper data
    node = $('#profile-tree').treeview('findNodes', ['^' + newNode.id + '$', 'id'])[0];
    //if was selected re-select
    if (selected) {
        $('#profile-tree').treeview('selectNode', [node, { silent: true }]);
        currentNode = node;
    }
    //if expanded re-expand
    if (expanded)
        $('#profile-tree').treeview('expandNode', [node]);
}

function sortNodes(a, b) {
    if ((_sort & 4) === 4) {
        if (a.dataAttr.priority > b.dataAttr.priority)
            return -1 * _sortDir;
        if (a.dataAttr.priority < b.dataAttr.priority)
            return 1 * _sortDir;
    }
    if ((_sort & 2) === 2) {
        const r = a.text.localeCompare(b.text);
        if (r !== 0) return r * _sortDir;
    }
    if ((_sort & 8) === 8) {
        if (a.dataAttr.index < b.dataAttr.index)
            return -1 * _sortDir;
        if (a.dataAttr.index > b.dataAttr.index)
            return 1 * _sortDir;
    }
    return 0;
}

function sortProfileNodes(a, b) {
    if ((_sort & 4) === 4) {
        if (a.dataAttr.priority > b.dataAttr.priority)
            return -1 * _sortDir;
        if (a.dataAttr.priority < b.dataAttr.priority)
            return 1 * _sortDir;
    }
    return a.text.localeCompare(b.text) * _sortDir;
}

function sortNodeChildren(node) {
    if (!node)
        return;
    else if (typeof node === 'string')
        node = $('#profile-tree').treeview('findNodes', ['^' + node + '$', 'id'])[0];
    const newNode = cloneNode(node);
    newNode.nodes = newNode.nodes.sort(sortNodes);
    $('#profile-tree').treeview('updateNode', [node, newNode]);
    if (currentNode)
        currentNode = $('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id'])[0];
}

function newItemNode(item, idx?: number, type?: string, profile?, p?: string) {
    if (!profile)
        profile = currentProfile.name.toLowerCase();
    else if (typeof profile === 'object')
        profile = profile.name.toLowerCase();
    if (!type)
        type = getType(item);
    else
        type = type.toLowerCase();
    const key = getKey(type);
    if (!idx && typeof idx !== 'number')
        idx = profiles.items[profile][key].length;
    if (!p)
        p = '' + idx;
    const node: any = {
        text: htmlEncode(GetDisplay(item)),
        id: 'Profile' + profileID(profile) + key + p,
        dataAttr: {
            type: type,
            profile: profile,
            index: idx,
            name: item.name,
            path: p,
            priority: item.priority,
            parent: item.parent
        },
        state: {
            checked: item.enabled
        }
    };
    if (type === 'context' && item.name && item.name.length > 0 && item.parent !== item.name) {
        let i = 0;
        const contexts = profiles.items[profile][key];
        const il = contexts.length;
        const nodes = [];
        for (; i < il; i++) {
            if (contexts[i].parent === item.name)
                nodes.push(newItemNode(contexts[i], i, type, profile));
        }
        if (nodes.length > 0) {
            node.nodes = nodes.sort(sortNodes);
        }
    }
    if (item.items && item.items.length > 0) {
        let i = 0;
        const il = item.items.length;
        if (!node.nodes)
            node.nodes = [];
        for (; i < il; i++) {
            node.nodes.push(newItemNode(item.items[i], idx, type, profile, `${p}\\${i}`));
        }
    }
    return node;
}

function newProfileNode(profile?) {
    if (!profile)
        profile = currentProfile;
    else if (typeof profile === 'string')
        profile = profiles.items[profile];
    if (!profile) return null;
    const id = 'Profile' + profileID(profile.name);
    const key = profile.name.toLowerCase();
    return {
        text: profile.name,
        id: id,
        dataAttr: {
            type: 'profile',
            profile: key,
            priority: profile.priority,
        },
        state: {
            checked: _enabled.indexOf(key) !== -1
        },
        nodes: [
            {
                text: 'Aliases',
                id: id + 'aliases',
                dataAttr: {
                    profile: key,
                    type: 'aliases'
                },
                lazyLoad: profile.aliases.length > 0,
                state: {
                    checked: profile.enableAliases
                },
                nodes: []
            },
            {
                text: 'Macros',
                id: id + 'macros',
                dataAttr: {
                    profile: key,
                    type: 'macros'
                },
                lazyLoad: profile.macros.length > 0,
                state: {
                    checked: profile.enableMacros
                },
                nodes: []
            },
            {
                text: 'Triggers',
                id: id + 'triggers',
                dataAttr: {
                    profile: key,
                    type: 'triggers'
                },
                lazyLoad: profile.triggers.length > 0,
                state: {
                    checked: profile.enableTriggers
                },
                nodes: []
            },
            {
                text: 'Buttons',
                id: id + 'buttons',
                dataAttr: {
                    profile: key,
                    type: 'buttons'
                },
                lazyLoad: profile.buttons.length > 0,
                state: {
                    checked: profile.enableButtons
                },
                nodes: []
            },
            {
                text: 'Contexts',
                id: id + 'contexts',
                dataAttr: {
                    profile: key,
                    type: 'contexts'
                },
                lazyLoad: profile.contexts.length > 0,
                state: {
                    checked: profile.enableContexts
                },
                nodes: []
            }
        ]
    };
}

function cloneNode(node) {
    return cleanNode(clone(node));
}

function cleanNode(node) {
    delete node.$el;
    delete node.parentId;
    delete node.nodeId;
    delete node.level;
    delete node.index;
    if (!node.nodes)
        return node;
    const nl = node.nodes.length;
    for (let n = 0; n < nl; n++)
        node.nodes[n] = cleanNode(node.nodes[n]);
    return node;
}

function cleanNodes(nodes) {
    const nl = nodes.length;
    for (let n = 0; n < nl; n++)
        nodes[n] = cleanNode(nodes[n]);
    return nodes;
}

function UpdateProfile(customUndo?: boolean): UpdateState {
    const data: any = {};
    let changed = 0;
    let val = <string>$('#profile-name').val();
    const e = _enabled.indexOf(currentProfile.name.toLowerCase()) !== -1;
    let p;
    const selected = currentNode.state.selected;
    const expanded = currentNode.state.expanded;
    const currentID = currentNode.id;
    const type = currentNode.dataAttr.type;
    if (currentProfile.priority !== parseInt(<string>$('#profile-priority').val(), 10)) {
        data.priority = currentProfile.priority;
        changed++;
        currentProfile.priority = parseInt(<string>$('#profile-priority').val(), 10);
    }
    if (val !== currentProfile.name) {
        data.name = val;
        changed++;
        if (profiles.contains(val)) {
            dialog.showMessageBox({
                type: 'error',
                title: 'Profile name already used',
                message: 'The name is already in use, pick a different one'
            });
            $('#profile-name').val(currentProfile.name);
            $('#profile-name').focus();
            return UpdateState.Error;
        }
        profiles.remove(currentProfile);
        if (e) {
            _enabled = _enabled.filter((a) => { return a !== currentProfile.name.toLowerCase(); });
            _enabled.push(val.toLowerCase());
        }
        let node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(currentProfile.name) + '$', 'id'])[0];
        currentProfile.name = val;
        profiles.add(currentProfile);
        $('#editor-title').text('Profile: ' + currentProfile.name);
        $('#profile-tree').treeview('updateNode', [node, newProfileNode()]);
        if (type !== 'profile') {
            const parent = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(val) + '$', 'id'])[0];
            node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(val) + type + '$', 'id']);
            if (expanded || selected)
                $('#profile-tree').treeview('expandNode', [parent]);
            if (expanded)
                $('#profile-tree').treeview('expandNode', [node]);
            if (selected) {
                $('#profile-tree').treeview('selectNode', [node, { silent: true }]);
                currentNode = node;
            }
        }
        else {
            node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(val) + '$', 'id'])[0];
            if (selected) {
                $('#profile-tree').treeview('selectNode', [node, { silent: true }]);
                currentNode = node;
            }
            if (expanded)
                $('#profile-tree').treeview('expandNode', [node]);
        }
        p = sortTree();
    }
    else if (changed) {
        let node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(val) + '$', 'id'])[0];
        $('#profile-tree').treeview('updateNode', [node, newProfileNode()]);
        if (type !== 'profile') {
            const parent = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(val) + '$', 'id'])[0];
            node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(val) + type + '$', 'id']);
            if (expanded || selected)
                $('#profile-tree').treeview('expandNode', [parent]);
            if (expanded)
                $('#profile-tree').treeview('expandNode', [node]);
            if (selected) {
                $('#profile-tree').treeview('selectNode', [node, { silent: true }]);
                currentNode = node;
            }
        }
        else {
            node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(val) + '$', 'id'])[0];
            if (selected) {
                $('#profile-tree').treeview('selectNode', [node, { silent: true }]);
                currentNode = node;
            }
            if (expanded)
                $('#profile-tree').treeview('expandNode', [node]);
        }
        p = sortTree();
    }

    if (currentProfile.enableAliases !== $('#profile-enableAliases').prop('checked')) {
        data.enableAliases = currentProfile.enableAliases;
        changed++;
        currentProfile.enableAliases = $('#profile-enableAliases').prop('checked');
    }
    if (currentProfile.enableMacros !== $('#profile-enableMacros').prop('checked')) {
        data.enableMacros = currentProfile.enableMacros;
        changed++;
        currentProfile.enableMacros = $('#profile-enableMacros').prop('checked');
    }
    if (currentProfile.enableTriggers !== $('#profile-enableTriggers').prop('checked')) {
        data.enableTriggers = currentProfile.enableTriggers;
        changed++;
        currentProfile.enableTriggers = $('#profile-enableTriggers').prop('checked');
    }
    if (currentProfile.enableButtons !== $('#profile-enableButtons').prop('checked')) {
        data.enableButtons = currentProfile.enableButtons;
        changed++;
        currentProfile.enableButtons = $('#profile-enableButtons').prop('checked');
    }
    if (currentProfile.enableContexts !== $('#profile-enableContexts').prop('checked')) {
        data.enableContexts = currentProfile.enableContexts;
        changed++;
        currentProfile.enableContexts = $('#profile-enableContexts').prop('checked');
    }

    if (currentProfile.enableDefaultContext !== $('#profile-enableDefaultContext').prop('checked')) {
        data.enableDefaultContext = currentProfile.enableDefaultContext;
        changed++;
        currentProfile.enableDefaultContext = $('#profile-enableDefaultContext').prop('checked');
    }

    if (e !== $('#editor-enabled').prop('checked')) {
        if ($('#editor-enabled').prop('checked')) {
            data.enabled = e;
            _enabled.push(currentProfile.name.toLowerCase());
            changed++;
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id'])]);
        }
        else {
            _enabled = _enabled.filter((a) => { return a !== currentProfile.name.toLowerCase(); });
            if (_enabled.length === 0) {
                _enabled.push(currentProfile.name.toLowerCase());
                $('#editor-enabled').prop('checked', true);
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id'])]);
            }
            else {
                data.enabled = e;
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + '$', 'id'])]);
                changed++;
            }
        }
    }
    if (p)
        p.then(() => {
            val = profileID(currentProfile.name);
            if (currentProfile.enableAliases)
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'aliases$', 'id'])]);
            else
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'aliases$', 'id'])]);
            if (currentProfile.enableMacros)
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'macros$', 'id'])]);
            else
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'macros$', 'id'])]);
            if (currentProfile.enableTriggers)
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'triggers$', 'id'])]);
            else
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'triggers$', 'id'])]);
            if (currentProfile.enableButtons)
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'buttons$', 'id'])]);
            else
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'buttons$', 'id'])]);
            if (currentProfile.enableContexts)
                $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'contexts$', 'id'])]);
            else
                $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'contexts$', 'id'])]);
        });
    else {
        val = profileID(currentProfile.name);
        if (currentProfile.enableAliases)
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'aliases$', 'id'])]);
        else
            $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'aliases$', 'id'])]);
        if (currentProfile.enableMacros)
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'macros$', 'id'])]);
        else
            $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'macros$', 'id'])]);
        if (currentProfile.enableTriggers)
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'triggers$', 'id'])]);
        else
            $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'triggers$', 'id'])]);
        if (currentProfile.enableButtons)
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'buttons$', 'id'])]);
        else
            $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'buttons$', 'id'])]);
        if (currentProfile.enableContexts)
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'contexts$', 'id'])]);
        else
            $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'contexts$', 'id'])]);
    }
    if (changed > 0 && !customUndo) {
        pushUndo({ action: 'update', type: 'profile', profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

export function updateProfileChecks() {
    _pUndo = true;
    const val = profileID(currentProfile.name);

    if ($('#profile-enableAliases').prop('checked'))
        $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'aliases$', 'id']), { silent: true }]);
    else
        $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'aliases$', 'id']), { silent: true }]);
    if ($('#profile-enableMacros').prop('checked'))
        $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'macros$', 'id']), { silent: true }]);
    else
        $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'macros$', 'id']), { silent: true }]);
    if ($('#profile-enableTriggers').prop('checked'))
        $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'triggers$', 'id']), { silent: true }]);
    else
        $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'triggers$', 'id']), { silent: true }]);
    if ($('#profile-enableButtons').prop('checked'))
        $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'buttons$', 'id']), { silent: true }]);
    else
        $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'buttons$', 'id']), { silent: true }]);
    if ($('#profile-enableContexts').prop('checked'))
        $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'contexts$', 'id']), { silent: true }]);
    else
        $('#profile-tree').treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + 'contexts$', 'id']), { silent: true }]);

    _pUndo = false;
}

function nodeCheckChanged(event, node) {
    let changed = 1;
    const data: any = {};
    if (!node) return;
    let t = 'profile';
    if (!node.dataAttr.type)
        t = $('#profile-tree').treeview('getParents', node)[0].dataAttr.type;
    else
        t = node.dataAttr.type;
    const profile = profiles.items[node.dataAttr.profile];
    switch (t) {
        case 'profile':
            const e = _enabled.indexOf(node.dataAttr.profile) !== -1;
            if (!node.state.checked && e) {
                _enabled = _enabled.filter((a) => { return a !== node.dataAttr.profile; });
                if (_enabled.length === 0) {
                    _enabled.push(node.dataAttr.profile);
                    $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + node.id + '$', 'id']), { silent: true }]);
                    changed = 0;
                }
                else {
                    data.enabled = false;
                }
            }
            else if (!e && node.state.checked) {
                _enabled.push(node.dataAttr.profile);
                data.enabled = true;
            }
            else
                changed = 0;
            if (profile === currentProfile)
                $('#editor-enabled').prop('checked', _enabled.indexOf(node.dataAttr.profile) !== -1);
            break;
        case 'aliases':
            profile.enableAliases = node.state.checked;
            t = 'profile';
            data.enableAliases = node.state.checked;
            if (profile === currentProfile)
                $('#profile-enableAliases').prop('checked', node.state.checked);
            break;
        case 'macros':
            profile.enableMacros = node.state.checked;
            t = 'profile';
            data.enableMacros = node.state.checked;
            if (profile === currentProfile)
                $('#profile-enableMacros').prop('checked', node.state.checked);
            break;
        case 'triggers':
            profile.enableTriggers = node.state.checked;
            t = 'profile';
            data.enableTriggers = node.state.checked;
            if (profile === currentProfile)
                $('#profile-enableTriggers').prop('checked', node.state.checked);
            break;
        case 'buttons':
            profile.enableButtons = node.state.checked;
            t = 'profile';
            data.enableButtons = node.state.checked;
            if (profile === currentProfile)
                $('#profile-enableButtons').prop('checked', node.state.checked);
            break;
        case 'contexts':
            profile.enableContexts = node.state.checked;
            t = 'profile';
            data.enableContexts = node.state.checked;
            if (profile === currentProfile)
                $('#profile-enableContexts').prop('checked', node.state.checked);
            break;
        case 'alias':
            profile.aliases[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id === currentNode.id)
                $('#editor-enabled').prop('checked', node.state.checked);
            break;
        case 'macro':
            profile.macros[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id === currentNode.id)
                $('#editor-enabled').prop('checked', node.state.checked);
            break;
        case 'trigger':
            profile.triggers[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id === currentNode.id && getState() === 0)
                $('#editor-enabled').prop('checked', node.state.checked);
            break;
        case 'button':
            profile.buttons[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id === currentNode.id)
                $('#editor-enabled').prop('checked', node.state.checked);
            break;
        case 'context':
            profile.contexts[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id === currentNode.id)
                $('#editor-enabled').prop('checked', node.state.checked);
            break;
    }
    if (changed > 0)
        pushUndo({ action: 'update', type: t, item: node.dataAttr.index, profile: profile.name, data: data });
}

function resetClip() {
    if (_clip && _clip.data.length > 0 && _clip.action === 2) {
        const il = _clip.data.length;
        for (let i = 0; i < il; i++) {
            const nodes = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(_clip.profile) + _clip.key + _clip.data[i], 'id']);
            nodes[0].$el.css('opacity', '');
        }
    }
    _clip = 0;
}

function canPaste() {
    if (_clip) {
        if (_clip.data.length === 1 && _clip.type === 'macro') {
            let r = FilterArrayByKeyValue(currentProfile.macros, 'key', _clip.data[0].key);
            r = FilterArrayByKeyValue(r, 'modifiers', _clip.data[0].modifiers);
            if (r.length === 0)
                return true;
        }
        else
            return true;
    }
    return false;
}

function UpdatePaste() {
    $('#btn-paste').prop('disabled', !canPaste());
    menubar.updateItem('edit|paste', { enabled: canPaste() });
}

function getType(item) {
    if (item instanceof Alias)
        return 'alias';
    if (item instanceof Button)
        return 'button';
    if (item instanceof Trigger)
        return 'trigger';
    if (item instanceof Macro)
        return 'macro';
    if (item instanceof Context)
        return 'context';
    return 'profile';
}

function getKey(type: string) {
    switch (type) {
        case 'alias':
        case 'aliases':
            return 'aliases';
        case 'macro':
        case 'macros':
            return 'macros';
        case 'trigger':
        case 'triggers':
            return 'triggers';
        case 'button':
        case 'buttons':
            return 'buttons';
        case 'context':
        case 'contexts':
            return 'contexts';
    }
}

function addProfile(profile: Profile, noSort?: boolean) {
    profiles.add(profile);
    const n = profile.name;
    const ln = n.toLowerCase();
    _remove = _remove.filter((a) => { return a.name !== n; });
    _enabled = _enabled.filter((a) => { return a !== n; });
    $('#profile-tree').treeview('addNode', [newProfileNode(profile), false, false]);
    if (!noSort)
        sortTree();
}

export function doUndo() {
    if (_undo.length === 0)
        return;
    const action = _undo.pop();

    _pUndo = true;
    if (currentNode.id !== action.data) {
        const s = $('#profile-tree').treeview('findNodes', ['^' + action.node + '$', 'id']);
        if (s.length > 0)
            $('#profile-tree').treeview('selectNode', s);
    }
    switch (action.action) {
        case 'add':
            if (action.type === 'profile') {
                let pl = action.item.length;
                for (let p = 0; p < pl; p++) {
                    DeleteProfile(action.item[p], true);
                }
                if (action.replaced && action.replaced.length > 0) {
                    pl = action.replaced.length;
                    for (let p = 0; p < pl; p++)
                        addProfile(action.replaced[p], true);
                }
                sortTree();
            }
            else
                DeleteItem(action.type, action.data.key, action.data.idx, profiles.items[action.data.profile], true);
            break;
        case 'delete':
            if (action.type === 'profile')
                addProfile(action.item);
            else
                insertItem(action.type, action.data.key, action.item, action.data.idx, profiles.items[action.data.profile], true);
            break;
        case 'deletestate':
            profiles.items[action.data.profile].triggers[action.data.idx] = action.item.clone();
            sortNodeChildren('Profile' + profileID(profiles.items[action.data.profile].name) + 'triggers');
            //current node that is being modified is the selected one
            if (currentProfile === profiles.items[action.data.profile] && currentNode.dataAttr.index === action.data.idx && currentNode.dataAttr.type == action.type) {
                const item = profiles.items[action.data.profile].triggers[action.data.idx];
                if (item.triggers && item.triggers.length) {
                    $($('#trigger-states').parent()).css('display', '');
                    let items = [];
                    const tl = item.triggers.length;
                    items.push(addTriggerStateDropdown(item, 0));
                    for (let t = 0; t < tl; t++) {
                        items.push(addTriggerStateDropdown(item.triggers[t], t + 1));
                    }
                    $('#trigger-states-dropdown').html(items.join(''));
                }
                else {
                    $('#trigger-states-dropdown').html(addTriggerStateDropdown(item, 0));
                    $('#trigger-states-dropdown li:first-child button:nth-child(1)').prop('disabled', true);
                    $($('#trigger-states').parent()).css('display', 'none');
                }
                $('#trigger-states-delete').prop('disabled', !(item.triggers && item.triggers.length));
                $('#trigger-priority').parent().css('display', !(item.triggers && item.triggers.length) || action.subitem === 0 ? '' : 'none');
                $('#trigger-priority').parent().prev().css('display', !(item.triggers && item.triggers.length) || action.subitem === 0 ? '' : 'none');
                $('#trigger-state').parent().css('display', item.triggers && item.triggers.length ? (action.subitem === 0 ? '' : 'none') : 'none');
                $('#trigger-state').parent().prev().css('display', item.triggers && item.triggers.length ? (action.subitem === 0 ? '' : 'none') : 'none');
                $('#triggers-name').css('display', !(item.triggers && item.triggers.length) || action.subitem === 0 ? '' : 'none');
                SelectTriggerState(action.subitem, true);
            }
            break;
        case 'swapstate':
            swapTriggerState(action.newItem, action.prevItem, profiles.items[action.data.profile], action.data.idx, currentProfile === profiles.items[action.data.profile] && currentNode.dataAttr.index === action.data.idx && currentNode.dataAttr.type == action.type, true);
            break;
        case 'update':
            const current = {};
            if (action.type === 'profile') {
                let prop;
                for (prop in action.data) {
                    if (!action.data.hasOwnProperty(prop)) {
                        continue;
                    }
                    if (prop === 'enabled') {
                        _enabled = _enabled.filter((a) => { return a !== action.profile; });
                        if (action.data.enabled)
                            _enabled.push(action.profile);
                        continue;
                    }
                    current[prop] = profiles.items[action.profile][prop];
                    profiles.items[action.profile][prop] = action.data[prop];
                }
                UpdateProfileNode(profiles.items[action.profile]);
                const t = currentNode.dataAttr.type;
                if (t === 'profile' || t === 'aliases' || t === 'triggers' || t === 'buttons' || t === 'macros' || t === 'contexts') {
                    UpdateEditor('profile', currentProfile, {
                        post: () => {
                            if (currentProfile.name === 'Default') {
                                $('#profile-name').prop('disabled', true);
                                if (t === 'profile') {
                                    $('#btn-cut').prop('disabled', true);
                                    $('#btn-delete').prop('disabled', true);
                                    menubar.updateItem('edit|cut', { enabled: false });
                                    menubar.updateItem('edit|delete', { enabled: false });
                                }
                            }
                            else
                                $('#profile-name').prop('disabled', false);

                            if (t !== 'profile' && currentProfile[t].length === 0) {
                                $('#btn-copy').prop('disabled', true);
                                $('#btn-cut').prop('disabled', true);
                                $('#btn-delete').prop('disabled', true);
                                menubar.updateItem('edit|cut', { enabled: false });
                                menubar.updateItem('edit|copy', { enabled: false });
                                menubar.updateItem('edit|delete', { enabled: false });
                            }
                            else if (t === 'profile') {
                                $('#btn-cut').prop('disabled', true);
                                menubar.updateItem('edit|cut', { enabled: false });
                            }
                        }
                    });
                }
            }
            else {
                const key = getKey(action.type);
                let prop;
                for (prop in action.data) {
                    if (!action.data.hasOwnProperty(prop)) {
                        continue;
                    }
                    current[prop] = profiles.items[action.profile][key][action.item][prop];
                    profiles.items[action.profile][key][action.item][prop] = action.data[prop];
                }
                UpdateItemNode(currentProfile[key][action.item], 'Profile' + profileID(action.profile) + key + action.item, current);
                if (currentNode.id === 'Profile' + profileID(action.profile) + key + action.item) {
                    switch (action.type) {
                        case 'alias':
                            UpdateEditor('alias', profiles.items[action.profile][key][action.item]);
                            break;
                        case 'macro':
                            UpdateEditor('macro', profiles.items[action.profile][key][action.item], { key: MacroValue });
                            break;
                        case 'trigger':
                            if (action.subitem)
                                UpdateEditor('trigger', profiles.items[action.profile][key][action.item].triggers[action.subitem - 1], { pre: initTriggerEditor, post: clearTriggerTester });
                            else
                                UpdateEditor('trigger', profiles.items[action.profile][key][action.item], { pre: initTriggerEditor, post: clearTriggerTester });
                            break;
                        case 'button':
                            UpdateEditor('button', profiles.items[action.profile][key][action.item], { post: UpdateButtonSample });
                            break;
                        case 'context':
                            UpdateEditor('context', profiles.items[action.profile][key][action.item], { post: UpdateContextSample });
                            break;
                    }
                }
            }
            action.data = current;
            break;
        case 'group':
            let i;
            let il;
            let item;
            if (action.add.length > 0) {
                for (i = 0, il = action.add.length; i < il; i++) {
                    item = action.add[i];
                    if (item.type === 'profile') {
                        const pl = item.item.length;
                        for (let p = 0; p < pl; p++)
                            DeleteProfile(profiles.items[item.item[p]], true);
                    }
                    else
                        DeleteItem(item.type, item.data.key, item.data.idx, profiles.items[item.data.profile], true);
                }
            }
            if (action.delete.length > 0) {
                il = action.add.length;
                for (i = 0; i < il; i++) {
                    item = action.add[i];
                    if (item.type === 'profile')
                        addProfile(item.item);
                    else
                        insertItem(item.type, item.data.key, item.item, item.data.idx, profiles.items[item.data.profile], true);
                }
            }
            break;
        case 'reset':
            const name = action.profile.name.toLowerCase();
            const id = profileID(action.profile.name);
            const oldProfile = profiles.items[name];
            profiles.items[name] = action.profile;
            let node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(id) + '$', 'id'])[0];
            const newNode = newProfileNode(action.profile);
            const selected = node.state.selected;
            const expanded = node.state.expanded;
            $('#profile-tree').treeview('updateNode', [node, newNode]);
            //re-select node to get the new object for proper data
            node = $('#profile-tree').treeview('findNodes', ['^' + newNode.id + '$', 'id'])[0];
            //if was selected re-select
            if (selected) {
                $('#profile-tree').treeview('selectNode', [node, { silent: true }]);
                currentNode = node;
            }
            //if expanded re-expand
            if (expanded)
                $('#profile-tree').treeview('expandNode', [node]);
            action.profile = oldProfile;
            break;
    }
    _redo.push(action);
    updateUndoState();
    _pUndo = false;
}

export function doRedo() {
    if (_redo.length === 0)
        return;
    const action = _redo.pop();

    _pUndo = true;
    if (currentNode.id !== action.data) {
        const s = $('#profile-tree').treeview('findNodes', ['^' + action.node + '$', 'id']);
        if (s.length > 0)
            $('#profile-tree').treeview('selectNode', s);
    }
    switch (action.action) {
        case 'add':
            if (action.type === 'profile') {
                let p;
                let pl;
                if (action.replaced && action.replaced.length > 0) {
                    pl = action.replaced.length;
                    for (p = 0; p < pl; p++)
                        DeleteProfile(action.replaced[p], true);
                }
                pl = action.item.length;
                for (p = 0; p < pl; p++) {
                    addProfile(action.item[p], true);
                }
                sortTree();
            }
            else
                insertItem(action.type, action.data.key, action.item, action.data.idx, profiles.items[action.data.profile], true);
            break;
        case 'delete':
            if (action.type === 'profile')
                DeleteProfile(action.item, true);
            else
                DeleteItem(action.type, action.data.key, action.data.idx, profiles.items[action.data.profile], true);
            break;
        case 'deletestate':
            removeTriggerState(action.subitem, profiles.items[action.data.profile], action.data.idx, currentProfile === profiles.items[action.data.profile] && currentNode.dataAttr.index === action.data.idx && currentNode.dataAttr.type == action.type, true);
            break;
        case 'swapstate':
            swapTriggerState(action.prevItem, action.newItem, profiles.items[action.data.profile], action.data.idx, currentProfile === profiles.items[action.data.profile] && currentNode.dataAttr.index === action.data.idx && currentNode.dataAttr.type == action.type, true);
            break;
        case 'update':
            const current = {};
            if (action.type === 'profile') {
                let prop;
                for (prop in action.data) {
                    if (!action.data.hasOwnProperty(prop)) {
                        continue;
                    }
                    if (prop === 'enabled') {
                        _enabled = _enabled.filter((a) => { return a !== action.profile; });
                        if (action.data.enabled)
                            _enabled.push(action.profile);
                        continue;
                    }
                    current[prop] = profiles.items[action.profile][prop];
                    profiles.items[action.profile][prop] = action.data[prop];
                }
                UpdateProfileNode(profiles.items[action.profile]);
                const t = currentNode.dataAttr.type;
                if (t === 'profile' || t === 'aliases' || t === 'triggers' || t === 'buttons' || t === 'macros' || t === 'contexts') {
                    UpdateEditor('profile', currentProfile, {
                        post: () => {
                            if (currentProfile.name === 'Default') {
                                $('#profile-name').prop('disabled', true);
                                if (t === 'profile') {
                                    $('#btn-cut').prop('disabled', true);
                                    $('#btn-delete').prop('disabled', true);
                                    menubar.updateItem('edit|cut', { enabled: false });
                                    menubar.updateItem('edit|delete', { enabled: false });
                                }
                            }
                            else
                                $('#profile-name').prop('disabled', false);

                            if (t !== 'profile' && currentProfile[t].length === 0) {
                                $('#btn-copy').prop('disabled', true);
                                $('#btn-cut').prop('disabled', true);
                                $('#btn-delete').prop('disabled', true);
                                menubar.updateItem('edit|cut', { enabled: false });
                                menubar.updateItem('edit|copy', { enabled: false });
                                menubar.updateItem('edit|delete', { enabled: false });
                            }
                            else if (t === 'profile') {
                                $('#btn-cut').prop('disabled', true);
                                menubar.updateItem('edit|cut', { enabled: false });
                            }
                        }
                    });
                }
            }
            else {
                const key = getKey(action.type);
                let prop;
                for (prop in action.data) {
                    if (!action.data.hasOwnProperty(prop)) {
                        continue;
                    }
                    current[prop] = profiles.items[action.profile][key][action.item][prop];
                    profiles.items[action.profile][key][action.item][prop] = action.data[prop];
                }
                UpdateItemNode(currentProfile[key][action.item], 'Profile' + profileID(action.profile) + key + action.item, current);
                if (currentNode.id === 'Profile' + profileID(action.profile) + key + action.item) {
                    switch (action.type) {
                        case 'alias':
                            UpdateEditor('alias', profiles.items[action.profile][key][action.item]);
                            break;
                        case 'macro':
                            UpdateEditor('macro', profiles.items[action.profile][key][action.item], { key: MacroValue });
                            break;
                        case 'trigger':
                            if (action.subitem)
                                UpdateEditor('trigger', profiles.items[action.profile][key][action.item].triggers[action.subitem - 1], { pre: initTriggerEditor, post: clearTriggerTester });
                            else
                                UpdateEditor('trigger', profiles.items[action.profile][key][action.item], { pre: initTriggerEditor, post: clearTriggerTester });
                            break;
                        case 'button':
                            UpdateEditor('button', profiles.items[action.profile][key][action.item], { post: UpdateButtonSample });
                            break;
                        case 'context':
                            UpdateEditor('context', profiles.items[action.profile][key][action.item], { post: UpdateContextSample });
                            break;
                    }
                }
            }
            action.data = current;
            break;
        case 'group':
            let i;
            let il;
            let item;
            if (action.delete.length > 0) {
                for (i = 0, il = action.add.length; i < il; i++) {
                    item = action.add[i];
                    if (item.type === 'profile') {
                        const pl = item.item.length;
                        for (let p = 0; p < pl; p++)
                            DeleteProfile(profiles.items[item.item[p]], true);
                    }
                    else
                        DeleteItem(item.type, item.data.key, item.data.idx, profiles.items[item.data.profile], true);
                }
            }
            if (action.add.length > 0) {
                for (i = 0, il = action.add.length; i < il; i++) {
                    item = action.add[i];
                    if (item.type === 'profile')
                        addProfile(item.item);
                    else
                        insertItem(item.type, item.data.key, item.item, item.data.idx, profiles.items[item.data.profile], true);
                }
            }
            break;
        case 'reset':
            const name = action.profile.name.toLowerCase();
            const id = profileID(action.profile.name);
            const oldProfile = profiles.items[name];
            profiles.items[name] = action.profile;
            let node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(id) + '$', 'id'])[0];
            const newNode = newProfileNode(action.profile);
            const selected = node.state.selected;
            const expanded = node.state.expanded;
            $('#profile-tree').treeview('updateNode', [node, newNode]);
            //re-select node to get the new object for proper data
            node = $('#profile-tree').treeview('findNodes', ['^' + newNode.id + '$', 'id'])[0];
            //if was selected re-select
            if (selected) {
                $('#profile-tree').treeview('selectNode', [node, { silent: true }]);
                currentNode = node;
            }
            //if expanded re-expand
            if (expanded)
                $('#profile-tree').treeview('expandNode', [node]);
            action.profile = oldProfile;
            break;
    }
    _undo.push(action);
    updateUndoState();
    _pUndo = false;
}

export function doCut(node?) {
    let data;
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    resetClip();
    const profile = profiles.items[node.dataAttr.profile];
    let t = 'profile';
    let nodes;
    let il;
    let nl;
    if (!node.dataAttr.type)
        t = node.text.toLowerCase();
    else
        t = node.dataAttr.type;
    switch (t) {
        case 'aliases':
            data = [];
            il = profile.aliases.length;
            for (let i = 0; i < il; i++)
                data.push(i);
            _clip = { type: 'alias', data: data, key: 'aliases' };
            nodes = $('#profile-tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
            nl = nodes.length;
            for (let n = 0; n < nl; n++)
                nodes[n].$el.css('opacity', '0.5');
            break;
        case 'alias':
            _clip = { type: t, data: [node.dataAttr.index], key: 'aliases', idx: node.dataAttr.index };
            node.$el.css('opacity', '0.5');
            break;
        case 'macros':
            data = [];
            il = profile.macros.length;
            for (let i = 0; i < il; i++)
                data.push(i);
            _clip = { type: 'macro', data: data, key: 'macros' };
            nodes = $('#profile-tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
            nl = nodes.length;
            for (let n = 0; n < nl; n++)
                nodes[n].$el.css('opacity', '0.5');
            break;
        case 'macro':
            _clip = { type: t, data: [node.dataAttr.index], key: 'macros', idx: node.dataAttr.index };
            node.$el.css('opacity', '0.5');
            break;
        case 'triggers':
            data = [];
            il = profile.triggers.length;
            for (let i = 0; i < il; i++)
                data.push(i);
            _clip = { type: 'trigger', data: data, key: 'triggers' };
            nodes = $('#profile-tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
            nl = nodes.length;
            for (let n = 0; n < nl; n++)
                nodes[n].$el.css('opacity', '0.5');
            break;
        case 'trigger':
            _clip = { type: t, data: [node.dataAttr.index], key: 'triggers', idx: node.dataAttr.index };
            node.$el.css('opacity', '0.5');
            break;
        case 'buttons':
            data = [];
            il = profile.buttons.length;
            for (let i = 0; i < il; i++)
                data.push(i);
            _clip = { type: 'button', data: data, key: 'buttons' };
            nodes = $('#profile-tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
            nl = nodes.length;
            for (let n = 0; n < nl; n++)
                nodes[n].$el.css('opacity', '0.5');
            break;
        case 'button':
            _clip = { type: t, data: [node.dataAttr.index], key: 'buttons', idx: node.dataAttr.index };
            node.$el.css('opacity', '0.5');
            break;
        case 'contexts':
            data = [];
            il = profile.contexts.length;
            for (let i = 0; i < il; i++)
                data.push(i);
            _clip = { type: 'context', data: data, key: 'contexts' };
            nodes = $('#profile-tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
            nl = nodes.length;
            for (let n = 0; n < nl; n++)
                nodes[n].$el.css('opacity', '0.5');
            break;
        case 'context':
            _clip = { type: t, data: [node.dataAttr.index], key: 'contexts', idx: node.dataAttr.index };
            node.$el.css('opacity', '0.5');
            break;
    }
    if (_clip) {
        _clip.profile = profile.name.toLowerCase();
        _clip.action = 2;
    }
    UpdatePaste();
}

export function doCopy(node?) {
    let data;
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    resetClip();
    let t = 'profile';
    let profile = profiles.items[node.dataAttr.profile];
    let il;
    if (!node.dataAttr.type)
        t = node.text.toLowerCase();
    else
        t = node.dataAttr.type;
    switch (t) {
        case 'profile':
            profile = profile.clone();
            profile.name = profileCopyName(profile.name);
            profiles.add(profile);
            $('#profile-tree').treeview('addNode', [newProfileNode(profile), false, false]);
            pushUndo({ action: 'add', type: 'profile', item: [profile.clone()] });
            break;
        case 'aliases':
            data = [];
            il = profile.aliases.length;
            for (let i = 0; i < il; i++)
                data.push(profile.aliases[i].clone());
            _clip = { type: 'alias', data: data, key: 'aliases' };
            break;
        case 'alias':
            _clip = { type: t, data: [profile.aliases[node.dataAttr.index].clone()], key: 'aliases', idx: node.dataAttr.index };
            break;
        case 'macros':
            data = [];
            il = profile.macros.length;
            for (let i = 0; i < il; i++)
                data.push(profile.macros[i].clone());
            _clip = { type: 'macro', data: data, key: 'macros' };
            break;
        case 'macro':
            _clip = { type: t, data: [profile.macros[node.dataAttr.index].clone()], key: 'macros', idx: node.dataAttr.index };
            break;
        case 'triggers':
            data = [];
            il = profile.triggers.length;
            for (let i = 0; i < il; i++)
                data.push(profile.triggers[i].clone());
            _clip = { type: 'trigger', data: data, key: 'triggers' };
            break;
        case 'trigger':
            _clip = { type: t, data: [profile.triggers[node.dataAttr.index].clone()], key: 'triggers', idx: node.dataAttr.index };
            break;
        case 'buttons':
            data = [];
            il = profile.buttons.length;
            for (let i = 0; i < il; i++)
                data.push(profile.buttons[i].clone());
            _clip = { type: 'button', data: data, key: 'buttons' };
            break;
        case 'button':
            _clip = { type: t, data: [profile.buttons[node.dataAttr.index].clone()], key: 'buttons', idx: node.dataAttr.index };
            break;
        case 'contexts':
            data = [];
            il = profile.contexts.length;
            for (let i = 0; i < il; i++)
                data.push(profile.contexts[i].clone());
            _clip = { type: 'context', data: data, key: 'contexts' };
            break;
        case 'context':
            _clip = { type: t, data: [profile.contexts[node.dataAttr.index].clone()], key: 'contexts', idx: node.dataAttr.index };
            break;
    }
    if (_clip) {
        _clip.profile = profile.name.toLowerCase();
        _clip.action = 1;
    }
    UpdatePaste();
}

export function doPaste(node?) {
    if (!_clip || _clip.data.length === 0) return;
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    const _paste = { action: 'group', add: [], delete: [] };
    const profile = profiles.items[node.dataAttr.profile];
    const source = profiles.items[_clip.profile];
    let item;
    const il = _clip.data.length;
    for (let i = 0; i < il; i++) {
        if (_clip.action === 1)
            item = _clip.data[i].clone();
        else
            item = source[_clip.key][_clip.data[i]].clone();
        _paste.add.push({ type: _clip.type, item: item.clone(), data: { type: _clip.type, key: _clip.key, item: item, idx: profile[_clip.key].length, profile: profile.name.toLowerCase() } });
        addItem(_clip.type, _clip.key, item, profile[_clip.key].length, profile, true);
    }

    if (_clip.action === 2) {
        for (let i = 0; i < il; i++) {
            item = source[_clip.key][_clip.data[i]].clone();
            _paste.delete.push({ type: _clip.type, item: item.clone(), data: { type: _clip.type, key: _clip.key, item: item, idx: _clip.data[i], profile: source.name.toLowerCase() } });
            DeleteItem(_clip.type, _clip.key, _clip.data[i], source, true);
        }
        _clip = 0;
        UpdatePaste();
    }
    pushUndo(_paste);
}

export function doDelete(node?) {
    let t;
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    resetClip();
    //node.state.selected = false;
    t = 'profile';
    if (!node.dataAttr.type)
        t = node.text.toLowerCase();
    else
        t = node.dataAttr.type;
    switch (t) {
        case 'profile':
            DeleteProfileConfirm(profiles.items[node.dataAttr.profile]);
            break;
        case 'aliases':
            DeleteItems('alias', 'aliases', profiles.items[node.dataAttr.profile]);
            break;
        case 'alias':
            DeleteItemConfirm('alias', 'aliases', node.dataAttr.index, profiles.items[node.dataAttr.profile]);
            break;
        case 'macros':
            DeleteItems('macro', 'macros', profiles.items[node.dataAttr.profile]);
            break;
        case 'macro':
            DeleteItemConfirm('macro', 'macros', node.dataAttr.index, profiles.items[node.dataAttr.profile]);
            break;
        case 'triggers':
            DeleteItems('trigger', 'triggers', profiles.items[node.dataAttr.profile]);
            break;
        case 'trigger':
            DeleteItemConfirm('trigger', 'triggers', node.dataAttr.index, profiles.items[node.dataAttr.profile]);
            break;
        case 'buttons':
            DeleteItems('button', 'buttons', profiles.items[node.dataAttr.profile]);
            break;
        case 'button':
            DeleteItemConfirm('button', 'buttons', node.dataAttr.index, profiles.items[node.dataAttr.profile]);
            break;
        case 'contexts':
            DeleteItems('context', 'contexts', profiles.items[node.dataAttr.profile]);
            break;
        case 'context':
            DeleteItemConfirm('context', 'contexts', node.dataAttr.index, profiles.items[node.dataAttr.profile]);
            break;
    }
}
function updateCurrent(): UpdateState {
    if (currentNode && _loading === 0) {
        //currentNode.state.selected = false;
        let t = 'profile';
        if (!currentNode.dataAttr.type)
            t = $('#profile-tree').treeview('getParents', currentNode)[0].dataAttr.type;
        else
            t = currentNode.dataAttr.type;
        switch (t) {
            case 'aliases':
            case 'macros':
            case 'triggers':
            case 'buttons':
            case 'contexts':
            case 'profile':
                return UpdateProfile();
            case 'alias':
                return UpdateAlias();
            case 'macro':
                return UpdateMacro();
            case 'trigger':
                return UpdateTrigger();
            case 'button':
                return UpdateButton();
            case 'context':
                return UpdateContext();
        }
    }
    return UpdateState.NoChange;
}

function buildTreeview(data, skipInit?) {
    return new Promise<void>((resolve, reject) => {
        currentNode = 0;
        $('#profile-tree').treeview({
            showBorder: false,
            showImage: true,
            showTags: true,
            showCheckbox: true,
            preventUnselect: true,
            levels: 1,
            checkedIcon: 'fa fa-check-square-o',
            uncheckedIcon: 'fa fa-square-o',
            expandIcon: 'fa fa-chevron-right',
            collapseIcon: 'fa fa-chevron-down',
            onNodeRendered: (event, node) => {
                node.$el.prop('title', node.text);
            },
            onNodeUnchecked: nodeCheckChanged,
            onNodeChecked: nodeCheckChanged,
            onNodeSelected: (event, node) => {
                let t;
                if (updateCurrent() === UpdateState.Error && currentNode) {
                    $('#profile-tree').treeview('selectNode', [currentNode, { silent: true }]);
                    return;
                }
                if (!node) return;
                _loading++;
                t = 'profile';
                if (!node.dataAttr.type)
                    t = $('#profile-tree').treeview('getParents', node)[0].dataAttr.type;
                else
                    t = node.dataAttr.type;
                currentNode = node;
                currentProfile = profiles.items[node.dataAttr.profile];
                $('#btn-cut').prop('disabled', false);
                $('#btn-copy').prop('disabled', false);
                $('#btn-delete').prop('disabled', false);
                menubar.updateItem('edit|cut', { enabled: true });
                menubar.updateItem('edit|copy', { enabled: true });
                menubar.updateItem('edit|delete', { enabled: true });
                UpdatePaste();
                switch (t) {
                    case 'aliases':
                    case 'macros':
                    case 'triggers':
                    case 'buttons':
                    case 'contexts':
                    case 'profile':
                        UpdateEditor('profile', currentProfile, {
                            post: () => {
                                if (currentProfile.name === 'Default') {
                                    $('#profile-name').prop('disabled', true);
                                    if (t === 'profile') {
                                        $('#btn-cut').prop('disabled', true);
                                        $('#btn-delete').prop('disabled', true);
                                        menubar.updateItem('edit|cut', { enabled: false });
                                        menubar.updateItem('edit|delete', { enabled: false });
                                    }
                                }
                                else
                                    $('#profile-name').prop('disabled', false);

                                if (t !== 'profile' && currentProfile[t].length === 0) {
                                    $('#btn-copy').prop('disabled', true);
                                    $('#btn-cut').prop('disabled', true);
                                    $('#btn-delete').prop('disabled', true);
                                    menubar.updateItem('edit|cut', { enabled: false });
                                    menubar.updateItem('edit|copy', { enabled: false });
                                    menubar.updateItem('edit|delete', { enabled: false });
                                }
                                else if (t === 'profile') {
                                    $('#btn-cut').prop('disabled', true);
                                    menubar.updateItem('edit|cut', { enabled: false });
                                }
                            }
                        });
                        break;
                    case 'alias':
                        UpdateEditor('alias', currentProfile.aliases[node.dataAttr.index]);
                        if (!validateIdentifiers(<HTMLInputElement>document.getElementById('alias-params'))) {
                            if (!$('#alias-editor .btn-adv').data('open'))
                                $('#alias-editor .btn-adv').trigger('click');
                        }
                        focusEditor('alias-value');
                        break;
                    case 'macro':
                        UpdateEditor('macro', currentProfile.macros[node.dataAttr.index], { key: MacroValue });
                        focusEditor('macro-value');
                        break;
                    case 'trigger':
                        UpdateEditor('trigger', currentProfile.triggers[node.dataAttr.index], { pre: initTriggerEditor, post: clearTriggerTester });
                        focusEditor('trigger-value');
                        break;
                    case 'button':
                        UpdateEditor('button', currentProfile.buttons[node.dataAttr.index], { post: UpdateButtonSample });
                        focusEditor('button-value');
                        break;
                    case 'context':
                        UpdateEditor('context', currentProfile.contexts[node.dataAttr.index], { post: UpdateContextSample });
                        focusEditor('context-value');
                        break;
                }
                document.getElementById('btn-new').title = 'New ' + ((t === 'alias' || t === 'aliases') ? 'alias' : (t.endsWith('s') ? t.substr(0, t.length - 1) : t));
                _loading--;
            },
            lazyLoad: (node, add) => {
                const parent = $('#profile-tree').treeview('getParents', node)[0];
                const nodes = [];
                let n;
                let t;
                let i;
                let il = profiles.items[parent.dataAttr.profile][node.text.toLowerCase()].length;
                if (node.text === 'Aliases')
                    t = 'alias';
                else
                    t = node.text.substr(0, node.text.length - 1).toLowerCase();
                const names = {};
                const items = profiles.items[parent.dataAttr.profile][node.dataAttr.type];
                for (i = 0; i < il; i++) {
                    if (!items[i].name || items[i].name.length === 0) continue;
                    names[items[i].name] = i + 1;
                }
                for (i = 0; i < il; i++) {
                    if (items[i].parent && names[items[i].parent]) continue;
                    nodes.push(newItemNode(items[i], i, t, parent.dataAttr.profile));
                }
                add(nodes.sort(sortNodes));
                if (_clip && _clip.action === 2 && _clip.key === node.text.toLowerCase()) {
                    for (i = 0, il = _clip.data.length; i < il; i++) {
                        n = $('#profile-tree').treeview('findNodes', ['^' + node.id + i, 'id']);
                        n[0].$el.css('opacity', '0.5');
                    }
                }
            },
            data: data,
            onInitialized: (event, nodes) => {
                if (!skipInit && !currentNode) {
                    if (!profiles.contains(_profileLoadSelect))
                        _profileLoadSelect = 'default';
                    const n = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(_profileLoadSelect) + '$', 'id']);
                    if (_profileLoadExpand)
                        $('#profile-tree').treeview('expandNode', [n]);
                    $('#profile-tree').treeview('selectNode', [n]);
                }
                else if (!currentNode)
                    currentNode = $('#profile-tree').treeview('getSelected')[0];
                resolve();
            }
        });
    });
}

function getProfileData() {
    const data = [];
    let profile;

    for (profile in profiles.items) {
        if (!profiles.items.hasOwnProperty(profile)) continue;
        data.push(newProfileNode(profile));
    }
    //data.sort((a, b) => { return a.text.localeCompare(b.text); });
    data.sort(sortProfileNodes);
    return data;
}

function getOptions() {
    if (window.opener)
        return window.opener.client.options;
    return Settings.load(window.getGlobal('settingsFile'));
}

function saveOptions() {
    if (window.opener)
        window.opener.client.saveOptions();
    else
        options.save(ipcRenderer.sendSync('get-global', 'settingsFile'));
}

function loadOptions() {
    options = getOptions();
    _never = options.profiles.askoncancel;
    _enabled = options.profiles.enabled;
    _ide = options.profiles.codeEditor;
    _gamepads = options.gamepads;
    _watch = options.profiles.watchFiles;
    _sort = options.profiles.sortOrder;
    _sortDir = options.profiles.sortDirection || 1;
    _spellchecker = window.getSetting('spellchecking') || true;
    _prependTrigger = options.prependTriggeredLine;
    _parameter = options.parametersChar;
    _nParameter = options.nParametersChar;
    _command = options.commandChar;
    _stacking = options.commandStackingChar;
    _speed = options.speedpathsChar;
    _verbatim = options.verbatimChar;
    _iComments = options.enableInlineComments;
    _bComments = options.enableBlockComments;
    _iCommentsStr = options.inlineCommentString.split('');
    _bCommentsStr = options.blockCommentString.split('');
    _profileLoadExpand = options.profiles.profileExpandSelected;
    _profileLoadSelect = options.profiles.profileSelected;
    if (!profiles.contains(_profileLoadSelect))
        _profileLoadSelect = 'default';
    updatePads();

    let theme = parseTemplate(options.theme) + '.css';
    if (!isFileSync(theme))
        theme = parseTemplate(path.join('{themes}', 'default')) + '.css';
    if ($('#theme').attr('href') !== theme)
        $('#theme').attr('href', theme);

    if (options.profiles.split > 200) {
        $('#sidebar').css('width', options.profiles.split);
        $('#content').css('left', options.profiles.split);
    }
    setAdvancedPanel('trigger', options.profiles.triggersAdvanced);
    setAdvancedPanel('alias', options.profiles.aliasesAdvanced);
    setAdvancedPanel('button', options.profiles.buttonsAdvanced);
    setAdvancedPanel('macro', options.profiles.macrosAdvanced);
    setAdvancedPanel('context', options.profiles.contextsAdvanced);
}

function optionsLoaded() {
    const so = _sort;
    const sd = _sortDir;
    loadOptions();
    resetParseSyntax();
    if (so !== _sort || sd !== _sortDir)
        sortTree(true);
}

function setAdvancedPanel(id, state) {
    const cState = $('#' + id + '-editor .btn-adv').data('open') || false;
    if (cState !== state)
        $('#' + id + '-editor .btn-adv').click();
}

export function init() {
    loadOptions();
    const p = path.join(parseTemplate('{data}'), 'profiles');
    if (!isDirSync(p)) {
        profiles.add(Profile.Default);
    }
    else {
        profiles.loadPath(p);
        if (!profiles.contains('default'))
            profiles.add(Profile.Default);
        startWatcher(p);
    }

    $('#drag-bar').mousedown((e) => {
        e.preventDefault();

        dragging = true;
        const main = $('#content');
        const ghostBar = $('<div>',
            {
                id: 'ghost-bar',
                css: {
                    height: main.outerHeight(),
                    top: main.offset().top,
                    left: main.offset().left - 3
                }
            }).appendTo('body');

        $(document).mousemove((event) => {
            if (event.pageX < 199)
                ghostBar.css('left', 199);
            else if (event.pageX > document.body.clientWidth - 300)
                ghostBar.css('left', document.body.clientWidth - 300);
            else
                ghostBar.css('left', event.pageX);
        });
    });

    $(window).on('resize', () => {
        if ($('#content').outerWidth() < 300 && $('#sidebar').outerWidth() > 202) {
            $('#sidebar').css('width', document.body.clientWidth - 300);
            $('#content').css('left', document.body.clientWidth - 300);
            ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: document.body.clientWidth - 300 });
        }
        $('#trigger-states-dropdown').css('width', $('#trigger-pattern').outerWidth() + 17 + 'px');
        $('#trigger-states-dropdown').css('left', (-$('#trigger-pattern').outerWidth()) + 'px');
    });

    $(document).mouseup((e) => {
        if (dragging) {
            if (e.pageX < 200) {
                $('#sidebar').css('width', 202);
                $('#content').css('left', 202);
                ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: 202 });
            }
            else if (e.pageX > document.body.clientWidth - 200) {
                $('#sidebar').css('width', document.body.clientWidth - 300);
                $('#content').css('left', document.body.clientWidth - 300);
                ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: document.body.clientWidth - 300 });
            }
            else {
                $('#sidebar').css('width', e.pageX + 2);
                $('#content').css('left', e.pageX + 2);
                ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: e.pageX + 2 });
            }

            $('#ghost-bar').remove();
            $(document).unbind('mousemove');
            dragging = false;
        }
    });

    $('#btn-add-dropdown').click(function () {
        $(this).addClass('open');
        const pos = $(this).offset();
        const x = Math.floor(pos.left);
        const y = Math.floor(pos.top + $(this).outerHeight() + 2);
        const addMenu = new Menu();
        addMenu.append(new MenuItem({
            label: 'New empty profile', click() {
                clearButton('#btn-add-dropdown');
                AddNewProfile();
            }
        }));
        addMenu.append(new MenuItem({
            label: 'New profile with defaults', click() {
                clearButton('#btn-add-dropdown');
                AddNewProfile(true);
            }
        }));
        addMenu.append(new MenuItem({ type: 'separator' }));
        addMenu.append(new MenuItem({
            label: 'New alias', click() {
                clearButton('#btn-add-dropdown');
                addItem('Alias', 'aliases', new Alias());
            }
        }));
        addMenu.append(new MenuItem({
            label: 'New macro', click() {
                clearButton('#btn-add-dropdown');
                addItem('Macro', 'macros', new Macro());
            }
        }));
        addMenu.append(new MenuItem({
            label: 'New trigger', click() {
                clearButton('#btn-add-dropdown');
                addItem('Trigger', 'triggers', new Trigger());
            }
        }));
        addMenu.append(new MenuItem({
            label: 'New button', click() {
                clearButton('#btn-add-dropdown');
                addItem('Button', 'buttons', new Button());
            }
        }));
        addMenu.append(new MenuItem({
            label: 'New context', click() {
                clearButton('#btn-add-dropdown');
                addItem('Context', 'contexts', new Context());
            }
        }));
        addMenu.popup({ window: remote.getCurrentWindow(), x: x, y: y });
    });

    $('#macro-key').on('keydown', e => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });

    $('#macro-key').on('keypress', e => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
    $('#macro-key').on('keyup', e => {
        e.preventDefault();
        e.stopPropagation();
        const c = [];
        let mod = MacroModifiers.None;

        if (e.ctrlKey) {
            c.push('Ctrl');
            mod |= MacroModifiers.Ctrl;
        }
        if (e.altKey) {
            c.push('Alt');
            mod |= MacroModifiers.Alt;
        }
        if (e.shiftKey) {
            c.push('Shift');
            mod |= MacroModifiers.Shift;
        }
        if (e.metaKey) {
            mod |= MacroModifiers.Meta;
            if (process.platform === 'darwin')
                c.push('Cmd');
            else
                c.push('Win');
        }
        if (keyCodeToChar[e.which])
            c.push(keyCodeToChar[e.which]);
        else
            return false;
        $('#macro-key').val(c.join('+'));
        $('#macro-key').data('key', e.which);
        $('#macro-key').data('mod', mod);
        $('#macro-key').data('gamepad', -1);
        $('#macro-key').data('axes', 0);
        UpdateMacro();
        return false;
    });

    $('#macro-key').on('focus', () => {
        _macro = true;
        updatePads();
    });
    $('#macro-key').on('blur', () => {
        _macro = false;
    });

    $('#trigger-type').on('change', function () {
        switch ($(this).val()) {
            case '1024': //wait
            case '16384': //Duration
                $('td[data-row="triggers-params"]').css('display', '');
                $('#triggers-params-suffix').parent().addClass('input-group');
                $('#triggers-params-suffix').css('display', '');
                break;
            case '128':
            case '512': //skip            
            case '4096': //LoopPattern
            case '8192': //LoopLines
            case '32768': //WithinLines            
                $('td[data-row="triggers-params"]').css('display', '');
                $('#triggers-params-suffix').css('display', 'none');
                $('#triggers-params-suffix').parent().removeClass('input-group');
                break;
            default:
                $('td[data-row="triggers-params"]').css('display', 'none');
                break;
        }
    });

    $('.btn-adv').on('click', function () {
        const editor = $(this).closest('.panel-body').attr('id');
        let state = $(this).data('open') || false;
        state = !state;
        $(this).data('open', state);
        const panel = $(this).closest('.panel-body');
        const icon = $(this).find('i');
        const panels = panel.find('.panel-adv-body');

        if (state) {
            panels.css('display', 'table-row');
            icon.addClass('fa-chevron-down');
            icon.removeClass('fa-chevron-up');
            $(this).parent().css('padding-bottom', '15px');
            $(this).closest('table').css('min-height', '342px');
            ipcRenderer.send('setting-changed', { type: 'profiles', name: getKey(editor.substr(0, editor.length - 7)) + 'Advanced', value: true });
        }
        else {
            panels.css('display', '');
            icon.addClass('fa-chevron-up');
            icon.removeClass('fa-chevron-down');
            $(this).parent().css('padding-bottom', '');
            $(this).closest('table').css('min-height', '');
            ipcRenderer.send('setting-changed', { type: 'profiles', name: getKey(editor.substr(0, editor.length - 7)) + 'Advanced', value: false });
        }
        if (_ide && editors[editor.substr(0, editor.length - 7) + '-value'])
            editors[editor.substr(0, editor.length - 7) + '-value'].resize(true);
    });

    ['cut', 'copy', 'paste'].forEach((event) => {
        document.addEventListener(event, (e) => {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'))
                return;
            if (event === 'cut')
                doCut();
            else if (event === 'copy')
                doCopy();
            else if (event === 'paste')
                doPaste();
        });
    });

    loadActions(parseTemplate(path.join('{assets}', 'actions')), '');

    window.onbeforeunload = (evt) => {
        if (_close || !_never || (_undo.length === 0 && updateCurrent() === UpdateState.NoChange))
            return;
        if (window.opener)
            window.opener.client.off('options-loaded', optionsLoaded);
        evt.returnValue = false;
        setTimeout(() => {
            const choice = dialog.showMessageBoxSync({
                type: 'warning',
                title: 'Profiles changed',
                message: 'All unsaved changes will be lost, close?',
                buttons: ['Yes', 'No', 'Never ask again'],
                defaultId: 1
            });
            if (choice === 2)
                ipcRenderer.send('setting-changed', { type: 'profiles', name: 'askoncancel', value: false });
            if (choice === 0 || choice === 2) {
                _close = true;
                window.close();
                return;
            }
        });
        return 'no';
    };

    document.onkeydown = undoKeydown;
    $('input,textarea').on('keydown', undoKeydown);

    $('select').on('focus', function () {
        // Store the current value on focus and on change
        $(this).data('previous-value', (<HTMLInputElement>this).value);
    }).on('change', function () {
        updateCurrent();
        $(this).data('previous-value', (<HTMLInputElement>this).value);
    });

    $('input[type=\'text\'],input[type=\'number\'],textarea').on('keydown', function () {
        $(this).data('previous-value', (<HTMLInputElement>this).value);
    }).on('keyup', function () {
        updateCurrent();
        $(this).data('previous-value', (<HTMLInputElement>this).value);
    });

    $('input[type=\'number\']').on('focus', function () {
        // Store the current value on focus and on change
        $(this).data('previous-value', (<HTMLInputElement>this).value);
    }).on('change', function () {
        updateCurrent();
        $(this).data('previous-value', (<HTMLInputElement>this).value);
    });

    $('input[type=checkbox]').on('focus', function () {
        // Store the current value on focus and on change
        $(this).data('previous-value', (<HTMLInputElement>this).checked);
    }).change(function () {
        updateCurrent();
        $(this).data('previous-value', (<HTMLInputElement>this).checked);
    });
    addInputContext();

    $('#export').on('show.bs.dropdown', () => {
        if ($(window).width() < 675 && $('#export').parent().position().left > 400)
            $('#export .dropdown-menu').addClass('dropdown-menu-right');
        else
            $('#export .dropdown-menu').removeClass('dropdown-menu-right');
    });

    $('#export').on('click', function () {
        $(this).addClass('open');
        const pos = $(this).offset();
        const x = Math.floor(pos.left);
        const y = Math.floor(pos.top + $(this).outerHeight() + 2);
        const exportmenu = new Menu();
        exportmenu.append(new MenuItem({ label: 'Export current...', click: exportCurrent }));
        exportmenu.append(new MenuItem({ label: 'Export all...', click: exportAll }));
        exportmenu.append(new MenuItem({ label: 'Export all as zip...', click: exportAllZip }));
        exportmenu.append(new MenuItem({ type: 'separator' }));
        exportmenu.append(new MenuItem({ label: 'Import...', click: importProfiles }));
        exportmenu.popup({ window: remote.getCurrentWindow(), x: x, y: y });
    });

    initEditor('trigger-value');
    initEditor('macro-value');
    initEditor('alias-value');
    initEditor('button-value');
    initEditor('context-value');
    buildTreeview(getProfileData());
    $('#profile-tree').on('contextmenu', (event: JQueryEventObject) => {
        event.preventDefault();
        event.stopPropagation();
        event.cancelBubble = true;
        const nodeId = $(event.target).closest('li.list-group-item').attr('data-nodeId');
        const nodes = $('#profile-tree').treeview('findNodes', ['^' + nodeId + '$', 'nodeId']);
        const c = new Menu();
        if (!nodes || nodes.length === 0) {
            c.append(new MenuItem({
                label: 'New empty profile', click() {
                    AddNewProfile();
                }
            }));
            c.append(new MenuItem({
                label: 'New profile with defaults', click() {
                    AddNewProfile(true);
                }
            }));
        }
        else {
            let t = 'profile';
            if (!nodes[0].dataAttr.type)
                t = $('#profile-tree').treeview('getParents', nodes[0])[0].dataAttr.type;
            else
                t = nodes[0].dataAttr.type;
            const profile = profiles.items[nodes[0].dataAttr.profile];

            switch (t) {
                case 'profile':
                    c.append(new MenuItem({
                        label: 'New empty profile', click() {
                            AddNewProfile();
                        }
                    }));
                    c.append(new MenuItem({
                        label: 'New profile with defaults', click() {
                            AddNewProfile(true);
                        }
                    }));
                    c.append(new MenuItem({ type: 'separator' }));
                    c.append(new MenuItem({
                        label: 'Undo', click() {
                            doUndo();
                        },
                        enabled: _undo.length > 0
                    }));
                    c.append(new MenuItem({
                        label: 'Redo', click() {
                            doRedo();
                        },
                        enabled: _redo.length > 0
                    }));

                    c.append(new MenuItem({ type: 'separator' }));
                    c.append(new MenuItem({
                        label: 'Copy', click() {
                            doCopy(nodes[0]);
                        }
                    }));

                    if (canPaste())
                        c.append(new MenuItem({
                            label: 'Paste', click() {
                                doPaste(nodes[0]);
                            }
                        }));
                    if (profile.name !== 'Default') {
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Delete', click() {
                                doDelete(nodes[0]);
                            }
                        }));
                    }
                    c.append(new MenuItem({ type: 'separator' }));
                    c.append(new MenuItem({
                        label: 'Import defaults', click() {
                            doImport(nodes[0]);
                        }
                    }));
                    c.append(new MenuItem({
                        label: 'Reset', click() {
                            doReset(nodes[0]);
                        }
                    }));

                    break;
                case 'aliases':
                case 'alias':
                    c.append(new MenuItem({
                        label: 'New alias', click() {
                            addItem('Alias', 'aliases', new Alias());
                        }
                    }));
                    c.append(new MenuItem({ type: 'separator' }));
                    c.append(new MenuItem({
                        label: 'Undo', click() {
                            doUndo();
                        },
                        enabled: _undo.length > 0
                    }));
                    c.append(new MenuItem({
                        label: 'Redo', click() {
                            doRedo();
                        },
                        enabled: _redo.length > 0
                    }));

                    if (profile.aliases.length > 0) {
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Cut', click() {
                                doCut(nodes[0]);
                            }
                        }));
                        c.append(new MenuItem({
                            label: 'Copy', click() {
                                doCopy(nodes[0]);
                            }
                        }));
                        if (canPaste())
                            c.append(new MenuItem({
                                label: 'Paste', click() {
                                    doPaste(nodes[0]);
                                }
                            }));
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Delete', click() {
                                doDelete(nodes[0]);
                            }
                        }));
                    }
                    break;
                case 'macros':
                case 'macro':
                    c.append(new MenuItem({
                        label: 'New macro', click() {
                            addItem('Macro', 'macros', new Macro());
                        }
                    }));
                    c.append(new MenuItem({ type: 'separator' }));
                    c.append(new MenuItem({
                        label: 'Undo', click() {
                            doUndo();
                        },
                        enabled: _undo.length > 0
                    }));
                    c.append(new MenuItem({
                        label: 'Redo', click() {
                            doRedo();
                        },
                        enabled: _redo.length > 0
                    }));

                    if (profile.macros.length > 0) {
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Cut', click() {
                                doCut(nodes[0]);
                            }
                        }));
                        c.append(new MenuItem({
                            label: 'Copy', click() {
                                doCopy(nodes[0]);
                            }
                        }));
                        if (canPaste())
                            c.append(new MenuItem({
                                label: 'Paste', click() {
                                    doPaste(nodes[0]);
                                }
                            }));
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Delete', click() {
                                doDelete(nodes[0]);
                            }
                        }));
                    }
                    break;
                case 'triggers':
                case 'trigger':
                    c.append(new MenuItem({
                        label: 'New trigger', click() {
                            addItem('Trigger', 'triggers', new Trigger());
                        }
                    }));
                    c.append(new MenuItem({ type: 'separator' }));
                    c.append(new MenuItem({
                        label: 'Undo', click() {
                            doUndo();
                        },
                        enabled: _undo.length > 0
                    }));
                    c.append(new MenuItem({
                        label: 'Redo', click() {
                            doRedo();
                        },
                        enabled: _redo.length > 0
                    }));

                    if (profile.triggers.length > 0) {
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Cut', click() {
                                doCut(nodes[0]);
                            }
                        }));
                        c.append(new MenuItem({
                            label: 'Copy', click() {
                                doCopy(nodes[0]);
                            }
                        }));
                        if (canPaste())
                            c.append(new MenuItem({
                                label: 'Paste', click() {
                                    doPaste(nodes[0]);
                                }
                            }));
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Delete', click() {
                                doDelete(nodes[0]);
                            }
                        }));
                    }
                    break;
                case 'buttons':
                case 'button':
                    c.append(new MenuItem({
                        label: 'New button', click() {
                            addItem('Button', 'buttons', new Button());
                        }
                    }));
                    c.append(new MenuItem({ type: 'separator' }));
                    c.append(new MenuItem({
                        label: 'Undo', click() {
                            doUndo();
                        },
                        enabled: _undo.length > 0
                    }));
                    c.append(new MenuItem({
                        label: 'Redo', click() {
                            doRedo();
                        },
                        enabled: _redo.length > 0
                    }));

                    if (profile.buttons.length > 0) {
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Cut', click() {
                                doCut(nodes[0]);
                            }
                        }));
                        c.append(new MenuItem({
                            label: 'Copy', click() {
                                doCopy(nodes[0]);
                            }
                        }));
                        if (canPaste())
                            c.append(new MenuItem({
                                label: 'Paste', click() {
                                    doPaste(nodes[0]);
                                }
                            }));
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Delete', click() {
                                doDelete(nodes[0]);
                            }
                        }));
                    }
                    break;
                case 'contexts':
                case 'context':
                    c.append(new MenuItem({
                        label: 'New context', click() {
                            addItem('Context', 'contexts', new Context());
                        }
                    }));
                    c.append(new MenuItem({ type: 'separator' }));
                    c.append(new MenuItem({
                        label: 'Undo', click() {
                            doUndo();
                        },
                        enabled: _undo.length > 0
                    }));
                    c.append(new MenuItem({
                        label: 'Redo', click() {
                            doRedo();
                        },
                        enabled: _redo.length > 0
                    }));

                    if (profile.contexts.length > 0) {
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Cut', click() {
                                doCut(nodes[0]);
                            }
                        }));
                        c.append(new MenuItem({
                            label: 'Copy', click() {
                                doCopy(nodes[0]);
                            }
                        }));
                        if (canPaste())
                            c.append(new MenuItem({
                                label: 'Paste', click() {
                                    doPaste(nodes[0]);
                                }
                            }));
                        c.append(new MenuItem({ type: 'separator' }));
                        c.append(new MenuItem({
                            label: 'Delete', click() {
                                doDelete(nodes[0]);
                            }
                        }));
                    }
                    break;
            }
        }
        c.popup({ window: remote.getCurrentWindow() });
    });
    $('#profile-tree').on('dblclick', (event: JQueryEventObject) => {
        if (!event.target || event.target.nodeName !== 'LI' || !event.target.classList.contains('list-group-item')) return;
        let n = $('#profile-tree').treeview('findNodes', ['^' + event.target.id + '$', 'id']);
        $('#profile-tree').treeview('toggleNodeExpanded', [n, { levels: 1, silent: false }]);
    });
    window.opener.client.on('options-loaded', optionsLoaded);
}

function startWatcher(p: string) {
    if (watcher) {
        watcher.close();
        watcher = null;
    }
    if (_watch)
        watcher = fs.watch(p, (type, file) => {
            filesChanged = true;
            $('#btn-refresh').addClass('btn-warning');
        });
}

function undoKeydown(e) {
    if (e.which === 90 && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        doUndo();
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
    else if (e.which === 89 && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        doRedo();
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
}

function sortFiles(a, b, p) {
    if (fs.lstatSync(path.join(p, a)).isDirectory())
        return -1;
    if (fs.lstatSync(path.join(p, b)).isDirectory())
        return 1;
    return a.localeCompare(b);
}

export function sortTree(s?: boolean) {
    const data = [];
    let profile;
    let n;
    let c;
    let cl;

    for (profile in profiles.items) {
        if (!profiles.items.hasOwnProperty(profile)) continue;
        n = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile) + '$', 'id']);
        n = cleanNode(n[0]);
        if (s) {
            cl = n.nodes.length;
            for (c = 0; c < cl; c++) {
                if (!n.nodes[c].nodes || n.nodes[c].nodes.length === 0)
                    continue;
                n.nodes[c].nodes = n.nodes[c].nodes.sort(sortProfileNodes);
            }
        }
        data.push(n);
    }
    data.sort(sortProfileNodes);
    /*
    n = $('#profile-tree').treeview('findNodes', ['^Profiledefault$', 'id']);
    if (n.length > 0) {
        n = cleanNode(n[0]);
        if (s) {
            cl = n.nodes.length;
            for (c = 0; c < cl; c++) {
                if (!n.nodes[c].nodes || n.nodes[c].nodes.length === 0)
                    continue;
                n.nodes[c].nodes = n.nodes[c].nodes.sort(sortNodes);
            }
        }
        data.unshift(n);
    }
    */
    return buildTreeview(data, true);
}

function loadActions(p, root) {
    const files = fs.readdirSync(p);
    files.sort((a, b) => { return sortFiles(a, b, p); });
    const fl = files.length;
    for (let f = 0; f < fl; f++) {
        if (fs.lstatSync(path.join(p, files[f])).isDirectory())
            loadActions(path.join(p, files[f]), path.join(root, files[f]));
        else {
            $('#button-actions-dropdown').append('<li title="' + path.basename(files[f], path.extname(files[f])) + '"><a href="#" onclick="profileUI.setIcon(\'' + path.join(root, files[f]).replace(/\\/g, '\\\\') + '\')"><img class="action-icon" src="' + path.join(p, files[f]) + '"><div class="overlay"></div></a></li>');
            $('#context-actions-dropdown').append('<li title="' + path.basename(files[f], path.extname(files[f])) + '"><a href="#" onclick="profileUI.setIcon(\'' + path.join(root, files[f]).replace(/\\/g, '\\\\') + '\', \'context\', profileUI.UpdateContextSample)"><img class="action-icon" src="' + path.join(p, files[f]) + '"><div class="overlay"></div></a></li>');
        }
    }
}

export function setIcon(icon, field?, callback?) {
    if (!field) field = 'button';
    $('#' + field + '-icon').trigger('keydown').val(path.join('{assets}', 'actions', icon)).trigger('keyup');
    UpdateButtonSample();
    if (callback) callback();
}

export function doRefresh() {
    if (_undo.length > 0)
        dialog.showMessageBox({
            type: 'warning',
            title: 'Refresh profiles',
            message: 'All unsaved or applied changes will be lost, refresh?',
            buttons: ['Yes', 'No'],
            defaultId: 1
        }).then(result => {
            if (result.response === 0) {
                filesChanged = false;
                resetUndo();
                profiles = new ProfileCollection();
                $('#btn-refresh').removeClass('btn-warning');
                const p = path.join(parseTemplate('{data}'), 'profiles');
                if (!isDirSync(p)) {
                    profiles.add(Profile.Default);
                }
                else {
                    profiles.loadPath(p);
                    if (!profiles.contains('default'))
                        profiles.add(Profile.Default);
                    startWatcher(p);
                }
                _enabled = options.profiles.enabled;
                buildTreeview(getProfileData());
            }
        });
    else {
        filesChanged = false;
        resetUndo();
        profiles = new ProfileCollection();
        $('#btn-refresh').removeClass('btn-warning');
        const p = path.join(parseTemplate('{data}'), 'profiles');
        if (!isDirSync(p)) {
            profiles.add(Profile.Default);
        }
        else {
            profiles.loadPath(p);
            if (!profiles.contains('default'))
                profiles.add(Profile.Default);
            startWatcher(p);
        }
        _enabled = options.profiles.enabled;
        buildTreeview(getProfileData());
    }
}

function profileCopyName(name) {
    let i = 0;
    let n = name;
    while (profiles.contains(n)) {
        if (i === 0)
            n = name + ' Copy';
        else
            n = name + ' Copy (' + i + ')';
        i++;
    }
    return n;
}

function importProfiles() {
    dialog.showOpenDialog({
        title: 'Import profiles',
        filters: [
            { name: 'Supported files (*.txt, *.zip)', extensions: ['txt', 'zip'] },
            { name: 'Text files (*.txt)', extensions: ['txt'] },
            { name: 'Zip files (*.zip)', extensions: ['zip'] },
            { name: 'All files (*.*)', extensions: ['*'] }
        ],
        properties: ['multiSelections']
    }).then(result => {
        if (result.filePaths === undefined || result.filePaths.length === 0) {
            return;
        }
        const names = [];
        const _replace = [];
        const fl = result.filePaths.length;
        let all = 0;
        let n;
        for (let f = 0; f < fl; f++) {
            if (path.extname(result.filePaths[f]) === '.zip') {
                unarchiver = unarchiver || require('yauzl');
                unarchiver.open(result.filePaths[f], { lazyEntries: true }, (err, zipFile) => {
                    if (err) throw err;
                    zipFile.readEntry();
                    zipFile.on('error', (err2) => {
                        throw err2;
                    });
                    zipFile.on('entry', entry => {
                        if (!/^profiles\/.*\.json$/.test(entry.fileName)) {
                            zipFile.readEntry();
                            return;
                        }
                        zipFile.openReadStream(entry, (err2, readStream) => {
                            if (err2)
                                throw err2;
                            let data: any = [];
                            readStream.on('data', (chunk) => {
                                data.push(chunk);
                            });
                            readStream.on('end', () => {
                                zipFile.readEntry();
                                data = Buffer.concat(data).toString('utf8');
                                data = JSON.parse(data);
                                const p = Profile.load(data);
                                if (profiles.contains(p)) {
                                    if (all === 3) {
                                        _replace.push(profiles.items[p.name.toLowerCase()].clone());
                                        profiles.add(p);
                                        _enabled = _enabled.filter((a) => { return a !== p.name.toLowerCase(); });
                                        if (p.enabled)
                                            _enabled.push(p.name.toLowerCase());
                                        names.push(p.clone());
                                        const nodes = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(p.name) + '$', 'id']);
                                        $('#profile-tree').treeview('removeNode', [nodes, { silent: true }]);
                                        $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                                    }
                                    else if (all === 5) {
                                        n = profileCopyName(p.name);
                                        p.name = n;
                                        p.file = n.toLowerCase();
                                        if (p.enabled)
                                            _enabled.push(p.name.toLowerCase());
                                        profiles.add(p);
                                        names.push(p.clone());
                                        $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                                    }
                                    else if (all !== 4) {
                                        const response = dialog.showMessageBoxSync({
                                            type: 'question',
                                            title: 'Profiles already exists',
                                            message: 'Profile named \'' + p.name + '\' exist, replace?',
                                            buttons: ['Yes', 'No', 'Copy', 'Replace All', 'No All', 'Copy All'],
                                            defaultId: 1
                                        });
                                        if (response === 0) {
                                            _replace.push(profiles.items[p.name.toLowerCase()].clone());
                                            profiles.add(p);
                                            _enabled = _enabled.filter((a) => { return a !== p.name.toLowerCase(); });
                                            if (p.enabled)
                                                _enabled.push(p.name.toLowerCase());

                                            names.push(p.clone());
                                            const nodes = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(p.name) + '$', 'id']);
                                            $('#profile-tree').treeview('removeNode', [nodes, { silent: true }]);
                                            $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                                        }
                                        else if (response === 2) {
                                            n = profileCopyName(p.name);
                                            p.name = n;
                                            p.file = n.toLowerCase();
                                            profiles.add(p);
                                            if (p.enabled)
                                                _enabled.push(p.name.toLowerCase());
                                            names.push(p.clone());
                                            $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                                        }
                                        else if (response > 2)
                                            all = response;
                                    }
                                }
                                else {
                                    names.push(p.clone());
                                    profiles.add(p);
                                    $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                                }
                            });
                        });
                    })
                        .once('error', (err2) => {
                            throw err2;
                        })
                        .once('close', () => {

                        });
                });
            }
            else
                fs.readFile(result.filePaths[f], (err, data) => {
                    if (err) throw err;

                    data = JSON.parse(data);
                    if (!data || data.version !== 2) {
                        dialog.showMessageBox({
                            type: 'error',
                            title: 'Invalid Profile',
                            message: 'Invalid profile unable to process.'
                        });
                        return;
                    }
                    ipcRenderer.send('set-progress', { value: 0.5, options: { mode: 'indeterminate' } });
                    if (data.profiles) {
                        const keys = Object.keys(data.profiles);
                        let k = 0;
                        const kl = keys.length;
                        let item: (Alias | Button | Macro | Trigger | Context);
                        for (; k < kl; k++) {
                            const p = new Profile(keys[k], false);
                            p.priority = data.profiles[keys[k]].priority;
                            //p.enabled = data.profiles[keys[k]].enabled;
                            p.enableMacros = data.profiles[keys[k]].enableMacros;
                            p.enableTriggers = data.profiles[keys[k]].enableTriggers;
                            p.enableAliases = data.profiles[keys[k]].enableAliases;
                            p.enableContexts = data.profiles[keys[k]].enableContexts;
                            let l = data.profiles[keys[k]].macros.length;
                            if (l > 0) {
                                for (let m = 0; m < l; m++) {
                                    item = new Macro(data.profiles[keys[k]].macros[m]);
                                    item.notes = data.profiles[keys[k]].macros[m].notes || '';
                                    p.macros.push(item);
                                }
                            }

                            l = data.profiles[keys[k]].aliases.length;
                            if (l > 0) {
                                for (let m = 0; m < l; m++) {
                                    item = new Alias(data.profiles[keys[k]].aliases[m]);
                                    item.notes = data.profiles[keys[k]].aliases[m].notes || '';
                                    p.aliases.push(item);
                                }
                            }

                            l = data.profiles[keys[k]].triggers.length;
                            if (l > 0) {
                                for (let m = 0; m < l; m++) {
                                    item = new Trigger();
                                    item.pattern = data.profiles[keys[k]].triggers[m].pattern;
                                    item.value = data.profiles[keys[k]].triggers[m].value;
                                    item.style = data.profiles[keys[k]].triggers[m].style;
                                    item.verbatim = data.profiles[keys[k]].triggers[m].verbatim;
                                    item.name = data.profiles[keys[k]].triggers[m].name;
                                    item.group = data.profiles[keys[k]].triggers[m].group;
                                    item.enabled = data.profiles[keys[k]].triggers[m].enabled;
                                    item.priority = data.profiles[keys[k]].triggers[m].priority;
                                    item.triggerNewline = data.profiles[keys[k]].triggers[m].triggernewline;
                                    item.triggerPrompt = data.profiles[keys[k]].triggers[m].triggerprompt;
                                    item.raw = data.profiles[keys[k]].triggers[m].raw;
                                    item.caseSensitive = data.profiles[keys[k]].triggers[m].caseSensitive;
                                    item.temp = data.profiles[keys[k]].triggers[m].temp;
                                    item.type = data.profiles[keys[k]].triggers[m].type;
                                    item.notes = data.profiles[keys[k]].triggers[m].notes || '';
                                    item.state = data.profiles[keys[k]].triggers[m].state || 0;
                                    item.params = data.profiles[keys[k]].triggers[m].params || '';
                                    item.fired = data.profiles[keys[k]].triggers[m].fired;
                                    if (data.profiles[keys[k]].triggers[m].triggers && data.profiles[keys[k]].triggers[m].triggers.length) {
                                        const il = data.profiles[keys[k]].triggers[m].triggers.length;
                                        for (let i = 0; i < il; i++) {
                                            item.triggers.push(new Trigger(data.profiles[keys[k]].triggers[m].triggers[i]));
                                        }
                                    }
                                    p.triggers.push(item);
                                }
                            }

                            if (data.profiles[keys[k]].buttons) {
                                l = data.profiles[keys[k]].buttons.length;
                                if (l > 0) {
                                    for (let m = 0; m < l; m++) {
                                        item = new Button(data.profiles[keys[k]].buttons[m]);
                                        p.buttons.push(item);
                                    }
                                }
                            }
                            if (data.profiles[keys[k]].contexts) {
                                l = data.profiles[keys[k]].contexts.length;
                                if (l > 0) {
                                    for (let m = 0; m < l; m++) {
                                        item = new Context(data.profiles[keys[k]].contexts[m]);
                                        p.contexts.push(item);
                                    }
                                }
                            }
                            if (profiles.contains(p)) {
                                if (all === 3) {
                                    _replace.push(profiles.items[p.name.toLowerCase()].clone());
                                    profiles.add(p);
                                    _enabled = _enabled.filter((a) => { return a !== p.name.toLowerCase(); });
                                    if (p.enabled)
                                        _enabled.push(p.name.toLowerCase());
                                    names.push(p.clone());
                                    const nodes = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(p.name) + '$', 'id']);
                                    $('#profile-tree').treeview('removeNode', [nodes, { silent: true }]);
                                    $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                                }
                                else if (all === 5) {
                                    n = profileCopyName(p.name);
                                    p.name = n;
                                    p.file = n.toLowerCase();
                                    if (p.enabled)
                                        _enabled.push(p.name.toLowerCase());
                                    profiles.add(p);
                                    names.push(p.clone());
                                    $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                                }
                                else if (all !== 4) {
                                    const response = dialog.showMessageBoxSync({
                                        type: 'question',
                                        title: 'Profiles already exists',
                                        message: 'Profile named \'' + p.name + '\' exist, replace?',
                                        buttons: ['Yes', 'No', 'Copy', 'Replace All', 'No All', 'Copy All'],
                                        defaultId: 1
                                    });
                                    if (response === 0) {
                                        _replace.push(profiles.items[p.name.toLowerCase()].clone());
                                        profiles.add(p);
                                        _enabled = _enabled.filter((a) => { return a !== p.name.toLowerCase(); });
                                        if (p.enabled)
                                            _enabled.push(p.name.toLowerCase());

                                        names.push(p.clone());
                                        const nodes = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(p.name) + '$', 'id']);
                                        $('#profile-tree').treeview('removeNode', [nodes, { silent: true }]);
                                        $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                                    }
                                    else if (response === 2) {
                                        n = profileCopyName(p.name);
                                        p.name = n;
                                        p.file = n.toLowerCase();
                                        profiles.add(p);
                                        if (p.enabled)
                                            _enabled.push(p.name.toLowerCase());
                                        names.push(p.clone());
                                        $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                                    }
                                    else if (response > 2)
                                        all = response;
                                }
                            }
                            else {
                                names.push(p.clone());
                                profiles.add(p);
                                $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                            }
                        }
                    }
                    ipcRenderer.send('set-progress', { value: -1, options: { mode: 'normal' } });
                });
        }
        if (names.length > 0) {
            sortTree();
            pushUndo({ action: 'add', type: 'profile', item: names, replaced: _replace });
        }
    });
}

function trashProfiles(p) {
    if (_remove.length > 0) {
        const rl = _remove.length;
        for (let r = 0; r < rl; r++) {
            const file = path.join(p, _remove[r].file.toLowerCase() + '.json');
            if (!isFileSync(file)) continue;
            ipcRenderer.send('trash-item', file);
        }
    }
}

export function saveProfiles(clearNow?: boolean) {
    if (updateCurrent() !== UpdateState.NoChange)
        return false;
    if (filesChanged) {
        let response = dialog.showMessageBoxSync({
            type: 'question',
            title: 'Profiles updated',
            message: 'Profiles have been updated outside of manager, save anyways?',
            buttons: ['Yes', 'No'],
            defaultId: 1
        });
        if (response === 0) {
            const p = path.join(parseTemplate('{data}'), 'profiles');
            if (!existsSync(p))
                fs.mkdirSync(p);
            profiles.save(p);
            trashProfiles(p);
            options.profiles.enabled = _enabled;
            saveOptions();
            ipcRenderer.send('setting-changed', { type: 'profiles', name: 'enabled', value: options.profiles.enabled });
            ipcRenderer.send('reload-profiles');
            if (clearNow)
                clearChanges();
            else
                setTimeout(clearChanges, 500);
        }
    }
    else {
        const p = path.join(parseTemplate('{data}'), 'profiles');
        if (!existsSync(p))
            fs.mkdirSync(p);
        profiles.save(p);
        trashProfiles(p);
        options.profiles.enabled = _enabled;
        saveOptions();
        ipcRenderer.send('setting-changed', { type: 'profiles', name: 'enabled', value: options.profiles.enabled });
        ipcRenderer.send('reload-profiles');
        if (clearNow)
            clearChanges();
        else
            setTimeout(clearChanges, 500);
    }
    return true;
}

function clearChanges() {
    resetUndo();
    filesChanged = false;
    $('#btn-refresh').removeClass('btn-warning');
}

const editors = {};
let aceTooltip;

function initEditor(id) {
    if (!_ide) return;
    _pUndo = true;
    const textarea = $('#' + id).hide();
    $('#' + id + '-editor').css('display', 'block');
    ace.require('ace/ext/language_tools');
    ace.require('ace/ext/spellcheck');
    editors[id] = ace.edit(id + '-editor');
    const session = editors[id].getSession();
    editors[id].$blockScrolling = Infinity;
    editors[id].getSelectedText = function () {
        return this.session.getTextRange(this.getSelectionRange());
    };

    if (!aceTooltip) {
        const Tooltip = ace.require('ace/tooltip').Tooltip;
        aceTooltip = new Tooltip($('#content')[0]);
    }

    editors[id].setTheme('ace/theme/visual_studio');
    session.setMode('ace/mode/text');
    session.setUseSoftTabs(true);
    session.setValue(textarea.val());

    editors[id].setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true,
        newLineMode: 'unix',
        tabSize: 3
    });

    editors[id].commands.addCommand({
        name: 'expand all folds',
        bindKey: { win: 'Ctrl-Shift-+', mac: 'Command-Option-+' },
        exec: (editor) => {
            editor.getSession().unfold();
        }
    });

    editors[id].commands.addCommand({
        name: 'collapse all folds',
        bindKey: { win: 'Ctrl-Shift--', mac: 'Command-Option--' },
        exec: (editor) => {
            editor.getSession().foldAll();
        }
    });

    editors[id].commands.addCommand({
        name: 'undo',
        exec: (editor, args, e) => {
            doUndo();
            event.preventDefault();
            event.stopPropagation();
            return true;
        },
        bindKey: { mac: 'Command-Z', win: 'Ctrl-Z' }
    });

    editors[id].commands.addCommand({
        name: 'redo',
        exec: (editor, args, e) => {
            doRedo();
            event.preventDefault();
            event.stopPropagation();
            return true;
        },
        bindKey: { mac: 'Command-Shift-Z|Command-Y', win: 'Ctrl-Shift-Z|Ctrl-Y' }
    });

    editors[id].on('focus', (e) => {
        $('#' + id).data('previous-value', session.getValue());
        $('#' + id).data('previous-cursor', editors[id].getCursorPosition());
    });

    session.on('change', (e) => {
        updateCurrent();
        $('#' + id).data('previous-value', session.getValue());
        $('#' + id).data('previous-cursor', editors[id].getCursorPosition());
    });

    session.on('changeFold', () => {
        aceTooltip.hide();
    });

    editors[id].on('mousemove', (e) => {
        const pos = e.getDocumentPosition();
        const fold = e.editor.getSession().getFoldAt(pos.row, pos.column, 1);
        if (fold) {
            let t = e.editor.getSession().getDocument().getTextRange(fold.range).replace(/^\n+|\s+$/g, '');
            const s = t.split(/\n/);
            if (s.length > 10) {
                t = s.slice(0, 10).join('\n').replace(/\s+$/g, '') + '\n...';
            }
            const h = $(window).height();
            const th = aceTooltip.getHeight();
            const x = e.clientX + 32;
            let y = e.clientY;
            if (y + th > h)
                y = y - th;
            aceTooltip.show(t, x, y);
            e.stop();
        }
        else {
            aceTooltip.hide();
        }
    });
    _pUndo = false;
}

let dragging = false;

function setParseSyntax(editor) {
    editors[editor].getSession().setMode('ace/mode/jimud', () => {
        var session = editors[editor].getSession();
        var rules = session.$mode.$highlightRules.getRules();
        //console.log(rules);
        if (Object.prototype.hasOwnProperty.call(rules, 'start')) {
            var b = rules['start'].pop();
            if (!_iComments) {
                rules['start'].pop();
                rules['start'].pop();
            }
            else {
                if (_iCommentsStr.length === 1) {
                    rules['start'][rules['start'].length - 2].regex = `\\${_iCommentsStr[0]}$`;
                    rules['start'][rules['start'].length - 1].regex = `\\${_iCommentsStr[0]}`;
                }
                else {
                    rules['start'][rules['start'].length - 2].regex = `\\${_iCommentsStr[0]}\\${_iCommentsStr[1]}$`;
                    rules['start'][rules['start'].length - 1].regex = `\\${_iCommentsStr[0]}\\${_iCommentsStr[1]}`;
                }
            }
            if (_bComments) {
                if (_iCommentsStr.length === 1)
                    b.regex = `\\${_bCommentsStr[0]}`;
                else
                    b.regex = `\\${_bCommentsStr[0]}\\${_bCommentsStr[1]}`;
                rules['start'].push(b);
            }
            rules['start'][3].token = _stacking;
            rules['start'][3].regex = _stacking;
            rules['start'][5].regex = _parameter + rules['start'][5].regex.substr(1);
            rules['start'][6].regex = _parameter + rules['start'][6].regex.substr(1);
            rules['start'][7].regex = _parameter + rules['start'][7].regex.substr(1);
            rules['start'][8].regex = '\\' + _nParameter + rules['start'][8].regex.substr(2);
            rules['start'][9].regex = '[' + _parameter + _nParameter + ']\\*';
            rules['start'][10].regex = '[' + _parameter + _nParameter + ']{\\*}';
            rules['start'][11].regex = _command + rules['start'][11].regex.substr(1);
            rules['start'][12].regex = '^' + _command + rules['start'][12].regex.substr(2);
            rules['start'][12].splitRegex = new RegExp(rules['start'][12].regex);
            rules['start'][13].regex = '^' + _verbatim + '.*$';
            rules['start'][14].regex = '^' + _speed + '.*$';
            rules['start'][15].regex = '[' + _parameter + _nParameter + rules['start'][15].regex.substr(3);
            rules['start'][15].splitRegex = new RegExp(rules['start'][15].regex);
            rules['start'][16].regex = '[' + _parameter + _nParameter + rules['start'][16].regex.substr(3);
            rules['start'][16].splitRegex = new RegExp(rules['start'][16].regex);
            rules['start'][17].regex = '[' + _parameter + _nParameter + rules['start'][17].regex.substr(3);
            rules['start'][17].splitRegex = new RegExp(rules['start'][17].regex);
            /*
0: {token: 'string', regex: '".*?"', onMatch: null}
1: {token: 'string', regex: "'.*?'", onMatch: null}
2: {token: 'string', regex: '`.*?`', onMatch: null}
3: {token: ';', regex: ';', next: 'stacking', onMatch: null}
4: {token: 'constant.numeric', regex: '[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b', onMatch: null}
5: {token: 'storage.modifier', regex: '%x?[1-9]?\\d\\b', onMatch: null}
6: {token: 'storage.modifier', regex: '%\\{x?[1-9]?\\d\\}', onMatch: null}
7: {token: 'storage.modifier', regex: '%[i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z]\\b', onMatch: null}
8: {token: 'storage.modifier', regex: '\\$\\{x?[1-9]?\\d\\}', onMatch: null}
9: {token: 'storage.modifier', regex: '[%$]\\*', onMatch: null}
10: {token: 'storage.modifier', regex: '[%$]{\\*}', onMatch: null}
11: {token: 'keyword', regex: '#\\d+\\s', onMatch: null}
12: {regex: '^#([a-zA-Z_$][a-zA-Z0-9_$]*)\\b', splitRegex: /^#([a-zA-Z_$][a-zA-Z0-9_$]*)\b$/, token: ƒ, onMatch: ƒ}
13: {token: 'constant.language', regex: '^`.*$', onMatch: null}
14: {token: 'comment', regex: '^!.*$', onMatch: null}
15: {regex: '[%$]{(\\w*)}', splitRegex: /^[%$]{(\w*)}$/, token: ƒ, onMatch: ƒ}
16: {regex: '[%$]{(\\w*)\\(.*\\)}', splitRegex: /^[%$]{(\w*)\(.*\)}$/, token: ƒ, onMatch: ƒ}
17: {token: '{', regex: '\\{', next: 'bracket', onMatch: null}
18: {token: 'paren.lparen', regex: '[\\{}]', onMatch: null}
19: {token: 'paren.rparen', regex: '[\\}]', onMatch: null}
20: {token: 'text', regex: '\\s+', onMatch: null}         
            */
        }
        if (Object.prototype.hasOwnProperty.call(rules, 'stacking')) {
            rules['stacking'][0].regex = _command + rules['stacking'][0].regex.substr(1);
            rules['stacking'][0].splitRegex = new RegExp(rules['stacking'][0].regex);
            rules['stacking'][1].regex = _command + rules['stacking'][1].regex.substr(1);
            rules['stacking'][2].regex = _verbatim + '.*$';
            rules['stacking'][3].regex = _speed + '.*$';
            /*
0: {regex: '#([a-zA-Z_$][a-zA-Z0-9_$]*)\\b', next: 'start', splitRegex: /^#([a-zA-Z_$][a-zA-Z0-9_$]*)\b$/, token: ƒ, onMatch: ƒ}
1: {token: 'keyword', regex: '#\\d+\\s', next: 'start', onMatch: null}
2: {token: 'constant.language', regex: '`.*$', next: 'start', onMatch: null}
3: {token: 'comment', regex: '!.*$', next: 'start', onMatch: null}
4: {token: 'text', regex: '\\s+', next: 'start', onMatch: null}
            */
        }
        if (Object.prototype.hasOwnProperty.call(rules, 'bracket')) {
            rules['bracket'][0].regex = '\\s*?' + _command + rules['bracket'][0].regex.substr(5);
            rules['bracket'][0].splitRegex = new RegExp(rules['bracket'][0].regex);
            rules['bracket'][3].regex = _verbatim + '.*$';
            rules['bracket'][4].regex = _speed + '.*$';
            rules['bracket'][6].regex = _command + rules['bracket'][6].regex.substr(1);
            /*
0: {regex: '\\s*?#([a-zA-Z_$][a-zA-Z0-9_$]*)\\b', next: 'start', splitRegex: /^\s*?#([a-zA-Z_$][a-zA-Z0-9_$]*)\b$/, token: ƒ, onMatch: ƒ}
1: {token: 'string', regex: '".*?"', onMatch: null}
2: {token: 'string', regex: "'.*?'", onMatch: null}
3: {token: 'constant.language', regex: '`.*$', next: 'start', onMatch: null}
4: {token: 'comment', regex: '!.*$', next: 'start', onMatch: null}
5: {token: ';', regex: ';', next: 'stacking', onMatch: null}
6: {token: 'keyword', regex: '#\\d+\\s', onMatch: null}
7: {token: 'constant.numeric', regex: '[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b', onMatch: null}
8: {token: 'text', regex: '\\s+', next: 'start', onMatch: null}      
            */
        }
        if (_bComments && Object.prototype.hasOwnProperty.call(rules, 'comment')) {
            if (_bCommentsStr.length === 1)
                rules['comment'][0].regex = `\\${_bCommentsStr[0]}`;
            else
                rules['comment'][0].regex = `\\${_bCommentsStr[1]}\\${_bCommentsStr[0]}`;
        }
        //console.log(rules);
        // force recreation of tokenizer
        session.$mode.$tokenizer = null;
        session.bgTokenizer.setTokenizer(session.$mode.getTokenizer());
        // force re-highlight whole document
        session.bgTokenizer.start(0);
    });
}

function resetParseSyntax() {
    if (!editors) return;
    if (editors['trigger-value'] && editors['trigger-value'].getSession().getMode() === "ace/mode/jimud")
        setParseSyntax('trigger-value');
    if (editors['macro-value'] && editors['macro-value'].getSession().getMode() === "ace/mode/jimud")
        setParseSyntax('macro-value');
    if (editors['alias-value'] && editors['alias-value'].getSession().getMode() === "ace/mode/jimud")
        setParseSyntax('alias-value');
    if (editors['button-value'] && editors['button-value'].getSession().getMode() === "ace/mode/jimud")
        setParseSyntax('button-value');
    if (editors['context-value'] && editors['context-value'].getSession().getMode() === "ace/mode/jimud")
        setParseSyntax('context-value');
}

function resetUndo() {
    _undo = [];
    _redo = [];
    updateUndoState();
}

function pushUndo(data) {
    if (_pUndo) return;
    data.node = currentNode.id;
    _undo.push(data);
    _redo = [];
    updateUndoState();
}

function updateUndoState() {
    $('#btn-undo').prop('disabled', _undo.length === 0);
    $('#btn-redo').prop('disabled', _redo.length === 0);
    menubar.updateItem('edit|undo', { enabled: _undo.length === 0 });
    menubar.updateItem('edit|redo', { enabled: _redo.length === 0 });
}

function DeleteProfileConfirm(profile) {
    dialog.showMessageBox({
        type: 'question',
        title: 'Delete profile?',
        message: 'Delete ' + profile.name + '?',
        buttons: ['Yes', 'No'],
        defaultId: 1
    }).then(result => {
        if (result.response === 0) DeleteProfile(profile);
    });
}

function DeleteProfile(profile, customUndo?: boolean) {
    if (!profile) profile = currentProfile;
    _remove.push({ name: profile.name, file: profile.file || profile.name });
    if (!customUndo)
        pushUndo({ action: 'delete', type: 'profile', item: profile });
    const nodes = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + '$', 'id']);
    $('#profile-tree').treeview('removeNode', [nodes, { silent: false }]);
    if (profile.name === currentProfile.name) {
        if (profile.name.toLowerCase() === 'default') {
            const ll = profiles.keys.length;
            for (let l = 0; l < ll; l++) {
                if (profiles.keys[l] === 'default') continue;
                $('#profile-tree').treeview('selectNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profiles.keys[l] + '$', 'id'])]);
                break;
            }
        }
        else
            $('#profile-tree').treeview('selectNode', [$('#profile-tree').treeview('findNodes', ['^Profiledefault$', 'id'])]);
    }
    profiles.remove(profile);
    _enabled = _enabled.filter((a) => { return a !== profile.name.toLowerCase(); });
}

function DeleteItems(type, key, profile) {
    dialog.showMessageBox({
        type: 'question',
        title: 'Delete ' + type + '?',
        message: 'Are you sure you want to delete all ' + key + '?',
        buttons: ['Yes', 'No'],
        defaultId: 1
    }).then(result => {
        if (result.response === 0) {
            const _u = { action: 'group', add: [], delete: [] };
            const n = $('#profile-tree').treeview('findNodes', ['Profile' + profileID(profile.name) + key, 'id']);
            $('#profile-tree').treeview('expandNode', [n, { levels: 1, silent: true }]);
            for (let i = profile[key].length - 1; i >= 0; i--) {
                _u.delete.unshift({ type: type, item: profile[key][i].clone(), data: { type: type, key: key, item: profile[key][i].clone(), idx: i, profile: profile.name.toLowerCase() } });
                DeleteItem(type, key, i, profile, true);
            }
            pushUndo(_u);
        }
    });
}

function DeleteItemConfirm(type, key, idx, profile) {
    dialog.showMessageBox({
        type: 'question',
        title: 'Delete ' + type + '?',
        message: 'Are you sure you want to delete this ' + type + '?',
        buttons: ['Yes', 'No'],
        defaultId: 1
    }).then(result => {
        if (result.response === 0) {
            DeleteItem(type.toLowerCase(), key, idx, profile);
        }
    });
}

function DeleteItem(type: string, key: string, idx: number, profile?: Profile, customUndo?: boolean) {
    let il;
    let i;
    let node;
    let newNode;
    let selected;
    let name;
    if (!profile) profile = currentProfile;
    if (!customUndo)
        pushUndo({ action: 'delete', type: type, data: { key: key, idx: idx, profile: profile.name.toLowerCase() }, item: profile[key][idx] });
    name = profileID(profile.name);
    node = $('#profile-tree').treeview('findNodes', ['Profile' + name + key + idx, 'id']);
    if (node && node.length > 0 && node[0].state.selected)
        currentNode = null;
    $('#profile-tree').treeview('removeNode', [node, { silent: true }]);
    profile[key].splice(idx, 1);
    il = profile[key].length;
    if (il > 0) {
        for (i = idx; i < il; i++) {
            node = $('#profile-tree').treeview('findNodes', ['Profile' + name + key + (i + 1), 'id']);
            if (node && node.length > 0)
                node = node[0];
            else
                node = null;
            if (node) {
                newNode = newItemNode(profile[key][i], i, type, profile);
                if (node.state && node.state.selected)
                    selected = newNode.id;
                $('#profile-tree').treeview('updateNode', [node, newNode]);
            }
        }
        if (selected) {
            const n = $('#profile-tree').treeview('findNodes', ['^' + selected + '$', 'id'])[0];
            currentNode = n[0];
            $('#profile-tree').treeview('selectNode', [n]);
        }
    }
}

export function doClose() {
    if (_never || (_undo.length === 0 && updateCurrent() === UpdateState.NoChange)) {
        _close = true;
        window.close();
    }
    else {
        dialog.showMessageBox({
            type: 'warning',
            title: 'Profiles changed',
            message: 'All unsaved changes will be lost, close?',
            buttons: ['Yes', 'No', 'Never ask again'],
            defaultId: 1
        }).then(result => {
            if (result.response === 0)
                window.close();
            else if (result.response === 2) {
                _never = false;
                _close = true;
                window.close();
                ipcRenderer.send('setting-changed', { type: 'profiles', name: 'askoncancel', value: false });
            }
        });
    }
}

export function doImport(node) {
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    const profile = profiles.items[node.dataAttr.profile];
    const m = Profile.DefaultMacros;
    const _import = { action: 'group', add: [], delete: [] };
    const il = m.length;
    for (let i = 0; i < il; i++) {
        _import.add.push({ type: 'macro', item: m[i].clone(), data: { type: 'macro', key: 'macros', item: m[i].clone(), id: profile['macros'].length, profile: profile.name.toLowerCase() } });
        addItem('macro', 'macros', m[i], profile['macros'].length, profile, true);
    }
    pushUndo(_import);
}

export function doReset(node) {
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    const profile = profiles.items[node.dataAttr.profile];
    dialog.showMessageBox({
        type: 'warning',
        title: 'Reset ' + profile.name,
        message: 'Resetting will loose all profile data, reset?',
        buttons: ['Yes', 'No'],
        defaultId: 1
    }).then(result => {
        if (result.response === 0) {
            pushUndo({ action: 'reset', type: 'profile', profile: profile.clone() });
            let o;
            let n = $('#profile-tree').treeview('findNodes', ['Profile' + profileID(profile.name) + 'macros[0-9]+', 'id']);
            n = n.concat($('#profile-tree').treeview('findNodes', ['Profile' + profileID(profile.name) + 'triggers[0-9]+', 'id']));
            n = n.concat($('#profile-tree').treeview('findNodes', ['Profile' + profileID(profile.name) + 'buttons[0-9]+', 'id']));
            n = n.concat($('#profile-tree').treeview('findNodes', ['Profile' + profileID(profile.name) + 'aliases[0-9]+', 'id']));
            n = n.concat($('#profile-tree').treeview('findNodes', ['Profile' + profileID(profile.name) + 'contexts[0-9]+', 'id']));
            $('#profile-tree').treeview('removeNode', [n, { silent: true }]);
            n = {
                text: 'Aliases',
                id: 'Profile' + profileID(profile.name) + 'aliases',
                dataAttr: {
                    profile: profile.name.toLowerCase(),
                    type: 'aliases'
                },
                lazyLoad: 0,
                state: {
                    checked: profile.enableAliases
                }
            };
            o = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'aliases$', 'id']);
            $('#profile-tree').treeview('updateNode', [o[0], n]);
            n = {
                text: 'Macros',
                id: 'Profile' + profileID(profile.name) + 'macros',
                dataAttr: {
                    profile: profile.name.toLowerCase(),
                    type: 'macros'
                },
                lazyLoad: 0,
                state: {
                    checked: profile.enableMacros
                }
            };
            o = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'macros$', 'id']);
            $('#profile-tree').treeview('updateNode', [o[0], n]);

            n = {
                text: 'Triggers',
                id: 'Profile' + profileID(profile.name) + 'triggers',
                dataAttr: {
                    profile: profile.name.toLowerCase(),
                    type: 'triggers'
                },
                lazyLoad: 0,
                state: {
                    checked: profile.enableTriggers
                }
            };
            o = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'triggers$', 'id']);
            $('#profile-tree').treeview('updateNode', [o[0], n]);
            n = {
                text: 'Buttons',
                id: 'Profile' + profileID(profile.name) + 'buttons',
                dataAttr: {
                    profile: profile.name.toLowerCase(),
                    type: 'buttons'
                },
                lazyLoad: 0,
                state: {
                    checked: profile.enableButtons
                }
            };
            o = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'buttons$', 'id']);
            $('#profile-tree').treeview('updateNode', [o[0], n]);

            n = {
                text: 'Contexts',
                id: 'Profile' + profileID(profile.name) + 'contexts',
                dataAttr: {
                    profile: profile.name.toLowerCase(),
                    type: 'contexts'
                },
                lazyLoad: 0,
                state: {
                    checked: profile.enableContexts
                }
            };
            o = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'contexts$', 'id']);
            $('#profile-tree').treeview('updateNode', [o[0], n]);

            profile.aliases = [];
            profile.macros = [];
            profile.triggers = [];
            profile.buttons = [];
            profile.enableMacros = true;
            profile.enableTriggers = true;
            profile.enableAliases = true;
            profile.enableButtons = true;
            profile.enableContexts = true;
            profile.enableDefaultContext = true;
            profile.priority = 0;

            _enabled = _enabled.filter((a) => { return a !== profile.name.toLowerCase(); });
            _enabled.push(profile.name.toLowerCase());

            if (profile.name === currentProfile.name) {
                $('#profile-enableAliases').prop('checked', currentProfile.enableAliases);
                $('#profile-enableMacros').prop('checked', currentProfile.enableMacros);
                $('#profile-enableTriggers').prop('checked', currentProfile.enableTriggers);
                $('#profile-enableButtons').prop('checked', currentProfile.enableButtons);
                $('#profile-enableContexts').prop('checked', currentProfile.enableContexts);
                $('#profile-enableDefaultContext').prop('checked', currentProfile.enableDefaultContext);
                $('#editor-enabled').prop('checked', true);
                $('#profile-priority').val(currentProfile.priority);
            }
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'macros$', 'id'])]);
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'aliases$', 'id'])]);
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'triggers$', 'id'])]);
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'buttons$', 'id'])]);
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + 'contexts$', 'id'])]);
            $('#profile-tree').treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + '$', 'id'])]);

        }
    });
}

function UpdateEditor(editor, item, options?) {
    if (!options) options = {};
    _loading++;
    _pUndo = true;
    $('div[id$=-editor]').css('display', 'none');
    $('#' + editor + '-editor').css('display', '');
    $('#editor-title').text(editor + ': ' + GetDisplay(item));
    if (editor === 'profile')
        $('#editor-enabled').prop('checked', _enabled.indexOf(item.name.toLowerCase()) !== -1);
    else
        $('#editor-enabled').prop('checked', item.enabled);
    if (typeof options['pre'] === 'function')
        options['pre'](item);
    let prop;
    for (prop in item) {
        if (!item.hasOwnProperty(prop)) {
            continue;
        }
        const id = '#' + editor + '-' + prop;
        if (typeof options[prop] === 'function') {
            options[prop](item, prop, $(id));
        }
        else if (typeof options[prop] === 'string') {
            if (typeof item[options[prop]] === 'boolean')
                $(id).prop('checked', item[options[prop]]);
            else
                $(id).val(item[options[prop]]);
        }
        else if (typeof item[prop] === 'boolean')
            $(id).prop('checked', item[prop]);
        else if (editors[editor + '-' + prop]) {
            if (editors[editor + '-' + prop]) {
                editors[editor + '-' + prop].getSession().setValue(item[prop]);
                if (item.style === ItemStyle.Script)
                    editors[editor + '-' + prop].getSession().setMode('ace/mode/javascript');
                else if (item.style === ItemStyle.Parse)
                    setParseSyntax(editor + '-' + prop);
                else
                    editors[editor + '-' + prop].getSession().setMode('ace/mode/text');
            }
        }
        else {
            $(id).val(item[prop]);
            $(id).selectpicker('val', item[prop]);
        }
        $(id).data('previous-value', item[prop]);
    }
    if (typeof options['post'] === 'function')
        options['post'](item);
    _pUndo = false;
    _loading--;
}

function MacroValue(item, prop, el) {
    el.val(MacroKeys(item));
    el.data('key', item.key);
    el.data('mod', item.modifiers);
    el.data('gamepad', item.gamepad);
    el.data('axes', item.gamepadAxes);
}

function insertItem(type: string, key: string, item, idx: number, profile?: Profile, customUndo?: boolean) {
    _loading++;
    if (!profile)
        profile = currentProfile;
    if (!idx)
        idx = profile[key].length;
    //clear current node as no longer valid
    currentNode = null;
    type = type.toLowerCase();
    //fine parent node
    const n = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + key + '$', 'id']);
    $('#profile-tree').treeview('expandNode', [n, { levels: 1, silent: false }]);
    //create new node to be inserted
    const nodes = [newItemNode(item, idx, type, profile)];
    let node;
    let newNode;
    const remove = [];
    const il = profile[key].length;
    //loop current nodes to grab data and update indexes
    for (let i = idx; i < il; i++) {
        //Find old node
        node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + key + i + '$', 'id'])[0];
        //Push to remove it
        remove.push(node);
        //clone it, will remove invalid node data
        newNode = cloneNode(node);
        //update data to use new index
        newNode.text = htmlEncode(GetDisplay(profile[key][i]));
        newNode.dataAttr.index = i + 1;
        newNode.id = 'Profile' + profileID(profile.name) + key + newNode.dataAttr.index;
        //store to add at one time
        nodes.push(newNode);
    }
    //remove old nodes with invalid indexes
    $('#profile-tree').treeview('removeNode', [remove, { silent: true }]);
    //add new item in to profile
    profile[key].splice(idx, 0, item);
    //add new nodes to treeview
    $('#profile-tree').treeview('addNode', [nodes, n, idx, { silent: true }]);
    //select the newest node
    $('#profile-tree').treeview('selectNode', [[nodes[0]], { silent: false }]);
    //sort nodes
    sortNodeChildren('Profile' + profileID(profile.name) + key);
    if (!customUndo)
        pushUndo({ action: 'add', type: type, item: item.clone(), data: { type: type, key: key, item: item, idx: idx, profile: profile.name.toLowerCase() } });
    _loading--;
}

ipcRenderer.on('profile-edit-item', (event, profile, type, index) => {
    if (!profile || !profiles.items[profile.toLowerCase()]) return;
    let n = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile) + type + '$', 'id']);
    $('#profile-tree').treeview('expandNode', [n, { levels: 1, silent: false }]);
    n = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile) + type + index + '$', 'id']);
    $('#profile-tree').treeview('selectNode', [n, { silent: false }]);
});

ipcRenderer.on('change-options', (event, file) => {
    const so = _sort;
    const sd = _sortDir;
    loadOptions();
    resetParseSyntax();
    if (so !== _sort || sd !== _sortDir)
        sortTree(true);
    filesChanged = true;
    $('#btn-refresh').addClass('btn-warning');
});

ipcRenderer.on('profile-item-added', (event, type, profile, item) => {
    filesChanged = true;
    $('#btn-refresh').addClass('btn-warning');
});

ipcRenderer.on('profile-item-updated', (event, type, profile, idx, item) => {
    filesChanged = true;
    $('#btn-refresh').addClass('btn-warning');
});

ipcRenderer.on('profile-item-removed', (event, type, profile, idx) => {
    filesChanged = true;
    $('#btn-refresh').addClass('btn-warning');
});

ipcRenderer.on('profile-updated', (event, profile, noChanges, type) => {
    //filesChanged = true;
    //$('#btn-refresh').addClass('btn-warning');
});

ipcRenderer.on('profile-toggled', (event, profile, enabled) => {
    const parent = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile) + '$', 'id']);
    if (!parent) return;
    _enabled.filter((a) => { return a !== profile.toLowerCase(); });
    if (enabled)
        _enabled.push(profile.toLowerCase());
    if (_enabled.length === 0)
        _enabled.push('default');
    if (enabled)
        $('#profile-tree').treeview('checkNode', [parent, { silent: true }]);
    else
        $('#profile-tree').treeview('uncheckNode', [parent, { silent: true }]);
    const t = currentNode.dataAttr.type;
    if (currentProfile.name === profile && t === 'profile' || t === 'aliases' || t === 'triggers' || t === 'buttons' || t === 'macros' || t === 'contexts')
        $('#editor-enabled').prop('checked', enabled);
});

function exportAll() {
    clearButton('#export');
    dialog.showSaveDialog({
        title: 'Export all profiles',
        defaultPath: 'jiMUD.profiles.txt',
        filters: [
            { name: 'Text files (*.txt)', extensions: ['txt'] },
            { name: 'All files (*.*)', extensions: ['*'] }
        ]
    }).then((result) => {
        if (result.filePath === undefined || result.filePath.length === 0) {
            return;
        }
        const data = {
            version: 2,
            profiles: profiles.clone(2)
        };
        fs.writeFileSync(result.filePath, JSON.stringify(data));
    });

}

$(window).keydown((event) => {
    if ((<HTMLDialogElement>document.getElementById('progress-dialog')).open) {
        event.preventDefault();
        return false;
    }
});

// eslint-disable-next-line no-unused-vars
function exportAllZip() {
    const file = dialog.showSaveDialogSync({
        title: 'Save as...',
        defaultPath: path.join(parseTemplate('{documents}'), 'jiMUD-profiles.zip'),
        filters: [
            { name: 'Zip files (*.zip)', extensions: ['zip'] },
            { name: 'All files (*.*)', extensions: ['*'] }
        ]
    });
    if (file === undefined || file.length === 0)
        return;

    showProgressDialog();
    archiver = archiver || require('yazl');
    const data = parseTemplate('{data}');
    archive = new archiver.ZipFile();

    let files;
    if (isDirSync(path.join(data, 'profiles'))) {
        files = walkSync(path.join(data, 'profiles'));
        if (files.length === 0) {
            dialog.showMessageBox({
                type: 'error',
                title: 'No logs found',
                message: 'No logs to backup',
                defaultId: 1
            });
            return;
        }
        files.files.forEach(f => {
            archive.addFile(f, f.substring(data.length + 1).replace(/\\/g, '/'));
        });
    }

    archive.outputStream.pipe(fs.createWriteStream(file)).on('close', closeProgressDialog);
    archive.end(closeProgressDialog);
}

function showProgressDialog() {
    const progress: HTMLDialogElement = <HTMLDialogElement>document.getElementById('progress-dialog');
    if (progress.open) return;
    setProgressDialogValue(0);
    menubar.enabled = false;
    progress.showModal();
}

function setProgressDialogValue(value) {
    ipcRenderer.send('set-progress', { value: value });
    ipcRenderer.send('set-progress-window', 'code-editor', { value: value });
    (<any>document.getElementById('progress-dialog-progressbar')).value = value * 100;
}

function closeProgressDialog() {
    const progress: HTMLDialogElement = <HTMLDialogElement>document.getElementById('progress-dialog');
    if (progress.open)
        progress.close();
    setProgressDialogValue(-1);
    document.getElementById('progress-dialog-progressbar').removeAttribute('value');
    archive = null;
    menubar.enabled = true;
}

// eslint-disable-next-line no-unused-vars
function cancelProgress() {
    if (archive)
        archive.abort();
    closeProgressDialog();
}

function exportCurrent() {
    clearButton('#export');
    dialog.showSaveDialog({
        title: 'Export profile',
        defaultPath: 'jiMUD.' + profileID(currentProfile.name) + '.txt',
        filters: [
            { name: 'Text files (*.txt)', extensions: ['txt'] },
            { name: 'All files (*.*)', extensions: ['*'] }
        ]
    }).then((result) => {
        if (result.filePath === undefined || result.filePath.length === 0) {
            return;
        }
        const data = {
            version: 2,
            profiles: {}
        };
        data.profiles[currentProfile.name] = currentProfile.clone(2);
        fs.writeFileSync(result.filePath, JSON.stringify(data));
    });

}

export function validateIdentifiers(el: HTMLInputElement, focus?) {
    if (!el) return;
    if (el.value.length === 0) {
        el.parentElement.classList.remove('has-error');
        el.parentElement.classList.remove('has-feedback');
        return true;
    }
    const ids = el.value.split(',').filter(v => v.length && !isValidIdentifier(v.trim()))
    if (ids.length === 0) {
        el.parentElement.classList.remove('has-error');
        el.parentElement.classList.remove('has-feedback');
    }
    else {
        el.parentElement.classList.add('has-error');
        el.parentElement.classList.add('has-feedback');
        el.nextElementSibling.innerHTML = '<small class="aura-error">Invalid names:' + ids.join(',') + '</small>';
        if (focus)
            el.focus();
    }
    return ids.length === 0;
}