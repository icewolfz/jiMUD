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

inherit DRINK;

void create()
{
	::create();
	set_name("");
	set_short("");
	set_long("");
	set_nouns("");
	set_adjectives("");
	set_strength(5)//how strong the food is
	set_eat("This taste like chicken", "$N eats $O."); //message eater sees, message room sees
}
