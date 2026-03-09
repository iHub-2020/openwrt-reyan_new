# luci-app-udp2raw

> 规范名称：`luci-app-udp2raw`  
> 底层核心项目：`udp2raw`  
> 对应 Docker 项目：`docker-app-udp2raw`

`luci-app-udp2raw` 是 OpenWrt / LuCI 侧的 `udp2raw` 管理界面，用于配置服务端 / 客户端实例、查看运行状态与诊断信息。

## 安装

```bash
opkg update
opkg install udp2raw
opkg install luci-app-udp2raw
```

## 功能

- 多实例配置（服务端 / 客户端）
- 实时运行状态与日志查看
- iptables 规则与核心二进制诊断
- OpenWrt 环境下的配置持久化与服务控制

## 命名说明

本插件历史上曾命名为 `luci-app-udp-tunnel`。为了与底层核心项目保持一致，现统一更名为：

- LuCI 插件：`luci-app-udp2raw`
- 核心后端：`udp2raw`
- Docker 项目：`docker-app-udp2raw`
