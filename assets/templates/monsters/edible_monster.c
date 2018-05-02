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
/*
	see /doc/build/monster/types/mon_edible
*/
#include <std.h>

inherit MON_EDIBLE;

void create()
{
	::create(, "", "");//Level, Race, Class
	set_name("");
	set_short("");
	set_long("");
	set_nouns("");
	set_adjectives("");
	set_height(1); // heigh in inches
}
