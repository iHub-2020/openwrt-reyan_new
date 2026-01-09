'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec('/usr/bin/pgrep', ['-f', 'udp2raw']), null),
			L.resolveDefault(fs.stat('/usr/bin/udp2raw'), null)
		]);
	},

	render: function(data) {
		var procData = data[0];
		var hasUdp2raw = data[1];
		var running = procData && procData.code === 0;

		var status = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('udp2raw-tunnel Status')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'table' }, [
						E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td left' }, _('Binary Installed:')),
							E('div', { 'class': 'td left' }, 
								E('span', { 
									'style': hasUdp2raw ? 'color:green;font-weight:bold' : 'color:red;font-weight:bold' 
								}, hasUdp2raw ? _('Yes') : _('No'))
							)
						]),
						E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td left' }, _('Service Status:')),
							E('div', { 'class': 'td left' }, 
								E('span', { 
									'style': running ? 'color:green;font-weight:bold' : 'color:red;font-weight:bold' 
								}, running ? _('Running') : _('Not Running'))
							)
						])
					])
				])
			])
		]);

		return status;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});