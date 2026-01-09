#
# Copyright (C) 2026 Reyanmatic <yanmaticyan@gmail.com>
#
# Project: luci-app-udp2raw
# Based on: https://github.com/sensec/luci-app-udp2raw (GPL-3.0)
# Upgraded to: LuCI JavaScript Client-Side Architecture
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for udp2raw
LUCI_DEPENDS:=+udp2raw +iptables +kmod-ipt-raw
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-udp2raw
PKG_VERSION:=2.0.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0
PKG_MAINTAINER:=Reyanmatic <yanmaticyan@gmail.com>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
