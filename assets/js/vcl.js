(function(app) {
    'use strict';

    var current_vcl, active_vcl, raw_vcl, html_vcl;

    app.ready(function() {
        if (app.isGroupView()) {
            $('.page-body').html('<div class="alert alert-danger" role="alert">This page does not work in server group mode, please select a single server to view</div>');
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

            $('#vcl-file').html(html_vcl = highlightVcl(response));

        }, 'text');
    }

    // TODO: Implement a proper parser instead of hacky regexes
    function highlightVcl(vcl) {
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
        vcl = vcl.replace(/(\s|^)(acl|import|backend|sub|if|elsif|else|return|error|include|set|unset|remove|vcl)(\b)/mg, '$1<span class="vcl-keyword">$2</span>$3');

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
})(window.app);
