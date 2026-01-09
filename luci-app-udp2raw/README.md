# luci-app-udp2raw (New Architecture)

LuCI support for udp2raw-tunnel - Upgraded to OpenWrt 21.02+ new LuCI architecture.

## Description

This is a modernized version of the classic `luci-app-udp2raw`, migrated from the old LuCI CBI/Lua architecture to the new JavaScript-based architecture.

## Features

- ✅ Support for multiple server and client instances
- ✅ Multiple encryption modes (AES-128-CBC, AES-128-CFB, XOR, None)
- ✅ Multiple authentication modes (MD5, CRC32, Simple, None)
- ✅ FakeTCP/UDP/ICMP transmission modes
- ✅ Auto iptables rule management
- ✅ Real-time service status display
- ✅ Modern responsive UI

## Compatibility

- OpenWrt 21.02+
- OpenWrt 22.03+
- OpenWrt 23.05+

## Installation

### Method 1: From IPK package

```bash
opkg update
opkg install udp2raw
opkg install luci-app-udp2raw_*.ipk

Method 2: Compile from source
See "Build Instructions" below.

Build Instructions
Prerequisites
bash
# Install dependencies on Debian/Ubuntu
sudo apt update
sudo apt install -y build-essential clang flex bison g++ gawk \
gcc-multilib g++-multilib gettext git libncurses5-dev libssl-dev \
python3-distutils rsync unzip zlib1g-dev file wget

Compile Steps
bash
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
Usage
Access LuCI web interface
Navigate to Services → udp2raw-tunnel
Enable the service
Configure server or client instances
Select which instance to run
Save & Apply
Migration from Old Version
If you're upgrading from the old CBI/Lua version:

```bash
# Backup your old configuration
cp /etc/config/udp2raw /etc/config/udp2raw.backup

# Remove old version
opkg remove luci-app-udp2raw

# Install new version
opkg install luci-app-udp2raw_*.ipk

# Restore configuration (should be compatible)
```

## License
GPL-3.0-only

## Author
Based on original work by sensec
Upgraded by: Reyanmatic <yanmaticyan@gmail.com>

## Links
Original project: https://github.com/sensec/luci-app-udp2raw
udp2raw: https://github.com/wangyu-/udp2raw
