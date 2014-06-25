'use strict';

angular.module('secureNgResource')
.value('simpleCrypt', {
    generateKey: function() {
        var key = '';
        while (key.length < 64) {
            key += String.fromCharCode(Math.floor(Math.random() * 255));
        }
        return base64.encode(key);
    },

    apply: function(value, key) {
        key = base64.decode(key);
        var out = '';
        for (var i = 0; i < value.length; ++i) {
            if (i < key.length) {
                var chr = value.charCodeAt(i) ^ key.charCodeAt(i); // jshint ignore:line
                out += String.fromCharCode(chr);
            } else {
                out += value.charAt(i);
            }
        }
        return out;
    }
});
