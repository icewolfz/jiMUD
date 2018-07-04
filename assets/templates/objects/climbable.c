/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/etc/climbing
 */
#include <std.h>

inherit STD_OBJECT;
inherit STD_CLIMBING;

void create()
{
   ::create();
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
   add_climb("", ([
       "dest" : "", //Path to destination room
       "fall" : "" //Path to room to land in when fall
     ]) );
   set_damage(5); // How much it hurts to fall
}
