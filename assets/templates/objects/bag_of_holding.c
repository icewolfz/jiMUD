/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @help mattypes
 */
#include <std.h>

inherit OBJ_BAGOFHOLDING;

void create()
{
   //Max amount of weight it can hold, max items, min encumbrance
   ::create(40000, 0, 500);
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
   set_material("");
}