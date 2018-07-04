/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/armours/tutorial
 * @doc /doc/build/armours/types/sheath
 * @help mattypes
 * @help atypes
 */
#include <std.h>
#include <limbs.h>

inherit OBJ_SHEATH;

void create()
{
   //Material, Quality, Limbs, Natural enchantment
   ::create("", "", ({ "" }), 0);
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
   set_weapon_type("");
}