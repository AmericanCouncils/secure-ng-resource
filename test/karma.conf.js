module.exports = function(config) {
    config.set({
        basePath: '..',

        frameworks: ['jasmine'],

        files: [
            'node_modules/phantomjs-polyfill/bind-polyfill.js',
            'bower_components/angular/angular.js',
            'bower_components/angular-cookies/angular-cookies.js',
            'bower_components/angular-resource/angular-resource.js',
            'bower_components/angular-mocks/angular-mocks.js',
            'bower_components/base-64/base64.js',
            'build/secure-ng-resource.debug.js',
            'test/unit/*Spec.js'
        ],

        // // level of logging
        // // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
        logLevel: config.LOG_INFO,

        // // enable / disable colors in the output (reporters and logs)
        colors: true,

        // // Start these browsers, currently available:
        // // - Chrome
        // // - ChromeCanary
        // // - Firefox
        // // - Opera
        // // - Safari
        // // - PhantomJS
        browsers: ['PhantomJS'],

        // // Continuous Integration mode
        // // if true, it capture browsers, run tests and exit
        singleRun: true,

        plugins: [
            'karma-jasmine',
            'karma-phantomjs-launcher'
        ]
    })
}
