'use strict';

angular.module('secureNgResource')
.factory('mockAuth', [
'$q',
function($q) {
    var MockAuth = function() {};

    var guessUser = function(credentials) {
        if (credentials.user) {
            return credentials.user;
        }

        if (credentials['openid_identifier']) {
            var oid = credentials['openid_identifier'];
            var re = /^(?:[a-z]+:\/\/)?([^\/]+).*?([^\/]*)$/;
            var match = re.exec(oid);
            if (match) {
                var user = match[2] || 'john.doe';
                var domain = match[1];
                return user + '@' + domain;
            }
        }

        return 'john.doe@example.com';
    };

    MockAuth.prototype = {
        getAuthType: function () {
            return 'MockAuth';
        },

        checkLogin: function (credentials) {
            var deferred = $q.defer();
            if (
                String(credentials.pass).indexOf('fail') > -1 ||
                String(credentials['openid_identifier']).indexOf('fail') > -1
            ) {
                deferred.reject({status: 'denied'});
            } else {
                deferred.resolve({
                    status: 'accepted',
                    newState: {
                        user: guessUser(credentials)
                    }
                });
            }

            return deferred.promise;
        },

        cancelLogin: function() { },

        refreshLogin: function(state) {
            var deferred = $q.defer();
            deferred.resolve({
                status: 'accepted',
                newState: state
            });
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
            httpConf.headers.Authorization = 'Mock ' + state.user;
        }
    };

    var MockAuthFactory = function() {
        return new MockAuth();
    };
    return MockAuthFactory;
}]);
