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

    /* FIXME It seems that the mock httpBackend does not simulate intercepts
    describe('HTTP Interception', function () {
        var mockSession, http;
        beforeEach(inject(function(sessionDictionary, $http) {
            http = $http;
            mockSession = {
                handleHttpFailure: function(resource) { return false; },
                updateRequest: function(httpConf) {
                    httpConf.sessionDictKey = 'someSession';
                }
            };
            spyOn(mockSession, 'handleHttpFailure');
            sessionDictionary['someSession'] = mockSession;
        }));

        it('notifies attached session on failed HTTP requests', function () {
            $httpBackend.when('GET', 'http://example.com:9001/matrix').
                respond(401, {reason: 'You took the blue pill'});
            http({method: 'GET', url: 'http://example.com:9001/matrix'});
            $httpBackend.flush();
            expect(mockSession.handleHttpFailure).toHaveBeenCalled();
        });

        it('does not notify if session is not attached', function () {
            $httpBackend.when('GET', 'http://example.com:9001/theclub').
                respond(401, {reason: 'You just aren\'t cool enough'});
            http({method: 'GET', url: 'http://example.com:9001/theclub'});
            $httpBackend.flush();
            expect(mockSession.handleHttpFailure).not.toHaveBeenCalled();
        });

        it('does not notify on successful HTTP requests', function () {
            $httpBackend.when('GET', 'http://example.com:9001/bunnies').
                respond({actions: ['hop', 'hop', 'hop']});
            http({method: 'GET', url: 'http://example.com:9001/bunnies'});
            $httpBackend.flush();
            expect(mockSession.handleHttpFailure).not.toHaveBeenCalled();
        });
    });
    */
});
