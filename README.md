# bill-server

NestJS backend for migrating the bill app from WeChat Cloud functions to a self-hosted REST API.

## Setup

```bash
npm install
cp .env.example .env
npm run start:dev
```

Create the MySQL schema with `sql/schema.sql`, or set `DB_SYNCHRONIZE=true` during local development.

## Production

For a home server deployment where Docker runs both the API and MySQL, see
`deploy/HOME_SERVER.md`.

Create `.env.prd` from `.env.example`, fill in the production values, then start MySQL with Docker:

```bash
docker-compose --env-file .env.prd -f docker-compose.prd.yml up -d
```

The production compose file only starts MySQL. MySQL is initialized with `sql/schema.sql` on first boot, and database data is stored in the `mysql_prd_data` volume.

Build and run the NestJS API on the host machine:

```bash
npm ci
npm run serve:prd
```

On Windows, `npm run serve:prd` sets `APP_ENV=prd` and `NODE_ENV=production`, loads `.env.prd`, builds `dist`, and starts `node dist/main.js`.

Configure host Nginx with `deploy/nginx/api.jingqiu.top.conf` and proxy HTTPS requests to `http://127.0.0.1:8721`. The request flow is:

```text
https://api.jingqiu.top
  -> Windows Nginx
  -> http://127.0.0.1:8721
  -> NestJS API
  -> Docker MySQL
```

Useful production commands:

```bash
docker-compose --env-file .env.prd -f docker-compose.prd.yml ps
docker-compose --env-file .env.prd -f docker-compose.prd.yml logs -f mysql
npm run build:prd
npm run start:prd
npm run serve:prd
```

## API

The default local port is `8721`. All routes are prefixed with `/api`.

Money fields use integer cents in API contracts and database storage. For
example, `amountCents: 1234` means `12.34` yuan. Clients should only format
yuan values for display.

Audit time fields use Unix milliseconds in API responses. For example,
`createdAt: 1781265600000`. Business date and time fields remain strings:
`billDate` uses `YYYY-MM-DD`, and `reminderTime` uses `HH:mm`.

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

### Bills

`POST /api/bills`, `POST /api/bills/batch`, and `PUT /api/bills/:id` accept
`amountCents`.

When `GET /api/bills` is queried with `month=YYYY-MM`, the response includes a
month-level `summary` beside the paginated `list`:

```json
{
  "list": [],
  "pagination": {
    "pageNo": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  },
  "summary": {
    "incomeCents": 0,
    "expenseCents": 0,
    "balanceCents": 0
  }
}
```

The summary is calculated for the full month, not only the current page.

### AI Recognition

`POST /api/voice/recognize` accepts `multipart/form-data` with a `file` field.
The file must be `audio/mpeg`, `audio/mp3`, or `audio/wav`. The service calls
MiMo ASR first and then parses the recognized text into candidate bill items.

`POST /api/voice/parse` accepts JSON for text-only debugging:

```json
{
  "text": "早餐 12.5，打车 26"
}
```

`POST /api/photo/recognize` accepts `multipart/form-data` with a `file` field.
The response contains candidate bill items that the client should show for user
confirmation before calling `POST /api/bills`.

For text-only debugging, the same route also accepts JSON:

```json
{
  "text": "付款成功 28.00 餐厅"
}
```

Recognition responses use `amountCents`:

```json
{
  "recognizedText": "早餐 12.5",
  "items": [
    {
      "amountCents": 1250,
      "categoryId": "1",
      "categoryName": "餐饮",
      "type": "expense",
      "remark": "早餐",
      "billDate": "2026-06-13",
      "confidence": "high"
    }
  ]
}
```

Configure MiMo recognition with:

```env
MIMO_API_KEY=your_mimo_api_key
MIMO_API_URL=https://token-plan-cn.xiaomimimo.com/v1/chat/completions
MIMO_MODEL=mimo-v2.5
MIMO_TIMEOUT_MS=60000
```
