/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/weapon/tutorial
 * @doc /doc/build/weapon/types/craftingtool_weapon
 * @doc /doc/build/crafting/craftingtool
 * @help atypes
 * @help mattypes
 */
#include <std.h>

inherit OBJ_CRAFTINGTOOL_WEAPON;

void create()
{
   //Type, Material, Quality, Natural enchantment, Craft skills...
   ::create("", "", "", 0, "");
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
}