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
            E('div', { 'class': 'alert-message warning', 'style': 'margin-bottom: 20px; background-color: #d4a017;' }, [
                E('h4', { 'style': 'margin: 0 0 10px 0;' }, '⚠️ ' + _('重要安全信息')),
                E('ul', { 'style': 'margin: 0; padding-left: 20px;' }, [
                    E('li', {}, _('Phantun 创建 TUN 接口并使用 FakeTCP 混淆 UDP 流量。')),
                    E('li', {}, _('客户端模式需要 MASQUERADE iptables 规则（自动添加）。')),
                    E('li', {}, _('服务器模式需要 DNAT iptables 规则（自动添加）。')),
                    E('li', {}, _('无加密 - Phantun 专注于纯混淆以实现最大性能。')),
                    E('li', {}, _('MTU 开销仅为 12 字节（TCP 头 - UDP 头）。'))
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


        // ==================== Server Instances ====================
        s = m.section(form.GridSection, 'server', _('服务器端实例'),
            _('<b>服务器模式:</b> OpenWrt 监听来自 Phantun 客户端的 TCP 连接并转发到本地 UDP 服务。<br/>' +
                '流量流向: 远程 Phantun 客户端 → [TCP 混淆] → Phantun 服务器 → 本地 UDP 服务。'));
        s.anonymous = false;
        s.addremove = true;
        s.sortable = true;
        s.nodescriptions = true;
        s.addbtntitle = _('添加服务器');

        s.sectiontitle = function (section_id) {
            var alias = uci.get('phantun', section_id, 'alias');
            return alias ? (alias + ' (Server)') : _('新服务器');
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

        s.tab('basic', _('基础设置'));
        s.tab('advanced', _('高级设置'));

        // Table Columns
        o = s.taboption('basic', form.Flag, 'enabled', _('启用'));
        o.default = '1';
        o.editable = true;
        o.width = '10%';
        o.rmempty = false;

        o = s.taboption('basic', form.Value, 'alias', _('别名'));
        o.placeholder = 'MyServer';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('basic', form.Value, 'local_port', _('TCP 监听端口'));
        o.datatype = 'port';
        o.rmempty = false;
        o.width = '15%';

        o = s.taboption('basic', form.Value, 'remote_addr', _('转发到 IP'));
        o.datatype = 'host';
        o.placeholder = '127.0.0.1';
        o.rmempty = false;
        o.width = '20%';

        o = s.taboption('basic', form.Value, 'remote_port', _('转发到端口'));
        o.datatype = 'port';
        o.rmempty = false;
        o.width = '15%';

        // Advanced Settings
        o = s.taboption('advanced', form.Flag, 'ipv4_only', _('仅 IPv4'),
            _('仅使用 IPv4（不分配 IPv6 地址到 TUN 接口）。'));
        o.default = '0';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_name', _('TUN 接口名称'),
            _('TUN 接口自定义名称。留空则自动分配（tun0、tun1 等）。'));
        o.placeholder = 'tun0';
        o.optional = true;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_local', _('TUN 本地 IPv4'),
            _('本地系统的 TUN 接口 IPv4 地址（系统侧）。默认 192.168.201.1。'));
        o.datatype = 'ip4addr';
        o.default = '192.168.201.1';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_peer', _('TUN 对端 IPv4'),
            _('Phantun 服务端的 TUN 接口 IPv4 地址（程序侧）。系统会自动添加 DNAT 规则，将 TCP 流量转发到此地址。默认 192.168.201.2。'));
        o.datatype = 'ip4addr';
        o.default = '192.168.201.2';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_local6', _('TUN 本地 IPv6'),
            _('本地系统的 TUN 接口 IPv6 地址（系统侧）。默认 fcc9::1。'));
        o.datatype = 'ip6addr';
        o.default = 'fcc9::1';
        o.depends('ipv4_only', '0');
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_peer6', _('TUN 对端 IPv6'),
            _('Phantun 服务端的 TUN 接口 IPv6 地址（程序侧）。默认 fcc9::2。'));
        o.datatype = 'ip6addr';
        o.default = 'fcc9::2';
        o.depends('ipv4_only', '0');
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'handshake_packet', _('握手数据包文件'),
            _('自定义握手包文件路径（高级功能，一般无需设置）。用于在 TCP 连接建立后发送特定数据包。'));
        o.optional = true;
        o.modalonly = true;

        // ==================== Client Instances ====================
        s = m.section(form.GridSection, 'client', _('客户端实例'),
            _('<b>客户端模式:</b> OpenWrt 在本地监听 UDP 并连接到远程 Phantun 服务器。<br/>' +
                '流量流向: 本地 UDP 应用 → Phantun 客户端 → [TCP 混淆] → 远程 Phantun 服务器 → 远程 UDP 服务。'));
        s.anonymous = false;
        s.addremove = true;
        s.sortable = true;
        s.nodescriptions = true;
        s.addbtntitle = _('添加客户端');

        s.sectiontitle = function (section_id) {
            var alias = uci.get('phantun', section_id, 'alias');
            return alias ? (alias + ' (Client)') : _('新客户端');
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

        s.tab('basic', _('基础设置'));
        s.tab('advanced', _('高级设置'));

        // Table Columns
        o = s.taboption('basic', form.Flag, 'enabled', _('启用'));
        o.default = '1';
        o.editable = true;
        o.width = '10%';
        o.rmempty = false;

        o = s.taboption('basic', form.Value, 'alias', _('别名'));
        o.placeholder = 'MyClient';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('basic', form.Value, 'remote_addr', _('服务器地址'));
        o.datatype = 'host';
        o.rmempty = false;
        o.width = '20%';

        o = s.taboption('basic', form.Value, 'remote_port', _('服务器端口'));
        o.datatype = 'port';
        o.rmempty = false;
        o.width = '10%';

        o = s.taboption('basic', form.Value, 'local_port', _('本地 UDP 端口'));
        o.datatype = 'port';
        o.rmempty = false;
        o.width = '10%';

        // Modal Only Options - Basic
        o = s.taboption('basic', form.Value, 'local_addr', _('本地 UDP 地址'),
            _('绑定的本地 IP 地址，用于接收 UDP 数据包。通常使用 127.0.0.1。'));
        o.datatype = 'ipaddr';
        o.default = '127.0.0.1';
        o.modalonly = true;

        // Advanced Settings
        o = s.taboption('advanced', form.Flag, 'ipv4_only', _('仅 IPv4'),
            _('仅使用 IPv4（不分配 IPv6 地址到 TUN 接口）。'));
        o.default = '0';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_name', _('TUN 接口名称'),
            _('TUN 接口自定义名称。留空则自动分配（tun0、tun1 等）。'));
        o.placeholder = 'tun0';
        o.optional = true;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_local', _('TUN 本地 IPv4'),
            _('本地系统的 TUN 接口 IPv4 地址（系统侧）。默认 192.168.200.1。'));
        o.datatype = 'ip4addr';
        o.default = '192.168.200.1';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_peer', _('TUN 对端 IPv4'),
            _('Phantun 客户端的 TUN 接口 IPv4 地址（程序侧）。系统会自动为此地址添加 MASQUERADE 规则实现 NAT 转发。默认 192.168.200.2。'));
        o.datatype = 'ip4addr';
        o.default = '192.168.200.2';
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_local6', _('TUN 本地 IPv6'),
            _('本地系统的 TUN 接口 IPv6 地址（系统侧）。默认 fcc8::1。'));
        o.datatype = 'ip6addr';
        o.default = 'fcc8::1';
        o.depends('ipv4_only', '0');
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'tun_peer6', _('TUN 对端 IPv6'),
            _('Phantun 客户端的 TUN 接口 IPv6 地址（程序侧）。默认 fcc8::2。'));
        o.datatype = 'ip6addr';
        o.default = 'fcc8::2';
        o.depends('ipv4_only', '0');
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'handshake_packet', _('握手数据包文件'),
            _('自定义握手包文件路径（高级功能，一般无需设置）。用于在 TCP 连接建立后发送特定数据包。'));
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
