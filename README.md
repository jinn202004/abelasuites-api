# Joanah API

REST API for the Joanah project. Built with **Express**, **MongoDB** (Mongoose), and **JWT** authentication.

**Base URL:** `http://localhost:5000` (or your host + `PORT` from `.env`)

All JSON routes are prefixed with **`/api`**.

---

## Setup

1. **Requirements:** Node.js 18+, running MongoDB (local or Atlas).

2. **Install**

   ```bash
   npm install
   ```

3. **Environment**

   Copy `.env.example` to `.env` and set:

   | Variable | Description |
   |----------|-------------|
   | `PORT` | HTTP port (default `5000`) |
   | `MONGODB_URI` | MongoDB connection string |
   | `JWT_SECRET` | Secret used to sign JWTs (required for login) |
   | `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`, `24h`) |

4. **Run**

   ```bash
   npm run dev    # auto-restart on file changes (Node --watch)
   npm start      # production-style single run
   ```

If you already have user documents without a `username` field, add one (unique) to each document or clear the collection before testing registration again.

---

## Conventions

| Item | Detail |
|------|--------|
| **Content-Type** | `application/json` for bodies |
| **Success** | JSON object; shape documented per endpoint |
| **Errors** | `{ "error": "message" }` unless noted |
| **Auth** | Protected routes expect `Authorization: Bearer <access_token>` |

### Password rules

Passwords (registration and `newPassword` on profile update) must:

- Be at least **6** characters
- Contain at least one **lowercase** letter (a–z)
- Contain at least one **uppercase** letter (A–Z)
- Contain at least one **numeric** character (0–9)
- Contain at least one **special** character (any character that is not a letter or digit)

### Username rules

Usernames (registration and optional change via `PATCH /api/users/me`) must:

- Be **3–30** characters after trimming
- Contain only **letters**, **numbers**, and **underscores** (`a–z`, `A–Z`, `0–9`, `_`)

Stored usernames are **lowercase**; login matches case-insensitively.

### Roles

Each user has a `role` string:

| Value | Description |
|-------|-------------|
| `guest` | Default for new sign-ups |
| `cashier` | — |
| `frontdesk` | — |
| `admin` | — |
| `housekeeping` | — |

Self-service registration always sets **`guest`**. Changing a user’s role (e.g. to staff) is done outside this API (e.g. in the database or a future admin endpoint). **`PATCH /api/users/me` does not change `role`.** The JWT includes `role` for use in your app (route guards, etc.).

---

## Endpoints

### Health

#### `GET /api/health`

Liveness check (no auth).

**Response `200`**

```json
{
  "ok": true,
  "service": "joanah-api"
}
```

---

### Auth

#### `POST /api/auth/register`

Create a new account.

**Body**

| Field | Type | Required |
|-------|------|----------|
| `username` | string | yes (see [Username rules](#username-rules)) |
| `email` | string | yes |
| `password` | string | yes (see [Password rules](#password-rules)) |
| `firstName` | string | no |
| `lastName` | string | no |

New accounts always get `role: "guest"` (see [Roles](#roles)).

**Response `201`**

```json
{
  "user": {
    "id": "<ObjectId>",
    "username": "jane_doe",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "guest"
  }
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | Missing fields, username invalid, or password does not meet [rules](#password-rules) |
| `409` | Username or email already registered |

---

#### `POST /api/auth/login`

Obtain a JWT for subsequent requests. **Login uses username + password** (not email).

**Body**

| Field | Type | Required |
|-------|------|----------|
| `username` | string | yes |
| `password` | string | yes |

**Response `200`**

```json
{
  "token": "<jwt>",
  "user": {
    "id": "<ObjectId>",
    "username": "jane_doe",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "guest"
  }
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | Missing username or password |
| `401` | Invalid credentials |
| `500` | `JWT_SECRET` not configured |

Use the `token` value as: `Authorization: Bearer <token>`. The token payload includes `role` for authorization in the client or future middleware.

---

### Users

#### `GET /api/users/me`

Current user profile. **Requires authentication.**

**Headers:** `Authorization: Bearer <token>`

**Response `200`**

```json
{
  "user": {
    "id": "<ObjectId>",
    "username": "jane_doe",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "guest",
    "createdAt": "<ISO date>",
    "updatedAt": "<ISO date>"
  }
}
```

**Errors**

| Status | When |
|--------|------|
| `401` | Missing/invalid/expired token |
| `404` | User no longer exists |
| `500` | `JWT_SECRET` not configured |

---

#### `PATCH /api/users/me`

Update the authenticated user (profile fields, username, email, and/or password). **`role` is not updated here.** **Requires authentication.**

**Headers:** `Authorization: Bearer <token>`

**Body** (all fields optional; send only what you want to change)

| Field | Type | Notes |
|-------|------|--------|
| `firstName` | string | |
| `lastName` | string | |
| `username` | string | New username (see [Username rules](#username-rules)) |
| `email` | string | New email (unique) |
| `currentPassword` | string | Required if `newPassword` is sent |
| `newPassword` | string | Must meet [Password rules](#password-rules) |

**Response `200`**

```json
{
  "user": {
    "id": "<ObjectId>",
    "username": "jane_doe",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "guest",
    "createdAt": "<ISO date>",
    "updatedAt": "<ISO date>"
  }
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | Validation (e.g. `newPassword` without `currentPassword`, password rules not met) |
| `401` | Invalid token or wrong `currentPassword` |
| `404` | User not found |
| `409` | Username or email already in use |

---

#### `GET /api/users/:id`

Public user profile by ID. No auth.

**URL params**

| Param | Description |
|-------|-------------|
| `id` | MongoDB ObjectId |

**Response `200`**

```json
{
  "user": {
    "id": "<ObjectId>",
    "username": "jane_doe",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "guest",
    "createdAt": "<ISO date>",
    "updatedAt": "<ISO date>"
  }
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | `id` is not a valid ObjectId |
| `404` | User not found |

---

## Example: login then fetch profile

```http
POST /api/auth/login
Content-Type: application/json

{"username":"jane_doe","password":"Yourpass1!"}
```

```http
GET /api/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Other responses

- **`404`** — Unknown route: `{ "error": "Not found" }`
- **`500`** — Unhandled server error: `{ "error": "Internal server error" }` (or a specific message when thrown intentionally)
