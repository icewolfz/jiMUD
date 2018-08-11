/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/monster/tutorial
 * @doc /doc/build/monster/types/crafter
 */
#include <std.h>

inherit MONTYPE_CRAFTER;

void create()
{
   ::create(1, "", ""); //Level, Race, Class
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
   set_height(1); // height in inches

   set_pattern_type("blueprint");
   set_craft_type(""); //craft type, normally the crafting skill
}
