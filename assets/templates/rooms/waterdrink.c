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
 * @doc /doc/build/room/waterdrink
 */
 #include <std.h>

 inherit STD_ROOM;
 inherit STD_WATERDRINK;
 
 void create()
 {
    ::create();
    set_properties( ([
        "indoors" : 0,
        "light" : 3
      ]) );
    set_short("");
    set_long("");
    set_terrain("");
    set_items( ([
 
      ]) );
    set_exits( ([
 
      ]) );    
    set_water_quality(5);
 }

 /**
 Override init to suppose both room and waterdrink inherits
 */
 void init()
 {
    room::init();
    waterdrink::init();
 }