'use strict';

// No-refresh OpenID approach based on Brian Ellin's:
// http://openid-demo.appspot.com/
// Which was based in turn on a post by Luke Shepard:
// http://www.sociallipstick.com/?p=86

angular.module('secureNgResource')
.factory('openIDAuth', [
'$q',
function($q) {
    var loginModes = {
        // ###
        // ### Pop-up login window mode
        // ###
        popup: {
            begin: function(credentials, authUrl, deferred) {
                var cleanUp = function() {
                    delete window.handleAuthResponse;
                    delete window.openIdPopup;
                };

                // TODO: Supply the receiver handler ourselves instead of relying
                // on the auth server to provide a page that calls
                // window.opener.handleAuthResponse. Somehow...
                // TODO: Deal with cross-frame cross-origin problems
                // TODO: Test on IE
                window.handleAuthResponse = function(d) {
                    cleanUp();

                    if (d.approved) {
                        deferred.resolve({
                            status: 'accepted',
                            newState: {
                                sessionId: d.sessionId,
                                user: d.user || undefined
                            }
                        });
                    } else {
                        deferred.reject({
                            status: 'denied',
                            msg: d.message || 'Access denied'
                        });
                    }
                };

                if (window.hasOwnProperty('openIdPopup') && !window.openIdPopup.closed) {
                    window.openIdPopup.close();
                    cleanUp();
                }

                if (typeof credentials.query === 'object') {
                    authUrl += '?';
                    var first = true;
                    angular.forEach(credentials.query, function(value, key) {
                        if (first) {
                            first = false;
                        } else {
                            authUrl += '&';
                        }
                        authUrl += encodeURIComponent(key);
                        authUrl += '=';
                        authUrl += encodeURIComponent(value);
                    });
                }

                var opts = 'width=450,height=500,location=1,status=1,resizable=yes';
                var popup = window.open('', 'openid_popup', opts);
                popup.onclose = function() { cleanUp(); };
                popup.onbeforeunload = function() { cleanUp(); };
                popup.document.write(
                    '<form id="shimform"' +
                    ' method="post"' +
                    ' action="' + authUrl + '">' +
                    '<input type="hidden" name="openid_identifier" id="oid" />' +
                    '</form>'
                );
                popup.document.getElementById('oid').value =
                    credentials['openid_identifier'];
                popup.document.getElementById('shimform').submit();
                window.openIdPopup = popup;
            },
            cancel: function() {
                if (window.hasOwnProperty('openIdPopup')) {
                    window.openIdPopup.close();
                    delete window.openIdPopup;
                    delete window.handleAuthResponse;
                }
            }
        }
    };

    var OpenIDAuth = function (authUrl, loginMode) {
        this.authUrl = authUrl;
        this.login = loginModes[loginMode];
        if (!this.login) {
            throw 'Invalid login mode';
        }
    };

    OpenIDAuth.prototype = {
        getAuthType: function () {
            return 'OpenIDAuth';
        },

        checkLogin: function (credentials) {
            var deferred = $q.defer();
            this.login.begin(credentials, this.authUrl, deferred);
            // TODO: Maybe need to not return a new promise if the begin call returned early due
            // to login dialog already being open.
            return deferred.promise;
        },

        cancelLogin: function() {
            loginModes.popup.cancel();
        },

        refreshLogin: function(/*state*/) {
            // Currently this just does nothing, OpenID doesn't have explicit timeouts.
            // TODO: Maybe should do a no-op http request to keep session fresh?
            // TODO: Or maybe at least return a positive result.
            var deferred = $q.defer();
            deferred.reject();
            return deferred.promise;
        },

        checkResponse: function (response) {
            var authResult = {};
            if (response.status === 401 || response.status === 403) {
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
