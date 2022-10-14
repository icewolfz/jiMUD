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

inherit OBJ_ARMOUR_OF_HOLDING;

void create()
{
   //Type, Material, Quality, Limbs, Natural enchantment, Max amount of weight it can hold, max items, min encumbrance
   ::create("", "", "", ({ "" }),  0, 40000, 0, 500);
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
   set_material("");
}