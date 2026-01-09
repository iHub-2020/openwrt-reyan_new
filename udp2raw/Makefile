# SPDX-License-Identifier: MIT
#
# Copyright (c) 2026 reyanmatic <yanmaticyan@gmail.com>
#
# Updated by reyanmatic on 2026-01-09
# - Synced with latest udp2raw unified branch (git 4623f878e0)
# - Updated build configuration for OpenWrt 23.05+
# - Enhanced dependency management

include $(TOPDIR)/rules.mk

PKG_NAME:=udp2raw
PKG_VERSION:=20230206.0
PKG_RELEASE:=2

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/wangyu-/udp2raw.git
PKG_SOURCE_VERSION:=4623f878e0
PKG_SOURCE_DATE:=2024-11-03
PKG_MIRROR_HASH:=skip

# 备用：使用 release tarball
# PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
# PKG_SOURCE_URL:=https://codeload.github.com/wangyu-/udp2raw/tar.gz/$(PKG_VERSION)?
# PKG_HASH:=1e459020654d3c65acb252a56fe11a5e2feec5a64d6e2ffd0aacc14213bbc9c0

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=reyanmatic <yanmaticyan@gmail.com>

PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=gc-sections lto

include $(INCLUDE_DIR)/package.mk

define Package/udp2raw
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=VPN
  TITLE:=Tunnel UDP into Encrypted FakeTCP/UDP/ICMP Traffic
  URL:=https://github.com/wangyu-/udp2raw
  DEPENDS:=+libstdcpp +libpthread +librt @!arc
  PROVIDES:=udp2raw-tunnel
endef

define Package/udp2raw/description
  udp2raw-tunnel turns UDP traffic into encrypted FakeTCP/UDP/ICMP traffic
  by using raw socket. It helps you bypass UDP blocking/QoS and unstable
  UDP environment. Supports encryption (AES-128), anti-replay, connection
  recovery and multiplexing.
  
  Updated Features (2024):
  - Enhanced --fix-gro option for large packet handling
  - Improved --retry-on-error for startup scripts
  - Better cipher mode support (aes128cbc, aes128cfb)
  - Connection stability improvements
endef

define Package/udp2raw/conffiles
/etc/config/udp2raw
endef

# 编译标志优化
TARGET_CXXFLAGS += -std=c++11 -Wall -Wextra -Wno-unused-parameter
TARGET_CXXFLAGS += -DNDEBUG -ffunction-sections -fdata-sections
TARGET_LDFLAGS += -Wl,--gc-sections -lpthread -lrt

MAKE_FLAGS += cross

define Build/Prepare
	$(PKG_UNPACK)
	# 修改 Makefile 指向正确的交叉编译器
	$(SED) 's|cc_cross=.*|cc_cross=$(TARGET_CXX)|g' $(PKG_BUILD_DIR)/makefile
	# 移除 git version 自动检测
	$(SED) '/\*gitversion/d' $(PKG_BUILD_DIR)/makefile
	# 创建版本信息文件
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
	
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/udp2raw.config $(1)/etc/config/udp2raw
	
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/udp2raw.init $(1)/etc/init.d/udp2raw
endef

define Package/udp2raw/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	echo "udp2raw installed successfully!"
	echo "Configure via: /etc/config/udp2raw"
	echo "Start service: /etc/init.d/udp2raw start"
	echo "Enable on boot: /etc/init.d/udp2raw enable"
}
exit 0
endef

$(eval $(call BuildPackage,udp2raw))
