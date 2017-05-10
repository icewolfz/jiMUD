// cSpell:word omud
// cSpell:ignore hasmembers, hpbar, hpmax, spbar, spmax, mpmax, mpbar
// cSpell:ignore righthoof, rightfoot, lefthoof, leftfoot, rightarm, leftarm, rightleg, leftleg, righthand, lefthand, leftwing, rightwing
// cSpell:word 
import EventEmitter = require('events');
import { Client } from "./client";
import { naturalCompare } from "./library";

//$("#environment").removeClass('day night twilight dawn').addClass('dawn')

/*
$("#environment").removeClass (function (index, className) {
    return (className.match (/(^|\s)moon1-\S+/g) || []).join(' ');
}).addClass('');

$("#environment").removeClass (function (index, className) {
    return (className.match (/(^|\s)weather-\S+/g) || []).join(' ');
}).addClass('');

$("#environment").removeClass (function (index, className) {
    return (className.match (/(^|\s)weather-\S+/g) || []).join(' ');
}).addClass('');
*/

export class Status extends EventEmitter {
    private info = [];
    private infoAC = [];
    private infoLimb = [];
    private _ac: boolean = false;
    private lagMeter;

    public client: Client;

    constructor(client: Client) {
        super();
        this.client = client;
        this.lagMeter = $("#lagMeter");
        this.client.telnet.on('latency-changed', (lag, avg) => {
            this.updateLagMeter(lag);
        });
        this.client.on('closed', () => {
            this.updateLagMeter(0, true);
        });
        this.client.telnet.GMCPSupports.push("oMUD 1");
        this.client.telnet.GMCPSupports.push("Char.Skills 1");
        this.client.on('addLine', (data) => {
            if (data.raw == 'Connected...')
                this.init();
        });
        this.client.on('receivedGMCP', (mod, obj) => {
            switch (mod.toLowerCase()) {
                case 'char.base':
                    this.init();
                    this.info['name'] = obj.name;
                    this.setTitle(obj.name);
                    break;
                case 'char.vitals':
                    this.updateBar("#hpbar", obj.hp, obj.hpmax);
                    this.updateBar("#spbar", obj.sp, obj.spmax);
                    this.updateBar("#mpbar", obj.mp, obj.mpmax);
                    this.info["hp"] = obj.hp;
                    this.info["hpmax"] = obj.hpmax;
                    this.info["sp"] = obj.sp;
                    this.info["spmax"] = obj.spmax;
                    this.info["mp"] = obj.mp;
                    this.info["mpmax"] = obj.mpmax;
                    this.updateOverall();
                    break;
                case 'char.experience':
                    this.info["EXPERIENCE"] = obj.current;
                    this.info["EXPERIENCE_NEED"] = obj.need - obj.current;
                    if (this.info["EXPERIENCE_NEED"] < 0)
                        this.info["EXPERIENCE_NEED"] = 0;

                    this.info["EXPERIENCE_EARNED"] = obj.earned;
                    this.info["EXPERIENCE_BANKED"] = obj.banked;
                    this.updateXP();
                    break;
                case 'omud.ac':
                    for (var limb in obj) {
                        if (!obj.hasOwnProperty(limb)) continue;
                        this.setLimbAC(limb, obj[limb]);
                        this.updateLimb(limb);
                    }
                    break;
                case 'omud.limb':
                    for (var limb in obj) {
                        if (!obj.hasOwnProperty(limb)) continue;
                        this.setLimbHealth(limb, obj[limb]);
                        this.updateLimb(limb);
                    }
                    break;
                case 'omud.weapons':
                    for (var limb in obj) {
                        if (!obj.hasOwnProperty(limb)) continue;
                        this.setWeapon(limb, obj[limb]);
                    }
                    break;
                case 'omud.environment':
                    if (obj.weather) {
                        this.info['WEATHER'] = obj.weather;
                        this.info['WEATHER_INTENSITY'] = obj.weather_intensity;
                        $("#environment").removeClass(function (index, className) {
                            return (className.match(/(^|\s)(weather-|intensity-)\S+/g) || []).join(' ');
                        });
                        if (obj.weather != "0" && obj.weather != "none")
                            $("#environment").addClass('weather-' + obj.weather);
                        if (obj.weather_intensity > 6)
                            $("#environment").addClass('intensity-hard');
                    }
                    if (obj.tod) {
                        $("#environment").removeClass('day night twilight dawn').addClass(obj.tod);
                        $("#environment").removeClass(function (index, className) {
                            return (className.match(/(^|\s)moon\d-\S+/g) || []).join(' ');
                        })
                        if (obj.moons) {
                            $("#environment").addClass('moon1-' + obj.moons[0]);
                            $("#environment").addClass('moon2-' + obj.moons[1]);
                            $("#environment").addClass('moon3-' + obj.moons[2]);
                        }
                    }
                    break;
                case 'omud.combat':
                    if (obj.action == 'leave')
                        $("#combat").empty();
                    else if (obj.action == 'add')
                        this.createBar("#combat", this.sanitizeID(obj.name), obj.name, obj.hp, 100, this.livingClass(obj, "monster-"), obj.order);
                    else if (obj.action == 'update') {
                        if (obj.hp == 0)
                            this.removeBar("#" + this.sanitizeID(obj.name));
                        else
                            this.createBar("#combat", this.sanitizeID(obj.name), obj.name, obj.hp, 100, this.livingClass(obj, "monster-"), obj.order);
                    }
                    else if (obj.action == 'remove')
                        this.removeBar("#" + this.sanitizeID(obj.name));
                    break;
                case 'omud.party':
                    if (obj.action == 'leave')
                        $("#party").empty();
                    else if (obj.action == 'add') {
                        this.createBar("#party", this.sanitizeID(obj.name), obj.name, obj.hp, 100, this.livingClass(obj, "party-"), obj.name.replace('"', ''));
                    }
                    else if (obj.action == 'update') {
                        if (obj.hp == 0)
                            this.removeBar("#" + this.sanitizeID(obj.name));
                        else
                            this.createBar("#party", this.sanitizeID(obj.name), obj.name, obj.hp, 100, this.livingClass(obj, "party-"), obj.name.replace('"', ''));
                    }
                    else if (obj.action == 'remove')
                        this.removeBar("#" + this.sanitizeID(obj.name));
                    if ($('#party').children().length > 0)
                        $("#party").addClass('hasmembers');
                    else
                        $("#party").removeClass('hasmembers');
                    break;
            }
        });
        this.updateInterface();
        this.init();
    }

    get ac(): boolean {
        return this._ac;
    }

    set ac(enable: boolean) {
        if (this._ac != enable) {
            this._ac = enable;
            this.updateStatus();
            this.emit('display-changed');
        }
    }

    private sanitizeID(id: string) {
        return id.replace(/[^a-zA-Z0-9_-]/gi, "");
    }

    private livingClass(obj, prefix?: string) {
        var cls = [];
        if (!prefix) prefix = "";
        if (obj.class && obj.class.length > 0)
            cls.push(prefix + this.sanitizeID(obj.class));
        if (obj.gender && obj.gender.length > 0)
            cls.push(prefix + this.sanitizeID(obj.gender));
        if (obj.race && obj.race.length > 0)
            cls.push(prefix + this.sanitizeID(obj.race));
        if (obj.guild && obj.guild.length > 0)
            cls.push(prefix + this.sanitizeID(obj.guild));
        if (obj.name && obj.name.length > 0)
            cls.push(prefix + this.sanitizeID(obj.name));
        return cls.join(" ");
    }

    setWeapon(limb, weapon) {
        limb = limb.replace(/\s/g, "");
        limb = limb.toLowerCase();
        var eLimb = $(document.getElementById(limb + "weapon"));
        if (!eLimb || eLimb.length == 0)
            return;
        eLimb.removeClass(function (index, className) {
            return (className.match(/(^|\s)weapon-\S+/g) || []).join(' ');
        });
        if (!weapon) return;
        if (weapon.quality && weapon.quality.length > 0)
            eLimb.addClass('weapon-' + this.sanitizeID(weapon.quality));
        if (weapon.material && weapon.material.length > 0)
            eLimb.addClass('weapon-' + this.sanitizeID(weapon.material));
        if (weapon.type && weapon.type.length > 0)
            eLimb.addClass('weapon-' + this.sanitizeID(weapon.type));
        if (weapon.subtype && weapon.subtype.length > 0)
            eLimb.addClass('weapon-' + this.sanitizeID(weapon.subtype));
        if (weapon.name && weapon.name.length > 0)
            eLimb.addClass('weapon-' + this.sanitizeID(weapon.name));
    }

    setLimbAC(limb, ac) {
        limb = limb.replace(/\s/g, "");
        limb = limb.toLowerCase();
        if (limb == "righthoof")
            limb = "rightfoot";
        else if (limb == "lefthoof")
            limb = "leftfoot";
        this.infoAC[limb] = ac;
    }

    setLimbHealth(limb, health) {
        limb = limb.replace(/\s/g, "");
        limb = limb.toLowerCase();
        if (limb == "righthoof")
            limb = "rightfoot";
        else if (limb == "lefthoof")
            limb = "leftfoot";
        this.infoLimb[limb] = health;
    }

    setTitle(title: string) {
        if (!title || title.length == 0) {
            window.document.title = "jiMUD";
            $("#character-name").html("&nbsp;");
        }
        else {
            window.document.title = "jiMUD - " + title;
            $("#character-name").text(title);
        }
        this.emit('set-title', title || "");

    }

    updateOverall() {
        $("#overall").removeClass(function (index, className) {
            return (className.match(/(^|\s)(health-|armor-)\S+/g) || []).join(' ');
        });
        if (this._ac) {
            if (this.infoAC["overall"] == 6.5) {
                $("#overall").html("Extensively");
                $("#overall").addClass('armor-extensively');
            }
            else if (this.infoAC["overall"] == 6) {
                $("#overall").html("Completely");
                $("#overall").addClass('armor-completely');
            }
            else if (this.infoAC["overall"] == 5.5) {
                $("#overall").html("Significantly");
                $("#overall").addClass('armor-significantly');
            }
            else if (this.infoAC["overall"] == 5) {
                $("#overall").html("Considerably");
                $("#overall").addClass('armor-considerably');
            }
            else if (this.infoAC["overall"] == 4.5) {
                $("#overall").html("Well");
                $("#overall").addClass('armor-well');
            }
            else if (this.infoAC["overall"] == 4) {
                $("#overall").html("Adequately");
                $("#overall").addClass('armor-adequately');
            }
            else if (this.infoAC["overall"] == 3.5) {
                $("#overall").html("Fairly");
                $("#overall").addClass('armor-fairly');
            }
            else if (this.infoAC["overall"] == 3) {
                $("#overall").html("Moderately");
                $("#overall").addClass('armor-moderately');
            }
            else if (this.infoAC["overall"] == 2.5) {
                $("#overall").html("Somewhat");
                $("#overall").addClass('armor-somewhat');
            }
            else if (this.infoAC["overall"] == 2) {
                $("#overall").html("Slightly");
                $("#overall").addClass('armor-slightly');
            }
            else if (this.infoAC["overall"] == 1) {
                $("#overall").html("Barely");
                $("#overall").addClass('armor-barely');
            }
            else {
                $("#overall").html("UNARMORED");
                $("#overall").addClass('armor-unarmored');
            }
        }
        else {
            var v = 100;
            if (this.info["hpmax"] !== 0 && !isNaN(this.info["hpmax"]))
                v *= this.info["hp"] / this.info["hpmax"];
            if (v > 90) {
                $("#overall").html("Top shape");
                $("#overall").addClass('health-full');
            }
            else if (v > 75) {
                $("#overall").html("Decent shape");
                $("#overall").addClass('health-1-19');
            }
            else if (v > 60) {
                $("#overall").html("Slightly injured");
                $("#overall").addClass('health-20-39');
            }
            else if (v > 45) {
                $("#overall").html("Hurting");
                $("#overall").addClass('health-40-59');
            }
            else if (v > 30) {
                $("#overall").html("Badly injured");
                $("#overall").addClass('health-60-79');
            }
            else if (v > 15) {
                $("#overall").html("Terribly injured");
                $("#overall").addClass('health-80-99');
            }
            else {
                $("#overall").html("Near death");
                $("#overall").addClass('health-100');
            }
        }
    }

    updateXP() {
        $("#xp-value").text(this.info["EXPERIENCE"]);
        $("#xp-banked").text(this.info["EXPERIENCE_BANKED"]);
        $("#need-value").text(this.info["EXPERIENCE_NEED"]);
        $("#earn-value").text(this.info["EXPERIENCE_EARNED"]);
    }

    updateLimb(limb) {
        limb = limb.replace(/\s/g, "");
        limb = limb.toLowerCase();
        if (limb == "overall") {
            this.updateOverall();
            return;
        }
        if (limb == "righthoof")
            limb = "rightfoot";
        else if (limb == "lefthoof")
            limb = "leftfoot";
        var eLimb = $(document.getElementById(limb));
        if (!eLimb || eLimb.length == 0)
            return;
        eLimb.removeClass(function (index, className) {
            return (className.match(/(^|\s)(health-|armor-)\S+/g) || []).join(' ');
        });
        eLimb.css('display', 'block');
        eLimb.css('visibility', "visible");
        if (this._ac) {
            if (this.infoAC[limb] == 6.5)
                eLimb.addClass('armor-extensively');
            else if (this.infoAC[limb] == 6)
                eLimb.addClass('armor-completely');
            else if (this.infoAC[limb] == 5.5)
                eLimb.addClass('armor-significantly');
            else if (this.infoAC[limb] == 5)
                eLimb.addClass('armor-considerably');
            else if (this.infoAC[limb] == 4.5)
                eLimb.addClass('armor-well');
            else if (this.infoAC[limb] == 4)
                eLimb.addClass('armor-adequately');
            else if (this.infoAC[limb] == 3.5)
                eLimb.addClass('armor-fairly');
            else if (this.infoAC[limb] == 3)
                eLimb.addClass('armor-moderately');
            else if (this.infoAC[limb] == 2.5)
                eLimb.addClass('armor-somewhat');
            else if (this.infoAC[limb] == 2)
                eLimb.addClass('armor-slightly');
            else if (this.infoAC[limb] == 1)
                eLimb.addClass('armor-barely');
            else
                eLimb.addClass('armor-unarmored');
        }
        else {
            if (this.infoLimb[limb] == 100)
                eLimb.addClass('health-100');
            else if (this.infoLimb[limb] >= 80)
                eLimb.addClass('health-80-99');
            else if (this.infoLimb[limb] >= 60)
                eLimb.addClass('health-60-79');
            else if (this.infoLimb[limb] >= 40)
                eLimb.addClass('health-40-59');
            else if (this.infoLimb[limb] >= 20)
                eLimb.addClass('health-20-39');
            else if (this.infoLimb[limb] >= 1)
                eLimb.addClass('health-1-19');
            else
                eLimb.addClass('health-full');
        }
    }

    updateStatus() {
        var limb;
        if (this._ac)
            for (limb in this.infoAC)
                this.updateLimb(limb);
        else
            for (limb in this.infoLimb)
                this.updateLimb(limb);
        this.updateOverall();
        this.updateXP();
    }

    init() {
        this.setTitle('');
        this.info = [];
        this.info["WEATHER"] = "none";
        this.info["WEATHER_INTENSITY"] = 0;
        this.info["EXPERIENCE"] = 0;
        this.info["EXPERIENCE_NEED"] = 0;
        this.info["EXPERIENCE_EARNED"] = 0;
        this.info["EXPERIENCE_BANKED"] = 0;

        this.infoAC = [];
        this.infoAC["head"] = 0;
        this.infoAC["leftarm"] = 0;
        this.infoAC["leftfoot"] = 0;
        this.infoAC["lefthand"] = 0;
        this.infoAC["leftleg"] = 0;
        this.infoAC["rightarm"] = 0;
        this.infoAC["rightfoot"] = 0;
        this.infoAC["righthand"] = 0;
        this.infoAC["rightleg"] = 0;
        this.infoAC["torso"] = 0;
        this.infoAC["overall"] = 0;

        this.infoLimb = [];
        this.infoLimb["head"] = 0;
        this.infoLimb["leftarm"] = 0;
        this.infoLimb["leftfoot"] = 0;
        this.infoLimb["lefthand"] = 0;
        this.infoLimb["leftleg"] = 0;
        this.infoLimb["rightarm"] = 0;
        this.infoLimb["rightfoot"] = 0;
        this.infoLimb["righthand"] = 0;
        this.infoLimb["rightleg"] = 0;
        this.infoLimb["torso"] = 0;

        $("#leftwing").css('display', 'none');
        $("#rightwing").css('display', 'none');
        $("#tail").css('display', 'none');

        this.updateBar("#hpbar", 0, 0);
        this.updateBar("#spbar", 0, 0);
        this.updateBar("#mpbar", 0, 0);
        //this.ac = false;
        $("#xp-value").text("0");
        $("#xp-banked").text("0");
        $("#need-value").text("0");
        $("#earn-value").text("0");
        $("#combat").empty();
        $("#party").empty();
        $("#party").removeClass('hasmembers');
        this.updateOverall();
        this.updateStatus();
    }

    updateBar(id: string, value: number, max?: number) {
        var bar = $(id);
        if (bar.length == 0)
            return;
        else {
            var p = 100;
            if (max !== 0)
                p = value / max * 100;
            $(id + " .progressbar-value").css('width', (100 - p));
            $(id + " .progressbar-text").text(value + '/' + max);
        }
    }

    createBar(parent, id, label, value, max, icon?, order?) {
        var p = 100;
        if (max !== 0)
            p = value / max * 100;
        p = Math.floor(p);
        id = id.replace(' ', '');
        var bar: any = $("#" + id);
        if (bar.length == 0) {
            if (!icon)
                icon = label.replace(/\d+$/, "").trim().replace(' ', '-');
            bar = '<div class="combat-bar" id="' + id + '" data-value="' + ((100 - p) / 20 * 20) + '" data-order="' + order + '">';
            bar += '<div class="combat-icon ' + icon + '"></div>';
            bar += '<div class="combat-name"> ' + label + '</div>';
            bar += '<div class="progressbar"><div class="progressbar-text">' + p + '%</div>';
            bar += '<div class="progressbar-value" style="width: ' + (100 - p) + '%"></div>';
            bar += '</div></div>';
            $(parent).append(bar);
            this.sortBars($(parent));
        }
        else {
            if (order != bar.data('order')) {
                bar.data('order', order);
                this.sortBars($(parent));
            }
            bar.data('value', (100 - p) / 20 * 20);
            bar.find('.combat-name').text(label);
            bar.find('.progressbar-text').text(p + '%');
            bar.find('.progressbar-value').css('width', 100 - p);
        }
    }

    removeBar(id) {
        var p = $(id).parent();
        $(id).remove();
        this.sortBars(p);
    }

    sortBars(p) {
        var listItems = p.children('div').get();
        listItems.sort(function (a, b) {
            //var compA = $(a).text().toUpperCase();
            //var compB = $(b).text().toUpperCase();
            var compA = $(a).data('order');
            var compB = $(b).data('order');
            return (compA < compB) ? -1 : (compA > compB) ? 1 : 0;
        });
        $.each(listItems, function (idx, itm) { p.append(itm); });
    }

    updateLagMeter(lag: number, force?: boolean) {
        if (!this.lagMeter || this.lagMeter.length == 0) return
        if (!this.client.options.lagMeter && !force) return;
        var p = 100;
        p = lag / 200 * 100;
        if (p > 100) p = 100;

        this.lagMeter.find(".progressbar-value").css('width', (100 - p) + "%");
        this.lagMeter.find(".progressbar-text").text((lag / 1000) + "s");
    }

    updateInterface() {
        if (this.client.options.showStatus) {
            $("#status").css("visibility", "");
            $("#status").css("display", "");
            $("#status-border").css("visibility", "");
            $("#status-border").css("display", "");

            $("#display-container").css('right', '');
            $("#display-border").css('right', '');
            $("#command").css('right', '');
        }
        else {
            $("#status").css("visibility", "hidden");
            $("#status").css("display", "none");
            $("#status-border").css("visibility", "hidden");
            $("#status-border").css("display", "none");
            $("#display-container").css('right', '7px');
            $("#display-border").css('right', '0px');
            $("#command").css('right', '0px');
        }
        if (this.lagMeter && this.lagMeter.length > 0) {
            if (this.client.options.lagMeter) {
                this.lagMeter.css("visibility", "");
                this.lagMeter.css("display", "");
                $("#bars").css('bottom', '22px');
                this.updateLagMeter(0, true);
            }
            else {
                this.lagMeter.css("visibility", "hidden");
                this.lagMeter.css("display", "none");
                $("#bars").css('bottom', '5px');
            }
        }
        else
            $("#bars").css('bottom', '5px');
    }
}