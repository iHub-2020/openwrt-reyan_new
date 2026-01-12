/**
 * Copyright (C) 2024 iHub-2020
 * 
 * LuCI UDP Tunnel Manager - Status Page
 * Displays real-time tunnel status, connection info, and diagnostics
 * 
 * @module luci-app-udp-tunnel/status
 * @version 2.7
 * @date 2026-01-12
 * 
 * Changelog:
 *   v2.7   - Fixed Iptables Rules to display ACTUAL chain names (e.g. udp2rawDwrW_...) instead of count
 *          - Fixed "Last updated" text color by removing inline styles completely
 *   v2.6   - Reverted label to "Iptables Rules"
 *          - Enhanced Iptables detection
 *   v2.5   - Improved "Core Binary" detection logic
 */

'use strict';
'require view';
'require fs';
'require ui';
'require uci';
'require rpc';
'require poll';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

return view.extend({
	title: _('UDP Tunnel Status'),

	pollInterval: 5,

	cleanText: function(str) {
		if (!str) return '';
		return String(str).replace(/\x1B[[0-9;]*[a-zA-Z]/g, '').trim();
	},

	getServiceStatus: function() {
		return L.resolveDefault(callServiceList('udp2raw'), {}).then(function(res) {
			var instances = {};
			var isRunning = false;
			
			if (res && res.udp2raw && res.udp2raw.instances) {
				for (var key in res.udp2raw.instances) {
					var inst = res.udp2raw.instances[key];
					if (inst && inst.running) {
						isRunning = true;
						instances[key] = {
							pid: inst.pid,
							command: Array.isArray(inst.command) ? inst.command.join(' ') : ''
						};
					}
				}
			}
			return { running: isRunning, instances: instances };
		});
	},

	getTunnelConfigs: function() {
		return uci.load('udp2raw').then(function() {
			var tunnels = [];
			var sections = uci.sections('udp2raw');

			sections.forEach(function(s) {
				if (s['.type'] === 'general') return;

				var mode = 'client';
				var localStr = '?';
				var remoteStr = '?';

				if (s['.type'] === 'server') {
					mode = 'server';
					var listenPort = s.listen_port || s.local_port || '29900'; 
					var target = s.forward_to || s.target || s.target_addr || '127.0.0.1';
					var targetPort = s.target_port || s.forward_port || '';
					localStr = '0.0.0.0:' + listenPort;
					remoteStr = target + (targetPort ? ':' + targetPort : '');
				} else {
					mode = 'client';
					var localIP = s.local_addr || '127.0.0.1';
					var localPort = s.local_port || '3333';
					var serverIP = s.server_addr || s.remote_addr || '127.0.0.1';
					var serverPort = s.server_port || s.remote_port || '29900';
					localStr = localIP + ':' + localPort;
					remoteStr = serverIP + ':' + serverPort;
				}

				tunnels.push({
					id: s['.name'],
					alias: s.alias || s['.name'],
					mode: mode, 
					disabled: s.enabled === '0' || s.disabled === '1',
					local: localStr,
					remote: remoteStr,
					raw_mode: s.raw_mode || 'faketcp'
				});
			});
			return tunnels;
		});
	},

	getRecentLogs: function() {
		var self = this;
		return fs.exec('/sbin/logread', ['-e', 'udp2raw']).then(function(res) {
			var output = res.stdout || '';
			if (!output && res.code !== 0) {
				return fs.exec('/bin/sh', ['-c', 'logread | grep udp2raw | tail -n 150']);
			}
			return res;
		}).then(function(res) {
			var logContent = res.stdout || '';
			if (!logContent) return [];
			var lines = logContent.trim().split('\n');
			return lines.slice(-150).map(self.cleanText).reverse();
		}).catch(function() {
			return [];
		});
	},

	getVersion: function() {
		var checkBin = function(path) {
			return fs.exec(path, ['-h']).then(function(res) {
				var output = (res.stdout || '') + (res.stderr || '');
				var match = output.match(/git\s*version\s*:?\s*([a-f0-9]+)/i);
				if (!match) {
					match = output.match(/version\s*:?\s*([^\s,]+)/i);
				}
				if (match && match[1]) return { installed: true, version: match[1] };
				if (output.length > 10) return { installed: true, version: 'Unknown' };
				throw new Error('No output');
			});
		};

		return checkBin('/usr/bin/udp2raw').catch(function() {
			return fs.exec('/bin/sh', ['-c', 'which udp2raw']).then(function(res) {
				var p = (res.stdout || '').trim();
				if (p) return checkBin(p);
				throw new Error('Not found');
			});
		}).catch(function() {
			return { installed: false, version: null };
		});
	},

	/**
	 * 5. 检查 iptables (v2.7: 修复，直接显示 Chain 名称)
	 */
	checkIptables: function() {
		return fs.exec('/usr/sbin/iptables-save').then(function(res) {
			var rawOutput = res.stdout || '';
			var statusText = _('No rules detected');
			var statusColor = '#f0ad4e'; // orange
			var present = false;

			// 提取所有 :udp2raw 开头的字符串 (例如 :udp2rawDwrW_e76d91a7_C0)
			// 正则解释: 匹配冒号开头，后面跟着 udp2raw，然后是非空字符，直到遇到空格或换行
			var chainMatches = rawOutput.match(/:udp2raw[^\s]*/g);
			
			if (chainMatches && chainMatches.length > 0) {
				present = true;
				statusColor = '#5cb85c';
				
				// 去掉前面的冒号
				var chainNames = chainMatches.map(function(s) { return s.substring(1); });
				// 拼接显示，如果有多个，用逗号分隔
				statusText = _('Active: ') + chainNames.join(', ');
				
			} else if (rawOutput.indexOf('udp2raw') !== -1) {
				// 兜底：虽然没匹配到 Chain 定义，但有规则引用
				present = true;
				statusText = _('Active (Rules Detected)');
				statusColor = '#5cb85c';
			} else if (rawOutput.indexOf('DROP') !== -1 && rawOutput.indexOf('RST') !== -1) {
				present = true;
				statusText = _('Active (RST Blocking Detected)');
				statusColor = '#5cb85c';
			}

			return { present: present, text: statusText, color: statusColor };
		}).catch(function() { 
			return { present: false, text: _('Check failed'), color: '#d9534f' }; 
		});
	},

	fetchStatusData: function() {
		return Promise.all([
			this.getServiceStatus(),
			this.getTunnelConfigs(),
			this.getVersion(),
			this.checkIptables()
		]);
	},

	load: function() {
		return Promise.all([
			this.fetchStatusData(),
			this.getRecentLogs()
		]);
	},

	render: function(data) {
		var self = this;
		var statusData = data[0];
		var initialLogs = data[1];
		
		var view = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('UDP Tunnel Status')),
			
			// 1. Service Status
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display: flex; align-items: center; padding: 10px 0;' }, [
					E('div', { 'style': 'width: 200px; font-weight: bold;' }, _('Service Status:')),
					E('div', { 'id': 'status-indicator', 'style': 'font-weight: bold;' }, _('Loading...'))
				])
			]),

			// 2. Tunnel Table
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Tunnel Status')),
				E('table', { 'class': 'table cbi-section-table', 'id': 'tunnel-table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Name')),
						E('th', { 'class': 'th' }, _('Mode')),
						E('th', { 'class': 'th' }, _('Status')),
						E('th', { 'class': 'th' }, _('Local')),
						E('th', { 'class': 'th' }, _('Remote')),
						E('th', { 'class': 'th' }, _('Protocol')),
						E('th', { 'class': 'th' }, _('PID'))
					])
				])
			]),

			// 3. Diagnostics
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('System Diagnostics')),
				E('div', { 'style': 'display: grid; grid-template-columns: 200px 1fr; gap: 10px;' }, [
					E('div', { 'style': 'font-weight: bold;' }, _('Core Binary:')),
					E('div', { 'id': 'diag-binary' }, _('Checking...')),
					E('div', { 'style': 'font-weight: bold;' }, _('Iptables Rules:')),
					// v2.7: 允许换行，防止 Chain 名称过长撑破布局
					E('div', { 'id': 'diag-iptables', 'style': 'word-break: break-all;' }, _('Checking...'))
				])
			]),

			// 4. Logs
			E('div', { 'class': 'cbi-section' }, [
				E('h3', { 'style': 'display:flex; justify-content:space-between; align-items:center;' }, [
					_('Recent Logs'),
					// v2.7: 彻底移除 style 属性，只保留 id，强制跟随主题颜色
					E('small', { 'id': 'log-status' }, '')
				]),
				E('textarea', {
					'style': 'width: 100%; height: 500px; font-family: monospace; font-size: 12px; background: #1e1e1e; color: #ddd; border: 1px solid #444; padding: 10px; border-radius: 3px;',
					'readonly': 'readonly',
					'wrap': 'off',
					'id': 'syslog-textarea'
				}),
				E('div', { 'style': 'margin-top: 5px; text-align: right;' }, [
					E('button', { 
						'class': 'cbi-button cbi-button-apply', 
						'click': function() { self.refreshLogs(view); }
					}, _('Refresh Logs')),
					' ',
					E('button', { 
						'class': 'cbi-button cbi-button-neutral', 
						'click': function() {
							var ta = document.getElementById('syslog-textarea');
							if (ta) ta.scrollTop = ta.scrollHeight;
						}
					}, _('Scroll to Bottom'))
				])
			])
		]);

		this.updateStatusView(view, statusData);
		this.updateLogView(view, initialLogs);

		poll.add(function() {
			return self.fetchStatusData().then(function(newData) {
				self.updateStatusView(view, newData);
			});
		}, this.pollInterval);

		return view;
	},

	refreshLogs: function(view) {
		var self = this;
		var logStatus = view.querySelector('#log-status');
		if (logStatus) logStatus.textContent = _('Refreshing...');
		
		this.getRecentLogs().then(function(logs) {
			self.updateLogView(view, logs);
		});
	},

	updateLogView: function(view, logs) {
		var logTa = view.querySelector('#syslog-textarea');
		var logStatus = view.querySelector('#log-status');
		
		if (logTa) {
			var newText = logs.length > 0 ? logs.join('\n') : _('No logs found.');
			logTa.value = newText;
			logTa.scrollTop = logTa.scrollHeight;
		}

		if (logStatus) {
			var d = new Date();
			logStatus.textContent = _('Last updated: ') + d.toLocaleTimeString();
		}
	},

	updateStatusView: function(view, data) {
		var status = data[0];
		var tunnels = data[1];
		var versionInfo = data[2];
		var iptablesInfo = data[3];

		// 1. Update Service Status
		var statusEl = view.querySelector('#status-indicator');
		if (statusEl) {
			var activeCount = Object.keys(status.instances).length;
			if (status.running) {
				statusEl.style.color = '#5cb85c';
				statusEl.textContent = _('Running') + ' (' + activeCount + ' tunnels active)';
			} else {
				statusEl.style.color = '#d9534f';
				statusEl.textContent = _('Stopped');
			}
		}

		// 2. Update Table
		var table = view.querySelector('#tunnel-table');
		if (table) {
			while (table.rows.length > 1) { table.deleteRow(1); }

			if (tunnels.length === 0) {
				var row = table.insertRow(-1);
				row.className = 'tr';
				var cell = row.insertCell(0);
				cell.className = 'td';
				cell.colSpan = 7;
				cell.style.textAlign = 'center';
				cell.style.padding = '20px';
				cell.innerHTML = '<em>' + _('No tunnels configured.') + '</em>';
			} else {
				tunnels.forEach(function(t) {
					var instance = status.instances[t.id] || status.instances[t.alias];
					var isRunning = !!instance;
					
					var rowColor = '#d9534f';
					var statusLabel = _('Stopped');
					if (t.disabled) {
						rowColor = '#999';
						statusLabel = _('Disabled');
					} else if (isRunning) {
						rowColor = '#5cb85c';
						statusLabel = _('Running');
					}

					var row = table.insertRow(-1);
					row.className = 'tr';
					
					var addCell = function(text, color) {
						var c = row.insertCell(-1);
						c.className = 'td';
						if (color) c.style.color = color;
						if (color) c.style.fontWeight = 'bold';
						c.textContent = text;
						return c;
					};

					addCell(t.alias);
					addCell(t.mode === 'server' ? _('Server') : _('Client'));
					addCell(statusLabel, rowColor);
					
					var cLocal = row.insertCell(-1); 
					cLocal.className = 'td';
					cLocal.textContent = t.local;
					
					var cRemote = row.insertCell(-1); 
					cRemote.className = 'td';
					cRemote.textContent = t.remote;

					addCell(t.raw_mode + ' / xor');
					addCell(instance ? instance.pid : '-');
				});
			}
		}

		// 3. Update Diagnostics
		var diagBin = view.querySelector('#diag-binary');
		if (diagBin) {
			if (versionInfo.installed) {
				diagBin.innerHTML = '<span style="color:#5cb85c">✓ ' + _('Verified') + ' (' + versionInfo.version + ')</span>';
			} else {
				diagBin.innerHTML = '<span style="color:#d9534f">✗ ' + _('Not Found') + '</span>';
			}
		}
		var diagIp = view.querySelector('#diag-iptables');
		if (diagIp) {
			diagIp.innerHTML = '<span style="color:' + iptablesInfo.color + '">' + 
			                   (iptablesInfo.present ? '✓ ' : '⚠ ') + iptablesInfo.text + '</span>';
		}
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
