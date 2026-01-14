# Copyright (C) 2024 iHub-2020
#
# This is free software, licensed under the MIT License.
#
# Project: LuCI Support for UDP Tunnel Manager
# Description: Web interface for udp2raw tunnel configuration
# Version: 2.0.0
# Last Updated: 2026-01-14
# Depends: udp2raw (>= 20230206.0)
#
# Changelog:
#   v2.0.0 - Simplified: removed all po2lmo logic from Makefile
#          - LMO files are now pre-compiled by GitHub Actions workflow
#          - Makefile only installs the pre-compiled i18n/*.lmo files
#          - This fixes all shell variable escaping issues in Make
#   v1.6.0 - Enhanced po2lmo detection (had shell escaping issues)
#   v1.5.3 - Fixed po2lmo path for OpenWrt 23.05 SDK
#   v1.4.0 - Sync version with JS files
#   v1.2.0 - Fixed translation loading issues

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp-tunnel
PKG_VERSION:=2.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=iHub-2020

# 语言包相关变量
PO_NAME:=udp-tunnel

include $(INCLUDE_DIR)/package.mk

# ============================================================
# 主包定义
# ============================================================
define Package/luci-app-udp-tunnel
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for UDP Tunnel Manager
  DEPENDS:=+udp2raw +luci-base
  PKGARCH:=all
endef

define Package/luci-app-udp-tunnel/description
  UDP Tunnel Manager - Web interface for configuring udp2raw tunnels 
  with FakeTCP/UDP/ICMP modes. Converts UDP traffic into encrypted 
  TCP/ICMP to bypass firewalls. Includes OpenWrt-specific safety 
  defaults for iptables rule persistence.
  
  Note: This package only provides the LuCI web interface.
  The init script and default config are provided by the udp2raw package.
endef

# ============================================================
# 编译阶段 - 无需编译，LMO 由 workflow 预编译
# ============================================================
define Build/Compile
	@echo "============================================"
	@echo "Build/Compile: No compilation needed"
	@echo "LMO files should be pre-compiled by CI/CD"
	@echo "============================================"
	@if [ -f ./i18n/$(PO_NAME).zh-cn.lmo ]; then \
		echo "✓ Found pre-compiled LMO: ./i18n/$(PO_NAME).zh-cn.lmo"; \
		ls -la ./i18n/; \
	else \
		echo "⚠ WARNING: Pre-compiled LMO not found in ./i18n/"; \
		echo "  Language pack will be empty!"; \
		echo "  Expected: ./i18n/$(PO_NAME).zh-cn.lmo"; \
		ls -la ./i18n/ 2>/dev/null || echo "  (i18n directory does not exist)"; \
	fi
endef

# ============================================================
# 安装主包
# ============================================================
define Package/luci-app-udp-tunnel/install
	# ACL 权限配置
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	if [ -d ./root/usr/share/rpcd/acl.d ]; then \
		$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/*.json $(1)/usr/share/rpcd/acl.d/ 2>/dev/null || true; \
	fi
	
	# LuCI 控制器 (JS) - 新版 LuCI 路径
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/udp2raw
	if [ -d ./htdocs/luci-static/resources/view/udp2raw ]; then \
		$(INSTALL_DATA) ./htdocs/luci-static/resources/view/udp2raw/*.js $(1)/www/luci-static/resources/view/udp2raw/ 2>/dev/null || true; \
	fi
	
	# LuCI 菜单配置
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	if [ -d ./root/usr/share/luci/menu.d ]; then \
		$(INSTALL_DATA) ./root/usr/share/luci/menu.d/*.json $(1)/usr/share/luci/menu.d/ 2>/dev/null || true; \
	fi
	
	# uci-defaults 首次安装脚本（用于 LuCI 缓存清理等）
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	if [ -f ./root/etc/uci-defaults/40_luci-udp-tunnel ]; then \
		$(INSTALL_BIN) ./root/etc/uci-defaults/40_luci-udp-tunnel $(1)/etc/uci-defaults/40_luci-udp-tunnel; \
	fi
endef

define Package/luci-app-udp-tunnel/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/rpcd restart 2>/dev/null || true
	rm -rf /tmp/luci-* 2>/dev/null || true
}
exit 0
endef

$(eval $(call BuildPackage,luci-app-udp-tunnel))

# ============================================================
# 语言包定义 - 简体中文 (zh-cn)
# ============================================================
define Package/luci-i18n-udp-tunnel-zh-cn
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=Translations
  TITLE:=luci-app-udp-tunnel - zh-cn translation
  DEPENDS:=+luci-app-udp-tunnel
  PKGARCH:=all
endef

define Package/luci-i18n-udp-tunnel-zh-cn/description
  Simplified Chinese (zh-cn) translation for luci-app-udp-tunnel.
endef

# ============================================================
# 安装语言包 - 直接安装预编译的 LMO 文件
# ============================================================
define Package/luci-i18n-udp-tunnel-zh-cn/install
	# 创建目录（兼容新旧 LuCI）
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	$(INSTALL_DIR) $(1)/usr/share/luci/i18n
	
	# 安装预编译的 LMO 文件
	@echo "Installing pre-compiled LMO file..."
	@if [ -f ./i18n/$(PO_NAME).zh-cn.lmo ]; then \
		echo "✓ Installing from: ./i18n/$(PO_NAME).zh-cn.lmo"; \
		$(INSTALL_DATA) ./i18n/$(PO_NAME).zh-cn.lmo $(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		$(INSTALL_DATA) ./i18n/$(PO_NAME).zh-cn.lmo $(1)/usr/share/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		echo "✓ LMO installed to both paths"; \
	else \
		echo ""; \
		echo "╔══════════════════════════════════════════════════════════════╗"; \
		echo "║  ERROR: Pre-compiled LMO file not found!                     ║"; \
		echo "║                                                              ║"; \
		echo "║  Expected: ./i18n/$(PO_NAME).zh-cn.lmo                       ║"; \
		echo "║                                                              ║"; \
		echo "║  The LMO file should be pre-compiled by the CI/CD workflow.  ║"; \
		echo "║  Language pack will be EMPTY - translations won't work!      ║"; \
		echo "╚══════════════════════════════════════════════════════════════╝"; \
		echo ""; \
		echo "Creating empty placeholder..."; \
		touch $(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		touch $(1)/usr/share/luci/i18n/$(PO_NAME).zh-cn.lmo; \
	fi
endef

$(eval $(call BuildPackage,luci-i18n-udp-tunnel-zh-cn))
