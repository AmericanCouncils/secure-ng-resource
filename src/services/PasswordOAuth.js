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
                        d['expires_in']*1000/2, // Refresh at halfway point
                    refreshToken: d['refresh_token']
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

        cancelLogin: function () {}, // TODO Cancel any current HTTP request

        refreshLogin: function(state) {
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

        checkResponse: function (response) {
            // and have the session update the request configs
            var authResult = {};
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
