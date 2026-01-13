# Copyright (C) 2024 iHub-2020
#
# This is free software, licensed under the MIT License.
#
# Project: LuCI Support for UDP Tunnel Manager
# Description: Web interface for udp2raw tunnel configuration
# Version: 1.5.0
# Last Updated: 2026-01-14
# Depends: udp2raw (>= 20230206.0)
#
# Changelog:
#   v1.5.0 - Fixed translation compilation path issues
#          - Fixed po2lmo source path reference
#   v1.4.0 - Sync version with JS files
#          - Strictly removed conflicting config/init files
#   v1.2.0 - Fixed translation loading issues
#          - Fixed language code (zh_Hans -> zh-cn)
#          - Fixed LMO installation path for new LuCI JS

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp-tunnel
PKG_VERSION:=1.5.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=iHub-2020

LUCI_TITLE:=LuCI support for UDP Tunnel Manager
LUCI_DEPENDS:=+udp2raw +luci-base
LUCI_PKGARCH:=all

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
# 准备源码到构建目录
# ============================================================
define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./htdocs $(PKG_BUILD_DIR)/ 2>/dev/null || true
	$(CP) ./root $(PKG_BUILD_DIR)/ 2>/dev/null || true
	$(CP) ./po $(PKG_BUILD_DIR)/ 2>/dev/null || true
endef

# ============================================================
# 编译翻译文件
# ============================================================
define Build/Compile
	# 创建 i18n 输出目录
	mkdir -p $(PKG_BUILD_DIR)/i18n
	
	# 查找 po2lmo 工具
	PO2LMO=$$(find $(STAGING_DIR_HOST) -name 'po2lmo' -type f 2>/dev/null | head -1); \
	if [ -z "$$PO2LMO" ]; then \
		PO2LMO="$(STAGING_DIR_HOST)/bin/po2lmo"; \
	fi; \
	echo "Using po2lmo: $$PO2LMO"; \
	\
	# 编译 zh_Hans 目录
	if [ -f $(PKG_BUILD_DIR)/po/zh_Hans/$(PO_NAME).po ]; then \
		echo "Compiling zh_Hans translation..."; \
		$$PO2LMO $(PKG_BUILD_DIR)/po/zh_Hans/$(PO_NAME).po \
			$(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo; \
		echo "Created: $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo"; \
		ls -la $(PKG_BUILD_DIR)/i18n/; \
	else \
		echo "[WARN] PO file not found: $(PKG_BUILD_DIR)/po/zh_Hans/$(PO_NAME).po"; \
		ls -la $(PKG_BUILD_DIR)/po/ 2>/dev/null || echo "po directory not found"; \
	fi
endef

# ============================================================
# 安装主包
# ============================================================
define Package/luci-app-udp-tunnel/install
	# ACL 权限配置
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	if [ -d $(PKG_BUILD_DIR)/root/usr/share/rpcd/acl.d ]; then \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/root/usr/share/rpcd/acl.d/*.json \
			$(1)/usr/share/rpcd/acl.d/ 2>/dev/null || true; \
	fi
	
	# LuCI 控制器 (JS)
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/udp2raw
	if [ -d $(PKG_BUILD_DIR)/htdocs/luci-static/resources/view/udp2raw ]; then \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/htdocs/luci-static/resources/view/udp2raw/*.js \
			$(1)/www/luci-static/resources/view/udp2raw/ 2>/dev/null || true; \
	fi
	
	# LuCI 菜单配置
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	if [ -d $(PKG_BUILD_DIR)/root/usr/share/luci/menu.d ]; then \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/root/usr/share/luci/menu.d/*.json \
			$(1)/usr/share/luci/menu.d/ 2>/dev/null || true; \
	fi
	
	# uci-defaults 首次安装脚本
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	if [ -f $(PKG_BUILD_DIR)/root/etc/uci-defaults/40_luci-udp-tunnel ]; then \
		$(INSTALL_BIN) $(PKG_BUILD_DIR)/root/etc/uci-defaults/40_luci-udp-tunnel \
			$(1)/etc/uci-defaults/40_luci-udp-tunnel; \
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

define Package/luci-i18n-udp-tunnel-zh-cn/install
	# 安装到两个路径确保兼容性
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	$(INSTALL_DIR) $(1)/usr/share/luci/i18n
	
	# 从编译目录安装 LMO 文件
	if [ -f $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo ]; then \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo \
			$(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo \
			$(1)/usr/share/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		echo "Installed LMO to both paths"; \
	else \
		echo "[ERROR] LMO file not found: $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo"; \
		exit 1; \
	fi
endef

$(eval $(call BuildPackage,luci-i18n-udp-tunnel-zh-cn))
