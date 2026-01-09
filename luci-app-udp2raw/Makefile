#
# Copyright (C) 2026 Reyanmatic <yanmaticyan@gmail.com>
#
# Project: luci-app-udp2raw
# Based on: https://github.com/sensec/luci-app-udp2raw (GPL-3.0)
# Upgraded for: OpenWrt 23.05+ / LuCI 18+
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp2raw
PKG_VERSION:=1.6.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-3.0
PKG_MAINTAINER:=Reyanmatic <yanmaticyan@gmail.com>

LUCI_TITLE:=LuCI Support for udp2raw-tunnel
LUCI_DEPENDS:=+udp2raw +iptables +kmod-ipt-raw
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
