# secure-ng-resource
# Authenticated access to RESTful web APIs

## Usage

After you've downloaded the secure-ng-resource component with bower, add the
usual lines in app.js (to `secureNgResource`) and index.html (to
`components/secure-ng-resource/build/secure-ng-resource.js`).

Suppose you are writing an Angular app that is backed by a RESTful web
service available at `https://example.com/`. Its authentication is based on the [OAuth Resource Owner
Password Flow](http://techblog.hybris.com/2012/06/11/oauth2-resource-owner-password-flow/),
at the same host. You describe this auth system by creating a session
service for your application:
```js
// app/scripts/services/appSession.js

angular.module('myApp').factory('appSession', [
'session', 'passwordOAuth', // These are from secureNgResource
function(session, passwordOAuth) {
    return session(
        "https://example.com", // Host which has API
        passwordOAuth(
            "https://example.com", // Host which provides the OAuth tokens
            "1_myappmyappmyapp", // OAuth Client ID
            "shhhhhhhhhhhhhhhh" // OAuth Client Secret
        )
    );
]);

```

```js
// app/scripts/controllers/things.js

angular.module('myApp').controller('ThingsCtrl', [
'$scope', 'secureResource', 'appSession'
]);

```

## Credits

Project directory structure and build/test configs based on those found in
[ng-grid](https://github.com/angular-ui/ng-grid).
