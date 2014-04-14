'use strict';

describe('OpenIDAuth', function () {
    beforeEach(module('secureNgResource'));

    var $scope, $httpBackend, auth, fakeInputElement, fakeFormElement, fakeDocument;
    beforeEach(inject(function ($rootScope, $injector, mockAuth) {
        $scope = $rootScope.$new();
        $httpBackend = $injector.get('$httpBackend');
        auth = mockAuth();
    }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it('returns the correct auth type', function () {
        expect(auth.getAuthType()).toEqual('MockAuth');
    });

    it('returns an accepted state with given user on attempted OAuth-like login', function () {
        var result = null;
        auth.checkLogin({user: 'foo', pass: 'bob'})
            .then(function(r) { result = r; });
        $scope.$apply();
        expect(result.status).toEqual('accepted');
        expect(result.newState.user).toEqual('foo');
    });

    it('returns a denied state on OAuth-like login with "fail" in password', function () {
        var result = null;
        auth.checkLogin({user: 'foo', pass: 'failotron'})
            .then(null, function(r) { result = r; });
        $scope.$apply();
        expect(result.status).toEqual('denied');
    });

    it('returns an accepted state with user guess on OpenID-like login', function () {
        var result = null;

        auth.checkLogin({openid_identifier: 'https://example.com/foo/bar'})
            .then(function(r) { result = r; });
        $scope.$apply();
        expect(result.status).toEqual('accepted')
        expect(result.newState.user).toEqual('bar@example.com');

        auth.checkLogin({openid_identifier: 'http://example.com/foo/bar'})
            .then(function(r) { result = r; });
        $scope.$apply();
        expect(result.status).toEqual('accepted')
        expect(result.newState.user).toEqual('bar@example.com');

        auth.checkLogin({openid_identifier: 'example.com/foo/bar'})
            .then(function(r) { result = r; });
        $scope.$apply();
        expect(result.status).toEqual('accepted')
        expect(result.newState.user).toEqual('bar@example.com');

        auth.checkLogin({openid_identifier: 'somewhere.com'})
            .then(function(r) { result = r; });
        $scope.$apply();
        expect(result.status).toEqual('accepted')
        expect(result.newState.user).toEqual('john.doe@somewhere.com');
    });

    it('returns a denied state on OpenID-like login with "fail" in URL', function () {
        var result = null;
        auth.checkLogin({openid_identifier: 'https://fail.com/foo/bar'})
            .then(null, function(r) { result = r; });
        $scope.$apply();
        expect(result.status).toEqual('denied')
    });

    it('returns an accepted state with default username on other login', function () {
        var result = null;
        auth.checkLogin({})
            .then(function(r) { result = r; });
        $scope.$apply();
        expect(result.status).toEqual('accepted');
        expect(result.newState.user).toEqual('john.doe@example.com');
    });

    it('pretends to refresh logins', function () {
        var state;
        var handler = function(result) {
            state = result.newState;
        };
        auth.checkLogin({user: 'foo', pass: 'bob'}).then(handler);
        $scope.$apply();

        var result;
        auth.refreshLogin(state).then(function(r) { result = r; });
        $scope.$apply();
        expect(result.status).toEqual("accepted");
        expect(result.newState).toEqual(state);
    });

    it('adds auth header to res requests', function () {
        var state = {};
        var handler = function(result) {
            state = result.newState;
        };
        auth.checkLogin({user: 'foo', pass: 'bob'}).then(handler);
        $scope.$apply();

        var httpConf = {headers: {}};
        auth.addAuthToRequestConf(httpConf, state);
        expect(httpConf.headers.Authorization).toEqual('Mock foo');
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
