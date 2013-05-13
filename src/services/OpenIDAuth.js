'use strict';

// No-refresh OpenID approach based on Brian Ellin's:
// http://openid-demo.appspot.com/
// Based in turn on a post by Luke Shepard:
// http://www.sociallipstick.com/?p=86

angular.module('secureNgResource')
.factory('openIDAuth', [
'$http',
function($http) {
    var OpenIDAuth = function (host, beginPath, cookieName) {
        this.host = host;
        this.beginPath = beginPath;
        this.cookieName = cookieName;
    };

    OpenIDAuth.prototype = {
        getAuthType: function () {
            return 'OpenIDAuth';
        },

        checkLogin: function (credentials, handler) {
            var me = this;
            window.handleAuthResponse = function(d) {
                console.log("AR")
                delete window.handleAuthResponse;

                if (d.approved) {
                    handler({
                        status: 'accepted',
                        newState: {
                            user: d.user,
                            cookieVal: d.cookieVal
                        }
                    });
                } else {
                    handler({
                        status: 'denied',
                        msg: d.message || 'Access denied'
                    });
                }
            };

            var url = this.host + this.beginPath + '?openid_identifier=' +
                encodeURIComponent(credentials['openid_identifier']);
            var opts = 'width=450,height=500,location=1,status=1,resizable=yes';
            window.open(url, 'openid_popup', opts);

            // TODO Error if popup closes before handleAuthResponse firing
        },

        checkResponse: function (response) {
            var authResult = {};
            if (response.status === 401 || response.status === 403) {
                authResult.authFailure = true;
            }
            return authResult;
        },

        addAuthToRequestConf: function (httpConf, state) {
            var cookie = this.cookieName + '=' +
                encodeURIComponent(state.cookieVal);
            if (httpConf.headers.Cookie) {
                httpConf.headers.Cookie += '; ' + cookie;
            } else {
                httpConf.headers.Cookie =  cookie;
            }
        }
    };

    var OpenIDAuthFactory = function(host, beginPath, cookieName) {
        return new OpenIDAuth(host, beginPath, cookieName);
    };
    return OpenIDAuthFactory;
}]);
