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
    public outputTab = 0;
    public nativeIcons: boolean = false;
    public spellchecking: true;
    public remote = '.';
    public uploadAs;
    public enableBackgroundThrottling: boolean = true;
    public theme: number = 0;
    public dictionary = [];
    public session = '';
    public recentSessions = [];
    public includePaths = [];
    public hideOpenRecent: boolean = true;

    public window = {
        persistent: false,
        alwaysOnTopClient: true,
        alwaysOnTop: false,
        show: false
    };

    public modelOptions = {
        tabSize: 3,
        insertSpaces: true,
        trimAutoWhitespace: true,
        bracketColorization: true
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
        matchBrackets: 'always',
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
        },
        bracketPairColorization: {
            enabled: true
        },
        guides: {
            bracketPairs: true,
            highlightActiveIndentation: true,
            indentation: true
        },
        dropIntoEditor: {
            enabled: false
        },
        wordWrap: 'off',
        wordWrapOverride2: 'off',
        columnSelectionMode: false
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
        monsterPreviewHeight: 200,
        live: true,
        showRoomEditor: true,
        showRoomPreview: true,
        showMonsterPreview: true,
        enterMoveNext: true,
        enterMoveFirst: true,
        enterMoveNew: true,
        roomEditorStates: [],
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
                    if (prop2 === 'matchBrackets' && data[prop][prop2] === true)
                        settings[prop][prop2] = 'always';
                    else
                        settings[prop][prop2] = data[prop][prop2];
                }
            }
            else
                settings[prop] = data[prop];
        }
        if (settings.editorOptions.find.seedSearchStringFromSelection !== 'selection' &&
            settings.editorOptions.find.seedSearchStringFromSelection !== 'never' &&
            settings.editorOptions.find.seedSearchStringFromSelection !== 'always')
            settings.editorOptions.find.seedSearchStringFromSelection = settings.editorOptions.find.seedSearchStringFromSelection ? 'selection' : 'never';
        return settings;
    }
    public save(file) {
        fs.writeFileSync(file, JSON.stringify(this));
    }
}