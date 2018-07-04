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
 * @doc /doc/build/room/types/locker
 */
#include <std.h>

inherit ROOMTYPE_LOCKER;

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
   set_locker_location(""); //a uniquid location key to id your locker room or reuse one to allow multiple access points
   set_locker_price(50000); // base locker price
   //Size name, max weight it can old, max # of items, price adjustment, formula is base * price = final
   //add_locker("small", 22200, 15, 1.0);//add a new locker size
}