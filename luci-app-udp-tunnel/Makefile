# Copyright (C) 2024 iHub-2020
#
# This is free software, licensed under the MIT License.
#
# Project: LuCI Support for UDP Tunnel Manager
# Description: Web interface for udp2raw tunnel configuration
# Version: 1.4.0
# Last Updated: 2026-01-10
# Depends: udp2raw (>= 20230206.0)
#
# Changelog:
#   v1.4.0 - Sync version with JS files
#          - Strictly removed conflicting config/init files
#   v1.2.0 - Fixed translation loading issues
#          - Fixed language code (zh_Hans -> zh-cn)
#          - Fixed LMO installation path for new LuCI JS

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-udp-tunnel
PKG_VERSION:=1.4.0
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

define Build/Compile
	# 编译 PO 文件为 LMO 格式
	mkdir -p $(PKG_BUILD_DIR)/i18n
	# 处理 zh_Hans 目录，生成 zh-cn.lmo 文件
	if [ -f ./po/zh_Hans/$(PO_NAME).po ]; then \
		$(TOPDIR)/staging_dir/host/bin/po2lmo \
			./po/zh_Hans/$(PO_NAME).po \
			$(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo 2>/dev/null || \
		echo "[WARN] po2lmo failed for zh_Hans, trying alternative..."; \
	fi
	# 备用：如果存在 zh-cn 目录
	if [ -f ./po/zh-cn/$(PO_NAME).po ]; then \
		$(TOPDIR)/staging_dir/host/bin/po2lmo \
			./po/zh-cn/$(PO_NAME).po \
			$(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo 2>/dev/null || true; \
	fi
endef

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
	# 新版 LuCI (JS) 翻译文件路径
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	# 同时安装到新旧两个路径，确保兼容性
	$(INSTALL_DIR) $(1)/usr/share/luci/i18n
	
	# 从编译目录安装
	if [ -f $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo ]; then \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo \
			$(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo; \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo \
			$(1)/usr/share/luci/i18n/$(PO_NAME).zh-cn.lmo; \
	fi
	
	# 备用：直接从源码编译
	if [ ! -f $(PKG_BUILD_DIR)/i18n/$(PO_NAME).zh-cn.lmo ]; then \
		if [ -f ./po/zh_Hans/$(PO_NAME).po ]; then \
			$(TOPDIR)/staging_dir/host/bin/po2lmo \
				./po/zh_Hans/$(PO_NAME).po \
				$(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo 2>/dev/null || true; \
			cp $(1)/usr/lib/lua/luci/i18n/$(PO_NAME).zh-cn.lmo \
				$(1)/usr/share/luci/i18n/$(PO_NAME).zh-cn.lmo 2>/dev/null || true; \
		fi; \
	fi
endef

$(eval $(call BuildPackage,luci-i18n-udp-tunnel-zh-cn))
