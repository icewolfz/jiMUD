/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

ace.define('ace/theme/visual_studio', ['require', 'exports', 'module' , 'ace/lib/dom'], function(require, exports, module) {

exports.isDark = false;
exports.cssClass = "ace-visual-studio";
exports.cssText = ".ace-visual-studio .ace_gutter {background: #e8e8e8;color: #333;}.ace-visual-studio .ace_print-margin {width: 1px;background: #e8e8e8;}.ace-visual-studio {background-color: #FFFFFF;color: #000000;}.ace-visual-studio .ace_cursor {color: #000000;}.ace-visual-studio .ace_marker-layer .ace_selection {background: #9DA7C3;}.ace-visual-studio.ace_multiselect .ace_selection.ace_start {box-shadow: 0 0 3px 0px #FFFFFF;border-radius: 2px;}.ace-visual-studio .ace_marker-layer .ace_step {background: rgb(198, 219, 174);}.ace-visual-studio .ace_marker-layer .ace_bracket {margin: -1px 0 0 -1px;border: 1px solid #BFBFBF;}.ace-visual-studio .ace_marker-layer .ace_active-line {background: rgba(0, 0, 0, 0.071);}.ace-visual-studio .ace_gutter-active-line {background-color: rgba(0, 0, 0, 0.071);}.ace-visual-studio .ace_marker-layer .ace_selected-word {border: 1px solid #9DA7C3;}.ace-visual-studio .ace_fold {background-color: #000000;border-color: #000000;}.ace-visual-studio .ace_keyword{color:#008000;}.ace-visual-studio .ace_keyword.ace_operator{color:#8000FF;}.ace-visual-studio .ace_keyword.ace_control{color:#0000FF;}.ace-visual-studio .ace_constant{color:#000000;}.ace-visual-studio .ace_constant.ace_language{color:#008000;font-weight: bold}.ace-visual-studio .ace_constant.ace_numeric{color:#A31515;}.ace-visual-studio .ace_constant.ace_character.ace_escape{color:#26B31A;}.ace-visual-studio .ace_support.ace_function{color:#000080;}.ace-visual-studio .ace_support.ace_function.ace_sefun {color:#008080;font-weight: bold}.ace-visual-studio .ace_support.ace_function.ace_efun {color:#008080;}.ace-visual-studio .ace_support.ace_function.ace_abbr {color:#008000;font-weight: bold}.ace-visual-studio .ace_support.ace_constant{color:#000000;}.ace-visual-studio .ace_support.ace_class{color:#000000;}.ace-visual-studio .ace_support.ace_type{color:#000000;}.ace-visual-studio .ace_storage.ace_modifier{color:#0000FF;}.ace-visual-studio .ace_storage.ace_type{color:#FF0000;}.ace-visual-studio .ace_invalid{background-color:#E1A09F;}.ace-visual-studio .ace_string{color:#A31515;}.ace-visual-studio .ace_comment{color:#008000;}.ace-visual-studio .ace_variable{color:#000000;}.ace-visual-studio .ace_meta.ace_tag{color:#0000FF;}.ace-visual-studio .ace_entity.ace_other.ace_attribute-name{color:#FF0000;}.ace-visual-studio .ace_entity.ace_name.ace_function{color:#000000;}.ace-visual-studio .ace_entity.ace_name.ace_tag{color:#A31515;}.ace-visual-studio .ace_markup.ace_heading{color:#0C07FF;}.ace-visual-studio .ace_markup.ace_list{color:#B90690;}";

var dom = require("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
