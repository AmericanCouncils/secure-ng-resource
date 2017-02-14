# secure-ng-resource

[![Build Status](https://travis-ci.org/AmericanCouncils/secure-ng-resource.png?branch=master)](https://travis-ci.org/AmericanCouncils/secure-ng-resource)

A wrapper around ngResource that adds authentication to requests, automatically
asking the user for credentials when needed. Currently supports OAuth password
flow, and OpenID verification with an Authorization header to pass the key.

The `ArrayBuffer` javascript type is required; for IE versions 9 and below,
you will need to provide a polyfill for it.

## Installation

After you've downloaded the secure-ng-resource component with bower, add the
usual lines in app.js (to `secureNgResource`) and index.html (to
`components/secure-ng-resource/build/secure-ng-resource.js`).

## Using OAuth password flow

Suppose you are writing an Angular app that is backed by a RESTful web
service available at `https://example.com/`. Its authentication is based on the
[OAuth Resource Owner Password Flow](http://techblog.hybris.com/2012/06/11/oauth2-resource-owner-password-flow/).
Configure your app to use this auth system in a session
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

Then you can use this session with secureResource, which is just a wrapper around
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
authorization to the request. If the request is refused (if the user hasn't
logged in yet, or if they logged in a long while ago and their access
token expired), then the user is redirected to your login page (by default
at `/login`) within your angular app's internal routing system.

Your login controller can interact with the session like so:
```js
// app/scripts/controllers/login.js

angular.module('myApp').controller('LoginCtrl', [
'$scope', 'appSession',
function($scope, appSession) {
    $scope.credentials = {
        user: null, // Attach your login username element to this
        pass: null  // And your password element to this
    };

    // Have your "Log In" button call this
    $scope.login = function () {
        if (!$scope.loginForm.$valid) { return; }
        appSession.login($scope.credentials)
        .then(null, function(result) {
            if (result.status == 'denied') {
                alert("Login failed: " + result.msg);
            } else {
                alert("Something went wrong: " + result.msg);
            }
        });
    };
}]);
```

You don't have to worry about redirecting the user after they successfully
log in, the `appSession.login` function will take care of that. If the user
was at another internal route and got kicked over to the login page by an
auth failure, then they will be sent back there. Otherwise they will be sent
to the `/` internal route by default.

## Using JWT

A simpler alternative to OAuth is JWT. Your server must have a URL that accepts
a POST request with a JSON body like so:
```js
{
    "username": "joe",
    "password": "coffee"
}
```

And returns a JSON response like so:
```js
{
    "jwt": "foobarblahblahblahencoded"
}
```

Then, you can use `'passwordJWTAuth'` instead of `'passwordOAuth'` above,
providing the token issue URL.

## Credits

Project directory structure and build/test configs based on those found in
[ng-grid](https://github.com/angular-ui/ng-grid).
