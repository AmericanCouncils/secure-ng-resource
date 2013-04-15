/***********************************************
* secure-ng-resource JavaScript Library
* https://github.com/davidmikesimon/secure-ng-resource/ 
* License: MIT (http://www.opensource.org/licenses/mit-license.php)
* Compiled At: 04/15/2013 09:46
***********************************************/
(function(window) {
'use strict';
angular.module('secureNgResource', [
    'ngResource',
    'ngCookies'
]);

'use strict';

angular.module('secureNgResource')
.factory('passwordOAuth', [
'$http',
function($http) {
    var PasswordOAuth = function (host, clientId, clientSecret) {
        this.host = host;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    };

    var encodeURIForm = function (params) {
        var s = '';
        angular.forEach(params, function(val, key) {
            if (s.length > 0) { s += '&'; }
            s += key + '=' + encodeURIComponent(val);
        });
        return s;
    };

    PasswordOAuth.prototype = {
        checkLogin: function (credentials, handler) {
            $http({
                method: 'POST',
                url: this.host + '/oauth/v2/token',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                data: encodeURIForm({
                    'client_id': this.clientId,
                    'client_secret': this.clientSecret,
                    'grant_type': 'password',
                    'username': credentials.user,
                    'password': credentials.pass
                })
            }).then(function(response) {
                if (
                response.status === 200 &&
                angular.isString(response.data['access_token'])
                ) {
                    var d = response.data;
                    handler({
                        status: 'accepted',
                        newState: {
                            user: credentials.user,
                            accessToken: d['access_token'],
                            accessTokenExpires:
                                new Date().getTime() + d['expires_in'],
                            refreshToken: d['refresh_token']
                        }
                    });
                } else if (
                response.status === 400 &&
                response.data.error === 'invalid_grant'
                ) {
                    handler({
                        status: 'denied',
                        msg: 'Invalid username or password'
                    });
                } else {
                    var msg = 'HTTP Status ' + response.status;
                    if (response.status === 0) {
                        msg = 'Unable to connect to authentication server';
                    } else if (response.data['error_description']) {
                        msg = 'OAuth:' + response.data['error_description'];
                    }
                    handler({
                        status: 'error',
                        msg: msg
                    });
                }
            });
        },

        checkResponse: function (response) {var authResult = {};
            if (response.status === 401) {
                authResult.authFailure = true;
            }
            return authResult;
        },

        addAuthToRequestConf: function (httpConf, state) {
            httpConf.headers.Authorization = 'Bearer ' + state.accessToken;
        }
    };

    var PasswordOAuthFactory = function(host, clientId, clientSecret) {
        return new PasswordOAuth(host, clientId, clientSecret);
    };
    return PasswordOAuthFactory;
}]);

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
        angular.forEach(fullActions, function(httpConf) {session.manageRequestConf(httpConf);
        });var host = session.getHost().replace(/(:\d+)$/g, '\\$1');
        var res = $resource(host + path, paramDefaults, fullActions);

        return res;
    };
}]);

'use strict';

angular.module('secureNgResource')
.factory('session', [
'$q', '$location', '$cookieStore',
function($q, $location, $cookieStore) {
    var DEFAULT_SETTINGS = {
        sessionName: 'angular',
        loginPath: '/login',
        defaultPostLoginPath: '/'
    };

    var sessionDictionary = {};

    var Session = function (host, auth, settings) {
        this.host = host;
        this.auth = auth;
        this.settings = angular.extend(
            {},
            DEFAULT_SETTINGS,
            settings
        );

        this.priorPath = null;
        this.state = null;
        this.managedHttpConfs = [];

        sessionDictionary[this.cookieKey()] = this;
        var cookie = $cookieStore.get(this.cookieKey());
        if (cookie) {
            this.state = cookie;
        } else {
            this.reset();
        }
    };
    Session.prototype = {
        getUserName: function () {
            if (this.loggedIn()) {
                return this.state.user;
            }
        },

        getHost: function () {
            return this.host;
        },

        loggedIn: function () {return this.state !== null;
        },

        login: function (credentials, callbacks) {
            var me = this;
            var handler = function(result) {
                if (angular.isObject(callbacks) && callbacks[result.status]) {
                    callbacks[result.status](result);
                }

                if (result.status === 'accepted') {
                    me.state = result.newState;
                    me.reupdateManagedRequestConfs();
                    $cookieStore.put(me.cookieKey(), me.state);
                    var tgt = me.settings.defaultPostLoginPath;
                    if (me.priorPath !== null) { tgt = me.priorPath; }
                    $location.path(tgt).replace();
                }
            };

            this.auth.checkLogin(credentials, handler);
        },

        logout: function () {
            if (this.loggedIn()) {
                this.reset();
                $location.path(this.settings.loginPath);
            }
        },

        reset: function () {
            this.state = null;
            this.reupdateManagedRequestConfs();
            $cookieStore.remove(this.cookieKey());
        },

        cookieKey: function () {
            return this.settings.sessionName + '-' +
                encodeURIComponent(this.host);
        },

        updateRequestConf: function(httpConf) {
            if (this.loggedIn()) {
                if (!httpConf.headers) { httpConf.headers = {}; }
                this.auth.addAuthToRequestConf(httpConf, this.state);
                httpConf.sessionDictKey = this.cookieKey();
            }
        },

        manageRequestConf: function(httpConf) {
            this.managedHttpConfs.push({
                conf: httpConf,
                original: angular.copy(httpConf)
            });
            this.updateRequestConf(httpConf);
        },

        reupdateManagedRequestConfs: function() {
            var me = this;
            angular.forEach(this.managedHttpConfs, function(o) {
                for (var key in o.conf) { delete o.conf[key]; }
                var originalConf = angular.copy(o.original);
                angular.extend(o.conf, originalConf);
                me.updateRequestConf(o.conf);
            });
        },

        handleHttpResponse: function(response) {
            var authResult = this.auth.checkResponse(response);
            if (authResult.authFailure) {
                this.reset();
                this.priorPath = $location.path();
                $location.path(this.settings.loginPath).replace();
                return $q.reject(response);
            } else {
                return response;
            }
        }
    };

    var SessionFactory = function(host, auth, settings) {
        return new Session(host, auth, settings);
    };
    SessionFactory.dictionary = sessionDictionary;
    return SessionFactory;
}]);

'use strict';

angular.module('secureNgResource')
.config([
'$httpProvider',
function($httpProvider) {$httpProvider.responseInterceptors.push([
    'session',
    function(session) {
        var responder = function (response) {var ses = session.dictionary[response.config.sessionDictKey];
            if (ses) {
                return ses.handleHttpResponse(response);
            } else {return response;
            }
        };

        return function(promise) {
            return promise.then(responder, responder);
        };
    }]);
}]);

}(window));