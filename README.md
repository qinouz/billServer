# bill-server

NestJS backend for migrating the bill app from WeChat Cloud functions to a self-hosted REST API.

## Setup

```bash
npm install
cp .env.example .env
npm run start:dev
```

Create the MySQL schema with `sql/schema.sql`, or set `DB_SYNCHRONIZE=true` during local development.

## API

The default local port is `8721`. All routes are prefixed with `/api`.

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/users/profile`
- `GET /api/users/stats`
- `GET /api/bills`
- `GET /api/bills/:id`
- `POST /api/bills`
- `POST /api/bills/batch`
- `PUT /api/bills/:id`
- `DELETE /api/bills/:id`
- `GET /api/bills/statistic?year=2026`
- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`
- `POST /api/categories/init`
- `GET /api/reminders`
- `POST /api/reminders`
- `POST /api/voice/recognize`
- `POST /api/voice/parse`
- `POST /api/photo/recognize`
