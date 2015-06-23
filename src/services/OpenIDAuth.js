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

            if (credentials.openid_identifier) {
                // Phase 1 : being redirected to identifier login page
                var newKey = simpleCrypt.generateKey();
                $cookieStore.put('login-key', {key: newKey});
                shimFormSubmitter.submit(this.authUrl, {
                    openid_identifier: credentials.openid_identifier,
                    key: newKey,
                    target_url: $location.absUrl()
                });
            } else if (credentials.auth_resp) {
                // Phase 2 : parsing authentication response from app server
                var keyData = $cookieStore.get('login-key');
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
                return result.then(function() {
                    // In case the configured refresh time changed since the state was
                    // originally created.
                    if (me.refreshTime) {
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
