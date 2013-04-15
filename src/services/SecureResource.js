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

    return function(session, url, paramDefaults, actions) {
        var fullActions = angular.extend({}, DEFAULT_ACTIONS, actions);
        angular.forEach(fullActions, function(httpConf) {
            session.manageRequestConf(httpConf);
        });

        // Escape the colon before a port number, it confuses ngResource
        url = url.replace(/^([^\/].+?)(:\d+\/)/g, '$1\\$2');
        var res = $resource(url, paramDefaults, fullActions);

        return res;
    };
}]);
