/**
 * Base virtual room
 * 
 * Contains the base systems for creating a base room, note it inherits the area base room
 * 
 * @author {your name}
 * @created {date}
 * @typeof include
 * @doc /doc/build/virtual/generic_virtual
 * @doc /doc/build/room/Basic
 */
#include <std.h>
#include "../area.h"

inherit BASEROOM;
 
/**
 * Create
 *
 * Create function first called when creating a new room to allow setting up the room
 */
varargs void create(int x, int y, int z, int terrainIdx, int itemIdx, int exits)
{
   //save ids in case needed, this allows you to create dynamic coded based on the ids
   set_property("terrain id", t); 
   set_property("item id", i);
   set_property("exit id", e);    
   ::create();
}
         
/**
 * Compile_done
 * 
 * Called when room has been completed and loaded
 */
void compile_done()
{
             
}

/**
 * Reset
 * 
 * Reset function triggered every 7 to 15 mins, add monsters or reset data as needed
 */
void reset()
{
   ::reset();
   //virtual area so check exits, use the exit id as exits may not be created on first reset
   //Perform a probably check to allow disabling of default monsters
   if (query_property("no clone monsters") || !query_property("exit id"))
      return;
   // If monsters already in room do not create more
   if(sizeof(filter(query_living_contents(), (:$1->is_{area}_monster():))))
      return;
}
