'use strict';

angular.module('secureNgResource')
.factory('secureResource', [
'$resource', function($resource) {
    var DEFAULT_ACTIONS = {
        'get':    {method:'GET'},
        'save':   {method:'POST'},
        'query':  {method:'GET', isArray:true},
        'remove': {method:'DELETE'},
        'delete': {method:'DELETE'}
    };

    return function(session, path, paramDefaults, actions) {
        var fullActions = angular.extend({}, DEFAULT_ACTIONS, actions);
        _(fullActions).each(function(httpConf) {
            // FIXME This will stop working when token changes!
            // Update as needed from session, tracking resource by path
            session.addAuthToRequest(httpConf);
        });

        // Escape the colon before a port number, it confuses ngResource
        var host = session.getHost().replace(/(:\d+)$/g, '\\$1');
        var res = $resource(host + path, paramDefaults, fullActions);
        res.session = session;

        return res;
    };
}]);
