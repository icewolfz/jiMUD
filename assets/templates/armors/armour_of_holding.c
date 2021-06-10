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
   ::create("", "", "", ({ "" }),  0);
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
   set_material("");
   //Max amount of weight it can hold
   set_max_encumbrance(40000);
}