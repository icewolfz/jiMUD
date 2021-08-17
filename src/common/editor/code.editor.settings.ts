//spellchecker:ignore Consolas
const fs = require('fs-extra');

export class EditorSettings {
    public debug = false;
    public recent = [];
    public opened = [];
    public layout = [1];
    public cacheRemote = true;
    public viewState = true;
    public maxRecent = 15;
    public reopen = true;
    public lastActive = '';
    public outputSize = 170;
    public output = false;
    public nativeIcons: boolean = false;
    public spellchecking: true;
    public remote = '.';
    public uploadAs;
    public enableBackgroundThrottling: boolean = true;

    public window = {
        persistent: false,
        alwaysOnTopClient: true,
        alwaysOnTop: false,
        show: false
    };

    public modelOptions = {
        tabSize: 3,
        insertSpaces: true,
        trimAutoWhitespace: true
    };

    public editorOptions = {
        acceptSuggestionOnEnter: 'on',
        autoClosingBrackets: true,
        autoIndent: true,
        cursorBlinking: 'blink',
        cursorStyle: 'line',
        emptySelectionClipboard: true,
        find: {
            seedSearchStringFromSelection: 'selection'
        },
        folding: true,
        fontSize: 14,
        fontFamily: 'Consolas, \'Courier New\', monospace',
        fontWeight: 'normal',
        lineNumbers: 'on',
        links: true,
        matchBrackets: true,
        quickSuggestions: true,
        renderWhitespace: 'none',
        renderControlCharacters: false,
        roundedSelection: true,
        selectOnLineNumbers: true,
        showFoldingControls: 'mouseover',
        snippetSuggestions: 'inline',
        useTabStops: true,
        scrollBeyondLastLine: true,
        minimap: {
            enabled: true,
            maxColumn: 120,
            renderCharacters: true,
            showSlider: 'mouseover',
            side: 'right'
        }
    };

    public virtualOptions = {
        allowResize: false,
        allowExitWalk: true,
        showColors: true,
        showTerrain: true,
        rawFontSize: 16,
        rawFontFamily: 'Consolas, \'Courier New\', monospace',
        rawFontWeight: 'normal',
        previewFontSize: 15,
        previewFontFamily: 'Consolas, \'Courier New\', monospace',
        editorWidth: 200,
        previewHeight: 200,
        live: true,
        showRoomEditor: true,
        showRoomPreview: true,
        rawSpellcheck: false,
        descriptionOnDelete: 2,
        itemOnDelete: 1,
        enterMoveNext: true,
        enterMoveFirst: true,
        enterMoveNew: true
    };

    public designOptions = {
        allowResize: true,
        allowExitWalk: true,
        previewFontSize: 15,
        previewFontFamily: 'Consolas, \'Courier New\', monospace',
        editorWidth: 300,
        previewHeight: 200,
        live: true,
        showRoomEditor: true,
        showRoomPreview: true,
        enterMoveNext: true,
        enterMoveFirst: true,
        enterMoveNew: true
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
            if (prop === 'designOptions' || prop === 'editorOptions' || prop === 'modelOptions' || prop === 'virtualOptions') {
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