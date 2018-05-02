/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/
 */
#include <std.h>

inherit SMOKEBOMB;

function _effect(object room, object thrower) {
	if(!room || !thrower) return 0;
	/* what do to when the bomb is thrown */
	return 1;
}

void create()
{
	::create("_effect");
	set_name("");
	set_short("");
	set_long("");
	set_nouns("");
	set_adjectives("");
}
