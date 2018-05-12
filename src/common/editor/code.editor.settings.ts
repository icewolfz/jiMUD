
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
    public editorOptions = {};

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