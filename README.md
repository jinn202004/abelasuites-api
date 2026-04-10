# Joanah API

REST API for the Joanah project: **Express**, **MongoDB** (Mongoose), **JWT** auth, **CORS** enabled for all origins by default.

| | |
|--|--|
| **Base URL** | `http://localhost:<PORT>` (default port **5000**) |
| **API prefix** | All routes below are under **`/api`** |

---

## Contents

- [Setup](#setup)
- [Project layout](#project-layout)
- [Conventions](#conventions)
- [JWT](#jwt)
- [Endpoints](#endpoints)
- [Quick reference](#quick-reference)

---

## Setup

1. **Requirements:** Node.js **18+**, a running MongoDB instance (local or [Atlas](https://www.mongodb.com/cloud/atlas)).

2. **Install**

   ```bash
   cd backend
   npm install
   ```

3. **Environment**

   Copy `.env.example` to `.env` in the `backend` folder:

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `MONGODB_URI` | yes | MongoDB connection string (e.g. `mongodb://127.0.0.1:27017/joanah`) |
   | `JWT_SECRET` | yes for login | Long random string used to sign and verify JWTs |
   | `PORT` | no | HTTP port (default **5000**) |
   | `JWT_EXPIRES_IN` | no | Token lifetime (default **7d**). Examples: `24h`, `7d`, `3600` (seconds) |

   On success, the server logs a line when MongoDB connects.

4. **Run**

   ```bash
   npm run dev    # Node.js --watch: restarts on file changes
   npm start      # Single run (no watch)
   ```

**Legacy data:** If older user documents included a `username` field, remove it in MongoDB or migrate; users are keyed by **`email`** only.

---

## Project layout

```
backend/
├── .env.example
├── package.json
├── README.md
└── src/
    ├── server.js           # Entry: connect DB, listen
    ├── app.js              # Express app (middleware + /api routes)
    ├── config/
    │   ├── index.js        # env (PORT, MONGODB_URI, JWT_*)
    │   └── database.js     # mongoose.connect
    ├── controllers/        # auth, health, user
    ├── middleware/         # auth (JWT), notFound, errorHandler
    ├── models/             # User
    ├── routes/             # health, auth, user (mounted under /api)
    ├── services/           # auth, user
    └── utils/              # passwordValidation, asyncHandler
```

---

## Conventions

| Item | Detail |
|------|--------|
| **Content-Type** | `application/json` for request bodies |
| **Success** | JSON objects as documented per route |
| **Errors** | `{ "error": "message" }` unless noted |
| **Auth** | `Authorization: Bearer <access_token>` |

### Password rules

Applies to **registration** and to **`newPassword`** on profile updates:

- Minimum **6** characters  
- At least one **lowercase** (a–z), one **uppercase** (A–Z), one **digit** (0–9), one **special** (any non–letter/digit)

**Email** addresses are normalized (trimmed, lowercased) for login and storage.

### Roles

| Value | Typical use |
|-------|-------------|
| `guest` | Default for `POST /api/auth/register` |
| `cashier` | Staff |
| `frontdesk` | Staff |
| `admin` | Full user management (see below) |
| `housekeeping` | Staff |

- **Self-service** registration always creates **`guest`**.  
- **Changing roles:** Non-admins cannot set `role` via the API. **Admins** can set another user’s `role` with **`PATCH /api/users/:id`** when `:id` is **not** their own user id.  
- **`PATCH /api/users/me`:** Sending `role` returns an error (non-admin: forbidden; admin on self: not allowed to change own role here).  
- Re-issue JWTs after role changes in the database so tokens stay in sync (or log in again).

---

## JWT

Issued by **`POST /api/auth/login`**. Verify with `JWT_SECRET`.

| Claim | Meaning |
|-------|---------|
| `sub` | User id (MongoDB ObjectId as string) |
| `email` | User email |
| `role` | `guest` \| `cashier` \| `frontdesk` \| `admin` \| `housekeeping` |

Older tokens missing `role` are treated as `guest` by the auth middleware.

---

## Endpoints

### `GET /api/health`

Health check. **No auth.**

**200**

```json
{ "ok": true, "service": "joanah-api" }
```

---

### `POST /api/auth/register`

**Body**

| Field | Required | Notes |
|-------|----------|--------|
| `email` | yes | Unique |
| `password` | yes | [Password rules](#conventions) |
| `firstName` | no | |
| `lastName` | no | |
| `phone` | no | Contact number (stored trimmed; empty string if omitted) |

**201** — `{ "user": { "id", "email", "firstName", "lastName", "phone", "role" } }` with `role: "guest"`.

**Errors:** `400` validation, `409` duplicate email.

---

### `POST /api/auth/login`

**Body:** `{ "email", "password" }`

**200** — `{ "token", "user" }` — same user shape as register (`id`, `email`, `firstName`, `lastName`, `phone`, `role`; no `createdAt` in auth responses).

**Errors:** `400`, `401`, `500` (e.g. missing `JWT_SECRET`).

---

### `GET /api/users/me`

**Auth:** Bearer token.

**200** — `{ "user": { "id", "email", "firstName", "lastName", "phone", "role", "createdAt", "updatedAt" } }`

**Errors:** `401`, `404`, `500`.

---

### `PATCH /api/users/me`

Update the current user. **Auth:** Bearer token.

**Body** (all optional)

| Field | Notes |
|-------|--------|
| `firstName`, `lastName`, `email` | |
| `currentPassword` | Required if `newPassword` is sent |
| `newPassword` | [Password rules](#conventions) |
| `role` | Not applied; returns **403** (non-admin) or **400** (admin cannot change own role here) |

**200** — updated `user` (includes `createdAt` / `updatedAt`).

**Errors:** `400`, `401`, `403`, `404`, `409` (duplicate email).

---

### `PATCH /api/users/:id`

Update a user by id. **Auth:** Bearer token.

| Caller | Allowed |
|--------|---------|
| Same user as `:id` | Same as `PATCH /me` (password change requires `currentPassword`) |
| **`admin`** | Any user; for **another** user: may set `role`, may set `newPassword` **without** `currentPassword` (reset). Changing **own** password still requires `currentPassword`. |
| Other roles | Only their own id (`403` otherwise) |

**Errors:** `400`, `401`, `403`, `404`, `409`.

---

### `GET /api/users/:id`

Public profile by ObjectId. **No auth.**

**Errors:** `400` (invalid id), `404`.

---

## Quick reference

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/health` | No |
| `POST` | `/api/auth/register` | No |
| `POST` | `/api/auth/login` | No |
| `GET` | `/api/users/me` | Bearer |
| `PATCH` | `/api/users/me` | Bearer |
| `PATCH` | `/api/users/:id` | Bearer |
| `GET` | `/api/users/:id` | No |

---

## Example

```http
POST /api/auth/login HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{"email":"user@example.com","password":"Yourpass1!"}
```

```http
GET /api/users/me HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

---

## Other responses

| Status | Meaning |
|--------|---------|
| **404** | Unknown path: `{ "error": "Not found" }` |
| **500** | Unhandled error: `{ "error": "Internal server error" }` or a specific message |

Use a strong **`JWT_SECRET`** in production and keep `.env` out of version control.
