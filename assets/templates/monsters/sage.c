/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/monster/tutorial
 * @doc /doc/build/monster/types/sage
 * @doc /doc/build/etc/sagebase
 */
#include <std.h>

inherit MONTYPE_SAGE_NPC;

void create()
{
   ::create(1, "", ""); //Level, Race, Class
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
   set_height(1); // height in inches
   set_languages(); //array or string list	
}
