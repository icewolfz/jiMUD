/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 */
#include <std.h>

inherit OBJ_FISHINGPOLE;

void create()
{
   ::create();
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
   set_pole_class(10); //how good a pole is
   set_can_bait(1); //can this bole be baited
}
