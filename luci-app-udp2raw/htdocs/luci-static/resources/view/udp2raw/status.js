'use strict';
'require view';
'require poll';
'require rpc';
'require uci';
'require fs';
'require ui';

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
	load: function() {
		return Promise.all([
			uci.load('udp2raw'),
			callServiceList('udp2raw'),
			L.resolveDefault(fs.exec('/usr/bin/pgrep', ['-f', 'udp2raw']), null)
		]);
	},

	render: function(data) {
		var serviceData = data[1];
		var pids = data[2] && data[2].stdout ? data[2].stdout.trim().split('\n').filter(function(p) { return p; }) : [];
		
		var enabled = uci.get('udp2raw', 'general', 'enabled') || '0';
		var instances = {};
		var running = false;

		// 解析服务实例
		if (serviceData && serviceData.udp2raw && serviceData.udp2raw.instances) {
			instances = serviceData.udp2raw.instances;
			running = Object.keys(instances).some(function(key) {
				return instances[key].running;
			});
		}

		var view = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('udp2raw Tunnel - Service Status')),
			E('div', { 'class': 'cbi-map-descr' }, 
				_('Real-time status of udp2raw tunnels and running processes')
			)
		]);

		// === 全局控制 ===
		var globalStatus = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Service Control')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('div', { 'class': 'table' }, [
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left', 'style': 'width: 33%' }, [
							E('strong', {}, _('Service Enabled: ')),
							enabled === '1' 
								? E('span', { 'style': 'color: green' }, _('Yes'))
								: E('span', { 'style': 'color: red' }, _('No'))
						]),
						E('div', { 'class': 'td left', 'style': 'width: 33%' }, [
							E('strong', {}, _('Current Status: ')),
							running 
								? E('span', { 'style': 'color: green; font-weight: bold' }, '● ' + _('RUNNING'))
								: E('span', { 'style': 'color: red; font-weight: bold' }, '● ' + _('STOPPED'))
						]),
						E('div', { 'class': 'td left', 'style': 'width: 33%' }, [
							E('strong', {}, _('Running PIDs: ')),
							pids.length > 0 
								? E('span', {}, pids.join(', '))
								: E('span', { 'style': 'color: gray' }, _('None'))
						])
					])
				]),
				E('div', { 'class': 'cbi-page-actions', 'style': 'margin-top: 10px' }, [
					E('button', {
						'class': 'cbi-button cbi-button-positive',
						'click': ui.createHandlerFn(this, function() {
							return callInitAction('udp2raw', 'start').then(function() {
								ui.addNotification(null, E('p', _('Starting udp2raw service...')), 'info');
								window.location.reload();
							});
						})
					}, _('Start')),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-negative',
						'click': ui.createHandlerFn(this, function() {
							return callInitAction('udp2raw', 'stop').then(function() {
								ui.addNotification(null, E('p', _('Stopping udp2raw service...')), 'info');
								window.location.reload();
							});
						})
					}, _('Stop')),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return callInitAction('udp2raw', 'restart').then(function() {
								ui.addNotification(null, E('p', _('Restarting udp2raw service...')), 'info');
								window.location.reload();
							});
						})
					}, _('Restart'))
				])
			])
		]);

		view.appendChild(globalStatus);

		// === 隧道实例状态 ===
		var tunnelSection = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Tunnel Instances'))
		]);

		var table = E('div', { 'class': 'table cbi-section-table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, _('Alias')),
				E('div', { 'class': 'th' }, _('Mode')),
				E('div', { 'class': 'th' }, _('Local')),
				E('div', { 'class': 'th' }, _('Remote')),
				E('div', { 'class': 'th' }, _('Raw Mode')),
				E('div', { 'class': 'th center' }, _('Status')),
				E('div', { 'class': 'th center' }, _('PID'))
			])
		]);

		var sections = uci.sections('udp2raw', 'tunnel');
		
		if (sections.length === 0) {
			table.appendChild(
				E('div', { 'class': 'tr placeholder' }, [
					E('div', { 'class': 'td' }, E('em', {}, _('No tunnel configured')))
				])
			);
		} else {
			sections.forEach(function(section) {
				var sid = section['.name'];
				var alias = section.alias || sid;
				var mode = section.mode || '-';
				var local = (section.local_addr || '?') + ':' + (section.local_port || '?');
				var remote = (section.remote_addr || '?') + ':' + (section.remote_port || '?');
				var rawMode = section.raw_mode || 'faketcp';
				
				var instance = instances[sid];
				var isRunning = instance && instance.running;
				var pid = isRunning && instance.pid ? instance.pid : '-';

				table.appendChild(
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td', 'data-title': _('Alias') }, alias),
						E('div', { 'class': 'td', 'data-title': _('Mode') }, 
							mode === 'client' ? _('Client') : _('Server')
						),
						E('div', { 'class': 'td', 'data-title': _('Local') }, local),
						E('div', { 'class': 'td', 'data-title': _('Remote') }, remote),
						E('div', { 'class': 'td', 'data-title': _('Raw Mode') }, rawMode),
						E('div', { 'class': 'td center', 'data-title': _('Status') }, 
							isRunning 
								? E('span', { 'style': 'color: green; font-weight: bold' }, '● ' + _('Running'))
								: E('span', { 'style': 'color: gray' }, '○ ' + _('Stopped'))
						),
						E('div', { 'class': 'td center', 'data-title': _('PID') }, String(pid))
					])
				);
			});
		}

		tunnelSection.appendChild(table);
		view.appendChild(tunnelSection);

		// === 进程详情 ===
		if (pids.length > 0) {
			var processSection = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Running Processes'))
			]);

			var processList = E('pre', { 'class': 'cbi-input-textarea', 'style': 'background: #f5f5f5; padding: 10px; overflow-x: auto' });

			fs.exec('/bin/ps', ['w']).then(function(res) {
				if (res.stdout) {
					var lines = res.stdout.split('\n').filter(function(line) {
						return pids.some(function(pid) {
							return line.indexOf(pid) === 0 || line.indexOf(' ' + pid + ' ') > 0;
						});
					});
					processList.textContent = lines.join('\n') || _('No matching processes found');
				}
			}).catch(function() {
				processList.textContent = _('Unable to retrieve process information');
			});

			processSection.appendChild(processList);
			view.appendChild(processSection);
		}

		// === 系统日志 ===
		var logSection = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Recent Logs (last 50 lines)'))
		]);

		var logOutput = E('pre', { 
			'class': 'cbi-input-textarea', 
			'style': 'background: #000; color: #0f0; padding: 10px; overflow-x: auto; max-height: 400px; overflow-y: scroll',
			'id': 'udp2raw_log'
		}, _('Loading logs...'));

		fs.exec('/sbin/logread', ['-e', 'udp2raw']).then(function(res) {
			if (res.stdout && res.stdout.trim()) {
				var lines = res.stdout.trim().split('\n');
				logOutput.textContent = lines.slice(-50).join('\n');
			} else {
				logOutput.textContent = _('No udp2raw logs found');
				logOutput.style.color = '#999';
			}
		}).catch(function() {
			logOutput.textContent = _('Unable to retrieve logs');
			logOutput.style.color = '#f00';
		});

		logSection.appendChild(logOutput);
		view.appendChild(logSection);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
