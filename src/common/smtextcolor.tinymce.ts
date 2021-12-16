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
tinymce.PluginManager.add('smtextcolor', function (editor, url) {
    //https://github.com/tinymce/tinymce/blob/f02988422c33deb9a1fe9c5d4968e5144813d657/modules/tinymce/src/themes/silver/main/ts/ui/core/color/ColorSwatch.ts
    //https://github.com/tinymce/tinymce/tree/master/modules/katamari/src/main/ts/ephox/katamari/api
    //https://www.tiny.cloud/docs/ui-components/typesoftoolbarbuttons/#splitbutton

    type ColorFormat = 'forecolor' | 'hilitecolor';

    const fallbackColor = '#000000';
    const _colors = ['000000', 'BLACK', '800000', 'RED', '008000', 'GREEN', '808000', 'ORANGE', '0000EE', 'BLUE', '800080', 'MAGENTA', '008080', 'CYAN', 'BBBBBB', 'WHITE', '808080', 'BOLD BLACK', 'FF0000', 'BOLD RED', '00FF00', 'BOLD GREEN', 'FFFF00', 'YELLOW', '5C5CFF', 'BOLD BLUE', 'FF00FF', 'BOLD MAGENTA', '00FFFF', 'BOLD CYAN', 'FFFFFF', 'BOLD WHITE'];

    const getCurrentColor = (editor, format: ColorFormat) => {
        let color: string | undefined;

        editor.dom.getParents(editor.selection.getStart(), (elm) => {
            let value;

            if ((value = elm.style[format === 'forecolor' ? 'color' : 'background-color'])) {
                color = color ? color : value;
            }
        });

        return color;
    };

    const applyFormat = (editor, format, value) => {
        editor.undoManager.transact(() => {
            editor.focus();
            editor.formatter.apply(format, { value });
            editor.nodeChanged();
        });
    };

    const removeFormat = (editor, format) => {
        editor.undoManager.transact(() => {
            editor.focus();
            editor.formatter.remove(format, { value: null }, null, true);
            editor.nodeChanged();
        });
    };

    const registerCommands = (editor) => {
        editor.addCommand('mceApplyTextcolor', (format, value) => {
            applyFormat(editor, format, value);
        });

        editor.addCommand('mceRemoveTextcolor', (format) => {
            removeFormat(editor, format);
        });
    };

    const getAdditionalColors = (hasCustom: boolean) => {
        const type: 'choiceitem' = 'choiceitem';
        const remove = {
            type,
            text: 'Remove color',
            icon: 'color-swatch-remove-color',
            value: 'remove'
        };
        const custom = {
            type,
            text: 'Custom color',
            icon: 'color-picker',
            value: 'custom'
        };
        return hasCustom ? [
            remove,
            custom
        ] : [remove];
    };

    const applyColor = (editor, format, value, onChoice: (v: string) => void) => {
        if (value === 'custom') {
            const dialog = colorPickerDialog(editor);
            dialog((colorOpt) => {
                colorOpt.each((color) => {
                    //Options.addColor(color);
                    editor.execCommand('mceApplyTextcolor', format, color);
                    onChoice(color);
                });
            }, fallbackColor);
        } else if (value === 'remove') {
            onChoice('');
            editor.execCommand('mceRemoveTextcolor', format);
        } else {
            onChoice(value);
            editor.execCommand('mceApplyTextcolor', format, value);
        }
    };

    const mapColors = (colorMap: string[]) => {
        const colors = [];

        for (let i = 0; i < colorMap.length; i += 2) {
            colors.push({
                text: colorMap[i + 1],
                value: '#' + colorMap[i],
                type: 'choiceitem'
            });
        }

        return colors;
    }

    const getCurrentColors = () => _colors.map((color) => ({
        type: 'choiceitem',
        text: color,
        value: color
    }));

    //const getColors = (colors, hasCustom: boolean) => colors.concat(_colors.concat(getAdditionalColors(hasCustom)));
    const getColors = (colors, hasCustom: boolean) => mapColors(_colors).concat(getAdditionalColors(hasCustom));

    const getFetch = (colors, hasCustom: boolean) => (callback) => {
        callback(getColors(colors, hasCustom));
    };

    const setIconColor = (splitButtonApi, name: string, newColor: string) => {
        const id = name === 'smforecolor' ? 'tox-icon-text-color__color' : 'tox-icon-highlight-bg-color__color';
        splitButtonApi.setIconFill(id, newColor);
    };

    const registerTextColorButton = (editor, name: string, format: ColorFormat, tooltip: string, lastColor) => {
        editor.ui.registry.addSplitButton(name, {
            tooltip,
            presets: 'color',
            icon: name === 'smforecolor' ? 'text-color' : 'highlight-bg-color',
            select: (value) => {
                const optCurrentRgb = getCurrentColor(editor, format);
                return true;
            },
            columns: 5,
            fetch: getFetch(_colors, true),
            onAction: (_splitButtonApi) => {
                applyColor(editor, format, lastColor.get(), () => { });
            },
            onItemAction: (_splitButtonApi, value) => {
                applyColor(editor, format, value, (newColor) => {
                    lastColor.set(newColor);
                    editor.fire('TextColorChange', {
                        name,
                        color: newColor
                    });
                });
            },
            onSetup: (splitButtonApi) => {
                setIconColor(splitButtonApi, name, lastColor.get());

                const handler = (e) => {
                    if (e.name === name) {
                        setIconColor(splitButtonApi, e.name, e.color);
                    }
                };

                editor.on('TextColorChange', handler);

                return () => {
                    editor.off('TextColorChange', handler);
                };
            }
        });
    };

    const registerTextColorMenuItem = (editor, name: string, format: ColorFormat, text: string) => {
        editor.ui.registry.addNestedMenuItem(name, {
            text,
            icon: name === 'smforecolor' ? 'text-color' : 'highlight-bg-color',
            getSubmenuItems: () => [
                {
                    type: 'fancymenuitem',
                    fancytype: 'colorswatch',
                    onAction: (data) => {
                        applyColor(editor, format, data.value, () => { });
                    }
                }
            ]
        });
    };

    const colorPickerDialog = (editor) => (callback, value: string) => {
        let isValid = false;

        const onSubmit = (api) => {
            const data = api.getData();
        };

        const onAction = (_api, details) => {
            if (details.name === 'hex-valid') {
                isValid = details.value;
            }
        };

        const initialData = {
            colorpicker: value
        };

        editor.windowManager.open({
            title: 'Color Picker',
            size: 'normal',
            body: {
                type: 'panel',
                items: [
                    {
                        type: 'colorpicker',
                        name: 'colorpicker',
                        label: 'Color'
                    }
                ]
            },
            buttons: [
                {
                    type: 'cancel',
                    name: 'cancel',
                    text: 'Cancel'
                },
                {
                    type: 'submit',
                    name: 'save',
                    text: 'Save',
                    primary: true
                }
            ],
            initialData,
            onAction,
            onSubmit,
            onClose: () => { },
            onCancel: () => {
            }
        });
    };

    //const register = (editor) => {
    registerCommands(editor);
    registerTextColorButton(editor, 'smforecolor', 'forecolor', 'Text color', Cell(fallbackColor));
    registerTextColorButton(editor, 'smbackcolor', 'hilitecolor', 'Background color', Cell(fallbackColor));

    registerTextColorMenuItem(editor, 'smforecolor', 'forecolor', 'Text color');
    registerTextColorMenuItem(editor, 'smbackcolor', 'hilitecolor', 'Background color');
    //};

});

interface Cell<T> {
    get: () => T;
    set: (value: T) => void;
}

const Cell = <T>(initial: T): Cell<T> => {
    let value = initial;

    const get = () => {
        return value;
    };

    const set = (v: T) => {
        value = v;
    };

    return {
        get,
        set
    };
};