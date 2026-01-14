# Copyright (C) 2024-2026 iHub-2020
#
# This is free software, licensed under the MIT License.
#
# Project: LuCI Support for UDP Tunnel Manager
# Description: Web interface for udp2raw tunnel configuration
# Version: 2.1.0
# Last Updated: 2026-01-14
# Depends: udp2raw (>= 20230206.0)
#
# Changelog:
#   v2.1.0 - MAJOR REFACTOR: Switch to standard luci.mk framework
#          - Removed all manual install/i18n logic (handled by luci.mk)
#          - luci.mk auto-generates language packs from po/ directory
#          - Reduced Makefile from ~150 lines to ~40 lines
#   v2.0.0 - Simplified: removed po2lmo logic, use pre-compiled LMO
#   v1.6.0 - Enhanced po2lmo detection (had shell escaping issues)
#   v1.5.3 - Fixed po2lmo path for OpenWrt 23.05 SDK

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp-tunnel
PKG_VERSION:=2.1.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=iHub-2020

LUCI_TITLE:=LuCI support for UDP Tunnel Manager
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+udp2raw +luci-base

define Package/luci-app-udp-tunnel/description
  UDP Tunnel Manager - Web interface for configuring udp2raw tunnels
  with FakeTCP/UDP/ICMP modes.
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
