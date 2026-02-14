# EC2 部署/启动（Frontend）

目标：在 AWS EC2 上**不使用 Nginx**，手动部署，但进程**崩了自动重启**。

本项目建议在 EC2 使用 **Vite preview**（不要用 dev）。

---

## 0) 前置条件

- EC2 上已安装 Node.js（建议 20+）
- 安装 git
- 安全组放行端口：
  - TCP `5173`（前端）
  - TCP `5174`（后端，socket.io）

> 备注：前端默认会连接 `http(s)://<当前页面host>:5174`。

---

## 1) 手动启动（不守护，不推荐长期）

```bash
cd ~/mahjong-frontend
npm ci
npm run build
npm run preview -- --host 0.0.0.0 --port 5173 --strictPort
```

访问：
- `http://<EC2 公网 IP>:5173/`

---

## 2) systemd 守护（推荐：崩了自动重启 + 开机自启）

### 2.1 创建 service 文件

```bash
sudo tee /etc/systemd/system/mahjong-frontend.service > /dev/null <<'EOF'
[Unit]
Description=mahjong-frontend (vite preview)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/mahjong-frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/env npm run preview -- --host 0.0.0.0 --port 5173 --strictPort
Restart=always
RestartSec=2

# optional: keep logs reasonable
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

把 `User=ubuntu` / `WorkingDirectory=` 改成你实际的用户名和路径。

### 2.2 启用/启动

```bash
sudo systemctl daemon-reload
sudo systemctl enable mahjong-frontend
sudo systemctl restart mahjong-frontend
sudo systemctl status mahjong-frontend --no-pager
```

### 2.3 查看日志

```bash
journalctl -u mahjong-frontend -f
```

---

## 3) 更新代码（手动部署流程）

```bash
cd ~/mahjong-frontend
git pull
npm ci
npm run build
sudo systemctl restart mahjong-frontend
```
