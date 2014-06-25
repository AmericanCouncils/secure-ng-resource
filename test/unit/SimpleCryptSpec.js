'use strict';

describe('SimpleCrypt', function () {
    beforeEach(module('secureNgResource'));

    var simpleCrypt;
    beforeEach(inject(function ($rootScope, $injector) {
        simpleCrypt = $injector.get('simpleCrypt');
    }));

    it('can encrypt and decrypt a value', function() {
        var key = simpleCrypt.generateKey();
        var e = simpleCrypt.apply("foobar", key);
        expect(e).not.toEqual("foobar");
        var d = simpleCrypt.apply(e, key);
        expect(d).toEqual("foobar");
    });
});
