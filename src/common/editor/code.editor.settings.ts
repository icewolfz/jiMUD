
const fs = require('fs-extra');
const path = require('path');

export class EditorSettings {
    public spellchecking = true;
    public recent = [];
    public opened = [];
    public maxRecent = 15;
    public reopen = true;
    public outputSize = 170;
    public output = false;
    public nativeIcons: boolean = false;
    public window = {
        persistent: false,
        alwaysOnTopClient: true,
        alwaysOnTop: false,
        show: false
    };
    public editorOptions = {
        "selectionStyle": "text",
        "highlightActiveLine": true,
        "highlightSelectedWord": true,
        "readOnly": false,
        "copyWithEmptySelection": false,
        "cursorStyle": "ace",
        "mergeUndoDeltas": true,
        "behavioursEnabled": true,
        "wrapBehavioursEnabled": true,
        "hScrollBarAlwaysVisible": false,
        "vScrollBarAlwaysVisible": false,
        "highlightGutterLine": true,
        "animatedScroll": false,
        "showInvisibles": false,
        "showPrintMargin": true,
        "printMarginColumn": 80,
        "printMargin": 80,
        "fadeFoldWidgets": false,
        "showFoldWidgets": true,
        "showLineNumbers": true,
        "showGutter": true,
        "displayIndentGuides": true,
        "fontSize": 12,
        "scrollPastEnd": 0,
        "theme": "ace/theme/visual_studio",
        "maxPixelHeight": 0,
        "scrollSpeed": 2,
        "dragDelay": 0,
        "dragEnabled": true,
        "focusTimeout": 0,
        "tooltipFollowsMouse": true,
        "firstLineNumber": 1,
        "overwrite": false,
        "newLineMode": "unix",
        "useWorker": true,
        "useSoftTabs": true,
        "navigateWithinSoftTabs": false,
        "tabSize": 3,
        "wrap": "off",
        "indentedSoftWrap": true,
        "foldStyle": "markbegin",
        "mode": "ace/mode/lpc",
        "enableMultiselect": true,
        "enableBlockSelect": true,
        "enableBasicAutocompletion": true,
        "enableLiveAutocompletion": true,
        "enableSnippets": true,
        "spellcheck": true
    };

    public static load(file) {
        try {
            if (!fs.statSync(file).isFile())
                return new EditorSettings();
        }
        catch (err) {
            return new EditorSettings();
        }
        let data = fs.readFileSync(file, 'utf-8');
        if (data.length === 0)
            return new EditorSettings();
        try {
            data = JSON.parse(data);
        }
        catch (e) {
            return new EditorSettings();
        }
        const settings = new EditorSettings();
        let prop;
        let prop2;

        for (prop in data) {
            if (!data.hasOwnProperty(prop)) {
                continue;
            }
            if (prop === 'editorOptions') {
                for (prop2 in data[prop]) {
                    if (!data[prop].hasOwnProperty(prop2)) {
                        continue;
                    }
                    settings[prop][prop2] = data[prop][prop2];
                }
            }
            else
                settings[prop] = data[prop];
        }
        return settings;
    }
    public save(file) {
        fs.writeFileSync(file, JSON.stringify(this));
    }
}