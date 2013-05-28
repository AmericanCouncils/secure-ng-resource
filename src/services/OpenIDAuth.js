'use strict';

// No-refresh OpenID approach based on Brian Ellin's:
// http://openid-demo.appspot.com/
// Which was based in turn on a post by Luke Shepard:
// http://www.sociallipstick.com/?p=86

angular.module('secureNgResource')
.factory('openIDAuth', [
function() {
    var OpenIDAuth = function (host, beginPath) {
        this.host = host;
        this.beginPath = beginPath;
    };

    OpenIDAuth.prototype = {
        getAuthType: function () {
            return 'OpenIDAuth';
        },

        checkLogin: function (credentials, handler) {
            window.handleAuthResponse = function(d) {
                delete window.handleAuthResponse;
                delete window.openIdPopup;

                if (d.approved) {
                    handler({
                        status: 'accepted',
                        newState: {
                            user: d.user,
                            sessionId: d.sessionId
                        }
                    });
                } else {
                    handler({
                        status: 'denied',
                        msg: d.message || 'Access denied'
                    });
                }
            };

            if (_.has(window, 'openIdPopup')) {
                window.openIdPopup.focus();
                return;
            }

            var opts = 'width=450,height=500,location=1,status=1,resizable=yes';
            var popup = window.open('', 'openid_popup', opts);
            popup.document.write(
                '<form id="shimform"' +
                ' method="post"' +
                ' action="' + this.host + this.beginPath + '">' +
                '<input type="hidden" name="openid_identifier" id="oid" />' +
                '</form>'
            );
            var oid = credentials['openid_identifier'];
            popup.document.getElementById('oid').value = oid;
            popup.document.getElementById('shimform').submit();
            window.openIdPopup = popup;
        },

        cancelLogin: function() {
            if (_.has(window, 'openIdPopup')) {
                window.openIdPopup.close();

                delete window.openIdPopup;
                delete window.handleAuthResponse;
            }
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

    var OpenIDAuthFactory = function(host, beginPath) {
        return new OpenIDAuth(host, beginPath);
    };
    return OpenIDAuthFactory;
}]);
