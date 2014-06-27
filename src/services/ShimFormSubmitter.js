'use strict';

angular.module('secureNgResource')
.service('shimFormSubmitter', [
'$document',
function($document) {
    this.submit = function(url, fields) {
        var form = '';
        form += '<form style="display: none" id="shimform" method="post" action="' + url + '">';
        angular.forEach(fields, function(value, key) {
            form += '<input type="hidden" ';
            form += 'name="' + encodeURIComponent(key) + '" ';
            form += 'value="' + encodeURIComponent(value) + '" />';
        });
        form += '</form>';
        $document.write(form);
        $document.getElementById('shimform').submit();
    };
}]);
