# luci-app-udpspeeder

> 规范名称：`luci-app-udpspeeder`  
> 底层核心项目：`udpspeeder`  
> 对应 Docker 项目：`docker-app-udpspeeder`

该目录用于承接 `udpspeeder` 的 LuCI 插件命名规范。当前仓库中仍以核心后端包 `udpspeeder/` 为主，后续新增 LuCI 前端时，统一使用：

- LuCI 插件：`luci-app-udpspeeder`
- Docker 项目：`docker-app-udpspeeder`
- 核心后端：`udpspeeder`

## 说明

本目录由历史名称 `luci-app-udp-speeder` 规范化而来，用于防止与其他 UDP 隧道类项目混淆。
