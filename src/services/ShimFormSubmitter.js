'use strict';

angular.module('secureNgResource')
.factory('shimFormSubmitter', [
'$document',
function($document) {
    return {
        submit: function(url, fields) {
            var form = angular.element('<form></form>', {
                id: 'shimform',
                style: 'display: none',
                method: 'post',
                action: url
            });
            angular.forEach(fields, function(value, key) {
                form.prepend(angular.element('<input />', {
                    type: 'hidden',
                    name: key,
                    value: value
                }));
            });
            $document.find('body').append(form);

            document.getElementById('shimform').submit();
        }
    };
}]);
