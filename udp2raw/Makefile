# Copyright (C) 2024 iHub-2020
# 
# This is free software, licensed under the MIT License.
# See /LICENSE for more information.
#
# Project: udp2raw OpenWrt Package
# Maintainer: iHub-2020
# Upstream: https://github.com/wangyu-/udp2raw
# Version: 20230206.0 (Latest Stable Release)
# Last Updated: 2026-01-10
#
# Changelog:
#   2026-01-10 - Updated init script to fix syntax error and support typed sections
#   2026-01-09 - Fixed cross-compilation (bypass upstream hardcoded compiler)
#              - Added init.d script with OpenWrt safety defaults
#              - Added default config file with secure settings
#              - Fixed dependencies (removed unnecessary iptables-mod-filter)
#   2024-xx-xx - Initial release

include $(TOPDIR)/rules.mk

PKG_NAME:=udp2raw
PKG_VERSION:=20230206.0
PKG_RELEASE:=4

# 使用官方 Release Tag
PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/wangyu-/udp2raw.git
PKG_SOURCE_VERSION:=20230206.0
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE.md
PKG_MAINTAINER:=iHub-2020

PKG_BUILD_PARALLEL:=1
PKG_USE_MIPS16:=0

include $(INCLUDE_DIR)/package.mk

define Package/udp2raw
  SECTION:=net
  CATEGORY:=Network
  TITLE:=UDP to FakeTCP/ICMP tunnel
  URL:=https://github.com/wangyu-/udp2raw
  # 依赖说明：
  #   +libstdcpp +libpthread: C++ 运行时必需
  #   +iptables: udp2raw -a 选项需要 iptables 命令
  DEPENDS:=+libstdcpp +libpthread +iptables
endef

define Package/udp2raw/description
  A tunnel which turns UDP traffic into encrypted FakeTCP/UDP/ICMP traffic 
  by using raw socket. Helps you bypass UDP firewalls or unstable UDP 
  environments. Supports OpenVPN, WireGuard and other UDP-based VPNs.
  
  Key Features:
  - Bypass UDP blocking/QoS with FakeTCP/UDP/ICMP headers
  - AES-128-CBC encryption with HMAC-SHA1 authentication
  - Connection recovery and failure detection
  - Anti-replay protection
  - Multiple clients support
  
  OpenWrt Safety Features (enabled by default):
  - Auto iptables rule management with persistence (--keep-rule)
  - iptables lock conflict prevention (--wait-lock)
  - Network initialization retry (--retry-on-error)
  
  WARNING: Requires proper iptables rules to function correctly!
endef

# 源文件列表（用于自定义编译）
UDP2RAW_SOURCES:= \
	main.cpp \
	lib/md5.cpp \
	lib/pbkdf2-sha1.cpp \
	lib/pbkdf2-sha256.cpp \
	encrypt.cpp \
	log.cpp \
	network.cpp \
	common.cpp \
	connection.cpp \
	misc.cpp \
	fd_manager.cpp \
	client.cpp \
	server.cpp \
	lib/aes_faster_c/aes.cpp \
	lib/aes_faster_c/wrapper.cpp \
	my_ev.cpp

# 自定义编译（绕过上游 makefile 的硬编码编译器路径）
define Build/Compile
	# 生成版本信息头文件
	echo 'const char *gitversion = "$(PKG_VERSION)";' > $(PKG_BUILD_DIR)/git_version.h
	
	# 使用 OpenWrt 工具链编译
	cd $(PKG_BUILD_DIR) && \
	$(TARGET_CXX) \
		$(TARGET_CXXFLAGS) \
		-std=c++11 -DNDEBUG \
		-Wall -Wextra \
		-Wno-unused-variable \
		-Wno-unused-parameter \
		-Wno-missing-field-initializers \
		-I$(PKG_BUILD_DIR) \
		-isystem $(PKG_BUILD_DIR)/libev \
		-o udp2raw \
		$(addprefix $(PKG_BUILD_DIR)/,$(UDP2RAW_SOURCES)) \
		$(TARGET_LDFLAGS) \
		-lpthread -lrt
endef

define Package/udp2raw/install
	# Binary
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/udp2raw $(1)/usr/bin/udp2raw
	
	# Default config
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/udp2raw.config $(1)/etc/config/udp2raw
	
	# Init script
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/udp2raw.init $(1)/etc/init.d/udp2raw
	
	# Sysupgrade config preservation
	$(INSTALL_DIR) $(1)/usr/share/udp2raw
	$(INSTALL_DATA) ./files/udp2raw.upgrade $(1)/usr/share/udp2raw/
endef

define Package/udp2raw/conffiles
/etc/config/udp2raw
endef

# Post-install: Enable service
define Package/udp2raw/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	echo "Enabling udp2raw service..."
	/etc/init.d/udp2raw enable 2>/dev/null || true
}
exit 0
endef

# Pre-remove: Stop and disable service
define Package/udp2raw/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	echo "Stopping udp2raw service..."
	/etc/init.d/udp2raw stop 2>/dev/null || true
	/etc/init.d/udp2raw disable 2>/dev/null || true
}
exit 0
endef

$(eval $(call BuildPackage,udp2raw))