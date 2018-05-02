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
	see /doc/build/monster/types/barkeep
*/
#include <std.h>

inherit BARKEEP;

void create()
{
	::create(, "", "");//Level, Race, Class
	set_name("");
	set_short("");
	set_long("");
	set_nouns("");
	set_adjectives("");
	set_height(1); // heigh in inches
	
  create_menu(([
  "short" :
  ([
    "name":"", //the name of the item
    "strength":0, //how strong the item will be
    "type":"alcoholic", //type of item: caffeine, alcoholic, drink, food
    "long":"", //item long descrpition
    "nouns":({""}), //nouns for item, if none remove
    "adjectives":({""}), //adjectives, if none remove
    "category":"", //item caterogry, this determins who they will be grouped on the menu, food or drink
    "my_mess":"", //the message displayed to drinker, if you want default remove it
    "your_mess":"" //the message displayed to room, if you want default remove it
   ]),
  ]));
}
