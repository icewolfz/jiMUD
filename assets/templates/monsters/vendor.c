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
	see /doc/build/monster/types/vendor
*/
#include <std.h>

inherit VENDOR;

void create()
{
	::create(, "", "");//Level, Race, Class
	set_name("");
	set_short("");
	set_long("");
	set_nouns("");
	set_adjectives("");
	set_height(1); // heigh in inches
	
	set_skill("bargaining", 0);
	set_shop_quality(5);
	set_storage_room("path/to/storage.c");
	set_inflation_sell(0.0);
	set_inflation_buy(0.0);	
}
