/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/etc/material
 * @help mattypes
 */
#include <std.h>

inherit OBJ_MATERIAL;

void create()
{
   //Material, size, quality
   ::create("", 1, "");
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
   set_describers(""); // List of describers for use in crafting custom weapons
}
