/**
 * Copyright (C) 2024 iHub-2020
 * 
 * LuCI Udp2raw Configuration Page
 * Complete configuration interface with validation and safety checks
 * 
 * Features:
 * - Multi-tunnel support (client and server modes)
 * - Input validation with security warnings
 * - Mode-specific options
 * - Automatic iptables rule management for OpenWrt
 * - WireGuard integration support
 * 
 * @module luci-app-udp2raw/config
 * @version 1.0.1
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
		if (!value || value === '0.0.0.0' || value === '127.0.0.1') return true;
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
		
		// 允许域名
		if (/^[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9]$/.test(value)) return true;
		
		return _('Invalid IP address or hostname format');
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
		if (!value || value.length < 8) {
			return _('Password must be at least 8 characters');
		}
		var weakPasswords = ['password', 'passwd', '123456', '12345678', 'secret key', 'ChangeThisToYourStrongPassword'];
		if (weakPasswords.indexOf(value) !== -1) {
			return _('This is a weak password! Please use a strong random password.');
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
		
		m = new form.Map('udp2raw', _('Udp2raw Tunnel Configuration'), 
			_('Udp2raw converts UDP traffic into encrypted FakeTCP/UDP/ICMP traffic using raw sockets. ' +
			  'This helps bypass UDP firewalls and provides stable tunneling for VPN protocols like WireGuard.'));
		
		// ==================== 安全警告 ====================
		m.description = E('div', {}, [
			E('div', { 'class': 'alert-message warning', 'style': 'margin-bottom: 20px;' }, [
				E('h4', { 'style': 'margin: 0 0 10px 0;' }, '⚠️ ' + _('Critical Safety Information')),
				E('ul', { 'style': 'margin: 0; padding-left: 20px;' }, [
					E('li', {}, _('FakeTCP mode REQUIRES iptables rules to block kernel TCP RST packets')),
					E('li', {}, _('On OpenWrt, iptables rules may be cleared when network settings change')),
					E('li', {}, _('The "Keep Iptables Rules" option is STRONGLY recommended for OpenWrt')),
					E('li', {}, _('Password/Key, Raw Mode, Cipher Mode, and Auth Mode MUST match on both sides'))
				])
			])
		]);
		
		// ==================== 全局设置 ====================
		s = m.section(form.TypedSection, 'general', _('Global Settings'),
			_('These settings apply to all tunnel instances.'));
		s.anonymous = true;
		s.addremove = false;
		
		o = s.option(form.Flag, 'enabled', _('Enable Service'),
			_('Master switch to enable/disable all udp2raw tunnels.'));
		o.default = '0';
		o.rmempty = false;
		
		o = s.option(form.Flag, 'keep_rule', _('Keep Iptables Rules'),
			_('<strong style="color: #d9534f;">⚠️ STRONGLY RECOMMENDED for OpenWrt!</strong><br>' +
			  'Monitors and automatically restores iptables rules when cleared by system. ' +
			  'Uses <code>--keep-rule</code> option.'));
		o.default = '1';
		o.rmempty = false;
		
		o = s.option(form.Flag, 'wait_lock', _('Wait for Iptables Lock'),
			_('Wait for iptables lock when adding rules (prevents conflicts). Requires iptables v1.4.20+. ' +
			  'Uses <code>--wait-lock</code> option.'));
		o.default = '1';
		
		o = s.option(form.Flag, 'retry_on_error', _('Retry on Error'),
			_('Allow udp2raw to start before network is fully initialized. Useful for boot-time startup. ' +
			  'Uses <code>--retry-on-error</code> option.'));
		o.default = '1';
		
		o = s.option(form.ListValue, 'log_level', _('Log Level'),
			_('Verbosity of log output.'));
		o.value('0', _('0 - Never'));
		o.value('1', _('1 - Fatal'));
		o.value('2', _('2 - Error'));
		o.value('3', _('3 - Warning'));
		o.value('4', _('4 - Info (Recommended)'));
		o.value('5', _('5 - Debug'));
		o.value('6', _('6 - Trace'));
		o.default = '4';
		
		// ==================== 隧道配置 ====================
		s = m.section(form.GridSection, 'tunnel', _('Tunnel Instances'),
			_('Configure one or more UDP tunnels. Each tunnel runs independently.'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add new tunnel');
		
		s.tab('basic', _('Basic'));
		s.tab('security', _('Security'));
		s.tab('advanced', _('Advanced'));
		
		// ===== Basic Tab =====
		o = s.taboption('basic', form.Flag, 'disabled', _('Disable'));
		o.default = '0';
		o.editable = true;
		o.modalonly = false;
		
		o = s.taboption('basic', form.Value, 'alias', _('Name'),
			_('Friendly name for identification.'));
		o.placeholder = 'WireGuard Tunnel';
		o.rmempty = false;
		o.modalonly = false;
		
		o = s.taboption('basic', form.ListValue, 'mode', _('Mode'),
			_('<strong>Client:</strong> Connect to remote udp2raw server<br>' +
			  '<strong>Server:</strong> Accept connections from udp2raw clients'));
		o.value('client', _('Client'));
		o.value('server', _('Server'));
		o.default = 'client';
		o.rmempty = false;
		o.modalonly = false;
		
		o = s.taboption('basic', form.Value, 'local_addr', _('Local Address'),
			_('IP address to listen on. Use <code>0.0.0.0</code> for all interfaces, ' +
			  '<code>127.0.0.1</code> for localhost only.'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';
		o.default = '0.0.0.0';
		
		o = s.taboption('basic', form.Value, 'local_port', _('Local Port'),
			_('Local port to listen on.'));
		o.datatype = 'port';
		o.placeholder = '51820';
		o.rmempty = false;
		o.validate = this.validatePort;
		o.modalonly = false;
		
		o = s.taboption('basic', form.Value, 'remote_addr', _('Remote Address'),
			_('<strong>Client mode:</strong> Remote udp2raw server IP/hostname<br>' +
			  '<strong>Server mode:</strong> Local service to forward decrypted traffic to'));
		o.datatype = 'host';
		o.placeholder = '203.0.113.1';
		o.rmempty = false;
		o.modalonly = false;
		
		o = s.taboption('basic', form.Value, 'remote_port', _('Remote Port'),
			_('<strong>Client mode:</strong> Remote server port<br>' +
			  '<strong>Server mode:</strong> Local service port (e.g., WireGuard 51820)'));
		o.datatype = 'port';
		o.placeholder = '4096';
		o.rmempty = false;
		o.validate = this.validatePort;
		o.modalonly = false;
		
		// ===== Security Tab (参数必须两端一致) =====
		o = s.taboption('security', form.Value, 'key', _('Password'),
			_('<strong style="color: #d9534f;">⚠️ MUST match on both client and server!</strong><br>' +
			  'Used for encryption key generation. Use a strong random password (16+ characters).'));
		o.password = true;
		o.placeholder = _('Enter a strong password');
		o.rmempty = false;
		o.validate = this.validatePassword;
		
		o = s.taboption('security', form.ListValue, 'raw_mode', _('Raw Mode'),
			_('<strong style="color: #d9534f;">⚠️ MUST match on both client and server!</strong><br>' +
			  '<strong>faketcp:</strong> Simulates TCP (recommended, bypasses most firewalls)<br>' +
			  '<strong>udp:</strong> Encapsulates in UDP headers<br>' +
			  '<strong>icmp:</strong> Encapsulates in ICMP headers<br>' +
			  '<strong>easy-faketcp:</strong> Simplified FakeTCP'));
		o.value('faketcp', _('FakeTCP (Recommended)'));
		o.value('udp', _('UDP'));
		o.value('icmp', _('ICMP'));
		o.value('easy-faketcp', _('Easy-FakeTCP'));
		o.default = 'faketcp';
		
		o = s.taboption('security', form.ListValue, 'cipher_mode', _('Cipher Mode'),
			_('<strong style="color: #d9534f;">⚠️ MUST match on both client and server!</strong><br>' +
			  'Encryption algorithm for traffic protection.'));
		o.value('aes128cbc', _('AES-128-CBC (Recommended)'));
		o.value('aes128cfb', _('AES-128-CFB'));
		o.value('xor', _('XOR (Fast, Low Security)'));
		o.value('none', _('None (Debug Only!)'));
		o.default = 'aes128cbc';
		
		o = s.taboption('security', form.ListValue, 'auth_mode', _('Auth Mode'),
			_('<strong style="color: #d9534f;">⚠️ MUST match on both client and server!</strong><br>' +
			  'Data integrity verification method.'));
		o.value('hmac_sha1', _('HMAC-SHA1 (Recommended)'));
		o.value('md5', _('MD5'));
		o.value('crc32', _('CRC32 (Fast, Low Security)'));
		o.value('simple', _('Simple (Weak)'));
		o.value('none', _('None (Debug Only!)'));
		o.default = 'hmac_sha1';
		
		o = s.taboption('security', form.Flag, 'auto_rule', _('Auto Iptables Rule'),
			_('<strong style="color: #d9534f;">⚠️ CRITICAL for FakeTCP mode!</strong><br>' +
			  'Automatically adds iptables rules to block kernel TCP processing. ' +
			  'Without this, the kernel sends RST packets causing connection instability. Uses <code>-a</code> option.'));
		o.default = '1';
		o.rmempty = false;
		
		o = s.taboption('security', form.Flag, 'disable_anti_replay', _('Disable Anti-Replay'),
			_('<strong style="color: #d9534f;">⚠️ NOT RECOMMENDED!</strong> Disables replay attack protection.'));
		o.default = '0';
		
		// ===== Advanced Tab =====
		o = s.taboption('advanced', form.Value, 'source_ip', _('Force Source IP'),
			_('Force a specific source IP for raw socket. Leave empty for auto. Client mode only.'));
		o.datatype = 'ipaddr';
		o.placeholder = _('auto');
		o.depends('mode', 'client');
		
		o = s.taboption('advanced', form.Value, 'source_port', _('Force Source Port'),
			_('Force a specific source port. Disables port changing during reconnection. Client mode only.'));
		o.datatype = 'port';
		o.depends('mode', 'client');
		
		o = s.taboption('advanced', form.ListValue, 'seq_mode', _('Sequence Mode'),
			_('Controls how FakeTCP seq/ack numbers behave. Mode 3 simulates real TCP most closely. ' +
			  'Try mode 4 if firewall blocks Window Scale option.'));
		o.value('0', _('0 - Static (no increment)'));
		o.value('1', _('1 - Increment every packet'));
		o.value('2', _('2 - Random increment (~3 packets)'));
		o.value('3', _('3 - Simulate real TCP (Recommended)'));
		o.value('4', _('4 - Like 3, no Window Scale'));
		o.default = '3';
		o.depends('raw_mode', 'faketcp');
		o.depends('raw_mode', 'easy-faketcp');
		
		o = s.taboption('advanced', form.Flag, 'fix_gro', _('Fix GRO Issues'),
			_('Attempts to fix huge packets caused by Generic Receive Offload. ' +
			  'Enable if you experience packet size issues. Experimental.'));
		o.default = '0';
		
		o = s.taboption('advanced', form.Value, 'lower_level', _('Link-Level Mode'),
			_('Send packets at OSI layer 2 to bypass local iptables rules. ' +
			  'Format: <code>eth0#00:11:22:33:44:55</code> or <code>auto</code>'));
		o.placeholder = 'auto';
		
		o = s.taboption('advanced', form.Value, 'dev', _('Bind Device'),
			_('Bind raw socket to a specific network device. May improve performance.'));
		o.placeholder = 'eth0';
		
		o = s.taboption('advanced', form.Value, 'mtu_warn', _('MTU Warning Threshold'),
			_('Warn when packet size exceeds this value. Default: 1375 bytes.'));
		o.datatype = 'range(100,1500)';
		o.placeholder = '1375';
		
		o = s.taboption('advanced', form.Value, 'sock_buf', _('Socket Buffer Size'),
			_('Socket buffer size in KB. Range: 10-10240. Default: 1024.'));
		o.datatype = 'range(10,10240)';
		o.placeholder = '1024';
		
		o = s.taboption('advanced', form.Flag, 'force_sock_buf', _('Force Socket Buffer'),
			_('Bypass system limitations when setting socket buffer size.'));
		o.default = '0';
		
		o = s.taboption('advanced', form.DynamicList, 'extra_args', _('Extra Arguments'),
			_('Additional command-line arguments. One argument per line. Use with caution.'));
		o.placeholder = '--some-option value';
		
		// ==================== WireGuard 集成说明 ====================
		s = m.section(form.NamedSection, '_wireguard_', '', _('WireGuard Integration Guide'));
		s.anonymous = true;
		s.cfgsections = function() { return ['_wireguard_']; };
		s.render = function() {
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, '📖 ' + _('WireGuard over Udp2raw Setup')),
				E('div', { 'class': 'alert-message info' }, [
					E('h4', { 'style': 'margin-top: 0;' }, _('Scenario: Bypass UDP blocking for WireGuard')),
					E('p', {}, _('This setup wraps WireGuard\'s UDP traffic in encrypted FakeTCP to bypass firewalls.')),
					
					E('h5', {}, _('On VPS Server (runs udp2raw in server mode):')),
					E('ol', {}, [
						E('li', {}, _('WireGuard listens on 127.0.0.1:51820')),
						E('li', {}, _('Udp2raw server listens on 0.0.0.0:4096, forwards to 127.0.0.1:51820')),
						E('li', {}, _('Firewall opens TCP port 4096'))
					]),
					
					E('h5', {}, _('On OpenWrt Router (runs udp2raw in client mode):')),
					E('ol', {}, [
						E('li', {}, _('Udp2raw client listens on 127.0.0.1:51820, connects to VPS:4096')),
						E('li', {}, _('WireGuard peer endpoint set to 127.0.0.1:51820')),
						E('li', {}, [
							E('strong', { 'style': 'color: #d9534f;' }, _('IMPORTANT: ')),
							_('Add route exception so VPS IP bypasses VPN tunnel!')
						])
					]),
					
					E('h5', {}, _('Route Exception Example:')),
					E('pre', { 'style': 'background: #f5f5f5; padding: 10px; font-size: 12px;' },
						'# Ensure udp2raw traffic to VPS does not go through WireGuard\n' +
						'ip route add <VPS_IP>/32 via <GATEWAY_IP> dev <WAN_INTERFACE>')
				]),
				
				E('p', { 'style': 'margin-top: 15px;' }, [
					_('More information: '),
					E('a', { 
						'href': 'https://github.com/wangyu-/udp2raw/wiki/udp2raw---wireguard-example-configurations',
						'target': '_blank'
					}, _('Official WireGuard Configuration Guide'))
				])
			]);
		};
		
		return m.render();
	}
});