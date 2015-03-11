(function(app) {
    var requestPlot, bandwidthPlot, requestData = [], bandwidthData = [];

    $(document).ready(function() {
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

        for (var i = 0; i < app.getEnabledServers().length; i++) {
            datar[i] = {label: app.getServer(i).name, data: []};
            datab[i] = {label: app.getServer(i).name, data: []};
            requestData[i] = [];
            bandwidthData[i] = [];
        }

        requestPlot = $("#varnish-requests-graph").plot(datar, roptions).data("plot");
        bandwidthPlot = $("#varnish-bandwidth-graph").plot(datab, boptions).data("plot");
        getServerStats();
        getBackendHealth();

        for (idx in app.getServers()) {
            getServerStatus(idx);
            renderDashboardServerPanel(idx);
        }
    });

    getBackendHealth = function() {
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

            setTimeout(getBackendHealth, app.getConfig('update_freq'));
        }, 'text')
    };

    getServerStatus = function(index) {
        var server = app.getServer(index);

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

            renderDashboardServerPanel(index);
        }, 'text');

        setTimeout(function() { getServerStatus(index) }, app.getConfig('update_freq'));
    };

    getServerStats = function() {
        var ajaxCount = 0;

        for (idx in app.getEnabledServers()) {
            ajaxCount++;

            (function(server, index) {
                app.get(server, '/stats', function(response) {
                    ajaxCount--;
                    server.last_stats = server.current_stats;
                    server.current_stats = response;

                    if (requestData[index].length === 0) {
                        var prestartTime = Date.parse(server.current_stats.timestamp) - (app.getConfig('max_points') * app.getConfig('update_freq'));

                        for (var j = 0; j < app.getConfig('max_points'); j++) {
                            requestData[index].push([prestartTime + (j * app.getConfig('update_freq')), 0]);
                        }
                    }

                    if (bandwidthData[index].length === 0) {
                        var prestartTime = Date.parse(server.current_stats.timestamp) - (app.getConfig('max_points') * app.getConfig('update_freq'));

                        for (var j = 0; j < app.getConfig('max_points'); j++) {
                            bandwidthData[index].push([prestartTime + (j * app.getConfig('update_freq')), 0]);
                        }
                    }

                    renderDashboardServerPanel(index);

                    if (ajaxCount === 0) {
                        updateDashboardGraphs();
                        updateDashboardStats();
                    }

                    if (ajaxCount === 0) {
                        setTimeout(function() { getServerStats() }, app.getConfig('update_freq'));
                    }
                }, 'json');
            })(app.getServer(idx), idx);
        }
    };

    renderDashboardServerPanel = function(index) {
        var server = app.getServer(index);

        html  = '<div class="panel panel-default server-' + index + '">';
        html += '  <div class="panel-heading">';
        html += '      <img src="assets/images/status-' + server.status + '.png"> ' + server.name;
        html += '  </div>';
        html += '  <div class="panel-body">';
        html += '    <table class="table table-hover">';
        html += '      <tbody>';
        html += '        <tr><td><abbr title="The status as reported by the Varnish control daemon">Status</abbr></td><td>' + server.status_text + '</td></tr>';

        if (server.current_stats) {
            html += '<tr><td><abbr title="The uptime for the Varnish daemon">Uptime</abbr></td><td>' + app.secondsToHumanTime(app.getStat(server.current_stats, 'uptime')) + '</td></tr>';
            html += '<tr><td><abbr title="The number of varnish modules currently loaded">VMODs</abbr></td><td>' + app.getStat(server.current_stats, 'vmods') + '</td></tr>';
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

    getNiceStats = function(idx) {
        var server        = app.getServer(idx);
        var current_stats = server.current_stats;
        var last_stats    = server.last_stats;
        var stats         = {};
        var cTimestamp    = Date.parse(current_stats.timestamp);
        var lTimestamp    = Date.parse(last_stats.timestamp);
        var timeSinceLast = (cTimestamp - lTimestamp) / 1000;
        stats.timestamp   = cTimestamp;
        stats.uptime      = app.getStat(current_stats, 'uptime');

        // Calculate request rate
        var cReqTotal = app.getStat(current_stats, 'client_req');
        var lReqTotal = app.getStat(last_stats, 'client_req');
        var reqGauge  = cReqTotal - lReqTotal;
        stats.request_rate = reqGauge / timeSinceLast;
        stats.avg_request_rate = cReqTotal / stats.uptime;

        // Calculate bandwidth
        var cHeaderBytes  = app.getStat(current_stats, 's_hdrbytes');
        var lHeaderBytes  = app.getStat(last_stats, 's_hdrbytes');
        var cBodyBytes    = app.getStat(current_stats, 's_bodybytes');
        var lBodyBytes    = app.getStat(last_stats, 's_bodybytes');
        var cTotalBytes   = cHeaderBytes + cBodyBytes;
        var lTotalBytes   = lHeaderBytes + lBodyBytes;
        var bytesGauge    = cTotalBytes - lTotalBytes;
        stats.transfer_rate = bytesGauge / timeSinceLast;
        stats.avg_transfer_rate = cTotalBytes / stats.uptime;

        // Connection rate
        var cConnTotal = app.getStat(current_stats, 'client_req');
        var lConnTotal = app.getStat(last_stats, 'client_req');
        var connGauge  = cConnTotal - lConnTotal;
        stats.conn_rate = connGauge / timeSinceLast;
        stats.avg_conn_rate = cConnTotal / stats.uptime;

        // Requests per Connection rate
        stats.req_per_conn_rate = (stats.conn_rate / stats.request_rate).toFixed(1);
        stats.avg_req_per_conn_rate = (stats.avg_conn_rate / stats.avg_request_rate).toFixed(1);

        // Backend Connections
        var cTotal = app.getStat(current_stats, 'backend_conn');
        var lTotal = app.getStat(last_stats, 'backend_conn');
        var gauge = cTotal - lTotal;
        stats.backend_conn_rate = gauge / timeSinceLast;
        stats.avg_backend_conn_rate = cTotal / stats.uptime;

        // Fetches & Passes
        var cTotal = app.getStat(current_stats, 's_fetch') + app.getStat(current_stats, 's_pass');
        var lTotal = app.getStat(last_stats, 's_fetch') + app.getStat(last_stats, 's_pass');
        var gauge = cTotal - lTotal;
        stats.fetchpass = gauge / timeSinceLast;
        stats.avg_fetchpass = cTotal / stats.uptime;

        // Backend Fails
        var cTotal = app.getStat(current_stats, 'backend_fail');
        var lTotal = app.getStat(last_stats, 'backend_fail');
        var gauge = cTotal - lTotal;
        stats.backend_fail = gauge / timeSinceLast;
        stats.avg_backend_fail = cTotal / stats.uptime;

        // Backend Reuse
        var cTotal = app.getStat(current_stats, 'backend_reuse');
        var lTotal = app.getStat(last_stats, 'backend_reuse');
        var gauge = cTotal - lTotal;
        stats.backend_reuse = gauge / timeSinceLast;
        stats.avg_backend_reuse = cTotal / stats.uptime;

        // Cache Hit Ratio
        var requests = app.getStat(current_stats, 'client_req') - app.getStat(last_stats, 'client_req');
        var hits     = app.getStat(current_stats, 'cache_hit') - app.getStat(last_stats, 'cache_hit');
        stats.cache_hit_ratio = (hits / requests * 100);
        stats.avg_cache_hit_ratio = (app.getStat(current_stats, 'cache_hit') / app.getStat(current_stats, 'client_req') * 100);

        // Cache hits
        var gauge = app.getStat(current_stats, 'cache_hit') - app.getStat(last_stats, 'cache_hit');
        stats.cache_hit = gauge / timeSinceLast;
        stats.avg_cache_hit = app.getStat(current_stats, 'cache_hit') / stats.uptime;

        // Cache misses
        var gauge = app.getStat(current_stats, 'cache_miss') - app.getStat(last_stats, 'cache_miss');
        stats.cache_miss = gauge / timeSinceLast;
        stats.avg_cache_miss = app.getStat(current_stats, 'cache_miss') / stats.uptime;

        // Cache size
        var gauge = app.getStat(current_stats, 'n_object') - app.getStat(last_stats, 'n_object');
        stats.n_object = gauge / timeSinceLast;
        stats.avg_n_object = app.getStat(current_stats, 'n_object') / stats.uptime;

        // Workers created
        var gauge = app.getStat(current_stats, 'n_wrk_create') - app.getStat(last_stats, 'n_wrk_create');
        stats.n_wrk_create = gauge / timeSinceLast;
        stats.avg_n_wrk_create = app.getStat(current_stats, 'n_wrk_create') / stats.uptime;

        // SHM writes
        var gauge = app.getStat(current_stats, 'shm_writes') - app.getStat(last_stats, 'shm_writes');
        stats.shm_writes = gauge / timeSinceLast;
        stats.avg_shm_writes = app.getStat(current_stats, 'shm_writes') / stats.uptime;

        // ESI issues
        var gauge_error = app.getStat(current_stats, 'esi_errors') - app.getStat(last_stats, 'esi_errors');
        var gauge_warn = app.getStat(current_stats, 'esi_warnings') - app.getStat(last_stats, 'esi_warnings');
        stats.esi_issues = (gauge_error + gauge_warn) / timeSinceLast;
        stats.avg_esi_issues = (app.getStat(current_stats, 'esi_errors') + app.getStat(current_stats, 'esi_warnings')) / stats.uptime;

        // Accept Failures
        var gauge = app.getStat(current_stats, 'accept_fail') - app.getStat(last_stats, 'accept_fail');
        stats.accept_fail = gauge / timeSinceLast;
        stats.avg_accept_fail = app.getStat(current_stats, 'accept_fail') / stats.uptime;

        // Zero out NaN values
        for (var j in stats) {
            if (isNaN(stats[j]) || !isFinite(stats[j])) {
                stats[j] = 0;
            }
        }

        return stats;
    }

    getRequestPlotData = function() {
        var servers = app.getEnabledServers();
        var data = [];

        for (var i = 0; i < servers.length; i++) {
            data[i] = {};
            data[i].label = servers[i].name;

            if (servers[i].current_stats && servers[i].last_stats) {
                var stats = getNiceStats(i);

                requestData[i].shift();
                requestData[i].push([stats.timestamp, stats.request_rate]);
            }

            data[i].data = requestData[i];
        }

        return data;
    }

    getBandwidthPlotData = function() {
        var servers = app.getEnabledServers();
        var data = [];

        for (var i = 0; i < servers.length; i++) {
            data[i] = {};
            data[i].label = servers[i].name;

            if (servers[i].current_stats && servers[i].last_stats) {
                var stats = getNiceStats(i);

                bandwidthData[i].shift();
                bandwidthData[i].push([stats.timestamp, stats.transfer_rate]);
            }

            data[i].data = bandwidthData[i];
        }

        return data;
    }

    updateDashboardGraphs = function() {
        requestPlot.setData(getRequestPlotData());
        requestPlot.setupGrid();
        requestPlot.draw();

        bandwidthPlot.setData(getBandwidthPlotData());
        bandwidthPlot.setupGrid();
        bandwidthPlot.draw();
    }

    updateDashboardStats = function() {
        var servers = app.getEnabledServers();
        var stats = false;

        for (var i = 0; i < servers.length; i++) {
            if (servers[i].current_stats && servers[i].last_stats) {
                if (!stats) {
                    stats = getNiceStats(i);
                } else {
                    var newstats = getNiceStats(i);

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
})(window.app);
