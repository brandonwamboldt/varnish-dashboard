(function(app) {
    app.ready(function() {
        $('#server-ban').on('submit', function(e) {
            e.preventDefault();

            app.multiPost(app.getEnabledServers(), '/ban', 'req.url ~ ' + $('#server-ban input').val(), function(responses) {
                getBanList();
                $('#server-ban input').val('');
            }, 'text');
        });

        $('#server-ban2').on('submit', function(e) {
            e.preventDefault();

            app.multiPost(app.getEnabledServers(), '/ban', $('#server-ban2 input').val(), function(responses) {
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

            for (var i = 0; i < responses.length; i++) {
                var response = responses[i].split("\n");
                response.shift(response);

                for (var j = 0; j < response.length; j++) {
                    if (response[j] === '') {
                        continue;
                    }

                    var ban = response[j].match(/^([0-9\.]+)\s+([0-9A-Za-z]+)\s+(.*)/);
                    banList[ban[1]] = { timestamp: parseFloat(ban[1]), refs: ban[2], ban: ban[3] };
                    banListKeys.push(ban[1]);
                }
            }

            banListKeys.sort();
            $('#server-bans tbody').html('');

            for (var i = 0; i < banListKeys.length; i++) {
                var ban = banList[banListKeys[i]];

                $('#server-bans tbody').append('<tr><td>' + ban.timestamp + '</td><td>' + ban.refs + '</td><td>' + ban.ban + '</td></tr>');
            }

            if (banListKeys.length === 0) {
                $('#server-bans tbody').append('<tr><td colspan="3">Nothing in the ban list</td></tr>');
            }
        }, 'text');
    }
})(window.app);
