CREATE DATABASE IF NOT EXISTS bill_db DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bill_db;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) NOT NULL UNIQUE COMMENT '微信openid',
  unionid VARCHAR(64) DEFAULT NULL COMMENT '微信unionid',
  nickname VARCHAR(50) DEFAULT '新用户' COMMENT '昵称',
  avatar_url VARCHAR(255) DEFAULT '' COMMENT '头像URL',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT DEFAULT NULL COMMENT '用户ID，NULL为系统分类',
  name VARCHAR(50) NOT NULL COMMENT '分类名称',
  icon VARCHAR(50) DEFAULT '' COMMENT '图标标识',
  type ENUM('income', 'expense') NOT NULL COMMENT '类型',
  sort_order INT DEFAULT 0 COMMENT '排序',
  is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统分类',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分类表';

CREATE TABLE IF NOT EXISTS bills (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  category_id BIGINT NOT NULL COMMENT '分类ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '金额',
  type ENUM('income', 'expense') NOT NULL COMMENT '类型',
  remark VARCHAR(200) DEFAULT '' COMMENT '备注',
  bill_date DATE NOT NULL COMMENT '账单日期',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '软删除',
  INDEX idx_user_date (user_id, bill_date),
  INDEX idx_user_deleted (user_id, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账单表';

CREATE TABLE IF NOT EXISTS reminders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  reminder_time TIME NOT NULL COMMENT '提醒时间',
  is_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='提醒表';

INSERT INTO categories (user_id, name, icon, type, sort_order, is_system)
SELECT NULL, '餐饮', 'food', 'expense', 10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = '餐饮' AND type = 'expense');

INSERT INTO categories (user_id, name, icon, type, sort_order, is_system)
SELECT NULL, '交通', 'transport', 'expense', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = '交通' AND type = 'expense');

INSERT INTO categories (user_id, name, icon, type, sort_order, is_system)
SELECT NULL, '购物', 'shopping', 'expense', 30, TRUE
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = '购物' AND type = 'expense');

INSERT INTO categories (user_id, name, icon, type, sort_order, is_system)
SELECT NULL, '住房', 'home', 'expense', 40, TRUE
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = '住房' AND type = 'expense');

INSERT INTO categories (user_id, name, icon, type, sort_order, is_system)
SELECT NULL, '工资', 'salary', 'income', 10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = '工资' AND type = 'income');

INSERT INTO categories (user_id, name, icon, type, sort_order, is_system)
SELECT NULL, '奖金', 'bonus', 'income', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = '奖金' AND type = 'income');
