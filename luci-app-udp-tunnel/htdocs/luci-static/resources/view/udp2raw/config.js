/**
 * Copyright (C) 2024 iHub-2020
 * 
 * LuCI UDP Tunnel Manager - Configuration Page
 * Complete configuration interface with validation and safety checks
 * 
 * Features:
 * - Multi-tunnel support (Server & Client modes)
 * - Tabbed interface (Basic/Advanced) for cleaner UI
 * - Input validation with security warnings
 * - Automatic iptables rule management for OpenWrt
 * 
 * @module luci-app-udp-tunnel/config
 * @version 1.9.1
 * @date 2026-01-12
 * 
 * Changelog:
 *   v1.9.1 - CRITICAL FIX: Added 'rmempty = false' to instance enabled flags.
 *            Prevents LuCI from removing the option when it matches default '1',
 *            which caused the init script to fallback to '0' (disabled).
 *   v1.9.0 - UI Restoration & Optimization.
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

return view.extend({
	title: _('UDP Tunnel Configuration'),
	
	load: function() {
		return Promise.all([
			uci.load('udp2raw'),
			L.resolveDefault(fs.stat('/usr/bin/udp2raw'), null),
			L.resolveDefault(callServiceList('udp2raw'), null)
		]);
	},
	
	render: function(data) {
		var udp2rawInstalled = data[1] !== null;
		var serviceStatus = data[2] || {};
		
		// Check installation
		if (!udp2rawInstalled) {
			return E('div', { 'class': 'alert-message warning' }, [
				E('h3', {}, _('Udp2raw Not Installed')),
				E('p', {}, _('The udp2raw binary was not found. Please install it first:')),
				E('pre', { 'style': 'background: #f5f5f5; padding: 10px; border-radius: 4px;' }, 
					'opkg update\nopkg install udp2raw'),
				E('p', {}, [
					_('Or download from: '),
					E('a', { 
						'href': 'https://github.com/wangyu-/udp2raw/releases',
						'target': '_blank'
					}, 'GitHub Releases')
				])
			]);
		}
		
		var m, s, o;
		
		m = new form.Map('udp2raw', _('UDP Tunnel Configuration'), 
			_('UDP Tunnel Manager converts UDP traffic into encrypted FakeTCP/UDP/ICMP traffic using raw sockets. ' +
			  'It helps bypass UDP firewalls. Please ensure "Key", "Raw Mode", "Cipher Mode", and "Auth Mode" match on both sides.'));
		
		// ==================== Service Status Logic ====================
		var isRunning = false;
		var runningCount = 0;
		
		try {
			if (serviceStatus && serviceStatus.udp2raw && serviceStatus.udp2raw.instances) {
				var instances = serviceStatus.udp2raw.instances;
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
			? _('Running') + ' (' + runningCount + ' ' + _('tunnels active') + ')'
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
			// Safety Warning (Restored 4 points)
			E('div', { 'class': 'alert-message warning', 'style': 'margin-bottom: 20px;' }, [
				E('h4', { 'style': 'margin: 0 0 10px 0;' }, '⚠️ ' + _('Critical Safety Information')),
				E('ul', { 'style': 'margin: 0; padding-left: 20px;' }, [
					E('li', {}, _('FakeTCP mode REQUIRES iptables rules to block kernel TCP RST packets.')),
					E('li', {}, _('On OpenWrt, iptables rules may be cleared when network settings change.')),
					E('li', {}, _('The "Keep Iptables Rules" option is STRONGLY recommended for OpenWrt.')),
					E('li', {}, _('Server Mode: You MUST specify "Forward To" address (usually 127.0.0.1).'))
				])
			])
		]);
		
		// ==================== Global Settings ====================
		s = m.section(form.TypedSection, 'general', _('General Settings'),
			_('Global settings for the udp2raw daemon.'));
		s.anonymous = true;
		s.addremove = false;
		
		// 1. Enable Service
		o = s.option(form.Flag, 'enabled', _('Enable Service'),
			_('Master switch. If disabled, no tunnels will run.'));
		o.default = '1';
		o.rmempty = false;
		
		// 2. Keep Iptables Rules
		o = s.option(form.Flag, 'keep_rule', _('Keep Iptables Rules'),
			_('Auto-restore iptables rules if cleared by system. Recommended.'));
		o.default = '1';

		// 3. Wait for Iptables Lock (Restored)
		o = s.option(form.Flag, 'wait_lock', _('Wait for Iptables Lock'),
			_('Wait for xtables lock while invoking iptables. Prevents failures during boot.'));
		o.default = '1';

		// 4. Retry on Error (Restored)
		o = s.option(form.Flag, 'retry_on_error', _('Retry on Error'),
			_('Allow starting even if network is not ready. Recommended for auto-start.'));
		o.default = '1';
		
		// 5. Log Level
		o = s.option(form.ListValue, 'log_level', _('Log Level'));
		o.value('1', _('Fatal'));
		o.value('2', _('Error'));
		o.value('3', _('Warning'));
		o.value('4', _('Info (Default)'));
		o.default = '4';
		
		// ==================== 1. Server Instances (Top Priority) ====================
		s = m.section(form.GridSection, 'server', _('Server Instances (-s)'),
			_('<b>Server Mode:</b> OpenWrt listens for connections from remote clients.<br/>' +
			  'Traffic Flow: Internet -> WAN Port -> [Decrypted] -> Forward To IP:Port.'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add Server');
		
		s.sectiontitle = function(section_id) {
			var alias = uci.get('udp2raw', section_id, 'alias');
			return alias ? (alias + ' (Server)') : _('New Server');
		};
		
		// Default values for new Server
		s.handleAdd = function(ev) {
			var section_id = uci.add('udp2raw', 'server');
			uci.set('udp2raw', section_id, 'enabled', '1');
			uci.set('udp2raw', section_id, 'local_addr', '0.0.0.0');
			uci.set('udp2raw', section_id, 'raw_mode', 'faketcp');
			uci.set('udp2raw', section_id, 'cipher_mode', 'xor');
			uci.set('udp2raw', section_id, 'auth_mode', 'simple');
			uci.set('udp2raw', section_id, 'auto_rule', '1');
			return this.renderMoreOptionsModal(section_id);
		};

		// --- Tabs Definition ---
		s.tab('basic', _('Basic Settings'));
		s.tab('advanced', _('Advanced Settings'));

		// --- Server: Table Columns (Optimized Widths) ---
		
		// 1. Enable
		o = s.taboption('basic', form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.editable = true;
		o.width = '10%';
		// FIX: Force writing '1' or '0' to config file, preventing fallback to default '0'
		o.rmempty = false;
		
		// 2. Alias (Widened)
		o = s.taboption('basic', form.Value, 'alias', _('Alias'));
		o.placeholder = 'My Server';
		o.rmempty = true;
		o.width = '15%';

		// 3. Listen Port
		o = s.taboption('basic', form.Value, 'local_port', _('WAN Listen Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.width = '10%';
		
		// 4. Forward Address
		o = s.taboption('basic', form.Value, 'remote_addr', _('Forward To IP'));
		o.datatype = 'host';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;
		o.width = '15%';
		
		// 5. Forward Port
		o = s.taboption('basic', form.Value, 'remote_port', _('Forward To Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.width = '10%';

		// --- Server: Hidden Options (Modal Only) ---

		// Password
		o = s.taboption('basic', form.Value, 'key', _('Password (-k)'), 
			_('Encryption password. Must match client configuration exactly.'));
		o.password = true;
		o.rmempty = false;
		o.modalonly = true;

		// Listen Address
		o = s.taboption('basic', form.Value, 'local_addr', _('WAN Listen Address (-l)'), 
			_('Address to listen on. Use 0.0.0.0 for all interfaces.'));
		o.datatype = 'ipaddr';
		o.default = '0.0.0.0';
		o.modalonly = true;

		// Advanced Options (All Modal Only)
		o = s.taboption('advanced', form.ListValue, 'raw_mode', _('Raw Mode'), 
			_('Transport protocol. FakeTCP is recommended for bypassing firewalls.'));
		o.value('faketcp', 'FakeTCP (Recommended)');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');
		o.default = 'faketcp';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.ListValue, 'cipher_mode', _('Cipher Mode'),
			_('Encryption method. XOR is fast and usually sufficient.'));
		o.value('aes128cbc', 'AES-128-CBC (Secure)');
		o.value('xor', 'XOR (Fast)');
		o.value('none', 'None');
		o.default = 'xor';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.ListValue, 'auth_mode', _('Auth Mode'),
			_('Authentication method. Simple is basic protection.'));
		o.value('hmac_sha1', 'HMAC-SHA1 (Secure)');
		o.value('simple', 'Simple (Basic)');
		o.value('none', 'None');
		o.default = 'simple';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.Flag, 'auto_rule', _('Auto Add Iptables Rule (-a)'),
			_('Automatically add iptables rules to block kernel TCP processing. Required for FakeTCP.'));
		o.default = '1';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.DynamicList, 'extra_args', _('Extra Arguments'),
			_('Additional command line arguments (e.g. --seq-mode 4).'));
		o.optional = true;
		o.modalonly = true;

		// ==================== 2. Client Instances ====================
		s = m.section(form.GridSection, 'client', _('Client Instances (-c)'),
			_('<b>Client Mode:</b> OpenWrt connects to a remote udp2raw server (VPS).<br/>' +
			  'Traffic Flow: App -> Local Port -> [Encrypted] -> Forward To VPS IP:Port.'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add Client');
		
		s.sectiontitle = function(section_id) {
			var alias = uci.get('udp2raw', section_id, 'alias');
			return alias ? (alias + ' (Client)') : _('New Client');
		};
		
		s.handleAdd = function(ev) {
			var section_id = uci.add('udp2raw', 'client');
			uci.set('udp2raw', section_id, 'enabled', '1');
			uci.set('udp2raw', section_id, 'local_addr', '127.0.0.1');
			uci.set('udp2raw', section_id, 'local_port', '3333');
			uci.set('udp2raw', section_id, 'raw_mode', 'faketcp');
			uci.set('udp2raw', section_id, 'cipher_mode', 'xor');
			uci.set('udp2raw', section_id, 'auth_mode', 'simple');
			uci.set('udp2raw', section_id, 'auto_rule', '1');
			uci.set('udp2raw', section_id, 'seq_mode', '3');
			return this.renderMoreOptionsModal(section_id);
		};

		// --- Tabs Definition ---
		s.tab('basic', _('Basic Settings'));
		s.tab('advanced', _('Advanced Settings'));

		// --- Client: Table Columns (Optimized Widths) ---
		
		// 1. Enable
		o = s.taboption('basic', form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.editable = true;
		o.width = '10%';
		// FIX: Force writing '1' or '0' to config file
		o.rmempty = false;
		
		// 2. Alias (Widened)
		o = s.taboption('basic', form.Value, 'alias', _('Alias'));
		o.placeholder = 'My VPS';
		o.width = '15%';
		
		// 3. VPS Address
		o = s.taboption('basic', form.Value, 'remote_addr', _('VPS Address'));
		o.datatype = 'host';
		o.rmempty = false;
		o.width = '15%';
		
		// 4. VPS Port
		o = s.taboption('basic', form.Value, 'remote_port', _('VPS Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.width = '10%';
		
		// 5. Local Port
		o = s.taboption('basic', form.Value, 'local_port', _('Local Listen Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.width = '10%';

		// --- Client: Hidden Options (Modal Only) ---
		
		// Password
		o = s.taboption('basic', form.Value, 'key', _('Password (-k)'), 
			_('Encryption password. Must match server configuration exactly.'));
		o.password = true;
		o.rmempty = false;
		o.modalonly = true;
		
		// Local Address
		o = s.taboption('basic', form.Value, 'local_addr', _('Local Listen Address (-l)'), 
			_('IP to bind locally. Use 127.0.0.1 for local apps (WireGuard/OpenVPN).'));
		o.datatype = 'ipaddr';
		o.default = '127.0.0.1';
		o.modalonly = true;

		// Advanced Options (All Modal Only)
		o = s.taboption('advanced', form.ListValue, 'raw_mode', _('Raw Mode'), _('Transport protocol.'));
		o.value('faketcp', 'FakeTCP (Recommended)');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');
		o.default = 'faketcp';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.ListValue, 'cipher_mode', _('Cipher Mode'));
		o.value('aes128cbc', 'AES-128-CBC');
		o.value('xor', 'XOR (Fast)');
		o.value('none', 'None');
		o.default = 'xor';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.ListValue, 'auth_mode', _('Auth Mode'));
		o.value('hmac_sha1', 'HMAC-SHA1');
		o.value('simple', 'Simple');
		o.value('none', 'None');
		o.default = 'simple';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.Value, 'source_ip', _('Source IP (--source-ip)'),
			_('Force source-ip for raw socket. Leave empty unless necessary.'));
		o.datatype = 'ipaddr';
		o.optional = true;
		o.modalonly = true;
		
		o = s.taboption('advanced', form.Value, 'source_port', _('Source Port (--source-port)'),
			_('Force source-port for raw socket. Disables port changing. Leave empty unless necessary.'));
		o.datatype = 'port';
		o.optional = true;
		o.modalonly = true;
		
		o = s.taboption('advanced', form.Flag, 'auto_rule', _('Auto Add Iptables Rule (-a)'),
			_('Automatically manage iptables rules.'));
		o.default = '1';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.ListValue, 'seq_mode', _('Sequence Mode'), _('FakeTCP behavior simulation.'));
		o.value('3', _('3 - Simulate real TCP (Recommended)'));
		o.value('4', _('4 - Like 3, no Window Scale'));
		o.default = '3';
		o.depends('raw_mode', 'faketcp');
		o.modalonly = true;
		
		o = s.taboption('advanced', form.DynamicList, 'extra_args', _('Extra Arguments'));
		o.optional = true;
		o.modalonly = true;
		
		return m.render();
	}
});
