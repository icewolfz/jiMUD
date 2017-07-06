(function ($) {
	$.fn.hasHorizontalScrollBar = function () {
		return $(this)[0].scrollWidth > $(this).innerWidth();
	};
	/*
		$.fn.innerText = function (msg) {
			if (msg) {
				if (document.body.innerText) {
					for (let i in this) {
						this[i].innerText = msg;
					}
				} else {
					for (let i in this) {
						this[i].innerHTML.replace(/&lt;br&gt;/gi, "n").replace(/(&lt;([^&gt;]+)&gt;)/gi, "");
					}
				}
				return this;
			} else {
				if (document.body.innerText) {
					return this[0].innerText;
				} else {
					return this[0].innerHTML.replace(/&lt;br&gt;/gi, "n").replace(/(&lt;([^&gt;]+)&gt;)/gi, "");
				}
			}
		};
	*/

	$.fn.innerText = function (msg) {
		let txt = "";
		for(let i = 0, il = this.length;i < il; i++) {
			txt += this[i].innerText || this[i].textContent || "";
		}
		return txt;
	}

	$.fn.textContents = function (msg) {
		let txt = "";
		for (let i in this) {
			txt += this[i].textContent || "";
		}
		return txt;
	}
})(jQuery);