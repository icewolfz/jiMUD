/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/
 */
#include <std.h>
#include <limbs.h>

inherit SHEATH; 

void create() 
{
   //material, quality, limbs
  ::create("", "", TORSO); 
  /*
  //type, material, quality, limbs
  create_armour("", "", "", TORSO);
  */
  
  set_name(""); 
  set_short("");
  set_long("");
  set_nouns("sheath");
  set_adjectives("");
  set_weapon_type("");
}
