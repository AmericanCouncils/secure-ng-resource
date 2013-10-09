'use strict';

describe('PasswordOAuth', function () {
    beforeEach(module('secureNgResource'));

    var $httpBackend, auth;
    beforeEach(inject(function ($rootScope, $injector, passwordOAuth) {
        $httpBackend = $injector.get('$httpBackend');
        auth = passwordOAuth('https://example.com', 'my_id', 'my_secret');
    }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it('returns the correct auth type', function () {
        expect(auth.getAuthType()).toEqual("PasswordOAuth");
    });

    it('makes valid token requests and resolves promise on valid response', function () {
        $httpBackend.expectPOST(
            'https://example.com/oauth/v2/token',
            'client_id=my_id&client_secret=my_secret&' +
            'grant_type=password&username=alice&password=swordfish',
            {
                Accept: 'application/json, text/plain, */*',
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        ).respond({
            access_token: 'abc',
            refresh_token: 'xyz',
            expires_in: 3600
        });

        var now = new Date().getTime();
        var result = null;
        auth.checkLogin({user: 'alice', pass: 'swordfish'})
            .then(function(r) { result = r; });
        $httpBackend.flush();
        expect(result.status).toEqual('accepted');
        expect(result.newState.accessToken).toEqual('abc');
        expect(result.newState.accessTokenExpires).toBeGreaterThan(now + 3000);
        expect(result.newState.accessTokenExpires).toBeLessThan(now + 4000);
        expect(result.newState.refreshToken).toEqual('xyz');
    });

    it('rejects promise correctly on denied requests', function () {
        var handler = jasmine.createSpy('handler');
        $httpBackend.when('POST', 'https://example.com/oauth/v2/token').
            respond(400, {error: 'invalid_grant'});
        auth.checkLogin({user: 'alice', pass: 'swordfish'}).then(null, handler);
        $httpBackend.flush();
        expect(handler.mostRecentCall.args[0].status).toEqual('denied');
        expect(handler.mostRecentCall.args[0].msg).toMatch(/password/i);
    });

    it('rejects promise correctly on HTTP failure', function () {
        var handler = jasmine.createSpy('handler');
        $httpBackend.when('POST', 'https://example.com/oauth/v2/token').
            respond(500, "Internal Server Error, Oh Noes");
        auth.checkLogin({user: 'alice', pass: 'swordfish'}).then(null, handler);
        $httpBackend.flush();
        expect(handler.mostRecentCall.args[0].status).toEqual('error');
        expect(handler.mostRecentCall.args[0].msg).toMatch(/500/);
    });

    it('rejects promise correctly on OAuth failure', function () {
        var handler = jasmine.createSpy('handler');
        $httpBackend.when('POST', 'https://example.com/oauth/v2/token').
            respond(500, {error_description: "War Were Declared"});
        auth.checkLogin({user: 'alice', pass: 'swordfish'}).then(null, handler);
        $httpBackend.flush();
        expect(handler.mostRecentCall.args[0].status).toEqual('error');
        expect(handler.mostRecentCall.args[0].msg).toMatch(/Were/);
    });

    it('can use the refresh_token to get a new access token', function () {
        $httpBackend.expectPOST(
            'https://example.com/oauth/v2/token',
            'client_id=my_id&client_secret=my_secret&' +
            'grant_type=refresh_token&refresh_token=xyz',
            {
                Accept: 'application/json, text/plain, */*',
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        ).respond({
            access_token: 'abc2',
            refresh_token: 'xyz2',
            expires_in: 3600
        });

        var result = {};
        auth.refreshLogin({accessToken: 'abc', refreshToken: 'xyz'})
            .then(function(r) { result = r; });
        $httpBackend.flush();
        expect(result.status).toEqual("accepted");
        expect(result.newState.accessToken).toEqual('abc2');
        expect(result.newState.refreshToken).toEqual('xyz2');
    });

    it('continues to use old refresh_token if new one not given on refresh', function () {
        $httpBackend.expectPOST(
            'https://example.com/oauth/v2/token',
            'client_id=my_id&client_secret=my_secret&' +
            'grant_type=refresh_token&refresh_token=xyz',
            {
                Accept: 'application/json, text/plain, */*',
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        ).respond({
            access_token: 'abc2',
            expires_in: 3600
        });

        var result = {};
        auth.refreshLogin({ accessToken: 'abc', refreshToken: 'xyz' })
            .then(function(r) { result = r; });
        $httpBackend.flush();
        expect(result.status).toEqual("accepted");
        expect(result.newState.accessToken).toEqual('abc2');
        expect(result.newState.refreshToken).toEqual('xyz');
    });

    it('adds Authorization header with token to res requests', function () {
        var state = {};
        var handler = function(result) {
            state = result.newState;
        };
        $httpBackend.when('POST', 'https://example.com/oauth/v2/token'
        ).respond({
            access_token: 'abc',
            refresh_token: 'xyz',
            expires_in: 3600
        });
        auth.checkLogin({user: 'alice', pass: 'swordfish'}).then(handler);
        $httpBackend.flush();

        var httpConf = {headers: {}};
        auth.addAuthToRequestConf(httpConf, state);
        expect(httpConf.headers.Authorization).toEqual("Bearer abc");
    });

    it('only treats res HTTP responses with 401 status as auth fails', function () {
        expect(auth.checkResponse({status: 200}).authFailure).toBeFalsy();
        expect(auth.checkResponse({status: 400}).authFailure).toBeFalsy();
        expect(auth.checkResponse({status: 401}).authFailure).toBeTruthy();
        expect(auth.checkResponse({status: 403}).authFailure).toBeFalsy();
        expect(auth.checkResponse({status: 405}).authFailure).toBeFalsy();
        expect(auth.checkResponse({status: 500}).authFailure).toBeFalsy();
    });
});
