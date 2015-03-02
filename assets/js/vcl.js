(function(app) {
    var current_vcl, active_vcl, raw_vcl, html_vcl;

    $(document).ready(function() {
        if (app.isCombinedView()) {
            $('.page-body').html('<div class="alert alert-danger" role="alert">This page does not work in combined view mode, please select a specific server to view</div>');
        } else {
            $('.discard-vcl').on('click', function(e) {
                e.preventDefault();

                if (confirm('Are you sure you wish to discard this VCL?')) {
                    app.delete(app.getCurrentServer(), '/vcl/' + current_vcl, function(r, status, xhr) {
                        if (xhr.status === 500) {
                            alert('Could not discard VCL: ' + r);
                        } else {
                            $('#list-vcl-' + current_vcl).remove();
                            viewVcl(active_vcl);
                        }
                    });
                }
            });

            $('.create-vcl').on('click', function(e) {
                e.preventDefault();

                $('.panel.new-vcl').show();
                $('.panel.view-vcl').hide();
                $(this).addClass('disabled');
            });

            $('.cancel-vcl').on('click', function(e) {
                e.preventDefault();

                $('.panel.new-vcl').hide();
                $('.panel.view-vcl').show();
                $('.create-vcl').removeClass('disabled');
            });

            $('.raw-vcl').on('click', function(e) {
                e.preventDefault();

                if ($(this).hasClass('html-vcl')) {
                    $('#vcl-file').html(html_vcl);
                    $(this).removeClass('html-vcl');
                } else {
                    $('#vcl-file').text(raw_vcl);
                    $(this).addClass('html-vcl');
                }
            });

            $('.deploy-vcl').on('click', function(e) {
                e.preventDefault();

                if (confirm('Are you sure you want to deploy this VCL?')) {
                    var deploy_vcl = current_vcl;

                    app.put(app.getCurrentServer(), '/vcldeploy/' + deploy_vcl, function(r, status, xhr) {
                        if (xhr.status === 500 && !r.match(/Deployed ok/i)) {
                            alert('VCL deploy failed: ' + r);
                        } else {
                            $('.list-vcl-status').text('available');
                            $('#list-vcl-' + deploy_vcl + ' .list-vcl-status').text('active');
                            active_vcl = deploy_vcl;

                            if (current_vcl === deploy_vcl) {
                                $('#current-vcl-name span').text(current_vcl + ' (active)');
                            }
                        }
                    });
                }
            });

            $('.save-vcl').on('click', function(e) {
                e.preventDefault();

                $('#new-vcl-name-fg').removeClass('has-error');
                $('#new-vcl-input-fg').removeClass('has-error');

                if ($('#new-vcl-name').val() == '') {
                    $('#new-vcl-name-fg').addClass('has-error');
                    alert('You must enter a name for your VCL');
                } else if ($('#new-vcl-input').val() == '') {
                    $('#new-vcl-input-fg').addClass('has-error');
                    alert('You must enter your VCL file in the textarea');
                } else {
                    var vcl = $('#new-vcl-input').val();
                    var name = $('#new-vcl-name').val();

                    app.put(app.getCurrentServer(), '/vcl/' + name, vcl, function(r, status, xhr) {
                        if (xhr.status === 500 && !r.match(/VCL stored in varnish OK/i)) {
                            $('#new-vcl-input-fg').addClass('has-error');
                            alert(r);
                        } else {
                            $('#new-vcl-input').val('');
                            $('#new-vcl-name').val('');
                            $('.panel.new-vcl').hide();
                            $('.panel.view-vcl').show();
                            $('.create-vcl').removeClass('disabled');
                            viewVcl(name);
                            listVcl();
                            alert(r);
                        }
                    });
                }
            });

            app.get(app.getCurrentServer(), '/vclactive', function(response) {
                active_vcl = response;

                viewVcl(active_vcl);
            }, 'text');

            listVcl();
        }
    });

    function listVcl() {
        app.get(app.getCurrentServer(), '/vcljson/', function(response) {
            $('#server-vcls tbody').html('');

            for (var i = 0; i < response.vcls.length; i++) {
                var html = '';
                html += '<tr id="list-vcl-' + response.vcls[i].name + '">';
                html += '<td class="list-vcl-name">' + response.vcls[i].name + '</td>';
                html += '<td class="list-vcl-status">' + response.vcls[i].status + '</td>';

                if (current_vcl == response.vcls[i].name || (!current_vcl && response.vcls[i].status == 'active')) {
                    html += '<td><a data-vcl="' + response.vcls[i].name + '" class="pull-right view-vcl btn btn-xs btn-default disabled"><i class="glyphicon glyphicon-search"></i> View</a></td>';
                } else {
                    html += '<td><a data-vcl="' + response.vcls[i].name + '" class="pull-right view-vcl btn btn-xs btn-default"><i class="glyphicon glyphicon-search"></i> View</a></td>';
                }

                html += '</tr>';

                $('#server-vcls tbody').append(html)
            }

            $('a.view-vcl').on('click', function(e) {
                e.preventDefault();

                viewVcl($(this).data('vcl'));
            });
        }, 'json');
    }

    function viewVcl(vcl) {
        var active = vcl === active_vcl;
        current_vcl = vcl;
        $('#current-vcl-name span').text(vcl + (active ? ' (active)' : ''));
        $('a.view-vcl').removeClass('disabled');
        $('#list-vcl-' + vcl + ' .view-vcl').addClass('disabled');

        if (active) {
            $('.deploy-vcl').addClass('disabled');
            $('.discard-vcl').addClass('disabled');
        } else {
            $('.deploy-vcl').removeClass('disabled');
            $('.discard-vcl').removeClass('disabled');
        }

        app.get(app.getCurrentServer(), '/vcl/' + vcl, function(response) {
            raw_vcl = response;

            $('#vcl-file').html(html_vcl = app.highlightVcl(response));

        }, 'text');
    }
})(window.app);
