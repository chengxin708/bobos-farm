# Bobos Farm Booking System

## 完成的功能

### 1. 数据库表结构 (`src/lib/schema.sql`)
- **yurts** 表：存储蒙古包信息（白/红/黄）
- **bookings** 表：存储预约信息

### 2. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/yurts` | GET | 获取蒙古包列表 |
| `/api/bookings/available` | GET | 查询可用时间（参数：yurt_id, date） |
| `/api/bookings` | POST | 创建预约（需登录） |
| `/api/bookings/my` | GET | 获取当前用户的预约列表（需登录） |
| `/api/bookings/[id]/confirm` | POST | 确认预约（管理员） |

### 3. 前端页面

| 页面 | 功能 |
|------|------|
| `/yurts` | 蒙古包介绍页，展示白/红/黄三种蒙古包 |
| `/book/new` | 预约选择页，选择蒙古包、日期、时间段 |
| `/book/[id]` | 预约详情页，查看预约状态 |
| `/my-bookings` | 我的预约页，列出所有预约 |

## 数据库初始化

需要先在 Vercel Postgres 或本地 PostgreSQL 中执行以下 SQL：

```sql
-- Create yurts table
CREATE TABLE IF NOT EXISTS yurts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 4,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  yurt_id INTEGER NOT NULL,
  booking_date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (yurt_id) REFERENCES yurts(id)
);

-- Insert default yurts
INSERT INTO yurts (name, color, description, capacity, price) VALUES
  ('White Yurt', 'white', 'A peaceful white蒙古包...', 4, 288),
  ('Red Yurt', 'red', 'An energetic red蒙古包...', 6, 388),
  ('Yellow Yurt', 'yellow', 'A warm yellow蒙古包...', 2, 198);
```

## 使用说明

1. 配置数据库连接（环境变量 `POSTGRES_URL`）
2. 运行数据库初始化 SQL
3. 启动开发服务器：`npm run dev`
4. 访问相应页面进行预约
