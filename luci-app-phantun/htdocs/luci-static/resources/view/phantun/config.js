/**
 * Copyright (C) 2026 iHub-2020
 * 
 * LuCI Phantun Manager - Configuration Page
 * Complete configuration interface for Phantun UDP obfuscator
 * 
 * Features:
 * - Multi-instance support (Client & Server modes)
 * - Tabbed interface (Basic/Advanced) for cleaner UI
 * - TUN interface configuration
 * - Input validation with safety checks
 * - Automatic iptables rule management
 * 
 * @module luci-app-phantun/config
 * @version 1.0.0
 * @date 2026-01-31
 */

'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require ui';
'require rpc';

var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

var callInitAction = rpc.declare({
    object: 'luci',
    method: 'setInitAction',
    params: ['name', 'action'],
    expect: { result: false }
});

return view.extend({
    title: _('Phantun Configuration'),

    load: function () {
        return Promise.all([
            uci.load('phantun'),
            L.resolveDefault(fs.stat('/usr/bin/phantun_client'), null),
            L.resolveDefault(fs.stat('/usr/bin/phantun_server'), null),
            L.resolveDefault(callServiceList('phantun'), null)
        ]);
    },

    render: function (data) {
        var clientInstalled = data[1] !== null;
        var serverInstalled = data[2] !== null;
        var serviceStatus = data[3] || {};

        // Check installation
        if (!clientInstalled && !serverInstalled) {
            return E('div', { 'class': 'alert-message warning' }, [
                E('h3', {}, _('Phantun Not Installed')),
                E('p', {}, _('The phantun binaries were not found. Please install them first:')),
                E('pre', { 'style': 'background: #f5f5f5; padding: 10px; border-radius: 4px;' },
                    'opkg update\nopkg install phantun'),
                E('p', {}, [
                    _('Or download from: '),
                    E('a', {
                        'href': 'https://github.com/dndx/phantun/releases',
                        'target': '_blank'
                    }, 'GitHub Releases')
                ])
            ]);
        }

        var m, s, o;

        m = new form.Map('phantun', _('Phantun Configuration'),
            _('Phantun is a lightweight UDP to TCP obfuscator. It creates TUN interfaces and requires proper iptables NAT rules. ' +
                'Configure client mode to connect to a server, or server mode to accept client connections.'));

        // ==================== Service Status Logic ====================
        var isRunning = false;
        var runningCount = 0;

        try {
            if (serviceStatus && serviceStatus.phantun && serviceStatus.phantun.instances) {
                var instances = serviceStatus.phantun.instances;
                for (var key in instances) {
                    if (instances[key].running) {
                        isRunning = true;
                        runningCount++;
                    }
                }
            }
        } catch (e) { console.error(e); }

        var statusColor = isRunning ? '#5cb85c' : '#d9534f';
        var statusText = isRunning
            ? _('Running') + ' (' + runningCount + ' ' + _('instances active') + ')'
            : _('Stopped');

        // ==================== Info & Warning Area ====================
        m.description = E('div', {}, [
            // Status Bar
            E('div', { 'class': 'cbi-section', 'style': 'margin-bottom: 10px; padding: 10px; background: #2d3a4a; border-radius: 5px;' }, [
                E('table', { 'style': 'width: auto;' }, [
                    E('tr', {}, [
                        E('td', { 'style': 'font-weight: bold; padding-right: 10px;' }, _('Service Status:')),
                        E('td', {}, E('span', { 'style': 'color: ' + statusColor + '; font-weight: bold;' }, statusText))
                    ])
                ])
            ]),
            // Important Information
            E('div', { 'class': 'alert-message info', 'style': 'margin-bottom: 20px;' }, [
                E('h4', { 'style': 'margin: 0 0 10px 0;' }, '💡 ' + _('Phantun Information')),
                E('ul', { 'style': 'margin: 0; padding-left: 20px;' }, [
                    E('li', {}, _('Phantun creates TUN interfaces and uses FakeTCP to obfuscate UDP traffic.')),
                    E('li', {}, _('Client mode requires MASQUERADE iptables rules (automatically added).')),
                    E('li', {}, _('Server mode requires DNAT iptables rules (automatically added).')),
                    E('li', {}, _('No encryption - Phantun focuses on pure obfuscation for maximum performance.')),
                    E('li', {}, _('MTU overhead is only 12 bytes (TCP header - UDP header).'))
                ])
            ])
        ]);

        // ==================== General Settings ====================
        s = m.section(form.TypedSection, 'general', _('General Settings'),
            _('Global settings for the Phantun daemon.'));
        s.anonymous = true;
        s.addremove = false;

        o = s.option(form.Flag, 'enabled', _('Enable Service'),
            _('Master switch. If disabled, no instances will run.'));
        o.default = '1';
        o.rmempty = false;

        o = s.option(form.ListValue, 'log_level', _('Log Level'),
            _('Logging verbosity (uses RUST_LOG environment variable).'));
        o.value('error', _('Error'));
        o.value('warn', _('Warning'));
        o.value('info', _('Info (Default)'));
        o.value('debug', _('Debug'));
        o.value('trace', _('Trace (Very Verbose)'));
        o.default = 'info';

        // ==================== Client Instances ====================
        s = m.section(form.GridSection, 'client', _('Client Instances'),
            _('<b>Client Mode:</b> OpenWrt listens for UDP locally and connects to a remote Phantun server.<br/>' +
                'Traffic Flow: Local UDP App → Phantun Client → [TCP Obfuscated] → Remote Phantun Server → Remote UDP Service.'));
        s.anonymous = false;
        s.addremove = true;
        s.sortable = true;
        s.nodescriptions = true;
        s.addbtntitle = _('Add Client');

        s.sectiontitle = function (section_id) {
            var alias = uci.get('phantun', section_id, 'alias');
            return alias ? (alias + ' (Client)') : _('New Client');
        };

        s.handleAdd = function (ev) {
            var section_id = uci.add('phantun', 'client');
            uci.set('phantun', section_id, 'enabled', '1');
            uci.set('phantun', section_id, 'local_addr', '127.0.0.1');
            uci.set('phantun', section_id, 'local_port', '51820');
            uci.set('phantun', section_id, 'tun_local', '192.168.200.1');
            uci.set('phantun', section_id, 'tun_peer', '192.168.200.2');
            uci.set('phantun', section_id, 'ipv4_only', '0');
            uci.set('phantun', section_id, 'tun_local6', 'fcc8::1');
            uci.set('phantun', section_id, 'tun_peer6', 'fcc8::2');
            return this.renderMoreOptionsModal(section_id);
        };

        s.tab('basic', _('Basic Settings'));
        s.tab('advanced', _('Advanced Settings'));

        // Table Columns
        o = s.taboption('basic', form.Flag, 'enabled', _('Enable'));
        o.default = '1';
        o.editable = true;
        o.width = '10%';
        o.rmempty = false;

        o = s.taboption('basic', form.Value, 'alias', _('Alias'));
        o.placeholder = 'My Client';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('basic', form.Value, 'remote_addr', _('Server Address'));
        o.datatype = 'host';
        o.rmempty = false;
        o.width = '20%';

        o = s.taboption('basic', form.Value, 'remote_port', _('Server Port'));
        o.datatype = 'port';
        o.rmempty = false;
        o.width = '10%';

        o = s.taboption('basic', form.Value, 'local_port', _('Local UDP Port'));
        o.datatype = 'port';
        o.rmempty = false;
        o.width = '10%';

        // Modal Only Options - Basic
        o = s.taboption('basic', form.Value, 'local_addr', _('Local UDP Address'),
            _('IP address to bind for incoming UDP packets. Use 127.0.0.1 for WireGuard/OpenVPN.'));
        o.datatype = 'ipaddr';
        o.default = '127.0.0.1';
        o.modalonly = true;

        // Advanced Settings
        o = s.taboption('advanced', form.Flag, 'ipv4_only', _('IPv4 Only'),
            _('Only use IPv4. Disables IPv6 addresses on TUN interface.'));
        o.default = '0';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_name', _('TUN Interface Name'),
            _('Custom name for TUN interface. Leave empty for auto-assign (tun0, tun1, etc).'));
        o.placeholder = 'tun0';
        o.optional = true;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_local', _('TUN Local IPv4'),
            _('IPv4 address for OS side of TUN interface.'));
        o.datatype = 'ip4addr';
        o.default = '192.168.200.1';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_peer', _('TUN Peer IPv4'),
            _('IPv4 address for Phantun side of TUN interface. MASQUERADE rules will be added for this IP.'));
        o.datatype = 'ip4addr';
        o.default = '192.168.200.2';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_local6', _('TUN Local IPv6'),
            _('IPv6 address for OS side of TUN interface.'));
        o.datatype = 'ip6addr';
        o.default = 'fcc8::1';
        o.depends('ipv4_only', '0');
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_peer6', _('TUN Peer IPv6'),
            _('IPv6 address for Phantun side of TUN interface.'));
        o.datatype = 'ip6addr';
        o.default = 'fcc8::2';
        o.depends('ipv4_only', '0');
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'handshake_packet', _('Handshake Packet File'),
            _('Path to file containing custom handshake packet to send after TCP connection. Advanced feature.'));
        o.optional = true;
        o.modalonly = true;

        // ==================== Server Instances ====================
        s = m.section(form.GridSection, 'server', _('Server Instances'),
            _('<b>Server Mode:</b> OpenWrt listens for TCP connections from Phantun clients and forwards to local UDP service.<br/>' +
                'Traffic Flow: Remote Phantun Client → [TCP Obfuscated] → Phantun Server → Local UDP Service.'));
        s.anonymous = false;
        s.addremove = true;
        s.sortable = true;
        s.nodescriptions = true;
        s.addbtntitle = _('Add Server');

        s.sectiontitle = function (section_id) {
            var alias = uci.get('phantun', section_id, 'alias');
            return alias ? (alias + ' (Server)') : _('New Server');
        };

        s.handleAdd = function (ev) {
            var section_id = uci.add('phantun', 'server');
            uci.set('phantun', section_id, 'enabled', '1');
            uci.set('phantun', section_id, 'local_port', '4567');
            uci.set('phantun', section_id, 'remote_addr', '127.0.0.1');
            uci.set('phantun', section_id, 'remote_port', '51820');
            uci.set('phantun', section_id, 'tun_local', '192.168.201.1');
            uci.set('phantun', section_id, 'tun_peer', '192.168.201.2');
            uci.set('phantun', section_id, 'ipv4_only', '0');
            uci.set('phantun', section_id, 'tun_local6', 'fcc9::1');
            uci.set('phantun', section_id, 'tun_peer6', 'fcc9::2');
            return this.renderMoreOptionsModal(section_id);
        };

        s.tab('basic', _('Basic Settings'));
        s.tab('advanced', _('Advanced Settings'));

        // Table Columns
        o = s.taboption('basic', form.Flag, 'enabled', _('Enable'));
        o.default = '1';
        o.editable = true;
        o.width = '10%';
        o.rmempty = false;

        o = s.taboption('basic', form.Value, 'alias', _('Alias'));
        o.placeholder = 'My Server';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('basic', form.Value, 'local_port', _('TCP Listen Port'));
        o.datatype = 'port';
        o.rmempty = false;
        o.width = '15%';

        o = s.taboption('basic', form.Value, 'remote_addr', _('Forward To IP'));
        o.datatype = 'host';
        o.placeholder = '127.0.0.1';
        o.rmempty = false;
        o.width = '20%';

        o = s.taboption('basic', form.Value, 'remote_port', _('Forward To Port'));
        o.datatype = 'port';
        o.rmempty = false;
        o.width = '15%';

        // Advanced Settings
        o = s.taboption('advanced', form.Flag, 'ipv4_only', _('IPv4 Only'),
            _('Do not assign IPv6 addresses to TUN interface.'));
        o.default = '0';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_name', _('TUN Interface Name'),
            _('Custom name for TUN interface. Leave empty for auto-assign.'));
        o.placeholder = 'tun0';
        o.optional = true;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_local', _('TUN Local IPv4'),
            _('IPv4 address for OS side of TUN interface.'));
        o.datatype = 'ip4addr';
        o.default = '192.168.201.1';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_peer', _('TUN Peer IPv4'),
            _('IPv4 address for Phantun side. DNAT rules will redirect to this IP.'));
        o.datatype = 'ip4addr';
        o.default = '192.168.201.2';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_local6', _('TUN Local IPv6'),
            _('IPv6 address for OS side of TUN interface.'));
        o.datatype = 'ip6addr';
        o.default = 'fcc9::1';
        o.depends('ipv4_only', '0');
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_peer6', _('TUN Peer IPv6'),
            _('IPv6 address for Phantun side of TUN interface.'));
        o.datatype = 'ip6addr';
        o.default = 'fcc9::2';
        o.depends('ipv4_only', '0');
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'handshake_packet', _('Handshake Packet File'),
            _('Path to file containing custom handshake packet. Advanced feature.'));
        o.optional = true;
        o.modalonly = true;

        // ==================== Override Save & Apply ====================
        m.handleSaveApply = function (ev, mode) {
            return this.save(function () {
                ui.showModal(_('Applying Configuration'), [
                    E('p', { 'class': 'spinning' }, _('Saving configuration...'))
                ]);

                // Get the enabled status from general section
                var enabled = uci.get('phantun', uci.sections('phantun', 'general')[0]['.name'], 'enabled');
                var action = enabled === '1' ? 'restart' : 'stop';

                return callInitAction('phantun', action).then(function () {
                    ui.hideModal();
                    ui.addNotification(null, E('p', _('Configuration applied successfully')), 'info');
                    setTimeout(function () { window.location.reload(); }, 1500);
                }).catch(function (err) {
                    ui.hideModal();
                    ui.addNotification(null, E('p', _('Configuration saved but failed to control service: ') + (err.message || err)), 'error');
                });
            });
        };

        return m.render();
    }
});
