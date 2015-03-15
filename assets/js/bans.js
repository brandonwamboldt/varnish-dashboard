(function(app) {
    'use strict';

    app.ready(function() {
        if (app.isGroupView()) {
            $('.page-body').prepend('<div class="alert alert-warning" role="alert">NOTE: You are in the server group view, bans will be executed on all servers in the current group</div>');
        }

        $('#server-ban').on('submit', function(e) {
            e.preventDefault();

            app.multiPost(app.getEnabledServers(), '/ban', 'req.url ~ ' + $('#server-ban input').val(), function() {
                getBanList();
                $('#server-ban input').val('');
            }, 'text');
        });

        $('#server-ban2').on('submit', function(e) {
            e.preventDefault();

            app.multiPost(app.getEnabledServers(), '/ban', $('#server-ban2 input').val(), function() {
                getBanList();
                $('#server-ban2 input').val('');
            }, 'text');
        });

        getBanList();
    });

    function getBanList() {
        var servers = app.getEnabledServers();

        app.multiGet(servers, '/ban', function(responses) {
            var banList = {};
            var banListKeys = [];

            responses.forEach(function(r) {
                var response = r.response.split("\n");
                response.shift(response);

                for (var j = 0; j < response.length; j++) {
                    if (response[j] === '') {
                        continue;
                    }

                    var ban = response[j].match(/^([0-9\.]+)\s+([0-9]+) ?([CG])?\s+(.*)/);
                    var state = '';

                    if (ban[3] === 'G') {
                        state = '<abbr title="Gone">G</abbr>';
                    } else if (ban[3] === 'C') {
                        state = '<abbr title="Completed">C</abbr>';
                    }

                    banList[ban[1]] = { timestamp: parseFloat(ban[1]), refs: ban[2], state: state, ban: ban[4] };
                    banListKeys.push(ban[1]);
                }
            });

            banListKeys.sort();
            $('#server-bans tbody').html('');

            for (var i = 0; i < banListKeys.length; i++) {
                var ban = banList[banListKeys[i]];

                $('#server-bans tbody').append('<tr><td>' + ban.timestamp + '</td><td>' + ban.refs + '</td><td>' + ban.state + '</td><td>' + ban.ban + '</td></tr>');
            }

            if (banListKeys.length === 0) {
                $('#server-bans tbody').append('<tr><td colspan="4">Nothing in the ban list</td></tr>');
            }
        }, 'text');
    }
})(window.app);
