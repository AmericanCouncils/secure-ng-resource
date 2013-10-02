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
            begin: function(oid, authUrl, deferred) {
                // TODO: Supply the receiver handler ourselves instead of relying
                // on the auth server to provide a page that calls
                // window.opener.handleAuthResponse.
                // TODO: Deal with cross-frame cross-origin problems
                // TODO: Test on IE
                window.handleAuthResponse = function(d) {
                    delete window.handleAuthResponse;
                    delete window.openIdPopup;

                    if (d.approved) {
                        deferred.resolve({
                            status: 'accepted',
                            newState: {
                                sessionId: d.sessionId
                            }
                        });
                    } else {
                        deferred.reject({
                            status: 'denied',
                            msg: d.message || 'Access denied'
                        });
                    }
                };

                // TODO: Somehow make this only apply if the window is still open
                if (window.hasOwnProperty('openIdPopup')) {
                    if ('focus' in window.openIdPopup) {
                        window.openIdPopup.focus();
                    }
                    return;
                }

                var opts = 'width=450,height=500,location=1,status=1,resizable=yes';
                var popup = window.open('', 'openid_popup', opts);
                popup.document.write(
                    '<form id="shimform"' +
                    ' method="post"' +
                    ' action="' + authUrl + '">' +
                    '<input type="hidden" name="openid_identifier" id="oid" />' +
                    '</form>'
                );
                popup.document.getElementById('oid').value = oid;
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
            this.login.begin(credentials['openid_identifier'], this.authUrl, deferred);
            // TODO: Maybe need to not return a new promise if the begin call returned early due
            // to login dialog already being open.
            return deferred.promise;
        },

        cancelLogin: function() {
            loginModes.popup.cancel();
        },

        refreshLogin: function(/*state*/) {
            // Maybe should do a no-op http request to keep session fresh?
            var deferred = $q.defer();
            var p = deferred.promise;
            deferred.reject();
            return p;
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
