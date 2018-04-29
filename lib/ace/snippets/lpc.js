ace.define('ace/snippets/lpc', ['require', 'exports', 'module' ], function(require, exports, module) {
//"allocate|filter_array|map_array|member_array|sort_array|unique_array|allocate_buffer|crc32|read_buffer|write_buffer|call_other|call_out|catch|origin|previous_object|query_shadowing|remove_call_out|shadow|this_object|throw|generate_source|ed_cmd|ed_start|query_ed_mode|cp|file_size|get_dir|link|mkdir|read_bytes|read_file|rename|rm|rmdir|stat|tail|write_bytes|write_file|acos|asin|atan|ceil|cos|exp|floor|log|pow|sin|sqrt|tan|to_int|apply|bind|evaluate|map|restore_variable|save_variable|sizeof|typeof|	|add_action|command|commands|disable_commands|disable_wizard|ed|enable_commands|exec|find_player|get_char|in_edit|in_input|input_to|interactive|message|notify_fail|printf|query_host_name|query_idle|query_ip_name|query_ip_number|query_snoop|query_snooping|receive|remove_action|resolve|say|set_this_player|shout|snoop|this_interactive|this_player|userp|users|write|cache_stats|debug_info|debugmalloc|dump_file_descriptors|dump_prog|dump_socket_status|dumpallobj|get_config|malloc_status|memory_info|moncontrol|mud_status|opcprof|query_load_average|refs|rusage|set_debug_level|set_malloc_mask|swap|time_expression|trace|traceprefix|		|allocate_mapping|each|filter_mapping|keys|map_delete|map_mapping|match_path|unique_mapping|values|author_stats|domain_stats|enable_wizard|export_uid|find_living|geteuid|getuid|living|livings|query_privs|set_author|set_light|set_living_name|set_privs|seteuid|wizardp|random|to_float|all_inventory|children|clone_object|clonep|deep_inventory|destruct|environment|file_name|find_object|first_inventory|load_object|master|move_object|new|next_inventory|objects|present|query_heart_beat|reload_object|restore_object|save_object|set_heart_beat|set_hide|tell_object|tell_room|virtualp|parse_command|process_string|process_value|query_verb|socket_accept|socket_acquire|socket_address|socket_bind|socket_close|socket_connect|socket_create|socket_error|socket_listen|socket_release|socket_write|break_string|capitalize|clear_bit|crypt|explode|implode|lower_case|reg_assoc|regexp|replace_string|set_bit|sprintf|sscanf|strcmp|stringp|strlen|strsrch|test_bit|all_previous_objects|call_out_info|ctime|deep_inherit_list|error|eval_cost|find_call_out|function_exists|function_profile|inherit_list|inherits|localtime|max_eval_cost|reclaim_objects|replace_program|reset_eval_cost|set_eval_limit|set_reset|shutdown|time|uptime"
exports.snippetText = "## eFuns\n\
#  member_array\n\
snippet memarr\n\
	member_array(${1}, ${2});\n\
#  member_array2\n\
snippet memarr2\n\
	member_array(${1}, ${2}, ${3});\n\
## \n\
## Access Modifiers\n\
# private\n\
snippet pri\n\
	private\n\
# public\n\
snippet pub\n\
	public\n\
## \n\ ";
exports.scope = "lpc";

});
 