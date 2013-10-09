'use strict';

describe('HTTP Interception', function () {
    beforeEach(module('secureNgResource'));

    var $httpBackend, mockSession, http;
    beforeEach(inject(function ($rootScope, $injector, $http, authSession) {
        $httpBackend = $injector.get('$httpBackend');
        http = $http;
        mockSession = jasmine.createSpyObj('session', ['handleHttpResponse']);
        authSession.dictionary['someSession'] = mockSession;
    }));

    afterEach(inject(function(authSession) {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
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
