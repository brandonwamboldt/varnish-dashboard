Enhanced Varnish Dashboard
==========================

This is a realtime HTML dashboard designed to utilize [Varnish Agent 2](https://github.com/varnish/vagent2). This
dashboard is simple to install and features a stats dashboard suitable for a
NOC, as well as controls for viewing logs, stats, VCL, and managing the varnish
server (restart, update VCL, purge URLs, etc).

Enhanced Varnish Dashboard also has support for multiple varnish servers, and
allows users to view a combined view (useful if you have multiple duplicate
varnish servers for redundancy), as well as individual views.

Screenshots
-----------

**Dashboard:**

![Dashboard Screenshot](https://i.imgur.com/PSBjz7y.png)

**Bans:**

![Bans Screenshot](https://i.imgur.com/UhDpRFS.png)

**Manage Server:**

![Manage Screenshot](https://i.imgur.com/p12QI1i.png)

**VCL:**

![VCL Screenshot](https://i.imgur.com/IrDQLo8.png)

**Logs:**

![Logs Screenshot](https://i.imgur.com/a7E9rip.png)

Setup
-----

**Step 1: Install Varnish Agent 2**

The agent must be installed on the same server running Varnish. You can clone and compile the source code or install it using the following packages for Debian/Ubuntu and RHEL/CentOS: http://users.varnish-software.com/~kristian/agent/

Alternatively, if you have installed Varnish via official yum repository on RHEL/CentOS, you can install varnish-agent directly via:

```
yum install --nogpgcheck varnish-agent
```

I recommend that you read the docs on the GitHub repo and this post: http://kly.no/posts/2013_01_22_Varnish_Agent.html

You may have to create a file with username and password: /etc/varnish/agent_secret. Every line of this file is a user and a password with the following format:

```
username:password
```

**Step 2: Download this dashboard**

You can download this dashboard using one of the release packages or by using Git clone, it does not matter. You can install the dashboard on the same server as Varnish, and serve it using the Varnish Agent (with the `-H` option), or you can run it on a stand-alone server using Apache or Nginx (or you can load it locally, it doesn't even need a web server!).

Example of installing it locally:

```
mkdir -p /var/www/html
cd /var/www/html
git clone git://github.com/brandonwamboldt/varnish-dashboard.git
```

**Step 3: Configure the dashboard**

While configuration isn't necessary if you're using the basic varnish agent setup,
it is still recommended. Simply copy `config.example.js` to `config.js` and set the
appropriate options.

**Step 4 (Optional): Start Varnish Agent with the dashboard**

If you're going with the option to serve the dashboard using the Varnish Agent,
just run the agent like this:

```
varnish-agent -H /var/www/html/varnish-dashboard
```

And visit `http://<varnish_ip>:6085/html/`.

Configuration
-------------

Configuration is handled via a `config.js` file, which should have this format:

```javascript
var config = {
	servers: [{
		name: "Varnish",
		host: null,
		port: 6085,
		user: false,
		pass: false
	}],
	groups: [],
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
```

Important note, this is JavaScript, so make sure you don't have a trailing `,` after your last item or it will break.

### servers

Servers is an array of objects to configure Varnish Agent backends. Eventually we'll support multiple backend servers (see known issues).

**name:**

Used purely for display purposes, name it whatever you want.

**host:**

The hostname/domain/ip of the varnish agent instance. Leave `null` to use whatever host is ued to access the dashboard (which is the most common use case).

**port:**

The varnish agent port. `6085` is the default port.

**user:**

The varnish agent username. If you are using the same host for the dashboard and the varnish agent (e.g. running the agent with the `-H` flag) this is not required and can be left as `false`. Otherwise it IS required.

**pass:**

The varnish agent password. If you are using the same host for the dashboard and the varnish agent (e.g. running the agent with the `-H` flag) this is not required and can be left as `false`. Otherwise it IS required.

### groups

Groups is an array of objects to configure groups of Varnish Agent backends. Grouped backends are operated on as a group (stats are aggregated, operations apply to each server in the group, logs are combined, etc).

**name:**

Used purely for display purposes, name it whatever you want.

**servers:**

An array of servers that are part of this group. Each item should be the server **name**. It must exactly match the name as defined in `servers`.

### update_freq

The frequency of updates for stats & status information, in milliseconds. The default value, `2000` is 2 seconds.

### max_points

The maximum number of data points to render on the bandwidth/requests per second graphs on the dashboard. Higher numbers are slower to render, but result in a more detailed graph.

### default_log_fetch

The default number of log entries to **fetch** from Varnish. Logs are retrieved in chronological order, with the oldest first, so it's best to make this a really high number if you want to see recent log entries (since they come last). This is an API constraint with no work around.

### default_log_display

The default number of log entries to **display** from Varnish. Logs are displayed in reverse chronological order, with the newest first. It's recommended not to make this number too high or it may slow down your browser.

### show_bans_page

Whether or not to display the "Bans" page in the nav.

Users can still figure out how to hit appropriate Varnish Admin endpoints directly, so don't use this as a security feature. Think of it as a way to prevent users from accidentally breaking stuff.

### show_manage_server_page

Whether or not to display the "Manage Server" page in the nav.

Users can still figure out how to hit appropriate Varnish Admin endpoints directly, so don't use this as a security feature. Think of it as a way to prevent users from accidentally breaking stuff.

### show_vcl_page

Whether or not to display the "VCL" page in the nav.

Users can still figure out how to hit appropriate Varnish Admin endpoints directly, so don't use this as a security feature. Think of it as a way to prevent users from accidentally breaking stuff.

### show_stats_page

Whether or not to display the "Stats" page in the nav.

Users can still figure out how to hit appropriate Varnish Admin endpoints directly, so don't use this as a security feature. Think of it as a way to prevent users from accidentally breaking stuff.

### show_params_page

Whether or not to display the "Params" page in the nav.

Users can still figure out how to hit appropriate Varnish Admin endpoints directly, so don't use this as a security feature. Think of it as a way to prevent users from accidentally breaking stuff.

### show_logs_page

Whether or not to display the "Logs" page in the nav.

Users can still figure out how to hit appropriate Varnish Admin endpoints directly, so don't use this as a security feature. Think of it as a way to prevent users from accidentally breaking stuff.

### show_restart_varnish_btn

Whether or not to display the "Restart Varnish" button on the Manage Server page.

Users can still figure out how to hit appropriate Varnish Admin endpoints directly, so don't use this as a security feature. Think of it as a way to prevent users from accidentally breaking stuff.

Known Issues
------------

Due to cross site origin limitations, the dashboard will only work if it's on the same subdomain as varnish agent (meaning you must use it with the `-H` option of Varnish Agent, preventing the usage of multiple servers). I've submitted a [patch to Varnish Agent](https://github.com/varnish/vagent2/pull/129) to fix this, but until it's merged, only one varnish backend is supported.

