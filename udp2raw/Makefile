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
#   2026-01-10 - Switched to Binary Release mode (downloads pre-compiled binaries)
#              - Source repo switched to iHub-2020/udp2raw
#              - Simplified build process, removed local compilation
#              - Updated init script to fix syntax error and support typed sections
#   2026-01-09 - Fixed cross-compilation (bypass upstream hardcoded compiler)
#              - Added init.d script with OpenWrt safety defaults
#              - Added default config file with secure settings
#              - Fixed dependencies (removed unnecessary iptables-mod-filter)
#   2024-xx-xx - Initial release

include $(TOPDIR)/rules.mk

PKG_NAME:=udp2raw
# ----------------------------------------------------------------------------
# 【重要】版本号设置
# 1. 去 GitHub Actions 查看最新生成的 Release Tag (例如 v0.0.45)
# 2. 将 PKG_VERSION 设置为不带 v 的数字部分 (例如 0.0.45)
# ----------------------------------------------------------------------------
PKG_VERSION:=0.0.45
PKG_RELEASE:=1

# ============================================================
# Binary Release Mode Settings
# ============================================================
REPO_USER:=iHub-2020
REPO_NAME:=udp2raw

# 手动定义下载地址，不让 package.mk 自动处理
MANUAL_DOWNLOAD_URL:=https://github.com/$(REPO_USER)/$(REPO_NAME)/releases/download/v$(PKG_VERSION)

# 移除 PKG_SOURCE 定义，避免 OpenWrt 自动检查 hash
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE.md
PKG_MAINTAINER:=iHub-2020

# 预编译包不需要并行编译
PKG_BUILD_PARALLEL:=0

include $(INCLUDE_DIR)/package.mk

define Package/udp2raw
  SECTION:=net
  CATEGORY:=Network
  TITLE:=UDP to FakeTCP/ICMP tunnel (Pre-compiled)
  URL:=https://github.com/iHub-2020/udp2raw
  DEPENDS:=+iptables +ca-bundle
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
  
  WARNING: This package downloads pre-compiled STATIC binaries from GitHub.
  Ensure your architecture is supported (x86_64 or aarch64).
endef

# ------------------------------------------------------------------
# Build/Prepare: 创建编译目录
# ------------------------------------------------------------------
define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

# Build/Configure: 跳过配置
define Build/Configure
endef

# ------------------------------------------------------------------
# Build/Compile: 下载并安装二进制文件
# ------------------------------------------------------------------
define Build/Compile
	@echo "======================================================="
	@echo "Downloading udp2raw binary version: v$(PKG_VERSION)"
	@echo "Target Architecture: $(ARCH)"
	@echo "Download URL Base: $(MANUAL_DOWNLOAD_URL)"
	@echo "======================================================="

	# 根据架构下载对应的文件
	@if [ "$(ARCH)" = "x86_64" ]; then \
		curl -L -k --fail --connect-timeout 30 --retry 3 \
			-o $(PKG_BUILD_DIR)/udp2raw "$(MANUAL_DOWNLOAD_URL)/udp2raw_x86_64"; \
	elif [ "$(ARCH)" = "aarch64" ]; then \
		curl -L -k --fail --connect-timeout 30 --retry 3 \
			-o $(PKG_BUILD_DIR)/udp2raw "$(MANUAL_DOWNLOAD_URL)/udp2raw_aarch64"; \
	else \
		echo "Error: Unsupported architecture $(ARCH). Only x86_64 and aarch64 are supported."; \
		exit 1; \
	fi
	
	# 校验文件：确保文件存在且大小大于 100KB (避免下载到 404 页面或空文件)
	@if [ ! -s "$(PKG_BUILD_DIR)/udp2raw" ]; then \
		echo "Error: Download failed, file is empty."; \
		exit 1; \
	fi
	@FILE_SIZE=$$(stat -c%s "$(PKG_BUILD_DIR)/udp2raw"); \
	if [ $$FILE_SIZE -lt 100000 ]; then \
		echo "Error: File too small ($$FILE_SIZE bytes). Likely a 404 error page or broken download."; \
		echo "Check if Release v$(PKG_VERSION) exists on GitHub."; \
		exit 1; \
	fi
	
	chmod +x $(PKG_BUILD_DIR)/udp2raw
	@echo "Download and setup complete."
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

define Package/udp2raw/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	echo "Enabling udp2raw service..."
	/etc/init.d/udp2raw enable 2>/dev/null || true
}
exit 0
endef

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
