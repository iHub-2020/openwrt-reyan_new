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
 * - Integrated service control with reset functionality
 * 
 * @module luci-app-udp-tunnel/config
 * @version 2.1.0
 * @date 2026-01-30
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
		
		// Add immediate service control when toggling
		o.write = function(section_id, formvalue) {
			var enabled = formvalue === '1';
			var action = enabled ? 'start' : 'stop';
			
			// Save the configuration first
			uci.set('udp2raw', section_id, 'enabled', formvalue);
			
			// Then control the service immediately
			callInitAction('udp2raw', action).catch(function(err) {
				console.error('Failed to ' + action + ' service:', err);
			});
			
			return formvalue;
		};
		
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
		
		// Override renderSectionAdd to add import/export buttons for servers
		s.renderSectionAdd = function(extra_class) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments);
			
			// Create import button (styled like edit button)
			var importBtn = E('button', {
				'class': 'cbi-button cbi-button-positive',
				'style': 'margin-left: 5px;',
				'title': _('Import server configurations'),
				'click': function(ev) {
					ev.preventDefault();
					ev.stopPropagation();
					importServerConfig();
				}
			}, _('导入服务器'));
			
			// Create export button (styled like delete button)
			var exportBtn = E('button', {
				'class': 'cbi-button cbi-button-apply',
				'style': 'margin-left: 5px;',
				'title': _('Export server configurations'),
				'click': function(ev) {
					ev.preventDefault();
					ev.stopPropagation();
					exportServerConfig();
				}
			}, _('导出服务器'));
			
			// Insert buttons directly into the existing button container
			var addBtn = el.querySelector('.cbi-button-add');
			if (addBtn && addBtn.parentNode) {
				addBtn.parentNode.appendChild(importBtn);
				addBtn.parentNode.appendChild(exportBtn);
			}
			
			return el;
		};
		
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
		
		// Override renderSectionAdd to add import/export buttons for clients
		s.renderSectionAdd = function(extra_class) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments);
			
			// Create import button (styled like edit button)
			var importBtn = E('button', {
				'class': 'cbi-button cbi-button-positive',
				'style': 'margin-left: 5px;',
				'title': _('Import client configurations'),
				'click': function(ev) {
					ev.preventDefault();
					ev.stopPropagation();
					importClientConfig();
				}
			}, _('导入客户端'));
			
			// Create export button (styled like delete button)
			var exportBtn = E('button', {
				'class': 'cbi-button cbi-button-apply',
				'style': 'margin-left: 5px;',
				'title': _('Export client configurations'),
				'click': function(ev) {
					ev.preventDefault();
					ev.stopPropagation();
					exportClientConfig();
				}
			}, _('导出客户端'));
			
			// Insert buttons directly into the existing button container
			var addBtn = el.querySelector('.cbi-button-add');
			if (addBtn && addBtn.parentNode) {
				addBtn.parentNode.appendChild(importBtn);
				addBtn.parentNode.appendChild(exportBtn);
			}
			
			return el;
		};
		
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
		// Override "Save & Apply" to control service based on enabled flag
		m.handleSaveApply = function(ev, mode) {
			return this.save(function() {
				ui.showModal(_('Applying Configuration'), [
					E('p', { 'class': 'spinning' }, _('Saving configuration...'))
				]);
				
				// Get the enabled status from general section
				var enabled = uci.get('udp2raw', uci.sections('udp2raw', 'general')[0]['.name'], 'enabled');
				var action = enabled === '1' ? 'start' : 'stop';
				
				return callInitAction('udp2raw', action).then(function() {
					ui.hideModal();
					ui.addNotification(null, E('p', _('Configuration applied successfully')), 'info');
					setTimeout(function() { window.location.reload(); }, 1500);
				}).catch(function(err) {
					ui.hideModal();
					ui.addNotification(null, E('p', _('Configuration saved but failed to control service: ') + (err.message || err)), 'error');
				});
			});
		};
		
		// ==================== Modify Reset Button After Render ====================
		var originalRender = m.render.bind(m);
		m.render = function() {
			var mapEl = originalRender();
			
			// Create the reset click handler function
			var handleResetClick = function(ev) {
				ev.preventDefault();
				ev.stopPropagation();
				
				ui.showModal(_('Reset Configuration'), [
					E('p', {}, _('Are you sure you want to reset all UDP tunnel configurations?')),
					E('p', {}, _('This will:')),
					E('ul', {}, [
						E('li', {}, _('Clear all server and client configurations')),
						E('li', {}, _('Stop the udp2raw service')),
						E('li', {}, _('Reset general settings to defaults'))
					]),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button cbi-button-neutral',
							'click': ui.hideModal
						}, _('Cancel')),
						E('button', {
							'class': 'cbi-button cbi-button-negative',
							'click': function() {
								ui.hideModal();
								performReset();
							}
						}, _('Reset'))
					])
				]);
			};
			
			// Function to perform the actual reset
			var performReset = function() {
				ui.showModal(_('Resetting Configuration'), [
					E('p', { 'class': 'spinning' }, _('Clearing all configurations...'))
				]);
				
				// Stop service first
				callInitAction('udp2raw', 'stop').then(function() {
					// Clear all server sections
					var serverSections = uci.sections('udp2raw', 'server');
					serverSections.forEach(function(section) {
						uci.remove('udp2raw', section['.name']);
					});
					
					// Clear all client sections
					var clientSections = uci.sections('udp2raw', 'client');
					clientSections.forEach(function(section) {
						uci.remove('udp2raw', section['.name']);
					});
					
					// Reset general section to defaults
					var generalSections = uci.sections('udp2raw', 'general');
					if (generalSections.length > 0) {
						var generalSection = generalSections[0]['.name'];
						uci.set('udp2raw', generalSection, 'enabled', '0');
						uci.set('udp2raw', generalSection, 'keep_rule', '1');
						uci.set('udp2raw', generalSection, 'wait_lock', '1');
						uci.set('udp2raw', generalSection, 'retry_on_error', '1');
						uci.set('udp2raw', generalSection, 'log_level', '4');
					}
					
					// Save changes
					return uci.save();
				}).then(function() {
					ui.hideModal();
					ui.addNotification(null, E('p', _('Configuration reset successfully')), 'info');
					setTimeout(function() { 
						window.location.reload(); 
					}, 1500);
				}).catch(function(err) {
					ui.hideModal();
					ui.addNotification(null, 
						E('p', _('Failed to reset configuration: ') + (err.message || err)), 
						'error');
				});
			};
			
			// Function to apply button modifications
			var applyButtonMods = function() {
				var resetBtn = document.querySelector('.cbi-button-reset');
				
				if (resetBtn) {
					// Force override onclick
					resetBtn.onclick = handleResetClick;
					
					// Remove color classes first
					resetBtn.classList.remove('cbi-button-positive', 'cbi-button-negative', 'cbi-button-neutral');
					
					// Set text and style for reset button
					resetBtn.textContent = '复位';
					resetBtn.classList.add('cbi-button-neutral');
					resetBtn.title = _('Reset all configurations to defaults');
					
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
		
		// ==================== Import/Export Functions ====================
		
		// Export server configurations
		var exportServerConfig = function() {
			var serverSections = uci.sections('udp2raw', 'server');
			if (serverSections.length === 0) {
				ui.addNotification(null, E('p', _('No server configurations to export')), 'warning');
				return;
			}
			
			var exportData = {
				type: 'server',
				version: '1.0',
				timestamp: new Date().toISOString(),
				configs: serverSections.map(function(section) {
					var config = {};
					for (var key in section) {
						if (key !== '.anonymous' && key !== '.index' && key !== '.type') {
							config[key] = section[key];
						}
					}
					return config;
				})
			};
			
			var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
			var url = URL.createObjectURL(blob);
			var a = document.createElement('a');
			a.href = url;
			a.download = 'udp2raw_servers_' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.json';
			a.click();
			URL.revokeObjectURL(url);
			
			ui.addNotification(null, E('p', _('Server configurations exported successfully')), 'info');
		};
		
		// Import server configurations
		var importServerConfig = function() {
			var input = document.createElement('input');
			input.type = 'file';
			input.accept = '.json';
			input.onchange = function(e) {
				var file = e.target.files[0];
				if (!file) return;
				
				var reader = new FileReader();
				reader.onload = function(e) {
					try {
						var data = JSON.parse(e.target.result);
						validateAndImportServers(data);
					} catch (err) {
						ui.addNotification(null, E('p', _('Invalid JSON file: ') + err.message), 'error');
					}
				};
				reader.readAsText(file);
			};
			input.click();
		};
		
		// Validate and import server data
		var validateAndImportServers = function(data) {
			if (!data || data.type !== 'server' || !Array.isArray(data.configs)) {
				ui.addNotification(null, E('p', _('Invalid server configuration file format')), 'error');
				return;
			}
			
			var validConfigs = [];
			var errors = [];
			
			data.configs.forEach(function(config, index) {
				var error = validateServerConfig(config, index + 1);
				if (error) {
					errors.push(error);
				} else {
					validConfigs.push(config);
				}
			});
			
			if (errors.length > 0) {
				ui.showModal(_('Import Validation Errors'), [
					E('p', {}, _('The following errors were found:')),
					E('ul', {}, errors.map(function(err) { return E('li', {}, err); })),
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
						E('button', { 
							'class': 'cbi-button cbi-button-positive',
							'click': function() {
								ui.hideModal();
								if (validConfigs.length > 0) {
									importValidServers(validConfigs);
								}
							}
						}, _('Import Valid Configs') + ' (' + validConfigs.length + ')')
					])
				]);
			} else {
				importValidServers(validConfigs);
			}
		};
		
		// Validate individual server config
		var validateServerConfig = function(config, index) {
			if (!config.local_port || !/^\d+$/.test(config.local_port) || 
				parseInt(config.local_port) < 1 || parseInt(config.local_port) > 65535) {
				return _('Config') + ' ' + index + ': ' + _('Invalid WAN Listen Port');
			}
			if (!config.remote_addr || !/^[\w\.-]+$/.test(config.remote_addr)) {
				return _('Config') + ' ' + index + ': ' + _('Invalid Forward To IP');
			}
			if (!config.remote_port || !/^\d+$/.test(config.remote_port) || 
				parseInt(config.remote_port) < 1 || parseInt(config.remote_port) > 65535) {
				return _('Config') + ' ' + index + ': ' + _('Invalid Forward To Port');
			}
			if (!config.key || config.key.length < 1) {
				return _('Config') + ' ' + index + ': ' + _('Password is required');
			}
			return null;
		};
		
		// Import valid server configurations
		var importValidServers = function(configs) {
			var imported = 0;
			configs.forEach(function(config) {
				var section_id = uci.add('udp2raw', 'server');
				for (var key in config) {
					if (key !== '.name') {
						uci.set('udp2raw', section_id, key, config[key]);
					}
				}
				// Set defaults for missing fields
				if (!config.enabled) uci.set('udp2raw', section_id, 'enabled', '1');
				if (!config.local_addr) uci.set('udp2raw', section_id, 'local_addr', '0.0.0.0');
				if (!config.raw_mode) uci.set('udp2raw', section_id, 'raw_mode', 'faketcp');
				if (!config.cipher_mode) uci.set('udp2raw', section_id, 'cipher_mode', 'aes128cbc');
				if (!config.auth_mode) uci.set('udp2raw', section_id, 'auth_mode', 'md5');
				if (!config.auto_rule) uci.set('udp2raw', section_id, 'auto_rule', '1');
				imported++;
			});
			
			// Save configurations to system
			uci.save().then(function() {
				ui.addNotification(null, E('p', _('Successfully imported') + ' ' + imported + ' ' + _('server configurations')), 'info');
				setTimeout(function() { window.location.reload(); }, 1500);
			}).catch(function(err) {
				ui.addNotification(null, E('p', _('Failed to save imported configurations: ') + (err.message || err)), 'error');
			});
		};
		
		// Export client configurations
		var exportClientConfig = function() {
			var clientSections = uci.sections('udp2raw', 'client');
			if (clientSections.length === 0) {
				ui.addNotification(null, E('p', _('No client configurations to export')), 'warning');
				return;
			}
			
			var exportData = {
				type: 'client',
				version: '1.0',
				timestamp: new Date().toISOString(),
				configs: clientSections.map(function(section) {
					var config = {};
					for (var key in section) {
						if (key !== '.anonymous' && key !== '.index' && key !== '.type') {
							config[key] = section[key];
						}
					}
					return config;
				})
			};
			
			var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
			var url = URL.createObjectURL(blob);
			var a = document.createElement('a');
			a.href = url;
			a.download = 'udp2raw_clients_' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.json';
			a.click();
			URL.revokeObjectURL(url);
			
			ui.addNotification(null, E('p', _('Client configurations exported successfully')), 'info');
		};
		
		// Import client configurations
		var importClientConfig = function() {
			var input = document.createElement('input');
			input.type = 'file';
			input.accept = '.json';
			input.onchange = function(e) {
				var file = e.target.files[0];
				if (!file) return;
				
				var reader = new FileReader();
				reader.onload = function(e) {
					try {
						var data = JSON.parse(e.target.result);
						validateAndImportClients(data);
					} catch (err) {
						ui.addNotification(null, E('p', _('Invalid JSON file: ') + err.message), 'error');
					}
				};
				reader.readAsText(file);
			};
			input.click();
		};
		
		// Validate and import client data
		var validateAndImportClients = function(data) {
			if (!data || data.type !== 'client' || !Array.isArray(data.configs)) {
				ui.addNotification(null, E('p', _('Invalid client configuration file format')), 'error');
				return;
			}
			
			var validConfigs = [];
			var errors = [];
			
			data.configs.forEach(function(config, index) {
				var error = validateClientConfig(config, index + 1);
				if (error) {
					errors.push(error);
				} else {
					validConfigs.push(config);
				}
			});
			
			if (errors.length > 0) {
				ui.showModal(_('Import Validation Errors'), [
					E('p', {}, _('The following errors were found:')),
					E('ul', {}, errors.map(function(err) { return E('li', {}, err); })),
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
						E('button', { 
							'class': 'cbi-button cbi-button-positive',
							'click': function() {
								ui.hideModal();
								if (validConfigs.length > 0) {
									importValidClients(validConfigs);
								}
							}
						}, _('Import Valid Configs') + ' (' + validConfigs.length + ')')
					])
				]);
			} else {
				importValidClients(validConfigs);
			}
		};
		
		// Validate individual client config
		var validateClientConfig = function(config, index) {
			if (!config.remote_addr || !/^[\w\.-]+$/.test(config.remote_addr)) {
				return _('Config') + ' ' + index + ': ' + _('Invalid VPS Address');
			}
			if (!config.remote_port || !/^\d+$/.test(config.remote_port) || 
				parseInt(config.remote_port) < 1 || parseInt(config.remote_port) > 65535) {
				return _('Config') + ' ' + index + ': ' + _('Invalid VPS Port');
			}
			if (!config.local_port || !/^\d+$/.test(config.local_port) || 
				parseInt(config.local_port) < 1 || parseInt(config.local_port) > 65535) {
				return _('Config') + ' ' + index + ': ' + _('Invalid Local Listen Port');
			}
			if (!config.key || config.key.length < 1) {
				return _('Config') + ' ' + index + ': ' + _('Password is required');
			}
			return null;
		};
		
		// Import valid client configurations
		var importValidClients = function(configs) {
			var imported = 0;
			configs.forEach(function(config) {
				var section_id = uci.add('udp2raw', 'client');
				for (var key in config) {
					if (key !== '.name') {
						uci.set('udp2raw', section_id, key, config[key]);
					}
				}
				// Set defaults for missing fields
				if (!config.enabled) uci.set('udp2raw', section_id, 'enabled', '1');
				if (!config.local_addr) uci.set('udp2raw', section_id, 'local_addr', '127.0.0.1');
				if (!config.raw_mode) uci.set('udp2raw', section_id, 'raw_mode', 'faketcp');
				if (!config.cipher_mode) uci.set('udp2raw', section_id, 'cipher_mode', 'aes128cbc');
				if (!config.auth_mode) uci.set('udp2raw', section_id, 'auth_mode', 'md5');
				if (!config.auto_rule) uci.set('udp2raw', section_id, 'auto_rule', '1');
				if (!config.seq_mode) uci.set('udp2raw', section_id, 'seq_mode', '3');
				imported++;
			});
			
			// Save configurations to system
			uci.save().then(function() {
				ui.addNotification(null, E('p', _('Successfully imported') + ' ' + imported + ' ' + _('client configurations')), 'info');
				setTimeout(function() { window.location.reload(); }, 1500);
			}).catch(function(err) {
				ui.addNotification(null, E('p', _('Failed to save imported configurations: ') + (err.message || err)), 'error');
			});
		};
		
		// ==================== Final Render ====================
		return m.render();
	}
});
