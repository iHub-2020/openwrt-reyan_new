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
# 这里填写不带 v 的版本号，例如 1.0 或 0.0.45
PKG_VERSION:=20230206.0
PKG_RELEASE:=6

# ============================================================
# Binary Release Mode Settings
# ============================================================
# 我们不再下载源码编译，而是直接从 GitHub Releases 下载预编译好的二进制文件
# 确保你的 Release Tag 格式为 v20230206.0 (带 v 前缀)
REPO_USER:=iHub-2020
REPO_NAME:=udp2raw

# 定义下载的基础 URL，注意这里拼接了 v 前缀
DOWNLOAD_BASE_URL:=https://github.com/$(REPO_USER)/$(REPO_NAME)/releases/download/v$(PKG_VERSION)

# 这里的 PKG_SOURCE 仅作占位，防止 OpenWrt 构建系统报错
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION)-precompiled
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE.md
PKG_MAINTAINER:=iHub-2020

# 由于是直接下载二进制，不需要并行编译
PKG_BUILD_PARALLEL:=0

include $(INCLUDE_DIR)/package.mk

define Package/udp2raw
  SECTION:=net
  CATEGORY:=Network
  TITLE:=UDP to FakeTCP/ICMP tunnel (Pre-compiled)
  URL:=https://github.com/iHub-2020/udp2raw
  # 依赖说明：
  #   +iptables: udp2raw -a 选项需要 iptables 命令
  #   注意：由于我们在 Action 中使用了静态链接(-static)，这里不再需要 libstdcpp/libpthread
  DEPENDS:=+iptables
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
# 关键修复: 重写 Build/Prepare
# 必须显式定义此步骤，否则 OpenWrt 会尝试解压 PKG_SOURCE 导致报错
# ------------------------------------------------------------------
define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

# 不需要 Build/Configure，因为没有源码配置过程
define Build/Configure
endef

# 自定义编译步骤：下载并重命名
# 注意：这里使用了 curl -L (跟随重定向) 和 -k (允许不安全的SSL，防止老旧系统证书问题)
define Build/Compile
	# 根据 OpenWrt 架构选择对应的文件名
	# 注意：这里必须与 build-release.yml 中的 output_name 对应
	@echo "Detecting architecture for udp2raw..."
	@if [ "$(ARCH)" = "x86_64" ]; then \
		echo "Architecture: x86_64"; \
		echo "Downloading from: $(DOWNLOAD_BASE_URL)/udp2raw_x86_64"; \
		curl -L -k --fail --connect-timeout 30 --retry 3 -o $(PKG_BUILD_DIR)/udp2raw "$(DOWNLOAD_BASE_URL)/udp2raw_x86_64"; \
	elif [ "$(ARCH)" = "aarch64" ]; then \
		echo "Architecture: aarch64"; \
		echo "Downloading from: $(DOWNLOAD_BASE_URL)/udp2raw_aarch64"; \
		curl -L -k --fail --connect-timeout 30 --retry 3 -o $(PKG_BUILD_DIR)/udp2raw "$(DOWNLOAD_BASE_URL)/udp2raw_aarch64"; \
	else \
		echo "Error: Unsupported architecture $(ARCH). Only x86_64 and aarch64 are supported via Action."; \
		exit 1; \
	fi
	
	# 检查下载是否成功 (文件是否存在且大小不为0)
	@if [ ! -s "$(PKG_BUILD_DIR)/udp2raw" ]; then \
		echo "Error: Download failed or file is empty."; \
		exit 1; \
	fi
	
	# 赋予执行权限
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
