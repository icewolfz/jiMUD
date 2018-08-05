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
{doc} */
#include <std.h>
#include "../area.h"{includes}

inherit {inherit};{inherits}

//allow for easy filtering
int is_{area}_monster()
{
   return 1;
}

{create pre}varargs void create(int lvl, string race, string cls, string btype, int autospells, mapping args)
{
   {create pre inherit}//pass arguments to base monster
   ::create({create arguments});
   add_search_path(CMDS); //add CMDS as a command path for any custom commands             
{create body}}{create post}