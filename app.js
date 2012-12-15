
// TODO: clickable links for nav, does jsonp request, also can configure straight up graph requests...?

(function(window, document, undefined) {

    var logged_in = false,
        first_render = true,
        loaded_me = false;

    // handle a session response from any of the auth related calls
    function handleSessionResponse(response) {
        $('#loadingfb').remove();

        var outbtn = $('#logout').removeClass('invisible'),
            inbtn = $('button.login').removeClass('invisible');

        if (response.status === 'connected') {
            // the user is logged in and has authenticated your
            // app, and response.authResponse supplies
            // the user's ID, a valid access token, a signed
            // request, and the time the access token
            // and signed request each expire
            // var uid = response.authResponse.userID;
            // var accessToken = response.authResponse.accessToken;
            logged_in = true;

            inbtn.hide();
            outbtn.show();
            $('#permissions-header').removeClass('invisible');

            initData();
            getPermissions();

        // } else if (response.status === 'not_authorized') {
        //     // the user is logged in to Facebook,
        //     // but has not authenticated your app
        } else {
            // the user isn't logged in to Facebook.
            logged_in = false;
            loaded_me = false;
            first_render = true;
            $('#user-img').hide();
            $('#user-info p').hide();
            outbtn.hide();
            inbtn.show();
            $('#cur-url, #data, #history, #permissions').empty();
            $('#permissions-header').addClass('invisible');
        }
    }

    //
    // Permissions
    //

    var all_perms = [
        'publish_stream',
        'create_event',
        'rsvp_event',
        'sms',
        'offline_access',
        'user_about_me',
        'friends_about_me',
        'user_activities',
        'friends_activities',
        'user_birthday',
        'friends_birthday',
        'user_education_history',
        'friends_education_history',
        'user_events',
        'friends_events',
        'user_groups',
        'friends_groups',
        'user_hometown',
        'friends_hometown',
        'user_interests',
        'friends_interests',
        'user_likes',
        'friends_likes',
        'user_location',
        'friends_location',
        'user_notes',
        'friends_notes',
        'user_online_presence',
        'friends_online_presence',
        'user_photo_video_tags',
        'friends_photo_video_tags',
        'user_photos',
        'friends_photos',
        'user_relationships',
        'friends_relationships',
        'user_relationship_details',
        'friends_relationship_details',
        'user_religion_politics',
        'friends_religion_politics',
        'user_status',
        'friends_status',
        'user_videos',
        'friends_videos',
        'user_website',
        'friends_website',
        'user_work_history',
        'friends_work_history',
        'email',
        'read_friendlists',
        'read_insights',
        'read_mailbox',
        'read_requests',
        'read_stream',
        'xmpp_login',
        'ads_management',
        'user_checkins',
        'friends_checkins',
        'manage_pages'
    ];

    function getPermissions() {
        var query = 'SELECT ' + all_perms.join() + ' FROM permissions WHERE uid = me()';
        FB.api(
            {
                method: 'fql.query',
                query: query
            },
            function(response) {
                if ($.isArray(response)) {
                    var html = [];
                    $.each(response[0], function(k,v) {
                        v = parseInt(v);
                        html.push('<li><a href="#' + escape(k) + '" onclick="return false" class="' + (v ? 'yes' : 'no')+ '">' + escape(k) + ': ' + escape(v) + '</a></li>');
                    });
                    $('#permissions').html(html.join(''));
                    $('button.request-permissions').removeClass('invisible');
                }
                //console.log('response', response);
            }
        );
    }

    $('#permissions').delegate('a', 'click', function(evt) {
        evt.preventDefault();
        if (!logged_in) {
            alert('You must be Facebook Connected to toggle permissions!');
        } else {
            var $t = $(this), delim = ': ', text = $t.text().split(delim);
            if (!$t.hasClass('yes')) {
                if ($t.hasClass('wait')) {
                    text[1] = '0';
                    $t.removeClass('wait').text(text.join(delim)).attr('title', '');
                } else {
                    text[1] = '1*';
                    $t.addClass('wait').text(text.join(delim)).attr('title', 'Click the "request selected perms" button to update');
                }
            }
        }
    });

    var _updating_perms = false;
    $('button.request-permissions').click(function(evt) {
        evt.preventDefault();
        if (_updating_perms) return;
        var perms = $('#permissions').find('a.wait').map(function() { return $(this).attr('href').substring(1); }).get();
        if (perms.length) {
            _updating_perms = true;
            requestPermissions(perms, function(response) {
                //console.log('requestPermissions response:', response);
                if (response.perms) {
                    $.each(response.perms.split(','), function() {
                        $('#permissions a[href=#'+this+']').attr('class', 'yes').text(this + ': 1').attr('title', '');
                    });
                    History.reload();
                }
                _updating_perms = false;
            });
        } else {
            alert('You must choose a permission first!');
        }
    });

    function requestPermissions(perms, cb) {
        if ($.isArray(perms)) perms = perms.join();
        FB.ui(
            {
                method: 'permissions.request',
                perms: perms
            },
            cb
        );
    }


    //
    // Graph Viewing magic
    //


    // Bookmarks

    function objectClickHandler(evt) {
        evt.preventDefault();
        var $t = $(this),
            path = $t.attr('href').substring(1),
            title = $t.text();

        loadApi(path);
    }
    $('#objects').find('a').click(objectClickHandler);
    $('#data').add('#user-info').delegate('a.graph-path', 'click', objectClickHandler);

    $('#custom_path_form').submit(function(evt) {
        evt.preventDefault();
        var path = $.trim($('#id_path').val());
        if (path) {
            loadApi(path);
        }
    });


    // Data loading

    var Loading = {
        title: document.title,
        busy: false,
        start: function() {
            this.busy = true;
            document.title = 'loading...';
            $('body').addClass('loading');
        },
        stop: function() {
            $('body').removeClass('loading');
            document.title = this.title;
            this.busy = false;
        }
    };

    function initData() {
        loadApi('/me');
    }

    function loadApi(path) {
        return _loadApi(History.add(path));
    }

    function _loadApi(path) {
        Loading.start();
        FB.api(path, {metadata: 1}, function(response) {
            $('#cur-url').text(path);
            renderData(response);

            if (!loaded_me && path == '/me' && response.id) {
                loaded_me = true;
                $('#user-img').html('<img class="left" width="50" height="50" src="https://graph.facebook.com/' + response.id + '/picture?type=square">').show();
                $('#user-info p').show().find('span').html('Logged in as <strong>' + (response.name || 'user ' + response.id) + '</strong> &nbsp; <a class="graph-path" href="#/me">*view data*</a> &nbsp;<i>|</i>&nbsp; ').show(); //.show('fast');
            }
        });
    }

    function urlClick(url) {
        return _urlClick(History.add(url));
    }

    function _urlClick(url) {
        if (_rGraphUrl.test(url)) {
            Loading.start();
            $.ajax({
                url: url,
                data: {metadata: 1},
                dataType: 'jsonp',
                error: function(data, textStatus) {
                    Loading.stop();
                    alert('Error making request. ' + data + ' (' + textStatus + ')');
                },
                success: function(response, textStatus) {
                    var text = url.replace(_rGraphUrl, '').split('?')[0];
                    $('#cur-url').text(text);
                    renderData(response);
                }
            });
        }
    }

    $('#data').delegate('a.graph-url', 'click', function(evt) {
        evt.preventDefault();
        urlClick($(this).attr('href'));
    });

    // Rendering code

    function scrollToData() {
        var top = parseInt($('#gamma').offset().top) - 9;
        window.scrollTo(0, top);
    }

    function renderData(response) {
        var str = asString(response); //.split('\n').join('<br />').split('\t').join('&nbsp;&nbsp; &nbsp;');
        $('#data').html(str);

        // scrolling
        if (!first_render) {
            scrollToData();
        } else {
            first_render = false;
            //$('html, body').animate({scrollTop: top}, 1500);
        }

        // img hovering
        //console.log('Adding tooltip to:', $('#data').find('a.img'));
        $('#data').find('a.img').tooltip({
            delay: 0,
            showURL: false,
            bodyHandler: function() {
                //console.log('TOOLTIP!', this.href);
                return $('<img/>').attr('src', this.href);
            }
        });

        $('#data').find('ul.collapsable').find('.collapser').click(function(evt) {
            evt.preventDefault();
            var $t = $(this),
                text = $t.text(),
                open = '+',
                closed = '–';

            if (text == open) {
                $t.text(closed).siblings('.collapsable').show().siblings('.ellipses').remove();
            } else {
                $t.text(open).siblings('.collapsable').hide().before('<span class="ellipses">&nbsp;…&nbsp;</span>');
            }
        });

        // history
        History.show();

        // loading
        Loading.stop();
    }

    function _isCollapsable(obj) {
        return $.isArray(obj) || $.isPlainObject(obj);
    }

    var _rUrl = /^https?:\/\/([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?/,
        _rGraphUrl = /^https:\/\/graph\.facebook\.com/,
        _rId = /^[\d_]+$/,
        _rImg = /^https?:\/\/.*\.(jpg|jpeg|png|gif)$/;

    function asString(obj, depth) {
        var result, t,
            ul = '<ul class="collapsable"><li>',
            div_ul = ',</li><li>',
            collapse_html = '<div class="collapser">–</div>',
            close_ul = '</li></ul>';
        depth = depth || 0;
        if ($.isPlainObject(obj)) {
            result = [];
            $.each(obj, function(k,v) {
                var collapsable = false;

                // browse-able ids
                t = k == 'id' && _rId.test(v) ? ' <a class="graph-path" href="#/' + v + '">&raquo;</a>' : '';

                // photo special case
                if (k == 'picture' && _rGraphUrl.test(v)) {
                    v = '<a target="_blank" class="img" href="' + escape(v) + '">' + escape(v) + '</a>';
                } else {
                    collapsable = _isCollapsable(v);
                    v = asString(v, depth + 1);
                }

                result.push((collapsable ? collapse_html : '') + '<span class="key">' + escape(k) + '</span>: ' + v + t);
            });
            return ('{' + ul
                    + result.join(div_ul)
                    + close_ul + '}');
        } else if ($.isArray(obj)) {
            return ('[' + ul
                    + $.map(obj, function(x) {
                        return (_isCollapsable(x) ? collapse_html : '') + asString(x, depth + 1);
                    }).join(div_ul)
                    + close_ul + ']');
        } else {
            if (typeof obj === 'string') {
                if (_rUrl.test(obj)) {
                    return '&quot;<a target="_blank" class="' + (_rGraphUrl.test(obj) ? 'graph-url' : (_rImg.test(obj) ? 'img' : '')) + '" href="' + escape(obj) + '">' + escape(obj) + '</a>&quot;'; //TODO - remove _blank?
                }
                return '<span class="str">' + escape('"'+obj+'"') + '</span>';
            } else {
                return escape(obj);
            }
        }
    }


    // escape from mustache.js - http://mustache.github.com/
    function escape(s) {
      return ((s == null) ? "" : s).toString().replace(/[&"<>\\]/g, function(s) {
          switch(s) {
            case "&": return "&amp;";
            case "\\": return "\\\\";;
            case '"': return '\"';;
            case "<": return "&lt;";
            case ">": return "&gt;";
          default: return s;
          }
      });
    }

    // History

    var History = {
        past: [],
        future: [],
        current: null,
        add: function(str, is_next) {
            if (!is_next && this.future.length) this.future = [];
            if (this.current) this.past.push(this.current);
            this.current = str;
            return str;
        },
        hasPrev: function() {
            return this.past.length > 0;
        },
        hasNext: function() {
            return this.future.length > 0;
        },
        prev: function() {
            return this.past[this.past.length-1];
        },
        next: function() {
            return this.future[this.future.length-1];
        },
        goPrev: function() {
            this.future.push(this.current);
            this._loadCurrent(this.current = this.past.pop());
        },
        goNext: function() {
            if (this.current) this.past.push(this.current);
            this._loadCurrent(this.current = this.future.pop());
        },
        reload: function() {
            this._loadCurrent(this.current);
        },
        _loadCurrent: function(current) {
            this.loading();
            (_rGraphUrl.test(current) ? _urlClick : _loadApi)(current);
        },
        show: function() {
            $(this.selector).html([
                this.hasPrev() ? '<a href="#" class="prev" title="' + escape(this.prev()) + '">&laquo; back</a>' : '',
                this.hasNext() ? '<a href="#" class="next" title="' + escape(this.next()) + '">next &raquo;</a>' : ''
            ].join('&nbsp; &nbsp;'));
        },
        loading: function() {
            $(this.selector).html('<span class="dim">loading...</span>');
        },
        init: function(selector) {
            this.selector = selector;
            var self = this;
            $(selector).delegate('a', 'click', function(evt) {
                evt.preventDefault();
                var $t = $(this);
                if ($t.hasClass('prev')) {
                    if (self.hasPrev()) {
                        self.goPrev();
                    }
                } else if ($t.hasClass('next')) {
                    if (self.hasNext()) {
                        self.goNext();
                    }
                }
            });

            // add support for hitting the back key to affect history - TODO - consider adding shift delete forward support?
            $(document).keydown(function(evt) {
                if (evt.keyCode == 8 && self.hasPrev()) {
                    var tag = (evt.target.localName || evt.target.nodeName).toLowerCase();
                    if (tag != 'input' && tag != 'textarea') {
                        evt.preventDefault();
                        self.goPrev();
                    }
                }
            });
        }
    };

    History.init('#history');


    //
    // Init
    //

    // async init function
    window.fbAsyncInit = function() {
        // initialize the library with the API key
        FB.init({
            appId: '163098883714272', //f4d5e8dec506f946e4b1eb7fb6dbc0f4',
            channelUrl: '//mrcoles.com/facebook-graph-api-explorer/channel.html',
            status: true,
            cookie: true,
            xfbml: false
        });

        // fetch the status on load
        FB.getLoginStatus(handleSessionResponse);

        $('button.login').click(function(evt) {
            evt.preventDefault();
		    FB.login(handleSessionResponse);
	    });

        $('#logout').click(function(evt) {
            evt.preventDefault();
		    FB.logout(handleSessionResponse);
	    });

        /*
        $('#disconnect').click(function(evt) {
            evt.preventDefault();
		    FB.api({ method: 'Auth.revokeAuthorization' }, function(response) {
			    clearDisplay();
		    });
	    });
        */
    };

    // Add the script
    var e = document.createElement('script'); e.async = true;
	e.src = document.location.protocol + '//connect.facebook.net/en_US/all.js';
	document.getElementById('fb-root').appendChild(e);

    $('span.help').tooltip({delay: 0, showURL: false, bottom: -10});

})(this, this.document);
