/**
 * Copyright (C) 2024 iHub-2020
 * 
 * LuCI Udp2raw Status Page
 * Displays real-time tunnel status, connection info, and diagnostics
 * 
 * @module luci-app-udp2raw/status
 * @version 1.0.1
 * @date 2026-01-09
 */

'use strict';
'require view';
'require fs';
'require ui';
'require poll';
'require uci';
'require rpc';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

return view.extend({
	title: _('Udp2raw Tunnel Status'),
	
	/**
	 * 获取进程运行状态
	 */
	getServiceStatus: function() {
		return L.resolveDefault(callServiceList('udp2raw'), {}).then(function(res) {
			var isRunning = false;
			var instances = [];
			
			try {
				if (res.udp2raw && res.udp2raw.instances) {
					for (var key in res.udp2raw.instances) {
						var inst = res.udp2raw.instances[key];
						if (inst.running) {
							isRunning = true;
							instances.push({
								name: key,
								pid: inst.pid || 'N/A',
								command: inst.command ? inst.command.join(' ') : 'N/A'
							});
						}
					}
				}
			} catch (e) {
				console.error('Error parsing service status:', e);
			}
			
			return {
				running: isRunning,
				instances: instances
			};
		});
	},
	
	/**
	 * 获取配置的隧道列表
	 */
	getTunnelConfigs: function() {
		return uci.load('udp2raw').then(function() {
			var tunnels = [];
			var globalEnabled = uci.get('udp2raw', 'general', 'enabled') === '1';
			
			uci.sections('udp2raw', 'tunnel', function(s) {
				tunnels.push({
					id: s['.name'],
					alias: s.alias || s['.name'],
					mode: s.mode || 'unknown',
					disabled: s.disabled === '1',
					local: (s.local_addr || '0.0.0.0') + ':' + (s.local_port || '?'),
					remote: (s.remote_addr || '?') + ':' + (s.remote_port || '?'),
					raw_mode: s.raw_mode || 'faketcp',
					cipher: s.cipher_mode || 'aes128cbc',
					auth: s.auth_mode || 'hmac_sha1',
					auto_rule: s.auto_rule !== '0'
				});
			});
			
			return {
				globalEnabled: globalEnabled,
				tunnels: tunnels
			};
		});
	},
	
	/**
	 * 读取系统日志中的 udp2raw 相关条目
	 */
	getRecentLogs: function() {
		return L.resolveDefault(fs.exec('/usr/bin/logread', ['-e', 'udp2raw']), {})
			.then(function(res) {
				if (res.code === 0 && res.stdout) {
					var lines = res.stdout.trim().split('\n').slice(-100);
					return lines.filter(function(line) {
						return line.length > 0;
					});
				}
				return [];
			});
	},
	
	/**
	 * 检查 iptables 规则状态
	 */
	checkIptablesRules: function() {
		return L.resolveDefault(fs.exec('/usr/sbin/iptables', ['-L', 'INPUT', '-n', '-v']), {})
			.then(function(res) {
				var rules = [];
				var hasUdp2rawRules = false;
				
				if (res.code === 0 && res.stdout) {
					var lines = res.stdout.split('\n');
					lines.forEach(function(line) {
						// 查找 DROP RST 规则（udp2raw 添加的）
						if (line.indexOf('RST') !== -1 || line.indexOf('reject-with') !== -1) {
							hasUdp2rawRules = true;
							rules.push(line.trim());
						}
					});
				}
				
				return {
					present: hasUdp2rawRules,
					rules: rules,
					raw: res.stdout || ''
				};
			});
	},
	
	/**
	 * 检查 udp2raw 二进制文件
	 */
	checkBinary: function() {
		return L.resolveDefault(fs.stat('/usr/bin/udp2raw'), null).then(function(stat) {
			if (stat) {
				return L.resolveDefault(fs.exec('/usr/bin/udp2raw', ['--version']), {}).then(function(res) {
					return {
						installed: true,
						version: res.stdout ? res.stdout.trim().split('\n')[0] : 'Unknown'
					};
				});
			}
			return { installed: false, version: null };
		});
	},
	
	/**
	 * 渲染状态表格
	 */
	renderStatusTable: function(status, configData) {
		var tunnels = configData.tunnels;
		
		var table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Name')),
				E('th', { 'class': 'th' }, _('Mode')),
				E('th', { 'class': 'th' }, _('Status')),
				E('th', { 'class': 'th' }, _('Local')),
				E('th', { 'class': 'th' }, _('Remote')),
				E('th', { 'class': 'th' }, _('Protocol')),
				E('th', { 'class': 'th' }, _('PID'))
			])
		]);
		
		if (tunnels.length === 0) {
			var row = E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '7', 'style': 'text-align: center;' }, 
					E('em', {}, _('No tunnels configured. Go to Configuration tab to add one.')))
			]);
			table.appendChild(row);
			return table;
		}
		
		tunnels.forEach(function(t) {
			var isRunning = false;
			var pid = '-';
			
			// 匹配运行中的实例
			status.instances.forEach(function(inst) {
				if (inst.name === t.id) {
					isRunning = true;
					pid = inst.pid;
				}
			});
			
			var statusBadge;
			var statusText;
			
			if (!configData.globalEnabled) {
				statusBadge = E('span', { 
					'class': 'label',
					'style': 'background-color: #777; color: white; padding: 2px 8px; border-radius: 3px;'
				}, _('Service Disabled'));
			} else if (t.disabled) {
				statusBadge = E('span', { 
					'class': 'label',
					'style': 'background-color: #999; color: white; padding: 2px 8px; border-radius: 3px;'
				}, _('Disabled'));
			} else if (isRunning) {
				statusBadge = E('span', { 
					'class': 'label',
					'style': 'background-color: #5cb85c; color: white; padding: 2px 8px; border-radius: 3px;'
				}, _('Running'));
			} else {
				statusBadge = E('span', { 
					'class': 'label',
					'style': 'background-color: #d9534f; color: white; padding: 2px 8px; border-radius: 3px;'
				}, _('Stopped'));
			}
			
			var modeLabel = t.mode === 'client' ? _('Client') : _('Server');
			var protocolInfo = t.raw_mode + ' / ' + t.cipher;
			
			var row = E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, E('strong', {}, t.alias)),
				E('td', { 'class': 'td' }, modeLabel),
				E('td', { 'class': 'td' }, statusBadge),
				E('td', { 'class': 'td' }, E('code', { 'style': 'font-size: 12px;' }, t.local)),
				E('td', { 'class': 'td' }, E('code', { 'style': 'font-size: 12px;' }, t.remote)),
				E('td', { 'class': 'td', 'style': 'font-size: 12px;' }, protocolInfo),
				E('td', { 'class': 'td' }, pid)
			]);
			
			table.appendChild(row);
		});
		
		return table;
	},
	
	/**
	 * 渲染诊断信息
	 */
	renderDiagnostics: function(iptablesInfo, binaryInfo) {
		var items = [];
		
		// 二进制文件状态
		items.push(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Binary Status:')),
			E('div', { 'class': 'cbi-value-field' }, 
				binaryInfo.installed 
					? E('span', { 'style': 'color: green;' }, '✓ ' + _('Installed') + ' - ' + binaryInfo.version)
					: E('span', { 'style': 'color: red;' }, '✗ ' + _('Not found at /usr/bin/udp2raw')))
		]));
		
		// iptables 规则状态
		items.push(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Iptables Rules:')),
			E('div', { 'class': 'cbi-value-field' }, 
				iptablesInfo.present 
					? E('span', { 'style': 'color: green;' }, '✓ ' + _('Rules detected (RST blocking active)'))
					: E('span', { 'style': 'color: orange;' }, '⚠ ' + _('No rules detected - will be added when tunnel starts')))
		]));
		
		// 安全提示
		items.push(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Safety Tips:')),
			E('div', { 'class': 'cbi-value-field' }, [
				E('ul', { 'style': 'margin: 0; padding-left: 20px; font-size: 13px;' }, [
					E('li', {}, _('FakeTCP mode requires iptables rules to block kernel TCP RST')),
					E('li', {}, _('Use "Keep Iptables Rules" option for OpenWrt stability')),
					E('li', {}, _('Ensure password and modes match on both client and server')),
					E('li', {}, _('For WireGuard: add route exception to prevent traffic loop'))
				])
			])
		]));
		
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('System Diagnostics')),
			E('div', {}, items)
		]);
	},
	
	/**
	 * 渲染日志区域
	 */
	renderLogs: function(logs) {
		var logText = logs.length > 0 
			? logs.join('\n') 
			: _('No udp2raw logs found in system log.');
		
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Recent Logs')),
			E('p', { 'style': 'font-size: 12px; color: #666;' }, 
				_('Last 100 log entries from system log (logread -e udp2raw)')),
			E('textarea', {
				'readonly': 'readonly',
				'style': 'width: 100%; height: 300px; font-family: monospace; font-size: 11px; ' +
				         'background: #1e1e1e; color: #d4d4d4; padding: 10px; border: 1px solid #333;',
				'wrap': 'off',
				'spellcheck': 'false'
			}, logText),
			E('div', { 'style': 'margin-top: 10px;' }, [
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': function() {
						var textarea = this.parentNode.previousSibling;
						textarea.scrollTop = textarea.scrollHeight;
					}
				}, _('Scroll to Bottom')),
				E('span', {}, ' '),
				E('button', {
					'class': 'cbi-button',
					'click': function() {
						location.reload();
					}
				}, _('Refresh'))
			])
		]);
	},
	
	/**
	 * 主加载函数
	 */
	load: function() {
		return Promise.all([
			this.getServiceStatus(),
			this.getTunnelConfigs(),
			this.checkIptablesRules(),
			this.getRecentLogs(),
			this.checkBinary()
		]);
	},
	
	render: function(data) {
		var status = data[0];
		var configData = data[1];
		var iptablesInfo = data[2];
		var logs = data[3];
		var binaryInfo = data[4];
		
		var globalStatusText;
		var globalStatusStyle;
		
		if (!binaryInfo.installed) {
			globalStatusText = _('Binary Not Found');
			globalStatusStyle = 'color: red; font-weight: bold;';
		} else if (!configData.globalEnabled) {
			globalStatusText = _('Service Disabled');
			globalStatusStyle = 'color: #999; font-weight: bold;';
		} else if (status.running) {
			globalStatusText = _('Running') + ' (' + status.instances.length + ' ' + _('tunnels') + ')';
			globalStatusStyle = 'color: green; font-weight: bold;';
		} else {
			globalStatusText = _('Stopped');
			globalStatusStyle = 'color: red; font-weight: bold;';
		}
		
		var view = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Udp2raw Tunnel Status')),
			
			// 全局状态
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Service Status:')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('span', { 'style': globalStatusStyle }, '● ' + globalStatusText)
					])
				])
			]),
			
			// 隧道状态表格
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Tunnel Status')),
				this.renderStatusTable(status, configData)
			]),
			
			// 诊断信息
			this.renderDiagnostics(iptablesInfo, binaryInfo),
			
			// 日志
			this.renderLogs(logs)
		]);
		
		// 设置自动刷新（每10秒）
		poll.add(L.bind(function() {
			return this.load().then(L.bind(function(refreshData) {
				var container = document.querySelector('.cbi-map');
				if (container) {
					var newView = this.render(refreshData);
					container.parentNode.replaceChild(newView, container);
				}
			}, this));
		}, this), 10);
		
		return view;
	},
	
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});