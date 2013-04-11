/***********************************************
* secure-ng-resource JavaScript Library
* https://github.com/davidmikesimon/secure-ng-resource/ 
* License: MIT (http://www.opensource.org/licenses/mit-license.php)
* Compiled At: 04/11/2013 13:22
***********************************************/
(function(window) {
'use strict';
'use strict';

angular.module('secureNgResource').config([
'$httpProvider', 'sessionDictionary',
function($httpProvider, sessionDictionary) {
    $httpProvider.responseInterceptors.push([function() {
        return function(promise) {
            return promise.then(function (response) {return response;
            }, function (response)  {var ses = sessionDictionary[response.config.sessionCookieKey];
                if (ses) {
                    return ses.handleHttpFailure(response);
                } else {return response;
                }
            });
        };
    }]);
}]);

angular.module('secureNgResource', [
    'ngResource',
    'ngCookies'
]);

'use strict';

angular.module('secureNgResource')
.factory('oauthPasswordSession', [
'$http', 'sessionBase',
function($http, sessionBase) {
    var OAuthPasswordSession = function (host, clientId, clientSecret, settings) {
        this.initialize(host, angular.extend(
            {},
            settings,
            {
                host: host,
                clientId: clientId,
                clientSecret: clientSecret
            }
        ));
    };

    OAuthPasswordSession.prototype = {
        login: function (user, pass, loginCallbacks) {
            $http({
                method: 'POST',
                url: this.settings.host + '/oauth/v2/token',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                data: $.param({
                    'client_id': this.settings.clientId,
                    'client_secret': this.settings.clientSecret,
                    'grant_type': 'password',
                    'username': user,
                    'password': pass
                })
            }).then(function(response) {
                if (
                response.status === 200 &&
                _(response.data).has('access_token')
                ) {if (loginCallbacks.accepted) { loginCallbacks.accepted(); }
                    this.state = {
                        user: user,
                        accessToken: response.data['access_token'],
                        accessTokenExpires:
                            new Date().getTime() + response.data['expires_in'],
                        refreshToken: response.data['refresh_token']
                    };
                    this.loginSucceeded();
                } else if (
                response.status === 400 &&
                _(response.data).has('error') &&
                response.data.error === 'invalid_grant'
                ) {if (loginCallbacks.denied) { loginCallbacks.denied(); }
                } else {if (loginCallbacks.error) {
                        var msg = 'HTTP Status ' + response.status;
                        if (response.status === 0) {
                            msg = 'Unable to connect to authentication server';
                        } else if ( _(response.data).has('error_description')) {
                            msg = 'OAuth:' + response.data['error_description'];
                        }
                        loginCallbacks.error(msg);
                    }
                }
            });
        },

        addAuthToRequest: function (httpConf) {
            httpConf.headers.Authorization = 'Bearer ' + this.state.accessToken;
        },

        isAuthFailure: function (response) {
            return (response.status === 401);
        }
    };

    angular.extend(OAuthPasswordSession.prototype, sessionBase);

    var OAuthPasswordSessionFactory =
    function(host, clientId, clientSecret, options) {
        return new OAuthPasswordSession(host, clientId, clientSecret, options);
    };

    return OAuthPasswordSessionFactory;
}]);

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
        _(fullActions).each(function(httpConf) {session.updateRequest(httpConf);
        });var host = session.getHost().replace(/(:\d+)$/g, '\\$1');
        var res = $resource(host + path, paramDefaults, fullActions);
        res.session = session;

        return res;
    };
}]);

'use strict';

angular.module('secureNgResource')
.factory('sessionBase', [
'$q', '$location', '$cookieStore', 'sessionDictionary',
function($q, $location, $cookieStore, sessionDictionary) {
    var DEFAULT_SETTINGS = {
        sessionName: 'oauth',
        loginPath: '/login',
        defaultPostLoginPath: '/'
    };

    var pureAbstract = function () { throw 'to be implemented by subclass'; };

    var SessionBase = {
        login: pureAbstract,
        addAuthToRequest: pureAbstract,
        isAuthFailure: pureAbstract,

        initialize: function (settings) {
            this.settings = angular.extend(
                {},
                DEFAULT_SETTINGS,
                settings
            );

            this.priorPath = null;
            this.state = null;

            sessionDictionary[this.cookieKey()] = this;

            var cookie = $cookieStore.get(this.cookieKey());
            if (cookie) {
                this.state = cookie;
            } else {
                this.reset();
            }
        },

        getUserName: function () {
            if (this.loggedIn()) {
                return this.state.user;
            }
        },

        loggedIn: function () {return !_.isNull(this.state);
        },

        getHost: function () {
            return this.settings.host;
        },

        logout: function () {
            if (this.loggedIn()) {
                this.reset();
                $location.path(this.settings.loginPath);
            }
        },

        reset: function () {
            this.state = null;
            $cookieStore.remove(this.cookieKey());
        },

        loginSucceeded: function () {
            $cookieStore.put(this.cookieKey(), this.state);

            var tgt = this.settings.defaultPostLoginPath;
            if (!_.isNull(this.priorPath)) {
                tgt = this.priorPath;
            }
            $location.path(tgt).replace();
        },

        cookieKey: function () {
            return this.settings.sessionName + '-' +
                encodeURIComponent(this.settings.host);
        },

        updateRequest: function(httpConf) {
            if (!_.isObject(httpConf.headers)) { httpConf.headers = {}; }
            if (this.loggedIn()) { this.addAuthToRequest(); }
            httpConf.sessionCookieKey = this.cookieKey();
        },

        handleHttpFailure: function(response) {
            if (this.isAuthFailure(response)) {
                this.reset();
                this.priorPath = $location.path();
                $location.path(this.settings.loginPath).replace();
                return $q.reject(response);
            } else {
                return response;
            }
        }
    };

    return SessionBase;
}]);

'use strict';

angular.module('secureNgResource')
.factory('sessionDictionary', [
function () {
    return {};
}]);

}(window));