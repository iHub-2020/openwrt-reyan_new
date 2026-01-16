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
 * - Integrated service control with dynamic Start/Stop toggle
 * 
 * @module luci-app-udp-tunnel/config
 * @version 2.0.0
 * @date 2026-01-16
 * 
 * Changelog:
 *   v2.0.0 - FIX: Aligned with official udp2raw documentation
 *          - Added missing cipher_mode: aes128cfb
 *          - Added missing auth_mode: md5, crc32
 *          - Added missing raw_mode: easy-faketcp
 *          - Added missing seq_mode: 0, 1, 2
 *          - Changed defaults to match official: cipher_mode=aes128cbc, auth_mode=md5
 *   v1.9.8 - FIX: Button stability - periodic check + immediate application
 *   v1.9.7 - FIX: Button position stability - use onclick property instead of clone
 *   v1.9.6 - FIX: Button click handler - replace event listener completely
 *   v1.9.5 - FIX: MutationObserver TypeError - use requestAnimationFrame instead
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
			// Safety Warning
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
		
		o = s.option(form.Flag, 'enabled', _('Enable Service'),
			_('Master switch. If disabled, no tunnels will run.'));
		o.default = '1';
		o.rmempty = false;
		
		o = s.option(form.Flag, 'keep_rule', _('Keep Iptables Rules'),
			_('Auto-restore iptables rules if cleared by system. Recommended.'));
		o.default = '1';

		o = s.option(form.Flag, 'wait_lock', _('Wait for Iptables Lock'),
			_('Wait for xtables lock while invoking iptables. Prevents failures during boot.'));
		o.default = '1';

		o = s.option(form.Flag, 'retry_on_error', _('Retry on Error'),
			_('Allow starting even if network is not ready. Recommended for auto-start.'));
		o.default = '1';
		
		o = s.option(form.ListValue, 'log_level', _('Log Level'));
		o.value('1', _('Fatal'));
		o.value('2', _('Error'));
		o.value('3', _('Warning'));
		o.value('4', _('Info (Default)'));
		o.default = '4';
		
		// ==================== Server Instances ====================
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
		
		s.handleAdd = function(ev) {
			var section_id = uci.add('udp2raw', 'server');
			uci.set('udp2raw', section_id, 'enabled', '1');
			uci.set('udp2raw', section_id, 'local_addr', '0.0.0.0');
			uci.set('udp2raw', section_id, 'raw_mode', 'faketcp');
			uci.set('udp2raw', section_id, 'cipher_mode', 'aes128cbc');
			uci.set('udp2raw', section_id, 'auth_mode', 'md5');
			uci.set('udp2raw', section_id, 'auto_rule', '1');
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

		o = s.taboption('basic', form.Value, 'local_port', _('WAN Listen Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.width = '15%';
		
		o = s.taboption('basic', form.Value, 'remote_addr', _('Forward To IP'));
		o.datatype = 'host';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;
		o.width = '15%';
		
		o = s.taboption('basic', form.Value, 'remote_port', _('Forward To Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.width = '10%';

		// Modal Only Options
		o = s.taboption('basic', form.Value, 'key', _('Password (-k)'), 
			_('Encryption password. Must match client configuration exactly.'));
		o.password = true;
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('basic', form.Value, 'local_addr', _('WAN Listen Address (-l)'), 
			_('Address to listen on. Use 0.0.0.0 for all interfaces.'));
		o.datatype = 'ipaddr';
		o.default = '0.0.0.0';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'raw_mode', _('Raw Mode'), 
			_('Transport protocol. Official default is faketcp.'));
		o.value('faketcp', 'FakeTCP (Default)');
		o.value('easy-faketcp', 'Easy-FakeTCP');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');
		o.default = 'faketcp';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.ListValue, 'cipher_mode', _('Cipher Mode'),
			_('Encryption algorithm. Official default is aes128cbc.'));
		o.value('aes128cbc', 'AES-128-CBC (Default)');
		o.value('aes128cfb', 'AES-128-CFB');
		o.value('xor', 'XOR (Fast)');
		o.value('none', 'None (Debug Only)');
		o.default = 'aes128cbc';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.ListValue, 'auth_mode', _('Auth Mode'),
			_('Authentication algorithm. Official default is md5.'));
		o.value('hmac_sha1', 'HMAC-SHA1');
		o.value('md5', 'MD5 (Default)');
		o.value('crc32', 'CRC32');
		o.value('simple', 'Simple');
		o.value('none', 'None (Debug Only)');
		o.default = 'md5';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.Flag, 'auto_rule', _('Auto Add Iptables Rule (-a)'),
			_('Automatically add iptables rules to block kernel TCP processing. Required for FakeTCP.'));
		o.default = '1';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.DynamicList, 'extra_args', _('Extra Arguments'),
			_('Additional command line arguments (e.g. --seq-mode 4).'));
		o.optional = true;
		o.modalonly = true;

		// ==================== Client Instances ====================
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
			uci.set('udp2raw', section_id, 'cipher_mode', 'aes128cbc');
			uci.set('udp2raw', section_id, 'auth_mode', 'md5');
			uci.set('udp2raw', section_id, 'auto_rule', '1');
			uci.set('udp2raw', section_id, 'seq_mode', '3');
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
		
		o = s.taboption('basic', form.Value, 'remote_addr', _('VPS Address'));
		o.datatype = 'host';
		o.rmempty = false;
		o.width = '15%';
		
		o = s.taboption('basic', form.Value, 'remote_port', _('VPS Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.width = '10%';
		
		o = s.taboption('basic', form.Value, 'local_port', _('Local Listen Port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.width = '15%';

		// Modal Only Options
		o = s.taboption('basic', form.Value, 'key', _('Password (-k)'), 
			_('Encryption password. Must match server configuration exactly.'));
		o.password = true;
		o.rmempty = false;
		o.modalonly = true;
		
		o = s.taboption('basic', form.Value, 'local_addr', _('Local Listen Address (-l)'), 
			_('IP to bind locally. Use 127.0.0.1 for local apps (WireGuard/OpenVPN).'));
		o.datatype = 'ipaddr';
		o.default = '127.0.0.1';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'raw_mode', _('Raw Mode'), 
			_('Transport protocol. Official default is faketcp.'));
		o.value('faketcp', 'FakeTCP (Default)');
		o.value('easy-faketcp', 'Easy-FakeTCP');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');
		o.default = 'faketcp';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.ListValue, 'cipher_mode', _('Cipher Mode'),
			_('Encryption algorithm. Official default is aes128cbc.'));
		o.value('aes128cbc', 'AES-128-CBC (Default)');
		o.value('aes128cfb', 'AES-128-CFB');
		o.value('xor', 'XOR (Fast)');
		o.value('none', 'None (Debug Only)');
		o.default = 'aes128cbc';
		o.modalonly = true;
		
		o = s.taboption('advanced', form.ListValue, 'auth_mode', _('Auth Mode'),
			_('Authentication algorithm. Official default is md5.'));
		o.value('hmac_sha1', 'HMAC-SHA1');
		o.value('md5', 'MD5 (Default)');
		o.value('crc32', 'CRC32');
		o.value('simple', 'Simple');
		o.value('none', 'None (Debug Only)');
		o.default = 'md5';
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
		
		o = s.taboption('advanced', form.ListValue, 'seq_mode', _('Sequence Mode'), 
			_('Seq increase mode for FakeTCP. Official default is mode 3.'));
		o.value('0', _('0 - Static header, no seq increase'));
		o.value('1', _('1 - Increase seq every packet'));
		o.value('2', _('2 - Increase seq randomly (~every 3 packets)'));
		o.value('3', _('3 - Simulate real seq/ack (Default)'));
		o.value('4', _('4 - Like 3, ignore Window Scale'));
		o.default = '3';
		o.depends('raw_mode', 'faketcp');
		o.modalonly = true;
		
		o = s.taboption('advanced', form.DynamicList, 'extra_args', _('Extra Arguments'));
		o.optional = true;
		o.modalonly = true;
		
		// ==================== Custom Button Handlers ====================
		// Override "Save & Apply" to auto-restart service
		m.handleSaveApply = function(ev, mode) {
			return this.save(function() {
				ui.showModal(_('Applying Configuration'), [
					E('p', { 'class': 'spinning' }, _('Saving configuration and restarting udp2raw service...'))
				]);
				
				return callInitAction('udp2raw', 'restart').then(function() {
					ui.hideModal();
					ui.addNotification(null, E('p', _('Configuration applied and service restarted successfully')), 'info');
					setTimeout(function() { window.location.reload(); }, 1500);
				}).catch(function(err) {
					ui.hideModal();
					ui.addNotification(null, E('p', _('Failed to restart service: ') + (err.message || err)), 'error');
				});
			});
		};
		
		// ==================== Modify Reset Button After Render ====================
		var originalRender = m.render.bind(m);
		m.render = function() {
			var mapEl = originalRender();
			
			// Create the click handler function
			var handleClick = function(ev) {
				ev.preventDefault();
				ev.stopPropagation();
				
				var action = isRunning ? 'stop' : 'start';
				var actionText = isRunning ? _('Stopping') : _('Starting');
				var successText = isRunning 
					? _('Service stopped successfully') 
					: _('Service started successfully');
				
				ui.showModal(actionText + ' ' + _('Service'), [
					E('p', { 'class': 'spinning' }, actionText + ' udp2raw service...')
				]);
				
				callInitAction('udp2raw', action).then(function(result) {
					ui.hideModal();
					ui.addNotification(null, E('p', successText), 'info');
					setTimeout(function() { 
						window.location.reload(); 
					}, 1500);
				}).catch(function(err) {
					ui.hideModal();
					ui.addNotification(null, 
						E('p', _('Failed to ' + action + ' service: ') + (err.message || err)), 
						'error');
				});
			};
			
			// Function to apply button modifications
			var applyButtonMods = function() {
				var resetBtn = document.querySelector('.cbi-button-reset');
				
				if (resetBtn) {
					// Force override onclick
					resetBtn.onclick = handleClick;
					
					// Remove color classes first
					resetBtn.classList.remove('cbi-button-positive', 'cbi-button-negative', 'cbi-button-neutral');
					
					// Set text and color based on service status
					if (isRunning) {
						resetBtn.textContent = '停止进程';
						resetBtn.classList.add('cbi-button-negative');
						resetBtn.title = _('Stop udp2raw service without saving changes');
					} else {
						resetBtn.textContent = '启动进程';
						resetBtn.classList.add('cbi-button-positive');
						resetBtn.title = _('Start udp2raw service without saving changes');
					}
					
					return true;
				}
				return false;
			};
			
			// Apply immediately after render
			requestAnimationFrame(function() {
				var attempts = 0;
				var maxAttempts = 30;
				
				var tryApply = function() {
					if (applyButtonMods()) {
						// Success - now set up periodic check (but reduce frequency)
						setInterval(applyButtonMods, 1000);
					} else if (attempts < maxAttempts) {
						attempts++;
						requestAnimationFrame(tryApply);
					}
				};
				
				tryApply();
			});
			
			return mapEl;
		};
		
		// ==================== Final Render ====================
		return m.render();
	}
});
