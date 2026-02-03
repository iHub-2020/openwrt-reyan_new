/**
 * Copyright (C) 2026 iHub-2020
 * 
 * LuCI Phantun Manager - Status Page
 * Displays real-time tunnel status, connection info, and detailed diagnostics
 * 
 * @module luci-app-phantun/status
 * @version 1.1.0
 * @date 2026-02-03
 */

'use strict';
'require view';
'require fs';
'require ui';
'require uci';
'require rpc';
'require poll';

var lastClearTime = null;
var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

return view.extend({
    title: _('TCP Tunnel Status'),

    pollInterval: 3, // Faster polling for logs
    logPollFn: null,

    cleanText: function (str) {
        if (!str) return '';
        return String(str).replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();
    },

    getLogColor: function (line) {
        var lowerLine = line.toLowerCase();
        if (lowerLine.indexOf('err') !== -1 || lowerLine.indexOf('error') !== -1 ||
            lowerLine.indexOf('fail') !== -1 || lowerLine.indexOf('panic') !== -1) {
            return 'var(--accent-error)';
        }
        if (lowerLine.indexOf('warn') !== -1 || lowerLine.indexOf('warning') !== -1) {
            return 'var(--accent-warning)';
        }
        if (lowerLine.indexOf('connection') !== -1 || lowerLine.indexOf('connected') !== -1) {
            return 'var(--accent-success)';
        }
        return 'var(--text-secondary)';
    },

    getServiceStatus: function () {
        return Promise.all([
            L.resolveDefault(callServiceList('phantun'), {}),
            L.resolveDefault(fs.exec('/bin/sh', ['-c', 'pgrep -f \"phantun_server|phantun_client\"']), {})
        ]).then(function (results) {
            var serviceList = results[0];
            var psOutput = results[1];

            var instances = {};
            var isRunning = false;

            // Check service list first
            if (serviceList && serviceList.phantun && serviceList.phantun.instances) {
                for (var key in serviceList.phantun.instances) {
                    var inst = serviceList.phantun.instances[key];
                    if (inst && inst.running) {
                        isRunning = true;
                        instances[key] = {
                            pid: inst.pid,
                            command: Array.isArray(inst.command) ? inst.command.join(' ') : ''
                        };
                    }
                }
            }

            // Fallback: check if processes exist
            if (!isRunning && psOutput && psOutput.code === 0 && psOutput.stdout && psOutput.stdout.trim()) {
                isRunning = true;
            }

            return { running: isRunning, instances: instances };
        });
    },

    getTunnelConfigs: function () {
        return uci.load('phantun').then(function () {
            var tunnels = [];
            var sections = uci.sections('phantun');

            sections.forEach(function (s) {
                if (s['.type'] === 'general') return;

                var mode = s['.type']; // 'client' or 'server'
                var localStr = '?';
                var remoteStr = '?';

                if (mode === 'server') {
                    var listenPort = s.local_port || '4567';
                    var target = s.remote_addr || '127.0.0.1';
                    var targetPort = s.remote_port || '51820';
                    localStr = '0.0.0.0:' + listenPort + ' (TCP)';
                    remoteStr = target + ':' + targetPort + ' (UDP)';
                } else {
                    var localIP = s.local_addr || '127.0.0.1';
                    var localPort = s.local_port || '51820';
                    var serverIP = s.remote_addr || '?';
                    var serverPort = s.remote_port || '?';
                    localStr = localIP + ':' + localPort + ' (UDP)';
                    remoteStr = serverIP + ':' + serverPort + ' (TCP)';
                }

                tunnels.push({
                    id: s['.name'],
                    alias: s.alias || s['.name'],
                    mode: mode,
                    disabled: s.enabled === '0',
                    local: localStr,
                    remote: remoteStr,
                    tun_local: s.tun_local || (mode === 'server' ? '192.168.201.1' : '192.168.200.1'),
                    tun_peer: s.tun_peer || (mode === 'server' ? '192.168.201.2' : '192.168.200.2')
                });
            });
            return tunnels;
        });
    },

    getRecentLogs: function () {
        var self = this;
        return uci.load('phantun').then(function () {
            return fs.exec('/sbin/logread', ['-e', 'phantun']).then(function (res) {
                var output = res.stdout || '';
                if (!output && res.code !== 0) {
                    return fs.exec('/bin/sh', ['-c', 'logread | grep phantun | tail -n 150']);
                }
                return res;
            }).then(function (res) {
                var logContent = res.stdout || '';
                if (!logContent) return [];
                var lines = logContent.trim().split('\n');

                if (lastClearTime) {
                    lines = lines.filter(function (line) {
                        var logTime = self.parseLogTime(line);
                        return logTime && logTime > lastClearTime;
                    });
                    // Add clear marker
                    lines.unshift('=== Logs Cleared (' + lastClearTime.toLocaleTimeString() + ') ===');
                }

                return lines.slice(-150).map(self.cleanText).reverse();
            });
        });
    },

    parseLogTime: function (line) {
        var match = line.match(/(\w{3})\s+(\w{3})\s+(\d+)\s+(\d+):(\d+):(\d+)\s+(\d{4})/);
        if (!match) return null;
        var months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
        return new Date(parseInt(match[7]), months[match[2]], parseInt(match[3]), parseInt(match[4]), parseInt(match[5]), parseInt(match[6]));
    },

    // Diagnostics checks reused from previous version with improvements
    getMD5: function () {
        return fs.exec('/bin/sh', ['-c', 'md5sum /usr/bin/phantun_client /usr/bin/phantun_server 2>/dev/null || echo "NOTFOUND"'])
            .then(function (res) {
                var output = (res.stdout || '').trim();
                if (output.indexOf('NOTFOUND') === 0) throw new Error('Binary not found');
                var lines = output.split('\n');
                var md5s = {};
                lines.forEach(function (line) {
                    var match = line.match(/^([a-f0-9]{32})\s+.*\/(phantun_\w+)$/i);
                    if (match) md5s[match[2]] = match[1].substring(0, 16) + '...';
                });
                return md5s;
            }).catch(function (err) { return { error: err.message || 'Unknown error' }; });
    },

    checkIptablesRules: function () {
        return Promise.all([
            L.resolveDefault(fs.exec('/usr/sbin/iptables-save'), {}),
            L.resolveDefault(fs.exec('/usr/sbin/ip6tables-save'), {})
        ]).then(function (results) {
            var ipv4Output = (results[0] && results[0].stdout) || '';
            var lines = ipv4Output.split('\n');
            var activeRules = false;
            var ruleTypes = [];

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.indexOf('phantun') !== -1 || /192\. ?168\. ?20[01]/.test(line)) {
                    activeRules = true;
                    if (line.indexOf('MASQUERADE') !== -1 && ruleTypes.indexOf('MASQUERADE') === -1) ruleTypes.push('MASQUERADE');
                    if (line.indexOf('DNAT') !== -1 && ruleTypes.indexOf('DNAT') === -1) ruleTypes.push('DNAT');
                }
            }

            return {
                text: activeRules ? (ruleTypes.length > 0 ? _('Active') + ' (' + ruleTypes.join(', ') + ')' : _('Active')) : _('No rules detected'),
                color: activeRules ? 'var(--accent-success)' : 'var(--accent-warning)',
                ipv4: ipv4Output.split('\n').filter(function (l) { return l.indexOf('phantun') !== -1 || /192\.168\.20[01]/.test(l); })
            };
        }).catch(function () { return { text: _('Check failed'), color: 'var(--accent-error)', ipv4: [] }; });
    },

    checkTunInterfaces: function () {
        return fs.exec('/sbin/ip', ['addr', 'show']).then(function (res) {
            var output = res.stdout || '';
            var lines = output.split('\n');
            var tunInterfaces = [];
            var currentIface = null;
            lines.forEach(function (line) {
                var ifaceMatch = line.match(/^\d+:\s+(tun\d+):/);
                if (ifaceMatch) {
                    currentIface = { name: ifaceMatch[1], state: line.indexOf('UP') !== -1 ? 'UP' : 'DOWN', ipv4: [], ipv6: [] };
                    tunInterfaces.push(currentIface);
                }
                if (currentIface) {
                    var ipv4Match = line.match(/inet\s+([\d.]+\/\d+)/);
                    if (ipv4Match) currentIface.ipv4.push(ipv4Match[1]);
                    var ipv6Match = line.match(/inet6\s+([a-f0-9:]+\/\d+)/i);
                    if (ipv6Match) currentIface.ipv6.push(ipv6Match[1]);
                }
            });
            return tunInterfaces.length > 0 ? tunInterfaces : null;
        }).catch(function () { return null; });
    },

    load: function () {
        var self = this;
        return Promise.all([
            self.getServiceStatus(),
            self.getTunnelConfigs(),
            self.getRecentLogs(),
            self.getMD5(),
            self.checkIptablesRules(),
            self.checkTunInterfaces()
        ]);
    },

    render: function (data) {
        var self = this;
        ui.addNotification(null, E('link', { 'rel': 'stylesheet', 'href': L.resource('phantun/style.css') }));

        var serviceStatus = data[0];
        var tunnels = data[1];
        var logs = data[2];
        var md5s = data[3];
        var iptablesRules = data[4];
        var tunInterfaces = data[5];

        var container = E('div', { 'class': 'cbi-map', 'id': 'phantun-status-view' }, [
            E('h2', {}, _('System Status')),

            // ==================== Safety Information (Moved from Config) ====================
            E('div', { 'class': 'safety-card' }, [
                E('div', { 'class': 'safety-title' }, [
                    E('span', {}, '⚠️'),
                    E('span', {}, _('Important Safety Information'))
                ]),
                E('ul', {}, [
                    E('li', {}, _('Phantun creates TUN interfaces and uses FakeTCP to obfuscate UDP traffic.')),
                    E('li', {}, _('Client mode requires MASQUERADE iptables rules (automatically added).')),
                    E('li', {}, _('Server mode requires DNAT iptables rules (automatically added).')),
                    E('li', {}, _('No encryption - Phantun focuses on pure obfuscation for maximum performance.')),
                    E('li', {}, _('MTU overhead is only 12 bytes (TCP header - UDP header).'))
                ])
            ]),

            // ==================== Diagnostics Grid ====================
            E('div', { 'class': 'cbi-section', 'style': 'margin-bottom: 20px;' }, [
                E('h3', {}, _('System Diagnostics')),
                E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;' }, [

                    // Column 1: Core Biaries
                    E('div', { 'class': 'phantun-card', 'style': 'margin: 0;' }, [
                        E('h4', { 'style': 'margin-top: 0; color: var(--text-secondary); border-bottom: 1px solid var(--border); padding-bottom: 8px;' }, _('Core Components')),
                        E('div', { 'style': 'margin-top: 10px;' }, [
                            E('div', { 'style': 'display: flex; justify-content: space-between; margin-bottom: 5px;' }, [
                                E('span', {}, 'Client Binary:'),
                                md5s.phantun_client ? E('span', { 'style': 'color: var(--accent-success);' }, '✓ Present')
                                    : E('span', { 'style': 'color: var(--accent-error);' }, '✗ Missing')
                            ]),
                            E('div', { 'style': 'display: flex; justify-content: space-between;' }, [
                                E('span', {}, 'Server Binary:'),
                                md5s.phantun_server ? E('span', { 'style': 'color: var(--accent-success);' }, '✓ Present')
                                    : E('span', { 'style': 'color: var(--accent-error);' }, '✗ Missing')
                            ])
                        ])
                    ]),

                    // Column 2: Interfaces
                    E('div', { 'class': 'phantun-card', 'style': 'margin: 0;' }, [
                        E('h4', { 'style': 'margin-top: 0; color: var(--text-secondary); border-bottom: 1px solid var(--border); padding-bottom: 8px;' }, _('Network Interfaces')),
                        E('div', { 'style': 'margin-top: 10px;' }, tunInterfaces && tunInterfaces.length > 0 ?
                            tunInterfaces.map(function (iface) {
                                return E('div', { 'style': 'margin-bottom: 8px;' }, [
                                    E('div', { 'style': 'display: flex; justify-content: space-between;' }, [
                                        E('span', { 'style': 'font-weight: bold;' }, iface.name),
                                        E('span', { 'style': 'color: ' + (iface.state === 'UP' ? 'var(--accent-success)' : 'var(--accent-error)') }, iface.state)
                                    ]),
                                    E('div', { 'style': 'font-size: 0.85em; color: var(--text-secondary);' }, iface.ipv4.join(', '))
                                ]);
                            }) : E('div', { 'style': 'color: var(--text-secondary); font-style: italic;' }, _('No active TUN interfaces'))
                        )
                    ]),

                    // Column 3: Firewall
                    E('div', { 'class': 'phantun-card', 'style': 'margin: 0;' }, [
                        E('h4', { 'style': 'margin-top: 0; color: var(--text-secondary); border-bottom: 1px solid var(--border); padding-bottom: 8px;' }, _('Firewall Status')),
                        E('div', { 'style': 'margin-top: 10px;' }, [
                            E('div', { 'style': 'margin-bottom: 5px;' }, [
                                E('strong', {}, _('Rules Detected: ')),
                                E('span', { 'style': 'color: ' + iptablesRules.color }, iptablesRules.text)
                            ])
                        ])
                    ])
                ])
            ]),

            // ==================== Tunnels Table ====================
            E('div', { 'class': 'cbi-section phantun-card' }, [
                E('h3', {}, _('Active Tunnels')),
                E('table', { 'class': 'table phantun-table', 'style': 'width: 100%;' }, [
                    E('thead', {}, E('tr', {}, [
                        E('th', {}, _('Name')),
                        E('th', {}, _('Mode')),
                        E('th', {}, _('Status')),
                        E('th', {}, _('Local')),
                        E('th', {}, _('Remote')),
                        E('th', {}, _('TUN IP')),
                        E('th', {}, _('PID'))
                    ])),
                    E('tbody', {}, tunnels.length > 0 ? tunnels.map(function (t) {
                        var instanceKey = t.mode + '_' + t.id;
                        var instance = serviceStatus.instances[instanceKey];
                        var isActive = instance && instance.pid;
                        var statusClass = t.disabled ? 'stopped' : (isActive ? 'running' : 'stopped');
                        var statusLabel = t.disabled ? _('Disabled') : (isActive ? _('Running') : _('Stopped'));

                        return E('tr', {}, [
                            E('td', {}, t.alias),
                            E('td', {}, t.mode === 'server' ? _('Server') : _('Client')),
                            E('td', {}, [
                                E('span', { 'class': 'status-dot ' + statusClass, 'style': 'margin-right: 8px;' }),
                                statusLabel
                            ]),
                            E('td', {}, t.local),
                            E('td', {}, t.remote),
                            E('td', {}, t.tun_local),
                            E('td', {}, isActive ? String(instance.pid) : '-')
                        ]);
                    }) : [
                        E('tr', {}, E('td', { 'colspan': '7', 'style': 'text-align: center; color: var(--text-secondary); padding: 20px;' }, _('No tunnels configured')))
                    ])
                ])
            ]),

            // ==================== System Logs ====================
            E('div', { 'class': 'cbi-section' }, [
                E('h3', { 'style': 'display:flex; justify-content:space-between; align-items:center;' }, [
                    _('System Logs'),
                    E('span', { 'id': 'log-status', 'style': 'font-size: 0.85em; font-weight: normal; color: var(--text-secondary);' }, '')
                ]),
                E('div', { 'class': 'console-window', 'id': 'syslog-container' }, logs.map(function (line) {
                    var color = self.getLogColor(line);
                    return E('div', { 'style': 'color: ' + color + ';' }, line);
                })),

                // Log Controls
                E('div', { 'style': 'margin-top: 10px; display: flex; gap: 10px; justify-content: flex-end;' }, [
                    // Start/Stop
                    E('button', {
                        'class': 'cbi-button cbi-button-neutral',
                        'click': function (ev) {
                            var btn = ev.target;
                            if (self.logPollFn) {
                                poll.remove(self.logPollFn);
                                self.logPollFn = null;
                                btn.textContent = _('Resume Auto-Refresh');
                                btn.classList.add('cbi-button-positive');
                                btn.classList.remove('cbi-button-neutral');
                                document.getElementById('log-status').textContent = 'paused';
                            } else {
                                self.logPollFn = L.bind(self.pollLogs, self);
                                poll.add(self.logPollFn, self.pollInterval);
                                btn.textContent = _('Pause Auto-Refresh');
                                btn.classList.add('cbi-button-neutral');
                                btn.classList.remove('cbi-button-positive');
                                self.pollLogs();
                            }
                        }
                    }, _('Pause Auto-Refresh')),

                    // Clear
                    E('button', {
                        'class': 'cbi-button cbi-button-reset',
                        'click': function () {
                            lastClearTime = new Date();
                            self.pollLogs();
                        }
                    }, _('Clear View')),

                    // Download
                    E('button', {
                        'class': 'cbi-button cbi-button-apply',
                        'click': function () {
                            var container = document.getElementById('syslog-container');
                            var blob = new Blob([container ? container.textContent : ''], { type: 'text/plain' });
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = url;
                            a.download = 'phantun_logs.txt';
                            a.click();
                            URL.revokeObjectURL(url);
                        }
                    }, _('Download Logs'))
                ])
            ])
        ]);

        requestAnimationFrame(function () {
            // Initialize log polling
            if (!self.logPollFn) {
                self.logPollFn = L.bind(self.pollLogs, self);
                poll.add(self.logPollFn, self.pollInterval);
            }
        });

        return container;
    },

    pollLogs: function () {
        var self = this;
        return self.getRecentLogs().then(function (logs) {
            var container = document.getElementById('syslog-container');
            if (container) {
                container.innerHTML = '';
                logs.forEach(function (line) {
                    var color = self.getLogColor(line);
                    var div = document.createElement('div');
                    div.style.color = color;
                    div.textContent = line;
                    container.appendChild(div);
                });
                container.scrollTop = container.scrollHeight;
            }
            var logStatusEl = document.getElementById('log-status');
            if (logStatusEl) logStatusEl.textContent = 'Live • ' + new Date().toLocaleTimeString();
        });
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
