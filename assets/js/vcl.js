(function(app) {
    $(document).ready(function() {
        if (app.isCombinedView()) {
            $('.page-body').html('<div class="alert alert-danger" role="alert">This page does not work in combined view mode, please select a specific server to view</div>');
        } else {
            var active_vcl;

            app.get(app.getCurrentServer(), '/vclactive', function(response) {
                active_vcl = response;

                app.get(app.getCurrentServer(), '/vcl/' + active_vcl, function(response) {
                    $('#current-vcl-name').text('VCL: ' + active_vcl + ' (current)');
                    $('#vcl-file').html(app.highlightVcl(response));
                }, 'text');
            }, 'text');

            app.get(app.getCurrentServer(), '/vcljson/', function(response) {
                for (var i = 0; i < response.vcls.length; i++) {
                    var html = '';
                    html += '<tr>';
                    html += '<td>' + response.vcls[i].name + '</td>';
                    html += '<td>' + response.vcls[i].status + '</td>';
                    html += '<td></td>';
                    html += '</tr>';

                    $('#server-vcls tbody').append(html)
                }
            }, 'json');
        }
    });
})(window.app);
