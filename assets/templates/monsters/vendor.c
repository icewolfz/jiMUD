/**
 * Name
 * 
 * Description
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/monster/tutorial
 * @doc /doc/build/monster/types/vendor
 */
#include <std.h>

inherit MONTYPE_VENDOR;

void create()
{
   ::create(1, "", ""); //Level, Race, Class
   set_name("");
   set_short("");
   set_long("");
   set_nouns("");
   set_adjectives("");
   set_height(1); // height in inches

   set_skill("bargaining", 0);
   set_shop_quality(5);
   set_storage_room("path/to/storage.c");
   set_inflation_sell(0.0);
   set_inflation_buy(0.0);
}
