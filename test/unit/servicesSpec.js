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
                manageRequestConf: function(httpConf) {
                    httpConf.headers = {};
                    httpConf.headers.Authorization = 'foo';
                },
                getHost: function() { return 'http://example.com:9001'; }
            };
            resource = secureResourceFactory(mockSession, '/thing');

        });

        it('allows session to add headers to GET requests', function () {
            $httpBackend.expectGET(
                'http://example.com:9001/thing',
                {
                    // Default headers added by ngResource
                    Accept: 'application/json, text/plain, */*',
                    // Header added by session
                    Authorization: 'foo'
                }
            ).respond({'name': 'whatsit'});
            resource.query();
            $httpBackend.flush();
        });

        it('allows session to add headers to POST requests', function () {
            $httpBackend.expectPOST(
                'http://example.com:9001/thing',
                {a: 1},
                {
                    // Default headers added by angular
                    Accept: 'application/json, text/plain, */*',
                    'Content-Type': 'application/json;charset=utf-8',
                    // Header added by session
                    Authorization: 'foo'
                }
            ).respond({'name': 'whatsit'});
            resource.save({a: 1});
            $httpBackend.flush();
        });
    });

    describe('HTTP Interception', function () {
        var mockSession, http;
        beforeEach(inject(function(session, $http) {
            http = $http;
            mockSession = jasmine.createSpyObj('session', ['handleHttpFailure']);
            session.dictionary['someSession'] = mockSession;
        }));
        afterEach(inject(function(session) {
            delete session.dictionary['someSession'];
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

    describe('Session', function () {
        var sessionFactory, ses, auth, loc;
        beforeEach(inject(function(session, $location) {
            auth = {
                checkLoginResult: {
                    status: 'accepted',
                    newState: { user: 'someone' }
                },
                checkLogin: function(creds, handler) {
                    handler(this.checkLoginResult);
                },

                addAuthToRequestConf: function(httpConf, state) {
                    httpConf.headers.Authorization = "foo";
                },

                isAuthFailureResult: false,
                isAuthFailure: function(response) {
                    return this.isAuthFailureResult;
                }
            };
            spyOn(auth, 'checkLogin').andCallThrough();
            spyOn(auth, 'addAuthToRequestConf').andCallThrough();
            spyOn(auth, 'isAuthFailure').andCallThrough();

            sessionFactory = session;
            ses = sessionFactory('localhost', auth);
            loc = $location;
            spyOn(loc, 'path').andCallFake(function(a) {
                if (a) {
                    return loc; // Path set
                } else {
                    return '/some/resource'; // Path get
                }
            });
            spyOn(loc, 'replace').andReturn(loc);
        }));

        it('has the correct initial state by default', function() {
            expect(ses.getUserName()).toBeUndefined();
            expect(ses.loggedIn()).toEqual(false);
            expect(ses.cookieKey()).toEqual('angular-localhost');
        });

        it('can use a custom cookie key', function () {
            var ses2 = sessionFactory('bar', auth, {sessionName: 'foo'});
            expect(ses2.cookieKey()).toEqual('foo-bar');
        });

        it('accepts logins which the authenticator approves', function() {
            auth.checkLoginResult.newState.user = 'alice';
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(ses.getUserName()).toEqual('alice');
            expect(ses.loggedIn()).toEqual(true);
        });

        it('denies logins which the authenticator does not approve', function() {
            auth.checkLoginResult =  { status: 'denied', msg: 'And stay out' };
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(ses.getUserName()).toBeUndefined();
            expect(ses.loggedIn()).toEqual(false);
        });

        it('can drop the session state', function() {
            ses.login({user: 'alice', pass: 'swordfish'});
            ses.reset();
            expect(ses.getUserName()).toBeUndefined();
            expect(ses.loggedIn()).toEqual(false);
        });

        it('drops session state after logout', function() {
            ses.login({user: 'alice', pass: 'swordfish'});
            ses.logout();
            expect(ses.getUserName()).toBeUndefined();
            expect(ses.loggedIn()).toEqual(false);
        });

        it('resets location to / after a successful login by default', function () {
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(loc.path).toHaveBeenCalledWith('/');
            expect(loc.replace).toHaveBeenCalled();
        });

        it('can reset after login to a custom path', function () {
            var ses2 = sessionFactory('bar', auth, {defaultPostLoginPath: '/foo'});
            ses2.login({user: 'alice', pass: 'swordfish'});
            expect(loc.path).toHaveBeenCalledWith('/foo');
            expect(loc.replace).toHaveBeenCalled();
        });

        it('clears session, resets to login page after http auth failure', function () {
            auth.isAuthFailureResult = true;
            spyOn(ses, 'reset');
            ses.handleHttpFailure({});
            expect(ses.reset).toHaveBeenCalled();
            expect(loc.path).toHaveBeenCalledWith('/login');
            expect(loc.replace).toHaveBeenCalled();
        });

        it('does not clear session or reset to login page on non-auth fail', function () {
            spyOn(ses, 'reset');
            ses.handleHttpFailure({});
            expect(ses.reset).not.toHaveBeenCalled();
            expect(loc.path).not.toHaveBeenCalled();
            expect(loc.replace).not.toHaveBeenCalled();
        });

        it('resets back to original pre-reset path after login', function() {
            auth.isAuthFailureResult = true;
            ses.handleHttpFailure();
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(loc.path).toHaveBeenCalledWith('/some/resource');
            expect(loc.replace).toHaveBeenCalled();
        });

        it('redirects to /login after logout by default', function () {
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(loc.replace.calls.length).toEqual(1);
            ses.logout();
            expect(loc.path).toHaveBeenCalledWith('/login');
            expect(loc.replace.calls.length).toEqual(1);
        });

        it('can redirect to a custom login page', function () {
            var ses2 = sessionFactory('bar', auth, {loginPath: '/welcome'});
            ses2.login({user: 'alice', pass: 'swordfish'});
            expect(loc.replace.calls.length).toEqual(1);
            ses2.logout();
            expect(loc.path).toHaveBeenCalledWith('/welcome');
            expect(loc.replace.calls.length).toEqual(1);
        });

        it('allows auth to update outgoing requests when logged in', function () {
            var httpConf = {headers: {}};
            ses.manageRequestConf(httpConf);

            expect(httpConf.headers.Authorization).toBeUndefined();
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(httpConf.headers.Authorization).toBeDefined();
            ses.reset();
            expect(httpConf.headers.Authorization).toBeUndefined();
        });

        it('when logged in, attaches key to request configs', function () {
            var httpConf = {};
            ses.manageRequestConf(httpConf);
            expect(httpConf.sessionDictKey).toBeUndefined();
            ses.login({user: 'alice', pass: 'swordfish'});
            expect(httpConf.sessionDictKey).toEqual(ses.cookieKey());
            ses.reset();
            expect(httpConf.sessionDictKey).toBeUndefined();
        });

        it('calls appropriate login callbacks depending on checkLogin', function () {
            var loginCallbacks = jasmine.createSpyObj('callbacks', [
                'accepted', 'denied', 'error'
            ]);

            ses.login({user: 'alice', pass: 'swordfish'}, loginCallbacks);
            expect(loginCallbacks.accepted).toHaveBeenCalledWith(
                auth.checkLoginResult
            );
            expect(loginCallbacks.denied).not.toHaveBeenCalled();
            expect(loginCallbacks.error).not.toHaveBeenCalled();

            auth.checkLoginResult = {status: 'denied', msg: 'Go away'};
            ses.login({user: 'alice', pass: 'swordfish'}, loginCallbacks);
            expect(loginCallbacks.denied).toHaveBeenCalledWith(
                auth.checkLoginResult
            );

            auth.checkLoginResult = {status: 'error', msg: 'Line is busy'};
            ses.login({user: 'alice', pass: 'swordfish'}, loginCallbacks);
            expect(loginCallbacks.error).toHaveBeenCalledWith(
                auth.checkLoginResult
            );
        });
    });

    describe('PasswordOAuth', function () {
        var auth;
        beforeEach(inject(function(passwordOAuth) {
            auth = passwordOAuth('https://example.com', 'my_id', 'my_secret');
        }));

        it('makes valid token requests and calls handler with user', function () {
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
            auth.checkLogin(
                {user: 'alice', pass: 'swordfish'},
                function() {}
            );
            $httpBackend.flush();
        });

        it('calls handler with user on accepted token requests', function () {
            var handler = jasmine.createSpy('handler');
            $httpBackend.when('POST', 'https://example.com/oauth/v2/token'
            ).respond({
                access_token: 'abc',
                refresh_token: 'xyz',
                expires_in: 3600
            });
            auth.checkLogin(
                {user: 'alice', pass: 'swordfish'},
                handler
            );
            $httpBackend.flush();
            expect(handler.mostRecentCall.args[0].newState.user).toEqual('alice');
        });

        it('calls handler correctly on denied requests', function () {
            var handler = jasmine.createSpy('handler');
            $httpBackend.when('POST', 'https://example.com/oauth/v2/token').
                respond(400, {error: 'invalid_grant'});
            auth.checkLogin(
                {user: 'alice', pass: 'swordfish'},
                handler
            );
            $httpBackend.flush();
            expect(handler.mostRecentCall.args[0].status).toEqual('denied');
            expect(handler.mostRecentCall.args[0].msg).toMatch(/password/i);
        });

        it('calls handler correctly on HTTP failure', function () {
            var handler = jasmine.createSpy('handler');
            $httpBackend.when('POST', 'https://example.com/oauth/v2/token').
                respond(500, "Internal Server Error, Oh Noes");
            auth.checkLogin(
                {user: 'alice', pass: 'swordfish'},
                handler
            );
            $httpBackend.flush();
            expect(handler.mostRecentCall.args[0].status).toEqual('error');
            expect(handler.mostRecentCall.args[0].msg).toMatch(/500/);
        });

        it('calls handler correctly on OAuth failure', function () {
            var handler = jasmine.createSpy('handler');
            $httpBackend.when('POST', 'https://example.com/oauth/v2/token').
                respond(500, {error_description: "War Were Declared"});
            auth.checkLogin(
                {user: 'alice', pass: 'swordfish'},
                handler
            );
            $httpBackend.flush();
            expect(handler.mostRecentCall.args[0].status).toEqual('error');
            expect(handler.mostRecentCall.args[0].msg).toMatch(/Were/);
        });

        it('adds Authorization header with token to requests', function () {
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
            auth.checkLogin(
                {user: 'alice', pass: 'swordfish'},
                handler
            );
            $httpBackend.flush();
            
            var httpConf = {headers: {}};
            auth.addAuthToRequestConf(httpConf, state);
            expect(httpConf.headers.Authorization).toEqual("Bearer abc");
        });

        it('only treats HTTP responses with 401 status as auth fails', function () {
            expect(auth.isAuthFailure({status: 401})).toBeTruthy();
            expect(auth.isAuthFailure({status: 200})).toBeFalsy();
            expect(auth.isAuthFailure({status: 405})).toBeFalsy();
            expect(auth.isAuthFailure({status: 500})).toBeFalsy();
        });
    });
});
