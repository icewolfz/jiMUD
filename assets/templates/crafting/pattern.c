/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof pattern
 * @doc /doc/build/crafting/pattern
 */
#include <std.h>
#include <material.h>

inherit STD_PATTERN;

void create()
{
    //pattern type (mostly for display), materials array or define from materail.h, material size
    ::create("blueprint", MAT_ALL, 1);
    //set the name to axe
    set_base_name("");
    //set the default name if no customization is allowed
    set_default_name("");
    //list of descirbers "first", ..., "last"
    set_decribers("");
    //skills required to create this pattern, skill, min amt, max amt
    set_skill_info("crafting", 1, 75);
    set_skill_info("blacksmithing", 1, 75);
    set_skill_info("woodworking", 1, 75);
    set_skill_info("stonemasonry", 1, 75);
    set_skill_info("glasssmithing", 25, 100);  
    //amount of delay when creating this pattern, will be added on to crafting abilities delay
    set_delay(4);
    //the max amt a stat to factor in success systems
    set_statmax(15);
    //set the object to create, full path
    set_object("");
    //set some create arguments as weapon_rand requires a weapon type
    set_create_arguments("");
}