# PWA

本项目已启用 PWA（vite-plugin-pwa）。

## 线上要求

- 必须使用 HTTPS（你的网站是 https，满足）
- 部署在子目录（例如 `/majiang/`）也可用：manifest/scope/start_url 均为相对路径 `./`

## 生成内容

`npm run build` 会在 `dist/` 生成：

- `manifest.webmanifest`
- `sw.js`（Service Worker）
- `workbox-*.js`

上传 `dist/` 到静态站点即可。

## 图标

目前使用牌面 `m5.png` 生成 PWA 图标：

- `public/pwa/icon-192.png`
- `public/pwa/icon-512.png`

你想换图标的话，把这两个文件替换成你要的 PNG（尺寸分别 192/512）。
