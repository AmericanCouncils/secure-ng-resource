'use strict';

angular.module('secureNgResource')
.factory('openIDAuth', [
'$q', '$rootScope', '$cookieStore', 'shimFormSubmitter', 'simpleCrypt', '$location',
function($q, $rootScope, $cookieStore, shimFormSubmitter, simpleCrypt, $location) {
    var OpenIDAuth = function (authUrl) {
        this.authUrl = authUrl;
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
                        deferred.resolve({
                            status: 'accepted',
                            newState: {
                                sessionId: simpleCrypt.apply(sesId, key),
                                user: resp.user || undefined
                            }
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

        refreshLogin: function(/*state*/) {
            // Currently this just does nothing, our ad-hoc protocol doesn't have explicit timeouts.
            // TODO: Maybe should do a no-op http request to keep session fresh?
            // TODO: Or maybe at least return a positive result.
            var deferred = $q.defer();
            deferred.reject();
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
            httpConf.headers.Authorization = 'SesID ' + state.sessionId;
        }
    };

    var OpenIDAuthFactory = function(authUrl, loginMode) {
        return new OpenIDAuth(authUrl, loginMode);
    };
    return OpenIDAuthFactory;
}]);
