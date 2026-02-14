# 七牛（S3）前端 + AWS EC2 后端：手动更新后端地址（build-time）

场景：前端部署在七牛静态站点，后端部署在 AWS EC2。

由于 EC2 公网 IP 可能变化，本方案选择 **每次 IP 变化后手动更新并重新 build 前端**。

---

## 1) 设置后端地址（Vite 环境变量）

在 `mahjong-frontend` 根目录创建/修改：

`.env.production`

```bash
VITE_SERVER_URL=http://<EC2 公网 IP>:5174
```

> 注意：不要写 `localhost`，浏览器端会连到用户自己的电脑。

---

## 2) 构建并上传到七牛

```bash
npm ci
npm run build
```

把 `dist/` 目录上传到七牛对应的静态站点。

---

## 3) 当 EC2 IP 变化时怎么做

1. 更新 `.env.production` 里的 `VITE_SERVER_URL`
2. 重新 `npm run build`
3. 重新上传 `dist/` 到七牛

---

## 4) 常见坑

- AWS 安全组需要放行 `5174/tcp`（以及前端站点端口/域名本身）。
- CORS：后端已启用 `cors({ origin: true })`，一般可直接跨域连接。
