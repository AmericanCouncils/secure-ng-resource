'use strict';

angular.module('secureNgResource')
.config([
'$httpProvider',
function($httpProvider) {
    // TODO Interceptors are deprecated, but we need access to the
    // status code of the response and transformResponse cannot get us that.
    $httpProvider.responseInterceptors.push([
    'authSession', '$q',
    function(authSession, $q) {
        var responder = function(response) {
            var ses = authSession.dictionary[response.config.sessionDictKey];
            if (ses) {
                return ses.handleHttpResponse(response);
            } else {
                return response;
            }
        };

        var errorResponder = function(response) {
            response = responder(response);
            return $q.reject(response);
        };

        return function(promise) {
            return promise.then(responder, errorResponder);
        };
    }]);
}]);
