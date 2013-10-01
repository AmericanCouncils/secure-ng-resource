'use strict';

// No-refresh OpenID approach based on Brian Ellin's:
// http://openid-demo.appspot.com/
// Which was based in turn on a post by Luke Shepard:
// http://www.sociallipstick.com/?p=86

angular.module('secureNgResource')
.factory('openIDAuth', [
'$q',
function($q) {
    var OpenIDAuth = function (authUrl) {
        this.authUrl = authUrl;
    };

    OpenIDAuth.prototype = {
        getAuthType: function () {
            return 'OpenIDAuth';
        },

        checkLogin: function (credentials) {
            var deferred = $q.defer();

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
                ' action="' + this.authUrl + '">' +
                '<input type="hidden" name="openid_identifier" id="oid" />' +
                '</form>'
            );
            var oid = credentials['openid_identifier'];
            popup.document.getElementById('oid').value = oid;
            popup.document.getElementById('shimform').submit();
            window.openIdPopup = popup;

            return deferred.promise;
        },

        cancelLogin: function() {
            if (window.hasOwnProperty('openIdPopup')) {
                window.openIdPopup.close();

                delete window.openIdPopup;
                delete window.handleAuthResponse;
            }
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

    var OpenIDAuthFactory = function(authUrl) {
        return new OpenIDAuth(authUrl);
    };
    return OpenIDAuthFactory;
}]);
