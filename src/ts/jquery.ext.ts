(function ($) {
	$.fn.hasHorizontalScrollBar = function () {
		return $(this)[0].scrollWidth > $(this).innerWidth();
	};
})(jQuery);