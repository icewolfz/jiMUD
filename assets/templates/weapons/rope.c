/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/weapon/tutorial
 * @doc /doc/build/weapon/types/rope
 */
#include <std.h>

inherit OBJ_ROPE;

void create()
{
   //Name, Material, Quality, Natural enchantment
   ::create("", "", "", 0);
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
}