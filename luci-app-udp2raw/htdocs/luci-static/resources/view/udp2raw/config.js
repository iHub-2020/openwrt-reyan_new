'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require uci';
'require poll';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/usr/bin/udp2raw'), null),
			uci.load('udp2raw')
		]);
	},

	render: function(data) {
		var hasUdp2raw = data[0];
		var m, s, o;

		m = new form.Map('udp2raw', _('udp2raw-tunnel'),
			_('udp2raw-tunnel is a tunnel which turns UDP traffic into encrypted UDP/FakeTCP/ICMP traffic by using raw socket.'));

		// Binary check warning
		if (!hasUdp2raw) {
			m.description = E('p', { 'style': 'color:red; font-weight:bold' }, [
				_('udp2raw-tunnel binary file not found.'),
				' ',
				_('Please install udp2raw package or copy binary to /usr/bin/udp2raw manually.')
			]);
		}

		// Global Settings
		s = m.section(form.TypedSection, 'general', _('Global Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		// Server Instances
		s = m.section(form.GridSection, 'servers', _('Server Instances'),
			_('Server mode listens on a port and forwards decrypted traffic to local service'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.editable = true;
		o.rmempty = false;

		o = s.option(form.Value, 'alias', _('Alias'));
		o.rmempty = false;
		o.placeholder = 'Server1';

		o = s.option(form.Value, 'local_addr', _('Listen Address'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';
		o.rmempty = false;

		o = s.option(form.Value, 'local_port', _('Listen Port'));
		o.datatype = 'port';
		o.placeholder = '4096';
		o.rmempty = false;

		o = s.option(form.Value, 'server_addr', _('Destination Address'));
		o.datatype = 'host';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;

		o = s.option(form.Value, 'server_port', _('Destination Port'));
		o.datatype = 'port';
		o.placeholder = '443';
		o.rmempty = false;

		// Advanced options for servers
		o = s.option(form.ListValue, 'raw_mode', _('Raw Mode'));
		o.value('faketcp', _('FakeTCP'));
		o.value('udp', _('UDP'));
		o.value('icmp', _('ICMP'));
		o.default = 'faketcp';
		o.modalonly = true;

		o = s.option(form.Value, 'key', _('Password'));
		o.password = true;
		o.placeholder = 'password';
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

		o = s.option(form.DynamicList, 'other_args', _('Other Arguments'),
			_('Extra command line arguments, one per line'));
		o.placeholder = '--log-level 4';
		o.modalonly = true;

		// Client Instances
		s = m.section(form.GridSection, 'clients', _('Client Instances'),
			_('Client mode connects to remote server and forwards local UDP traffic'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.editable = true;
		o.rmempty = false;

		o = s.option(form.Value, 'alias', _('Alias'));
		o.rmempty = false;
		o.placeholder = 'Client1';

		o = s.option(form.Value, 'local_addr', _('Listen Address'));
		o.datatype = 'ipaddr';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;

		o = s.option(form.Value, 'local_port', _('Listen Port'));
		o.datatype = 'port';
		o.placeholder = '7777';
		o.rmempty = false;

		o = s.option(form.Value, 'server_addr', _('Server Address'));
		o.datatype = 'host';
		o.placeholder = 'example.com';
		o.rmempty = false;

		o = s.option(form.Value, 'server_port', _('Server Port'));
		o.datatype = 'port';
		o.placeholder = '4096';
		o.rmempty = false;

		// Advanced options for clients (same as servers)
		o = s.option(form.ListValue, 'raw_mode', _('Raw Mode'));
		o.value('faketcp', _('FakeTCP'));
		o.value('udp', _('UDP'));
		o.value('icmp', _('ICMP'));
		o.default = 'faketcp';
		o.modalonly = true;

		o = s.option(form.Value, 'key', _('Password'));
		o.password = true;
		o.placeholder = 'password';
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

		o = s.option(form.DynamicList, 'other_args', _('Other Arguments'),
			_('Extra command line arguments, one per line'));
		o.placeholder = '--log-level 4';
		o.modalonly = true;

		return m.render();
	}
});