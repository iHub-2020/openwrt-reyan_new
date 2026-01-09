# 
# Copyright (C) 2024 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v3.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp2raw
PKG_VERSION:=2.0.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-3.0-only
PKG_MAINTAINER:=yanmaticyan@gmail.com>

LUCI_TITLE:=LuCI support for udp2raw-tunnel
LUCI_DESCRIPTION:=LuCI support for udp2raw-tunnel - A tunnel which turns UDP traffic into encrypted UDP/FakeTCP/ICMP traffic
LUCI_DEPENDS:=+udp2raw
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature