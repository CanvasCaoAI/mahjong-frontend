# 七牛（S3）前端 + AWS EC2 后端：动态 serverUrl 配置

当后端运行在 EC2 上且公网 IP 可能变化时，不要在前端写死 IP。

本项目支持从 `config.json` 读取后端地址。

---

## 1) 在七牛静态站点根目录放置 config.json

路径：
- `https://<你的前端域名>/config.json`

内容示例：

```json
{
  "serverUrl": "http://<EC2 公网 IP>:5174"
}
```

当 EC2 IP 变化时，只需要更新这个 `config.json` 文件即可（无需重新 build 前端）。

---

## 2) 前端选择后端地址的优先级

前端会按以下优先级选择后端地址：

1. URL 参数 `?server=http://...`
2. `window.__MAHJONG_SERVER_URL__`（如有注入）
3. `/config.json` 的 `serverUrl`
4. fallback：`http(s)://<当前页面host>:5174`（仅用于本地开发）

---

## 3) 常见坑

- `serverUrl` 必须是浏览器可访问的公网地址（不能写 `localhost`）。
- 需要在 AWS 安全组放行 `5174/tcp`。
- 线上建议把 `config.json` 设置为不缓存或短缓存；前端代码会用 `?t=<timestamp>` 做 cache-bust。
