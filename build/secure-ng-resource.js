/***********************************************
* secure-ng-resource JavaScript Library
* https://github.com/AmericanCouncils/secure-ng-resource/ 
* License: MIT (http://www.opensource.org/licenses/mit-license.php)
* Compiled At: 02/14/2017 14:49
***********************************************/
(function(window) {
'use strict';
angular.module('secureNgResource', [
    'ngResource'
]);

'use strict';

angular.module('secureNgResource')
.factory('authSession', [
'$q', '$location', '$injector', '$rootScope', '$timeout',
function($q, $location, $injector, $rootScope, $timeout) {
    var DEFAULT_SETTINGS = {
        sessionName: 'angular',
        loginPath: '/login',
        logoutUrl: null,
        defaultPostLoginPath: '/'
    };

    var sessionDictionary = {};

    function AuthSession(auth, settings) {
        this.auth = auth;
        this.settings = angular.extend(
            {},
            DEFAULT_SETTINGS,
            settings
        );

        this.state = {};
        this.managedHttpConfs = [];
        this.refreshPromise = null;

        sessionDictionary[this.storageKey()] = this;

        var me = this;
        localforage.getItem(this.storageKey())
        .then(function(storedState) {
            if (storedState) {
                me.state = storedState;
                me._onStateChange();
            } else {
                me.reset();
            }
        });
    }

    AuthSession.prototype = {
        getUserName: function () {
            if (this.loggedIn()) {
                return this.state.user;
            }
        },

        getUserId: function () {
            if (this.loggedIn()) {
                return this.state.userId;
            }
        },

        loggedIn: function () {return !!(this.state && this.state.user);
        },

        login: function (credentials) {
            var me = this;
            return this.auth.checkLogin(credentials).then(function(result) {
                var tgt = me.settings.defaultPostLoginPath;
                var priorIdleUser = me.state.priorIdleUser;
                if (me.state.priorUrl) {
                    tgt = me.state.priorUrl;
                }

                me.state = result.newState;if (!('user' in me.state)) {
                    me.state.user = credentials.user;
                }

                if (priorIdleUser) {
                    if (me.state.user !== priorIdleUser) {
                        tgt = me.settings.defaultPostLoginPath;
                    }
                }

                me._onStateChange();

                $location.url(tgt).replace();
            });
        },

        cancelLogin: function () {
            this.auth.cancelLogin();
        },

        refreshLogin: function () {
            if (!this.loggedIn()) {
                throw 'Cannot refresh, not logged in.';
            }var me = this;
            return this.auth.refreshLogin(this.state).then(function(result) {
                var origUser = me.state.user;
                me.state = result.newState;if (!('user' in me.state)) {
                    me.state.user = origUser;
                }
                me._onStateChange();
            });
        },

        logout: function () {
            if (!this.loggedIn()) {
                return;
            }

            if (this.settings.logoutUrl !== null) {var http = $injector.get('$http');
                var httpConf = {
                    method: 'POST',
                    data: '',
                    url: this.settings.logoutUrl
                };
                this.updateRequestConf(httpConf);
                http(httpConf);
            }
            this.reset();
            this.goToLoginPage();
        },

        idleLogout: function () {
            if (!this.loggedIn()) {
                return;
            }

            var origUrl = $location.url();
            var origUser = this.getUserName();

            this.logout();

            if (origUser) {
                this.state.priorUrl = origUrl;
                this.state.priorIdleUser = origUser;
                this._onStateChange();
            }
        },

        reset: function () {
            this.state = {};
            this._onStateChange();
        },

        storageKey: function () {
            return this.settings.sessionName + '-' + this.auth.getAuthType();
        },

        updateRequestConf: function(httpConf) {
            httpConf.sessionDictKey = this.storageKey();
            if (this.loggedIn()) {
                if (!httpConf.headers) { httpConf.headers = {}; }
                this.auth.addAuthToRequestConf(httpConf, this.state);
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
                var priorPriorUrl = this.state.priorUrl;
                this.reset();
                if ($location.url() !== this.settings.loginPath) {
                    this.state.priorUrl = $location.url();
                } else {
                    this.state.priorUrl = priorPriorUrl;
                }
                this._onStateChange();
                this.goToLoginPage();
                return $q.reject(response);
            } else {
                return response;
            }
        },

        goToLoginPage: function() {
            $location.url(this.settings.loginPath);
        },

        _onStateChange: function() {
            this.reupdateManagedRequestConfs();

            localforage.setItem(this.storageKey(), this.state);

            if (this.refreshPromise !== null) {
                $timeout.cancel(this.refreshPromise);
                this.refreshPromise = null;
            }

            if (this.state.millisecondsToRefresh) {
                var me = this;
                this.refreshPromise = $timeout(
                    function() { me.refreshLogin(); },
                    this.state.millisecondsToRefresh
                );
            }
        }
    };

    var AuthSessionFactory = function(auth, settings) {
        var as = new AuthSession(auth, settings);
        return as;
    };
    AuthSessionFactory.dictionary = sessionDictionary;
    return AuthSessionFactory;
}]);

'use strict';

angular.module('secureNgResource')
.factory('mockAuth', [
'$q',
function($q) {
    var MockAuth = function() {};

    var guessUser = function(credentials) {
        if (credentials.user) {
            return credentials.user;
        }

        if (credentials['openid_identifier']) {
            var oid = credentials['openid_identifier'];
            var re = /^(?:[a-z]+:\/\/)?([^\/]+).*?([^\/]*)$/;
            var match = re.exec(oid);
            if (match) {
                var user = match[2] || 'john.doe';
                var domain = match[1];
                return user + '@' + domain;
            }
        }

        return 'john.doe@example.com';
    };

    MockAuth.prototype = {
        getAuthType: function () {
            return 'MockAuth';
        },

        checkLogin: function (credentials) {
            var deferred = $q.defer();
            if (
                String(credentials.pass).indexOf('fail') > -1 ||
                String(credentials['openid_identifier']).indexOf('fail') > -1
            ) {
                deferred.reject({status: 'denied'});
            } else {
                deferred.resolve({
                    status: 'accepted',
                    newState: {
                        user: guessUser(credentials)
                    }
                });
            }

            return deferred.promise;
        },

        cancelLogin: function() { },

        refreshLogin: function(state) {
            var deferred = $q.defer();
            deferred.resolve({
                status: 'accepted',
                newState: state
            });
            return deferred.promise;
        },

        checkResponse: function (response) {
            var authResult = {};
            if (response.status === 401) {
                authResult.authFailure = true;
            }
            return authResult;
        },

        addAuthToRequestConf: function (httpConf, state) {
            httpConf.headers.Authorization = 'Mock ' + state.user;
        }
    };

    var MockAuthFactory = function() {
        return new MockAuth();
    };
    return MockAuthFactory;
}]);

'use strict';

angular.module('secureNgResource')
.factory('passwordJWTAuth', [
'$http', '$q',
function($http, $q) {
    var PasswordJWTAuth = function (authUrl, options) {
        this.authUrl = authUrl;

        options = options || {};
        this.refreshUrl = options.refreshUrl;
    };

    var newStateFromJWT = function (jwt_raw) {
        var jwt = jwt_decode(jwt_raw);
        var ms_to_expiration = jwt.exp*1000 - Date.now();
        return {
            jwt: jwt_raw,
            userId: jwt.sub,
            millisecondsToRefresh: ms_to_expiration/2
        };
    };

    PasswordJWTAuth.prototype = {
        getAuthType: function () {
            return 'PasswordJWTAuth';
        },

        checkLogin: function (credentials) {
            var deferred = $q.defer();
            var handleResponse = function (response) {
                if (response.status === 200 || response.status === 201) {
                    deferred.resolve({
                        status: 'accepted',
                        newState: newStateFromJWT(response.data['jwt'])
                    });
                } else {
                    var errMsg;
                    if (response.status === 404) {
                        errMsg = 'Invalid user or password';
                    } else {
                        errMsg = response.data['error'] || 'Server error';
                    }
                    deferred.reject({
                        status: 'denied',
                        msg: errMsg
                    });
                }
            };

            $http({
                method: 'POST',
                url: this.authUrl,
                headers: {'Content-Type': 'application/json'},
                data: JSON.stringify({
                    'auth': {
                        'email': credentials.user,
                        'password': credentials.pass
                    }
                })
            }).then(handleResponse, handleResponse);
            return deferred.promise;
        },

        cancelLogin: function () {},refreshLogin: function(state) {
            var deferred = $q.defer();
            var handleResponse = function (response) {
                if (response.status === 200) {
                    deferred.resolve({
                        status: 'accepted',
                        newState: newStateFromJWT(response.data['jwt'])
                    });
                } else {
                    deferred.reject();
                }
            };

            $http({
                method: 'POST',
                url: this.refreshUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + state.jwt
                }
            }).then(handleResponse, handleResponse);
            return deferred.promise;
        },

        checkResponse: function (response) {
            var authResult = {};
            if (response.status === 401) {
                authResult.authFailure = true;
            }
            return authResult;
        },

        addAuthToRequestConf: function (httpConf, state) {
            httpConf.headers.Authorization = 'Bearer ' + state.jwt;
        }
    };

    var PasswordJWTAuthFactory = function(authUrl, options) {
        return new PasswordJWTAuth(authUrl, options);
    };
    return PasswordJWTAuthFactory;
}]);

'use strict';

angular.module('secureNgResource')
.factory('passwordOAuth', [
'$http', '$q',
function($http, $q) {
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

    var handleTokenResponse = function (response) {
        if (
        response.status === 200 &&
        angular.isString(response.data['access_token'])
        ) {
            var d = response.data;
            return {
                status: 'accepted',
                newState: {
                    accessToken: d['access_token'],
                    accessTokenExpires:
                        new Date().getTime() + d['expires_in'],
                    millisecondsToRefresh:
                        d['expires_in']*1000/2,refreshToken: d['refresh_token']
                }
            };
        } else if (
        response.status === 400 &&
        response.data.error === 'invalid_grant'
        ) {
            return {
                status: 'denied',
                msg: 'Invalid username or password'
            };
        } else {
            var msg = 'HTTP Status ' + response.status;
            if (response.status === 0) {
                msg = 'Unable to connect to authentication server';
            } else if (response.data['error_description']) {
                msg = 'OAuth:' + response.data['error_description'];
            }
            return {
                status: 'error',
                msg: msg
            };
        }
    };

    PasswordOAuth.prototype = {
        getAuthType: function () {
            return 'PasswordOAuth';
        },

        checkLogin: function (credentials) {
            var deferred = $q.defer();
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
            }).then(function (response) {
                var r = handleTokenResponse(response);
                if (r.status === 'accepted') {
                    deferred.resolve(r);
                } else {
                    deferred.reject(r);
                }
            }, function (errResponse) {
                deferred.reject(handleTokenResponse(errResponse));
            });
            return deferred.promise;
        },

        cancelLogin: function () {},refreshLogin: function(state) {
            var deferred = $q.defer();
            $http({
                method: 'POST',
                url: this.host + '/oauth/v2/token',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                data: encodeURIForm({
                    'client_id': this.clientId,
                    'client_secret': this.clientSecret,
                    'grant_type': 'refresh_token',
                    'refresh_token': state.refreshToken
                })
            }).then(function (response) {
                var r = handleTokenResponse(response);
                if (r.status === 'accepted') {
                    if (!r.newState.refreshToken) {
                        r.newState.refreshToken = state.refreshToken;
                    }
                    deferred.resolve(r);
                } else {
                    deferred.reject(r);
                }
            }, function (errResponse) {
                deferred.reject(handleTokenResponse(errResponse));
            });
            return deferred.promise;
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

    return function(session, url, paramDefaults, actions) {
        var fullActions = angular.extend({}, DEFAULT_ACTIONS, actions);
        angular.forEach(fullActions, function(httpConf) {
            session.manageRequestConf(httpConf);
        });url = url.replace(/^([^\/].+?)(:\d+\/)/g, '$1\\$2');
        var res = $resource(url, paramDefaults, fullActions);

        return res;
    };
}]);

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

}(window));