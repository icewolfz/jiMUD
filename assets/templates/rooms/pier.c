/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/room/Basic
 * @doc /doc/build/room/Intermediate
 * @doc /doc/build/room/Advanced
 * @doc /doc/build/room/types/vault
 * @doc /doc/build/room/types/pier
 * @doc /doc/build/room/fishing
 */
#include <std.h>

inherit ROOMTYPE_PIER;

void create()
{
	//source of fish
	::create("water");
	set_properties( ([ 
		"indoors":0,
		"light":3
	]) );
	set_short("");
	set_long("");
	set_terrain("");
	set_items( ([ 

	]) );
	set_exits( ([

	]) );
	//name, how strong fish is
	add_fish("", 5); //add a fish, repeat for how ever many fish
	//OR a mapping of ([ "name":strength, ...]) or ({"name", ...}) for default strength
	set_fish() // set all fish
}