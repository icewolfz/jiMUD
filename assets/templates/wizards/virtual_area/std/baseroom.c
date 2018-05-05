/* *
 * Base room
 * 
 * Contains all base room systems or features that are common to all rooms
 * 
 * @author {your name}
 * @created {date}
 * @typeof include
 * @doc /doc/build/virtual/generic_virtual
 * @doc /doc/build/room/Basic
 */
#include <std.h>
#include "../area.h"
 
inherit STD_ROOM;
 
/**
 * Create
 *
 * Create function first called when creating a new room to allow setting up the room
 */
void create()
{
   ::create();
   set_properties( ([ 
     "indoors":0,
     "light":3
    ]) );
}

/**
 * Reset
 * 
 * Reset function triggered every 7 to 15 mins, add monsters or reset data as needed
 */
void reset() {
   ::reset();
   //virtual area so check exits, use the exit id as exits may not be created on first reset
   //Perform a probably check to allow disabling of default monsters
   if (query_property("no clone monsters") || !query_property("exit id"))
      return;
   // If monsters already in room do not create more
   if(sizeof(filter(query_living_contents(), (:$1->is_{area}_monster():))))
      return;
}
