#!/bin/sh
# Phantun Configuration Reset and Repair Script
# This script cleans up anonymous sections and creates proper named sections

echo "=== Phantun Configuration Repair Script ==="
echo ""

# Backup current config
echo "[1/5] Backing up current configuration..."
cp /etc/config/phantun /etc/config/phantun.backup.$(date +%Y%m%d_%H%M%S)

# Stop the service
echo "[2/5] Stopping phantun service..."
/etc/init.d/phantun stop

# Clear all existing server and client sections
echo "[3/5] Removing all existing server and client sections..."
while uci -q delete phantun.@server[0]; do :; done
while uci -q delete phantun.@client[0]; do :; done

# Create a proper named server section with enabled=1
echo "[4/5] Creating clean server instance (enabled by default)..."
uci set phantun.server_main=server
uci set phantun.server_main.enabled='1'
uci set phantun.server_main.alias='MainServer'
uci set phantun.server_main.local_port='4567'
uci set phantun.server_main.remote_addr='127.0.0.1'
uci set phantun.server_main.remote_port='51820'
uci set phantun.server_main.tun_local='192.168.201.1'
uci set phantun.server_main.tun_peer='192.168.201.2'
uci set phantun.server_main.ipv4_only='0'
uci set phantun.server_main.tun_local6='fcc9::1'
uci set phantun.server_main.tun_peer6='fcc9::2'

# Create a proper named client section with enabled=1
echo "Creating clean client instance (enabled by default)..."
uci set phantun.client_main=client
uci set phantun.client_main.enabled='1'
uci set phantun.client_main.alias='MainClient'
uci set phantun.client_main.local_addr='127.0.0.1'
uci set phantun.client_main.local_port='51820'
uci set phantun.client_main.remote_addr='10.10.10.1'
uci set phantun.client_main.remote_port='5555'
uci set phantun.client_main.tun_local='192.168.200.1'
uci set phantun.client_main.tun_peer='192.168.200.2'
uci set phantun.client_main.ipv4_only='0'
uci set phantun.client_main.tun_local6='fcc8::1'
uci set phantun.client_main.tun_peer6='fcc8::2'

# Commit changes
echo "[5/5] Committing configuration..."
uci commit phantun

echo ""
echo "=== Repair Complete ==="
echo "Configuration has been reset to clean named sections."
echo "Both server and client instances are ENABLED by default."
echo ""
echo "Next steps:"
echo "1. Adjust the IP addresses and ports in the LuCI interface"
echo "2. Click 'Save & Apply' to start the service"
echo ""
echo "Backup saved to: /etc/config/phantun.backup.*"
echo ""
