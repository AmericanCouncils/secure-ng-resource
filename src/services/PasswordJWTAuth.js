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

    PasswordJWTAuth.prototype = {
        getAuthType: function () {
            return 'PasswordJWTAuth';
        },

        checkLogin: function (credentials) {
            var deferred = $q.defer();
            var me = this;
            var handleResponse = function (response) {
                if (response.status === 200 || response.status === 201) {
                    deferred.resolve({
                        status: 'accepted',
                        newState: me._newStateFromJWT(response.data['jwt'])
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

        cancelLogin: function () {}, // TODO Cancel any current HTTP request

        refreshLogin: function(state) {
            var deferred = $q.defer();
            var me = this;
            var handleResponse = function (response) {
                if (response.status === 200 || response.status === 201) {
                    deferred.resolve({
                        status: 'accepted',
                        newState: me._newStateFromJWT(response.data['jwt'])
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
        },

        _newStateFromJWT: function (jwt_raw) {
            var jwt = jwt_decode(jwt_raw);
            var newState = {
                jwt: jwt_raw,
                userId: jwt.sub
            };
            if (this.refreshUrl) {
                newState['millisecondsToRefresh'] = 1000*60*15; //  15 minutes
            }
            return newState;
        }
    };

    var PasswordJWTAuthFactory = function(authUrl, options) {
        return new PasswordJWTAuth(authUrl, options);
    };
    return PasswordJWTAuthFactory;
}]);
