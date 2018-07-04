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
 * @doc /doc/build/room/types/climb
 * @doc /doc/build/etc/climbing
 */
#include <std.h>

inherit ROOMTYPE_CLIMB;

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
   //direction, destination path
   add_climb("", "");
}