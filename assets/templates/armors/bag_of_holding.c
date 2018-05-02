/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/armors/types/bagofholding
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
   //Max amount of weight it can hold
   set_max_encumbrance(40000);   
}