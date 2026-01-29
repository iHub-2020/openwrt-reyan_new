# LuCI UDP Tunnel Manager

A comprehensive web interface for managing UDP tunnels using udp2raw on OpenWrt routers.

## Features

- **Multi-tunnel Support**: Configure multiple server and client instances
- **User-friendly Interface**: Clean tabbed interface with basic/advanced settings
- **Real-time Status**: Live monitoring of tunnel status and system diagnostics
- **Security Features**: Input validation and safety warnings
- **OpenWrt Integration**: Automatic iptables rule management
- **Log Management**: Real-time log viewing with filtering and export capabilities

## Installation

1. Install the udp2raw backend:
```bash
opkg update
opkg install udp2raw
```

2. Install the LuCI interface:
```bash
opkg install luci-app-udp-tunnel
```

## Configuration

### Server Mode
- OpenWrt listens for connections from remote clients
- Traffic Flow: Internet → WAN Port → [Decrypted] → Forward To IP:Port

### Client Mode  
- OpenWrt connects to a remote udp2raw server (VPS)
- Traffic Flow: App → Local Port → [Encrypted] → Forward To VPS IP:Port

### Important Settings

- **Keep Iptables Rules**: Strongly recommended for OpenWrt to auto-restore rules
- **Raw Mode**: FakeTCP recommended for bypassing firewalls
- **Cipher Mode**: AES-128-CBC (official default) or XOR (faster)
- **Auth Mode**: MD5 (official default) or HMAC-SHA1 (more secure)

## Safety Information

⚠️ **Critical**: FakeTCP mode requires iptables rules to block kernel TCP RST packets. On OpenWrt, these rules may be cleared when network settings change. Always enable "Keep Iptables Rules" option.

## Troubleshooting

### Common Issues

1. **Service won't start**: Check if udp2raw binary is installed
2. **Connection fails**: Ensure passwords and modes match on both ends
3. **Rules missing**: Enable "Keep Iptables Rules" and "Auto Add Iptables Rule"

### Log Analysis

Use the Status page to:
- Monitor real-time tunnel status
- View system diagnostics
- Check iptables rules
- Export logs for debugging

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please visit the project repository.