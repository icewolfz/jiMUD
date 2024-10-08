//spellchecker:ignore sefun sefuns lfuns lfun efuns efun precompiler ltrim rtrim varargs
//spellchecker:ignore lbracket rbracket loperator roperator rhook lhook xeot
import { EventEmitter } from 'events';
import { parseTemplate, walkSync, isValidIdentifier } from '../library';
const fs = require('fs-extra');
const path = require('path');

import IRichLanguageConfiguration = monaco.languages.LanguageConfiguration;
import ILanguage = monaco.languages.IMonarchLanguage;
//import IWordAtPosition = monaco.editor.IWordAtPosition;
//import { DebugTimer } from './editor.base';

//https://github.com/Microsoft/vscode/blob/master/extensions/typescript-language-features/src/features/languageConfiguration.ts
export const conf: IRichLanguageConfiguration = {
    comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
    ],
    autoClosingPairs: [
        { open: '([', close: '])', notIn: ['string'] },
        { open: '({', close: '})', notIn: ['string'] },
        { open: '[', close: ']', notIn: ['string'] },
        { open: '{', close: '}', notIn: ['string'] },
        { open: '(', close: ')', notIn: ['string'] },
        { open: '\'', close: '\'', notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string'] },
        { open: "/*", close: "*/", notIn: ["string", "comment"] },
        { open: '/**', close: ' */', notIn: ['string'] }
    ],
    surroundingPairs: [
        { open: '({', close: '})' },
        { open: '([', close: '])' },
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' }
    ],
    folding: {
        markers: {
            //spellchecker:disable
            start: new RegExp(/^\s*\/\/#[rR]egion\b/),
            end: new RegExp(/^\s*\/\/#[eE]nd[rR]egion\b/)
            //spellchecker:enable
        }
    },
    onEnterRules: [
        {
            // e.g. /** | */
            beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
            afterText: /^\s*\*\/$/,
            action: { indentAction: 2, appendText: ' * ' }
        }, {
            // e.g. /** ...|
            beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
            action: { indentAction: 0, appendText: ' * ' }
        }, {
            // e.g.  * ...|
            beforeText: /^(\t|[ ])*[ ]\*([ ]([^\*]|\*(?!\/))*)?$/,
            action: { indentAction: 0, appendText: '* ' }
        }, {
            // e.g.  */|
            beforeText: /^(\t|[ ])*[ ]\*\/\s*$/,
            action: { indentAction: 0, removeText: 1 }
        },
        {
            // e.g.  *-----*/|
            beforeText: /^(\t|[ ])*[ ]\*[^/]*\*\/\s*$/,
            action: { indentAction: 0, removeText: 1 }
        }
    ]
};
//spellchecker:disable
export const language = <ILanguage>{
    defaultToken: '',
    tokenPostfix: '.c',

    brackets: [
        { token: 'delimiter.array', open: '({', close: '})' },
        { token: 'delimiter.mapping', open: '([', close: '])' },
        { token: 'delimiter.curly', open: '{', close: '}' },
        { token: 'delimiter.parenthesis', open: '(', close: ')' },
        { token: 'delimiter.square', open: '[', close: ']' },
        { token: 'delimiter.angle', open: '<', close: '>' }
    ],

    keywords: [
        'break',
        'case',
        'catch',
        'class',
        'const',
        'continue',
        'default',
        'do',
        'foreach',
        'else',
        'finally',
        'for',
        'goto',
        'if',
        'in',
        'undefined',
        'private',
        'protected',
        'public',
        'return',
        'static',
        'struct',
        'switch',
        'this',
        'try',
        'virtual',
        'while',
        'nosave',
        'varargs',
        'nomask',
        'inherit'
    ],

    datatypes: [
        'void',
        'float',
        'int',
        'object',
        'function',
        'mapping',
        'string',
        'mixed',
        'object *',
        'function *',
        'float *',
        'mapping *',
        'string *',
        'int *',
        'mixed *',
        'object*',
        'function*',
        'float*',
        'mapping*',
        'string*',
        'int*',
        'mixed*',
        'buffer'
    ],

    const: [
        'MUDOS',
        '__PORT__',
        '__ARCH__',
        '__COMPILER__',
        '__OPTIMIZATION__',
        'MUD_NAME',
        'HAS_ED',
        'HAS_PRINTF',
        'HAS_RUSAGE',
        'HAS_DEBUG_LEVEL',
        '__DIR__',
        'FLUFFOS',
        '__WIN32__',
        '__HAS_RUSAGE__',
        '__M64__',
        '__PACKAGE_DB__',
        '__GET_CHAR_IS_BUFFERED__',
        '__DSLIB__',
        '__DWLIB__',
        '__FD_SETSIZE__',
        '__VERSION__',
        '__DEBUG__',
        'SIZEOFINT',
        'MAX_INT',
        'MIN_INT',
        'MAX_FLOAT',
        'MIN_FLOAT'
    ],

    efuns: [
        'functions',
        'allocate',
        'filter_array',
        'filter',
        'map_array',
        'member_array',
        'sort_array',
        'unique_array',
        'allocate_buffer',
        'crc32',
        'read_buffer',
        'write_buffer',
        'call_other',
        'call_out',
        'catch',
        'origin',
        'previous_object',
        'query_shadowing',
        'remove_call_out',
        'shadow',
        'this_object',
        'throw',
        'generate_source',
        'ed_cmd',
        'ed_start',
        'query_ed_mode',
        'cp',
        'file_size',
        'get_dir',
        'link',
        'mkdir',
        'read_bytes',
        'read_file',
        'rename',
        'rm',
        'rmdir',
        'stat',
        'tail',
        'write_bytes',
        'write_file',
        'acos',
        'asin',
        'atan',
        'ceil',
        'cos',
        'exp',
        'floor',
        'log',
        'pow',
        'sin',
        'sqrt',
        'tan',
        'to_int',
        'apply',
        'bind',
        'evaluate',
        'map',
        'restore_variable',
        'save_variable',
        'sizeof',
        'typeof',
        'add_action',
        'command',
        'commands',
        'disable_commands',
        'disable_wizard',
        'ed',
        'enable_commands',
        'exec',
        'find_player',
        'get_char',
        'in_edit',
        'in_input',
        'input_to',
        'interactive',
        'message',
        'notify_fail',
        'printf',
        'query_host_name',
        'query_idle',
        'query_ip_name',
        'query_ip_number',
        'query_snoop',
        'query_snooping',
        'receive',
        'remove_action',
        'resolve',
        'say',
        'set_this_player',
        'shout',
        'snoop',
        'this_interactive',
        'this_player',
        'userp',
        'users',
        'write',
        'cache_stats',
        'debug_info',
        'debugmalloc',
        'dump_file_descriptors',
        'dump_prog',
        'dump_socket_status',
        'dumpallobj',
        'get_config',
        'malloc_status',
        'memory_info',
        'moncontrol',
        'mud_status',
        'opcprof',
        'query_load_average',
        'refs',
        'rusage',
        'set_debug_level',
        'set_malloc_mask',
        'swap',
        'time_expression',
        'trace',
        'traceprefix',
        'allocate_mapping',
        'each',
        'filter_mapping',
        'keys',
        'map_delete',
        'map_mapping',
        'match_path',
        'unique_mapping',
        'values',
        'author_stats',
        'domain_stats',
        'enable_wizard',
        'export_uid',
        'find_living',
        'geteuid',
        'getuid',
        'living',
        'livings',
        'query_privs',
        'set_author',
        'set_light',
        'set_living_name',
        'set_privs',
        'seteuid',
        'wizardp',
        'random',
        'to_float',
        'all_inventory',
        'children',
        'clone_object',
        'clonep',
        'deep_inventory',
        'destruct',
        'environment',
        'file_name',
        'first_inventory',
        'load_object',
        'master',
        'move_object',
        'new',
        'next_inventory',
        'objects',
        'present',
        'query_heart_beat',
        'reload_object',
        'restore_object',
        'save_object',
        'set_heart_beat',
        'set_hide',
        'virtualp',
        'parse_command',
        'process_string',
        'process_value',
        'query_verb',
        'socket_accept',
        'socket_acquire',
        'socket_address',
        'socket_bind',
        'socket_close',
        'socket_connect',
        'socket_create',
        'socket_error',
        'socket_listen',
        'socket_release',
        'socket_write',
        'break_string',
        'capitalize',
        'clear_bit',
        'crypt',
        'explode',
        'implode',
        'lower_case',
        'upper_case',
        'reg_assoc',
        'regexp',
        'replace_string',
        'set_bit',
        'sprintf',
        'sscanf',
        'strcmp',
        'stringp',
        'strlen',
        'strsrch',
        'test_bit',
        'all_previous_objects',
        'call_out_info',
        'ctime',
        'deep_inherit_list',
        'error',
        'eval_cost',
        'find_call_out',
        'function_exists',
        'function_profile',
        'inherit_list',
        'inherits',
        'localtime',
        'max_eval_cost',
        'reclaim_objects',
        'replace_program',
        'reset_eval_cost',
        'set_eval_limit',
        'set_reset',
        'shutdown',
        'time',
        'uptime',
        'find_object',
        'functionp',
        'intp',
        'arrayp',
        'stringp',
        'pointerp',
        'objectp',
        'bufferp',
        'floatp',
        'nullp',
        'undefinedp',
        'errorp',
        'mapp',
        'compress',
        'uncompress',
        'compress_file',
        'uncompress_file'
    ],

    sefuns: [
        'year',
        'wrap',
        'wizardp',
        'visible',
        'version',
        'user_path',
        'user_exists',
        'unguarded',
        'unescape_string',
        'undefined',
        'translate_lines',
        'translate_file',
        'translate_block',
        'translate',
        'to_object',
        'textencode',
        'textdecode',
        'trim',
        'ltrim',
        'rtrim',
        'trimws',
        'ltrimws',
        'rtrimws',
        'reverse_string',
        'starts_with',
        'ends_with',
        'tell_room',
        'tell_player',
        'tell_object',
        'syntax_evaluate',
        'syntax_compile',
        'substr',
        'strip_whitespace',
        'strip_leading_trailing',
        'strip_colours',
        'strip_colors',
        'color_gradient',
        'stack_size',
        'stack_push',
        'stack_pop',
        'stack_peek',
        'stack_init',
        'simple_tense',
        'item_list',
        'shout_msg',
        'shout_all',
        'shout',
        'sexplode',
        'season',
        'say',
        'save_database',
        'round',
        'rexplode',
        'render_columns',
        'remove_item_from_array',
        'remove_element_from_array',
        'read_database',
        'random_member',
        'query_path',
        'query_opposite_exit',
        'query_night',
        'query_host_port',
        'present_tense',
        'present_clones_children',
        'present_clones',
        'possessive_noun',
        'pluralize',
        'pick_elements',
        'percent',
        'path_file',
        'past_tense',
        'parse_objects',
        'parse_eini_tree',
        'parse_eini',
        'owner_euid',
        'ordinal_num',
        'ordinal',
        'newbiep',
        'mumudlib_version',
        'mud_name',
        'mud_currencies',
        'month',
        'mkdir_p',
        'minutes',
        'midp',
        'member_group',
        'logins',
        'log_file',
        'load_object',
        'load_database',
        'legendp',
        'iso_date_time',
        'iso_date',
        'instances',
        'inWater',
        'immortalp',
        'identify',
        'hour',
        'high_mortalp',
        'hiddenp',
        'get_objects',
        'get_object',
        'format_string',
        'format_stack',
        'format_page',
        'format_as_columns',
        'find_object_or_load',
        'file_exists',
        'expand_exit',
        'exclude_array',
        'event_pending',
        'event_log',
        'event',
        'elderp',
        'editor_string',
        'dump_socket_status',
        'distinct_array',
        'distance',
        'deep_copy',
        'day',
        'date',
        'database_filter',
        'cut_spaces',
        'currency_weight',
        'currency_value',
        'currency_rate',
        'currency_inflation',
        'creatorp',
        'creator_file',
        'copy',
        'convert_name',
        'consolidate',
        'comma_number',
        'comma_list',
        'explode_list',
        'consolidate_list',
        'combinations',
        'clone_unique',
        'clone_max_children',
        'clone_max',
        'clone',
        'check_password',
        'center',
        'cardinal',
        'capwords',
        'bf_set',
        'bf_query',
        'bf_new',
        'bf_dump',
        'bf_count',
        'bf_clear',
        'bf_assoc',
        'base_name',
        'avg',
        'atoi',
        'arrange_string',
        'archp',
        'architecture',
        'alphabet',
        'all_users',
        'all_plurals',
        'all_combinations',
        'adminp',
        'add_vector',
        'abs',
        'a_or_an',
        'string_parts',
        'clower_case',
        'cupper_case',
        'sound',
        'music',
        'apprenticep',
        'tztime',
        'fansi',
        'query_host_ip',
        'color_rainbow',
        'base64_encode',
        'base64_decode',
        'mudlib',
        'mudlib_version',
        'absolute_path',
        'absolute_value',
        'create_auto_load',
        'save_auto_load',
        'find_room',
        'find_living_container',
        'compress_save_auto_load',
        'uncompress_create_auto_load',
        'pad_array'
    ],

    abbr: [
        'FOOL',
        'TP',
        'TO',
        'ENVTP',
        'HIS',
        'HE',
        'HIM',
        'QP',
        'QS',
        'QO',
        'SJ',
        'OJ',
        'PS',
        'TPQCN',
        'TPQN',
        'PO',
        'ETP',
        'ETO',
        'ENVTO',
        'QCN',
        'QN'
    ],

    applies: [
        'catch_tell',
        'logon',
        'net_dead',
        'process_input',
        'receive_message',
        'receive_snoop',
        'telnet_suboption',
        'terminal_type',
        'write_prompt',
        //master
        'author_file',
        'compile_object',
        'connect',
        'crash',
        'creator_file',
        'domain_file',
        'epilog',
        'error_handler',
        'flag',
        'get_bb_uid',
        'get_include_path',
        'get_mud_stats',
        'get_root_uid',
        'get_save_file_name',
        'log_error',
        'make_path_absolute',
        'object_name',
        'preload',
        'privs_file',
        'retrieve_ed_setup',
        'save_ed_setup',
        'valid_bind',
        'valid_database',
        'valid_hide',
        'valid_link',
        'valid_object',
        'valid_override',
        'valid_read',
        'valid_save_binary',
        'valid_seteuid',
        'valid_shadow',
        'valid_socket',
        'valid_write',
        'view_errors',
        //master end
        'clean_up',
        'create',
        'id',
        'init',
        'move_or_destruct',
        'reset',
        'heart_beat'
    ],

    operators: [
        '=', '>', '<', '!', '~', '?', ':',
        '==', '<=', '>=', '!=', '&&', '||', '++', '--',
        '+', '-', '*', '/', '&', '|', '^', '%', '<<',
        '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
        '^=', '%=', '<<=', '>>=', '>>>=', '->', '::'
    ],

    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    loatsuffix: /[fFlL]?/,
    integersuffix: /(ll|LL|u|U|l|L)?(ll|LL|u|U|l|L)?/,
    floatsuffix: /[fFlL]?/,

    // The main tokenizer for our languages
    tokenizer: {
        root: [
            //inherits
            [/(::)(\w+)(\()/, ['delimiter', 'parent.function', { token: 'delimiter.parenthesis', open: '(', close: ')' }], '@brackets'],
            [/([\!.+])(::)(\w+)(\()/, ['', 'delimiter', 'parent.function', { token: 'delimiter.parenthesis', open: '(', close: ')' }], '@brackets'],
            [/(\w*?)(::)(\w+)(\()/, ['parent', 'delimiter', 'parent.function', { token: 'delimiter.parenthesis', open: '(', close: ')' }], '@brackets'],

            // identifiers and keywords
            [/[a-zA-Z_]\w*/, {
                cases: {
                    '@keywords': { token: 'keyword.$0' },
                    '@datatypes': { token: 'datatype' },
                    '@sefuns': { token: 'sefuns' },
                    '@efuns': { token: 'efuns' },
                    '@abbr': { token: 'abbr' },
                    '@const': { token: 'constant' },
                    '@applies': { token: 'applies' },
                    '@default': 'identifier'
                }
            }],

            // whitespace
            { include: '@whitespace' },

            [/^\s*#include/, { token: 'keyword.directive.include', next: '@include' }],

            // Preprocessor directive
            [/^\s*#\s*\w+/, 'keyword.directive'],

            // delimiters and operators
            [/[{}()\[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/@symbols/, {
                cases: {
                    '@operators': 'operator',
                    '@default': ''
                }
            }],

            // numbers
            [/\d*\d+[eE]([\-+]?\d+)?(@floatsuffix)/, 'number.float'],
            [/\d*\.\d+([eE][\-+]?\d+)?(@floatsuffix)/, 'number.float'],
            [/0[xX][0-9a-fA-F']*[0-9a-fA-F](@integersuffix)/, 'number.hex'],
            [/0[0-7']*[0-7](@integersuffix)/, 'number.octal'],
            [/0[bB][0-1']*[0-1](@integersuffix)/, 'number.binary'],
            [/\d[\d']*\d(@integersuffix)/, 'number'],
            [/\d(@integersuffix)/, 'number'],

            // delimiter: after number because of .\d floats
            [/[;,.]/, 'delimiter'],

            // strings
            [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
            [/"/, 'string', '@string'],

            // characters
            [/'[^\\']'/, 'string'],
            [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
            [/'/, 'string.invalid']
        ],

        whitespace: [
            [/[ \t\r\n]+/, ''],
            [/\/\*\*(?!\/)/, 'comment.doc', '@doccomment'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment']
        ],

        comment: [
            [/[^\/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
        ],
        //Identical copy of comment above, except for the addition of .doc
        doccomment: [
            [/[^\/*]+/, 'comment.doc'],
            [/\*\//, 'comment.doc', '@pop'],
            [/[\/*]/, 'comment.doc']
        ],

        string: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, 'string', '@pop']
        ],

        include: [
            [/(\s*)(<)([^<>]*)(>)/, ['', 'keyword.directive.include.begin', 'string.include.identifier', { token: 'keyword.directive.include.end', next: '@pop' }]],
            [/(\s*)(")([^"]*)(")/, ['', 'keyword.directive.include.begin', 'string.include.identifier', { token: 'keyword.directive.include.end', next: '@pop' }]]
        ]
    }
};
//spellchecker:enable

export function loadCompletion(): monaco.languages.CompletionItem[] {
    let list: any[] = [
        {
            label: 'void create',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'void create() {\n   ::create();\n}'
        },
        {
            label: 'void init',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'void init() {\n   ::init();\n}'
        },
        {
            label: 'void reset',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'void reset() {\n   ::reset();\n}'
        }
    ];
    const p = parseTemplate(path.join('{assets}', 'editor', 'docs'));
    list = list.concat(getCompletionFromPath(path.join(p, 'applies', 'interactive'), monaco.languages.CompletionItemKind.Interface));
    list = list.concat(getCompletionFromPath(path.join(p, 'applies', 'object'), monaco.languages.CompletionItemKind.Interface));
    list = list.concat(getCompletionFromPath(path.join(p, 'constants'), monaco.languages.CompletionItemKind.Variable));
    list = list.concat(getCompletionFromPath(path.join(p, 'efuns'), monaco.languages.CompletionItemKind.Function));
    list = list.concat(getCompletionFromPath(path.join(p, 'sefuns'), monaco.languages.CompletionItemKind.Class));
    list = list.concat(getCompletionFromPath(path.join(p, 'lfuns'), monaco.languages.CompletionItemKind.Property));
    list = list.concat(getCompletionFromFile(path.join(p, 'inherits.txt'), monaco.languages.CompletionItemKind.Module));
    return list;
}

function getCompletionFromPath(p, kind?: monaco.languages.CompletionItemKind, prefix?): monaco.languages.CompletionItem[] {
    const list = [];
    const files = walkSync(p);
    const l = files.files.length;
    let f = 0;
    if (!prefix) prefix = '';
    for (; f < l; f++) {
        list.push(
            {
                label: prefix + path.basename(files.files[f], path.extname(files.files[f])),
                kind: kind,
                insertText: prefix + path.basename(files.files[f], path.extname(files.files[f]))
            }
        );
    }
    return list;
}

function getCompletionFromFile(p, kind?: monaco.languages.CompletionItemKind, prefix?): monaco.languages.CompletionItem[] {
    const list = [];
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    const l = lines.length;
    let f = 0;
    if (!prefix) prefix = '';
    for (; f < l; f++) {
        if (lines[f].length === 0) continue;
        list.push(
            {
                label: prefix + lines[f],
                kind: kind,
                insertText: prefix + lines[f]
            }
        );
    }
    return list;
}

enum TokenType {
    SEMICOLON = 0,
    LBRACKET = 1,
    RBRACKET = 2,
    LOPERATOR = 3,
    ROPERATOR = 4,
    LHOOK = 5,
    RHOOK = 6,
    LHOOK2 = 7,
    RHOOK2 = 8,
    TOKEN = 9,
    ELSE = 10,
    IF = 11,
    SWITCH = 12,
    CASE = 13,
    FOR = 14,
    WHILE = 15,
    XDO = 16,
    XEOT = 17
}

class Stack {
    public size: number;
    private $stack = [];
    private position = 0;

    constructor(size) {
        this.size = size;
        if (Array.isArray(size))
            this.$stack = size;
        else
            this.$stack = new Array(size).fill(0);
    }

    set set(value) {
        this.$stack[this.position] = value;
    }
    public query(p) {
        if (!p)
            return this.$stack[this.position];
        if (p < 0)
            return this.$stack[0];
        if (p >= this.$stack.length)
            return this.$stack[this.$stack.length - 1];
        return this.$stack[p];
    }

    public getNext(p) {
        if (!p) p = 0;
        return this.query(p + this.position);
    }

    public next(value?) {
        if (this.position < this.$stack.length - 1)
            this.position++;
        if (value !== undefined)
            this.$stack[this.position] = value;
        return this.$stack[this.position];
    }

    public prev(value?) {
        if (this.position > 0)
            this.position--;
        if (value !== undefined)
            this.$stack[this.position] = value;
        return this.$stack[this.position];
    }

    public last(value?) {
        this.position = this.$stack.length - 1;
        if (value !== undefined)
            this.$stack[this.position] = value;
        return this.$stack[this.position];
    }

    get current() {
        return this.$stack[this.position];
    }

    get length() {
        return this.$stack.length;
    }

    get bottom() {
        return this.position >= this.$stack.length;
    }

    get stack() {
        return this.$stack;
    }

    public copy() {
        return this.$stack.slice();
    }
}

export class LPCIndenter extends EventEmitter {
    private $stack: Stack; /* token stack */
    private $ind: Stack; /* indent stack */
    private $quote; /* ' or " */
    private $in_pp_control;
    private $after_keyword_t;
    private $in_mBlock; /* status */
    private $in_comment;
    private $last_term;
    private $shi; /* the current shift (negative for left shift) */
    //            0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17
    private $f = [8, 1, 8, 1, 2, 1, 5, 1, 7, 4, 2, 7, 8, 8, 8, 8, 2, 0];
    private $g = [2, 2, 1, 8, 1, 5, 1, 7, 1, 3, 7, 2, 2, 8, 2, 2, 2, 0];

    public shift = 3;
    public halfShift = 2;

    private shiftLine(line) {
        if (!line || line.length === 0)
            return line;
        let ii = 0;
        let ptr = 0;
        const ll = line.length;
        let c = line.charAt(ptr);
        while (ptr < ll && (c === ' ' || c === '\t')) {
            if (c === ' ')
                ii++;
            else
                ii = ii + 8 - (ii % 8);
            ptr++;
            c = line.charAt(ptr);
        }
        if (ptr >= ll) return line;

        ii += this.$shi;

        let newline = '';
        /* fill with leading ws */
        while (ii > 0) {
            newline += ' ';
            --ii;
        }
        return newline + line.substring(ptr);
    }

    private stringNCompare(str1, str2, n) {
        str1 = str1.substring(0, n);
        str2 = str2.substring(0, n);
        return ((str1 === str2) ? 0 : ((str1 > str2) ? 1 : -1));
    }

    private is_alpha(c) {
        return (((c >= 'a') && (c <= 'z')) || ((c >= 'A') && (c <= 'Z')));
    }

    private is_digit(c) {
        return ((c >= '0') && (c <= '9'));
    }

    private is_alphanumeric(c) {
        return (this.is_alpha(c) || this.is_digit(c));
    }
    private indent_line(line, lineNo) {
        if (!line || line.length === 0) return line;
        let pl = line.length;
        let p = 0;
        let do_indent = false;
        let indent_index = 0;
        let ident;
        let token;
        let top;
        let ip: Stack;
        let sp: Stack;
        let newLine;

        if (this.$quote)
            this.$shi = 0;
        else if (this.$in_pp_control || line.charAt(p) === '#') {
            while (p < pl) {
                if (line.charAt(p) === '\\' && p + 1 === pl) {
                    this.$in_pp_control = true;
                    return newLine || line;
                }
                p++;
            }
            this.$in_pp_control = false;
            return newLine || line;
        }
        else if (this.$in_mBlock) {
            if (!this.stringNCompare(line, this.$last_term, this.$last_term.length)) {
                this.$in_mBlock = false;
                p += this.$last_term.length;
            }
            else
                return newLine || line;
        }
        else {
            while (p < pl && (line.charAt(p) === ' ' || line.charAt(p) === '\t')) {
                if (line.charAt(p++) === ' ')
                    indent_index++;
                else
                    indent_index = indent_index + 8 - (indent_index % 8);
            }
            if (p >= pl)
                return newLine || line;
            else if (this.$in_comment > 0) {
                newLine = this.shiftLine(newLine || line);
            }
            else
                do_indent = true;
        }

        pl = line.length;

        const start = p;
        while (p < pl) {
            ident = '';
            if (this.$in_comment > 0) {
                while (line.charAt(p) !== '*') {
                    if (p >= pl) {
                        if (this.$in_comment === 2) this.$in_comment = 0;
                        return newLine || line;
                    }
                    p++;
                }
                while (line.charAt(p) === '*')
                    p++;
                if (line.charAt(p) === '/') {
                    this.$in_comment = 0;
                    p++;
                }
                continue;
            }
            else if (this.$quote) {
                while (true) {
                    if (line.charAt(p) === '\\')
                        p++;
                    else if (line.charAt(p) === this.$quote) {
                        this.$quote = 0;
                        p++;
                        break;
                    }
                    else if (p >= pl)
                        throw { message: `Unterminated string, line: ${lineNo + 1}, Column: ${p}`, line: lineNo, col: p - 1 };
                    else if (line.charAt(p) === '\\' && p + 1 === pl)
                        break;
                    p++;
                }
                token = TokenType.TOKEN;
            }
            else {
                let c = line.charAt(p++);
                switch (c) {
                    case ' ':
                    case '\t':
                        continue;
                    case '\'':
                    case '"':
                        this.$quote = c;
                        if (p >= pl)
                            throw { message: `Unterminated string, line: ${lineNo + 1}, Column: ${p}`, line: lineNo, col: p - 1 };
                        continue;
                    case '@':
                        c = line.charAt(p);
                        if (c === '@')
                            c = line.charAt(p++);
                        this.$last_term = '';
                        while (this.is_alphanumeric(c) || c === '_') {
                            this.$last_term += c;
                            c = line.charAt(++p);
                        }
                        this.$in_mBlock = true;
                        return newLine || line;
                    case '/':
                        if (line.charAt(p) === '*' || line.charAt(p) === '/') {
                            this.$in_comment = (line.charAt(p) === '*') ? 1 : 2;
                            if (do_indent) {
                                this.$shi = this.$ind.current - indent_index;

                                newLine = this.shiftLine(newLine || line);
                                //p += shi;
                                do_indent = false;
                            }
                            else {
                                let q;
                                let index2 = this.$ind.current;
                                for (q = start; q < p - 1; q++) {
                                    if (line.charAt(q) === '\t') {
                                        indent_index = indent_index + 8 - (indent_index % 8);
                                        index2 = index2 + 8 - (index2 % 8);
                                    }
                                    else {
                                        indent_index++;
                                        index2++;
                                    }
                                }
                                this.$shi = index2 - indent_index;
                            }
                            p++;
                            if (p >= pl && this.$in_comment === 2)
                                this.$in_comment = 0;
                            if (this.$in_comment === 2) {
                                this.$in_comment = 0;
                                return newLine || line;
                            }
                            continue;
                        }
                        token = TokenType.TOKEN;
                        break;
                    case '{':
                        token = TokenType.LBRACKET;
                        break;
                    case '(':
                        if (this.$after_keyword_t) {
                            token = TokenType.LOPERATOR;
                            break;
                        }
                        if (line.charAt(p) === '{' || line.charAt(p) === '[' || (line.charAt(p) === ':' && line.charAt(p + 1) !== ':')) {
                            p++;
                            token = TokenType.LHOOK2;
                            break;
                        }
                        token = TokenType.LHOOK;
                        break;
                    case '[':
                        token = TokenType.LHOOK;
                        break;
                    case ':':
                        if (line.charAt(p) === ')') {
                            p++;
                            token = TokenType.RHOOK2;
                            break;
                        }
                        token = TokenType.TOKEN;
                        break;
                    case '}':
                        if (line.charAt(p) !== ')') {
                            token = TokenType.RBRACKET;
                            break;
                        }
                        p++;
                        token = TokenType.RHOOK2;
                        break;
                    case ']':
                        if (line.charAt(p) === ')' &&
                            (this.$stack.current === TokenType.LHOOK2 ||
                                (this.$stack.current !== TokenType.XEOT && (
                                    this.$stack.getNext(1) === TokenType.LHOOK2 ||
                                    (this.$stack.getNext(1) === TokenType.ROPERATOR && this.$stack.getNext(2) === TokenType.LHOOK2) ||
                                    (this.$stack.getNext(1) === TokenType.LHOOK && this.$stack.getNext(2) === TokenType.LHOOK2) || // handle nested array in mapping no token
                                    (this.$stack.getNext(1) === TokenType.LHOOK && this.$stack.getNext(2) === TokenType.TOKEN && this.$stack.getNext(3) === TokenType.LHOOK2) //handled nested array in mapping
                                )))) {
                            p++;
                            token = TokenType.RHOOK2;
                        }
                        //handle array calls inside mappings if last element
                        else if (line.charAt(p) === ')' && this.$stack.current !== TokenType.XEOT) {
                            let n = 0;
                            const l = this.$stack.length;
                            while (n + 1 < l) {
                                if (this.$stack.getNext(n) === TokenType.RHOOK && this.$stack.getNext(n + 1) === TokenType.LHOOK)
                                    n += 2;
                                else if (this.$stack.getNext(n) === TokenType.TOKEN)
                                    n++;
                                else
                                    break;
                            }
                            if (this.$stack.getNext(n) === TokenType.LHOOK2) {
                                p++;
                                token = TokenType.RHOOK2;
                            }
                            else
                                token = TokenType.RHOOK;
                        }
                        else
                            token = TokenType.RHOOK;
                        break;
                    case ')':
                        token = TokenType.RHOOK;
                        break;
                    case ';':
                        token = TokenType.SEMICOLON;
                        break;
                    default:
                        if (this.is_alpha(line.charAt(--p)) || line.charAt(p) === '_') {
                            ident = '';
                            do {
                                ident += line.charAt(p++);
                            }
                            while (this.is_alphanumeric(line.charAt(p)) || line.charAt(p) === '_');
                            if (ident === 'switch')
                                token = TokenType.SWITCH;
                            //track case and default for more indenting
                            else if (ident === 'case' || ident === 'default')
                                token = TokenType.CASE;
                            else if (ident === 'if')
                                token = TokenType.IF;
                            else if (ident === 'else')
                                token = TokenType.ELSE;
                            else if (ident === 'for')
                                token = TokenType.FOR;
                            else if (ident === 'foreach')
                                token = TokenType.FOR;
                            else if (ident === 'while')
                                token = TokenType.WHILE;
                            else if (ident === 'do')
                                token = TokenType.XDO;
                            else
                                token = TokenType.TOKEN;
                        }
                        else {
                            p++;
                            token = TokenType.TOKEN;
                        }
                        break;
                }
            }

            sp = this.$stack;
            ip = this.$ind;
            while (true) {
                top = sp.current;
                if (top === TokenType.LOPERATOR && token === TokenType.RHOOK)
                    token = TokenType.ROPERATOR;
                if (this.$f[top] <= this.$g[token]) { /* shift the token on the stack */
                    let i;
                    if (sp.bottom)
                        throw { message: `Nesting too deep, line: ${lineNo + 1}, Column: ${p}`, line: lineNo, col: p - 1 };

                    i = ip.current;
                    if ((token === TokenType.LBRACKET &&
                        (sp.current === TokenType.ROPERATOR || sp.current === TokenType.ELSE || sp.current === TokenType.XDO)) ||
                        token === TokenType.RBRACKET || (token === TokenType.IF && sp.current === TokenType.ELSE)) {
                        i -= this.shift; //shift

                    }
                    else if (token === TokenType.RHOOK || token === TokenType.ROPERATOR || token === TokenType.RHOOK2) {
                        i -= this.halfShift; //shift / 2
                    }

                    /* shift the current line, if appropriate */
                    if (do_indent) {
                        this.$shi = i - indent_index;
                        //if (token == TokenType.CASE && sp.current == TokenType.LBRACKET && (ident === "case" || ident === "default"))
                        //this.$shi -= this.shift; //shift
                        if (token === TokenType.CASE) //if case shift back one just for this line
                            this.$shi -= this.shift; //shift
                        //if in a switch and { shift back just for this line
                        else if (token === TokenType.LBRACKET &&
                            sp.current === TokenType.ROPERATOR &&
                            sp.getNext(1) === TokenType.LOPERATOR &&
                            sp.getNext(2) === TokenType.SWITCH
                        )
                            this.$shi -= this.shift;
                        //if in a switch and ending } shift back just for this line
                        else if (token === TokenType.RBRACKET &&
                            sp.current === TokenType.LBRACKET &&
                            sp.getNext(1) === TokenType.ROPERATOR &&
                            sp.getNext(2) === TokenType.LOPERATOR &&
                            sp.getNext(3) === TokenType.SWITCH
                        )
                            this.$shi -= this.shift;
                        newLine = this.shiftLine(newLine || line);
                        //p += shi;
                        do_indent = false;
                    }
                    /* change indentation after current token */
                    switch (token) {
                        case TokenType.SWITCH:
                        case TokenType.CASE:
                            i += this.shift;
                            break;
                        case TokenType.IF:
                            break;
                        case TokenType.LBRACKET:
                        case TokenType.ROPERATOR:
                        case TokenType.ELSE:
                        case TokenType.XDO:
                            {
                                /* add indentation */
                                i += this.shift;
                                break;
                            }
                        case TokenType.LOPERATOR:
                        case TokenType.LHOOK:
                        case TokenType.LHOOK2:
                            /* Is this right? */
                            {
                                /* half indent after ( [ ({ ([ */
                                i += this.halfShift;
                                break;
                            }
                        case TokenType.SEMICOLON:
                            {
                                /* in case it is followed by a comment */
                                if (sp.current === TokenType.ROPERATOR || sp.current === TokenType.ELSE)
                                    i -= this.shift;
                                break;
                            }
                    }
                    sp.prev(token);
                    ip.prev(i);
                    break;
                }
                do {
                    top = sp.current;
                    sp.next();
                    ip.next();
                } while (this.$f[sp.current] >= this.$g[top]);
            }
            this.$stack = sp;
            this.$ind = ip;

            this.$after_keyword_t = (token >= TokenType.IF && token !== TokenType.CASE);
        }
        if (p >= pl && this.$quote)
            throw { message: `Unterminated string, line: ${lineNo + 1}, Column: ${p}`, line: lineNo, col: p - 1 };

        return newLine || line;
    }

    private indentLines(lines, c, chunk) {
        let ce = c + chunk;
        let ln = c;
        const ll = lines.length;
        try {
            for (; ln < ll && ln < ce; ln++)
                lines[ln] = this.indent_line(lines[ln], ln);
            if (ln < lines.length - 1) {
                ce = Math.ceil(100 * ce / lines.length);
                setTimeout(() => { this.indentLines(lines, ln, chunk); }, 5);
                this.emit('progress', ce, c, chunk, lines);
            }
            else {
                this.emit('complete', lines);
            }
        }
        catch (e) {
            this.emit('error', e);
        }
        return lines;
    }

    public reset() {
        this.$stack = new Stack(2048);
        this.$stack.last(TokenType.XEOT);
        this.$ind = new Stack(2048);
        this.$ind.last(0);
        this.$in_pp_control = 0;
        this.$in_comment = 0;
        this.$in_mBlock = 0;
        this.$quote = 0;
        this.emit('start');
    }

    public indent(code) {
        if (!code || code.length === 0)
            return code;
        this.reset();
        this.indentLines(code.split('\n'), 0, 100);
    }

    public indentAll(code) {
        if (!code || code.length === 0)
            return code;
        this.reset();
        const lines = code.split('\n');
        return this.indentLines(lines, 0, lines.length).join('\n');
    }
}

enum FormatTokenType {
    unknown,
    text,
    keyword,
    datatype,
    modifier,
    constant,
    parenLMapping,
    parenLArray,
    parenLClosure,
    parenLParen,
    parenLBrace,
    parenLBracket,
    parenRArray,
    parenRBrace,
    parenRBracket,
    parenRMapping,
    parenRClosure,
    parenRParen,
    string,
    char,
    whitespace,
    newline,
    operator,
    operatorBase,
    operatorMethod,
    operatorNot,
    commentInline,
    commentLeft,
    commentRight,
    flatten,
    semicolon,
    precompiler,
    comma,
    stringBlock
}

interface FormatToken {
    value: string;
    type: FormatTokenType;
}

export class LPCFormatter extends EventEmitter {
    private $src = '';
    private $position = 0;
    private $inComment = 0;
    //private tokens = [];
    private block = [];
    private b = [];

    public bracketsOnNewline = true;

    public format(source) {
        if (!source || source.length === 0)
            return '';

        this.block = [];
        this.b = [];
        this.$src = source;
        this.$position = 0;
        const tokens = this.tokenize();
        this.emit('start');
        let tp = 0;
        const tl = tokens.length;
        let op = '';
        let s;
        let e;
        let t;
        let t2;
        let tll;
        let t3;
        let t1;
        let pc;
        let inCase;
        let inComment = 0;
        let inClosure = 0;
        let inIf = 0;
        let p = 0;
        let mBlock = 0;
        let leading;
        let tokenLine;
        for (; tp < tl; tp++) {
            leading = '';
            tokenLine = tokens[tp];
            for (t = 0, tll = tokenLine.length; t < tll; t++) {
                if (tokenLine[t].type !== FormatTokenType.whitespace)
                    break;
                op += tokenLine[t].value;
                leading += tokenLine[t].value;
            }
            s = t;
            pc = tokenLine[t].type === FormatTokenType.precompiler ? 1 : 0;
            inCase = 0;
            if (inComment === 1) inComment = 0;
            while (t < tll) {
                if (inComment === 0 && tokenLine[t].type === FormatTokenType.stringBlock && t + 1 < tll)
                    mBlock = tokenLine[t + 1].value;
                if (!mBlock) {
                    if (inComment === 0 && inIf && tokenLine[t].type === FormatTokenType.parenLParen)
                        p++;
                    else if (tokenLine[t].type === FormatTokenType.parenLClosure)
                        inClosure++;
                    else if (tokenLine[t].type === FormatTokenType.parenRClosure)
                        inClosure--;
                    else if (inComment === 0 && tokenLine[t].type === FormatTokenType.commentInline)
                        inComment = 1;
                    else if (inComment === 0 && tokenLine[t].type === FormatTokenType.commentLeft)
                        inComment = 2;
                    else if (tokenLine[t].type === FormatTokenType.commentRight)
                        inComment = 0;
                    else if (!pc && inComment === 0 && inClosure === 0 && s !== t && tokenLine[t].type === FormatTokenType.keyword) {
                        switch (tokenLine[t].value) {
                            case 'break':
                            case 'case':
                            case 'continue':
                            case 'default':
                            case 'do':
                            case 'else':
                            case 'for':
                            case 'foreach':
                            case 'goto':
                            case 'return':
                            case 'switch':
                            case 'while':
                            //case 'catch':
                            case 'try':
                            case 'using':
                                if (!op.rtrim().endsWith('\n'))
                                    op += '\n' + leading + '   ';
                                break;
                            case 'throw':
                                if (!op.rtrim().endsWith('\n') && !op.endsWith('->'))
                                    op += '\n' + leading + '   ';
                                break;
                            case 'if':
                                if (!op.endsWith('else ') && !op.rtrim().endsWith('\n'))
                                    op += '\n' + leading + '   ';
                                break;
                        }
                    }
                }
                inCase = (inCase || tokenLine[t].value === 'case' || tokenLine[t].value === 'default') ? 1 : 0;
                if (!mBlock && inComment === 0) {
                    if (tokenLine[t].type === FormatTokenType.semicolon) {
                        op = op.trimRight();
                        if (op.endsWith('{'))
                            op += '\n';
                    }
                    else if (s !== t) {
                        if (tokenLine[t].type === FormatTokenType.comma || tokenLine[t].type === FormatTokenType.semicolon)
                            op = op.trimRight();
                        else if (tokenLine[t].type === FormatTokenType.operatorBase) {
                            t3 = t - 1;
                            while (t3 >= 0 && tokenLine[t3].type === FormatTokenType.whitespace) {
                                t3--;
                                if (t3 <= 0)
                                    break;
                            }
                            if (tokenLine[t3].type === FormatTokenType.operatorNot && tokenLine[t3].value === '!')
                                op = op.rtrim();
                            else if (tokenLine[t3].type === FormatTokenType.parenLParen)
                                op = op.rtrim();
                            else if (tokenLine[t3].type !== FormatTokenType.text || tokenLine[t3].type === FormatTokenType.parenLClosure || tokenLine[t3].type === FormatTokenType.parenRClosure || tokenLine[t3].type === FormatTokenType.parenLMapping || tokenLine[t3].type === FormatTokenType.parenRMapping || tokenLine[t3].type === FormatTokenType.parenRArray || tokenLine[t3].type === FormatTokenType.parenLArray) {
                                op = op.rtrim();
                                op += ' ';
                            }
                            else
                                op = op.rtrim();
                        }
                        else if (!pc && tokenLine[t].type === FormatTokenType.operator) {
                            if (!inCase || (inCase && tokenLine[t].value !== ':')) {
                                if (tokenLine[t].value === '-') {
                                    t3 = t - 1;
                                    while (t3 >= 0 && tokenLine[t3].type === FormatTokenType.whitespace) {
                                        t3--;
                                        if (t3 <= 0)
                                            break;
                                    }
                                    if (t3 < 0 || (tokenLine[t3].type !== FormatTokenType.operatorNot && tokenLine[t3].type !== FormatTokenType.parenLParen)) {
                                        op = op.rtrim();
                                        op += ' ';
                                    }
                                    else if (t3 >= 0 && tokenLine[t3].type === FormatTokenType.parenLParen)
                                        op.rtrim();
                                }
                                /*
                                else if (tokenLine[t].value === '<<' || tokenLine[t].value === '>>') {
                                    t3 = t + 1;
                                    while (t3 < tll && tokenLine[t3].type === FormatTokenType.whitespace) {
                                        t3++;
                                        if (t3 <= 0)
                                            break;
                                    }
                                    if (t3 < tll && tokenLine[t3].type === FormatTokenType.operator && tokenLine[t3].value === '=')
                                        op = op.rtrim();
                                    else {
                                        op = op.rtrim();
                                        op += ' ';
                                    }
                                }
                                */
                                else if (tokenLine[t].value === '=') {
                                    t3 = t - 1;
                                    while (t3 >= 0 && tokenLine[t3].type === FormatTokenType.whitespace) {
                                        t3--;
                                        if (t3 <= 0)
                                            break;
                                    }
                                    if (t3 >= 0 && tokenLine[t3].type === FormatTokenType.operator
                                        && (tokenLine[t3].value === '<<' || tokenLine[t3].value === '>>'))
                                        op = op.rtrim();
                                    else {
                                        op = op.rtrim();
                                        op += ' ';
                                    }
                                }
                                else if (tokenLine[t].value === '--' || tokenLine[t].value === '++')
                                    op = op.rtrim();
                                else {
                                    op = op.rtrim();
                                    op += ' ';
                                }
                            }
                        }
                        else if (tokenLine[t].type === FormatTokenType.parenLClosure || tokenLine[t].type === FormatTokenType.parenRClosure || tokenLine[t].type === FormatTokenType.parenLMapping || tokenLine[t].type === FormatTokenType.parenRMapping || tokenLine[t].type === FormatTokenType.parenRArray || tokenLine[t].type === FormatTokenType.parenLArray) {
                            op = op.rtrim();
                            op += ' ';
                        }
                        else if (tokenLine[t].type === FormatTokenType.parenRParen) {
                            t3 = t - 1;
                            while (t3 >= 0 && tokenLine[t3].type === FormatTokenType.whitespace) {
                                t3--;
                                if (t3 <= 0)
                                    break;
                            }
                            if (tokenLine[t3].type === FormatTokenType.parenLClosure || tokenLine[t3].type === FormatTokenType.parenRClosure || tokenLine[t3].type === FormatTokenType.parenLMapping || tokenLine[t3].type === FormatTokenType.parenRMapping || tokenLine[t3].type === FormatTokenType.parenRArray || tokenLine[t3].type === FormatTokenType.parenLArray) {
                                op = op.rtrim();
                                op += ' ';
                            }
                            else
                                op = op.rtrim();
                        }
                    }
                    if (tokenLine[t].type === FormatTokenType.comma)
                        op = op.trimRight();
                    else if (tokenLine[t].type === FormatTokenType.newline)
                        op = op.rtrim();
                    if (tokenLine[t].type === FormatTokenType.parenRBrace && s !== t && !op.rtrim().endsWith('\n'))
                        op += '\n' + leading;
                    else if (tokenLine[t].type === FormatTokenType.parenLBrace) {
                        if (op.trimRight().endsWith(' catch') || op.trimRight().endsWith('\ncatch') || op.trimRight() === 'catch') {
                            op = op.trimRight();
                            op += ' ';
                        }
                        else if (!this.bracketsOnNewline && (op.trimRight().endsWith(')') || op.trimRight().endsWith(' else') || op.trimRight().endsWith('\nelse'))) {
                            op = op.trimRight();
                            op += ' ';
                        }
                        else if (s !== t && !op.rtrim().endsWith('\n'))
                            op += '\n' + leading;
                    }
                }
                op += tokenLine[t].value;
                e = t;
                if (!mBlock && inComment === 0) {
                    if (t + 1 < tll) {
                        if (tokenLine[t].type === FormatTokenType.parenLBrace || tokenLine[t].type === FormatTokenType.parenRBrace) {
                            t++;
                            for (; t < tll; t++) {
                                if (tokenLine[t].type === FormatTokenType.whitespace) {
                                    op += tokenLine[t].value;
                                    continue;
                                }
                                break;
                            }
                            if (tokenLine[t].type !== FormatTokenType.newline && !op.rtrim().endsWith('\n'))
                                op += '\n' + leading;
                        }
                        else if (!pc && tokenLine[t].type === FormatTokenType.operator || tokenLine[t].type === FormatTokenType.comma || tokenLine[t].type === FormatTokenType.semicolon) {
                            t2 = t + 1;
                            t3 = t - 1;
                            t1 = t;
                            if (tokenLine[t2].type !== FormatTokenType.newline) {
                                while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                    t++;
                                    e++;
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                while (t3 >= 0 && tokenLine[t3].type === FormatTokenType.whitespace) {
                                    t3--;
                                    if (t3 <= 0)
                                        break;
                                }
                                if (t2 < tll) {
                                    //only - matters as only operator that can standalone for signage
                                    if (tokenLine[t1].value === '-') {
                                        //previous is text so should add a space
                                        if (t3 >= 0 && (tokenLine[t3].type === FormatTokenType.text ||
                                            tokenLine[t3].type === FormatTokenType.parenRParen ||
                                            tokenLine[t3].type === FormatTokenType.parenRBracket ||
                                            tokenLine[t3].type === FormatTokenType.parenRMapping ||
                                            tokenLine[t3].type === FormatTokenType.parenRClosure ||
                                            tokenLine[t3].type === FormatTokenType.parenRArray
                                        )) {
                                            op = op.rtrim();
                                            op += ' ';
                                        }
                                    } //datatype + * is an array no space after
                                    else if (tokenLine[t1].value === '*') {
                                        //previous is text so should add a space
                                        if (t3 < 0 || (t3 >= 0 && tokenLine[t3].type !== FormatTokenType.datatype && tokenLine[t3].type !== FormatTokenType.comma)) {
                                            op = op.rtrim();
                                            op += ' ';
                                        }
                                    }
                                    /*
                                    else if (tokenLine[t1].value === '<<' || tokenLine[t1].value === '>>') {
                                        t3 = t + 1;
                                        while (t3 < tll && tokenLine[t3].type === FormatTokenType.whitespace) {
                                            t3++;
                                            if (t3 <= 0)
                                                break;
                                        }
                                        if (t3 < tll && tokenLine[t3].type === FormatTokenType.operator && tokenLine[t3].value === '=')
                                            op = op.rtrim();
                                        else {
                                            op = op.rtrim();
                                            op += ' ';
                                        }
                                    }
                                    */
                                    else if (tokenLine[t1].value === '--' || tokenLine[t1].value === '++')
                                        op = op.trimRight();
                                    else if (inCase && tokenLine[t1].value === ':') {
                                        op = op.trimRight();
                                        op += '\n';
                                        inCase = 0;
                                    }
                                    /*
                                    else if (tokenLine[t1].value === '=') {
                                        //previous is text so should add a space
                                        if (t3 >= 0 && tokenLine[t3].type === FormatTokenType.operator
                                            && (tokenLine[t3].value === '<<' || tokenLine[t3].value === '>>'))
                                            op = op.trimRight();
                                        else {
                                            op = op.trimRight();
                                            op += ' ';
                                        }
                                    }
                                    */
                                    else {
                                        op = op.trimRight();
                                        op += ' ';
                                    }
                                }
                            }
                        }
                        else if (!pc && tokenLine[t].type === FormatTokenType.operatorNot && tokenLine[t].value === '!') {
                            t2 = t + 1;
                            if (tokenLine[t2].type !== FormatTokenType.newline) {
                                while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                if (t2 < tll) {
                                    if (tokenLine[t2].type === FormatTokenType.text) {
                                        e = t2 - 1;
                                        t = t2 - 1;
                                    }
                                    else if (tokenLine[t2].type === FormatTokenType.operator && tokenLine[t2].value === '-') {
                                        e = t2 - 1;
                                        t = t2 - 1;
                                    }
                                    else if (tokenLine[t2].type === FormatTokenType.operatorNot && tokenLine[t2].value === '!') {
                                        e = t2 - 1;
                                        t = t2 - 1;
                                    }
                                }
                            }
                        }
                        else if ((tokenLine[t].type === FormatTokenType.parenLClosure || tokenLine[t].type === FormatTokenType.parenRClosure || tokenLine[t].type === FormatTokenType.parenLMapping || tokenLine[t].type === FormatTokenType.parenRMapping || tokenLine[t].type === FormatTokenType.parenRArray || tokenLine[t].type === FormatTokenType.parenLArray)) {
                            t2 = t + 1;
                            if (tokenLine[t2].type !== FormatTokenType.newline) {
                                while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                    t++;
                                    e++;
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                if (t2 < tll) {
                                    op = op.rtrim();
                                    op += ' ';
                                }
                            }
                        }
                        else if ((tokenLine[t].type === FormatTokenType.parenLParen)) {
                            t2 = t + 1;
                            if (tokenLine[t2].type !== FormatTokenType.newline) {
                                while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                    t++;
                                    e++;
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                if (t2 < tll) {
                                    op = op.rtrim();
                                    //op += " ";
                                }
                            }
                        }
                        else if ((tokenLine[t].type === FormatTokenType.operatorBase)) {
                            t2 = t + 1;
                            if (tokenLine[t2].type !== FormatTokenType.newline) {
                                while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                    t++;
                                    e++;
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                if (t2 < tll) {
                                    op = op.rtrim();
                                }
                            }
                        }
                        else if (!pc && inClosure === 0 && tokenLine[t].type === FormatTokenType.keyword) {
                            t2 = t + 1;
                            switch (tokenLine[t].value) {
                                case 'return':
                                    while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                        t++;
                                        e++;
                                        t2++;
                                        if (t2 >= tll)
                                            break;
                                    }
                                    if (tokenLine[t2].type !== FormatTokenType.semicolon)
                                        op += ' ';
                                    break;
                                case 'break':
                                case 'continue':
                                case 'default':
                                    while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                        t++;
                                        e++;
                                        t2++;
                                        if (t2 >= tll)
                                            break;
                                    }
                                    break;
                                case 'case':
                                case 'do':
                                //case 'else':
                                case 'for':
                                case 'foreach':
                                case 'goto':
                                case 'switch':
                                case 'while':
                                case 'catch':
                                case 'try':
                                case 'throw':
                                case 'using':
                                    break;
                                case 'else':
                                    while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                        t++;
                                        e++;
                                        t2++;
                                        if (t2 >= tll)
                                            break;
                                    }
                                    if (t2 < tll && tokenLine[t2].type === FormatTokenType.commentInline)
                                        op += ' ';
                                    else if (t2 < tll && tokenLine[t2].value !== 'if' && tokenLine[t2].type !== FormatTokenType.parenLBrace && tokenLine[t2].type !== FormatTokenType.newline) {
                                        op.rtrim();
                                        op += '\n';
                                    }
                                    else if (t2 < tll && tokenLine[t2].type !== FormatTokenType.newline)
                                        op += ' ';
                                    break;
                                case 'if':
                                    while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                        t++;
                                        e++;
                                        t2++;
                                        if (t2 >= tll)
                                            break;
                                    }
                                    inIf = 1;
                                    break;
                            }
                        }
                    }
                    if (inIf && tokenLine[t].type === FormatTokenType.parenRParen) {
                        p--;
                        if (p === 0) {
                            t2 = t + 1;
                            if (t2 < tll && tokenLine[t2].type !== FormatTokenType.newline && tokenLine[t].type !== FormatTokenType.parenLBrace && tokenLine[t].type !== FormatTokenType.keyword && tokenLine[t].type === FormatTokenType.commentInline) {
                                while (tokenLine[t2].type === FormatTokenType.whitespace) {
                                    t++;
                                    e++;
                                    t2++;
                                    if (t2 >= tll)
                                        break;
                                }
                                if (t2 < tll && tokenLine[t2].type !== FormatTokenType.newline && tokenLine[t2].type !== FormatTokenType.parenLBrace && tokenLine[t2].type !== FormatTokenType.keyword && tokenLine[t2].type !== FormatTokenType.commentInline) {
                                    op = op.rtrim();
                                    op += '\n' + leading;
                                }
                            }
                            inIf = 0;
                        }
                    }
                }
                if (t === s && mBlock === tokenLine[t].value && t + 1 < tll && tokens[tp][t + 1].value === ';')
                    mBlock = 0;
                t = e;
                t++;
            }
        }
        this.emit('end');
        return op;
    }

    //spellchecker:disable
    private tokenType(txt) {
        switch (txt) {
            case 'break':
            case 'case':
            case 'continue':
            case 'default':
            case 'do':
            case 'else':
            case 'for':
            case 'foreach':
            case 'goto':
            case 'if':
            case 'return':
            case 'switch':
            case 'while':
            case 'catch':
            case 'try':
            case 'throw':
            case 'using':
                return { value: txt, type: FormatTokenType.keyword };
            case 'object':
            case 'function':
            case 'float':
            case 'mapping':
            case 'string':
            case 'int':
            case 'struct':
            case 'void':
            case 'class':
            case 'status':
            case 'mixed':
            case 'buffer':
            case 'array':
                return { value: txt, type: FormatTokenType.datatype };
            case 'private':
            case 'protected':
            case 'public':
            case 'static':
            case 'varargs':
            case 'nosave':
            case 'nomask':
            case 'virtual':
            case 'inherit':
                return { value: txt, type: FormatTokenType.modifier };
            case 'MUDOS':
            case '__PORT__':
            case '__ARCH__':
            case '__COMPILER__':
            case '__OPTIMIZATION__':
            case 'MUD_NAME':
            case 'HAS_ED':
            case 'HAS_PRINTF':
            case 'HAS_RUSAGE':
            case 'HAS_DEBUG_LEVEL':
            case '__DIR__':
            case 'FLUFFOS':
            case '__WIN32__':
            case '__HAS_RUSAGE__':
            case '__M64__':
            case '__PACKAGE_DB__':
            case '__GET_CHAR_IS_BUFFERED__':
            case '__DSLIB__':
            case '__DWLIB__':
            case '__FD_SETSIZE__':
            case '__VERSION__':
            case '__DEBUG__':
            case 'SIZEOFINT':
            case 'MAX_INT':
            case 'MIN_INT':
            case 'MAX_FLOAT':
            case 'MIN_FLOAT':
                return { value: txt, type: FormatTokenType.constant };
        }
        return { value: txt, type: FormatTokenType.text };
    }
    //spellchecker:enable

    private getToken(): FormatToken {
        const len = this.$src.length;
        let idx = this.$position;
        const s = this.$src;
        let val = '';
        let state = 0;
        let c;
        for (; idx < len; idx++) {
            c = s.charAt(idx);
            //i = s.charCodeAt(idx);
            switch (state) {
                case 1:
                    switch (c) {
                        case '[':
                            this.$position = idx + 1;
                            state = 0;
                            return { value: '([', type: FormatTokenType.parenLMapping };
                        case '{':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: '({', type: FormatTokenType.parenLArray };
                        case ':':
                            state = 0;
                            //(::key
                            if (idx + 1 < len && idx + 2 < len) {
                                //(::)
                                if (s.charAt(idx + 1) === ':' && s.charAt(idx + 2) === ')') {
                                    this.$position = idx + 1;
                                    return { value: '(:', type: FormatTokenType.parenLClosure };
                                }
                                else if (s.charAt(idx + 1) === ':' && s.charAt(idx + 2) !== ':') {
                                    this.$position = idx;
                                    return { value: '(', type: FormatTokenType.parenLParen };
                                }
                            }
                            this.$position = idx + 1;
                            return { value: '(:', type: FormatTokenType.parenLClosure };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: '(', type: FormatTokenType.parenLParen };
                    }
                case 2:
                    switch (c) {
                        case ')':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: '})', type: FormatTokenType.parenRArray };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: '}', type: FormatTokenType.parenRBrace };
                    }
                case 3:
                    switch (c) {
                        case ')':
                            state = 0;
                            if (this.b.length) {
                                this.$position = idx;
                                this.b.pop();
                                return { value: ']', type: FormatTokenType.parenRBracket };
                            }
                            this.$position = idx + 1;
                            return { value: '])', type: FormatTokenType.parenRMapping };
                        default:
                            state = 0;
                            this.$position = idx;
                            this.b.pop();
                            return { value: ']', type: FormatTokenType.parenRBracket };
                    }
                case 4:
                    if (this.$inComment && c === '\n') {
                        this.$position = idx;
                        state = 0;
                        return { value: val, type: FormatTokenType.string };
                    }
                    else if (c === '\\') {
                        val += c;
                        state = 5;
                    }
                    else if (c === '"') {
                        val += c;
                        this.$position = idx + 1;
                        state = 0;
                        return { value: val, type: FormatTokenType.string };
                    }
                    else {
                        val += c;
                        this.$position = idx + 1;
                    }
                    break;
                case 5:
                    val += c;
                    this.$position = idx + 1;
                    state = 4;
                    break;
                case 6:
                    if (c === ' ' || c === '\t') {
                        val += c;
                        this.$position = idx + 1;
                    }
                    else {
                        this.$position = idx;
                        state = 0;
                        return { value: val, type: FormatTokenType.whitespace };
                    }
                    break;
                case 7:
                    switch (c) {
                        case ')':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: ':)', type: FormatTokenType.parenRClosure };
                        case ':':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: '::', type: FormatTokenType.operatorBase };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: ':', type: FormatTokenType.operator };
                    }
                case 8:
                    switch (c) {
                        case '/':
                            this.$inComment = 1;
                            this.$position = idx + 1;
                            return { value: '//', type: FormatTokenType.commentInline };
                        case '*':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: '/*', type: FormatTokenType.commentLeft };
                        case '=':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: '/=', type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: '/', type: FormatTokenType.operator };
                    }
                case 9:
                    switch (c) {
                        case '/':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: '*/', type: FormatTokenType.commentRight };
                        case '=':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: '*=', type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: '*', type: FormatTokenType.operator };
                    }
                case 10:
                    switch (c) {
                        case val:
                        case '=':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: val, type: FormatTokenType.operator };
                    }
                case 11: // -- -= ->
                    switch (c) {
                        case '-':
                        case '=':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        case '>':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: '->', type: FormatTokenType.operatorMethod };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: '-', type: FormatTokenType.operator };
                    }
                case 12:
                    switch (c) {
                        case '=':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: val, type: FormatTokenType.operator };
                    }
                case 13:
                    switch (c) {
                        case '=':
                            state = 0;
                            this.$position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: val, type: FormatTokenType.operatorNot };
                    }
                case 14:
                    switch (c) {
                        case '.':
                            val += c;
                            this.$position = idx + 1;
                            if (val.length === 3) {
                                state = 0;
                                return { value: val, type: FormatTokenType.flatten };
                            }
                            break;
                        default:
                            state = 0;
                            this.$position = idx;
                            return { value: val, type: FormatTokenType.unknown };
                    }
                    break;
                case 15:
                    if (c === '\\') {
                        val += c;
                        state = 15;
                    }
                    else if (c === '\'') {
                        val += c;
                        this.$position = idx + 1;
                        state = 0;
                        return { value: val, type: FormatTokenType.char };
                    }
                    else if (val.length > 1 && val[0] !== '\\') {
                        this.$position = idx - val.length + 1;
                        return { value: '\'', type: FormatTokenType.text };
                    }
                    else if (val.length > 2) {
                        this.$position = idx - val.length + 1;
                        return { value: '\'', type: FormatTokenType.text };
                    }
                    else {
                        val += c;
                        this.$position = idx + 1;
                    }
                    break;
                case 16:
                    val += c;
                    this.$position = idx + 1;
                    state = 15;
                    break;
                default:
                    switch (c) {
                        case '(':
                            if (val.length > 0) return this.tokenType(val);
                            state = 1;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: '(', type: FormatTokenType.parenLParen };
                            }
                            break;
                        case ')':
                            if (val.length > 0) return this.tokenType(val);
                            this.$position = idx + 1;
                            return { value: ')', type: FormatTokenType.parenRParen };
                        case '{':
                            if (val.length > 0) return this.tokenType(val);
                            this.$position = idx + 1;
                            return { value: '{', type: FormatTokenType.parenLBrace };
                        case '}':
                            if (val.length > 0) return this.tokenType(val);
                            state = 2;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: '}', type: FormatTokenType.parenRBrace };
                            }
                            break;
                        case ':':
                            if (val.length > 0) return this.tokenType(val);
                            state = 7;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: ':', type: FormatTokenType.operator };
                            }
                            break;
                        case '/':
                            if (val.length > 0) return this.tokenType(val);
                            state = 8;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: '/', type: FormatTokenType.operator };
                            }
                            break;
                        case '*':
                            if (val.length > 0) return this.tokenType(val);
                            state = 9;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: '*', type: FormatTokenType.operator };
                            }
                            break;
                        case '[':
                            if (val.length > 0) return this.tokenType(val);
                            this.$position = idx + 1;
                            this.b.push('[');
                            return { value: '[', type: FormatTokenType.parenLBracket };
                        case ']':
                            if (val.length > 0) return this.tokenType(val);
                            state = 3;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                this.b.pop();
                                return { value: ']', type: FormatTokenType.parenRBracket };
                            }
                            break;
                        case '"':
                            if (val.length > 0) return this.tokenType(val);
                            state = 4;
                            val = '"';
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: '"', type: FormatTokenType.text };
                            }
                            break;
                        case '\'':
                            if (val.length > 0) return this.tokenType(val);
                            state = 15;
                            val = '\'';
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: '\'', type: FormatTokenType.text };
                            }
                            break;
                        case '\r':
                            this.$position = idx + 1;
                            break;
                        case '\n':
                            if (val.length > 0) return this.tokenType(val);
                            this.$inComment = 0;
                            this.$position = idx + 1;
                            return { value: '\n', type: FormatTokenType.newline };
                        case ' ':
                        case '\t':
                            if (val.length > 0) return this.tokenType(val);
                            val += c;
                            this.$position = idx + 1;
                            state = 6;
                            break;
                        case '#':
                            if (val.length > 0) return this.tokenType(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.precompiler };
                        case '&': //&& &=
                        case '|': // || |=
                        case '+': // ++ +=
                        case '<': // << <=
                        case '>': // >> >=
                            if (val.length > 0) return this.tokenType(val);
                            state = 10;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.operator };
                            }
                            break;
                        case '-': // -- -= ->
                            if (val.length > 0) return this.tokenType(val);
                            state = 11;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.operator };
                            }
                            break;
                        case '=': // ==
                        case '%': // %=
                            if (val.length > 0) return this.tokenType(val);
                            state = 12;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.operator };
                            }
                            break;
                        case '!': // !=
                            if (val.length > 0) return this.tokenType(val);
                            state = 13;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.operatorNot };
                            }
                            break;
                        case '.': //...
                            if (val.length > 0) return this.tokenType(val);

                            state = 14;
                            val = c;
                            if (idx + 1 >= len) {
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.unknown };
                            }
                            break;
                        case '?':
                            if (val.length > 0) return this.tokenType(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.operator };
                        case ';':
                            if (val.length > 0) return this.tokenType(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.semicolon };
                        case '\\':
                        case '~':
                        case '^':
                            if (val.length > 0) return this.tokenType(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.text };
                        case ',':
                            if (val.length > 0) return this.tokenType(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.comma };
                        case '@':
                            if (val.length > 0) return this.tokenType(val);
                            this.$position = idx + 1;
                            return { value: c, type: FormatTokenType.stringBlock };
                        default:
                            if (c === '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
                                val += c;
                                this.$position = idx + 1;
                            }
                            else {
                                if (val.length > 0) return this.tokenType(val);
                                this.$position = idx + 1;
                                return { value: c, type: FormatTokenType.unknown };
                            }
                            break;
                    }
                    break;
            }
        }
        if (idx >= len && val.length === 0)
            return null;
        if (state === 6)
            return { value: val, type: FormatTokenType.whitespace };
        return this.tokenType(val);
    }

    private tokenize() {
        let token: FormatToken = this.getToken();
        const tokens = [];
        let t = [];
        while (token) {
            t.push(token);
            if (token.type === FormatTokenType.newline) {
                tokens.push(t);
                t = [];
            }
            token = this.getToken();
        }
        if (t.length)
            tokens.push(t);
        return tokens;
    }
}

export function tokenizeLPC(str, byLine?: boolean) {
    let $position = 0;
    let $inComment = 0;
    let b = [];
    //spellchecker:disable
    let tokenType = function (txt) {
        switch (txt) {
            case 'break':
            case 'case':
            case 'continue':
            case 'default':
            case 'do':
            case 'else':
            case 'for':
            case 'foreach':
            case 'goto':
            case 'if':
            case 'return':
            case 'switch':
            case 'while':
            case 'catch':
            case 'try':
            case 'throw':
            case 'using':
                return { value: txt, type: FormatTokenType.keyword };
            case 'object':
            case 'function':
            case 'float':
            case 'mapping':
            case 'string':
            case 'int':
            case 'struct':
            case 'void':
            case 'class':
            case 'status':
            case 'mixed':
            case 'buffer':
            case 'array':
                return { value: txt, type: FormatTokenType.datatype };
            case 'private':
            case 'protected':
            case 'public':
            case 'static':
            case 'varargs':
            case 'nosave':
            case 'nomask':
            case 'virtual':
            case 'inherit':
                return { value: txt, type: FormatTokenType.modifier };
            case 'MUDOS':
            case '__PORT__':
            case '__ARCH__':
            case '__COMPILER__':
            case '__OPTIMIZATION__':
            case 'MUD_NAME':
            case 'HAS_ED':
            case 'HAS_PRINTF':
            case 'HAS_RUSAGE':
            case 'HAS_DEBUG_LEVEL':
            case '__DIR__':
            case 'FLUFFOS':
            case '__WIN32__':
            case '__HAS_RUSAGE__':
            case '__M64__':
            case '__PACKAGE_DB__':
            case '__GET_CHAR_IS_BUFFERED__':
            case '__DSLIB__':
            case '__DWLIB__':
            case '__FD_SETSIZE__':
            case '__VERSION__':
            case '__DEBUG__':
            case 'SIZEOFINT':
            case 'MAX_INT':
            case 'MIN_INT':
            case 'MAX_FLOAT':
            case 'MIN_FLOAT':
                return { value: txt, type: FormatTokenType.constant };
        }
        return { value: txt, type: FormatTokenType.text };
    }
    //spellchecker:enable

    let getToken = function (): FormatToken {
        const len = str.length;
        let idx = $position;
        const s = str;
        let val = '';
        let state = 0;
        let c;
        for (; idx < len; idx++) {
            c = s.charAt(idx);
            //i = s.charCodeAt(idx);
            switch (state) {
                case 1:
                    switch (c) {
                        case '[':
                            $position = idx + 1;
                            state = 0;
                            return { value: '([', type: FormatTokenType.parenLMapping };
                        case '{':
                            state = 0;
                            $position = idx + 1;
                            return { value: '({', type: FormatTokenType.parenLArray };
                        case ':':
                            state = 0;
                            //(::key
                            if (idx + 1 < len && idx + 2 < len) {
                                //(::)
                                if (s.charAt(idx + 1) === ':' && s.charAt(idx + 2) === ')') {
                                    $position = idx + 1;
                                    return { value: '(:', type: FormatTokenType.parenLClosure };
                                }
                                else if (s.charAt(idx + 1) === ':' && s.charAt(idx + 2) !== ':') {
                                    $position = idx;
                                    return { value: '(', type: FormatTokenType.parenLParen };
                                }
                            }
                            $position = idx + 1;
                            return { value: '(:', type: FormatTokenType.parenLClosure };
                        default:
                            state = 0;
                            $position = idx;
                            return { value: '(', type: FormatTokenType.parenLParen };
                    }
                case 2:
                    switch (c) {
                        case ')':
                            state = 0;
                            $position = idx + 1;
                            return { value: '})', type: FormatTokenType.parenRArray };
                        default:
                            state = 0;
                            $position = idx;
                            return { value: '}', type: FormatTokenType.parenRBrace };
                    }
                case 3:
                    switch (c) {
                        case ')':
                            state = 0;
                            if (b.length) {
                                $position = idx;
                                b.pop();
                                return { value: ']', type: FormatTokenType.parenRBracket };
                            }
                            $position = idx + 1;
                            return { value: '])', type: FormatTokenType.parenRMapping };
                        default:
                            state = 0;
                            $position = idx;
                            b.pop();
                            return { value: ']', type: FormatTokenType.parenRBracket };
                    }
                case 4:
                    if ($inComment && c === '\n') {
                        $position = idx;
                        state = 0;
                        return { value: val, type: FormatTokenType.string };
                    }
                    else if (c === '\\') {
                        val += c;
                        state = 5;
                    }
                    else if (c === '"') {
                        val += c;
                        $position = idx + 1;
                        state = 0;
                        return { value: val, type: FormatTokenType.string };
                    }
                    else {
                        val += c;
                        $position = idx + 1;
                    }
                    break;
                case 5:
                    val += c;
                    $position = idx + 1;
                    state = 4;
                    break;
                case 6:
                    if (c === ' ' || c === '\t') {
                        val += c;
                        $position = idx + 1;
                    }
                    else {
                        $position = idx;
                        state = 0;
                        return { value: val, type: FormatTokenType.whitespace };
                    }
                    break;
                case 7:
                    switch (c) {
                        case ')':
                            state = 0;
                            $position = idx + 1;
                            return { value: ':)', type: FormatTokenType.parenRClosure };
                        case ':':
                            state = 0;
                            $position = idx + 1;
                            return { value: '::', type: FormatTokenType.operatorBase };
                        default:
                            state = 0;
                            $position = idx;
                            return { value: ':', type: FormatTokenType.operator };
                    }
                case 8:
                    switch (c) {
                        case '/':
                            $inComment = 1;
                            $position = idx + 1;
                            return { value: '//', type: FormatTokenType.commentInline };
                        case '*':
                            state = 0;
                            $position = idx + 1;
                            return { value: '/*', type: FormatTokenType.commentLeft };
                        case '=':
                            state = 0;
                            $position = idx + 1;
                            return { value: '/=', type: FormatTokenType.operator };
                        default:
                            state = 0;
                            $position = idx;
                            return { value: '/', type: FormatTokenType.operator };
                    }
                case 9:
                    switch (c) {
                        case '/':
                            state = 0;
                            $position = idx + 1;
                            return { value: '*/', type: FormatTokenType.commentRight };
                        case '=':
                            state = 0;
                            $position = idx + 1;
                            return { value: '*=', type: FormatTokenType.operator };
                        default:
                            state = 0;
                            $position = idx;
                            return { value: '*', type: FormatTokenType.operator };
                    }
                case 10:
                    switch (c) {
                        case val:
                        case '=':
                            val += c;
                            state = 0;
                            $position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        default:
                            state = 0;
                            $position = idx;
                            return { value: val, type: FormatTokenType.operator };
                    }
                case 11: // -- -= ->
                    switch (c) {
                        case '-':
                        case '=':
                            state = 0;
                            $position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        case '>':
                            state = 0;
                            $position = idx + 1;
                            return { value: '->', type: FormatTokenType.operatorMethod };
                        default:
                            state = 0;
                            $position = idx;
                            return { value: '-', type: FormatTokenType.operator };
                    }
                case 12:
                    switch (c) {
                        case '=':
                            state = 0;
                            $position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        default:
                            state = 0;
                            $position = idx;
                            return { value: val, type: FormatTokenType.operator };
                    }
                case 13:
                    switch (c) {
                        case '=':
                            state = 0;
                            $position = idx + 1;
                            return { value: val + c, type: FormatTokenType.operator };
                        default:
                            state = 0;
                            $position = idx;
                            return { value: val, type: FormatTokenType.operatorNot };
                    }
                case 14:
                    switch (c) {
                        case '.':
                            val += c;
                            $position = idx + 1;
                            if (val.length === 3) {
                                state = 0;
                                return { value: val, type: FormatTokenType.flatten };
                            }
                            break;
                        default:
                            state = 0;
                            $position = idx;
                            return { value: val, type: FormatTokenType.unknown };
                    }
                    break;
                case 15:
                    if (c === '\\') {
                        val += c;
                        state = 15;
                    }
                    else if (c === '\'') {
                        val += c;
                        $position = idx + 1;
                        state = 0;
                        return { value: val, type: FormatTokenType.char };
                    }
                    else if (val.length > 1 && val[0] !== '\\') {
                        $position = idx - val.length + 1;
                        return { value: '\'', type: FormatTokenType.text };
                    }
                    else if (val.length > 2) {
                        $position = idx - val.length + 1;
                        return { value: '\'', type: FormatTokenType.text };
                    }
                    else {
                        val += c;
                        $position = idx + 1;
                    }
                    break;
                case 16:
                    val += c;
                    $position = idx + 1;
                    state = 15;
                    break;
                default:
                    switch (c) {
                        case '(':
                            if (val.length > 0) return tokenType(val);
                            state = 1;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: '(', type: FormatTokenType.parenLParen };
                            }
                            break;
                        case ')':
                            if (val.length > 0) return tokenType(val);
                            $position = idx + 1;
                            return { value: ')', type: FormatTokenType.parenRParen };
                        case '{':
                            if (val.length > 0) return tokenType(val);
                            $position = idx + 1;
                            return { value: '{', type: FormatTokenType.parenLBrace };
                        case '}':
                            if (val.length > 0) return tokenType(val);
                            state = 2;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: '}', type: FormatTokenType.parenRBrace };
                            }
                            break;
                        case ':':
                            if (val.length > 0) return tokenType(val);
                            state = 7;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: ':', type: FormatTokenType.operator };
                            }
                            break;
                        case '/':
                            if (val.length > 0) return tokenType(val);
                            state = 8;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: '/', type: FormatTokenType.operator };
                            }
                            break;
                        case '*':
                            if (val.length > 0) return tokenType(val);
                            state = 9;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: '*', type: FormatTokenType.operator };
                            }
                            break;
                        case '[':
                            if (val.length > 0) return tokenType(val);
                            $position = idx + 1;
                            b.push('[');
                            return { value: '[', type: FormatTokenType.parenLBracket };
                        case ']':
                            if (val.length > 0) return tokenType(val);
                            state = 3;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                b.pop();
                                return { value: ']', type: FormatTokenType.parenRBracket };
                            }
                            break;
                        case '"':
                            if (val.length > 0) return tokenType(val);
                            state = 4;
                            val = '"';
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: '"', type: FormatTokenType.text };
                            }
                            break;
                        case '\'':
                            if (val.length > 0) return tokenType(val);
                            state = 15;
                            val = '\'';
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: '\'', type: FormatTokenType.text };
                            }
                            break;
                        case '\r':
                            $position = idx + 1;
                            break;
                        case '\n':
                            if (val.length > 0) return tokenType(val);
                            $inComment = 0;
                            $position = idx + 1;
                            return { value: '\n', type: FormatTokenType.newline };
                        case ' ':
                        case '\t':
                            if (val.length > 0) return tokenType(val);
                            val += c;
                            $position = idx + 1;
                            state = 6;
                            break;
                        case '#':
                            if (val.length > 0) return tokenType(val);
                            $position = idx + 1;
                            return { value: c, type: FormatTokenType.precompiler };
                        case '&': //&& &=
                        case '|': // || |=
                        case '+': // ++ +=
                        case '<': // << <=
                        case '>': // >> >=
                            if (val.length > 0) return tokenType(val);
                            state = 10;
                            val = c;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: c, type: FormatTokenType.operator };
                            }
                            break;
                        case '-': // -- -= ->
                            if (val.length > 0) return tokenType(val);
                            state = 11;
                            val = c;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: c, type: FormatTokenType.operator };
                            }
                            break;
                        case '=': // ==
                        case '%': // %=
                            if (val.length > 0) return tokenType(val);
                            state = 12;
                            val = c;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: c, type: FormatTokenType.operator };
                            }
                            break;
                        case '!': // !=
                            if (val.length > 0) return tokenType(val);
                            state = 13;
                            val = c;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: c, type: FormatTokenType.operatorNot };
                            }
                            break;
                        case '.': //...
                            if (val.length > 0) return tokenType(val);

                            state = 14;
                            val = c;
                            if (idx + 1 >= len) {
                                $position = idx + 1;
                                return { value: c, type: FormatTokenType.unknown };
                            }
                            break;
                        case '?':
                            if (val.length > 0) return tokenType(val);
                            $position = idx + 1;
                            return { value: c, type: FormatTokenType.operator };
                        case ';':
                            if (val.length > 0) return tokenType(val);
                            $position = idx + 1;
                            return { value: c, type: FormatTokenType.semicolon };
                        case '\\':
                        case '~':
                        case '^':
                            if (val.length > 0) return tokenType(val);
                            $position = idx + 1;
                            return { value: c, type: FormatTokenType.text };
                        case ',':
                            if (val.length > 0) return tokenType(val);
                            $position = idx + 1;
                            return { value: c, type: FormatTokenType.comma };
                        case '@':
                            if (val.length > 0) return tokenType(val);
                            $position = idx + 1;
                            return { value: c, type: FormatTokenType.stringBlock };
                        default:
                            if (c === '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
                                val += c;
                                $position = idx + 1;
                            }
                            else {
                                if (val.length > 0) return tokenType(val);
                                $position = idx + 1;
                                return { value: c, type: FormatTokenType.unknown };
                            }
                            break;
                    }
                    break;
            }
        }
        if (idx >= len && val.length === 0)
            return null;
        if (state === 6)
            return { value: val, type: FormatTokenType.whitespace };
        return tokenType(val);
    }

    let token: FormatToken = getToken();
    const tokens = [];
    let t = [];
    while (token) {
        t.push(token);
        if (byLine && token.type === FormatTokenType.newline) {
            tokens.push(t);
            t = [];
        }
        token = getToken();
    }
    if (!byLine) return t;
    if (t.length)
        tokens.push(t);
    return tokens;

}

export function getFunctionName(name: string) {
    if (!name) return name;
    name = name.trim();
    if (name.startsWith('(:'))
        name = name.substr(2);
    if (name.endsWith(':)'))
        name = name.substr(0, name.length - 2);
    name = name.trim();
    return name;
}

export function createFunction(name: string, type?: any, args?: string, code?: string, varArgs?: boolean) {
    name = getFunctionName(name);
    if (!validFunctionPointer(name)) return '';
    if (typeof type === 'object') {
        if (typeof type.arguments === 'object') {
            const aKeys = Object.keys(type.arguments).sort((a, b) => {
                if (type.arguments[a].expand) return 1;
                if (type.arguments[b].expand) return -1;
                return 0;
            })
            args = aKeys.map(
                arg => `${type.arguments[arg].type || 'mixed'} ${type.arguments[arg].name || arg}${type.arguments[arg].expand ? '...' : ''}`
            ).join(', ');
        }
        else
            args = type.arguments || '';
        code = type.code;
        varArgs = type.variableArguments;
        type = type.type;
    }
    else
        args = args || '';
    if (code && code.length)
        return `${varArgs ? 'varargs ' : ''}${type || 'void'} ${name}(${args})\n{\n${code}\n}\n\n`;
    if (!type || type === 'void')
        return `${varArgs ? 'varargs ' : ''}void ${name}(${args})\n{\n}\n\n`;
    switch (type) {
        case 'string':
            return `${varArgs ? 'varargs ' : ''}${type} ${name}(${args})\n{\n   return "";\n}\n\n`;
        case 'array':
            return `${varArgs ? 'varargs ' : ''}${type} ${name}(${args})\n{\n   return ({ });\n}\n\n`;
        case 'mapping':
            return `${varArgs ? 'varargs ' : ''}${type} ${name}(${args})\n{\n   return ([ ]);\n}\n\n`;
    }
    //array type so return an empty array as stub value
    if (type.trim().endsWith('*'))
        return `${varArgs ? 'varargs ' : ''}${type} ${name}(${args})\n{\n   return ({ });\n}\n\n`;
    return `${varArgs ? 'varargs ' : ''}${type} ${name}(${args})\n{\n   return 0;\n}\n\n`;
}

export function formatFunctionPointer(pointer: string) {
    pointer = getFunctionName(pointer);
    return ` (: ${pointer} :) `;
}

export function formatArgumentList(str, first, second?, indent?, quotes?) {
    if (!str) return;
    first = first || 64;
    second = second || 75;
    indent = indent || 5;
    if (!Array.isArray(str))
        str = str.splitQuote(',');
    str = str.map(s => {
        s = s.trim().replace(/\n|\r/g, '');
        if (!quotes && !s.startsWith('"'))
            s = '"' + s;
        if (!quotes && !s.endsWith('"'))
            s += '"';
        return s;
    });
    const tmp = [];
    const tl = str.length;
    let tmp2 = [];
    let tl2 = 0;
    let w = first;
    for (let t = 0; t < tl; t++) {
        const c = str[t];
        if (tmp.length > 0)
            w = second;
        if (tl2 + (tmp2.length - 1) * 2 + c.length < w) {
            tmp2.push(c);
            tl2 += c.length;
        }
        else {
            tmp.push(tmp2.join(', '));
            tmp2 = [c];
            tl2 = c.length;
        }
    }
    if (tmp2.length)
        tmp.push(tmp2.join(', '));
    return tmp.join(',\n' + ' '.repeat(indent));
}

export function formatMapping(str, indent?, sub?) {
    if (!str) return;
    str = str.trim();
    if (!str.startsWith('([') && !str.ends_with('])'))
        return str;
    const map = parseMapping(str, true);
    indent = ' '.repeat(indent || 0);
    let out = indent + '([\n';
    out += Object.keys(map).map(k => {
        if (map[k].startsWith('(:') && map[k].endsWith(':)'))
            return `${indent}  "${k}" : ${formatFunctionPointer(map[k]).trim()}`;
        if (map[k].startsWith('([') && map[k].endsWith('])'))
            return `${indent}  "${k}" : ${formatArray(map[k], indent.length + 2).trim()}`;
        if (map[k].startsWith('([') && map[k].endsWith('])'))
            return `${indent}  "${k}" : ${formatMapping(map[k], indent.length + 2, true).trim()}`;
        return `${indent}  "${k}" : ${map[k]}`;
    }).join(',\n');
    //if (sub && indent.length !== 0)
    //out += '\n' + indent.substring(0, indent.length - 2) + '])';
    //else
    out += '\n' + indent + '])';
    return out;
}

export function validFunctionPointer(name, clean?) {
    if (!name || name.length === 0) return 0;
    if (clean)
        name = formatFunctionPointer(name);
    return isValidIdentifier(name);
}

export function formatVariableValue(type, value, indent?) {
    //convert to string to format
    value = value ? '' + value : value;
    switch (type) {
        case 'string':
            if (value.trim().startsWith('"') && value.trim().endsWith('"'))
                return `"${value.trim().substr(1, value.trim().length - 2).addSlashes()}"`;
            return `"${value.addSlashes()}"`;
        case 'function':
            return formatFunctionPointer(value);
        case 'mapping':
            return formatMapping(value, indent);
        case 'mixed':
            if (value.trim().startsWith('"') && value.trim().endsWith('"'))
                return `"${value.substr(1, value.length - 2).addSlashes()}"`;
            if (value.trim().startsWith('(:'))
                return formatFunctionPointer(value);
            if (value.trim().startsWith('(['))
                return formatMapping(value, indent);
            if (value.trim().startsWith('({'))
                return formatArray(value, indent);
            break;
    }
    if (type && type.trim().endsWith('*'))
        return formatArray(value, indent);
    return value;
}

function parseString(str, format?) {
    if (!str)
        return str;
    str = str.trim();
    if (str.length === 0)
        return str;
    const end = str.length;
    if (str.startsWith('(:'))
        return format ? formatFunctionPointer(str) : 'Function: ' + str;
    if (str.startsWith('(['))
        return format ? formatMapping(str) : 'Mapping: ' + str;
    if (str.startsWith('({'))
        return format ? formatArray(str) : 'Array: ' + str;
    const sb = [];
    let save = true;
    let c;
    for (let idx = 0; idx < end; idx++) {
        c = str.charAt(idx);
        switch (c) {
            case '\\': //escaped;
                idx++;
                if (idx >= end) break;
                sb.push(c);
                break;
            case '"':
                if (!save) {
                    idx++;
                    while (idx < end && str.charAt(idx) !== '"')
                        idx++;
                    save = true;
                }
                save = false;
                break;
            default:
                sb.push(c);
                break;
        }
    }

    return sb.join('');
}

function parseMapping(str, format?) {
    if (!str || str.length === 0)
        return {};
    if (!str.startsWith('(['))
        return {};
    if (!str.endsWith('])'))
        return {};

    str = str.slice(2, -2).trim();
    let idx = 0;
    let pIdx = 0;
    const end = str.length;
    const m = {};
    let array = 0;
    let pair;
    let c;
    for (; idx < end; idx++) {
        c = str.charAt(idx);
        switch (c) {
            case '/':
                if (idx + 1 < end && str.charAt(idx + 1) === '/') {
                    if (pIdx < idx) {
                        pair = parseKeyPair(str.substring(pIdx, idx).trim(), format);
                        m[pair[0]] = pair[1];
                    }
                    while (idx < end) {
                        c = str.charAt(idx);
                        if (c === '\n')
                            break;
                        idx++;
                        pIdx = idx;
                    }
                }
                else if (idx + 1 < end && str.charAt(idx + 1) === '*') {
                    if (pIdx < idx) {
                        pair = parseKeyPair(str.substring(pIdx, idx).trim(), format);
                        m[pair[0]] = pair[1];
                    }
                    while (idx < end) {
                        c = str.charAt(idx);
                        if (idx + 1 < end && c === '*' && str.charAt(idx + 1) === '/') {
                            break;
                        }
                        idx++;
                        pIdx = idx;
                    }
                }
                break;
            case '(':
                array++;
                break;
            case '"':
                idx++;
                while (idx < end) {
                    c = str.charAt(idx);
                    if (str === '\\')
                        idx++;
                    else if (c === '"')
                        break;
                    idx++;
                }
                break;
            case ')':
                array--;
                break;
            case ',':
                if (array > 0) {
                    idx++;
                    continue;
                }
                pair = parseKeyPair(str.substring(pIdx, idx).trim(), format);
                m[pair[0]] = pair[1];
                pIdx = idx + 1;
                break;
        }
    }
    if (pIdx < idx) {
        pair = parseKeyPair(str.substring(pIdx, idx).trim(), format);
        m[pair[0]] = pair[1];
    }
    return m || {};

}

function parseKeyPair(str, format?) {
    if (!str || str.length === 0)
        return ['', ''];
    const pair = ['', ''];
    let c;
    let idx = 0;
    const end = str.length;
    let array;
    for (; idx < end; idx++) {
        c = str.charAt(idx);
        switch (c) {
            case '(':
                array++;
                break;
            case ')':
                idx++;
                pair[0] = str.substring(0, idx).trim();
                idx++;
                pair[1] = str.substring(idx).trim();
                return pair;
            case '"':
                idx++;
                while (idx < end) {
                    c = str.charAt(idx);
                    if (str === '\\')
                        idx++;
                    else if (c === '"')
                        break;
                    idx++;
                }
                break;
            case ':':
                if (array > 0) continue;
                pair[0] = parseString(str.substring(0, idx), format);
                idx++;
                pair[1] = str.substring(idx).trim();
                return pair;
        }
    }
    pair[0] = str;
    return pair;
}

export function parseArguments(str) {
    if (!str || str.length === 0)
        return [];
    const tokens = tokenizeLPC(str);
    const tl = tokens.length;
    let buff = [];
    let nest = 0;
    let values = [];
    for (let t = 0; t < tl; t++) {
        switch (tokens[t].type) {
            //inside a mapping/array/clousre/ () nested so do not split
            case FormatTokenType.parenLMapping:
            case FormatTokenType.parenLArray:
            case FormatTokenType.parenLClosure:
            case FormatTokenType.parenLParen:
                nest++;
                break;
            //hit end so nest back
            case FormatTokenType.parenRMapping:
            case FormatTokenType.parenRArray:
            case FormatTokenType.parenRClosure:
            case FormatTokenType.parenRParen:
                nest--;
                break;
            case FormatTokenType.newline:
                continue;
            case FormatTokenType.whitespace:
                //skip whitespace as it is not important and likely to be trimmed anyways or reformated    
                if (nest === 0)
                    continue;
                //if in a nest leave it as it could improve readable
                break;
            case FormatTokenType.comma:
                //comma so split out the value
                if (nest === 0) {
                    values.push(buff.join(''));
                    buff = [];
                    continue;
                }
                break;
        }
        buff.push(tokens[t].value);
    }
    if (buff.length)
        values.push(buff.join(''));
    return values;
}

export function parseArray(str) {
    if (!str || str.length === 0)
        return [];
    if (!str.startsWith('({'))
        return [];
    if (!str.endsWith('})'))
        return [];
    str = str.slice(2, -2).trim();
    return parseArguments(str);
}

export function formatArray(str, indent?, wrap?) {
    if (!str) return;
    str = str.trim();
    if (!str.startsWith('({') && !str.ends_with('})'))
        return str;
    const arr = parseArray(str);
    indent = ' '.repeat(indent || 0);
    let out = indent + '({';
    if (wrap) out += '\n';
    out += arr.map(value => {
        if (value.startsWith('(:') && value.endsWith(':)'))
            return `${wrap ? indent + ' ' : ''} ${formatFunctionPointer(value).trim()}`;
        if (value.startsWith('({') && value.endsWith('})'))
            return `${wrap ? indent + ' ' : ''} ${formatArray(value, indent.length + 2).trim()}`;
        if (value.startsWith('([') && value.endsWith('])'))
            return `${wrap ? indent + ' ' : ''} ${formatMapping(value, indent.length + 2, true).trim()}`;
        return `${wrap ? indent + ' ' : ''} ${value}`;
    }).join(wrap ? ',\n' : ', ');
    if (wrap) out += '\n' + indent;
    out += '})';
    return out;
}
