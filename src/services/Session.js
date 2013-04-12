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

        loggedIn: function () {
            // TODO Check for timeout
            return this.state !== null;
        },

        login: function (credentials, callbacks) {
            var me = this;
            var handler = function(result) {
                if (angular.isObject(callbacks) && callbacks[result.status]) {
                    callbacks[result.status](result);
                }

                if (result.status === 'accepted') {
                    me.state = result.newState;
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
            $cookieStore.remove(this.cookieKey());
        },

        cookieKey: function () {
            return this.settings.sessionName + '-' +
                encodeURIComponent(this.host);
        },

        updateRequest: function(httpConf) {
            if (this.loggedIn()) {
                if (!httpConf.headers) { httpConf.headers = {}; }
                this.auth.addAuthToRequest(httpConf, this.state);
            }
            httpConf.sessionDictKey = this.cookieKey();
        },

        handleHttpFailure: function(response) {
            if (this.auth.isAuthFailure(response)) {
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
