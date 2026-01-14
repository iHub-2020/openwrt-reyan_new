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
#   v2.1.0 - MAJOR FIX: Switch to luci.mk framework
#          - Removed all manual i18n handling (handled by luci.mk)
#          - Removed manual luci-i18n-* package definition
#          - luci.mk auto-generates language packs from po/ directory
#          - Fixed zh-cn symlink structure for proper translation loading
#   v2.0.0 - Simplified: removed all po2lmo logic from Makefile
#   v1.6.0 - Enhanced po2lmo detection (had shell escaping issues)
#   v1.5.3 - Fixed po2lmo path for OpenWrt 23.05 SDK

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp-tunnel
PKG_VERSION:=2.1.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=iHub-2020

# ============================================================
# LuCI 框架变量（luci.mk 会自动处理）
# ============================================================
LUCI_TITLE:=LuCI support for UDP Tunnel Manager
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+udp2raw +luci-base

# PO 文件名（对应 po/zh_Hans/udp-tunnel.po）
PO_NAME:=udp-tunnel

define Package/luci-app-udp-tunnel/description
  UDP Tunnel Manager - Web interface for configuring udp2raw tunnels 
  with FakeTCP/UDP/ICMP modes. Converts UDP traffic into encrypted 
  TCP/ICMP to bypass firewalls.
  
  Note: This package only provides the LuCI web interface.
  The init script and default config are provided by the udp2raw package.
endef

# ============================================================
# 使用 LuCI 构建框架（自动处理翻译、安装等）
# ============================================================
include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
