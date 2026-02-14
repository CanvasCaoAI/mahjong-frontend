# mahjong-frontend

## Build（用于七牛静态部署）

### 1) 配置后端地址

在项目根目录创建/修改：

`.env.production`

```bash
VITE_SERVER_URL=http://<EC2 公网 IP>:5174
```

### 2) 构建

```bash
npm ci
npm run build
```

将 `dist/` 上传到七牛。

## 本地开发

```bash
npm i
npm run dev
```

本地后端默认：`http://localhost:5174`
