/**
 * Copyright (C) 2026 iHub-2020
 * 
 * LuCI Phantun Manager - Status Page
 * Real-time status monitoring for Phantun instances
 * 
 * @module luci-app-phantun/status
 * @version 1.0.0
 * @date 2026-01-31
 */

'use strict';
'require view';
'require fs';
'require ui';
'require poll';
'require rpc';

var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

return view.extend({
    title: _('Phantun Status'),

    load: function () {
        return Promise.all([
            L.resolveDefault(callServiceList('phantun'), {}),
            L.resolveDefault(fs.exec_direct('/bin/sh', ['-c', 'pgrep -a phantun_client phantun_server || true']), ''),
            L.resolveDefault(fs.exec_direct('/bin/sh', ['-c', 'ip addr show | grep tun || true']), ''),
            L.resolveDefault(fs.exec_direct('/bin/sh', ['-c', 'iptables -t nat -L -n -v | grep -E "MASQUERADE|DNAT.*phantun|192\\.168\\.20[01]\\." || true']), ''),
            L.resolveDefault(fs.exec_direct('/bin/sh', ['-c', 'ip6tables -t nat -L -n -v | grep -E "MASQUERADE|DNAT.*phantun|fcc[89]:" || true']), '')
        ]);
    },

    render: function (data) {
        var serviceStatus = data[0];
        var processes = data[1].trim();
        var tunInterfaces = data[2].trim();
        var iptablesRules = data[3].trim();
        var ip6tablesRules = data[4].trim();

        // Parse service status
        var instances = [];
        var runningCount = 0;

        try {
            if (serviceStatus && serviceStatus.phantun && serviceStatus.phantun.instances) {
                var svcInstances = serviceStatus.phantun.instances;
                for (var key in svcInstances) {
                    var inst = svcInstances[key];
                    instances.push({
                        name: key,
                        running: inst.running || false,
                        command: inst.command || []
                    });
                    if (inst.running) runningCount++;
                }
            }
        } catch (e) {
            console.error('Error parsing service status:', e);
        }

        var isRunning = runningCount > 0;
        var statusColor = isRunning ? '#5cb85c' : '#d9534f';
        var statusText = isRunning
            ? _('Running') + ' (' + runningCount + ' ' + _('instances') + ')'
            : _('Stopped');

        var view = E('div', { 'class': 'cbi-map' }, [
            E('h2', {}, _('Phantun Status')),
            E('div', { 'class': 'cbi-map-descr' }, _('Real-time monitoring of Phantun service instances and network configuration')),

            // Service Status Section
            E('div', { 'class': 'cbi-section' }, [
                E('h3', {}, _('Service Status')),
                E('div', { 'style': 'padding: 10px; background: #2d3a4a; border-radius: 5px; margin-bottom: 20px;' }, [
                    E('table', { 'style': 'width: 100%;' }, [
                        E('tr', {}, [
                            E('td', { 'style': 'font-weight: bold; width: 200px;' }, _('Overall Status:')),
                            E('td', {}, E('span', {
                                'style': 'color: ' + statusColor + '; font-weight: bold; font-size: 16px;'
                            }, statusText))
                        ]),
                        E('tr', {}, [
                            E('td', { 'style': 'font-weight: bold;' }, _('Active Instances:')),
                            E('td', {}, String(runningCount))
                        ])
                    ])
                ])
            ]),

            // Running Instances Section
            E('div', { 'class': 'cbi-section' }, [
                E('h3', {}, _('Running Instances')),
                instances.length > 0
                    ? E('table', { 'class': 'table' }, [
                        E('tr', { 'class': 'tr table-titles' }, [
                            E('th', { 'class': 'th' }, _('Instance Name')),
                            E('th', { 'class': 'th' }, _('Status')),
                            E('th', { 'class': 'th' }, _('Type')),
                            E('th', { 'class': 'th' }, _('Command'))
                        ]),
                        instances.map(function (inst) {
                            var cmdStr = inst.command.join(' ');
                            var type = cmdStr.indexOf('phantun_client') >= 0 ? 'Client' :
                                cmdStr.indexOf('phantun_server') >= 0 ? 'Server' : 'Unknown';
                            var statusBadge = inst.running
                                ? E('span', { 'style': 'color: #5cb85c; font-weight: bold;' }, '● ' + _('Running'))
                                : E('span', { 'style': 'color: #d9534f; font-weight: bold;' }, '○ ' + _('Stopped'));

                            return E('tr', { 'class': 'tr' }, [
                                E('td', { 'class': 'td', 'style': 'font-weight: bold;' }, inst.name),
                                E('td', { 'class': 'td' }, statusBadge),
                                E('td', { 'class': 'td' }, type),
                                E('td', { 'class': 'td', 'style': 'font-family: monospace; font-size: 11px;' },
                                    cmdStr.length > 80 ? cmdStr.substring(0, 80) + '...' : cmdStr)
                            ]);
                        })
                    ])
                    : E('div', { 'class': 'cbi-value' }, E('em', {}, _('No instances configured or running')))
            ]),

            // Process List Section
            E('div', { 'class': 'cbi-section' }, [
                E('h3', {}, _('Process List')),
                processes
                    ? E('pre', {
                        'style': 'background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto;'
                    }, processes)
                    : E('div', { 'class': 'cbi-value' }, E('em', {}, _('No phantun processes running')))
            ]),

            // TUN Interfaces Section
            E('div', { 'class': 'cbi-section' }, [
                E('h3', {}, _('TUN Interfaces')),
                tunInterfaces
                    ? E('pre', {
                        'style': 'background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto;'
                    }, tunInterfaces)
                    : E('div', { 'class': 'cbi-value' }, E('em', {}, _('No TUN interfaces found')))
            ]),

            // iptables Rules Section (IPv4)
            E('div', { 'class': 'cbi-section' }, [
                E('h3', {}, _('IPv4 NAT Rules (iptables)')),
                E('div', { 'style': 'margin-bottom: 10px;' }, [
                    E('p', {}, [
                        E('strong', {}, _('Expected Rules:')),
                        E('br'),
                        _('Client: MASQUERADE for 192.168.200.0/24'),
                        E('br'),
                        _('Server: DNAT to 192.168.201.2')
                    ])
                ]),
                iptablesRules
                    ? E('pre', {
                        'style': 'background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto;'
                    }, iptablesRules)
                    : E('div', { 'class': 'cbi-value' }, E('em', {}, _('No iptables NAT rules found for Phantun')))
            ]),

            // ip6tables Rules Section (IPv6)
            E('div', { 'class': 'cbi-section' }, [
                E('h3', {}, _('IPv6 NAT Rules (ip6tables)')),
                E('div', { 'style': 'margin-bottom: 10px;' }, [
                    E('p', {}, [
                        E('strong', {}, _('Expected Rules:')),
                        E('br'),
                        _('Client: MASQUERADE for fcc8::/64'),
                        E('br'),
                        _('Server: DNAT to fcc9::2')
                    ])
                ]),
                ip6tablesRules
                    ? E('pre', {
                        'style': 'background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto;'
                    }, ip6tablesRules)
                    : E('div', { 'class': 'cbi-value' }, E('em', {}, _('No ip6tables NAT rules found for Phantun')))
            ])
        ]);

        // Set up polling for auto-refresh every 3 seconds
        poll.add(L.bind(function () {
            this.load().then(L.bind(function (refreshData) {
                var newContent = this.render(refreshData);
                var container = document.querySelector('.cbi-map');
                if (container) {
                    container.parentNode.replaceChild(newContent, container);
                }
            }, this));
        }, this), 3);

        return view;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
