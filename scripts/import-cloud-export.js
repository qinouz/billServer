const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..');

function loadEnv(file) {
  const envPath = path.join(root, file);
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }
    const index = rawLine.indexOf('=');
    const key = rawLine.slice(0, index).trim();
    const value = rawLine.slice(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readNdjson(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path.basename(file)} line ${index + 1}: ${error.message}`);
      }
    });
}

function classify(rows) {
  const first = rows[0] || {};
  if ('openid' in first) {
    return 'users';
  }
  if ('categoryId' in first && 'billDate' in first) {
    return 'bills';
  }
  if ('reminderTime' in first || 'reminder_time' in first) {
    return 'reminders';
  }
  if ('name' in first && 'icon' in first && 'type' in first) {
    return 'categories';
  }
  return 'unknown';
}

function readExports() {
  const files = fs
    .readdirSync(root)
    .filter((file) => /^database_export-.*\.json$/i.test(file))
    .map((file) => path.join(root, file));

  const result = {
    users: [],
    categories: [],
    bills: [],
    reminders: [],
  };

  for (const file of files) {
    const rows = readNdjson(file);
    const type = classify(rows);
    if (type === 'unknown') {
      console.warn(`skip unknown export: ${path.basename(file)}`);
      continue;
    }
    result[type].push(...rows);
    console.log(`${path.basename(file)} -> ${type}: ${rows.length}`);
  }

  return result;
}

function mysqlDate(value) {
  const raw = value && typeof value === 'object' && '$date' in value ? value.$date : value;
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function ensureMapTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS migration_import_map (
      source VARCHAR(32) NOT NULL,
      old_id VARCHAR(128) NOT NULL,
      new_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (source, old_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getMappedId(connection, source, oldId) {
  const [rows] = await connection.query(
    'SELECT new_id FROM migration_import_map WHERE source = ? AND old_id = ?',
    [source, oldId],
  );
  return rows[0] ? String(rows[0].new_id) : null;
}

async function saveMappedId(connection, source, oldId, newId) {
  await connection.query(
    `INSERT INTO migration_import_map (source, old_id, new_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE new_id = VALUES(new_id)`,
    [source, oldId, newId],
  );
}

async function importUsers(connection, users) {
  let created = 0;
  let reused = 0;

  for (const user of users) {
    const mapped = await getMappedId(connection, 'users', user._id);
    if (mapped) {
      reused += 1;
      continue;
    }

    const [existing] = await connection.query('SELECT id FROM users WHERE openid = ?', [
      user.openid,
    ]);

    let id = existing[0] ? String(existing[0].id) : null;
    if (!id) {
      const createdAt = mysqlDate(user.createTime) || mysqlDate(new Date());
      const [result] = await connection.query(
        `INSERT INTO users (openid, unionid, nickname, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user.openid,
          user.unionid || null,
          user.nickName || user.nickname || '新用户',
          user.avatarUrl || user.avatar_url || '',
          createdAt,
          createdAt,
        ],
      );
      id = String(result.insertId);
      created += 1;
    } else {
      reused += 1;
    }

    await saveMappedId(connection, 'users', user._id, id);
  }

  return { created, reused };
}

async function importCategories(connection, categories) {
  let created = 0;
  let reused = 0;

  for (const category of categories) {
    const mapped = await getMappedId(connection, 'categories', category._id);
    if (mapped) {
      reused += 1;
      continue;
    }

    const userId = category.userId
      ? await getMappedId(connection, 'users', category.userId)
      : null;
    if (category.userId && !userId) {
      throw new Error(`category ${category._id} references missing user ${category.userId}`);
    }

    const [existing] = await connection.query(
      `SELECT id FROM categories
       WHERE user_id <=> ? AND name = ? AND type = ?
       ORDER BY id ASC LIMIT 1`,
      [userId, category.name, category.type],
    );

    let id = existing[0] ? String(existing[0].id) : null;
    if (!id) {
      const [result] = await connection.query(
        `INSERT INTO categories (user_id, name, icon, type, sort_order, is_system, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          category.name,
          category.icon || '',
          category.type,
          category.sort ?? category.sortOrder ?? 0,
          false,
          mysqlDate(category.createTime) || mysqlDate(new Date()),
        ],
      );
      id = String(result.insertId);
      created += 1;
    } else {
      reused += 1;
    }

    await saveMappedId(connection, 'categories', category._id, id);
  }

  return { created, reused };
}

async function importBills(connection, bills) {
  let created = 0;
  let reused = 0;
  let skippedInvalidDeleted = 0;

  for (const bill of bills) {
    const mapped = await getMappedId(connection, 'bills', bill._id);
    if (mapped) {
      reused += 1;
      continue;
    }

    const amount = Number(bill.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
      if (bill.isDeleted) {
        skippedInvalidDeleted += 1;
        continue;
      }
      throw new Error(`bill ${bill._id} has invalid amount: ${bill.amount}`);
    }

    const userId = await getMappedId(connection, 'users', bill.userId);
    const categoryId = await getMappedId(connection, 'categories', bill.categoryId);
    if (!userId) {
      throw new Error(`bill ${bill._id} references missing user ${bill.userId}`);
    }
    if (!categoryId) {
      throw new Error(`bill ${bill._id} references missing category ${bill.categoryId}`);
    }

    const [result] = await connection.query(
      `INSERT INTO bills
       (user_id, category_id, amount, type, remark, bill_date, created_at, updated_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        categoryId,
        amount.toFixed(2),
        bill.type,
        bill.remark || '',
        bill.billDate,
        mysqlDate(bill.createTime) || mysqlDate(new Date()),
        mysqlDate(bill.updateTime) || mysqlDate(bill.createTime) || mysqlDate(new Date()),
        Boolean(bill.isDeleted),
      ],
    );

    await saveMappedId(connection, 'bills', bill._id, String(result.insertId));
    created += 1;
  }

  return { created, reused, skippedInvalidDeleted };
}

async function main() {
  loadEnv('.env');

  const exports = readExports();
  if (exports.users.length === 0 || exports.categories.length === 0 || exports.bills.length === 0) {
    throw new Error('expected users, categories, and bills export files in the project root');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'bill_db',
    charset: 'utf8mb4',
    timezone: 'Z',
  });

  try {
    await ensureMapTable(connection);
    await connection.beginTransaction();

    const users = await importUsers(connection, exports.users);
    const categories = await importCategories(connection, exports.categories);
    const bills = await importBills(connection, exports.bills);

    await connection.commit();
    console.log('import complete');
    console.table({ users, categories, bills });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
