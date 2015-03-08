(function(app) {
    var default_config = {
        update_freq: 2000,
        max_points: 100,
        default_log_fetch: 100000,
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
        if (window.location.port === '6085') {
            // Use the default config
            var config = {
                servers: [{
                    name: "Varnish",
                    host: null,
                    port: 6085,
                    user: false,
                    pass: false
                }]
            };
        }
    }

    for (var option in default_config) {
        if (typeof config[option] === 'undefined') {
            config[option] = default_config[option];
        }
    }

    var servers = config.servers;
    var hasConfig = typeof config !== 'undefined';
    var isCombinedView = servers.length > 1;
    var currentServer = isCombinedView ? -1 : 0;
    var page = $('body').data('page');

    if (servers.length > 1) {
        if (window.location.search.match(/server=([0-9]+)/)) {
            currentServer = window.location.search.match(/server=([0-9]+)/)[1];
            isCombinedView = false;
            $('#server-navigation button').html(servers[currentServer].name + ' <span class="caret"></span>');
        }

        if (currentServer !== -1) {
            $('.navbar-nav a').each(function () {
                $(this).attr('href', $(this).attr('href') + '?server=' + currentServer);
            });
        }
    }

    // Add state vars to servers
    for (var k = 0; k < servers.length; k++) {
        servers[k].status = 'offline';
        servers[k].status_text = '';
        servers[k].last_stats = false;
        servers[k].current_stats = false;

        if (!servers[k].host) {
            servers[k].host = document.location.hostname;
        }

        $('#server-navigation ul').append('<li role="presentation"><a role="menuitem" class="switch-server" data-server="' + k + '" href="?server=' + k + '">' + servers[k].name + '</a></li>');
    }

    $(document).ready(function() {
        if (!hasConfig) {
            $('.page-body').html('<div class="alert alert-danger" role="alert">No config was found, please ensure you have a config.js file</div>');
            return;
        }

        if (isCombinedView) {
            $('.page-body').prepend('<div class="alert alert-info" role="alert">NOTE: You are in the combined server view, all stats shown are the sum of stats from each server</div>');
        }

        if (servers.length === 1) {
            $('#server-navigation').hide();
        } else {
            $('#server-navigation').show();
        }

        $('#server-navigation .switch-server').on('click', function(e) {
            e.preventDefault();
            app.switchServerView($(this).data('server'));
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
            app.initStats();
        } else if (page === 'params') {
            if (isCombinedView) {
                $('.page-body').html('<div class="alert alert-danger" role="alert">This page does not work in combined view mode, please select a specific server to view</div>');
            } else {
                app.initParams();
            }
        }
    });

    // TODO: Implement a proper parser instead of hacky regexes
    app.highlightVcl = function(vcl) {
        var lineno = 0;
        var lines = vcl.match(/\n/g).length;
        var padding = lines.toString().length;

        // Escape HTML characters
        vcl = $('<div/>').text(vcl).html();

        // String detection
        vcl = vcl.replace(/("|')(.*?)("|')/mg, '$1<span class="vcl-string">$2</span>$3');

        // Detect comments
        vcl = vcl.replace(/^([\t ]*(#|\/\/).*)/mg, '<span class="vcl-comment">$1</span>');

        // Keyword detection
        vcl = vcl.replace(/(\s|^)(acl|import|backend|sub|if|elsif|else|return|error|include|set|unset|remove)(\b)/mg, '$1<span class="vcl-keyword">$2</span>$3');

        // Constant detection
        vcl = vcl.replace(/(\(\s*)(pass|lookup|pipe|fetch|error|purge|deliver)(\s*\))/mg, '$1<span class="vcl-constant">$2</span>$3');
        vcl = vcl.replace(/(\b)([0-9]+(s|m|h|d|w|y)?)(\b)/mg, '$1<span class="vcl-constant">$2</span>$4');

        // Builtin function detection
        vcl = vcl.replace(/(^|\s|\b)(regsub|regsuball|hash_data)(\s*\()/mg, '$1<span class="vcl-builtin">$2</span>$3');

        // Variable detection
        vcl = vcl.replace(/(\s)(\.[a-z0-9]+)(\s|=)/mg, '$1<span class="vcl-variable">$2</span>$3');
        vcl = vcl.replace(/(\b)((req|bereq|client|resp)\.[A-Za-z0-9\.\-_]+)/mg, '$1<span class="vcl-variable">$2</span>');

        // Man page detection
        vcl = vcl.replace(/vcl\(<span class="vcl-constant">([0-9])<\/span>\)/i, '<a href="http://linux.die.net/man/$1/vcl" class="vcl-man">vcl($1)</a>');

        // Add line numbers
        vcl = vcl.replace(/(.*)\n/g, function(match, match2) {
            lineno++;

            var rep = Array(padding + 1 - lineno.toString().length).join(' ') + lineno;

            return '<span class="vcl-line-no">' + rep + '</span><span class="vcl-line">' + match2 + '</span>\n';
        });

        return vcl;
    }

    app.isCombinedView = function() {
        return isCombinedView;
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
        if (currentServer < 0) {
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

    app.getConfig = function(param) {
        return config[param];
    };

    app.switchServerView = function(server) {
        var href, newhref;

        href = window.location.href;
        search = window.location.search;

        if (href.indexOf('#') >= 0) {
            href = href.replace(/#.*/, '');
        }

        if (server === '') {
            if (search.indexOf('server=') >= 0) {
                newhref = href.replace(/&?server=[0-9]+/, '');
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

        for (var idx in servers) {
            ajaxCount++;

            (function(idx) {
                app.ajax(servers[idx], {
                    url: url,
                    data: data,
                    success: function(response) {
                        ajaxCount--;

                        responses[idx] = response;

                        if (ajaxCount === 0) {
                            success(responses);
                        }
                    },
                    dataType: dataType
                });
            })(idx);
        }
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

        for (var idx in servers) {
            ajaxCount++;

            (function(idx) {
                app.ajax(servers[idx], {
                    type: 'POST',
                    url: url,
                    data: data,
                    success: function(response) {
                        ajaxCount--;

                        responses[idx] = response;

                        if (ajaxCount === 0) {
                            success(responses);
                        }
                    },
                    dataType: dataType
                });
            })(idx);
        }
    }

    app.updateServerStats = function() {
        var servers = app.getEnabledServers();
        var stats = [];

        for (var i = 0; i < servers.length; i++) {
            if (typeof stats.timestamp === 'undefined') {
                for (var j in servers[i].current_stats) {
                    if (j == 'timestamp') {
                        stats[j] = { value: servers[i].current_stats[j], description: 'Current server time' };
                    } else {
                        stats[j] = servers[i].current_stats[j];
                    }
                }
            } else {
                for (var j in servers[i].current_stats) {
                    if (j == 'timestamp') {
                        continue;
                    }

                    stats[j].value = stats[j].value + servers[i].current_stats[j].value;
                }
            }
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

    $('abbr').tooltip()
})(window.app = {});
