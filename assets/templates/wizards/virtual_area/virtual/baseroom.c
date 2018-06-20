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
varargs void create(int x, int y, int z, int terrainIdx, int itemIdx, int exits) {
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
void compile_done(){
             
}