/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/room/basic
 */
#include <std.h>

inherit STD_ROOM;

void create()
{
	::create();
	set_properties( ([ 
		"indoors":0,
		"light":3
	]) );
	set_short("");
	set_long("");
	set_items( ([ 

	]) );
	set_exits( ([

	]) );
}