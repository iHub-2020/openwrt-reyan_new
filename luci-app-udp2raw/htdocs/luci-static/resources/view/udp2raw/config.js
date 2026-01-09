/**
 * Copyright (C) 2024 iHub-2020
 * 
 * LuCI Udp2raw Configuration Page
 * Complete configuration interface with validation and safety checks
 * 
 * Features:
 * - Multi-tunnel support
 * - Input validation
 * - Security warnings
 * - Mode-specific options
 * - Automatic iptables rule management
 * 
 * @module luci-app-udp2raw/config
 * @version 1.0.0
 * @date 2026-01-09
 */

'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require ui';

return view.extend({
	title: _('Udp2raw Configuration'),
	
	/**
	 * 验证 IP 地址格式
	 */
	validateIP: function(section_id, value) {
		if (!value || value === '0.0.0.0') return true;
		var ipv4_regex = /^(\d{1,3}\.){3}\d{1,3}$/;
		var ipv6_regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
		
		if (ipv4_regex.test(value)) {
			var parts = value.split('.');
			for (var i = 0; i < parts.length; i++) {
				var num = parseInt(parts[i]);
				if (num < 0 || num > 255) {
					return _('Invalid IPv4 address');
				}
			}
			return true;
		}
		
		if (ipv6_regex.test(value)) return true;
		
		return _('Invalid IP address format');
	},
	
	/**
	 * 验证端口号
	 */
	validatePort: function(section_id, value) {
		if (!value) return _('Port is required');
		var port = parseInt(value);
		if (isNaN(port) || port < 1 || port > 65535) {
			return _('Port must be between 1 and 65535');
		}
		return true;
	},
	
	/**
	 * 验证密码强度
	 */
	validatePassword: function(section_id, value) {
		if (!value || value.length < 6) {
			return _('Password must be at least 6 characters');
		}
		if (value === 'passwd' || value === 'password' || value === '123456') {
			return _('⚠️ Warning: This is a weak password! Use a strong random password.');
		}
		return true;
	},
	
	load: function() {
		return Promise.all([
			uci.load('udp2raw'),
			L.resolveDefault(fs.stat('/usr/bin/udp2raw'), null)
		]);
	},
	
	render: function(data) {
		var udp2rawInstalled = data[1] !== null;
		
		if (!udp2rawInstalled) {
			return E('div', { 'class': 'alert-message warning' }, [
				E('h3', {}, _('Udp2raw Not Installed')),
				E('p', {}, _('Please install the udp2raw package first:')),
				E('pre', {}, 'opkg update\nopkg install udp2raw')
			]);
		}
		
		var m, s, o;
		
		m = new form.Map('udp2raw', _('Udp2raw Tunnel'), 
			_('A tunnel that converts UDP traffic into encrypted FakeTCP/UDP/ICMP traffic using raw sockets. ' +
			  'Helps bypass UDP firewalls and unstable UDP environments.'));
		
		// ==================== 全局设置 ====================
		s = m.section(form.TypedSection, 'general', _('Global Settings'));
		s.anonymous = true;
		s.addremove = false;
		
		o = s.option(form.Flag, 'enabled', _('Enable Udp2raw'));
		o.default = '0';
		o.rmempty = false;
		
		o = s.option(form.Flag, 'keep_rule', _('Keep Iptables Rules'),
			_('<strong>Strongly recommended for OpenWrt!</strong> Automatically restore iptables rules ' +
			  'when they are cleared by system configuration changes. Uses --keep-rule option.'));
		o.default = '1';
		o.rmempty = false;
		
		o = s.option(form.Flag, 'retry_on_error', _('Retry on Error'),
			_('Allow udp2raw to start before network is fully initialized. Uses --retry-on-error option.'));
		o.default = '1';
		
		o = s.option(form.ListValue, 'log_level', _('Log Level'));
		o.value('0', _('Never'));
		o.value('1', _('Fatal'));
		o.value('2', _('Error'));
		o.value('3', _('Warning'));
		o.value('4', _('Info (Recommended)'));
		o.value('5', _('Debug'));
		o.value('6', _('Trace'));
		o.default = '4';
		
		o = s.option(form.Flag, 'wait_lock', _('Wait for Iptables Lock'),
			_('Wait for iptables lock when adding rules. Requires iptables v1.4.20+. Recommended.'));
		o.default = '1';
		
		// ==================== 隧道配置 ====================
		s = m.section(form.GridSection, 'tunnel', _('Tunnel Configurations'),
			_('Configure multiple UDP tunnels. Each tunnel can work independently.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		
		// 表格列定义
		s.tab('basic', _('Basic Settings'));
		s.tab('protocol', _('Protocol & Security'));
		s.tab('advanced', _('Advanced Options'));
		
		// ===== Basic Settings =====
		o = s.taboption('basic', form.Flag, 'disabled', _('Disable'));
		o.default = '0';
		o.editable = true;
		
		o = s.taboption('basic', form.Value, 'alias', _('Tunnel Name'),
			_('Friendly name for this tunnel'));
		o.placeholder = 'My VPN Tunnel';
		o.rmempty = false;
		
		o = s.taboption('basic', form.ListValue, 'mode', _('Mode'));
		o.value('client', _('Client'));
		o.value('server', _('Server'));
		o.default = 'client';
		o.rmempty = false;
		
		o = s.taboption('basic', form.Value, 'local_addr', _('Local IP Address'),
			_('Listen address. Use 0.0.0.0 for all interfaces.'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';
		o.default = '0.0.0.0';
		o.validate = this.validateIP;
		
		o = s.taboption('basic', form.Value, 'local_port', _('Local Port'),
			_('Local UDP port to listen on'));
		o.datatype = 'port';
		o.placeholder = '3333';
		o.rmempty = false;
		o.validate = this.validatePort;
		
		o = s.taboption('basic', form.Value, 'remote_addr', _('Remote Address'),
			_('Remote server IP address or hostname'));
		o.datatype = 'host';
		o.placeholder = '203.0.113.1';
		o.rmempty = false;
		
		o = s.taboption('basic', form.Value, 'remote_port', _('Remote Port'),
			_('Remote server port'));
		o.datatype = 'port';
		o.placeholder = '4096';
		o.rmempty = false;
		o.validate = this.validatePort;
		
		// ===== Protocol & Security =====
		o = s.taboption('protocol', form.Value, 'key', _('Password'),
			_('<strong>⚠️ IMPORTANT:</strong> Use a strong random password! This is used to generate encryption keys.'));
		o.password = true;
		o.placeholder = 'YourStrongPasswordHere';
		o.rmempty = false;
		o.validate = this.validatePassword;
		
		o = s.taboption('protocol', form.ListValue, 'raw_mode', _('Raw Mode'),
			_('<strong>faketcp:</strong> Simulate TCP (bypass most firewalls)<br>' +
			  '<strong>udp:</strong> Use UDP headers (simple encapsulation)<br>' +
			  '<strong>icmp:</strong> Use ICMP headers (bypass UDP blocks)<br>' +
			  '<strong>easy-faketcp:</strong> Simplified FakeTCP'));
		o.value('faketcp', _('FakeTCP (Recommended)'));
		o.value('udp', _('UDP'));
		o.value('icmp', _('ICMP'));
		o.value('easy-faketcp', _('Easy-FakeTCP'));
		o.default = 'faketcp';
		
		o = s.taboption('protocol', form.ListValue, 'cipher_mode', _('Cipher Mode'),
			_('Encryption algorithm. AES-128-CBC recommended for security.'));
		o.value('aes128cbc', _('AES-128-CBC (Recommended)'));
		o.value('aes128cfb', _('AES-128-CFB'));
		o.value('xor', _('XOR (Fast, Low Security)'));
		o.value('none', _('None (Debugging Only)'));
		o.default = 'aes128cbc';
		
		o = s.taboption('protocol', form.ListValue, 'auth_mode', _('Authentication Mode'),
			_('Data integrity protection. HMAC-SHA1 recommended.'));
		o.value('hmac_sha1', _('HMAC-SHA1 (Recommended)'));
		o.value('md5', _('MD5'));
		o.value('crc32', _('CRC32 (Fast, Low Security)'));
		o.value('simple', _('Simple (Very Weak)'));
		o.value('none', _('None (Debugging Only)'));
		o.default = 'hmac_sha1';
		
		o = s.taboption('protocol', form.Flag, 'auto_rule', _('Auto Add Iptables Rule'),
			_('<strong>⚠️ CRITICAL:</strong> Must be enabled for FakeTCP mode! ' +
			  'Automatically adds iptables rules to block kernel TCP processing. Uses -a option.'));
		o.default = '1';
		o.rmempty = false;
		
		o = s.taboption('protocol', form.Flag, 'disable_anti_replay', _('Disable Anti-Replay'),
			_('⚠️ Not recommended! Disables replay attack protection.'));
		o.default = '0';
		
		// ===== Advanced Options =====
		o = s.taboption('advanced', form.Value, 'source_ip', _('Force Source IP'),
			_('Force a specific source IP for raw socket (client mode only). Leave empty for auto.'));
		o.datatype = 'ipaddr';
		o.placeholder = 'auto';
		o.depends('mode', 'client');
		
		o = s.taboption('advanced', form.Value, 'source_port', _('Force Source Port'),
			_('Force a specific source port (client mode, TCP/UDP only). Disables port changing during reconnection.'));
		o.datatype = 'port';
		o.depends('mode', 'client');
		
		o = s.taboption('advanced', form.ListValue, 'seq_mode', _('Sequence Number Mode'),
			_('Controls how FakeTCP seq/ack numbers are generated. Mode 3 is most realistic.'));
		o.value('0', _('0: Static (no increment)'));
		o.value('1', _('1: Increment for every packet'));
		o.value('2', _('2: Random increment (~every 3 packets)'));
		o.value('3', _('3: Simulate real TCP (Recommended)'));
		o.value('4', _('4: Like 3, but no Window Scale'));
		o.default = '3';
		o.depends('raw_mode', 'faketcp');
		o.depends('raw_mode', 'easy-faketcp');
		
		o = s.taboption('advanced', form.Value, 'lower_level', _('OSI Level 2 Mode'),
			_('Send packets at link level to bypass local iptables. Format: <code>eth0#00:11:22:33:44:55</code><br>' +
			  'Try <code>auto</code> for auto-detection.'));
		o.placeholder = 'auto or eth0#00:11:22:33:44:55';
		
		o = s.taboption('advanced', form.Flag, 'fix_gro', _('Fix GRO Issues'),
			_('Try to fix huge packets caused by Generic Receive Offload. Experimental feature.'));
		o.default = '0';
		
		o = s.taboption('advanced', form.Value, 'dev', _('Bind to Device'),
			_('Bind raw socket to a specific network device (e.g., eth0). Improves performance.'));
		o.placeholder = 'eth0';
		
		// ==================== 说明文档 ====================
		s = m.section(form.NamedSection, '__readme__', '', _('Important Information'));
		s.anonymous = true;
		s.cfgsections = function() { return ['__readme__']; };
		s.render = function() {
			return E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'alert-message warning' }, [
					E('h4', { 'style': 'margin-top: 0;' }, '⚠️ ' + _('Critical Safety Notes')),
					E('ul', {}, [
						E('li', {}, [
							E('strong', {}, _('FakeTCP Mode Requires Iptables Rules:')),
							E('p', {}, _('The Linux kernel will automatically send RST packets for unrecognized TCP connections, ' +
							           'which will break FakeTCP tunnels. You MUST enable "Auto Add Iptables Rule" option.'))
						]),
						E('li', {}, [
							E('strong', {}, _('OpenWrt Rule Persistence:')),
							E('p', {}, _('On OpenWrt, iptables rules may be cleared when you change network settings. ' +
							           'Enable "Keep Iptables Rules" in Global Settings to auto-restore them.'))
						]),
						E('li', {}, [
							E('strong', {}, _('Password Security:')),
							E('p', {}, _('Never use default passwords like "passwd" or "123456". Use a strong random password ' +
							           'to prevent unauthorized access and ensure encryption key strength.'))
						]),
						E('li', {}, [
							E('strong', {}, _('Root Permission:')),
							E('p', {}, _('Udp2raw requires root privileges to create raw sockets. It runs as root by default.'))
						])
					])
				]),
				E('div', { 'class': 'alert-message info' }, [
					E('h4', { 'style': 'margin-top: 0;' }, '📚 ' + _('Quick Start Example')),
					E('p', {}, _('<strong>Server Side:</strong> Listen on port 4096, forward to local WireGuard on 51820')),
					E('ul', {}, [
						E('li', {}, _('Mode: Server')),
						E('li', {}, _('Local: 0.0.0.0:4096')),
						E('li', {}, _('Remote: 127.0.0.1:51820')),
						E('li', {}, _('Password: (your strong password)'))
					]),
					E('p', {}, _('<strong>Client Side:</strong> Listen locally on 51820, connect to server')),
					E('ul', {}, [
						E('li', {}, _('Mode: Client')),
						E('li', {}, _('Local: 0.0.0.0:51820')),
						E('li', {}, _('Remote: (server_ip):4096')),
						E('li', {}, _('Password: (same as server)'))
					]),
					E('p', {}, _('Then configure your VPN client to connect to 127.0.0.1:51820'))
				]),
				E('div', {}, [
					E('p', {}, [
						_('For more information, visit: '),
						E('a', { 
							'href': 'https://github.com/wangyu-/udp2raw',
							'target': '_blank'
						}, 'https://github.com/wangyu-/udp2raw')
					])
				])
			]);
		};
		
		return m.render();
	}
});
