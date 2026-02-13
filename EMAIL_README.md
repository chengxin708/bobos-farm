# Email Notification System

## 功能概述

Bobos Farm 邮件通知系统提供以下功能：

1. **预约确认邮件** - 用户创建预约后自动发送确认邮件
2. **预约提醒邮件** - 提前1天自动发送提醒邮件
3. **邮箱验证邮件** - 用户注册时发送验证链接

## 配置步骤

### 1. 配置环境变量

复制 `.env.example` 到 `.env.local` 并填入配置：

```bash
cp .env.example .env.local
```

#### Gmail SMTP 配置

1. 前往 Google 账户 → 安全 → 两步验证 (开启)
2. 前往 Google 账户 → 安全 → 应用密码 (创建新密码)
3. 使用生成的应用密码作为 `EMAIL_PASS`

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
```

#### Mailgun 配置 (可选)

```
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=your-domain.mailgun.org
```

### 2. 配置 Cron Job (可选)

要自动发送预约提醒，需要配置定时任务：

#### Vercel Cron (推荐)

在 `vercel.json` 中添加：

```json
{
  "crons": [
    {
      "path": "/api/cron/bookings-reminder",
      "schedule": "0 9 * * *"
    }
  ]
}
```

这会在每天早上 9:00 自动执行提醒任务。

#### 外部 Cron 服务

可以使用外部服务（如 cron-job.org）每天调用：

```
POST https://your-domain.com/api/cron/bookings-reminder
Headers: x-cron-secret: your-cron-secret
```

## API 端点

### 创建预约 (已集成邮件)

```bash
POST /api/bookings
Authorization: Bearer <token>
Body: {
  "yurt_id": "xxx",
  "date": "2026-02-15",
  "time": "afternoon"
}
```

响应中会包含 `emailSent: true`。

### 手动触发提醒 (测试用)

```bash
POST /api/cron/bookings-reminder
Headers: x-cron-secret: your-cron-secret
```

### 邮箱验证

```bash
POST /api/auth/register
Body: {
  "email": "user@example.com",
  "password": "password"
}
```

## 邮件模板

### 1. 预约确认邮件 (EN/CN)

- 包含预约 ID、蒙古包名称、日期、时间
- 状态显示 (pending/confirmed)
- 精美的 HTML 模板

### 2. 预约提醒邮件 (EN/CN)

- 提前1天发送
- 突出显示明日行程
- 提醒用户准时到达

## 开发说明

### 本地测试

1. 不配置 `EMAIL_USER` 和 `EMAIL_PASS` 时，邮件会在控制台模拟输出
2. 可以在 `/api/cron/bookings-reminder` 页面手动触发

### 测试预约提醒

```bash
# 创建明天日期的预约进行测试
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "yurt_id": "xxx",
    "date": "2026-02-14",
    "time": "afternoon"
  }'

# 手动触发提醒
curl -X POST http://localhost:3000/api/cron/bookings-reminder
```

## 文件结构

```
src/
├── lib/
│   └── email.ts          # 邮件发送核心逻辑
└── app/
    └── api/
        ├── bookings/
        │   └── route.ts  # 已集成确认邮件
        └── cron/
            └── bookings-reminder/
                └── route.ts  # 定时提醒任务
```
