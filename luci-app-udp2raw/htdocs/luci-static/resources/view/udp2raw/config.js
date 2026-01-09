'use strict';
'require view';
'require form';
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
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/usr/bin/udp2raw'), null),
			L.resolveDefault(callServiceList('udp2raw'), {}),
			uci.load('udp2raw')
		]);
	},

	render: function(data) {
		var hasUdp2raw = data[0];
		var serviceStatus = data[1];
		var m, s, o;

		m = new form.Map('udp2raw', _('udp2raw-tunnel'),
			_('udp2raw-tunnel is a tunnel which turns UDP traffic into encrypted UDP/FakeTCP/ICMP traffic by using raw socket, helps you bypass UDP firewalls.'));

		// Binary check warning
		if (!hasUdp2raw) {
			m.description = E('p', { 'class': 'alert-message error' }, [
				E('strong', {}, _('Error: ')),
				_('udp2raw-tunnel binary file not found. '),
				_('Please install udp2raw package or copy binary to /usr/bin/udp2raw manually.')
			]);
		}

		// Service status display
		var isRunning = serviceStatus && serviceStatus.udp2raw && serviceStatus.udp2raw.instances;
		m.description = E('div', { 'class': 'cbi-section' }, [
			m.description || '',
			E('p', {}, [
				E('strong', {}, _('Service Status: ')),
				E('span', { 
					'class': isRunning ? 'label label-success' : 'label label-warning',
					'style': isRunning ? 'color:green;font-weight:bold' : 'color:red;font-weight:bold'
				}, isRunning ? _('Running') : _('Not Running'))
			])
		]);

		// Global Settings Section
		s = m.section(form.NamedSection, 'general', 'general', _('General Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '0';
		o.rmempty = false;

		// Get server list for dropdown
		var servers = [];
		var serverSections = uci.sections('udp2raw', 'servers');
		serverSections.forEach(function(section) {
			servers.push({
				value: section['.name'],
				label: section.alias || (section.server_addr + ':' + section.server_port)
			});
		});

		o = s.option(form.ListValue, 'server', _('Server Instance'),
			_('Select which server/client instance to run'));
		o.value('nil', _('Disable'));
		servers.forEach(function(server) {
			o.value(server.value, server.label);
		});
		o.default = 'nil';
		o.rmempty = false;

		o = s.option(form.Value, 'daemon_user', _('Run Daemon as User'));
		o.default = 'root';
		o.rmempty = false;

		// Server Instances Section
		s = m.section(form.GridSection, 'servers', _('Server Instances'),
			_('Server mode: Listen on a port and forward decrypted traffic to local service'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'alias', _('Alias'));
		o.rmempty = false;
		o.placeholder = 'MyServer';

		o = s.option(form.Value, 'local_addr', _('Listen Address'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';
		o.default = '0.0.0.0';

		o = s.option(form.Value, 'local_port', _('Listen Port'));
		o.datatype = 'port';
		o.placeholder = '4096';
		o.rmempty = false;

		o = s.option(form.Value, 'server_addr', _('Forward to Address'));
		o.datatype = 'host';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;

		o = s.option(form.Value, 'server_port', _('Forward to Port'));
		o.datatype = 'port';
		o.placeholder = '443';
		o.rmempty = false;

		// Advanced options - Modal only
		o = s.option(form.ListValue, 'raw_mode', _('Raw Mode'));
		o.value('faketcp', 'FakeTCP');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');
		o.default = 'faketcp';
		o.modalonly = true;

		o = s.option(form.Value, 'key', _('Password'));
		o.password = true;
		o.placeholder = 'secret';
		o.modalonly = true;

		o = s.option(form.ListValue, 'cipher_mode', _('Cipher Mode'));
		o.value('aes128cbc', 'AES-128-CBC');
		o.value('aes128cfb', 'AES-128-CFB');
		o.value('xor', 'XOR');
		o.value('none', _('None'));
		o.default = 'aes128cbc';
		o.modalonly = true;

		o = s.option(form.ListValue, 'auth_mode', _('Auth Mode'));
		o.value('md5', 'MD5');
		o.value('crc32', 'CRC32');
		o.value('simple', _('Simple'));
		o.value('none', _('None'));
		o.default = 'md5';
		o.modalonly = true;

		o = s.option(form.Flag, 'auto_rule', _('Auto Add Iptables Rule'));
		o.default = '1';
		o.modalonly = true;

		o = s.option(form.Flag, 'keep_rule', _('Keep Iptables Rule'));
		o.default = '0';
		o.modalonly = true;

		o = s.option(form.ListValue, 'seq_mode', _('Sequence Mode'));
		o.value('0', _('Disable'));
		o.value('1', _('Enable'));
		o.value('2', _('Enhanced'));
		o.value('3', _('Strict'));
		o.default = '1';
		o.modalonly = true;

		o = s.option(form.ListValue, 'lower_level', _('Lower Level'),
			_('Lower socket priority'));
		o.value('no', _('No'));
		o.value('nochecksum', 'No Checksum');
		o.value('csum', 'Checksum');
		o.default = 'no';
		o.modalonly = true;

		o = s.option(form.Flag, 'retry_on_error', _('Retry on Error'));
		o.default = '0';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'extra_args', _('Extra Arguments'),
			_('Additional command line arguments, one per line'));
		o.placeholder = '--log-level 4';
		o.modalonly = true;

		// Client Instances Section (similar structure)
		s = m.section(form.GridSection, 'clients', _('Client Instances'),
			_('Client mode: Connect to remote server and forward local UDP traffic'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'alias', _('Alias'));
		o.rmempty = false;
		o.placeholder = 'MyClient';

		o = s.option(form.Value, 'local_addr', _('Listen Address'));
		o.datatype = 'ipaddr';
		o.placeholder = '127.0.0.1';
		o.default = '127.0.0.1';

		o = s.option(form.Value, 'local_port', _('Listen Port'));
		o.datatype = 'port';
		o.placeholder = '7777';
		o.rmempty = false;

		o = s.option(form.Value, 'server_addr', _('Remote Server Address'));
		o.datatype = 'host';
		o.placeholder = 'example.com';
		o.rmempty = false;

		o = s.option(form.Value, 'server_port', _('Remote Server Port'));
		o.datatype = 'port';
		o.placeholder = '4096';
		o.rmempty = false;

		// Advanced options (same as servers)
		o = s.option(form.ListValue, 'raw_mode', _('Raw Mode'));
		o.value('faketcp', 'FakeTCP');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');
		o.default = 'faketcp';
		o.modalonly = true;

		o = s.option(form.Value, 'key', _('Password'));
		o.password = true;
		o.placeholder = 'secret';
		o.modalonly = true;

		o = s.option(form.ListValue, 'cipher_mode', _('Cipher Mode'));
		o.value('aes128cbc', 'AES-128-CBC');
		o.value('aes128cfb', 'AES-128-CFB');
		o.value('xor', 'XOR');
		o.value('none', _('None'));
		o.default = 'aes128cbc';
		o.modalonly = true;

		o = s.option(form.ListValue, 'auth_mode', _('Auth Mode'));
		o.value('md5', 'MD5');
		o.value('crc32', 'CRC32');
		o.value('simple', _('Simple'));
		o.value('none', _('None'));
		o.default = 'md5';
		o.modalonly = true;

		o = s.option(form.Flag, 'auto_rule', _('Auto Add Iptables Rule'));
		o.default = '1';
		o.modalonly = true;

		o = s.option(form.Flag, 'keep_rule', _('Keep Iptables Rule'));
		o.default = '0';
		o.modalonly = true;

		o = s.option(form.ListValue, 'seq_mode', _('Sequence Mode'));
		o.value('0', _('Disable'));
		o.value('1', _('Enable'));
		o.value('2', _('Enhanced'));
		o.value('3', _('Strict'));
		o.default = '1';
		o.modalonly = true;

		o = s.option(form.ListValue, 'lower_level', _('Lower Level'));
		o.value('no', _('No'));
		o.value('nochecksum', 'No Checksum');
		o.value('csum', 'Checksum');
		o.default = 'no';
		o.modalonly = true;

		o = s.option(form.Flag, 'retry_on_error', _('Retry on Error'));
		o.default = '0';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'extra_args', _('Extra Arguments'));
		o.placeholder = '--log-level 4';
		o.modalonly = true;

		return m.render();
	}
});