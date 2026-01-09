# luci-app-udp2raw (New Architecture)

LuCI support for udp2raw-tunnel - Upgraded to OpenWrt 21.02+ new LuCI architecture.

## Description

This is a modernized version of the classic `luci-app-udp2raw`, migrated from the old LuCI CBI/Lua architecture to the new JavaScript-based architecture.

**Key improvement:** This version includes OpenWrt-specific safety defaults that prevent common issues like iptables rule loss after system changes.

## Features

- ✅ Support for multiple tunnel instances (client and server modes)
- ✅ Multiple encryption modes (AES-128-CBC, AES-128-CFB, XOR, None)
- ✅ Multiple authentication modes (HMAC-SHA1, MD5, CRC32, Simple, None)
- ✅ FakeTCP/UDP/ICMP/easy-faketcp transmission modes
- ✅ **Auto iptables rule management with persistence** (`--keep-rule`)
- ✅ **iptables lock conflict prevention** (`--wait-lock`)
- ✅ **Network initialization retry** (`--retry-on-error`)
- ✅ Real-time service status display with binary verification
- ✅ Integrated log viewer
- ✅ WireGuard integration guide
- ✅ Modern responsive UI
- ✅ Full Chinese (Simplified) translation

## OpenWrt Safety Defaults

This package automatically applies critical safety parameters for OpenWrt:

| Parameter | Purpose |
|-----------|---------|
| `-a` | Auto-add iptables rules to block kernel TCP RST |
| `--keep-rule` | Monitor and re-add iptables rules if cleared by other programs |
| `--wait-lock` | Wait for xtables lock instead of failing |
| `--retry-on-error` | Allow starting before network initialization |
| `--disable-color` | Prevent ANSI escape codes in system logs |

## Compatibility

- OpenWrt 21.02+
- OpenWrt 22.03+
- OpenWrt 23.05+
- OpenWrt 24.10+

## Installation

### Method 1: From IPK package

```bash
opkg update
opkg install udp2raw
opkg install luci-app-udp2raw_*.ipk

Method 2: Compile from source
See "Build Instructions" below.
```
#### Build Instructions
Prerequisites
```bash
# Install dependencies on Debian/Ubuntu
sudo apt update
sudo apt install -y build-essential clang flex bison g++ gawk \
  gcc-multilib g++-multilib gettext git libncurses5-dev libssl-dev \
  python3-distutils rsync unzip zlib1g-dev file wget
```
Compile Steps
```bash
# 1. Download OpenWrt SDK
cd ~
wget https://downloads.openwrt.org/releases/23.05.2/targets/x86/64/openwrt-sdk-23.05.2-x86-64_gcc-12.3.0_musl.Linux-x86_64.tar.xz
tar -xf openwrt-sdk-*.tar.xz
cd openwrt-sdk-*/

# 2. Clone this project
git clone https://github.com/YOUR_USERNAME/luci-app-udp2raw.git package/luci-app-udp2raw

# 3. Update feeds
./scripts/feeds update -a
./scripts/feeds install -a

# 4. Configure
make menuconfig
# Navigate to: LuCI → Applications → luci-app-udp2raw
# Select <*> or <M>

# 5. Compile
make package/luci-app-udp2raw/compile V=s

# 6. Find IPK
ls bin/packages/*/luci/luci-app-udp2raw_*.ipk
```
## Dependencies
udp2raw - The binary package (must be installed separately or included in build)
luci-base - LuCI core framework
Usage
Access LuCI web interface
Navigate to Services → Udp2raw Tunnel
In Configuration tab:
Enable the service globally
Add tunnel instances (client or server mode)
Configure connection parameters
In Status tab:
View running instances
Check binary version and iptables rules
View real-time logs
Save & Apply
WireGuard Integration
Typical Setup (OpenWrt as WireGuard Client)
┌─────────────────────────────────────────────────────────────────┐
│                        OpenWrt Router                           │
│  ┌──────────────┐     ┌──────────────┐                          │
│  │  WireGuard   │────▶│   udp2raw    │────▶ Internet ────▶ VPS│
│  │   Client     │ UDP │   Client     │ FakeTCP                  │
│  │ 127.0.0.1:X  │     │ 127.0.0.1:Y  │                          │
│  └──────────────┘     └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘

Configuration Steps
udp2raw Client (on OpenWrt):

Mode: Client (-c)
Local Address: 127.0.0.1
Local Port: e.g., 6666
Remote Address: Your VPS IP
Remote Port: e.g., 7777
WireGuard Client (on OpenWrt):

Endpoint: 127.0.0.1:6666 (points to local udp2raw)
VPS Side:

Run udp2raw in server mode (-s)
Run WireGuard server
Important: Prevent Traffic Loop
If routing all traffic (0.0.0.0/0) through VPN, add a route exception for the VPS IP:

```bash
ip route add <VPS_IP>/32 via <original_gateway>

Migration from Old Version
If you're upgrading from the old CBI/Lua version:

bash
# Backup your old configuration
cp /etc/config/udp2raw /etc/config/udp2raw.backup

# Remove old version
opkg remove luci-app-udp2raw

# Install new version
opkg install luci-app-udp2raw_*.ipk

# Review and update configuration if needed
# New version uses 'config tunnel' instead of 'config servers'

Troubleshooting
Service won't start
Check if udp2raw binary exists:
```
```bash
which udp2raw
ls -la /usr/bin/udp2raw

Verify configuration:

bash
uci show udp2raw

Check system log:
```
```bash
logread | grep udp2raw

Connection unstable
Ensure --keep-rule is enabled (default in this version)

Check if iptables rules exist:
```
```bash
iptables -L -n | grep -i udp2raw

Try different raw_mode (faketcp/udp/icmp)

iptables conflicts
If using other firewall applications, ensure --wait-lock is enabled (default in this version) to prevent lock conflicts.
```
## Changelog
v1.1.0 (2026-01-09)
Added OpenWrt safety defaults (--keep-rule, --wait-lock, etc.)
Fixed UCI config type consistency (unified to config tunnel)
Enhanced error handling and logging in init script
Added binary existence check in status page
Added WireGuard integration guide
Full Chinese (Simplified) translation
Improved validation and warning messages
## v1.0.0
Initial release with new LuCI JavaScript architecture
Migrated from old CBI/Lua architecture
License
GPL-3.0-only

## Author
- Based on original work by sensec
- Upgraded by: iHub-2020
## Links
- Original project: https://github.com/sensec/luci-app-udp2raw
- udp2raw: https://github.com/wangyu-/udp2raw

- udp2raw wiki: https://github.com/wangyu-/udp2raw/wiki

