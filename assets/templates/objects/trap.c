/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/etc/traps
 */
#include <std.h>

inherit OBJ_TRAP;

void create()
{
   ::create(); /*int difficulty, mixed trigger, mixed disarm, string type, int rearm, mixed args...*/
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
}
