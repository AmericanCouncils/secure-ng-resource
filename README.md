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

## Using OpenID

The OpenID system requires more specific behavior from the back-end server
than the OAuth system. When creating the OpenID auth instance, you supply
a `host` which is typically your server, and a `beginPath` at that host.

The login process goes like so:

1. The user supplies an OpenID identifier as their credentials. You
   should pass this identifier URL to AuthSession.login() in an object
   under the key 'openid_identifier'.

2. Secure-ng-resource sends a POST request via AJAX to `beginPath` with
   a JSON object with the following keys:

   * openid_identifier: The URL of the identity provider to be discovered
   * key: A random byte string, base64 encoded.
   * target_url: The final URL to return the authentication information to,
             generally this is the URL for the angular app's login page.

   The server should perform discovery on the identifier URL and respond
   with the following JSON:

   * redirect_url: The URL of the OpenID login page at the provider. The
                   return URL here should actually be a route handled
                   by the server, so it can do the additional processing
                   required by step #4 below.

3. The client will then send the user to the given redirect_url to log in.

4. When authentication completes, the server will get the response from
   the OpenID server. It should then redirect to the original target 
   URL from step #2, with the following JSON structure base64 encoded as
   the GET argument `oid_resp`:

   * approved: A boolean indicating whether authentication was accepted
   * sessionId: (If approved) An authentication token, XOR'd against the key
   * message: (Optional) An explanation of what happened during authentication

5. Assuming access was allowed, then from that point forward any
   requests that go through secureNgResource using this
   authentication session will include an `Authorization` header of the
   form `SesID 123ABC` where `123ABC` is the sessionId from the response
   object. Note that cookies are *not* used in these requests; this helps
   to prevent XSS attacks.

In order to support step #3 of this process, your login controller should check
for the `oid_resp` value and pass it to the `login` method if it's present:

```js
if ($location.search().oid_resp) {
    appSession.login({oid_resp: $location.search().oid_resp});
}
```

## Credits

Project directory structure and build/test configs based on those found in
[ng-grid](https://github.com/angular-ui/ng-grid).
