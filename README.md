# secure-ng-resource
# Authenticated access to RESTful web APIs

## Usage

After you've downloaded the secure-ng-resource component with bower, add the
usual lines in app.js (to `secureNgResource`) and index.html (to
`components/secure-ng-resource/build/secure-ng-resource.js`).

Suppose you are writing an Angular app that is backed by a RESTful web
service available at `https://example.com/`. Its authentication is based on the
[OAuth Resource Owner Password Flow](http://techblog.hybris.com/2012/06/11/oauth2-resource-owner-password-flow/),
at the same host. You describe this auth system by creating a session
service for your application:
```js
// app/scripts/services/appSession.js

angular.module('myApp').factory('appSession', [
'authSession', 'passwordOAuth', // These are from secureNgResource
function(authSession, passwordOAuth) {
    return authSession(passwordOAuth(
        "https://example.com", // Host which provides the OAuth tokens
        "1_myappmyappmyapp", // OAuth Client ID
        "shhhhhhhhhhhhhhhh" // OAuth Client Secret
    ));
]);
```

You can use this session with secureResource, which is just a wrapper around
[ngResource](http://docs.angularjs.org/api/ngResource.$resource):
```js
// app/scripts/controllers/things.js

angular.module('myApp').controller('ThingsCtrl', [
'$scope', 'secureResource', 'appSession',
function($scope, secureResource, appSession) {
    var Thing = secureResource(
        appSession,
        'https://example.com/thing/:thingId'
    );

    $scope.things = Thing.query();
}]);
```
When `Thing.query()` executes, SecureResource will add the appropriate
authorization to the request. If the request is refused, then the user
is redirected to your login page (by default at `/login`).

Your login controller should work like this:
```js
// app/scripts/controllers/login.js

angular.module('myApp').controller('LoginCtrl', [
'$scope', 'appSession',
function($scope, appSession) {
    $scope.credentials = {
        user: null, // Attach your login username element to this
        pass: null  // And your password element to this
    };

    $scope.alertMessage = "";

    // Have your "Log In" button call this
    $scope.login = function () {
        if (!$scope.loginForm.$valid) { return; }

        $scope.alertMessage = "Signing in...";
        appSession.login(creds, {
            denied: function(result) {
                $scope.alertMessage = "Login failed: " + result.msg;
            },
            error: function(result) {
                $scope.alertMessage = "Something went wrong: " + result.msg;
            }
        });
    };
}]);
```

You don't have to worry about redirecting the user after they successfully
log in, the `appSession.login` function will take care of that. If the user
was at another internal route and got kicked over to the login page by an
auth failure, then they will be sent back there. If they went directly to
the login page, then after logging in they will be directed to the `/`
internal route by default.

## Credits

Project directory structure and build/test configs based on those found in
[ng-grid](https://github.com/angular-ui/ng-grid).
