'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require poll';
'require ui';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('udp2raw'),
			callServiceList('udp2raw')
		]);
	},

	render: function(data) {
		var m, s, o;
		var serviceStatus = data[1];

		m = new form.Map('udp2raw', _('udp2raw Tunnel'),
			_('udp2raw turns UDP traffic into encrypted FakeTCP/UDP/ICMP traffic by using raw socket. ') +
			_('It helps bypass UDP blocking/QoS and unstable UDP environment. ') +
			'<br/><strong>' + _('Use Case:') + '</strong> ' +
			_('Wrap WireGuard/OpenVPN UDP traffic into FakeTCP to bypass firewalls.'));

		// === 运行状态 ===
		s = m.section(form.NamedSection, '_status', '', _('Service Status'));
		
		var running = false;
		if (serviceStatus && serviceStatus.udp2raw && serviceStatus.udp2raw.instances) {
			var instances = serviceStatus.udp2raw.instances;
			running = Object.keys(instances).some(function(key) {
				return instances[key].running;
			});
		}

		o = s.option(form.DummyValue, '_status');
		o.cfgvalue = function() {
			return running 
				? '<span style="color:green; font-weight:bold">● ' + _('RUNNING') + '</span>'
				: '<span style="color:red; font-weight:bold">● ' + _('STOPPED') + '</span>';
		};
		o.rawhtml = true;

		// === 常规设置 ===
		s = m.section(form.TypedSection, 'general', _('General Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'daemon_user', _('Run As User'));
		o.value('root', 'root');
		o.value('nobody', 'nobody');
		o.default = 'root';

		// === 隧道配置（单一表格，原版架构） ===
		s = m.section(form.GridSection, 'tunnel', _('Tunnel Configuration'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = function(section_id) {
			var alias = uci.get('udp2raw', section_id, 'alias');
			return alias ? _('Edit Tunnel: ') + alias : _('New Tunnel');
		};

		// 表格列
		o = s.option(form.Value, 'alias', _('Alias'));
		o.optional = true;
		o.placeholder = 'WireGuard Tunnel';
		o.editable = true;

		o = s.option(form.ListValue, 'mode', _('Mode'));
		o.value('client', _('Client'));
		o.value('server', _('Server'));
		o.default = 'client';
		o.editable = true;

		o = s.option(form.Value, 'local_addr', _('Local Address'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';
		o.editable = true;

		o = s.option(form.Value, 'local_port', _('Local Port'));
		o.datatype = 'port';
		o.placeholder = '3333';
		o.editable = true;

		o = s.option(form.Value, 'remote_addr', _('Remote Address'));
		o.datatype = 'host';
		o.placeholder = 'server.example.com';
		o.editable = true;

		o = s.option(form.Value, 'remote_port', _('Remote Port'));
		o.datatype = 'port';
		o.placeholder = '4096';
		o.editable = true;

		o = s.option(form.ListValue, 'raw_mode', _('Raw Mode'));
		o.value('faketcp', 'FakeTCP');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');
		o.value('easy-faketcp', 'Easy-FakeTCP');
		o.default = 'faketcp';
		o.editable = true;

		o = s.option(form.ListValue, 'cipher_mode', _('Cipher'));
		o.value('aes128cbc', 'AES-128-CBC');
		o.value('aes128cfb', 'AES-128-CFB');
		o.value('xor', 'XOR');
		o.value('none', 'None');
		o.default = 'aes128cbc';
		o.editable = true;

		o = s.option(form.ListValue, 'auth_mode', _('Auth'));
		o.value('hmac_sha1', 'HMAC-SHA1');
		o.value('md5', 'MD5');
		o.value('crc32', 'CRC32');
		o.value('simple', 'Simple');
		o.value('none', 'None');
		o.default = 'md5';
		o.modalonly = true;

		// === 模态框详细设置 ===
		
		// 密钥
		o = s.option(form.Value, 'key', _('Password'));
		o.password = true;
		o.placeholder = 'secret key';
		o.description = _('Password to generate symmetric encryption key');
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (!value || value.length < 6) {
				return _('Password must be at least 6 characters');
			}
			return true;
		};

		// === iptables 规则 ===
		o = s.option(form.SectionValue, '_firewall', form.NamedSection, '', '', _('Firewall Rules'));
		o.modalonly = true;

		var ss = o.subsection;
		ss.option(form.Flag, 'auto_rule', _('Auto iptables Rule'),
			_('Automatically add/delete iptables rules on start/stop. Required for FakeTCP mode.'))
			.default = '1';

		ss.option(form.Flag, 'keep_rule', _('Keep iptables Rule'),
			_('Monitor and auto re-add iptables rules if they are cleared by other programs.'))
			.default = '0';

		// === 高级选项 ===
		o = s.option(form.SectionValue, '_advanced', form.NamedSection, '', '', _('Advanced Options'));
		o.modalonly = true;

		ss = o.subsection;

		o = ss.option(form.ListValue, 'seq_mode', _('SEQ Mode'));
		o.value('0', '0 - Static (no SEQ increase)');
		o.value('1', '1 - SEQ for every packet');
		o.value('2', '2 - SEQ randomly (~3 packets)');
		o.value('3', '3 - Simulate real TCP (recommended)');
		o.value('4', '4 - Real TCP without Window Scale');
		o.default = '3';
		o.description = _('Controls FakeTCP SEQ/ACK behavior. Change if experiencing connection issues.');

		o = ss.option(form.Value, 'lower_level', _('Lower Level'));
		o.placeholder = 'auto or eth0#00:11:22:33:44:55';
		o.description = _('Send packets at OSI Layer 2. Format: interface#mac_address. Try "auto" first.');

		o = ss.option(form.Value, 'source_ip', _('Source IP'));
		o.datatype = 'ipaddr';
		o.placeholder = '192.168.1.100';
		o.description = _('Force source IP for raw socket');

		o = ss.option(form.Value, 'source_port', _('Source Port'));
		o.datatype = 'port';
		o.description = _('Force source port for raw socket (disables port changing on reconnect)');

		o = ss.option(form.ListValue, 'log_level', _('Log Level'));
		o.value('0', '0 - Never');
		o.value('1', '1 - Fatal');
		o.value('2', '2 - Error');
		o.value('3', '3 - Warn');
		o.value('4', '4 - Info (default)');
		o.value('5', '5 - Debug');
		o.value('6', '6 - Trace');
		o.default = '4';

		o = ss.option(form.Value, 'extra_options', _('Extra Options'));
		o.placeholder = '--dev eth0 --sock-buf 2048';
		o.description = _('Additional command-line options. See udp2raw --help for details.');

		return m.render();
	},

	addFooter: function() {
		return E('div', { 'class': 'cbi-page-actions' }, [
			E('p', {}, [
				E('strong', {}, _('Documentation:')),
				' ',
				E('a', { 
					'href': 'https://github.com/wangyu-/udp2raw',
					'target': '_blank'
				}, _('udp2raw GitHub')),
				' | ',
				E('a', {
					'href': 'https://github.com/sensec/luci-app-udp2raw/wiki',
					'target': '_blank'
				}, _('LuCI App Wiki'))
			])
		]);
	}
});
