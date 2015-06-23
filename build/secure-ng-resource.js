/***********************************************
* secure-ng-resource JavaScript Library
* https://github.com/AmericanCouncils/secure-ng-resource/ 
* License: MIT (http://www.opensource.org/licenses/mit-license.php)
* Compiled At: 06/23/2015 10:04
***********************************************/
(function(window) {
'use strict';
angular.module('secureNgResource', [
    'ngResource',
    'ngCookies'
]);

'use strict';

angular.module('secureNgResource')
.factory('authSession', [
'$q', '$location', '$cookieStore', '$injector', '$rootScope', '$timeout',
function($q, $location, $cookieStore, $injector, $rootScope, $timeout) {
    var DEFAULT_SETTINGS = {
        sessionName: 'angular',
        loginPath: '/login',
        logoutUrl: null,
        defaultPostLoginPath: '/',
        useCookies: true
    };

    var sessionDictionary = {};

    var AuthSession = function (auth, settings) {
        this.auth = auth;
        this.settings = angular.extend(
            {},
            DEFAULT_SETTINGS,
            settings
        );

        this.state = {};
        this.managedHttpConfs = [];
        this.refreshPromise = null;

        sessionDictionary[this.cookieKey()] = this;

        if (this.settings.useCookies) {
            var cookie = $cookieStore.get(this.cookieKey());
            if (cookie) {
                this.state = cookie;
                this._onStateChange();
            } else {
                this.reset();
            }
        } else {
            this.reset();
        }
    };

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

        cookieKey: function () {
            return this.settings.sessionName + '-' + this.auth.getAuthType();
        },

        updateRequestConf: function(httpConf) {
            httpConf.sessionDictKey = this.cookieKey();
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

            if (this.settings.useCookies) {
                $cookieStore.put(this.cookieKey(), this.state);
            }

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
        return new AuthSession(auth, settings);
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
.factory('openIDAuth', [
'$q', '$rootScope', '$cookieStore', '$http', 'shimFormSubmitter', 'simpleCrypt', '$location',
function($q, $rootScope, $cookieStore, $http, shimFormSubmitter, simpleCrypt, $location) {
    var OpenIDAuth = function (authUrl, options) {
        this.authUrl = authUrl;

        options = options || {};
        this.refreshUrl = options.refreshUrl;
        this.refreshTime = options.refreshTime;
    };

    OpenIDAuth.prototype = {
        getAuthType: function () {
            return 'OpenIDAuth';
        },

        checkLogin: function (credentials) {
            var deferred = $q.defer();

            if (credentials.openid_identifier) {var newKey = simpleCrypt.generateKey();
                $cookieStore.put('login-key', {key: newKey});
                shimFormSubmitter.submit(this.authUrl, {
                    openid_identifier: credentials.openid_identifier,
                    key: newKey,
                    target_url: $location.absUrl()
                });
            } else if (credentials.auth_resp) {var keyData = $cookieStore.get('login-key');
                if (!keyData) {
                    deferred.reject({
                        status: 'error',
                        msg: 'Login failed, decryption key not found'
                    });
                } else {
                    var key = keyData.key;
                    var resp = JSON.parse(base64.decode(credentials.auth_resp));
                    $cookieStore.remove('login-key');
                    if (resp.approved) {
                        var sesId = base64.decode(resp.sessionId);
                        var newState = {
                            sessionId: simpleCrypt.apply(sesId, key),
                            user: resp.user
                        };
                        if (resp.userId) {
                            newState.userId = resp.userId;
                        }
                        if (this.refreshTime) {
                            newState.millisecondsToRefresh = this.refreshTime;
                        }
                        deferred.resolve({
                            status: 'accepted',
                            newState: newState
                        });
                    } else {
                        deferred.reject({
                            status: 'denied',
                            msg: resp.message || 'Access Denied'
                        });
                    }
                }
            } else {
                throw 'Require openid_identifier in credentials';
            }

            return deferred.promise;
        },

        cancelLogin: function() {
            $cookieStore.remove('login-key');
        },

        refreshLogin: function(state) {
            if (this.refreshUrl) {
                var newState = angular.copy(state);
                var conf = { headers: {} };
                this.addAuthToRequestConf(conf, state);
                var result = $http.post(this.refreshUrl, '', conf);
                var me = this;
                return result.then(function() {if (me.refreshTime) {
                        newState.millisecondsToRefresh = me.refreshTime;
                    } else {
                        newState.millisecondsToRefresh = null;
                    }
                    return {newState: newState};
                });
            } else {
                var deferred = $q.defer();
                deferred.reject();
                return deferred.promise;
            }
        },

        checkResponse: function (response) {
            var authResult = {};
            if (response.status === 401) {
                authResult.authFailure = true;
            }
            return authResult;
        },

        addAuthToRequestConf: function (httpConf, state) {
            httpConf.headers.Authorization = 'SesID ' + state.sessionId;
        }
    };

    var OpenIDAuthFactory = function(authUrl, loginMode) {
        return new OpenIDAuth(authUrl, loginMode);
    };
    return OpenIDAuthFactory;
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
.factory('shimFormSubmitter', [
'$document',
function($document) {
    return {
        submit: function(url, fields) {
            var form = angular.element('<form></form>', {
                id: 'shimform',
                style: 'display: none',
                method: 'post',
                action: url
            });
            angular.forEach(fields, function(value, key) {
                form.prepend(angular.element('<input />', {
                    type: 'hidden',
                    name: key,
                    value: value
                }));
            });
            $document.find('body').append(form);

            document.getElementById('shimform').submit();
        }
    };
}]);

'use strict';

angular.module('secureNgResource')
.value('simpleCrypt', {
    generateKey: function() {
        var key = '';
        while (key.length < 64) {
            key += String.fromCharCode(Math.floor(Math.random() * 255));
        }
        return base64.encode(key);
    },

    apply: function(value, key) {
        key = base64.decode(key);
        var out = '';
        for (var i = 0; i < value.length; ++i) {
            if (i < key.length) {
                var chr = value.charCodeAt(i) ^ key.charCodeAt(i);out += String.fromCharCode(chr);
            } else {
                out += value.charAt(i);
            }
        }
        return out;
    }
});

'use strict';

angular.module('secureNgResource')
.config([
'$httpProvider',
function($httpProvider) {$httpProvider.responseInterceptors.push([
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

}(window));