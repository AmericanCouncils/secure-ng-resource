'use strict';

/* jasmine specs for services go here */
describe('Dom Utility Service', function () {
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
        beforeEach(inject(function (secureNgResource) {
            secureResourceFactory = secureNgResource;
        }));

        var session, resource;
        beforeEach(function() {
            session = {
                updateRequest: function(httpConf) {
                    httpConf.headers.Authorization = 'foo';
                }
            };

            resource = secureResourceFactory(session, '/thing');
        });

        it('should allow session to change outgoing GET requests', function () {
            $httpBackend.expectGET('/thing', {Authorization: 'foo'});
            resource.query();
            $httpBackend.flush();
        });
    });
});
