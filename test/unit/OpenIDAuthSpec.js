'use strict';

describe('OpenIDAuth', function () {
    beforeEach(module('secureNgResource'));

    var $scope, $httpBackend, auth, fakeInputElement, fakeFormElement, fakeDocument;
    beforeEach(inject(function ($rootScope, $injector, openIDAuth) {
        $scope = $rootScope.$new();
        $httpBackend = $injector.get('$httpBackend');

        auth = openIDAuth('https://example.com/openid_begin', 'popup');

        fakeInputElement = { value: null };
        fakeFormElement = { submit: function() {} };
        spyOn(fakeFormElement, 'submit');

        fakeDocument = {
            getElementById: function(id) {
                if (id == 'oid') { return fakeInputElement; }
                if (id == 'shimform') { return fakeFormElement; }
                throw "Invalid id requested";
            },
            write: function() {}
        };
        spyOn(fakeDocument, 'write');

        var fakeWindow = { document: fakeDocument };
        spyOn(window, 'open').andReturn(fakeWindow);

        delete window.handleAuthResponse;
        delete window.openIdPopup;
    }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it('returns the correct auth type', function () {
        expect(auth.getAuthType()).toEqual('OpenIDAuth');
    });

    it('begins OpenID requests in a popup with a dynamic form', function () {
        auth.checkLogin({openid_identifier: 'foo'});
        expect(window.open).toHaveBeenCalledWith(
            '',
            'openid_popup',
            'width=450,height=500,location=1,status=1,resizable=yes'
        );
        expect(fakeDocument.write).toHaveBeenCalledWith(
            '<form id="shimform" method="post" ' +
            'action="https://example.com/openid_begin">' +
            '<input type="hidden" name="openid_identifier" id="oid" />' +
            '</form>'
        );
        expect(fakeInputElement.value).toEqual('foo');
        expect(fakeFormElement.submit).toHaveBeenCalled();
    });

    it('allows additional GET arguments to be passed to server for OpenID req', function () {
        auth.checkLogin({openid_identifier: 'foo', query: { bar: 'narf' } });
        expect(fakeDocument.write).toHaveBeenCalledWith(
            '<form id="shimform" method="post" ' +
            'action="https://example.com/openid_begin?bar=narf">' +
            '<input type="hidden" name="openid_identifier" id="oid" />' +
            '</form>'
        );
    });

    it('creates and cleans up response handler', function () {
        expect(window.handleAuthResponse).toBeUndefined();
        auth.checkLogin({openid_identifier: 'foo'});
        expect(typeof window.handleAuthResponse).toBe('function');
        window.handleAuthResponse('abc=123');
        expect(window.handleAuthResponse).toBeUndefined();
    });

    it('resolves promise correctly on approved logins', function () {
        var handler = jasmine.createSpy('handler');
        auth.checkLogin({openid_identifier: 'foo'}).then(handler);
        var d = {approved: true, user: 'bob', sessionId: 'xyz'};
        window.handleAuthResponse(d);
        $scope.$apply();
        expect(handler).toHaveBeenCalledWith({
            status: 'accepted',
            newState: { sessionId: 'xyz', user: 'bob' }
        })
    });

    it('rejects promise correctly on denied logins', function () {
        var handler = jasmine.createSpy('handler');
        auth.checkLogin({openid_identifier: 'foo'}).then(null, handler);
        var d = {approved: false, message: 'Foo'};
        window.handleAuthResponse(d);
        $scope.$apply();
        expect(handler).toHaveBeenCalledWith({
            status: 'denied',
            msg: 'Foo'
        })
    });

    it('rejects promise with default message on denied logins', function () {
        var handler = jasmine.createSpy('handler');
        auth.checkLogin({openid_identifier: 'foo'}).then(null, handler);
        var d = {approved: false};
        window.handleAuthResponse(d);
        $scope.$apply();
        expect(handler).toHaveBeenCalledWith({
            status: 'denied',
            msg: 'Access denied'
        })
    });

    // TODO: Somehow can we tell if window.open wasn't able to get to
    // the target URL? Or if the dialog was closed without handleAuth being
    // called?
    /*
    it('calls handler correctly on HTTP failure', function () {
        var handler = jasmine.createSpy('handler');
        auth.checkLogin({openid_identifier: 'foo'}).then(null, handler);
        $httpBackend.when('GET', 'https://example.com/openid_finish?abc=123').
            respond(500, "Internal Server Error, Oh Noes");
        window.handleAuthResponse('abc=123');
        $httpBackend.flush();
        $scope.$apply();
        expect(handler.mostRecentCall.args[0].status).toEqual('error');
        expect(handler.mostRecentCall.args[0].msg).toMatch(/500/);
    });
    */

    it('adds auth header to res requests', function () {
        var state = {};
        var handler = function(result) {
            state = result.newState;
        };
        auth.checkLogin({openid_identifier: 'foo'}).then(handler);
        var d = {approved: true, user: 'bob', sessionId: 'xyz'};
        window.handleAuthResponse(d);
        $scope.$apply();

        var httpConf = {headers: {}};
        auth.addAuthToRequestConf(httpConf, state);
        expect(httpConf.headers.Authorization).toEqual('SesID xyz');
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
