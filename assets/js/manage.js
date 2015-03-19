(function(app) {
    'use strict';

    app.ready(function() {
        if (app.isGroupView()) {
            $('.page-body').prepend('<div class="alert alert-warning" role="alert">NOTE: You are in the server group view, actions will be executed on all servers in the current group</div>');
        }

        $('#last-panic').html('');

        app.getEnabledServers().forEach(function(server) {
            var html = '<div class="panel panel-default">';
            html += '<div class="panel-heading">';

            if (app.isGroupView()) {
                html += '<i class="glyphicon glyphicon-alert"></i> Panic Log (' + server.name + ')';
            } else {
                html += '<i class="glyphicon glyphicon-alert"></i> Panic Log';
            }

            html += '<a href="#" data-server="' + server.index + '" class="pull-right induce-panic btn btn-xs btn-danger" style="margin-left:6px;"><i class="glyphicon glyphicon-exclamation-sign"></i> Induce Panic</a>';
            html += '<a href="#" data-server="' + server.index + '" class="pull-right clear-panic btn btn-xs btn-success" style="display:none"><i class="glyphicon glyphicon-ban-circle"></i> Clear Panic</a> ';
            html += '</div>';
            html += '<div class="panel-body">';
            html += '<pre id="panic-log-' + server.index + '">Loading...</pre>';
            html += '</div>';
            html += '</div>';

            $('#last-panic').append(html);
        });

        bindEventListeners();
        getServerPanicLogs();
        getServerVersions();
    });

    function bindEventListeners() {
        $('.action-ping').on('click', function(e) {
            e.preventDefault();

            app.multiGet(app.getEnabledServers(), '/ping', function(responses) {
                var msg = '';

                responses.forEach(function(r) {
                    msg += app.getServer(r.server).name + ': ' + r.response + "\n";
                });

                alert(msg);
            }, 'text');
        });

        $('.action-restart').on('click', function(e) {
            e.preventDefault();

            if (confirm('Are you sure you want to restart Varnish?')) {
                app.multiPost(app.getEnabledServers(), '/stop', function(responses) {
                    app.multiPost(app.getEnabledServers(), '/start', function(responses) {
                        getServerPanicLogs();
                        alert('Varnish has been restarted');
                    }, 'text');
                }, 'text');
            }
        });

        $('#server-direct').on('submit', function(e) {
            e.preventDefault();

            app.multiPost(app.getEnabledServers(), '/direct', $('#server-direct input').val(), function(responses) {
                var output = '';

                responses.forEach(function(r) {
                    if (responses.length === 1) {
                        output += '<pre>' + $('<div/>').text(r.response).html() + '</pre>';
                    } else {
                        output += app.getServer(r.server).name + ':<br><br><pre>' + $('<div/>').text(r.response).html() + '</pre>';
                    }
                });

                $('#cmd-output .modal-body').html(output);
                $('#cmd-output').modal('show');
            }, 'text');
        });

        $('.clear-panic').on('click', function(e) {
            e.preventDefault();
            var server = $(this).data('server');

            app.delete(app.getServer(server), '/panic', function(response) {
                $('.clear-panic[data-server="' + server + '"]').hide();
                getServerPanicLogs();
            });
        });

        $('.induce-panic').on('click', function(e) {
            e.preventDefault();
            var server = $(this).data('server');

            app.post(app.getServer(server), '/direct', 'debug.panic.worker', function(response) {
                $('.clear-panic[data-server="' + server + '"]').show();
                getServerPanicLogs();
            });
        });
    }

    function getServerPanicLogs() {
        app.multiGet(app.getEnabledServers(), '/panic', function(responses) {
            responses.forEach(function(r) {
                $('#panic-log-' + r.server).text(r.response);

                if (r.response === "Child has not panicked or panic has been cleared") {
                    $('.clear-panic[data-server="' + r.server + '"]').hide();
                } else {
                    $('.clear-panic[data-server="' + r.server + '"]').show();
                }
            });
        }, 'text');
    }

    function getServerVersions() {
        app.multiPost(app.getEnabledServers(), '/direct', 'banner', function(responses) {
            var varnish_version = false, multiple_versions = false, version;

            responses.forEach(function(r) {
                version = r.response.match(/varnish-(.*?) revision ([a-z0-9]+)/i);

                if (!varnish_version) {
                    varnish_version = version;
                } else if (varnish_version[2] != version[2]) {
                    multiple_versions = true;
                }
            });

            if (multiple_versions) {
                responses.forEach(function(r) {
                    version = r.response.match(/varnish-(.*?) revision ([a-z0-9]+)/i);

                    $('#varnish-version').append(app.getServer(r.server).name + ': Varnish ' + version[1] + ' revision <a href="https://github.com/varnish/Varnish-Cache/commit/' + version[2] + '">' + version[2] + '</a><br>');
                });
            } else if (varnish_version) {
                $('#varnish-version').html('Varnish ' + version[1] + ' revision <a href="https://github.com/varnish/Varnish-Cache/commit/' + version[2] + '">' + version[2] + '</a><br>');
            }
        });
    }
})(window.app);
