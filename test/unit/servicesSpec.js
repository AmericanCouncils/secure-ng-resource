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
                }
            };
            resource = secureResourceFactory(
                mockSession,
                'http://example.com:9001/thing/:thingId',
                {thingId: '@id'}, {
                kickIt: {method:'PUT', params: {volume: 11}}
            });
        });

        it('allows session to add headers to default GET requests', function () {
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

        it('allows session to add headers to default POST requests', function () {
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

        it('allows session to add headers to custom action requests', function () {
            $httpBackend.expectPUT(
                'http://example.com:9001/thing?volume=11',
                {a: 1},
                {
                    // Default headers added by angular
                    Accept: 'application/json, text/plain, */*',
                    'Content-Type': 'application/json;charset=utf-8',
                    // Header added by session
                    Authorization: 'foo'
                }
            ).respond({a: 1});
            resource.kickIt({a: 1});
            $httpBackend.flush();
        });

        it('allows session to add headers to requests through resource sub-objects', function () {
            $httpBackend.expectGET(
                'http://example.com:9001/thing'
            ).respond([{name: 'whatsit', id: 3}]);
            var things = resource.query({}, function () {
                things[0].name = 'whosit';
                $httpBackend.expectPOST(
                    'http://example.com:9001/thing/3',
                    {name: 'whosit', id: 3},
                    {
                        // Default headers added by angular
                        Accept: 'application/json, text/plain, */*',
                        'Content-Type': 'application/json;charset=utf-8',
                        // Header added by session
                        Authorization: 'foo'
                    }
                ).respond({name: 'whatsit'});
                things[0].$save();
            });
            $httpBackend.flush();
        });
    });

    describe('HTTP Interception', function () {
        var mockSession, http;
        beforeEach(inject(function(authSession, $http, $q) {
            http = $http;
            mockSession = jasmine.createSpyObj('session', ['handleHttpResponse']);
            authSession.dictionary['someSession'] = mockSession;
        }));
        afterEach(inject(function(authSession) {
            delete authSession.dictionary['someSession'];
        }));

        it('notifies attached session on HTTP responses', function () {
            $httpBackend.when('GET', 'http://example.com:9001/bunnies').
                respond({actions: ['hop', 'hop', 'hop']});
            http({
                method: 'GET',
                url: 'http://example.com:9001/bunnies',
                sessionDictKey: 'someSession'
            });
            $httpBackend.flush();
            expect(mockSession.handleHttpResponse).toHaveBeenCalled();
        });

        it('notifies attached session on negative HTTP responses', function () {
            $httpBackend.when('GET', 'http://example.com:9001/matrix').
                respond(401, {reason: 'You took the blue pill'});
            http({
                method: 'GET',
                url: 'http://example.com:9001/matrix',
                sessionDictKey: 'someSession'
            });
            $httpBackend.flush();
            expect(mockSession.handleHttpResponse).toHaveBeenCalled();
        });

        it('does not notify if session is not attached', function () {
            $httpBackend.when('GET', 'http://example.com:9001/theclub').
                respond(401, {reason: 'You just aren\'t cool enough'});
            http({
                method: 'GET',
                url: 'http://example.com:9001/theclub'
            });
            $httpBackend.flush();
            expect(mockSession.handleHttpResponse).not.toHaveBeenCalled();
        });
    });

    describe('AuthSession', function () {
        var sessionFactory, ses, auth, loc, timeout, q;
        beforeEach(inject(function(authSession, $location, $timeout, $q) {
            auth = {
                getAuthType: function() { return "mockAuth"; },
                checkLoginResult: {
                    status: 'accepted',
                    newState: { user: 'someone' }
                },
                checkLogin: function(creds) {
                    var deferred = q.defer();
                    if (this.checkLoginResult.status === 'accepted') {
                        deferred.resolve(this.checkLoginResult);
                    } else {
                        deferred.reject(this.checkLoginResult);
                    }
                    return deferred.promise;
                },
                addAuthToRequestConf: function(httpConf, state) {
                    httpConf.headers.Authorization = "foo";
                },
                checkResponseResult: {},
                checkResponse: function(response) {
                    return this.checkResponseResult;
                },
                refreshLogin: function(state) {
                    var deferred = q.defer();
                    var p = deferred.promise;
                    deferred.resolve({
                        status: 'accepted',
                        newState: state
                    });
                    return p;
                }
            };
            spyOn(auth, 'checkLogin').andCallThrough();
            spyOn(auth, 'addAuthToRequestConf').andCallThrough();
            spyOn(auth, 'checkResponse').andCallThrough();

            sessionFactory = authSession;
            ses = sessionFactory(auth);
            loc = $location;
            spyOn(loc, 'path').andCallFake(function(a) {
                if (a) {
                    return loc; // Path set
                } else {
                    return '/some/resource'; // Path get
                }
            });
            spyOn(loc, 'replace').andReturn(loc);

            timeout = $timeout;
            q = $q;
        }));

        it('has the correct initial state by default', function() {
            expect(ses.getUserName()).toBeUndefined();
            expect(ses.loggedIn()).toEqual(false);
            expect(ses.cookieKey()).toEqual('angular-mockAuth');
        });

        it('can use a custom cookie key', function () {
            var ses2 = sessionFactory(auth, {sessionName: 'foo'});
            expect(ses2.cookieKey()).toEqual('foo-mockAuth');
        });

        it('accepts logins which the authenticator approves', function() {
            auth.checkLoginResult.newState.user = 'alice';
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(ses.getUserName()).toEqual('alice');
            expect(ses.loggedIn()).toEqual(true);
        });

        it('denies logins which the authenticator does not approve', function() {
            auth.checkLoginResult =  { status: 'denied', msg: 'And stay out' };
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(ses.getUserName()).toBeUndefined();
            expect(ses.loggedIn()).toEqual(false);
        });

        it('creates a refresh timeout if requested by login result', function() {
            auth.checkLoginResult.newState.millisecondsToRefresh = 10000;
            ses.login({user: 'alice', pass: 'swordfish'});
            spyOn(auth, 'refreshLogin').andCallThrough();
            $scope.$apply();

            expect(auth.refreshLogin).not.toHaveBeenCalled();
            timeout.flush();
            expect(auth.refreshLogin).toHaveBeenCalled();
        });

        it('cancels the refresh timeout if manually logged out', function() {
            auth.checkLoginResult.newState.millisecondsToRefresh = 10000;
            spyOn(auth, 'refreshLogin');
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(auth.refreshLogin).not.toHaveBeenCalled();
            ses.logout();

            timeout(function() {}, 10000); // Fake event so flush doesn't complain
            timeout.flush();

            expect(auth.refreshLogin).not.toHaveBeenCalled();
        });

        it('cancels any refresh timeout on new login without refresh', function() {
            auth.checkLoginResult.newState.millisecondsToRefresh = 10000;
            spyOn(auth, 'refreshLogin');
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            delete auth.checkLoginResult.newState.millisecondsToRefresh;
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();

            timeout(function() {}, 10000); // Fake event so flush doesn't complain
            timeout.flush();

            expect(auth.refreshLogin).not.toHaveBeenCalled();
        });

        it('replaces any refresh timeout on new login with refresh', function() {
            auth.checkLoginResult.newState.millisecondsToRefresh = 10000;
            spyOn(auth, 'refreshLogin').andCallThrough();
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            auth.checkLoginResult.newState.user = 'someone_else';
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();

            timeout(function() {}, 10000); // Fake event so flush doesn't complain
            timeout.flush();

            expect(auth.refreshLogin).toHaveBeenCalledWith({
                millisecondsToRefresh: 10000,
                user: 'someone_else'
            });
            expect(auth.refreshLogin.callCount).toEqual(1);
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

        it('sends a synchronous request to a logout path if there is one', function() {
            var ses2 = sessionFactory(auth, {logoutUrl: 'http://example.com:9001/logmeout'});
            ses2.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            $httpBackend.expectPOST(
                'http://example.com:9001/logmeout', '', {
                    'Authorization': 'foo',
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json;charset=utf-8',
                }
            ).respond({loggedOut: true});
            ses2.logout();
            $scope.$apply();
            $httpBackend.flush();
        });

        it('resets location to / after a successful login by default', function () {
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(loc.path).toHaveBeenCalledWith('/');
            expect(loc.replace).toHaveBeenCalled();
        });

        it('can reset after login to a custom path', function () {
            var ses2 = sessionFactory(auth, {defaultPostLoginPath: '/foo'});
            ses2.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(loc.path).toHaveBeenCalledWith('/foo');
            expect(loc.replace).toHaveBeenCalled();
        });

        it('clears session, resets to login page after http auth failure', function () {
            auth.checkResponseResult = { authFailure: true };
            spyOn(ses, 'reset');
            ses.handleHttpResponse({});
            expect(auth.checkResponse).toHaveBeenCalled();
            expect(ses.reset).toHaveBeenCalled();
            expect(loc.path).toHaveBeenCalledWith('/login');
            expect(loc.replace).toHaveBeenCalled();
        });

        it('does not clear session or reset to login page on non-auth fail', function () {
            spyOn(ses, 'reset');
            ses.handleHttpResponse({});
            expect(auth.checkResponse).toHaveBeenCalled();
            expect(ses.reset).not.toHaveBeenCalled();
            expect(loc.path).not.toHaveBeenCalled();
            expect(loc.replace).not.toHaveBeenCalled();
        });

        it('resets back to original pre-reset path after login', function() {
            auth.checkResponseResult = { authFailure: true };
            ses.handleHttpResponse();
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(loc.path).toHaveBeenCalledWith('/some/resource');
            expect(loc.replace).toHaveBeenCalled();
        });

        it('redirects to /login after logout by default', function () {
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(loc.replace.calls.length).toEqual(1);
            ses.logout();
            $scope.$apply();
            expect(loc.path).toHaveBeenCalledWith('/login');
            expect(loc.replace.calls.length).toEqual(1);
        });

        it('can redirect to a custom login page', function () {
            var ses2 = sessionFactory(auth, {loginPath: '/welcome'});
            ses2.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(loc.replace.calls.length).toEqual(1);
            ses2.logout();
            $scope.$apply();
            expect(loc.path).toHaveBeenCalledWith('/welcome');
            expect(loc.replace.calls.length).toEqual(1);
        });

        it('allows auth to update outgoing requests when logged in', function () {
            var httpConf = {headers: {}};
            ses.manageRequestConf(httpConf);

            expect(httpConf.headers.Authorization).toBeUndefined();
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(httpConf.headers.Authorization).toBeDefined();
            ses.reset();
            $scope.$apply();
            expect(httpConf.headers.Authorization).toBeUndefined();
        });

        it('always attaches key to request configs', function () {
            var httpConf = {};
            ses.manageRequestConf(httpConf);
            expect(httpConf.sessionDictKey).toEqual(ses.cookieKey());
            ses.login({user: 'alice', pass: 'swordfish'});
            $scope.$apply();
            expect(httpConf.sessionDictKey).toEqual(ses.cookieKey());
            ses.reset();
            $scope.$apply();
            expect(httpConf.sessionDictKey).toEqual(ses.cookieKey());
        });
    });

    describe('PasswordOAuth', function () {
        var auth;
        beforeEach(inject(function(passwordOAuth) {
            auth = passwordOAuth('https://example.com', 'my_id', 'my_secret');
        }));

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

    describe('OpenIDAuth', function () {
        var auth, fakeInputElement, fakeFormElement, fakeDocument;
        beforeEach(inject(function(openIDAuth) {
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
        }));

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
                newState: { sessionId: 'xyz' }
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

        it('only treats res 401/403 HTTP responses as auth fails', function () {
            expect(auth.checkResponse({status: 200}).authFailure).toBeFalsy();
            expect(auth.checkResponse({status: 400}).authFailure).toBeFalsy();
            expect(auth.checkResponse({status: 401}).authFailure).toBeTruthy();
            expect(auth.checkResponse({status: 402}).authFailure).toBeFalsy();
            expect(auth.checkResponse({status: 403}).authFailure).toBeTruthy();
            expect(auth.checkResponse({status: 404}).authFailure).toBeFalsy();
            expect(auth.checkResponse({status: 500}).authFailure).toBeFalsy();
        });
    });
});
