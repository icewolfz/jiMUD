/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/monster/tutorial
 * @doc /doc/build/monster/types/healer
 */
#include <std.h>

inherit MONTYPE_HEALER;

void create()
{
   ::create(80, "", ""); //Level, Race, Class
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
   set_height(1); // height in inches

   //service:price
   set_services( ([
       "heal" : 0,
       "cure" : 0,
       "slowbleed" : 0,
       "regenerate" : 0,
       "mend" : 0,
       "cureplague" : 0,
       "boost" : 0,
       "invigorate" : 0,
       "removecurse" : 0,
       "purify" : 0,
       "removeblind" : 0,
       "diagnosis" : 0,
       "deodor" : 0,
       "tourniquet" : 0,
       "salve" : 0
     ]) );
}
