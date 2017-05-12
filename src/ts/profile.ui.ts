//cSpell:ignore dropdown, selectall, treeview, displaytype, uncheck, selectpicker, Profiledefault, askoncancel, triggernewline, triggerprompt
import { shell, remote, ipcRenderer } from 'electron';
const { dialog, Menu, MenuItem } = remote;
import { FilterArrayByKeyValue, parseTemplate, keyCharToCode, keyCodeToChar, clone } from './library';
import { ProfileCollection, Profile, Alias, Macro, Button, Trigger, Context, MacroDisplay, MacroModifiers, ItemStyle } from './profile';
import { Settings } from './settings';
const path = require('path');
const fs = require("fs");
//const trash = require('trash');

declare var ace;

var profiles = new ProfileCollection();
var currentProfile;
var currentNode;
var watcher;
var filesChanged = false;
var _clip, _pUndo;
var _undo = [], _redo = [];
var _remove = [];
var _never = true;
var _close, _loading = 0;

enum UpdateState {
    NoChange,
    Changed,
    Error
}

const addMenu = new Menu();
addMenu.append(new MenuItem({
    label: 'Add empty profile', click() {
        clearButton("#btn-add-dropdown");
        AddNewProfile();
    }
}));
addMenu.append(new MenuItem({
    label: 'Add profile with defaults', click() {
        clearButton("#btn-add-dropdown");
        AddNewProfile(true);
    }
}));
addMenu.append(new MenuItem({ type: 'separator' }));
addMenu.append(new MenuItem({
    label: 'Add alias', click() {
        clearButton("#btn-add-dropdown");
        addItem('Alias', 'aliases', new Alias());
    }
}));
addMenu.append(new MenuItem({
    label: 'Add macro', click() {
        clearButton("#btn-add-dropdown");
        addItem('Macro', 'macros', new Macro());
    }
}));
addMenu.append(new MenuItem({
    label: 'Add trigger', click() {
        clearButton("#btn-add-dropdown");
        addItem('Trigger', 'triggers', new Trigger());
    }
}));
addMenu.append(new MenuItem({
    label: 'Add button', click() {
        clearButton("#btn-add-dropdown");
        addItem('Button', 'buttons', new Button())
    }
}));

const selectionMenu = Menu.buildFromTemplate([
    { role: 'copy' },
    { type: 'separator' },
    { role: 'selectall' },
])

var inputMenu;

inputMenu = Menu.buildFromTemplate([

    {
        label: 'Undo',
        click: () => { doUndo() },
        accelerator: 'CmdOrCtrl+Z'
    },
    {
        label: 'Redo',
        click: () => { doRedo() },
        accelerator: 'CmdOrCtrl+Y'
    },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { type: 'separator' },
    { role: 'selectall' },
])

function addInputContext() {
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        inputMenu.popup(remote.getCurrentWindow());
    }, false)
}

function profileID(name) {
    return name.toLowerCase().replace(/^[^a-z]+|[^\w:.-]+/gi, "-");
}

export function AddNewItem() {
    var t
    if (currentNode) {
        currentNode.state.selected = false;
        t = "profile";
        if (!currentNode.dataAttr.type)
            t = currentNode.text.toLowerCase();
        else
            t = currentNode.dataAttr.type;
        switch (t) {
            case "profile":
                AddNewProfile(true);
                break;
            case "aliases":
            case "alias":
                addItem('Alias', 'aliases', new Alias());
                break;
            case "macros":
            case "macro":
                addItem('Macro', 'macros', new Macro());
                break;
            case "triggers":
            case "trigger":
                addItem('Trigger', 'triggers', new Trigger());
                break;
            case "buttons":
            case "button":
                addItem('Button', 'buttons', new Button());
                break;
        }
    }
}

function AddNewProfile(d?: Boolean) {
    var i = profiles.length;
    var n = "NewProfile" + i;
    while (profiles.contains(n)) {
        i++;
        n = "NewProfile" + i;
    }
    var p = new Profile(n);
    if (!d) p.macros = [];
    profiles.add(p);
    var txt = n;
    n = n.toLowerCase();
    var node = {
        text: txt,
        id: 'Profile' + profileID(n),
        state: {
            checked: profiles.items[n].enabled
        },
        dataAttr: {
            type: 'profile',
            profile: n
        },
        nodes: [
            {
                text: 'Aliases',
                id: 'Profile' + profileID(n) + 'aliases',
                dataAttr: {
                    profile: n
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
                    profile: n
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
                    profile: n
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
                    profile: n
                },
                lazyLoad: profiles.items[n].buttons.length > 0,
                state: {
                    checked: profiles.items[n].enableButtons
                }
            }
        ]
    }
    $('#profile-tree').treeview('addNode', [node, false, false]);
    pushUndo({ action: 'add', type: 'profile', item: [p.name.toLowerCase()] });
}

export function RunTester() {
    if ($("#trigger-test-text").val().length === 0) {
        $('#trigger-test-results').val("No text to test against!");
        return;
    }
    try {
        if ($("#trigger-verbatim").prop("checked")) {
            if ($('#trigger-pattern').val() != $("#trigger-test-text").val())
                $('#trigger-test-results').val("Pattern doesn't Match!");
            else
                $('#trigger-test-results').val("%0 : " + $("#trigger-test-text").val() + "\n");
        }
        else {
            var re = new RegExp($('#trigger-pattern').val(), 'g');
            var res = re.exec($("#trigger-test-text").val());
            if (res === null || res.length === 0)
                $('#trigger-test-results').val("Pattern doesn't Match!");
            else {
                var r = "";
                for (i = 0; i < res.length; i++) {
                    r += "%" + i + " : " + res[i] + "\n";
                }
                $('#trigger-test-results').val(r);
            }
        }

    }
    catch (e) {
        $('#trigger-test-results').val("Error: " + e);
    }
}

function clearTriggerTester() {
    $('#trigger-test-text').val("");
    $('#trigger-test-results').val("");
    $('.nav-tabs a[href="#tab-trigger-value"]').tab('show');
}

export function UpdateButtonSample() {
    var button = $("#button-sample");
    if ($("#button-stretch").prop('checked'))
        button.addClass('button-stretch');
    else
        button.removeClass('button-stretch')
    button.prop('title', $('#button-caption').val());
    var icon = $('#button-icon').val();
    if (icon.startsWith("fa-"))
        button.html('<i class="fa ' + icon + '"></i>');
    else if (icon.startsWith("gi-"))
        button.html('<i class="glyphicon glyphicon-' + icon.substring(3) + '"></i>');
    else if (icon.startsWith("glyphicon-"))
        button.html('<i class="glyphicon ' + icon + '"></i>');
    else if (icon.startsWith("."))
        button.html('<i class="fa button-icon ' + icon.substring(1) + '"></i>');
    else if (icon.length > 0)
        button.html('<img src="' + parseTemplate(icon) + '" />');
    else
        button.html('<i class="fa fa-question"></i>');
}

export function openImage() {

    dialog.showOpenDialog(remote.getCurrentWindow(), {
        defaultPath: path.dirname($('#button-icon').val()),
        filters: [

            { name: 'Images (*.jpg, *.png, *.gif)', extensions: ['jpg', 'png', 'gif'] },
            { name: 'All files (*.*)', extensions: ['*'] },
        ]
    },
        function (fileNames) {
            if (fileNames === undefined) {
                return;
            }
            $('#button-icon').keyup().val(fileNames[0]).keydown();
            UpdateButtonSample();
        });
}

function MacroKeys(item) {
    if (item.key === 0)
        return "None";
    var d = [];
    if ((item.modifiers & MacroModifiers.Ctrl) == MacroModifiers.Ctrl)
        d.push("Ctrl");
    if ((item.modifiers & MacroModifiers.Alt) == MacroModifiers.Alt)
        d.push("Alt");
    if ((item.modifiers & MacroModifiers.Shift) == MacroModifiers.Shift)
        d.push("Shift");
    if ((item.modifiers & MacroModifiers.Meta) == MacroModifiers.Meta) {
        if (process.platform == "darwin")
            d.push("Cmd");
        else
            d.push("Win");
    }
    if (keyCodeToChar[item.key])
        d.push(keyCodeToChar[item.key]);
    else
        return "None";
    return d.join("+");
}

function clearButton(id) {
    $(id).removeClass('open');
    $(id).blur();
}

function GetDisplay(arr) {
    if (arr.displaytype == 1) {
        /*jslint evil: true */
        var f = new Function("item", arr.display);
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
    if (!idx && typeof idx !== "number")
        idx = profile[key].length;
    type = type.toLowerCase();
    var n = $("#profile-tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + key + "$", 'id']);
    $('#profile-tree').treeview('expandNode', [n, { levels: 1, silent: false }]);
    profile[key][idx] = item;
    var nodes = [newItemNode(item, idx, type, profile)];
    $('#profile-tree').treeview('addNode', [nodes, n, false, { silent: false }]);
    $('#profile-tree').treeview('selectNode', [nodes, { silent: false }]);
    if (!customUndo)
        pushUndo({ action: 'add', type: type.toLowerCase(), item: item.clone(), data: { type: type, key: key, item: item, idx: idx, profile: profile.name.toLowerCase() } });
}

export function UpdateEnabled() {
    var t = "profile";
    if (!currentNode.dataAttr.type) {
        var parent = $('#profile-tree').treeview('getParents', currentNode)[0];
        t = parent.dataAttr.type;
    }
    else
        t = currentNode.dataAttr.type;
    switch (t) {
        case "aliases":
        case "macros":
        case "triggers":
        case "buttons":
        case "profile":
            var parent = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(currentProfile.name) + "$", 'id']);
            if (!$("#editor-enabled").prop("checked")) {
                if (profiles.canDisable(currentProfile)) {
                    if ($("#editor-enabled").prop("checked"))
                        $('#profile-tree').treeview('checkNode', [parent, { silent: true }]);
                    else
                        $('#profile-tree').treeview('uncheckNode', [parent, { silent: true }]);
                    pushUndo({ action: 'update', type: 'profile', profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.enabled } });
                    currentProfile.enabled = $("#editor-enabled").prop("checked");
                }
                else {
                    $("#editor-enabled").prop("checked", true);
                    $("#profile-tree").treeview('checkNode', [parent, { silent: true }]);
                }
            }
            else if (currentProfile.enabled != $("#editor-enabled").prop("checked")) {
                if ($("#editor-enabled").prop("checked"))
                    $('#profile-tree').treeview('checkNode', [parent, { silent: true }]);
                else
                    $('#profile-tree').treeview('uncheckNode', [parent, { silent: true }]);
                pushUndo({ action: 'update', type: 'profile', profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.enabled } });
                currentProfile.enabled = $("#editor-enabled").prop("checked");
            }


            break;

        case "alias":
            if ($("#editor-enabled").prop("checked"))
                $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            else
                $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.aliases[currentNode.dataAttr.index].enabled } });
            currentProfile.aliases[currentNode.dataAttr.index].enabled = $("#editor-enabled").prop("checked");
            break;
        case "macro":
            if ($("#editor-enabled").prop("checked"))
                $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            else
                $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.macros[currentNode.dataAttr.index].enabled } });
            currentProfile.macros[currentNode.dataAttr.index].enabled = $("#editor-enabled").prop("checked");
            break;
        case "trigger":
            if ($("#editor-enabled").prop("checked"))
                $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            else
                $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.triggers[currentNode.dataAttr.index].enabled } });
            currentProfile.triggers[currentNode.dataAttr.index].enabled = $("#editor-enabled").prop("checked");
            break;
        case "button":
            if ($("#editor-enabled").prop("checked"))
                $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            else
                $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: { enabled: currentProfile.buttons[currentNode.dataAttr.index].enabled } });
            currentProfile.buttons[currentNode.dataAttr.index].enabled = $("#editor-enabled").prop("checked");
            break;
    }
}

function UpdateItemNode(item, updateNode?) {
    if (!updateNode)
        updateNode = currentNode;
    else if (typeof updateNode == 'string')
        updateNode = $('#profile-tree').treeview('findNodes', ['^' + updateNode + "$", 'id'])[0];
    var selected = updateNode.state.selected || updateNode.id == currentNode.id;
    //clone node
    var newNode = cloneNode(updateNode);
    //only text or check state effect node
    newNode.text = GetDisplay(item);
    newNode.state.checked = item.enabled;
    //re-find node just in case
    //var node = $('#profile-tree').treeview('findNodes', ['^' + updateNode.id + "$", 'id'])[0];
    $('#profile-tree').treeview('updateNode', [updateNode, newNode]);
    if (selected) {
        updateNode = $('#profile-tree').treeview('findNodes', ['^' + updateNode.id + "$", 'id'])[0];
        $('#profile-tree').treeview('selectNode', [updateNode, { silent: true }]);
        if (updateNode.id == currentNode.id)
            currentNode = updateNode;
    }
    if (updateNode.id == currentNode.id)
        $("#editor-title").text(updateNode.dataAttr.type + ": " + updateNode.text)
}

function getEditorValue(editor, style: ItemStyle) {
    if (editors[editor]) {
        if (style == ItemStyle.Script)
            editors[editor].getSession().setMode("ace/mode/javascript");
        else
            editors[editor].getSession().setMode("ace/mode/text");
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

export function UpdateEditorMode(type) {
    if (editors[type + '-value']) {
        if ($("#" + type + "-style").val() == ItemStyle.Script)
            editors[type + '-value'].getSession().setMode("ace/mode/javascript");
        else
            editors[type + '-value'].getSession().setMode("ace/mode/text");
    }
}

function UpdateMacro(customUndo?: boolean): UpdateState {
    var data: any = UpdateItem(currentProfile.macros[currentNode.dataAttr.index], 'macro', { key: true });
    if (currentProfile.macros[currentNode.dataAttr.index].key != parseInt($("#macro-key").data('key'), 10)) {
        if (!data) data = {};
        data.key = currentProfile.macros[currentNode.dataAttr.index].key;
        currentProfile.macros[currentNode.dataAttr.index].key = parseInt($("#macro-key").data('key'), 10);
    }
    if (currentProfile.macros[currentNode.dataAttr.index].modifiers != parseInt($("#macro-key").data('mod'), 10)) {
        if (!data) data = {};
        data.modifiers = currentProfile.macros[currentNode.dataAttr.index].modifiers;
        currentProfile.macros[currentNode.dataAttr.index].modifiers = parseInt($("#macro-key").data('mod'), 10);
    }
    if (data) {
        UpdateItemNode(currentProfile.macros[currentNode.dataAttr.index]);
        $("#editor-title").text("Macro: " + GetDisplay(currentProfile.macros[currentNode.dataAttr.index]));
        if (!customUndo)
            pushUndo({ action: 'update', type: 'macro', item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

function UpdateAlias(customUndo?: boolean): UpdateState {
    var data: any = UpdateItem(currentProfile.aliases[currentNode.dataAttr.index]);
    if (data) {
        UpdateItemNode(currentProfile.aliases[currentNode.dataAttr.index]);
        $("#editor-title").text("Alias: " + GetDisplay(currentProfile.aliases[currentNode.dataAttr.index]));
        if (!customUndo)
            pushUndo({ action: 'update', type: 'alias', item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

function UpdateTrigger(customUndo?: boolean): UpdateState {
    var data: any = UpdateItem(currentProfile.triggers[currentNode.dataAttr.index]);
    if (data) {
        UpdateItemNode(currentProfile.triggers[currentNode.dataAttr.index]);
        $("#editor-title").text("Trigger: " + GetDisplay(currentProfile.triggers[currentNode.dataAttr.index]))
        if (!customUndo)
            pushUndo({ action: 'update', type: 'trigger', item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

function UpdateButton(customUndo?: boolean): UpdateState {
    var data: any = UpdateItem(currentProfile.buttons[currentNode.dataAttr.index]);
    if (data) {
        UpdateButtonSample();
        UpdateItemNode(currentProfile.buttons[currentNode.dataAttr.index]);
        $("#editor-title").text("Button: " + GetDisplay(currentProfile.buttons[currentNode.dataAttr.index]))
        if (!customUndo)
            pushUndo({ action: 'update', type: 'button', item: currentNode.dataAttr.index, profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

function UpdateItem(item, type?, options?) {
    var changed = 0;
    var data: any = {};
    if (typeof type === "object") {
        options = type;
        type = getType(item);
    }
    else if (!type)
        type = getType(item);
    if (!options) options = {};

    if (item.enabled != $("#editor-enabled").prop("checked")) {
        data.enabled = item.enabled;
        changed++;
        item.enabled = $("#editor-enabled").prop("checked");
    }
    for (var prop in item) {
        if (!item.hasOwnProperty(prop) || prop == "enabled") {
            continue;
        }
        var id = "#" + type + "-" + prop;
        if ($(id).length === 0 || options[prop])
            continue;
        else if ($(id).hasClass('selectpicker')) {
            if (item[prop] != parseInt($(id).selectpicker('val'), 10)) {
                data[prop] = item[prop];
                changed++;
                item[prop] = parseInt($(id).selectpicker('val'), 10);
            }
        }
        else if (typeof item[prop] == "boolean") {
            if (item[prop] != $(id).prop('checked')) {
                data[prop] = item[prop];
                changed++;
                item[prop] = $(id).prop('checked');
            }
        }
        else if (typeof item[prop] == "number") {
            if (item[prop] != parseInt($(id).val(), 10)) {
                data[prop] = item[prop];
                changed++;
                item[prop] = parseInt($(id).val(), 10);
            }
        }
        else if (editors[type + '-' + prop]) {
            var val = getEditorValue(type + '-' + prop, item.style);
            if (item[prop] != val) {
                data[prop] = item[prop];
                changed++;
                item[prop] = val;
            }
        }
        else {
            if (item[prop] != $(id).val()) {
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
    else if (typeof profile == "string")
        profile = profiles.items[profile]
    if (currentProfile.name == profile.name)
        $("#editor-title").text("Profile: " + profile.name);
    var val = profile.name;
    var node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(val) + "$", 'id'])[0];
    var selected = node.state.selected
    var expanded = node.state.expanded
    var newNode = newProfileNode(profile);
    //Rebuild child nodes based on current expand state and to update incase of name change
    for (var n = 0, nl = node.nodes.length; n < nl; n++) {
        if (node.nodes[n].length > 0) {
            if (!node.nodes[n].lazyLoad) {
                newNode.nodes[n].lazyLoad = false;
                var key = newNode.nodes[n].dataAttr.type;
                if (!newNode.nodes[n].nodes)
                    newNode.nodes[n].nodes = []
                for (var c = 0, cl = node.nodes[n].nodes.length; c < cl; c++) {
                    newNode.nodes[n].nodes.push(newItemNode(profile[key][c]));
                }
            }
        }
    }
    $('#profile-tree').treeview('updateNode', [node, newNode]);
    //re-select node to get the new object for proper data
    node = $('#profile-tree').treeview('findNodes', ['^' + newNode.id + "$", 'id'])[0];
    //if was selected re-select
    if (selected) {
        $('#profile-tree').treeview('selectNode', [node, { silent: true }]);
        currentNode = node;
    }
    //if expanded re-expand
    if (expanded)
        $('#profile-tree').treeview('expandNode', [node]);
}

function newItemNode(item, idx?: number, type?: string, profile?) {
    if (!profile)
        profile = currentProfile.name.toLowerCase();
    else if (typeof profile === "object")
        profile = profile.name.toLowerCase();
    if (!type)
        type = getType(item);
    else
        type = type.toLowerCase();
    var key = getKey(type);
    if (!idx && typeof idx !== "number")
        idx = profiles.items[profile][key].length;

    return {
        text: GetDisplay(item),
        id: "Profile" + profileID(profile) + key + idx,
        dataAttr: {
            type: type,
            profile: profile,
            index: idx
        },
        state: {
            checked: item.enabled,
        }
    }
}

function newProfileNode(profile?) {
    if (!profile)
        profile = currentProfile;
    else if (typeof profile === "string")
        profile = profiles.items[profile];
    if (!profile) return null;
    var id = "Profile" + profileID(profile.name);
    var key = profile.name.toLowerCase();
    return {
        text: profile.name,
        id: id,
        dataAttr: {
            type: 'profile',
            profile: key
        },
        state: {
            checked: profile.enabled
        },
        nodes: [
            {
                text: 'Aliases',
                id: id + "aliases",
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
                id: id + "macros",
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
                id: id + "triggers",
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
                id: id + "buttons",
                dataAttr: {
                    profile: key,
                    type: 'buttons'
                },
                lazyLoad: profile.buttons.length > 0,
                state: {
                    checked: profile.enableButtons
                },
                nodes: []
            }
        ]
    }
}

function cloneNode(node) {
    return cleanNode(clone(node));
}

function cleanNode(node) {
    delete node.$el;
    /*
    if (node.state)
    {
        node.state.selected = false;
    }
    */
    if (!node.nodes)
        return node;
    for (var n = 0, nl = node.nodes.length; n < nl; n++)
        node.nodes[n] = cleanNode(node.nodes[n]);
    return node;
}

function UpdateProfile(customUndo?: boolean): UpdateState {
    var data: any = {};
    var changed = 0;
    var val;

    var val = $("#profile-name").val();
    if (val != currentProfile.name) {
        data.name = val;
        changed++;

        if (profiles.contains(val)) {
            dialog.showMessageBox(remote.getCurrentWindow(), {
                type: 'error',
                title: 'Profile name already used',
                message: 'The name is already in use, pick a different one'
            });
            $("#profile-name").val(currentProfile.name);
            $("#profile-name").focus();
            return UpdateState.Error;
        }
        profiles.remove(currentProfile);
        currentProfile.name = val;
        profiles.add(currentProfile);
        $("#editor-title").text("Profile: " + currentProfile.name);

        var selected = currentNode.state.selected
        var expanded = currentNode.state.expanded

        var node = $('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id'])[0];
        $('#profile-tree').treeview('updateNode', [node, newProfileNode()]);
        node = $('#profile-tree').treeview('findNodes', ['^Profile' + val + "$", 'id'])[0];
        if (selected) {
            $('#profile-tree').treeview('selectNode', [node, { silent: true }]);
            currentNode = node;
        }
        if (expanded)
            $('#profile-tree').treeview('expandNode', [node]);
    }


    if (currentProfile.enableAliases != $("#profile-enableAliases").prop("checked")) {
        data.enableAliases = currentProfile.enableAliases;
        changed++;
        currentProfile.enableAliases = $("#profile-enableAliases").prop("checked");
    }
    if (currentProfile.enableMacros != $("#profile-enableMacros").prop("checked")) {
        data.enableMacros = currentProfile.enableMacros;
        changed++;
        currentProfile.enableMacros = $("#profile-enableMacros").prop("checked");
    }
    if (currentProfile.enableTriggers != $("#profile-enableTriggers").prop("checked")) {
        data.enableTriggers = currentProfile.enableTriggers;
        changed++;
        currentProfile.enableTriggers = $("#profile-enableTriggers").prop("checked");
    }
    if (currentProfile.enableButtons != $("#profile-enableButtons").prop("checked")) {
        data.enableButtons = currentProfile.enableButtons;
        changed++;
        currentProfile.enableButtons = $("#profile-enableButtons").prop("checked");
    }

    if (currentProfile.enabled != $("#editor-enabled").prop("checked")) {
        data.enabled = currentProfile.enabled;
        changed++;
        if (!$("#editor-enabled").prop("checked")) {
            if (profiles.canDisable(currentProfile))
                currentProfile.enabled = false;
            else {
                $("#editor-enabled").prop("checked", true);
                $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id'])]);
            }
        }
        else
            currentProfile.enabled = true;
    }

    if (currentProfile.priority != parseInt($("#profile-priority").val(), 10)) {
        data.priority = currentProfile.priority;
        changed++;
        currentProfile.priority = parseInt($("#profile-priority").val(), 10);
    }

    val = profileID(currentProfile.name);
    if (currentProfile.enableAliases)
        $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "aliases$", 'id'])]);
    else
        $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "aliases$", 'id'])]);
    if (currentProfile.enableMacros)
        $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "macros$", 'id'])]);
    else
        $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "macros$", 'id'])]);
    if (currentProfile.enableTriggers)
        $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "triggers$", 'id'])]);
    else
        $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "triggers$", 'id'])]);
    if (currentProfile.enableButtons)
        $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "buttons$", 'id'])]);
    else
        $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "buttons$", 'id'])]);

    if (changed > 0 && !customUndo) {
        pushUndo({ action: 'update', type: 'profile', profile: currentProfile.name.toLowerCase(), data: data });
        return UpdateState.Changed;
    }
    return UpdateState.NoChange;
}

export function updateProfileChecks() {
    _pUndo = true;
    var val = profileID(currentProfile.name);

    if ($("#profile-enableAliases").prop("checked"))
        $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "aliases$", 'id']), { silent: true }]);
    else
        $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "aliases$", 'id']), { silent: true }]);
    if ($("#profile-enableMacros").prop("checked"))
        $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "macros$", 'id']), { silent: true }]);
    else
        $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "macros$", 'id']), { silent: true }]);
    if ($("#profile-enableTriggers").prop("checked"))
        $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "triggers$", 'id']), { silent: true }]);
    else
        $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "triggers$", 'id']), { silent: true }]);
    if ($("#profile-enableButtons").prop("checked"))
        $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "buttons$", 'id']), { silent: true }]);
    else
        $("#profile-tree").treeview('uncheckNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + val + "buttons$", 'id']), { silent: true }]);
    _pUndo = false;
}

function nodeCheckChanged(event, node) {
    var changed = 1;
    var data: any = {};
    if (!node) return;
    var t = "profile";
    if (!node.dataAttr.type)
        t = $('#profile-tree').treeview('getParents', node)[0].dataAttr.type;
    else
        t = node.dataAttr.type;
    var profile = profiles.items[node.dataAttr.profile];
    switch (t) {
        case "profile":
            if (!node.state.checked) {
                if (profiles.canDisable(profile))
                    profile.enabled = node.state.checked;
                else {
                    $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^' + node.id + "$", 'id']), { silent: true }]);
                    changed = 0;
                }
            }
            else if (profile.enabled != node.state.checked)
                profile.enabled = node.state.checked;
            else
                changed = 0;
            data.enabled = profile.enabled;
            if (profile == currentProfile)
                $("#editor-enabled").prop("checked", profile.enabled);
            break;
        case "aliases":
            profile.enableAliases = node.state.checked;
            t = 'profile';
            data.enableAliases = node.state.checked;
            if (profile == currentProfile)
                $("#profile-enableAliases").prop("checked", node.state.checked);
            break;
        case "macros":
            profile.enableMacros = node.state.checked;
            t = 'profile';
            data.enableMacros = node.state.checked;
            if (profile == currentProfile)
                $("#profile-enableMacros").prop("checked", node.state.checked);
            break;
        case "triggers":
            profile.enableTriggers = node.state.checked;
            t = 'profile';
            data.enableTriggers = node.state.checked;
            if (profile == currentProfile)
                $("#profile-enableTriggers").prop("checked", node.state.checked);
            break;
        case "buttons":
            profile.enableButtons = node.state.checked;
            t = 'profile';
            data.enableButtons = node.state.checked;
            if (profile == currentProfile)
                $("#profile-enableButtons").prop("checked", node.state.checked);
            break;
        case "alias":
            profile.aliases[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id == currentNode.id)
                $("#editor-enabled").prop("checked", node.state.checked);
            break;
        case "macro":
            profile.macros[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id == currentNode.id)
                $("#editor-enabled").prop("checked", node.state.checked);
            break;
        case "trigger":
            profile.triggers[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id == currentNode.id)
                $("#editor-enabled").prop("checked", node.state.checked);
            break;
        case "button":
            profile.buttons[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id == currentNode.id)
                $("#editor-enabled").prop("checked", node.state.checked);
            break;
    }
    if (changed > 0)
        pushUndo({ action: 'update', type: t, item: node.dataAttr.index, profile: profile.name, data: data });
}

function resetClip() {
    if (_clip && _clip.data.length > 0 && _clip.action == 2) {
        for (var i = 0, il = _clip.data.length; i < il; i++) {
            var nodes = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(_clip.profile) + _clip.key + _clip.data[i], 'id']);
            nodes[0].$el.css('opacity', '');
        }
    }
    _clip = 0;
}

function canPaste() {
    if (_clip) {
        if (_clip.data.length === 1 && _clip.type == "macro") {
            var r = FilterArrayByKeyValue(currentProfile.macros, "key", _clip.data[0].key);
            r = FilterArrayByKeyValue(r, "modifiers", _clip.data[0].modifiers);
            if (r.length == 0)
                return true;
        }
        else
            return true;
    }
    return false;
}

function UpdatePaste() {
    $("#btn-paste").prop('disabled', !canPaste());
}

function getType(item) {
    if (item instanceof Alias)
        return "alias";
    if (item instanceof Button)
        return "button";
    if (item instanceof Trigger)
        return "trigger";
    if (item instanceof Macro)
        return "macro";
    if (item instanceof Context)
        return "context";
    return "profile";
}

function getKey(type: string) {
    switch (type) {
        case "alias":
        case "aliases":
            return "aliases";
        case "macro":
        case "macros":
            return "macros";
        case "trigger":
        case "triggers":
            return "triggers";
        case "button":
        case "buttons":
            return "buttons";
        case "context":
        case "contexts":
            return "contexts";
    }
}

function addProfile(profile: Profile) {
    profiles.add(profile);
    var n = profile.name;
    var ln = n.toLowerCase();
    _remove = _remove.filter(function (a) { return a !== n });
    $('#profile-tree').treeview('addNode', [newProfileNode(profile), false, false]);
}

export function doUndo() {
    if (_undo.length == 0)
        return;
    var action = _undo.pop();

    _pUndo = true;
    if (currentNode.id != action.data) {
        var s = $('#profile-tree').treeview('findNodes', ['^' + action.node + "$", 'id'])
        if (s.length > 0)
            $('#profile-tree').treeview('selectNode', s);
    }
    switch (action.action) {
        case 'add':
            if (action.type == "profile") {
                for (var p = 0, pl = action.item.length; p < pl; p++)
                    DeleteProfile(profiles.items[action.item[p]], true);
            }
            else
                DeleteItem(action.type, action.data.key, action.data.idx, profiles.items[action.data.profile], true);
            break;
        case 'delete':
            if (action.type == "profile")
                addProfile(action.item);
            else
                insertItem(action.type, action.data.key, action.item, action.data.idx, profiles.items[action.data.profile], true);
            break;
        case 'update':
            var current = {}
            if (action.type == "profile") {
                for (var prop in action.data) {
                    if (!action.data.hasOwnProperty(prop)) {
                        continue;
                    }
                    current[prop] = profiles.items[action.profile][prop];
                    profiles.items[action.profile][prop] = action.data[prop];
                }
                UpdateProfileNode(profiles.items[action.profile]);
                var t = currentNode.dataAttr.type;
                if (t == "profile" || t == "aliases" || t == "triggers" || t == "buttons" || t == "macros" || t == "contexts") {
                    UpdateEditor("profile", currentProfile, {
                        post: () => {
                            if (currentProfile.name == "Default") {
                                $("#profile-name").prop('disabled', true);
                                if (t == "profile") {
                                    $("#btn-cut").prop('disabled', true);
                                    $("#btn-delete").prop('disabled', true);
                                }
                            }
                            else
                                $("#profile-name").prop('disabled', false);

                            if (t != "profile" && currentProfile[t].length == 0) {
                                $("#btn-copy").prop('disabled', true);
                                $("#btn-cut").prop('disabled', true);
                                $("#btn-delete").prop('disabled', true);
                            }
                            else if (t == "profile")
                                $("#btn-cut").prop('disabled', true);
                        }
                    });
                }
            }
            else {
                var key = getKey(action.type);
                for (var prop in action.data) {
                    if (!action.data.hasOwnProperty(prop)) {
                        continue;
                    }
                    current[prop] = profiles.items[action.profile][key][action.item][prop];
                    profiles.items[action.profile][key][action.item][prop] = action.data[prop];
                }
                UpdateItemNode(currentProfile[key][action.item], 'Profile' + profileID(action.profile) + key + action.item);
                if (currentNode.id == 'Profile' + profileID(action.profile) + key + action.item) {
                    switch (action.type) {
                        case "alias":
                            UpdateEditor('alias', profiles.items[action.profile][key][action.item]);
                            break;
                        case "macro":
                            UpdateEditor('macro', profiles.items[action.profile][key][action.item], { key: MacroValue });
                            break;
                        case "trigger":
                            UpdateEditor('trigger', profiles.items[action.profile][key][action.item], { post: clearTriggerTester });
                            break;
                        case "button":
                            UpdateEditor('button', profiles.items[action.profile][key][action.item], { post: UpdateButtonSample });
                            break;
                    }
                }
            }
            action.data = current;
            break;
        case 'group':
            var i, il, item;
            if (action.add.length > 0) {
                for (i = 0, il = action.add.length; i < il; i++) {
                    item = action.add[i];
                    if (item.type == "profile") {
                        for (var p = 0, pl = item.item.length; p < pl; p++)
                            DeleteProfile(profiles.items[item.item[p]], true);
                    }
                    else
                        DeleteItem(item.type, item.data.key, item.data.idx, profiles.items[item.data.profile], true);
                }
            }
            if (action.delete.length > 0) {
                for (i = 0, il = action.add.length; i < il; i++) {
                    item = action.add[i];
                    if (item.type == "profile")
                        addProfile(item.item);
                    else
                        insertItem(item.type, item.data.key, item.item, item.data.idx, profiles.items[item.data.profile], true);
                }
            }
            break;
        case 'reset':
            var name = action.profile.name.toLowerCase();
            var id = profileID(action.profile.name);
            var oldProfile = profiles.items[name];
            profiles.items[name] = action.profile;
            var node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(id) + "$", 'id'])[0];
            var newNode = newProfileNode(action.profile);
            var selected = node.state.selected
            var expanded = node.state.expanded
            $('#profile-tree').treeview('updateNode', [node, newNode]);
            //re-select node to get the new object for proper data
            node = $('#profile-tree').treeview('findNodes', ['^' + newNode.id + "$", 'id'])[0];
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
    /*
    action: 'add', type: 'profile', item: string[]
    action: 'add', type: type.toLowerCase(), item: item.clone(), data: { type: type, key: key, item: item, idx: idx, profile: profile.name.toLowerCase() } 

    action: 'delete', type: 'profile', item: profile
    action: 'delete', type: type, data: { key: key, idx: idx, profile: profile.name.toLowerCase() }, item: profile[key][idx]

    action: 'update', type: 'profile', profile: currentProfile.name, data: { enabled: currentProfile.enabled }
    action: 'update', type: 'profile', profile: currentProfile.name, data: { enabled: currentProfile.enabled } 
    action: 'update', type: 'profile', profile: currentProfile.name, data: data

    action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name, data: { enabled: currentProfile.aliases[currentNode.dataAttr.index].enabled }
    action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name, data: { enabled: currentProfile.macros[currentNode.dataAttr.index].enabled }
    action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name, data: { enabled: currentProfile.triggers[currentNode.dataAttr.index].enabled }
    action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name, data: { enabled: currentProfile.buttons[currentNode.dataAttr.index].enabled }
    action: 'update', type: t, item: node.dataAttr.index, profile: profile.name, data: data
    
    action: 'update', type: 'macro', item: currentNode.dataAttr.index, profile: currentProfile.name, data: data
    action: 'update', type: 'alias', item: currentNode.dataAttr.index, profile: currentProfile.name, data: data
    action: 'update', type: 'trigger', item: currentNode.dataAttr.index, profile: currentProfile.name, data: data
    action: 'update', type: 'button', item: currentNode.dataAttr.index, profile: currentProfile.name, data: data
    
    
    
    action: 'group', add: [
        { type: _clip.type, item: item.clone(), data: { type: _clip.type, key: _clip.key, item: item, idx: profile[_clip.key].length, profile: profile.name.toLowerCase() } },
        ...
    ], delete: [
        { type: _clip.type, item: item.clone(), data: { type: _clip.type, key: _clip.key, item: item, idx: _clip.data[i], profile: source.name.toLowerCase() } }, 
        ...        
    ]
    action: 'group', add: [], delete: [
        { type: type, item: profile[key][i].clone(), data: { type: type, key: key, item: profile[key][i].clone(), idx: i, profile: profile.name.toLowerCase() } }
        ...
    ]
    action: 'group', add: [
        { type: "macro", item: m[i].clone(), data: { type: "macro", key: "macros", item: m[i].clone(), idx: profile["macros"].length, profile: profile.name.toLowerCase() } },
        ...
    ], delete: []
    
    action: 'reset', type: "profile", profile: profile.clone()
    */
}

export function doRedo() {
    if (_redo.length == 0)
        return;
    var action = _redo.pop();

    _pUndo = true;
    if (currentNode.id != action.data) {
        var s = $('#profile-tree').treeview('findNodes', ['^' + action.node + "$", 'id'])
        if (s.length > 0)
            $('#profile-tree').treeview('selectNode', s);
    }
    switch (action.action) {
        case 'add':
            if (action.type == "profile") {
                for (var p = 0, pl = action.item.length; p < pl; p++)
                    addProfile(profiles.items[action.item[p]]);
            }
            else
                insertItem(action.type, action.data.key, action.item, action.data.idx, profiles.items[action.data.profile], true);
            break;
        case 'delete':
            if (action.type == "profile")
                DeleteProfile(action.item, true);
            else
                DeleteItem(action.type, action.data.key, action.data.idx, profiles.items[action.data.profile], true);
            break;
        case 'update':
            var current = {}
            if (action.type == "profile") {
                for (var prop in action.data) {
                    if (!action.data.hasOwnProperty(prop)) {
                        continue;
                    }
                    current[prop] = profiles.items[action.profile][prop];
                    profiles.items[action.profile][prop] = action.data[prop];
                }
                UpdateProfileNode(profiles.items[action.profile]);
                var t = currentNode.dataAttr.type;
                if (t == "profile" || t == "aliases" || t == "triggers" || t == "buttons" || t == "macros" || t == "contexts") {
                    UpdateEditor("profile", currentProfile, {
                        post: () => {
                            if (currentProfile.name == "Default") {
                                $("#profile-name").prop('disabled', true);
                                if (t == "profile") {
                                    $("#btn-cut").prop('disabled', true);
                                    $("#btn-delete").prop('disabled', true);
                                }
                            }
                            else
                                $("#profile-name").prop('disabled', false);

                            if (t != "profile" && currentProfile[t].length == 0) {
                                $("#btn-copy").prop('disabled', true);
                                $("#btn-cut").prop('disabled', true);
                                $("#btn-delete").prop('disabled', true);
                            }
                            else if (t == "profile")
                                $("#btn-cut").prop('disabled', true);
                        }
                    });
                }
            }
            else {
                var key = getKey(action.type);
                for (var prop in action.data) {
                    if (!action.data.hasOwnProperty(prop)) {
                        continue;
                    }
                    current[prop] = profiles.items[action.profile][key][action.item][prop];
                    profiles.items[action.profile][key][action.item][prop] = action.data[prop];
                }
                UpdateItemNode(currentProfile[key][action.item], 'Profile' + profileID(action.profile) + key + action.item);
                if (currentNode.id == 'Profile' + profileID(action.profile) + key + action.item) {
                    switch (action.type) {
                        case "alias":
                            UpdateEditor('alias', profiles.items[action.profile][key][action.item]);
                            break;
                        case "macro":
                            UpdateEditor('macro', profiles.items[action.profile][key][action.item], { key: MacroValue });
                            break;
                        case "trigger":
                            UpdateEditor('trigger', profiles.items[action.profile][key][action.item], { post: clearTriggerTester });
                            break;
                        case "button":
                            UpdateEditor('button', profiles.items[action.profile][key][action.item], { post: UpdateButtonSample });
                            break;
                    }
                }
            }
            action.data = current;
            break;
        case 'group':
            var i, il, item;
            if (action.delete.length > 0) {
                for (i = 0, il = action.add.length; i < il; i++) {
                    item = action.add[i];
                    if (item.type == "profile") {
                        for (var p = 0, pl = item.item.length; p < pl; p++)
                            DeleteProfile(profiles.items[item.item[p]], true);
                    }
                    else
                        DeleteItem(item.type, item.data.key, item.data.idx, profiles.items[item.data.profile], true);
                }
            }
            if (action.add.length > 0) {
                for (i = 0, il = action.add.length; i < il; i++) {
                    item = action.add[i];
                    if (item.type == "profile")
                        addProfile(item.item);
                    else
                        insertItem(item.type, item.data.key, item.item, item.data.idx, profiles.items[item.data.profile], true);
                }
            }
        case 'reset':
            var name = action.profile.name.toLowerCase();
            var id = profileID(action.profile.name);
            var oldProfile = profiles.items[name];
            profiles.items[name] = action.profile;
            var node = $('#profile-tree').treeview('findNodes', ['^Profile' + profileID(id) + "$", 'id'])[0];
            var newNode = newProfileNode(action.profile);
            var selected = node.state.selected
            var expanded = node.state.expanded
            $('#profile-tree').treeview('updateNode', [node, newNode]);
            //re-select node to get the new object for proper data
            node = $('#profile-tree').treeview('findNodes', ['^' + newNode.id + "$", 'id'])[0];
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
    var data;
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    resetClip();
    var profile = profiles.items[node.dataAttr.profile];
    var t = "profile", nodes;
    if (!node.dataAttr.type)
        t = node.text.toLowerCase();
    else
        t = node.dataAttr.type;
    switch (t) {
        case "aliases":
            data = [];
            for (var i = 0, il = profile.aliases.length; i < il; i++)
                data.push(i);
            _clip = { type: "alias", data: data, key: "aliases" };
            nodes = $('#profile-tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
            for (var n = 0, nl = nodes.length; n < nl; n++)
                nodes[n].$el.css('opacity', '0.5');
            break;
        case "alias":
            _clip = { type: t, data: [node.dataAttr.index], key: "aliases", idx: node.dataAttr.index };
            node.$el.css('opacity', '0.5');
            break;
        case "macros":
            data = [];
            for (var i = 0, il = profile.macros.length; i < il; i++)
                data.push(i);
            _clip = { type: "macro", data: data, key: "macros" };
            nodes = $('#profile-tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
            for (var n = 0, nl = nodes.length; n < nl; n++)
                nodes[n].$el.css('opacity', '0.5');
            break;
        case "macro":
            _clip = { type: t, data: [node.dataAttr.index], key: "macros", idx: node.dataAttr.index };
            node.$el.css('opacity', '0.5');
            break;
        case "triggers":
            data = [];
            for (var i = 0, il = profile.triggers.length; i < il; i++)
                data.push(i);
            _clip = { type: "trigger", data: data, key: "triggers" };
            nodes = $('#profile-tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
            for (var n = 0, nl = nodes.length; n < nl; n++)
                nodes[n].$el.css('opacity', '0.5');
            break;
        case "trigger":
            _clip = { type: t, data: [node.dataAttr.index], key: "triggers", idx: node.dataAttr.index };
            node.$el.css('opacity', '0.5');
            break;
        case "buttons":
            data = [];
            for (var i = 0, il = profile.buttons.length; i < il; i++)
                data.push(i);
            _clip = { type: "button", data: data, key: "buttons" };
            nodes = $('#profile-tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
            for (var n = 0, nl = nodes.length; n < nl; n++)
                nodes[n].$el.css('opacity', '0.5');
            break;
        case "button":
            _clip = { type: t, data: [node.dataAttr.index], key: "buttons", idx: node.dataAttr.index };
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
    var data;
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    resetClip();
    var t = "profile", nodes;
    var profile = profiles.items[node.dataAttr.profile];
    if (!node.dataAttr.type)
        t = node.text.toLowerCase();
    else
        t = node.dataAttr.type;
    switch (t) {
        case "profile":
            profile = profile.clone();
            profile.name = profileCopyName(profile.name);
            profiles.add(profile);
            $('#profile-tree').treeview('addNode', [newProfileNode(profile), false, false]);
            pushUndo({ action: 'add', type: 'profile', item: [profile.name.toLowerCase()] });
            break;
        case "aliases":
            data = [];
            for (var i = 0, il = profile.aliases.length; i < il; i++)
                data.push(profile.aliases[i].clone());
            _clip = { type: "alias", data: data, key: "aliases" };
            break;
        case "alias":
            _clip = { type: t, data: [profile.aliases[node.dataAttr.index].clone()], key: "aliases", idx: node.dataAttr.index };
            break;
        case "macros":
            data = [];
            for (var i = 0, il = profile.macros.length; i < il; i++)
                data.push(profile.macros[i].clone());
            _clip = { type: "macro", data: data, key: "macros" };
            break;
        case "macro":
            _clip = { type: t, data: [profile.macros[node.dataAttr.index].clone()], key: "macros", idx: node.dataAttr.index };
            break;
        case "triggers":
            data = [];
            for (var i = 0, il = profile.triggers.length; i < il; i++)
                data.push(profile.triggers[i].clone());
            _clip = { type: "trigger", data: data, key: "triggers" };
            break;
        case "trigger":
            _clip = { type: t, data: [profile.triggers[node.dataAttr.index].clone()], key: "triggers", idx: node.dataAttr.index };
            break;
        case "buttons":
            data = [];
            for (var i = 0, il = profile.buttons.length; i < il; i++)
                data.push(profile.buttons[i].clone());
            _clip = { type: "button", data: data, key: "buttons" };
            break;
        case "button":
            _clip = { type: t, data: [profile.buttons[node.dataAttr.index].clone()], key: "buttons", idx: node.dataAttr.index };
            break;
    }
    if (_clip) {
        _clip.profile = profile.name.toLowerCase();
        _clip.action = 1;
    }
    UpdatePaste();
}

export function doPaste(node?) {
    if (!_clip || _clip.data.length == 0) return;
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    var _paste = { action: 'group', add: [], delete: [] };
    var profile = profiles.items[node.dataAttr.profile];
    var source = profiles.items[_clip.profile];
    var item;
    for (var i = 0, il = _clip.data.length; i < il; i++) {
        if (_clip.action == 1)
            item = _clip.data[i].clone();
        else
            item = source[_clip.key][_clip.data[i]].clone();
        _paste.add.push({ type: _clip.type, item: item.clone(), data: { type: _clip.type, key: _clip.key, item: item, idx: profile[_clip.key].length, profile: profile.name.toLowerCase() } });
        addItem(_clip.type, _clip.key, item, profile[_clip.key].length, profile, true);
    }

    if (_clip.action == 2) {
        for (var i = 0, il = _clip.data.length; i < il; i++) {
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
    var t
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    resetClip();
    node.state.selected = false;
    t = "profile";
    if (!node.dataAttr.type)
        t = node.text.toLowerCase();
    else
        t = node.dataAttr.type;
    switch (t) {
        case "profile":
            DeleteProfileConfirm(profiles.items[node.dataAttr.profile]);
            break;
        case "aliases":
            DeleteItems("alias", "aliases", profiles.items[node.dataAttr.profile]);
            break;
        case "alias":
            DeleteItemConfirm("alias", "aliases", node.dataAttr.index, profiles.items[node.dataAttr.profile]);
            break;
        case "macros":
            DeleteItems("macro", "macros", profiles.items[node.dataAttr.profile]);
            break;
        case "macro":
            DeleteItemConfirm("macro", "macros", node.dataAttr.index, profiles.items[node.dataAttr.profile]);
            break;
        case "triggers":
            DeleteItems("trigger", "triggers", profiles.items[node.dataAttr.profile]);
            break;
        case "trigger":
            DeleteItemConfirm("trigger", "triggers", node.dataAttr.index, profiles.items[node.dataAttr.profile]);
            break;
        case "buttons":
            DeleteItems("button", "buttons", profiles.items[node.dataAttr.profile]);
            break;
        case "button":
            DeleteItemConfirm("button", "buttons", node.dataAttr.index, profiles.items[node.dataAttr.profile]);
            break;
    }
}
function updateCurrent(): UpdateState {
    if (currentNode && _loading == 0) {
        //currentNode.state.selected = false;
        var t = "profile";
        if (!currentNode.dataAttr.type)
            t = $('#profile-tree').treeview('getParents', currentNode)[0].dataAttr.type;
        else
            t = currentNode.dataAttr.type;
        switch (t) {
            case "aliases":
            case "macros":
            case "triggers":
            case "buttons":
            case "profile":
                return UpdateProfile();
            case "alias":
                return UpdateAlias();
            case "macro":
                return UpdateMacro();
            case "trigger":
                return UpdateTrigger();
            case "button":
                return UpdateButton();
        }
    }
    return UpdateState.NoChange;
}

function buildTreeview(data) {
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
        onNodeRendered: function (event, node) {
            node.$el.prop('title', node.text);;
        },
        onNodeUnchecked: nodeCheckChanged,
        onNodeChecked: nodeCheckChanged,
        onNodeSelected: function (event, node) {
            var t
            if (updateCurrent() == UpdateState.Error && currentNode) {
                $('#profile-tree').treeview('selectNode', [currentNode, { silent: true }]);
                return;
            }
            if (!node) return;
            _loading++;
            t = "profile";
            if (!node.dataAttr.type)
                t = $('#profile-tree').treeview('getParents', node)[0].dataAttr.type;
            else
                t = node.dataAttr.type;
            currentNode = node;
            currentProfile = profiles.items[node.dataAttr.profile];
            $("#btn-cut").prop('disabled', false);
            $("#btn-copy").prop('disabled', false);
            $("#btn-delete").prop('disabled', false);
            UpdatePaste();
            switch (t) {
                case "aliases":
                case "macros":
                case "triggers":
                case "buttons":
                case "profile":
                    UpdateEditor("profile", currentProfile, {
                        post: () => {
                            if (currentProfile.name == "Default") {
                                $("#profile-name").prop('disabled', true);
                                if (t == "profile") {
                                    $("#btn-cut").prop('disabled', true);
                                    $("#btn-delete").prop('disabled', true);
                                }
                            }
                            else
                                $("#profile-name").prop('disabled', false);

                            if (t != "profile" && currentProfile[t].length == 0) {
                                $("#btn-copy").prop('disabled', true);
                                $("#btn-cut").prop('disabled', true);
                                $("#btn-delete").prop('disabled', true);
                            }
                            else if (t == "profile")
                                $("#btn-cut").prop('disabled', true);
                        }
                    });
                    break;
                case "alias":
                    UpdateEditor('alias', currentProfile.aliases[node.dataAttr.index]);
                    break;
                case "macro":
                    UpdateEditor('macro', currentProfile.macros[node.dataAttr.index], { key: MacroValue });
                    break;
                case "trigger":
                    UpdateEditor('trigger', currentProfile.triggers[node.dataAttr.index], { post: clearTriggerTester });
                    break;
                case "button":
                    UpdateEditor('button', currentProfile.buttons[node.dataAttr.index], { post: UpdateButtonSample });
                    break;
            }
            _loading--;
        },
        onNodeUnselected: function (event, node) {

        },
        lazyLoad: function (node, add) {
            var parent = $('#profile-tree').treeview('getParents', node)[0];
            var nodes = [];
            var item, n, t, i, il = profiles.items[parent.dataAttr.profile][node.text.toLowerCase()].length;
            if (node.text == "Aliases")
                t = "alias";
            else
                t = node.text.substr(0, node.text.length - 1).toLowerCase();
            for (i = 0; i < il; i++)
                nodes.push(newItemNode(profiles.items[parent.dataAttr.profile][node.dataAttr.type][i], i, t, parent.dataAttr.profile));
            add(nodes);
            if (_clip && _clip.action == 2 && _clip.key == node.text.toLowerCase()) {
                for (i = 0, il = _clip.data.length; i < il; i++) {
                    n = $('#profile-tree').treeview('findNodes', ['^' + node.id + i, 'id']);
                    n[0].$el.css('opacity', '0.5');
                }
            }
        },
        data: data,
        onInitialized: function (event, nodes) {
            if (!currentNode) {
                var nodes = $('#profile-tree').treeview('findNodes', ['^Profiledefault$', 'id']);
                $('#profile-tree').treeview('expandNode', [nodes]);
                $('#profile-tree').treeview('selectNode', [nodes]);
            }
        }
    });
}

function getProfileData() {
    var data = [newProfileNode('default')];

    for (var profile in profiles.items) {
        if (profile == 'default') continue;
        data.push(newProfileNode(profile));
    }
    return data;
}

export function init() {
    var options = Settings.load(path.join(parseTemplate("{data}"), 'settings.json'));
    _never = options.profiles.askoncancel;

    var p = path.join(parseTemplate("{data}"), "profiles");
    if (!fs.existsSync(p)) {
        profiles.add(Profile.Default);
    }
    else {
        profiles.load(p);
        if (!profiles.contains('default'))
            profiles.add(Profile.Default);
        watcher = fs.watch(p, (type, file) => {
            filesChanged = true;
            $('#btn-refresh').addClass('btn-warning');
        })
    }

    buildTreeview(getProfileData());
    $("#profile-tree").contextmenu((event) => {
        event.preventDefault();
        event.stopPropagation();
        event.cancelBubble = true;
        var nodeId = $(event.target).closest('li.list-group-item').attr('data-nodeId');
        var nodes = $('#profile-tree').treeview('findNodes', ['^' + nodeId + '$', 'nodeId']);
        var c = new Menu();
        if (!nodes || nodes.length == 0) {
            c.append(new MenuItem({
                label: 'Add empty profile', click() {
                    AddNewProfile();
                }
            }));
            c.append(new MenuItem({
                label: 'Add profile with defaults', click() {
                    AddNewProfile(true);
                }
            }));
        }
        else {
            var t = "profile";
            if (!nodes[0].dataAttr.type)
                t = $('#profile-tree').treeview('getParents', nodes[0])[0].dataAttr.type;
            else
                t = nodes[0].dataAttr.type;
            var profile = profiles.items[nodes[0].dataAttr.profile];

            switch (t) {
                case "profile":
                    c.append(new MenuItem({
                        label: 'Add empty profile', click() {
                            AddNewProfile();
                        }
                    }));
                    c.append(new MenuItem({
                        label: 'Add profile with defaults', click() {
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
                    if (profile.name != "Default") {
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
                case "aliases":
                case "alias":
                    c.append(new MenuItem({
                        label: 'Add alias', click() {
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
                case "macros":
                case "macro":
                    c.append(new MenuItem({
                        label: 'Add macro', click() {
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
                case "triggers":
                case "trigger":
                    c.append(new MenuItem({
                        label: 'Add trigger', click() {
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
                case "buttons":
                case "button":
                    c.append(new MenuItem({
                        label: 'Add button', click() {
                            addItem('Button', 'buttons', new Button())
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
            }
        }
        c.popup(remote.getCurrentWindow());
    });

    $('#drag-bar').mousedown(function (e) {
        e.preventDefault();

        dragging = true;
        var main = $('#content');
        var ghostBar = $('<div>',
            {
                id: 'ghost-bar',
                css: {
                    height: main.outerHeight(),
                    top: main.offset().top,
                    left: main.offset().left - 3
                }
            }).appendTo('body');

        $(document).mousemove(function (e) {
            if (e.pageX < 199)
                ghostBar.css("left", 199);
            else if (e.pageX > document.body.clientWidth - 300)
                ghostBar.css("left", document.body.clientWidth - 300);
            else
                ghostBar.css("left", e.pageX);
        });

    });

    $(window).on('resize', () => {
        if ($('#content').outerWidth() < 300 && $("#sidebar").outerWidth() > 202) {
            $('#sidebar').css("width", document.body.clientWidth - 300);
            $('#content').css("left", document.body.clientWidth - 300);
            ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: document.body.clientWidth - 300 });
        }
    });

    $(document).mouseup(function (e) {
        if (dragging) {
            if (e.pageX < 200) {
                $('#sidebar').css("width", 202);
                $('#content').css("left", 202);
                ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: 202 });
            }
            else if (e.pageX > document.body.clientWidth - 200) {
                $('#sidebar').css("width", document.body.clientWidth - 300);
                $('#content').css("left", document.body.clientWidth - 300);
                ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: document.body.clientWidth - 300 });
            }
            else {
                $('#sidebar').css("width", e.pageX + 2);
                $('#content').css("left", e.pageX + 2);
                ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: e.pageX + 2 });
            }

            $('#ghost-bar').remove();
            $(document).unbind('mousemove');
            dragging = false;
        }
    });

    if (options.profiles.split > 200) {
        $('#sidebar').css("width", options.profiles.split);
        $('#content').css("left", options.profiles.split);
    }

    $("#btn-add-dropdown").click(function () {
        $(this).addClass('open');
        var pos = $(this).offset();
        var x = Math.floor(pos.left);
        var y = Math.floor(pos.top + $(this).outerHeight() + 2);
        addMenu.popup(remote.getCurrentWindow(), x, y);
    });

    $("#macro-key").keydown(function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });

    $("#macro-key").keypress(function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
    $("#macro-key").keyup(function (e) {
        e.preventDefault();
        e.stopPropagation();
        var c = [];
        var mod = MacroModifiers.None;

        if (e.ctrlKey) {
            c.push("Ctrl");
            mod |= MacroModifiers.Ctrl;
        }
        if (e.altKey) {
            c.push("Alt");
            mod |= MacroModifiers.Alt;
        }
        if (e.shiftKey) {
            c.push("Shift");
            mod |= MacroModifiers.Shift;
        }
        if (e.metaKey) {
            mod |= MacroModifiers.Meta;
            if (process.platform == "darwin")
                c.push("Cmd");
            else
                c.push("Win");
        }
        if (keyCodeToChar[e.which])
            c.push(keyCodeToChar[e.which]);
        else
            return false;
        $("#macro-key").val(c.join("+"));
        $("#macro-key").data('key', e.which);
        $("#macro-key").data('mod', mod);
        UpdateMacro();
        return false;
    })

    $(".btn-adv").click(function () {
        var editor = $(this).closest('.panel-body').attr('id');
        var state = $(this).data("open");
        state = !state;
        $(this).data("open", state);
        var panel = $(this).closest(".panel-body");
        var icon = $(this).find("i");
        var panels = panel.find(".panel-adv-body");

        if (state) {
            panels.css('display', 'table-row');
            icon.addClass('fa-chevron-down');
            icon.removeClass('fa-chevron-up');
            $(this).parent().css('padding-bottom', '15px');
            $(this).closest("table").css('min-height', '342px');
            ipcRenderer.send('setting-changed', { type: 'profiles', name: getKey(editor.substr(0, editor.length - 7)) + 'Advanced', value: true });
        }
        else {
            panels.css('display', '');
            icon.addClass('fa-chevron-up');
            icon.removeClass('fa-chevron-down');
            $(this).parent().css('padding-bottom', '');
            $(this).closest("table").css('min-height', '');
            ipcRenderer.send('setting-changed', { type: 'profiles', name: getKey(editor.substr(0, editor.length - 7)) + 'Advanced', value: false });
        }
    });

    if (options.profiles.triggersAdvanced)
        $("#trigger-editor .btn-adv").click();
    if (options.profiles.aliasesAdvanced)
        $("#alias-editor .btn-adv").click();
    if (options.profiles.buttonsAdvanced)
        $("#button-editor .btn-adv").click();
    if (options.profiles.macrosAdvanced)
        $("#macro-editor .btn-adv").click();

    ['cut', 'copy', 'paste'].forEach(function (event) {
        document.addEventListener(event, function (e) {
            if (document.activeElement && (document.activeElement.tagName == "INPUT" || document.activeElement.tagName == "TEXTAREA"))
                return;
            if (event == "cut")
                doCut();
            else if (event == "copy")
                doCopy();
            else if (event == "paste")
                doPaste();
        });
    });

    loadActions(parseTemplate(path.join("{assets}", "actions")), "");

    initEditor("trigger-value");
    initEditor("macro-value");
    initEditor("alias-value");
    initEditor("button-value");

    window.onbeforeunload = function () {
        if (close || _never || (_undo.length == 0 && updateCurrent() == UpdateState.NoChange))
            return;
        var choice = dialog.showMessageBox(
            remote.getCurrentWindow(),
            {
                type: 'warning',
                title: 'Profiles changed',
                message: 'All unsaved changes will be lost, close?',
                buttons: ['Yes', 'No', 'Never ask again'],
                defaultId: 1
            });
        if (choice === 2) {
            ipcRenderer.send('setting-changed', { type: 'profiles', name: 'askoncancel', value: false });
            choice = 0;
        }
        if (choice === 0)
            return;
        return '';
    }

    document.onkeydown = undoKeydown;
    $("input,textarea").on("keydown", undoKeydown);

    $("select").on('focus', function () {
        // Store the current value on focus and on change
        $(this).data('previous-value', this.value);
    }).change(function () {
        updateCurrent();
        $(this).data('previous-value', this.value);
    });

    $("input[type='text'],input[type='number'],textarea").on('keydown', function () {
        $(this).data('previous-value', this.value);
    }).on('keyup', function () {
        updateCurrent();
        $(this).data('previous-value', this.value);
    });

    $("input[type='number']").on('focus', function () {
        // Store the current value on focus and on change
        $(this).data('previous-value', this.value);
    }).change(function () {
        updateCurrent();
        $(this).data('previous-value', this.value);
    });

    $("input[type=checkbox]").on('focus', function () {
        // Store the current value on focus and on change
        $(this).data('previous-value', this.checked);
    }).change(function () {
        updateCurrent();
        $(this).data('previous-value', this.checked);
    });
    addInputContext();
}

function undoKeydown(e) {
    if (e.which == 90 && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        doUndo();
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
    else if (e.which == 89 && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
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

function loadActions(p, root) {
    var files = fs.readdirSync(p);
    files.sort(function (a, b) { return sortFiles(a, b, p) });
    for (var f = 0, fl = files.length; f < fl; f++) {
        if (fs.lstatSync(path.join(p, files[f])).isDirectory())
            loadActions(path.join(p, files[f]), path.join(root, files[f]));
        else
            $("#button-actions-dropdown").append('<li title="' + path.basename(files[f], path.extname(files[f])) + '"><a href="#" onclick="profileUI.setIcon(\'' + path.join(root, files[f]).replace(/\\/g, '\\\\') + '\')"><img class="action-icon" src="' + path.join(p, files[f]) + '"><div class="overlay"></div></a></li>');
    }
}

export function setIcon(icon) {
    $('#button-icon').keydown().val(path.join("{assets}", "actions", icon)).keyup();
    UpdateButtonSample();
}

export function doRefresh() {
    if (_undo.length > 0)
        dialog.showMessageBox(remote.getCurrentWindow(), {
            type: 'warning',
            title: 'Refresh profiles',
            message: 'All unsaved or applied changes will be lost, refresh?',
            buttons: ['Yes', 'No'],
            defaultId: 1,
        }, (response) => {
            if (response == 0) {
                filesChanged = false;
                resetUndo();
                profiles = new ProfileCollection();
                $('#btn-refresh').removeClass('btn-warning');
                var p = path.join(parseTemplate("{data}"), "profiles");
                if (!fs.existsSync(p)) {
                    profiles.add(Profile.Default);
                }
                else {
                    profiles.load(p);
                    if (!profiles.contains('default'))
                        profiles.add(Profile.Default);
                    if (watcher)
                        watcher.close();
                    watcher = fs.watch(p, (type, file) => {
                        filesChanged = true;
                        $('#btn-refresh').addClass('btn-warning');
                    });
                }
                buildTreeview(getProfileData());
            }
        });
    else {
        filesChanged = false;
        resetUndo();
        profiles = new ProfileCollection();
        $('#btn-refresh').removeClass('btn-warning');
        var p = path.join(parseTemplate("{data}"), "profiles");
        if (!fs.existsSync(p)) {
            profiles.add(Profile.Default);
        }
        else {
            profiles.load(p);
            if (!profiles.contains('default'))
                profiles.add(Profile.Default);
            if (watcher)
                watcher.close();
            watcher = fs.watch(p, (type, file) => {
                filesChanged = true;
                $('#btn-refresh').addClass('btn-warning');
            });
        }
        buildTreeview(getProfileData());
    }
}

function profileCopyName(name) {
    var i = 0, n = name;
    while (profiles.contains(n)) {
        if (i === 0)
            n = name + " Copy";
        else
            n = name + " Copy (" + i + ")";
        i++;
    }
    return n;
}

function importProfiles() {
    dialog.showOpenDialog({
        filters: [
            { name: 'Text files (*.txt)', extensions: ['txt'] },
            { name: 'All files (*.*)', extensions: ['*'] },
        ]
    },
        function (fileNames) {
            if (fileNames === undefined || fileNames.length == 0) {
                return;
            }
            for (var f = 0, fl = fileNames.length; f < fl; f++)
                fs.readFile(fileNames[f], (err, data) => {
                    if (err) throw err;
                    data = JSON.parse(data);
                    if (!data || data.version != 2) {
                        dialog.showMessageBox(remote.getCurrentWindow(), {
                            type: 'error',
                            title: 'Invalid Profile',
                            message: 'Invalid profile unable to process.'
                        });
                        return;
                    }
                    ipcRenderer.send('set-progress', { value: 0.5, options: { mode: 'indeterminate' } });
                    if (data.profiles) {
                        var names = [];
                        var keys = Object.keys(data.profiles);
                        var n, k = 0, kl = keys.length;
                        var item: (Alias | Button | Macro | Trigger | Context);
                        for (; k < kl; k++) {
                            n = profileCopyName(keys[k]);
                            names.push(n);
                            var p = new Profile(n.true);
                            p.priority = data.profiles[keys[k]].priority;
                            p.enabled = data.profiles[keys[k]].enabled;
                            p.enableMacros = data.profiles[keys[k]].enableMacros;
                            p.enableTriggers = data.profiles[keys[k]].enableTriggers;
                            p.enableAliases = data.profiles[keys[k]].enableAliases;
                            p.enableContexts = data.profiles[keys[k]].enableContexts;
                            var l = data.profiles[keys[k]].macros.length;
                            if (l > 0) {
                                for (var m = 0; m < l; m++) {
                                    item = new Macro(data.profiles[keys[k]].macros[m]);
                                    item.notes = data.profiles[keys[k]].macros[m].notes || '';
                                    p.macros.push(item);
                                }
                            }

                            l = data.profiles[keys[k]].aliases.length;
                            if (l > 0) {
                                for (var m = 0; m < l; m++) {
                                    item = new Alias(data.profiles[keys[k]].aliases[m]);
                                    item.notes = data.profiles[keys[k]].aliases[m].notes || '';
                                    p.aliases.push(item);
                                }
                            }

                            l = data.profiles[keys[k]].triggers.length;
                            if (l > 0) {
                                for (var m = 0; m < l; m++) {
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
                                    item.type = data.profiles[keys[k]].triggers[m].type;
                                    item.notes = data.profiles[keys[k]].triggers[m].notes || '';
                                    p.triggers.push(item);
                                }
                            }

                            if (data.profiles[keys[k]].buttons) {
                                l = data.profiles[keys[k]].buttons.length;
                                if (l > 0) {
                                    for (var m = 0; m < l; m++) {
                                        item = new Button(data.profiles[keys[k]].buttons[m]);
                                        p.buttons.push(item);
                                    }
                                }
                            }
                            if (data.profiles[keys[k]].context) {
                                l = data.profiles[keys[k]].context.length;
                                if (l > 0) {
                                    for (var m = 0; m < l; m++) {
                                        item = new Context(data.profiles[keys[k]].context[m]);
                                        p.contexts.push(item);
                                    }
                                }
                            }
                            profiles.add(p);
                            $('#profile-tree').treeview('addNode', [newProfileNode(p), false, false]);
                        }
                        pushUndo({ action: 'add', type: 'profile', item: names });
                    }
                    ipcRenderer.send('set-progress', { value: -1, options: { mode: 'normal' } });
                });
        });
}

function trashProfiles(p) {
    if (_remove.length > 0) {
        for (var r = 0, rl = _remove.length; r < rl; r++) {
            shell.moveItemToTrash(path.join(p, _remove[r] + ".json"));
        }
    }
}

export function saveProfiles() {
    if (updateCurrent() != UpdateState.NoChange)
        return false;
    if (filesChanged)
        dialog.showMessageBox(remote.getCurrentWindow(), {
            type: 'question',
            title: 'Profiles updated',
            message: 'Profiles have been updated outside of manager, save anyways?',
            buttons: ['Yes', 'No'],
            defaultId: 1,
        }, (response) => {
            if (response == 0) {
                var p = path.join(parseTemplate("{data}"), "profiles");
                if (!fs.existsSync(p))
                    fs.mkdirSync(p);
                profiles.save(p);
                trashProfiles(p)
                ipcRenderer.send('reload-profiles');
                setTimeout(clearChanges, 500);
            }
        })
    else {
        var p = path.join(parseTemplate("{data}"), "profiles");
        if (!fs.existsSync(p))
            fs.mkdirSync(p);
        profiles.save(p);
        trashProfiles(p)
        ipcRenderer.send('reload-profiles');
        setTimeout(clearChanges, 500);
    }
    return true;
}

function clearChanges() {
    resetUndo();
    filesChanged = false;
    $('#btn-refresh').removeClass('btn-warning');
}

var editors = {};
var aceTooltip;

function initEditor(id) {
    _pUndo = true;
    var textarea = $('#' + id).hide();
    $('#' + id + '-editor').css('display', 'block');
    ace.require("ace/ext/language_tools");
    editors[id] = ace.edit(id + "-editor");
    var session = editors[id].getSession();
    editors[id].$blockScrolling = Infinity;
    editors[id].getSelectedText = function () {
        return this.session.getTextRange(this.getSelectionRange());
    };

    if (!aceTooltip) {
        var Tooltip = ace.require("ace/tooltip").Tooltip;
        aceTooltip = new Tooltip($("#content")[0]);
    }

    editors[id].setTheme("ace/theme/visual_studio");
    session.setMode("ace/mode/text");
    session.setUseSoftTabs(true);
    session.setValue(textarea.val());

    editors[id].setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true,
        newLineMode: "unix",
        tabSize: 3,
    });

    editors[id].commands.addCommand({
        name: "expand all folds",
        bindKey: { win: "Ctrl-Shift-+", mac: "Command-Option-+" },
        exec: function (editor) {
            editor.getSession().unfold();
        }
    });

    editors[id].commands.addCommand({
        name: "collapse all folds",
        bindKey: { win: "Ctrl-Shift--", mac: "Command-Option--" },
        exec: function (editor) {
            editor.getSession().foldAll();
        }
    });

    editors[id].commands.addCommand({
        name: "undo",
        exec: function (editor, args, e) {
            doUndo();
            event.preventDefault();
            event.stopPropagation();
            return true;
        },
        bindKey: { mac: "Command-Z", win: "Ctrl-Z" }
    });

    editors[id].commands.addCommand({
        name: "redo",
        exec: function (editor, args, e) {
            doRedo();
            event.preventDefault();
            event.stopPropagation();
            return true;
        },
        bindKey: { mac: "Command-Shift-Z|Command-Y", win: "Ctrl-Shift-Z|Ctrl-Y" }
    });

    editors[id].on('focus', function (e) {
        $('#' + id).data('previous-value', session.getValue());
        $('#' + id).data('previous-cursor', editors[id].getCursorPosition());
    });

    session.on('change', function (e) {
        updateCurrent();
        $('#' + id).data('previous-value', session.getValue());
        $('#' + id).data('previous-cursor', editors[id].getCursorPosition());
    });

    session.on('changeFold', function () {
        aceTooltip.hide();
    });

    editors[id].on("mousemove", function (e) {
        var pos = e.getDocumentPosition();
        var fold = e.editor.getSession().getFoldAt(pos.row, pos.column, 1);
        if (fold) {
            var t = e.editor.getSession().getDocument().getTextRange(fold.range).replace(/^\n+|\s+$/g, '');
            var s = t.split(/\n/);
            if (s.length > 10) {
                t = s.slice(0, 10).join("\n").replace(/\s+$/g, '') + "\n...";
            }
            var h = $(window).height();
            var th = aceTooltip.getHeight();
            var x = e.clientX + 32;
            var y = e.clientY;
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
var i = 0;
var dragging = false;

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
    $("#btn-undo").prop('disabled', _undo.length == 0);
    $("#btn-redo").prop('disabled', _redo.length == 0);
}

function DeleteProfileConfirm(profile) {
    dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'question',
        title: 'Delete profile?',
        message: 'Delete ' + profile.name + '?',
        buttons: ['Yes', 'No'],
        defaultId: 1,
    }, (response) => {
        if (response == 0) DeleteProfile(profile);
    })
}

function DeleteProfile(profile, customUndo?: boolean) {
    if (!profile) profile = currentProfile;
    _remove.push(profile.name);
    if (!customUndo)
        pushUndo({ action: 'delete', type: 'profile', item: profile });
    var nodes = $("#profile-tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + '$', 'id']);
    if (profile.name == currentProfile.name)
        $('#profile-tree').treeview('selectNode', [$("#profile-tree").treeview('findNodes', ["^Profiledefault$", 'id'])]);
    $('#profile-tree').treeview('removeNode', [nodes, { silent: true }]);
    profiles.remove(profile);
}

function DeleteItems(type, key, profile) {
    dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'question',
        title: 'Delete ' + type + '?',
        message: 'Are you sure you want to delete all ' + key + '?',
        buttons: ['Yes', 'No'],
        defaultId: 1,
    }, (response) => {
        if (response == 0) {
            var _u = { action: 'group', add: [], delete: [] };
            var n = $("#profile-tree").treeview('findNodes', ["Profile" + profileID(profile.name) + key, 'id']);
            $('#profile-tree').treeview('expandNode', [n, { levels: 1, silent: true }]);
            for (var i = profile[key].length - 1; i >= 0; i--) {
                _u.delete.unshift({ type: type, item: profile[key][i].clone(), data: { type: type, key: key, item: profile[key][i].clone(), idx: i, profile: profile.name.toLowerCase() } });
                DeleteItem(type, key, i, profile, true);
            }
            pushUndo(_u);
        }
    })
}

function DeleteItemConfirm(type, key, idx, profile) {
    dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'question',
        title: 'Delete ' + type + '?',
        message: 'Are you sure you want to delete this ' + type + '?',
        buttons: ['Yes', 'No'],
        defaultId: 1,
    }, (response) => {
        if (response == 0) {
            DeleteItem(type.toLowerCase(), key, idx, profile);
        }
    })
}

function DeleteItem(type: string, key: string, idx: number, profile?: Profile, customUndo?: boolean) {
    var il, i, node, newNode, selected, item, name;
    if (!profile) profile = currentProfile;
    if (!customUndo)
        pushUndo({ action: 'delete', type: type, data: { key: key, idx: idx, profile: profile.name.toLowerCase() }, item: profile[key][idx] });
    name = profileID(profile.name);
    node = $("#profile-tree").treeview('findNodes', ["Profile" + name + key + idx, 'id']);
    if (node && node.length > 0 && node[0].state.selected)
        currentNode = null;
    $('#profile-tree').treeview('removeNode', [node, { silent: true }]);
    profile[key].splice(idx, 1);
    var selected;
    if ((il = profile[key].length) > 0) {
        for (i = idx; i < il; i++) {
            node = $("#profile-tree").treeview('findNodes', ["Profile" + name + key + (i + 1), 'id']);
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
            var node = $('#profile-tree').treeview('findNodes', ['^' + selected + "$", 'id'])[0];
            currentNode = node[0];
            $('#profile-tree').treeview('selectNode', [node]);
        }
    }
}

export function doClose() {
    if (_never || (_undo.length == 0 && updateCurrent() == UpdateState.NoChange)) {
        _close = true;
        window.close();
    }
    else {
        dialog.showMessageBox(remote.getCurrentWindow(), {
            type: 'warning',
            title: 'Profiles changed',
            message: 'All unsaved changes will be lost, close?',
            buttons: ['Yes', 'No', 'Never ask again'],
            defaultId: 1,
        }, (response) => {
            if (response == 0)
                window.close();
            else if (response == 2) {
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
    var profile = profiles.items[node.dataAttr.profile];
    var m = Profile.DefaultMacros;
    var _import = { action: 'group', add: [], delete: [] };
    for (var i = 0, il = m.length; i < il; i++) {
        _import.add.push({ type: "macro", item: m[i].clone(), data: { type: "macro", key: "macros", item: m[i].clone(), id: profile["macros"].length, profile: profile.name.toLowerCase() } });
        addItem("macro", "macros", m[i], profile["macros"].length, profile, true);
    }
    pushUndo(_import);
}

export function doReset(node) {
    if (!node) {
        node = currentNode;
        if (!node) return;
    }
    var profile = profiles.items[node.dataAttr.profile];
    dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'warning',
        title: 'Reset ' + profile.name,
        message: 'Resetting will loose all profile data, reset?',
        buttons: ['Yes', 'No'],
        defaultId: 1,
    }, (response) => {
        if (response == 0) {
            pushUndo({ action: 'reset', type: "profile", profile: profile.clone() });

            var n = $("#profile-tree").treeview('findNodes', ["Profile" + profileID(profile.name) + 'macros[0-9]+', 'id']);
            n = n.concat($("#profile-tree").treeview('findNodes', ["Profile" + profileID(profile.name) + 'triggers[0-9]+', 'id']));
            n = n.concat($("#profile-tree").treeview('findNodes', ["Profile" + profileID(profile.name) + 'buttons[0-9]+', 'id']));
            n = n.concat($("#profile-tree").treeview('findNodes', ["Profile" + profileID(profile.name) + 'aliases[0-9]+', 'id']));
            $('#profile-tree').treeview('removeNode', [n, { silent: true }]);
            n = {
                text: 'Aliases',
                id: "Profile" + profileID(profile.name) + "aliases",
                dataAttr: {
                    profile: profile.name.toLowerCase(),
                    type: 'aliases'
                },
                lazyLoad: 0,
                state: {
                    checked: profile.enableAliases
                }
            };
            o = $("#profile-tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + 'aliases$', 'id']);
            $('#profile-tree').treeview('updateNode', [o[0], n]);
            n = {
                text: 'Macros',
                id: "Profile" + profileID(profile.name) + "macros",
                dataAttr: {
                    profile: profile.name.toLowerCase(),
                    type: 'macros'
                },
                lazyLoad: 0,
                state: {
                    checked: profile.enableMacros
                }
            };
            var o = $("#profile-tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + 'macros$', 'id']);
            $('#profile-tree').treeview('updateNode', [o[0], n]);

            n = {
                text: 'Triggers',
                id: "Profile" + profileID(profile.name) + "triggers",
                dataAttr: {
                    profile: profile.name.toLowerCase(),
                    type: 'triggers'
                },
                lazyLoad: 0,
                state: {
                    checked: profile.enableTriggers
                }
            };
            var o = $("#profile-tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + 'triggers$', 'id']);
            $('#profile-tree').treeview('updateNode', [o[0], n]);
            n = {
                text: 'Buttons',
                id: "Profile" + profileID(profile.name) + "buttons",
                dataAttr: {
                    profile: profile.name.toLowerCase(),
                    type: 'buttons'
                },
                lazyLoad: 0,
                state: {
                    checked: profile.enableButtons
                }
            };
            var o = $("#profile-tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + 'buttons$', 'id']);
            $('#profile-tree').treeview('updateNode', [o[0], n]);

            profile.aliases = [];
            profile.macros = [];
            profile.triggers = [];
            profile.buttons = [];
            profile.enableMacros = true;
            profile.enableTriggers = true;
            profile.enableAliases = true;
            profile.enableButtons = true;
            profile.priority = 0;
            profile.enabled = true;

            if (profile.name == currentProfile.name) {
                $("#profile-enableAliases").prop("checked", currentProfile.enableAliases);
                $("#profile-enableMacros").prop("checked", currentProfile.enableMacros);
                $("#profile-enableTriggers").prop("checked", currentProfile.enableTriggers);
                $("#profile-enableButtons").prop("checked", currentProfile.enableButtons);
                $("#editor-enabled").prop("checked", currentProfile.enabled)
                $("#profile-priority").val(currentProfile.priority);
            }
            $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "macros$", 'id'])]);
            $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "aliases$", 'id'])]);
            $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "triggers$", 'id'])]);
            $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "buttons$", 'id'])]);
            $("#profile-tree").treeview('checkNode', [$('#profile-tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "$", 'id'])]);

        }
    });
}

function UpdateEditor(editor, item, options?) {
    if (!options) options = {};
    _loading++;
    _pUndo = true;
    $("div[id$=-editor]").css('display', 'none');
    $("#" + editor + "-editor").css('display', '');
    $("#editor-title").text(editor + ": " + GetDisplay(item))
    $("#editor-enabled").prop("checked", item.enabled);
    if (typeof options['pre'] == "function")
        options['pre']();
    for (var prop in item) {
        if (!item.hasOwnProperty(prop)) {
            continue;
        }
        var id = "#" + editor + "-" + prop;
        if (typeof options[prop] == "function") {
            options[prop](item, prop, $(id));
        }
        else if (typeof options[prop] == "string") {
            if (typeof item[options[prop]] == "boolean")
                $(id).prop("checked", item[options[prop]]);
            else
                $(id).val(item[options[prop]]);
        }
        else if (typeof item[prop] == "boolean")
            $(id).prop("checked", item[prop]);
        else if (editors[editor + '-' + prop]) {
            if (editors[editor + '-' + prop]) {
                editors[editor + '-' + prop].getSession().setValue(item[prop]);
                if (item.style == ItemStyle.Script)
                    editors[editor + '-' + prop].getSession().setMode("ace/mode/javascript");
                else
                    editors[editor + '-' + prop].getSession().setMode("ace/mode/text");
            }
        }
        else {
            $(id).val(item[prop]);
            $(id).selectpicker('val', item[prop]);
        }
        $(id).data('previous-value', item[prop]);
    }
    if (typeof options['post'] == "function")
        options['post']();
    _pUndo = false;
    _loading--;
}

function MacroValue(item, prop, el) {
    el.val(MacroKeys(item[prop]));
    el.data('key', item.key);
    el.data('mod', item.modifiers);
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
    var n = $("#profile-tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + key + "$", 'id']);
    $('#profile-tree').treeview('expandNode', [n, { levels: 1, silent: false }]);
    //create new node to be inserted
    var nodes = [newItemNode(item, idx, type, profile)];
    var node, newNode, remove = [];
    //loop current nodes to grab data and update indexes
    for (var i = idx, il = profile[key].length; i < il; i++) {
        //Find old node
        node = $("#profile-tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + key + i + "$", 'id'])[0];
        //Push to remove it
        remove.push(node);
        //clone it, will remove invalid node data
        newNode = cloneNode(node);
        //update data to use new index
        newNode.text = GetDisplay(profile[key][i]);
        newNode.dataAttr.index = i + 1;
        newNode.id = "Profile" + profileID(profile.name) + key + newNode.dataAttr.index;
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
    if (!customUndo)
        pushUndo({ action: 'add', type: type, item: item.clone(), data: { type: type, key: key, item: item, idx: idx, profile: profile.name.toLowerCase() } });
    _loading--;
}
