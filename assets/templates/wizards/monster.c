/**
 * {name}
 * 
{description}
 * 
 * @author {your name}
 * @created {date}
 * @typeof object
 * @doc /doc/build/monster/tutorial
{doc} */
#include <std.h>{includes}

inherit {inherit};

{create pre}void create()
{
   ::create({create arguments}); //Level, Race{create arguments comment}
   set_name("{name}");
   set_short({short});
   set_long({long});
   set_height({height}); // height in inches
{create body}}{create post}