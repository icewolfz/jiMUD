// tslint:disable-next-line:only-arrow-functions
(function ($) {
    $.fn.hasHorizontalScrollBar = function () {
        // tslint:disable-next-line:no-invalid-this
        return $(this)[0].scrollWidth > $(this).innerWidth();
    };

    $.fn.innerText = function (msg) {
        let txt = '';
        // tslint:disable-next-line:no-invalid-this
        const il = this.length;
        for (let i = 0; i < il; i++) {
            // tslint:disable-next-line:no-invalid-this
            txt += this[i].innerText || this[i].textContent || '';
        }
        return txt;
    };

    $.fn.textContents = function (msg) {
        let txt = '';
        // tslint:disable-next-line:no-invalid-this
        const il = this.length;
        for (let i = 0; i < il; i++) {
            // tslint:disable-next-line:no-invalid-this
            txt += this[i].textContent || '';
        }
        return txt;
    };
})(jQuery);