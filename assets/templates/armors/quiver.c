/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/armours/tutorial
 * @doc /doc/build/armours/types/quiver
 */
#include <std.h>

inherit OBJ_QUIVER;

void create()
{
//int arrows, string materal, string quality, mixed limbs, int charm, string type, string arrow material, string arrow quality, int arrow charm
   ::create(0, "", "", ({ "" }) );
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
}