/**
 * Copyright (C) 2024 iHub-2020
 * 
 * LuCI Udp2raw Status Page
 * Displays real-time tunnel status, connection info, and diagnostics
 * 
 * @module luci-app-udp2raw/status
 * @version 1.0.0
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
					auth: s.auth_mode || 'hmac_sha1'
				});
			});
			return tunnels;
		});
	},
	
	/**
	 * 读取日志文件
	 */
	getRecentLogs: function() {
		return L.resolveDefault(fs.exec('/usr/bin/logread', ['-e', 'udp2raw']), {})
			.then(function(res) {
				if (res.code === 0 && res.stdout) {
					var lines = res.stdout.trim().split('\n').slice(-50);
					return lines.filter(function(line) {
						return line.length > 0;
					});
				}
				return [];
			});
	},
	
	/**
	 * 检查 iptables 规则
	 */
	checkIptablesRules: function() {
		return L.resolveDefault(fs.exec('/usr/sbin/iptables', ['-L', '-n', '-v']), {})
			.then(function(res) {
				if (res.code === 0 && res.stdout) {
					var hasUdp2rawRules = res.stdout.indexOf('udp2raw') !== -1 ||
					                       res.stdout.indexOf('RST') !== -1;
					return {
						present: hasUdp2rawRules,
						output: res.stdout.split('\n').slice(0, 20).join('\n')
					};
				}
				return { present: false, output: 'Unable to check iptables' };
			});
	},
	
	/**
	 * 渲染状态表格
	 */
	renderStatusTable: function(status, tunnels) {
		var table = E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, _('Tunnel Name')),
				E('div', { 'class': 'th' }, _('Mode')),
				E('div', { 'class': 'th' }, _('Status')),
				E('div', { 'class': 'th' }, _('Local Address')),
				E('div', { 'class': 'th' }, _('Remote Address')),
				E('div', { 'class': 'th' }, _('Protocol')),
				E('div', { 'class': 'th' }, _('PID'))
			])
		]);
		
		if (tunnels.length === 0) {
			table.appendChild(E('div', { 'class': 'tr placeholder' }, [
				E('div', { 'class': 'td', 'colspan': 7 }, 
					E('em', {}, _('No tunnels configured')))
			]));
			return table;
		}
		
		tunnels.forEach(function(t) {
			var isRunning = false;
			var pid = 'N/A';
			
			// 匹配运行中的实例
			status.instances.forEach(function(inst) {
				if (inst.name === t.id) {
					isRunning = true;
					pid = inst.pid;
				}
			});
			
			var statusBadge;
			if (t.disabled) {
				statusBadge = E('span', { 
					'class': 'label',
					'style': 'background-color: #999; color: white;'
				}, _('Disabled'));
			} else if (isRunning) {
				statusBadge = E('span', { 
					'class': 'label',
					'style': 'background-color: #5cb85c; color: white;'
				}, _('Running'));
			} else {
				statusBadge = E('span', { 
					'class': 'label',
					'style': 'background-color: #d9534f; color: white;'
				}, _('Stopped'));
			}
			
			table.appendChild(E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td' }, t.alias),
				E('div', { 'class': 'td' }, t.mode.toUpperCase()),
				E('div', { 'class': 'td' }, statusBadge),
				E('div', { 'class': 'td' }, E('code', {}, t.local)),
				E('div', { 'class': 'td' }, E('code', {}, t.remote)),
				E('div', { 'class': 'td' }, t.raw_mode + '/' + t.cipher),
				E('div', { 'class': 'td' }, pid)
			]));
		});
		
		return table;
	},
	
	/**
	 * 渲染诊断信息
	 */
	renderDiagnostics: function(iptablesInfo) {
		var diagnostics = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('System Diagnostics')),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Iptables Rules Status:')),
				E('div', { 'class': 'cbi-value-field' }, [
					iptablesInfo.present 
						? E('span', { 'style': 'color: green;' }, '✓ ' + _('Rules detected'))
						: E('span', { 'style': 'color: red;' }, '✗ ' + _('No rules found - tunnels may not work!'))
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('⚠️ Important:')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('ul', {}, [
						E('li', {}, _('FakeTCP mode requires iptables rules to block kernel TCP processing')),
						E('li', {}, _('Enable "Auto Rule" (-a) or "Keep Rule" (--keep-rule) in tunnel config')),
						E('li', {}, _('On OpenWrt, rules may be cleared when network settings change')),
						E('li', {}, _('Use "--keep-rule" option to auto-restore rules'))
					])
				])
			])
		]);
		
		return diagnostics;
	},
	
	/**
	 * 渲染日志区域
	 */
	renderLogs: function(logs) {
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Recent Logs (last 50 lines)')),
			E('div', { 'class': 'cbi-value-field' }, [
				E('textarea', {
					'readonly': 'readonly',
					'style': 'width: 100%; height: 300px; font-family: monospace; font-size: 12px;',
					'wrap': 'off'
				}, logs.join('\n') || _('No logs available'))
			])
		]);
	},
	
	/**
	 * 主渲染函数
	 */
	load: function() {
		return Promise.all([
			this.getServiceStatus(),
			this.getTunnelConfigs(),
			this.checkIptablesRules(),
			this.getRecentLogs()
		]);
	},
	
	render: function(data) {
		var status = data[0];
		var tunnels = data[1];
		var iptablesInfo = data[2];
		var logs = data[3];
		
		var view = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Udp2raw Tunnel Status')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Service Status:')),
					E('div', { 'class': 'cbi-value-field' }, [
						status.running 
							? E('span', { 
								'style': 'color: green; font-weight: bold;' 
							}, '● ' + _('Running'))
							: E('span', { 
								'style': 'color: red; font-weight: bold;' 
							}, '● ' + _('Stopped'))
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Active Tunnels:')),
					E('div', { 'class': 'cbi-value-field' }, 
						E('strong', {}, status.instances.length.toString()))
				])
			]),
			
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Tunnel Status')),
				this.renderStatusTable(status, tunnels)
			]),
			
			this.renderDiagnostics(iptablesInfo),
			this.renderLogs(logs)
		]);
		
		// 设置自动刷新（每5秒）
		poll.add(L.bind(function() {
			return this.load().then(L.bind(function(refreshData) {
				var container = document.querySelector('.cbi-map');
				if (container) {
					var newView = this.render(refreshData);
					container.parentNode.replaceChild(newView, container);
				}
			}, this));
		}, this), 5);
		
		return view;
	},
	
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
