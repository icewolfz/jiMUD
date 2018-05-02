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
	Weapon repair monster
		see /doc/build/monster/types/smith
		see /doc/build/monster/types/vendor
		
*/
#include <std.h>

inherit WEAPON_REPAIR;

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
