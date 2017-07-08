/**
 * Plugin.js
 *
 * Released under LGPL License.
 * Copyright (c) 1999-2017 Ephox Corp. All rights reserved
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 */

/**
 * This class contains all core logic for the code plugin.
 *
 * @class tinymce.textcolor.Plugin
 * @private
 */
declare let tinymce;

// tslint:disable-next-line:only-arrow-functions
tinymce.PluginManager.add('smtextcolor', function(editor, url) {
    let cols;
    let rows;

    rows = {
        forecolor: editor.settings.forecolor_rows || editor.settings.textcolor_rows || 5,
        backcolor: editor.settings.backcolor_rows || editor.settings.textcolor_rows || 5
    };
    cols = {
        forecolor: editor.settings.forecolor_cols || editor.settings.textcolor_cols || 8,
        backcolor: editor.settings.backcolor_cols || editor.settings.textcolor_cols || 8
    };

    function getCurrentColor(format) {
        let color;

        editor.dom.getParents(editor.selection.getStart(), (elm) => {
            const value = elm.style[format === 'forecolor' ? 'color' : 'background-color'];
            if (value) {
                color = value;
            }
        });

        return color;
    }

    function mapColors(type) {
        let i;
        const colors = [];
        let colorMap;

        colorMap = [
            '000000', 'Black',
            '993300', 'Burnt orange',
            '333300', 'Dark olive',
            '003300', 'Dark green',
            '003366', 'Dark azure',
            '000080', 'Navy Blue',
            '333399', 'Indigo',
            '333333', 'Very dark gray',
            '800000', 'Maroon',
            'FF6600', 'Orange',
            '808000', 'Olive',
            '008000', 'Green',
            '008080', 'Teal',
            '0000FF', 'Blue',
            '666699', 'Grayish blue',
            '808080', 'Gray',
            'FF0000', 'Red',
            'FF9900', 'Amber',
            '99CC00', 'Yellow green',
            '339966', 'Sea green',
            '33CCCC', 'Turquoise',
            '3366FF', 'Royal blue',
            '800080', 'Purple',
            '999999', 'Medium gray',
            'FF00FF', 'Magenta',
            'FFCC00', 'Gold',
            'FFFF00', 'Yellow',
            '00FF00', 'Lime',
            '00FFFF', 'Aqua',
            '00CCFF', 'Sky blue',
            '993366', 'Red violet',
            'FFFFFF', 'White',
            'FF99CC', 'Pink',
            'FFCC99', 'Peach',
            'FFFF99', 'Light yellow',
            'CCFFCC', 'Pale green',
            'CCFFFF', 'Pale cyan',
            '99CCFF', 'Light sky blue',
            'CC99FF', 'Plum'
        ];

        colorMap = editor.settings.textcolor_map || colorMap;
        colorMap = editor.settings[type + '_map'] || colorMap;

        for (i = 0; i < colorMap.length; i += 2) {
            colors.push({
                text: colorMap[i + 1],
                color: '#' + colorMap[i]
            });
        }

        return colors;
    }

    function renderColorPicker() {
        const self = this;
        let colors;
        let color;
        let html;
        let last;
        let x;
        let y;
        let i;
        const id = self._id;
        let count = 0;
        let type;

        type = self.settings.origin;

        function getColorCellHtml(clr, title) {
            const isNoColor = clr === 'transparent';

            return (
                '<td class="mce-grid-cell' + (isNoColor ? ' mce-colorbtn-trans' : '') + '">' +
                '<div id="' + id + '-' + (count++) + '"' +
                ' data-mce-color="' + (clr ? clr : '') + '"' +
                ' role="option"' +
                ' tabIndex="-1"' +
                ' style="' + (clr ? 'background-color: ' + clr : '') + '"' +
                ' title="' + tinymce.translate(title) + '">' +
                (isNoColor ? '&#215;' : '') +
                '</div>' +
                '</td>'
            );
        }

        colors = mapColors(type);
        colors.push({
            text: tinymce.translate('No color'),
            color: 'transparent'
        });

        html = '<table class="mce-grid mce-grid-border mce-colorbutton-grid" role="list" cellspacing="0"><tbody>';
        last = colors.length - 1;

        for (y = 0; y < rows[type]; y++) {
            html += '<tr>';

            for (x = 0; x < cols[type]; x++) {
                i = y * cols[type] + x;

                if (i > last) {
                    html += '<td></td>';
                } else {
                    color = colors[i];
                    html += getColorCellHtml(color.color, color.text);
                }
            }

            html += '</tr>';
        }

        if (editor.settings.color_picker_callback) {
            const caption = editor.settings.color_picker_caption || tinymce.translate('Custom...');
            html += (
                '<tr>' +
                '<td colspan="' + cols[type] + '" class="mce-custom-color-btn">' +
                '<div id="' + id + '-c" class="mce-widget mce-btn mce-btn-small mce-btn-flat" ' +
                'role="button" tabindex="-1" aria-labelledby="' + id + '-c" style="width: 100%">' +
                '<button type="button" role="presentation" tabindex="-1">' + caption + '</button>' +
                '</div>' +
                '</td>' +
                '</tr>'
            );

            if (editor.settings.color_picker_display) {
                html += '<tr>';
                for (x = 0; x < cols[type]; x++) {
                    html += getColorCellHtml('', 'Custom color');
                }
                html += '</tr>';
            }
        }

        html += '</tbody></table>';

        return html;
    }

    function applyFormat(format, value) {
        editor.undoManager.transact( () => {
            editor.focus();
            editor.formatter.apply(format, { value: value });
            editor.nodeChanged();
        });
    }

    function removeFormat(format) {
        editor.undoManager.transact( () => {
            editor.focus();
            editor.formatter.remove(format, { value: null }, null, true);
            editor.nodeChanged();
        });
    }

    function onPanelClick(e) {
        const buttonCtrl = this.parent();
        let value;
        let type;

        type = buttonCtrl.settings.origin;

        function selectColor(val) {
            buttonCtrl.hidePanel();
            buttonCtrl.color(val);
            applyFormat(buttonCtrl.settings.format, val);
        }

        function resetColor() {
            buttonCtrl.hidePanel();
            buttonCtrl.resetColor();
            removeFormat(buttonCtrl.settings.format);
        }

        function setDivColor(div, val) {
            div.style.background = val;
            div.setAttribute('data-mce-color', val);
        }

        if (tinymce.dom.DOMUtils.DOM.getParent(e.target, '.mce-custom-color-btn')) {
            buttonCtrl.hidePanel();

            editor.settings.color_picker_callback.call(editor, (val) => {
                const tableElm = buttonCtrl.panel.getEl().getElementsByTagName('table')[0];
                let customColorCells;
                let div;
                let i;

                customColorCells = tinymce.map(tableElm.rows[tableElm.rows.length - 1].childNodes, (elm) => {
                    return elm.firstChild;
                });

                for (i = 0; i < customColorCells.length; i++) {
                    div = customColorCells[i];
                    if (!div.getAttribute('data-mce-color')) {
                        break;
                    }
                }

                // Shift colors to the right
                // TODO: Might need to be the left on RTL
                if (i === cols[type]) {
                    for (i = 0; i < cols[type] - 1; i++) {
                        setDivColor(customColorCells[i], customColorCells[i + 1].getAttribute('data-mce-color'));
                    }
                }

                setDivColor(div, val);
                selectColor(val);
            }, getCurrentColor(buttonCtrl.settings.format), buttonCtrl.settings.format);
        }

        value = e.target.getAttribute('data-mce-color');
        if (value) {
            if (this.lastId) {
                document.getElementById(this.lastId).setAttribute('aria-selected', 'false');
            }

            e.target.setAttribute('aria-selected', true);
            this.lastId = e.target.id;

            if (value === 'transparent') {
                resetColor();
            } else {
                selectColor(value);
            }
        } else if (value !== null) {
            buttonCtrl.hidePanel();
        }
    }

    function onButtonClick() {
        const self = this;
        if (self._color) {
            applyFormat(self.settings.format, self._color);
        } else {
            removeFormat(self.settings.format);
        }
    }

    editor.addButton('forecolor', {
        type: 'colorbutton',
        tooltip: 'Text color',
        format: 'forecolor',
        panel: {
            origin: 'forecolor',
            role: 'application',
            ariaRemember: true,
            html: renderColorPicker,
            onclick: onPanelClick
        },
        onclick: onButtonClick
    });

    editor.addButton('backcolor', {
        type: 'colorbutton',
        tooltip: 'Background color',
        format: 'hilitecolor',
        panel: {
            origin: 'backcolor',
            role: 'application',
            ariaRemember: true,
            html: renderColorPicker,
            onclick: onPanelClick
        },
        onclick: onButtonClick
    });
});
