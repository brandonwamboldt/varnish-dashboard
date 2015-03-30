(function(app) {
    var varnish_api_version, refresh_interval, enabled = true;

    app.ready(function() {
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

        getServerVersions();
    });

    function getServerVersions() {
        app.multiPost(app.getEnabledServers(), '/direct', 'banner', function(responses) {
            var varnish_version = false, multiple_versions = false, version;

            responses.forEach(function(r) {
                version = r.response.match(/varnish-([0-9]+\.[0-9]+)/i);

                if (!varnish_version) {
                    varnish_version = version;
                } else if (varnish_version[1] != version[1]) {
                    multiple_versions = true;
                }
            });

            if (multiple_versions) {
                $('#server-logs').html('<div class="alert alert-danger">Cannot display logs in server group view due to different major versions (e.g. 3.0 and 4.0). Please select a single server.</div>');
                enabled = false;
            } else {
                varnish_api_version = varnish_version[1];
                var table_html = '';

                if (varnish_api_version === '3.0') {
                    table_html += '<table class="varnish-logs table table-bordered table-hover">';
                    table_html += '<thead>';
                    table_html += '<tr>';
                    table_html += '<th style="width:60px;">FD</th>';
                    table_html += '<th style="width:140px;">Tag</th>';
                    table_html += '<th style="width:80px;">Type</th>';
                    table_html += '<th>Value</th>';
                    table_html += '</tr>';
                    table_html += '</thead>';
                    table_html += '<tbody style="font-family:monospace">';
                    table_html += '<tr><td colspan="4">No log entries found</td></tr>';
                    table_html += '</tbody>';
                    table_html += '</table>';
                } else {
                    table_html += '<table class="varnish-logs table table-bordered table-hover">';
                    table_html += '<thead>';
                    table_html += '<tr>';
                    table_html += '<th style="width:60px;">VXID</th>';
                    table_html += '<th style="width:140px;">Tag</th>';
                    table_html += '<th style="width:80px;">Type</th>';
                    table_html += '<th style="width:80px;">Reason</th>';
                    table_html += '<th>Value</th>';
                    table_html += '</tr>';
                    table_html += '</thead>';
                    table_html += '<tbody style="font-family:monospace">';
                    table_html += '<tr><td colspan="5">No log entries found</td></tr>';
                    table_html += '</tbody>';
                    table_html += '</table>';
                }

                $('#server-logs .panel-body').html(table_html);

                getServerLogs();
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

        if (!enabled) {
            return false;
        }

        app.multiGet(app.getEnabledServers(), url, function(responses) {
            $('#server-logs tbody').html('');

            responses.forEach(function(r) {
                if (typeof r.response === 'string' && r.response.match(/Error in opening shmlog/)) {
                    app.fatalError(r.response);
                    return false;
                }

                var logs = r.response.log;

                if (!logs) {
                    $('#server-logs .panel-body').html('<div class="alert alert-danger">Varnish Agent returned a bad response, unable to render logs (this is a known issue with no fix)</div>');
                    return false;
                }

                if (tag && regex) {
                    $('#server-logs .panel-heading span').html('Logs (<code>varnishlog -k ' + limit + ' -i ' + tag + ' -I ' + regex + '</code>)');
                } else if (tag) {
                    $('#server-logs .panel-heading span').html('Logs (<code>varnishlog -k ' + limit + ' -i ' + tag + '</code>)');
                } else {
                    $('#server-logs .panel-heading span').html('Logs (<code>varnishlog -k ' + limit + '</code>)');
                }

                for (var j = logs.length - 1; j >= Math.max(logs.length - display, 0); j--) {
                    logs[j].value = logs[j].value.replace(/</g, '&lt;').replace(/>/g, '&gt;');

                    if (varnish_api_version === '3.0') {
                        $('#server-logs tbody').append('<tr><td>' + logs[j].fd + '</td><td>' + logs[j].tag + '</td><td>' + logs[j].type + '</td><td>' + logs[j].value + '</td></tr>');
                    } else {
                        $('#server-logs tbody').append('<tr><td>' + logs[j].vxid + '</td><td>' + logs[j].tag + '</td><td>' + logs[j].type + '</td><td>' + logs[j].reason + '</td><td>' + logs[j].value + '</td></tr>');
                    }
                }
            });

            if ($('#server-logs tbody tr').length === 0) {
                if (varnish_api_version === '3.0') {
                    $('#server-logs tbody').append('<tr><td colspan="4">No log entries found</td></tr>');
                } else {
                    $('#server-logs tbody').append('<tr><td colspan="5">No log entries found</td></tr>');
                }
            }
        }, 'json');
    }
})(window.app);
