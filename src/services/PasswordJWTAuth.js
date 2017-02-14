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
            $http({
                method: 'POST',
                url: this.authUrl,
                headers: {'Content-Type': 'application/json'},
                data: JSON.stringify({
                    'username': credentials.user,
                    'password': credentials.pass
                })
            }).then(function (response) {
                if (response.status === 200) {
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
            });
            return deferred.promise;
        },

        cancelLogin: function () {}, // TODO Cancel any current HTTP request

        refreshLogin: function(state) {
            var deferred = $q.defer();
            $http({
                method: 'POST',
                url: this.refreshUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + state.jwt
                }
            }).then(function (response) {
                if (response.status === 200) {
                    deferred.resolve({
                        status: 'accepted',
                        newState: newStateFromJWT(response.data['jwt'])
                    });
                } else {
                    deferred.reject();
                }
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
            httpConf.headers.Authorization = 'Bearer ' + state.jwt;
        }
    };

    var PasswordJWTAuthFactory = function(authUrl, options) {
        return new PasswordJWTAuth(authUrl, options);
    };
    return PasswordJWTAuthFactory;
}]);