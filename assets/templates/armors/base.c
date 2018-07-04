/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/armours/tutorial
 * @help mattypes
 * @help atypes
 */
#include <std.h>

inherit OBJ_ARMOUR;

void create()
{
	//Type, Material, Quality, Limbs, Natural enchantment
   ::create("", "", "", ({ "" }),  0);
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
}