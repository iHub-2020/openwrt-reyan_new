/**
 * Copyright (C) 2026 iHub-2020
 * 
 * LuCI Phantun Manager - Dashboard
 * Visual Overview and Network Topology
 * 
 * @module luci-app-phantun/dashboard
 * @version 1.0.0
 * @date 2026-02-03
 */

'use strict';
'require view';
'require poll';
'require fs';
'require ui';
'require uci';
'require rpc';

var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

return view.extend({
    title: _('Phantun Dashboard'),

    // Add CSS dependency
    load: function () {
        return Promise.all([
            L.resolveDefault(callServiceList('phantun'), {}),
            uci.load('phantun')
        ]);
    },

    render: function (data) {
        // Inject styles
        ui.addNotification(null, E('link', { 'rel': 'stylesheet', 'href': L.resource('phantun/style.css') }));

        var serviceStatus = data[0];

        // Calculate service state
        var isRunning = false;
        var runningInstances = 0;
        if (serviceStatus && serviceStatus.phantun && serviceStatus.phantun.instances) {
            for (var key in serviceStatus.phantun.instances) {
                if (serviceStatus.phantun.instances[key].running) {
                    isRunning = true;
                    runningInstances++;
                }
            }
        }

        // Determine topology visualization state
        var flowClass = isRunning ? 'active' : 'stopped';
        var statusColor = isRunning ? 'var(--accent-success)' : 'var(--text-muted)';

        // Get configured instances for summary
        var sections = uci.sections('phantun');
        var serverCount = 0;
        var clientCount = 0;
        sections.forEach(function (s) {
            if (s['.type'] === 'server' && s.enabled !== '0') serverCount++;
            if (s['.type'] === 'client' && s.enabled !== '0') clientCount++;
        });

        var container = E('div', { 'class': 'cbi-map', 'id': 'phantun-dashboard' }, [

            // ==================== Top Status Bar ====================
            E('div', { 'class': 'cbi-section phantun-card', 'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;' }, [
                E('div', {}, [
                    E('h2', { 'style': 'margin: 0; font-size: 1.5rem;' }, _('Phantun Manager')),
                    E('div', { 'style': 'color: var(--text-secondary); margin-top: 5px;' }, _('UDP to TCP Obfuscator'))
                ]),
                E('div', { 'style': 'text-align: right;' }, [
                    E('div', { 'style': 'font-size: 0.9rem; color: var(--text-secondary);' }, _('Service Status')),
                    E('div', { 'style': 'font-size: 1.2rem; font-weight: bold; color: ' + (isRunning ? 'var(--accent-success)' : 'var(--accent-error)') + ';' },
                        isRunning ? _('Active') : _('Stopped')
                    )
                ])
            ]),

            // ==================== Network Topology ====================
            E('div', { 'class': 'cbi-section phantun-card', 'style': 'padding: 0; overflow: hidden;' }, [
                E('div', { 'class': 'topology-header', 'style': 'padding: 15px 20px; border-bottom: 1px solid var(--border);' }, [
                    E('h3', { 'style': 'margin: 0;' }, _('Network Topology'))
                ]),
                E('div', { 'class': 'topology-container' }, [
                    // SVG Map
                    E('svg', { 'class': 'topo-svg', 'viewBox': '0 0 800 100', 'preserveAspectRatio': 'xMidYMid meet' }, [
                        // Definitions for markers
                        E('defs', {}, [
                            E('marker', { 'id': 'arrowhead', 'markerWidth': '10', 'markerHeight': '7', 'refX': '9', 'refY': '3.5', 'orient': 'auto' }, [
                                E('polygon', { 'points': '0 0, 10 3.5, 0 7', 'fill': '#64748b' })
                            ]),
                            E('marker', { 'id': 'arrowhead-active', 'markerWidth': '10', 'markerHeight': '7', 'refX': '9', 'refY': '3.5', 'orient': 'auto' }, [
                                E('polygon', { 'points': '0 0, 10 3.5, 0 7', 'fill': 'var(--accent-success)' })
                            ])
                        ]),

                        // Connection Lines (Bottom Layer)
                        E('line', { 'x1': '100', 'y1': '50', 'x2': '300', 'y2': '50', 'class': 'flow-line ' + flowClass }),
                        E('line', { 'x1': '300', 'y1': '50', 'x2': '500', 'y2': '50', 'class': 'flow-line ' + flowClass }),
                        E('line', { 'x1': '500', 'y1': '50', 'x2': '700', 'y2': '50', 'class': 'flow-line ' + flowClass }),

                        // Nodes
                        // 1. Phantun Client
                        E('g', { 'transform': 'translate(100, 50)' }, [
                            E('circle', { 'r': '30', 'class': 'node-circle client' }),
                            E('text', { 'x': '0', 'y': '5', 'class': 'node-icon' }, 'C'),
                            E('text', { 'x': '0', 'y': '45', 'class': 'node-text' }, 'Client'),
                            E('text', { 'x': '0', 'y': '60', 'class': 'node-subtext' }, '192.168.200.2') // Tun Peer
                        ]),

                        // 2. Internet / TCP
                        E('g', { 'transform': 'translate(300, 50)' }, [
                            E('circle', { 'r': '25', 'class': 'node-circle internet' }),
                            E('text', { 'x': '0', 'y': '5', 'class': 'node-icon', 'style': 'font-size: 18px;' }, 'TCP'),
                            E('text', { 'x': '0', 'y': '45', 'class': 'node-text' }, 'Obfuscated'),
                        ]),

                        // 3. Phantun Server
                        E('g', { 'transform': 'translate(500, 50)' }, [
                            E('circle', { 'r': '30', 'class': 'node-circle server' }),
                            E('text', { 'x': '0', 'y': '5', 'class': 'node-icon' }, 'S'),
                            E('text', { 'x': '0', 'y': '45', 'class': 'node-text' }, 'Server'),
                            E('text', { 'x': '0', 'y': '60', 'class': 'node-subtext' }, '192.168.201.2') // Tun Peer
                        ]),

                        // 4. Target Service
                        E('g', { 'transform': 'translate(700, 50)' }, [
                            E('circle', { 'r': '25', 'class': 'node-circle', 'style': 'stroke: var(--accent-success);' }),
                            E('text', { 'x': '0', 'y': '5', 'class': 'node-icon', 'style': 'font-size: 18px;' }, 'UDP'),
                            E('text', { 'x': '0', 'y': '45', 'class': 'node-text' }, 'Target')
                        ]),

                        // Status Indicator text
                        E('text', { 'x': '400', 'y': '90', 'class': 'node-text', 'style': 'fill: var(--text-muted);' },
                            isRunning ? _('Tunnel Active') : _('Tunnel Stopped')
                        )
                    ])
                ])
            ]),

            // ==================== Status Cards Grid ====================
            E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;' }, [
                // Card 1: Instances
                E('div', { 'class': 'cbi-section phantun-card' }, [
                    E('h4', { 'style': 'margin-top: 0; color: var(--text-secondary);' }, _('Active Instances')),
                    E('div', { 'style': 'font-size: 2rem; font-weight: bold; margin: 10px 0;' }, String(runningInstances)),
                    E('div', { 'class': 'status-dot ' + (isRunning ? 'running' : 'stopped'), 'style': 'margin-right: 5px;' }),
                    E('span', { 'style': 'color: var(--text-muted);' },
                        _('Total Configured: ') + (serverCount + clientCount)
                    )
                ]),

                // Card 2: Mode Distribution
                E('div', { 'class': 'cbi-section phantun-card' }, [
                    E('h4', { 'style': 'margin-top: 0; color: var(--text-secondary);' }, _('Configuration')),
                    E('div', { 'style': 'margin-top: 15px;' }, [
                        E('div', { 'style': 'display: flex; justify-content: space-between; margin-bottom: 5px;' }, [
                            _('Client Mode'), E('b', {}, String(clientCount))
                        ]),
                        E('div', { 'style': 'width: 100%; background: var(--bg-input); height: 6px; border-radius: 3px;' }, [
                            E('div', { 'style': 'width: ' + (clientCount > 0 ? '100%' : '0%') + '; background: var(--accent-info); height: 100%; border-radius: 3px;' })
                        ]),

                        E('div', { 'style': 'display: flex; justify-content: space-between; margin-bottom: 5px; margin-top: 10px;' }, [
                            _('Server Mode'), E('b', {}, String(serverCount))
                        ]),
                        E('div', { 'style': 'width: 100%; background: var(--bg-input); height: 6px; border-radius: 3px;' }, [
                            E('div', { 'style': 'width: ' + (serverCount > 0 ? '100%' : '0%') + '; background: var(--accent-warning); height: 100%; border-radius: 3px;' })
                        ])
                    ])
                ]),

                // Card 3: System Health
                E('div', { 'class': 'cbi-section phantun-card' }, [
                    E('h4', { 'style': 'margin-top: 0; color: var(--text-secondary);' }, _('System Health')),
                    E('div', { 'style': 'margin-top: 10px;' }, [
                        E('div', { 'style': 'display: flex; align-items: center; margin-bottom: 8px;' }, [
                            E('div', { 'style': 'width: 8px; height: 8px; border-radius: 50%; background: var(--accent-success); margin-right: 10px;' }),
                            _('Binaries Installed')
                        ]),
                        E('div', { 'style': 'display: flex; align-items: center; margin-bottom: 8px;' }, [
                            E('div', { 'style': 'width: 8px; height: 8px; border-radius: 50%; background: ' + (isRunning ? 'var(--accent-success)' : 'var(--text-muted)') + '; margin-right: 10px;' }),
                            _('Service Running')
                        ]),
                        E('div', { 'style': 'display: flex; align-items: center;' }, [
                            E('div', { 'style': 'width: 8px; height: 8px; border-radius: 50%; background: var(--accent-info); margin-right: 10px;' }),
                            _('Config Loaded')
                        ])
                    ])
                ])
            ])

        ]);

        return container;
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
