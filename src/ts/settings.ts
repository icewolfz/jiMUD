//cSpell:words vscroll, hscroll, askoncancel, askonclose,commandon, cmdfont
//cSpell:ignore emoteto, emotetos
const path = require('path');
const fs = require('fs');

export interface WindowState {
	x: number;
	y: number;
	width: number;
	height: number;
	fullscreen: boolean;
	maximized: boolean;
	devTools: boolean;
}

export enum BackupSelection {
	None = 0,
	Map = 2,
	Profiles = 4,
	Settings = 8,
	All = Map | Profiles | Settings
}


export class Mapper {
	public enabled: boolean = true;
	public follow: boolean = true;
	public legend: boolean = false;
	public split: boolean = false;
	public fill: boolean = false;
	public room: boolean = false;
	public importType = 1;
	public vscroll: number = 0;
	public hscroll: number = 0;
	public alwaysOnTop: boolean = false;
	public alwaysOnTopClient: boolean = true;
	public memory: boolean = false;
	public memorySavePeriod: number = 900000;
	public active =
	{
		ID: null,
		x: 0,
		y: 0,
		z: 0,
		area: null,
		zone: 0
	};
	public persistent: boolean = true;
}

export class Profiles {
	public split: number = -1;
	public askoncancel: boolean = true;
	public triggersAdvanced: boolean = false;
	public aliasesAdvanced: boolean = false;
	public buttonsAdvanced: boolean = false;
	public macrosAdvanced: boolean = false;
	public contextsAdvanced: boolean = false;
}

export class Chat {
	//chat lines
	public captureLines: boolean = false;
	public captureAllLines: boolean = false;
	//reviews for lines, tell or talking
	public captureReviews: boolean = false;
	//tell and emotetos
	public captureTells: boolean = false;
	//Say, whisper, yells, and speak
	public captureTalk: boolean = false;
	//list of lines to capture
	public lines: string[] = [];
	public alwaysOnTop: boolean = false;
	public alwaysOnTopClient: boolean = true;
	public log: boolean = false;
	public persistent: boolean = false;
}

export class Settings {
	public editorPersistent: boolean = false;
	public AutoCopySelectedToClipboard: boolean = false;
	public askonclose: boolean = true;
	public dev: boolean = false;
	public mapper: Mapper = new Mapper();
	public profiles: Profiles = new Profiles();
	public chat: Chat = new Chat();
	public showScriptErrors: boolean = false;
	public title: string = "$t";
	public flashing: boolean = false;
	public lagMeter: boolean = true;
	public enablePing: boolean = true;
	public parseSingleQuotes: boolean = false;
	public logEnabled: boolean = false;
	public logOffline: boolean = false;
	public logPrepend: boolean = false;
	public logGagged: boolean = false;
	public notifyMSPPlay: boolean = false;
	public bufferSize: number = 5000;
	public commandHistorySize: number = 20;
	public enableEcho: boolean = true;
	public autoConnect: boolean = true;
	public commandEcho: boolean = true;
	public enableAliases: boolean = true;
	public enableTriggers: boolean = true;
	public enableButtons: boolean = true;
	public enableMacros: boolean = true;
	public enableContexts: boolean = true;
	public commandStacking: boolean = true;
	public htmlLog: boolean = true;
	public keepLastCommand: boolean = true;
	public enableMXP: boolean = true;
	public enableMSP: boolean = true;
	public enableMCCP: boolean = true;
	public enableUTF8: boolean = true;
	public enableDebug: boolean = false;
	public parseCommands: boolean = true;
	public enableSpeedpaths: boolean = true;
	public parseSpeedpaths: boolean = true;

	public parseDoubleQuotes: boolean = true;
	public logUniqueOnConnect: boolean = true;
	public enableURLDetection: boolean = true;
	public CommandonClick: boolean = true;
	public cmdfontSize: string = "1em";
	public fontSize: string = "1em";
	public cmdfont: string = "'Courier New', Courier, monospace";
	public font: string = "'Courier New', Courier, monospace";

	public commandStackingChar: string = ';';
	public speedpathsChar: string = '!';
	public commandDelay: number = 500;
	public commandDelayCount: number = 5;

	public colors: string[] = [];

	public soundPath = path.join("{data}", "sounds");
	public logPath = path.join("{data}", "logs");
	public theme = path.join("{themes}", "default");

	public windows = {};
	public buttons = {
		connect: true,
		preferences: true,
		log: true,
		clear: true,
		lock: true,
		map: true,
		user: true
	};

	public find = {
		case: false,
		word: false,
		reverse: false,
		regex: false,
		selection: false,
		show: false
	}
	public backupLoad:BackupSelection = BackupSelection.All;
	public backupSave:BackupSelection = BackupSelection.All;

	public scrollLocked: boolean = false;
	public showStatus: boolean = true;
	public showMapper: boolean = false;
	public showChat: boolean = false;
	public showEditor: boolean = false;
	public showArmor: boolean = false;
	public showStatusWeather: boolean = true;
	public showStatusLimbs: boolean = true;
	public showStatusHealth: boolean = true;
	public showStatusExperience: boolean = true;
	public showStatusPartyHealth: boolean = true;
	public showStatusCombatHealth: boolean = true;
	public showButtonBar: boolean = true;
	public allowNegativeNumberNeeded = false;

	static load(file) {
		if (!fs.existsSync(file))
			return new Settings();
		var data = fs.readFileSync(file, 'utf-8');
		if (data.length == 0)
			return new Settings();
		try {
			data = JSON.parse(data);
		}
		catch (e) {
			return new Settings();
		}
		var settings = new Settings();

		for (var prop in data) {
			if (!data.hasOwnProperty(prop)) {
				continue;
			}
			if (prop == 'mapper' || prop == 'profiles' || prop == 'buttons' || prop == 'chat' || prop == 'find') {
				for (var prop2 in data[prop]) {
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

	static getColors() {
		var _ColorTable = [];
		var r, g, b, idx;
		for (r = 0; r < 6; r++) {
			for (g = 0; g < 6; g++) {
				for (b = 0; b < 6; b++) {
					idx = 16 + (r * 36) + (g * 6) + b;
					_ColorTable[idx] = "rgb(";
					if (r > 0)
						_ColorTable[idx] += r * 40 + 55;
					else
						_ColorTable[idx] += "0";
					_ColorTable[idx] += ",";
					if (g > 0)
						_ColorTable[idx] += g * 40 + 55;
					else
						_ColorTable[idx] += "0";
					_ColorTable[idx] += ",";
					if (b > 0)
						_ColorTable[idx] += b * 40 + 55;
					else
						_ColorTable[idx] += "0";
					_ColorTable[idx] += ")";
				}
			}
		}
		for (r = 232; r <= 255; r++) {
			g = (r - 232) * 10 + 8;
			_ColorTable[r] = ["rgb(", g, ",", g, ",", g, ")"].join('');
		}
		_ColorTable[0] = "rgb(0,0,0)"; //black fore
		_ColorTable[1] = "rgb(128, 0, 0)"; //red fore
		_ColorTable[2] = "rgb(0, 128, 0)"; //green fore
		_ColorTable[3] = "rgb(128, 128, 0)"; //yellow fore
		_ColorTable[4] = "rgb(0, 0, 238)"; //blue fore
		_ColorTable[5] = "rgb(128, 0, 128)"; //magenta fore
		_ColorTable[6] = "rgb(0, 128, 128)"; //cyan fore
		_ColorTable[7] = "rgb(187, 187, 187)"; //white fore
		_ColorTable[8] = "rgb(128, 128, 128)"; //black  bold
		_ColorTable[9] = "rgb(255, 0, 0)"; //Red bold
		_ColorTable[10] = "rgb(0, 255, 0)"; //green bold
		_ColorTable[11] = "rgb(255, 255, 0)"; //yellow bold
		_ColorTable[12] = "rgb(92, 92, 255)"; //blue bold
		_ColorTable[13] = "rgb(255, 0, 255)"; //magenta bold
		_ColorTable[14] = "rgb(0, 255, 255)"; //cyan bold
		_ColorTable[15] = "rgb(255, 255, 255)"; //white bold
		_ColorTable[256] = "rgb(0, 0, 0)"; //black faint
		_ColorTable[257] = "rgb(118, 0, 0)"; //red  faint
		_ColorTable[258] = "rgb(0, 108, 0)"; //green faint
		_ColorTable[259] = "rgb(145, 136, 0)"; //yellow faint
		_ColorTable[260] = "rgb(0, 0, 167)"; //blue faint
		_ColorTable[261] = "rgb(108, 0, 108)"; //magenta faint
		_ColorTable[262] = "rgb(0, 108, 108)"; //cyan faint
		_ColorTable[263] = "rgb(161, 161, 161)"; //white faint
		_ColorTable[264] = "rgb(0, 0, 0)"; //BackgroundBlack
		_ColorTable[265] = "rgb(128, 0, 0)"; //red back
		_ColorTable[266] = "rgb(0, 128, 0)"; //greenback
		_ColorTable[267] = "rgb(128, 128, 0)"; //yellow back
		_ColorTable[268] = "rgb(0, 0, 238)"; //blue back
		_ColorTable[269] = "rgb(128, 0, 128)"; //magenta back
		_ColorTable[270] = "rgb(0, 128, 128)"; //cyan back
		_ColorTable[271] = "rgb(187, 187, 187)"; //white back
		_ColorTable[272] = "rgb(0,0,0)"; //iceMudInfoBackground
		_ColorTable[273] = "rgb(0, 255, 255)"; //iceMudInfoText
		_ColorTable[274] = "rgb(0,0,0)"; //LocalEchoBackground
		_ColorTable[275] = "rgb(255, 255, 0)"; //LocalEchoText
		_ColorTable[276] = "rgb(0, 0, 0)"; //DefaultBack
		_ColorTable[277] = "rgb(229, 229, 229)"; //DefaultFore
		_ColorTable[278] = "rgb(205, 0, 0)"; //ErrorFore
		_ColorTable[279] = "rgb(229, 229, 229)"; //ErrorBack
		_ColorTable[280] = "rgb(255,255,255)"; //DefaultBrightFore
		return _ColorTable;
	}

	save(file) {
		fs.writeFileSync(file, JSON.stringify(this));
	}
}