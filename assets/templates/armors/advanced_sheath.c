/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/armors/types/sheath
 */
#include <std.h>

inherit OBJ_SHEATH;

void create()
{
   ::create();
   //Type, Material, Quality, Limbs, Natural enchantment
   ::create_armor("", "", "", ({ "" }), 0);
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
}