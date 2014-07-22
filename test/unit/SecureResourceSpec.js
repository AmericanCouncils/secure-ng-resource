'use strict';

describe('SecureResource', function () {
    beforeEach(module('secureNgResource'));

    var $httpBackend, resource, mockSession;
    beforeEach(inject(function ($rootScope, $injector, secureResource) {
        $httpBackend = $injector.get('$httpBackend');

        mockSession = {
            manageRequestConf: function(httpConf) {
                httpConf.headers = {};
                httpConf.headers.Authorization = 'foo';
            }
        };

        resource = secureResource(
            mockSession,
            'http://example.com:9001/thing/:thingId',
            {thingId: '@id'}, {
            kickIt: {method:'PUT', params: {volume: 11}}
        });
    }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
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
        ).respond([{'name': 'whatsit'}]);
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
        var called = false;
        var things = resource.query({}, function () {
            called = true;
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
        expect(called).toBeTruthy();
    });

    it('correctly resolves successful responses', function () {
        $httpBackend.expectGET(
            'http://example.com:9001/thing'
        ).respond([{name: 'whatsit', id: 3}]);
        var success = jasmine.createSpy('successCallback');
        var failure = jasmine.createSpy('failureCallback');
        resource.query().$promise.then(success, failure);
        $httpBackend.flush();
        expect(success).toHaveBeenCalled();
        expect(failure).not.toHaveBeenCalled();
    });

    it('correctly rejects unsuccessful responses', function () {
        $httpBackend.expectGET(
            'http://example.com:9001/thing'
        ).respond(500, [{name: 'whatsit', id: 3}]);
        var success = jasmine.createSpy('successCallback');
        var failure = jasmine.createSpy('failureCallback');
        resource.query().$promise.then(success, failure);
        $httpBackend.flush();
        expect(success).not.toHaveBeenCalled();
        expect(failure).toHaveBeenCalled();
    });
});
