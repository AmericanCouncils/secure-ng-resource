'use strict';

describe('OpenIDAuth', function () {
    beforeEach(module('secureNgResource'));

    var mockDoc;
    beforeEach(function () {
        module(function($provide) {
            mockDoc = { location: { href: "foo" } };
            $provide.value('$document', mockDoc);
        });
    });

    var $scope, $httpBackend, simpleCrypt, auth;
    beforeEach(inject(function ($rootScope, $injector, openIDAuth) {
        $scope = $rootScope.$new();
        $httpBackend = $injector.get('$httpBackend');
        simpleCrypt = $injector.get('simpleCrypt');
        auth = openIDAuth('https://example.com/openid_begin');
    }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it('returns the correct auth type', function () {
        expect(auth.getAuthType()).toEqual('OpenIDAuth');
    });

    describe('Phase One', function () {
        it('begins OpenID requests with a redirect, not resolving promise', function () {
            var handler = jasmine.createSpy('handler');
            auth.checkLogin({openid_identifier: 'foo'}).then(handler, handler);
            $httpBackend.expectPOST('https://example.com/openid_begin')
                .respond({ redirect_url: 'https://identity.org/login' });
            $httpBackend.flush();
            expect(mockDoc.location.href).toEqual('https://identity.org/login');
            expect(handler).not.toHaveBeenCalled();
        });

        it('rejects requests correctly on lack of redirect url', function () {
            var handler = jasmine.createSpy('handler');
            auth.checkLogin({openid_identifier: 'foo'}).then(null, handler);
            $httpBackend.expectPOST('https://example.com/openid_begin')
                .respond({ message: 'Go away' });
            $httpBackend.flush();
            expect(handler).toHaveBeenCalledWith({
                status: 'error',
                msg: 'Go away'
            });
        });
    });

    describe('Phase Two', function () {
        var phaseOneKey;
        beforeEach(function() {
            phaseOneKey = '';
            auth.checkLogin({openid_identifier: 'foo'});
            $httpBackend.expectPOST('https://example.com/openid_begin', function(data) {
                data = JSON.parse(data);
                if (data.key) {
                    phaseOneKey = data.key;
                    return true;
                }
                return false;
            }).respond({ redirect_url: 'foo' });
            $httpBackend.flush();
            expect(phaseOneKey).not.toEqual('');
        });

        function phaseTwoResponse(obj) {
            return auth.checkLogin({oid_resp: btoa(JSON.stringify(obj))});
        }

        it('resolves promise correctly on approved logins', function () {
            var handler = jasmine.createSpy('handler');
            phaseTwoResponse({
                approved: true,
                sessionId: simpleCrypt.apply('letmein', phaseOneKey)
            }).then(handler);
            $scope.$apply();
            expect(handler).toHaveBeenCalledWith({
                status: 'accepted',
                newState: { sessionId: 'letmein' }
            });
        });

        it('rejects promise correctly on denied logins', function () {
            var handler = jasmine.createSpy('handler');
            phaseTwoResponse({
                approved: false,
                message: "foobar"
            }).then(null, handler);
            $scope.$apply();
            expect(handler).toHaveBeenCalledWith({
                status: 'denied',
                msg: 'foobar'
            });
        });

        it('rejects promise with default message on denied logins', function () {
            var handler = jasmine.createSpy('handler');
            phaseTwoResponse({
                approved: false
            }).then(null, handler);
            $scope.$apply();
            expect(handler).toHaveBeenCalledWith({
                status: 'denied',
                msg: 'Access Denied'
            });
        });

        it('adds auth header to res requests', function () {
            var state = {};
            var handler = function(result) {
                state = result.newState;
            };
            phaseTwoResponse({
                approved: true,
                sessionId: simpleCrypt.apply('xyz', phaseOneKey)
            }).then(handler);
            $scope.$apply();

            var httpConf = {headers: {}};
            auth.addAuthToRequestConf(httpConf, state);
            expect(httpConf.headers.Authorization).toEqual('SesID xyz');
        });
    });

    it('only treats res 401 HTTP responses as auth fails', function () {
        expect(auth.checkResponse({status: 200}).authFailure).toBeFalsy();
        expect(auth.checkResponse({status: 400}).authFailure).toBeFalsy();
        expect(auth.checkResponse({status: 401}).authFailure).toBeTruthy();
        expect(auth.checkResponse({status: 402}).authFailure).toBeFalsy();
        expect(auth.checkResponse({status: 403}).authFailure).toBeFalsy();
        expect(auth.checkResponse({status: 404}).authFailure).toBeFalsy();
        expect(auth.checkResponse({status: 500}).authFailure).toBeFalsy();
    });
});
