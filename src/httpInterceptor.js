'use strict';

angular.module('secureNgResource')
.factory('secureResourceHttpInterceptor', [
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

    return {
        response: function(response) {
            return responder(response);
        },

        responseError: function(response) {
            response = responder(response);
            return $q.reject(response);
        }
    };
}]);

angular.module('secureNgResource')
.config([
'$httpProvider',
function($httpProvider) {
    $httpProvider.interceptors.push('secureResourceHttpInterceptor');
}]);
