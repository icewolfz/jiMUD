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

inherit OBJECT;
inherit FISHINGBAIT;

void create()
{
	::create();
	set_name("");
	set_short("");
	set_long("");
	set_nouns("");
	set_adjectives("");
  set_bait_strength(4);//how strong bait is
  set_uses(5);	//how many times you can use it
}
