# Copyright (C) 2024 iHub-2020
#
# This is free software, licensed under the MIT License.
#
# Project: LuCI Support for udp2raw
# Description: Web interface for udp2raw tunnel configuration
# Version: 1.0.0
# Last Updated: 2026-01-09
# Depends: udp2raw (>= 20230206.0)

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp2raw
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=iHub-2020

LUCI_TITLE:=LuCI support for udp2raw
LUCI_DESCRIPTION:=Web interface for configuring udp2raw tunnels with FakeTCP/ICMP modes
LUCI_DEPENDS:=+udp2raw +luci-base +luci-compat
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# vim: set noexpandtab:
