/**
 * Base monster
 * 
 * Contains all base monster settings and requirements
 * 
 * @author {your name}
 * @created {date}
 * @typeof monster
 * @doc /doc/build/areas/tutorial
 * @doc /doc/build/monster/tutorial
 */
#include <std.h>
#include "../area.h"

inherit STD_MONSTER;

//allow for easy filtering
int is_{area}_monster()
{
   return 1;
}

//reproduce core arguments from monster
varargs void create(int lvl, string race, string cls, string btype, int autospells, mapping args)
{
   //pass arguments to base monster
   ::create(lvl, race, cls, btype, autospells, args);
   add_search_path(CMDS); //add CMDS as a command path for any custom commands             
}