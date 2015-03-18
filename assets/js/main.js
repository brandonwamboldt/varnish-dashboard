(function(app) {
    var default_config = {
        groups: [],
        update_freq: 2000,
        max_points: 100,
        default_log_fetch: 10000,
        default_log_display: 100,
        show_bans_page: true,
        show_manage_server_page: true,
        show_vcl_page: true,
        show_stats_page: true,
        show_params_page: true,
        show_logs_page: true,
        show_restart_varnish_btn: true
    };

    if (typeof window.config !== 'undefined') {
        var config = window.config;
    } else {
        // Use the default config
        var config = {
            servers: [{
                name: "Varnish",
                host: window.location.hostname,
                port: window.location.port,
                user: false,
                pass: false
            }]
        };
    }

    for (var option in default_config) {
        if (typeof config[option] === 'undefined') {
            config[option] = default_config[option];
        }
    }

    var groups = config.groups;
    var servers = config.servers;
    var hasConfig = typeof config !== 'undefined';
    var isGroupView = servers.length > 1;
    var currentServer = isGroupView ? -1 : 0;
    var currentGroup = -1;
    var page = $('body').data('page');
    var isReady = false;
    var documentReady = false;
    var statusReady = false;
    var readyCallbacks = [];

    if (servers.length > 1) {
        if (window.location.search.match(/server=([0-9]+)/)) {
            currentServer = window.location.search.match(/server=([0-9]+)/)[1];
            isGroupView = false;
            $('#server-navigation button').html(servers[currentServer].name + ' <span class="caret"></span>');
        }

        if (window.location.search.match(/group=([0-9]+)/)) {
            currentGroup = window.location.search.match(/group=([0-9]+)/)[1];
            isGroupView = true;
            $('#server-navigation button').html(groups[currentGroup].name + ' <span class="caret"></span>');
        }

        if (currentServer !== -1) {
            $('.navbar-nav a').each(function () {
                $(this).attr('href', $(this).attr('href') + '?server=' + currentServer);
            });
        }

        if (currentGroup !== -1) {
            $('.navbar-nav a').each(function () {
                $(this).attr('href', $(this).attr('href') + '?group=' + currentGroup);
            });
        }
    }

    // Add state vars to servers
    for (var k = 0; k < servers.length; k++) {
        servers[k].index = k;
        servers[k].status = 'offline';
        servers[k].status_text = '';
        servers[k].last_stats = false;
        servers[k].current_stats = false;

        if (!servers[k].host) {
            servers[k].host = document.location.hostname;
        }

        $('#server-navigation ul').append('<li role="presentation"><a role="menuitem" class="switch-server" data-server="' + k + '" href="?server=' + k + '">' + servers[k].name + '</a></li>');
    }

    // Add groups to navigation
    for (var i = groups.length - 1; i >= 0; i--) {
        for (var j = 0; j < groups[i].servers.length; j++) {
            for (var k = 0; k < servers.length; k++) {
                if (servers[k].name === groups[i].servers[j]) {
                    groups[i].servers[j] = k;
                    break;
                }
            }
        }

        $('#sg-all-servers').after('<li role="presentation"><a role="menuitem" class="switch-server" data-group="' + i + '" href="?group=' + i + '">' + groups[i].name + '</a></li>');
    }

    $(document).ready(function() {
        $('abbr').tooltip();

        if (!hasConfig) {
            $('.page-body').html('<div class="alert alert-danger" role="alert">No config was found, please ensure you have a config.js file</div>');
            return;
        }

        if (servers.length === 1) {
            $('#server-navigation').hide();
        } else {
            $('#server-navigation').show();
        }

        var html = '';
        html += '<div class="modal fade" id="varnishd-error" tabindex="-1" role="dialog" aria-hidden="true">';
        html += '  <div class="modal-dialog">';
        html += '    <div class="modal-content">';
        html += '      <div class="modal-header">';
        html += '        <h4 class="modal-title">Error</h4>';
        html += '      </div>';
        html += '      <div class="modal-body">';
        html += '        <p>Varnishd disconnected</p>';
        html += '      </div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
        $('body').append(html);

        $('#server-navigation .switch-server').on('click', function(e) {
            e.preventDefault();

            if (typeof $(this).data('server') !== 'undefined') {
                app.switchServerView($(this).data('server'));
            } else if (typeof $(this).data('group') !== 'undefined') {
                app.switchGroupView($(this).data('group'));
            } else {
                app.switchServerView('');
            }
        });

        if (!config.show_bans_page) {
            $('.nav a[href="./bans.html"]').hide();
        }

        if (!config.show_manage_server_page) {
            $('.nav a[href="./manage.html"]').hide();
        }

        if (!config.show_vcl_page) {
            $('.nav a[href="./vcl.html"]').hide();
        }

        if (!config.show_stats_page) {
            $('.nav a[href="./stats.html"]').hide();
        }

        if (!config.show_params_page) {
            $('.nav a[href="./params.html"]').hide();
        }

        if (!config.show_logs_page) {
            $('.nav a[href="./logs.html"]').hide();
        }

        if (!config.show_restart_varnish_btn) {
            $('.action-restart.btn').hide();
        }

        if (page === 'stats') {
            if (app.isGroupView()) {
                $('.page-body').prepend('<div class="alert alert-info" role="alert">NOTE: You are in the server group view, stats are aggregated from each server in the group</div>');
            }

            app.initStats();
        } else if (page === 'params') {
            if (isGroupView) {
                $('.page-body').html('<div class="alert alert-danger" role="alert">This page does not work in server group mode, please select a single server to continue</div>');
            } else {
                app.initParams();
            }
        }

        documentReady = true;

        if (statusReady) {
            triggerReady();
        }
    });

    app.fatalError = function(error) {
        $('#varnishd-error').modal({backdrop: 'static'});
        $('#varnishd-error .modal-body p').html(error);
    }

    app.ready = function(callback) {
        if (isReady) {
            callback();
        } else {
            readyCallbacks.push(callback);
        }
    }

    app.isGroupView = function() {
        return isGroupView;
    }

    app.initStats = function() {
        for (idx in servers) {
            app.getServerStats();
        }
    }

    app.initParams = function() {
        app.get(servers[currentServer], '/paramjson/', function(response) {
            var params = [];

            for (var param in response) {
                params.push(param);
            }

            params.sort();

            for (var k in params) {
                param = params[k];
                var is_default = true;

                // Both numbers
                if (response[param].value.match(/^[0-9.]+$/) && response[param].default.match(/^[0-9.]+$/)) {
                    if (parseFloat(response[param].value).toFixed(10) != parseFloat(response[param].value).toFixed(10)) {
                        is_default = false;
                    }
                } else if (response[param].value !== response[param].default) {
                    is_default = false;
                }

                if (is_default) {
                    var html = '<tr>';
                } else {
                    var html = '<tr class="info">';
                }

                html += '<td style="font-family:monospace">' + param + '</td>';
                html += '<td style="font-family:monospace">' + response[param].value + '</td>';
                html += '<td style="font-family:monospace">' + response[param].default + '</td>';

                if (response[param].unit) {
                    html += '<td style="font-family:monospace">' + response[param].unit + '</td>';
                } else {
                    html += '<td style="font-family:monospace">-</td>';
                }

                html += '<td>' + response[param].description + '</td>';
                html += '</tr>';

                $('#server-params tbody').append(html);
            }
        });
    }

    app.getEnabledServers = function() {
        if (currentGroup >= 0) {
            var enabled = [];

            app.getCurrentGroup().servers.forEach(function(server, index) {
                enabled.push(app.getServer(server));
            });

            return enabled;
        } else if (currentServer < 0) {
            return servers;
        } else {
            return [servers[currentServer]];
        }
    };

    app.getServers = function(server) {
        if (server === undefined) {
            return servers;
        } else {
            return servers[server];
        }
    };

    app.getServer = function(server) {
        return servers[server];
    };

    app.getCurrentServer = function() {
        return servers[currentServer];
    };

    app.getCurrentGroup = function() {
        return groups[currentGroup];
    };

    app.getConfig = function(param) {
        return config[param];
    };

    app.switchServerView = function(server) {
        var href, newhref;

        href   = window.location.href;
        href   = href.replace(/[&\?]?group=[^&#]/g, '');
        search = window.location.search;

        if (href.indexOf('#') >= 0) {
            href = href.replace(/#.*/, '');
        }

        if (server === '') {
            if (search.indexOf('server=') >= 0 || search.indexOf('group=') >= 0) {
                newhref = href.replace(/&?server=[0-9]+/, '');
                newhref = newhref.replace(/&?group=[0-9]+/, '');
                newhref = newhref.replace(/\?$/, '');
            }
        } else {
            if (href.indexOf('?') === -1) {
                newhref = href + '?server=' + server;
            } else if (search.indexOf('server=') >= 0) {
                newhref = href.replace(/server=[0-9]+/, 'server=' + server);
            } else {
                newhref = href + '&server=' + server;
            }
        }

        if (newhref) {
            window.location = newhref;
        }
    }

    app.switchGroupView = function(group) {
        var href, newhref;

        href   = window.location.href;
        href   = href.replace(/[&\?]server=[^&#]/g, '');
        search = window.location.search;

        if (href.indexOf('#') >= 0) {
            href = href.replace(/#.*/, '');
        }

        if (group === '') {
            if (search.indexOf('group=') >= 0) {
                newhref = href.replace(/&?group=[0-9]+/, '');
                newhref = newhref.replace(/\?$/, '');
            }
        } else {
            if (href.indexOf('?') === -1) {
                newhref = href + '?group=' + group;
            } else if (search.indexOf('group=') >= 0) {
                newhref = href.replace(/group=[0-9]+/, 'group=' + group);
            } else {
                newhref = href + '&group=' + group;
            }
        }

        if (newhref) {
            window.location = newhref;
        }
    }

    app.ajax = function(server, options) {
        options.url = '//' + server.host + ':' + server.port + options.url;
        options.error = function(xhr, textStatus) { options.success(xhr.responseText, textStatus, xhr); };
        options.beforeSend = function(xhr) {
            if (server.user && server.pass) {
                xhr.setRequestHeader("Authorization", "Basic " + btoa(server.user + ":" + server.pass));
            }

            if (xhr.overrideMimeType) {
                xhr.overrideMimeType("text/plain");
            }
        };
        $.ajax(options);
    }

    app.get = function(server, url, data, success, dataType) {
        if (typeof data === 'function') {
            dataType = success;
            success = data;
            data = [];
        }

        if (typeof dataType === 'undefined') {
            dataType = 'json';
        }

        app.ajax(server, {
            url: url,
            data: data,
            success: success,
            dataType: dataType
        });
    }

    app.post = function(server, url, data, success, dataType) {
        if (typeof data === 'function') {
            dataType = success;
            success = data;
            data = [];
        }

        if (typeof dataType === 'undefined') {
            dataType = 'json';
        }

        app.ajax(server, {
            type: 'POST',
            url: url,
            data: data,
            success: success,
            dataType: dataType
        });
    }

    app.put = function(server, url, data, success, dataType) {
        if (typeof data === 'function') {
            dataType = success;
            success = data;
            data = [];
        }

        if (typeof dataType === 'undefined') {
            dataType = 'json';
        }

        app.ajax(server, {
            type: 'PUT',
            url: url,
            data: data,
            success: success,
            dataType: dataType
        });
    }

    app.delete = function(server, url, data, success, dataType) {
        if (typeof data === 'function') {
            dataType = success;
            success = data;
            data = [];
        }

        if (typeof dataType === 'undefined') {
            dataType = 'json';
        }

        app.ajax(server, {
            type: 'DELETE',
            url: url,
            data: data,
            success: success,
            dataType: dataType
        });
    }

    app.multiGet = function(servers, url, data, success, dataType) {
        if (typeof data === 'function') {
            dataType = success;
            success = data;
            data = [];
        }

        if (typeof dataType === 'undefined') {
            dataType = 'json';
        }

        var ajaxCount = 0;
        var responses = [];

        servers.forEach(function(server) {
            ajaxCount++;

            app.ajax(server, {
                url: url,
                data: data,
                success: function(response, status, jqXHR) {
                    ajaxCount--;

                    if (dataType === 'json' && typeof response === 'string') {
                        response = JSON.parse(response.replace(/\\0/g, ''));
                    }

                    responses.push({server: server.index, response: response});

                    if (ajaxCount === 0) {
                        success(responses);
                    }
                },
                dataType: dataType
            });
        });
    }

    app.multiPost = function(servers, url, data, success, dataType) {
        if (typeof data === 'function') {
            dataType = success;
            success = data;
            data = [];
        }

        if (typeof dataType === 'undefined') {
            dataType = 'json';
        }

        var ajaxCount = 0;
        var responses = [];

        servers.forEach(function(server) {
            ajaxCount++;

            app.ajax(server, {
                type: 'POST',
                url: url,
                data: data,
                success: function(response) {
                    ajaxCount--;

                    responses.push({server: server.index, response: response});

                    if (ajaxCount === 0) {
                        success(responses);
                    }
                },
                dataType: dataType
            });
        });
    }

    app.updateServerStats = function() {
        var servers = app.getEnabledServers();
        var stats = [];
        var diff_version = false;
        var version = false;

        for (var i = 0; i < servers.length; i++) {
            if (typeof stats.timestamp === 'undefined') {
                for (var j in servers[i].current_stats) {
                    if (j == 'timestamp') {
                        stats[j] = { value: servers[i].current_stats[j], description: 'Current server time' };
                    } else {
                        stats[j] = servers[i].current_stats[j];
                    }
                }

                if (typeof servers[i].current_stats['MAIN.uptime'] !== 'undefined') {
                    version = '4.0';
                } else {
                    version = '3.0';
                }
            } else {
                if (typeof servers[i].current_stats['MAIN.uptime'] !== 'undefined') {
                    if (version !== '4.0') {
                        diff_version = true;
                        break;
                    }
                } else {
                    if (version !== '3.0') {
                        diff_version = true;
                        break;
                    }
                }

                for (var j in servers[i].current_stats) {
                    if (j == 'timestamp') {
                        continue;
                    }

                    stats[j].value = stats[j].value + servers[i].current_stats[j].value;
                }
            }
        }

        if (diff_version) {
            $('#server-stats').replaceWith('<div class="alert alert-danger">Cannot display stats in server group mode due to different major versions (e.g. 3.0 and 4.0). Please select a single server to continue.</div>');
            return;
        }

        $('#server-stats tbody').html('');

        for (var stat in stats) {
            var stati = stats[stat];

            if (stati.value.toString().match(/^[0-9]+$/)) {
                stati.value = stati.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            }

            $('#server-stats tbody').append('<tr><td><code>' + stat + '</code></td><td>' + stati.value + '</td><td>' + stati.description + '</td></tr>');
        }
    }

    app.getServerStats = function() {
        var ajaxCount = 0;

        for (idx in servers) {
            ajaxCount++;

            (function(server, index) {
                app.get(server, '/stats', function(response) {
                    ajaxCount--;
                    server.last_stats = server.current_stats;
                    server.current_stats = response;

                    if (ajaxCount === 0) {
                        app.updateServerStats();
                        setTimeout(function() { app.getServerStats() }, config.update_freq);
                    }
                }, 'json');
            })(servers[idx], idx);
        }
    };

    app.secondsToHumanTime = function(seconds) {
        var humanTime = '';

        if ((seconds / 86400) >= 1) {
            var days = Math.floor(seconds / 86400);

            if (days === 1) {
                humanTime += ', 1 day';
            } else {
                humanTime += ', ' + days + ' days';
            }

            seconds = seconds % 86400;
        }

        if ((seconds / 3600) >= 1) {
            var hours = Math.floor(seconds / 3600);

            if (hours === 1) {
                humanTime += ', 1 hour';
            } else {
                humanTime += ', ' + hours + ' hours';
            }

            seconds = seconds % 3600;
        }

        if ((seconds / 60) >= 0) {
            var minutes = Math.floor(seconds / 60);

            if (minutes === 1) {
                humanTime += ', 1 minute';
            } else {
                humanTime += ', ' + minutes + ' minutes';
            }

            seconds = seconds % 60;
        }

        return humanTime.substring(2);
    }

    app.bytesToNiceUnits = function(bytes) {
        if ((bytes / 125000000000) >= 1) {
            return (bytes / 125000000000).toFixed(1) + ' Tbps';
        } else if ((bytes / 125000000) >= 1) {
            return (bytes / 125000000).toFixed(1) + ' Gbps';
        } else if ((bytes / 125000) >= 1) {
            return (bytes / 125000).toFixed(1) + ' Mbps';
        } else {
            return (bytes / 125).toFixed(1) + ' Kbps';
        }
    }

    app.getStat = function(stats, stat) {
        var version = 3;

        if (typeof stats["MAIN.uptime"] !== 'undefined') {
            version = 4;
        }

        if (version == 3) {
            if (typeof stats[stat] === 'undefined') {
                console.log('app.getStat(): "' + stat + '" is undefined');
                return 0;
            }

            return stats[stat].value;
        } else {
            if (stat === 's_hdrbytes') {
                return stats['MAIN.s_req_hdrbytes'].value + stats['MAIN.s_resp_hdrbytes'].value;
            } else if (stat === 's_bodybytes') {
                return stats['MAIN.s_req_bodybytes'].value + stats['MAIN.s_resp_bodybytes'].value;
            } else if (stat === 'accept_fail') {
                return stats['MAIN.sess_fail'].value;
            } else if (stat === 'n_wrk_create') {
                return stats['MAIN.threads_created'].value;
            }

            if (typeof stats['MAIN.' + stat] === 'undefined') {
                console.log('app.getStat(): "' + "MAIN." + stat + '" is undefined');
                return 0;
            }

            return stats['MAIN.' + stat].value;
        }
    };

    function triggerReady() {
        var varnishd_online = true;

        if (isGroupView) {

        } else if (app.getCurrentServer().status === 'offline') {
            varnishd_online = false;
        }

        if (varnishd_online) {
            isReady = true;

            for (var i = 0; i < readyCallbacks.length; i++) {
                readyCallbacks[i]();
            }

            readyCallbacks = [];
        } else {
            app.fatalError('Varnishd disconnected');
        }
    }

    var statusCount = app.getEnabledServers().length;

    app.getEnabledServers().forEach(function(server, index) {
        if (server.host === null) {
            server.host = document.location.hostname;
        }

        app.get(server, '/status', function(response) {
            server.status_text = response;

            if (response === 'Child in state running') {
                server.status = 'online';
            } else if (response === 'Varnishd disconnected') {
                server.status = 'offline';
            } else {
                server.status = 'busy';
            }

            statusCount--;

            if (statusCount === 0) {
                statusReady = true;

                if (documentReady) {
                    triggerReady();
                }
            }
        }, 'text');
    });
})(window.app = {});
