'use strict';

describe('secure-ng-resource', function () {
    beforeEach(module('secureNgResource'));

    var $scope, $httpBackend;
    beforeEach(inject(function ($rootScope, $injector) {
        $scope = $rootScope.$new();
        $httpBackend = $injector.get('$httpBackend');
    }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    describe('SecureResource', function () {
        var secureResourceFactory;
        beforeEach(inject(function(secureResource) {
            secureResourceFactory = secureResource;
        }));

        var resource, mockSession;
        beforeEach(function() {
            mockSession = {
                updateRequest: function(httpConf) {
                    httpConf.headers = {};
                    httpConf.headers.Authorization = 'foo';
                },
                getHost: function() { return 'http://example.com:9001'; }
            };
            resource = secureResourceFactory(mockSession, '/thing');

        });

        it('allows session to add headers to GET requests', function () {
            $httpBackend.when('GET', 'http://example.com:9001/thing').
                respond({'name': 'whatsit'});
            $httpBackend.expectGET(
                'http://example.com:9001/thing',
                {
                    // Default headers added by ngResource
                    Accept: 'application/json, text/plain, */*',
                    // Header added by session
                    Authorization: 'foo'
                }
            );
            resource.query();
            $httpBackend.flush();
        });

        it('allows session to add headers to POST requests', function () {
            $httpBackend.when('POST', 'http://example.com:9001/thing').
                respond({'name': 'whatsit'});
            $httpBackend.expectPOST(
                'http://example.com:9001/thing',
                {a: 1},
                {
                    // Default headers added by ngResource
                    Accept: 'application/json, text/plain, */*',
                    'Content-Type': 'application/json;charset=utf-8',
                    // Header added by session
                    Authorization: 'foo'
                }
            );
            resource.save({a: 1});
            $httpBackend.flush();
        });
    });

    describe('HTTP Interception', function () {
        var mockSession, http;
        beforeEach(inject(function(sessionDictionary, $http) {
            http = $http;
            mockSession = jasmine.createSpyObj("session", ["handleHttpFailure"]);
            sessionDictionary['someSession'] = mockSession;
        }));

        it('notifies attached session on failed HTTP requests', function () {
            $httpBackend.when('GET', 'http://example.com:9001/matrix').
                respond(401, {reason: 'You took the blue pill'});
            http({
                method: 'GET',
                url: 'http://example.com:9001/matrix',
                sessionDictKey: 'someSession'
            });
            $httpBackend.flush();
            expect(mockSession.handleHttpFailure).toHaveBeenCalled();
        });

        it('does not notify if session is not attached', function () {
            $httpBackend.when('GET', 'http://example.com:9001/theclub').
                respond(401, {reason: 'You just aren\'t cool enough'});
            http({
                method: 'GET',
                url: 'http://example.com:9001/theclub'
            });
            $httpBackend.flush();
            expect(mockSession.handleHttpFailure).not.toHaveBeenCalled();
        });

        it('does not notify on successful HTTP requests', function () {
            $httpBackend.when('GET', 'http://example.com:9001/bunnies').
                respond({actions: ['hop', 'hop', 'hop']});
            http({
                method: 'GET',
                url: 'http://example.com:9001/bunnies',
                sessionDictKey: 'someSession'
            });
            $httpBackend.flush();
            expect(mockSession.handleHttpFailure).not.toHaveBeenCalled();
        });
    });

    describe('Session', function() {
        var sessionFactory, ses, auth, loc;
        beforeEach(inject(function(session, $location) {
            sessionFactory = session;
            auth = {
               checkLogin: function(host, creds, handler) {},
               addAuthToRequest: function(httpConf, state) {},
               isAuthFailure: function(response) {}
            };
            ses = sessionFactory('localhost', auth);
            loc = $location;
        }));

        var checkLoginAcceptAll = function(host, creds, handler) {
            handler({ status: 'accepted', newState: { user: creds.user } });
        };

        var checkLoginDenyAll = function(host, creds, handler) {
            handler({ status: 'denied', msg: "And stay out" });
        };

        it('has the correct initial state by default', function() {
            expect(ses.getUserName()).toBeUndefined();
            expect(ses.loggedIn()).toEqual(false);
            expect(ses.cookieKey()).toEqual("angular-localhost");
        });

        it('allows cookie key to be overridden', function () {
            var ses2 = sessionFactory('bar', auth, {sessionName: 'foo'});
            expect(ses2.cookieKey()).toEqual("foo-bar");
        });

        it('accepts logins which the authenticator approves', function() {
            spyOn(auth, "checkLogin").andCallFake(checkLoginAcceptAll);
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(ses.getUserName()).toEqual('alice');
            expect(ses.loggedIn()).toEqual(true);
        });

        it('denies logins which the authenticator does not approve', function() {
            spyOn(auth, "checkLogin").andCallFake(checkLoginDenyAll);
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(ses.getUserName()).toBeUndefined();
            expect(ses.loggedIn()).toEqual(false);
        });

        it('can drop the session state', function() {
            spyOn(auth, "checkLogin").andCallFake(checkLoginAcceptAll);
            ses.login({user: 'alice', pass: 'swordfish'});
            ses.reset();
            expect(ses.getUserName()).toBeUndefined();
            expect(ses.loggedIn()).toEqual(false);
        });

        it('resets location to / after a successful login by default', function () {
            spyOn(auth, "checkLogin").andCallFake(checkLoginAcceptAll);
            spyOn(loc, "path").andReturn(loc);
            spyOn(loc, "replace").andReturn(loc);
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(loc.path).toHaveBeenCalledWith("/");
            expect(loc.replace).toHaveBeenCalled();
        });
    });
});
