/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/monster/tutorial
 * @doc /doc/build/monster/types/shipwright
 * @doc /doc/build/monster/haggle
 */
#include <std.h>

inherit MONTYPE_SHIPWRIGHT;

void create()
{
   ::create(1, "", ""); //Level, Race, Class
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
   set_height(1); // height in inches
}
