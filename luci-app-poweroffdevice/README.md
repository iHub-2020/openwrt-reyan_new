## 使用说明

将poweroffdevice关机功能 添加至 LEDE/OpenWRT 源码的二种方法。

## 使用关机功能方法一：
标准方法使用关机插件。

 ```Brach
    # 下载源码
    
    git clone https://github.com/sirpdboy/luci-app-poweroffdevice package/luci-app-poweroffdevice
    
    make menuconfig
 ``` 
 ```Brach
    # 配置菜单
    make menuconfig
	# 找到 LuCI -> Applications, 选择 luci-app-poweroffdevice, 保存后退出。
 ``` 
 ```Brach 
    # 编译固件
    make package/luci-app-poweroffdevice/{clean,compile} V=s
 ```
## 使用关机功能方法二【推荐此方法】：
系统的源码上修改，集成到系统源码菜单中，不需要另外选择和设置即可使用关机功能
 ```Brach 
    #在编译前,运行如下二条命令，集成到系统源码菜单中，不需要另外选择和设置即可使用关机功能。
	cd openwrt #进入源码目录
    curl -fsSL  https://raw.githubusercontent.com/sirpdboy/other/master/patch/poweroff/poweroff.htm > ./feeds/luci/modules/luci-mod-admin-full/luasrc/view/admin_system/poweroff.htm 
    curl -fsSL  https://raw.githubusercontent.com/sirpdboy/other/master/patch/poweroff/system.lua > ./feeds/luci/modules/luci-mod-admin-full/luasrc/controller/admin/system.lua

 ```