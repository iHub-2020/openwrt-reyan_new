# SPDX-License-Identifier: MIT
#
# Copyright (c) 2026 Reyanmatic <yanmaticyan@gmail.com>
#
# Project: udp2raw OpenWrt Package
# Created: 2026-01-09
# Version: 20230206.0-r2
# Author: Reyanmatic
# Email: yanmaticyan@gmail.com
#
# Description:
#   OpenWrt Makefile for udp2raw-tunnel
#   Based on upstream: https://github.com/wangyu-/udp2raw (git 4623f878e0)

include $(TOPDIR)/rules.mk

PKG_NAME:=udp2raw
PKG_VERSION:=20230206.0
PKG_RELEASE:=2

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/wangyu-/udp2raw.git
PKG_SOURCE_VERSION:=4623f878e0
PKG_SOURCE_DATE:=2024-11-03
PKG_MIRROR_HASH:=skip

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Reyanmatic <yanmaticyan@gmail.com>

PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=gc-sections lto

include $(INCLUDE_DIR)/package.mk

define Package/udp2raw
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=VPN
  TITLE:=Tunnel UDP into Encrypted FakeTCP/UDP/ICMP Traffic
  URL:=https://github.com/wangyu-/udp2raw
  DEPENDS:=+libstdcpp +libpthread +librt
  PROVIDES:=udp2raw-tunnel
endef

define Package/udp2raw/description
  udp2raw-tunnel turns UDP traffic into encrypted FakeTCP/UDP/ICMP traffic
  by using raw socket. It helps you bypass UDP blocking/QoS and unstable
  UDP environment.
  
  Features:
  - Encryption support (AES-128/AES-256)
  - Anti-replay protection
  - Connection recovery
  - Multiple cipher modes (aes128cbc, aes128cfb, xor, none)
  - Auth modes (md5, crc32, simple, none)
endef

# 编译标志
TARGET_CXXFLAGS += -std=c++11 -Wall -Wextra -Wno-unused-parameter
TARGET_CXXFLAGS += -DNDEBUG -ffunction-sections -fdata-sections
TARGET_LDFLAGS += -Wl,--gc-sections -lpthread -lrt

MAKE_FLAGS += cross

define Build/Prepare
	$(PKG_UNPACK)
	# 修改原项目 makefile 以使用交叉编译器
	$(SED) 's|cc_cross=.*|cc_cross=$(TARGET_CXX)|g' $(PKG_BUILD_DIR)/makefile
	# 移除 git version 检测（SDK 环境下不可用）
	$(SED) '/\*gitversion/d' $(PKG_BUILD_DIR)/makefile
	# 手动创建版本信息
	echo 'const char *gitversion = "$(PKG_VERSION)-openwrt-$(PKG_RELEASE) (git-$(PKG_SOURCE_VERSION))";' > $(PKG_BUILD_DIR)/git_version.h
	$(Build/Patch)
endef

define Build/Compile
	$(MAKE) -C $(PKG_BUILD_DIR) \
		$(MAKE_FLAGS) \
		CXXFLAGS="$(TARGET_CXXFLAGS)" \
		LDFLAGS="$(TARGET_LDFLAGS)"
endef

define Package/udp2raw/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/udp2raw_cross $(1)/usr/bin/udp2raw
endef

define Package/udp2raw/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	echo "udp2raw installed successfully!"
	echo "Binary location: /usr/bin/udp2raw"
	echo "Run 'udp2raw -h' for usage information"
	echo ""
	echo "Note: Install 'luci-app-udp2raw' for Web UI configuration"
}
exit 0
endef

$(eval $(call BuildPackage,udp2raw))
