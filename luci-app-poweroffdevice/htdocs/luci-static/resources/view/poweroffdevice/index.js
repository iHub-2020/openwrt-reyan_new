'use strict';
'require view';
'require rpc';
'require ui';

var callExec = rpc.declare({
    object: 'file',
    method: 'exec',
    params: ['command', 'params'],
    expect: { rc: -1 }
});

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    render: function () {
        var self = this;

        var btn = E('button', {
            'class': 'cbi-button cbi-button-apply',
            'click': ui.createHandlerFn(self, function (ev) {
                var button = ev.currentTarget;
                button.disabled = true;
                button.textContent = _('Shutting Down...');

                return callExec('/sbin/poweroff', []).then(function () {
                    ui.addNotification(null, E('p', _('Power off command sent. The device will shut down shortly.')), 'info');
                }).catch(function (err) {
                    button.disabled = false;
                    button.textContent = _('Perform Power Off');
                    ui.addNotification(null, E('p', _('Failed to send power off command: ') + err), 'danger');
                });
            })
        }, _('Perform Power Off'));

        return E([], [
            E('h2', {}, _('Power Off Device')),
            E('p', {}, _('Turn off the power to the device you are using')),
            E('p', { 'class': 'alert-message warning' },
                _('WARNING: Power off might result in a reboot on a device which does not support power off.')
            ),
            E('div', { 'style': 'margin-top:1rem' }, [btn])
        ]);
    }
});
