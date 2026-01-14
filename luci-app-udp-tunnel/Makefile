# Copyright (C) 2024 iHub-2020
#
# This is free software, licensed under the MIT License.
#
# Project: LuCI Support for UDP Tunnel Manager
# Version: 1.5.2
# Last Updated: 2026-01-14
#
# Changelog:
#   v1.5.2 - Fixed po2lmo path detection for CI environment
#   v1.4.0 - Working version

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp-tunnel
PKG_VERSION:=1.5.2
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=iHub-2020

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
  UDP Tunnel Manager - Web interface for configuring udp2raw tunnels.
endef

define Package/luci-app-udp-tunnel/install
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/*.json $(1)/usr/share/rpcd/acl.d/
	
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/udp2raw
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/udp2raw/*.js $(1)/www/luci-static/resources/view/udp2raw/
	
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/*.json $(1)/usr/share/luci/menu.d/
	
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/40_luci-udp-tunnel $(1)/etc/uci-defaults/
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
# 语言包 - 简体中文
# ============================================================
define Package/luci-i18n-udp-tunnel-zh-cn
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=Translations
  TITLE:=luci-app-udp-tunnel - zh-cn translation
  DEPENDS:=+luci-app-udp-tunnel
  PKGARCH:=all
endef

define Package/luci-i18n-udp-tunnel-zh-cn/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	$(INSTALL_DIR) $(1)/usr/share/luci/i18n
	
	PO2LMO=""; \
	for p in $(STAGING_DIR_HOST)/bin/po2lmo $(STAGING_DIR_HOSTPKG)/bin/po2lmo $(STAGING_DIR)/host/bin/po2lmo $$(which po2lmo 2>/dev/null); do \
		if [ -x "$$p" ]; then PO2LMO="$$p"; break; fi; \
	done; \
	if [ -n "$$PO2LMO" ]; then \
		echo "Using po2lmo: $$PO2LMO"; \
		$$PO2LMO ./po/zh_Hans/$(PO_NAME).po $(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		cp $(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo $(1)/usr/share/luci/i18n/$(PO_NAME).zh-cn.lmo; \
	else \
		echo "ERROR: po2lmo not found!"; \
		echo "Searched: $(STAGING_DIR_HOST)/bin $(STAGING_DIR_HOSTPKG)/bin"; \
		ls -la $(STAGING_DIR_HOST)/bin/ 2>/dev/null || true; \
		ls -la $(STAGING_DIR_HOSTPKG)/bin/ 2>/dev/null || true; \
		exit 1; \
	fi
endef

$(eval $(call BuildPackage,luci-i18n-udp-tunnel-zh-cn))
