'use strict';

angular.module('secureNgResource')
.config([
'$httpProvider',
function($httpProvider) {
    // TODO Interceptors are deprecated, but we need access to the
    // status code of the response and transformResponse cannot get us that.
    $httpProvider.responseInterceptors.push([
    'session',
    function(session) {
        return function(promise) {
            return promise.then(function (response) {
                // Success
                return response;
            }, function (response)  {
                // Failure
                var ses = session.dictionary[response.config.sessionDictKey];
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
