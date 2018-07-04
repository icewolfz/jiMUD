/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/etc/infections
 */
#include <std.h>
#include <germ.h>

inherit STD_GERM;

/**
 * Suffer
 * 
 * Causes suffering
 *
 * @param {object} who the one to cause suffering to
 * @return {int} return 0 for failure, 1 for success
 */
int suffer(object who)
{
   if(!who || !living(who))
      return 0;
   //Do what you want to who
   return 1;
}

void create()
{
   ::create();
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
   set_type(VIRAL); //VIRAL, BACTERIAL, PARASITE, MAGICAL, POISON
   set_suffer("suffer"); //name of function to call for germ effect
}
