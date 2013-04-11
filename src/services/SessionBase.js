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

        loggedIn: function () {
            // TODO Check for timeout
            return !_.isNull(this.state);
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
