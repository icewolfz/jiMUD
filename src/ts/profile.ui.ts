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
var fchanged = false;
var _clip, _pUndo;
var _undo = [], _redo = [];
var _remove = [];
var _never = true;
var _close;

const addmenu = new Menu();
addmenu.append(new MenuItem({
    label: 'Add empty profile', click() {
        clearButton("#addmenu");
        AddProfile();
    }
}));
addmenu.append(new MenuItem({
    label: 'Add profile with defaults', click() {
        clearButton("#addmenu");
        AddProfile(true);
    }
}));
addmenu.append(new MenuItem({ type: 'separator' }));
addmenu.append(new MenuItem({
    label: 'Add alias', click() {
        clearButton("#addmenu");
        addItem('Alias', 'aliases', new Alias());
    }
}));
addmenu.append(new MenuItem({
    label: 'Add macro', click() {
        clearButton("#addmenu");
        addItem('Macro', 'macros', new Macro());
    }
}));
addmenu.append(new MenuItem({
    label: 'Add trigger', click() {
        clearButton("#addmenu");
        addItem('Trigger', 'triggers', new Trigger());
    }
}));
addmenu.append(new MenuItem({
    label: 'Add button', click() {
        clearButton("#addmenu");
        addItem('Button', 'buttons', new Button())
    }
}));

function profileID(name) {
    return name.toLowerCase().replace(/^[^a-z]+|[^\w:.-]+/gi, "-");
}

function AddNewItem() {
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
                AddProfile(true);
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

function AddProfile(d?: Boolean) {
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
    $('#tree').treeview('addNode', [node, false, false]);
    pushUndo({ action: 'add', type: 'profile', item: [p.name.toLowerCase()] });
}

export function RunTester() {
    if ($("#TriggerTestText").val().length === 0) {
        $('#TriggerTestResults').val("No text to test against!");
        return;
    }
    try {
        if ($("#TriggerVerbatim").prop("checked")) {
            if ($('#TriggerName').val() != $("#TriggerTestText").val())
                $('#TriggerTestResults').val("Pattern doesn't Match!");
            else
                $('#TriggerTestResults').val("%0 : " + $("#TriggerTestText").val() + "\n");
        }
        else {
            var re = new RegExp($('#TriggerName').val(), 'g');
            var res = re.exec($("#TriggerTestText").val());
            if (res === null || res.length === 0)
                $('#TriggerTestResults').val("Pattern doesn't Match!");
            else {
                var r = "";
                for (i = 0; i < res.length; i++) {
                    r += "%" + i + " : " + res[i] + "\n";
                }
                $('#TriggerTestResults').val(r);
            }
        }

    }
    catch (e) {
        $('#TriggerTestResults').val("Error: " + e);
    }
}

export function UpdateButtonSample() {
    var button = $("#buttonsample");
    if ($("#ButtonStretch").prop('checked'))
        button.addClass('button-stretch');
    else
        button.removeClass('button-stretch')
    button.prop('title', $('#ButtonCaption').val());
    var icon = $('#ButtonIcon').val();
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
        defaultPath: path.dirname($('#ButtonIcon').val()),
        filters: [

            { name: 'Images (*.jpg, *.png, *.gif)', extensions: ['jpg', 'png', 'gif'] },
            { name: 'All files (*.*)', extensions: ['*'] },
        ]
    },
        function (fileNames) {
            if (fileNames === undefined) {
                return;
            }
            $('#ButtonIcon').val(fileNames[0]);
            UpdateButtonSample();
        });
}

function MacroeKeys(item) {
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
    return arr[arr.display];
}

function addItem(type, key, item, id?, profile?, customundo?) {
    if (!profile)
        profile = currentProfile;
    if (!id)
        id = profile[key].length;
    type = type.toLowerCase();
    var n = $("#tree").treeview('findNodes', ["Profile" + profileID(profile.name) + key, 'id']);
    $('#tree').treeview('expandNode', [n, { levels: 1, silent: false }]);
    profile[key][id] = item;
    var nodes = [{
        text: GetDisplay(item),
        id: "Profile" + profileID(profile.name) + key + id,
        dataAttr: {
            type: type.toLowerCase(),
            profile: profile.name.toLowerCase(),
            id: "Profile" + profileID(profile.name) + key + id,
            index: id
        },
        state: {
            checked: item.enabled,
            selected: true
        }
    }];
    $('#tree').treeview('addNode', [nodes, n, false, { silent: false }]);
    $('#tree').treeview('selectNode', [nodes, { silent: false }]);
    if (customundo)
        pushUndo({ action: 'add', type: type.toLowerCase(), item: item.clone(), data: { type: type, key: key, item: item, id: id, profile: profile.name.toLowerCase() } });
}

export function UpdateEnabled() {
    var t = "profile";
    if (!currentNode.dataAttr.type) {
        var parent = $('#tree').treeview('getParents', currentNode)[0];
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
            var parent = $('#tree').treeview('findNodes', ['^Profile' + profileID(currentProfile.name) + "$", 'id']);
            if (!$("#enabled").prop("checked")) {
                if (profiles.canDisable(currentProfile)) {
                    if ($("#enabled").prop("checked"))
                        $('#tree').treeview('checkNode', [parent, { silent: true }]);
                    else
                        $('#tree').treeview('uncheckNode', [parent, { silent: true }]);
                    pushUndo({ action: 'update', type: 'profile', profile: currentProfile.name, data: { enabled: currentProfile.enabled } });
                    currentProfile.enabled = $("#enabled").prop("checked");
                }
                else {
                    $("#enabled").prop("checked", true);
                    $("#tree").treeview('checkNode', [parent, { silent: true }]);
                }
            }
            else if (currentProfile.enabled != $("#enabled").prop("checked")) {
                if ($("#enabled").prop("checked"))
                    $('#tree').treeview('checkNode', [parent, { silent: true }]);
                else
                    $('#tree').treeview('uncheckNode', [parent, { silent: true }]);
                pushUndo({ action: 'update', type: 'profile', profile: currentProfile.name, data: { enabled: currentProfile.enabled } });
                currentProfile.enabled = $("#enabled").prop("checked");
            }


            break;

        case "alias":
            if ($("#enabled").prop("checked"))
                $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            else
                $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name, data: { enabled: currentProfile.aliases[currentNode.dataAttr.index].enabled } });
            currentProfile.aliases[currentNode.dataAttr.index].enabled = $("#enabled").prop("checked");
            break;
        case "macro":
            if ($("#enabled").prop("checked"))
                $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            else
                $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name, data: { enabled: currentProfile.macros[currentNode.dataAttr.index].enabled } });
            currentProfile.macros[currentNode.dataAttr.index].enabled = $("#enabled").prop("checked");
            break;
        case "trigger":
            if ($("#enabled").prop("checked"))
                $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            else
                $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name, data: { enabled: currentProfile.triggers[currentNode.dataAttr.index].enabled } });
            currentProfile.triggers[currentNode.dataAttr.index].enabled = $("#enabled").prop("checked");
            break;
        case "button":
            if ($("#enabled").prop("checked"))
                $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            else
                $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id']), { silent: true }]);
            pushUndo({ action: 'update', type: t, item: currentNode.dataAttr.index, profile: currentProfile.name, data: { enabled: currentProfile.buttons[currentNode.dataAttr.index].enabled } });
            currentProfile.buttons[currentNode.dataAttr.index].enabled = $("#enabled").prop("checked");
            break;
    }
}

export function UpdateNode(item) {
    var selected = currentNode.state.selected
    var newNode = {
        text: GetDisplay(item),
        id: currentNode.id,
        dataAttr: {
            type: currentNode.dataAttr.type,
            profile: currentNode.dataAttr.profile,
            index: currentNode.dataAttr.index
        },
        state: {
            checked: item.enabled,
            selected: currentNode.selected
        }
    };
    var node = $('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id'])[0];
    $('#tree').treeview('updateNode', [node, newNode]);
    if (selected) {
        var node = $('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id'])[0];
        $('#tree').treeview('selectNode', [node, { silent: true }]);
        currentNode = node;
    }
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

export function UpdateMacro() {
    var data: any = {};
    var changed = 0;
    var val;


    if (currentProfile.macros[currentNode.dataAttr.index].enabled != $("#enabled").prop("checked")) {
        data.enabled = currentProfile.macros[currentNode.dataAttr.index].enabled;
        changed++;
        currentProfile.macros[currentNode.dataAttr.index].enabled = $("#enabled").prop("checked");
    }

    if (currentProfile.macros[currentNode.dataAttr.index].key != parseInt($("#MacroKey").data('key'), 10)) {
        data.key = currentProfile.macros[currentNode.dataAttr.index].key;
        changed++;
        currentProfile.macros[currentNode.dataAttr.index].key = parseInt($("#MacroKey").data('key'), 10);
    }

    if (currentProfile.macros[currentNode.dataAttr.index].modifiers != parseInt($("#MacroKey").data('mod'), 10)) {
        data.modifiers = currentProfile.macros[currentNode.dataAttr.index].modifiers;
        currentProfile.macros[currentNode.dataAttr.index].modifiers = parseInt($("#MacroKey").data('mod'), 10);
        changed++;
    }

    if (currentProfile.macros[currentNode.dataAttr.index].style != parseInt($('#MacroStyle').selectpicker('val'), 10)) {
        data.style = currentProfile.macros[currentNode.dataAttr.index].style;
        changed++;
        currentProfile.macros[currentNode.dataAttr.index].style = parseInt($('#MacroStyle').selectpicker('val'), 10);
    }

    val = getEditorValue('MacroValue', currentProfile.macros[currentNode.dataAttr.index].style);
    if (val != currentProfile.macros[currentNode.dataAttr.index].value) {
        data.value = currentProfile.macros[currentNode.dataAttr.index].value;
        changed++;
        currentProfile.macros[currentNode.dataAttr.index].value = val;
    }

    if (currentProfile.macros[currentNode.dataAttr.index].name != $('#MacroName').val()) {
        data.name = currentProfile.macros[currentNode.dataAttr.index].name;
        changed++;
        currentProfile.macros[currentNode.dataAttr.index].name = $('#MacroName').val();
    }
    if (currentProfile.macros[currentNode.dataAttr.index].append != $("#MacroAppend").prop('checked')) {
        data.append = currentProfile.macros[currentNode.dataAttr.index].append;
        changed++;
        currentProfile.macros[currentNode.dataAttr.index].append = $("#MacroAppend").prop('checked');
    }
    if (currentProfile.macros[currentNode.dataAttr.index].chain != $("#MacroChain").prop('checked')) {
        data.chain = currentProfile.macros[currentNode.dataAttr.index].chain;
        changed++;
        currentProfile.macros[currentNode.dataAttr.index].chain = $("#MacroChain").prop('checked');
    }
    if (currentProfile.macros[currentNode.dataAttr.index].send != $("#MacroSend").prop('checked')) {
        data.send = currentProfile.macros[currentNode.dataAttr.index].send;
        changed++;
        currentProfile.macros[currentNode.dataAttr.index].send = $("#MacroSend").prop('checked');
    }
    if (changed > 0) {
        UpdateNode(currentProfile.macros[currentNode.dataAttr.index]);
        $("#title").text("Macro: " + GetDisplay(currentProfile.macros[currentNode.dataAttr.index]));
        pushUndo({ action: 'update', type: 'macro', item: currentNode.dataAttr.index, profile: currentProfile.name, data: data });
    }
}

export function UpdateAlias() {
    var data: any = {};
    var changed = 0;
    var val;

    if (currentProfile.aliases[currentNode.dataAttr.index].enabled != $("#enabled").prop("checked")) {
        data.enabled = currentProfile.aliases[currentNode.dataAttr.index].enabled;
        changed++;
        currentProfile.aliases[currentNode.dataAttr.index].enabled = $("#enabled").prop("checked");
    }
    if (currentProfile.aliases[currentNode.dataAttr.index].pattern != $('#AliasName').val()) {
        data.pattern = currentProfile.aliases[currentNode.dataAttr.index].pattern;
        changed++;
        currentProfile.aliases[currentNode.dataAttr.index].pattern = $('#AliasName').val();
    }
    if (currentProfile.aliases[currentNode.dataAttr.index].style != parseInt($('#AliasStyle').selectpicker('val'), 10)) {
        data.style = currentProfile.aliases[currentNode.dataAttr.index].style;
        changed++;
        currentProfile.aliases[currentNode.dataAttr.index].style = parseInt($('#AliasStyle').selectpicker('val'), 10);
    }
    val = getEditorValue('AliasValue', currentProfile.aliases[currentNode.dataAttr.index].style);

    if (currentProfile.aliases[currentNode.dataAttr.index].value != val) {
        data.value = currentProfile.aliases[currentNode.dataAttr.index].value;
        changed++;
        currentProfile.aliases[currentNode.dataAttr.index].value = val;
    }
    if (currentProfile.aliases[currentNode.dataAttr.index].params != $('#AliasParams').val()) {
        data.params = currentProfile.aliases[currentNode.dataAttr.index].params;
        changed++;
        currentProfile.aliases[currentNode.dataAttr.index].params = $('#AliasParams').val();
    }
    if (currentProfile.aliases[currentNode.dataAttr.index].priority != parseInt($('#AliasPriority').val(), 10)) {
        data.priority = currentProfile.aliases[currentNode.dataAttr.index].priority;
        changed++;
        currentProfile.aliases[currentNode.dataAttr.index].priority = parseInt($('#AliasPriority').val(), 10);
    }
    if (currentProfile.aliases[currentNode.dataAttr.index].append != $("#AliasAppend").prop('checked')) {
        data.append = currentProfile.aliases[currentNode.dataAttr.index].append;
        changed++;
        currentProfile.aliases[currentNode.dataAttr.index].append = $("#AliasAppend").prop('checked');
    }
    if (currentProfile.aliases[currentNode.dataAttr.index].multi != $("#AliasMulti").prop('checked')) {
        data.multi = currentProfile.aliases[currentNode.dataAttr.index].multi;
        changed++;
        currentProfile.aliases[currentNode.dataAttr.index].multi != $("#AliasMulti").prop('checked');
    }
    if (changed > 0) {
        UpdateNode(currentProfile.aliases[currentNode.dataAttr.index]);
        $("#title").text("Alias: " + GetDisplay(currentProfile.aliases[currentNode.dataAttr.index]));
        pushUndo({ action: 'update', type: 'alias', item: currentNode.dataAttr.index, profile: currentProfile.name, data: data });
    }
}

export function UpdateTrigger() {
    var data: any = {};
    var changed = 0;
    var val;

    if (currentProfile.triggers[currentNode.dataAttr.index].enabled != $("#enabled").prop("checked")) {
        data.enabled = currentProfile.triggers[currentNode.dataAttr.index].enabled;
        changed++;
        currentProfile.triggers[currentNode.dataAttr.index].enabled = $("#enabled").prop("checked");
    }
    if (currentProfile.triggers[currentNode.dataAttr.index].pattern != $('#TriggerName').val()) {
        data.pattern = currentProfile.triggers[currentNode.dataAttr.index].pattern;
        changed++;
        currentProfile.triggers[currentNode.dataAttr.index].pattern = $('#TriggerName').val();
    }
    if (currentProfile.triggers[currentNode.dataAttr.index].style != parseInt($('#TriggerStyle').selectpicker('val'), 10)) {
        data.style = currentProfile.triggers[currentNode.dataAttr.index].style;
        changed++;
        currentProfile.triggers[currentNode.dataAttr.index].style = parseInt($('#TriggerStyle').selectpicker('val'), 10);
    }
    
    val = getEditorValue('TriggerValue', currentProfile.triggers[currentNode.dataAttr.index].style);
    if (currentProfile.triggers[currentNode.dataAttr.index].value != val) {
        data.value = currentProfile.triggers[currentNode.dataAttr.index].value;
        changed++;
        currentProfile.triggers[currentNode.dataAttr.index].value = val;
    }
    if (currentProfile.triggers[currentNode.dataAttr.index].priority != parseInt($('#TriggerPriority').val(), 10)) {
        data.priority = currentProfile.triggers[currentNode.dataAttr.index].priority;
        changed++;
        currentProfile.triggers[currentNode.dataAttr.index].priority = parseInt($('#TriggerPriority').val(), 10);
    }
    $('#TriggerTestText').val("");
    $('#TriggerTestResults').val("");
    $('.nav-tabs a[href="#tvalue"]').tab('show');

    if (currentProfile.triggers[currentNode.dataAttr.index].verbatim != $("#TriggerVerbatim").prop('checked')) {
        data.verbatim = currentProfile.triggers[currentNode.dataAttr.index].verbatim;
        changed++;
        currentProfile.triggers[currentNode.dataAttr.index].verbatim = $("#TriggerVerbatim").prop('checked');
    }
    if (currentProfile.triggers[currentNode.dataAttr.index].triggerNewline != $("#TriggerNewline").prop('checked')) {
        data.triggerNewline = currentProfile.triggers[currentNode.dataAttr.index].triggerNewline;
        changed++;
        currentProfile.triggers[currentNode.dataAttr.index].triggerNewline = $("#TriggerNewline").prop('checked');
    }
    if (currentProfile.triggers[currentNode.dataAttr.index].triggerPrompt != $("#TriggerPrompt").prop('checked')) {
        data.triggerPrompt = currentProfile.triggers[currentNode.dataAttr.index].triggerPrompt;
        changed++;
        currentProfile.triggers[currentNode.dataAttr.index].triggerPrompt = $("#TriggerPrompt").prop('checked');
    }
    if (currentProfile.triggers[currentNode.dataAttr.index].type != parseInt($('#TriggerType').selectpicker('val'), 10)) {
        data.type = currentProfile.triggers[currentNode.dataAttr.index].type;
        changed++;
        currentProfile.triggers[currentNode.dataAttr.index].type = parseInt($('#TriggerType').selectpicker('val'), 10);
    }
    if (changed > 0) {
        UpdateNode(currentProfile.triggers[currentNode.dataAttr.index]);
        $("#title").text("Trigger: " + GetDisplay(currentProfile.triggers[currentNode.dataAttr.index]))
        pushUndo({ action: 'update', type: 'trigger', item: currentNode.dataAttr.index, profile: currentProfile.name, data: data });
    }
}

export function UpdateButton() {
    var data: any = {};
    var changed = 0;
    var val;

    if (currentProfile.buttons[currentNode.dataAttr.index].enabled != $("#enabled").prop("checked")) {
        data.enabled = currentProfile.buttons[currentNode.dataAttr.index].enabled;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].enabled = $("#enabled").prop("checked");
    }
    if (currentProfile.buttons[currentNode.dataAttr.index].caption != $('#ButtonCaption').val()) {
        data.caption = currentProfile.buttons[currentNode.dataAttr.index].caption;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].caption = $('#ButtonCaption').val();
    }
    if (currentProfile.buttons[currentNode.dataAttr.index].icon != $('#ButtonIcon').val()) {
        data.icon = currentProfile.buttons[currentNode.dataAttr.index].icon;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].icon = $('#ButtonIcon').val();
    }
    if (currentProfile.buttons[currentNode.dataAttr.index].style != parseInt($('#ButtonStyle').selectpicker('val'), 10)) {
        data.style = currentProfile.buttons[currentNode.dataAttr.index].style;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].style = parseInt($('#ButtonStyle').selectpicker('val'), 10);
    }
    val = getEditorValue('ButtonValue', currentProfile.buttons[currentNode.dataAttr.index].style);

    if (currentProfile.buttons[currentNode.dataAttr.index].value != val) {
        data.value = currentProfile.buttons[currentNode.dataAttr.index].value;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].value = val;
    }
    if (currentProfile.buttons[currentNode.dataAttr.index].name != $('#ButtonName').val()) {
        data.name = currentProfile.buttons[currentNode.dataAttr.index].name;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].name = $('#ButtonName').val();
    }
    if (currentProfile.buttons[currentNode.dataAttr.index].priority != parseInt($('#ButtonPriority').val(), 10)) {
        data.priority = currentProfile.buttons[currentNode.dataAttr.index].priority;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].priority = parseInt($('#ButtonPriority').val(), 10);
    }
    if (currentProfile.buttons[currentNode.dataAttr.index].send != $("#ButtonSend").prop('checked')) {
        data.send = currentProfile.buttons[currentNode.dataAttr.index].send;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].send = $("#ButtonSend").prop('checked');
    }
    if (currentProfile.buttons[currentNode.dataAttr.index].append != $("#ButtonAppend").prop('checked')) {
        data.append = currentProfile.buttons[currentNode.dataAttr.index].append;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].append = $("#ButtonAppend").prop('checked');
    }
    if (currentProfile.buttons[currentNode.dataAttr.index].chain != $("#ButtonChain").prop('checked')) {
        data.chain = currentProfile.buttons[currentNode.dataAttr.index].chain;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].chain = $("#ButtonChain").prop('checked');
    }
    if (currentProfile.buttons[currentNode.dataAttr.index].stretch != $("#ButtonStretch").prop('checked')) {
        data.stretch = currentProfile.buttons[currentNode.dataAttr.index].stretch;
        changed++;
        currentProfile.buttons[currentNode.dataAttr.index].stretch = $("#ButtonStretch").prop('checked');
    }
    if (changed > 0) {
        UpdateButtonSample();
        UpdateNode(currentProfile.buttons[currentNode.dataAttr.index]);
        $("#title").text("Button: " + GetDisplay(currentProfile.buttons[currentNode.dataAttr.index]))
        pushUndo({ action: 'update', type: 'button', item: currentNode.dataAttr.index, profile: currentProfile.name, data: data });
    }
}

export function UpdateProfile() {
    var data: any = {};
    var changed = 0;
    var val;

    var val = $("#ProfileName").val();
    if (val != currentProfile.name) {
        data.name = val;
        changed++;

        if (profiles.contains(val)) {
            dialog.showMessageBox(remote.getCurrentWindow(), {
                type: 'error',
                title: 'Profile name already used',
                message: 'The name is already in use, pick a different one'
            });
            $("#ProfileName").val(currentProfile.name);
            $("#ProfileName").focus();
            return;
        }
        profiles.remove(currentProfile);
        currentProfile.name = val;
        profiles.add(currentProfile);
        $("#title").text("Profile: " + currentProfile.name);

        var selected = currentNode.state.selected
        var expanded = currentNode.state.expanded
        var newNode = {
            text: val,
            id: 'Profile' + profileID(val),
            state: {
                checked: currentProfile.enabled,
                expanded: currentNode.state.expanded
            },
            dataAttr: {
                type: 'profile',
                profile: val
            },
            nodes: [
                {
                    text: 'Aliases',
                    id: 'Profile' + profileID(val) + 'aliases',
                    dataAttr: {
                        profile: val
                    },
                    lazyLoad: currentProfile.aliases.length > 0,
                    state: {
                        checked: currentProfile.enableAliases
                    }
                },
                {
                    text: 'Macros',
                    id: 'Profile' + profileID(val) + 'macros',
                    dataAttr: {
                        profile: val
                    },
                    lazyLoad: currentProfile.macros.length > 0,
                    state: {
                        checked: currentProfile.enableMacros
                    }
                },
                {
                    text: 'Triggers',
                    id: 'Profile' + profileID(val) + 'triggers',
                    dataAttr: {
                        profile: val
                    },
                    lazyLoad: currentProfile.triggers.length > 0,
                    state: {
                        checked: currentProfile.enableTriggers
                    }
                },
                {
                    text: 'Buttons',
                    id: 'Profile' + profileID(val) + 'buttons',
                    dataAttr: {
                        profile: val
                    },
                    lazyLoad: currentProfile.buttons.length > 0,
                    state: {
                        checked: currentProfile.enableButtons
                    }
                }
            ]
        };
        var node = $('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id'])[0];
        $('#tree').treeview('updateNode', [node, newNode]);
        if (selected) {
            var node = $('#tree').treeview('findNodes', ['^Profile' + val + "$", 'id'])[0];
            $('#tree').treeview('selectNode', [node, { silent: true }]);
            currentNode = node;
        }
    }


    if (currentProfile.enableAliases != $("#enableAliases").prop("checked")) {
        data.enableAliases = currentProfile.enableAliases;
        changed++;
        currentProfile.enableAliases = $("#enableAliases").prop("checked");
    }
    if (currentProfile.enableMacros != $("#enableMacros").prop("checked")) {
        data.enableMacros = currentProfile.enableMacros;
        changed++;
        currentProfile.enableMacros = $("#enableMacros").prop("checked");
    }
    if (currentProfile.enableTriggers != $("#enableTriggers").prop("checked")) {
        data.enableTriggers = currentProfile.enableTriggers;
        changed++;
        currentProfile.enableTriggers = $("#enableTriggers").prop("checked");
    }
    if (currentProfile.enableButtons != $("#enableButtons").prop("checked")) {
        data.enableButtons = currentProfile.enableButtons;
        changed++;
        currentProfile.enableButtons = $("#enableButtons").prop("checked");
    }

    if (currentProfile.enabled != $("#enabled").prop("checked")) {
        data.enabled = currentProfile.enabled;
        changed++;
        if (!$("#enabled").prop("checked")) {
            if (profiles.canDisable(currentProfile))
                currentProfile.enabled = false;
            else {
                $("#enabled").prop("checked", true);
                $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^' + currentNode.id + "$", 'id'])]);
            }
        }
        else
            currentProfile.enabled = true;
    }

    if (currentProfile.priority != parseInt($("#profilePriority").val(), 10)) {
        data.priority = currentProfile.priority;
        changed++;
        currentProfile.priority = parseInt($("#profilePriority").val(), 10);
    }

    val = profileID(currentProfile.name);
    if (currentProfile.enableAliases)
        $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "aliases$", 'id'])]);
    else
        $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "aliases$", 'id'])]);
    if (currentProfile.enableMacros)
        $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "macros$", 'id'])]);
    else
        $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "macros$", 'id'])]);
    if (currentProfile.enableTriggers)
        $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "triggers$", 'id'])]);
    else
        $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "triggers$", 'id'])]);
    if (currentProfile.enableButtons)
        $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "buttons$", 'id'])]);
    else
        $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "buttons$", 'id'])]);
    if (changed > 0)
        pushUndo({ action: 'update', type: 'profile', profile: currentProfile.name, data: data });
    return true;
}

export function updateProfileChecks() {
    _pUndo = true;
    var val = profileID(currentProfile.name);




    if ($("#enableAliases").prop("checked"))
        $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "aliases$", 'id']), { silent: true }]);
    else
        $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "aliases$", 'id']), { silent: true }]);
    if ($("#enableMacros").prop("checked"))
        $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "macros$", 'id']), { silent: true }]);
    else
        $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "macros$", 'id']), { silent: true }]);
    if ($("#enableTriggers").prop("checked"))
        $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "triggers$", 'id']), { silent: true }]);
    else
        $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "triggers$", 'id']), { silent: true }]);
    if ($("#enableButtons").prop("checked"))
        $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "buttons$", 'id']), { silent: true }]);
    else
        $("#tree").treeview('uncheckNode', [$('#tree').treeview('findNodes', ['^Profile' + val + "buttons$", 'id']), { silent: true }]);
    _pUndo = false;
}

function nodeCheckChanged(event, node) {
    var changed = 1;
    var data: any = {};
    if (!node) return;
    var t = "profile";
    if (!node.dataAttr.type)
        t = $('#tree').treeview('getParents', node)[0].dataAttr.type;
    else
        t = node.dataAttr.type;
    var profile = profiles.items[node.dataAttr.profile];
    switch (t) {
        case "profile":
            switch (node.text.toLowerCase()) {
                case "aliases":
                    data.enableAliases = node.state.checked;
                    profile.enableAliases = node.state.checked;
                    if (profile == currentProfile)
                        $("#enableAliases").prop("checked", node.state.checked);
                    break;
                case "macros":
                    data.enableMacros = node.state.checked;
                    profile.enableMacros = node.state.checked;
                    if (profile == currentProfile)
                        $("#enableMacros").prop("checked", node.state.checked);
                    break;
                case "triggers":
                    data.enableTriggers = node.state.checked;
                    profile.enableTriggers = node.state.checked;
                    if (profile == currentProfile)
                        $("#enableTriggers").prop("checked", node.state.checked);
                    break;
                case "buttons":
                    data.enableButtons = node.state.checked;
                    profile.enableButtons = node.state.checked;
                    if (profile == currentProfile)
                        $("#enableButtons").prop("checked", node.state.checked);
                    break;
                default:
                    if (!node.state.checked) {
                        if (profiles.canDisable(profile))
                            profile.enabled = node.state.checked;
                        else {
                            $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^' + node.id + "$", 'id']), { silent: true }]);
                            changed = 0;
                        }
                    }
                    else if (profile.enabled != node.state.checked)
                        profile.enabled = node.state.checked;
                    else
                        changed = 0;
                    data.enabled = profile.enabled;
                    if (profile == currentProfile)
                        $("#enabled").prop("checked", profile.enabled);
                    break;
            }
            break;
        case "aliases":
            profile.enableAliases = node.state.checked;
            t = 'profile';
            data.enableAliases = node.state.checked;
            if (profile == currentProfile)
                $("#enableAliases").prop("checked", node.state.checked);
            break;
        case "macros":
            profile.enableMacros = node.state.checked;
            t = 'profile';
            data.enableMacros = node.state.checked;
            if (profile == currentProfile)
                $("#enableMacros").prop("checked", node.state.checked);
            break;
        case "triggers":
            profile.enableTriggers = node.state.checked;
            t = 'profile';
            data.enableTriggers = node.state.checked;
            if (profile == currentProfile)
                $("#enableTriggers").prop("checked", node.state.checked);
            break;
        case "buttons":
            profile.enableButtons = node.state.checked;
            t = 'profile';
            data.enableButtons = node.state.checked;
            if (profile == currentProfile)
                $("#enableButtons").prop("checked", node.state.checked);
            break;

        case "alias":
            profile.aliases[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id == currentNode.id)
                $("#enabled").prop("checked", node.state.checked);
            break;
        case "macro":
            profile.macros[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id == currentNode.id)
                $("#enabled").prop("checked", node.state.checked);
            break;
        case "trigger":
            profile.triggers[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id == currentNode.id)
                $("#enabled").prop("checked", node.state.checked);
            break;
        case "button":
            profile.buttons[node.dataAttr.index].enabled = node.state.checked;
            data.enabled = node.state.checked;
            if (node.id == currentNode.id)
                $("#enabled").prop("checked", node.state.checked);
            break;
    }
    if (changed > 0)
        pushUndo({ action: 'update', type: t, profile: profile.name, data: data });
}

function resetClip() {
    if (_clip && _clip.data.length > 0 && _clip.action == 2) {
        for (var i = 0, il = _clip.data.length; i < il; i++) {
            var nodes = $('#tree').treeview('findNodes', ['^Profile' + profileID(_clip.profile) + _clip.key + _clip.data[i], 'id']);
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

export function UpdatePaste() {
    $("#btnPaste").prop('disabled', !canPaste());
}

export function doUndo() {

}

export function doRedo() {

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
            nodes = $('#tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
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
            nodes = $('#tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
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
            nodes = $('#tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
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
            nodes = $('#tree').treeview('findNodes', ['^' + node.id + '[0-9]+', 'id']);
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
            var txt = profile.name;
            var n = profile.name.toLowerCase();
            node = {
                text: txt,
                id: 'Profile' + profileID(n),
                state: {
                    checked: profile.enabled
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
                        lazyLoad: profile.aliases.length > 0,
                        state: {
                            checked: profile.enableAliases
                        }
                    },
                    {
                        text: 'Macros',
                        id: 'Profile' + profileID(n) + 'macros',
                        dataAttr: {
                            profile: n
                        },
                        lazyLoad: profile.macros.length > 0,
                        state: {
                            checked: profile.enableMacros
                        }
                    },
                    {
                        text: 'Triggers',
                        id: 'Profile' + profileID(n) + 'triggers',
                        dataAttr: {
                            profile: n
                        },
                        lazyLoad: profile.triggers.length > 0,
                        state: {
                            checked: profile.enableTriggers
                        }
                    },
                    {
                        text: 'Buttons',
                        id: 'Profile' + profileID(n) + 'buttons',
                        dataAttr: {
                            profile: n
                        },
                        lazyLoad: profile.buttons.length > 0,
                        state: {
                            checked: profile.enableButtons
                        }
                    }
                ]
            }
            $('#tree').treeview('addNode', [node, false, false]);
            pushUndo({ action: 'add', type: 'profile', item: [n] });
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
        _paste.add.push({ type: _clip.type, item: item.clone(), data: { type: _clip.type, key: _clip.key, item: item.clone(), id: profile[_clip.key].length, profile: profile.name.toLowerCase() } });
        addItem(_clip.type, _clip.key, item, profile[_clip.key].length, profile, true);
    }

    if (_clip.action == 2) {
        for (var i = 0, il = _clip.data.length; i < il; i++) {
            item = source[_clip.key][_clip.data[i]].clone();
            _paste.delete.push({ type: _clip.type, item: item.clone(), data: { type: _clip.type, key: _clip.key, item: item, id: _clip.data[i], profile: source.name.toLowerCase() } });
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

export function updateCurrent() {
    if (currentNode) {
        currentNode.state.selected = false;
        var t = "profile";
        if (!currentNode.dataAttr.type)
            t = $('#tree').treeview('getParents', currentNode)[0].dataAttr.type;
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
                UpdateAlias();
                break;
            case "macro":
                UpdateMacro();
                break;
            case "trigger":
                UpdateTrigger();
                break;
            case "button":
                UpdateButton();
                break;
        }
    }
    return true;
}

function buildTreeview(data) {
    currentNode = 0;
    $('#tree').treeview({
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
            if (!updateCurrent()) {
                $('#tree').treeview('selectNode', [currentNode, { silent: true }]);
                return;
            }
            if (!node) return;
            t = "profile";
            if (!node.dataAttr.type)
                t = $('#tree').treeview('getParents', node)[0].dataAttr.type;
            else
                t = node.dataAttr.type;
            currentNode = node;
            currentProfile = profiles.items[node.dataAttr.profile];
            UpdatePaste();
            $("#profile").css('display', 'none');
            $("#aliases").css('display', 'none');
            $("#macros").css('display', 'none');
            $("#triggers").css('display', 'none');
            $("#buttons").css('display', 'none');

            $("#btnCut").prop('disabled', false);
            $("#btnCopy").prop('disabled', false);
            $("#btnDelete").prop('disabled', false);
            UpdatePaste();
            switch (t) {
                case "aliases":
                case "macros":
                case "triggers":
                case "buttons":
                case "profile":
                    $("#profile").css('display', '');
                    $("#title").text("Profile: " + currentProfile.name)
                    $("#ProfileName").val(currentProfile.name);
                    if (currentProfile.name == "Default") {
                        $("#ProfileName").prop('disabled', true);
                        if (t == "profile") {
                            $("#btnCut").prop('disabled', true);
                            $("#btnDelete").prop('disabled', true);
                        }
                    }
                    else
                        $("#ProfileName").prop('disabled', false);

                    if (t != "profile" && currentProfile[t].length == 0) {
                        $("#btnCopy").prop('disabled', true);
                        $("#btnCut").prop('disabled', true);
                        $("#btnDelete").prop('disabled', true);
                    }
                    else if (t == "profile")
                        $("#btnCut").prop('disabled', true);

                    $("#enableAliases").prop("checked", currentProfile.enableAliases);
                    $("#enableMacros").prop("checked", currentProfile.enableMacros);
                    $("#enableTriggers").prop("checked", currentProfile.enableTriggers);
                    $("#enableButtons").prop("checked", currentProfile.enableButtons);
                    $("#enabled").prop("checked", currentProfile.enabled)
                    $("#profilePriority").val(currentProfile.priority);
                    break;
                case "alias":
                    $("#aliases").css('display', '');
                    $("#title").text("Alias: " + node.text)
                    $("#enabled").prop("checked", currentProfile.aliases[node.dataAttr.index].enabled);
                    $('#AliasName').val(currentProfile.aliases[node.dataAttr.index].pattern);
                    $('#AliasStyle').selectpicker('val', currentProfile.aliases[node.dataAttr.index].style);
                    if (editors['AliasValue']) {
                        editors['AliasValue'].getSession().setValue(currentProfile.aliases[node.dataAttr.index].value);
                        if (currentProfile.aliases[currentNode.dataAttr.index].style == ItemStyle.Script)
                            editors['AliasValue'].getSession().setMode("ace/mode/javascript");
                        else
                            editors['AliasValue'].getSession().setMode("ace/mode/text");
                    }
                    $('#AliasValue').val(currentProfile.aliases[node.dataAttr.index].value);
                    $('#AliasParams').val(currentProfile.aliases[node.dataAttr.index].params);
                    $('#AliasPriority').val(currentProfile.aliases[node.dataAttr.index].priority);

                    $("#AliasAppend").prop('checked', currentProfile.aliases[node.dataAttr.index].append);
                    $("#AliasMulti").prop('checked', currentProfile.aliases[node.dataAttr.index].multi);

                    break;

                case "macro":
                    $("#macros").css('display', '');
                    $("#title").text("Macro: " + node.text)
                    $("#enabled").prop("checked", currentProfile.macros[node.dataAttr.index].enabled);
                    $('#MacroKey').val(MacroeKeys(currentProfile.macros[node.dataAttr.index]));
                    $("#MacroKey").data('key', currentProfile.macros[node.dataAttr.index].key);
                    $("#MacroKey").data('mod', currentProfile.macros[node.dataAttr.index].modifiers);
                    $('#MacroStyle').selectpicker('val', currentProfile.macros[node.dataAttr.index].style);
                    if (editors['MacroValue']) {
                        editors['MacroValue'].getSession().setValue(currentProfile.macros[node.dataAttr.index].value);
                        if (currentProfile.macros[currentNode.dataAttr.index].style == ItemStyle.Script)
                            editors['MacroValue'].getSession().setMode("ace/mode/javascript");
                        else
                            editors['MacroValue'].getSession().setMode("ace/mode/text");
                    }
                    $('#MacroValue').val(currentProfile.macros[node.dataAttr.index].value);
                    $('#MacroName').val(currentProfile.macros[node.dataAttr.index].name);
                    $("#MacroAppend").prop('checked', currentProfile.macros[node.dataAttr.index].append);
                    $("#MacroChain").prop('checked', currentProfile.macros[node.dataAttr.index].chain);
                    $("#MacroSend").prop('checked', currentProfile.macros[node.dataAttr.index].send);
                    break;

                case "trigger":
                    $("#triggers").css('display', '');
                    $("#title").text("Trigger: " + node.text)
                    $("#enabled").prop("checked", currentProfile.triggers[node.dataAttr.index].enabled);

                    $('#TriggerName').val(currentProfile.triggers[node.dataAttr.index].pattern);
                    $('#TriggerStyle').selectpicker('val', currentProfile.triggers[node.dataAttr.index].style);
                    if (editors['TriggerValue']) {
                        editors['TriggerValue'].getSession().setValue(currentProfile.triggers[node.dataAttr.index].value);
                        if (currentProfile.triggers[currentNode.dataAttr.index].style == ItemStyle.Script)
                            editors['TriggerValue'].getSession().setMode("ace/mode/javascript");
                        else
                            editors['TriggerValue'].getSession().setMode("ace/mode/text");
                    }
                    $('#TriggerValue').val(currentProfile.triggers[node.dataAttr.index].value);
                    $('#TriggerPriority').val(currentProfile.triggers[node.dataAttr.index].priority);
                    $('#TriggerTestText').val("");
                    $('#TriggerTestResults').val("");
                    $('.nav-tabs a[href="#tvalue"]').tab('show');

                    $("#TriggerVerbatim").prop('checked', currentProfile.triggers[node.dataAttr.index].verbatim);
                    $("#TriggerNewline").prop('checked', currentProfile.triggers[node.dataAttr.index].triggerNewline);
                    $("#TriggerPrompt").prop('checked', currentProfile.triggers[node.dataAttr.index].triggerPrompt);

                    $('#TriggerType').selectpicker('val', currentProfile.triggers[node.dataAttr.index].type);
                    break;

                case "button":
                    $("#buttons").css('display', '');
                    $("#title").text("Button: " + node.text)
                    $("#enabled").prop("checked", currentProfile.buttons[node.dataAttr.index].enabled);

                    $('#ButtonCaption').val(currentProfile.buttons[node.dataAttr.index].caption);
                    $('#ButtonIcon').val(currentProfile.buttons[node.dataAttr.index].icon);
                    $('#ButtonStyle').selectpicker('val', currentProfile.buttons[node.dataAttr.index].style);
                    if (editors['ButtonValue']) {
                        editors['ButtonValue'].getSession().setValue(currentProfile.buttons[node.dataAttr.index].value);
                        if (currentProfile.buttons[currentNode.dataAttr.index].style == ItemStyle.Script)
                            editors['ButtonValue'].getSession().setMode("ace/mode/javascript");
                        else
                            editors['ButtonValue'].getSession().setMode("ace/mode/text");
                    }
                    $('#ButtonValue').val(currentProfile.buttons[node.dataAttr.index].value);
                    $('#ButtonName').val(currentProfile.buttons[node.dataAttr.index].name);
                    $('#ButtonPriority').val(currentProfile.buttons[node.dataAttr.index].priority);
                    $("#ButtonSend").prop('checked', currentProfile.buttons[node.dataAttr.index].send);
                    $("#ButtonAppend").prop('checked', currentProfile.buttons[node.dataAttr.index].append);
                    $("#ButtonChain").prop('checked', currentProfile.buttons[node.dataAttr.index].chain);
                    $("#ButtonStretch").prop('checked', currentProfile.buttons[node.dataAttr.index].stretch);
                    UpdateButtonSample();
                    break;
            }
        },
        onNodeUnselected: function (event, node) {

        },
        lazyLoad: function (node, add) {
            var parent = $('#tree').treeview('getParents', node)[0];
            var nodes = [];
            var item, n, t, i, il = profiles.items[parent.dataAttr.profile][node.text.toLowerCase()].length;
            if (node.text == "Aliases")
                t = "alias";
            else
                t = node.text.substr(0, node.text.length - 1).toLowerCase();
            for (i = 0; i < il; i++) {
                item = profiles.items[parent.dataAttr.profile][node.text.toLowerCase()][i];
                n = {
                    text: GetDisplay(item),
                    id: parent.id + profileID(node.text) + i,
                    dataAttr: {
                        type: t,
                        profile: parent.dataAttr.profile.toLowerCase(),
                        index: i
                    },
                    state: {
                        checked: item.enabled
                    }
                };
                nodes.push(n);
            }
            add(nodes);
            if (_clip && _clip.action == 2 && _clip.key == node.text.toLowerCase()) {
                for (i = 0, il = _clip.data.length; i < il; i++) {
                    n = $('#tree').treeview('findNodes', ['^' + node.id + i, 'id']);
                    n[0].$el.css('opacity', '0.5');
                }
            }
        },
        data: data,
        onInitialized: function (event, nodes) {
            var nodes = $('#tree').treeview('findNodes', ['Default', 'text']);
            if (!currentNode) {
                $('#tree').treeview('expandNode', [nodes]);
                $('#tree').treeview('selectNode', [nodes]);
            }
        }
    });
}

function getProfileData() {
    var data = [
        {
            text: 'Default',
            id: 'Profiledefault',
            state: {
                checked: profiles.items['default'].enabled
            },
            dataAttr: {
                type: 'profile',
                profile: 'default'
            },
            nodes: [
                {
                    text: 'Aliases',
                    id: 'Profiledefaultaliases',
                    dataAttr: {
                        profile: 'default',
                        type: 'aliases'
                    },
                    lazyLoad: profiles.items['default'].aliases.length > 0,
                    state: {
                        checked: profiles.items['default'].enableAliases
                    }
                },
                {
                    text: 'Macros',
                    id: 'Profiledefaultmacros',
                    dataAttr: {
                        profile: 'default',
                        type: 'macros'
                    },
                    lazyLoad: profiles.items['default'].macros.length > 0,
                    state: {
                        checked: profiles.items['default'].enableMacros
                    }
                },
                {
                    text: 'Triggers',
                    id: 'Profiledefaulttriggers',
                    dataAttr: {
                        profile: 'default',
                        type: 'triggers'
                    },
                    lazyLoad: profiles.items['default'].triggers.length > 0,
                    state: {
                        checked: profiles.items['default'].enableTriggers
                    }
                },
                {
                    text: 'Buttons',
                    id: 'Profiledefaultbuttons',
                    dataAttr: {
                        profile: 'default',
                        type: 'buttons'
                    },
                    lazyLoad: profiles.items['default'].buttons.length > 0,
                    state: {
                        checked: profiles.items['default'].enableButtons
                    }
                }
            ]
        }
    ];

    for (var profile in profiles.items) {
        if (profile == 'default') continue;
        var node = {
            text: profile,
            id: "Profile" + profileID(profile),
            dataAttr: {
                type: 'profile',
                profile: profile
            },
            state: {
                checked: profiles.items[profile].enabled
            },
            nodes: [
                {
                    text: 'Aliases',
                    id: "Profile" + profileID(profile) + "aliases",
                    dataAttr: {
                        profile: profile,
                        type: 'aliases'
                    },
                    lazyLoad: profiles.items[profile].aliases.length > 0,
                    state: {
                        checked: profiles.items[profile].enableAliases
                    }
                },
                {
                    text: 'Macros',
                    id: "Profile" + profileID(profile) + "macros",
                    dataAttr: {
                        profile: profile,
                        type: 'macros'
                    },
                    lazyLoad: profiles.items[profile].macros.length > 0,
                    state: {
                        checked: profiles.items[profile].enableMacros
                    }
                },
                {
                    text: 'Triggers',
                    id: "Profile" + profileID(profile) + "triggers",
                    dataAttr: {
                        profile: profile,
                        type: 'triggers'
                    },
                    lazyLoad: profiles.items[profile].triggers.length > 0,
                    state: {
                        checked: profiles.items[profile].enableTriggers
                    }
                },
                {
                    text: 'Buttons',
                    id: "Profile" + profileID(profile) + "buttons",
                    dataAttr: {
                        profile: profile,
                        type: 'buttons'
                    },
                    lazyLoad: profiles.items[profile].buttons.length > 0,
                    state: {
                        checked: profiles.items[profile].enableButtons
                    }
                }
            ]
        }
        data.push(node);
    }
    return data;
}

export function init() {
    $(document).ready(() => {
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
                fchanged = true;
                $('#btnRefresh').addClass('btn-warning');
            })
        }

        buildTreeview(getProfileData());
        $("#tree").contextmenu((event) => {
            var nodeId = $(event.target).closest('li.list-group-item').attr('data-nodeId');
            var nodes = $('#tree').treeview('findNodes', ['^' + nodeId + '$', 'nodeId']);
            var c = new Menu();
            if (!nodes || nodes.length == 0) {
                c.append(new MenuItem({
                    label: 'Add empty profile', click() {
                        AddProfile();
                    }
                }));
                c.append(new MenuItem({
                    label: 'Add profile with defaults', click() {
                        AddProfile(true);
                    }
                }));
            }
            else {
                var t = "profile";
                if (!nodes[0].dataAttr.type)
                    t = $('#tree').treeview('getParents', nodes[0])[0].dataAttr.type;
                else
                    t = nodes[0].dataAttr.type;
                var profile = profiles.items[nodes[0].dataAttr.profile];

                switch (t) {
                    case "profile":
                        c.append(new MenuItem({
                            label: 'Add empty profile', click() {
                                AddProfile();
                            }
                        }));
                        c.append(new MenuItem({
                            label: 'Add profile with defaults', click() {
                                AddProfile(true);
                            }
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

        $('#dragbar').mousedown(function (e) {
            e.preventDefault();

            dragging = true;
            var main = $('#editor');
            var ghostbar = $('<div>',
                {
                    id: 'ghostbar',
                    css: {
                        height: main.outerHeight(),
                        top: main.offset().top,
                        left: main.offset().left - 3
                    }
                }).appendTo('body');

            $(document).mousemove(function (e) {
                if (e.pageX < 199)
                    ghostbar.css("left", 199);
                else if (e.pageX > document.body.clientWidth - 300)
                    ghostbar.css("left", document.body.clientWidth - 300);
                else
                    ghostbar.css("left", e.pageX);
            });

        });

        $(window).on('resize', () => {
            if ($('#editor').outerWidth() < 300 && $("#sidebar").outerWidth() > 202) {
                $('#sidebar').css("width", document.body.clientWidth - 300);
                $('#editor').css("left", document.body.clientWidth - 300);
                ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: document.body.clientWidth - 300 });
            }
        });

        $(document).mouseup(function (e) {
            if (dragging) {
                if (e.pageX < 200) {
                    $('#sidebar').css("width", 202);
                    $('#editor').css("left", 202);
                    ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: 202 });
                }
                else if (e.pageX > document.body.clientWidth - 200) {
                    $('#sidebar').css("width", document.body.clientWidth - 300);
                    $('#editor').css("left", document.body.clientWidth - 300);
                    ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: document.body.clientWidth - 300 });
                }
                else {
                    $('#sidebar').css("width", e.pageX + 2);
                    $('#editor').css("left", e.pageX + 2);
                    ipcRenderer.send('setting-changed', { type: 'profiles', name: 'split', value: e.pageX + 2 });
                }

                $('#ghostbar').remove();
                $(document).unbind('mousemove');
                dragging = false;
            }
        });

        if (options.profiles.split > 200) {
            $('#sidebar').css("width", options.profiles.split);
            $('#editor').css("left", options.profiles.split);
        }

        $("#addMenu").click(function () {
            $(this).addClass('open');
            var pos = $(this).offset();
            var x = Math.floor(pos.left);
            var y = Math.floor(pos.top + $(this).outerHeight() + 2);
            addmenu.popup(remote.getCurrentWindow(), x, y);
        });

        $("#MacroKey").keydown(function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });

        $("#MacroKey").keypress(function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
        $("#MacroKey").keyup(function (e) {
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
            $("#MacroKey").val(c.join("+"));
            $("#MacroKey").data('key', e.which);
            $("#MacroKey").data('mod', mod);
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
                ipcRenderer.send('setting-changed', { type: 'profiles', name: editor + 'Advanced', value: true });
            }
            else {
                panels.css('display', '');
                icon.addClass('fa-chevron-up');
                icon.removeClass('fa-chevron-down');
                $(this).parent().css('padding-bottom', '');
                $(this).closest("table").css('min-height', '');
                ipcRenderer.send('setting-changed', { type: 'profiles', name: editor + 'Advanced', value: false });
            }
        });

        if (options.profiles.triggersAdvanced)
            $("#triggers .btn-adv").click();
        if (options.profiles.aliasesAdvanced)
            $("#aliases .btn-adv").click();
        if (options.profiles.buttonsAdvanced)
            $("#buttons .btn-adv").click();
        if (options.profiles.macrosAdvanced)
            $("#macros .btn-adv").click();

        ['cut', 'copy', 'paste'].forEach(function (event) {
            document.addEventListener(event, function (e) {
                console.debug(e);
                console.debug(document.activeElement);
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

        initEditor("TriggerValue");
        initEditor("MacroValue");
        initEditor("AliasValue");
        initEditor("ButtonValue");

        window.onbeforeunload = function () {
            if (close || _never || (_undo.length == 0 && !updateCurrent()))
                return
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
    });
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
            $("#buttonActionsDropdown").append('<li title="' + path.basename(files[f], path.extname(files[f])) + '"><a href="#" onclick="profileui.setIcon(\'' + path.join(root, files[f]).replace(/\\/g, '\\\\') + '\')"><img class="action-icon" src="' + path.join(p, files[f]) + '"><div class="overlay"></div></a></li>');
    }
}

export function setIcon(icon) {
    $('#ButtonIcon').val(path.join("{assets}", "actions", icon));
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
                fchanged = false;
                resetUndo();
                profiles = new ProfileCollection();
                $('#btnRefresh').removeClass('btn-warning');
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
                        fchanged = true;
                        $('#btnRefresh').addClass('btn-warning');
                    });
                }
                buildTreeview(getProfileData());
            }
        });
    else {
        fchanged = false;
        resetUndo();
        profiles = new ProfileCollection();
        $('#btnRefresh').removeClass('btn-warning');
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
                fchanged = true;
                $('#btnRefresh').addClass('btn-warning');
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

                    if (data.profiles) {
                        var names = [];
                        var keys = Object.keys(data.profiles);
                        var n, k = 0, kl = keys.length;
                        var item: (Alias | Button | Macro | Trigger | Context);
                        for (; k < kl; k++) {
                            n = profileCopyName(keys[k]);
                            names.push(n);
                            var p = new Profile(n);
                            p.priority = data.profiles[keys[k]].priority;
                            p.enabled = data.profiles[keys[k]].enabled;
                            p.enableMacros = data.profiles[keys[k]].enableMacros;
                            p.enableTriggers = data.profiles[keys[k]].enableTriggers;
                            p.enableAliases = data.profiles[keys[k]].enableAliases;

                            p.macros = [];
                            var l = data.profiles[keys[k]].macros.length;
                            if (l > 0) {
                                for (var m = 0; m < l; m++) {
                                    item = new Macro();
                                    item.key = data.profiles[keys[k]].macros[m].key;
                                    item.value = data.profiles[keys[k]].macros[m].value;
                                    item.style = data.profiles[keys[k]].macros[m].style;
                                    item.append = data.profiles[keys[k]].macros[m].append;
                                    item.send = data.profiles[keys[k]].macros[m].send;
                                    item.name = data.profiles[keys[k]].macros[m].name;
                                    item.group = data.profiles[keys[k]].macros[m].group;
                                    item.enabled = data.profiles[keys[k]].macros[m].enabled;
                                    item.modifiers = data.profiles[keys[k]].macros[m].modifiers;
                                    item.chain = data.profiles[keys[k]].macros[m].chain;
                                    item.notes = data.profiles[keys[k]].macros[m].notes || '';
                                    p.macros.push(item);
                                }
                            }

                            l = data.profiles[keys[k]].aliases.length;
                            if (l > 0) {
                                for (var m = 0; m < l; m++) {
                                    item = new Alias();
                                    item.pattern = data.profiles[keys[k]].aliases[m].pattern;
                                    item.value = data.profiles[keys[k]].aliases[m].value;
                                    item.style = data.profiles[keys[k]].aliases[m].style;
                                    item.multi = data.profiles[keys[k]].aliases[m].multi;
                                    item.append = data.profiles[keys[k]].aliases[m].append;
                                    item.name = data.profiles[keys[k]].aliases[m].name;
                                    item.group = data.profiles[keys[k]].aliases[m].group;
                                    item.enabled = data.profiles[keys[k]].aliases[m].enabled;
                                    item.params = data.profiles[keys[k]].aliases[m].params;
                                    item.regexp = data.profiles[keys[k]].aliases[m].regexp;
                                    item.priority = data.profiles[keys[k]].aliases[m].priority;
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
                                        item = new Button();
                                        item.name = data.profiles[keys[k]].buttons[m].name;
                                        item.priority = data.profiles[keys[k]].buttons[m].priority;
                                        item.value = data.profiles[keys[k]].buttons[m].value;
                                        item.style = data.profiles[keys[k]].buttons[m].style;
                                        item.group = data.profiles[keys[k]].buttons[m].group;
                                        item.enabled = data.profiles[keys[k]].buttons[m].enabled;
                                        item.notes = data.profiles[keys[k]].buttons[m].notes || '';
                                        item.caption = data.profiles[keys[k]].buttons[m].caption;
                                        item.icon = data.profiles[keys[k]].buttons[m].icon;
                                        item.append = data.profiles[keys[k]].buttons[m].append;
                                        item.send = data.profiles[keys[k]].buttons[m].send;
                                        item.chain = data.profiles[keys[k]].buttons[m].send;
                                        item.stretch = data.profiles[keys[k]].buttons[m].send;
                                        p.buttons.push(item);
                                    }
                                }
                            }
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
                            $('#tree').treeview('addNode', [node, false, false]);
                        }
                        pushUndo({ action: 'add', type: 'profile', item: names });
                    }

                });
        });
}

export function trashProfiles(p) {
    if (_remove.length > 0) {
        for (var r = 0, rl = _remove.length; r < rl; r++) {
            shell.moveItemToTrash(path.join(p, _remove[r] + ".json"));
            /*
            trash([path.join(p, _remove[r] + ".json")]).then(() => {
                if (r >= rl - 1)
                    ipcRenderer.send('reload-profiles');
            });
            */
        }
    }
}

export function saveProfiles() {
    if (!updateCurrent())
        return false;
    if (fchanged)
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
    fchanged = false;
    $('#btnRefresh').removeClass('btn-warning');
}

var editors = {};
var aceTooltip;

function initEditor(id) {
    var textarea = $('#' + id).hide();
    $('#' + id + 'Editor').css('display', 'block');
    ace.require("ace/ext/language_tools");
    editors[id] = ace.edit(id + "Editor");
    var session = editors[id].getSession();
    editors[id].$blockScrolling = Infinity;
    editors[id].getSelectedText = function () {
        return this.session.getTextRange(this.getSelectionRange());
    };

    if (!aceTooltip) {
        var Tooltip = ace.require("ace/tooltip").Tooltip;
        aceTooltip = new Tooltip($("#editor")[0]);
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
    _undo.push(data);
    _redo = [];
    updateUndoState();
    console.log(_undo);
}

export function updateUndoState() {
    $("#btnUndo").prop('disabled', _undo.length == 0);
    $("#btnRedo").prop('disabled', _redo.length == 0);
    console.log(_undo);
    console.log(_redo);
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

function DeleteProfile(profile) {
    if (!profile) profile = currentProfile;
    _remove.push(profile.name);
    pushUndo({ action: 'delete', type: 'profile', item: profile });
    var nodes = $("#tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + '$', 'id']);
    if (profile.name == currentProfile.name)
        $('#tree').treeview('selectNode', [$("#tree").treeview('findNodes', ["^Profiledefault$", 'id'])]);
    $('#tree').treeview('removeNode', [nodes, { silent: true }]);
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
            var n = $("#tree").treeview('findNodes', ["Profile" + profileID(profile.name) + key, 'id']);
            $('#tree').treeview('expandNode', [n, { levels: 1, silent: true }]);
            for (var i = profile[key].length - 1; i >= 0; i--) {
                _u.delete.unshift({ type: type, data: { key: key, idx: i, profile: profile.name.toLowerCase() }, item: profile[key][i] });
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

function DeleteItem(type, key, idx, profile?, customundo?) {
    var il, i, node, newNode, selected, item, name;
    if (!profile) profile = currentProfile;
    if (!customundo)
        pushUndo({ action: 'delete', type: type, data: { key: key, idx: idx, profile: profile.name.toLowerCase() }, item: profile[key][idx] });
    name = profileID(profile.name);
    node = $("#tree").treeview('findNodes', ["Profile" + name + key + idx, 'id']);
    if (node && node.length > 0 && node[0].state.selected)
        currentNode = null;
    $('#tree').treeview('removeNode', [node, { silent: true }]);
    profile[key].splice(idx, 1);
    var selected;
    if ((il = profile[key].length) > 0) {
        for (i = idx; i < il; i++) {
            node = $("#tree").treeview('findNodes', ["Profile" + name + key + (i + 1), 'id']);
            if (node && node.length > 0)
                node = node[0];
            else
                node = null;
            item = profile[key][i];
            newNode = {
                text: GetDisplay(item),
                id: "Profile" + name + key + i,
                dataAttr: {
                    type: type.toLowerCase(),
                    profile: profile.name.toLowerCase(),
                    index: i
                },
                state: {
                    checked: item.enabled,
                    selected: node && node.state ? node.state.selected : false
                }
            };
            if (node) {
                if (node.state && node.state.selected)
                    selected = newNode.id;
                $('#tree').treeview('updateNode', [node, newNode]);
            }
        }
        if (selected) {
            var node = $('#tree').treeview('findNodes', ['^' + selected + "$", 'id'])[0];
            currentNode = node;
            $('#tree').treeview('selectNode', [node]);
        }

    }
}

export function doClose() {
    if (_never || (_undo.length == 0 && !updateCurrent())) {
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
            var n = $("#tree").treeview('findNodes', ["Profile" + profileID(profile.name) + 'macros[0-9]+', 'id']);
            n = n.concat($("#tree").treeview('findNodes', ["Profile" + profileID(profile.name) + 'triggers[0-9]+', 'id']));
            n = n.concat($("#tree").treeview('findNodes', ["Profile" + profileID(profile.name) + 'buttons[0-9]+', 'id']));
            n = n.concat($("#tree").treeview('findNodes', ["Profile" + profileID(profile.name) + 'aliases[0-9]+', 'id']));
            $('#tree').treeview('removeNode', [n, { silent: true }]);

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
            o = $("#tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + 'aliases$', 'id']);
            $('#tree').treeview('updateNode', [o[0], n]);
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
            var o = $("#tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + 'macros$', 'id']);
            $('#tree').treeview('updateNode', [o[0], n]);

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
            var o = $("#tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + 'triggers$', 'id']);
            $('#tree').treeview('updateNode', [o[0], n]);
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
            var o = $("#tree").treeview('findNodes', ["^Profile" + profileID(profile.name) + 'buttons$', 'id']);
            $('#tree').treeview('updateNode', [o[0], n]);

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
                $("#enableAliases").prop("checked", currentProfile.enableAliases);
                $("#enableMacros").prop("checked", currentProfile.enableMacros);
                $("#enableTriggers").prop("checked", currentProfile.enableTriggers);
                $("#enableButtons").prop("checked", currentProfile.enableButtons);
                $("#enabled").prop("checked", currentProfile.enabled)
                $("#profilePriority").val(currentProfile.priority);
            }
            $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "macros$", 'id'])]);
            $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "aliases$", 'id'])]);
            $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "triggers$", 'id'])]);
            $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "buttons$", 'id'])]);
            $("#tree").treeview('checkNode', [$('#tree').treeview('findNodes', ['^Profile' + profileID(profile.name) + "$", 'id'])]);

        }
    });
}