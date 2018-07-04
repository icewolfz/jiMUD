/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/room/Basic
 * @doc /doc/build/room/Intermediate
 * @doc /doc/build/room/Advanced
 * @doc /doc/build/room/types/vault
 * @doc /doc/build/room/types/guild_hall
 * @doc /doc/build/etc/voter
 */
#include <std.h>

inherit ROOMTYPE_GUILD_HALL;

void create()
{
   ::create();
   set_properties( ([
       "indoors" : 0,
       "light" : 3
     ]) );
   set_short("");
   set_long("");
   set_terrain("");
   set_items( ([

     ]) );
   set_exits( ([

     ]) );
   set_guild(""); //guild name, if not set will default based on path name
}