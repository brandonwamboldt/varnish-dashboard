(function(app) {
    $(document).ready(function() {
        $('.action-ping').on('click', function(e) {
            e.preventDefault();

            app.multiGet(app.getEnabledServers(), '/ping', function(responses) {
                var msg = '';

                for (var idx in responses) {
                    msg += app.getServer(idx).name + ': ' + responses[idx] + "\n";
                }

                alert(msg);
            }, 'text');
        });

        $('.action-restart').on('click', function(e) {
            e.preventDefault();

            if (confirm('Are you sure you want to restart Varnish?')) {
                app.multiPost(app.getEnabledServers(), '/stop', function(responses) {
                    app.multiPost(app.getEnabledServers(), '/start', function(responses) {
                        app.getBanList();
                        alert('Varnish has been restarted');
                    }, 'text');
                }, 'text');
            }
        });

        $('#server-direct').on('submit', function(e) {
            e.preventDefault();

            app.multiPost(app.getEnabledServers(), '/direct', $('#server-direct input').val(), function(responses) {
                var output = '';

                for (var i = 0; i < responses.length; i++) {
                    if (responses.length === 1) {
                        output += '<pre>' + $('<div/>').text(responses[i]).html() + '</pre>';
                    } else {
                        output += app.getServer(i).name + ':<br><br><pre>' + $('<div/>').text(responses[i]).html() + '</pre>';
                    }
                }

                $('#cmd-output .modal-body').html(output);
                $('#cmd-output').modal('show');
            }, 'text');
        });

        for (var server in app.getEnabledServers()) {
            var html = '<div class="panel panel-default">';
            html += '<div class="panel-heading">';

            if (app.isCombinedView()) {
                html += '<i class="glyphicon glyphicon-alert"></i> Panic Log (' + app.getServer(server).name + ')';
            } else {
                html += '<i class="glyphicon glyphicon-alert"></i> Panic Log';
            }

            html += '<a href="#" data-server="' + server + '" class="pull-right induce-panic btn btn-xs btn-danger" style="margin-left:6px;"><i class="glyphicon glyphicon-exclamation-sign"></i> Induce Panic</a>';
            html += '<a href="#" data-server="' + server + '" class="pull-right clear-panic btn btn-xs btn-success" style="display:none"><i class="glyphicon glyphicon-ban-circle"></i> Clear Panic</a> ';
            html += '</div>';
            html += '<div class="panel-body">';
            html += '<pre id="panic-log-' + server + '">Loading...</pre>';
            html += '</div>';
            html += '</div>';

            $('#last-panic').append(html);
        }

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

        getServerPanicLogs();
        getServerVersions();
    });

    function getServerPanicLogs() {
        app.multiGet(app.getEnabledServers(), '/panic', function(responses) {
            for (var i in responses) {
                $('#panic-log-' + i).text(responses[i]);

                if (responses[i] === "Child has not panicked or panic has been cleared") {
                    $('.clear-panic[data-server="' + i + '"]').hide();
                } else {
                    $('.clear-panic[data-server="' + i + '"]').show();
                }
            }
        });
    }

    function getServerVersions() {
        app.multiPost(app.getEnabledServers(), '/direct', 'banner', function(responses) {
            var varnish_version = false, multiple_versions = false, version;

            for (var i in responses) {
                version = responses[i].match(/varnish-(.*?) revision ([a-z0-9]+)/i);

                if (!varnish_version) {
                    varnish_version = version;
                } else if (varnish_version[2] != version[2]) {
                    multiple_versions = true;
                    break;
                }
            }

            if (multiple_versions) {
                for (var i in responses) {
                    version = responses[i].match(/varnish-(.*?) revision ([a-z0-9]+)/i);

                    $('#varnish-version').append(app.getServer(i).name + ': Varnish ' + version[1] + ' revision <a href="https://github.com/varnish/Varnish-Cache/commit/' + version[2] + '">' + version[2] + '</a><br>');
                }
            } else {
                $('#varnish-version').html('Varnish ' + version[1] + ' revision <a href="https://github.com/varnish/Varnish-Cache/commit/' + version[2] + '">' + version[2] + '</a><br>');
            }
        });
    }
})(window.app);
