Enhanced Varnish Dashboard
==========================

This is a realtime HTML dashboard designed to utilize [Varnish Agent 2](https://github.com/varnish/vagent2). This
dashboard is simple to install and features a stats dashboard suitable for a
NOC, as well as controls for viewing logs, stats, VCL, and managing the varnish
server (restart, update VCL, purge URLs, etc).

Enhanced Varnish Dashboard also has support for multiple varnish servers, and
allows users to view a combined view (useful if you have multiple duplicate
varnish servers for redundancy), as well as individual views.

![Dashboard Screenshot](http://i.imgur.com/E6JwETH.png)

Setup
-----

**Step 1: Install Varnish Agent 2**

The agent must be installed on the same server running Varnish. You can clone and compile the source code or install it using the following packages for Debian/Ubuntu and RHEL/CentOS: http://users.varnish-software.com/~kristian/agent/

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

