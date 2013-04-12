'use strict';

angular.module('secureNgResource')
.factory('secureResource', [
'$resource',
function($resource) {
    var DEFAULT_ACTIONS = {
        'get':    {method:'GET'},
        'save':   {method:'POST'},
        'query':  {method:'GET', isArray:true},
        'remove': {method:'DELETE'},
        'delete': {method:'DELETE'}
    };

    return function(session, path, paramDefaults, actions) {
        var fullActions = angular.extend({}, DEFAULT_ACTIONS, actions);
        angular.forEach(fullActions, function(httpConf) {
            // FIXME What about when auth headers change?
            session.manageRequestConf(httpConf);
        });

        // Escape the colon before a port number, it confuses ngResource
        var host = session.getHost().replace(/(:\d+)$/g, '\\$1');
        var res = $resource(host + path, paramDefaults, fullActions);

        return res;
    };
}]);
