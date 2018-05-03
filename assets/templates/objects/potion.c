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

inherit OBJ_POTION;

void create()
{
	::create();
	set_name("");
	set_short("");
	set_long("");
	set_nouns("");
	set_adjectives("");
	set_effect("do_effect"); /*string | function*/
	//set_shatter("do_shatter");  //called when potion is shattered on if missed when thrown
	//set_smash("do_smash"); //executed when smashed on ground by holder
	//set_throw("do_throw"); //executed when potion is thrown and hits someone
}

void do_effect(object potion, object drinker)
{
	if(!drinker) return;
	/* effects here */
}

void do_throw(object potion, object thrower, object target)
{
	if(!target) return;
	/* effects here */
}

void do_shatter(object potion, object thrower, object target)
{
	if(!target) return;
	/* effects here */
}


void do_smash(object potion, object thrower)
{
	if(!drinker) return;
	/* effects here */
}
