SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

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

ALTER TABLE users
  MODIFY openid VARCHAR(64) NOT NULL COMMENT '微信openid',
  MODIFY unionid VARCHAR(64) DEFAULT NULL COMMENT '微信unionid',
  MODIFY nickname VARCHAR(50) DEFAULT '新用户' COMMENT '昵称',
  MODIFY avatar_url VARCHAR(255) DEFAULT '' COMMENT '头像URL',
  COMMENT='用户表';

ALTER TABLE categories
  MODIFY user_id BIGINT DEFAULT NULL COMMENT '用户ID，NULL为系统分类',
  MODIFY name VARCHAR(50) NOT NULL COMMENT '分类名称',
  MODIFY icon VARCHAR(50) DEFAULT '' COMMENT '图标标识',
  MODIFY type ENUM('income', 'expense') NOT NULL COMMENT '类型',
  MODIFY sort_order INT DEFAULT 0 COMMENT '排序',
  MODIFY is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统分类',
  COMMENT='分类表';

ALTER TABLE bills
  MODIFY user_id BIGINT NOT NULL COMMENT '用户ID',
  MODIFY category_id BIGINT NOT NULL COMMENT '分类ID',
  MODIFY amount DECIMAL(10,2) NOT NULL COMMENT '金额',
  MODIFY type ENUM('income', 'expense') NOT NULL COMMENT '类型',
  MODIFY remark VARCHAR(200) DEFAULT '' COMMENT '备注',
  MODIFY bill_date DATE NOT NULL COMMENT '账单日期',
  MODIFY is_deleted BOOLEAN DEFAULT FALSE COMMENT '软删除',
  COMMENT='账单表';

ALTER TABLE reminders
  MODIFY user_id BIGINT NOT NULL COMMENT '用户ID',
  MODIFY reminder_time TIME NOT NULL COMMENT '提醒时间',
  MODIFY is_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  COMMENT='提醒表';

UPDATE users
SET nickname = '新用户'
WHERE nickname = 'æ–°ç”¨æˆ·';

UPDATE categories c
JOIN (
  SELECT '餐饮' name, '🍜' icon, 'expense' type, 1 sort_order UNION ALL
  SELECT '购物', '🛒', 'expense', 2 UNION ALL
  SELECT '日用', '🏠', 'expense', 3 UNION ALL
  SELECT '交通', '🚗', 'expense', 4 UNION ALL
  SELECT '蔬菜', '🥬', 'expense', 5 UNION ALL
  SELECT '水果', '🍎', 'expense', 6 UNION ALL
  SELECT '零食', '🍪', 'expense', 7 UNION ALL
  SELECT '运动', '⚽', 'expense', 8 UNION ALL
  SELECT '娱乐', '🎮', 'expense', 9 UNION ALL
  SELECT '通讯', '📱', 'expense', 10 UNION ALL
  SELECT '服饰', '👔', 'expense', 11 UNION ALL
  SELECT '美容', '💄', 'expense', 12 UNION ALL
  SELECT '住房', '🏡', 'expense', 13 UNION ALL
  SELECT '居家', '🛋️', 'expense', 14 UNION ALL
  SELECT '孩子', '👶', 'expense', 15 UNION ALL
  SELECT '长辈', '👴', 'expense', 16 UNION ALL
  SELECT '社交', '🤝', 'expense', 17 UNION ALL
  SELECT '旅行', '✈️', 'expense', 18 UNION ALL
  SELECT '烟酒', '🚬', 'expense', 19 UNION ALL
  SELECT '数码', '💻', 'expense', 20 UNION ALL
  SELECT '汽车', '🚙', 'expense', 21 UNION ALL
  SELECT '医疗', '💊', 'expense', 22 UNION ALL
  SELECT '书籍', '📚', 'expense', 23 UNION ALL
  SELECT '学习', '📖', 'expense', 24 UNION ALL
  SELECT '工资', '💰', 'income', 1 UNION ALL
  SELECT '兼职', '💼', 'income', 2 UNION ALL
  SELECT '理财', '📈', 'income', 3 UNION ALL
  SELECT '礼金', '🧧', 'income', 4 UNION ALL
  SELECT '其它', '💵', 'income', 5
) seed ON c.user_id IS NULL AND c.name = seed.name AND c.type = seed.type
SET c.icon = seed.icon, c.sort_order = seed.sort_order, c.is_system = TRUE;

INSERT INTO categories (user_id, name, icon, type, sort_order, is_system)
SELECT NULL, seed.name, seed.icon, seed.type, seed.sort_order, TRUE
FROM (
  SELECT '餐饮' name, '🍜' icon, 'expense' type, 1 sort_order UNION ALL
  SELECT '购物', '🛒', 'expense', 2 UNION ALL
  SELECT '日用', '🏠', 'expense', 3 UNION ALL
  SELECT '交通', '🚗', 'expense', 4 UNION ALL
  SELECT '蔬菜', '🥬', 'expense', 5 UNION ALL
  SELECT '水果', '🍎', 'expense', 6 UNION ALL
  SELECT '零食', '🍪', 'expense', 7 UNION ALL
  SELECT '运动', '⚽', 'expense', 8 UNION ALL
  SELECT '娱乐', '🎮', 'expense', 9 UNION ALL
  SELECT '通讯', '📱', 'expense', 10 UNION ALL
  SELECT '服饰', '👔', 'expense', 11 UNION ALL
  SELECT '美容', '💄', 'expense', 12 UNION ALL
  SELECT '住房', '🏡', 'expense', 13 UNION ALL
  SELECT '居家', '🛋️', 'expense', 14 UNION ALL
  SELECT '孩子', '👶', 'expense', 15 UNION ALL
  SELECT '长辈', '👴', 'expense', 16 UNION ALL
  SELECT '社交', '🤝', 'expense', 17 UNION ALL
  SELECT '旅行', '✈️', 'expense', 18 UNION ALL
  SELECT '烟酒', '🚬', 'expense', 19 UNION ALL
  SELECT '数码', '💻', 'expense', 20 UNION ALL
  SELECT '汽车', '🚙', 'expense', 21 UNION ALL
  SELECT '医疗', '💊', 'expense', 22 UNION ALL
  SELECT '书籍', '📚', 'expense', 23 UNION ALL
  SELECT '学习', '📖', 'expense', 24 UNION ALL
  SELECT '工资', '💰', 'income', 1 UNION ALL
  SELECT '兼职', '💼', 'income', 2 UNION ALL
  SELECT '理财', '📈', 'income', 3 UNION ALL
  SELECT '礼金', '🧧', 'income', 4 UNION ALL
  SELECT '其它', '💵', 'income', 5
) seed
WHERE NOT EXISTS (
  SELECT 1
  FROM categories c
  WHERE c.user_id IS NULL AND c.name = seed.name AND c.type = seed.type
);

DELETE c
FROM categories c
LEFT JOIN bills b ON b.category_id = c.id AND b.is_deleted = FALSE
LEFT JOIN (
  SELECT '餐饮' name, 'expense' type UNION ALL
  SELECT '购物', 'expense' UNION ALL
  SELECT '日用', 'expense' UNION ALL
  SELECT '交通', 'expense' UNION ALL
  SELECT '蔬菜', 'expense' UNION ALL
  SELECT '水果', 'expense' UNION ALL
  SELECT '零食', 'expense' UNION ALL
  SELECT '运动', 'expense' UNION ALL
  SELECT '娱乐', 'expense' UNION ALL
  SELECT '通讯', 'expense' UNION ALL
  SELECT '服饰', 'expense' UNION ALL
  SELECT '美容', 'expense' UNION ALL
  SELECT '住房', 'expense' UNION ALL
  SELECT '居家', 'expense' UNION ALL
  SELECT '孩子', 'expense' UNION ALL
  SELECT '长辈', 'expense' UNION ALL
  SELECT '社交', 'expense' UNION ALL
  SELECT '旅行', 'expense' UNION ALL
  SELECT '烟酒', 'expense' UNION ALL
  SELECT '数码', 'expense' UNION ALL
  SELECT '汽车', 'expense' UNION ALL
  SELECT '医疗', 'expense' UNION ALL
  SELECT '书籍', 'expense' UNION ALL
  SELECT '学习', 'expense' UNION ALL
  SELECT '工资', 'income' UNION ALL
  SELECT '兼职', 'income' UNION ALL
  SELECT '理财', 'income' UNION ALL
  SELECT '礼金', 'income' UNION ALL
  SELECT '其它', 'income'
) seed ON seed.name = c.name AND seed.type = c.type
WHERE c.user_id IS NULL
  AND c.is_system = TRUE
  AND b.id IS NULL
  AND seed.name IS NULL;
