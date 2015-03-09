(function(app) {
    var varnish_api_version, refresh_interval;

    $(document).ready(function() {
        if ($('#logapi-limit').val() === '') {
            $('#logapi-limit').val(app.getConfig('default_log_fetch'));
        }

        if ($('#logapi-display').val() === '') {
            $('#logapi-display').val(app.getConfig('default_log_display'));
        }

        $('#logapi-tag').on('change', function(e) {
            if ($(this).val() === '') {
                $('#log-entry-regex').hide();
            } else {
                $('#log-entry-regex').show();
            }

            getServerLogs();
        }).trigger('change');

        $('#logapi-regex').change(function() {
            getServerLogs();
        });

        $('#logapi-limit').change(function() {
            getServerLogs();
        });

        $('#logapi-display').change(function() {
            getServerLogs();
        });

        $('#refresh-logs').on('click', function(e) {
            e.preventDefault();

            getServerLogs();
        });

        $('#enable-auto-refresh').on('click', function(e) {
            e.preventDefault();
            $(this).hide();
            $('#disable-auto-refresh').show();

            refresh_interval = setInterval(function() {
                getServerLogs();
            }, app.getConfig('update_freq'));
        });

        $('#disable-auto-refresh').on('click', function(e) {
            e.preventDefault();
            $(this).hide();
            $('#enable-auto-refresh').show();

            clearInterval(refresh_interval);
        });

        getServerLogs();
        //getServerVersions();
    });

    function getServerVersions() {
        app.multiPost(app.getEnabledServers(), '/direct', 'banner', function(responses) {
            var varnish_version = false, multiple_versions = false, version;

            for (var i in responses) {
                version = responses[i].match(/varnish-([0-9]+\.[0-9]+)/i);

                if (!varnish_version) {
                    varnish_version = version;
                } else if (varnish_version[1] != version[1]) {
                    multiple_versions = true;
                    break;
                }
            }

            if (multiple_versions) {
                $('#server-logs').html('<div class="alert alert-danger">Cannot display logs in combined view due to different major versions (e.g. 3.0 and 4.0). Please select a single server.</div>');
            } else {
                varnish_api_version = varnish_version[1];

                if (varnish_api_version != '3.0') {
                    $('#server-logs').html('<div class="alert alert-danger">This dashboard doesn\'t currently support the logs API for Varnish 4.0. Please ask the author on GitHub to add support.</div>');
                } else {
                    getServerLogs();
                }
            }
        });
    }

    function getServerLogs() {
        var limit = $('#logapi-limit').val();
        var display = parseInt($('#logapi-display').val());
        var tag   = $('#logapi-tag').val();
        var regex = $('#logapi-regex').val().replace(/\//g, '\\x2f');
        var url   = '/log/' + limit;

        if (tag) {
            url += '/' + tag;
        }

        if (tag && regex) {
            url += '/' + regex;
        }

        app.multiGet(app.getEnabledServers(), url, function(responses) {
            $('#server-logs tbody').html('');

            for (var i in responses) {
                var logs = responses[i].log;

                if (tag && regex) {
                    $('#server-logs .panel-heading span').html('Logs (<code>varnishlog -k ' + limit + ' -i ' + tag + ' -I ' + regex + '</code>)');
                } else if (tag) {
                    $('#server-logs .panel-heading span').html('Logs (<code>varnishlog -k ' + limit + ' -i ' + tag + '</code>)');
                } else {
                    $('#server-logs .panel-heading span').html('Logs (<code>varnishlog -k ' + limit + '</code>)');
                }

                for (var j = logs.length - 1; j >= Math.max(logs.length - display, 0); j--) {
                    logs[j].value = logs[j].value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    $('#server-logs tbody').append('<tr><td>' + logs[j].fd + '</td><td>' + logs[j].tag + '</td><td>' + logs[j].type + '</td><td>' + logs[j].value + '</td></tr>');
                }
            }

            if ($('#server-logs tbody tr').length === 0) {
                $('#server-logs tbody').append('<tr><td colspan="4">No log entries found</td></tr>');
            }
        });
    }
})(window.app);
