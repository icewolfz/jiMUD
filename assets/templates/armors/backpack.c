/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/armours/tutorial
 * @doc /doc/build/armours/type/backpack
 * @help mattypes
 */
#include <std.h>

inherit OBJ_BACKPACK;

void create()
{
   //Material, Quality, charm
   ::create("", "");
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
   //Max amount of weight it can hold
   set_max_encumbrance(4000);
   //the amount of weight to factor for an item
   set_reduce_item_mass(0.75);
   //the type of backpack this is used to determine how many can be worn
   set_backpack_type("pack");
}