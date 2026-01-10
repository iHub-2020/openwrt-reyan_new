/**
 * Copyright (C) 2024 iHub-2020
 * 
 * LuCI UDP Tunnel Manager - Configuration Page
 * Complete configuration interface with validation and safety checks
 * 
 * Features:
 * - Multi-tunnel support (client and server modes)
 * - Input validation with security warnings
 * - Mode-specific options (source-ip/source-port for client only)
 * - Automatic iptables rule management for OpenWrt
 * - WireGuard integration support
 * 
 * @module luci-app-udp-tunnel/config
 * @version 1.4.1
 * @date 2026-01-10
 * 
 * Changelog:
 *   v1.4.1 - Fixed TypeError when no tunnel sections exist
 *          - Fixed uci.sections() callback safety checks
 *          - Added null checks for all object iterations
 *   v1.4.0 - Fixed UCI field names (remote_addr/remote_port instead of server_addr/server_port)
 *          - Fixed global section type ('general' instead of 'globals')
 *          - Removed "Run Daemon as User" option (udp2raw requires root)
 *          - Added help descriptions for all options
 *          - Fixed modal titles for server/client
 *          - Status display now uses table for alignment
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
			L.resolveDefault(callServiceList('udp2raw'), {})
		]);
	},
	
	render: function(data) {
		var udp2rawInstalled = data[1] !== null;
		var serviceStatus = data[2];
		
		// 如果 udp2raw 未安装，显示安装提示
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
			  'This helps bypass UDP firewalls and provides stable tunneling for VPN protocols like WireGuard.'));
		
		// ==================== 服务状态显示 ====================
		var isRunning = false;
		var runningCount = 0;
		try {
			if (serviceStatus && 
			    typeof serviceStatus === 'object' &&
			    serviceStatus.udp2raw && 
			    typeof serviceStatus.udp2raw === 'object' &&
			    serviceStatus.udp2raw.instances &&
			    typeof serviceStatus.udp2raw.instances === 'object') {
				var instances = serviceStatus.udp2raw.instances;
				var keys = Object.keys(instances);
				for (var i = 0; i < keys.length; i++) {
					var key = keys[i];
					if (instances[key] && instances[key].running) {
						isRunning = true;
						runningCount++;
					}
				}
			}
		} catch (e) {
			console.log('Error checking service status:', e);
		}
		
		var statusColor = isRunning ? '#5cb85c' : '#d9534f';
		var statusText = isRunning 
			? _('Running') + ' (' + runningCount + ' ' + _('tunnels') + ')'
			: _('Stopped');
		
		// ==================== 安全警告区域 ====================
		m.description = E('div', {}, [
			// 服务状态（使用表格对齐）
			E('div', { 'class': 'cbi-section', 'style': 'margin-bottom: 10px; padding: 10px; background: #f0f0f0; border-radius: 5px;' }, [
				E('table', { 'style': 'width: auto;' }, [
					E('tr', {}, [
						E('td', { 'style': 'font-weight: bold; padding-right: 10px;' }, _('Service Status:')),
						E('td', {}, E('span', { 'style': 'color: ' + statusColor + '; font-weight: bold;' }, statusText))
					])
				])
			]),
			// 安全警告
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
		// 注意：section 类型必须是 'general'，与 init.d 脚本匹配
		s = m.section(form.TypedSection, 'general', _('General Settings'),
			_('These settings apply to all tunnel instances.'));
		s.anonymous = true;
		s.addremove = false;
		
		// 启用开关
		o = s.option(form.Flag, 'enabled', _('Enable'),
			_('Master switch to enable/disable the UDP tunnel service.'));
		o.default = '0';
		o.rmempty = false;
		
		// 活动隧道选择
		o = s.option(form.MultiValue, 'active_tunnels', _('Active Tunnels'),
			_('Select which tunnel instances to run. If empty, all enabled tunnels will run.'));
		o.optional = true;
		
		// 安全地获取 tunnel sections
		var tunnelSections = [];
		try {
			uci.sections('udp2raw', 'tunnel', function(section) {
				if (section && section['.name']) {
					tunnelSections.push(section);
				}
			});
		} catch (e) {
			console.log('Error loading tunnel sections:', e);
		}
		
		// 添加选项值
		for (var i = 0; i < tunnelSections.length; i++) {
			var section = tunnelSections[i];
			var label = section.alias || section['.name'];
			var mode = section.mode === 'server' ? _('Server') : _('Client');
			var status = section.disabled === '1' ? ' [' + _('Disabled') + ']' : '';
			o.value(section['.name'], label + ' (' + mode + ')' + status);
		}
		
		// 保持 iptables 规则（全局）
		o = s.option(form.Flag, 'keep_rule', _('Keep Iptables Rules'),
			_('Monitors and automatically restores iptables rules when cleared by system. Strongly recommended for OpenWrt.'));
		o.default = '1';
		o.rmempty = false;
		
		// 等待 iptables 锁（全局）
		o = s.option(form.Flag, 'wait_lock', _('Wait for Iptables Lock'),
			_('Wait for iptables lock when adding rules. Requires iptables v1.4.20+.'));
		o.default = '1';
		
		// 出错时重试（全局）
		o = s.option(form.Flag, 'retry_on_error', _('Retry on Error'),
			_('Allow udp2raw to start before network is fully initialized.'));
		o.default = '1';
		
		// 日志级别
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
		
		// ==================== 服务端实例 ====================
		s = m.section(form.GridSection, 'tunnel', _('Server Instances'),
			_('Server mode: Listen on a port and forward decrypted traffic to local service.'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add');
		
		// 只显示服务端实例
		s.filter = function(section_id) {
			var mode = uci.get('udp2raw', section_id, 'mode');
			return mode === 'server';
		};
		
		s.sectiontitle = function(section_id) {
			var alias = uci.get('udp2raw', section_id, 'alias');
			return alias || section_id;
		};
		
		s.modaltitle = function(section_id) {
			var alias = uci.get('udp2raw', section_id, 'alias') || section_id;
			return _('UDP Tunnel - Edit Server Instance') + ': ' + alias;
		};
		
		// 添加新服务端实例
		s.handleAdd = function(ev) {
			var section_id = uci.add('udp2raw', 'tunnel');
			uci.set('udp2raw', section_id, 'mode', 'server');
			uci.set('udp2raw', section_id, 'disabled', '0');
			uci.set('udp2raw', section_id, 'local_addr', '0.0.0.0');
			uci.set('udp2raw', section_id, 'raw_mode', 'faketcp');
			uci.set('udp2raw', section_id, 'cipher_mode', 'aes128cbc');
			uci.set('udp2raw', section_id, 'auth_mode', 'hmac_sha1');
			uci.set('udp2raw', section_id, 'auto_rule', '1');
			uci.set('udp2raw', section_id, 'seq_mode', '3');
			return this.renderMoreOptionsModal(section_id);
		};
		
		// ===== 服务端 - 表格列 =====
		o = s.option(form.Value, 'alias', _('Alias'));
		o.placeholder = 'My Server';
		o.modalonly = false;
		
		o = s.option(form.Value, 'local_addr', _('Listen Address'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';
		o.default = '0.0.0.0';
		o.modalonly = false;
		
		o = s.option(form.Value, 'local_port', _('Listen Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.modalonly = false;
		
		o = s.option(form.Value, 'remote_addr', _('Forward to Address'));
		o.datatype = 'host';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;
		o.modalonly = false;
		
		o = s.option(form.Value, 'remote_port', _('Forward to Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.modalonly = false;
		
		// ===== 服务端 - 模态框选项 =====
		o = s.option(form.Value, 'alias', _('Alias'),
			_('A friendly name for this tunnel instance.'));
		o.placeholder = 'My Server';
		o.modalonly = true;
		
		o = s.option(form.Flag, 'disabled', _('Disable'),
			_('Temporarily disable this tunnel instance.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Value, 'local_addr', _('Listen Address'),
			_('IP address to listen on. Use 0.0.0.0 for all interfaces.'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';
		o.default = '0.0.0.0';
		o.modalonly = true;
		
		o = s.option(form.Value, 'local_port', _('Listen Port'),
			_('Port to listen for incoming raw tunnel connections.'));
		o.datatype = 'port';
		o.rmempty = false;
		o.modalonly = true;
		
		o = s.option(form.Value, 'remote_addr', _('Forward to Address'),
			_('Local service address to forward decrypted UDP traffic.'));
		o.datatype = 'host';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;
		o.modalonly = true;
		
		o = s.option(form.Value, 'remote_port', _('Forward to Port'),
			_('Local service port to forward decrypted UDP traffic.'));
		o.datatype = 'port';
		o.rmempty = false;
		o.modalonly = true;
		
		o = s.option(form.ListValue, 'raw_mode', _('Raw Mode'),
			_('Transport protocol. FakeTCP is recommended for bypassing firewalls.'));
		o.value('faketcp', _('FakeTCP (Recommended)'));
		o.value('udp', _('UDP'));
		o.value('icmp', _('ICMP'));
		o.value('easy-faketcp', _('Easy-FakeTCP'));
		o.default = 'faketcp';
		o.modalonly = true;
		
		o = s.option(form.Value, 'key', _('Password'),
			_('Encryption password. Must match on both client and server.'));
		o.password = true;
		o.rmempty = false;
		o.modalonly = true;
		
		o = s.option(form.ListValue, 'cipher_mode', _('Cipher Mode'),
			_('Encryption algorithm. AES-128-CBC provides best security.'));
		o.value('aes128cbc', _('AES-128-CBC (Recommended)'));
		o.value('aes128cfb', _('AES-128-CFB'));
		o.value('xor', _('XOR (Fast, Low Security)'));
		o.value('none', _('None (Debug Only!)'));
		o.default = 'aes128cbc';
		o.modalonly = true;
		
		o = s.option(form.ListValue, 'auth_mode', _('Auth Mode'),
			_('Authentication algorithm. HMAC-SHA1 provides best integrity protection.'));
		o.value('hmac_sha1', _('HMAC-SHA1 (Recommended)'));
		o.value('md5', _('MD5'));
		o.value('crc32', _('CRC32 (Fast, Low Security)'));
		o.value('simple', _('Simple (Weak)'));
		o.value('none', _('None (Debug Only!)'));
		o.default = 'hmac_sha1';
		o.modalonly = true;
		
		o = s.option(form.Flag, 'auto_rule', _('Auto Add Iptables Rule'),
			_('Automatically add iptables rules to block kernel TCP RST. Required for FakeTCP mode.'));
		o.default = '1';
		o.modalonly = true;
		
		o = s.option(form.Flag, 'keep_rule', _('Keep Iptables Rule'),
			_('Monitor iptables and auto re-add rules if cleared. Recommended for OpenWrt.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.ListValue, 'seq_mode', _('Sequence Mode'),
			_('FakeTCP sequence number simulation mode. Mode 3 simulates real TCP behavior.'));
		o.value('0', _('0 - Static (no increment)'));
		o.value('1', _('1 - Increment every packet'));
		o.value('2', _('2 - Random increment (~3 packets)'));
		o.value('3', _('3 - Simulate real TCP (Recommended)'));
		o.value('4', _('4 - Like 3, no Window Scale'));
		o.default = '3';
		o.modalonly = true;
		o.depends('raw_mode', 'faketcp');
		o.depends('raw_mode', 'easy-faketcp');
		
		o = s.option(form.Value, 'lower_level', _('Lower Level'),
			_('Send packets at OSI layer 2 to bypass local iptables. Format: eth0#00:11:22:33:44:55 or auto.'));
		o.placeholder = 'auto';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.Flag, 'disable_anti_replay', _('Disable Anti-Replay'),
			_('Disable replay attack protection. NOT recommended for security reasons.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Flag, 'fix_gro', _('Fix GRO'),
			_('Try to fix huge packets caused by Generic Receive Offload.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Value, 'mtu_warn', _('MTU Warning Threshold'),
			_('Warn when packet size exceeds this value. Default: 1375.'));
		o.datatype = 'range(100,1500)';
		o.placeholder = '1375';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.Value, 'sock_buf', _('Socket Buffer Size (KB)'),
			_('Socket buffer size in KB. Range: 10-10240, Default: 1024.'));
		o.datatype = 'range(10,10240)';
		o.placeholder = '1024';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.Flag, 'force_sock_buf', _('Force Socket Buffer'),
			_('Bypass system limitation when setting socket buffer size.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Value, 'dev', _('Bind Device'),
			_('Bind raw socket to specific network interface for better performance.'));
		o.placeholder = 'eth0';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.Flag, 'disable_bpf', _('Disable BPF'),
			_('Disable kernel space BPF filter. Only use if you suspect a bug.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Value, 'hb_len', _('Heartbeat Length'),
			_('Length of heartbeat packets (0-1500 bytes).'));
		o.datatype = 'range(0,1500)';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.DynamicList, 'extra_args', _('Extra Arguments'),
			_('Additional command line arguments not covered by the GUI.'));
		o.optional = true;
		o.modalonly = true;
		
		// ==================== 客户端实例 ====================
		s = m.section(form.GridSection, 'tunnel', _('Client Instances'),
			_('Client mode: Connect to remote server and forward local UDP traffic.'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add');
		
		// 只显示客户端实例
		s.filter = function(section_id) {
			var mode = uci.get('udp2raw', section_id, 'mode');
			return mode !== 'server';
		};
		
		s.sectiontitle = function(section_id) {
			var alias = uci.get('udp2raw', section_id, 'alias');
			return alias || section_id;
		};
		
		s.modaltitle = function(section_id) {
			var alias = uci.get('udp2raw', section_id, 'alias') || section_id;
			return _('UDP Tunnel - Edit Client Instance') + ': ' + alias;
		};
		
		// 添加新客户端实例
		s.handleAdd = function(ev) {
			var section_id = uci.add('udp2raw', 'tunnel');
			uci.set('udp2raw', section_id, 'mode', 'client');
			uci.set('udp2raw', section_id, 'disabled', '0');
			uci.set('udp2raw', section_id, 'local_addr', '127.0.0.1');
			uci.set('udp2raw', section_id, 'raw_mode', 'faketcp');
			uci.set('udp2raw', section_id, 'cipher_mode', 'aes128cbc');
			uci.set('udp2raw', section_id, 'auth_mode', 'hmac_sha1');
			uci.set('udp2raw', section_id, 'auto_rule', '1');
			uci.set('udp2raw', section_id, 'seq_mode', '3');
			return this.renderMoreOptionsModal(section_id);
		};
		
		// ===== 客户端 - 表格列 =====
		o = s.option(form.Value, 'alias', _('Alias'));
		o.placeholder = 'My Client';
		o.modalonly = false;
		
		o = s.option(form.Value, 'local_addr', _('Listen Address'));
		o.datatype = 'ipaddr';
		o.placeholder = '127.0.0.1';
		o.default = '127.0.0.1';
		o.modalonly = false;
		
		o = s.option(form.Value, 'local_port', _('Listen Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.modalonly = false;
		
		o = s.option(form.Value, 'remote_addr', _('Remote Address'));
		o.datatype = 'host';
		o.rmempty = false;
		o.modalonly = false;
		
		o = s.option(form.Value, 'remote_port', _('Remote Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.modalonly = false;
		
		// ===== 客户端 - 模态框选项 =====
		o = s.option(form.Value, 'alias', _('Alias'),
			_('A friendly name for this tunnel instance.'));
		o.placeholder = 'My Client';
		o.modalonly = true;
		
		o = s.option(form.Flag, 'disabled', _('Disable'),
			_('Temporarily disable this tunnel instance.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Value, 'local_addr', _('Listen Address'),
			_('Local IP address to listen on for UDP traffic to tunnel.'));
		o.datatype = 'ipaddr';
		o.placeholder = '127.0.0.1';
		o.default = '127.0.0.1';
		o.modalonly = true;
		
		o = s.option(form.Value, 'local_port', _('Listen Port'),
			_('Local port to listen for UDP traffic to tunnel.'));
		o.datatype = 'port';
		o.rmempty = false;
		o.modalonly = true;
		
		o = s.option(form.Value, 'remote_addr', _('Remote Server Address'),
			_('IP address or hostname of the remote udp2raw server.'));
		o.datatype = 'host';
		o.rmempty = false;
		o.modalonly = true;
		
		o = s.option(form.Value, 'remote_port', _('Remote Server Port'),
			_('Port of the remote udp2raw server.'));
		o.datatype = 'port';
		o.rmempty = false;
		o.modalonly = true;
		
		o = s.option(form.ListValue, 'raw_mode', _('Raw Mode'),
			_('Transport protocol. Must match server configuration.'));
		o.value('faketcp', _('FakeTCP (Recommended)'));
		o.value('udp', _('UDP'));
		o.value('icmp', _('ICMP'));
		o.value('easy-faketcp', _('Easy-FakeTCP'));
		o.default = 'faketcp';
		o.modalonly = true;
		
		o = s.option(form.Value, 'key', _('Password'),
			_('Encryption password. Must match server configuration.'));
		o.password = true;
		o.rmempty = false;
		o.modalonly = true;
		
		o = s.option(form.ListValue, 'cipher_mode', _('Cipher Mode'),
			_('Encryption algorithm. Must match server configuration.'));
		o.value('aes128cbc', _('AES-128-CBC (Recommended)'));
		o.value('aes128cfb', _('AES-128-CFB'));
		o.value('xor', _('XOR (Fast, Low Security)'));
		o.value('none', _('None (Debug Only!)'));
		o.default = 'aes128cbc';
		o.modalonly = true;
		
		o = s.option(form.ListValue, 'auth_mode', _('Auth Mode'),
			_('Authentication algorithm. Must match server configuration.'));
		o.value('hmac_sha1', _('HMAC-SHA1 (Recommended)'));
		o.value('md5', _('MD5'));
		o.value('crc32', _('CRC32 (Fast, Low Security)'));
		o.value('simple', _('Simple (Weak)'));
		o.value('none', _('None (Debug Only!)'));
		o.default = 'hmac_sha1';
		o.modalonly = true;
		
		o = s.option(form.Flag, 'auto_rule', _('Auto Add Iptables Rule'),
			_('Automatically add iptables rules. Required for FakeTCP mode.'));
		o.default = '1';
		o.modalonly = true;
		
		o = s.option(form.Flag, 'keep_rule', _('Keep Iptables Rule'),
			_('Monitor iptables and auto re-add rules if cleared.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.ListValue, 'seq_mode', _('Sequence Mode'),
			_('FakeTCP sequence number mode. Must match server configuration.'));
		o.value('0', _('0 - Static (no increment)'));
		o.value('1', _('1 - Increment every packet'));
		o.value('2', _('2 - Random increment (~3 packets)'));
		o.value('3', _('3 - Simulate real TCP (Recommended)'));
		o.value('4', _('4 - Like 3, no Window Scale'));
		o.default = '3';
		o.modalonly = true;
		o.depends('raw_mode', 'faketcp');
		o.depends('raw_mode', 'easy-faketcp');
		
		o = s.option(form.Value, 'lower_level', _('Lower Level'),
			_('Send packets at OSI layer 2. Format: eth0#00:11:22:33:44:55 or auto.'));
		o.placeholder = 'auto';
		o.optional = true;
		o.modalonly = true;
		
		// ===== 客户端专用选项 =====
		o = s.option(form.Value, 'source_ip', _('Source IP'),
			_('Force source IP for raw socket. Client only option.'));
		o.datatype = 'ipaddr';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.Value, 'source_port', _('Source Port'),
			_('Force source port for raw socket. Disables port changing during reconnection. Client only option.'));
		o.datatype = 'port';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.Flag, 'disable_anti_replay', _('Disable Anti-Replay'),
			_('Disable replay attack protection. NOT recommended.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Flag, 'fix_gro', _('Fix GRO'),
			_('Try to fix huge packets caused by GRO.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Value, 'mtu_warn', _('MTU Warning Threshold'),
			_('Warn when packet size exceeds this value.'));
		o.datatype = 'range(100,1500)';
		o.placeholder = '1375';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.Value, 'sock_buf', _('Socket Buffer Size (KB)'),
			_('Socket buffer size in KB. Range: 10-10240.'));
		o.datatype = 'range(10,10240)';
		o.placeholder = '1024';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.Flag, 'force_sock_buf', _('Force Socket Buffer'),
			_('Bypass system limitation for socket buffer.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Value, 'dev', _('Bind Device'),
			_('Bind raw socket to specific network interface.'));
		o.placeholder = 'eth0';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.Flag, 'disable_bpf', _('Disable BPF'),
			_('Disable kernel space BPF filter.'));
		o.default = '0';
		o.modalonly = true;
		
		o = s.option(form.Value, 'hb_len', _('Heartbeat Length'),
			_('Length of heartbeat packets (0-1500 bytes).'));
		o.datatype = 'range(0,1500)';
		o.optional = true;
		o.modalonly = true;
		
		o = s.option(form.DynamicList, 'extra_args', _('Extra Arguments'),
			_('Additional command line arguments.'));
		o.optional = true;
		o.modalonly = true;
		
		return m.render();
	}

});
