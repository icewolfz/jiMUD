/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/crafting/craftingtool
 * @help mattypes
 */
#include <std.h>

inherit OBJ_CRAFTINGTOOL_WEAPON;

void create()
{
   //Craft skills...
   ::create("");
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
   set_material("");
   //How good a tool it is
   set_crafting_quality(0);
}