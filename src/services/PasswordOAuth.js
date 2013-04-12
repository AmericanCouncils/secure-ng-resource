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

        addAuthToRequestConf: function (httpConf, state) {
            httpConf.headers.Authorization = 'Bearer ' + state.accessToken;
        },

        isAuthFailure: function (response) {
            return (response.status === 401);
        }
    };

    var PasswordOAuthFactory = function(host, clientId, clientSecret) {
        return new PasswordOAuth(host, clientId, clientSecret);
    };
    return PasswordOAuthFactory;
}]);
