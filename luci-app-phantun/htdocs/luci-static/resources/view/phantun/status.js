/**
 * Copyright (C) 2026 iHub-2020
 * 
 * LuCI Phantun Manager - Status Page
 * Displays real-time tunnel status, connection info, and diagnostics
 * 
 * @module luci-app-phantun/status
 * @version 1.0.0
 * @date 2026-01-31
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
    title: _('Phantun Status'),

    pollInterval: 5,
    logPollFn: null,

    cleanText: function (str) {
        if (!str) return '';
        return String(str).replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();
    },

    getServiceStatus: function () {
        return L.resolveDefault(callServiceList('phantun'), {}).then(function (res) {
            var instances = {};
            var isRunning = false;

            if (res && res.phantun && res.phantun.instances) {
                for (var key in res.phantun.instances) {
                    var inst = res.phantun.instances[key];
                    if (inst && inst.running) {
                        isRunning = true;
                        instances[key] = {
                            pid: inst.pid,
                            command: Array.isArray(inst.command) ? inst.command.join(' ') : ''
                        };
                    }
                }
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

            // 如果点击过清理，只显示之后的日志
            if (lastClearTime) {
                lines = lines.filter(function (line) {
                    var match = line.match(/(\w{3}\s+\w{3}\s+\d+\s+\d+:\d+:\d+\s+\d{4})/);
                    if (match) {
                        var logTime = new Date(match[1]);
                        return logTime > lastClearTime;
                    }
                    return false;
                });

                // 在过滤后的日志开头添加高亮的清理标记
                var clearMarker = '=== 日志已清理 (' + lastClearTime.toLocaleString() + ') ===';
                lines.unshift(clearMarker);
            }

            return lines.slice(-150).map(self.cleanText).reverse();
        });
    },

    /**
     * 计算二进制文件的MD5值
     */
    getMD5: function () {
        return fs.exec('/bin/sh', ['-c', 'md5sum /usr/bin/phantun_client /usr/bin/phantun_server 2>/dev/null || echo "NOTFOUND"'])
            .then(function (res) {
                var output = (res.stdout || '').trim();

                if (output.indexOf('NOTFOUND') === 0) {
                    throw new Error('Binary not found');
                }

                var lines = output.split('\n');
                var md5s = {};
                lines.forEach(function (line) {
                    var match = line.match(/^([a-f0-9]{32})\s+.*\/(phantun_\w+)$/i);
                    if (match && match[1] && match[2]) {
                        md5s[match[2]] = match[1].substring(0, 16) + '...';
                    }
                });

                return md5s;
            })
            .catch(function (err) {
                return { error: err.message || 'Unknown error' };
            });
    },

    /**
     * 检查 iptables 规则
     */
    checkIptablesRules: function () {
        return Promise.all([
            fs.exec('/usr/sbin/iptables', ['-t', 'nat', '-L', '-n', '-v']),
            fs.exec('/usr/sbin/ip6tables', ['-t', 'nat', '-L', '-n', '-v'])
        ]).then(function (results) {
            var ipv4Output = results[0].stdout || '';
            var ipv6Output = results[1].stdout || '';

            var ipv4Rules = ipv4Output.split('\n').filter(function (line) {
                return line.indexOf('phantun') !== -1 ||
                    line.indexOf('192.168.200') !== -1 ||
                    line.indexOf('192.168.201') !== -1;
            });

            var ipv6Rules = ipv6Output.split('\n').filter(function (line) {
                return line.indexOf('phantun') !== -1 ||
                    line.indexOf('fcc8') !== -1 ||
                    line.indexOf('fcc9') !== -1;
            });

            return {
                ipv4: ipv4Rules.length > 0 ? ipv4Rules : ['No Phantun-related rules found'],
                ipv6: ipv6Rules.length > 0 ? ipv6Rules : ['No Phantun-related rules found']
            };
        }).catch(function (err) {
            return {
                ipv4: ['Error: ' + (err.message || 'Failed to check iptables')],
                ipv6: ['Error: ' + (err.message || 'Failed to check ip6tables')]
            };
        });
    },

    /**
     * 检查 TUN 接口
     */
    checkTunInterfaces: function () {
        return fs.exec('/sbin/ip', ['addr', 'show']).then(function (res) {
            var output = res.stdout || '';
            var lines = output.split('\n');
            var tunInterfaces = [];
            var currentIface = null;

            lines.forEach(function (line) {
                // 匹配接口名称行
                var ifaceMatch = line.match(/^\d+:\s+(tun\d+):/);
                if (ifaceMatch) {
                    currentIface = {
                        name: ifaceMatch[1],
                        state: line.indexOf('UP') !== -1 ? 'UP' : 'DOWN',
                        ipv4: [],
                        ipv6: []
                    };
                    tunInterfaces.push(currentIface);
                }

                // 匹配 IPv4 地址
                if (currentIface) {
                    var ipv4Match = line.match(/inet\s+([\d.]+\/\d+)/);
                    if (ipv4Match) {
                        currentIface.ipv4.push(ipv4Match[1]);
                    }

                    // 匹配 IPv6 地址
                    var ipv6Match = line.match(/inet6\s+([a-f0-9:]+\/\d+)/i);
                    if (ipv6Match) {
                        currentIface.ipv6.push(ipv6Match[1]);
                    }
                }
            });

            return tunInterfaces.length > 0 ? tunInterfaces : null;
        }).catch(function (err) {
            return null;
        });
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
        var serviceStatus = data[0];
        var tunnels = data[1];
        var logs = data[2];
        var md5s = data[3];
        var iptablesRules = data[4];
        var tunInterfaces = data[5];

        var statusColor = serviceStatus.running ? '#5cb85c' : '#d9534f';
        var statusText = serviceStatus.running ? _('运行中') : _('已停止');
        var instanceCount = Object.keys(serviceStatus.instances).length;

        var container = E('div', { 'class': 'cbi-map' }, [
            E('h2', {}, _('Phantun 状态')),

            // ==================== 服务状态 (简洁版) ====================
            E('div', { 'class': 'cbi-section' }, [
                E('div', { 'style': 'display: flex; align-items: center; padding: 10px 0;' }, [
                    E('div', { 'style': 'width: 150px; font-weight: bold;' }, _('服务状态:')),
                    E('div', { 'style': 'font-weight: bold; color: ' + statusColor + ';' },
                        statusText + (instanceCount > 0 ? ' (' + instanceCount + ' 实例)' : ''))
                ])
            ]),

            // ==================== 隧道状态表 ====================
            E('div', { 'class': 'cbi-section', 'style': 'margin-top: 20px;' }, [
                E('h3', {}, _('隧道状态')),
                E('table', { 'class': 'table cbi-section-table' }, [
                    E('tr', { 'class': 'tr table-titles' }, [
                        E('th', { 'class': 'th' }, _('名称')),
                        E('th', { 'class': 'th' }, _('模式')),
                        E('th', { 'class': 'th' }, _('状态')),
                        E('th', { 'class': 'th' }, _('本地')),
                        E('th', { 'class': 'th' }, _('远程')),
                        E('th', { 'class': 'th' }, _('TUN 地址')),
                        E('th', { 'class': 'th' }, _('PID'))
                    ]),
                    tunnels.length > 0 ? tunnels.map(function (t) {
                        var instanceKey = t.mode + '.' + t.id;
                        var instance = serviceStatus.instances[instanceKey];
                        var isActive = instance && instance.pid;
                        var rowColor = t.disabled ? '#888' : (isActive ? '#5cb85c' : '#d9534f');
                        var statusIcon = t.disabled ? '⏸' : (isActive ? '✓' : '✗');
                        var statusLabel = t.disabled ? _('已禁用') : (isActive ? _('运行中') : _('已停止'));

                        return E('tr', { 'class': 'tr' }, [
                            E('td', { 'class': 'td' }, t.alias),
                            E('td', { 'class': 'td' }, t.mode === 'server' ? _('服务器') : _('客户端')),
                            E('td', { 'class': 'td' }, E('span', { 'style': 'color: ' + rowColor + '; font-weight: bold;' }, statusIcon + ' ' + statusLabel)),
                            E('td', { 'class': 'td' }, t.local),
                            E('td', { 'class': 'td' }, t.remote),
                            E('td', { 'class': 'td' }, t.tun_local + ' ↔ ' + t.tun_peer),
                            E('td', { 'class': 'td' }, isActive ? String(instance.pid) : '-')
                        ]);
                    }) : [
                        E('tr', { 'class': 'tr' }, [
                            E('td', { 'class': 'td', 'colspan': '7', 'style': 'text-align: center; color: #888;' }, _('没有配置的隧道'))
                        ])
                    ]
                ])
            ]),

            // ==================== 系统诊断 (简洁版) ====================
            E('div', { 'class': 'cbi-section', 'style': 'margin-top: 20px;' }, [
                E('h3', {}, _('系统诊断')),
                E('div', { 'style': 'display: grid; grid-template-columns: 150px 1fr; gap: 10px; padding: 10px 0;' }, [
                    E('div', { 'style': 'font-weight: bold;' }, _('核心程序:')),
                    E('div', {}, md5s.error ?
                        E('span', { 'style': 'color: #d9534f;' }, '❌ ' + md5s.error) :
                        E('span', { 'style': 'color: #5cb85c;' }, '✓ 已验证 (' +
                            (md5s.phantun_client ? 'Client: ' + md5s.phantun_client.substring(0, 8) + '... ' : '') +
                            (md5s.phantun_server ? 'Server: ' + md5s.phantun_server.substring(0, 8) + '...' : '') + ')')
                    ),

                    E('div', { 'style': 'font-weight: bold;' }, _('TUN 接口:')),
                    E('div', {}, tunInterfaces && tunInterfaces.length > 0 ?
                        tunInterfaces.map(function (iface) {
                            var stateColor = iface.state === 'UP' ? '#5cb85c' : '#d9534f';
                            return E('div', {}, [
                                E('span', { 'style': 'color: ' + stateColor + '; font-weight: bold;' }, iface.name + ': ' + iface.state),
                                E('span', { 'style': 'margin-left: 10px; color: #888;' },
                                    (iface.ipv4.length > 0 ? iface.ipv4.join(', ') : '') +
                                    (iface.ipv6.length > 0 ? ' / ' + iface.ipv6.join(', ') : ''))
                            ]);
                        }) :
                        E('span', { 'style': 'color: #888;' }, _('无'))
                    ),

                    E('div', { 'style': 'font-weight: bold;' }, _('iptables 规则:')),
                    E('div', {},
                        E('span', { 'style': 'color: ' + (iptablesRules.ipv4.length > 1 || iptablesRules.ipv6.length > 1 ? '#5cb85c' : '#f0ad4e') + ';' },
                            (iptablesRules.ipv4.length > 1 || iptablesRules.ipv6.length > 1 ? '✓ 已激活' : '⚠ 未检测到规则'))
                    )
                ])
            ]),

            // ==================== 最近日志 ====================
            E('div', { 'class': 'cbi-section', 'style': 'margin-top: 20px;' }, [
                E('h3', { 'style': 'display:flex; justify-content:space-between; align-items:center;' }, [
                    _('最近日志'),
                    E('span', { 'id': 'log-status', 'style': 'font-size: 0.85em;' }, '')
                ]),
                E('textarea', {
                    'style': 'width: 100%; height: 500px; font-family: monospace; font-size: 12px; background: #1e1e1e; color: #ddd; border: 1px solid #444; padding: 10px; border-radius: 3px;',
                    'readonly': 'readonly',
                    'wrap': 'off',
                    'id': 'syslog-textarea'
                }, logs.join('\n')),
                E('div', { 'style': 'margin-top: 5px; text-align: right;' }, [
                    E('button', {
                        'class': 'cbi-button cbi-button-negative',
                        'id': 'log-stop-btn',
                        'click': function () {
                            if (self.logPollFn) {
                                poll.remove(self.logPollFn);
                                self.logPollFn = null;
                                var logStatusEl = document.getElementById('log-status');
                                if (logStatusEl) {
                                    logStatusEl.textContent = '⏸ ' + _('已暂停');
                                    logStatusEl.style.color = '#f0ad4e';
                                }
                            }
                        }
                    }, _('停止刷新')),
                    ' ',
                    E('button', {
                        'class': 'cbi-button cbi-button-positive',
                        'id': 'log-start-btn',
                        'click': function () {
                            if (!self.logPollFn) {
                                self.logPollFn = L.bind(self.pollLogs, self);
                                poll.add(self.logPollFn, self.pollInterval);
                                var logStatusEl = document.getElementById('log-status');
                                if (logStatusEl) {
                                    logStatusEl.textContent = '▶ ' + _('自动刷新中');
                                    logStatusEl.style.color = '#5cb85c';
                                }
                            }
                        }
                    }, _('开始刷新')),
                    ' ',
                    E('button', {
                        'class': 'cbi-button cbi-button-reset',
                        'click': function () {
                            lastClearTime = new Date();
                            self.pollLogs();
                            ui.addNotification(null, E('p', _('日志已清理,只显示此刻之后的新日志')), 'info');
                        }
                    }, _('清理日志')),
                    ' ',
                    E('button', {
                        'class': 'cbi-button cbi-button-apply',
                        'click': function () {
                            var textarea = document.getElementById('syslog-textarea');
                            var logContent = textarea.value;
                            var blob = new Blob([logContent], { type: 'text/plain' });
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = url;
                            a.download = 'phantun_logs_' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
                            a.click();
                            URL.revokeObjectURL(url);
                        }
                    }, _('下载日志')),
                    ' ',
                    E('button', {
                        'class': 'cbi-button cbi-button-neutral',
                        'click': function () {
                            var textarea = document.getElementById('syslog-textarea');
                            textarea.scrollTop = 0;
                        }
                    }, _('滚动到顶部'))
                ])
            ])
        ])

        // 启动日志自动刷新（延迟到 DOM 渲染完成后）
        requestAnimationFrame(function () {
            var logStatusEl = document.getElementById('log-status');
            if (logStatusEl) {
                self.logPollFn = L.bind(self.pollLogs, self);
                poll.add(self.logPollFn, self.pollInterval);
                logStatusEl.textContent = '▶ ' + _('自动刷新中');
                logStatusEl.style.color = '#5cb85c';
            }
        });

        return container;
    },

    pollLogs: function () {
        var self = this;
        return self.getRecentLogs().then(function (logs) {
            var textarea = document.getElementById('syslog-textarea');
            if (textarea) {
                textarea.value = logs.join('\n');
            }
        });
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
