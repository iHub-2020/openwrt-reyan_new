#
# Copyright (C) 2024-2026 iHub-2020
#
# This is free software, licensed under the MIT License.
#
# Project: LuCI Support for UDP Tunnel Manager
# Version: 2.1.0
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp-tunnel
PKG_VERSION:=2.1.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=iHub-2020

# 这里的 Title 会显示在 make menuconfig 中
LUCI_TITLE:=LuCI support for UDP Tunnel Manager
# 架构设置为 all，因为是脚本和网页，不涉及二进制编译
LUCI_PKGARCH:=all
# 依赖关系：确保安装了 udp2raw 和 luci 基础库
LUCI_DEPENDS:=+udp2raw +luci-base

# 这一段描述是标准的 OpenWrt 包描述格式
define Package/luci-app-udp-tunnel/description
  UDP Tunnel Manager - Web interface for configuring udp2raw tunnels
  with FakeTCP/UDP/ICMP modes.
endef

# 核心：引入 luci.mk，它会自动处理 po/zh_Hans/luci-app-udp-tunnel.po
include $(TOPDIR)/feeds/luci/luci.mk

# 最后一行调用构建逻辑
$(eval $(call BuildPackage,luci-app-udp-tunnel))
