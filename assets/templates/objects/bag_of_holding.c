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
   ::create();
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
   set_material("");
   //Max amount of weight it can hold
   set_max_encumbrance(40000);
}