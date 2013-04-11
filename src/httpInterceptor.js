'use strict';

angular.module('secureNgResource').config([
'$httpProvider', 'sessionDictionary',
function($httpProvider, sessionDictionary) {
    $httpProvider.responseInterceptors.push([function() {
        return function(promise) {
            return promise.then(function (response) {
                // Success
                return response;
            }, function (response)  {
                // Failure
                var ses = sessionDictionary[response.config.sessionCookieKey];
                if (ses) {
                    return ses.handleHttpFailure(response);
                } else {
                    // Let someone else deal with this problem
                    return response;
                }
            });
        };
    }]);
}]);
