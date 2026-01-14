# Copyright (C) 2024 iHub-2020
#
# This is free software, licensed under the MIT License.
#
# Project: LuCI Support for UDP Tunnel Manager
# Description: Web interface for udp2raw tunnel configuration
# Version: 1.6.0
# Last Updated: 2026-01-14
# Depends: udp2raw (>= 20230206.0)
#
# Changelog:
#   v1.6.0 - Enhanced po2lmo detection with better error messages
#          - Added verification step to ensure LMO is generated
#   v1.5.3 - Fixed po2lmo path for OpenWrt 23.05 SDK
#          - Added multiple fallback paths for po2lmo
#          - Retained all error handling from v1.4.0
#   v1.4.0 - Sync version with JS files
#          - Strictly removed conflicting config/init files
#   v1.2.0 - Fixed translation loading issues
#          - Fixed language code (zh_Hans -> zh-cn)
#          - Fixed LMO installation path for new LuCI JS

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp-tunnel
PKG_VERSION:=1.6.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=iHub-2020

# 语言包相关变量
# 注意：目录使用 zh_Hans，但 OpenWrt 标准语言代码是 zh-cn
PO_NAME:=udp-tunnel
LUCI_LANGUAGES:=zh_Hans

include $(INCLUDE_DIR)/package.mk

# ============================================================
# 主包定义
# ============================================================
define Package/luci-app-udp-tunnel
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for UDP Tunnel Manager
  # 依赖说明：
  #   +udp2raw: 核心隧道程序（提供 /etc/init.d/udp2raw 和 /etc/config/udp2raw）
  #   +luci-base: LuCI 基础框架
  # 注意：init.d 和 config 文件由 udp2raw 包提供，此包不再重复安装
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
# 编译阶段 - 生成 LMO 翻译文件
# ============================================================
define Build/Compile
	# ============================================================
	# 编译 PO 文件为 LMO 格式
	# po2lmo 是 LuCI 的翻译工具，将 .po 文件转换为 .lmo 二进制格式
	# ============================================================
	mkdir -p $(PKG_BUILD_DIR)/i18n
	
	@echo "=== Searching for po2lmo tool ==="
	
	# 查找 po2lmo 工具（OpenWrt 23.05 SDK 可能在不同位置）
	PO2LMO=""; \
	for p in \
		$(STAGING_DIR_HOST)/bin/po2lmo \
		$(STAGING_DIR_HOSTPKG)/bin/po2lmo \
		$(TOPDIR)/staging_dir/host/bin/po2lmo \
		$(TOPDIR)/staging_dir/hostpkg/bin/po2lmo \
		$$(which po2lmo 2>/dev/null); do \
		if [ -x "$$p" ]; then \
			PO2LMO="$$p"; \
			echo "✓ Found po2lmo: $$p"; \
			break; \
		fi; \
	done; \
	\
	if [ -z "$$PO2LMO" ]; then \
		echo ""; \
		echo "╔══════════════════════════════════════════════════════════════╗"; \
		echo "║  ERROR: po2lmo tool not found!                               ║"; \
		echo "║                                                              ║"; \
		echo "║  The language pack will be EMPTY without this tool.          ║"; \
		echo "║                                                              ║"; \
		echo "║  To fix, run one of:                                         ║"; \
		echo "║    make package/luci-base/host/compile                       ║"; \
		echo "║  Or manually compile from feeds/luci/modules/luci-base/src   ║"; \
		echo "╚══════════════════════════════════════════════════════════════╝"; \
		echo ""; \
		echo "[DEBUG] Searched paths:"; \
		echo "  - $(STAGING_DIR_HOST)/bin/po2lmo"; \
		echo "  - $(STAGING_DIR_HOSTPKG)/bin/po2lmo"; \
		echo "  - $(TOPDIR)/staging_dir/host/bin/po2lmo"; \
		ls -la $(STAGING_DIR_HOST)/bin/ 2>/dev/null | head -20 || echo "  (directory not found)"; \
	elif [ ! -f ./po/zh_Hans/$(PO_NAME).po ]; then \
		echo ""; \
		echo "[ERROR] PO file not found: ./po/zh_Hans/$(PO_NAME).po"; \
		echo ""; \
		ls -la ./po/ 2>/dev/null || echo "po directory not found"; \
		ls -la ./po/zh_Hans/ 2>/dev/null || echo "po/zh_Hans directory not found"; \
	else \
		echo "=== Compiling translation: zh_Hans -> zh-cn ==="; \
		$$PO2LMO ./po/zh_Hans/$(PO_NAME).po \
			$(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo; \
		\
		if [ -f $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo ]; then \
			LMO_SIZE=$$(ls -la $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo | awk '{print $$5}'); \
			echo "✓ Successfully compiled zh-cn translation"; \
			echo "  Output: $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo"; \
			echo "  Size: $$LMO_SIZE bytes"; \
			if [ "$$LMO_SIZE" -lt 100 ]; then \
				echo "⚠ WARNING: LMO file seems too small, translation may be incomplete"; \
			fi; \
		else \
			echo "[ERROR] po2lmo failed - LMO file not created"; \
		fi; \
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
	
	# 关键修正：严禁在此处安装 /etc/config/udp2raw 和 /etc/init.d/udp2raw
	# 这些文件必须由 udp2raw 核心包提供，否则会导致 opkg 安装冲突
endef

define Package/luci-app-udp-tunnel/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	# 重启 rpcd 以加载新的 ACL
	/etc/init.d/rpcd restart 2>/dev/null || true
	# 清除 LuCI 缓存
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

define Package/luci-i18n-udp-tunnel-zh-cn/install
	# ============================================================
	# 安装 LMO 翻译文件
	# 新版 LuCI (JS): /usr/share/luci/i18n/
	# 旧版 LuCI (Lua): /usr/lib/lua/luci/i18n/
	# ============================================================
	
	# 创建两个目录，确保兼容新旧版本
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	$(INSTALL_DIR) $(1)/usr/share/luci/i18n
	
	# 方案1：从编译目录安装已编译的 LMO
	@if [ -f $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo ]; then \
		echo "Installing pre-compiled LMO from build directory..."; \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo \
			$(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo \
			$(1)/usr/share/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		echo "✓ Installed pre-compiled LMO"; \
		ls -la $(1)/usr/lib/lua/luci/i18n/; \
		ls -la $(1)/usr/share/luci/i18n/; \
	else \
		echo ""; \
		echo "╔══════════════════════════════════════════════════════════════╗"; \
		echo "║  WARNING: No pre-compiled LMO found!                         ║"; \
		echo "║                                                              ║"; \
		echo "║  The language pack will be EMPTY.                            ║"; \
		echo "║  Translation will NOT work.                                  ║"; \
		echo "║                                                              ║"; \
		echo "║  Please ensure po2lmo is available before compilation.       ║"; \
		echo "╚══════════════════════════════════════════════════════════════╝"; \
		echo ""; \
		echo "[DEBUG] Expected file: $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo"; \
		ls -la $(PKG_BUILD_DIR)/i18n/ 2>/dev/null || echo "Build i18n directory not found"; \
		\
		echo "Attempting fallback compilation..."; \
		PO2LMO=""; \
		for p in \
			$(STAGING_DIR_HOST)/bin/po2lmo \
			$(STAGING_DIR_HOSTPKG)/bin/po2lmo \
			$(TOPDIR)/staging_dir/host/bin/po2lmo \
			$(TOPDIR)/staging_dir/hostpkg/bin/po2lmo \
			$$(which po2lmo 2>/dev/null); do \
			if [ -x "$$p" ]; then \
				PO2LMO="$$p"; \
				break; \
			fi; \
		done; \
		if [ -n "$$PO2LMO" ] && [ -f ./po/zh_Hans/$(PO_NAME).po ]; then \
			$$PO2LMO ./po/zh_Hans/$(PO_NAME).po \
				$(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo 2>/dev/null && \
			cp $(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo \
				$(1)/usr/share/luci/i18n/$(PO_NAME).zh-cn.lmo 2>/dev/null && \
			echo "✓ Fallback compilation successful" || \
			echo "[ERROR] Fallback compilation failed"; \
		else \
			echo "[ERROR] po2lmo not available and no pre-compiled LMO"; \
			echo "Creating empty placeholder (translation will NOT work)"; \
			touch $(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo; \
			touch $(1)/usr/share/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		fi; \
	fi
endef

$(eval $(call BuildPackage,luci-i18n-udp-tunnel-zh-cn))
