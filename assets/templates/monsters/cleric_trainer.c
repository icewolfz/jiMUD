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
	see /doc/build/monster/types/cleric_trainer
*/
#include <std.h>

inherit CLERIC_TRAINER;

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
