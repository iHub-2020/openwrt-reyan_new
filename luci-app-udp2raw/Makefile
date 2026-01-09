# Copyright (C) 2024 iHub-2020
#
# This is free software, licensed under the MIT License.
#
# Project: LuCI Support for udp2raw
# Description: Web interface for udp2raw tunnel configuration
# Version: 1.1.0
# Last Updated: 2026-01-09
# Depends: udp2raw (>= 20230206.0)
#
# Changelog:
#   v1.1.0 - Added OpenWrt safety defaults (--keep-rule, --wait-lock, etc.)
#          - Fixed UCI config type consistency
#          - Enhanced error handling and logging
#          - Added WireGuard integration guide
#   v1.0.0 - Initial release with new LuCI JS architecture

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp2raw
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=iHub-2020

LUCI_TITLE:=LuCI support for udp2raw
LUCI_DESCRIPTION:=Web interface for configuring udp2raw tunnels with FakeTCP/UDP/ICMP modes. \
	Includes OpenWrt-specific safety defaults for iptables rule persistence.
LUCI_DEPENDS:=+udp2raw +luci-base
LUCI_PKGARCH:=all

# Language files
PO_FILES:=$(wildcard ${CURDIR}/po/*/udp2raw.po)

include $(TOPDIR)/feeds/luci/luci.mk

# vim: set noexpandtab: