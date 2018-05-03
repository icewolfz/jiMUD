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
 * @doc /doc/build/room/types/bank
 */
#include <std.h>

inherit ROOMTYPE_BANK;

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
	set_bank_id(""); //bank id, must be valid defined banked ask an immortal with correct access if you need to create a new bank
}