/**
 * Copyright (C) 2024 iHub-2020
 * 
 * LuCI UDP Tunnel Manager - Status Page
 * Displays real-time tunnel status, connection info, and diagnostics
 * 
 * @module luci-app-udp-tunnel/status
 * @version 1.3.0
 * @date 2026-01-10
 * 
 * Changelog:
 *   v1.3.0 - Fixed ANSI escape code filtering for binary version display
 *          - Fixed status alignment using tables
 *          - Removed bullet points from status display
 *          - Fixed color scheme (Running=green, Stopped/Disabled=red)
 *          - Updated field names to match init.d (remote_addr/remote_port)
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
	title: _('UDP Tunnel Status'),
	
	/**
	 * 过滤 ANSI 转义码
	 * 修复 Binary Status 显示 [32m[2026-01-10... 等乱码问题
	 */
	stripAnsi: function(str) {
		if (!str) return '';
		// 移除所有 ANSI 转义序列
		return str
			.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')  // 标准 ANSI
			.replace(/\x1B\][^\x07]*\x07/g, '')      // OSC 序列
			.replace(/\[([0-9;]*)m/g, '')            // 残留的颜色码
			.replace(/\x1B/g, '')                    // 残留的 ESC 字符
			.trim();
	},
	
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
	 * 注意：使用 remote_addr/remote_port 与 init.d 保持一致
	 */
	getTunnelConfigs: function() {
		return uci.load('udp2raw').then(function() {
			var tunnels = [];
			var globalEnabled = uci.get('udp2raw', 'general', 'enabled') === '1';
			
			uci.sections('udp2raw', 'tunnel', function(s) {
				tunnels.push({
					id: s['.name'],
					alias: s.alias || s['.name'],
					mode: s.mode || 'client',
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
		var self = this;
		return L.resolveDefault(fs.exec('/usr/bin/logread', ['-e', 'udp2raw']), {})
			.then(function(res) {
				if (res.code === 0 && res.stdout) {
					var lines = res.stdout.trim().split('\n').slice(-100);
					return lines.filter(function(line) {
						return line.length > 0;
					}).map(function(line) {
						// 过滤每行的 ANSI 码
						return self.stripAnsi(line);
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
				var hasUdp2rawRules = false;
				
				if (res.code === 0 && res.stdout) {
					// 查找 DROP RST 规则（udp2raw 添加的）
					if (res.stdout.indexOf('RST') !== -1 || 
					    res.stdout.indexOf('reject-with') !== -1 ||
					    res.stdout.indexOf('DROP') !== -1) {
						hasUdp2rawRules = true;
					}
				}
				
				return {
					present: hasUdp2rawRules,
					raw: res.stdout || ''
				};
			});
	},
	
	/**
	 * 检查 udp2raw 二进制文件
	 */
	checkBinary: function() {
		var self = this;
		return L.resolveDefault(fs.stat('/usr/bin/udp2raw'), null).then(function(stat) {
			if (stat) {
				return L.resolveDefault(fs.exec('/usr/bin/udp2raw', ['--version']), {}).then(function(res) {
					var version = 'Unknown';
					if (res.stdout) {
						// 过滤 ANSI 转义码并提取版本信息
						var cleaned = self.stripAnsi(res.stdout);
						var lines = cleaned.split('\n');
						for (var i = 0; i < lines.length; i++) {
							var line = lines[i].trim();
							if (line.length > 0) {
								// 取第一个非空行作为版本
								version = line;
								break;
							}
						}
					}
					return {
						installed: true,
						version: version
					};
				});
			}
			return { installed: false, version: null };
		});
	},
	
	/**
	 * 渲染隧道状态表格
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
			
			var statusText, statusColor;
			
			if (!configData.globalEnabled) {
				statusText = _('Service Disabled');
				statusColor = '#d9534f';  // 红色
			} else if (t.disabled) {
				statusText = _('Disabled');
				statusColor = '#999999';  // 灰色
			} else if (isRunning) {
				statusText = _('Running');
				statusColor = '#5cb85c';  // 绿色
			} else {
				statusText = _('Stopped');
				statusColor = '#d9534f';  // 红色
			}
			
			var statusBadge = E('span', { 
				'style': 'color: ' + statusColor + '; font-weight: bold;'
			}, statusText);
			
			var modeLabel = t.mode === 'server' ? _('Server') : _('Client');
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
		var binaryStatus, binaryColor;
		if (binaryInfo.installed) {
			binaryStatus = '✓ ' + _('Installed') + ' - ' + binaryInfo.version;
			binaryColor = '#5cb85c';
		} else {
			binaryStatus = '✗ ' + _('Not found at /usr/bin/udp2raw');
			binaryColor = '#d9534f';
		}
		
		var iptablesStatus, iptablesColor;
		if (iptablesInfo.present) {
			iptablesStatus = '✓ ' + _('Rules detected (RST blocking active)');
			iptablesColor = '#5cb85c';
		} else {
			iptablesStatus = '⚠ ' + _('No rules detected - will be added when tunnel starts');
			iptablesColor = '#f0ad4e';
		}
		
		var diagTable = E('table', { 'class': 'table', 'style': 'width: 100%;' }, [
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'width: 180px; font-weight: bold; vertical-align: top;' }, 
					_('Binary Status:')),
				E('td', { 'class': 'td' }, 
					E('span', { 'style': 'color: ' + binaryColor + ';' }, binaryStatus))
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'width: 180px; font-weight: bold; vertical-align: top;' }, 
					_('Iptables Rules:')),
				E('td', { 'class': 'td' }, 
					E('span', { 'style': 'color: ' + iptablesColor + ';' }, iptablesStatus))
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'width: 180px; font-weight: bold; vertical-align: top;' }, 
					_('Safety Tips:')),
				E('td', { 'class': 'td' }, [
					E('ul', { 'style': 'margin: 0; padding-left: 20px; color: #666;' }, [
						E('li', {}, _('FakeTCP mode requires iptables rules to block kernel TCP RST')),
						E('li', {}, _('Use "Keep Iptables Rules" option for OpenWrt stability')),
						E('li', {}, _('Ensure password and modes match on both client and server')),
						E('li', {}, _('For WireGuard: add route exception to prevent traffic loop'))
					])
				])
			])
		]);
		
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('System Diagnostics')),
			diagTable
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
				'id': 'log-textarea',
				'readonly': 'readonly',
				'style': 'width: 100%; height: 300px; font-family: monospace; font-size: 11px; ' +
				         'background: #1e1e1e; color: #d4d4d4; padding: 10px; border: 1px solid #333; ' +
				         'border-radius: 4px;',
				'wrap': 'off',
				'spellcheck': 'false'
			}, logText),
			E('div', { 'style': 'margin-top: 10px;' }, [
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': function() {
						var textarea = document.getElementById('log-textarea');
						if (textarea) {
							textarea.scrollTop = textarea.scrollHeight;
						}
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
		
		var globalStatusText, globalStatusColor;
		
		if (!binaryInfo.installed) {
			globalStatusText = _('Binary Not Found');
			globalStatusColor = '#d9534f';
		} else if (!configData.globalEnabled) {
			globalStatusText = _('Service Disabled');
			globalStatusColor = '#d9534f';
		} else if (status.running) {
			globalStatusText = _('Running') + ' (' + status.instances.length + ' ' + _('tunnels') + ')';
			globalStatusColor = '#5cb85c';
		} else {
			globalStatusText = _('Stopped');
			globalStatusColor = '#d9534f';
		}
		
		// 服务状态表格
		var statusInfoTable = E('table', { 'class': 'table', 'style': 'width: 100%; margin-bottom: 20px;' }, [
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'width: 180px; font-weight: bold;' }, 
					_('Service Status:')),
				E('td', { 'class': 'td' }, 
					E('span', { 'style': 'color: ' + globalStatusColor + '; font-weight: bold;' }, 
						globalStatusText))
			])
		]);
		
		var view = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('UDP Tunnel Status')),
			
			// 全局状态
			E('div', { 'class': 'cbi-section' }, [
				statusInfoTable
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