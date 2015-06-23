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

        loggedIn: function () {
            // TODO Check for timeout
            return !!(this.state && this.state.user);
        },

        login: function (credentials) {
            var me = this;
            return this.auth.checkLogin(credentials).then(function(result) {
                var tgt = me.settings.defaultPostLoginPath;
                var priorIdleUser = me.state.priorIdleUser;
                if (me.state.priorUrl) {
                    tgt = me.state.priorUrl;
                }

                me.state = result.newState;
                // FIXME This is silly
                if (!('user' in me.state)) {
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
            }

            // FIXME Do something about failure, maybe retry soonish
            var me = this;
            return this.auth.refreshLogin(this.state).then(function(result) {
                var origUser = me.state.user;
                me.state = result.newState;
                // FIXME This is silly
                if (!('user' in me.state)) {
                    me.state.user = origUser;
                }
                me._onStateChange();
            });
        },

        logout: function () {
            if (!this.loggedIn()) {
                return;
            }

            if (this.settings.logoutUrl !== null) {
                // FIXME Can't depend on $http directly, causes a false
                // alarm for circular dependency :-(
                var http = $injector.get('$http');
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
