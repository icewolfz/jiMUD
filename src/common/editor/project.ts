import { isFileSync } from '../library';
const fs = require('fs');

class ProjectItem {
    public name;
    public file;
    public children: ProjectItem[];
}

class Project {
    public name: string;
    public file: string;
    public items: ProjectItem[];

    constructor(file?, data?) {
        if (typeof file === 'string')
            this.file = file;
        else if (typeof file === 'object' && !data)
            data = file;
        if (data) {
            let prop;
            for (prop in data) {
                if (!data.hasOwnProperty(prop))
                    continue;
                this[prop] = data[prop];
            }
        }

    }

    public static load(file) {
        let data;
        if (typeof file === 'string') {
            if (!isFileSync(file))
                return null;
            data = fs.readFileSync(file, 'utf-8');
            if (data.length === 0)
                return new Project(file);
            try {
                data = JSON.parse(data);
            }
            catch (e) {
                return new Project(file);
            }
            return new Project(file, data);
        }
        return new Project(file);
    }

    public save() {
        if (!this.file || this.file.length === 0) return false;
        fs.writeFileSync(this.file, JSON.stringify(this, (key, value) => {
            if (key === 'file') return undefined;
            return value;
        }));
        return true;
    }
}