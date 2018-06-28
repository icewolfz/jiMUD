//cSpell:ignore memberof, webdings, redbu, ismap, isdoor
import EventEmitter = require('events');
import { Client } from './client';
import { AnsiColorCode, Ansi } from './ansi';

/**
 * Client text functions
 *
 * Functions that can be executed from the command line to display information
 * or display formatted text to ensure it looks or functions correctly
 *
 * @author Icewolfz
 * @export
 * @class Tests
 * @extends {EventEmitter}
 * @property {object} TestFunction - A list of functions
 */
export class Tests extends EventEmitter {
    /**
     * Contains a list of functions
     * @type {object}
     * @memberof Tests
     */
    public TestFunctions = {};
    /**
     * The client the test functions are for
     *
     * @type {object}
     * @memberof Tests
     */
    public Client;

    /**
     * Creates an instance of Tests.
     * @param {Client} client
     *
     * @memberof Tests
     */
    constructor(client: Client) {
        super();
        this.Client = client;

        this.TestFunctions['TestList'] = function () {
            let sample = 'Test commands:\n';
            let t;
            for (t in this.TestFunctions) {
                if (!this.TestFunctions.hasOwnProperty(t)) continue;
                sample += `\t${this.Client.options.commandChar + t}\n`;
            }
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestColors'] = function () {
            let r;
            let sample = 'Colors and Styles\n-------------------------------------------------------------------------------------------\n';
            for (r = 30; r < 38; r++) {
                sample += '\x1b[' + r + ';0m' + r + '\x1b[0m ';
                sample += '\x1b[' + r + ';1mBold\x1b[0m ';
                sample += '\x1b[' + r + ';2mFaint\x1b[0m ';
                sample += '\x1b[' + r + ';3mItalic\x1b[0m ';
                sample += '\x1b[' + r + ';4mUnderline\x1b[0m ';
                sample += '\x1b[' + r + ';5mFlash\x1b[0m ';
                sample += '\x1b[' + r + ';7mInverse\x1b[0m ';
                sample += '\x1b[' + r + ';8mConceal\x1b[0m ';
                sample += '\x1b[' + r + ';9mStrikeout\x1b[0m ';
                sample += '\x1b[' + r + ';21mDoubleUnderline\x1b[0m ';
                sample += '\x1b[' + r + ';53mOverline\x1b[0m ';
                sample += '\x1b[' + r + ';1;2;3;4;5;9;21;53mAll\x1b[0m';
                sample += '\x1b[0m\n';
            }
            for (r = 40; r < 48; r++) {
                sample += '\x1b[' + r + ';0m' + r + '\x1b[0m ';
                sample += '\x1b[' + r + ';1mBold\x1b[0m ';
                sample += '\x1b[' + r + ';2mFaint\x1b[0m ';
                sample += '\x1b[' + r + ';3mItalic\x1b[0m ';
                sample += '\x1b[' + r + ';4mUnderline\x1b[0m ';
                sample += '\x1b[' + r + ';5mFlash\x1b[0m ';
                sample += '\x1b[' + r + ';7mInverse\x1b[0m ';
                sample += '\x1b[' + r + ';8mConceal\x1b[0m ';
                sample += '\x1b[' + r + ';9mStrikeout\x1b[0m ';
                sample += '\x1b[' + r + ';21mDoubleUnderline\x1b[0m ';
                sample += '\x1b[' + r + ';53mOverline\x1b[0m ';
                sample += '\x1b[' + r + ';1;2;3;4;5;9;21;53mAll\x1b[0m';
                sample += '\x1b[0m\n';
            }
            sample += '-------------------------------------------------------------------------------------------\n';
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestColorsDetails'] = function () {
            let sample = '';
            if (this.Client.telnet.prompt)
                sample = '\n';
            sample += 'Table for 16-color terminal escape sequences.\n';
            sample += '\n';
            sample += 'Background        | Foreground colors\n';
            sample += '------------------------------------------------------------------------------------\n';
            for (let bg = 40; bg <= 47; bg++) {
                let a;
                for (a in Ansi) {
                    if (typeof Ansi[a] !== 'number') continue;
                    if (a === 'Rapid') continue;
                    //-16
                    if (a === 'None')
                        sample += '\x1B[0m ' + AnsiColorCode[(bg - 10)].toString().paddingRight(16) + ' | ';
                    else
                        sample += '\x1B[0m ' + a.paddingRight(16) + ' | ';
                    //-7
                    for (let fg = 30; fg <= 37; fg++) {
                        if (a === 'None')
                            sample += '\x1B[' + bg + 'm\x1B[' + fg + 'm ' + ('[' + fg + 'm').paddingRight(7);
                        else
                            sample += '\x1B[' + bg + 'm\x1B[' + Ansi[a] + ';' + fg + 'm ' + ('[' + Ansi[a] + ';' + fg + 'm').paddingRight(7);
                    }
                    sample += '\x1B[0m\n';
                }
                /*
                for (int bold = 0; bold <= 9; bold++)
                {
                    if (bold == 6)
                        continue;
                    if (bold == 0)
                        sample += "\x001B[0m " + string.Format("{0, -10}", "ESC[" + bg.ToString() + "m") + " | ";
                    else
                        sample += "\x001B[0m " + string.Format("{0, -10}", ((Ansi)bold).ToString()) + " | ";
                    for (int fg = 30; fg <= 37; fg++)
                    {
                        if (bold == 0)
                            sample += "\x001B[" + bg.ToString() + "m\x001B[" + fg.ToString() + "m [" + fg.ToString() + "m  ";
                        else
                            sample += "\x001B[" + bg.ToString() + "m\x001B[" + bold.ToString() + ";" + fg.ToString() + "m [" + bold.ToString() + ";" + fg.ToString() + "m";
                    }
                    sample += "\x001B[0m\n";
                }
                */
                sample += '------------------------------------------------------------------------------------\n';
            }
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestXTerm'] = function (title) {
            let r;
            let g;
            let b;
            let c;
            let sample = '';
            if (typeof title !== 'undefined' && title.length > 0) {
                sample += 'Set Title: ';
                sample += title;
                sample += '\x1B]0;';
                sample += title;
                sample += '\u0007\n';
            }
            sample += 'System colors:\n';

            for (c = 0; c < 8; c++)
                sample += '\x1B[48;5;' + c + 'm  ';
            sample += '\x1B[0m\n';
            for (c = 8; c < 16; c++)
                sample += '\x1B[48;5;' + c + 'm  ';
            sample += '\x1B[0m\n\n';
            sample += 'Color cube, 6x6x6:\n';

            for (g = 0; g < 6; g++) {
                for (r = 0; r < 6; r++) {
                    for (b = 0; b < 6; b++) {
                        c = (16 + (r * 36) + (g * 6) + b);
                        sample += '\x1B[48;5;' + c + 'm  ';
                    }
                    sample += '\x1B[0m ';
                }
                sample += '\n';
            }
            sample += 'Grayscale ramp:\n';

            for (c = 232; c < 256; c++)
                sample += '\x1B[48;5;' + c + 'm  ';
            sample += '\x1B[0m\n';
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestMXP'] = function () {
            let sample = 'Text Formatting\n';
            sample += '\t\x1B[6z';
            sample += '<!--Test-->&lt;!--Test--&gt;\n';
            sample += '\t<!--Test>-->&lt;!--Test&gt;--&gt;\n';
            sample += '\t<STRONG>STRONG</STRONG>\n';
            sample += '\t<BOLD>BOLD</BOLD>\n';
            sample += '\t<B>B</B>\n';
            sample += '\t<I>I</I>\n';
            sample += '\t<ITALIC>ITALIC</ITALIC>\n';
            sample += '\t<EM>EM</EM>\n';
            sample += '\t<U>U</U>\n';
            sample += '\t<UNDERLINE>UNDERLINE</UNDERLINE>\n';
            sample += '\t<S>S</S>\n';
            sample += '\t<STRIKEOUT>STRIKEOUT</STRIKEOUT>\n';
            sample += '\t<H>H</H>\n';
            sample += '\t<HIGH>HIGH</HIGH>\n';
            sample += '\t<C RED>C RED</C>\n';
            sample += '\t<COLOR #F00>COLOR #F00</COLOR>\n';
            sample += '\t<C Maroon>C Maroon</C>\n';
            sample += '\t<COLOR #800000>COLOR #800000</COLOR>\n';
            sample += '\t<H><C Maroon>H C Maroon</C></H>\n';
            sample += '\t<H><COLOR #800000>H COLOR #800000</COLOR></H>\n';
            sample += '\tRun <send PROMPT>TestMXPColors()</send> for a detailed list.\n';
            sample += '\t<FONT "Times New Roman">FONT "Times New Roman"</FONT>\n';
            sample += '\t<FONT "Webdings">FONT "Webdings"</FONT>\n';
            sample += '\t<FONT COLOR=Red,Blink>FONT COLOR=Red,Blink</FONT>\n';
            sample += '\t<FONT "Times New Roman" 24 RED GREEN>FONT "Times New Roman" 24 RED GREEN</FONT>\n';
            sample += 'Line Spacing\n';
            sample += '\tNOBR<NOBR>\n';
            sample += ' Continued<NOBR>\n';
            sample += ' More\n';
            sample += '\t<P>P\n';
            sample += '\t1\n';
            sample += '\t2\n';
            sample += '\t3\n';
            sample += '\t4</P>\n';
            sample += '\tBR Line<BR>Break\n';
            sample += '\tSBR Soft<SBR>Break\n';
            sample += 'Links\n';
            sample += '\t<A "http://shadowmud.com">Click here for ShadowMUD</A> \n';
            sample += '\t<send>test command</send>\n';
            sample += '\t<send href="command2">test command2</send>\n';
            sample += '\t<send "command1|command2|command3" hint="click to see menu|Item 1|Item 2|Item 3">this is a menu link</SEND>\n';
            sample += '\t<SEND "sample" PROMPT EXPIRE=prompt>Prompt sample</SEND>\n';
            sample += '\t<send PROMPT href="TestMXPExpire()">&lt;EXPIRE&gt; - TestMXPExpire()</send> \n';
            sample += 'Horizontal Rule\n';
            sample += '<hr>\n';
            sample += '<hr>Text After\n';
            sample += 'Text Before<hr>\n';
            sample += '<c red blue><hr></c>\n';
            sample += 'Text Before<hr>Text After\n';
            sample += 'Custom Element\n';
            sample += '\t<!ELEMENT help \'<send href="help &text;">\'>&lt;!ELEMENT help \'&lt;send href="help &amp;text;"&gt;\'&gt;\n';
            sample += '\t&lt;help&gt;test&lt;/help&gt; = <help>test</help>\n';
            sample += '\t<!ELEMENT redbu \'<c red><b><u>\'>&lt;!ELEMENT redbu \'&lt;c red&gt;&lt;b&gt;&lt;u&gt;\'&gt;\n';
            sample += '\t&lt;redbu&gt;test&lt;/redbu&gt; = <redbu>test</redbu>\n';
            sample += 'Entities\n';
            sample += '\t&#243;&brvbar;&copy;&plusmn;&sup3;&para;&frac34;&infin;&Dagger;&dagger;&spades;&clubs;&hearts;&diams;\n';
            sample += 'Custom Entity\n';
            sample += '\t<!ENTITY version "' + this.Client.version + '">&lt;!ENTITY version "' + this.Client.version + '"&gt;\n';
            sample += '\t&amp;version; = &version;\n';
            sample += '\t&lt;V Hp&gt;<V Hp>100</V>&lt;/V&gt; &amp;Hp; = &Hp; &amp;hp; = &hp;\n';
            sample += '\t&lt;VAR Sp&gt;<VAR Sp>200</VAR>&lt;/VAR&gt; &amp;Sp; = &Sp; &amp;sp; = &sp;\n';
            sample += 'Image\n';
            sample += 'default      <image logo.png URL="./../assets/" w=133 h=40>\n';
            sample += 'align left <image logo.png URL="./../assets/" align=left w=133 h=40> align left\n';
            sample += 'align right  <image logo.png URL="./../assets/" align=right w=133 h=40> align right\n';
            sample += 'align top    <image logo.png URL="./../assets/" align=top w=133 h=40> align top \n';
            sample += 'align middle <image logo.png URL="./../assets/" align=middle w=133 h=40> align middle\n';
            sample += 'align bottom <image logo.png URL="./../assets/" align=bottom w=133 h=40> align bottom\n';
            sample += 'map          <send showmap><image logo.png URL="./../assets/" ismap w=133 h=40></send>\n';
            sample += '<STAT Hp version Test>';
            sample += '<GAUGE Hp version Test>';
            sample += '\x1B[0z';
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestMXP2'] = function () {
            let sample = '\x1B[6z';
            sample += '<!-- Elements to support the Automapper -->';
            sample += '<!ELEMENT RName \'<FONT COLOR=Red><B>\' FLAG="RoomName">';
            sample += '<!ELEMENT RDesc FLAG=\'RoomDesc\'>';
            sample += '<!ELEMENT RExits \'<FONT COLOR=Blue>\' FLAG=\'RoomExit\'>';
            sample += '<!-- The next element is used to define a room exit link that sends ';
            sample += 'the exit direction to the MUD if the user clicks on it -->';
            sample += '<!ELEMENT Ex \'<SEND>\'>';
            sample += '<!ELEMENT Chat \'<FONT COLOR=Gray>\' OPEN>';
            sample += '<!ELEMENT Gossip \'<FONT COLOR=Cyan>\' OPEN>';
            sample += '<!-- in addition to standard HTML Color specifications, you can use ';
            sample += 'color attribute names such as blink -->';
            sample += '<!ELEMENT ImmChan \'<FONT COLOR=Red,Blink>\'>';
            sample += '<!ELEMENT Auction \'<FONT COLOR=Purple>\' OPEN>';
            sample += '<!ELEMENT Group \'<FONT COLOR=Blue>\' OPEN>';
            sample += '<!-- the next elements deal with the MUD prompt -->';
            sample += '<!ELEMENT Prompt FLAG="Prompt">';
            sample += '<!ELEMENT Hp FLAG="Set hp">';
            sample += '<!ELEMENT MaxHp FLAG="Set maxhp">';
            sample += '<!ELEMENT Mana FLAG="Set mana">';
            sample += '<!ELEMENT MaxMana FLAG="Set maxmana">';
            sample += '<!-- now the MUD text -->';
            sample += '<RName>The Main Temple</RName>\n';
            sample += '<RDesc>This is the main hall of the MUD where everyone starts.\n';
            sample += 'Marble arches lead south into the town, and there is a <i>lovely</i>\n';
            sample += '<send "drink &text;">fountain</send> in the center of the temple,</RDesc>\n';
            sample += '<RExits>Exits: <Ex>N</Ex>, <Ex>S</Ex>, <Ex>E</Ex>, <Ex>W</Ex></RExits>\n\n';
            sample += '<Prompt>[<Hp>100</Hp>/<MaxHp>120</MaxHp>hp <Mana>50</Mana>/<MaxMana>55</MaxMana>mana]</Prompt>\n<hr>';
            sample += '<!ELEMENT boldtext \'<COLOR &col;><B>\' ATT=\'col=red\'>';
            sample += '<boldtext>This is bold red</boldtext>\n';
            sample += '<boldtext col=blue>This is bold blue text</boldtext>\n';
            sample += '<boldtext blue>This is also bold blue text</boldtext>\n';
            sample += '\x1B[0z';
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestMXPExpire'] = function () {
            this.Client.print('\t\x1B[6z<SEND "sample" PROMPT EXPIRE=prompt>Expire sample</SEND> <SEND "sample" PROMPT EXPIRE=prompt2>Expire sample2</SEND><EXPIRE prompt>\x1B[0z\n', true);
        };

        this.TestFunctions['TestMXPColors'] = function () {
            const colors = ['IndianRed', 'LightCoral', 'Salmon', 'DarkSalmon', 'LightSalmon',
                'Crimson', 'Red', 'FireBrick', 'DarkRed', 'Pink', 'LightPink', 'HotPink', 'DeepPink',
                'MediumVioletRed', 'PaleVioletRed', 'LightSalmon', 'Coral', 'Tomato', 'OrangeRed',
                'DarkOrange', 'Orange', 'Gold', 'Yellow', 'LightYellow', 'LemonChiffon',
                'LightGoldenrodYellow', 'PapayaWhip', 'Moccasin', 'PeachPuff', 'PaleGoldenrod',
                'Khaki', 'DarkKhaki', 'Lavender', 'Thistle', 'Plum', 'Violet', 'Orchid', 'Fuchsia',
                'Magenta', 'MediumOrchid', 'MediumPurple', 'BlueViolet', 'DarkViolet',
                'DarkOrchid', 'DarkMagenta', 'Purple', 'Indigo', 'SlateBlue', 'DarkSlateBlue',
                'MediumSlateBlue', 'GreenYellow', 'Chartreuse', 'LawnGreen', 'Lime', 'LimeGreen',
                'PaleGreen', 'LightGreen', 'MediumSpringGreen', 'SpringGreen', 'MediumSeaGreen',
                'SeaGreen', 'ForestGreen', 'Green', 'DarkGreen', 'YellowGreen', 'OliveDrab',
                'Olive', 'DarkOliveGreen', 'MediumAquamarine', 'DarkSeaGreen', 'LightSeaGreen',
                'DarkCyan', 'Teal', 'Aqua', 'Cyan', 'LightCyan', 'PaleTurquoise', 'Aquamarine',
                'Turquoise', 'MediumTurquoise', 'DarkTurquoise', 'CadetBlue', 'SteelBlue',
                'LightSteelBlue', 'PowderBlue', 'LightBlue', 'SkyBlue', 'LightSkyBlue',
                'DeepSkyBlue', 'DodgerBlue', 'CornflowerBlue', 'MediumSlateBlue', 'RoyalBlue',
                'Blue', 'MediumBlue', 'DarkBlue', 'Navy', 'MidnightBlue', 'Cornsilk',
                'BlanchedAlmond', 'Bisque', 'NavajoWhite', 'Wheat', 'BurlyWood', 'Tan',
                'RosyBrown', 'SandyBrown', 'Goldenrod', 'DarkGoldenrod', 'Peru', 'Chocolate',
                'SaddleBrown', 'Sienna', 'Brown', 'Maroon', 'White', 'Snow', 'Honeydew',
                'MintCream', 'Azure', 'AliceBlue', 'GhostWhite', 'WhiteSmoke', 'Seashell',
                'Beige', 'OldLace', 'FloralWhite', 'Ivory', 'AntiqueWhite', 'Linen',
                'LavenderBlush', 'MistyRose', 'Gainsboro', 'LightGrey', 'Silver', 'DarkGray',
                'Gray', 'DimGray', 'LightSlateGray', 'SlateGray', 'DarkSlateGray', 'Black'];
            let sample = '\x1B[6z';
            const cl = colors.length - 1;
            for (let c = 0; c < cl; c++) {
                sample += '' + colors[c] + ': ';
                sample += Array(22 - colors[c].length).join(' ');
                sample += '<C ' + colors[c] + '>Fore</C> ';
                sample += '<C black ' + colors[c] + '>Back</C> ';
                sample += '<h><C ' + colors[c] + '>High</C></h> ';
                sample += '<b><C ' + colors[c] + '>Bold</C></b> ';
                sample += '<C ' + colors[c] + '>\x1b[1mAnsiBold\x1b[0m ';
                sample += '\x1b[2mFaint\x1b[0m ';
                sample += '\x1b[3mItalic\x1b[0m ';
                sample += '\x1b[4mUnderline\x1b[0m ';
                sample += '\x1b[5mFlash\x1b[0m ';
                sample += '\x1b[7mInverse\x1b[0m ';
                sample += '\x1b[8mConceal\x1b[0m ';
                sample += '\x1b[9mStrikeout\x1b[0m ';
                sample += '\x1b[21mDoubleUnderline\x1b[0m ';
                sample += '\x1b[53mOverline\x1b[0m';
                sample += '</C>\n';
            }
            sample += 'Black: ';
            sample += Array(17).join(' ');
            sample += '<C Black silver>Fore</C> ';
            sample += '<C silver Black>Back</C> ';
            sample += '<h><C Black silver>High</C></h> ';
            sample += '<b><C Black silver>Bold</C></b> ';
            sample += '<C Black silver>\x1b[1mAnsiBold\x1b[0m ';
            sample += '\x1b[2mFaint\x1b[0m ';
            sample += '\x1b[3mItalic\x1b[0m ';
            sample += '\x1b[4mUnderline\x1b[0m ';
            sample += '\x1b[5mFlash\x1b[0m ';
            sample += '\x1b[7mInverse\x1b[0m ';
            sample += '\x1b[8mConceal\x1b[0m ';
            sample += '\x1b[9mStrikeout\x1b[0m ';
            sample += '\x1b[21mDoubleUnderline\x1b[0m ';
            sample += '\x1b[53mOverline\x1b[0m';
            sample += '</C>\n';
            sample += '\x1B[0z';
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestMXPElements'] = function () {
            let sample = '\x1B[6z';
            sample += 'Custom Element\n';
            sample += '\t<!ELEMENT help \'<send href="help &text;">\'>&lt;!ELEMENT help \'&lt;send href="help &amp;text;"&gt;\'&gt;\n';
            sample += '\t&lt;help&gt;test&lt;/help&gt; = <help>test</help>\n';
            sample += '\t<!ELEMENT redbu \'<c red><b><u>\'>&lt;!ELEMENT redbu \'&lt;c red&gt;&lt;b&gt;&lt;u&gt;\'&gt;\n';
            sample += '\t&lt;redbu&gt;test&lt;/redbu&gt; = <redbu>test</redbu>\n';
            sample += '\x1B[0z';
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestMXPLines'] = function () {
            let sample = '\x1B[6z';
            sample += '<!ELEMENT Auction \'<FONT COLOR=red>\' TAG=20 OPEN>';
            sample += '\x1B[20zA nice shiny sword is being auctioned.\n';
            sample += '\x1B[6z<Auction>Also, a gold ring is being auctioned.</Auction>';
            sample += '<!ELEMENT Auction TAG=20>\n';
            sample += '<!TAG 20 Fore=red>\n';
            sample += '\x1B[20zA nice shiny sword is being auctioned.\n';
            sample += '\x1B[6z<Auction>Also, a gold ring is being auctioned.</Auction>\n';
            sample += '\x1B[6z<!TAG 20 Fore=blue>\n';
            sample += '\x1B[20zA nice shiny sword is being auctioned.\n';
            sample += '\x1B[6z<Auction>Also, a gold ring is being auctioned.</Auction>\n';
            sample += '\x1B[0z';
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestMapper'] = () => {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('GMCP-received', {
                mod: 'Room.Info', obj: {
                    details: [],
                    doors: {},
                    prevroom: { num: 0, dir: '', area: '' },
                    area: 'Doc Build Samples Area',
                    exits: {
                        south: { num: 87723359, dir: 'south', area: 'Doc Build Samples Area', isdoor: 0 },
                        east: { num: -329701270, dir: 'east', area: 'Doc Build Samples Area', isdoor: 0 }
                    },
                    name: 'Sample room 1',
                    num: 1968208336,
                    indoors: 0
                }
            });
            ipcRenderer.send('GMCP-received', {
                mod: 'Room.Info', obj: {
                    details: [],
                    doors: {},
                    prevroom: { num: 1968208336, dir: 'east', area: 'Doc Build Samples Area' },
                    area: 'Doc Build Samples Area',
                    environment: 'wood',
                    exits: {
                        south: { num: 1916648905, dir: 'south', area: 'Doc Build Samples Area', isdoor: 0 },
                        east: { num: -1688332036, dir: 'east', area: 'Doc Build Samples Area', isdoor: 0 },
                        west: { num: 1968208336, dir: 'west', area: 'Doc Build Samples Area', isdoor: 0 }
                    },
                    name: 'Sample room 2',
                    num: -329701270,
                    indoors: 0
                }
            });
            ipcRenderer.send('GMCP-received', {
                mod: 'Room.Info', obj: {
                    details: [],
                    doors: {},
                    prevroom: { num: -329701270, dir: 'east', area: 'Doc Build Samples Area' },
                    area: 'Doc Build Samples Area',
                    environment: 'jungle',
                    exits: {
                        south: { num: -348853133, dir: 'south', area: 'Doc Build Samples Area', isdoor: 0 },
                        west: { num: -329701270, dir: 'west', area: 'Doc Build Samples Area', isdoor: 0 }
                    },
                    name: 'Sample room 3',
                    num: -1688332036,
                    indoors: 0
                }
            });
            ipcRenderer.send('GMCP-received', {
                mod: 'Room.Info', obj: {
                    details: [],
                    doors: {},
                    prevroom: { num: -1688332036, dir: 'south', area: 'Doc Build Samples Area' },
                    area: 'Doc Build Samples Area',
                    environment: 'grass',
                    exits: {
                        north: { num: -1688332036, dir: 'north', area: 'Doc Build Samples Area', isdoor: 0 },
                        south: { num: 2072768994, dir: 'south', area: 'Doc Build Samples Area', isdoor: 0 },
                        west: { num: 1916648905, dir: 'west', area: 'Doc Build Samples Area', isdoor: 0 }
                    }, name: 'Sample room 6',
                    num: -348853133,
                    indoors: 0
                }
            });
            ipcRenderer.send('GMCP-received', {
                mod: 'Room.Info', obj: {
                    details: [],
                    doors: {},
                    prevroom: { num: -348853133, dir: 'west', area: 'Doc Build Samples Area' },
                    area: 'Doc Build Samples Area',
                    environment: 'desert',
                    exits: {
                        north: { num: -329701270, dir: 'north', area: 'Doc Build Samples Area', isdoor: 0 },
                        south: { num: 210551156, dir: 'south', area: 'Doc Build Samples Area', isdoor: 0 },
                        east: { num: -348853133, dir: 'east', area: 'Doc Build Samples Area', isdoor: 0 },
                        west: { num: 87723359, dir: 'west', area: 'Doc Build Samples Area', isdoor: 0 }
                    },
                    name: 'Sample room 5',
                    num: 1916648905,
                    indoors: 1
                }
            });
            ipcRenderer.send('GMCP-received', {
                mod: 'Room.Info', obj: {
                    details: [],
                    doors: {},
                    prevroom: { num: 1916648905, dir: 'west', area: 'Doc Build Samples Area' },
                    area: 'Doc Build Samples Area',
                    environment: 'tundra',
                    exits: {
                        north: { num: 1968208336, dir: 'north', area: 'Doc Build Samples Area', isdoor: 0 },
                        south: { num: -1674322715, dir: 'south', area: 'Doc Build Samples Area', isdoor: 0 },
                        east: { num: 87723359, dir: 'east', area: 'Doc Build Samples Area', isdoor: 0 }
                    },
                    name: 'Sample room 4',
                    num: 87723359,
                    indoors: 0
                }
            });
            ipcRenderer.send('GMCP-received', {
                mod: 'Room.Info', obj: {
                    details: [],
                    doors: {},
                    prevroom: { num: 87723359, dir: 'south', area: 'Doc Build Samples Area' },
                    area: 'Doc Build Samples Area',
                    environment: 'water',
                    exits: {
                        north: { num: 87723359, dir: 'north', area: 'Doc Build Samples Area', isdoor: 0 },
                        east: { num: 210551156, dir: 'east', area: 'Doc Build Samples Area', isdoor: 0 }
                    },
                    name: 'Sample room 7',
                    num: -1674322715,
                    indoors: 0
                }
            });
            ipcRenderer.send('GMCP-received', {
                mod: 'Room.Info', obj: {
                    details: [],
                    doors: {},
                    prevroom: { num: -1674322715, dir: 'east', area: 'Doc Build Samples Area' },
                    area: 'Doc Build Samples Area',
                    environment: 'jungle',
                    exits: {
                        north: { num: 1916648905, dir: 'north', area: 'Doc Build Samples Area', isdoor: 0 },
                        east: { num: 2072768994, dir: 'east', area: 'Doc Build Samples Area', isdoor: 0 },
                        west: { num: -1674322715, dir: 'west', area: 'Doc Build Samples Area', isdoor: 0 }
                    },
                    name: 'Sample room 8',
                    num: 210551156,
                    indoors: 0
                }
            });
            ipcRenderer.send('GMCP-received', {
                mod: 'Room.Info', obj: {
                    details: [],
                    doors: {},
                    prevroom: { num: 210551156, dir: 'east', area: 'Doc Build Samples Area' },
                    area: 'Doc Build Samples Area',
                    exits: {
                        north: { num: -348853133, dir: 'north', area: 'Doc Build Samples Area', isdoor: 0 },
                        west: { num: 210551156, dir: 'west', area: 'Doc Build Samples Area', isdoor: 0 }
                    },
                    name: 'Sample room 9',
                    num: 2072768994,
                    indoors: 0
                }
            });
        };

        this.TestFunctions['TestFANSI'] = function () {
            let sample = '';
            let i;
            sample = String.fromCharCode(1);
            for (i = 3; i <= 6; i++)
                sample += String.fromCharCode(i);
            for (i = 14; i <= 26; i++)
                sample += String.fromCharCode(i);
            for (i = 28; i <= 31; i++)
                sample += String.fromCharCode(i);
            for (i = 127; i <= 254; i++)
                sample += String.fromCharCode(i);
            sample += '\n';
            const dcc = this.Client.display.displayControlCodes;
            this.Client.display.displayControlCodes = true;
            if (!this.Client.display.emulateTerminal) {
                this.Client.print(sample, true);
                this.Client.display.emulateTerminal = true;
                this.Client.print(sample, true);
                this.Client.display.emulateTerminal = false;
            }
            else {
                this.Client.display.emulateTerminal = false;
                this.Client.print(sample, true);
                this.Client.display.emulateTerminal = true;
                this.Client.print(sample, true);
            }
            this.Client.display.displayControlCodes = dcc;
        };

        this.TestFunctions['TestURLDetect'] = function () {
            let sample = '\x1B[0mhttp://www.google.com\n';
            sample += '\thttp://www.google.com\x1B[44m\n';
            sample += 'http://www.google.com\n';
            sample += '\ttry this http://www.google.com\n';
            sample += 'http://www.google.com try this\n';
            sample += '\ttry this http://www.google.com try this\n';
            sample += '\x1B[36mhttp://www.google.com\n';
            sample += '\t\x1B[0mhttp://www.google.com\n';
            sample += 'http://www.google.com\x1B[44m\n';
            sample += '\thttp://www.google.com\n';
            sample += 'try this http://www.google.com\n';
            sample += '\thttp://www.google.com try this\n';
            sample += 'try this http://www.google.com try this\n';
            sample += '\t\x1B[36mhttp://www.google.com\n';
            sample += '\thttps://localhost telnet://localhost\n';
            sample += '\tnews://test.edu/default.asp?t=1#1111 torrent://localhost/\n';
            sample += '\tftp://localhost gopher://localhost im://talk\n';
            sample += '\tmailto:address@localhost irc://<host>[:<port>]/[<channel>[?<password>]]\n';
            sample += 'awww... www.google.com awww.com\n';
            sample += 'www.google.com www.google.com\x1B[0m';
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestXTermRGB'] = function () {
            let sample = '';
            let r;
            let g;
            let b;
            let i = 0;
            for (r = 0; r < 256; r += 16) {
                for (g = 0; g < 256; g += 16) {
                    for (b = 0; b < 256; b += 16) {
                        sample += '\x1B[48;2;' + r + ';' + g + ';' + b + 'm  ';
                        if (i % 63 === 0)
                            sample += '\n';
                        i++;
                    }
                }
            }
            sample += '\x1B[0m';
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestSize'] = function () {
            const ws = this.Client.display.WindowSize;
            let sample = ws.width + 'x' + ws.height + ' ';
            ws.width -= sample.length;
            for (let w = 0; w < ws.width; w++)
                sample += 'w';
            for (let h = 1; h < ws.height; h++)
                sample += '\n' + h;
            this.Client.print(sample, true);
        };

        this.TestFunctions['TestSpeed'] = function () {
            const sample = [];
            const commands = this.Client.options.commandChar + ['TestMXPColors', 'TestMXP', 'TestColors', 'TestColorsDetails', 'TestXTerm', 'TestXTermRGB'].join('\n' + this.Client.options.commandChar);
            const e = this.Client.options.enableCommands;
            this.Client.options.enableCommands = true;
            let avg = 0;
            let max = 0;
            let min = 0;
            let t;
            for (let i = 0; i < 10; i++) {
                const start = new Date().getTime();
                this.Client.sendCommand(commands);
                const end = new Date().getTime();
                t = end - start;
                avg += t;
                if (t > max) max = t;
                if (!min || t < min) min = t;
                sample.push(`${i} - ${t}`);
            }
            avg /= 10;
            sample.push(`Average - ${avg}`);
            sample.push(`Min - ${min}`);
            sample.push(`Max - ${max}`);
            this.Client.print(sample.join('\n') + '\n', true);
            this.Client.options.enableCommands = e;
        };
    }
}