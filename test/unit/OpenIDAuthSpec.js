'use strict';

describe('OpenIDAuth', function () {
    beforeEach(module('secureNgResource'));

    var mockFormSubmitter;
    beforeEach(function () {
        module(function($provide) {
            mockFormSubmitter = jasmine.createSpyObj('ShimFormSubmitter', ['submit']);
            $provide.value('shimFormSubmitter', mockFormSubmitter);
        });
    });

    var $scope, $httpBackend, simpleCrypt, auth;
    beforeEach(inject(function ($rootScope, $injector, openIDAuth) {
        $scope = $rootScope.$new();
        simpleCrypt = $injector.get('simpleCrypt');
        $httpBackend = $injector.get('$httpBackend');
        auth = openIDAuth('https://example.com/openid_begin', {
         refreshUrl: 'https://example.com/openid_refresh'
        });
    }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it('returns the correct auth type', function () {
        expect(auth.getAuthType()).toEqual('OpenIDAuth');
    });

    describe('Phase One', function () {
        it('begins OpenID requests correctly', function () {
            var handler = jasmine.createSpy('handler');
            mockFormSubmitter.submit.andCallFake(function(url, fields) {
                expect(url).toEqual('https://example.com/openid_begin');
                expect(fields.openid_identifier).toEqual('foo');
                expect(fields.key).toEqual(jasmine.any(String)); // TODO: More specific test
                expect(fields.target_url).toEqual(jasmine.any(String)); // TODO: More specific test
            });
            auth.checkLogin({openid_identifier: 'foo'}).then(handler, handler);
            $scope.$apply();
            expect(mockFormSubmitter.submit).toHaveBeenCalled();
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('Phase Two', function () {
        function phaseTwoResponse(obj) {
            // Pretend that we have gone through phase one already
            var key = '';
            mockFormSubmitter.submit.andCallFake(function(url, fields) {
                key = fields.key;
            });
            auth.checkLogin({openid_identifier: 'foo'});
            $scope.$apply();
            expect(key).not.toEqual('');
            if (obj.sessionId) {
                obj.sessionId = base64.encode(simpleCrypt.apply(obj.sessionId, key));
            }
            return auth.checkLogin({auth_resp: base64.encode(JSON.stringify(obj))});
        }

        it('resolves promise correctly on approved logins', function () {
            var handler = jasmine.createSpy('handler');
            phaseTwoResponse({
                approved: true,
                sessionId: 'letmein'
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
                sessionId: 'xyz'
            }).then(handler);
            $scope.$apply();

            var httpConf = {headers: {}};
            auth.addAuthToRequestConf(httpConf, state);
            expect(httpConf.headers.Authorization).toEqual('SesID xyz');
        });

        it('calls refresh url', function () {
            var state = {};
            var handler = function(result) {
                state = result.newState;
            };
            phaseTwoResponse({
                approved: true,
                sessionId: 'xyz'
            }).then(handler);
            $scope.$apply();

            $httpBackend.when(
                'POST', 'https://example.com/openid_refresh', '',
                function(headers) { return headers.Authorization == "SesID xyz"; }
            ).respond(200, {pong: "ok"});
            auth.refreshLogin(state);
            $httpBackend.flush();
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
