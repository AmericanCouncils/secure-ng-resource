files = [
    JASMINE,
    JASMINE_ADAPTER,
    '../bower_components/angular/angular.js',
    '../bower_components/angular-cookies/angular-cookies.js',
    '../bower_components/angular-resource/angular-resource.js',
    '../bower_components/angular-mocks/angular-mocks.js',
    '../build/secure-ng-resource.debug.js',
    'unit/*Spec.js'
];

// // level of logging
// // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
logLevel = LOG_INFO;

// // enable / disable colors in the output (reporters and logs)
colors = true;

// // Start these browsers, currently available:
// // - Chrome
// // - ChromeCanary
// // - Firefox
// // - Opera
// // - Safari
// // - PhantomJS
browsers = ['PhantomJS'];

// // Continuous Integration mode
// // if true, it capture browsers, run tests and exit
singleRun = true;
