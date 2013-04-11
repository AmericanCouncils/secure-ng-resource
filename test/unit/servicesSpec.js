'use strict';

/* jasmine specs for services go here */
describe('Dom Utility Service', function () {
    beforeEach(module('secureNgResource'));

    var $scope, $httpBackend;
    beforeEach(inject(function ($rootScope, $injector) {
        $scope = $rootScope.$new();

        $httpBackend = $injector.get('$httpBackend');
        $httpBackend.when('GET', 'http://localhost:9001/thing').
            respond({'name': 'whatsit'});
        $httpBackend.when('POST', 'http://localhost:9001/thing').
            respond({'name': 'whatsit'});
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

        var session, resource;
        beforeEach(function() {
            session = {
                updateRequest: function(httpConf) {
                    httpConf.headers = {};
                    httpConf.headers.Authorization = 'foo';
                },

                getHost: function() {
                    return "http://localhost:9001";
                }
            };
            resource = secureResourceFactory(session, '/thing');
        });

        it('allows session to add headers to GET requests', function () {
            $httpBackend.expectGET(
                'http://localhost:9001/thing',
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
            $httpBackend.expectPOST(
                'http://localhost:9001/thing',
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
});
