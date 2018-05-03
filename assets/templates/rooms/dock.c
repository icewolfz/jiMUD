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
 * @doc /doc/build/room/types/pier
 * @doc /doc/build/room/types/dock
 */
#include <std.h>

inherit ROOMTYPE_DOCK;

void create()
{
	::create();
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
}

/**
 * query_ocean_coords
 * 
 * Return the raw ocean coordinates, this is hard coded
 *
 * @return {int*} returns ({x,y}) raw ocean coordinates
 */
int *query_ocean_coords() { return ({40,17}); }