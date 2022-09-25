// spell-checker:word omud
// spell-checker:ignore hasmembers, hpmax, spmax, mpmax,
// spell-checker:ignore righthoof, rightfoot, lefthoof, leftfoot, rightarm, leftarm, rightleg, leftleg, righthand, lefthand, leftwing, rightwing
import EventEmitter = require('events');
import { Client } from './client';

export enum UpdateType { none = 0, sortCombat = 1, sortParty = 2, overall = 4, xp = 8, status = 16 }

/**
 * Status display control
 *
 * @export
 * @class Status
 * @extends {EventEmitter}
 */
export class Status extends EventEmitter {
    private info = [];
    private infoAC = [];
    private infoLimb = [];
    private _ac: boolean = false;
    private lagMeter: HTMLElement;
    private _updating: UpdateType;
    private _rTimeout = 0;
    private dragging = false;
    private _splitterDistance;

    public client: Client;

    constructor(client: Client, options?) {
        super();
        this.client = client;
        if (options) {
            if ('splitterDistance' in options)
                this.splitterDistance = options.splitterDistance;
            if ('ac' in options)
                this.ac = options.ac;
        }
        this.lagMeter = document.getElementById('lagMeter');
        this.client.telnet.on('latency-changed', (lag, avg) => {
            this.updateLagMeter(lag);
        });
        this.client.on('closed', () => {
            this.updateLagMeter(0, true);
        });
        this.client.telnet.GMCPSupports.push('oMUD 1');
        this.client.telnet.GMCPSupports.push('Char.Skills 1');
        this.client.on('add-line', (data) => {
            if (data.line === 'Connected...')
                this.init();
        });
        this.client.on('options-loaded', () => {
            this.info['EXPERIENCE_NEED'] = this.info['EXPERIENCE_NEED_RAW'] - this.info['EXPERIENCE'];
        });

        this.client.on('received-GMCP', async (mod, obj) => {
            let limb;
            switch (mod.toLowerCase()) {
                case 'char.base':
                    this.init();
                    this.info['name'] = obj.name;
                    this.setTitle(obj.name);
                    break;
                case 'char.vitals':
                    this.updateBar('hp-bar', obj.hp, obj.hpmax);
                    this.updateBar('sp-bar', obj.sp, obj.spmax);
                    this.updateBar('mp-bar', obj.mp, obj.mpmax);
                    this.info['hp'] = obj.hp;
                    this.info['hpmax'] = obj.hpmax;
                    this.info['sp'] = obj.sp;
                    this.info['spmax'] = obj.spmax;
                    this.info['mp'] = obj.mp;
                    this.info['mpmax'] = obj.mpmax;
                    this.doUpdate(UpdateType.overall);
                    break;
                case 'char.experience':
                    this.info['EXPERIENCE'] = obj.current;
                    this.info['EXPERIENCE_NEED_RAW'] = obj.need;
                    this.info['EXPERIENCE_NEED'] = obj.need - obj.current;
                    this.info['EXPERIENCE_NEED_P'] = obj.needPercent;
                    //if (this.info['EXPERIENCE_NEED'] < 0 && !this.client.options.allowNegativeNumberNeeded)
                    //this.info['EXPERIENCE_NEED'] = 0;

                    this.info['EXPERIENCE_EARNED'] = obj.earned;
                    this.info['EXPERIENCE_BANKED'] = obj.banked;
                    this.doUpdate(UpdateType.xp);
                    break;
                case 'omud.ac':
                    for (limb in obj) {
                        if (!obj.hasOwnProperty(limb)) continue;
                        this.setLimbAC(limb, obj[limb]);
                        this.updateLimb(limb);
                    }
                    break;
                case 'omud.limb':
                    for (limb in obj) {
                        if (!obj.hasOwnProperty(limb)) continue;
                        this.setLimbHealth(limb, obj[limb]);
                        this.updateLimb(limb);
                    }
                    break;
                case 'omud.weapons':
                    for (limb in obj) {
                        if (!obj.hasOwnProperty(limb)) continue;
                        this.setWeapon(limb, obj[limb]);
                    }
                    break;
                case 'omud.environment':
                    if (obj.weather) {
                        const env = document.getElementById('environment');
                        //env.className = env.className.split(' ').filter(c => !c.match(/^(weather-.*|intensity-hard)$/)).join(' ');
                        env.classList.remove('weather-' + this.info['WEATHER'], 'intensity-hard');
                        this.info['WEATHER'] = obj.weather;
                        this.info['WEATHER_INTENSITY'] = obj.weather_intensity;
                        if (obj.weather !== '0' && obj.weather !== 'none')
                            env.classList.add('weather-' + obj.weather);
                        if (obj.weather_intensity > 6)
                            env.classList.add('intensity-hard');
                    }
                    if (obj.tod) {
                        $('#environment').removeClass('day night twilight dawn').addClass(obj.tod);
                        $('#environment').removeClass((index, className) => {
                            return (className.match(/(^|\s)moon\d-\S+/g) || []).join(' ');
                        });
                        if (obj.moons) {
                            $('#environment').addClass('moon1-' + obj.moons[0]);
                            $('#environment').addClass('moon2-' + obj.moons[1]);
                            $('#environment').addClass('moon3-' + obj.moons[2]);
                        }
                    }
                    break;
                case 'omud.combat':
                    if (obj.action === 'leave') {
                        this.clear('combat');
                        this.emit('leave combat');
                    }
                    else if (obj.action === 'add')
                        this.createIconBar('#combat', this.getID(obj, 'combat_'), obj.name, obj.hp, 100, this.livingClass(obj, 'monster-'), obj.order);
                    else if (obj.action === 'update') {
                        if (obj.hp === 0)
                            this.removeBar(this.getID(obj, 'combat_'));
                        else
                            this.createIconBar('#combat', this.getID(obj, 'combat_'), obj.name, obj.hp, 100, this.livingClass(obj, 'monster-'), obj.order);
                    }
                    else if (obj.action === 'remove')
                        this.removeBar(this.getID(obj, 'combat_'));
                    break;
                case 'omud.party':
                    if (obj.action === 'leave') {
                        this.clear('party');
                        this.emit('leave party');
                    }
                    else if (obj.action === 'add') {
                        this.createIconBar('#party', this.getID(obj, 'party_'), obj.name, obj.hp, 100, this.livingClass(obj, 'party-'), obj.name.replace('"', ''));
                    }
                    else if (obj.action === 'update') {
                        if (obj.hp === 0)
                            this.removeBar(this.getID(obj, 'party_'), true);
                        else
                            this.createIconBar('#party', this.getID(obj, 'party_'), obj.name, obj.hp, 100, this.livingClass(obj, 'party-'), obj.name.replace('"', ''));
                    }
                    else if (obj.action === 'remove')
                        this.removeBar(this.getID(obj, 'party_'), true);

                    if ((limb = document.getElementById('party')).children.length)
                        limb.classList.add('hasmembers');
                    else
                        limb.classList.remove('hasmembers');
                    break;
                case 'omud.skill':
                    if (obj.skill && obj.skill.length) {
                        if (!this.info['skills'][obj.skill]) this.info['skills'][obj.skill] = { amount: 0, bonus: 0, percent: 0 };
                        if (obj.hasOwnProperty('percent'))
                            this.info['skills'][obj.skill].percent = obj.percent || 0;
                        if (obj.hasOwnProperty('amount')) {
                            this.info['skills'][obj.skill].amount = obj.amount;
                            this.info['skills'][obj.skill].bonus = obj.bonus || 0;
                            this.info['skills'][obj.skill].category = obj.category;
                        }
                        this.emit('skill updated', obj.skill, this.info['skills'][obj.skill]);
                    }
                    break;
            }
        });
        $('#status-drag-bar').mousedown((e) => {
            if (e.buttons !== 1) return;
            e.preventDefault();

            this.dragging = true;
            const main = $('#status-drag-bar');
            const ghostBar = $('<div>',
                {
                    id: 'status-ghost-bar',
                    css: {
                        height: main.outerHeight(),
                        top: main.offset().top,
                        left: main.offset().left
                    }
                }).appendTo('body');
            const w1 = $('#status-border').css('width');
            $('#status-border').css('width', '');
            const w2 = $('#status').css('width');
            $('#status').css('width', '');
            const minWidth = $('#status').offset().left;
            const l = main.offset().left;
            $('#status-border').css('width', w1);
            $('#status').css('width', w2);
            const maxWidth = Math.floor(document.body.clientWidth / 2);
            $(document).mousemove((event) => {
                if (event.pageX < maxWidth)
                    ghostBar.css('left', maxWidth);
                else if (event.pageX > l)
                    ghostBar.css('left', l);
                else
                    ghostBar.css('left', event.pageX);
            });
        });

        $(window).on('resize', () => this.resize());

        $(document).mouseup((e) => {
            if (this.dragging) {
                const w1 = $('#status-border').css('width');
                $('#status-border').css('width', '');
                const w2 = $('#status').css('width');
                $('#status').css('width', '');
                const minWidth = parseInt($('#status-border').css('width'), 10) || (parseInt($('#status').css('width'), 10) + parseInt($('#status').css('right'), 10) * 2);
                const maxWidth = Math.floor(document.body.clientWidth / 2);
                const l = $('#status-drag-bar').offset().left;
                $('#status-border').css('width', w1);
                $('#status').css('width', w2);
                if (e.pageX < maxWidth)
                    this.splitterDistance = maxWidth - parseInt($('#status-drag-bar').css('left'), 10);
                else if (e.pageX > l)
                    this.splitterDistance = minWidth;
                else
                    this.splitterDistance = document.body.clientWidth - e.pageX + Math.abs(parseInt($('#status-drag-bar').css('left'), 10));
                $('#status-ghost-bar').remove();
                $(document).unbind('mousemove');
                this.dragging = false;
                this.updateInterface();
            }
        });

        this.updateInterface();
        this.init();
    }

    get splitterDistance(): number { return this._splitterDistance; }
    set splitterDistance(value: number) {
        if (value === this._splitterDistance) return;
        this._splitterDistance = value;
        this.updateSplitter();
    }

    private updateSplitter() {
        const p = parseInt($('#status').css('right'), 10) * 2;
        if (!this._splitterDistance || this._splitterDistance < 1) {
            const b = Math.abs(parseInt($('#status-drag-bar').css('left'), 10)) + $('#status-drag-bar').outerWidth();
            this._splitterDistance = parseInt($('#status-border').css('width'), 10) || parseInt($('#status').css('width'), 10) - b;
        }
        if (!this.client.options.showStatus)
            this.updateInterface();
        else {
            $('#display').css('right', this._splitterDistance);
            $('#status').css('width', this._splitterDistance - p);
            $('#status-border').css('width', this._splitterDistance);
            $('#command').css('right', this._splitterDistance);
        }
        this.emit('split-moved', this._splitterDistance);
    }

    public resize() {
        if(!this.client.options.showStatus) return;
        const w1 = $('#status-border').css('width');
        $('#status-border').css('width', '');
        const w2 = $('#status').css('width');
        $('#status').css('width', '');
        const minWidth = parseInt($('#status').css('width'), 10);
        const minWidth2 = parseInt($('#status-border').css('width'), 10) || (parseInt($('#status').css('width'), 10) + parseInt($('#status').css('right'), 10) * 2);
        const maxWidth = Math.floor(document.body.clientWidth / 2);
        const l = $('#status-drag-bar').offset().left;
        $('#status-border').css('width', w1);
        $('#status').css('width', w2);
        if ($('#status').outerWidth() < minWidth) {
            this.splitterDistance = minWidth2;
        }
        else if ($('#status').outerWidth() > maxWidth) {
            this.splitterDistance = maxWidth - parseInt($('#status-drag-bar').css('left'), 10);
        }
    }

    get skills() {
        return this.info['skills'];
    }

    public getSkill(skill: string) {
        if (!skill) return 0;
        return this.info['skills'][skill] || 0;
    }

    get name() {
        return this.info['name'];
    }

    get ac(): boolean {
        return this._ac;
    }

    set ac(enable: boolean) {
        if (this._ac !== enable) {
            this._ac = enable;
            this.doUpdate(UpdateType.status);
            this.emit('display-changed');
        }
    }

    private sanitizeID(id: string): string {
        id = id.replace(/\s/gi, '-');
        return id.replace(/[^a-zA-Z0-9_-]/gi, '');
    }

    private getID(obj, prefix?: string): string {
        if (!obj) return;
        if (!obj.id) return this.sanitizeID(obj.name || '');
        return (prefix || 'obj_') + obj.id;
    }

    private livingClass(obj, prefix?: string): string {
        const cls = [];
        if (!prefix) prefix = '';
        if (obj.class && obj.class.length > 0)
            cls.push(prefix + this.sanitizeID(obj.class));
        if (obj.gender && obj.gender.length > 0)
            cls.push(prefix + this.sanitizeID(obj.gender));
        if (obj.race && obj.race.length > 0)
            cls.push(prefix + this.sanitizeID(obj.race));
        if (obj.guild && obj.guild.length > 0)
            cls.push(prefix + this.sanitizeID(obj.guild));
        if (obj.name && obj.name.length > 0)
            cls.push(prefix + this.sanitizeID(obj.name.replace(/\d+$/, '').trim()));
        return cls.join(' ').toLowerCase();
    }

    public setWeapon(limb, weapon) {
        const l = limb;
        limb = limb.replace(/\s/g, '');
        limb = limb.toLowerCase();
        const eLimb = document.getElementById(limb + 'weapon');
        if (!eLimb)
            return;
        eLimb.className = '';
        if (!weapon) return;
        if (weapon.quality && weapon.quality.length > 0)
            eLimb.classList.add('weapon-' + this.sanitizeID(weapon.quality));
        if (weapon.material && weapon.material.length > 0)
            eLimb.classList.add('weapon-' + this.sanitizeID(weapon.material));
        if (weapon.type && weapon.type.length > 0)
            eLimb.classList.add('weapon-' + this.sanitizeID(weapon.type));
        if (weapon.subtype && weapon.subtype.length > 0)
            eLimb.classList.add('weapon-' + this.sanitizeID(weapon.subtype));
        if (weapon.name && weapon.name.length > 0)
            eLimb.classList.add('weapon-' + this.sanitizeID(weapon.name));
        if (weapon.dominant)
            eLimb.classList.add('weapon-dominant');
        if (weapon.subtype && weapon.subtype.length > 0)
            eLimb.title = weapon.subtype + ' in ' + l;
        else if (weapon.type && weapon.type.length > 0)
            eLimb.title = weapon.type + ' in ' + l;
        else
            eLimb.title = 'weapon in ' + l;
    }

    public setLimbAC(limb, ac) {
        limb = limb.replace(/\s/g, '');
        limb = limb.toLowerCase();
        if (limb === 'righthoof')
            limb = 'rightfoot';
        else if (limb === 'lefthoof')
            limb = 'leftfoot';
        this.infoAC[limb] = ac;
    }

    public setLimbHealth(limb, health) {
        limb = limb.replace(/\s/g, '');
        limb = limb.toLowerCase();
        if (limb === 'righthoof')
            limb = 'rightfoot';
        else if (limb === 'lefthoof')
            limb = 'leftfoot';
        this.infoLimb[limb] = health;
    }

    public setTitle(title: string, lag?: string) {
        if (!title || title.length === 0) {
            $('#character-name').html('&nbsp;');
        }
        else {
            $('#character-name').text(title);
        }
        this.emit('set-title', title || '', lag || '');
    }

    public updateOverall() {
        const el = document.getElementById('overall');
        el.className = '';
        if (this._ac) {
            if (this.infoAC['overall'] === 6.5) {
                el.textContent = 'Extensively';
                el.classList.add('armor-extensively');
            }
            else if (this.infoAC['overall'] === 6) {
                el.textContent = 'Completely';
                el.classList.add('armor-completely');
            }
            else if (this.infoAC['overall'] === 5.5) {
                el.textContent = 'Significantly';
                el.classList.add('armor-significantly');
            }
            else if (this.infoAC['overall'] === 5) {
                el.textContent = 'Considerably';
                el.classList.add('armor-considerably');
            }
            else if (this.infoAC['overall'] === 4.5) {
                el.textContent = 'Well';
                el.classList.add('armor-well');
            }
            else if (this.infoAC['overall'] === 4) {
                el.textContent = 'Adequately';
                el.classList.add('armor-adequately');
            }
            else if (this.infoAC['overall'] === 3.5) {
                el.textContent = 'Fairly';
                el.classList.add('armor-fairly');
            }
            else if (this.infoAC['overall'] === 3) {
                el.textContent = 'Moderately';
                el.classList.add('armor-moderately');
            }
            else if (this.infoAC['overall'] === 2.5) {
                el.textContent = 'Somewhat';
                el.classList.add('armor-somewhat');
            }
            else if (this.infoAC['overall'] === 2) {
                el.textContent = 'Slightly';
                el.classList.add('armor-slightly');
            }
            else if (this.infoAC['overall'] === 1) {
                el.textContent = 'Barely';
                el.classList.add('armor-barely');
            }
            else {
                el.textContent = 'UNARMORED';
                el.classList.add('armor-unarmored');
            }
        }
        else {
            let v = 100;
            if (this.info['hpmax'] !== 0 && !isNaN(this.info['hpmax']))
                v *= this.info['hp'] / this.info['hpmax'];
            if (v > 90) {
                el.textContent = 'Top shape';
                el.classList.add('health-full');
            }
            else if (v > 75) {
                el.textContent = 'Decent shape';
                el.classList.add('health-1-19');
            }
            else if (v > 60) {
                el.textContent = 'Slightly injured';
                el.classList.add('health-20-39');
            }
            else if (v > 45) {
                el.textContent = 'Hurting';
                el.classList.add('health-40-59');
            }
            else if (v > 30) {
                el.textContent = 'Badly injured';
                el.classList.add('health-60-79');
            }
            else if (v > 15) {
                el.textContent = 'Terribly injured';
                el.classList.add('health-80-99');
            }
            else {
                el.textContent = 'Near death';
                el.classList.add('health-100');
            }
        }
    }

    public updateXP() {
        $('#xp-value').text(this.info['EXPERIENCE']);
        $('#xp-banked').text(this.info['EXPERIENCE_BANKED']);
        if (this.info['EXPERIENCE_NEED'] < 0) {
            $('#need-value').text(this.client.options.allowNegativeNumberNeeded ? this.info['EXPERIENCE_NEED'] : 0);
            this.updateBar('need-percent', 100 - this.info['EXPERIENCE_NEED_P'], 100, this.client.options.allowNegativeNumberNeeded ? this.info['EXPERIENCE_NEED'].toString() : '0');
        }
        else {
            $('#need-value').text(this.info['EXPERIENCE_NEED']);
            this.updateBar('need-percent', 100 - this.info['EXPERIENCE_NEED_P'], 100, this.info['EXPERIENCE_NEED'].toString());
        }
        $('#earn-value').text(this.info['EXPERIENCE_EARNED']);
    }

    public updateLimb(limb) {
        limb = limb.replace(/\s/g, '');
        limb = limb.toLowerCase();
        if (limb === 'overall') {
            this.doUpdate(UpdateType.overall);
            return;
        }
        if (limb === 'righthoof')
            limb = 'rightfoot';
        else if (limb === 'lefthoof')
            limb = 'leftfoot';
        const eLimb = document.getElementById(limb);
        if (!eLimb)
            return;
        eLimb.setAttribute('class', '');
        eLimb.style.display = 'block';
        eLimb.style.visibility = 'visible';
        if (this._ac) {
            if (this.infoAC[limb] === 6.5)
                eLimb.classList.add('armor-extensively');
            else if (this.infoAC[limb] === 6)
                eLimb.classList.add('armor-completely');
            else if (this.infoAC[limb] === 5.5)
                eLimb.classList.add('armor-significantly');
            else if (this.infoAC[limb] === 5)
                eLimb.classList.add('armor-considerably');
            else if (this.infoAC[limb] === 4.5)
                eLimb.classList.add('armor-well');
            else if (this.infoAC[limb] === 4)
                eLimb.classList.add('armor-adequately');
            else if (this.infoAC[limb] === 3.5)
                eLimb.classList.add('armor-fairly');
            else if (this.infoAC[limb] === 3)
                eLimb.classList.add('armor-moderately');
            else if (this.infoAC[limb] === 2.5)
                eLimb.classList.add('armor-somewhat');
            else if (this.infoAC[limb] === 2)
                eLimb.classList.add('armor-slightly');
            else if (this.infoAC[limb] === 1)
                eLimb.classList.add('armor-barely');
            else
                eLimb.classList.add('armor-unarmored');
        }
        else {
            if (this.infoLimb[limb] === 100)
                eLimb.classList.add('health-100');
            else if (this.infoLimb[limb] >= 80)
                eLimb.classList.add('health-80-99');
            else if (this.infoLimb[limb] >= 60)
                eLimb.classList.add('health-60-79');
            else if (this.infoLimb[limb] >= 40)
                eLimb.classList.add('health-40-59');
            else if (this.infoLimb[limb] >= 20)
                eLimb.classList.add('health-20-39');
            else if (this.infoLimb[limb] >= 1)
                eLimb.classList.add('health-1-19');
            else
                eLimb.classList.add('health-full');
        }
    }

    public updateStatus() {
        let limb;
        if (this._ac)
            for (limb in this.infoAC)
                this.updateLimb(limb);
        else
            for (limb in this.infoLimb)
                this.updateLimb(limb);
        this.doUpdate(UpdateType.overall | UpdateType.xp);
    }

    public init() {
        this.setTitle('');
        this.info = [];
        this.info['WEATHER'] = 'none';
        this.info['WEATHER_INTENSITY'] = 0;
        this.info['EXPERIENCE'] = 0;
        this.info['EXPERIENCE_NEED'] = 0;
        this.info['EXPERIENCE_NEED_P'] = 0;
        this.info['EXPERIENCE_NEED_RAW'] = 0;
        this.info['EXPERIENCE_EARNED'] = 0;
        this.info['EXPERIENCE_BANKED'] = 0;
        this.info['skills'] = {};

        this.infoAC = [];
        this.infoAC['head'] = 0;
        this.infoAC['leftarm'] = 0;
        this.infoAC['leftfoot'] = 0;
        this.infoAC['lefthand'] = 0;
        this.infoAC['leftleg'] = 0;
        this.infoAC['rightarm'] = 0;
        this.infoAC['rightfoot'] = 0;
        this.infoAC['righthand'] = 0;
        this.infoAC['rightleg'] = 0;
        this.infoAC['torso'] = 0;
        this.infoAC['overall'] = 0;

        this.infoLimb = [];
        this.infoLimb['head'] = 0;
        this.infoLimb['leftarm'] = 0;
        this.infoLimb['leftfoot'] = 0;
        this.infoLimb['lefthand'] = 0;
        this.infoLimb['leftleg'] = 0;
        this.infoLimb['rightarm'] = 0;
        this.infoLimb['rightfoot'] = 0;
        this.infoLimb['righthand'] = 0;
        this.infoLimb['rightleg'] = 0;
        this.infoLimb['torso'] = 0;

        document.getElementById('leftwing').style.display = 'none';
        document.getElementById('rightwing').style.display = 'none';
        document.getElementById('tail').style.display = 'none';
        this.updateBar('hp-bar', 0, 0);
        this.updateBar('sp-bar', 0, 0);
        this.updateBar('mp-bar', 0, 0);
        document.getElementById('xp-value').textContent = '0';
        document.getElementById('xp-banked').textContent = '0';
        document.getElementById('need-value').textContent = '0';
        document.getElementById('earn-value').textContent = '0';
        this.updateBar('need-percent', 0, 0, '0');
        this.clear('combat');
        this.clear('party');
        document.getElementById('earn-value').classList.remove('hasmembers');
        this.updateOverall();
        this.updateStatus();
        this.emit('skill init');
    }

    public updateBar(id: string, value: number, max?: number, text?: string) {
        const bar = document.getElementById(id);
        if (!bar)
            return;
        else {
            let p = 100;
            if (max !== 0)
                p = value / max * 100;
            bar.firstElementChild.textContent = text || (value + '/' + max);
            (<HTMLElement>bar.lastElementChild).style.width = (100 - p) + '%';
        }
    }

    public createIconBar(parent, id, label, value, max, icon?, order?) {
        let p = 100;
        if (max !== 0)
            p = value / max * 100;
        p = Math.floor(p);
        id = id.replace(' ', '');
        let bar: any = document.getElementById(id);
        if (!bar) {
            if (!icon)
                icon = label.replace(/\d+$/, '').trim().replace(' ', '-');
            bar = '<div title="' + label + '" class="combat-bar" id="' + id + '" data-value="' + ((100 - p) / 20 * 20) + '" data-order="' + order + '">';
            bar += '<div class="combat-icon ' + icon + '"></div>';
            bar += '<div class="combat-name"> ' + label + '</div>';
            bar += '<div class="progressbar"><div class="progressbar-text">' + p + '%</div>';
            bar += '<div class="progressbar-value" style="width: ' + (100 - p) + '%"></div>';
            bar += '</div></div>';
            $(parent).append(bar);
            this.doUpdate(parent === '#party' ? UpdateType.sortParty : UpdateType.sortCombat);
        }
        else {
            if (order !== +bar.getAttribute('data-order')) {
                bar.setAttribute('data-order', order);
                this.doUpdate(parent === '#party' ? UpdateType.sortParty : UpdateType.sortCombat);
            }
            bar.setAttribute('data-value', (100 - p) / 20 * 20);
            bar.children[1].textContent = label;
            p = value / max * 100;
            bar.lastElementChild.firstElementChild.textContent = Math.ceil(p) + '%';
            (<HTMLElement>bar.lastElementChild.lastElementChild).style.width = (100 - p) + '%';
        }
    }

    public removeBar(id, party?) {
        const el = document.getElementById(id);
        if (!el) return;
        el.parentNode.removeChild(el);
        this.doUpdate(party ? UpdateType.sortParty : UpdateType.sortCombat);
    }

    public sortBars(p) {
        const listItems = p.children('div').get();
        listItems.sort((a, b) => {
            const compA = +a.getAttribute('data-order');
            const compB = +b.getAttribute('data-order');
            return (compA < compB) ? -1 : (compA > compB) ? 1 : 0;
        });
        $.each(listItems, (idx, itm) => { p.append(itm); });
    }

    public updateLagMeter(lag: number, force?: boolean) {
        if (!this.lagMeter) return;
        if (this.client.options.showLagInTitle)
            this.setTitle(this.info['name'] || '', `${lag / 1000}s`);
        if (!this.client.options.lagMeter && !force) return;
        let p = 100;
        p = lag / 200 * 100;
        if (p > 100) p = 100;
        (<HTMLElement>this.lagMeter.lastElementChild).style.width = (100 - p) + '%';
        this.lagMeter.firstElementChild.textContent = (lag / 1000) + 's';
    }

    public updateInterface(noSplitter?) {
        const display = $('#display');
        const command = $('#command');
        const status = $('#status');
        const statusBorder = $('#status-border');
        display.css('right', '');
        command.css('right', '');
        if (!this.client.options.showStatus) {
            const w = statusBorder.outerWidth();
            let r;
            let t;
            status.css('visibility', 'hidden');
            status.css('display', 'none');
            statusBorder.css('visibility', 'hidden');
            statusBorder.css('display', 'none');
            r = parseInt(display.css('right'), 10) || 0;
            t = parseInt(display.css('top'), 10) || 2;
            if (t < 0) t = 2;
            if (w > 0)
                r -= w;
            else
                r = t;
            if (r < 0) r = t;
            display.css('right', r + 'px');
            r = parseInt(command.css('right'), 10) || 0;
            if (w > 0)
                r -= w;
            else
                r = 2;
            if (r < 0) r = t;
            command.css('right', r + 'px');
            this.emit('updated-interface');
            return;
        }

        status.css('visibility', '');
        status.css('display', '');
        statusBorder.css('visibility', '');
        statusBorder.css('display', '');

        if (this.client.options.statusExperienceNeededProgressbar) {
            $('#need-value').css('display', 'none');
            $('#need-percent').css('display', 'block');
        }
        else {
            $('#need-value').css('display', '');
            $('#need-percent').css('display', 'none');
        }

        let top = 0;
        let eTop;
        $('#body').css('top', '');
        $('#experience').css('top', '');
        $('#bars').css('top', '');

        if (this.client.options.showStatusWeather) {
            $('#environment').css('display', '');
            top += $('#environment').outerHeight() + (parseInt($('#environment').css('top'), 10) || 0);
            //$('#environment').css('left', status.innerWidth() / 2 - $('#environment').outerWidth() / 2);
        }
        else
            $('#environment').css('display', 'none');

        if (!this.client.options.showStatusLimbs && !this.client.options.showStatusHealth)
            $('#body').css('display', 'none');
        else {
            $('#body').css('display', '');
            eTop = (parseInt($('#body').css('top'), 10) || 0);
            if (this.client.options.showStatusLimbs)
                $('#limbs').css('display', '');
            else
                $('#limbs').css('display', 'none');
            if (this.client.options.showStatusHealth)
                $('#hp-status').css('display', '');
            else
                $('#hp-status').css('display', 'none');
            $('#body').css('top', eTop + top);
            top += $('#body').outerHeight() + eTop;
        }

        if (this.client.options.showStatusExperience) {
            $('#experience').css('display', '');
            eTop = (parseInt($('#experience').css('top'), 10) || 0);
            $('#experience').css('top', eTop + top);
            top += $('#experience').outerHeight() + eTop;
        }
        else
            $('#experience').css('display', 'none');

        if (this.client.options.showStatusPartyHealth)
            $('#party').css('display', '');
        else
            $('#party').css('display', 'none');

        if (this.client.options.showStatusCombatHealth)
            $('#combat').css('display', '');
        else
            $('#combat').css('display', 'none');

        $('#bars').css('top', (parseInt($('#bars').css('top'), 10) || 0) + top);

        $('#bars').css('bottom', '');
        if (this.lagMeter) {
            if (this.client.options.lagMeter) {
                this.lagMeter.style.visibility = '';
                this.lagMeter.style.display = '';
                $('#bars').css('bottom', this.lagMeter.offsetHeight + (parseInt(this.lagMeter.style.bottom, 10) || 0) + (parseInt($('#bars').css('bottom'), 10) || 0) + 'px');
                this.updateLagMeter(0, true);
            }
            else {
                this.lagMeter.style.visibility = 'hidden';
                this.lagMeter.style.display = 'none';
            }
        }
        if (!noSplitter)
            this.updateSplitter();
        this.emit('updated-interface');
    }

    private doUpdate(type?: UpdateType) {
        if (!type) return;
        this._updating |= type;
        if (this._updating === UpdateType.none || this._rTimeout)
            return;
        this._rTimeout = window.requestAnimationFrame(() => {
            if ((this._updating & UpdateType.status) === UpdateType.status) {
                this.updateStatus();
                this._updating &= ~UpdateType.status;
            }
            if ((this._updating & UpdateType.sortCombat) === UpdateType.sortCombat) {
                this.sortBars($('#combat'));
                this._updating &= ~UpdateType.sortCombat;
            }
            if ((this._updating & UpdateType.sortParty) === UpdateType.sortParty) {
                this.sortBars($('#party'));
                this._updating &= ~UpdateType.sortParty;
            }
            if ((this._updating & UpdateType.overall) === UpdateType.overall) {
                this.updateOverall();
                this._updating &= ~UpdateType.overall;
            }
            if ((this._updating & UpdateType.xp) === UpdateType.xp) {
                this.updateXP();
                this._updating &= ~UpdateType.xp;
            }
            this._rTimeout = 0;
            this.doUpdate(this._updating);
        });
    }

    private clear(id) {
        const el = document.getElementById(id);
        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }
    }
}