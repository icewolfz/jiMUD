/**
 * Base room
 * 
 * Contains all base room systems or features that are common to all rooms
 * 
 * @author {your name}
 * @created {date}
 * @typeof include
 * @doc /doc/build/areas/tutorial
 * @doc /doc/build/room/Basic
 * @doc /doc/build/room/Intermediate
 * @doc /doc/build/room/Advanced 
 {doc} */
#include <std.h>
#include "../area.h"{includes}

inherit {inherit};{inherits}

{create pre}void create()
{
   ::create({create arguments});
   set_short({short});
   set_long({long});
{create body}}{create post}

/**
 * Reset
 * 
 * Reset function triggered every 7 to 15 mins, add monsters or reset data as needed
 */
void reset() 
{
   ::reset();
   //Perform a probably check to allow disabling of default monsters
   if(query_property("no clone monsters"))
      return;
   // If monsters already in room do not create more
   if(sizeof(filter(query_living_contents(), (: $1->is_{area}_monster() :) )))
      return;
{reset body}}
