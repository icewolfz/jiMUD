/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/weapon/tutorial
 * @doc /doc/build/weapon/types/material_weapon
 * @doc /doc/build/etc/material
 * @help mattypes
 * @help wtypes
 */
#include <std.h>

inherit OBJ_MATERIAL_WEAPON;

void create()
{
   //Type, Material, Quality, Natural enchantment, Material size
   ::create("", "", "", 0, 1);
   set_nouns("");
   set_adjectives("");
   set_name("");
   set_short("");
   set_long("");
   set_describers(""); // List of describers for use in crafting custom weapons
}