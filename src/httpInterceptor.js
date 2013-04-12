'use strict';

angular.module('secureNgResource').config([
'$httpProvider',
function($httpProvider) {
    $httpProvider.responseInterceptors.push([
    'sessionDictionary',
    function(sessionDictionary) {
        return function(promise) {
            return promise.then(function (response) {
                // Success
                return response;
            }, function (response)  {
                // Failure
                var ses = sessionDictionary[response.config.sessionDictKey];
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
