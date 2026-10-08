# Bridge
Bridge is a compact internal portal for collecting structured employee requests and routing them through an administrative review process.

## What it includes
- Separate employee and administrator views
- Request submission, review, approval, rejection, and history
- Employee management and CSV import
- Configurable request templates
- Optional email notification and signing-service integrations

## Project layout
- `client/` — React and Vite single-page application
- `server/` — Express API, MongoDB models, and document workflow services

## Run locally
1. Install Node.js 20 or newer and ensure MongoDB is available.
2. Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`.
3. Set `MONGO_URI`, `SESSION_SECRET`, and `JWT_SECRET` in `server/.env`. Integration variables are optional.
4. Install dependencies from the repository root: `npm install`
5. In separate terminals, start the API and client: `npm run start:server` and `npm run start:client`
6. Open `http://localhost:5173`.

## Checks
Run the complete local validation workflow before deployment:

```bash
npm run check
```

This runs client linting, server runtime tests, and the production client build. The server tests do not require MongoDB because they exercise configuration parsing and the degraded `/health` response before a database connection is established.

The API exposes `GET /health` for process checks. It returns `200` when MongoDB is connected and `503` with a `degraded` status while the database is unavailable.

## Configuration
No credentials, private signing keys, employee records, or generated documents are included. Configure those through local environment files and the application's administrative workflows.

`JWT_SECRET` is required by the employee authentication middleware. Use a long random value in every non-development environment, and do not reuse `SESSION_SECRET`.
