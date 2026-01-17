# Copyright (C) 2024 iHub-2020
# 
# This is free software, licensed under the MIT License.
# See /LICENSE for more information.
#
# Project: udpspeeder OpenWrt Package
# Maintainer: iHub-2020
# Upstream: https://github.com/wangyu-/udpspeeder
# Version: 0.0.0 (Rolling Release - Always Latest)
# Last Updated: 2026-01-10
#
# Changelog:
#   2026-01-10 - Fixed version mismatch: now uses rolling release v0.0.0
#              - This version always points to the latest build
#              - No need to update PKG_VERSION when upstream rebuilds
#   2026-01-10 - Switched to Binary Release mode (downloads pre-compiled binaries)
#              - Source repo switched to iHub-2020/udpspeeder
#              - Simplified build process, removed local compilation
#              - Updated init script to fix syntax error and support typed sections
#   2026-01-09 - Fixed cross-compilation (bypass upstream hardcoded compiler)
#              - Added init.d script with OpenWrt safety defaults
#              - Added default config file with secure settings
#              - Fixed dependencies (removed unnecessary iptables-mod-filter)
#   2024-xx-xx - Initial release

include $(TOPDIR)/rules.mk

PKG_NAME:=udpspeeder
# ----------------------------------------------------------------------------
# 【重要】滚动版本号设置
# 使用固定版本号 0.0.0，对应 GitHub Release Tag: v0.0.0
# 上游 build-udpspeeder-release.yml 每次构建都会覆盖 v0.0.0 的二进制文件
# 因此这里永远不需要修改版本号
# ----------------------------------------------------------------------------
PKG_VERSION:=1.0.1
PKG_RELEASE:=1

# ============================================================
# Binary Release Mode Settings
# ============================================================
REPO_USER:=iHub-2020
REPO_NAME:=UDPspeeder

# 手动定义下载地址，不让 package.mk 自动处理
# 下载 URL: https://github.com/iHub-2020/udpspeeder/releases/download/v0.0.0/udpspeeder_x86_64
MANUAL_DOWNLOAD_URL:=https://github.com/$(REPO_USER)/$(REPO_NAME)/releases/download/v$(PKG_VERSION)

# 移除 PKG_SOURCE 定义，避免 OpenWrt 自动检查 hash
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE.md
PKG_MAINTAINER:=iHub-2020

# 预编译包不需要并行编译
PKG_BUILD_PARALLEL:=0

include $(INCLUDE_DIR)/package.mk

define Package/udpspeeder
  SECTION:=net
  CATEGORY:=Network
  TITLE:=UDP to FakeTCP/ICMP tunnel (Pre-compiled)
  URL:=https://github.com/iHub-2020/udpspeeder
  DEPENDS:=+iptables +ca-bundle
endef

define Package/udpspeeder/description
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
  
  NOTE: This package downloads pre-compiled STATIC binaries from GitHub.
  Using rolling release v0.0.0 which always contains the latest build.
  Supported architectures: x86_64, aarch64
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
	@echo "Downloading udpspeeder binary (Rolling Release)"
	@echo "Version Tag: v$(PKG_VERSION)"
	@echo "Target Architecture: $(ARCH)"
	@echo "Download URL Base: $(MANUAL_DOWNLOAD_URL)"
	@echo "======================================================="

	# 根据架构下载对应的文件
	@if [ "$(ARCH)" = "x86_64" ]; then \
		echo "Downloading: $(MANUAL_DOWNLOAD_URL)/udpspeeder_x86_64"; \
		curl -L -k --fail --connect-timeout 30 --retry 3 \
			-o $(PKG_BUILD_DIR)/udpspeeder "$(MANUAL_DOWNLOAD_URL)/udpspeeder_x86_64"; \
	elif [ "$(ARCH)" = "aarch64" ]; then \
		echo "Downloading: $(MANUAL_DOWNLOAD_URL)/udpspeeder_aarch64"; \
		curl -L -k --fail --connect-timeout 30 --retry 3 \
			-o $(PKG_BUILD_DIR)/udpspeeder "$(MANUAL_DOWNLOAD_URL)/udpspeeder_aarch64"; \
	else \
		echo "Error: Unsupported architecture $(ARCH). Only x86_64 and aarch64 are supported."; \
		exit 1; \
	fi
	
	# 校验文件：确保文件存在且大小大于 100KB (避免下载到 404 页面或空文件)
	@if [ ! -s "$(PKG_BUILD_DIR)/udpspeeder" ]; then \
		echo "Error: Download failed, file is empty."; \
		echo "Please ensure Release v$(PKG_VERSION) exists at:"; \
		echo "  https://github.com/$(REPO_USER)/$(REPO_NAME)/releases/tag/v$(PKG_VERSION)"; \
		exit 1; \
	fi
	@FILE_SIZE=$$(stat -c%s "$(PKG_BUILD_DIR)/udpspeeder"); \
	if [ $$FILE_SIZE -lt 100000 ]; then \
		echo "Error: File too small ($$FILE_SIZE bytes). Likely a 404 error page or broken download."; \
		echo "Please verify the Release exists at:"; \
		echo "  https://github.com/$(REPO_USER)/$(REPO_NAME)/releases/tag/v$(PKG_VERSION)"; \
		exit 1; \
	fi
	
	chmod +x $(PKG_BUILD_DIR)/udpspeeder
	@echo "======================================================="
	@echo "Download complete. File size: $$FILE_SIZE bytes"
	@echo "======================================================="
endef

define Package/udpspeeder/install
	# Binary
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/udpspeeder $(1)/usr/bin/udpspeeder
	
	# Default config
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/udpspeeder.config $(1)/etc/config/udpspeeder
	
	# Init script
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/udpspeeder.init $(1)/etc/init.d/udpspeeder
	
	# Sysupgrade config preservation
	$(INSTALL_DIR) $(1)/usr/share/udpspeeder
	$(INSTALL_DATA) ./files/udpspeeder.upgrade $(1)/usr/share/udpspeeder/
endef

define Package/udpspeeder/conffiles
/etc/config/udpspeeder
endef

define Package/udpspeeder/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	echo "Enabling udpspeeder service..."
	/etc/init.d/udpspeeder enable 2>/dev/null || true
}
exit 0
endef

define Package/udpspeeder/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	echo "Stopping udpspeeder service..."
	/etc/init.d/udpspeeder stop 2>/dev/null || true
	/etc/init.d/udpspeeder disable 2>/dev/null || true
}
exit 0
endef

$(eval $(call BuildPackage,udpspeeder))
