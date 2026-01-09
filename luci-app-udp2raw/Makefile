# Copyright (C) 2024 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp2raw
PKG_VERSION:=2.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-3.0-only
PKG_MAINTAINER:=Reyanmatic <yanmaticyan@gmail.com>

LUCI_TITLE:=LuCI support for udp2raw-tunnel
LUCI_DESCRIPTION:=LuCI support for udp2raw-tunnel, a tunnel which turns UDP traffic into encrypted UDP/FakeTCP/ICMP traffic
LUCI_DEPENDS:=+udp2raw
LUCI_PKGARCH:=all

PKG_CONFIG_DEPENDS:= \
	CONFIG_PACKAGE_$(PKG_NAME)_INCLUDE_udp2raw

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
