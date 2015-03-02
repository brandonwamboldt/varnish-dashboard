(function(app) {
    var default_config = {
        update_freq: 2000,
        max_points: 100,
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

    var requestPlot, bandwidthPlot, requestData = [], bandwidthData = [];
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

        if (page === 'dashboard') {
            app.initDashboard();
        } else if (page === 'stats') {
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
        vcl = vcl.replace(/(\s|^)(backend|sub|if|elsif|else|return|error|include|set)(\b)/mg, '$1<span class="vcl-keyword">$2</span>$3');

        // Constant detection
        vcl = vcl.replace(/(\(\s*)(pass|lookup|pipe|fetch|error|deliver)(\s*\))/mg, '$1<span class="vcl-constant">$2</span>$3');
        vcl = vcl.replace(/(\b)([0-9]+(s|m|h|d|w|y)?)(\b)/mg, '$1<span class="vcl-constant">$2</span>$4');

        // Builtin function detection
        vcl = vcl.replace(/(^|\s|\b)(regsub|regsuball)(\s*\()/mg, '$1<span class="vcl-builtin">$2</span>$3');

        // Variable detection
        vcl = vcl.replace(/(\s)(\.[a-z0-9]+)(\s|=)/mg, '$1<span class="vcl-variable">$2</span>$3');
        vcl = vcl.replace(/(\b)((req|bereq|client|resp)\.[A-Za-z0-9\.\-_]+)/mg, '$1<span class="vcl-variable">$2</span>');

        // Add line numbers
        vcl = vcl.replace(/(.*)\n/g, function(match, match2) {
            lineno++;

            var rep = Array(padding + 1 - lineno.toString().length).join(' ') + lineno;

            return '<span class="vcl-line-no">' + rep + '</span><span class="vcl-line">' + match2 + '</span>\n';
        });

        return vcl;
    }

    app.initDashboard = function() {
        if (app.getEnabledServers().length <= 1) {
            var legendOptions = { show: false };
        } else {
            var legendOptions = { show: true };
        }

        var idx = 0;
        var datar = [];
        var datab = [];
        var roptions = {
            legend: legendOptions,
            series: {
                stack: true,
                lines: { fill: true },
                shadowSize: 0
            },
            xaxis: {
                show: false
            },
            yaxis: {
                min: 0
            }
        };
        var boptions = {
            legend: legendOptions,
            series: {
                stack: true,
                lines: { fill: true },
                shadowSize: 0
            },
            xaxis: {
                show: false
            },
            yaxis: {
                tickFormatter: app.bytesToNiceUnits,
                min: 0,
                minTickSize: 125
            }
        };

        for (var i = 0; i < servers.length; i++) {
            datar[i] = {label: servers[i].name, data: []};
            datab[i] = {label: servers[i].name, data: []};
            requestData[i] = [];
            bandwidthData[i] = [];
        }

        requestPlot = $("#varnish-requests-graph").plot(datar, roptions).data("plot");
        bandwidthPlot = $("#varnish-bandwidth-graph").plot(datab, boptions).data("plot");
        app.getServerStats();
        app.getBackendHealth();

        for (idx in servers) {
            app.getServerStatus(idx);
            app.renderDashboardServerPanel(idx);
        }
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

                var html = '<tr>';
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

    app.log = function(msg) {
        if (console.log !== undefined) {
            console.log(msg);
        }
    }

    app.getNiceStats = function(idx) {
        var server        = servers[idx];
        var current_stats = server.current_stats;
        var last_stats    = server.last_stats;
        var stats         = {};
        var cTimestamp    = Date.parse(current_stats.timestamp);
        var lTimestamp    = Date.parse(last_stats.timestamp);
        var timeSinceLast = (cTimestamp - lTimestamp) / 1000;
        stats.timestamp   = cTimestamp;
        stats.uptime      = current_stats.uptime.value;

        // Calculate request rate
        var cReqTotal = current_stats.client_req.value;
        var lReqTotal = last_stats.client_req.value;
        var reqGauge  = cReqTotal - lReqTotal;
        stats.request_rate = reqGauge / timeSinceLast;
        stats.avg_request_rate = cReqTotal / stats.uptime;

        // Calculate bandwidth
        var cHeaderBytes  = current_stats.s_hdrbytes.value;
        var lHeaderBytes  = last_stats.s_hdrbytes.value;
        var cBodyBytes    = current_stats.s_bodybytes.value;
        var lBodyBytes    = last_stats.s_bodybytes.value;
        var cTotalBytes   = cHeaderBytes + cBodyBytes;
        var lTotalBytes   = lHeaderBytes + lBodyBytes;
        var bytesGauge    = cTotalBytes - lTotalBytes;
        stats.transfer_rate = bytesGauge / timeSinceLast;
        stats.avg_transfer_rate = cTotalBytes / stats.uptime;

        // Connection rate
        var cConnTotal = current_stats.client_req.value;
        var lConnTotal = last_stats.client_req.value;
        var connGauge  = cConnTotal - lConnTotal;
        stats.conn_rate = connGauge / timeSinceLast;
        stats.avg_conn_rate = cConnTotal / stats.uptime;

        // Requests per Connection rate
        stats.req_per_conn_rate = (stats.conn_rate / stats.request_rate).toFixed(1);
        stats.avg_req_per_conn_rate = (stats.avg_conn_rate / stats.avg_request_rate).toFixed(1);

        // Backend Connections
        var cTotal = current_stats.backend_conn.value;
        var lTotal = last_stats.backend_conn.value;
        var gauge = cTotal - lTotal;
        stats.backend_conn_rate = gauge / timeSinceLast;
        stats.avg_backend_conn_rate = cTotal / stats.uptime;

        // Fetches & Passes
        var cTotal = current_stats.s_fetch.value + current_stats.s_pass.value;
        var lTotal = last_stats.s_fetch.value + last_stats.s_pass.value;
        var gauge = cTotal - lTotal;
        stats.fetchpass = gauge / timeSinceLast;
        stats.avg_fetchpass = cTotal / stats.uptime;

        // Backend Fails
        var cTotal = current_stats.backend_fail.value;
        var lTotal = last_stats.backend_fail.value;
        var gauge = cTotal - lTotal;
        stats.backend_fail = gauge / timeSinceLast;
        stats.avg_backend_fail = cTotal / stats.uptime;

        // Backend Reuse
        var cTotal = current_stats.backend_reuse.value;
        var lTotal = last_stats.backend_reuse.value;
        var gauge = cTotal - lTotal;
        stats.backend_reuse = gauge / timeSinceLast;
        stats.avg_backend_reuse = cTotal / stats.uptime;

        // Cache Hit Ratio
        var requests = current_stats.client_req.value - last_stats.client_req.value;
        var hits     = current_stats.cache_hit.value - last_stats.cache_hit.value;
        stats.cache_hit_ratio = (hits / requests * 100);
        stats.avg_cache_hit_ratio = (current_stats.cache_hit.value / current_stats.client_req.value * 100);

        // Cache hits
        var gauge = current_stats.cache_hit.value - last_stats.cache_hit.value;
        stats.cache_hit = gauge / timeSinceLast;
        stats.avg_cache_hit = current_stats.cache_hit.value / stats.uptime;

        // Cache misses
        var gauge = current_stats.cache_miss.value - last_stats.cache_miss.value;
        stats.cache_miss = gauge / timeSinceLast;
        stats.avg_cache_miss = current_stats.cache_miss.value / stats.uptime;

        // Cache size
        var gauge = current_stats.n_object.value - last_stats.n_object.value;
        stats.n_object = gauge / timeSinceLast;
        stats.avg_n_object = current_stats.n_object.value / stats.uptime;

        // Workers created
        var gauge = current_stats.n_wrk_create.value - last_stats.n_wrk_create.value;
        stats.n_wrk_create = gauge / timeSinceLast;
        stats.avg_n_wrk_create = current_stats.n_wrk_create.value / stats.uptime;

        // SHM writes
        var gauge = current_stats.shm_writes.value - last_stats.shm_writes.value;
        stats.shm_writes = gauge / timeSinceLast;
        stats.avg_shm_writes = current_stats.shm_writes.value / stats.uptime;

        // ESI issues
        var gauge_error = current_stats.esi_errors.value - last_stats.esi_errors.value;
        var gauge_warn = current_stats.esi_warnings.value - last_stats.esi_warnings.value;
        stats.esi_issues = (gauge_error + gauge_warn) / timeSinceLast;
        stats.avg_esi_issues = (current_stats.esi_errors.value + current_stats.esi_warnings.value) / stats.uptime;

        // Accept Failures
        var gauge = current_stats.accept_fail.value - last_stats.accept_fail.value;
        stats.accept_fail = gauge / timeSinceLast;
        stats.avg_accept_fail = current_stats.accept_fail.value / stats.uptime;

        // Zero out NaN values
        for (var j in stats) {
            if (isNaN(stats[j]) || !isFinite(stats[j])) {
                stats[j] = 0;
            }
        }

        return stats;
    }

    app.getRequestPlotData = function() {
        var servers = app.getEnabledServers();
        var data = [];

        for (var i = 0; i < servers.length; i++) {
            data[i] = {};
            data[i].label = servers[i].name;

            if (servers[i].current_stats && servers[i].last_stats) {
                var stats = app.getNiceStats(i);

                requestData[i].shift();
                requestData[i].push([stats.timestamp, stats.request_rate]);
            }

            data[i].data = requestData[i];
        }

        return data;
    }

    app.getBandwidthPlotData = function() {
        var servers = app.getEnabledServers();
        var data = [];

        for (var i = 0; i < servers.length; i++) {
            data[i] = {};
            data[i].label = servers[i].name;

            if (servers[i].current_stats && servers[i].last_stats) {
                var stats = app.getNiceStats(i);

                bandwidthData[i].shift();
                bandwidthData[i].push([stats.timestamp, stats.transfer_rate]);
            }

            data[i].data = bandwidthData[i];
        }

        return data;
    }

    app.updateDashboardGraphs = function() {
        requestPlot.setData(app.getRequestPlotData());
        requestPlot.setupGrid();
        requestPlot.draw();

        bandwidthPlot.setData(app.getBandwidthPlotData());
        bandwidthPlot.setupGrid();
        bandwidthPlot.draw();
    }

    app.updateDashboardStats = function() {
        var servers = app.getEnabledServers();
        var stats = false;

        for (var i = 0; i < servers.length; i++) {
            if (servers[i].current_stats && servers[i].last_stats) {
                if (!stats) {
                    stats = app.getNiceStats(i);
                } else {
                    var newstats = app.getNiceStats(i);

                    for (var j in stats) {
                        stats[j] = stats[j] + newstats[j];
                    }
                }
            }
        }

        if (stats) {
            $('.metric-connections.current').text(parseInt(stats.conn_rate) + '/sec');
            $('.metric-connections.average').text(parseInt(stats.avg_conn_rate) + '/sec');

            $('.metric-requests.current').text(parseInt(stats.request_rate) + '/sec');
            $('.metric-requests.average').text(parseInt(stats.avg_request_rate) + '/sec');

            $('.metric-reqconn.current').text(parseInt(stats.req_per_conn_rate));
            $('.metric-reqconn.average').text(parseInt(stats.avg_req_per_conn_rate));

            $('.metric-bandwidth.current').text(app.bytesToNiceUnits(stats.transfer_rate));
            $('.metric-bandwidth.average').text(app.bytesToNiceUnits(stats.avg_transfer_rate));

            $('.metric-beconns.current').text(parseInt(stats.backend_conn_rate) + '/sec');
            $('.metric-beconns.average').text(parseInt(stats.avg_backend_conn_rate) + '/sec');

            $('.metric-fetchpass.current').text(parseInt(stats.fetchpass) + '/sec');
            $('.metric-fetchpass.average').text(parseInt(stats.avg_fetchpass) + '/sec');

            $('.metric-befails.current').text(parseInt(stats.backend_fail) + '/sec');
            $('.metric-befails.average').text(parseInt(stats.avg_backend_fail) + '/sec');

            $('.metric-bereuse.current').text(parseInt(stats.backend_reuse) + '/sec');
            $('.metric-bereuse.average').text(parseInt(stats.avg_backend_reuse) + '/sec');

            $('.metric-hitratio.current').text((stats.cache_hit_ratio / servers.length).toFixed(1) + '%');
            $('.metric-hitratio.average').text((stats.avg_cache_hit_ratio / servers.length).toFixed(1) + '%');

            $('.metric-cache_hit.current').text(stats.cache_hit.toFixed(0) + '/sec');
            $('.metric-cache_hit.average').text(stats.avg_cache_hit.toFixed(0) + '/sec');

            $('.metric-cache_miss.current').text(stats.cache_miss.toFixed(0) + '/sec');
            $('.metric-cache_miss.average').text(stats.avg_cache_miss.toFixed(0) + '/sec');

            $('.metric-n_object.current').text(stats.n_object.toFixed(0) + '/sec');
            $('.metric-n_object.average').text(stats.avg_n_object.toFixed(0) + '/sec');

            $('.metric-n_wrk_create.current').text(stats.n_wrk_create.toFixed(0) + '/sec');
            $('.metric-n_wrk_create.average').text(stats.avg_n_wrk_create.toFixed(0) + '/sec');

            $('.metric-shm_writes.current').text(stats.shm_writes.toFixed(0) + '/sec');
            $('.metric-shm_writes.average').text(stats.avg_shm_writes.toFixed(0) + '/sec');

            $('.metric-esi_issues.current').text(stats.esi_issues.toFixed(0) + '/sec');
            $('.metric-esi_issues.average').text(stats.avg_esi_issues.toFixed(0) + '/sec');

            $('.metric-accept_fail.current').text(stats.accept_fail.toFixed(0) + '/sec');
            $('.metric-accept_fail.average').text(stats.avg_accept_fail.toFixed(0) + '/sec');
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

    app.getBackendHealth = function() {
        app.multiPost(app.getEnabledServers(), '/direct', 'backend.list', function(responses) {
            var gbackends = {};

            for (var i = 0; i < responses.length; i++) {
                var backends = responses[i].split("\n");
                backends.shift();

                for (var j = 0; j < backends.length; j++) {
                    var backend = backends[j].split(/\s+/);
                    var name = backend[0].match(/(.*?)\((.*?)\)/);

                    gbackends[name[1]] = {
                        name: name[1],
                        config: name[2],
                        refs: backend[1],
                        admin: backend[2],
                        probe: backend[3]
                    };
                }
            }

            $('#dashboard-server-info .server-backends').remove();

            var html;
            html  = '<div class="panel panel-default server-backends">';
            html += '  <div class="panel-heading">';
            html += '      Varnish Backends';
            html += '  </div>';
            html += '  <div class="panel-body">';
            html += '    <table class="table table-hover">';
            html += '      <thead>';
            html += '        <tr>';
            html += '          <th style="width:20px"><img src="assets/images/status-online.png" alt=""></th>';
            html += '          <th>Name</th>';
            html += '          <th>Config</th>';
            html += '        </tr>';
            html += '      </thead>';
            html += '      <tbody>';

            for (var idx in gbackends) {
                html += '<tr>';

                if (gbackends[idx].probe.match(/^Healthy/i)) {
                    html += '<td><img src="assets/images/status-online.png" alt=""></td>';
                } else {
                    html += '<td><img src="assets/images/status-busy.png" alt=""></td>';
                }

                html += '<td>' + gbackends[idx].name + '</td>';
                html += '<td>' + gbackends[idx].config + '</td>';
                html += '</tr>';
            }

            html += '      </tbody>';
            html += '    </table>';
            html += '  </div>';
            html += '</div>';

            $('#dashboard-server-info').append(html);

            setTimeout(app.getBackendHealth, config.update_freq);
        }, 'text')
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

                    if (page === 'dashboard') {
                        if (requestData[index].length === 0) {
                            var prestartTime = Date.parse(server.current_stats.timestamp) - (config.max_points * config.update_freq);

                            for (var j = 0; j < config.max_points; j++) {
                                requestData[index].push([prestartTime + (j * config.update_freq), 0]);
                            }
                        }

                        if (bandwidthData[index].length === 0) {
                            var prestartTime = Date.parse(server.current_stats.timestamp) - (config.max_points * config.update_freq);

                            for (var j = 0; j < config.max_points; j++) {
                                bandwidthData[index].push([prestartTime + (j * config.update_freq), 0]);
                            }
                        }

                        app.renderDashboardServerPanel(index);

                        if (ajaxCount === 0) {
                            app.updateDashboardGraphs();
                            app.updateDashboardStats();
                        }
                    } else if (page === 'stats') {
                        if (ajaxCount === 0) {
                            app.updateServerStats();
                        }
                    }

                    if (ajaxCount === 0) {
                        setTimeout(function() { app.getServerStats() }, config.update_freq);
                    }
                }, 'json');
            })(servers[idx], idx);
        }
    };

    app.getServerStatus = function(index) {
        var server = servers[index];

        if (server.host === null) {
            server.host = document.location.hostname;
        }

        app.get(server, '/status', function(response) {
            server.status_text = response;

            if (response === 'Child in state running') {
                server.status = 'online';
            } else {
                server.status = 'busy';
            }

            app.renderDashboardServerPanel(index);
        }, 'text');

        setTimeout(function() { app.getServerStatus(index) }, config.update_freq);
    };

    app.renderDashboardServerPanel = function(index) {
        var server = servers[index];

        html  = '<div class="panel panel-default server-' + index + '">';
        html += '  <div class="panel-heading">';
        html += '      <img src="assets/images/status-' + server.status + '.png"> ' + server.name;
        html += '  </div>';
        html += '  <div class="panel-body">';
        html += '    <table class="table table-hover">';
        html += '      <tbody>';
        html += '        <tr><td><abbr title="The status as reported by the Varnish control daemon">Status</abbr></td><td>' + server.status_text + '</td></tr>';

        if (server.current_stats) {
            html += '<tr><td><abbr title="The uptime for the Varnish daemon">Uptime</abbr></td><td>' + app.secondsToHumanTime(server.current_stats.uptime.value) + '</td></tr>';
            html += '<tr><td><abbr title="The number of varnish modules currently loaded">VMODs</abbr></td><td>' + server.current_stats.vmods.value + '</td></tr>';
        }

        html += '      </tbody>';
        html += '    </table>';
        html += '  </div>';
        html += '</div>';

        if ($('#dashboard-server-info .server-' + index).length === 1) {
            $('#dashboard-server-info .server-' + index).replaceWith(html);
        } else {
            $('#dashboard-server-info').append(html);
        }

        $('#dashboard-server-info abbr').tooltip()
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
