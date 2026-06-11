# 家庭服务器部署

这份部署方式把 NestJS API 和 MySQL 都交给 Docker Compose 管理，适合放在 NAS、迷你主机、Linux 家庭服务器或 Windows Server + Docker Desktop 上长期运行。

## 1. 准备服务器

服务器需要安装：

- Docker
- Docker Compose v2
- Git

如果你要让微信小程序或公网客户端访问，还需要准备：

- 一个域名，例如 `api.example.com`
- 路由器端口转发到服务器的 80/443，或转发到 API 端口 `8721`
- Nginx、Caddy、OpenResty 任选一个做 HTTPS 反向代理

## 2. 上传代码

在服务器上拉取代码：

```bash
git clone <your-repo-url> bill-server
cd bill-server
```

如果你是手动拷贝项目，请不要拷贝 `node_modules`、`dist` 和本机 `.env`。

## 3. 创建生产环境变量

```bash
cp .env.home.example .env.home
```

然后编辑 `.env.home`，至少修改这些值：

```env
DB_PASSWORD=换成强密码
JWT_SECRET=换成很长的随机字符串
WX_APPID=你的小程序 appid
WX_SECRET=你的小程序 secret
```

如果暂时只在局域网访问，可以保留：

```env
API_BIND_HOST=0.0.0.0
PORT=8721
```

如果你只想让本机 Nginx 访问 API，不想直接暴露 API 端口，可以改成：

```env
API_BIND_HOST=127.0.0.1
```

## 4. 启动服务

```bash
docker compose --env-file .env.home -f docker-compose.home.yml up -d --build
```

查看运行状态：

```bash
docker compose --env-file .env.home -f docker-compose.home.yml ps
```

查看日志：

```bash
docker compose --env-file .env.home -f docker-compose.home.yml logs -f api
docker compose --env-file .env.home -f docker-compose.home.yml logs -f mysql
```

健康检查：

```bash
curl http://127.0.0.1:8721/api/health
```

正常会返回：

```json
{"code":0,"data":{"status":"ok","timestamp":"2026-06-11T00:00:00.000Z"},"message":"success"}
```

## 5. 配置反向代理

如果你使用 Nginx，可以参考 `deploy/nginx/api.jingqiu.top.conf`，核心代理目标是：

```nginx
proxy_pass http://127.0.0.1:8721;
```

如果使用 Caddy，示例：

```caddyfile
api.example.com {
  reverse_proxy 127.0.0.1:8721
}
```

配置好 HTTPS 后，接口地址就是：

```text
https://api.example.com/api/health
```

## 6. 更新程序

```bash
git pull
docker compose --env-file .env.home -f docker-compose.home.yml up -d --build
```

## 7. 备份数据库

创建备份：

```bash
docker compose --env-file .env.home -f docker-compose.home.yml exec mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > bill_db_backup.sql
```

恢复备份：

```bash
docker compose --env-file .env.home -f docker-compose.home.yml exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < bill_db_backup.sql
```

## 常用排查

- `api` 一直重启：先看 `docker compose --env-file .env.home -f docker-compose.home.yml logs -f api`。
- MySQL 首次启动失败：删除空的坏卷后再启动，命令是 `docker volume rm billserver_mysql_home_data`。只有确认没有真实数据时才能这么做。
- 局域网访问不了：检查服务器防火墙是否放行 `8721`，以及 `.env.home` 里的 `API_BIND_HOST` 是否为 `0.0.0.0`。
- 公网访问不了：检查域名解析、路由器端口转发、HTTPS 证书和反向代理配置。
